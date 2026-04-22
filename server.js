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
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
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

// ── Prompts — one lesson at a time to avoid truncation ────────────────
function sysPromptForLesson(lessonNum, totalLessons) {
  return `You are an Italian language lesson generator for a Duolingo-style app.
Return ONLY a valid, complete JSON object — no markdown fences, no explanation, nothing else.

Generate lesson ${lessonNum} of ${totalLessons}. Schema:
{
  "id": ${lessonNum},
  "title": "short lesson theme (3-5 words)",
  "desc": "up to 8 words describing this lesson",
  "icon": "one relevant emoji",
  "vocab": [
    {"it":"Italian word or short phrase","en":"English meaning","pron":"phonetic for English speakers, CAPS for stressed syllable"}
  ],
  "sentences": [
    {
      "it":"A natural Italian sentence, 5-9 words",
      "en":"English translation",
      "words":["each","word","as","separate","token","punctuation","."]
    }
  ]
}

Rules:
- vocab: exactly 8 items, topic-relevant, no duplicates
- sentences: exactly 5 items
- words[] must be the 'it' sentence split into tokens; joined by single spaces must reproduce 'it' exactly
- Lesson difficulty: ${lessonNum === 1 ? 'beginner basics' : lessonNum === 2 ? 'intermediate phrases' : 'advanced/specific vocabulary'}
- All content must relate to the topic provided`;
}

const SYS_META = `You are a lesson plan creator. Return ONLY a valid JSON object, no markdown, no explanation.
Schema: {"topic":"cleaned topic string","topicEmoji":"one emoji","lessonThemes":["theme1","theme2","theme3"]}
Rules: topic is the user's topic, normalized. Choose 3 progressive lesson themes for that topic.`;

// ── JSON extraction — robust against prose, fences, and qwen3 <think> tags ──
function extractJSON(raw) {
  // strip qwen3 thinking blocks
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // strip markdown fences
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  // find first { and last }
  const start = s.indexOf('{');
  const end   = s.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) throw new Error('No JSON object found in output');
  return JSON.parse(s.slice(start, end + 1));
}

// ── Attempt to salvage a truncated lesson by trimming arrays ───────────
function salvageLesson(raw) {
  // Try to close an unclosed JSON by trimming trailing incomplete items
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  s = s.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  const start = s.indexOf('{');
  if (start < 0) throw new Error('No JSON found');
  s = s.slice(start);

  // Try parsing as-is first
  try { return JSON.parse(s); } catch(_) {}

  // Remove trailing incomplete object/array entries and close
  // Strategy: find the last complete item in vocab and sentences arrays
  // by looking for the last '}' before any truncation
  let attempt = s;
  // Remove trailing comma and incomplete entry, then close all open brackets
  attempt = attempt.replace(/,\s*\{[^}]*$/, '');  // remove last incomplete {}
  attempt = attempt.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, ''); // remove last incomplete key:val
  attempt = attempt.replace(/,\s*$/, ''); // remove trailing comma

  // Count open brackets to close
  let opens = 0, openSquare = 0;
  for (const ch of attempt) {
    if (ch === '{') opens++;
    else if (ch === '}') opens--;
    else if (ch === '[') openSquare++;
    else if (ch === ']') openSquare--;
  }
  attempt += ']'.repeat(Math.max(0, openSquare)) + '}'.repeat(Math.max(0, opens));

  return JSON.parse(attempt);
}

// ── LLM call — shared low-level ────────────────────────────────────────
function callAnthropicRaw(system, userMsg, maxTokens) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: maxTokens || 2048,
      system,
      messages: [{ role: 'user', content: userMsg }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body)
      }
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
      options: { temperature: 0.15, num_predict: maxTokens || 2048 },
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userMsg }
      ]
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
        } catch(e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0, 200))); }
      });
    });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message)));
    req.write(body); req.end();
  });

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Ollama timeout')), OLLAMA_TIMEOUT)
  );

  return Promise.race([call, timeout]);
}

function callLLM(active, system, userMsg, maxTokens) {
  if (active === 'anthropic') return callAnthropicRaw(system, userMsg, maxTokens);
  if (active === 'ollama')    return callOllamaRaw(system, userMsg, maxTokens);
  throw new Error('No LLM backend configured.');
}

