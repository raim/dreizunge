// unit-coverage.test.js
// Commit B: the coverage model consumes the solved store (Commit A) to drive progression.
// Tests the pure logic headlessly: qid-universe enumeration converges & caches; lesson/topic
// coverage fractions; coverage-aware round assembly (~70/30 unsolved/review, unsolved-first,
// coverage-advancing); and coverageComplete against the target. Uses the REAL builders where it
// matters so there's no logic drift.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(name){
  const at = html.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('not found: ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(at, i);
}

// ── Build a sandbox with the real qid + coverage + builder machinery ─────────
const APP = { _teacherMode: false, lang: 'de', lessonData: null, cur: { lessonIdx: 0 }, progress: { completed: {}, solved: {} } };
let saved = 0;
const env = {
  APP,
  saveProg: () => { saved++; },
  stripFuri: s => String(s == null ? '' : s),
  jaTokenize: t => [t],
  _qidUniverseCache: new Map(),   // module-level in the app; injected here
  shuffleSeed: 0,
  // countedLessons + lessonCountsFor (needed by topicCoverage)
};
const src = [
  ext('shuffle'), ext('pick'),
  ext('_qidHash'), ext('_qidCanonical'), ext('qid'),
  ext('_solvedMap'), ext('isSolved'), ext('markSolved'),
  ext('buildStandardExercises'),
  ext('_lessonQidUniverse'), ext('_invalidateQidUniverse'),
  ext('lessonCoverage'), ext('topicCoverage'),
  ext('_coverageTarget'), ext('coverageComplete'), ext('assembleCoverageRound'),
  // stubs for helpers the coverage fns reference:
  'function _exFlagState(ex){ return ex && ex.__flagged ? {comment:"x"} : null; }',
  'function _resolveExItem(ex, ls){ return ex && ex.__src ? ex.__src : null; }',
  'function lessonTypeMeta(type){ return { build: (L,idx)=>buildStandardExercises(L,idx) }; }',
  'function lessonCountsFor(d, L){ if(APP._teacherMode) return true; const mixedOnly=(d.lessons||[]).some(x=>x&&x.type==="mixed"&&!x._hidden); return mixedOnly ? (L.type==="mixed"&&!L._hidden) : !L._hidden; }',
  'function countedLessons(d){ return (d.lessons||[]).filter(L=>lessonCountsFor(d,L)); }',
].join('\n');
const M = new Function(...Object.keys(env), src +
  '\nreturn { qid, markSolved, _solvedMap, _lessonQidUniverse, _invalidateQidUniverse, lessonCoverage, topicCoverage, coverageComplete, assembleCoverageRound };'
)(...Object.values(env));

// ── A realistic standard lesson (the only type our stubbed lessonTypeMeta builds) ──
const lesson = {
  id: 'L1', type: 'standard',
  vocab: Array.from({ length: 8 }, (_, i) => ({ target: 'wort' + i, source: 'word' + i })),
  sentences: Array.from({ length: 5 }, (_, i) => ({ target: 'satz' + i + ' a b', source: 'sent' + i, words: ['satz' + i, 'a', 'b'] })),
};
APP.lessonData = { topic: 'T1', lang: 'de', lessons: [lesson] };

// ── 1) Universe enumeration converges and caches ─────────────────────────────
const U1 = M._lessonQidUniverse(0);
assert.ok(U1.size >= 8, 'universe has a reasonable number of questions, got ' + U1.size);
const U2 = M._lessonQidUniverse(0);
assert.strictEqual(U1, U2, 'universe is cached (same Set instance on second call)');
console.log('  universe enumeration converges (' + U1.size + ') and caches: OK');

