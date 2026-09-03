// unit-jobs-sync-inflight.test.js
// item AT (v88_b) — a SYNCHRONOUS, model-backed route must be visible in the jobs popover.
//
// The report: "Storyline title re-generation did not appear in the running job popover. It should."
// The measured cause is not a rendering bug. POST /api/storyline-retitle awaits its LLM calls inline
// and never calls newJob(), so GET /api/jobs has nothing to aggregate — the job does not exist.
// Four sibling routes have the identical shape (/api/storyline-title, /api/storyline-summary,
// /api/retranslate-story, /api/writing-feedback); retitle is just the one the user waited on.
//
// The fix is a client-side in-flight registry (_jobsTracked), generalising the precedent the tutor
// entry already set. What this file asserts is the BEHAVIOUR — an entry appears for exactly as long
// as the call is in flight — not the source text of any call site. §4 is the one deliberately
// source-level section, and only because "all five routes are wrapped" is a claim about a SET of
// call sites, which no single rendered state can observe.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

function client() {
  const C = loadClient({ quiet: true });
  C.run(`APP.info = { canGenerate: true };
    UI_STRINGS = ${JSON.stringify(JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8')).en)};
    _jobsLastList = [{ id:'j1', kind:'job', label:'Generating "X"', status:'running',
      step:'working…', error:null, link:null, createdAt:1 }];
    _tutorState.busy = false;
    true;`, 'seed');
  return C;
}

