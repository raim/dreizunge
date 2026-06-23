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
const lessons = [
  { type: 'mixed', perType: 2 },                                  // 0: the mixed lesson itself
  { type: 'standard', vocab: [{ target: 'uno', source: 'one' }] },// 1: standard
  { type: 'word_forms', items: [{ sentence: 'a ___', }] },        // 2: word_forms
  { type: 'standard', _hidden: true, vocab: [] },                 // 3: hidden -> skipped
  { type: 'error_hunt' },                                         // 4: builds [] -> skipped
  { type: 'mixed' },                                              // 5: nested mixed -> skipped
];
const APP = { lessonData: { lessons }, _teacherMode: false, cur: { lessonIdx: 0 } };
const FAKE = {
  standard:   () => [{ type: 'mcq_target_source', correct: 'one' }, { type: 'order', correct: 'x' }, { type: 'mcq', correct: 'z' }],
  word_forms: () => [{ type: 'word_form', sentence: 'a ___', correct: 'b' }, { type: 'word_form', sentence: 'c ___', correct: 'd' }],
  error_hunt: () => [],
  mixed:      () => [{ type: 'mcq' }],
};
const lessonTypeMeta = (t) => ({ build: (l, i) => (FAKE[t] ? FAKE[t](l, i) : []) });
const shuffle = (a) => a.slice();   // identity: deterministic

const buildMixedExercises = new Function('APP', 'lessonTypeMeta', 'shuffle',
  extract('buildMixedExercises') + '\nreturn buildMixedExercises;')(APP, lessonTypeMeta, shuffle);

const pool = buildMixedExercises(lessons[0], 0);
// Sources included: lesson 1 (standard, 2 of 3 by perType) + lesson 2 (word_forms, 2 of 2). Total 4.
assert.strictEqual(pool.length, 4, 'perType cap per source (2+2), got ' + pool.length);
const srcs = new Set(pool.map(e => e._srcLessonIdx));
assert.deepStrictEqual([...srcs].sort(), [1, 2], 'only non-hidden, non-self, exercise-bearing siblings: ' + [...srcs]);
assert.ok(pool.every(e => Number.isInteger(e._srcLessonIdx)), 'every pooled exercise tagged with _srcLessonIdx');
assert.strictEqual(pool.filter(e => e._srcLessonIdx === 1).length, 2, 'standard capped at perType=2');
console.log('  pools, caps per source, skips self/hidden/mixed/error_hunt, tags source: OK');

// _exFlagTarget resolves a pooled exercise against its SOURCE lesson, not the active one.
const _exFlagTarget = new Function('APP',
  extract('_exFlagTarget') + '\nreturn _exFlagTarget;')(APP);
// Active lesson is 0 (mixed, no vocab); the exercise came from lesson 1 (vocab 'uno'/'one').
const tgt = _exFlagTarget({ type: 'mcq_target_source', target: 'uno', correct: 'one', _srcLessonIdx: 1 });
assert.ok(tgt && tgt.target === 'uno', 'flag resolves to source lesson vocab item');
// Without a source tag it falls back to the active lesson (0 = mixed, no match -> null).
assert.strictEqual(_exFlagTarget({ type: 'mcq_target_source', target: 'uno', correct: 'one' }), null, 'untagged falls back to active lesson');
console.log('  _exFlagTarget resolves via _srcLessonIdx: OK');

// startLesson must guard an empty mixed pool (show a message, don't open an empty player).
assert.ok(/lesson\.type==='mixed' && \(!C\.exercises \|\| !C\.exercises\.length\)/.test(html),
  'startLesson must guard an empty mixed pool');
assert.ok(/t\('mixed\.empty'\)/.test(html), "empty mixed shows the 'mixed.empty' message");
console.log('  empty-pool play guard present: OK');
console.log('unit-mixed-lessons: ALL PASSED');
