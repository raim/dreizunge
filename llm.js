#!/usr/bin/env node
'use strict';
// llm.js — backend-agnostic LLM interface for Dreizunge
//
// Exports:
//   callLLM(model, system, userMsg, maxTokens, opts) → { text, promptTokens, completionTokens }
//   ping()        → boolean  (is the backend reachable?)
//   release(model)           (free model from VRAM — no-op for non-Ollama)
//   warmup(model, log)       (load model into VRAM — no-op for non-Ollama)
//   stripRaw(raw) → string
//   extractJSON(raw) → object
//   extractArray(raw) → array
//   salvageArray(raw) → array
//
// Switching backends: set LLM_BACKEND env var. Currently supported: 'ollama' (default).
// Adding a new backend: implement _callXxx / _pingXxx / _releaseXxx / _warmupXxx and
// add a case in callLLM / ping / release / warmup below.

const http  = require('http');
const https = require('https');

const BACKEND        = (process.env.LLM_BACKEND || 'ollama').toLowerCase();
const OLLAMA_HOST    = process.env.OLLAMA_HOST    || 'http://localhost:11434';
let OLLAMA_TIMEOUT = parseInt(process.env.OLLAMA_TIMEOUT || '720000', 10);
// Runtime-adjustable request timeout (larger/slower models — e.g. big models on Swahili word_forms —
// can exceed the default). Clamped to a sane 30s–60min range. Named *Request* so it never shadows
// the global setTimeout used below.
function setRequestTimeout(ms) {
  const n = parseInt(ms, 10);
  if (!Number.isFinite(n)) return OLLAMA_TIMEOUT;
  OLLAMA_TIMEOUT = Math.max(30000, Math.min(3600000, n));
  return OLLAMA_TIMEOUT;
}
function getRequestTimeout() { return OLLAMA_TIMEOUT; }

// ── Public interface ───────────────────────────────────────────────────────────

function callLLM(model, system, userMsg, maxTokens, opts) {
  if (BACKEND === 'ollama') {
    const p = _callOllama(model, system, userMsg, maxTokens, opts);
    // Graceful degradation: if think:false was requested but THIS model rejects the parameter
    // (Ollama errors "<model> does not support thinking"), retry once without it — the caller
    // asked for less thinking, and a model that can't think satisfies that trivially.
    if (opts && opts.think === false) {
      return p.catch(e => /does not support thinking/i.test(String(e.message || e))
        ? _callOllama(model, system, userMsg, maxTokens, { ...opts, think: undefined })
        : Promise.reject(e));
    }
    return p;
  }
  return Promise.reject(new Error(`Unknown LLM_BACKEND: ${BACKEND}`));
}

function ping() {
  if (BACKEND === 'ollama') return _pingOllama();
  return Promise.resolve(false);
}

// List the models the backend has available (for a UI model picker). Returns a de-duplicated
// array of model-name strings, or [] if the backend is unreachable / unsupported (never throws).
function listModels() {
  if (BACKEND === 'ollama') return _listOllamaModels();
  return Promise.resolve([]);
}

function release(model) {
  if (BACKEND === 'ollama') return _releaseOllama(model);
  return Promise.resolve();
}

async function warmup(model, log) {
  if (BACKEND !== 'ollama') return;
  const write = log || (s => process.stdout.write(s));
  write(`  Warming up ${model}… `);
  try {
    await _callOllama(model, '', 'hi', 1);
    write('ready ✓\n');
  } catch(e) { write(`not ready (${String(e.message||e).slice(0,50)}) — continuing\n`); }
}

// ── JSON utilities (backend-agnostic) ─────────────────────────────────────────

// Remove a reasoning model's chain-of-thought so it never leaks into output (stories,
// translations, or JSON). Handles three shapes so any Ollama reasoning model is tolerated:
//   (1) well-formed <think>…</think> / <thinking>…</thinking> pairs;
//   (2) an ORPHAN CLOSE tag — some models emit the reasoning first, then only a closing
//       tag, then the answer → drop everything up to and including the last close tag;
//   (3) an ORPHAN OPEN tag — the reasoning ran past the token budget and never closed
//       → drop from the open tag to the end (the answer never arrived).
// Non-reasoning output has no tags, so this is a no-op apart from trimming (and is therefore
// safe to run on every response, including the JSON paths).
function stripThink(raw) {
  if (raw == null) return raw;
  let s = String(raw);
  s = s.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');        // (1) closed pairs
  const closes = [...s.matchAll(/<\/think(?:ing)?>/gi)];                  // (2) orphan close tag
  if (closes.length) { const last = closes[closes.length - 1]; s = s.slice(last.index + last[0].length); }
  const open = s.search(/<think(?:ing)?>/i);                             // (3) orphan open (truncated)
  if (open !== -1) s = s.slice(0, open);
  return s.trim();
}

