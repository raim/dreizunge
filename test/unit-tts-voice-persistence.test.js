// unit-tts-voice-persistence.test.js — v79_l.
//
// The user reported the same English readout bug TWICE. v79_d fixed the RANKING (which voice wins
// when the requested locale is absent). This test is about the other half: that the user's own
// choice STICKS across lessons, which is what "on the next lesson it fell back to Nigerian English
// again" actually described.
//
// The voice list below is taken from a SCREENSHOT of the reporting device (Android, German UI,
// teacher-mode picker): en-GB, en-US, en-AU, en-IN, en-NG, with localized names and en-GB
// selected.
//
// CORRECTION, and it matters. The first version of this file used a fixture with NO en-GB
// installed, inherited from the v79_d comment's hypothesis and asserted in the header to be
// "precisely the device the report came from". The screenshot falsified that: en-GB IS installed
// there. The persistence fix is still needed and still guarded below, but on THIS inventory the
// ranker re-picks en-GB after a navigation reset anyway - so persistence alone cannot produce the
// reported Nigerian readout, and this file must not be read as evidence that it does. See
// unit-tts-voices-not-loaded for the cause that fits the screenshot.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// languages.json is the app's per-language default locale — the answer to "aren't there official
// defaults for each language". Pinned because the whole bug is about what happens when the default
// is NOT installed, so the default itself must be a known quantity.
assert.strictEqual(LANGS.en.tts, 'en-GB', 'languages.json maps en to en-GB');

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');

// ── the reported device: no en-GB, several network Englishes ────────────────
// Names are the device's own LOCALIZED strings. Kept verbatim because the persistence key is the
// voice NAME, so a localized name is what actually gets stored.
const ANDROID_REPORTED = [
  { name: 'Englisch Vereinigtes Koenigreich', lang: 'en-GB', localService: true,  default: false },
  { name: 'Englisch Vereinigte Staaten',      lang: 'en-US', localService: true,  default: false },
  { name: 'Englisch Australien',              lang: 'en-AU', localService: false, default: false },
  { name: 'Englisch Indien',                  lang: 'en-IN', localService: false, default: false },
  { name: 'Englisch Nigeria',                 lang: 'en-NG', localService: false, default: false },
  { name: 'Deutsch',                          lang: 'de-DE', localService: true,  default: false },
];
function installVoices(list, navLangs) {
  C.run(`
    globalThis.__voices = ${JSON.stringify(list)};
    globalThis.speechSynthesis = {
      getVoices: () => globalThis.__voices,
      addEventListener: () => {}, removeEventListener: () => {},
      cancel: () => {}, speak: () => {}, speaking: false, pending: false
    };
    window.speechSynthesis = globalThis.speechSynthesis;
    globalThis.navigator = Object.assign({}, globalThis.navigator || {},
      { languages: ${JSON.stringify(navLangs || [])} });
    globalThis.localStorage = (function(){
      let m = {};
      return { getItem: k => (k in m ? m[k] : null), setItem: (k,v) => { m[k] = String(v); },
               removeItem: k => { delete m[k]; }, clear: () => { m = {}; } };
    })();
    window.localStorage = globalThis.localStorage;
    APP.lang = 'en'; APP.lessonData = null; APP.ttsLang = null; APP._ttsVoiceName = null;
    APP.muted = false;
    true;`, 'install');
}
const pick = (code) => C.run(`(function(){ const v = _ttsPickVoice(${JSON.stringify(code)}); return v ? v.name + '|' + v.lang : String(v); })()`, 'pick');

// ── 1. what the ranker does unaided on the REPORTED inventory ───────────────
// It picks en-GB, the exact requested locale. Recorded because it is the evidence that v79_d's
// ranking fix works on this device and that the readout bug is NOT a ranking bug.
// With no choice made, the ranker picks something. Whatever it picks, the point of the test is
// what happens AFTER the user chooses — so this only records the starting state.
installVoices(ANDROID_REPORTED, []);
const unchosen = pick('en-GB');
console.log('  ranker pick with no user choice -> ' + unchosen);
assert.ok(!unchosen.startsWith('undefined') && unchosen !== 'null',
  'a voice is still chosen when the requested locale is absent');

