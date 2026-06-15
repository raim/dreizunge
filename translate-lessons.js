#!/usr/bin/env node
'use strict';
// translate-lessons.js  (v42)
// Take an exported storyline / lessonset as a TEMPLATE and reproduce it in other
// language pairs by translating each chapter's story, then letting the Dreizunge
// server build the lessons for the new target language. The storyline structure
// (chapter order + chains) is preserved.
//
// Why "translate the story, then rebuild lessons" rather than translating the
// vocab/sentence pairs directly: grammar/gender/conjugation/synonym lessons are
// target-language-specific and cannot be mapped word-for-word to another language.
// Regenerating from the translated story yields correct lessons for ANY format.
//
// Requires: server.js running (lesson building) AND Ollama running (translation).
//
// Usage:
//   node translate-lessons.js --template export.json --langs fr,es,ja --src-langs en
//   node translate-lessons.js --template export.json --langs de --model translategemma
//
// Options:
//   --template FILE        exported lessons.json-format file (storylines + topics)   [required]
//   --langs a,b,c          target languages to translate INTO                        [required]
//   --src-langs a,b,c      learner source languages (glosses)            [default: en]
//   --format FMT           lesson format for the rebuilt lessons     [default: from template, else standard]
//   --difficulty 1|2|3     [default: from template, else 2]
//   --model NAME           Ollama translation model                  [default: translategemma]
//   --ollama-url URL       [default: http://localhost:11434 or OLLAMA_HOST]
//   --server-url URL       Dreizunge server [default: http://localhost:3000 or SERVER_URL]
//   --tag TAG              storyline tag applied in Dreizunge         [default: translated]
//   --output FILE.import.json   [default: derived from template name]
//   --resume FILE.jsonl    skip pairs already completed
//   --dry-run              plan pairs + chapters, no translation/generation
//   --verbose
//
const http = require('http'); const https = require('https');
const fs = require('fs'); const path = require('path');

const args = process.argv.slice(2);
const getFlag = (n, al=[]) => { for (const k of [n,...al]){ const i=args.indexOf(k); if(i>=0) return args[i+1]; } return undefined; };
const hasFlag = (n, al=[]) => [n,...al].some(k => args.includes(k));

const TEMPLATE   = getFlag('--template');
const LANGS_ARG  = getFlag('--langs');
const SRC_ARG    = getFlag('--src-langs') || 'en';
const FORMAT_ARG = getFlag('--format');
const DIFF_ARG   = getFlag('--difficulty');
const MODEL      = getFlag('--model') || 'translategemma';
const OLLAMA_URL = getFlag('--ollama-url') || process.env.OLLAMA_HOST || 'http://localhost:11434';
const SERVER_URL = getFlag('--server-url') || process.env.SERVER_URL || 'http://localhost:3000';
const TAG        = getFlag('--tag') || 'translated';
const RESUME     = getFlag('--resume');
const DRY_RUN    = hasFlag('--dry-run', ['--dry']);
const VERBOSE    = hasFlag('--verbose', ['-v']);
const POLL_MS = 2000, JOB_TIMEOUT = 10*60*1000;

if (!TEMPLATE || !LANGS_ARG) {
  console.error('Usage: node translate-lessons.js --template FILE.json --langs fr,es,ja [--src-langs en] [--model translategemma]');
  process.exit(1);
}

let LANGS_DATA = {};
try { LANGS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'languages.json'),'utf8')); } catch(_) {}
const langName = c => (LANGS_DATA[c]?.name || c);

const tpl = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
const tplTopics = tpl.topics || tpl.lessons || [];
const tplStorylines = tpl.storylines || [];
if (!tplTopics.length) { console.error('Template has no topics.'); process.exit(1); }
const tplLang = tplTopics[0].lang || 'en';                       // template target language (stories are in this)
const FORMAT  = FORMAT_ARG || tpl.lessonFormat || tplTopics[0].lessonFormat || 'standard';
const DIFFICULTY = parseInt(DIFF_ARG || tplTopics[0].difficulty || '2', 10);

const targetLangs = LANGS_ARG.split(',').map(s=>s.trim()).filter(Boolean);
const srcLangs     = SRC_ARG.split(',').map(s=>s.trim()).filter(Boolean);

const baseName = path.basename(TEMPLATE).replace(/\.(import\.)?json$/,'');
const OUTPUT_FILE = getFlag('--output') || `translated-${baseName}.import.json`;
const JSONL_FILE  = OUTPUT_FILE.replace(/\.(import\.)?json$/,'') + '.jsonl';

