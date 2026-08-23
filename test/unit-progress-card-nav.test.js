// unit-progress-card-nav.test.js
// v83_c (user) — progress-card redesign: "move the navigation control icon rows and the progress
// bars into a popup, reachable via one button in the header row of the text field, before the text
// translation buttons. Only the back/next button should be duplicated ... in the navigation popup,
// and in the text field header row. ... progress card text fields should ideally always fill the
// full available screen."
//
// Scope: complete-screen ONLY (the "progress card" in this project's own vocabulary). The entry/
// summary/finished/unlocked-story cards were not asked to change and keep their old layout — see
// unit-story-summary.test.js's §6 and smoke-render.test.js's row-order section for how the two old
// cross-card/row-order invariants this redesign supersedes were updated, not just loosened.
//
// Contract under test:
//   1. `#comp-nav-modal` — the popup — holds comp-storyboard/comp-lessons/comp-actions/
//      comp-progress/comp-nav-btns, UNCHANGED elements just relocated (same ids, same renderers).
//   2. The story panel's summary row carries a ☰ trigger BEFORE the translation flags, and a
//      duplicated back/next pair — ONLY those two are duplicated.
//   3. `_syncCompHdrNav()` mirrors comp-prev/comp-next's FINAL resolved state onto the duplicate
//      pair — a generic copy, not a re-derivation of showComplete's ~7 branches.
//   4. The popup closes on every screen change/re-render (the same show(id) choke point PLAN §12's
//      selection popover uses) and explicitly before a crossword opens (the one path that shows
//      another overlay without a screen change).
//   5. The story panel is a flex:1 child of a flex:1 .comp-body, scoped to #complete-screen alone —
//      other card screens share .comp-body and were not asked to change.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const { loadClient } = require('./lib-dom');

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const posOf = (id) => {
  const re = new RegExp(`id="${id}"`, 'g');
  const hits = [...html.matchAll(re)];
  assert.strictEqual(hits.length, 1, `${id} appears exactly once in index.html (got ${hits.length})`);
  return hits[0].index;
};

// ── 1. The popup: relocated, not reimplemented ────────────────────────────────
{
  assert.ok(/id="comp-nav-modal"/.test(html), 'the popup exists');
  const modalStart = posOf('comp-nav-modal');
  const modalBlock = html.slice(modalStart, html.indexOf('</div>\n</div>\n\n', modalStart) + 20);
  for (const id of ['comp-storyboard', 'comp-lessons', 'comp-actions', 'comp-progress', 'comp-nav-btns']) {
    assert.ok(posOf(id) > modalStart, `${id} is inside (after the start of) #comp-nav-modal`);
  }
  // Relocated, not rewritten: the buttons the popup renders are byte-for-byte the ones showComplete
  // already knows how to populate — same ids, same onclick wiring, nothing re-implemented.
  for (const frag of [
    'id="comp-prev" style="display:none"',
    'onclick="repeatForCoverage()"', 'onclick="startDrill()"', 'onclick="openCrosswordFromComplete()"',
    'id="comp-next" onclick="afterComplete()"',
  ]) assert.ok(html.includes(frag), `unchanged action button markup survives: ${frag}`);
  // Same overlay pattern as #settings-modal, reused rather than reinvented.
  assert.ok(/id="comp-nav-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba\(0,0,0,\.45\)/.test(html),
    'the popup uses the same fixed-overlay shape as #settings-modal');
  assert.ok(/max-height:calc\(100vh - 32px\);overflow-y:auto/.test(modalBlock),
    'the popup box scrolls internally on a short viewport, matching #settings-modal');
}
console.log('  popup: holds the relocated machinery unchanged, same overlay pattern as #settings-modal: OK');

