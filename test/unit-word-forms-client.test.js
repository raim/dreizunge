// Unit tests for the client word_forms play path: buildWordFormsExercises maps
// items -> MCQ exercises (correct = the original choice), skips invalid items, and
// the renderer + dispatch are wired in index.html.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Wiring present (word_forms now dispatches via the lesson-type registry, B-phase-1).
assert.ok(/word_forms:\s*\{[^}]*build:\s*\(l\)\s*=>\s*buildWordFormsExercises\(l\)/.test(html),
  'LESSON_TYPE_META.word_forms missing build -> buildWordFormsExercises');
assert.ok(/lessonTypeMeta\(lesson\.type\)\.build\(lesson, lessonIdx\)/.test(html),
  'buildExercises should dispatch via the registry');
// renderEx now dispatches via the exercise-renderer registry (B-phase-2), not an if-chain.
assert.ok(/word_form:\s*\(ex\)\s*=>\s*tWordForm\(ex\)/.test(html), 'EX_RENDERERS missing word_form -> tWordForm');
assert.ok(/const _exRender = EX_RENDERERS\[ex\.type\];/.test(html), 'renderEx should dispatch via EX_RENDERERS');
assert.ok(html.includes('function tWordForm(ex)'), 'tWordForm renderer missing');
assert.ok(html.includes('word_forms:    { emoji:'), 'LESSON_TYPE_META missing word_forms');
console.log('  wiring present: OK');

function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  const braceStart = html.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return html.slice(at, i);
}
// shuffle stub = identity so we can assert deterministically.
const { buildWordFormsExercises } = new Function('shuffle',
  extract('buildWordFormsExercises') + '\nreturn { buildWordFormsExercises };')(a => a);

const lesson = { type: 'word_forms', items: [
  { sentence: 'Seven ___ his head.', translation: 'Sieben schüttelte den Kopf.', choices: ['shake', 'shakes', 'shook', 'shaking'], correctIndex: 2, explanation: 'past tense' },
  { sentence: 'bad item', translation: 'x', choices: ['only', 'two'], correctIndex: 5 }, // invalid correctIndex
  { sentence: 'too few', translation: 'x', choices: ['one'], correctIndex: 0 },           // <2 choices
] };
const exs = buildWordFormsExercises(lesson);
assert.strictEqual(exs.length, 1, 'only the valid item builds an exercise');
const e = exs[0];
assert.strictEqual(e.type, 'word_form');
assert.strictEqual(e.correct, 'shook', 'correct = choices[correctIndex]');
assert.strictEqual(e.target, 'shook', 'target mirrors correct (reveal/speak)');
assert.deepStrictEqual(e.choices, ['shake', 'shakes', 'shook', 'shaking'], 'all choices kept');
assert.ok(e.choices.includes(e.correct), 'correct answer is among the choices');
assert.strictEqual(e.translation, 'Sieben schüttelte den Kopf.');
assert.strictEqual(e.explanation, 'past tense', 'explanation carried onto exercise');
console.log('  builder maps + filters: OK');

console.log('unit-word-forms-client: ALL PASSED');
