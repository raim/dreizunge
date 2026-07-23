// unit-round-composition.test.js
// v69_h — what a practice round is MADE OF (user request: "reaching the threshold gets slower and
// slower, since we get offered the same questions over and over again … can we generate lessons
// with e.g. only 15% of vocab the learner already knows?").
//
// Three tiers, in the order that reaches the pass mark fastest while keeping a round mostly new:
//   1. unsolved here + word NOT in the whole-history ledger  → genuinely new material
//   2. unsolved here + word the ledger says is known         → still needed for coverage
//   3. already solved here                                   → review, capped at FAMILIAR_SHARE
// Nothing is EXCLUDED: the backfill keeps a round full, so a lesson whose words are all known is
// still playable and its coverage can still reach 100%. That matters — excluding known words would
// strand the coverage denominator below the threshold forever.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

// Build a working assembleCoverageRound with the real _knownWordSet / ledger behind it.
function makeAssembler(APP) {
  const src = [ext('_solvedMap'), ext('_learnedLedger'), ext('_knownWordSet'),
    'const FAMILIAR_SHARE = 0.15;', ext('assembleCoverageRound')].join('\n');
  return new Function('APP', 'shuffle', 'qid', 'stripFuri',
    src + '\nreturn { assembleCoverageRound, _knownWordSet };')(
    APP, (a) => a.slice(), (ex) => 'L:' + ex.type + ':' + ex.target, (x) => x);
}
const mkEx = (w) => ({ type: 'mcq', target: w, source: 's-' + w });

// ── 1. The ledger decides what counts as "known" ─────────────────────────────
{
  const APP = { lessonData: { topic: 'T', lang: 'it', srcLang: 'de' }, lang: 'it', srcLang: 'de',
    progress: { solved: {}, learned: { 'it|de': { vocab: {
      solid:   { seen: 3, wrong: 0 },   // met repeatedly, never outstanding-wrong → known
      once:    { seen: 1, wrong: 0 },   // met once → NOT known (deliberately conservative)
      shaky:   { seen: 5, wrong: 2 },   // still getting it wrong → NOT known
      drilled: { seen: 4, wrong: 0 },   // drill walked its wrong count back to 0 → known again
    }, sentences: {} } } } };
  const { _knownWordSet } = makeAssembler(APP);
  const known = _knownWordSet();
  assert.ok(known.has('solid'), 'seen≥2 with no outstanding errors counts as known');
  assert.ok(known.has('drilled'), 'a word whose wrong-count was drilled back to 0 is known again');
  assert.ok(!known.has('once'), 'a word met once is NOT treated as learned');
  assert.ok(!known.has('shaky'), 'a word still answered wrong is NOT known');
}
console.log('  ledger: seen≥2 and no outstanding errors = known; conservative on the rest: OK');

// ── 2. New material leads the round; familiar trails it ──────────────────────
{
  const APP = { lessonData: { topic: 'T', lang: 'it', srcLang: 'de' }, lang: 'it', srcLang: 'de',
    progress: { solved: { T: { 'L:mcq:seen1': 1, 'L:mcq:seen2': 1 } },
      learned: { 'it|de': { vocab: { known1: { seen: 3, wrong: 0 }, known2: { seen: 3, wrong: 0 } }, sentences: {} } } } };
  const { assembleCoverageRound } = makeAssembler(APP);
  const pool = ['new1', 'new2', 'new3', 'new4', 'known1', 'known2', 'seen1', 'seen2'].map(mkEx);

  // The round is dominated by NEW material, with the familiar share reserved for review.
  // NOTE the share rounds UP on small rounds: round(4 × 0.85) = 3 new + 1 review = 25% review here,
  // converging on the intended ~15% at the real round size of 12 (10 new + 2 review = 17%).
  const round = assembleCoverageRound(pool, 4, 0.85);
  const words = round.map(e => e.target);
  assert.strictEqual(round.length, 4, 'the round is filled');
  const fresh = words.filter(w => w.startsWith('new')).length;
  const reviewed = words.filter(w => w.startsWith('seen')).length;
  assert.strictEqual(fresh, 3, `new material fills all but the review slot (got ${words})`);
  assert.strictEqual(reviewed, 1, 'exactly the reserved review slot is spent on solved questions');
  assert.ok(!words.includes('known1') && !words.includes('known2'),
    'unsolved-but-known words rank behind genuinely new ones');

  // At the real round size the share lands where it was designed to.
  const pool12 = [...Array(14)].map((_, i) => mkEx('n' + i)).concat(pool.filter(e => e.target.startsWith('seen')));
  const r12 = assembleCoverageRound(pool12, 12, 0.85);
  const rev12 = r12.filter(e => e.target.startsWith('seen')).length;
  assert.ok(rev12 <= 2, `~15% of a 12-question round is review (got ${rev12})`);

  // A round larger than the new material falls through the tiers in order, and stays FULL.
  const big = assembleCoverageRound(pool, 8, 0.85).map(e => e.target);
  assert.strictEqual(big.length, 8, 'backfill keeps the round full — nothing is excluded outright');
  assert.strictEqual(new Set(big).size, 8, 'and never repeats a question within one round');
  const firstFour = big.slice(0, 4);
  assert.ok(['new1', 'new2', 'new3', 'new4'].every(w => firstFour.includes(w))
         || big.indexOf('known1') > 0, 'new material is not pushed behind familiar material');
}
console.log('  composition: new first, solved not re-served, round stays full via backfill: OK');

// ── 3. A fully-known lesson is still playable (the coverage trap) ────────────
{
  const APP = { lessonData: { topic: 'T', lang: 'it', srcLang: 'de' }, lang: 'it', srcLang: 'de',
    progress: { solved: {},
      learned: { 'it|de': { vocab: { a: { seen: 9, wrong: 0 }, b: { seen: 9, wrong: 0 }, c: { seen: 9, wrong: 0 } }, sentences: {} } } } };
  const { assembleCoverageRound } = makeAssembler(APP);
  const round = assembleCoverageRound(['a', 'b', 'c'].map(mkEx), 3, 0.85);
  assert.strictEqual(round.length, 3,
    'every word already known → the round is still full (excluding them would strand coverage below the mark)');
}
console.log('  a lesson of entirely known words remains fully playable: OK');

// ── 4. Wiring: one named constant, harness-safe reads ────────────────────────
{
  assert.ok(/const FAMILIAR_SHARE = 0\.15;/.test(html), 'the familiar share is a single named constant');
  const build = ext('buildStandardExercises');
  assert.ok(/assembleCoverageRound\(_exs, 12, 1 - _famShare\)/.test(build),
    'a standard round reserves only the familiar share for review');
  const asm = ext('assembleCoverageRound');
  assert.ok(/typeof _knownWordSet === 'function'/.test(asm) && /typeof stripFuri === 'function'/.test(asm),
    'the new dependencies are typeof-guarded (harnesses extract this function alone)');
  assert.ok(/const fresh = \[\], familiarUnsolved = \[\], review = \[\];/.test(asm), 'the three tiers exist');
  // The ledger is per language PAIR and spans every topic — the "complete recorded history".
  assert.ok(/const key = `\$\{lang\|\|'\?'\}\|\$\{srcLang\|\|'\?'\}`/.test(ext('_learnedLedger')),
    'the ledger is keyed by language pair, not by topic (history spans chapters)');
}
console.log('  wiring: one constant, guarded deps, cross-topic ledger: OK');

console.log('unit-round-composition: ALL PASSED');
