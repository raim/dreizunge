// unit-comic-chapter.test.js
// PLAN §2.4 Track A4 milestone 3, REDESIGNED at v85_p — client-side half of ONE-CHAPTER-PER-PANEL
// chapter formation (reversed from v85_m's original "one page = one chunk = one chapter" after a
// real user report). The server half (N chunks -> N chained chapters, each with its own comicPanels)
// is covered by e2e-comic-chapter.test.js. This file covers:
//   • §1 _comicPanelText(): joins ONE panel's own caption+in-scene text (no cross-panel joining
//     anymore — that was the old, now-removed _comicBuildStoryText()).
//   • §2 comicCreateChapter(): zero panels / no extracted text anywhere are no-ops; a real batch
//     builds ONE chunk PER PANEL (not one joined chunk), each carrying its OWN comicPanels entry
//     with a FRESH crop; a panel with no extracted text contributes NO chunk (filtered, not sent
//     broken); the arc/storyboard controls (new in v85_p, real-usage bug fixes) are read and
//     threaded into the request body correctly, in both directions (checked and unchecked).
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

// ── 1. _comicPanelText(): ONE panel's own caption+in-scene, no cross-panel joining ──
{
  const C = client();
  const r = JSON.parse(C.run(`JSON.stringify({
    both: _comicPanelText({ text: { caption:'Cap.', inScene:'Sign.' } }),
    captionOnly: _comicPanelText({ text: { caption:'Cap only.', inScene:'' } }),
    inSceneOnly: _comicPanelText({ text: { caption:'', inScene:'Sign only.' } }),
    neither: _comicPanelText({ text: { caption:'', inScene:'' } }),
    unextracted: _comicPanelText({})
  })`));
  assert.strictEqual(r.both, 'Cap.\nSign.', 'caption then in-scene, joined with a newline, for ONE panel');
  assert.strictEqual(r.captionOnly, 'Cap only.', 'caption-only panel: just the caption, no stray newline');
  assert.strictEqual(r.inSceneOnly, 'Sign only.', 'in-scene-only panel: just the in-scene text');
  assert.strictEqual(r.neither, '', 'a panel with neither field is an empty string');
  assert.strictEqual(r.unextracted, '', 'a never-extracted panel (no .text at all) is an empty string, not a crash');
}
console.log('  _comicPanelText(): one panel\'s own caption+in-scene text, no cross-panel joining: OK');

// ── 2a. comicCreateChapter(): zero panels / no extracted text anywhere are no-ops ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [];
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2a');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCalled)')), false, 'zero panels: no-op');
}
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:1,y2:1}];   // never extracted
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2a2');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCalled)')), false, 'no extracted text anywhere: no-op, no network call');
}
console.log('  comicCreateChapter(): zero panels / nothing extracted are both clean no-ops: OK');

