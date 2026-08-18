// unit-static-selectlang-tts.test.js — v79_p.
//
// The standing rule "`build-static.js` re-implements client functions" cost a second fix for one
// bug: `v79_o` made the sound-test row follow a target-language change, in the LIVE `selectLang`.
// The static build has its OWN `selectLang`, which set `APP.lang` and stopped — so on GitHub Pages
// the row never refreshed and its flag and locale selector both stayed on the previous language.
//
// Rule 32: guard the ENUMERATION, not the instance. This does not just assert "static selectLang
// calls updateTtsVoiceNote". It DERIVES, for every function `build-static.js` overrides, whether
// the live version of that same function refreshes the TTS row — and requires the override to do
// it too. A future override that silently drops the call fails here.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const live = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
const docs = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');

// ── which functions does the static builder re-implement? ──────────────────
// The builder emits its overrides as arrays of source lines, so the declarations are found in the
// builder's own text rather than by executing it.
const overridden = [...builder.matchAll(/'function ([A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]);
assert.ok(overridden.length > 0, 'the static builder re-implements at least one client function');
assert.ok(overridden.includes('selectLang'),
  'selectLang is one of them — if this fails the extraction broke, not the build');
console.log('  functions re-implemented by build-static.js: ' + overridden.length +
            ' (' + overridden.slice(0, 8).join(', ') + (overridden.length > 8 ? ', …' : '') + ')');

// Extract a named function body from a source blob (brace matching, first definition).
function body(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) return '';
  let d = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { i++; break; } }
  }
  return src.slice(at, i);
}

// ── the pairing: a live UI-refresh call ⇒ the override must make it too ────
// v79_q generalises this from `updateTtsVoiceNote` alone. The v79_p fix closed ONE dropped
// side-effect and the write-up listed three more as out of scope — which is a note telling the
// next session to check something, and a note is not a guard (rule 24). These are the calls that
// re-sync visible UI to a changed language; a static override that drops one leaves the page
// showing the previous language in that respect, silently and only on GitHub Pages.
const REFRESHERS = [
  'updateTtsVoiceNote',   // the sound-test row: flag + speech-variant selector
  'updateDocDir',         // document direction AND the target-is-RTL marker (Arabic word banks)
  'updateArcScriptRow',   // the script row for the chosen language
  'refreshScriptPickers', // v76_i/v78_q: the script pick must not survive a real language change
];
{
  const owed = [];
  for (const name of new Set(overridden)) {
    const liveBody = body(live, name);
    if (!liveBody) continue;                       // static-only helper, nothing to pair with
    // The override's own source, as the builder emits it.
    const at = builder.indexOf("'function " + name + "(");
    const end = builder.indexOf("\n  '}',", at);
    const overrideSrc = builder.slice(at, end < 0 ? at + 4000 : end);
    for (const call of REFRESHERS) {
      const re = new RegExp(call + '\\s*\\(');
      if (re.test(liveBody) && !re.test(overrideSrc)) owed.push(name + ' → ' + call);
    }
  }
  assert.deepStrictEqual(owed, [],
    'these static overrides replace a live function that re-syncs visible UI to the language, but ' +
    'do not make that call themselves — on GitHub Pages that part of the page will go stale: ' +
    owed.join(', '));
  console.log('  every override makes the UI-refresh calls its live twin makes: OK (' +
    REFRESHERS.length + ' refreshers x ' + new Set(overridden).size + ' overrides)');
}

// ── the specific regression, at the layer it is observable ─────────────────
// The BUILT artifact is what ships, so assert there rather than only in the builder's string
// array: docs/index.html carries two `selectLang` definitions and the LATER one wins.
{
  const last = docs.lastIndexOf('function selectLang(');
  assert.ok(last > -1, 'the built static page defines selectLang');
  let d = 0, i = docs.indexOf('{', last), end = i;
  for (; i < docs.length; i++) {
    const c = docs[i];
    if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { end = i + 1; break; } }
  }
  const winning = docs.slice(last, end);
  const TTS_REFRESH = /updateTtsVoiceNote\s*\(/;
  assert.ok(TTS_REFRESH.test(winning),
    'THE REGRESSION: the selectLang that WINS in docs/index.html must refresh the sound-test row, ' +
    'or a target-language change leaves the flag and locale selector on the previous language');
  assert.ok(/APP\.ttsLang/.test(winning),
    'and must clear a speech-language override left pointing at the previous target');
  console.log('  the winning selectLang in docs/index.html refreshes the row: OK');
}

// ── the helpers it calls must exist in the built page ──────────────────────
// A call added to an override is worthless if the function it calls was never baked in.
{
  for (const fn of ['updateTtsVoiceNote', '_speechLocaleFor', '_ttsVariantSelectHtml'])
    assert.ok(new RegExp('function ' + fn + '\\s*\\(').test(docs),
      `${fn} must be present in the built static page — the override calls it`);
  console.log('  the helpers the override calls are baked into the static page: OK');
}

// ── What this does NOT establish (rule 34) ────────────────────────────────
// • Source-level. It proves the call is present and reachable, not that a browser then repaints
//   the row — that is the device pass.
// • The pairing key is the REFRESHERS list above. An override that drops a live side-effect not on
//   that list is still not covered — the list is a judgement about which calls re-sync visible UI,
//   and it needs extending whenever a new one of those appears.
console.log('unit-static-selectlang-tts: ALL PASSED');
