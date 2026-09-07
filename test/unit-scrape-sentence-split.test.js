// unit-scrape-sentence-split.test.js
// v90_o — a URL-scraped article must never be cut into chapters MID-SENTENCE.
//
// ⚠️ WHY THIS FIXTURE, AND WHY IT HAS NO NEWLINES. A schema.org `articleBody` is typically ONE
// unbroken run of prose: the stored fixture is the real Corriere article this feature was built
// against and it contains **zero** newline characters. That is the point of it, not an artefact.
// It means `_paragraphCount()` returns 1, paragraph mode is unavailable, and the scrape lands on
// the length splitter — the one path where a naive implementation WOULD cut mid-sentence, because
// a word budget knows nothing about sentences. `_splitIntoChunks` avoids that by accumulating whole
// units from `_sentenceUnits`, and this file pins that property against real prose rather than
// against a hand-made string that could never have exhibited the bug.
//
// ⚠️ WHAT PROMPTED IT: the user reported chapters broken mid-sentence for this article. Measured,
// the break came from the PDF/print upload path (whose own log line reads "3 chapter(s) (from
// upload)"), which puts the headline into the body hard-wrapped mid-phrase — a defect
// roadmap_v90.md had already recorded when it compared the two routes. The SCRAPE path was clean.
// This guard exists so that stays true rather than being re-measured by hand each time.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'newsarticle-body-it.json'), 'utf8'));

function ext(name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// Built by EXECUTING the real client functions, not by re-implementing the split here — a guard
// that re-implements the thing it guards is the trap `v90_b` found twice.
let code = '';
for (const n of ['_MAX_UNIT_CHARS', '_TITLE_MAX', '_SENT_END_RE']) {
  const m = src.match(new RegExp('^const ' + n + ' = .*$', 'm'));
  assert.ok(m, `found the ${n} constant`);
  code += m[0] + '\n';
}
for (const n of ['_sentenceSplit', '_sentenceUnits', '_unitsToText', '_autoTitle',
                 '_splitIntoChunks', 'wordCount', '_splitLongUnit', '_paragraphBlocks']) code += ext(n) + '\n';
const C = new Function('APP', code +
  '\nreturn { _splitIntoChunks, _sentenceUnits, _paragraphBlocks };')({ storyLen: 300 });

// ── 0. The fixture is what this guard claims it is ───────────────────────────
// Without this the file could pass against a fixture that had been quietly replaced by paragraphed
// text, which would exercise a different code path entirely and prove nothing about the scrape.
{
  assert.strictEqual((FIX.articleBody.match(/\n/g) || []).length, 0,
    'the fixture is ONE unbroken run with no newlines — that is what forces the length splitter, ' +
    'which is the path under test');
  assert.ok(FIX.articleBody.trim().length > 2000, 'the fixture is a real article, not a stub');
  assert.ok(C._paragraphBlocks(FIX.articleBody).length < 3,
    'paragraph mode is genuinely unavailable for this text (fewer than 3 blocks), so the client ' +
    'lands on the length splitter exactly as fetchStoryFromUrl computes it');
  console.log(`  fixture: ${FIX.words} words, 0 newlines, paragraph mode unavailable: OK`);
}

// ── 1. ⚠️ NO CHUNK MAY BEGIN OR END MID-SENTENCE, at any chapter size ────────
// Swept across sizes because the defect is size-dependent: a budget that happens to land on a
// sentence end at one target will land inside one at another.
{
  const SENT_END = /[.!?…]["'»«”’)\]]*$/u;
  let checked = 0;
  for (const target of [80, 120, 150, 200, 300, 400]) {
    const chunks = C._splitIntoChunks(FIX.articleBody, target);
    assert.ok(chunks.length >= 1, `target ${target} produced chunks`);
    chunks.forEach((c, i) => {
      const text = c.text.trim();
      assert.ok(text.length > 0, `target ${target} chunk ${i + 1} is not empty`);
      // Ends on sentence-final punctuation…
      assert.ok(SENT_END.test(text),
        `target ${target}, chunk ${i + 1} of ${chunks.length} ends MID-SENTENCE: ` +
        `…${JSON.stringify(text.slice(-70))}`);
      // …and begins where a sentence begins: an opening quote/dash is fine, a lowercase letter is
      // not — that is what a mid-sentence cut actually looks like in Italian, German or English.
      const first = text.replace(/^[«"'“‘\-–—\s]+/u, '').charAt(0);
      assert.ok(first && first === first.toUpperCase(),
        `target ${target}, chunk ${i + 1} of ${chunks.length} STARTS mid-sentence (lowercase ` +
        `opener ${JSON.stringify(first)}): ${JSON.stringify(text.slice(0, 70))}…`);
      checked++;
    });
  }
  console.log(`  ${checked} chunks across 6 chapter sizes, none broken mid-sentence: OK`);
}

// ── 2. Nothing is lost or duplicated by the split ────────────────────────────
// A splitter can respect sentence boundaries and still drop or repeat one. Compared on words, not
// on raw text, because _unitsToText normalises whitespace by design.
{
  const words = s => s.trim().split(/\s+/).filter(Boolean);
  const expected = words(FIX.articleBody);
  for (const target of [120, 300]) {
    const got = words(C._splitIntoChunks(FIX.articleBody, target).map(c => c.text).join(' '));
    assert.strictEqual(got.length, expected.length,
      `target ${target}: the chapters together hold every word of the article ` +
      `(expected ${expected.length}, got ${got.length})`);
    assert.strictEqual(got.join(' '), expected.join(' '),
      `target ${target}: and in the original order, with nothing substituted`);
  }
  console.log('  every word survives the split, in order, at two chapter sizes: OK');
}

// ── 3. The sentence detector actually found sentences in this text ───────────
// ⚠️ The anti-vacuity check. If `_sentenceUnits` returned ONE unit for the whole article, §1 would
// pass trivially — a single chunk always starts and ends on a sentence boundary — while proving
// nothing at all about where cuts land.
{
  const units = C._sentenceUnits(FIX.articleBody);
  assert.ok(units.length >= 10,
    `the detector found real sentence units in the fixture (got ${units.length}) — with one unit ` +
    'the whole of §1 would be vacuously true');
  assert.ok(C._splitIntoChunks(FIX.articleBody, 120).length >= 3,
    'and the small target really does produce several chapters, so §1 is testing boundaries ' +
    'rather than a single undivided chunk');

  // ⚠️ THE PRECONDITION FOR §1 TO MEAN ANYTHING, and it was missing on the first draft. The break
  // §1 guards against is only POSSIBLE where a sentence exceeded _MAX_UNIT_CHARS and was split into
  // fragment units — that is the case the `u.frag && !u.fragLast` rule exists for. Mutation-testing
  // found the hole: raising _MAX_UNIT_CHARS so nothing ever fragments left this whole file GREEN,
  // because §1 then only ever sees whole sentences and cannot fail. The fixture must actually
  // contain a sentence long enough to fragment, or the fix is not under test at all.
  const frags = units.filter(u => u.frag);
  assert.ok(frags.length >= 2,
    `the fixture contains a sentence long enough to be split into fragments (got ${frags.length} ` +
    'fragment units) — without one, §1 only ever sees whole sentences and passes vacuously');
  assert.ok(frags.some(u => !u.fragLast),
    'and at least one fragment is NOT the last of its sentence — that is precisely the unit a ' +
    'chapter must never end on');
  console.log(`  ${units.length} units incl. ${frags.length} sentence fragments — §1 is not vacuous: OK`);
}

console.log('unit-scrape-sentence-split: ALL PASSED');
