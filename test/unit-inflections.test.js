// Unit tests for validateInflectionsItems (inflections). Mirrors unit-word-forms.test.js in
// shape and rigor: the validator is salvage-oriented (dedupes BOTH choice lists, trims
// over-long sets, re-points the correct index) but hard-rejects when the item cannot possibly
// teach what this lesson type exists to teach — a surfaceForm genuinely present, as a whole
// word, in the sentence, that differs from its own lemma.
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
// v82_c: the validator now reads UNSPACED_SCRIPTS_RE (see unit-unspaced-scripts-parity.test.js for
// its own dedicated coverage) — pull the const in too, or every extraction here throws ReferenceError.
function extractConst(name) {
  const m = new RegExp('const ' + name + '\\s*=\\s*(/.*/[a-z]*);').exec(src);
  assert.ok(m, 'not found: const ' + name);
  return 'const ' + name + ' = ' + m[1] + ';';
}
const { validateInflectionsItems } = new Function(
  extractConst('UNSPACED_SCRIPTS_RE') + '\n' +
  extract('_inflNorm') + '\n' + extract('validateInflectionsItems') + '\nreturn { validateInflectionsItems };')();

const STORY = 'Die Köpfe der Männer waren müde. Der Kopf tat ihm weh. Sie gingen nach Hause.';
const good = {
  sentence: 'Die Köpfe der Männer waren müde.',
  surfaceForm: 'Köpfe', lemma: 'der Kopf',
  lemmaChoices: ['der Kopf', 'die Hand', 'das Bein'], lemmaCorrectIndex: 0,
  formLabel: 'plural', formChoices: ['plural', 'singular', 'genitive'], formCorrectIndex: 0,
  translation: 'The heads of the men were tired.',
};

// 1) A valid item passes and is normalized.
let r = validateInflectionsItems([good], STORY);
assert.strictEqual(r.valid.length, 1, 'valid item should pass');
assert.strictEqual(r.valid[0].surfaceForm, 'Köpfe');
assert.strictEqual(r.valid[0].lemma, 'der Kopf');
assert.deepStrictEqual(r.valid[0].lemmaChoices, good.lemmaChoices);
assert.strictEqual(r.valid[0].lemmaCorrectIndex, 0);
assert.deepStrictEqual(r.valid[0].formChoices, good.formChoices);
assert.strictEqual(r.valid[0].formCorrectIndex, 0);
assert.strictEqual(r.valid[0].explanation, '', 'explanation defaults to empty string when absent');
const withExpl = validateInflectionsItems([{ ...good, explanation: 'plural of der Kopf, umlaut + -e' }], STORY);
assert.strictEqual(withExpl.valid[0].explanation, 'plural of der Kopf, umlaut + -e', 'explanation passes through');
console.log('  valid item passes: OK');

// 2) SALVAGE: duplicate choices are deduped in BOTH lists (not rejected); correct index re-points.
let s = validateInflectionsItems([{ ...good,
  lemmaChoices: ['der Kopf', 'der Kopf', 'die Hand'], lemmaCorrectIndex: 1,
  formChoices: ['plural', 'plural', 'singular'], formCorrectIndex: 1 }], STORY);
assert.strictEqual(s.valid.length, 1, 'duplicates should be salvaged, not rejected');
assert.deepStrictEqual(s.valid[0].lemmaChoices, ['der Kopf', 'die Hand'], 'lemma choices deduped');
assert.strictEqual(s.valid[0].lemmaChoices[s.valid[0].lemmaCorrectIndex], 'der Kopf', 'lemma correct re-pointed');
assert.deepStrictEqual(s.valid[0].formChoices, ['plural', 'singular'], 'form choices deduped');
assert.strictEqual(s.valid[0].formChoices[s.valid[0].formCorrectIndex], 'plural', 'form correct re-pointed');
console.log('  dedupe salvage on both choice lists: OK');

// 3) SALVAGE: over-long sets (either list) are trimmed to <=6, keeping the correct one.
s = validateInflectionsItems([{ ...good,
  lemmaChoices: ['a', 'b', 'c', 'd', 'der Kopf', 'e', 'f'], lemmaCorrectIndex: 4 }], STORY);
assert.strictEqual(s.valid.length, 1, '7 lemma choices trimmed, not rejected');
assert.ok(s.valid[0].lemmaChoices.length <= 6 && s.valid[0].lemmaChoices.includes('der Kopf'), 'trimmed but keeps correct lemma');
s = validateInflectionsItems([{ ...good,
  formChoices: ['a', 'b', 'c', 'd', 'plural', 'e', 'f'], formCorrectIndex: 4 }], STORY);
assert.strictEqual(s.valid.length, 1, '7 form choices trimmed, not rejected');
assert.ok(s.valid[0].formChoices.length <= 6 && s.valid[0].formChoices.includes('plural'), 'trimmed but keeps correct form');
console.log('  trim salvage on both choice lists: OK');

// 4) Genuine rejections still fire.
const cases = [
  [{ ...good, sentence: '' }, 'missing sentence'],
  [{ ...good, surfaceForm: '' }, 'missing surfaceForm'],
  [{ ...good, lemma: '' }, 'missing lemma'],
  [{ ...good, formLabel: '' }, 'missing formLabel'],
  [{ ...good, lemmaChoices: ['der Kopf'] }, 'need at least 2 lemma choices'],
  [{ ...good, formChoices: ['plural'] }, 'need at least 2 form choices'],
  [{ ...good, lemma: 'der Fuß' }, 'lemma not found among its own lemmaChoices'],
  [{ ...good, formLabel: 'dative' }, 'formLabel not found among its own formChoices'],
  [{ ...good, sentence: 'Ein völlig anderer Satz ohne das Wort.' }, 'surfaceForm not found as a whole word in sentence'],
  [{ ...good, surfaceForm: 'der Kopf', sentence: 'Die der Kopf der Männer waren müde.' },
    'surfaceForm equals lemma — not an inflection'],
  [{ ...good, translation: good.sentence }, 'translation is the target-language sentence, not a translation'],
];
for (const [item, reason] of cases) {
  const res = validateInflectionsItems([item], STORY);
  assert.strictEqual(res.valid.length, 0, 'should reject: ' + reason + ' :: ' + JSON.stringify(item).slice(0, 80));
  assert.ok(res.rejected[0].reasons.includes(reason),
    `expected reason "${reason}", got ${JSON.stringify(res.rejected[0].reasons)}`);
}
console.log('  genuine rejections fire: OK');

// 5) surfaceForm must match as a WHOLE word — a substring hit inside a longer word must not
// satisfy the check (the mutation this guard exists to catch: a naive .includes() would pass
// "Kopf" against "Kopfschmerzen").
{
  const res = validateInflectionsItems([{ ...good, surfaceForm: 'Kopf', lemma: 'der Kopf',
    sentence: 'Er hatte Kopfschmerzen den ganzen Tag.' }], STORY);
  assert.strictEqual(res.valid.length, 0, 'a substring match inside a longer word must not pass');
  assert.ok(res.rejected[0].reasons.includes('surfaceForm not found as a whole word in sentence'));
}
console.log('  whole-word match required (substring does not satisfy it): OK');

console.log('unit-inflections: ALL PASSED');
