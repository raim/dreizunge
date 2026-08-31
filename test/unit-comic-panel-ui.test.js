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

// ── 2. onUseComicCb(): toggle + mutual exclusion (both directions) ──────────────
// ⚠️ CHANGED DELIBERATELY at item AL part 2 (roadmap_v87.md). This section used to assert that comic
// mode HIDES #gen-form-section "same as dialect mode". That was correct while the comic flow carried
// its own embedded lesson-type controls and its own start button, which made the wizard's lesson card
// genuinely irrelevant to it — and that duplication is exactly what item AL removed. The lesson card
// is now this mode's ONLY place to choose lesson types and #gen-btn its only start button, so hiding
// it would leave the flow unable to finish. The assertion is INVERTED, not deleted, so that a
// regression back to hiding it is still caught. Dialect mode still hides it — see
// unit-dialect-panel.test.js, whose own version of this check is untouched.
{
  const C = client();
  const r = JSON.parse(C.run(`document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    var openOn = document.getElementById('comic-panel').classList.contains('open');
    var gfOn = document.getElementById('gen-form-section').style.display;
    var topicOn = document.getElementById('topic-input').style.display;
    document.getElementById('use-comic-cb').checked = false; onUseComicCb();
    var openOff = document.getElementById('comic-panel').classList.contains('open');
    var gfOff = document.getElementById('gen-form-section').style.display;
    JSON.stringify({ openOn: openOn, gfOn: gfOn, topicOn: topicOn, openOff: openOff, gfOff: gfOff })`));
  assert.strictEqual(r.openOn, true, 'checking use-comic-cb opens #comic-panel');
  assert.notStrictEqual(r.gfOn, 'none',
    'comic mode must NOT hide #gen-form-section — the lesson card is now its only lesson-type UI and its only start button');
  assert.strictEqual(r.topicOn, 'none', 'it still hides #topic-input: a comic run has no topic to type');
  assert.strictEqual(r.openOff, false, 'unchecking use-comic-cb closes #comic-panel');
  assert.notStrictEqual(r.gfOff, 'none', '#gen-form-section stays available after unchecking too');
}
console.log('  onUseComicCb(): opens the panel, hides the topic field, and LEAVES the lesson card reachable: OK');

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

// ── 8. Canvas stays in sync with the image's rendered size (v85_u, user-reported) ─────────────
// "when I zoom in/out on the page, the selected panel squares move relative to the image" —
// #comic-draw-img is responsive (max-width:100%), but the canvas overlay was only ever sized ONCE,
// at image-load. This harness has no real ResizeObserver semantics (no real layout at all), so a
// fake one is installed that lets the test invoke the observer's callback itself — the same shape
// unit-speak-advance.test.js uses for speechSynthesis. The claim under test is the WIRING (does a
// size-change notification actually re-run _comicSetupCanvas), not real browser resize behaviour.
{
  const C = client();
  const r = JSON.parse(C.run(`
    globalThis.__roCallbacks = [];
    globalThis.ResizeObserver = function(cb){
      __roCallbacks.push(cb);
      this.observe = function(){};
      this.disconnect = function(){};
    };
    var img = document.getElementById('comic-draw-img');
    var canvas = document.getElementById('comic-draw-canvas');
    APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 1000;
    img.clientWidth = 500; img.clientHeight = 500;
    _comicSetupCanvas();   // the real app calls this once at image-load, before ever watching resize
    _comicWatchImageResize();
    var sizeBeforeResize = { w: canvas.width, h: canvas.height };
    // The page reflows (window resize, zoom, orientation change — any of them) and the image's own
    // rendered size changes; the browser would fire the ResizeObserver callback for that.
    img.clientWidth = 300; img.clientHeight = 300;
    __roCallbacks[__roCallbacks.length - 1]();
    JSON.stringify({ sizeBeforeResize: sizeBeforeResize, sizeAfterResize: { w: canvas.width, h: canvas.height },
      observerCount: __roCallbacks.length })`));
  assert.deepStrictEqual(r.sizeBeforeResize, { w: 500, h: 500 }, 'canvas took the image size at watch-start time');
  assert.strictEqual(r.observerCount, 1, 'exactly one observer was installed for one _comicWatchImageResize() call');
  assert.deepStrictEqual(r.sizeAfterResize, { w: 300, h: 300 },
    'the canvas is RESIZED to match the image\'s new rendered size when the observer fires — this is ' +
    'the fix: before it, the canvas stayed frozen at its old size while the (responsive) image resized');
}
console.log('  resize-sync: a ResizeObserver notification re-syncs the canvas to the image\'s new size: OK');

