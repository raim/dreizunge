#!/usr/bin/env node
'use strict';

const http  = require('http');
const { execFile } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Prompts (hot-reloaded from prompts.json) ──────────────────────────────────
let PROMPTS = {};
function loadPrompts() {
  try {
    PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));
    console.log('  Prompts loaded from prompts.json');
  } catch(e) { console.error('  Failed to load prompts.json:', e.message); }
}
loadPrompts();
try {
  fs.watch(path.join(__dirname, 'prompts.json'), () => {
    setTimeout(() => { loadPrompts(); console.log('  prompts.json reloaded'); }, 100);
  });
} catch(_) {}

// Fill {placeholder} variables in a prompt template string
function fillPrompt(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '{'+k+'}'));
}
const crypto = require('crypto');

const PORT         = parseInt(process.env.PORT || '3000', 10);
const STORAGE_FILE = path.join(__dirname, 'lessons.json');
const UI_FILE     = path.join(__dirname, 'ui.json');
const BACKEND      = (process.env.LLM_BACKEND || 'auto').toLowerCase();
const OLLAMA_HOST    = process.env.OLLAMA_HOST    || 'http://localhost:11434';
const OLLAMA_MODEL        = process.env.OLLAMA_MODEL        || 'qwen2.5:7b';
const OLLAMA_TRANSLATION_MODEL = process.env.OLLAMA_TRANSLATION_MODEL || OLLAMA_MODEL;
const OLLAMA_LESSON_MODEL = process.env.OLLAMA_LESSON_MODEL || OLLAMA_MODEL;
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '720000', 10);
// Lesson output format: 'json' (default) or 'table' (markdown table, better for
// translation-focused models that struggle with strict JSON schemas).
// Auto-enabled when OLLAMA_LESSON_MODEL contains 'translategemma', overridable via env.
const OLLAMA_LESSON_FORMAT = process.env.OLLAMA_LESSON_FORMAT ||
  (OLLAMA_LESSON_MODEL.toLowerCase().includes('translategemma') ? 'table' : 'json');
const OLLAMA_MAX_PREV_STORY = parseInt(process.env.OLLAMA_MAX_PREV_STORY || '800', 10);

// ── Storage ───────────────────────────────────────────────────────────
function loadStore() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      // v29 schema: { schemaVersion:29, storylines:[], topics:[], flags:{} }
      if (data && data.schemaVersion >= 29 && Array.isArray(data.topics)) {
        return { schemaVersion: 29, topics: data.topics, storylines: data.storylines || [], flags: data.flags || {} };
      }
      // Legacy: { lessons:[] } or bare array
      if (Array.isArray(data)) return { schemaVersion: 0, topics: data, storylines: [], flags: {} };
      if (data && Array.isArray(data.lessons)) return { schemaVersion: 0, topics: data.lessons, storylines: data.storylines || [], flags: data.flags || {} };
      console.warn('lessons.json has unexpected shape — starting empty');
    }
  } catch(e) { console.warn('Could not read lessons.json:', e.message); }
  return { schemaVersion: 29, topics: [], storylines: [], flags: {} };
}
function saveStore(s) {
  try {
    const out = s.schemaVersion >= 29
      ? { schemaVersion: 29, storylines: s.storylines || [], topics: s.topics || [], flags: s.flags || {} }
      : s; // legacy passthrough (shouldn't happen after migration)
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(out, null, 2), 'utf8');
  } catch(e) {
    const hint = e.code === 'EACCES' ? ' — fix with: chmod u+w ' + STORAGE_FILE : '';
    console.error('Could not write lessons.json:', e.message + hint);
  }
}
// ── UI strings (localisation) ─────────────────────────────────────
function loadUI() {
  try {
    if (fs.existsSync(UI_FILE)) return JSON.parse(fs.readFileSync(UI_FILE, 'utf8'));
  } catch(e) { console.warn('Could not read ui.json:', e.message); }
  return { en: {} };
}
function saveUI(ui) {
  try { fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8'); }
  catch(e) { console.warn('Could not write ui.json:', e.message); }
}
let uiStrings = loadUI();

async function translateUIToLang(lang) {
  const S = langName(lang);
  const base = uiStrings['en'] || {};
  const existing = uiStrings[lang] || {};
  const missing = Object.entries(base).filter(([k]) => !existing[k]);
  if (missing.length === 0) {
    console.log(`  UI [${lang}]: already complete (${Object.keys(existing).length} keys)`);
    return existing;
  }
  console.log(`  UI [${lang}]: translating ${missing.length} missing keys to ${S}…`);
  const BATCH = 40;
  let translated = { ...existing };
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = Object.fromEntries(missing.slice(i, i + BATCH));
    const sys = `You are a UI translator. Translate the values of this JSON object into ${S}. ` +
	  `IMPORTANT: Preserve ALL {placeholder} tokens exactly as-is (e.g. {lang}, {n}, {topic}, {word}, {pronoun}, {verb}). Preserve icons. Keep translations short and natural for a mobile app. ` +
      `Return ONLY a valid JSON object with the same keys, no markdown, no explanation.`;
    const userMsg = JSON.stringify(batch, null, 2);
    try {
      const { text } = await callLLM(sys, userMsg, 2048);
      const parsed = extractJSON(text);
      Object.assign(translated, parsed);
      console.log(`    batch ${Math.floor(i/BATCH)+1}: ${Object.keys(parsed).length} keys translated`);
    } catch(e) {
      console.warn(`    batch ${Math.floor(i/BATCH)+1} failed:`, e.message);
    }
  }
  uiStrings[lang] = translated;
  saveUI(uiStrings);
  return translated;
}

async function ensureUIForLang(lang) {
  if (!lang || lang === 'en') return uiStrings['en'] || {};
  if (!uiStrings[lang]) uiStrings[lang] = {};
  const base = uiStrings['en'] || {};
  const existing = uiStrings[lang];
  const missingCount = Object.keys(base).filter(k => !existing[k]).length;
  if (missingCount === 0) return existing;
  return translateUIToLang(lang);
}


let store = loadStore();

// Assign IDs to any lessons missing them
(function fixNullLessonIds() {
  const arr = store.schemaVersion >= 29 ? (store.topics||[]) : (store.lessons||[]);
  let fixed = 0;
  arr.forEach(topic => {
    (topic.lessons||[]).forEach(ls => {
      if (!ls.id) {
        ls.id = 'ls_' + Math.abs((topic.topic+ls.type+'auto').split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
        fixed++;
      }
    });
  });
  if (fixed > 0) { saveStore(store); console.log(`  Assigned IDs to ${fixed} lesson(s) missing them`); }
})();

// Remove orphaned flags (topic no longer exists, or content no longer in lesson)
(function cleanOrphanedFlags() {
  const flags = store.flags || {};
  const arr = store.schemaVersion >= 29 ? (store.topics||[]) : (store.lessons||[]);
  const byId   = new Map(arr.filter(t=>t.id).map(t => [t.id, t]));
  const bySlug = new Map(arr.map(t => [topicSlug(t.topic), t]));
  let removed = 0;
  Object.keys(flags).forEach(k => {
    const parts  = k.split(':');
    const prefix = parts[0];
    const contentSlug = parts.slice(2).join(':');
    const topic  = byId.get(prefix) || bySlug.get(prefix);
    if (!topic) { delete flags[k]; removed++; return; }
    // Also remove if content no longer exists in any lesson
    if (contentSlug) {
      const allContent = (topic.lessons||[]).flatMap(ls => [
        ...(ls.vocab||[]).map(v=>(v.target||'').slice(0,40).replace(/\s+/g,'_')),
        ...(ls.sentences||[]).map(s=>(s.target||'').slice(0,40).replace(/\s+/g,'_')),
        ...(ls.grammar||[]).map(g=>(g.target||'').slice(0,40).replace(/\s+/g,'_')),
        ...(ls.conjugations||[]).flatMap(c=>(c.forms||[]).map(f=>(f.form||'').slice(0,40).replace(/\s+/g,'_'))),
      ]);
      if (allContent.length > 0 && !allContent.includes(contentSlug)) {
        delete flags[k]; removed++; return;
      }
    }
  });
  if (removed > 0) { store.flags = flags; saveStore(store); console.log(`  Cleaned ${removed} orphaned flag(s)`); }
})();

function findSaved(topic) {
  const k = topic.trim().toLowerCase();
  const arr = store.schemaVersion >= 29 ? store.topics : store.lessons;
  return arr.find(l => l.topic.toLowerCase() === k) || null;
}
function findSavedById(id) {
  const arr = store.schemaVersion >= 29 ? store.topics : store.lessons;
  return arr.find(l => l.id === id) || null;
}

// Walk the continuedFrom chain and collect all vocab/grammar/conjugation targets
// from all prior chapters, deduplicated. Returns { words, nouns, verbs }
function collectChainVocab(continuedFromTopic) {
  if (!continuedFromTopic) return { words: [], nouns: [], verbs: [] };
  const words = [], nouns = [], verbs = [];
  const seen = new Set();
  let cur = continuedFromTopic;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const t = findSaved(cur);
    if (!t) break;
    for (const ls of (t.lessons || [])) {
      for (const v of (ls.vocab || [])) {
        if (v.target && !seen.has(v.target.toLowerCase())) {
          seen.add(v.target.toLowerCase());
          words.push({ target: v.target, source: v.source || '' });
        }
      }
      for (const g of (ls.grammar || [])) {
        if (g.target && !seen.has(g.target.toLowerCase())) {
          seen.add(g.target.toLowerCase());
          nouns.push({ target: g.target, source: g.source || '' });
          words.push({ target: g.target, source: g.source || '' });
        }
      }
      for (const c of (ls.conjugations || [])) {
        if (c.infinitive && !seen.has(c.infinitive.toLowerCase())) {
          seen.add(c.infinitive.toLowerCase());
          verbs.push({ target: c.infinitive, source: c.source || '' });
          words.push({ target: c.infinitive, source: c.source || '' });
        }
      }
    }
    cur = t.continuedFrom || null;
  }
  return { words, nouns, verbs };
}
function upsert(data) {
  const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons = store.lessons || []) && store.lessons;
  const k = data.topic.toLowerCase();
  const i = arr.findIndex(l => l.topic.toLowerCase() === k);
  const now = new Date().toISOString();
  const existing = i >= 0 ? arr[i] : null;
  const entry = { ...data, generatedAt: existing?.generatedAt || now, updatedAt: now };
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  saveStore(store);
}

