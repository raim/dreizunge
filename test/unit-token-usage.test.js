// unit-token-usage.test.js
// v59 — cumulative token usage across ALL LLM calls. Contract under test:
//   • ONE choke point: every server-side LLM call goes through the metered _callLLM wrapper
//     (same philosophy as upsert()'s createdBy stamp); AsyncLocalStorage scopes the meter so
//     CONCURRENT jobs can never cross-attribute; calls outside a scope count nowhere here
//     (the initial generation keeps its own accumulation — wrapping it would double-count).
//   • addTokenUsage: topics fold into generationStats.totalPromptTokens/totalCompletionTokens
//     (the SAME fields the initial generation writes — "total" finally means total); storylines
//     get their own tokenUsage block (explicit roadmap decision: storyline-level artefacts go
//     to the STORYLINE, not chapter 1, not spread); both keep a per-type tally.
//   • All post-gen LLM sites are wired: summary (route + batch post-pass), storyboard,
//     retitle (route + batch post-pass — storyline bucket, one call covers the chain),
//     story-QC (route + sweep), summary-QC, lesson-QC sweep, add-lesson, recreate.
//   • Lesson-QC accumulation marks the topic touched so an all-clean sweep still PERSISTS.
//   • Display: storyline screen shows the storyline bucket; chapter line gains a breakdown
//     tooltip. The v55_s 4-field projection keeps its field NAMES (totals just grow).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The meter itself (behavioral, real AsyncLocalStorage, concurrency) ─────
// Extract the REAL wrapper + meter bodies from server.js and bind fake backends. The fake
// awaits a random delay before returning, so async context must genuinely propagate across
// ticks — this executes the ALS plumbing rather than pattern-matching it.
{
  const { AsyncLocalStorage } = require('async_hooks');
  const mkTrio = (impl, als) => new Function('_rawCallLLM', '_tokenALS',
    ext(server, '_callLLM') + '\n' + ext(server, 'meterLLMTokens') + '\nreturn { _callLLM, meterLLMTokens };')(impl, als);
  const fake = (pt, ct) => async () => { await new Promise(r => setTimeout(r, Math.random() * 4)); return { text: 'x', promptTokens: pt, completionTokens: ct }; };
  (async () => {
    const als = new AsyncLocalStorage();
    const one = mkTrio(fake(7, 11), als);
    // Unscoped call: counted nowhere, result passes through untouched.
    const r0 = await one._callLLM('m', 's', 'u', 100);
    assert.strictEqual(r0.promptTokens, 7, 'wrapper passes the result through');
    // Scoped: accumulates across multiple calls in one scope.
    const { result, tokens } = await one.meterLLMTokens(async () => {
      await one._callLLM(); await one._callLLM(); await one._callLLM();
      return 'done';
    });
    assert.strictEqual(result, 'done', 'meter returns the scope result');
    assert.deepStrictEqual(tokens, { promptTokens: 21, completionTokens: 33 }, 'meter sums all calls in scope');
    // CONCURRENCY: two interleaved scopes sharing ONE ALS must not cross-attribute. Different
    // per-scope wrappers → distinguishable counts; the random delays interleave the ticks.
    const shared = new AsyncLocalStorage();
    const A = mkTrio(fake(100, 1), shared), B = mkTrio(fake(3, 1000), shared);
    const [ra, rb] = await Promise.all([
      A.meterLLMTokens(async () => { for (let i = 0; i < 5; i++) await A._callLLM(); }),
      B.meterLLMTokens(async () => { for (let i = 0; i < 5; i++) await B._callLLM(); }),
    ]);
    assert.deepStrictEqual(ra.tokens, { promptTokens: 500, completionTokens: 5 }, 'concurrent scope A attributes only its own calls');
    assert.deepStrictEqual(rb.tokens, { promptTokens: 15, completionTokens: 5000 }, 'concurrent scope B attributes only its own calls');
    console.log('  meter: passthrough, in-scope summation, no cross-attribution under concurrency: OK');
  })().then(() => runRest()).catch(e => { console.error(e); process.exit(1); });
}

