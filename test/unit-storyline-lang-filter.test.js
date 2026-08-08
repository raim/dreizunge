// unit-storyline-lang-filter.test.js
// v76_e — a storyline is ONE unit: the library language filter decides WHETHER it is shown, never
// WHICH of its chapters are.
//
// User-reported against storyline sl_9302163 ("Shadows of Marakana"), whose six chapters span three
// language pairs (sr<-en, sr<-de, hr<-sr): after adding chapters in a second and third pair, the
// card on the main page lost its storyboard, its title and its icon, chapters in the other
// languages stopped appearing, and the storyline "still existed" in the store but was not shown.
//
// One cause. loadSavedList built its chain index from the FILTERED topic list and projected each
// chain through it, so a mixed-language chain came out truncated. storylines_renderChain then tries
// to recover the storyline by an exact, full-length, POSITIONAL match against sl.chapters — which a
// truncated chain can never satisfy — and fell through to a synthetic 'c'+hash chain id with no
// storyline object behind it. Measured on the reported data at libFilter=sr / libSrcFilter=all:
// 5 of 6 chapters survived and the card was keyed `c1935658823`, exactly the id the user reported.
//
// Same class as v75_f: identity recovered from a hash of a projection instead of being carried.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Hand-built fixture: the corpus is not a constant, and this needs exact counts. Shaped like the
// reported storyline — a chain whose chapters are NOT all in one language pair.
const topics = [
  { id: 'tp_1', topic: 'Chapter One',   lang: 'sr', srcLang: 'en', updatedAt: '2026-08-01' },
  { id: 'tp_2', topic: 'Chapter Two',   lang: 'sr', srcLang: 'en', updatedAt: '2026-08-02' },
  { id: 'tp_3', topic: 'Chapter Three', lang: 'sr', srcLang: 'de', updatedAt: '2026-08-03' },
  { id: 'tp_4', topic: 'Chapter Four',  lang: 'hr', srcLang: 'sr', updatedAt: '2026-08-04' },
  // Not part of any storyline. Its only job is to keep section 3 non-vacuous: with NO topic
  // matching the filter, loadSavedList returns early on an empty list and section 3 would pass
  // without ever reaching the storyline branch it means to test.
  { id: 'tp_solo', topic: 'Unrelated Solo', lang: 'ja', srcLang: 'en', updatedAt: '2026-08-05' },
].map(t => Object.assign(t, {
  lessonCount: 1,
  lessons: [{ id: t.id + '_l1', type: 'standard' }],
}));
const STORY_ID = 'sl_testchain';
const storylines = [{
  id: STORY_ID, title: 'Shadows Fixture', icon: '🏟️',
  chapters: ['tp_1', 'tp_2', 'tp_3', 'tp_4'],
  storyboard: '<div class="sbframe">FIXTURE_STORYBOARD</div>',
  summary: 'FIXTURE_SUMMARY',
  lang: 'sr', srcLang: 'en',
}];

// The client's legacy synthetic id (index.html ~5349) — what the defect fell through to.
const synthId = (names) =>
  'c' + Math.abs(JSON.stringify(names).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));