// ── Flag storage ──────────────────────────────────────────────────────
function getFlags()  { return store.flags || {}; }
function setFlags(f) { store.flags = f; saveStore(store); }
function getStorylines() {
  const sl = store.storylines || [];
  return Array.isArray(sl) ? sl : Object.entries(sl).map(([k,v]) => ({ id: k, ...v, chapters: [] }));
}
function setStorylines(arr) { store.storylines = arr; saveStore(store); }
function findStoryline(slId) { return getStorylines().find(s => s.id === slId) || null; }
function upsertStoryline(sl) {
  const arr = getStorylines();
  const i = arr.findIndex(s => s.id === sl.id);
  if (i >= 0) arr[i] = { ...arr[i], ...sl, updatedAt: new Date().toISOString() };
  else arr.unshift({ ...sl, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  setStorylines(arr);
}
function topicSlug(topic) { return (topic||'').trim().replace(/\s+/g,'_').slice(0,30); }
function flagsForTopic(topic) {
  const prefix = topicSlug(topic) + ':';
  return Object.entries(getFlags()).filter(([k]) => k.startsWith(prefix));
}

// ── Job store — background tasks with progress ────────────────────────
const jobs = new Map();
function newJob() {
  const id = crypto.randomBytes(8).toString('hex');
  jobs.set(id, { status: 'running', step: 'Starting…', data: null, error: null,
                 createdAt: Date.now(), _timer: null });
  return id;
}
function _scheduleCleanup(id, ms) {
  const j = jobs.get(id); if (!j) return;
  if (j._timer) clearTimeout(j._timer);
  j._timer = setTimeout(() => jobs.delete(id), ms);
}
function jobStep(id, step) {
  const j = jobs.get(id); if (!j) return;
  j.step = step; console.log(' ', step);
  _scheduleCleanup(id, 30 * 60 * 1000);
}
function jobDone(id, data) {
  const j = jobs.get(id); if (!j) return;
  j.status = 'done'; j.data = data; j.step = 'Complete';
  _scheduleCleanup(id, 5 * 60 * 1000);
}
function jobFail(id, err) {
  const j = jobs.get(id); if (!j) return;
  j.status = 'error'; j.error = err; j.step = 'Failed';
  _scheduleCleanup(id, 5 * 60 * 1000);
}

// ── Generation lock ───────────────────────────────────────────────────
const generatingTopics = new Set();

// ── Language config (from languages.json) ────────────────────────────
let _langsData = {};
try {
  _langsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'languages.json'), 'utf8'));
} catch(e) { console.warn('Could not load languages.json:', e.message); }
const LANG_NAMES = Object.fromEntries(Object.entries(_langsData).map(([k,v]) => [k, v.name]));
function langName(code) { return LANG_NAMES[code] || code || 'Italian'; }

// ── Prompts ───────────────────────────────────────────────────────────
function sysMeta(srcLang) {
  return fillPrompt(PROMPTS.meta.system, { S: langName(srcLang || 'en') });
}

function difficultyLabel(d) {
  return d === 1 ? 'beginner' : d === 2 ? 'intermediate' : 'advanced';
}
function sentenceLengthSpec(d) {
  return d === 1 ? '3–6 words'
       : d === 2 ? '6–10 words'
       : '10–16 words (complex grammar, subordinate clauses welcome)';
}
// Story styles loaded from prompts.json (hot-reloaded)
function STORY_STYLES() { return PROMPTS.storyStyles || {}; }
// Helper: get style description for a key
function getStoryStyle(key) { return key ? (STORY_STYLES()[key] ?? null) : null; }

function sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, _unused, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const sentLen = sentenceLengthSpec(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basics'
                   : lessonNum === 2 ? 'phrases / patterns'
                   : 'specific / idiomatic vocabulary';
  const P = PROMPTS.vocab;
  let sys = fillPrompt(P.system, { L, S, diff, sentLen, lessonDiff });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  if (lang === 'ja')              sys += P.cjkNote;
  return sys;
}


// Lesson prompt for user-provided story + parallel translation
function sysLessonFromText(lang, srcLang, lessonNum, totalLessons, difficulty, dialect) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const sentLen = sentenceLengthSpec(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basic vocabulary'
                   : lessonNum === 2 ? 'phrases and patterns'
                   : 'specific and idiomatic expressions';
  const P = PROMPTS.vocabFromText;
  let sys = fillPrompt(P.system, { L, S, diff, sentLen, lessonDiff, lessonNum, totalLessons });
  if (dialect) sys += fillPrompt(P.dialectNote, { dialect });
  if (lang === 'ja') sys += P.cjkNote;
  return sys;
}


// Lesson prompt for table format
function sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, dialect) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basic vocabulary'
                   : lessonNum === 2 ? 'phrases and patterns'
                   : 'specific and idiomatic expressions';
  const P = PROMPTS.vocabTable;
  let sys = fillPrompt(P.system, { L, S, diff, lessonDiff, lessonNum, totalLessons });
  if (dialect) sys += fillPrompt(P.dialectNote, { dialect });
  if (lang === 'ja') sys += P.cjkNote;
  return sys;
}

// Parse two markdown tables from table-format lesson output
function parseTableLesson(raw, lessonNum, topic) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const parseTable = (startIdx) => {
    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const l = lines[i];
      if (!l.startsWith('|')) break;
      if (l.replace(/[\s|:-]/g,'').length === 0) continue; // separator row
      const cells = l.split('|').map(c => c.trim()).filter((_,i,a) => i>0 && i<a.length-1);
      if (cells.length >= 2 && !cells[0].toLowerCase().match(/^(word|phrase|sentence|^\w+ word)/))
        rows.push(cells);
    }
    return rows;
  };
  // Find first table
  const t1start = lines.findIndex(l => l.startsWith('|'));
  const vocabRows = parseTable(t1start);
  // Find second table (after first table ends)
  let t2start = t1start + vocabRows.length + 2; // skip header + separator
  while (t2start < lines.length && !lines[t2start].startsWith('|')) t2start++;
  const sentRows = parseTable(t2start);

  const vocab = vocabRows.slice(0, 8).map(r => ({
    target: r[0] || '', source: r[1] || ''
  })).filter(v => v.target && v.source);

  const sentences = sentRows.slice(0, 5).map(r => ({
    target: r[0] || '', source: r[1] || ''
  })).filter(s => s.target && s.source);

  if (vocab.length < 2) throw new Error(`Table parse: only ${vocab.length} vocab rows`);
  if (sentences.length < 1) throw new Error(`Table parse: only ${sentences.length} sentence rows`);

  return {
    title: `Lesson ${lessonNum}`,
    desc: topic,
    icon: '📖',
    vocab,
    sentences
  };
}

function sysSrcRepair(lang, srcLang, deepClean, lessonType) {
  const L = langName(lang || 'it');
  const S = langName(srcLang || 'en');
  const tmpl = deepClean ? PROMPTS.srcRepair.system_deep : PROMPTS.srcRepair.system_fix;
  return fillPrompt(tmpl, { L, S });
}

// ── JSON helpers ──────────────────────────────────────────────────────
// Extract top N content words from a text for use as story context hints
function extractKeywords(text, n, lang) {
  // For CJK languages return a short raw excerpt instead of word extraction
  if (lang && CJK_LANGS.has(lang)) {
    return text.replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  // Latin-script: frequency of words ≥5 chars (length alone filters most function words)
  const words = text.toLowerCase().match(/[a-zÀ-ɏ]{5,}/g) || [];
  const freq = new Map();
  words.forEach(w => freq.set(w, (freq.get(w)||0)+1));
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([w])=>w).join(', ');
}

function stripRaw(raw) {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
}
function extractJSON(raw) {
  const s = stripRaw(raw);
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object found');
  return JSON.parse(s.slice(start, end + 1));
}
function extractArray(raw) {
  const s = stripRaw(raw);
  const start = s.indexOf('['), end = s.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('No JSON array found');
  return JSON.parse(s.slice(start, end + 1));
}
function salvageArray(raw) {
  let s = stripRaw(raw);
  const start = s.indexOf('[');
  if (start < 0) throw new Error('No array found');
  s = s.slice(start);
  try { return JSON.parse(s); } catch(_) {}
  s = s.replace(/,\s*\{[^}]*$/, '').replace(/,\s*$/, '');
  let opens = 0, sq = 0;
  for (const ch of s) {
    if (ch==='{') opens++; else if (ch==='}') opens--;
    else if (ch==='[') sq++; else if (ch===']') sq--;
  }
  s += '}'.repeat(Math.max(0,opens)) + ']'.repeat(Math.max(0,sq));
  return JSON.parse(s);
}

// ── LLM backends ──────────────────────────────────────────────────────
function callOllamaRaw(model, system, userMsg, maxTokens) {
  const call = new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { temperature: 0.15, num_predict: maxTokens || 1024 },
      messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }]
    });
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return reject(new Error('Ollama: ' + p.error));
          const text = p.message?.content || p.response || '';
          if (!text) return reject(new Error('Ollama returned empty response'));
          resolve({
            text,
            promptTokens:     p.prompt_eval_count || 0,
            completionTokens: p.eval_count        || 0,
          });
        } catch(e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0,200))); }
      });
    });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message)));
    req.setTimeout(OLLAMA_TIMEOUT, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body); req.end();
  });
  const timeout = new Promise((_,reject) =>
    setTimeout(() => reject(new Error('Ollama timeout')), OLLAMA_TIMEOUT)
  );
  return Promise.race([call, timeout]);
}

// Release a model from VRAM so the next model can load cleanly.
function releaseOllamaModel(model) {
  return new Promise(resolve => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: 0,
      options: { num_predict: 1 }, messages: [{ role: 'user', content: '' }]
    });
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); res.on('end', resolve); });
    req.setTimeout(10000, () => { req.destroy(); resolve(); });
    req.on('error', resolve);
    req.write(body); req.end();
  });
}

function callLLM(system, userMsg, maxTokens) {
  return callOllamaRaw(OLLAMA_MODEL, system, userMsg, maxTokens);
}
function callLLMLesson(system, userMsg, maxTokens) {
  return callOllamaRaw(OLLAMA_LESSON_MODEL, system, userMsg, maxTokens);
}
function callLLMTranslation(system, userMsg, maxTokens) {
  return callOllamaRaw(OLLAMA_TRANSLATION_MODEL, system, userMsg, maxTokens);
}

