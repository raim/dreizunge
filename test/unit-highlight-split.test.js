// unit-highlight-split.test.js
// v78_k (§3, ruled sessions 29/30) — a multi-token vocabulary entry marks its PARTS too.
//
// `la variazione genetica` used to mark nothing in a story containing just `variazione`. That is
// the commonest shape in the corpus, because vocabulary is stored with its article: 181 of 1408
// entries across 96 chapters carry a space.
//
// MEASURED A/B on the current corpus, same 96 chapters, splitting off vs on: **761 -> 1071 marks,
// +310, 41 chapters gaining.** The ruling recorded +782; that figure predates `v77_u` (the
// apostrophe fold, which independently recovered part of the same gap) and a corpus that has turned
// over several times since. The direction and the decisiveness hold; the number does not, and is
// restated here rather than repeated.
//
// ARTICLE NOISE IS THE RULING, NOT A BUG. Splitting marks bare `la`/`il`. Session 30 ruled the mark
// means "something from your vocabulary occurs here", not "you have learned this word", and chose
// splitting over the article-filtered variant. §4 asserts that this is deliberate, so nobody
// "fixes" it back.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; true;`, 'seed');

const hl = (story, words, strong) =>
  C.run(`_highlightVocabHtml(${JSON.stringify(story)}, ${JSON.stringify(words)}` +
        (strong ? `, ${JSON.stringify(strong)}` : '') + `)`, 'hl');
const marks = (html) => [...html.matchAll(/<mark class="story-vocab-hl( solved)?">([^<]*)<\/mark>/g)]
  .map(m => ({ text: m[2], solved: !!m[1] }));

// ── 1. A phrase's parts are marked where the phrase is not present ──────────
{
  const html = hl('La variazione genetica guida la evoluzione.', ['la variazione genetica']);
  const got = marks(html).map(m => m.text);
  assert.ok(got.length >= 1, `something is marked (got ${JSON.stringify(got)})`);
  // The whole phrase IS present here, so it wins — that is the longest-first rule, not a failure.
  assert.ok(got.some(g => /variazione/i.test(g)), 'the entry reaches the text');
  // The real case: a story where only one token appears.
  const html2 = hl('Studiamo la variazione oggi.', ['la variazione genetica']);
  const got2 = marks(html2).map(m => m.text.toLowerCase());
  assert.ok(got2.includes('variazione'),
    `a lone token of a multi-token entry is marked (got ${JSON.stringify(got2)})`);
  console.log('  a phrase whose parts appear alone now marks those parts');
}

// ── 2. Non-vacuity: this was NOT possible before ────────────────────────────
// A single-token entry must behave exactly as it always did, so §1 cannot be passing because the
// matcher became indiscriminate.
{
  const html = hl('Studiamo la variazione oggi.', ['evoluzione']);
  assert.deepStrictEqual(marks(html), [], 'a word that is absent is still not marked');
  const html2 = hl('Studiamo la variazione oggi.', ['variazione']);
  assert.strictEqual(marks(html2).length, 1, 'a present single-token entry marks once, as before');
  console.log('  absent words stay unmarked; single-token behaviour is unchanged');
}

// ── 3. The whole phrase still WINS where it is present ──────────────────────
// Longest-first ordering. If a token could win, the story would show three separate marks instead
// of one phrase, which reads as three vocabulary items rather than the one the learner was taught.
{
  const html = hl('Ecco il forno a legna qui.', ['il forno a legna']);
  const got = marks(html).map(m => m.text);
  assert.strictEqual(got.length, 1, `one mark, not one per token (got ${JSON.stringify(got)})`);
  assert.strictEqual(got[0].toLowerCase(), 'il forno a legna', 'and it is the whole phrase');
  console.log('  the whole phrase still wins wherever it is actually present');
}

// ── 4. Article noise is ACCEPTED — the session-30 ruling ────────────────────
// Asserted deliberately. Without it, a future session sees bare `la` lit up, reads it as the
// v73_d one-letter bug returning, and "fixes" a ruling. The mark means "something from your
// vocabulary occurs here", not "you have learned this word".
{
  const html = hl('La casa e la macchina.', ['la casa']);
  const got = marks(html).map(m => m.text.toLowerCase());
  assert.ok(got.includes('la'),
    'the bare article IS marked — session-30 ruling, not a defect. Do not "fix" this without ' +
    'reopening the ruling; the alternative (article filtering) was measured and rejected.');
  console.log('  bare articles are marked, by ruling');
}

