// unit-static-storyline-filter.test.js
// v76_k — the SAME claim as unit-storyline-lang-filter (v76_e), asserted against the BUILT
// docs/index.html.
//
// Why a second test for the same behaviour: build-static.js carries its OWN copy of
// loadSavedList, which overrides the client's. The v76_e fix therefore landed in index.html only,
// and the static build kept truncating mixed-language chains — user-reported against the published
// docs/ build, where selecting Serbian showed a title-less, storyboard-less link to a synthetic
// `c…` id while the live build was already fixed.
//
// This is the same duplication hazard as v76_b (the language menus living in two files, only one
// guarded). Asserting on the BUILT ARTEFACT is the only thing that catches it: every source-level
// assertion about index.html passed throughout.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const DOCS = path.join(ROOT, 'docs', 'index.html');
assert.ok(fs.existsSync(DOCS), 'docs/index.html exists (run `node build-static.js`)');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const byId = {};
for (const t of (store.topics || [])) byId[t.id] = t;

// Find a storyline whose chapters are NOT all in one language pair — the only shape that can show
// this bug. Derived from the corpus, never hard-coded: the corpus is not a constant.
const mixed = (store.storylines || []).find(sl => {
  const ts = (sl.chapters || []).map(c => byId[c]).filter(Boolean);
  if (ts.length !== (sl.chapters || []).length || ts.length < 2) return false;
  return new Set(ts.map(t => (t.lang || 'it') + '|' + (t.srcLang || 'en'))).size > 1;
});
assert.ok(mixed,
  'the corpus contains a storyline spanning more than one language pair — without one this file '
  + 'cannot exercise the bug at all and would pass vacuously');

const chapters = mixed.chapters.map(c => byId[c]);
const pairs = [...new Set(chapters.map(t => (t.lang || 'it') + '|' + (t.srcLang || 'en')))];
// A target-language filter that hides at least one chapter of the chain.
const targetFilter = (chapters[0].lang || 'it');
const hidden = chapters.filter(t => (t.lang || 'it') !== targetFilter);
assert.ok(hidden.length > 0,
  `filtering to ${targetFilter} hides at least one chapter (non-vacuity: otherwise the filter `
  + 'removes nothing and the projection cannot truncate)');

(async () => {
  // Drive the BUILT file, so this asserts the artefact the user actually loads.
  const C = loadClient({ quiet: true, file: DOCS });
  // init() is suppressed by the harness, so the globals it would populate must be seeded. LANGS is
  // read while rendering the storyline header; without it the render throws before any assertion.
  const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`APP.libFilter = ${JSON.stringify(targetFilter)};
         APP.libSrcFilter = 'all'; APP.libTagFilter = null;
         APP.info = APP.info || {}; APP._teacherMode = false;
         APP.progress = { completed:{}, solved:{}, chapterDone:{} };
         // Harness limit: the stub DOM has no <option> lists.
         if (typeof _populateLibSelects === 'function') _populateLibSelects = function(){};
         window.__p = loadSavedList(); true;`, 'render');
  for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
  const html = C.run(`(function(){ var e=document.getElementById('saved-list'); return e ? e.innerHTML : ''; })()`, 'html');

  assert.ok(html && html.length > 0, 'the static landing list rendered something (non-vacuity)');

  // The card must be keyed by the REAL storyline id…
  assert.ok(html.includes('slgroup-' + mixed.id),
    `the static build renders "${mixed.title || mixed.id}" under its real id when the library is `
    + `filtered to ${targetFilter} — a card keyed by anything else has no storyline behind it, so `
    + 'it shows no title, no icon and no storyboard, which is exactly what was reported');

  // …and never by a synthetic 'c'+hash chain id.
  const synth = html.match(/slgroup-c\d+/g) || [];
  assert.strictEqual(synth.length, 0,
    `no chain is rendered under a synthetic 'c'+hash id (got ${synth.join(',')})`);

  // The chain is whole: the header counts every chapter, not just the visible ones.
  const gi = html.indexOf('slgroup-' + mixed.id);
  const seg = html.slice(gi, gi + 4000);
  const n = /(\d+) chapter/.exec(seg);
  assert.ok(n, 'the storyline header states a chapter count');
  assert.strictEqual(Number(n[1]), mixed.chapters.length,
    `all ${mixed.chapters.length} chapters stay in the chain (got ${n[1]}) — a truncated chain `
    + 'misnumbers the story and drops chapters from the deck');

  // The derived content only renders when the storyline object was actually found.
  if (mixed.title) {
    assert.ok(seg.includes(mixed.title), 'the storyline title survives the filter');
  }
  if (mixed.storyboard) {
    assert.ok(seg.includes('slsb-wrap-' + mixed.id) || /storyline-sb|sbframe/.test(seg),
      'the storyboard survives the filter — its absence was the reported symptom');
  }

  console.log(`  docs/: "${mixed.title || mixed.id}" (${pairs.length} language pairs) renders whole under a ${targetFilter} filter`);
  console.log('unit-static-storyline-filter: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
