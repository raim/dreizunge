// unit-book-job-cancel.test.js — v89_ag.
//
// User report: "creating a story has no cancel/open buttons in the job popover."
//
// ⚠️ The cancel half was a DELIBERATE exclusion with a wrong conclusion. `_jobsRenderList`'s own
// comment said `book` is excluded because multi-chapter generation "lives in the separate bookJobs
// store with its own cancel route (/api/book-job/cancel), which this one does not reach" — true of
// the route, but the answer is to REACH it, not to withhold the button. A book job is the
// longest-running thing in the app, so it is the one a learner most wants to stop, and the route
// already existed and already worked (`pdfCancelBook()` has been calling it all along).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const settle = (ms) => new Promise(r => setTimeout(r, ms || 60));

function client(jobs) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    SENT = [];
    _jobsLastList = ${JSON.stringify(jobs)};
    true;`, 'seed');
  return C;
}
const BOOK = { id:'bk_1', kind:'book', label:'Generating book', link:null, status:'running', step:'Chapter 1/6' };
const PLAIN = { id:'j_1', kind:'job', label:'Generating "Der Hund"', link:null, status:'running', step:'' };

async function main() {

// ── 1. A running BOOK job offers a cancel button ────────────────────────────────────────────────
{
  const C = client([BOOK, PLAIN]);
  const html = C.run(`_jobsRenderList(); document.getElementById('jobs-pop-list').innerHTML`);
  const rows = (html.match(/jobs-row-cancel/g) || []).length;
  assert.strictEqual(rows, 2,
    '⚠️ BOTH a book job and a plain job offer cancel — the book one is the whole report, and the ' +
    'plain one is the non-vacuity partner (if it vanished, the render is simply broken)');
  assert.ok(/data-jobid="bk_1"/.test(html), 'the book row carries its own id');
}
// A book job that is NOT running must not offer one — there is nothing to stop.
{
  const C = client([{ ...BOOK, status: 'done' }]);
  const html = C.run(`_jobsRenderList(); document.getElementById('jobs-pop-list').innerHTML`);
  assert.ok(!/jobs-row-cancel/.test(html), 'a finished book job offers no cancel');
}
// ⚠️ And the kinds that genuinely have no server-side job must STILL be excluded — the fix widens
// the rule by exactly one kind, it does not remove it.
for (const kind of ['sync', 'tutor', 'draft']) {
  const C = client([{ id:'x', kind, label:'x', status:'running', step:'' }]);
  assert.ok(!/jobs-row-cancel/.test(C.run(`_jobsRenderList(); document.getElementById('jobs-pop-list').innerHTML`)),
    `kind='${kind}' still offers no cancel — POST /api/jobs/cancel would find nothing and the ` +
    'button would be a lie');
}
console.log('  a running book job offers cancel; finished and synthetic kinds still do not: OK');

// ── 2. ⚠️ It calls the BOOK route, with the BOOK body ───────────────────────────────────────────
// Two stores, two routes. A book id sent to /api/jobs/cancel is looked up in the `jobs` map, found
// missing, and answered `stopped:false` — "too late" for a job that is still running.
{
  const C = client([BOOK]);
  C.run(`fetch = async function(u, o){ SENT.push({ url:u, body:JSON.parse(o.body) });
    return { ok:true, json: async () => ({ ok:true, stopped:true }) }; };
    _jobsFetchAndRender = function(){};
    _jobsCancelById('bk_1', 'book'); true;`, 'cancel');
  await settle();
  const sent = JSON.parse(C.run(`JSON.stringify(SENT)`));
  assert.strictEqual(sent.length, 1, 'one request');
  assert.strictEqual(sent[0].url, '/api/book-job/cancel', 'the BOOK route, not /api/jobs/cancel');
  assert.deepStrictEqual(sent[0].body, { bookId: 'bk_1' },
    'and the book body — {jobId} would not be read by that route at all');
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(TOASTS)`))[0], UI.en['jobs.cancelled']);
}
// A plain job still goes the old way — the dispatch must not have swapped both.
{
  const C = client([PLAIN]);
  C.run(`fetch = async function(u, o){ SENT.push({ url:u, body:JSON.parse(o.body) });
    return { ok:true, json: async () => ({ ok:true, stopped:true }) }; };
    _jobsFetchAndRender = function(){};
    _jobsCancelById('j_1', 'job'); true;`, 'cancel');
  await settle();
  const sent = JSON.parse(C.run(`JSON.stringify(SENT)`));
  assert.strictEqual(sent[0].url, '/api/jobs/cancel', 'a plain job still uses the jobs route');
  assert.deepStrictEqual(sent[0].body, { jobId: 'j_1' }, 'with {jobId}');
}
console.log('  the book kind dispatches to the book route and body; plain jobs are unchanged: OK');

// ── 3. ⚠️ "cancelled" is only claimed when something was really stopped ─────────────────────────
// v88_k's ruling on this button: telling a learner "cancelled" while the model is still running is
// exactly the bug it exists to prevent. The book route answered a bare {ok:true} either way until
// v89_ag, so a caller COULD NOT be honest about it.
{
  const C = client([BOOK]);
  C.run(`fetch = async function(){ return { ok:true, json: async () => ({ ok:true, stopped:false }) }; };
    _jobsFetchAndRender = function(){};
    _jobsCancelById('bk_1', 'book'); true;`, 'cancel');
  await settle();
  assert.strictEqual(JSON.parse(C.run(`JSON.stringify(TOASTS)`))[0], UI.en['jobs.cancel_too_late'],
    'a book job that had already finished reports "too late", not "cancelled"');
}
{
  // And the server really does distinguish them now.
  const at = server.indexOf("url.pathname === '/api/book-job/cancel'");
  assert.ok(at > -1, 'the book cancel route exists');
  let d = 0, i = server.indexOf('{', at);
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  const route = server.slice(at, i);
  assert.ok(/cancelBookJob\(bj\)/.test(route) && /\{ ok: true, stopped \}/.test(route),
    '⚠️ the route reports whether it actually stopped a RUNNING job — a bare {ok:true} makes every ' +
    'caller claim success, including for a job that finished a second earlier');
  // ⚠️ DRIVEN. Inline in the route this was invisible: a mutation reporting `stopped: true`
  // unconditionally left the suite GREEN. Named, it can be exercised.
  const at2 = server.indexOf('function cancelBookJob(');
  assert.ok(at2 > -1, 'the decision is a named function');
  let d2 = 0, k = server.indexOf('{', at2);
  for (; k < server.length; k++) { if (server[k] === '{') d2++; else if (server[k] === '}') { d2--; if (!d2) { k++; break; } } }
  const cancelBookJob = new Function(server.slice(at2, k) + '\nreturn cancelBookJob;')();
  const running = { status: 'running' };
  assert.strictEqual(cancelBookJob(running), true, 'a running job is stopped');
  assert.strictEqual(running.status, 'cancelled', 'and really marked cancelled');
  assert.strictEqual(cancelBookJob(running), false,
    '⚠️ cancelling the SAME job twice reports false the second time — otherwise a double-click ' +
    'claims two cancels and the second is a lie');
  for (const st of ['done', 'error', 'cancelled', 'pending'])
    assert.strictEqual(cancelBookJob({ status: st }), false, `a '${st}' job is not stoppable`);
  for (const bad of [null, undefined, {}])
    assert.strictEqual(cancelBookJob(bad), false, 'an unknown id reports false, never true');
}
console.log('  a cancel only claims success when a running job was really stopped: OK');

console.log('unit-book-job-cancel: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
