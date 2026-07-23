#!/usr/bin/env node
// translate-ui.js
// Fills missing translations in ui.json using the configured LLM backend.
// Usage:
//   node translate-ui.js                        # translate all missing keys in all languages
//   node translate-ui.js de fr ja               # translate only these languages
//   node translate-ui.js --exclude zh ko        # translate all except these
//   node translate-ui.js --model qwen2.5:14b    # override model (ignores OLLAMA_MODEL env var)
//   node translate-ui.js --check                # just report what's missing, don't translate
//   node translate-ui.js de --dry               # dry run for German
//   node translate-ui.js --qc                   # audit EXISTING translations against the English source
//   node translate-ui.js --qc --fix             # …and auto-repair what can be repaired safely
//   node translate-ui.js --qc --retranslate     # …and re-translate what cannot (needs the backend)
//   node translate-ui.js --qc de fr             # audit only these languages
//
// Reads OLLAMA_HOST, OLLAMA_MODEL, LLM_BACKEND from environment (same as server.js defaults).

'use strict';
const fs   = require('fs');
const path = require('path');
const { callLLM, ping, extractJSON } = require('./llm');
// Shared with the --qc auditor below: the writer and the auditor MUST apply the same rules, or a
// defect the auditor reports could still be written by the next run (and vice versa).
const { validateEntry, isBlocking, auditAll } = require('./ui-qc');

const UI_FILE   = path.join(__dirname, 'ui.json');
const LANG_FILE = path.join(__dirname, 'languages.json');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const OLLAMA_HOST  = process.env.OLLAMA_HOST  || 'http://localhost:11434';
const BATCH_SIZE   = parseInt(process.env.BATCH_SIZE || '10', 10);
const DRY_RUN      = process.argv.includes('--dry');
const CHECK_ONLY   = process.argv.includes('--check');
const QC_MODE      = process.argv.includes('--qc');
const QC_FIX       = process.argv.includes('--fix');
const QC_RETRANS   = process.argv.includes('--retranslate');

// Collect language codes from positional args; collect --exclude / --skip / --model values
const EXCLUDE_LANGS = new Set();
const INCLUDE_LANGS = [];
let _nextFlag = null;
let _modelOverride = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--exclude' || a === '--skip') { _nextFlag = 'exclude'; continue; }
  if (a === '--model')                     { _nextFlag = 'model';   continue; }
  if (a.startsWith('--')) { _nextFlag = null; continue; }
  if (_nextFlag === 'model') { _modelOverride = a; _nextFlag = null; continue; }
  if (/^[a-z]{2,3}$/.test(a)) {
    if (_nextFlag === 'exclude') EXCLUDE_LANGS.add(a);
    else INCLUDE_LANGS.push(a);
  } else { _nextFlag = null; }
}

const MODEL = _modelOverride || OLLAMA_MODEL;

// ── Load data ─────────────────────────────────────────────────────────────────
let ui, langs;
try { ui = JSON.parse(fs.readFileSync(UI_FILE, 'utf8')); }
catch(e) { console.error('Cannot read ui.json:', e.message); process.exit(1); }

