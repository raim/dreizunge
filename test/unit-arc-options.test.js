// Unit test for the arc-mode <option> translation block in applyUIStrings
// (roadmap item 3). Replays the exact block against a tiny DOM stub and asserts
// both selects' options are set from the ui.json en values.
const assert = require('assert');
const path = require('path');
const ui = require(path.join(__dirname, '..', 'ui.json'));

assert.ok(ui.en['form.arc_mode_vocab'], 'ui.json en is missing form.arc_mode_vocab');
assert.ok(ui.en['form.arc_mode_grammar'], 'ui.json en is missing form.arc_mode_grammar');
const t = k => ui.en[k] || k;

function makeOption(value) { return { _value: value, textContent: 'OLD' }; }
function makeSelect(id, values) {
  const opts = values.map(makeOption);
  return { id, _opts: opts, querySelector(sel) {
    const m = /option\[value="(.+)"\]/.exec(sel); if (!m) return null;
    return opts.find(o => o._value === m[1]) || null;
  } };
}
const selects = {
  'pdf-arc-mode': makeSelect('pdf-arc-mode', ['vocab', 'grammar']),
  'gen-arc-mode': makeSelect('gen-arc-mode', ['vocab', 'grammar']),
  // 'missing-arc-mode' intentionally absent -> getElementById returns null -> skipped
};
const document = { getElementById(id) { return selects[id] || null; } };

// --- exact block from applyUIStrings ---
['pdf-arc-mode', 'gen-arc-mode'].forEach(selId => {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const ov = sel.querySelector('option[value="vocab"]');
  if (ov) ov.textContent = t('form.arc_mode_vocab');
  const og = sel.querySelector('option[value="grammar"]');
  if (og) og.textContent = t('form.arc_mode_grammar');
});
// ---------------------------------------

for (const id of ['pdf-arc-mode', 'gen-arc-mode']) {
  const s = selects[id];
  assert.strictEqual(s._opts.find(o => o._value === 'vocab').textContent, ui.en['form.arc_mode_vocab'], id + ' vocab text');
  assert.strictEqual(s._opts.find(o => o._value === 'grammar').textContent, ui.en['form.arc_mode_grammar'], id + ' grammar text');
}
console.log('unit-arc-options: ALL PASSED (both selects, both options set from ui.json)');
