// unit-summary-edit-cancel.test.js
// v79_c (user): "when i edit the summary, the ✕ Cancel button should close the editing interface."
//
// The cause was NOT the button. There are TWO summary panels with different ids, and both are in
// the DOM at once once the library list has rendered:
//
//   library card    `slsc-summary-body-<chainId>`             (index.html ~5852, build-static ~594)
//   storyline page  `slsc-sum-<chainId with non-alnum → _>`   (index.html ~7945)
//
// `openSummaryEdit` resolves the panel from an explicit `bodyId` when the caller passes one — the
// storyline page does, the library card does not. `cancelSummaryEdit` did not receive that, and
// re-derived the panel by trying the two ids in a FIXED ORDER that always preferred the library
// card's. So cancelling on the storyline page rewrote the library card (invisibly, on another
// screen) and left the editor open where the user was looking.
//
// This is standing rule 14 — identity must be CARRIED through, never recovered by hashing or
// guessing at it — in its fourth instance (v75_f, v76_e, v76_e's projection). `saveSummaryEdit`
// happened to get it right via the textarea's parent, which is exactly why Save closed the editor
// and Cancel did not: two paths, two different ways of answering "which panel is this?".
//
// Asserted by driving the product functions and reading the DOM, not by matching source: the old
// code and the new code differ only in WHICH element they write to, and a source regex cannot see
// that. Run against index.html AND docs/index.html — build-static.js emits the library-card panel
// itself, so the two builds have to agree about the ids (rule 15).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const CHAIN = 'sl_cancel_test';
const ORIGINAL = 'The original storyline summary.';
// A sentinel the library card is seeded with. If Cancel touches the wrong panel this disappears,
// which is the half of the bug the user could not see.
const OTHER_PANEL = '<p>LIBRARY-CARD-UNTOUCHED</p>';

function open(file) {
  const C = loadClient(file ? { quiet: true, file } : { quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.storylines = [{ id: ${JSON.stringify(CHAIN)}, summary: ${JSON.stringify(ORIGINAL)} }];
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP._slScreen = { chainId: ${JSON.stringify(CHAIN)} };
    APP._teacherMode = true;
    showToast = function(m){ APP._toast = m; };
    // Both panels exist, as they do in the browser: the library list has rendered underneath the
    // storyline page. Seeded through getElementById so the stubs persist (harness contract).
    document.getElementById('slsc-summary-body-' + ${JSON.stringify(CHAIN)}).innerHTML =
      ${JSON.stringify(OTHER_PANEL)};
    document.getElementById('slsc-sum-' + ${JSON.stringify(CHAIN)}).innerHTML =
      '<p>' + ${JSON.stringify(ORIGINAL)} + '</p>';
    true;`, 'seed-dom');
  return C;
}
const html = (C, id) => C.run(`document.getElementById(${JSON.stringify(id)}).innerHTML || ''`);
const LIB = 'slsc-summary-body-' + CHAIN;
// The storyline page sanitizes non-alphanumerics; this chain id has an underscore, which IS
// replaced — so the two ids are genuinely different strings and the test is not accidentally
// pointing both lookups at one element.
const PAGE = 'slsc-sum-' + CHAIN.replace(/[^a-zA-Z0-9]/g, '_');
assert.notStrictEqual(LIB, PAGE, 'non-vacuity: the two panels really do have different ids');

for (const [label, file] of [['index.html', null], ['docs/index.html', 'docs/index.html']]) {
  // ── 1. Opening from the STORYLINE PAGE puts the editor in that panel, not the library card ──
  const C = open(file);
  C.run(`openSummaryEdit(null, ${JSON.stringify(PAGE)}); true;`, 'open');
  assert.ok(/<textarea/.test(html(C, PAGE)),
    `[${label}] the editor opens in the storyline-page panel`);
  assert.ok(/Cancel/.test(html(C, PAGE)),
    `[${label}] non-vacuity: the editor really rendered its Cancel control`);
  assert.strictEqual(html(C, LIB), OTHER_PANEL,
    `[${label}] opening the editor does not disturb the library card's panel`);

  // ── 2. Cancel closes the editor that is open, and restores the saved text ──────────────────
  C.run(`cancelSummaryEdit(${JSON.stringify(CHAIN)}); true;`, 'cancel');
  const after = html(C, PAGE);
  assert.ok(!/<textarea/.test(after),
    `[${label}] Cancel CLOSES the editing interface — this is the reported bug: the textarea `
    + `survived because Cancel restored the other panel (got: ${after.slice(0, 120)})`);
  assert.ok(after.includes(ORIGINAL),
    `[${label}] and puts the existing summary back (got: ${after.slice(0, 120)})`);

  // ── 3. The panel Cancel must NOT touch is still exactly as it was ──────────────────────────
  assert.strictEqual(html(C, LIB), OTHER_PANEL,
    `[${label}] Cancel leaves the library card's panel alone — rewriting it was the other half `
    + 'of the same bug, invisible because it is on a different screen');

  // ── 4. The library card's own editor still cancels (the path that always worked) ───────────
  C.run(`openSummaryEdit(${JSON.stringify(CHAIN)}); true;`, 'open-lib');
  assert.ok(/<textarea/.test(html(C, LIB)),
    `[${label}] opening from the library card edits the library card's panel`);
  C.run(`cancelSummaryEdit(${JSON.stringify(CHAIN)}); true;`, 'cancel-lib');
  assert.ok(!/<textarea/.test(html(C, LIB)) && html(C, LIB).includes(ORIGINAL),
    `[${label}] and Cancel closes it there too`);

  // ── 5. Cancel does not leave a stale editor record behind ──────────────────────────────────
  assert.strictEqual(C.run(`APP._sumEdit === null || APP._sumEdit === undefined`), true,
    `[${label}] the recorded editor is cleared, so a later Cancel cannot restore a dead panel`);

  console.log(`  [${label}] Cancel closes the editor it opened, on both panels: OK`);
}

console.log('unit-summary-edit-cancel: ALL PASSED');
