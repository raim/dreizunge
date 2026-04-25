#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT         = parseInt(process.env.PORT || '3000', 10);
const STORAGE_FILE = path.join(__dirname, 'lessons.json');
const BACKEND      = (process.env.LLM_BACKEND || 'auto').toLowerCase();
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL   || 'claude-sonnet-4-20250514';
const OLLAMA_HOST    = process.env.OLLAMA_HOST    || 'http://localhost:11434';
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL   || 'qwen2.5:7b';
const OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '360000', 10);

// ── Storage ───────────────────────────────────────────────────────────
function loadStore() {
  try { if (fs.existsSync(STORAGE_FILE)) return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8')); }
  catch(e) { console.warn('Could not read lessons.json:', e.message); }
  return { lessons: [] };
}
function saveStore(s) {
  try { fs.writeFileSync(STORAGE_FILE, JSON.stringify(s, null, 2), 'utf8'); }
  catch(e) { console.warn('Could not write lessons.json:', e.message); }
}
let store = loadStore();
function findSaved(topic) {
  const k = topic.trim().toLowerCase();
  return store.lessons.find(l => l.topic.toLowerCase() === k) || null;
}
function upsert(data) {
  const k = data.topic.toLowerCase();
  const i = store.lessons.findIndex(l => l.topic.toLowerCase() === k);
  const entry = { ...data, generatedAt: new Date().toISOString() };
  if (i >= 0) store.lessons[i] = entry; else store.lessons.unshift(entry);
  saveStore(store);
}

// ── Flag storage ──────────────────────────────────────────────────────
function getFlags()  { return store.flags || {}; }
function setFlags(f) { store.flags = f; saveStore(store); }

// Flag key must match client-side flagKey() exactly:
// "<topic_slug>:<type>:<content_slug>"
function serverFlagKey(topic, type, itOrEn) {
  const topicSlug   = (topic||'unknown').slice(0,30).replace(/\s+/g,'_');
  const contentSlug = (itOrEn||'').slice(0,40).replace(/\s+/g,'_');
  return `${topicSlug}:${type}:${contentSlug}`;
}

// Collect all flags belonging to a topic (exact key-prefix match)
function flagsForTopic(topic) {
  const prefix = (topic||'').slice(0,30).replace(/\s+/g,'_') + ':';
  const all = getFlags();
  return Object.entries(all).filter(([k]) => k.startsWith(prefix));
}

// ── Generation lock ───────────────────────────────────────────────────
const generatingTopics = new Set();

// ── Language config ───────────────────────────────────────────────────
const LANG_NAMES = {
  it: 'Italian', fr: 'French', de: 'German',
  es: 'Spanish', pt: 'Portuguese',
};
function langName(code) { return LANG_NAMES[code] || code || 'Italian'; }

// ── Prompts ───────────────────────────────────────────────────────────
const SYS_META = `You are a lesson plan creator. Return ONLY a valid JSON object, no markdown, no explanation.
Schema: {"topic":"cleaned topic string","topicEmoji":"one emoji","lessonThemes":["theme1","theme2","theme3"]}
Rules: topic is the user's topic, normalized. Choose 3 progressive lesson themes for that topic.`;

function sysVocab(lang, lessonNum, totalLessons) {
  const L = langName(lang);
  return `You are a ${L} vocabulary generator for a Duolingo-style app.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.

Schema:
[
  {"it":"${L} word or short phrase","en":"English meaning","pron":"phonetic for English speakers, CAPS for stressed syllable"}
]

Rules:
- Return exactly 8 items, no duplicates
- Each item must have a different "it" value — never repeat the same ${L} word
- Topic-relevant vocabulary only
- Lesson ${lessonNum} of ${totalLessons} difficulty: ${lessonNum === 1 ? 'beginner basics' : lessonNum === 2 ? 'intermediate phrases' : 'advanced/specific vocabulary'}`;
}

function sysSentences(lang, lessonNum, totalLessons) {
  const L = langName(lang);
  return `You are a ${L} sentence generator for a Duolingo-style app.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.

Schema:
[
  {
    "it": "A natural ${L} sentence, 5-9 words",
    "en": "English translation",
    "words": ["each","word","no","punctuation"]
  }
]

Rules:
- Return exactly 5 sentences
- "words" must contain ONLY the content words of the ${L} sentence — NO punctuation tokens at all
- Every word in "words" must appear in "it" — do not add extra words or repeat words unnecessarily
- Each sentence must use DIFFERENT words — do not repeat the same sentence structure
- Use the provided vocabulary words naturally
- Lesson ${lessonNum} of ${totalLessons} difficulty: ${lessonNum === 1 ? 'beginner basics' : lessonNum === 2 ? 'intermediate phrases' : 'advanced/specific vocabulary'}`;
}

function sysLessonMeta(lang) {
  return `You are a ${langName(lang)} lesson titler. Return ONLY a valid JSON object, no markdown, no explanation.
Schema: {"title":"short lesson theme (3-5 words)","desc":"up to 8 words describing this lesson","icon":"one relevant emoji"}`;
}

const SYS_REPAIR = `You are a language exercise repairer for a Duolingo-style app.
You will receive a list of faulty exercises with optional user comments explaining the error.
Return ONLY a valid JSON array — no markdown, no explanation, nothing else.

Each exercise has a type. Return corrected versions preserving the same type and schema:
- mcq_it_en:      {"type":"mcq_it_en","it":"target language","en":"English","pron":"phonetic","correct":"correct English","choices":["4 English options"]}
- mcq_en_it:      {"type":"mcq_en_it","en":"English","it":"target language","correct":"correct target language","choices":["4 target language options"]}
- listen_mcq:     {"type":"listen_mcq","it":"target language","pron":"phonetic","correct":"correct English","choices":["4 English options"]}
- listen_type:    {"type":"listen_type","it":"target language","pron":"phonetic","correct":"target language word"}
- read_translate: {"type":"read_translate","it":"target language sentence","en":"English","correct":"correct English","choices":["4 English options"]}
- order:          {"type":"order","it":"target language sentence","en":"English","words":["content","words","only","no","punctuation"]}

Rules:
- Fix translation errors, wrong choices, incorrect pronunciations
- Pay close attention to user comments — they describe what is specifically wrong
- For order type: words[] must contain ONLY content words, NO punctuation tokens, randomly shuffled
- Keep the same topic and difficulty level
- Return exactly as many items as given`;

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
function callAnthropicRaw(system, userMsg, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: maxTokens || 1024, system,
      messages: [{ role: 'user', content: userMsg }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(d);
          if (p.error) return reject(new Error('Anthropic: ' + p.error.message));
          resolve(p.content[0].text);
        } catch(e) { reject(new Error('Anthropic parse: ' + e.message)); }
      });
    });
    req.on('error', e => reject(new Error('Anthropic network: ' + e.message)));
    req.write(body); req.end();
  });
}

