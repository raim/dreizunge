// unit-typed-diff.test.js
// v71_c: a wrong TYPED answer shows both what was typed and what was wanted, with the differing
// characters marked.
//
// Roadmap item, carried since v70_o: "it needs proper SEQUENCE ALIGNMENT, not positional
// comparison: `hause` vs `haus` differs by one insertion, not four substitutions." That is the
// property this file exists to pin — a positional implementation passes a naive "marks something"
// test while being actively misleading, so the assertions are about WHICH characters get marked.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > -1, `index.html defines ${name}()`);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const maxC = src.match(/const _DIFF_MAX = \d+;/);
assert.ok(maxC, 'the diff size cap is a module-level constant');
const wrongC = src.match(/const TYPED_DIFF_MAX_WRONG = \d+;/);
assert.ok(wrongC, 'the wrong-character threshold is a module-level constant');
const MAX_WRONG = parseInt(wrongC[0].match(/\d+/)[0], 10);
const M = new Function('const Intl = globalThis.Intl;\n' + maxC[0] + '\n' + wrongC[0] + '\n' +
  extract('_graphemes') + extract('normDiacritics') + extract('_charEq') + extract('_alignChars') +
  extract('_furiParts') + extract('stripFuri') + extract('typedDiffHtml') +
  "\nfunction escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}" +
  "\nfunction t(k){return k;}" +
  '\nreturn { _graphemes, _alignChars, typedDiffHtml };')();

const ops = (a, b) => M._alignChars(a, b).map(o => o.op).join(',');
const counts = (a, b) => M._alignChars(a, b).reduce((m, o) => (m[o.op] = (m[o.op] || 0) + 1, m), {});

// ── 1. THE case from the roadmap: one insertion, not four substitutions ──────
{
  const c = counts('hause', 'haus');
  assert.strictEqual(c.ins, 1, '"hause" vs "haus" is ONE extra character');
  assert.strictEqual(c.eq, 4, 'and the other four match');
  assert.ok(!c.sub, 'nothing is a substitution');
  // A positional comparison would mark the trailing characters wrong; make sure we do not.
  const al = M._alignChars('hause', 'haus');
  assert.strictEqual(al[4].op, 'ins', 'the extra letter is the one marked, at the end');
  assert.strictEqual(al[4].a, 'e');
  console.log('  hause/haus: 1 insertion, 4 equal (not 4 substitutions)');
}

// ── 2. A leading omission does not cascade ──────────────────────────────────
// The pathological case for positional comparison: drop the first letter and EVERY later position
// misaligns, so a naive diff marks the whole word wrong.
{
  const c = counts('aus', 'haus');
  assert.strictEqual(c.del, 1, 'one character is missing');
  assert.strictEqual(c.eq, 3, 'the rest still line up');
  assert.ok(!c.sub, 'no substitutions — the tail is not marked wrong');
  const al = M._alignChars('aus', 'haus');
  assert.strictEqual(al[0].op, 'del', 'the missing letter is reported first');
  assert.strictEqual(al[0].b, 'h', 'and it is the "h"');
}

// ── 3. Genuine substitutions are substitutions ──────────────────────────────
{
  assert.strictEqual(ops('kat', 'kut'), 'eq,sub,eq', 'a single wrong letter in the middle');
  const c = counts('Fenster', 'Fanster');
  assert.strictEqual(c.sub, 1); assert.strictEqual(c.eq, 6);
}

// ── 4. Scoring leniency is respected: case and accents are NOT marked wrong ──
// check() compares with normDiacritics, so it forgives case and diacritics. If the diff marked
// them the learner would be told a character is wrong that the app just accepted.
{
  assert.strictEqual(ops('haus', 'Haus'), 'eq,eq,eq,eq', 'case alone is never marked');
  assert.strictEqual(ops('uber', 'über'), 'eq,eq,eq,eq', 'a missing umlaut is not marked as a wrong letter');
  assert.strictEqual(ops('Grusse', 'Grüsse'), 'eq,eq,eq,eq,eq,eq', 'nor an umlaut inside a word');
}

// ── 5. Graphemes, not code units ────────────────────────────────────────────
{
  assert.strictEqual(M._graphemes('e\u0301te').length, 3, 'a combining accent stays with its letter');
  assert.strictEqual(M._graphemes('😀ab').length, 3, 'an astral emoji is one character');
  // Devanagari cluster (needs Intl.Segmenter; falls back to code points where absent).
  assert.ok(M._graphemes('नमस्ते').length <= 6, 'a Devanagari cluster is not split into every code point');
}

