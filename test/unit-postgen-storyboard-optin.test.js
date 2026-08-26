// unit-postgen-storyboard-optin.test.js
// v85_p — CLIENT-side half of the storyboard opt-in fix (the server-side gate itself is covered by
// e2e-postgen-storyboard-optin.test.js). _runBookJob's storyboard post-pass used to run
// unconditionally for every /api/generate-book caller; now gated on body.postGenStoryboard. This
// file proves each of the THREE callers actually threads its own checkbox state into the request:
//   • §1 pdfGenerateAll() -> the NEW #pdf-storyboard-cb (this panel had no such control before).
//   • §2 doGenerate()'s multi-chapter "generated" branch -> the EXISTING #post-gen-storyboard-cb,
//     which was captured into `postGen.storyboard` all along but never actually SENT in the initial
//     request — the exact latent no-op this whole fix addresses. (comicCreateChapter()'s own thread
//     is covered by unit-comic-chapter.test.js §2c.)
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

// ── 1. pdfGenerateAll() threads #pdf-storyboard-cb into the request, both states ──
{
  const C = client();
  C.run(`_pdfChunks = [ { title:'C1', text:'x', wordCount:5 } ];
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b1' }); } }); };
    _pollBookJob = function(){};
    document.getElementById('pdf-storyboard-cb').checked = true;
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 't1a');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenStoryboard)')), true,
    'pdfGenerateAll(): checked #pdf-storyboard-cb sends postGenStoryboard:true');
}
{
  const C = client();
  C.run(`_pdfChunks = [ { title:'C1', text:'x', wordCount:5 } ];
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b2' }); } }); };
    _pollBookJob = function(){};
    document.getElementById('pdf-storyboard-cb').checked = false;
    (async()=>{ await pdfGenerateAll(); })();
    true;`, 't1b');
  await settle();
  assert.strictEqual(JSON.parse(C.run('JSON.stringify(window._fetchCall.postGenStoryboard)')), false,
    'pdfGenerateAll(): unchecked #pdf-storyboard-cb sends postGenStoryboard:false (explicit, not omitted)');
}
console.log('  pdfGenerateAll(): the NEW #pdf-storyboard-cb is correctly threaded, both states: OK');

// ── 2. doGenerate()'s multi-chapter branch threads #post-gen-storyboard-cb into the INITIAL
//      request — the exact thing that was captured but never sent before this fix ─────────────
{
  const C = client();
  C.run(`APP.numChapters = 3;
    document.getElementById('topic-input').value = 'A generated multi-chapter story';
    window._fetchCall = null;
    fetch = function(url, opts){ window._fetchCall = JSON.parse(opts.body);
      return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ bookId:'b3' }); } }); };
    _pollGenBook = function(){ return Promise.resolve({ status:'done', chapters:[] }); };
    document.getElementById('post-gen-storyboard-cb').checked = true;
    (async()=>{ await doGenerate(); })();
    true;`, 't2');
  await settle();
  const r = JSON.parse(C.run('JSON.stringify(window._fetchCall)'));
  assert.strictEqual(r.generated, true, 'sanity: this is the multi-chapter GENERATED branch, not the chunks/upload one');
  assert.strictEqual(r.postGenStoryboard, true,
    'doGenerate(): checked #post-gen-storyboard-cb now ACTUALLY reaches the initial request body — ' +
    'the latent no-op (captured into postGen.storyboard, then never sent) that this whole fix addresses');
}
console.log("  doGenerate()'s generated-batch branch threads #post-gen-storyboard-cb into the INITIAL request (the fixed latent no-op): OK");

console.log('unit-postgen-storyboard-optin: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
