// Unit test for harvest-examples.js (Major A): ⭐-rated lesson items → examples.json,
// keyed by prompt type and "<target>__<source>" pair, in the simplified good-items format.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { harvest, toExamplesFile, PRE } = require(path.join(__dirname, '..', 'harvest-examples.js'));

const RATED = { at: '2026-06-08T12:00:00.000Z' };
const store = {
  topics: [
    { id: 't1', lang: 'de', srcLang: 'en', lessons: [
      { type: 'word_forms', items: [
        { sentence: 'Die ___ schliefen.', translation: 'The cats slept.', choices: ['Katze', 'Katzen'], correctIndex: 1, explanation: 'plural', userRating: RATED, qc: { x: 1 } },
        { sentence: 'no blank here', choices: ['a', 'b'], correctIndex: 0, userRating: RATED }, // malformed: no ___
        { sentence: 'Der ___ bellt.', choices: ['Hund', 'Hunde'], correctIndex: 0 },              // not rated
      ] },
      { type: 'synonyms', words: [
        { base: 'klein', gloss: 'small', synonyms: [{ w: 'winzig', g: 'tiny' }], antonyms: [], homophones: [], userRating: RATED },
      ] },
      { type: 'vocab', vocab: [ { target: 'Haus', source: 'house', userRating: RATED } ] }, // not an {EXAMPLE} type
    ] },
    { id: 't2', lang: 'it', srcLang: 'en', lessons: [
      { type: 'word_forms', items: [
        { sentence: 'Le ___ dormivano.', translation: 'The cats slept.', choices: ['gatta', 'gatte'], correctIndex: 1, userRating: RATED },
      ] },
    ] },
    // topic with no language pair → skipped entirely
    { id: 't3', lessons: [ { type: 'grammar', grammar: [ { target: 'Baum', source: 'tree', userRating: RATED } ] } ] },
  ],
};

const { grouped, rated, kept, skipped } = harvest(store);
// rated counts starred items only inside in-scope lesson types with a language pair:
// de word_forms 2 (1 good + 1 malformed) + de synonyms 1 + it word_forms 1 = 4.
// (vocab is not an {EXAMPLE} type; t3 has no lang/srcLang, so both are skipped before counting.)
assert.strictEqual(rated, 4, 'counts starred items in in-scope, language-paired lessons');
assert.strictEqual(kept, 3, 'keeps 3 well-formed starred items (de wf good, de syn, it wf)');
assert.strictEqual(skipped, 1, 'skips the malformed word_forms item (no ___ blank)');

// grouping by prompt key + pair
assert.deepStrictEqual(Object.keys(grouped).sort(), ['synonyms', 'wordForms']);
assert.deepStrictEqual(Object.keys(grouped.wordForms).sort(), ['de__en', 'it__en']);
assert.deepStrictEqual(Object.keys(grouped.synonyms), ['de__en']);

// fields stripped to schema (no userRating / qc leak into the example)
const wfItem = grouped.wordForms['de__en'][0];
assert.deepStrictEqual(Object.keys(wfItem).sort(), ['choices', 'correctIndex', 'explanation', 'sentence', 'translation']);
assert.ok(!('userRating' in wfItem) && !('qc' in wfItem), 'non-schema fields stripped');
console.log('  harvest groups by type+pair, strips fields, skips malformed: OK');

// examples.json shape: preamble + one JSON line per item
const ex = toExamplesFile(grouped);
assert.ok(ex.wordForms['de__en'].startsWith(PRE + '\n'), 'block starts with the good-items preamble');
assert.ok(ex.wordForms['de__en'].includes('"Katzen"'), 'block carries the item JSON');
assert.ok(/\{L\}/.test(ex.wordForms['de__en']) && /\{S\}/.test(ex.wordForms['de__en']),
  'preamble keeps {L}/{S} tokens for the server to fill');
console.log('  examples.json blocks are preamble + item JSON: OK');

// the harvested wordForms items must still pass the real structural validator
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function extract(name) {
  const at = server.indexOf('function ' + name + '('); const bs = server.indexOf('{', at);
  let d = 0, i = bs; for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const { validateWordFormsItems } = new Function(
  extract('_wfNorm') + '\n' + extract('validateWordFormsItems') + '\nreturn { validateWordFormsItems };')();
for (const pair of Object.keys(grouped.wordForms)) {
  for (const item of grouped.wordForms[pair]) {
    const story = String(item.sentence).replace('___', item.choices[item.correctIndex]);
    const { rejected } = validateWordFormsItems([item], story);
    assert.strictEqual(rejected.length, 0, `harvested wordForms item (${pair}) should validate`);
  }
}
console.log('  harvested wordForms items pass validateWordFormsItems: OK');

// empty store → empty output (no crash)
assert.deepStrictEqual(toExamplesFile(harvest({}).grouped), {}, 'empty store → {}');

console.log('unit-harvest-examples: ALL PASSED');
