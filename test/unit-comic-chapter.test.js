// unit-comic-chapter.test.js
// PLAN §2.4 / Track A4 milestone 3 (v85_m) — client-side half of chapter formation. The server half
// (comicPanels surviving generate-book's pipeline onto the persisted topic, story text verbatim) is
// covered by e2e-comic-chapter.test.js (a real fresh-spawned server). This file covers:
//   • §1 _comicBuildStoryText(): joins each panel's caption then in-scene text (the user's own
//     ruling — both, not caption-only), panels separated by a blank line, panels with NEITHER field
//     skipped entirely (not an empty paragraph).
//   • §2 comicCreateChapter(): zero panels is a no-op; panels with no extracted text at all fails
//     cleanly (no network call); a real batch builds the correct /api/generate-book body (chunks[0]
//     carries the joined text AND a comicPanels array — box + caption/inScene + a fresh crop per
//     panel), disables both action buttons, and hands the returned bookId to _pollComicBookJob() —
//     a SIBLING of _pollBookJob(), not a reuse (that function is hardwired to #pdf-panel's own state).
//   • §3/§4 _pollComicBookJob(): a real 2000ms poll interval (same convention as
//     unit-gen-attribution.test.js's own startBackgroundJob() test), covering both 'done' and
//     'error' outcomes — both must re-enable the buttons and clear the status, not leave the UI stuck.
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

// ── 1. _comicBuildStoryText(): caption+inScene per panel, blank-line separated, skips empty panels ──
{
  const C = client();
  const r = C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:1,y2:1, text: { caption:'Cap one.', inScene:'Sign one.' } },
      { x1:1,y1:1,x2:2,y2:2, text: { caption:'Cap two.', inScene:'' } },
      { x1:2,y1:2,x2:3,y2:3, text: { caption:'', inScene:'Sign only.' } },
      { x1:3,y1:3,x2:4,y2:4 },   // never extracted at all (no .text)
      { x1:4,y1:4,x2:5,y2:5, text: { caption:'', inScene:'' } },   // extracted, panel had no text
    ];
    _comicBuildStoryText()`);
  assert.strictEqual(r,
    'Cap one.\nSign one.\n\nCap two.\n\nSign only.',
    'caption+inScene joined per panel, panels blank-line separated, panels with neither field skipped entirely (not an empty paragraph)');
}
console.log('  _comicBuildStoryText(): caption then in-scene per panel, blank-line separated, empty panels skipped: OK');

// ── 2a. comicCreateChapter(): zero panels is a no-op ──────────────────────────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [];
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2a');
  await settle();
  const called = JSON.parse(C.run('JSON.stringify(window._fetchCalled)'));
  assert.strictEqual(called, false, 'zero drawn panels: comicCreateChapter() never calls fetch');
}
console.log('  comicCreateChapter(): zero panels is a no-op: OK');

// ── 2b. comicCreateChapter(): panels exist but none have extracted text — fails cleanly ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:1,y2:1}];   // never extracted
    window._fetchCalled = false;
    fetch = function(){ window._fetchCalled = true; return Promise.resolve({ok:true,json:function(){return Promise.resolve({});}}); };
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2b');
  await settle();
  const called = JSON.parse(C.run('JSON.stringify(window._fetchCalled)'));
  assert.strictEqual(called, false, 'no extracted text on any panel: comicCreateChapter() never calls fetch (fails before the network, not after)');
}
console.log('  comicCreateChapter(): no extracted text anywhere fails cleanly, no network call: OK');

// ── 2c. comicCreateChapter(): correct POST body, disables buttons, hands off to the poller ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } },
      { x1:5,y1:5,x2:15,y2:15, text: { caption:'Cap B', inScene:'Scene B' } },
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
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2c');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCall: window._fetchCall, startedWith: window._startedWith,
    cropCalls: window._cropCalls,
    createBtnDisabled: document.getElementById('comic-create-btn').disabled,
    extractBtnDisabled: document.getElementById('comic-extract-btn').disabled })`));
  assert.strictEqual(r.fetchCall.url, '/api/generate-book', 'POSTs to the SAME endpoint pdfGenerateAll() uses');
  assert.strictEqual(r.fetchCall.method, 'POST', 'uses POST');
  const chunk = r.fetchCall.body.chunks[0];
  assert.strictEqual(chunk.text, 'Cap A\n\nCap B\nScene B', 'chunk text is the joined story text');
  assert.strictEqual(chunk.comicPanels.length, 2, 'one comicPanels entry per drawn panel');
  assert.deepStrictEqual(
    [chunk.comicPanels[0].x1, chunk.comicPanels[0].caption, chunk.comicPanels[0].image],
    [0, 'Cap A', 'CROP_0'], 'panel 0: box coords, caption, and a FRESH crop (not a cached one) all present');
  assert.deepStrictEqual(
    [chunk.comicPanels[1].x1, chunk.comicPanels[1].inScene, chunk.comicPanels[1].image],
    [5, 'Scene B', 'CROP_5'], 'panel 1: box coords, inScene, and its own fresh crop all present');
  assert.strictEqual(r.startedWith, 'book_xyz', 'hands the returned bookId to _pollComicBookJob (a SIBLING of _pollBookJob, not the same function)');
  assert.strictEqual(r.createBtnDisabled, true, 'the create-chapter button is disabled while the request is in flight');
  assert.strictEqual(r.extractBtnDisabled, true, 'the extract button is ALSO disabled — redrawing/re-extracting mid-creation would race the just-sent snapshot');
}
console.log('  comicCreateChapter(): correct POST body (joined text + comicPanels with fresh crops), disables both buttons, hands off to its own poller: OK');

