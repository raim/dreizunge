// unit-drafts-comic.test.js — item R follow-up (roadmap_v87.md), comic upload flow.
//
// Server-side round trips are covered live in test/e2e-drafts-comic.test.js. This file covers the
// CLIENT-only parts: the comic autosave guard's own conditions (separate from the PDF flow's
// _draftSaveDebounced — different state, different id, checked independently rather than assumed
// to mirror it), discardComicDraft()'s fetch behaviour, and resumeDraft()'s dispatch onto
// _resumeComicDraftFrom() for a comic-kind record.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`APP.info = { canGenerate: true };
    UI_STRINGS = ${JSON.stringify(UI.en)};
    true;`, 'seed');
  return C;
}

(async () => {
  let failed = false;
  try {

    // ── 1. _comicDraftSaveDebounced(): schedules only when there's a real, editable draft ───────
    {
      const C = client();
      // No image at all.
      C.run(`APP_COMIC.dataUrl = null; APP_COMIC.boxes = []; _comicBookId = null;
        _comicDraftSaveTimer = null; _comicDraftSaveDebounced();`, 't1a');
      assert.strictEqual(C.run('_comicDraftSaveTimer', 't1a-read'), null, 'no image: no timer scheduled');

      // An image but no boxes drawn yet.
      C.run(`APP_COMIC.dataUrl = 'data:image/jpeg;base64,x'; APP_COMIC.boxes = []; _comicBookId = null;
        _comicDraftSaveTimer = null; _comicDraftSaveDebounced();`, 't1b');
      assert.strictEqual(C.run('_comicDraftSaveTimer', 't1b-read'), null, 'image but zero boxes: no timer scheduled');

      // Real generation already running.
      C.run(`APP_COMIC.dataUrl = 'data:image/jpeg;base64,x'; APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
        _comicBookId = 'book_xyz'; _comicDraftSaveTimer = null; _comicDraftSaveDebounced();`, 't1c');
      assert.strictEqual(C.run('_comicDraftSaveTimer', 't1c-read'), null, 'generation already running: no timer scheduled');

      // The real case: image + at least one box, not generating.
      C.run(`APP_COMIC.dataUrl = 'data:image/jpeg;base64,x'; APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
        _comicBookId = null; _comicDraftSaveTimer = null; _comicDraftSaveDebounced();`, 't1d');
      assert.notStrictEqual(C.run('_comicDraftSaveTimer', 't1d-read'), null, 'real editable draft: a save IS scheduled');
      C.run(`clearTimeout(_comicDraftSaveTimer)`, 't1d-cleanup');
      console.log('  _comicDraftSaveDebounced(): schedules only for an editable, non-generating comic draft: OK');
    }

    // ── 2. discardComicDraft(): no-op when idle; DELETEs + clears _comicDraftId when open ───────
    {
      const C = client();
      C.run(`_comicDraftId = null;`, 't2a');
      await C.run(`discardComicDraft()`, 't2a-call');
      assert.strictEqual(C.run('_smoke.fetch.length', 't2a-read'), 0, 'no open comic draft: never calls fetch');

      C.run(`_comicDraftId = 'draft_comic1'; _smoke.fetch.length = 0;`, 't2b');
      await C.run(`discardComicDraft()`, 't2b-call');
      const calls = JSON.parse(C.run(`JSON.stringify(_smoke.fetch.map(function(c){ return {url:c.url, method:(c.init&&c.init.method)}; }))`, 't2b-read'));
      assert.strictEqual(calls.length, 1, 'exactly one fetch call');
      assert.strictEqual(calls[0].url, '/api/drafts/draft_comic1', 'DELETEs the right draft (got ' + calls[0].url + ')');
      assert.strictEqual(calls[0].method, 'DELETE', 'uses DELETE');
      assert.strictEqual(C.run('_comicDraftId', 't2b-read2'), null, '_comicDraftId cleared after discarding');
      console.log('  discardComicDraft(): no-op when idle, DELETEs + clears _comicDraftId when open: OK');
    }

    // ── 3. resumeDraft() dispatches a comic-kind record to _resumeComicDraftFrom(), not the PDF path ─
    {
      const C = client();
      C.run(`window._comicResumeCalls = [];
        _resumeComicDraftFrom = function(d){ window._comicResumeCalls.push(d.id); return Promise.resolve(); };
        fetch = function(){ return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(
          { id:'draft_comic1', kind:'comic', comic:{dataUrl:'data:image/jpeg;base64,x', boxes:[{x1:0,y1:0,x2:10,y2:10}]} }); } }); };
        _pdfChunks = ['SHOULD NOT BE TOUCHED'];`, 't3setup');
      await C.run(`resumeDraft('draft_comic1')`, 't3-call');
      assert.deepStrictEqual(JSON.parse(C.run('JSON.stringify(window._comicResumeCalls)', 't3a')), ['draft_comic1'],
        '_resumeComicDraftFrom() called with the fetched record');
      const pdfChunksUntouched = C.run(`JSON.stringify(_pdfChunks)`, 't3b');
      assert.strictEqual(pdfChunksUntouched, '["SHOULD NOT BE TOUCHED"]',
        'the PDF flow\'s own _pdfChunks is left completely untouched — the two draft kinds do not cross-contaminate state');
      console.log('  resumeDraft(): dispatches a comic-kind record to _resumeComicDraftFrom(), leaves PDF state untouched: OK');
    }

    console.log('unit-drafts-comic: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('unit-drafts-comic FAILURE:', e.stack || e.message);
  }
  process.exit(failed ? 1 : 0);
})();
