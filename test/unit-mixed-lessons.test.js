// Major C: a `mixed` lesson pools exercises from the chapter's other lessons (no LLM),
// tags each with its source-lesson index, and skips self / hidden / nested-mixed /
// no-exercise types. _exFlagTarget resolves a pooled exercise back to its source lesson.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name){
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for(; i < html.length; i++){ if(html[i]==='{') d++; else if(html[i]==='}'){ d--; if(!d){ i++; break; } } }
  return html.slice(at, i);
}

// Sandbox with a STUBBED registry + identity shuffle so the test is deterministic.
// v50: a mixed lesson pools from (and hides) only EARLIER siblings; the mixed lesson and anything
// after it stay independent. Fixture puts the sources before the mixed lesson and a lesson AFTER
// it to prove later lessons are not pooled.
const lessons = [
  { type: 'standard', vocab: [{ target: 'uno', source: 'one' }] },// 0: standard  (earlier → pooled)
  { type: 'word_forms', items: [{ sentence: 'a ___', }] },        // 1: word_forms (earlier → pooled)
  { type: 'standard', _hidden: true, vocab: [] },                 // 2: hidden -> skipped
  { type: 'mixed' },                                              // 3: earlier nested mixed -> skipped
  { type: 'mixed', perType: 2 },                                  // 4: THE mixed lesson under test
  { type: 'standard', vocab: [{ target: 'due', source: 'two' }] },// 5: LATER standard -> NOT pooled
  { type: 'error_hunt' },                                         // 6: later error_hunt -> not pooled
];
const MIX = 4;
const APP = { lessonData: { lessons }, _teacherMode: false, cur: { lessonIdx: MIX } };
const FAKE = {
  standard:   () => [{ type: 'mcq_target_source', correct: 'one' }, { type: 'order', correct: 'x' }, { type: 'mcq', correct: 'z' }],
  word_forms: () => [{ type: 'word_form', sentence: 'a ___', correct: 'b' }, { type: 'word_form', sentence: 'c ___', correct: 'd' }],
  error_hunt: () => [],
  mixed:      () => [{ type: 'mcq' }],
};
const lessonTypeMeta = (t) => ({ build: (l, i) => (FAKE[t] ? FAKE[t](l, i) : []) });
const shuffle = (a) => a.slice();   // identity: deterministic
// buildMixedExercises now ends with assembleCoverageRound(pool, cap). This test targets the
// POOLING logic (which siblings, perType caps, tagging), not coverage weighting — so stub the
// assembler as an identity pass. Coverage-aware assembly has its own test (unit-coverage).
const assembleCoverageRound = (pool /*, size */) => pool.slice();

const _resolveExItem = new Function(extract('_resolveExItem') + '\nreturn _resolveExItem;')();
const buildMixedExercises = new Function('APP', 'lessonTypeMeta', 'shuffle', '_resolveExItem', 'assembleCoverageRound',
  extract('buildMixedExercises') + '\nreturn buildMixedExercises;')(APP, lessonTypeMeta, shuffle, _resolveExItem, assembleCoverageRound);

const pool = buildMixedExercises(lessons[MIX], MIX);
// Sources included: lesson 0 (standard, 2 of 3 by perType) + lesson 1 (word_forms, 2 of 2). Total 4.
// The LATER standard (5) and later error_hunt (6) are NOT pooled; hidden (2) and nested mixed (3) skipped.
assert.strictEqual(pool.length, 4, 'perType cap per EARLIER source (2+2), got ' + pool.length);
const srcs = new Set(pool.map(e => e._srcLessonIdx));
assert.deepStrictEqual([...srcs].sort(), [0, 1], 'only earlier non-hidden non-mixed siblings pooled: ' + [...srcs]);
assert.ok(!srcs.has(5) && !srcs.has(6), 'lessons AFTER the mixed lesson are never pooled');
assert.ok(pool.every(e => Number.isInteger(e._srcLessonIdx)), 'every pooled exercise tagged with _srcLessonIdx');
assert.strictEqual(pool.filter(e => e._srcLessonIdx === 0).length, 2, 'standard capped at perType=2');
console.log('  pools EARLIER sources only, caps per source, skips self/hidden/mixed/error_hunt/later, tags source: OK');

// _exFlagTarget resolves a pooled exercise against its SOURCE lesson, not the active one.
const _exFlagTarget = new Function('APP', '_resolveExItem',
  extract('_exFlagTarget') + '\nreturn _exFlagTarget;')(APP, _resolveExItem);
// Active lesson is the mixed one (no vocab); the exercise came from lesson 0 (vocab 'uno'/'one').
const tgt = _exFlagTarget({ type: 'mcq_target_source', target: 'uno', correct: 'one', _srcLessonIdx: 0 });
assert.ok(tgt && tgt.target === 'uno', 'flag resolves to source lesson vocab item');
// Without a source tag it falls back to the active lesson (mixed, no match -> null).
assert.strictEqual(_exFlagTarget({ type: 'mcq_target_source', target: 'uno', correct: 'one' }), null, 'untagged falls back to active lesson');
console.log('  _exFlagTarget resolves via _srcLessonIdx: OK');

// startLesson must guard an empty mixed pool (show a message, don't open an empty player).
assert.ok(/lesson\.type==='mixed' && \(!C\.exercises \|\| !C\.exercises\.length\)/.test(html),
  'startLesson must guard an empty mixed pool');
assert.ok(/t\('mixed\.empty'\)/.test(html), "empty mixed shows the 'mixed.empty' message");
console.log('  empty-pool play guard present: OK');

// Round-trip robustness: buildStandardExercises must not crash on a lesson without vocab
// (a mixed lesson that lost its type would otherwise hit undefined.forEach), the
// client-created mixed lesson must carry a stable id so it round-trips, and the server
// edit handler must preserve a new lesson's full shape (covered by e2e-mixed-lesson-edit).
assert.ok(/const tv=lesson\.vocab\|\|\[\], ts=lesson\.sentences\|\|\[\]/.test(html),
  'buildStandardExercises guards missing vocab/sentences');
assert.ok(/id: 'ls_' \+ Date\.now\(\)[^\n]*\n\s*type: 'mixed'/.test(html),
  'client-created mixed lesson carries a stable id');
console.log('  round-trip robustness (vocab guard + mixed id): OK');
console.log('unit-mixed-lessons: ALL PASSED');
