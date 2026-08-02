// unit-pdf-paragraphs.test.js
// v71_b: paragraph structure is recovered from PDF GEOMETRY, not guessed from the text.
//
// User request: "the text in this PDF is nicely structured, we could automatically detect
// paragraphs to be converted to chapters". Reproduced against the PDF they sent (Corriere,
// Telmo Pievani, "Evoluzione", 3pp Italian): extraction joined every line with \n and threw the
// geometry away, so the whole 15-paragraph article reached the splitter as ONE paragraph, chapter
// titles came out as mid-sentence fragments, and a paragraph-based split was impossible.
//
// The fixture is that article's real line geometry (y, x, text per line, pdf.js convention),
// not a synthetic stand-in — the leading is 14.50pt, paragraph gaps are 27.25pt and heading gaps
// 32.10pt, and those exact ratios are what the detector keys off.
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
const consts = src.match(/const _PARA_GAP_FACTOR = [\s\S]*?const _PARA_INDENT_MIN = \d+;/);
assert.ok(consts, 'the paragraph-detection thresholds are module-level constants');
const sentEnd = src.match(/const _SENT_END_RE = ([^;]+);/);
assert.ok(sentEnd, 'the module-level sentence-end pattern exists');
const minW = src.match(/const _PARA_CHUNK_MIN_WORDS = \d+;/);
const titleMax = src.match(/const _TITLE_MAX = \d+;/);
assert.ok(titleMax, 'the title length cap is a module-level constant');
assert.ok(minW, 'the paragraph-chapter floor is a module-level constant');
const M = new Function(
  'const _SENT_END_RE = ' + sentEnd[1] + ';\n' + consts[0] + '\n' + minW[0] + '\n' + titleMax[0] + '\nlet _lastCleanStats = null;\n' +
  extract('splitWords') + extract('wordCount') +
  extract('_linesToParagraphs') + extract('_cleanPdfText') + extract('cleanExtractedText') +
  src.match(/const _MAX_UNIT_CHARS = \d+;/)[0] + '\n' +
  extract('_sentenceSplit') + extract('_splitLongUnit') + extract('_sentenceUnits') + extract('_unitsToText') +
  extract('_isHeadingPara') + extract('_paragraphBlocks') + extract('_splitIntoParagraphChunks') +
  extract('_autoTitle') +
  '\nreturn { _linesToParagraphs, _cleanPdfText, cleanExtractedText, _isHeadingPara, ' +
  '_paragraphBlocks, _splitIntoParagraphChunks, _autoTitle };')();

// The real article as the client assembles it: geometry -> paragraphs -> per-page clean -> joined.
function articleText() {
  const pageTexts = pages.map(p => M._cleanPdfText(M._linesToParagraphs(p)));
  return M._cleanPdfText(pageTexts.join('\n\n'));
}

const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'pdf-lines-corriere.json'), 'utf8'));
const paras = txt => txt.split(/\n\n+/).filter(Boolean);
const words = s => String(s).split(/\s+/).filter(Boolean).length;

// ── 1. The real article: line count in, paragraph count out ──────────────────
// 41 and 34 lines resolve to the 9 and 8 blocks a reader sees on those two pages.
{
  const got = pages.map(p => paras(M._linesToParagraphs(p)));
  assert.strictEqual(got[0].length, 9, 'page 1 has 9 paragraphs (3 masthead lines + 2 body + heading + 3 body)');
  assert.strictEqual(got[1].length, 8, 'page 2 has 8 paragraphs (body + heading + 2 body + biblio block + date + rights)');
  // The contrast that matters: the OLD behaviour joined lines with \n and produced one block.
  const oldWay = pages[0].map(r => r.text).join('\n');
  assert.strictEqual(paras(oldWay).length, 1, 'joining lines without geometry yields a single block');
  console.log(`  real article: ${pages[0].length}+${pages[1].length} lines -> ${got[0].length}+${got[1].length} paragraphs (was 1)`);
}

// ── 2. Headings come out as their own paragraphs ─────────────────────────────
// They are what a chapter title should be drawn from, so they must not be glued to the body.
{
  const p1 = paras(M._linesToParagraphs(pages[0]));
  const p2 = paras(M._linesToParagraphs(pages[1]));
  assert.ok(p1.includes('Selezione naturale'), 'the section heading is its own paragraph');
  assert.ok(p2.includes('La teoria darwiniana si aggiorna'), 'the second heading likewise');
  // and the body that follows a heading is NOT merged into it
  const i = p1.indexOf('Selezione naturale');
  assert.ok(/^Il secondo pilastro/.test(p1[i + 1]), 'the paragraph after the heading starts on its own');
}

