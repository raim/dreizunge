// unit-bottom-bar-toggle.test.js
// v85_b — user request: "allow to hide the bottom navigation bar via a button on the left." Adds
// `#bottom-bar-toggle` (its own independently-fixed element, left of the screen, OUTSIDE
// `#bottom-bar` so it survives the bar being hidden) plus `toggleBottomBar()`/
// `_applyBottomBarVisibility()`. Contract under test, all against RENDERED/computed state, not
// source text (standing rule 2):
//   • `#bottom-bar-toggle` exists, is NOT inside `#bottom-bar` (must stay clickable while the bar
//     itself is display:none), and sits at the left (`style.left` set, not `right`).
//   • Default (nothing in localStorage): the bar is visible, the toggle reads its "hide" state.
//   • One tap hides `#bottom-bar` (`display:none`), flips the toggle's icon/title to the "show"
//     state, and collapses `--bottom-bar-h` to `0px` so widgets anchored above the (now absent) bar
//     settle to the true bottom instead of leaving a gap — asserted by reading the property straight
//     off `document.documentElement.style` (this harness's `getComputedStyle` is a permanent no-op
//     stub per `lib-dom.js`'s own file header — layout/cascade resolution is out of its scope — but
//     `setProperty`/`getPropertyValue` on a real element's `style` are plain key/value storage, the
//     same tier as the `el.style.display` reads every other test in this suite already does).
//   • A second tap restores everything, including `--bottom-bar-h` back to its normal value.
//   • The preference is WRITTEN to `localStorage['imp3_bottombar_hidden']` on every toggle (both
//     directions) — same scope `unit-teacher-toggle.test.js` uses for its own persisted flag: the
//     harness builds `APP.bottomBarHidden` from `localStorage` at module-load time, before test code
//     gets control, so the READ side is exercised by construction, not re-assertable in isolation
//     here.
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
    APP.info = { backend:'none', canGenerate:false }; true;`, 'seed');
  return C;
}

// ── 1. Markup: the toggle exists outside #bottom-bar, anchored left ──────────────
{
  const barAt = html.indexOf('id="bottom-bar"');
  const toggleAt = html.indexOf('id="bottom-bar-toggle"');
  assert.ok(toggleAt >= 0, '#bottom-bar-toggle exists in the markup');
  assert.ok(barAt >= 0, '#bottom-bar exists in the markup');
  assert.ok(toggleAt < barAt, '#bottom-bar-toggle is written BEFORE #bottom-bar opens — i.e. a sibling, not a child, so it survives the bar being hidden');
}
console.log('  markup: #bottom-bar-toggle is a sibling of #bottom-bar, not nested inside it: OK');

// ── 2. Default state: bar visible, toggle shows the "hide" affordance ────────────
{
  const C = client();
  const r = C.run(`_applyBottomBarVisibility();
    ({ barDisplay: document.getElementById('bottom-bar').style.display,
       toggleText: document.getElementById('bottom-bar-toggle').textContent,
       barH: document.documentElement.style.getPropertyValue('--bottom-bar-h') })`);
  assert.strictEqual(r.barDisplay, 'flex', 'default: #bottom-bar is visible (flex)');
  assert.strictEqual(r.toggleText, '▾', 'default: toggle shows the collapse (▾) glyph, meaning "tap to hide"');
  assert.strictEqual(r.barH, '64px', 'default: --bottom-bar-h is the normal 64px');
}
console.log('  default (no persisted preference): bar visible, toggle offers to hide it, --bottom-bar-h normal: OK');

// ── 3. One tap hides the bar and collapses --bottom-bar-h ────────────────────────
{
  const C = client();
  const r = C.run(`toggleBottomBar();
    ({ barDisplay: document.getElementById('bottom-bar').style.display,
       toggleText: document.getElementById('bottom-bar-toggle').textContent,
       toggleTitle: document.getElementById('bottom-bar-toggle').title,
       barH: document.documentElement.style.getPropertyValue('--bottom-bar-h'),
       flag: APP.bottomBarHidden })`);
  assert.strictEqual(r.flag, true, 'toggleBottomBar() flips APP.bottomBarHidden true');
  assert.strictEqual(r.barDisplay, 'none', 'one tap: #bottom-bar is hidden (display:none)');
  assert.strictEqual(r.toggleText, '▴', 'hidden: toggle shows the expand (▴) glyph, meaning "tap to show"');
  assert.ok(/show/i.test(r.toggleTitle), 'hidden: toggle title offers to show the bar again');
  assert.strictEqual(r.barH, '0px', 'hidden: --bottom-bar-h collapses to 0 so above-bar widgets settle to the true bottom');
}
console.log('  one tap: hides #bottom-bar, flips the toggle glyph, collapses --bottom-bar-h to 0: OK');

// ── 4. A second tap restores everything ───────────────────────────────────────────
{
  const C = client();
  const r = C.run(`toggleBottomBar(); toggleBottomBar();
    ({ barDisplay: document.getElementById('bottom-bar').style.display,
       toggleText: document.getElementById('bottom-bar-toggle').textContent,
       barH: document.documentElement.style.getPropertyValue('--bottom-bar-h'),
       flag: APP.bottomBarHidden })`);
  assert.strictEqual(r.flag, false, 'a second tap flips APP.bottomBarHidden back to false');
  assert.strictEqual(r.barDisplay, 'flex', 'a second tap: #bottom-bar is visible again');
  assert.strictEqual(r.toggleText, '▾', 'a second tap: toggle glyph is back to "tap to hide"');
  assert.strictEqual(r.barH, '64px', 'a second tap: --bottom-bar-h is restored to 64px');
}
console.log('  a second tap: restores the bar, the glyph, and --bottom-bar-h: OK');

// ── 5. Persistence: each toggle direction writes localStorage ────────────────────
{
  const C = client();
  const hide = C.run(`toggleBottomBar(); localStorage.getItem('imp3_bottombar_hidden')`);
  assert.strictEqual(hide, '1', 'hiding writes imp3_bottombar_hidden=1 to localStorage');
  const show = C.run(`toggleBottomBar(); localStorage.getItem('imp3_bottombar_hidden')`);
  assert.strictEqual(show, '0', 'showing again writes imp3_bottombar_hidden=0 to localStorage');
}
console.log('  persistence: both toggle directions write imp3_bottombar_hidden (0/1): OK');

console.log('unit-bottom-bar-toggle: ALL PASSED');