{
  // Re-watching (a second image upload) must not stack observers — only the LATEST one should be live.
  const C = client();
  const r = JSON.parse(C.run(`
    globalThis.__roCallbacks = [];
    globalThis.__disconnected = 0;
    globalThis.ResizeObserver = function(cb){
      __roCallbacks.push(cb);
      this.observe = function(){};
      this.disconnect = function(){ __disconnected++; };
    };
    var img = document.getElementById('comic-draw-img');
    APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    img.clientWidth = 200; img.clientHeight = 200;
    _comicWatchImageResize();
    _comicWatchImageResize();   // a second image chosen without the first ever being unwatched
    JSON.stringify({ observerCount: __roCallbacks.length, disconnected: __disconnected })`));
  assert.strictEqual(r.observerCount, 2, 'two ResizeObserver instances were created (one per watch call)');
  assert.strictEqual(r.disconnected, 1, 'the FIRST one was disconnected before the second was installed — no stacking');
}
console.log('  resize-sync: watching a second time disconnects the first observer, does not stack: OK');

{
  // Closing comic mode must release the observer, not leak it across an open/close cycle.
  const C = client();
  const r = JSON.parse(C.run(`
    globalThis.__disconnected = 0;
    globalThis.ResizeObserver = function(cb){
      this.observe = function(){};
      this.disconnect = function(){ __disconnected++; };
    };
    var img = document.getElementById('comic-draw-img');
    APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    img.clientWidth = 200; img.clientHeight = 200;
    document.getElementById('use-comic-cb').checked = true; onUseComicCb();
    _comicWatchImageResize();
    document.getElementById('use-comic-cb').checked = false; onUseComicCb();   // closes comic mode
    JSON.stringify({ disconnected: __disconnected })`));
  assert.strictEqual(r.disconnected, 1, 'turning comic mode off disconnects the resize observer — no leak across open/close');
}
console.log('  resize-sync: closing comic mode disconnects the observer, does not leak: OK');

// The three cases above prove _comicWatchImageResize()/_comicUnwatchImageResize() themselves work —
// what they can't prove is that onComicFileChosen's real image-load path actually CALLS the watch
// function. That integration can't be driven behaviourally here: onComicFileChosen uses a real
// FileReader, which this harness's sandbox does not stub (unlike speechSynthesis or ResizeObserver,
// adding one is a shared-infrastructure change out of scope for one feature's test). A source check
// for the call site, immediately after the existing _comicSetupCanvas() call, is the honest fallback
// — paired with the behavioural proof above that the function itself does the right thing.
// v86_c: the sequence now lives in _comicFinishSetup() (extracted so the downscale-then-reload path
// can call it a second time without duplicating the whole setup) — checked there directly, plus that
// onComicFileChosen's own onload path actually reaches it.
{
  const fn = html.slice(html.indexOf('function _comicFinishSetup'), html.indexOf('function onComicFileChosen'));
  assert.ok(/_comicSetupCanvas\(\);\s*\n\s*_comicWatchImageResize\(\);/.test(fn),
    '_comicFinishSetup() calls _comicWatchImageResize() right after _comicSetupCanvas()');
  const fnStart = html.indexOf('function onComicFileChosen');
  const onComicFileChosenSrc = html.slice(fnStart, html.indexOf('\n// Canvas is sized to the DISPLAYED', fnStart));
  assert.ok(/_comicFinishSetup\(img,\s*status\)/.test(onComicFileChosenSrc),
    'onComicFileChosen\'s real image-load path reaches _comicFinishSetup()');
}
console.log('  resize-sync: the real image-load path wires up the resize watch (source check, paired with the behavioural proof above): OK');

