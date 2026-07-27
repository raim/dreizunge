#!/usr/bin/env node
// qc-ui-translations.js — v69.2c
// QC + repair pass over a freshly translated ui.json. Run: node tools/qc-ui-translations.js in.json out.json
//
// The v69 translate-ui run filled all 29 languages (0 missing keys), but introduced three classes
// of defect that are mechanically detectable and worth catching BEFORE they ship:
//
//   A. PLACEHOLDER DAMAGE (functional — the UI would print literal braces or lose a value):
//      • renamed: {word}→{woord}, {title}→{otsikko}, {solved}→{rozwiązane}, … substitution silently
//        fails and the learner sees "{woord}" on screen. Repaired POSITIONALLY (order preserved),
//        which keeps the translator's wording intact.
//      • dropped / invented / count-mismatched: repaired per-key from the English source below.
//      Legitimate REORDERING (same set, different order — normal for other word orders) is NOT
//      touched: 4 such entries exist and are correct.
//   B. CORRUPTION: stray model artifacts ("almart", "-Taught", "scribe_"), and cross-script bleed —
//      Chinese inside the Spanish/Romanian/Hungarian strings, Cyrillic inside Polish. Repaired from
//      the English source.
//   C. LEADING-ICON DRIFT: the app uses a leading emoji as each lesson type's visual identity
//      (🔡 script, 🔢 math, 🎭 creative). Several languages dropped or swapped it, so the same
//      concept showed a different icon per language. Restored to the English icon.
//
// Not repaired here (needs a native speaker — reported instead): register inconsistency, awkward
// but valid phrasing, and terminology drift within a language.
'use strict';
const fs = require('fs');

const inFile = process.argv[2], outFile = process.argv[3];
if (!inFile || !outFile) { console.error('usage: qc-ui-translations.js <in.json> <out.json>'); process.exit(1); }
const ui = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const en = ui.en;
const PH = (s) => [...String(s).matchAll(/\{[^}\s]{1,40}\}/gu)].map(m => m[0]);
let fixes = 0;
const log = [];
const set = (lang, key, val, why) => {
  if (ui[lang][key] === val) return;
  log.push(`[${lang}] ${key}  (${why})\n    was: ${JSON.stringify(ui[lang][key])}\n    now: ${JSON.stringify(val)}`);
  ui[lang][key] = val; fixes++;
};

// ── A1. Renamed placeholders → restore the English names positionally ─────────
for (const lang of Object.keys(ui)) {
  if (lang === 'en') continue;
  for (const key of Object.keys(en)) {
    const a = en[key], b = ui[lang][key];
    if (typeof b !== 'string') continue;
    const A = PH(a), B = PH(b);
    if (A.length === 0 || A.length !== B.length) continue;
    if (A.join() === B.join()) continue;                       // identical
    if ([...A].sort().join() === [...B].sort().join()) continue; // reordered → legitimate
    let i = 0, out = b.replace(/\{[^}\s]{1,40}\}/gu, () => A[i++]);
    set(lang, key, out, 'placeholder names translated → restored positionally');
  }
}