function runRest() {
// ── 2. addTokenUsage semantics (behavioral) ───────────────────────────────────
{
  const addTokenUsage = new Function(ext(server, 'addTokenUsage') + '\nreturn addTokenUsage;')();
  // Topic: folds into the SAME totals the initial generation wrote.
  const tp = { id: 'tp_1', generationStats: { model: 'm', totalMs: 5, totalPromptTokens: 100, totalCompletionTokens: 50 } };
  addTokenUsage(tp, { promptTokens: 10, completionTokens: 5 }, 'story_qc');
  addTokenUsage(tp, { promptTokens: 1, completionTokens: 1 }, 'story_qc');
  addTokenUsage(tp, { promptTokens: 2, completionTokens: 3 }, 'add_lesson');
  assert.strictEqual(tp.generationStats.totalPromptTokens, 113, 'topic prompt tokens are CUMULATIVE');
  assert.strictEqual(tp.generationStats.totalCompletionTokens, 59, 'topic completion tokens are CUMULATIVE');
  assert.deepStrictEqual(tp.generationStats.tokensByType, { story_qc: 17, add_lesson: 5 }, 'per-type tally sums repeats');
  assert.strictEqual(tp.generationStats.totalMs, 5, 'totalMs untouched — it still means generation time');
  // Legacy topic with no stats: defensive shell, work never dropped.
  const bare = { id: 'tp_2' };
  addTokenUsage(bare, { promptTokens: 4, completionTokens: 6 }, 'lesson_qc');
  assert.strictEqual(bare.generationStats.totalPromptTokens, 4, 'shell created for stat-less topics');
  assert.strictEqual(bare.generationStats.model, '(post-gen)', 'shell is honestly labeled, never a fake model');
  // Storyline: its own bucket (chapters array is the discriminator).
  const sl = { id: 'sl_1', chapters: ['tp_1'] };
  addTokenUsage(sl, { promptTokens: 30, completionTokens: 20 }, 'summary');
  addTokenUsage(sl, { promptTokens: 5, completionTokens: 5 }, 'storyboard');
  assert.deepStrictEqual(sl.tokenUsage.tokensByType, { summary: 50, storyboard: 10 }, 'storyline per-type tally');
  assert.strictEqual(sl.tokenUsage.totalPromptTokens, 35, 'storyline bucket separate from any topic');
  assert.ok(!sl.generationStats, 'a storyline NEVER grows topic-shaped generationStats');
  // Zero/absent tokens: no-op, no empty structures created.
  const clean = { id: 'tp_3' };
  addTokenUsage(clean, { promptTokens: 0, completionTokens: 0 }, 'x');
  addTokenUsage(clean, null, 'x'); addTokenUsage(null, { promptTokens: 1, completionTokens: 1 }, 'x');
  assert.ok(!clean.generationStats, 'zero-token scopes leave no trace');
}
console.log('  addTokenUsage: cumulative topic totals, storyline bucket, per-type tally, no-op on zero: OK');

// ── 3. Wiring: every post-gen LLM site attributes (source contracts) ──────────
{
  const need = [
    [/addTokenUsage\(sl, _mTok, 'summary'\)/g, 2, 'summary: route + batch post-pass → storyline'],
    [/addTokenUsage\(sl, _mTok, 'storyboard'\)/g, 1, 'storyboard route → storyline'],
    [/addTokenUsage\(sl, _mTok, 'retitle'\)/g, 3, 'retitle: route (2 scopes) + batch title step → storyline'],
    [/addTokenUsage\(_slT, _mTok, 'retitle'\)/g, 1, 'batch chapter-title step → storyline'],
    [/addTokenUsage\(sl, _mTok, 'summary_qc'\)/g, 1, 'summary-QC → storyline'],
    [/addTokenUsage\(t, _mTok, 'story_qc'\)/g, 1, 'story-QC route → topic'],
    [/addTokenUsage\(tp, _sqTok, 'story_qc'\)/g, 1, 'story-QC sweep → topic'],
    [/addTokenUsage\(tp, _lqTok, 'lesson_qc'\)/g, 1, 'lesson-QC sweep → topic'],
    [/addTokenUsage\(saved, _alTok, 'add_lesson'\)/g, 1, 'add-lesson → topic'],
    [/addTokenUsage\(topic, _rcTok, 'recreate'\)/g, 1, 'recreate → per chapter'],
  ];
  for (const [re, n, why] of need) {
    assert.strictEqual((server.match(re) || []).length, n, why);
  }
  // The QC sweep persists accumulation even when everything came back clean.
  const runQc = ext(server, '_runQc');
  assert.ok(/if \(_lqTok\.promptTokens \+ _lqTok\.completionTokens > 0\) \{ addTokenUsage\(tp, _lqTok, 'lesson_qc'\); touched = true; \}/.test(runQc),
    'nonzero QC tokens mark the topic touched → an all-clean sweep still persists the accounting');
  // The main generation pipeline is NOT wrapped (it self-accumulates; wrapping = double count).
  const gen = server.slice(server.indexOf('let totalPromptTokens = 0, totalCompletionTokens = 0;', server.indexOf('async function generateStory')));
  assert.ok(!/meterLLMTokens/.test(gen.slice(0, 400)), 'initial generation keeps its own accounting (no double count)');
  // The wrapper is THE convergence: the raw import is renamed and used nowhere else.
  assert.strictEqual((server.match(/_rawCallLLM/g) || []).length, 2, '_rawCallLLM appears exactly twice: import + wrapper');
}
console.log('  wiring: 12 attribution sites, clean-sweep persistence, no double-count, one convergence: OK');

// ── 4. Display + projection safety ────────────────────────────────────────────
{
  assert.ok(/slMeta\?\.tokenUsage/.test(client) && /tokens\.storyline/.test(client),
    'storyline screen renders the storyline token bucket as its own line');
  assert.ok(/tokens\.initial/.test(client) && /gs\.tokensByType/.test(client),
    'chapter gen-stats line gains the cumulative breakdown tooltip (initial + per-type)');
  // v55_s guard: the 4-field projection keeps its FIELD NAMES — totals grow in value only.
  const projAt = server.indexOf('Compact generation-stats projection (v55_s)');
  const proj = server.slice(projAt, projAt + 1400);
  for (const f of ['totalPromptTokens', 'totalCompletionTokens']) assert.ok(proj.includes(f), `projection still ships ${f}`);
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['tokens.storyline'] && ui.en['tokens.initial'], 'en i18n keys exist');
}
console.log('  display: storyline line, breakdown tooltip, v55_s projection field names stable: OK');

console.log('unit-token-usage: ALL PASSED');
}