function callOllamaRaw(system, userMsg, maxTokens) {
  const call = new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model: OLLAMA_MODEL, stream: false, keep_alive: -1,
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
          resolve(text);
        } catch(e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0,200))); }
      });
    });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message)));
    req.write(body); req.end();
  });
  const timeout = new Promise((_,reject) =>
    setTimeout(() => reject(new Error('Ollama timeout')), OLLAMA_TIMEOUT)
  );
  return Promise.race([call, timeout]);
}

function callLLM(active, system, userMsg, maxTokens) {
  if (active === 'anthropic') return callAnthropicRaw(system, userMsg, maxTokens);
  if (active === 'ollama')    return callOllamaRaw(system, userMsg, maxTokens);
  throw new Error('No LLM backend configured.');
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

function validateAndCleanSentences(arr, lang) {
  return arr.slice(0, 5).map(s => {
    if (!s.words || !Array.isArray(s.words) || s.words.length === 0)
      s.words = s.it.split(' ');

    // Remove punctuation tokens
    s.words = s.words.filter(t => !isPunct(t));

    // Detect English in words[] and rebuild
    const joined = normSpaces(s.words.join(' '));
    const itNorm = normSpaces(s.it || '');
    const enNorm = normSpaces(s.en || '');
    if (joined === enNorm && joined !== itNorm) {
      console.warn(`    words[] was English — rebuilding from target sentence`);
      s.words = s.it.split(' ').filter(t => !isPunct(t));
    }

    // Deduplicate: remove repeated words beyond 2 occurrences
    const counts = {};
    s.words = s.words.filter(w => {
      const lw = w.toLowerCase();
      counts[lw] = (counts[lw] || 0) + 1;
      return counts[lw] <= 2;
    });

    if (s.words.length < 2)
      s.words = s.it.split(' ').filter(t => !isPunct(t));

    return s;
  });
}

// ── Generate vocab ────────────────────────────────────────────────────
async function generateVocab(active, lang, topic, lessonNum, totalLessons, prevVocab) {
  const prevHint = prevVocab.length
    ? `\nAlready introduced (do NOT use any of these, generate 8 completely NEW items):\n${prevVocab.map(v => v.it + ' = ' + v.en).join(', ')}`
    : '';
  const userMsg = `Topic: "${topic}". Generate 8 ${langName(lang)} vocabulary items. All 8 must have unique target-language words. Return only the JSON array.${prevHint}`;

  return withRetry(`Vocab ${lessonNum}`, async () => {
    const raw = await callLLM(active, sysVocab(lang, lessonNum, totalLessons), userMsg, 1024);
    let arr;
    try { arr = extractArray(raw); } catch(_) { arr = salvageArray(raw); }
    if (!Array.isArray(arr) || arr.length < 4)
      throw new Error(`Only ${arr?.length ?? 0} vocab items`);
    // Deduplicate by 'it' field
    const seen = new Set();
    arr = arr.filter(v => { const k=v.it?.toLowerCase(); if(!k||seen.has(k)) return false; seen.add(k); return true; });
    if (arr.length < 4) throw new Error(`Only ${arr.length} unique vocab items after dedup`);
    return arr.slice(0, 8);
  });
}

// ── Generate sentences ────────────────────────────────────────────────
async function generateSentences(active, lang, topic, lessonNum, totalLessons, vocab) {
  const vocabList = vocab.map(v => `${v.it} (${v.en})`).join(', ');
  const userMsg = `Topic: "${topic}". Use these ${langName(lang)} words naturally: ${vocabList}.\nGenerate 5 ${langName(lang)} sentences with NO punctuation in words[]. Return only the JSON array.`;

  return withRetry(`Sentences ${lessonNum}`, async () => {
    const raw = await callLLM(active, sysSentences(lang, lessonNum, totalLessons), userMsg, 1024);
    let arr;
    try { arr = extractArray(raw); } catch(_) { arr = salvageArray(raw); }
    if (!Array.isArray(arr) || arr.length < 3)
      throw new Error(`Only ${arr?.length ?? 0} sentences`);

    arr = validateAndCleanSentences(arr, lang);

    const bad = arr.filter(s => normSpaces(s.words.join(' ')) === normSpaces(s.en || ''));
    if (bad.length > 1)
      throw new Error(`${bad.length} sentences still have English in words[] — retrying`);

    return arr;
  });
}

// ── Generate lesson meta ──────────────────────────────────────────────
async function generateLessonMeta(active, lang, topic, lessonNum, totalLessons) {
  const userMsg = `Topic: "${topic}", lesson ${lessonNum} of ${totalLessons} (${lessonNum===1?'beginner':lessonNum===2?'intermediate':'advanced'}). Return only the JSON object.`;
  try {
    const raw = await callLLM(active, sysLessonMeta(lang), userMsg, 256);
    return extractJSON(raw);
  } catch(_) {
    return { title: `Lesson ${lessonNum}`, desc: topic, icon: '📖' };
  }
}

// ── Generate one lesson ───────────────────────────────────────────────
async function generateOneLesson(active, lang, topic, lessonNum, totalLessons, prevVocab) {
  console.log(`  [${lessonNum+1}/${totalLessons+1}] Generating lesson ${lessonNum}…`);
  const [meta, vocab] = await Promise.all([
    generateLessonMeta(active, lang, topic, lessonNum, totalLessons),
    generateVocab(active, lang, topic, lessonNum, totalLessons, prevVocab)
  ]);
  const sentences = await generateSentences(active, lang, topic, lessonNum, totalLessons, vocab);
  return { id: lessonNum, title: meta.title, desc: meta.desc, icon: meta.icon, vocab, sentences };
}

// ── Generate all lessons ──────────────────────────────────────────────
async function generate(topic, lang, active) {
  console.log(`  [1/4] Generating topic meta… (lang: ${lang})`);
  let meta;
  try {
    const raw = await callLLM(active, SYS_META,
      `Topic: "${topic}". Return the JSON with topicEmoji and 3 lessonThemes.`, 512);
    meta = extractJSON(raw);
  } catch(e) {
    meta = { topic, topicEmoji: '📚', lessonThemes: ['Basics', 'Phrases', 'Advanced'] };
    console.warn('  Meta failed, using fallback:', e.message);
  }

  const TOTAL = 3;
  const lessons = [];
  let prevVocab = [];
  for (let i = 1; i <= TOTAL; i++) {
    const lesson = await generateOneLesson(active, lang, topic, i, TOTAL, prevVocab);
    lessons.push(lesson);
    prevVocab = prevVocab.concat(lesson.vocab);
  }
  return { topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚', lang, lessons };
}

// ── Repair flagged exercises ──────────────────────────────────────────
async function repairLesson(active, topic, lessonId) {
  const saved = findSaved(topic);
  if (!saved) throw new Error(`Topic not found: ${topic}`);
  const lesson = saved.lessons.find(l => l.id === lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} not found`);

  // Snapshot original counts for safety check
  const origVocabCount     = lesson.vocab.length;
  const origSentenceCount  = lesson.sentences.length;

  // Collect flags using exact prefix matching
  const flaggedEntries = flagsForTopic(topic);
  if (flaggedEntries.length === 0) throw new Error('No flagged exercises found for this topic');

  const lang = saved.lang || 'it';
  const flaggedExercises = flaggedEntries.map(([, v]) => ({
    ...v,
    _userComment: v.comment || undefined  // include comment if present
  }));

  console.log(`  Repairing ${flaggedExercises.length} flagged exercise(s) in "${topic}" lesson ${lessonId}…`);

  const commentNote = flaggedExercises.some(e => e._userComment)
    ? '\nNote: some exercises include user comments explaining the specific error. Pay close attention to these.'
    : '';

  const userMsg = `Language: ${langName(lang)}. Topic: "${topic}".${commentNote}\nFix these ${flaggedExercises.length} faulty exercises:\n${JSON.stringify(flaggedExercises, null, 2)}\nReturn only the corrected JSON array.`;

  return withRetry('Repair', async () => {
    const raw = await callLLM(active, SYS_REPAIR, userMsg, 2048);
    let arr;
    try { arr = extractArray(raw); } catch(_) { arr = salvageArray(raw); }
    if (!Array.isArray(arr) || arr.length === 0)
      throw new Error('No repaired exercises returned');

    // Clean order exercises
    arr = arr.map(ex => {
      if (ex.type === 'order' && Array.isArray(ex.words))
        ex.words = validateAndCleanSentences([{it:ex.it,en:ex.en,words:ex.words}], lang)[0].words;
      return ex;
    });

    // Merge back — update vocab and sentences in place
    arr.forEach(repaired => {
      if (['order','read_translate'].includes(repaired.type) && repaired.it) {
        const idx = lesson.sentences.findIndex(s =>
          s.it.toLowerCase().slice(0,20) === (repaired.it||'').toLowerCase().slice(0,20)
        );
        if (idx >= 0) {
          lesson.sentences[idx] = {
            it: repaired.it,
            en: repaired.en || lesson.sentences[idx].en,
            words: repaired.words || lesson.sentences[idx].words
          };
        }
      }
      if (['mcq_it_en','mcq_en_it','listen_mcq','listen_type'].includes(repaired.type) && repaired.it) {
        const idx = lesson.vocab.findIndex(v =>
          v.it.toLowerCase().slice(0,15) === (repaired.it||'').toLowerCase().slice(0,15)
        );
        if (idx >= 0) {
          lesson.vocab[idx] = {
            it: repaired.it,
            en: repaired.en || lesson.vocab[idx].en,
            pron: repaired.pron || lesson.vocab[idx].pron
          };
        }
      }
    });

    // Safety check: never save if repair deleted content
    if (lesson.vocab.length < origVocabCount || lesson.sentences.length < origSentenceCount) {
      throw new Error(`Repair would shrink lesson (vocab: ${origVocabCount}→${lesson.vocab.length}, sentences: ${origSentenceCount}→${lesson.sentences.length}) — rejecting`);
    }

    // Save updated lesson
    upsert(saved);

    // Clear ALL flags for this topic (use same prefix logic)
    const flags = getFlags();
    for (const [k] of flaggedEntries) delete flags[k];
    setFlags(flags);

    console.log(`  Repair complete: ${arr.length} exercise(s) fixed, ${flaggedEntries.length} flag(s) cleared`);
    return { repaired: arr.length, lesson };
  });
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
  process.stdout.write('  Warming up model… ');
  return new Promise(resolve => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model: OLLAMA_MODEL, stream: false, keep_alive: -1,
      options: { num_predict: 1 },
      messages: [{ role: 'user', content: 'hi' }]
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
  if      (BACKEND === 'anthropic') active = 'anthropic';
  else if (BACKEND === 'ollama')    active = 'ollama';
  else if (BACKEND === 'none')      active = 'none';
  else if (ANTHROPIC_KEY)           active = 'anthropic';
  else {
    process.stdout.write('  Checking Ollama… ');
    active = (await pingOllama()) ? 'ollama' : 'none';
    console.log(active === 'ollama' ? 'reachable ✓' : 'not found — offline mode');
  }

  if (active === 'ollama') await warmupOllama();

  console.log('\n\u{1F1EE}\u{1F1F9}  Impara l\'Italiano');
  console.log('='.repeat(44));
  console.log(`  Port    : ${PORT}`);
  console.log(`  Backend : ${active}`);
  if (active === 'anthropic') console.log(`  Model   : ${CLAUDE_MODEL}`);
  if (active === 'ollama')    console.log(`  Ollama  : ${OLLAMA_HOST}  (${OLLAMA_MODEL})`);
  if (active === 'none')      console.log('  Offline — only saved lessons available');
  console.log(`  Storage : ${STORAGE_FILE}`);
  console.log('='.repeat(44) + '\n');

  http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const M   = req.method.toUpperCase();

    if (M === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }

    if (M === 'GET' && url.pathname === '/api/info') {
      return json(res, 200, {
        backend: active, ollamaModel: OLLAMA_MODEL, claudeModel: CLAUDE_MODEL,
        canGenerate: active !== 'none'
      });
    }

    if (M === 'GET' && url.pathname === '/api/lessons') {
      return json(res, 200, store.lessons.map(l => ({
        topic: l.topic, topicEmoji: l.topicEmoji, lang: l.lang || 'it',
        generatedAt: l.generatedAt, lessonCount: l.lessons?.length || 0
      })));
    }

    if (M === 'GET' && url.pathname === '/api/lessons/load') {
      const t = url.searchParams.get('topic');
      if (!t) return json(res, 400, { error: 'Missing topic' });
      const s = findSaved(t);
      if (!s) return json(res, 404, { error: 'Not found' });
      return json(res, 200, s);
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
        delete flags[key];
        console.log(`  Flag removed: ${key}`);
      } else {
        flags[key] = entry;
        console.log(`  Flag saved: ${key}${entry.comment?' (with comment)':''}`);
      }
      setFlags(flags);
      return json(res, 200, { ok: true });
    }

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
      generatingTopics.add(topicKey);
      try {
        const result = await repairLesson(active, topic.trim(), parseInt(lessonId, 10));
        return json(res, 200, result);
      } catch(e) {
        console.error('  Repair error:', e.message);
        return json(res, 500, { error: e.message });
      } finally {
        generatingTopics.delete(topicKey);
      }
    }

    if (M === 'POST' && url.pathname === '/api/generate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const { topic, lang, forceRegenerate } = body;
      if (!topic || topic.trim().length < 2) return json(res, 400, { error: 'Topic too short' });
      const topicKey = topic.trim().toLowerCase();
      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached) { console.log(`  Cache hit: "${topic}"`); return json(res, 200, { ...cached, fromCache: true }); }
      }
      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Set ANTHROPIC_API_KEY or start Ollama, then restart.' });
      if (generatingTopics.has(topicKey)) {
        console.log(`  Duplicate request ignored: "${topic}"`);
        return json(res, 429, { error: 'Already generating lessons for this topic. Please wait.' });
      }
      generatingTopics.add(topicKey);
      console.log(`  Generating [${active}]: "${topic}" (${langName(lang||'it')})`);
      try {
        const data = await generate(topic.trim(), lang || 'it', active);
        upsert(data);
        console.log(`  Saved: "${data.topic}" (${data.lessons.length} lessons)`);
        return json(res, 200, { ...data, fromCache: false });
      } catch(e) {
        console.error('  Generation error:', e.message);
        return json(res, 500, { error: e.message });
      } finally {
        generatingTopics.delete(topicKey);
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