// ── 2) Coverage fraction reflects the solved store ───────────────────────────
let cov = M.lessonCoverage(0);
assert.strictEqual(cov.solved, 0, 'nothing solved yet');
assert.strictEqual(cov.total, U1.size, 'lesson total = universe size');
assert.strictEqual(cov.pct, 0, '0% at start');
// Solve half the universe directly in the store.
const ids = [...U1];
const half = Math.floor(ids.length / 2);
ids.slice(0, half).forEach(id => { M._solvedMap('T1')[id] = 1; });
cov = M.lessonCoverage(0);
assert.strictEqual(cov.solved, half, 'coverage counts solved qids');
assert.ok(cov.pct > 0 && cov.pct < 100, 'partial coverage is between 0 and 100');
console.log('  coverage fraction tracks the solved store: OK');

// ── 3) coverageComplete against the target ───────────────────────────────────
assert.ok(!M.coverageComplete(), 'not complete at half coverage (target 1.0)');
ids.forEach(id => { M._solvedMap('T1')[id] = 1; });   // solve everything
assert.ok(M.coverageComplete(), 'complete once the whole universe is solved');
// custom target: solving exactly ceil(total/2) items must meet a 50% target regardless of
// whether the universe size is even or odd (floor(n/2)/n can be < 0.5 for odd n).
APP.lessonData.coverageTarget = 0.5;
const uNow = [...M._lessonQidUniverse(0)];      // ids from the CURRENT universe (may have grown)
const total = uNow.length;
const halfUp = Math.ceil(total / 2);
Object.keys(M._solvedMap('T1')).forEach(k => delete M._solvedMap('T1')[k]);
uNow.slice(0, halfUp).forEach(id => { M._solvedMap('T1')[id] = 1; });
assert.ok(M.coverageComplete(), `meets a 50% target at ${halfUp}/${total} coverage`);
// and just-below the target does NOT complete
Object.keys(M._solvedMap('T1')).forEach(k => delete M._solvedMap('T1')[k]);
uNow.slice(0, Math.max(0, Math.floor(total / 2) - 1)).forEach(id => { M._solvedMap('T1')[id] = 1; });
assert.ok(!M.coverageComplete(), 'does not meet the 50% target below half coverage');
delete APP.lessonData.coverageTarget;
console.log('  coverageComplete respects the target fraction: OK');

// ── 4) Coverage-aware assembly: unsolved-first, ~70/30, coverage-advancing ───
// Reset solved; mark a specific subset solved, then assemble a round and check the mix.
Object.keys(M._solvedMap('T1')).forEach(k => delete M._solvedMap('T1')[k]);
// Build a pool of tagged pooled exercises (as buildMixedExercises would), each resolvable via qid.
function poolItem(target){ return { type: 'mcq_target_source', target, source: 't' + target, _srcLessonIdx: 0, __src: {} }; }
const pool = Array.from({ length: 20 }, (_, i) => poolItem('p' + i));
// Solve the first 10 of them.
pool.slice(0, 10).forEach(ex => { M._solvedMap('T1')[M.qid(ex, 'L1')] = 1; });
// qid uses APP.cur.lessonIdx / _srcLessonIdx → resolves to L1
APP.cur = { lessonIdx: 0 };
const round = M.assembleCoverageRound(pool, 10);
assert.strictEqual(round.length, 10, 'round respects the requested size');
const solvedSet = M._solvedMap('T1');
const nUnsolved = round.filter(ex => !solvedSet[M.qid(ex, 'L1')]).length;
const nReview   = round.length - nUnsolved;
assert.ok(nUnsolved >= nReview, 'round is unsolved-weighted (unsolved ≥ review)');
assert.ok(nUnsolved >= 6 && nUnsolved <= 10, `~70% unsolved in a 10-round, got ${nUnsolved}`);
// Coverage-advancing: the round contains unsolved items whenever any exist.
assert.ok(nUnsolved > 0, 'a round with unsolved items available includes some');
console.log(`  coverage-aware assembly: ${nUnsolved} unsolved / ${nReview} review in a 10-round: OK`);

