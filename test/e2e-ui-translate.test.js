// E2E (live server + fake Ollama): v88_af — the ui.json translation job.
//
// User report: *"translation job is not listed in the job popover (and ideally should be
// cancel-able)"*.
//
// ⚠️ WHAT WAS ACTUALLY WRONG, because "not listed" understates it. There are three translation
// triggers in the client. `retranslateStory()` and `retranslateChain()` were both wrapped in
// `_jobsTracked` at v88_b, so they show as `sync` rows. `triggerUITranslation()` — the third — was
// never wrapped, AND the route it calls registered no server job either. So it appeared NOWHERE:
// not in `jobs`, not as a sync row, nothing but a small inline "⏳ Translating…" in the settings
// row. Meanwhile it is one of the longest LLM operations in the app: 755 `en` keys at 40 per call
// is ~19 sequential model calls per language.
//
// It is now a REAL job rather than a `_jobsTracked` sync row, deliberately: a sync row cannot carry
// a cancel button, because `_jobsRenderList`'s `canCancel` needs a server-side job id for
// POST /api/jobs/cancel to look up. That is the diagnosis standing under the open "some LLM jobs
// have no cancel button" item, and this is the first route converted rather than worked around.
//
// The three claims here, in the order they matter:
//   1. LISTED  — /api/jobs shows it, with a label. (An unlabelled job is SKIPPED by that route by
//                design — `if (!j.label) continue` — which is exactly how it could stay invisible.)
//   2. STOPPED — cancelling ends it as 'cancelled', and the loop does NOT run to completion.
//                ⚠️ v88_z's rule: translateUIToLang wraps each batch in `try { … } catch { }`, which
//                swallows CANCELLED like any other failure unless it is re-thrown. Being inside a
//                cancel scope is necessary and NOT sufficient.
//   3. KEPT    — batches finished before the cancel are PERSISTED. v88_x's rule: `saveUI` used to
//                run once after the whole loop, so a cancelled run threw away every completed
//                batch and left nothing to resume from.
//
// The cancel is driven by OBSERVED PROGRESS (poll until the job's own step says it has reached
// batch 2), never by a timer — so claims 2 and 3 are deterministic rather than a race.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { boot, post, get, assert } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 100 English keys and a target language with none of them: 3 batches of 40/40/20, so there is a
// "batch 2" to catch the job in and a batch 3 that must never happen after a cancel.
const KEYS = 100, BATCH = 40;
const enStrings = {};
for (let i = 0; i < KEYS; i++) enStrings['k' + String(i).padStart(3, '0')] = 'English ' + i;
const uiPath = path.join(os.tmpdir(), 'dz_uitrans_' + process.pid + '.json');
fs.writeFileSync(uiPath, JSON.stringify({ en: enStrings, de: {} }, null, 2));

const readUI = () => JSON.parse(fs.readFileSync(uiPath, 'utf8'));
const deCount = () => Object.keys(readUI().de || {}).length;

