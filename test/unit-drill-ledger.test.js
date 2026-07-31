// unit-drill-ledger.test.js
// v71_n — the learned ledger must record PLAYS, and a drill must be one of them.
//
// Reported: "I had 'studiare wrong once' and keep being asked for it, including by the tutor."
// The learner's own learners.json showed why — the it|de ledger held exactly ONE entry with
// wrong > 0 (`studiare {seen:1, wrong:1}`), and since drillCandidates selects on `wrong > 0`, that
// single entry WAS the entire it←de drill pool. Every drill could only ask that word.
//
// Root cause, and it is a regression: v71_h routed a finished drill through renderEx →
// endDrill() → showComplete(true). endDrill swaps the real topic back, and showComplete(true)
// then REBUILDS APP.cur from that restored topic — so by the time the ledger was written,
// `lesson` pointed at a real chapter lesson and `_wrongTargets` was gone. Two consequences:
//   1. the decay never fired: a word answered right in a drill kept its `wrong` count forever;
//   2. the real chapter's words got `seen++` for a round that never touched them.
// And because that same card re-renders whenever a finished chapter is opened, `seen` was counting
// how often the card had been LOOKED AT.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const C = loadClient();
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
// Renderers read LANGS for the flag badge; without it startDrill throws before any assertion.
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

const TOPIC = {
  id: 'T', topic: 'T', lang: 'de', srcLang: 'en', story: 'Es war einmal.', coverageTarget: 0.8,
  lessons: [{ id: 'l1', type: 'standard',
    vocab: [{ target: 'HAUS', source: 'house' }, { target: 'HUND', source: 'dog' }, { target: 'BAUM', source: 'tree' }] }],
};
// One wrong word plus enough clean ones to clear DRILL_MIN — the shape of the reported ledger.
const ledger = () => ({
  STUDIEREN: { source: 'to study', seen: 3, wrong: 1 },
  HAUS: { source: 'house', seen: 3, wrong: 0 }, HUND: { source: 'dog', seen: 3, wrong: 0 },
  BAUM: { source: 'tree', seen: 3, wrong: 0 }, BUCH: { source: 'book', seen: 3, wrong: 0 },
});
const seed = () => C.run(`
  APP.lang='de'; APP.srcLang='en'; APP._teacherMode=false; APP.muted=false;
  APP.lessonData=${JSON.stringify(TOPIC)};
  APP.info={backend:'none',canGenerate:false,coverageThreshold:0.8};
  APP.storylines=[]; APP.savedList=[]; show=function(){};
  APP.progress={completed:{},solved:{},learned:{}};
  APP.progress.completed['T']={}; APP.progress.solved['T']={};
  APP.progress.learned['de|en']={vocab:${JSON.stringify(ledger())},sentences:{}};
  if (typeof _invalidateQidUniverse==='function') _invalidateQidUniverse(); true;`, 'seed');
const vocab = w => C.run(`APP.progress.learned['de|en'].vocab[${JSON.stringify(w)}]`);
// Finish the active round through the REAL exit path (renderEx running out of questions).
const finish = (wrongList) => C.run(`
  APP.cur._wrongTargets = new Set(${JSON.stringify(wrongList || [])});
  APP.cur.cur = APP.cur.exercises.length; renderEx(); true;`, 'finish');

// ── 1. A clean drill walks the word's `wrong` count back down ───────────────
{
  seed();
  assert.strictEqual(C.run(`drillAvailable('de','en')`), true, 'the reported ledger yields a drill');
  C.run(`startDrill();`);
  assert.strictEqual(C.run(`APP.lessonData.topic`), '__drill__', 'the drill is running');
  assert.deepStrictEqual(C.run(`APP.lessonData.lessons[0].vocab.map(v=>v.target)`), ['STUDIEREN'],
    'and it asks exactly the word with a mistake against it');
  finish([]);                                   // every answer correct
  const st = vocab('STUDIEREN');
  assert.strictEqual(st.wrong, 0, 'answering it right in a drill clears the mistake — THE reported bug');
  assert.strictEqual(st.seen, 4, 'and the drill counts as an exposure');
  assert.strictEqual(C.run(`APP.lessonData.topic`), 'T', 'the real topic is restored');
  // The consequence the user asked for: nothing left to drill → the button greys itself.
  assert.strictEqual(C.run(`drillAvailable('de','en')`), false,
    'with no mistakes left there is no drill to offer, so the button greys out on its own');
}