// ── 3. _pollComicBookJob(): a 'done' status re-enables both buttons and clears status ──
{
  const C = client();
  C.run(`document.getElementById('comic-create-btn').disabled = true;
    document.getElementById('comic-extract-btn').disabled = true;
    window._loadSavedListCalled = false;
    loadSavedList = function(){ window._loadSavedListCalled = true; return Promise.resolve(); };
    fetch = function(url){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'done', chapters:[{status:'done', title:'A Comic Chapter', topicId:'tp_x'}] }); } });
    };
    _pollComicBookJob('book_done');
    true;`, 't3');
  await settle(2200);   // the real 2000ms poll interval
  const r = JSON.parse(C.run(`JSON.stringify({ createBtnDisabled: document.getElementById('comic-create-btn').disabled,
    extractBtnDisabled: document.getElementById('comic-extract-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent,
    loadSavedListCalled: window._loadSavedListCalled })`));
  assert.strictEqual(r.createBtnDisabled, false, "a 'done' status re-enables the create-chapter button");
  assert.strictEqual(r.extractBtnDisabled, false, "a 'done' status re-enables the extract button");
  assert.strictEqual(r.status, '', "a 'done' status clears the in-progress status text");
  assert.strictEqual(r.loadSavedListCalled, true, "a 'done' status refreshes the saved list so the new chapter appears");
}
console.log("  _pollComicBookJob(): a 'done' status re-enables both buttons, clears status, refreshes the saved list: OK");

// ── 4. _pollComicBookJob(): an 'error' status recovers cleanly ────────────────────
{
  const C = client();
  C.run(`document.getElementById('comic-create-btn').disabled = true;
    document.getElementById('comic-extract-btn').disabled = true;
    loadSavedList = function(){ return Promise.resolve(); };
    fetch = function(){
      return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
        status:'error', error:'model unreachable', chapters:[{status:'error'}] }); } });
    };
    _pollComicBookJob('book_err');
    true;`, 't4');
  await settle(2200);
  const r = JSON.parse(C.run(`JSON.stringify({ createBtnDisabled: document.getElementById('comic-create-btn').disabled,
    extractBtnDisabled: document.getElementById('comic-extract-btn').disabled,
    status: document.getElementById('comic-extract-status').textContent })`));
  assert.strictEqual(r.createBtnDisabled, false, "an 'error' status re-enables the create-chapter button");
  assert.strictEqual(r.extractBtnDisabled, false, "an 'error' status re-enables the extract button");
  assert.strictEqual(r.status, '', "an 'error' status clears the status text rather than leaving it stuck");
}
console.log("  _pollComicBookJob(): an 'error' status recovers cleanly, buttons never stuck disabled: OK");

console.log('unit-comic-chapter: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
