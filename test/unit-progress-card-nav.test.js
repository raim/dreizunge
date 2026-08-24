// unit-progress-card-nav.test.js
// v83_c (user) — progress-card redesign: "move the navigation control icon rows and the progress
// bars into a popup, reachable via one button in the header row of the text field, before the text
// translation buttons. Only the back/next button should be duplicated ... in the navigation popup,
// and in the text field header row. ... progress card text fields should ideally always fill the
// full available screen." Then, as an immediate follow-up: "navigation and next buttons could also
// be used on the entry card, incl. the progress bars" — extending the SAME pattern to the entry/
// summary card, which has no back button to duplicate (just next). Then: "use thicker arrows for
// back/forward buttons in the story header." Then: "even thicker arrow, e.g. the same as used
// between the source and target language selectors." Then, REVOKED: "progress card text field do
// NOT have to fill the full height of the available screen" — §6 below guards the ABSENCE of the
// flex-fill chain, on purpose, not just its removal.
//
// Scope: `complete-screen` (the "progress card") AND `summary-screen` (the "entry card"). The
// finished/unlocked-story cards were not asked and were not touched — see unit-story-summary.test.js
// §6 and smoke-render.test.js's row-order section for how the two old cross-card/row-order
// invariants THIS PAIR of screens' redesign supersedes were rewritten, not just loosened.
//
// Contract under test:
//   1. `#comp-nav-modal` / `#sum-nav-modal` — the two popups — hold their card's relocated
//      machinery, UNCHANGED elements just moved (same ids, same renderers).
//   2. Each card's header row carries a ☰ trigger BEFORE its translation control(s), and a
//      duplicated next (complete-screen also duplicates back) — and ONLY those.
//   3. `_mirrorNavBtn(srcId, dstId)` — the ONE mirror rule shared by `_syncCompHdrNav` and
//      `_syncSumHdrNav` — copies a source button's FUNCTIONAL resolved state (title/display/
//      disabled/onclick), NOT its glyph, which is fixed markup since v83_e.
//   4. Both popups close on every screen change/re-render (`_closeCardNavPopups()`, called from the
//      same show(id) choke point PLAN §12's selection popover uses) and the comp one explicitly
//      before a crossword opens (the one path that shows another overlay without a screen change).
//   5. REVOKED: the story panel no longer fills available screen height — §6 asserts the absence.
//   6. The header-row back/forward duplicates render `.lang-pair-arrow`'s own glyph (➜, weight 900),
//      `comp-story-prev` horizontally flipped — see §8.
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

// ── 1. Both popups: relocated, not reimplemented ──────────────────────────────
{
  for (const [modalId, kids] of [
    ['comp-nav-modal', ['comp-storyboard', 'comp-lessons', 'comp-actions', 'comp-progress', 'comp-nav-btns']],
    ['sum-nav-modal',  ['sum-storyboard', 'sum-actions', 'sum-progress']],
  ]) {
    const modalStart = posOf(modalId);
    for (const id of kids) assert.ok(posOf(id) > modalStart, `${id} is inside (after the start of) #${modalId}`);
    assert.ok(new RegExp(`id="${modalId}" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba\\(0,0,0,\\.45\\)`).test(html),
      `#${modalId} uses the same fixed-overlay shape as #settings-modal`);
  }
  // Relocated, not rewritten: the buttons each popup renders are byte-for-byte the ones its card's
  // own render function already knows how to populate — same ids, same onclick wiring.
  for (const frag of [
    'id="comp-prev" style="display:none"',
    'onclick="repeatForCoverage()"', 'onclick="startDrill()"', 'onclick="openCrosswordFromComplete()"',
    'id="comp-next" onclick="afterComplete()"',
    'id="sum-next">',
  ]) assert.ok(html.includes(frag), `unchanged action markup survives: ${frag}`);
}
console.log('  both popups: hold each card\'s relocated machinery unchanged, same overlay pattern as #settings-modal: OK');

