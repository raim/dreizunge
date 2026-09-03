// E2E (live server + fake Ollama): v88_ag — story QC and summary QC are real, cancellable jobs.
//
// User report: a job was missing from the popover. It was first read as the translation button and
// fixed there (v88_af, a real but DIFFERENT defect); the user then clarified: *"above message was
// potentially wrong, i had click a QC, not the translation button."* This file covers the actual
// one.
//
// ⚠️ THREE QC entry points existed and only ONE of them was a job. `/api/qc` (the lesson QC sweep)
// has always registered `newJob`. `/api/story-qc` and `/api/summary-qc` both AWAITED the proofread
// and answered only when it finished, registering nothing — and neither `runStoryQc()` nor
// `runSummaryQc()` was wrapped in `_jobsTracked` either. So clicking QC on a story ran a full-story
// model call with NO row anywhere in the popover, which is exactly what was reported.
//
// Both are converted here, not just the one that was clicked — "where else is this question asked?".
// They are the same control in two places, and fixing one would have left the other waiting for the
// next report.
//
// Real jobs rather than `_jobsTracked` sync rows, for the reason established at v88_af: a sync row
// cannot carry a cancel button, because `_jobsRenderList`'s `canCancel` needs a server-side job id
// for POST /api/jobs/cancel to look up.
'use strict';
const { boot, post, get, assert } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SEED = {
  schemaVersion: 29, flags: {}, progress: {},
  topics: [
    { id: 'tp_qc1', topic: 'QC Fixture', lang: 'de', srcLang: 'en',
      story: 'Der Hund lauft. Die Katze schlaft.', lessons: [] },
  ],
  storylines: [
    { id: 'sl_qc1', title: 'QC Storyline', chapters: ['tp_qc1'], srcLang: 'en',
      summary: 'Ein kurzer Ueberblick ueber die Kapitel.' },
  ],
};

