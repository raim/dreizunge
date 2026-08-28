// unit-comic-detect.test.js
// PLAN §2.4 / Track A4 milestone 5 (v85_o) — client-side half of auto-detection. The server half
// (the /api/comic-detect-panels route + parsing, in order) is covered by e2e-comic-detect.test.js.
// This file covers:
//   • §1 comicDetectPanels(): no-op with no uploaded image; a real call POSTs {image: dataUrl} (the
//     FULL page, unlike extraction's per-panel crops) to the SAME endpoint, disables the button, and
//     hands the returned jobId to _startComicDetectJob() — a SIBLING of the other two comic pollers,
//     not a reuse of either.
//   • §2/§3 _startComicDetectJob(): a real 2000ms poll interval (same convention as
//     unit-gen-attribution.test.js's own startBackgroundJob() test), covering 'done' and 'error'.
//   • §4 _comicApplyDetectedPanels(): converts the server's normalized-0-1000 boxes to APP_COMIC's
//     own natural-pixel storage using the image's ACTUAL dimensions — the same shape a hand-drawn
//     box uses, so every existing consumer (reorder/delete/redraw/extract) works identically on a
//     detected box.
//   • §5 _comicApplyDetectedPanels() DROPS a malformed/inverted box (x2<=x1 or y2<=y1) rather than
//     storing it broken — this is the client's job specifically because only the client knows the
//     image's natural pixel dimensions (confirmed at e2e-comic-detect.test.js's own scoping: the
//     server hands back exactly what it parsed, unfiltered).
//   • §6 _comicApplyDetectedPanels() REPLACES any existing boxes (a fresh detection is a fresh
//     suggestion, not merged with hand-drawn ones already present).
//   • §7 an empty/no-panels detection result fails cleanly with a toast, not a silent no-op.
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

// ── 1a. comicDetectPanels(): no-op with no uploaded image ────────────────────────
{
  const C = client();
  C.run(`APP_COMIC.dataUrl = null;
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicDetectPanels(); })();
    true;`, 't1a');
  await settle();
  const called = JSON.parse(C.run('JSON.stringify(window._fetchCalled)'));
  assert.strictEqual(called, false, 'no uploaded image: comicDetectPanels() never calls fetch');
}
console.log('  comicDetectPanels(): no-op with no uploaded image: OK');

// ── 1b. comicDetectPanels(): correct POST body, disables button, hands off to its own poller ──
{
  const C = client();
  C.run(`APP_COMIC.dataUrl = 'data:image/jpeg;base64,FULLPAGE';
    window._startedWith = null;
    _startComicDetectJob = function(jobId){ window._startedWith = jobId; };
    window._fetchCall = null;
    fetch = function(url, opts){
      window._fetchCall = { url: url, method: opts.method, body: JSON.parse(opts.body) };
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ jobId:'job_detect1' }); } });
    };
    (async()=>{ await comicDetectPanels(); })();
    true;`, 't1b');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCall: window._fetchCall, startedWith: window._startedWith,
    btnDisabled: document.getElementById('comic-detect-btn').disabled })`));
  assert.strictEqual(r.fetchCall.url, '/api/comic-detect-panels', 'POSTs to the detection endpoint');
  assert.strictEqual(r.fetchCall.method, 'POST', 'uses POST');
  assert.strictEqual(r.fetchCall.body.image, 'data:image/jpeg;base64,FULLPAGE', 'sends the FULL uploaded page (not a crop, unlike extraction)');
  assert.strictEqual(r.startedWith, 'job_detect1', 'hands the returned jobId to _startComicDetectJob (a SIBLING poller, not a reuse)');
  assert.strictEqual(r.btnDisabled, true, 'the detect button is disabled while the request is in flight');
}
console.log('  comicDetectPanels(): correct POST body (full page), disables the button, hands off to its own poller: OK');

// ── 2. _startComicDetectJob(): a 'done' status applies panels and re-enables the button ──
{
  const C = client();
  C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;
    document.getElementById('comic-detect-btn').disabled = true;
    window._appliedWith = null;
    _comicApplyDetectedPanels = function(panels){ window._appliedWith = panels; };
    fetch = function(url){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'done', data: { panels: [[100,100,400,400]] } }); } });
    };
    _startComicDetectJob('job_done');
    true;`, 't2');
  await settle(2200);
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-detect-btn').disabled,
    status: document.getElementById('comic-detect-status').textContent,
    appliedWith: window._appliedWith })`));
  assert.strictEqual(r.btnDisabled, false, "a 'done' status re-enables the detect button");
  assert.strictEqual(r.status, '', "a 'done' status clears the in-progress status text");
  assert.deepStrictEqual(r.appliedWith, [[100,100,400,400]], "the detected panels are handed to _comicApplyDetectedPanels");
}
console.log("  _startComicDetectJob(): a 'done' status applies the panels and re-enables the button: OK");

// ── 3. _startComicDetectJob(): an 'error' status recovers cleanly ─────────────────
{
  const C = client();
  C.run(`document.getElementById('comic-detect-btn').disabled = true;
    fetch = function(){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'error', error:'model unreachable' }); } });
    };
    _startComicDetectJob('job_err');
    true;`, 't3');
  await settle(2200);
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-detect-btn').disabled,
    status: document.getElementById('comic-detect-status').textContent })`));
  assert.strictEqual(r.btnDisabled, false, "an 'error' status re-enables the detect button");
  assert.strictEqual(r.status, '', "an 'error' status clears the status text");
}
console.log("  _startComicDetectJob(): an 'error' status recovers cleanly: OK");