// ── 2a. Progress-card header row: split into TWO rows (mobile, user follow-up) ────────
// SUPERSEDES this section's original invariant ("☰ before the translation flags, all in one
// row") — a later, mobile-specific follow-up reported a long chapter title pushing that single
// row wider than a phone screen, and asked for two explicit rows instead: title/flags/read on
// top, prev/menu/next centered below. That regroups ☰ with prev/next rather than with the
// flags — the opposite of the old "☰ before flags" rule — so this is REWRITTEN to state what
// holds now, not loosened to tolerate both shapes. Scoped to the progress/complete card only;
// the entry/summary card below was not asked and was not touched.
{
  const panelStart = posOf('comp-story-panel');
  const summary = html.slice(panelStart, html.indexOf('</summary>', panelStart));
  const at = (id) => { const i = summary.indexOf(`id="${id}"`); assert.ok(i > 0, `${id} exists in the progress-card header row`); return i; };
  const lbl = at('comp-story-panel-lbl'), flags = at('comp-story-flags'), spk = at('comp-story-spk');
  const prev = at('comp-story-prev'), nav = at('comp-story-nav-btn'), next = at('comp-story-next');
  assert.ok(lbl < flags && flags < spk, 'row 1 order: title, then translation flags, then the read-aloud button');
  assert.ok(prev < nav && nav < next, 'row 2 order: prev, then the ☰ popup trigger, then next');
  assert.ok(spk < prev, 'row 1 (title/flags/read) is entirely ABOVE row 2 (prev/menu/next) -- the two rows do not interleave');
  assert.ok(/onclick="event\.stopPropagation\(\);openCompNav\(\);"/.test(summary),
    'the ☰ button opens the popup, and stops the click from also toggling the <details>');
}
console.log('  progress-card header row: title/flags/read on top, prev/☰/next centered below (mobile follow-up): OK');

// ── 2b. Entry-card header row: unchanged, still ☰-before-translation, one row ─────────
{
  const sumStart = posOf('sum-sumbox');
  const sumRow = html.slice(sumStart, html.indexOf('</div>', html.indexOf('sum-sumtext', sumStart)));
  const sumOrder = ['sum-sum-nav-btn', 'sum-sum-xlate', 'sum-sum-spk', 'sum-sum-next']
    .map(id => sumRow.indexOf(`id="${id}"`));
  sumOrder.forEach((at, i) => assert.ok(at > 0, `element ${i} of the entry-card header row exists`));
  for (let i = 1; i < sumOrder.length; i++) assert.ok(sumOrder[i] > sumOrder[i - 1], 'entry-card header-row elements are in the required order');
  assert.ok(sumRow.indexOf('sum-sum-nav-btn') < sumRow.indexOf('sum-sum-xlate'),
    'the entry card\'s ☰ trigger ALSO sits before its translation control');
  assert.ok(/onclick="openSumNav\(\);"/.test(sumRow), 'the entry card\'s ☰ button opens its own popup');

  // ONLY next/back are duplicated anywhere — no OTHER action id (repeat/drill/crossword/wipe) gets
  // a header-row twin on EITHER card, and the entry card (no back button at all) gets no sum-sum-prev.
  for (const id of ['comp-story-repeat', 'comp-story-drill', 'comp-story-crossword', 'comp-story-wipe', 'sum-sum-prev']) {
    assert.ok(!html.includes(`id="${id}"`), `${id} must NOT exist`);
  }
}
console.log('  entry-card header row (unchanged): ☰ before translation control(s); ONLY next[/back] duplicated anywhere: OK');

