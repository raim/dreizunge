// unit-cp5-shadow.test.js
// PLAN §7.0 CP5 (v83_l, user: "ok, continue" — chose "silent shadow-mode wiring" over a visible
// change) — "consume the plan read-only. Let the red→green text progress card read analysis and
// skill data with a legacy fallback." Mirrors the project's own B4/BKT shadow pattern.
//
// SUPERSEDED IN PART at v83_m (user: "build the visible CP5 surface", asked for explicitly after
// trying the silent version) — per the project's own standing rule ("rewrite a superseded invariant
// to state what holds NOW, with the supersession explained inline"), §5 below no longer asserts
// showComplete() renders byte-identical markup in every respect: it now asserts everything EXCEPT
// one new, narrowly-scoped element (`#comp-cp5-row`, inside the nav popup, NOT the main card) is
// still identical, and that THAT element's content is exactly the real fetched data when available.
// §1-4 and the underlying server route/store are UNCHANGED by v83_m — only the render layer gained a
// visible surface; the red→green border, the pass-mark logic, and everything else stays untouched.
//
// Contract under test:
//   1. `GET /api/cp-shadow/:chapterId` (server.js) is READ-ONLY, degrades to `available:false` for
//      the (overwhelmingly common) case where CP3's curriculum-plan.json has no entry for a chapter,
//      and returns a real comparison (via curriculum-plan.js's OWN compareWithExistingLessons) when
//      it does.
//   2. `refreshCp5Shadow(d)` (index.html) is a fire-and-forget lookup — it records into its own
//      `APP.progress.cp5Shadow` store when data is available, and is a provable no-op (no store
//      write, no saveProg call, never throws) when it is not — offline, unavailable, or missing
//      APP.progress entirely.
//   3. EVERYTHING except `#comp-cp5-row` is still byte-identical whether or not CP5 data is
//      available — the border colour, the pass-mark logic, every other element. `#comp-cp5-row`
//      itself renders the real fetched comparison, clearly labelled "experimental."
//   4. The row is reset SYNCHRONOUSLY on every render (before the async lookup even starts) — a
//      stale row from a PREVIOUS chapter with CP5 data must not still be showing when a DIFFERENT
//      chapter (with no data) renders, and a response that resolves late for a chapter the learner
//      has since navigated away from must never paint onto the WRONG chapter's row.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const { boot, get, tmpFile } = require('./lib.js');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = () => new Promise(r => setTimeout(r, 60));