// ── 3. Wraps inside a paragraph are joined — including before a capital ──────
// This is the case the downstream lowercase-start heuristic cannot get right: the line "…Con i"
// wraps into "Neanderthal, i nostri cugini…", and a capitalised continuation looks exactly like
// a new block to any text-only rule. The geometry knows it is the same paragraph.
{
  const p1 = paras(M._linesToParagraphs(pages[0]));
  const body = p1.find(p => p.startsWith('Tutti gli esseri viventi'));
  assert.ok(body, 'the second body paragraph is present');
  assert.ok(!body.includes('\n'), 'a paragraph is a single flowing line, with no wrap newlines left');
  assert.ok(/Con i Neanderthal, i nostri cugini umani/.test(body),
    'a wrap before a capitalised word is still joined (Con i / Neanderthal)');
  assert.ok(/sempre in Africa 500\.000 anni fa\.$/.test(body), 'and the paragraph runs to its real end');
  assert.ok(words(body) > 100, `the paragraph is whole (${words(body)} words)`);
}

// ── 4. Indent-only layouts (most printed novels) ─────────────────────────────
// No extra space between paragraphs; the first line is indented instead. Same leading throughout,
// so the gap signal finds nothing and the indent signal has to carry it.
{
  const L = (i, y, x, text) => ({ y, x, text });
  const rows = [
    L(0, 700, 60, 'Er ging durch den Wald und dachte an nichts.'),
    L(1, 686, 48, 'Die Bäume standen still.'),
    L(2, 672, 48, 'Es war kalt.'),
    L(3, 658, 60, 'Am nächsten Morgen kehrte er zurück.'),
    L(4, 644, 48, 'Niemand hatte ihn vermisst.'),
  ];
  const got = paras(M._linesToParagraphs(rows));
  assert.strictEqual(got.length, 2, 'indent marks the paragraph starts when spacing does not');
  assert.ok(got[0].startsWith('Er ging'), 'first paragraph starts at the first indent');
  assert.ok(got[1].startsWith('Am nächsten Morgen'), 'second paragraph starts at the second indent');
}

// ── 5. A spaced document is NOT additionally split by indentation ────────────
// Centred lines, hanging quotes and drop caps all sit right of the margin. Once spacing has
// answered the question, indent must not get a second vote.
{
  const rows = [
    { y: 700, x: 42, text: 'Erste Zeile eines Absatzes, der weiterläuft.' },
    { y: 686, x: 42, text: 'und hier noch weiter geht bis zum Ende.' },
    { y: 659, x: 90, text: 'Ein zentrierter Zwischentitel' },          // indented AND spaced
    { y: 632, x: 42, text: 'Der zweite Absatz beginnt hier.' },
    { y: 618, x: 42, text: 'und endet hier.' },
  ];
  const got = paras(M._linesToParagraphs(rows));
  assert.strictEqual(got.length, 3, 'three blocks by spacing');
  assert.ok(!got.some(p => p === 'und hier noch weiter geht bis zum Ende.'),
    'the indented centred line did not cause an extra split inside paragraph 1');
}

// ── 6. Dehyphenation across a wrap ───────────────────────────────────────────
{
  const rows = [
    { y: 700, x: 42, text: 'Die Zusammen-' },
    { y: 686, x: 42, text: 'setzung war neu.' },
  ];
  assert.strictEqual(M._linesToParagraphs(rows), 'Die Zusammensetzung war neu.',
    'a hyphen at a wrap is closed up, not left with a space');
  // A compound that broke at its OWN hyphen keeps it — and still gains no space.
  const rows2 = [
    { y: 700, x: 42, text: 'Das Nord-' },
    { y: 686, x: 42, text: 'Süd-Gefälle blieb.' },
  ];
  assert.strictEqual(M._linesToParagraphs(rows2), 'Das Nord-Süd-Gefälle blieb.',
    'a compound broken at its own hyphen keeps the hyphen and gains no space');
}

// ── 7. Degenerate input must not throw ───────────────────────────────────────
{
  assert.strictEqual(M._linesToParagraphs([]), '', 'no lines -> empty string');
  assert.strictEqual(M._linesToParagraphs(null), '', 'null -> empty string');
  assert.strictEqual(M._linesToParagraphs([{ y: 700, x: 42, text: 'Nur eine Zeile.' }]), 'Nur eine Zeile.',
    'a single line is a single paragraph');
  assert.strictEqual(M._linesToParagraphs([{ y: 700, x: 42, text: '   ' }]), '', 'blank lines are dropped');
}

