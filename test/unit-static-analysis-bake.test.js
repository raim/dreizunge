// unit-static-analysis-bake.test.js
// v86_z (user-requested): "Can we build the text analysis explorer also into the static
// docs/index.html?" — PLAN §7.0 CP1/CP2's own per-chapter analysis was live-only until this cut (GET
// /api/analysis/:id has no static equivalent). This file covers build-static.js's OWN half — reading
// canonical-analysis.json and baking it as STATIC_ANALYSIS; the CLIENT half (how
// _ensureTextExplorerData() consumes STATIC_ANALYSIS, never touching the network) is covered by
// unit-text-explorer.test.js's own §8.
//
// Runs the REAL build-static.js as a subprocess against isolated scratch files (a minimal
// lessons.json, an isolated CANONICAL_ANALYSIS_FILE — same env-override convention
// server.js's own ANALYSIS_STORE_FILE already uses) — never the real project-root files.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build-static.js');

function tmp(name) { return path.join(os.tmpdir(), `${name}_${process.pid}_${Date.now()}`); }

const MIN_LESSONS = {
  schemaVersion: 30,
  topics: [{ id: 'tp_a', topic: 'A Chapter', lang: 'it', srcLang: 'en', difficulty: 1,
    story: 'Una storia.', lessons: [{ id: 1, title: 'V', desc: 'd', icon: '📖', vocab: [] }] }],
  storylines: [],
};

