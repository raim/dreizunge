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

    // ── 6. v88_z: no per-item catch SWALLOWS a cancel ────────────────────────────────────────
    // ⚠️ Being inside a cancel scope is necessary and NOT sufficient. `runCancellable` makes the
    // in-flight model call throw CANCELLED — but a runner that loops over items and wraps each one
    // in `try { … } catch { continue; }` catches that throw like any other failure. The loop then
    // runs to the end, every remaining item "failing" silently, and the job reports DONE. The user
    // presses cancel, the popover agrees, and the GPU keeps working: the exact symptom §1-§4 exist
    // to prevent, reintroduced one level lower.
    //
    // `v88_k` fixed this in `_runComicExtractJob` and left the others unaudited (the session prompt
    // said so in as many words). `_runQc`'s per-item `_check` and `_runRecreateJob`'s three
    // per-chapter catches were both swallowing. Asserted over the SET rather than over the three
    // that were fixed — `v88_b`'s lesson — so a fourth loop added later cannot ship swallowing.
    //
    // The rule: inside a cancellable runner, a catch that CONTINUES (does not re-throw and does not
    // end the run) must test for CANCELLED first. Catches that re-throw unconditionally, and the
    // outermost one that routes to jobFailOrCancel, are exactly the ones that already behave.
    {
      const path = require('path');
      const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
      // The runners a cancel can actually interrupt: every function named as runCancellable's work.
      const runners = [...src.matchAll(/runCancellable\(jobId,\s*(?:\(\)\s*=>\s*)?(_run[A-Za-z]+|generate|doGenLesson)\b/g)]
        .map(m => m[1]);
      assert(runners.length >= 5,
        `the sweep found the cancellable runners (got ${runners.length}: ${runners.join(', ')}) — a `
        + 'short list means the pattern stopped matching, not that every runner is clean');

      // ⚠️ Scoped to try blocks that actually AWAIT. A synchronous try — writing a checkpoint,
      // building an index — cannot throw CANCELLED, because only an in-flight model call does. The
      // first version of this sweep flagged every catch in every runner and named eight sites, six
      // of them synchronous: a rule that reports correct code is a rule nobody keeps. The block is
      // BRACE-MATCHED rather than sampled by a line window, so the "does it await" question is asked
      // of the real try body.
      const offenders = [];
      const matchBlock = (src, openIdx) => {           // openIdx points at the '{'
        let depth = 0;
        for (let i = openIdx; i < src.length; i++) {
          if (src[i] === '{') depth++;
          else if (src[i] === '}') { depth--; if (!depth) return i; }
        }
        return -1;
      };
      for (const name of new Set(runners)) {
        const at = src.indexOf(`async function ${name}(`);
        if (at < 0) continue;                       // an inline/nested runner has no top-level decl
        const end = src.indexOf('\n}\n', at);
        const body = src.slice(at, end < 0 ? src.length : end);
        for (const m of body.matchAll(/\btry\s*\{/g)) {
          const open = m.index + m[0].length - 1;
          const close = matchBlock(body, open);
          if (close < 0) continue;
          const tryBody = body.slice(open, close);
          if (!/\bawait\b/.test(tryBody)) continue;   // cannot be interrupted by a cancel
          const after = body.slice(close + 1, close + 400);
          if (!/^\s*catch\s*\(/.test(after)) continue;
          const handler = after.slice(0, 400);
          if (/CANCELLED/.test(handler) || /throw\b/.test(handler)) continue;
          if (/jobFail/.test(handler)) continue;      // ends the run; not a "continue anyway" catch
          offenders.push(`${name}@${body.slice(0, open).split('\n').length}`);
        }
      }
      assert(offenders.length === 0,
        'no per-item catch inside a cancellable runner swallows a cancel — one that does makes the '
        + 'whole cancel a lie, however correctly the job was wrapped. Swallowing at: '
        + offenders.join(', '));
      console.log('  no per-item catch inside a cancellable runner swallows a cancel: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-job-cancel: FAILED' : 'e2e-job-cancel: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
