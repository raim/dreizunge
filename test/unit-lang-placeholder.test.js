// unit-lang-placeholder.test.js
// v71_d: {lang} interpolates a language NAME (a noun: "Italian", "Italienisch", "Italiano").
//
// User-reported: ex.read_translate.q was "Translate this {lang} sentence:", which the German
// translation rendered as "Übersetze diesen {lang}-Satz:" -> "Übersetze diesen Italienisch-Satz:".
// German needs an ADJECTIVE there ("diesen italienischen Satz"), inflected for case and gender.
// So does Italian ("questa frase italiana"), Russian, Polish, and most other inflecting languages.
// A noun substituted into an attributive slot cannot be made grammatical by the translator either,
// because the placeholder is filled at runtime — the bug is in the SHAPE of the string.
//
// The safe shapes are prepositional ("in {lang}", "to {lang}", "for {lang}") and parenthetical
// ("({lang})"), where the language name stays a noun and needs no agreement. This test pins that
// distinction so an attributive phrasing cannot be reintroduced.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

// The detector is deliberately STRICT: anything other than a prepositional, parenthetical or
// sentence-final {lang} is flagged. A loose "does a noun follow?" heuristic cannot work across 30
// languages — it cannot tell "handle {lang} well" (verb object, fine) from "the {lang} meaning"
// (modifier, broken) without parsing. So the safe shapes are enumerated, everything else is
// flagged, and the handful of legitimate verb-object uses are listed by key below with a reason.
// A short explicit allowlist keeps the guard strict; a clever heuristic would not.
const PREP_BEFORE = /(?:\b(?:in|to|into|from|for|of|auf|nach|von|für|en|à|de|da|di|per)\b|\(|:|—|-)\s*$/i;
// {lang} as the OBJECT of a verb needs no agreement in any language we ship, so these are correct.
const VERB_OBJECT_OK = new Set([
  'models.warn.weak',    // "…may not handle {lang} well."  — object of "handle"
  'form.topic_label',    // "What do you want to learn {lang} for?" — object of "learn"
]);
function attributiveUse(str) {
  const out = [];
  const re = /\{lang\}/g; let m;
  while ((m = re.exec(str)) !== null) {
    const before = str.slice(0, m.index);
    const after = str.slice(m.index + m[0].length);
    const nextWord = after.match(/^[\s-]*([\p{L}]+)/u);
    if (!nextWord) continue;                       // end of string / punctuation: safe
    if (PREP_BEFORE.test(before)) continue;        // "in {lang}", "({lang})": safe
    out.push(`…${before.slice(-18)}[{lang}] ${nextWord[1]}…`);
  }
  return out;
}

// ── 1. The English strings — the source every translation is derived from ────
{
  const bad = [];
  Object.entries(UI.en).forEach(([k, v]) => {
    if (typeof v !== 'string' || VERB_OBJECT_OK.has(k)) return;
    attributiveUse(v).forEach(ex => bad.push(`${k}: ${ex}`));
  });
  assert.deepStrictEqual(bad, [],
    'no English string uses {lang} attributively — it must be prepositional or parenthetical:\n  ' + bad.join('\n  '));
  console.log(`  en: ${Object.values(UI.en).filter(v => typeof v === 'string' && v.includes('{lang}')).length} string(s) use {lang}, none attributively`);
}

// ── 2. The reported strings specifically ────────────────────────────────────
{
  assert.strictEqual(UI.en['ex.read_translate.q'], 'Translate this sentence:',
    'the reported string no longer names the language — it is obvious from the lesson');
  ['ex.listen_mcq.q', 'ex.listen_type.q'].forEach(k =>
    assert.ok(!UI.en[k].includes('{lang}'), `${k} likewise drops the redundant language name`));
  // Where the language genuinely carries information it is kept, but prepositionally.
  ['tts.approx_dialect', 'tts.no_voice_silent', 'tts.no_voice_hint', 'form.translation_placeholder']
    .forEach(k => assert.ok(UI.en[k].includes('{lang}'), `${k} still names the language, which matters there`));
  assert.ok(/for \{lang\}/.test(UI.en['tts.no_voice_hint']), 'and does so with a preposition');
}

// ── 3. Translations may not carry a {lang} the English no longer has ────────
// NOT an attributive check on translations: that cannot be automated. Turkish "{lang} içinde",
// Korean "{lang}로", Hindi "{lang} में" and Chinese "在{lang}中" all place the language name BEFORE
// the particle that marks its role, which is correct in those languages and indistinguishable from
// an English-style modifier by any rule short of parsing. The attributive fix therefore belongs at
// the English source, which every translation is derived from — section 1.
//
// What IS language-neutral: once a key stops interpolating {lang} in English, any translation still
// interpolating it is stale, and will render a literal placeholder or a stray language name. That
// is exactly the state the reported strings were left in, so it is worth a guard.
{
  const stale = [];
  Object.keys(UI).forEach(lang => {
    if (lang === 'en') return;
    Object.entries(UI[lang]).forEach(([k, v]) => {
      if (typeof v !== 'string' || !v.includes('{lang}')) return;
      const en = UI.en[k];
      if (typeof en === 'string' && !en.includes('{lang}')) stale.push(`${lang}/${k}`);
    });
  });
  assert.deepStrictEqual(stale, [],
    'no translation interpolates {lang} for a key whose English dropped it:\n  ' + stale.join('\n  '));
  // ALL SEVEN rewritten keys: the durable rule is that no translation may reintroduce `{lang}` for
  // a key whose English dropped it. Originally (v71_d) these were asserted to stay CLEARED, because
  // the existing translations embedded the broken attributive shape and had to be deleted. They
  // were properly re-translated in v71_j, so "cleared" is no longer the right assertion — but the
  // reason it existed still is, and is checked below and in section 3.
  const REWRITTEN_V71D = ['ex.read_translate.q', 'ex.listen_mcq.q', 'ex.listen_type.q',
    'tts.approx_dialect', 'tts.no_voice_silent', 'tts.no_voice_hint', 'form.translation_placeholder'];
  REWRITTEN_V71D.forEach(k => {
    assert.ok(k in UI.en, `${k} still exists in English`);
    // Where English dropped {lang} entirely, no translation may bring it back.
    if (!UI.en[k].includes('{lang}')) {
      const reintroduced = Object.keys(UI).filter(l => l !== 'en' && (UI[l][k] || '').includes('{lang}'));
      assert.deepStrictEqual(reintroduced, [],
        `${k}: English names no language, so no translation may reintroduce {lang}`);
    }
  });
  console.log(`  ${Object.keys(UI).length} languages: no stale {lang} interpolations`);
}

// ── 4. The detector itself works ───────────────────────────────────────────
// Without this the suite could pass by simply never detecting anything.
{
  assert.ok(attributiveUse('Translate this {lang} sentence:').length, 'an attributive use is caught');
  assert.ok(attributiveUse('Höre und wähle die {lang} Bedeutung:').length, 'including in German');
  assert.ok(attributiveUse('Übersetze diesen {lang}-Satz:').length, 'including hyphenated compounds');
  assert.strictEqual(attributiveUse('Type this in {lang}:').length, 0, '"in {lang}" is fine');
  assert.strictEqual(attributiveUse('Translate to {lang}').length, 0, '"to {lang}" is fine');
  assert.strictEqual(attributiveUse('Paste the translation ({lang}) here.').length, 0, 'parenthetical is fine');
  assert.strictEqual(attributiveUse('No voice for {lang} on this device').length, 0, '"for {lang}" is fine');
  // The allowlist must stay SMALL and justified — it is the guard's only escape hatch.
  assert.ok(VERB_OBJECT_OK.size <= 3, 'the verb-object allowlist has not quietly grown');
  VERB_OBJECT_OK.forEach(k => assert.ok(UI.en[k] && UI.en[k].includes('{lang}'),
    `allowlisted key ${k} still exists and still uses {lang} — otherwise remove it from the list`));
}

console.log('unit-lang-placeholder: ALL PASSED');
