// E2E (live server + fake Ollama): item AU, cancel third (v88_k) — cancelling a job actually stops
// the model call, instead of relabelling a job that keeps running.
//
// User request: "it would be great to have individual cancel buttons in the new 'running jobs'
// popover."
//
// ⚠️ WHAT WAS ACTUALLY BROKEN. `POST /api/jobs/cancel` has called `job.abort()` since it was
// written — but NOTHING in the codebase ever SET `job.abort` (grepped: one occurrence, the call
// itself). So cancelling flipped a status field to 'cancelled' while the request ran to completion:
// the popover said stopped, the GPU disagreed, and the next job queued behind one nobody wanted.
//
// The claim under test is therefore NOT "the route returns ok" — it always did. It is that the
// in-flight HTTP request to Ollama is DESTROYED. Destroying the socket is what stops Ollama (it
// aborts generation when the client disconnects), so the fake records its own 'close' event: that
// is the only honest evidence, since a server that merely relabels a job produces an identical
// status and an identical 200.
'use strict';
const fs = require('fs');
const { boot, post, get, assert } = require('./lib');

const TINY = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // FAKE_SLOW_MS holds every model call open for 30s, so the job is reliably mid-call when the
  // cancel arrives — the state that matters and the only one where abort is observable.
  // Flipped AFTER boot, via the fake's own control endpoint. It cannot be an env var: the server's
  // boot-time warmup() is itself an /api/chat call, so a fake that is slow from process start hangs
  // boot — which is how the first two versions of this file "failed" against correct code.
  const env = await boot({ log: true });
  let failed = false;
  try {
    const { sport, fport } = env;
    const slow = await post(fport, '/__slow', { ms: 30000 });
    assert(slow.status === 200 && slow.body.slowMs === 30000,
      'the fake now holds model calls open (got ' + JSON.stringify(slow.body) + ')');
    const entries = () => (fs.existsSync(env.logPath)
      ? fs.readFileSync(env.logPath, 'utf8').split('\n').filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean)
      : []);

    // ── 1. Start a real job and let it reach the model ────────────────────────────────────────
    const started = await post(sport, '/api/comic-extract',
      { images: [TINY], lang: 'nl', extract: true });
    assert(started.status === 202, 'extraction accepted (got ' + started.status + ')');
    const jobId = started.body.jobId;
    await sleep(700);

    assert(entries().length >= 1, 'the job reached the model — a request is in flight');
    assert(!entries().some(e => e.aborted), 'and nothing has been aborted yet (non-vacuity)');
    const mid = await get(sport, '/api/job/' + jobId);
    assert(mid.body.status === 'running', 'the job is running (got ' + mid.body.status + ')');
    console.log('  a job reaches the model and sits in flight: OK');

    // ── 2. Cancel it — and the IN-FLIGHT REQUEST is destroyed ─────────────────────────────────
    const cancelled = await post(sport, '/api/jobs/cancel', { jobId });
    assert(cancelled.status === 200, 'the cancel route answers 200');
    assert(cancelled.body.stopped === true,
      'the route reports it ACTUALLY stopped something — `stopped:false` would mean job.abort was '
      + 'never registered, which is precisely the bug this item fixes '
      + '(got ' + JSON.stringify(cancelled.body) + ')');
    await sleep(500);
    assert(entries().some(e => e.aborted),
      'the fake saw its socket CLOSE — the request to Ollama was destroyed, not merely relabelled. '
      + 'This is the whole item: without it the status says cancelled and the model keeps running');
    console.log('  cancelling destroys the in-flight request, not just the status: OK');

    // ── 3. The job settles as CANCELLED, not as an error ──────────────────────────────────────
    // A deliberate stop must not surface as an alarming failure the user caused themselves.
    {
      const t0 = Date.now();
      let st = null;
      while (Date.now() - t0 < 8000) {
        const r = await get(sport, '/api/job/' + jobId);
        st = r.body && r.body.status;
        if (st === 'cancelled' || st === 'error' || st === 'done') break;
        await sleep(200);
      }
      assert(st === 'cancelled',
        'the job ends as "cancelled", not "error" — an abort surfaces as "socket hang up" unless it '
        + 'is distinguished deliberately (got ' + st + ')');
      console.log('  the job settles as cancelled rather than failed: OK');
    }

    // ── 4. Cancelling an UNKNOWN or finished job is honest about doing nothing ────────────────
    {
      const none = await post(sport, '/api/jobs/cancel', { jobId: 'nope' });
      assert(none.status === 200 && none.body.stopped === false,
        'an unknown job id reports stopped:false rather than claiming a stop (got '
        + JSON.stringify(none.body) + ')');
      const again = await post(sport, '/api/jobs/cancel', { jobId });
      assert(again.body.stopped === false,
        'cancelling an already-cancelled job does not claim to stop it a second time');
      console.log('  cancelling an unknown or already-stopped job claims nothing: OK');
    }

    // ── 5. EVERY labelled job kind is cancellable ────────────────────────────────────────────
    // ⚠️ The reason this section exists: `v88_k` wrapped THREE job kinds and shipped a cancel button
    // for ALL of them. The user then found the button missing — and the investigation showed the
    // job they actually had running (add-lesson) was one of the FIVE unwrapped kinds, so the button
    // would have appeared and done nothing but flip a status. "A dead cancel button is worse than
    // none" was the stated principle and the code violated it.
    //
    // Source-level on purpose: this is a claim about a SET of call sites, and no single running job
    // can observe it. Every `newJob({ label: … })` is a job the popover LISTS and therefore offers a
    // cancel button for, so every one of them must run inside a cancel scope.
    {
      const path = require('path');
      const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
      const lines = src.split('\n');
      const unwrapped = [];
      lines.forEach((l, i) => {
        if (!/newJob\(\{/.test(l)) return;
        // A labelled job is a user-facing one (newJob()'s own comment); labelless sub-jobs are
        // deliberately excluded from the popover and so need no button.
        const head = lines.slice(i, i + 6).join('\n');
        if (!/label:/.test(head)) return;
        // Bounded by the NEXT newJob() rather than a fixed span: add-lesson's own launch is 69
        // lines below its newJob() (a long doGenLesson definition sits between), and a fixed window
        // wide enough for that would start borrowing the neighbouring route's wrap. A job's launch
        // always precedes the next job's creation, so that is the honest boundary.
        let end = lines.length;
        for (let k = i + 1; k < lines.length; k++) if (/newJob\(\{/.test(lines[k])) { end = k; break; }
        const body = lines.slice(i, end).join('\n');
        if (!/runCancellable\(jobId/.test(body)) unwrapped.push(i + 1);
      });
      assert(unwrapped.length === 0,
        'every LABELLED job runs inside runCancellable — the popover offers a cancel button for all '
        + 'of them, so an unwrapped one is a button that lies. Unwrapped at line(s): '
        + unwrapped.join(', '));
      console.log('  every labelled job kind runs inside a cancel scope: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-job-cancel: FAILED' : 'e2e-job-cancel: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
