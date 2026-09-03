// unit-card-swipe-nav.test.js — v89_b.
//
// User request: "progress card allow to swipe right and left on mobile phone, same as if the back
// and forward arrows were pressed. So on the vocab-highlight view tapping starts questions, and
// swiping moves back and forth."
//
// The two gestures are complementary on ONE surface, so both halves have to be pinned here: a swipe
// must reach `comp-prev`/`comp-next` (browse), and it must NOT also fire the tap path (play) or a
// highlighted word's `tapWord` through the synthetic click a touch drag leaves behind.
//
// ⚠️ The DOM harness auto-vivifies a FLAT, detached element per id — there is no page tree, so
// `closest('#complete-screen')` cannot resolve on its own (probed: it returns null even from a span
// inside `#comp-story-text`). Every section below therefore BUILDS the nesting the real markup has
// — verified against index.html: `#complete-screen` > `.comp-body` > `#comp-story-panel` >
// `#comp-story-text`, and `#complete-screen` > `#comp-nav-modal` > `#comp-storyboard` — by
// appendChild on the very objects `getElementById` hands out, so the product code walks the same
// ancestry it walks in a browser rather than a parallel fixture.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

// One card, wired the way the real page nests it, with counting stubs on the two source buttons.
function open() {
  const C = loadClient({ quiet: true });
  C.run(`
    var screenEl = document.getElementById('complete-screen');
    var body     = document.getElementById('comp-body-fixture');
    var panel    = document.getElementById('comp-story-panel');
    var text     = document.getElementById('comp-story-text');
    var modal    = document.getElementById('comp-nav-modal');
    var sb       = document.getElementById('comp-storyboard');
    screenEl.appendChild(body); body.appendChild(panel); panel.appendChild(text);
    screenEl.appendChild(modal); modal.appendChild(sb);
    text.innerHTML = '<span id="plain-span">plain text</span>' +
                     '<mark class="story-vocab-hl wp-tap" id="hl-mark">Wort</mark>';
    sb.innerHTML = '<span id="sb-icon">A</span>';
    document.getElementById('sum-sumtext').innerHTML = '<span id="sum-plain-span">summary</span>';

    var nextCalls = 0, prevCalls = 0;
    var next = document.getElementById('comp-next'), prev = document.getElementById('comp-prev');
    next.onclick = function(){ nextCalls++; };
    prev.onclick = function(){ prevCalls++; };
    next.style.display = ''; prev.style.display = '';
    next.disabled = false;   prev.disabled = false;
    window.__calls = function(){ return { nextCalls: nextCalls, prevCalls: prevCalls }; };
    window.getSelection = function(){ return { isCollapsed: true, rangeCount: 0 }; };
    true;`, 'open');
  return C;
}
const calls = (C) => JSON.parse(C.run(`JSON.stringify(window.__calls())`));
// dx/dy are the finger's travel; the start element is named by id.
function swipe(C, startId, dx, dy) {
  return C.run(`_cardSwipeNav(
    { x: 200, y: 300, target: document.getElementById(${JSON.stringify(startId)}) },
    { x: 200 + (${dx}), y: 300 + (${dy}) })`, 'swipe');
}

// ── 1. A swipe LEFT presses →, a swipe RIGHT presses ← ─────────────────────────────────────────
{
  const C = open();
  assert.strictEqual(swipe(C, 'plain-span', -120, 4), true, 'a clear leftward swipe navigates');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 },
    'swiping LEFT presses comp-next exactly once (the card moves away to the left = forward)');
  assert.strictEqual(swipe(C, 'plain-span', 120, -4), true, 'a clear rightward swipe navigates');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 1 },
    'swiping RIGHT presses comp-prev exactly once — the two directions are genuinely distinguishable');
}
console.log('  swipe left = comp-next, swipe right = comp-prev, one press each: OK');

