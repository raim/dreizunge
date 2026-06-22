// Unit tests for validateWordFormsItems (word_forms). The validator is salvage-oriented
// for weak models: it dedupes choices, auto-inserts a missing blank when the answer is
// present, and does NOT hard-reject on story-grounding (a prompt preference only). It
// still rejects truly broken items and the translation-echo / giveaway failures.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  const braceStart = src.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) { i++; break; } } }
  return src.slice(at, i);
}
const { validateWordFormsItems } = new Function(
  extract('_wfNorm') + '\n' + extract('validateWordFormsItems') + '\nreturn { validateWordFormsItems };')();

const STORY = 'Seven shook his head. The cat and the house stayed the same. She walked to the river.';
const good = { sentence: 'Seven ___ his head.', translation: 'Sieben schüttelte den Kopf.',
  choices: ['shake', 'shakes', 'shook', 'shaking'], correctIndex: 2 };

// 1) A valid item passes and is normalized.
let r = validateWordFormsItems([good], STORY);
assert.strictEqual(r.valid.length, 1, 'valid item should pass');
assert.deepStrictEqual(r.valid[0].choices, ['shake', 'shakes', 'shook', 'shaking']);
assert.strictEqual(r.valid[0].correctIndex, 2);
assert.strictEqual(r.valid[0].explanation, '', 'explanation defaults to empty string when absent');
const withExpl = validateWordFormsItems([{ ...good, explanation: 'past tense of shake' }], STORY);
assert.strictEqual(withExpl.valid[0].explanation, 'past tense of shake', 'explanation passes through');
console.log('  valid item passes: OK');

// 2) SALVAGE: duplicate choices are deduped (not rejected); correctIndex re-points.
let s = validateWordFormsItems([{ ...good, choices: ['shook', 'shook', 'shakes', 'shaking'], correctIndex: 0 }], STORY);
assert.strictEqual(s.valid.length, 1, 'duplicates should be salvaged, not rejected');
assert.deepStrictEqual(s.valid[0].choices, ['shook', 'shakes', 'shaking'], 'choices deduped');
assert.strictEqual(s.valid[0].choices[s.valid[0].correctIndex].toLowerCase(), 'shook', 'correct re-pointed');
// Over-long sets are trimmed to <=6 keeping the correct one (not rejected).
s = validateWordFormsItems([{ ...good, choices: ['a', 'b', 'c', 'd', 'shook', 'e', 'f'], correctIndex: 4 }], STORY);
assert.strictEqual(s.valid.length, 1, '7 choices trimmed, not rejected');
assert.ok(s.valid[0].choices.length <= 6 && s.valid[0].choices.includes('shook'), 'trimmed but keeps correct');
console.log('  dedupe + trim salvage: OK');

// 3) SALVAGE: a missing blank is auto-inserted when the answer is present in the sentence.
s = validateWordFormsItems([{ ...good, sentence: 'Seven shook his head.' }], STORY);
assert.strictEqual(s.valid.length, 1, 'missing blank should be auto-inserted');
assert.ok(/_{3,}/.test(s.valid[0].sentence), 'blank inserted');
assert.ok(!/\bshook\b/i.test(s.valid[0].sentence), 'the answer word was blanked out');
console.log('  auto-blank salvage: OK');

// 4) Story-grounding is NO LONGER a hard reject — a clear off-story exercise passes.
assert.strictEqual(validateWordFormsItems([{ sentence: 'The king ___ a horse yesterday.', translation: 'Der König ritt gestern.',
  choices: ['ride', 'rides', 'rode', 'riding'], correctIndex: 2 }], STORY).valid.length, 1, 'off-story item now valid');
assert.strictEqual(validateWordFormsItems([{ ...good, correctIndex: 0 }], STORY).valid.length, 1,
  'correct need not be the exact story word anymore ("shake")');
console.log('  story-grounding relaxed: OK');

// 5) Genuine rejections still fire.
const cases = [
  [{ ...good, choices: ['shook', 'shook'], correctIndex: 0 }, 'need at least 2 distinct choices'],
  [{ ...good, correctIndex: 7 }, 'correctIndex out of range'],
  [{ ...good, correctIndex: -1 }, 'correctIndex out of range'],
  [{ ...good, sentence: '' }, 'missing sentence'],
  [{ ...good, sentence: 'Totally unrelated text.' }, 'no ___ blank and answer not in sentence'],
  [{ sentence: 'Seven ___ his head, then shook it again.', translation: 'x',
     choices: ['shake', 'shook', 'shaking'], correctIndex: 1 }, 'answer appears elsewhere in sentence'],
  [{ sentence: 'Seven ___ his head.', translation: 'Seven shook his head.',
     choices: ['shake', 'shook', 'shaking'], correctIndex: 1 }, 'translation is the target-language sentence, not a translation'],
];
for (const [item, reason] of cases) {
  const res = validateWordFormsItems([item], STORY);
  assert.strictEqual(res.valid.length, 0, 'should reject: ' + reason + ' :: ' + JSON.stringify(item).slice(0, 60));
  assert.ok(res.rejected[0].reasons.includes(reason),
    `expected reason "${reason}", got ${JSON.stringify(res.rejected[0].reasons)}`);
}
console.log('  genuine rejections fire: OK');

// 6) Flexible count: 2 / 3 / 6 distinct choices all pass.
for (const choices of [['shake', 'shook'], ['shake', 'shakes', 'shook'], ['shake', 'shakes', 'shook', 'shaking', 'shaken', 'shakers']]) {
  const ci = choices.indexOf('shook');
  assert.strictEqual(validateWordFormsItems([{ ...good, choices, correctIndex: ci }], STORY).valid.length, 1,
    choices.length + ' distinct choices should pass');
}
console.log('  flexible 2-6 distinct count: OK');

console.log('unit-word-forms: ALL PASSED');