async function renderLanding(libFilter, libSrcFilter) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.storylines = ${JSON.stringify(storylines)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{} };
    APP._teacherMode = false;
    APP.libFilter = ${JSON.stringify(libFilter)};
    APP.libSrcFilter = ${JSON.stringify(libSrcFilter)};
    APP.libTagFilter = null;
    // Harness limit (INTERNALS "Test harness limits"): the stub DOM has no <option> lists, so the
    // language-menu populator throws. It is unrelated to chain building.
    _populateLibSelects = function(){};
    window.fetch = function(u){
      var body = String(u).indexOf('/api/storylines') >= 0
        ? ${JSON.stringify(JSON.stringify(storylines))}
        : ${JSON.stringify(JSON.stringify(topics))};
      return Promise.resolve({ ok:true, json:function(){ return Promise.resolve(JSON.parse(body)); } });
    };
    window.__done = loadSavedList(); true;`, 'setup');
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  return C.run(`(function(){ var e=document.getElementById('saved-list'); return e ? e.innerHTML : ''; })()`, 'html');
}

(async () => {
  // ── 1. Under every filter that shows the storyline at all, it is shown WHOLE ────────────────
  // Each of these hides at least one chapter of the chain from the plain topic list.
  const cases = [
    ['sr',  'all', 'target filter on Serbian — hides the Croatian chapter (the reported state)'],
    ['all', 'en',  'source filter on English — hides the de- and sr-sourced chapters'],
    ['hr',  'all', 'target filter on Croatian — only the LAST chapter matches'],
    ['all', 'all', 'no filter at all — the control'],
  ];
  let sawTruncatable = false;
  for (const [lf, sf, why] of cases) {
    const html = await renderLanding(lf, sf);
    const gi = html.indexOf('slgroup-' + STORY_ID);
    assert.ok(gi >= 0,
      `the storyline is rendered under its REAL id when ${why} — a card keyed by anything else `
      + 'is a card with no storyline behind it');
    const seg = html.slice(gi, gi + 4000);

    // The derived content only renders when the storyline object was found.
    assert.ok(seg.includes('FIXTURE_STORYBOARD'), `the storyboard survives (${why})`);
    assert.ok(seg.includes('FIXTURE_SUMMARY'),    `the summary survives (${why})`);
    assert.ok(seg.includes('Shadows Fixture'),    `the title survives (${why})`);
    assert.ok(seg.includes('🏟️'),                 `the icon survives (${why})`);

    // The chain is whole: the header counts all four chapters, not the visible ones.
    const nCh = /(\d+) chapters/.exec(seg);
    assert.ok(nCh, `the header states a chapter count (${why})`);
    assert.strictEqual(nCh[1], '4',
      `all 4 chapters stay in the chain when ${why} — a truncated chain misnumbers `
      + `the story and drops chapters from the deck (got ${nCh[1]})`);

    // No synthetic fallback id anywhere on the page.
    const synth = html.match(/slgroup-c\d+/g) || [];
    assert.strictEqual(synth.length, 0,
      `no chain is rendered under a synthetic 'c'+hash id when ${why} (got ${synth.join(',')})`);

    // Non-vacuity, on the data THIS assertion runs against (session-28 rule 3): the case only
    // means something if the filter really would have truncated the chain.
    const visible = topics.filter(t =>
      (lf === 'all' || t.lang === lf) && (sf === 'all' || t.srcLang === sf));
    if (visible.length < topics.length) {
      sawTruncatable = true;
      assert.ok(visible.length >= 1, `fixture sanity: ${why}`);
      // …and the id the OLD code would have produced must not appear.
      const stale = synthId(visible.map(t => t.topic));
      assert.ok(!html.includes(stale),
        `the pre-v76_e synthetic id ${stale} is not rendered when ${why}`);
    }
  }
  assert.ok(sawTruncatable,
    'at least one case actually hides a chapter — otherwise this whole section is a no-op and '
    + 'would pass against the truncating code it exists to catch');

  // ── 2. A chapter the filter hides is not ALSO listed as a loose lesson ──────────────────────
  // inChain must be built from the whole chain, or the storyline's own chapters reappear under
  // "Individual lessons".
  {
    const html = await renderLanding('all', 'all');
    // Only the topic that belongs to no storyline may appear loose. A chapter of the chain
    // showing up here would mean inChain was built from the truncated projection.
    for (const t of topics) {
      if (t.id === 'tp_solo') continue;
      const loose = new RegExp('Individual lessons[\\s\\S]*' + t.topic).test(html);
      assert.ok(!loose, `chapter "${t.topic}" is not ALSO offered as a loose lesson`);
    }
    assert.ok(html.includes('Unrelated Solo'),
      'the topic that belongs to no storyline is still listed (non-vacuity: the check above is '
      + 'not passing merely because nothing is rendered)');
  }

  // ── 3. The filter still filters: a storyline with NO matching chapter is not shown ──────────
  // Otherwise section 1 would be satisfied by "always show everything", which is not the fix.
  {
    const html = await renderLanding('ja', 'all');
    // Non-vacuity: something matched, so the renderer reached the storyline branch rather than
    // returning early on an empty list.
    assert.ok(html.includes('Unrelated Solo'),
      'the ja filter still matches a topic — otherwise loadSavedList returns early and this '
      + 'section never exercises the storyline branch at all');
    assert.ok(!html.includes('slgroup-' + STORY_ID),
      'a storyline with no chapter in the filtered language is NOT shown — the filter still '
      + 'decides whether a storyline appears, it just no longer decides which chapters it has');
  }

  console.log('  storyline chains stay whole across language filters; real id, storyboard, summary and icon survive');
  console.log('unit-storyline-lang-filter: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