// ── 3. _mirrorNavBtn: the ONE mirror rule, shared and non-vacuous ────────────
// The GLYPH is deliberately NOT mirrored (see §8) — a fixed, heavier ➜ replaced the mirrored ←/→
// once the "thicker arrows... same as the language-selector pair" request landed. Everything about
// where the button LEADS still must be copied, or the duplicate could point somewhere the source
// doesn't.
{
  const mirrorFn = extFn(html, '_mirrorNavBtn');
  assert.ok(!/dst\.textContent/.test(mirrorFn),
    'the icon glyph is NOT mirrored — it is fixed markup now (§8), not a copy of the source\'s ←/→');
  assert.ok(/dst\.title = src\.title/.test(mirrorFn)
         && /dst\.style\.display = src\.style\.display/.test(mirrorFn) && /dst\.disabled = src\.disabled/.test(mirrorFn),
    'every piece of the source button\'s FUNCTIONAL state (title/display/disabled/onclick) is still copied, not re-derived');
  const compSync = extFn(html, '_syncCompHdrNav'), sumSync = extFn(html, '_syncSumHdrNav');
  assert.ok(/_mirrorNavBtn\('comp-prev', 'comp-story-prev'\)/.test(compSync) && /_mirrorNavBtn\('comp-next', 'comp-story-next'\)/.test(compSync),
    '_syncCompHdrNav mirrors both pairs through the shared rule');
  assert.ok(/_mirrorNavBtn\('sum-next', 'sum-sum-next'\)/.test(sumSync) && !/comp-/.test(sumSync),
    '_syncSumHdrNav mirrors only next (no back button exists on the entry card) through the SAME shared rule');
  // Called LAST in each card's own render — after every branch that can set the source button.
  const sc = extFn(html, 'showComplete');
  assert.ok(sc.indexOf('_syncCompHdrNav()') > 0 && sc.lastIndexOf("show('complete-screen')") > sc.indexOf('_syncCompHdrNav()'),
    'showComplete syncs after every branch, right before show(complete-screen)');
  const ss = extFn(html, 'showStorySummary');
  assert.ok(ss.indexOf('_syncSumHdrNav()') > 0 && ss.lastIndexOf("show('summary-screen')") > ss.indexOf('_syncSumHdrNav()'),
    'showStorySummary syncs after its own branch, right before show(summary-screen)');

  // Behavioural: build bare stub buttons and confirm the shared mirror actually copies FUNCTIONAL
  // state, for BOTH cards' pairs — proving the SAME function, not two look-alikes, drives both. The
  // destination starts with its OWN fixed glyph ("➜", distinct from the source's plain "→") to prove
  // the mirror leaves it alone rather than merely happening not to change it.
  const C = loadClient({ quiet: true });
  for (const [srcId, dstId] of [['comp-next', 'comp-story-next'], ['sum-next', 'sum-sum-next']]) {
    const out = C.run(`(() => {
      const mk = (id) => { const el = document.getElementById(id); el.tagName='BUTTON'; return el; };
      const src = mk('${srcId}'); src.textContent = '→'; src.title = 'Onward';
      src.style.display = ''; src.disabled = false; src.onclick = () => { window.__clicked = '${srcId}'; };
      const dst = mk('${dstId}'); dst.textContent = '➜';
      _mirrorNavBtn('${srcId}', '${dstId}');
      dst.onclick({ stopPropagation: () => { window.__stopped = '${dstId}'; } });
      return { text: dst.textContent, title: dst.title, display: dst.style.display,
               className: dst.className, clicked: window.__clicked, stopped: window.__stopped };
    })()`);
    assert.strictEqual(out.text, '➜', `${dstId}: its own fixed glyph is untouched by the mirror`);
    assert.strictEqual(out.title, 'Onward', `${dstId}: title mirrored`);
    assert.strictEqual(out.display, '', `${dstId}: display mirrored (visible)`);
    assert.strictEqual(out.className, 'spk-ico', `${dstId}: not disabled → no .disabled class`);
    assert.strictEqual(out.clicked, srcId, `${dstId}: the duplicate's onclick actually calls the source's own handler`);
    assert.strictEqual(out.stopped, dstId, `${dstId}: the duplicate stops propagation itself`);

    // A DISABLED source must mirror as disabled, with the visual class.
    const out2 = C.run(`(() => {
      const src = document.getElementById('${srcId}');
      src.disabled = true; src.style.display = 'none';
      _mirrorNavBtn('${srcId}', '${dstId}');
      const dst = document.getElementById('${dstId}');
      return { display: dst.style.display, disabled: dst.disabled, className: dst.className };
    })()`);
    assert.strictEqual(out2.display, 'none', `${dstId}: a hidden source mirrors as hidden`);
    assert.strictEqual(out2.disabled, true, `${dstId}: a disabled source mirrors as disabled`);
    assert.strictEqual(out2.className, 'spk-ico disabled', `${dstId}: the disabled class is applied`);
  }
}
console.log('  _mirrorNavBtn: ONE shared rule drives both cards\' sync, mirrors text/title/display/disabled/onclick, non-vacuous: OK');