(async () => {
  const env = await boot({ log: true, seed: SEED });
  let failed = false;
  try {
    const { sport, fport } = env;
    // Hold model calls open so the job is reliably still running when the listing is read and the
    // cancel is sent — the only state in which either claim is observable. Flipped AFTER boot: the
    // server's own warmup is a model call, and a fake that is slow from process start hangs boot.
    const slow = await post(fport, '/__slow', { ms: 30000 });
    assert(slow.status === 200, 'the fake holds model calls open (got ' + slow.status + ')');

    // ── 1. THE REPORTED BUG: story QC is a listed job ─────────────────────────────────────────
    const started = await post(sport, '/api/story-qc', { topicId: 'tp_qc1' });
    assert(started.status === 202,
      'story QC ACCEPTS and hands back a job instead of blocking until the proofread finishes — '
      + 'blocking is what made it invisible (got ' + started.status + ' ' + JSON.stringify(started.body) + ')');
    const jobId = started.body.jobId;
    assert(jobId, 'and returns a jobId (got ' + JSON.stringify(started.body) + ')');

    const rows = (await get(sport, '/api/jobs')).body;
    const list = rows.jobs || rows;
    const row = list.find(j => j.id === jobId);
    assert(row, 'the story-QC job IS in the popover listing — the whole report (got '
      + JSON.stringify(list).slice(0, 300) + ')');
    // ⚠️ The label is load-bearing, not decoration: /api/jobs SKIPS any job without one
    // (`if (!j.label) continue`, for labelless per-chapter sub-jobs), so an unlabelled registration
    // would leave this exactly as invisible as before the fix.
    assert(row.label && /proofread/i.test(row.label),
      'and carries a label saying what it is (got ' + JSON.stringify(row.label) + ')');
    assert(row.kind === 'job', 'as kind "job" — only a real job id can be cancelled (got ' + row.kind + ')');
    assert(row.link && row.link.type === 'topic' && row.link.id === 'tp_qc1',
      'and links back to the chapter it is proofreading (got ' + JSON.stringify(row.link) + ')');
    console.log('  story QC is a listed job, labelled and linked (v88_ag): OK');

    // ── 2. …and it is CANCELLABLE ─────────────────────────────────────────────────────────────
    const cancelled = await post(sport, '/api/jobs/cancel', { jobId });
    assert(cancelled.status === 200, 'the cancel route answers 200');
    assert(cancelled.body.stopped === true,
      'and reports it actually stopped something in flight — `stopped:false` would mean no abort '
      + 'was registered, i.e. runCancellable was never applied (got ' + JSON.stringify(cancelled.body) + ')');
    await sleep(500);
    const fin = await get(sport, '/api/job/' + jobId);
    assert(fin.body.status === 'cancelled',
      'the job ends as CANCELLED, not error — a cancel is not a failure (got ' + fin.body.status + ')');
    // A cancelled proofread must not leave a proposal behind: the user stopped it precisely because
    // they did not want its answer.
    const store = env.readStore();
    const t = store.topics.find(x => x.id === 'tp_qc1');
    assert(!t.storyQcProposal,
      'and no QC proposal was persisted by the cancelled run (got ' + JSON.stringify(t.storyQcProposal) + ')');
    console.log('  cancelling story QC stops it and leaves no proposal behind: OK');

    // ── 3. Summary QC got the SAME treatment ──────────────────────────────────────────────────
    // Not the button the user clicked, and converted anyway: the two are the same control in two
    // places, and only one of them being a job is how this class of report repeats.
    const s2 = await post(sport, '/api/summary-qc', { slId: 'sl_qc1', srcLang: 'en' });
    assert(s2.status === 202, 'summary QC also returns a job (got ' + s2.status + ')');
    const row2 = ((await get(sport, '/api/jobs')).body.jobs || []).find(j => j.id === s2.body.jobId);
    assert(row2 && /proofread/i.test(row2.label || ''),
      'and is listed with its own label (got ' + JSON.stringify(row2 && row2.label) + ')');
    assert(row2.link && row2.link.type === 'storyline' && row2.link.id === 'sl_qc1',
      'linking back to the storyline (got ' + JSON.stringify(row2.link) + ')');
    const c2 = await post(sport, '/api/jobs/cancel', { jobId: s2.body.jobId });
    assert(c2.body.stopped === true, 'and it is cancellable too');
    console.log('  summary QC is a listed, cancellable job as well: OK');

    // ── 4. A job that RUNS TO COMPLETION still delivers the same payload ───────────────────────
    // The conversion must not change what the client gets, only how it arrives: the fields the
    // proposal is built from now travel as the job's `data` instead of as the response body.
    await post(fport, '/__slow', { ms: 0 });
    const ok = await post(sport, '/api/story-qc', { topicId: 'tp_qc1' });
    assert(ok.status === 202, 'a third run starts (got ' + ok.status + ')');
    let done = null;
    for (let i = 0; i < 100 && !done; i++) {
      const st = await get(sport, '/api/job/' + ok.body.jobId);
      if (st.body.status === 'done') done = st.body; else if (st.body.status === 'error')
        throw new Error('QC job errored: ' + st.body.error);
      else await sleep(100);
    }
    assert(done, 'and completes');
    for (const f of ['corrected', 'original', 'verdict', 'changedSentences', 'totalSentences'])
      assert(done.data && f in done.data,
        `the job's data carries "${f}", the same field the response body used to (got `
        + JSON.stringify(done.data) + ')');
    assert(done.data.original === 'Der Hund lauft. Die Katze schlaft.',
      'and `original` is the story it was diffed against');
    // The proposal is persisted too, exactly as before — that is what survives a client refresh.
    const t2 = env.readStore().topics.find(x => x.id === 'tp_qc1');
    assert(t2.storyQcProposal && t2.storyQcProposal.corrected,
      'and the proposal is persisted server-side (got ' + JSON.stringify(t2.storyQcProposal) + ')');
    console.log('  a completed QC job delivers the same payload, as job data, and persists the proposal: OK');

    console.log('e2e-qc-job: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
  }
  process.exit(failed ? 1 : 0);
})();
