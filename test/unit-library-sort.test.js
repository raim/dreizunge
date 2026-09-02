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

// ⚠️ v88_u: THE SOURCE-LANGUAGE PRE-SORT IS GONE. Until then the library sorted by source language
// FIRST and applied the learner's chosen key only WITHIN each language group — so "sort by token
// usage" never produced a list in token order across the library. The user removed it: "we sort by
// source language and THEN by the new sorter … drop the main previous source language sorting all
// together." Every expected order below therefore changed, and the section that asserted the
// grouping SURVIVES a reversal was rewritten to the opposite claim, which is now the correct one.
//
// Five single-chapter storylines. Each key ranks them differently, which is what makes the
// assertions independent rather than one result seen five ways — and the two LANGUAGE keys
// partition them DIFFERENTLY from each other (E shares A/B/C's source but D's target), so a
// srcLang↔lang mix-up cannot pass.
//        tokens(topic)  storyline own   TOTAL   generatedAt  updatedAt   srcLang  lang
//   A         10             500          510     2026-01-03   2026-01-01    de      nl
//   B        200               0          200     2026-01-01   2026-01-03    de      nl
//   C         50               0           50     2026-01-02   2026-01-02    de      nl
//   D        999               0          999     2026-01-05   2026-01-04    en      it
//   E          1               0            1     2026-01-04   2026-01-05    de      it
// ⚠️ The dates are chosen so ALL FIVE keys produce five DIFFERENT orders. The first attempt at this
// fixture had `srclang` and `edited` coincide, which would have let a sort that ignored the language
// key entirely pass §3b. Language names are LANGS's own (English): de=German, en=English,
// it=Italian, nl=Dutch — those are what the sort compares, not the two-letter codes.
const SAVED = [
  { id: 'tp_A', topic: 'A', lang: 'nl', srcLang: 'de', tokens: 10,  generatedAt: '2026-01-03', updatedAt: '2026-01-01', lessons: [] },
  { id: 'tp_B', topic: 'B', lang: 'nl', srcLang: 'de', tokens: 200, generatedAt: '2026-01-01', updatedAt: '2026-01-03', lessons: [] },
  { id: 'tp_C', topic: 'C', lang: 'nl', srcLang: 'de', tokens: 50,  generatedAt: '2026-01-02', updatedAt: '2026-01-02', lessons: [] },
  // v88_n: a DIFFERENT source language. v88_u gave it a different TARGET language too, and added E
  // sharing A/B/C's source but D's target — so the two language keys produce genuinely different
  // partitions and neither can stand in for the other.
  { id: 'tp_D', topic: 'D', lang: 'it', srcLang: 'en', tokens: 999, generatedAt: '2026-01-05', updatedAt: '2026-01-04', lessons: [] },
  { id: 'tp_E', topic: 'E', lang: 'it', srcLang: 'de', tokens: 1,   generatedAt: '2026-01-04', updatedAt: '2026-01-05', lessons: [] },
];
const SLS = [
  { id: 'sl_A', title: 'A', chapters: ['tp_A'], tokenUsage: { totalPromptTokens: 300, totalCompletionTokens: 200 } },
  { id: 'sl_B', title: 'B', chapters: ['tp_B'] },
  { id: 'sl_C', title: 'C', chapters: ['tp_C'] },
  { id: 'sl_D', title: 'D', chapters: ['tp_D'] },
  { id: 'sl_E', title: 'E', chapters: ['tp_E'] },
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
  for (const m of html.matchAll(/slgroup-sl_([ABCDE])/g)) if (!seen.includes(m[1])) seen.push(m[1]);
  assert.strictEqual(seen.length, 5,
    'all five storylines rendered (got ' + seen.length + ') — a short list here means the render '
    + 'failed, not that the sort is wrong');
  return seen.join('');
}
// The flag headers rendered above the list, in order, as language CODES.
async function headers(sortKey) {
  const C = client(sortKey, 'desc');
  C.run(`loadSavedList(); true;`, 'render');
  await settle(60);
  const html = C.run(`document.getElementById('saved-list').innerHTML`);
  const out = [];
  for (const m of html.matchAll(/<div class="orphans-hdr">([^<]*)<\/div>/g)) {
    const txt = m[1];
    const code = Object.keys(LANGS).find(c => LANGS[c] && txt.includes(LANGS[c].name));
    if (code && out[out.length - 1] !== code) out.push(code);
  }
  return out;
}

