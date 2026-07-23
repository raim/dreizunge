// Source-shape tests for the editor user-flag "correct version" field and its apply
// action (the live-side "correct version becomes the suggested fix" requirement).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

// The flag box (now a shared helper) has a correct-version input; saveUserFlag stores
// {comment, correct, at}.
assert.ok(html.includes('id="flag-correct-${li}-${type}-${fi}"'), 'flag box missing correct-version input');
assert.ok(html.includes('item.userFlag = { comment, correct, at: new Date().toISOString(), mode: _flagMode() };'),
  'saveUserFlag must store comment + correct (+ the producing mode, v68.1)');
assert.ok(html.includes('function _flagBoxHtml') && html.includes('function _flagBtnHtml'),
  'flag UI helpers missing');
console.log('  flag box correct-version field: OK');

// Apply action mirrors QC: writes the suggestion to target, stamps editedAt, clears flag.
assert.ok(html.includes('function userFlagApplyFix'), 'userFlagApplyFix missing');
const at = html.indexOf('async function userFlagApplyFix');
const body = html.slice(at, at + 600);
assert.ok(body.includes('item.userFlag && item.userFlag.correct'), 'apply must read userFlag.correct');
assert.ok(body.includes('item.target = sug'), 'apply must write the correct version to target');
assert.ok(body.includes('item.editedAt'), 'apply must stamp editedAt');
assert.ok(body.includes('delete item.userFlag'), 'apply must clear the flag');
console.log('  userFlagApplyFix mirrors QC apply: OK');

// The suggests row renders when userFlag.correct is present; apply only when applyable.
assert.ok(html.includes('item.userFlag && item.userFlag.correct'), 'no user-flag suggests row');
assert.ok(html.includes("userFlagApplyFix('${li}','${type}',${fi})"), 'suggests row missing apply wiring');
// _editorItem resolves all four flaggable types.
assert.ok(html.includes("type==='wf'?ls.items") && html.includes("type==='syn'?ls.words"),
  '_editorItem must resolve word_forms + synonyms items');
console.log('  user-flag suggests row + all types: OK');

// ui keys present.
for (const k of ['qc.editor.flag_correct_placeholder', 'qc.editor.user_suggests']) {
  assert.ok(typeof ui.en[k] === 'string' && ui.en[k].length, 'missing ui key: ' + k);
}
console.log('  ui keys: OK');

console.log('unit-user-flag-editor: ALL PASSED');
