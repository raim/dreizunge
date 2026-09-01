// unit-comic-extract-durable.test.js
// item AO (v88_d) — an extraction started on a phone must not be lost, and its job row must offer a
// way back to the text-confirmation card.
//
// User report: "I keep losing extracted text, when text extraction is started on the mobile phone.
// The job is listed in the job popover but has no link associated, and clicking on the comic draft
// job opens the generation page without the extracted text. The job popover link should lead to the
// text confirmation popover of the text extraction routine."
//
// THREE measured causes, all of which had to be closed or the report recurs:
//   1. the job carried no `link` at all — `_jobsRenderList` renders "open →" only `if (j.link)`;
//   2. `_comicExtractCheckOnce()` is the ONLY writer of `APP_COMIC.boxes[i].text`, so a tab that is
//      gone by the time the job finishes loses the result, and the draft never receives the text;
//   3. `jobDone()` schedules cleanup at FIVE MINUTES, so a link that could only read the job store
//      would work briefly and then fail silently — worse than no link.
// The durable fix is therefore SERVER-side (applyExtractionToDraft), with the link preferring the
// draft over the job.
//
// This file covers the CLIENT halves (the server half is e2e-comic-extract-draft). §4 is item AN's
// draft-whitelist half, which lives on the same path.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 40));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='nl'; APP.srcLang='de';
    APP.difficulty=2; APP.lessonFormat='standard';
    _comicCropDataUrl = function(b){ return 'CROP_'+b.x1; };
    APP_COMIC.dataUrl = 'data:image/jpeg;base64,AAAA';
    APP_COMIC.naturalW = 1280; APP_COMIC.naturalH = 721;
    APP_COMIC.boxes = [{ x1:0, y1:0, x2:1280, y2:721 }];
    __reqs = [];
    fetch = function(url, opts){
      var u = String(url);
      __reqs.push({ url:u, body: opts && opts.body ? JSON.parse(opts.body) : null });
      var body;
      if (u.indexOf('/api/lessons') >= 0 || u.indexOf('/api/storylines') >= 0) body = [];
      else if (u.indexOf('/api/drafts/') >= 0) body = __draftRecord || {};
      else if (u.indexOf('/api/drafts') >= 0) body = { id:'draft_77' };
      else if (u.indexOf('/api/job/') >= 0) body = __jobRecord || {};
      else body = { jobId:'job_1', bookId:'bk_1' };
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(body); } });
    };
    __draftRecord = null; __jobRecord = null;
    // HARNESS SHIM (INTERNALS → harness limits): lib-dom's \`src\` is a PLAIN PROPERTY — assigning it
    // never fires \`onload\`. _resumeComicDraftFrom() awaits exactly that event, so without this the
    // resume promise never settles and everything after the await is unreachable. That is a silent
    // trap, not a loud one: the boxes are restored BEFORE the await, so a section asserting only on
    // \`APP_COMIC.boxes\` passes while the rest of the function never ran at all.
    (function(){
      var img = document.getElementById('comic-draw-img');
      var _src = '';
      img.naturalWidth = 1280; img.naturalHeight = 721;
      Object.defineProperty(img, 'src', {
        get: function(){ return _src; },
        set: function(v){ _src = v; var self = this; setTimeout(function(){ if (self.onload) self.onload(); }, 0); },
        configurable: true,
      });
    })();
    true;`, 'seed');
  return C;
}
const req = (C, frag) => JSON.parse(C.run(
  `JSON.stringify(__reqs.filter(function(r){ return r.url.indexOf('${frag}') >= 0; }))`));

(async () => {
  let failed = false;
  try {

    // ── 1. The extraction POST carries the draft id, and the draft is FLUSHED first ────────────
    // Without the flush the autosave's 1.5s debounce means `_comicDraftId` is frequently still null
    // at exactly the moment that costs the whole result — the server needs an id to write onto.
    {
      const C = client();
      C.run(`_comicDraftId = null;
        document.getElementById('comic-extract-cb').checked = true;
        comicExtractPanels(); true;`, 'extract');
      await settle(80);
      const drafts = req(C, '/api/drafts');
      assert.ok(drafts.length >= 1, 'the draft is saved BEFORE extraction starts (got ' + drafts.length + ' draft calls)');
      const ex = req(C, '/api/comic-extract');
      assert.strictEqual(ex.length, 1, 'exactly one extraction request');
      assert.strictEqual(ex[0].body.draftId, 'draft_77',
        'and it carries the id the flush just assigned — this is what makes the result durable');
      console.log('  comicExtractPanels(): flushes the draft, then sends its id: OK');
    }

    // ── 2. The popover link resumes the DRAFT (the durable path), then opens the review card ───
    // Preferred over reading the job store because the job is deleted 5 minutes after it finishes.
    {
      const C = client();
      C.run(`__draftRecord = { id:'draft_77', kind:'comic', lang:'nl', srcLang:'de',
          comic:{ dataUrl:'data:image/jpeg;base64,AAAA', naturalW:1280, naturalH:721,
            boxes:[{ x1:0,y1:0,x2:1280,y2:721,
                     text:{ title:'', caption:'', inScene:'', description:'Een bord bij een hek.', error:null } }] } };
        __opened = null; _origOpen = comicOpenReview;
        comicOpenReview = function(auto){ __opened = { auto: !!auto }; };
        _jobsOpenLink({ type:'comic-extract', id:'job_1', draftId:'draft_77' }); true;`, 'open-draft');
      await settle(120);
      assert.strictEqual(req(C, '/api/drafts/draft_77').length, 1, 'the DRAFT is fetched');
      assert.strictEqual(req(C, '/api/job/').length, 0,
        'and the job store is NOT consulted — the draft is the durable record');
      assert.strictEqual(C.run(`APP_COMIC.boxes.length`), 1, 'the panel is restored');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.description`), 'Een bord bij een hek.',
        'WITH its extracted text — the whole point of the item');
      assert.strictEqual(C.run(`JSON.stringify(__opened)`), JSON.stringify({ auto: true }),
        'the review card opens, in AUTO mode (item AQ) — nobody arriving here has seen card 3');
      console.log('  the popover link resumes the draft and opens the review card, in auto mode: OK');
    }

    // ── 3. …and falls back to the job store when there is no draft ─────────────────────────────
    // Non-vacuity for §2: without this branch a link with no draftId would do nothing at all.
    {
      const C = client();
      C.run(`__jobRecord = { status:'done', data:{ panels:[ { title:'', caption:'HALT', inScene:'', description:'', error:null } ] } };
        __opened = null; comicOpenReview = function(auto){ __opened = { auto: !!auto }; };
        _jobsOpenLink({ type:'comic-extract', id:'job_1', draftId:null }); true;`, 'open-job');
      await settle(80);
      assert.strictEqual(req(C, '/api/job/job_1').length, 1, 'the job is fetched when there is no draft');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.caption`), 'HALT',
        'and its panels are applied to the boxes');
      assert.strictEqual(C.run(`JSON.stringify(__opened)`), JSON.stringify({ auto: true }),
        'the review card opens here too');
      console.log('  falls back to the job store when the link carries no draft id: OK');
    }

    // ── 4. item AN: the draft's box whitelist must not drop `description`/`title` ───────────────
    // Found by READING the route while wiring AO, not from a report: `description` was never listed,
    // so every autosave stripped it — which would also have quietly undone AO's durability fix on
    // the client's very next save. Asserted against the SERVER SOURCE, because it is a claim about
    // one whitelist literal and no client-side state can observe another process's sanitiser.
    {
      const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const at = src.indexOf('boxes: boxesIn.map(');
      assert.ok(at > 0, 'found the comic draft box sanitiser');
      // Wide enough to span the whole map body INCLUDING its comments; bounded by the literal that
      // closes it, so it cannot silently drift onto a different sanitiser further down the file.
      const end = src.indexOf('} : null,', at);
      assert.ok(end > at, 'found the end of the box text whitelist');
      const block = src.slice(at, end);
      for (const f of ['title', 'caption', 'inScene', 'description', 'raw', 'error']) {
        assert.ok(new RegExp('\\b' + f + ':').test(block),
          `the draft box whitelist keeps \`${f}\` — dropping one silently loses it on every autosave`);
      }
      console.log('  the comic draft box whitelist keeps every text field, description included: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-comic-extract-durable: FAILED' : 'unit-comic-extract-durable: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
