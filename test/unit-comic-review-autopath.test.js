// unit-comic-review-autopath.test.js
// item AQ (v88_c) — confirming the AUTO-opened review card must NOT start a book generation.
//
// User-reported, with the server log attached: after image text extraction, "the generate chapter
// button ... automatically starts the book generation, and the next button leads to a lesson
// selection site that has no generate button at all." The log showed a full run — translation,
// arc[review], "Lesson 1/1" — on text the user had not finished reviewing.
//
// Measured cause: comicOpenReview(auto) is reached TWO ways and the `auto` flag never reached
// _comicReviewConfirm(), which called comicCreateChapter() unconditionally.
//   • #gen-btn on wizard card 3 (doGenerate()'s comic branch) — SHOULD generate; the learner has
//     just picked lesson types and pressed start.
//   • _comicExtractCheckOnce() popping the card the moment extraction succeeds (v86_v) — must NOT;
//     the learner has never seen card 3, so #gen-skip-lessons-cb is still at its default and
//     comicCreateChapter() reads that as "generate everything".
// The vanishing card-3 button was the SAME bug's second half, not a separate defect:
// comicCreateChapter() sets _comicBookId, and _applyLessonCardUI() then computes busy → the start
// row hides. Fixing the first half fixes it, which §4 pins directly.
//
// ⚠️ Guarded at the BEHAVIOUR layer, per the protocol: these sections COUNT /api/generate-book
// requests from the real comicCreateChapter(), rather than asserting which function name
// _comicReviewConfirm mentions. A source-level check cannot fail for the state that actually
// matters, and "no generation happened" is exactly a state.
//
// Also covers item AM (v88_c, same release, same code region): a fresh upload pre-selects the whole
// image as one panel — §5, including the resumed-draft path that must NOT get one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 30));