// ── 2. Getting it wrong AGAIN in a drill still counts against it ────────────
// The decay must not be unconditional, or a drill would launder mistakes.
{
  seed();
  C.run(`startDrill();`);
  finish(['STUDIEREN']);
  assert.strictEqual(vocab('STUDIEREN').wrong, 2, 'a word missed again in a drill goes UP, not down');
  assert.strictEqual(C.run(`drillAvailable('de','en')`), true, 'so it stays in the pool');
}

// ── 3. A drill must not touch the real chapter's words ──────────────────────
// The drill runs on an ephemeral topic. Before v71_n the restored chapter's vocabulary was credited
// with a round it never took part in.
{
  seed();
  const before = { HAUS: vocab('HAUS').seen, HUND: vocab('HUND').seen, BAUM: vocab('BAUM').seen };
  C.run(`startDrill();`);
  finish([]);
  ['HAUS', 'HUND', 'BAUM'].forEach(w =>
    assert.strictEqual(vocab(w).seen, before[w], `${w} is untouched by a drill it was not asked in`));
}

// ── 4. Re-opening a finished chapter records nothing ────────────────────────
// `seen` is meant to count practice, not page views. showComplete(true) is the review render, and
// it fires on every visit to a completed chapter — and once more after every drill.
{
  seed();
  const before = vocab('HAUS').seen;
  C.run(`APP.cur={lessonIdx:0,exercises:[],cur:0,correct:3,total:3,mistakes:0,hearts:3,streak:0,bestStreak:3};
         showComplete(true); showComplete(true); showComplete(true); true;`, 'review-x3');
  assert.strictEqual(vocab('HAUS').seen, before,
    'three views of a completed card are zero exposures — they were three before v71_n');
}

// ── 5. A real (non-drill) round still records normally ──────────────────────
// The guard against over-correcting: if review-mode suppression leaked into ordinary play, the
// ledger would stop filling entirely and every symptom above would be replaced by a worse one.
{
  seed();
  const before = vocab('HAUS').seen;
  C.run(`APP.cur={lessonIdx:0,exercises:[],cur:0,correct:2,total:3,mistakes:1,hearts:3,streak:0,bestStreak:2};
         APP.cur._wrongTargets=new Set(['HUND']); showComplete(); true;`, 'real-round');
  assert.strictEqual(vocab('HAUS').seen, before + 1, 'a played round still counts as an exposure');
  assert.strictEqual(vocab('HUND').wrong, 1, 'and a word missed in normal play is marked wrong');
  // A normal lesson must NOT decay: answering a word right once in its own lesson is not evidence
  // it has been learned, and decaying there would empty the drill pool the drill depends on.
  assert.strictEqual(vocab('STUDIEREN').wrong, 1,
    'a normal round does not clear mistakes — only a drill does');
}

// ── 6. The ordering that caused this is pinned ─────────────────────────────
// Source-level, because the bug was WHERE the call sits relative to endDrill(), and no assertion on
// the resulting numbers explains that to whoever next edits this branch.
{
  const rx = html.slice(html.indexOf('function renderEx()'), html.indexOf('function renderEx()') + 3000);
  // Match the CALLS, not the words: the surrounding comments mention endDrill() too, and matching
  // prose would have this assertion passing on the strength of a sentence.
  const recAt = rx.indexOf('recordLearnedFromLesson(_dl');
  const endAt = rx.indexOf('const _wasDrill = endDrill();');
  assert.ok(recAt > 0 && endAt > 0, 'both calls are in renderEx');
  assert.ok(recAt < endAt, 'the drill outcome is recorded BEFORE endDrill() swaps the topic back');
  assert.ok(/if\(!C\._review\) \{ try \{ recordLearnedFromLesson\(lesson, C\._wrongTargets\); \}/.test(html),
    'and showComplete records only on a real play, never on a review render');
}

console.log('unit-drill-ledger: ALL PASSED');