// ── 2. a chosen voice survives the navigation that used to drop it ─────────
// `goLanding` / `goLandingClean` / the chapter-exit paths all set APP._ttsVoiceName = null. Before
// v79_l that reset threw the choice away, because the persisted copy was only read by the
// lesson-set selector. Here the reset is applied directly — the same state those paths produce.
{
  // The chosen voice must NOT be the one the ranker would pick anyway, or this assertion passes
  // whether or not the persistence works. `unchosen` above is the ranker's pick; assert the
  // fixture differs from it, then choose the other one. (Found the hard way: the first version of
  // this test chose the ranker's own default and stayed green with the fix reverted.)
  const CHOICE = 'Englisch Nigeria';
  assert.notStrictEqual(unchosen.split('|')[0], CHOICE,
    'the fixture must choose a voice the ranker would NOT pick, or the test proves nothing');

  C.run(`onTtsVoiceSelectGlobal(${JSON.stringify(CHOICE)}, 'main'); true;`, 'choose');
  assert.strictEqual(pick('en-GB'), CHOICE + '|en-NG', 'the voice just chosen must be the one used');

  C.run(`APP._ttsVoiceName = null; true;`, 'navigate');   // what goLanding does
  assert.strictEqual(pick('en-GB'), CHOICE + '|en-NG',
    'THE REGRESSION: after navigating, the chosen voice must still be used — this is the ' +
    '"next lesson fell back to Nigerian English" report');
  console.log('  chosen voice survives APP._ttsVoiceName being reset: OK (' + CHOICE + ')');
}

// ── 3. a stale choice does not silence or mis-speak the app ────────────────
// If the user uninstalls that voice, the saved name no longer matches anything and the resolver
// must fall back to the ranker rather than returning null (which would mute the app) or a voice
// from another language.
{
  C.run(`globalThis.__voices = ${JSON.stringify(ANDROID_REPORTED.filter(v => v.lang !== 'en-NG'))}; true;`, 'uninstall');
  const after = pick('en-GB');
  assert.ok(after !== 'null' && !after.startsWith('undefined'),
    'an uninstalled saved voice must fall back to the ranker, not mute the app');
  assert.ok(/\|en-/.test(after), 'the fallback must still be an ENGLISH voice, got ' + after);
  console.log('  a saved voice that no longer exists falls back safely: OK (' + after + ')');
}

// ── 4. the choice is per-language, not global ──────────────────────────────
{
  C.run(`globalThis.__voices = ${JSON.stringify(ANDROID_REPORTED)};
         localStorage.clear(); APP._ttsVoiceName = null; true;`, 'reset');
  C.run(`onTtsVoiceSelectGlobal('Englisch Nigeria', 'main'); APP._ttsVoiceName = null; true;`, 'choose-en');
  assert.strictEqual(pick('de-DE'), 'Deutsch|de-DE',
    'an English choice must not leak into German');
  assert.strictEqual(pick('en-GB'), 'Englisch Nigeria|en-NG', 'the English choice still holds');
  console.log('  the saved choice is scoped per speech language: OK');
}

// ── 5. the main-page selector: present, labelled by LOCALE, only when there is a choice ──
{
  C.run(`globalThis.__voices = ${JSON.stringify(ANDROID_REPORTED)}; APP.lang = 'en';
         APP._ttsVoiceName = null; localStorage.clear(); true;`, 'reset2');
  const html = C.run(`(function(){ updateTtsVoiceNote();
    return document.getElementById('tts-voice-note').innerHTML; })()`, 'note');
  assert.ok(html.includes('id="tts-voice-select-main"'),
    'the main-page speech row must carry the variant selector');
  assert.ok(html.includes('onTtsVoiceSelectGlobal'), 'the selector must be wired to the shared handler');
  for (const loc of ['en-NG', 'en-AU', 'en-US', 'en-GB']) {
    assert.ok(html.includes(loc), `the option list must name the locale ${loc}`);
  }
  assert.ok(!html.includes('de-DE'), 'the selector must not offer voices of another language');
  // it sits next to the test button, which is the placement the user asked for
  assert.ok(html.indexOf('tts-voice-select-main') < html.indexOf('ttsTestVoice()'),
    'the selector belongs beside the speech test button');
  console.log('  main-page variant selector present and locale-labelled: OK');

  // one voice only → no dropdown
  C.run(`globalThis.__voices = [{ name:'Solo', lang:'en-GB', localService:true, default:true }]; true;`, 'one');
  const html1 = C.run(`(function(){ updateTtsVoiceNote();
    return document.getElementById('tts-voice-note').innerHTML; })()`, 'note1');
  assert.ok(!html1.includes('tts-voice-select-main'),
    'a language with a single installed voice must not grow a one-item dropdown');
  console.log('  no dropdown when there is nothing to choose: OK');
}

// ── What this does NOT establish (rule 34) ─────────────────────────────────
// • The voice list is a FAKE. It proves the resolver and the row given a voice inventory; it
//   cannot prove what a real Android reports, nor that the OS honours `u.voice` once set —
//   the step that has to happen on the device.
// • It says nothing about `#tts-footer-landing`, which is dead markup: present since v55, hidden,
//   and toggled by nothing. Left in place because onTtsVoiceSelectGlobal still syncs it by id.
console.log('unit-tts-voice-persistence: ALL PASSED');