// ── 2b. comicCreateChapter(): ONE CHUNK PER PANEL, fresh crops, a textless panel is filtered ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } },
      { x1:5,y1:5,x2:15,y2:15, text: { caption:'', inScene:'' } },      // extracted, but nothing found — must be filtered
      { x1:9,y1:9,x2:19,y2:19, text: { caption:'Cap C', inScene:'Scene C' } },
    ];
    window._cropCalls = [];
    _comicCropDataUrl = function(b){ window._cropCalls.push(b.x1); return 'CROP_' + b.x1; };
    window._startedWith = null;
    _pollComicBookJob = function(bookId){ window._startedWith = bookId; };
    window._fetchCall = null;
    fetch = function(url, opts){
      window._fetchCall = { url: url, method: opts.method, body: JSON.parse(opts.body) };
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'book_xyz' }); } });
    };
    document.getElementById('gen-arc-cb').checked = false;
    document.getElementById('post-gen-storyboard-cb').checked = false;
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2b');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCall: window._fetchCall, startedWith: window._startedWith,
    cropCalls: window._cropCalls })`));
  assert.strictEqual(r.fetchCall.url, '/api/generate-book', 'POSTs to the SAME endpoint pdfGenerateAll() uses');
  const chunks = r.fetchCall.body.chunks;
  assert.strictEqual(chunks.length, 2, 'exactly 2 chunks — the textless panel (2nd) was filtered out, not sent broken');
  assert.strictEqual(chunks[0].text, 'Cap A', 'chunk 0 is panel 0\'s OWN text');
  assert.strictEqual(chunks[1].text, 'Cap C\nScene C', 'chunk 1 is panel 2\'s OWN text (skipping the filtered panel 1) — NOT joined with chunk 0');
  assert.strictEqual(chunks[0].comicPanels.length, 1, 'chunk 0 carries exactly ONE comicPanels entry (its own), not all three');
  assert.deepStrictEqual([chunks[0].comicPanels[0].x1, chunks[0].comicPanels[0].image], [0, 'CROP_0'], 'chunk 0\'s comicPanels entry is panel 0\'s own box + a FRESH crop');
  assert.deepStrictEqual([chunks[1].comicPanels[0].x1, chunks[1].comicPanels[0].image], [9, 'CROP_9'], 'chunk 1\'s comicPanels entry is panel 2\'s own box + its own fresh crop');
  assert.strictEqual(r.fetchCall.body.arc, undefined, 'arc omitted entirely when the checkbox is unchecked (not sent as false)');
  assert.strictEqual(r.fetchCall.body.postGenStoryboard, false, 'postGenStoryboard explicitly false when unchecked');
  assert.strictEqual(r.startedWith, 'book_xyz', 'hands the returned bookId to _pollComicBookJob');
}
console.log('  comicCreateChapter(): ONE chunk per panel (not joined), fresh per-panel crops, a textless panel is filtered, not sent broken: OK');

// ── 2c. comicCreateChapter(): arc + storyboard controls, when CHECKED, are threaded into the body ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } }];
    _comicCropDataUrl = function(){ return 'X'; };
    _pollComicBookJob = function(){};
    window._readArcTypesCalledWith = null;
    readArcTypeChecks = function(id){ window._readArcTypesCalledWith = id; return ['grammar']; };
    window._fetchCall = null;
    fetch = function(url, opts){
      window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'book_2' }); } });
    };
    document.getElementById('gen-arc-cb').checked = true;
    document.getElementById('post-gen-storyboard-cb').checked = true;
    document.getElementById('continue-select').value = 'sl_parent_1';
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2c');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCall: window._fetchCall, arcTypesCalledWith: window._readArcTypesCalledWith })`));
  assert.strictEqual(r.fetchCall.arc, true, 'arc:true sent when the checkbox is checked');
  assert.deepStrictEqual(r.fetchCall.arcTypes, ['grammar'], 'arcTypes read from the SAME shared tick-list PDF/wizard use');
  // item AL part 2: the comic panel's own #comic-arc-types container was DELETED, not renamed — all
  // three send paths read the wizard's one #gen-arc-types now. Same claim, one container.
  assert.strictEqual(r.arcTypesCalledWith, 'gen-arc-types',
    "reads from #gen-arc-types, the ONE canonical tick-list all three input modes share");
  assert.strictEqual(r.fetchCall.postGenStoryboard, true, 'postGenStoryboard:true sent when that checkbox is checked');
  // ⚠️ REGRESSION GUARD for the bug item AL found by reading the source: comicCreateChapter() never
  // sent `continuedFrom` at all, so a comic-sourced chapter could not be linked as the continuation
  // of an existing storyline — silently, with the picker sitting right there on the form. Fixed at
  // v87_h. Mutation-tested: drop the field from the body and this goes red.
  assert.strictEqual(r.fetchCall.continuedFrom, 'sl_parent_1',
    'continuedFrom is sent, from the SAME #continue-select pdfGenerateAll() and doGenerate() read');
}
console.log('  comicCreateChapter(): arc + storyboard + continuedFrom are correctly threaded into the request: OK');

// ── 3. _pollComicBookJob() / _comicBookCheckOnce() — the REAL functions, not mocked (v86_e) ────────
// Item K: the same mobile-backgrounding fix v86_d gave _startComicExtractJob/_startComicDetectJob,
// now extended to the book/chapter-creation poller. This required refactoring a `while(true){...}`
// loop into a re-invokable _comicBookCheckOnce(), gated on the pre-existing _comicBookId — every test
// above mocks _pollComicBookJob() itself, so none of them exercise this refactor at all; these do.

