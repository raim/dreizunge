// unit-ui-qc.test.js
// v69_f — validation shared by translate-ui.js's WRITER and its --qc AUDITOR.
//
// Motivation: the v69 translation run filled every language (0 missing) and was still wrong — the
// model localised placeholder NAMES ({word}→{woord}), swapped per-concept icons, and bled other
// scripts into a few batches. A prompt could not prevent it (the old prompt already said "preserve
// placeholders"), so the fix is to VERIFY every generated value and to be able to re-audit a file
// afterwards. Writer and auditor share validateEntry so a defect can neither be written nor survive
// an audit.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { validateEntry, isBlocking, auditAll, leadIconOf, sameIcon } = require(path.join(ROOT, 'ui-qc.js'));

const codes = (r) => r.issues.map(i => i.code);

// ── 1. Placeholders ──────────────────────────────────────────────────────────
{
  // Clean pass-through.
  let r = validateEntry('Which article goes with "{word}"?', 'Welk artikel past bij "{word}"?', 'nl');
  assert.deepStrictEqual(codes(r), [], 'a correct translation raises nothing');
  assert.strictEqual(r.repaired, null, 'and needs no repair');

  // The actual v69 failure: name localised. Repairable, keeps the translation.
  r = validateEntry('Which article goes with "{word}"?', 'Welk artikel past bij "{woord}"?', 'nl');
  assert.ok(codes(r).includes('placeholder-renamed'), 'a localised placeholder name is flagged');
  assert.ok(isBlocking(r.issues), 'and it is blocking (would render literally)');
  assert.strictEqual(r.repaired, 'Welk artikel past bij "{word}"?', 'repaired in place, wording kept');

  // Multi-slot: positions must be preserved, not sorted.
  r = validateEntry('Type the form for "{pronoun}" + {verb}', 'Typ de vorm voor "{pronoom}" + {woord}', 'nl');
  assert.strictEqual(r.repaired, 'Typ de vorm voor "{pronoun}" + {verb}', 'multi-slot repair is positional');

  // Reordering is LEGITIMATE — t() substitutes by name, and other word orders need it.
  r = validateEntry('How do you say "{word}" in {lang}?', '{lang} dilinde "{word}" nasıl denir?', 'tr');
  assert.ok(!isBlocking(r.issues), 'reordered placeholders are not an error');
  assert.strictEqual(r.repaired, null, 'and are not "repaired"');

  // Dropped / invented change the sentence, so they are NOT auto-repaired: the caller rejects them
  // and the key stays missing, which falls back to English — better than broken output.
  r = validateEntry('{solved} of {total} solved', '{solved} gelöst', 'de');
  assert.ok(codes(r).includes('placeholder-dropped') && isBlocking(r.issues), 'a dropped slot is blocking');
  assert.strictEqual(r.repaired, null, 'a dropped slot is never guessed at');
  r = validateEntry('No lessons in this language.', 'Keine Lektionen in {lang}.', 'de');
  assert.ok(codes(r).includes('placeholder-invented') && isBlocking(r.issues), 'an invented slot is blocking');
  assert.strictEqual(r.repaired, null, 'an invented slot is never silently stripped');
}
console.log('  placeholders: rename repaired positionally, reorder allowed, drop/invent rejected: OK');

// ── 2. Leading icon ──────────────────────────────────────────────────────────
{
  let r = validateEntry('🔢 Mathematics', 'Mathe', 'de');
  assert.ok(codes(r).includes('icon-drift'), 'a dropped leading icon is flagged');
  assert.strictEqual(r.repaired, '🔢 Mathe', 'and restored');
  assert.ok(!isBlocking(r.issues), 'icon drift is a warning, not blocking');

  r = validateEntry('🔡 Teach the script', '📝 Insegna la scrittura', 'it');
  assert.strictEqual(r.repaired, '🔡 Insegna la scrittura', 'a swapped icon is replaced, text kept');

  // U+FE0F is invisible — must NOT count as drift.
  r = validateEntry('🗣 Voice', '🗣️ Stimme', 'de');
  assert.ok(!codes(r).includes('icon-drift'), 'a variation-selector-only difference is not drift');
  assert.ok(sameIcon('🗣', '🗣️'), 'sameIcon ignores U+FE0F');
  assert.strictEqual(leadIconOf('  🎯 Ziel'), '🎯', 'leading icon is read past whitespace');

  // No icon in the source → nothing enforced.
  r = validateEntry('Cancel', '❌ Abbrechen', 'de');
  assert.ok(!codes(r).includes('icon-drift'), 'an icon the translator ADDED is their choice');
}
console.log('  leading icon: restored when dropped/swapped, FE0F ignored, source-free left alone: OK');

// ── 3. Cross-script contamination ────────────────────────────────────────────
{
  let r = validateEntry('🎯 Build a learning arc', '🎯 建立学习弧线', 'fr');
  assert.ok(codes(r).includes('foreign-script') && isBlocking(r.issues), 'Chinese inside French is blocking');
  assert.strictEqual(r.repaired, null, 'contamination is never auto-repaired');

  // The real find in the shipped file: Cyrillic hiding inside Greek (visually identical letters).
  r = validateEntry('Pastel', 'Πα\u0441\u0442\u0435\u03bb', 'el');
  assert.ok(codes(r).includes('foreign-script'), 'Cyrillic disguised in Greek is caught');
  assert.deepStrictEqual(codes(validateEntry('Pastel', 'Παστέλ', 'el')), [], 'genuine Greek passes');

  // A language writing its OWN script is fine.
  assert.ok(!codes(validateEntry('Words', '単語', 'ja')).includes('foreign-script'), 'Japanese may use kanji');
  assert.ok(!codes(validateEntry('Words', '단어', 'ko')).includes('foreign-script'), 'Korean may use Hangul');
  assert.ok(!codes(validateEntry('Words', 'Слова', 'ru')).includes('foreign-script'), 'Russian may use Cyrillic');

  // Script already present in the SOURCE is intended everywhere (e.g. "ふ Show furigana").
  assert.ok(!codes(validateEntry('ふ Show furigana', 'ふ Furigana anzeigen', 'de')).includes('foreign-script'),
    'kana kept from the English source is not contamination');
}
console.log('  cross-script: foreign bleed caught incl. Cyrillic-in-Greek, own script + source script allowed: OK');

