#!/usr/bin/env node
'use strict';

const http  = require('http');
const { execFile } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { callLLM: _callLLM, ping: pingOllama, release: releaseOllamaModel,
        warmup: _warmupLLM, stripRaw, extractJSON, extractArray, salvageArray } = require('./llm');
const { buildExport } = require('./export-lessons');

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
const APP_VERSION  = 'v44';
const STORAGE_FILE = process.env.LESSONS_FILE || path.join(__dirname, 'lessons.json');
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

// ── v41 Topic-ID data check ───────────────────────────────────────────
// Stable tp_ IDs are the canonical reference for chain navigation. New topics
// get their id at generate time, and imported topics via _syncStorylineForTopic,
// so no per-boot migration is needed. A pre-v41 lessons.json (topics missing
// ids, or continuedFrom names never resolved to continuedFromId) must be
// upgraded ONCE, out-of-band:  node migrate-v41.js <lessons.json>
(function checkTopicIds() {
  if (store.schemaVersion < 29) return;
  const topics = store.topics || [];
  const missing = topics.filter(t => !t.id).length;
  // continuedFromId absent (never set) — distinct from a resolved-to-null orphan
  const unresolved = topics.filter(t => t.continuedFrom && t.continuedFromId === undefined).length;
  if (missing || unresolved) {
    console.warn(`  ⚠ Pre-v41 data: ${missing} topic(s) without id, ${unresolved} unresolved continuedFrom.`);
    console.warn(`    Run once:  node migrate-v41.js ${process.env.LESSONS_FILE || 'lessons.json'}`);
  }
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

// Walk the chain by continuedFromId and collect all vocab/grammar/conjugation
// targets from all prior chapters, deduplicated. Returns { words, nouns, verbs }.
// startRef is the PARENT reference: a tp_ id (preferred) or a topic name
// (back-compat — resolved once, then traversal is id-based).
function collectChainVocab(startRef) {
  if (!startRef) return { words: [], nouns: [], verbs: [] };
  const words = [], nouns = [], verbs = [];
  const seen = new Set();
  // Resolve start: id walks via findSavedById; a name is resolved once.
  let t = String(startRef).startsWith('tp_') ? findSavedById(startRef) : findSaved(startRef);
  const visited = new Set();
  while (t && !visited.has(t.id)) {
    visited.add(t.id);
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
    // Step to parent by stored id (fall back to resolving a name for
    // un-migrated/imported entries that lack continuedFromId).
    const pid = t.continuedFromId || (t.continuedFrom ? (findSaved(t.continuedFrom)?.id || null) : null);
    t = pid ? findSavedById(pid) : null;
  }
  return { words, nouns, verbs };
}
function upsert(data) {
  const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons = store.lessons || []) && store.lessons;
  let i;
  if (store.schemaVersion >= 29 && data.id) {
    // Has a stable id → match by id ONLY. An id with no match is a new topic and
    // must NOT be merged into a same-named one (same-name topics may coexist).
    i = arr.findIndex(l => l.id === data.id);
  } else {
    // No id (fresh generation / legacy) → dedup by name+lang so a regenerate
    // updates in place rather than duplicating.
    const k = data.topic.toLowerCase();
    const lang = data.lang || '', srcLang = data.srcLang || '';
    i = store.schemaVersion >= 29
      ? arr.findIndex(l => l.topic.toLowerCase() === k && (l.lang||'') === lang && (l.srcLang||'') === srcLang)
      : arr.findIndex(l => l.topic.toLowerCase() === k);
  }
  const now = new Date().toISOString();
  const existing = i >= 0 ? arr[i] : null;
  const entry = { ...data, generatedAt: existing?.generatedAt || now, updatedAt: now };
  // Keep the topic's stable id across an update even if the new data omits it.
  if (existing && existing.id && !entry.id) entry.id = existing.id;
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

  if (vocab.length < 1) throw new Error(`Table parse: only ${vocab.length} vocab rows`);

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

// ── LLM backends ──────────────────────────────────────────────────────
function callLLM(system, userMsg, maxTokens) {
  return _callLLM(OLLAMA_MODEL, system, userMsg, maxTokens);
}
function callLLMLesson(system, userMsg, maxTokens) {
  return _callLLM(OLLAMA_LESSON_MODEL, system, userMsg, maxTokens);
}
function callLLMTranslation(system, userMsg, maxTokens) {
  return _callLLM(OLLAMA_TRANSLATION_MODEL, system, userMsg, maxTokens);
}

// ── QC: verify source/target pairs with the translation model ─────────────
const _QC_KANJI = '\\u4e00-\\u9fff\\u3400-\\u4dbf々〆〇';
function _qcStripFuri(t) {
  if (!t) return '';
  return String(t)
    .replace(new RegExp('([^'+_QC_KANJI+'])\\[[^\\]]+\\]','g'), '$1')
    .replace(new RegExp('(['+_QC_KANJI+']+)\\[([^\\]]+)\\]','g'), '$1');
}
// Returns { ok:true } or { ok:false, sug:'corrected source' }.
async function qcCheckPair(target, source, lang, srcLang, userComment) {
  const L = langName(lang), S = langName(srcLang || 'en');
  const tgt = _qcStripFuri(target);
  const src = String(source).trim();
  const system =
    `You check a ${L} phrase and its ${S} translation, given as "<${L}> => <${S}>".\n` +
    `Check BOTH: (1) the ${L} text is correct — spelling, grammar, and capitalization ` +
    `(apply ${L} capitalization rules, e.g. German capitalizes all nouns); ` +
    `(2) the ${S} side is an accurate translation of the ${L} text.\n` +
    (userComment && String(userComment).trim()
      ? `The user reports a problem with this item: "${String(userComment).trim().replace(/"/g, "'").slice(0, 300)}". Take this report into account when checking.\n`
      : '') +
    `Reply EXACTLY one of:\n` +
    `OK  — if both are correct.\n` +
    `T: <corrected ${L} text only>  — if the ${L} text has an error.\n` +
    `S: <corrected ${S} text only>  — if the ${L} is fine but the ${S} translation is wrong.\n` +
    `Give ONLY the corrected text for the one side, never the "=>" pair, no quotes, no notes.`;
  const { text } = await callLLMTranslation(system, `${tgt} => ${src}`, 96);
  const reply = (text || '').trim();
  if (!reply || /^ok[.!]?$/i.test(reply)) return { ok: true };
  const clean = s => s.replace(/^["']|["']$/g, '').trim();
  // Strip an optional leading T:/S: label.
  let label = null, body = reply;
  const m = reply.match(/^([TS])\s*[:\-]\s*([\s\S]+)/i);
  if (m) { label = m[1].toUpperCase(); body = m[2]; }
  body = clean(body);
  // Detect changes case-SENSITIVELY — a capitalization difference is itself a valid fix.
  if (body.includes('=>')) {
    const parts = body.split('=>');
    const l = clean(parts[0] || ''), r = clean(parts.slice(1).join('=>'));
    const tgtChanged = l && l !== tgt;
    const srcChanged = r && r !== src;
    if (srcChanged && !tgtChanged) return { ok: false, field: 'source', sug: r };
    if (tgtChanged) return { ok: false, field: 'target', sug: l };
    return { ok: true };
  }
  if (label === 'T') return (body && body !== tgt) ? { ok: false, field: 'target', sug: body } : { ok: true };
  if (label === 'S') return (body && body !== src) ? { ok: false, field: 'source', sug: body } : { ok: true };
  // No label: decide which side the reply corrects by similarity (a case-only fix
  // matches that side when lowercased). Common-prefix length is a cheap proxy.
  if (!body || body === tgt || body === src) return { ok: true };
  const pre = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  return (pre(body, tgt) >= pre(body, src))
    ? { ok: false, field: 'target', sug: body }
    : { ok: false, field: 'source', sug: body };
}
async function _runQc(jobId, topics, opts) {
  const { lessonIdx, onlyFlagged } = opts;
  let checked = 0, flagged = 0, cleared = 0;
  const affected = [];
  console.log(`  ⚙ QC starting: ${topics.length} topic(s)${lessonIdx !== null ? `, lesson ${lessonIdx}` : ''}${onlyFlagged ? ', flagged-only' : ''} [${OLLAMA_TRANSLATION_MODEL}]`);
  jobStep(jobId, `[${OLLAMA_TRANSLATION_MODEL}] Starting QC…`);
  for (let ti = 0; ti < topics.length; ti++) {
    const tp = topics[ti];
    const lessons = tp.lessons || [];
    let touched = false;
    for (let li = 0; li < lessons.length; li++) {
      if (lessonIdx !== null && li !== lessonIdx) continue;
      const ls = lessons[li];
      if (onlyFlagged && !_qcLessonUserFlagged(tp, ls)) continue;
      for (const key of ['vocab', 'sentences']) {
        const arr = ls[key];
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
          if (!item || !item.target || !item.source) continue;
          checked++;
          let res;
          try { res = await qcCheckPair(item.target, item.source, tp.lang, tp.srcLang, item.userFlag?.comment); }
          catch (e) { continue; }
          if (!res.ok) {
            item.qc = { sug: res.sug, field: res.field || 'source', at: new Date().toISOString() };
            flagged++; touched = true;
            console.log(`    ⚑ flag [${res.field}] "${_qcStripFuri(item.target)}" / "${item.source}" → "${res.sug}"`);
          } else if (item.qc) {
            delete item.qc; cleared++; touched = true;   // re-checked and now OK
          }
          if (checked % 5 === 0)
            jobStep(jobId, `[${OLLAMA_TRANSLATION_MODEL}] QC ${tp.topic} — ${checked} checked, ${flagged} flagged…`);
        }
      }
    }
    if (touched) { upsert(tp); affected.push(tp.id); }
  }
  jobDone(jobId, { checked, flagged, cleared, topics: topics.length, affected });
  console.log(`  ✓ QC done: ${checked} checked, ${flagged} flagged, ${cleared} cleared across ${topics.length} topic(s)`);
}
// Legacy user-flags-as-filter: a lesson counts as flagged if any of its items'
// targets appear in the stored flags for this topic. Conservative best-effort.
function _qcLessonUserFlagged(tp, ls) {
  const flags = getFlags();
  const keys = Object.keys(flags);
  if (!keys.length) return false;
  const targets = [...(ls.vocab||[]), ...(ls.sentences||[]), ...(ls.grammar||[])]
    .map(x => (x && x.target ? String(x.target).toLowerCase() : '')).filter(Boolean);
  return keys.some(k => targets.some(tg => k.toLowerCase().includes(tg)));
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
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 80);
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
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 400);
  const summary = result.text.trim();
  console.log(`  Summary  : ${summary.slice(0,80)}…`);
  console.log('────────────────────────────────────────────────────\n');
  return summary;
}

// Generate coherent per-chapter titles + emojis for a whole storyline at once,
// so they read as a set. Returns an array of { title, emoji } (length = stories.length).
async function generateChapterMeta(stories, srcLang, lang) {
  srcLang = srcLang || 'en';
  const S = langName(srcLang);
  const n = stories.length;
  const chapterExcerpts = stories.map((s, i) =>
    `Chapter ${i+1}: ${(s||'').slice(0, 400).replace(/\n/g,' ')}…`
  ).join('\n\n');
  const sys  = fillPrompt(PROMPTS.chapterTitles.system, { S, n });
  const user = fillPrompt(PROMPTS.chapterTitles.user,   { chapterExcerpts, S, n });
  console.log(`\n── Chapter-title post-pass ──────────────────────────`);
  console.log(`  Chapters : ${n}, Lang: ${S}, Model: ${OLLAMA_MODEL}`);
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 60 * n + 120);
  const raw = result.text;
  let arr;
  try { arr = JSON.parse(stripRaw(raw)); }
  catch(_) {
    try { arr = extractArray(raw); }
    catch(_2) {
      try { arr = salvageArray(raw); }
      catch(_3) {
        // Last resort: pull each {…} object out and regex its title/emoji. Tolerates
        // almost any malformed JSON (stray '.', unescaped chars, etc.).
        const objs = stripRaw(raw).match(/\{[^{}]*\}/g) || [];
        arr = objs.map(o => {
          const tm = o.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const em = o.match(/"(?:emoji|icon)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          return tm ? { title: tm[1], emoji: em ? em[1] : '📖' } : null;
        }).filter(Boolean);
        if (!arr.length) throw new Error('Could not parse chapter-titles array: ' + stripRaw(raw).slice(0,120));
      }
    }
  }
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of {title,emoji}');
  console.log(`  Titles   : ${arr.map(o => (o&&(o.emoji||o.icon)||'')+' '+(o&&(o.title||o.t)||'')).join(' | ').slice(0,160)}`);
  console.log('────────────────────────────────────────────────────\n');
  return arr.map(o => ({
    title: ((o && (o.title || o.t)) || '').toString().trim().slice(0, 80),
    emoji: ((o && (o.emoji || o.icon || o.e)) || '📖').toString().slice(0, 8),
  }));
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
    const nExercises = difficulty * 5;
    //const nExercises = difficulty <= 1 ? 5 : 7;
  const sys  = fillPrompt(PROMPTS.math.system, { L, S });
  const user = fillPrompt(PROMPTS.math.user, { L, S, diff, instruction, nExercises });
  console.log('\n── Math lesson (LLM) prompt ─────────────────────────');
  console.log(`  Model: ${OLLAMA_LESSON_MODEL}, Lang: ${L}, Src: ${S}, Diff: ${diff}, N: ${nExercises}`);
  console.log('  ── system ──\n' + sys.split('\n').map(l => '    ' + l).join('\n'));
  console.log('  ── user ──\n' + user.split('\n').map(l => '    ' + l).join('\n'));
  console.log('────────────────────────────────────────────────────');
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
  const { text: corrupted, promptTokens, completionTokens } = await _callLLM(OLLAMA_MODEL, sys, userMsg, story.length * 2);
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
    if (valid.length < 1) {
      lastError = `No valid items after filtering (${rejected.length} rejected)`; continue;
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

// ── Generate synonyms / antonyms / homophones lesson ──────────────────────────
// Picks key words from the story and asks the LLM for better in-context synonyms,
// antonyms, and homophones (all in the target language, glossed in the source
// language). The related words are flattened into a standard vocab lesson, so the
// existing flashcard/MCQ player, checker, and editor handle it with no new type.
async function generateSynonyms(topic, lang, srcLang, difficulty, jobId, opts) {
  opts = opts || {};
  const { story, userDialect, chainVocab, vocabMode: synVocabMode } = opts;
  const L = langName(lang), S = langName(srcLang || 'en');
  const storyKeywords = story ? extractKeywords(story, 8, lang) : '';
  const _priorWords = (chainVocab?.words || []).slice(0, 12).map(v => v.target).filter(Boolean);
  const priorWords = _priorWords.join(', ');
  const P = PROMPTS && PROMPTS.synonyms;
  let sys, userMsg;
  if (P && P.system) {
    sys = fillPrompt(P.system, { L, S, diff: difficultyLabel(difficulty || 2) });
    if (userDialect && P.dialectNote) sys += fillPrompt(P.dialectNote, { dialect: userDialect });
    const ss = getStoryStyle(opts.storyStyle); if (ss && P.writingStyleNote) sys += fillPrompt(P.writingStyleNote, { writingStyle: ss });
    userMsg = fillPrompt(P.user, { topic, L, S })
      + (storyKeywords && P.storyHint ? fillPrompt(P.storyHint, { storyKeywords }) : '')
      + (priorWords && P.priorHint && synVocabMode !== 'extend' ? fillPrompt(P.priorHint, { priorWords }) : '');
  } else {
    sys = `You are a ${L} vocabulary lesson generator (learner speaks ${S}). For useful ${L} words, give ${L} synonyms (>=1), ${L} antonyms (0+), and ${L} homophones ONLY when they truly exist (else []). Glosses are short ${S} translations. Output strict JSON only.`;
    userMsg = `Topic: "${topic}".`
      + (storyKeywords ? `\nPrefer these ${L} words: ${storyKeywords}.` : '')
      + `\nReturn ONLY JSON: {"title":"...","desc":"...","icon":"🔁","words":[{"base":"<${L}>","gloss":"<${S}>","synonyms":[{"w":"<${L}>","g":"<${S}>"}],"antonyms":[],"homophones":[]}]}`;
  }
  const MAX_ATTEMPTS = 3;
  let tp = 0, tc = 0, lastError = '';
  const clean = arr => {
    const out = [], seen = new Set();
    (Array.isArray(arr) ? arr : []).forEach(it => {
      const w = ((it && (it.w ?? it.word)) || '').toString().trim();
      const g = ((it && (it.g ?? it.gloss)) || '').toString().trim();
      if (!w) return; const k = w.toLowerCase(); if (seen.has(k)) return; seen.add(k);
      out.push({ w, g });
    });
    return out;
  };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Synonyms lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Synonyms attempt ${attempt}…`);
    const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sys, userMsg, 1800);
    tp += promptTokens; tc += completionTokens;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) { lastError = 'Could not parse JSON'; continue; }
      try { parsed = JSON.parse(m[0]); } catch(e2) { lastError = 'JSON extract failed'; continue; }
    }
    if (!Array.isArray(parsed.words) || !parsed.words.length) { lastError = 'No words in response'; continue; }
    const words = [];
    for (const entry of parsed.words) {
      const base = (entry.base ?? entry.word ?? '').toString().trim();
      if (!base) continue;
      const baseLc = base.toLowerCase();
      // a word can never be its own synonym/antonym/homophone
      const notBase = a => a.filter(x => x.w.toLowerCase() !== baseLc);
      const synonyms   = notBase(clean(entry.synonyms)).slice(0, 4);
      const antonyms   = notBase(clean(entry.antonyms)).slice(0, 3);
      const homophones = notBase(clean(entry.homophones)).slice(0, 2);
      if (!synonyms.length) continue; // need >=1 synonym to be quizzable
      words.push({ base, gloss: (entry.gloss ?? '').toString().trim(), synonyms, antonyms, homophones });
    }
    if (!words.length) { lastError = 'No usable word groups (need a base + >=1 synonym)'; continue; }
    const synN = words.reduce((n,w)=>n+w.synonyms.length,0);
    const homN = words.reduce((n,w)=>n+w.homophones.length,0);
    console.log(`    Synonyms: ${words.length} groups, ${synN} synonyms, ${homN} homophones`);
    return {
      lesson: {
        id: 6, type: 'synonyms',
        title: parsed.title || 'Synonyms & Antonyms',
        desc:  parsed.desc  || 'Related words from the story',
        icon:  parsed.icon  || '🔁',
        words,
      },
      tokens: { promptTokens: tp, completionTokens: tc },
    };
  }
  throw new Error(`Synonyms generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
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
  const _storyLower = (story || '').toLowerCase();
  const _rawChain = (chainVocab && chainVocab.length) ? chainVocab.slice(0, 40) : [];
  const _chainWords = vocabMode === 'extend'
    ? _rawChain.filter(v => !_storyLower.includes(v.target.toLowerCase()))
    : _rawChain.slice(0, 30);
  if (vocabMode === 'extend' && _rawChain.length) {
    const _inStory = _rawChain.filter(v => _storyLower.includes(v.target.toLowerCase()));
    console.log(`    Extend avoid (${_chainWords.length}): ${_chainWords.map(v=>v.target).join(', ')||'(none)'}`);
    console.log(`    In new story (${_inStory.length}, not avoided): ${_inStory.map(v=>v.target).join(', ')||'(none)'}`);
  } else if (vocabMode === 'reinforce' && _chainWords.length) {
    console.log(`    Reinforce include (${_chainWords.length}): ${_chainWords.map(v=>v.target).join(', ')}`);
  }
  const chainHint = !_chainWords.length ? ''
    : vocabMode === 'extend'
      ? `\nEXTEND vocabulary — these words were covered before and are NOT in the current story. Do NOT use them as vocab items. Focus on FRESH vocabulary:\n${_chainWords.map(v => v.target).join(', ')}`
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

    // Validate vocab — accept whatever the model returns (>=1 item).
    if (!Array.isArray(lesson.vocab) || lesson.vocab.length < 1)
      throw new Error(`Only ${lesson.vocab?.length ?? 0} vocab items`);
    const seen = new Set();
    lesson.vocab = lesson.vocab.filter(v => {
      const k = v.target?.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 8);
    if (lesson.vocab.length < 1) throw new Error(`Only ${lesson.vocab.length} unique vocab items`);

    // Sentences are optional — use whatever we get (may be none).
    if (!Array.isArray(lesson.sentences)) lesson.sentences = [];
    lesson.sentences = lesson.sentences.slice(0, 5).map(s => deriveSentenceWords(s, lang));

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
  const { userStory, userTranslation, userDialect, storyStyle, lessonFormat, reinforcePrior, vocabMode, useFullChain, userStoryLang, prevStoryTopic, mathInstruction, skipMeta, placeholderTopic, parentId } = userOpts;
  srcLang = srcLang || 'en';
  const userTopic = topic;
  // The complete, untruncated user input that drove generation. The saved display
  // `topic` is a short LLM-generated title; `userTopic` already holds the full topic
  // and the story prompt is built from it (the model receives the whole input), but
  // we also persist a single explicit `userPrompt` field so nothing the user typed —
  // topic plus any pasted story / translation — is ever lost to title-shortening.
  const userPrompt = [
    userTopic || null,
    userStory ? ('[story]\n' + userStory) : null,
    userTranslation ? ('[translation]\n' + userTranslation) : null,
  ].filter(Boolean).join('\n\n') || userTopic || null;
  // The chain parent links this story into a storyline. With a user-supplied story
  // we still record the link — the parent arrives via prevStoryTopic since the
  // `continuedFrom` param is suppressed (we don't use the prior story as context).
  const chainParent = continuedFrom || prevStoryTopic || null;
  // Resolve the parent's STABLE id. Prefer an explicit parentId (the caller already
  // knows the exact parent topic) over a name lookup — findSaved(name) is name-only
  // and can resolve to a same-named topic from another language run (e.g. the same
  // PDF generated in it->en and de->en), which would cross-link the two chains.
  const parentTopic = parentId ? findSavedById(parentId) : (chainParent ? findSaved(chainParent) : null);
  const continuedFromId = (parentTopic && parentTopic.id) || null;
  const genStart = Date.now();
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  const lessonTokenStats = [];

  jobStep(jobId, `[${OLLAMA_MODEL}] Generating topic info…`);
  let meta;
  if (skipMeta) {
    // Batch mode: skip the per-chapter meta call. The whole-storyline title
    // post-pass assigns coherent titles/emojis after all chapters exist. Use a
    // unique placeholder name so the saved topic key doesn't collide.
    meta = { topic: (placeholderTopic || topic), topicEmoji: '📖' };
  } else {
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
    const prevStoryFull = (parentTopic && parentTopic.story) ? parentTopic.story
      : (continuedFrom ? (findSaved(continuedFrom)?.story || null) : null);
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
      userTopic, userPrompt, lang, srcLang, difficulty: difficulty || 2, storyLen,
      story, storyLang, storyPrompt,
      ...(storyTranslation ? { storyTranslation } : {}),
      ...(userStory        ? { userStory }         : {}),
      ...(userDialect      ? { userDialect }       : {}),
      ...(chainParent      ? { continuedFrom: chainParent } : {}),
      ...(continuedFromId  ? { continuedFromId }   : {}),
      ...(storyStyle       ? { storyStyle }        : {}),
      lessons: [],
    });
    console.log('    Story saved early (before lessons)');
  }

  // ── Lessons ───────────────────────────────────────────────────────────
  const styleHint = null; // removed — story context goes in userMsg only
  const lessons = [];

  const _vocabMode = vocabMode || (reinforcePrior ? 'reinforce' : 'neutral');
  const chainVocab = (_vocabMode !== 'neutral' && chainParent)
    ? collectChainVocab(findSaved(chainParent)?.id || chainParent)
    : { words: [], nouns: [], verbs: [] };
  const chainOpts = { userDialect, storyStyle, chainVocab, vocabMode: _vocabMode, story };

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation' || lessonFormat === 'math' || lessonFormat === 'synonyms') {
    const genFn   = lessonFormat === 'math'
      ? (mathInstruction
          ? () => generateMathLLM(lang, srcLang, difficulty, mathInstruction, jobId)
          : () => Promise.resolve(generateMath(story, difficulty)))
                  : lessonFormat === 'error_hunt'  ? () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words)
                  : lessonFormat === 'grammar'      ? () => generateGrammar(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'synonyms'     ? () => generateSynonyms(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  :                                   () => generateConjugation(topic, lang, srcLang, difficulty, jobId, chainOpts);
    const label   = lessonFormat === 'math'        ? 'Math'
                  : lessonFormat === 'error_hunt'  ? 'Error-hunt'
                  : lessonFormat === 'grammar'      ? 'Grammar'
                  : lessonFormat === 'synonyms'     ? 'Synonyms'
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
    userTopic, userPrompt, lang, srcLang, difficulty: difficulty || 2, storyLen,
    story, storyLang, storyPrompt,
    ...(storyTranslation ? { storyTranslation } : {}),
    ...(userStory        ? { userStory }         : {}),
    ...(userTranslation  ? { userTranslation }   : {}),
    ...(userDialect      ? { userDialect }       : {}),
    ...(chainParent      ? { continuedFrom: chainParent } : {}),
    ...(continuedFromId  ? { continuedFromId }   : {}),
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
async function warmupOllama() {
  await _warmupLLM(OLLAMA_MODEL, s => process.stdout.write(s));
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
let _idCounter = 0;
function _newTopicId() {
  // Mint a fresh topic id. Numeric to preserve the client's /^tp_\d+$/ detection.
  // Unlike the old name-hash, this cannot collide when a renamed topic's old name
  // is reused for a new topic. Existing ids are never recomputed.
  const existing = new Set((store.topics || []).map(t => t.id).filter(Boolean));
  let id;
  do {
    id = 'tp_' + Date.now().toString()
       + String(_idCounter++ % 100000).padStart(5, '0')
       + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  } while (existing.has(id));
  return id;
}
function _chainId(topicIds) {
  const j = JSON.stringify(topicIds);
  return 'sl_' + Math.abs(j.split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0));
}
function _syncStorylineForTopic(topicRef, continuedFromTopic) {
  if (store.schemaVersion < 29) return;
  // topicRef may be a tp_ id (preferred, unambiguous) or a name (back-compat).
  // Use the topic's STORED id (never recompute). A topic lacking an id is brand
  // new and gets a fresh random id; renamed topics keep their original id.
  const topicObj = (String(topicRef).startsWith('tp_') ? findSavedById(topicRef) : null) || findSaved(topicRef);
  const tid = topicObj?.id || _newTopicId();
  if (topicObj && !topicObj.id) { topicObj.id = tid; }

  // Resolve a topic's parent id: prefer the stored continuedFromId, fall back
  // to resolving a continuedFrom name (un-migrated/imported entries).
  const parentIdOf = t => {
    if (!t) return null;
    if (t.continuedFromId) return t.continuedFromId;
    if (t.continuedFrom)   return findSaved(t.continuedFrom)?.id || null;
    return null;
  };

  // Build the full chain (ids) by walking continuedFromId backwards.
  const chainIds = [tid];
  let curId = tid;
  for (let i = 0; i < 50; i++) {
    const t = findSavedById(curId);
    const pid = parentIdOf(t);
    if (!pid || chainIds.includes(pid) || !findSavedById(pid)) break;
    chainIds.unshift(pid);
    curId = pid;
  }
  // Walk forward picking up continuations. Stop at forks, pre-existing
  // branches (a topic already in another storyline), or cycles.
  const allSl = getStorylines();
  const otherSlTopicIds = new Set(
    allSl.filter(s => !s.chapters.includes(tid)).flatMap(s => s.chapters)
  );
  curId = tid;
  for (let i = 0; i < 50; i++) {
    const candidates = store.topics.filter(t => parentIdOf(t) === curId);
    // If multiple topics continue from cur — it's a fork; stop here
    if (candidates.length !== 1) break;
    const next = candidates[0];
    if (!next.id) next.id = _newTopicId();
    // If next already belongs to another storyline — pre-existing branch; stop
    if (otherSlTopicIds.has(next.id)) break;
    if (chainIds.includes(next.id)) break; // cycle guard
    chainIds.push(next.id);
    curId = next.id;
  }

  const chapterIds = chainIds;
  // Names for title/display, derived from ids so they reflect current names.
  const chain = chapterIds.map(id => findSavedById(id)?.topic ?? String(topicRef));
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

// ── Multi-chapter "book" generation ───────────────────────────────────
// Server-side sequential generation so a PDF book keeps generating even if the
// client refreshes or navigates away. Each chapter is a normal generate() job;
// the book job tracks overall progress and chains continuedFrom server-side.
const bookJobs = new Map(); // bookId -> { status, current, chapters:[{title,status,topicId,error,jobId}], error, createdAt }

function newBookJob(titles) {
  const id = 'book_' + crypto.randomBytes(8).toString('hex');
  bookJobs.set(id, {
    status: 'running', current: 0,
    chapters: titles.map(t => ({ title: t || '', status: 'pending', topicId: null, error: null })),
    error: null, createdAt: Date.now(),
  });
  // keep only the most recent 20 book jobs
  if (bookJobs.size > 20) {
    const oldest = [...bookJobs.entries()].sort((a,b)=>a[1].createdAt-b[1].createdAt)[0];
    if (oldest) bookJobs.delete(oldest[0]);
  }
  return id;
}

// Persist a generated chapter the same way the /api/generate handler does:
// upsert + stable id + storyline sync. Returns the saved topic.
function _persistGenerated(data, contFrom) {
  upsert(data);
  // Re-fetch the EXACT topic we just upserted. findSaved(name) is name-only and can
  // return a same-named topic from another language run (same PDF in it->en + de->en),
  // so match upsert's dedup key: name + lang + srcLang.
  const k = (data.topic || '').trim().toLowerCase();
  const sameKey = l => l.topic.toLowerCase() === k && (l.lang||'') === (data.lang||'') && (l.srcLang||'') === (data.srcLang||'');
  let saved = (store.schemaVersion >= 29) ? store.topics.find(sameKey) : findSaved(data.topic);
  if (store.schemaVersion >= 29) {
    if (saved && !saved.id) { saved.id = _newTopicId(); upsert(saved); saved = store.topics.find(l => l.id === saved.id) || saved; }
    _syncStorylineForTopic(saved ? saved.id : data.topic, contFrom);
    saved = (saved && store.topics.find(l => l.id === saved.id)) || store.topics.find(sameKey) || saved;
  }
  return saved || data;
}

// Rename a chain's chapter topics in place from a [{title,emoji}] array (de-dups names,
// keeps children's continuedFrom names in sync). Ids are unchanged. Persists. Shared by
// the book post-pass and the manual "re-generate chapter titles" endpoint.
function _applyChapterTitles(topics, chapterMeta, bj) {
  if (!Array.isArray(chapterMeta) || !chapterMeta.length) return false;
  const used = new Set();
  topics.forEach((tp, i) => {
    const m = chapterMeta[i] || {};
    let title = (m.title || '').trim() || tp.topic;
    let uniq = title, k = 2;
    while (used.has(uniq.toLowerCase()) ||
           (findSaved(uniq) && findSaved(uniq).id && findSaved(uniq).id !== tp.id)) {
      uniq = `${title} (${k++})`;
    }
    used.add(uniq.toLowerCase());
    const oldName = tp.topic;
    tp.topic = uniq;
    if (m.emoji) tp.topicEmoji = m.emoji;
    store.topics.forEach(c => {
      if (c.continuedFromId === tp.id && c.continuedFrom === oldName) c.continuedFrom = uniq;
    });
    if (bj && bj.chapters[i]) bj.chapters[i].title = uniq;
  });
  saveStore(store);
  return true;
}

// ── Title post-pass: after all chapters/lessons exist, assign coherent
// per-chapter titles+emojis and a storyline title+icon from the whole chain.
// Applies to both generated batches and PDF batches (per-chapter meta is a cheap
// placeholder during the loop; this overwrites it). Best-effort: failures are logged.
async function _titleStorylinePostPass(chapterIds, base, bj) {
  const topics = chapterIds.map(id => findSavedById(id)).filter(Boolean);
  if (!topics.length) return;
  const stories = topics.map(t => t.story || '');
  // 1) Per-chapter coherent titles + emojis.
  try {
    const chapterMeta = await generateChapterMeta(stories, base.srcLang, base.lang);
    _applyChapterTitles(topics, chapterMeta, bj);
  } catch (e) { console.warn(`  Chapter-title post-pass failed: ${e.message}`); }
  // 2) Whole-storyline title + icon (reuse existing helper).
  try {
    const names = topics.map(t => t.topic);
    const { title, icon } = await generateStorylineTitle(names, stories, base.srcLang);
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (sl) { sl.title = title; sl.icon = icon || sl.icon || '📖'; upsertStoryline(sl); }
  } catch (e) { console.warn(`  Storyline title post-pass failed: ${e.message}`); }
  // 3) Whole-storyline summary in the source language — same as the storyline-page
  // header-row summary (generateStorylineSummary + store on the storyline). Best-effort.
  try {
    const names = topics.map(t => t.topic);
    const vocab = topics.flatMap(t =>
      (t.lessons || []).flatMap(ls => (ls.vocab || []).map(v => v.source || v.target)));
    const summary = await generateStorylineSummary(names, stories, vocab, base.srcLang);
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (sl && summary) { sl.summary = summary; upsertStoryline(sl); }
  } catch (e) { console.warn(`  Storyline summary post-pass failed: ${e.message}`); }
}

async function _runBookJob(bookId, chunks, base) {
  const bj = bookJobs.get(bookId);
  if (!bj) return;
  let prevRef = base.continuedFrom || null; // id or name of the parent for chapter 0
  // Generated continuation directive: chapters after the first introduce NO new
  // topic — they just continue the story so far. This neutral instruction takes
  // the place of the (re-stated) base topic so the model keeps building the same
  // narrative instead of re-anchoring on the topic each chapter.
  const CONTINUE_TOPIC = "Continue the previous chapter's story directly — keep the same characters, setting, and ongoing plot. Do not introduce a new topic or theme; just build on the storyline so far.";
  for (let i = 0; i < chunks.length; i++) {
    if (bj.status === 'cancelled') break;
    bj.current = i;
    bj.chapters[i].status = 'active';
    const jobId = newJob();
    bj.chapters[i].jobId = jobId;
    try {
      const parent  = prevRef ? (findSavedById(prevRef) || findSaved(prevRef)) : null;
      const contFrom = parent ? parent.topic : null;
      const generated = !!base.generated;
      const userStory = generated ? '' : String(chunks[i].text || '').trim();
      const wc    = Math.max(50, Math.min(2000, parseInt(chunks[i].wordCount, 10) || base.chapterLen || 300));
      // Unique placeholder name (post-pass assigns the real, coherent title).
      const placeholderTopic = generated
        ? `${base.baseTopic.slice(0,40)} — ${i+1}`
        : ((String(chunks[i].title || '').trim().slice(0,80)) || ('Chapter ' + (i+1)));
      // Story-prompt theme: chapter 1 of a generated batch establishes the base
      // topic; every later generated chapter continues the SAME story (no new topic).
      // PDF chapters use their own chunk title.
      const storyTopic = generated
        ? (i === 0 ? base.baseTopic : CONTINUE_TOPIC)
        : placeholderTopic;
      const userOpts = {
        userStory: generated ? null : userStory,
        userStoryLang: base.userStoryLang || null,
        prevStoryTopic: (!generated && userStory && contFrom) ? contFrom : null,
        userTranslation: null, userDialect: null, storyStyle: base.storyStyle || null,
        // Arc mode: chapter 1 lesson is a plain vocab "gate" (this chapter's new words);
        // reinforcement lessons are appended below. Otherwise honor the chosen format.
        lessonFormat: base.arc ? 'standard' : base.fmt, reinforcePrior: false, vocabMode: null,
        // Generated continuations always build on the full prior story; PDF chapters
        // keep the prior behaviour (full context from the 2nd chapter on).
        useFullChain: i >= 1 || (generated && !!parent), mathInstruction: null,
        // The exact parent topic id — authoritative chain link (avoids name collisions
        // between same-named chapters from a different-language run of the same PDF).
        parentId: parent ? (parent.id || null) : null,
        // Defer titling to the whole-storyline post-pass (cheap placeholder for now).
        skipMeta: true, placeholderTopic,
      };
      console.log(`  [book ${bookId}] chapter ${i+1}/${chunks.length}: "${placeholderTopic}"${contFrom?' cont='+contFrom:''}${generated?' generated':''}${base.arc?' arc[+'+base.arcTypes.join(',')+']':''} job=${jobId}`);
      // Generated chapters continue the prior story as context (continuedFrom set);
      // PDF chapters supply their own story, so the chain link is recorded via prevStoryTopic.
      const data  = await generate(storyTopic, base.lang, base.srcLang, base.diff, generated ? contFrom : null, wc, jobId, userOpts);

      // Arc reinforcement lessons. Reinforcement only begins from the SECOND chapter:
      // chapter 1 ships just its standard vocab lesson (the new chapter's words, from
      // generate() above). From chapter 2 on we add ONE extra lesson:
      //   'vocab'   (default): a single review lesson drilling the vocab of ALL
      //             pre-existing chapters in the storyline (chainVocab walks to the root).
      //   'grammar' (alt): grammar / conjugation / synonyms reinforcement lessons.
      // (collectChainVocab(parent) excludes the current chapter — which is persisted
      // below — so the review covers prior chapters and the standard lesson covers this one.)
      if (base.arc && i >= 1 && Array.isArray(data.lessons)) {
        const chainVocab = parent ? collectChainVocab(parent.id || prevRef) : { words: [], nouns: [], verbs: [] };
        const arcStory = userStory || data.story || '';
        if (base.arcMode === 'grammar') {
          const rOpts = { userDialect: null, storyStyle: null, chainVocab, vocabMode: 'reinforce', story: arcStory };
          for (const rType of base.arcTypes) {
            try {
              jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Reinforcement lesson (${rType})…`);
              const rFn = rType === 'conjugation' ? generateConjugation
                        : rType === 'synonyms'    ? generateSynonyms
                        :                           generateGrammar;
              const { lesson } = await rFn(data.topic || placeholderTopic, base.lang, base.srcLang, base.diff, jobId, rOpts);
              data.lessons.push(lesson);
            } catch (e) {
              console.warn(`  [book ${bookId}] chapter ${i+1} reinforcement (${rType}) failed, skipping: ${e.message}`);
              jobStep(jobId, `⚠ ${rType} reinforcement failed — continuing…`);
            }
          }
        } else {
          // Default vocab arc: ONE review lesson over the whole storyline's prior vocab.
          try {
            jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Vocab review lesson (whole storyline)…`);
            const vOpts = { userDialect: null, writingStyle: base.storyStyle || null,
              storyLang: base.userStoryLang || null, story: arcStory,
              chainVocab: chainVocab.words || [], vocabMode: 'reinforce' };
            const { lesson } = await generateOneLesson(
              base.lang, base.srcLang, data.topic || placeholderTopic, 1, 1, [], arcStory, base.diff, jobId, vOpts);
            if (lesson && !lesson.title) lesson.title = 'Review words';
            if (lesson) { lesson._arcMode = 'reinforce'; if (!lesson.icon) lesson.icon = '🔁'; }
            data.lessons.push(lesson);
          } catch (e) {
            console.warn(`  [book ${bookId}] chapter ${i+1} vocab review failed, skipping: ${e.message}`);
            jobStep(jobId, `⚠ vocab review failed — continuing…`);
          }
        }
      }

      const saved = _persistGenerated(data, contFrom);
      jobDone(jobId, { ...data, fromCache: false });
      bj.chapters[i].status  = 'done';
      bj.chapters[i].topicId = saved.id || null;
      bj.chapters[i].title   = saved.topic || placeholderTopic;
      prevRef = saved.id || saved.topic; // chain next chapter from this one (prefer id)
    } catch (e) {
      console.error(`  [book ${bookId}] chapter ${i+1} failed:`, e.message);
      jobFail(jobId, e.message);
      bj.chapters[i].status = 'error';
      bj.chapters[i].error  = e.message;
      bj.status = 'error'; bj.error = `Chapter ${i+1}: ${e.message}`;
      return;
    }
  }
  if (bj.status !== 'cancelled' && bj.status !== 'error') {
    // Whole-storyline title post-pass once every chapter/lesson exists.
    bj.status = 'titling';
    try {
      const chapterIds = bj.chapters.map(c => c.topicId).filter(Boolean);
      if (chapterIds.length) await _titleStorylinePostPass(chapterIds, base, bj);
    } catch (e) { console.warn(`  [book ${bookId}] title post-pass error: ${e.message}`); }
    // Auto-QC the finished storyline (same as the user-triggered QC from the saved
    // list), tagging items across all chapters. Best-effort; never fails the book.
    try {
      const qcTopics = bj.chapters.map(c => c.topicId).filter(Boolean)
        .map(id => findSavedById(id)).filter(Boolean);
      if (qcTopics.length) {
        bj.status = 'qc';
        await _runQc(newJob(), qcTopics, { lessonIdx: null, onlyFlagged: false });
      }
    } catch (e) { console.warn(`  [book ${bookId}] QC post-pass error: ${e.message}`); }
    bj.status = 'done';
  }
  console.log(`  [book ${bookId}] finished: ${bj.status}`);
}

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const M   = req.method.toUpperCase();

    if (M === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    if (M === 'GET' && url.pathname === '/api/info') {
      return json(res, 200, { backend: active, version: APP_VERSION, ollamaModel: OLLAMA_MODEL,
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
        continuedFromId: l.continuedFromId || null,
        generatedAt: l.generatedAt,
        updatedAt:   l.updatedAt || l.generatedAt,
        lessonCount: l.lessons?.length || 0,
        qcFlags: (l.lessons || []).reduce((n, L) =>
          n + [...(L.vocab||[]), ...(L.sentences||[])].filter(x => x && (x.qc || x.userFlag)).length, 0),
      }));
      list.sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
      return json(res, 200, list);
    }
    if (M === 'GET' && url.pathname === '/api/lessons/load') {
      const id = url.searchParams.get('id');
      const t  = url.searchParams.get('topic');
      if (!id && !t) return json(res, 400, { error: 'Missing id or topic' });
      // Prefer stable id; fall back to name for backward compatibility.
      const s = id ? findSavedById(id) : findSaved(t);
      if (!s) return json(res, 404, { error: 'Not found' });
      return json(res, 200, s);
    }
    if (M === 'POST' && url.pathname === '/api/lessons/save-meta') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { id, oldTopic, newTopic, topicEmoji } = body;
      if (!newTopic) return json(res, 400, { error: 'Missing newTopic' });
      if (!id && !oldTopic) return json(res, 400, { error: 'Missing id or oldTopic' });
      const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons || []);
      // Resolve target by stable id (preferred, collision-safe); fall back to name.
      const saved = id ? findSavedById(id) : findSaved(oldTopic);
      if (!saved) {
        // Maybe already renamed — by id it's a no-op; by name, check newTopic exists.
        const already = id ? findSavedById(id) : (newTopic && findSaved(newTopic));
        if (already) {
          console.log(`  save-meta: already applied for ${id || `"${oldTopic}"`} — no-op`);
          return json(res, 200, { ok: true, topic: already.topic, topicEmoji: already.topicEmoji });
        }
        console.warn(`  save-meta: topic not found: ${id ? `id ${id}` : `"${oldTopic}"`} (schema v${store.schemaVersion}, ${arr.length} topics)`);
        return json(res, 404, { error: `Topic not found: ${id ? id : `"${String(oldTopic).slice(0,40)}"`}` });
      }
      const newName = newTopic.trim().slice(0, 80);
      // No-op if nothing changes
      if (saved.topic.trim().toLowerCase() === newName.toLowerCase() && !topicEmoji)
        return json(res, 200, { ok: true, topic: saved.topic, topicEmoji: saved.topicEmoji });
      saved.topic = newName;
      if (topicEmoji) saved.topicEmoji = topicEmoji;
      // Move the renamed entry to the front, matching by REFERENCE — a name collision
      // must never remove a different topic. Same-name topics are legal now (distinct ids).
      const filtered = arr.filter(l => l !== saved);
      filtered.unshift(saved);
      if (store.schemaVersion >= 29) store.topics = filtered; else store.lessons = filtered;
      // No continuedFrom cascade needed: chains reference the parent's stable id
      // (continuedFromId), which is unchanged by a rename. The continuedFrom name
      // may now be stale, but it's display-only and the client resolves the current
      // parent name from continuedFromId.
      saveStore(store);
      console.log(`  Renamed: ${saved.id} → "${saved.topic}"`);
      return json(res, 200, { ok: true, topic: saved.topic, topicEmoji: saved.topicEmoji });
    }
    if (M === 'DELETE' && url.pathname === '/api/lessons/delete') {
      const id = url.searchParams.get('id');
      const t  = url.searchParams.get('topic');
      if (!id && !t) return json(res, 400, { error: 'Missing id or topic' });
      const arr = store.schemaVersion >= 29 ? store.topics : (store.lessons || []);
      // Prefer stable id; fall back to name. Match by reference so a name
      // collision can never delete the wrong topic.
      const toDelete = id ? arr.find(l => l.id === id)
                          : arr.find(l => l.topic.toLowerCase() === t.trim().toLowerCase());
      if (!toDelete) return json(res, 200, { ok: true }); // idempotent: nothing to delete
      const deleteId = toDelete.id;
      const delName  = toDelete.topic; // canonical name for slug-based flag cleanup
      console.log(`  Deleting: "${delName}" (${deleteId || 'no-id'}, ${(toDelete.lessons||[]).length} lesson(s))`);
      if (store.schemaVersion >= 29) {
        const deletedParentId = toDelete.continuedFromId || null;
        store.topics = store.topics.filter(l => l !== toDelete);
        // Remove from storyline chapters, remove empty storylines
        store.storylines = store.storylines.map(sl => ({
          ...sl, chapters: sl.chapters.filter(c => c !== deleteId)
        })).filter(sl => sl.chapters.length > 0);
        // Splice the deleted topic out of the chain: its children continue from the
        // deleted topic's parent (the grandparent), so a middle delete reconnects
        // Alpha→Gamma instead of orphaning Gamma. If the deleted topic was a root,
        // its children become roots.
        const _parentName = deletedParentId ? (findSavedById(deletedParentId)?.topic || null) : null;
        store.topics.forEach(t => {
          if (t.continuedFromId === deleteId) {
            t.continuedFromId = deletedParentId;
            t.continuedFrom = _parentName;   // display name (null when reconnected to no parent)
          }
        });
        // If the deleted topic's parent had a fork that has now collapsed to a single
        // remaining child, merge the parent's storyline with that child's storyline so
        // the chain re-forms as one line (preserving the parent storyline's id/title/icon).
        if (deletedParentId) {
          const kids = store.topics.filter(t => t.continuedFromId === deletedParentId);
          if (kids.length === 1) {
            const all = getStorylines();
            const pSl = all.find(s => s.chapters[s.chapters.length - 1] === deletedParentId);
            const cSl = all.find(s => s !== pSl && s.chapters[0] === kids[0].id);
            if (pSl && cSl) {
              pSl.chapters = [...pSl.chapters, ...cSl.chapters];
              setStorylines(all.filter(s => s.id !== cSl.id));
            }
          }
        }
      } else {
        store.lessons = (store.lessons||[]).filter(l => l !== toDelete);
      }
      // Delete all flags associated with this topic (by slug and by id)
      const flags = getFlags();
      const delSlug = topicSlug(delName) + ':';
      const delId   = deleteId ? deleteId + ':' : null;
      let flagsDeleted = 0;
      Object.keys(flags).forEach(k => {
        if (k.startsWith(delSlug) || (delId && k.startsWith(delId))) {
          delete flags[k]; flagsDeleted++;
        }
      });
      if (flagsDeleted > 0) {
        setFlags(flags);
        console.log(`  Deleted ${flagsDeleted} flag(s) for "${delName}"`);
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

    // ── QC: translation-model check of vocab/sentence pairs ───────────────
    // Scopes: { storylineId } | { topicId } | { topicId, lessonIdx }.
    // Writes `qc:{sug,at}` onto flagged items (clears it on items now OK), persists,
    // and returns counts. Runs async (one translation-model call per pair).
    if (M === 'POST' && url.pathname === '/api/qc') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      if (active === 'none') return json(res, 503, { error: 'No LLM backend.' });
      const { storylineId, topicId, lessonIdx, onlyFlagged } = body;
      // Resolve the topics in scope.
      let topics = [];
      if (storylineId) {
        const sl = getStorylines().find(s => s.id === storylineId);
        topics = sl ? sl.chapters.map(id => findSavedById(id)).filter(Boolean) : [];
      } else if (topicId) {
        const tp = findSavedById(topicId);
        if (tp) topics = [tp];
      }
      if (!topics.length) return json(res, 404, { error: 'Nothing in scope to check.' });
      const jobId = newJob();
      console.log(`  ⚙ QC requested (${storylineId?('storyline '+storylineId):topicId?('topic '+topicId+(lessonIdx!==undefined&&lessonIdx!==null?' lesson '+lessonIdx:'')):'?'}) → ${topics.length} topic(s), job=${jobId}`);
      _runQc(jobId, topics, { lessonIdx: (lessonIdx === undefined ? null : lessonIdx), onlyFlagged: !!onlyFlagged })
        .catch(e => { console.error('  QC error:', e.message); jobFail(jobId, e.message); });
      return json(res, 202, { jobId, topics: topics.length });
    }

    // ── Storyline titles ─────────────────────────────────────────────
    if (M === 'GET' && url.pathname === '/api/storylines') {
      return json(res, 200, getStorylines());
    }
    // Export a topic/storyline (and its connected chain) as Markdown, HTML, or JSON.
    //   /api/export?format=md|html|json  &  (id=sl_… | id=tp_… | topic=<name>)
    // No selector → all storylines. Reuses export-lessons.js for md/html.
    if (M === 'GET' && url.pathname === '/api/export') {
      const fmt = (url.searchParams.get('format') || 'md').toLowerCase();
      if (!['md','html','json'].includes(fmt)) return json(res, 400, { error: 'format must be md, html or json' });
      const idParam = url.searchParams.get('id');
      const nameParam = url.searchParams.get('topic');
      const slug = v => String(v||'export').replace(/[^a-z0-9]+/gi,'-').toLowerCase().replace(/^-+|-+$/g,'').slice(0,40) || 'export';
      const sls = getStorylines();

      // Resolve the selection to a set of storyline ids and/or a single topic id,
      // expanding a topic to the storyline(s) that contain it (matches the in-app export).
      let exportIds = [];        // sl_/tp_ ids for buildExport
      let title = 'dreizunge';
      if (idParam && idParam.startsWith('sl_')) {
        const sl = sls.find(s => s.id === idParam);
        if (!sl) return json(res, 404, { error: 'Storyline not found' });
        exportIds = [sl.id]; title = sl.title || 'storyline';
      } else if (idParam || nameParam) {
        const anchor = idParam ? findSavedById(idParam) : findSaved(nameParam);
        if (!anchor) return json(res, 404, { error: 'Topic not found' });
        const containing = sls.filter(s => (s.chapters||[]).includes(anchor.id));
        if (containing.length) { exportIds = containing.map(s => s.id); title = containing[0].title || anchor.topic; }
        else { exportIds = [anchor.id]; title = anchor.topic; }
      } else {
        exportIds = []; title = 'dreizunge-all';   // all storylines
      }

      if (fmt === 'json') {
        // Mirror the in-app JSON export: the resolved topics + their storylines.
        const wantSl = exportIds.filter(i => i.startsWith('sl_'));
        const wantTp = exportIds.filter(i => i.startsWith('tp_'));
        const slObjs = wantSl.length ? sls.filter(s => wantSl.includes(s.id)) : (exportIds.length ? [] : sls);
        const topicIds = new Set(wantTp);
        slObjs.forEach(s => (s.chapters||[]).forEach(c => topicIds.add(c)));
        const topicsOut = [...topicIds].map(findSavedById).filter(Boolean);
        const payload = { schemaVersion: store.schemaVersion || 29, topics: topicsOut,
          storylines: slObjs, exportedAt: new Date().toISOString(), exportedBy: 'dreizunge' };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="dreizunge_${slug(title)}.json"` });
        return res.end(JSON.stringify(payload, null, 2));
      }

      const result = buildExport(store, { ids: exportIds, html: fmt === 'html', lessons: true });
      if (!result) return json(res, 404, { error: 'Nothing to export' });
      res.writeHead(200, { 'Content-Type': result.mime + '; charset=utf-8',
        'Content-Disposition': `attachment; filename="dreizunge_${slug(title)}.${result.ext}"` });
      return res.end(result.content);
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
      // continuedFrom may arrive as a stable tp_ id (from the continue-select)
      // or a topic name (other paths). Normalize to the canonical topic name so
      // everything downstream is unaffected by which the client sent.
      const _contParent = continuedFrom ? (findSavedById(continuedFrom) || findSaved(continuedFrom)) : null;
      const continuedFromName = _contParent ? _contParent.topic : null;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : continuedFromName ? continuedFromName : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms'].includes(lessonFormat) ? lessonFormat : 'standard';
      const wcMax = body.userStory ? 2000 : 1000;
      const wc = Math.max(100, Math.min(wcMax, parseInt(storyLen, 10) || 300));
      // contFrom: used for storyline chain tracking AND story continuation context.
      // When userStory is provided we still track the chain, but don't pass contFrom
      // to generate() for story context (user supplied their own text).
      const contFrom = continuedFromName;
      // When user provides a story AND continues from a prior chapter,
      // pass both the previous story AND the new story as context.
      const contFromForStory = contFrom && !userStory ? contFrom : null;
      const combinedUserStory = (userStory && contFrom) ? contFrom : null;
      const topicKey = topic.trim().toLowerCase();
      const resolvedSrcLang = srcLang || 'en';
      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached && cached.lang === (lang||'it') && cached.srcLang === (resolvedSrcLang||'en')) {
          console.log(`  Cache hit: "${topic}" (${lang}←${resolvedSrcLang})`);
          return json(res, 200, { cached: true, data: { ...cached, fromCache: true } });
        }
      }
      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Start Ollama, then restart.' });
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already generating lessons for this topic. Please wait.' });
      const jobId = newJob();
      generatingTopics.add(topicKey);
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
            saved.id = _newTopicId();
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

    // ── Generate a multi-chapter book (server-side loop; survives refresh) ──
    if (M === 'POST' && url.pathname === '/api/generate-book') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const { chunks, lang, srcLang, difficulty, lessonFormat, continuedFrom, userStoryLang, arc, arcReinforce, arcMode,
              generated, topic, nChapters, chapterLen, storyStyle } = body;
      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Start Ollama, then restart.' });
      // Generated batch: synthesize N text-less chapters from a single topic; each is
      // written by the model continuing the previous (chained narrative).
      let chaptersIn = chunks;
      let baseTopic = null, chapterLenN = null;
      if (generated) {
        // Keep the FULL topic — it is chapter 1's story-prompt theme and is stored
        // as userTopic/userPrompt. (Only the transient placeholder label is shortened,
        // below and in _runBookJob; the title post-pass replaces it anyway.)
        baseTopic = String(topic || '').trim();
        if (!baseTopic) return json(res, 400, { error: 'Missing topic for generated batch' });
        const n = Math.min(20, parseInt(nChapters, 10) || 0);
        if (n < 2) return json(res, 400, { error: 'nChapters must be between 2 and 20' });
        chapterLenN = Math.max(50, Math.min(2000, parseInt(chapterLen, 10) || 300));
        chaptersIn = Array.from({ length: n }, () => ({ wordCount: chapterLenN }));
      }
      if (!Array.isArray(chaptersIn) || chaptersIn.length === 0)
        return json(res, 400, { error: 'No chapters provided' });
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms'].includes(lessonFormat) ? lessonFormat : 'standard';
      // Arc mode: each chapter = a vocab "gate" lesson + one or more reinforcement
      // lessons (grammar/conjugation/synonyms) generated in reinforce mode.
      const _arcTypes = (Array.isArray(arcReinforce) ? arcReinforce : ['grammar'])
        .filter(t => ['grammar','conjugation','synonyms'].includes(t));
      const arcEnabled = !!arc;
      // Normalize the chain root (id or name) to a name for downstream context.
      const rootParent = continuedFrom ? (findSavedById(continuedFrom) || findSaved(continuedFrom)) : null;
      const base = { lang: lang || 'it', srcLang: srcLang || 'en', diff, fmt,
        continuedFrom: rootParent ? rootParent.id : null, userStoryLang: userStoryLang || null,
        arc: arcEnabled, arcTypes: _arcTypes.length ? _arcTypes : ['grammar'],
        arcMode: arcMode === 'grammar' ? 'grammar' : 'vocab',
        generated: !!generated, baseTopic, chapterLen: chapterLenN,
        storyStyle: (storyStyle && storyStyle !== 'creative') ? storyStyle : null };
      const bookId = newBookJob(chaptersIn.map((c, i) => c.title || (baseTopic ? `${baseTopic.slice(0,40)} — ${i+1}` : '')));
      console.log(`  Book generation started: ${chaptersIn.length} chapter(s)${generated?` (generated from "${baseTopic}")`:' (from upload)'}, id=${bookId}`);
      console.log(`    lang=${base.lang}  srcLang=${base.srcLang}  difficulty=${base.diff}  format=${base.fmt}` +
        `  style=${base.storyStyle||'(default)'}  arc=${base.arc?base.arcMode+(base.arcMode==='grammar'?' ['+base.arcTypes.join(',')+']':''):'off'}` +
        `  continuedFrom=${base.continuedFrom||'-'}`);
      _runBookJob(bookId, chaptersIn, base);  // fire-and-forget; runs server-side
      return json(res, 202, { bookId, chapters: chaptersIn.length });
    }

    // ── Book job progress ──────────────────────────────────────────────
    if (M === 'GET' && url.pathname.startsWith('/api/book-job/')) {
      const bookId = url.pathname.split('/')[3];
      const bj = bookJobs.get(bookId);
      if (!bj) return json(res, 404, { error: 'Book job not found' });
      return json(res, 200, { bookId, status: bj.status, current: bj.current, error: bj.error,
        chapters: bj.chapters.map(c => ({ title: c.title, status: c.status, topicId: c.topicId, error: c.error })) });
    }

    // ── Most-recent active book job (for reconnect after refresh) ──────
    if (M === 'GET' && url.pathname === '/api/book-job') {
      let bestId = null, best = null;
      for (const [id, bj] of bookJobs) {
        if (bj.status === 'running' && (!best || bj.createdAt > best.createdAt)) { best = bj; bestId = id; }
      }
      if (!bestId) return json(res, 200, { bookId: null });
      return json(res, 200, { bookId: bestId, status: best.status, current: best.current,
        chapters: best.chapters.map(c => ({ title: c.title, status: c.status, topicId: c.topicId, error: c.error })) });
    }

    // ── Cancel a book job ──────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/book-job/cancel') {
      let body; try { body = JSON.parse(await readBody(req)); } catch(e) { body = {}; }
      const bj = body.bookId && bookJobs.get(body.bookId);
      if (bj && bj.status === 'running') { bj.status = 'cancelled'; console.log('  Book job cancelled:', body.bookId); }
      return json(res, 200, { ok: true });
    }
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
      const { id, topic, lessons } = body;
      if (!lessons || (!id && !topic)) return json(res, 400, { error: 'Missing id/topic or lessons' });
      const saved = id ? findSavedById(id) : findSaved(topic);
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      // Only update vocab/sentences/grammar fields — preserve all other data.
      // Flag fields (qc, userFlag) are client-authoritative: if the incoming item
      // omits them, the client cleared the flag, so don't resurrect it from the
      // stored copy (fixes "fix/✕ doesn't clear the flag" on reload).
      const mergeFlaggable = (o, v) => {
        const m = { ...o, ...v };
        if (!('qc' in v))       delete m.qc;
        if (!('userFlag' in v)) delete m.userFlag;
        return m;
      };
      const origLessons = saved.lessons.slice();
      saved.lessons = lessons.map((edited, i) => {
        const orig = origLessons.find(ls => ls.id === edited.id) || origLessons[i] || {};
        return {
          ...orig,
          ...(edited.title !== undefined ? { title: edited.title } : {}),
          ...(edited.icon  !== undefined ? { icon:  edited.icon  } : {}),
          vocab:     edited.vocab     ? edited.vocab.map((v,j) => mergeFlaggable((orig.vocab||[])[j]||{}, v)) : orig.vocab,
          sentences: edited.sentences ? edited.sentences.map((s,j) => mergeFlaggable((orig.sentences||[])[j]||{}, s)) : orig.sentences,
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
      console.log(`  Edited lessons for "${saved.topic}"`);
      return json(res, 200, { ok: true });
    }

    // ── Add lesson to existing topic ──────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/add-lesson') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { id, topic, lessonFormat: fmt, difficulty: rawDiff, reinforcePrior: addReinforce, vocabMode: addVocabMode, mathInstruction: addMathInstr, mathOps: addMathOps } = body;
      if (!id && !topic) return json(res, 400, { error: 'Missing id or topic' });
      if (!fmt)    return json(res, 400, { error: 'Missing lessonFormat' });
      const saved = id ? findSavedById(id) : findSaved((topic||'').trim());
      if (!saved)  return json(res, 404, { error: `Topic not found: ${id || topic}` });
      if (!saved.story) return json(res, 400, { error: 'Topic has no story to base lessons on' });
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      const topicName = saved.topic;
      const topicKey = topicName.trim().toLowerCase();
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already busy with this topic. Please wait.' });
      const diff  = Math.max(1, Math.min(3, parseInt(rawDiff, 10) || saved.difficulty || 2));
      const _addVocabMode = addVocabMode || (addReinforce ? 'reinforce' : 'neutral');
      const lang     = saved.lang    || 'it';
      const srcLang  = saved.srcLang || 'en';
      const dialect  = saved.userDialect || null;
      const style    = saved.storyStyle  || null;
      const story    = saved.story;
      const jobId = newJob();
      generatingTopics.add(topicKey);
      console.log(`  Add lesson: "${topicName}" fmt=${fmt} diff=${diff} vocabMode=${_addVocabMode}`);

      const doGenLesson = async () => {
        let result;
        const chainVocab = (_addVocabMode !== 'neutral' && (saved.continuedFromId || saved.continuedFrom))
          ? collectChainVocab(saved.continuedFromId || saved.continuedFrom)
          : { words: [], nouns: [], verbs: [] };
        if (chainVocab.words.length)
          console.log(`    Chain vocab (${_addVocabMode}): ${chainVocab.words.slice(0,15).map(v=>v.target).join(', ')}`);
        if (fmt === 'standard') {
          const storyTranslation = saved.storyTranslation || null;
          // Don't pass story as styleHint — it's already in userMsg as context
          const lessonOpts = { userTranslation: storyTranslation, userDialect: dialect, writingStyle: style, storyLang: saved.storyLang || 'target', story: saved.story || null, chainVocab: chainVocab.words, vocabMode: _addVocabMode };
          result = await generateOneLesson(lang, srcLang, topicName, 1, 1, [], story, diff, jobId, lessonOpts);
        } else if (fmt === 'error_hunt') {
          result = await generateErrorHunt(story, lang, diff, jobId, chainVocab.words);
        } else if (fmt === 'grammar') {
          result = await generateGrammar(topicName, lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab, vocabMode: _addVocabMode, story });
        } else if (fmt === 'conjugation') {
          result = await generateConjugation(topicName, lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab, vocabMode: _addVocabMode, story });
        } else if (fmt === 'synonyms') {
          result = await generateSynonyms(topicName, lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab, vocabMode: _addVocabMode, story });
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
    // Re-generate titles for an existing storyline: scope = 'title' | 'chapters' | 'all'.
    if (M === 'POST' && url.pathname === '/api/storyline-retitle') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, scope } = body;
      const sc = ['title','chapters','all'].includes(scope) ? scope : 'all';
      const sl = getStorylines().find(s => s.id === slId);
      if (!sl) return json(res, 404, { error: 'Storyline not found' });
      const topics = (sl.chapters || []).map(findSavedById).filter(Boolean);
      if (!topics.length) return json(res, 404, { error: 'Storyline has no chapters' });
      const stories = topics.map(t => t.story || '');
      const srcLang = topics[0].srcLang || 'en';
      const lang = topics[0].lang || 'it';
      const out = {};
      try {
        if (sc === 'chapters' || sc === 'all') {
          const chapterMeta = await generateChapterMeta(stories, srcLang, lang);
          _applyChapterTitles(topics, chapterMeta, null);
          out.chapters = topics.map(t => ({ id: t.id, topic: t.topic, emoji: t.topicEmoji || '' }));
        }
        if (sc === 'title' || sc === 'all') {
          const { title, icon } = await generateStorylineTitle(topics.map(t => t.topic), stories, srcLang);
          sl.title = title; sl.icon = icon || sl.icon || '📖'; upsertStoryline(sl);
          out.title = title; out.icon = sl.icon;
        }
        return json(res, 200, out);
      } catch(e) {
        return json(res, 500, { error: e.message });
      }
    }

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
        const arr = store.schemaVersion >= 29 ? store.topics : store.lessons;
        const exists = l.id
          ? arr.find(x => x.id === l.id)
          : arr.find(x =>
              x.topic.toLowerCase() === l.topic.toLowerCase() &&
              (x.lang||'') === (l.lang||'') &&
              (x.srcLang||'') === (l.srcLang||''));
        if (exists) {
          // Update in place preserving generatedAt
          Object.assign(exists, l, { generatedAt: exists.generatedAt, updatedAt: new Date().toISOString() });
          saveStore(store);
          updated++;
        } else {
          upsert(l);
          added++;
        }
      }
      // Reconstruct storylines:
      // 1. Merge explicitly exported storylines (new format)
      for (const sl of incomingStorylines) {
        const existing = findStoryline(sl.id);
        if (!existing) { upsertStoryline(sl); }
        else if ((sl.chapters||[]).length > (existing.chapters||[]).length) {
          upsertStoryline(sl);
        } else {
          upsertStoryline({ ...sl, chapters: existing.chapters });
        }
      }
      // 2. Always sync storylines for all topics — this assigns topic IDs (tp_...)
      // which are needed for _byId lookups in the client tag filter.
      for (const l of incoming) {
        _syncStorylineForTopic(l.topic, l.continuedFrom || null);
      }
      // 3. Dedup storylines that share an identical chapter sequence. This happens
      // when an imported storyline's id doesn't equal the continuedFrom-derived
      // _chainId, so step 2 creates a parallel copy of the same chain. Keep the copy
      // with a curated title (i.e. a title that isn't just the first chapter's name).
      {
        const allSl = getStorylines();
        const bid = Object.fromEntries((store.topics||[]).filter(t => t.id).map(t => [t.id, t]));
        const isAuto = s => { const c0 = bid[(s.chapters||[])[0]]; return c0 && s.title === c0.topic; };
        const seen = new Map(); // chapter-sequence → index in keep[]
        const keep = [];
        for (const sl of allSl) {
          const key = (sl.chapters||[]).join('|');
          if (!key) { keep.push(sl); continue; }
          if (!seen.has(key)) { seen.set(key, keep.length); keep.push(sl); }
          else { const i = seen.get(key); if (isAuto(keep[i]) && !isAuto(sl)) keep[i] = sl; } // else drop dup
        }
        if (keep.length !== allSl.length) setStorylines(keep);
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
