// unit-bottom-bar-model.test.js
// v90_w — the model selector lives in the bottom bar as a ✨ circle, and the bar is reordered.
//
// ⚠️ USER REQUEST: "move the model selector from the generation wizard into the bottom row settings
// bar, using the ✨ icon on a circle (it doesn't need to name the model), and reorder this bottom
// settings bar: un/collapse button, user, settings, new ✨ model selector on the left, and the
// microphone, mute button, and tutor button on the right side."
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const flat = client.replace(/\s+/g, ' ');
const at = id => client.indexOf(`id="${id}"`);

// ── 1. The two groups, and the order within each ─────────────────────────────
{
  for (const id of ['corner-pills', 'corner-pills-right']) assert.ok(at(id) > 0, `#${id} exists`);
  const L = ['acct-badge', 'settings-pill', 'bpill-wrap', 'jobs-fab'];
  const R = ['speech-mic-wrap', 'mute-pill', 'tutor-fab'];
  for (const g of [L, R]) for (let i = 0; i + 1 < g.length; i++)
    assert.ok(at(g[i]) < at(g[i + 1]), `${g[i]} comes before ${g[i + 1]}`);
  assert.ok(at('corner-pills') < at('jobs-fab') && at('jobs-fab') < at('corner-pills-right'),
    'the whole left group precedes the right group');
  // ⚠️ MUTE MOVED SIDES. It used to sit in the left group; the user asked for it on the right,
  // beside the mic and the tutor.
  assert.ok(at('mute-pill') > at('corner-pills-right'),
    'mute is INSIDE the right-hand group now, not in the left pills');
  console.log('  left: user · settings · ✨ model · jobs   right: mic · mute · tutor: OK');
}

// ── 2. ⚠️ THE COLLAPSE BUTTON STAYS OUTSIDE THE BAR'S GROUPS ─────────────────
// The user caught this himself, and the markup already said so: a control that hides the bar cannot
// live inside the thing it hides, or there is no way to bring it back.
{
  assert.ok(at('bottom-bar-toggle') < at('bottom-bar'),
    '#bottom-bar-toggle is a sibling BEFORE #bottom-bar, not a child of it');
  assert.ok(at('bottom-bar-toggle') < at('corner-pills'),
    'and certainly not inside #corner-pills — it would disappear along with the bar it hides');
  console.log('  the collapse button is still outside the bar it collapses: OK');
}

// ── 3. The selector was MOVED, not rebuilt ───────────────────────────────────
// Rebuilding would have meant re-testing renderPill/renderModelPicker and every switch handler.
{
  assert.strictEqual((client.match(/id="bpill-wrap"/g) || []).length, 1, 'exactly one #bpill-wrap');
  assert.strictEqual((client.match(/id="bmodels-pop"/g) || []).length, 1, 'and one popover');
  assert.ok(at('bpill-wrap') > at('corner-pills') && at('bpill-wrap') < at('corner-pills-right'),
    'it now sits inside the left pill group');
  assert.ok(/function renderPill\(\)/.test(client) && /async function renderModelPicker\(\)/.test(client),
    'both drivers still exist, unrenamed');
  console.log('  #bpill-wrap moved wholesale, drivers untouched: OK');
}

// ── 4. A ✨ circle that does NOT name the model ──────────────────────────────
{
  assert.ok(/#corner-pills #bpill\{[^}]*border-radius:50%/.test(flat), 'it is a circle in the bar');
  // ⚠️ Tested against `flat` WITHOUT stripping spaces — the first draft did `flat.replace(/ /g,'')`
  // and broke its own descendant selectors ("#corner-pills #blbl" became "#corner-pills#blbl"),
  // failing on correct CSS. A guard that normalises away the thing it is matching cannot pass.
  assert.ok(/#corner-pills #bpill::before\{content:'\\2728'\}/.test(flat), 'showing ✨');
  assert.ok(/#corner-pills #blbl,#corner-pills #bpill-caret,#corner-pills \.bdot\{display:none\}/.test(flat),
    'with the model NAME, the caret and the dot hidden — the user asked for no name');
  // ⚠️ The pill is the only at-a-glance offline signal, so the state classes must still colour it.
  assert.ok(/\.bpill\.ollama\{[^}]*border-color:var\(--green\)/.test(flat) &&
            /\.bpill\.none\{[^}]*border-color:var\(--red\)/.test(flat),
    'the backend state still colours the pill — hiding .bdot must not cost the offline signal');
  console.log('  a ✨ circle, no model name, backend state still visible as colour: OK');
}

// ── 5. ⚠️ THE POPOVER OPENS UPWARD ───────────────────────────────────────────
// Anchored below a pill sitting on the bottom edge, it would render off-screen. Verified live too:
// with the pill at y≈674 in a 720px viewport the popover lands at top 640 / bottom 664.
{
  assert.ok(/#corner-pills \.bmodels-pop\{top:auto;bottom:calc\(100% \+ 10px\);left:0\}/.test(flat),
    'the popover is re-anchored to open upward from the bar');
  assert.ok(/\.bmodels-pop\{position:absolute;top:calc\(100% \+ 6px\)/.test(flat),
    'while the ORIGINAL downward rule is untouched, so the element still works anywhere else');
  console.log('  the popover opens upward from the bar, base rule unchanged: OK');
}

// ── 6. The wizard's now-empty backend row is hidden, not deleted ─────────────
{
  assert.ok(/<div class="backend-row" style="display:none">/.test(flat),
    'the row is hidden');
  assert.ok(at('backend-lbl') > 0, '#backend-lbl still exists (applyUIStrings writes it)');
  assert.ok(at('bmodel') > 0, 'and #bmodel too (renderPill writes it) — hidden, not removed');
  console.log('  the wizard backend row is hidden with its writers intact: OK');
}

// ── 7. ⚠️ THE TOOLTIP IS SYNCED ON HOVER, DELIBERATELY ──────────────────────
// The name only reaches the user as a tooltip now. Chasing the init interleaving was a dead end —
// renderPill demonstrably ran to completion at load (its tail disables #gen-btn and shows
// #offline-note, both observed) and the title was STILL empty while #blbl already read
// "Offline — saved lessons only". A tooltip is read at hover and at no other time, so syncing there
// is correct by construction instead of depending on an init order that could change again.
{
  assert.ok(/function _syncPillTitle\(\)/.test(client), 'the sync helper is named');
  assert.ok(/id="bpill"[^>]*onmouseenter="_syncPillTitle\(\)"/.test(flat),
    'and runs on hover, which is the only moment the tooltip can be read');
  assert.ok(/id="bpill"[^>]*onfocus="_syncPillTitle\(\)"/.test(flat), 'and on focus, for the keyboard');
  const rp = client.slice(client.indexOf('function renderPill()'));
  assert.ok(/_syncPillTitle\(\);/.test(rp.slice(0, rp.indexOf('\n}'))),
    'renderPill still syncs it too, so a hover is not required for it to be right');
  console.log('  the tooltip is synced on hover, not left to init ordering: OK');
}

console.log('unit-bottom-bar-model: ALL PASSED');