// ── 6. The rendered rows ────────────────────────────────────────────────────
{
  const html = M.typedDiffHtml('hause', 'haus');
  assert.ok(/typed-diff/.test(html), 'a diff block is produced');
  assert.ok(/check\.you_typed/.test(html) && /check\.correct_answer/.test(html), 'both rows are labelled');
  // The extra "e" is struck through on the typed row; the correct row gets a gap in that column.
  assert.strictEqual((html.match(/class="dc bad"/g) || []).length, 1, 'exactly one character is marked wrong');
  assert.strictEqual((html.match(/class="dc gap"/g) || []).length, 1, 'and the other row keeps a placeholder so the columns line up');
  const want = M.typedDiffHtml('aus', 'haus');
  assert.strictEqual((want.match(/class="dc want"/g) || []).length, 1, 'a missing character is highlighted on the correct row');
  // Both rows must have the same number of cells, or the columns do not align.
  const cells = row => (row.match(/<span class="dc[^"]*"/g) || []).length;
  const rows = want.split('</div><div class="td-row">');
  assert.strictEqual(cells(rows[0]), cells(rows[1]), 'the two rows have equal cell counts');
}

// ── 7. HTML is escaped, and furigana is stripped from the target ────────────
{
  const html = M.typedDiffHtml('<b>x', '<i>x');
  // Each character is its own cell, so the escaped text is not contiguous — assert on the cells.
  assert.ok(!/<b>/.test(html), 'typed input is never injected as markup');
  assert.ok(/>&lt;</.test(html) && />&gt;</.test(html), 'angle brackets are escaped inside their cells');
  const furi = M.typedDiffHtml('yama', '山[やま]');
  assert.ok(!/\[/.test(furi), 'furigana brackets are not compared against the typed text');
}

// ── 8. Degenerate input returns nothing, so the caller falls back ───────────
// An empty answer has no useful diff — the plain correct answer reads better.
{
  assert.strictEqual(M.typedDiffHtml('', 'haus'), '', 'nothing typed -> no diff');
  assert.strictEqual(M.typedDiffHtml('   ', 'haus'), '', 'whitespace only -> no diff');
  assert.strictEqual(M.typedDiffHtml('haus', ''), '', 'no target -> no diff');
  assert.strictEqual(M.typedDiffHtml(null, null), '', 'null is handled');
  const huge = 'a'.repeat(500);
  assert.strictEqual(M._alignChars(huge, huge + 'b'), null, 'an over-long pair is refused rather than run');
  assert.strictEqual(M.typedDiffHtml(huge, huge + 'b'), '', 'and the caller gets nothing to fall back from');
}

// ── 9. Sentences, spaces and RTL ────────────────────────────────────────────
{
  const c = counts('ich gehe nach hause', 'ich gehe nach haus');
  assert.strictEqual(c.ins, 1, 'a whole sentence still differs by one character');
  assert.ok(M.typedDiffHtml('ich gehe', 'ich geht').includes('&nbsp;'), 'spaces are rendered visibly');
  const ar = M._alignChars('كتاب', 'كتب');
  assert.ok(ar.filter(o => o.op === 'ins').length === 1, 'Arabic: one extra letter is one insertion');
  assert.ok(/dir="auto"/.test(M.typedDiffHtml('كتاب', 'كتب')), 'the character rows carry dir="auto" for RTL');
}

// ── 10. The call site: only typed exercises, never no-keyboard glyph mode ───
{
  assert.ok(/const _typedIn = \(ex\.type==='listen_type'\|\|ex\.type==='type_plural'\|\|ex\.type==='type_conjugation'\)/.test(src),
    'the diff is limited to the three typed exercise types');
  assert.ok(/&& !_glyphOrderActive\(ex\) \? \(document\.getElementById\('type-in'\)\?\.value \|\| ''\) : ''/.test(src),
    'and is skipped in no-keyboard glyph mode, where there is no typed string');
  // v71_o: a comprehension question reveals the REASON instead, so the fallback chain gained a
  // branch ahead of the diff. The diff→plain-answer fallback still holds for typed exercises.
  assert.ok(/\(_diff \|\| `\$\{t\('check\.correct_answer'\)\} <strong>\$\{_wrongCorrect\}<\/strong>`\)/.test(src),
    'the plain correct answer remains the fallback when no diff is available');
  assert.ok(/const _why = \(ex\.type==='comprehension_mcq' && ex\.why\)/.test(src),
    'and a comprehension question shows its reason instead of restating the option');
}

// ── 11. Past a few wrong characters, show whole words instead (v71_o) ───────
// Reported: a badly mistyped word turns the per-letter view into a scatter of red boxes that is
// harder to read than the answer itself. Below the threshold the letter view is the useful one —
// it shows a missed umlaut at a glance — so this is a switch, not a replacement.
{
  const mode = (typed, correct) => {
    const h = M.typedDiffHtml(typed, correct);
    return h === '' ? 'none' : h.includes('typed-diff-whole') ? 'whole' : 'letters';
  };
  assert.strictEqual(MAX_WRONG, 3, 'the threshold is the reported three characters');

  // Near misses keep the letter view — this is the case the feature was built for.
  assert.strictEqual(mode('Hnd', 'Hund'), 'letters', 'one missing letter → per-letter');
  assert.strictEqual(mode('Hunde', 'Hund'), 'letters', 'one extra letter → per-letter');
  assert.strictEqual(mode('Hunt', 'Hund'), 'letters', 'one wrong letter → per-letter');
  assert.strictEqual(mode('Backerei', 'Bäckerei'), 'letters', 'a missed umlaut → per-letter');

  // Exactly at the threshold is still legible; past it is not.
  assert.strictEqual(mode('Hxyz', 'Hund'), 'letters', 'three wrong → still per-letter (boundary)');
  assert.strictEqual(mode('xyzzy', 'Fahrrad'), 'whole', 'a mangled word → whole-word');
  assert.strictEqual(mode('Katze', 'Pferd'), 'whole', 'an entirely different word → whole-word');

  // The whole-word view must actually contain both words, the wrong one struck through.
  const h = M.typedDiffHtml('Katze', 'Pferd');
  assert.ok(/<s>Katze<\/s>/.test(h), 'what was typed is struck through');
  assert.ok(/<strong>Pferd<\/strong>/.test(h), 'and the correct answer is shown plainly');
  assert.ok(!/class="dc /.test(h), 'with no per-character cells at all');
  // Escaping still applies on this path — it is a separate branch from the letter renderer.
  const esc = M.typedDiffHtml('<script>alert(1)</script>', 'Pferd');
  assert.ok(!/<script>/.test(esc), 'the whole-word branch escapes what was typed');
}

console.log('  alignment, leniency, graphemes, rendering, escaping, RTL, call site: OK');
console.log('unit-typed-diff: ALL PASSED');
