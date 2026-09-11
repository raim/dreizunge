// unit-bar-popover-align.test.js — v90_aa. The bottom bar's panels line up with their buttons.
//
// ⚠️ THE REQUEST: "align the settings bar popovers (login, settings, running jobs) with their
// buttons, like the tutor and the model selection popovers are already aligned."
//
// The observation was exact. `#corner-pills` (account · settings · ✨ model · jobs) sits at the LEFT
// of `#bottom-bar`, and of its four panels only ONE was anchored to its own button — `.bmodels-pop`
// is `position:absolute; left:0` inside `#bpill-wrap`. `.jobs-pop` was `position:fixed; right:16px`,
// pinned to the screen's RIGHT edge while its button is on the left, and settings/account were
// centred MODALS rather than popovers at all. (The tutor only READS as aligned because its own fab
// is the right-hand control, so `right:16px` happens to land under it.)
//
// ⚠️ LEFT-EDGE alignment, not centring, because `.bmodels-pop` is the reference the request named
// and that is what `left:0` does. Centring a 320px panel on a 36px pill also looks attached, but it
// would make these three disagree with the one control that was already right.
//
// ⚠️ WHY JS AND NOT `.bmodels-pop`'s absolute positioning, which is the obvious fix and is a trap:
// `#jobs-pop` was deliberately moved OUT of `#jobs-fab` because `#bottom-bar` is a STACKING CONTEXT
// (`position:fixed` + `z-index:900`), so a descendant can never out-rank a body-level
// `#tutor-widget` (`z-index:901`). Re-parenting for free alignment would reopen that bug — the panel
// would render invisibly behind the tutor. They stay at body level; only `left` is computed.
//
// ⚠️ HARNESS LIMITS THAT SHAPE THIS FILE. `test/lib-dom.js` gives EVERY element the same fixed rect
// (`left:0, width:100`) and a constant `offsetWidth` of 100 defined with a non-configurable getter,
// and its `innerWidth` is 390 — phone-sized, which is below the 520px cutoff, so nothing anchors by
// default. So each case sets `innerWidth` explicitly and overrides `getBoundingClientRect` on the
// BUTTON only; the panel width stays the harness's 100. That is enough to pin the arithmetic, and
// the real geometry was verified in a live browser instead (measured at 1100px: account button
// left 16 → card left 16, settings 133 → 133, jobs 221 → 221).
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
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang='it'; APP.srcLang='de';
    APP.progress = { completed:{}, learned:{} };
    // Give a named element a controlled position, since the harness hands every element the same one.
    window.__place = function(id, left, width){
      var el = document.getElementById(id);
      el.getBoundingClientRect = function(){
        return { left: left, right: left + width, width: width, top: 0, bottom: 20, height: 20 }; };
      return el; };
    true;`, 'seed');
  return C;
}

// ── 1. The panel's LEFT EDGE lands on its button's left edge ──────────────────────────────────
{
  const C = client();
  const left = C.run(`innerWidth = 1100;
    window.__place('jobs-pill', 221, 36);
    var pop = document.getElementById('jobs-pop');
    _anchorToBtn(pop, document.getElementById('jobs-pill'), 320);
    pop.style.left`, 'anchor');
  assert.strictEqual(left, '221px',
    'the panel is placed at the button\'s own left edge — the same thing .bmodels-pop\'s `left:0` does');
  const right = C.run(`document.getElementById('jobs-pop').style.right`, 'right');
  assert.strictEqual(right, 'auto',
    'and the stylesheet\'s `right:16px` is released — leaving it would stretch the panel to the far edge');
}
console.log('  a panel is placed at its button\'s left edge, releasing the stylesheet\'s right pin: OK');

// ── 2. Never off-screen: a button near the right edge clamps ──────────────────────────────────
{
  const C = client();
  const left = C.run(`innerWidth = 1100;
    window.__place('jobs-pill', 1050, 36);
    var pop = document.getElementById('jobs-pop');
    _anchorToBtn(pop, document.getElementById('jobs-pill'), 320);
    pop.style.left`, 'clamp');
  // The harness pins offsetWidth at 100, so the right-hand bound is 1100 - 100 - 8.
  assert.strictEqual(left, '992px', 'a panel that would overflow the right edge is pulled back inside it');
  const C2 = client();
  const l2 = C2.run(`innerWidth = 1100;
    window.__place('jobs-pill', -40, 36);
    var pop = document.getElementById('jobs-pop');
    _anchorToBtn(pop, document.getElementById('jobs-pill'), 320);
    pop.style.left`, 'clampL');
  assert.strictEqual(l2, '8px', 'and one that would hang off the left edge is pushed back in');
}
console.log('  a panel is clamped inside the viewport at both edges: OK');

// ── 3. Narrow screens are left entirely alone ─────────────────────────────────────────────────
// `.jobs-pop` already goes edge-to-edge below 520px via its own media query, and a 360px card on a
// 380px phone has nothing to be aligned TO. Anchoring there would override the media query with an
// inline value — strictly worse than doing nothing.
{
  const C = client();
  const r = C.run(`innerWidth = 400;
    window.__place('jobs-pill', 221, 36);
    var pop = document.getElementById('jobs-pop');
    var applied = _anchorToBtn(pop, document.getElementById('jobs-pill'), 320);
    JSON.stringify({ applied: applied, left: pop.style.left || '(none)' })`, 'narrow');
  const o = JSON.parse(r);
  assert.strictEqual(o.applied, false, 'below the cutoff the anchorer declines');
  assert.strictEqual(o.left, '(none)', 'and writes NO inline left, so the media query still governs');
}
console.log('  below 520px nothing is anchored and no inline position is written: OK');

// ── 4. A hidden/collapsed button is not an anchor ─────────────────────────────────────────────
// The bottom bar can be toggled away; a zero-size button would otherwise pin every panel to the
// left margin, which looks like a bug rather than like a hidden bar.
{
  const C = client();
  const r = C.run(`innerWidth = 1100;
    window.__place('jobs-pill', 0, 0);
    document.getElementById('jobs-pill').getBoundingClientRect = function(){
      return { left:0, right:0, width:0, top:0, bottom:0, height:0 }; };
    var pop = document.getElementById('jobs-pop');
    var applied = _anchorToBtn(pop, document.getElementById('jobs-pill'), 320);
    JSON.stringify({ applied: applied, left: pop.style.left || '(none)' })`, 'hidden');
  const o = JSON.parse(r);
  assert.strictEqual(o.applied, false, 'a zero-size button is refused as an anchor');
  assert.strictEqual(o.left, '(none)', 'and the panel keeps whatever layout it had');
}
console.log('  a hidden (zero-size) button is refused as an anchor: OK');

// ── 5. Closing hands the panel back to its stylesheet ─────────────────────────────────────────
// Otherwise a value computed on a wide viewport survives into a later narrow one and defeats the
// media query permanently — the failure only shows up after a rotate or a window resize.
{
  const C = client();
  const r = C.run(`innerWidth = 1100;
    window.__place('jobs-pill', 221, 36);
    openJobsPop();
    var mid = document.getElementById('jobs-pop').style.left;
    closeJobsPop();
    JSON.stringify({ mid: mid, after: document.getElementById('jobs-pop').style.left || '(cleared)',
                     afterRight: document.getElementById('jobs-pop').style.right || '(cleared)' })`, 'close');
  const o = JSON.parse(r);
  assert.strictEqual(o.mid, '221px', 'openJobsPop anchors on the way in — not just the raw helper');
  assert.strictEqual(o.after, '(cleared)', 'and closing clears the inline left');
  assert.strictEqual(o.afterRight, '(cleared)', 'and the inline right too');
}
console.log('  openJobsPop anchors, and closing returns the panel to its stylesheet: OK');

// ── 6. The two MODAL cards are anchored, and their BACKDROP is untouched ──────────────────────
// The backdrop is what `modalBackdropClose` reads to tell an outside press from an inside one, and
// that behaviour is guarded elsewhere — so only the card may move.
{
  const C = client();
  const r = C.run(`innerWidth = 1100;
    window.__place('settings-pill', 133, 36);
    window.__place('acct-btn', 16, 109);
    openSettings(); openAccount();
    var sm = document.getElementById('settings-modal'), sc = document.getElementById('settings-card');
    var ac = document.getElementById('acct-card');
    JSON.stringify({ settingsLeft: sc.style.left, settingsPos: sc.style.position,
                     acctLeft: ac.style.left, acctPos: ac.style.position,
                     backdropInline: sm.style.left || '(untouched)',
                     backdropDisplay: sm.style.display })`, 'modals');
  const o = JSON.parse(r);
  assert.strictEqual(o.settingsLeft, '133px', 'the settings card lands on its own button');
  assert.strictEqual(o.acctLeft, '16px', 'and the account card on its own — the two are NOT anchored to the same place');
  assert.strictEqual(o.settingsPos, 'absolute', 'the card is positioned rather than flex-centred');
  assert.strictEqual(o.acctPos, 'absolute');
  assert.strictEqual(o.backdropInline, '(untouched)', 'the BACKDROP is not repositioned — its geometry is what dismissal reads');
  assert.strictEqual(o.backdropDisplay, 'flex', 'and it is still shown the way it always was');
}
console.log('  both modal cards anchor to their own buttons while the dismiss backdrop is untouched: OK');

// ── 7. Re-opening on a NARROW viewport undoes a wide-viewport anchor ──────────────────────────
// Non-vacuity for §3 at the modal layer: a card left `position:absolute` from an earlier desktop
// open would stay stuck bottom-left on a phone.
{
  const C = client();
  const r = C.run(`innerWidth = 1100; window.__place('settings-pill', 133, 36);
    openSettings(); closeSettings();
    innerWidth = 400;
    openSettings();
    var sc = document.getElementById('settings-card');
    JSON.stringify({ pos: sc.style.position || '(cleared)', left: sc.style.left || '(cleared)' })`, 'reset');
  const o = JSON.parse(r);
  assert.strictEqual(o.pos, '(cleared)', 'a narrow re-open clears the absolute positioning');
  assert.strictEqual(o.left, '(cleared)', 'and the computed left, so the card is flex-centred again');
}
console.log('  re-opening on a narrow viewport undoes an earlier wide-viewport anchor: OK');

// ── 8. ⚠️ The bottom bar rendered a RAW ui.json KEY, live ─────────────────────────────────────
// Found while verifying the alignment in a real browser: the signed-out account badge showed the
// literal text `acct.signin`. `refreshAccountBadge()` writes `APP.learner || t('acct.signin')` and
// can run before `loadUIStrings()` resolves, when `t()` returns the KEY — and `applyUIStrings()` did
// not address `#acct-name`, so nothing healed it afterwards.
// ⚠️ The key was never MISSING (`ui.json` has had it all along), which is exactly why the
// unlocalized-string audit never saw it: that audit looks for absent keys, not for a present key
// written too early.
{
  const C = client();
  const before = C.run(`UI_STRINGS = {}; refreshAccountBadge();
    document.getElementById('acct-name').textContent`, 'before');
  assert.strictEqual(before, 'acct.signin',
    'non-vacuity: with strings not yet loaded the badge really does hold the raw key — this is the reported state');
  const after = C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; applyUIStrings();
    document.getElementById('acct-name').textContent`, 'after');
  assert.strictEqual(after, UI.en['acct.signin'],
    'applying the strings now HEALS the badge — it used to leave the raw key on screen forever');
  assert.notStrictEqual(after, 'acct.signin');
  // A signed-in badge must keep the name, not be overwritten with "Sign in".
  const named = C.run(`APP.learner = 'raim'; applyUIStrings();
    document.getElementById('acct-name').textContent`, 'named');
  assert.strictEqual(named, 'raim', 'a signed-in badge keeps the learner name — the heal is not a blind overwrite');
}
console.log('  applyUIStrings heals the signed-out account badge instead of leaving a raw key on screen: OK');

console.log('unit-bar-popover-align: ALL PASSED');