// ── Retry helper ──────────────────────────────────────────────────────
async function withRetry(label, fn, retries = 3, delay = 800) {
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    console.log(`    ${label} attempt ${i}…`);
    try { return await fn(); }
    catch(e) {
      console.warn(`    Attempt ${i} failed: ${e.message}`);
      lastErr = e;
      if (i < retries) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error(`${label} failed after ${retries} attempts: ${lastErr.message}`);
}

// ── Sentence validation ───────────────────────────────────────────────
const isPunct = t => /^[.,!?;:()\[\]"'«»—–]+$/.test(t.trim());
const normSpaces = str => str.trim().replace(/ ([.,!?;:()\[\]])/g, '$1');

// Languages where words are not space-separated
const CJK_LANGS = new Set(['ja','zh','ko']);

// Tokenise a Japanese/Chinese sentence into meaningful word-sized chunks.
// Handles the kanji[よみ] annotation format used in lessons.
// Each kanji+reading group → one token; runs of kana/latin between them → split on 2-char chunks.
function deriveSentenceWords(s, lang) {
  if (lang && CJK_LANGS.has(lang)) {
    if (lang === 'ja') {
      // Split on furigana-annotated groups: kanji[reading] and bare kana runs
      // Pattern: either a kanji+bracket group, or a run of non-kanji non-bracket characters
      const raw = s.target;
      const tokens = [];
      // Regex: match kanji[reading] groups OR runs of other non-whitespace chars
      const re = /[\u4e00-\u9fff\u3400-\u4dbf々〆〇]+\[[^\]]+\]|[\u3040-\u30ff\uff00-\uffef\u0021-\u007ea-zA-Z0-9]+|[\u4e00-\u9fff\u3400-\u4dbf々〆〇]+/g;
      let m;
      while ((m = re.exec(raw)) !== null) {
        const tok = m[0];
        if (tok.length > 0) tokens.push(tok);
      }
      // If too many tokens, merge adjacent non-kanji kana runs pairwise
      if (tokens.length > 14) {
        const merged = [];
        for (let i = 0; i < tokens.length; i += 2)
          merged.push(tokens[i] + (tokens[i+1] || ''));
        s.words = merged;
      } else {
        s.words = tokens;
      }
    } else {
      // Chinese/Korean: split by character pairs
      s.words = [...s.target].filter(c => /\S/.test(c) && !isPunct(c));
      if (s.words.length > 12) {
        const chars = s.words;
        s.words = [];
        for (let i = 0; i < chars.length; i += 2)
          s.words.push(chars.slice(i, i+2).join(''));
      }
    }
  } else {
    s.words = s.target.split(' ').filter(t => !isPunct(t));
  }
  return s;
}

// Translation prompt — translate a story to the source language
function sysTranslation(lang, srcLang) {
  return fillPrompt(PROMPTS.translation.system, { L: langName(lang), S: langName(srcLang || 'en') });
}

// ── Story prompts ─────────────────────────────────────────────────────
function sysStory(lang, isContinuation, wordCount, dialect, writingStyle) {
  const L = langName(lang);
  const wc = Math.max(100, Math.min(1000, wordCount || 300));
  const paraLo = Math.max(1, Math.floor(wc / 100));
  const paraHi = paraLo + 1;
  const P = PROMPTS.story;
  let sys = fillPrompt(P.system, { L, wc, paraLo, paraHi });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (lang === 'ja')              sys += P.furiganaNote;
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  if (isContinuation)             sys += P.continuationNote;
  return sys;
}

// ── Error-hunt lesson prompt ─────────────────────────────────────────
function sysErrorHunt(lang, difficulty) {
  const L = langName(lang);
  const nSpell   = difficulty >= 3 ? 4 : 3;
  const nGrammar = difficulty >= 2 ? 3 : 2;
  return fillPrompt(PROMPTS.errorHunt.system, { L, nSpell, nGrammar });
}

// ── Storyline title prompt ─────────────────────────────────────────────
async function generateStorylineTitle(topics, stories, srcLang) {
  srcLang = srcLang || 'en';
  const S = langName(srcLang);
  console.log(`\n── Storyline title generation ──────────────────────`);
  console.log(`  Chapters : ${topics.length} (${topics.map(t=>'"'+t+'"').join(', ')})`);
  console.log(`  Model    : ${OLLAMA_MODEL}`);
  console.log(`  Lang     : ${S}`);
  const topicList = topics.map((t,i) => `Chapter ${i+1}: "${t}"`).join('\n');
  const storyExcerpts = stories.map((s,i) =>
    `Chapter ${i+1} excerpt: ${(s||'').slice(0,300).replace(/\n/g,' ')}…`
  ).join('\n\n');
  const sys = fillPrompt(PROMPTS.storylineTitle.system, { S });
  const user = fillPrompt(PROMPTS.storylineTitle.user, { topicList, storyExcerpts, S });
  const result = await callOllamaRaw(OLLAMA_MODEL, sys, user, 80);
  const raw = result.text.replace(/```json|```/g, '').trim();
  console.log(`  Raw response: ${raw.slice(0,120)}`);
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch(e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { parsed = JSON.parse(m[0]); console.log('  (extracted JSON from response)'); }
    else throw new Error('Could not parse JSON from model response: ' + raw.slice(0,80));
  }
  if (!parsed.title || !parsed.icon) throw new Error('Missing title or icon in response');
  console.log(`  Result   : ${parsed.icon} "${parsed.title}"`);
  console.log('────────────────────────────────────────────────────\n');
  return { title: parsed.title.slice(0, 80), icon: parsed.icon.slice(0, 8) };
}


async function generateStorylineSummary(topics, stories, vocab, srcLang) {
  srcLang = srcLang || 'en';
  const S = langName(srcLang);
  console.log(`\n── Storyline summary generation ─────────────────────`);
  console.log(`  Chapters : ${topics.length}, Lang: ${S}`);
  const chapterSummaries = topics.map((t, i) =>
    `Chapter ${i+1}: "${t}"\n${(stories[i]||'').slice(0, 600).replace(/\n/g,' ')}…`
  ).join('\n\n');
  const vocabList = [...new Set(vocab)].slice(0, 40).join(', ');
  const sys = fillPrompt(PROMPTS.storylineSummary.system, { S });
  const user = fillPrompt(PROMPTS.storylineSummary.user, { chapterSummaries, vocabList, S });
  const result = await callOllamaRaw(OLLAMA_MODEL, sys, user, 400);
  const summary = result.text.trim();
  console.log(`  Summary  : ${summary.slice(0,80)}…`);
  console.log('────────────────────────────────────────────────────\n');
  return summary;
}

// ── Grammar lesson: gender, articles, plurals ───────────────────────────────
function sysGrammar(lang, srcLang, difficulty, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const P = PROMPTS.grammar;
  let sys = fillPrompt(P.system, { L, S, diff });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  return sys;
}


// ── Conjugation lesson: verb forms by person ─────────────────────────────────
function sysConjugation(lang, srcLang, difficulty, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const P = PROMPTS.conjugation;
  let sys = fillPrompt(P.system, { L, S, diff });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  return sys;
}


// ── Generate error-hunt lesson ───────────────────────────────────────

// ── Math lesson generator (no LLM — purely algorithmic) ──────────────────────
function extractNumbers(story, difficulty) {
  // Use pure difficulty-based number pools — story numbers not used as seeds
  if (difficulty <= 1) {
    // Beginner: 1–9, pick 6 distinct random integers
    return shuffle([1,2,3,4,5,6,7,8,9]).slice(0,6);
  } else {
    // Intermediate + Advanced: 1–1000, pick 8 distinct random integers
    const pool = [];
    while (pool.length < 8) {
      const n = Math.floor(Math.random()*1000)+1;
      if (!pool.includes(n)) pool.push(n);
    }
    return pool;
  }
}

function mathNearMiss(correct, nums, difficulty) {
  const wrongs = new Set();
  // Scale deltas to the magnitude of the correct answer
  const mag = Math.max(1, Math.abs(correct));
  const deltas = difficulty <= 1 ? [1,2,3]
    : difficulty === 2 ? [1, Math.ceil(mag*0.1), Math.ceil(mag*0.2), 10]
    : [0.1, 0.25, Math.ceil(mag*0.1)];
  for (const d of deltas) {
    if (correct - d >= 0 && correct - d !== correct) wrongs.add(+(correct - d).toFixed(4));
    wrongs.add(+(correct + d).toFixed(4));
    if (wrongs.size >= 3) break;
  }
  // Fill remaining from nums pool
  for (const n of nums) {
    if (n !== correct) wrongs.add(n);
    if (wrongs.size >= 3) break;
  }
  return [...wrongs].slice(0,3);
}

function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]; } return b; }

function generateMath(story, difficulty, mathOps) {
  const nums = extractNumbers(story, difficulty);
  const exercises = [];

  // ── Ordering exercises (2–3 per lesson) ──────────────────────────────────
  const orderCount = Math.min(2, Math.floor(nums.length / 3));
  for (let i = 0; i < orderCount; i++) {
    const size = difficulty <= 1 ? 4 : 5;
    const subset = shuffle(nums).slice(0, size);
    const asc = [...subset].sort((a,b) => a-b);
    const desc = [...asc].reverse();
    const dir = Math.random() < 0.5 ? 'asc' : 'desc';
    exercises.push({
      type: 'math_order',
      direction: dir,
      numbers: shuffle([...subset]),
      correct: (dir === 'asc' ? asc : desc).map(String),
    });
  }

  // ── Calculation exercises ─────────────────────────────────────────────────
  const defaultOps = difficulty <= 1 ? ['+','-']
                   : difficulty === 2 ? ['+','-','×']
                   : ['+','-','×','÷'];
  const ops = (mathOps && mathOps.length) ? mathOps : defaultOps;

  // Use story numbers + derived combinations
  const pool = [...nums];
  // Add a few derived numbers as operands
  for (let i = 0; i < nums.length && pool.length < 8; i++) {
    for (let j = i+1; j < nums.length && pool.length < 8; j++) {
      if (nums[i] + nums[j] <= (difficulty <= 1 ? 9 : 9999)) pool.push(nums[i]+nums[j]);
    }
  }

  const calcCount = Math.min(5, nums.length);
  let attempts = 0;
  while (exercises.filter(e=>e.type==='math_calc').length < calcCount && attempts++ < 50) {
    const op = ops[Math.floor(Math.random()*ops.length)];
    const a = pool[Math.floor(Math.random()*pool.length)];
    const b = pool[Math.floor(Math.random()*pool.length)];
    let correct;
    if (op==='+') correct = a+b;
    else if (op==='-') { if (a<b) continue; correct = a-b; }
    else if (op==='×') { correct = a*b; if (difficulty<=1 && correct>9) continue; }
    else if (op==='÷') { if (b===0 || a%b!==0) continue; correct = a/b; }
    else if (op==='^') {
      const base = Math.min(a, 20), exp = Math.min(b, 4);
      if (exp < 1) continue;
      correct = Math.pow(base, exp);
      if (!isFinite(correct) || correct > 1e9) continue;
    }
    else continue;
    correct = +correct.toFixed(4);
    const wrongs = mathNearMiss(correct, pool, difficulty);
    if (wrongs.length < 3) continue;
    exercises.push({
      type: 'math_calc',
      a: String(a), op, b: String(b),
      correct: String(correct),
      choices: shuffle([String(correct), ...wrongs.map(String)]).slice(0,4),
    });
  }

  return {
    lesson: {
      id: 'math_' + Date.now(),
      type: 'math',
      title: '① ② ③',
      desc: '＋ － ×  ÷',
      icon: '🔢',
      numbers: nums,
      difficulty,
      ...(mathOps && mathOps.length ? { mathOps } : {}),
      exercises,
    },
    tokens: { promptTokens: 0, completionTokens: 0 },
  };
}

