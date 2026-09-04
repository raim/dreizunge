// unit-continue-from.test.js — v89_s.
//
// A user's comic chapter, meant to extend a nine-chapter storyline, became its own one-chapter
// storyline instead. Their server log settled where it was lost (`v89_o`): `continuedFrom=-` — the
// CLIENT never sent it. The server was never involved.
//
// The cause is a view/record split. `#continue-select` is a VIEW: `repopulateContinueSelect()`
// rebuilds its whole option list, filtered to the CURRENT language pair, and restores the selection
// only if the chosen option survived. `APP.contPin` is the RECORD — set by the picker's own
// onchange, persisted, restored at boot, cleared when the learner picks "— new story —". Every send
// path read the view.
//
// ⚠️ §5 is the one that matters: it reproduces the loss, then shows the fix holding through it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Two nl→de chapters (the user's real pair) and one it→en, so the language filter has something to
// filter.
const SAVED = [
  { id: 'tp_nl1', topic: 'Der Waldpfad', lang: 'nl', srcLang: 'de' },
  { id: 'tp_nl2', topic: 'Die Enteignungszone', lang: 'nl', srcLang: 'de' },
  { id: 'tp_it1', topic: 'Una storia', lang: 'it', srcLang: 'en' },
];
function open(extra) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.lang = 'nl'; APP.srcLang = 'de';
    APP.contPin = null;
    // HARNESS SHIM, not product behaviour: a real select exposes .options, and
    // repopulateContinueSelect() reads it to decide whether the previous selection survived the
    // rebuild. The DOM stub parses option children correctly (and their .value) but has no options
    // collection, so section 5 — which drives the REAL rebuild — needs this one property.
    // Deliberately a getter over children, so it stays live across the innerHTML the product
    // assigns rather than snapshotting an empty list at fixture time.
    // (No backticks in this comment: it lives inside a template literal, where one would terminate
    // the literal. Standing harness trap, hit three times in this line alone.)
    (function(){ var sel = document.getElementById('continue-select');
      if (!sel.options) Object.defineProperty(sel, 'options', { get: function(){ return this.children; } }); })();
    ${extra || ''}
    true;`, 'open');
  return C;
}
const ref = (C) => C.run(`_continueFromRef()`);
const setSel = (C, v) => C.run(`document.getElementById('continue-select').value = ${JSON.stringify(v)}; true;`);

// ── 1. The shown value wins whenever there is one ──────────────────────────────────────────────
{
  const C = open(`APP.contPin = 'tp_nl2';`);
  setSel(C, 'tp_nl1');
  assert.strictEqual(ref(C), 'tp_nl1',
    'what the learner can SEE selected wins over the pin — the pin is a fallback, never an override');
}
console.log('  the visible selection always wins: OK');

// ── 2. An empty select falls back to the pinned choice ─────────────────────────────────────────
{
  const C = open(`APP.contPin = 'tp_nl1';`);
  setSel(C, '');
  assert.strictEqual(ref(C), 'tp_nl1', 'an empty select falls back to the recorded choice');
}
console.log('  an empty select falls back to the pin: OK');

// ── 3. ⚠️ A cancelled choice is NOT resurrected ────────────────────────────────────────────────
// The property that makes the fallback safe rather than merely sticky: picking "— new story —" runs
// the picker's onchange, which CLEARS the pin. So "no pin" and "no selection" agree.
{
  const C = open(`APP.contPin = 'tp_nl1';`);
  setSel(C, '');
  C.run(`onContinueSelectChange(); true;`);
  assert.strictEqual(C.run(`APP.contPin`), null, 'choosing "— new story —" clears the pin');
  assert.strictEqual(ref(C), null, 'and the send path then sends nothing — a cancelled choice stays cancelled');
}
console.log('  choosing "— new story —" clears the pin, and is not resurrected: OK');

// ── 4. ⚠️ A pin whose chapter is GONE is not used ──────────────────────────────────────────────
// Sending a dangling reference produces the same orphan this fix exists to prevent, only harder to
// see: the server resolves it to no parent and links nothing.
{
  const C = open(`APP.contPin = 'tp_deleted';`);
  setSel(C, '');
  assert.strictEqual(ref(C), null, 'a pin that is no longer in savedList is dropped, not sent');
  // Non-vacuity: the same pin IS used once the chapter is present.
  C.run(`APP.savedList = APP.savedList.concat([{ id:'tp_deleted', topic:'Back again', lang:'nl', srcLang:'de' }]); true;`);
  assert.strictEqual(ref(C), 'tp_deleted', 'and is used again as soon as the chapter exists');
}
console.log('  a pin whose chapter was deleted is dropped rather than sent as a dangling ref: OK');

// ── 5. ⚠️ THE LOSS, and the fix holding through it ────────────────────────────────────────────
// ⚠️ MEASURED IN A REAL BROWSER, because the harness cannot model this: a real <select> CLEARS its
// value on ANY innerHTML rebuild — verified directly, and it clears even when the matching option
// survives the rebuild. The DOM stub does not: its `value` is a plain property that innerHTML never
// touches. So the reset is applied EXPLICITLY below, standing in for browser behaviour the stub
// lacks. The point of this section is what the SEND PATH does after a reset, not the reset itself.
//
// In the product, repopulateContinueSelect() puts the value back with
//     const _want = _pin || prev;  if (_want && options.some(o => o.value === _want)) contSel.value = _want;
// which fails exactly when the wanted chapter is NOT among the freshly built options — the case
// where APP.savedList is empty or stale at rebuild time, since the pin-survival branch looks the
// chapter up in it. That window is transient; the send happens later, with savedList populated
// again. That asymmetry is precisely what makes the record a better source than the view.
{
  const C = open();
  setSel(C, 'tp_nl1');
  C.run(`onContinueSelectChange(); true;`);        // the learner picks a chapter → it is recorded
  assert.strictEqual(C.run(`APP.contPin`), 'tp_nl1', 'the choice was recorded');

  // The rebuild happens while savedList is momentarily empty — a refresh in flight — so the pin
  // cannot be found and re-offered, and the browser's own reset therefore stands.
  C.run(`APP.savedList = []; repopulateContinueSelect();
         document.getElementById('continue-select').value = '';   // what a real select does here
         true;`);
  assert.strictEqual(C.run(`document.getElementById('continue-select').value`), '',
    'the learner now has an empty picker, without having touched it');
  assert.strictEqual(C.run(`APP.contPin`), 'tp_nl1', 'but the record still holds their choice');

  // savedList comes back, as it does milliseconds later, and the send happens.
  C.run(`APP.savedList = ${JSON.stringify(SAVED)}; true;`);
  assert.strictEqual(ref(C), 'tp_nl1',
    "THE FIX: the send path resolves the learner's choice from the record, not from the reset view");
}
console.log('  a rebuild that empties the picker no longer loses the choice: OK');

// ── 6. Nothing sends the raw select value any more ─────────────────────────────────────────────
// ⚠️ A structural check, because the defect was that EIGHT call sites each did the same wrong thing
// independently. Fixing seven of eight would look identical from any single test.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const bad = src.split('\n')
    .map((l, i) => ({ n: i + 1, l }))
    .filter(({ l }) => /continuedFrom\s*:/.test(l) && /getElementById\('continue-select'\)/.test(l));
  assert.deepStrictEqual(bad.map(b => b.n), [],
    'no send path may read #continue-select directly — that value is a view a rebuild can reset. ' +
    'Offending lines: ' + JSON.stringify(bad));
  assert.ok(/function _continueFromRef\(\)/.test(src), 'the shared resolver exists');
  // Non-vacuity: the resolver is actually used by the send paths, not merely defined.
  const uses = (src.match(/_continueFromRef\(\)/g) || []).length;
  assert.ok(uses >= 6, `and is used by the send paths (found ${uses} references)`);
}
console.log('  no send path reads the raw select any more: OK');

console.log('unit-continue-from: ALL PASSED');
