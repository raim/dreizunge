#!/usr/bin/env node
'use strict';
// qc-lessons.js  (v42)
// Quality-check generated lessons with a translation model (e.g. translategemma)
// via Ollama. For every vocab/sentence pair it asks whether the source gloss is a
// correct translation of the target term; flags mismatches and, with --fix, replaces
// the gloss with the model's correction. Optionally screens stories for errors.
//
// The check uses a plain "OK / corrected-text" protocol rather than JSON, because
// translation-focused models are weak at strict JSON.
//
// Requires: Ollama running with the chosen model.
//
// Usage:
//   node qc-lessons.js --file export.import.json
//   node qc-lessons.js --file lessons.json --model translategemma --fix --out fixed.json
//   node qc-lessons.js --file export.json --check-stories --limit 50
//
// Options:
//   --file FILE          lessons.json-format file to check                 [required]
//   --model NAME         Ollama model              [default: translategemma]
//   --ollama-url URL     [default: http://localhost:11434 or OLLAMA_HOST]
//   --fix                replace incorrect source glosses with the model's correction
//   --out FILE           where to write the corrected file (with --fix) [default: <file>.fixed.json]
//   --report FILE        write the full JSON report here          [default: <file>.qc.json]
//   --check-stories      also screen each story for language errors (slower, advisory)
//   --limit N            check at most N pairs (quick sampling)
//   --verbose
//
const http = require('http'); const https = require('https');
const fs = require('fs'); const path = require('path');

const args = process.argv.slice(2);
const getFlag = (n,al=[]) => { for (const k of [n,...al]){ const i=args.indexOf(k); if(i>=0) return args[i+1]; } return undefined; };
const hasFlag = (n,al=[]) => [n,...al].some(k=>args.includes(k));

const FILE       = getFlag('--file');
const MODEL      = getFlag('--model') || 'translategemma';
const OLLAMA_URL = getFlag('--ollama-url') || process.env.OLLAMA_HOST || 'http://localhost:11434';
const FIX        = hasFlag('--fix');
const CHECK_STORIES = hasFlag('--check-stories');
const LIMIT      = parseInt(getFlag('--limit') || '0', 10);
const VERBOSE    = hasFlag('--verbose', ['-v']);
if (!FILE) { console.error('Usage: node qc-lessons.js --file FILE.json [--model translategemma] [--fix] [--check-stories]'); process.exit(1); }

const OUT_FILE    = getFlag('--out')    || FILE.replace(/\.json$/,'') + '.fixed.json';
const REPORT_FILE = getFlag('--report') || FILE.replace(/\.json$/,'') + '.qc.json';

let LANGS_DATA = {};
try { LANGS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname,'languages.json'),'utf8')); } catch(_){}
const langName = c => (LANGS_DATA[c]?.name || c);

const KANJI='\\u4e00-\\u9fff\\u3400-\\u4dbf々〆〇';
const stripFuri = t => !t ? '' : String(t)
  .replace(new RegExp('([^'+KANJI+'])\\[[^\\]]+\\]','g'),'$1')
  .replace(new RegExp('(['+KANJI+']+)\\[([^\\]]+)\\]','g'),'$1');

const store = JSON.parse(fs.readFileSync(FILE,'utf8'));
const topics = store.topics || store.lessons || [];

// ── Ollama chat (cached) ──
const _cache = new Map();
function ollamaChat(system, user, numPredict) {
  const key = system + '\u0000' + user;
  if (_cache.has(key)) return Promise.resolve(_cache.get(key));
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_URL); const lib = u.protocol==='https:'?https:http;
    const payload = JSON.stringify({ model: MODEL, stream:false, keep_alive:-1,
      options:{ temperature:0, num_predict: numPredict||128 },
      messages:[{role:'system',content:system},{role:'user',content:user}] });
    const req = lib.request({ hostname:u.hostname, port:u.port||11434, path:u.pathname, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)} }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { const p=JSON.parse(d); if(p.error) return reject(new Error(p.error));
        const txt=(p.message?.content||p.response||'').trim(); _cache.set(key,txt); resolve(txt); } catch(e){ reject(new Error('Ollama parse: '+e.message)); } });
    });
    req.on('error',e=>reject(new Error('Ollama: '+e.message))); req.setTimeout(120000,()=>{req.destroy();reject(new Error('Ollama timeout'));});
    req.write(payload); req.end();
  });
}