// ── 8. Paragraph chapters on the real article ────────────────────────────────
// 15 paragraphs become 8 chapters: headings title the section they introduce instead of becoming
// 2-word chapters, and the date/rights tail joins the last chapter instead of becoming two more.
{
  const text = articleText();
  assert.strictEqual(M._paragraphBlocks(text).length, 15, 'the article has 15 paragraph blocks');
  const ch = M._splitIntoParagraphChunks(text);
  assert.strictEqual(ch.length, 8, 'which shape into 8 chapters');
  ch.forEach((c, i) => assert.ok(c.wordCount >= 40,
    `chapter ${i + 1} clears the floor (${c.wordCount}w) — no 2-word stub chapters`));
  // Nothing is lost: every word of the document is in some chapter.
  const inWords = text.split(/\s+/).filter(Boolean).length;
  const outWords = ch.reduce((s, c) => s + c.wordCount, 0);
  assert.strictEqual(outWords, inWords, 'every word of the document ends up in a chapter');
  console.log(`  paragraph chapters: 15 blocks -> ${ch.length} chapters, ` +
    `${Math.min(...ch.map(c => c.wordCount))}-${Math.max(...ch.map(c => c.wordCount))}w, ${outWords}w total`);
}

// ── 9. A heading titles the following chapter, and stays in its text ─────────
{
  const ch = M._splitIntoParagraphChunks(articleText());
  const sel = ch.find(c => c.title === 'Selezione naturale');
  assert.ok(sel, 'the section heading became a chapter title');
  assert.ok(/^Selezione naturale/.test(sel.text), 'and is kept in the body — a misfire costs a title, not content');
  assert.ok(/Il secondo pilastro/.test(sel.text), 'the section body follows the heading in the same chapter');
  assert.strictEqual(ch[0].title, 'Evoluzione', 'the masthead titles chapter 1 rather than becoming its own chapter');
  assert.ok(/Telmo Pievani/.test(ch[0].text), 'the byline is kept, not discarded');
  const appro = ch.find(c => c.title === 'Per approfondire');
  assert.ok(appro, 'a heading ending in a colon is a heading, with the colon trimmed from the title');
}

// ── 10. The floor absorbs stub paragraphs (dialogue-heavy fiction) ───────────
// Without it, every one-line exchange would be its own chapter.
{
  const t = ['«Wo warst du?»', '«Im Wald.»', '«Und dann?»', '«Dann kam der Regen.»',
    'Sie schwieg eine Weile und sah aus dem Fenster, wo der Regen gegen das Glas schlug und ' +
    'die Straße unter den Lichtern der Laternen glänzte.'].join('\n\n');
  const ch = M._splitIntoParagraphChunks(t);
  assert.strictEqual(ch.length, 1, 'four short exchanges plus a paragraph make one chapter, not five');
  assert.ok(/Wo warst du/.test(ch[0].text) && /Laternen/.test(ch[0].text), 'and all of it is there');
}

// ── 11. A heading only closes a section that is already a real chapter ──────
{
  assert.ok(M._isHeadingPara('Selezione naturale'), 'short and unpunctuated is a heading');
  assert.ok(M._isHeadingPara('Per approfondire:'), 'a colon does not end a sentence');
  assert.ok(!M._isHeadingPara('Er ging fort.'), 'a sentence is not a heading');
  assert.ok(!M._isHeadingPara('Ein sehr langer Zwischentitel der viel zu viele Wörter enthält um noch einer zu sein'),
    'an over-long line is not a heading');
}

// ── 12. No paragraph structure -> one chapter (so the mode must not be defaulted to) ──
// Documents whose extraction yields a single block are exactly the case the length slider is for;
// asserting the degenerate result here is what justifies the caller checking the block count.
{
  const flat = 'Ein Satz. Noch einer. Und ein dritter, der etwas länger ausfällt als die beiden davor.';
  assert.strictEqual(M._paragraphBlocks(flat).length, 1, 'no blank lines -> one block');
  assert.strictEqual(M._splitIntoParagraphChunks(flat).length, 1, '-> one chapter, which is not useful');
}

