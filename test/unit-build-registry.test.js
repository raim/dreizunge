// B-phase-1: exercise building dispatches through the lesson-type registry
// (LESSON_TYPE_META[type].build), not a hand-kept if-chain in buildExercises.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Pull out the registry object literal + lessonTypeMeta and evaluate them. The build
// arrows reference builder functions that don't exist in this sandbox, but arrows only
// resolve those names when CALLED, so creating the registry is safe.
const lit = src.slice(src.indexOf('const LESSON_TYPE_META = {'), src.indexOf('function lessonTypeEmoji'));
const { LESSON_TYPE_META, lessonTypeMeta } = new Function(lit + '\nreturn { LESSON_TYPE_META, lessonTypeMeta };')();

// Every registered type carries a build hook.
for (const [type, meta] of Object.entries(LESSON_TYPE_META)) {
  assert.strictEqual(typeof meta.build, 'function', `type ${type} missing build()`);
}
// Unknown types fall back to standard's builder.
assert.strictEqual(lessonTypeMeta('nope'), LESSON_TYPE_META.standard, 'unknown type should fall back to standard');
assert.strictEqual(lessonTypeMeta('nope').build, LESSON_TYPE_META.standard.build, 'fallback build is standard build');
// error_hunt builds to an empty exercise list (no playable exercises).
assert.deepStrictEqual(LESSON_TYPE_META.error_hunt.build({}), [], 'error_hunt builds []');
assert.deepStrictEqual(LESSON_TYPE_META.ai_error_hunt.build({}), [], 'ai_error_hunt builds []');
console.log('  registry has build() per type + standard fallback: OK');

// buildExercises is a thin registry lookup, and the old if-chain is gone.
const be = src.slice(src.indexOf('function buildExercises('), src.indexOf('function buildStandardExercises('));
assert.ok(/lessonTypeMeta\(lesson\.type\)\.build\(lesson, lessonIdx\)/.test(be), 'buildExercises should dispatch via registry');
assert.ok(!/if\(lesson\.type==='grammar'\)/.test(be), 'old grammar if-branch must be gone from buildExercises');
assert.ok(!/if\(lesson\.type==='word_forms'\)/.test(be), 'old word_forms if-branch must be gone from buildExercises');
assert.ok(src.includes('function buildStandardExercises(lesson, lessonIdx)'), 'buildStandardExercises extracted');
console.log('  buildExercises is a thin registry lookup: OK');
console.log('unit-build-registry: ALL PASSED');
