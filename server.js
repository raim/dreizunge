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
Schema: {"topic":"display title (max 40 chars, concise)","topicEmoji":"one emoji"}
CRITICAL: The "topic" display title MUST be written in ${S}. Do not use any other language.
Rules: topic is a concise display title for the user's input — shorten if the input is longer than 40 characters.`;
}

function difficultyLabel(d) {
  return d === 1 ? 'beginner' : d === 2 ? 'intermediate' : 'advanced';
}
function sentenceLengthSpec(d) {
  return d === 1 ? '3–6 words'
       : d === 2 ? '6–10 words'
       : '10–16 words (complex grammar, subordinate clauses welcome)';
}
const STORY_STYLES = {
  creative:      null,  // default — no extra instruction
  neutral:       'Clear, factual, neutral tone — no narrative flourish.',
  interview:   'Words useful in a job application interview. Clear, factual, neutral tone — no narrative flourish.',
  scientific:    'Academic register, precise terminology, formal structure.',
  journalism:    'Reportage style: direct, punchy, who/what/where/when.',
  essay:         'Discursive, argumentative, first-person reflective.',
  children:      'Simple vocabulary, playful tone, short sentences.',
    funny:         'You are a comedian, tell jokes, use wordplay, absurdist situations, punchlines.',
  romantic:      'Warm, emotionally rich, evocative imagery.',
  sensual:       'Rich in texture and atmosphere, suggestive but not explicit.',
  horror:        'Suspenseful, eerie atmosphere, foreboding.',
  action:        'Fast-paced, kinetic, short punchy sentences.',
    philosophical: 'Be philosophical: contemplative, questioning, discuss abstract ideas.',
    poem:          'Write a poem, with rhyming words and rhythm.',
    dialogue:      'Write a dialogue between two or more persons of the story, or alternatively one person soliloquy.',
};

function sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, styleHint, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const sentLen = sentenceLengthSpec(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basics'
                   : lessonNum === 2 ? 'phrases / patterns'
                   : 'specific / idiomatic vocabulary';
  const dialectNote = dialect ? `\n- The target language variety is: ${dialect}. Use vocabulary and spelling appropriate to this dialect/variety.` : '';
  const styleNote = styleHint ? `\n- Match this story's style and mood when writing vocab and sentences: ${styleHint}` : '';
  const writingStyleNote = STORY_STYLES[writingStyle] ? `\n- Writing style: ${STORY_STYLES[writingStyle]}` : '';
  return `You are a ${L} language lesson generator for a vocabulary learning app.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

The learner speaks ${S} and is learning ${L}.
Field names in the schema are fixed ("target" and "source") but their CONTENT must be in the languages specified below.

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
- CRITICAL "target" fields: MUST contain ONLY ${L} — absolutely never ${S} or any other language
- CRITICAL "source" fields: MUST contain ONLY ${S} — absolutely never ${L} or English (unless ${S} is English)
- "title" and "desc": MUST be written in ${S}${dialectNote}${styleNote}${writingStyleNote}${lang==='ja'?'\n- JAPANESE: In sentence "target" fields, annotate each kanji with its reading in square brackets (e.g. 日本語[にほんご]).':''}` ;
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
Field names in the schema are fixed ("target" and "source") but their CONTENT must be in the languages specified below.

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
- CRITICAL "target" fields: MUST contain ONLY ${L} — never invented, never ${S} or any other language
- CRITICAL "source" fields: MUST contain ONLY ${S} — never ${L}, never English (unless ${S} is English)
- "title" and "desc": MUST be written in ${S}${dialectNote}${writingStyleNote}${lang==='ja'?'\n- JAPANESE: In sentence "target" fields, annotate each kanji with its reading in square brackets (e.g. 日本語[にほんご]).':''}` ;
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

function sysSrcRepair(lang, srcLang, deepClean, lessonType) {
  const L = langName(lang || 'it');
  const S = langName(srcLang || 'en');
  const mode = deepClean
    ? `You will receive all vocab and sentences from a lesson. Verify and correct every item — fix wrong words, bad translations, non-${L} words in the target field, non-${S} words in the source field, and generate fresh distractors for all choices.`
    : `You will receive a list of faulty exercises with optional user comments explaining the error. Fix only what is wrong.`;
  return `You are a language exercise repairer for a Duolingo-style app.
${mode}
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.

Field names are fixed. Content rules:
- "target" fields: MUST contain ONLY ${L} — never ${S} or any other language
- "source" fields: MUST contain ONLY ${S} — never ${L}

Each exercise has a type. Return corrected versions preserving the same type and schema:
- mcq_target_source:      {"type":"mcq_target_source","target":"${L} word","source":"${S} translation","correct":"correct ${S}","choices":["4 distinct ${S} options"]}
- mcq_source_target:      {"type":"mcq_source_target","source":"${S} word","target":"${L} translation","correct":"correct ${L}","choices":["4 distinct ${L} options"]}
- listen_mcq:             {"type":"listen_mcq","target":"${L} word","correct":"correct ${S}","choices":["4 distinct ${S} options"]}
- listen_type:            {"type":"listen_type","target":"${L} word","correct":"${L} word"}
- read_translate:         {"type":"read_translate","target":"${L} sentence","source":"${S} translation","correct":"correct ${S}","choices":["4 distinct ${S} options"]}
- order:                  {"type":"order","target":"${L} sentence","source":"${S} translation"}
- grammar item:           {"type":"mcq_target_source","_grammarItem":true,"target":"${L} noun","source":"${S} translation","article":"correct ${L} article","plural":"correct ${L} plural","gender":"m|f|n|c","correct":"${S}","choices":["${S} options"]}
- mcq_conjugation:        {"type":"mcq_conjugation","infinitive":"${L} infinitive","source":"${S} translation","pronoun":"${L} pronoun","correct":"correct conjugated form","choices":["4 distinct ${L} forms"]}

Rules:
- Fix translation errors, wrong word forms, incorrect language in fields, bad distractors
- Distractors in choices must be plausible but clearly wrong — not random noise
- Pay close attention to user comments where present
- For order type: do NOT include words[] — the app derives it automatically from "target"
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
function sysStory(lang, isContinuation, wordCount, dialect, writingStyle) {
  const L = langName(lang);
  const wc = Math.max(100, Math.min(1000, wordCount || 300));
  const paraLo = Math.max(1, Math.floor(wc / 100));
  const paraHi = paraLo + 1;
  const cont = isContinuation
    ? ' IMPORTANT: This is a continuation story. You will be given the previous story. Continue with the SAME characters, world, and narrative thread — but shift the topic and setting to the new one. Characters should feel familiar; the world connected.'
    : '';
  const furiganaNote = lang==='ja' ? ' Annotate every kanji with furigana using HTML ruby tags, e.g. <ruby>日本語<rt>にほんご</rt></ruby>.' : '';
  const dialectNote = dialect ? ` Write in the ${dialect} dialect/variety.` : '';
  const writingStyleNote = STORY_STYLES[writingStyle] ? ` Writing style: ${STORY_STYLES[writingStyle]}` : '';
  return `You are a creative writer and ${L} language teacher. Write a short story directly in ${L} on the given topic — aim for ${paraLo}-${paraHi} paragraphs, under ${wc} words. Prioritise quality over length: stop early rather than pad or repeat. Never repeat a sentence or paragraph in altered form. Avoid repetitive structures. Plain prose only — no headings, no bullets, no markdown. Write entirely in ${L}.${dialectNote}${furiganaNote}${writingStyleNote}${cont}`;
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


// ── Grammar lesson: gender, articles, plurals ───────────────────────────────
function sysGrammar(lang, srcLang, difficulty, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const dialectNote = dialect ? `\n- Use the ${dialect} dialect/variety.` : '';
  const writingStyleNote = STORY_STYLES[writingStyle] ? `\n- Topic style: ${STORY_STYLES[writingStyle]}` : '';
  return `You are a ${L} grammar lesson generator for a vocabulary learning app.
The learner speaks ${S} and is learning ${L}.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

Generate a grammar lesson focused on noun gender, articles, and plural forms.
Schema:
{
  "title": "short lesson theme in ${S} (3-5 words)",
  "desc": "up to 8 words in ${S}",
  "icon": "one relevant emoji",
  "grammar": [
    {
      "target": "${L} noun in singular form (no article)",
      "source": "${S} translation of that noun",
      "gender": "m | f | n | c (common) — grammatical gender in ${L}",
      "article": "definite article in ${L} for this noun",
      "plural": "plural form of the noun in ${L}"
    }
  ]
}

Example (German ← French):
{"target":"Baum","source":"arbre","gender":"m","article":"der","plural":"Bäume"}

CRITICAL field language rules — violations will cause the lesson to be discarded:
- CRITICAL: "target" MUST contain ONLY a ${L} word — never ${S}, never the translation
- CRITICAL: "source" MUST contain ONLY the ${S} translation — never ${L}
- CRITICAL: "target" and "source" MUST be different words (never the same string)
- CRITICAL: "target" MUST be the SINGULAR form — never already a plural
- CRITICAL: "plural" MUST differ from "target" (if they are the same, choose a different noun)
- CRITICAL: "article" MUST be the correct ${L} definite article for the SINGULAR noun
- "target" must have no article prepended — singular noun only

Additional rules:
- grammar: exactly 10 nouns, varied difficulty: ${diff}, all topic-relevant
- Include nouns with interesting/irregular plurals and mixed genders
- If ${L} has no grammatical gender (e.g. English), set gender and article to null${dialectNote}${writingStyleNote}`;
}

// ── Conjugation lesson: verb forms by person ─────────────────────────────────
function sysConjugation(lang, srcLang, difficulty, dialect, writingStyle) {
  const L    = langName(lang);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const dialectNote = dialect ? `\n- Use the ${dialect} dialect/variety.` : '';
  const writingStyleNote = STORY_STYLES[writingStyle] ? `\n- Topic style: ${STORY_STYLES[writingStyle]}` : '';
  return `You are a ${L} grammar lesson generator for a vocabulary learning app.
The learner speaks ${S} and is learning ${L}.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

Generate a conjugation lesson focused on verb forms in the present tense.
Schema:
{
  "title": "short lesson theme in ${S} (3-5 words)",
  "desc": "up to 8 words in ${S}",
  "icon": "one relevant emoji",
  "conjugations": [
    {
      "infinitive": "verb infinitive in ${L}",
      "source": "${S} translation (to ...)",
      "tense": "present",
      "forms": [
        { "pronoun": "subject pronoun in ${L}", "form": "conjugated verb form" }
      ]
    }
  ]
}

Rules:
- conjugations: exactly 5 verbs at ${diff} level, topic-relevant, varied regularity
- forms: include ALL person forms for each verb (typically 6 for most European languages)
- Use the standard subject pronouns for ${L} (e.g. io/tu/lui/noi/voi/loro for Italian)
- "infinitive" MUST be in ${L}
- "source" MUST be in ${S}
- "form" MUST be the correct ${L} conjugated form for that pronoun${dialectNote}${writingStyleNote}`;
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
  const { userDialect, storyStyle } = opts;
  const sys = sysGrammar(lang, srcLang, difficulty, userDialect, storyStyle);
  const userMsg = `Topic: "${topic}". Generate 10 nouns with gender, article, and plural forms. Return only the JSON object.`;
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
  const { userDialect, storyStyle } = opts;
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating conjugation lesson…`);
  const sys = sysConjugation(lang, srcLang, difficulty, userDialect, storyStyle);
  const userMsg = `Topic: "${topic}". Generate 5 verbs with all present-tense conjugation forms. Return only the JSON object.`;
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
  const { userTranslation, userDialect, styleHint, writingStyle } = opts;
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
    sysPrompt = sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, styleHint, userDialect, writingStyle);
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
  const { userStory, userTranslation, userDialect, storyStyle, lessonFormat } = userOpts;
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
      const sysTransMeta = `Translate the given JSON values into ${S}. Return ONLY a valid JSON object with the same keys: {"topic":"..."}. No explanation, no markdown. All output text must be in ${S}.`;
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

  // ── Lessons ───────────────────────────────────────────────────────────
  const styleHint = (!storyTranslation && story) ? story.slice(0, 600) : null;
  const lessons = [];

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation') {
    const genFn   = lessonFormat === 'error_hunt'  ? () => generateErrorHunt(story, lang, difficulty, jobId)
                  : lessonFormat === 'grammar'      ? () => generateGrammar(topic, lang, srcLang, difficulty, jobId, { userDialect, storyStyle })
                  :                                   () => generateConjugation(topic, lang, srcLang, difficulty, jobId, { userDialect, storyStyle });
    const label   = lessonFormat === 'error_hunt'  ? 'Error-hunt'
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
    const lessonOpts = { userTranslation: storyTranslation || null, userDialect: userDialect || null, styleHint, writingStyle: storyStyle || null };
    try {
      const { lesson, tokens } = await generateOneLesson(
        lang, srcLang, topic, 1, 1, [], story, difficulty, jobId, lessonOpts);
      lessons.push(lesson);
      totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
      lessonTokenStats.push(tokens);
    } catch(e) {
      throw new Error(`Lesson generation failed: ${e.message}`);
    }
    if (isAllTypes) {
      // Generate grammar, conjugation, and error_hunt as additional lessons
      const extraFmts = [
        { fmt: 'grammar',     label: 'Grammar',     fn: () => generateGrammar(topic, lang, srcLang, difficulty, jobId, { userDialect, storyStyle }) },
        { fmt: 'conjugation', label: 'Conjugation', fn: () => generateConjugation(topic, lang, srcLang, difficulty, jobId, { userDialect, storyStyle }) },
        { fmt: 'error_hunt',  label: 'Error Hunt',  fn: () => generateErrorHunt(story, lang, difficulty, jobId) },
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
async function repairLesson(topic, lessonId, jobId, deepClean) {
  const saved = findSaved(topic);
  if (!saved) throw new Error(`Topic not found: ${topic}`);
  const lessonIdx = saved.lessons.findIndex(l => l.id === lessonId);
  if (lessonIdx < 0) throw new Error(`Lesson ${lessonId} not found`);
  const lesson = JSON.parse(JSON.stringify(saved.lessons[lessonIdx]));
  const origVocabCount    = (lesson.vocab||[]).length;
  const origSentenceCount = (lesson.sentences||[]).length;
  const lang = saved.lang || 'it';
  const srcLang = saved.srcLang || 'en';
  const allTopicFlags = flagsForTopic(topic);
  // Build content slug set — covers vocab/sentences for standard, grammar items, conjugation verbs
  const contentItems = [
    ...(lesson.vocab||[]).map(v => v.target||''),
    ...(lesson.sentences||[]).map(s => s.target||''),
    ...(lesson.grammar||[]).map(g => g.target||''),
    ...(lesson.conjugations||[]).flatMap(c => c.forms||[]).map(f => f.form||''),
  ];
  const lessonItSet = new Set(contentItems.map(t => t.slice(0,40).replace(/\s+/g,'_')));
  const flaggedEntries = allTopicFlags.filter(([k]) => {
    const parts = k.split(':');
    const contentSlug = parts.slice(2).join(':');
    return lessonItSet.has(contentSlug);
  });

  // Build exercise list: deepClean = all vocab+sentences; flags-only = flagged only
  let exercisesToFix, entriesForClearing;
  if (deepClean) {
    // Build exercise objects from all vocab and sentences.
    // Attach _originalTarget so mergeRepaired can match on the SENT target, not the returned one.
    // Attach flag comment where available.
    exercisesToFix = [
      ...(lesson.vocab||[]).map(v => {
        const flag = flaggedEntries.find(([,fv]) => fv.target === v.target);
        return { type:'mcq_target_source', target:v.target, source:v.source,
                 correct:v.source, choices:[v.source],
                 _originalTarget: v.target,
                 ...(flag?.[1]?.comment ? { _userComment: flag[1].comment } : {}) };
      }),
      ...(lesson.sentences||[]).map(s => {
        const flag = flaggedEntries.find(([,fv]) => fv.target === s.target);
        return { type:'read_translate', target:s.target, source:s.source,
                 correct:s.source, choices:[s.source],
                 _originalTarget: s.target,
                 ...(flag?.[1]?.comment ? { _userComment: flag[1].comment } : {}) };
      }),
      // Grammar lesson items
      ...(lesson.grammar||[]).map(g => {
        const flag = flaggedEntries.find(([,fv]) => fv.target === g.target);
        return { type:'mcq_target_source', target:g.target, source:g.source,
                 correct:g.source, choices:[g.source],
                 _grammarItem: true, article:g.article, plural:g.plural, gender:g.gender,
                 _originalTarget: g.target,
                 ...(flag?.[1]?.comment ? { _userComment: flag[1].comment } : {}) };
      }),
      // Conjugation lesson items
      ...(lesson.conjugations||[]).flatMap(c =>
        (c.forms||[]).map(f => {
          const flag = flaggedEntries.find(([,fv]) => fv.target === f.form);
          return { type:'mcq_conjugation', infinitive:c.infinitive, source:c.source,
                   pronoun:f.pronoun, correct:f.form, choices:[f.form],
                   target:f.form, _originalTarget: f.form,
                   ...(flag?.[1]?.comment ? { _userComment: flag[1].comment } : {}) };
        })
      ),
    ].filter(e => e.target); // skip any empty items
    entriesForClearing = flaggedEntries;
    console.log(`  Deep-clean ${exercisesToFix.length} item(s) in "${topic}" lesson ${lessonId}`);
  } else {
    if (flaggedEntries.length === 0) throw new Error('No flagged exercises found for this lesson');
    // Flags carry full exercise data (type, target, source, correct, choices).
    // Cross-reference with lesson to get _originalTarget for reliable mergeRepaired matching.
    exercisesToFix = flaggedEntries.map(([, v]) => {
      const orig = (lesson.vocab||[]).find(lv => lv.target === v.target)
                || (lesson.sentences||[]).find(ls => ls.target === v.target);
      return { ...v, _originalTarget: orig?.target || v.target,
               _userComment: v.comment || undefined };
    });
    entriesForClearing = flaggedEntries;
    console.log(`  Repairing ${exercisesToFix.length} exercise(s) in "${topic}" lesson ${lessonId} (flagged-only)`);
  }

  const BATCH_SIZE = 4;
  const batches = [];
  for (let i = 0; i < exercisesToFix.length; i += BATCH_SIZE)
    batches.push({ exercises: exercisesToFix.slice(i, i + BATCH_SIZE),
                   entries:   entriesForClearing.slice(i, i + BATCH_SIZE) });
  console.log(`  Batches: ${batches.length}`);
  // Build a lookup from _originalTarget → index for fast matching
  const vocabByOrig    = new Map((lesson.vocab||[]).map((v,i) => [v.target, i]));
  const sentenceByOrig = new Map((lesson.sentences||[]).map((s,i) => [s.target, i]));
  // Also keep a set of the _originalTarget values from exercisesToFix for reference
  const origTargets = new Map(exercisesToFix.map(e => [e._originalTarget, e]));

  // Extra lookup maps for grammar and conjugation
  const grammarByOrig = new Map((lesson.grammar||[]).map((g,i) => [g.target, i]));
  const conjByOrig    = new Map((lesson.conjugations||[]).flatMap((c,ci) =>
    (c.forms||[]).map((f,fi) => [f.form, { ci, fi }])
  ));

  function mergeRepaired(repaired) {
    // Determine the original target: prefer the _originalTarget we sent
    const origTarget = repaired._originalTarget
      || [...origTargets.keys()].find(k => k.toLowerCase().slice(0,20) === (repaired.target||'').toLowerCase().slice(0,20))
      || repaired.target;

    // Grammar item — match by origTarget against lesson.grammar[] first,
    // regardless of _grammarItem flag (LLM strips internal fields)
    if ((lesson.grammar||[]).length > 0) {
      const idx = grammarByOrig.has(origTarget) ? grammarByOrig.get(origTarget)
        : (lesson.grammar||[]).findIndex(g => g.target.toLowerCase().slice(0,15) === origTarget.toLowerCase().slice(0,15));
      if (idx >= 0) {
        const g = lesson.grammar[idx];
        lesson.grammar[idx] = { ...g,
          target:  repaired.target  || g.target,
          source:  repaired.source  || g.source,
          article: repaired.article !== undefined ? repaired.article : g.article,
          plural:  repaired.plural  !== undefined ? repaired.plural  : g.plural,
          gender:  repaired.gender  !== undefined ? repaired.gender  : g.gender,
        };
        grammarByOrig.set(repaired.target, idx);
        return;
      }
    }

    // Conjugation item
    if (repaired.type === 'mcq_conjugation' && repaired.correct) {
      const loc = conjByOrig.get(origTarget);
      if (loc) {
        lesson.conjugations[loc.ci].forms[loc.fi].form = repaired.correct;
        conjByOrig.set(repaired.correct, loc);
      } else { console.log(`    mergeRepaired: no conjugation match for "${origTarget.slice(0,30)}"`); }
      return;
    }

    if (['order','read_translate'].includes(repaired.type) && repaired.target) {
      const idx = sentenceByOrig.has(origTarget) ? sentenceByOrig.get(origTarget)
        : (lesson.sentences||[]).findIndex(s =>
            s.target.toLowerCase().slice(0,20) === origTarget.toLowerCase().slice(0,20));
      if (idx >= 0) {
        const s = { target: repaired.target, source: repaired.source || lesson.sentences[idx].source };
        lesson.sentences[idx] = deriveSentenceWords(s, saved.lang);
        sentenceByOrig.set(repaired.target, idx);
      } else { console.log(`    mergeRepaired: no sentence match for "${origTarget.slice(0,30)}"`); }
    }
    if (['mcq_target_source','mcq_source_target','listen_mcq','listen_type'].includes(repaired.type) && repaired.target) {
      const idx = vocabByOrig.has(origTarget) ? vocabByOrig.get(origTarget)
        : (lesson.vocab||[]).findIndex(v =>
            v.target.toLowerCase().slice(0,15) === origTarget.toLowerCase().slice(0,15));
      if (idx >= 0) {
        lesson.vocab[idx] = { target: repaired.target, source: repaired.source || lesson.vocab[idx].source };
        vocabByOrig.set(repaired.target, idx);
      } else { console.log(`    mergeRepaired: no vocab match for "${origTarget.slice(0,30)}"`); }
    }
  }
  const repairStart = Date.now();
  let repairPromptTokens = 0, repairCompletionTokens = 0;
  let totalRepaired = 0;
  const clearedKeys = [];
  const lessonType = lesson.type || 'standard';
  const SYS_REPAIR = sysSrcRepair(lang, srcLang, deepClean, lessonType);
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    if (jobId) jobStep(jobId, `${deepClean?'Cleaning':'Repairing'} batch ${b+1}/${batches.length}…`);
    const commentNote = batch.exercises.some(e => e._userComment)
      ? '\nNote: some exercises include user comments. Pay close attention to these.' : '';
    // In deep-clean mode the vocab/sentences ARE the broken items — don't use them as reference.
    // In flags-only mode, the rest of the lesson vocab is reliable context.
    const refSection = deepClean ? '' : (() => {
      const vocabRef = lesson.vocab.map(v=>`${v.target} = ${v.source}`).join(', ');
      const sentRef  = lesson.sentences.map(s=>s.target).join(' | ');
      return `Reference vocabulary (use as context for correct register and topic):\n${vocabRef}\nReference sentences:\n${sentRef}\n`;
    })();
    // Strip internal _originalTarget/_userComment from what we send to the LLM
    const exForLLM = batch.exercises.map(({ _originalTarget, _userComment, ...rest }) => ({
      ...rest, ...(_userComment ? { _userComment } : {})
    }));
    const userMsg = `Language: ${langName(lang)}. Source language: ${langName(srcLang)}. Topic: "${topic}".
${refSection}${commentNote}
Fix these ${batch.exercises.length} exercise(s) (batch ${b+1}/${batches.length}):
${JSON.stringify(exForLLM, null, 2)}
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
    clearedKeys.push(...(batch.entries||[]).map(([k]) => k));
  }
  // Validate item counts haven't shrunk (guard for all lesson types)
  const postVocabCount    = (lesson.vocab||[]).length;
  const postSentenceCount = (lesson.sentences||[]).length;
  const postGrammarCount  = (lesson.grammar||[]).length;
  if (postVocabCount < origVocabCount || postSentenceCount < origSentenceCount)
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
      const newLower = newTopic.trim().toLowerCase();
      store.lessons = store.lessons.filter(l =>
        l.topic.toLowerCase() !== oldTopic.trim().toLowerCase() &&
        l.topic.toLowerCase() !== newLower
      );
      store.lessons.unshift(saved);
      // Cascade rename into continuedFrom pointers on other lessons
      const oldLower = oldTopic.trim().toLowerCase();
      store.lessons.forEach(l => {
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
      const { topic, lang, srcLang, difficulty, lessonFormat, storyLen, continuedFrom, forceRegenerate,
              userStory, userTranslation, userDialect, storyStyle } = body;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types'].includes(lessonFormat) ? lessonFormat : 'standard';
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
      const userOpts = {
        userStory:       userStory       ? String(userStory).trim()       : null,
        userTranslation: userTranslation ? String(userTranslation).trim() : null,
        userDialect:     userDialect     ? String(userDialect).trim()     : null,
        storyStyle:      (storyStyle && STORY_STYLES.hasOwnProperty(storyStyle)) ? storyStyle : null,
        lessonFormat:    fmt,
      };
      console.log(`  Generating: "${topic}" (${langName(lang||'it')}, from ${langName(resolvedSrcLang)}) diff=${diff} fmt=${fmt} storyLen=${wc}${userOpts.userStory?' userStory=yes':''}${userOpts.userTranslation?' translation=yes':''}${userOpts.userDialect?' dialect='+userOpts.userDialect:''}${userOpts.storyStyle?' style='+userOpts.storyStyle:''}${contFrom?' cont='+contFrom:''} job=${jobId}`);
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

    // ── Deep-clean lesson (fix all vocab+sentences) ──────────────────
    if (M === 'POST' && url.pathname === '/api/repair-all') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, lessonId } = body;
      if (!topic)    return json(res, 400, { error: 'Missing topic' });
      if (!lessonId) return json(res, 400, { error: 'Missing lessonId' });
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      const topicKey = topic.trim().toLowerCase();
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already busy with this topic. Please wait.' });
      const jobId = newJob();
      generatingTopics.add(topicKey);
      repairLesson(topic.trim(), parseInt(lessonId, 10), jobId, true).then(result => {
        jobDone(jobId, result);
      }).catch(e => {
        console.error('  Deep-clean error:', e.message);
        jobFail(jobId, e.message);
      }).finally(() => {
        generatingTopics.delete(topicKey);
      });
      return json(res, 202, { jobId });
    }


    // ── Add lesson to existing topic ──────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/add-lesson') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topic, lessonFormat: fmt, difficulty: rawDiff } = body;
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
      console.log(`  Add lesson: "${topic}" fmt=${fmt} diff=${diff}`);

      const doGenLesson = async () => {
        let result;
        if (fmt === 'standard') {
          const storyTranslation = saved.storyTranslation || null;
          const styleHint = (!storyTranslation && story) ? story.slice(0, 600) : null;
          const lessonOpts = { userTranslation: storyTranslation, userDialect: dialect, styleHint, writingStyle: style };
          result = await generateOneLesson(lang, srcLang, topic.trim(), 1, 1, [], story, diff, jobId, lessonOpts);
        } else if (fmt === 'error_hunt') {
          result = await generateErrorHunt(story, lang, diff, jobId);
        } else if (fmt === 'grammar') {
          result = await generateGrammar(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style });
        } else if (fmt === 'conjugation') {
          result = await generateConjugation(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style });
        } else {
          throw new Error(`Unsupported lessonFormat: ${fmt}`);
        }
        // Compute next available ID (avoid clashing with existing)
        const maxId = Math.max(0, ...(saved.lessons||[]).map(l => l.id||0));
        const newLesson = { ...result.lesson, id: maxId + 1 };
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
