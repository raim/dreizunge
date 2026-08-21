// unit-lang-picker-sync.test.js — PLAN §C5 stage 2.
//
// The user's ruling on splitting generation off the landing page: duplicate the language pickers
// (one on the new `generation-screen`, one on the library/`landing` screen) but keep them SYNCED —
// one shared value, not two independent filters. Chosen specifically because `selectLang`/
// `selectSrcLang` already carry SIX separate historical bug-fix references for exactly this kind
// of state-coupling going wrong (v67.1, v76_i, v78_q, v79_o, …), so this file exists to make the
// sync itself a guarded claim, not something only exercised incidentally by a screen journey.
//
// Scope: `src-lang-select`/`lang-select` (the ORIGINAL, canonical selects — now on
// `generation-screen`) and `lib-src-lang-select`/`lib-lang-select` (the NEW library-screen mirror)
// must always show the SAME value, and a change from EITHER side propagates to the other.
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
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.lang = APP.formLang = 'it'; APP.srcLang = APP.formSrcLang = 'en';
    loadSavedList = async function(){};
    saveLang = function(){}; saveSrcLang = function(){};
    // HARNESS SHIM (INTERNALS -> harness limits, same as unit-continue-pin.test.js): the stub DOM
    // does not parse static markup, so these selects have no real .options. selectSrcLang/selectLang
    // reach applyUIStrings() ASYNCHRONOUSLY (via loadUIStrings().then(...)), well after this test's
    // own synchronous assertions have already run — without this shim the unhandled rejection
    // surfaces later and fails the runner on an otherwise-passing test.
    ['lang-select','src-lang-select','lib-lang-select','lib-src-lang-select',
     'diff-select','format-select','style-select','vocab-mode-select','user-story-lang'].forEach(function(id){
      var e = document.getElementById(id);
      if (e) Object.defineProperty(e, 'options', { configurable:true, get:function(){ return []; } });
    });
    true;`, 'setup');
  return C;
}

async function main() {

// ── 1. Changing the CANONICAL select (generation screen) updates the library mirror ──────────
{
  const C = client();
  C.run("selectLang('de', undefined, true); true;", 'change-target');
  assert.strictEqual(C.run("document.getElementById('lang-select').value"), 'de',
    'the canonical target select took the new value');
  assert.strictEqual(C.run("document.getElementById('lib-lang-select').value"), 'de',
    'the library mirror followed it');
  C.run("selectSrcLang('fr', true); true;", 'change-source');
  assert.strictEqual(C.run("document.getElementById('src-lang-select').value"), 'fr',
    'the canonical source select took the new value');
  assert.strictEqual(C.run("document.getElementById('lib-src-lang-select').value"), 'fr',
    'the library mirror followed it');
  console.log('  canonical select change -> library mirror follows (target + source)');
}

// ── 2. Changing the LIBRARY mirror updates the canonical select back ─────────────────────────
// The mirror's own onclick calls selectLang(this.value)/selectSrcLang(this.value) — fromForm
// defaults to true, so this is the SAME code path as #1, just entered from the other select.
{
  const C = client();
  C.run("document.getElementById('lib-lang-select').value = 'es'; selectLang('es'); true;", 'lib-change-target');
  assert.strictEqual(C.run("document.getElementById('lang-select').value"), 'es',
    'the canonical target select followed the library mirror');
  C.run("document.getElementById('lib-src-lang-select').value = 'pt'; selectSrcLang('pt'); true;", 'lib-change-source');
  assert.strictEqual(C.run("document.getElementById('src-lang-select').value"), 'pt',
    'the canonical source select followed the library mirror');
  console.log('  library mirror change -> canonical select follows (target + source)');
}

// ── 3. fromForm=false (a footer selector, mid-story) does NOT drag the library filter along ──
// This is the property the user's ruling depends on: the library mirror tracks the FORM's own
// value, not whatever language is transiently being VIEWED elsewhere. Mirrors the existing
// footer-selector behaviour exactly (`src-lang-select` itself is equally untouched by this call).
{
  const C = client();
  C.run("selectSrcLang('de', true); true;", 'form-set');
  assert.strictEqual(C.run("document.getElementById('lib-src-lang-select').value"), 'de',
    'baseline: library mirror set by the real form change');
  C.run("selectSrcLang('ja', false); true;", 'footer-view');
  assert.strictEqual(C.run("document.getElementById('src-lang-select').value"), 'de',
    'the canonical select is untouched by a footer (fromForm=false) call — existing behaviour');
  assert.strictEqual(C.run("document.getElementById('lib-src-lang-select').value"), 'de',
    'and the library mirror stays with it — a mid-story glance must not silently refilter the library');
  console.log('  a footer-driven (fromForm=false) language view does not move either select');
}

// ── 4. The "all" (globe) reset clears both the canonical and the mirror together ─────────────
{
  const C = client();
  C.run("selectLang('de', undefined, true); true;", 'set-first');
  assert.strictEqual(C.run("document.getElementById('lib-lang-select').value"), 'de', 'baseline set');
  C.run("selectLang('all'); true;", 'reset');
  assert.strictEqual(C.run("document.getElementById('lang-select').value"), 'all', 'canonical select reset to all');
  assert.strictEqual(C.run("document.getElementById('lib-lang-select').value"), 'all', 'library mirror reset to all too');
  console.log('  the globe (all) reset clears both selects together');
}

// ── 5. The STATIC markup for both selects lists the same languages, in the same order ────────
// A copy-paste maintenance risk, not a runtime one: `lib-src-lang-select`/`lib-lang-select` are a
// SEPARATE hand-written `<option>` list in index.html, not generated from the canonical select's
// markup. `applyUIStrings()` re-clones the mirror's OWN options from the canonical select at
// runtime regardless (see index.html's "PLAN §C5 stage 2" comment there), which is exactly why a
// runtime check here would not catch a drift in the STATIC list — only a source-text comparison of
// the baked-in markup can. (Calling `applyUIStrings()` itself needs the `.options` DOM shim
// `unit-continue-pin.test.js` documents; skipped here since it would only re-prove the runtime
// clone, not this list's own health as a fallback for the FIRST paint before any script runs.)
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const extractOptions = id => {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at > 0, `${id} exists in the markup`);
    const selEnd = html.indexOf('</select>', at);
    const block = html.slice(at, selEnd);
    return [...block.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]);
  };
  const tgtCanon = extractOptions('lang-select');
  const tgtLib = extractOptions('lib-lang-select');
  assert.deepStrictEqual(tgtLib, tgtCanon,
    'lib-lang-select lists the exact same languages, same order, as the canonical lang-select');
  const srcCanon = extractOptions('src-lang-select');
  const srcLib = extractOptions('lib-src-lang-select');
  assert.deepStrictEqual(srcLib, srcCanon,
    'lib-src-lang-select lists the exact same languages, same order, as the canonical src-lang-select');
  assert.ok(tgtCanon.includes('all') && srcCanon.includes('all'),
    'non-vacuity: both canonical lists still carry the "all" (globe) option this comparison depends on');
  console.log(`  the library mirror's STATIC option list matches the canonical select's, language for language (${tgtCanon.length} target, ${srcCanon.length} source)`);
}

// ── 6. Every one of the four selects is actually WIRED to the sync functions ─────────────────
// Tests #1-2 prove selectLang()/selectSrcLang() themselves sync correctly, called directly — this
// proves each real <select> in the markup actually CALLS one of them onchange. Static markup, so
// there is no live element to click in this harness (see INTERNALS.md §5's STATIC-markup-is-
// never-parsed bullet) — asserted at the source instead.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const wiring = [
    ['lang-select', 'selectLang(this.value)'],
    ['src-lang-select', 'selectSrcLang(this.value)'],
    ['lib-lang-select', 'selectLang(this.value)'],
    ['lib-src-lang-select', 'selectSrcLang(this.value)'],
  ];
  for (const [id, call] of wiring) {
    assert.ok(html.includes(`id="${id}" onchange="${call}"`),
      `${id}'s onchange calls ${call}`);
  }
  console.log('  all four selects (canonical + mirror, both languages) are wired to selectLang/selectSrcLang');
}

console.log('unit-lang-picker-sync: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
