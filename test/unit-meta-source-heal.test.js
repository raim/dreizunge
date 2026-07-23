// unit-meta-source-heal.test.js
// v68.1 — storyMeta/translationMeta must ALWAYS carry `source` (where the value came from).
//
// The invariant is asserted over the whole corpus by unit-story-stamp §7 / unit-translation-stamp §4,
// but until v68.1 only backfill-provenance.js ever wrote `source` — the live server stamped
// model/origin/tokens and nothing else. Consequence: the suite was green only while the corpus was
// frozen; the user's first post-release generations (11 topics, 2026-07-21/22) turned it red.
// v68.1 (a) stamps `source: 'recorded at generation'` on every live write (guarded structurally in
// the two stamp tests), and (b) heals pre-v68.1 live-written rows at boot. This test covers (b)
// end-to-end, mirroring unit-lesson-id-integrity's boot harness.
//
// The heal label is provably accurate: backfill-provenance.js always sets `source`, so a stamp
// missing it can only have been written by the live server at generation time.
//
// v68.1b — the same pass also refines the OTHER pre-v68.1 live-write defect: pasted stories were
// stamped origin 'user-provided', which is outside the corpus vocabulary and only the upload
// post-pass refined away — so the first persisted PASTED story would have re-reddened the suite.
// Persisted legacy rows are classified the way backfill-provenance.js classified them: chapter of a
// sourceFile storyline → 'file-upload' (+sourceFile), otherwise → 'user-pasted'.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const tmp = path.join(os.tmpdir(), 'dz_metasrc_' + process.pid + '.json');
const backfilled = {
  type: 'story', model: 'qwen2.5:7b', attempts: null, valid: 1, rejected: 0, rejectReasons: null,
  promptTokens: 0, completionTokens: 0, ms: null, at: '2026-01-01T00:00:00.000Z',
  backfilled: true, source: 'generationStats.model[0]', origin: 'generated',
};
const liveNoSource = (type, model, origin) => ({
  type, model, attempts: null, valid: 1, rejected: 0, rejectReasons: null,
  promptTokens: 10, completionTokens: 10, ms: 5, at: '2026-07-22T00:00:00.000Z', origin,
});
const store = {
  schemaVersion: 30,
  storylines: [
    // A storyline WITH a sourceFile whose chapter kept the legacy origin (pre-v68.1 crash between
    // the chapter save and the sourceFile post-pass) — must be refined to 'file-upload'.
    { id: 'sl_up', chapters: ['tp_legacy_up'], sourceFile: 'Some Article.pdf' },
  ],
  flags: {},
  topics: [
    { // pre-v68.1 live-written topic: both stamps lack `source`  ← the reported breakage
      id: 'tp_live', topic: 'Live Topic', lang: 'it', srcLang: 'de', story: 'x',
      storyMeta: liveNoSource('story', '(user-provided)', 'file-upload'),
      translationMeta: liveNoSource('translation', 'qwen3.6:35b-a3b', 'generated'),
      lessons: [{ id: '1', vocab: [] }],
    },
    { // backfilled topic: already has a source — must be left byte-identical
      id: 'tp_back', topic: 'Backfilled Topic', lang: 'it', srcLang: 'de', story: 'y',
      storyMeta: backfilled,
      translationMeta: { ...backfilled, type: 'translation', source: 'generationStats.models.translation' },
      lessons: [{ id: '1', vocab: [] }],
    },
    { // topic with no stamps at all (pre-v53 shape) — the heal must not invent them
      id: 'tp_bare', topic: 'Bare Topic', lang: 'it', srcLang: 'de', story: 'z',
      lessons: [{ id: '1', vocab: [] }],
    },
    { // v68.1b — pre-v68.1 PASTED story: legacy origin 'user-provided', no storyline → 'user-pasted'
      id: 'tp_legacy_paste', topic: 'Legacy Pasted', lang: 'it', srcLang: 'de', story: 'p',
      storyMeta: liveNoSource('story', '(user-provided)', 'user-provided'),
      lessons: [{ id: '1', vocab: [] }],
    },
    { // v68.1b — legacy origin inside a sourceFile storyline → 'file-upload' + sourceFile
      id: 'tp_legacy_up', topic: 'Legacy Upload', lang: 'it', srcLang: 'de', story: 'u',
      storyMeta: liveNoSource('story', '(user-provided)', 'user-provided'),
      lessons: [{ id: '1', vocab: [] }],
    },
  ],
};
fs.writeFileSync(tmp, JSON.stringify(store));
try {
  try {
    execFileSync(process.execPath, ['-e', `
      process.env.LESSONS_FILE = ${JSON.stringify(tmp)};
      process.env.PORT = '0';
      try { require(${JSON.stringify(path.join(ROOT, 'server.js'))}); } catch(_) {}
      setTimeout(() => process.exit(0), 300);
    `], { timeout: 20000, stdio: 'ignore' });
  } catch (_) { /* the server may exit non-zero when told to stop; the file is what matters */ }

  const after = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const [live, back, bare, legacyPaste, legacyUp] = after.topics;

  // 1. Live-written stamps are healed, and only `source` was added.
  assert.strictEqual(live.storyMeta.source, 'recorded at generation', 'live storyMeta healed');
  assert.strictEqual(live.translationMeta.source, 'recorded at generation', 'live translationMeta healed');
  const stripSource = (m) => { const c = { ...m }; delete c.source; return c; };
  assert.deepStrictEqual(stripSource(live.storyMeta), store.topics[0].storyMeta,
    'the heal adds source and touches NOTHING else on storyMeta');
  assert.deepStrictEqual(stripSource(live.translationMeta), store.topics[0].translationMeta,
    'the heal adds source and touches NOTHING else on translationMeta');
  assert.ok(!live.storyMeta.backfilled, 'a healed live row is not mislabelled as backfilled');

  // 2. A backfilled stamp keeps its original, more specific source.
  assert.strictEqual(back.storyMeta.source, 'generationStats.model[0]', 'backfilled source untouched');
  assert.strictEqual(back.translationMeta.source, 'generationStats.models.translation', 'backfilled translation source untouched');

  // 3. A topic with no stamps stays stampless — healing is not backfilling.
  assert.ok(!bare.storyMeta && !bare.translationMeta, 'the heal never invents stamps');

  // 4. v68.1b — legacy 'user-provided' origins are refined into the corpus vocabulary, classified
  // exactly the way backfill-provenance.js classified them (storyline sourceFile decides).
  assert.strictEqual(legacyPaste.storyMeta.origin, 'user-pasted',
    "a legacy pasted story is refined to 'user-pasted'");
  assert.ok(!legacyPaste.storyMeta.sourceFile, 'a pasted story gains no sourceFile');
  assert.strictEqual(legacyPaste.storyMeta.source, 'recorded at generation',
    'the refined row also gets its source healed in the same pass');
  assert.strictEqual(legacyUp.storyMeta.origin, 'file-upload',
    "a legacy chapter of a sourceFile storyline is refined to 'file-upload'");
  assert.strictEqual(legacyUp.storyMeta.sourceFile, 'Some Article.pdf',
    'the refined upload chapter records the storyline sourceFile');
  assert.strictEqual(legacyUp.storyMeta.model, '(user-provided)',
    'refinement changes origin, never the model');
} finally {
  try { fs.unlinkSync(tmp); } catch (_) {}
}
console.log('  boot heal: live rows gain source, legacy origins refined, backfilled + bare rows untouched: OK');
console.log('unit-meta-source-heal: ALL PASSED');
