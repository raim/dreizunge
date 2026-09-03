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
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, post, get, req, assert, sleep, tmpFile } = require('./lib');

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
    { id: 'tp_ana3', topic: 'Ana Fixture Three', lang: 'de', srcLang: 'en',
      story: 'Der Fisch schwimmt.', lessons: [] },
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

    // ── 3b. v88_x: `resume:true` reaches the job even on a cached, fresh chapter ────────────────
    // ⚠️ THE BUG THIS SECTION EXISTS FOR. There are TWO cache short-circuits on this path — the
    // route's own, and `_kickOffAnalysisJob`'s (which repeats the test for its OTHER caller,
    // `_runBookJob`'s postGenAnalysis, that has no route to pre-check for it). Teaching only the
    // route about `resume` left the second one firing, and a live resume request came straight back
    // `{cached:true}` having done nothing. Found by issuing the request against a running server,
    // not by reading the route — so this asserts over BOTH gates by asserting the OUTCOME.
    //
    // Every sentence here is already usable, so the correct behaviour is: a real job runs, and it
    // makes ZERO model calls because it reuses all of them. That single pair of assertions catches
    // both a short-circuit that should not have fired and a reuse that does not reuse.
    {
      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const r = await post(sport, '/api/analyze-chapter/tp_ana1', { resume: true });
      assert(r.status === 202 && r.body.jobId,
        'resume is NOT answered from cache — it reaches a real job (got ' + r.status + ' ' + JSON.stringify(r.body) + ')');
      const fin = await waitJob(sport, r.body.jobId);
      assert(fin.status === 'done', 'and that job completes (status=' + fin.status + ')');
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after === before,
        `with every sentence already usable, a resume makes NO model calls at all — it reuses them (before=${before}, after=${after})`);
      const sh = await get(sport, '/api/analysis/tp_ana1');
      assert(sh.body.sentenceCount === 2 && sh.body.sentences.length === 2,
        'and the chapter is left whole, not truncated to the reused prefix');
      assert(sh.body.partial === false, 'a completed run clears the partial flag');
      console.log('  resume reaches the job past BOTH cache gates, and reuses every usable sentence: OK');
    }

    // ── 3c. v88_x: a sentence whose analysis FAILED is redone; the good ones are not ────────────
    // The user's actual report: "some words in the middle of the text say 'nicht analysiert'".
    // `parseAnalysisReply` degrades an unparseable reply the same way for EVERY token in that
    // sentence, so a sentence can be recorded with a full set of token slots and not one lemma —
    // measured at 5.9% of sentences in the live store. "Already analysed" therefore cannot mean "has
    // tokens", or a resume would politely preserve the exact gaps it exists to close.
    //
    // Staged by editing the store directly, which is the only way to produce that state on demand:
    // the fake model always answers, so no fixture can make it happen by itself.
    {
      const store = JSON.parse(fs.readFileSync(scratchAnalysis, 'utf8'));
      const rec = store.chapters['tp_ana1'];
      assert(rec && rec.sentences.length === 2, 'the staged chapter is the analysed fixture');
      // Sentence 0 keeps its analysis; sentence 1 becomes the all-unresolved failure.
      rec.sentences[1].tokens = rec.sentences[1].tokens.map(t => ({
        ...t, lemma: null, form: null, sense: null, confidence: 'unresolved' }));
      fs.writeFileSync(scratchAnalysis, JSON.stringify(store, null, 2), 'utf8');

      const sh0 = await get(sport, '/api/analysis/tp_ana1');
      assert(sh0.body.usableSentences === 1 && sh0.body.totalSentences === 2,
        'the shadow reports 1 of 2 sentences usable — the number the dialog shows comes from the '
        + 'SAME rule the resume applies (got ' + sh0.body.usableSentences + '/' + sh0.body.totalSentences + ')');

      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const r = await post(sport, '/api/analyze-chapter/tp_ana1', { resume: true });
      assert(r.status === 202 && r.body.jobId, 'a resume runs (got ' + r.status + ')');
      const fin = await waitJob(sport, r.body.jobId);
      assert(fin.status === 'done', 'and completes (status=' + fin.status + ')');
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after - before === 1,
        `EXACTLY ONE sentence is re-analysed — the failed one, not the whole chapter (calls: ${after - before})`);

      const sh = await get(sport, '/api/analysis/tp_ana1');
      assert(sh.body.usableSentences === 2, 'and the chapter is now fully usable again');
      assert(sh.body.sentences[1].tokens.every(t => t.lemma),
        'the failed sentence really was redone, not merely re-saved');
      console.log('  a resume redoes only the sentence whose analysis failed: OK');
    }

    // ── 3d. v88_x: `force` still means force — it does not become a resume ──────────────────────
    // Non-vacuity for the pair: if `force` quietly resumed, 3c would still pass and the user would
    // have lost the "overwrite" half of the choice they asked for.
    {
      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const r = await post(sport, '/api/analyze-chapter/tp_ana1', { force: true });
      assert(r.status === 202 && r.body.jobId, 'force runs a real job');
      await waitJob(sport, r.body.jobId);
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after - before === 2,
        `force re-analyses EVERY sentence, reusing nothing (calls: ${after - before}, expected 2)`);
      console.log('  force still re-analyses the whole chapter: OK');
      // ⚠️ Non-vacuity has a LIMIT here, and it is worth stating rather than implying. Making
      // `force` also set `resume` leaves this section GREEN — measured. That is not a hole in the
      // assertion, it is the design: `force` DELETES the record before the shadow is read, so there
      // is nothing left to reuse and a resume flag alongside it is inert. The mechanism that makes
      // them mutually exclusive is the ORDER of those two lines, so that is what gets pinned.
      const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const at = srv.indexOf("if (M === 'POST' && url.pathname.startsWith('/api/analyze-chapter/'))");
      assert(at > 0, 'the analyse route is found');
      const block = srv.slice(at, srv.indexOf('return json(res, 202', at));
      const delAt = block.indexOf('deleteAnalysisChapter(chapterId)');
      const shadowAt = block.indexOf('const shadow = analysisShadowFor(chapterId)');
      assert(delAt > 0 && shadowAt > 0 && delAt < shadowAt,
        'force deletes the cached record BEFORE the shadow is read — which is what leaves a resume '
        + 'nothing to reuse, and the only reason the two flags cannot fight');
    }

    // ── 3e. v88_x: a PARTIAL record is resumable, and is not mistaken for a finished analysis ────
    // Incremental persistence exists so a run that dies mid-way leaves something to come back to —
    // before this, a chapter that timed out, was cancelled, or died with the server threw away every
    // completed sentence, which is why there was never a partial to resume FROM.
    //
    // Staged by writing the record directly rather than by racing a real job: killing a run at the
    // right moment is timing-dependent, and a flaky guard for a durability feature is worse than a
    // deterministic one. What this asserts is the half that a stale partial would break — that the
    // system CONSUMES one correctly. That the run PRODUCES one is pinned at the source below.
    {
      const store = JSON.parse(fs.readFileSync(scratchAnalysis, 'utf8'));
      const rec = store.chapters['tp_ana1'];
      store.chapters['tp_ana1'] = {
        ...rec,
        sentences: rec.sentences.slice(0, 1),      // only the first of two ever finished
        sentenceCount: 1,
        partial: true, totalSentences: 2,
      };
      fs.writeFileSync(scratchAnalysis, JSON.stringify(store, null, 2), 'utf8');

      const sh0 = await get(sport, '/api/analysis/tp_ana1');
      assert(sh0.body.available === true && sh0.body.partial === true,
        'a partial is still AVAILABLE — the explorer renders the half it has — but flagged partial');
      assert(sh0.body.usableSentences === 1 && sh0.body.totalSentences === 2,
        'and it reports how far it got (got ' + sh0.body.usableSentences + '/' + sh0.body.totalSentences + ')');

      // ⚠️ A PLAIN post — NO flags — must not short-circuit on a partial. This is the only thing
      // `!shadow.partial` guards, and asserting it with `{resume:true}` was VACUOUS: `!resume`
      // already opens the gate, so removing the partial check left the section green. A learner
      // clicking "analyse" on a half-finished chapter must not be told it is already done.
      const plain = await post(sport, '/api/analyze-chapter/tp_ana1', {});
      assert(plain.status === 202 && plain.body.jobId,
        'a partial is NOT a cache hit even with no flags at all (got ' + plain.status + ' '
        + JSON.stringify(plain.body) + ')');
      await waitJob(sport, plain.body.jobId);
      // …and that plain run, having no resume flag, redid the whole chapter — so restore the partial
      // before testing that a RESUME reuses what is there.
      const store2 = JSON.parse(fs.readFileSync(scratchAnalysis, 'utf8'));
      const rec2 = store2.chapters['tp_ana1'];
      store2.chapters['tp_ana1'] = { ...rec2, sentences: rec2.sentences.slice(0, 1),
        sentenceCount: 1, partial: true, totalSentences: 2 };
      fs.writeFileSync(scratchAnalysis, JSON.stringify(store2, null, 2), 'utf8');

      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const r = await post(sport, '/api/analyze-chapter/tp_ana1', { resume: true });
      assert(r.status === 202 && r.body.jobId,
        'and a resume on a partial runs too (got ' + r.status + ' ' + JSON.stringify(r.body) + ')');
      const fin = await waitJob(sport, r.body.jobId);
      assert(fin.status === 'done', 'and completes (status=' + fin.status + ')');
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after - before === 1,
        `only the MISSING sentence is analysed — the finished one is reused (calls: ${after - before})`);

      const sh = await get(sport, '/api/analysis/tp_ana1');
      assert(sh.body.partial === false, 'and the completed run clears the partial flag');
      assert(sh.body.sentenceCount === 2 && sh.body.usableSentences === 2, 'leaving a whole chapter');
      console.log('  a partial record is resumed, not restarted, and stops being partial: OK');
    }

    // ── 3f. v88_x: the run PRODUCES a partial as it goes ─────────────────────────────────────────
    // The producing half, pinned at the source. Behaviourally it needs a run killed between two
    // sentences, which is exactly the timing-dependent shape this project's own flake findings warn
    // against building a guard on. What matters is that the progress hook WRITES, and that it writes
    // the partial FLAG — a checkpoint saved without it would read back as a finished, shorter
    // chapter and could never be resumed.
    {
      const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const at = srv.indexOf('async function _runAnalysisJob');
      const fn = srv.slice(at, srv.indexOf('\n}\n', at));
      assert(/onProgress:/.test(fn), 'the run supplies a progress hook');
      const hook = fn.slice(fn.indexOf('onProgress:'));
      assert(/persist\(soFar, true\)/.test(hook),
        'and that hook PERSISTS what has been analysed so far, flagged partial — without the flag a '
        + 'checkpoint reads back as a finished, shorter chapter');
      assert(/persist\(result\.sentences, false\)/.test(fn),
        'while the final write clears it');
      // ⚠️ This read `/catch \(e\)/.test(hook)` and was VACUOUS: `hook` runs to the end of the
      // function, so the outer try/catch of `_runAnalysisJob` satisfied it and removing the
      // checkpoint's OWN guard left the section green. Pinned to the one statement it is about.
      assert(/try \{ persist\(soFar, true\); \} catch/.test(hook),
        'a failed checkpoint never fails the run — the analysis in hand is worth more than the save');
      console.log('  the run checkpoints its progress, flagged partial, without risking the run: OK');
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
    // ⚠️ v88_x: this counted the RUNNING TOTAL of model calls across the whole file (7) and spelled
    // the arithmetic of every earlier section into its own assertion. Adding three sections above it
    // broke it — on a correct render of its OWN claim, which is about tp_ana2 alone. Measured as a
    // DELTA around the thing under test now: it is the same claim, stated so that an unrelated
    // section cannot falsify it. (Same class as the fixed-size source windows this line keeps
    // hitting: an absolute standing in for a local property.)
    {
      const callsBefore = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const [r1, r2] = await Promise.all([
        post(sport, '/api/analyze-chapter/tp_ana2', {}),
        post(sport, '/api/analyze-chapter/tp_ana2', {}),
      ]);
      assert(r1.status === 202 && r2.status === 202, `both concurrent POSTs are accepted (got ${r1.status}, ${r2.status})`);
      assert(r1.body.jobId === r2.body.jobId,
        `the second POST reuses the FIRST's jobId instead of starting a duplicate (got ${r1.body.jobId} vs ${r2.body.jobId})`);
      const fin = await waitJob(sport, r1.body.jobId);
      assert(fin.status === 'done' && fin.data.sentenceCount === 2, 'the shared job completes normally');
      const callsAfter = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      // tp_ana2 has 2 sentences. TWO concurrent POSTs, ONE job, so exactly 2 calls — 4 would mean a
      // duplicate job ran.
      assert(callsAfter - callsBefore === 2,
        `tp_ana2 was analysed exactly ONCE despite two concurrent POSTs (2 sentences => 2 calls; got ${callsAfter - callsBefore})`);
      console.log('  two concurrent POSTs for a chapter already mid-analysis share the SAME job, not a duplicate: OK');
    }

    // ── 7. v86_ac (user-requested "force re-analyze"): {force:true} bypasses the fresh-cache
    //    short-circuit and genuinely re-runs CP2, even though the cache is NOT stale ───────────
    {
      // tp_ana2 is fresh (not stale) after §6 — a plain POST would short-circuit (§3's own case).
      const plain = await post(sport, '/api/analyze-chapter/tp_ana2', {});
      assert(plain.status === 200 && plain.body.cached === true,
        'sanity check: WITHOUT force, a fresh cache still short-circuits exactly as before (got ' + JSON.stringify(plain.body) + ')');

      const before = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      const start = await post(sport, '/api/analyze-chapter/tp_ana2', { force: true });
      assert(start.status === 202, `force:true bypasses the short-circuit — a real new job starts even though the cache is fresh (got ${start.status} ${JSON.stringify(start.body)})`);
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done' && fin.data.sentenceCount === 2, 'the forced re-analysis completes normally');
      const after = env.readChatLog().filter(e => e.kind === 'canonical_analysis').length;
      assert(after === before + 2, `force:true genuinely re-ran CP2 — 2 new model calls fired for tp_ana2's 2 sentences (before=${before}, after=${after})`);

      const shadow = await get(sport, '/api/analysis/tp_ana2');
      assert(shadow.body.available === true && shadow.body.stale === false, 'the re-analysed chapter is available and fresh again after the forced run');
      console.log('  POST {force:true}: bypasses the fresh-cache short-circuit and genuinely re-runs CP2, replacing the old cached result: OK');
    }

    // ── 8. force:true on a chapter with NO existing cache at all — deleteAnalysisChapter's own
    //    "nothing to delete" path — behaves exactly like a normal first-time analysis, no error ──
    {
      const start = await post(sport, '/api/analyze-chapter/tp_ana3', { force: true });
      assert(start.status === 202, `force:true on a NEVER-analysed chapter starts a normal job, same as force:false would (got ${start.status} ${JSON.stringify(start.body)})`);
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done' && fin.data.sentenceCount === 1, 'the job completes normally — the no-op delete never interfered');
      console.log('  POST {force:true} on a never-analysed chapter is a harmless no-op-delete, same as a normal first run: OK');
    }

    // ── 9. v88_ac: DELETING a chapter drops its cached analysis ───────────────────────────────
    // ⚠️ Found by AUDITING canonical-analysis.json in the working tree, not from a report: 5 of its
    // 20 entries were analyses of chapters that no longer existed — 12% of the file, the oldest 5
    // days old. /api/lessons/delete cleaned up storylines, chain links and flags and simply never
    // called deleteAnalysisChapter, which had existed since v86_ac for the force path. The leak is
    // invisible in normal use (nothing can address an id that no longer exists) and unbounded.
    //
    // Both halves are asserted against the STORE FILE, which is where the leak was: the deleted
    // chapter's entry is gone, AND an unrelated chapter's entry is untouched. The second is the one
    // that matters — the tempting "sweep every entry with no matching chapter" implementation would
    // pass the first assertion and is one partial read of lessons.json away from wiping the store.
    {
      const readStore = () => JSON.parse(fs.readFileSync(scratchAnalysis, 'utf8'));
      // tp_ana2 and tp_ana3 are both analysed by now (sections 7 and 8 above).
      const before = readStore();
      assert(before.chapters['tp_ana3'] && before.chapters['tp_ana2'],
        'precondition: both fixtures are cached before the delete (got ' + Object.keys(before.chapters).join(',') + ')');
      const beforeCount = Object.keys(before.chapters).length;

      const d = await req(sport, 'DELETE', '/api/lessons/delete?id=tp_ana3');
      assert(d.status === 200, 'the chapter delete succeeds (got ' + d.status + ')');

      const after = readStore();
      assert(!after.chapters['tp_ana3'],
        'the deleted chapter\'s cached analysis is GONE from the store — it leaked forever before this cut');
      assert(after.chapters['tp_ana2'],
        'and an unrelated chapter\'s analysis is UNTOUCHED — this is a targeted drop, not a sweep');
      assert(Object.keys(after.chapters).length === beforeCount - 1,
        'exactly one entry was removed (got ' + Object.keys(after.chapters).length + ' from ' + beforeCount + ')');
      assert(after.chapterCount === Object.keys(after.chapters).length,
        'and the store\'s own chapterCount was re-derived, not left stating the old total');
      console.log('  DELETE /api/lessons/delete also drops that chapter\'s cached CP1/CP2 analysis (v88_ac): OK');
    }

    console.log('e2e-analysis: ALL PASSED');
  } finally { env.stop(); try { fs.unlinkSync(scratchAnalysis); } catch (_) {} }
})().catch(e => { console.error(e); process.exit(1); });
