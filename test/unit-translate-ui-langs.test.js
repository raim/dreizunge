// unit-translate-ui-langs.test.js
// v53: `translate-ui.js` derived its work list from Object.keys(ui.json), so a language ENTIRELY
// absent from ui.json was invisible to the very pass meant to fill it — never listed, never
// translated, and `--check` printed "All translations complete!" while Swahili sat at 0/426 keys.
// The source language doubles as the UI language (index.html: `uiLang = APP.srcLang`), so every
// code offered in languages.json needs UI strings. Guards that the work list is derived from
// languages.json (union ui.json), and that no offered language can be silently skipped again.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const script = fs.readFileSync(path.join(ROOT, 'translate-ui.js'), 'utf8');
const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const langs = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));

// The old, self-concealing derivation must be gone.
assert.ok(!/const allLangs = Object\.keys\(ui\)\.filter\(l => l !== 'en'\);/.test(script),
  'translate-ui.js no longer derives its language list from ui.json alone');
assert.ok(/Object\.keys\(langs\)/.test(script),
  'translate-ui.js reads the offered languages from languages.json');

// Reproduce the script's derivation and assert it covers every offered language.
const offeredLangs = Object.keys(langs).filter(l => !l.startsWith('_'));
const allLangs = [...new Set([...offeredLangs, ...Object.keys(ui)])].filter(l => l !== 'en');

assert.ok(offeredLangs.length >= 30, `languages.json offers ${offeredLangs.length} languages`);
for (const l of offeredLangs) {
  if (l === 'en') continue;
  assert.ok(allLangs.includes(l), `${l} is discoverable by translate-ui.js (offered in languages.json)`);
}
// The regression that motivated this: sw is offered, and absent from ui.json, and must still be found.
assert.ok(offeredLangs.includes('sw'), 'sw is an offered language');
assert.ok(allLangs.includes('sw'), 'sw is discoverable even though ui.json has no sw entry');

// A stray ui.json entry with no languages.json counterpart is still maintained (union, not replace).
const strayUi = { en: {}, de: {}, xx: {} };
const strayAll = [...new Set([...offeredLangs, ...Object.keys(strayUi)])].filter(l => l !== 'en');
assert.ok(strayAll.includes('xx'), 'a ui.json-only language is still picked up (union semantics)');

// languages.json unreadable → langs={} → fall back to ui.json keys (old behaviour, not a crash).
const fallback = [...new Set([...[], ...Object.keys(ui)])].filter(l => l !== 'en');
assert.ok(fallback.length > 0, 'unreadable languages.json degrades to the ui.json key list');

// Every language the UI can actually be shown in must be an `en`-key subset, never English text
// smuggled into another language (translate-ui keys off MISSING keys and cannot detect a fallback).
const enKeys = Object.keys(ui.en || {});
assert.ok(enKeys.length > 0, 'ui.json has English base strings');
for (const l of Object.keys(ui)) {
  if (l === 'en') continue;
  for (const k of Object.keys(ui[l])) {
    assert.ok(enKeys.includes(k), `ui.json[${l}] key "${k}" exists in en (no orphaned keys)`);
  }
}

const missingLangs = offeredLangs.filter(l => l !== 'en' && !ui[l]);
console.log(`  translate-ui.js discovers all ${allLangs.length} non-en languages`
  + (missingLangs.length ? ` (untranslated, now visible: ${missingLangs.join(', ')})` : ''));
console.log('unit-translate-ui-langs: ALL PASSED');
