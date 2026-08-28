// unit-comic-extraction.test.js
// PLAN §2.4 / Track A4 milestone 2 (v85_k) — client-side half of batch text extraction. The server
// half (the /api/comic-extract route + _runComicExtractJob) is covered by e2e-comic-extract.test.js
// (a real fresh-spawned server + fake Ollama) per this project's own standing rule that server.js
// changes need a fresh process, not a source-level pin. This file covers what only exists client-side:
//   • §1 _comicCropDataUrl(box): crops the FULL-RESOLUTION source image (not the CSS-scaled canvas)
//     to one box's natural-pixel bounds — verified via a mocked canvas 2D context, checking the exact
//     drawImage() source/dest rect, not just "it didn't throw".
//   • §2 comicExtractPanels(): builds the POST body (one cropped image per box, in box order, plus
//     APP.lang), disables the button + sets a status while in flight, and hands the returned jobId to
//     _startComicExtractJob() — a SIBLING of startBackgroundJob(), not the same function (checked,
//     not assumed — see index.html's own comment on why reuse wasn't possible here).
//   • §3 comicExtractPanels() with zero panels: a no-op, no network call.
//   • §4 comicExtractPanels() on a network failure: button re-enabled, status cleared, no throw.
//   • §5/§6 _startComicExtractJob(): real 2000ms poll interval (same convention as
//     unit-gen-attribution.test.js's own startBackgroundJob() test — a real wait, not a fake-timer
//     seam added just for testability), covering both a 'done' status (merges results, re-enables the
//     button) and an 'error' status (clears state without crashing).
//   • §7 _comicApplyExtraction(): merges by INDEX, tolerates fewer results than boxes and a
//     non-array input, and actually re-renders the list (not just mutates state silently).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(resolve => setTimeout(resolve, ms || 25));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    APP.difficulty=2; true;`, 'seed');
  return C;
}

async function main() {

// ── 1. _comicCropDataUrl(box): crops the FULL image to natural-pixel bounds ──────
{
  const C = client();
  const r = JSON.parse(C.run(`
    var calls = [];
    var realCreateElement = document.createElement.bind(document);
    document.createElement = function(tag){
      if (tag !== 'canvas') return realCreateElement(tag);
      var fakeCtx = { drawImage: function(){ calls.push(Array.prototype.slice.call(arguments)); } };
      return { width:0, height:0, getContext: function(){ return fakeCtx; },
               toDataURL: function(){ return 'FAKE_DATAURL'; } };
    };
    var out = _comicCropDataUrl({ x1:10, y1:20, x2:110, y2:170 });
    document.createElement = realCreateElement;
    JSON.stringify({ out: out, calls: calls })`));
  assert.strictEqual(r.out, 'FAKE_DATAURL', '_comicCropDataUrl returns the canvas toDataURL() result');
  assert.strictEqual(r.calls.length, 1, 'drawImage called exactly once');
  const args = r.calls[0];
  // drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) — source rect must be the box's OWN bounds
  // (10,20)-(110,170) = 100x150, dest rect starts at (0,0) filling the whole crop canvas.
  assert.deepStrictEqual(args.slice(1), [10, 20, 100, 150, 0, 0, 100, 150],
    'drawImage source rect is the box\'s natural-pixel bounds, dest rect is the full crop canvas');
}
console.log('  _comicCropDataUrl(): crops the source image to the box\'s exact natural-pixel bounds: OK');

// ── 2. comicExtractPanels(): POST body shape, in-flight state, hands off to the poller ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10},{x1:5,y1:5,x2:15,y2:15}];
    APP.lang = 'fr';
    window._cropCalls = 0;
    _comicCropDataUrl = function(b){ window._cropCalls++; return 'CROP_' + b.x1; };
    window._startedWith = null;
    _startComicExtractJob = function(jobId){ window._startedWith = jobId; };
    window._fetchCall = null;
    fetch = function(url, opts){
      window._fetchCall = { url: url, method: opts.method, body: JSON.parse(opts.body) };
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ jobId:'job_xyz' }); } });
    };
    (async()=>{ await comicExtractPanels(); })();
    true;`, 't2b');
  await settle();
  const r2 = JSON.parse(C.run(`JSON.stringify({ cropCalls: window._cropCalls, startedWith: window._startedWith,
    fetchCall: window._fetchCall, btnDisabled: document.getElementById('comic-extract-btn').disabled })`));
  assert.strictEqual(r2.cropCalls, 2, 'one crop per drawn box');
  assert.strictEqual(r2.fetchCall.url, '/api/comic-extract', 'POSTs to the extraction endpoint');
  assert.strictEqual(r2.fetchCall.method, 'POST', 'uses POST');
  assert.deepStrictEqual(r2.fetchCall.body.images, ['CROP_0', 'CROP_5'], 'images array is the crops, IN BOX ORDER');
  assert.strictEqual(r2.fetchCall.body.lang, 'fr', "lang is the topic's own target language (APP.lang), not hardcoded");
  assert.strictEqual(r2.startedWith, 'job_xyz', 'hands the returned jobId to _startComicExtractJob (a SIBLING function, not startBackgroundJob)');
  assert.strictEqual(r2.btnDisabled, true, 'the extract button is disabled while a batch is in flight');
}
console.log('  comicExtractPanels(): correct POST body (crops in order + lang), hands jobId to its own poller, disables the button: OK');

// ── 3. comicExtractPanels() with zero panels: a no-op ─────────────────────────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [];
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicExtractPanels(); })();
    true;`, 't3');
  await settle();
  const called = JSON.parse(C.run('JSON.stringify(window._fetchCalled)'));
  assert.strictEqual(called, false, 'zero drawn panels: comicExtractPanels() never calls fetch');
}
console.log('  comicExtractPanels(): zero panels is a no-op (no network call): OK');