// ── 3a. a 'done' status: toast names the chapter title, full cleanup runs, loadSavedList() called ──
{
  const C = client();
  C.run(`_comicBookId = 'book_done'; _comicBookPolling = false;
    document.getElementById('comic-generate-btn').disabled = true;
    window._toasts = []; showToast = function(msg){ window._toasts.push(msg); };
    window._savedListCalls = 0; loadSavedList = function(){ window._savedListCalls++; return Promise.resolve(); };
    fetch = function(url){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'done', chapters:[{ title:'Grandpa\\'s Dough', status:'idle' }] }); } });
    };
    _pollComicBookJob('book_done');
    true;`, 't3a');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ bookId: _comicBookId, polling: _comicBookPolling,
    extractDisabled: document.getElementById('comic-generate-btn').disabled,
    toasts: window._toasts, savedListCalls: window._savedListCalls })`));
  assert.strictEqual(r.bookId, null, "a 'done' status clears _comicBookId");
  assert.strictEqual(r.polling, false, "a 'done' status clears _comicBookPolling");
  assert.strictEqual(r.extractDisabled, false, "a 'done' status re-enables the extract button");
  assert.strictEqual(r.toasts.length, 1, 'exactly one toast');
  assert.ok(r.toasts[0].indexOf("Grandpa's Dough") >= 0, 'the toast names the chapter title from the FIRST chapter: ' + r.toasts[0]);
  assert.strictEqual(r.savedListCalls, 1, 'loadSavedList() is called exactly once as part of cleanup');
}
console.log("  _pollComicBookJob(): a 'done' status toasts the chapter title, cleans up, calls loadSavedList(): OK");

// ── 3b. an 'error' status: error toast, same full cleanup ──
{
  const C = client();
  C.run(`_comicBookId = 'book_err'; _comicBookPolling = false;
    window._toasts = []; showToast = function(msg){ window._toasts.push(msg); };
    loadSavedList = function(){ return Promise.resolve(); };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'error', error:'model unreachable' }); } }); };
    _pollComicBookJob('book_err');
    true;`, 't3b');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ bookId: _comicBookId, polling: _comicBookPolling, toasts: window._toasts })`));
  assert.strictEqual(r.bookId, null, "an 'error' status clears _comicBookId");
  assert.strictEqual(r.polling, false, "an 'error' status clears _comicBookPolling");
  assert.strictEqual(r.toasts.length, 1, 'exactly one toast');
  assert.ok(r.toasts[0].indexOf('model unreachable') >= 0, 'the toast names the server error: ' + r.toasts[0]);
}
console.log("  _pollComicBookJob(): an 'error' status toasts the server error, cleans up: OK");