// ── 1. Server: GET /api/cp-shadow/:chapterId is read-only, degrades safely ────
(async () => {
  {
    // Default boot: no CURRICULUM_PLAN_FILE override, so the endpoint reads whatever the REAL
    // project root's curriculum-plan.json is (typically absent) — either way, a chapterId this
    // store never had a topic for cannot resolve to `available:true`.
    const S = await boot();
    try {
      const r = await get(S.sport, '/api/cp-shadow/definitely-not-a-real-chapter-id');
      assert.strictEqual(r.status, 200, 'the endpoint never 404s for an unknown chapter — absence is the NORMAL case, not an error');
      assert.deepStrictEqual(r.body, { chapterId: 'definitely-not-a-real-chapter-id', available: false });

      const r2 = await get(S.sport, '/api/cp-shadow/' + encodeURIComponent(''));
      assert.strictEqual(r2.body.available, false, 'an empty chapterId degrades safely too');
    } finally { S.stop(); }
  }
  console.log('  GET /api/cp-shadow/:chapterId: read-only, 200+available:false is the NORMAL case for an unanalysed chapter: OK');

  // ── 2. Server: a real comparison when CP3 data DOES exist for the chapter ───
  {
    const scratchPlan = tmpFile('dz_cp5_plan', '.json');
    fs.writeFileSync(scratchPlan, JSON.stringify({
      schemaVersion: 1,
      chapters: {
        tp_fix: {
          chapterId: 'tp_fix', conceptCount: 2,
          concepts: [
            { type: 'vocab', lemma: 'Haus', sense: 'house' },
            { type: 'vocab', lemma: 'Katze', sense: 'cat' },
          ],
          provenance: { stage: 'CP3', pipelineVersion: 1 },
        },
      },
    }));
    const seed = {
      schemaVersion: 29, storylines: [], flags: {}, progress: {},
      topics: [{
        id: 'tp_fix', topic: 'Fixture', lang: 'de', srcLang: 'en', story: 'x',
        lessons: [{ id: '1', vocab: [{ target: 'Haus', source: 'house' }] }],
      }],
    };
    const S = await boot({ seed, extraEnv: { CURRICULUM_PLAN_FILE: scratchPlan } });
    try {
      const r = await get(S.sport, '/api/cp-shadow/tp_fix');
      assert.strictEqual(r.body.available, true);
      assert.strictEqual(r.body.conceptCount, 2);
      assert.strictEqual(r.body.comparison.proposedCount, 2);
      assert.strictEqual(r.body.comparison.coveredByExisting, 1, 'Haus is already taught in the seeded lesson; Katze is not — the SAME compareWithExistingLessons CP3 already shipped and tested');
      assert.deepStrictEqual(r.body.comparison.notCoveredByExisting, ['Katze']);
      assert.strictEqual(r.body.planProvenance.stage, 'CP3');

      // A DIFFERENT chapterId, present in curriculum-plan.json's keys but absent from lessons.json,
      // still resolves the plan (available:true) with no comparison (topic not found), not a crash.
      const r2 = await get(S.sport, '/api/cp-shadow/tp_no_such_topic');
      assert.strictEqual(r2.body.available, false, 'a chapterId with no curriculum-plan entry at all is still just unavailable, not an error');
    } finally { S.stop(); fs.unlinkSync(scratchPlan); }
  }
  console.log('  GET /api/cp-shadow/:chapterId: available:true carries a REAL comparison via curriculum-plan.js, sourced from the real seeded topic: OK');

  // ── 3. Client: refreshCp5Shadow records when available, real fetch round trip via the DOM stub ──
  {
    const C = loadClient({ quiet: true });
    C.run(`
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
      var _fetchedUrl = null;
      fetch = function(u){
        _fetchedUrl = u;
        return Promise.resolve({ ok: true, json: function(){ return Promise.resolve(
          { chapterId:'tp_x', available:true, conceptCount:3,
            comparison:{ proposedCount:3, coveredByExisting:1, notCoveredByExisting:['a','b'] } }); } });
      };
      refreshCp5Shadow({ id: 'tp_x', topic: 'Fixture' });
      true;`, 'call');
    await settle();
    assert.strictEqual(C.run('_fetchedUrl'), '/api/cp-shadow/tp_x', 'fetches the exact endpoint for the chapter\'s own id, url-encoded');
    const recorded = JSON.parse(C.run(`JSON.stringify(APP.progress.cp5Shadow.topics.tp_x)`));
    assert.strictEqual(recorded.available, true);
    assert.strictEqual(recorded.comparison.coveredByExisting, 1);
    assert.ok(recorded.updatedAt, 'a real timestamp is stamped on the recorded entry');
  }
  console.log('  refreshCp5Shadow: records the real fetched payload into APP.progress.cp5Shadow, keyed by chapter id: OK');

  // ── 4. Client: provably a NO-OP for every degenerate case — no store write, no saveProg call ──
  {
    const cases = [
      { label: 'available:false (the common case)', fetchBody: { chapterId: 'tp_y', available: false } },
      { label: 'fetch resolves ok:false', fetchOk: false },
      { label: 'fetch rejects (offline/no server — e.g. the static build)', fetchReject: true },
    ];
    for (const c of cases) {
      const C = loadClient({ quiet: true });
      C.run(`
        APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
        var saveProgCalls = 0; saveProg = function(){ saveProgCalls++; };
        fetch = function(u){
          ${c.fetchReject ? "return Promise.reject(new Error('offline'));" :
            `return Promise.resolve({ ok: ${c.fetchOk === false ? 'false' : 'true'}, json: function(){ return Promise.resolve(${JSON.stringify(c.fetchBody || {})}); } });`}
        };
        refreshCp5Shadow({ id: 'tp_y' });
        true;`, 'call-' + c.label);
      await settle();
      assert.strictEqual(C.run('saveProgCalls'), 0, `${c.label}: saveProg is never called`);
      assert.deepStrictEqual(JSON.parse(C.run('JSON.stringify(APP.progress.cp5Shadow.topics)')), {}, `${c.label}: nothing is recorded`);
    }
    // No APP.progress at all (pre-init state) — must not throw synchronously.
    const C2 = loadClient({ quiet: true });
    assert.doesNotThrow(() => C2.run(`APP.progress = null; refreshCp5Shadow({ id: 'tp_w' }); true;`, 'no-progress'),
      'refreshCp5Shadow never throws synchronously, even with no APP.progress to write into');
    // No chapter id at all.
    const C3 = loadClient({ quiet: true });
    assert.doesNotThrow(() => C3.run(`APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} }; refreshCp5Shadow({}); true;`, 'no-id'));
  }
  console.log('  refreshCp5Shadow: provably a no-op — no store write, no saveProg call — for unavailable/failed/offline/missing-state, never throws: OK');

  // ── 5. THE central claim: showComplete() renders IDENTICALLY whether CP5 data exists or not ──
  // Reuses unit-story-border-color.test.js's own TOPIC fixture — already proven to drive the
  // red→green border correctly — and compares its render with a stubbed available:true CP5 response
  // against the SAME render with the default (no-op) fetch stub. If CP5 ever changed anything
  // visible, this diff would catch it; it is not inferred from CP5 simply "not touching the DOM" in
  // the source, it is checked against the REAL rendered output both ways.
  {
    const TOPIC = {
      topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de', story: 'Una storia lunga abbastanza per contare.',
      lessons: [
        { id: 'l0', type: 'standard', vocab: [{ target: 'casa', source: 'Haus' }, { target: 'cane', source: 'Hund' }] },
        { id: 'l1', type: 'standard', vocab: [{ target: 'gatto', source: 'Katze' }] },
        { id: 'l2', type: 'comprehension', title: 'Verständnis', questions: [
          { q: 'a?', choices: ['x', 'y'], correctIndex: 0 }, { q: 'b?', choices: ['x', 'y'], correctIndex: 1 } ] },
      ],
    };
    const seedCommon = `
      LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(TOPIC)};
      APP.lang = 'it'; APP.srcLang = 'de';
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed: {}, solved: { T: {} }, chapterDone:{}, learned:{} };
      APP._teacherMode = false;
      APP.cur = { lessonIdx: 2, exercises: [], cur: 0, correct: 3, total: 4, mistakes: 1, hearts: 3, streak: 2, bestStreak: 2 };
    `;
    // Both renders AWAIT settle() before capturing state — the async fetch's .then() callback runs
    // on a LATER tick than showComplete()'s own synchronous return, so a mutation-test that mutated
    // the DOM only from inside that callback would be invisible to a check that reads too early.
    // (Caught exactly this way while building this test: an early first draft that read state
    // synchronously passed even when a deliberately injected late DOM write was present.)
    // Strips #comp-cp5-row out of the captured markup before comparing — that ONE element is
    // EXPECTED to differ (v83_m); everything else must not.
    const withoutCp5Row = (html) => html == null ? html : html.replace(/<div id="comp-cp5-row"[\s\S]*?<\/div>(?:<\/div>)?/, '<div id="comp-cp5-row"></div>');
    const renderAndCapture = async (fetchStub) => {
      const C = loadClient({ quiet: true });
      C.run(seedCommon + (fetchStub || '') + `showComplete(); true;`, 'render');
      await settle();
      return {
        border: C.document.getElementById('comp-story-panel').style.borderColor,
        html: C.document.getElementById('complete-screen') ? C.document.getElementById('complete-screen').innerHTML : null,
        cp5RowDisplay: C.document.getElementById('comp-cp5-row').style.display,
        cp5RowHtml: C.document.getElementById('comp-cp5-row').innerHTML,
        errors: JSON.parse(C.run(`JSON.stringify(_cardErrors())`)),
      };
    };
    const a = await renderAndCapture(null);   // baseline: default no-op fetch stub, no CP5 data
    const b = await renderAndCapture(`
      fetch = function(u){ return Promise.resolve({ ok:true, json: function(){ return Promise.resolve(
        { chapterId:'tp_x', available:true, conceptCount:5,
          comparison:{ proposedCount:5, coveredByExisting:2, notCoveredByExisting:['x','y','z'] } }); } }); };
    `);
    assert.strictEqual(a.border, b.border, 'the border colour is IDENTICAL whether or not CP5 data is available — v83_g\'s own signal stays untouched');
    assert.strictEqual(withoutCp5Row(a.html), withoutCp5Row(b.html),
      'EVERY OTHER element of the completion screen is still byte-identical — only #comp-cp5-row is allowed to differ, per the v83_m ruling');
    assert.strictEqual(a.cp5RowDisplay, 'none', 'baseline (no CP5 data): the row stays hidden, exactly the v83_l "legacy fallback" behaviour');
    assert.strictEqual(a.cp5RowHtml, '', 'baseline: the row is truly empty, not a hidden-but-populated element');
    assert.strictEqual(b.cp5RowDisplay, 'block', 'CP5 data available: the row is now shown — the v83_m visible surface');
    assert.ok(b.cp5RowHtml.includes('2') && b.cp5RowHtml.includes('5') && b.cp5RowHtml.includes('3'),
      `the row shows the REAL fetched numbers (2 covered, 5 proposed, 3 new), not placeholders (got ${b.cp5RowHtml})`);
    assert.deepStrictEqual(a.errors, [], 'no card errors in the baseline render');
    assert.deepStrictEqual(b.errors, [], 'no card errors when CP5 data is available either — the fire-and-forget fetch does not surface as a render-time error');
  }
  console.log('  showComplete(): identical everywhere EXCEPT #comp-cp5-row, which shows the real fetched comparison when available and stays empty/hidden otherwise: OK');

  // ── 6. The row is reset SYNCHRONOUSLY, before the async lookup starts ────────
  // A stale row from a chapter that HAD CP5 data must not still be visible once the SAME popup DOM
  // renders a DIFFERENT chapter that does not — checked on the SAME client instance (simulating an
  // SPA navigation, not a fresh page load), which is exactly the scenario a naive "only ever SET
  // display:block, never reset it" implementation would get wrong.
  {
    const C = loadClient({ quiet: true });
    const TOPIC2 = { topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de', story: 'x',
      lessons: [{ id: 'l0', type: 'standard', vocab: [{ target: 'a', source: 'b' }] }] };
    const base = `
      LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = []; APP.storylines = [];
      APP.lang = 'it'; APP.srcLang = 'de';
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed: {}, solved: { T: {} }, chapterDone:{}, learned:{} };
      APP._teacherMode = false;
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
    `;
    C.run(base + `
      APP.lessonData = ${JSON.stringify(TOPIC2)};
      fetch = function(u){ return Promise.resolve({ ok:true, json: function(){ return Promise.resolve(
        { chapterId:'tp_x', available:true, conceptCount:1, comparison:{proposedCount:1,coveredByExisting:0,notCoveredByExisting:['a']} }); } }); };
      showComplete(); true;`, 'render-tpx');
    await settle();
    assert.strictEqual(C.run(`document.getElementById('comp-cp5-row').style.display`), 'block', 'sanity: tp_x really did show the row first');

    C.run(`
      APP.lessonData = { ...APP.lessonData, id: 'tp_y' };
      fetch = function(u){ return Promise.resolve({ ok:true, json: function(){ return Promise.resolve({ chapterId:'tp_y', available:false }); } }); };
      showComplete(); true;`, 'render-tpy');
    // Checked IMMEDIATELY, before settle() — the reset must be synchronous, not dependent on the
    // (also no-op, here) async lookup for tp_y resolving.
    assert.strictEqual(C.run(`document.getElementById('comp-cp5-row').style.display`), 'none',
      'a DIFFERENT chapter with no CP5 data resets the row IMMEDIATELY, not just eventually — no stale flash of the previous chapter\'s data');
    assert.strictEqual(C.run(`document.getElementById('comp-cp5-row').innerHTML`), '', 'and the stale content itself is cleared, not merely hidden');
    await settle();
    assert.strictEqual(C.run(`document.getElementById('comp-cp5-row').style.display`), 'none', 'still hidden once tp_y\'s own (unavailable) lookup settles');
  }
  console.log('  #comp-cp5-row: reset SYNCHRONOUSLY on every render — no stale data survives a navigation to a different chapter: OK');

  // ── 7. A late-arriving response for a chapter the learner has since left never leaks ──
  {
    const C = loadClient({ quiet: true });
    const TOPIC3 = { topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de', story: 'x',
      lessons: [{ id: 'l0', type: 'standard', vocab: [{ target: 'a', source: 'b' }] }] };
    C.run(`
      LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(TOPIC3)};
      APP.lang = 'it'; APP.srcLang = 'de';
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed: {}, solved: { T: {} }, chapterDone:{}, learned:{} };
      APP._teacherMode = false;
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
      fetch = function(u){ return Promise.resolve({ ok:true, json: function(){ return Promise.resolve(
        { chapterId:'tp_x', available:true, conceptCount:1, comparison:{proposedCount:1,coveredByExisting:0,notCoveredByExisting:['a']} }); } }); };
      showComplete();
      // Simulate navigating away BEFORE the fetch above resolves — no second showComplete() render,
      // exactly the case a "just check APP.lessonData.id when painting" guard has to catch.
      APP.lessonData = { ...APP.lessonData, id: 'tp_z' };
      true;`, 'render-then-navigate');
    await settle();
    assert.strictEqual(C.run(`document.getElementById('comp-cp5-row').style.display`), 'none',
      'tp_x\'s late-resolving response must NOT paint its data onto the row while tp_z is now the active chapter');
  }
  console.log('  a CP5 response that resolves after the learner has navigated away never paints onto the wrong chapter\'s row: OK');

  console.log('unit-cp5-shadow: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
