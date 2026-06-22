// Unit tests for play-time flag targeting: _exFlagTarget maps a play exercise back
// to the lesson object that carries its userFlag (vocab/sentence by target,
// word_forms item by sentence, synonyms word by base), and _exFlagState reads it.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing: ' + name);
  const bs = html.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

const lesson = {
  vocab: [{ target: 'Katze', source: 'cat' }, { target: 'Haus', source: 'house', userFlag: { comment: 'typo', correct: 'das Haus', at: 'x' } }],
  sentences: [{ target: 'Die Katze schläft.', source: 'The cat sleeps.' }],
  items: [{ sentence: 'Es war ___ Test.', choices: ['ein', 'eine'], correctIndex: 0 }],
  words: [{ base: 'klein', synonyms: [{ w: 'winzig' }] }],
};
const APP = { lessonData: { lessons: [lesson] }, cur: { lessonIdx: 0 } };
const { _exFlagTarget, _exFlagState } = new Function('APP',
  extract('_exFlagTarget') + '\n' + extract('_exFlagState') + '\nreturn { _exFlagTarget, _exFlagState };')(APP);

// vocab by target
assert.strictEqual(_exFlagTarget({ type: 'mcq', target: 'Katze' }), lesson.vocab[0], 'vocab by target');
// case/space-insensitive
assert.strictEqual(_exFlagTarget({ type: 'listen_mcq', target: '  katze ' }), lesson.vocab[0], 'normalized match');
// sentence by target
assert.strictEqual(_exFlagTarget({ type: 'order', target: 'Die Katze schläft.' }), lesson.sentences[0], 'sentence by target');
// word_form by sentence
assert.strictEqual(_exFlagTarget({ type: 'word_form', sentence: 'Es war ___ Test.' }), lesson.items[0], 'word_form by sentence');
// syn_select by base
assert.strictEqual(_exFlagTarget({ type: 'syn_select', base: 'klein' }), lesson.words[0], 'synonyms by base');
// no match
assert.strictEqual(_exFlagTarget({ type: 'math_calc', target: '42' }), null, 'no match → null');
console.log('  _exFlagTarget mapping: OK');

// _exFlagState reads the matched item's userFlag.
assert.strictEqual(_exFlagState({ type: 'mcq', target: 'Haus' }).correct, 'das Haus', 'reads existing flag');
assert.strictEqual(_exFlagState({ type: 'mcq', target: 'Katze' }), null, 'unflagged → null');
console.log('  _exFlagState: OK');

console.log('unit-play-flag: ALL PASSED');
