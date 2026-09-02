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
    document.getElementById('comic-extract-cb').checked = true;
    (async()=>{ await comicExtractPanels(); })();
    true;`, 't2b');
  await settle();
  const r2 = JSON.parse(C.run(`JSON.stringify({ cropCalls: window._cropCalls, startedWith: window._startedWith,
    fetchCall: window._fetchCall, btnDisabled: document.getElementById('comic-generate-btn').disabled })`));
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
    document.getElementById('comic-extract-cb').checked = true;
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
    document.getElementById('comic-extract-cb').checked = true;
    (async()=>{ await comicExtractPanels(); })();
    true;`, 't4');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-generate-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent })`));
  assert.strictEqual(r.btnDisabled, false, 'a network failure re-enables the extract button, not left stuck disabled');
  assert.strictEqual(r.status, '', 'a network failure clears the status text rather than leaving a stale "Starting…"');
}
console.log('  comicExtractPanels(): a network failure re-enables the button and clears status, no throw: OK');

// ── 5. _startComicExtractJob(): a 'done' status merges results and re-enables the button ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10},{x1:1,y1:1,x2:11,y2:11}];
    document.getElementById('comic-generate-btn').disabled = true;
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
    btnDisabled: document.getElementById('comic-generate-btn').disabled,
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
    document.getElementById('comic-generate-btn').disabled = true;
    fetch = function(){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'error', error:'model unreachable' }); } });
    };
    _startComicExtractJob('job_err');
    true;`, 't6');
  await settle(2200);
  const r = JSON.parse(C.run(`JSON.stringify({ btnDisabled: document.getElementById('comic-generate-btn').disabled,
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

// ── 8c. The shared listener ALSO logs unconditionally on every fire (v86_j — user-reported: "the
//       recovery fix didn't recover", but there was no way to tell from the console the user was
//       ALREADY checking whether the listener even fired at all) — source check, same harness
//       limitation as §8b ──────────────────────────────────────────────────────────────────────────
{
  const idx = html.indexOf("addEventListener('visibilitychange'");
  const block = html.slice(html.indexOf('{', idx), html.indexOf('});', idx));
  assert.ok(/console\.log\('visibilitychange: state='\+document\.visibilityState/.test(block),
    'the listener logs on EVERY fire, before the visible-state guard — so a fire with nothing to do still leaves a trace');
}
console.log('  visibilitychange listener: logs unconditionally on every fire, even with nothing tracked (source check): OK');

// ── 8d. _comicExtractCheckOnce() ALSO logs to console at each step (v86_j) — behaviourally testable,
//       unlike the listener itself, since this function can be invoked directly ──────────────────────
{
  const C = client();
  C.run(`window._logs = [];
    console.log = function(msg){ window._logs.push(msg); };
    _comicExtractJobId = 'job_stale_check';
    _comicExtractCheckOnce('job_different');   // a stale/superseded call
    true;`, 't8d-stale');
  const r = JSON.parse(C.run(`JSON.stringify(window._logs)`));
  assert.strictEqual(r.length, 1, 'a stale/superseded check still logs exactly once');
  assert.ok(r[0].indexOf('stale') >= 0, 'the log names it as stale: ' + r[0]);
}
console.log('  _comicExtractCheckOnce(): logs a stale/superseded call: OK');

{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    window._logs = [];
    console.log = function(msg){ window._logs.push(msg); };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'done', data: { panels: [ { caption:'C', inScene:'', error:null } ] } }); } }); };
    _comicExtractJobId = 'job_real';
    _comicExtractCheckOnce('job_real');
    true;`, 't8d-real');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify(window._logs)`));
  assert.ok(r.some(m => m.indexOf('polling job job_real') >= 0), 'logs that it is polling: ' + JSON.stringify(r));
  assert.ok(r.some(m => m.indexOf('status=done') >= 0), 'logs the status it received: ' + JSON.stringify(r));
  assert.ok(r.some(m => m.indexOf('done, applying 1 panel') >= 0), 'logs how many panels it is about to apply: ' + JSON.stringify(r));
}
console.log('  _comicExtractCheckOnce(): logs the polling attempt, the status received, and the panel count applied: OK');

// ── 6. Image description (user request): the two checkboxes drive the request ────────────────────
// "additionally or alternatively to text extraction, ask the model to give a short 1-2 sentence
// description of the image in the target language. This will be used as the chapter text, if no text
// is extracted. 'image description' and 'text extraction' button both become checkmarks, with a
// separate 'generate' button."
{
  // v88_d (item AO): comicExtractPanels() now AWAITS a draft flush before it POSTs, so the request
  // body is no longer readable in the same synchronous turn — and the flush is itself a fetch, so
  // the stub has to capture BY URL rather than keeping only the last call. Both changes are about
  // the new sequencing, not about what this section asserts (which flags the extract call carries).
  const post = async (extract, describe) => {
    const C = client();
    C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
      _comicCropDataUrl = function(){ return 'data:image/png;base64,AAA'; };
      _startComicExtractJob = function(){};
      document.getElementById('comic-extract-cb').checked = ${extract};
      document.getElementById('comic-describe-cb').checked = ${describe};
      window._body = null;
      fetch = function(u, o){
        if (String(u).indexOf('/api/comic-extract') >= 0) window._body = JSON.parse(o.body);
        return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({ jobId:'j1', id:'d1' }); } }); };
      comicExtractPanels();
      true;`);
    await settle();
    return C;
  };
  const read = C => JSON.parse(C.run(`JSON.stringify(window._body)`));

  const both = read(await post(true, true));
  assert.strictEqual(both.extract, true, 'both ticked: extract requested');
  assert.strictEqual(both.describe, true, 'both ticked: description requested');

  const textOnly = read(await post(true, false));
  assert.strictEqual(textOnly.extract, true, 'text only: extract requested');
  assert.strictEqual(textOnly.describe, false, 'text only: description NOT requested');

  const descOnly = read(await post(false, true));
  assert.strictEqual(descOnly.extract, false, 'description only: extraction NOT requested');
  assert.strictEqual(descOnly.describe, true, 'description only: description requested');
}
console.log('  comicExtractPanels(): the two checkboxes are sent as independent extract/describe flags: OK');

