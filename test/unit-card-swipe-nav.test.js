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
    var body     = document.getElementById('comp-body');   // v89_e: the REAL id now — it is the element the drag moves
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

// ══ v89_e — the card FOLLOWS THE FINGER and springs back ═══════════════════════════════════════
// User: "is it easy that the text field actually moves with swiping?" Tier A of the evaluation —
// the card tracks the finger, clamped, and returns; the commit rule above is unchanged.

// ── 10. The offset curve, as arithmetic ────────────────────────────────────────────────────────
// It is a pure function on purpose: checking a curve by reading pixels off a transform proves the
// wiring, not the shape. Both are checked, in that order.
{
  const C = open();
  const off = (dx, max) => C.run(`_cardSwipeOffset(${dx}, ${max})`);
  assert.strictEqual(off(0, 96), 0, 'no travel, no offset');
  // 1:1 up to the COMMIT distance, so the learner can see how far is far enough.
  for (const d of [1, 17, 40, 59, 60]) {
    assert.strictEqual(off(d, 96), d, `a ${d}px drag moves the card exactly ${d}px — taken literally below the threshold`);
    assert.strictEqual(off(-d, 96), -d, `and ${-d}px the other way`);
  }
  // Beyond it, damped and asymptotic: pulling harder always moves it further, never past the cap.
  const past = [61, 96, 200, 1000, 100000].map(d => off(d, 96));
  for (let i = 1; i < past.length; i++) {
    assert.ok(past[i] > past[i - 1], 'the curve is strictly increasing past the threshold');
    assert.ok(past[i] < 96, `and never reaches the cap (got ${past[i]} at index ${i})`);
  }
  assert.ok(past[0] > 60 && past[0] < 62, 'and it is CONTINUOUS at the join — 61px maps just past 60 (got ' + past[0] + ')');
  assert.ok(off(100000, 96) > 95, 'an absurd drag asymptotes to the cap rather than stopping short: ' + off(100000, 96));
  // The dead-direction cap is the same curve with a smaller ceiling — a short, hard wall.
  assert.strictEqual(off(10, 24), 10, 'a dead direction still tracks 1:1 at first');
  assert.strictEqual(off(24, 24), 24, 'up to its own smaller cap');
  assert.ok(off(500, 24) === 24, 'and then stops dead there: ' + off(500, 24));
  assert.ok(off(500, 24) < off(500, 96), 'so a dead direction is visibly shorter than a live one');
}
console.log('  the offset curve: 1:1 to the threshold, damped and asymptotic past it, capped short when dead: OK');

// ── 11. The axis lock decides ONCE, and a vertical gesture never moves the card ─────────────────
{
  const C = open();
  const move = (dx, dy) => C.run(`(function(){
    var prevented = 0;
    _cardSwipeMove({ touches: [{ clientX: 200 + (${dx}), clientY: 300 + (${dy}) }],
                     cancelable: true, preventDefault: function(){ prevented++; } });
    return { prevented: prevented, axis: APP._swipeFrom && APP._swipeFrom.axis,
             transform: document.getElementById('comp-body').style.transform,
             dragging: !!APP._swipeEl };
  })()`, 'move');
  const start = () => C.run(`document.getElementById('comp-body').style.transform = '';
    _cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById('plain-span') }); true;`);

  // Below the lock distance nothing is decided and nothing moves.
  start();
  let r = move(6, 2);
  assert.strictEqual(r.axis, null, 'a 6px drift has not decided an axis yet');
  assert.strictEqual(r.transform, '', 'and has not moved the card');
  assert.strictEqual(r.prevented, 0, 'nor taken the axis from the page');

  // Past it, horizontally: locked to x, the card moves, and the page scroll is preempted.
  r = move(40, 5);
  assert.strictEqual(r.axis, 'x', 'a clearly horizontal drag locks to x');
  assert.strictEqual(r.dragging, true, 'and starts dragging');
  assert.strictEqual(r.transform, 'translateX(40px)', 'the card is exactly under the finger');
  assert.strictEqual(r.prevented, 1, 'and preventDefault was called — otherwise the page scrolls under a moving card');

  // ⚠️ The lock is not revisited: a gesture that began horizontal stays horizontal.
  r = move(45, 400);
  assert.strictEqual(r.axis, 'x', 'a later vertical excursion does NOT re-decide the axis');

  // A gesture that starts VERTICAL never moves the card and never takes the axis from the page.
  start();
  r = move(4, 40);
  assert.strictEqual(r.axis, 'y', 'a clearly vertical drag locks to y');
  assert.strictEqual(r.dragging, false, 'and never begins a drag');
  assert.strictEqual(r.transform, '', 'the card does not move');
  assert.strictEqual(r.prevented, 0, '⚠️ and preventDefault is NEVER called — scrolling a long card is untouched');
  r = move(400, 45);
  assert.strictEqual(r.axis, 'y', 'even when the finger later curves hard sideways');
  assert.strictEqual(r.prevented, 0, 'still no preventDefault');
  assert.strictEqual(r.transform, '', 'still no movement');
}
console.log('  the axis locks once: horizontal drags move the card and preempt the scroll, vertical ones do neither: OK');