// ── A2/A3. Dropped, invented and count-mismatched placeholders ────────────────
// Each repair keeps the translator's wording and only restores the slot the code substitutes.
// The `{lang}` cases use a parenthetical, which is grammatically safe in every target here.
const PLACEHOLDER_REPAIRS = {
  tr: {
    'form.translation_hint':  '({lang})',
    'form.translation_label': 'Çeviri ({lang})',
    'lib.empty_lang':         'Bu dilde ders yok.',                         // invented {lang}: en has none
    'ex.glyph_order.placeholder': 'Kelime oluşturmak için harfleri tıklayın', // invented trailing {word}
  },
  fi: {
    'form.translation_hint':  '({lang})',
    'form.translation_label': 'Käännös ({lang})',
    // also repairs "per seuraus" (= "per consequence"), a mistranslation of "per paragraph"
    'form.translation_placeholder': 'Liitä {lang}-käännös tähän. Yksi lause kappaletta kohden on ihanteellinen, mutta tavallinen teksti käy myös.',
  },
  hu: { 'form.translation_label': 'Fordítás ({lang})' },
  el: { 'toast.export_ok': '✓ Εξήχθη {n} μάθημα' },                          // count was hardcoded to "one"
  ko: {
    'lesson.words_from': '이 수업의 단어',                                     // invented {n}
    'qc.story_pending':  '검토 대기 중인 스토리 교정 제안 — 챕터 스토리를 열어 수락 또는 거부하세요',
  },
  ja: { 'qc.story_pending': 'ストーリーの添削提案が審査待ちです。章のストーリーを開いて、承認または却下してください。' },
  pl: { 'ex.mcq_source_target.q': 'Jak powiedzieć "{word}" w języku {lang}?' }, // {word} had been dropped
  th: { 'coverage.solved_of': '{solved} จาก {total}' },                        // {total} had been dropped
};

// ── B. Corruption: model artifacts and cross-script bleed ────────────────────
const CORRUPTION_REPAIRS = {
  es: { 'form.arc_script_lbl': '🔡 Enseñar el alfabeto por capítulo' },        // was entirely Chinese
  fr: { 'form.arc_script_lbl': "🔡 Enseigner l'écriture par chapitre" },       // was "-Taught le script…"
  it: { 'form.arc_script_lbl': '🔡 Insegna la scrittura per capitolo' },       // was "-Taught the script…"
  sv: { 'form.arc_script_lbl': '🔡 Lär ut skriftsystemet per kapitel' },       // was "almart Skrivsystem…"
  he: { 'form.arc_script_lbl': '🔡 למד את הכתב בכל פרק' },                     // was "scribe_למד…"
  hi: { 'form.arc_script_lbl': '🔡 प्रत्येक अध्याय में लिपि सिखाएँ' },              // had 🔒 (lock) not 🔡
  ru: { 'form.arc_script_lbl': '🔡 Обучать письменности в каждой главе' },
  pl: {
    'lesson.type.intro_script':  '🔡 Poznaj pismo',                            // was "almartuj się…"
    'form.format.intro_script':  '🔡 Poznaj pismo — alfabet, litera po literze (bez AI)',
    'mixed.readonly_note':       'Ta lekcja jest składana automatycznie — nie ma tu nic do edycji. Pytania są losowane na nowo przy każdym uruchomieniu.', // had Cyrillic bleed
  },
  hu: { 'static.pill.issue_body': 'Kérjük, csatolja az exportált {fname} fájlt (húzza ebbe a mezőbe). Jelöléseket / értékeléseket / szerkesztéseket tartalmaz áttekintésre.\n\n(A statikus Dreizunge buildből exportálva.)' }, // had Chinese "át拉起拖拽"
  ro: {
    'pdf.break_here':             '✂ împarte aici',                            // was "✂中断这里"
    'gen.math_instr_placeholder': '🤖 Instrucțiuni AI pentru matematică (opțional) — de exemplu, adunare Fibonacci, ecuații LaTeX…', // had Chinese + Indonesian "opsional"
  },
  ca: { 'ex.flag_save': 'Marca' },                                             // was "P挂"
};

