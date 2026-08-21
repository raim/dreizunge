// unit-ui-lang-decouple.test.js — user follow-up after v81_ab.
//
// "Reverting a previous decision, move UI language selection from the storyline page bottom to
// settings, including an 'over-rule storyline source language' check-mark. We want the user to be
// able to generate or play stories in languages different from the UI. Show a warning pill, when
// UI language is fixed and a lesson in different source language is selected."
//
// Two explicit rulings shape this, given directly (not guessed): (1) FULLY DECOUPLE — APP.uiLang
// is a genuinely separate field from APP.srcLang ("I speak"), not the same field wearing two hats;
// (2) STORYLINE ONLY — lesson-set's identical auto-follow-on-open mechanism is untouched, keeps
// its old conflated behaviour, has no overrule option. Measured before building: opening a
// lesson-set/storyline used to auto-overwrite APP.srcLang (and, with it, the UI language) to that
// content's own source language; the footer selectors did the same thing manually, mid-story,
// non-persistently.
//
// SAME-RELEASE BUG FOUND AND FIXED (user report, reproduced live before fixing): "storyline only"
// does not mean "the goLessonSet FUNCTION is out of scope" — goLessonSet is ALSO the shared
// plumbing loadSaved() uses to open/continue a STORYLINE's OWN chapters (every "next chapter"
// transition inside a storyline runs through here, not through openStorylineScreen again), so its
// old unconditional auto-follow silently overrode the overrule setting on every chapter change.
// Fixed by checking storyline MEMBERSHIP (_storylineIdForTopic), not entry point: a chapter
// belonging to a storyline now respects the overrule flag exactly like openStorylineScreen's own
// check (check #5b below); a genuinely standalone topic keeps the old unconditional behaviour,
// since that case really is still out of the "storyline only" ruling's scope (check #5c).
//
// A second follow-up shortened the checkbox's label to "Fix" (from "Keep fixed while playing
// storylines") and moved it onto the picker's own row — the fuller explanation survives as a
// hover tooltip, same convention v79_o already established for the sound-test row.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadClient } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
const uiJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Extract a named function's body by brace balance — the technique unit-static-selectlang-tts.js
// and others already established, reused here rather than inventing a new one.
function body(src, name, isFunctionKeyword) {
  const marker = (isFunctionKeyword === false) ? name : 'function ' + name + '(';
  const at = src.indexOf(marker);
  assert.ok(at > -1, `${name} found in source`);
  let d = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(at, i);
}

// ── 1. The storyline footer's UI-language picker is GONE; lesson-set's survives ───────────────
assert.ok(!/id="src-lang-select-footer-sl"/.test(html),
  'THE REGRESSION: the storyline footer UI-language <select> must be fully removed, not just hidden');
assert.strictEqual((html.match(/id="src-lang-select-footer-ls"/g) || []).length, 1,
  'lesson-set\'s footer UI-language <select> must survive untouched — out of scope by ruling');
console.log('  storyline footer picker gone; lesson-set footer picker survives: OK');

// ── 2. The Settings Card's own UI-language picker + overrule checkbox exist ────────────────────
assert.ok(/id="ui-lang-select"[^>]*onchange="selectUiLang\(this\.value\)"/.test(html),
  '#ui-lang-select exists and calls selectUiLang()');
assert.ok(/id="overrule-sl-lang-cb"[^>]*onchange="toggleOverruleStorylineLang\(\)"/.test(html),
  '#overrule-sl-lang-cb exists and calls toggleOverruleStorylineLang()');
{
  const settingsModal = (() => {
    const at = html.indexOf('<div id="settings-modal"');
    let d = 1, i = html.indexOf('>', at) + 1;
    const tagRe = /<div\b|<\/div>/g; tagRe.lastIndex = i;
    let t;
    while ((t = tagRe.exec(html))) { if (t[0] === '<div') d++; else d--; if (!d) return html.slice(at, t.index + t[0].length); }
  })();
  assert.ok(settingsModal.includes('id="ui-lang-select"') && settingsModal.includes('id="overrule-sl-lang-cb"'),
    'both live inside #settings-modal, not somewhere else');
}
console.log('  the Settings Card holds the UI-language picker and the overrule checkbox: OK');

// ── 2b. Follow-up: short "Fix" label, full explanation as a tooltip, same row as the picker ────
assert.strictEqual(uiJson.en['settings.overrule_sl_lang'], 'Fix',
  'the visible label is shortened to "Fix"');
