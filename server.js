#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
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
      // Support both {lessons:[]} and legacy bare-array formats
      if (Array.isArray(data)) return { lessons: data };
      if (data && Array.isArray(data.lessons)) return data;
      console.warn('lessons.json has unexpected shape — starting empty');
    }
  } catch(e) { console.warn('Could not read lessons.json:', e.message); }
  return { lessons: [] };
}
function saveStore(s) {
  try { fs.writeFileSync(STORAGE_FILE, JSON.stringify(s, null, 2), 'utf8'); }
  catch(e) {
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
      `Preserve ALL {placeholder} tokens exactly as-is. Keep translations short and natural for a mobile app. ` +
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
function findSaved(topic) {
  const k = topic.trim().toLowerCase();
  return store.lessons.find(l => l.topic.toLowerCase() === k) || null;
}
function upsert(data) {
  const k = data.topic.toLowerCase();
  const i = store.lessons.findIndex(l => l.topic.toLowerCase() === k);
  const now = new Date().toISOString();
  const existing = i >= 0 ? store.lessons[i] : null;
  const entry = { ...data,
    generatedAt: existing?.generatedAt || now,
    updatedAt:   now };
  if (i >= 0) store.lessons[i] = entry; else store.lessons.unshift(entry);
  saveStore(store);
}

// ── Flag storage ──────────────────────────────────────────────────────
function getFlags()  { return store.flags || {}; }
function setFlags(f) { store.flags = f; saveStore(store); }
function getStorylines()  { return store.storylines || {}; }
function setStorylines(s) { store.storylines = s; saveStore(store); }
function topicSlug(topic) { return (topic||'').slice(0,30).replace(/\s+/g,'_'); }
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
  const S = langName(srcLang || 'en');
  return `You are a lesson plan creator. Return ONLY a valid JSON object, no markdown, no explanation.
Schema: {"topic":"display title (max 40 chars, concise)","topicEmoji":"one emoji","lessonThemes":["theme1","theme2","theme3"]}
CRITICAL: The "topic" display title and ALL THREE "lessonThemes" strings MUST be written in ${S}. Do not use any other language for these fields.
Rules: topic is a concise display title for the user's input — shorten if the input is longer than 40 characters. Choose 3 progressive lesson themes for that topic.`;
}

function difficultyLabel(d) {
  return d === 1 ? 'beginner' : d === 2 ? 'intermediate' : 'advanced';
}
function sentenceLengthSpec(d) {
  return d === 1 ? '3–6 words'
       : d === 2 ? '6–10 words'
       : '10–16 words (complex grammar, subordinate clauses welcome)';
}
function sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, styleHint, dialect) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const sentLen = sentenceLengthSpec(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basics'
                   : lessonNum === 2 ? 'phrases / patterns'
                   : 'specific / idiomatic vocabulary';
  const dialectNote = dialect ? `\n- The target language variety is: ${dialect}. Use vocabulary and spelling appropriate to this dialect/variety.` : '';
  const styleNote = styleHint ? `\n- Match this story's style and mood when writing vocab and sentences: ${styleHint}` : '';
  return `You are a ${L} language lesson generator for a vocabulary learning app.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

The learner speaks ${S} and is learning ${L}.
Field names in the schema are fixed ("it" and "en") but their CONTENT must be in the languages specified below.

Schema:
{
  "title": "short lesson theme in ${S} (3-5 words)",
  "desc": "up to 8 words describing this lesson, written in ${S}",
  "icon": "one relevant emoji",
  "vocab": [
    {"target":"${L} word or short phrase","source":"${S} translation of that word"}
  ],
  "sentences": [
    {"target":"A natural ${L} sentence","source":"${S} translation of that sentence"}
  ]
}

Rules:
- vocab: exactly 8 items, all unique ${L} words, topic-relevant, overall difficulty: ${diff}, lesson focus: ${lessonDiff}
- sentences: exactly 5 items, each using vocabulary words naturally, each structurally different
- sentence length: ${sentLen} — vary lengths naturally
- sentences must be complete natural ${L} sentences — do NOT provide a words[] array
- CRITICAL "it" fields: MUST contain ONLY ${L} — absolutely never ${S} or any other language
- CRITICAL "en" fields: MUST contain ONLY ${S} — absolutely never ${L} or English (unless ${S} is English)
- "title" and "desc": MUST be written in ${S}${dialectNote}${styleNote}${lang==='ja'?'\n- JAPANESE: In sentence "it" fields, annotate each kanji with its reading in square brackets (e.g. 日本語[にほんご]).':''}` ;
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
  const dialectNote = dialect ? ` The target language variety is: ${dialect}.` : '';
  return `You are a ${L} language lesson extractor for a vocabulary learning app.
You will be given a ${L} story and its ${S} translation. Your job is to extract vocabulary and sentences STRICTLY from the provided texts — do NOT invent anything.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

The learner speaks ${S} and is learning ${L}.
Field names in the schema are fixed ("it" and "en") but their CONTENT must be in the languages specified below.

Schema:
{
  "title": "short lesson theme in ${S} (3-5 words)",
  "desc": "up to 8 words describing this lesson, written in ${S}",
  "icon": "one relevant emoji",
  "vocab": [
    {"target":"${L} word or short phrase extracted from the story","source":"${S} translation of that word"}
  ],
  "sentences": [
    {"target":"A sentence from the ${L} story","source":"Corresponding ${S} translation"}
  ]
}

Rules:
- vocab: exactly 8 items for lesson ${lessonNum} of ${totalLessons} (focus: ${lessonDiff}), all extracted from the story text, difficulty: ${diff}
- sentences: exactly 5 items, each a complete sentence taken verbatim from the ${L} story, with its matching ${S} translation from the provided translation
- sentence pairs must be aligned: the ${S} must be the actual translation of that ${L} sentence, not a paraphrase
- sentence length: prefer sentences of ${sentLen}
- sentences must NOT be duplicated across lessons — focus on different parts of the text for each lesson
- CRITICAL "it" fields: MUST contain ONLY ${L} — never invented, never ${S} or any other language
- CRITICAL "en" fields: MUST contain ONLY ${S} — never ${L}, never English (unless ${S} is English)
- "title" and "desc": MUST be written in ${S}${dialectNote}${lang==='ja'?'\n- JAPANESE: In sentence "it" fields, annotate each kanji with its reading in square brackets (e.g. 日本語[にほんご]).':''}` ;
}

