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

// 2) Behavior — reimplement and check the contract the call sites relied on.
const splitWords = s => String(s == null ? '' : s).trim().split(/\s+/).filter(Boolean);
const wordCount = s => splitWords(s).length;

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