// ── HTTP helpers ──
function httpReq(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr); const lib = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const req = lib.request({ hostname:u.hostname, port:u.port||(u.protocol==='https:'?443:80), path:u.pathname+u.search, method,
      headers: { 'Content-Type':'application/json', ...(data?{'Content-Length':Buffer.byteLength(data)}:{}) } }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ let p; try{p=JSON.parse(d);}catch(_){p=d;} resolve({status:res.statusCode, body:p}); });
    });
    req.on('error',reject); req.setTimeout(JOB_TIMEOUT,()=>{req.destroy();reject(new Error('timeout'));});
    if (data) req.write(data); req.end();
  });
}
// ── Ollama translation (mirrors llm.js /api/chat) with a per-string cache ──
const _tCache = new Map();
async function ollamaTranslate(text, fromLang, toLang) {
  text = (text==null?'':String(text)).trim();
  if (!text) return '';
  const key = `${fromLang}>${toLang}:${text}`;
  if (_tCache.has(key)) return _tCache.get(key);
  const system = `You are a professional translator. Translate the user's text from ${langName(fromLang)} to ${langName(toLang)}. Output ONLY the translation — no quotes, no notes, no explanation. Preserve meaning, tone, and any furigana annotations in [brackets].`;
  const out = await new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_URL); const lib = u.protocol==='https:'?https:http;
    const payload = JSON.stringify({ model: MODEL, stream:false, keep_alive:-1,
      options:{ temperature:0.1, num_predict: Math.max(256, Math.ceil(text.length*1.5)) },
      messages:[{role:'system',content:system},{role:'user',content:text}] });
    const req = lib.request({ hostname:u.hostname, port:u.port||11434, path:u.pathname, method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)} }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try { const p=JSON.parse(d); if(p.error) return reject(new Error(p.error));
        resolve((p.message?.content||p.response||'').trim()); } catch(e){ reject(new Error('Ollama parse: '+e.message)); } });
    });
    req.on('error',e=>reject(new Error('Ollama: '+e.message))); req.setTimeout(JOB_TIMEOUT,()=>{req.destroy();reject(new Error('Ollama timeout'));});
    req.write(payload); req.end();
  });
  _tCache.set(key, out); return out;
}
async function pollJob(jobId) {
  const t0=Date.now();
  while (Date.now()-t0 < JOB_TIMEOUT) {
    const { body } = await httpReq('GET', `${SERVER_URL}/api/job/${jobId}`);
    if (body.status==='done')  return { ok:true,  data: body.data };
    if (body.status==='error') return { ok:false, error: body.error || 'job error' };
    await new Promise(r=>setTimeout(r, POLL_MS));
  }
  return { ok:false, error:'job timeout' };
}
// The /api/generate job response does NOT carry the new topic's stable id, AND the
// server's meta step renames/translates the topic name (into the source language), so we
// cannot match by the title we sent. Resolve from authoritative state instead: among
// topics for this lang+srcLang, prefer the one chained to parentId (chapters 2+), else the
// newest (the chapter we just created — the server unshifts new topics to the front).
async function resolveTopicId(lang, srcLang, parentId) {
  try {
    const { body } = await httpReq('GET', `${SERVER_URL}/api/lessons`);
    const topics = Array.isArray(body) ? body : [];
    const pool = topics.filter(t => t.lang===lang && (t.srcLang||'')===(srcLang||''));
    if (!pool.length) return null;
    if (parentId) { const chained = pool.find(t => t.continuedFromId===parentId); if (chained) return chained.id; }
    return pool[0].id || null;   // newest first
  } catch(_) { return null; }
}

