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
      assert.ok(html.includes(UI.en['form.image_title_ph']), 'labelled with the new placeholder');
      console.log('  the review card renders a title input beside the caption one: OK');
}

// ── v88_y: EVERY field carries a visible label ────────────────────────────────────────────────
// ⚠️ The cause of two separate user reports. These fields carried PLACEHOLDERS and no labels, and a
// placeholder disappears the moment its field has content — so on a panel with extracted text the
// only label-shaped words on screen were the EMPTY title field's placeholder, sitting directly above
// the CAPTION field that held the text. The user typed their chapter title into the caption:
// measured in their own data, `title:""` with the title text in `caption`.
//
// Asserted as ORDER — each label immediately precedes the field it names — because "the card
// contains the word 'Chapter title'" was ALREADY true when the bug existed. Position is the whole
// claim; presence never was.
{
  const C = client();
  // ⚠️ description EMPTY on purpose. The user only ever saw THREE fields, because the description
  // box rendered only when one existed — hiding it in exactly the state worth noticing. On their
  // screen the third visible field was therefore `inScene`, whose string used to read "What's
  // happening in the scene": that describes a DESCRIPTION, while the field holds TEXT VISIBLE IN THE
  // PICTURE. They looked for the description, found a field that seemed to ask for one, and the real
  // title field above was invisible because it was empty. This fixture reproduces that exact panel.
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10,
      text:{ caption:'Cap', inScene:'', description:'', title:'' } }];
    comicOpenReview(); true;`, 'labels');
  const html = C.run(`_comicReviewOverlayEl.innerHTML`);
  const UI = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'ui.json'), 'utf8')).en;

  // Each field's own edit handler names it, so the field position is unambiguous.
  const fieldAt = (name) => {
    const i = html.indexOf(`_comicReviewEdit(0,'${name}'`);
    assert.ok(i > 0, `the ${name} field is rendered`);
    return html.lastIndexOf('<', i);
  };
  const labelAt = (key) => {
    const i = html.indexOf(UI[key]);
    assert.ok(i > 0, `the label for ${key} is rendered (${JSON.stringify(UI[key])})`);
    return i;
  };
  for (const [key, field] of [
    ['form.image_title_ph', 'title'],
    ['form.image_caption_ph', 'caption'],
    ['form.image_scene_ph', 'inScene'],
    ['form.image_description_lbl', 'description'],
  ]) {
    const l = labelAt(key), f = fieldAt(field);
    assert.ok(l < f, `${key} is rendered BEFORE the ${field} field it names`);
    // …and nothing else sits between them: a label separated from its field by another input is
    // exactly the arrangement that caused this bug.
    assert.ok(!/_comicReviewEdit\(/.test(html.slice(l, f)),
      `no other field sits between the ${key} label and the ${field} field it names`);
  }

  // The placeholders are GONE from the labelled fields — a permanent label plus the same words
  // greyed inside an empty field is the doubled text that made this ambiguous to begin with.
  const titleTag = html.slice(fieldAt('title'), html.indexOf('>', fieldAt('title')));
  assert.ok(!/placeholder=/.test(titleTag),
    'the title field no longer carries a placeholder duplicating its own label');

  // ⚠️ Non-vacuity, and the assertion that would have caught the original bug: with the title field
  // EMPTY — the exact state the user was in — its label must still be visible, and must still be
  // adjacent to the TITLE field rather than reading as a heading for the caption below.
  assert.ok(html.indexOf(UI['form.image_caption_ph']) < fieldAt('caption'),
    'and with an empty title, the caption still has its OWN label directly above it');

  // The description box is rendered even with NO description — "none was generated" is the state
  // worth seeing, and the old conditional hid it precisely then.
  assert.ok(/_comicReviewEdit\(0,'description'/.test(html),
    'the image-description field is rendered even when empty — its absence used to be silent');

  // And the in-scene string no longer promises a description. Asserted on the STRING, because this
  // is the one that sent the user to the wrong field; a label in the right place saying the wrong
  // thing would still be the bug.
  assert.ok(!/happening in the scene/i.test(UI['form.image_scene_ph']),
    'the in-scene label no longer reads as a request for a description of the scene');
  assert.ok(/text/i.test(UI['form.image_scene_ph']),
    'it says what the field actually holds: text visible in the picture (got '
    + JSON.stringify(UI['form.image_scene_ph']) + ')');
  assert.notStrictEqual(UI['form.image_scene_ph'], UI['form.image_description_lbl'],
    'and the two adjacent fields no longer share a label — the whole confusion in one line');
  console.log('  every review-card field carries a visible, ACCURATE label, immediately above itself: OK');
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
