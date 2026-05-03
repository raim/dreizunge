#!/usr/bin/env node
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

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
  catch(e) {
    const hint = e.code === 'EACCES' ? ' — fix with: chmod u+w ' + STORAGE_FILE : '';
    console.error('Could not write lessons.json:', e.message + hint);
  }
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

// ── Language config ───────────────────────────────────────────────────
const LANG_NAMES = {
  it:'Italian', fr:'French', de:'German', es:'Spanish', pt:'Portuguese',
  nl:'Dutch', pl:'Polish', sv:'Swedish', ja:'Japanese', zh:'Mandarin Chinese',
  ar:'Arabic', ru:'Russian', ko:'Korean', tr:'Turkish', hi:'Hindi',
    lb: 'Lëtzebuergesch',
};
function langName(code) { return LANG_NAMES[code] || code || 'Italian'; }

// ── Prompts ───────────────────────────────────────────────────────────
const SYS_META = `You are a lesson plan creator. Return ONLY a valid JSON object, no markdown, no explanation.
Schema: {"topic":"cleaned topic string","topicEmoji":"one emoji","lessonThemes":["theme1","theme2","theme3"]}
Rules: topic is the user's topic, normalized. Choose 3 progressive lesson themes for that topic.`;

function difficultyLabel(d) {
  return d === 1 ? 'beginner' : d === 2 ? 'intermediate' : 'advanced';
}
function sentenceLengthSpec(d) {
  return d === 1 ? '3–6 words'
       : d === 2 ? '6–10 words'
       : '10–16 words (complex grammar, subordinate clauses welcome)';
}
function sysLesson(lang, lessonNum, totalLessons, difficulty) {
  const L    = langName(lang);
  const diff = difficultyLabel(difficulty || 2);
  const sentLen = sentenceLengthSpec(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basics'
                   : lessonNum === 2 ? 'phrases / patterns'
                   : 'specific / idiomatic vocabulary';
  return `You are a ${L} language lesson generator for a vocabulary learning app.
Return ONLY a valid JSON object — no markdown, no explanation, nothing else.

Schema:
{
  "title": "short lesson theme, 3-5 words",
  "desc": "up to 8 words describing this lesson",
  "icon": "one relevant emoji",
  "vocab": [
    {"it":"${L} word or short phrase","en":"English meaning","pron":"phonetic for English speakers, CAPS for stressed syllable"}
  ],
  "sentences": [
    {"it":"A natural ${L} sentence","en":"English translation"}
  ]
}

Rules:
- vocab: exactly 8 items, all unique ${L} words, topic-relevant, overall difficulty: ${diff}, lesson focus: ${lessonDiff}
- sentences: exactly 5 items, each using vocabulary words naturally, each structurally different
- sentence length: ${sentLen} — vary lengths naturally
- sentences must be complete natural ${L} sentences — do NOT provide a words[] array
- CRITICAL: every "it" field MUST be in ${L} ONLY — never English, never any other language`;
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
          resolve({
            text: p.content[0].text,
            promptTokens:     p.usage?.input_tokens  || 0,
            completionTokens: p.usage?.output_tokens || 0,
          });
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
          resolve({
            text,
            promptTokens:     p.prompt_eval_count || 0,
            completionTokens: p.eval_count        || 0,
          });
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

async function callLLM(active, system, userMsg, maxTokens) {
  if (active === 'anthropic') return callAnthropicRaw(system, userMsg, maxTokens);
  if (active === 'ollama')    return callOllamaRaw(system, userMsg, maxTokens);
  throw new Error('No LLM backend configured.');
}
async function callLLMText(active, system, userMsg, maxTokens) {
  const r = await callLLM(active, system, userMsg, maxTokens);
  return r.text;
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

// Derive words[] from sentence — guaranteed complete and correct
function deriveSentenceWords(s) {
  s.words = s.it.split(' ').filter(t => !isPunct(t));
  return s;
}

// ── Story prompts ─────────────────────────────────────────────────────
function sysStory(lang, inTargetLang) {
  const L = langName(lang);
  if (inTargetLang) {
    return `You are a creative writer and ${L} language teacher. Write a short, engaging story directly in ${L} (4-6 paragraphs, around 400 words) on the given topic. The story should naturally include vocabulary and situations useful for someone learning ${L}. Avoid repetitive structures! Write plain prose only — no headings, no bullet points, no markdown. Write entirely in ${L}.`;
  }
  return `You are a creative writer helping language learners. Write a short, engaging story in English (4-6 paragraphs, around 400 words) on the given topic. The story should naturally include vocabulary and situations useful for someone learning ${L}. Avoid repetitive structures! Write plain prose only — no headings, no bullet points, no markdown.`;
}

// ── Generate one lesson — returns {lesson, tokens} ────────────────────
async function generateOneLesson(active, lang, topic, lessonNum, totalLessons, prevVocab, story, difficulty, jobId) {
  jobStep(jobId, `Lesson ${lessonNum}/${totalLessons}: generating…`);
  const prevHint = prevVocab.length
    ? `\nVocabulary already covered in earlier lessons (do NOT repeat these, introduce 8 NEW items):\n${prevVocab.map(v => v.it + ' = ' + v.en).join(', ')}`
    : '';
  const storyHint = story
    ? `\nContext — use vocabulary and themes from this story where natural:\n${story.slice(0, 800)}`
    : '';
  const userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.${storyHint}${prevHint}\nReturn only the JSON object.`;
  const minWords = (difficulty || 2) === 1 ? 2 : 3;

  return withRetry(`Lesson ${lessonNum}`, async () => {
    const t0 = Date.now();
    const { text: raw, promptTokens, completionTokens } =
      await callLLM(active, sysLesson(lang, lessonNum, totalLessons, difficulty), userMsg, 2048);
    const ms = Date.now() - t0;
    let lesson;
    try { lesson = extractJSON(raw); }
    catch(_) {
      // Try salvaging as array (some models wrap in array)
      try {
        const arr = extractArray(raw);
        if (Array.isArray(arr) && arr[0]?.vocab) lesson = arr[0];
        else throw new Error('Not a lesson object');
      } catch(_2) { throw new Error('Could not parse lesson JSON'); }
    }

    // Validate vocab
    if (!Array.isArray(lesson.vocab) || lesson.vocab.length < 4)
      throw new Error(`Only ${lesson.vocab?.length ?? 0} vocab items`);
    // Dedup vocab
    const seen = new Set();
    lesson.vocab = lesson.vocab.filter(v => {
      const k = v.it?.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 8);
    if (lesson.vocab.length < 4) throw new Error(`Only ${lesson.vocab.length} unique vocab items`);

    // Validate sentences
    if (!Array.isArray(lesson.sentences) || lesson.sentences.length < 3)
      throw new Error(`Only ${lesson.sentences?.length ?? 0} sentences`);
    // Derive words[] from sentence text — no LLM words array needed
    lesson.sentences = lesson.sentences.slice(0, 5).map(deriveSentenceWords);
    const tooShort = lesson.sentences.filter(s => s.words.length < minWords);
    if (tooShort.length > 2)
      throw new Error(`${tooShort.length} sentences have fewer than ${minWords} words — retrying`);

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
async function generate(topic, lang, active, difficulty, storyInTargetLang, jobId) {
  const genStart = Date.now();
  let totalPromptTokens = 0, totalCompletionTokens = 0;
  const lessonTokenStats = [];

  jobStep(jobId, 'Generating topic info…');
  let meta;
  try {
    const t0 = Date.now();
    const { text: raw, promptTokens, completionTokens } = await callLLM(active, SYS_META,
      `Topic: "${topic}". Return the JSON with topicEmoji and 3 lessonThemes.`, 512);
    meta = extractJSON(raw);
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
  } catch(e) {
    meta = { topic, topicEmoji: '📚', lessonThemes: ['Basics', 'Phrases', 'Advanced'] };
    console.warn('  Meta failed, using fallback:', e.message);
  }

  jobStep(jobId, 'Generating story…');
  let story = null, storyLang = 'en';
  try {
    const t0 = Date.now();
    const { text, promptTokens, completionTokens } = await callLLM(active, sysStory(lang, storyInTargetLang),
      `Write a story for the topic: "${meta.topic || topic}". Plain prose, no headings.`, 900);
    story = text.trim();
    storyLang = storyInTargetLang ? lang : 'en';
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
    console.log(`    Story (${storyLang}): ${Date.now()-t0}ms`);
  } catch(e) { console.warn('  Story failed:', e.message); }

  const TOTAL = 3;
  const lessons = [];
  let prevVocab = [];
  for (let i = 1; i <= TOTAL; i++) {
    const { lesson, tokens } = await generateOneLesson(active, lang, topic, i, TOTAL, prevVocab, story, difficulty, jobId);
    lessons.push(lesson);
    prevVocab = prevVocab.concat(lesson.vocab);
    totalPromptTokens += tokens.promptTokens; totalCompletionTokens += tokens.completionTokens;
    lessonTokenStats.push(tokens);
  }

  const totalMs = Date.now() - genStart;
  const modelLabel = active === 'anthropic' ? CLAUDE_MODEL : OLLAMA_MODEL;
  console.log(`  Done in ${(totalMs/1000).toFixed(1)}s — ${totalPromptTokens+totalCompletionTokens} total tokens`);
  return { topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
           lang, difficulty: difficulty || 2, story, storyLang, lessons,
           generationStats: { totalMs, backend: active, model: modelLabel,
             totalPromptTokens, totalCompletionTokens, lessons: lessonTokenStats } };
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

  console.log('\n🌍  Dreizunge');
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
      return json(res, 200, { backend: active, ollamaModel: OLLAMA_MODEL,
        claudeModel: CLAUDE_MODEL, canGenerate: active !== 'none' });
    }
    if (M === 'GET' && url.pathname === '/api/lessons') {
      const list = store.lessons.map(l => ({
        topic: l.topic, topicEmoji: l.topicEmoji, lang: l.lang || 'it',
        difficulty: l.difficulty || 2,
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

    // ── Job status polling ────────────────────────────────────────────
    if (M === 'GET' && url.pathname.startsWith('/api/job/')) {
      const jobId = url.pathname.split('/')[3];
      const job = jobs.get(jobId);
      if (!job) return json(res, 404, { error: 'Job not found' });
      return json(res, 200, { status: job.status, step: job.step,
        data: job.data, error: job.error });
    }

    // ── Generate (now async — returns jobId immediately) ─────────────
    if (M === 'POST' && url.pathname === '/api/generate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const { topic, lang, difficulty, storyInTargetLang, forceRegenerate } = body;
      if (!topic || topic.trim().length < 2) return json(res, 400, { error: 'Topic too short' });
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const topicKey = topic.trim().toLowerCase();
      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached) { console.log(`  Cache hit: "${topic}"`); return json(res, 200, { cached: true, data: { ...cached, fromCache: true } }); }
      }
      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Set ANTHROPIC_API_KEY or start Ollama, then restart.' });
      if (generatingTopics.has(topicKey))
        return json(res, 429, { error: 'Already generating lessons for this topic. Please wait.' });
      const jobId = newJob();
      generatingTopics.add(topicKey);
      console.log(`  Generating [${active}]: "${topic}" (${langName(lang||'it')}) diff=${diff} job=${jobId}`);
      generate(topic.trim(), lang || 'it', active, diff, !!storyInTargetLang, jobId).then(data => {
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