(async () => {
  let failed = false;
  try {

    // ── 1. An entry exists WHILE in flight, and is gone AFTER ──────────────────────────────────
    // The whole claim of the item, exercised through the real _jobsTracked with a promise this
    // test controls, so "in flight" is a state the assertion can actually stand inside.
    {
      const C = client();
      C.run(`
        _resolveIt = null;
        _trackedPromise = _jobsTracked('Re-titling…', () => new Promise(r => { _resolveIt = r; }));
        _during = _jobsEffectiveList();
        true;`, 'during');
      const during = C.run('JSON.parse(JSON.stringify(_during))', 'read-during');
      assert.strictEqual(during.length, 2, 'in flight: the real job + one synthetic entry');
      assert.strictEqual(during[0].kind, 'sync', 'the synthetic entry is FIRST (newest)');
      assert.strictEqual(during[0].label, 'Re-titling…', 'it carries the label the caller passed');
      assert.strictEqual(during[0].status, 'running', 'and reports running, so the badge counts it');
      assert.strictEqual(during[1].id, 'j1', 'the real server job is untouched behind it');
      console.log('  a tracked call is visible while in flight, above the real jobs: OK');

      await C.run(`(async () => { _resolveIt('ok'); await _trackedPromise; })()`, 'settle');
      const after = C.run('JSON.parse(JSON.stringify(_jobsEffectiveList()))', 'read-after');
      assert.strictEqual(after.length, 1, 'once settled the synthetic entry is GONE');
      assert.strictEqual(after[0].id, 'j1', 'and only the real job remains');
      console.log('  the entry disappears once the call settles: OK');
    }

    // ── 2. A FAILING call must not leave a phantom job running forever ─────────────────────────
    // try/finally, not then/catch. Without it, an offline re-title would park a permanent "running"
    // row and a permanent badge count — a worse bug than the invisible one this item fixes.
    {
      const C = client();
      const out = await C.run(`(async () => {
        let threw = false;
        try { await _jobsTracked('Boom', () => Promise.reject(new Error('offline'))); }
        catch(e){ threw = true; }
        return { threw, n: _jobsEffectiveList().length, size: _jobsInflight.size };
      })()`, 'reject');
      assert.strictEqual(out.threw, true, 'the rejection still reaches the caller — tracking must not swallow it');
      assert.strictEqual(out.size, 0, 'the registry is empty again');
      assert.strictEqual(out.n, 1, 'and the popover is back to just the real job');
      console.log('  a REJECTED call removes its entry and re-throws (no phantom job): OK');
    }

    // ── 3. Concurrent calls, and coexistence with the tutor entry ──────────────────────────────
    {
      const C = client();
      C.run(`
        _rs = [];
        _p1 = _jobsTracked('One', () => new Promise(r => _rs.push(r)));
        _p2 = _jobsTracked('Two', () => new Promise(r => _rs.push(r)));
        _tutorState.busy = true;
        true;`, 'concurrent');
      const eff = C.run('JSON.parse(JSON.stringify(_jobsEffectiveList()))', 'read');
      assert.strictEqual(eff.length, 4, 'tutor + two tracked calls + the real job');
      assert.strictEqual(eff[0].kind, 'tutor', 'the tutor keeps its first position (unchanged behaviour)');
      assert.deepStrictEqual(eff.slice(1, 3).map(e => e.label), ['One', 'Two'],
        'both tracked calls are listed, in registration order');
      assert.strictEqual(new Set(eff.map(e => e.id)).size, 4, 'every id is distinct — no collision between synthetic entries');
      console.log('  two concurrent tracked calls coexist with the tutor entry, ids distinct: OK');

      await C.run(`(async () => { _rs.forEach(r => r()); await Promise.all([_p1, _p2]); })()`, 'settle2');
      const n = C.run('_jobsEffectiveList().length', 'read2');
      assert.strictEqual(n, 2, 'both cleared; tutor (still busy) + the real job remain');
      console.log('  both clear independently: OK');
    }

    // ── 4. The synthetic entry RENDERS, and offers no bogus "open" ─────────────────────────────
    // These entries carry link:null on purpose — there is nothing to navigate to for a call that is
    // still running and has no persisted id. _jobsRenderList must therefore omit the open button.
    {
      const C = client();
      C.run(`_jobsLastList = []; _tutorState.busy = false;
        _r = null; _jobsTracked('Re-titling…', () => new Promise(x => { _r = x; }));
        document.getElementById('jobs-pop-list').innerHTML = '';
        _jobsRenderList(); true;`, 'render');
      const html = C.run(`document.getElementById('jobs-pop-list').innerHTML`, 'read-html');
      assert.ok(html.includes('Re-titling…'), 'the label is rendered');
      assert.ok(!html.includes('jobs-row-open'), 'no open button — the entry has no link to follow');
      assert.ok(!html.includes('jobs-row-del'), 'and no discard button — it is not a draft');
      console.log('  the row renders its label, with neither an open nor a discard button: OK');
    }

    // ── 5. All five routes are AWAITED AS JOBS at every call site ──────────────────────────────
    // ⚠️ v88_al RE-SCOPED THIS TO THE OPPOSITE CLAIM — the fifth time in this line a guard had
    // become an assertion of the wrong thing rather than a failing one. It asserted every caller of
    // these five is inside a `_jobsTracked(...)` wrapper, which was `v88_b`'s design: make a
    // BLOCKING route visible in the popover. The user then ruled "let's convert all five together
    // behind one poller", because a `sync` row can never carry a cancel button — it has no
    // server-side job id for POST /api/jobs/cancel to look up.
    //
    // Its VALUE is unchanged and is why it is re-scoped rather than deleted: this is a claim about a
    // SET of call sites, which no single rendered state can observe. Nine call sites across five
    // routes; a tenth added later without the poller is what should fail here.
    {
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const routes = ['/api/storyline-retitle', '/api/storyline-title', '/api/storyline-summary',
                      '/api/retranslate-story', '/api/writing-feedback'];
      let total = 0;
      for (const route of routes) {
        let from = 0, hits = 0;
        for (;;) {
          const at = src.indexOf(`fetch('${route}'`, from);
          if (at < 0) break;
          hits++; total++;
          // `_jobAwait(await fetch(...))` — the helper opens immediately before the fetch now, but
          // the window stays generous so a reformat cannot fail this for cosmetic reasons.
          const before = src.slice(Math.max(0, at - 400), at);
          assert.ok(before.includes('_jobAwait('),
            `${route} at offset ${at} is awaited as a JOB (_jobAwait), not left blocking`);
          // And the superseded wrapper is gone from these call sites entirely — the removal half,
          // which a one-sided check would miss.
          assert.ok(!before.includes('_jobsTracked('),
            `${route} at offset ${at} no longer goes through the sync-row wrapper`);
          from = at + 1;
        }
        assert.ok(hits > 0, `found at least one caller of ${route}`);
      }
      assert.ok(total >= 9,
        `non-vacuity: all nine known call sites are covered (found ${total})`);
      console.log('  all five converted routes are awaited as jobs at every call site (' + total + '): OK');
    }

    // ── 5b. …and the server really answers them as jobs ────────────────────────────────────────
    // The client half above is only true if the routes changed too. Asserted at the source layer on
    // server.js: each of the five returns through `runAsJob`, the one shape they now share.
    {
      const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const routes = ['/api/storyline-retitle', '/api/storyline-title', '/api/storyline-summary',
                      '/api/retranslate-story', '/api/writing-feedback'];
      for (const route of routes) {
        const at = srv.indexOf(`url.pathname === '${route}'`);
        assert.ok(at > 0, `${route} exists server-side`);
        // Bounded by the next route handler, so this cannot borrow a neighbour's body.
        const next = srv.indexOf("if (M === 'POST' && url.pathname === '/api/", at + 10);
        const body = srv.slice(at, next > at ? next : at + 6000);
        assert.ok(/return runAsJob\(/.test(body),
          `${route} answers through runAsJob — a listed, cancellable job`);
      }
      assert.ok(/function runAsJob\(res, meta, producer\)/.test(srv),
        'and runAsJob is the single shape they share');
      console.log('  and the server answers all five through runAsJob: OK');
    }

  // ── v88_ag: _qcPoll must TERMINATE on a response it cannot interpret ───────────────────────
  // ⚠️ This section exists because the first version of that poller did not, and the failure mode
  // was not a wrong answer — it was a SUITE THAT HUNG. `unit-lesson-set-story-explorer` printed
  // ALL PASSED and then never exited, because a stubbed fetch answered the poll with a body that
  // had no `status`, and the poller treated "unrecognised" as "still running" and re-armed a 2s
  // timer forever. v88_r's rule in its clearest form: a process that will not die is a finding.
  //
  // Pinned HERE rather than there because that file's stub was updated to speak the real protocol,
  // which removed the only thing exercising this path — the fix would otherwise be unguarded.
  // Asserted on the poller's own registry and the button it restores, both observable synchronously.
  {
    const C = loadClient({ quiet: true });
    const out = C.run(`(function(){
      var polls = 0;
      var btn = { textContent:'⏳', disabled:true };
      var realGet = document.getElementById;
      document.getElementById = function(id){ return id === 'qcbtn' ? btn : realGet.call(document, id); };
      // No status field at all — the shape that used to loop forever.
      fetch = function(){ polls++; return Promise.resolve({ ok:true, json:function(){
        return Promise.resolve({ id:'j1' }); } }); };
      _qcPoll('t', 'j1', 'qcbtn', function(){});
      return new Promise(function(res){ setTimeout(function(){
        res(JSON.stringify({ polls: polls, tracked: _qcPollJobs['t'],
                             btnText: btn.textContent, btnDisabled: btn.disabled }));
      }, 300); });
    })()`);
    const r = JSON.parse(await out);
    assert.strictEqual(r.polls, 1,
      'an unrecognised job status is polled exactly ONCE — re-arming the timer is the hang (got '
      + r.polls + ' polls)');
    assert.strictEqual(r.tracked, null, 'the poller deregisters itself rather than staying live');
    assert.strictEqual(r.btnText, '🔍', 'and the QC button is restored, not left spinning forever');
    assert.strictEqual(r.btnDisabled, false, 'and re-enabled');
    console.log('  _qcPoll stops on a status it cannot interpret, instead of looping forever: OK');
  }

  // A CANCELLED QC must hand the button back. The user pressed cancel in the popover; leaving the
  // control stuck on ⏳ would make their own deliberate act look like a wedged app, and there is no
  // second thing to click to recover it.
  {
    const C = loadClient({ quiet: true });
    const out = C.run(`(function(){
      var btn = { textContent:'⏳', disabled:true }, toasts = [], onDone = 0;
      var realGet = document.getElementById;
      document.getElementById = function(id){ return id === 'qcbtn' ? btn : realGet.call(document, id); };
      showToast = function(m){ toasts.push(m); };
      fetch = function(){ return Promise.resolve({ ok:true, json:function(){
        return Promise.resolve({ id:'j2', status:'cancelled' }); } }); };
      _qcPoll('t2', 'j2', 'qcbtn', function(){ onDone++; });
      return new Promise(function(res){ setTimeout(function(){
        res(JSON.stringify({ tracked: _qcPollJobs['t2'], btnText: btn.textContent,
                             btnDisabled: btn.disabled, toasts: toasts, onDone: onDone }));
      }, 300); });
    })()`);
    const r = JSON.parse(await out);
    assert.strictEqual(r.btnText, '🔍', 'a cancelled QC restores the button (got ' + r.btnText + ')');
    assert.strictEqual(r.btnDisabled, false, 'and re-enables it');
    assert.strictEqual(r.tracked, null, 'and deregisters the poll');
    assert.strictEqual(r.onDone, 0, 'and does NOT render a proposal — there is no result to show');
    // ⚠️ And it is SILENT. A cancel is not a failure: toasting "⚠ QC failed" would report the
    // user's own deliberate act back to them as an error, which is the same distinction
    // jobFailOrCancel draws on the server side.
    assert.deepStrictEqual(r.toasts, [],
      'and shows no error toast — the user cancelled on purpose (got ' + JSON.stringify(r.toasts) + ')');
    console.log('  a cancelled QC restores the button silently, with no proposal and no error: OK');
  }

  // Local timing helper for the async section below — this file had no `settle()`; the poller runs
  // on real timers (5ms in these fixtures) so the assertions need a real tick to observe.
  const settle = (ms) => new Promise(r => setTimeout(r, ms || 60));

  // ── v88_al: _jobAwait — the ONE poller the five converted routes share ────────────────────────
  // Behavioural, on the boolean/payload each call site branches on. The set-level guards above prove
  // every caller GOES THROUGH it; these prove what it does when it gets there.
  {
    const C = client();

    // done -> the job's data, which is the same payload the response body used to carry.
    // ⚠️ `indexOf`, not a regex: a literal like /\/api\/job\// inside a TEMPLATE LITERAL has its
    // backslash-escapes collapsed before the vm ever sees it, so it arrives as //api/job// — a line
    // comment that swallowed the rest of the statement. Same family as the standing "no backticks in
    // a comment inside a template literal" rule.
    C.run(`fetch = function(u){
      return Promise.resolve({ ok:true, status:200, json:function(){
        return Promise.resolve(String(u).indexOf('/api/job/') >= 0
          ? { status:'done', data:{ summary:'S' } } : { ok:true, jobId:'j1' }); } }); };
      window.__out = undefined;
      _jobAwait({ ok:true, json:function(){ return Promise.resolve({ ok:true, jobId:'j1' }); } }, { every: 5 })
        .then(function(v){ window.__out = JSON.stringify(v); }); true;`, 'done');
    await settle(120);
    assert.strictEqual(C.run('window.__out'), '{"summary":"S"}',
      'a finished job resolves to its DATA — the same fields the response body used to carry');

    // cancelled -> null, NOT an error. Every call site branches on this to stop quietly.
    C.run(`fetch = function(){ return Promise.resolve({ ok:true, status:200, json:function(){
        return Promise.resolve({ status:'cancelled' }); } }); };
      window.__out2 = 'unset'; window.__err2 = null;
      _jobAwait({ ok:true, json:function(){ return Promise.resolve({ ok:true, jobId:'j2' }); } }, { every: 5 })
        .then(function(v){ window.__out2 = v; }, function(e){ window.__err2 = String(e.message); }); true;`, 'cancel');
    await settle(120);
    assert.strictEqual(C.run('window.__out2'), null,
      'a CANCELLED job resolves to null — the user stopped it, which is not a failure');
    assert.strictEqual(C.run('window.__err2'), null, 'and does not throw');

    // error -> throws, so every existing try/catch at the call sites keeps working unchanged.
    C.run(`fetch = function(){ return Promise.resolve({ ok:true, status:200, json:function(){
        return Promise.resolve({ status:'error', error:'boom' }); } }); };
      window.__err3 = null;
      _jobAwait({ ok:true, json:function(){ return Promise.resolve({ ok:true, jobId:'j3' }); } }, { every: 5 })
        .catch(function(e){ window.__err3 = String(e.message); }); true;`, 'error');
    await settle(120);
    assert.strictEqual(C.run('window.__err3'), 'boom',
      'a failed job THROWS with the server\'s message, so existing try/catch keeps working');

    // ⚠️ An unrecognised status is TERMINAL, not "still running" — v88_ag's hang, in the new poller.
    C.run(`fetch = function(){ return Promise.resolve({ ok:true, status:200, json:function(){
        return Promise.resolve({ id:'j4' }); } }); };
      window.__err4 = null; window.__out4 = 'unset';
      _jobAwait({ ok:true, json:function(){ return Promise.resolve({ ok:true, jobId:'j4' }); } }, { every: 5 })
        .then(function(v){ window.__out4 = v; }, function(e){ window.__err4 = String(e.message); }); true;`, 'unknown');
    await settle(150);
    assert.ok(C.run('window.__err4') !== null,
      'a status this poller cannot interpret ENDS the wait — polling on is the hang that stalled the '
      + 'suite at v88_ag (got out=' + C.run('window.__out4') + ')');

    // A non-job answer (an unconverted sibling, a cached short-circuit) is handed straight back, so
    // the helper is safe to put in front of either kind of route.
    C.run(`window.__out5 = undefined;
      _jobAwait({ ok:true, json:function(){ return Promise.resolve({ cached:true, summary:'C' }); } }, { every: 5 })
        .then(function(v){ window.__out5 = JSON.stringify(v); }); true;`, 'nojob');
    await settle(60);
    assert.strictEqual(C.run('window.__out5'), '{"cached":true,"summary":"C"}',
      'a response with no jobId is returned as-is — no polling, no throw');

    // A non-OK response throws before any polling starts.
    C.run(`window.__err6 = null;
      _jobAwait({ ok:false, status:503, json:function(){ return Promise.resolve({ error:'No LLM backend available.' }); } }, { every: 5 })
        .catch(function(e){ window.__err6 = String(e.message); }); true;`, 'notok');
    await settle(60);
    assert.strictEqual(C.run('window.__err6'), 'No LLM backend available.',
      'a rejected REQUEST still surfaces its own error, not a job error');
    console.log('  _jobAwait: done->data, cancelled->null, error->throw, unknown->terminal, non-job->as-is: OK');
  }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-jobs-sync-inflight: FAILED' : 'unit-jobs-sync-inflight: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