try { langs = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8')); }
catch(e) { langs = {}; }

const en = ui['en'] || {};
// Which languages does the app OFFER? languages.json is the source of truth — the source language
// doubles as the UI language (index.html: `uiLang = APP.srcLang`), so every code there needs UI
// strings. Deriving this from Object.keys(ui) instead (as this script did until v53) made a
// language that is ENTIRELY absent from ui.json invisible to the pass that is supposed to fill it:
// it was never listed, never translated, and `--check` reported "all complete" while Swahili sat at
// 0/426 keys. Union with ui.json's keys so a stray entry there is still maintained.
const offeredLangs = Object.keys(langs).filter(l => !l.startsWith('_'));
const allLangs = [...new Set([...offeredLangs, ...Object.keys(ui)])].filter(l => l !== 'en');
const workLangs = (INCLUDE_LANGS.length ? INCLUDE_LANGS : allLangs)
  .filter(l => !EXCLUDE_LANGS.has(l));

// ── Report missing ────────────────────────────────────────────────────────────
console.log(`\n📋 ui.json status  (${Object.keys(en).length} English keys)\n${'─'.repeat(50)}`);
let totalMissing = 0;
const missingByLang = {};
for (const lang of workLangs) {
  const strings = ui[lang] || {};
  const missing = Object.keys(en).filter(k => !strings[k]);
  missingByLang[lang] = missing;
  totalMissing += missing.length;
  const langName = langs[lang]?.name || lang;
  if (missing.length === 0) {
    console.log(`  ✓ ${lang.padEnd(4)} ${langName.padEnd(20)} complete (${Object.keys(strings).length} keys)`);
  } else {
    console.log(`  ✗ ${lang.padEnd(4)} ${langName.padEnd(20)} ${missing.length} missing: ${missing.slice(0,4).join(', ')}${missing.length>4?` … +${missing.length-4} more`:''}`);
  }
}
console.log(`${'─'.repeat(50)}\nTotal missing: ${totalMissing} across ${workLangs.length} language(s)\n`);

// --qc runs even when nothing is missing: it audits the CONTENT of what is already there, which is
// exactly the case where the completeness report says "all complete" and the file is still wrong.
if (!QC_MODE && (CHECK_ONLY || totalMissing === 0)) {
  if (totalMissing === 0) console.log('✅ All translations complete!');
  process.exit(0);
}

if (!QC_MODE && DRY_RUN) {
  console.log('(dry run — not translating)');
  process.exit(0);
}

// ── Translate one language ────────────────────────────────────────────────────
async function translateLang(lang, missingKeys) {
  const langName = langs[lang]?.name || lang;
  console.log(`\n🌍 Translating ${langName} (${lang}) — ${missingKeys.length} missing key(s)`);
  if (!ui[lang]) ui[lang] = {};

  // Every rule here corresponds to a defect class observed in a real run (v69). The wording is
  // deliberately concrete — "preserve placeholders" was already in the old prompt and was ignored;
  // naming the failure ({word} → {woord}) is what makes it stick. The prompt is still only the
  // first line of defence: everything is verified after generation (see validateEntry below).
  const sys = `You are a UI translator for a mobile language-learning app. Translate the VALUES of \
the given JSON object into ${langName}. Return ONLY a valid JSON object with the SAME keys — no \
markdown, no explanation.

ABSOLUTE RULES:
1. NEVER translate text inside curly braces. {word}, {lang}, {n}, {title}, {pronoun}, {verb}, \
{solved}, {total} are code placeholders — copy each one character-for-character. Translating the \
NAME (e.g. {word} → {woord}) breaks the app: the user sees the literal text "{woord}" on screen. \
You may move a placeholder to fit ${langName} word order, but never rename, add or remove one.
2. If a value starts with an emoji, keep exactly that same emoji at the start. It is the app's icon \
for that concept.
3. Write ONLY in ${langName}. Never emit characters from another language's script.
4. Keep values short and natural for a small screen. Leave product names, file formats and \
technical tokens (Dreizunge, JSON, HTML, Markdown, PDF, IPA, URL) untranslated.`;

  let translated = 0;
  for (let i = 0; i < missingKeys.length; i += BATCH_SIZE) {
    const batch = missingKeys.slice(i, i + BATCH_SIZE);
    const batchObj = Object.fromEntries(batch.map(k => [k, en[k]]));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(missingKeys.length / BATCH_SIZE);
    process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} keys)… `);

    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await callLLM(MODEL, sys, JSON.stringify(batchObj, null, 2), 2048, { temperature: 0.1 });
        result = extractJSON(raw.text);
        break;
      } catch(e) {
        if (attempt === 3) { console.log(`FAILED: ${e.message}`); result = null; break; }
        process.stdout.write(`retry… `);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (result) {
      let count = 0, repairedN = 0, rejected = [];
      for (const [k, v] of Object.entries(result)) {
        if (!missingKeys.includes(k) || !v || typeof v !== 'string') continue;
        // VERIFY, don't trust. A rejected key simply stays missing, and a missing key falls back to
        // English at runtime — which is strictly better than writing text with a broken placeholder
        // that renders as literal "{woord}" and cannot fall back to anything.
        const { issues, repaired } = validateEntry(en[k], v, lang);
        if (repaired != null) {
          const after = validateEntry(en[k], repaired, lang);
          if (!isBlocking(after.issues)) { ui[lang][k] = repaired; count++; repairedN++; continue; }
        }
        if (isBlocking(issues)) { rejected.push(`${k} (${issues.filter(i => i.severity === 'error').map(i => i.code).join('/')})`); continue; }
        ui[lang][k] = v;
        count++;
      }
      translated += count;
      let msg = `✓ ${count} translated`;
      if (repairedN) msg += `, ${repairedN} auto-repaired`;
      if (rejected.length) msg += `, ${rejected.length} rejected → will retry`;
      console.log(msg);
      if (rejected.length) console.log(`      rejected: ${rejected.join('; ')}`);
    }

    // Save after each batch so progress isn't lost on interruption
    fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8');
  }

  // Report any still-missing after translation
  const stillMissing = missingKeys.filter(k => !ui[lang][k]);
  if (stillMissing.length) {
    console.log(`  ⚠ Still missing: ${stillMissing.join(', ')}`);
  } else {
    console.log(`  ✅ ${langName} complete (${translated} new translations)`);
  }
}

// ── QC mode ───────────────────────────────────────────────────────────────────
// Audits what is ALREADY in ui.json against the English source, using the same validateEntry the
// writer uses. Pure reporting by default — no backend needed, nothing written.
function runQC() {
  const scope = INCLUDE_LANGS.length ? new Set(INCLUDE_LANGS) : null;
  const view = scope ? { en } : ui;
  if (scope) for (const l of scope) if (ui[l]) view[l] = ui[l];

  const { findings, counts } = auditAll(view);
  const errors = findings.filter(f => f.severity === 'error');
  const warns  = findings.filter(f => f.severity === 'warn');
  const infos  = findings.filter(f => f.severity === 'info');

  const label = {
    'placeholder-renamed':   'placeholder NAMES translated (renders literally — app-breaking)',
    'placeholder-dropped':   'placeholder removed (the value it showed is lost)',
    'placeholder-invented':  'placeholder with no source (renders literally)',
    'foreign-script':        "another language's script bled into the text",
    'garbage-token':         'model artifact in the output',
    'icon-drift':            "leading icon changed (per-concept identity)",
    'untranslated':          'identical to English (often a legitimate loanword — review)',
    'missing':               'no translation at all',
    'empty':                 'empty value',
  };

  console.log(`\nQC of ${Object.keys(view).length - 1} language(s) against ${Object.keys(en).length} English keys\n`);
  for (const group of [errors, warns, infos]) {
    if (!group.length) continue;
    const byCode = {};
    group.forEach(f => (byCode[f.code] = byCode[f.code] || []).push(f));
    for (const [code, list] of Object.entries(byCode)) {
      const sev = list[0].severity === 'error' ? '❌' : list[0].severity === 'warn' ? '⚠ ' : 'ℹ ';
      console.log(`${sev} ${code} — ${label[code] || ''} (${list.length})`);
      // Info-level noise is summarised per language; real defects are listed individually.
      if (list[0].severity === 'info') {
        const per = {};
        list.forEach(f => per[f.lang] = (per[f.lang] || 0) + 1);
        console.log('     ' + Object.entries(per).sort((a, b) => b[1] - a[1])
          .map(([l, n]) => `${l}:${n}`).join('  '));
      } else {
        list.slice(0, 40).forEach(f => {
          console.log(`     [${f.lang}] ${f.key}${f.detail ? '  — ' + f.detail : ''}`);
          if (f.tr !== undefined) console.log(`         en: ${JSON.stringify(f.en)}`);
          if (f.tr !== undefined) console.log(`         tr: ${JSON.stringify(f.tr)}`);
        });
        if (list.length > 40) console.log(`     … and ${list.length - 40} more`);
      }
      console.log('');
    }
  }

  const fixable = findings.filter(f => f.repaired != null);
  const unfixable = errors.filter(f => f.repaired == null && f.code !== 'missing');

  if (!QC_FIX && !QC_RETRANS) {
    console.log(`${'─'.repeat(50)}`);
    console.log(`${errors.length} error(s), ${warns.length} warning(s), ${infos.length} note(s).`);
    if (fixable.length)   console.log(`${fixable.length} can be repaired automatically — re-run with --fix`);
    if (unfixable.length) console.log(`${unfixable.length} need re-translation — re-run with --qc --retranslate`);
    if (!errors.length && !warns.length) console.log('✅ No structural problems found.');
    return { errors, unfixable };
  }

  if (QC_FIX) {
    let n = 0;
    for (const f of fixable) { ui[f.lang][f.key] = f.repaired; n++; }
    if (n && !DRY_RUN) fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8');
    console.log(`${'─'.repeat(50)}`);
    console.log(`🔧 Repaired ${n} entr(ies)${DRY_RUN ? ' (dry run — not saved)' : ` → ${UI_FILE}`}`);
  }
  return { errors, unfixable };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (QC_MODE) {
    const { unfixable } = runQC();
    if (!QC_RETRANS) return;
    if (!unfixable.length) { console.log('Nothing left needing re-translation.'); return; }
    // Re-translation reuses the normal path: drop the defective values so they count as missing,
    // then translate them exactly like any other missing key (same prompt, same validation).
    console.log(`\n♻ Re-translating ${unfixable.length} unrepairable entr(ies)…`);
    const byLang = {};
    unfixable.forEach(f => (byLang[f.lang] = byLang[f.lang] || []).push(f.key));
    for (const [lang, keys] of Object.entries(byLang)) keys.forEach(k => delete ui[lang][k]);
    if (!DRY_RUN) fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8');
    const reachable = await ping();
    if (!reachable) { console.error(`❌ Cannot reach LLM backend at ${OLLAMA_HOST}.`); process.exit(1); }
    for (const [lang, keys] of Object.entries(byLang)) await translateLang(lang, keys);
    return;
  }

  console.log(`Using model: ${MODEL} @ ${OLLAMA_HOST}\n`);

  // Ping backend
  const reachable = await ping();
  if (!reachable) {
    console.error(`❌ Cannot reach LLM backend at ${OLLAMA_HOST}: not reachable`);
    console.error('   Start Ollama and try again, or set OLLAMA_HOST env var.');
    process.exit(1);
  }

  for (const lang of workLangs) {
    const missing = missingByLang[lang];
    if (!missing || missing.length === 0) continue;
    await translateLang(lang, missing);
  }

  // Final status
  console.log(`\n${'─'.repeat(50)}`);
  const remaining = workLangs.reduce((n, l) =>
    n + Object.keys(en).filter(k => !(ui[l]||{})[k]).length, 0);
  if (remaining === 0) {
    console.log('✅ All done! ui.json is fully translated.');
  } else {
    console.log(`⚠ ${remaining} key(s) still missing. Run again to retry.`);
  }
  console.log(`💾 Saved to ${UI_FILE}\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
