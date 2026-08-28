// unit-postgen-analysis-optin.test.js
// item W follow-up (v86_o) — CLIENT-side half of the analysis opt-in checkbox (the server-side gate
// is covered by e2e-postgen-analysis-optin.test.js). Mirrors unit-postgen-storyboard-optin.test.js's
// own structure exactly, since postGenAnalysis was built as a direct mirror of postGenStoryboard —
// proves each of the THREE callers threads its OWN checkbox state into the request:
//   • §1 pdfGenerateAll() -> #pdf-analysis-cb
//   • §2 comicCreateChapter() -> #comic-analysis-cb
//   • §3 doGenerate()'s multi-chapter "generated" branch -> #post-gen-analysis-cb, threaded straight
//     into the INITIAL request (unlike storyboard/QC there, analysis needs no post-hoc
//     _applyPostGenFeatures orchestration — _kickOffAnalysisJob already fires server-side, per
//     chapter, inside _runBookJob itself).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

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

// ── 1. pdfGenerateAll() threads #pdf-analysis-cb into the request, both states ──
{
  const C = client();
  C.run(`_pdfChunks = [ { title:'C1', text:'x', wordCount:5 } ];
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b1' }); } }); };
    _pollBookJob = function(){};
    document.getElementById('pdf-analysis-cb').checked = true;
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 't1a');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenAnalysis)')), true,
    'pdfGenerateAll(): checked #pdf-analysis-cb sends postGenAnalysis:true');
}
{
  const C = client();
  C.run(`_pdfChunks = [ { title:'C1', text:'x', wordCount:5 } ];
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b2' }); } }); };
    _pollBookJob = function(){};
    document.getElementById('pdf-analysis-cb').checked = false;
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 't1b');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenAnalysis)')), false,
    'pdfGenerateAll(): unchecked #pdf-analysis-cb sends postGenAnalysis:false (explicit, not omitted)');
}
console.log('  pdfGenerateAll(): #pdf-analysis-cb is correctly threaded, both states: OK');

// ── 2. comicCreateChapter() threads #comic-analysis-cb into the request, both states ──
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } }];
    _comicCropDataUrl = function(){ return 'X'; };
    _pollComicBookJob = function(){};
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b3' }); } }); };
    document.getElementById('comic-arc-cb').checked = false;
    document.getElementById('comic-storyboard-cb').checked = false;
    document.getElementById('comic-analysis-cb').checked = true;
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2a');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenAnalysis)')), true,
    'comicCreateChapter(): checked #comic-analysis-cb sends postGenAnalysis:true');
}
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } }];
    _comicCropDataUrl = function(){ return 'X'; };
    _pollComicBookJob = function(){};
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b4' }); } }); };
    document.getElementById('comic-arc-cb').checked = false;
    document.getElementById('comic-storyboard-cb').checked = false;
    document.getElementById('comic-analysis-cb').checked = false;
    (async()=>{ await comicCreateChapter(); })();
    true;`, 't2b');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenAnalysis)')), false,
    'comicCreateChapter(): unchecked #comic-analysis-cb sends postGenAnalysis:false (explicit, not omitted)');
}
console.log('  comicCreateChapter(): #comic-analysis-cb is correctly threaded, both states: OK');

// ── 3. doGenerate()'s multi-chapter branch threads #post-gen-analysis-cb into the INITIAL
//      request — same shape as postGenStoryboard's own fix, built correctly from the start here
//      (no post-hoc _applyPostGenFeatures orchestration needed for analysis) ──────────────────
{
  const C = client();
  C.run(`APP.numChapters = 3;
    document.getElementById('topic-input').value = 'A generated multi-chapter story';
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b5' }); } }); };
    _pollGenBook = function(){ return Promise.resolve({ status:'done', chapters:[] }); };
    document.getElementById('post-gen-analysis-cb').checked = true;
    (async()=>{ await doGenerate(); })();
    true;`, 't3');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._fetchCall)'));
  assert.strictEqual(r.generated, true, 'sanity: this is the multi-chapter GENERATED branch, not the chunks/upload one');
  assert.strictEqual(r.postGenAnalysis, true,
    'doGenerate(): checked #post-gen-analysis-cb reaches the initial request body, same as postGenStoryboard');
}
console.log("  doGenerate()'s generated-batch branch threads #post-gen-analysis-cb into the INITIAL request: OK");

console.log('unit-postgen-analysis-optin: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
