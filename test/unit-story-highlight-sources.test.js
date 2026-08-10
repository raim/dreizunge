// unit-story-highlight-sources.test.js
// v78_h (user) — every word-bearing source feeds the story highlight, in two shades.
//
// User: "we do still want to expand what is highlighted in the story, via all possible sources,
// e.g. all word forms, conjugation lesson forms, grammar forms, that are present (light yellow) and
// were learned by the user (darker yellow)."
//
// Before this, only `L.vocab[].target` was marked. A chapter whose learning happens in a
// conjugation, word_forms, grammar or synonyms lesson had a story with almost nothing lit up.
// Measured over 90 corpus chapters with a story: **704 marks from vocabulary alone, 1043 from every
// source — +48%, with 44 of the 90 gaining.**
//
// The design claim under test is not "more words are marked" but that **both shades come from ONE
// collector**. `_storyWordSources` emits a word AND the probe that identifies the question teaching
// it, so "in your lessons" (light) and "you have answered it" (darker) are two reads of one list.
// Computing them separately is exactly how this panel and the storyline page came to light the same
// story differently before v74_n.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  return C;
}
const C = client();
const json = (expr) => JSON.parse(C.run(`JSON.stringify(${expr})`, 'call'));

// One chapter carrying every source type, so a source that stops contributing is visible.
const D = {
  topic: 'T', lang: 'it', srcLang: 'de',
  story: 'La variazione genetica guida evoluzione. Io parlo e noi parliamo dei tempi. Il cane corre.',
  lessons: [
    { id: 'l1', type: 'standard', vocab: [{ target: 'variazione', source: 'Variation' }] },
    { id: 'l2', type: 'conjugation', conjugations: [
      { infinitive: 'parlare', source: 'sprechen', forms: [
        { pronoun: 'io', form: 'io parlo' }, { pronoun: 'noi', form: 'noi parliamo' } ] } ] },
    { id: 'l3', type: 'grammar', grammar: [{ target: 'tempo', source: 'Zeit', article: 'il', plural: 'tempi' }] },
    { id: 'l4', type: 'word_forms', items: [
      { sentence: 'Il ___ corre.', choices: ['cane', 'cani', 'canide'], correctIndex: 0 } ] },
    { id: 'l5', type: 'synonyms', words: [
      { base: 'evoluzione', gloss: 'Evolution', synonyms: [{ w: 'sviluppo', g: 'Entwicklung' }], antonyms: [] } ] },
  ],
};

// ── 1. Every source contributes to the LIGHT set ────────────────────────────
// Named individually: a blanket "more than before" would pass with one source wired and four not.
{
  const all = json(`_storyExtraWords(${JSON.stringify(D)})`);
  const expect = {
    'conjugation form (pronoun stripped)': 'parlo',
    'conjugation form, plural':            'parliamo',
    'conjugation infinitive':              'parlare',
    'grammar noun':                        'tempo',
    'grammar plural':                      'tempi',
    'word_forms correct choice':           'cane',
    'word_forms distractor':               'cani',
    'synonyms base':                       'evoluzione',
    'synonyms alternative':                'sviluppo',
  };
  for (const [what, w] of Object.entries(expect)) {
    assert.ok(all.includes(w), `${what} ("${w}") is in the light set — got ${JSON.stringify(all)}`);
  }
  // The pronoun must be STRIPPED: the corpus stores "io parlo" and the story contains only "parlo".
  assert.ok(!all.includes('io parlo'),
    'the stored form keeps its pronoun but the highlight word does not — otherwise it never matches');
  console.log(`  all five sources contribute (${all.length} light words)`);
}

// ── 2. The light set really produces MORE MARKS on a real story ─────────────
// The end the user sees. Driven through the product matcher on the fixture story.
{
  const vocab = ['variazione'];
  const extra = json(`_storyExtraWords(${JSON.stringify(D)})`);
  const marks = (words) => {
    const u = [...new Set(words)].sort((a, b) => b.length - a.length);
    return (C.run(`_highlightVocabHtml(${JSON.stringify(D.story)}, ${JSON.stringify(u)})`, 'hl')
             .match(/<mark/g) || []).length;
  };
  const before = marks(vocab), after = marks(vocab.concat(extra));
  assert.ok(after > before, `more of the story is marked (${before} -> ${after})`);
  assert.ok(after >= 5, `and substantially so, not by one word (${after} marks)`);
  console.log(`  story marks: ${before} (vocab only) -> ${after} (all sources)`);
}

// ── 3. The DARKER shade is empty until something is solved ─────────────────
// Non-vacuity for §4: if the dark set were non-empty by construction, §4 would prove nothing.
{
  const C2 = client();
  C2.run(`APP.progress = { solved: {} }; true;`);
  const solved = JSON.parse(C2.run(`JSON.stringify(_solvedExtraWords(${JSON.stringify(D)}))`, 'z'));
  assert.deepStrictEqual(solved, [], 'nothing answered yet, so nothing is in the stronger shade');
  console.log('  with no progress, the darker shade is empty');
}

