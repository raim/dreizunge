// unit-tts-voice-fallback.test.js
// v79_d — the user reported the wrong-region English readout on Android a SECOND time, after
// v74_j. v74_j was not wrong; it was incomplete, and its own mechanism is why.
//
// v74_j made the exact locale outrank quality, so with `en-GB` installed a neural `en-JM` can no
// longer win. When `en-GB` is NOT installed — which is the ordinary state of an Android phone that
// was never set to British English — every candidate scores exact=0, that tier is FLAT, and the
// sort falls through to quality. Quality scores a network voice 3 and a local voice 1. Android
// exposes the whole network long tail (en-NG, en-JM, en-TT, …), so the readout goes straight back
// to a regional voice. `languages.json` maps `en` → `en-GB`, so this is the shipped path for every
// English lesson.
//
// The tie is broken from DEVICE data, never by the app ranking Englishes against each other:
// `navigator.languages` (the user's own preference list, in their order), `voice.default`, and
// then local-over-network among voices that are already wrong about the region.
//
// Voice lists are SIMULATED, as in unit-tts-voice-ranking: there is no speechSynthesis in the
// harness and the real inventory is a property of the device. What is testable is the POLICY.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

const C = loadClient({ quiet: true });
// Rank through the product function, with both the voice list and the device's locale preferences
// injected — the second is the input v74_j never had.
const rank = (voices, code, navLangs) => JSON.parse(C.run(
  `globalThis.navigator = { languages: ${JSON.stringify(navLangs || [])},
                            language: ${JSON.stringify((navLangs || [])[0] || 'en')} };
   JSON.stringify(_ttsRankVoices(${JSON.stringify(voices)}, ${JSON.stringify(code)})
     .map(function(v){ return v.lang; }))`, 'rank'));

const V = (lang, local, extra) => Object.assign({ name: 'English ' + lang, lang, localService: local }, extra || {});

// ── 1. The reported case: en-GB absent, network regionals present ───────────────────────────
{
  // A phone whose English is en-US, with the Android network long tail alongside it.
  const NO_GB = [V('en-US', true), V('en-IN', true), V('en-NG', false), V('en-JM', false), V('en-TT', false)];
  // Non-vacuity, twice over: the trap must actually be present, and the requested locale must
  // actually be missing — otherwise this is just unit-tts-voice-ranking again.
  assert.ok(!NO_GB.some(v => v.lang === 'en-GB'), 'the simulated device does NOT have en-GB');
  assert.ok(NO_GB.some(v => !v.localService), 'and it does offer higher-QUALITY network regionals');
  const order = rank(NO_GB, 'en-GB', ['en-US', 'de-AT']);
  assert.strictEqual(order[0], 'en-US',
    'with en-GB absent, the English the DEVICE is set to is read — not whichever regional voice '
    + 'happens to be a network voice (got ' + order.join(', ') + ')');
  // The specific voices the user heard must not be at the front.
  assert.ok(!['en-NG', 'en-JM', 'en-TT'].includes(order[0]),
    'no West African or Caribbean voice is chosen for a learner reading English');
}

// ── 2. The device's preference is READ, not assumed ─────────────────────────────────────────
// The same inventory, a differently configured phone. If the app were simply hardcoding "en-US is
// the fallback English" this section would fail — which is the point of it.
{
  const POOL = [V('en-US', true), V('en-IN', true), V('en-AU', true), V('en-JM', false)];
  assert.strictEqual(rank(POOL, 'en-GB', ['en-AU'])[0], 'en-AU',
    'a phone set to Australian English is read in en-AU');
  assert.strictEqual(rank(POOL, 'en-GB', ['en-IN'])[0], 'en-IN',
    'a phone set to Indian English is read in en-IN — the device decides, the app does not');
  // And the user's ORDER is honoured, not merely membership.
  assert.strictEqual(rank(POOL, 'en-GB', ['en-AU', 'en-US'])[0], 'en-AU',
    "the first of the user's preferences wins, not the last");
}

// ── 3. `voice.default` is the fallback signal when the device lists nothing useful ──────────
{
  const POOL = [V('en-JM', false), V('en-NG', false), V('en-ZA', false, { default: true })];
  assert.strictEqual(rank(POOL, 'en-GB', ['de-AT'])[0], 'en-ZA',
    "the engine's own default voice is preferred when the user's locale list says nothing about "
    + 'English');
}

// ── 4. Local beats network — but ONLY among voices that are already the wrong region ────────
{
  // No device signal at all, so this tier is the one deciding.
  const MIXED = [V('en-JM', false), V('en-US', true)];
  assert.strictEqual(rank(MIXED, 'en-GB', ['de-AT'])[0], 'en-US',
    'between two voices that are both wrong about the region, the one the device actually has '
    + 'installed wins over the network long tail');
  // The v74_j guarantee must survive: for the REQUESTED locale, quality still decides, so a neural
  // en-GB is not demoted to a local en-GB. If the new tier leaked into the exact case this fails.
  const BOTH_GB = [V('en-GB', true, { name: 'English GB local' }),
                   V('en-GB', false, { name: 'English GB network' })];
  const gb = JSON.parse(C.run(
    `globalThis.navigator = { languages: ['de-AT'], language: 'de-AT' };
     JSON.stringify(_ttsRankVoices(${JSON.stringify(BOTH_GB)}, 'en-GB').map(function(v){ return v.name; }))`));
  assert.strictEqual(gb[0], 'English GB network',
    'within the requested locale the better voice still wins — the new tiers must not reach it');
}

// ── 5. espeak stays last, and the new tiers cannot rescue it ────────────────────────────────
{
  // The device is set to en-GB AND the only en-GB voice is espeak. Device affinity would put it
  // first if it outranked usability; it must not.
  const ESPEAK = [V('en-GB', true, { name: 'eSpeak English GB' }), V('en-US', true), V('en-JM', false)];
  const order = rank(ESPEAK, 'en-GB', ['en-GB']);
  assert.strictEqual(order[order.length - 1], 'en-GB',
    'an espeak voice in the right region is still last — usability outranks every locale tier');
  assert.strictEqual(order[0], 'en-US',
    'and the fallback is the local voice, not the network Caribbean one');
}

// ── 6. Not English-only ─────────────────────────────────────────────────────────────────────
// languages.json maps pt → pt-PT. A Brazilian phone with no pt-PT voice should be read in pt-BR
// rather than in whatever else the network offers; the mechanism is the same one.
{
  const PT = [V('pt-BR', true), V('pt-AO', false)];
  assert.strictEqual(rank(PT, 'pt-PT', ['pt-BR'])[0], 'pt-BR',
    'the same fallback policy applies to every language, not just English');
}

console.log('  en-GB absent: device locale decides, network regionals do not: OK');
console.log('  device preference read in order; voice.default as fallback: OK');
console.log('  local-over-network only among wrong-region voices; v74_j exact tier intact: OK');
console.log('unit-tts-voice-fallback: ALL PASSED');