// ── 4. _comicApplyDetectedPanels(): converts normalized 0-1000 boxes to natural pixels ──
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;   // 2x width, 1x height of the 0-1000 space
    _comicApplyDetectedPanels([[100, 200, 500, 800]]);
    JSON.stringify(APP_COMIC.boxes)`));
  // x: 100/1000*1000=100, 500/1000*1000=500; y: 200/1000*500=100, 800/1000*500=400
  assert.deepStrictEqual(r, [{ x1:100, y1:100, x2:500, y2:400 }],
    'normalized 0-1000 box correctly scaled to the image\'s OWN natural pixel dimensions');
}
console.log('  _comicApplyDetectedPanels(): correctly scales normalized boxes to natural pixel dimensions: OK');

// ── 5. _comicApplyDetectedPanels(): drops a malformed/inverted box, keeps the good ones ──
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 1000;
    _comicApplyDetectedPanels([[100,100,50,50], [200,200,400,400], [10,900,20,890]]);   // panel 1 inverted x, panel 3 inverted y
    JSON.stringify(APP_COMIC.boxes)`));
  assert.strictEqual(r.length, 1, 'only the ONE well-formed box (panel 2) survives — both inverted boxes are dropped, not stored broken');
  assert.deepStrictEqual(r[0], { x1:200, y1:200, x2:400, y2:400 }, 'the surviving box is exactly the well-formed one');
}
console.log('  _comicApplyDetectedPanels(): drops malformed/inverted boxes, keeps the well-formed ones: OK');

