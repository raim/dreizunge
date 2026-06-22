// Unit test for grammarPriorNounsNote (TODO item 5): the grammar-reinforce hint
// must instruct the model to normalize each prior word to its base singular noun
// and skip non-nouns, so inflected/verb/plural forms stop producing rejected items.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing function: ' + name);
  const bs = src.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const { grammarPriorNounsNote } = new Function(extract('grammarPriorNounsNote') + '\nreturn { grammarPriorNounsNote };')();

// Empty list → no hint.
assert.strictEqual(grammarPriorNounsNote([], 'reinforce'), '', 'empty → no hint');
assert.strictEqual(grammarPriorNounsNote(null, 'reinforce'), '', 'null → no hint');
assert.strictEqual(grammarPriorNounsNote(['', null], 'reinforce'), '', 'all-empty → no hint');

// Reinforce mode → normalization + skip instruction + lists the words.
const r = grammarPriorNounsNote(['Verbesserung', 'verbesserten', 'Häuser'], 'reinforce');
assert.ok(/SINGULAR NOUN/.test(r), 'reinforce hint requires base singular noun form');
assert.ok(/SKIP/.test(r), 'reinforce hint tells the model to skip non-nouns');
assert.ok(/verbesserten/.test(r) && /Verbesserung/.test(r), 'reinforce hint lists the prior words');
assert.ok(/never force a verb or adjective/i.test(r), 'reinforce hint forbids forcing verbs/adjectives');
console.log('  reinforce note: OK');

// Extend mode → the AVOID hint (unchanged behaviour), no normalization text.
const e = grammarPriorNounsNote(['Haus', 'Katze'], 'extend');
assert.ok(/AVOID/.test(e), 'extend hint avoids prior nouns');
assert.ok(!/SINGULAR NOUN/.test(e), 'extend hint has no normalization instruction');
assert.ok(/Haus/.test(e) && /Katze/.test(e), 'extend hint lists the nouns');
console.log('  extend note: OK');

console.log('unit-grammar-reinforce: ALL PASSED');
