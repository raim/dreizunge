// E2E (live server + fake Ollama): v90_o — the per-chapter CP1/CP2 analysis is DEFERRED until the
// book job has finished, and the deferred analyses run ONE AT A TIME.
//
// ⚠️ WHY THIS EXISTS — a real failure, on the user's own machine, that cost a chapter.
// `v86_o` fired `_kickOffAnalysisJob(saved)` the instant each chapter was persisted, reasoning that
// analysis "must never hold up the NEXT chapter's generation". That reasoning assumed the backend
// could do two things at once. On a CPU-only, single-model Ollama it cannot — requests serialise at
// the backend — so the analysis held the next chapter up anyway, invisibly, and the waiting was
// charged against a WALL-CLOCK request timeout sized for the model's own work. Measured on the
// failing job: chapter 1's translation 69.6s with nothing else running, chapter 2's 295.2s with
// chapter 1's analysis in flight, chapter 2's lesson 716.4s against a 720s timeout, and chapter 3's
// three lesson attempts all timed out.
//
// ⚠️ THE CLAIM IS ABOUT ORDERING, SO IT IS ASSERTED AGAINST THE SERVER'S OWN LOG — the layer where
// "did this start before that" is actually observable. Asserting it against the analysis RESULT
// could not work: the results are identical either way, which is precisely why the defect survived
// `e2e-postgen-analysis-optin` (whose assertions are all about outcomes) for four release lines.
'use strict';
const { boot, post, get, waitBookJob, assert, sleep, tmpFile } = require('./lib');

// Positions in the server log, in the order the server printed them.
const idx = (log, re) => {
  const out = [];
  const lines = log.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) out.push(i);
  return out;
};

async function waitFor(fn, timeoutMs = 30000, intervalMs = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { if (await fn()) return true; await sleep(intervalMs); }
  return false;
}

