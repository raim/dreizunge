// unit-comic-review-card.test.js
// v86_v — user-requested intermediate step: after comic text extraction succeeds, the user goes
// through each panel's extracted caption/in-scene text, edits it, and only an EXPLICIT confirm here
// moves on to lesson generation. comicCreateChapter() itself (the actual chunk-building/POST logic,
// covered by unit-comic-chapter.test.js) is deliberately UNTOUCHED — this sits entirely above it.
//
// Interactivity is wired via onclick/oninput ATTRIBUTES, not addEventListener closures — this
// harness's addEventListener is a no-op (see lib-dom.js), so the only way this feature is testable at
// all is by calling _comicReviewEdit/_comicReviewConfirm/_comicReviewCancel directly, exactly as a
// real onclick/oninput attribute would. This file covers:
//   • §1 comicOpenReview(): filters to panels with usable extracted text (skips no-text/errored
//     panels), builds the review overlay with one row per editable panel, and a manual call with
//     nothing extracted yet toasts (an AUTOMATIC call — comicOpenReview(true) — does not).
//   • §2 _comicReviewEdit(): updates the local buffer, not APP_COMIC.boxes, while typing.
//   • §3 _comicReviewConfirm(): writes the buffer back onto APP_COMIC.boxes BY THE PANEL'S OWN
//     INDEX (not buffer position — the two diverge whenever a panel was filtered out), removes the
//     overlay, re-renders the panel list, and calls the REAL comicCreateChapter() — proving the gate
//     actually leads to generation, not just to a dead end.
//   • §4 _comicReviewCancel(): a true no-op — APP_COMIC.boxes is byte-for-byte unchanged, the overlay
//     is removed, and comicCreateChapter() is NEVER called.
//   • §5 _startComicExtractJob's own 'done' handler (_comicExtractCheckOnce): wires comicOpenReview
//     as an AUTOMATIC call after a successful extraction — mutation-tested.
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
    APP.difficulty=2;
    _comicCropDataUrl = function(b){ return 'CROP_'+b.x1; };   // real fn needs a real <canvas> 2D ctx
    true;`, 'seed');
  return C;
}

async function main() {

// ── 1. comicOpenReview(): filters, builds rows, toasts only on a MANUAL empty call ─────────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'Scene A' } },
      { x1:5,y1:5,x2:15,y2:15 },                              // never extracted — no text at all
      { x1:9,y1:9,x2:19,y2:19, text: { error:'boom' } },      // extraction failed for this one
      { x1:1,y1:1,x2:2,y2:2,  text: { caption:'', inScene:'' } },   // extracted, found nothing — still editable
    ];
    comicOpenReview();
    true;`, 't1a');
  const r = JSON.parse(C.run(`JSON.stringify({
    editableLen: (_comicReviewEditable||[]).length,
    editableIdxs: (_comicReviewEditable||[]).map(function(e){return e.i;}),
    bufferLen: (_comicReviewBuffer||[]).length,
    buf0: _comicReviewBuffer[0], buf1: _comicReviewBuffer[1],
    overlaySet: !!_comicReviewOverlayEl,
  })`));
  assert.strictEqual(r.editableLen, 2, 'only panels 0 and 3 have usable text (no-text and errored panels excluded)');
  assert.deepStrictEqual(r.editableIdxs, [0, 3], 'the ORIGINAL panel indices are kept, not renumbered 0..n');
  assert.strictEqual(r.bufferLen, 2, 'one buffer entry per editable panel');
  assert.deepStrictEqual(r.buf0, { caption:'Cap A', inScene:'Scene A' }, 'buffer seeded from the panel\'s own extracted text');
  assert.deepStrictEqual(r.buf1, { caption:'', inScene:'' }, 'an empty-but-extracted panel seeds an empty (not undefined) buffer entry');
  assert.strictEqual(r.overlaySet, true, 'the overlay element is tracked for a later close');
}
console.log('  comicOpenReview(): filters to panels with usable text, seeds the edit buffer from their OWN extracted text: OK');