assert.strictEqual(uiJson.en['settings.overrule_sl_lang_title'],
  'Keep the UI language fixed here, even while playing storylines in other languages',
  'the fuller explanation survives as a separate key for the tooltip');
assert.ok(/_setAttr\('overrule-sl-lang-row', 'title', t\('settings\.overrule_sl_lang_title'\)\)/.test(html),
  'the tooltip is wired through applyUIStrings()');
assert.ok(!/flex-basis:100%/.test(html.slice(html.indexOf('id="overrule-sl-lang-row"') - 200, html.indexOf('id="overrule-sl-lang-row"'))),
  'THE REGRESSION: the checkbox row must not be forced onto its own line anymore — it shares the picker\'s row');
console.log('  the checkbox: shortened "Fix" label, tooltip wired, shares the picker\'s row: OK');

// ── 3. THE CORE CLAIM: "I speak" (fromForm=true) no longer touches the UI language ────────────
{
  const fn = body(html, 'selectSrcLang');
  // The fromForm block (everything inside `if(fromForm){...}`) must not call loadUIStrings.
  const formBlockStart = fn.indexOf('if(fromForm){');
  const formBlockEnd = (() => {
    let d = 0, i = fn.indexOf('{', formBlockStart);
    for (; i < fn.length; i++) { const c = fn[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return i + 1; } }
  })();
  const formBlock = fn.slice(formBlockStart, formBlockEnd);
  assert.ok(!/loadUIStrings/.test(formBlock),
    'THE REGRESSION: fromForm=true must not call loadUIStrings — that is "I speak" re-conflating with UI language');
  // And there must be an early return for fromForm before the (still-present) loadUIStrings call
  // reachable only by fromForm=false.
  assert.ok(/if\(fromForm\)\{[\s\S]*?return;\s*\}/.test(fn.slice(fn.indexOf('// "I speak"'))),
    'fromForm=true returns before reaching the fromForm=false-only UI-language branch');
  assert.ok(/APP\.uiLang = code;\s*\n\s*loadUIStrings\(code\)/.test(fn),
    'the fromForm=false branch (lesson-set footer, the one remaining caller) still sets APP.uiLang and reloads UI strings');
}
console.log('  selectSrcLang: fromForm=true no longer touches UI language, fromForm=false still does: OK');

