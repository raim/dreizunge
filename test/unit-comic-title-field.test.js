// unit-comic-title-field.test.js
// item AN (v88_d) — a typed chapter title must not destroy the generated image description.
//
// User report: "image upload bug: I lost an already generated image description, perhaps because I
// added title 'De Manteling' in tp_17882063882590000007."
//
// Reproduced from the STORED DATA, not the report. That topic has story "De Manteling",
// comicPanels[0].caption "De Manteling", inScene "", and NO description field at all. Two
// independent losses, both real:
//   (1) the card had no title field, so the user typed a title into CAPTION — and `_comicPanelText()`
//       reads caption as extracted lettering, which suppresses the description (their own earlier
//       ruling: the description is a fallback "if no text is extracted"). Working as ruled;
//       EXPERIENCED as data loss. Ruling taken this cut: a separate TITLE field, so caption keeps
//       meaning "text lettered in the panel" and the earlier ruling stays true.
//   (2) `comicCreateChapter()`'s comicPanels metadata never wrote `description` at all — so even
//       when the description WAS the chapter text, it survived nowhere. Unblocked by any ruling and
//       fixed unconditionally.
// A THIRD instance (the draft box whitelist) is guarded in unit-comic-extract-durable §4.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 40));

// One DESCRIPTION-ONLY panel — exactly the shape the report was about.
function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='nl'; APP.srcLang='de';
    APP.difficulty=2; APP.lessonFormat='standard';
    _comicCropDataUrl = function(b){ return 'CROP_'+b.x1; };
    APP_COMIC.dataUrl = 'data:image/jpeg;base64,AAAA';
    APP_COMIC.naturalW = 1280; APP_COMIC.naturalH = 721;
    APP_COMIC.boxes = [{ x1:0, y1:0, x2:1280, y2:721,
      text:{ title:'', caption:'', inScene:'', description:'Een bord bij een hek in het bos.', error:null } }];
    __posts = [];
    fetch = function(url, opts){
      __posts.push({ url:String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
      var b = String(url).indexOf('/api/lessons') >= 0 || String(url).indexOf('/api/storylines') >= 0
        ? [] : { bookId:'bk_1', id:'d1' };
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(b); } });
    };
    true;`, 'seed');
  return C;
}
const bookBody = C => JSON.parse(C.run(
  `JSON.stringify((__posts.filter(function(p){ return p.url.indexOf('/api/generate-book') >= 0; })[0]||{}).body)`));

(async () => {
  let failed = false;
  try {

    // ── 1. THE REPORTED CASE: typing a title leaves the description intact ─────────────────────
    {
      const C = client();
      C.run(`comicOpenReview();
        _comicReviewEdit(0,'title','De Manteling');
        _comicReviewConfirm(); true;`, 'title');
      await settle(60);
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.title`), 'De Manteling', 'the title is stored');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.caption`), '',
        'and CAPTION is untouched — which is what used to suppress the description');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.description`), 'Een bord bij een hek in het bos.',
        'the generated description survives — the whole report');
      const body = bookBody(C);
      assert.strictEqual(body.chunks[0].text, 'Een bord bij een hek in het bos.',
        'and it is still what becomes the chapter text (the fallback ruling is intact)');
      console.log('  typing a title no longer displaces the generated description: OK');
    }

    // ── 2. The typed title becomes the chapter title, and is marked AUTHORED ───────────────────
    // Without the flag the server's chapter-title post-pass renames it minutes later — the user
    // would watch their title save and then silently vanish, a new instance of the same loss.
    {
      const C = client();
      C.run(`comicOpenReview(); _comicReviewEdit(0,'title','De Manteling'); _comicReviewConfirm(); true;`, 't2');
      await settle(60);
      const body = bookBody(C);
      assert.strictEqual(body.chunks[0].title, 'De Manteling', 'the chunk carries the typed title');
      assert.strictEqual(body.chunks[0].titleAuthored, true,
        'flagged as authored, so _applyChapterTitles leaves it alone');
      console.log('  the typed title becomes the chunk title, flagged authored: OK');
    }

    // ── 3. Non-vacuity: with NO typed title, nothing changes ───────────────────────────────────
    // The derived placeholder and the post-pass must both keep working for every existing flow.
    {
      const C = client();
      C.run(`comicOpenReview(); _comicReviewConfirm(); true;`, 't3');
      await settle(60);
      const body = bookBody(C);
      assert.strictEqual(body.chunks[0].titleAuthored, false,
        'no typed title → NOT authored → the post-pass titles it as it always did');
      assert.strictEqual(body.chunks[0].title, 'Een bord bij een hek in het bos.'.slice(0, 40),
        'and the derived placeholder is unchanged');
      console.log('  with no typed title, the derived placeholder and post-pass are unaffected: OK');
    }

    // ── 4. item AN half (2): comicPanels finally PERSISTS the description ──────────────────────
    // The half with no ruling behind it. tp_17882063882590000007 has a caption and no description
    // to show for it, because this object never carried the field.
    {
      const C = client();
      C.run(`comicOpenReview(); _comicReviewEdit(0,'title','De Manteling'); _comicReviewConfirm(); true;`, 't4');
      await settle(60);
      const p = bookBody(C).chunks[0].comicPanels[0];
      assert.strictEqual(p.description, 'Een bord bij een hek in het bos.',
        'the panel metadata persists the description — it survived NOWHERE before this cut');
      assert.strictEqual(p.title, 'De Manteling', 'and the typed title rides with it');
      assert.strictEqual(p.caption, '', 'caption still means "lettering in the panel"');
      assert.ok(p.image, 'the cropped image is still attached, as before');
      console.log('  comicPanels persists description AND title: OK');
    }

    // ── 5. The card renders a title input, distinct from the caption one ───────────────────────
    {
      const C = client();
      C.run(`comicOpenReview(); true;`, 't5');
      const html = C.run(`_comicReviewOverlayEl.innerHTML`);
      assert.ok(html.includes(`_comicReviewEdit(0,'title'`), 'a title input, bound to the title field');
      assert.ok(html.includes(`_comicReviewEdit(0,'caption'`), 'and the caption input is still there');
      assert.ok(html.includes(UI.en['form.comic_title_ph']), 'labelled with the new placeholder');
      console.log('  the review card renders a title input beside the caption one: OK');
    }

    // ── 6. A RE-EXTRACTION preserves the typed title, client-side ──────────────────────────────
    // The job result replaces the whole `text` object, so without an explicit carry-over a second
    // extraction pass deletes an authored title — item AN's own loss, reintroduced through a
    // different door. Mirrored server-side in applyExtractionToDraft (e2e-comic-extract-draft §3b);
    // the two writers must agree, or the outcome depends on which one happened to run.
    {
      const C = client();
      C.run(`APP_COMIC.boxes[0].text.title = 'De Manteling';
        _comicApplyExtraction([{ caption:'HALT', inScene:'', raw:'', description:'', error:null }]);
        true;`, 're-extract');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.title`), 'De Manteling',
        'the typed title survives a re-extraction');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.caption`), 'HALT',
        'while the extracted fields ARE rewritten (non-vacuity)');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.description`), '',
        'and a field the new result cleared is genuinely cleared');
      console.log('  a re-extraction rewrites extracted fields but keeps the typed title: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-comic-title-field: FAILED' : 'unit-comic-title-field: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
