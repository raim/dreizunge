// unit-mixed-coverage-round.test.js
// v69.1 — single-pass mixed rounds + the drill actually closing the gap (user request):
//   • buildMixedExercises sizes the round so ONE pass can reach the coverage target:
//     needed = ceil(target × universe) − solved distinct UNSOLVED questions, collected per sibling
//     by RE-DERIVING its builder until every wanted qid has an exercise (builders sample, so one
//     derivation is a subset); solved questions are not re-asked; needed===0 keeps the sampled
//     replay round; without the coverage machinery (unit harnesses) it degrades to the old path
//     (unit-mixed-lessons still covers that).
//   • markSolved: a drill launched from a chapter CREDITS that chapter — the drill was "the way
//     up" (v60.8) but its solves landed only under __drill__, so the chapter's coverage never
//     moved. Re-keying the qid hash with each parent lesson id that contains the word marks
//     exactly the demonstrated chapter questions; a re-keyed qid outside a lesson's universe is
//     inert (coverage counts the intersection).
//   • showComplete: "below threshold" fires for MIXED-driven sets at ANY target (incl. the
//     default 1.0), so an errorful one-pass round routes into the drill instead of replaying.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name){
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for(; i < html.length; i++){ if(html[i]==='{') d++; else if(html[i]==='}'){ d--; if(!d){ i++; break; } } }
  return html.slice(at, i);
}

// ── 1. Coverage-driven round sizing ───────────────────────────────────────────
{
  // Two source lessons, 4 questions each. Builders SAMPLE: each call returns a rotating half of
  // the lesson's questions, so a single derivation can never surface the full set — proving the
  // collection loop converges by re-deriving.
  const mkEx = (lid, n) => ({ type: 'mcq', correct: lid + '-q' + n, target: 'w' + n, source: 's' + n });
  let tick = 0;
  const FAKE = {
    standard: (l) => { tick++; return [0,1,2,3].filter(n => (n + tick) % 2 === 0).map(n => mkEx(l.id, n)); },
  };
  const lessons = [
    { id: 'A', type: 'standard' },
    { id: 'B', type: 'standard' },
    { id: 'M', type: 'mixed' },
  ];
  const APP = { lessonData: { topic: 'T', lessons }, _teacherMode: false, cur: { lessonIdx: 2 }, progress: {} };
  const qid = (ex, lid) => (lid || '_') + ':' + ex.type + ':' + ex.correct;
  const UNI = {
    0: new Set([0,1,2,3].map(n => 'A:mcq:A-q' + n)),
    1: new Set([0,1,2,3].map(n => 'B:mcq:B-q' + n)),
  };
  UNI[2] = new Set([...UNI[0], ...UNI[1]]);           // the mixed lesson's universe = the union
  const _lessonQidUniverse = (i) => UNI[i] || new Set();
  const solvedStore = { 'A:mcq:A-q0': 1, 'A:mcq:A-q1': 1, 'B:mcq:B-q0': 1 };   // 3 of 8 solved
  const _solvedMap = () => solvedStore;
  let target = 1;
  const _coverageTarget = () => target;
  const lessonTypeMeta = (t) => ({ build: (l, i) => (FAKE[t] ? FAKE[t](l, i) : []) });
  const shuffle = (a) => a.slice();                    // identity: deterministic
  const _resolveExItem = () => null;
  const assembleCoverageRound = (pool) => pool.map(e => ({ ...e, _sampled: true }));  // marks the fallback path

  const build = new Function('APP', 'lessonTypeMeta', 'shuffle', '_resolveExItem', 'assembleCoverageRound',
    '_lessonQidUniverse', '_solvedMap', '_coverageTarget', 'qid',
    extract('buildMixedExercises') + '\nreturn buildMixedExercises;')(
    APP, lessonTypeMeta, shuffle, _resolveExItem, assembleCoverageRound,
    _lessonQidUniverse, _solvedMap, _coverageTarget, qid);

  // Target 100%: needed = 8 − 3 = 5 → the round is exactly the 5 unsolved questions, no repeats,
  // no already-solved items — one clean pass to the threshold.
  let round = build(lessons[2], 2);
  assert.strictEqual(round.length, 5, 'tgt=1: round = every unsolved question (got ' + round.length + ')');
  const ids = round.map(e => qid(e, e._srcLessonIdx === 0 ? 'A' : 'B'));
  assert.strictEqual(new Set(ids).size, 5, 'no duplicate questions in the round');
  assert.ok(ids.every(id => !solvedStore[id]), 'solved questions are never re-asked');
  assert.ok(round.every(e => Number.isInteger(e._srcLessonIdx)), 'pooled exercises keep their source tag');
  assert.ok(!round.some(e => e._sampled), 'the needed>0 path does not use the sampled assembler');

  // Target 60%: needed = ceil(0.6×8) − 3 = 2 → a lean two-question pass.
  target = 0.6;
  round = build(lessons[2], 2);
  assert.strictEqual(round.length, 2, 'tgt=0.6: round sized to exactly reach the threshold (got ' + round.length + ')');

  // Target met (needed = 0) → falls through to the sampled replay round.
  target = 0.3;                                        // ceil(0.3×8)=3 ≤ 3 solved
  round = build(lessons[2], 2);
  assert.ok(round.length > 0 && round.every(e => e._sampled), 'needed=0 → the sampled 70/30 replay path');
}
console.log('  round sizing: exact-needed unsolved, converging collection, replay when met: OK');

