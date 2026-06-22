// Source-shape tests for the storyline bottom row + re-create-all wiring.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

// Markup
assert.ok(html.includes('id="sl-bottom-row"'), 'bottom row container missing');
for (const id of ['sl-bottom-continue', 'sl-bottom-download', 'sl-bottom-clear', 'sl-bottom-delete', 'sl-bottom-recreate']) {
  assert.ok(html.includes('id="' + id + '"'), 'missing button: ' + id);
}
assert.ok(html.includes('onclick="recreateStorylineLessons(event)"'), 're-create button not wired');
console.log('  bottom-row markup: OK');

// Functions
for (const fn of ['function recreateStorylineLessons', 'function slBottomContinue', 'function slBottomDownload',
                  'function slBottomClearProgress', 'function _slBottomChapters']) {
  assert.ok(html.includes(fn), 'missing function: ' + fn);
}
console.log('  functions defined: OK');

// Endpoint + arc semantics
assert.ok(html.includes("fetch('/api/storyline/recreate-lessons'"), 're-create does not call the endpoint');
assert.ok(html.includes('await loadSavedList()'), 're-create does not refresh the saved list');
assert.ok(html.includes('await pollJob('), 're-create does not poll the job');
console.log('  endpoint + refresh wiring: OK');

// ui keys present (en)
for (const k of ['sl.recreate_btn', 'sl.clear_progress_confirm',
                 'sl.continue', 'sl.download', 'sl.clear_progress', 'sl.delete', 'sl.recreate_failed']) {
  assert.ok(typeof ui.en[k] === 'string' && ui.en[k].length, 'missing ui key: ' + k);
}
// fused arc key replaced the old two
assert.ok('form.arc_lbl' in ui.en, 'form.arc_lbl missing');
assert.ok(!('form.pdf_arc' in ui.en) && !('form.gen_arc_lbl' in ui.en), 'old arc keys not removed');
console.log('  ui keys (incl. fused arc label): OK');

console.log('unit-recreate-ui: ALL PASSED');
