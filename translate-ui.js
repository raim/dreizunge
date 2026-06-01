#!/usr/bin/env node
// translate-ui.js
// Fills missing translations in ui.json using the configured Ollama model.
// Usage:
//   node translate-ui.js                    # translate all missing keys in all languages
//   node translate-ui.js de fr              # translate only German and French
//   node translate-ui.js --check            # just report what's missing, don't translate
//   node translate-ui.js --lang de --dry    # dry run for German
//
// Reads OLLAMA_HOST and OLLAMA_MODEL from environment (same as server.js defaults).

'use strict';
const fs   = require('fs');
const http = require('http');
const https= require('https');
const path = require('path');

const UI_FILE   = path.join(__dirname, 'ui.json');
const LANG_FILE = path.join(__dirname, 'languages.json');
const OLLAMA_HOST  = process.env.OLLAMA_HOST  || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const BATCH_SIZE   = parseInt(process.env.BATCH_SIZE || '10', 10);
const DRY_RUN      = process.argv.includes('--dry');
const CHECK_ONLY   = process.argv.includes('--check');
const TARGET_LANGS = process.argv
  .filter(a => !a.startsWith('--') && a !== process.argv[0] && a !== process.argv[1])
  .filter(a => /^[a-z]{2,3}$/.test(a));

// ── Load data ─────────────────────────────────────────────────────────────────
let ui, langs;
try { ui = JSON.parse(fs.readFileSync(UI_FILE, 'utf8')); }
catch(e) { console.error('Cannot read ui.json:', e.message); process.exit(1); }

try { langs = JSON.parse(fs.readFileSync(LANG_FILE, 'utf8')); }
catch(e) { langs = {}; }

const en = ui['en'] || {};
const allLangs = Object.keys(ui).filter(l => l !== 'en');
const workLangs = TARGET_LANGS.length ? TARGET_LANGS : allLangs;

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

if (CHECK_ONLY || totalMissing === 0) {
  if (totalMissing === 0) console.log('✅ All translations complete!');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('(dry run — not translating)');
  process.exit(0);
}

// ── Ollama call ───────────────────────────────────────────────────────────────
function callOllama(system, userMsg) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model: OLLAMA_MODEL, stream: false, keep_alive: -1,
      options: { temperature: 0.1, num_predict: 2048 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }]
    });
    const req = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return reject(new Error('Ollama: ' + p.error));
          resolve(p.message?.content || p.response || '');
        } catch(e) { reject(new Error('Ollama parse: ' + e.message)); }
      });
    });
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.on('error', e => reject(new Error('Ollama: ' + e.message)));
    req.write(body); req.end();
  });
}

function extractJSON(raw) {
  const s = raw.replace(/```json|```/g, '').trim();
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object found in: ' + s.slice(0, 80));
  return JSON.parse(s.slice(start, end + 1));
}

// ── Translate one language ────────────────────────────────────────────────────
async function translateLang(lang, missingKeys) {
  const langName = langs[lang]?.name || lang;
  console.log(`\n🌍 Translating ${langName} (${lang}) — ${missingKeys.length} missing key(s)`);
  if (!ui[lang]) ui[lang] = {};

  const sys = `You are a UI translator. Translate the values of the given JSON object into ${langName}. \
Rules: preserve ALL {placeholder} tokens exactly as-is (e.g. {lang}, {n}, {topic}, {word}, {pronoun}, {verb}). Preserve icons.\
Keep translations short and natural for a mobile language-learning app. \
Return ONLY a valid JSON object with the same keys, no markdown, no explanation.`;

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
        const raw = await callOllama(sys, JSON.stringify(batchObj, null, 2));
        result = extractJSON(raw);
        break;
      } catch(e) {
        if (attempt === 3) { console.log(`FAILED: ${e.message}`); result = null; break; }
        process.stdout.write(`retry… `);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (result) {
      let count = 0;
      for (const [k, v] of Object.entries(result)) {
        if (missingKeys.includes(k) && v && typeof v === 'string') {
          ui[lang][k] = v;
          count++;
        }
      }
      translated += count;
      console.log(`✓ ${count} translated`);
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Using model: ${OLLAMA_MODEL} @ ${OLLAMA_HOST}\n`);

  // Ping Ollama
  try {
    await callOllama('Reply with OK.', 'OK?');
  } catch(e) {
    console.error(`❌ Cannot reach Ollama at ${OLLAMA_HOST}: ${e.message}`);
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
