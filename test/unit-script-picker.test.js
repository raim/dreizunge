// unit-script-picker.test.js
// v76_i — the generation form's script picker, and the inheritance rule the user set:
// "inherit from the storyline's previous chapter, explicit pick only for a brand-new story".
//
// The picker must appear ONLY for a language scripts.json declares as having a choice. That is not
// the same as "more than one script": Japanese lists hiragana and katakana and mixes them inside
// one sentence. Getting this wrong shows a meaningless hiragana/katakana picker on every Japanese
// chapter, which is why section 2 exists.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI      = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));

// Non-vacuity for the whole file: these fixtures assume Serbian is a choice and Japanese is not.
assert.ok((SCRIPTS._scriptChoice || []).includes('sr'),
  'scripts.json declares sr a script choice — every section below is built on that');
assert.ok(!(SCRIPTS._scriptChoice || []).includes('ja') && (SCRIPTS._langScript.ja || []).length > 1,
  'and ja has several scripts but is NOT a choice — the case section 2 distinguishes');

function client(savedList) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
         SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)};
         APP.savedList = ${JSON.stringify(savedList || [])};
         APP.info = { backend:'none', canGenerate:true };
         // selectLang() repopulates the library, which fetches. Without a stub that rejects
         // asynchronously AFTER the assertions and crashes the runner (harness limit, not product).
         window.fetch = function(){ return Promise.resolve({ ok:true, json:function(){
           return Promise.resolve(${JSON.stringify([])}); } }); };
         true;`, 'seed');
  return C;
}
const pickerHtml = (C, id) =>
  C.run(`(function(){ var e=document.getElementById(${JSON.stringify(id)});
          return e ? { display: e.style.display, html: e.innerHTML } : null; })()`, 'read');

// ── 1. A digraphic target language gets a picker, offering exactly its scripts ────────────────
{
  const C = client();
  C.run(`APP.lang='sr'; APP.srcLang='en'; APP.script=null; refreshScriptPickers(); true;`, 'render');
  const tgt = pickerHtml(C, 'script-wrap');
  assert.ok(tgt && tgt.display !== 'none', 'the target-side picker is shown for Serbian');
  for (const s of SCRIPTS._langScript.sr) {
    assert.ok(tgt.html.includes('value="' + s + '"'), `it offers ${s}`);
  }
  assert.ok(/>Cyrillic</.test(tgt.html) && /internal|>Latin</.test(tgt.html),
    'labelled for a reader (Cyrillic / Latin), not by the internal table name');
  assert.ok(!/cyrillic-sr</.test(tgt.html),
    'the raw table name `cyrillic-sr` is not shown as a label — the -sr suffix names OUR table');
  // Brand-new story: nothing is preselected, so the learner has to choose (the user's ruling).
  const chosen = C.run(`APP.script`, 'v');
  assert.ok(!chosen, `a brand-new story preselects no script (got ${JSON.stringify(chosen)})`);
  // The source side is English — one script, no picker.
  const src = pickerHtml(C, 'src-script-wrap');
  assert.strictEqual(src.display, 'none', 'the source-side picker stays hidden for English');
}

// ── 2. A multi-script language that is NOT a choice gets NO picker ────────────────────────────
// The distinction this file exists for. Without it, `scriptsForLang(x).length > 1` would do.
{
  const C = client();
  C.run(`APP.lang='ja'; APP.srcLang='en'; APP.script=null; refreshScriptPickers(); true;`, 'render');
  const tgt = pickerHtml(C, 'script-wrap');
  assert.strictEqual(tgt.display, 'none',
    'Japanese lists two scripts but MIXES them — offering a hiragana/katakana choice is meaningless');
  const C2 = client();
  C2.run(`APP.lang='de'; APP.srcLang='en'; refreshScriptPickers(); true;`, 'render');
  assert.strictEqual(pickerHtml(C2, 'script-wrap').display, 'none',
    'and a single-script language gets nothing either');
}

// ── 3. The source side is picked up too ──────────────────────────────────────────────────────
// The user's own corpus has an hr<-sr chapter, where Serbian is the SOURCE.
{
  const C = client();
  C.run(`APP.lang='hr'; APP.srcLang='sr'; APP.srcScript=null; refreshScriptPickers(); true;`, 'render');
  assert.ok(pickerHtml(C, 'src-script-wrap').display !== 'none',
    'a digraphic SOURCE language gets its own picker');
  assert.strictEqual(pickerHtml(C, 'script-wrap').display, 'none',
    'while Croatian (Latin only) gets none on the target side');
}

// ── 4. Inheritance: the chapter being continued decides ──────────────────────────────────────
{
  const saved = [
    { id: 'tp_prev', topic: 'Chapter One', lang: 'sr', srcLang: 'en', script: 'cyrillic-sr' },
    { id: 'tp_lat',  topic: 'Latin One',   lang: 'sr', srcLang: 'en', script: 'latin' },
  ];
  const C = client(saved);
  // Stand in for the continue-select the inheritance reads.
  C.run(`document.getElementById('continue-select').value = 'tp_prev';
         APP.lang='sr'; APP.srcLang='en'; APP.script=null; refreshScriptPickers(); true;`, 'inherit');
  assert.strictEqual(C.run(`APP.script`, 'v'), 'cyrillic-sr',
    'continuing a Cyrillic chapter inherits Cyrillic');
  assert.ok(/value="cyrillic-sr" selected/.test(pickerHtml(C, 'script-wrap').html),
    'and the inherited value is the one preselected in the menu');

  // A different parent inherits differently — otherwise the assertion above could pass because
  // cyrillic-sr happens to be first in the list.
  const C2 = client(saved);
  C2.run(`document.getElementById('continue-select').value = 'tp_lat';
          APP.lang='sr'; APP.srcLang='en'; APP.script=null; refreshScriptPickers(); true;`, 'inherit2');
  assert.strictEqual(C2.run(`APP.script`, 'v'), 'latin',
    'continuing a Latin chapter inherits Latin — the value follows the PARENT, not the list order');

  // …and an explicit pick overrides the inheritance (the per-chapter override).
  C2.run(`onScriptPick('target','cyrillic-sr'); true;`, 'override');
  assert.strictEqual(C2.run(`APP.script`, 'v'), 'cyrillic-sr',
    'an explicit pick overrides what was inherited — this is the per-chapter override');
}

// ── 5. Changing the language clears a script chosen for the previous one ─────────────────────
{
  const C = client();
  C.run(`APP.lang='sr'; APP.srcLang='en'; onScriptPick('target','cyrillic-sr'); true;`, 'pick');
  assert.strictEqual(C.run(`APP.script`, 'v'), 'cyrillic-sr', 'a script is in force');
  C.run(`selectLang('de'); true;`, 'switch');
  assert.ok(!C.run(`APP.script`, 'v'),
    'switching the target language drops the script — sending German a Serbian script value would '
    + 'be meaningless, and the server would reject it anyway');
}

console.log('  script picker: shown only for a declared script CHOICE, inherits from the parent chapter');
console.log('unit-script-picker: ALL PASSED');