// ── 6b. Neither ticked: no request at all, and the button says so by being disabled ──────────────
// Deliberately NOT a toast — that would have cost a third ui.json string for a state the UI can
// simply prevent. The route rejects the same combination independently.
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    _comicCropDataUrl = function(){ return 'data:image/png;base64,AAA'; };
    document.getElementById('comic-extract-cb').checked = false;
    document.getElementById('comic-describe-cb').checked = false;
    window._called = false;
    fetch = function(){ window._called = true; return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({}); } }); };
    comicExtractPanels();
    _comicSyncGenerateBtn();
    JSON.stringify({ called: window._called,
                     disabled: !!document.getElementById('comic-generate-btn').disabled })`));
  assert.strictEqual(r.called, false, 'neither ticked: no network call');
  assert.strictEqual(r.disabled, true, 'and the Generate button is disabled rather than silently doing nothing');
}
console.log('  neither ticked: no request, Generate disabled: OK');

// ── 6c. _comicPanelText(): extracted text AND description are COMBINED ──────────────────────────
// ⚠️ v88_ab RE-SCOPED THIS SECTION TO THE OPPOSITE CLAIM. It asserted `both === 'Cap\\nScene'` under
// the message "extracted lettering WINS — the description is never appended to real text", which
// pinned the v87_l fallback ruling. The user replaced that ruling at this cut (a 12-character sign
// heading was suppressing a 128-character description of the same photo — measured at ratios of
// 0.09 and 0.08 on their own two chapters), so the assertion was not failing, it had become an
// assertion of the wrong thing. Rewritten rather than relaxed.
//
// This ONE function is still what makes the rule true across comicCreateChapter's no-text filter,
// the panel summaries, the review card's editable set and _genChapterCount at once — and since
// v88_ab across the RENDERER too, which delegates to the same `_comicTextFromFields`. So it is
// asserted directly, in every combination.
{
  const C = client();
  const r = JSON.parse(C.run(`JSON.stringify({
    both:      _comicPanelText({ text:{ caption:'Cap', inScene:'Scene', description:'Desc' } }),
    capDesc:   _comicPanelText({ text:{ caption:'De Manteling', inScene:'', description:'Een landschap.' } }),
    textOnly:  _comicPanelText({ text:{ caption:'Cap', inScene:'', description:'' } }),
    descOnly:  _comicPanelText({ text:{ caption:'', inScene:'', description:'Ein Hund rennt.' } }),
    blankDesc: _comicPanelText({ text:{ caption:'Cap', inScene:'', description:'   ' } }),
    neither:   _comicPanelText({ text:{ caption:'', inScene:'', description:'' } }),
    noText:    _comicPanelText({}),
    shared:    _comicTextFromFields({ caption:'Cap', inScene:'Scene', description:'Desc' })
  })`));
  assert.strictEqual(r.both, 'Cap\nScene\n\nDesc',
    'extracted lettering and the description are BOTH kept, extracted first');
  // The separator is load-bearing, not cosmetic: _storyParasHtml splits on /\n\n+/, so a SINGLE
  // newline here would render the description as another line of the same paragraph instead of the
  // second block the ruling asked for. caption/inScene keep their single newline — one block.
  assert.ok(/^Cap\nScene\n\nDesc$/.test(r.both),
    'joined with a BLANK line, so _storyParasHtml renders two <p> blocks; caption/inScene stay one block');
  assert.strictEqual(r.capDesc, 'De Manteling\n\nEen landschap.',
    'the reported case: a short sign heading no longer suppresses the description');
  assert.strictEqual(r.textOnly, 'Cap', 'a caption alone is still the text, with no trailing separator');
  assert.strictEqual(r.descOnly, 'Ein Hund rennt.',
    'a panel with no lettering is still exactly its description — v87_l chapters are unchanged');
  assert.strictEqual(r.blankDesc, 'Cap',
    'a whitespace-only description adds nothing — no empty second block');
  assert.strictEqual(r.neither, '', 'nothing at all is still nothing (the panel is filtered out downstream)');
  assert.strictEqual(r.noText, '', 'an un-extracted panel is unchanged');
  assert.strictEqual(r.shared, r.both,
    '_comicPanelText is a thin wrapper over the shared _comicTextFromFields the renderer also uses');
}
console.log('  _comicPanelText(): extracted text and description are combined into two blocks: OK');

// ── 6d. …and the rule reaches the PUBLISHED build, not just index.html ──────────────────────────
// ⚠️ v88_r's rule, applied deliberately: "a guard written against index.html says nothing about
// docs/index.html". The ← previous-chapter button was a ReferenceError in the published build for
// four releases because the function it called sat inside the @static-exclude region and every
// guard for it read the source file. `_comicTextFromFields` is a new client helper added near the
// comic wizard, so the same accident was available here — and the published build is where the
// students are. Asserted at the SOURCE layer because that is where "the built file defines this"
// is observable; the BEHAVIOUR is pinned above, against the same code loaded from index.html.
{
  const built = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
  assert.ok(/function\s+_comicTextFromFields\s*\(/.test(built),
    'the static build DEFINES _comicTextFromFields — it must not land inside the @static-exclude region');
  assert.ok(/function\s+_comicPanelText\s*\(/.test(built), 'and still defines _comicPanelText');
  assert.ok(/function\s+_comicStoryPanelsHtml\s*\(/.test(built), 'and the renderer that delegates to it');
  // Absence over the WHOLE file, not a passing fixture: the old fallback expression must not
  // survive anywhere in the built output, in either function's shape.
  assert.ok(!/return\s+extracted\s*\|\|\s*String\(t\.description/.test(built),
    'and carries no surviving copy of the v87_l fallback rule');
  // Non-vacuity for the checks above: prove this file really did read the BUILT artifact and not a
  // second copy of index.html. ⚠️ The first draft used `built.includes('STATIC_LESSONS')` against
  // `!html.includes('STATIC_LESSONS =')` and went red on a correct tree — index.html mentions
  // STATIC_LESSONS a dozen times, in `typeof STATIC_LESSONS !== 'undefined'` guards. The
  // discriminator has to be something the BUILD produces, not something the build merely reads:
  // only the built file DECLARES it, and only the source file still carries the exclude marker.
  assert.ok(/const\s+STATIC_LESSONS\b/.test(built) && !/const\s+STATIC_LESSONS\b/.test(html),
    'non-vacuity: only the built file DECLARES STATIC_LESSONS');
  assert.ok(html.includes('@static-exclude-start') && !built.includes('@static-exclude-start'),
    'non-vacuity: and only the source still carries the @static-exclude marker — genuinely two different files');
}
console.log('  the shared text rule is present in the PUBLISHED build too (v88_r rule): OK');

console.log('unit-comic-extraction: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
