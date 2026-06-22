// Unit tests for the synonyms context-sentence helper (server). Extracts the real
// _wfNorm / _synSplitSentences / findContextSentence from server.js.
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
const { _synSplitSentences, findContextSentence } = new Function(
  extract('_wfNorm') + '\n' + extract('_synSplitSentences') + '\n' + extract('findContextSentence') +
  '\nreturn { _synSplitSentences, findContextSentence };')();

const story = 'Das Haus war klein und alt. Sieben rannte schnell zur Tür. Die Katze schlief.';

// Splitting
const sents = _synSplitSentences(story);
assert.strictEqual(sents.length, 3, 'splits into 3 sentences');
assert.ok(sents[0].startsWith('Das Haus'), 'first sentence intact');

// Whole-word match, case-insensitive, punctuation-insensitive.
assert.strictEqual(findContextSentence('klein', [sents]), 'Das Haus war klein und alt.');
assert.strictEqual(findContextSentence('Schnell', [sents]), 'Sieben rannte schnell zur Tür.');
assert.strictEqual(findContextSentence('Katze', [sents]), 'Die Katze schlief.');
console.log('  finds the right sentence: OK');

// No false positive on a substring (klein should not match "kleinlich").
const story2 = _synSplitSentences('Er ist kleinlich gewesen.');
assert.strictEqual(findContextSentence('klein', [story2]), '', 'substring is not a whole-word match');
console.log('  whole-word only (no substring hits): OK');

// Pool order: prefers the first pool, falls back to the second.
const a = _synSplitSentences('Nur Vokabeln hier.');
const b = _synSplitSentences('Das Wort taucht hier auf.');
assert.strictEqual(findContextSentence('Wort', [a, b]), 'Das Wort taucht hier auf.', 'falls back to second pool');
assert.strictEqual(findContextSentence('fehlt', [a, b]), '', 'absent word -> empty');
console.log('  pool fallback + absent word: OK');

console.log('unit-syn-context: ALL PASSED');
