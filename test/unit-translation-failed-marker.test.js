// unit-translation-failed-marker.test.js — v91 line.
//
// ⚠️ WHAT THIS GUARDS IS A FIXTURE, NOT A FEATURE. Nothing in the app reads
// `translationMeta.origin` yet. This file exists so that the evidence for a measured, corrected
// finding survives in the tree instead of in a session scratchpad, and so the NEXT session cannot
// re-make the mistake the finding is about.
//
// ⚠️⚠️ THE MISTAKE, because it is the whole point. Two chapters were found whose translation had
// failed, leaving a chapter saved with no `storyTranslation`. The obvious detector — "topics whose
// `storyTranslation` is empty" — was tried first and reported **268 of 362 topics**, and that number
// was written into the roadmap as a months-long defect rate before it was checked. It is nothing of
// the kind: `storyTranslation` is a field that ARRIVED, reaching 0-3% of topics before July 2026,
// 51% in July and 100% in August. Almost every "hit" simply predates the feature.
// **The real marker is `translationMeta.origin === 'failed'`, which matched exactly 2 topics.**
//
// ⚠️ Both are now DELETED from the live store at the user's request, so this fixture is the only
// remaining evidence of the shape. A future session must NOT conclude from a clean corpus that the
// failure mode does not exist.
//
// ⚠️ §3 IS THE ONE THAT EARNS ITS KEEP. §2 proves the good marker works, which a wrong marker would
// also pass on a friendly fixture. §3 proves the NAIVE marker is WRONG, against the very shapes that
// fooled the first analysis — that is the assertion that would fail if someone "simplified" a future
// check to an emptiness test.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FIX = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'translation-failed-topics.json'), 'utf8'));

// ── 1. The fixture is intact and non-vacuous ──────────────────────────────────────────────────
{
  assert.strictEqual(FIX.markerField, 'translationMeta.origin', 'the fixture still states its marker');
  assert.strictEqual(FIX.markerValue, 'failed');
  assert.strictEqual(FIX.failures.length, 2,
    'both measured failures are present — the de-it duplicate and the en-de chain stub');
  assert.ok(Object.keys(FIX.notFailures).length >= 5,
    'and at least five NEGATIVE shapes, without which §3 could not be written');
  for (const t of FIX.failures) {
    assert.ok(t.id && t.generatedAt && t.story, 'each failure keeps enough to be recognisable');
  }
  assert.ok(FIX.note.length > 400, 'the note explaining why this file exists has not been trimmed away');
}
console.log('  fixture intact: 2 real failures, ' + Object.keys(FIX.notFailures).length + ' look-alikes: OK');

// ── 2. ⭐ THE MARKER SEPARATES THEM ────────────────────────────────────────────────────────────
const isFailed = t => ((t && t.translationMeta) || {}).origin === 'failed';
{
  for (const t of FIX.failures) {
    assert.strictEqual(isFailed(t), true,
      `${t.srcLang}->${t.lang} is a real failure and the marker must catch it`);
  }
  for (const [name, t] of Object.entries(FIX.notFailures)) {
    assert.strictEqual(isFailed(t), false,
      `${name} is NOT a failure (origin: ${(t.translationMeta || {}).origin}) and the marker must not flag it`);
  }
}
console.log('  translationMeta.origin === "failed" catches both and flags none of the look-alikes: OK');

// ── 3. ⚠️ THE NAIVE MARKER IS WRONG — this is the assertion that matters ───────────────────────
// An emptiness test does not merely miss things: it FIRES on healthy topics. Two of the five
// negatives have an empty `storyTranslation` for entirely legitimate reasons — one predates the
// feature, one had the translation deliberately skipped because source and target share a model.
{
  const isEmpty = t => !String((t && t.storyTranslation) || '').trim();
  const falsePositives = Object.entries(FIX.notFailures).filter(([, t]) => isEmpty(t)).map(([n]) => n);
  assert.ok(falsePositives.length >= 2,
    '⚠️ non-vacuity: the fixture must CONTAIN healthy topics with an empty storyTranslation, or §3 ' +
    'proves nothing. Found: ' + JSON.stringify(falsePositives));
  for (const name of falsePositives) {
    assert.strictEqual(isFailed(FIX.notFailures[name]), false,
      `${name} has an empty storyTranslation and is still NOT a failure — which is exactly why ` +
      'emptiness cannot be the test');
  }
  assert.notDeepStrictEqual(
    FIX.failures.map(isEmpty).concat(Object.values(FIX.notFailures).map(isEmpty)),
    FIX.failures.map(isFailed).concat(Object.values(FIX.notFailures).map(isFailed)),
    '⚠️ the two predicates must DISAGREE on this fixture. If they ever agree, the fixture has lost ' +
    'the look-alikes that make it worth keeping, and the lesson it encodes is gone.');
}
console.log('  an emptiness test produces false positives on this fixture, and the marker does not: OK');

// ── 4. The secondary signature: no model call was ever made ───────────────────────────────────
// ⚠️ `absent` and `null` are DIFFERENT stored states and JSON.stringify erases the difference by
// dropping an undefined key — an earlier read used `|| null` and misreported `absent` as `null`.
// The fixture records the state as its own field for that reason; assert on that, not on the object.
{
  for (const t of FIX.failures) {
    const m = t.translationMeta;
    assert.strictEqual(m.model, '(none)', 'no model is named, because none was called');
    assert.strictEqual(m.ms, null, 'no duration was recorded');
    assert.strictEqual(m.promptTokens, 0, 'and no tokens were sent — the call never happened');
    assert.strictEqual(m.valid, 0);
  }
  const states = FIX.failures.map(t => t.generationStatsState);
  assert.ok(states.includes('absent'),
    'the en-de stub has NO generationStats key at all — the distinction this fixture records ' +
    'explicitly, since JSON cannot carry it');
  assert.ok(FIX.failures.some(t => t.lessons.length === 0),
    'one failure produced no lessons whatsoever');
}
console.log('  both failures carry the "no model call was made" signature: OK');

console.log('unit-translation-failed-marker: ALL PASSED');
