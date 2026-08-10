// unit-script-pick-persist.test.js
// v78_q (user hint) — an explicit script pick survives a no-op language re-selection.
//
// User, after a Serbian-Cyrillic job came out Latin and then worked on a retry: "if the bug exists,
// it may also be related to the recent 'fix' checkmark we introduced to avoid losing the selected
// 'continue from' when selecting other languages."
//
// That was the right thread. `selectLang(code)` has no early return, so it runs in full even when
// `code` is the language already active — every mirror/refresh calls it that way. It then cleared
// `APP.script` unconditionally (v76_i, correct for a REAL change), after which
// `_renderScriptPicker` recomputes `cur = APP.script || _inheritedScript()` and inherits the
// CONTINUED CHAPTER'S script. Continuing a Latin Serbian chapter therefore turned an explicit
// Cyrillic pick back into Latin, and the dropdown followed, so nothing looked wrong.
//
// Intermittent by construction — it depended on whether anything re-selected the language between
// the pick and the submit, which is exactly the "worked on the second attempt" the user saw. And
// the pin surviving language changes (the checkbox fix the user pointed at) is what makes an
// inherited script available to overwrite with.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    SCRIPTS_DATA = ${JSON.stringify(SCRIPTS)}; _scriptsData = SCRIPTS_DATA;
    // The user's setup: continuing a LATIN Serbian chapter, so inheritance has something to offer.
    APP.savedList = [{ id: 'p1', topic: 'Träume von Wien', lang: 'sr', srcLang: 'de',
                       script: 'latin', srcScript: 'latin' }];
    APP.lang = 'sr'; APP.srcLang = 'de';
    document.getElementById('continue-select').value = 'p1';
    // Keep the heavy tail of selectLang out of the way — this is about ONE assignment.
    saveLang = function(){}; saveSrcLang = function(){}; loadSavedList = function(){};
    repopulateContinueSelect = function(){}; updateDocDir = function(){};
    updateArcScriptRow = function(){}; updateTtsVoiceNote = function(){};
    updateTranslationLangHint = function(){}; loadUIStrings = function(){ return Promise.resolve(); };
    true;`, 'seed');
  return C;
}

// ── 1. The reported case: re-selecting the SAME language keeps the pick ────
{
  const C = client();
  C.run(`onScriptPick('target','cyrillic-sr');`);
  assert.strictEqual(C.run(`APP.script`), 'cyrillic-sr', 'the pick registered');
  C.run(`selectLang('sr');`);                       // a mirror/refresh, not a real change
  assert.strictEqual(C.run(`APP.script`), 'cyrillic-sr',
    're-selecting the language already in force must NOT discard the pick — it did, and the ' +
    'picker then inherited Latin from the continued chapter');
  console.log('  an explicit pick survives re-selecting the same language');
}

// ── 2. …and the picker does not silently re-inherit it away ────────────────
// The assignment above is only half of it: `_renderScriptPicker` writes `APP[key]` back, so a pick
// that survived `selectLang` could still be overwritten one line later.
{
  const C = client();
  C.run(`onScriptPick('target','cyrillic-sr'); selectLang('sr'); refreshScriptPickers();`);
  assert.strictEqual(C.run(`APP.script`), 'cyrillic-sr',
    'the picker re-render preserves the explicit pick rather than inheriting Latin');
  console.log('  the picker re-render preserves it too');
}

// ── 3. Non-vacuity: a REAL language change still clears it (v76_i) ─────────
// Without this the fix would be "never clear", which carries a script from one language into a
// request for another — the thing v76_i exists to prevent.
{
  const C = client();
  C.run(`onScriptPick('target','cyrillic-sr'); selectLang('it');`);
  assert.strictEqual(C.run(`APP.script`), null,
    'switching to a different target language DOES clear the pick — v76_i still holds');
  console.log('  a real language change still clears it');
}

// ── 4. The same on the source side ─────────────────────────────────────────
{
  const C = client();
  C.run(`onScriptPick('src','cyrillic-sr');`);
  assert.strictEqual(C.run(`APP.srcScript`), 'cyrillic-sr', 'the source pick registered');
  C.run(`selectSrcLang('de');`);
  assert.strictEqual(C.run(`APP.srcScript`), 'cyrillic-sr',
    're-selecting the same SOURCE language keeps the pick');
  C.run(`selectSrcLang('en');`);
  assert.strictEqual(C.run(`APP.srcScript`), null, 'a real source change clears it');
  console.log('  the source side behaves identically');
}

// ── 5. Inheritance still works where there is no explicit pick ─────────────
// The v76_g ruling: with nothing chosen, the chapter being continued decides. The fix must not
// turn that off, or a continuation would start asking a question it used to answer.
{
  const C = client();
  C.run(`APP.script = null; refreshScriptPickers();`);
  assert.strictEqual(C.run(`APP.script`), 'latin',
    'with no explicit pick, the continued chapter still supplies the script (v76_g)');
  console.log('  inheritance still applies when nothing was picked');
}

console.log('unit-script-pick-persist: ALL PASSED');
