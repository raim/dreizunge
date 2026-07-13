// unit-story-stamp.test.js
// v53_d — story provenance. Audit of what existed BEFORE this change (verified against the shipped
// 267-topic corpus, not from memory):
//   • the story DOES log its model, as a `[model] Story (...)` prefix (an earlier audit grepped for
//     the word "Model" and missed it);
//   • the story DOES record a model, but only at TOPIC level in `generationStats.models.story`;
//   • that field is a recent addition: 16 of 267 topics have it, 249 have `generationStats` without
//     it, and 2 have no `generationStats` at all (the early-save path). None can be backfilled.
//   • `models.story === null` means "no model wrote it" — all 11 such topics are `userStory: true`.
//     Correct, but indistinguishable from "unknown" for a future "sort by models used".
// So the gap was never "the story is unstamped". It was: no PER-ARTEFACT stamp (no ms / tokens / at,
// unlike every lesson's `_genMeta` and the storyline's `summaryMeta`), and null was overloaded.
// This adds `topic.storyMeta`, and makes `buildGenMeta`'s `model` required so no future caller can
// be silently mis-stamped with the lesson model.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. buildGenMeta requires a model; no site relies on a default ────────────
assert.ok(/if \(!o\.model\) throw new Error/.test(server), 'buildGenMeta throws without a model');
assert.ok(!/model: o\.model \|\| OLLAMA_LESSON_MODEL/.test(server), 'the silent lesson-model default is gone');
const calls = server.match(/buildGenMeta\(\{[^}]*/g) || [];
assert.ok(calls.length >= 10, `buildGenMeta call sites (${calls.length})`);
calls.forEach(c => assert.ok(/model:/.test(c), `names a model: ${c.slice(0, 60).replace(/\n/g, ' ')}`));

// The add-lesson fallback must not claim the lesson model for a lesson it did not generate.
assert.ok(/type: result\.lesson\.type, model: '\(unknown\)'/.test(server),
  "the add-lesson _genMeta fallback stamps '(unknown)', not the lesson model");

// ── 2. Both story paths are stamped, and distinguishably ────────────────────
assert.ok(/_storyMeta = buildGenMeta\(\{ type: 'story', model: '\(user-provided\)'/.test(server),
  "a pasted story is stamped '(user-provided)', not left null");
assert.ok(/_storyMeta = buildGenMeta\(\{ type: 'story', model: OLLAMA_MODEL, t0/.test(server),
  'a generated story is stamped with the STORY model (not the lesson model) and timed from t0');
assert.ok(/promptTokens, completionTokens \}\);/.test(server), 'the generated story records its tokens');

// ── 3. Persisted on BOTH upserts ─────────────────────────────────────────────
// The first upsert is the "save story early, before lesson generation, so the story is never lost"
// path. A stamp written only on the final upsert would be missing for exactly the topics whose
// lesson generation crashed — the ones where provenance matters most.
const persisted = server.match(/\.\.\.\(_storyMeta \? \{ storyMeta: _storyMeta \} : \{\}\),/g) || [];
assert.strictEqual(persisted.length, 2, 'storyMeta persisted on the early-save AND the final upsert');
const earlyIdx = server.indexOf('Save story early');
assert.ok(earlyIdx > 0, 'the early-save comment is still there');
assert.ok(server.indexOf('storyMeta: _storyMeta', earlyIdx) > earlyIdx, 'early save carries the stamp');

// ── 4. The story still logs its model to the console ─────────────────────────
assert.ok(/console\.log\(`\s*\[\$\{OLLAMA_MODEL\}\] Story \(/.test(server),
  'story generation logs [model] Story (...)');

// ── 5. The topic-level generationStats.models is untouched (additive change) ──
assert.ok(/models: \{ story: _storyModel, translation: _translationModel, lessons: OLLAMA_LESSON_MODEL \}/.test(server),
  'generationStats.models still recorded — storyMeta is additive, not a replacement');

// ── 6. The shipped corpus still parses and its invariants hold ───────────────
const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const withModels = lessons.topics.filter(t => t.generationStats && t.generationStats.models);
const nullStory = withModels.filter(t => !t.generationStats.models.story);
assert.ok(nullStory.every(t => t.userStory),
  'every topic whose story model is null is a user-provided story (null never means "unknown")');

// ── 7. v53_e: the corpus is backfilled. Provenance invariants ────────────────
// `backfill-provenance.js` derived the story model from `generationStats.model` (whose first element
// is provably the story model — see the script's --verify). Values that came from the user's memory
// rather than the record are marked, so inferred data can never pass for recorded data.
const SENTINELS = ['(user-provided)', '(unknown)'];
const mig0 = fs.readFileSync(path.join(ROOT, 'backfill-provenance.js'), 'utf8');
assert.ok(lessons.topics.every(t => t.storyMeta), 'every topic now carries storyMeta');
for (const t of lessons.topics) {
  const sm = t.storyMeta;
  assert.strictEqual(sm.type, 'story', 'storyMeta.type is story');
  assert.ok(sm.model, 'storyMeta names a model or a sentinel');
  assert.ok(sm.source, `storyMeta records where the value came from (${t.topic})`);
  // A user-provided story must never be attributed to a model, in either direction.
  if (t.userStory) assert.strictEqual(sm.model, '(user-provided)', `userStory → sentinel (${t.topic})`);
  if (sm.model === '(user-provided)') assert.ok(t.userStory, `sentinel → userStory (${t.topic})`);
  // Backfilled rows are flagged; live rows (written by server.js at generation time) are not.
  if (sm.backfilled) assert.ok(typeof sm.source === 'string' && sm.source.length, 'backfilled rows say why');
  // No untagged real model names survived: either a sentinel, or name:tag.
  if (!SENTINELS.includes(sm.model)) assert.ok(sm.model.includes(':'), `model is tagged: ${sm.model}`);
}
// ── 7b. v53_f: `origin` — WHERE the text came from, orthogonal to `model` (WHO wrote it) ────
// A chapter of an uploaded book is `userStory` but is NOT "pasted by the user": it has an author and
// (eventually) a licence. Collapsing both into '(user-provided)' lost exactly that distinction.
const ORIGINS = ['generated', 'dialect-rewrite', 'file-upload', 'user-pasted', 'unknown'];
const t2s = {};
(lessons.storylines || []).forEach(sl => (sl.chapters || []).forEach(id => { t2s[id] = sl; }));
for (const t of lessons.topics) {
  const sm = t.storyMeta;
  assert.ok(sm.origin, `storyMeta.origin present (${t.topic})`);
  assert.ok(ORIGINS.includes(sm.origin), `origin is one of the known values: ${sm.origin}`);
  // No model authored a pasted or uploaded text.
  if (sm.origin === 'file-upload' || sm.origin === 'user-pasted') {
    assert.strictEqual(sm.model, '(user-provided)', `${sm.origin} → no model (${t.topic})`);
    assert.ok(t.userStory, `${sm.origin} → userStory (${t.topic})`);
  }
  // …and conversely, '(user-provided)' is never used for a text a model wrote.
  if (sm.model === '(user-provided)') {
    assert.ok(['file-upload', 'user-pasted'].includes(sm.origin), `sentinel → upload/pasted (${t.topic})`);
  }
  // A file upload must name its file, and it must agree with the storyline's record.
  if (sm.origin === 'file-upload') {
    assert.ok(sm.sourceFile, `file-upload names its sourceFile (${t.topic})`);
    assert.strictEqual(sm.sourceFile, t2s[t.id] && t2s[t.id].sourceFile, 'sourceFile matches the storyline');
  } else {
    assert.ok(!sm.sourceFile, `only a file-upload carries a sourceFile (${t.topic})`);
  }
  // A generated / rewritten story must name a real model, never a sentinel.
  if (sm.origin === 'generated' || sm.origin === 'dialect-rewrite') {
    assert.notStrictEqual(sm.model, '(user-provided)', `${sm.origin} → a model wrote it (${t.topic})`);
  }
}
const byOrigin = {};
lessons.topics.forEach(t => { byOrigin[t.storyMeta.origin] = (byOrigin[t.storyMeta.origin] || 0) + 1; });
assert.ok(byOrigin['file-upload'] > 0 && byOrigin['user-pasted'] > 0,
  'the corpus really does contain both uploads and pasted texts (the distinction is not theoretical)');

// The live server must stamp origin too, or the migration becomes load-bearing forever.
assert.ok(/_storyMeta\.origin = 'generated';/.test(server), 'server stamps origin on a generated story');
assert.ok(/_storyMeta\.origin = 'user-provided';/.test(server), 'server stamps origin on a pasted story');
assert.ok(/t\.storyMeta\.origin = 'file-upload';/.test(server),
  'the sourceFile post-pass refines user-provided → file-upload');
assert.ok(/const t = findSavedById\(cid\);/.test(server),
  'the post-pass looks chapters up by ID (findSaved takes a topic NAME)');

const asserted = lessons.topics.filter(t => /user-asserted/.test(t.storyMeta.source));
const unknown  = lessons.topics.filter(t => t.storyMeta.model === '(unknown)');
assert.ok(asserted.length <= 6, `user-asserted values stay rare (${asserted.length}) — the record does the work`);
assert.ok(unknown.every(t => !t.generationStats || !t.generationStats.model),
  "'(unknown)' only where the record genuinely says nothing");
// --set-model is a per-topic user assertion for stories the record cannot explain.
assert.ok(/--set-model/.test(mig0), 'the migration supports a per-topic user assertion');
assert.ok(/user-asserted \(--set-model\)/.test(mig0), 'and marks it as asserted, never as recorded');
assert.ok(/function classifyOrigin\(t\)/.test(mig0), 'the migration classifies origin from the data');

// Backfilled generationStats.models is only written for single-model labels (all three roles equal).
for (const t of withModels) {
  if (!t.generationStats.modelsSource) continue;
  const label = String(t.generationStats.model);
  assert.ok(!label.includes(' / '), `models backfilled only for single-model labels (${label})`);
  const m = t.generationStats.models;
  assert.strictEqual(m.translation, m.lessons, 'single-model label → translation === lessons');
}

// ── 8. The migration script's safety rails ──────────────────────────────────
const mig = fs.readFileSync(path.join(ROOT, 'backfill-provenance.js'), 'utf8');
assert.ok(/if \(!WRITE\) \{[^}]*dry run/.test(mig), 'dry run is the default');
assert.ok(/copyFileSync\(FILE, FILE \+ '\.bak'\)/.test(mig), 'a .bak is written before saving');
assert.ok(/refusing to write while topics are unstamped/.test(mig), 'refuses to write with unstamped topics');
assert.ok(/refusing to write with untagged model names/.test(mig), 'refuses to write with untagged names');
assert.ok(/if \(t\.storyMeta && !\(override/.test(mig), 'idempotent: never re-derives a model it already wrote');
assert.ok(/nothing to do — already up to date/.test(mig), 'a no-op run says so and does not rewrite the file');
// A flag with a missing/malformed value must FAIL, not be silently ignored: on a data migration a
// quietly-dropped --resolve looks exactly like one that was never needed. (`--resolve --write` also
// used to swallow the next flag.)
assert.ok(/function flagValue\(flag, i\)/.test(mig), 'flag values are validated');
assert.ok(/val\.startsWith\('--'\)/.test(mig), 'a flag cannot swallow the next flag as its value');
assert.ok(/process\.exit\(2\)/.test(mig), 'malformed flags exit non-zero');
// --verify must ignore rows the script itself wrote: a --resolve'd tag can never equal the untagged
// label, so including them reports false mismatches on every run after the backfill.
assert.ok(/&& !t\.generationStats\.modelsSource\)/.test(mig),
  '--verify excludes backfilled rows (its own output is not evidence)');

const dist = {};
lessons.topics.forEach(t => { dist[t.storyMeta.model] = (dist[t.storyMeta.model] || 0) + 1; });
console.log(`  story stamp: both paths, both upserts; buildGenMeta model required (${calls.length} sites)`);
console.log(`  corpus: ${lessons.topics.length} topics stamped — ` +
  Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(', '));
console.log(`  ${asserted.length} user-asserted, ${unknown.length} unknown, rest derived from the record`);
console.log('unit-story-stamp: ALL PASSED');
