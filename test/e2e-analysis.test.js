// E2E: PLAN §7.0 CP1/CP2, item W ("text explorer" mode, roadmap_v86.md) steps 2-3 — a real
// fresh-spawned server, a real (fake) Ollama backend, real HTTP round trips. Per this project's own
// standing rule ("server.js changes need a FRESH PROCESS to verify live"), this is the correct
// verification path for the new job/routes — not a curl against any long-running dev server.
//
// Covers: POST /api/analyze-chapter/:id runs CP1 (buildCanonicalText) then CP2 (analyzeChapter) as a
// background job and caches the result; GET /api/analysis/:id mirrors cp-shadow's own shape (absent
// -> available:false); a repeat POST for an already-cached, non-stale chapter short-circuits with
// 200+cached:true and starts NO new job (no second model call); a story edit after analysis (via
// /api/save-story) makes the cached result `stale:true` without deleting it, and re-POSTing a stale
// chapter runs a real new job; and two concurrent POSTs for a chapter already mid-analysis share the
// SAME job instead of starting a duplicate.
const fs = require('fs');
const { boot, post, get, assert, sleep, tmpFile } = require('./lib');

async function waitJob(sport, jobId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(200);
  }
  throw new Error('job timed out');
}

const SEED = {
  schemaVersion: 29, storylines: [], flags: {}, progress: {},
  topics: [
    { id: 'tp_ana1', topic: 'Ana Fixture', lang: 'de', srcLang: 'en',
      story: 'Der Hund lauft. Die Katze schlaft.', lessons: [] },
    { id: 'tp_ana2', topic: 'Ana Fixture Two', lang: 'de', srcLang: 'en',
      story: 'Der Vogel singt schon. Die Sonne scheint hell heute.', lessons: [] },
  ],
};