function stripRaw(raw) {
  return stripThink(raw)
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
  s += '}'.repeat(Math.max(0, opens)) + ']'.repeat(Math.max(0, sq));
  return JSON.parse(s);
}

// ── Ollama implementation ──────────────────────────────────────────────────────

function _callOllama(model, system, userMsg, maxTokens, opts) {
  const temperature = opts?.temperature ?? 0.15;
  // Per-call timeout override (same 30s–60min clamp as setRequestTimeout). Needed because this
  // is a socket-INACTIVITY timeout on a stream:false request — the socket is silent for the
  // whole load+generation, so a known-slow call (e.g. the storyline storyboard on a 35B model
  // at ~2 tok/s) must be able to outlive the 12-min default WITHOUT mutating the global.
  const timeoutMs = (opts && Number.isFinite(Number(opts.timeoutMs)))
    ? Math.max(30000, Math.min(3600000, Number(opts.timeoutMs)))
    : OLLAMA_TIMEOUT;
  const call = new Promise((resolve, reject) => {
    const u = new URL('/api/chat', OLLAMA_HOST);
    const lib = u.protocol === 'https:' ? https : http;
    const body = JSON.stringify({
      model, stream: false, keep_alive: -1,
      // opts.think === false disables a reasoning model's thinking phase (top-level /api/chat
      // field). Only sent when explicitly requested; callLLM retries without it if the model
      // rejects the parameter (non-thinking models on some Ollama versions).
      ...(opts && opts.think === false ? { think: false } : {}),
      options: { temperature, num_predict: maxTokens || 1024 },
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
          const rawText = p.message?.content || p.response || '';
          if (!rawText) return reject(new Error('Ollama returned empty response'));
          // Strip any reasoning-model chain-of-thought here, so it can never leak into a
          // story, a translation, or a JSON payload no matter which caller invoked us.
          const text = stripThink(rawText);
          if (!text) return reject(new Error('Ollama returned only a reasoning block (no answer) — raise num_predict or disable thinking'));
          resolve({ text, promptTokens: p.prompt_eval_count || 0, completionTokens: p.eval_count || 0 });
        } catch(e) { reject(new Error('Ollama parse: ' + e.message + '\n' + d.slice(0, 200))); }
      });
    });
    req.on('error', e => reject(new Error('Ollama network: ' + e.message)));
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(body); req.end();
  });
  // Belt-and-braces guard around the socket timeout above (catches a hung parse, not just a hung
  // socket). The loser of this race MUST be cleared: an un-cleared setTimeout keeps the libuv loop
  // alive, so a CLI script (translate-ui.js, generate-lessons.js, …) would sit for the remainder of
  // OLLAMA_TIMEOUT — 12 minutes by default — after its last call resolved, looking like a hang.
  let _guardTimer;
  const guard = new Promise((_, reject) => {
    _guardTimer = setTimeout(() => reject(new Error('Ollama timeout')), timeoutMs);
    if (_guardTimer.unref) _guardTimer.unref();   // never hold the process open on its own
  });
  return Promise.race([call, guard]).finally(() => clearTimeout(_guardTimer));
}

function _listOllamaModels() {
  return new Promise(resolve => {
    try {
      const u = new URL('/api/tags', OLLAMA_HOST);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        { hostname: u.hostname, port: u.port || 11434, path: u.pathname, method: 'GET' },
        res => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => {
            try {
              const p = JSON.parse(d);
              const names = (p.models || []).map(m => m && (m.name || m.model)).filter(Boolean);
              resolve([...new Set(names)]);
            } catch(_) { resolve([]); }
          });
        }
      );
      req.setTimeout(3000, () => { req.destroy(); resolve([]); });
      req.on('error', () => resolve([]));
      req.end();
    } catch(_) { resolve([]); }
  });
}

function _pingOllama() {
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
    } catch(_) { resolve(false); }
  });
}

function _releaseOllama(model) {
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

module.exports = { callLLM, ping, listModels, release, warmup, stripThink, stripRaw, extractJSON, extractArray, salvageArray, setRequestTimeout, getRequestTimeout };