// ── 9. _comicSetupCanvas() does NOT re-register pointer/touch listeners on repeat calls
//      (v86_c, user-reported REGRESSION, confirmed and fixed) ─────────────────────────────────────
// "panel recognition is really bad, this worked better before the fix, and occurred twice" — a box
// spanning two whole panels. Root cause: _comicSetupCanvas() called addEventListener for all 8
// pointer/touch events on EVERY call, with no matching removeEventListener — harmless when it only
// ever ran ONCE per image (before v85_u), but v85_u's OWN resize-sync fix made it ALSO run from a
// ResizeObserver, which fires more than once by design. From v85_u onward, a single real drag could
// invoke _comicPointerStart/Move/End multiple times each — this harness stubs addEventListener as a
// no-op (real event dispatch isn't modelled), so the only way to observe registration COUNT here is
// to replace it with a counting spy, the same shape the ResizeObserver tests above already use.
{
  const C = client();
  const r = JSON.parse(C.run(`
    globalThis.__addCalls = {};
    var canvas = document.getElementById('comic-draw-canvas');
    var img = document.getElementById('comic-draw-img');
    img.clientWidth = 400; img.clientHeight = 300;
    canvas.addEventListener = function(type){ __addCalls[type] = (__addCalls[type]||0) + 1; };
    _comicSetupCanvas();
    _comicSetupCanvas();   // simulates a second ResizeObserver firing on the SAME canvas element
    _comicSetupCanvas();   // and a third — the exact shape that used to stack duplicate listeners
    JSON.stringify(__addCalls)`));
  const total = Object.values(r).reduce((a, b) => a + b, 0);
  assert.strictEqual(total, 8,
    `exactly 8 listeners registered (one per pointer/touch event) across THREE _comicSetupCanvas() ` +
    `calls, not 24 — got ${JSON.stringify(r)}. Re-registering on every call is what let a single real ` +
    'gesture fire the SAME handler multiple times, corrupting an in-progress drag.');
  assert.strictEqual(r.mousedown, 1, 'mousedown registered exactly once, not once per _comicSetupCanvas() call');
  assert.strictEqual(r.touchmove, 1, 'touchmove registered exactly once, not once per _comicSetupCanvas() call');
}
console.log('  _comicSetupCanvas(): listeners register exactly once across repeated calls, no stacking: OK');

// ── 10. Camera capture (v86_c, user-requested) ────────────────────────────────────────────────────
{
  const panelAt = html.indexOf('id="comic-panel"');
  const panelEnd = html.indexOf('id="comic-draw-wrap"', panelAt);   // scope to the upload row itself
  const within = (needle) => { const at = html.indexOf(needle, panelAt); return at > panelAt && at < panelEnd; };
  assert.ok(within('id="comic-camera-input"'), '#comic-camera-input exists inside #comic-panel');
  assert.ok(/id="comic-camera-input"[^>]*capture="environment"/.test(html),
    '#comic-camera-input carries capture="environment" — opens the device camera directly on mobile, ' +
    'ignored (harmlessly) on desktop, so no device-sniffing is needed');
  assert.ok(/id="comic-camera-input"[^>]*accept="image\/\*"/.test(html), '#comic-camera-input accepts any image type');
  assert.ok(/id="comic-camera-input"[^>]*onchange="onComicFileChosen\(this\)"/.test(html),
    '#comic-camera-input routes through the SAME handler as a regular upload — same downscale, same setup');
  assert.ok(/id="comic-camera-btn"[^>]*onclick="document\.getElementById\('comic-camera-input'\)\.click\(\)"/.test(html),
    '#comic-camera-btn triggers the camera input');
}
console.log('  camera capture: #comic-camera-input (capture="environment") routes through the same upload handler: OK');

// ── 11. _comicDownscaleDims(): pure sizing math, no Image/canvas dependency ──────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`JSON.stringify({
    tooLarge:    _comicDownscaleDims(4000, 3000, 1600),
    exactlyMax:  _comicDownscaleDims(1600, 900, 1600),
    smaller:     _comicDownscaleDims(800, 600, 1600),
    portrait:    _comicDownscaleDims(1200, 4000, 1600),
    zeroWidth:   _comicDownscaleDims(0, 3000, 1600),
  })`));
  assert.deepStrictEqual(r.tooLarge, { cw: 1600, ch: 1200 },
    'a 4000x3000 image (long edge 4000) scales to 1600 on the long edge, short edge scaled proportionally');
  assert.strictEqual(r.exactlyMax, null, 'an image exactly AT the max dimension needs no resize (not >, so no wasted re-encode)');
  assert.strictEqual(r.smaller, null, 'an image already smaller than the max needs no resize');
  assert.deepStrictEqual(r.portrait, { cw: 480, ch: 1600 },
    'a PORTRAIT image scales correctly too — the long edge (height here) is what gets capped');
  assert.strictEqual(r.zeroWidth, null, 'a degenerate zero-dimension input is rejected, not divided-by-zero into NaN');
}
console.log('  _comicDownscaleDims(): correct scale math, both orientations, no-op when already small enough: OK');

// ── 12. comicUseWholeImageAsPanel() (v86_d, user-requested, item J) ───────────────────────────────
{
  const C = client();
  const r = JSON.parse(C.run(`
    APP_COMIC.naturalW = 800; APP_COMIC.naturalH = 500;
    comicUseWholeImageAsPanel();
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 1, 'exactly one box is created');
  assert.deepStrictEqual(r.boxes[0], { x1: 0, y1: 0, x2: 800, y2: 500 },
    'the box spans the ENTIRE image, in natural pixels');
}
console.log('  comicUseWholeImageAsPanel(): one box spanning the whole image: OK');