// ── 2. The header row: ☰ before the flags, back/next duplicated (and ONLY those) ─
{
  const panelStart = posOf('comp-story-panel');
  const summaryEnd = html.indexOf('</summary>', panelStart);
  const summary = html.slice(panelStart, summaryEnd);
  const order = ['comp-story-prev', 'comp-story-nav-btn', 'comp-story-flags', 'comp-story-spk', 'comp-story-next']
    .map(id => summary.indexOf(`id="${id}"`));
  order.forEach((at, i) => assert.ok(at > 0, `element ${i} of the header row exists in the summary`));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], 'header-row elements are in the required order');
  assert.ok(summary.indexOf('comp-story-nav-btn') < summary.indexOf('comp-story-flags'),
    'the ☰ popup trigger sits BEFORE the translation flags, per the request');
  // ONLY back/next are duplicated: no OTHER comp-* action id (repeat/drill/crossword/wipe) gets a
  // comp-story-* twin anywhere in the file.
  for (const id of ['comp-story-repeat', 'comp-story-drill', 'comp-story-crossword', 'comp-story-wipe']) {
    assert.ok(!html.includes(`id="${id}"`), `${id} must NOT exist — only back/next are duplicated`);
  }
  assert.ok(/onclick="event\.stopPropagation\(\);openCompNav\(\);"/.test(summary),
    'the ☰ button opens the popup, and stops the click from also toggling the <details>');
}
console.log('  header row: ☰ before the flags, ONLY back/next duplicated, click-toggle guarded: OK');

// ── 3. _syncCompHdrNav: a generic mirror, not a re-derivation ────────────────
{
  const sync = extFn(html, '_syncCompHdrNav');
  assert.ok(/dst\.textContent = src\.textContent/.test(sync) && /dst\.title = src\.title/.test(sync)
         && /dst\.style\.display = src\.style\.display/.test(sync) && /dst\.disabled = src\.disabled/.test(sync),
    'every piece of comp-next/comp-prev\'s resolved state is copied, not re-derived');
  assert.ok(/mirror\('comp-prev', 'comp-story-prev'\)/.test(sync) && /mirror\('comp-next', 'comp-story-next'\)/.test(sync),
    'both pairs are mirrored');
  // Called LAST — after every showComplete branch has had a chance to set comp-next/comp-prev.
  const sc = extFn(html, 'showComplete');
  const syncAt = sc.indexOf('_syncCompHdrNav()');
  const showAt = sc.lastIndexOf("show('complete-screen')");
  assert.ok(syncAt > 0 && showAt > syncAt, 'the sync runs after every branch, right before show(complete-screen)');

  // Behavioural: build two bare stub buttons and confirm the mirror actually copies state.
  const C = loadClient({ quiet: true });
  const out = C.run(`(() => {
    const mk = (id) => { const el = document.getElementById(id); el.tagName='BUTTON'; return el; };
    const src = mk('comp-next'); src.textContent = '→'; src.title = 'Next chapter';
    src.style.display = ''; src.disabled = false; src.onclick = () => { window.__clicked = 'real'; };
    const dst = mk('comp-story-next');
    _syncCompHdrNav();
    dst.onclick({ stopPropagation: () => { window.__stopped = true; } });
    return { text: dst.textContent, title: dst.title, display: dst.style.display,
             className: dst.className, clicked: window.__clicked, stopped: window.__stopped };
  })()`);
  assert.strictEqual(out.text, '→', 'textContent mirrored');
  assert.strictEqual(out.title, 'Next chapter', 'title mirrored');
  assert.strictEqual(out.display, '', 'display mirrored (visible)');
  assert.strictEqual(out.className, 'spk-ico', 'not disabled → no .disabled class');
  assert.strictEqual(out.clicked, 'real', 'the duplicate\'s onclick actually calls comp-next\'s own handler');
  assert.ok(out.stopped, 'the duplicate stops propagation itself (it sits inside the toggling <summary>)');

  // A DISABLED source must mirror as disabled, with the visual class.
  const out2 = C.run(`(() => {
    const src = document.getElementById('comp-next');
    src.disabled = true; src.style.display = 'none';
    const dst = document.getElementById('comp-story-next');
    _syncCompHdrNav();
    return { display: dst.style.display, disabled: dst.disabled, className: dst.className };
  })()`);
  assert.strictEqual(out2.display, 'none', 'a hidden source mirrors as hidden');
  assert.strictEqual(out2.disabled, true, 'a disabled source mirrors as disabled');
  assert.strictEqual(out2.className, 'spk-ico disabled', 'the disabled class is applied to the duplicate');
}
console.log('  _syncCompHdrNav: mirrors text/title/display/disabled/onclick, runs last, non-vacuous: OK');