(async () => {
  const env = await boot({ log: true, extraEnv: {
    DRAFTS_FILE: tmpFile('dz_drafts', '.json'),
    CANONICAL_ANALYSIS_FILE: tmpFile('dz_analysis', '.json'),
  } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. ⚠️ NO ANALYSIS STARTS WHILE THE BOOK IS STILL GENERATING ────────────────────────────
    // The payload assertion of the whole change, and the one the old code fails.
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [
          { title: 'Kapitel A', text: 'Erste Geschichte hier. '.repeat(8), wordCount: 30 },
          { title: 'Kapitel B', text: 'Zweite Geschichte hier. '.repeat(8), wordCount: 30 },
          { title: 'Kapitel C', text: 'Dritte Geschichte hier. '.repeat(8), wordCount: 30 },
        ],
        postGenAnalysis: true,
      });
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 120000 });
      assert(final && final.status === 'done' && final.chapters.length === 3,
        `all three chapters generated (got ${final && final.status}, ${final && final.chapters.length})`);

      // The book must still reach 'done' promptly — deferring must NOT make the job sit in
      // `running` for the length of the analyses. That would be a worse lie than the contention.
      const ids = final.chapters.map(c => c.topicId);
      const ok = await waitFor(async () => {
        const l = env.srvlog();
        return idx(l, /deferred analysis: all chapters done/).length > 0;
      }, 60000);
      assert(ok, 'the deferred analyses ran and finished');

      const log = env.srvlog();
      const finishedAt = idx(log, /\[book .*\] finished:/);
      const analysisAt  = idx(log, /Analyzing chapter:/);
      assert(finishedAt.length >= 1, 'the book job logged that it finished');
      assert(analysisAt.length >= 3, `an analysis started for each chapter (saw ${analysisAt.length})`);
      // ⚠️ THE ASSERTION. Every analysis must begin AFTER the book announced it was finished.
      // Under the old per-chapter code the first two land before it, and this fails.
      const early = analysisAt.filter(a => a < finishedAt[0]);
      assert(early.length === 0,
        `NO analysis may start before the book job finishes — ${early.length} of ${analysisAt.length} ` +
        'did, which is the contention that timed out chapter 3 on the reporting machine');
      console.log(`  none of ${analysisAt.length} analyses started before the book finished: OK`);

      // ── 2. They run ONE AT A TIME ───────────────────────────────────────────────────────────
      // Sequential is the point, not tidiness: CP2 issues one model call PER SENTENCE, so firing
      // three chapters at once just moves the same thundering herd later.
      //
      // ⚠️ THE FIRST DRAFT OF THIS SECTION ONLY CHECKED OWNERSHIP — that every analysis began after
      // the deferred runner announced itself — while its console line claimed "one at a time".
      // Mutation-testing found it: deleting the `await` so all analyses fire at once left this
      // GREEN, because firing them together still puts them all after the marker. The claim is
      // about INTERLEAVING, so it is asserted as interleaving: analysis N must COMPLETE before
      // analysis N+1 STARTS.
      const marker = idx(log, /deferred analysis: \d+ chapter\(s\), one at a time/);
      assert(marker.length === 1, 'the deferred runner announced itself exactly once');
      assert(marker[0] > finishedAt[0], 'and it did so after the book finished');
      assert(analysisAt.every(a => a > marker[0]),
        'every analysis started after the deferred runner began — none leaked out of the chapter loop');

      // `Analyzing chapter: <id>` is the start line; `[analysis] <id>: N sentence(s)` is the
      // completion line. Both carry the chapter id, so starts and finishes can be paired.
      const startsFor = id => idx(log, new RegExp('Analyzing chapter: ' + id + '\\b'));
      const endsFor   = id => idx(log, new RegExp('\\[analysis\\] ' + id + ':'));
      const order = ids.map(id => ({ id, start: startsFor(id)[0], end: endsFor(id)[0] }))
                       .filter(o => o.start != null)
                       .sort((a, b) => a.start - b.start);
      assert(order.length === 3, `all three chapters have a start line (got ${order.length})`);
      for (let i = 0; i + 1 < order.length; i++) {
        assert(order[i].end != null,
          `chapter ${order[i].id} logged a completion (without it, serialisation is unobservable)`);
        assert(order[i].end < order[i + 1].start,
          `analysis ${i + 1} must FINISH before analysis ${i + 2} STARTS — one at a time is the ` +
          `whole point (finished at line ${order[i].end}, next started at ${order[i + 1].start})`);
      }
      console.log('  each analysis finishes before the next begins — genuinely serial: OK');

      // And the analyses really did produce cached results — deferring must not quietly skip them.
      for (const id of ids) {
        const got = await waitFor(async () => {
          const r = await get(sport, '/api/analysis/' + encodeURIComponent(id));
          return r.body && r.body.available === true;
        }, 30000);
        assert(got, `chapter ${id} still ends up with a real cached analysis`);
      }
      console.log('  all three chapters still end up analysed and cached: OK');
    }

    // ── 3. ⚠️ A CANCELLED BOOK STARTS NO DEFERRED ANALYSIS AT ALL ─────────────────────────────
    // This section took three drafts, and each failure was caught by its OWN guard-rail assertion
    // rather than by luck. Recorded because the shape recurs:
    //   (a) normal speed → the cancel lost the race, the section printed "(cancel lost the race)"
    //       and asserted NOTHING. Vacuous, and it said so in its own output.
    //   (b) `FAKE_SLOW_MS` env var → the job still read `done`. `e2e-job-cancel` already records
    //       why: the server's boot-time `warmup()` is itself an /api/chat call, so a fake that is
    //       slow from process start hangs boot. It must be flipped AFTER boot, via `/__slow`.
    //   (c) `/__slow` at 30s applied after chapter 1 → chapter 1 could never finish at all, and
    //       with it flipped only once chapter 1 WAS done, chapter 2 slipped through before the
    //       next poll. A MODERATE delay applied up front is what actually holds: every call is
    //       slow enough to leave a wide cancel window, but chapters still complete.
    //
    // ⚠️ AND THE CANCEL MUST LAND WITH AT LEAST ONE CHAPTER ALREADY SAVED, which is mutation-driven:
    // if it lands before any chapter exists the pending list is empty and `_runDeferredAnalyses`
    // returns without logging either way, so removing the `bj.status !== 'cancelled'` gate leaves
    // this section GREEN. The gate is only under test when something is actually owed an analysis.
    {
      const slow = await post(env.fport, '/__slow', { ms: 600 });
      assert(slow.status === 200, `the fake accepted /__slow (got ${slow.status})`);
      try {
        const start = await post(sport, '/api/generate-book', {
          lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
          chunks: [
            { title: 'Kapitel W', text: 'Eine Geschichte zum Abbrechen. '.repeat(8), wordCount: 30 },
            { title: 'Kapitel X', text: 'Noch eine Geschichte hier. '.repeat(8), wordCount: 30 },
            { title: 'Kapitel Y', text: 'Und eine dritte Geschichte. '.repeat(8), wordCount: 30 },
            { title: 'Kapitel Z', text: 'Zum Schluss noch diese hier. '.repeat(8), wordCount: 30 },
          ],
          postGenAnalysis: true,
        });
        assert(start.body && start.body.bookId, 'the book job started');
        const before = idx(env.srvlog(), /deferred analysis: \d+ chapter\(s\)/).length;

        // Wait until chapter 1 is SAVED — from here it is owed an analysis and the pending list is
        // non-empty, which is the only state in which the cancel gate is observable.
        const gotOne = await waitFor(async () => {
          const st = await get(sport, '/api/book-job/' + encodeURIComponent(start.body.bookId));
          const chs = (st.body && st.body.chapters) || [];
          return chs[0] && chs[0].status === 'done';
        }, 90000);
        assert(gotOne, 'chapter 1 finished, so at least one chapter is owed an analysis');

        // ⚠️ The guard-rail on this section's own validity. Drafts (a) and (b) died here.
        const mid = await get(sport, '/api/book-job/' + encodeURIComponent(start.body.bookId));
        assert(mid.body && mid.body.status === 'running',
          `the job is genuinely still running when cancelled (got ${mid.body && mid.body.status}) — ` +
          'if this ever reads done, the slow-down stopped working and the section is vacuous again');

        await post(sport, '/api/book-job/cancel', { bookId: start.body.bookId });
        const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
        assert(final && final.status === 'cancelled',
          `the book really ended cancelled, not done (got ${final && final.status})`);
        const done = (final.chapters || []).filter(c => c.status === 'done').length;
        assert(done >= 1,
          `at least one chapter completed before the cancel, so something WAS owed an analysis ` +
          `(got ${done}) — without this the gate is untested`);

        await sleep(2000);   // ample time for a wrongly-fired deferred run to announce itself
        const after = idx(env.srvlog(), /deferred analysis: \d+ chapter\(s\)/).length;
        assert(after === before,
          'a CANCELLED book starts NO deferred analysis, even though ' + done + ' chapter(s) were ' +
          `owed one — the user said stop (deferred runs before ${before}, after ${after})`);
        console.log(`  a cancelled book with ${done} finished chapter(s) starts no deferred analysis: OK`);
      } finally {
        await post(env.fport, '/__slow', { ms: 0 });
      }
    }

    console.log('e2e-deferred-analysis: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-deferred-analysis FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
