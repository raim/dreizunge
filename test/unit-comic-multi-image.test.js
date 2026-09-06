// unit-comic-multi-image.test.js — item V, v89_al.
//
// User: "Allow multiple photos/images to be loaded and treated like multiple panels in the
// image-based story-generation pipeline." Ruling, recorded verbatim in `_comicFinishSetup`'s own
// comment: "if multiple images are uploaded, mark all images as one panel, but still allow the user
// to modify, add and resort panels."
//
// ⚠️ THE USER CLARIFIED THAT SENTENCE at this cut: it means "mark EACH image as a panel" — N images
// give N panels — not "merge all images into one panel". The phrasing reads both ways, and §5 below
// is the assertion that pins the right one.
//
// ⚠️ The item was open since the `v86` line with an explicit warning attached — `roadmap_v88.md`
// said "each image is a panel" and "each image is a chapter" COINCIDE today and would diverge the
// moment several panels are drawn on one of several images, and told a later session to settle which
// one before building. The ruling settles it: images become PANELS. `comicCreateChapter()` already
// forms one chapter per panel (`v85_p`), so N images give N chapters — and drawing three panels on
// one page correctly gives three chapters from it.
//
// ⚠️ THE SEAM this rests on: `dataUrl`/`naturalW`/`naturalH` still mean "the ACTIVE page", so the
// ~20 canvas / hit-test / draw / resize / move call sites are untouched. What is new is `pages`,
// `pageIdx`, and a `page` on each box.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    true;`, 'seed');
  return C;
}
// Two pages of different sizes, so "which page was this cropped from" is answerable.
const seedPages = C => C.run(`
  APP_COMIC.pages = [
    { dataUrl:'data:image/jpeg;base64,PAGE0', naturalW:800, naturalH:500, img:null },
    { dataUrl:'data:image/jpeg;base64,PAGE1', naturalW:400, naturalH:300, img:null }];
  APP_COMIC.pageIdx = 0;
  APP_COMIC.dataUrl = APP_COMIC.pages[0].dataUrl;
  APP_COMIC.naturalW = 800; APP_COMIC.naturalH = 500;
  APP_COMIC.boxes = [
    { x1:0, y1:0, x2:800, y2:500, page:0 },
    { x1:0, y1:0, x2:400, y2:300, page:1 }];
  true;`, 'pages');

// ── 1. ⚠️ A panel is cropped from ITS OWN page, not from whatever is on screen ──────────────────
// This is the correctness crux. Before item V the crop always used the displayed image, which is
// right for one page and silently wrong for several: every panel would have been extracted from
// whichever page the user happened to be looking at.
{
  const C = client(); seedPages(C);
  assert.strictEqual(C.run(`_comicCropDataUrl(APP_COMIC.boxes[0])`), 'data:image/jpeg;base64,PAGE0',
    'the page-0 panel crops from page 0');
  assert.strictEqual(C.run(`_comicCropDataUrl(APP_COMIC.boxes[1])`), 'data:image/jpeg;base64,PAGE1',
    '⚠️ and the page-1 panel crops from PAGE 1 — while page 0 is the one displayed');
  // Switching the displayed page must not change either answer.
  C.run(`APP_COMIC.pageIdx = 1; APP_COMIC.dataUrl = APP_COMIC.pages[1].dataUrl;
    APP_COMIC.naturalW = 400; APP_COMIC.naturalH = 300; true;`, 'switch');
  assert.strictEqual(C.run(`_comicCropDataUrl(APP_COMIC.boxes[0])`), 'data:image/jpeg;base64,PAGE0',
    'still page 0 after switching the view — the crop follows the BOX, not the screen');
  // A box with no `page` at all (every pre-item-V draft) means page 0.
  assert.strictEqual(C.run(`_comicCropDataUrl({ x1:0, y1:0, x2:800, y2:500 })`), 'data:image/jpeg;base64,PAGE0',
    'a legacy box with no page field resolves to page 0');
}
console.log('  a panel crops from its own page, whichever page is displayed: OK');

// ── 2. Only the active page's boxes are drawable/hit-testable ───────────────────────────────────
// A box from another page has coordinates in THAT page's space; leaving it live here would let a
// user drag a rectangle that belongs to a different image.
{
  const C = client(); seedPages(C);
  assert.strictEqual(C.run(`_comicPageBoxes().length`), 1, 'page 0 shows one of the two boxes');
  C.run(`APP_COMIC.pageIdx = 1; true;`);
  assert.strictEqual(C.run(`_comicPageBoxes().length`), 1, 'page 1 shows the other');
  // ⚠️ The hit-test needs a DISCRIMINATING point, not just any point. The boxes here overlap in
  // coordinate space — page 1's box (0,0..400,300) sits entirely inside page 0's (0,0..800,500) —
  // and the scan runs LAST-first, so an unfiltered hit-test returns page 1's box for a click on
  // page 0. A point that both boxes contain is the only kind that can tell the two apart; a first
  // draft used points that gave the same answer either way and the mutation stayed GREEN.
  C.run(`APP_COMIC.pageIdx = 0; APP_COMIC.naturalW=800; APP_COMIC.naturalH=500;
    var c=document.getElementById('comic-draw-canvas'); c.width=800; c.height=500; true;`, 'canvas');
  assert.strictEqual(C.run(`_comicHitBox(200,150)`), 0,
    "⚠️ a point inside BOTH boxes, clicked on page 0, hits page 0's box — the scan is last-first, " +
    "so without the page filter page 1's box would win a click on a page it is not even on");
  C.run(`APP_COMIC.pageIdx = 1; APP_COMIC.naturalW=400; APP_COMIC.naturalH=300;
    var c2=document.getElementById('comic-draw-canvas'); c2.width=400; c2.height=300; true;`, 'switch2');
  assert.strictEqual(C.run(`_comicHitBox(200,150)`), 1,
    "and the same point on page 1 hits page 1's box");
}
console.log('  hit-tests and drawing see only the displayed page: OK');