// One panel with real extracted text, plus the fetch spy every section reads.
function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='nl'; APP.srcLang='de';
    APP.difficulty=2; APP.lessonFormat='standard';
    _comicCropDataUrl = function(b){ return 'CROP_'+b.x1; };   // real fn needs a real <canvas> 2D ctx
    APP_COMIC.dataUrl = 'data:image/jpeg;base64,AAAA';
    APP_COMIC.naturalW = 1280; APP_COMIC.naturalH = 721;
    APP_COMIC.boxes = [{ x1:0, y1:0, x2:1280, y2:721,
      text:{ caption:'', inScene:'GRATIS KOSTENLOS', description:'' } }];
    __posts = [];
    // URL-aware: §6 drives the REAL _resumeComicDraftFrom, which calls selectLang()/loadSavedList()
    // on its way through — those expect ARRAYS, and a one-shape stub makes the resume path die
    // before it ever restores a box, which would make §6 vacuous rather than red.
    fetch = function(url, opts){
      var u = String(url);
      __posts.push(u);
      var body = (u.indexOf('/api/lessons') >= 0 || u.indexOf('/api/storylines') >= 0)
        ? [] : { bookId:'bk_test', id:'d1' };
      return Promise.resolve({ ok:true, status:200,
        json: function(){ return Promise.resolve(body); } });
    };
    // The wizard step the user actually lands on. _genWizardGoto is real; this records it.
    __gotos = [];
    _origGoto = _genWizardGoto;
    _genWizardGoto = function(n){ __gotos.push(n); try{ return _origGoto(n); }catch(_){} };
    true;`, 'seed');
  return C;
}
const bookPosts = C => C.run(`__posts.filter(function(u){ return u.indexOf('/api/generate-book') >= 0; }).length`);

(async () => {
  let failed = false;
  try {

    // ── 1. THE REPORTED BUG: the auto path must not generate ──────────────────────────────────
    {
      const C = client();
      C.run(`comicOpenReview(true); _comicReviewConfirm(); true;`, 'auto-confirm');
      await settle(60);
      assert.strictEqual(bookPosts(C), 0,
        'the AUTO-opened card must issue ZERO /api/generate-book requests — this is the whole report');
      assert.strictEqual(C.run('_comicBookId'), null,
        'and no book job is adopted, so card 3\'s start button stays available (the report\'s second half)');
      console.log('  auto-opened → confirm: ZERO /api/generate-book requests, no book job: OK');
    }

    // ── 2. …but it DOES store the reviewed text, and lands the user on card 3 ──────────────────
    // "we want that button to just store chapter text as draft, no lessons yet." Storing is the
    // half that must still happen, or the fix would trade one data loss for another.
    {
      const C = client();
      C.run(`comicOpenReview(true);
        _comicReviewEdit(0,'caption','De Manteling');
        _comicReviewEdit(0,'inScene','GRATIS KOSTENLOS');
        _comicReviewConfirm(); true;`, 'auto-store');
      await settle(60);
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.caption`), 'De Manteling',
        'the edited caption is written back onto the panel');
      assert.strictEqual(C.run(`APP_COMIC.boxes[0].text.inScene`), 'GRATIS KOSTENLOS',
        'and the in-scene text with it');
      assert.ok(C.run(`__gotos.indexOf(3) >= 0`),
        'the user is taken to wizard card 3 — where lesson types and the start button live');
      assert.strictEqual(C.run(`!!_comicReviewOverlayEl`), false, 'the review overlay is closed');
      console.log('  auto-opened → confirm: text IS stored and the user lands on card 3: OK');
    }

    // ── 3. Non-vacuity: the CARD-3 path is unchanged and still generates ───────────────────────
    // Without this, "never generate" would pass §1 and §2 and break the feature entirely.
    {
      const C = client();
      C.run(`comicOpenReview(); _comicReviewConfirm(); true;`, 'gen-confirm');
      await settle(60);
      assert.strictEqual(bookPosts(C), 1,
        'opened from #gen-btn on card 3, confirm still POSTs exactly one /api/generate-book');
      assert.strictEqual(C.run('_comicBookId'), 'bk_test', 'and adopts the returned book job as before');
      console.log('  card-3 path → confirm: still generates, exactly once (non-vacuity): OK');
    }

    // ── 4. The button tells the truth about what it will do ────────────────────────────────────
    // The old label ("Confirm & create chapter") would be a lie on the auto path now.
    {
      const C = client();
      C.run(`comicOpenReview(true); true;`, 'label-auto');
      const autoHtml = C.run(`_comicReviewOverlayEl.innerHTML`);
      C.run(`_comicReviewCancel(); comicOpenReview(); true;`, 'label-gen');
      const genHtml = C.run(`_comicReviewOverlayEl.innerHTML`);
      // Compare against the ESCAPED strings the renderer actually emits: both labels contain an
      // ampersand, so escHtml turns "&" into "&amp;" and the raw ui.json value never appears
      // literally in the markup. Taking them through the client's own escHtml keeps this correct if
      // either string is reworded (item AP will rewrite this whole branch).
      const escSave = C.run(`escHtml(t('form.comic_review_save'))`);
      const escGen  = C.run(`escHtml(t('form.comic_review_confirm'))`);
      assert.notStrictEqual(escSave, escGen, 'the two labels are genuinely different strings');
      assert.ok(autoHtml.includes(escSave),
        'the auto card offers the save-and-continue label');
      assert.ok(!autoHtml.includes(escGen),
        'and NOT the create-chapter one, which would misdescribe what the click does');
      assert.ok(genHtml.includes(escGen),
        'the card-3 card keeps its original create-chapter label');
      console.log('  the confirm button\'s label matches the mode it is in: OK');
    }

    // ── 5. Item AM: a fresh upload pre-selects the whole image as one panel ────────────────────
    {
      const C = client();
      C.run(`APP_COMIC.boxes = []; APP_COMIC.naturalW = 0; APP_COMIC.naturalH = 0;
        _comicFinishSetup({ naturalWidth: 800, naturalHeight: 600 }, null); true;`, 'upload');
      const boxes = JSON.parse(C.run(`JSON.stringify(APP_COMIC.boxes.map(function(b){
        return { x1:b.x1, y1:b.y1, x2:b.x2, y2:b.y2 }; }))`));
      assert.strictEqual(boxes.length, 1, 'exactly one panel after an upload, not zero and not two');
      assert.deepStrictEqual(boxes[0], { x1:0, y1:0, x2:800, y2:600 },
        'and it spans the whole image, exactly as the single-panel button would have made it');
      console.log('  item AM: a fresh upload leaves ONE whole-image panel: OK');
    }

    // ── 6. …and a RESUMED DRAFT keeps its own panels ───────────────────────────────────────────
    // The one thing item AM must not break. _resumeComicDraftFrom deliberately does NOT route
    // through _comicFinishSetup (comicClearPanels() there would discard the draft's boxes); if the
    // pre-select were placed anywhere more general it would overwrite a restored draft with one
    // giant box. Asserted through the REAL resume function, not by reasoning about placement.
    {
      const C = client();
      C.run(`APP_COMIC.boxes = []; APP_COMIC.naturalW = 0; APP_COMIC.naturalH = 0;
        __resumed = _resumeComicDraftFrom({ id:'d9', kind:'comic', lang:'nl', srcLang:'de',
          comic:{ dataUrl:'data:image/jpeg;base64,AAAA', naturalW:1000, naturalH:500,
            boxes:[ {x1:10,y1:10,x2:200,y2:200,text:{caption:'a',inScene:''}},
                    {x1:300,y1:10,x2:500,y2:200,text:{caption:'b',inScene:''}} ] } });
        true;`, 'resume');
      await settle(80);
      const boxes = JSON.parse(C.run(`JSON.stringify(APP_COMIC.boxes.map(function(b){
        return { x1:b.x1, y1:b.y1, x2:b.x2, y2:b.y2 }; }))`));
      assert.strictEqual(boxes.length, 2,
        'a resumed draft keeps BOTH of its own panels — item AM must not reach this path');
      assert.deepStrictEqual(boxes[0], { x1:10, y1:10, x2:200, y2:200 }, 'first panel restored verbatim');
      assert.deepStrictEqual(boxes[1], { x1:300, y1:10, x2:500, y2:200 }, 'second panel restored verbatim');
      console.log('  item AM does NOT reach the resumed-draft path — its panels survive intact: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-comic-review-autopath: FAILED' : 'unit-comic-review-autopath: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
