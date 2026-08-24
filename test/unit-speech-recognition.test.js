// unit-speech-recognition.test.js
// v84_g — browser-native speech recognition reused for answer checking (user request, following up
// on the discussion-only "recording a spoken reply" note in roadmap_v83.md). MCQ coverage widened at
// v84_h (direct follow-up: "please allow microphone... also for MCQ question, where the recognized
// word is not shown, but once the correct word is recognized the button turns green as if clicked")
// — cGrid's `speakable` flag became 'target'|'source' so recognition can LISTEN in whichever
// language a given MCQ's choices are actually written in, instead of only ever the target locale.
// Contract under test:
//   • Feature-detected: no mic button anywhere without window.SpeechRecognition/webkitSpeechRecognition.
//   • Typed-answer exercises (listen_type/type_plural/type_conjugation) get a mic button that fills
//     the input with recognized speech; a match against ex.correct checks it immediately (green,
//     advance); a non-match fills the input with what was HEARD but never auto-submits.
//   • MCQ types get a mic button wherever cGrid's `speakable` kind is threaded through: 'target' for
//     mcq_article/mcq_plural/mcq_conjugation, 'source' for mcq_target_source/listen_mcq (confirmed by
//     reading the exercise builders, not guessed from type names) — but NOT comprehension_mcq (full
//     reasoning sentences, a poor speech-match target) or the script-primer glyph/chip intro items
//     (a learner cannot usefully SPEAK a bare glyph). A match taps the CORRECT choice via the real
//     pickChoice path, with the transcript never shown; anything else changes nothing.
//   • A genuine recognition ERROR is toasted once; a plain non-match toast never overwrites it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function extFn(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name} in index.html`);
  const b = html.indexOf('{', at);
  let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.lessonData = { id:'t1', lang:'de', srcLang:'en' };
    APP.lang='de'; APP.srcLang='en'; APP.muted = true;
    APP.info = { backend:'none', canGenerate:false };
    renderEx = function(){};   // the eventual _speakAndAdvance timer must not need a real round
    show = function(){}; speak = function(){};
    true;`, 'seed');
  return C;
}

// A mock SpeechRecognition constructor, injected as source. Fires onresult (with `transcript`, or
// several `alts`) XOR onerror on a real setTimeout(0) — same event-loop tick shape a real
// implementation uses — then always fires onend, matching `_speechRecognizeOnce`'s own contract.
function mockCtor(alts, errCode) {
  const resultsLit = JSON.stringify((alts || []).map(t => ({ transcript: t })));
  return `window.SpeechRecognition = function(){
    var self = this;
    this.start = function(){
      setTimeout(function(){
        ${errCode
          ? `if(self.onerror) self.onerror({error:${JSON.stringify(errCode)}});`
          : `if(self.onresult) self.onresult({results:[${resultsLit}]});`}
        if(self.onend) self.onend();
      }, 0);
    };
    this.abort = function(){};
  };`;
}
const settle = () => new Promise(r => setTimeout(r, 20));   // lets the mock's setTimeout(0) fire

(async () => {

// ── 1. Feature detection ──────────────────────────────────────────────────────
{
  const C = client();
  const html2 = C.run(`_typeMicBtnHtml() + '|' + _mcqMicBtnHtml('target')`);
  assert.strictEqual(html2, '|', 'no SpeechRecognition global → neither builder renders a button');
}
{
  const C = client();
  C.run(mockCtor(['x']));
  const html2 = C.run(`_typeMicBtnHtml() + '|' + _mcqMicBtnHtml('source')`);
  assert.ok(/onclick="_typeSpeechStart\(this\)"/.test(html2), 'type-in mic button wired to _typeSpeechStart');
  assert.ok(/onclick="_mcqSpeechStart\(this, &quot;source&quot;\)"/.test(html2) || /onclick="_mcqSpeechStart\(this, "source"\)"/.test(html2),
    'MCQ mic button wired to _mcqSpeechStart with the kind it was built for');
  assert.ok(/class="mic-btn"/.test(html2) || /class="mic-btn mcq-mic"/.test(html2), 'buttons carry the mic-btn class');
}
console.log('  feature detection: no button unsupported, wired button when supported: OK');

// ── 2. MCQ scoping: speakable kind matches each caller's ACTUAL choice language ──
{
  // 'target': mcq_article/mcq_plural/mcq_conjugation (choices are target-language grammar forms).
  const article = extFn('tMcqArticle'), plural = extFn('tMcqPlural'), conj = extFn('tMcqConjugation');
  for (const [name, body] of [['tMcqArticle', article], ['tMcqPlural', plural], ['tMcqConjugation', conj]]) {
    assert.ok(/cGrid\(ex\.choices,\s*false,\s*null,\s*'target'\)/.test(body), `${name} passes speakable:'target' to cGrid`);
  }
  // 'source': mcq_target_source (tMcqIE) and listen_mcq (tLMcq)'s two NON-intro branches — both
  // builders (mkMcqIE/mkLMcq) put v.source into `choices`, confirmed by reading them, not the type
  // name (mcq_target_source's own choices are source-language despite "target" in the type name).
  const ie = extFn('tMcqIE'), lmcq = extFn('tLMcq');
  assert.ok(/cGrid\(ex\.choices,\s*false,\s*null,\s*'source'\)/.test(ie), 'tMcqIE (mcq_target_source) passes speakable:\'source\'');
  assert.strictEqual((lmcq.match(/cGrid\(ex\.choices,\s*false,\s*null,\s*'source'\)/g) || []).length, 2,
    'tLMcq passes speakable:\'source\' on BOTH its non-intro branches (muted fallback + normal)');
  // Never speakable at all: comprehension (full reasoning sentences) and tLMcq's OWN intro/glyph
  // branch (raw script glyphs — a learner cannot usefully SPEAK a bare character). The 4th-argument
  // anchor matters here too — `cGrid(ex.choices, true)` elsewhere is the unrelated `one` (one-col)
  // parameter, not `speakable`.
  const comp = extFn('tComprehension');
  assert.ok(!/cGrid\([^,]+,[^,]+,[^,]+,\s*'(target|source)'\)/.test(comp), 'tComprehension never gets a mic button');
  const introBlock = lmcq.slice(lmcq.indexOf('if(ex._intro)'), lmcq.indexOf('// When globally muted'));
  assert.ok(!/cGrid\([^,]+,[^,]+,[^,]+,\s*'(target|source)'\)/.test(introBlock),
    'tLMcq\'s own _intro (glyph-picking) branch never gets a mic button');
}
console.log('  MCQ scoping: speakable kind matches each caller\'s real choice language, glyph/prose types excluded: OK');

// ── 3. Typed answer: a MATCH fills the canonical answer, checks it, turns it green ──
{
  const C = client();
  C.run(mockCtor(['Katzen']));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _typeSpeechStart(document.getElementById('type-mic-btn'));
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, val: document.getElementById('type-in').value,
    ok: document.getElementById('type-in').classList.contains('ok'),
    correct: APP.cur.correct, listening: document.getElementById('type-mic-btn').classList.contains('listening') })`);
  assert.strictEqual(r.answered, true, 'a matching transcript answers the question');
  assert.strictEqual(r.val, 'Katzen', 'the input is filled with the CANONICAL answer, not the raw transcript');
  assert.strictEqual(r.ok, true, 'the input turns green, same as a correct typed answer');
  assert.strictEqual(r.correct, 1, 'scored as correct');
  assert.strictEqual(r.listening, false, 'the listening indicator clears once recognition ends');
}
console.log('  typed answer: matching speech checks and turns the input green: OK');