// Lesson prompt for table format
function sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, dialect) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basic vocabulary'
                   : lessonNum === 2 ? 'phrases and patterns'
                   : 'specific and idiomatic expressions';
  const dialectNote = dialect ? ` Use the ${dialect} dialect/variety.` : '';
  return `You are a ${L} language lesson creator.${dialectNote}
The learner speaks ${S} and is learning ${L}.
Create lesson ${lessonNum} of ${totalLessons} focused on ${lessonDiff} at ${diff} level.
Output TWO markdown tables and nothing else.

Table 1 — Vocabulary (exactly 8 rows):
| ${L} word | ${S} meaning | Pronunciation for ${S} speakers |
|---|---|---|
| word in ${L} | translation in ${S} | phonetic pronunciation |

Table 2 — Sentences (exactly 5 rows):
| ${L} sentence | ${S} translation |
|---|---|
| sentence in ${L} | translation in ${S} |

Rules:
- Column 1 (${L} content): MUST be genuine ${L} — never ${S} or another language
- Column 2 (${S} content): MUST be in ${S} — never ${L} or English (unless ${S} is English)
- Pronunciation: write phonetically for ${S} speakers, CAPS for stressed syllable
- No extra text, no headings outside the tables, no JSON${lang==='ja'?'\n- JAPANESE: In the sentence column, annotate each kanji with its hiragana reading in square brackets (e.g. 日本語[にほんご]).':''}` ;
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

function sysSrcRepair(srcLang) {
  const S = langName(srcLang || 'en');
  return `You are a language exercise repairer for a Duolingo-style app.
You will receive a list of faulty exercises with optional user comments explaining the error.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.

Each exercise has a type. Return corrected versions preserving the same type and schema:
- mcq_target_source:      {"type":"mcq_target_source","target":"target language","source":"${S}","correct":"correct ${S}","choices":["4 ${S} options"]}
- mcq_source_target:      {"type":"mcq_source_target","source":"${S}","target":"target language","correct":"correct target language","choices":["4 target language options"]}
- listen_mcq:     {"type":"listen_mcq","target":"target language","correct":"correct ${S}","choices":["4 ${S} options"]}
- listen_type:    {"type":"listen_type","target":"target language","correct":"target language word"}
- read_translate: {"type":"read_translate","target":"target language sentence","source":"${S}","correct":"correct ${S}","choices":["4 ${S} options"]}
- order:          {"type":"order","target":"target language sentence","source":"${S}"}

Rules:
- Fix translation errors, wrong choices, incorrect pronunciations
- Pay close attention to user comments — they describe what is specifically wrong
- For order type: do NOT include words[] — the app derives it automatically from "it"
- Keep the same topic and difficulty level
- Return exactly as many items as given`;
}

