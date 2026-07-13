// unit-identical-ratio.test.js
// v53_g — the "model ignored the source language" blocker.
//
// It used to reject a lesson with more than 2 identical source/target vocab items. A bare COUNT
// conflates two different phenomena. Measured over all 267 topics (98 lessons in non-close pairs
// contain at least one identical item):
//
//   real model failure  100% (8/8) "History of Luxembourg" · 100% (8/8) "Grandmas Doughs"
//                        80% (4/5) "a poem"                 ·  75% (6/8) "Cremant vs. Champagne" ×2
//   loanwords / nouns    40% "performance, DJ" · 38% "pasta, tagliatelle, risotto"
//                        38% "café, fans, notes" · 38% "Crémant, Prosecco, Aroma" · ≤25% the rest
//
// The distribution is bimodal with NOTHING between 40% and 75%. A ratio cut anywhere in that band
// separates them; 0.6 sits mid-gap. The old rule caught all 5 failures but also rejected 4 good
// loanword lessons, which were regenerated for nothing.
//
// This test calibrates against the SHIPPED corpus, so the thresholds cannot drift silently: if
// someone widens them, the real failures stop being caught; if they tighten them, real loanword
// lessons start being thrown away.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));

// Pull the live constants out of server.js — the test must not hardcode its own copy.
const MIN_ITEMS = Number((server.match(/const IDENTICAL_MIN_ITEMS = ([\d.]+);/) || [])[1]);
const MIN_RATIO = Number((server.match(/const IDENTICAL_MIN_RATIO = ([\d.]+);/) || [])[1]);
assert.ok(Number.isFinite(MIN_ITEMS) && Number.isFinite(MIN_RATIO), 'thresholds are declared as named constants');
assert.ok(MIN_RATIO > 0.4 && MIN_RATIO < 0.75,
  `ratio sits inside the empirical gap between the highest loanword lesson (40%) and the lowest failure (75%) — got ${MIN_RATIO}`);
assert.ok(MIN_ITEMS >= 2, 'a floor prevents 1–2 hits in a tiny lesson from tripping the rule');

// The blocker must be a ratio, not a bare count.
assert.ok(/const _blockVocab = vocabSame\.length >= IDENTICAL_MIN_ITEMS && _ratio >= IDENTICAL_MIN_RATIO;/.test(server),
  'the vocab rule is count-floor AND ratio');
assert.ok(!/if \(vocabSame\.length > 2\)/.test(server), 'the bare count rule is gone');
// The SENTENCE rule is deliberately untouched: zero identical sentences exist in a non-close pair,
// so there is no evidence to relax it, and a whole identical sentence is a much stronger signal.
assert.ok(/if \(sentSame\.length > 1\)/.test(server), 'the sentence rule is unchanged (no evidence to relax it)');

const listSrc = server.match(/const CLOSE_LANG_PAIRS = \[[\s\S]*?\n\];/)[0];
const CLOSE = new Function(listSrc + '\nreturn CLOSE_LANG_PAIRS;')();
const isClose = (a, b) => a === b || CLOSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
const same = (a) => a && a.target && a.source && a.target.trim().toLowerCase() === a.source.trim().toLowerCase();
const blocks = (k, n) => k >= MIN_ITEMS && n > 0 && (k / n) >= MIN_RATIO;

// ── Replay the shipped corpus through the rule ──────────────────────────────
const rows = [];
for (const t of lessons.topics) {
  if (isClose(t.lang, t.srcLang)) continue;
  for (const l of (t.lessons || [])) {
    const v = l.vocab || [];
    if (v.length < 2) continue;
    const k = v.filter(same).length;
    if (k) rows.push({ topic: t.topic, k, n: v.length, r: k / v.length });
  }
}
assert.ok(rows.length > 50, `the corpus really does exercise this rule (${rows.length} lessons)`);

// Every lesson at or above the failure band must block; every one at or below the loanword band must not.
const FAILURE_BAND = rows.filter(r => r.r >= 0.75);
const LOANWORD_BAND = rows.filter(r => r.r <= 0.40);
assert.strictEqual(FAILURE_BAND.length, 5, `the 5 known model failures are present (got ${FAILURE_BAND.length})`);
assert.ok(LOANWORD_BAND.length >= 90, `the loanword bulk is present (${LOANWORD_BAND.length})`);
assert.strictEqual(rows.filter(r => r.r > 0.40 && r.r < 0.75).length, 0,
  'the empirical gap is still empty — if a lesson lands in it, the threshold needs re-deriving');

FAILURE_BAND.forEach(r => assert.ok(blocks(r.k, r.n),
  `model failure blocked: ${r.topic} ${r.k}/${r.n}`));
LOANWORD_BAND.forEach(r => assert.ok(!blocks(r.k, r.n),
  `loanword lesson kept: ${r.topic} ${r.k}/${r.n} (${Math.round(r.r * 100)}%)`));

// The old rule really was over-blocking: prove the regression this change fixes.
const oldRule = (k) => k > 2;
const wronglyBlockedBefore = LOANWORD_BAND.filter(r => oldRule(r.k));
assert.ok(wronglyBlockedBefore.length >= 4,
  `the old count rule rejected good loanword lessons (${wronglyBlockedBefore.length})`);
wronglyBlockedBefore.forEach(r => assert.ok(!blocks(r.k, r.n), `now kept: ${r.topic} ${r.k}/${r.n}`));

// ── Shape checks the corpus cannot cover ────────────────────────────────────
assert.ok(blocks(3, 3), '3/3 (100%) blocks');
assert.ok(blocks(8, 8), '8/8 blocks');
assert.ok(!blocks(2, 2), '2/2 is below the item floor — too small to judge');
assert.ok(!blocks(2, 3), '2/3 is below the item floor');
assert.ok(!blocks(3, 8), '3/8 (38%) — loanwords, kept');
assert.ok(!blocks(4, 10), '4/10 (40%) — kept');
assert.ok(blocks(6, 8), '6/8 (75%) blocks');
assert.ok(!blocks(0, 8), 'no identical items → never blocks');
assert.ok(!blocks(3, 0), 'empty lesson → no divide-by-zero, never blocks');

// Close pairs are exempt from the whole check, ratio or not.
assert.ok(isClose('de', 'nl') && isClose('de', 'de') && !isClose('it', 'en'),
  'close-pair exemption still gates the rule');

console.log(`  identical-item rule: k>=${MIN_ITEMS} && ratio>=${MIN_RATIO}`);
console.log(`  corpus replay: ${rows.length} lessons — ${FAILURE_BAND.length} failures blocked, ${LOANWORD_BAND.length} loanword lessons kept, gap 40–75% empty`);
console.log(`  the old count rule would have wrongly rejected ${wronglyBlockedBefore.length} of them`);
console.log('unit-identical-ratio: ALL PASSED');
