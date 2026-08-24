// unit-speech-recognition.test.js
// v84_g — browser-native speech recognition reused for answer checking (user request, following up
// on the discussion-only "recording a spoken reply" note in roadmap_v83.md). MCQ coverage widened at
// v84_h, a missed gap closed and a "heard" field added at v84_i. v84_k (two direct user follow-ups
// landing in the same session, before either reached main): syn_select (multi-select synonym/antonym
// tiles) got speech coverage too — select+colour a tile live, never auto-check/advance — and then,
// once tried live, EVERY per-exercise mic button (including the one syn_select had just gained) was
// replaced with ONE persistent pill in the bottom bar (`#speech-mic-pill`, next to the mute pill):
// inert/greyed whenever the current question has nothing speakable, active and LISTENING
// AUTOMATICALLY the instant a speakable one renders (no tap required), and re-arming itself after
// every result — match or not — until the question is answered or changes ("we always activate it
// per default"). Contract under test:
//   • `_speechKindFor(ex)` is the ONE place that decides speakability — direct, exhaustive coverage
//     of every wired type, every exclusion (comprehension, script-primer intro variants, no-keyboard
//     glyph-order mode), and the two types whose render function is SHARED with an intro variant
//     (`mcq_source_target`, `listen_mcq` — the exact gap that shipped unwired at v84_h).
//   • `_speechMicRefresh()` (called from `renderEx`/`show`) sets the pill's disabled/active state to
//     match, and starts auto-listening when there's something to listen for.
//   • The auto-loop re-arms after a SOFT outcome (no-speech, no-match, a superseded/aborted pass) and
//     stops after a HARD one (permission denied, no mic, offline) or once the question is answered.
//   • Matching/scoring per kind is UNCHANGED from the per-button era: 'type' fills+checks on a match,
//     never auto-submits on a miss; 'mcq' taps the CORRECT choice only, transcript always shown; 'syn'
//     selects+colours ANY offered tile (green if correct, red otherwise), never checks/advances.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.lessonData = { id:'t1', lang:'de', srcLang:'en' };
    APP.lang='de'; APP.srcLang='en'; APP.muted = true; APP.noKeyboard = false;
    APP.info = { backend:'none', canGenerate:false };
    renderEx = function(){};   // the eventual _speakAndAdvance timer must not need a real round
    show = function(){}; speak = function(){};
    true;`, 'seed');
  return C;
}

// A mock SpeechRecognition constructor whose `.start()` consumes the NEXT step of a scripted
// sequence (the last step repeats once exhausted) — lets a test drive several chained auto-relisten
// passes and assert on how many actually happened. Fires onresult XOR onerror on a real
// setTimeout(0) — same event-loop tick shape a real implementation uses — then always fires onend.
function mockCtorSeq(steps) {
  return `window.__micCalls = 0;
  window.SpeechRecognition = function(){
    var self = this;
    this.start = function(){
      window.__micCalls++;
      var steps = ${JSON.stringify(steps)};
      var step = steps[Math.min(window.__micCalls - 1, steps.length - 1)];
      setTimeout(function(){
        if(step.err){ if(self.onerror) self.onerror({error: step.err}); }
        else { if(self.onresult) self.onresult({results:[(step.alts||[]).map(function(t){ return {transcript:t}; })]}); }
        if(self.onend) self.onend();
      }, step.delay || 0);
    };
    this.abort = function(){};
  };`;
}
const mockCtor = (alts, err) => mockCtorSeq([{ alts, err }]);
const settle = (ms) => new Promise(r => setTimeout(r, ms || 30));

(async () => {

// ── 1. _speechKindFor: the one speakability map, exhaustive ──────────────────
{
  const C = client();
  // JSON.stringify INSIDE the vm, not a cross-realm deepStrictEqual on the returned object — a plain
  // object literal built inside loadClient's sandbox has that context's OWN Object prototype, not
  // this process's, so comparing object identity/shape directly is a false-negative trap.
  const kf = (ex) => C.run(`JSON.stringify(_speechKindFor(${JSON.stringify(ex)}))`);
  // Typed-answer, target locale.
  for (const type of ['listen_type', 'type_plural', 'type_conjugation']) {
    assert.strictEqual(kf({ type }), JSON.stringify({ kind: 'type' }), `${type} is speakable as 'type'`);
  }
  // No-keyboard glyph-order mode swaps the typed template entirely — nothing to listen INTO.
  C.run('APP.noKeyboard = true;');
  assert.strictEqual(kf({ type: 'listen_type' }), 'null', 'no-keyboard mode: typed types are not speakable (no #type-in exists)');
  C.run('APP.noKeyboard = false;');
  // MCQ, target locale.
  for (const type of ['mcq_article', 'mcq_plural', 'mcq_conjugation']) {
    assert.strictEqual(kf({ type }), JSON.stringify({ kind: 'mcq', locale: 'target' }), `${type} is speakable as MCQ/target`);
  }
  // mcq_source_target: target locale UNLESS it's the script-primer intro variant (the v84_h gap).
  assert.strictEqual(kf({ type: 'mcq_source_target' }), JSON.stringify({ kind: 'mcq', locale: 'target' }),
    'mcq_source_target (regular vocabulary) is speakable as MCQ/target — the v84_i fix');
  assert.strictEqual(kf({ type: 'mcq_source_target', _intro: 'glyph_sound' }), 'null', 'mcq_source_target glyph_sound intro is NOT speakable');
  assert.strictEqual(kf({ type: 'mcq_source_target', _intro: 'sound_glyph' }), 'null', 'mcq_source_target sound_glyph intro is NOT speakable');
  // MCQ, source locale.
  assert.strictEqual(kf({ type: 'mcq_target_source' }), JSON.stringify({ kind: 'mcq', locale: 'source' }), 'mcq_target_source is speakable as MCQ/source');
  assert.strictEqual(kf({ type: 'listen_mcq' }), JSON.stringify({ kind: 'mcq', locale: 'source' }), 'listen_mcq (regular) is speakable as MCQ/source');
  assert.strictEqual(kf({ type: 'listen_mcq', _intro: 'listen_glyph' }), 'null', 'listen_mcq glyph-picking intro is NOT speakable');
  // syn_select.
  assert.strictEqual(kf({ type: 'syn_select' }), JSON.stringify({ kind: 'syn' }), 'syn_select is speakable');
  // Never speakable: full-sentence / non-vocabulary types, and no exercise at all.
  for (const type of ['comprehension_mcq', 'order', 'math_calc', 'math_order', 'math_latex', 'read_translate']) {
    assert.strictEqual(kf({ type }), 'null', `${type} is never speakable`);
  }
  assert.strictEqual(kf(null), 'null', 'no current exercise → not speakable');
}
console.log('  _speechKindFor: exhaustive speakability map, incl. shared-function intro exclusions and no-keyboard: OK');

// ── 2. The pill: disabled/active state follows _speechMicRefresh(), feature-detected ──
{
  const C = client();   // no SpeechRecognition global at all
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ disabled: document.getElementById('speech-mic-pill').disabled,
    active: document.getElementById('speech-mic-pill').classList.contains('active') })`);
  assert.strictEqual(r.disabled, true, 'unsupported browser: the pill stays disabled even for a speakable exercise');
  assert.strictEqual(r.active, false, 'and never gets the active class');
}
{
  const C = client();
  C.run(mockCtor(['x']));
  C.run(`APP.cur = { exercises: [{ type:'order' }], cur:0, answered:false };   // NOT speakable
    _speechMicRefresh(); true;`);
  const r = C.run(`document.getElementById('speech-mic-pill').disabled`);
  assert.strictEqual(r, true, 'a non-speakable exercise disables the pill even when SpeechRecognition IS supported');
}
{
  const C = client();
  // A hard error, not a plain mismatch: the pill's disabled/active state is set SYNCHRONOUSLY by
  // _speechMicRefresh(), before the async recognition pass it kicks off even runs — but that pass
  // still starts for real, and since answered() never becomes true for THIS synthetic exercise, a
  // mock that never matches and never hard-errors would auto-relisten forever (the intended
  // production behaviour) and leave this test process hanging. A hard error lets it self-terminate
  // after one pass without touching what this block actually asserts on.
  C.run(mockCtor(null, 'not-allowed'));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ disabled: document.getElementById('speech-mic-pill').disabled,
    active: document.getElementById('speech-mic-pill').classList.contains('active') })`);
  assert.strictEqual(r.disabled, false, 'a speakable exercise, supported browser: the pill is enabled');
  assert.strictEqual(r.active, true, 'and marked active');
  await settle();   // let the one pending (hard-erroring) pass finish before this vm is abandoned
}
console.log('  pill state: disabled unless BOTH supported and speakable, active otherwise: OK');

// ── 3. Auto-start: a speakable render listens WITHOUT any click, and a match checks/advances ──
{
  const C = client();
  C.run(mockCtor(['Katzen']));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // simulates what renderEx() now does on every question — no click at all
    true;`);
  await settle();
  const r = C.run(`({ calls: window.__micCalls, answered: APP.cur.answered,
    val: document.getElementById('type-in').value, ok: document.getElementById('type-in').classList.contains('ok') })`);
  assert.strictEqual(r.calls, 1, 'listening started on its own, with no _speechMicPillClick() call anywhere in this test');
  assert.strictEqual(r.answered, true, 'a matching transcript answers the question, exactly as the old per-button path did');
  assert.strictEqual(r.val, 'Katzen', 'filled with the canonical answer');
  assert.strictEqual(r.ok, true, 'and turns green');
}
console.log('  auto-start: a speakable render listens with zero clicks, a match checks/advances: OK');

