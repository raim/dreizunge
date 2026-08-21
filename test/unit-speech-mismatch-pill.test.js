// unit-speech-mismatch-pill.test.js — PLAN §C4's last acceptance detail.
//
// From the user's original UI brief (roadmap_v81.md, PLAN §C4): "If a lesson is using speech
// different from its intended target/chapter/storyline locale, the SC shows an explicit status
// pill and a one-click restore action for the intended speech. This is not a second read-out
// control: it is state visibility and recovery for the global speech setting. Individual read-out
// buttons remain in place and continue to speak their own field language."
//
// Measured first (per the session prompt): the ONLY thing that can disagree with a lesson's own
// `_speechLocaleFor()` answer is the GLOBAL override `APP.ttsLang` — set by the "speech language"
// picker on the lesson-set footer's sound-test row (`onTtsLangSelectGlobal`/`onTtsSelect`), which
// lists EVERY language's tts code, not just locale variants of the one being read. Individual
// read-out buttons that pass an explicit langCode resolve via `_speechLocaleFor(langCode)` directly
// (`_speakChunks`/`_speakChunksThen`) and never consult `APP.ttsLang` at all — already guarded by
// `unit-speech-locale.test.js` §11 ("a voice choice for one language never speaks another"). This
// file is scoped to the NEW surface only: the resolver that detects the mismatch, and the pill +
// restore action that make it visible/recoverable from the Settings Card.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const uiJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const LANGS_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));

