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

    // ── 5. All five synchronous routes are wrapped ─────────────────────────────────────────────
    // Deliberately source-level: "no synchronous model-backed route is left untracked" is a claim
    // about a SET of call sites, and no single rendered state can observe it. If a sixth such route
    // is added later, this is what should fail.
    {
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const routes = ['/api/storyline-retitle', '/api/storyline-title', '/api/storyline-summary',
                      '/api/retranslate-story', '/api/writing-feedback'];
      for (const route of routes) {
        let from = 0, hits = 0;
        for (;;) {
          const at = src.indexOf(`fetch('${route}'`, from);
          if (at < 0) break;
          hits++;
          // The wrapper opens within a few hundred characters before the fetch (it takes a label
          // argument and an arrow function, so it is not adjacent).
          const before = src.slice(Math.max(0, at - 400), at);
          assert.ok(before.includes('_jobsTracked('),
            `${route} at offset ${at} is inside a _jobsTracked(...) wrapper`);
          from = at + 1;
        }
        assert.ok(hits > 0, `found at least one caller of ${route}`);
      }
      console.log('  all five synchronous model-backed routes are wrapped at every call site: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-jobs-sync-inflight: FAILED' : 'unit-jobs-sync-inflight: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
