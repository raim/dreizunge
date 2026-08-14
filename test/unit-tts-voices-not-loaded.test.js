// unit-tts-voices-not-loaded.test.js — v79_m.
//
// THE CAUSE THE SCREENSHOT POINTED AT. The reporting device HAS en-GB installed (it is listed and
// selected in the teacher-mode picker), and the picker's order — en-GB, en-US, en-AU, en-IN,
// en-NG — is `_ttsRankVoices` putting the exact locale first. So neither the ranking (v79_d) nor
// the persistence (v79_l) can explain "the next lesson fell back to Nigerian English": with en-GB
// present, a re-rank after a navigation reset lands on en-GB anyway.
//
// What remains is TIMING. `speechSynthesis.getVoices()` is empty for a window after a screen
// change on Android. In that window `_ttsPickVoice` returns `undefined` — correctly, it cannot yet
// tell — and `_ttsMakeUtterance` returns an utterance with `u.lang` set but NO `u.voice`, leaving
// the choice to the OS. On a device whose own default English is Nigerian, that IS the report, and
// it explains the report's shape: the sound test works (voices loaded long before you press it),
// the lesson does not (it speaks on render).
//
// This test asserts the speak paths WAIT instead of handing a voiceless utterance to the engine.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');

// A synthesiser that starts with NO voices and reports them only when told to — the Android
// startup window, made explicit.
function installLateVoices() {
  C.run(`
    globalThis.__spoken = [];
    globalThis.__voices = [];
    globalThis.__handlers = [];
    globalThis.speechSynthesis = {
      getVoices: () => globalThis.__voices,
      addEventListener: (ev, fn) => { if (ev === 'voiceschanged') globalThis.__handlers.push(fn); },
      removeEventListener: () => {},
      cancel: () => {}, speaking: false, pending: false,
      speak: (u) => { globalThis.__spoken.push({ text: u.text, lang: u.lang,
                                                 voice: u.voice ? u.voice.name : null }); }
    };
    window.speechSynthesis = globalThis.speechSynthesis;
    globalThis.SpeechSynthesisUtterance = function(t){ this.text = t; this.voice = null; };
    window.SpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;
    globalThis.localStorage = (function(){ let m={}; return {
      getItem: k => (k in m ? m[k] : null), setItem: (k,v)=>{m[k]=String(v);},
      removeItem: k=>{delete m[k];}, clear: ()=>{m={};} }; })();
    window.localStorage = globalThis.localStorage;
    APP.lang = 'en'; APP.lessonData = null; APP.ttsLang = null; APP._ttsVoiceName = null;
    APP.muted = false; _ttsUnlocked = true;
    true;`, 'install');
}
const spoken = () => JSON.parse(C.run('JSON.stringify(globalThis.__spoken)', 'spoken'));
const REPORTED = [
  { name: 'Englisch Vereinigtes Koenigreich', lang: 'en-GB', localService: true,  default: false },
  { name: 'Englisch Nigeria',                 lang: 'en-NG', localService: false, default: true  },
];

// ── 1. nothing is spoken while the voice list is empty ─────────────────────
{
  installLateVoices();
  C.run(`_speakChunks(['Hello there'], 'en', 0.9, 0); true;`, 'speak-early');
  assert.deepStrictEqual(spoken(), [],
    'THE BUG: with getVoices() still empty, nothing may be handed to the engine — a voiceless ' +
    'utterance lets the OS pick, and on the reported device the OS default English is Nigerian');
  console.log('  nothing spoken while the voice list is empty: OK');
}

// ── 2. once voices arrive, it speaks — with a voice actually set ───────────
{
  C.run(`globalThis.__voices = ${JSON.stringify(REPORTED)};
         globalThis.__handlers.splice(0).forEach(fn => fn()); true;`, 'voices-arrive');
  const s = spoken();
  assert.strictEqual(s.length, 1, 'the deferred utterance must be spoken once voices arrive');
  assert.ok(s[0].voice, 'the utterance must carry an explicit voice, not leave it to the OS');
  assert.strictEqual(s[0].voice, 'Englisch Vereinigtes Koenigreich',
    'and it must be the exact requested locale, not the OS default (en-NG is `default: true` here)');
  console.log('  speaks after voiceschanged, with en-GB explicitly set: OK');
}

// ── 3. the same guard on the callback path a question readout uses ─────────
{
  installLateVoices();
  C.run(`_speakChunksThen(['Frage'], 'en', 0.9, 0, function(){ globalThis.__cb = true; }); true;`, 'then-early');
  assert.deepStrictEqual(spoken(), [], '_speakChunksThen must defer too');
  C.run(`globalThis.__voices = ${JSON.stringify(REPORTED)};
         globalThis.__handlers.splice(0).forEach(fn => fn()); true;`, 'arrive2');
  const s = spoken();
  assert.strictEqual(s.length, 1, 'the deferred question readout must still happen');
  assert.strictEqual(s[0].voice, 'Englisch Vereinigtes Koenigreich', 'and with the right voice');
  console.log('  _speakChunksThen defers and then speaks correctly: OK');
}

// ── 4. voices already loaded → no deferral, speaks immediately ─────────────
// The wait must not cost a delay on the common path.
{
  installLateVoices();
  C.run(`globalThis.__voices = ${JSON.stringify(REPORTED)};
         _speakChunks(['Sofort'], 'en', 0.9, 0); true;`, 'ready');
  const s = spoken();
  assert.strictEqual(s.length, 1, 'with voices already present it must speak synchronously');
  assert.strictEqual(s[0].voice, 'Englisch Vereinigtes Koenigreich');
  console.log('  no deferral when voices are already loaded: OK');
}

// ── What this does NOT establish (rule 34) ─────────────────────────────────
// • The engine is a FAKE. It proves the app no longer hands over a voiceless utterance and that it
//   resumes on `voiceschanged`; it cannot prove the Android engine honours `u.voice` once set, nor
//   that `voiceschanged` fires there at all — hence the bounded 1200ms fallback in
//   `_ttsWhenVoicesReady`, after which the app speaks anyway rather than going mute.
// • It does not measure the real length of the empty-getVoices window on any device.
console.log('unit-tts-voices-not-loaded: ALL PASSED');
