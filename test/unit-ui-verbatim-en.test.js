// unit-ui-verbatim-en.test.js
// v71_k: a translation that is byte-identical to its English source is, for these keys, an
// untranslated FALLBACK rather than a translation.
//
// Why it needs a guard: `translate-ui.js` fills keys that are MISSING. A key present-but-English
// looks filled to the script, so it is never revisited — the fallback is permanent and silent.
// (The protocol block in roadmap_v71.md §3 states the rule this test implements: do not assert a
// key is "en-only", assert that no language holds the English string verbatim. That assertion stays
// correct after the key IS translated, which is exactly what an en-only assertion does not.)
//
// Reported (v71_k): `crossword.title` arrived as the literal "Crossword" in vi, th and sw in the
// returning ui.json. Removed there so the next translate pass refills them.
//
// SCOPE is deliberately narrow. 369 entries in ui.json are legitimately identical to English —
// cognates ("Info", "Import"), technical tokens ("IPA", "URL / DOI"), format names
// ("⬇ JSON (.json)") and pure-punctuation strings. A blanket rule would flag all of those. The
// crossword strings are checked because every language we ship has its own word for the puzzle
// (Kruiswoordraadsel, Mots croisés, Korsord, Kelime Bulmaca, 크로스워드 …), so a verbatim copy
// there means untranslated, with no judgement call.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));

const LANGS = Object.keys(UI).filter(l => l !== 'en');

// Every English string that names the puzzle. Derived, not hardcoded, so a NEW crossword string is
// covered the day it is added rather than the day someone remembers to extend this list.
const CROSSWORD_KEYS = Object.keys(UI.en).filter(k => /crossword/i.test(UI.en[k]));

// ── 1. The keys under test actually exist ───────────────────────────────────
// Without this the guard would pass vacuously if the strings were ever renamed (v70_f's lesson).
{
  assert.ok(CROSSWORD_KEYS.length >= 5,
    `expected the crossword strings to still exist in en, found ${CROSSWORD_KEYS.length}`);
  assert.ok(CROSSWORD_KEYS.includes('crossword.title'), 'including the reported key crossword.title');
  console.log(`  ${CROSSWORD_KEYS.length} English crossword string(s) under test`);
}

// ── 2. No language holds one of them verbatim ───────────────────────────────
{
  const verbatim = [];
  for (const lang of LANGS) {
    for (const k of CROSSWORD_KEYS) {
      const v = UI[lang][k];
      if (typeof v !== 'string') continue;            // absent = missing, which translate-ui fixes
      if (v === UI.en[k]) verbatim.push(`${lang}/${k} = ${JSON.stringify(v)}`);
    }
  }
  assert.deepStrictEqual(verbatim, [],
    'an untranslated English fallback survives — DELETE the entry so translate-ui.js refills it, ' +
    'rather than leaving it looking translated:\n  ' + verbatim.join('\n  '));
  console.log(`  ${LANGS.length} languages: no verbatim-English crossword strings`);
}

// ── 3. Deleting is the right fix, and it is what was done ───────────────────
// The three reported languages must be MISSING the key (so the translate pass picks it up), not
// carrying English. Asserted as "not English" rather than "absent" so the test survives the
// re-translation the user has already planned — an "absent" assertion would fail on that day.
{
  ['vi', 'th', 'sw'].forEach(l => {
    assert.ok(l in UI, `${l} is still a shipped language`);
    const v = UI[l]['crossword.title'];
    assert.ok(v === undefined || v !== UI.en['crossword.title'],
      `${l}/crossword.title must be absent or genuinely translated, not the English word`);
  });
  // English itself is untouched — the source string must survive the cleanup (the v71_e trap, where
  // a returning ui.json had lost `crossword.done` from `en` and would have rendered a raw key).
  assert.strictEqual(UI.en['crossword.title'], 'Crossword', 'the English source is intact');
}

