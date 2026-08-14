// unit-speech-locale.test.js — v79_n.
//
// A default speech LOCALE per storyline, overridable per chapter (the pass-mark override shape,
// which is what the user asked for). Guarded at the layer the claim is observable: the resolver
// `_speechLocaleFor` and the two speak paths that consume it, plus the server projection that
// carries the field to the client — the piece whose absence would make the whole feature save
// correctly and do nothing.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');

const CH_A = { id: 'tp_a', topic: 'Chapter A', lang: 'en', srcLang: 'de', lessons: [] };
const CH_B = { id: 'tp_b', topic: 'Chapter B', lang: 'en', srcLang: 'de', lessons: [] };
const CH_DE = { id: 'tp_de', topic: 'Kapitel', lang: 'de', srcLang: 'en', lessons: [] };

function seed(chapters, storylines, open) {
  C.run(`
    APP.savedList = ${JSON.stringify(chapters)};
    APP.storylines = ${JSON.stringify(storylines)};
    APP.lessonData = ${JSON.stringify(open || null)};
    APP.ttsLang = null; APP.lang = 'en';
    true;`, 'seed');
}
const resolve = (lang, id) => C.run(
  `String(_speechLocaleFor(${JSON.stringify(lang)}, ${JSON.stringify(id || null)}))`, 'resolve');

// ── 1. nothing set → languages.json's default, i.e. today's behaviour ──────
// This is the migration story for every chapter authored before the field existed: there is none,
// because absence resolves to exactly what absence resolved to before.
{
  seed([CH_A], [{ id: 'sl_1', title: 'S', chapters: ['tp_a'] }]);
  assert.strictEqual(resolve('en', 'tp_a'), LANGS.en.tts, 'no setting anywhere -> languages.json');
  assert.strictEqual(resolve('de', 'tp_de'), LANGS.de.tts, 'and per language, not globally');
  console.log('  unset resolves to the languages.json default (no migration needed): OK');
}

// ── 2. storyline level applies to its chapters ────────────────────────────
{
  seed([CH_A, CH_B], [{ id: 'sl_1', title: 'S', chapters: ['tp_a','tp_b'], speechLocale: 'en-AU' }]);
  assert.strictEqual(resolve('en', 'tp_a'), 'en-AU', 'the storyline default applies');
  assert.strictEqual(resolve('en', 'tp_b'), 'en-AU', 'to every chapter of it');
  console.log('  storyline-level default applies to its chapters: OK');
}

// ── 3. chapter overrules storyline (the pass-mark semantics) ──────────────
{
  seed([{ ...CH_A, speechLocale: 'en-IN' }, CH_B],
       [{ id: 'sl_1', title: 'S', chapters: ['tp_a','tp_b'], speechLocale: 'en-AU' }]);
  assert.strictEqual(resolve('en', 'tp_a'), 'en-IN', 'the chapter setting wins');
  assert.strictEqual(resolve('en', 'tp_b'), 'en-AU', 'and does not leak to its siblings');
  console.log('  chapter overrules storyline, per chapter: OK');
}

// ── 4. a chapter in two forks: the first storyline carrying a setting wins ─
// Forks share a prefix, so a chapter can belong to several storylines. Whatever the rule is it must
// be STABLE — the same chapter must not resolve differently between two renders.
{
  seed([CH_A],
       [{ id: 'sl_1', title: 'One', chapters: ['tp_a'] },
        { id: 'sl_2', title: 'Two', chapters: ['tp_a'], speechLocale: 'en-AU' }]);
  const first = resolve('en', 'tp_a');
  assert.strictEqual(first, 'en-AU', 'a storyline WITH a setting is found even if listed second');
  assert.strictEqual(resolve('en', 'tp_a'), first, 'and the answer is stable across calls');
  console.log('  a shared chapter resolves stably across forks: OK');
}

// ── 5. the open lesson is used only for its OWN language ──────────────────
// A chapter's speech setting must not colour a readout of a different language on the same screen
// (the source-language column, a tutor line, a dialect note).
{
  seed([{ ...CH_A, speechLocale: 'en-IN' }, CH_DE],
       [{ id: 'sl_1', title: 'S', chapters: ['tp_a'] }],
       { ...CH_A, speechLocale: 'en-IN' });
  assert.strictEqual(resolve('en'), 'en-IN', 'the open chapter supplies its own language');
  assert.strictEqual(resolve('de'), LANGS.de.tts,
    'but must NOT supply a locale for a different language being spoken on the same screen');
  console.log('  the open chapter never colours another language: OK');
}