// ── 3. ⚠️ "Use whole image" acts on the ACTIVE page only ────────────────────────────────────────
// It replaced the WHOLE box list, which for a multi-page upload would delete every other page's
// panels — most of the user's work — behind a button that says "use whole image", singular.
{
  const C = client(); seedPages(C);
  C.run(`APP_COMIC.boxes.push({ x1:10, y1:10, x2:50, y2:50, page:0 });
    APP_COMIC.pageIdx = 0; APP_COMIC.naturalW=800; APP_COMIC.naturalH=500;
    comicUseWholeImageAsPanel(); true;`, 'whole');
  const boxes = JSON.parse(C.run(`JSON.stringify(APP_COMIC.boxes)`));
  assert.strictEqual(boxes.filter(b => (b.page|0) === 1).length, 1,
    '⚠️ page 1 keeps its panel — the button must not wipe other pages');
  const p0 = boxes.filter(b => (b.page|0) === 0);
  assert.strictEqual(p0.length, 1, 'page 0 is replaced by exactly one whole-image panel');
  assert.deepStrictEqual(p0[0], { x1:0, y1:0, x2:800, y2:500, page:0 }, 'covering that page');
}
console.log('  "use whole image" replaces only the active page\'s panels: OK');

// ── 4. The draft carries the pages AND the per-box page ─────────────────────────────────────────
// ⚠️ The server's draft whitelist is where `description` was silently dropped once already (item AN,
// the THIRD instance of that trap). A stripped `page` is worse than it looks: every box would
// collapse onto page 0 and be cropped from the wrong image on resume.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = src.indexOf('boxes: APP_COMIC.boxes.map(b=>({x1:b.x1');
  assert.ok(at > -1, 'the draft save builds its box list');
  const save = src.slice(at, at + 900);
  assert.ok(/page: _comicBoxPage\(b\)/.test(save), 'each saved box carries its page');
  assert.ok(/pages: \(APP_COMIC\.pages\|\|\[\]\)\.slice\(1\)/.test(save),
    '⚠️ and the EXTRA pages ride too — page 0 is `dataUrl`, so it is deliberately not repeated ' +
    '(a 1600px page is ~1MB of base64 and would otherwise be sent twice)');
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(/page: Math\.max\(0, parseInt\(b && b\.page, 10\) \|\| 0\)/.test(server),
    '⚠️ and the SERVER whitelist keeps it — the trap this projection has already fallen into');
  assert.ok(/const pagesIn = Array\.isArray\(body\.comic\.pages\)/.test(server), 'the server accepts pages');
  assert.ok(/slice\(0, 30\)/.test(server), 'capped, like every other upload bound in this file');
  assert.ok(/du\.length > 8_000_000\) continue;/.test(server),
    'an oversized page is SKIPPED rather than failing the whole draft');
}
console.log('  the draft round-trips pages and per-box page, and the server whitelist keeps them: OK');

// ── 5. N images become N whole-image panels ─────────────────────────────────────────────────────
// The feature in one assertion. `_comicAddFiles` is driven with a stubbed loader so no real decode
// is needed — what is under test is the panel formation, not the JPEG pipeline.
{
  const C = client();
  C.run(`var n = 0;
    _comicLoadPage = function(f){ n++; return Promise.resolve(
      { dataUrl:'data:PAGE'+n, naturalW:100*n, naturalH:50*n, img:null }); };
    _comicSetupCanvas = function(){}; _comicWatchImageResize = function(){};
    _comicDraftSaveDebounced = function(){};
    true;`, 'stub');
  C.run(`_comicAddFiles([{name:'a.jpg'},{name:'b.jpg'},{name:'c.jpg'}], null); true;`, 'add');
  return new Promise(r => setTimeout(r, 120)).then(() => {
    const pages = JSON.parse(C.run(`JSON.stringify((APP_COMIC.pages||[]).map(p=>({w:p.naturalW,h:p.naturalH})))`));
    assert.strictEqual(pages.length, 3, 'three files become three pages');
    const boxes = JSON.parse(C.run(`JSON.stringify(APP_COMIC.boxes)`));
    assert.strictEqual(boxes.length, 3, '⚠️ and three panels — one per image, the whole ruling');
    assert.deepStrictEqual(boxes.map(b => b.page), [0, 1, 2], 'each tagged with its own page');
    boxes.forEach((b, i) => assert.deepStrictEqual(
      { x1:b.x1, y1:b.y1, x2:b.x2, y2:b.y2 }, { x1:0, y1:0, x2:100*(i+1), y2:50*(i+1) },
      `panel ${i} covers the WHOLE of its own page, at that page's own size`));
    console.log('  N images become N whole-image panels, one per page: OK');
    console.log('unit-comic-multi-image: ALL PASSED');
  });
}