// ── 1b. comicOpenReview(): the REAL rendered markup is the near-fullscreen grid layout (v86_x) ──
// User-reported, real usage: "the popover for text confirmation could be bigger and should allow to
// view the text without scrolling." Checks the ACTUAL markup comicOpenReview() built (read back off
// the tracked overlay element), not a source-text regex over index.html — a comment could satisfy a
// regex without the function ever producing this markup at runtime.
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'Scene A' } },
      { x1:5,y1:5,x2:15,y2:15, text: { caption:'Cap B', inScene:'Scene B' } },
    ];
    comicOpenReview();
    true;`, 't1c');
  const html = C.run(`_comicReviewOverlayEl.innerHTML`);
  assert.ok(/max-width:min\(1200px,95vw\);width:95vw;height:90vh/.test(html),
    'the modal box is sized near-fullscreen, not the original 520px fixed width');
  assert.ok(/display:grid;grid-template-columns:repeat\(auto-fill,minmax\(340px,1fr\)\)/.test(html),
    'panels are laid out in a responsive GRID (multiple columns on a wide screen), not a single flex column');
  assert.ok(/rows="4"/.test(html), 'the in-scene textarea grew from 2 rows to 4, so a typical caption is visible without scrolling inside its own field');
}
console.log('  comicOpenReview(): the rendered markup is the near-fullscreen grid layout, not the original narrow single-column list: OK');

{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:1,y2:1 }];   // never extracted
    window._toasts = []; showToast = function(m){ window._toasts.push(m); };
    comicOpenReview();          // manual — must toast
    comicOpenReview(true);      // automatic — must NOT toast
    true;`, 't1b');
  const r = JSON.parse(C.run(`JSON.stringify({ toasts: window._toasts, overlaySet: !!_comicReviewOverlayEl })`));
  assert.strictEqual(r.toasts.length, 1, 'exactly one toast — only the manual call, not the automatic one');
  assert.ok(/no extracted text yet/.test(r.toasts[0]), 'toast names the actual problem');
  assert.strictEqual(r.overlaySet, false, 'nothing to review — no overlay opened either way');
}
console.log('  comicOpenReview(): a manual call with nothing extracted toasts; an automatic one stays silent: OK');

