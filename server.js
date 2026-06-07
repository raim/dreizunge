#!/usr/bin/env node
'use strict';

const http  = require('http');
const { execFile } = require('child_process');
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
  funny:         'Comedic tone, wordplay, absurdist situations, punchlines.',
  romantic:      'Warm, emotionally rich, evocative imagery.',
  sensual:       'Rich in texture and atmosphere, suggestive but not explicit.',
  horror:        'Suspenseful, eerie atmosphere, foreboding.',
  action:        'Fast-paced, kinetic, short punchy sentences.',
  philosophical: 'Contemplative, questioning, abstract ideas.',
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

Example (German lesson, Italian speaker):
{"target":"laufen","source":"correre"},{"target":"der Hund","source":"il cane"}
Example (Italian lesson, English speaker):
{"target":"correre","source":"to run"},{"target":"il cane","source":"the dog"}

Rules:
- vocab: exactly 8 items, all unique ${L} words, topic-relevant, overall difficulty: ${diff}, lesson focus: ${lessonDiff}
- sentences: exactly 5 items, each using vocabulary words naturally, each structurally different
- sentence length: ${sentLen} — vary lengths naturally
- sentences must be complete natural ${L} sentences — do NOT provide a words[] array
- CRITICAL "target" fields: MUST contain ONLY ${L} — absolutely never ${S} or any other language
- CRITICAL "source" fields: MUST contain ONLY ${S} — absolutely never ${L} or any other language. If ${S} is English, write English. Do NOT write ${L} synonyms or paraphrases.
- CRITICAL: "source" is a TRANSLATION of "target" into ${S}, not a synonym in ${L}
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

Example vocab items (German lesson, Italian speaker):
{"target":"laufen","source":"correre"},{"target":"der Hund","source":"il cane"}

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
Given a ${L} story, produce a corrupted version by introducing exactly ${nSpell} spelling errors and ${nGrammar} grammar errors.

SPELLING errors — change only an interior letter of one word:
- swap one letter for a similar-looking/sounding one (e.g. ei→ie, b→d)
- omit or double one interior letter (e.g. "manger"→"mnager")
- use a wrong vowel that sounds plausible (e.g. "o"→"u")
- wrong or missing accent/diacritic (e.g. "é"→"e")
The corrupted word must NOT be a prefix or suffix extension of the correct word.

GRAMMAR errors — add or remove a suffix on one word:
- wrong verb suffix for the subject (e.g. "explore"→"explores", "mangiano"→"mangia")
- wrong plural/singular (e.g. "cell"→"cells", "cats"→"cat")
- wrong tense suffix (e.g. "walk"→"walked", "oscillated"→"oscillate")
The correct word must be a prefix of the corrupted word or vice versa.

STRICT RULES — violations will cause the lesson to be rejected:
- Change ONLY a single complete word per error — never punctuation, numbers, proper nouns, or sentence-start capitals
- The correct word must appear verbatim in the original story
- The correct and corrupted words MUST be different
- Do NOT produce no-op changes (e.g. adding/removing only spaces or punctuation)
- Do NOT change more than one word per error
- Copy all other text EXACTLY — do not rephrase, reorder, or rewrite anything

Return ONLY the corrupted story text. No JSON, no explanation, no markdown.`;
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


async function generateStorylineSummary(topics, stories, vocab, srcLang) {
  srcLang = srcLang || 'en';
  const S = langName(srcLang);
  console.log(`\n── Storyline summary generation ─────────────────────`);
  console.log(`  Chapters : ${topics.length}, Lang: ${S}`);
  const chapterSummaries = topics.map((t, i) =>
    `Chapter ${i+1}: "${t}"\n${(stories[i]||'').slice(0, 600).replace(/\n/g,' ')}…`
  ).join('\n\n');
  const vocabList = [...new Set(vocab)].slice(0, 40).join(', ');
  const sys = `You are a language learning assistant. Given a multi-chapter story, write a concise summary in ${S} (3–5 sentences) that captures the main arc and key vocabulary themes. Write ONLY the summary text — no title, no preamble, no markdown.`;
  const user = `Chapters:\n${chapterSummaries}\n\nKey vocabulary: ${vocabList}\n\nWrite the summary in ${S}.`;
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
- "form" MUST be ONLY the conjugated verb form — do NOT include the pronoun in "form" (e.g. "lache" not "ich lache")${dialectNote}${writingStyleNote}`;
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

