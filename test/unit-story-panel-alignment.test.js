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
  assert.ok(/<mark class="story-vocab-hl solved">parliamo<\/mark>/.test(html),
    `the answered form gets the "solved" class — got ${html.match(/<mark[^>]*>parliamo<\/mark>/)}`);
  assert.ok(/<mark class="story-vocab-hl">parlo<\/mark>/.test(html),
    'a form for a pronoun NOT answered stays in the plain (light) shade');
  console.log('  a solved word renders with the stronger "solved" shade, others do not: OK');
}

// ── 4. No tap affordance — this is a read-only panel, same as the library/storyline panels ──────
// v80_t restricted tapping to the ONE panel with an active run to jump into. This screen has none,
// same reasoning as `_renderSavedStory`/`_renderChainStory` (neither passes a state map either).
{
  const C = client();
  C.run(`APP.progress = { solved: {}, completed: {} }; true;`);
  const html = C.run(`
    const el = document.createElement('div');
    renderStoryText(${JSON.stringify(D)}, el);
    el.innerHTML;
  `, 'render');
  assert.ok(!/wp-tap/.test(html), 'no tappable class on this panel');
  assert.ok(!/tapWord/.test(html), 'no tapWord handler wired on this panel');
  console.log('  marks are inert (no tap), matching every other read-only story panel: OK');
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