(async () => {
  const env = await boot({ log: true, extraEnv: { UI_FILE: uiPath } });
  let failed = false;
  try {
    const { sport, fport } = env;

    // ── 1. THE REPORTED BUG: the job is LISTED, with a label ──────────────────────────────────
    // Slow first, so the job is still running when the listing is read — a job that finished
    // instantly would be listed too, but for the wrong reason.
    const slow = await post(fport, '/__slow', { ms: 1500 });
    assert(slow.status === 200, 'the fake holds model calls open (got ' + slow.status + ')');

    const started = await post(sport, '/api/ui-translate', { lang: 'de' });
    assert(started.status === 202,
      'the route ACCEPTS and hands back a job instead of blocking until the whole translation is '
      + 'done — blocking is what made it invisible (got ' + started.status + ' '
      + JSON.stringify(started.body) + ')');
    const jobId = started.body.jobId;
    assert(jobId, 'and it returns a jobId (got ' + JSON.stringify(started.body) + ')');

    const listed = await get(sport, '/api/jobs');
    assert(listed.status === 200, '/api/jobs answers');
    const row = (listed.body.jobs || listed.body || []).find
      ? (listed.body.jobs || listed.body).find(j => j.id === jobId) : null;
    assert(row, 'the translation job IS in the popover listing — this is the whole report (got '
      + JSON.stringify(listed.body).slice(0, 300) + ')');
    // ⚠️ The label is not cosmetic: /api/jobs SKIPS any job without one, so an unlabelled
    // registration would leave this exactly as invisible as it was before.
    assert(row.label && /translat/i.test(row.label),
      'and carries a label naming what it is (got ' + JSON.stringify(row.label) + ')');
    assert(row.kind === 'job',
      'as kind "job", NOT "sync" — only a real job id can be cancelled (got ' + row.kind + ')');
    console.log('  the UI-translation job is listed in the jobs popover, with a label: OK');

    // ── 2. Driven to a known point: wait until it REPORTS batch 2 ─────────────────────────────
    // Deterministic by construction: the job's own step is the signal, so nothing here depends on
    // how fast the machine is.
    let step = '', waited = 0;
    while (waited < 20000) {
      const st = await get(sport, '/api/job/' + jobId);
      step = String((st.body && st.body.step) || '');
      if (/batch 2\//.test(step)) break;
      if (st.body && (st.body.status === 'done' || st.body.status === 'error')) break;
      await sleep(100); waited += 100;
    }
    assert(/batch 2\//.test(step),
      'the job reports its progress per batch, and reached batch 2 (got ' + JSON.stringify(step) + ')');
    const savedMidRun = deCount();
    assert(savedMidRun === BATCH,
      'and batch 1 is ALREADY PERSISTED mid-run — the checkpoint, without which a cancelled run '
      + 'keeps nothing (got ' + savedMidRun + ' keys, expected ' + BATCH + ')');
    console.log('  progress is reported per batch, and each finished batch is persisted as it goes: OK');

    // ── 3. Cancelling actually STOPS it ───────────────────────────────────────────────────────
    const cancelled = await post(sport, '/api/jobs/cancel', { jobId });
    assert(cancelled.status === 200, 'the cancel route answers 200');
    assert(cancelled.body.stopped === true,
      'and reports it stopped something in flight — `stopped:false` would mean no abort was ever '
      + 'registered (got ' + JSON.stringify(cancelled.body) + ')');

    // Give the loop every chance to (wrongly) carry on. If CANCELLED were swallowed by the
    // per-batch catch, batch 3 would run and the job would end 'done' with all 100 keys.
    await sleep(2500);
    const fin = await get(sport, '/api/job/' + jobId);
    assert(fin.body.status === 'cancelled',
      'the job ends as CANCELLED, not done and not error — a cancel is not a failure (got '
      + fin.body.status + ')');
    console.log('  cancelling ends the job as cancelled: OK');

    // ── 4. ⚠️ v88_z's rule: the LOOP stopped, not just the status ─────────────────────────────
    // This is the assertion that separates "cancelled" from "relabelled while it kept going". The
    // per-batch try/catch swallows CANCELLED unless re-thrown; without the re-throw the run would
    // finish every remaining batch and this count would be all 100.
    const after = deCount();
    assert(after < KEYS,
      'the remaining batches did NOT run — a swallowed CANCELLED would have translated all '
      + KEYS + ' keys anyway (got ' + after + ')');
    assert(after === savedMidRun,
      'and nothing landed after the cancel: the count is exactly what batch 1 had persisted (got '
      + after + ', batch 1 had ' + savedMidRun + ')');
    console.log('  the cancel stops the BATCH LOOP, not just the status (v88_z\'s rule): OK');

    // ── 5. …and the work already paid for is KEPT ─────────────────────────────────────────────
    // v88_x's rule. The values are the fake's own marker prefix, so this cannot pass on English
    // strings that were merely copied through.
    const de = readUI().de;
    assert(Object.keys(de).length === BATCH, 'exactly the first batch survives the cancel');
    assert(de.k000 === 'XX English 0',
      'and it holds real TRANSLATED values, not the English ones (got ' + JSON.stringify(de.k000) + ')');
    assert(de.k039 && !de.k040, 'the batch boundary is where it stopped (k039 present, k040 absent)');
    console.log('  a cancelled run keeps every batch it had already finished: OK');

    // ── 6. Re-running resumes: only the keys still missing are sent to the model ──────────────
    // The checkpoint is what makes this cheap, and it is the reason a cancel is safe to press.
    await post(fport, '/__slow', { ms: 0 });
    const again = await post(sport, '/api/ui-translate', { lang: 'de' });
    assert(again.status === 202, 'a second run starts (got ' + again.status + ')');
    let done = false;
    for (let i = 0; i < 100 && !done; i++) {
      const st = await get(sport, '/api/job/' + again.body.jobId);
      if (st.body.status === 'done') done = true; else await sleep(100);
    }
    assert(done, 'and completes');
    assert(deCount() === KEYS, 'every key is translated now (got ' + deCount() + ')');
    assert(readUI().de.k000 === 'XX English 0',
      'and the batch that survived the cancel was NOT re-translated — it kept its original value');
    console.log('  a re-run resumes from the checkpoint and finishes the rest: OK');

    console.log('e2e-ui-translate: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
    try { fs.unlinkSync(uiPath); } catch (_) {}
  }
  process.exit(failed ? 1 : 0);
})();
