// unit-library-sort.test.js
// item AR (v88_j) — sort the library by last-edit date, generation date, or total token usage.
//
// User request: "main page: sort saved stories/lessons (for selected language combinations) by
// total token usage, generation and last-edit date."
//
// ⚠️ THE TRAP IS NOT THE SORT. `GET /api/lessons` is a WHITELIST projection and does not carry
// `generationStats`. A token sort built without adding a field there works in the STATIC build
// (which ships whole topics and has it for free) and silently does NOTHING live — the exact
// `v74_i`/`v79_n` failure recorded in a comment at that very site. §5 guards the projection at the
// server source, because no client-side state can observe another process's whitelist.
//
// The other real decision: a storyline's "total token usage" is its OWN `tokenUsage` PLUS its
// chapters'. `addTokenUsage()` deliberately keeps storyline-level work (summary, storyboard,
// retitle) out of the chapters, so the two are different numbers and only their sum answers
// "what did this story cost". §3 pins that the storyline bucket actually participates.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = ms => new Promise(r => setTimeout(r, ms || 40));

// Three single-chapter storylines in ONE language pair, so the source-language grouping (which is
// NOT part of the sort choice) cannot mask the ordering under test. Each key ranks them differently,
// which is what makes the three assertions independent rather than one result seen three ways.
//        tokens(topic)  storyline own   TOTAL   generatedAt  updatedAt
//   A         10             500          510     2026-01-03   2026-01-01
//   B        200               0          200     2026-01-01   2026-01-03
//   C         50               0           50     2026-01-02   2026-01-02
const SAVED = [
  { id: 'tp_A', topic: 'A', lang: 'nl', srcLang: 'de', tokens: 10,  generatedAt: '2026-01-03', updatedAt: '2026-01-01', lessons: [] },
  { id: 'tp_B', topic: 'B', lang: 'nl', srcLang: 'de', tokens: 200, generatedAt: '2026-01-01', updatedAt: '2026-01-03', lessons: [] },
  { id: 'tp_C', topic: 'C', lang: 'nl', srcLang: 'de', tokens: 50,  generatedAt: '2026-01-02', updatedAt: '2026-01-02', lessons: [] },
  // v88_n: a DIFFERENT source language. Without it the source-language grouping has nothing to
  // reorder, and the assertion that reversing leaves the GROUPS alone passes vacuously — which is
  // exactly what the first version of this fixture did (mutation M2 stayed green).
  { id: 'tp_D', topic: 'D', lang: 'nl', srcLang: 'en', tokens: 999, generatedAt: '2026-01-09', updatedAt: '2026-01-09', lessons: [] },
];
const SLS = [
  { id: 'sl_A', title: 'A', chapters: ['tp_A'], tokenUsage: { totalPromptTokens: 300, totalCompletionTokens: 200 } },
  { id: 'sl_B', title: 'B', chapters: ['tp_B'] },
  { id: 'sl_C', title: 'C', chapters: ['tp_C'] },
  { id: 'sl_D', title: 'D', chapters: ['tp_D'] },
];