function runBuild(analysisContent, correctionsContent) {
  const lessonsPath = tmp('lessons') + '.json';
  const analysisPath = tmp('analysis') + '.json';
  const correctionsPath = tmp('corrections') + '.json';
  const outDir = tmp('docs_out');
  fs.writeFileSync(lessonsPath, JSON.stringify(MIN_LESSONS));
  if (analysisContent !== undefined) fs.writeFileSync(analysisPath, JSON.stringify(analysisContent));
  if (correctionsContent !== undefined) fs.writeFileSync(correctionsPath, JSON.stringify(correctionsContent));
  // else: deliberately do NOT create the file, to exercise the missing-file path.
  const r = cp.spawnSync('node', [BUILD, lessonsPath, outDir], {
    // ⚠️ v88_ad: ANALYSIS_CORRECTIONS_FILE is overridden on EVERY run, including the ones that pass
    // no corrections. Without it this subprocess reads the real project-root store, so a curator's
    // actual corrections would leak into these fixtures' expectations — the same isolation this
    // file's own header already insists on for canonical-analysis.json.
    env: { ...process.env, CANONICAL_ANALYSIS_FILE: analysisPath,
           ANALYSIS_CORRECTIONS_FILE: correctionsPath }, encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, `build-static.js exited ${r.status}: ${r.stderr}`);
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const m = /const STATIC_ANALYSIS = (\{.*?\});/.exec(html);
  assert.ok(m, 'docs/index.html declares const STATIC_ANALYSIS');
  const cleanup = () => { try { fs.unlinkSync(lessonsPath); } catch(_){} try { fs.unlinkSync(analysisPath); } catch(_){}
    try { fs.unlinkSync(correctionsPath); } catch(_){}
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch(_){} };
  return { baked: JSON.parse(m[1]), stdout: r.stdout, cleanup };
}

// ── 1. A real canonical-analysis.json bakes into the SAME shape GET /api/analysis/:id returns ────
{
  const REC = {
    chapterId: 'tp_a', lang: 'it', srcLang: 'en', script: ['latin'],
    sentenceCount: 1, tokenCount: 2,
    sentences: [{ sentenceId: 'tp_a:s0', tokens: [
      { tokenId: 'tp_a:s0:t0', idx: 0, surface: 'Una', lemma: 'uno', form: 'article', sense: 'a', confidence: 'high', reviewed: false },
    ] }],
    provenance: { stage: 'CP2', model: 'fake-model', at: '2026-01-01T00:00:00.000Z' },
    sourceTextHash: 'deadbeef0000', analyzedAt: '2026-01-01T00:00:00.000Z',
  };
  const { baked, stdout, cleanup } = runBuild({ schemaVersion: 1, chapters: { tp_a: REC }, chapterCount: 1 });
  try {
    assert.ok(/Baked CP1\/CP2 analysis for 1 chapter/.test(stdout), `build logs how many chapters it baked (got: ${stdout})`);
    assert.deepStrictEqual(Object.keys(baked), ['tp_a'], 'exactly the one chapter in the store is baked');
    const b = baked.tp_a;
    assert.strictEqual(b.available, true, 'available:true — same field GET /api/analysis/:id would set for a hit');
    assert.strictEqual(b.stale, false, 'stale is ALWAYS false in a bake — a frozen snapshot has no live text to re-hash against');
    assert.strictEqual(b.sentenceCount, 1);
    assert.deepStrictEqual(b.sentences, REC.sentences, 'the REAL sentence/token data is carried through untouched, not summarised or dropped');
    assert.strictEqual(b.model, 'fake-model', 'model is read from provenance.model, matching analysisShadowFor()\'s own field');
    assert.strictEqual(b.analyzedAt, '2026-01-01T00:00:00.000Z');
  } finally { cleanup(); }
}
console.log('  build-static.js: a real canonical-analysis.json bakes into the SAME shape GET /api/analysis/:id returns: OK');

// ── 2. No canonical-analysis.json at all: degrades to {}, does not crash the whole build ─────────
{
  const { baked, cleanup } = runBuild(undefined);
  try {
    assert.deepStrictEqual(baked, {}, 'a missing canonical-analysis.json bakes an EMPTY object, not a crash or a stale leftover');
  } finally { cleanup(); }
}
console.log('  build-static.js: a missing canonical-analysis.json degrades to an empty bake, the whole build still succeeds: OK');

// ── item AI (v88_ad): the curator's corrections reach the PUBLISHED build ────────────────────────
// ⚠️ This is the assertion that exists because of v87_k and v88_w. build-static.js does NOT read the
// analysis through the live server's analysisShadowFor — it opens canonical-analysis.json directly.
// That makes it a SECOND surface over the same cache, and in this project a second surface that
// re-implements a shared read has twice shipped missing everything the shared path had grown (the
// lesson-set reader missed four features; the static landing card missed thumbMode). Without the
// merge here, every correction a curator made would be silently absent from docs/ — the one build
// students actually read, and the one nobody would think to check.
{
  const REC = {
    chapterId: 'tp_a', lang: 'it', srcLang: 'en', script: ['latin'],
    sentenceCount: 1, tokenCount: 2,
    sentences: [{ sentenceId: 'tp_a:s0', text: 'Una storia.', tokens: [
      { tokenId: 'tp_a:s0:t0', idx: 0, surface: 'Una', lemma: 'uno', form: 'article', sense: 'a', confidence: 'high', reviewed: false },
      { tokenId: 'tp_a:s0:t1', idx: 1, surface: 'storia', lemma: '', form: '', sense: '', confidence: 'unresolved', reviewed: false },
    ] }],
    provenance: { stage: 'CP2', model: 'fake-model', at: '2026-01-01T00:00:00.000Z' },
    sourceTextHash: 'deadbeef0000', analyzedAt: '2026-01-01T00:00:00.000Z',
  };
  const CORR = { schemaVersion: 1, chapterCount: 1, chapters: { tp_a: { corrections: [
    { sentenceText: 'Una storia.', surface: 'storia', occurrence: 0,
      lemma: 'storia', form: 'noun', sense: 'story', correctedAt: '2026-01-02T00:00:00.000Z' },
  ] } } };
  const { baked, cleanup } = runBuild({ schemaVersion: 1, chapters: { tp_a: REC }, chapterCount: 1 }, CORR);
  try {
    const toks = baked.tp_a.sentences[0].tokens;
    assert.strictEqual(toks[1].lemma, 'storia', 'the curator correction is APPLIED in the baked static analysis');
    assert.strictEqual(toks[1].sense, 'story', 'including the sense');
    assert.strictEqual(toks[1].reviewed, true, 'and the baked token is marked as curated');
    assert.strictEqual(toks[1].confidence, 'high', 'and no longer renders as unresolved in the published build');
    // Non-vacuity: an untouched token must be carried through exactly as the model left it, or the
    // assertions above could be satisfied by the bake rewriting every token.
    assert.strictEqual(toks[0].lemma, 'uno', 'an uncorrected token is unchanged');
    assert.strictEqual(toks[0].reviewed, false, 'and is not marked curated');
  } finally { cleanup(); }
}
console.log('  build-static.js applies curator corrections when baking, so docs/ is not a stale second surface: OK');

// The corrections store is OPTIONAL, exactly like canonical-analysis.json — a project that has
// never curated anything must build identically.
{
  const REC = { chapterId: 'tp_a', sentenceCount: 1, tokenCount: 1,
    sentences: [{ sentenceId: 'tp_a:s0', text: 'Una storia.', tokens: [
      { surface: 'Una', lemma: 'uno', confidence: 'high', reviewed: false } ] }],
    provenance: { model: 'fake-model' }, sourceTextHash: 'x', analyzedAt: 'y' };
  const { baked, cleanup } = runBuild({ schemaVersion: 1, chapters: { tp_a: REC }, chapterCount: 1 });
  try {
    assert.strictEqual(baked.tp_a.sentences[0].tokens[0].lemma, 'uno',
      'with no corrections file at all the analysis bakes untouched — absence is the normal case');
  } finally { cleanup(); }
}
console.log('  a missing analysis-corrections.json leaves the bake untouched: OK');

console.log('unit-static-analysis-bake: ALL PASSED');