// ── 4. The popup closes on navigation, and explicitly before a crossword opens ──
{
  assert.ok(/try\{ closeCompNav\(\); \}catch\(_\)\{\}/.test(extFn(html, 'show')),
    'show(id) closes the popup on every screen change/re-render — same choke point PLAN §12 uses');
  const ocfc = extFn(html, 'openCrosswordFromComplete');
  assert.ok(/closeCompNav\(\)/.test(ocfc) && ocfc.indexOf('closeCompNav()') < ocfc.indexOf('openCrossword(idx)'),
    'openCrosswordFromComplete closes the nav popup BEFORE showing the crossword overlay ' +
    '(openCrossword does not call show(), so the generic close above never fires here)');
  // Behavioural: openCompNav/closeCompNav actually toggle the element.
  const C = loadClient({ quiet: true });
  const seq = C.run(`(() => {
    const m = document.getElementById('comp-nav-modal');
    const before = m.style.display;
    openCompNav(); const afterOpen = m.style.display;
    closeCompNav(); const afterClose = m.style.display;
    return { before, afterOpen, afterClose };
  })()`);
  assert.strictEqual(seq.afterOpen, 'flex', 'openCompNav shows the popup');
  assert.strictEqual(seq.afterClose, 'none', 'closeCompNav hides it');
  // Mutation check by construction: show(id) really calls the SAME closeCompNav, not a look-alike —
  // exercised for real (not just source-pinned) by calling the actual show() against a stub screen.
  const C2 = loadClient({ quiet: true });
  const seq2 = C2.run(`(() => {
    document.getElementById('comp-nav-modal').style.display = 'flex';
    document.getElementById('landing').classList = { add(){}, remove(){} };
    document.querySelectorAll = () => [];
    try { show('landing'); } catch(_) {}
    return document.getElementById('comp-nav-modal').style.display;
  })()`);
  assert.strictEqual(seq2, 'none', 'calling the REAL show() closes an open nav popup, end to end');
}
console.log('  popup lifecycle: closes on navigation (real show(), not just source-pinned) and before crossword: OK');

// ── 5. closeCrossword's fallback no longer scrolls to a now-hidden element ───
{
  const cc = extFn(html, 'closeCrossword');
  assert.ok(/getElementById\('comp-story-panel'\) \|\| document\.getElementById\('comp-actions'\)/.test(cc),
    'closeCrossword scrolls to the (still-visible) story panel first, falling back to the old target');
}
console.log('  closeCrossword: fallback scroll target updated for the relocated #comp-actions: OK');

// ── 6. The story field fills available screen height — SCOPED to #complete-screen ─
{
  assert.ok(/#complete-screen \.comp-body\{display:flex;flex-direction:column;flex:1;min-height:0\}/.test(html),
    'comp-body grows to fill .screen\'s min-height:100vh, scoped to complete-screen');
  assert.ok(/#complete-screen #comp-story-panel\{display:flex;flex-direction:column\}/.test(html)
         && /#complete-screen #comp-story-panel\[open\]\{flex:1\}/.test(html),
    'the story panel grows to fill comp-body\'s remaining space, but only while open');
  assert.ok(/#complete-screen #comp-story-text\{flex:1\}/.test(html),
    'the text itself (not just its border) stretches — a short story still fills the bordered field');
  // Non-vacuity: the OTHER three card screens share .comp-body/.comp-title and were not asked to
  // change — the rule must be id-scoped, not a plain .comp-body{flex:1} that would also stretch
  // finished-screen/summary-screen/unlockstory-screen.
  assert.ok(!/(?<!#complete-screen )\.comp-body\{display:flex;flex-direction:column;flex:1/.test(html),
    'the flex-fill rule is scoped to #complete-screen, not applied to the shared .comp-body class');
}
console.log('  "fill the full available screen": flex:1 chain scoped to #complete-screen alone: OK');

// ── 7. ui.json — new strings exist (en only, per project convention) ─────────
{
  for (const k of ['complete.nav_open', 'complete.nav_title']) assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  ui.json: new popup strings present, en only: OK');

console.log('unit-progress-card-nav: ALL PASSED');
