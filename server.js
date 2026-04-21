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
const OLLAMA_HOST    = process.env.OLLAMA_HOST  || 'http://localhost:11434';
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

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

// ── Prompt ────────────────────────────────────────────────────────────
const SYS = `You are an Italian language lesson generator for a Duolingo-style app.
Return ONLY a valid JSON object — no markdown, no explanation, no extra text before or after.

Schema:
{
  "topic": "string",
  "topicEmoji": "one emoji",
  "lessons": [
    {
      "id": 1,
      "title": "lesson theme",
      "desc": "up to 8 words",
      "icon": "one emoji",
      "vocab": [
        {"it":"Italian word/phrase","en":"English meaning","pron":"phonetic for English speakers, CAPS for stress"}
      ],
      "sentences": [
        {
          "it":"Italian sentence 5-9 words",
          "en":"English translation",
          "words":["each","token","separate","punctuation","."]
        }
      ]
    }
  ]
}

Rules:
- Produce exactly 3 lessons, each with exactly 8 vocab items and exactly 5 sentences.
- words[] joined by spaces must equal the 'it' sentence exactly.
- Lesson 1=basics, Lesson 2=intermediate phrases, Lesson 3=advanced/specific.
- Later lessons may reuse earlier vocab inside sentences.
- All content must be relevant to the given topic.`;

// ── LLM backends ──────────────────────────────────────────────────────
function callAnthropic(msg) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4096, system: SYS,
      messages: [{ role: 'user', content: msg }] });
    const req = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { const p = JSON.parse(d); if (p.error) return reject(new Error('Anthropic: ' + p.error.message)); resolve(p.content[0].text); }
        catch(e) { reject(new Error('Anthropic parse: ' + e.message)); }
      });
    });
    req.on('error', e => reject(new Error('Anthropic network: ' + e.message)));
    req.write(body); req.end();
  });
}

function callOllama(msg) {
  return new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model: OLLAMA_MODEL, stream: false,
      options: { temperature: 0.2, num_predict: 4096 },
      messages: [{ role: 'system', content: SYS }, { role: 'user', content: msg }]
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
        } catch(e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0, 300))); }
      });
    });
    req.setTimeout(1200000, () => { req.destroy(); reject(new Error('Ollama timeout after 1200s')); });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message + ' — is Ollama running on ' + OLLAMA_HOST + '?')));
    req.write(body); req.end();
  });
}

function pingOllama() {
  return new Promise(resolve => {
    try {
      const u = new URL('/api/tags', OLLAMA_HOST);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        hostname: u.hostname, port: u.port || 11434, path: u.pathname, method: 'GET'
      }, res => { res.resume(); resolve(res.statusCode < 500); });
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
      req.end();
    } catch(e) { resolve(false); }
  });
}

async function generate(topic, active) {
  const msg = `Generate 3 Italian lessons for the topic: "${topic}". Return only the JSON object.`;
  let raw;
  if      (active === 'anthropic') raw = await callAnthropic(msg);
  else if (active === 'ollama')    raw = await callOllama(msg);
  else throw new Error('No LLM backend. Use a saved lesson or set ANTHROPIC_API_KEY / start Ollama.');

  let clean = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();
  const brace = clean.indexOf('{');
  if (brace > 0) clean = clean.slice(brace);
  const lastBrace = clean.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < clean.length - 1) clean = clean.slice(0, lastBrace + 1);

  let data;
  try { data = JSON.parse(clean); }
  catch(e) { throw new Error('JSON parse failed: ' + e.message + '\nOutput:\n' + clean.slice(0, 400)); }
  if (!Array.isArray(data.lessons) || data.lessons.length === 0)
    throw new Error('Model returned invalid lesson structure.');
  return data;
}

// ── HTTP helpers ──────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => { let b = ''; req.on('data', c => b += c); req.on('end', () => res(b)); req.on('error', rej); });
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ── Boot: resolve backend then start ─────────────────────────────────
async function boot() {
  let active;
  if      (BACKEND === 'anthropic') active = 'anthropic';
  else if (BACKEND === 'ollama')    active = 'ollama';
  else if (BACKEND === 'none')      active = 'none';
  else if (ANTHROPIC_KEY)           active = 'anthropic';
  else {
    process.stdout.write('  Checking Ollama… ');
    const up = await pingOllama();
    active = up ? 'ollama' : 'none';
    console.log(up ? 'reachable ✓' : 'not found — offline mode');
  }

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
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }

      const { topic, forceRegenerate } = body;
      if (!topic || topic.trim().length < 2) return json(res, 400, { error: 'Topic too short' });

      if (!forceRegenerate) {
        const cached = findSaved(topic.trim());
        if (cached) { console.log(`  Cache hit: "${topic}"`); return json(res, 200, { ...cached, fromCache: true }); }
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
        console.error('  Error:', e.message);
        return json(res, 500, { error: e.message });
      }
    }

    res.writeHead(404); res.end('Not found');
  }).listen(PORT, '127.0.0.1', () => {
    console.log(`  Open: http://localhost:${PORT}\n`);
  });
}

boot().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