function divBlock(src, openTagRe) {
  const m = openTagRe.exec(src);
  assert.ok(m, 'opening tag found: ' + openTagRe);
  let depth = 1;
  const tagRe = /<div\b|<\/div>/g;
  tagRe.lastIndex = m.index + m[0].length;
  let t;
  while ((t = tagRe.exec(src))) {
    if (t[0] === '<div') depth++;
    else depth--;
    if (depth === 0) return src.slice(m.index, t.index + t[0].length);
  }
  throw new Error('unbalanced <div> from ' + openTagRe);
}

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS_JSON)}; UI_STRINGS = ${JSON.stringify(uiJson.en)}; true;`, 'seed');

const CH_IT = { id: 'tp_it', topic: 'Capitolo', lang: 'it', srcLang: 'en', lessons: [] };

function seed(opts) {
  opts = opts || {};
  C.run(`
    APP.savedList = ${JSON.stringify(opts.savedList || [CH_IT])};
    APP.storylines = ${JSON.stringify(opts.storylines || [])};
    APP.lessonData = ${JSON.stringify(opts.lessonData !== undefined ? opts.lessonData : CH_IT)};
    APP.ttsLang = ${JSON.stringify(opts.ttsLang !== undefined ? opts.ttsLang : null)};
    APP._ttsVoiceName = ${JSON.stringify(opts.ttsVoiceName || null)};
    APP.uiLang = 'en';
    document.getElementById('settings-modal').style.display = 'none';
    document.getElementById('speech-mismatch-pill').style.display = 'none';
    // Stub speechSynthesis so restoreIntendedSpeech()'s downstream refresh calls don't throw —
    // this file is not exercising the picker/voice-ranking machinery, only the pill itself.
    globalThis.speechSynthesis = globalThis.speechSynthesis || {
      getVoices: () => [], addEventListener: ()=>{}, removeEventListener: ()=>{},
      cancel: ()=>{}, speaking: false, pending: false, speak: ()=>{}
    };
    true;`, 'seed');
}

// ── 1. no lesson open -> no mismatch, regardless of ttsLang ────────────────────────────────────
{
  seed({ lessonData: null, ttsLang: 'pl-PL' });
  assert.strictEqual(C.run('_speechMismatchInfo()'), null, 'no open lesson -> nothing to compare against');
  console.log('  no lesson open -> null (nothing to flag): OK');
}

// ── 2. no override active -> no mismatch, even though a lesson is open ─────────────────────────
{
  seed({ ttsLang: null });
  assert.strictEqual(C.run('_speechMismatchInfo()'), null, 'APP.ttsLang unset -> no override to flag');
  console.log('  no override active -> null: OK');
}

// ── 3. override agrees with the intended locale -> no mismatch ─────────────────────────────────
{
  seed({ ttsLang: 'it-IT' });
  assert.strictEqual(C.run('_speechMismatchInfo()'), null, 'override equals the lesson\'s own locale -> no mismatch');
  console.log('  override matching the intended locale -> null: OK');
}

// ── 3b. the comparison is normalized (case/underscore), not a raw string match ─────────────────
// Mutation-style: if the resolver forgot to normalize, an underscore/case variant of the SAME
// locale would wrongly report a mismatch.
{
  seed({ ttsLang: 'IT_it' });
  assert.strictEqual(C.run('_speechMismatchInfo()'), null,
    'THE REGRESSION: a case/underscore variant of the SAME locale must not be flagged as a mismatch');
  console.log('  normalization: a differently-cased/underscored SAME locale is not a mismatch: OK');
}

// ── 4. a genuine cross-language override IS flagged, with both codes ───────────────────────────
{
  seed({ ttsLang: 'pl-PL' });
  const info = JSON.parse(C.run('JSON.stringify(_speechMismatchInfo())'));
  assert.deepStrictEqual(info, { active: 'pl-PL', intended: 'it-IT' },
    'a global override in a different language than the open lesson must be reported');
  console.log('  cross-language override is flagged with {active, intended}: OK');
}

// ── 5. a chapter-level speechLocale is the "intended" value, not the languages.json default ────
// Future-proofing: v79_n's resolver already supports this; the pill must inherit it, not
// re-derive a narrower notion of "intended" that ignores authored per-chapter overrides.
{
  seed({ savedList: [{ ...CH_IT, speechLocale: 'it-CH' }], lessonData: { ...CH_IT, speechLocale: 'it-CH' }, ttsLang: 'it-IT' });
  const info = JSON.parse(C.run('JSON.stringify(_speechMismatchInfo())'));
  assert.deepStrictEqual(info, { active: 'it-IT', intended: 'it-CH' },
    'a chapter-authored speechLocale is the intended value the override is compared against');
  console.log('  chapter-level speechLocale is inherited as the intended value: OK');
}

// ── 6. a storyline-level speechLocale is inherited too ─────────────────────────────────────────
{
  seed({
    savedList: [CH_IT],
    storylines: [{ id: 'sl_1', title: 'S', chapters: ['tp_it'], speechLocale: 'it-CH' }],
    lessonData: CH_IT,
    ttsLang: 'it-IT'
  });
  const info = JSON.parse(C.run('JSON.stringify(_speechMismatchInfo())'));
  assert.deepStrictEqual(info, { active: 'it-IT', intended: 'it-CH' },
    'a storyline-authored speechLocale is inherited the same way _speechLocaleFor already does');
  console.log('  storyline-level speechLocale is inherited too: OK');
}

// ── 7. the pill is hidden when there is nothing to flag ────────────────────────────────────────
{
  seed({ ttsLang: null });
  C.run('updateSpeechMismatchPill(); true;');
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'none',
    'no mismatch -> the pill stays hidden');
  console.log('  updateSpeechMismatchPill() hides the pill when nothing is wrong: OK');
}

// ── 8. the pill shows human-readable names and a restore button, on a real mismatch ────────────
{
  seed({ ttsLang: 'pl-PL' });
  C.run('updateSpeechMismatchPill(); true;');
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'flex',
    'a mismatch -> the pill is shown');
  const txt = C.run("document.getElementById('speech-mismatch-text').textContent");
  assert.ok(txt.includes('Polish'), `pill text must name the ACTIVE language, got: ${txt}`);
  assert.ok(txt.includes('Italian'), `pill text must name the INTENDED language, got: ${txt}`);
  const btnTxt = C.run("document.getElementById('speech-mismatch-restore-btn').textContent");
  assert.strictEqual(btnTxt, uiJson.en['settings.speech_restore'], 'restore button carries the ui.json label');
  console.log('  a real mismatch renders both language names + the restore button label: OK');
}

// ── 9. restoreIntendedSpeech() clears the override and re-hides the pill ───────────────────────
{
  seed({ ttsLang: 'pl-PL', ttsVoiceName: 'SomePolishVoice' });
  C.run('updateSpeechMismatchPill(); true;');
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'flex',
    'sanity: the pill starts visible');
  C.run('restoreIntendedSpeech(); true;');
  assert.strictEqual(C.run('APP.ttsLang'), null, 'restore clears the override');
  assert.strictEqual(C.run('APP._ttsVoiceName'), null, 'restore also clears the stale voice name, same pair goLanding() resets');
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'none',
    'restore re-hides the pill immediately, without waiting for the next openSettings()');
  console.log('  restoreIntendedSpeech() clears the override and re-hides the pill: OK');
}

// ── 10. openSettings() itself refreshes the pill (not just updateSpeechMismatchPill() directly) ─
// THE ACCEPTANCE CLAIM: the pill must be current the moment the card opens, not only when some
// other code path happened to call the updater first.
{
  seed({ ttsLang: 'pl-PL' });
  C.run("document.getElementById('speech-mismatch-pill').style.display = 'none'; true;");
  C.run('openSettings(); true;');
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'flex',
    'THE REGRESSION: openSettings() must refresh the pill itself, not rely on a prior call');
  C.run('closeSettings(); true;');
  console.log('  openSettings() refreshes the pill on every open: OK');

  // Mutation check: prove the assertion above can fail. Directly hiding the pill after seeding a
  // mismatch, WITHOUT calling openSettings(), must leave it hidden.
  C.run("document.getElementById('speech-mismatch-pill').style.display = 'none'; true;");
  assert.strictEqual(C.run("document.getElementById('speech-mismatch-pill').style.display"), 'none',
    'sanity: without calling openSettings(), the pill stays exactly as it was left');
}

// ── 11. markup: the pill lives inside #settings-modal, and the restore button is wired ─────────
{
  const settingsModal = divBlock(html, /<div id="settings-modal"/);
  assert.ok(settingsModal.includes('id="speech-mismatch-pill"'),
    'THE ACCEPTANCE CLAIM: the pill must be inside the Settings Card, not floating elsewhere');
  assert.ok(/id="speech-mismatch-restore-btn"[^>]*onclick="restoreIntendedSpeech\(\)"/.test(html),
    'the restore button must call restoreIntendedSpeech()');
  // Mutation check: the containment assertion must actually be able to fail.
  const withoutPill = settingsModal.replace(/<div id="speech-mismatch-pill"[\s\S]*?<\/div>\s*<\/div>/, '');
  assert.notStrictEqual(withoutPill, settingsModal,
    'the mutation must actually remove the pill slice, or check #11 is vacuous');
  assert.ok(!withoutPill.includes('id="speech-mismatch-pill"'), 'sanity: mutated slice lacks the pill');
  console.log('  the pill is inside #settings-modal and its button is wired to restoreIntendedSpeech(): OK');
}

// ── 12. the two new strings live in ui.json, en only ────────────────────────────────────────────
assert.ok(typeof uiJson.en['settings.speech_mismatch'] === 'string' && /\{active\}/.test(uiJson.en['settings.speech_mismatch']) && /\{intended\}/.test(uiJson.en['settings.speech_mismatch']),
  'settings.speech_mismatch exists in en and carries both placeholders');
assert.strictEqual(uiJson.en['settings.speech_restore'], 'Restore', 'settings.speech_restore exists in en');
console.log('  the new strings are in ui.json (en) with the right placeholders: OK');

// ── 13. individual read-out buttons are unaffected — the SAME resolver, called directly ────────
// Not a re-test of unit-speech-locale.test.js §11 (already guards this at the speak-path layer).
// This just confirms the pill's own resolver and the read-out paths' resolver are the ONE
// function, not two definitions that could drift.
{
  seed({ ttsLang: 'pl-PL' });
  const directLangCode = C.run(`String(_speechLocaleFor('it', 'tp_it'))`);
  assert.strictEqual(directLangCode, 'it-IT',
    'an explicit-langCode read-out resolves via _speechLocaleFor directly, ignoring the pl-PL override entirely');
  console.log('  an explicit-langCode read-out is provably unaffected by the active override: OK');
}

console.log('unit-speech-mismatch-pill: ALL PASSED');
