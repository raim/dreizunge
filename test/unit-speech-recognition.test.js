// unit-speech-recognition.test.js
// v84_g — browser-native speech recognition reused for answer checking. MCQ coverage widened at
// v84_h, a missed gap closed and a "heard" field added at v84_i. v84_k replaced every per-exercise
// mic button with one persistent bottom-bar pill (`#speech-mic-pill`) that auto-listens the instant a
// speakable question renders. v84_l — two more direct user requests, from real use: (1) Android plays
// an audible tone on every `SpeechRecognition.start()` that JS cannot suppress, and the v84_k design
// (restart after EVERY phrase/mismatch) meant a beep every few seconds — replaced with ONE
// `continuous:true` session per question (`_speechListenSession`), so the tone plays once per
// question, not once per phrase; (2) the pill's tap now MUTES/unmutes speech input ("active all the
// time, except the microphone icon is pressed to mute input"), replacing its old "retry now" meaning,
// which continuous listening had already made redundant. Contract under test:
//   • `_speechKindFor(ex)` is still the one place that decides speakability — unchanged by this file.
//   • ONE session per question: several phrases (matches, mismatches, silence) are handled WITHOUT a
//     second `.start()` call — verified by counting real mock invocations, not just outcomes.
//   • A 'type'/'mcq' MATCH explicitly stops the session (about to speak the reveal aloud); a 'syn'
//     match does NOT (syn_select never advances on a single word, keep listening for more).
//   • The browser's own natural session end (silence timeout) auto-resumes, unless muted, answered,
//     or the end was a hard error (toasted once, not retried blindly).
//   • The pill: tap toggles `APP.micMuted` — muted stops listening immediately and shows the muted
//     state; unmuting resumes for whatever's currently on screen. Muted survives a render (navigating
//     between speakable questions while muted does NOT auto-resume).
//   • The stale-generation guard (v84_k's own mutation-tested fix) still holds under continuous
//     sessions: a phrase arriving after the question changed never touches the new question's DOM.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.lessonData = { id:'t1', lang:'de', srcLang:'en' };
    APP.lang='de'; APP.srcLang='en'; APP.muted = true; APP.micMuted = false; APP.noKeyboard = false;
    APP.info = { backend:'none', canGenerate:false };
    renderEx = function(){};   // the eventual _speakAndAdvance timer must not need a real round
    show = function(){}; speak = function(){};
    true;`, 'seed');
  return C;
}

// A mock SpeechRecognition constructor emulating ONE continuous session: `steps` is an ordered list
// where each item is either `{alts,delay?}` (fires onresult with one phrase), `{err,delay?}` (fires
// onerror then onend — the session dies), or the string `'end'` (fires onend with no error — the
// browser's own silence timeout, the ordinary way a continuous session dies without user action).
// `.stop()` ends the session gracefully (fires onend, matching the real API); `.abort()` just cancels
// pending steps without firing onend (matching how the ORIGINAL mock behaved, and how production code
// never actually depends on abort firing anything). `window.__micStarts/__micStops/__micAborts` count
// real calls, so tests can assert on SESSION COUNT, not just outcomes — the whole point of this
// release is fewer sessions (fewer beeps), so a passing assertion has to be able to catch a
// regression back to "restart on every phrase."
// `sessions` is an array of STEP-LISTS — `sessions[N]` scripts the (N+1)th `.start()` call (clamped
// to the last one once exhausted). Most tests only care about a single session's worth of steps;
// `mockSession(steps)` is the shorthand for that (wraps in `[steps]`). Test 9 uses `mockSessions`
// directly, with a SEPARATE (empty) step-list for the second session, so that session's own
// behaviour can never coincidentally produce the same outcome as the first — the isolation the
// stale-generation test needs to actually prove what it claims.
function mockSessions(sessions) {
  return `window.__micStarts = 0; window.__micStops = 0; window.__micAborts = 0;
  window.SpeechRecognition = function(){
    var self = this;
    var stopped = false, timers = [];
    this.start = function(){
      window.__micStarts++;
      stopped = false;
      var allSessions = ${JSON.stringify(sessions)};
      var steps = allSessions[Math.min(window.__micStarts - 1, allSessions.length - 1)] || [];
      steps.forEach(function(step, i){
        var delay = (step && typeof step === 'object' && step.delay != null) ? step.delay : (i * 10);
        timers.push(setTimeout(function(){
          if(stopped) return;
          if(step === 'end'){ stopped = true; if(self.onend) self.onend(); return; }
          if(step.err){ stopped = true; if(self.onerror) self.onerror({error: step.err}); if(self.onend) self.onend(); return; }
          if(self.onresult) self.onresult({ resultIndex: 0, results: [(step.alts||[]).map(function(t){ return {transcript:t}; }) ] });
        }, delay));
      });
    };
    this.stop = function(){ window.__micStops++; if(!stopped){ stopped = true; timers.forEach(clearTimeout); if(self.onend) self.onend(); } };
    this.abort = function(){ window.__micAborts++; if(!stopped){ stopped = true; timers.forEach(clearTimeout); } };
  };`;
}
const mockSession = (steps) => mockSessions([steps]);
const settle = (ms) => new Promise(r => setTimeout(r, ms || 40));

(async () => {

// ── 1. _speechKindFor: unchanged by this release — a light smoke check, not a re-derivation ──
{
  const C = client();
  const kf = (ex) => C.run(`JSON.stringify(_speechKindFor(${JSON.stringify(ex)}))`);
  assert.strictEqual(kf({ type: 'type_plural' }), JSON.stringify({ kind: 'type' }));
  assert.strictEqual(kf({ type: 'mcq_target_source' }), JSON.stringify({ kind: 'mcq', locale: 'source' }));
  assert.strictEqual(kf({ type: 'syn_select' }), JSON.stringify({ kind: 'syn' }));
  assert.strictEqual(kf({ type: 'comprehension_mcq' }), 'null');
}
console.log('  _speechKindFor: unchanged (full exhaustive coverage lives in its own commit history): OK');

// ── 2. Pill states: inert, active, muted — via _speechMicRefresh() ───────────────
{
  const C = client();   // no SpeechRecognition at all
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ disabled: document.getElementById('speech-mic-pill').disabled,
    active: document.getElementById('speech-mic-pill').classList.contains('active') })`);
  assert.strictEqual(r.disabled, true, 'unsupported: disabled regardless of speakability');
  assert.strictEqual(r.active, false);
}
{
  const C = client();
  C.run(mockSession([{ err: 'not-allowed' }]));   // self-terminates; this block only checks sync state
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ disabled: document.getElementById('speech-mic-pill').disabled,
    active: document.getElementById('speech-mic-pill').classList.contains('active'),
    muted: document.getElementById('speech-mic-pill').classList.contains('muted') })`);
  assert.strictEqual(r.disabled, false, 'speakable + supported: enabled');
  assert.strictEqual(r.active, true);
  assert.strictEqual(r.muted, false);
  await settle();
}
{
  const C = client();
  C.run(mockSession([{ err: 'not-allowed' }]));
  C.run(`APP.micMuted = true;
    APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ active: document.getElementById('speech-mic-pill').classList.contains('active'),
    muted: document.getElementById('speech-mic-pill').classList.contains('muted'), starts: window.__micStarts })`);
  assert.strictEqual(r.muted, true, 'muted overrides speakability in the pill\'s own visual state');
  assert.strictEqual(r.active, false);
  assert.strictEqual(r.starts, 0, 'and, critically, NOTHING actually starts listening while muted');
}
console.log('  pill state: inert unless supported+speakable, muted overrides active, muted never starts a session: OK');

// ── 2b. The pill's inline `style=""` must never re-set background/border/opacity — SOURCE-level,
//        because lib-dom (this whole file's harness) does not implement real CSS cascade/specificity,
//        so it is the one claim here that literally cannot be observed by rendering and reading a
//        computed style the way every other assertion in this file is. Found by actually loading the
//        page in a real browser and reading its COMPUTED style: an inline `background`/`border`/
//        `opacity` always beats a stylesheet rule regardless of selector specificity, which had
//        silently made `.active`/`.listening`/`.muted`'s colour/opacity changes complete no-ops —
//        the dots-vs-icon swap "worked" only because `display` was never fought over inline.
{
  const btnAt = html.indexOf('id="speech-mic-pill"');
  assert.ok(btnAt >= 0, '#speech-mic-pill exists');
  const tagEnd = html.indexOf('>', btnAt);
  const openTag = html.slice(Math.max(0, btnAt - 40), tagEnd);
  const styleAttr = /style="([^"]*)"/.exec(openTag);
  assert.ok(styleAttr, '#speech-mic-pill has an inline style attribute');
  for (const prop of ['background:', 'border:', 'opacity:']) {
    assert.ok(!styleAttr[1].includes(prop),
      `the inline style must NOT set ${prop} — it would silently beat every .active/.listening/.muted rule below`);
  }
  // …and something must still set the INERT default (a base #speech-mic-pill{} rule, not the removed inline one).
  const baseRule = /#speech-mic-pill\{[^}]*background:[^}]*border:[^}]*opacity:/.exec(html)
    || /#speech-mic-pill\{[^}]*opacity:[^}]*border:[^}]*background:/.exec(html);
  assert.ok(baseRule, 'a base #speech-mic-pill{} stylesheet rule sets the default background/border/opacity');
  // The state rules must be compound (#speech-mic-pill.active, not bare .active) — a bare-class rule
  // has LOWER specificity than the base bare-ID rule above and would lose to it, the exact shape of
  // bug this test exists to catch (just one level removed — inline vs. ID this time, ID vs. class here).
  for (const cls of ['active', 'listening', 'muted']) {
    assert.ok(new RegExp('#speech-mic-pill\\.' + cls + '\\{').test(html),
      `.${cls} must be written as the compound selector #speech-mic-pill.${cls}, not a bare .${cls}`);
  }
}
console.log('  pill CSS: state colours are NOT shadowed by an inline style, and out-specificity the base rule: OK');

