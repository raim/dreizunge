// v71_u — REPLACED. This file used to test the arc-mode <option> translation block in
// applyUIStrings by re-implementing that block inline against a fake DOM. When the two-option
// <select>s were removed in v71_u, it kept passing: it was exercising its own copy of the code,
// not the app's. A test that cannot fail when the feature is deleted is not a test.
//
// It now drives the REAL renderer and asserts the markup it produces.
//
// HARNESS LIMIT, stated rather than worked around: lib-dom's querySelectorAll matches TAG names
// over the tree parsed from index.html, and does not parse innerHTML assigned at runtime. Since
// renderLessonTypeChecks builds its checkboxes by setting innerHTML, the read-back path
// (readArcTypeChecks → readLessonTypeChecks → .checked) is NOT reachable from this harness. What
// is asserted here is everything up to that boundary: which inputs are emitted, which carry
// `checked`, and that a language change relabels them. The read-back is covered structurally in
// unit-arc-reinforce-types (both forms call it) and needs a browser to exercise for real — it is
// on the owed browser-pass list.
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
const values = (h) => [...h.matchAll(/value="([a-z_]+)"/g)].map(m => m[1]);
const checkedValues = (h) => [...h.matchAll(/value="([a-z_]+)"\s+checked/g)].map(m => m[1]);

// ── 1. Both containers exist in the shipped markup ─────────────────────────
// Not created by the test: if a form loses its container, the picker silently renders nowhere and
// the arc falls back to the server's legacy default.
for (const id of ['pdf-arc-types', 'gen-arc-types']) {
  assert.strictEqual(C.run(`!!document.getElementById(${JSON.stringify(id)})`), true,
    `${id} is present in index.html`);
}

// ── 2. It renders every offered type, with the documented default ──────────
{
  reset('gen-arc-types');
  C.run(`renderArcTypeChecks('gen-arc-types')`);
  const h = htmlOf('gen-arc-types');
  const vals = values(h);
  assert.ok(vals.length >= 8, `every offered lesson type gets a checkbox (${vals.length}: ${vals.join(',')})`);
  assert.ok(vals.includes('comprehension'),
    'including comprehension — added in v71_l and, before v71_u, unreachable from a book at all');
  assert.deepStrictEqual(checkedValues(h), ['review'],
    "the default tick is the old 'vocab' arc — one review lesson — so an untouched form behaves as before");
  assert.ok(/class="arc-lt-check"/.test(h), 'the checkboxes carry the class the reader looks for');
  console.log(`  render: ${vals.length} types, default ticked ${JSON.stringify(checkedValues(h))}`);
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
  reset('pdf-arc-types');
  C.run(`renderArcTypeChecks('pdf-arc-types', { checked: ['synonyms','math'] })`);
  assert.deepStrictEqual(checkedValues(htmlOf('pdf-arc-types')), ['synonyms', 'math'],
    'a supplied selection is what gets ticked');
}

// ── 5. A language change relabels without losing the selection ─────────────
// What replaced the old <option> translation block — and the case that block could not have, since
// the labels now sit inside checkboxes the user has interacted with.
if (UI.de) {
  const before = htmlOf('pdf-arc-types');
  const enLabel = (before.match(/<span>[^<]*<\/span>/) || [''])[0];
  C.run(`UI_STRINGS = ${JSON.stringify(UI.de)};
    ['pdf-arc-types','gen-arc-types'].forEach(id => {
      const c = document.getElementById(id);
      if (!c || c.dataset.rendered !== '1') return;
      const keep = ${JSON.stringify(['synonyms', 'math'])};   // stands in for readArcTypeChecks (see harness note)
      c.dataset.rendered = '';
      renderArcTypeChecks(id, { checked: keep });
    }); true;`, 'relabel');
  const after = htmlOf('pdf-arc-types');
  assert.deepStrictEqual(checkedValues(after), ['synonyms', 'math'],
    'the selection survives a language change');
  const deLabel = (after.match(/<span>[^<]*<\/span>/) || [''])[0];
  assert.notStrictEqual(deLabel, enLabel, 'and the labels followed the new language');
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; true;`);
  console.log(`  language change: selection kept, labels relabelled (${enLabel} → ${deLabel})`);
} else {
  console.log('  (ui.json has no de — language-change case skipped)');
}

console.log('unit-arc-options: ALL PASSED');