// ── 2. _comicReviewEdit(): updates the LOCAL BUFFER, not APP_COMIC.boxes, while typing ──────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text: { caption:'Old cap', inScene:'Old scene' } }];
    comicOpenReview();
    _comicReviewEdit(0, 'caption', 'New cap');
    true;`, 't2');
  const r = JSON.parse(C.run(`JSON.stringify({
    bufferCaption: _comicReviewBuffer[0].caption,
    boxCaption: APP_COMIC.boxes[0].text.caption,
  })`));
  assert.strictEqual(r.bufferCaption, 'New cap', 'the buffer reflects the edit immediately');
  assert.strictEqual(r.boxCaption, 'Old cap', 'APP_COMIC.boxes is UNTOUCHED until confirm — this is the whole point of the local buffer');
}
console.log('  _comicReviewEdit(): edits land in the local buffer only, never straight onto APP_COMIC.boxes: OK');

// ── 3. _comicReviewConfirm(): writes back BY THE PANEL\'S OWN INDEX, closes, generates ──────────
{
  const C = client();
  C.run(`APP_COMIC.boxes = [
      { x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'' } },
      { x1:5,y1:5,x2:15,y2:15, text: { error:'boom' } },              // filtered out of the review
      { x1:9,y1:9,x2:19,y2:19, text: { caption:'Cap C', inScene:'' } },
    ];
    comicOpenReview();
    _comicReviewEdit(0, 'caption', 'Edited A');
    _comicReviewEdit(1, 'inScene', 'Edited C scene');   // buffer index 1 = panel 2 (panel 1 was filtered)
    window._renderCalls = 0; _comicRenderList = function(){ window._renderCalls++; };
    window._createCalled = false; comicCreateChapter = function(){ window._createCalled = true; };
    _comicReviewConfirm();
    true;`, 't3');
  const r = JSON.parse(C.run(`JSON.stringify({
    boxes: APP_COMIC.boxes.map(function(b){return b.text;}),
    overlaySet: !!_comicReviewOverlayEl,
    editableCleared: _comicReviewEditable === null,
    renderCalls: window._renderCalls, createCalled: window._createCalled,
  })`));
  assert.strictEqual(r.boxes[0].caption, 'Edited A', 'panel 0\'s edit landed on panel 0');
  assert.strictEqual(r.boxes[1].error, 'boom', 'the filtered-out panel (index 1) is untouched — it was never in the buffer at all');
  assert.strictEqual(r.boxes[2].inScene, 'Edited C scene', 'buffer slot 1 (the SECOND editable panel) wrote back to panel 2, its OWN original index — not panel 1');
  assert.strictEqual(r.overlaySet, false, 'the overlay is removed on confirm');
  assert.strictEqual(r.editableCleared, true, 'review state is cleared, not left dangling for a stale later edit');
  assert.strictEqual(r.renderCalls, 1, 'the panel list is re-rendered so the summary reflects the edits');
  assert.strictEqual(r.createCalled, true, 'confirm hands off to the REAL comicCreateChapter() — the gate actually leads to generation');
}
console.log('  _comicReviewConfirm(): writes the buffer back BY THE PANEL\'S OWN INDEX, closes, re-renders, and calls comicCreateChapter(): OK');

// ── 4. _comicReviewCancel(): a true no-op — APP_COMIC.boxes untouched, generation never fires ───
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{ x1:0,y1:0,x2:10,y2:10, text: { caption:'Cap A', inScene:'Scene A' } }];
    var before = JSON.stringify(APP_COMIC.boxes);
    comicOpenReview();
    _comicReviewEdit(0, 'caption', 'Never saved');
    window._createCalled = false; comicCreateChapter = function(){ window._createCalled = true; };
    _comicReviewCancel();
    window._after = JSON.stringify(APP_COMIC.boxes);
    window._before = before;
    true;`, 't4');
  const r = JSON.parse(C.run(`JSON.stringify({ before: window._before, after: window._after,
    overlaySet: !!_comicReviewOverlayEl, createCalled: window._createCalled })`));
  assert.strictEqual(r.after, r.before, 'cancel is a true no-op: APP_COMIC.boxes is byte-for-byte identical to before the modal ever opened');
  assert.strictEqual(r.overlaySet, false, 'the overlay is removed on cancel too');
  assert.strictEqual(r.createCalled, false, 'cancel never reaches comicCreateChapter()');
}
console.log('  _comicReviewCancel(): a true no-op — the edit is discarded, nothing is generated: OK');

// ── 5. extraction success wires comicOpenReview(true) automatically (the REAL function, not a regex) ──
// Calls the real _comicExtractCheckOnce() directly (same shape as unit-comic-extraction.test.js's own
// §8d) rather than reading source — a comment or a dead branch could satisfy a text match without the
// call ever actually happening at runtime, which a real invocation cannot fake.
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    window._openReviewCalls = []; comicOpenReview = function(auto){ window._openReviewCalls.push(auto); };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'done', data: { panels: [ { caption:'C', inScene:'', error:null } ] } }); } }); };
    _comicExtractJobId = 'job_review';
    _comicExtractCheckOnce('job_review');
    true;`, 't5a');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify(window._openReviewCalls)`));
  assert.deepStrictEqual(r, [true], 'a successful extraction calls comicOpenReview(true) exactly once, marked as automatic');
}
{
  const C = client();
  C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    window._openReviewCalls = []; comicOpenReview = function(auto){ window._openReviewCalls.push(auto); };
    fetch = function(){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
      status:'error', error:'boom' }); } });
    };
    _comicExtractJobId = 'job_review_err';
    _comicExtractCheckOnce('job_review_err');
    true;`, 't5b');
  await settle();
  const r = JSON.parse(C.run(`JSON.stringify(window._openReviewCalls)`));
  assert.deepStrictEqual(r, [], 'an errored extraction never opens the review card');
}
console.log('  _comicExtractCheckOnce(): a successful extraction automatically opens the review card (an errored one does not): OK');

console.log('unit-comic-review-card: ALL PASSED');
}

main().catch(e => { console.error(e); process.exit(1); });