// ── 4. Typed answer: a MISMATCH fills what was heard but never auto-submits ──────
{
  const C = client();
  C.run(mockCtor(['Hunde']));   // a real word, just the wrong one
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen', source:'cat' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('type-in').value = '';
    _typeSpeechStart(document.getElementById('type-mic-btn'));
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, val: document.getElementById('type-in').value,
    toast: document.getElementById('toast').textContent })`);
  assert.strictEqual(r.answered, false, 'a mismatched transcript never auto-submits — no heart spent on a misheard word');
  assert.strictEqual(r.val, 'Hunde', 'the input shows what was actually heard, so the learner can see/correct it');
  assert.strictEqual(r.toast, UI.en['ex.mic_no_match'], 'a "didn\'t catch that" toast explains why nothing happened');
}
console.log('  typed answer: a mismatch fills what was heard, never auto-submits: OK');

// ── 5. MCQ (target locale): recognized speech matching the CORRECT choice taps it ──
{
  const C = client();
  C.run(mockCtor(['Katzen']));
  C.run(`APP.cur = { exercises: [{ type:'mcq_plural', target:'Katze', correct:'Katzen',
      choices:['Katzen','Katze','Katzes','Katzens'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['Katzen','Katze','Katzes','Katzens'].forEach(function(w,i){
      var b = document.getElementById('c'+i); b.textContent = w; b.classList.add('choice');
    });
    _mcqSpeechStart(document.getElementById('mcq-mic-btn'), 'target');
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, sel: APP.cur.sel,
    ok0: document.getElementById('c0').classList.contains('ok'),
    sel0: document.getElementById('c0').classList.contains('sel'),
    log: document.getElementById('toast').textContent })`);
  assert.strictEqual(r.answered, true, 'a matching transcript answers via the real pickChoice/check path');
  assert.strictEqual(r.sel, 'Katzen', 'the CORRECT choice was the one tapped');
  assert.strictEqual(r.sel0, true, 'choice 0 (the correct one) is marked selected');
  assert.strictEqual(r.ok0, true, 'and turns green, same as a real tap');
  assert.strictEqual(r.log, '', 'the recognized transcript is never shown anywhere — unlike the typed-answer path');
}
console.log('  MCQ (target): speech matching the correct choice taps it via pickChoice, turns green, transcript hidden: OK');

// ── 6. MCQ (target locale): speech that does not match the correct choice changes nothing ──
{
  const C = client();
  C.run(mockCtor(['Katze']));   // says a WRONG choice, not the correct one
  C.run(`APP.cur = { exercises: [{ type:'mcq_plural', target:'Katze', correct:'Katzen',
      choices:['Katzen','Katze','Katzes','Katzens'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['Katzen','Katze','Katzes','Katzens'].forEach(function(w,i){
      var b = document.getElementById('c'+i); b.textContent = w; b.classList.add('choice');
    });
    _mcqSpeechStart(document.getElementById('mcq-mic-btn'), 'target');
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, hearts: APP.cur.hearts,
    toast: document.getElementById('toast').textContent })`);
  assert.strictEqual(r.answered, false, 'saying a WRONG choice never marks the question answered');
  assert.strictEqual(r.hearts, 3, 'no heart is spent on an answer the learner never actually tapped');
  assert.strictEqual(r.toast, UI.en['ex.mic_no_match'], 'toasted the same way as the typed-answer mismatch');
}
console.log('  MCQ (target): speech matching a WRONG choice is a no-op, not an auto-selected mistake: OK');

// ── 6b. MCQ (source locale, v84_h): a mcq_target_source-shaped question, matched in the SOURCE
//        language — the whole point of the widened coverage: choices here are English, not German.
{
  const C = client();
  C.run(mockCtor(['cat']));   // the SOURCE-language word, not the target-language one
  C.run(`APP.cur = { exercises: [{ type:'mcq_target_source', target:'Katze', correct:'cat',
      choices:['cat','dog','house','tree'] }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    ['cat','dog','house','tree'].forEach(function(w,i){
      var b = document.getElementById('c'+i); b.textContent = w; b.classList.add('choice');
    });
    _mcqSpeechStart(document.getElementById('mcq-mic-btn'), 'source');
    true;`);
  await settle();
  const r = C.run(`({ answered: APP.cur.answered, sel: APP.cur.sel, ok0: document.getElementById('c0').classList.contains('ok') })`);
  assert.strictEqual(r.answered, true, 'a source-language transcript answers a source-choice MCQ via the same path');
  assert.strictEqual(r.sel, 'cat', 'the correct SOURCE-language choice was tapped');
  assert.strictEqual(r.ok0, true, 'and turns green');
}
console.log('  MCQ (source): a source-language transcript matches a source-choice MCQ, listening in the RIGHT language: OK');

// ── 6c. _speechExLocale: 'target' and 'source' resolve to genuinely different locales ────
{
  const C = client();   // lang:'de', srcLang:'en' — LANGS carries real, distinct tts codes for both
  const r = C.run(`({ target: _speechExLocale('target'), source: _speechExLocale('source') })`);
  assert.ok(r.target && r.source, 'both kinds resolve to a real locale, neither is empty');
  assert.notStrictEqual(r.target, r.source, "'target' and 'source' listen in different languages for a de/en lesson");
}
console.log('  _speechExLocale: target vs source resolve to different locales: OK');

// ── 7. A genuine error toasts once; a later non-match callback does not overwrite it ──
{
  const C = client();
  C.run(mockCtor(null, 'not-allowed'));
  C.run(`APP.cur = { exercises: [{ type:'type_plural', target:'Katze', correct:'Katzen' }],
    cur:0, answered:false, hearts:3, correct:0, total:0, streak:0, bestStreak:0, ans:[] };
    document.getElementById('toast').textContent = '';
    _typeSpeechStart(document.getElementById('type-mic-btn'));
    true;`);
  await settle();
  const r = C.run(`({ toast: document.getElementById('toast').textContent, answered: APP.cur.answered })`);
  assert.strictEqual(r.toast, UI.en['ex.mic_error'], 'a real recognition error shows the permissions message, not the generic no-match one');
  assert.strictEqual(r.answered, false, 'an error never answers the question');
}
console.log('  errors: a genuine recognition error is toasted once, distinctly from a plain non-match: OK');

console.log('unit-speech-recognition: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
