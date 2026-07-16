// unit-tts-no-approximation.test.js
// v55_x — speech must never approximate a missing voice.
// The bug: both speak paths ended `match = named || langVoices[0] || null; if (match) {…}`. With no
// matching voice, `match` was null so u.voice was never set — but u.lang already WAS, and the
// browser silently substituted its default (English) voice. A learner heard Swahili read in
// English, which is worse than silence. Now: ONE shared resolver, and a refusal + pill instead.
// (Sibling files: unit-tts-voice = voice QUALITY heuristics; unit-dialect-tts = dialect badge.)
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// Run the REAL resolver against stubbed voice sets (there is no browser here).
function harness(voices, voiceName) {
  const code = ext(client, '_ttsPickVoice') + '\n' + ext(client, '_ttsMakeUtterance');
  const APP = { _ttsVoiceName: voiceName || null };
  const LANGS = { sw: { tts: 'sw-KE', name: 'Swahili' }, de: { tts: 'de-DE', name: 'German' } };
  const speechSynthesis = { getVoices: () => voices };
  const f = new Function('APP', 'LANGS', 'speechSynthesis', 'window', 'renderTtsPill', 'SpeechSynthesisUtterance',
    code + '\nreturn { pick: _ttsPickVoice, mk: _ttsMakeUtterance };');
  return f(APP, LANGS, speechSynthesis, { speechSynthesis }, () => {}, function (t) { this.text = t; });
}
const EN = { name: 'Daniel', lang: 'en-GB', localService: true };
const DE = { name: 'Anna', lang: 'de-DE', localService: true };

// ── 1. The reported bug: a wrong-language voice must NOT be used ──────────────
{
  const h = harness([EN]);
  assert.strictEqual(h.pick('sw-KE'), null, 'English-only system, Swahili wanted → null (definitively none)');
  assert.strictEqual(h.mk('habari', 'sw-KE', 0.9), null,
    'Swahili with only an English voice → REFUSE to speak (this is the whole point)');
}

// ── 2. A matching voice is used ───────────────────────────────────────────────
{
  const u = harness([EN, DE]).mk('hallo', 'de-DE', 0.9);
  assert.ok(u && u.voice, 'German with a German voice → speaks');
  assert.strictEqual(u.voice.name, 'Anna', 'picks the matching voice');
  assert.strictEqual(u.lang, 'de-DE', 'utterance lang follows the chosen voice');
}

// ── 3. THE STARTUP TRAP: voices not loaded → stay conservative ────────────────
// getVoices() is async and empty at first; declaring "no voice" then would mute the app on startup.
{
  const h = harness([]);
  assert.strictEqual(h.pick('sw-KE'), undefined, 'voices not loaded → undefined (unknown, NOT null)');
  assert.ok(h.mk('x', 'sw-KE', 0.9), 'unknown state → still speaks (never self-mute during the load window)');
}

// ── 4. Right language beats quality ───────────────────────────────────────────
{
  const u = harness([EN, { name: 'eSpeak swahili', lang: 'sw', localService: true }]).mk('habari', 'sw-KE', 0.9);
  assert.ok(u && u.voice && /swahili/i.test(u.voice.name), 'a poor voice in the CORRECT language is used, not refused');
}

// ── 5. Quality ordering still applies AMONG matching voices ───────────────────
{
  const online = { name: 'Google Deutsch', lang: 'de-DE', localService: false };
  const espeak = { name: 'espeak de', lang: 'de-DE', localService: true };
  assert.strictEqual(harness([espeak, online]).pick('de-DE').name, 'Google Deutsch', 'online/neural preferred over espeak');
  assert.strictEqual(harness([espeak, online], 'espeak de').pick('de-DE').name, 'espeak de', 'a user-named voice is honoured');
  assert.strictEqual(harness([EN, DE], 'Daniel').pick('de-DE').name, 'Anna', 'a named voice in the WRONG language is ignored');
}