function client(sortKey, dir) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    APP.libFilter='all'; APP.libSrcFilter='all'; APP.libTagFilter=null;
    APP.libSort = ${JSON.stringify(sortKey)};
    APP.libSortDir = ${JSON.stringify(dir || 'desc')};
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    fetch = function(url){
      var u=String(url);
      var body = u.indexOf('/api/storylines')>=0 ? ${JSON.stringify(SLS)}
               : u.indexOf('/api/lessons')>=0    ? ${JSON.stringify(SAVED)} : {};
      return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(body); } });
    };
    true;`, 'seed');
  return C;
}
// Read the rendered order from the list markup. Keyed off the STORYLINE group id (`slgroup-sl_X`),
// not the topic id: `data-chain` carries topic NAMES, not ids, so a `tp_` scan finds nothing and
// would report an empty order against a perfectly good render — which is exactly what the first
// version of this helper did.
const order = sortKey => orderDir(sortKey, 'desc');
async function orderDir(sortKey, dir) {
  const C = client(sortKey, dir);
  C.run(`loadSavedList(); true;`, 'render');
  await settle(60);
  const html = C.run(`document.getElementById('saved-list').innerHTML`);
  const seen = [];
  for (const m of html.matchAll(/slgroup-sl_([ABCD])/g)) if (!seen.includes(m[1])) seen.push(m[1]);
  assert.strictEqual(seen.length, 4,
    'all four storylines rendered (got ' + seen.length + ') — a short list here means the render '
    + 'failed, not that the sort is wrong');
  return seen.join('');
}

(async () => {
  let failed = false;
  try {

    // ── 1. Last edited (the pre-existing default — an existing user sees no change) ────────────
    {
      const got = await order('edited');
      assert.strictEqual(got.slice(0,3), 'BCA', 'newest updatedAt first within the group (got ' + got + ')');
      console.log('  sort by last edited: OK');
    }

    // ── 2. Generated ──────────────────────────────────────────────────────────────────────────
    {
      const got = await order('created');
      assert.strictEqual(got.slice(0,3), 'ACB', 'newest generatedAt first within the group (got ' + got + ')');
      console.log('  sort by generation date: OK');
    }

    // ── 3. Token usage — and the STORYLINE bucket participates ────────────────────────────────
    // A has the FEWEST chapter tokens (10) but the most in total (510) because its storyline
    // carries 500 of its own. Summing only the chapters would put it LAST; the expected order is
    // what distinguishes "sum both" from "chapters only".
    {
      const got = await order('tokens');
      assert.strictEqual(got.slice(0,3), 'ABC',
        'highest TOTAL first, storyline bucket included (got ' + got + '; "BCA" would mean the '
        + 'storyline\'s own tokenUsage was ignored)');
      console.log('  sort by token usage, storyline bucket included: OK');
    }

    // ── 4. The control reflects the persisted key ─────────────────────────────────────────────
    // The <select>'s markup default is 'edited', so without this a reload shows the wrong label
    // while sorting correctly — a silent lie about what the learner is looking at.
    {
      const C = client('tokens');
      C.run(`loadSavedList(); true;`, 'r');
      await settle(60);
      assert.strictEqual(C.run(`document.getElementById('lib-sort').value`), 'tokens',
        'the select shows the key actually in use');
      console.log('  the control reflects the persisted key: OK');
    }

    // ── 4b. item AR follow-up (v88_n): the REVERSE button flips the chosen key ────────────────
    // The direction applies to the KEY only, never to the source-language grouping — reversing that
    // would reorder the flag-headed GROUPS rather than the list the learner asked to sort.
    {
      const asc  = await orderDir('tokens', 'asc');
      const desc = await orderDir('tokens', 'desc');
      assert.strictEqual(desc.slice(0,3), 'ABC', 'descending is the default order (highest total first)');
      assert.strictEqual(asc.slice(0,3), 'CBA', 'ascending is its exact reverse (got ' + asc + ')');

      const ascE = await orderDir('edited', 'asc');
      assert.strictEqual(ascE.slice(0,3), 'ACB',
        'the direction applies to whichever key is chosen, not just tokens (got ' + ascE + ')');
      console.log('  the reverse button flips the chosen key, whichever it is: OK');
    }

    // ── 4b-ii. Reversing does NOT reorder the language GROUPS ────────────────────────────────
    // `sl_D` is the only en-source storyline, and `de` sorts before `en`, so it must stay LAST in
    // both directions. Reversing the grouping instead of the key would move it to the front —
    // and would reorder the flag headers, which is not what the learner asked to sort.
    {
      const desc = await orderDir('tokens', 'desc');
      const asc  = await orderDir('tokens', 'asc');
      assert.strictEqual(desc[3], 'D', 'the other-language storyline sits last, descending');
      assert.strictEqual(asc[3], 'D',
        'and STILL last ascending — the direction flips the key, never the grouping (got ' + asc + ')');
      console.log('  reversing flips the key without reordering the language groups: OK');
    }

    // ── 4d. The toggle actually flips, and persists ──────────────────────────────────────────
    {
      const C = client('tokens', 'desc');
      C.run(`loadSavedList = function(){}; onLibSortDirToggle(); true;`, 'flip1');
      assert.strictEqual(C.run(`APP.libSortDir`), 'asc', 'one press goes ascending');
      C.run(`onLibSortDirToggle(); true;`, 'flip2');
      assert.strictEqual(C.run(`APP.libSortDir`), 'desc', 'a second press goes back');
      console.log('  the toggle flips the direction both ways: OK');
    }

    // ── 4c. The arrow reflects the persisted direction ────────────────────────────────────────
    // Same reason the select does: the markup default is ▼, so a reload would show it while
    // sorting ascending — a silent lie about what the learner is looking at.
    {
      const C = client('tokens', 'asc');
      C.run(`loadSavedList(); true;`, 'r');
      await settle(60);
      assert.strictEqual(C.run(`document.getElementById('lib-sort-dir').textContent`), '▲',
        'the arrow shows ascending when that is what is in use');
      const C2 = client('tokens', 'desc');
      C2.run(`loadSavedList(); true;`, 'r');
      await settle(60);
      assert.strictEqual(C2.run(`document.getElementById('lib-sort-dir').textContent`), '▼',
        'and descending otherwise (non-vacuity: the two differ)');
      console.log('  the arrow reflects the persisted direction: OK');
    }

    // ── 5. ⚠️ The SERVER projection carries the token scalar ──────────────────────────────────
    // Source-level on purpose: this is a claim about another process's whitelist, which no client
    // state can observe. Without it the whole feature is a static-build-only illusion.
    {
      const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
      const at = src.indexOf("if (M === 'GET' && url.pathname === '/api/lessons')");
      assert.ok(at > 0, 'found the /api/lessons route');
      const block = src.slice(at, at + 6000);
      assert.ok(/tokens:\s*n/.test(block),
        'the /api/lessons projection emits a `tokens` scalar — without it the token sort works in '
        + 'the static build and silently does nothing live (the v74_i/v79_n failure)');
      assert.ok(/totalPromptTokens/.test(block) && /totalCompletionTokens/.test(block),
        'and it is summed from BOTH halves of generationStats');
      console.log('  the /api/lessons whitelist carries the token scalar: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  console.log(failed ? 'unit-library-sort: FAILED' : 'unit-library-sort: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
