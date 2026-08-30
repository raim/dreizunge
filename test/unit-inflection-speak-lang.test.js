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
    __spokeUtt = [];
    _ttsUnlocked = true; APP.muted = false;
    globalThis.speechSynthesis = {
      speaking: false, pending: false,
      getVoices: function(){ return [{ name:'DE', lang:'de-DE', localService:true },
                                      { name:'IT', lang:'it-IT', localService:true }]; },
      cancel: function(){}, speak: function(u){ __spokeUtt.push({ text:u.text, lang:u.lang }); },
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

// ── 3. inflection_lemma's answer-reveal is now SILENT (v86_ae, user report + accepted fallback) ──
// A real user report: an isolated target-language word form spoken with whatever voice claims to
// match that language can sound audibly wrong (a Dutch/German pair, a device with no reliable Dutch
// voice) — a case the app's own "refuse rather than approximate" voice policy (_ttsMakeUtterance,
// v55_x) cannot catch, because it only refuses when NO voice claims to match, not when one claims to
// match but sounds wrong. Substituting a source-language reading was considered and rejected (no
// clean single-word source-language equivalent exists — explanation is a full sentence); per the
// user's own explicit, accepted fallback ("we could also just omit the readout"), inflection_lemma
// now speaks NOTHING on either the correct or the wrong path. This REPLACES this file's own former
// v82_d regression guard, which asserted the OPPOSITE (that inflection_lemma keeps speaking target-
// language audio) — that assertion is exactly what this cut intentionally changes.
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_lemma');
  assert.ok(i >= 0, 'the round contains an inflection_lemma exercise');
  goTo(C, i);
  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'drove a wrong answer on the inflection_lemma exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 0,
    `inflection_lemma's WRONG-answer reveal speaks NOTHING now (got ${JSON.stringify(spoken)})`);
}
console.log('  inflection_lemma\'s wrong-answer reveal is now silent, not a mispronounced target-language word: OK');

// ── 4. inflection_lemma's correct-answer path is ALSO silent, but still auto-advances ───────────
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_lemma');
  goTo(C, i);
  const before = C.run(`APP.cur.cur`);
  const droveRight = answer(C, true);
  assert.ok(droveRight, 'drove a correct answer on the inflection_lemma exercise');
  const spokenRight = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spokenRight.length, 0,
    `inflection_lemma's CORRECT-answer reveal ALSO speaks nothing (got ${JSON.stringify(spokenRight)})`);
  await new Promise(r => setTimeout(r, 500));
  const after = C.run(`APP.cur.cur`);
  assert.ok(after > before, `auto-advance still happens even with no speech (before=${before}, after=${after})`);
}
console.log('  inflection_lemma\'s correct-answer path is silent too, but auto-advance still happens (no speech to wait for): OK');

// ── 5. inflection_form is completely UNCHANGED by this cut — still speaks source-language audio ──
// Non-vacuity/regression guard: the v86_ae omission must be scoped to inflection_lemma specifically.
{
  const C = open();
  C.run(`startLesson(0); true;`, 'start');
  const i = findExercise(C, 'inflection_form');
  goTo(C, i);
  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'drove a wrong answer on the inflection_form exercise');
  const spoken = JSON.parse(C.run(`JSON.stringify(__spokeUtt)`));
  assert.strictEqual(spoken.length, 1, 'inflection_form still speaks exactly one utterance — unaffected by the v86_ae change');
  assert.strictEqual(spoken[0].lang, 'it-IT', 'inflection_form still speaks the SOURCE (Italian) voice, exactly as v82_d fixed it');
}
console.log('  inflection_form is completely unaffected by v86_ae — still speaks the source-language voice: OK');

console.log('unit-inflection-speak-lang: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