// ── 4. Auto-RELISTEN: a soft miss re-arms itself, with no toast-spam, until a later attempt matches ──
{
  const C = client();
  C.run(mockCtorSeq([{ alts: ['Hunde'] }, { err: 'no-speech' }, { alts: ['Katzen'] }]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    document.getElementById('toast').textContent = '';
    _speechMicRefresh();
    true;`);
  await settle(120);   // three chained passes, each a real setTimeout(0) hop
  const r = C.run(`({ calls: window.__micCalls, answered: APP.cur.answered,
    val: document.getElementById('type-in').value, toast: document.getElementById('toast').textContent })`);
  assert.strictEqual(r.calls, 3, 'a mismatch AND a plain silence both re-armed automatically — three passes ran unattended');
  assert.strictEqual(r.answered, true, 'the third pass matched and answered the question');
  assert.strictEqual(r.val, 'Katzen', 'filled with the canonical answer from the pass that actually matched');
  assert.strictEqual(r.toast, UI.en['ex.mic_no_match'], 'the LAST toast is the mismatch one — "no-speech" never toasted at all, so it never overwrote/spammed');
}
console.log('  auto-relisten: mismatches and plain silence both re-arm automatically, no toast-spam, until a match lands: OK');

// ── 5. A HARD error stops the loop — no infinite retry, no toast-spam on a real permission problem ──
{
  const C = client();
  C.run(mockCtor(null, 'not-allowed'));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('toast').textContent = '';
    _speechMicRefresh();
    true;`);
  await settle(120);   // long enough that a (bug-)looping implementation would have retried several times
  const r = C.run(`({ calls: window.__micCalls, toast: document.getElementById('toast').textContent, answered: APP.cur.answered })`);
  assert.strictEqual(r.calls, 1, 'a genuine permission error stops the loop after ONE attempt, not an infinite retry');
  assert.strictEqual(r.toast, UI.en['ex.mic_error'], 'toasted once, with the permissions message');
  assert.strictEqual(r.answered, false, 'never answers the question');
}
console.log('  hard errors: the auto-loop stops after one attempt, toasted once, never spins: OK');

// ── 6. MCQ (target locale), via auto-start: a match taps the CORRECT choice, transcript shown ──
{
  const C = client();
  C.run(mockCtor(['Katzen']));
  C.run(`APP.cur = { exercises: [{ type:'mcq_plural', target:'Katze', correct:'Katzen',
      choices:['Katzen','Katze','Katzes','Katzens'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['Katzen','Katze','Katzes','Katzens'].forEach(function(w,i){
      var b = document.getElementById('c'+i); b.textContent = w; b.classList.add('choice');
    });
    _speechMicRefresh();
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, sel: APP.cur.sel,
    ok0: document.getElementById('c0').classList.contains('ok'),
    heardText: document.getElementById('mcq-mic-heard').textContent,
    heardMatch: document.getElementById('mcq-mic-heard').classList.contains('match') })`);
  assert.strictEqual(r.answered, true, 'a matching transcript answers via the real pickChoice/check path');
  assert.strictEqual(r.sel, 'Katzen', 'the CORRECT choice was the one tapped');
  assert.strictEqual(r.ok0, true, 'and turns green');
  assert.strictEqual(r.heardText, 'Katzen', 'what was heard IS shown next to the choices');
  assert.strictEqual(r.heardMatch, true, 'green, matching the tapped choice');
}
console.log('  MCQ (target), auto-started: matches, taps, shows what it heard: OK');

// ── 6b. MCQ (source locale): a source-language transcript matches a source-choice MCQ ─────
{
  const C = client();
  C.run(mockCtor(['cat']));
  C.run(`APP.cur = { exercises: [{ type:'mcq_target_source', target:'Katze', correct:'cat',
      choices:['cat','dog','house','tree'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['cat','dog','house','tree'].forEach(function(w,i){
      var b = document.getElementById('c'+i); b.textContent = w; b.classList.add('choice');
    });
    _speechMicRefresh();
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, sel: APP.cur.sel })`);
  assert.strictEqual(r.answered, true, 'a source-language transcript answers a source-choice MCQ');
  assert.strictEqual(r.sel, 'cat', 'the correct SOURCE-language choice was tapped');
}
console.log('  MCQ (source), auto-started: listens in the right language, matches: OK');

// ── 7. syn_select: voice SELECTS+COLOURS a tile live, never checks/advances the round ────
function synClient() {
  const C = client();
  C.run(`APP.cur = { exercises: [{ type:'syn_select', mode:'synonyms', base:'schnell',
      correct:['rasch','flott'], choices:['rasch','flott','langsam','müde'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['rasch','flott','langsam','müde'].forEach(function(w,i){
      var b = document.getElementById('st'+i); b.textContent = w; b.dataset.w = w; b.classList.add('syn-tile');
    });
    document.getElementById('cbtn').disabled = true;`);
  return C;
}
// syn_select NEVER sets `answered` on its own (a tile match/mismatch is just a selection, not a
// verdict — see _speechRun's own comment) — so unlike every other kind, the auto-loop here has no
// natural stopping point of its own to reach. Every mock below therefore scripts a SECOND, hard-
// erroring step: the first step is the one actually under test, and the second one is purely so the
// loop's own (correct, intended) auto-relisten behaviour terminates instead of running forever in
// the background once this test block returns — the exact behaviour section 4 tests on the syn_select
// case's typed/MCQ cousins, exercised here only as a safe stopping mechanism, not the point of the test.
{
  const C = synClient();
  C.run(mockCtorSeq([{ alts: ['rasch'] }, { err: 'not-allowed' }]));
  C.run(`_speechMicRefresh(); true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, sel0: document.getElementById('st0').classList.contains('sel'),
    ok0: document.getElementById('st0').classList.contains('ok'), cbtnDisabled: document.getElementById('cbtn').disabled })`);
  assert.strictEqual(r.sel0, true, 'a recognized correct synonym IS selected, exactly like a tap');
  assert.strictEqual(r.ok0, true, 'and coloured green immediately');
  assert.strictEqual(r.answered, false, 'a single correct word does NOT check/advance — syn_select asks for several');
  assert.strictEqual(r.cbtnDisabled, false, 'Check becomes available, same as a manual tap');
}
{
  const C = synClient();
  C.run(mockCtorSeq([{ alts: ['langsam'] }, { err: 'not-allowed' }]));   // langsam: a real distractor, not one of ex.correct
  C.run(`_speechMicRefresh(); true;`);
  await settle();
  const r = C.run(`({ sel2: document.getElementById('st2').classList.contains('sel'),
    bad2: document.getElementById('st2').classList.contains('bad'), answered: APP.cur.answered })`);
  assert.strictEqual(r.sel2, true, 'a wrong-but-offered word is still selected, exactly like a tap on it would be');
  assert.strictEqual(r.bad2, true, 'and coloured RED — "needs to be de-selected by tapping"');
  assert.strictEqual(r.answered, false, 'still never auto-checks');
}
{
  // Tapping a reddened tile clears BOTH the selection and the colour (the escape hatch).
  const C = synClient();
  C.run(mockCtorSeq([{ alts: ['langsam'] }, { err: 'not-allowed' }]));
  C.run(`_speechMicRefresh(); true;`);
  await settle();
  const before = C.run(`document.getElementById('st2').classList.contains('bad')`);
  assert.strictEqual(before, true, 'sanity: red before the tap');
  const after = C.run(`synToggle(2, document.getElementById('st2'));
    ({ sel: document.getElementById('st2').classList.contains('sel'), bad: document.getElementById('st2').classList.contains('bad') })`);
  assert.strictEqual(after.sel, false, 'a tap de-selects it');
  assert.strictEqual(after.bad, false, 'and clears the red preview — fully neutral, not red-but-unselected');
}
console.log('  syn_select, auto-started: correct→green+selected, wrong→red+selected, a tap clears both, never auto-checks: OK');

// ── 8. Manual tap (_speechMicPillClick) works the same way as auto-start, and does nothing when inert ──
{
  const C = client();   // unsupported: no SpeechRecognition
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh();   // sets the pill's real disabled state
    _speechMicPillClick();
    ({ calls: window.__micCalls || 0 });`);
  const calls = C.run(`window.__micCalls || 0`);
  assert.strictEqual(calls, 0, 'clicking a disabled/inert pill (no SpeechRecognition) starts nothing');
}
{
  const C = client();
  C.run(mockCtor(['Katzen']));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // establishes the enabled pill; no auto-match yet since alts arrive async
    true;`);
  // Immediately (before the auto pass's own setTimeout(0) fires) simulate a manual tap — exercises
  // the same code path a real early tap would.
  C.run(`_speechMicPillClick(); true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, val: document.getElementById('type-in').value })`);
  assert.strictEqual(r.answered, true, 'a manual tap resolves the SAME way an auto-started pass would');
  assert.strictEqual(r.val, 'Katzen', 'same matching logic, same result');
}
console.log('  manual tap: inert pill does nothing, an active one behaves exactly like auto-start: OK');

