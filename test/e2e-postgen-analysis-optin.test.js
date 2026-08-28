// E2E: item W follow-up (v86_o) — `postGenAnalysis`, mirroring `postGenStoryboard`'s own opt-in
// shape (e2e-postgen-storyboard-optin.test.js is the direct template this file follows). CP1/CP2
// analysis is intrinsically PER-CHAPTER (unlike the once-per-storyline storyboard), so
// `_kickOffAnalysisJob` fires the instant each chapter is saved inside `_runBookJob`'s own
// per-chapter loop, fire-and-forget — it must never hold up the NEXT chapter's generation, and the
// book job itself must reach 'done' without waiting for analysis to finish.
//
// Covers: omitting the flag starts NO analysis job at all (the default, no-checkbox-checked case);
// `postGenAnalysis:true` DOES start one per chapter, and it actually completes and caches (proven
// via the real GET /api/analysis/:chapterId route, not just "a job started"); a MULTI-chapter book
// fires one job per chapter, not one for the whole book (unlike storyboard).
const fs = require('fs');
const { boot, post, get, waitBookJob, assert, sleep, tmpFile } = require('./lib');

async function waitAnalysisAvailable(sport, chapterId, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/analysis/' + encodeURIComponent(chapterId));
    if (r.body && r.body.available) return r.body;
    await sleep(150);
  }
  return null;
}

(async () => {
  // Isolated scratch cache file — this store IS server-written (unlike curriculum-plan.json), so
  // every boot needs its own, per e2e-analysis.test.js's own lesson (a first draft of THAT file
  // polluted the real project-root canonical-analysis.json by omitting exactly this).
  const scratchAnalysis = tmpFile('dz_canonical_analysis_pg', '.json');
  const env = await boot({ log: true, extraEnv: { CANONICAL_ANALYSIS_FILE: scratchAnalysis } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. Without postGenAnalysis: no analysis job for the chapter — the default case ──────────
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [{ title: 'Chapter One', text: 'Ein Test ohne Analyse. '.repeat(8), wordCount: 30 }],
        // postGenAnalysis deliberately OMITTED — mirrors postGenStoryboard's own default-off case.
      });
      assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
      assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ')');
      const topicId = final.chapters[0].topicId;
      await sleep(300); // give a wrongly-started job time to fire, if one were started
      const shadow = await get(sport, '/api/analysis/' + encodeURIComponent(topicId));
      assert(shadow.body.available === false, 'NO analysis was started when postGenAnalysis was omitted (got ' + JSON.stringify(shadow.body) + ')');
      const entries = env.readChatLog().filter(e => e.kind === 'canonical_analysis');
      assert(entries.length === 0, `no canonical_analysis model calls fired at all (got ${entries.length})`);
      console.log('  postGenAnalysis omitted: no analysis job started, no model calls: OK');
    }

    // ── 2. With postGenAnalysis:true — fires per chapter, actually completes and caches ─────────
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [{ title: 'Chapter Two', text: 'Ein Test mit Analyse. '.repeat(8), wordCount: 30 }],
        postGenAnalysis: true,
      });
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
      assert(final && final.status === 'done', 'book done with postGenAnalysis:true (the fire-and-forget job must not block it)');
      const topicId = final.chapters[0].topicId;
      const shadow = await waitAnalysisAvailable(sport, topicId);
      assert(shadow, 'the per-chapter analysis actually completed and cached within the wait window');
      assert(shadow.available === true && shadow.sentenceCount > 0, `real cached analysis data (got ${JSON.stringify(shadow)})`);
      console.log('  postGenAnalysis:true: a real per-chapter analysis job fires, completes, and caches: OK');
    }

    // ── 3. Multi-chapter book: one analysis job PER CHAPTER, not one for the whole book ──────────
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [
          { title: 'Chapter A', text: 'Erste Geschichte hier. '.repeat(8), wordCount: 30 },
          { title: 'Chapter B', text: 'Zweite Geschichte hier. '.repeat(8), wordCount: 30 },
        ],
        postGenAnalysis: true,
      });
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
      assert(final && final.status === 'done' && final.chapters.length === 2, 'both chapters generated');
      const [idA, idB] = final.chapters.map(c => c.topicId);
      const [shA, shB] = await Promise.all([waitAnalysisAvailable(sport, idA), waitAnalysisAvailable(sport, idB)]);
      assert(shA && shA.available, `chapter A got its OWN analysis (got ${JSON.stringify(shA)})`);
      assert(shB && shB.available, `chapter B got its OWN analysis too — per-chapter, not once-for-the-book (got ${JSON.stringify(shB)})`);
      console.log('  a multi-chapter book: EACH chapter gets its own analysis job, not one for the whole book: OK');
    }

    console.log('e2e-postgen-analysis-optin: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-postgen-analysis-optin FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    try { fs.unlinkSync(scratchAnalysis); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
