// Regression: parseTableLesson (table-format lessons, used by translategemma) must handle a header
// whose first cell is a NON-ASCII language name — e.g. "Lëtzebuergesch word". The old keyword filter
// used ASCII `\w+`, so the ë broke the match, the header row leaked in as the first vocab entry, the
// 8th real word was dropped (8-row cap), and the sentence table could vanish. The parser is now
// structure-anchored (header = the row before the `|---|` separator), so it's language-independent.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'not found: ' + name);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const { parseTableLesson } = new Function(extract('parseTableLesson') + '\nreturn { parseTableLesson };')();

const WORDS = [
  '| Haus | Haus | haus |', '| Kaz | Katze | kats |', '| Hond | Hund | hont |', '| Bam | Baum | bam |',
  '| Waasser | Wasser | vaasser |', '| Buch | Buch | buch |', '| Dag | Tag | dahg |', '| Nuecht | Nacht | nuecht |',
];
const SENTS = ["| D'Haus ass grouss. | Das Haus ist groß. |", "| D'Kaz schléift. | Die Katze schläft. |"];
const looksLikeHeader = v => /\b(word|meaning|sentence|translation|pronunciation)\b/i.test(v.target + ' ' + v.source);

// ── The bug: non-ASCII header, tables running together (worst case) ──────────────
{
  const raw = [
    '| Lëtzebuergesch word | German meaning | Pronunciation for German speakers |', '|---|---|---|',
    ...WORDS,
    '| Lëtzebuergesch sentence | German translation |', '|---|---|',
    ...SENTS,
  ].join('\n');
  const r = parseTableLesson(raw, 1, 'Déieren');
  assert.ok(!r.vocab.some(looksLikeHeader), 'no header row leaked into vocab (Lëtzebuergesch)');
  assert.strictEqual(r.vocab.length, 8, 'all 8 real words survive (8th not dropped by the header leak)');
  assert.deepStrictEqual(r.vocab[0], { target: 'Haus', source: 'Haus' }, 'first vocab is the first real word');
  assert.deepStrictEqual(r.vocab[7], { target: 'Nuecht', source: 'Nacht' }, '8th word present');
  assert.strictEqual(r.sentences.length, 2, 'sentence table survived the run-together layout');
  assert.ok(!r.sentences.some(looksLikeHeader), 'no header row leaked into sentences');
}

// ── Same, but with a heading line between the two tables ──────────────────────────
{
  const raw = [
    '| Lëtzebuergesch word | German meaning | Pronunciation |', '|---|---|---|',
    ...WORDS,
    'Table 2 — Sentences (exactly 5 rows):',
    '| Lëtzebuergesch sentence | German translation |', '|---|---|',
    ...SENTS,
  ].join('\n');
  const r = parseTableLesson(raw, 2, 'Déieren');
  assert.ok(!r.vocab.some(looksLikeHeader), 'heading-between: no header leak in vocab');
  assert.strictEqual(r.vocab.length, 8, 'heading-between: 8 words');
  assert.strictEqual(r.sentences.length, 2, 'heading-between: 2 sentences');
}

// ── ASCII header (German target) still works — the fix didn't regress the old path ─
{
  const raw = [
    '| German word | English meaning | Pronunciation |', '|---|---|---|',
    '| Haus | house | hows |', '| Katze | cat | kah-tse |', '| Hund | dog | hunt |',
    '| Sentence in German | English |', '|---|---|',
    '| Das Haus ist groß. | The house is big. |',
  ].join('\n');
  const r = parseTableLesson(raw, 1, 'Tiere');
  assert.ok(!r.vocab.some(looksLikeHeader), 'ASCII header still skipped');
  assert.strictEqual(r.vocab.length, 3, 'ASCII vocab rows parsed');
  assert.deepStrictEqual(r.vocab[0], { target: 'Haus', source: 'house' }, 'ASCII first vocab');
  assert.strictEqual(r.sentences.length, 1, 'ASCII sentence parsed');
}

// ── Other diacritic language names also handled (Español) ─────────────────────────
{
  const raw = ['| Español word | English meaning |', '|---|---|', '| casa | house |', '| perro | dog |'].join('\n');
  const r = parseTableLesson(raw, 1, 'Animales');
  assert.ok(!r.vocab.some(looksLikeHeader), 'Español header skipped');
  assert.strictEqual(r.vocab.length, 2, 'Español vocab parsed');
}

// ── Malformed: no separator rows → positional fallback (first pipe row = header) ───
{
  const raw = ['| Lëtzebuergesch word | German meaning |', '| Haus | Haus |', '| Kaz | Katze |'].join('\n');
  const r = parseTableLesson(raw, 1, 'X');
  assert.ok(!r.vocab.some(looksLikeHeader), 'no-separator fallback still drops the header row');
  assert.strictEqual(r.vocab.length, 2, 'no-separator fallback keeps the data rows');
}

// ── Guard: a table with no usable rows throws (unchanged contract) ────────────────
assert.throws(() => parseTableLesson('| Lëtzebuergesch word | German meaning |\n|---|---|', 1, 'X'),
  /Table parse/, 'header-only table (no data) still throws');

console.log('  parseTableLesson: non-ASCII header handled, all rows kept, sentences preserved: OK');
