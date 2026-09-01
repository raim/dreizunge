// unit-jobs-cancel-button.test.js
// item AU, cancel third (v88_k), client side — the per-job cancel button in the jobs popover.
// The SERVER half (the abort actually destroying the in-flight request) is e2e-job-cancel.
//
// User request: "individual cancel buttons in the new 'running jobs' popover."
//
// The whole design question here is WHICH rows get a button. `POST /api/jobs/cancel` looks the id up
// in the server's `jobs` map, so a button on anything else is a control that cannot work — and a
// dead cancel button is worse than none, because the learner believes the model stopped.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = ms => new Promise(r => setTimeout(r, ms || 30));

function client(list) {
  const C = loadClient({ quiet: true });
  C.run(`APP.info = { canGenerate: true };
    UI_STRINGS = ${JSON.stringify(UI.en)};
    _jobsLastList = ${JSON.stringify(list)};
    _tutorState.busy = false;
    __posts = [];
    fetch = function(url, opts){
      __posts.push({ url:String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
      return Promise.resolve({ ok:true, status:200,
        json:function(){ return Promise.resolve(__cancelReply || { ok:true, stopped:true }); } });
    };
    __cancelReply = null;
    _jobsRenderList(); true;`, 'seed');
  return C;
}
const row = (html, id) => {
  const i = html.indexOf(id);
  return i < 0 ? '' : html.slice(Math.max(0, i - 400), i + 400);
};

(async () => {
  let failed = false;
  try {

    // ── 1. Exactly the rows that CAN be cancelled get a button ────────────────────────────────
    {
      const C = client([
        { id:'j_run',  kind:'job',   label:'Generating', status:'running', step:'…', error:null, link:null, createdAt:5 },
        { id:'j_done', kind:'job',   label:'Finished',   status:'done',    step:'',  error:null, link:null, createdAt:4 },
        { id:'j_book', kind:'book',  label:'Book',       status:'running', step:'',  error:null, link:null, createdAt:3 },
        { id:'d_1',    kind:'draft', label:'Draft',      status:'draft',   step:null,error:null, link:{type:'draft',id:'d_1'}, createdAt:2 },
      ]);
      const html = C.run(`document.getElementById('jobs-pop-list').innerHTML`);
      assert.ok(row(html,'j_run').includes('jobs-row-cancel'),
        'a RUNNING server job gets a cancel button — the reported request');
      assert.ok(!row(html,'j_done').includes('jobs-row-cancel'),
        'a FINISHED job does not — there is nothing to stop');
      assert.ok(!row(html,'j_book').includes('jobs-row-cancel'),
        'a BOOK job does not — it lives in the separate bookJobs store with its own cancel route, '
        + 'which /api/jobs/cancel does not reach');
      assert.ok(!row(html,'d_1').includes('jobs-row-cancel'),
        'a DRAFT does not — it is parked, not running');
      assert.ok(row(html,'d_1').includes('jobs-row-del'), 'and the draft keeps its discard button');
      console.log('  only a running SERVER job offers a cancel button: OK');
    }

    // ── 2. The synthetic tutor entry gets none ───────────────────────────────────────────────
    // It has no server-side job at all (POST /api/tutor is stateless), so the route would find
    // nothing — a button there would report success having stopped nothing.
    {
      const C = loadClient({ quiet: true });
      C.run(`APP.info={canGenerate:true}; UI_STRINGS=${JSON.stringify(UI.en)};
        _jobsLastList=[]; _tutorState.busy=true; _jobsRenderList(); true;`, 'tutor');
      const html = C.run(`document.getElementById('jobs-pop-list').innerHTML`);
      assert.ok(html.includes('__tutor__') || html.includes(UI.en['tutor.title']), 'the tutor row rendered');
      assert.ok(!html.includes('jobs-row-cancel'),
        'the synthetic tutor entry has no cancel button — there is no server job behind it');
      console.log('  the synthetic tutor entry offers no cancel button: OK');
    }

    // ── 3. Clicking it calls the route with that job id ───────────────────────────────────────
    {
      const C = client([{ id:'j_run', kind:'job', label:'X', status:'running', step:'', error:null, link:null, createdAt:1 }]);
      C.run(`_jobsCancelById('j_run'); true;`, 'cancel');
      await settle(50);
      const posts = JSON.parse(C.run(`JSON.stringify(__posts)`));
      const c = posts.filter(p => p.url.indexOf('/api/jobs/cancel') >= 0);
      assert.strictEqual(c.length, 1, 'exactly one cancel request (got ' + c.length + ')');
      assert.strictEqual(c[0].body.jobId, 'j_run', 'naming the job that was clicked');
      console.log('  clicking cancel posts the job id to the route: OK');
    }

    // ── 4. "Stopped nothing" is reported differently from "stopped it" ───────────────────────
    // The 3s poll makes "the job finished between render and click" a real race. Telling the
    // learner "cancelled" when nothing stopped is the exact failure this item exists to fix.
    {
      const C = client([{ id:'j_run', kind:'job', label:'X', status:'running', step:'', error:null, link:null, createdAt:1 }]);
      C.run(`__cancelReply = { ok:true, stopped:false };
        __toast=null; showToast = function(m){ __toast=m; };
        _jobsCancelById('j_run'); true;`, 'late');
      await settle(50);
      assert.strictEqual(C.run(`__toast`), UI.en['jobs.cancel_too_late'],
        'stopped:false says the job had already finished');

      const C2 = client([{ id:'j_run', kind:'job', label:'X', status:'running', step:'', error:null, link:null, createdAt:1 }]);
      C2.run(`__cancelReply = { ok:true, stopped:true };
        __toast=null; showToast = function(m){ __toast=m; };
        _jobsCancelById('j_run'); true;`, 'ok');
      await settle(50);
      assert.strictEqual(C2.run(`__toast`), UI.en['jobs.cancelled'],
        'stopped:true confirms the cancel (non-vacuity: the two replies differ)');
      console.log('  a cancel that stopped nothing says so, rather than claiming success: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-jobs-cancel-button: FAILED' : 'unit-jobs-cancel-button: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