async function generateMathLLM(lang, srcLang, difficulty, instruction, jobId) {
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating math lesson (LLM)…`);
  const L = langName(lang || 'it');
  const S = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const nExercises = difficulty <= 1 ? 5 : 7;
  const sys  = fillPrompt(PROMPTS.math.system, { L, S });
  const user = fillPrompt(PROMPTS.math.user, { L, S, diff, instruction, nExercises });
  let raw, parsed;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { text, promptTokens, completionTokens } = await callLLMLesson(sys, user, 1200);
      raw = stripRaw(text);
      parsed = JSON.parse(raw);
      if (!parsed.exercises || !parsed.exercises.length) throw new Error('No exercises');
      // Validate and sanitise exercises
      const validTypes = new Set(['math_calc','math_order','math_latex']);
      parsed.exercises = parsed.exercises.filter(e => validTypes.has(e.type));
      if (!parsed.exercises.length) throw new Error('No valid exercises after filter');
      // Ensure choices arrays have exactly 4 items
      parsed.exercises.forEach(e => {
        if (e.choices && !e.choices.includes(e.correct))
          e.choices = [e.correct, ...e.choices].slice(0,4);
        if (e.choices) e.choices = shuffle([...new Set(e.choices)].slice(0,4));
      });
      return {
        lesson: {
          id: 'math_' + Date.now(),
          type: 'math',
          title: parsed.title || '① ② ③',
          desc:  parsed.desc  || '＋ － × ÷',
          icon:  parsed.icon  || '🔢',
          numbers: parsed.numbers || [],
          difficulty,
          mathInstruction: instruction,
          exercises: parsed.exercises,
        },
        tokens: { promptTokens, completionTokens },
      };
    } catch(e) {
      console.log(`  Math LLM attempt ${attempt} failed: ${e.message}`);
      if (attempt === 3) throw new Error('Math LLM failed after 3 attempts: ' + e.message);
    }
  }
}

async function generateErrorHunt(story, lang, difficulty, jobId, priorVocab) {
  jobStep(jobId, `[${OLLAMA_MODEL}] Generating error-hunt lesson…`);
  const sys = sysErrorHunt(lang, difficulty);
  const priorHint = priorVocab && priorVocab.length
    ? `\n\nPREFER errors on these words where they appear: ${priorVocab.slice(0,20).map(v=>v.target).join(', ')}`
    : '';
  const userMsg = `Here is the ${langName(lang)} story:\n\n${story}\n\nReturn the corrupted story now.${priorHint}`;
  const { text: corrupted, promptTokens, completionTokens } = await callOllamaRaw(OLLAMA_MODEL, sys, userMsg, story.length * 2);
  const corruptedStory = corrupted.trim();
  if (!corruptedStory || corruptedStory.length < story.length * 0.5)
    throw new Error('Error-hunt: model returned too short a response');
  if (corruptedStory === story)
    throw new Error('Error-hunt: model returned identical story with no changes');
  console.log(`    Error-hunt: corrupted story ${corruptedStory.length} chars (orig ${story.length})`);
  return {
    lesson: {
      id: 4, type: 'error_hunt',
      title: 'Text Understanding',
      desc: 'Find the mistakes in the story',
      icon: '🔍',
      corruptedStory,
    },
    tokens: { promptTokens, completionTokens },
  };
}

// ── Generate one lesson — returns {lesson, tokens} ────────────────────

// ── Generate grammar lesson (gender, articles, plurals) ──────────────────────
function validateGrammarItems(items, lang, srcLang) {
  // Returns { valid, rejected, reasons }
  const valid = [], rejected = [];
  for (const g of items) {
    const reasons = [];
    const t = (g.target || '').trim();
    const s = (g.source || '').trim();
    const p = (g.plural  || '').trim();
    if (!t) { reasons.push('missing target'); }
    if (!s) { reasons.push('missing source'); }
    if (!p) { reasons.push('missing plural'); }
    // target and source must differ (catches same-language errors)
    if (t && s && t.toLowerCase() === s.toLowerCase())
      reasons.push(`target===source ("${t}")`);
    // target must not equal plural (singular=plural is suspicious; warn only for common langs)
    if (t && p && t.toLowerCase() === p.toLowerCase())
      reasons.push(`target===plural ("${t}") — likely already a plural`);
    // source must not equal target (language confusion check, case-insensitive)
    if (reasons.length === 0) {
      valid.push({ ...g, target: t, source: s, plural: p });
    } else {
      rejected.push({ item: g, reasons });
    }
  }
  return { valid, rejected };
}

async function generateGrammar(topic, lang, srcLang, difficulty, jobId, opts) {
  opts = opts || {};
  const { userDialect, storyStyle, chainVocab, vocabMode: gramVocabMode, story } = opts;
  const sys = sysGrammar(lang, srcLang, difficulty, userDialect, storyStyle);
  const _gNouns = chainVocab?.nouns?.slice(0, 15).map(n => n.target) || [];
  const priorNouns = !_gNouns.length ? ''
    : gramVocabMode === 'extend'
      ? `\nAVOID these nouns already covered in prior chapters: ${_gNouns.join(', ')}`
      : `\nPRIOR NOUNS from previous chapters (reinforce where topic-relevant): ${_gNouns.join(', ')}`;
  const L = langName(lang); const S = langName(srcLang || 'en');
  const storyKeywords = story ? extractKeywords(story, 6, lang) : '';
  const storyHintG = storyKeywords ? fillPrompt(PROMPTS.grammar.storyHint, { storyKeywords }) : '';
  const userMsg = fillPrompt(PROMPTS.grammar.user, { topic, L, S })
    + storyHintG + priorNouns
    + '\nReturn only the JSON object.';
  const MAX_ATTEMPTS = 3;
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Grammar lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Grammar attempt ${attempt}…`);
    const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sys, userMsg, 1400);
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) { lastError = 'Could not parse JSON: ' + cleaned.slice(0, 60); continue; }
      try { parsed = JSON.parse(m[0]); } catch(e2) { lastError = 'JSON extract failed'; continue; }
    }
    if (!Array.isArray(parsed.grammar) || parsed.grammar.length === 0) {
      lastError = 'No grammar items in response'; continue;
    }
    const { valid, rejected } = validateGrammarItems(parsed.grammar, lang, srcLang);
    if (rejected.length > 0) {
      console.warn(`    Grammar: ${rejected.length} item(s) rejected:`);
      rejected.forEach(r => console.warn(`      "${r.item.target}" / "${r.item.source}": ${r.reasons.join(', ')}`));
    }
    if (valid.length < 5) {
      lastError = `Only ${valid.length} valid items after filtering (${rejected.length} rejected)`; continue;
    }
    console.log(`    Grammar: ${valid.length} valid nouns (${rejected.length} rejected)`);
    return {
      lesson: {
        id: 5, type: 'grammar',
        title: parsed.title || 'Gender & Plurals',
        desc:  parsed.desc  || 'Noun gender, articles and plural forms',
        icon:  parsed.icon  || '🏷️',
        grammar: valid,
      },
      tokens: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
    };
  }
  throw new Error(`Grammar generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── Generate conjugation lesson ───────────────────────────────────────────────
async function generateConjugation(topic, lang, srcLang, difficulty, jobId, opts) {
  opts = opts || {};
  const { userDialect, storyStyle, chainVocab, vocabMode: conjVocabMode, story } = opts;
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating conjugation lesson…`);
  const sys = sysConjugation(lang, srcLang, difficulty, userDialect, storyStyle);
  const _cVerbs = chainVocab?.verbs?.slice(0, 10).map(v => v.target) || [];
  const priorVerbs = !_cVerbs.length ? ''
    : conjVocabMode === 'extend'
      ? `\nAVOID these verbs already covered in prior chapters: ${_cVerbs.join(', ')}`
      : `\nPRIOR VERBS from previous chapters (reinforce where topic-relevant): ${_cVerbs.join(', ')}`;
  const L = langName(lang); const S = langName(srcLang || 'en');
  const storyKeywordsC = story ? extractKeywords(story, 6, lang) : '';
  const storyHintC = storyKeywordsC ? fillPrompt(PROMPTS.conjugation.storyHint, { storyKeywords: storyKeywordsC }) : '';
  const userMsgC = fillPrompt(PROMPTS.conjugation.user, { topic, L, S })
    + storyHintC + priorVerbs
    + '\nReturn only the JSON object.';
  const userMsg = userMsgC;
  const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sys, userMsg, 1400);
  const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch(e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Conjugation: could not parse JSON: ' + cleaned.slice(0, 80));
    parsed = JSON.parse(m[0]);
  }
  if (!Array.isArray(parsed.conjugations) || parsed.conjugations.length === 0)
    throw new Error('Conjugation: no conjugations in response');
  console.log(`    Conjugation: ${parsed.conjugations.length} verbs generated`);
  return {
    lesson: {
      id: 6, type: 'conjugation',
      title: parsed.title || 'Verb Conjugation',
      desc:  parsed.desc  || 'Present tense verb forms',
      icon:  parsed.icon  || '🔤',
      conjugations: parsed.conjugations,
    },
    tokens: { promptTokens, completionTokens },
  };
}