// ── 3c. a 404 (job gone): cleanup runs, but NO toast (matches original pre-refactor behaviour) ──
{
  const C = client();
  C.run(`_comicBookId = 'book_gone'; _comicBookPolling = false;
    window._toasts = []; showToast = function(msg){ window._toasts.push(msg); };
    loadSavedList = function(){ return Promise.resolve(); };
    fetch = function(){ return Promise.resolve({ ok:false, status:404, json: function(){ return Promise.resolve({}); } }); };
    _pollComicBookJob('book_gone');
    true;`, 't3c');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ bookId: _comicBookId, polling: _comicBookPolling, toasts: window._toasts })`));
  assert.strictEqual(r.bookId, null, 'a 404 (job gone) clears _comicBookId');
  assert.strictEqual(r.polling, false, 'a 404 (job gone) clears _comicBookPolling');
  assert.strictEqual(r.toasts.length, 0, 'a 404 is silent, no toast — matches the ORIGINAL pre-refactor behaviour (a bare `break`)');
}
console.log('  _pollComicBookJob(): a 404 (job gone) cleans up silently, no toast (matches original behaviour): OK');

// ── 3d. a network hiccup mid-poll is NOT terminal — the loop retries after its own 2s sleep ──
// (this is the one behaviour that is genuinely easy to get wrong in a refactor: extract/detect treat
// a fetch failure as TERMINAL, but the book-job poller always retried silently, since book creation
// can run long and a flaky connection shouldn't abort the whole flow — preserved deliberately)
{
  const C = client();
  C.run(`_comicBookId = 'book_retry'; _comicBookPolling = false;
    window._toasts = []; showToast = function(msg){ window._toasts.push(msg); };
    loadSavedList = function(){ return Promise.resolve(); };
    window._fetchCalls = 0;
    fetch = function(){
      window._fetchCalls++;
      if(window._fetchCalls === 1) return Promise.reject(new Error('network blip'));
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({ status:'done', chapters:[{title:'Recovered'}] }); } });
    };
    _pollComicBookJob('book_retry');
    true;`, 't3d');
  await settle(2200);   // one real poll interval, so the SECOND (successful) fetch has a chance to fire
  const r = JSON.parse(C.run(`JSON.stringify({ bookId: _comicBookId, fetchCalls: window._fetchCalls, toasts: window._toasts })`));
  assert.strictEqual(r.fetchCalls, 2, 'the first (failed) fetch did not abort the poll — a second attempt followed');
  assert.strictEqual(r.bookId, null, 'the poll eventually completes once the network recovers');
  assert.strictEqual(r.toasts.length, 1, 'exactly one toast — for the eventual success, not the transient failure');
  assert.ok(r.toasts[0].indexOf('Recovered') >= 0, 'the success toast reflects the SECOND (successful) attempt: ' + r.toasts[0]);
}
console.log('  _pollComicBookJob(): a network hiccup mid-poll is NOT terminal — retries after its own 2s sleep, matches original behaviour: OK');

// ── 3e. _comicBookCheckOnce(): the visibility-recovery shape — an off-schedule call for a STALE id
//        is a no-op (cannot clobber a newer/already-finished job), matching extract/detect's own §8 ──
{
  const C = client();
  C.run(`_comicBookId = 'book_current';
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ ok:true, status:200,
      json: function(){ return Promise.resolve({ status:'done', chapters:[] }); } }); };
    _comicBookCheckOnce('book_stale');   // a DIFFERENT (superseded) id — the listener's own call shape
    true;`, 't3e');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCalled: window._fetchCalled, bookIdAfter: _comicBookId })`));
  assert.strictEqual(r.fetchCalled, false, 'a check for a SUPERSEDED book id never even calls fetch');
  assert.strictEqual(r.bookIdAfter, 'book_current', 'the actually-current book id is untouched by the stale check');
}
console.log('  _comicBookCheckOnce(): a check for a superseded book id is a no-op — cannot clobber a newer, still-current job: OK');

// ── 3f. the shared visibilitychange listener also re-checks the book-job poller (source check — see
//        unit-comic-extraction.test.js §8b for why this harness can't drive it behaviourally) ──
{
  const idx = html.indexOf("addEventListener('visibilitychange'");
  const block = html.slice(html.indexOf('{', idx), html.indexOf('});', idx));
  assert.ok(/_comicBookCheckOnce\(_comicBookId\)/.test(block),
    'the shared listener ALSO re-checks the book-job poller, not just extract/detect');
}
console.log('  visibilitychange listener also re-checks the book-job poller (source check): OK');

// ── 3g. _comicBookCheckOnce() ALSO logs to console at each step (v86_j — user-reported: the
//        mobile-backgrounding recovery "didn't recover", but there was no way to tell from the
//        console whether this function ever ran, or what the server answered) ────────────────────
{
  const C = client();
  C.run(`window._logs = [];
    console.log = function(msg){ window._logs.push(msg); };
    _comicBookId = 'book_stale_check';
    _comicBookCheckOnce('book_different');
    true;`, 't3g-stale');
  const r = JSON.parse(C.run(`JSON.stringify(window._logs)`));
  assert.strictEqual(r.length, 1, 'a stale/superseded check still logs exactly once');
  assert.ok(r[0].indexOf('stale') >= 0, 'the log names it as stale: ' + r[0]);
}
console.log('  _comicBookCheckOnce(): logs a stale/superseded call: OK');

{
  const C = client();
  C.run(`window._logs = []; window._toasts = [];
    console.log = function(msg){ window._logs.push(msg); };
    showToast = function(msg){ window._toasts.push(msg); };
    loadSavedList = function(){ return Promise.resolve(); };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'done', chapters:[{title:'A Title'}] }); } }); };
    _comicBookId = 'book_real';
    _comicBookCheckOnce('book_real');
    true;`, 't3g-real');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify(window._logs)`));
  assert.ok(r.some(m => m.indexOf('polling book_real') >= 0), 'logs that it is polling: ' + JSON.stringify(r));
  assert.ok(r.some(m => m.indexOf('status=done') >= 0), 'logs the status it received: ' + JSON.stringify(r));
}
console.log('  _comicBookCheckOnce(): logs the polling attempt and the status received: OK');

console.log('unit-comic-chapter: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