// ── JSON helpers ──────────────────────────────────────────────────────
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
  const L = langName(lang);
  const S = langName(srcLang || 'en');
  return `You are a professional translator. Translate the following ${L} text into natural, fluent ${S}. Translate sentence by sentence in the same order. Output only the ${S} translation — no explanations, no original text, no markdown.`;
}

// ── Story prompts ─────────────────────────────────────────────────────
function sysStory(lang, isContinuation, wordCount, dialect) {
  const L = langName(lang);
  const wc = Math.max(100, Math.min(1000, wordCount || 300));
  const paraLo = Math.max(1, Math.floor(wc / 100));
  const paraHi = paraLo + 1;
  const cont = isContinuation
    ? ' IMPORTANT: This is a continuation story. You will be given the previous story. Continue with the SAME characters, world, and narrative thread — but shift the topic and setting to the new one. Characters should feel familiar; the world connected.'
    : '';
  const furiganaNote = lang==='ja' ? ' Annotate every kanji with furigana using HTML ruby tags, e.g. <ruby>日本語<rt>にほんご</rt></ruby>.' : '';
  const dialectNote = dialect ? ` Write in the ${dialect} dialect/variety.` : '';
  return `You are a creative writer and ${L} language teacher. Write a short story directly in ${L} on the given topic — aim for ${paraLo}-${paraHi} paragraphs, under ${wc} words. Prioritise quality over length: stop early rather than pad or repeat. Never repeat a sentence or paragraph in altered form. Avoid repetitive structures. Plain prose only — no headings, no bullets, no markdown. Write entirely in ${L}.${dialectNote}${furiganaNote}${cont}`;
}

