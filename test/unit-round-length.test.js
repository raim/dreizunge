// unit-round-length.test.js
// v71_i: a replay round is allowed to be SHORT rather than padded with already-answered questions.
//
// User-reported: "replay seems to still play a lot of already played lessons, perhaps also due to
// fixed length of lessons. can we reduce it to previous errors and unplayed lessons?"
//
// Reproduced on the user's own storyline (sl_1725748570, chapter 2, lesson 1 = 37 questions):
// replaying to 100% asked 48 questions of which 11 were repeats, because assembleCoverageRound
// always returned N=12 and backfilled the leftover slots with review once the unsolved pool ran
// short. The coverage FOCUS was already correct (v71_f); the fixed LENGTH was the waste.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

// Largest standard lesson in the shipped corpus — the padding only shows on a lesson whose universe
// exceeds the round size, so a small fixture would not exercise it.
let topic = null, li = -1, best = 0;
for (const t of store.topics) {
  (t.lessons || []).forEach((L, i) => {
    const n = (L && L.type === 'standard' && (L.vocab || []).length) || 0;
    if (n > best) { best = n; topic = t; li = i; }
  });
}
assert.ok(topic && best >= 6, 'the corpus has a standard lesson big enough to exercise round padding');

const seed = () => C.run(`
  APP.lang=${JSON.stringify(topic.lang)}; APP.srcLang=${JSON.stringify(topic.srcLang)};
  APP._teacherMode=false; APP.muted=false;
  APP.lessonData=${JSON.stringify(topic)};
  APP.info={backend:'none',canGenerate:false,coverageThreshold:0.8};
  APP.progress={completed:{},solved:{},learned:{}};
  APP.progress.solved[APP.lessonData.topic]={};
  APP.cur={lessonIdx:${li},correct:0,total:0,mistakes:0,bestStreak:0,exercises:[]};
  if (typeof _invalidateQidUniverse==='function') _invalidateQidUniverse(); true;`, 'seed');
const LID = JSON.stringify(topic.lessons[li].id);
const playRound = () => JSON.parse(C.run(`(function(){
  const s = APP.progress.solved[APP.lessonData.topic];
  const ids = buildExercises(${li}).map(e => qid(e, ${LID})).filter(Boolean);
  const already = ids.filter(id => s[id]).length;
  ids.forEach(id => s[id] = 1);
  const u = _lessonQidUniverse(${li}); let sv=0; for (const id of u) if (s[id]) sv++;
  return JSON.stringify({ n: ids.length, already, pct: Math.round(sv/u.size*100) });})()`));

// ── 1. Replaying to completion wastes almost nothing ────────────────────────
{
  seed();
  const uni = C.run(`_lessonQidUniverse(${li}).size`);
  let asked = 0, repeats = 0, rounds = 0;
  for (let r = 1; r <= 15; r++) {
    const o = playRound(); asked += o.n; repeats += o.already; rounds = r;
    if (o.pct >= 100) break;
  }
  assert.ok(asked <= uni * 1.3,
    `finishing a ${uni}-question lesson asks about that many questions (asked ${asked}), not a fixed multiple of the round size`);
  assert.ok(repeats / asked < 0.20,
    `under a fifth of the questions asked are repeats (got ${Math.round(repeats/asked*100)}% — was 23% before v71_i)`);
  console.log(`  replay to 100%: ${rounds} rounds, ${asked} questions for a ${uni}-question lesson, ${repeats} repeats`);
}

// ── 2. The final round SHRINKS instead of padding ───────────────────────────
// This is the mechanism: when fewer unsolved questions remain than a full round, the round is that
// short rather than topped up with review.
{
  seed();
  const uni = C.run(`_lessonQidUniverse(${li}).size`);
  // Leave exactly 5 unsolved.
  C.run(`(function(){const s=APP.progress.solved[APP.lessonData.topic];
    [..._lessonQidUniverse(${li})].slice(0, ${uni - 5}).forEach(id=>s[id]=1);})()`);
  const o = playRound();
  assert.strictEqual(o.n, 5, `with 5 unsolved left the round is 5 questions, not padded to 12 (got ${o.n})`);
  assert.strictEqual(o.already, 0, 'and none of them is a repeat');
  console.log('  5 unsolved left -> a 5-question round, 0 repeats');
}