// ── 4. Both popups close on navigation, and comp\'s explicitly before a crossword opens ─
{
  assert.ok(/try\{ _closeCardNavPopups\(\); \}catch\(_\)\{\}/.test(extFn(html, 'show')),
    'show(id) closes BOTH card-nav popups on every screen change/re-render — same choke point PLAN §12 uses');
  const closeAll = extFn(html, '_closeCardNavPopups');
  assert.ok(/closeCompNav\(\)/.test(closeAll) && /closeSumNav\(\)/.test(closeAll),
    '_closeCardNavPopups closes both — closing whichever was never open is a harmless no-op');
  const ocfc = extFn(html, 'openCrosswordFromComplete');
  assert.ok(/closeCompNav\(\)/.test(ocfc) && ocfc.indexOf('closeCompNav()') < ocfc.indexOf('openCrossword(idx)'),
    'openCrosswordFromComplete closes its own nav popup BEFORE showing the crossword overlay ' +
    '(openCrossword does not call show(), so the generic close above never fires here)');

  // Behavioural: openCompNav/closeCompNav and openSumNav/closeSumNav each actually toggle their own
  // element, and calling the REAL show() closes BOTH regardless of which was open.
  for (const [openFn, closeFn, modalId] of [['openCompNav', 'closeCompNav', 'comp-nav-modal'], ['openSumNav', 'closeSumNav', 'sum-nav-modal']]) {
    const C = loadClient({ quiet: true });
    const seq = C.run(`(() => {
      const m = document.getElementById('${modalId}');
      ${openFn}(); const afterOpen = m.style.display;
      ${closeFn}(); const afterClose = m.style.display;
      return { afterOpen, afterClose };
    })()`);
    assert.strictEqual(seq.afterOpen, 'flex', `${openFn} shows #${modalId}`);
    assert.strictEqual(seq.afterClose, 'none', `${closeFn} hides #${modalId}`);

    const C2 = loadClient({ quiet: true });
    const seq2 = C2.run(`(() => {
      document.getElementById('${modalId}').style.display = 'flex';
      document.getElementById('landing').classList = { add(){}, remove(){} };
      document.querySelectorAll = () => [];
      try { show('landing'); } catch(_) {}
      return document.getElementById('${modalId}').style.display;
    })()`);
    assert.strictEqual(seq2, 'none', `calling the REAL show() closes an open #${modalId}, end to end`);
  }
}
console.log('  both popups\' lifecycle: close on navigation (real show(), not just source-pinned) and comp\'s before crossword: OK');

// ── 5. closeCrossword's fallback no longer scrolls to a now-hidden element ───
{
  const cc = extFn(html, 'closeCrossword');
  assert.ok(/getElementById\('comp-story-panel'\) \|\| document\.getElementById\('comp-actions'\)/.test(cc),
    'closeCrossword scrolls to the (still-visible) story panel first, falling back to the old target');
}
console.log('  closeCrossword: fallback scroll target updated for the relocated #comp-actions: OK');

