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

// ── 8. The non-standard builders need no top-up — for TWO different reasons ──
// Asked (v71_g): should the v71_f top-up extend to synonyms, word_forms and grammar? The answer is
// still no, but the original reason was only half right, and this section asserted the wrong half
// for grammar until v71_r.
//
// There are two shapes here, and conflating them is what hid a live defect:
//
//   UNCAPPED (synonyms, word_forms) — `return shuffle(exs)`. Exactly one exercise per item, no
//     cut at all, so a PLAY build already equals the universe. Nothing to top up and nothing to
//     order: a perfect learner reaches 100% in a single round.
//
//   CAPPED (grammar, conjugation) — `return _cutCoverageRound(exs, 14)`. The pool is the entire
//     universe, but a round is a 14-question CUT of it. A top-up is still pointless (the pool is
//     already complete — there is nothing missing to re-derive), but the CUT has to be
//     coverage-aware or a replay re-asks solved questions. Until v71_r it was `shuffle().slice()`:
//     a random 14 of 25, measured at ~53% repeats on ls_1785500580472_1_grammar with 11 questions
//     unreachable. That is precisely the defect v71_f fixed for standard lessons, left live here
//     because "deterministic" was read as "needs nothing".
//
// §8 originally asserted one-build == universe for all three. That held for grammar only by
// accident of the bundled corpus: the cap bites at >14 exercises, and the then-first grammar lesson
// was smaller. A new lessons.json moved it (14 of 20 grammar lessons in the current corpus exceed
// the cap) and the guard fired — correctly, for a real reason.
//
// Both properties are asserted below, separately, so neither can silently become the other.
{
  const seedType = (type) => {
    let topic = null, li = -1;
    for (const t of store.topics) {
      const i = (t.lessons || []).findIndex(L => L && L.type === type &&
        (L.words || L.items || L.grammar || L.conjugations || []).length >= 2);
      if (i >= 0) { topic = t; li = i; break; }
    }
    if (!topic) return null;
    C.run(`
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{}, learned:{} };
      APP.progress.solved[APP.lessonData.topic] = {};
      APP.cur.lessonIdx = ${li};
      APP._teacherMode = false; APP.muted = false;
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-' + type);
    const LID = JSON.stringify(topic.lessons[li].id);
    const uni = C.run(`_lessonQidUniverse(${li}).size`);
    // No extra filtering: since v71_l the builder and the denominator apply the SAME rule
    // (_itemWithheld — human decisions only), so one build equals the universe with nothing to
    // reconcile. This briefly needed a mirror of the exclusion, back when the denominator dropped
    // QC-flagged items that the builder still asked; the fix was to make the two agree in the
    // client rather than to teach the test about the disagreement.
    const derived = C.run(`(function(){ APP._derivingUniverse = true;
      const e = buildExercises(${li}); APP._derivingUniverse = false;
      return new Set(e.map(x => qid(x, ${LID})).filter(Boolean)).size; })()`);
    const play = C.run(`(function(){
      return new Set(buildExercises(${li}).map(x => qid(x, ${LID})).filter(Boolean)).size; })()`);
    return { uni, derived, play, li, LID, topic };
  };

  // 8a. UNCAPPED builders: even a PLAY build is the whole universe.
  let uncapped = 0;
  for (const type of ['synonyms', 'word_forms']) {
    const r = seedType(type);
    if (!r) { console.log(`  (no ${type} lesson in corpus — skipped)`); continue; }
    assert.strictEqual(r.play, r.uni,
      `${type}: a play build already yields the whole universe (${r.play}/${r.uni}) — uncapped, no top-up and no cut`);
    uncapped++;
  }
  assert.ok(uncapped >= 1, 'at least one uncapped builder was actually checked, not all skipped');

  // 8b. CAPPED builders: the DERIVING build must still be complete (the _lessonQidUniverse
  // contract — "builders: full set, no cap, no coverage bias"). Grammar and conjugation ignored
  // that contract before v71_r, which forced the denominator to be rediscovered by convergence.
  let capped = 0, sawCap = false;
  for (const type of ['grammar', 'conjugation']) {
    const r = seedType(type);
    if (!r) { console.log(`  (no ${type} lesson in corpus — skipped)`); continue; }
    assert.strictEqual(r.derived, r.uni,
      `${type}: a DERIVING build must return the full set, uncut (${r.derived}/${r.uni}) — the _derivingUniverse contract`);
    if (r.play < r.uni) {
      sawCap = true;
      // 8c. …and the CUT must be unsolved-first. Solve everything the first round asks, then
      // replay: every question in the next round must be one that was NOT solved. Under the old
      // `shuffle().slice(0,14)` this round was a random 14 of 25 and this assertion fails loudly.
      const solvedNow = C.run(`(function(){
        const s = APP.progress.solved[APP.lessonData.topic];
        const ids = buildExercises(${r.li}).map(x => qid(x, ${r.LID})).filter(Boolean);
        ids.forEach(id => s[id] = 1);
        return ids.length; })()`);
      const replayRepeats = C.run(`(function(){
        const s = APP.progress.solved[APP.lessonData.topic];
        const ids = buildExercises(${r.li}).map(x => qid(x, ${r.LID})).filter(Boolean);
        return [ids.length, ids.filter(id => s[id]).length]; })()`);
      const [roundLen, repeats] = [replayRepeats[0], replayRepeats[1]];
      assert.ok(roundLen > 0, `${type}: a replay still produces a round (${roundLen} questions)`);
      assert.strictEqual(repeats, 0,
        `${type}: a replay after solving ${solvedNow} asks ONLY unsolved questions — ` +
        `got ${repeats} repeats in a round of ${roundLen} (universe ${r.uni}). ` +
        `A random cut re-asks solved material; the cut must be coverage-aware.`);
      console.log(`  ${type}: capped play ${r.play}/${r.uni}, replay ${roundLen} questions, ${repeats} repeats`);
    }
    capped++;
  }
  assert.ok(capped >= 1, 'at least one capped builder was actually checked, not all skipped');
  // Guard against this section going vacuous: if no capped builder in the corpus actually exceeds
  // its cap, 8c never ran and the coverage-aware cut is unproven. That is exactly how the original
  // §8 passed for years while grammar sampled at random.
  assert.ok(sawCap,
    'no capped builder in the corpus exceeds its 14-question cap, so the unsolved-first cut was ' +
    'never exercised — §8c is vacuous against this data and needs a larger fixture');
  console.log(`  uncapped (${uncapped}): play build == universe · capped (${capped}): deriving build == universe, cut is unsolved-first`);
  // `APP.cur.lessonIdx` is set above because the coverage machinery reads it: assembleCoverageRound
  // keys the solved-set with a bare `qid(ex)`, which resolves the lesson id through APP.cur — and
  // real play sets `C.lessonIdx = idx` immediately before calling buildExercises (openLesson), so
  // this mirrors production rather than inventing a state.
  //
  // Reset to 0 — the client's own default (`APP.cur` is declared with `lessonIdx:0`) — because it
  // MUST NOT leak: _exFlagTarget resolves a flagged item through the same fallback, so an index
  // pointing past a later section's shorter fixture silently stops flagged items being withheld.
  // Restore the field, never `delete APP.cur`: the object carries the whole round state, and the
  // following section depends on the default index existing.
  C.run('APP.cur.lessonIdx = 0; true;', 'reset-cur');
}

// ── Only human decisions withhold an item (v71_l) ──────────────────────────
// The policy this release settled, pinned end to end. `item.qc` is an unreviewed MODEL
// suggestion: the learner is still asked the question AND it still counts toward coverage.
// `userFlag`/`userDelete` are HUMAN decisions: the item is neither asked nor counted.
//
// Before v71_l all three call sites spelled the rule differently — the play filter withheld
// userFlag|qc|userDelete but only in the STATIC build, the denominator withheld the same triple
// in both builds, and markSolved withheld userFlag alone. So one QC pass removed 450 items from
// the denominators of 157 lessons (median 38% of a flagged lesson, 41 lessons over half) while
// live learners were still being asked those very questions.
{
  const seedTopic = (lessons) => C.run(`
    APP.lessonData = { topic:'FlagT', lang:'de', srcLang:'en', lessons: ${JSON.stringify(lessons)} };
    APP.lang='de'; APP.srcLang='en';
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, learned:{} }; APP.progress.solved['FlagT'] = {};
    APP._teacherMode = false; APP.muted = false;
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-flags');

  const probe = () => C.run(`(function(){
    const L = APP.lessonData.lessons[0];
    APP._derivingUniverse = true;
    const asked = {};
    for (let n = 0; n < 30; n++) for (const ex of buildExercises(0)) {
      const it = _resolveExItem(ex, L); if (it && it.target) asked[it.target] = true;
    }
    APP._derivingUniverse = false;
    const uni = _lessonQidUniverse(0);
    const counted = {};
    for (const t of ['Clean','Qc','Flagged','Deleted']) {
      const it = (L.vocab||[]).find(v => v.target === t); if (!it) continue;
      APP._derivingUniverse = true;
      const ex = buildExercises(0).find(e => { const s = _resolveExItem(e, L); return s && s.target === t; });
      APP._derivingUniverse = false;
      counted[t] = !!(ex && uni.has(qid(ex, L.id)));
    }
    return { asked, counted, uniSize: uni.size };
  })()`);

  seedTopic([{ id: 'L1', vocab: [
    { target: 'Clean',   source: 'clean' },
    { target: 'Qc',      source: 'qc',      qc: { sug: 'maybe wrong', field: 'target' } },
    { target: 'Flagged', source: 'flagged', userFlag: { comment: 'broken' } },
    { target: 'Deleted', source: 'deleted', userDelete: 1 },
  ] }]);
  const r = probe();

  // A model's suggestion is inert for the learner.
  assert.ok(r.asked.Qc, 'a QC-suggested item is STILL ASKED — a model opinion is not a decision');
  assert.strictEqual(r.counted.Qc, true, 'and it still counts toward coverage');
  // A human's decision is not.
  assert.ok(!r.asked.Flagged, 'a human-flagged item is NOT asked');
  assert.ok(!r.asked.Deleted, 'nor is one marked for deletion');
  assert.strictEqual(r.counted.Flagged, false, 'and neither counts toward coverage');
  // The clean control, so the probe cannot pass by finding nothing at all.
  assert.ok(r.asked.Clean && r.counted.Clean === true, 'a clean item is asked and counted');

  // markSolved must agree with both: recording a withheld solve would credit a question that is
  // not in the universe, which is how a learner ends up above 100%.
  const solved = C.run(`(function(){
    const L = APP.lessonData.lessons[0]; APP._derivingUniverse = true;
    const all = buildExercises(0); APP._derivingUniverse = false;
    const pick = t => all.find(e => { const s = _resolveExItem(e, L); return s && s.target === t; });
    const qc = pick('Qc');
    return { qc: qc ? markSolved(qc) !== '' : null };
  })()`);
  assert.strictEqual(solved.qc, true, 'markSolved records a QC-suggested item like any other');

  // Teacher mode still sees everything — the flag content has to be reviewable.
  C.run(`APP._teacherMode = true; if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();`);
  const teacher = probe();
  assert.ok(teacher.asked.Flagged, 'a teacher is still shown flagged items so they can be fixed');
  C.run(`APP._teacherMode = false;`);
  console.log('  withheld rule: qc asked+counted, userFlag/userDelete neither, teacher sees all');
}

console.log('unit-replay-focus: ALL PASSED');
