// unit-inflection-speak-lang.test.js
// v82_d (user report) — inflection_form's answer is a grammatical-form LABEL in the SOURCE
// language (e.g. Italian "nominativo plurale" for a German lesson), unlike every other exercise
// type's reveal text, which is genuinely target-language. `check()`'s speakOk/speakBad fell through
// to their generic default — `stripFuri(ex.target)` spoken with the TARGET voice — which is correct
// for inflection_lemma (its target IS the target-language lemma) but audibly wrong for
// inflection_form. Fixed via `speakOkLang`/`speakBadLang` + `_speakAndAdvance`'s new `langCode`
// param (see unit-speak-advance.test.js for that primitive's own coverage).
//
// This file drives the DOM-facing `check()` itself, through a REAL inflections lesson built by the
// production `buildExercises`/`buildInflectionsExercises` path — assertions on the primitive alone
// would prove nothing about whether check() actually calls it with the right language (v71_u rule).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// One inflections lesson, two items — enough for both inflection_lemma and inflection_form
// exercises to exist after buildInflectionsExercises' shuffle.
const TOPIC = {
  id: 'tp_x', topic: 'T', lang: 'de', srcLang: 'it', difficulty: 1,
  story: 'Die Köpfe der Männer waren müde. Der Kopf tat ihm weh.',
  lessons: [
    { id: 'l_infl', type: 'inflections', title: 'Inflections',
      items: [
        { sentence: 'Die Köpfe der Männer waren müde.', surfaceForm: 'Köpfe', lemma: 'der Kopf',
          lemmaChoices: ['der Kopf', 'die Hand', 'das Bein'], lemmaCorrectIndex: 0,
          formLabel: 'plurale', formChoices: ['plurale', 'singolare', 'genitivo'], formCorrectIndex: 0,
          translation: 'The heads of the men were tired.', explanation: 'Plurale di der Kopf.' },
      ] },
  ],
};

function open() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = [${JSON.stringify(TOPIC)}];
    APP.storylines = [];
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = 'de'; APP.srcLang = 'it';
    show = function(id){ APP._shown = id; };
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    // Fake TTS engine — de-DE and it-IT voices available, so both the (correct) target-voice path
    // and the (fixed) source-voice path can actually resolve a voice and speak.
    // v89_c: it now FIRES onend, the shape unit-speak-advance's own fake already uses and the one a
    // real engine presents. §4 asserts auto-advance after a spoken reveal, and that advance is
    // driven by _speakChunksThen's u.onend callback; an engine that never ends leaves only
    // _speakAndAdvance's START_GRACE_MS watchdog, so the test would have been measuring the
    // wedged-engine safety net instead of the ordinary path.
    // (No backticks in this comment on purpose — it lives INSIDE a template literal, and the
    // harness's own standing trap is that one would terminate it. See INTERNALS on that.)
    __spokeUtt = [];
    _ttsUnlocked = true; APP.muted = false;
    globalThis.speechSynthesis = {
      speaking: false, pending: false,
      getVoices: function(){ return [{ name:'DE', lang:'de-DE', localService:true },
                                      { name:'IT', lang:'it-IT', localService:true }]; },
      cancel: function(){},
      speak: function(u){
        __spokeUtt.push({ text:u.text, lang:u.lang });
        globalThis.speechSynthesis.speaking = true;
        setTimeout(function(){ globalThis.speechSynthesis.speaking = false; if (u.onend) u.onend(); }, 10);
      },
      addEventListener: function(){}, removeEventListener: function(){},
    };
    globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; };
    true;`, 'open');
  return C;
}

function answer(C, wantCorrect) {
  return C.run(`(function(){
    var Cur = APP.cur, ex = Cur.exercises[Cur.cur];
    var btns = [].slice.call(document.querySelectorAll('.choice'));
    var correctBtn = null, wrongBtn = null;
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim() === String(ex.correct)) correctBtn = btns[i];
      else if (!wrongBtn) wrongBtn = btns[i];
    }
    var pick = ${wantCorrect ? 'correctBtn' : 'wrongBtn'};
    if (!pick) return false;
    pickChoice(btns.indexOf(pick), pick);
    if (!APP.cur.answered) check();
    return APP.cur.answered;
  })()`);
}

function findExercise(C, type) {
  return C.run(`(function(){
    for (var i = 0; i < APP.cur.exercises.length; i++) if (APP.cur.exercises[i].type === ${JSON.stringify(type)}) return i;
    return -1;
  })()`);
}
function goTo(C, i) {
  C.run(`APP.cur.cur = ${i}; APP.cur.answered = false; renderEx(); true;`);
}

async function main() {

// ── 1. inflection_form, answered WRONG → the reveal (Italian formLabel) speaks in ITALIAN ──────
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_form');
  assert.ok(i >= 0, 'the round contains an inflection_form exercise');
  goTo(C, i);
  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'drove a wrong answer on the inflection_form exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 1, 'exactly one utterance spoken on a wrong answer');
  assert.strictEqual(spoken[0].lang, 'it-IT',
    `inflection_form's wrong-answer reveal must speak with the SOURCE (Italian) voice — got ${spoken[0] && spoken[0].lang}`);
}
console.log('  inflection_form wrong-answer reveal speaks Italian, not German: OK');