// ── Generate one lesson with retry ─────────────────────────────────────
async function generateOneLesson(active, topic, lessonNum, totalLessons, prevVocab) {
  const sys = sysPromptForLesson(lessonNum, totalLessons);
  const prevHint = prevVocab.length
    ? `\nVocab already introduced in earlier lessons (you may reuse these in sentences but must add 8 NEW vocab items):\n${prevVocab.map(v => v.it + ' = ' + v.en).join(', ')}`
    : '';
  const userMsg = `Topic: "${topic}"\nGenerate lesson ${lessonNum} now. Return only the JSON object.${prevHint}`;

  const MAX_TOKENS = 4096; // large enough for thinking models (qwen3 etc.)
  let lastErr;

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`    Lesson ${lessonNum} attempt ${attempt}…`);
    try {
      const raw = await callLLM(active, sys, userMsg, MAX_TOKENS);

      let lesson;
      try {
        lesson = extractJSON(raw);
      } catch(parseErr) {
        console.warn(`    Parse failed, trying salvage…`);
        lesson = salvageLesson(raw);
      }

      // Validate and patch
      if (!lesson.vocab || !Array.isArray(lesson.vocab)) throw new Error('Missing vocab array');
      if (!lesson.sentences || !Array.isArray(lesson.sentences)) throw new Error('Missing sentences array');

      // Trim to expected counts if model over-generated
      lesson.vocab     = lesson.vocab.slice(0, 8);
      lesson.sentences = lesson.sentences.slice(0, 5);

      // Ensure minimum counts (pad if salvage trimmed too much)
      if (lesson.vocab.length < 4)     throw new Error(`Only ${lesson.vocab.length} vocab items — too few`);
      if (lesson.sentences.length < 3) throw new Error(`Only ${lesson.sentences.length} sentences — too few`);

      // Ensure words[] is present and correct for each sentence
      lesson.sentences = lesson.sentences.map(s => {
        if (!s.words || !Array.isArray(s.words) || s.words.length === 0) {
          // Auto-split if missing
          s.words = s.it.split(' ');
        }
        return s;
      });

      lesson.id = lessonNum;
      return lesson;

    } catch(e) {
      console.warn(`    Attempt ${attempt} failed: ${e.message}`);
      lastErr = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 800));
    }
  }
  throw new Error(`Failed to generate lesson ${lessonNum} after 3 attempts: ${lastErr.message}`);
}

// ── Generate all lessons for a topic ──────────────────────────────────
async function generate(topic, active) {
  // Step 1: get meta (topic emoji + lesson themes)
  console.log(`  [1/4] Generating topic meta…`);
  let meta;
  try {
    const metaRaw = await callLLM(active, SYS_META,
      `Topic: "${topic}". Return the JSON with topicEmoji and 3 lessonThemes.`, 1024);
    meta = extractJSON(metaRaw);
  } catch(e) {
    // fallback meta
    meta = { topic, topicEmoji: '📚', lessonThemes: ['Basics', 'Phrases', 'Advanced'] };
    console.warn('  Meta generation failed, using fallback:', e.message);
  }

  const TOTAL = 3;
  const lessons = [];
  let prevVocab = [];

  for (let i = 1; i <= TOTAL; i++) {
    console.log(`  [${i + 1}/4] Generating lesson ${i}…`);
    const lesson = await generateOneLesson(active, topic, i, TOTAL, prevVocab);
    lessons.push(lesson);
    prevVocab = prevVocab.concat(lesson.vocab);
  }

  return {
    topic: meta.topic || topic,
    topicEmoji: meta.topicEmoji || '📚',
    lessons
  };
}

// ── Ollama ping ────────────────────────────────────────────────────────
function pingOllama() {
  return new Promise(resolve => {
    try {
      const u = new URL('/api/tags', OLLAMA_HOST);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        { hostname: u.hostname, port: u.port || 11434, path: u.pathname, method: 'GET' },
        res => { res.resume(); resolve(res.statusCode < 500); }
      );
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch(e) { resolve(false); }
  });
}

// ── HTTP helpers ───────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => res(b)); req.on('error', rej);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ── Boot ───────────────────────────────────────────────────────────────

// ── Warmup — load model into memory before first user request ─────────
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
    }, res => {
      res.resume();
      res.on('end', () => { console.log('ready ✓'); resolve(); });
    });
    req.setTimeout(OLLAMA_TIMEOUT, () => { req.destroy(); console.log('timed out (continuing anyway)'); resolve(); });
    req.on('error', () => { console.log('failed (continuing anyway)'); resolve(); });
    req.write(body); req.end();
  });
}

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
        topic: l.topic, topicEmoji: l.topicEmoji,
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

    if (M === 'POST' && url.pathname === '/api/generate') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }

      const { topic, forceRegenerate } = body;
      if (!topic || topic.trim().length < 2) return json(res, 400, { error: 'Topic too short' });

      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached) {
          console.log(`  Cache hit: "${topic}"`);
          return json(res, 200, { ...cached, fromCache: true });
        }
      }

      if (active === 'none')
        return json(res, 503, { error: 'No LLM backend. Set ANTHROPIC_API_KEY or start Ollama, then restart.' });

      console.log(`  Generating [${active}]: "${topic}"`);
      try {
        const data = await generate(topic.trim(), active);
        upsert(data);
        console.log(`  Saved: "${data.topic}" (${data.lessons.length} lessons)`);
        return json(res, 200, { ...data, fromCache: false });
      } catch(e) {
        console.error('  Generation error:', e.message);
        return json(res, 500, { error: e.message });
      }
    }

    res.writeHead(404); res.end('Not found');

  }).listen(PORT, '0.0.0.0', () => {
    const os = require('os'); const lanIp = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'unknown'; console.log(`  Local : http://localhost:${PORT}`); console.log(`  LAN   : http://${lanIp}:${PORT}
`);
  });
}

boot().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
