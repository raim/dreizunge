// unit-story-panel-alignment.test.js
// v82_c (user follow-up: "renderStoryText vs _storyWordSources: can we align all story display
// panels?") — `renderStoryText` (the topic-detail screen's own collapsible `#story-body`) was the
// one story panel `_storyWordSources` never reached. It read `L.vocab` alone, and even that was
// gated on the owning lesson being fully COMPLETE — both pre-v74_n behaviour the other three panels
// (`_renderSavedStory`, `_renderChainStory`, `_storyBodyHtml`) had already moved past.
//
// This file asserts the claim through the actual DOM `renderStoryText` produces, not just the word
// list — `unit-story-highlight-sources.test.js` already proves `_storyExtraWords`/`_solvedExtraWords`
// cover every source; this proves THIS panel actually uses them, and does not tap (v80_t: tapping
// needs an active run, which a read-only panel has none of, same as the library/storyline panels).
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

// Same shape of fixture as unit-story-highlight-sources.test.js: one lesson per source type, NONE
// of them marked complete — the point of §2 below.
const D = {
  topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de',
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

// ── 1. Every source lights up through renderStoryText itself, not just the collector ───────────
{
  const C = client();
  C.run(`APP.progress = { solved: {}, completed: {} }; true;`);
  const html = C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(D)}, el);
    el.innerHTML;
  `, 'render');
  // Only words that literally occur in D.story can be MARKED there — `parlare`, `tempo`, `cani`
  // and `sviluppo` are taught (in the light-word list) but never appear in this particular story
  // text, so they cannot show up as a <mark> here. Coverage of the full taught-word list is already
  // proven by unit-story-highlight-sources.test.js; this checks that renderStoryText actually USES
  // that list, via the words this story text can show it.
  for (const [what, w] of Object.entries({
    'standard vocab': 'variazione', 'conjugation form (io)': 'parlo',
    'conjugation form (noi)': 'parliamo', 'grammar plural': 'tempi',
    'word_forms correct choice': 'cane', 'synonyms base': 'evoluzione',
  })) {
    assert.ok(new RegExp('<mark[^>]*>' + w + '</mark>').test(html), `${what} ("${w}") is marked — got ${html}`);
  }
  console.log('  every source is marked in the rendered story body: OK');
}

// ── 2. NOT gated on lesson completion (the removed `done[L.id]` filter) ─────────────────────────
// Regression guard: `APP.progress.completed` is empty above — nothing is "done" — and §1 already
// passed, so the gate is confirmed gone. Stated again explicitly, and checked the OTHER direction
// too: even completed:false for every lesson still marks everything.
{
  const C = client();
  C.run(`APP.progress = { solved: {}, completed: { T: {} } }; true;`);
  const html = C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(D)}, el);
    el.innerHTML;
  `, 'render');
  assert.ok(/<mark[^>]*>parliamo<\/mark>/.test(html),
    'a word from an INCOMPLETE lesson is still marked — completion no longer gates the light shade');
  console.log('  incomplete lessons still light up their words: OK');
}

// ── 3. The solved subset gets the stronger shade, same as every other panel ─────────────────────
{
  const C = client();
  const key = C.run(`qid({type:'mcq_conjugation', infinitive:'parlare', pronoun:'noi'}, 'l2')`, 'qid');
  assert.ok(key && key.length, 'the product produced a qid for the conjugation question');
  C.run(`APP.progress = { solved: { T: { ${JSON.stringify(key)}: 1 } }, completed: {} }; true;`);
  const html = C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(D)}, el);
    el.innerHTML;
  `, 'render');
  // ⚠️ UPDATED at `v87_k` (user ruling: "Fully identical — tappable too"). This panel now renders
  // through `_storyBodyHtml`, the SAME call the progress card makes, instead of its own open-coded
  // copy — which is what finally aligns it with the other panels, the very thing v82_c set out to do.
  // The consequence, checked and accepted rather than discovered later: `_storyBodyHtml` passes
  // `_wordStateMap(d)`, so marks carry TRACK T's THREE-state classes (`wp-red`/`wp-partial`/
  // `wp-green`) instead of the superseded v74_n two-shade `solved`. The CLAIM is unchanged — an
  // answered form must be visually distinguished from an unanswered one — only the vocabulary is.
  const answered = html.match(/<mark[^>]*>parliamo<\/mark>/);
  const unanswered = html.match(/<mark[^>]*>parlo<\/mark>/);
  assert.ok(answered && unanswered, 'both forms are marked at all');
  assert.ok(/\bwp-(red|partial|green)\b/.test(answered[0]),
    `the answered form carries a TRACK T state class — got ${answered[0]}`);
  assert.notStrictEqual(answered[0], unanswered[0],
    `an answered form must still render differently from an unanswered one — both got ${answered[0]}`);
  assert.ok(!/\bwp-red\b/.test(answered[0]),
    `and the answered one is not the untouched (red) state — got ${answered[0]}`);
  console.log('  an answered word renders in a different state class from an unanswered one: OK');
}

// ── 4. Tap affordance — this panel is now the SAME surface as the progress card (v87_k ruling) ──
{
  const C = client();
  C.run(`APP.progress = { solved: {}, completed: {} }; true;`);
  const html = C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(D)}, el);
    el.innerHTML;
  `, 'render');
  // ⚠️ INVERTED at `v87_k`, on an explicit user ruling, NOT quietly relaxed. v80_t had restricted
  // tapping to the one panel with an active run, and this panel was read-only. The user asked for
  // this card's text view to be "as close as possible, ideally identical code" to the progress
  // card's; tap and the three-state colouring are the SAME switch inside `_highlightVocabHtml`
  // (`stateByKey` — see its own v80_t comment), so they cannot be separated, and the choice was put
  // to them explicitly with that trade-off named. They chose fully identical, tappable included.
  //
  // Kept as an assertion in the opposite direction rather than deleted, so a silent REGRESSION back
  // to inert marks is still caught — this panel is now a tappable surface by decision, and after
  // v87_i a tap here plays every question tied to the word.
  assert.ok(/wp-tap/.test(html), 'this panel is tappable now (user ruling, v87_k) — identical to the progress card');
  assert.ok(/tapWord/.test(html), 'and the tap handler really is wired, not just the class');
  console.log('  marks are tappable, identical to the progress card (v87_k user ruling): OK');
}

// ── 5. Malformed lesson data does not throw — this panel's whole job is being read ──────────────
{
  const C = client();
  C.run(`APP.progress = { solved: {}, completed: {} }; true;`);
  const bad = { topic: 'T', story: 'Some story text here.', lessons: [
    null, { id: null, conjugations: [null] }, { id: 'x', words: [null, { base: null }] },
    { id: 'y', items: [{ choices: null }, {}] }, { id: 'z', grammar: [null, {}] },
  ] };
  assert.doesNotThrow(() => C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(bad)}, el);
    el.innerHTML;
  `, 'render'), 'renderStoryText survives junk lesson data');
  console.log('  malformed lesson data does not throw: OK');
}

console.log('unit-story-panel-alignment: ALL PASSED');