{
  // REPLACES existing boxes, matching auto-detect's own "a fresh detection replaces prior boxes"
  // precedent — not append, which would leave a redundant giant box alongside smaller ones.
  const C = client();
  const r = JSON.parse(C.run(`
    APP_COMIC.naturalW = 800; APP_COMIC.naturalH = 500;
    APP_COMIC.boxes = [{x1:10,y1:10,x2:100,y2:100},{x1:200,y1:10,x2:300,y2:100}];
    comicUseWholeImageAsPanel();
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 1, 'the two pre-existing boxes are REPLACED, not appended to');
  assert.deepStrictEqual(r.boxes[0], { x1: 0, y1: 0, x2: 800, y2: 500 });
}
console.log('  comicUseWholeImageAsPanel(): replaces any existing boxes, does not append: OK');

{
  // A no-op with no image loaded (naturalW/H both 0) — must not create a degenerate zero-area box.
  const C = client();
  const r = JSON.parse(C.run(`
    APP_COMIC.naturalW = 0; APP_COMIC.naturalH = 0;
    comicUseWholeImageAsPanel();
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 0, 'no image loaded (naturalW/H are 0) — no degenerate box is created');
}
console.log('  comicUseWholeImageAsPanel(): a no-op when no image is loaded yet: OK');

// ── 12b. Panel MOVE via dragging a box's body (v86_g, user-requested) ─────────────────────────────
// "i can resize the selected comic panels now, but it would be nice to also be able to move them."
// A pointer-down INSIDE a box's body (not on a handle) now translates the whole box, instead of
// drawing a new overlapping one — the drag-to-move companion to §7's own resize handles.
{
  const C = client();
  // Same 2x-scale shape as §7's own resize test, so the SAME sx/sy conversion is exercised.
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 1000; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 250;
    APP_COMIC.boxes = [{x1:200,y1:100,x2:400,y2:300}];   // canvas-space: (100,50)-(200,150)
    // Grab well INSIDE the box body (canvas (150,100), natural (300,200)) — nowhere near a handle —
    // and drag by canvas (+20,+10) -> natural (+40,+20).
    _comicPointerStart({ preventDefault:function(){}, clientX:150, clientY:100 });
    var drawingAfterGrab = APP_COMIC.drawing, resizingAfterGrab = APP_COMIC.resizing;
    _comicPointerMove({ preventDefault:function(){}, clientX:170, clientY:110 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:170, clientY:110 });
    JSON.stringify({ boxes: APP_COMIC.boxes, drawingAfterGrab: drawingAfterGrab,
      resizingAfterGrab: resizingAfterGrab, movingAfterEnd: APP_COMIC.moving })`));
  assert.strictEqual(r.drawingAfterGrab, null, 'grabbing a box body does NOT also start a new box draw');
  assert.strictEqual(r.resizingAfterGrab, null, 'grabbing a box body does NOT start a resize');
  assert.strictEqual(r.boxes.length, 1, 'moving does not create a spurious second box');
  assert.deepStrictEqual(r.boxes[0], { x1: 240, y1: 120, x2: 440, y2: 320 },
    'the box translates by the dragged delta, scaled to natural pixels — width (200) and height (200) UNCHANGED');
  assert.strictEqual(r.movingAfterEnd, null, 'pointerEnd clears the move state');
}
console.log('  move: dragging a box\'s body translates it, preserving size, not a new draw or a resize: OK');

{
  // A grab still on a HANDLE (even though handles sit at a box's own corners, technically "inside"
  // its body too) takes priority — resize, not move. Ordering matters: handle-hit-test runs first.
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    APP_COMIC.boxes = [{x1:100,y1:100,x2:300,y2:300}];
    _comicPointerStart({ preventDefault:function(){}, clientX:300, clientY:300 });   // SE handle
    JSON.stringify({ resizing: APP_COMIC.resizing, moving: APP_COMIC.moving })`));
  assert.ok(r.resizing, 'a grab on a handle still resizes, even though it is technically inside the box body too');
  assert.strictEqual(r.moving, null, 'the SAME grab does not ALSO start a move — handle wins');
}
console.log('  move: a handle grab still takes priority over move (handle hit-test runs first): OK');

