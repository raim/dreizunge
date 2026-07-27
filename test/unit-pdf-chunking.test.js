// unit-pdf-chunking.test.js
// v70_k: chapter boundaries fall on SENTENCES, not on paragraph breaks.
//
// User report: "the block selection for separation into chapters doesn't work well on the cleaned
// pdf ... it seems to break mid-sentence". Reproduced: _cleanPdfText drops page furniture, so a
// page number sitting between the two halves of a sentence leaves a blank line where the sentence
// continues. The old paragraph-based splitter read that as a boundary and cut the sentence in half.
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
const sentEnd = src.match(/const _SENT_END_RE = ([^;]+);/);
assert.ok(sentEnd, 'the module-level sentence-end pattern exists');
const M = new Function(
  'const _SENT_END_RE = ' + sentEnd[1] + ';\n' + src.match(/const _TITLE_MAX = \d+;/)[0] + '\n' +
  extract('_cleanPdfText') + '\nlet _lastCleanStats = null;\n' +
  extract('_sentenceSplit') + extract('_sentenceUnits') + extract('_unitsToText') +
  extract('_splitIntoChunks') + extract('_autoTitle') +
  '\nreturn { _cleanPdfText, _sentenceUnits, _unitsToText, _splitIntoChunks };')();

const ENDS_SENTENCE = /[.!?…]["'»«”’)\]]*$/u;
const words = s => String(s).split(/\s+/).filter(Boolean).length;

// ── 1. The reported case: a sentence straddling a page break ─────────────────
{
  const raw = ['Er ging weiter, ohne sich umzudrehen, und der Weg wurde', '', '7', '',
               'schmaler, bis er die Hütte erreichte. Dort blieb er stehen.'].join('\n');
  const cleaned = M._cleanPdfText(raw);
  // Cleanup legitimately leaves a blank line where the page number was.
  assert.ok(/wurde\n\nschmaler/.test(cleaned), 'cleanup leaves a false paragraph boundary here');

  const units = M._sentenceUnits(cleaned);
  assert.strictEqual(units.length, 2, 'the two halves are rejoined into one sentence, plus the next');
  assert.ok(/wurde schmaler/.test(units[0].text), 'the sentence is whole again');
  assert.ok(ENDS_SENTENCE.test(units[0].text), 'and it ends where a sentence ends');

  const chunks = M._splitIntoChunks(cleaned, 8);
  chunks.forEach((c, i) => assert.ok(ENDS_SENTENCE.test(c.text.trim()),
    `chunk ${i} ends at a sentence boundary, not mid-sentence`));
  console.log(`  page-break sentence: rejoined, ${chunks.length} chunk(s), none cut mid-sentence`);
}

// ── 2. REAL paragraph boundaries must survive the repair ────────────────────
// The repair only joins when the first part does not end like a sentence AND the second starts
// lowercase. A properly-ended paragraph followed by a capitalised one is a genuine break.
{
  const t = 'Der Wald war still.\n\nEr ging weiter.';
  const units = M._sentenceUnits(t);
  assert.strictEqual(units.length, 2);
  assert.strictEqual(units[0].para, 0);
  assert.strictEqual(units[1].para, 1, 'a real paragraph boundary is preserved');
  assert.ok(units[0].endsPara && units[1].endsPara, 'both units close their paragraph');
  // German capitalises nouns, so a wrapped line often starts uppercase — that must NOT be joined
  // when the previous part already ended a sentence.
  const t2 = 'Die Sonne stand tief.\n\nSchatten lagen im Gras.';
  assert.strictEqual(M._sentenceUnits(t2).length, 2, 'a capitalised German noun does not trigger a join');
  console.log('  real paragraph boundaries preserved (incl. capitalised German nouns)');
}

// ── 3. Sentence splitting keeps its punctuation ─────────────────────────────
{
  const units = M._sentenceUnits('Er rief: "Halt!" Sie blieb stehen. Warum denn? Niemand wusste es.');
  assert.ok(units.length >= 3, 'multiple sentences found');
  units.forEach(u => assert.ok(ENDS_SENTENCE.test(u.text) || u === units[units.length - 1],
    'every complete sentence keeps its terminal punctuation'));
  assert.ok(units.some(u => /Halt!"/.test(u.text)), 'a closing quote stays with its sentence');
  // An unterminated trailing fragment is still emitted rather than dropped.
  const frag = M._sentenceUnits('Ein ganzer Satz. Und ein Rest ohne Punkt');
  assert.ok(/ohne Punkt$/.test(frag[frag.length - 1].text), 'a trailing fragment is kept');
  console.log('  sentence splitting keeps punctuation, quotes, and trailing fragments');
}

// ── 4. THE invariant: no chunk boundary falls inside a sentence ─────────────
{
  // A page of prose with furniture scattered through it, as a scanned book yields.
  const raw = [
    'Kapitel eins', '', 'Der Wald war still und dunkel, und der Pfad', 'führte bergauf.', '', '12', '',
    'Am Abend erreichte er die Hütte. Drinnen brannte noch ein Feuer, das', '', '13', '',
    'langsam herunterbrannte. Er setzte sich davor.', '',
    'Draußen begann es zu schneien. Die Nacht war lang und kalt.', '',
    'Am Morgen war der Weg verschwunden. Er wartete. Nichts geschah.',
  ].join('\n');
  const cleaned = M._cleanPdfText(raw);
  for (const target of [10, 20, 40, 300]) {
    const chunks = M._splitIntoChunks(cleaned, target);
    assert.ok(chunks.length >= 1, `target ${target} produces chunks`);
    chunks.forEach((c, i) => {
      if (i < chunks.length - 1)
        assert.ok(ENDS_SENTENCE.test(c.text.trim()),
          `target ${target}, chunk ${i} must not end mid-sentence: …${c.text.slice(-40)}`);
      assert.ok(c.wordCount > 0, 'no empty chunk');
    });
    // Nothing is lost or duplicated: the concatenated chunks hold every word, in order.
    const all = chunks.map(c => c.text).join(' ').split(/\s+/).filter(Boolean);
    const orig = M._unitsToText(M._sentenceUnits(cleaned)).split(/\s+/).filter(Boolean);
    assert.deepStrictEqual(all, orig, `target ${target}: chunking is lossless and order-preserving`);
  }
  console.log('  invariant holds at 4 target sizes: no mid-sentence cut, lossless, in order');
}

// ── 5. Sizing behaviour ─────────────────────────────────────────────────────
{
  const sentences = [];
  for (let i = 0; i < 40; i++) sentences.push(`Dies ist Satz Nummer ${i} und er ist lang genug.`);
  const text = sentences.join(' ');
  const chunks = M._splitIntoChunks(text, 50);
  assert.ok(chunks.length > 3, 'a long text splits into several chapters');
  // No stub chapter: the tail is absorbed rather than left as a fragment.
  const last = chunks[chunks.length - 1];
  assert.ok(last.wordCount >= 50 * 0.35, `the tail is not a stub (${last.wordCount}w)`);
  console.log(`  sizing: ${chunks.length} chunks, sizes ${chunks.map(c => c.wordCount).join('/')}`);
}

// ── 5b. Natural breaks are PREFERRED once a chunk is within reach ───────────
// Sentence boundaries are the hard rule; paragraph boundaries are the nicer cut when one is
// available near the target. Without this a chapter can end one sentence into a new paragraph.
{
  const para = n => `Absatz ${n} beginnt hier. Er hat zwei Sätze und endet sauber.`;
  const text = [para(1), para(2), para(3), para(4)].join('\n\n');
  const chunks = M._splitIntoChunks(text, 14);      // ≈ one paragraph each, with 0.7 slack
  assert.ok(chunks.length >= 3, 'splits into several chapters');
  chunks.slice(0, -1).forEach((c, i) =>
    assert.ok(/endet sauber\.$/.test(c.text.trim()),
      `chunk ${i} ends at the paragraph boundary, not one sentence past it: …${c.text.slice(-30)}`));
  console.log('  paragraph boundaries preferred as cut points when near the target');
}

// ── 6. Degenerate input ─────────────────────────────────────────────────────
assert.deepStrictEqual(M._splitIntoChunks('', 100), [], 'empty text yields no chunks');
assert.deepStrictEqual(M._splitIntoChunks('   \n\n  ', 100), [], 'whitespace yields no chunks');
assert.deepStrictEqual(M._sentenceUnits(null), [], 'null is handled');
{
  const one = M._splitIntoChunks('Ein einziger Satz.', 100);
  assert.strictEqual(one.length, 1, 'a single sentence is one chunk');
  assert.strictEqual(one[0].text, 'Ein einziger Satz.');
  // Text with no terminal punctuation at all must still chunk rather than vanish.
  const nop = M._splitIntoChunks('kein satzende hier nur woerter ohne punkt', 3);
  assert.ok(nop.length >= 1 && nop[0].wordCount > 0, 'unpunctuated text still produces a chunk');
}
console.log('  degenerate input: empty / whitespace / null / single / unpunctuated all handled');

// ── 7. The manual splitter works on the same units ──────────────────────────
// The editor lists break points from _sentenceUnits, so a cleaned PDF whose paragraph structure is
// gone is still splittable — previously canSplit was false and the ✂ button disappeared.
assert.ok(/const units = _sentenceUnits\(c\.text\|\|''\);/.test(src.replace(/\s+/g, m => m.includes('\n') ? m : ' '))
       || /_sentenceUnits\(c\.text/.test(src), 'the chunk editor lists sentence units');
assert.ok(/const units = _sentenceUnits\(c\.text \|\| ''\);/.test(src), 'pdfDoSplit splits on sentence units');
assert.ok(!/const paras = \(c\.text\|\|''\)\.split\(\/\\n\\n\+\//.test(src), 'the paragraph-based editor is gone');

// ── 8. A glued period is not a sentence end (v71_b) ─────────────────────────
// Pre-existing defect, found while asserting word-parity on paragraph chapters: the splitter cut
// at every period, and _unitsToText rejoined the pieces with a space, so chapter text came back
// altered. These strings are from the user's own article ("500.000 anni fa", "S.J. Gould").
{
  const cases = [
    'Con i Neanderthal abbiamo avuto un antenato vissuto sempre in Africa 500.000 anni fa.',
    'S.J. Gould, 1989, La vita meravigliosa, Feltrinelli, Milano, 1990.',
    'Er kam um 15.30 Uhr an. Dann ging er.',
    'Die Datei heisst bericht.txt und liegt dort.',
  ];
  cases.forEach(c => {
    const round = M._splitIntoChunks(c, 500).map(x => x.text).join(' ');
    assert.strictEqual(round, c, `chunking round-trips this text unchanged: ${JSON.stringify(c)}`);
  });
  // The number itself must survive inside a unit, not be split across two.
  const u = M._sentenceUnits('Es waren 500.000 Menschen.');
  assert.strictEqual(u.length, 1, '500.000 is one sentence, not two');
  assert.ok(/500\.000/.test(u[0].text), 'and the number is intact');
  // Real sentence boundaries still split.
  assert.strictEqual(M._sentenceUnits('Er ging. Sie blieb.').length, 2, 'real sentence ends still split');
  console.log('  glued periods (500.000, S.J., 15.30, bericht.txt) no longer split or corrupt text');
}

console.log('unit-pdf-chunking: ALL PASSED');
