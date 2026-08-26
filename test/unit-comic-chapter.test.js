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
    document.getElementById('comic-arc-cb').checked = false;
    document.getElementById('comic-storyboard-cb').checked = false;
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
    document.getElementById('comic-arc-cb').checked = true;
    document.getElementById('comic-storyboard-cb').checked = true;
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2c');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCall: window._fetchCall, arcTypesCalledWith: window._readArcTypesCalledWith })`));
  assert.strictEqual(r.fetchCall.arc, true, 'arc:true sent when the checkbox is checked');
  assert.deepStrictEqual(r.fetchCall.arcTypes, ['grammar'], 'arcTypes read from the SAME shared tick-list PDF/wizard use');
  assert.strictEqual(r.arcTypesCalledWith, 'comic-arc-types', 'reads from #comic-arc-types, the comic panel\'s own container');
  assert.strictEqual(r.fetchCall.postGenStoryboard, true, 'postGenStoryboard:true sent when that checkbox is checked');
}
console.log('  comicCreateChapter(): arc + storyboard controls, when checked, are correctly threaded into the request: OK');

console.log('unit-comic-chapter: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
