// unit-comic-panel-ui.test.js
// PLAN §2.4 / Track A4 milestone 1 (v85_j) — comic upload + panel-drawing UI. Client-side only, NO
// model call anywhere in this milestone; text extraction is milestone 2's job. Contract under test:
//   • §1 markup: #comic-panel is a sibling of #dialect-panel inside #gen-card-2, with the file input,
//     draw-wrap (img + canvas), panel list, and actions row all inside it.
//   • §2 onUseComicCb(): toggles #comic-panel's .open class, hides the normal generation form the
//     same way onUseDialectCb() does, and is MUTUALLY EXCLUSIVE with both use-story-cb and
//     use-dialect-cb in BOTH directions (turning comic on turns the others off, and vice versa) —
//     the two hooks added to onUseStoryCb()/onUseDialectCb() for this. Turning comic off clears any
//     drawn panels.
//   • §3 the pointer-drawing geometry (_comicPointerStart/Move/End): produces a box in NATURAL image
//     pixel coordinates (not canvas/CSS pixels), correctly handles a drag in any direction (start
//     bottom-right, end top-left — min/max normalizes it), and REJECTS a degenerate near-zero drag
//     (a stray click/tap must not create a zero-area "panel").
//   • §4 comicDeletePanel/comicMovePanel/comicClearPanels: mutate the box list correctly, reorder
//     bounds-checked (no-op past either end).
//   • §5 _comicPanels(): returns a DEFENSIVE COPY — mutating the returned array/objects must not
//     alter APP_COMIC's own internal state.
//   • §6 _comicRedraw() is harness-safe when canvas.getContext is absent (this test's own DOM stub
//     has no 2D canvas support) — mutation-tested: removing the guard throws IMMEDIATELY, in fact as
//     early as §2 (onUseComicCb -> comicClearPanels -> _comicRedraw), not just in this assertion —
//     every test in this file exercises the guard, §6 just isolates the claim explicitly.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='de'; APP.srcLang='en';
    APP.difficulty=2; true;`, 'seed');
  return C;
}

async function main() {

// ── 1. Markup: #comic-panel lives inside #gen-card-2, alongside #dialect-panel ───
{
  const card2Open = html.indexOf('id="gen-card-2"');
  assert.ok(card2Open >= 0, '#gen-card-2 exists');
  const card2Close = html.indexOf('end gen-card-2', card2Open);
  const panelAt = html.indexOf('id="comic-panel"', card2Open);
  assert.ok(panelAt > card2Open && panelAt < card2Close, '#comic-panel is inside #gen-card-2');
  const within = (needle) => { const at = html.indexOf(needle, panelAt); return at > panelAt && at < card2Close; };
  assert.ok(within('id="comic-file-input"'), '#comic-file-input is inside #comic-panel');
  assert.ok(within('id="comic-draw-wrap"'), '#comic-draw-wrap is inside #comic-panel');
  assert.ok(within('id="comic-draw-img"'), '#comic-draw-img is inside #comic-draw-wrap');
  assert.ok(within('id="comic-draw-canvas"'), '#comic-draw-canvas is inside #comic-draw-wrap');
  assert.ok(within('id="comic-panel-list"'), '#comic-panel-list is inside #comic-panel');
  assert.ok(within('id="comic-panel-actions"'), '#comic-panel-actions is inside #comic-panel');
  assert.ok(within('id="use-comic-cb"') === false || html.indexOf('id="use-comic-cb"') < panelAt,
    '#use-comic-cb (the toggle checkbox) lives in #user-story-checks, BEFORE #comic-panel, not inside it');
}
console.log('  markup: #comic-panel (file input, draw-wrap, list, actions) lives inside #gen-card-2: OK');

// ── 2. onUseComicCb(): toggle + form-hiding + mutual exclusion (both directions) ─
{
  const C = client();
  const r = JSON.parse(C.run(`document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    var openOn = document.getElementById('comic-panel').classList.contains('open');
    var gfHiddenOn = document.getElementById('gen-form-section').style.display;
    document.getElementById('use-comic-cb').checked = false; onUseComicCb();
    var openOff = document.getElementById('comic-panel').classList.contains('open');
    var gfShownOff = document.getElementById('gen-form-section').style.display;
    JSON.stringify({ openOn: openOn, gfHiddenOn: gfHiddenOn, openOff: openOff, gfShownOff: gfShownOff })`));
  assert.strictEqual(r.openOn, true, 'checking use-comic-cb opens #comic-panel');
  assert.strictEqual(r.gfHiddenOn, 'none', 'comic mode hides #gen-form-section, same as dialect mode');
  assert.strictEqual(r.openOff, false, 'unchecking use-comic-cb closes #comic-panel');
  assert.strictEqual(r.gfShownOff, '', 'unchecking comic mode reveals #gen-form-section again');
}
console.log('  onUseComicCb(): toggles .open + hides/shows #gen-form-section like dialect mode: OK');

{
  const C = client();
  const r = JSON.parse(C.run(`document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    document.getElementById('use-story-cb').checked = true; onUseStoryCb();
    var comicAfterStory = document.getElementById('use-comic-cb').checked;
    document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    document.getElementById('use-dialect-cb').checked = true; onUseDialectCb();
    var comicAfterDialect = document.getElementById('use-comic-cb').checked;
    document.getElementById('use-story-cb').checked = true; onUseStoryCb();
    document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    var storyAfterComic = document.getElementById('use-story-cb').checked;
    document.getElementById('use-comic-cb').checked = false; onUseComicCb();
    document.getElementById('use-dialect-cb').checked = true; onUseDialectCb();
    document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    var dialectAfterComic = document.getElementById('use-dialect-cb').checked;
    JSON.stringify({ comicAfterStory: comicAfterStory, comicAfterDialect: comicAfterDialect,
      storyAfterComic: storyAfterComic, dialectAfterComic: dialectAfterComic })`));
  assert.strictEqual(r.comicAfterStory, false, 'checking use-story-cb turns OFF an already-on comic mode');
  assert.strictEqual(r.comicAfterDialect, false, 'checking use-dialect-cb turns OFF an already-on comic mode');
  assert.strictEqual(r.storyAfterComic, false, 'checking use-comic-cb turns OFF an already-on story mode');
  assert.strictEqual(r.dialectAfterComic, false, 'checking use-comic-cb turns OFF an already-on dialect mode');
}
console.log('  onUseComicCb()/onUseStoryCb()/onUseDialectCb(): mutually exclusive in BOTH directions: OK');

{
  const C = client();
  const r = JSON.parse(C.run(`document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    APP_COMIC.boxes = [{x1:0,y1:0,x2:10,y2:10}];
    document.getElementById('use-comic-cb').checked = false; onUseComicCb();
    JSON.stringify({ boxesAfterClose: APP_COMIC.boxes.length, dataUrlAfterClose: APP_COMIC.dataUrl })`));
  assert.strictEqual(r.boxesAfterClose, 0, 'unchecking use-comic-cb clears any drawn panels');
  assert.strictEqual(r.dataUrlAfterClose, null, 'unchecking use-comic-cb drops the uploaded image reference');
}
console.log('  onUseComicCb(): turning off clears drawn panels and the uploaded image: OK');

// ── 3. Pointer-drawing geometry: natural-pixel coords, any drag direction, reject near-zero ──
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;   // 2x the CSS size below
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 250;
    _comicPointerStart({ preventDefault:function(){}, clientX:100, clientY:50 });
    _comicPointerMove({ preventDefault:function(){}, clientX:200, clientY:150 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:200, clientY:150 });
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 1, 'a real drag (start top-left, end bottom-right) commits exactly one box');
  // canvas is half natural size (scale factor 2 on both axes): CSS (100,50)->(200,150) => natural (200,100)->(400,300)
  assert.deepStrictEqual(r.boxes[0], { x1: 200, y1: 100, x2: 400, y2: 300 },
    'box coordinates are scaled from CSS/canvas pixels to NATURAL image pixels');
}
console.log('  pointer drawing: a real drag commits one box, correctly scaled to natural image pixels: OK');

{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    // Drag STARTING bottom-right, ENDING top-left — min/max must still normalize x1<x2, y1<y2.
    _comicPointerStart({ preventDefault:function(){}, clientX:300, clientY:300 });
    _comicPointerMove({ preventDefault:function(){}, clientX:100, clientY:100 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:100, clientY:100 });
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.deepStrictEqual(r.boxes[0], { x1: 100, y1: 100, x2: 300, y2: 300 },
    'a reversed drag (bottom-right to top-left) still normalizes to x1<x2, y1<y2');
}
console.log('  pointer drawing: a reversed-direction drag still normalizes into a valid box: OK');

{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    _comicPointerStart({ preventDefault:function(){}, clientX:100, clientY:100 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:102, clientY:101 });   // a stray tap, not a real drag
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 0, 'a near-zero drag (a stray click/tap) is REJECTED, not stored as a degenerate panel');
}
console.log('  pointer drawing: a near-zero-area drag is rejected, not stored as a panel: OK');

// ── 4. comicDeletePanel/comicMovePanel/comicClearPanels ──────────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.boxes = [{x1:0,y1:0,x2:1,y2:1},{x1:1,y1:1,x2:2,y2:2},{x1:2,y1:2,x2:3,y2:3}];
    comicDeletePanel(1);
    var afterDelete = APP_COMIC.boxes.map(function(b){return b.x1;});
    APP_COMIC.boxes = [{x1:0,y1:0,x2:1,y2:1},{x1:1,y1:1,x2:2,y2:2}];
    comicMovePanel(0, 1);
    var afterSwap = APP_COMIC.boxes.map(function(b){return b.x1;});
    comicMovePanel(0, -1);   // already first — must be a no-op, not throw / go out of bounds
    var afterNoopUp = APP_COMIC.boxes.map(function(b){return b.x1;});
    comicMovePanel(1, 1);    // already last — must also be a no-op
    var afterNoopDown = APP_COMIC.boxes.map(function(b){return b.x1;});
    comicClearPanels();
    JSON.stringify({ afterDelete: afterDelete, afterSwap: afterSwap, afterNoopUp: afterNoopUp,
      afterNoopDown: afterNoopDown, afterClear: APP_COMIC.boxes.length })`));
  assert.deepStrictEqual(r.afterDelete, [0, 2], 'comicDeletePanel(1) removes exactly the middle panel');
  assert.deepStrictEqual(r.afterSwap, [1, 0], 'comicMovePanel(0,1) swaps panel 0 and 1');
  assert.deepStrictEqual(r.afterNoopUp, [1, 0], 'comicMovePanel(0,-1) on the first panel is a no-op');
  assert.deepStrictEqual(r.afterNoopDown, [1, 0], 'comicMovePanel(1,1) on the last panel is a no-op');
  assert.strictEqual(r.afterClear, 0, 'comicClearPanels() empties the list');
}
console.log('  comicDeletePanel/comicMovePanel/comicClearPanels: mutate correctly, reorder is bounds-checked: OK');