// ── 4. Garbage, empty, untranslated ──────────────────────────────────────────
{
  assert.ok(isBlocking(validateEntry('Learn the script', 'almart Skrivsystem', 'sv').issues), 'model artifact is blocking');
  assert.ok(isBlocking(validateEntry('Anything', '', 'de').issues), 'an empty value is blocking');
  const r = validateEntry('Markdown', 'Markdown', 'de');
  assert.deepStrictEqual(codes(r), ['untranslated'], 'identical-to-English is reported…');
  assert.ok(!isBlocking(r.issues), '…but not blocking (many are legitimate loanwords)');
  assert.deepStrictEqual(codes(validateEntry('OK', 'OK', 'de')), [], 'short symbols are not reported');
}
console.log('  garbage/empty blocking, untranslated reported but not blocking: OK');

// ── 5. auditAll over a whole file ────────────────────────────────────────────
{
  const ui = {
    en: { a: 'Hi {name}', b: '🔢 Math', c: 'Keep' },
    de: { a: 'Hallo {name}', b: '🔢 Mathe', c: 'Behalten' },
    fr: { a: 'Salut {nom}', b: 'Maths', /* c missing */ },
  };
  const { findings, counts } = auditAll(ui);
  const f = (lang, code) => findings.some(x => x.lang === lang && x.code === code);
  assert.ok(f('fr', 'placeholder-renamed'), 'audit finds the renamed placeholder');
  assert.ok(f('fr', 'icon-drift'), 'audit finds the icon drift');
  assert.ok(f('fr', 'missing'), 'audit finds the missing key');
  assert.ok(!findings.some(x => x.lang === 'de'), 'a clean language yields no findings');
  assert.strictEqual(counts.missing, 1, 'counts are tallied per code');
  // auditAll must not mutate the input.
  assert.strictEqual(ui.fr.a, 'Salut {nom}', 'auditAll is read-only');
}
console.log('  auditAll: per-language findings, counts, read-only: OK');

// ── 6. The tool is wired into translate-ui.js (writer + auditor share the rules) ──
{
  const src = fs.readFileSync(path.join(ROOT, 'translate-ui.js'), 'utf8');
  assert.ok(/require\('\.\/ui-qc'\)/.test(src), 'translate-ui imports the shared validator');
  assert.ok(/const { issues, repaired } = validateEntry\(en\[k\], v, lang\);/.test(src),
    'every generated value is validated before it is written');
  assert.ok(/if \(isBlocking\(issues\)\) \{ rejected\.push/.test(src),
    'a blocking defect is REJECTED, not written (missing falls back to English; broken cannot)');
  assert.ok(/const QC_MODE\s+= process\.argv\.includes\('--qc'\);/.test(src), '--qc flag exists');
  assert.ok(/const QC_FIX\s+= process\.argv\.includes\('--fix'\);/.test(src), '--fix flag exists');
  assert.ok(/const QC_RETRANS\s+= process\.argv\.includes\('--retranslate'\);/.test(src), '--retranslate flag exists');
  assert.ok(/if \(!QC_MODE && \(CHECK_ONLY \|\| totalMissing === 0\)\)/.test(src),
    '--qc still runs when nothing is missing — that is exactly when content defects hide');
  // The prompt must name the failure mode concretely; "preserve placeholders" alone was ignored.
  assert.ok(/NEVER translate text inside curly braces/.test(src), 'prompt forbids translating placeholders');
  assert.ok(/\{word\} → \{woord\}/.test(src), 'prompt shows the concrete failure it must avoid');
  assert.ok(/keep exactly that same emoji at the start/.test(src), 'prompt pins the leading icon');
  assert.ok(/Never emit characters from another language's script/.test(src), 'prompt forbids script bleed');
}
console.log('  translate-ui: validated writes, reject-not-write, --qc/--fix/--retranslate, hardened prompt: OK');

// ── 7. The shipped ui.json is clean ──────────────────────────────────────────
{
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const { findings } = auditAll(ui);
  // 'missing' is completeness, which `translate-ui.js --check` already tracks and which falls back
  // to English at runtime; this assertion is about CONTENT defects that cannot fall back to
  // anything. (New English keys legitimately land here before the next translation run.)
  const blocking = findings.filter(x => x.severity === 'error' && x.code !== 'missing');
  assert.strictEqual(blocking.length, 0,
    'shipped ui.json has no blocking defects:\n' + blocking.slice(0, 10)
      .map(x => `  [${x.lang}] ${x.key} — ${x.code} ${x.detail || ''}`).join('\n'));
  const warns = findings.filter(x => x.severity === 'warn');
  assert.strictEqual(warns.length, 0, 'and no icon drift');
}
console.log('  shipped ui.json: 0 blocking defects, 0 icon drift: OK');

console.log('unit-ui-qc: ALL PASSED');