// ── 2. It works from a HIGHLIGHTED word too, and from the panel/card chrome around the text ─────
// The vocab-highlight view is exactly the surface the request names: a `.wp-tap` word owns the TAP
// there, but a swipe across one is still a swipe.
{
  const C = open();
  assert.strictEqual(swipe(C, 'hl-mark', -120, 0), true, 'a swipe starting ON a highlighted word still navigates');
  assert.strictEqual(swipe(C, 'comp-story-panel', -120, 0), true, 'and one starting on the panel around it');
  assert.deepStrictEqual(calls(C), { nextCalls: 2, prevCalls: 0 }, 'both reached comp-next');
}
console.log('  a swipe over a highlighted word, or over the card chrome, navigates like any other: OK');

// ── 3. A scroll is not a swipe, and neither is a jitter ────────────────────────────────────────
{
  const C = open();
  assert.strictEqual(swipe(C, 'plain-span', -40, 0), false, 'a 40px drag is under the 60px minimum');
  assert.strictEqual(swipe(C, 'plain-span', -80, -200), false, 'a mostly-VERTICAL drag is a scroll, not a swipe');
  assert.strictEqual(swipe(C, 'plain-span', 0, 0), false, 'a stationary touch (a tap) does nothing');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'none of the three navigated');
  // Non-vacuity: the same start element with a qualifying gesture DOES fire, so §3 is the geometry
  // talking and not some other state this fixture happens to be in.
  assert.strictEqual(swipe(C, 'plain-span', -80, -30), true, 'the same element with a horizontal-enough drag does navigate');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 }, 'and it pressed comp-next');
}
console.log('  short, stationary and mostly-vertical drags are all ignored; a horizontal one is not: OK');

// ── 4. Scope: only the progress card, and not its ☰ popup ──────────────────────────────────────
{
  const C = open();
  assert.strictEqual(swipe(C, 'sum-plain-span', -120, 0), false,
    'the ENTRY card is out of scope — this is not a page-wide gesture');
  assert.strictEqual(swipe(C, 'sb-icon', -120, 0), false,
    'inside #comp-nav-modal is out of scope — the popup\'s own horizontally-scrolling chapter strip keeps its drag');
  assert.strictEqual(swipe(C, 'comp-nav-modal', -120, 0), false, 'and the popup backdrop itself');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'none of the out-of-scope starts navigated');
}
console.log('  the gesture is scoped to the progress card and excludes its ☰ popup: OK');

// ── 5. A hidden or disabled arrow is not reachable by swiping ──────────────────────────────────
// A gesture has no greyed state of its own to show, so it must respect the state the card resolved.
{
  const C = open();
  C.run(`document.getElementById('comp-prev').style.display = 'none'; true;`);
  assert.strictEqual(swipe(C, 'plain-span', 120, 0), false, 'a HIDDEN comp-prev (no previous chapter) is not reachable');
  C.run(`document.getElementById('comp-next').disabled = true; true;`);
  assert.strictEqual(swipe(C, 'plain-span', -120, 0), false, 'a DISABLED comp-next is not reachable');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'neither fired');
  // Non-vacuity: restoring each state restores the swipe.
  C.run(`document.getElementById('comp-prev').style.display = '';
         document.getElementById('comp-next').disabled = false; true;`);
  assert.strictEqual(swipe(C, 'plain-span', 120, 0), true, 'shown again, comp-prev is reachable');
  assert.strictEqual(swipe(C, 'plain-span', -120, 0), true, 'enabled again, comp-next is reachable');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 1 }, 'and each fired exactly once');
}
console.log('  a hidden or disabled arrow cannot be pressed by swiping; restoring it restores the swipe: OK');

// ── 6. A drag-SELECT is a selection gesture, not a swipe ───────────────────────────────────────
// The same `sel.isCollapsed` signal PLAN §12 and `_storyTapMaybeAdvance` already trust.
{
  const C = open();
  C.run(`window.getSelection = function(){ return { isCollapsed: false, rangeCount: 1, toString: function(){ return 'picked words'; } }; }; true;`);
  assert.strictEqual(swipe(C, 'plain-span', -120, 0), false, 'a horizontal drag that SELECTED text does not navigate');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'nothing fired');
  C.run(`window.getSelection = function(){ return { isCollapsed: true, rangeCount: 0 }; }; true;`);
  assert.strictEqual(swipe(C, 'plain-span', -120, 0), true, 'with the selection collapsed, the identical gesture does navigate');
}
console.log('  a drag that selected text stays a selection, not a swipe: OK');