// ── 6. ONE resolver — the duplication that caused the drift must not return ───
// _speakChunks and _speakChunksThen each had their own copy; one toasted "using approximation",
// the other approximated silently. v55_y: there was a THIRD copy (_speakAndAdvance, the listening
// path) that my v55_x grep MISSED because it used different variable names (named||exact||prefix) —
// the user hit it immediately ("Mtu" spelled out by an English voice). So the guard below is
// STRUCTURAL rather than a list of functions I happened to think of: nothing outside the resolver
// may build an utterance or pick a voice. That catches a 4th copy automatically.
{
  // Exactly two utterance constructions in the whole client: the shared builder, and the silent
  // '' utterance used to unlock TTS on iOS. Any other is a new duplicate — fail.
  const builders = [...client.matchAll(/new SpeechSynthesisUtterance\(([^)]*)\)/g)].map(m => m[1].trim());
  assert.strictEqual(builders.length, 2, `only the shared builder + the silent unlock may construct utterances (found: ${JSON.stringify(builders)})`);
  assert.ok(builders.includes("''") || builders.includes('""'), 'one of them is the silent unlock utterance');
  // Nobody outside the resolver inspects the voice list to choose a voice.
  const pickBody = ext(client, '_ttsPickVoice');
  const others = [...client.matchAll(/function (_?[A-Za-z0-9_]+)\s*\([^)]*\)\s*\{/g)].map(m => m[1])
    .filter(n => n !== '_ttsPickVoice' && n !== 'ttsVoiceAvailableFor' && n !== 'ttsHasNiceVoice'
              && n !== '_buildGlobalTtsSelectors' && n !== 'ttsTestVoice');
  for (const fn of ['_speakChunks', '_speakChunksThen', '_speakAndAdvance']) {
    const body = ext(client, fn);
    assert.ok(/_ttsMakeUtterance\(/.test(body), `${fn} uses the shared utterance builder`);
    assert.ok(/_ttsNoVoice\(/.test(body), `${fn} refuses via the shared no-voice handler`);
    assert.ok(!/getVoices\(\)/.test(body), `${fn} no longer resolves voices itself`);
    assert.ok(!/new SpeechSynthesisUtterance/.test(body), `${fn} does not build utterances itself`);
  }
  assert.strictEqual((client.match(/function _ttsPickVoice\(/g) || []).length, 1, 'exactly one voice resolver');
  // The listening path must still ADVANCE when it refuses, or the exercise hangs on a silent item.
  const adv = ext(client, '_speakAndAdvance');
  assert.ok(/if \(!u\) \{[\s\S]{0,400}doAdvance/.test(adv), '_speakAndAdvance still advances when it refuses to speak');
}

// ── 7. Mute stays the user's CHOICE — the no-voice state must not flip it ─────
{
  const noVoice = ext(client, '_ttsNoVoice');
  assert.ok(!/APP\.muted\s*=/.test(noVoice), "_ttsNoVoice must NOT set APP.muted (capability != user choice)");
  assert.ok(/APP\._ttsNoVoiceFor = ttsCode/.test(noVoice), 'it records WHICH language has no voice');
  assert.ok(/renderTtsPill\(\)/.test(noVoice), 'it updates the speech pill');
}

// ── 8. The pill: 3 labels, one renderer, clears again ────────────────────────
{
  assert.strictEqual((client.match(/lang-footer-lbl tts-pill/g) || []).length, 3, 'all 3 speech labels are pills');
  assert.ok(/\.tts-pill\.novoice\{/.test(client), 'the no-voice pill has its own style');
  const render = ext(client, 'renderTtsPill');
  assert.ok(/querySelectorAll\('\.tts-pill'\)/.test(render), 'renders by class, so every footer stays in step');
  assert.ok(/classList\.remove\('novoice'\)/.test(render), 'the pill clears when a voice IS available');
  assert.ok(/APP\._ttsNoVoiceFor = null/.test(ext(client, '_ttsMakeUtterance')), 'a successful resolve clears the state');
  assert.ok(/refreshTtsVoiceState\(\)/.test(ext(client, 'onTtsLangSelectGlobal')),
    'changing speech language re-evaluates the pill (warn BEFORE play)');
  assert.ok(/if \(v === undefined\) return;/.test(ext(client, 'refreshTtsVoiceState')),
    'the proactive check respects the loading window too');
}

// ── 9. ui keys + the retired string ──────────────────────────────────────────
{
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['tts.no_voice_silent', 'tts.pill_no_voice', 'tts.no_voice_hint']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
  assert.ok(!/toast\.no_voice/.test(client), "the retired 'using approximation' toast is no longer referenced");
}

console.log('  tts: one resolver, refuses wrong-language voices, conservative while loading, pill state: OK');
console.log('unit-tts-no-approximation: ALL PASSED');