// ── resume tracking ──
const donePairs = new Set();
if (RESUME && fs.existsSync(RESUME)) {
  for (const line of fs.readFileSync(RESUME,'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const r=JSON.parse(line); if (r.status==='ok') donePairs.add(`${r.lang}:${r.srcLang}`); } catch(_){}
  }
}
function appendJsonl(rec){ fs.appendFileSync(JSONL_FILE, JSON.stringify(rec)+'\n','utf8'); }

// Order template topics per storyline (chapters in order), then any leftover topics.
const byId = new Map(tplTopics.map(t=>[t.id,t]));
function orderedUnits() {
  const units = []; const used = new Set();
  for (const sl of tplStorylines) {
    const chapters = (sl.chapters||[]).map(id=>byId.get(id)).filter(Boolean);
    chapters.forEach(c=>used.add(c.id));
    if (chapters.length) units.push({ storyline: sl, chapters });
  }
  const leftover = tplTopics.filter(t=>!used.has(t.id));
  for (const t of leftover) units.push({ storyline:null, chapters:[t] });
  return units;
}

async function main() {
  // Verify Dreizunge server (skip in dry-run)
  if (!DRY_RUN) {
    try { const { body } = await httpReq('GET', `${SERVER_URL}/api/info`);
      if (!body.canGenerate) { console.error('❌ Server has no LLM backend.'); process.exit(1); }
      console.log(`✓ Server: ${body.backend}/${body.ollamaModel} · translator: ${MODEL} @ ${OLLAMA_URL}`);
    } catch(e){ console.error(`❌ Cannot reach server at ${SERVER_URL}: ${e.message}`); process.exit(1); }
  }
  const units = orderedUnits();
  const pairs = [];
  for (const B of targetLangs) for (const C of srcLangs) {
    if (B === tplLang && C === (tplTopics[0].srcLang||'en')) continue; // identical to template
    if (B === C) continue;
    pairs.push({ lang:B, srcLang:C });
  }
  console.log(`Template: "${TEMPLATE}" (${tplLang}) · ${units.length} unit(s), ${tplTopics.length} chapter(s)`);
  console.log(`Pairs to translate: ${pairs.length}  → ${OUTPUT_FILE}\n`);
  if (DRY_RUN) {
    for (const p of pairs) console.log(`  ${p.lang}←${p.srcLang}  (${tplTopics.length} chapters)`);
    return;
  }

  let ok=0, failed=0;
  const totalChapters = pairs.length * tplTopics.length;
  let doneChapters = 0;
  for (const { lang, srcLang } of pairs) {
    if (donePairs.has(`${lang}:${srcLang}`)) { console.log(`  ${lang}←${srcLang}  skip (resumed)`); doneChapters += tplTopics.length; continue; }
    const started = new Date().toISOString(); const t0=Date.now();
    let pairOk = true, chapters = 0;
    try {
      for (const unit of units) {
        const slName = unit.storyline ? (unit.storyline.title || 'storyline') : (unit.chapters[0]?.topic || 'topic');
        const nCh = unit.chapters.length;
        let prevId = null, idx = 0;
        for (const ch of unit.chapters) {
          idx++;
          const title = await ollamaTranslate(ch.topic, tplLang, lang);
          const story = await ollamaTranslate(ch.story || '', tplLang, lang);
          const { status, body } = await httpReq('POST', `${SERVER_URL}/api/generate`, {
            topic: title || ch.topic, lang, srcLang, difficulty: DIFFICULTY, storyLen: ch.storyLen || 200,
            lessonFormat: FORMAT, storyStyle: ch.storyStyle || 'neutral',
            userStory: story, userStoryLang: 'target',
            continuedFrom: prevId || undefined,   // stable id → server chains + auto-builds storyline
          });
          if (status === 503) throw new Error('server offline');
          let saved;
          if (status === 200 && body.cached) saved = body.data;
          else if (status === 202) { const r = await pollJob(body.jobId); if (!r.ok) throw new Error(r.error); saved = r.data; }
          else throw new Error(`status ${status}: ${body.error||''}`);
          // Resolve the real topic id so the NEXT chapter chains to it (and the storyline forms now).
          prevId = saved.id || await resolveTopicId(lang, srcLang, prevId);
          if (!prevId) console.warn(`    ⚠ could not resolve id for "${ch.topic}" — chain may break here`);
          chapters++; doneChapters++;
          console.log(`  [${lang}←${srcLang}] ${slName}: chapter ${idx}/${nCh} "${ch.topic}" ✓   (overall ${doneChapters}/${totalChapters})`);
        }
        if (nCh > 1) console.log(`  [${lang}←${srcLang}] ✓ storyline "${slName}" complete — ${nCh} chapters linked`);
      }
      ok++;
    } catch(e) { pairOk=false; failed++; console.log(`  ${lang}←${srcLang}  FAILED: ${e.message}`); }
    appendJsonl({ template: TEMPLATE, lang, srcLang, templateLang: tplLang, startedAt: started,
      durationMs: Date.now()-t0, status: pairOk?'ok':'failed', chapters });
    if (pairOk) console.log(`  ${lang}←${srcLang}  pair done (${chapters} chapters, ${((Date.now()-t0)/1000).toFixed(1)}s)`);
  }

  // Tag freshly-translated storylines + rebuild import from server's authoritative state.
  try {
    const { body: allTopics } = await httpReq('GET', `${SERVER_URL}/api/lessons`);
    const { body: allSls }    = await httpReq('GET', `${SERVER_URL}/api/storylines`);
    const wantLangs = new Set(targetLangs);
    const topics = (Array.isArray(allTopics)?allTopics:[]).filter(t => wantLangs.has(t.lang));
    const ourIds = new Set(topics.map(t=>t.id));
    const storylines = (Array.isArray(allSls)?allSls:[]).filter(sl => (sl.chapters||[]).some(id=>ourIds.has(id)));
    for (const sl of storylines) {
      const tags = Array.isArray(sl.tags)?sl.tags:[];
      if (!tags.includes(TAG)) await httpReq('POST', `${SERVER_URL}/api/storylines`, { slId: sl.id, tags: [...tags, TAG] });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ schemaVersion:29, topics, storylines }, null, 2), 'utf8');
    console.log(`\n✅ Done. ok:${ok} failed:${failed}`);
    console.log(`   Import: ${OUTPUT_FILE} (${topics.length} topics, ${storylines.length} storylines)`);
    console.log(`   Log:    ${JSONL_FILE}`);
  } catch(e) { console.warn(`  ⚠ Could not rebuild import file: ${e.message}`); }
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