// ── 7. The touchstart/touchend plumbing, incl. the two-finger case ──────────────────────────────
{
  const C = open();
  const drive = (touches, endX) => C.run(`
    _cardSwipeStart({ touches: ${touches}, target: document.getElementById('plain-span') });
    _cardSwipeEnd({ changedTouches: [{ clientX: ${endX}, clientY: 300 }] });
    true;`, 'drive');
  drive(`[{ clientX: 200, clientY: 300 }]`, 60);
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 },
    'one finger travelling 140px left, through the real touch handlers, presses comp-next');
  drive(`[{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }]`, 60);
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 },
    'the SAME travel with TWO fingers down is a pinch and navigates nothing — count unchanged');
  // A touchend with no recorded start (the two-finger case left none) must not throw or navigate.
  C.run(`_cardSwipeEnd({ changedTouches: [{ clientX: 60, clientY: 300 }] }); true;`, 'orphan-end');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 }, 'an orphan touchend is inert');
}
console.log('  the touch handlers pass a one-finger swipe through and drop a two-finger one: OK');

// ── 8. The synthetic click a touch drag leaves behind is SWALLOWED ──────────────────────────────
// ⚠️ This is the half that keeps the two gestures from both firing. Without it, a swipe starting on
// plain text would ALSO run `_storyTapMaybeAdvance` (play), and one starting on a highlighted word
// would ALSO run `tapWord` — a second, different navigation stacked on the swipe's.
{
  const C = open();
  // JSON round-tripped: an object built inside the sandbox has that context's own Object prototype,
  // which deepStrictEqual compares — the same reason every other section here parses its result.
  const clickAfter = (tag) => JSON.parse(C.run(`JSON.stringify((function(){
    var stopped = 0, prevented = 0;
    _cardSwipeSwallowClick({ stopPropagation: function(){ stopped++; }, preventDefault: function(){ prevented++; },
                             target: document.getElementById('plain-span') });
    return { stopped: stopped, prevented: prevented, armed: !!APP._swipeAt };
  })())`, 'click-after-' + tag));

  assert.strictEqual(C.run(`!!APP._swipeAt`), false, 'nothing is armed before any swipe happens');
  assert.deepStrictEqual(clickAfter('cold'), { stopped: 0, prevented: 0, armed: false },
    'with no swipe behind it, an ordinary click passes straight through — this is not a blanket click blocker');

  swipe(C, 'plain-span', -120, 0);
  const hot = clickAfter('hot');
  assert.deepStrictEqual(hot, { stopped: 1, prevented: 1, armed: false },
    'the click immediately after a swipe is stopped AND default-prevented, and disarms itself');
  const second = clickAfter('second');
  assert.deepStrictEqual(second, { stopped: 0, prevented: 0, armed: false },
    'only ONE click is swallowed per swipe — a real tap right after is not eaten');

  // The window expires: an arm left over from long ago must not swallow a genuine later tap.
  C.run(`APP._swipeAt = Date.now() - 5000; true;`);
  assert.deepStrictEqual(clickAfter('stale'), { stopped: 0, prevented: 0, armed: true },
    'a stale arm (5s old) swallows nothing');
}
console.log('  exactly one synthetic click is swallowed per swipe; ordinary and late clicks pass through: OK');

// ── 9. Source guard: the gesture is wired from BOTH inits ───────────────────────────────────────
// The static build's own init() is checked against the BUILT artifact in
// unit-static-story-tap-parity.test.js; this is the live client's side of the same pair.
{
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(/try\{ _cardSwipeInit\(\); \}catch/.test(src),
    'index.html\'s init() wires _cardSwipeInit() — without it the listeners are never attached');
  const mutated = src.replace(/try\{ _cardSwipeInit\(\); \}catch\(_\)\{\}/, '');
  assert.ok(!/_cardSwipeInit\(\);/.test(mutated.replace(/function _cardSwipeInit[\s\S]*/, '')),
    'mutation check: removing that call makes the assertion above fail');
}
console.log('  index.html\'s init() wires _cardSwipeInit(): OK');

console.log('unit-card-swipe-nav: ALL PASSED');