// ── 12. A y-locked gesture cannot commit, however far sideways it ends ─────────────────────────
{
  const C = open();
  // Geometry that WOULD otherwise commit: 160px left, 10px down. The finger scrolled first (so the
  // lock said 'y' at 10px), then curved back and travelled sideways — a scroll with a bounce.
  assert.strictEqual(C.run(`_cardSwipeNav({ x: 200, y: 300, axis: 'y',
    target: document.getElementById('plain-span') }, { x: 40, y: 310 })`), false,
    'a gesture the lock called a SCROLL does not navigate even when its END delta qualifies');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'nothing fired');
  // Non-vacuity: the identical numbers with an x lock DO navigate, so §12 is the lock talking and
  // not the geometry.
  assert.strictEqual(C.run(`_cardSwipeNav({ x: 200, y: 300, axis: 'x',
    target: document.getElementById('plain-span') }, { x: 40, y: 310 })`), true,
    'the same numbers with an x lock DO navigate');
  assert.deepStrictEqual(calls(C), { nextCalls: 1, prevCalls: 0 }, 'and that one pressed comp-next');
}
console.log('  a scroll that curves sideways still does not navigate: OK');

// ── 13. A dead direction gets the short wall, and still refuses to commit ──────────────────────
{
  const C = open();
  C.run(`document.getElementById('comp-prev').style.display = 'none';
         _cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById('plain-span') });
         _cardSwipeMove({ touches: [{ clientX: 500, clientY: 302 }], cancelable: false }); true;`);
  assert.strictEqual(C.run(`document.getElementById('comp-body').style.transform`), 'translateX(24px)',
    'dragging toward a HIDDEN comp-prev stops at the short wall, not the full travel');
  // The same drag the other way, toward a live arrow, goes much further — same gesture, same code.
  C.run(`_cardSwipeCancel();
         _cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById('plain-span') });
         _cardSwipeMove({ touches: [{ clientX: -100, clientY: 302 }], cancelable: false }); true;`);
  const live = C.run(`document.getElementById('comp-body').style.transform`);
  assert.ok(/^translateX\(-(8[0-9]|9[0-5])px\)$/.test(live),
    'toward a LIVE comp-next the same 300px pull travels most of the full 96px: ' + live);
}
console.log('  a direction with nowhere to go gets a short hard wall; a live one gets the full travel: OK');

