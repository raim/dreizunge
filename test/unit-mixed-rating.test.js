// Unit test for todo #7 (v46 Tier 2): the mixed-review pooler must prefer curated
// "good example" (userRating) questions and avoid flagged (faulty) ones, only dipping
// into flagged questions when there aren't enough others to fill perType. Uses the
// extract+sandbox harness (deterministic identity shuffle) like unit-mixed-lessons.
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

// lesson 1: a mix of rated / plain / flagged → expect only the two rated picked (perType 2)
// lesson 0: two flagged + one plain → expect the plain + exactly one flagged (fill to 2)
// v50: sources must come BEFORE the mixed lesson (it pools only earlier siblings).
const lessons = [
  { type: 'standard', vocab: [
    { target: 'flagged1', userFlag: { comment: 'bad' } },
    { target: 'plain1' },
    { target: 'rated1', userRating: { at: 'x' } },
    { target: 'rated2', userRating: { at: 'y' } },
  ] },
  { type: 'standard', vocab: [
    { target: 'f1', userFlag: {} },
    { target: 'f2', userFlag: {} },
    { target: 'ok1' },
  ] },
  { type: 'mixed', perType: 2 },
];
const MIX = 2;
const APP = { lessonData: { lessons }, _teacherMode: false, cur: { lessonIdx: MIX } };
// builder emits one exercise per vocab item, in order, so _resolveExItem maps each back.
const lessonTypeMeta = () => ({ build: (l) => (l.vocab || []).map(v => ({ type: 'mcq_target_source', target: v.target, correct: v.target })) });
const shuffle = (a) => a.slice(); // identity → deterministic ordering before the stable rank-sort
// buildMixedExercises ends with assembleCoverageRound(pool,cap); this test checks SELECTION
// (rated preferred, flagged only to fill perType), not final order, so an identity assembler is
// fine. Coverage-aware assembly is covered by unit-coverage.
const assembleCoverageRound = (pool /*, size */) => pool.slice();

const _resolveExItem = new Function(extract('_resolveExItem') + '\nreturn _resolveExItem;')();
const buildMixedExercises = new Function('APP', 'lessonTypeMeta', 'shuffle', '_resolveExItem', 'assembleCoverageRound',
  extract('buildMixedExercises') + '\nreturn buildMixedExercises;')(APP, lessonTypeMeta, shuffle, _resolveExItem, assembleCoverageRound);

const pool = buildMixedExercises(lessons[MIX], MIX);
const from = idx => pool.filter(e => e._srcLessonIdx === idx).map(e => e.target);

// lesson 0: only the two rated, flagged + plain excluded
const l1 = from(0);
assert.strictEqual(l1.length, 2, 'perType=2 picks 2 from lesson 0, got ' + l1.length);
assert.deepStrictEqual(l1.slice().sort(), ['rated1', 'rated2'], 'lesson 0: rated picked over plain/flagged, got ' + JSON.stringify(l1));

// lesson 1: the plain one + exactly one flagged (flagged used only to fill perType)
const l2 = from(1);
assert.strictEqual(l2.length, 2, 'perType=2 picks 2 from lesson 1, got ' + l2.length);
assert.ok(l2.includes('ok1'), 'lesson 1: the non-flagged item is included');
const flaggedPicked = l2.filter(t => t === 'f1' || t === 'f2');
assert.strictEqual(flaggedPicked.length, 1, 'lesson 1: exactly one flagged item used to fill the minimum, got ' + JSON.stringify(l2));

console.log('unit-mixed-rating: ALL PASSED (rated preferred; flagged only to fill perType)');