(async () => {
  let failed = false;
  try {

    // ── 1. Last edited (the default key) ──────────────────────────────────────────────────────
    // v88_u: asserted over the WHOLE list, not `slice(0,3)`. The slice existed to step around the
    // source-language pre-sort, which parked the en-source storyline last regardless of its date —
    // D is the most recently edited of all five and now sorts FIRST, which is the point of the
    // change and could not have been observed through the slice.
    {
      const got = await order('edited');
      assert.strictEqual(got, 'EDBCA',
        'newest updatedAt first ACROSS the library, not within a language group (got ' + got + ')');
      console.log('  sort by last edited, across languages: OK');
    }

    // ── 2. Generated ──────────────────────────────────────────────────────────────────────────
    {
      const got = await order('created');
      assert.strictEqual(got, 'DEACB', 'newest generatedAt first (got ' + got + ')');
      console.log('  sort by generation date: OK');
    }

    // ── 3. Token usage — and the STORYLINE bucket participates ────────────────────────────────
    // A has the FEWEST chapter tokens (10) but the most in total (510) because its storyline
    // carries 500 of its own. Summing only the chapters would put it LAST; the expected order is
    // what distinguishes "sum both" from "chapters only".
    {
      const got = await order('tokens');
      assert.strictEqual(got, 'DABCE',
        'highest TOTAL first, storyline bucket included (got ' + got + '; A after B and C would '
        + 'mean the storyline\'s own tokenUsage was ignored)');
      console.log('  sort by token usage, storyline bucket included: OK');
    }

    // ── 3b. v88_u: MY LANGUAGE and TARGET LANGUAGE are two more keys ──────────────────────────
    // They must partition the library DIFFERENTLY, or one could stand in for the other and a
    // srcLang↔lang mix-up would pass. E shares A/B/C's source (de) and D's target (it), which is
    // the whole reason it is in the fixture.
    {
      const bySrc = await order('srclang');
      assert.strictEqual(bySrc, 'DEBCA',
        'by MY language: the one en storyline (English) before the four de ones (German), each run '
        + 'tie-broken by last edited (got ' + bySrc + ')');
      const byTgt = await order('lang');
      assert.strictEqual(byTgt, 'BCAED',
        'by TARGET language: the three nl storylines (Dutch) before the two it ones (Italian) — a '
        + 'DIFFERENT partition from the source sort (got ' + byTgt + ')');
      const byEdited = await order('edited');
      assert.notStrictEqual(bySrc, byEdited,
        'and non-vacuity in the other direction: the source-language order differs from the DEFAULT '
        + 'key too, so a sort that quietly ignored the language key could not pass this section');
      assert.notStrictEqual(bySrc, byTgt,
        'non-vacuity: the two language keys really do produce different orders on this fixture');
      console.log('  sort by my language and by target language, two different partitions: OK');
    }

    // ── 3c. v88_u: the flag headers FOLLOW the sort ───────────────────────────────────────────
    // A header saying "Deutsch" over a run of rows claims the list is grouped by that language. It
    // is only grouped that way when the chosen key IS that language — so sorting by tokens and
    // still stamping source-language headers would emit one header per row wherever the languages
    // interleave, which is worse than none.
    {
      assert.deepStrictEqual(await headers('srclang'), ['en', 'de'],
        'sorting by my language heads the list with the SOURCE languages, in the sort\'s own order '
        + '(English before German — the names, not the codes)');
      assert.deepStrictEqual(await headers('lang'), ['nl', 'it'],
        'sorting by target language heads it with the TARGET languages instead (Dutch, Italian) — '
        + 'a different set AND a different order, so neither could stand in for the other');
      assert.deepStrictEqual(await headers('tokens'), [],
        'and a non-language sort renders NO language headers at all');
      assert.deepStrictEqual(await headers('edited'), [],
        'nor does the default key');
      console.log('  flag headers follow the chosen key, and vanish when it is not a language: OK');
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
    // v88_u: over the WHOLE list now, not a slice — with the source-language pre-sort gone, the
    // reversal is a plain reversal and nothing is parked at the end regardless of its value.
    {
      const asc  = await orderDir('tokens', 'asc');
      const desc = await orderDir('tokens', 'desc');
      assert.strictEqual(desc, 'DABCE', 'descending is the default order (highest total first)');
      assert.strictEqual(asc, 'ECBAD', 'ascending is its EXACT reverse (got ' + asc + ')');
      assert.strictEqual(asc, desc.split('').reverse().join(''),
        'stated as a property, not just as a second literal — the two cannot drift apart');

      const ascE = await orderDir('edited', 'asc');
      assert.strictEqual(ascE, 'ACBDE',
        'the direction applies to whichever key is chosen, not just tokens (got ' + ascE + ')');
      console.log('  the reverse button flips the chosen key, whichever it is: OK');
    }

    // ── 4b-ii. ⚠️ REWRITTEN AT v88_u: reversing a LANGUAGE key reverses the language runs ─────
    // This section previously asserted the OPPOSITE — that `sl_D` (the only en-source storyline)
    // stays last in both directions, because the direction flipped the key while the
    // source-language GROUPING stayed put. The user removed that grouping, so the claim inverted:
    // there is no longer an outer ordering for the reversal to leave alone, and a learner who
    // reverses "my language" expects the languages to reverse. Asserted on the HEADERS as well as
    // the rows, because the headers are the visible half of that claim.
    {
      const desc = await orderDir('srclang', 'desc');
      const asc  = await orderDir('srclang', 'asc');
      assert.strictEqual(desc, 'DEBCA', 'English before German, descending');
      assert.strictEqual(asc, 'EBCAD',
        'and German before English ascending — the language runs really do swap (got ' + asc + ')');
      assert.strictEqual(desc[0], 'D', 'non-vacuity: the en storyline leads one direction…');
      assert.strictEqual(asc[asc.length - 1], 'D', '…and trails the other');
      // Within a language run the tiebreak is NOT reversed — it is "last edited, newest first" in
      // both directions, so a reversal reorders the languages without shuffling each run's contents.
      assert.strictEqual(desc.slice(1), 'EBCA', 'the German run is newest-edited-first, descending');
      assert.strictEqual(asc.slice(0, 4), 'EBCA', 'and identically ordered ascending');
      console.log('  reversing a language key swaps the language runs, tiebreak unchanged: OK');
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