function generateMath(story, difficulty) {
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
  const ops = difficulty <= 1 ? ['+','-']
             : difficulty === 2 ? ['+','-','×']
             : ['+','-','×','÷'];

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
    else { if (b===0 || a%b!==0) continue; correct = a/b; }
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
      exercises,
    },
    tokens: { promptTokens: 0, completionTokens: 0 },
  };
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
  const { userDialect, storyStyle, chainVocab } = opts;
  const sys = sysGrammar(lang, srcLang, difficulty, userDialect, storyStyle);
  const priorNouns = chainVocab && chainVocab.nouns && chainVocab.nouns.length
    ? `\nPRIOR NOUNS from previous chapters (prefer these — reuse and reinforce where topic-relevant): ${chainVocab.nouns.slice(0, 15).map(n => n.target).join(', ')}`
    : '';
  const userMsg = `Topic: "${topic}". Generate 10 nouns with gender, article, and plural forms. Return only the JSON object.${priorNouns}`;
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
  const { userDialect, storyStyle, chainVocab } = opts;
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating conjugation lesson…`);
  const sys = sysConjugation(lang, srcLang, difficulty, userDialect, storyStyle);
  const priorVerbs = chainVocab && chainVocab.verbs && chainVocab.verbs.length
    ? `\nPRIOR VERBS from previous chapters (prefer these — reuse and reinforce where topic-relevant): ${chainVocab.verbs.slice(0, 10).map(v => v.target).join(', ')}`
    : '';
  const userMsg = `Topic: "${topic}". Generate 5 verbs with all present-tense conjugation forms. Return only the JSON object.${priorVerbs}`;
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
  const { userTranslation, userDialect, styleHint, writingStyle, storyLang, chainVocab } = opts;
  const useTable = OLLAMA_LESSON_FORMAT === 'table';
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Lesson ${lessonNum}/${totalLessons}…`);

  // Build prior-vocab hints for within-topic progression and cross-chapter reinforcement
  const chainHint = (chainVocab && chainVocab.length)
    ? `\nThis is a continuation lesson. REINFORCE these words from previous chapters by using them naturally in sentences (do NOT just repeat them as vocab items — weave them into the sentences):\n${chainVocab.slice(0, 30).map(v => v.target + (v.source ? ' (' + v.source + ')' : '')).join(', ')}`
    : '';

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
    sysPrompt = sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, styleHint, userDialect, writingStyle);
    const prevHint = prevVocab.length
      ? `\nVocabulary already covered in earlier lessons (do NOT repeat these):\n${prevVocab.map(v => v.target + ' = ' + v.source).join(', ')}`
      : '';
    const L = langName(lang);
    const S = langName(srcLang || 'en');
    const storyHint = story
      ? `\nUse the story context for themes/vocabulary inspiration:\n${story}\n\nREMINDER: "target" fields MUST be ${L}. "source" fields MUST be ${S} translations. Do NOT use the story's language for source fields.`
      : '';
    userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.\nTarget language: ${L}. Source/translation language: ${S}.${storyHint}${prevHint}${chainHint}\nReturn only the JSON object.`;
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
  const { userStory, userTranslation, userDialect, storyStyle, lessonFormat, reinforcePrior, useFullChain } = userOpts;
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

  // Collect vocabulary from all prior chapters when reinforcement is requested
  const chainVocab = (reinforcePrior && continuedFrom) ? collectChainVocab(continuedFrom) : { words: [], nouns: [], verbs: [] };
  const chainOpts = { userDialect, storyStyle, chainVocab };

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation' || lessonFormat === 'math') {
    const genFn   = lessonFormat === 'math'        ? () => Promise.resolve(generateMath(story, difficulty))
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
    const lessonOpts = { userTranslation: storyTranslation || null, userDialect: userDialect || null, styleHint, writingStyle: storyStyle || null };
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
      const { slId, chainKey, title, icon, summary, tags } = body;
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
              userStory, userTranslation, userDialect, storyStyle, reinforcePrior, useFullChain } = body;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math'].includes(lessonFormat) ? lessonFormat : 'standard';
      const wcMax = body.userStory ? 2000 : 1000;
      const wc = Math.max(100, Math.min(wcMax, parseInt(storyLen, 10) || 300));
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
        reinforcePrior:  reinforcePrior === true,
        useFullChain:    useFullChain === true,
      };
      console.log(`  Generating: "${topic}" (${langName(lang||'it')}, from ${langName(resolvedSrcLang)}) diff=${diff} fmt=${fmt} storyLen=${wc}${userOpts.userStory?' userStory=yes':''}${userOpts.userTranslation?' translation=yes':''}${userOpts.userDialect?' dialect='+userOpts.userDialect:''}${userOpts.storyStyle?' style='+userOpts.storyStyle:''}${contFrom?' cont='+contFrom:''} job=${jobId}`);
      generate(topic.trim(), lang || 'it', resolvedSrcLang, diff, contFrom, wc, jobId, userOpts).then(data => {
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
      const { topic, lessonFormat: fmt, difficulty: rawDiff, reinforcePrior: addReinforce } = body;
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
          const lessonOpts = { userTranslation: storyTranslation, userDialect: dialect, styleHint: null, writingStyle: style, storyLang: saved.storyLang || null, chainVocab: chainVocab.words };
          result = await generateOneLesson(lang, srcLang, topic.trim(), 1, 1, [], story, diff, jobId, lessonOpts);
        } else if (fmt === 'error_hunt') {
          result = await generateErrorHunt(story, lang, diff, jobId, chainVocab.words);
        } else if (fmt === 'grammar') {
          result = await generateGrammar(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab });
        } else if (fmt === 'conjugation') {
          result = await generateConjugation(topic.trim(), lang, srcLang, diff, jobId, { userDialect: dialect, storyStyle: style, chainVocab });
        } else if (fmt === 'math') {
          result = generateMath(story, diff);
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
        if (store.schemaVersion >= 29 && !findSaved(l.topic)?.id)
          _syncStorylineForTopic(l.topic, l.continuedFrom || null);
        if (exists) updated++; else added++;
      }
      // Merge incoming storylines (v29 exports)
      for (const sl of incomingStorylines) {
        if (sl.id && !findStoryline(sl.id)) upsertStoryline(sl);
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