// ── 2. inflection_form, answered CORRECTLY → also Italian (not just the wrong-answer path) ─────
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_form');
  goTo(C, i);
  const droveRight = answer(C, true);
  assert.ok(droveRight, 'drove a correct answer on the inflection_form exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 1, 'exactly one utterance spoken on a correct answer');
  assert.strictEqual(spoken[0].lang, 'it-IT',
    `inflection_form's correct-answer reveal must ALSO speak with the SOURCE voice — got ${spoken[0] && spoken[0].lang}`);
}
console.log('  inflection_form correct-answer reveal speaks Italian too: OK');

// ── 3. inflection_lemma's WRONG-answer reveal speaks the lemma, in the TARGET voice (v89_c) ─────
// ⚠️ RE-SCOPED, not deleted — the third ruling this pair of sections has carried. v82_d asserted
// target-language audio; v86_ae REPLACED that with silence, on the user's own offered fallback
// ("we could also just omit the readout") after an isolated target-language word form came out
// mispronounced on a device whose "matching" voice was unreliable — something _ttsMakeUtterance's
// refuse-rather-than-approximate policy (v55_x) cannot detect, since it only refuses when NO voice
// claims the language at all. v89_c is the user asking for the readout BACK with that trade-off
// already known: "For the lemma-type question, the correct answer (the lemma) is not read-out at
// all. Also read this out, it is always in the target language." So the assertion returns to
// v82_d's shape — and the LANGUAGE is the point of it, not merely that something was spoken.
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_lemma');
  assert.ok(i >= 0, 'the round contains an inflection_lemma exercise');
  goTo(C, i);
  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'drove a wrong answer on the inflection_lemma exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 1,
    `inflection_lemma's WRONG-answer reveal speaks exactly one utterance (got ${JSON.stringify(spoken)})`);
  assert.strictEqual(spoken[0].lang, 'de-DE',
    `and it speaks with the TARGET (German) voice — the lemma is target-language text, unlike ` +
    `inflection_form's label (got ${spoken[0] && spoken[0].lang})`);
  // It speaks the LEMMA, not the learner's wrong pick and not the whole sentence.
  const want = C.run(`(function(){ for (var i=0;i<APP.cur.exercises.length;i++){ var e=APP.cur.exercises[i];
    if (e.type==='inflection_lemma') return String(e.correct); } return null; })()`);
  assert.strictEqual(spoken[0].text, want,
    `and the text spoken is the correct LEMMA itself (expected ${JSON.stringify(want)}, got ${JSON.stringify(spoken[0].text)})`);
}
console.log('  inflection_lemma\'s wrong-answer reveal speaks the lemma in the target voice: OK');

// ── 4. inflection_lemma's correct-answer path speaks it too, and still auto-advances ────────────
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_lemma');
  goTo(C, i);
  const before = C.run(`APP.cur.cur`);
  const droveRight = answer(C, true);
  assert.ok(droveRight, 'drove a correct answer on the inflection_lemma exercise');
  const spokenRight = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spokenRight.length, 1,
    `inflection_lemma's CORRECT-answer reveal ALSO speaks (got ${JSON.stringify(spokenRight)})`);
  assert.strictEqual(spokenRight[0].lang, 'de-DE',
    `and with the TARGET voice on this path too — both paths, per the request (got ${spokenRight[0] && spokenRight[0].lang})`);
  await new Promise(r => setTimeout(r, 600));
  const after = C.run(`APP.cur.cur`);
  assert.ok(after > before, `auto-advance still happens after the speech (before=${before}, after=${after})`);
}
console.log('  inflection_lemma\'s correct-answer path speaks the lemma too, and still auto-advances: OK');

// ── 5. inflection_form still speaks SOURCE-language audio — the two questions genuinely differ ───
// ⚠️ The non-vacuity that makes §3/§4 mean something: one inflections ITEM builds both questions
// from the same sentence, and they must resolve to DIFFERENT voices. v89_c (user ruling, taken
// after the live corpus was measured) keeps the form label a SOURCE-language explanation by design,
// even though nl/de and it/nl chapters carry labels the model wrote in the TARGET language against
// the prompt's own {S} instruction — the lever for that drift is PROMPTS.inflections, hardened at
// the same cut, not this branch.
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_form');
  goTo(C, i);
  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'drove a wrong answer on the inflection_form exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 1, 'inflection_form still speaks exactly one utterance');
  assert.strictEqual(spoken[0].lang, 'it-IT', 'inflection_form still speaks the SOURCE (Italian) voice, exactly as v82_d fixed it');
}
console.log('  inflection_form still speaks the source-language voice, so the two questions of one item genuinely differ: OK');

console.log('unit-inflection-speak-lang: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
