// unit-drafts.test.js — item R (roadmap_v87.md), client-side half.
//
// Server-side round trips (POST/GET/DELETE /api/drafts, GET /api/jobs aggregation) are covered
// live in test/e2e-drafts.test.js. This file covers the parts only reachable through the CLIENT:
// the autosave guard (_draftSaveDebounced — when it schedules a save and when it deliberately
// doesn't), discardDraft/_jobsDiscardDraftById's fetch behaviour, and the jobs popover's own
// rendering of a draft row (icon, discard button, open button) plus _jobsOpenLink's draft branch.
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

    // ── 1. _draftSaveDebounced(): schedules a timer only when there's something real to save ───
    {
      const C = client();
      // Nothing uploaded at all — must not schedule.
      C.run(`_uploadMode = false; _pdfChunks = []; _pdfBookId = null; _draftSaveTimer = null;
        _draftSaveDebounced();`, 't1a');
      assert.strictEqual(C.run('_draftSaveTimer', 't1a-read'), null, 'idle (no upload): no timer scheduled');

      // Uploaded but chunks empty (e.g. mid-clear) — must not schedule.
      C.run(`_uploadMode = true; _pdfChunks = []; _pdfBookId = null; _draftSaveTimer = null;
        _draftSaveDebounced();`, 't1b');
      assert.strictEqual(C.run('_draftSaveTimer', 't1b-read'), null, 'upload mode but zero chunks: no timer scheduled');

      // Real generation already running — the bookJobs entry owns durability now.
      C.run(`_uploadMode = true; _pdfChunks = [{title:'A',text:'x',wordCount:1,status:'pending'}];
        _pdfBookId = 'book_123'; _draftSaveTimer = null; _draftSaveDebounced();`, 't1c');
      assert.strictEqual(C.run('_draftSaveTimer', 't1c-read'), null, 'generation already running: no timer scheduled');

      // The real case: uploaded, has chunks, not generating — SHOULD schedule.
      C.run(`_uploadMode = true; _pdfChunks = [{title:'A',text:'x',wordCount:1,status:'pending'}];
        _pdfBookId = null; _draftSaveTimer = null; _draftSaveDebounced();`, 't1d');
      assert.notStrictEqual(C.run('_draftSaveTimer', 't1d-read'), null, 'real editable draft: a save IS scheduled');
      C.run(`clearTimeout(_draftSaveTimer)`, 't1d-cleanup');   // don't let the real 1.5s timer fire after the test exits
      console.log('  _draftSaveDebounced(): schedules only for an editable, non-generating upload: OK');
    }

    // ── 2. discardDraft(): a no-op with nothing open; deletes + clears _draftId when one exists ─
    {
      const C = client();
      C.run(`_draftId = null;`, 't2a');
      await C.run(`discardDraft()`, 't2a-call');
      assert.strictEqual(C.run('_smoke.fetch.length', 't2a-read'), 0, 'no open draft: discardDraft() never calls fetch');

      C.run(`_draftId = 'draft_abc'; _smoke.fetch.length = 0;`, 't2b');
      await C.run(`discardDraft()`, 't2b-call');
      const calls = JSON.parse(C.run(`JSON.stringify(_smoke.fetch.map(function(c){ return {url:c.url, method:(c.init&&c.init.method)}; }))`, 't2b-read'));
      assert.strictEqual(calls.length, 1, 'exactly one fetch call');
      assert.strictEqual(calls[0].url, '/api/drafts/draft_abc', 'DELETEs the right draft (got ' + calls[0].url + ')');
      assert.strictEqual(calls[0].method, 'DELETE', 'uses DELETE');
      assert.strictEqual(C.run('_draftId', 't2b-read2'), null, '_draftId is cleared after discarding');
      console.log('  discardDraft(): no-op when idle, DELETEs + clears _draftId when open: OK');
    }

    // ── 3. _jobsDiscardDraftById(): only clears _draftId when the id MATCHES this tab's own ────
    {
      const C = client();
      C.run(`_draftId = 'draft_mine'; _smoke.fetch.length = 0;`, 't3a');
      await C.run(`_jobsDiscardDraftById('draft_other')`, 't3a-call');
      assert.strictEqual(C.run('_draftId', 't3a-read'), 'draft_mine',
        'discarding a DIFFERENT draft (e.g. another tab\'s) leaves this tab\'s own _draftId untouched');
      const url1 = C.run(`_smoke.fetch[0].url`, 't3a-url');
      assert.strictEqual(url1, '/api/drafts/draft_other', 'deleted the id that was actually passed in');

      await C.run(`_jobsDiscardDraftById('draft_mine')`, 't3b-call');
      assert.strictEqual(C.run('_draftId', 't3b-read'), null,
        'discarding THIS tab\'s own open draft clears _draftId (so the next autosave creates fresh)');
      console.log('  _jobsDiscardDraftById(): only clears local state for a MATCHING id: OK');
    }

    // ── 4. _jobsRenderList(): a draft row gets its own icon + a discard button; a plain job doesn't ─
    {
      const C = client();
      C.run(`_jobsLastList = [
        { id:'draft_1', kind:'draft', label:'Draft: "book.pdf" (3 chapters)', status:'draft', step:null, error:null, link:{type:'draft', id:'draft_1'}, createdAt:2 },
        { id:'job_1', kind:'job', label:'Generating "X"', status:'running', step:'working…', error:null, link:null, createdAt:1 }
      ];
      document.getElementById('jobs-pop').style.display = '';
      _jobsRenderList();`, 't4');
      const html = C.document.getElementById('jobs-pop-list').innerHTML;
      assert.ok(html.includes('📝'), 'the draft row uses the notepad icon');
      assert.ok(/class="jobs-row-del" data-jobid="draft_1"/.test(html), 'the draft row has a discard button carrying its id');
      assert.ok(/class="jobs-row-open" data-jobid="draft_1"/.test(html), 'the draft row ALSO has an open button');
      // The plain job row must NOT get a discard button — only drafts are deletable this way.
      const jobRowStart = html.indexOf('job_1');
      const jobRowHtml = html.slice(Math.max(0, jobRowStart - 400), jobRowStart + 200);
      assert.ok(!/jobs-row-del" data-jobid="job_1"/.test(jobRowHtml), 'a plain job row gets no discard button');
      console.log('  _jobsRenderList(): draft rows get their own icon + discard button, other kinds do not: OK');
    }

    // ── 5. _jobsOpenLink({type:'draft'}) calls resumeDraft() with the right id, closes the popover ─
    {
      const C = client();
      C.run(`window._resumeCalls = [];
        resumeDraft = function(id){ window._resumeCalls.push(id); };
        window._closeCalls = 0; closeJobsPop = function(){ window._closeCalls++; };
        _jobsOpenLink({ type: 'draft', id: 'draft_xyz' });`, 't5');
      assert.deepStrictEqual(JSON.parse(C.run('JSON.stringify(window._resumeCalls)', 't5a')), ['draft_xyz'],
        'resumeDraft() called with the link\'s own id');
      assert.strictEqual(C.run('window._closeCalls', 't5b'), 1, 'the popover closes on open, same as every other kind');
      console.log('  _jobsOpenLink(draft): resumes the right draft and closes the popover: OK');
    }

    console.log('unit-drafts: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('unit-drafts FAILURE:', e.stack || e.message);
  }
  process.exit(failed ? 1 : 0);
})();
