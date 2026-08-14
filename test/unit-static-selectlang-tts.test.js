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

// ── the pairing: live refreshes the row ⇒ the override must too ────────────
const TTS_REFRESH = /updateTtsVoiceNote\s*\(/;
{
  const owed = [];
  for (const name of new Set(overridden)) {
    const liveBody = body(live, name);
    if (!liveBody) continue;                       // static-only helper, nothing to pair with
    if (!TTS_REFRESH.test(liveBody)) continue;     // live doesn't refresh either → nothing owed
    // The override's own source, as the builder emits it.
    const at = builder.indexOf("'function " + name + "(");
    const end = builder.indexOf("\n  '}',", at);
    const overrideSrc = builder.slice(at, end < 0 ? at + 4000 : end);
    if (!TTS_REFRESH.test(overrideSrc)) owed.push(name);
  }
  assert.deepStrictEqual(owed, [],
    'these static overrides replace a live function that refreshes the sound-test row, but do not ' +
    'refresh it themselves — on GitHub Pages the row will go stale: ' + owed.join(', '));
  console.log('  every override of a TTS-refreshing function refreshes it too: OK');
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
// • The pairing key is `updateTtsVoiceNote` specifically. An override that drops some OTHER live
//   side-effect (updateDocDir, updateArcScriptRow — both absent from the static selectLang, and
//   deliberately out of scope here) is not covered by this file.
console.log('unit-static-selectlang-tts: ALL PASSED');
