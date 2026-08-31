// v71_u — REPLACED. This file used to test the arc-mode <option> translation block in
// applyUIStrings by re-implementing that block inline against a fake DOM. When the two-option
// <select>s were removed in v71_u, it kept passing: it was exercising its own copy of the code,
// not the app's. A test that cannot fail when the feature is deleted is not a test.
//
// It now drives the REAL renderer and asserts the markup it produces.
//
// v73_c — THE HARNESS LIMIT IS GONE. lib-dom now parses innerHTML, so the read-back path
// (readArcTypeChecks → readLessonTypeChecks → .checked) runs headlessly and this file drives it.
//
// Two things the old note got wrong, worth recording because both are the same shape:
//   • It said the read-back was "covered structurally in unit-arc-reinforce-types". It was not.
//     That file asserted the CALL EXISTS IN THE SOURCE (`/renderLessonTypeChecks\(c, \{ cls: …/`),
//     which is a claim about spelling, not behaviour. Each file pointed at the other and neither
//     executed the path — so `readLessonTypeChecks` had no coverage at all while appearing to have
//     some from both directions.
//   • It put the read-back on the owed BROWSER-PASS list as unverifiable here. It was verifiable
//     the moment the harness could parse markup; the limit was in the harness, not in the feature.
//
// Values and ticks are now read off parsed nodes rather than matched out of the markup string,
// which also removes a quiet fragility: the old `checkedValues` regex required `checked` to follow
// `value="…"` with exactly one space run, so reordering the attributes would have silently returned
// an empty list and passed the "default is ['review']" assertion only by luck of emission order.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

const htmlOf = (id) => C.run(`(document.getElementById(${JSON.stringify(id)}) || {}).innerHTML || ''`);
const reset  = (id) => C.run(`(() => { const c = document.getElementById(${JSON.stringify(id)});
  if (c) { c.dataset.rendered = ''; c.innerHTML = ''; } return !!c; })()`);
// v73_c: read the real checkboxes. `boxes` deliberately queries by the CLASS the product's own
// reader uses, so a class rename fails here as well as breaking the app.
const boxes = (id) => C.document.getElementById(id).querySelectorAll('.arc-lt-check');
const values = (id) => boxes(id).map(b => b.value);
const checkedValues = (id) => boxes(id).filter(b => b.checked).map(b => b.value);

// ── 1. The container exists in the shipped markup ──────────────────────────
// Not created by the test: if the form loses its container, the picker silently renders nowhere and
// the arc falls back to the server's legacy default.
//
// ⚠️ THIS CHECK WAS VACUOUS and is fixed here, found at item AL part 2 (roadmap_v87.md). It used to
// run `!!document.getElementById(id)` through the DOM harness for BOTH 'gen-arc-types' and
// 'gen-arc-types' — and lib-dom's makeDocument() AUTO-VIVIFIES every id asked for (`getElementById`
// mints a div on a miss, deliberately, see its own comment). So it could never fail: it stayed GREEN
// through the release that DELETED #pdf-arc-types from index.html entirely, which is exactly the
// silent-render-nowhere failure it was written to catch. Asserted against the SOURCE now, where the
// claim is real. (item AL part 2 also made this one container instead of two: #pdf-arc-types and
// #comic-arc-types were deleted, and all three input modes read the wizard's #gen-arc-types.)
const arcHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(arcHtml.includes('id="gen-arc-types"'), '#gen-arc-types is present in index.html');
assert.ok(!arcHtml.includes('id="pdf-arc-types"') && !arcHtml.includes('id="comic-arc-types"'),
  'and the deleted per-panel copies have not come back (item AL part 2: one tick-list, three modes)');

// ── 2. It renders every offered type, with the documented default ──────────
{
  reset('gen-arc-types');
  C.run(`renderArcTypeChecks('gen-arc-types')`);
  const vals = values('gen-arc-types');
  assert.ok(vals.length >= 8, `every offered lesson type gets a checkbox (${vals.length}: ${vals.join(',')})`);
  assert.ok(vals.includes('comprehension'),
    'including comprehension — added in v71_l and, before v71_u, unreachable from a book at all');
  assert.deepStrictEqual(checkedValues('gen-arc-types'), ['review'],
    "the default tick is the old 'vocab' arc — one review lesson — so an untouched form behaves as before");
  // The class is asserted by `boxes()` finding anything at all — it queries by that exact class.
  // Read through the PRODUCT's reader too, so renderer and reader are proven to agree.
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(readArcTypeChecks('gen-arc-types'))`)), ['review'],
    'and the form\'s own reader returns that same default');
  console.log(`  render: ${vals.length} types, default ticked ${JSON.stringify(checkedValues('gen-arc-types'))}`);
}

// ── 3. A populated picker is not re-rendered ───────────────────────────────
// The forms call renderArcTypeChecks every time they become visible (the chapter slider moves, the
// PDF stepper redraws), so a render that rebuilt the list would quietly discard the user's ticks.
{
  const before = htmlOf('gen-arc-types');
  const SENTINEL = '<!--the user\'s ticks live here-->';
  C.run(`document.getElementById('gen-arc-types').innerHTML = ${JSON.stringify(SENTINEL)}; true;`);
  C.run(`renderArcTypeChecks('gen-arc-types')`);          // the forms do this repeatedly
  assert.strictEqual(htmlOf('gen-arc-types'), SENTINEL,
    're-rendering a populated picker leaves its contents untouched');
  assert.notStrictEqual(SENTINEL, before, '(the sentinel really did differ from a fresh render)');
}

// ── 4. Explicit `checked` overrides the default ────────────────────────────
// This is the path the language-change handler uses to restore a user's ticks.
{
  reset('gen-arc-types');
  C.run(`renderArcTypeChecks('gen-arc-types', { checked: ['synonyms','math'] })`);
  assert.deepStrictEqual(checkedValues('gen-arc-types'), ['synonyms', 'math'],
    'a supplied selection is what gets ticked');
}

// ── 5. A language change relabels without losing the selection ─────────────
// What replaced the old <option> translation block — and the case that block could not have, since
// the labels now sit inside checkboxes the user has interacted with.
if (UI.de) {
  const before = htmlOf('gen-arc-types');
  const enLabel = (before.match(/<span>[^<]*<\/span>/) || [''])[0];
  C.run(`UI_STRINGS = ${JSON.stringify(UI.de)};
    ['gen-arc-types'].forEach(id => {
      const c = document.getElementById(id);
      if (!c || c.dataset.rendered !== '1') return;
      const keep = readArcTypeChecks(id);   // v73_c: the REAL reader, no longer a hardcoded stand-in
      c.dataset.rendered = '';
      renderArcTypeChecks(id, { checked: keep });
    }); true;`, 'relabel');
  const after = htmlOf('gen-arc-types');
  assert.deepStrictEqual(checkedValues('gen-arc-types'), ['synonyms', 'math'],
    'the selection survives a language change — carried by readArcTypeChecks, not by a test constant');
  const deLabel = (after.match(/<span>[^<]*<\/span>/) || [''])[0];
  assert.notStrictEqual(deLabel, enLabel, 'and the labels followed the new language');
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; true;`);
  console.log(`  language change: selection kept, labels relabelled (${enLabel} → ${deLabel})`);
} else {
  console.log('  (ui.json has no de — language-change case skipped)');
}

console.log('unit-arc-options: ALL PASSED');