// ── 2. markSolved credits the drill's launching chapter ───────────────────────
{
  const DRILL_TOPIC = '__drill__';
  const parent = { topic: 'Ch', lessons: [
    { id: 'L1', type: 'standard', vocab: [{ target: 'Haus', source: 'house' }] },   // contains the word
    { id: 'L2', type: 'standard', vocab: [{ target: 'Baum', source: 'tree' }] },    // does NOT
    { id: 'M',  type: 'mixed' },                                                    // mixed: skipped
  ]};
  const APP = {
    lessonData: { topic: DRILL_TOPIC, lessons: [{ id: 'drill', _drill: true }] },
    _drillPrev: parent,
    progress: { solved: {} },
    cur: { lessonIdx: 0 },
  };
  let saves = 0;
  const fns = new Function('APP', 'DRILL_TOPIC', '_exFlagState', 'qid', 'stripFuri', 'saveProg',
    extract('_solvedMap') + '\n' + extract('markSolved') + '\nreturn { markSolved, _solvedMap };')(
    APP, DRILL_TOPIC, () => null, (ex) => 'drill:mcq_source_target:h1', (s) => s, () => { saves++; });

  const id = fns.markSolved({ type: 'mcq_source_target', target: 'Haus', source: 'house', correct: 'Haus' });
  assert.strictEqual(id, 'drill:mcq_source_target:h1', 'the drill solve itself is recorded');
  assert.ok(APP.progress.solved[DRILL_TOPIC]['drill:mcq_source_target:h1'], 'drill-topic map marked');
  const pm = APP.progress.solved['Ch'] || {};
  assert.ok(pm['L1:mcq_source_target:h1'], 'the chapter lesson CONTAINING the word is credited');
  assert.ok(!pm['L2:mcq_source_target:h1'], 'a lesson without the word is not credited');
  assert.ok(!pm['M:mcq_source_target:h1'], 'the mixed lesson is never credited');
  assert.ok(saves === 1, 'persisted once for the batch of new solves');
  // Idempotent: solving the same drill question again writes nothing new.
  fns.markSolved({ type: 'mcq_source_target', target: 'Haus', source: 'house', correct: 'Haus' });
  assert.strictEqual(saves, 1, 'no re-save when nothing changed (monotonic)');
}
console.log('  drill credit-back: containing lesson credited, others/mixed skipped, monotonic: OK');

// ── 3. showComplete: below-threshold fires for mixed-driven sets at any target ─
{
  const sc = extract('showComplete');
  assert.ok(/const _mixedDrv = \(APP\.lessonData\.lessons \|\| \[\]\)\.some\(x => x && x\.type === 'mixed' && !x\._hidden\);/.test(sc),
    'the gate detects a mixed-driven set');
  assert.ok(/if \(tgt < 1 \|\| _mixedDrv\)\{/.test(sc),
    'below-threshold fires for mixed-driven sets even at the default target of 1.0');
}
console.log('  completion gate: mixed-driven sets route into the drill below target: OK');

console.log('unit-mixed-coverage-round: ALL PASSED');