// ── D. German: the user-reported pass (their own UI language) ────────────────
// "Lernarc" is not a German word (reported). The rest surfaced in the same review: a doubled noun,
// a run-together non-word, a false friend that INVERTS the meaning, a wrong article, two
// untranslated verbs, and a formal/informal register clash with the rest of the app.
const DE_REPAIRS = {
  // "Lerne pro Kapitel ein Lernarc" — non-word + wrong construction (imperative "learn an arc").
  'form.arc_lbl': '🎯 Lernbogen pro Kapitel aufbauen',
  // "den exportierten Datei-Datei" — doubled noun + wrong article; also switches to formal "Sie"
  // while this screen's neighbours use "du".
  'static.pill.issue_body': 'Hänge die exportierte Datei {fname} an (zieh sie in dieses Feld). Sie enthält Lektionen mit Markierungen / Bewertungen / Bearbeitungen zur Überprüfung.\n\n(Aus dem statischen Dreizunge-Build exportiert.)',
  // "dein aktuelles Inhaltsbleiben" is not a word; "Cancel" was left untranslated; second line was
  // garbled into an imperative ("Ermittle … ersetzen").
  'toast.import_merge_confirm': 'OK — nur Markierungen/Bewertungen/Löschungen übernehmen (deine aktuellen Inhalte bleiben erhalten).\nAbbrechen — die passenden Themen vollständig durch die eingereichte Version ersetzen.',
  // "Dieser Datei" → wrong gender; "Flag/bearbeitungs-Beitrag" → malformed compound.
  'import.choice.body': 'Diese Datei ist eine Einsendung mit Markierungen/Bearbeitungen. Wie soll sie auf die passenden Themen angewendet werden?',
  // FALSE FRIEND, inverts the meaning: "Lösungen" = solutions; the English is "deletes".
  'import.choice.merge_hint': 'Nur ihre Markierungen / Bewertungen / Löschungen anwenden — deine Inhalte behalten.',
  // Untranslated verbs; also unifies the terminology on "Markierung" (the file used Flag, Flagge,
  // flaggen and markiert for one concept).
  'qc.editor.flag_save': 'Markieren',
  'qc.editor.flag_remove': 'Markierung entfernen',
  'qc.toast.flag_removed': 'Markierung entfernt',
  'qc.editor.dismiss_title': 'Markierung verwerfen',
  'qc.editor.flag_title': 'Dieses Element mit einem Kommentar markieren',
  // Meaning drift: the English is two steps ("open a set FIRST, THEN add"), not a purpose clause.
  'intro.need_open_set': 'Öffne zuerst eine Lektionseinheit und füge dann eine „Schrift lernen“-Lektion hinzu.',
};

for (const [lang, table] of Object.entries(PLACEHOLDER_REPAIRS))
  for (const [k, v] of Object.entries(table)) set(lang, k, v, 'placeholder repair');
for (const [lang, table] of Object.entries(CORRUPTION_REPAIRS))
  for (const [k, v] of Object.entries(table)) set(lang, k, v, 'corruption repair');
for (const [k, v] of Object.entries(DE_REPAIRS)) set('de', k, v, 'German QC');

// ── C. Leading-icon drift ────────────────────────────────────────────────────
// Only the FIRST character, and only when English has one: the icon is the app's per-concept
// identity. Inner emoji are left to the translator.
const LEAD = /^(\p{Extended_Pictographic}\uFE0F?)/u;
for (const lang of Object.keys(ui)) {
  if (lang === 'en') continue;
  for (const key of Object.keys(en)) {
    const a = en[key], b = ui[lang][key];
    if (typeof b !== 'string' || !b.trim()) continue;
    const ea = (a.match(LEAD) || [])[1];
    if (!ea) continue;
    const eb = (b.trim().match(LEAD) || [])[1];
    // Compare without U+FE0F: "🗣️" and "🗣" render identically, so a variation-selector-only
    // difference is not drift and must not produce a diff.
    const norm = (x) => String(x || '').replace(/\uFE0F/g, '');
    if (norm(eb) === norm(ea)) continue;
    const rest = eb ? b.trim().slice(eb.length).trim() : b.trim();
    set(lang, key, ea + ' ' + rest, eb ? `leading icon ${eb}→${ea}` : `leading icon ${ea} restored`);
  }
}

fs.writeFileSync(outFile, JSON.stringify(ui, null, 2));
console.log(log.join('\n'));
console.log(`\n${fixes} entries repaired → ${outFile}`);