// ── 5. _comicPanels() returns a defensive copy ────────────────────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.boxes = [{x1:1,y1:2,x2:3,y2:4}];
    var out = _comicPanels();
    out[0].x1 = 999;   // mutate the RETURNED copy
    out.push({x1:0,y1:0,x2:0,y2:0});   // and grow the RETURNED array
    JSON.stringify({ internalX1: APP_COMIC.boxes[0].x1, internalLen: APP_COMIC.boxes.length })`));
  assert.strictEqual(r.internalX1, 1, "mutating _comicPanels()'s returned box object does not alter APP_COMIC's own state");
  assert.strictEqual(r.internalLen, 1, "growing _comicPanels()'s returned array does not alter APP_COMIC's own state");
}
console.log('  _comicPanels(): returns a defensive copy, not a live reference into APP_COMIC: OK');

// ── 6. _comicRedraw() is harness-safe with no 2D canvas support — mutation-tested ─
{
  const C = client();
  // This test's own DOM stub has no canvas.getContext at all — if the guard were removed,
  // ctx.clearRect(...) would throw on `undefined`. Calling it directly here proves the guard fires.
  const threw = C.run(`try { _comicRedraw(); JSON.stringify(false); }
    catch(e){ JSON.stringify(true); }`);
  assert.strictEqual(JSON.parse(threw), false, '_comicRedraw() does not throw when canvas has no 2D context (guard present) — confirmed to actually go red without the guard: removing it throws at test §2 already (onUseComicCb -> comicClearPanels), a TypeError on canvas.getContext, not merely here');
}
console.log('  _comicRedraw(): harness-safe (no-2D-context guard) — mutation-tested by this very assertion: OK');

// ── 7. Panel RESIZE via corner handles (v85_t, user-requested) ───────────────────
// The milestone-1 UI never let a learner adjust an EXISTING box — only draw new ones, delete, or
// reorder. This adds drag handles at each box's 4 corners; these cases exercise the hit-testing,
// the actual resize, the minimum-size floor, and that ordinary drawing (away from any handle) is
// unaffected.
{
  const C = client();
  // 2x scale, same shape as §3's own drawing test, so the SAME sx/sy conversion is exercised for
  // resize as for a fresh draw — a handle at natural (200,100) sits at canvas (100,50).
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 250;
    APP_COMIC.boxes = [{x1:200,y1:100,x2:400,y2:300}];   // canvas-space: (100,50)-(200,150)
    // Grab the SE handle (canvas (200,150)) and drag it out to canvas (250,200) -> natural (500,400).
    _comicPointerStart({ preventDefault:function(){}, clientX:200, clientY:150 });
    var drawingAfterGrab = APP_COMIC.drawing;
    _comicPointerMove({ preventDefault:function(){}, clientX:250, clientY:200 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:250, clientY:200 });
    JSON.stringify({ boxes: APP_COMIC.boxes, drawingAfterGrab: drawingAfterGrab, resizingAfterEnd: APP_COMIC.resizing })`));
  assert.strictEqual(r.drawingAfterGrab, null, 'grabbing a handle does NOT also start a new box draw');
  assert.strictEqual(r.boxes.length, 1, 'resizing does not create a spurious second box');
  assert.deepStrictEqual(r.boxes[0], { x1: 200, y1: 100, x2: 500, y2: 400 },
    'dragging the SE handle moves ONLY x2/y2, scaled to natural pixels the same way a fresh draw is');
  assert.strictEqual(r.resizingAfterEnd, null, 'pointerEnd clears the resize state');
}
console.log('  resize: grabbing a corner handle resizes the box, not a new draw, correctly scaled: OK');