// ── 3. A FULLY solved lesson still gives a full review round ────────────────
// Replaying finished material for practice is a real use; that round must not shrink to nothing.
{
  seed();
  C.run(`(function(){const s=APP.progress.solved[APP.lessonData.topic];
    [..._lessonQidUniverse(${li})].forEach(id=>s[id]=1);})()`);
  const o = playRound();
  // "Full length" is relative to what one derivation of this builder can offer, not a magic 12 —
  // the corpus lesson used here yields 6 exercises per derivation.
  const oneDerivation = C.run(`(function(){ APP._derivingUniverse=true;
    const e = buildExercises(${li}); APP._derivingUniverse=false; return e.length; })()`);
  assert.strictEqual(o.n, oneDerivation,
    `a fully-solved lesson still yields a full review round (${o.n} of a possible ${oneDerivation}) — it does not shrink to nothing`);
  assert.strictEqual(o.already, o.n, 'which is entirely review, as intended');
  console.log(`  fully solved -> full review round of ${o.n}`);
}

// ── 4. A first play is unchanged ────────────────────────────────────────────
{
  seed();
  const o = playRound();
  assert.ok(o.n >= 5, `a first play is a normal full round (got ${o.n})`);
  assert.strictEqual(o.already, 0, 'with nothing repeated');
}

// ── 5. The trim is OPT-IN: v69_h's full-round rule still governs everywhere else ──
// Option-1 narrowing (v71_i). The trim breaks "backfill keeps the round full, nothing is excluded
// outright", which exists so the coverage denominator can never strand below the mark. It is
// therefore limited to the single-lesson replay. This asserts the invariant still holds for a
// caller that does NOT opt in — behaviourally, not just by reading the source.
{
  // Drive assembleCoverageRound DIRECTLY with a constructed pool rather than through the builder.
  // Going through buildExercises made this flaky: the standard builder samples one exercise type
  // per vocab item, so whether the sampled pool happened to contain an unsolved question varied
  // run to run, and the two calls sometimes returned the same length for that reason rather than
  // because the flag did nothing. The property under test is about assembleCoverageRound, so test
  // it there.
  const r = JSON.parse(C.run(`(function(){
    const s = APP.progress.solved[APP.lessonData.topic];
    Object.keys(s).forEach(k => delete s[k]);
    const mk = (n) => ({ type:'mcq_source_target', target:n, source:n.toLowerCase(), correct:n,
                         _srcLessonIdx: ${li} });
    const pool = [];
    for (let i = 0; i < 10; i++) pool.push(mk('W' + i));
    // Mark 8 of the 10 solved, leaving 2 unsolved — fewer than a 12-question round wants.
    pool.slice(0, 8).forEach(ex => { const id = qid(ex, ${LID}); if (id) s[id] = 1; });
    const noOptIn = assembleCoverageRound(pool, 12, 0.85);
    const optIn   = assembleCoverageRound(pool, 12, 0.85, true);
    const optInSolved = optIn.filter(ex => { const id = qid(ex, ${LID}); return id && s[id]; }).length;
    return JSON.stringify({ pool: pool.length, noOptIn: noOptIn.length,
                            optIn: optIn.length, optInSolved });})()`));
  assert.strictEqual(r.noOptIn, r.pool,
    `without the opt-in the round still fills from review (${r.noOptIn} of ${r.pool}) — v69_h intact`);
  assert.strictEqual(r.optIn, 2,
    `with the opt-in it trims to exactly the 2 unsolved questions (got ${r.optIn})`);
  assert.strictEqual(r.optInSolved, 0, 'and spends no slot on an already-answered question');
  console.log(`  opt-in only: same 10-item pool -> ${r.noOptIn} questions without the flag, ${r.optIn} with it`);
}

console.log('unit-round-length: ALL PASSED');
