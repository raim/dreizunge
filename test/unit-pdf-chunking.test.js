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
  src.match(/const _MAX_UNIT_CHARS = \d+;/)[0] + '\n' +
  extract('_sentenceSplit') + extract('_splitLongUnit') + extract('_sentenceUnits') + extract('_unitsToText') +
  extract('_splitIntoChunks') + extract('_autoTitle') +
  '\nreturn { _cleanPdfText, _sentenceUnits, _unitsToText, _splitIntoChunks, _splitLongUnit };')();

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


// ── 9. _splitLongUnit is RUN, not merely present (v90_c audit follow-up) ─────
//
// ⚠️ Why this section exists. `_splitLongUnit` was already compiled into the module above and
// already executing — `unit-pdf-paragraphs`' article contains sentences past the 300-character
// budget, so the over-budget path really ran. It just made no difference to anything asserted:
// flipping any of its twelve branch conditions, in either direction, left BOTH pdf test files
// green. The word-count invariant those files rely on is invariant under WHERE the cut lands (the
// words are all still there wherever you cut), and no assertion looked at the pieces.
//
// That is the blind spot the v90_b/v90_c audit named and could not see: a guard that runs the right
// function on a fixture whose answer does not change when the function does. The repair is not a
// new guard over new code — it is assertions that DISCRIMINATE.
//
// Budgets are passed explicitly so the fixtures stay readable; §10 covers the real 300 default.
{
  const S = M._splitLongUnit;

  // Under budget: returned whole, and nothing at all for nothing at all.
  assert.deepStrictEqual(S('kurz.', 40), ['kurz.'], 'a short unit is returned whole');
  assert.deepStrictEqual(S('', 40), [], 'empty text yields no units, not one empty unit');
  assert.deepStrictEqual(S(null, 40), [], 'and neither does a missing one');

  // ⚠️ THE PREFERENCE ORDER, which is the whole design: a clause boundary beats a later word gap.
  // A splitter that simply took the last gap inside the budget would cut after "theta" (39 chars);
  // this cuts after the comma (17), giving up 22 characters of budget to break where the sense does.
  {
    const parts = S('alpha beta gamma, delta epsilon zeta eta theta iota kappa lambda mu', 40);
    assert.strictEqual(parts[0], 'alpha beta gamma,', 'the cut lands on the clause boundary…');
    assert.notStrictEqual(parts[0], 'alpha beta gamma, delta epsilon zeta eta',
      '…and NOT on the last word gap that would have fitted');
    // …but with no punctuation to prefer, the last gap inside the budget is exactly right.
    const plain = S('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu', 40);
    assert.strictEqual(plain[0], 'alpha beta gamma delta epsilon zeta eta', 'with no clause, the widest word gap wins');
    assert.ok(plain[0].length <= 40 && plain[0].length > 30, `and it uses the budget (${plain[0].length}/40)`);
  }

  // ⚠️ EVERY CUT IS ANCHORED TO EXISTING WHITESPACE. The source calls this load-bearing: Segmenter
  // reports word boundaries INSIDE a token — `l'aria` as `l` `'` `aria`, `30-32` as `30` `-` `32` —
  // so cutting at an arbitrary boundary and rejoining with a space turns one word into two. That
  // defect was found once by a word count (937 against 934); assert it directly instead.
  {
    const text = "l'aria era 30-32 gradi ogni giorno d'estate nella valle stretta";
    const parts = S(text, 30);
    assert.ok(parts.length > 1, 'the fixture really is over budget');
    assert.strictEqual(parts.join(' '), text, 'rejoining the pieces restores the original exactly');
    for (const tok of ["l'aria", '30-32', "d'estate"]) {
      assert.ok(parts.some(p => p.includes(tok)), `${tok} survives whole in one piece`);
      assert.ok(!parts.some(p => p.endsWith(tok.slice(0, 2)) && !p.endsWith(tok)),
        `${tok} is never cut mid-token`);
    }
  }

  // No hand-written punctuation list — the same clause preference in a script with different marks.
  {
    const ar = S('الطقس اليوم جميل، والسماء صافية تماما وهذا يجعل النزهة ممتعة جدا', 40);
    assert.ok(ar[0].endsWith('،'), 'the Arabic comma is found as a clause boundary, with nothing hand-written');
    assert.ok(ar.length > 1, 'and the unit really was split');
  }

  // A script with no whitespace yields NO candidates, and the correct answer is to leave it whole:
  // splitting CJK on character count would cut mid-word, which is worse than a long unit.
  {
    const ja = '日本語の文章はここで区切られます。とても長い文です。';
    assert.deepStrictEqual(S(ja, 10), [ja],
      'a whitespace-free script is left whole rather than cut mid-word — even far over budget');
  }

  // Progress guarantee: when nothing fits inside the budget the next gap is taken anyway, so the
  // loop always advances. A regression here is an infinite loop, not a wrong answer.
  {
    const parts = S('abcdefghijklmnopqrstuvwxyz then short bits', 10);
    assert.strictEqual(parts[0], 'abcdefghijklmnopqrstuvwxyz',
      'an over-long leading token is emitted whole rather than cut, and the loop moves on');
    assert.deepStrictEqual(parts.slice(1), ['then', 'short', 'bits'], 'and the rest still splits');
  }

  // No piece is ever blank. Downstream these become UNITS, and a blank unit is a blank sentence in
  // the chapter — the two guards `if (piece)` / `if (tail)` exist for exactly this, and dropping
  // either of them is invisible to every other assertion here.
  // These three inputs each end with the cut ON the final whitespace run, so the remainder handed to
  // the trailing `if (tail)` is whitespace only — the one input shape that reaches that guard.
  // (Found by searching for it: an empty `piece` never occurs, because a cut is always the START of
  // a maximal whitespace run and two of those cannot be adjacent. `if (piece)` is therefore
  // unreachable defensive code, and no fixture can kill a mutation of it. `if (tail)` is not.)
  for (const [label, text, budget] of [
    ['a trailing space',        'alpha beta ', 10],
    ['an even split',           'alpha beta gamma delta ', 12],
    ['several pieces',          'one two three four five ', 10],
  ]) {
    const parts = S(text, budget);
    assert.deepStrictEqual(parts.filter(p => !p.trim()), [],
      `${label}: no blank unit is emitted — downstream that is a blank sentence in the chapter`);
    assert.strictEqual(parts.join(' '), text.trim(), `${label}: and the words are all still there`);
  }
}
console.log('  _splitLongUnit: clause > gap, cuts on existing whitespace only, CJK left whole: OK');