// ── 14. Release: an abandoned drag SPRINGS home, a committed one SNAPS ─────────────────────────
// ⚠️ The distinction is load-bearing, not decorative. A commit re-renders the card underneath, and
// animating a transform on an element whose content is being replaced is exactly how the next card
// arrives already displaced.
{
  const C = open();
  const body = () => JSON.parse(C.run(`JSON.stringify((function(){ var e = document.getElementById('comp-body');
    return { transform: e.style.transform, transition: e.style.transition, userSelect: e.style.userSelect, dragging: !!APP._swipeEl }; })())`));
  const drag = (toX) => C.run(`_cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById('plain-span') });
    _cardSwipeMove({ touches: [{ clientX: ${toX}, clientY: 303 }], cancelable: false }); true;`);

  // While dragging: no transition (track, don't chase) and selection is off.
  drag(240);
  const mid = body();
  assert.strictEqual(mid.transition, 'none', 'a card being dragged has NO transition — it tracks the finger');
  assert.strictEqual(mid.userSelect, 'none', 'and selection is off, so PLAN §12 is not also trying to own the finger');
  assert.ok(mid.transform, 'and it has moved');

  // Abandoned (30px — under the 60px commit distance): springs, selection restored, nothing fired.
  C.run(`_cardSwipeEnd({ changedTouches: [{ clientX: 230, clientY: 303 }] }); true;`);
  const sprung = body();
  assert.strictEqual(sprung.transform, '', 'an abandoned drag returns the card home');
  assert.ok(/^transform \.22s/.test(sprung.transition), 'and EASES back rather than jumping: ' + sprung.transition);
  assert.strictEqual(sprung.userSelect, '', 'selection is handed back');
  assert.strictEqual(sprung.dragging, false, 'and the drag is over');
  assert.deepStrictEqual(calls(C), { nextCalls: 0, prevCalls: 0 }, 'a 30px drag committed nothing');

  // Committed (a full swipe left): SNAPS, and the transform is already gone by the time the
  // destination's handler runs — asserted from INSIDE that handler, which is the only place the
  // ordering is observable.
  C.run(`window.__atNav = null;
         document.getElementById('comp-next').onclick = function(){
           var e = document.getElementById('comp-body');
           window.__atNav = { transform: e.style.transform, transition: e.style.transition };
         }; true;`);
  drag(60);
  C.run(`_cardSwipeEnd({ changedTouches: [{ clientX: 20, clientY: 303 }] }); true;`);
  const atNav = JSON.parse(C.run(`JSON.stringify(window.__atNav)`));
  assert.ok(atNav, 'the destination handler ran');
  assert.strictEqual(atNav.transform, '', '⚠️ the card was already back home when the destination opened');
  assert.strictEqual(atNav.transition, '', 'and SNAPPED — no transition left running across the re-render');
  assert.strictEqual(body().dragging, false, 'the drag is over');
}
console.log('  an abandoned drag eases home; a committed one snaps back BEFORE the destination opens: OK');

// ── 15. Nothing can leave the card parked ──────────────────────────────────────────────────────
// Every way a gesture can end without a touchend, each of which stranded a transform in an earlier
// draft of this feature.
{
  const C = open();
  const tf = () => C.run(`document.getElementById('comp-body').style.transform`);
  const drag = () => C.run(`_cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById('plain-span') });
    _cardSwipeMove({ touches: [{ clientX: 260, clientY: 303 }], cancelable: false }); true;`);

  drag(); assert.ok(tf(), 'the card is parked mid-drag');
  C.run(`_cardSwipeCancel(); true;`);
  assert.strictEqual(tf(), '', 'touchcancel puts it back');

  drag(); assert.ok(tf(), 'parked again');
  // A SECOND FINGER lands: this arrives as a touchstart, never a touchend.
  C.run(`_cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }, { clientX: 260, clientY: 300 }],
                           target: document.getElementById('plain-span') }); true;`);
  assert.strictEqual(tf(), '', 'a second finger landing mid-drag puts it back');
  assert.strictEqual(C.run(`!!APP._swipeFrom`), false, 'and the pinch is not treated as a swipe');

  drag(); assert.ok(tf(), 'parked again');
  // A touchmove reporting no touches at all (the shape a torn-down gesture can produce).
  C.run(`_cardSwipeMove({ touches: [] }); true;`);
  assert.strictEqual(tf(), '', 'a touchmove with no touches puts it back');

  // A touchend with no recorded start must not throw, and must leave the card home.
  C.run(`_cardSwipeEnd({ changedTouches: [{ clientX: 60, clientY: 300 }] }); true;`);
  assert.strictEqual(tf(), '', 'an orphan touchend leaves it home');
}
console.log('  touchcancel, a second finger, an empty touchmove and an orphan touchend all put the card back: OK');

// ── 16. Out of scope means no drag at all ──────────────────────────────────────────────────────
// The drag and the commit share `_cardSwipeInScope`, so this is the same boundary §4 asserts — but
// asserted on the VISUAL half, which would otherwise be free to move a card that then refuses.
{
  const C = open();
  for (const id of ['sum-plain-span', 'sb-icon']) {
    C.run(`document.getElementById('comp-body').style.transform = '';
      _cardSwipeStart({ touches: [{ clientX: 200, clientY: 300 }], target: document.getElementById(${JSON.stringify(id)}) });
      _cardSwipeMove({ touches: [{ clientX: 300, clientY: 302 }], cancelable: false }); true;`);
    assert.strictEqual(C.run(`document.getElementById('comp-body').style.transform`), '',
      'a horizontal drag starting at #' + id + ' moves nothing — it is out of scope');
    assert.strictEqual(C.run(`!!APP._swipeEl`), false, 'and starts no drag');
  }
}
console.log('  a drag starting outside the progress card moves nothing: OK');

console.log('unit-card-swipe-nav: ALL PASSED');
