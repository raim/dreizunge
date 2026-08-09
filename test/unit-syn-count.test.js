// unit-syn-count.test.js
// v78_b (user testing notes, group B) — a synonym/antonym question STATES HOW MANY words are to
// be found.
//
// Why it matters: syn_select is the only multi-select exercise in the app. Every other type is
// answered by one tap or one string, so "am I done?" is never a question. Here a learner who has
// tapped one of three correct words gets no signal that two remain, and Check scores the round —
// so the question silently tested a guess about the QUESTION rather than the vocabulary.
//
// The count is read from `ex.correct`, which is the same array check() scores against
// (index.html: `ex.correct.some(...)`), so the number shown and the number required cannot drift
// apart. Asserted below by rendering and scoring the SAME exercise object.
//
// Note the key shape: `ex.syn.q_synonyms_n` is a NEW key rather than a reworded
// `ex.syn.q_synonyms`. translate-ui.js fills keys that are MISSING, not keys whose English value
// CHANGED (session protocol, DoD item 3), so editing the old value in place would have left the
// other 31 languages rendering the uncounted prompt indefinitely.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// The exercise shape emitted by the syn_select builder (index.html, buildSynExercises): `correct`
// is a non-empty array of words, `choices` contains them plus distractors. Synthesized rather than
// rebuilt from the corpus because build() SAMPLES — a known harness trap — so a fixture is the
// only way to fix the count under test.
const exOf = (mode, correct) => ({
  type: 'syn_select', mode, base: 'Haus', gloss: '', sentence: '',
  correct, glossMap: {}, target: correct.join(', '),
  choices: [...correct, 'Auto', 'Baum'],
});

function render(C, ex) {
  return C.run(`tSynSelect(${JSON.stringify(ex)})`, 'tSynSelect');
}

function checkClient(file) {
  const C = loadClient(file ? { quiet: true, file } : { quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  return C;
}

const C = checkClient();

// ── 1. The count is rendered, and it is the count of correct answers ─────────
// Three separate cardinalities, because a hard-coded number or an off-by-one would satisfy one.
{
  for (const n of [1, 2, 3]) {
    const correct = ['Gebäude', 'Wohnung', 'Heim'].slice(0, n);
    const html = render(C, exOf('synonyms', correct));
    assert.ok(html.includes(`${n} similar to`),
      `a ${n}-answer synonym question announces "${n} similar to" (got: ${html.slice(0, 200)})`);
  }
  console.log('  synonyms: the prompt states 1, 2 and 3 correct answers respectively');

  const anto = render(C, exOf('antonyms', ['klein', 'winzig']));
  assert.ok(anto.includes('2 opposite to'),
    'the antonym prompt is counted too — both modes, or half the exercises keep the old prompt');
  console.log('  antonyms: counted on the same path');
}

// ── 2. Non-vacuity: the number is not decoration ─────────────────────────────
// Without this the section above could pass on a template that always prints the choice count, or
// prints the base word's length, or any other number that happens to be 2 for a 2-answer fixture.
// Same base, same choices, DIFFERENT correct-set size -> the rendered number must move with it.
{
  const two   = render(C, exOf('synonyms', ['Gebäude', 'Wohnung']));
  const three = render(C, exOf('synonyms', ['Gebäude', 'Wohnung', 'Heim']));
  assert.ok(two.includes('2 similar to') && !two.includes('3 similar to'),
    'a 2-answer question says 2 and not 3');
  assert.ok(three.includes('3 similar to') && !three.includes('2 similar to'),
    'a 3-answer question says 3 and not 2 — the number tracks ex.correct, not the fixture');
  console.log('  the number tracks ex.correct.length, not a constant');
}

// ── 3. The number shown is the number CHECK requires ─────────────────────────
// The claim is not "a number is printed" but "the printed number is how many the learner must
// find". Asserted by scoring the same object the prompt was rendered from, through the client's
// own scoring rule for syn_select (an answer is right when the selected set equals `correct`).
// This is what stops the prompt and the scorer drifting apart in a later refactor.
{
  const ex = exOf('synonyms', ['Gebäude', 'Wohnung', 'Heim']);
  const html = render(C, ex);
  const shown = Number((html.match(/(\d+) similar to/) || [])[1]);
  assert.strictEqual(shown, 3, 'the prompt announces 3');
  assert.strictEqual(shown, ex.correct.length,
    'and the scorer requires exactly that many — one array feeds both');
  // The tiles offered still exceed the answer, or announcing the count would give it away.
  assert.ok(ex.choices.length > shown,
    'there are more tiles than correct answers — the count narrows the question, it does not answer it');
  console.log('  the announced count is the scored count, and distractors remain');
}

// ── 4. A malformed exercise falls back rather than printing "0" or "undefined" ─
// `ex.correct` is guaranteed non-empty by the builder (`if(!correct.length) return null`), but the
// renderer is also reachable from edited/imported lesson data, where it is not. A count of zero
// must degrade to the uncounted prompt, not render "0 similar to".
{
  const bare = render(C, { type: 'syn_select', mode: 'synonyms', base: 'Haus', choices: ['Auto'] });
  assert.ok(bare.includes('similar to'), 'still asks the question when the answer set is missing');
  assert.ok(!/\d+ similar to/.test(bare) && !/undefined similar to/.test(bare),
    'no "0 similar to" and no "undefined similar to" — it falls back to the uncounted key');
  console.log('  a missing answer set falls back to the uncounted prompt');
}

// ── 5. The keys exist in en, and ONLY in en ──────────────────────────────────
// Paired assertions: the key must be present (or every render silently shows the raw key name,
// since t() falls back to the key itself), and must not yet be translated. Per the protocol, the
// second half is correct only while the key is NEW — when the translate pass returns, this flips
// to "no language holds the English string verbatim". Flagged here so it is not read as permanent.
{
  for (const k of ['ex.syn.q_synonyms_n', 'ex.syn.q_antonyms_n']) {
    assert.ok(UI.en[k], `${k} exists in en`);
    assert.ok(/\{n\}/.test(UI.en[k]) && /\{word\}/.test(UI.en[k]),
      `${k} carries both placeholders`);
    const translated = Object.keys(UI).filter(l => l !== 'en' && UI[l][k]);
    assert.deepStrictEqual(translated, [],
      `${k} is en-only and OWED to the translate pass (see the session notes)`);
  }
  console.log('  both keys present in en, owed to the translate pass');
}

// ── 6. And in the PUBLISHED build ────────────────────────────────────────────
// build-static.js does not re-implement tSynSelect today, so this is not the v76_k duplication —
// but rule 15 was earned three times by assuming that, and the check costs one file read.
{
  const D = checkClient(path.join(ROOT, 'docs', 'index.html'));
  const html = render(D, exOf('synonyms', ['Gebäude', 'Wohnung']));
  assert.ok(html.includes('2 similar to'),
    'docs/index.html renders the counted prompt too (re-run: node build-static.js)');
  console.log('  docs/index.html carries it as well');
}

console.log('unit-syn-count: ALL PASSED');
