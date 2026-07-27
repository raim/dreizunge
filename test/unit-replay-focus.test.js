// unit-replay-focus.test.js
// v71_f: a REPLAY of a classic lesson reaches for the questions the learner has not solved yet.
//
// User-reported: "if we press the repeat button, does it focus on vocabulary from the current
// lesson that we haven't seen yet? the focus could be stronger."
//
// It could. assembleCoverageRound (v69.2/v69_h) already ordered a round unsolved-first, so the
// ordering was not the problem — the POOL was. buildStandardExercises samples one exercise type per
// vocab item, so a single derivation surfaces only part of what the lesson can ask. Measured on a
// shipped 12-vocab lesson before the fix: universe 12 questions, one derivation yields 6, and with
// half the universe solved that pool contained just 2 unsolved items. The coverage ordering was
// doing its job on a pool that had already discarded most of the unsolved material.
//
// The fix re-derives the builder until the missing unsolved questions surface — the same
// convergence buildMixedExercises and _lessonQidUniverse already use, for the same reason.
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

// A real standard lesson from the shipped corpus — the sampling behaviour under test is a property
// of the actual builders, so a hand-made fixture would not exercise it.
let topic = null, li = -1;
for (const t of store.topics) {
  const i = (t.lessons || []).findIndex(L => L && L.type === 'standard' && (L.vocab || []).length >= 6);
  if (i >= 0) { topic = t; li = i; break; }
}
assert.ok(topic, 'the corpus has a standard lesson with enough vocab');

const seed = (tgt) => C.run(`
  APP.lessonData = ${JSON.stringify(topic)};
  APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:${tgt} };
  APP.lessonData.coverageTarget = ${tgt};
  APP.progress = { completed:{}, solved:{}, learned:{} };
  APP.progress.solved[APP.lessonData.topic] = {};
  APP._teacherMode = false; APP.muted = false; true;`, 'seed');

const LID = JSON.stringify(topic.lessons[li].id);
const solveAll = () => C.run(`(function(){
  const s = APP.progress.solved[APP.lessonData.topic];
  buildExercises(${li}).forEach(ex => { const id = qid(ex, ${LID}); if (id) s[id] = 1; });
  return true;})()`);

// ── 1. The premise: one derivation does NOT surface the whole universe ───────
// If this ever stops being true the fix is unnecessary, and this file should be revisited rather
// than left passing vacuously.
{
  seed(0.8);
  const uni = C.run(`_lessonQidUniverse(${li}).size`);
  const one = C.run(`(function(){ APP._derivingUniverse = true;
    const e = buildExercises(${li}); APP._derivingUniverse = false; return e.length; })()`);
  assert.ok(uni > one, `one derivation (${one}) surfaces less than the universe (${uni}) — the sampling this fix exists for`);
  console.log(`  premise: universe ${uni}, single derivation ${one}`);
}

// ── 2. A replay reaches the unsolved questions the derivation missed ────────
{
  seed(0.8);
  const before = C.run(`(function(){
    const s = APP.progress.solved[APP.lessonData.topic];
    const u = [..._lessonQidUniverse(${li})];
    u.slice(0, Math.floor(u.length/2)).forEach(id => s[id] = 1);   // half solved
    const round = buildExercises(${li});
    const ids = round.map(x => qid(x, ${LID})).filter(Boolean);
    return JSON.stringify({ len: ids.length, unsolved: ids.filter(id => !s[id]).length,
                            leftInUniverse: [..._lessonQidUniverse(${li})].filter(id => !s[id]).length });
  })()`);
  const r = JSON.parse(before);
  assert.ok(r.unsolved >= Math.min(r.leftInUniverse, 4),
    `the replay round reaches most of the remaining unsolved questions (got ${r.unsolved} of ${r.leftInUniverse} available)`);
  console.log(`  replay round: ${r.len} questions, ${r.unsolved} unsolved of ${r.leftInUniverse} available`);
}

// ── 3. Convergence: the property the user actually feels ───────────────────
// Perfect learner, replaying until the pass mark. Before the fix this averaged 2.84 rounds at 80%
// and 5.48 at 100% (worst case 10). The assertion is deliberately loose enough not to be flaky, but
// tight enough that reverting the fix fails it.
{
  const trial = (tgt) => {
    seed(tgt);
    for (let n = 1; n <= 60; n++) {
      solveAll();
      const done = C.run(`(function(){
        const s = APP.progress.solved[APP.lessonData.topic];
        const u = _lessonQidUniverse(${li}); let sv = 0; for (const id of u) if (s[id]) sv++;
        return sv / u.size >= _coverageTarget(); })()`);
      if (done) return n;
    }
    return 99;
  };
  for (const tgt of [0.8, 1.0]) {
    const runs = Array.from({ length: 12 }, () => trial(tgt));
    const worst = Math.max(...runs);
    const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
    assert.ok(worst <= 3,
      `at ${tgt * 100}% the pass mark is reached within 3 replays every time (worst ${worst}, avg ${avg.toFixed(2)})`);
    console.log(`  convergence @${tgt * 100}%: avg ${avg.toFixed(2)}, worst ${worst} rounds`);
  }
}