// ── 9. A STALE pass from a PREVIOUS question must never act once a NEWER one is on screen ────
// The scenario the generation guard exists for: a recognition pass is in flight for question A when
// the learner advances to question B before it resolves (plausible — a slow/delayed browser result
// racing a fast manual Next, or simply the next render firing while A's mic is still listening). Once
// A's pass finally resolves, it must NOT fill/check B's `#type-in` with A's own matched answer — that
// would silently mark the learner wrong on a question they had not even attempted yet.
{
  const C = client();
  // Step 1 (question A's pass) resolves SLOWLY with A's own matching transcript; step 2 (question
  // B's pass, started before step 1 resolves) hard-errors immediately so it doesn't itself interfere
  // with what this test is isolating.
  C.run(mockCtorSeq([{ alts: ['Katzen'], delay: 60 }, { err: 'not-allowed' }]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // question A: starts listening, will resolve in 60ms with a MATCH for A
    true;`);
  // Before A's pass resolves, "advance" to a DIFFERENT question B — same shape, different answer, so
  // A's transcript is provably wrong for it.
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Hund', correct:'Hunde', source:'dog' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // question B: a fresh generation — A's still-pending pass is now STALE
    true;`);
  await settle(120);   // long enough for A's 60ms-delayed pass to resolve
  const r = C.run(`({ val: document.getElementById('type-in').value, answered: APP.cur.answered, calls: window.__micCalls })`);
  assert.strictEqual(r.calls, 2, 'sanity: both passes actually ran (A slow, B fast-erroring)');
  assert.strictEqual(r.val, '', 'A\'s stale match never touched B\'s #type-in — still empty, not filled with "Katzen"');
  assert.strictEqual(r.answered, false, 'and B was never wrongly marked answered by an answer the learner never gave for IT');
}
console.log('  stale generation: a delayed pass from a PREVIOUS question never acts on the CURRENT one: OK');

console.log('unit-speech-recognition: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