// ── 4. comicExtractPanels() on a network failure: recovers cleanly ────────────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    _comicCropDataUrl = function(){ return 'X'; };
    fetch = function(){ return Promise.reject(new Error('network down')); };
    (async()=>{ await comicExtractPanels(); })();
    true;`, 't4');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-extract-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent })`));
  assert.strictEqual(r.btnDisabled, false, 'a network failure re-enables the extract button, not left stuck disabled');
  assert.strictEqual(r.status, '', 'a network failure clears the status text rather than leaving a stale "Starting…"');
}
console.log('  comicExtractPanels(): a network failure re-enables the button and clears status, no throw: OK');

// ── 5. _startComicExtractJob(): a 'done' status merges results and re-enables the button ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10},{x1:1,y1:1,x2:11,y2:11}];
    document.getElementById('comic-extract-btn').disabled = true;
    fetch = function(url){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'done', step:'Complete',
        data: { panels: [ { caption:'Cap A', inScene:'', error:null }, { caption:'Cap B', inScene:'', error:null } ] }
      }); } });
    };
    _startComicExtractJob('job_done');
    true;`, 't5');
  await settle(2200);   // the real 2000ms poll interval — same convention as unit-gen-attribution.test.js
  const r = JSON.parse(C.run(`JSON.stringify({ box0: APP_COMIC.boxes[0].text, box1: APP_COMIC.boxes[1].text,
    btnDisabled: document.getElementById('comic-extract-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent })`));
  assert.strictEqual(r.box0.caption, 'Cap A', "panel 0's extracted text landed on APP_COMIC.boxes[0]");
  assert.strictEqual(r.box1.caption, 'Cap B', "panel 1's extracted text landed on APP_COMIC.boxes[1]");
  assert.strictEqual(r.btnDisabled, false, "a 'done' status re-enables the extract button");
  assert.strictEqual(r.status, '', "a 'done' status clears the in-progress status text");
}
console.log("  _startComicExtractJob(): a 'done' status merges panel text by index and re-enables the button: OK");

// ── 6. _startComicExtractJob(): an 'error' status clears state without crashing ───
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    document.getElementById('comic-extract-btn').disabled = true;
    fetch = function(){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'error', error:'model unreachable' }); } });
    };
    _startComicExtractJob('job_err');
    true;`, 't6');
  await settle(2200);
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-extract-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent,
    boxUnchanged: APP_COMIC.boxes[0].text === undefined })`));
  assert.strictEqual(r.btnDisabled, false, "an 'error' status re-enables the extract button");
  assert.strictEqual(r.status, '', "an 'error' status clears the status text");
  assert.strictEqual(r.boxUnchanged, true, "an 'error' status does NOT fabricate panel text onto the boxes");
}
console.log("  _startComicExtractJob(): an 'error' status clears state cleanly, does not fabricate results: OK");