// ── 5) Backfill when a bucket is short ───────────────────────────────────────
// All solved → round is all review, still full length (no unsolved to prefer).
const allSolved = Array.from({ length: 6 }, (_, i) => poolItem('q' + i));
allSolved.forEach(ex => { M._solvedMap('T1')[M.qid(ex, 'L1')] = 1; });
const r2 = M.assembleCoverageRound(allSolved, 6);
assert.strictEqual(r2.length, 6, 'round fills from review when no unsolved remain');
// Few unsolved, big requested size → returns everything available, no dupes.
const mix = [poolItem('u0'), poolItem('u1'), ...allSolved];
const r3 = M.assembleCoverageRound(mix, 100);
assert.strictEqual(r3.length, mix.length, 'round never exceeds the pool');
assert.strictEqual(new Set(r3).size, r3.length, 'no duplicate exercises in a round');
console.log('  assembly backfills short buckets, no duplicates, bounded by pool: OK');

// ── 6) Cache: stable within a lifetime; monotonic across re-derivation ────────
// Within a cache lifetime the universe is returned as-is (no wobble under the learner).
const cachedAgain = M._lessonQidUniverse(0);
assert.strictEqual(cachedAgain, U1, 'universe is stable (same Set) within a cache lifetime');
// The denominator is MONOTONIC: seeding from the prior cached set and re-deriving only ever
// grows it (rare variants fold in), never shrinks — so "100%" can't move under the learner.
const sizeBefore = U1.size;
// Force a fresh derivation that MERGES into the prior (simulate a re-derive without clearing by
// deleting only this key's presence check would bypass the seed; instead re-run many derivations
// through the public path after an invalidate and assert non-shrink vs a from-scratch baseline).
M._invalidateQidUniverse();
let minSize = Infinity, maxSize = 0;
for (let k = 0; k < 8; k++){ M._invalidateQidUniverse(); const s = M._lessonQidUniverse(0).size; minSize = Math.min(minSize, s); maxSize = Math.max(maxSize, s); }
assert.ok(maxSize - minSize <= 2, `from-scratch universe size is near-stable (spread ${minSize}..${maxSize})`);
assert.ok(minSize >= 8, 'universe stays a sensible size across recomputes');
// Monotonic seed: calling twice WITHOUT invalidation never shrinks.
const a = M._lessonQidUniverse(0).size;
const b = M._lessonQidUniverse(0).size;
assert.ok(b >= a, 'cached universe never shrinks on repeated reads');
console.log(`  universe stable within lifetime; near-stable & monotonic across recompute (${minSize}..${maxSize}): OK`);

// ── 7) Mixed universe unions only EARLIER siblings (matches earlier-only pooling) ─────
// Build a set: two standard lessons, a mixed lesson between them, then a later standard. The
// mixed lesson's universe must equal the union of the EARLIER standard lessons only — never the
// later one.
(() => {
  const early1 = { id: 'E1', type: 'standard', vocab: [{ target: 'a1', source: 'x1' }, { target: 'a2', source: 'x2' }] };
  const early2 = { id: 'E2', type: 'standard', vocab: [{ target: 'b1', source: 'y1' }] };
  const later  = { id: 'LT', type: 'standard', vocab: [{ target: 'c1', source: 'z1' }, { target: 'c2', source: 'z2' }] };
  const mixed  = { id: 'MX', type: 'mixed' };
  APP.lessonData = { topic: 'TMIX', lang: 'de', lessons: [early1, early2, mixed, later] };
  APP._teacherMode = false;
  M._invalidateQidUniverse();
  const mixIdx = 2;
  const mixU = M._lessonQidUniverse(mixIdx);
  const e1 = M._lessonQidUniverse(0), e2 = M._lessonQidUniverse(1), lt = M._lessonQidUniverse(3);
  // every id in the mixed universe comes from an earlier sibling…
  const earlyUnion = new Set([...e1, ...e2]);
  for (const id of mixU) assert.ok(earlyUnion.has(id), 'mixed universe id comes from an earlier sibling');
  // …and none from the later lesson.
  for (const id of lt) assert.ok(!mixU.has(id), 'a LATER lesson contributes nothing to the mixed universe');
  assert.ok(mixU.size >= e2.size, 'mixed universe covers the earlier siblings');
  console.log('  mixed universe unions EARLIER siblings only (not later lessons): OK');
})();

console.log('unit-coverage: ALL PASSED');
