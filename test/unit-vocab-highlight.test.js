// unit-vocab-highlight.test.js
// v73_d (user-reported) — story vocabulary highlighting must respect word boundaries.
//
// The report: in tp_131653303 "all 'i' are highlighted in each word". That chapter's vocabulary
// contains the single-letter entry `"I" = "ich"`, and _highlightVocabHtml built
// `new RegExp('(' + pat + ')', 'gi')` with no boundary of any kind, so every `i` inside every word
// matched. Measured on that chapter's real story: 54 marks before, 13 after.
//
// The fix is not `\b`. This file exists mainly to pin the two things `\b` would have broken, because
// both are invisible in a Latin-script test and neither would fail loudly:
//   • boundaries must work for non-Latin SPACED scripts (Cyrillic, Arabic, Hebrew, Greek);
//   • they must NOT be applied to UNSPACED scripts (Han, Kana, Thai, …), where matching inside a
//     run is the only behaviour available and the correct one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const C = loadClient({ quiet: true });
const hl = (html, words) =>
  C.run(`_highlightVocabHtml(${JSON.stringify(html)}, ${JSON.stringify(words)})`, 'hl');
const marked = (out) => [...String(out).matchAll(/<mark class="story-vocab-hl">([\s\S]*?)<\/mark>/g)].map(m => m[1]);

// ── 1. The reported defect ───────────────────────────────────────────────────
{
  const out = hl('I am little. It is a nice title with i inside.', ['I']);
  const hits = marked(out);
  // Both standalone pronouns are legitimate hits; the point is that the `i` inside little/It/is/
  // nice/title/inside is not.
  assert.deepStrictEqual(hits, ['I', 'i'],
    'a one-letter vocab entry marks only standalone occurrences, not every letter inside every word');
  assert.ok(!/l<mark/.test(out) && !/t<mark/.test(out),
    'and never opens a mark in the middle of a word');
}

// ── 2. Prefixes and suffixes are not the word ────────────────────────────────
{
  const hits = marked(hl('The dream and the dreams and daydreaming.', ['dream']));
  assert.deepStrictEqual(hits, ['dream'],
    'a word does not match inside a longer word (dreams / daydreaming)');
}

// ── 3. Non-Latin SPACED scripts still highlight — what a plain \b would break ─
// \b is defined on ASCII word characters, so under it every assertion here would return zero marks
// while the suite stayed green for English.
{
  assert.deepStrictEqual(marked(hl('Это дом и домик.', ['дом'])), ['дом'],
    'Cyrillic: the standalone word matches and the longer one does not');
  assert.deepStrictEqual(marked(hl('البيت جميل والبيوت كثيرة.', ['البيت'])), ['البيت'],
    'Arabic: the standalone word matches and the prefixed one does not');
  assert.deepStrictEqual(marked(hl('Το σπίτι και το σπίτια.', ['σπίτι'])).length, 1,
    'Greek: the standalone word matches');
}

// ── 4. UNSPACED scripts must NOT be boundary-guarded ─────────────────────────
// Japanese runs words together, so requiring a non-letter on either side would mean a vocabulary
// word could never be highlighted in a Japanese story at all — a silent, total regression.
{
  const hits = marked(hl('私は猫が好きです。猫はかわいい。', ['猫']));
  assert.strictEqual(hits.length, 2,
    'Han/Kana: a word IS matched inside an unspaced run — a boundary here would highlight nothing');
}

// ── 5. Phrases win over their own parts ──────────────────────────────────────
// The two entries must START AT THE SAME POSITION, or the ordering is not what decides the outcome.
// JS alternation is leftmost-alternative-first at each scan position, so `forno|forno a legna`
// yields the short one and the phrase is never highlighted whole — unless the list is sorted
// longest-first. An earlier version of this assertion used `il forno a legna`, which begins one
// word earlier and therefore matched regardless of order: it passed with the sort removed, i.e. it
// was decoration.
{
  const hits = marked(hl('Un forno a legna e un forno.', ['forno', 'forno a legna']));
  assert.deepStrictEqual(hits, ['forno a legna', 'forno'],
    'a multi-word entry is matched whole, not shadowed by one of its own words');
}

// ── 6. Markup is never matched into ──────────────────────────────────────────
// The replace walks tag/text segments; a vocab word colliding with the mark class name must not be
// able to corrupt the emitted HTML.
{
  const out = hl('a story about a story', ['story']);
  assert.strictEqual(marked(out).length, 2, 'both occurrences marked');
  assert.ok(!/story-vocab-hl<\/mark>/.test(out) && !/<mark[^>]*<mark/.test(out),
    'and the emitted markup is not itself highlighted');
}

// ── 7. Against the corpus chapter that produced the report ───────────────────
// The v70_n rule: test against the data that prompted the report, not a synthetic stand-in.
{
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const t = (store.topics || []).find(x => x.id === 'tp_131653303');
  if (t && t.story) {
    const words = [];
    (t.lessons || []).forEach(L => (L.vocab || []).forEach(v => { if (v && v.target) words.push(v.target); }));
    const single = words.filter(w => String(w).trim().length === 1);
    // Guard the guard: if the corpus loses the one-letter entry this section proves nothing.
    assert.ok(single.length > 0,
      'the reported chapter still carries a single-letter vocab entry (the shape under test)');
    const hits = marked(hl(t.story, words));
    // Every hit must be a whole word of the story, which is the property that was violated.
    const stray = hits.filter(h => !new RegExp(`(?<![\\p{L}\\p{N}])${h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u').test(t.story));
    assert.deepStrictEqual(stray, [], 'every highlight in the real story is a whole word');
    console.log(`  tp_131653303: ${words.length} vocab words -> ${hits.length} whole-word marks (was 54)`);
  }
}

console.log('unit-vocab-highlight: ALL PASSED');