// ── 10. …and the fragments are MARKED as fragments ───────────────────────────
// `_sentenceUnits` flags pieces that came out of a sub-split (`frag`/`fragFirst`/`fragLast`) so a
// consumer can say "excerpt" rather than present half a sentence as a whole one — the defect the
// source comment records against `_synContext`. Nothing asserted those flags, and the branch that
// sets them only runs when a real sentence exceeds the real 300-character budget.
{
  const long = 'Er ging weiter durch den Wald, ' + 'immer tiefer zwischen die alten Bäume hinein, '.repeat(8) + 'und blieb dann stehen.';
  assert.ok(long.length > 300, `the fixture clears the real budget (${long.length} chars)`);
  const units = M._sentenceUnits(long + ' Danach war es still.');

  const frags = units.filter(u => u.frag);
  assert.ok(frags.length > 1, `the long sentence became several fragments (${frags.length})`);
  assert.strictEqual(frags.filter(u => u.fragFirst).length, 1, 'exactly one is marked as the first');
  assert.strictEqual(frags.filter(u => u.fragLast).length, 1, 'and exactly one as the last');
  assert.ok(frags[0].fragFirst, 'the first fragment is the one marked first');
  assert.ok(frags[frags.length - 1].fragLast, 'and the last is marked last');

  const whole = units.filter(u => !u.frag);
  assert.strictEqual(whole.length, 1, 'the short sentence beside it is one unit');
  assert.ok(!whole[0].fragFirst && !whole[0].fragLast,
    'and carries NO fragment flags — a whole sentence must not read as an excerpt');

  // and the text still survives the round trip
  assert.ok(M._unitsToText(units).replace(/\s+/g, ' ').includes('immer tiefer zwischen die alten Bäume hinein'),
    'rejoining the fragments restores the sentence');
}
console.log('  sentence fragments are flagged frag/fragFirst/fragLast, whole sentences are not: OK');

console.log('unit-pdf-chunking: ALL PASSED');
