// unit-no-keyboard.test.js
// Covers the no-keyboard glyph-ordering feature: the grapheme tokenizer keeps base letters
// with their combining marks, round-trips, and the gating only fires for type-the-target
// exercises while no-keyboard mode is on. The DOM rendering/check is browser-verified.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(src, n) {
  const at = src.indexOf('function ' + n + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

const glyphTokens = new Function(ext(html, 'glyphTokens') + '\nreturn glyphTokens;')();

// ── tokenizer ────────────────────────────────────────────────────────────────
// Arabic with harakat: each consonant keeps its diacritics as one orderable unit.
const ar = glyphTokens('قِطَّة');
assert.ok(ar.length >= 3 && ar.length <= 4, 'Arabic word splits into a few grapheme clusters, not bare diacritics');
assert.strictEqual(ar.join(''), 'قِطَّة', 'Arabic tokens round-trip to the original');
assert.ok(ar.some(t => t.length > 1), 'at least one token carries a combining mark (base+diacritic)');
// Latin → one token per letter.
assert.deepStrictEqual(glyphTokens('cat'), ['c', 'a', 't'], 'Latin splits per letter');
// Hangul → one token per syllable block.
assert.deepStrictEqual(glyphTokens('한국'), ['한', '국'], 'Hangul splits per syllable');
// Edge cases.
assert.deepStrictEqual(glyphTokens(''), [], 'empty string → no tokens');
assert.deepStrictEqual(glyphTokens(null), [], 'null → no tokens');
console.log('  glyphTokens: grapheme clustering + round-trip (Arabic/Latin/Hangul): OK');

// ── furigana seam: a Japanese target with furigana brackets must be stripped to its displayed
// base BEFORE tokenizing, or the brackets/readings leak in as tiles (and reveal pronunciation).
const stripFuri = new Function('APP', ext(html, 'stripFuri') + '\nreturn stripFuri;')({ showFurigana: false });
const jaTarget = '猫[ねこ]が好[す]き';
const jaBase = stripFuri(jaTarget);
assert.strictEqual(jaBase, '猫が好き', 'stripFuri reduces furigana target to its base');
const jaTiles = glyphTokens(jaBase);
assert.deepStrictEqual(jaTiles, ['猫', 'が', '好', 'き'], 'JA glyph tiles are the base chars, no brackets/readings');
assert.ok(!jaTiles.includes('[') && !jaTiles.includes(']'), 'no bracket characters become tiles');
assert.ok(!jaTiles.includes('ね') && !jaTiles.includes('す'), 'no reading kana leak into tiles');
assert.strictEqual(jaTiles.join(''), jaBase, 'ordered JA tiles rebuild the displayed base');
// And the source-the-tokenizer-uses must be the stripped form, never the raw bracketed string.
const rawTiles = glyphTokens(jaTarget);
assert.ok(rawTiles.includes('['), 'sanity: the RAW bracketed string WOULD leak brackets (why we strip)');
console.log('  furigana seam: JA target stripped before tokenizing (no bracket/reading tiles): OK');

// ── gating ───────────────────────────────────────────────────────────────────
const APP = { noKeyboard: false };
const _isTypingEx = new Function(ext(html, '_isTypingEx') + '\nreturn _isTypingEx;')();
const _glyphOrderActive = new Function('APP', '_isTypingEx', ext(html, '_glyphOrderActive') + '\nreturn _glyphOrderActive;')(APP, _isTypingEx);

for (const ty of ['listen_type', 'type_plural', 'type_conjugation']) {
  assert.strictEqual(_isTypingEx({ type: ty }), true, `${ty} is a typing exercise`);
}
for (const ty of ['mcq_target_source', 'order', 'listen_mcq', 'math_calc', 'syn_select']) {
  assert.strictEqual(_isTypingEx({ type: ty }), false, `${ty} is not a typing exercise`);
}
// Off by default → no swap.
assert.strictEqual(_glyphOrderActive({ type: 'listen_type' }), false, 'no swap when no-keyboard is off');
// On → swap only for typing types.
APP.noKeyboard = true;
assert.strictEqual(_glyphOrderActive({ type: 'listen_type' }), true, 'typing type swaps when no-keyboard on');
assert.strictEqual(_glyphOrderActive({ type: 'type_conjugation' }), true, 'conjugation typing swaps');
assert.strictEqual(_glyphOrderActive({ type: 'mcq_target_source' }), false, 'MCQ never swaps');
assert.strictEqual(_glyphOrderActive({ type: 'order' }), false, 'word-order never swaps');
console.log('  glyph-order gating: only typing types, only when no-keyboard on: OK');

// ── assembled-answer check (the comparison check() performs) ──────────────────
const target = 'قِطَّة';
const placedRight = glyphTokens(target).map(w => ({ w }));
assert.strictEqual(placedRight.map(p => p.w).join(''), target, 'glyphs in order rebuild the target');
const placedWrong = glyphTokens(target).reverse().map(w => ({ w }));
assert.notStrictEqual(placedWrong.map(p => p.w).join(''), target, 'wrong order does not match');
console.log('  glyph-order assembled-answer compare: OK');

console.log('unit-no-keyboard: ALL PASSED');