// ── Error-hunt lesson prompt ─────────────────────────────────────────
function sysErrorHunt(lang, difficulty) {
  const L = langName(lang);
  const nSpell   = difficulty >= 3 ? 4 : 3;
  const nGrammar = difficulty >= 2 ? 3 : 2;
  return `You are a language exercise generator for ${L} learners.
Given a ${L} story, introduce exactly ${nSpell} spelling errors and ${nGrammar} grammar errors that a language novice might make.

Spelling error types (use varied examples):
- swap a correct letter for a similar-looking/sounding one (e.g. "b"/"d", "ei"/"ie", "c"/"g")
- omit or double an interior letter (e.g. "manger" → "mnager")
- wrong vowel that sounds plausible (e.g. "o" → "u", "e" → "i")
- missing or wrong accent/diacritic where relevant
NEVER add/remove punctuation. NEVER change capitalisation at sentence start.

Grammar error types (use varied examples):
- wrong gender on article or adjective (e.g. "il" → "la" for masculine noun)
- wrong verb ending for the subject (e.g. "mangiano" → "mangia" for plural subject)
- wrong tense (e.g. present instead of past)
- wrong or missing preposition
- wrong plural/singular form

Rules:
- Modify ONLY a single word (or at most two adjacent words) per edit
- The "find" string MUST appear verbatim and EXACTLY ONCE in the story
- Do NOT touch punctuation, numbers, or proper nouns
- Errors must be plausible novice mistakes, not random gibberish
- CRITICAL: "find" and "replace" MUST be different strings — never return the same value for both
- CRITICAL: verify each replacement actually changes the word before including it

Return ONLY a JSON object, no markdown, no extra text:
{ "edits": [ { "type": "spelling"|"grammar", "find": "exact original word(s)", "replace": "corrupted version", "reason": "one-line explanation" } ] }`;
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
  const sys = `You are a creative writing assistant. Given a multi-chapter story, produce a single JSON object with exactly two fields: "title" (a short evocative series title, 2–5 words) and "icon" (one emoji that fits the story). The "title" MUST be written in ${S}. Return ONLY the JSON object, no markdown, no explanation.`;
  const user = `Chapter topics:\n${topicList}\n\nStory excerpts:\n${storyExcerpts}\n\nWrite the title in ${S}.`;
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

// ── Generate error-hunt lesson ───────────────────────────────────────
async function generateErrorHunt(story, lang, difficulty, jobId) {
  jobStep(jobId, `[${OLLAMA_MODEL}] Generating error-hunt lesson…`);
  const sys = sysErrorHunt(lang, difficulty);
  const userMsg = `Here is the ${langName(lang)} story:\n\n${story}\n\nIntroduce the errors now. Return only JSON.`;
  const { text: raw, promptTokens, completionTokens } = await callOllamaRaw(OLLAMA_MODEL, sys, userMsg, 1200);
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch(e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Error-hunt: could not parse JSON from model: ' + cleaned.slice(0, 80));
    parsed = JSON.parse(m[0]);
  }
  const edits = (parsed.edits || []).filter(e =>
    e.find && e.replace &&
    e.find !== e.replace &&
    e.find.trim() !== e.replace.trim() &&
    ['spelling','grammar'].includes(e.type) &&
    story.includes(e.find)
  );
  if (edits.length === 0) throw new Error('Error-hunt: no valid edits produced (all find===replace or not found in story)');
  let corruptedStory = story;
  const appliedEdits = [];
  for (const e of edits) {
    if (!corruptedStory.includes(e.find)) continue;
    if (e.find === e.replace) continue;
    corruptedStory = corruptedStory.replace(e.find, e.replace);
    appliedEdits.push({ type: e.type, find: e.find, replace: e.replace, reason: e.reason || '' });
  }
  if (appliedEdits.length === 0) throw new Error('Error-hunt: all edits were no-ops after applying');
  console.log(`    Error-hunt: ${appliedEdits.length} edits applied (${appliedEdits.map(e=>e.type).join(', ')})`);
  const noOps = (parsed.edits||[]).filter(e=>e.find&&e.find===e.replace);
  if (noOps.length) console.warn(`    Error-hunt: ${noOps.length} no-op edits discarded: ${noOps.map(e=>e.find).join(', ')}`);
  return {
    lesson: {
      id: 4, type: 'error_hunt',
      title: 'Text Understanding',
      desc: 'Find the mistakes in the story',
      icon: '🔍',
      corruptedStory,
      edits: appliedEdits,
    },
    tokens: { promptTokens, completionTokens },
  };
}

// ── Generate one lesson — returns {lesson, tokens} ────────────────────
async function generateOneLesson(lang, srcLang, topic, lessonNum, totalLessons, prevVocab, story, difficulty, jobId, opts) {
  opts = opts || {};
  const { userTranslation, userDialect, styleHint } = opts;
  const useTable = OLLAMA_LESSON_FORMAT === 'table';
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Lesson ${lessonNum}/${totalLessons}…`);

  let sysPrompt, userMsg;

  if (userTranslation) {
    if (useTable) {
      sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
      const prevHint = prevVocab.length
        ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Extract vocabulary and sentences from this story and its translation.\n\nSTORY:\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}`;
    } else {
      sysPrompt = sysLessonFromText(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
      const prevHint = prevVocab.length
        ? `\nVocabulary already used in earlier lessons (avoid repeating these):\n${prevVocab.map(v => v.target + ' = ' + v.source).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.\n\nSTORY (${langName(lang)}):\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}\n\nReturn only the JSON object.`;
    }
  } else if (useTable) {
    sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect);
    const prevHint = prevVocab.length
      ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
      : '';
    const storyHint = story ? `\n\nContext story:\n${story.slice(0, 600)}` : '';
    userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.${storyHint}${prevHint}`;
  } else {
    sysPrompt = sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, styleHint, userDialect);
    const prevHint = prevVocab.length
      ? `\nVocabulary already covered in earlier lessons (do NOT repeat these):\n${prevVocab.map(v => v.target + ' = ' + v.source).join(', ')}`
      : '';
    const storyHint = story
      ? `\nContext — use vocabulary and themes from this story where natural:\n${story.slice(0, 800)}`
      : '';
    userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.${storyHint}${prevHint}\nReturn only the JSON object.`;
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
  const { userStory, userTranslation, userDialect } = userOpts;
  srcLang = srcLang || 'en';
  const userTopic = topic;
  const genStart = Date.now();
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  const lessonTokenStats = [];

  jobStep(jobId, `[${OLLAMA_MODEL}] Generating topic info…`);
  let meta;
  try {
    const { text: raw, promptTokens, completionTokens } = await callLLM(sysMeta(srcLang),
      `Topic: "${topic}". Source language for output: ${langName(srcLang)}. Return the JSON with topicEmoji and 3 lessonThemes, all text in ${langName(srcLang)}.`, 512);
    meta = extractJSON(raw);
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
  } catch(e) {
    meta = { topic, topicEmoji: '📚', lessonThemes: ['1', '2', '3'] };
    console.warn('  Meta failed, using fallback:', e.message);
  }

  // If srcLang is not English, explicitly translate topic + themes to make sure they're in the right language.
  // This is a cheap targeted call that's more reliable than hoping the meta model follows language instructions.
  if (srcLang && srcLang !== 'en') {
    try {
      const S = langName(srcLang);
      const toTranslate = JSON.stringify({ topic: meta.topic || topic, themes: meta.lessonThemes || [] });
      const sysTransMeta = `Translate the given JSON values into ${S}. Return ONLY a valid JSON object with the same keys: {"topic":"...","themes":["...","...","..."]}. No explanation, no markdown. All output text must be in ${S}.`;
      const { text: rawT, promptTokens: pt, completionTokens: ct } = await callLLM(sysTransMeta, toTranslate, 256);
      const translated = extractJSON(rawT);
      if (translated.topic) meta.topic = translated.topic;
      if (Array.isArray(translated.themes) && translated.themes.length) meta.lessonThemes = translated.themes;
      totalPromptTokens += pt; totalCompletionTokens += ct;
      console.log(`    Meta translated to ${S}: "${meta.topic}"`);
    } catch(e) {
      console.warn(`  Meta translation to ${langName(srcLang)} failed, keeping original:`, e.message);
    }
  }

  // ── Story: use user-supplied or generate ─────────────────────────────
  let story = null;
  let storyPrompt = null;
  const storyLang = lang;

  if (userStory) {
    story = userStory.trim();
    storyPrompt = userTranslation ? 'User-provided story + translation' : 'User-provided story';
    console.log(`    Using user-provided story (${story.length} chars)${userTranslation?' + translation':''}${userDialect?', dialect: '+userDialect:''}`);
  } else {
    const prevStoryFull = continuedFrom ? (findSaved(continuedFrom)?.story || null) : null;
    const prevStory = prevStoryFull
      ? prevStoryFull.slice(-OLLAMA_MAX_PREV_STORY)
      : null;
    if (continuedFrom && prevStory)
      console.log(`    Continuing from: "${continuedFrom}" (using last ${prevStory.length}/${prevStoryFull.length} chars)`);
    jobStep(jobId, `[${OLLAMA_MODEL}] Generating story (~${storyLen} words)…`);
    try {
      const t0 = Date.now();
      const storyUserMsg = prevStory
        ? `Previous story (excerpt):\n${prevStory}\n\nNew topic: "${userTopic}". Write the continuation now. Plain prose, no headings.`
        : `Write a story for the topic: "${userTopic}". Plain prose, no headings.`;
      const storySystem = sysStory(lang, !!prevStory, storyLen, userDialect);
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

  // ── Lessons ───────────────────────────────────────────────────────────
  const styleHint = (!storyTranslation && story) ? story.slice(0, 600) : null;
  const lessons = [];

  if (difficulty === 4) {
    try {
      const { lesson, tokens } = await generateErrorHunt(story, lang, 3, jobId);
      lessons.push(lesson);
      totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
      lessonTokenStats.push(tokens);
    } catch(e) {
      console.error('  Error-hunt generation failed:', e.message);
      throw new Error('Error-hunt lesson failed: ' + e.message);
    }
  } else {
    const TOTAL = 3;
    let prevVocab = [];
    const lessonOpts = { userTranslation: storyTranslation || null, userDialect: userDialect || null, styleHint };
    for (let i = 1; i <= TOTAL; i++) {
      try {
        const { lesson, tokens } = await generateOneLesson(
          lang, srcLang, topic, i, TOTAL, prevVocab, story, difficulty, jobId, lessonOpts);
        lessons.push(lesson);
        prevVocab = prevVocab.concat(lesson.vocab);
        totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
        lessonTokenStats.push(tokens);
      } catch(e) {
        console.warn(`  Lesson ${i} failed, skipping: ${e.message}`);
        jobStep(jobId, `⚠ Lesson ${i} failed — continuing…`);
      }
    }
    if (lessons.length === 0)
      throw new Error('All lessons failed to generate — nothing to save.');
    if (lessons.length < TOTAL)
      console.warn(`  Partial result: ${lessons.length}/${TOTAL} lessons generated.`);
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
    lessons,
    generationStats: { totalMs, backend: 'ollama', model: modelLabel,
      lessonFormat: OLLAMA_LESSON_FORMAT,
      totalPromptTokens, totalCompletionTokens, lessons: lessonTokenStats }
  };
}

// ── Repair flagged exercises ──────────────────────────────────────────
async function repairLesson(topic, lessonId, jobId) {
  const saved = findSaved(topic);
  if (!saved) throw new Error(`Topic not found: ${topic}`);
  const lessonIdx = saved.lessons.findIndex(l => l.id === lessonId);
  if (lessonIdx < 0) throw new Error(`Lesson ${lessonId} not found`);
  const lesson = JSON.parse(JSON.stringify(saved.lessons[lessonIdx]));
  const origVocabCount    = lesson.vocab.length;
  const origSentenceCount = lesson.sentences.length;
  const allTopicFlags = flagsForTopic(topic);
  const lessonItSet = new Set([
    ...(lesson.vocab||[]).map(v => (v.target||'').slice(0,40).replace(/\s+/g,'_')),
    ...(lesson.sentences||[]).map(s => (s.target||'').slice(0,40).replace(/\s+/g,'_'))
  ]);
  const flaggedEntries = allTopicFlags.filter(([k]) => {
    const parts = k.split(':');
    const contentSlug = parts.slice(2).join(':');
    return lessonItSet.has(contentSlug);
  });
  if (flaggedEntries.length === 0) throw new Error('No flagged exercises found for this lesson');
  const lang = saved.lang || 'it';
  const srcLang = saved.srcLang || 'en';
  const flaggedExercises = flaggedEntries.map(([, v]) => ({ ...v, _userComment: v.comment || undefined }));
  const BATCH_SIZE = 4;
  const batches = [];
  for (let i = 0; i < flaggedExercises.length; i += BATCH_SIZE)
    batches.push({ exercises: flaggedExercises.slice(i, i + BATCH_SIZE),
                   entries:   flaggedEntries.slice(i, i + BATCH_SIZE) });
  console.log(`  Repairing ${flaggedExercises.length} exercise(s) in "${topic}" lesson ${lessonId} (${batches.length} batch${batches.length>1?'es':''})`);
  function mergeRepaired(repaired) {
    if (['order','read_translate'].includes(repaired.type) && repaired.target) {
      const idx = lesson.sentences.findIndex(s =>
        s.target.toLowerCase().slice(0,20) === (repaired.target||'').toLowerCase().slice(0,20));
      if (idx >= 0) {
        const s = { target: repaired.target, source: repaired.source || lesson.sentences[idx].source };
        lesson.sentences[idx] = deriveSentenceWords(s, saved.lang);
      }
    }
    if (['mcq_target_source','mcq_source_target','listen_mcq','listen_type'].includes(repaired.type) && repaired.target) {
      const idx = lesson.vocab.findIndex(v =>
        v.target.toLowerCase().slice(0,15) === (repaired.target||'').toLowerCase().slice(0,15));
      if (idx >= 0) lesson.vocab[idx] = {
        target: repaired.target, source: repaired.source || lesson.vocab[idx].source,
        };
    }
  }
  const repairStart = Date.now();
  let repairPromptTokens = 0, repairCompletionTokens = 0;
  let totalRepaired = 0;
  const clearedKeys = [];
  const SYS_REPAIR = sysSrcRepair(srcLang);
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    if (jobId) jobStep(jobId, `Repairing batch ${b+1}/${batches.length}…`);
    const commentNote = batch.exercises.some(e => e._userComment)
      ? '\nNote: some exercises include user comments. Pay close attention to these.' : '';
    const vocabRef = lesson.vocab.map(v=>`${v.target} = ${v.source}`).join(', ');
    const sentRef  = lesson.sentences.map(s=>s.target).join(' | ');
    const userMsg = `Language: ${langName(lang)}. Source language: ${langName(srcLang)}. Topic: "${topic}".
Reference vocabulary for this lesson (use ONLY these ${langName(lang)} words/phrases as the basis for corrections):
${vocabRef}
Reference sentences:
${sentRef}
${commentNote}
Fix these ${batch.exercises.length} faulty exercises (batch ${b+1}/${batches.length}):
${JSON.stringify(batch.exercises, null, 2)}
Return only the corrected JSON array.`;
    console.log(`    Batch ${b+1}/${batches.length}: ${batch.exercises.length} exercise(s)…`);
    const arr = await withRetry(`Repair batch ${b+1}`, async () => {
      const { text: raw, promptTokens: pt, completionTokens: ct } = await callLLMLesson(SYS_REPAIR, userMsg, 2048);
      repairPromptTokens += pt; repairCompletionTokens += ct;
      let a;
      try { a = extractArray(raw); } catch(_) { a = salvageArray(raw); }
      if (!Array.isArray(a) || a.length === 0) throw new Error('No repaired exercises returned');
      return a.map(ex => {
        if (ex.type === 'order' && ex.target)
          ex.words = deriveSentenceWords({target:ex.target}, saved.lang).words;
        return ex;
      });
    });
    arr.forEach(mergeRepaired);
    totalRepaired += arr.length;
    clearedKeys.push(...batch.entries.map(([k]) => k));
  }
  if (lesson.vocab.length < origVocabCount || lesson.sentences.length < origSentenceCount)
    throw new Error(`Repair would shrink lesson — rejecting`);
  saved.lessons[lessonIdx] = lesson;
  const repairMs = Date.now() - repairStart;
  const prev = saved.repairStats || { repairCount: 0, totalMs: 0, promptTokens: 0, completionTokens: 0 };
  saved.repairStats = {
    repairCount:      prev.repairCount      + 1,
    totalMs:          prev.totalMs          + repairMs,
    promptTokens:     prev.promptTokens     + repairPromptTokens,
    completionTokens: prev.completionTokens + repairCompletionTokens,
  };
  upsert(saved);
  const flags = getFlags();
  for (const k of clearedKeys) delete flags[k];
  setFlags(flags);
  console.log(`  Repair complete: ${totalRepaired} exercise(s) fixed, ${clearedKeys.length} flag(s) cleared, ${repairMs}ms`);
  return { repaired: totalRepaired, lesson };
}

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
  console.log(`  Storage : ${STORAGE_FILE} (${store.lessons.length} lessons)`);
  console.log('='.repeat(44) + '\n');

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
      const list = store.lessons.map(l => ({
        topic: l.topic, topicEmoji: l.topicEmoji, lang: l.lang || 'it',
        srcLang: l.srcLang || 'en',
        difficulty: l.difficulty || 2,
        storyLen: l.storyLen || 300,
        continuedFrom: l.continuedFrom || null,
        generatedAt: l.generatedAt,
        updatedAt:   l.updatedAt || l.generatedAt,
        lessonCount: l.lessons?.length || 0,
        ratings: l.ratings || null,
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
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      saved.topic = newTopic.trim().slice(0, 80);
      if (topicEmoji) saved.topicEmoji = topicEmoji;
      // Remove old entry and insert updated one
      store.lessons = store.lessons.filter(l => l.topic.toLowerCase() !== oldTopic.trim().toLowerCase());
      store.lessons.unshift(saved);
      saveStore(store);
      console.log(`  Renamed: "${oldTopic}" → "${saved.topic}"`);
      return json(res, 200, { ok: true, topic: saved.topic, topicEmoji: saved.topicEmoji });
    }
    if (M === 'DELETE' && url.pathname === '/api/lessons/delete') {
      const t = url.searchParams.get('topic');
      if (!t) return json(res, 400, { error: 'Missing topic' });
      store.lessons = store.lessons.filter(l => l.topic.toLowerCase() !== t.trim().toLowerCase());
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
      const { chainKey, title, icon } = body;
      if (!chainKey) return json(res, 400, { error: 'Missing chainKey' });
      const sl = getStorylines();
      if (title === null) {
        delete sl[chainKey];
      } else {
        sl[chainKey] = { title: (title||'').slice(0,80), icon: (icon||'📖').slice(0,8) };
      }
      setStorylines(sl);
      return json(res, 200, { ok: true });
    }
    if (M === 'POST' && url.pathname === '/api/storyline-title') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topics } = body;
      if (!Array.isArray(topics) || !topics.length) return json(res, 400, { error: 'Missing topics array' });
      const stories = topics.map(t => (findSaved(t)||{}).story || '');
      const srcLang = (findSaved(topics[0])||{}).srcLang || 'en';
      try {
        const result = await generateStorylineTitle(topics, stories, srcLang);
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

    // ── Generate (async — returns jobId immediately) ─────────────
    if (M === 'POST' && url.pathname === '/api/generate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const { topic, lang, srcLang, difficulty, storyLen, continuedFrom, forceRegenerate,
              userStory, userTranslation, userDialect } = body;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(4, parseInt(difficulty, 10) || 2));
      const wc = Math.max(100, Math.min(1000, parseInt(storyLen, 10) || 300));
      const contFrom = (!userStory && continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
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
      // Eagerly ensure UI strings exist for this source language (non-blocking)
      if (resolvedSrcLang !== 'en') ensureUIForLang(resolvedSrcLang).catch(e =>
        console.warn('  UI pre-translation failed:', e.message));
      const userOpts = {
        userStory:       userStory       ? String(userStory).trim()       : null,
        userTranslation: userTranslation ? String(userTranslation).trim() : null,
        userDialect:     userDialect     ? String(userDialect).trim()     : null,
      };
      console.log(`  Generating: "${topic}" (${langName(lang||'it')}, from ${langName(resolvedSrcLang)}) diff=${diff} storyLen=${wc}${userOpts.userStory?' userStory=yes':''}${userOpts.userTranslation?' translation=yes':''}${userOpts.userDialect?' dialect='+userOpts.userDialect:''}${contFrom?' cont='+contFrom:''} job=${jobId}`);
      generate(topic.trim(), lang || 'it', resolvedSrcLang, diff, contFrom, wc, jobId, userOpts).then(data => {
        upsert(data);
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

    // ── Repair (async — returns jobId immediately) ────────────────
    if (M === 'POST' && url.pathname === '/api/repair') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, lessonId } = body;
      if (!topic)    return json(res, 400, { error: 'Missing topic' });
      if (!lessonId) return json(res, 400, { error: 'Missing lessonId' });
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available for repair.' });
      const topicKey = topic.trim().toLowerCase();
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already busy with this topic. Please wait.' });
      const jobId = newJob();
      generatingTopics.add(topicKey);
      repairLesson(topic.trim(), parseInt(lessonId, 10), jobId).then(result => {
        jobDone(jobId, result);
      }).catch(e => {
        console.error('  Repair error:', e.message);
        jobFail(jobId, e.message);
      }).finally(() => {
        generatingTopics.delete(topicKey);
      });
      return json(res, 202, { jobId });
    }

    // ── Repair story ─────────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/repair-story') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, instruction } = body;
      if (!topic || !instruction) return json(res, 400, { error: 'Missing topic or instruction' });
      if (active === 'none') return json(res, 503, { error: 'No LLM backend.' });
      const saved = findSaved(topic);
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      const jobId = newJob();
      console.log(`  Rewriting story for "${topic}" job=${jobId}`);
      (async () => {
        try {
          jobStep(jobId, 'Rewriting story…');
          const lang = saved.lang || 'it';
          const userMsg = [
            `Topic: "${topic}".`,
            saved.story ? `Current story:\n${saved.story}\n\nUser instruction: ${instruction}` : `Write a new story. Instruction: ${instruction}`,
            'Plain prose, no headings.'
          ].join('\n');
          const rewriteSys = sysStory(lang, false);
          const { text } = await callLLM(rewriteSys, userMsg, 900);
          saved.story = text.trim();
          saved.storyLang = lang;
          saved.storyPrompt = rewriteSys + '\n\n' + userMsg;
          delete saved.storyNative;
          upsert(saved);
          jobDone(jobId, { story: saved.story, storyPrompt: saved.storyPrompt });
        } catch(e) { jobFail(jobId, e.message); }
      })();
      return json(res, 202, { jobId });
    }

    // ── Rate a topic ──────────────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/rate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, ratings } = body;
      if (!topic || !ratings) return json(res, 400, { error: 'Missing topic or ratings' });
      const saved = findSaved(topic);
      if (!saved) return json(res, 404, { error: 'Topic not found' });
      saved.ratings = { difficulty: ratings.difficulty, fun: ratings.fun, coherence: ratings.coherence };
      upsert(saved);
      return json(res, 200, { ok: true });
    }

    // ── Import lessons.json ───────────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/import') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const incoming = Array.isArray(body) ? body : body.lessons;
      if (!Array.isArray(incoming) || incoming.length === 0)
        return json(res, 400, { error: 'Expected {lessons:[...]} or a non-empty array' });
      const invalid = incoming.filter(l => !l.topic || !Array.isArray(l.lessons));
      if (invalid.length)
        return json(res, 400, { error: `${invalid.length} entries missing topic or lessons` });
      let added = 0, updated = 0;
      for (const l of incoming) {
        const exists = findSaved(l.topic);
        upsert(l);
        if (exists) updated++; else added++;
      }
      console.log(`  Import: +${added} new, ~${updated} updated`);
      return json(res, 200, { ok: true, added, updated, total: store.lessons.length });
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