async function generateOneLesson(lang, srcLang, topic, lessonNum, totalLessons, prevVocab, story, difficulty, jobId, opts) {
  opts = opts || {};
  const { userTranslation, userDialect, writingStyle, storyLang, chainVocab, vocabMode } = opts;
  const useTable = OLLAMA_LESSON_FORMAT === 'table';
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Lesson ${lessonNum}/${totalLessons}…`);

  // Build prior-vocab hints for within-topic progression and cross-chapter reinforcement
  const _chainWords = (chainVocab && chainVocab.length) ? chainVocab.slice(0, 30) : [];
  const chainHint = !_chainWords.length ? ''
    : vocabMode === 'extend'
      ? `\nEXTEND vocabulary — these words were already covered in prior chapters. Do NOT use them as vocab items. Avoid them in sentences where possible. Focus on FRESH vocabulary:\n${_chainWords.map(v => v.target).join(', ')}`
      : `\nREINFORCE — weave these words from prior chapters naturally into sentences (do NOT list them as vocab items):\n${_chainWords.map(v => v.target + (v.source ? ' (' + v.source + ')' : '')).join(', ')}`;

  let sysPrompt, userMsg;

  if (userTranslation) {
    if (useTable) {
      sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
      const prevHint = prevVocab.length
        ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Extract vocabulary and sentences from this story and its translation.\n\nSTORY:\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}${chainHint}`;
    } else {
      sysPrompt = sysLessonFromText(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
      const prevHint = prevVocab.length
        ? `\nVocabulary already used in earlier lessons (avoid repeating these):\n${prevVocab.map(v => v.target + ' = ' + v.source).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.\n\nSTORY (${langName(lang)}):\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}${chainHint}\n\nReturn only the JSON object.`;
    }
  } else if (useTable) {
    sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
    const prevHint = prevVocab.length
      ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
      : '';
    const storyHint = story ? `\n\nContext story:\n${story}` : '';
    userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.${storyHint}${prevHint}${chainHint}`;
  } else {
    sysPrompt = sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, null, userDialect, writingStyle);
    const prevHint = prevVocab.length
      ? fillPrompt(PROMPTS.vocab.prevHint, { prevVocab: prevVocab.map(v => v.target + ' = ' + v.source).join(', ') })
      : '';
    const L = langName(lang);
    const S = langName(srcLang || 'en');
    // Story-language-aware hint: 1200 char cap regardless of language
    let storyHint = '';
    if (story) {
      const excerpt = story.slice(0, 1200);
      const sl = storyLang || 'target';
      if (sl === 'target') {
        storyHint = fillPrompt(PROMPTS.vocab.storyHint_target, { L, S, storyExcerpt: excerpt });
      } else if (sl === 'source') {
        storyHint = fillPrompt(PROMPTS.vocab.storyHint_source, { L, S, storyExcerpt: excerpt });
      } else {
        storyHint = fillPrompt(PROMPTS.vocab.storyHint_other, { L, S, storyExcerpt: excerpt });
      }
    }
    userMsg = fillPrompt(PROMPTS.vocab.user, { topic, lessonNum, totalLessons, L, S })
      + storyHint + prevHint + chainHint
      + PROMPTS.vocab.suffix;
  }

  const isCJK = CJK_LANGS.has(lang);
  const minWords = isCJK ? 1 : (difficulty || 2) === 1 ? 2 : 3;
  const minSentences = isCJK ? 1 : 3;

  return withRetry(`Lesson ${lessonNum}`, async () => {
    const t0 = Date.now();
    const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sysPrompt, userMsg, 2048);
    const ms = Date.now() - t0;
  
    let lesson;
    if (useTable) {
      lesson = parseTableLesson(raw, lessonNum, topic);
    } else {
      try { lesson = extractJSON(raw); }
      catch(_) {
        try {
          const arr = extractArray(raw);
          if (Array.isArray(arr) && arr[0]?.vocab) lesson = arr[0];
          else throw new Error('Not a lesson object');
        } catch(_2) { throw new Error('Could not parse lesson JSON'); }
      }
    }

    // Validate vocab
    if (!Array.isArray(lesson.vocab) || lesson.vocab.length < (useTable ? 2 : 4))
      throw new Error(`Only ${lesson.vocab?.length ?? 0} vocab items`);
    const seen = new Set();
    lesson.vocab = lesson.vocab.filter(v => {
      const k = v.target?.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 8);
    if (lesson.vocab.length < (useTable ? 2 : 4)) throw new Error(`Only ${lesson.vocab.length} unique vocab items`);

    // Validate sentences
    if (!Array.isArray(lesson.sentences) || lesson.sentences.length < (useTable ? 1 : minSentences))
      throw new Error(`Only ${lesson.sentences?.length ?? 0} sentences`);
    lesson.sentences = lesson.sentences.slice(0, 5).map(s => deriveSentenceWords(s, lang));
    if (!useTable) {
      const tooShort = lesson.sentences.filter(s => s.words.length < minWords);
      if (tooShort.length > 2)
        throw new Error(`${tooShort.length} sentences have fewer than ${minWords} words — retrying`);
    }

    // Detect model copying target-language content into the source-language (en) field
    const vocabSameCount = lesson.vocab.filter(v =>
      v.target && v.source && v.target.trim().toLowerCase() === v.source.trim().toLowerCase()
    ).length;
    const sentSameCount = lesson.sentences.filter(s =>
      s.target && s.source && s.target.trim().toLowerCase() === s.source.trim().toLowerCase()
    ).length;
      if (vocabSameCount > 2)
      throw new Error(`${vocabSameCount} vocab items have identical source/target fields — model ignored source language, retrying`);
    if (sentSameCount > 1)
      throw new Error(`${sentSameCount} sentences have identical source/target fields — model ignored source language, retrying`);

    return {
      lesson: {
        id: lessonNum,
        title: lesson.title || `Lesson ${lessonNum}`,
        desc:  lesson.desc  || topic,
        icon:  lesson.icon  || '📖',
        vocab: lesson.vocab,
        sentences: lesson.sentences
      },
      tokens: { lessonNum, ms, promptTokens, completionTokens }
    };
  });
}

// ── Generate all lessons ──────────────────────────────────────────────
async function generate(topic, lang, srcLang, difficulty, continuedFrom, storyLen, jobId, userOpts) {
  userOpts = userOpts || {};
  const { userStory, userTranslation, userDialect, storyStyle, lessonFormat, reinforcePrior, vocabMode, useFullChain, userStoryLang, prevStoryTopic, mathInstruction } = userOpts;
  srcLang = srcLang || 'en';
  const userTopic = topic;
  const genStart = Date.now();
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  const lessonTokenStats = [];

  jobStep(jobId, `[${OLLAMA_MODEL}] Generating topic info…`);
  let meta;
  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM(sysMeta(srcLang),
      `Topic: "${topic}". Source language for output: ${langName(srcLang)}. Return the JSON with topic and topicEmoji, all text in ${langName(srcLang)}.`, 256);
    meta = extractJSON(raw);
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
  } catch(e) {
    meta = { topic, topicEmoji: '📚' };
    console.warn('  Meta failed, using fallback:', e.message);
  }

  // If srcLang is not English, explicitly translate topic + themes to make sure they're in the right language.
  // This is a cheap targeted call that's more reliable than hoping the meta model follows language instructions.
  if (srcLang && srcLang !== 'en') {
    try {
      const S = langName(srcLang);
      const toTranslate = JSON.stringify({ topic: meta.topic || topic });
      const sysTransMeta = fillPrompt(PROMPTS.metaTranslation.system, { S });
      const { text: rawT, promptTokens: pt, completionTokens: ct } = await callLLM(sysTransMeta, toTranslate, 128);
      const translated = extractJSON(rawT);
      if (translated.topic) meta.topic = translated.topic;
      totalPromptTokens += pt; totalCompletionTokens += ct;
      console.log(`    Meta translated to ${S}: "${meta.topic}"`);
    } catch(e) {
      console.warn(`  Meta translation to ${langName(srcLang)} failed, keeping original:`, e.message);
    }
  }

  // ── Story: use user-supplied or generate ─────────────────────────────
  let story = null;
  let storyPrompt = null;
  // storyLang: language the story is actually written in
  // 'target' = lang, 'source' = srcLang, 'other' = third language
  const storyLang = userStory ? (userStoryLang || 'target') : 'target';

  if (userStory) {
    story = userStory.trim();
    storyPrompt = userTranslation ? 'User-provided story + translation' : 'User-provided story';
    console.log(`    Using user-provided story (${story.length} chars)${userTranslation?' + translation':''}${userDialect?', dialect: '+userDialect:''}`);
  } else {
    const prevStoryFull = continuedFrom ? (findSaved(continuedFrom)?.story || null) : null;
    const prevStory = prevStoryFull
      ? (useFullChain ? prevStoryFull : prevStoryFull.slice(-OLLAMA_MAX_PREV_STORY))
      : null;
    if (continuedFrom && prevStory)
      console.log(`    Continuing from: "${continuedFrom}" (using ${useFullChain?'full':'last '+prevStory.length+'/'+prevStoryFull.length} chars)`);
    jobStep(jobId, `[${OLLAMA_MODEL}] Generating story (~${storyLen} words)…`);
    try {
      const t0 = Date.now();
      const storyUserMsg = prevStory
        ? `Previous story (excerpt):\n${prevStory}\n\nNew topic: "${userTopic}". Write the continuation now. Plain prose, no headings.`
        : `Write a story for the topic: "${userTopic}". Plain prose, no headings.`;
      const storySystem = sysStory(lang, !!prevStory, storyLen, userDialect, storyStyle);
      const { text, promptTokens, completionTokens } = await callLLM(
        storySystem, storyUserMsg, Math.min(2048, Math.ceil((storyLen||300) * 1.5) + 200));
      story = text.trim();
      storyPrompt = storySystem + '\n\n' + storyUserMsg;
      totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
      console.log(`    [${OLLAMA_MODEL}] Story (${lang}, ~${storyLen}w): ${Date.now()-t0}ms, ${story.length} chars`);
    } catch(e) {
      throw new Error(`Story generation failed: ${e.message}`);
    }
  }

  // ── Translation ───────────────────────────────────────────────────────
  let storyTranslation = userTranslation || null;
  const shouldAutoTranslate = story && !storyTranslation &&
    OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL;

  if (shouldAutoTranslate) {
    jobStep(jobId, `[${OLLAMA_TRANSLATION_MODEL}] Translating story to ${langName(srcLang)}…`);
    try {
      const t0 = Date.now();
      const { text, promptTokens, completionTokens } = await callLLMTranslation(
        sysTranslation(lang, srcLang), story, Math.min(2048, Math.ceil(story.length * 1.2)));
      storyTranslation = text.trim();
      totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
      console.log(`    [${OLLAMA_TRANSLATION_MODEL}] Translation (${lang}→${srcLang}): ${Date.now()-t0}ms, ${storyTranslation.length} chars`);
    } catch(e) {
      console.warn('  Translation failed, falling back to context-only mode:', e.message);
      storyTranslation = null;
    }
  }

  // Release story/translation model from VRAM before loading lesson model
  if (OLLAMA_LESSON_MODEL !== OLLAMA_MODEL) {
    console.log(`    Releasing [${OLLAMA_MODEL}] from VRAM…`);
    await releaseOllamaModel(OLLAMA_MODEL);
    if (OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL && OLLAMA_TRANSLATION_MODEL !== OLLAMA_LESSON_MODEL)
      await releaseOllamaModel(OLLAMA_TRANSLATION_MODEL);
  }

  // ── Save story early (before lesson generation, so story is never lost) ──
  if (story) {
    upsert({
      topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
      userTopic, lang, srcLang, difficulty: difficulty || 2, storyLen,
      story, storyLang, storyPrompt,
      ...(storyTranslation ? { storyTranslation } : {}),
      ...(userStory        ? { userStory }         : {}),
      ...(userDialect      ? { userDialect }       : {}),
      ...(continuedFrom    ? { continuedFrom }     : {}),
      ...(storyStyle       ? { storyStyle }        : {}),
      lessons: [],
    });
    console.log('    Story saved early (before lessons)');
  }

  // ── Lessons ───────────────────────────────────────────────────────────
  const styleHint = null; // removed — story context goes in userMsg only
  const lessons = [];

  const _vocabMode = vocabMode || (reinforcePrior ? 'reinforce' : 'neutral');
  const chainVocab = (_vocabMode !== 'neutral' && continuedFrom)
    ? collectChainVocab(continuedFrom)
    : { words: [], nouns: [], verbs: [] };
  const chainOpts = { userDialect, storyStyle, chainVocab, vocabMode: _vocabMode, story };

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation' || lessonFormat === 'math') {
    const genFn   = lessonFormat === 'math'
      ? (mathInstruction
          ? () => generateMathLLM(lang, srcLang, difficulty, mathInstruction, jobId)
          : () => Promise.resolve(generateMath(story, difficulty)))
                  : lessonFormat === 'error_hunt'  ? () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words)
                  : lessonFormat === 'grammar'      ? () => generateGrammar(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  :                                   () => generateConjugation(topic, lang, srcLang, difficulty, jobId, chainOpts);
    const label   = lessonFormat === 'math'        ? 'Math'
                  : lessonFormat === 'error_hunt'  ? 'Error-hunt'
                  : lessonFormat === 'grammar'      ? 'Grammar'
                  :                                   'Conjugation';
    try {
      const { lesson, tokens } = await genFn();
      lessons.push(lesson);
      totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
      lessonTokenStats.push(tokens);
    } catch(e) {
      console.error(`  ${label} generation failed:`, e.message);
      throw new Error(`${label} lesson failed: ` + e.message);
    }
  } else {
    // Standard format: one lesson (no progression)
    // all_types: standard lesson + grammar + conjugation + error_hunt
    const isAllTypes = lessonFormat === 'all_types';
    // When user provides a story continuing from a prior chapter,
    // prepend the previous chapter's story as context.
    const prevStory = prevStoryTopic ? (findSaved(prevStoryTopic)?.story || null) : null;
    const combinedStory = (prevStory && story)
      ? `Previous chapter:\n${prevStory}\n\n---\n\nCurrent chapter:\n${story}`
      : story;
    const lessonOpts = { userTranslation: storyTranslation || null, userDialect: userDialect || null,
      writingStyle: storyStyle || null, storyLang, story: combinedStory,
      chainVocab: _vocabMode !== 'neutral' ? chainVocab.words : [],
      vocabMode: _vocabMode };
    // (styleHint removed — story context passed via userMsg in generateOneLesson)
    try {
      const lessonOptsWithChain = { ...lessonOpts, chainVocab: chainVocab.words };
      const { lesson, tokens } = await generateOneLesson(
        lang, srcLang, topic, 1, 1, [], story, difficulty, jobId, lessonOptsWithChain);
      lessons.push(lesson);
      totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
      lessonTokenStats.push(tokens);
    } catch(e) {
      throw new Error(`Lesson generation failed: ${e.message}`);
    }
    if (isAllTypes) {
      // Generate grammar, conjugation, and error_hunt as additional lessons
      const extraFmts = [
        { fmt: 'grammar',     label: 'Grammar',     fn: () => generateGrammar(topic, lang, srcLang, difficulty, jobId, chainOpts) },
        { fmt: 'conjugation', label: 'Conjugation', fn: () => generateConjugation(topic, lang, srcLang, difficulty, jobId, chainOpts) },
        { fmt: 'error_hunt',  label: 'Error Hunt',  fn: () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words) },
      ];
      for (const { fmt: eFmt, label, fn } of extraFmts) {
        try {
          const { lesson: eLesson, tokens: eTokens } = await fn();
          lessons.push(eLesson);
          totalPromptTokens += eTokens.promptTokens; totalCompletionTokens += eTokens.completionTokens;
          lessonTokenStats.push(eTokens);
        } catch(e) {
          console.warn(`  ${label} lesson failed, skipping: ${e.message}`);
          jobStep(jobId, `⚠ ${label} failed — continuing…`);
        }
      }
    }
  }

  const totalMs = Date.now() - genStart;
  const uniqueModels = [...new Set([OLLAMA_MODEL, OLLAMA_TRANSLATION_MODEL, OLLAMA_LESSON_MODEL])];
  const modelLabel = uniqueModels.join(' / ');
  console.log(`  Done in ${(totalMs/1000).toFixed(1)}s — ${totalPromptTokens+totalCompletionTokens} total tokens`);
  return {
    topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
    userTopic, lang, srcLang, difficulty: difficulty || 2, storyLen,
    story, storyLang, storyPrompt,
    ...(storyTranslation ? { storyTranslation } : {}),
    ...(userStory        ? { userStory }         : {}),
    ...(userTranslation  ? { userTranslation }   : {}),
    ...(userDialect      ? { userDialect }       : {}),
    ...(continuedFrom    ? { continuedFrom }     : {}),
    ...(storyStyle       ? { storyStyle }        : {}),
    ...(lessonFormat && !['standard'].includes(lessonFormat) ? { lessonFormat } : {}),
    lessons,
    generationStats: { totalMs, backend: 'ollama', model: modelLabel,
      lessonFormat: OLLAMA_LESSON_FORMAT,
      totalPromptTokens, totalCompletionTokens, lessons: lessonTokenStats }
  };
}

// ── Repair flagged exercises ──────────────────────────────────────────
// ── Ollama ping & warmup ──────────────────────────────────────────────
function pingOllama() {
  return new Promise(resolve => {
    try {
      const u = new URL('/api/tags', OLLAMA_HOST);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        { hostname: u.hostname, port: u.port||11434, path: u.pathname, method: 'GET' },
        res => { res.resume(); resolve(res.statusCode < 500); }
      );
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch(_) { resolve(false); }
  });
}
async function warmupOllama() {
  const model = OLLAMA_MODEL;
  process.stdout.write(`  Warming up ${model}… `);
  await new Promise(resolve => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      options: { num_predict: 1 }, messages: [{ role: 'user', content: 'hi' }]
    });
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { res.resume(); res.on('end', () => { console.log('ready ✓'); resolve(); }); });
    req.setTimeout(OLLAMA_TIMEOUT, () => { req.destroy(); console.log('timed out (continuing)'); resolve(); });
    req.on('error', () => { console.log('failed (continuing)'); resolve(); });
    req.write(body); req.end();
  });
}

// ── HTTP helpers ──────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => res(b)); req.on('error', rej);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  let active;
  if (BACKEND === 'none') {
    active = 'none';
  } else {
    process.stdout.write('  Checking Ollama… ');
    active = (await pingOllama()) ? 'ollama' : 'none';
    console.log(active === 'ollama' ? 'reachable ✓' : 'not found — offline mode');
  }
  if (active === 'ollama') await warmupOllama();

  console.log('\n🌍  Dreizunge');
  console.log('='.repeat(44));
  console.log(`  Port    : ${PORT}`);
  if (active === 'ollama') {
    console.log(`  Ollama  : ${OLLAMA_HOST}`);
    console.log(`  Story   : ${OLLAMA_MODEL}`);
    if (OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL)
      console.log(`  Transl. : ${OLLAMA_TRANSLATION_MODEL}`);
    else
      console.log(`  Transl. : ${OLLAMA_MODEL} (same)`);
    console.log(`  Lessons : ${OLLAMA_LESSON_MODEL}${OLLAMA_LESSON_FORMAT==='table'?' [table format]':''}`);
  } else {
    console.log('  Backend : offline — only saved lessons available');
  }
  console.log(`  Storage : ${STORAGE_FILE} (${(store.topics||store.lessons||[]).length} topics, schema v${store.schemaVersion||0})`);
  console.log('='.repeat(44) + '\n');

  
// ── v29 storyline sync ────────────────────────────────────────────────────────
// Called after upsert to keep storylines[].chapters in sync
function _topicId(topicName) {
  return 'tp_' + Math.abs(topicName.trim().toLowerCase().split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
}
function _chainId(topicIds) {
  const j = JSON.stringify(topicIds);
  return 'sl_' + Math.abs(j.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
}
function _syncStorylineForTopic(topicName, continuedFromTopic) {
  if (store.schemaVersion < 29) return;
  const tid = _topicId(topicName);
  // Ensure the topic has an id
  const topicObj = findSaved(topicName);
  if (topicObj && !topicObj.id) { topicObj.id = tid; }

  // Build the full chain by walking continuedFrom backwards from this topic
  const chain = [topicName];
  let cur = topicName;
  for (let i = 0; i < 50; i++) {
    const t = findSaved(cur);
    if (!t || !t.continuedFrom) break;
    chain.unshift(t.continuedFrom);
    cur = t.continuedFrom;
  }
  // Walk forward from this topic picking up continuations.
  // Stop if we hit a topic that already belongs to a DIFFERENT storyline
  // (that means we forked, not extended).
  const allSl = getStorylines();
  const topicIdOf = t => { const tp = findSaved(t); return tp?.id || _topicId(t); };
  // Build set of topic ids already in other storylines (not containing the current topic)
  const otherSlTopicIds = new Set(
    allSl.filter(s => !s.chapters.includes(tid))
         .flatMap(s => s.chapters)
  );
  cur = topicName;
  for (let i = 0; i < 50; i++) {
    const candidates = store.topics.filter(t => t.continuedFrom === cur);
    // If multiple topics continue from cur — it's a fork; stop here
    if (candidates.length !== 1) break;
    const next = candidates[0];
    // If next already belongs to another storyline — it's a pre-existing branch; stop
    if (otherSlTopicIds.has(topicIdOf(next.topic))) break;
    chain.push(next.topic);
    cur = next.topic;
  }

  const chapterIds = chain.map(t => topicIdOf(t));
  const slId = _chainId(chapterIds);

  // Find existing storyline that contains this topic
  const existing = allSl.find(s => s.id === slId);
  const partialMatch = !existing ? allSl.find(s => s.chapters.includes(tid)) : null;
  // Also check if any storyline matches the predecessor chain (new topic not yet in any sl)
  const predecessorMatch = (!existing && !partialMatch && chapterIds.length > 1)
    ? allSl.find(s => {
        const pred = chapterIds.slice(0, -1);
        return s.chapters.length === pred.length && pred.every((c, i) => c === s.chapters[i]);
      })
    : null;

  if (existing) {
    // Chain unchanged — nothing to do
  } else if (partialMatch) {
    // This topic was already in a storyline — update it (chain extended from the end)
    // Only update if new chain is a superset (i.e. we added to the end, not forked)
    const isExtension = chapterIds.length > partialMatch.chapters.length &&
      partialMatch.chapters.every((c, i) => c === chapterIds[i]);
    if (isExtension) {
      // Preserve existing id — do not rehash
      partialMatch.chapters = chapterIds;
      setStorylines(allSl.map(s => s.id === partialMatch.id ? partialMatch : s));
    } else {
      // Fork — create a new storyline for the new branch
      upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds,
        lang: topicObj?.lang || null, srcLang: topicObj?.srcLang || null });
    }
  } else if (predecessorMatch) {
    // New topic extends an existing storyline — update chapters in place, preserve id/title/icon/tags
    predecessorMatch.chapters = chapterIds;
    setStorylines(allSl.map(s => s.id === predecessorMatch.id ? predecessorMatch : s));
  } else {
    upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds,
      lang: topicObj?.lang || null, srcLang: topicObj?.srcLang || null });
  }
}

// ── Story diff for ai_error_hunt (sentence-level) ────────────────────────────
function splitSentences(text) {
  // Returns array of clause strings and {para:true} sentinels for paragraph breaks
  const result = [];
  text.split(/\n\n+/).forEach((para, pi) => {
    if (pi > 0) result.push({ para: true });
    const parts = para.trim().split(/(?<=[.!?,;:"""«»„\u2018\u2019])\s*/);
    parts.map(s => s.trim()).filter(Boolean).forEach(s => result.push(s));
  });
  return result;
}

function storyDiffSentences(aiStory, correctedStory, existingSentences) {
  const aRaw = splitSentences(aiStory);
  const bRaw = splitSentences(correctedStory);
  // Track para-break positions in ai clauses before stripping sentinels
  const aiParaBefore = new Set();
  let paused = false, clauseIdx = 0;
  aRaw.forEach(s => {
    if (typeof s !== 'string') { paused = true; return; }
    if (paused) { aiParaBefore.add(clauseIdx); paused = false; }
    clauseIdx++;
  });
  const aArr = aRaw.filter(s => typeof s === 'string');
  const bArr = bRaw.filter(s => typeof s === 'string');
  const m = aArr.length, n = bArr.length;
  const dp = Array.from({length:m+1}, () => new Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++)
    dp[i][j] = aArr[i-1]===bArr[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
  const ops = []; let i=m, j=n;
  while(i>0||j>0) {
    if(i>0&&j>0&&aArr[i-1]===bArr[j-1]) { ops.unshift({type:'eq',ai:aArr[i-1],corrected:bArr[j-1]}); i--;j--; }
    else if(j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])) { ops.unshift({type:'ins',corrected:bArr[j-1]}); j--; }
    else { ops.unshift({type:'del',ai:aArr[i-1]}); i--; }
  }
  const pairs = []; let k=0;
  while(k<ops.length) {
    const op = ops[k];
    if(op.type==='eq') { pairs.push({ai:op.ai,corrected:op.corrected,changed:false,reason:''}); k++; }
    else {
      let dels=[], ins=[];
      while(k<ops.length && ops[k].type!=='eq') {
        if(ops[k].type==='del') dels.push(ops[k].ai);
        else ins.push(ops[k].corrected);
        k++;
      }
      const maxLen = Math.max(dels.length, ins.length);
      for(let x=0;x<maxLen;x++)
        pairs.push({ai:dels[x]||null,corrected:ins[x]||null,changed:true,reason:''});
    }
  }
  // Preserve existing reasons by matching on ai sentence text
  const reasonMap = new Map();
  if(existingSentences && existingSentences.length)
    existingSentences.forEach(s => { if(s && s.ai && s.reason) reasonMap.set(s.ai, s.reason); });
  // Return sparse: only changed entries
  return pairs
    .filter(p => p.changed)
    .map(p => ({ ai: p.ai, corrected: p.corrected, reason: reasonMap.get(p.ai) || '' }));
}

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const M   = req.method.toUpperCase();

    if (M === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    if (M === 'GET' && url.pathname === '/api/info') {
      return json(res, 200, { backend: active, ollamaModel: OLLAMA_MODEL,
        ollamaTranslationModel: OLLAMA_TRANSLATION_MODEL,
        ollamaLessonModel: OLLAMA_LESSON_MODEL,
        ollamaLessonFormat: OLLAMA_LESSON_FORMAT,
        canGenerate: active !== 'none' });
    }
    if (M === 'GET' && url.pathname === '/api/lessons') {
      const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons || []);
      const list = arr.map(l => ({
        id: l.id || null,
        topic: l.topic, topicEmoji: l.topicEmoji, lang: l.lang || 'it',
        srcLang: l.srcLang || 'en',
        difficulty: l.difficulty || 2,
        storyLen: l.storyLen || 300,
        continuedFrom: l.continuedFrom || null,
        generatedAt: l.generatedAt,
        updatedAt:   l.updatedAt || l.generatedAt,
        lessonCount: l.lessons?.length || 0,
      }));
      list.sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
      return json(res, 200, list);
    }
    if (M === 'GET' && url.pathname === '/api/lessons/load') {
      const t = url.searchParams.get('topic');
      if (!t) return json(res, 400, { error: 'Missing topic' });
      const s = findSaved(t);
      if (!s) return json(res, 404, { error: 'Not found' });
      return json(res, 200, s);
    }
    if (M === 'POST' && url.pathname === '/api/lessons/save-meta') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { oldTopic, newTopic, topicEmoji } = body;
      if (!oldTopic || !newTopic) return json(res, 400, { error: 'Missing oldTopic or newTopic' });
      const saved = findSaved(oldTopic);
      if (!saved) {
        // Maybe the topic was already renamed — check if newTopic exists
        const alreadyRenamed = newTopic && findSaved(newTopic);
        if (alreadyRenamed) {
          console.log(`  save-meta: "${oldTopic}" already renamed to "${newTopic}" — no-op`);
          return json(res, 200, { ok: true, topic: alreadyRenamed.topic, topicEmoji: alreadyRenamed.topicEmoji });
        }
        console.warn(`  save-meta: topic not found: "${oldTopic}" (schema v${store.schemaVersion}, ${(store.topics||store.lessons||[]).length} topics)`);
        return json(res, 404, { error: `Topic not found: "${oldTopic.slice(0,40)}"` });
      }
      // No-op if topic name unchanged
      if (oldTopic.trim().toLowerCase() === newTopic.trim().toLowerCase() && !topicEmoji) return json(res, 200, { ok: true });
      saved.topic = newTopic.trim().slice(0, 80);
      if (topicEmoji) saved.topicEmoji = topicEmoji;
      const newLower = newTopic.trim().toLowerCase();
      const oldLower = oldTopic.trim().toLowerCase();
      // Update in the correct array
      const arr = store.schemaVersion >= 29 ? store.topics : store.lessons;
      // Filter out old entry (and new if already exists), but guard against both being same
      const filtered = oldLower === newLower
        ? arr.filter(l => l.topic.toLowerCase() !== oldLower)
        : arr.filter(l => l.topic.toLowerCase() !== oldLower && l.topic.toLowerCase() !== newLower);
      filtered.unshift(saved);
      if (store.schemaVersion >= 29) store.topics = filtered; else store.lessons = filtered;
      // Cascade rename into continuedFrom pointers
      const curArr = store.schemaVersion >= 29 ? store.topics : store.lessons;
      curArr.forEach(l => {
        if (l.continuedFrom && l.continuedFrom.toLowerCase() === oldLower)
          l.continuedFrom = saved.topic;
      });
      saveStore(store);
      console.log(`  Renamed: "${oldTopic}" → "${saved.topic}"`);
      return json(res, 200, { ok: true, topic: saved.topic, topicEmoji: saved.topicEmoji });
    }
    if (M === 'DELETE' && url.pathname === '/api/lessons/delete') {
      const t = url.searchParams.get('topic');
      if (!t) return json(res, 400, { error: 'Missing topic' });
      const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons || []);
      const toDelete = arr.find(l => l.topic.toLowerCase() === t.trim().toLowerCase());
      const deleteId = toDelete?.id;
      if (store.schemaVersion >= 29) {
        store.topics = store.topics.filter(l => l.topic.toLowerCase() !== t.trim().toLowerCase());
        // Remove from storyline chapters, remove empty storylines
        store.storylines = store.storylines.map(sl => ({
          ...sl, chapters: sl.chapters.filter(c => c !== deleteId)
        })).filter(sl => sl.chapters.length > 0);
      } else {
        // This branch only reached in legacy mode
        store.lessons = (store.lessons||[]).filter(l => l.topic.toLowerCase() !== t.trim().toLowerCase());
      }
      // Delete all flags associated with this topic (by slug and by id)
      const flags = getFlags();
      const delSlug = topicSlug(t.trim()) + ':';
      const delId   = deleteId ? deleteId + ':' : null;
      let flagsDeleted = 0;
      Object.keys(flags).forEach(k => {
        if (k.startsWith(delSlug) || (delId && k.startsWith(delId))) {
          delete flags[k]; flagsDeleted++;
        }
      });
      if (flagsDeleted > 0) {
        setFlags(flags);
        console.log(`  Deleted ${flagsDeleted} flag(s) for "${t.trim()}"`);
      }
      saveStore(store);
      return json(res, 200, { ok: true });
    }
    if (M === 'GET' && url.pathname === '/api/flags') {
      return json(res, 200, getFlags());
    }
    if (M === 'POST' && url.pathname === '/api/flags') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { key, entry } = body;
      if (!key) return json(res, 400, { error: 'Missing key' });
      const flags = getFlags();
      if (entry === null || entry === undefined) {
        delete flags[key]; console.log(`  Flag removed: ${key}`);
      } else {
        flags[key] = entry;
        console.log(`  Flag saved: ${key}${entry.comment?' (with comment)':''}`);
      }
      setFlags(flags);
      return json(res, 200, { ok: true });
    }

    // ── Storyline titles ─────────────────────────────────────────────
    if (M === 'GET' && url.pathname === '/api/storylines') {
      return json(res, 200, getStorylines());
    }
    if (M === 'POST' && url.pathname === '/api/storylines') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, chainKey, title, icon, summary, tags, chapters } = body;
      const targetId = slId || chainKey;
      if (!targetId) return json(res, 400, { error: 'Missing slId' });
      if (title === null) {
        // Delete storyline
        setStorylines(getStorylines().filter(s => s.id !== targetId));
      } else {
        const patch = { id: targetId };
        if (title     !== undefined) patch.title   = (title||'').slice(0,80);
        if (icon      !== undefined) patch.icon    = (icon||'📖').slice(0,10);
        if (summary   !== undefined) patch.summary = typeof summary === 'string' ? summary.slice(0,2000) : summary;
        if (tags      !== undefined) patch.tags    = Array.isArray(tags) ? tags.map(t=>String(t).slice(0,50)) : [];
        if (chapters  !== undefined) patch.chapters = Array.isArray(chapters) ? chapters : [];
        upsertStoryline(patch);
      }
      return json(res, 200, { ok: true });
    }
    if (M === 'POST' && url.pathname === '/api/build-static') {
      const scriptPath = path.join(__dirname, 'build-static.js');
      execFile('node', [scriptPath], { cwd: __dirname, timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('build-static failed:', stderr || err.message);
          return json(res, 500, { error: (stderr || err.message).slice(0, 200) });
        }
        console.log('build-static:', stdout.trim());
        return json(res, 200, { ok: true, output: stdout.trim().slice(0, 500) });
      });
      return; // response sent by callback
    }

    if (M === 'POST' && url.pathname === '/api/storyline-title') {
      if (active === 'none' && fmt !== 'math') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topics, slId } = body;
      if (!Array.isArray(topics) || !topics.length) return json(res, 400, { error: 'Missing topics array' });
      const stories = topics.map(t => (findSaved(t)||{}).story || '');
      const srcLang = (findSaved(topics[0])||{}).srcLang || 'en';
      try {
        const result = await generateStorylineTitle(topics, stories, srcLang);
        // Auto-save into storylines if slId provided
        if (slId && result.title) {
          upsertStoryline({ id: slId, title: result.title, icon: result.icon || '📖' });
        }
        return json(res, 200, result);
      } catch(e) {
        return json(res, 500, { error: e.message });
      }
    }

    // ── Job status polling ────────────────────────────────────────────
    if (M === 'GET' && url.pathname.startsWith('/api/job/')) {
      const jobId = url.pathname.split('/')[3];
      const job = jobs.get(jobId);
      if (!job) return json(res, 404, { error: 'Job not found' });
      return json(res, 200, { status: job.status, step: job.step,
        data: job.data, error: job.error });
    }

    // ── Cancel job ──────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/jobs/cancel') {
      let body; try { body = JSON.parse(await readBody(req)); } catch(e) { body = {}; }
      const { jobId } = body;
      if (jobId && jobs.has(jobId)) {
        const job = jobs.get(jobId);
        if (job.status === 'running' || job.status === 'pending') {
          job.status = 'cancelled'; job.step = 'Cancelled';
          if (job.abort) job.abort();
          console.log('  Job cancelled:', jobId);
        }
      }
      return json(res, 200, { ok: true });
    }

    // ── Generate (async — returns jobId immediately) ─────────────
    if (M === 'POST' && url.pathname === '/api/generate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const { topic, lang, srcLang, difficulty, lessonFormat, storyLen, continuedFrom, forceRegenerate,
              userStory, userTranslation, userDialect, storyStyle, reinforcePrior, vocabMode, useFullChain, userStoryLang, mathInstruction } = body;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math'].includes(lessonFormat) ? lessonFormat : 'standard';
      const wcMax = body.userStory ? 2000 : 1000;
      const wc = Math.max(100, Math.min(wcMax, parseInt(storyLen, 10) || 300));
      // contFrom: used for storyline chain tracking AND story continuation context.
      // When userStory is provided we still track the chain, but don't pass contFrom
      // to generate() for story context (user supplied their own text).
      const contFrom = (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
      // When user provides a story AND continues from a prior chapter,
      // pass both the previous story AND the new story as context.
      const contFromForStory = contFrom && !userStory ? contFrom : null;
      const combinedUserStory = (userStory && contFrom) ? contFrom : null;
      const topicKey = topic.trim().toLowerCase();
      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached) { console.log(`  Cache hit: "${topic}"`); return json(res, 200, { cached: true, data: { ...cached, fromCache: true } }); }
      }
      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Start Ollama, then restart.' });
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already generating lessons for this topic. Please wait.' });
      const jobId = newJob();
      generatingTopics.add(topicKey);
      const resolvedSrcLang = srcLang || 'en';
      const userOpts = {
        userStory:       userStory       ? String(userStory).trim()       : null,
        userStoryLang:   userStoryLang   ? String(userStoryLang)          : null,
        prevStoryTopic:  combinedUserStory || null,
        userTranslation: userTranslation ? String(userTranslation).trim() : null,
        userDialect:     userDialect     ? String(userDialect).trim()     : null,
        storyStyle:      (storyStyle && getStoryStyle(storyStyle) !== undefined) ? storyStyle : null,
        lessonFormat:    fmt,
        reinforcePrior:  reinforcePrior === true,
        vocabMode:       vocabMode ? String(vocabMode) : null,
        useFullChain:    useFullChain === true,
        mathInstruction: mathInstruction ? String(mathInstruction).slice(0,500) : null,
      };
      console.log(`  Generating: "${topic}" (${langName(lang||'it')}, from ${langName(resolvedSrcLang)}) diff=${diff} fmt=${fmt} storyLen=${wc}${userOpts.userStory?' userStory=yes':''}${userOpts.userTranslation?' translation=yes':''}${userOpts.userDialect?' dialect='+userOpts.userDialect:''}${userOpts.storyStyle?' style='+userOpts.storyStyle:''}${contFrom?' cont='+contFrom:''} job=${jobId}`);
      generate(topic.trim(), lang || 'it', resolvedSrcLang, diff, contFromForStory, wc, jobId, userOpts).then(data => {
        upsert(data);
        // v29: assign stable topic id if missing, then update storyline chain
        if (store.schemaVersion >= 29) {
          const saved = findSaved(data.topic);
          if (saved && !saved.id) {
            saved.id = 'tp_' + Math.abs(data.topic.trim().toLowerCase().split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
            upsert(saved);
          }
          _syncStorylineForTopic(data.topic, contFrom);
        }
        console.log(`  Saved: "${data.topic}" (${data.lessons.length} lessons)`);
        jobDone(jobId, { ...data, fromCache: false });
      }).catch(e => {
        console.error('  Generation error:', e.message);
        jobFail(jobId, e.message);
      }).finally(() => {
        generatingTopics.delete(topicKey);
      });
      return json(res, 202, { jobId });
    }

    // ── Save topic story ─────────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/save-story') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, story, generateAiHunt } = body;
      if (!topic || story === undefined) return json(res, 400, { error: 'Missing topic or story' });
      const saved = findSaved(topic);
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      // Set aiStory on first save (immutable original AI text)
      if (!saved.aiStory) {
        saved.aiStory = saved.story || story;
        console.log(`  Set aiStory for "${topic}" (${saved.aiStory.length} chars)`);
      }
      saved.story = story;
      saved.updatedAt = new Date().toISOString();
      let aiHuntEdits;
      if (generateAiHunt && saved.aiStory && saved.aiStory !== story) {
        const existing = (saved.lessons||[]).find(l => l.type === 'ai_error_hunt');
        const sentences = storyDiffSentences(saved.aiStory, story, existing?.sentences);
        const lesson = {
          id: existing?.id || ('aeh_' + Date.now()),
          type: 'ai_error_hunt',
          title: existing?.title || 'AI Error Hunt',
          desc: 'Find AI errors that were corrected by a human tutor.',
          icon: '🔎',
          aiStory: saved.aiStory,
          sentences,
        };
        if (existing) {
          saved.lessons[saved.lessons.indexOf(existing)] = lesson;
        } else {
          if (!saved.lessons) saved.lessons = [];
          saved.lessons.push(lesson);
        }
        aiHuntEdits = sentences;
        console.log(`  ai_error_hunt: ${sentences.length} changed sentences (sparse)`);
      }
      saveStore(store);
      console.log(`  Saved story for "${topic}" (${story.length} chars)`);
      return json(res, 200, { ok: true, aiStory: saved.aiStory, edits: aiHuntEdits });
    }

    // ── Direct lesson edit ───────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/edit') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, lessons } = body;
      if (!topic || !lessons) return json(res, 400, { error: 'Missing topic or lessons' });
      const saved = findSaved(topic);
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      // Only update vocab/sentences/grammar fields — preserve all other data
      const origLessons = saved.lessons.slice();
      saved.lessons = lessons.map((edited, i) => {
        const orig = origLessons.find(ls => ls.id === edited.id) || origLessons[i] || {};
        return {
          ...orig,
          ...(edited.title !== undefined ? { title: edited.title } : {}),
          ...(edited.icon  !== undefined ? { icon:  edited.icon  } : {}),
          vocab:     edited.vocab     ? edited.vocab.map((v,j) => ({...(orig.vocab||[])[j]||{}, ...v})) : orig.vocab,
          sentences: edited.sentences ? edited.sentences.map((s,j) => ({...(orig.sentences||[])[j]||{}, ...s})) : orig.sentences,
          grammar:   edited.grammar   ? edited.grammar.map((g,j) => ({...(orig.grammar||[])[j]||{}, ...g})) : orig.grammar,
          conjugations: edited.conjugations ? edited.conjugations.map((c,j) => ({
            ...(orig.conjugations||[])[j]||{}, ...c,
            forms: c.forms ? c.forms.map((f,k) => ({...((orig.conjugations||[])[j]?.forms||[])[k]||{}, ...f})) : (orig.conjugations||[])[j]?.forms,
          })) : orig.conjugations,
          ...(edited.corruptedStory !== undefined ? { corruptedStory: edited.corruptedStory } : {}),
          ...(edited.correctStory   !== undefined ? { correctStory:   edited.correctStory   } : {}),
          ...(edited._hidden         !== undefined ? { _hidden:         edited._hidden         } : {}),
          edits: edited.edits ? edited.edits.map((e,j) => ({...(orig.edits||[])[j]||{}, ...e})) : orig.edits,
        };
      });
      saved.updatedAt = new Date().toISOString();
      saveStore(store);
      console.log(`  Edited lessons for "${topic}"`);
      return json(res, 200, { ok: true });
    }

    // ── Add lesson to existing topic ──────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/add-lesson') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, lessonFormat: fmt, difficulty: rawDiff, reinforcePrior: addReinforce, vocabMode: addVocabMode, mathInstruction: addMathInstr, mathOps: addMathOps } = body;
      if (!topic)  return json(res, 400, { error: 'Missing topic' });
      if (!fmt)    return json(res, 400, { error: 'Missing lessonFormat' });
      const saved = findSaved(topic.trim());
      if (!saved)  return json(res, 404, { error: `Topic not found: ${topic}` });
      if (!saved.story) return json(res, 400, { error: 'Topic has no story to base lessons on' });
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      const topicKey = topic.trim().toLowerCase();
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already busy with this topic. Please wait.' });
      const diff  = Math.max(1, Math.min(3, parseInt(rawDiff, 10) || saved.difficulty || 2));
      const lang     = saved.lang    || 'it';
      const srcLang  = saved.srcLang || 'en';
      const dialect  = saved.userDialect || null;
      const style    = saved.storyStyle  || null;
      const story    = saved.story;
      const jobId = newJob();
      generatingTopics.add(topicKey);
      console.log(`  Add lesson: "${topic}" fmt=${fmt} diff=${diff} reinforce=${!!addReinforce}`);

      const doGenLesson = async () => {
        let result;
        const chainVocab = (addReinforce === true) ? collectChainVocab(saved.continuedFrom || null) : { words: [], nouns: [], verbs: [] };
        if (fmt === 'standard') {
          const storyTranslation = saved.storyTranslation || null;
          // Don't pass story as styleHint — it's already in userMsg as context
          const lessonOpts = { userTranslation: storyTranslation, userDialect: dialect, writingStyle: style, storyLang: saved.storyLang || 'target', story: saved.story || null, chainVocab: chainVocab.words };
          result = await generateOneLesson(lang, srcLang, topic.trim(), 1, 1, [], story, diff, jobId, lessonOpts);
        } else if (fmt === 'error_hunt') {
          result = await generateErrorHunt(story, lang, diff, jobId, chainVocab.words);
        } else if (fmt === 'grammar') {
          result = await generateGrammar(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab });
        } else if (fmt === 'conjugation') {
          result = await generateConjugation(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab });
        } else if (fmt === 'math') {
          result = addMathInstr
            ? await generateMathLLM(lang, srcLang, diff, addMathInstr, jobId)
            : generateMath(story, diff, addMathOps || null);
        } else {
          throw new Error(`Unsupported lessonFormat: ${fmt}`);
        }
        // Compute next available ID (avoid clashing with existing)
        // Generate a stable string ID for the new lesson
        const newLessonId = 'ls_' + Date.now();
        const newLesson = { ...result.lesson, id: newLessonId };
        // Always append — ➕ button adds a new lesson set, never replaces
        saved.lessons.push(newLesson);
        console.log(`    Appended ${fmt} lesson (id ${newLesson.id}), total: ${saved.lessons.length}`);
        saved.updatedAt = new Date().toISOString();
        saveStore(store);
        return { lesson: newLesson, topic: saved.topic, lessonCount: saved.lessons.length };
      };

      doGenLesson().then(data => {
        jobDone(jobId, data);
      }).catch(e => {
        console.error(`  Add-lesson error:`, e.message);
        jobFail(jobId, e.message);
      }).finally(() => {
        generatingTopics.delete(topicKey);
      });
      return json(res, 202, { jobId });
    }

    // ── Storyline summary ────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/storyline-summary') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, topics } = body;
      if (!slId || !Array.isArray(topics) || !topics.length)
        return json(res, 400, { error: 'Missing slId or topics' });
      const topicData = topics.map(t => findSaved(t)).filter(Boolean);
      if (!topicData.length) return json(res, 404, { error: 'No topics found' });
      const stories  = topicData.map(t => t.story || '');
      const srcLang  = topicData[0].srcLang || 'en';
      const vocab    = topicData.flatMap(t =>
        (t.lessons||[]).flatMap(ls => (ls.vocab||[]).map(v => v.source || v.target))
      );
      try {
        const summary = await generateStorylineSummary(topics, stories, vocab, srcLang);
        // Persist on the storyline object
        const sl = findStoryline(slId);
        if (sl) { sl.summary = summary; upsertStoryline(sl); }
        return json(res, 200, { summary });
      } catch(e) {
        return json(res, 500, { error: e.message });
      }
    }


    // ── Rate a topic ──────────────────────────────────────────────────

    // ── Import lessons.json ───────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/import') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      // Accept v29 {topics:[],storylines:[]} or legacy {lessons:[]} or bare array
      let incoming, incomingStorylines = [];
      if (body && body.schemaVersion >= 29 && Array.isArray(body.topics)) {
        incoming = body.topics;
        incomingStorylines = body.storylines || [];
      } else {
        incoming = Array.isArray(body) ? body : body.lessons;
      }
      if (!Array.isArray(incoming) || incoming.length === 0)
        return json(res, 400, { error: 'Expected {topics:[...]} or {lessons:[...]} or a non-empty array' });
      const invalid = incoming.filter(l => !l.topic || !Array.isArray(l.lessons));
      if (invalid.length)
        return json(res, 400, { error: `${invalid.length} entries missing topic or lessons` });
      let added = 0, updated = 0;
      for (const l of incoming) {
        const exists = findSaved(l.topic);
        upsert(l);
        if (exists) updated++; else added++;
      }
      // Reconstruct storylines:
      // 1. Merge explicitly exported storylines (new format)
      for (const sl of incomingStorylines) {
        const existing = findStoryline(sl.id);
        if (!existing) { upsertStoryline(sl); }
        else if ((sl.chapters||[]).length > (existing.chapters||[]).length) {
          // Only extend, never shrink
          upsertStoryline(sl);
        } else {
          // Update title/icon/summary but preserve existing chapters
          upsertStoryline({ ...sl, chapters: existing.chapters });
        }
      }
      // 2. For old-format exports (no storylines array), rebuild chains from continuedFrom
      if (incomingStorylines.length === 0) {
        // Process in order — each call extends the chain correctly
        for (const l of incoming) {
          _syncStorylineForTopic(l.topic, l.continuedFrom || null);
        }
      }
      const total = store.schemaVersion >= 29 ? store.topics.length : store.lessons.length;
      console.log(`  Import: +${added} new, ~${updated} updated`);
      return json(res, 200, { ok: true, added, updated, total });
    }

    if (M === 'GET' && url.pathname === '/api/languages') {
      return json(res, 200, _langsData);
    }
    // ── UI strings ────────────────────────────────────────────────────
    if (M === 'GET' && url.pathname === '/api/ui') {
      // Return all UI strings for all languages
      return json(res, 200, uiStrings);
    }
    if (M === 'GET' && url.pathname === '/api/ui/lang') {
      const lang = url.searchParams.get('lang') || 'en';
      if (lang === 'en') return json(res, 200, uiStrings['en'] || {});
      // Return only the requested language — empty object signals "not yet translated"
      // so the client can trigger /api/ui-translate
      const strings = uiStrings[lang] || {};
      return json(res, 200, strings);
    }
    if (M === 'POST' && url.pathname === '/api/ui-translate') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { lang } = body;
      if (!lang) return json(res, 400, { error: 'Missing lang' });
      try {
        const result = await translateUIToLang(lang);
        return json(res, 200, { ok: true, lang, count: Object.keys(result).length });
      } catch(e) {
        return json(res, 500, { error: e.message });
      }
    }

        res.writeHead(404); res.end('Not found');

  }).listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const lanIp = Object.values(os.networkInterfaces()).flat()
      .find(i => i.family === 'IPv4' && !i.internal)?.address || 'unknown';
    console.log(`  Local : http://localhost:${PORT}`);
    console.log(`  LAN   : http://${lanIp}:${PORT}\n`);
  });
}

boot().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
