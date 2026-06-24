// B-phase-3: the lesson-editor dispatches through the registry, not hand-kept ls.type
// chains. renderLessonEditor's ~9-branch body became per-type LESSON_TYPE_META.editorBranch
// hooks; _syncEditorFromDOM's two save-side guards became editorReadInputs / editorAfterSync
// hooks. This guards that wiring + the static-slice placement of the extracted functions.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) Registry literal carries an editorBranch per type (+ the two save-side hooks).
const lit = src.slice(src.indexOf('const LESSON_TYPE_META = {'), src.indexOf('function lessonTypeEmoji'));
const { LESSON_TYPE_META } = new Function(lit + '\nreturn { LESSON_TYPE_META };')();
const meta = type => LESSON_TYPE_META[type] || LESSON_TYPE_META.standard;

for (const [type, m] of Object.entries(LESSON_TYPE_META)) {
  assert.strictEqual(typeof m.editorBranch, 'function', `type ${type} missing editorBranch()`);
}
// Unknown types fall back to standard's editor branch (the vocab/sentences body).
assert.strictEqual(meta('nope').editorBranch, LESSON_TYPE_META.standard.editorBranch,
  'unknown type editorBranch should fall back to standard');
// vocab + standard both route to the same underlying branch function (_editorBranchStandard).
const standardLine = lit.split('\n').find(l => l.trimStart().startsWith('standard:'));
const vocabLine = lit.split('\n').find(l => l.trimStart().startsWith('vocab:'));
assert.ok(/editorBranch:.*_editorBranchStandard/.test(standardLine), 'standard editorBranch -> _editorBranchStandard');
assert.ok(/editorBranch:.*_editorBranchStandard/.test(vocabLine), 'vocab editorBranch -> _editorBranchStandard');
// Save-side hooks live only on the types that need them.
assert.strictEqual(typeof LESSON_TYPE_META.math.editorReadInputs, 'function', 'math missing editorReadInputs');
assert.strictEqual(typeof LESSON_TYPE_META.error_hunt.editorAfterSync, 'function', 'error_hunt missing editorAfterSync');
assert.strictEqual(LESSON_TYPE_META.grammar.editorReadInputs, undefined, 'non-math should not carry editorReadInputs');
assert.strictEqual(LESSON_TYPE_META.synonyms.editorAfterSync, undefined, 'non-eh should not carry editorAfterSync');
console.log('  registry has editorBranch per type + save-side hooks: OK');

// 2) renderLessonEditor is a thin registry dispatch; the old ls.type chain is gone.
const reBody = src.slice(src.indexOf('function renderLessonEditor('), src.indexOf('function _editorBranchMixed('));
assert.ok(/html \+= lessonTypeMeta\(ls\.type\)\.editorBranch\(ls, li, flaggedOnly\);/.test(reBody),
  'renderLessonEditor should dispatch via editorBranch');
for (const ty of ['grammar', 'conjugation', 'ai_error_hunt', 'error_hunt', 'math', 'synonyms', 'word_forms', 'mixed']) {
  assert.ok(!new RegExp(`ls\\.type === '${ty}'`).test(reBody),
    `old renderLessonEditor branch for ${ty} must be gone`);
}
console.log('  renderLessonEditor is a thin registry dispatch: OK');

// 3) _syncEditorFromDOM routes both save-side guards through the registry.
const syncBody = src.slice(src.indexOf('function _syncEditorFromDOM('), src.indexOf('async function saveLessonEdits('));
assert.ok(/lessonTypeMeta\(ls\.type\)\.editorReadInputs\?\.\(ls, li\);/.test(syncBody),
  '_syncEditorFromDOM should dispatch editorReadInputs via registry');
assert.ok(/lessonTypeMeta\(ls\.type\)\.editorAfterSync\?\.\(ls, li\);/.test(syncBody),
  '_syncEditorFromDOM should dispatch editorAfterSync via registry');
assert.ok(!/if \(ls\.type === 'math'\)/.test(syncBody), 'old math save-side guard must be gone');
assert.ok(!/if \(ls\.type === 'error_hunt'\)/.test(syncBody), 'old error_hunt save-side guard must be gone');
console.log('  _syncEditorFromDOM routes save-side hooks via registry: OK');

// 4) Static-slice rule: every extracted editor function must be defined after buildPath(
//    or build-static.js drops it and static teacher-mode editing throws.
const buildPathAt = src.indexOf('function buildPath(');
assert.ok(buildPathAt > 0, 'buildPath not found');
const mustFollow = [
  '_editorBranchMixed', '_editorBranchGrammar', '_editorBranchConjugation', '_editorBranchAiErrorHunt',
  '_editorBranchErrorHunt', '_editorBranchMath', '_editorBranchSynonyms', '_editorBranchWordForms',
  '_editorBranchStandard', '_editorReadInputsMath', '_editorAfterSyncErrorHunt',
];
for (const fn of mustFollow) {
  const at = src.indexOf('function ' + fn + '(');
  assert.ok(at > buildPathAt, `${fn} must be defined after buildPath() for the static slice`);
}
console.log('  extracted editor functions are inside the static slice: OK');

console.log('unit-editor-registry: ALL PASSED');