// ── 13. Titles start where the text starts (v71_b) ───────────────────────────
// The old window regex returned the TAIL of any opening sentence longer than 80 characters, which
// is every paragraph in this article. A title must be a prefix of its chapter, never a fragment.
{
  const ch = M._splitIntoParagraphChunks(articleText());
  ch.forEach((c, i) => {
    const t = c.title.replace(/…$/, '');
    const plain = c.text.replace(/\n+/g, ' ');
    assert.ok(plain.startsWith(t),
      `chapter ${i + 1} title is a prefix of its text, not a mid-sentence window: ${JSON.stringify(c.title)}`);
    assert.ok(!/^[a-zà-ÿ,;)]/.test(c.title),
      `chapter ${i + 1} title does not begin mid-word or mid-clause: ${JSON.stringify(c.title)}`);
  });
  const long = M._autoTitle('Se una teoria scientifica rimanesse sempre la stessa, senza aggiornamenti, ' +
    'revisioni ed estensioni, ci sarebbe di che preoccuparsi.', 0);
  assert.ok(long.startsWith('Se una teoria scientifica'), 'a long opening sentence is truncated from its start');
  assert.ok(long.length <= 61 && /…$/.test(long), 'and marked as shortened');
  assert.strictEqual(M._autoTitle('Selezione naturale', 0), 'Selezione naturale', 'a heading is used as-is');
  assert.strictEqual(M._autoTitle('', 4), 'Chapter 5', 'empty text falls back to a numbered chapter');
  console.log('  auto titles: all 8 chapter titles are prefixes of their text');
}

// ── 14. The split-mode control, executed in a live DOM (v71_b) ───────────────
// A render path: source assertions cannot see scope, TDZ or a bad property access, and the old
// per-page checkbox was replaced at eight call sites. This runs the real client.
{
  const { loadClient } = require('./lib-dom');
  const C = loadClient({ quiet: true });
  const text = articleText();

  // Load a document the way onUploadFileChosen leaves things, then let the client cut it.
  const boot = mode => C.run(`
    _uploadMode = true; _pdfBookId = null; _chunksDirty = false;
    _pdfOrig = { text: ${JSON.stringify(text)}, pages: null };
    _pdfRawText = ${JSON.stringify(text)}; _pdfPages = null;
    _splitMode = ${JSON.stringify(mode)};
    _resplitUpload();
    _pdfChunks.map(c => c.wordCount);`);

  const para = boot('para');
  assert.strictEqual([...para].length, 8, 'paragraph mode cuts the article into 8 chapters');
  const len = boot('len');
  assert.ok([...len].length < 8, `length mode still uses the slider target (${[...len].length} chapters)`);

  // The slider is a chunk-size control only in length mode — showing it otherwise would be a lie.
  const vis = m => C.run(`
    _splitMode=${JSON.stringify(m)};
    document.getElementById('use-story-cb').checked = true;
    _updateUploadSliderVis();
    document.getElementById('story-len-row').style.display;`);
  assert.strictEqual(vis('len'), '', 'the size slider is shown when splitting by length');
  assert.strictEqual(vis('para'), 'none', 'and hidden when the document supplies the boundaries');

  // The control paints, marks the active mode, and disables what the document cannot support.
  C.run(`_splitMode='para'; _pdfPages=null; _renderSplitModes();`);
  const btn = id => C.document.getElementById(id);
  assert.ok(btn('split-mode-para').classList.contains('on'), 'the active mode is marked');
  assert.ok(!btn('split-mode-len').classList.contains('on'), 'and the others are not');
  assert.strictEqual(btn('split-mode-page').disabled, true, 'per-page is disabled without page boundaries');
  assert.ok(btn('split-mode-para').textContent.length > 1, 'buttons carry a translated label');

  // A document with no paragraph structure must not offer paragraph mode.
  C.run(`_pdfRawText = 'Ein Satz ohne jede Absatzstruktur der einfach weiterlaeuft.'; _renderSplitModes();`);
  assert.strictEqual(btn('split-mode-para').disabled, true,
    'paragraph mode is unavailable when the text has no paragraphs');

  // setSplitMode re-cuts; selecting the current mode is a no-op.
  C.run(`_pdfRawText = ${JSON.stringify(text)}; _splitMode='len'; _resplitUpload();`);
  const before = C.run('_pdfChunks.length');
  C.run(`setSplitMode('para');`);
  assert.strictEqual(C.run('_pdfChunks.length'), 8, 'switching to paragraph mode re-cuts the document');
  assert.notStrictEqual(before, 8, 'and that is a different cut from the one before');
  assert.strictEqual(C.calls.errors.length, 0, 'no errors were logged while rendering');
  console.log(`  split-mode control: para=8 len=${[...len].length} chapters, slider follows the mode`);
}

console.log('unit-pdf-paragraphs: ALL PASSED');