// Mutation check: the "no loadUIStrings in the fromForm block" assertion must be able to fail.
{
  const fn = body(html, 'selectSrcLang');
  const formBlockStart = fn.indexOf('if(fromForm){');
  let d = 0, i = fn.indexOf('{', formBlockStart);
  for (; i < fn.length; i++) { const c = fn[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  const formBlock = fn.slice(formBlockStart, i);
  const mutated = formBlock.replace('APP.formSrcLang=code;', 'APP.formSrcLang=code; loadUIStrings(code);');
  assert.notStrictEqual(mutated, formBlock, 'the mutation must actually add a loadUIStrings call');
  assert.ok(/loadUIStrings/.test(mutated), 'sanity: mutated block is detectably different');
}
console.log('  mutation check: reintroducing loadUIStrings into the fromForm block is detectable: OK');

// ── 4. updateDocDir() follows APP.uiLang, not APP.srcLang ──────────────────────────────────────
{
  const fn = body(html, 'updateDocDir');
  assert.ok(/APP\.uiLang \|\| 'en'/.test(fn), 'the doc-dir check reads APP.uiLang');
  assert.ok(!/const uiLang = APP\.srcLang/.test(fn), 'THE REGRESSION: must not still read APP.srcLang for this');
  // The OTHER half — content-direction (tgt-rtl) — is a separate, unaffected concern; must still
  // key off APP.lang (the target/content language), not uiLang.
  assert.ok(/classList\.toggle\('tgt-rtl', RTL_LANGS\.has\(APP\.lang\)\)/.test(fn),
    'tgt-rtl marking must stay keyed on APP.lang (content), untouched by the uiLang split');
}
console.log('  updateDocDir() reads APP.uiLang for chrome direction, APP.lang for content: OK');

// ── 5. openStorylineScreen: content context always follows; UI language is gated by overrule ──
{
  const at = html.indexOf('async function openStorylineScreen(');
  let d = 0, i = html.indexOf('{', at);
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  const fn = html.slice(at, i);
  assert.ok(/if \(slSrc && slSrc !== APP\.srcLang\) APP\.srcLang = slSrc;/.test(fn),
    'APP.srcLang (content context) always follows the storyline\'s own source language, unconditionally');
  assert.ok(/APP\._slLangMismatch = APP\.overruleStorylineLang && slSrc !== APP\.uiLang;/.test(fn),
    'the mismatch flag is computed every open, for the warning pill');
  assert.ok(/if \(!APP\.overruleStorylineLang && slSrc && slSrc !== APP\.uiLang\) \{/.test(fn),
    'THE REGRESSION: UI-language auto-follow must be gated behind !APP.overruleStorylineLang');
}
console.log('  openStorylineScreen: content context unconditional, UI-language auto-follow gated on overrule: OK');

// ── 5b. THE BUG FIX: goLessonSet respects overrule too, for chapters that belong to a storyline ─
{
  const fn = body(html, 'goLessonSet');
  assert.ok(/const _slId = _storylineIdForTopic\(APP\.lessonData\.topic\);/.test(fn),
    'goLessonSet checks storyline MEMBERSHIP of the topic being opened');
  assert.ok(/const _slOverruled = _slId && APP\.overruleStorylineLang;/.test(fn),
    'only overruled when the topic actually belongs to a storyline AND the flag is on');
  assert.ok(/if \(lSrc && lSrc !== APP\.uiLang && !_slOverruled\) \{/.test(fn),
    'THE REGRESSION (the reported bug): the uiLang auto-follow must be skippable for a storyline chapter when overruled');
  assert.ok(/APP\._slLangMismatch = !!\(_slOverruled && lSrc !== APP\.uiLang\);/.test(fn),
    'the mismatch flag is set here too, so returning to the storyline screen shows a correct pill');
  // APP.srcLang (content context) must stay unconditional — the fix only touches the UI-language half.
  assert.ok(/if \(lSrc && lSrc !== APP\.srcLang\) \{\s*\n\s*APP\.srcLang = lSrc;/.test(fn),
    'APP.srcLang still always follows the opened topic, regardless of storyline membership or overrule');
}
console.log('  goLessonSet: THE BUG FIX — respects overrule for storyline chapters, unconditional for standalone topics: OK');

// Mutation check: the storyline-membership gate must actually be able to fail.
{
  const fn = body(html, 'goLessonSet');
  const mutated = fn.replace(
    'if (lSrc && lSrc !== APP.uiLang && !_slOverruled) {',
    'if (lSrc && lSrc !== APP.uiLang) {'
  );
  assert.notStrictEqual(mutated, fn, 'the mutation must actually remove the !_slOverruled guard');
  assert.ok(!/!_slOverruled\) \{\s*\n\s*APP\.uiLang = lSrc;/.test(mutated),
    'sanity: the mutated function no longer gates the auto-follow on overrule');
}
console.log('  mutation check: removing the storyline-membership gate is detectable: OK');

// ── 5c. Live functional repro of the fixed bug (the actual scenario the user reported) ─────────
{
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(uiJson.en)}; true;`, 'seed');
  C.run(`
    loadUIStrings = async function(code){ APP.uiLang = code; };  // stub: proves the CALL, not the fetch
    loadSavedList = async function(){};
    _migrateSolvedToItems = function(){};
    _invalidateQidUniverse = function(){};
    showLessonSet = async function(){};
    _enterViaSummaryCard = function(){ return false; };
    _isLearner = function(){ return false; };  // stop goLessonSet's learner auto-start branch
    updateDocDir = function(){};
    updateTranslationLangHint = function(){};
    APP.storylines = [{ id: 'sl1', chapters: ['c1'] }];
    APP.savedList = [{ id: 'c1', topic: 'chapter one', srcLang: 'de', lang: 'fr', lessons: [] }];
    APP.overruleStorylineLang = true;
    APP.srcLang = 'en'; APP.uiLang = 'en';
    true;
  `, 'setup');
  // The storyline chapter: overruled, so uiLang must NOT follow.
  C.run(`APP.lessonData = { id:'c1', topic:'chapter one', srcLang:'de', lang:'fr', lessons:[] }; true;`, 'sl-lesson');
  C.run('goLessonSet(); true;', 'open-sl-chapter');
  assert.strictEqual(C.run('APP.uiLang'), 'en',
    'THE ORIGINAL BUG: opening a storyline chapter with overrule ON must leave uiLang alone');
  assert.strictEqual(C.run('APP.srcLang'), 'de', 'content context still follows the chapter');
  assert.strictEqual(C.run('APP._slLangMismatch'), true, 'and the mismatch is flagged');
  // A standalone (non-storyline) topic: NOT overruled, keeps the old unconditional behaviour.
  C.run(`APP.uiLang = 'en'; APP.srcLang = 'en';
    APP.lessonData = { id:'standalone', topic:'lonely topic', srcLang:'it', lang:'fr', lessons:[] };
    true;`, 'standalone-lesson');
  C.run('goLessonSet(); true;', 'open-standalone');
  assert.strictEqual(C.run('APP.uiLang'), 'it',
    'a topic with no storyline still auto-follows uiLang — unaffected by the fix, still out of scope');
}
console.log('  live repro: the reported bug is fixed for storyline chapters, standalone topics unaffected: OK');

// ── 6. The warning pill: markup + wiring + the actual string ───────────────────────────────────
assert.ok(/id="sl-lang-mismatch-pill"/.test(html), '#sl-lang-mismatch-pill exists in the storyline screen');
assert.ok(/if \(APP\._slLangMismatch\) \{[\s\S]{0,300}?t\('storyline\.lang_mismatch'/.test(html),
  '_renderStorylineScreen shows the pill, text from storyline.lang_mismatch, when the flag is set');
assert.strictEqual(uiJson.en['storyline.lang_mismatch'],
  '⚠ This storyline is in {lang} — the UI language is fixed in Settings');
console.log('  the warning pill markup, wiring, and en string all exist: OK');

// ── 7. _restoreFormLang() restores the PERSISTED uiLang preference, not the form's srcLang ─────
{
  const fn = body(html, '_restoreFormLang');
  assert.ok(/APP\.uiLang = loadUiLang\(\);/.test(fn),
    'restores from the persisted preference (undoing any temporary auto-follow), not APP.formSrcLang');
  assert.ok(/const uiLangChanged = APP\.uiLang !== loadUiLang\(\);/.test(fn),
    'the reload-UI-strings decision is keyed on whether uiLang actually changed, not srcLang');
}
console.log('  _restoreFormLang() restores the persisted UI-language preference: OK');

// ── 8. Live functional check: the actual round-trip, in a real DOM ─────────────────────────────
{
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(uiJson.en)}; true;`, 'seed');
  // openSettings/selectUiLang/toggleOverruleStorylineLang all read/write real DOM elements this
  // harness auto-vivifies as stubs — no .options shimming needed here since none of these three
  // touch a <select>'s .options directly (that's applyUIStrings()'s job, not exercised here).
  C.run(`
    APP.srcLang = 'de'; APP.uiLang = 'en';
    document.getElementById('overrule-sl-lang-cb'); // touch it into existence as a stub first
    true;
  `, 'setup');
  C.run('toggleOverruleStorylineLang(); true;', 'toggle-on');
  assert.strictEqual(C.run('APP.overruleStorylineLang'), true, 'toggling flips the flag');
  assert.strictEqual(C.run("localStorage.getItem('imp3_overrule_sl')"), '1', 'and persists it');
  C.run('toggleOverruleStorylineLang(); true;', 'toggle-off');
  assert.strictEqual(C.run('APP.overruleStorylineLang'), false, 'toggling again flips it back');
  assert.strictEqual(C.run("localStorage.getItem('imp3_overrule_sl')"), '0', 'and persists that too');
}
console.log('  live round-trip: toggleOverruleStorylineLang() flips and persists the flag: OK');

// ── 9. build-static.js's own selectSrcLang override mirrors the same gating ────────────────────
{
  const at = builder.indexOf("'function selectSrcLang(code, fromForm){',");
  const end = builder.indexOf("\n  '}',", at);
  const src = builder.slice(at, end < 0 ? at + 3000 : end);
  assert.ok(/if\(fromForm\)\{ if\(document\.getElementById\("saved-list"\)\) loadSavedList\(\); return; \}/.test(src),
    'the static override also short-circuits fromForm=true before reaching loadUIStrings');
  assert.ok(/APP\.uiLang=code;/.test(src), 'and still sets APP.uiLang on the fromForm=false path');
  assert.ok(!/\["src-lang-select-footer-ls","src-lang-select-footer-sl"\]/.test(src),
    'THE REGRESSION: the static override must not still list the removed storyline footer id');
}
{
  assert.ok(/await loadUIStrings\(APP\.uiLang\);\s*\/\/ boot in the persisted UI language/.test(builder),
    'the static build\'s own init boots from APP.uiLang, not APP.srcLang');
}
console.log('  build-static.js\'s own overrides stay paired with the live changes: OK');

console.log('unit-ui-lang-decouple: ALL PASSED');
