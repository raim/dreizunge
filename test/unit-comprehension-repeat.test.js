// unit-comprehension-repeat.test.js
// v77_t — roadmap §0g, the comprehension flow after a wrong answer.
//
// Reported shape: a wrong answer returns the learner to the card; Next then moved on to whatever
// lesson came next (often an earlier normal one), and Replay replayed the normal lessons — so the
// questions they had just got wrong sank out of reach, and the only route back re-asked everything
// they had already answered correctly.
//
// Two halves, both asserted against the real builders and the real card:
//   1. A REPEATED comprehension lesson asks ONLY the questions not yet answered correctly.
//   2. Next restarts THAT lesson while any of its questions remain unanswered.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A chapter with a comprehension lesson of at least three questions, so "all but one" is a real
// distinction rather than a coin flip.
const compIdxOf = t => (t.lessons || []).findIndex(
  L => L && L.type === 'comprehension' && (L.questions || []).length >= 3);
const TOPIC = store.topics.find(t => (t.story || '').length > 100 && compIdxOf(t) >= 0);
assert.ok(TOPIC, 'the corpus has a chapter with a 3+ question comprehension lesson');
const CI = compIdxOf(TOPIC);

function seed() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP.cur = { lessonIdx: ${CI}, exercises: [], cur: 0 };
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    loadSaved = function(x){ APP._left = String(x); };
    saveProg = function(){};
    true;`, 'setup');
  return C;
}

// ── 1. A first play asks EVERYTHING ────────────────────────────────────────
// Non-vacuity floor for §2: the filter must not be trimming a round that was already short.
{
  const C = seed();
  const first = C.run(`buildExercises(${CI}).length`);
  const authored = (TOPIC.lessons[CI].questions || []).length;
  assert.strictEqual(first, authored,
    `a first play asks every authored question (${first} of ${authored})`);
  console.log(`  first play: all ${first} questions`);
}

// ── 2. A REPEAT asks only what is not yet answered correctly ───────────────
{
  const C = seed();
  const all = C.run(`buildExercises(${CI}).length`);
  // Answer all but one correctly, through the real solve path.
  C.run(`(function(){ var exs = buildExercises(${CI});
    exs.slice(0, exs.length - 1).forEach(function(e){ markSolved(e); }); })(); true;`, 'solve');
  const repeat = C.run(`buildExercises(${CI}).length`);
  assert.strictEqual(repeat, 1,
    `the repeat asks only the unanswered question (got ${repeat} of ${all})`);
  // And it is genuinely the unsolved one, not just "a" question.
  const unsolved = C.run(`(function(){
    var s = _solvedMap(APP.lessonData.topic) || {};
    var exs = buildExercises(${CI});
    return exs.every(function(e){ var id = qid(e, APP.lessonData.lessons[${CI}].id);
      return !id || !s[id]; }); })()`);
  assert.strictEqual(unsolved, true, 'and every question it asks is one still unsolved');
  console.log(`  repeat: ${repeat} of ${all} — only what is left`);
}

// ── 3. The round never empties into a dead end ─────────────────────────────
// If every question is solved the lesson is finished and the caller should not be here, but an
// empty round would be a blank screen rather than a message.
{
  const C = seed();
  C.run(`(function(){ buildExercises(${CI}).forEach(function(e){ markSolved(e); }); })(); true;`, 'all');
  assert.ok(C.run(`buildExercises(${CI}).length`) > 0,
    'with everything solved the round falls back to the full set rather than emptying');
  console.log('  fully solved: the round never empties');
}

// ── 4. Next restarts THAT lesson while questions remain ────────────────────
// Asserted by clicking the real card. This is the half the user felt: forward has to mean "finish
// what you just got wrong", not "move along to something else".
{
  const C = seed();
  C.run(`(function(){ var exs = buildExercises(${CI});
    exs.slice(0, exs.length - 1).forEach(function(e){ markSolved(e); }); })(); true;`, 'solve');
  C.run(`APP.cur = { lessonIdx: ${CI}, correct:2, total:3, mistakes:1, hearts:3, streak:0,
                     bestStreak:2, exercises: [], cur: 0 };
         APP._started = null; showComplete(); true;`, 'card');
  // Non-vacuity: an EARLIER lesson is also unfinished, so "restart this one" is a real choice and
  // not the only thing on offer.
  const other = C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);
  assert.ok(other >= 0 && other !== CI,
    `another unfinished lesson exists (${other}), so the preference is observable`);
  assert.strictEqual(C.run(`!!document.getElementById('comp-next').disabled`), false,
    'Next is live (v77_o)');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._started`), CI,
    `Next restarts the comprehension lesson (${CI}), not the other unfinished one (${other})`);
  console.log(`  Next restarts the comprehension lesson ${CI}, not lesson ${other}`);
}

// ── 5. Once every question is answered, Next moves ON ──────────────────────
// The override must not trap the learner in a lesson they have finished.
{
  const C = seed();
  C.run(`(function(){ buildExercises(${CI}).forEach(function(e){ markSolved(e); }); })(); true;`, 'all');
  C.run(`APP.cur = { lessonIdx: ${CI}, correct:3, total:3, mistakes:0, hearts:3, streak:3,
                     bestStreak:3, exercises: [], cur: 0 };
         APP._started = null; showComplete(); true;`, 'card');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.notStrictEqual(C.run(`APP._started`), CI,
    'with every question answered, Next leaves the comprehension lesson');
  console.log('  all answered: Next moves on');
}

console.log('unit-comprehension-repeat: ALL PASSED');