// ── 4. Answering a CONJUGATION question moves that form into the darker shade ─
// The heart of the user's request: the dark shade must follow non-vocabulary learning too. The qid
// is computed by the PRODUCT (`qid`), not re-typed, so a change to the qid scheme moves both sides
// together — the same technique `_solvedTargetWords` uses for vocabulary.
{
  const C2 = client();
  const key = C2.run(`qid({type:'mcq_conjugation', infinitive:'parlare', pronoun:'noi'}, 'l2')`, 'qid');
  assert.ok(key && key.length, 'the product produced a qid for the conjugation question');
  C2.run(`APP.progress = { solved: { T: { ${JSON.stringify(key)}: 1 } } }; true;`);
  const solved = JSON.parse(C2.run(`JSON.stringify(_solvedExtraWords(${JSON.stringify(D)}))`, 'z'));
  assert.ok(solved.includes('parliamo'),
    `the answered form is in the darker shade (got ${JSON.stringify(solved)})`);
  assert.ok(!solved.includes('parlo'),
    'but the form for a pronoun NOT answered is not — each pronoun is its own question');
  console.log('  a solved conjugation form moves to the darker shade, and only that form');
}

// ── 5. A word_forms DISTRACTOR can never be "learned" ──────────────────────
// It is light because the lesson shows it, and must never be dark: no question exists whose correct
// answer it is, so calling it learned would be a lie the shading tells.
{
  const C2 = client();
  const key = C2.run(`qid({type:'word_form', sentence:'Il ___ corre.', correct:'cane'}, 'l4')`, 'qid');
  C2.run(`APP.progress = { solved: { T: { ${JSON.stringify(key)}: 1 } } }; true;`);
  const solved = JSON.parse(C2.run(`JSON.stringify(_solvedExtraWords(${JSON.stringify(D)}))`, 'z'));
  assert.ok(solved.includes('cane'), 'the correct choice is learned');
  assert.ok(!solved.includes('cani') && !solved.includes('canide'),
    'the distractors stay in the light shade — they were shown, never answered');
  console.log('  distractors are shown but never counted as learned');
}

// ── 6. Dark is always a SUBSET of light ────────────────────────────────────
// Structural: a word in the stronger shade that the light set does not contain would be marked by
// `strongWords` with no base match, which the matcher cannot render. Checked across every source.
{
  const C2 = client();
  const keys = ['l2', 'l3', 'l4', 'l5'].map(() => null);
  const k1 = C2.run(`qid({type:'mcq_conjugation', infinitive:'parlare', pronoun:'io'}, 'l2')`, 'q');
  const k2 = C2.run(`qid({type:'mcq_plural', target:'tempo'}, 'l3')`, 'q');
  const k3 = C2.run(`qid({type:'syn_select', mode:'synonyms', base:'evoluzione'}, 'l5')`, 'q');
  C2.run(`APP.progress = { solved: { T: {
    ${JSON.stringify(k1)}: 1, ${JSON.stringify(k2)}: 1, ${JSON.stringify(k3)}: 1 } } }; true;`);
  const light = new Set(JSON.parse(C2.run(`JSON.stringify(_storyExtraWords(${JSON.stringify(D)}))`, 'z')));
  const dark = JSON.parse(C2.run(`JSON.stringify(_solvedExtraWords(${JSON.stringify(D)}))`, 'z'));
  assert.ok(dark.length >= 3, `several sources contributed to the darker shade (${dark.length})`);
  for (const w of dark) assert.ok(light.has(w), `"${w}" is dark and also light — dark is a subset`);
  console.log(`  ${dark.length} dark words, every one of them also light`);
}

// ── 7. Malformed lesson data does not throw ────────────────────────────────
// These collectors run inside the story panels' try/catch, but a throw there blanks the story — the
// panel whose entire job is being read. Cheaper to not throw.
{
  const bad = { topic: 'T', lessons: [
    null, { id: null, conjugations: [null] }, { id: 'x', words: [null, { base: null }] },
    { id: 'y', items: [{ choices: null }, {}] }, { id: 'z', grammar: [null, {}] },
    { id: 'w', conjugations: [{ infinitive: 'a', forms: [null, { pronoun: 'p' }] }] },
  ] };
  assert.doesNotThrow(() => json(`_storyExtraWords(${JSON.stringify(bad)})`), 'light set survives junk');
  assert.doesNotThrow(() => json(`_solvedExtraWords(${JSON.stringify(bad)})`), 'dark set survives junk');
  assert.deepStrictEqual(json(`_storyExtraWords({})`), [], 'and an empty object yields nothing');
  console.log('  malformed lesson data yields [] rather than throwing');
}

console.log('unit-story-highlight-sources: ALL PASSED');