// ── 7. _comicApplyExtraction(): merges by index, tolerates short/invalid input ────
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:1,y2:1},{x1:1,y1:1,x2:2,y2:2},{x1:2,y1:2,x2:3,y2:3}];
    _comicApplyExtraction([{caption:'A',inScene:'',error:null}]);   // fewer results than boxes
    var afterShort = APP_COMIC.boxes.map(function(b){return b.text ? b.text.caption : null;});
    _comicApplyExtraction('not an array');   // must not throw, must not mutate
    var afterInvalid = APP_COMIC.boxes.map(function(b){return b.text ? b.text.caption : null;});
    JSON.stringify({ afterShort: afterShort, afterInvalid: afterInvalid })`));
  assert.deepStrictEqual(r.afterShort, ['A', null, null], 'only as many boxes as results were given get text; the rest stay untouched');
  assert.deepStrictEqual(r.afterInvalid, ['A', null, null], 'a non-array argument is a no-op, not a crash or a silent wipe');
}
console.log('  _comicApplyExtraction(): merges by index, tolerates fewer results than boxes and non-array input: OK');

// ── 8. Mobile-backgrounding fix (v86_d, user-reported LIVE bug): _comicExtractJobId + an
//      off-schedule check ────────────────────────────────────────────────────────────────────────
// Reported live: the server's own log showed a successful extraction, but the client's UI never
// applied it — comicCreateChapter() kept refusing with "no extracted text yet". Root cause: mobile
// browsers throttle/suspend setInterval on a backgrounded tab, so the normal 2000ms poll can be
// delayed indefinitely or never fire again. Fix: a shared visibilitychange listener calls
// _comicExtractCheckOnce()/_comicDetectCheckOnce() directly — an OFF-SCHEDULE check, not waiting for
// the interval — whenever the tab becomes visible again. This harness has no visibilityState/
// visibilitychange support at all (checked: not in lib-dom.js), so the listener's OWN wiring is a
// source check (§8b below); what IS behaviourally testable, and is the actual mechanism the fix
// depends on, is (a) that _comicExtractJobId correctly tracks the in-flight job so the listener knows
// whether there's anything to re-check, and (b) that calling the check function OFF-SCHEDULE (not
// from the interval) still correctly applies a result — proven here directly.
{
  const C = client();
  const r = JSON.parse(C.run(`
    fetch = function(){ return new Promise(function(){}); };   // never resolves — job stays "in flight"
    _startComicExtractJob('job_pending');
    JSON.stringify({ jobIdWhileRunning: _comicExtractJobId })`));
  assert.strictEqual(r.jobIdWhileRunning, 'job_pending',
    '_comicExtractJobId is set while a job is in flight — this is exactly what the visibilitychange listener checks before re-polling');
  // Cleanup: _startComicExtractJob's own setInterval is still live (fetch never resolves, so its
  // guard never sees a mismatch). Null out the tracked id directly so the NEXT 2000ms tick sees
  // _comicExtractJobId !== jobId and clears itself — otherwise this real interval would tick forever
  // and keep the whole test process alive.
  C.run(`_comicExtractJobId = null; true;`);
}
console.log('  _comicExtractJobId tracks the in-flight job (what the visibility listener checks): OK');

{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'done', data: { panels: [ { caption:'Off-schedule', inScene:'', error:null } ] } }); } }); };
    _comicExtractJobId = 'job_offschedule';   // as if an earlier setInterval tick had started this job
    _comicExtractCheckOnce('job_offschedule');   // the visibilitychange listener's own call shape
    true;`, 't8-offschedule');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ text: APP_COMIC.boxes[0].text, jobIdAfter: _comicExtractJobId })`));
  assert.strictEqual(r.text.caption, 'Off-schedule',
    'an OFF-SCHEDULE check (called directly, not from the 2000ms interval) still applies a done result correctly — the exact mechanism the mobile-backgrounding fix depends on');
  assert.strictEqual(r.jobIdAfter, null, 'the tracked job id is cleared once the off-schedule check sees a terminal status');
}
console.log('  an OFF-SCHEDULE check (the visibility-recovery shape) applies a done result correctly: OK');

{
  // A stale/superseded jobId (e.g. the listener fires for a job that already finished, or a NEWER
  // job has since started) must be a no-op, not silently re-apply/overwrite fresher state.
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ ok:true, status:200,
      json: function(){ return Promise.resolve({ status:'done', data:{panels:[]} }); } }); };
    _comicExtractJobId = 'job_current';
    _comicExtractCheckOnce('job_stale');   // a DIFFERENT (superseded) id
    true;`, 't8-stale');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCalled: window._fetchCalled, jobIdAfter: _comicExtractJobId })`));
  assert.strictEqual(r.fetchCalled, false, 'a check for a SUPERSEDED job id never even calls fetch — a stale re-check cannot clobber a newer job');
  assert.strictEqual(r.jobIdAfter, 'job_current', 'the actually-current job id is untouched by the stale check');
}
console.log('  a check for a superseded job id is a no-op — cannot clobber a newer, still-current job: OK');

// ── 8b. The shared visibilitychange listener: wiring (source check — this harness has no
//       visibilityState/visibilitychange support to drive it behaviourally, checked directly) ─────
{
  const idx = html.indexOf("addEventListener('visibilitychange'");
  assert.ok(idx > 0, "a visibilitychange listener is registered");
  const block = html.slice(html.indexOf('{', idx), html.indexOf('});', idx));
  assert.ok(/visibilityState\s*!==\s*'visible'/.test(block),
    'the listener bails out unless the tab is actually visible (not just any visibility CHANGE, including going hidden)');
  assert.ok(/_comicExtractCheckOnce\(_comicExtractJobId\)/.test(block),
    'the listener re-checks the comic-extract job (gated on _comicExtractJobId being set)');
  assert.ok(/_comicDetectCheckOnce\(_comicDetectJobId\)/.test(block),
    'the listener ALSO re-checks the comic-detect job — the same class of bug affects both pollers');
}
console.log('  visibilitychange listener: checks visibility state, re-checks BOTH comic pollers (source check): OK');

console.log('unit-comic-extraction: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
