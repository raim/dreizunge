// E2E (live server + fake Ollama): v88_al — the last five blocking LLM routes became listed,
// cancellable jobs.
//
// User ruling, closing the open "some LLM-based jobs still have no cancel BUTTON" item: *"let's
// convert all five together behind one poller."*
//
// ⚠️ WHY A SYNC ROW COULD NEVER BE ENOUGH. `v88_b` made these routes VISIBLE by registering a
// client-side `kind:'sync'` placeholder while the fetch was open. But `_jobsRenderList`'s
// `canCancel` is `j.kind === 'job' && …`, and that is not an oversight: a sync row has **no
// server-side job id** for POST /api/jobs/cancel to look up, so a ✕ on one would be a button that
// lies. Converting the routes is what makes the cancel real, which is why the fix is here and not
// in the popover.
//
// The claims, per route, all five:
//   1. LISTED    — answers 202 + {jobId}, and /api/jobs shows it with a LABEL. (An unlabelled job is
//                  SKIPPED by that route by design, which is how one could stay invisible.)
//   2. CANCELLED — POST /api/jobs/cancel reports it stopped something in flight, and the job ends
//                  'cancelled' rather than 'error'.
//   3. SAME PAYLOAD — a job that runs to completion carries exactly the fields the response body
//                  used to, so no client reads anything different, only from a different place.
'use strict';
const { boot, post, get, assert } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const SEED = {
  schemaVersion: 29, flags: {}, progress: {},
  topics: [
    { id: 'tp_j1', topic: 'Job Fixture One', lang: 'de', srcLang: 'en',
      story: 'Der Hund lauft. Die Katze schlaft.', lessons: [] },
    { id: 'tp_j2', topic: 'Job Fixture Two', lang: 'de', srcLang: 'en',
      story: 'Der Vogel singt schon.', lessons: [] },
  ],
  storylines: [
    { id: 'sl_j1', title: 'Job Storyline', chapters: ['tp_j1', 'tp_j2'], srcLang: 'en', lang: 'de' },
  ],
};

// Every converted route, with a body that passes its own validation. Validation deliberately stays
// OUTSIDE the job (a 400/404/503 is an answer about the REQUEST), so these must be well-formed or
// the route would answer with a status code instead of a job — which §0 checks explicitly.
const ROUTES = [
  { path: '/api/retranslate-story', body: { topicId: 'tp_j1' },
    expect: ['storyTranslation'], label: /translat/i },
  { path: '/api/storyline-title', body: { topics: ['Job Fixture One'], slId: 'sl_j1' },
    expect: ['title'], label: /title/i },
  { path: '/api/storyline-summary', body: { slId: 'sl_j1', topics: ['Job Fixture One', 'Job Fixture Two'] },
    expect: ['summary'], label: /summary/i },
  { path: '/api/storyline-retitle', body: { slId: 'sl_j1', scope: 'title' },
    expect: ['title'], label: /titl/i },
  { path: '/api/writing-feedback',
    body: { text: 'Der Hund lauft schnell.', lang: 'de', srcLang: 'en',
            question: 'Beschreibe den Hund.', story: 'Der Hund lauft.' },
    expect: ['correctness', 'issues'], label: /writing/i },
];

(async () => {
  const env = await boot({ log: true, seed: SEED });
  let failed = false;
  try {
    const { sport, fport } = env;

    // ── 0. A REJECTED request still answers with its own status, not a job ────────────────────
    // Validation outside the producer is a deliberate property: turning a malformed call into a
    // failed job would make it look like a model failure in the popover and rob the caller of its
    // status code. Checked first, because every later assertion assumes well-formed bodies.
    {
      const bad = await post(sport, '/api/storyline-summary', { slId: 'sl_j1' });   // no topics
      assert(bad.status === 400,
        'a request that fails validation answers 400, NOT 202+jobId (got ' + bad.status + ')');
      assert(!bad.body.jobId, 'and mints no job for it');
      const missing = await post(sport, '/api/retranslate-story', { topicId: 'nope' });
      assert(missing.status === 404, 'and a missing topic is still a 404 (got ' + missing.status + ')');
      console.log('  validation still answers with its own status code, not a job: OK');
    }

    // ── 1 + 2. Each route: listed with a label, and genuinely cancellable ─────────────────────
    // Slow first, so every job is reliably still running when its listing is read and its cancel is
    // sent — the only state in which either claim is observable.
    const slow = await post(fport, '/__slow', { ms: 30000 });
    assert(slow.status === 200, 'the fake holds model calls open (got ' + slow.status + ')');

    for (const r of ROUTES) {
      const started = await post(sport, r.path, r.body);
      assert(started.status === 202,
        r.path + ' ACCEPTS and hands back a job instead of blocking (got ' + started.status + ' '
        + JSON.stringify(started.body) + ')');
      const jobId = started.body.jobId;
      assert(jobId, r.path + ' returns a jobId');

      const list = (await get(sport, '/api/jobs')).body.jobs || [];
      const row = list.find(j => j.id === jobId);
      assert(row, r.path + ' IS listed in the jobs popover (got ' + JSON.stringify(list).slice(0, 200) + ')');
      // ⚠️ The label is load-bearing: /api/jobs skips any job without one.
      assert(row.label && r.label.test(row.label),
        r.path + ' carries a label saying what it is (got ' + JSON.stringify(row.label) + ')');
      assert(row.kind === 'job',
        r.path + ' is kind "job" — the ONLY kind the popover offers a cancel for (got ' + row.kind + ')');

      const cancelled = await post(sport, '/api/jobs/cancel', { jobId });
      assert(cancelled.body.stopped === true,
        r.path + ' cancel actually stopped something in flight — `stopped:false` would mean '
        + 'runCancellable was never applied (got ' + JSON.stringify(cancelled.body) + ')');
      await sleep(300);
      const fin = await get(sport, '/api/job/' + jobId);
      assert(fin.body.status === 'cancelled',
        r.path + ' ends as CANCELLED, not error — a cancel is not a failure (got ' + fin.body.status + ')');
      console.log('  ' + r.path + ': listed, labelled, and cancellable: OK');
    }

    // ── 3. Run to completion: the payload is unchanged ────────────────────────────────────────
    // The conversion must change only WHERE the payload arrives, never WHAT it contains — that is
    // what lets every call site keep reading the same fields.
    await post(fport, '/__slow', { ms: 0 });
    for (const r of ROUTES) {
      const started = await post(sport, r.path, r.body);
      assert(started.status === 202, r.path + ' starts again');
      let done = null;
      for (let i = 0; i < 120 && !done; i++) {
        const st = await get(sport, '/api/job/' + started.body.jobId);
        if (st.body.status === 'done') done = st.body;
        else if (st.body.status === 'error') throw new Error(r.path + ' errored: ' + st.body.error);
        else await sleep(100);
      }
      assert(done, r.path + ' completes');
      for (const f of r.expect)
        assert(done.data && f in done.data,
          r.path + " job data carries '" + f + "', the same field its response body used to (got "
          + JSON.stringify(done.data) + ')');
      console.log('  ' + r.path + ': completed job carries the original payload: OK');
    }

    console.log('e2e-sync-routes-as-jobs: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
  }
  process.exit(failed ? 1 : 0);
})();
