// E2E (live server + fake Ollama): v90_p — cancelling a BOOK job actually stops the model.
//
// ⚠️ USER-REPORTED: "i tried to cancel the started bookjob by clicking x in the jobpopover, which
// recovered the draft. but the job seems to be still running." Confirmed on their server: the book
// marked `cancelled`, chapter 1 still `status:"active"` with `topicId:null`, and an open socket
// from the server to Ollama. `cancelBookJob` set `bj.status = 'cancelled'`, answered `stopped:true`,
// and nothing else — the chapter had no cancel scope at all (a bare `newJob()`, never
// `runCancellable`), so there was no `abort` to call and `_callLLM`'s own "already cancelled: do not
// START another call" checkpoint could not fire either. The loop reads the flag only at the TOP of
// each chapter, so the whole current chapter ran to completion.
//
// ⚠️ THIS IS `v88_k`'s DEFECT RETURNING THROUGH THE FRONT DOOR. `runCancellable`'s own comment in
// server.js says it: "cancelling flipped a status while the model ran to completion". `v88_k` fixed
// that for the generic job path; `v89_ag` then added the ✕ for BOOK jobs — arguing that dispatching
// on kind is "what makes the button honest rather than merely present" — but wired it to a route
// that only relabels. The button was made present without being made true.
//
// ⚠️ SO THE STATUS IS NOT ACCEPTABLE EVIDENCE HERE, and this file never asserts on it alone. The
// fake records a `{aborted:true}` entry when its socket CLOSES, which is the only honest proof the
// request to Ollama was destroyed rather than relabelled — the same evidence `e2e-job-cancel` uses,
// and for the same reason.
'use strict';
const fs = require('fs');
const { boot, post, get, assert, sleep, tmpFile } = require('./lib');

const CHUNKS = [
  { title: 'Kapitel A', text: 'Erste Geschichte hier. '.repeat(8), wordCount: 30 },
  { title: 'Kapitel B', text: 'Zweite Geschichte hier. '.repeat(8), wordCount: 30 },
  { title: 'Kapitel C', text: 'Dritte Geschichte hier. '.repeat(8), wordCount: 30 },
  { title: 'Kapitel D', text: 'Vierte Geschichte hier. '.repeat(8), wordCount: 30 },
];

(async () => {
  const env = await boot({ log: true, extraEnv: {
    DRAFTS_FILE: tmpFile('dz_drafts', '.json'),
    CANONICAL_ANALYSIS_FILE: tmpFile('dz_analysis', '.json'),
  } });
  let failed = false;
  try {
    const { sport, fport } = env;
    // Held open, so the job is reliably mid-call when the cancel lands. Flipped AFTER boot — the
    // server's own warmup() is an /api/chat call and a fake slow from process start hangs boot.
    const slow = await post(fport, '/__slow', { ms: 30000 });
    assert(slow.status === 200, `the fake now holds model calls open (got ${JSON.stringify(slow.body)})`);

    const entries = () => (fs.existsSync(env.logPath)
      ? fs.readFileSync(env.logPath, 'utf8').split('\n').filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean)
      : []);

    // ── 1. A book job reaches the model and sits in flight ───────────────────────────────────
    const started = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard', chunks: CHUNKS,
    });
    assert((started.status === 200 || started.status === 202) && started.body.bookId, `book started (got ${started.status} ${started.raw})`);
    const bookId = started.body.bookId;
    await sleep(900);

    const before = entries().length;
    assert(before >= 1, 'the book job reached the model — a request is in flight');
    assert(!entries().some(e => e.aborted), 'and nothing has been aborted yet (non-vacuity)');
    const mid = await get(sport, '/api/book-job/' + encodeURIComponent(bookId));
    assert(mid.body && mid.body.status === 'running', `the book is running (got ${mid.body && mid.body.status})`);
    console.log('  a book job reaches the model and sits in flight: OK');

    // ── 2. ⚠️ THE CANCEL DESTROYS THE IN-FLIGHT REQUEST ──────────────────────────────────────
    const cancelled = await post(sport, '/api/book-job/cancel', { bookId });
    assert(cancelled.status === 200, 'the cancel route answers 200');
    assert(cancelled.body.stopped === true,
      `the route reports it ACTUALLY stopped something (got ${JSON.stringify(cancelled.body)})`);
    await sleep(600);
    assert(entries().some(e => e.aborted),
      'the fake saw its socket CLOSE — the request to Ollama was destroyed, not merely relabelled. ' +
      'This is the whole item: without it the status reads cancelled and the model keeps generating ' +
      'to the end of the chapter, which is exactly what the user reported');
    console.log('  cancelling a book destroys the in-flight request, not just the status: OK');

    // ── 3. ⚠️ AND NO FURTHER MODEL CALLS ARE STARTED ─────────────────────────────────────────
    // The other half of `runCancellable`: `_callLLM`'s "already cancelled: do not START another
    // call" checkpoint only fires inside a cancel scope. Without it the chapter's REMAINING calls
    // (translation, then every lesson) would each start and each be individually aborted — a
    // 4-chapter book would keep issuing requests long after the click.
    const afterCancel = entries().filter(e => !e.aborted).length;
    await sleep(2500);
    const later = entries().filter(e => !e.aborted).length;
    assert(later === afterCancel,
      `no NEW model call is started after the cancel (was ${afterCancel}, now ${later}) — the ` +
      'checkpoint inside the cancel scope is what stops the next one, and a bare newJob() has none');
    console.log(`  no further model calls after the cancel (${later} total, unchanged): OK`);

    // ── 4. It settles as CANCELLED, not as an ERROR ──────────────────────────────────────────
    // The abort surfaces as CANCELLED inside the chapter's try; without the re-throw check it is
    // recorded as a chapter FAILURE, overwriting the user's own deliberate stop with a fault.
    let final = null;
    for (let i = 0; i < 40; i++) {
      const st = await get(sport, '/api/book-job/' + encodeURIComponent(bookId));
      final = st.body;
      if (final && ['cancelled', 'error', 'done'].includes(final.status)) break;
      await sleep(300);
    }
    assert(final && final.status === 'cancelled',
      `a deliberate stop settles as 'cancelled', never 'error' (got ${final && final.status}, ` +
      `error=${JSON.stringify(final && final.error)})`);
    assert(!final.error, `and carries no error message (got ${JSON.stringify(final.error)})`);
    const later3 = (final.chapters || []).slice(1).every(c => c.status === 'pending');
    assert(later3, 'the chapters after the cancelled one were never started');
    console.log('  the book settles as cancelled with no error, later chapters untouched: OK');

    // ── 5. The console says so, and says whether it ABORTED ──────────────────────────────────
    // User request. The abort half is the part worth naming: "cancelled" alone is what the old
    // status-only behaviour would also have printed, and it was not true.
    {
      const log = env.srvlog();
      const line = log.split('\n').find(l => /CANCELLED by user at chapter/.test(l));
      assert(line, 'the server logs a cancel line naming the chapter');
      assert(/in-flight model call aborted/.test(line),
        `and it states the in-flight call was ABORTED — the distinction the old behaviour could ` +
        `not make (got ${JSON.stringify(line)})`);
      assert(/chapter 1\/4/.test(line), `and names which chapter of how many (got ${JSON.stringify(line)})`);
      console.log('  the server console names the chapter and confirms the abort: OK');
    }

    console.log('e2e-book-cancel-aborts: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-book-cancel-aborts FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
