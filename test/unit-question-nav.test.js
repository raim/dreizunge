// unit-question-nav.test.js
// v80_p — §0h: back/next on the QUESTION cards.
//
// §0h, verbatim: "Already-made choices are shown (right or wrong) and cannot be reverted, but the
// lock lasts only for that question set: replaying via the progress card makes them playable again."
//
// The obstacle was one line in `renderEx`: `C.answered=false; C.sel=null; C.placed=[]; ...` ran
// unconditionally, so a question revisited came back blank and playable. The fix is a per-RUN answer
// ledger (`C.ans`) plus a `replay` mode on `check()` — the same function that paints a live answer,
// with scoring, hearts, markSolved, speech and auto-advance guarded off. One code path, so a
// replayed question cannot look different from a live one.
//
// This drives a REAL lesson through `startLesson`/`renderEx`/`check` rather than asserting on source
// text, because every claim here is about behaviour.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A chapter with a plain vocab lesson: its exercises are choice-based, which is the shape the
// restore path handles most directly. Swept rather than pinned so a data drop moves the fixture
// instead of breaking the file.
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

function run(topic, lessonIdx) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP.muted = true;
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    show = function(id){ APP._shown = id; };
    speak = function(){ APP._spoke = (APP._spoke||0) + 1; };
    saveProg = function(){};
    showComplete = function(){ APP._completed = true; };
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    startLesson(${lessonIdx}); true;`, 'start');
  return C;
}

let FIX = null;
for (const t of store.topics) {
  const i = (t.lessons || []).findIndex(L => L && !L._hidden && (!L.type || L.type === 'standard') && (L.vocab || []).length >= 3);
  if (i < 0) continue;
  const C = run(t, i);
  const n = C.run(`(APP.cur && APP.cur.exercises || []).length`);
  const kinds = JSON.parse(C.run(`JSON.stringify((APP.cur.exercises||[]).map(function(e){return e.type;}))`));
  // need at least 3 questions and a choice-based first one, so "answer, advance, go back" is real
  if (n >= 3) { FIX = { t, i, C, n, kinds }; break; }
}
assert.ok(FIX, 'the corpus has a vocab lesson with 3+ questions');
console.log(`  fixture: "${FIX.t.topic}" lesson ${FIX.i}, ${FIX.n} questions (${FIX.kinds[0]})`);

// Answer whatever the CURRENT question is. Exercises are SHUFFLED per run, so the type at index 0
// differs between runs — an earlier version of this helper assumed choice buttons and failed
// intermittently, which is a fixture bug that looks exactly like a product bug. It handles the
// answer shapes this fixture can produce and advances past any it cannot, then reports the index it
// actually answered so the sections navigate relative to that rather than to an assumed 0.
function answerCurrent(C, wrong) {
  const idx = C.run(`(function(){
    var guard = 0;
    while (guard++ < 12) {
      var C = APP.cur, ex = C.exercises[C.cur];
      var btns = [].slice.call(document.querySelectorAll('.choice'));
      var ti = document.getElementById('type-in');
      if (btns.length) {
        var pickEl = btns[0];
        for (var i=0;i<btns.length;i++){
          var isCorrect = btns[i].textContent.trim() === String(ex.correct);
          if (${wrong ? '!isCorrect' : 'isCorrect'}) { pickEl = btns[i]; break; }
        }
        pickChoice(btns.indexOf(pickEl), pickEl);
        // some choice types auto-check on tap; asking beats assuming
        if (!APP.cur.answered) check();
        return APP.cur.answered ? (C.cur + ':choice') : '-1';
      }
      if (ti) {
        ti.value = ${wrong ? "'zzz-not-the-answer'" : 'String(ex.correct)'};
        check();
        return APP.cur.answered ? (C.cur + ':typed') : '-1';
      }
      // not a shape this helper drives — move on
      C.cur++; renderEx();
      if (C.cur >= C.exercises.length) return '-1';
    }
    return '-1';
  })()`, 'answer');
  const [n, shape] = String(idx).split(':');
  assert.ok(Number(n) >= 0, 'the helper answered a question (fixture produced a drivable shape)');
  // The SHAPE is returned because the restore assertions differ by it, and the exercise order is
  // shuffled — a section that assumed choice buttons failed on ~1 run in 6 when a typed question
  // came up first. Asserting per shape tests whichever one actually occurred instead of hoping.
  return { idx: Number(n), shape };
}

// ── 1. Back returns to the previous question, showing the answer ──────────
{
  const C = run(FIX.t, FIX.i);
  assert.strictEqual(C.run(`APP.cur.cur`), 0, 'starts at question 0');
  assert.strictEqual(C.run(`document.getElementById('qback').style.display`), 'none',
    'no Back on the first question');
  const { idx: at, shape } = answerCurrent(C, false);
  const chosen = C.run(`APP.cur.sel`);
  const correct = C.run(`APP.cur.correct`);
  assert.strictEqual(C.run(`APP.cur.answered`), true, 'the question is answered');
  C.run(`APP.cur.cur++; renderEx(); true;`, 'advance');
  assert.strictEqual(C.run(`APP.cur.cur`), at + 1, 'moved to the next question');
  assert.strictEqual(C.run(`APP.cur.answered`), false, 'the new question is unanswered');
  C.run(`qPrev(); true;`, 'back');
  assert.strictEqual(C.run(`APP.cur.cur`), at, 'Back returns to the answered question');
  assert.strictEqual(C.run(`APP.cur.answered`), true, 'and it is still ANSWERED, not blank');
  if (shape === 'choice') {
    assert.strictEqual(C.run(`APP.cur.sel`), chosen, 'the learner\'s own choice is restored');
    assert.strictEqual(C.run(`[].slice.call(document.querySelectorAll('.choice.sel')).length`), 1,
      'exactly one choice is shown as selected');
  } else {
    assert.ok(String(C.run(`(document.getElementById('type-in')||{}).value || ''`)).length > 0,
      'the learner\'s typed answer is restored into the input');
  }
  assert.ok(/feedback (ok|bad)/.test(C.run(`document.getElementById('fb').className`)),
    'the verdict is painted, not a blank feedback panel');
  assert.strictEqual(C.run(`APP.cur.correct`), correct, 'and the score did NOT change');
  console.log('  Back shows the answered question, choice and verdict intact');
}

// ── 2. ⚠️ The lock: a revisited question CANNOT be re-answered or re-scored ──
{
  const C = run(FIX.t, FIX.i);
  answerCurrent(C, true);                       // answer it WRONG
  const before = JSON.parse(C.run(`JSON.stringify({c:APP.cur.correct,t:APP.cur.total,m:APP.cur.mistakes,h:APP.cur.hearts})`));
  C.run(`APP.cur.cur++; renderEx(); qPrev(); true;`, 'there and back');
  // Try to change the answer the way a learner would: tap a different choice.
  C.run(`(function(){ var b=[].slice.call(document.querySelectorAll('.choice'));
    var other=b.find(function(x){return !x.classList.contains('sel');});
    if(other) pickChoice(b.indexOf(other), other); })(); true;`, 'try to change');
  const after = JSON.parse(C.run(`JSON.stringify({c:APP.cur.correct,t:APP.cur.total,m:APP.cur.mistakes,h:APP.cur.hearts})`));
  assert.deepStrictEqual(after, before,
    'tapping another choice on an answered question changes nothing — no re-score, no heart');
  console.log('  an answered question cannot be reverted or re-scored');
}

// ── 3. Replaying the SET clears the lock — §0h says so explicitly ─────────
{
  const C = run(FIX.t, FIX.i);
  answerCurrent(C, false);
  assert.ok(C.run(`(APP.cur.ans||[]).length > 0`), 'non-vacuity: the ledger has an entry');
  C.run(`startLesson(${FIX.i}); true;`, 'replay the set');
  assert.strictEqual(C.run(`APP.cur.cur`), 0, 'the run restarts at question 0');
  assert.strictEqual(C.run(`(APP.cur.ans||[]).length`), 0, 'the ledger is EMPTY — the lock was per-run');
  assert.strictEqual(C.run(`APP.cur.answered`), false, 'and question 0 is playable again');
  console.log('  replaying the set makes the questions playable again');
}

// ── 4. A replay does not speak and does not auto-advance ─────────────────
// Both would make Back hostile: the learner would be carried forward the instant they went back,
// and the app would re-read an answer they have already heard.
{
  const C = run(FIX.t, FIX.i);
  const { idx: wAt } = answerCurrent(C, true);   // wrong answers speak, on the live path
  C.run(`APP.cur.cur++; renderEx(); APP._spoke = 0; qPrev(); true;`, 'back');
  assert.strictEqual(C.run(`APP._spoke`), 0, 'navigating back speaks nothing');
  assert.strictEqual(C.run(`APP.cur.cur`), wAt, 'and does not auto-advance away from the question');
  assert.strictEqual(C.run(`document.getElementById('cbtn').disabled`), false,
    'the Continue button is live, so forward still works from here');
  console.log('  back is silent and does not auto-advance');
}

// ── 5. Forward from a revisited question resumes, without double-scoring ──
{
  const C = run(FIX.t, FIX.i);
  const { idx: fAt } = answerCurrent(C, false);
  const scored = C.run(`APP.cur.correct`);
  C.run(`APP.cur.cur++; renderEx(); qPrev(); check(); true;`, 'back then continue');
  assert.strictEqual(C.run(`APP.cur.cur`), fAt + 1, 'Continue moves forward again');
  assert.strictEqual(C.run(`APP.cur.correct`), scored, 'and the question is not scored twice');
  console.log('  forward from a revisited question resumes without double-scoring');
}

// ── 6. _cardErrors is clean throughout ───────────────────────────────────
{
  const C = run(FIX.t, FIX.i);
  answerCurrent(C, false);
  C.run(`APP.cur.cur++; renderEx(); qPrev(); true;`);
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'nothing was swallowed rendering the restored question');
  console.log('  no swallowed errors on the restore path');
}

// ── What this does NOT establish (rule 34) ───────────────────────────────
// • It exercises CHOICE-based questions. The ledger also stores typed input, synonym tiles and
//   placed-order state, and `_restoreAnswer` puts them back through the product's own updaters
//   (`updateSbox` / `updateMathPlaced`) — but no fixture here drives those types, so their restore
//   is UNVERIFIED. A device pass on an ordering and a typed lesson is owed.
// • It says nothing about how Back looks, only what it does.
console.log('unit-question-nav: ALL PASSED');
