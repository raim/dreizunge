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

// ── 2a. Progress card: nav row moved BELOW the whole text field (mobile follow-up #2) ────
// SUPERSEDES §2a's own PRIOR rewrite (from the SAME conversation): that pass split one overflowing
// row into two, but still nested prev/☰/next INSIDE <summary> (a second row of it). This follow-up
// asked to move them BELOW the text field entirely — i.e. below the whole collapsible box, not just
// below the title. Deliberately placed OUTSIDE the <details> element (a sibling after it), not
// inside its collapsible BODY either: #comp-story-panel is user-collapsible (its own <summary>
// still toggles on click), so a nav row placed inside the body would vanish whenever a learner
// collapsed the panel — living outside keeps prev/☰/next reachable regardless of collapse state.
{
  const panelStart = posOf('comp-story-panel');
  const detailsEnd = html.indexOf('</details>', panelStart);
  const summary = html.slice(panelStart, html.indexOf('</summary>', panelStart));
  // The header row is now ONLY title/flags/read — no nav trio inside it at all.
  for (const id of ['comp-story-prev', 'comp-story-nav-btn', 'comp-story-play', 'comp-story-next']) {
    assert.ok(!summary.includes(`id="${id}"`), `${id} must NOT be inside the <summary> anymore`);
  }
  const at = (id) => { const i = summary.indexOf(`id="${id}"`); assert.ok(i > 0, `${id} exists in the progress-card header row`); return i; };
  const lbl = at('comp-story-panel-lbl'), flags = at('comp-story-flags'), spk = at('comp-story-spk');
  assert.ok(lbl < flags && flags < spk, 'header row order: title, then translation flags, then the read-aloud button');

  // The nav trio lives in its own row, AFTER </details> — found within the vocab box that always
  // immediately follows it, so this is scoped to the real next sibling, not just "somewhere later".
  const vocabAt = html.indexOf('class="vocab-box"', detailsEnd);
  assert.ok(vocabAt > detailsEnd, 'the vocab box (the panel\'s own next sibling) follows </details>');
  const navRow = html.slice(detailsEnd, vocabAt);
  // v88_r: the gap is asserted STRUCTURALLY — every id it contains, in order — rather than by a
  // character budget. The old `vocabAt - detailsEnd < 400` was a PROXY for "the vocab box really is
  // the next sibling", and it went red the moment the row grew a fourth button, reporting a broken
  // layout against a perfectly good render. That is the FOURTH fixed-size window to fail in the
  // false-positive direction in this line alone (v88_m, v88_n, v88_o, this). The list below is a
  // strictly stronger claim: it pins the membership AND the order, and it fails if anything else
  // ever drifts into the gap.
  const idsInGap = (navRow.match(/id="[a-z0-9-]+"/g) || []).map(x => x.slice(4, -1));
  assert.deepStrictEqual(idsInGap,
    ['comp-story-prev', 'comp-story-nav-btn', 'comp-story-play', 'comp-story-next'],
    'the gap between the story panel and the vocab box is the nav row alone: prev, the ☰ popup '
    + 'trigger, ▶ play, next — in that order and with nothing else in it');
  assert.ok(/onclick="openCompNav\(\);"/.test(navRow), 'the ☰ button opens the popup');
  // No longer inside a <details>/<summary> click-toggle, so stopPropagation is no longer needed —
  // its ABSENCE here is itself a signal the buttons genuinely left the collapsible header.
  assert.ok(!/event\.stopPropagation/.test(navRow), 'the nav row does not carry the now-unneeded stopPropagation guard');
}
console.log('  progress card: header row is title/flags/read only; prev/☰/next moved below the whole text field: OK');

// ── 2b. Entry card: SAME move, mirrored (mobile follow-up #2 explicitly named both cards) ──
{
  const boxStart = posOf('sum-sumbox');
  const boxEnd = html.indexOf('id="sum-title"', boxStart);
  const headerRow = html.slice(boxStart, html.indexOf('id="sum-sumtext"', boxStart));
  for (const id of ['sum-sum-nav-btn', 'sum-sum-next']) {
    assert.ok(!headerRow.includes(`id="${id}"`), `${id} must NOT be inside the entry-card header row anymore`);
  }
  const hAt = (id) => { const i = headerRow.indexOf(`id="${id}"`); assert.ok(i > 0, `${id} exists in the entry-card header row`); return i; };
  const xlate = hAt('sum-sum-xlate'), spk = hAt('sum-sum-spk');
  assert.ok(xlate < spk, 'header row order: translation control, then the read-aloud button');

  const navRow = html.slice(html.indexOf('id="sum-sumtext"', boxStart), boxEnd);
  const nAt = (id) => { const i = navRow.indexOf(`id="${id}"`); assert.ok(i > 0, `${id} exists in the entry card's nav row below the text field`); return i; };
  const nav = nAt('sum-sum-nav-btn'), next = nAt('sum-sum-next');
  assert.ok(nav < next, 'nav-row order: the ☰ popup trigger, then next (no back button — this card has none to duplicate)');
  assert.ok(/onclick="openSumNav\(\);"/.test(navRow), 'the entry card\'s ☰ button opens its own popup');

  // ONLY next/back and (v88_r) ▶ play are duplicated anywhere — no OTHER action id
  // (repeat/drill/crossword/wipe) gets a header-row twin on EITHER card, and the entry card (no back
  // button at all) gets no sum-sum-prev. ▶ earned its duplicate because it is the move the card is
  // ASKING for: leaving it two taps deep while browsing stayed one would invert the card's priority.
  for (const id of ['comp-story-repeat', 'comp-story-drill', 'comp-story-crossword', 'comp-story-wipe', 'sum-sum-prev']) {
    assert.ok(!html.includes(`id="${id}"`), `${id} must NOT exist`);
  }
}
console.log('  entry card: header row is translation/read only; ☰/next moved below the text field too (mirrors the progress card): OK');

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
