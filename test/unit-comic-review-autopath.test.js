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

    // ── 3. ⚠️ REWRITTEN AT v88_aa: the review card NEVER generates, from either entry ──────────
    // This asserted the opposite — that a card opened from #gen-btn still POSTs on confirm — as the
    // non-vacuity for §1/§2 ("without this, 'never generate' would pass and break the feature").
    // That was true while card 3's Generate ROUTED THROUGH this card, which is exactly the bounce
    // the user reported: press Generate on card 3, land back on the confirmation popover, press
    // Generate again. Card 3 now calls comicCreateChapter() directly (unit-gen-wizard §12e), so
    // this card has one behaviour on both entries: save the text, go to card 3.
    //
    // The non-vacuity §1/§2 needed does not disappear — it MOVES to where generation now lives, and
    // unit-gen-wizard §12e is that assertion: #gen-btn generates exactly once. Stated here so a
    // reader of this file knows the "never generate" claim is bounded, not universal.
    {
      const C = client();
      C.run(`comicOpenReview(); _comicReviewConfirm(); true;`, 'gen-confirm');
      await settle(60);
      assert.strictEqual(bookPosts(C), 0,
        'a manually opened review card also POSTs nothing on confirm — the popover is for text, '
        + 'never for starting generation');
      assert.strictEqual(C.run('_comicBookId'), null, 'and no book job is adopted');
      assert.ok(C.run(`__gotos.indexOf(3) >= 0`),
        'it lands the learner on card 3, where the one Generate button lives');
      console.log('  the review card never generates, from either entry: OK');
    }

    // ── 3b. ⚠️ v88_aa: the way BACK to the review card ────────────────────────────────────────
    // Load-bearing, and easy to miss. Card 3's Generate used to double as "reopen the text review"
    // for anyone who dismissed the auto-popup — that was the ONLY other way in. Removing that
    // routing without replacing the affordance would strand a learner's extracted text behind a
    // popup they closed once. So card 2 carries its own reopen button, and it must be there.
    //
    // Asserted behaviourally, not just as markup: it is hidden while there is nothing to review, so
    // it can never open the empty card `comicOpenReview()` itself only toasts about.
    {
      const C = client();
      // ⚠️ EXISTENCE at the SOURCE layer, not the DOM. `lib-dom` auto-vivifies a plain div for any
      // id, so `getElementById(...)` is always truthy and even `tagName === 'BUTTON'` fails for the
      // buttons that DO exist — measured: comic-clear-btn and comic-generate-btn both report DIV.
      // A DOM "the button is there" assertion could not fail, which is the trap this project has
      // shipped vacuous guards on twice.
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const at = src.indexOf('id="comic-review-btn"');
      assert.ok(at > 0, 'card 2 has a reopen-review button in the markup');
      assert.ok(/onclick="comicOpenReview\(\)"/.test(src.slice(Math.max(0, at - 200), at + 200)),
        'wired to open the review card, not to some other action');

      // The SHOW/HIDE logic is genuinely observable: it is written onto the element by our own code,
      // so the auto-vivified stand-in carries it faithfully.
      const vis = () => C.run(`(function(){ var b=document.getElementById('comic-review-btn');
        return b ? String(b.style.display) : 'MISSING'; })()`);

      C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10 }]; _comicRenderList(); true;`, 'no-text');
      assert.strictEqual(vis(), 'none',
        'hidden while no panel has any extracted text — it cannot open an empty card');

      C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text:{ caption:'De Manteling' } }];
        _comicRenderList(); true;`, 'with-text');
      assert.strictEqual(vis(), '', 'and shown once there IS something to review');

      // A description alone counts too — a wordless panel that was only described still has text
      // worth checking, and that is exactly the panel whose description keeps getting lost.
      C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text:{ caption:'', inScene:'', description:'Een landschap.' } }];
        _comicRenderList(); true;`, 'desc-only');
      assert.strictEqual(vis(), '',
        'including a panel that only carries an image description — the very panel whose '
        + 'description the user keeps losing track of');
      console.log('  card 2 carries the way back into the review card, shown only when there is text: OK');
    }

    // ── 4. ⚠️ v88_aa: ONE label, because there is now one behaviour ──────────────────────────
    // The card used to carry two labels for two behaviours ("Save text & continue" when auto-opened,
    // "Confirm & create chapter" when card 3 routed through it). With the routing gone there is one
    // behaviour, so a second label would be a promise the button cannot keep.
    {
      const C = client();
      C.run(`comicOpenReview(true); true;`, 'label-auto');
      const autoHtml = C.run(`_comicReviewOverlayEl.innerHTML`);
      C.run(`_comicReviewCancel(); comicOpenReview(); true;`, 'label-gen');
      const genHtml = C.run(`_comicReviewOverlayEl.innerHTML`);
      // Compared through the client's own escHtml: the label contains an ampersand, so the raw
      // ui.json value never appears literally in the markup.
      const escSave = C.run(`escHtml(t('form.image_review_save'))`);
      assert.ok(autoHtml.includes(escSave), 'the auto-opened card offers the save-and-continue label');
      assert.ok(genHtml.includes(escSave), 'and so does a manually opened one — same act, same words');
      // The create-chapter label is gone from the client entirely: a button that says it will create
      // a chapter and then does not is worse than no label at all.
      const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      assert.ok(!/image_review_confirm/.test(src),
        'the old create-chapter label is no longer referenced anywhere in the client');
      console.log('  one label, because there is one behaviour: OK');
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