{
  // A drag clamps at the image boundary as ONE offset — the box's size must stay EXACTLY the same
  // (not distorted by clamping each edge independently against the wall).
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    APP_COMIC.boxes = [{x1:50,y1:50,x2:150,y2:150}];   // 100x100 box, 50px from the top-left edge
    _comicPointerStart({ preventDefault:function(){}, clientX:100, clientY:100 });   // inside the body
    _comicPointerMove({ preventDefault:function(){}, clientX:-500, clientY:-500 });   // drag way off-image
    JSON.stringify({ box: APP_COMIC.boxes[0] })`));
  assert.deepStrictEqual(r.box, { x1: 0, y1: 0, x2: 100, y2: 100 },
    'clamped to the top-left corner, box size (100x100) EXACTLY preserved, not distorted');
}
console.log('  move: dragging past the image boundary clamps as one offset, box size exactly preserved: OK');

{
  // A grab OUTSIDE any box still draws a new one — move must not swallow ordinary drawing clicks.
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.naturalW = 500; APP_COMIC.naturalH = 500;
    var canvas = document.getElementById('comic-draw-canvas'); canvas.width = 500; canvas.height = 500;
    APP_COMIC.boxes = [{x1:0,y1:0,x2:50,y2:50}];
    _comicPointerStart({ preventDefault:function(){}, clientX:300, clientY:300 });   // far outside the box
    _comicPointerMove({ preventDefault:function(){}, clientX:400, clientY:400 });
    _comicPointerEnd({ preventDefault:function(){}, clientX:400, clientY:400 });
    JSON.stringify({ boxes: APP_COMIC.boxes })`));
  assert.strictEqual(r.boxes.length, 2, 'a drag outside any box still draws a brand-new second box');
  assert.deepStrictEqual(r.boxes[0], { x1: 0, y1: 0, x2: 50, y2: 50 }, 'the existing box is untouched');
}
console.log('  move: a grab outside any box still draws a new one, existing boxes untouched: OK');

{
  // _comicPointerCancel() also clears `moving` — same as drawing/resizing (mid-gesture interruption,
  // e.g. touchcancel, must not leave stale state a later gesture could misread).
  const C = client();
  const r = JSON.parse(C.run(`APP_COMIC.moving = { i:0, startX:0, startY:0, orig:{x1:0,y1:0,x2:10,y2:10} };
    _comicPointerCancel();
    JSON.stringify({ moving: APP_COMIC.moving, drawing: APP_COMIC.drawing, resizing: APP_COMIC.resizing })`));
  assert.strictEqual(r.moving, null, '_comicPointerCancel() clears moving state too');
}
console.log('  move: _comicPointerCancel() clears moving state, same as drawing/resizing: OK');

// ── 13. comicRotateImage() / _comicRotatedDims() (v86_f, user-requested, item I) ──────────────────
// A photo can come in sideways (portrait comic page shot in landscape, or vice versa). Fixed
// 90°-clockwise-per-click, same offscreen-canvas-redraw shape as onComicFileChosen's own downscale
// step — routes through the SAME img.onload -> _comicFinishSetup(img, status) path a fresh upload
// uses, so rotating clears any panel boxes already drawn (comicClearPanels(), inside
// _comicFinishSetup) — the SIMPLER of the two options scoped in roadmap_v86.md's item I.
{
  const r = JSON.parse(client().run(`JSON.stringify({
    landscape: _comicRotatedDims(800, 500),
    portrait: _comicRotatedDims(500, 800),
    square: _comicRotatedDims(600, 600),
  })`));
  assert.deepStrictEqual(r.landscape, { rw: 500, rh: 800 }, 'a 90° rotation SWAPS width/height');
  assert.deepStrictEqual(r.portrait, { rw: 800, rh: 500 }, 'swap works the other orientation too');
  assert.deepStrictEqual(r.square, { rw: 600, rh: 600 }, 'a square stays the same size (swap is a no-op numerically)');
}
console.log('  _comicRotatedDims(): a 90° rotation swaps width/height: OK');