// ── 5. Both shades split together ───────────────────────────────────────────
// The stronger shade is keyed on the MATCHED text. Splitting the light set alone would light a
// solved phrase's own parts as unlearned — the learner would see `variazione` unmarked-as-solved
// inside the very phrase they had answered.
{
  const html = hl('Studiamo la variazione oggi.', ['la variazione genetica'], ['la variazione genetica']);
  const m = marks(html).find(x => x.text.toLowerCase() === 'variazione');
  assert.ok(m, 'the token is marked at all');
  assert.strictEqual(m.solved, true,
    'and in the STRONGER shade, because its parent phrase was solved');
  // And the converse, or the assertion above proves nothing.
  const html2 = hl('Studiamo la variazione oggi.', ['la variazione genetica'], []);
  const m2 = marks(html2).find(x => x.text.toLowerCase() === 'variazione');
  assert.strictEqual(m2.solved, false, 'an unsolved phrase\'s parts stay in the base shade');
  console.log('  a solved phrase marks its parts as solved too; an unsolved one does not');
}

// ── 6. Unspaced scripts are untouched ───────────────────────────────────────
// There is no whitespace to split, and matching inside a run is already correct there (v73_d).
// A `.split(/\s+/)` over Japanese would return the whole string, so this is really asserting that
// the guard around it did not accidentally change the word-boundary handling.
{
  const html = hl('私は日本語を勉強します', ['日本語']);
  assert.strictEqual(marks(html).length, 1, 'an unspaced-script entry still matches inside the run');
  console.log('  unspaced scripts behave exactly as before');
}

// ── 7. Malformed input does not throw ───────────────────────────────────────
{
  assert.doesNotThrow(() => hl('testo', ['', '   ', 'a  b']), 'blank and double-spaced entries');
  assert.doesNotThrow(() => hl('testo', ['(', '[', '\\']), 'regex metacharacters still escaped');
  console.log('  blank, double-spaced and regex-metacharacter entries are safe');
}

console.log('unit-highlight-split: ALL PASSED');

// ── v78_p (user) — matching is CASE-INSENSITIVE, including sentence-initially ──
// User: "highlighting story text: do case-insensitive match, to e.g. catch words in the beginning
// of a sentence."
//
// MEASURED ALREADY TRUE and left alone. The matcher's regex already carries `i` and `_hlKey` folds
// case on both sides of the stronger-shade lookup. A corpus sweep of 120 chapters found only 8
// single-token vocabulary entries present in a story but unmarked — all Arabic, none a case
// problem. Closed by a guard rather than by a change, the same way "Replay must always be
// available" was: an item that is already satisfied should be proved, not re-implemented.
{
  const cap = hl('Casa mia è bella.', ['casa']);
  assert.ok(marks(cap).some(m => m.text === 'Casa'),
    'a sentence-initial capital is matched by a lowercase vocabulary entry');
  const low = hl('la casa mia', ['La Casa']);
  assert.ok(marks(low).some(m => m.text.toLowerCase() === 'la casa'),
    'and the reverse: a capitalised entry matches lowercase text');
  // The stronger shade must fold case too, or a solved word would show as unlearned at the start
  // of a sentence — the shading would be wrong precisely where the reading eye lands first.
  const strong = hl('Casa mia è bella.', ['casa'], ['casa']);
  assert.strictEqual(marks(strong).find(m => m.text === 'Casa').solved, true,
    'the SOLVED shade folds case as well');
  // Non-Latin scripts fold too — this matters for the sr Cyrillic work, where an entry and the
  // story can disagree on case at every sentence start.
  assert.ok(marks(hl('Кућа је лепа.', ['кућа'])).some(m => m.text === 'Кућа'),
    'Cyrillic folds case as well');
  assert.ok(marks(hl('Το σπίτι είναι όμορφο.', ['ΣΠΊΤΙ'])).length >= 1, 'Greek folds case too');
  console.log('  matching folds case in Latin, Cyrillic and Greek, and in the solved shade');
}
