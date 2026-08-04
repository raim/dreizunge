// unit-tts-voice-ranking.test.js
// v74_j — locale accuracy outranks voice quality when picking a TTS voice.
//
// From a user report: "on my phone but not my laptop I suddenly have an English readout with some
// accent, perhaps Caribbean". It was ours. The filter accepted an exact locale match OR any voice
// sharing the language prefix, and the sort then ranked purely on QUALITY — so every English locale
// landed in one pool and whichever happened to be a NETWORK voice (score 3) beat the local `en-GB`
// (score 1). Desktops expose two or three English voices, all local, so the right one happened to
// sort first; Android ships many locales, several as network voices. Nothing changed but the
// device's voice inventory, which is why it looked like a phone setting.
//
// Voice lists are SIMULATED. There is no speechSynthesis in the harness, and the real inventory is
// a property of the device — so what is testable is the ranking policy, and that is what this file
// pins. Rendering on a phone is not testable here and never will be.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

const C = loadClient({ quiet: true });
const pick = (voices, code, named) => {
  C.run(`globalThis.speechSynthesis = { getVoices: function(){ return ${JSON.stringify(voices)}; } };
         APP._ttsVoiceName = ${named ? JSON.stringify(named) : 'null'}; true;`, 'seed');
  return C.run(`(function(){ var v = _ttsPickVoice(${JSON.stringify(code)});
     return v === null ? null : v === undefined ? undefined : (v.name + '|' + v.lang); })()`, 'pick');
};
const rank = (voices, code) =>
  JSON.parse(C.run(`JSON.stringify(_ttsRankVoices(${JSON.stringify(voices)}, ${JSON.stringify(code)}).map(function(v){ return v.lang; }))`, 'rank'));

// A realistic Android/Chrome English inventory: many locales, several of them NETWORK voices.
const ANDROID = [
  { name: 'English United Kingdom', lang: 'en-GB', localService: true  },
  { name: 'English United States',  lang: 'en-US', localService: true  },
  { name: 'English India',          lang: 'en-IN', localService: true  },
  { name: 'English Nigeria',        lang: 'en-NG', localService: false },
  { name: 'English Trinidad',       lang: 'en-TT', localService: false },
  { name: 'English Jamaica',        lang: 'en-JM', localService: false },
];

// ── 1. The reported bug: a regional voice must not win on quality alone ─────────────────────
{
  // Non-vacuity: the inventory MUST contain a network voice in a different region, or the old
  // ranking would have passed this too and the section proves nothing.
  assert.ok(ANDROID.some(v => !v.localService && v.lang !== 'en-GB'),
    'the simulated device offers a higher-QUALITY voice in the wrong region — the exact trap');
  assert.strictEqual(pick(ANDROID, 'en-GB'), 'English United Kingdom|en-GB',
    'en-GB is read by the en-GB voice, not by whichever English voice happens to be neural');
  // languages.json maps en -> "en-GB", so this is the shipped path for every English readout.
  assert.strictEqual(rank(ANDROID, 'en-GB')[0], 'en-GB', 'and it ranks first');
}

// ── 2. Not English-only, and elsewhere it is not cosmetic ───────────────────────────────────
// A learner studying European Portuguese being read Brazilian Portuguese is a content error, not
// an accent. Same mechanism, worse consequence.
{
  const PT = [ { name: 'Português Portugal', lang: 'pt-PT', localService: true },
               { name: 'Português Brasil',   lang: 'pt-BR', localService: false } ];
  assert.strictEqual(pick(PT, 'pt-PT'), 'Português Portugal|pt-PT', 'pt-PT is not read in pt-BR');
  const DE = [ { name: 'Deutsch Deutschland', lang: 'de-DE', localService: true },
               { name: 'Deutsch Schweiz',     lang: 'de-CH', localService: false } ];
  assert.strictEqual(pick(DE, 'de-DE'), 'Deutsch Deutschland|de-DE', 'de-DE is not read in de-CH');
}

// ── 3. Quality still decides among voices of the RIGHT locale ───────────────────────────────
// The change must not throw away the neural preference where it costs nothing.
{
  const V = [ { name: 'Daniel',    lang: 'en-GB', localService: true  },
              { name: 'UK Neural', lang: 'en-GB', localService: false } ];
  assert.strictEqual(pick(V, 'en-GB'), 'UK Neural|en-GB',
    'among exact-locale voices the better one still wins');
}

// ── 4. espeak stays below any real voice, even on an exact locale match ─────────────────────
// espeak/mbrola score 0 as a "this is bad" signal, not merely "lower quality": the v39 notes record
// that every espeak variant runs one engine and they all sound identical and robotic. A robotic
// exact match is worse for a learner than a good near-match.
{
  const V = [ { name: 'espeak-ng en-gb',    lang: 'en-GB', localService: true  },
              { name: 'English US Neural',  lang: 'en-US', localService: false } ];
  assert.strictEqual(pick(V, 'en-GB'), 'English US Neural|en-US',
    'a neural en-US beats an espeak en-GB — usability outranks locale, locale outranks quality');
}

// ── 5. Fallback and refusal are unchanged (v55_x) ────────────────────────────────────────────
{
  // No voice for the REGION → still speak, using another region. A regional accent is not the
  // failure v55_x refuses; being read the wrong LANGUAGE is.
  const NOREGION = [ { name: 'English India',   lang: 'en-IN', localService: true  },
                     { name: 'English Nigeria', lang: 'en-NG', localService: false } ];
  assert.ok(pick(NOREGION, 'en-GB'), 'with no en-GB voice the app still speaks, in another region');
  // No voice for the LANGUAGE → refuse. An English voice reading Swahili is worse than silence.
  assert.strictEqual(pick([{ name: 'English UK', lang: 'en-GB', localService: true }], 'sw-KE'), null,
    'no voice for the language at all → refuse, do not approximate (v55_x)');
  // Voices not loaded yet → undefined, so the caller stays conservative and does NOT auto-mute.
  assert.strictEqual(pick([], 'en-GB'), undefined,
    'an empty list means "not loaded yet", never "no voice" — the app must not mute itself at startup');
}

// ── 6. A learner's explicit choice still overrides everything ───────────────────────────────
{
  assert.strictEqual(pick(ANDROID, 'en-GB', 'English Jamaica'), 'English Jamaica|en-JM',
    'a voice picked by name in the selector is honoured over the ranking');
}

// ── 7. ONE ranker — the selector menu preselects what the speak paths would choose ──────────
// This logic was duplicated in _ttsPickVoice and _buildGlobalTtsSelectors and had already drifted:
// the builder's copy scored `localService?1:3` with no neural tier and, like the other, never
// preferred the exact locale — so the menu could open on "English Jamaica" for an en-GB learner.
{
  const html = require('fs').readFileSync(require('path').join(require('./lib-dom').ROOT, 'index.html'), 'utf8');
  assert.strictEqual((html.match(/function _ttsRankVoices\(/g) || []).length, 1,
    'there is exactly one ranker');
  assert.ok(/const lv = _ttsRankVoices\(voices, savedLang\);/.test(html),
    'the selector menu ranks through it too, so it preselects what would actually be spoken');
  assert.ok(/const langVoices = _ttsRankVoices\(voices, ttsCode\);/.test(html),
    'and so does the speak path');
}

console.log('  ranking: exact locale first, espeak last, quality between; fallback and refusal intact');
console.log('unit-tts-voice-ranking: ALL PASSED');