{
  // A drag that starts nowhere NEAR any handle still draws a new box — resize must not swallow
  // ordinary drawing clicks.
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    APP_COMIC.boxes = [{x1:0,y1:0,x2:50,y2:50}];   // handles cluster near the top-left corner
    _comicPointerStart({ preventDefault:function(){}, clientX:300, clientY:300 });   // far away
    _comicPointerMove({ preventDefault:function(){}, clientX:400, clientY:400 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:400, clientY:400 });
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 2, 'a drag far from any handle still draws a brand-new second box');
  assert.deepStrictEqual(r.boxes[0], { x1: 0, y1: 0, x2: 50, y2: 50 }, 'the existing box is untouched');
  assert.deepStrictEqual(r.boxes[1], { x1: 300, y1: 300, x2: 400, y2: 400 }, 'the new box is the fresh drag');
}
console.log('  resize: a drag away from any handle still draws a new box, existing ones untouched: OK');

{
  // Dragging a handle PAST the opposite corner must not invert the box (x1>x2) or shrink it below
  // the same "8 canvas px" floor a freshly-drawn degenerate box is rejected for — clamped live,
  // during the drag, not corrected after the fact.
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    APP_COMIC.boxes = [{x1:100,y1:100,x2:300,y2:300}];
    _comicPointerStart({ preventDefault:function(){}, clientX:300, clientY:300 });   // SE handle
    _comicPointerMove({ preventDefault:function(){}, clientX:0, clientY:0 });   // dragged past NW corner
    JSON.stringify({ box: APP_COMIC.boxes[0] })`));
  assert.ok(r.box.x2 > r.box.x1, 'x1 stays less than x2 even when the SE handle is dragged past NW');
  assert.ok(r.box.y2 > r.box.y1, 'y1 stays less than y2 even when the SE handle is dragged past NW');
  assert.strictEqual(r.box.x2 - r.box.x1, 8, 'width is clamped to exactly the 8px floor, not inverted or zero');
  assert.strictEqual(r.box.y2 - r.box.y1, 8, 'height is clamped to exactly the 8px floor, not inverted or zero');
}
console.log('  resize: a handle dragged past the opposite corner clamps to the minimum size, never inverts: OK');

console.log('unit-comic-panel-ui: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