// ── 4. The detector is not vacuous ──────────────────────────────────────────
// A guard that cannot fail is worthless; prove the comparison catches a planted fallback.
{
  const planted = { en: { 'crossword.title': 'Crossword' }, xx: { 'crossword.title': 'Crossword' } };
  const caught = Object.keys(planted).filter(l => l !== 'en' &&
    planted[l]['crossword.title'] === planted.en['crossword.title']);
  assert.deepStrictEqual(caught, ['xx'], 'a planted English fallback is detected');
  const ok = { en: { 'crossword.title': 'Crossword' }, xx: { 'crossword.title': 'Korsord' } };
  assert.strictEqual(Object.keys(ok).filter(l => l !== 'en' &&
    ok[l]['crossword.title'] === ok.en['crossword.title']).length, 0, 'a real translation is not');
}

// ── 5. No verbatim English in a non-Latin-script language ───────────────────
// The general form of the same defect. In a language written in another script, a string of Latin
// letters identical to the English is untranslated — there is no cognate defence, because the
// language does not use those letters. (In Latin-script languages the same test cannot be made
// automatic: ~294 entries there are legitimately identical — "Info", "Import", "Email" — and
// telling a real cognate from a fallback needs a speaker, not a rule. So the guard covers the ten
// languages where the answer is unambiguous, and Latin-script ones stay a human review.)
//
// Swept in v71_k, all confirmed against sibling languages before deleting: hi lost five (four
// toasts + "Cancel"), el three ("Backend:", "Flag", "Storyboard" — every other non-Latin language
// had localised all three), ja two ("by {user}", "from"), th two, ru one ("Reason…"), zh one
// ("Flag"), he one. The evidence was cross-linguistic: ru wrote "Бэкенд:" and ja "バックエンド:",
// so th/el keeping Latin "Backend:" was a fallback and not a loanword choice.
{
  const NON_LATIN = ['ar', 'he', 'hi', 'ja', 'ko', 'ru', 'uk', 'zh', 'th', 'el'];
  // Strings with NOTHING to translate: file-format names, a bare initialism, and templates that are
  // pure placeholders and symbols. These are identical in every language by design, not by neglect.
  // The list is short and each entry is checked below to still be prose-free — if one ever gains
  // real words, it drops out of the exemption automatically rather than hiding a fallback.
  const NO_PROSE = new Set(['export.markdown', 'export.html', 'export.json',
    'ex.mcq_conjugation.q', 'ex.error_hunt.result', 'intro.field.ipa', 'prov.url']);

  NON_LATIN.forEach(l => assert.ok(l in UI, `${l} is still a shipped language`));

  const fallbacks = [];
  for (const lang of NON_LATIN) {
    for (const [k, v] of Object.entries(UI[lang])) {
      const en = UI.en[k];
      if (typeof v !== 'string' || typeof en !== 'string' || v !== en) continue;
      if (!/[A-Za-z]{2,}/.test(en)) continue;         // symbols/digits only: identical legitimately
      if (NO_PROSE.has(k)) continue;
      fallbacks.push(`${lang}/${k} = ${JSON.stringify(en)}`);
    }
  }
  assert.deepStrictEqual(fallbacks, [],
    'a non-Latin-script language holds a Latin-alphabet English string verbatim, which means it was ' +
    'never translated — delete the entry so translate-ui.js refills it:\n  ' + fallbacks.join('\n  '));

  // The exemption list may not be used to smuggle prose past the check. Every exempt string must be
  // free of multi-word running text once placeholders, symbols and format tokens are stripped.
  NO_PROSE.forEach(k => {
    assert.ok(k in UI.en, `exempt key ${k} still exists — otherwise remove it from the list`);
    const bare = UI.en[k]
      .replace(/\{[a-z_]+\}/gi, ' ')                  // placeholders
      .replace(/\.\w+|\(|\)/g, ' ')                   // file extensions and their brackets
      .replace(/[^A-Za-z ]+/g, ' ')                   // symbols, emoji, punctuation
      .trim().split(/\s+/).filter(Boolean);
    assert.ok(bare.length <= 2,
      `exempt key ${k} now contains running text (${JSON.stringify(bare)}) — it must be re-checked, ` +
      'not exempted');
  });
  console.log(`  ${NON_LATIN.length} non-Latin-script languages: no verbatim-English fallbacks ` +
    `(${NO_PROSE.size} prose-free keys exempt)`);
}

console.log('unit-ui-verbatim-en: ALL PASSED');
