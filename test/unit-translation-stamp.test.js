// unit-translation-stamp.test.js
// v55_f — translation provenance. Same treatment the story got in v53_d/v53_e, scoped to what the
// record actually holds (audited against the shipped 267-topic corpus, not from memory):
//   • `generationStats.models.translation` already records WHICH model for 243/267 topics — unlike
//     the story's per-artefact ms/tokens, translation provenance was NOT wholly missing.
//   • The gap the roadmap named was the null-CONFLATION: `models.translation === null` meant BOTH
//     "the translation model == the story model so no separate pass ran" AND "unknown". 16 topics
//     were null.
//   • Only 2 topics carry a `storyTranslation` artefact and 2 a `userTranslation`; the rest either
//     ran a distinct translation model (recorded) or folded translation into the story model.
// So this adds `topic.translationMeta` (mirroring `storyMeta`): the live server stamps every
// generation path distinguishably, and `backfill-provenance.js` stamps the corpus so consumers can
// rely on it being present — with '(none)' for a positively-recorded no-pass, '(user-provided)' for
// a supplied translation, and '(unknown)' ONLY where the record has no models block at all.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. The live server stamps all four translation paths, distinguishably ─────
assert.ok(/let _translationMeta = null;/.test(server), 'a _translationMeta accumulator exists');
// generated: a distinct translation model ran
assert.ok(/_translationMeta = buildGenMeta\(\{ type: 'translation', model: OLLAMA_TRANSLATION_MODEL, t0,/.test(server),
  'a generated translation is stamped with the TRANSLATION model and timed from t0');
assert.ok(/_translationMeta\.origin = 'generated';/.test(server), 'generated translation stamps origin');
// failed: attempted but threw
assert.ok(/_translationMeta = buildGenMeta\(\{ type: 'translation', model: '\(none\)', valid: 0 \}\);[\s\S]{0,80}_translationMeta\.origin = 'failed';/.test(server),
  "a failed translation is stamped '(none)' with origin 'failed', distinct from never-attempted");
// user-provided: the user supplied it
assert.ok(/_translationMeta = buildGenMeta\(\{ type: 'translation', model: '\(user-provided\)'/.test(server),
  "a user-supplied translation is stamped '(user-provided)', not left null");
assert.ok(/_translationMeta\.origin = 'user-provided';/.test(server), 'user translation stamps origin');
// skipped: translation model == story model, no separate pass
assert.ok(/_translationMeta\.origin = 'skipped-same-model';/.test(server),
  "the same-model fold-in is stamped 'skipped-same-model', not null");

// ── 2. Persisted on BOTH upserts, beside storyMeta ───────────────────────────
// Like storyMeta, a stamp written only on the final upsert would be missing for exactly the topics
// whose lesson generation crashed after the early save.
const persisted = server.match(/\.\.\.\(_translationMeta \? \{ translationMeta: _translationMeta \} : \{\}\),/g) || [];
assert.strictEqual(persisted.length, 2, 'translationMeta persisted on the early-save AND the final upsert');

// ── 3. models.translation stays the record of WHICH model — the stamp is additive ─
// Deliberately NOT changed: `models.translation === null` remains correct for "no separate pass".
// The disambiguation lives in translationMeta.origin, exactly as storyMeta disambiguates
// models.story === null. (Mirrors unit-story-stamp §5.)
assert.ok(/models: \{ story: _storyModel, translation: _translationModel, lessons: OLLAMA_LESSON_MODEL \}/.test(server),
  'generationStats.models still recorded — translationMeta is additive, not a replacement');

// ── 4. The corpus is backfilled; invariants hold ─────────────────────────────
const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const TR_ORIGINS = ['generated', 'user-provided', 'skipped-same-model', 'failed', 'unknown'];
const SENTINELS = ['(none)', '(user-provided)', '(unknown)'];
assert.ok(lessons.topics.every(t => t.translationMeta), 'every topic now carries translationMeta');
for (const t of lessons.topics) {
  const tm = t.translationMeta;
  assert.strictEqual(tm.type, 'translation', 'translationMeta.type is translation');
  assert.ok(tm.model, 'translationMeta names a model or a sentinel');
  assert.ok(tm.source, `translationMeta records where the value came from (${t.topic})`);
  assert.ok(TR_ORIGINS.includes(tm.origin), `origin is a known value: ${tm.origin} (${t.topic})`);
  // A real model name is tagged (name:tag); otherwise it must be one of the sentinels.
  if (!SENTINELS.includes(tm.model)) assert.ok(tm.model.includes(':'), `model is tagged: ${tm.model}`);
  // origin ⇔ model coherence, both directions:
  if (tm.origin === 'generated')     assert.ok(!SENTINELS.includes(tm.model), `generated → a real model (${t.topic})`);
  if (tm.origin === 'user-provided') assert.strictEqual(tm.model, '(user-provided)', `user-provided → sentinel (${t.topic})`);
  if (tm.model === '(user-provided)') assert.strictEqual(tm.origin, 'user-provided', `sentinel → user-provided (${t.topic})`);
  if (tm.origin === 'skipped-same-model') assert.strictEqual(tm.model, '(none)', `skipped → (none) (${t.topic})`);
  if (tm.origin === 'unknown')       assert.strictEqual(tm.model, '(unknown)', `unknown → (unknown) (${t.topic})`);
  // A user-supplied translation must actually be present on the topic.
  if (tm.origin === 'user-provided') assert.ok(t.userTranslation, `user-provided translation exists (${t.topic})`);
  // '(unknown)' only where the record genuinely has no models block — never masking a known value.
  if (tm.model === '(unknown)') {
    assert.ok(!(t.generationStats && t.generationStats.models), `'(unknown)' only where models is absent (${t.topic})`);
    assert.ok(t.story, `'(unknown)' only where a story actually exists (${t.topic})`);
  }
  // A positively-recorded no-pass must have a models block that says translation is null.
  if (tm.origin === 'skipped-same-model') {
    assert.ok(t.generationStats && t.generationStats.models && t.generationStats.models.translation === null,
      `skipped-same-model only where models.translation is explicitly null (${t.topic})`);
  }
  // Backfilled rows are flagged (live server rows are not) — inferred data can't pass for recorded.
  if (tm.backfilled) assert.ok(typeof tm.source === 'string' && tm.source.length, 'backfilled rows say why');
}

// ── 5. Generated stamps agree with the recorded model ────────────────────────
// A backfilled 'generated' translation must name exactly the model in models.translation.
for (const t of lessons.topics) {
  const tm = t.translationMeta;
  if (tm.origin === 'generated' && tm.backfilled) {
    assert.strictEqual(tm.model, t.generationStats.models.translation,
      `backfilled generated model matches the record (${t.topic})`);
  }
}

// ── 6. The backfill script's safety rails cover translation too ──────────────
const mig = fs.readFileSync(path.join(ROOT, 'backfill-provenance.js'), 'utf8');
assert.ok(/function stampTranslationMeta\(t\)/.test(mig), 'translation stamping is a function');
assert.ok(/if \(t\.translationMeta\) \{ skippedTranslation\+\+; return false; \}/.test(mig),
  'idempotent: never re-stamps a translationMeta it already wrote');
// It must run on the story-SKIP path too (all 267 topics already have storyMeta → the story
// stamper `continue`s; a translation stamper only at the loop end would never fire).
const skipBlock = mig.slice(mig.indexOf('if (t.storyMeta && !(override'), mig.indexOf('if (override) {'));
assert.ok(/stampTranslationMeta\(t\);/.test(skipBlock), 'translation stamping runs on the story-skip path');
assert.ok(/!changedStory && !changedModels && !refinedOrigin && !changedTranslation/.test(mig),
  'the no-op guard counts translation changes (a translation-only run is not "nothing to do")');

const dist = {};
lessons.topics.forEach(t => { dist[t.translationMeta.model] = (dist[t.translationMeta.model] || 0) + 1; });
const byOrigin = {};
lessons.topics.forEach(t => { byOrigin[t.translationMeta.origin] = (byOrigin[t.translationMeta.origin] || 0) + 1; });
console.log(`  translation stamp: 4 server paths, both upserts, additive to models.translation`);
console.log(`  corpus: ${lessons.topics.length} topics stamped — ` +
  Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', '));
console.log(`  origins: ` + Object.entries(byOrigin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', '));
console.log('unit-translation-stamp: ALL PASSED');