{
  // A no-op with no image loaded — must not create a canvas or touch APP_COMIC at all.
  const C = client();
  C.run(`APP_COMIC.dataUrl = null; APP_COMIC.naturalW = 0; APP_COMIC.naturalH = 0;
    window._canvasCreated = false;
    const origCreate = document.createElement.bind(document);
    document.createElement = function(tag){ if(tag === 'canvas') window._canvasCreated = true; return origCreate(tag); };
    comicRotateImage();
    true;`, 't13-noop');
  const r = JSON.parse(C.run(`JSON.stringify({ canvasCreated: window._canvasCreated, dataUrl: APP_COMIC.dataUrl })`));
  assert.strictEqual(r.canvasCreated, false, 'no image loaded: comicRotateImage() never even creates a canvas');
  assert.strictEqual(r.dataUrl, null, 'APP_COMIC.dataUrl is untouched');
}
console.log('  comicRotateImage(): a no-op when no image is loaded yet — never creates a canvas: OK');

{
  // With an image loaded: this harness's own DOM stub has no 2D canvas context (checked directly,
  // same gap §6 above already documents for _comicRedraw) — comicRotateImage() must not throw, and
  // must leave APP_COMIC.dataUrl/naturalW/naturalH UNCHANGED (the safe fallback), exactly like
  // _comicDownscaleDims' own no-context fallback in onComicFileChosen. Mutation-tested: removing the
  // `if(!ctx) return;` guard throws immediately (ctx.translate on undefined), confirmed below.
  const C = client();
  const threw = C.run(`APP_COMIC.dataUrl = 'data:image/jpeg;base64,ORIGINAL';
    APP_COMIC.naturalW = 800; APP_COMIC.naturalH = 500;
    let threw = false;
    try{ comicRotateImage(); }catch(e){ threw = true; }
    JSON.stringify(threw)`);
  assert.strictEqual(JSON.parse(threw), false, 'comicRotateImage() does not throw with no 2D canvas context (guard present)');
  const r = JSON.parse(C.run(`JSON.stringify({ dataUrl: APP_COMIC.dataUrl, w: APP_COMIC.naturalW, h: APP_COMIC.naturalH })`));
  assert.strictEqual(r.dataUrl, 'data:image/jpeg;base64,ORIGINAL', 'no 2D context: the image is left UNTOUCHED, not corrupted');
  assert.strictEqual(r.w, 800, 'naturalW is untouched by the no-context fallback');
  assert.strictEqual(r.h, 500, 'naturalH is untouched by the no-context fallback');
}
console.log('  comicRotateImage(): harness-safe with no 2D canvas support — leaves the image untouched, does not throw: OK');

{
  // Source check: this harness can't drive the REAL (working-canvas) rotate path behaviourally (same
  // class of gap as onComicFileChosen's own downscale branch — see this file's own §comment near
  // "onComicFileChosen's real image-load path" above) — but the source shows it reaches
  // _comicFinishSetup() via the exact same img.onload shape a fresh upload uses, so panel-box
  // invalidation (comicClearPanels(), inside _comicFinishSetup) and natural-dimension pickup both
  // apply identically after a rotation.
  const fnStart = html.indexOf('function comicRotateImage');
  const fnSrc = html.slice(fnStart, html.indexOf('\n}', fnStart) + 2);
  assert.ok(/img\.onload\s*=\s*\(\)\s*=>\s*\{\s*_comicFinishSetup\(img,\s*status\);/.test(fnSrc),
    'comicRotateImage()\'s real (working-canvas) path reaches _comicFinishSetup() via img.onload, exactly like a fresh upload');
}
console.log('  comicRotateImage(): the real image-load path reaches _comicFinishSetup() (source check): OK');

// ── 14. Markup: #comic-rotate-btn exists, wired to comicRotateImage(), shown alongside detect/single-panel ──
{
  const panelAt = html.indexOf('id="comic-panel"');
  const rowAt = html.indexOf('id="comic-detect-row"', panelAt);
  const rowEnd = html.indexOf('id="comic-panel-list"', rowAt);
  const within = (needle) => { const at = html.indexOf(needle, rowAt); return at > rowAt && at < rowEnd; };
  assert.ok(within('id="comic-rotate-btn"'), '#comic-rotate-btn lives inside #comic-detect-row, alongside detect/single-panel');
  assert.ok(/id="comic-rotate-btn"[^>]*onclick="comicRotateImage\(\)"/.test(html), '#comic-rotate-btn calls comicRotateImage()');
}
console.log('  markup: #comic-rotate-btn exists in #comic-detect-row, wired to comicRotateImage(): OK');

console.log('unit-comic-panel-ui: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