// ── 6. the speak paths actually consume it ────────────────────────────────
// Rule: a probe must call the product function. Asserting the resolver alone would leave "and the
// readout uses it" unmeasured — the exact gap the v74_i projection bug lived in.
{
  C.run(`
    globalThis.__spoken = [];
    globalThis.__voices = [
      { name: 'AU', lang: 'en-AU', localService: true,  default: false },
      { name: 'GB', lang: 'en-GB', localService: true,  default: true  }
    ];
    globalThis.speechSynthesis = {
      getVoices: () => globalThis.__voices, addEventListener: ()=>{}, removeEventListener: ()=>{},
      cancel: ()=>{}, speaking: false, pending: false,
      speak: u => globalThis.__spoken.push({ lang: u.lang, voice: u.voice ? u.voice.name : null })
    };
    window.speechSynthesis = globalThis.speechSynthesis;
    globalThis.SpeechSynthesisUtterance = function(t){ this.text=t; this.voice=null; };
    window.SpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;
    globalThis.localStorage = { getItem: ()=>null, setItem: ()=>{}, removeItem: ()=>{}, clear: ()=>{} };
    window.localStorage = globalThis.localStorage;
    _ttsUnlocked = true; APP.muted = false; APP._ttsVoiceName = null;
    true;`, 'engine');
  seed([{ ...CH_A, speechLocale: 'en-AU' }],
       [{ id: 'sl_1', title: 'S', chapters: ['tp_a'] }],
       { ...CH_A, speechLocale: 'en-AU' });
  C.run(`_speakChunks(['hello'], 'en', 0.9, 0); true;`, 'speak');
  const spoken = JSON.parse(C.run('JSON.stringify(globalThis.__spoken)', 'read'));
  assert.strictEqual(spoken.length, 1, 'it speaks');
  assert.strictEqual(spoken[0].voice, 'AU',
    'the readout must use the chapter locale (en-AU), not the engine default (en-GB is default:true)');
  console.log('  _speakChunks honours the chapter locale over the engine default: OK');
}

// ── 7. an uninstallable locale degrades to the language, not to silence ───
// The user's "if the set speech is not available in a given browser, it should fall back on an
// available speech for that language". No new code does this — _ttsRankVoices filters on the
// language prefix and only PREFERS the exact locale — but the claim is guarded, not assumed.
{
  seed([{ ...CH_A, speechLocale: 'en-ZZ' }],
       [{ id: 'sl_1', title: 'S', chapters: ['tp_a'] }],
       { ...CH_A, speechLocale: 'en-ZZ' });
  C.run(`globalThis.__spoken = []; _speakChunks(['hello'], 'en', 0.9, 0); true;`, 'speak2');
  const spoken = JSON.parse(C.run('JSON.stringify(globalThis.__spoken)', 'read2'));
  assert.strictEqual(spoken.length, 1, 'an absent locale must still speak, not go silent');
  assert.ok(['AU','GB'].includes(spoken[0].voice),
    'and must fall back to another voice of the SAME LANGUAGE, got ' + spoken[0].voice);
  console.log('  an uninstalled locale falls back within the language: OK');
}

// ── 8. the server carries the field to the client ─────────────────────────
// Source-level, because the saved-list payload is a WHITELIST projection: a field not named there
// is dropped, and the setting would save, persist, and silently do nothing in live mode. That is
// the v74_i failure, recorded in a comment two lines above the one this adds.
{
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(/speechLocale:\s*l\.speechLocale/.test(server),
    'the saved-list projection must carry speechLocale, or the chapter setting cannot be read live');
  assert.ok(/url\.pathname === '\/api\/speech-locale'/.test(server),
    'the endpoint that persists it must exist');
  for (const scope of ['storyline', 'topic'])
    assert.ok(server.includes(`if (clearing) delete ${scope === 'storyline' ? 'sl' : 't'}.speechLocale`),
      `clearing must remove the field at ${scope} scope, so "inherit" is a real state and not a value`);
  console.log('  server persists it and the projection carries it: OK');
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • The teacher-mode SELECTOR is not exercised here: `speechLocaleRowHtml` gates on `_canEdit()`
//   and builds its option list from the device's installed voices, so what a teacher sees is a
//   per-device fact. The stored value is what this file guards.
// • Storylines pass through `build-static.js` whole (`cleanedStorylines = rawStorylines`), so the
//   storyline-level field reaches static mode; the CHAPTER-level field in static mode rides the
//   baked topics and is not separately asserted here.
console.log('unit-speech-locale: ALL PASSED');