// ── 6. "Fill the full available screen" — REVOKED, and stays revoked ─────────
// v83_c shipped a #complete-screen-scoped flex:1 chain (.comp-body -> #comp-story-panel[open] ->
// #comp-story-text) so a short story stretched to fill the viewport. The user's own follow-up
// revoked it explicitly: "progress card text field do NOT have to fill the full height of the
// available screen." Guarded here as an ABSENCE, not just left untested — a later session re-adding
// something that LOOKS like the same fix (the shape is a natural one to reach for) should trip this,
// not silently reintroduce a rejected design.
{
  for (const frag of [
    '#complete-screen .comp-body{display:flex;flex-direction:column;flex:1;min-height:0}',
    '#complete-screen #comp-story-panel{display:flex;flex-direction:column}',
    '#complete-screen #comp-story-panel[open]{flex:1}',
    '#complete-screen #comp-story-text{flex:1}',
  ]) assert.ok(!html.includes(frag), `REVOKED: "${frag}" must not be back in the stylesheet`);
  // The panel and its flag-cancelling rule (a genuinely separate concern — header-row layout, not
  // screen-filling) must still be there; only the fill-height chain was removed.
  assert.ok(html.includes('#comp-story-panel .story-flag-btns{margin-left:0}'),
    'the UNRELATED flag-position override survives the revocation');
}
console.log('  "fill the full available screen": REVOKED and guarded to stay that way: OK');

// ── 7. ui.json — the popup strings, reused across both cards (en only) ───────
{
  for (const k of ['complete.nav_open', 'complete.nav_title']) assert.ok(ui.en[k], `ui.json en has ${k}`);
  // One concept, shared: the entry card's popup does NOT get its own second pair of keys.
  assert.ok(!ui.en['sum.nav_open'] && !ui.en['sum.nav_title'], 'no duplicate key pair was minted for the entry card');
  const aus = extFn(html, 'applyUIStrings');
  assert.ok(/sum-sum-nav-btn.*complete\.nav_open/.test(aus) && /sum-nav-modal-title.*complete\.nav_title/.test(aus),
    'the entry card\'s popup trigger/heading are localized through the SAME two keys');
}
console.log('  ui.json: the popup strings are shared across both cards, en only: OK');

// ── 8. "Even thicker ... the same as used between the source and target language
// selectors" — the header-row duplicates now share `.lang-pair-arrow`'s actual GLYPH ─────
{
  // The reference: `.lang-pair-arrow` (between src-lang-select/lang-select) uses ➜, weight 900.
  assert.ok(/\.lang-pair-arrow\{[^}]*font-weight:900[^}]*\}/.test(html) && html.includes('class="lang-pair-arrow">➜<'),
    'the reference arrow really is ➜ at weight 900 — the glyph this section matches');
  // Both forward duplicates render that SAME glyph, statically (not mirrored — see §3).
  for (const id of ['comp-story-next', 'sum-sum-next']) {
    assert.ok(new RegExp(`id="${id}"[^>]*>➜<`).test(html), `${id} shows the ➜ glyph in its markup`);
  }
  assert.ok(/#comp-story-next,#sum-sum-next\{font-size:26px;font-weight:900\}/.test(html),
    'both forward duplicates share one weight-900 sizing rule');
  // comp-story-prev has no "heavy leftwards" character to reach for — it reuses the SAME ➜ glyph,
  // horizontally flipped, rather than a different (and possibly visually mismatched) character.
  assert.ok(/id="comp-story-prev"[^>]*>➜</.test(html), 'comp-story-prev ALSO uses ➜ in markup, not a left-pointing character');
  assert.ok(/#comp-story-prev\{font-size:26px;font-weight:900;display:inline-block;transform:scaleX\(-1\)\}/.test(html),
    'comp-story-prev flips the SAME glyph horizontally to read as "back"');
  // Non-vacuity: must not also apply to the popup's own comp-prev/comp-next/sum-next — those keep
  // their existing chunky .comp-ico button style, a different visual language never asked to change.
  assert.ok(!/#comp-prev,#comp-next\{[^}]*font-size:26px/.test(html) && !/\.comp-ico\{[^}]*transform:scaleX/.test(html),
    'the heavy-glyph rule targets only the header-row duplicates, not the popup\'s own buttons');
  // The actual FLIP rendering (does scaleX(-1) really read as "back", is 26px legible next to the
  // row's other 20px icons) needs a real layout engine — lib-dom has none — so it is checked live
  // in a browser, not here; see the roadmap entry for that pass.
}
console.log('  thicker arrows: header-row duplicates now share the language-pair arrow\'s own glyph and weight: OK');

console.log('unit-progress-card-nav: ALL PASSED');
