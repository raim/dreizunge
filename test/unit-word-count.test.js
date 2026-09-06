// Unit tests for the centralized splitWords/wordCount helpers (item 8 cheap-half).
// Asserts the helpers exist, the old inlined `wc` regex is gone, and tokenization
// matches the previous behavior (incl. trim/collapse/empty cases).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) Helpers present; old inline regex count-helper gone.
assert.ok(html.includes('function splitWords'), 'splitWords missing');
assert.ok(html.includes('function wordCount'), 'wordCount missing');
assert.ok(!html.includes('s.split(/\\s+/).filter(Boolean).length'),
  'inline `wc` count regex still present');
assert.ok(!html.includes('inp.value.trim().split(/\\s+/).filter(Boolean)'),
  'inline word-array split still present');
console.log('  source-shape checks: OK');

// 2) Behavior — run the REAL helpers out of index.html.
//
// ⚠️ v90_b: this block used to open with "reimplement and check the contract the call sites relied
// on", and it did exactly that: it defined its own `splitWords`/`wordCount` two lines below and
// asserted against the COPY. Every assertion here was about the test file agreeing with itself —
// the app's helpers were never called, so no change to them could ever turn this red. Found by the
// mutation audit, which also found the same shape in unit-model-picker. Lift the real source.
const extract = (name) => {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { if (html[i] === '{') d++; else if (html[i] === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
};
const { splitWords, wordCount } = new Function(
  extract('splitWords') + '\n' + extract('wordCount') + '\nreturn { splitWords, wordCount };')();

assert.strictEqual(wordCount('one two three'), 3);
assert.strictEqual(wordCount('  leading and   collapsed   spaces '), 4);
assert.strictEqual(wordCount(''), 0);
assert.strictEqual(wordCount('   '), 0);
assert.strictEqual(wordCount(null), 0);
assert.strictEqual(wordCount(undefined), 0);
assert.strictEqual(wordCount('solo'), 1);
assert.deepStrictEqual(splitWords('  a  b '), ['a', 'b']);
assert.deepStrictEqual(splitWords(''), []);
// count-only helper matches the pre-trim variant for any whitespace padding
assert.strictEqual(wordCount(' x '), 'x'.split(/\s+/).filter(Boolean).length);
console.log('  tokenization behavior: OK');

console.log('unit-word-count: ALL PASSED');