// Returns { ok:true } or { ok:false, correction:'...' }
async function checkPair(target, source, lang, srcLang) {
  const L = langName(lang), S = langName(srcLang||'en');
  const system = `You verify translations. The user gives a ${L} term and a proposed ${S} translation, separated by " => ". `
    + `If the ${S} translation is correct and natural, reply with exactly "OK". `
    + `If it is wrong, reply ONLY with the corrected ${S} translation — no quotes, no commentary.`;
  const user = `${stripFuri(target)} => ${source}`;
  const reply = (await ollamaChat(system, user, 64)).trim();
  if (/^ok[.!]?$/i.test(reply) || reply === '') return { ok: true };
  // Guard against the model echoing the same text back.
  if (reply.trim().toLowerCase() === String(source).trim().toLowerCase()) return { ok: true };
  return { ok: false, correction: reply.replace(/^["']|["']$/g,'').trim() };
}

async function checkStory(story, lang) {
  const L = langName(lang);
  const system = `You are a ${L} proofreader. If the ${L} text is grammatically correct and natural, reply exactly "OK". `
    + `Otherwise reply with a one-line summary of the main error(s).`;
  const reply = (await ollamaChat(system, stripFuri(story).slice(0,2000), 120)).trim();
  return /^ok[.!]?$/i.test(reply) ? { ok:true } : { ok:false, note: reply };
}

async function main() {
  const report = { file: FILE, model: MODEL, checkedAt: new Date().toISOString(),
    pairsChecked: 0, pairsBad: 0, storiesChecked: 0, storiesFlagged: 0, issues: [] };
  let budget = LIMIT > 0 ? LIMIT : Infinity;

  for (const t of topics) {
    const lang = t.lang || 'en', srcLang = t.srcLang || 'en';
    for (const ls of (t.lessons || [])) {
      const lists = [['vocab', ls.vocab], ['sentences', ls.sentences]];
      for (const [kind, arr] of lists) {
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (budget <= 0) break;
          if (!item || !item.target || !item.source) continue;
          budget--; report.pairsChecked++;
          let res;
          try { res = await checkPair(item.target, item.source, lang, srcLang); }
          catch(e) { if (VERBOSE) console.warn(`  check error: ${e.message}`); continue; }
          if (!res.ok) {
            report.pairsBad++;
            report.issues.push({ topic: t.topic, id: t.id, kind, target: item.target, source: item.source, suggested: res.correction });
            if (VERBOSE) console.log(`  ✗ [${t.topic}] "${stripFuri(item.target)}" : "${item.source}" → "${res.correction}"`);
            if (FIX) item.source = res.correction;
          }
        }
      }
    }
    if (CHECK_STORIES && t.story) {
      report.storiesChecked++;
      try { const s = await checkStory(t.story, lang);
        if (!s.ok) { report.storiesFlagged++; report.issues.push({ topic: t.topic, id: t.id, kind:'story', note: s.note });
          if (VERBOSE) console.log(`  ⚠ story [${t.topic}]: ${s.note}`); }
      } catch(e){ if (VERBOSE) console.warn(`  story check error: ${e.message}`); }
    }
    if (budget <= 0) break;
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  if (FIX) { fs.writeFileSync(OUT_FILE, JSON.stringify(store, null, 2), 'utf8'); }

  console.log(`\nQC complete (model: ${MODEL})`);
  console.log(`  pairs checked : ${report.pairsChecked}`);
  console.log(`  pairs flagged : ${report.pairsBad}`);
  if (CHECK_STORIES) console.log(`  stories flagged: ${report.storiesFlagged}/${report.storiesChecked}`);
  console.log(`  report        : ${REPORT_FILE}`);
  if (FIX) console.log(`  corrected file: ${OUT_FILE}`);
  else if (report.pairsBad) console.log(`  (re-run with --fix to apply the ${report.pairsBad} suggested correction(s))`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