// ── 6. _comicApplyDetectedPanels(): REPLACES existing boxes, does not merge ───────
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 1000;
    APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];   // a hand-drawn box already present
    _comicApplyDetectedPanels([[500,500,900,900]]);
    JSON.stringify(APP_COMIC.boxes)`));
  assert.strictEqual(r.length, 1, 'a fresh detection REPLACES prior boxes, not merges (1 box, not 2)');
  assert.deepStrictEqual(r[0], { x1:500, y1:500, x2:900, y2:900 }, 'the surviving box is the newly-detected one, not the old hand-drawn one');
}
console.log('  _comicApplyDetectedPanels(): a fresh detection replaces prior boxes rather than merging: OK');

// ── 7. _comicApplyDetectedPanels(): an empty/no-panels result fails cleanly with a toast ──
{
  const C = client();
  C.run(`APP_COMIC.naturalW=1000; APP_COMIC.naturalH=1000; APP_COMIC.boxes=[{x1:1,y1:1,x2:2,y2:2}];
    window._toasts = [];
    showToast = function(msg){ window._toasts.push(msg); };
    _comicApplyDetectedPanels([]);
    true;`, 't7');
  const r = JSON.parse(C.run(`JSON.stringify({ boxes: APP_COMIC.boxes, toastCount: window._toasts.length })`));
  assert.strictEqual(r.toastCount, 1, 'an empty detection result shows exactly one toast, not a silent failure');
  assert.deepStrictEqual(r.boxes, [{x1:1,y1:1,x2:2,y2:2}], 'existing boxes are left UNTOUCHED when detection finds nothing (not wiped)');
}
console.log('  _comicApplyDetectedPanels(): an empty result fails cleanly with a toast, leaves existing boxes untouched: OK');

// ── 7b. _comicApplyDetectedPanels(): a PARTIAL drop (some malformed, some good) also toasts, not just
//        a total drop (v86_d — user-reported LIVE bug: server log said "4 panel(s) suggested", the UI
//        showed only 3, with no explanation at all — §5 above already proved the FILTERING was
//        correct; what was missing was telling the user it happened) ─────────────────────────────────
{
  const C = client();
  C.run(`APP_COMIC.naturalW=1000; APP_COMIC.naturalH=1000;
    window._toasts = [];
    showToast = function(msg){ window._toasts.push(msg); };
    _comicApplyDetectedPanels([[100,100,50,50], [200,200,400,400], [300,300,600,600], [10,900,20,890]]);   // 4 in, 2 malformed
    true;`, 't7b');
  const r = JSON.parse(C.run(`JSON.stringify({ boxCount: APP_COMIC.boxes.length, toastCount: window._toasts.length, toasts: window._toasts })`));
  assert.strictEqual(r.boxCount, 2, 'the 2 well-formed boxes still survive (same filtering as §5)');
  assert.strictEqual(r.toastCount, 1, 'a PARTIAL drop (2 of 4 kept) shows exactly one toast — previously this was completely silent');
  assert.ok(r.toasts[0].indexOf('2/4') >= 0, 'the toast names the actual kept/suggested counts, not a generic message: ' + r.toasts[0]);
}
console.log('  _comicApplyDetectedPanels(): a PARTIAL drop also toasts, naming the kept/suggested counts (previously silent): OK');

{
  // Every suggested box is malformed (0 survivors, but the INPUT array was non-empty) — must fail
  // the same clean way as the "server sent literally zero panels" case, not silently leave 0 boxes.
  const C = client();
  C.run(`APP_COMIC.naturalW=1000; APP_COMIC.naturalH=1000;
    APP_COMIC.boxes=[{x1:1,y1:1,x2:2,y2:2}];
    window._toasts = [];
    showToast = function(msg){ window._toasts.push(msg); };
    _comicApplyDetectedPanels([[100,100,50,50], [10,900,20,890]]);   // both malformed
    true;`, 't7c');
  const r = JSON.parse(C.run(`JSON.stringify({ boxes: APP_COMIC.boxes, toastCount: window._toasts.length })`));
  assert.strictEqual(r.toastCount, 1, 'ALL suggested boxes malformed (0 survivors) fails cleanly with a toast, not a silent no-op');
  assert.deepStrictEqual(r.boxes, [{x1:1,y1:1,x2:2,y2:2}], 'existing boxes are left untouched when every suggestion turns out malformed');
}
console.log('  _comicApplyDetectedPanels(): ALL suggestions malformed (0 survivors) fails cleanly, existing boxes untouched: OK');

// ── 8. Mobile-backgrounding fix (v86_d): _comicDetectJobId + an off-schedule check ────────────────
// SIBLING of unit-comic-extraction.test.js's own §8 — same user-reported live bug (mobile tab
// backgrounding suspends setInterval, stranding the client mid-poll), same fix shape: a shared
// visibilitychange listener calls _comicDetectCheckOnce() directly, off-schedule, when the tab
// becomes visible again. See that file's §8 comment for the full root-cause writeup; the listener's
// OWN wiring is checked once, jointly, in THAT file's §8b (it re-checks both pollers from one place).
{
  const C = client();
  const r = JSON.parse(C.run(`
    fetch = function(){ return new Promise(function(){}); };   // never resolves — job stays "in flight"
    _startComicDetectJob('job_pending');
    JSON.stringify({ jobIdWhileRunning: _comicDetectJobId })`));
  assert.strictEqual(r.jobIdWhileRunning, 'job_pending',
    '_comicDetectJobId is set while a job is in flight — what the visibilitychange listener checks before re-polling');
  // Cleanup: null out the tracked id so the pending real setInterval's NEXT tick sees a mismatch and
  // clears itself, rather than ticking forever and keeping the test process alive (see the sibling
  // comment in unit-comic-extraction.test.js's own §8 for the full reasoning).
  C.run(`_comicDetectJobId = null; true;`);
}
console.log('  _comicDetectJobId tracks the in-flight job (what the visibility listener checks): OK');

{
  const C = client();
  C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;
    window._appliedWith = null;
    _comicApplyDetectedPanels = function(panels){ window._appliedWith = panels; };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'done', data: { panels: [[100,100,400,400]] } }); } }); };
    _comicDetectJobId = 'job_offschedule';   // as if an earlier setInterval tick had started this job
    _comicDetectCheckOnce('job_offschedule');   // the visibilitychange listener's own call shape
    true;`, 't8-offschedule');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ appliedWith: window._appliedWith, jobIdAfter: _comicDetectJobId })`));
  assert.deepStrictEqual(r.appliedWith, [[100,100,400,400]],
    'an OFF-SCHEDULE check (called directly, not from the 2000ms interval) still applies a done result correctly — the exact mechanism the mobile-backgrounding fix depends on');
  assert.strictEqual(r.jobIdAfter, null, 'the tracked job id is cleared once the off-schedule check sees a terminal status');
}
console.log('  an OFF-SCHEDULE check (the visibility-recovery shape) applies a done result correctly: OK');

{
  // A stale/superseded jobId must be a no-op — cannot clobber a newer, still-current job.
  const C = client();
  C.run(`window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ ok:true, status:200,
      json: function(){ return Promise.resolve({ status:'done', data:{panels:[]} }); } }); };
    _comicDetectJobId = 'job_current';
    _comicDetectCheckOnce('job_stale');   // a DIFFERENT (superseded) id
    true;`, 't8-stale');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCalled: window._fetchCalled, jobIdAfter: _comicDetectJobId })`));
  assert.strictEqual(r.fetchCalled, false, 'a check for a SUPERSEDED job id never even calls fetch');
  assert.strictEqual(r.jobIdAfter, 'job_current', 'the actually-current job id is untouched by the stale check');
}
console.log('  a check for a superseded job id is a no-op — cannot clobber a newer, still-current job: OK');

console.log('unit-comic-detect: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
