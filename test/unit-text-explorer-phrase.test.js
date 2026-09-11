// unit-text-explorer-phrase.test.js — v90_z. Phrase-level analysis in the token popover.
//
// ⚠️ THE REPORT: "The text contains the phrase 'in fila indiana' which the translation translates as
// 'in einer Reihe', in canonical-analysis.json the phrase is recorded as 'im Einermarsch'. Can we
// amend our text analysis display such that it really shows phrase-level analysis instead of the
// single word analysis, that gives just 'indisch' as a translation for the word 'indiana'? Clicking
// on indiana should provide the whole phrase."
//
// ⚠️ THE DATA ALREADY EXISTED — this is a DISPLAY fix, not a pipeline one. `parseAnalysisReply` has
// returned `phrases` (start/end token indices, citation `lemma`, source-language `gloss`, its own
// `confidence`) since CP2 shipped; `analysisShadowFor` passes each sentence through whole, and
// `build-static.js` bakes them. Measured across the live store at this cut: 136 phrases over 67 of
// 87 sentences. `grep phrases index.html` found ZERO consumers — nothing read the array.
//
// ⚠️ The FIXTURE below is synthetic, shaped exactly like the real record, and deliberately NOT read
// out of `canonical-analysis.json` — that file is the user's live store, rewritten by their own
// server, and a fixture selected from it is the shape that broke two tests at `v87_o`. The real
// record it mirrors (verified by hand against the corpus while building this) is
// `tp_17889394908430000140` s1: tokens t9-t11, lemma "in fila indiana", gloss "im Einermarsch",
// sentence "Gli studenti raccolsero i propri effetti e uscirono dall'aula in fila indiana."
//
// ⚠️ Driven through the REAL renderer and the REAL popover, not a regex over the source: the claim
// is "clicking this word shows the phrase", and the only place that is observable is the card the
// popover actually builds (`v89` rule 12 — a guard that pins source text for a behavioural claim
// cannot fail when the behaviour is wrong).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// The real record's shape: CP1 attaches sentence punctuation to the last token ("indiana."), which
// is exactly why the displayed phrase has to be trimmed rather than sliced raw.
const SENT = {
  sentenceId: 'c1:s1',
  text: 'Gli studenti uscirono in fila indiana.',
  tokens: [
    { tokenId: 'c1:s1:t0', idx: 0, surface: 'Gli', lemma: 'il', form: 'Artikel, Plural', sense: 'die', confidence: 'high' },
    { tokenId: 'c1:s1:t1', idx: 1, surface: 'studenti', lemma: 'studente', form: 'Nomen, Plural', sense: 'Studenten', confidence: 'high' },
    { tokenId: 'c1:s1:t2', idx: 2, surface: 'uscirono', lemma: 'uscire', form: 'Verb, 3. Pl.', sense: 'gingen hinaus', confidence: 'high' },
    { tokenId: 'c1:s1:t3', idx: 3, surface: 'in', lemma: 'in', form: 'Präposition', sense: 'in', confidence: 'high' },
    { tokenId: 'c1:s1:t4', idx: 4, surface: 'fila', lemma: 'fila', form: 'Nomen, Singular', sense: 'Reihe', confidence: 'high' },
    { tokenId: 'c1:s1:t5', idx: 5, surface: 'indiana.', lemma: 'indiano', form: 'Adjektiv, Singular, Feminin', sense: 'indisch', confidence: 'high' },
  ],
  phrases: [
    { start: 3, end: 5, tokenIds: ['c1:s1:t3', 'c1:s1:t4', 'c1:s1:t5'],
      lemma: 'in fila indiana', gloss: 'im Einermarsch', confidence: 'high' },
  ],
};
// The same sentence with NO phrases — the non-vacuity partner for every assertion below.
const PLAIN = { ...SENT, phrases: [] };

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true }; APP.lang = 'it'; APP.srcLang = 'de'; true;`, 'seed');
  return C;
}
const marksOf = (html) => (html.match(/<mark[^>]*>/g) || []).map(m => ({
  surface: (/data-surface="([^"]*)"/.exec(m) || [])[1],
  psurface: (/data-psurface="([^"]*)"/.exec(m) || [])[1],
  pgloss: (/data-pgloss="([^"]*)"/.exec(m) || [])[1],
}));
// Open the popover on one token of a rendered sentence and hand back the card's markup.
function cardFor(C, html, surface) {
  C.run(`document.body.innerHTML = '<div id="te-host"></div>';
    var host = document.getElementById('te-host'); host.innerHTML = ${JSON.stringify(html)};
    var marks = host.querySelectorAll('mark'); var target = null;
    for (var i = 0; i < marks.length; i++) if (marks[i].dataset.surface === ${JSON.stringify(surface)}) target = marks[i];
    window.__found = !!target;
    if (target) _teShowWordPopover({ clientX: 10, clientY: 10 }, target);
    true;`, 'open');
  assert.strictEqual(C.run(`String(window.__found)`, 'found'), 'true', `the token "${surface}" was rendered as a mark`);
  return C.run(`(_teWordPopEl && _teWordPopEl.innerHTML) || ''`, 'card');
}

// ── 1. Every token of a phrase carries the phrase; tokens outside it carry nothing ────────────
{
  const C = client();
  const html = C.run(`_teSentenceHtml(${JSON.stringify(SENT)}, null)`, 'render');
  const marks = marksOf(html);
  assert.strictEqual(marks.length, 6, 'every token is still rendered — the phrase must not swallow marks');
  const inPhrase = marks.filter(m => m.psurface);
  assert.deepStrictEqual(inPhrase.map(m => m.surface), ['in', 'fila', 'indiana.'],
    'exactly the three tokens the phrase spans carry it — clicking ANY of them must reach the phrase');
  assert.ok(marks.slice(0, 3).every(m => !m.psurface),
    'tokens outside the phrase carry no phrase attributes at all — their markup is unchanged');
  assert.strictEqual(inPhrase[0].pgloss, 'im Einermarsch', 'the gloss travels on the token, from the model\'s own record');
}
console.log('  every token of a phrase carries it; tokens outside one are untouched: OK');

// ── 2. The displayed phrase is the STORY\'s own words, with sentence punctuation trimmed ──────
// CP1 attaches the full stop to the last token, so a raw slice reads "in fila indiana." — which also
// stops matching the citation lemma and renders a redundant second row.
{
  const C = client();
  const marks = marksOf(C.run(`_teSentenceHtml(${JSON.stringify(SENT)}, null)`, 'render'));
  const p = marks.find(m => m.psurface);
  assert.strictEqual(p.psurface, 'in fila indiana',
    'the phrase reads as the story writes it, without the sentence\'s own full stop');
  // Proves it is sliced from the TEXT and not assembled by joining surfaces with a space: the real
  // separators come from the sentence, which is what makes this right for an unspaced script too.
  assert.ok(SENT.text.includes(p.psurface), 'the displayed phrase is a literal substring of the sentence');
}
console.log('  the displayed phrase is sliced from the sentence text, trailing sentence punctuation trimmed: OK');

// ── 2b. ⚠️ The phrase shown is the INFLECTED run from the story, NOT the citation lemma ────────
// Mutation-testing finding: §2's fixture has `lemma === the story run`, so replacing the slice with
// `ph.lemma` outright left the guard GREEN — the two branches were indistinguishable. They differ in
// the common case, and the story's own words are the ones the learner is looking at: showing
// "mettersi in fila" over a sentence that reads "si misero in fila" is the single-word problem this
// whole feature exists to fix, one level up. The `lemma` is still available, on its own row.
{
  const C = client();
  const infl = {
    sentenceId: 'c2:s0', text: 'Gli studenti si misero in fila subito.',
    tokens: [
      { tokenId: 'c2:s0:t0', idx: 0, surface: 'Gli', lemma: 'il', form: 'Artikel', sense: 'die', confidence: 'high' },
      { tokenId: 'c2:s0:t1', idx: 1, surface: 'studenti', lemma: 'studente', form: 'Nomen', sense: 'Studenten', confidence: 'high' },
      { tokenId: 'c2:s0:t2', idx: 2, surface: 'si', lemma: 'si', form: 'Pronomen', sense: 'sich', confidence: 'high' },
      { tokenId: 'c2:s0:t3', idx: 3, surface: 'misero', lemma: 'mettere', form: 'Verb, 3. Pl. Perfekt', sense: 'stellten', confidence: 'high' },
      { tokenId: 'c2:s0:t4', idx: 4, surface: 'in', lemma: 'in', form: 'Präposition', sense: 'in', confidence: 'high' },
      { tokenId: 'c2:s0:t5', idx: 5, surface: 'fila', lemma: 'fila', form: 'Nomen', sense: 'Reihe', confidence: 'high' },
      { tokenId: 'c2:s0:t6', idx: 6, surface: 'subito.', lemma: 'subito', form: 'Adverb', sense: 'sofort', confidence: 'high' },
    ],
    phrases: [{ start: 2, end: 5, tokenIds: ['c2:s0:t2', 'c2:s0:t3', 'c2:s0:t4', 'c2:s0:t5'],
      lemma: 'mettersi in fila', gloss: 'sich in einer Reihe aufstellen', confidence: 'high' }],
  };
  const html = C.run(`_teSentenceHtml(${JSON.stringify(infl)}, null)`, 'render');
  const p = marksOf(html).find(m => m.psurface);
  assert.strictEqual(p.psurface, 'si misero in fila',
    'the phrase shown is the story\'s OWN inflected run, not the dictionary form');
  assert.notStrictEqual(p.psurface, 'mettersi in fila', 'and it is demonstrably not the lemma — the two differ here');
  const card = cardFor(C, html, 'misero');
  assert.ok(card.includes('si misero in fila'), 'the card leads with the words actually on the page');
  assert.ok(card.includes('mettersi in fila'), 'and still offers the citation form on its own row, since the two differ');
  assert.ok(card.indexOf('si misero in fila') < card.indexOf('mettersi in fila'),
    'the story\'s wording comes first; the dictionary form is the supporting detail');
}
console.log('  an inflected phrase shows the story\'s own run first, with the citation lemma below it: OK');

// ── 3. ⭐ THE REPORT: clicking "indiana" gives the phrase ABOVE the single-word analysis ───────
{
  const C = client();
  const html = C.run(`_teSentenceHtml(${JSON.stringify(SENT)}, null)`, 'render');
  const card = cardFor(C, html, 'indiana.');
  assert.ok(card.includes('in fila indiana'), '⚠️ the phrase is in the card — the whole of the user request');
  assert.ok(card.includes('im Einermarsch'), 'and so is its meaning, which the word-level analysis cannot give');
  // The user ruling was "phrase ABOVE token", not "phrase INSTEAD of token": `indiana` really does
  // mean `indisch`, and that is sometimes the thing being asked.
  assert.ok(card.includes('indisch'), 'the single-word analysis is still there — nothing is hidden');
  assert.ok(card.indexOf('im Einermarsch') < card.indexOf('indisch'),
    'the PHRASE comes first: the order is what says which answer is the more useful one');
}
console.log('  clicking a word inside a phrase shows the phrase first, with the word analysis kept below: OK');

// ── 4. Non-vacuity: the same sentence with no phrases renders no phrase block ─────────────────
// Without this, a card that always showed a phrase block would satisfy §3.
{
  const C = client();
  const html = C.run(`_teSentenceHtml(${JSON.stringify(PLAIN)}, null)`, 'render');
  assert.ok(!/data-psurface/.test(html), 'a sentence with no phrases emits no phrase attributes');
  const card = cardFor(C, html, 'indiana.');
  assert.ok(!card.includes('in fila indiana'), 'and its popover shows no phrase block');
  assert.ok(card.includes('indisch'), 'while the word analysis is unchanged — this is the pre-v90_z card');
}
console.log('  a sentence with no phrases is byte-unchanged and its popover shows no phrase block: OK');

// ── 5. A one-token "phrase" is not a phrase ───────────────────────────────────────────────────
// `parseAnalysisReply` already requires end > start, but the renderer must not depend on that:
// a phrase covering a single word says nothing the token row does not.
{
  const C = client();
  const one = { ...SENT, phrases: [{ start: 5, end: 5, tokenIds: ['c1:s1:t5'], lemma: 'indiano', gloss: 'indisch', confidence: 'high' }] };
  assert.ok(!/data-psurface/.test(C.run(`_teSentenceHtml(${JSON.stringify(one)}, null)`, 'render')),
    'a single-token span is ignored rather than rendered as a phrase');
}
console.log('  a single-token span is not treated as a phrase: OK');

// ── 6. A phrase whose tokens cannot be aligned falls back to the model\'s citation form ────────
// The same alignment miss `_teSentenceHtml` skips a mark for — it must not produce an empty heading.
{
  const C = client();
  const odd = { ...SENT, phrases: [{ start: 3, end: 5, tokenIds: ['nope-a', 'nope-b'], lemma: 'in fila indiana', gloss: 'im Einermarsch', confidence: 'low' }] };
  const html = C.run(`_teSentenceHtml(${JSON.stringify(odd)}, null)`, 'render');
  // Unalignable tokenIds attach to nothing, so no mark carries the phrase — better than attaching
  // a phrase to the wrong word, which is the failure mode the correction key exists to prevent.
  assert.ok(!/data-psurface/.test(html), 'a phrase naming tokens this sentence does not have is dropped, not guessed at');
}
console.log('  a phrase whose tokens cannot be located is dropped rather than attached to the wrong word: OK');

console.log('unit-text-explorer-phrase: ALL PASSED');