// ── 3. ONE session, several phrases: no restart between a mismatch and the eventual match ──
{
  const C = client();
  C.run(mockSession([{ alts: ['Hunde'] }, { alts: ['Maus'] }, { alts: ['Katzen'] }]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();
    true;`);
  await settle(80);
  const r = C.run(`({ starts: window.__micStarts, stops: window.__micStops, answered: APP.cur.answered,
    val: document.getElementById('type-in').value })`);
  assert.strictEqual(r.starts, 1, 'THREE phrases (two mismatches, one match) handled by exactly ONE session — this is the whole point of the release');
  assert.strictEqual(r.answered, true, 'the third phrase matched and answered the question');
  assert.strictEqual(r.val, 'Katzen');
  assert.strictEqual(r.stops, 1, 'the session was explicitly stopped once the match landed (about to speak the reveal aloud)');
}
console.log('  one continuous session handles several phrases with zero restarts, until a match stops it: OK');

// ── 4. syn_select: a match does NOT stop the session — still listening for more words ──
{
  const C = client();
  C.run(mockSession([{ alts: ['rasch'] }, { alts: ['flott'] }]));
  C.run(`APP.cur = { exercises: [{ type:'syn_select', mode:'synonyms', base:'schnell',
      correct:['rasch','flott'], choices:['rasch','flott','langsam','müde'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['rasch','flott','langsam','müde'].forEach(function(w,i){
      var b = document.getElementById('st'+i); b.textContent = w; b.dataset.w = w; b.classList.add('syn-tile');
    });
    document.getElementById('cbtn').disabled = true;
    _speechMicRefresh();
    true;`);
  await settle(80);
  const r = C.run(`({ starts: window.__micStarts, stops: window.__micStops,
    ok0: document.getElementById('st0').classList.contains('ok'),
    ok1: document.getElementById('st1').classList.contains('ok'), answered: APP.cur.answered })`);
  assert.strictEqual(r.starts, 1, 'still one session for both words');
  assert.strictEqual(r.stops, 0, 'a syn_select match never stops the session — more words may follow');
  assert.strictEqual(r.ok0, true, 'first correct word selected+greened');
  assert.strictEqual(r.ok1, true, 'second correct word ALSO selected+greened, same session');
  assert.strictEqual(r.answered, false, 'still never auto-checks/advances');
}
console.log('  syn_select: a match keeps the SAME session listening for more words, never stops it: OK');

// ── 5. The browser\'s own silence timeout ends the session — auto-resumes with a SECOND start ──
{
  const C = client();
  // Session 1 dies immediately with a plain (no-error) 'end' — the natural timeout. Session 2 (the
  // resumed one) matches. Deliberately TWO SEPARATE sessions, not one script that repeats itself —
  // a single repeating ['end', {alts:...}] script would have session 2 ALSO immediately fire its own
  // 'end' step, triggering a third resume, a fourth, … a runaway restart loop indistinguishable from
  // the very regression this test exists to catch.
  C.run(mockSessions([['end'], [{ alts: ['Katzen'] }]]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();
    true;`);
  await settle(100);
  const r = C.run(`({ starts: window.__micStarts, answered: APP.cur.answered })`);
  assert.strictEqual(r.starts, 2, 'a soft/natural session end DOES get a fresh session — this is still "always listening"');
  assert.strictEqual(r.answered, true, 'and the resumed session went on to match');
}
console.log('  a natural (non-error) session end auto-resumes with a fresh session: OK');

// ── 6. A hard error stops for good — no restart, toasted once ────────────────────
{
  const C = client();
  C.run(mockSession([{ err: 'not-allowed' }]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('toast').textContent = '';
    _speechMicRefresh();
    true;`);
  await settle(80);
  const r = C.run(`({ starts: window.__micStarts, toast: document.getElementById('toast').textContent })`);
  assert.strictEqual(r.starts, 1, 'a hard error never gets a second session');
  assert.strictEqual(r.toast, UI.en['ex.mic_error']);
}
console.log('  a hard error stops for good, toasted once, no restart loop: OK');

// ── 7. Mute: stops the session immediately; unmute resumes it ────────────────────
{
  const C = client();
  C.run(mockSession(['end']));   // never resolves a phrase on its own — isolates the mute/unmute effect
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const before = C.run(`window.__micStarts`);
  assert.strictEqual(before, 1, 'sanity: listening after the initial render');
  const mid = C.run(`_speechMicPillClick();
    ({ stops: window.__micStops, muted: document.getElementById('speech-mic-pill').classList.contains('muted'),
       active: document.getElementById('speech-mic-pill').classList.contains('active') })`);
  assert.strictEqual(mid.stops, 1, 'tapping the pill stops the running session immediately');
  assert.strictEqual(mid.muted, true, 'and the pill shows muted');
  assert.strictEqual(mid.active, false);
  const after = C.run(`_speechMicPillClick();
    ({ starts: window.__micStarts, muted: document.getElementById('speech-mic-pill').classList.contains('muted'),
       active: document.getElementById('speech-mic-pill').classList.contains('active') })`);
  assert.strictEqual(after.starts, 2, 'tapping again resumes — a fresh session starts');
  assert.strictEqual(after.muted, false);
  assert.strictEqual(after.active, true);
  // Clean up: the resumed session's own 'end' step is still pending (its 0ms timer hasn't fired
  // within this synchronous block) and, left alone, would auto-resume forever once it does — the
  // SAME orphaned-background-loop hazard v84_k's own tests already had to learn about, just via the
  // mute path instead of a never-matching mock. Muting again clears that pending timer for good.
  C.run(`APP.micMuted = true; _speechMicRefresh(); true;`);
}
console.log('  mute/unmute: a tap stops listening immediately, a second tap resumes it: OK');

// ── 8. Muted survives a render — navigating between speakable questions while muted stays muted ──
{
  const C = client();
  C.run(mockSession(['end']));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Katzen' }], cur:0, answered:false };
    _speechMicRefresh();
    APP.micMuted = true; _speechMicRefresh();   // mute, mid-round
    true;`);
  const starts1 = C.run(`window.__micStarts`);
  // Simulate advancing to a DIFFERENT (still speakable) question — same as a real renderEx() call.
  C.run(`APP.cur = { exercises: [{ type:'type_plural', correct:'Hunde' }], cur:0, answered:false };
    _speechMicRefresh(); true;`);
  const r = C.run(`({ starts: window.__micStarts, muted: document.getElementById('speech-mic-pill').classList.contains('muted') })`);
  assert.strictEqual(r.starts, starts1, 'no new session starts for the new question — mute is a standing preference, not per-question');
  assert.strictEqual(r.muted, true, 'the pill still shows muted on the new question');
}
console.log('  muted is a standing preference — surviving a render/navigation to another speakable question: OK');

// ── 9. Stale generation: a phrase arriving after the question changed must never act ──
{
  const C = client();
  // Session 1 (question A): resolves SLOWLY with A's own matching transcript. Session 2 (question B,
  // started before session 1 resolves): deliberately EMPTY — no steps of its own at all — so any
  // observed effect on B's DOM can only have come from A's stale, superseded pass, never from a
  // coincidental match/mismatch B's own (freshly-started) session might otherwise have produced.
  C.run(mockSessions([[{ alts: ['Katzen'], delay: 60 }], []]));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // question A
    true;`);
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Hund', correct:'Hunde' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _speechMicRefresh();   // question B — A's own session is stopped, but its pending phrase timer still fires later`);
  await settle(120);
  const r = C.run(`({ val: document.getElementById('type-in').value, answered: APP.cur.answered })`);
  assert.strictEqual(r.val, '', 'A\'s stale "Katzen" phrase never touched B\'s #type-in');
  assert.strictEqual(r.answered, false, 'B was never wrongly marked answered by an answer the learner never gave for IT');
}
console.log('  stale generation: a delayed phrase from a PREVIOUS question never acts on the CURRENT one: OK');

console.log('unit-speech-recognition: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