(async () => {
  // UNLIKE curriculum-plan.json (a manually-produced, read-only CLI artifact this server never
  // writes, so unit-cp5-shadow.test.js can safely rely on the real project root's copy being
  // absent), canonical-analysis.json IS written by the very job this test exercises — every boot
  // MUST get its own isolated scratch file, or a run pollutes the real project's working tree (and
  // a later run reads back a stale cache from an EARLIER test run instead of starting fresh).
  const scratchAnalysis = tmpFile('dz_canonical_analysis', '.json');
  const env = await boot({ log: true, seed: SEED, extraEnv: { CANONICAL_ANALYSIS_FILE: scratchAnalysis } });
  try {
    const { sport } = env;

    // ── 0. GET is read-only, absent -> available:false, exactly like cp-shadow ─────────────────
    {
      const r = await get(sport, '/api/analysis/tp_ana1');
      assert(r.status === 200, 'never 404s for an unanalysed chapter (got ' + r.status + ')');
      assert(r.body.chapterId === 'tp_ana1' && r.body.available === false,
        'absence is the NORMAL case, not an error (got ' + JSON.stringify(r.body) + ')');
      const r2 = await get(sport, '/api/analysis/no-such-chapter');
      assert(r2.body.available === false, 'an unknown chapter id degrades safely too');
      console.log('  GET /api/analysis/:id: read-only, available:false is the default for an unanalysed chapter: OK');
    }

    // ── 1. POST kicks off a real CP1+CP2 job; polling reaches done; GET now serves the cache ────
    {
      const start = await post(sport, '/api/analyze-chapter/tp_ana1', {});
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + JSON.stringify(start.body) + ')');
      assert(start.body.jobId, 'response carries a jobId');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job reaches done (status=' + fin.status + ', err=' + (fin.error || '') + ')');
      assert(fin.data.chapterId === 'tp_ana1' && fin.data.available === true, 'job data names the chapter and its availability');
      assert(fin.data.sentenceCount === 2, 'CP1 split the fixture into its real 2 sentences (got ' + fin.data.sentenceCount + ')');

      const shadow = await get(sport, '/api/analysis/tp_ana1');
      assert(shadow.body.available === true, 'GET now serves the cached result');
      assert(shadow.body.stale === false, 'freshly-analysed, unedited story is not stale');
      assert(shadow.body.sentenceCount === 2 && Array.isArray(shadow.body.sentences) && shadow.body.sentences.length === 2,
        'GET carries the real per-sentence data, not just counts');
      const toks = shadow.body.sentences[0].tokens;
      assert(Array.isArray(toks) && toks.length > 0, 'first sentence carries real per-token analysis');
      // fake-ollama's canonical_analysis kind: lemma = lowercased surface, confidence 'high'.
      assert(toks.every(t => t.confidence === 'high' && t.lemma === t.surface.toLowerCase()),
        `every token matches the fake model's canned reply (got ${JSON.stringify(toks)})`);
      assert(shadow.body.sentences.some(s => Array.isArray(s.phrases) && s.phrases.length > 0),
        'the fake model\'s canned phrase proposal survives into the cached/served data too');
      assert(shadow.body.model === 'fake', 'the analysis role\'s own model is recorded on the cached result');
      // item W step 4 groundwork: each sentence carries CP1's own raw text + paragraph-break flag,
      // stitched on server-side, so a client renderer needs no second CP1 pass of its own.
      assert(shadow.body.sentences[0].text === 'Der Hund lauft.',
        `sentence 0 carries CP1's own raw text verbatim (got ${JSON.stringify(shadow.body.sentences[0].text)})`);
      assert(shadow.body.sentences[1].text === 'Die Katze schlaft.',
        `sentence 1 carries CP1's own raw text verbatim (got ${JSON.stringify(shadow.body.sentences[1].text)})`);
      assert(shadow.body.sentences[0].paraBreakBefore === false, 'the first sentence never carries a leading paragraph break');
      assert(typeof shadow.body.sentences[1].paraBreakBefore === 'boolean', 'paraBreakBefore is always a real boolean, not undefined');
      console.log('  POST /api/analyze-chapter/:id: real CP1+CP2 job, cached, served back via GET: OK');
    }

    // ── 2. One model call PER SENTENCE — proven via the fake's own request log, not assumed ─────
    {
      const entries = env.readChatLog().filter(e => e.kind === 'canonical_analysis');
      assert(entries.length === 2, `exactly one call per sentence (2 sentences) — got ${entries.length}`);
      console.log('  CP2 makes exactly one model call per sentence: OK');
    }

    // ── 3. A repeat POST for the SAME, still-fresh chapter short-circuits — no new job, no new call ─
    {
      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const r = await post(sport, '/api/analyze-chapter/tp_ana1', {});
      assert(r.status === 200 && r.body.cached === true, 'a fresh cache hit returns 200+cached:true, not a new job (got ' + JSON.stringify(r.body) + ')');
      assert(r.body.available === true && r.body.stale === false, 'the short-circuit response carries the real cached shadow data');
      await sleep(300); // give a wrongly-started job time to fire, if one were started
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after === before, `no new model calls fired for a repeat, fresh-cache POST (before=${before}, after=${after})`);
      console.log('  a repeat POST for an already-cached, fresh chapter re-analyses NOTHING: OK');
    }

    // ── 4. A story edit after analysis makes the cache STALE, without deleting it ────────────────
    {
      const save = await post(sport, '/api/save-story', { topic: 'Ana Fixture', story: 'Der Hund lauft schnell. Die Katze schlaft. Der Vogel singt.' });
      assert(save.status === 200, 'save-story accepted (got ' + save.status + ' ' + JSON.stringify(save.body) + ')');
      const shadow = await get(sport, '/api/analysis/tp_ana1');
      assert(shadow.body.available === true, 'the cached analysis is still SERVED after a story edit — not deleted');
      assert(shadow.body.stale === true, 'but now flagged stale — the cache was computed against the OLD story text');
      assert(shadow.body.sentenceCount === 2, 'the served data is still the OLD (pre-edit) analysis, unchanged, just labelled stale');
      console.log('  a post-analysis story edit marks the cached result stale:true without discarding it: OK');
    }

    // ── 5. A stale chapter re-POSTed runs a REAL new job (not short-circuited) ───────────────────
    {
      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const start = await post(sport, '/api/analyze-chapter/tp_ana1', {});
      assert(start.status === 202, 'a stale cache does NOT short-circuit — a real new job starts (got ' + start.status + ' ' + JSON.stringify(start.body) + ')');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'the re-analysis job completes');
      assert(fin.data.sentenceCount === 3, 'the NEW analysis reflects the EDITED (3-sentence) story (got ' + fin.data.sentenceCount + ')');
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after === before + 3, `3 new model calls fired for the 3-sentence edited story (before=${before}, after=${after})`);
      const shadow = await get(sport, '/api/analysis/tp_ana1');
      assert(shadow.body.stale === false && shadow.body.sentenceCount === 3, 'the cache is fresh again after re-analysis');
      console.log('  a STALE cache is genuinely re-analysed on the next POST, and the cache updates: OK');
    }

    // ── 6. Concurrency: two POSTs for a chapter already mid-analysis share ONE job ───────────────
    {
      const [r1, r2] = await Promise.all([
        post(sport, '/api/analyze-chapter/tp_ana2', {}),
        post(sport, '/api/analyze-chapter/tp_ana2', {}),
      ]);
      assert(r1.status === 202 && r2.status === 202, `both concurrent POSTs are accepted (got ${r1.status}, ${r2.status})`);
      assert(r1.body.jobId === r2.body.jobId,
        `the second POST reuses the FIRST's jobId instead of starting a duplicate (got ${r1.body.jobId} vs ${r2.body.jobId})`);
      const fin = await waitJob(sport, r1.body.jobId);
      assert(fin.status === 'done' && fin.data.sentenceCount === 2, 'the shared job completes normally');
      const entries = env.readChatLog().filter(e => e.kind === 'canonical_analysis');
      // 2 (tp_ana1 first pass) + 3 (tp_ana1 restale pass) + 2 (tp_ana2, ONCE, not twice) = 7.
      assert(entries.length === 7, `tp_ana2 was analysed exactly ONCE despite two concurrent POSTs (expected 7 total calls across this whole test, got ${entries.length})`);
      console.log('  two concurrent POSTs for a chapter already mid-analysis share the SAME job, not a duplicate: OK');
    }

    console.log('e2e-analysis: ALL PASSED');
  } finally { env.stop(); try { fs.unlinkSync(scratchAnalysis); } catch (_) {} }
})().catch(e => { console.error(e); process.exit(1); });