// ── 4. A FIRST play is unchanged ───────────────────────────────────────────
// Nothing is solved, so every question is equally new; topping up would just make the round longer
// (measured 6 -> 12), which is a different change from the one requested.
{
  seed(0.8);
  const lens = Array.from({ length: 8 }, () => C.run(`buildExercises(${li}).length`));
  const uni = C.run(`_lessonQidUniverse(${li}).size`);
  assert.ok(Math.max(...lens) < uni,
    `a first-play round stays a normal round (${Math.max(...lens)} questions, universe ${uni}) — not padded to the full set`);
  console.log(`  first play: rounds of ${[...new Set(lens)].join('/')} questions, universe ${uni} — unchanged`);
}

// ── 5. No duplicates, and the round stays a round ──────────────────────────
{
  seed(0.8);
  const dup = C.run(`(function(){
    const s = APP.progress.solved[APP.lessonData.topic];
    [..._lessonQidUniverse(${li})].slice(0, 3).forEach(id => s[id] = 1);
    const ids = buildExercises(${li}).map(x => qid(x, ${LID})).filter(Boolean);
    return JSON.stringify({ n: ids.length, uniq: new Set(ids).size });})()`);
  const d = JSON.parse(dup);
  assert.strictEqual(d.n, d.uniq, 'the topped-up round contains no duplicate questions');
  assert.ok(d.n <= 12, `and respects the round cap (${d.n})`);
}

// ── 6. The re-entry guard: re-derivation must not recurse ──────────────────
{
  seed(0.8);
  C.run(`[..._lessonQidUniverse(${li})].slice(0,3).forEach(id => APP.progress.solved[APP.lessonData.topic][id] = 1);`);
  C.run(`buildExercises(${li});`);
  assert.strictEqual(C.run(`APP._topUpUnsolved === true`), false,
    'the re-entry flag is cleared after the round is built, even though the builder calls itself');
  assert.strictEqual(C.calls.errors.length, 0, 'and no errors were logged');
}

// ── 7. Universe derivation is still uncapped and unbiased ──────────────────
// The top-up must never run while the denominator is being derived, or the universe would be
// computed from a coverage-biased pool and the target would move under the learner.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/if \(APP\._derivingUniverse\) return _exs;/.test(src),
    'universe enumeration returns before any coverage logic');
  assert.ok(src.indexOf('if (APP._derivingUniverse) return _exs;') < src.indexOf('APP._topUpUnsolved'),
    'and does so BEFORE the top-up, so the denominator is never biased by it');
}

// ── 8. Deterministic builders need NO top-up, and this proves it ────────────
// Asked (v71_g): should the fix extend to synonyms and word_forms? No — and the reason is a
// property, not a preference. The top-up only helps a builder that SAMPLES, leaving unsolved
// questions out of a single derivation (buildStandardExercises picks one exercise type per vocab
// item). synonyms, word_forms and grammar emit their ENTIRE question set every build: exactly one
// exercise per item/relation, deterministically. So one derivation already equals the universe and
// a perfect learner reaches 100% in a single round. Extending the fix would add a re-derivation
// loop that can never find anything missing. This asserts the premise that makes the fix
// unnecessary there — if a future edit makes one of these builders sample, this fails and flags
// that the decision must be revisited.
{
  const seedType = (type) => {
    let topic = null, li = -1;
    for (const t of store.topics) {
      const i = (t.lessons || []).findIndex(L => L && L.type === type &&
        (L.words || L.items || L.grammar || []).length >= 2);
      if (i >= 0) { topic = t; li = i; break; }
    }
    if (!topic) return null;
    C.run(`
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{}, learned:{} };
      APP.progress.solved[APP.lessonData.topic] = {};
      APP._teacherMode = false; APP.muted = false;
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-' + type);
    const uni = C.run(`_lessonQidUniverse(${li}).size`);
    const one = C.run(`(function(){ APP._derivingUniverse = true;
      const e = buildExercises(${li}); APP._derivingUniverse = false;
      return new Set(e.map(x => qid(x, APP.lessonData.lessons[${li}].id)).filter(Boolean)).size; })()`);
    return { uni, one };
  };
  let checked = 0;
  for (const type of ['synonyms', 'word_forms', 'grammar']) {
    const r = seedType(type);
    if (!r) { console.log(`  (no ${type} lesson in corpus — skipped)`); continue; }
    assert.strictEqual(r.one, r.uni,
      `${type}: one derivation already yields the whole universe (${r.one}/${r.uni}) — a deterministic builder, no top-up needed`);
    checked++;
  }
  assert.ok(checked >= 2, 'at least two deterministic builders were actually checked, not all skipped');
  console.log(`  deterministic builders (${checked} checked): one build == universe, no top-up needed`);
}

console.log('unit-replay-focus: ALL PASSED');
