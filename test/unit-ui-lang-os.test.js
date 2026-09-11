// unit-ui-lang-os.test.js
// v90_y — the UI language falls back to the OPERATING SYSTEM's language before falling back to
// English. User request: "Can we auto-select the UI language to the language setting of the
// operating system we run on?"
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  const at = client.indexOf('\nfunction ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = client.indexOf('{', at);
  let d = 0, i = b;
  for (; i < client.length; i++) { if (client[i] === '{') d++; else if (client[i] === '}') { d--; if (!d) { i++; break; } } }
  return client.slice(at, i);
}
// Driven, with a fake navigator and a fake localStorage — the whole point is the ORDER of fallbacks.
const build = (nav, store) => new Function('navigator', 'localStorage',
  ext('_osUiLang') + '\n' + ext('loadUiLang') + '\nreturn { _osUiLang, loadUiLang };')(nav, store);
const LS = (o) => ({ getItem: k => (k in o ? o[k] : null) });

// ── 1. The OS locale is reduced to a primary subtag ──────────────────────────
{
  const c = (langs) => build({ languages: langs, language: langs[0] }, LS({}))._osUiLang();
  assert.strictEqual(c(['de-DE']), 'de', 'de-DE → de');
  assert.strictEqual(c(['pt-BR']), 'pt', 'pt-BR → pt');
  assert.strictEqual(c(['zh-Hans-CN']), 'zh', 'a three-part tag still reduces to its primary subtag');
  assert.strictEqual(c(['DE']), 'de', 'and it is lower-cased');
  assert.strictEqual(c(['de_AT']), 'de', 'an underscore separator is tolerated too');
  // ⚠️ `navigator.languages` is the user's ORDERED preference list; the first entry wins.
  assert.strictEqual(c(['fr-CH', 'de-CH', 'en']), 'fr', 'the FIRST preference wins, not the last');
  console.log('  de-DE → de, zh-Hans-CN → zh, ordered preference respected: OK');
}

// ── 2. ⚠️ THE FALLBACK ORDER, WHICH IS THE WHOLE FEATURE ────────────────────
{
  const nav = { languages: ['de-DE'], language: 'de-DE' };
  // An explicit choice always wins.
  assert.strictEqual(build(nav, LS({ imp3_uilang: 'it', imp3_srclang: 'fr' })).loadUiLang(), 'it',
    'a saved UI-language preference beats everything');
  // ⚠️ Then the EXISTING srclang — so no existing learner's UI changes on this release, which is
  // the same promise the srclang fallback itself was added with.
  assert.strictEqual(build(nav, LS({ imp3_srclang: 'fr' })).loadUiLang(), 'fr',
    'then the existing srclang — an existing learner\'s UI must not silently change');
  // Only then the OS.
  assert.strictEqual(build(nav, LS({})).loadUiLang(), 'de',
    'then the OS locale — the new behaviour, and only for a learner with no saved preference at all');
  // English stays the last resort.
  assert.strictEqual(build({ languages: [], language: '' }, LS({})).loadUiLang(), 'en',
    'and English is still the last resort when the OS says nothing');
  console.log('  saved UI lang → saved srclang → OS locale → en: OK');
}

// ── 3. It cannot throw, whatever the environment does ───────────────────────
// This runs at startup, before anything else; a throw here would take the whole client down.
{
  const boom = { get languages() { throw new Error('blocked'); }, get language() { throw new Error('blocked'); } };
  assert.strictEqual(build(boom, LS({}))._osUiLang(), '', 'a navigator that throws yields no locale');
  const lsBoom = { getItem() { throw new Error('private mode'); } };
  assert.strictEqual(build({ languages: ['de'], language: 'de' }, lsBoom).loadUiLang(), 'de',
    '⚠️ and a localStorage that throws (private browsing) still reaches the OS locale — the catch '
    + 'must not skip straight to English');
  assert.strictEqual(build(boom, lsBoom).loadUiLang(), 'en', 'both failing still yields a usable value');
  console.log('  a throwing navigator or localStorage degrades instead of breaking startup: OK');
}

// ── 4. ⚠️ NO VALIDATION, DELIBERATELY — and why that is safe ────────────────
// `loadUiLang()` is synchronous and runs before languages.json is fetched, so it cannot check the
// available list. It does not need to: `/api/ui/lang` answers an unknown code with `{}`, and `t()`
// falls back through `window._UI_EN` to English — so the worst case is the English UI that would
// have been shown anyway. Pinned so the reasoning is not quietly lost.
{
  const tFn = ext('t');
  assert.ok(/_UI_EN/.test(tFn),
    't() falls back to English for a missing key, which is what makes an unvalidated locale safe');
  assert.strictEqual(build({ languages: ['xx-YY'], language: 'xx-YY' }, LS({})).loadUiLang(), 'xx',
    'an unknown locale is adopted rather than rejected — it degrades to English strings on its own');
  console.log('  an unknown locale is safe because t() already falls back to English: OK');
}

console.log('unit-ui-lang-os: ALL PASSED');
