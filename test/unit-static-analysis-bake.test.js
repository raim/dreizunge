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

function runBuild(analysisContent) {
  const lessonsPath = tmp('lessons') + '.json';
  const analysisPath = tmp('analysis') + '.json';
  const outDir = tmp('docs_out');
  fs.writeFileSync(lessonsPath, JSON.stringify(MIN_LESSONS));
  if (analysisContent !== undefined) fs.writeFileSync(analysisPath, JSON.stringify(analysisContent));
  // else: deliberately do NOT create the file, to exercise the missing-file path.
  const r = cp.spawnSync('node', [BUILD, lessonsPath, outDir], {
    env: { ...process.env, CANONICAL_ANALYSIS_FILE: analysisPath }, encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0, `build-static.js exited ${r.status}: ${r.stderr}`);
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const m = /const STATIC_ANALYSIS = (\{.*?\});/.exec(html);
  assert.ok(m, 'docs/index.html declares const STATIC_ANALYSIS');
  const cleanup = () => { try { fs.unlinkSync(lessonsPath); } catch(_){} try { fs.unlinkSync(analysisPath); } catch(_){}
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

console.log('unit-static-analysis-bake: ALL PASSED');
