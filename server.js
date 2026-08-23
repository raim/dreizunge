#!/usr/bin/env node
'use strict';

const http  = require('http');
const { execFile } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { parseDialectGlossary, buildDialectTopic } = require('./dialect-glossary.js');
const { createSkillRegistry, resolveSkill, withRegisteredSkill, withSkillAlias, withoutSkillAlias } = require('./skill-registry.js');
const { callLLM: _rawCallLLM, callLLMStream: _rawCallLLMStream, ping: pingOllama, release: releaseOllamaModel,
        warmup: _warmupLLM, listModels: listOllamaModels, setRequestTimeout, getRequestTimeout,
        setNumThread, getNumThread, setNumCtxMax, getNumCtxMax, estimateCtxTokens,
        stripRaw, extractJSON, extractArray, salvageArray } = require('./llm');
const { AsyncLocalStorage } = require('async_hooks');
const { buildExport } = require('./export-lessons');
const LEARNERS = require('./learners');

// ── Learner sessions (v65) ───────────────────────────────────────────────────
// Cookie-based, HttpOnly so page scripts can never read the token, SameSite=Lax so it isn't sent
// on cross-site requests. `Secure` is set only when the request arrived over TLS — forcing it on
// plain-HTTP LAN use would silently break login.
const SESSION_COOKIE = 'dz_session';

// ── Transport security (v70_b) ──────────────────────────────────────────────
// The server binds 0.0.0.0, so it is reachable from the LAN the moment it starts. learners.js
// protects credentials AT REST (scrypt + salt, session tokens stored hashed) but nothing protects
// the WIRE: over plain HTTP the password crosses in the login body and the session cookie crosses
// in the header of every request thereafter — and the cookie is valid for 30 days, so it is the
// worse leak of the two. We cannot fix that here (terminating TLS is a deployment decision), so we
// warn instead: silently shipping a login form over clear-text on a school LAN is the failure mode.
//
// Loopback is exempt: that traffic never reaches a network interface.
// One definition of "is this TLS", used by both the cookie's `Secure` flag and the warning, so the
// two can never disagree about what counts as a secure request.
function isSecureRequest(req) {
  if (req && req.socket && req.socket.encrypted) return true;
  // A TLS-terminating proxy in front of us reports the original scheme here. Take the FIRST value:
  // the header is a comma-separated chain and only the client-facing hop is meaningful.
  const xfp = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return xfp === 'https';
}
// Host header → is this a loopback address? Handles `localhost`, 127.0.0.0/8, `::1` bare and
// bracketed, with or without a port.
function isLoopbackHost(host) {
  let h = String(host || '').trim().toLowerCase();
  // No Host header: we cannot PROVE the request is local, so treat it as remote. A false warning
  // costs a line of console noise; a missed one costs a password.
  if (!h) return false;
  if (h.startsWith('[')) {                     // [::1] / [::1]:3000
    const end = h.indexOf(']');
    if (end < 0) return false;
    h = h.slice(1, end);
  } else if ((h.match(/:/g) || []).length === 1) {
    // Exactly one colon means host:port. A bare IPv6 literal has several, so leave those alone.
    const c = h.lastIndexOf(':');
    if (/^\d+$/.test(h.slice(c + 1))) h = h.slice(0, c);
  }
  if (h.endsWith('.')) h = h.slice(0, -1);     // fully-qualified trailing dot
  if (h === 'localhost') return true;
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}
// The condition the banner and the console warning both key off.
function transportInsecure(req) {
  return !isSecureRequest(req) && !isLoopbackHost(req?.headers?.host);
}
// Warn once per process, at the moment accounts are actually USED — boot cannot know which host a
// client will reach us on, and a warning nobody is around to read teaches nothing.
let _tlsWarned = false;
function warnInsecureTransport(req, what) {
  if (_tlsWarned || !transportInsecure(req)) return;
  _tlsWarned = true;
  const host = String(req?.headers?.host || 'unknown host');
  console.warn(`\n⚠️  INSECURE TRANSPORT — ${what} over plain HTTP (${host}).`);
  console.warn('   Passwords and 30-day session cookies are crossing this network in the clear.');
  console.warn('   Fine on localhost; NOT fine on a shared or school network.');
  console.warn('   Fix: put a TLS-terminating proxy (Caddy, nginx, a tunnel) in front of this');
  console.warn('   server. X-Forwarded-Proto is already honoured, so the session cookie gains its');
  console.warn('   Secure flag automatically once you do — no code change needed.\n');
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers?.cookie;
  if (!raw) return out;
  for (const part of String(raw).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSessionCookie(req, res, token, maxAgeSec) {
  const secure = isSecureRequest(req);
  const bits = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax',
                `Max-Age=${maxAgeSec}`];
  if (secure) bits.push('Secure');
  res.setHeader('Set-Cookie', bits.join('; '));
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
// Resolve the logged-in learner for a request, or null.
function currentLearner(req) {
  try { return LEARNERS.resolveSession(parseCookies(req)[SESSION_COOKIE]); } catch(_) { return null; }
}

// ── Token metering (v59) ──────────────────────────────────────────────
// EVERY server-side LLM call converges on _callLLM (the four role wrappers and all direct
// call sites go through this one function), so this is THE choke point for token accounting —
// the same philosophy as upsert()'s createdBy stamp: instrument once, impossible to forget at
// a call site. AsyncLocalStorage (node builtin, zero-dep) scopes the meter per async context,
// so concurrent jobs (a background QC sweep + a foreground summary) can never cross-attribute.
// Calls outside any meterLLMTokens scope are counted nowhere here — the initial generation
// pipeline keeps its own accumulation (generationStats), and wrapping it too would double-count.
const _tokenALS = new AsyncLocalStorage();
async function _callLLM(...args) {
  const r = await _rawCallLLM(...args);
  const m = _tokenALS.getStore();
  if (m && r) { m.promptTokens += r.promptTokens | 0; m.completionTokens += r.completionTokens | 0; }
  return r;
}
// Run `fn` with a fresh meter; resolves to { result, tokens }. Tokens of a THROWING scope are
// lost to accounting (the route 500s) — accepted and documented; the per-topic QC scopes
// attribute after each topic precisely to keep that window small.
function meterLLMTokens(fn) {
  const tokens = { promptTokens: 0, completionTokens: 0 };
  return _tokenALS.run(tokens, async () => ({ result: await fn(), tokens }));
}

// ── Prompts (hot-reloaded from prompts.json) ──────────────────────────────────
let PROMPTS = {};
// Major A — optional harvested examples (from harvest-examples.js), overlaid on the curated
// examples in prompts.json. Lives next to the data, env-overridable like LESSONS_FILE.
const EXAMPLES_FILE = process.env.EXAMPLES_FILE || path.join(__dirname, 'examples.json');
function loadPrompts() {
  try {
    PROMPTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf8'));
    console.log('  Prompts loaded from prompts.json');
  } catch(e) { console.error('  Failed to load prompts.json:', e.message); }
  // Overlay harvested per-language example blocks (keys like "de__en") onto each prompt's
  // curated examples. Optional file; absence is normal and silent — the curated default
  // and seeds in prompts.json stand alone.
  try {
    const overlay = JSON.parse(fs.readFileSync(EXAMPLES_FILE, 'utf8'));
    let n = 0;
    for (const key of Object.keys(overlay)) {
      if (!PROMPTS[key] || typeof PROMPTS[key] !== 'object' || !overlay[key] || typeof overlay[key] !== 'object') continue;
      PROMPTS[key].examples = Object.assign({}, PROMPTS[key].examples, overlay[key]);
      n += Object.keys(overlay[key]).length;
    }
    if (n) console.log(`  Overlaid ${n} harvested example(s) from ${path.basename(EXAMPLES_FILE)}`);
  } catch (_) { /* no examples.json — fine */ }
}
loadPrompts();
[path.join(__dirname, 'prompts.json'), EXAMPLES_FILE].forEach(f => {
  try {
    fs.watch(f, () => { setTimeout(() => { loadPrompts(); console.log(`  ${path.basename(f)} reloaded`); }, 100); });
  } catch(_) {}
});

// Fill {placeholder} variables in a prompt template string
function fillPrompt(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '{'+k+'}'));
}
// Major A — per-target-language worked examples. A prompt may carry an `examples` map
// injected via the `{EXAMPLE}` token in its `system` string. Resolution prefers a harvested
// exact "<target>__<source>" pair (keys like "de__en"; its baked-in {S} content is correct
// for that pair), then a per-language example (curated in prompts.json, source-agnostic),
// then the default, then '' (a prompt with no examples / a target with no entry falls back
// cleanly — additive & backward-compatible). The caller fills {L}/{S} on the result.
function promptExample(P, lang, srcLang) {
  const ex = P && P.examples;
  if (!ex) return '';
  return (srcLang && ex[lang + '__' + srcLang]) || ex[lang] || ex.default || '';
}
const crypto = require('crypto');

const PORT         = parseInt(process.env.PORT || '3000', 10);
const APP_VERSION  = 'v83_f';
// v58 provenance: schema 30 = 29 + OPTIONAL topic.source {author,licence,url,note} and
// topic.createdBy. Readers keep accepting >= 29 (both fields optional); only the WRITE stamp
// moves, so a v29 file loads untouched and is re-tagged 30 on its next save.
const SCHEMA_VERSION = 30;
// The generating user. Login is coming (roadmap); until then every write is 'admin', and the
// backfill script (backfill-createdby.js) stamps the same onto the existing corpus so the data
// is EXPLICIT rather than a read-time default.
const DEFAULT_USER = 'admin';
const STORAGE_FILE = process.env.LESSONS_FILE || path.join(__dirname, 'lessons.json');
// PLAN §8/B2: deliberately separate from lessons.json, which is a public static-build input.
// Skills are pedagogy metadata, not generated lesson content, and remain server-side until B3
// explicitly starts attaching resolved IDs to new lessons.
const SKILLS_FILE = process.env.SKILLS_FILE || path.join(__dirname, 'skills.json');
const UI_FILE     = process.env.UI_FILE || path.join(__dirname, 'ui.json');
const BACKEND      = (process.env.LLM_BACKEND || 'auto').toLowerCase();
const OLLAMA_HOST    = process.env.OLLAMA_HOST    || 'http://localhost:11434';
// Model roles are runtime-mutable (see setRuntimeModels / GET+POST /api/models) so a user can
// switch models from the UI without restarting the server. They default from env at startup and
// are read LIVE at every call site (all ~60 reads), so an override takes effect on the next
// generation. Declared `let`, not `const`, for exactly that reason.
let OLLAMA_MODEL             = process.env.OLLAMA_MODEL             || 'qwen3.6:35b-a3b';   // v67.1 default
let OLLAMA_TRANSLATION_MODEL = process.env.OLLAMA_TRANSLATION_MODEL || OLLAMA_MODEL;
let OLLAMA_LESSON_MODEL      = process.env.OLLAMA_LESSON_MODEL      || OLLAMA_MODEL;
// QC (source/target verification) is its own role. It defaults to the translation model (QC is a
// translation-faithfulness check), but is independently settable so you can, e.g., run the story
// translation on qwen while QC-checking Lëtzebuergesch pairs on translategemma.
// v67.1: QC defaults to a dedicated translation-checking model rather than inheriting the story
// model — QC is a translation-faithfulness check, and a large reasoning model is both slower and
// (with thinking off, as QC requires) no better at it.
// If OLLAMA_MODEL is set explicitly, honour the long-standing "one model for everything" override
// and let QC follow it; otherwise use the dedicated checker as the out-of-the-box default.
let OLLAMA_QC_MODEL          = process.env.OLLAMA_QC_MODEL
                               || (process.env.OLLAMA_MODEL ? OLLAMA_TRANSLATION_MODEL : 'translategemma:12b');
// Tutor (v61): the conversational end-of-chapter comprehension tutor. Its own role — a chat model
// is a different job from lesson JSON generation — defaulting to the story model (both produce
// natural-language prose). Independently settable in the model menu.
let OLLAMA_TUTOR_MODEL       = process.env.OLLAMA_TUTOR_MODEL       || OLLAMA_MODEL;
// (The request timeout lives in llm.js — runtime-adjustable via setRequestTimeout/getRequestTimeout;
//  there is no separate server-side copy.)
// Lesson output format: 'json' (default) or 'table' (markdown table, better for
// translation-focused models that struggle with strict JSON schemas).
// Auto-derived from the ACTIVE lesson model (name contains 'translategemma' → table). An explicit
// env OLLAMA_LESSON_FORMAT pins it and always wins, even across runtime model switches.
const OLLAMA_LESSON_FORMAT_ENV = process.env.OLLAMA_LESSON_FORMAT || null;
const _deriveLessonFormat = m => OLLAMA_LESSON_FORMAT_ENV ||
  (String(m || '').toLowerCase().includes('translategemma') ? 'table' : 'json');
let OLLAMA_LESSON_FORMAT = _deriveLessonFormat(OLLAMA_LESSON_MODEL);

// Per-role reasoning (v60.7). Reasoning ("thinking") models emit a <think> block before the
// answer; for plain prose/JSON that both wastes budget and — with a small num_predict — leaves
// nothing after the reasoning block is stripped (empty response) or times out. So thinking is OFF
// opt-in per role. Only the two roles that produce substantial content can benefit: STORY
// (narrative coherence) and LESSONS (vocabulary/exercise quality). QC and translation are
// mechanical and stay non-thinking always. When a role's reasoning is ON, its calls (a) pass
// think:true and (b) get a bumped token budget + timeout so the answer survives the think block.
// v71_q: the TUTOR reasons by default. It is the one role that answers open questions about a
// learner's own sentence rather than filling a template, and reasoning visibly improves what it
// asks back — with it on, the tutor produced the kind of understanding questions the comprehension
// lessons aim at. Story and lesson generation stay off: they emit structured JSON on a budget,
// where reasoning starves the answer (the v60.5 finding, and the v71_o empty-response bug).
const OLLAMA_THINK = { story: false, lessons: false, tutor: true };
// Multipliers applied to a call's token budget and timeout when that role is thinking. A think
// block on a 35B-a3b model routinely runs longer than the answer, so both need real headroom.
const THINK_TOKEN_MULT = 2.5, THINK_TIMEOUT_MULT = 3;
// …and an absolute FLOOR. A multiplier alone is not enough: a 50-word story has a base budget of
// ~475 tokens, so ×2.5 is ~1187 — less than a 35B reasoning model routinely spends inside <think>
// before writing a word. The answer is then truncated away and the call fails "empty". Reasoning
// has a fixed cost that does NOT shrink with the requested output length. (v65.1)
const THINK_MIN_TOKENS = 3000;
// Resolve the { think, tokens, timeoutMs } for a role given its base token budget. Non-thinking
// roles get think:false (which also triggers llm.js's reject-retry for non-reasoning models);
// thinking roles get think:true + bumped budgets. timeoutMs omitted → the call uses the global.
function thinkOpts(role, baseTokens) {
  const on = !!OLLAMA_THINK[role];
  if (!on) return { think: false, tokens: baseTokens };
  return {
    think: true,
    tokens: Math.max(THINK_MIN_TOKENS, Math.ceil((baseTokens || 1024) * THINK_TOKEN_MULT)),
    timeoutMs: Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT),
  };
}

// The active model set, and a runtime updater. `setRuntimeModels` accepts any subset of
// {story, translation, lessons} (plus a convenience `model` that sets all three), recomputes the
// lesson format from the new lesson model (unless env-pinned), and returns the resulting set.
function currentModels() {
  return { story: OLLAMA_MODEL, translation: OLLAMA_TRANSLATION_MODEL,
           lessons: OLLAMA_LESSON_MODEL, qc: OLLAMA_QC_MODEL, tutor: OLLAMA_TUTOR_MODEL,
           lessonFormat: OLLAMA_LESSON_FORMAT, numThread: getNumThread(),
           think: { story: OLLAMA_THINK.story, lessons: OLLAMA_THINK.lessons, tutor: OLLAMA_THINK.tutor },
           timeoutMs: getRequestTimeout() };
}
function setRuntimeModels(next) {
  next = next || {};
  const pick = v => (typeof v === 'string' && v.trim()) ? v.trim() : null;
  const all = pick(next.model);
  const story = pick(next.story) || all, transl = pick(next.translation) || all,
        lessons = pick(next.lessons) || all, qc = pick(next.qc) || all, tutor = pick(next.tutor) || all;
  if (story)   OLLAMA_MODEL             = story;
  if (transl)  OLLAMA_TRANSLATION_MODEL = transl;
  if (lessons) OLLAMA_LESSON_MODEL      = lessons;
  if (qc)      OLLAMA_QC_MODEL          = qc;
  if (tutor)   OLLAMA_TUTOR_MODEL       = tutor;
  // Per-role reasoning toggles: story, lessons, tutor.
  if (next.think && typeof next.think === 'object') {
    if (typeof next.think.story === 'boolean')   OLLAMA_THINK.story   = next.think.story;
    if (typeof next.think.lessons === 'boolean') OLLAMA_THINK.lessons = next.think.lessons;
    if (typeof next.think.tutor === 'boolean')   OLLAMA_THINK.tutor   = next.think.tutor;
  }
  OLLAMA_LESSON_FORMAT = _deriveLessonFormat(OLLAMA_LESSON_MODEL);
  return currentModels();
}
const OLLAMA_MAX_PREV_STORY = parseInt(process.env.OLLAMA_MAX_PREV_STORY || '800', 10);

// ── Storage ───────────────────────────────────────────────────────────
function loadStore() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
      // v29 schema: { schemaVersion:29, storylines:[], topics:[], flags:{} }
      if (data && data.schemaVersion >= 29 && Array.isArray(data.topics)) {
        return { schemaVersion: SCHEMA_VERSION, topics: data.topics, storylines: data.storylines || [], flags: data.flags || {},
                 settings: data.settings || {} };
      }
      // Legacy: { lessons:[] } or bare array
      if (Array.isArray(data)) return { schemaVersion: 0, topics: data, storylines: [], flags: {} };
      if (data && Array.isArray(data.lessons)) return { schemaVersion: 0, topics: data.lessons, storylines: data.storylines || [], flags: data.flags || {} };
      console.warn('lessons.json has unexpected shape — starting empty');
    }
  } catch(e) { console.warn('Could not read lessons.json:', e.message); }
  return { schemaVersion: SCHEMA_VERSION, topics: [], storylines: [], flags: {} };
}
// ── v80_i: lesson ids must be UNIQUE WITHIN A TOPIC ──────────────────────────
// Progress is keyed by lesson id — `APP.progress.completed[topic][L.id]` in the client, and item
// keys are `${lessonId}:i:${hash}` — so two lessons in one chapter sharing an id share ONE
// done-flag. Demonstrated on the corpus as it stood before this cut: marking only the word_forms
// lesson done made the synonyms AND conjugation lessons read as done too. A learner finishes one
// of three lessons and the chapter believes all three are finished.
//
// The cause is in this file: `word_forms` (id 6), `synonyms` (id 6) and `conjugation` (id 6) are
// all hardcoded to the same legacy id, so ANY chapter generated with two of those three collides.
// It is not historical — the two affected chapters in the corpus were cleaned by a user
// regeneration that happened to assign fresh ids, and the generators still emit 6 today.
//
// Fixed HERE rather than at the six push sites, because this is the one choke point every write
// funnels through (23 call sites) and a seventh insertion path would otherwise reintroduce it.
// Only DUPLICATES are renamed, and the FIRST holder keeps the id, so existing learner progress
// keyed on it is untouched; the later lesson gets a fresh id and starts unsolved, which is honest —
// it was never separately answerable before.
function _dedupeLessonIds(topics) {
  let renamed = 0;
  for (const t of (topics || [])) {
    const seen = new Set();
    for (const L of (t.lessons || [])) {
      if (!L || L.id == null) continue;
      const id = String(L.id);
      if (!seen.has(id)) { seen.add(id); continue; }
      let fresh;
      do { fresh = 'ls_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }
      while (seen.has(fresh));
      console.warn(`  lesson id collision in "${t.topic}": ${L.type || 'standard'} had id ${id} -> ${fresh}`);
      L.id = fresh; seen.add(fresh); renamed++;
    }
  }
  return renamed;
}

// Stamp `saved.updatedAt`, guaranteeing it strictly ADVANCES on every call — even when two saves
// for the same record land within the same wall-clock millisecond, which `new Date().toISOString()`
// alone cannot tell apart. That is not a rare corner case: under load, Node's event loop can fall
// behind and then process a backlog of already-arrived requests in one tight synchronous burst, so
// several saves genuinely can share a millisecond. Without this, "did this record change" (a save,
// future sync/diff logic, a test asserting a write happened) can observe the SAME updatedAt across
// two real, distinct saves. Root cause of a flake `e2e-lesson-edit-roundtrip` reconfirmed as
// "pre-existing, load-shaped" three times over (v82_c, v82_e, v82_g) without being diagnosed — the
// test's own repeated re-confirmation is exactly what this fixes, not a coincidence it stopped at.
function stampUpdated(saved) {
  if (!saved) return null;
  const prevMs = saved.updatedAt ? Date.parse(saved.updatedAt) : NaN;
  const nowMs = Date.now();
  const t = Number.isFinite(prevMs) && nowMs <= prevMs ? prevMs + 1 : nowMs;
  saved.updatedAt = new Date(t).toISOString();
  return saved.updatedAt;
}

function saveStore(s) {
  try {
    _dedupeLessonIds(s && s.topics);
    const out = s.schemaVersion >= 29
      ? { schemaVersion: SCHEMA_VERSION, storylines: s.storylines || [], topics: s.topics || [], flags: s.flags || {},
          ...(s.settings ? { settings: s.settings } : {}) }
      : s; // legacy passthrough (shouldn't happen after migration)
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(out, null, 2), 'utf8');
  } catch(e) {
    const hint = e.code === 'EACCES' ? ' — fix with: chmod u+w ' + STORAGE_FILE : '';
    console.error('Could not write lessons.json:', e.message + hint);
  }
}

function loadSkillRegistry() {
  try {
    if (!fs.existsSync(SKILLS_FILE)) return createSkillRegistry();
    const data = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8'));
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.skills))
      throw new Error('expected { schemaVersion: 1, skills: [] }');
    return createSkillRegistry(data.skills);
  } catch (e) {
    // A corrupt registry must not be silently replaced with an empty one: that would turn a
    // restart into lost canonicalisation. Keep the process up, but make review writes fail closed.
    console.error('Could not load skills registry:', e.message);
    return null;
  }
}

function saveSkillRegistry(registry) {
  if (!registry) throw new Error('skills registry is unavailable');
  const out = { schemaVersion: 1, skills: registry.entries };
  fs.writeFileSync(SKILLS_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

function skillResolutionJson(resolution) {
  return { proposedId: resolution.proposedId, canonicalId: resolution.canonicalId,
    skillId: resolution.skillId, status: resolution.status, targetLang: resolution.targetLang,
    sourceLang: resolution.sourceLang, entry: resolution.entry || null };
}

// PLAN §8/B3 — a vocabulary generator proposes one primary vocabulary skill per returned word.
// Registration is intentionally NOT automatic: an unregistered proposal is durable review input,
// not a reason for a generator to mint its own canonical dialect. Once a reviewer registers or
// aliases it through B2, later generated rows receive the canonical `skillId` automatically.
function resolveVocabularySkillTags(vocab, lang, srcLang) {
  if (!skillRegistry) throw new Error('skills registry is unavailable; refusing to write unreviewable skill tags');
  const skillIds = new Set();
  let pending = 0;
  const tagged = (vocab || []).map((item, index) => {
    const proposedId = item && typeof item.skillId === 'string' ? item.skillId.trim() : '';
    if (!proposedId) throw new Error(`Vocabulary item ${index + 1} has no model-proposed skillId`);
    const resolution = resolveSkill(skillRegistry, proposedId, { targetLang: lang, sourceLang: srcLang });
    if (resolution.skillId) skillIds.add(resolution.skillId); else pending++;
    // Never retain the model's unvalidated ID in `skillId`: that field is reserved for a resolved,
    // canonical skill the player can use in a later B3 follow-up. The proposal/resolution remains
    // alongside the vocab evidence so a reviewer can decide without re-generating the lesson.
    return { ...item, skillId: resolution.skillId,
      skillProposal: skillResolutionJson(resolution) };
  });
  return { vocab: tagged, skillIds: Array.from(skillIds), pending };
}
// ── UI strings (localisation) ─────────────────────────────────────
function loadUI() {
  try {
    if (fs.existsSync(UI_FILE)) return JSON.parse(fs.readFileSync(UI_FILE, 'utf8'));
  } catch(e) { console.warn('Could not read ui.json:', e.message); }
  return { en: {} };
}
let _uiWriteAt = 0;   // timestamp of our own ui.json write, so the watcher ignores it
function saveUI(ui) {
  _uiWriteAt = Date.now();   // mark our own write so the watcher doesn't reload it
  try { fs.writeFileSync(UI_FILE, JSON.stringify(ui, null, 2), 'utf8'); }
  catch(e) { console.warn('Could not write ui.json:', e.message); }
}
let uiStrings = loadUI();
// Hot-reload ui.json on external edits (mirrors the prompts.json watcher). The
// reload is non-destructive: a parse error (e.g. mid-write) is skipped rather than
// blanking the strings, and writes we made ourselves (saveUI) are ignored.
function reloadUI() {
  if (Date.now() - _uiWriteAt < 1000) return;   // our own saveUI; nothing external changed
  try {
    const next = JSON.parse(fs.readFileSync(UI_FILE, 'utf8'));
    if (next && typeof next === 'object' && next.en) { uiStrings = next; console.log('  ui.json reloaded'); }
  } catch(e) { console.warn('  ui.json reload skipped (parse error):', e.message); }
}
try {
  fs.watch(UI_FILE, () => { setTimeout(reloadUI, 100); });
} catch(_) {}

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
let skillRegistry = loadSkillRegistry();

// v69_q: id minting lives at MODULE scope. It was previously nested inside boot() (which encloses
// most of the file and is invoked once at startup), so it was visible only to other boot()-nested
// functions. generate() is defined at module scope — OUTSIDE boot() — so its new call to
// _newTopicId (the same-title book-collision fix) threw "not defined". Every prior caller happened
// to be boot()-nested, which is why this never surfaced before. Moving the minter out fixes the
// call from generate() and removes the latent scope hazard for any future module-scope caller.
let _idCounter = 0;
function _newTopicId() {
  // Numeric id (preserves the client's /^tp_\d+$/ detection). Existing ids are never recomputed;
  // a name-hash was deliberately dropped so reusing a renamed topic's old name cannot collide.
  const existing = new Set((store.topics || []).map(t => t.id).filter(Boolean));
  let id;
  do {
    id = 'tp_' + Date.now().toString()
       + String(_idCounter++ % 100000).padStart(5, '0')
       + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  } while (existing.has(id));
  return id;
}

// Assign IDs to any lessons missing them, AND de-duplicate IDs within a topic.
//
// v67.1 — this was a real, widespread corruption: learner progress is keyed by lesson id
// (`progress.completed[topic][lesson.id]`), so two lessons sharing an id inside one topic means
// finishing one marks the other done. The reported symptom was exactly that — "clicking Next just
// opens result cards of lessons I haven't solved", and a chapter that could never be completed
// properly. 90 of 278 topics in a real library were affected.
//
// Two causes, both fixed here:
//   1. the old backfill only filled MISSING ids and never checked for collisions;
//   2. its hash was derived from topic+type+'auto', so two lessons of the SAME type in one topic
//      were guaranteed to collide.
// The replacement is index- and content-aware and verifies uniqueness before assigning.
//
// Renaming a duplicate orphans any progress recorded against the collided id. That is the right
// trade: the collided state was already wrong (it credited lessons the learner never played), so
// a small, honest reset beats silently keeping bogus completions.
(function fixLessonIds() {
  const arr = store.schemaVersion >= 29 ? (store.topics||[]) : (store.lessons||[]);
  let assigned = 0, deduped = 0;
  arr.forEach(topic => {
    const seen = new Set();
    (topic.lessons||[]).forEach((ls, i) => {
      const mkId = (n) => 'ls_' + Math.abs(
        (topic.topic + '|' + (ls.type||'vocab') + '|' + i + '|' + n)
          .split('').reduce((h,c)=>(h*31+c.charCodeAt(0))|0, 0));
      if (!ls.id) { ls.id = mkId(0); assigned++; }
      else if (seen.has(String(ls.id))) {
        let n = 1, cand = mkId(n);
        while (seen.has(cand)) cand = mkId(++n);      // vanishingly unlikely, but bounded
        ls.id = cand; deduped++;
      }
      seen.add(String(ls.id));
    });
  });
  if (assigned || deduped) {
    saveStore(store);
    if (assigned) console.log(`  Assigned IDs to ${assigned} lesson(s) missing them`);
    if (deduped)  console.log(`  ⚠ Repaired ${deduped} DUPLICATE lesson id(s) — progress for those lessons resets (it was colliding)`);
  }
})();

// Heal provenance stamps written live before v68.1: the live server stamped model/origin/tokens on
// storyMeta/translationMeta but never `source`, so the "every stamp records where its value came
// from" invariant (unit-story-stamp §7, unit-translation-stamp §4) only held for the one-time
// backfilled corpus — the first live generation broke the suite. Backfill-provenance.js ALWAYS sets
// `source`, so a missing `source` provably means "written by the live server at generation time",
// and 'recorded at generation' is the accurate label for such rows. Idempotent; runs on every boot
// so a library that skipped this release still heals.
(function fixMetaSource() {
  if (store.schemaVersion < 29) return;
  let healed = 0, refined = 0;
  // v68.1b — the pre-v68.1 live stamp also wrote origin 'user-provided', which is not in the corpus
  // origin vocabulary (['generated','dialect-rewrite','file-upload','user-pasted','unknown']); only
  // upload post-passes refined it away, so a persisted PASTED story kept it. Classify exactly the
  // way backfill-provenance.js did: chapter of a sourceFile storyline → 'file-upload' (+sourceFile),
  // otherwise → 'user-pasted'. Guarded on the '(user-provided)' model sentinel so an (unreachable)
  // model-authored row is never relabelled as an upload.
  const slByTopic = {};
  (store.storylines || []).forEach(sl => (sl.chapters || []).forEach(id => { slByTopic[id] = sl; }));
  (store.topics || []).forEach(t => {
    const sm = t.storyMeta;
    if (sm && sm.origin === 'user-provided' && sm.model === '(user-provided)') {
      const sl = slByTopic[t.id];
      if (sl && sl.sourceFile) {
        sm.origin = 'file-upload';
        if (!sm.sourceFile) sm.sourceFile = String(sl.sourceFile).slice(0, 200);
      } else {
        sm.origin = 'user-pasted';
      }
      refined++;
    }
    for (const k of ['storyMeta', 'translationMeta']) {
      if (t[k] && !t[k].source) { t[k].source = 'recorded at generation'; healed++; }
    }
  });
  if (healed || refined) {
    saveStore(store);
    if (healed)  console.log(`  Healed ${healed} provenance stamp(s) missing \`source\` (pre-v68.1 live writes)`);
    if (refined) console.log(`  Refined ${refined} legacy 'user-provided' story origin(s) → upload/pasted (pre-v68.1 live writes)`);
  }
})();

// Stamp pre-v68.1 flags/stars with the mode that produced them (v68.1). Student-mode flagging
// ships in v68.1; every flag/rating recorded before it could only have come from a teacher (the
// play UI was _canEdit-gated and the editor is a teacher surface), so a missing `mode` provably
// means 'teacher'. New writes always stamp mode ('teacher'|'student') client-side; this heal makes
// the field universal so consumers never need a fallback. Covers item-level userFlag/userRating,
// lesson _miscFlags, and story-flag entries in the flags store. Idempotent; runs on every boot.
(function fixFlagModes() {
  if (store.schemaVersion < 29) return;
  let stamped = 0;
  const ITEM_ARRAYS = ['vocab', 'sentences', 'items', 'words', 'letters', 'grammar', 'conjugations'];
  (store.topics || []).forEach(t => (t.lessons || []).forEach(ls => {
    for (const k of ITEM_ARRAYS) (ls[k] || []).forEach(it => {
      if (it && it.userFlag && !it.userFlag.mode)     { it.userFlag.mode = 'teacher';   stamped++; }
      if (it && it.userRating && !it.userRating.mode) { it.userRating.mode = 'teacher'; stamped++; }
    });
    (ls._miscFlags || []).forEach(f => { if (f && !f.mode) { f.mode = 'teacher'; stamped++; } });
  }));
  Object.values(store.flags || {}).forEach(f => {
    if (f && typeof f === 'object' && !f.mode) { f.mode = 'teacher'; stamped++; }
  });
  if (stamped) {
    saveStore(store);
    console.log(`  Stamped ${stamped} pre-v68.1 flag(s)/star(s) with mode 'teacher'`);
  }
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
// v71_o: the story so far — every EARLIER chapter's text, oldest first, then the current one.
// Comprehension questions are about understanding a narrative, and a chapter read in isolation
// loses exactly what such questions are best at asking: why a character acts, what a callback
// refers to, what changed since the last chapter. Walks the same `continuedFromId` chain as
// collectChainVocab (with the same name fallback for un-migrated entries).
//
// Bounded, and bounded from the RIGHT end: when the chain exceeds the budget the OLDEST chapters
// are dropped, never the current one — questions are set on the chapter the learner just read, so
// that text must survive in full. Returns { text, chapters } so callers can log what was used.
//
// v71_t: the budget was 6,000 chars, and it was the wrong instrument (v71_o added it to fix
// `Ollama returned empty response`, whose real cause was the token budget — fixed separately by
// raising the base 2,200 → 3,200). Measured on the corpus, 6,000 chars cut **75 of 294 chains**:
// the worst, a 14-chapter storyline at 46,758 chars, kept barely three chapters. That discards
// precisely what comprehension questions are best at — callbacks, character motive, what changed
// since chapter two.
//
// The new default is CHAR_BUDGET_DEFAULT, sized against the context window rather than invented:
// callers pass the whole chain and size num_ctx to match (see generateComprehension). A budget
// still exists because a truly unbounded prompt would silently overflow whatever ceiling is set,
// and a deliberate trim that keeps the current chapter whole beats a blind one.
const CHAIN_STORY_CHARS = 40000;
function collectChainStory(saved, maxChars) {
  const budget = maxChars || CHAIN_STORY_CHARS;
  const out = [];
  const visited = new Set();
  let t = saved;
  // Walk backwards collecting stories, newest first.
  while (t && !visited.has(t.id)) {
    visited.add(t.id);
    const story = String(t.story || '').trim();
    if (story) out.push({ title: t.topic || '', story });
    const pid = t.continuedFromId || (t.continuedFrom ? (findSaved(t.continuedFrom)?.id || null) : null);
    t = pid ? findSavedById(pid) : null;
  }
  out.reverse();                                   // oldest first, so the narrative reads forwards
  if (!out.length) return { text: '', chapters: 0 };
  // Always keep the current chapter whole; spend what is left on predecessors, newest first.
  const current = out[out.length - 1];
  const currentText = current.story.length > budget
    ? current.story.slice(0, budget).replace(/\s+\S*$/, '') + '…'
    : current.story;
  let left = budget - currentText.length;
  const kept = [];
  for (let i = out.length - 2; i >= 0; i--) {
    const block = (out[i].title ? `## ${out[i].title}\n` : '') + out[i].story;
    if (block.length + 2 > left) break;
    kept.unshift(block);
    left -= block.length + 2;
  }
  const head = (current.title ? `## ${current.title}\n` : '') + currentText;
  return { text: [...kept, head].join('\n\n'), chapters: kept.length + 1 };
}
function collectChainVocab(startRef) {
  if (!startRef) return { words: [], nouns: [], verbs: [], sentences: [] };
  const words = [], nouns = [], verbs = [], sentences = [];
  const seen = new Set();
  const seenSent = new Set();
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
      for (const s of (ls.sentences || [])) {
        const tgt = (s && s.target || '').trim();
        if (tgt && !seenSent.has(tgt.toLowerCase())) { seenSent.add(tgt.toLowerCase()); sentences.push(tgt); }
      }
    }
    // Step to parent by stored id (fall back to resolving a name for
    // un-migrated/imported entries that lack continuedFromId).
    const pid = t.continuedFromId || (t.continuedFrom ? (findSaved(t.continuedFrom)?.id || null) : null);
    t = pid ? findSavedById(pid) : null;
  }
  return { words, nouns, verbs, sentences };
}
// Merge ONLY the flaggable signals (userFlag / userRating / _miscFlags) from an imported
// topic onto an existing one, matching items by identity (target/sentence/base) rather than
// by index. Drift-safe: keeps the maintainer's content, brings in the community's flags/stars.
// Used by /api/lessons/import in merge mode. Returns the number of signals applied.
function mergeFlagsIntoTopic(existing, incoming) {
  const FA = [['vocab', 'target'], ['sentences', 'target'], ['items', 'sentence'], ['words', 'base']];
  let applied = 0;
  (incoming.lessons || []).forEach((inL, idx) => {
    let exL = inL.id ? (existing.lessons || []).find(L => L.id === inL.id) : null;
    if (!exL) exL = (existing.lessons || [])[idx];
    if (!exL) return;
    FA.forEach(([kind, idField]) => {
      (inL[kind] || []).forEach((inIt, inIdx) => {
        if (!inIt || !(inIt.userFlag || inIt.userRating || inIt.userDelete || inIt.editedAt)) return;
        const key = String(inIt[idField] == null ? '' : inIt[idField]);
        let exIt = (exL[kind] || []).find(x => String(x[idField] == null ? '' : x[idField]) === key);
        // An edited item may have changed its identity field (target/base); fall back to position.
        if (!exIt && inIt.editedAt) exIt = (exL[kind] || [])[inIdx];
        if (!exIt) return;
        if (inIt.userFlag)   { exIt.userFlag   = inIt.userFlag;   applied++; }
        if (inIt.userRating) { exIt.userRating = inIt.userRating; applied++; }
        if (inIt.userDelete) { exIt.userDelete = inIt.userDelete; applied++; }
        // editedAt is carried as a REVIEW MARKER only — the proposed content is NOT applied
        // (that needs the side-by-side review UI). The maintainer sees the ✎ edited badge and
        // can pull the new text from the submitted file or use full-replace.
        if (inIt.editedAt)   { exIt.editedAt   = inIt.editedAt;   applied++; }
      });
    });
    if (Array.isArray(inL._miscFlags) && inL._miscFlags.length) {
      const seen = new Set();
      exL._miscFlags = (exL._miscFlags || []).concat(inL._miscFlags)
        .filter(f => { const k = JSON.stringify(f); if (seen.has(k)) return false; seen.add(k); return true; });
      applied += inL._miscFlags.length;
    }
  });
  // Topic-level story edit: carry the marker only (the proposed story text is NOT applied —
  // that needs full-replace or the review UI). Lets the maintainer see the story was edited.
  if (incoming.storyEditedAt) { existing.storyEditedAt = incoming.storyEditedAt; applied++; }
  return applied;
}
// Provenance (v58): sanitize a user-edited source block into the structured, optional
// `topic.source = { author, licence, url, note }`. Structured on purpose — the roadmap
// rejected a free-text description convention because it can't be validated, exported,
// filtered, and would be mangled by retitle/summary passes. Rules: strings only, trimmed,
// hard length caps, control characters stripped; `url` additionally must parse as http(s)
// OR read as a DOI (`10.x/...` or `doi:...`) — anything else is dropped (fail closed, the
// field is a link target in the UI). Empty fields are OMITTED; all-empty → null (meaning:
// delete the topic's source). Pure function, no store access — unit-tested directly.
function sanitizeTopicSource(input) {
  if (!input || typeof input !== 'object') return null;
  const clean = (v, cap) => {
    if (typeof v !== 'string' && typeof v !== 'number') return '';
    return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, cap).trim();
  };
  const out = {};
  const author  = clean(input.author, 120);
  const licence = clean(input.licence, 80);
  const note    = clean(input.note, 500);
  let url = clean(input.url, 300);
  if (url) {
    const isDoi = /^(doi:)?10\.\d{4,9}\/\S+$/i.test(url);
    let isHttp = false;
    try { const u = new URL(url); isHttp = u.protocol === 'http:' || u.protocol === 'https:'; } catch (_) {}
    if (!isHttp && !isDoi) url = '';
  }
  if (author)  out.author  = author;
  if (licence) out.licence = licence;
  if (url)     out.url     = url;
  if (note)    out.note    = note;
  return Object.keys(out).length ? out : null;
}

// Cumulative token accounting (v59): fold a metered scope's tokens into the owning artefact.
// TOPICS accumulate into generationStats.totalPromptTokens/totalCompletionTokens — the SAME
// fields the initial generation writes, so "total" finally means total (re-titling, QC runs,
// added lessons etc. ADD to the chapter's numbers instead of being invisible). STORYLINES get
// their own `tokenUsage` block for storyline-level artefacts (summary, storyboard, retitle,
// summary-QC) — the roadmap asked for an explicit decision here: NOT chapter 1, NOT spread
// across chapters, because that work belongs to the storyline, and the storyline screen shows
// it as its own line. Both carry a compact per-type tally (tokensByType) for the breakdown.
function addTokenUsage(target, tokens, type) {
  if (!target || !tokens) return;
  const pt = tokens.promptTokens | 0, ct = tokens.completionTokens | 0;
  if (pt + ct <= 0) return;
  const isStoryline = Array.isArray(target.chapters);
  const gs = isStoryline
    ? (target.tokenUsage = target.tokenUsage || { totalPromptTokens: 0, totalCompletionTokens: 0 })
    // A topic normally has generationStats from its generation; a defensive shell covers
    // imported/legacy topics so post-gen work is never dropped on the floor.
    : (target.generationStats = target.generationStats || { model: '(post-gen)', totalMs: 0, totalPromptTokens: 0, totalCompletionTokens: 0 });
  gs.totalPromptTokens = (gs.totalPromptTokens || 0) + pt;
  gs.totalCompletionTokens = (gs.totalCompletionTokens || 0) + ct;
  const by = gs.tokensByType = gs.tokensByType || {};
  by[type] = (by[type] || 0) + pt + ct;
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
  // Provenance (v58): every topic carries its generating user. An update preserves the original
  // creator; a fresh topic is stamped with the current user (constant 'admin' until login ships).
  // This is THE choke point — all creation routes (generate, book, dialect, save-story, import)
  // land here, so no per-route stamping to forget.
  if (!entry.createdBy) entry.createdBy = existing?.createdBy || DEFAULT_USER;
  // Keep the topic's stable id across an update even if the new data omits it.
  if (existing && existing.id && !entry.id) entry.id = existing.id;
  if (i >= 0) arr[i] = entry; else arr.unshift(entry);
  saveStore(store);
}

// ── Flag storage ──────────────────────────────────────────────────────
function getFlags()  { return store.flags || {}; }
function setFlags(f) { store.flags = f; saveStore(store); }

// ── Global settings (v60.8) ───────────────────────────────────────────
// Teacher-set app settings that aren't model choices, persisted alongside the corpus in
// store.settings. First member: coverageThreshold — the global %-solved a student must reach for a
// chapter to count complete (a fraction 0–1; default 1 = must solve everything, the historical
// behavior — teachers opt into a lower pass mark). It becomes the DEFAULT coverage target for
// every chapter (a topic's own coverageTarget still overrides). Below it, the chapter stays
// incomplete and the completion card gates on the drill (see the client).
function getSettings() {
  const s = store.settings || {};
  return { coverageThreshold: (typeof s.coverageThreshold === 'number') ? s.coverageThreshold : 0.8 };   // v69_i: default 80%
}
function setCoverageThreshold(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return getSettings();
  store.settings = { ...(store.settings || {}), coverageThreshold: Math.max(0, Math.min(1, n)) };
  saveStore(store);
  return getSettings();
}
function getStorylines() {
  const sl = store.storylines || [];
  return Array.isArray(sl) ? sl : Object.entries(sl).map(([k,v]) => ({ id: k, ...v, chapters: [] }));
}
function setStorylines(arr) { store.storylines = arr; saveStore(store); }
function findStoryline(slId) { return getStorylines().find(s => s.id === slId) || null; }

// ── Tutor retrieval (v62) ────────────────────────────────────────────────────
// The persistent tutor can be asked anything from anywhere, but the library is far too large to
// put in a prompt (hundreds of chapters ≈ tens of thousands of tokens). So we RETRIEVE a small,
// relevant slice. Three rules, in priority order:
//   1. SPOILER SAFETY: only ever retrieve from chapters the learner has COMPLETED. This is the
//      cheap 90% of what a concept graph would buy us — the learner can't be told how a story they
//      haven't finished turns out. Non-completed chapters are invisible to retrieval, full stop.
//   2. SCOPE: a question asked on a chapter/lesson screen is about THAT chapter (sent inline by the
//      client); on a storyline screen it's about that arc; on the landing page it's global.
//   3. RELEVANCE then RECENCY: within the allowed set, prefer chapters whose text overlaps the
//      learner's question, then the most recently added. Keyword overlap is a deliberate choice —
//      it needs no embeddings/vector store and keeps the zero-dependency constraint.
// Returns a compact context block (bounded chars), never the whole library.
const _TUTOR_STOPWORDS = new Set(('the a an and or but if then than that this these those is are was were be been being of to in on at by for with from as it its it\'s i you he she they we my your his her their our what which who whom how why when where do does did not no yes can could would should will shall may might must about into over under again more most some any all each').split(' '));
function _tutorTokens(s) {
  return String(s || '').toLowerCase().split(/[^\p{L}\p{N}']+/u)
    .filter(w => w.length > 2 && !_TUTOR_STOPWORDS.has(w));
}
function tutorRetrieveContext(opts) {
  const { question = '', scope = {}, completed = [], lang, srcLang, maxChars = 2400 } = opts || {};
  const completedSet = new Set(completed);
  const topics = (store.topics || []).filter(t =>
    t && t.story && completedSet.has(t.topic) &&
    (!lang || !t.lang || t.lang === lang) && (!srcLang || !t.srcLang || t.srcLang === srcLang));
  if (!topics.length) return { text: '', used: [] };

  // Scope narrowing: a storyline question only looks at that storyline's chapters.
  let pool = topics;
  // v66.1: narrow to a single storyline for storyline scope AND for chapter/lesson scope — a
  // question asked while reading chapter 3 is about THAT arc, not a same-language story from months
  // ago. Previously only 'storyline' narrowed, so chapter/lesson questions searched the whole
  // library and could answer with an unrelated story (reported).
  let slId = scope.storylineId || null;
  if (!slId && scope.topic) {
    const cur = (store.topics || []).find(t => t.topic === scope.topic);
    if (cur) {
      const owner = getStorylines().find(x => (x.chapters || []).includes(cur.id));
      if (owner) slId = owner.id;
    }
  }
  if (slId) {
    const sl = findStoryline(slId);
    if (sl) {
      const ids = new Set(sl.chapters || []);
      const inSl = topics.filter(t => ids.has(t.id));
      if (inSl.length) pool = inSl;
    }
  }
  // The chapter the learner is currently on is sent inline by the client; don't duplicate it here.
  if (scope.topic) pool = pool.filter(t => t.topic !== scope.topic);

  // Score: keyword overlap with the question (relevance), then recency as the tiebreaker.
  const qt = new Set(_tutorTokens(question));
  const scored = pool.map((t, i) => {
    let overlap = 0;
    if (qt.size) {
      const seen = new Set();
      for (const w of _tutorTokens(t.topic + ' ' + t.story)) {
        if (qt.has(w) && !seen.has(w)) { seen.add(w); overlap++; }
      }
    }
    return { t, overlap, idx: i };
  }).sort((a, b) => (b.overlap - a.overlap) || (b.idx - a.idx));

  // Take the best few, as SUMMARIES where we have them (storyline summaries are pre-compressed)
  // and short story excerpts otherwise, until the char budget is spent.
  const used = [];
  let out = '', budget = maxChars;
  for (const { t, overlap } of scored) {
    if (budget <= 200) break;
    // Only include zero-overlap chapters when the question gave us nothing to match on.
    if (qt.size && overlap === 0 && used.length) continue;
    const excerpt = String(t.story).replace(/\s+/g, ' ').slice(0, Math.min(600, budget - 120));
    const block = `— ${t.topic}: ${excerpt}${t.story.length > excerpt.length ? '…' : ''}\n`;
    out += block; budget -= block.length; used.push(t.topic);
    if (used.length >= 4) break;
  }
  return { text: out.trim(), used };
}
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
// v76_h: a digraphic language needs its SCRIPT named, or the model picks one per generation.
// Measured before this: Serbian-as-target came back Latin and Serbian-as-source Cyrillic, on the
// same storyline, because `langName` returned the bare string "Serbian" and that is the only thing
// any generator is told about the language. Decorating the name here reaches every prompt for
// free — all of them fill {L}/{S} from this function.
//
// `script` is IGNORED unless the language actually has a choice to make (scripts.json
// `_scriptChoice`). That list is NOT "languages with more than one script": Japanese lists
// hiragana and katakana and mixes them inside one sentence. See INTERNALS → "Several scripts is
// not the same as a script CHOICE".
function scriptChoiceLangs() { return new Set((_scriptsData && _scriptsData._scriptChoice) || []); }
function hasScriptChoice(code) { return scriptChoiceLangs().has(code); }
// Table name -> the name a human (and a model) calls that script. `cyrillic-sr` is the Serbian
// Cyrillic table; the `-sr` suffix disambiguates OUR tables, not the script, so it is dropped.
// Mechanical: this renames a table, it does not assert anything about the language.
function scriptLabel(name) {
  const base = String(name || '').split('-')[0];
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}
// A script value is kept only when the language really has a choice AND the value is one of the
// scripts scripts.json lists for it. Anything else becomes null, which restores pre-v76_h
// behaviour rather than sending the model a script name nobody declared.
function _validScript(code, script) {
  if (!code || !script) return null;
  if (!hasScriptChoice(code)) return null;
  const m = (_scriptsData._langScript || {})[code];
  const allowed = m ? (Array.isArray(m) ? m : [m]) : [];
  return allowed.includes(String(script)) ? String(script) : null;
}
function langName(code, script) {
  const base = LANG_NAMES[code] || code || 'Italian';
  if (!script || !hasScriptChoice(code)) return base;
  const label = scriptLabel(script);
  return label ? `${base} (written in ${label} script)` : base;
}

// ── Script config (from scripts.json) — drives the LLM-free intro course ──
let _scriptsData = {};
try {
  _scriptsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'scripts.json'), 'utf8'));
} catch(e) { console.warn('Could not load scripts.json:', e.message); }
// The script name(s) a language is written in, always as an array (e.g. ja → 2).
function scriptsForLang(code) {
  const m = (_scriptsData._langScript || {})[code];
  return m ? (Array.isArray(m) ? m : [m]) : [];
}
// Whether a script has a usable (non-empty) letter table loaded.
function scriptHasTable(name) {
  const tbl = _scriptsData[name];
  return !!(tbl && Array.isArray(tbl.letters) && tbl.letters.length);
}
// Whether `name` can actually be TAUGHT to a learner who already reads `srcScripts`.
// Most tables carry a Latin `translit` as the answer side, so they implicitly assume a
// Latin-reading learner and are teachable whenever they have a table. A table that declares
// `soundsFor` (currently only `latin`) can only be taught to the source scripts it has a
// `sounds` column for — otherwise the answers would be printed in the very script we are
// trying to teach ("show A a, pick a"), which teaches nothing.
function scriptTeachable(name, srcScripts) {
  if (!scriptHasTable(name)) return false;
  const tbl = _scriptsData[name];
  if (!Array.isArray(tbl.soundsFor)) return true;
  return (srcScripts || []).some(s => tbl.soundsFor.indexOf(s) >= 0);
}
// True when the target's script differs from the UI/source script AND we can teach it to this
// learner — i.e. an intro course would actually teach a new alphabet we can build. Symmetric
// since v53: `latin` is a script like any other, so ar→en teaches the Latin alphabet.
// v78_g (user-reported): the source's readable scripts are the ONE script this pair is actually
// written in when that is known, not every script the source LANGUAGE admits.
//
// The bug it fixes, reported on a Serbian-Latin -> Serbian-Cyrillic storyline (sl_56647998):
// `scriptsForLang('sr')` is ["cyrillic-sr","latin"], so for sr->sr BOTH sides came back as the full
// pair, every target script was already "readable", and the gate concluded the learner needs no
// alphabet at all. Exactly backwards for a storyline whose whole point is the script.
//
// The gate was answering "which scripts CAN this language be written in" where the question is
// "which script is THIS pair actually written in". Since v76_g/v76_h that is a stored per-topic
// fact (`script` / `srcScript`), so it is passed in when the caller has it.
//
// Only bites when a side is DIGRAPHIC — the languages in scripts.json `_scriptChoice` (["sr"]).
// Everywhere else the chosen script is the language's only script and narrowing changes nothing,
// which is why this survived until the corpus gained its first digraphic-source chapter.
//
// A chosen script is honoured only if it is one the language actually admits: a stale or
// hand-edited stamp falls back to the full set rather than inventing an alphabet for a language
// that has none.
function _scriptSideOf(langCode, chosen, fallbackLang) {
  const all = scriptsForLang(langCode || fallbackLang || 'en');
  if (chosen && all.indexOf(chosen) >= 0) return [chosen];
  return all;
}
function needsIntroScript(targetLang, srcLang, opts) {
  const tgt = _scriptSideOf(targetLang, opts && opts.script, targetLang);
  if (!tgt.length) return false;            // target unmapped -> no intro
  const srcArr = _scriptSideOf(srcLang || 'en', opts && opts.srcScript, 'en');
  const src = new Set(srcArr);
  return tgt.some(s => !src.has(s) && scriptTeachable(s, srcArr));
}
// The set of characters (incl. lowercase variants) that make up a script's letter table.
function _scriptCharSet(name) {
  const tbl = _scriptsData[name];
  const set = new Set();
  if (tbl && Array.isArray(tbl.letters)) for (const L of tbl.letters) {
    if (L.ch) for (const c of L.ch) set.add(c);
    if (L.lower) for (const c of L.lower) set.add(c);
  }
  return set;
}
// All glyphs of `scriptName` that appear anywhere in the chain rooted at startRef (walking
// continuedFrom backwards) — used to compute which letters are NEW to a chapter (extend).
function chainGlyphSet(startRef, scriptName) {
  const present = new Set();
  if (!startRef) return present;
  const chars = _scriptCharSet(scriptName);
  let t = findSavedById(startRef) || findSaved(startRef);
  const visited = new Set();
  while (t && !visited.has(t.id)) {
    visited.add(t.id);
    const parts = [t.story || ''];
    for (const ls of (t.lessons || [])) {
      if (ls.type === 'intro_script') continue;
      (ls.vocab||[]).forEach(v => v.target && parts.push(v.target));
      (ls.sentences||[]).forEach(s => s.target && parts.push(s.target));
      (ls.items||[]).forEach(it => { if (it.sentence) parts.push(it.sentence); if (it.target) parts.push(it.target); });
      (ls.words||[]).forEach(w => w.base && parts.push(w.base));
    }
    for (const c of parts.join(' ')) if (chars.has(c)) present.add(c);
    const pid = t.continuedFromId || (t.continuedFrom ? (findSaved(t.continuedFrom)?.id || null) : null);
    t = pid ? findSavedById(pid) : null;
  }
  return present;
}
// Letters of `scriptName` that appear in `chapterText` but NOT in the prior chain (priorRef).
// This is the storyline-aware "extend" scope: letters new to this chapter. Capped by difficulty.
function introExtendLetters(scriptName, chapterText, priorRef, difficulty) {
  const tbl = _scriptsData[scriptName];
  if (!tbl || !Array.isArray(tbl.letters)) return [];
  const here = new Set(String(chapterText || ''));
  const prior = chainGlyphSet(priorRef, scriptName);
  const isHere = (L) => (L.ch && [...L.ch].some(c => here.has(c))) || (L.lower && [...L.lower].some(c => here.has(c)));
  const isPrior = (L) => prior.has(L.ch) || (L.lower && prior.has(L.lower));
  let letters = tbl.letters.filter(L => isHere(L) && !isPrior(L));
  const max = introMaxLetters(difficulty);
  if (letters.length > max) {
    const sh = [...letters]; for (let i=sh.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [sh[i],sh[j]]=[sh[j],sh[i]]; }
    letters = sh.slice(0, max);
  }
  return letters;
}

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

// v79_a (found at the v79 cut): the SCRIPT PIN, shared by every prompt that writes target-language
// text. `v76_h` established that naming the script inside {L} is not enough — the model drifts
// between scripts inside one text — and added the rule to the STORY prompt. The lesson prompts were
// left with the name alone, and the corpus shows exactly the predicted result: the chapter
// `tp_17863746762340000193` has a story in pure Cyrillic and vocabulary in Latin (`reka`,
// `sanjati`, `vetar`), so a Cyrillic chapter taught Latin words and nothing the learner studied
// could ever be highlighted in the text they were reading.
//
// The note lives under PROMPTS.story because that is where it was written; it says nothing
// story-specific, so it is used verbatim rather than duplicated per prompt family.
function scriptPinNote(lang, script, _role) {
  const P = PROMPTS.story;
  const _digraphic = hasScriptChoice(lang);
  // v78_q, generalised in v79_f: SAY which of the two failures happened. "The script never reached
  // the prompt" and "the model was told and ignored it" have one identical symptom — a lesson in
  // the wrong alphabet — and telling them apart from the corpus alone is what mis-diagnosed the
  // first report twice. The line used to exist for the STORY prompt only, which is why the
  // conjugation lesson could come out Latin without a word in the log.
  const role = _role || 'prompt';
  try {
    if (script && _digraphic)       console.log(`    [script] ${role} pinned to ${scriptLabel(script)} for ${lang}`);
    else if (script && !_digraphic) console.log(`    [script] ${lang} has no script choice — '${script}' ignored (${role})`);
    else if (!script && _digraphic) console.log(`    [script] WARNING: ${lang} is digraphic but NO script reached the ${role} — the model will pick`);
  } catch (_) {}
  if (!script || !_digraphic || !P || !P.scriptNote) return '';
  return fillPrompt(P.scriptNote, { scriptLabel: scriptLabel(script), L2: LANG_NAMES[lang] || lang });
}

function sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, _unused, dialect, writingStyle, script) {
  const L    = langName(lang, script);
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
  sys += scriptPinNote(lang, script, 'vocab prompt');   // v79_a: same rule the story prompt has had since v76_h
  sys += skillTagPromptNote(lang, false);
  return sys;
}


// Lesson prompt for user-provided story + parallel translation
function sysLessonFromText(lang, srcLang, lessonNum, totalLessons, difficulty, dialect, script) {
  const L    = langName(lang, script);
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
  sys += scriptPinNote(lang, script, 'vocab prompt');   // v79_a
  sys += skillTagPromptNote(lang, false);
  return sys;
}


// Lesson prompt for table format
function sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, dialect, script) {
  const L    = langName(lang, script);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const lessonDiff = lessonNum === 1 ? 'basic vocabulary'
                   : lessonNum === 2 ? 'phrases and patterns'
                   : 'specific and idiomatic expressions';
  const P = PROMPTS.vocabTable;
  let sys = fillPrompt(P.system, { L, S, diff, lessonDiff, lessonNum, totalLessons });
  if (dialect) sys += fillPrompt(P.dialectNote, { dialect });
  if (lang === 'ja') sys += P.cjkNote;
  sys += scriptPinNote(lang, script, 'vocab prompt');   // v79_a
  sys += skillTagPromptNote(lang, true);
  return sys;
}

// A model supplies the semantic identifier because lemmatisation is language knowledge. This
// helper only states the structural contract; the B2 registry validates/canonicalises the result.
function skillTagPromptNote(lang, tableFormat) {
  const code = String(lang || '').trim().toLowerCase();
  if (tableFormat) {
    return `\n- Add a fourth Vocabulary-table column named "Skill ID". Every vocabulary row must contain one ID in the form "${code}:vocab:<dictionary-form>", using the target-language dictionary form from that row. Do not tag sentence rows.`;
  }
  return `\n- Every object in "vocab" MUST include "skillId": one proposed primary skill ID in the form "${code}:vocab:<dictionary-form>". Use the target-language dictionary form from that row. Do not add skill IDs to sentence objects.`;
}

// Parse two markdown tables (vocabulary, then sentences) from table-format lesson output.
// STRUCTURE-anchored, not keyword-anchored: a markdown table's header is whatever precedes its
// `|---|` separator row, and the data is the pipe rows after it. This is language-independent.
// (The old keyword filter `/^…|\w+ word/` silently leaked the header row as a vocab item for any
// target language whose name has non-ASCII letters — e.g. Lëtzebuergesch, where the ë broke `\w+` —
// which also dropped a real word via the 8-row cap and could swallow the entire sentence table.)
function parseTableLesson(raw, lessonNum, topic) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const isPipe    = l => l.startsWith('|');
  const isDashSep = l => l.includes('|') && l.includes('-') && l.replace(/[\s|:\-]/g, '').length === 0;
  const cellsOf   = l => l.split('|').map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
  // Data rows of one table: the pipe rows AFTER its separator, stopping at the next non-pipe line,
  // another separator, or (when a second table follows) that table's header row.
  const dataAfter = (sepIdx, nextSepIdx) => {
    const rows = [];
    const end = (nextSepIdx != null) ? nextSepIdx - 1 : lines.length; // exclude next table's header
    for (let i = sepIdx + 1; i < end; i++) {
      const l = lines[i];
      if (!isPipe(l) || isDashSep(l)) break;
      const cells = cellsOf(l);
      if (cells.length >= 2) rows.push(cells);
    }
    return rows;
  };
  const seps = [];
  lines.forEach((l, i) => { if (isPipe(l) && isDashSep(l)) seps.push(i); });

  let vocabRows, sentRows;
  if (seps.length >= 1) {
    vocabRows = dataAfter(seps[0], seps[1]);
    sentRows  = seps.length >= 2 ? dataAfter(seps[1], seps[2]) : [];
  } else {
    // Malformed output with no separator rows: positional fallback — the FIRST pipe row is the
    // header, the rest are data (still language-independent, no keyword matching).
    const pipeRows = lines.filter(isPipe).map(cellsOf).filter(c => c.length >= 2);
    vocabRows = pipeRows.slice(1);
    sentRows  = [];
  }

  const toPair    = r => ({ target: r[0] || '', source: r[1] || '' });
  const toVocab   = r => r[3] ? { ...toPair(r), skillId: r[3] } : toPair(r);
  const vocab     = vocabRows.slice(0, 8).map(toVocab).filter(v => v.target && v.source);
  const sentences = sentRows.slice(0, 5).map(toPair).filter(s => s.target && s.source);

  if (vocab.length < 1) throw new Error(`Table parse: only ${vocab.length} vocab rows`);

  return { title: `Lesson ${lessonNum}`, desc: topic, icon: '📖', vocab, sentences };
}

// ── Vocab article symmetry (v71_d) ────────────────────────────────────────────────────────────
// User-reported, measured on storyline sl_15116115 (Italian from German, 8 chapters from one PDF):
// 42 of 64 vocab items carried a German article with no Italian one — "teoria" / "die Theorie".
// The direction was never reversed (0 items the other way), and the split was per LESSON, not per
// item: ch1/2/3/6/7/8 were asymmetric almost throughout, ch4 had articles on BOTH sides, ch5 on
// neither. That is the signature of a per-CALL decision — each chapter is its own generation, and
// the model picks a convention fresh each time. The prompt has always said "never an article on one
// side only", so the missing piece is not instruction but ENFORCEMENT.
//
// Deterministic policy: STRIP the lone article. Adding the missing one would need the target noun's
// gender, which cannot be derived without a model and would be a second place for gender to be
// wrong; stripping needs nothing and is always safe. Gender is taught by the dedicated `grammar`
// v71_y: VOCAB_ARTICLES / VOCAB_ELISIONS / splitArticle / normalizeVocabArticles were removed here.
// They encoded article lists for 12 languages plus elision forms — the session-23 design principle
// ("no language knowledge in the code") — and prescribed a direction, always stripping the lone
// article. Measured harm: `la grandine` / `hail` became `grandine` / `hail` while its symmetric
// siblings were untouched, so the code degraded the lesson it was meant to normalise.
// Article symmetry now lives in qcCheckPair, with the lesson's other pairs as context, proposing a
// fix on whichever side matches the convention. See INTERNALS.md → "Design principle".

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
function callLLM(system, userMsg, maxTokens, opts) {
  return _callLLM(OLLAMA_MODEL, system, userMsg, maxTokens, opts);
}
function callLLMLesson(system, userMsg, maxTokens, opts) {
  // v60.7: apply the LESSONS reasoning policy here, so all lesson-generation call sites honor the
  // toggle without each having to thread thinkOpts. When lessons-reasoning is OFF this passes
  // think:false with the given budget (the safe default that avoids empty-response on a reasoning
  // model); when ON it bumps the token budget + timeout and passes think:true. An explicit opts
  // from the caller still wins (spread last) for any future special case.
  const pol = thinkOpts('lessons', maxTokens);
  return _callLLM(OLLAMA_LESSON_MODEL, system, userMsg, pol.tokens, { ...pol, ...opts });
}
function callLLMTranslation(system, userMsg, maxTokens, opts) {
  return _callLLM(OLLAMA_TRANSLATION_MODEL, system, userMsg, maxTokens, opts);
}
// QC pass — its own role (defaults to the translation model). See qcCheckPair et al.
function callLLMQC(system, userMsg, maxTokens, opts) {
  return _callLLM(OLLAMA_QC_MODEL, system, userMsg, maxTokens, opts);
}
// v66.1: the tutor is handed a "Student: / Tutor:" transcript, so a model will happily continue
// BOTH sides and invent the learner's answers (reported). Three defences, weakest to strongest:
// the prompt forbids it, stop-sequences cut generation at a student marker, and this sanitizer
// truncates anything that still slips through. Only the sanitizer is a guarantee.
const _TUTOR_STOP = ['\nStudent:', '\nSTUDENT:', '\nStudent :', '\nLearner:', '\nSchüler:'];
function sanitizeTutorReply(text) {
  let out = String(text || '');
  // Cut at the first point the model starts speaking for the learner (or re-labels itself).
  const markers = [/\n\s*Student\s*:/i, /\n\s*STUDENT\s*:/, /\n\s*Learner\s*:/i,
                   /\n\s*Sch(ü|ue)ler\s*:/i, /\n\s*Tutor\s*:/i, /\n\s*Studente\s*:/i,
                   /\n\s*Élève\s*:/i, /\n\s*Alumno\s*:/i];
  for (const re of markers) {
    const m = out.match(re);
    if (m && m.index >= 0) out = out.slice(0, m.index);
  }
  // A leading self-label ("Tutor: …") is noise, not content.
  out = out.replace(/^\s*(Tutor|TUTOR)\s*:\s*/, '');
  return out.trim();
}

// Tutor (v61): conversational comprehension tutor. Honors the tutor reasoning toggle (thinkOpts),
// so a reasoning model gets think:true + bumped budget/timeout when the teacher enables it.
function callLLMTutor(system, userMsg, maxTokens, opts) {
  const pol = thinkOpts('tutor', maxTokens);
  return _callLLM(OLLAMA_TUTOR_MODEL, system, userMsg, pol.tokens, { stop: _TUTOR_STOP, ...pol, ...opts });
}
// v64: streaming variant for the tutor chat only. Same role + reasoning policy; deliberately NOT
// routed through the v59 metering wrapper (that wraps the whole-reply _callLLM and every other
// feature depends on it) — tutor turns are not attributed to any artefact, so the route simply
// reports the final counts itself.
function callLLMTutorStream(system, userMsg, maxTokens, opts, onDelta) {
  const pol = thinkOpts('tutor', maxTokens);
  return _rawCallLLMStream(OLLAMA_TUTOR_MODEL, system, userMsg, pol.tokens, { stop: _TUTOR_STOP, ...pol, ...opts }, onDelta);
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
// QC a DIALECT vocab pair (sourceOnly). The `target` is a dialect token (e.g. East-Tyrolean),
// which is GROUND TRUTH from the user's glossary — the model must NEVER "correct" it toward the
// standard language (that would destroy the dialect). So we check only whether the `source` (the
// High-German / standard-language gloss the user supplied) is spelled/written correctly on its own
// terms, and we can NEVER return a target suggestion. The dialect word is shown to the model only
// as immutable context. Returns {ok} | {ok:false, field:'source', sug}.
async function qcCheckDialectPair(target, source, lang, srcLang, userComment) {
  const S = langName(srcLang || 'de');
  const tgt = _qcStripFuri(target);
  const src = String(source).trim();
  const system =
    `You are given a dialect word and its ${S} meaning. The dialect word is FIXED and correct — ` +
    `never change it or comment on it (it is a real regional form, not standard ${S}).\n` +
    `Check ONLY the ${S} meaning: is it spelled and written correctly as ${S} (e.g. ${S} ` +
    `capitalization of nouns)? Do NOT judge whether it is the "right" translation — the user is the ` +
    `authority on what the dialect word means; only fix obvious ${S} spelling/writing errors.\n` +
    (userComment && String(userComment).trim()
      ? `The user reports a problem: "${String(userComment).trim().replace(/"/g, "'").slice(0, 300)}". Take it into account.\n`
      : '') +
    `Reply EXACTLY one of:\n` +
    `OK  — if the ${S} meaning is written correctly.\n` +
    `S: <corrected ${S} text only>  — if the ${S} meaning has a spelling/writing error.\n` +
    `Never reply with a correction to the dialect word. Give ONLY the corrected ${S} text, no quotes.`;
  const { text } = await callLLMQC(system, `dialect: ${tgt}\n${S}: ${src}`, 96);
  const reply = (text || '').trim();
  if (!reply || /^ok[.!]?$/i.test(reply)) return { ok: true };
  const clean = s => s.replace(/^["']|["']$/g, '').replace(/^S\s*[:\-]\s*/i, '').trim();
  const body = clean(reply);
  // sourceOnly: any suggestion can ONLY be a source fix; a reply echoing the dialect word or empty
  // is treated as OK (we never touch the target).
  if (!body || body === src || body === tgt) return { ok: true };
  return { ok: false, field: 'source', sug: body.slice(0, 300) };
}

// Generate a short dialect STORY (M2). ONLY ever called behind the curated gate (a human approved
// this dialect after reviewing sample output). Tightly constrained + few-shot-grounded in the
// glossary; output is ALWAYS aiGenerated and routed through QC + flagging. Returns { story, gloss }
// (dialect story + a High-German rendering) or null. High risk — this is the model AUTHORING
// dialect prose, which is why it's gated and marked.
async function generateDialectStory(glossaryRows, baseLang, opts) {
  opts = opts || {};
  const S = langName(baseLang || 'de');
  const topic = opts.topic ? String(opts.topic).slice(0, 300).trim() : '';
  const instructions = opts.instructions ? String(opts.instructions).slice(0, 600).trim() : '';
  const lengthHint = opts.long ? '8–14 sentences' : '5–8 sentences';
  const fewshot = (glossaryRows || []).slice(0, 80).map(r => `${r.target} = ${r.source}`).join('\n');
  const system =
    `You write a short, coherent story in a regional dialect (a variety of ${S}), for language ` +
    `learners. You are given a glossary of dialect words with their ${S} meanings. Rules:\n` +
    `- Write a real STORY (a little narrative), ${lengthHint}, on the given topic.\n` +
    `- You MUST use SEVERAL glossary dialect words — at least a handful, not just one. A story that uses only one (or none) of the glossary words is a failure; weave in as many as fit naturally and prefer glossary words over generic ${S}.\n` +
    `- Mimic the spelling/orthography of the glossary exactly.\n` +
    `- It's OK to use ordinary dialect grammar/function words to connect them into a real story.\n` +
    (instructions ? `- Author instructions (follow these): ${instructions}\n` : '') +
    `Reply with EXACTLY two blocks, nothing else:\n` +
    `STORY:\n<the dialect story>\n---\nGERMAN:\n<a plain ${S} rendering of the same story>`;
  const user = `Glossary:\n${fewshot}\n\n`
    + (topic ? `Topic: "${topic}".\n` : '')
    + `Write the dialect story now.`;
  // v79_f: a dialect story is target-language text, so it takes the pin like every other. The base
  // languages that carry glossaries today are monoscriptic, so this adds nothing to them — which is
  // the point of routing it through scriptPinNote rather than deciding per call site.
  const systemPinned = system + scriptPinNote(baseLang, opts.script || null, 'dialect story prompt');
  let text;
  try { ({ text } = await callLLMTranslation(systemPinned, user, opts.long ? 1000 : 640)); } catch (_) { return null; }
  const reply = (text || '').trim();
  const m = reply.match(/STORY:\s*([\s\S]*?)\s*---\s*GERMAN:\s*([\s\S]*)$/i);
  if (!m) return null;
  const story = m[1].trim(), gloss = m[2].trim();
  if (!story || !gloss) return null;
  return { story: story.slice(0, 4000), gloss: gloss.slice(0, 4000) };
}

// Count how many distinct glossary dialect words actually appear in a dialect text. A cheap,
// deterministic FAITHFULNESS signal: a rewrite that used almost none of the glossary probably just
// lightly Germanized the text; one that used many is closer to real dialect. Word-boundary-ish,
// case-insensitive, first token of slash-variants. Returns { used, total, ratio }.
function dialectGlossaryCoverage(text, glossaryRows) {
  const hay = ' ' + String(text || '').toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const rows = (glossaryRows || []);
  let used = 0;
  const seen = new Set();
  for (const r of rows) {
    const w = String(r.target || '').toLowerCase().split(/[\/\s]/)[0].trim();
    if (!w || seen.has(w)) continue;
    seen.add(w);
    if (hay.includes(' ' + w + ' ')) used++;
  }
  const total = seen.size;
  return { used, total, ratio: total ? +(used / total).toFixed(3) : 0 };
}

// V2 (EXPERIMENTAL) — the "standard → dialect REWRITE" approach. Two model calls:
//   (1) write a coherent story in STANDARD German on the topic (the model is good at this);
//   (2) REWRITE that story into the dialect, using the glossary as a substitution reference,
//       preserving sentence count + meaning, changing only what the dialect requires.
// This reframes the model from AUTHOR to TRANSFORMER — a more constrained, checkable task — and,
// crucially, yields a Standard-German SOURCE aligned to the dialect output, so we can measure
// glossary coverage (and later back-translate to QC). Returns
//   { story, gloss, standardSource, coverage, method:'rewrite' } or null.
async function generateDialectStoryV2(glossaryRows, baseLang, opts) {
  opts = opts || {};
  const S = langName(baseLang || 'de');
  const topic = opts.topic ? String(opts.topic).slice(0, 300).trim() : '';
  const instructions = opts.instructions ? String(opts.instructions).slice(0, 600).trim() : '';
  const lengthHint = opts.long ? '8–14 sentences' : '5–8 sentences';

  // ── Step 1: a Standard-German story (no dialect risk; the model is reliable here). ──
  const sys1 =
    `You write a short, coherent story in Standard ${S} for language learners.\n` +
    `- A real little narrative, ${lengthHint}, on the given topic.\n` +
    `- Simple, everyday language and grammar.\n` +
    `Reply with ONLY the story text, no title, no preamble.`;
  const usr1 = (topic ? `Topic: "${topic}".\n` : '') + `Write the Standard ${S} story now.`;
  let standardSource;
  try { ({ text: standardSource } = await callLLMTranslation(sys1, usr1, opts.long ? 900 : 560)); } catch (_) { return null; }
  standardSource = (standardSource || '').trim();
  if (!standardSource) return null;

  // ── Step 2: a CONSTRAINED rewrite into the dialect. The model is a transformer, not an author. ──
  const fewshot = (glossaryRows || []).slice(0, 100).map(r => `${r.target} = ${r.source}`).join('\n');
  const sys2 = (escalate) =>
    `You rewrite a Standard ${S} story into a regional dialect (a variety of ${S}). You are a careful ` +
    `TRANSLATOR/REWRITER, not an author. Rules:\n` +
    `- Keep the SAME meaning and the SAME number of sentences, in the same order.\n` +
    `- You MUST substitute SEVERAL glossary dialect words — at least a handful, not just one. Wherever a ` +
    `glossary word fits the meaning, use it (prefer it over the ${S} word). A rewrite that uses only one ` +
    `(or none) of the glossary words is a failure.\n` +
    `- Mimic the glossary's spelling/orthography exactly.\n` +
    `- Change only what the dialect actually requires (words, small grammar/function words). Do NOT ` +
    `add new ideas or sentences.\n` +
    `- Do NOT invent dialect words you are unsure of — if you have no dialect form, keep the ${S} word.\n` +
    (escalate ? `- Your previous attempt used TOO FEW glossary words. This time use noticeably MORE of them, wherever the meaning allows.\n` : '') +
    (instructions ? `- Extra instructions: ${instructions}\n` : '') +
    `Reply with EXACTLY two blocks, nothing else:\n` +
    `STORY:\n<the dialect rewrite>\n---\nGERMAN:\n<the original Standard ${S} story, unchanged>`;
  const usr2 = `Glossary (dialect = ${S}):\n${fewshot}\n\nStandard ${S} story to rewrite:\n${standardSource}`;
  // One rewrite attempt → { story, gloss, coverage } or null.
  const runRewrite = async (escalate) => {
    let text2;
    try { ({ text: text2 } = await callLLMTranslation(
      sys2(escalate) + scriptPinNote(baseLang, opts.script || null, 'dialect rewrite prompt'),
      usr2, opts.long ? 1200 : 760)); } catch (_) { return null; }   // v79_f
    const reply = (text2 || '').trim();
    const m = reply.match(/STORY:\s*([\s\S]*?)\s*---\s*GERMAN:\s*([\s\S]*)$/i);
    let story, gloss;
    if (m) { story = m[1].trim(); gloss = (m[2] || '').trim() || standardSource; }
    else { story = reply.replace(/^STORY:\s*/i, '').trim(); gloss = standardSource; }
    if (!story) return null;
    return { story, gloss, coverage: dialectGlossaryCoverage(story, glossaryRows) };
  };
  let best = await runRewrite(false);
  if (!best) return null;
  // Enforce "more than one glossary word": if the rewrite used <2 of the available glossary words,
  // retry once with an escalated instruction and keep whichever used more.
  const MIN_GLOSSARY_WORDS = 2;
  if (best.coverage && best.coverage.total >= MIN_GLOSSARY_WORDS && best.coverage.used < MIN_GLOSSARY_WORDS) {
    console.log(`    Dialect rewrite used only ${best.coverage.used}/${best.coverage.total} glossary words — retrying with escalation…`);
    const retry = await runRewrite(true);
    if (retry && retry.coverage && retry.coverage.used > best.coverage.used) best = retry;
  }
  return {
    story: best.story.slice(0, 4000),
    gloss: best.gloss.slice(0, 4000),
    standardSource: standardSource.slice(0, 4000),
    coverage: best.coverage,
    method: 'rewrite',
  };
}

// v71_y: `siblings` are the other vocab items in the SAME lesson, used only to show the model the
// article convention that lesson already follows. Optional — omitting it degrades the article check
// to a judgement without context, never to an error.
// Identity this check files its findings under, so they sit beside model verdicts in `qcByModel`
// rather than competing with them. Not a model name — deliberately readable in the flag UI.
const QC_DIACRITIC_BY = 'diacritics';
// ── Deterministic diacritic check (v72) ───────────────────────────────────────
// Roadmap item, validated against the user's pre-edit export: a word written WITHOUT its diacritics
// where the same corpus contains the properly-accented form. `naturliche` vs `natürliche` survived
// hand-editing, which is the argument for automating it.
//
// Filed on the roadmap as the "missing umlaut" rule; named for DIACRITICS here on purpose. Framing
// it as a German problem would smuggle in the language knowledge the session-23 principle forbids —
// and would miss the identical defect in `é/è`, `ñ`, `ç`, `å`, `ø`. Nothing below knows what
// language it is looking at: it compares corpus forms against each other, which is tier 2 of the
// four tiers in INTERNALS.md ("derived from what the model already produced").
//
// Unicode-level only, so it is squarely on the permitted side of the principle: NFD-decompose,
// drop combining marks, and additionally fold the handful of letters that carry their diacritic as
// a distinct codepoint rather than a combining mark (ß/æ/œ/ø). Deliberately mirrors the client's
// normDiacritics — asserted by unit-diacritic-qc so the two cannot drift — except that CASE IS
// PRESERVED, which is load-bearing (see below).
function _stripDiacriticsCase(s) {
  return String(s == null ? '' : s)
    .replace(/ß/g, 'ss').replace(/Ø/g, 'O').replace(/ø/g, 'o')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE').replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}
const _hasDiacritic = (s) => _stripDiacriticsCase(s) !== String(s == null ? '' : s).trim();

// Index every accented form the corpus contains, keyed by its stripped form WITH CASE INTACT.
// Case is what suppresses the false positive the roadmap names: `Zahlen` (numbers) and `zählen`
// (to count) strip to `Zahlen` and `zahlen`, which are different keys, so neither flags the other.
// Lowercasing here would report a real German word as a typo for an unrelated one.
function buildDiacriticIndex(topics) {
  const idx = new Map();
  const add = (word, lang) => {
    const w = String(word == null ? '' : word).trim();
    if (!w || !_hasDiacritic(w)) return;
    const key = lang + '\u0000' + _stripDiacriticsCase(w);
    if (!idx.has(key)) idx.set(key, new Set());
    idx.get(key).add(w);
  };
  for (const tp of (topics || [])) {
    for (const ls of (tp.lessons || [])) {
      for (const it of (ls.vocab || [])) { add(it && it.target, tp.lang); add(it && it.source, tp.srcLang); }
      for (const it of (ls.sentences || [])) { add(it && it.target, tp.lang); add(it && it.source, tp.srcLang); }
      for (const g of (ls.grammar || [])) { add(g && g.target, tp.lang); add(g && g.source, tp.srcLang); }
    }
  }
  return idx;
}

// Is this word an unaccented spelling of something the corpus writes with diacritics?
// Returns { ok } | { ok:false, sug } — a SUGGESTION, never a rewrite, exactly like the model checks.
function checkDiacritics(word, lang, idx) {
  const w = String(word == null ? '' : word).trim();
  // A word that already carries a diacritic is not missing one. Multi-word phrases are skipped:
  // the index is built from whole fields, so a phrase would only ever match another identical
  // phrase, and per-token checking would need tokenisation rules that vary by language.
  if (!w || !idx || _hasDiacritic(w) || /\s/.test(w)) return { ok: true };
  const hits = idx.get(lang + '\u0000' + _stripDiacriticsCase(w));
  if (!hits || !hits.size) return { ok: true };
  const sug = [...hits][0];
  return sug === w ? { ok: true } : { ok: false, sug };
}

// …and the model decides whether the candidate is actually a typo.
//
// The scan above is a CANDIDATE GENERATOR, not a verdict. Measured on the corpus it produces 5
// candidates, of which most are minimal pairs — real, distinct words that differ only by a
// diacritic: `souffle` (breath) vs `soufflé` (the dish); `inizio` (beginning) vs `iniziò` (he
// began). Telling those apart requires knowing the language, which the session-23 principle says
// is the model's job, not the code's.
//
// The roadmap's original rule tried to do it with capitalisation — `Zahlen` vs `zählen`. That
// works because German capitalises nouns, and fails for every language that does not; it is a
// German fact in disguise. It is kept anyway, as a cheap pre-filter (it costs nothing and removes
// one certain class), but it is no longer the decision.
//
// Cost is negligible: the scan is deterministic and only its handful of survivors reach a model.
async function qcCheckDiacriticCandidate(word, suggestion, lang) {
  const L = langName(lang);
  const system =
    `Two ${L} spellings differ only in diacritics: "${word}" and "${suggestion}".\n` +
    `Decide whether "${word}" is a MISSPELLING of "${suggestion}", or a DIFFERENT, correctly ` +
    `spelled ${L} word in its own right (including a different inflected form).\n` +
    `Reply EXACTLY one of:\n` +
    `OK  — "${word}" is a correct ${L} spelling of some word; leave it alone.\n` +
    `FIX — "${word}" is a misspelling and should be "${suggestion}".\n` +
    `Reply with the single word OK or FIX and nothing else.`;
  const { text } = await callLLMQC(system, `${word} / ${suggestion}`, 8);
  const reply = String(text || '').trim().toUpperCase();
  // Default to OK on anything unclear: a missed typo is a cosmetic defect, a false flag trains the
  // user to dismiss the whole QC panel.
  if (!/^FIX/.test(reply)) return { ok: true };
  return { ok: false, sug: suggestion };
}

async function qcCheckPair(target, source, lang, srcLang, userComment, siblings) {
  const L = langName(lang), S = langName(srcLang || 'en');
  const tgt = _qcStripFuri(target);
  const src = String(source).trim();
  // Up to 6 other pairs from the lesson, verbatim. The model needs to SEE the convention rather
  // than be told one: whether this lesson carries articles on both sides or neither is a property
  // of the data, and asserting it in the prompt would be the language knowledge we removed in
  // v71_x wearing a different hat.
  const _sib = (Array.isArray(siblings) ? siblings : [])
    .filter(x => x && x.target && x.source && _qcStripFuri(x.target) !== tgt)
    .slice(0, 6)
    .map(x => `${_qcStripFuri(x.target)} => ${String(x.source).trim()}`);
  const system =
    `You check a ${L} phrase and its ${S} translation, given as "<${L}> => <${S}>".\n` +
    `Check ALL of: (1) the ${L} text is correct — spelling, grammar, and capitalization ` +
    `(apply ${L} capitalization rules, e.g. German capitalizes all nouns); ` +
    `(2) the ${S} side is an accurate translation of the ${L} text; ` +
    `(3) ARTICLE SYMMETRY — if one side carries a leading article and the other does not, that is ` +
    `an error. Fix it on whichever side matches how the other pairs in this lesson are written ` +
    `(shown below): add the missing article, or remove the lone one. If the lesson shows no clear ` +
    `convention, prefer the form that teaches more — for a language where the article marks gender, ` +
    `keeping it is more useful than dropping it. If a language marks definiteness with an attached ` +
    `prefix or suffix rather than a separate word, that is NOT a lone article and is correct as-is.\n` +
    (_sib.length ? `Other pairs in this same lesson, for the convention only — do NOT correct them:\n${_sib.join('\n')}\n` : '') +
    (userComment && String(userComment).trim()
      ? `The user reports a problem with this item: "${String(userComment).trim().replace(/"/g, "'").slice(0, 300)}". Take this report into account when checking.\n`
      : '') +
    `Reply EXACTLY one of:\n` +
    `OK  — if both are correct.\n` +
    `T: <corrected ${L} text only>  — if the ${L} text has an error.\n` +
    `S: <corrected ${S} text only>  — if the ${L} is fine but the ${S} translation is wrong.\n` +
    `Give ONLY the corrected text for the one side, never the "=>" pair, no quotes, no notes.`;
  const { text } = await callLLMQC(system, `${tgt} => ${src}`, 96);
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

// Parse a checker reply that is either "OK" or "<suggestion text>". Returns {ok} or {ok,sug}.
function _qcParseOkOrSug(text){
  const reply = (text || '').trim();
  if (!reply || /^ok[.!]?$/i.test(reply)) return { ok: true };
  // Strip a leading label like "FIX:" / "SUGGESTION:" the model may add.
  const body = reply.replace(/^(fix|suggestion|issue|problem)\s*[:\-]\s*/i, '').trim();
  if (!body || /^ok[.!]?$/i.test(body)) return { ok: true };
  return { ok: false, sug: body.slice(0, 300) };
}

// QC a word_forms (cloze) item: {sentence with ___, translation, choices, correctIndex, explanation}.
// Verifies the marked-correct choice actually fits the blank, the translation matches, the
// distractors are genuinely wrong, and the explanation is right. Returns {ok} | {ok:false, sug}.
async function qcCheckCloze(item, lang, srcLang, userComment) {
  const L = langName(lang), S = langName(srcLang || 'en');
  const choices = Array.isArray(item.choices) ? item.choices : [];
  const correct = choices[item.correctIndex];
  if (!item.sentence || !choices.length || correct == null) return { ok: true };
  const sentence = _qcStripFuri(item.sentence);
  const system =
    `You check one ${L} fill-in-the-blank exercise. The blank is "___".\n` +
    `Verify ALL of:\n` +
    `1. The marked-correct option grammatically and semantically fits the blank.\n` +
    `2. The other options do NOT also correctly fit (they must be wrong but plausible).\n` +
    `3. The ${S} translation matches the completed ${L} sentence.\n` +
    `4. The explanation (if any) is accurate.\n` +
    (userComment && String(userComment).trim()
      ? `The user reports: "${String(userComment).trim().replace(/"/g,"'").slice(0,200)}". Consider it.\n` : '') +
    `Reply EXACTLY "OK" if everything is correct. Otherwise reply with ONE short sentence naming ` +
    `the single most important problem and the fix (e.g. which option should be correct, or the ` +
    `corrected translation). No preamble, no quotes.`;
  const user =
    `Sentence: ${sentence}\n` +
    `Options: ${choices.map((c,i) => `${i===item.correctIndex?'[correct] ':''}${c}`).join(' | ')}\n` +
    `Translation (${S}): ${item.translation || '(none)'}\n` +
    `Explanation: ${item.explanation || '(none)'}`;
  const { text } = await callLLMQC(system, user, 120);
  return _qcParseOkOrSug(text);
}

// QC an inflections item: {sentence, surfaceForm, lemma, lemmaChoices, lemmaCorrectIndex,
// formLabel, formChoices, formCorrectIndex, translation, explanation}. Verifies surfaceForm really
// is an inflection of lemma as used in the sentence, the marked-correct lemma/form choices are
// right, the distractors are genuinely wrong, and the explanation is accurate — all in ONE call,
// since the two questions describe the SAME inflection and checking them apart could miss an
// internal inconsistency (e.g. a lemma that's right but a form label that doesn't match it).
async function qcCheckInflection(item, lang, srcLang, userComment) {
  const L = langName(lang), S = langName(srcLang || 'en');
  const lemmaChoices = Array.isArray(item.lemmaChoices) ? item.lemmaChoices : [];
  const formChoices = Array.isArray(item.formChoices) ? item.formChoices : [];
  const correctLemma = lemmaChoices[item.lemmaCorrectIndex];
  const correctForm = formChoices[item.formCorrectIndex];
  if (!item.sentence || !item.surfaceForm || !lemmaChoices.length || !formChoices.length ||
      correctLemma == null || correctForm == null) return { ok: true };
  const sentence = _qcStripFuri(item.sentence);
  const system =
    `You check one ${L} "inflection" exercise for a language learner who speaks ${S}. The learner ` +
    `sees a real ${L} sentence with one word highlighted (the "surface form"), and answers two ` +
    `multiple-choice questions: what is that word's DICTIONARY (lemma) form, and what GRAMMATICAL ` +
    `FORM is it (case, number, tense, person, degree, definiteness — whatever applies).\n` +
    `Verify ALL of:\n` +
    `1. The surface form genuinely appears in the sentence, spelled as given.\n` +
    `2. The surface form is genuinely an INFLECTED/DERIVED form of the marked-correct lemma (not ` +
    `the same word already in dictionary form, and not an unrelated word).\n` +
    `3. The marked-correct lemma is the ACTUAL dictionary form of the surface form (for a noun in a ` +
    `language with grammatical gender, the lemma should include its article).\n` +
    `4. The other lemma choices do NOT also correctly describe this word (they must be wrong but plausible).\n` +
    `5. The marked-correct form label correctly names the grammatical form of the surface form here.\n` +
    `6. The other form-label choices do NOT also correctly describe it.\n` +
    `7. The ${S} translation matches the sentence, and the explanation is accurate.\n` +
    (userComment && String(userComment).trim()
      ? `The user reports: "${String(userComment).trim().replace(/"/g,"'").slice(0,200)}". Consider it.\n` : '') +
    `Reply EXACTLY "OK" if everything is correct. Otherwise reply with ONE short sentence naming ` +
    `the single most important problem and the fix. No preamble, no quotes.`;
  const user =
    `Sentence: ${sentence}\n` +
    `Surface form (highlighted word): ${item.surfaceForm}\n` +
    `Lemma options: ${lemmaChoices.map((c,i) => `${i===item.lemmaCorrectIndex?'[correct] ':''}${c}`).join(' | ')}\n` +
    `Form-label options: ${formChoices.map((c,i) => `${i===item.formCorrectIndex?'[correct] ':''}${c}`).join(' | ')}\n` +
    `Translation (${S}): ${item.translation || '(none)'}\n` +
    `Explanation: ${item.explanation || '(none)'}`;
  const { text } = await callLLMQC(system, user, 150);
  return _qcParseOkOrSug(text);
}

// QC a synonyms entry: {base, gloss, synonyms:[{w,g}], antonyms:[...], homophones:[...]}.
// Verifies the gloss fits base, listed synonyms really are synonyms in the target language,
// antonyms are真 opposites, homophones sound alike. Returns {ok} | {ok:false, sug}.
async function qcCheckSynonymSet(entry, lang, srcLang, userComment) {
  const L = langName(lang), S = langName(srcLang || 'en');
  if (!entry.base) return { ok: true };
  // Strip furigana brackets (猫[ねこ] → 猫) so the model sees clean words, matching qcCheckCloze.
  const sf = _qcStripFuri;
  const fmt = (arr) => (Array.isArray(arr) && arr.length) ? arr.map(x => sf(x.w) + (x.g ? ` (${x.g})` : '')).join(', ') : '(none)';
  const system =
    `You check a ${L} vocabulary entry and its related-words lists.\n` +
    `Verify ALL of:\n` +
    `1. The ${S} gloss accurately translates the ${L} word.\n` +
    `2. Every listed SYNONYM is a real ${L} synonym (or near-synonym) of the word.\n` +
    `3. Every listed ANTONYM is a real ${L} opposite of the word.\n` +
    `4. Every listed HOMOPHONE actually sounds like the word in ${L}.\n` +
    (userComment && String(userComment).trim()
      ? `The user reports: "${String(userComment).trim().replace(/"/g,"'").slice(0,200)}". Consider it.\n` : '') +
    `Reply EXACTLY "OK" if all are correct. Otherwise reply with ONE short sentence naming the ` +
    `single most important problem (e.g. "X is not a synonym of <word>" or the corrected gloss). ` +
    `No preamble, no quotes.`;
  const user =
    `Word (${L}): ${sf(entry.base)}\n` +
    `Gloss (${S}): ${entry.gloss || '(none)'}\n` +
    `Synonyms: ${fmt(entry.synonyms)}\n` +
    `Antonyms: ${fmt(entry.antonyms)}\n` +
    `Homophones: ${fmt(entry.homophones)}`;
  const { text } = await callLLMQC(system, user, 120);
  return _qcParseOkOrSug(text);
}

// ══ QC / story-diff helpers — MODULE SCOPE (v55_l): must precede _runQc, which calls
//    generateStoryQc from the bulk sweep. Previously nested inside boot(), invisible to _runQc.
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

// ── QC for generated texts (v55_g): correct a story, gated against wholesale rewrite ──────────
// A QC-role model proofreads `story` and returns a CORRECTED text. The result is a PROPOSAL — the
// caller stores it under `topic.storyQcProposal` and never overwrites `topic.story` until the user
// accepts. The (original, corrected) diff seeds an ai_error_hunt via the existing machinery.
//
// The "too many changes" guard rejects a rewrite (the corrector regenerating rather than fixing).
// Thresholds are set from the v55_g spike (spike-qc-correct.js) on real corpus stories: the
// 'corrected' band topped out at changedRatio 0.21 / wordEditRatio 0.033, while the one genuine
// rewrite sat at 0.938 / 0.844 — a wide empty gulf. 0.6 / 0.5 sit in that gulf with margin on both
// sides. A rewrite is not silently discarded: it's returned with rejected:true so the UI can tell
// the user "the corrector rewrote this rather than proofreading — likely too broken to QC".
const QC_MAX_CHANGED_RATIO = 0.6;   // fraction of sentences touched
const QC_MAX_WORD_EDIT_RATIO = 0.5; // word-level Levenshtein / original word count

// ── QC REVIEW granularity (v55_u): whole sentences, NOT the clause-level splitSentences ─────────
// `splitSentences` breaks on commas because ai_error_hunt wants SHORT items to hunt in. That's
// wrong for the QC review: a proofreader removing ONE comma changes the fragment count, so the LCS
// re-aligns everything after it — sentence 2 gets folded into sentence 1's "correction", unrelated
// sentences get paired, and a phantom deletion appears (user-reported on a Luxembourgish story).
// At sentence granularity a comma edit is just a within-sentence word diff, which is also what the
// per-sentence checkboxes (v55_m) claim to be. ai_error_hunt keeps clause granularity — untouched.
// NOTE classifyStoryQc's changedRatio deliberately still uses the CLAUSE diff: its 0.6 threshold was
// calibrated on clause ratios by the v55_g spike, and a normal proofread that touches most sentences
// would read as 0.67 at sentence granularity and trip the rewrite guard (false reject).
function qcSplitSentences(text) {
  const out = [];
  (text || '').split(/\n\n+/).forEach(para => {
    para.trim()
      .split(/(?<=[.!?][""»'\)\]]*)\s+/)   // after a sentence-ender (+ any closing quote/bracket)
      .map(s => s.trim()).filter(Boolean)
      .forEach(s => out.push(s));
  });
  return out;
}

// Changed sentence pairs, in order — the list the review checkboxes index into and the accept route
// reconstructs from. Same {ai, corrected} shape as storyDiffSentences; one side may be '' when a
// whole sentence was added or removed.
function qcDiffSentences(aiText, correctedText) {
  const aArr = qcSplitSentences(aiText), bArr = qcSplitSentences(correctedText);
  const m = aArr.length, n = bArr.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = aArr[i - 1] === bArr[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const ops = []; let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aArr[i - 1] === bArr[j - 1]) { ops.unshift({ t: 'eq' }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.unshift({ t: 'ins', c: bArr[j - 1] }); j--; }
    else { ops.unshift({ t: 'del', a: aArr[i - 1] }); i--; }
  }
  const pairs = []; let k = 0;
  while (k < ops.length) {
    if (ops[k].t === 'eq') { k++; continue; }
    const dels = [], ins = [];
    while (k < ops.length && ops[k].t !== 'eq') { ops[k].t === 'del' ? dels.push(ops[k].a) : ins.push(ops[k].c); k++; }
    const L = Math.max(dels.length, ins.length);
    for (let x = 0; x < L; x++) pairs.push({ ai: dels[x] || '', corrected: ins[x] || '' });
  }
  return pairs;
}

function _wordLev(a, b) {

  const wa = a.split(/\s+/), wb = b.split(/\s+/);
  const dp = Array.from({ length: wa.length + 1 }, (_, i) => { const r = new Array(wb.length + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= wb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= wa.length; i++) for (let j = 1; j <= wb.length; j++)
    dp[i][j] = wa[i - 1] === wb[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[wa.length][wb.length];
}

// Pure classifier — returns { verdict, changedSentences, totalSentences, changedRatio,
// wordEditRatio, rejected, changed }. Kept separate from the LLM call so unit-qc-correct drives it.
// Verdicts: clean / corrected / rewrite / corrupt. 'corrupt' catches a QC model that mangled the
// text mechanically rather than proofreading it — the v55_i case: qwen2.5:7b collapsed all spaces
// inside a quoted sentence, producing a 49-char run-together "word". Signal: the corrected text has
// a token far longer than any in the original, or lost a large fraction of its spaces. Both are
// rejected (never presented as an acceptable correction).
function _qcCorruption(original, corrected) {
  const tok = s => s.split(/\s+/).filter(Boolean);
  const maxLen = arr => arr.reduce((m, w) => Math.max(m, w.length), 0);
  const maxO = maxLen(tok(original)), maxC = maxLen(tok(corrected));
  // A run-together word: corrected's longest token is >1.5× the original's longest AND ≥25 chars
  // (avoids false positives on legit long words / compounds near the original's own maximum).
  const runTogether = maxC >= 25 && maxC > maxO * 1.5;
  // Wholesale space loss: corrected kept <60% of the original's spaces (interior whitespace should
  // be preserved by a proofread; a big drop means spaces were eaten).
  const spO = (original.match(/ /g) || []).length, spC = (corrected.match(/ /g) || []).length;
  const spaceLoss = spO >= 10 && spC < spO * 0.6;
  return runTogether || spaceLoss;
}

function classifyStoryQc(original, corrected) {
  const changed = storyDiffSentences(original, corrected);
  const total = splitSentences(original).filter(s => typeof s === 'string').length;
  const changedRatio = total ? changed.length / total : 0;
  const words = original.split(/\s+/).filter(Boolean).length;
  const wordEditRatio = words ? _wordLev(original, corrected) / words : 0;
  let verdict;
  if (changed.length === 0) verdict = 'clean';
  else if (_qcCorruption(original, corrected)) verdict = 'corrupt';  // mangled text, not a proofread
  else if (changedRatio > QC_MAX_CHANGED_RATIO || wordEditRatio > QC_MAX_WORD_EDIT_RATIO) verdict = 'rewrite';
  else verdict = 'corrected';
  return {
    verdict, rejected: verdict === 'rewrite' || verdict === 'corrupt',
    changedSentences: changed.length, totalSentences: total,
    changedRatio: +changedRatio.toFixed(3), wordEditRatio: +wordEditRatio.toFixed(3),
    changed,
  };
}

// Run the QC model over a story. Returns { corrected, story, ...classifier, meta }. Never mutates
// anything — the caller decides whether to store the proposal. `story` echoes the original so the
// client can diff without re-fetching. think:false (v55_c) — proofreading is not a reasoning task.
async function generateStoryQc(story, lang, script) {
  if (!story || !story.trim()) throw new Error('QC: empty story');
  const L = langName(lang, script || null);
  const _t0 = Date.now();
  console.log(`\n── Story QC ─────────────────────────────────────────`);
  console.log(`  Lang: ${L}, Model: ${OLLAMA_QC_MODEL}, ${story.length} chars`);
  // v79_f: QC returns a CORRECTED COPY of the story, so it emits target-language text like any
  // generator — and a proofreader that silently transliterates is the worst version of this bug,
  // because the chapter it rewrites was already right.
  const sys = fillPrompt(PROMPTS.storyQc.system, { L }) + scriptPinNote(lang, script || null, 'story QC prompt');
  const { text, promptTokens, completionTokens } = await callLLMQC(sys, story,
    Math.min(4096, Math.ceil(story.length * 1.3)), { think: false });
  const corrected = stripRaw(text).trim();  // stripRaw already strips <think> internally
  console.log(`  Response : after ${((Date.now() - _t0) / 1000).toFixed(0)}s (${completionTokens || '?'} tok)`);
  if (!corrected) throw new Error('QC: model returned empty correction');
  const c = classifyStoryQc(story, corrected);
  console.log(`  Verdict  : ${c.verdict} (${c.changedSentences}/${c.totalSentences} sentences, wordΔ ${c.wordEditRatio})`);
  console.log('────────────────────────────────────────────────────\n');
  const meta = buildGenMeta({ type: 'story_qc', model: OLLAMA_QC_MODEL, t0: _t0,
    valid: c.rejected ? 0 : 1, promptTokens, completionTokens });
  meta.verdict = c.verdict;
  meta.changedRatio = c.changedRatio;
  meta.wordEditRatio = c.wordEditRatio;
  return { corrected, story, verdict: c.verdict, rejected: c.rejected,
    changedSentences: c.changedSentences, totalSentences: c.totalSentences,
    changedRatio: c.changedRatio, wordEditRatio: c.wordEditRatio, meta };
}

// Summary QC (v55_n): the storyline-summary counterpart of generateStoryQc. Same proofread prompt,
// same classifier/guard (clean/corrected/rewrite/corrupt), same proposal shape — but there is NO
// ai_error_hunt (a summary isn't drill text), so acceptance simply writes sl.summary. The summary is
// in the SOURCE language, so QC runs in srcLang. think:false (v55_c).
async function generateSummaryQc(summary, srcLang) {
  if (!summary || !summary.trim()) throw new Error('QC: empty summary');
  const L = langName(srcLang || 'en');
  const _t0 = Date.now();
  console.log(`\n── Summary QC ───────────────────────────────────────`);
  console.log(`  Lang: ${L}, Model: ${OLLAMA_QC_MODEL}, ${summary.length} chars`);
  const sys = fillPrompt(PROMPTS.storyQc.system, { L });  // same proofreading prompt (text-agnostic)
  const { text, promptTokens, completionTokens } = await callLLMQC(sys, summary,
    Math.min(2048, Math.ceil(summary.length * 1.3)), { think: false });
  const corrected = stripRaw(text).trim();
  console.log(`  Response : after ${((Date.now() - _t0) / 1000).toFixed(0)}s (${completionTokens || '?'} tok)`);
  if (!corrected) throw new Error('QC: model returned empty correction');
  const c = classifyStoryQc(summary, corrected);
  console.log(`  Verdict  : ${c.verdict} (${c.changedSentences}/${c.totalSentences} sentences, wordΔ ${c.wordEditRatio})`);
  console.log('────────────────────────────────────────────────────\n');
  const meta = buildGenMeta({ type: 'summary_qc', model: OLLAMA_QC_MODEL, t0: _t0,
    valid: c.rejected ? 0 : 1, promptTokens, completionTokens });
  meta.verdict = c.verdict; meta.changedRatio = c.changedRatio; meta.wordEditRatio = c.wordEditRatio;
  return { corrected, summary, verdict: c.verdict, rejected: c.rejected,
    changedSentences: c.changedSentences, totalSentences: c.totalSentences,
    changedRatio: c.changedRatio, wordEditRatio: c.wordEditRatio, meta };
}

async function _runQc(jobId, topics, opts) {
  const { lessonIdx, onlyFlagged, force, includeStory = true } = opts;
  let checked = 0, flagged = 0, cleared = 0, skipped = 0;
  let storyProposed = 0, storyClean = 0;
  const affected = [];
  // v72: built once per run from the ENTIRE store, not just the topics in scope — the accented
  // form that proves `naturliche` is a typo may well live in another chapter. Deterministic and
  // cheap, so it costs nothing to widen. Guarded: a failure here must not abort a QC run whose
  // main job is the model checks.
  let _diacIdx = null;
  try { _diacIdx = buildDiacriticIndex(store.schemaVersion >= 29 ? store.topics : store.lessons); }
  catch (e) { console.warn(`  QC: diacritic index unavailable (${e.message}) — skipping that check`); }
  console.log(`  ⚙ QC starting: ${topics.length} topic(s)${lessonIdx !== null ? `, lesson ${lessonIdx}` : ''}${onlyFlagged ? ', flagged-only' : ''} [${OLLAMA_QC_MODEL}]`);
  jobStep(jobId, `[${OLLAMA_QC_MODEL}] Starting QC…`);
  for (let ti = 0; ti < topics.length; ti++) {
    const tp = topics[ti];
    const lessons = tp.lessons || [];
    let touched = false;
    // v73_j — DO NOT WRITE THROUGH THE CAPTURED REFERENCES.
    //
    // A QC pass is minutes long and full of awaits. Between them the editor can save the chapter,
    // and that save REPLACES the lesson and item objects (`saved.lessons = lessons.map(...)`,
    // building fresh objects via mergeFlaggable). The references captured above then point into an
    // orphaned array: QC keeps writing flags to objects that are no longer in `store`, and
    // `saveStore` serialises the new ones. The findings vanish silently.
    //
    // Observed, not theorised. A user's run reported 9 flags across two chapters and 5 survived:
    // `Kälte und Paella` was edited WHILE QC was inside it and lost all 4 of its flags — including
    // two raised AFTER the edit, because once the reference is orphaned everything the rest of that
    // topic writes is lost. `Churros und Chaos` was edited just BEFORE QC reached it, so QC captured
    // the fresh array and kept all 5. The chapter that lost everything still carried
    // `tokensByType.lesson_qc: 4935` — token accounting is written to the TOPIC, which the editor
    // mutates in place, so it survived while everything below the topic did not. That asymmetry is
    // the fingerprint.
    //
    // The fix is to treat the store as the only truth and re-resolve by id at every write. Ids are
    // stable across the editor's merge (it matches `origLessons.find(ls => ls.id === edited.id)`),
    // and items keep their index (`edited.vocab.map((v, j) => mergeFlaggable(orig.vocab[j], v))`),
    // so id + index is a durable locator where an object reference is not.
    const _tpId = tp.id;
    const _liveTopic = () =>
      (_tpId && (store.topics || []).find(x => x && x.id === _tpId)) || tp;
    // v59: meter EVERY per-item QC call for this topic in one scope (the checkers discard
    // token counts internally; the _callLLM meter catches them all) and fold the total into
    // the chapter's cumulative stats. Nonzero tokens mark the topic touched so the
    // accumulation is PERSISTED even when every item came back clean.
    const { tokens: _lqTok } = await meterLLMTokens(async () => {
      for (let li = 0; li < lessons.length; li++) {
        if (lessonIdx !== null && li !== lessonIdx) continue;
        const ls = lessons[li];
        const _lsId = ls && ls.id;
        // Falls back to the captured object only when the lesson is genuinely gone from the store
        // (deleted mid-pass). There is then nowhere to write and the orphan write is inert, but it
        // keeps the pass from throwing halfway through a chapter.
        const _liveLesson = () => {
          const t = _liveTopic();
          const arr = (t && t.lessons) || [];
          return (_lsId && arr.find(x => x && x.id === _lsId)) || arr[li] || ls;
        };
        if (onlyFlagged && !_qcLessonUserFlagged(tp, ls)) continue;
        // Skip lessons already cleared by a prior full QC pass and untouched since. `ls.qcAt`
        // is stamped at the end of a clean full pass below and cleared on any content edit
        // (see _clearLessonQcStamp, called from the edit/save-story paths), so its mere
        // presence means "unchanged since last QC". Only applies to bulk (storyline/chapter)
        // runs: an explicit single-lesson request (lessonIdx set) or a flagged-only run always
        // re-checks, so the user can force a re-QC. This is what keeps storyline-/chapter-level
        // jobs from re-paying for lessons that already passed.
        // Skip only if the SAME model already cleanly passed this (unedited) lesson — a DIFFERENT QC
        // model must still run so its verdicts can be collected for comparison.
        if (lessonIdx === null && !onlyFlagged && !force && ls.qcAt && ls.qcBy === OLLAMA_QC_MODEL) {
          skipped++;
          console.log(`    ⏭ skip "${ls.title || ls.type}" (QC'd ${ls.qcAt}, unedited)`);
          continue;
        }
        const _flaggedBefore = flagged;
        // Per-item QC helper: run a checker; collect the verdict PER MODEL in item.qcByModel so
        // different QC models can be compared on the same item, while keeping item.qc as the primary
        // (backward-compatible: apply/dismiss/badges/render read item.qc). A model only ever overwrites
        // its OWN entry; a model that now says OK drops only its own flag, leaving others' for compare.
        // v72: `by` names the CHECKER, defaulting to the QC model. The deterministic diacritic
        // pass supplies its own identity, so its findings live beside the model's in `qcByModel`
        // and are cleared independently — a model saying "OK" must not silently erase a mechanical
        // finding, and vice versa. The multi-checker shape already existed for comparing models.
        // `locate(liveLesson)` returns the live counterpart of `item` — see the v73_j note above.
        // The runner still reads the CAPTURED item (its content is what was checked); only the
        // WRITE is redirected to the live object, which is the whole point.
        const _check = async (item, runner, label, by, locate) => {
          checked++;
          let res;
          try { res = await runner(); } catch (e) { return; }
          const model = by || OLLAMA_QC_MODEL;
          // v73_j: resolve AFTER the await. Between the call and here the chapter may have been
          // saved, replacing every item object in it.
          const _live = (locate && locate(_liveLesson())) || item;
          if (_live !== item) console.log(`    ↻ QC re-resolved an item edited mid-pass`);
          item = _live;
          // Migrate a pre-collect single flag into the per-model map so it isn't lost.
          if (item.qc && !item.qcByModel && item.qc.by)
            item.qcByModel = { [item.qc.by]: { sug: item.qc.sug, field: item.qc.field, at: item.qc.at } };
          const hadThisModel = !!(item.qcByModel && item.qcByModel[model]);
          if (res && !res.ok) {
            (item.qcByModel || (item.qcByModel = {}))[model] = { sug: res.sug, field: res.field || 'note', at: new Date().toISOString() };
            item.qc = { ...item.qcByModel[model], by: model };   // primary = this latest flag
            if (!hadThisModel) flagged++;
            touched = true;
            console.log(`    ⚑ flag [${label}] [${model}] "${(res.sug||'').slice(0,60)}"`);
          } else {
            // This model says OK → drop only ITS flag; keep other models' flags for comparison.
            if (hadThisModel) { delete item.qcByModel[model]; cleared++; touched = true; }
            const remaining = item.qcByModel ? Object.keys(item.qcByModel) : [];
            if (remaining.length) {
              const m = remaining[remaining.length - 1];
              item.qc = { ...item.qcByModel[m], by: m };          // primary = another model's open flag
            } else {
              if (item.qc) touched = true;
              delete item.qc; if (item.qcByModel) delete item.qcByModel;
            }
          }
          if (checked % 5 === 0)
            jobStep(jobId, `[${model}] QC ${_liveTopic().topic} — ${checked} checked, ${flagged} flagged…`);
        };
        // Dispatch by lesson type. vocab/sentences exist on standard lessons; word_forms AND
        // inflections both use `items` (the array name is shared, the shape is not — word_forms is
        // a cloze pair, inflections is a lemma+form pair, hence two separate checkers); synonyms
        // uses `words` (related-word sets); grammar uses `grammar` (noun target/source +
        // article/plural); conjugation uses `conjugations` (infinitive + source translation).
        // intro_script is curated data (human QC only); math and the two error-hunt types are
        // intentionally out of scope. Anything else falls through to the generic vocab/sentences scan.
        let _lessonQcRan = true;
        if (ls.type === 'word_forms') {
          for (let _i = 0; _i < (ls.items || []).length; _i++) {
            const item = ls.items[_i];
            if (!item || !item.sentence) continue;
            await _check(item, () => qcCheckCloze(item, tp.lang, tp.srcLang, item.userFlag?.comment), 'cloze',
                         undefined, (L) => (L.items || [])[_i]);
          }
        } else if (ls.type === 'inflections') {
          for (let _i = 0; _i < (ls.items || []).length; _i++) {
            const item = ls.items[_i];
            if (!item || !item.sentence) continue;
            await _check(item, () => qcCheckInflection(item, tp.lang, tp.srcLang, item.userFlag?.comment), 'inflection',
                         undefined, (L) => (L.items || [])[_i]);
          }
        } else if (ls.type === 'synonyms') {
          for (let _i = 0; _i < (ls.words || []).length; _i++) {
            const entry = ls.words[_i];
            if (!entry || !entry.base) continue;
            await _check(entry, () => qcCheckSynonymSet(entry, tp.lang, tp.srcLang, entry.userFlag?.comment), 'synset',
                         undefined, (L) => (L.words || [])[_i]);
          }
        } else if (ls.type === 'grammar') {
          // Grammar lessons teach a noun with its article/plural; the target↔source translation
          // is the checkable pair (article/plural correctness is a separate, morphology-specific
          // check left for a future dedicated prompt).
          for (let _i = 0; _i < (ls.grammar || []).length; _i++) {
            const g = ls.grammar[_i];
            if (!g || !g.target || !g.source) continue;
            await _check(g, () => qcCheckPair(g.target, g.source, tp.lang, tp.srcLang, g.userFlag?.comment), 'grammar',
                         undefined, (L) => (L.grammar || [])[_i]);
          }
        } else if (ls.type === 'conjugation') {
          // Conjugation lessons carry an infinitive (target verb) + its source translation; QC the
          // translation pair. The per-form morphology is grammatical, not a translation, so it's
          // out of scope here (a dedicated conjugation-correctness prompt is future work).
          for (let _i = 0; _i < (ls.conjugations || []).length; _i++) {
            const c = ls.conjugations[_i];
            if (!c || !c.infinitive || !c.source) continue;
            await _check(c, () => qcCheckPair(c.infinitive, c.source, tp.lang, tp.srcLang, c.userFlag?.comment), 'conjug',
                         undefined, (L) => (L.conjugations || [])[_i]);
          }
        } else if (ls.type === 'intro_script') {
          // curated letter table — verified by humans (per-letter flag/star/edit), not the LLM.
          _lessonQcRan = false;
        } else if (ls.type === 'math' || ls.type === 'error_hunt' || ls.type === 'ai_error_hunt' || ls.type === 'mixed'
                   || ls.type === 'comprehension') {
          // Out of scope: math is procedural, error-hunt correctness is intrinsic to its own
          // story, and mixed lessons own no items (they pool from their source lessons, which are
          // QC'd in place). Don't stamp — nothing was examined.
          //
          // v73_k — `comprehension` added, and it is a GAP being made honest, not a judgement that
          // the type is unqualifiable. It carries `questions`, not vocab/sentences, so it fell to
          // the generic scan below, which found nothing to check. `_lessonQcRan` therefore stayed
          // true, `flagged === _flaggedBefore` held trivially, and the lesson was STAMPED CLEAN
          // having been examined by nothing. Worse than uncovered: the stamp makes every later bulk
          // run skip it (see the `ls.qcAt && ls.qcBy === OLLAMA_QC_MODEL` skip above), so a
          // comprehension lesson was marked QC-clean for good, unread.
          //
          // Observed in a user's run: the comprehension lesson of "Churros und Chaos" carries
          // `qcAt` and `qcBy: translategemma:12b` with no checker having touched it.
          //
          // A real checker belongs here eventually — "does each question follow from the story, and
          // are its distractors defensible?" is exactly what QC is for, and it is the one part of
          // v71_l no headless test can reach. That needs a new prompt and a live model, so it is
          // queued rather than guessed at. Until then, "not checked" is the honest stamp.
          _lessonQcRan = false;
        } else {
          for (const key of ['vocab', 'sentences']) {
            const arr = ls[key];
            if (!Array.isArray(arr)) continue;
            const lessonIsDialect = !!ls._dialect;
            for (let _i = 0; _i < arr.length; _i++) {
              const item = arr[_i];
              // v73_j: same array KEY and same INDEX in the live lesson. The editor's merge is
              // index-aligned (`edited.vocab.map((v, j) => mergeFlaggable(orig.vocab[j], v))`), so
              // this survives a save that rebuilt every object in the chapter.
              const _at = (L) => (L[key] || [])[_i];
              if (!item || !item.target || !item.source) continue;
              // Dialect items get sourceOnly QC (verify gloss, never rewrite the dialect token) —
              // EXCEPT aiGenerated example sentences: the model authored those, so the dialect side is
              // NOT ground truth and must be checked too (full pair QC).
              if ((lessonIsDialect || item._dialect) && !item.aiGenerated) {
                await _check(item, () => qcCheckDialectPair(item.target, item.source, tp.lang, tp.srcLang, item.userFlag?.comment), 'pair', undefined, _at);
              } else {
                await _check(item, () => qcCheckPair(item.target, item.source, tp.lang, tp.srcLang, item.userFlag?.comment, arr), 'pair', undefined, _at);
              }
              // v72: deterministic, no model call. Runs for every item including dialect ones —
              // a missing diacritic is a spelling fact, not a translation judgement.
              if (_diacIdx) {
                await _check(item, async () => {
                  for (const [field, word, lg] of [['target', item.target, tp.lang],
                                                   ['source', item.source, tp.srcLang]]) {
                    const c = checkDiacritics(word, lg, _diacIdx);
                    if (c.ok) continue;
                    // A candidate, not a verdict — the model decides typo vs. distinct word.
                    const v = await qcCheckDiacriticCandidate(String(word).trim(), c.sug, lg);
                    if (!v.ok) return { ok: false, field, sug: v.sug };
                  }
                  return { ok: true };
                }, 'diacritic', QC_DIACRITIC_BY, _at);
              }
            }
          }
        }
        // Stamp a full (not flagged-only) pass that left the lesson clean, so future bulk runs
        // skip it. Only when this pass actually ran a checker for the lesson (intro_script is
        // human-QC'd, never stamped) and produced no new flags for it. A flagged-only pass must
        // NOT stamp — it didn't examine the whole lesson.
        if (!onlyFlagged && _lessonQcRan && flagged === _flaggedBefore && !_lessonHasOpenQcFlag(_liveLesson())) {
          // v73_j: stamp the LIVE lesson, and read the open-flag test from it too — the flags this
          // pass just wrote live there, not on the captured object.
          const _lsLive = _liveLesson();
          _lsLive.qcAt = new Date().toISOString(); _lsLive.qcBy = OLLAMA_QC_MODEL; touched = true;
        }
      }

      // Story QC (v55_k): in a full sweep (not flagged-only, not a single-lesson request), also
      // proofread the chapter's STORY and ACCUMULATE the proposal on the topic — the user reviews
      // each on its story screen (the panel auto-opens there). This is the bulk counterpart to the
      // per-story 🔍. Guarded by:
      //   • includeStory (opts) — on by default for full sweeps; a caller can turn it off.
      //   • skip if this QC model already checked this (unedited) story — storyQcCheckedBy/At, the
      //     story analogue of a lesson's qcAt (cleared on story edit). `force` re-checks.
      //   • never runs for a flagged-only or single-lesson (lessonIdx) request.
      // Proposals are stored for corrected AND rewrite/corrupt (so the story screen can warn); a
      // clean story stores no proposal, only the checked stamp. Any pre-existing UNREVIEWED proposal
      // is left untouched when we skip, so accumulated proposals survive re-sweeps.
    });
    if (_lqTok.promptTokens + _lqTok.completionTokens > 0) { addTokenUsage(_liveTopic(), _lqTok, 'lesson_qc'); touched = true; }

    if (includeStory && !onlyFlagged && lessonIdx === null && tp.story && tp.story.trim()) {
      const alreadyChecked = tp.storyQcCheckedBy === OLLAMA_QC_MODEL && tp.storyQcCheckedAt && !force;
      if (alreadyChecked) {
        console.log(`    ⏭ skip story "${tp.topic}" (QC'd ${tp.storyQcCheckedAt}, unedited)`);
      } else {
        jobStep(jobId, `[${OLLAMA_QC_MODEL}] Proofreading story: ${tp.topic}…`);
        try {
          const { result: qr, tokens: _sqTok } = await meterLLMTokens(() => generateStoryQc(tp.story, tp.lang || 'it', tp.script || null));
          addTokenUsage(tp, _sqTok, 'story_qc');
          tp.storyQcCheckedBy = OLLAMA_QC_MODEL;
          tp.storyQcCheckedAt = new Date().toISOString();
          if (qr.verdict === 'clean') {
            if (tp.storyQcProposal) { delete tp.storyQcProposal; }  // a prior proposal no longer applies
            storyClean++;
          } else {
            tp.storyQcProposal = { corrected: qr.corrected, against: tp.story, verdict: qr.verdict,
              rejected: qr.rejected, changedSentences: qr.changedSentences, totalSentences: qr.totalSentences,
              changedRatio: qr.changedRatio, wordEditRatio: qr.wordEditRatio, meta: qr.meta,
              at: new Date().toISOString() };
            storyProposed++;
            console.log(`    📝 story proposal [${qr.verdict}] "${tp.topic}" (${qr.changedSentences}/${qr.totalSentences})`);
          }
          touched = true;
        } catch(e) {
          console.warn(`    ⚠ story QC failed for "${tp.topic}": ${e.message}`);
        }
      }
    }

    // v73_j: upsert the LIVE topic. Upserting the captured one would write a shallow copy of a
    // stale object back over the store — losing the user's concurrent edit instead of QC's flags,
    // which is the same bug pointing the other way.
    if (touched) { upsert(_liveTopic()); affected.push(_tpId); }
  }
  jobDone(jobId, { checked, flagged, cleared, skipped, storyProposed, storyClean, topics: topics.length, affected });
  console.log(`  ✓ QC done: ${checked} checked, ${flagged} flagged, ${cleared} cleared, ${skipped} skipped, story: ${storyProposed} proposed / ${storyClean} clean, across ${topics.length} topic(s)`);
}
// True if any item in the lesson still carries an open QC suggestion (item.qc). Used to
// decide whether a just-completed full pass may stamp the lesson as clean.
function _lessonHasOpenQcFlag(ls) {
  const arrays = [ls.vocab, ls.sentences, ls.items, ls.words, ls.grammar, ls.conjugations];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.some(x => x && x.qc)) return true;
  }
  return false;
}
// Clear the "QC'd & clean" stamp on a lesson (call whenever its content changes, so the next
// bulk QC re-checks it). Returns true if a stamp was actually removed.
function _clearLessonQcStamp(ls) {
  if (ls && ls.qcAt !== undefined) { delete ls.qcAt; return true; }
  return false;
}
// A stable string signature of a lesson's QC-relevant CONTENT — exactly the fields the
// checkers read (vocab/sentence target+source, cloze sentence+blank, synonym base+related,
// and the story fields error-hunt derives from). Deliberately excludes flag/rating/qc/qcAt
// and presentation-only fields (title, icon, _hidden), so a pure flag clear or a rename does
// NOT invalidate a prior clean QC pass, while any change to checkable text does.
function qcSignature(ls) {
  if (!ls) return '';
  const parts = [ls.type || ''];
  for (const it of (ls.vocab || []))     parts.push('v', it && it.target, it && it.source);
  for (const it of (ls.sentences || [])) parts.push('s', it && it.target, it && it.source);
  for (const it of (ls.items || []))     parts.push('i', it && it.sentence, it && it.blank, it && it.answer);
  for (const w of (ls.words || []))      parts.push('w', w && w.base, Array.isArray(w && w.related) ? w.related.join('|') : (w && w.related));
  for (const g of (ls.grammar || []))    parts.push('g', g && g.target, g && g.source, g && g.article, g && g.plural);
  for (const c of (ls.conjugations || [])) parts.push('c', c && c.infinitive, c && c.source);
  // error-hunt / ai-error-hunt derive from these:
  parts.push('cs', ls.corruptedStory || '', ls.correctStory || '', ls.aiStory || '');
  return parts.map(x => (x == null ? '' : String(x))).join('\u0001');
}
// Legacy user-flags-as-filter: a lesson counts as flagged if any of its items'
// targets appear in the stored flags for this topic. Conservative best-effort.
function _qcLessonUserFlagged(tp, ls) {
  // Modern flags live directly on each item as item.userFlag ({comment, at}). Check every
  // array a checker would visit, so flagged-only QC covers word_forms (items) and synonyms
  // (words), not just vocab/sentences.
  const arrays = [ls.vocab, ls.sentences, ls.grammar, ls.conjugations, ls.items, ls.words];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.some(x => x && x.userFlag)) return true;
  }
  // Legacy fallback: the old global flags registry keyed by target text.
  const flags = getFlags();
  const keys = Object.keys(flags);
  if (keys.length) {
    const targets = [...(ls.vocab||[]), ...(ls.sentences||[]), ...(ls.grammar||[])]
      .map(x => (x && x.target ? String(x.target).toLowerCase() : '')).filter(Boolean);
    if (keys.some(k => targets.some(tg => k.toLowerCase().includes(tg)))) return true;
  }
  return false;
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

// Language pairs close enough that many vocab items legitimately share the SAME spelling across
// source and target (cognates), so the "identical source/target" heuristic in generateOneLesson
// would false-positive. For these pairs we log identical items but don't block. Dialects
// (lang === srcLang, e.g. an East-Tyrolean de/de topic) are always treated as close.
// Order-independent; extend this list as needed.
//
// NOTE (v53_c): this list is the ONLY place language "similarity" is recorded — there is no
// similarity field in languages.json. The comparison is case-insensitive + trimmed.
//
// STALE UNTIL v73_c — read this before acting on the paragraph below. The count threshold it
// describes was REPLACED in v53_g by a ratio rule, live at IDENTICAL_MIN_RATIO (~line 4237):
// a lesson is rejected only at >=3 identical items AND >=60% of the lesson. The analysis below is
// kept because it is why the ratio rule exists, but it is history, not a proposal — it was left
// reading as open work for twenty releases. See build_history/future_development.md section 5.
//
// (historical) The old rule blocked at >2 identical vocab items (or >1 sentence) in a single
// lesson. That COUNT threshold conflated two different things, measured against the real corpus:
//   • a genuine model failure — the model wrote the source language into both fields (100% of items
//     identical: an lb→en "History of Luxembourg" lesson, an it→en "Grandmas Doughs" lesson);
//   • legitimate loanwords / proper nouns, which occur in EVERY pair regardless of closeness
//     (38%: "pasta, tagliatelle, risotto"; "café, fans, notes"; "Champagne, Terroir").
// A ratio threshold separates them, and is what now runs (see above). Closeness remains a second
// lever, so keep this list conservative: relaxing a pair also disables the check that catches real
// model failures for it. Whether this table belongs in languages.json was open in roadmap_v54 and
// v65 and then dropped out — but note INTERNALS.md's four-tier ruling: moving a hand-authored table
// to a file is not progress on its own, because the cost is in authorship, not location.
const CLOSE_LANG_PAIRS = [
  ['de','lb'],   // German ↔ Lëtzebuergesch
  ['de','nl'],   // German ↔ Dutch — West Germanic; arm/hand/winter/warm/water… collide once
                 // lowercased, so a de↔nl vocab lesson trips the >2 rule on cognates alone.
  ['de','nds'],  // German ↔ Low German
  ['de','bar'],  // German ↔ Bavarian
  ['nl','af'],   // Dutch ↔ Afrikaans
  ['nb','nn'], ['da','nb'], ['da','nn'], ['nb','sv'], ['da','sv'],  // mainland Scandinavian
  ['cs','sk'],   // Czech ↔ Slovak
  ['hr','sr'], ['bs','hr'], ['bs','sr'],  // BCMS
  ['ru','uk'], ['ru','be'], ['uk','be'],  // East Slavic
  ['id','ms'],   // Indonesian ↔ Malay
  ['es','gl'], ['es','ca'], ['es','pt'],  // Iberian Romance
];
function isCloseLangPair(lang, srcLang) {
  if (!lang || !srcLang) return false;
  if (lang === srcLang) return true;   // dialect topics (de/de, etc.)
  return CLOSE_LANG_PAIRS.some(([a, b]) => (a === lang && b === srcLang) || (a === srcLang && b === lang));
}

// Tokenise a Japanese/Chinese sentence into meaningful word-sized chunks.
// Handles the kanji[よみ] annotation format used in lessons.
// Each kanji+reading group → one token; runs of kana/latin between them → split on 2-char chunks.
// Tokenise a Japanese sentence into word-sized chunks, keeping each furigana-annotated
// group BASE[reading] (BASE = kanji or katakana) intact as one token. Protect-and-restore:
// annotated groups are swapped for sentinels first, so a katakana group that follows a
// hiragana run (大好[だいす]きなボール[ぼーる]) can't be merged into the kana run. Mirrored
// verbatim on the client (mkOrder) so both sides split identically.
function jaTokenize(raw) {
  const groups = [];
  // \uE000-\uF8FF is the Unicode Private Use Area — safe sentinels that never occur in text.
  const protectedStr = String(raw || '').replace(
    /[\u4e00-\u9fff\u3400-\u4dbf々〆〇\u30a0-\u30ff]+\[[^\]]+\]/g,
    (g) => { const i = groups.push(g) - 1; return '\uE000' + i + '\uE001'; });
  const re = /\uE000\d+\uE001|[\u3040-\u30ff\uff00-\uffef\u0021-\u007ea-zA-Z0-9]+|[\u4e00-\u9fff\u3400-\u4dbf々〆〇]+/g;
  const tokens = [];
  let m;
  while ((m = re.exec(protectedStr)) !== null) {
    let tok = m[0];
    const sm = /^\uE000(\d+)\uE001$/.exec(tok);
    if (sm) tok = groups[+sm[1]];
    if (tok.length > 0) tokens.push(tok);
  }
  return tokens;
}

function deriveSentenceWords(s, lang) {
  if (lang && CJK_LANGS.has(lang)) {
    if (lang === 'ja') {
      const tokens = jaTokenize(s.target);
      // If too many tokens, merge adjacent runs pairwise
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
// Difficulty-tiered furigana density, RESTORED (found dead since ~v40 at v82_c, flagged rather than
// fixed there as separate scoped work). `sysStory` used to take a `difficulty` parameter and select
// among `furiganaNote1/2/3` (beginner: every kanji without exception / standard / advanced: only
// rare kanji); the current signature dropped it somewhere along the way and every story fell back to
// the flat `furiganaNote`, regardless of the chapter's actual difficulty. `furiganaNote1/2/3` shared
// the flat note's own pre-v82_c weakness (no "mandatory for the whole story" language, no worked
// example — the exact gap that let the model echo its example once near the end instead of applying
// it throughout), fixed here the same way for all three, not just restoring the selection. An
// unrecognised/missing difficulty falls back to the flat note, so a caller that forgets to pass one
// degrades to the pre-restoration behaviour rather than throwing.
function _furiganaNoteFor(P, difficulty) {
  if (difficulty === 1) return P.furiganaNote1;
  if (difficulty === 3) return P.furiganaNote3;
  if (difficulty === 2) return P.furiganaNote2;
  return P.furiganaNote;
}
function sysStory(lang, isContinuation, wordCount, dialect, writingStyle, script, difficulty) {
  const L = langName(lang, script);
  const wc = Math.max(100, Math.min(1000, wordCount || 300));
  const paraLo = Math.max(1, Math.floor(wc / 100));
  const paraHi = paraLo + 1;
  const P = PROMPTS.story;
  let sys = fillPrompt(P.system, { L, wc, paraLo, paraHi });
  // v76_h: naming the script in {L} is not enough on its own — the model still drifts between
  // scripts inside one text. State it as a rule too, but ONLY when the language really has a
  // choice, so nothing is added for the 31 languages that do not.
  // v79_f: this was an inline COPY of scriptPinNote, written first and left behind when the helper
  // was extracted for the vocabulary prompts. Two copies of one rule is how the lesson prompts came
  // to have a weaker version of it than the story prompt, so there is now one.
  sys += scriptPinNote(lang, script, 'story prompt');
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (lang === 'ja')              sys += _furiganaNoteFor(P, difficulty);
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  if (isContinuation)             sys += P.continuationNote;
  return sys;
}

// ── Error-hunt lesson prompt ─────────────────────────────────────────
// How many errors the prompt asks for. Shared with the validator below so the two cannot drift —
// validating against a different number than we requested would reject good output (v69_g).
function errorHuntCounts(difficulty) {
  return { nSpell: difficulty >= 3 ? 4 : 3, nGrammar: difficulty >= 2 ? 3 : 2 };
}
function sysErrorHunt(lang, difficulty, script) {
  const L = langName(lang, script);
  const { nSpell, nGrammar } = errorHuntCounts(difficulty);
  // v79_f: naming the script inside {L} is NOT the pin — that is precisely what v76_h established
  // and what this call site still assumed. The corrupted story must come back in the same script it
  // went out in, or the learner is hunting errors in an alphabet the chapter never used.
  return fillPrompt(PROMPTS.errorHunt.system, { L, nSpell, nGrammar }) + scriptPinNote(lang, script, 'error-hunt prompt');
}

// Word-level comparison of the corrupted story against the original.
// The exercise only works if the model SUBSTITUTED words in place: the learner taps a suspect word,
// and the client pairs tokens by position. The prompt already demands "copy all other text EXACTLY"
// and "change only a single complete word per error", so the word COUNT must be unchanged — a
// different count means the model rephrased, which yields a nonsense exercise. Returns
// { aligned, changed }: aligned=false ⇒ rewritten, changed = how many single words differ.
function errorHuntChanges(original, corrupted) {
  const A = String(original || '').trim().split(/\s+/).filter(Boolean);
  const B = String(corrupted || '').trim().split(/\s+/).filter(Boolean);
  if (!A.length || A.length !== B.length) return { aligned: false, changed: 0, words: A.length };
  let changed = 0;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) changed++;
  return { aligned: true, changed, words: A.length };
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
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 80, { think: false });   // v65.1
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
  const _t0 = Date.now();
  console.log(`\n── Storyline summary generation ─────────────────────`);
  console.log(`  Chapters : ${topics.length}, Lang: ${S}, Model: ${OLLAMA_MODEL}`);
  const chapterSummaries = topics.map((t, i) =>
    `Chapter ${i+1}: "${t}"\n${(stories[i]||'').slice(0, 600).replace(/\n/g,' ')}…`
  ).join('\n\n');
  const vocabList = [...new Set(vocab)].slice(0, 40).join(', ');
  const sys = fillPrompt(PROMPTS.storylineSummary.system, { S });
  const user = fillPrompt(PROMPTS.storylineSummary.user, { chapterSummaries, vocabList, S });
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 400, { think: false });   // v65.1
  const summary = result.text.trim();
  console.log(`  Summary  : ${summary.slice(0,80)}…`);
  console.log('────────────────────────────────────────────────────\n');
  // Stamped like every lesson generator, so the storyline records WHICH model wrote its summary.
  // Returns an object; callers store `.text` on sl.summary (still a plain string) and `.meta` on
  // sl.summaryMeta. `String(result)` is deliberately NOT supported — a silent stringify would put
  // "[object Object]" into a user-visible field, so the two call sites are asserted in tests.
  const meta = buildGenMeta({
    type: 'storyline_summary', model: OLLAMA_MODEL, t0: _t0, valid: summary ? 1 : 0,
    promptTokens: result.promptTokens, completionTokens: result.completionTokens,
  });
  return { text: summary, meta };
}

// ── Storyline storyboard (v55) ────────────────────────────────────────────────
// The model is asked for a STRICT JSON array of 2–5 panels built from a whitelisted
// primitive vocabulary — NEVER raw SVG. This composer is the security boundary: it is the
// ONLY thing that turns model output into markup. Unknown shape types are DROPPED (never
// rendered raw), every coordinate is clamped into the 0 0 100 100 panel viewBox, colors
// resolve through a fixed named palette, path `d` is charset-whitelisted and length-capped,
// all text is escaped, and panels render inside nested <svg> elements (which also CLIP any
// overflow). No <script>, <foreignObject>, or href can be emitted. Caps: ≤12 panels (6 per
// row, so ≤2 rows), ≤25 shapes/panel; a panel with 0 valid shapes is invalid; <2 valid
// panels → svg:null.
// Self-contained on purpose (helpers nested) so unit-storyboard can extract and run it pure.
// Storyboard colour schemes (v55_r). The model only ever emits palette NAMES (paper/ink/sky/…), and
// the composer maps names → hex — so a "scheme" is just an alternative hex map for the SAME names.
// Two consequences worth knowing: the prompt needs no change, and re-theming an existing storyboard
// needs NO model call (re-compose the stored panels). Every scheme MUST define the same keys — the
// key set is the model's whitelisted colour vocabulary; `none` must stay 'none' everywhere.
const STORYBOARD_SCHEMES = {
  classic: { paper:'#faf7f0', ink:'#2b2b2b', accent:'#e07a5f', sky:'#a8dadc', water:'#457b9d',
             leaf:'#81b29a', sun:'#f2cc8f', earth:'#8d6e63', stone:'#9e9e9e', rose:'#e5989b',
             night:'#3d405b', white:'#ffffff', none:'none' },
  pastel:  { paper:'#fffdf7', ink:'#5b5b6b', accent:'#ffb5a7', sky:'#cdeffd', water:'#a8d8ea',
             leaf:'#b8e0d2', sun:'#ffe5a0', earth:'#d4b8a0', stone:'#d8d8e0', rose:'#ffc8dd',
             night:'#8f9bb3', white:'#ffffff', none:'none' },
  vivid:   { paper:'#fffef2', ink:'#1d1d1d', accent:'#ff5714', sky:'#4cc9f0', water:'#0077b6',
             leaf:'#2ec4b6', sun:'#ffd60a', earth:'#9c6644', stone:'#adb5bd', rose:'#ff477e',
             night:'#22223b', white:'#ffffff', none:'none' },
  // Dark scheme: `paper` is the dark ground and `ink` inverts to a light stroke so line art stays
  // visible on it (the model still just says "ink" / "paper").
  night:   { paper:'#1a1a24', ink:'#e8e8f0', accent:'#ff6b6b', sky:'#2d3a5c', water:'#1b263b',
             leaf:'#2f5d50', sun:'#d4a373', earth:'#3e2f2f', stone:'#5c5c66', rose:'#a4506a',
             night:'#0d0d14', white:'#f0f0f5', none:'none' },
  mono:    { paper:'#f5f5f2', ink:'#1f1f1f', accent:'#6b6b6b', sky:'#dcdcdc', water:'#9a9a9a',
             leaf:'#b0b0b0', sun:'#e6e6e6', earth:'#7a7a7a', stone:'#c4c4c4', rose:'#8a8a8a',
             night:'#3a3a3a', white:'#ffffff', none:'none' },
};
const STORYBOARD_SCHEME_DEFAULT = 'classic';

// `scheme` selects the palette; an unknown/absent name falls back to the default (never throws —
// the palette is still a closed whitelist, so the security properties are unchanged).
// `chapterCount` (v57, optional): number of chapters in the storyline. When given, each panel's
// model-supplied `chapter` field (1-based "this panel's scene belongs to chapter N") is sanitized —
// integer, clamped into 1..chapterCount, anything else dropped — and emitted as a data-chapter
// attribute on the panel's <g>, which is what makes panels deep-link to lesson sets. The attribute
// is OPTIONAL on purpose: panels without a valid value get the client-side equal-split fallback
// (see _sbPanelChapter in index.html), which is also how every pre-v57 board stays clickable.
function composeStoryboardSVG(panels, scheme, chapterCount) {
  // Own-property lookups ONLY. A plain-object map inherits from Object.prototype, so a bare
  // `MAP[k]` treats '__proto__' / 'constructor' / 'toString' as members: `SCHEMES['__proto__']`
  // is truthy (→ a bogus scheme passes validation and yields an all-undefined palette), and a
  // model emitting fill:"constructor" produced fill="function Object() { [native code] }".
  // Not escapable (no quotes in those values) but it breaks the closed-whitelist guarantee this
  // function exists to provide, so both lookups are hasOwnProperty-guarded. (v55_r; the hole
  // predates schemes — it was in the original palette lookup.)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const PALETTE = has(STORYBOARD_SCHEMES, scheme) ? STORYBOARD_SCHEMES[scheme]
                                                  : STORYBOARD_SCHEMES[STORYBOARD_SCHEME_DEFAULT];
  // v57 layout: 6 panels per row, hard cap 12 (two rows). MAX_PANELS is the composer's
  // SECURITY bound; the editorial budget (6 normally, 12 only for >10-chapter storylines)
  // is enforced in the PROMPT (generateStorylineStoryboard) — a model overshooting it is
  // harmless here (links simply repeat), but nothing beyond 12 ever renders.
  const MAX_PANELS = 12, PER_ROW = 6, MIN_PANELS = 2, MAX_SHAPES = 25, MAX_POINTS = 60, MAX_D = 500;
  const PANEL_PX = 170, GAP = 12;
  const D_RE = /^[MmLlHhVvZzCcSsQqTtAa0-9eE .,+-]+$/;
  function escXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function num(v, lo, hi, dflt) {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(lo, Math.min(hi, n));
  }
  function col(v, dflt) {
    const k = String(v == null ? '' : v).trim().toLowerCase();
    return has(PALETTE, k) ? PALETTE[k] : dflt;   // own-property only — see the `has` note above
  }
  function paintAttrs(s, dfltFill) {
    const fill   = col(s.fill, dfltFill);
    const stroke = col(s.stroke, 'none');
    const sw     = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
    const o      = num(s.o  != null ? s.o  : s.opacity, 0, 1, 1);
    let a = ` fill="${fill}"`;
    if (stroke !== 'none') a += ` stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
    if (o < 1) a += ` opacity="${o}"`;
    return a;
  }
  function pointsAttr(pts) {
    let flat = [];
    if (typeof pts === 'string') flat = pts.split(/[\s,]+/).map(Number);
    else if (Array.isArray(pts)) flat = pts.flat().map(Number);
    if (flat.length < 4 || flat.length % 2 !== 0 || flat.some(n => !Number.isFinite(n))) return null;
    flat = flat.slice(0, MAX_POINTS * 2).map(n => Math.max(0, Math.min(100, n)));
    const out = [];
    for (let i = 0; i < flat.length; i += 2) out.push(flat[i] + ',' + flat[i + 1]);
    return out.join(' ');
  }
  function shapeToSvg(s, drops) {
    if (!s || typeof s !== 'object') { drops.push('not-an-object'); return null; }
    const t = String(s.type || s.t || '').toLowerCase();
    switch (t) {
      case 'rect': {
        const x = num(s.x, 0, 100, null), y = num(s.y, 0, 100, null);
        const w = num(s.w != null ? s.w : s.width, 0, 100, null);
        const h = num(s.h != null ? s.h : s.height, 0, 100, null);
        if (x == null || y == null || !w || !h) { drops.push('rect: bad coords'); return null; }
        const rx = num(s.rx, 0, 50, 0);
        return `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''}${paintAttrs(s, PALETTE.ink)}/>`;
      }
      case 'circle': {
        const cx = num(s.cx, 0, 100, null), cy = num(s.cy, 0, 100, null), r = num(s.r, 0, 100, null);
        if (cx == null || cy == null || !r) { drops.push('circle: bad coords'); return null; }
        return `<circle cx="${cx}" cy="${cy}" r="${r}"${paintAttrs(s, PALETTE.ink)}/>`;
      }
      case 'ellipse': {
        const cx = num(s.cx, 0, 100, null), cy = num(s.cy, 0, 100, null);
        const rx = num(s.rx, 0, 100, null), ry = num(s.ry, 0, 100, null);
        if (cx == null || cy == null || !rx || !ry) { drops.push('ellipse: bad coords'); return null; }
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"${paintAttrs(s, PALETTE.ink)}/>`;
      }
      case 'line': {
        const x1 = num(s.x1, 0, 100, null), y1 = num(s.y1, 0, 100, null);
        const x2 = num(s.x2, 0, 100, null), y2 = num(s.y2, 0, 100, null);
        if ([x1, y1, x2, y2].some(v => v == null)) { drops.push('line: bad coords'); return null; }
        const stroke = col(s.stroke, PALETTE.ink);
        const sw = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }
      case 'polyline': {
        const p = pointsAttr(s.points);
        if (!p) { drops.push('polyline: bad points'); return null; }
        const stroke = col(s.stroke, PALETTE.ink);
        const sw = num(s.sw != null ? s.sw : s.strokeWidth, 0, 10, 1.5);
        return `<polyline points="${p}" fill="${col(s.fill, 'none')}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      case 'polygon': {
        const p = pointsAttr(s.points);
        if (!p) { drops.push('polygon: bad points'); return null; }
        return `<polygon points="${p}"${paintAttrs(s, PALETTE.ink)}/>`;
      }
      case 'path': {
        const d = String(s.d || '').trim();
        if (!d || d.length > MAX_D || !D_RE.test(d)) { drops.push('path: bad/oversized d'); return null; }
        return `<path d="${d}"${paintAttrs(s, 'none')}/>`;
      }
      case 'text': {
        const x = num(s.x, 0, 100, null), y = num(s.y, 0, 100, null);
        const content = String(s.text != null ? s.text : s.content || '').slice(0, 40).trim();
        if (x == null || y == null || !content) { drops.push('text: bad coords/empty'); return null; }
        const size = num(s.size, 3, 16, 7);
        return `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" fill="${col(s.fill, PALETTE.ink)}">${escXml(content)}</text>`;
      }
      default:
        drops.push(`unknown type: ${t || '(missing)'}`);
        return null;
    }
  }

  const stats = { requested: Array.isArray(panels) ? panels.length : 0, valid: 0, drops: [] };
  if (!Array.isArray(panels)) return { svg: null, stats };
  // Untrusted like every other model value: `chapter` must be an integer, clamped into
  // 1..chapterCount; without a valid chapterCount no data-chapter is ever emitted.
  const CHAPTERS = Number.isInteger(chapterCount) && chapterCount > 0 ? chapterCount : 0;
  const rendered = [];
  for (const p of panels.slice(0, MAX_PANELS)) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.shapes)) { stats.drops.push('panel: no shapes[]'); continue; }
    const drops = [];
    const shapes = p.shapes.slice(0, MAX_SHAPES).map(s => shapeToSvg(s, drops)).filter(Boolean);
    stats.drops.push(...drops);
    if (!shapes.length) { stats.drops.push('panel: 0 valid shapes'); continue; }
    const chN = Number(p.chapter);
    rendered.push({
      bg: col(p.bg, PALETTE.paper),
      caption: String(p.caption || '').slice(0, 70).trim(),
      chapter: (CHAPTERS && Number.isInteger(chN)) ? Math.max(1, Math.min(CHAPTERS, chN)) : null,
      body: shapes.join(''),
    });
  }
  stats.valid = rendered.length;
  if (rendered.length < MIN_PANELS) return { svg: null, stats };

  // v55_t established the invariant that PANEL SIZE is identical across every board; v57 keeps
  // it with a row layout: the canvas is ALWAYS the full PER_ROW width (so a 2-panel and a
  // 12-panel board render their panels the same size), and boards beyond PER_ROW wrap into
  // additional rows — height is the only thing that grows. Each row is centred independently
  // (a full row's centring lands exactly on the original 12px margin).
  const W = PER_ROW * (PANEL_PX + GAP) + GAP;
  const rows = Math.ceil(rendered.length / PER_ROW);
  // No caption band — the caption is a hover-only <title> inside each panel group (drops the
  // always-on text row per the user's call; panels keep their 170px size, height just loses the
  // band). <title> is also the accessible choice: screen readers announce it.
  const H = rows * (PANEL_PX + GAP) + GAP;
  // Responsive: viewBox only + max-width, so the board scales down on narrow screens but its
  // aspect ratio — and therefore every panel's size — is independent of the panel count.
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block" role="img">`,
  ];
  rendered.forEach((p, i) => {
    const row = Math.floor(i / PER_ROW), col = i % PER_ROW;
    // Panels in THIS row (the last row may be partial); centre the row's strip.
    const inRow = Math.min(PER_ROW, rendered.length - row * PER_ROW);
    const stripW = inRow * PANEL_PX + (inRow - 1) * GAP;
    const x = Math.round((W - stripW) / 2) + col * (PANEL_PX + GAP);
    const y = GAP + row * (PANEL_PX + GAP);
    // <g> with a leading <title> = hover tooltip over the whole panel (frame + art).
    // data-chapter (a sanitized integer, see above) is the panel→lesson-set link target.
    parts.push(
      `<g${p.chapter ? ` data-chapter="${p.chapter}"` : ''}>`,
      p.caption ? `<title>${escXml(p.caption)}</title>` : '',
      `<rect x="${x - 1}" y="${y - 1}" width="${PANEL_PX + 2}" height="${PANEL_PX + 2}" fill="none" stroke="${PALETTE.stone}" stroke-width="1" rx="4"/>`,
      `<svg x="${x}" y="${y}" width="${PANEL_PX}" height="${PANEL_PX}" viewBox="0 0 100 100">`,
      `<rect x="0" y="0" width="100" height="100" fill="${p.bg}"/>`,
      p.body,
      `</svg>`,
      `</g>`
    );
  });
  parts.push('</svg>');
  const svg = parts.join('');
  if (svg.length > 120000) { stats.drops.push('svg: over size cap'); return { svg: null, stats }; }
  return { svg, stats };
}

// Generate a 2–6 panel (up to 12 for >10-chapter storylines) SVG storyboard for a storyline from its chapter texts. Same call
// shape as generateStorylineSummary. Returns { svg, meta } — callers destructure and persist
// BOTH (sl.storyboard + sl.storyboardMeta); a bare assignment would store an object.
// Uses the STORY model. maxTokens 6000: the live spike hit a 4096 cap (salvage repaired the
// truncated tail); give the real feature headroom. timeoutMs 60min: this call runs ~30min at
// the spike-measured 2.2 tok/s on qwen3.6:35b-a3b — it must outlive the 12-min inactivity
// default without mutating the global request timeout.
// Generate a 2–6 panel (up to 12 for >10-chapter storylines) SVG storyboard for a storyline from its chapter texts. Same call
// shape as generateStorylineSummary. Returns { svg, panels, meta } — callers destructure and persist
// svg + panels + meta (panels are kept so the colour scheme can be changed later WITHOUT another
// model call; see the /scheme route). `opts.storyStyle` is the chapters' writing style (v55_r: the
// board should look like the story reads — "children" playful, "horror" foreboding); `opts.scheme`
// picks the palette. Uses the STORY model. maxTokens 6000 + 60min timeout: see v55/v55_c.
async function generateStorylineStoryboard(topics, stories, srcLang, opts) {
  srcLang = srcLang || 'en';
  const { storyStyle = null, scheme = STORYBOARD_SCHEME_DEFAULT, slId = null, slTitle = null } = (opts || {});
  const S = langName(srcLang);
  const _t0 = Date.now();
  console.log(`\n── Storyline storyboard generation ──────────────────`);
  // v55_v: name the storyline — a bulk/parallel run otherwise logs identical headers and you can't
  // tell which board is being generated (or which one failed).
  console.log(`  Storyline: ${slTitle ? `"${slTitle}"` : '(untitled)'}${slId ? ` [${slId}]` : ''}`);
  console.log(`  Chapters : ${topics.length}, Lang: ${S}, Model: ${OLLAMA_MODEL}, style: ${storyStyle || '(default)'}, scheme: ${scheme}`);
  const chapterSummaries = topics.map((t, i) =>
    `Chapter ${i + 1}: "${t}"\n${(stories[i] || '').slice(0, 600).replace(/\n/g, ' ')}…`
  ).join('\n\n');
  // Editorial panel budget (v57): 6 panels normally; large storylines (>10 chapters) may use
  // up to 12 (the composer wraps them into rows of 6). This is a PROMPT rule — the composer's
  // own hard cap is 12 regardless, so an over-eager model is trimmed, never rejected.
  const maxPanels = topics.length > 10 ? 12 : 6;
  // Tone note, using the same style vocabulary the story generator uses (PROMPTS.storyStyles).
  // 'creative' maps to null → no note, i.e. the model's default look.
  const styleNote = getStoryStyle(storyStyle);
  const sys  = fillPrompt(PROMPTS.storylineStoryboard.system, { S, chapters: topics.length, maxPanels })
             + (styleNote ? `\n\nMatch the story's tone in the artwork: ${styleNote}` : '');
  const user = fillPrompt(PROMPTS.storylineStoryboard.user, { S, chapters: topics.length, chapterSummaries, maxPanels });
  const result = await _callLLM(OLLAMA_MODEL, sys, user, maxPanels > 6 ? 12000 : 6000, { timeoutMs: 3600000, think: false });
  // Log arrival BEFORE parsing — a 30-min call that returns garbage must still show it returned
  // (v55_b: a live run died silently; the console showed the header and then nothing).
  const _elapsed = ((Date.now() - _t0) / 1000).toFixed(0);
  const _rate = result.completionTokens ? `, ${(result.completionTokens / ((Date.now() - _t0) / 1000)).toFixed(1)} tok/s` : '';
  console.log(`  Response : after ${_elapsed}s (${result.completionTokens || '?'} tok${_rate})`);
  let panels;
  try { panels = JSON.parse(stripRaw(result.text)); }
  catch (_) { try { panels = extractArray(result.text); } catch (_2) { panels = salvageArray(result.text); } }
  if (!Array.isArray(panels)) {
    console.error(`  ✗ Storyboard: model returned non-array JSON. Raw starts: ${JSON.stringify(stripRaw(result.text).slice(0, 200))}`);
    throw new Error('Storyboard: model returned non-array JSON');
  }
  const { svg, stats } = composeStoryboardSVG(panels, scheme, topics.length);
  console.log(`  Panels   : ${stats.valid}/${stats.requested} valid${stats.drops.length ? ` (dropped: ${stats.drops.slice(0, 6).join('; ')})` : ''}`);
  if (!svg) throw new Error(`Storyboard: only ${stats.valid} valid panel(s) (need ≥2)`);
  console.log(`  SVG      : ${svg.length} bytes`);
  console.log('────────────────────────────────────────────────────\n');
  const meta = buildGenMeta({
    type: 'storyline_storyboard', model: OLLAMA_MODEL, t0: _t0, valid: stats.valid,
    promptTokens: result.promptTokens, completionTokens: result.completionTokens,
  });
  meta.storyStyle = storyStyle || null;
  // `panels` is the model's validated JSON — persisting it is what makes a scheme change free
  // (re-compose locally instead of another multi-minute generation).
  return { svg, panels, scheme, meta };
}

// Compare a cleaned passage against its source. The contract is DELETION ONLY, so the result must
// be a SUBSEQUENCE of the input at word level: every kept word appears in the original, in order.
// That single check rejects rewriting, rewording, translating and reordering in one go — far
// stronger than a length ratio, and cheap. Returns { ok, kept, total, dropped }.
function cleanTextChanges(original, cleaned) {
  const A = String(original || '').split(/\s+/).filter(Boolean);
  const B = String(cleaned || '').split(/\s+/).filter(Boolean);
  let i = 0;
  for (const w of B) {
    while (i < A.length && A[i] !== w) i++;
    if (i >= A.length) return { ok: false, kept: B.length, total: A.length, dropped: A.length - B.length };
    i++;
  }
  return { ok: true, kept: B.length, total: A.length, dropped: A.length - B.length };
}

// Remove non-narrative fragments from an extracted passage (v69_m). Retries with SPECIFIC feedback,
// exactly like the error-hunt generator: a prompt alone cannot guarantee the contract, so the
// contract is verified and any violation is fed back in words the model can act on.
async function cleanNarrativeText(text, lang) {
  const _t0 = Date.now();
  const sys = fillPrompt(PROMPTS.textCleanup.system, { L: langName(lang) });
  // v69_p (user request): announce the work BEFORE the first call and name the model. The old log
  // only appeared once a chunk had finished, so a slow or stuck pass looked like nothing happening.
  const _words = String(text).split(/\s+/).filter(Boolean).length;
  console.log(`  [${OLLAMA_MODEL}] Cleaning text (${_words} words, ${langName(lang)})…`);
  const ATTEMPTS = 3;
  const FLOOR = 0.4;
  let promptTokens = 0, completionTokens = 0, lastProblem = '';
  let best = null;   // structurally valid but heavy-handed — kept as a fallback, see below
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const feedback = lastProblem
      ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${lastProblem}\nReturn the text again, deleting ONLY whole non-narrative fragments and copying everything you keep word for word.`
      : '';
    let out = '';
    try {
      // v69_o: think stays OFF for every attempt. Escalating to reasoning (as the error-hunt
      // generator does) is wrong for THIS task: the contract is verbatim copying minus deletions,
      // which reasoning does not help with, and the observed failure is over-deletion, which it
      // does not address either. It also cost 36 minutes — base timeout × THINK_TIMEOUT_MULT — on
      // a 200-word chunk, which is what made a real run look like it had hung. Output length is
      // bounded by input length here, so the plain request timeout is right.
      const r = await _callLLM(OLLAMA_MODEL, sys, text + feedback, Math.ceil(text.length * 1.2),
        { think: false, timeoutMs: getRequestTimeout() });
      out = String(r.text || '').trim();
      promptTokens += r.promptTokens || 0; completionTokens += r.completionTokens || 0;
    } catch(e) {
      if (attempt === ATTEMPTS) break;          // fall through to the unchanged-text fallback
      lastProblem = `the request failed (${e.message})`;
      continue;
    }
    const chk = cleanTextChanges(text, out);
    if (!out) {
      lastProblem = 'you returned nothing';
    } else if (!chk.ok) {
      // The hard contract: anything not a pure deletion is wrong, full stop.
      lastProblem = 'you rewrote or reworded part of the text — you may only DELETE, never change the words you keep';
    } else if (chk.kept < chk.total * FLOOR) {
      // v69_o: heavy deletion is a WARNING, not a verdict. The floor assumed every chunk is mostly
      // article — but a chunk can legitimately BE mostly furniture (a related-links block, a
      // footer, a page of teasers), and a real run showed two attempts independently agreeing on
      // ~32% retention, which is evidence the model is right rather than wrong. So: ask once more
      // with a pointed hint, but remember the answer and use it if nothing better arrives. The
      // client surfaces it and the pass is undoable, so the human makes the final call.
      if (!best || chk.kept > best.chk.kept) best = { text: out, chk };
      lastProblem = `you kept only ${chk.kept} of ${chk.total} words. If this passage really is mostly advertisements, teasers or links, that is correct — but never delete sentences belonging to the article itself`;
    } else {
      console.log(`  Text cleanup: kept ${chk.kept}/${chk.total} words (${chk.dropped} dropped)${attempt > 1 ? `, attempt ${attempt}` : ''}`);
      return { text: out, kept: chk.kept, total: chk.total, dropped: chk.dropped, heavy: false,
               tokens: { promptTokens, completionTokens },
               meta: buildGenMeta({ type: 'text_cleanup', model: OLLAMA_MODEL, t0: _t0, promptTokens, completionTokens }) };
    }
    console.warn(`    Text cleanup attempt ${attempt}/${ATTEMPTS} rejected: ${lastProblem}`);
  }
  if (best) {
    console.log(`  Text cleanup: kept ${best.chk.kept}/${best.chk.total} words — HEAVY, flagged for review`);
    return { text: best.text, kept: best.chk.kept, total: best.chk.total, dropped: best.chk.dropped,
             heavy: true, note: lastProblem, tokens: { promptTokens, completionTokens },
             meta: buildGenMeta({ type: 'text_cleanup', model: OLLAMA_MODEL, t0: _t0, promptTokens, completionTokens }) };
  }
  // Nothing usable — most likely the model rewrites rather than deletes. Returning the text
  // UNCHANGED (rather than throwing) keeps a multi-chunk run moving and loses nothing: the caller
  // is told it was left alone and why.
  const words = String(text).split(/\s+/).filter(Boolean).length;
  console.warn(`  Text cleanup: left unchanged — ${lastProblem}`);
  return { text, kept: words, total: words, dropped: 0, unchanged: true, note: lastProblem,
           tokens: { promptTokens, completionTokens },
           meta: buildGenMeta({ type: 'text_cleanup', model: OLLAMA_MODEL, t0: _t0, promptTokens, completionTokens }) };
}

// ── LLM-decided chapters (v71_b) ──────────────────────────────────────────────────────────────
// The user asked for a model-driven alternative to the deterministic paragraph split, "similar to
// the current PDF cleaning option", with cleaning foldable into the same prompt.
//
// The contract is deliberately NOT the one textCleanup uses. There the model returns TEXT and the
// server has to prove afterwards that it only deleted (cleanTextChanges). Here the model never
// returns text at all — it returns paragraph NUMBERS and titles, and the chapters are reassembled
// from the caller's own paragraphs. Corruption is therefore impossible by construction rather than
// caught by a checker: the worst a bad answer can do is group the paragraphs badly.
//
// assembleChapters is pure and separated from the call so the grouping rules can be tested without
// a model. Returns [{ title, text, wordCount }].
function assembleChapters(paras, starts, drop) {
  const dropped = new Set((drop || []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= paras.length));
  const cuts = [...new Set((starts || []).map(s => Number(s.start)))]
    .filter(n => Number.isInteger(n) && n >= 1 && n <= paras.length)
    .sort((a, b) => a - b);
  if (!cuts.length) return [];
  const titleFor = n => (starts.find(s => Number(s.start) === n) || {}).title || '';
  const out = [];
  cuts.forEach((from, i) => {
    const to = i + 1 < cuts.length ? cuts[i + 1] - 1 : paras.length;
    const body = [];
    for (let p = from; p <= to; p++) if (!dropped.has(p)) body.push(paras[p - 1]);
    if (!body.length) return;                         // every paragraph in it was discarded
    const text = body.join('\n\n');
    out.push({ title: String(titleFor(from) || '').trim().slice(0, 80),
               text, wordCount: text.split(/\s+/).filter(Boolean).length });
  });
  return out;
}

// Validate the model's answer against the paragraph count. Returns a problem string, or ''.
function chapterSplitProblem(obj, n, allowDrop) {
  if (!obj || !Array.isArray(obj.chapters) || !obj.chapters.length) return 'you returned no chapters';
  const starts = obj.chapters.map(c => Number(c && c.start));
  if (starts.some(s => !Number.isInteger(s))) return 'every chapter needs a numeric "start"';
  if (starts.some(s => s < 1 || s > n)) return `paragraph numbers must be between 1 and ${n}`;
  for (let i = 1; i < starts.length; i++) if (starts[i] <= starts[i - 1]) return 'the "start" numbers must increase';
  if (starts[0] !== 1 && !allowDrop) return 'the first chapter must start at paragraph 1';
  const drop = Array.isArray(obj.drop) ? obj.drop.map(Number) : [];
  if (!allowDrop && drop.length) return 'you may not discard paragraphs';
  if (drop.some(d => !Number.isInteger(d) || d < 1 || d > n)) return `discarded numbers must be between 1 and ${n}`;
  if (assembleChapters(new Array(n).fill('x'), obj.chapters, drop).length === 0)
    return 'that leaves no chapters at all';
  return '';
}

async function splitChaptersLLM(paras, lang, allowDrop) {
  const _t0 = Date.now();
  const n = paras.length;
  const sys = fillPrompt(PROMPTS.chapterSplit.system, {
    L: langName(lang),
    DROP: allowDrop ? PROMPTS.chapterSplit.dropClause : PROMPTS.chapterSplit.keepClause,
  });
  // Previews only: the model needs enough of each paragraph to see where the subject turns, not
  // the whole document. Keeps a 60-paragraph book inside a sane prompt.
  const preview = p => {
    const w = String(p).split(/\s+/).filter(Boolean);
    return w.slice(0, 30).join(' ') + (w.length > 30 ? ' …' : '');
  };
  const user = paras.map((p, i) => `${i + 1}. ${preview(p)}`).join('\n');
  console.log(`  [${OLLAMA_MODEL}] Choosing chapters (${n} paragraphs, ${langName(lang)}${allowDrop ? ', may discard furniture' : ''})…`);
  const ATTEMPTS = 3;
  let promptTokens = 0, completionTokens = 0, lastProblem = '';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const feedback = lastProblem ? `\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${lastProblem}\nAnswer again, JSON only.` : '';
    let obj = null;
    try {
      // Short structured output, like the chapter-title pass: never worth reasoning tokens.
      const r = await _callLLM(OLLAMA_MODEL, sys, user + feedback, 40 * Math.min(n, 40) + 200,
        { think: false, timeoutMs: getRequestTimeout() });
      promptTokens += r.promptTokens || 0; completionTokens += r.completionTokens || 0;
      const raw = stripRaw(r.text || '');
      try { obj = JSON.parse(raw); }
      catch (_) {
        // Salvage: pull the {start,title} objects out of malformed JSON, same spirit as the
        // chapter-title post-pass.
        const objs = raw.match(/\{[^{}]*\}/g) || [];
        const chapters = objs.map(o => {
          const sm = o.match(/"start"\s*:\s*(\d+)/);
          const tm = o.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          return sm ? { start: Number(sm[1]), title: tm ? tm[1] : '' } : null;
        }).filter(Boolean);
        const dm = raw.match(/"drop"\s*:\s*\[([\d,\s]*)\]/);
        if (chapters.length) obj = { chapters, drop: dm ? dm[1].split(',').map(x => Number(x.trim())).filter(Number.isInteger) : [] };
      }
    } catch (e) {
      if (attempt === ATTEMPTS) break;
      lastProblem = `the request failed (${e.message})`;
      continue;
    }
    const problem = chapterSplitProblem(obj, n, allowDrop);
    if (!problem) {
      const chapters = assembleChapters(paras, obj.chapters, obj.drop);
      const droppedN = (Array.isArray(obj.drop) ? obj.drop : []).length;
      console.log(`  Chapter split: ${chapters.length} chapter(s) from ${n} paragraphs`
        + (droppedN ? `, ${droppedN} discarded` : '') + (attempt > 1 ? `, attempt ${attempt}` : ''));
      return { chapters, dropped: Array.isArray(obj.drop) ? obj.drop : [],
               tokens: { promptTokens, completionTokens },
               meta: buildGenMeta({ type: 'chapter_split', model: OLLAMA_MODEL, t0: _t0, promptTokens, completionTokens }) };
    }
    lastProblem = problem;
    console.warn(`    Chapter split attempt ${attempt}/${ATTEMPTS} rejected: ${problem}`);
  }
  // Never leave the caller without chapters: fall back to one chapter per paragraph-run, which is
  // what the client would have produced on its own.
  console.warn(`  Chapter split: falling back to the deterministic split — ${lastProblem}`);
  const err = new Error(lastProblem || 'the model did not return usable chapters');
  err.code = 'CHAPTER_SPLIT_FAILED';
  throw err;
}


// the two callers cannot drift: derives the majority story style across the chapters (v55_r — the
// board should match how the story READS; ties → the first chapter's, all-unstyled → null),
// generates the board, and persists svg + meta + panels + scheme (+ metered tokens, v59) on the
// storyline when it exists. Returns { storyboard, scheme }.
async function _storyboardForStoryline(slId, topicData, scheme) {
  const stories = topicData.map(t => t.story || '');
  const srcLang = topicData[0].srcLang || 'en';
  const _styleCounts = {};
  for (const t of topicData) if (t.storyStyle) _styleCounts[t.storyStyle] = (_styleCounts[t.storyStyle] || 0) + 1;
  const storyStyle = Object.keys(_styleCounts).sort((a, b) =>
    (_styleCounts[b] - _styleCounts[a]) || 0)[0] || null;
  const { result: { svg: storyboard, panels, scheme: usedScheme, meta: storyboardMeta }, tokens: _mTok } =
    await meterLLMTokens(() => generateStorylineStoryboard(topicData.map(t => t.topic), stories, srcLang,
      { storyStyle, scheme: Object.prototype.hasOwnProperty.call(STORYBOARD_SCHEMES, scheme) ? scheme : STORYBOARD_SCHEME_DEFAULT,
        slId, slTitle: (findStoryline(slId) || {}).title || null }));
  const sl = findStoryline(slId);
  if (sl) {
    addTokenUsage(sl, _mTok, 'storyboard');   // storyline-level artefact (v59)
    sl.storyboard = storyboard; sl.storyboardMeta = storyboardMeta;
    sl.storyboardPanels = panels;      // kept so a scheme change needs no model call
    sl.storyboardScheme = usedScheme;
    upsertStoryline(sl);
  }
  return { storyboard, scheme: usedScheme };
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
  // v71_p: up to three attempts. The reported failure printed `Titles   :   |  ` — the response
  // PARSED as an array of the right length, but every title was an empty string. So a retry that
  // only catches parse errors would not have retried at all: the acceptance test has to be on the
  // CONTENT. Anything usable is kept — a partial set still beats falling back to "Chapter 3".
  const MAX_TITLE_ATTEMPTS = 3;
  let out = null;
  for (let attempt = 1; attempt <= MAX_TITLE_ATTEMPTS; attempt++) {
    let got;
    try { got = await _generateChapterMetaOnce(sys, user, n); }
    catch (e) { console.log(`  Attempt ${attempt}/${MAX_TITLE_ATTEMPTS} failed: ${e.message}`); continue; }
    const named = got.filter(o => o.title).length;
    if (named === n) { out = got; break; }                       // complete set — done
    console.log(`  Attempt ${attempt}/${MAX_TITLE_ATTEMPTS}: ${named}/${n} titles came back named`);
    // Keep the best partial seen so far, in case every attempt is incomplete.
    if (named && (!out || named > out.filter(o => o.title).length)) out = got;
  }
  if (!out) throw new Error(`Chapter-title post-pass: no usable titles after ${MAX_TITLE_ATTEMPTS} attempts`);
  console.log(`  Titles   : ${out.map(o => (o.emoji||'') + ' ' + (o.title||'—')).join(' | ').slice(0,160)}`);
  console.log('────────────────────────────────────────────────────\n');
  return out;
}

// One attempt at the chapter-title call: request, parse, normalise. Split out of
// generateChapterMeta (v71_p) so the retry loop above has something to retry — the parsing ladder
// below is unchanged, only its position is.
async function _generateChapterMetaOnce(sys, user, n) {
  const result = await _callLLM(OLLAMA_MODEL, sys, user, 60 * n + 120, { think: false });   // v65.1: short structured output — never reason
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
        // v77_x (user-reported): the model can answer with PAIR ARRAYS instead of objects, one per
        // line and with no enclosing array:
        //     ["Erste Begegnung", "🐕"]
        //     ["Parkfreundschaft", "🌳"]
        // Every rung above looks for `{…}` objects, so a perfectly readable answer was rejected
        // three times and the whole post-pass failed. Notably it only ever failed for MULTI-chapter
        // storylines — a single chapter is asked for one object and returns one, which is why the
        // lesson-set page's title generation worked while the storyline post-pass did not.
        if (!arr.length) {
          const pairs = stripRaw(raw).match(/\[[^\[\]]*\]/g) || [];
          arr = pairs.map(p => {
            try {
              const a = JSON.parse(p);
              if (Array.isArray(a) && typeof a[0] === 'string' && a[0].trim()) {
                return { title: a[0], emoji: (typeof a[1] === 'string' && a[1].trim()) ? a[1] : '📖' };
              }
            } catch(_p) {}
            return null;
          }).filter(Boolean);
        }
        if (!arr.length) throw new Error('Could not parse chapter-titles array: ' + stripRaw(raw).slice(0,120));
      }
    }
  }
  if (!Array.isArray(arr)) throw new Error('Expected a JSON array of {title,emoji}');
  // v77_x: accept a [title, emoji] PAIR as well as an object. When the model answers with a proper
  // top-level array of pairs the first rung parses it successfully — and this normaliser would then
  // read `.title` off an Array and produce an empty title for every chapter. A parse that succeeds
  // into the wrong shape is worse than one that fails, because nothing reports it.
  return arr.map(o => {
    if (Array.isArray(o)) o = { title: o[0], emoji: o[1] };
    return {
      title: ((o && (o.title || o.t)) || '').toString().trim().slice(0, 80),
      emoji: ((o && (o.emoji || o.icon || o.e)) || '📖').toString().slice(0, 8),
    };
  });
}

// ── Grammar lesson: gender, articles, plurals ───────────────────────────────
function sysGrammar(lang, srcLang, difficulty, dialect, writingStyle, script) {
  const L    = langName(lang, script);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const P = PROMPTS.grammar;
  let sys = fillPrompt(P.system, { L, S, diff, EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  sys += scriptPinNote(lang, script, 'grammar prompt');   // v79_f
  return sys;
}


// ── Conjugation lesson: verb forms by person ─────────────────────────────────
function sysConjugation(lang, srcLang, difficulty, dialect, writingStyle, script) {
  const L    = langName(lang, script);
  const S    = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const P = PROMPTS.conjugation;
  let sys = fillPrompt(P.system, { L, S, diff, EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
  if (dialect)                    sys += fillPrompt(P.dialectNote,       { dialect });
  if (getStoryStyle(writingStyle)) sys += fillPrompt(P.writingStyleNote,  { writingStyle: getStoryStyle(writingStyle) });
  sys += scriptPinNote(lang, script, 'conjugation prompt');   // v79_f
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

// E0: standardized per-lesson generation metadata. Every generator stamps this on its
// returned lesson (lesson._genMeta) so EVERY flow — add-lesson, initial topic gen, book
// import, storyline recreate — carries it for later QC / batch stats / weak-model
// diagnosis. `t0` is a Date.now() captured at the generator's start (omit → ms null).
// `model` is REQUIRED (v53_d). It used to default to OLLAMA_LESSON_MODEL, which silently
// mis-stamps any caller that used a different role — the story model, the translation model, or a
// procedural generator. Every real call site happened to match the default, but the trap was one
// copy-paste away from recording the wrong provenance for good. Sentinels: '(procedural)' for the
// non-LLM paths (math, intro_script), '(user-provided)' for a story the user pasted, '(unknown)'
// where the generator genuinely didn't say.
// ── v80_h: does this lesson actually contain the target SCRIPT? ──────────────
// `v79_f` found a Serbian (cyrillic-sr) conjugation lesson written entirely in Latin, and fixed the
// PROMPT so the script is pinned. `unit-script-pin-coverage` guards that every prompt carries the
// pin — but a pin is an instruction, and the model can ignore it. Nothing checked the OUTPUT.
// Swept at the v80_h cut: **7 lessons across 5 Serbian chapters carry ZERO Cyrillic**, of which only
// one (`tp_17864554460460000107` lesson `id=6`) was known. Four are comprehension, one standard,
// two conjugation. Arabic, Hebrew and Japanese chapters are clean.
//
// Rule 34: guard at the layer where the claim is observable. The claim "this lesson is in the
// target script" is observable in the LESSON, not in the prompt that asked for it.
//
// The alphabet comes from `scripts.json`, never from a hardcoded Unicode range — the script
// knowledge in this project lives in data (INTERNALS: "no language knowledge in the code"). A script
// this file does not know, or a Latin one, yields NO OPINION rather than a guess.
// ⚠️ v80_m CORRECTION. The v80_h version of this flagged 7 lessons; FOUR of them were
// `comprehension` lessons and were NOT defective. Comprehension questions are written in the SOURCE
// language throughout the corpus — de->fr yields German questions, ar->en Arabic, it->de Italian —
// which is the design: you read the target-language story and answer in a language you understand.
// Measured across non-Latin-target chapters: comprehension carries target-script text in 1 lesson
// of 5, where `standard` is 61 of 62 and `synonyms`, `word_forms`, `grammar`, `intro_script` and
// `error_hunt` are all 100%. So the absence means nothing for this type and the rule must not claim
// it. This is a per-TYPE fact about where the app puts each language, not a language fact, so it
// belongs here rather than in a data file.
function lessonScriptDefect(lesson, scriptName) {
  // Kept INSIDE the function deliberately: the probe and unit harness extract this function by
  // slicing the source and eval it standalone, so a const declared above it is out of scope there.
  const SOURCE_LANGUAGE_TYPES = ['comprehension'];
  if (!lesson || !scriptName || scriptName === 'latin') return null;
  if (SOURCE_LANGUAGE_TYPES.indexOf(lesson.type) >= 0) return null;
  const entry = (_scriptsData && typeof _scriptsData === 'object') ? _scriptsData[scriptName] : null;
  const letters = entry && Array.isArray(entry.letters) ? entry.letters : null;
  if (!letters || !letters.length) return null;                    // unknown script: no opinion
  const alphabet = new Set();
  for (const L of letters) {
    if (L && L.ch) alphabet.add(String(L.ch));
    if (L && L.lower) alphabet.add(String(L.lower));
  }
  let body;
  try { body = JSON.stringify(lesson); } catch (_) { return null; }
  // `_genMeta` and ids are machine fields and are never in the target script; excluding them keeps
  // the count honest without needing to know which fields carry learner-facing text.
  body = body.replace(/"_genMeta":\{[^}]*\}/g, '').replace(/"(?:id|type|model|at)":"[^"]*"/g, '');
  let hits = 0;
  for (const ch of body) if (alphabet.has(ch)) { hits++; if (hits > 0) break; }
  if (hits > 0) return null;
  // Only meaningful when there is enough text for the absence to mean something — a nearly empty
  // lesson is a different defect and this one should not claim it.
  const latin = (body.match(/[A-Za-z]/g) || []).length;
  if (latin < 200) return null;
  return { defect: 'no-target-script', script: scriptName, latinChars: latin };
}

function buildGenMeta(o) {
  o = o || {};
  if (!o.model) throw new Error("buildGenMeta: `model` is required — pass the model actually used, or a '(procedural)' / '(user-provided)' / '(unknown)' sentinel");
  return {
    type: o.type || null,
    model: o.model,
    attempts: (o.attempts != null) ? o.attempts : null,
    valid: (o.valid != null) ? o.valid : null,
    rejected: (o.rejected != null) ? o.rejected : 0,
    rejectReasons: o.rejectReasons || null,
    promptTokens: o.promptTokens || 0,
    completionTokens: o.completionTokens || 0,
    ms: (o.t0 != null) ? (Date.now() - o.t0) : null,
    at: new Date().toISOString(),
  };
}
// Aggregate a validator's rejected[] into a { reason: count } histogram for _genMeta.
function genReasonHist(rejected) {
  const h = {};
  (rejected || []).forEach(r => ((r && r.reasons) || []).forEach(reason => { h[reason] = (h[reason] || 0) + 1; }));
  return h;
}

// ── Intro "learn the script" course (LLM-free) ───────────────────────────
// Pure exercise builder from a letter table. Kept deterministic-in-shape (the only
// randomness is choice ordering + distractor pick) and mirrored verbatim on the client
// (buildIntroScriptExercisesFrom) so static and live builds agree. Each letter yields a
// glyph→sound MCQ and a sound→glyph MCQ; a subset also gets a listen→glyph item (the client
// renders it only when the target has TTS). `letters` is the script table's letter array.
function introScriptExercises(letters, opts) {
  opts = opts || {};
  const rnd = opts.rnd || Math.random;
  const sh = (a) => { const b=[...a]; for(let i=b.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; } return b; };
  const real = letters.filter(L => L && L.ch && (L.translit || L.name));          // letters to quiz
  const poolRaw = (opts.distractorPool && opts.distractorPool.length) ? opts.distractorPool : real;
  const pool = poolRaw.filter(L => L && L.ch && (L.translit || L.name));          // distractor pool
  // The answer side must be readable to the learner. `opts.srcScripts` lists the scripts they
  // already read; if the letter carries a `sounds` column for one of them, use it (B → "بي")
  // instead of the Latin translit — otherwise a Latin course would print its answers in Latin.
  const srcScripts = opts.srcScripts || [];
  const localSound = (L) => {
    if (L.sounds) for (const s of srcScripts) if (L.sounds[s]) return L.sounds[s];
    return null;
  };
  const sound = (L) => localSound(L) || (L.translit ? L.translit : L.name);   // quizzed "sound"
  const glyph = (L) => L.ch + (L.lower && L.lower !== L.ch ? ' ' + L.lower : '');
  const distinctSounds = (exclude, n) =>
    sh(pool.filter(L => sound(L) !== sound(exclude) && sound(L))).slice(0, n).map(sound);
  const distinctGlyphs = (exclude, n) =>
    sh(pool.filter(L => L.ch !== exclude.ch)).slice(0, n).map(glyph);
  const exs = [];
  real.forEach(L => {
    // glyph → sound
    const ws = distinctSounds(L, 3);
    if (ws.length >= 2) {
      exs.push({ type: 'mcq_source_target', source: glyph(L), target: sound(L),
        correct: sound(L), choices: sh([sound(L), ...ws]), _intro: 'glyph_sound' });
    }
    // sound → glyph: show the SOUND, pick the glyph. mcq_source_target (renders ex.source as
    // the prompt + choices), NOT mcq_target_source (which would show the glyph = the answer +
    // a listen block). The glyph is the answer here.
    const wg = distinctGlyphs(L, 3);
    if (wg.length >= 2) {
      // The "(name)" hint is the letter's Latin name — helpful next to a Latin translit, but
      // noise (and unreadable) once the sound is localized into the learner's script.
      const hint = (!localSound(L) && L.name && L.name !== sound(L)) ? ' ('+L.name+')' : '';
      exs.push({ type: 'mcq_source_target', source: sound(L) + hint,
        target: glyph(L), correct: glyph(L), choices: sh([glyph(L), ...wg]), _intro: 'sound_glyph' });
    }
  });
  // A handful of listen→glyph items (speak the letter, pick the glyph). Marked so the client
  // can drop them when no TTS voice exists for the target.
  sh(real).slice(0, Math.min(5, real.length)).forEach(L => {
    const wg = distinctGlyphs(L, 3);
    if (wg.length >= 2) {
      exs.push({ type: 'listen_mcq', target: L.lower || L.ch, pron: sound(L),
        correct: glyph(L), choices: sh([glyph(L), ...wg]), _intro: 'listen_glyph' });
    }
  });
  return exs;
}

// Difficulty → how many letters to quiz per lesson (mirror of the client's introMaxLetters).
function introMaxLetters(difficulty) {
  const d = difficulty || 2;
  return d <= 1 ? 8 : d === 2 ? 12 : 16;
}

// Build an intro-script lesson for a target language. Topic-independent (script-level), so
// no story is needed. Returns the same { lesson, tokens } envelope as the other generators.
function generateIntroScript(lang, opts) {
  opts = opts || {};
  const _t0 = Date.now();
  // Scripts the learner already reads — drives the localized answer side (see introScriptExercises).
  const srcScripts = scriptsForLang(opts.srcLang || 'en');
  const wanted = opts.script ? [opts.script] : scriptsForLang(lang).filter(s => !srcScripts.includes(s));
  const scriptName = wanted[0];
  const table = scriptName ? (_scriptsData[scriptName] || null) : null;
  const full = (table && Array.isArray(table.letters)) ? table.letters : [];
  if (!full.length) throw new Error('No script table for ' + lang + (scriptName ? ' / ' + scriptName : ''));
  // Cap to ~N letters by difficulty so the lesson isn't the whole 28–46 letter alphabet;
  // distractors still come from the full alphabet so wrong answers stay plausible.
  const max = introMaxLetters(opts.difficulty);
  let letters = full;
  if (full.length > max) {
    const sh = [...full]; for (let i = sh.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [sh[i],sh[j]]=[sh[j],sh[i]]; }
    letters = sh.slice(0, max);
  }
  const exercises = introScriptExercises(letters, { distractorPool: full, srcScripts });
  return {
    lesson: {
      id: 'intro_' + scriptName + '_' + Date.now(),
      type: 'intro_script',
      script: scriptName,
      rtl: !!table.rtl,
      difficulty: opts.difficulty || 2,
      title: '🔡 ' + (table.label || scriptName),
      desc: (table.label || scriptName) + ' — ' + letters.length + ' letters',
      icon: '🔡',
      letters,
      exercises,
      _genMeta: buildGenMeta({ type: 'intro_script', model: '(procedural)', t0: _t0, valid: exercises.length }),
    },
    tokens: { promptTokens: 0, completionTokens: 0 },
  };
}

function generateMath(story, difficulty, mathOps) {
  const _t0 = Date.now();
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
      _genMeta: buildGenMeta({ type: 'math', model: '(procedural)', t0: _t0, valid: exercises.length }),
    },
    tokens: { promptTokens: 0, completionTokens: 0 },
  };
}

async function generateMathLLM(lang, srcLang, difficulty, instruction, jobId, script) {
  const _t0 = Date.now();
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating math lesson (LLM)…`);
  const L = langName(lang || 'it', script || null);
  const S = langName(srcLang || 'en');
  const diff = difficultyLabel(difficulty || 2);
  const nExercises = difficulty * 5;
  //const nExercises = difficulty <= 1 ? 5 : 7;
  // v79_f: word problems are prose in the target language, so this prompt emits target text like
  // any other and takes the pin. (The non-LLM `generateMath` builds from digits and needs nothing.)
  const sys  = fillPrompt(PROMPTS.math.system, { L, S }) + scriptPinNote(lang, script || null, 'math prompt');
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
          _genMeta: buildGenMeta({ type: 'math', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: (parsed.exercises || []).length, promptTokens, completionTokens }),
        },
        tokens: { promptTokens, completionTokens },
      };
    } catch(e) {
      console.log(`  Math LLM attempt ${attempt} failed: ${e.message}`);
      if (attempt === 3) throw new Error('Math LLM failed after 3 attempts: ' + e.message);
    }
  }
}

async function generateErrorHunt(story, lang, difficulty, jobId, priorVocab, opts) {
  const _t0 = Date.now();
  jobStep(jobId, `[${OLLAMA_MODEL}] Generating error-hunt lesson…`);
  const sys = sysErrorHunt(lang, difficulty, (opts && opts.script) || null);
  const priorHint = priorVocab && priorVocab.length
    ? `\n\nPREFER errors on these words where they appear: ${priorVocab.slice(0,20).map(v=>v.target).join(', ')}`
    : '';
  const baseMsg = `Here is the ${langName(lang)} story:\n\n${story}\n\nReturn the corrupted story now.${priorHint}`;
  const { nSpell, nGrammar } = errorHuntCounts(difficulty);
  const wanted = nSpell + nGrammar;
  // Accept a band around the request rather than an exact count: models rarely hit it exactly, and
  // a lesson with 4 findable errors instead of 7 is still a good exercise. Too MANY changes means
  // it rewrote rather than corrupted.
  const minChanges = Math.max(2, Math.ceil(wanted / 2));
  const maxChanges = wanted * 2 + 2;

  // v69_g: this used to be ONE call whose only checks were "not empty" and "not byte-identical", so
  // a model that echoed the story failed the whole add-lesson outright (reported:
  // "model returned identical story with no changes"), and a model that changed a single word — or
  // rephrased the text entirely — produced an unplayable lesson that passed. Now: retry with
  // ESCALATING, specific feedback, and validate what the exercise actually needs.
  let promptTokens = 0, completionTokens = 0;
  let corruptedStory = null, lastProblem = '';
  const ATTEMPTS = 3;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const feedback = lastProblem
      ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${lastProblem}\nReturn the SAME story again, word for word, but this time introduce exactly ${nSpell} spelling errors and ${nGrammar} grammar errors by altering ${wanted} individual words. Keep every other word, all punctuation and all line breaks byte-identical, and keep the total number of words exactly the same.`
      : '';
    // Strategy changes on the final attempt. think:false is right for a verbatim rewrite and was
    // added in v68.1 to stop reasoning models burning the budget inside <think> and timing out —
    // but a reasoning model with thinking disabled sometimes just ECHOES the input, which is the
    // reported failure. So: fast path twice, then let it reason (the timeout is already widened).
    const useThink = attempt === ATTEMPTS;
    if (attempt > 1) jobStep(jobId, `[${OLLAMA_MODEL}] Error-hunt retry ${attempt}/${ATTEMPTS}${useThink ? ' (with reasoning)' : ''}…`);
    let text = '';
    try {
      // v72_f: this prompt embeds the whole story AND asks for the whole story back, so it is the
      // most context-hungry lesson call there is — the output budget is already `story.length * 2`.
      // Truncating the INPUT here is uniquely bad: the model would return a corrupted copy of a
      // fragment, the length check would reject it, and the retry loop would burn all three attempts
      // reporting "returned identical story" or a word-count mismatch, never the real cause.
      const r = await _callLLM(OLLAMA_MODEL, sys, baseMsg + feedback, story.length * 2,
        { think: useThink, timeoutMs: Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT),
          ctxTokens: estimateCtxTokens(sys.length + baseMsg.length + feedback.length, story.length * 2 / 3.5) });
      text = r.text; promptTokens += r.promptTokens || 0; completionTokens += r.completionTokens || 0;
    } catch (e) {
      lastProblem = `the request failed (${e.message})`;
      if (attempt === ATTEMPTS) throw e;      // a transport failure is not something a retry prompt fixes
      continue;
    }
    const cand = String(text || '').trim();
    const { aligned, changed, words } = errorHuntChanges(story, cand);
    if (!cand || cand.length < story.length * 0.5) {
      lastProblem = 'the response was much shorter than the story — you must return the WHOLE story';
    } else if (cand === story.trim()) {
      lastProblem = 'you returned the story completely unchanged — not a single word was altered';
    } else if (!aligned) {
      lastProblem = `the text was rephrased (${words} words became a different number) — you must keep every other word exactly as it was and only alter single words in place`;
    } else if (changed < minChanges) {
      lastProblem = `only ${changed} word(s) were altered, which is too few — alter ${wanted} words`;
    } else if (changed > maxChanges) {
      lastProblem = `${changed} words were altered, far more than the ${wanted} requested — change ONLY ${wanted} words and copy the rest exactly`;
    } else {
      corruptedStory = cand;
      console.log(`    Error-hunt: ${changed} word(s) corrupted of ${words} (asked for ${wanted})${attempt > 1 ? ` — attempt ${attempt}` : ''}`);
      break;
    }
    console.warn(`    Error-hunt attempt ${attempt}/${ATTEMPTS} rejected: ${lastProblem}`);
  }
  if (!corruptedStory)
    throw new Error(`Error-hunt: could not get a usable corrupted story after ${ATTEMPTS} attempts — ${lastProblem}. Try a different model, or generate this lesson at a lower difficulty.`);

  return {
    lesson: {
      id: 4, type: 'error_hunt',
      title: 'Text Understanding',
      desc: 'Find the mistakes in the story',
      icon: '🔍',
      corruptedStory,
      _genMeta: buildGenMeta({ type: 'error_hunt', model: OLLAMA_MODEL, t0: _t0, promptTokens, completionTokens }),
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

// Build the prior-words hint appended to a grammar lesson prompt. In reinforce mode
// the prior-chapter words can include inflected/plural/derived forms (and the
// nouns bucket isn't always clean), which don't fit a noun gender/plural drill and
// cause rejected items. So instruct the model to normalize each to its base singular
// noun and SKIP anything with no related noun. Pure → unit-testable.
function grammarPriorNounsNote(nounTargets, vocabMode) {
  const ns = (nounTargets || []).filter(Boolean);
  if (!ns.length) return '';
  if (vocabMode === 'extend')
    return `\nAVOID these nouns already covered in prior chapters: ${ns.join(', ')}`;
  return `\nPRIOR WORDS from previous chapters to reinforce where topic-relevant: ${ns.join(', ')}.`
    + `\nFor EACH such word, FIRST reduce it to its base SINGULAR NOUN (dictionary) form before using it in the gender/plural drill — convert any inflected, plural, participle, or otherwise derived form to its related noun (e.g. German "verbesserten" → "Verbesserung", "Häuser" → "Haus"). SKIP any word that is not a noun and has no closely related noun; never force a verb or adjective into the gender drill.`;
}

async function generateGrammar(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { userDialect, storyStyle, chainVocab, vocabMode: gramVocabMode, story } = opts;
  const sys = sysGrammar(lang, srcLang, difficulty, userDialect, storyStyle, opts.script || null);
  const _gNouns = chainVocab?.nouns?.slice(0, 15).map(n => n.target) || [];
  const priorNouns = grammarPriorNounsNote(_gNouns, gramVocabMode);
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
      try { parsed = extractJSON(raw); }        // v71_o: strips <think> before finding the JSON
      catch(e2) { lastError = 'JSON extract failed: ' + stripRaw(raw).slice(0, 60); continue; }
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
        _genMeta: buildGenMeta({ type: 'grammar', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: valid.length, rejected: rejected.length, rejectReasons: genReasonHist(rejected), promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens }),
      },
      tokens: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
    };
  }
  throw new Error(`Grammar generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// v82_c (user report + follow-up): the "whole word" check both this validator's SALVAGE-2 and
// validateInflectionsItems' own equivalent rely on assumes a SPACED script — it requires a
// non-letter/non-digit (or a string edge) flanking the match. In an unspaced script that assumption
// is simply false: Japanese has no whitespace between words, so a genuinely correct surfaceForm
// sitting between two other kana/kanji characters has a LETTER on both sides and can never satisfy
// the boundary lookaround, however correct it is — rejected as "not found as a whole word" no matter
// how right the model was. Kept in sync with index.html's `_UNSPACED_SCRIPTS`, byte-for-byte
// (asserted by unit-unspaced-scripts-parity.test.js): this app already solved the identical problem
// for story highlighting (`_highlightVocabHtml`, v73_d/v78_k) by dropping the boundary requirement
// for exactly these scripts and matching a bare substring instead — the same fix, applied here.
const UNSPACED_SCRIPTS_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

// ── word_forms lesson type ───────────────────────────────────────────────────
// Fill-in-the-blank exercises drawn from sentences that appear in the story: one
// word is blanked (___) and 4 forms of that word are offered, the original being
// correct. Language-independent; replaces grammar/conjugation drills over time.
function _wfNorm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
// Validate a batch of word_forms items against the source story. Pure; returns
// {valid, rejected[]} so the generator can drop bad items and log why.
function validateWordFormsItems(items, story) {
  const storyNorm = _wfNorm(story);
  const valid = [], rejected = [];
  const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const item of (items || [])) {
    const reasons = [];
    let sentence = (item && typeof item.sentence === 'string') ? item.sentence.trim() : '';
    let choices = (item && Array.isArray(item.choices)) ? item.choices.map(c => String(c == null ? '' : c).trim()).filter(Boolean) : [];
    let ci = item ? item.correctIndex : undefined;

    // SALVAGE 1 — dedupe choices (case-insensitive, keep first) and re-point the
    // correctIndex. A weak model often pads with repeats; that should not kill the item.
    if (Number.isInteger(ci) && ci >= 0 && ci < choices.length) {
      const correctWord = choices[ci];
      const seen = new Set(); const deduped = [];
      for (const c of choices) { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); deduped.push(c); } }
      choices = deduped;
      ci = choices.findIndex(c => c.toLowerCase() === String(correctWord).toLowerCase());
      // Trim an over-long set but always keep the correct choice.
      if (choices.length > 6) { const correct = choices[ci]; choices = [correct, ...choices.filter((_, i) => i !== ci)].slice(0, 6); ci = 0; }
    }

    if (!sentence) reasons.push('missing sentence');
    if (!Number.isInteger(ci) || ci < 0 || ci >= choices.length) reasons.push('correctIndex out of range');
    if (choices.length < 2) reasons.push('need at least 2 distinct choices');

    if (!reasons.length) {
      const correct = choices[ci];
      const cNorm = _wfNorm(correct);
      const cToks = cNorm.split(' ').filter(Boolean);

      // SALVAGE 2 — auto-insert the blank if the model forgot it but the correct word
      // is present as a whole word in the sentence (replace the first occurrence).
      // v82_c: an UNSPACED script (see UNSPACED_SCRIPTS_RE above) has no boundary to require —
      // match the bare substring instead, and replace it directly (no leading boundary group to
      // preserve, unlike the spaced case).
      if (!/_{3,}/.test(sentence)) {
        const unspaced = UNSPACED_SCRIPTS_RE.test(correct);
        const re = unspaced
          ? new RegExp('(' + escapeRe(correct) + ')', 'iu')
          : new RegExp('(^|[^\\p{L}\\p{N}])(' + escapeRe(correct) + ')(?=[^\\p{L}\\p{N}]|$)', 'iu');
        if (re.test(sentence)) sentence = unspaced ? sentence.replace(re, '___') : sentence.replace(re, (m, pre) => pre + '___');
        else reasons.push('no ___ blank and answer not in sentence');
      }

      if (!reasons.length) {
        // PLAN §F2 (v80_g) — THE BLANK MUST BE WHERE A WORD WAS REMOVED.
        // The user's report: `"The sun was setting, casting long shadows across the path.___"` with
        // answer `cast`. Nothing was removed; the blank was appended after a finished sentence, and
        // the answer is still visible in it as `casting`. This validator let it through because it
        // only ever asked whether a blank EXISTS, never where.
        //
        // Detected as pure STRUCTURE — terminal punctuation immediately followed by the blank —
        // so it carries no language knowledge and holds for every script. Confirmed across the
        // corpus by `build_history/probe_word_forms_defects_v80g.js`: 6 items in 345, four of them
        // Arabic and two English, which is the cross-language evidence that the signal is
        // structural rather than an artefact of one language's punctuation.
        //
        // Deliberately NOT matched: a blank that ends a sentence legitimately (`"He wanted to ___"`,
        // `"Ieri sono ___."`). The rule fires only when the blank comes AFTER the stop.
        if (/[.!?\u3002\uFF01\uFF1F\u061F\u06D4]\s*_{3,}\s*[.!?\u3002\uFF01\uFF1F\u061F\u06D4]?\s*$/.test(sentence)) {
          reasons.push('blank is appended after a finished sentence, not in place of a word');
        }
      }

      if (!reasons.length) {
        // No giveaway: the answer word must not also appear elsewhere in the blanked sentence.
        const blankToks = _wfNorm(sentence).split(' ').filter(Boolean);
        if (cToks.length === 1 && blankToks.includes(cToks[0])) reasons.push('answer appears elsewhere in sentence');
        // The translation must be in the learner's language, not a copy of the {L}
        // sentence (with the blank filled). Story-grounding of the sentence itself is
        // only a prompt preference now — not enforced — so weak models can still pass.
        const filled = sentence.replace(/_{3,}/, correct);
        const fNorm = _wfNorm(filled);
        const trNorm = _wfNorm(item.translation || '');
        const trWords = trNorm.split(' ').filter(Boolean);
        if (trNorm && (trNorm === fNorm || trNorm === _wfNorm(sentence) ||
                       (trWords.length >= 3 && storyNorm.includes(trNorm)))) {
          reasons.push('translation is the target-language sentence, not a translation');
        }
      }
    }

    if (reasons.length) rejected.push({ item, reasons });
    else valid.push({ sentence, translation: String(item.translation == null ? '' : item.translation).trim(), choices, correctIndex: ci, explanation: String(item.explanation == null ? '' : item.explanation).trim() });
  }
  return { valid, rejected };
}

async function generateWordForms(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story } = opts;
  if (!story || !String(story).trim()) throw new Error('word_forms: no story available');
  const _wfScript = opts.script || null;                                  // v79_f
  const L = langName(lang, _wfScript); const S = langName(srcLang || 'en');
  const n = (difficulty <= 1) ? 5 : (difficulty >= 3 ? 8 : 6);
  const sys = fillPrompt(PROMPTS.wordForms.system, { L, S, EXAMPLE: fillPrompt(promptExample(PROMPTS.wordForms, lang, srcLang), { L, S }) })
            + scriptPinNote(lang, _wfScript, 'word-forms prompt');                             // v79_f
  const userMsg = fillPrompt(PROMPTS.wordForms.user, { L, S, story, n });
  const MAX_ATTEMPTS = 3;
  let totalPromptTokens = 0, totalCompletionTokens = 0, lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Word-forms lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Word-forms attempt ${attempt}…`);
    // v72_f: size num_ctx like generateComprehension and generateSynonyms. This prompt carries the
    // WHOLE chapter story, and Ollama's default num_ctx (~4096) truncates a long prompt SILENTLY —
    // the model then derives items from a fragment while every attempt "succeeds" (v71_t).
    //
    // It was not failing yet, and that is the point: measured against this corpus the largest
    // chapter (4,691 chars) puts the prompt at ~3,985 tokens, i.e. inside the default by about 110
    // tokens — roughly 380 characters of story. A slightly longer chapter, a longer system prompt,
    // or a chain arriving here later crosses it with no signal at all. validateWordFormsItems would
    // then reject items for "not in the story" when the real cause is that the model never saw that
    // part of the story.
    const _ctxTokens = estimateCtxTokens(sys.length + userMsg.length, 1600 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sys, userMsg, 1600, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      try { parsed = extractJSON(raw); }        // v71_o: strips <think> before finding the JSON
      catch(e2) { lastError = 'JSON extract failed: ' + stripRaw(raw).slice(0, 60); continue; }
    }
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) { lastError = 'No items in response'; continue; }
    const { valid, rejected } = validateWordFormsItems(parsed.items, story);
    if (rejected.length > 0) {
      console.warn(`    Word-forms: ${rejected.length} item(s) rejected:`);
      rejected.forEach(r => console.warn(`      "${String(r.item && r.item.sentence || '').slice(0, 50)}": ${r.reasons.join(', ')}`));
    }
    if (valid.length < 1) { lastError = `No valid items after filtering (${rejected.length} rejected)`; continue; }
    console.log(`    Word-forms: ${valid.length} valid item(s) (${rejected.length} rejected)`);
    return {
      lesson: {
        id: 6, type: 'word_forms',
        title: parsed.title || 'Word Forms',
        desc:  parsed.desc  || 'Pick the form that fits',
        icon:  parsed.icon  || '🧩',
        items: valid,
        _genMeta: buildGenMeta({ type: 'word_forms', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: valid.length, rejected: rejected.length, rejectReasons: genReasonHist(rejected), promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens }),
      },
      tokens: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
    };
  }
  throw new Error(`Word-forms generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── inflections lesson type ────────────────────────────────────────────────
// User-designed follow-up to the inflection-coverage measurement (v80_f): "36.4% of taught words
// are ABSENT from the story in any form — that is a GENERATION problem, not a matching one." This
// type does not try to force the story or the standard vocab lesson to agree; it works the OTHER
// direction, mirroring word_forms above: draw from words the story ALREADY contains, in whatever
// inflected/derived form they actually appear (not the dictionary form standard vocab teaches), and
// build TWO multiple-choice questions per word — the lemma, and the grammatical form/derivation
// that connects the surface form back to it. Per the user's own design conversation: no grammatical
// taxonomy is hard-coded here (no fixed list of cases/tenses/genders) — the MODEL supplies both the
// correct label and the wrong-but-plausible distractor labels, per word, the same way it already
// supplies distractors for every other MCQ in the app. This is the same "model-declared, not
// app-authored" shape `PLAN §9b` ruling D1 already established for language-applicability facts.
function _inflNorm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
// Validate a batch of inflections items against the source story. Pure; returns {valid, rejected[]}
// so the generator can drop bad items and log why — same shape as validateWordFormsItems.
function validateInflectionsItems(items, story) {
  const storyNorm = _inflNorm(story);
  const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Dedupe a choice list case-insensitively and re-point the correct index at the given value —
  // the SAME salvage word_forms already uses for its own single choices array, applied to BOTH of
  // this type's two lists. A weak model often pads with repeats; that should not kill the item.
  const dedupe = (choicesRaw, correctVal) => {
    let cs = (Array.isArray(choicesRaw) ? choicesRaw : []).map(c => String(c == null ? '' : c).trim()).filter(Boolean);
    const seen = new Set(); const deduped = [];
    for (const c of cs) { const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); deduped.push(c); } }
    cs = deduped;
    let ci = cs.findIndex(c => c.toLowerCase() === String(correctVal || '').toLowerCase());
    if (cs.length > 6) {
      const keepAt = ci >= 0 ? ci : 0;
      const correct = cs[keepAt];
      cs = [correct, ...cs.filter((_, i) => i !== keepAt)].slice(0, 6);
      ci = 0;
    }
    return { choices: cs, correctIndex: ci };
  };
  const valid = [], rejected = [];
  for (const item of (items || [])) {
    const reasons = [];
    const sentence = (item && typeof item.sentence === 'string') ? item.sentence.trim() : '';
    const surfaceForm = (item && typeof item.surfaceForm === 'string') ? item.surfaceForm.trim() : '';
    const lemma = (item && typeof item.lemma === 'string') ? item.lemma.trim() : '';
    const formLabel = (item && typeof item.formLabel === 'string') ? item.formLabel.trim() : '';
    const { choices: lemmaChoices, correctIndex: lemmaCorrectIndex } = dedupe(item && item.lemmaChoices, lemma);
    const { choices: formChoices, correctIndex: formCorrectIndex } = dedupe(item && item.formChoices, formLabel);

    if (!sentence) reasons.push('missing sentence');
    if (!surfaceForm) reasons.push('missing surfaceForm');
    if (!lemma) reasons.push('missing lemma');
    if (!formLabel) reasons.push('missing formLabel');
    if (lemmaChoices.length < 2) reasons.push('need at least 2 lemma choices');
    if (formChoices.length < 2) reasons.push('need at least 2 form choices');
    if (lemmaCorrectIndex < 0) reasons.push('lemma not found among its own lemmaChoices');
    if (formCorrectIndex < 0) reasons.push('formLabel not found among its own formChoices');

    if (!reasons.length) {
      // The whole point of this type: surfaceForm must be a word GENUINELY present in the
      // sentence, as a whole word — not a paraphrase, not invented. Same word-boundary regex
      // shape validateWordFormsItems uses for its own answer-in-sentence check, including its
      // v82_c unspaced-script carve-out (UNSPACED_SCRIPTS_RE, above `_wfNorm`) — without it, every
      // genuinely correct Japanese/Thai/etc. surfaceForm not touching punctuation would fail here.
      const re = UNSPACED_SCRIPTS_RE.test(surfaceForm)
        ? new RegExp('(' + escapeRe(surfaceForm) + ')', 'iu')
        : new RegExp('(^|[^\\p{L}\\p{N}])(' + escapeRe(surfaceForm) + ')(?=[^\\p{L}\\p{N}]|$)', 'iu');
      if (!re.test(sentence)) reasons.push('surfaceForm not found as a whole word in sentence');
      // A GENUINE inflection differs from its own lemma — if the model just echoed the lemma
      // back, there is no derivation here to teach.
      if (_inflNorm(surfaceForm) === _inflNorm(lemma)) reasons.push('surfaceForm equals lemma — not an inflection');
      // Same translation-is-not-just-the-sentence check word_forms already applies.
      const trNorm = _inflNorm(item.translation || '');
      const trWords = trNorm.split(' ').filter(Boolean);
      if (trNorm && (trNorm === _inflNorm(sentence) || (trWords.length >= 3 && storyNorm.includes(trNorm)))) {
        reasons.push('translation is the target-language sentence, not a translation');
      }
    }

    if (reasons.length) rejected.push({ item, reasons });
    else valid.push({
      sentence, surfaceForm,
      translation: String((item && item.translation) == null ? '' : item.translation).trim(),
      lemma, lemmaChoices, lemmaCorrectIndex,
      formLabel, formChoices, formCorrectIndex,
      explanation: String((item && item.explanation) == null ? '' : item.explanation).trim(),
    });
  }
  return { valid, rejected };
}

async function generateInflections(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story } = opts;
  if (!story || !String(story).trim()) throw new Error('inflections: no story available');
  const _inflScript = opts.script || null;
  const L = langName(lang, _inflScript); const S = langName(srcLang || 'en');
  const n = (difficulty <= 1) ? 4 : (difficulty >= 3 ? 7 : 5);
  const sys = fillPrompt(PROMPTS.inflections.system, { L, S, EXAMPLE: fillPrompt(promptExample(PROMPTS.inflections, lang, srcLang), { L, S }) })
            + scriptPinNote(lang, _inflScript, 'inflections prompt');
  const userMsg = fillPrompt(PROMPTS.inflections.user, { L, S, story, n });
  const MAX_ATTEMPTS = 3;
  let totalPromptTokens = 0, totalCompletionTokens = 0, lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Inflections lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Inflections attempt ${attempt}…`);
    // Same silent-truncation guard word_forms carries (v72_f) — this prompt also embeds the whole
    // chapter story, so num_ctx must be sized against it rather than left at Ollama's default.
    const _ctxTokens = estimateCtxTokens(sys.length + userMsg.length, 1800 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sys, userMsg, 1800, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      try { parsed = extractJSON(raw); }
      catch(e2) { lastError = 'JSON extract failed: ' + stripRaw(raw).slice(0, 60); continue; }
    }
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) { lastError = 'No items in response'; continue; }
    const { valid, rejected } = validateInflectionsItems(parsed.items, story);
    if (rejected.length > 0) {
      console.warn(`    Inflections: ${rejected.length} item(s) rejected:`);
      rejected.forEach(r => console.warn(`      "${String(r.item && r.item.surfaceForm || '').slice(0, 30)}": ${r.reasons.join(', ')}`));
    }
    if (valid.length < 1) { lastError = `No valid items after filtering (${rejected.length} rejected)`; continue; }
    console.log(`    Inflections: ${valid.length} valid item(s) (${rejected.length} rejected)`);
    return {
      lesson: {
        id: 7, type: 'inflections',
        title: parsed.title || 'Inflections',
        desc:  parsed.desc  || 'Word forms and their dictionary form',
        icon:  parsed.icon  || '🧬',
        items: valid,
        _genMeta: buildGenMeta({ type: 'inflections', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: valid.length, rejected: rejected.length, rejectReasons: genReasonHist(rejected), promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens }),
      },
      tokens: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
    };
  }
  // Unlike word_forms (which can always find SOME word to blank), a language with little or no
  // inflection may genuinely have nothing to offer here (the prompt tells the model to return an
  // empty items array in that case) — but an empty array fails the "No items in response" check
  // above and retries like any other empty response, then surfaces as this same error after
  // MAX_ATTEMPTS. That is deliberate, not a bug to route around: it matches how every other
  // per-type generator in this file fails when a chapter genuinely has nothing to offer it (see
  // ADD_LESSON_GENERATORS's callers — a thrown error is caught and the type is skipped in an
  // "all types" bundle, or surfaced to the user on an explicit single-type add-lesson request).
  throw new Error(`Inflections generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── Generate synonyms / antonyms / homophones lesson ──────────────────────────
// Picks key words from the story and asks the LLM for better in-context synonyms,
// antonyms, and homophones (all in the target language, glossed in the source
// language). The related words are flattened into a standard vocab lesson, so the
// existing flashcard/MCQ player, checker, and editor handle it with no new type.
// ── synonyms context sentence ────────────────────────────────────────────────
// Split text into candidate sentences and find the first that contains `base`
// (whole-word, normalized). Used to present a synonym/antonym target in context.
// Split one paragraph into sentences.
//
// v72_a: boundaries come from Intl.Segmenter (Unicode UAX #29 sentence breaking), not from a
// hand-written terminator list. The list was the standing design-principle violation here: `[.!?…]`
// silently excluded EVERY terminator outside Latin script, so a Japanese story segmented as one
// unit (33 units across the whole ja corpus, against 176 correct ones) and Arabic lost every `؟`
// — `/[.!?…]/.test('؟')` is false. Unicode already knows all of this; we were re-deriving it badly.
//
// No locale is passed, deliberately. Sentence breaking is script-driven, and passing one changed
// the result on 0 of 1533 corpus paragraphs — so a locale would add an APP.lang dependency to a
// pure helper and buy nothing. Keeping it out is what keeps "no language knowledge in the code"
// true rather than merely relocated.
//
// Single newlines are flattened FIRST. Intl.Segmenter treats a line break as a sentence end;
// _sentenceUnits has already split paragraphs on \n\n+, so a surviving \n is a line WRAP. Without
// this, PDF-derived text shatters mid-clause ("…dei vigili del fuoco per ⏎ sottopassi allagati"),
// which is the very corruption v70_k's paragraph repair exists to prevent — 598 of 854 new split
// points across the corpus came from line breaks alone before this line was added.
//
// Measured against the previous scan on the whole corpus: +257 boundaries, -87, and NOT ONE
// character of text gained or lost anywhere. The losses are overwhelmingly the old code being
// wrong — 51 of them were mid-sentence hesitation ellipsis ("Forse... forse c'è qualcosa"), which
// it split and Unicode correctly does not.
//
// Kept in sync with the copy in server.js — see unit-sentence-segmentation.test.js, which asserts
// the two bodies are byte-identical. One rule per question.
function _sentenceSplit(p) {
  const s = String(p || '');
  if (!s.trim()) return [];
  const flat = s.replace(/\n/g, ' ');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const out = [];
    for (const seg of new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(flat)) {
      const t = seg.segment.trim();
      if (t) out.push(t);
    }
    if (out.length) return out;
  }
  // Fallback for engines without Intl.Segmenter. This is the pre-v72_a scan, kept verbatim so an
  // old browser degrades to the OLD behaviour rather than to no splitting at all.
  //
  // v71_b: a terminator only ends a sentence when something WHITESPACE-like follows it. A period
  // glued to the next character is part of a token, not a boundary — and the previous regex split
  // there, then _unitsToText rejoined the pieces with a space, so the text came back CORRUPTED:
  //     500.000 anni fa   ->  500. 000 anni fa        (the user's article says 500.000)
  //     S.J. Gould        ->  S. J. Gould
  // Written as a scan rather than a lookahead regex on purpose: `(?=\s|$)` on the old pattern makes
  // the whole alternative fail at a glued period, and the engine then resumes PAST it, silently
  // dropping "500." from the output. Walking the terminators keeps every character accounted for.
  const out = [];
  const re = /[.!?…]+["'»«”’)\]]*/gu;
  let start = 0, m;
  while ((m = re.exec(flat)) !== null) {
    const end = m.index + m[0].length;
    if (end < flat.length && !/\s/.test(flat[end])) continue;   // glued to what follows: not a boundary
    const piece = flat.slice(start, end).trim();
    if (piece) out.push(piece);
    start = end;
  }
  const tail = flat.slice(start).trim();
  if (tail) out.push(tail);
  return out.length ? out : (flat.trim() ? [flat.trim()] : []);
}

// The synonym-context pool: every sentence in the story, as candidate context for a target word.
//
// v72_a: this used to be a SECOND, independent splitter — and the two had already drifted. The
// server's list included 。！？ and the client's did not, so the two halves of the same pipeline
// disagreed about what a sentence is, with the server accidentally the more correct one. Both now
// route through the one _sentenceSplit above. Paragraphs are separated here rather than inside it
// so the helper stays a pure paragraph-level function on both sides.
function _synSplitSentences(text) {
  return String(text == null ? '' : text)
    .split(/\n\n+/)
    .reduce((acc, p) => acc.concat(_sentenceSplit(p)), [])
    .map(s => s.trim()).filter(s => s.length > 2);
}
function findContextSentence(base, sentencePools) {
  const b = _wfNorm(base);
  if (!b) return '';
  for (const pool of (sentencePools || [])) {
    for (const s of (pool || [])) {
      const toks = _wfNorm(s).split(' ').filter(Boolean);
      if (toks.includes(b)) return String(s).trim();
    }
  }
  return '';
}

// v72_d: accept the model's OWN context sentence — but only if it is really from the story.
//
// Before this, generateSynonyms reduced the story to eight keywords via extractKeywords and the
// model never saw a sentence at all. It chose synonyms for a word in ISOLATION, and the server then
// searched the story for a sentence containing that word and stapled it on afterwards. Nothing ever
// checked that the synonyms fit the sentence the learner is shown, which is exactly where polysemy
// bites: "preferenze" in an electoral-law story means preference VOTES, and a model working from a
// topic string can quite reasonably answer with the "tastes" sense.
//
// The model now quotes the sentence it had in mind. That only helps if the quote is real, so it is
// verified rather than trusted: a model asked to copy text will sometimes paraphrase, translate,
// merge two sentences, or invent one outright, and an invented sentence would be worse than the
// server-picked one it replaced. Two checks, both cheap and exact:
//   • the sentence appears in the story character-for-character (whitespace normalised, since the
//     model will not reproduce line wrapping)
//   • it actually CONTAINS the base word, whole-word — a correctly-quoted but irrelevant sentence
//     is still useless as context
// Anything that fails falls back to findContextSentence, so this can only improve on the old path.
function verbatimStorySentence(candidate, base, story) {
  const c = String(candidate == null ? '' : candidate).replace(/\s+/g, ' ').trim();
  if (!c) return '';
  const s = String(story == null ? '' : story).replace(/\s+/g, ' ');
  if (!s.includes(c)) return '';                      // paraphrased, merged, translated or invented
  const b = _wfNorm(base);
  if (!b) return '';
  if (!_wfNorm(c).split(' ').filter(Boolean).includes(b)) return '';   // quoted, but not the word
  return c;
}

async function generateSynonyms(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story, userDialect, chainVocab, vocabMode: synVocabMode } = opts;
  const L = langName(lang), S = langName(srcLang || 'en');
  const storyKeywords = story ? extractKeywords(story, 8, lang) : '';
  // v72_d: pass the STORY, not eight keywords extracted from it. The data was always here — it was
  // being thrown away one line later. Stories are small (corpus p50 787 chars, max 4691), so this
  // fits comfortably; the ceiling check mirrors generateComprehension and degrades to the old
  // keyword hint rather than silently sending a prompt Ollama would truncate (the v71_t trap).
  const storyForPrompt = String(story || '').trim();
  const _priorWords = (chainVocab?.words || []).slice(0, 12).map(v => v.target).filter(Boolean);
  const priorWords = _priorWords.join(', ');
  const P = PROMPTS && PROMPTS.synonyms;
  let sys, userMsg;
  if (P && P.system) {
    sys = fillPrompt(P.system, { L, S, diff: difficultyLabel(difficulty || 2), EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
    if (userDialect && P.dialectNote) sys += fillPrompt(P.dialectNote, { dialect: userDialect });
    const ss = getStoryStyle(opts.storyStyle); if (ss && P.writingStyleNote) sys += fillPrompt(P.writingStyleNote, { writingStyle: ss });
    const _fitsStory = storyForPrompt && P.storyBlock &&
      estimateCtxTokens(sys.length + storyForPrompt.length + 1200, 1800 * THINK_TOKEN_MULT) <= getNumCtxMax();
    userMsg = fillPrompt(P.user, { topic, L, S })
      + (_fitsStory ? fillPrompt(P.storyBlock, { story: storyForPrompt })
                    : (storyKeywords && P.storyHint ? fillPrompt(P.storyHint, { storyKeywords }) : ''))
      + (priorWords && P.priorHint && synVocabMode !== 'extend' ? fillPrompt(P.priorHint, { priorWords }) : '');
    if (storyForPrompt && !_fitsStory)
      console.log(`    Synonyms: story too large for num_ctx (${storyForPrompt.length} chars) — falling back to keyword hint`);
  } else {
    sys = `You are a ${L} vocabulary lesson generator (learner speaks ${S}). For useful ${L} words, give ${L} synonyms and ${L} antonyms that are genuine drop-in replacements in the word's own sentence, and ${L} homophones ONLY when they truly exist (else []). Prefer FEWER, certain entries over more, doubtful ones: [] is better than a word that does not really fit. Each word needs at least one synonym OR one antonym, not both. Glosses are short ${S} translations. Output strict JSON only.`;
    userMsg = `Topic: "${topic}".`
      + (storyKeywords ? `\nPrefer these ${L} words: ${storyKeywords}.` : '')
      + `\nReturn ONLY JSON: {"title":"...","desc":"...","icon":"🔁","words":[{"base":"<${L}>","gloss":"<${S}>","synonyms":[{"w":"<${L}>","g":"<${S}>"}],"antonyms":[],"homophones":[]}]}`;
  }
  // v79_f: appended after BOTH branches, so the inline fallback prompt cannot be the one that
  // drifts. `opts.script` is null for a monoscriptic language and scriptPinNote returns '' then.
  sys += scriptPinNote(lang, opts.script || null, 'synonyms prompt');
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
    // Sized like generateComprehension now that the whole story rides along: Ollama's default
    // num_ctx (~4096) truncates a long prompt SILENTLY, so the model would answer from a fragment
    // while every attempt "succeeded" (v71_t). A timeout is a ceiling, not a delay.
    const _ctxTokens = estimateCtxTokens(sys.length + userMsg.length, 1800 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sys, userMsg, 1800, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
    tp += promptTokens; tc += completionTokens;
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      try { parsed = extractJSON(raw); }        // v71_o: strips <think> before finding the JSON
      catch(e2) { lastError = 'JSON extract failed: ' + stripRaw(raw).slice(0, 60); continue; }
    }
    if (!Array.isArray(parsed.words) || !parsed.words.length) { lastError = 'No words in response'; continue; }
    // Context-sentence pool: current story always; for non-extend modes also pull
    // sentences from the chain (storyline / previous lessons) so reinforced words
    // are shown in a familiar sentence.
    const storySents = _synSplitSentences(story || '');
    const chainSents = (synVocabMode !== 'extend' && Array.isArray(chainVocab?.sentences)) ? chainVocab.sentences : [];
    const sentPools = synVocabMode === 'extend' ? [storySents] : [storySents, chainSents];
    const words = [];
    let nQuoted = 0, nRejected = 0;
    for (const entry of parsed.words) {
      const base = (entry.base ?? entry.word ?? '').toString().trim();
      if (!base) continue;
      const baseLc = base.toLowerCase();
      // a word can never be its own synonym/antonym/homophone
      const notBase = a => a.filter(x => x.w.toLowerCase() !== baseLc);
      const synonyms   = notBase(clean(entry.synonyms)).slice(0, 4);
      const antonyms   = notBase(clean(entry.antonyms)).slice(0, 3);
      const homophones = notBase(clean(entry.homophones)).slice(0, 2);
      // v72_e: an entry is quizzable with EITHER relation. buildSynExercises makes one select-all
      // per relation and skips the empty one, so an antonym-only word yields exactly one exercise
      // — the client already handled this; the server was the half that threw the word away.
      //
      // This exists so the prompt can be strict. It now tells the model that [] beats a doubtful
      // synonym, and a learner is marked WRONG for not picking a listed word, so a shaky entry
      // teaches something false. That instruction is only safe to give if dropping the weak
      // synonyms does not also drop a word whose ANTONYMS were solid.
      if (!synonyms.length && !antonyms.length) continue; // neither relation: nothing to ask
      // The model's own quote first (it chose the synonyms against THIS sentence), the server's
      // search only as a fallback. Order matters: the fallback sentence is correct but arbitrary.
      const quoted = verbatimStorySentence(entry.sentence, base, storyForPrompt);
      if (quoted) nQuoted++; else if (entry.sentence) nRejected++;
      const sentence = quoted || findContextSentence(base, sentPools);
      words.push({ base, gloss: (entry.gloss ?? '').toString().trim(), sentence, synonyms, antonyms, homophones });
    }
    if (!words.length) { lastError = 'No usable word groups (need a base + >=1 synonym)'; continue; }
    const antOnly = words.filter(w => !w.synonyms.length).length;
    const synN = words.reduce((n,w)=>n+w.synonyms.length,0);
    const homN = words.reduce((n,w)=>n+w.homophones.length,0);
    console.log(`    Synonyms: ${words.length} groups, ${synN} synonyms, ${homN} homophones` +
      (antOnly ? `, ${antOnly} antonym-only` : ''));
    // Logged because it is the only signal that the model actually read the story. A run reporting
    // 0 quoted is the symptom of a silently truncated prompt or a model ignoring the field.
    if (nQuoted || nRejected)
      console.log(`    Synonyms context: ${nQuoted} sentence(s) quoted from the story` +
        (nRejected ? `, ${nRejected} rejected as not verbatim (fell back to search)` : ''));
    return {
      lesson: {
        id: 6, type: 'synonyms',
        title: parsed.title || 'Synonyms & Antonyms',
        desc:  parsed.desc  || 'Related words from the story',
        icon:  parsed.icon  || '🔁',
        words,
        _genMeta: buildGenMeta({ type: 'synonyms', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: words.length, promptTokens: tp, completionTokens: tc }),
      },
      tokens: { promptTokens: tp, completionTokens: tc },
    };
  }
  throw new Error(`Synonyms generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── Generate reading-comprehension lesson (v71_l) ─────────────────────────────
// Story-based by design: the questions test whether the reader understood the TEXT, so there is
// nothing to generate without one. Callers gate the option on `topic.story`; this throws rather
// than inventing questions if it is ever reached without a story.
async function generateComprehension(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story, userDialect, chainStory } = opts;
  const L = langName(lang), S = langName(srcLang || 'en');
  // v71_o: prefer the whole chain (earlier chapters + this one). collectChainStory already keeps
  // the current chapter whole and trims from the oldest end, so this text is safe to use as-is.
  const storyText = String(chainStory || story || '').trim();
  if (!storyText) throw new Error('Comprehension lessons need a story — none on this chapter');
  // Question count scales with the story: a 3-paragraph chapter cannot honestly support 10
  // distinct comprehension questions, and padding produces the trivia the prompt forbids.
  // v71_t: sized on the CURRENT chapter, not the chain. The questions are set on the chapter the
  // learner just read — earlier chapters are context for callbacks, not extra material to quiz —
  // so counting the whole chain made every chained chapter ask the maximum 8 regardless of how
  // short it actually was. (Before this release the 6,000-char cap hid the error: a trimmed chain
  // already exceeded the ceiling, so it also always produced 8. Same output, wrong reason — and
  // the reason is what breaks now that the whole chain is sent.)
  const sizingText = String(story || '').trim() || storyText;
  const words = sizingText.split(/\s+/).filter(Boolean).length;
  const n = Math.max(3, Math.min(8, Math.round(words / 90)));
  // v71_o: a very long chapter plus a reasoning model was returning an EMPTY response — the budget
  // went entirely on reading and thinking, leaving nothing for the answer. Comprehension questions
  // do not need the last paragraph of a 3,000-word chapter to be good, so the prompt gets a
  // bounded excerpt. (Reported: "Ollama returned empty response" with thinking on.)
  // A chain assembled by collectChainStory is already inside budget and trimmed from the correct
  // (oldest) end; re-trimming here would cut the CURRENT chapter off the back — the one the
  // questions are actually about. Only an unbounded single story needs capping.
  // v71_t: the MAX_STORY_CHARS = 6000 fallback that used to sit here is GONE. It only ever applied
  // to a single un-chained story, and measured against the corpus it never once fired: the longest
  // single chapter is 4,691 chars. It was dead code protecting against a case that does not occur,
  // while the real truncation happened in collectChainStory (75 of 294 chains) and, invisibly, in
  // Ollama itself.
  //
  // What remains is a LAST-RESORT fit to the context ceiling. The ceiling is a memory decision
  // (the KV cache grows with num_ctx), so it can legitimately be set below what a 40,000-char
  // chain needs — and when it is, something has to give. The point is that WE decide what, not
  // Ollama: this trims from the FRONT, which is the oldest chapters, leaving the current chapter
  // (always last in the assembled text) whole. Ollama's own truncation makes no such promise, and
  // reports nothing. Normal-length stories never reach this branch.
  let storyForPrompt = storyText;
  {
    const _replyTokens = Math.max(3000, Math.ceil(3200 * THINK_TOKEN_MULT));
    const _ceiling = getNumCtxMax();
    const _fits = (chars) => estimateCtxTokens(chars + 1200 /* prompt scaffolding */, _replyTokens) <= _ceiling;
    if (!_fits(storyForPrompt.length)) {
      // Largest character count that fits, found directly rather than by loop.
      const _maxChars = Math.max(1000, Math.floor((_ceiling - _replyTokens - 512) * 3.2) - 1200);
      const _cut = storyForPrompt.length - _maxChars;
      storyForPrompt = '…' + storyForPrompt.slice(_cut).replace(/^\S*\s+/, '');
      console.log(`    Story trimmed to fit context ceiling: ${storyText.length} → ${storyForPrompt.length} chars ` +
                  `(num_ctx max ${_ceiling}; oldest chapters dropped, current chapter kept)`);
    }
  }
  const P = PROMPTS && PROMPTS.comprehension;
  let sys, userMsg;
  if (P && P.system) {
    sys = fillPrompt(P.system, { L, S, diff: difficultyLabel(difficulty || 2) });
    if (userDialect && P.dialectNote) sys += fillPrompt(P.dialectNote, { dialect: userDialect });
    userMsg = fillPrompt(P.user, { story: storyForPrompt, L, S, n });
  } else {
    sys = `You write reading-comprehension questions in ${L} for a learner who speaks ${S}. Test understanding of the text — events, motives, implications — never vocabulary or grammar. Output strict JSON only.`;
    userMsg = `Story:\n"""\n${storyForPrompt}\n"""\nWrite ${n} questions.\nReturn ONLY JSON: {"title":"...","desc":"...","icon":"🧠","questions":[{"q":"<${L}>","choices":["<${L}>","<${L}>","<${L}>","<${L}>"],"correctIndex":0,"why":"<${S}>"}]}`;
  }
  sys += scriptPinNote(lang, opts.script || null, 'comprehension prompt');   // v79_f — both branches
  const MAX_ATTEMPTS = 3;
  let tp = 0, tc = 0, lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Comprehension lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Comprehension attempt ${attempt}…`);
    // 3200 base (was 2200): callLLMLesson multiplies this when lessons-reasoning is ON, and the
    // old base left a thinking model too little room to emit the JSON after reasoning.
    //
    // v71_t: this call now carries the WHOLE chain (up to ~40k chars), so two things must scale
    // with it or the change is worse than useless:
    //   • num_ctx — Ollama's default (~4096) truncates a long prompt SILENTLY, so the model would
    //     answer from a blind fragment while every attempt "succeeded". ctxTokens is an estimate
    //     of prompt + reply + headroom, clamped to the ceiling inside llm.js.
    //   • timeoutMs — a 12k-token prompt takes far longer to INGEST than a 1.5k one, before a
    //     single token is generated. The roadmap's "raise the timeout instead" is this line.
    // Both are per-call: no other generator's memory or timeout profile changes.
    // NOTE: callLLMLesson spreads the caller's opts AFTER its own think policy, so a timeoutMs
    // passed here WINS — including over the ×3 that thinkOpts applies when lessons-reasoning is on.
    // Using THINK_TIMEOUT_MULT here means this can only ever raise the limit, never cut a
    // reasoning run short. (A timeout is a ceiling, not a delay: a generous one costs nothing when
    // the call returns quickly.)
    const _ctxTokens = estimateCtxTokens(sys.length + userMsg.length, 3200 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    if (attempt === 1 && storyForPrompt.length > 6000)
      console.log(`    Lesson context: ${storyForPrompt.length} chars → num_ctx≈${Math.min(_ctxTokens, getNumCtxMax())}, timeout ${Math.round(_timeout/1000)}s`);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sys, userMsg, 3200, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
    tp += promptTokens; tc += completionTokens;
    // v71_o (reported: "JSON extract failed" on all three attempts): parse through the shared
    // helpers. The hand-rolled version here stripped ``` fences but NOT the <think> block, so on a
    // reasoning model the first `{` it found was usually inside the model's own reasoning and every
    // attempt failed. stripRaw/extractJSON remove <think> first — which is exactly why they exist.
    let parsed = null;
    try { parsed = JSON.parse(stripRaw(raw)); }
    catch(_) {
      try { parsed = extractJSON(raw); }                       // first { … last }, think stripped
      catch(_2) {
        // Last resort: the model wrote the questions array but not the wrapper object.
        try { const arr = salvageArray(raw); if (Array.isArray(arr)) parsed = { questions: arr }; }
        catch(_3) { parsed = null; }
      }
    }
    if (!parsed) {
      lastError = 'Could not parse JSON';
      console.log(`      ✗ unparseable (${raw.length} chars). Starts: ${JSON.stringify(stripRaw(raw).slice(0, 120))}`);
      continue;
    }
    // A model that reasons often answers with the bare array, or nests it one level down.
    if (!Array.isArray(parsed.questions)) {
      if (Array.isArray(parsed)) parsed = { questions: parsed };
      else if (Array.isArray(parsed.items)) parsed.questions = parsed.items;
      else if (Array.isArray(parsed.quiz)) parsed.questions = parsed.quiz;
    }
    if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
      lastError = 'No questions in response';
      console.log(`      ✗ parsed, but no questions array. Keys: ${Object.keys(parsed).join(',') || '(none)'}`);
      continue;
    }
    const questions = [];
    const seen = new Set();
    for (const entry of parsed.questions) {
      const q = ((entry && (entry.q ?? entry.question ?? entry.prompt)) || '').toString().trim();
      if (!q) continue;
      const key = q.toLowerCase();
      if (seen.has(key)) continue;                       // the same question twice is not two questions
      // Models label the option list `choices`, `options` or `answers` about equally often; the
      // prompt asks for one and normalising the other two costs nothing.
      const rawChoices = Array.isArray(entry.choices) ? entry.choices
                       : Array.isArray(entry.options) ? entry.options
                       : Array.isArray(entry.answers) ? entry.answers : [];
      const choices = rawChoices
        .map(c => String(c == null ? '' : c).trim()).filter(Boolean);
      // Dedupe options case-insensitively: a repeated option means two "correct" answers on screen.
      const uniq = [], seenC = new Set();
      for (const c of choices) { const k = c.toLowerCase(); if (seenC.has(k)) continue; seenC.add(k); uniq.push(c); }
      if (uniq.length < 3) continue;                     // a 2-option "quiz" is a coin flip
      let ci = Number.isInteger(entry.correctIndex) ? entry.correctIndex : -1;
      // Models sometimes answer with the TEXT rather than the index; accept both.
      if ((ci < 0 || ci >= uniq.length) && entry.answer != null) {
        ci = uniq.findIndex(c => c.toLowerCase() === String(entry.answer).trim().toLowerCase());
      }
      if (ci < 0 || ci >= uniq.length) continue;         // unanswerable — drop rather than guess
      seen.add(key);
      questions.push({ q, choices: uniq.slice(0, 4), correctIndex: Math.min(ci, 3),
                       why: ((entry.why ?? '') + '').trim() });
    }
    if (questions.length < 2) { lastError = `Only ${questions.length} usable question(s)`; continue; }
    console.log(`    Comprehension: ${questions.length}/${n} questions kept`);
    return {
      lesson: {
        id: 9, type: 'comprehension',
        title: parsed.title || 'Understanding the story',
        desc:  parsed.desc  || 'Questions about what you read',
        icon:  parsed.icon  || '🧠',
        questions,
        _genMeta: buildGenMeta({ type: 'comprehension', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: questions.length, promptTokens: tp, completionTokens: tc }),
      },
      tokens: { promptTokens: tp, completionTokens: tc },
    };
  }
  throw new Error(`Comprehension generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── writing lesson type (PLAN §D4, v82) ───────────────────────────────────────
// "The user is supposed to WRITE a short text on a given topic, and a new model prompt receives
// that text and provides feedback on typos, grammar, and eventually also content." Architecturally
// distinct from every lesson type above it: this one is generated ONCE like the rest (a short
// writing TASK, here), but PLAYING it needs a LIVE model call at submission time — there is no
// correct answer to store, so nothing about grading belongs in this function. See the
// `/api/writing-feedback` route below for that half, and `roadmap_v82.md`'s `PLAN §D4` for the
// full split. Phase 1 only: typos + grammar. Content feedback is explicitly a later phase.
async function generateWriting(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story } = opts;
  if (!story || !String(story).trim()) throw new Error('writing: no story available');
  const L = langName(lang, opts.script || null), S = langName(srcLang || 'en');
  const sys = fillPrompt(PROMPTS.writing.system, { L, S, diff: difficultyLabel(difficulty || 2) })
            + scriptPinNote(lang, opts.script || null, 'writing prompt');
  const userMsg = fillPrompt(PROMPTS.writing.user, { L, story });
  const MAX_ATTEMPTS = 3;
  let tp = 0, tc = 0, lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Writing task attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Writing attempt ${attempt}…`);
    // This prompt embeds the WHOLE chapter story (PROMPTS.writing.user), so num_ctx must be sized
    // against it — same as every other full-story generator (generateInflections, generateSynonyms,
    // generateComprehension). Without this Ollama truncates a long prompt SILENTLY at its default
    // (~4096 tokens), and the task would be written from a fragment the model never admits to.
    const _ctxTokens = estimateCtxTokens(sys.length + userMsg.length, 500 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sys, userMsg, 500, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
    tp += promptTokens; tc += completionTokens;
    let parsed = null;
    try { parsed = JSON.parse(stripRaw(raw)); }
    catch(_) { try { parsed = extractJSON(raw); } catch(_2) { parsed = null; } }
    // v82_f (user): a reading-comprehension QUESTION, in {S} only — not a bilingual free-topic task.
    const question = (parsed && typeof parsed.question === 'string') ? parsed.question.trim() : '';
    if (!question) { lastError = 'No usable "question" in response'; continue; }
    console.log(`    Writing: question "${question.slice(0, 60)}${question.length > 60 ? '…' : ''}"`);
    return {
      lesson: {
        id: 10, type: 'writing',
        title: parsed.title || 'Writing practice',
        desc:  parsed.desc  || 'Answer the question in writing and get feedback',
        icon:  parsed.icon  || '✍️',
        question,
        _genMeta: buildGenMeta({ type: 'writing', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: 1, promptTokens: tp, completionTokens: tc }),
      },
      tokens: { promptTokens: tp, completionTokens: tc },
    };
  }
  throw new Error(`Writing generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// Parse a /api/writing-feedback reply. The prompt asks for "OK" or one "<wrong> => <fix> — <note>"
// line per mistake — the same text-not-JSON shape qcCheckPair/_qcParseOkOrSug use, chosen for the
// same reason: robust on a small model that may not hit a strict JSON schema. A reply that is
// neither "OK" nor in the requested shape is surfaced as a single freeform note rather than
// silently discarded — a real answer in the wrong format is still more useful than none.
// v82_f (user): the reply now carries TWO judgments — a CORRECTNESS verdict against the story (does
// the answer actually address the question), and the same typo/grammar issue list as before. The
// two must never contaminate each other (the prompt says so explicitly): a language mistake in an
// otherwise-correct answer should not lower the verdict, and a correct-but-clumsy answer should
// still surface its typos.
function parseWritingFeedback(text) {
  const reply = String(text || '').trim();
  const lines = reply.split('\n').map(l => l.trim()).filter(Boolean);
  const arrowRe = /^(.+?)\s*=>\s*(.+?)(?:\s*[—–-]\s*(.*))?$/;
  const verdictRe = /^CORRECTNESS:\s*(correct|partially correct|incorrect)\s*(?:[—–-]\s*(.*))?$/i;
  let correctness = null, correctnessNote = '';
  const issues = [];
  const stray = [];
  for (const line of lines) {
    const vm = line.match(verdictRe);
    if (vm && !correctness) { correctness = vm[1].toLowerCase(); correctnessNote = (vm[2] || '').trim(); continue; }
    const m = line.match(arrowRe);
    if (m) { issues.push({ wrong: m[1].trim(), fix: m[2].trim(), note: (m[3] || '').trim() }); continue; }
    stray.push(line);
  }
  if (!correctness) {
    // The model ignored the requested shape entirely — surface the whole reply as an "unknown"
    // verdict rather than silently discarding a real answer (same fallback principle phase 1 used).
    return { correctness: 'unknown', correctnessNote: reply.slice(0, 500), ok: issues.length === 0, issues };
  }
  // A stray line after a recognised verdict (the model added commentary outside the requested
  // shape) is folded into the verdict note rather than dropped, same "don't discard a real answer"
  // principle applied to the smaller case.
  if (stray.length) correctnessNote = [correctnessNote, ...stray].filter(Boolean).join(' ').slice(0, 500);
  return { correctness, correctnessNote, ok: issues.length === 0, issues };
}

// ── Generate conjugation lesson ───────────────────────────────────────────────
async function generateConjugation(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { userDialect, storyStyle, chainVocab, vocabMode: conjVocabMode, story } = opts;
  jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Generating conjugation lesson…`);
  const sys = sysConjugation(lang, srcLang, difficulty, userDialect, storyStyle, opts.script || null);
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
    // v71_o: extractJSON strips <think> first — see the note on the comprehension generator.
    try { parsed = extractJSON(raw); }
    catch(e2) { throw new Error('Conjugation: could not parse JSON: ' + stripRaw(raw).slice(0, 80)); }
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
      _genMeta: buildGenMeta({ type: 'conjugation', model: OLLAMA_LESSON_MODEL, t0: _t0, valid: (parsed.conjugations || []).length, promptTokens, completionTokens }),
    },
    tokens: { promptTokens, completionTokens },
  };
}

async function generateOneLesson(lang, srcLang, topic, lessonNum, totalLessons, prevVocab, story, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { userTranslation, userDialect, writingStyle, storyLang, chainVocab, vocabMode } = opts;
  const _script = opts.script || null;   // v76_h: names the script for a digraphic target language
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
      sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect, _script);
      const prevHint = prevVocab.length
        ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Extract vocabulary and sentences from this story and its translation.\n\nSTORY:\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}${chainHint}`;
    } else {
      sysPrompt = sysLessonFromText(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect, _script);
      const prevHint = prevVocab.length
        ? `\nVocabulary already used in earlier lessons (avoid repeating these):\n${prevVocab.map(v => v.target + ' = ' + v.source).join(', ')}`
        : '';
      userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.\n\nSTORY (${langName(lang)}):\n${story}\n\n${langName(srcLang||'en').toUpperCase()} TRANSLATION:\n${userTranslation}${prevHint}${chainHint}\n\nReturn only the JSON object.`;
    }
  } else if (useTable) {
    sysPrompt = sysLessonTable(lang, srcLang, lessonNum, totalLessons, difficulty, userDialect, _script);
    const prevHint = prevVocab.length
      ? `\nAvoid repeating these already-covered words: ${prevVocab.map(v=>v.target).join(', ')}`
      : '';
    const storyHint = story ? `\n\nContext story:\n${story}` : '';
    userMsg = `Topic: "${topic}". Lesson ${lessonNum} of ${totalLessons}.${storyHint}${prevHint}${chainHint}`;
  } else {
    sysPrompt = sysLesson(lang, srcLang, lessonNum, totalLessons, difficulty, null, userDialect, writingStyle, _script);
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
    // v72_f: sized from the ASSEMBLED userMsg, because only one of this function's four prompt
    // branches caps the story. The `1200 char cap` comment above applies to the standard branch
    // alone; the two my-text branches embed the whole story AND its whole translation, and the
    // table branch embeds the whole story. Measured on this corpus they all land just inside
    // Ollama's ~4096 default — the my-text branch only because no topic here HAS a translation.
    // With one of similar length it reaches ~4,700 tokens, i.e. silently truncated (v71_t), and a
    // translation is the entire point of that branch.
    const _ctxTokens = estimateCtxTokens(sysPrompt.length + userMsg.length, 2048 * THINK_TOKEN_MULT);
    const _timeout = Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT);
    const { text: raw, promptTokens, completionTokens } =
      await callLLMLesson(sysPrompt, userMsg, 2048, { ctxTokens: _ctxTokens, timeoutMs: _timeout });
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
    const skillTags = resolveVocabularySkillTags(lesson.vocab, lang, srcLang);
    lesson.vocab = skillTags.vocab;

    // v71_y: the v71_d article-symmetry REWRITE that used to sit here is gone. It held article lists
    // for 12 languages and always stripped, so it could only ever remove — turning `la grandine` /
    // `hail` into `grandine` / `hail`, dropping the gender an Italian learner needs while symmetric
    // siblings in the same lesson kept theirs. It made lessons LESS consistent than it found them.
    //
    // Article symmetry is now checked in the QC pass (qcCheckPair), which sees the lesson's other
    // pairs and can fix EITHER side — and which proposes rather than rewrites, so a wrong call is
    // visible in the flag UI instead of silently baked into the data. The generation prompt still
    // forbids a one-sided article; QC is the safety net for what slips through.

    // Sentences are optional — use whatever we get (may be none).
    if (!Array.isArray(lesson.sentences)) lesson.sentences = [];
    lesson.sentences = lesson.sentences.slice(0, 5).map(s => deriveSentenceWords(s, lang));

    // Detect a model copying target-language content into the source-language field (it "ignored"
    // the source language). Collect the offending items so they're visible on the console. For
    // CLOSE language pairs (dialects, or e.g. Lëtzebuergesch↔German) many items legitimately share
    // spelling, so we log them but do NOT block.
    //
    // v53_g — the vocab rule is a RATIO, not a bare count. A count alone conflates two things,
    // measured across all 267 topics (98 non-close lessons contain at least one identical item):
    //   • a real failure — the model wrote the source language into both fields. Observed at
    //     100% (8/8), 100% (8/8), 80% (4/5), 75% (6/8 ×2).
    //   • legitimate loanwords / proper nouns, which occur in EVERY pair regardless of closeness.
    //     Observed at 40% and below: "pasta, tagliatelle, risotto"; "café, fans, notes";
    //     "Champagne, Terroir"; "performance, DJ".
    // The distribution is bimodal with nothing between 40% and 75%, so any cut in that band
    // separates them. 0.6 sits mid-gap. The old `> 2` rule caught all 5 failures but also rejected
    // 4 perfectly good loanword lessons, which were then regenerated for nothing.
    // The SENTENCE rule is unchanged: the corpus has zero identical sentences in a non-close pair,
    // so there is no evidence to relax it — and a whole identical sentence is a far stronger signal
    // of a model failure than a shared word.
    const IDENTICAL_MIN_ITEMS = 3;     // floor: ignore 1–2 hits however small the lesson
    const IDENTICAL_MIN_RATIO = 0.6;   // …and only block when most of the lesson is identical
    const _sameField = a => a.target && a.source && a.target.trim().toLowerCase() === a.source.trim().toLowerCase();
    const vocabSame = lesson.vocab.filter(_sameField);
    const sentSame  = lesson.sentences.filter(_sameField);
    const _close = isCloseLangPair(lang, srcLang);
    const _ratio = lesson.vocab.length ? vocabSame.length / lesson.vocab.length : 0;
    const _blockVocab = vocabSame.length >= IDENTICAL_MIN_ITEMS && _ratio >= IDENTICAL_MIN_RATIO;
    if (vocabSame.length || sentSame.length) {
      const _verdict = _close ? ' — close pair, allowed'
        : (_blockVocab || sentSame.length > 1) ? ' — blocking, will retry'
        : ' — below ratio threshold (loanwords?), allowed';
      console.warn(`  [lesson ${lessonNum}] ${vocabSame.length}/${lesson.vocab.length} vocab (${Math.round(_ratio*100)}%) + ${sentSame.length} sentence item(s) with identical source/target (${lang}→${srcLang})${_verdict}:`);
      [...vocabSame, ...sentSame].forEach(it => console.warn(`      • ${it.target}  =  ${it.source}`));
    }
    if (!_close) {
      if (_blockVocab)
        throw new Error(`${vocabSame.length}/${lesson.vocab.length} vocab items (${Math.round(_ratio*100)}%) have identical source/target fields — model ignored source language, retrying`);
      if (sentSame.length > 1)
        throw new Error(`${sentSame.length} sentences have identical source/target fields — model ignored source language, retrying`);
    }

    return {
      lesson: {
        id: lessonNum,
        title: lesson.title || `Lesson ${lessonNum}`,
        desc:  lesson.desc  || topic,
        icon:  lesson.icon  || '📖',
        vocab: lesson.vocab,
        sentences: lesson.sentences,
        skillIds: skillTags.skillIds,
        _skillTags: { type: 'vocab', proposed: lesson.vocab.length, resolved: skillTags.skillIds.length,
          pending: skillTags.pending },
        _genMeta: buildGenMeta({ type: 'standard', model: OLLAMA_LESSON_MODEL, t0: _t0, valid: (lesson.vocab || []).length, promptTokens, completionTokens }),
      },
      tokens: { lessonNum, ms, promptTokens, completionTokens }
    };
  });
}

// ── Generate all lessons ──────────────────────────────────────────────
async function generate(topic, lang, srcLang, difficulty, continuedFrom, storyLen, jobId, userOpts) {
  userOpts = userOpts || {};
  const { userStory, userTranslation, userDialect, storyStyle, lessonFormat, reinforcePrior, vocabMode, useFullChain, userStoryLang, prevStoryTopic, mathInstruction, skipMeta, placeholderTopic, parentId, fromLearned } = userOpts;
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
  // Per-artifact model provenance — capture the model ACTUALLY used at the moment each artifact
  // is produced (not re-read at the end), so a runtime model switch mid-run can't misattribute.
  // `story` stays null for a user-provided story; `translation` stays null when translation is skipped.
  let _storyModel = null, _translationModel = null;
  // Per-artefact stamp for the story, matching lessons' `_genMeta` and the storyline's
  // `summaryMeta`. `generationStats.models.story` already records WHICH model, but not how long
  // it took, how many tokens it cost, or when — and it is absent on every topic generated before
  // that field existed (249 of 267 in the shipped corpus). A user-pasted story is stamped
  // '(user-provided)' rather than left null, so "no model" and "unknown" stop looking alike.
  let _storyMeta = null;
  // Per-artefact stamp for the translation, mirroring `_storyMeta`. `generationStats.models
  // .translation` records WHICH model but conflates three states as `null`: user-supplied a
  // translation, translation was skipped (no story, or translation-model == story-model so the
  // story model already emitted the source-language side), and auto-translate failed. This stamp
  // gives each a distinct `model` + `origin`, matching how `_storyMeta` separates '(user-provided)'
  // from 'generated'. Left null only when there is genuinely no translation on the topic at all.
  let _translationMeta = null;

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
      `Topic: "${topic}". Source language for output: ${langName(srcLang)}. Return the JSON with topic and topicEmoji, all text in ${langName(srcLang)}.`, 256, { think: false });
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
      const { text: rawT, promptTokens: pt, completionTokens: ct } = await callLLM(sysTransMeta, toTranslate, 128, { think: false });
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
    // `model` says WHO wrote the text (nobody — the user supplied it). `origin` says WHERE it came
    // from. Stamped 'user-pasted' (v68.1: was the out-of-vocabulary 'user-provided', which broke the
    // corpus invariant on the first pasted story) because a chapter is saved before the storyline's
    // sourceFile is known; the post-pass below refines 'user-pasted' → 'file-upload' once it is.
    _storyMeta = buildGenMeta({ type: 'story', model: '(user-provided)', valid: story ? 1 : 0 });
    _storyMeta.origin = 'user-pasted';
    _storyMeta.source = 'recorded at generation';
    console.log(`    Using user-provided story (${story.length} chars)${userTranslation?' + translation':''}${userDialect?', dialect: '+userDialect:''}`);
  } else {
    // v79_b (user ruling at the v79 cut): `useFullChain` now means what its label says.
    //
    // It promised "pass the full storyline as context" and delivered the PARENT CHAPTER — in full
    // when set, its last OLLAMA_MAX_PREV_STORY characters when not. So every continuation was
    // written from one chapter of context however the box was set, which is a plausible cause of
    // drift across a long storyline. Measured on the corpus at the cut: of 236 continuations, 128
    // (54%) have a parent SHORTER than the 800-char tail, so for most chapters the box did nothing
    // at all; the storyline behind a continuation is a median 3,297 chars against a median parent
    // of 671, i.e. the label was promising ~3.3x the context it passed.
    //
    // The chain comes from collectChainStory — the same collector the LESSON path uses — so the two
    // contexts cannot drift apart, and its trim is the deliberate one: predecessors are dropped from
    // the OLDEST end and the most recent chapter is always kept whole.
    //
    // ⚠️ Sizing is part of the change, not a follow-up (v71_t). This call site passed no ctxTokens,
    // so Ollama used its ~4096 default — which today's single parent never exceeds (longest chapter
    // in the corpus: 4,691 chars, ~3,203 estimated tokens) but a chain does at the 90th percentile
    // (8,021 chars, ~4,244 tokens) and comfortably at the top (43,312 chars). Feeding the chain
    // without num_ctx would move the truncation from a trim we choose into a silent one Ollama
    // makes, with every generation still "succeeding". The budget is derived from the ceiling and
    // handed to collectChainStory, so the trim happens where the chapter boundaries are known
    // rather than mid-sentence afterwards.
    const _prevNode = parentTopic || (continuedFrom ? findSaved(continuedFrom) : null);
    const prevStoryFull = (parentTopic && parentTopic.story) ? parentTopic.story
      : (continuedFrom ? (findSaved(continuedFrom)?.story || null) : null);
    // The story reply budget, needed BEFORE the prompt so the context budget can be sized against
    // it. Same expression as before, only hoisted (thinkOpts is pure).
    const _baseStoryTokens = Math.min(4096, Math.ceil((storyLen||300) * 1.5) + 400);
    const _sOpts = thinkOpts('story', _baseStoryTokens);
    let _chainCtx = { text: '', chapters: 0 };
    if (prevStoryFull && useFullChain && _prevNode) {
      const _replyTokens = Math.max(1024, _sOpts.tokens || 1024);
      const _ceiling = getNumCtxMax();
      // Largest context that fits, found directly rather than by loop — 3.2 chars/token to match
      // estimateCtxTokens, less the prompt scaffolding the story system message costs.
      const _maxChars = Math.max(1000, Math.floor((_ceiling - _replyTokens - 512) * 3.2) - 1200);
      _chainCtx = collectChainStory(_prevNode, Math.min(CHAIN_STORY_CHARS, _maxChars));
    }
    // One chapter of chain is the parent chapter, which is what the box already gave: keep the old
    // shape exactly (no "## title" header) so the change is confined to the case it is for.
    const _useChain = _chainCtx.chapters > 1;
    const prevStory = _useChain ? _chainCtx.text
      : prevStoryFull ? (useFullChain ? prevStoryFull : prevStoryFull.slice(-OLLAMA_MAX_PREV_STORY))
      : null;
    if (continuedFrom && prevStory)
      console.log(`    Continuing from: "${continuedFrom}" (story prompt: `
        + (_useChain ? `full storyline, ${_chainCtx.chapters} chapters, ${prevStory.length} chars`
           : useFullChain ? `previous chapter in full, ${prevStory.length} chars`
           : `last ${prevStory.length}/${prevStoryFull.length} chars of the previous chapter`)
        + ')');
    jobStep(jobId, `[${OLLAMA_MODEL}] Generating story (~${storyLen} words)…`);
    try {
      const t0 = Date.now();
      // "My story" (fromLearned): seed the story with the learner's own known words so it
      // reuses what they've learned — biased toward words they got wrong — instead of a topic
      // or a previous story. Reuses the whole downstream pipeline unchanged. (Reinforce-as-
      // context: the wrong words are ALSO woven into lessons via the chainVocab/reinforce path.)
      const _learnedWords = (fromLearned && Array.isArray(fromLearned.vocab)) ? fromLearned.vocab : [];
      const _myMode = (vocabMode === 'extend' || vocabMode === 'neutral') ? vocabMode : 'reinforce';
      const storyUserMsg = _learnedWords.length
        ? (() => {
            const known = _learnedWords.map(w => w.target).filter(Boolean);
            const hard = _learnedWords.filter(w => w && w.wrong).map(w => w.target).filter(Boolean);
            const knownList = known.slice(0, 40).join(', ');
            const hardList = hard.slice(0, 20).join(', ');
            if (_myMode === 'extend') {
              // Build BEYOND what they know: use the known words as a familiar base but introduce
              // fresh vocabulary so the learner extends their range.
              return `Write a short, simple story in ${langName(lang)} for a learner who already knows these words: ${knownList}.`
                + `\nUse those familiar words as a base, but also introduce some NEW vocabulary so they learn a little more.`
                + (hardList ? `\nWhere natural, revisit words they found difficult: ${hardList}.` : '')
                + `\nKeep it at their level. Plain prose, no headings.`;
            }
            // reinforce (default) and neutral both center on reusing the known words; neutral just
            // doesn't force-weave them into the lessons afterward.
            return `Write a short, simple story in ${langName(lang)} that naturally reuses as many of these words the learner already knows as possible: ${knownList}.`
              + (hardList ? `\nGive extra attention to words the learner found difficult — try to include these: ${hardList}.` : '')
              + `\nKeep it easy to read at their level. Plain prose, no headings.`;
          })()
        : prevStory
          ? `${_useChain ? `Previous story (the full storyline so far, ${_chainCtx.chapters} chapters)`
                         : useFullChain ? 'Previous story (full)' : 'Previous story (excerpt)'}:\n${prevStory}`
            + `\n\nNew topic: "${userTopic}". Write the continuation now. Plain prose, no headings.`
          : `Write a story for the topic: "${userTopic}". Plain prose, no headings.`;
      // v60.7: reasoning is per-role and OFF by default. think:false keeps a story as plain prose
      // (and, on a reasoning model, avoids spending the whole num_predict inside <think> → empty
      // response — the v60.5 fix). When the user opts the STORY role into reasoning, thinkOpts
      // flips think:true AND bumps the token budget + timeout so the answer survives the think
      // block. (Mirrors the v55_c think:false applied to QC/storyboard.) `_sOpts` is computed
      // above, because the context budget is sized against its reply allowance.
      const storySystem = sysStory(lang, !!prevStory, storyLen, userDialect, storyStyle, userOpts.script, difficulty);
      // v79_b: num_ctx and the timeout, but ONLY when the chain is actually being fed — a single
      // chapter has never come near the default and does not need a bigger window reserved for it
      // (the KV cache grows with num_ctx, so asking for one is not free). Math.max means this can
      // only ever RAISE the timeout, never cut a reasoning run short: thinkOpts already sets
      // timeoutMs to the same product when story-reasoning is on.
      const _ctxOpts = _useChain
        ? { ctxTokens: estimateCtxTokens(storySystem.length + storyUserMsg.length, _sOpts.tokens),
            timeoutMs: Math.max(_sOpts.timeoutMs || 0, Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT)) }
        : {};
      if (_useChain)
        console.log(`    Story context: ${_chainCtx.chapters} chapters, ${prevStory.length} chars `
          + `→ num_ctx≈${Math.min(_ctxOpts.ctxTokens, getNumCtxMax())}, `
          + `timeout ${Math.round(_ctxOpts.timeoutMs/1000)}s`);
      const { text, promptTokens, completionTokens } = await callLLM(
        storySystem, storyUserMsg, _sOpts.tokens, { ..._sOpts, ..._ctxOpts });
      story = text.trim();
      _storyModel = OLLAMA_MODEL;
      _storyMeta = buildGenMeta({ type: 'story', model: OLLAMA_MODEL, t0, valid: story ? 1 : 0,
        promptTokens, completionTokens });
      _storyMeta.origin = 'generated';
      _storyMeta.source = 'recorded at generation';
      storyPrompt = storySystem + '\n\n' + storyUserMsg;
      totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
      console.log(`    [${OLLAMA_MODEL}] Story (${lang}, ~${storyLen}w): ${Date.now()-t0}ms, ${story.length} chars`);
    } catch(e) {
      throw new Error(`Story generation failed: ${e.message}`);
    }
  }

  // ── Translation ───────────────────────────────────────────────────────
  let storyTranslation = userTranslation || null;
  // v65.1: ALWAYS translate a generated story into the source language when we don't already have a
  // user-supplied translation. Previously this only ran when the translation model DIFFERED from the
  // story model, so a single-model setup silently produced no translations at all — which is why the
  // read-story translation toggle appeared "missing" (it correctly hides when there is nothing to
  // show). The translation is used three ways: as context for lesson generation (more accurate
  // vocabulary pairs), as the source text for the read-story toggle, and as the substrate for future
  // dialect lessons built from story+translation.
  const shouldAutoTranslate = !!story && !storyTranslation;

  if (shouldAutoTranslate) {
    jobStep(jobId, `[${OLLAMA_TRANSLATION_MODEL}] Translating story to ${langName(srcLang)}…`);
    try {
      const t0 = Date.now();
      const { text, promptTokens, completionTokens } = await callLLMTranslation(
        sysTranslation(lang, srcLang), story, Math.min(2048, Math.ceil(story.length * 1.2)),
        { think: false });   // v65.1: translation is mechanical — reasoning would only burn the budget
      storyTranslation = text.trim();
      _translationModel = OLLAMA_TRANSLATION_MODEL;
      _translationMeta = buildGenMeta({ type: 'translation', model: OLLAMA_TRANSLATION_MODEL, t0,
        valid: storyTranslation ? 1 : 0, promptTokens, completionTokens });
      _translationMeta.origin = 'generated';
      _translationMeta.source = 'recorded at generation';
      totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
      console.log(`    [${OLLAMA_TRANSLATION_MODEL}] Translation (${lang}→${srcLang}): ${Date.now()-t0}ms, ${storyTranslation.length} chars`);
    } catch(e) {
      console.warn('  Translation failed, falling back to context-only mode:', e.message);
      storyTranslation = null;
      // Distinguish a FAILED attempt from one never attempted (both leave storyTranslation null).
      _translationMeta = buildGenMeta({ type: 'translation', model: '(none)', valid: 0 });
      _translationMeta.origin = 'failed';
      _translationMeta.source = 'recorded at generation';
    }
  }

  // Stamp the non-auto-translate paths so `models.translation === null` means only "no
  // translation exists", never "unknown provenance". (buildGenMeta requires a model, so these
  // carry sentinels — the same '(user-provided)'/'(none)' vocabulary `_storyMeta` uses.)
  if (!_translationMeta && storyTranslation) {
    // A translation exists but wasn't produced by the auto-translate path → the user supplied it.
    _translationMeta = buildGenMeta({ type: 'translation', model: '(user-provided)',
      valid: storyTranslation ? 1 : 0 });
    _translationMeta.origin = 'user-provided';
    _translationMeta.source = 'recorded at generation';
  } else if (!_translationMeta && story && OLLAMA_TRANSLATION_MODEL === OLLAMA_MODEL) {
    // No separate translation call: the story model IS the translation model, so the
    // source-language side (when present) came from the story model, not a distinct pass.
    _translationMeta = buildGenMeta({ type: 'translation', model: '(none)', valid: 0 });
    _translationMeta.origin = 'skipped-same-model';
    _translationMeta.source = 'recorded at generation';
  }
  // Otherwise (_translationMeta stays null): no story, or no translation of any kind → correctly
  // absent, exactly like `models.translation === null`.

  // Release story/translation model from VRAM before loading lesson model
  if (OLLAMA_LESSON_MODEL !== OLLAMA_MODEL) {
    console.log(`    Releasing [${OLLAMA_MODEL}] from VRAM…`);
    await releaseOllamaModel(OLLAMA_MODEL);
    if (OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL && OLLAMA_TRANSLATION_MODEL !== OLLAMA_LESSON_MODEL)
      await releaseOllamaModel(OLLAMA_TRANSLATION_MODEL);
  }

  // ── Save story early (before lesson generation, so story is never lost) ──
  // v69_q: mint the id HERE, before the first upsert. This is the true root of the same-title
  // collision — the early save previously had no id, so two book chapters sharing a headline
  // dedup-merged at THIS point (before _persistGenerated ever ran), and the second overwrote the
  // first. `_genTopicId` is threaded through so the final lesson-bearing save updates the same row.
  let _genTopicId = null;
  if (store.schemaVersion >= 29) {
    // Reuse the existing row's id only when this is a genuine in-place regenerate: same title AND
    // the same chain parent. Without the parent check, two same-titled siblings in one book would
    // still collide. Otherwise mint a fresh id so siblings stay distinct.
    const k = (meta.topic || topic || '').trim().toLowerCase();
    const existing = store.topics.find(l =>
      l.topic.toLowerCase() === k && (l.lang||'') === (lang||'') && (l.srcLang||'') === (srcLang||'')
      && ((l.continuedFromId||null) === (continuedFromId||null)));
    _genTopicId = (existing && existing.id) || _newTopicId();
  }
  if (story) {
    upsert({
      ...(_genTopicId ? { id: _genTopicId } : {}),
      topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
      userTopic, userPrompt, lang, srcLang, difficulty: difficulty || 2, storyLen,
      ...(userOpts.script    ? { script: userOpts.script }       : {}),
      ...(userOpts.srcScript ? { srcScript: userOpts.srcScript } : {}),
      story, storyLang, storyPrompt,
      ...(_storyMeta ? { storyMeta: _storyMeta } : {}),
      ...(_translationMeta ? { translationMeta: _translationMeta } : {}),
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

  // "My story": feed the learner's known words (wrong-first) into the lesson generator. The
  // vocab-mode selector controls HOW: 'reinforce' (default) weaves them into sentences as context;
  // 'extend' treats them as already-known and pushes FRESH vocab instead; 'neutral' seeds only the
  // story (no chain-vocab hint into lessons). Same chainVocab/vocabMode channel as cross-chapter.
  const _fromLearnedVocab = (fromLearned && Array.isArray(fromLearned.vocab))
    ? fromLearned.vocab
        .slice()
        .sort((a, b) => (b.wrong || 0) - (a.wrong || 0))     // most-wrong first
        .map(w => ({ target: w.target, source: w.source || '' }))
        .filter(w => w.target)
    : null;
  const _hasLearnedVocab = !!(_fromLearnedVocab && _fromLearnedVocab.length);
  // For my-story, honour an explicit vocabMode; default to 'reinforce' when none was sent.
  const _vocabMode = _hasLearnedVocab
    ? (vocabMode || 'reinforce')
    : (vocabMode || (reinforcePrior ? 'reinforce' : 'neutral'));
  const chainVocab = (_hasLearnedVocab && _vocabMode !== 'neutral')
    ? { words: _fromLearnedVocab.slice(0, 40), nouns: [], verbs: [] }
    : (!_hasLearnedVocab && _vocabMode !== 'neutral' && chainParent)
      ? collectChainVocab(findSaved(chainParent)?.id || chainParent)
      : { words: [], nouns: [], verbs: [] };
  // v72_f: the chain STORY, alongside the chain vocab collected just above. generateComprehension is
  // its only consumer and it already prefers `chainStory || story` — but this call path was the one
  // of five that never supplied it, so a comprehension lesson created WITH a chapter saw only that
  // chapter while the same lesson ADDED afterwards saw the whole storyline. Measured on the corpus:
  // "Wahlrecht im Fokus" is 749 chars on its own and 4,139 across its four chapters, so the two
  // routes differed by 5.5x for identical output.
  //
  // The current chapter is not persisted yet here, so it cannot be walked from the store. The
  // synthetic node is the same shape the arc path builds for the same reason: this chapter's story
  // last and whole, predecessors ahead of it, trimmed from the oldest end.
  const _chainStory = chainParent
    ? collectChainStory({ id: null, topic, story, continuedFromId: findSaved(chainParent)?.id || null })
    : { text: '', chapters: 0 };
  if (_chainStory.chapters > 1)
    console.log(`    Lesson context: ${_chainStory.chapters} chapters, ${_chainStory.text.length} chars`);
  const chainOpts = { userDialect, storyStyle, chainVocab, vocabMode: _vocabMode, story,
                      script: userOpts.script || null,
                      chainStory: _chainStory.text, chainStoryChapters: _chainStory.chapters };

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation' || lessonFormat === 'math' || lessonFormat === 'synonyms' || lessonFormat === 'word_forms' || lessonFormat === 'comprehension' || lessonFormat === 'inflections' || lessonFormat === 'writing') {
    const genFn   = lessonFormat === 'math'
      ? (mathInstruction
          ? () => generateMathLLM(lang, srcLang, difficulty, mathInstruction, jobId)
          : () => Promise.resolve(generateMath(story, difficulty)))
                  : lessonFormat === 'error_hunt'  ? () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words, chainOpts)
                  : lessonFormat === 'grammar'      ? () => generateGrammar(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'synonyms'     ? () => generateSynonyms(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'word_forms'   ? () => generateWordForms(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'inflections'  ? () => generateInflections(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'comprehension' ? () => generateComprehension(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'writing'      ? () => generateWriting(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  :                                   () => generateConjugation(topic, lang, srcLang, difficulty, jobId, chainOpts);
    const label   = lessonFormat === 'math'        ? 'Math'
                  : lessonFormat === 'error_hunt'  ? 'Error-hunt'
                  : lessonFormat === 'grammar'      ? 'Grammar'
                  : lessonFormat === 'synonyms'     ? 'Synonyms'
                  : lessonFormat === 'word_forms'   ? 'Word-forms'
                  : lessonFormat === 'inflections'  ? 'Inflections'
                  : lessonFormat === 'comprehension' ? 'Comprehension'
                  : lessonFormat === 'writing'       ? 'Writing'
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
      script: userOpts.script || null,
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
      // Generate word_forms, synonyms, and error_hunt as additional lessons
      // (word_forms + synonyms supersede the old grammar/conjugation extras).
      const extraFmts = [
        { fmt: 'word_forms',  label: 'Word Forms',  fn: () => generateWordForms(topic, lang, srcLang, difficulty, jobId, chainOpts) },
        { fmt: 'synonyms',    label: 'Synonyms',    fn: () => generateSynonyms(topic, lang, srcLang, difficulty, jobId, chainOpts) },
        { fmt: 'error_hunt',  label: 'Error Hunt',  fn: () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words, chainOpts) },
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
    ...(_genTopicId ? { id: _genTopicId } : {}),   // v69_q: carry the id minted at the early save
    topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
    userTopic, userPrompt, lang, srcLang, difficulty: difficulty || 2, storyLen,
    story, storyLang, storyPrompt,
    ...(_storyMeta ? { storyMeta: _storyMeta } : {}),
    ...(_translationMeta ? { translationMeta: _translationMeta } : {}),
    ...(storyTranslation ? { storyTranslation } : {}),
    ...(userStory        ? { userStory }         : {}),
    ...(userTranslation  ? { userTranslation }   : {}),
    ...(userDialect      ? { userDialect }       : {}),
    ...(chainParent      ? { continuedFrom: chainParent } : {}),
    ...(continuedFromId  ? { continuedFromId }   : {}),
    ...(storyStyle       ? { storyStyle }        : {}),
    // v76_h: the script this chapter was written in, so the NEXT chapter can inherit it and the
    // backfill never has to guess. It must be on the returned object, not only on the mid-flight
    // upsert above — upsert REPLACES an entry rather than merging, so the final upsert(data) in
    // the caller would otherwise drop it.
    ...(userOpts.script    ? { script: userOpts.script }       : {}),
    ...(userOpts.srcScript ? { srcScript: userOpts.srcScript } : {}),
    ...(lessonFormat && !['standard'].includes(lessonFormat) ? { lessonFormat } : {}),
    lessons,
    generationStats: { totalMs, backend: 'ollama', model: modelLabel,
      models: { story: _storyModel, translation: _translationModel, lessons: OLLAMA_LESSON_MODEL },
      lessonFormat: OLLAMA_LESSON_FORMAT,
      totalPromptTokens, totalCompletionTokens, lessons: lessonTokenStats }
  };
}

// Add-lesson generate registry (B-phase-4). The /api/lessons/add-lesson handler dispatches
// a lessonFormat (fmt) to its generator through this map instead of a hand-kept if/else
// chain, so a new lesson type is one row here. The generators have heterogeneous
// signatures, so each entry is a thin adapter over a single context object (built in the
// handler where `saved` and the request locals are in scope). Per-type *validators* still
// live inside the generators (salvage-oriented), unchanged. Unknown fmt → no entry → the
// handler throws "Unsupported lessonFormat", identical to the old chain's else.
const ADD_LESSON_GENERATORS = {
  standard:    (c) => generateOneLesson(c.lang, c.srcLang, c.topicName, 1, 1, [], c.story, c.diff, c.jobId, c.standardOpts),
  error_hunt:  (c) => generateErrorHunt(c.story, c.lang, c.diff, c.jobId, c.chainVocab.words, c.sharedGenOpts),
  grammar:     (c) => generateGrammar(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  conjugation: (c) => generateConjugation(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  synonyms:    (c) => generateSynonyms(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  comprehension: (c) => generateComprehension(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  word_forms:  (c) => generateWordForms(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  inflections: (c) => generateInflections(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  writing:     (c) => generateWriting(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  math:        (c) => c.addMathInstr
    ? generateMathLLM(c.lang, c.srcLang, c.diff, c.addMathInstr, c.jobId, c.script || null)
    : generateMath(c.story, c.diff, c.addMathOps || null),
  // Topic-independent + LLM-free: ignores the story, builds from the script table.
  intro_script: (c) => generateIntroScript(c.lang, { script: c.introScript || null, difficulty: c.diff, srcLang: c.srcLang }),
};

// v71_u: the canonical list of types an arc / add-lessons run may request. Mirrors the client's
// ADD_LESSON_TYPES; anything outside it is dropped rather than trusted, since it arrives over HTTP.
// `review` and `standard` are not in ADD_LESSON_GENERATORS (both are generateOneLesson with
// different vocab modes), so they are named here explicitly.
const ARC_LESSON_TYPES = ['standard', 'review', 'word_forms', 'inflections', 'synonyms', 'grammar',
                          'conjugation', 'comprehension', 'error_hunt', 'math',
                          // v79_h: `intro_script` is in ADD_LESSON_GENERATORS and was reachable
                          // from the per-chapter dropdown, but not from this whitelist — so a
                          // storyline-level run that ticked it would have had it dropped here,
                          // silently and with no error. The client gate and this list are the two
                          // halves of one decision and both had to change.
                          // v82_e: `writing` (PLAN §D4) — the STEM (a writing task) is generated
                          // here like every other type; grading happens live at play time via
                          // /api/writing-feedback, not through this batch path at all.
                          'intro_script', 'writing'];
function sanitizeArcTypes(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  return list.filter(t => typeof t === 'string' && ARC_LESSON_TYPES.includes(t)
                       && !seen.has(t) && seen.add(t));
}
// Back-compat: the pre-v71_u book form sent a two-value `arcMode` instead of a list. Translating it
// here — rather than leaving the old branch alive alongside the new one — is what stops the two
// paths drifting again. 'vocab' was one review lesson; 'grammar' was word_forms + synonyms.
function arcTypesFromLegacyMode(arcMode, arcReinforce) {
  if (arcMode === 'grammar') {
    const r = sanitizeArcTypes(arcReinforce);
    return (r && r.length) ? r : ['word_forms', 'synonyms'];
  }
  return ['review'];
}
// ONE lesson for ONE requested type. Both the book arc and the storyline add-lessons run go through
// this, so a type behaves identically wherever it was ticked. Returns the lesson or null; throwing
// is left to the caller, which decides whether one bad type aborts the run (it does not).
async function generateArcLesson(aType, ctx) {
  if (aType === 'standard' || aType === 'review') {
    const vOpts = aType === 'review'
      ? { ...(ctx.reviewOpts || {}), story: ctx.story, chainVocab: ctx.chainVocab?.words || [], vocabMode: 'reinforce' }
      : { ...(ctx.standardExtra || {}), story: ctx.story, vocabMode: null, script: ctx.script || null };
    const { lesson } = await generateOneLesson(
      ctx.lang, ctx.srcLang, ctx.topicName, 1, 1, [], ctx.story, ctx.diff, ctx.jobId, vOpts);
    if (lesson && aType === 'review') {
      lesson._arcMode = 'reinforce';
      if (!lesson.title) lesson.title = 'Review words';
      if (!lesson.icon) lesson.icon = '🔁';
    }
    return lesson || null;
  }
  const gen = ADD_LESSON_GENERATORS[aType];
  if (!gen) return null;
  const { lesson } = await gen({
    lang: ctx.lang, srcLang: ctx.srcLang, topicName: ctx.topicName, story: ctx.story,
    diff: ctx.diff, jobId: ctx.jobId, chainVocab: ctx.chainVocab,
    script: ctx.script || null,                                    // v79_f
    standardOpts: { story: ctx.story, vocabMode: null, script: ctx.script || null },
    sharedGenOpts: { chainVocab: ctx.chainVocab, vocabMode: 'reinforce', story: ctx.story,
                     script: ctx.script || null,
                     chainStory: ctx.chainStory?.text, chainStoryChapters: ctx.chainStory?.chapters },
    addMathInstr: ctx.addMathInstr || null, addMathOps: ctx.addMathOps || null,
    introScript: ctx.introScript || null,
  });
  // Everything except the chapter's own standard lesson is reinforcement, and the path badge
  // reads _arcMode. Marked here so no caller has to remember to.
  if (lesson) lesson._arcMode = 'reinforce';
  return lesson || null;
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

  // Find existing storyline that contains this topic.
  // v75_f (user-reported: "imported with merge and it lost the storyboard"): identity was looked
  // up by ID ALONE, i.e. by the hash of the chapter list. A storyline whose stored id is NOT that
  // hash — imported from elsewhere, or created before its chapter list settled — was therefore not
  // recognised as its own chain, fell through to the FORK branch, and was rebuilt from six fields
  // (id/title/icon/chapters/lang/srcLang). Everything else — `storyboard`, `storyboardMeta`,
  // `summary`, `tags` — is not in that list and was dropped. The rebuilt copy is unshifted to the
  // FRONT, so the dedup below then saw two storylines with an identical chapter sequence and kept
  // whichever came first whenever its title-based tie-break could not separate them.
  // A storyline covering exactly these chapters IS this chain, whatever its id says.
  const sameChain = s => (s.chapters || []).length === chapterIds.length
                      && chapterIds.every((c, i) => c === s.chapters[i]);
  const existing = allSl.find(s => s.id === slId) || allSl.find(sameChain);
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
      // v80_l / PLAN §9c: `title` here is a PLACEHOLDER (the first chapter's topic name), not an
      // authored title. `titleAuto` says so, so the title post-pass can tell the two apart.
      upsertStoryline({ id: slId, title: chain[0], titleAuto: true, icon: '📖', chapters: chapterIds,
        lang: topicObj?.lang || null, srcLang: topicObj?.srcLang || null });
    }
  } else if (predecessorMatch) {
    // New topic extends an existing storyline — update chapters in place, preserve id/title/icon/tags
    predecessorMatch.chapters = chapterIds;
    setStorylines(allSl.map(s => s.id === predecessorMatch.id ? predecessorMatch : s));
  } else {
    // v80_l / PLAN §9c: placeholder, as above.
    upsertStoryline({ id: slId, title: chain[0], titleAuto: true, icon: '📖', chapters: chapterIds,
      lang: topicObj?.lang || null, srcLang: topicObj?.srcLang || null });
  }
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
//
// v69_q — `parentId` (the STORED id of the previous chapter) is passed explicitly. Before this,
// the book loop resolved the parent by NAME (contFrom = parent.topic) and this function upserted
// the chapter with NO id yet, so `upsert` fell back to its name+lang+srcLang dedup key. When two
// chapters in one book shared a title (a real PDF gave chapters 3 and 4 the same headline), the
// second OVERWROTE the first in that id-less window, and the name-based continuedFrom then chained
// the survivor to itself. Fix: mint the chapter's id BEFORE upsert so identity is always by id, and
// record continuedFromId so the storyline sync never resolves a parent by name.
function _persistGenerated(data, contFrom, parentId) {
  if (store.schemaVersion >= 29) {
    // Assign identity up front. A fresh chapter (no id) gets one now, BEFORE upsert, so a
    // same-titled sibling generated moments earlier can never be mistaken for this one.
    if (!data.id) data.id = _newTopicId();
    // Record the parent link by id. Prefer the explicit parentId the caller threaded through;
    // fall back to resolving a name only for legacy callers that pass just contFrom.
    if (parentId) data.continuedFromId = parentId;
    else if (contFrom && !data.continuedFromId) data.continuedFromId = findSaved(contFrom)?.id || null;
    if (contFrom && !data.continuedFrom) data.continuedFrom = contFrom;   // keep the human-readable link too
  }
  upsert(data);
  let saved = (store.schemaVersion >= 29)
    ? (store.topics.find(l => l.id === data.id) || store.topics.find(l => l.topic.toLowerCase() === (data.topic||'').trim().toLowerCase()))
    : findSaved(data.topic);
  if (store.schemaVersion >= 29) {
    _syncStorylineForTopic(saved ? saved.id : data.id, contFrom);
    saved = (saved && store.topics.find(l => l.id === saved.id)) || saved;
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
  // v78_r (user-reported): on a CONTINUATION this used to see only the newly added chapters.
  // Two consequences, both reported:
  //   • it failed. Titling chapters 3-4 of a six-chapter story from those two excerpts alone gave
  //     "0/2 titles came back named" on all three attempts, while the storyline-header button —
  //     which passes all six — succeeded on the first. A mid-story fragment with no beginning is
  //     not enough for the model to name anything, and the retry loop cannot fix missing context.
  //   • it overwrote. The storyline title and summary were regenerated from the new chapters only,
  //     replacing ones written from the whole story with ones written from its tail.
  // So the post-pass now works from the WHOLE chain and writes back only what is missing.
  const _chain = (() => {
    try {
      const all = getStorylines();
      const sl = all.find(s => s.id === _chainId(chapterIds))
              || all.find(s => chapterIds.every(id => (s.chapters || []).includes(id)));
      if (!sl || !Array.isArray(sl.chapters)) return null;
      const full = sl.chapters.map(id => findSavedById(id)).filter(Boolean);
      return full.length > topics.length ? { sl, full } : null;
    } catch (_) { return null; }
  })();
  const ctxTopics = _chain ? _chain.full : topics;      // context: everything the story has
  const stories = ctxTopics.map(t => t.story || '');
  // 1) Per-chapter coherent titles + emojis. (v59: metered → storyline 'retitle' bucket,
  // same attribution as the manual retitle route — one call covers the whole chain.)
  try {
    const { result: chapterMeta, tokens: _mTok } = await meterLLMTokens(() => generateChapterMeta(stories, base.srcLang, base.lang));
    // Titles come back for the whole chain, in chain order. Apply only to the chapters THIS job
    // added — an existing chapter keeps the title it already has, per the user's ruling. Sliced by
    // identity rather than by position: `chapterIds` need not be a contiguous tail.
    const _idx = new Map(ctxTopics.map((t, i) => [t.id, i]));
    const _newTopics = topics.filter(t => _idx.has(t.id));
    const _newMeta = _newTopics.map(t => chapterMeta[_idx.get(t.id)] || {});
    _applyChapterTitles(_newTopics, _newMeta, bj);
    const _slT = getStorylines().find(s => s.id === _chainId(chapterIds))
              || getStorylines().find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (_slT) { addTokenUsage(_slT, _mTok, 'retitle'); upsertStoryline(_slT); }
  } catch (e) { console.warn(`  Chapter-title post-pass failed: ${e.message}`); }
  // 2) Whole-storyline title + icon (reuse existing helper).
  try {
    // v78_r (user): only when there is none. A continuation must not rename a storyline the learner
    // already has — and the old behaviour was worse than a rename, because it regenerated the title
    // from the NEW chapters alone, replacing a whole-story title with one about its tail.
    const _slPre = (() => { try { const all = getStorylines();
      return all.find(s => s.id === _chainId(chapterIds))
          || all.find(s => chapterIds.every(id => (s.chapters||[]).includes(id))) || null; } catch(_) { return null; } })();
    // v80_l / PLAN §9c: the v78_r ruling is UNCHANGED — an existing title is never overwritten. What
    // changed is that the guard can now tell an AUTHORED title from a PLACEHOLDER. `upsertStoryline`
    // seeds `title: chain[0]` (the first chapter's topic name, auto-numbering suffix and all) when a
    // storyline is created, so by the time this ran there was ALWAYS a title and the else-branch was
    // unreachable for every storyline created through that path. The title was not skipped because
    // the book was a continuation; it was skipped because a placeholder looked like an author's work.
    //
    // `titleAuto` is set at the seed and cleared the moment a real title is written or the user edits
    // one, so a storyline that predates this flag (no `titleAuto` at all) is treated as AUTHORED —
    // the safe direction, and the one that preserves the ruling for every existing book.
    if (_slPre && String(_slPre.title || '').trim() && !_slPre.titleAuto) {
      console.log(`  Storyline title: keeping existing "${String(_slPre.title).slice(0,60)}"`);
    } else {
    const names = ctxTopics.map(t => t.topic);
    const { result: { title, icon }, tokens: _mTok } = await meterLLMTokens(() => generateStorylineTitle(names, stories, base.srcLang));
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    // Clearing `titleAuto` is what stops this running twice: the next chapter added to this book
    // finds an authored title and the v78_r guard keeps it, exactly as before.
    if (sl) { addTokenUsage(sl, _mTok, 'retitle'); sl.title = title; sl.icon = icon || sl.icon || '📖';
              sl.titleAuto = false; upsertStoryline(sl); }
    }
  } catch (e) { console.warn(`  Storyline title post-pass failed: ${e.message}`); }
  // 3) Whole-storyline summary in the source language — same as the storyline-page
  // header-row summary (generateStorylineSummary + store on the storyline). Best-effort.
  try {
    // v78_r (user): same rule, same reason — and the summary is the clearer case, since a summary
    // of chapters 3-4 presented as the summary of a six-chapter story is simply wrong.
    const _slPre2 = (() => { try { const all = getStorylines();
      return all.find(s => s.id === _chainId(chapterIds))
          || all.find(s => chapterIds.every(id => (s.chapters||[]).includes(id))) || null; } catch(_) { return null; } })();
    if (_slPre2 && String(_slPre2.summary || '').trim()) {
      console.log(`  Storyline summary: keeping existing (${String(_slPre2.summary).length} chars)`);
    } else {
    const names = ctxTopics.map(t => t.topic);
    const vocab = ctxTopics.flatMap(t =>
      (t.lessons || []).flatMap(ls => (ls.vocab || []).map(v => v.source || v.target)));
    const { result: { text: summary, meta: summaryMeta }, tokens: _mTok } =
      await meterLLMTokens(() => generateStorylineSummary(names, stories, vocab, base.srcLang));
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (sl && summary) { addTokenUsage(sl, _mTok, 'summary'); sl.summary = summary; sl.summaryMeta = summaryMeta; upsertStoryline(sl); }
    }
  } catch (e) { console.warn(`  Storyline summary post-pass failed: ${e.message}`); }
  // 4) For file-derived books, record the original uploaded filename on the
  // storyline (so the library can show provenance). Best-effort.
  try {
    if (base.sourceFile) {
      const slId = _chainId(chapterIds);
      const all = getStorylines();
      const sl = all.find(s => s.id === slId)
              || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
      if (sl) { sl.sourceFile = String(base.sourceFile).slice(0, 200); upsertStoryline(sl); }
      // A book chapter is `userStory` (we did not write it) but it is NOT "pasted by the user" — it
      // came from an uploaded file with an author and a licence. Refine each chapter's storyMeta so
      // the topic is self-describing and the library can attribute it without walking the storyline.
      for (const cid of chapterIds) {
        const t = findSavedById(cid);   // chapterIds are ids; findSaved() takes a topic NAME
        // 'user-pasted' is what the live stamp writes since v68.1; 'user-provided' is matched too
        // for robustness against a pre-v68.1 in-flight row (fixMetaSource heals persisted ones).
        if (t && t.storyMeta && (t.storyMeta.origin === 'user-pasted' || t.storyMeta.origin === 'user-provided')) {
          t.storyMeta.origin = 'file-upload';
          t.storyMeta.sourceFile = String(base.sourceFile).slice(0, 200);
          upsert(t);
        }
      }
    }
  } catch (e) { console.warn(`  Storyline sourceFile post-pass failed: ${e.message}`); }
}

// Build the intro "learn the script" lesson(s) to PREPEND to a chapter when arc script-teaching
// is on and the target uses a script the source doesn't. One lesson per such script, scoped to
// the letters NEW to this chapter (extend), capped by difficulty, distractors from the full
// alphabet. Returns [] when nothing applies. (chapterText = this chapter's story/target text;
// priorRef = the parent chapter id/name so we know which letters are already introduced.)
function buildArcIntroLessons(lang, srcLang, chapterText, priorRef, difficulty, opts) {
  if (!needsIntroScript(lang, srcLang, opts)) return [];
  // v78_g: narrow BOTH sides exactly as the gate does, through the same helper. If the gate said
  // yes on the chosen scripts and this loop still walked every script the LANGUAGE admits, a
  // digraphic pair would pass the gate and then skip every script inside the loop
  // (`srcScripts.has(scr)` is true for all of them) — returning [] with no error, which is the
  // silent-empty shape INTERNALS §2 is full of. Gate and builder must ask the same question.
  const srcArr = _scriptSideOf(srcLang || 'en', opts && opts.srcScript, 'en');
  const srcScripts = new Set(srcArr);
  const out = [];
  for (const scr of _scriptSideOf(lang, opts && opts.script, lang)) {
    if (srcScripts.has(scr) || !scriptTeachable(scr, srcArr)) continue;
    const table = _scriptsData[scr];
    let letters = introExtendLetters(scr, chapterText, priorRef, difficulty);
    // If nothing is genuinely new this chapter (e.g. all its letters already appeared), skip —
    // an empty extend lesson has nothing to teach. (First chapter: priorRef null → everything
    // in the chapter counts as new, so it naturally seeds the alphabet introduced so far.)
    if (letters.length < 4) continue;
    const exercises = introScriptExercises(letters, { distractorPool: table.letters, srcScripts: srcArr });
    out.push({
      id: 'intro_' + scr + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      type: 'intro_script', script: scr, rtl: !!table.rtl, _arcMode: 'extend', difficulty,
      title: '🔡 ' + (table.label || scr), icon: '🔡',
      desc: (table.label || scr) + ' — ' + letters.length + ' letters',
      letters, exercises,
      _genMeta: { type: 'intro_script', model: '(procedural)', valid: exercises.length, at: new Date().toISOString() },
    });
  }
  return out;
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
        // v78_p: the chosen scripts. `generate()` reads `userOpts.script` for THREE things — the
        // story prompt's scriptNote (v76_h), the saved topic's `script`/`srcScript` stamps, and the
        // stamps the arc primer later reads. The book route built userOpts without them, so a
        // Serbian-Cyrillic job produced a Latin story, an unstamped topic, and a primer with no
        // letters to teach. `/api/generate` has always passed them; only this route did not.
        script: base.script || null, srcScript: base.srcScript || null,
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
        // v71_u: the book path used to offer exactly two arc shapes ('vocab' → one review lesson,
        // 'grammar' → word_forms + synonyms), while the storyline path had had the full tick-list
        // since v71_p. Same operation, two different UIs and two different code paths — so a type
        // added to one silently did not exist in the other (comprehension, added in v71_l, was
        // never reachable from a book at all). Both now dispatch through generateArcLesson.
        const _types = base.arcTypes;
        // The current chapter is not persisted yet at this point, so it cannot be walked from the
        // store the way the storyline path does. A synthetic node carrying this chapter's story and
        // a link to its parent gives collectChainStory the same shape it expects: current chapter
        // last and whole, earlier chapters ahead of it, trimmed from the oldest end (v71_t).
        const _chainStory = collectChainStory({
          id: null, topic: data.topic || placeholderTopic, story: arcStory,
          continuedFromId: parent ? (parent.id || null) : null,
        });
        for (const aType of _types) {
          try {
            jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] ${aType} — chapter ${i + 1}/${chunks.length}…`);
            const lesson = await generateArcLesson(aType, {
              lang: base.lang, srcLang: base.srcLang, topicName: data.topic || placeholderTopic,
              story: arcStory, diff: base.diff, jobId, chainVocab, chainStory: _chainStory,
              script: base.script || null,
              reviewOpts: { userDialect: null, writingStyle: base.storyStyle || null,
                            storyLang: base.userStoryLang || null },
            });
            if (lesson) data.lessons.push(lesson);
          } catch (e) {
            // One failing type must not abandon the others: a whole book run is a long wait, and
            // losing it to a format the model fumbled on one chapter is the worst outcome here.
            console.warn(`  [book ${bookId}] chapter ${i+1} arc lesson (${aType}) failed, skipping: ${e.message}`);
            jobStep(jobId, `⚠ ${aType} failed — continuing…`);
          }
        }
      }

      // Arc script-teaching: when enabled and the target uses a script the source doesn't,
      // PREPEND an intro "learn the script" lesson covering the letters NEW to this chapter
      // (extend). Generated after the vocab/reinforcement lessons (so we know this chapter's
      // text) but ordered FIRST so the learner meets the new letters before the words that use
      // them. priorRef = the parent chapter, so chapter 1 seeds the alphabet introduced so far.
      if (base.arc && base.arcScript && Array.isArray(data.lessons)) {
        try {
          const chapterText = userStory || data.story || '';
          const introLessons = buildArcIntroLessons(base.lang, base.srcLang, chapterText, parent ? (parent.id || prevRef) : null, base.diff, { script: base.script, srcScript: base.srcScript });
          if (introLessons.length) {
            data.lessons.unshift(...introLessons);
            jobStep(jobId, `🔡 Prepended script primer (${introLessons.map(l => l.script).join(', ')})`);
          }
        } catch (e) {
          console.warn(`  [book ${bookId}] chapter ${i+1} script primer failed, skipping: ${e.message}`);
        }
      }

      // v69_q: pass the parent's stored id, not only its name, so chaining is id-based and two
      // chapters sharing a title cannot collapse onto each other.
      const saved = _persistGenerated(data, contFrom, parent ? parent.id : null);
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
    // v77_w (user): NO QC PASS during generation. Story QC was already excluded here — an LLM pass
    // per chapter, unprompted, on an already-long job — and the user has now made the same call for
    // LESSON QC, for the same reason: it is the slowest part of a book job and it is not urgent.
    // QC loses nothing by being deferred; it is a review step, and everything it would have found
    // is still there afterwards.
    //
    // Both remain available on demand and unchanged: the storyline 🔍 sweep (which defaults
    // `includeStory: true`) and the per-chapter QC from the saved list. This removes the automatic
    // invocation only — `_runQc` itself, its flagging, and the QC endpoints are untouched.
    // To restore the old behaviour, re-add the bulk QC call here (lessonIdx null, onlyFlagged
    // false, includeStory false). Its exact form is deliberately NOT spelled out: a test sweeps
    // this file to prove the automatic call is gone, and a comment quoting it would fail the very
    // check it documents.
    // Storyboard post-pass (v68.1, queued in the v68 notes): one whole-storyline board at the end
    // of every book/multi-chapter job — the same artefact the storyline 🎨 button makes, via the
    // same shared helper, so the deck opens with its board instead of an empty slot. Runs AFTER
    // titling (panels caption against the final chapter set) and after QC (a slow board must never
    // delay content flags). Best-effort; never fails the book. Storyline resolution mirrors the
    // title/sourceFile post-passes: chain id first, chapters-inclusion fallback.
    try {
      const chapterIds = bj.chapters.map(c => c.topicId).filter(Boolean);
      const topicData = chapterIds.map(id => findSavedById(id)).filter(Boolean);
      if (topicData.length) {
        const slId = _chainId(chapterIds);
        const all = getStorylines();
        const sl = all.find(s => s.id === slId)
                || all.find(s => chapterIds.every(id => (s.chapters || []).includes(id)));
        // v69_p (user request): the ✨ upload cleanup is spent BEFORE any storyline exists — it runs
        // on the upload panel's chunks. The client accumulates that spend and sends it with the
        // book job, so it can be attributed here rather than vanishing from the ledger.
        if (sl && base.cleanupTokens && (base.cleanupTokens.promptTokens || base.cleanupTokens.completionTokens)) {
          addTokenUsage(sl, base.cleanupTokens, 'cleanup');
          upsertStoryline(sl);
          console.log(`  [book ${bookId}] upload-cleanup tokens attributed to the storyline: `
            + `${(base.cleanupTokens.promptTokens||0) + (base.cleanupTokens.completionTokens||0)}`);
        }
        if (sl && !sl.storyboard) {   // never overwrite a board someone already made
          bj.status = 'storyboard';
          await _storyboardForStoryline(sl.id, topicData, null);
          console.log(`  [book ${bookId}] storyboard post-pass done`);
        }
      }
    } catch (e) { console.warn(`  [book ${bookId}] storyboard post-pass error: ${e.message}`); }
    bj.status = 'done';
  }
  console.log(`  [book ${bookId}] finished: ${bj.status}`);
}

// Re-create all lessons for an existing storyline using the book-generation arc
// logic: for each chapter (in storyline order) hide the existing lessons (kept,
// not deleted) and append freshly generated ones — a standard vocab "gate" for the
// chapter, plus reinforcement from chapter 2 on (a whole-storyline vocab review, or
// word_forms + synonyms when arcMode is 'grammar'). Operates on the chapters'
// stored stories, so no story regeneration.
async function _runRecreateJob(jobId, startId, opts) {
  const all = getStorylines();
  const sl = all.find(s => Array.isArray(s.chapters) && s.chapters.includes(startId));
  const chapterIds = sl ? sl.chapters.slice() : [startId];   // lone chapter → just it
  // v71_p: this endpoint is now "ADD lessons", not "re-create". `addTypes` is the user's tick-list
  // from the shared lesson-type picker and is applied to EVERY chapter including the first — the
  // old flow could only reinforce from chapter 2 on, because it assumed chapter 1 had nothing to
  // review. Selecting types explicitly removes that assumption: if you ask for word_forms on a
  // storyline, you mean all of it.
  const addTypes = Array.isArray(opts && opts.addTypes) && opts.addTypes.length
    ? opts.addTypes.filter(t => ADD_LESSON_GENERATORS[t] || t === 'standard' || t === 'review')
    : null;
  // Legacy two-mode call (arcMode) still honoured for older clients.
  const arcMode = (opts && opts.arcMode === 'grammar') ? 'grammar' : 'vocab';
  const arcTypes = ['word_forms', 'synonyms'];   // superseding reinforcement types
  // Adding must not hide what is already there: the user asked for MORE lessons, not different
  // ones, and hiding silently discards progress made against the originals.
  const keepExisting = !!addTypes || !!(opts && opts.add);
  let prevRef = null, recreated = 0, hidden = 0;
  for (let i = 0; i < chapterIds.length; i++) {
    const topic = findSavedById(chapterIds[i]);
    if (!topic) { prevRef = chapterIds[i]; continue; }
    const lang = topic.lang, srcLang = topic.srcLang || 'en', diff = topic.difficulty || 2;
    const story = topic.story || '';
    jobStep(jobId, `Re-creating chapter ${i + 1}/${chapterIds.length}: "${topic.topic}"…`);
    // Keep but hide existing lessons — only in the legacy re-create mode. An ADD run leaves them
    // visible and simply appends (v71_p).
    if (!keepExisting) {
      for (const l of (topic.lessons || [])) { if (!l._hidden) { l._hidden = true; hidden++; } }
    }
    const newLessons = [];
    const stamp = (lesson, suffix) => { lesson.id = 'ls_' + Date.now() + '_' + i + '_' + suffix; lesson._recreated = true; };
    // Gate: this chapter's own standard vocab lesson.
    // v59: meter this chapter's whole re-creation (gate + reinforcement, all formats)
    // and fold it into the chapter's cumulative totals — the roadmap's exact example
    // ("re-generating ADDS to that chapter's existing totals rather than being invisible").
    const { tokens: _rcTok } = await meterLLMTokens(async () => {
      if (addTypes) {
        // v71_p: explicit tick-list. Every selected type, every chapter — including the first.
        const parent = prevRef ? findSavedById(prevRef) : null;
        const chainVocab = parent ? collectChainVocab(parent.id || prevRef) : { words: [], nouns: [], verbs: [], sentences: [] };
        const chainStory = collectChainStory(topic);
        for (const aType of addTypes) {
          try {
            jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] ${aType} — chapter ${i + 1}/${chapterIds.length}…`);
            let lesson = null;
            if (aType === 'standard' || aType === 'review') {
              // 'review' is the vocab-review lesson (prior chapters); 'standard' covers this one.
              const vOpts = aType === 'review'
                ? { story, chainVocab: chainVocab.words || [], vocabMode: 'reinforce' }
                : { story, vocabMode: null };
              ({ lesson } = await generateOneLesson(lang, srcLang, topic.topic, 1, 1, [], story, diff, jobId, vOpts));
              if (lesson && aType === 'review') { lesson._arcMode = 'reinforce'; if (!lesson.title) lesson.title = 'Review words'; if (!lesson.icon) lesson.icon = '🔁'; }
            } else {
              const gen = ADD_LESSON_GENERATORS[aType];
              if (!gen) continue;
              ({ lesson } = await gen({ lang, srcLang, topicName: topic.topic, story, diff, jobId, chainVocab,
                script: topic.script || null,                      // v79_f
                standardOpts: { story, vocabMode: null, script: topic.script || null },
                sharedGenOpts: { chainVocab, vocabMode: 'reinforce', story,
                                 script: topic.script || null,    // v79_f
                                 chainStory: chainStory.text, chainStoryChapters: chainStory.chapters } }));
            }
            if (lesson) { stamp(lesson, aType); newLessons.push(lesson); recreated++; }
          } catch (e) {
            // One failing type must not abandon the other selections, or a whole run is lost to a
            // format the model happened to fumble on one chapter.
            console.warn(`  [add-lessons] chapter ${i + 1} ${aType} failed: ${e.message}`);
            jobStep(jobId, `⚠ ${aType} failed on chapter ${i + 1} — continuing…`);
          }
        }
        return;
      }
      try {
        const { lesson } = await generateOneLesson(lang, srcLang, topic.topic, 1, 1, [], story, diff, jobId, { story, vocabMode: null });
        if (lesson) { stamp(lesson, 'gate'); newLessons.push(lesson); recreated++; }
      } catch (e) { console.warn(`  [recreate] chapter ${i + 1} gate failed: ${e.message}`); }
      // Reinforcement from the second chapter on.
      if (i >= 1) {
        const parent = prevRef ? findSavedById(prevRef) : null;
        const chainVocab = parent ? collectChainVocab(parent.id || prevRef) : { words: [], nouns: [], verbs: [], sentences: [] };
        if (arcMode === 'grammar') {
          for (const rType of arcTypes) {
            try {
              const rFn = rType === 'synonyms' ? generateSynonyms : generateWordForms;
              const { lesson } = await rFn(topic.topic, lang, srcLang, diff, jobId, { chainVocab, vocabMode: 'reinforce', story });
              if (lesson) { stamp(lesson, rType); lesson._arcMode = 'reinforce'; newLessons.push(lesson); recreated++; }
            } catch (e) { console.warn(`  [recreate] chapter ${i + 1} ${rType} reinforce failed: ${e.message}`); }
          }
        } else {
          try {
            const { lesson } = await generateOneLesson(lang, srcLang, topic.topic, 1, 1, [], story, diff, jobId,
              { story, chainVocab: chainVocab.words || [], vocabMode: 'reinforce' });
            if (lesson) { stamp(lesson, 'review'); lesson._arcMode = 'reinforce'; if (!lesson.title) lesson.title = 'Review words'; if (!lesson.icon) lesson.icon = '🔁'; newLessons.push(lesson); recreated++; }
          } catch (e) { console.warn(`  [recreate] chapter ${i + 1} vocab review failed: ${e.message}`); }
        }
      }
    });
    addTokenUsage(topic, _rcTok, 'recreate');
    topic.lessons = [...(topic.lessons || []), ...newLessons];
    stampUpdated(topic);
    saveStore(store);   // persist per-chapter so progress survives a mid-run failure
    prevRef = topic.id;
  }
  console.log(`  [${addTypes ? 'add-lessons' : 'recreate'}] done: ${recreated} new lesson(s) across ${chapterIds.length} chapter(s), ${hidden} hidden`);
  return { recreated, hidden, chapters: chapterIds.length };
}

http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const M   = req.method.toUpperCase();

    if (M === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    }
    // ── Learner accounts + server-side state (v65) ───────────────────────────
    // The server is the source of truth for a signed-in learner; the client keeps a localStorage
    // copy as an offline fallback. Credentials and state live in learners.json — deliberately NOT
    // lessons.json, which build-static bakes into the public docs/ bundle.
    if (M === 'POST' && url.pathname === '/api/auth/register') {
      // Before the attempt, not after: the password crossed the wire whether or not it succeeds.
      warnInsecureTransport(req, 'a learner account was created');
      let b; try { b = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const r = LEARNERS.createUser(b.username, b.password);
      if (r.error) return json(res, 400, { error: r.error });
      const token = LEARNERS.createSession(r.username);
      setSessionCookie(req, res, token, 60 * 60 * 24 * 30);
      console.log(`  Learner registered: ${r.username}`);
      return json(res, 200, { ok: true, username: r.username });
    }
    if (M === 'POST' && url.pathname === '/api/auth/login') {
      warnInsecureTransport(req, 'a learner signed in');
      let b; try { b = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const r = LEARNERS.authenticate(b.username, b.password);
      if (r.error) return json(res, 401, { error: r.error });
      const token = LEARNERS.createSession(r.username);
      setSessionCookie(req, res, token, 60 * 60 * 24 * 30);
      console.log(`  Learner signed in: ${r.username}`);
      return json(res, 200, { ok: true, username: r.username });
    }
    if (M === 'POST' && url.pathname === '/api/auth/logout') {
      try { LEARNERS.destroySession(parseCookies(req)[SESSION_COOKIE]); } catch(_) {}
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    }
    if (M === 'GET' && url.pathname === '/api/auth/me') {
      const who = currentLearner(req);
      return json(res, 200, { username: who || null, anyAccounts: LEARNERS.listUsers().length > 0 });
    }
    if (M === 'POST' && url.pathname === '/api/auth/password') {
      const who = currentLearner(req);
      if (!who) return json(res, 401, { error: 'Not signed in.' });
      let b; try { b = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const r = LEARNERS.changePassword(who, b.oldPassword, b.newPassword);
      if (r.error) return json(res, 400, { error: r.error });
      return json(res, 200, { ok: true });
    }
    // Learner state: the whole payload (progress + learned ledger + tutor thread).
    if (url.pathname === '/api/learner/state') {
      const who = currentLearner(req);
      if (!who) return json(res, 401, { error: 'Not signed in.' });
      if (M === 'GET') return json(res, 200, { username: who, state: LEARNERS.getState(who) });
      if (M === 'PUT' || M === 'POST') {
        let b; try { b = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
        const r = LEARNERS.setState(who, b.state || b);
        if (r.error) return json(res, 400, { error: r.error });
        return json(res, 200, { ok: true, updatedAt: r.updatedAt });
      }
    }
    // Teacher view: who exists and where they are struggling. Requires teacher capability, which on
    // this server means a live backend (the same gate the editing UI uses) — documented as such.
    if (M === 'GET' && url.pathname === '/api/learners') {
      // Supply the library so completion can be judged for learners predating the v69_l stamps.
      const byTopic = {};
      (store.topics || []).forEach(t => { if (t && t.topic) byTopic[t.topic] = t.lessons || []; });
      const list = LEARNERS.listUsers().map(u => LEARNERS.summarize(u.username, byTopic)).filter(Boolean);
      return json(res, 200, { learners: list });
    }
    if (M === 'GET' && url.pathname === '/api/info') {
      return json(res, 200, { backend: active, version: APP_VERSION, ollamaModel: OLLAMA_MODEL,
        ollamaTranslationModel: OLLAMA_TRANSLATION_MODEL,
        ollamaLessonModel: OLLAMA_LESSON_MODEL,
        ollamaQcModel: OLLAMA_QC_MODEL,
        ollamaTutorModel: OLLAMA_TUTOR_MODEL,
        ollamaLessonFormat: OLLAMA_LESSON_FORMAT,
        // v55_r: the client's colour-scheme picker reads this — the names live ONLY here, so the
        // list can never drift out of sync with STORYBOARD_SCHEMES (no duplicated list client-side).
        storyboardSchemes: Object.keys(STORYBOARD_SCHEMES),
        // v60.8: global %-solved threshold to complete a chapter (teacher-set, model menu).
        coverageThreshold: getSettings().coverageThreshold,
        // v70_b: plain HTTP on a non-loopback host — the client shows a warning where the password
        // is typed. Computed per request, since it depends on how THIS client reached us: the same
        // server is secure over loopback and insecure over the LAN at the same moment.
        insecureTransport: transportInsecure(req),
        canGenerate: active !== 'none' });
    }
    // PLAN §8/B2 — canonical skills are reviewed server-side before any lesson generator uses
    // them. These routes intentionally do NOT inspect or alter lessons, observations, or player
    // state. A source language is accepted only as evidence context; target language scopes ID.
    if (M === 'GET' && url.pathname === '/api/skills') {
      if (!skillRegistry) return json(res, 503, { error: 'Skills registry is unavailable.' });
      return json(res, 200, { schemaVersion: 1, skills: skillRegistry.entries });
    }
    if (M === 'POST' && url.pathname === '/api/skills/resolve') {
      if (!skillRegistry) return json(res, 503, { error: 'Skills registry is unavailable.' });
      let body; try { body = JSON.parse(await readBody(req)); }
      catch (_) { return json(res, 400, { error: 'Invalid JSON body.' }); }
      try {
        return json(res, 200, { resolution: skillResolutionJson(resolveSkill(skillRegistry,
          body.proposedId, { targetLang: body.targetLang, sourceLang: body.sourceLang })) });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (M === 'POST' && url.pathname === '/api/skills/register') {
      if (!skillRegistry) return json(res, 503, { error: 'Skills registry is unavailable.' });
      let body; try { body = JSON.parse(await readBody(req)); }
      catch (_) { return json(res, 400, { error: 'Invalid JSON body.' }); }
      try {
        const result = withRegisteredSkill(skillRegistry, body.proposedId, {
          targetLang: body.targetLang, sourceLang: body.sourceLang, label: body.label, aliases: body.aliases,
        });
        if (result.changed) { saveSkillRegistry(result.registry); skillRegistry = result.registry; }
        return json(res, 200, { changed: result.changed, resolution: skillResolutionJson(result.resolution) });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (M === 'POST' && url.pathname === '/api/skills/alias') {
      if (!skillRegistry) return json(res, 503, { error: 'Skills registry is unavailable.' });
      let body; try { body = JSON.parse(await readBody(req)); }
      catch (_) { return json(res, 400, { error: 'Invalid JSON body.' }); }
      try {
        const next = withSkillAlias(skillRegistry, body.skillId, body.alias, body.targetLang);
        const changed = next !== skillRegistry;
        if (changed) { saveSkillRegistry(next); skillRegistry = next; }
        return json(res, 200, { changed, skillId: resolveSkill(skillRegistry, body.skillId,
          { targetLang: body.targetLang }).skillId });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    if (M === 'DELETE' && url.pathname === '/api/skills/alias') {
      if (!skillRegistry) return json(res, 503, { error: 'Skills registry is unavailable.' });
      let body; try { body = JSON.parse(await readBody(req)); }
      catch (_) { return json(res, 400, { error: 'Invalid JSON body.' }); }
      try {
        const next = withoutSkillAlias(skillRegistry, body.skillId, body.alias, body.targetLang);
        const changed = next !== skillRegistry;
        if (changed) { saveSkillRegistry(next); skillRegistry = next; }
        return json(res, 200, { changed, skillId: resolveSkill(skillRegistry, body.skillId,
          { targetLang: body.targetLang }).skillId });
      } catch (e) { return json(res, 400, { error: e.message }); }
    }
    // Model picker: list the models Ollama has installed, and which are active per role.
    if (M === 'GET' && url.pathname === '/api/models') {
      const available = active === 'ollama' ? await listOllamaModels() : [];
      return json(res, 200, { backend: active, available, active: currentModels() });
    }
    // Switch the active model(s) at runtime. Body: any subset of {story, translation, lessons}
    // (or {model} to set all three). Unknown model names (not installed) are rejected when the
    // available list is known. Additive: default env-configured setups are unaffected until used.
    if (M === 'POST' && url.pathname === '/api/models') {
      if (active !== 'ollama')
        return json(res, 503, { error: 'No Ollama backend — cannot switch models.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON body' }); }
      const requested = [body.model, body.story, body.translation, body.lessons, body.qc, body.tutor]
        .filter(v => typeof v === 'string' && v.trim()).map(v => v.trim());
      const hasTimeout = body.timeoutMs != null && Number.isFinite(parseInt(body.timeoutMs, 10));
      // v71_q: numThread — CPU threads Ollama may use. 0/empty means "leave it to Ollama", which is
      // a meaningful choice and not the same as "unset", so it is accepted rather than rejected.
      const hasThreads = body.numThread != null && Number.isFinite(parseInt(body.numThread, 10));
      const hasThink = body.think && typeof body.think === 'object' &&
        (typeof body.think.story === 'boolean' || typeof body.think.lessons === 'boolean'
         || typeof body.think.tutor === 'boolean');
      if (!requested.length && !hasTimeout && !hasThink && !hasThreads)
        return json(res, 400, { error: 'Nothing to set. Provide story, translation, lessons, qc, tutor, model, timeoutMs, think, or numThread.' });
      if (requested.length) {
        const available = await listOllamaModels();
        if (available.length) {
          const unknown = [...new Set(requested)].filter(m => !available.includes(m));
          if (unknown.length)
            return json(res, 400, { error: `Model(s) not installed in Ollama: ${unknown.join(', ')}`, available });
        }
      }
      if (hasTimeout) setRequestTimeout(body.timeoutMs);
      if (hasThreads) setNumThread(body.numThread);
      // A think-only toggle still needs setRuntimeModels (it reads body.think); a model change does
      // too. Only a timeout-only POST skips it.
      const activeModels = (requested.length || hasThink) ? setRuntimeModels(body) : currentModels();
      console.log(`  Models switched → story:${activeModels.story}${activeModels.think.story?'🧠':''} lessons:${activeModels.lessons}${activeModels.think.lessons?'🧠':''}${activeModels.translation!==activeModels.story?` transl:${activeModels.translation}`:''}${activeModels.tutor!==activeModels.story||activeModels.think.tutor?` tutor:${activeModels.tutor}${activeModels.think.tutor?'🧠':''}`:''}${activeModels.lessonFormat==='table'?' [table format]':''} timeout:${Math.round(activeModels.timeoutMs/1000)}s${activeModels.numThread?` threads:${activeModels.numThread}`:''}`);
      return json(res, 200, { ok: true, active: activeModels });
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
        // Provenance (v58) — the landing card's `by <user> · from: <source>` one-liner needs
        // these in LIVE mode (static ships whole topics and has them for free — the exact
        // asymmetry v55_s hit with generationStats). source is tiny (≤4 short strings);
        // sourceFile covers PDF-generated chapters that predate structured sources.
        createdBy: l.createdBy || null,
        source: l.source || null,
        sourceFile: l.storyMeta?.sourceFile || null,
        // v74_i: hidden lessons never count for anything (user ruling, v74_e). This was the RAW
        // length, so live showed "Kälte und Paella · 3 lessons" where static showed 2 — the static
        // builder strips hidden ai_error_hunts at bake time, and the two counts disagreed on screen.
        lessonCount: (l.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length,
        // v79_n: the chapter speech locale MUST ride in this projection. It is a whitelist, and
        // `_speechLocaleFor` resolves from APP.savedList — omitting it would mean the setting
        // saves, survives a reload of lessons.json, and silently does nothing in live mode.
        // That is precisely the v74_i failure the comment above this line records.
        ...(l.speechLocale ? { speechLocale: l.speechLocale } : {}),
        // v74_i: METADATA-ONLY lessons. The storyline screen's progress — the header fraction, each
        // chapter's bar, its green completion dot, and the final card's "story complete" title —
        // all walk `lessons[]`. The list payload omitted it, so in LIVE mode `countedLessons(s)`
        // returned 0, which made `chapterComplete()` reject its v69_l stamp (`rec.n === 0`) and then
        // fail its fallback (`counted.length > 0`) — false for every chapter except the active one.
        // One missing field, four broken readings: header "0/0", no chapter bars, no completion
        // dots, and "Lesson complete!" where the story was in fact finished.
        //
        // Same shape as the static build's baked topics, so ONE renderer serves both modes — the
        // v55_s/v58 precedent. Content is deliberately excluded: no savedList consumer reads
        // vocab/sentences (they all work from APP.lessonData, loaded on demand), and shipping the
        // full arrays would cost 1536KB against 50KB for this — 3.2%.
        lessons: (l.lessons || []).map(L => ({
          id: L.id,
          type: L.type || 'standard',
          ...(L._hidden     ? { _hidden: true }     : {}),
          ...(L._aiExamples ? { _aiExamples: true } : {}),
        })),
        // Distinct lesson-set types (first-seen order; missing -> 'standard'). The list
        // payload omits the full lessons[] (loaded on demand), so the client storyline
        // screen needs this to show each chapter's lesson-types dropdown in live mode.
        lessonTypes: (() => {
          const seen = new Set(), out = [];
          (l.lessons || []).forEach(L => { const ty = (L && L.type) ? L.type : 'standard'; if (!seen.has(ty)) { seen.add(ty); out.push(ty); } });
          return out;
        })(),
        qcFlags: (l.lessons || []).reduce((n, L) =>
          n + [...(L.vocab||[]), ...(L.sentences||[]), ...(L.items||[]), ...(L.words||[]), ...(L.letters||[])].filter(x => x && (x.qc || x.userFlag)).length, 0),
        storyQcPending: !!l.storyQcProposal,  // a bulk (or manual) story-QC proposal awaiting review
        // Compact generation-stats projection (v55_s). The storyline screen's stats block reads
        // exactly these four fields; static mode had them because it ships whole topics, while live
        // mode showed nothing because this list payload omitted generationStats entirely. Shipping
        // the FULL object would add ~103KB (+107%) for its per-lesson token breakdown, which no
        // list consumer reads — this projection costs ~24KB (+25%) and keeps the SAME SHAPE, so the
        // one renderer works unchanged in both modes. (The lesson page reads the full stats from
        // the on-demand topic fetch, not from here.)
        generationStats: l.generationStats ? {
          totalMs:               l.generationStats.totalMs,
          model:                 l.generationStats.model,
          totalPromptTokens:     l.generationStats.totalPromptTokens,
          totalCompletionTokens: l.generationStats.totalCompletionTokens,
        } : undefined,
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
    // Provenance (v58): set / replace / clear a topic's structured source. Sanitization is
    // entirely in sanitizeTopicSource (pure, unit-tested); a null result CLEARS the field so
    // the stored data never holds an empty object. Resolved by stable id only — provenance
    // edits must never fall back to name matching (same-name topics are legal).
    if (M === 'POST' && url.pathname === '/api/topic-source') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      if (!body.id) return json(res, 400, { error: 'Missing id' });
      const saved = findSavedById(body.id);
      if (!saved) return json(res, 404, { error: `Topic not found: ${String(body.id).slice(0, 40)}` });
      const source = sanitizeTopicSource(body.source);
      if (source) saved.source = source; else delete saved.source;
      stampUpdated(saved);
      saveStore(store);
      console.log(`  Source ${source ? 'set' : 'cleared'}: ${saved.id} "${saved.topic}"${source ? ` — ${Object.keys(source).join('/')}` : ''}`);
      return json(res, 200, { ok: true, source: source || null });
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
    // v69_n — teacher flag triage. Item-level flags live INSIDE lessons (item.userFlag) while
    // story-level ones live in the flags store, so a teacher had no single place to see what was
    // reported. Returns both, newest first, with the v69 `mode` so student reports can be picked
    // out — a learner who flags a wrong pair is the most valuable QC signal there is.
    if (M === 'GET' && url.pathname === '/api/flag-summary') {
      const ITEM_ARRAYS = ['vocab', 'sentences', 'items', 'words', 'letters', 'grammar', 'conjugations'];
      const out = [];
      (store.topics || []).forEach(t => (t.lessons || []).forEach(ls => {
        ITEM_ARRAYS.forEach(k => (ls[k] || []).forEach((it, idx) => {
          if (!it || !it.userFlag) return;
          out.push({ kind: 'item', topicId: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
            lessonId: ls.id, lessonType: ls.type || 'vocab', field: k, index: idx,
            target: it.target || null, source: it.source || null,
            comment: it.userFlag.comment || '', correct: it.userFlag.correct || '',
            mode: it.userFlag.mode || 'teacher', at: it.userFlag.at || null });
        }));
        (ls._miscFlags || []).forEach((f, idx) => out.push({ kind: 'misc', topicId: t.id, topic: t.topic,
          lessonId: ls.id, lessonType: ls.type || 'vocab', index: idx,
          comment: f.comment || '', mode: f.mode || 'teacher', at: f.at || null }));
      }));
      Object.entries(store.flags || {}).forEach(([key, f]) => {
        if (!f || typeof f !== 'object') return;
        out.push({ kind: 'story', key, topic: f.topic || null, type: f.type || 'story',
          mode: f.mode || 'teacher', at: f.flaggedAt || null });
      });
      out.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      const byMode = out.reduce((m, f) => (m[f.mode] = (m[f.mode] || 0) + 1, m), {});
      return json(res, 200, { flags: out, total: out.length, byMode });
    }
    if (M === 'GET' && url.pathname === '/api/flags') {
      return json(res, 200, getFlags());
    }
    // v60.8: global %-solved threshold to complete a chapter. Pure config (no Ollama needed), so
    // NOT behind the /api/models backend guard. GET returns 0..1; POST { value:0..1 } sets it.
    if (url.pathname === '/api/coverage-threshold') {
      if (M === 'GET') return json(res, 200, { value: getSettings().coverageThreshold });
      if (M === 'POST') {
        let body;
        try { body = JSON.parse(await readBody(req)); }
        catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
        if (typeof body.value !== 'number' || !Number.isFinite(body.value))
          return json(res, 400, { error: 'value must be a number 0..1' });
        const v = setCoverageThreshold(body.value).coverageThreshold;
        console.log(`  Coverage threshold set: ${Math.round(v*100)}%`);
        return json(res, 200, { ok: true, value: v });
      }
    }
    // v69_i: per-storyline and per-chapter pass marks. One route for both scopes so the validation
    // and the null-clearing semantics cannot drift. value:null clears the override, which is NOT
    // the same as 0 (0 = "no pass mark, anything completes"); the client sends null for "inherit".
    // v69_m — stage 2 of the upload cleanup: remove NON-NARRATIVE fragments the deterministic pass
    // cannot classify (ads, "read also" teasers, captions, subscription prompts) — text that reads
    // as grammatical prose and so survives every mechanical rule. Deletion-only by contract, and
    // VERIFIED as such: see cleanTextChanges(). Per chunk, so the model sees a lesson-sized passage.
    if (M === 'POST' && url.pathname === '/api/clean-text') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const text = String(body.text || '');
      if (text.trim().length < 40) return json(res, 400, { error: 'Text too short to clean.' });
      if (text.length > 20000) return json(res, 400, { error: 'Text too long — split it first.' });
      try { return json(res, 200, await cleanNarrativeText(text, body.lang || 'en')); }
      catch(e) { return json(res, 502, { error: e.message }); }
    }
    if (M === 'POST' && url.pathname === '/api/split-chapters') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const paras = Array.isArray(body.paragraphs) ? body.paragraphs.map(p => String(p || '').trim()).filter(Boolean) : [];
      if (paras.length < 2) return json(res, 400, { error: 'Need at least two paragraphs to split.' });
      if (paras.length > 400) return json(res, 400, { error: 'Too many paragraphs — split the document first.' });
      try { return json(res, 200, await splitChaptersLLM(paras, body.lang || 'en', !!body.drop)); }
      catch(e) { return json(res, 502, { error: e.message }); }
    }
    if (M === 'POST' && url.pathname === '/api/pass-mark') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { scope, id } = body;
      const clearing = body.value === null;
      if (!clearing && (typeof body.value !== 'number' || !Number.isFinite(body.value)))
        return json(res, 400, { error: 'value must be a number 0..1, or null to inherit' });
      const v = clearing ? null : Math.max(0, Math.min(1, body.value));
      if (scope === 'storyline') {
        const sl = findStoryline(id);
        if (!sl) return json(res, 404, { error: 'Storyline not found' });
        if (clearing) delete sl.coverageTarget; else sl.coverageTarget = v;
        upsertStoryline(sl);
        console.log(`  Pass mark (storyline "${sl.title || sl.id}"): ${clearing ? 'inherit' : Math.round(v*100)+'%'}`);
        return json(res, 200, { ok: true, value: v });
      }
      if (scope === 'topic') {
        const t = findSavedById(id);
        if (!t) return json(res, 404, { error: 'Topic not found' });
        if (clearing) delete t.coverageTarget; else t.coverageTarget = v;
        upsert(t);
        console.log(`  Pass mark (chapter "${t.topic}"): ${clearing ? 'inherit' : Math.round(v*100)+'%'}`);
        return json(res, 200, { ok: true, value: v });
      }
      return json(res, 400, { error: "scope must be 'storyline' or 'topic'" });
    }
    // v79_n (user): a default SPEECH LOCALE per storyline, overridable per chapter — the same
    // scope/override shape as /api/pass-mark above, deliberately, because the user named the pass
    // mark as the model and two settings with the same semantics should not have two shapes.
    //
    // A LOCALE (`en-GB`), not a voice name. The user's own Android screenshot is the argument: its
    // voice names are localized German strings ("Englisch Nigeria") that exist on that device and
    // nowhere else, so a stored name would fail to resolve almost everywhere and the fallback
    // would fire nearly always — making the field decorative. A locale is portable, every engine
    // can honour it, and the app already ranks voices within a locale.
    if (M === 'POST' && url.pathname === '/api/speech-locale') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { scope, id } = body;
      const clearing = body.value === null || body.value === '';
      // Shape-check only. WHICH locales exist is a device fact the server cannot know, and
      // rejecting an unknown tag here would mean the server holding a list of the world's locales
      // — the "no language knowledge in the code" principle (INTERNALS §4). BCP-47-ish is enough.
      if (!clearing && (typeof body.value !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(body.value)))
        return json(res, 400, { error: 'value must be a BCP-47 locale like "en-GB", or null to inherit' });
      const v = clearing ? null : body.value;
      if (scope === 'storyline') {
        const sl = findStoryline(id);
        if (!sl) return json(res, 404, { error: 'Storyline not found' });
        if (clearing) delete sl.speechLocale; else sl.speechLocale = v;
        upsertStoryline(sl);
        console.log(`  Speech locale (storyline "${sl.title || sl.id}"): ${clearing ? 'inherit' : v}`);
        return json(res, 200, { ok: true, value: v });
      }
      if (scope === 'topic') {
        const t = findSavedById(id);
        if (!t) return json(res, 404, { error: 'Topic not found' });
        if (clearing) delete t.speechLocale; else t.speechLocale = v;
        upsert(t);
        console.log(`  Speech locale (chapter "${t.topic}"): ${clearing ? 'inherit' : v}`);
        return json(res, 200, { ok: true, value: v });
      }
      return json(res, 400, { error: "scope must be 'storyline' or 'topic'" });
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
      const { storylineId, topicId, lessonIdx, onlyFlagged, force, includeStory } = body;
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
      _runQc(jobId, topics, { lessonIdx: (lessonIdx === undefined ? null : lessonIdx), onlyFlagged: !!onlyFlagged, force: !!force, includeStory: includeStory !== false })
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
        // v80_l / PLAN §9c: a title the USER typed is authored by definition, so clear the
        // placeholder flag. Without this a hand-named book would be retitled by the post-pass
        // the next time a chapter was added — the v78_r ruling, broken from the other side.
        if (title     !== undefined) { patch.title = (title||'').slice(0,80); patch.titleAuto = false; }
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
              userStory, userTranslation, userDialect, storyStyle, reinforcePrior, vocabMode, useFullChain, userStoryLang, mathInstruction, fromLearned,
              script, srcScript } = body;
      // continuedFrom may arrive as a stable tp_ id (from the continue-select)
      // or a topic name (other paths). Normalize to the canonical topic name so
      // everything downstream is unaffected by which the client sent.
      const _contParent = continuedFrom ? (findSavedById(continuedFrom) || findSaved(continuedFrom)) : null;
      const continuedFromName = _contParent ? _contParent.topic : null;
      // "My story" has no typed topic — synthesize one from the languages so the rest of the
      // pipeline (which is topic-keyed) works unchanged. A unique suffix avoids clobbering.
      const _hasLearned = !!(fromLearned && Array.isArray(fromLearned.vocab) && fromLearned.vocab.length);
      const _myStoryTopic = _hasLearned
        ? `My review — ${langName(lang || 'it')} (${new Date().toISOString().slice(0,10)})`
        : null;
      const resolvedTopic = (topic && topic.trim().length >= 2) ? topic.trim()
        : continuedFromName ? continuedFromName
        : _myStoryTopic ? _myStoryTopic : null;
      if (!resolvedTopic) return json(res, 400, { error: 'Topic too short or missing' });
      if (topic !== resolvedTopic) body.topic = resolvedTopic;
      const diff = Math.max(1, Math.min(3, parseInt(difficulty, 10) || 2));
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms','word_forms','inflections','comprehension','writing'].includes(lessonFormat) ? lessonFormat : 'standard';   // v68.1: word_forms was missing — the picker offered it but the route clamped it to 'standard'. v71_l: comprehension added here at the same time as the picker entry, which is the pairing that guard enforces. inflections added the same way, deliberately, this session. writing added the same way at v82_e.
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
      const topicKey = resolvedTopic.toLowerCase();
      const resolvedSrcLang = srcLang || 'en';
      if (!forceRegenerate) {
        const cached = findSaved(resolvedTopic);
        if (cached && cached.lang === (lang||'it') && cached.srcLang === (resolvedSrcLang||'en')) {
          console.log(`  Cache hit: "${resolvedTopic}" (${lang}←${resolvedSrcLang})`);
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
        // v76_h: the script a digraphic language should be written in. Validated against
        // scripts.json rather than trusted — an unknown value would reach the prompt verbatim,
        // and a value for a language with no choice would name a script that does not apply.
        script:          _validScript(lang, script),
        srcScript:       _validScript(srcLang, srcScript),
        prevStoryTopic:  combinedUserStory || null,
        userTranslation: userTranslation ? String(userTranslation).trim() : null,
        userDialect:     userDialect     ? String(userDialect).trim()     : null,
        storyStyle:      (storyStyle && getStoryStyle(storyStyle) !== undefined) ? storyStyle : null,
        lessonFormat:    fmt,
        reinforcePrior:  reinforcePrior === true,
        vocabMode:       vocabMode ? String(vocabMode) : null,
        useFullChain:    useFullChain === true,
        mathInstruction: mathInstruction ? String(mathInstruction).slice(0,500) : null,
        // "My story": the learner's known-word slice (client-supplied). Sanitize + cap hard —
        // this is untrusted input that goes into a prompt. Keep only target/source strings and a
        // boolean-ish `wrong` count, max 60 items, short strings.
        fromLearned: (fromLearned && Array.isArray(fromLearned.vocab) && fromLearned.vocab.length)
          ? { vocab: fromLearned.vocab.slice(0, 60)
                .map(w => ({ target: String(w && w.target || '').slice(0, 80),
                             source: String(w && w.source || '').slice(0, 120),
                             wrong: Math.max(0, Math.min(999, parseInt(w && w.wrong, 10) || 0)) }))
                .filter(w => w.target) }
          : null,
      };
      console.log(`  Generating: "${resolvedTopic}" (${langName(lang||'it')}, from ${langName(resolvedSrcLang)}) diff=${diff} fmt=${fmt} storyLen=${wc}${userOpts.fromLearned?' myStory=yes':''}${userOpts.userStory?' userStory=yes':''}${userOpts.userTranslation?' translation=yes':''}${userOpts.userDialect?' dialect='+userOpts.userDialect:''}${userOpts.storyStyle?' style='+userOpts.storyStyle:''}${contFrom?' cont='+contFrom:''} job=${jobId}`);
      generate(resolvedTopic, lang || 'it', resolvedSrcLang, diff, contFromForStory, wc, jobId, userOpts).then(data => {
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
      const { chunks, lang, srcLang, difficulty, lessonFormat, continuedFrom, userStoryLang, arc, arcReinforce, arcMode, arcScript,
              generated, topic, nChapters, chapterLen, storyStyle, sourceFile,
              // v78_g: the chosen scripts, so the arc primer can narrow a DIGRAPHIC side the way
              // /api/generate does. Absent from older clients → undefined → the gate falls back to
              // every script the language admits, i.e. exactly the pre-v78_g answer.
              script, srcScript } = body;
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
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms','word_forms','inflections','comprehension','writing'].includes(lessonFormat) ? lessonFormat : 'standard';   // v68.1: word_forms was missing — the picker offered it but the route clamped it to 'standard'. v71_l: comprehension added here at the same time as the picker entry, which is the pairing that guard enforces. inflections added the same way, deliberately, this session. writing added the same way at v82_e.
      // Arc: each chapter gets the lesson types the user ticked, generated in reinforce mode.
      // v71_u: the client now sends `arcTypes` (the shared tick-list, same as the storyline
      // add-lessons run). `arcMode` is still honoured for older clients and is translated into a
      // list here, so there is exactly one shape downstream.
      const _picked = sanitizeArcTypes(body.arcTypes);
      const _arcTypes = (_picked && _picked.length)
        ? _picked
        : arcTypesFromLegacyMode(arcMode, arcReinforce);
      const arcEnabled = !!arc;
      // Normalize the chain root (id or name) to a name for downstream context.
      const rootParent = continuedFrom ? (findSavedById(continuedFrom) || findSaved(continuedFrom)) : null;
      const base = { lang: lang || 'it', srcLang: srcLang || 'en', diff, fmt,
        // v78_g: the CHOSEN scripts travel with the job. Without them `base.script` is undefined
        // downstream and buildArcIntroLessons silently falls back to "every script the language
        // admits" — which is the very thing the fix narrows, so the arc primer would have kept the
        // old behaviour while the gate reported the new one.
        script: script || null, srcScript: srcScript || null,
        // v69_p: token spend from the ✨ upload cleanup, which happens BEFORE any storyline exists.
        // Sanitised here rather than trusted: it is client-supplied and only ever added to a ledger.
        cleanupTokens: (body.cleanupTokens && typeof body.cleanupTokens === 'object')
          ? { promptTokens: Math.max(0, Math.min(1e7, body.cleanupTokens.promptTokens | 0)),
              completionTokens: Math.max(0, Math.min(1e7, body.cleanupTokens.completionTokens | 0)) }
          : null,
        continuedFrom: rootParent ? rootParent.id : null, userStoryLang: userStoryLang || null,
        arc: arcEnabled, arcTypes: _arcTypes,
        // Retained for logging/back-compat only — nothing downstream branches on it since v71_u.
        arcMode: arcMode === 'grammar' ? 'grammar' : 'vocab',
        // Arc script-teaching opt-in. Default ON when the target uses a script the source
        // doesn't (so a learner of a new alphabet gets per-chapter primers automatically);
        // the client can pass arcScript:false to suppress it.
        arcScript: arcEnabled && (arcScript === undefined ? needsIntroScript(lang || 'it', srcLang || 'en', { script, srcScript }) : !!arcScript),
        generated: !!generated, baseTopic, chapterLen: chapterLenN,
        sourceFile: (typeof sourceFile === 'string' && sourceFile.trim()) ? sourceFile.trim().slice(0,200) : null,
        storyStyle: (storyStyle && storyStyle !== 'creative') ? storyStyle : null };
      const bookId = newBookJob(chaptersIn.map((c, i) => c.title || (baseTopic ? `${baseTopic.slice(0,40)} — ${i+1}` : '')));
      console.log(`  Book generation started: ${chaptersIn.length} chapter(s)${generated?` (generated from "${baseTopic}")`:' (from upload)'}, id=${bookId}`);
      // v78_q: the SCRIPTS are logged. They were not, which is why two rounds of "the story came
      // out in Latin" could not be told apart from the outside: a job that never received the
      // script and a job that received it and ignored it print the same line otherwise. Also
      // `arcScript`, for the same reason — `arc=[...]` lists the TYPES and has never said whether
      // the script primer was on.
      console.log(`    lang=${base.lang}  srcLang=${base.srcLang}  difficulty=${base.diff}  format=${base.fmt}` +
        `  script=${base.script||'-'}  srcScript=${base.srcScript||'-'}` +
        `  style=${base.storyStyle||'(default)'}  arc=${base.arc?'['+base.arcTypes.join(',')+']':'off'}` +
        `  arcScript=${base.arcScript?'on':'off'}` +
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
    if (M === 'POST' && url.pathname === '/api/dialect-story') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const topic = (String(body.id||'').startsWith('tp_') ? findSavedById(body.id) : findSaved(body.id));
      if (!topic) return json(res, 404, { error: 'Dialect topic not found' });
      if (!topic._dialect) return json(res, 400, { error: 'Not a dialect topic' });
      // A dialect story is the model AUTHORING dialect prose. We ALWAYS mark it aiGenerated +
      // needsReview and never present it as trusted. Generation is allowed so the human has a
      // sample to READ and judge — approval (curation) is a separate, explicit human act (see
      // /api/dialect-curate) that records "a human read this and it's good".
      const storyTopic = String(body.topic || '').slice(0, 300);
      const instructions = String(body.instructions || '').slice(0, 600);
      const method = body.method === 'rewrite' ? 'rewrite' : 'direct';
      const jobId = newJob();
      const glossaryRows = (topic.lessons||[]).flatMap(l => (l.vocab||[]).filter(v => v && v.target && v.source)
        .map(v => ({ target: v.target, source: v.source })));
      (async () => {
        try {
          jobStep(jobId, method === 'rewrite' ? 'Writing a Standard-German story, then rewriting into dialect…' : 'Generating a dialect story…');
          const out = method === 'rewrite'
            ? await generateDialectStoryV2(glossaryRows, topic._dialect.base || 'de', { topic: storyTopic, instructions, long: !!body.long })
            : await generateDialectStory(glossaryRows, topic._dialect.base || 'de', { topic: storyTopic, instructions, long: !!body.long });
          if (!out) { jobFail(jobId, 'The model did not return a usable story.'); return; }
          const fresh = findSavedById(topic.id) || topic;
          fresh.story = out.story;
          // aiStory = the immutable ORIGINAL AI text. Setting it here (at generation) means a later
          // human edit of the dialect story produces a correct AI-error-hunt diff (original vs fixed).
          fresh.aiStory = out.story;
          fresh.storyGloss = out.gloss;
          fresh.storyTopic = storyTopic || fresh.storyTopic || '';
          fresh._dialect.aiStory = { at: new Date().toISOString(), needsReview: true, topic: storyTopic, instructions,
            method: out.method || 'direct',
            standardSource: out.standardSource || '',
            coverage: out.coverage || null };
          fresh._dialect.curated = false;   // a NEW story resets approval — it must be re-reviewed
          fresh._dialect.curatedAt = null;
          fresh.aiGenerated = true;
          stampUpdated(fresh);
          upsert(fresh);
          const covStr = out.coverage ? ` [coverage ${out.coverage.used}/${out.coverage.total}]` : '';
          console.log(`  🤖 Dialect story (${out.method||'direct'}) for "${fresh.topic}"${storyTopic?` (topic: ${storyTopic})`:''}${covStr} — needs review`);
          jobDone(jobId, { id: fresh.id, chars: out.story.length, method: out.method || 'direct', coverage: out.coverage || null });
        } catch (e) { jobFail(jobId, e.message || String(e)); }
      })();
      return json(res, 202, { jobId });
    }

    if (M === 'POST' && url.pathname === '/api/dialect-curate') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const topic = (String(body.id||'').startsWith('tp_') ? findSavedById(body.id) : findSaved(body.id));
      if (!topic) return json(res, 404, { error: 'Dialect topic not found' });
      if (!topic._dialect) return json(res, 400, { error: 'Not a dialect topic' });
      // Curation = a human approves the generated story as good dialect. Requires a story to review.
      const wantCurated = !!body.curated;
      if (wantCurated && !(topic.story && topic._dialect.aiStory)) {
        return json(res, 400, { error: 'Generate a dialect story first, then review it before approving.' });
      }
      topic._dialect.curated = wantCurated;
      topic._dialect.curatedAt = wantCurated ? new Date().toISOString() : null;
      if (topic._dialect.aiStory) topic._dialect.aiStory.needsReview = !wantCurated;
      stampUpdated(topic);
      upsert(topic);
      console.log(`  🗣 Dialect "${topic.topic}" story approved=${wantCurated}`);
      return json(res, 200, { ok: true, id: topic.id, curated: wantCurated });
    }

    if (M === 'POST' && url.pathname === '/api/dialect-import') {
      let body;
      try { body = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const text = String(body.text || '');
      const label = String(body.label || '').trim();
      if (!text.trim()) return json(res, 400, { error: 'No glossary text' });
      if (!label) return json(res, 400, { error: 'A dialect name is required' });
      // Deterministic, no-LLM parse + build. The rows are ground truth; suspicious rows are
      // reported (not auto-fixed) so the user can correct the source and re-import.
      const { rows, report } = parseDialectGlossary(text, { threeCol: !!body.threeCol });
      if (!rows.length) return json(res, 400, { error: 'No rows parsed', report });
      const topic = buildDialectTopic(rows, {
        label,
        base: 'de', source: body.source ? String(body.source).slice(0, 8) : 'de',
        note: body.note ? String(body.note).slice(0, 500) : '',
        attribution: body.attribution ? String(body.attribution).slice(0, 300) : '',
      }, { id: _newTopicId(), perLesson: Math.max(1, Math.min(50, parseInt(body.perLesson, 10) || 12)), now: new Date().toISOString() });
      upsert(topic);
      console.log(`  🗣 Dialect imported: "${label}" — ${rows.length} rows, ${topic.lessons.length} lesson(s)${report.suspicious.length ? `, ${report.suspicious.length} suspicious` : ''}`);
      return json(res, 200, { ok: true, id: topic.id, topic: topic.topic, rows: rows.length, lessons: topic.lessons.length, report });
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
      const _storyChanged = (saved.story !== story);
      saved.story = story;
      stampUpdated(saved);
      // A changed story invalidates any prior clean QC on lessons whose checkable content is
      // derived from the story text (error-hunt variants). The ai_error_hunt lesson is rebuilt
      // fresh below (losing its stamp anyway); clear the others explicitly.
      if (_storyChanged) {
        for (const ls of (saved.lessons || [])) {
          if (ls && ls.qcAt && (ls.type === 'error_hunt' || ls.type === 'ai_error_hunt')) {
            _clearLessonQcStamp(ls);
            console.log(`    ↺ QC stamp cleared (story edit) on "${ls.title || ls.type}"`);
          }
        }
        // A changed story also invalidates its story-QC checked stamp (so the next bulk sweep
        // re-proofreads it) and any pending story-QC proposal (it was diffed against the old text).
        if (saved.storyQcCheckedAt !== undefined) { delete saved.storyQcCheckedBy; delete saved.storyQcCheckedAt; }
        if (saved.storyQcProposal) { delete saved.storyQcProposal; console.log(`    ↺ stale story-QC proposal cleared (story edit)`); }
      }
      let aiHuntEdits;
      // The AI error-hunt is a PURE diff between the original AI text (aiStory) and the human's
      // corrected story — no LLM judges anything. For dialect this is ideal: the human fixes the AI's
      // dialect slop and those corrections become the lesson. So it runs for dialect topics too.
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
      // Flag fields (qc, userFlag) and the rating flag (userRating) are
      // client-authoritative: if the incoming item omits them, the client cleared
      // it, so don't resurrect it from the stored copy (fixes "fix/✕ doesn't clear
      // the flag/star" on reload).
      const mergeFlaggable = (o, v) => {
        const m = { ...o, ...v };
        if (!('qc' in v))         delete m.qc;
        if (!('qcByModel' in v))  delete m.qcByModel;
        if (!('userFlag' in v))   delete m.userFlag;
        if (!('userRating' in v)) delete m.userRating;
        return m;
      };
      const origLessons = saved.lessons.slice();
      saved.lessons = lessons.map((edited, i) => {
        const orig = (edited.id ? origLessons.find(ls => ls.id === edited.id) : null) || origLessons[i] || null;
        // A newly added lesson (e.g. a no-LLM "mixed review", which has no vocab/sentences
        // and carries its own `type`/`perType`) has no stored counterpart — preserve its
        // full shape rather than cherry-picking content fields and dropping its type.
        if (!orig) return { ...edited };
        const merged = {
          ...orig,
          ...(edited.type    !== undefined ? { type:    edited.type }    : {}),
          ...(edited.perType !== undefined ? { perType: edited.perType } : {}),
          ...(edited.title !== undefined ? { title: edited.title } : {}),
          ...(edited.icon  !== undefined ? { icon:  edited.icon  } : {}),
          vocab:     edited.vocab     ? edited.vocab.map((v,j) => mergeFlaggable((orig.vocab||[])[j]||{}, v)) : orig.vocab,
          sentences: edited.sentences ? edited.sentences.map((s,j) => mergeFlaggable((orig.sentences||[])[j]||{}, s)) : orig.sentences,
          // synonyms (words) + word_forms (items): carry their flaggable item fields too,
          // so a flag/rating on those types persists in the live build (not just static).
          words:     edited.words     ? edited.words.map((w,j) => mergeFlaggable((orig.words||[])[j]||{}, w)) : orig.words,
          items:     edited.items     ? edited.items.map((it,j) => mergeFlaggable((orig.items||[])[j]||{}, it)) : orig.items,
          // v75_e (user-reported): comprehension `questions` were NOT in this whitelist, so every
          // edit to a comprehension lesson — the question, any choice, the correct answer, the
          // explanation — was accepted with HTTP 200 and silently dropped. The client kept it in
          // memory, so it survived closing and reopening the editor and only vanished on the next
          // load from the server; the stored diff showed nothing but a fresh `updatedAt`.
          // Same flaggable merge as words/items so a flag or rating on a question would ride the
          // same client-authoritative path (nothing sets one today; this is not a special case).
          questions: edited.questions ? edited.questions.map((q,j) => mergeFlaggable((orig.questions||[])[j]||{}, q)) : orig.questions,
          // intro_script letters: same flaggable merge so a flag/rating/edit on a letter persists.
          letters:   edited.letters   ? edited.letters.map((L,j) => mergeFlaggable((orig.letters||[])[j]||{}, L)) : orig.letters,
          grammar:   edited.grammar   ? edited.grammar.map((g,j) => ({...(orig.grammar||[])[j]||{}, ...g})) : orig.grammar,
          conjugations: edited.conjugations ? edited.conjugations.map((c,j) => ({
            ...(orig.conjugations||[])[j]||{}, ...c,
            forms: c.forms ? c.forms.map((f,k) => ({...((orig.conjugations||[])[j]?.forms||[])[k]||{}, ...f})) : (orig.conjugations||[])[j]?.forms,
          })) : orig.conjugations,
          ...(edited.corruptedStory !== undefined ? { corruptedStory: edited.corruptedStory } : {}),
          ...(edited.correctStory   !== undefined ? { correctStory:   edited.correctStory   } : {}),
          // writing (PLAN §D4, v82): single-field lesson, same shape as corruptedStory/correctStory
          // above — reproduced the v75_e bug fresh (a new lesson type's own fields are not on this
          // whitelist by default) before this line existed, caught by e2e-lesson-edit-roundtrip's
          // registry-coverage check. `question` (v82_f, replacing `prompt`/`hint`): the source-
          // language comprehension question the learner writes an answer to.
          ...(edited.question !== undefined ? { question: edited.question } : {}),
          // v75_e: the math editor's own inputs (_editorReadInputsMath writes exactly these two).
          // Same omission as `questions` above — changing the number pool or the operator set
          // returned 200 and changed nothing.
          ...(edited.numbers  !== undefined ? { numbers:  edited.numbers  } : {}),
          ...(edited.mathOps  !== undefined ? { mathOps:  edited.mathOps  } : {}),
          ...(edited._hidden         !== undefined ? { _hidden:         edited._hidden         } : {}),
          edits: edited.edits ? edited.edits.map((e,j) => ({...(orig.edits||[])[j]||{}, ...e})) : orig.edits,
        };
        // Invalidate the "QC'd & clean" stamp iff the lesson's CONTENT changed (a pure
        // flag/rating/qc clear must not force a re-QC). qcSignature ignores flag fields.
        if (merged.qcAt && qcSignature(orig) !== qcSignature(merged)) {
          _clearLessonQcStamp(merged);
          console.log(`    ↺ QC stamp cleared (edited) on "${merged.title || merged.type}"`);
        }
        return merged;
      });
      stampUpdated(saved);
      saveStore(store);
      console.log(`  Edited lessons for "${saved.topic}"`);
      return json(res, 200, { ok: true });
    }

    // ── Add lesson to existing topic ──────────────────────────────────────
    if (M === 'POST' && url.pathname === '/api/lessons/add-lesson') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { id, topic, lessonFormat: fmt, difficulty: rawDiff, reinforcePrior: addReinforce, vocabMode: addVocabMode, mathInstruction: addMathInstr, mathOps: addMathOps, introScript: addIntroScript } = body;
      if (!id && !topic) return json(res, 400, { error: 'Missing id or topic' });
      if (!fmt)    return json(res, 400, { error: 'Missing lessonFormat' });
      const saved = id ? findSavedById(id) : findSaved((topic||'').trim());
      if (!saved)  return json(res, 404, { error: `Topic not found: ${id || topic}` });
      // Dialect topics: refuse LLM-authoring formats. Those generators run in the base language and
      // don't know the dialect — they'd inject standard-German / mis-judged content into a dialect
      // topic. Only the dialect-safe formats are allowed (standard vocab, math, mixed review).
      const _DIALECT_BLOCKED_FMTS = new Set(['synonyms','word_forms','inflections','error_hunt','grammar','conjugation','all_types','writing']);
      if (saved._dialect && _DIALECT_BLOCKED_FMTS.has(fmt)) {
        return json(res, 400, { error: 'That lesson type is not available for dialect topics (it would generate non-dialect content). Use Standard, Math, or Mixed review.' });
      }
      // intro_script is procedural + story-independent (it teaches the alphabet); every other
      // format needs a story and a live backend.
      const _isIntro = (fmt === 'intro_script');
      if (!_isIntro && !saved.story) return json(res, 400, { error: 'Topic has no story to base lessons on' });
      if (!_isIntro && active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
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
        const _genT0 = Date.now();
        let result;
        const chainVocab = (_addVocabMode !== 'neutral' && (saved.continuedFromId || saved.continuedFrom))
          ? collectChainVocab(saved.continuedFromId || saved.continuedFrom)
          : { words: [], nouns: [], verbs: [] };
        if (chainVocab.words.length)
          console.log(`    Chain vocab (${_addVocabMode}): ${chainVocab.words.slice(0,15).map(v=>v.target).join(', ')}`);
        // Dispatch the lessonFormat to its generator via the ADD_LESSON_GENERATORS
        // registry (B-phase-4). standardOpts / sharedGenOpts are the two opt shapes the
        // generators expect; building both unconditionally is side-effect-free.
        // v79_f: the chapter's own script travels with every add-lessons generation. Without it
        // `scriptPinNote` cannot fire and a digraphic chapter gets lessons in whichever script the
        // model reaches for — the reported `tp_17864554460460000107`, Cyrillic story, Latin
        // conjugation. `saved.script` is the stamp v76_h put on the chapter for exactly this.
        const _chapScript = saved.script || null;
        const standardOpts = { userTranslation: saved.storyTranslation || null, userDialect: dialect, writingStyle: style, storyLang: saved.storyLang || 'target', story: saved.story || null, chainVocab: chainVocab.words, vocabMode: _addVocabMode, script: _chapScript };
        // v71_o: comprehension questions read the whole chain, not just this chapter.
        const _chainStory = collectChainStory(saved);
        if (_chainStory.chapters > 1)
          console.log(`    Lesson context: ${_chainStory.chapters} chapters, ${_chainStory.text.length} chars`);
        const sharedGenOpts = { userDialect: dialect, storyStyle: style, chainVocab, vocabMode: _addVocabMode, story,
                                script: _chapScript,   // v79_f
                                chainStory: _chainStory.text, chainStoryChapters: _chainStory.chapters };
        const genCtx = { lang, srcLang, topicName, story, diff, jobId, chainVocab, standardOpts, sharedGenOpts, addMathInstr, addMathOps, introScript: addIntroScript || null, script: _chapScript };
        const genFn = ADD_LESSON_GENERATORS[fmt];
        if (!genFn) throw new Error(`Unsupported lessonFormat: ${fmt}`);
        // v59: meter the whole generator run (some formats are multi-call) and fold it into
        // the topic's cumulative totals — an added lesson is this chapter's work.
        const { result: _genResult, tokens: _alTok } = await meterLLMTokens(() => genFn(genCtx));
        result = _genResult;
        addTokenUsage(saved, _alTok, 'add_lesson');
        // Compute next available ID (avoid clashing with existing)
        // Generate a stable string ID for the new lesson
        const newLessonId = 'ls_' + Date.now();
        // v56: record the difficulty this lesson was GENERATED at. It was computed above (from the
        // request, falling back to the topic's) and used for the prompt — but never stored, so an
        // "advanced" lesson added to a beginner topic displayed as beginner: the lesson list renders
        // `L.difficulty || topicDiff` (index.html:1215) and fell back. The display was always right;
        // the data was missing. Only math/intro_script stored it (they need it at PLAY time), which
        // is why the gap went unnoticed. `...result.lesson` first so a generator that sets its own
        // difficulty (math, intro_script) still wins.
        const newLesson = { difficulty: diff, ...result.lesson, id: newLessonId };
        // E0: generators stamp lesson._genMeta (model, attempts, valid, rejected,
        // rejectReasons, tokens, ms, at) so every flow carries it. Fallback only if a
        // generator somehow didn't — keep the lesson annotated regardless.
        if (!newLesson._genMeta) {
          newLesson._genMeta = buildGenMeta({
            // The generator didn't stamp. Do NOT assume the lesson model — a procedural or
            // story-model generator would be recorded as something it never was.
            type: result.lesson.type, model: '(unknown)', t0: _genT0,
            valid: Array.isArray(result.lesson.items) ? result.lesson.items.length
                   : Array.isArray(result.lesson.vocab) ? result.lesson.vocab.length : null,
            promptTokens: result.tokens && result.tokens.promptTokens,
            completionTokens: result.tokens && result.tokens.completionTokens,
          });
        }
        // Always append — ➕ button adds a new lesson set, never replaces
        saved.lessons.push(newLesson);
        console.log(`    Appended ${fmt} lesson (id ${newLesson.id}), total: ${saved.lessons.length}`);
        stampUpdated(saved);
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

    // ── Re-create all lessons for a storyline (keep + hide old, add arc lessons) ──
    if (M === 'POST' && url.pathname === '/api/storyline/recreate-lessons') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch (e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const startId = body.id || body.chapterId || body.startId;
      if (!startId) return json(res, 400, { error: 'missing chapter id' });
      const jobId = newJob();
      // v71_p: `addTypes` is the tick-list from the shared picker (ADD, keeping existing lessons);
      // `arcMode` remains for older clients and still re-creates.
      const _addTypes = Array.isArray(body.addTypes) ? body.addTypes : null;
      console.log(_addTypes
        ? `  Add storyline lessons: start=${startId}, types=${_addTypes.join(',')}`
        : `  Re-create storyline lessons: start=${startId}, arcMode=${body.arcMode || 'vocab'}`);
      _runRecreateJob(jobId, startId, { arcMode: body.arcMode, addTypes: _addTypes, add: !!body.add })
        .then(r => jobDone(jobId, r))
        .catch(e => { console.error('  Re-create error:', e.message); jobFail(jobId, e.message); });
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
        // v59: both retitle scopes are ONE call each covering the whole storyline, so tokens
        // go to the STORYLINE bucket (splitting one call across N chapters would be noise).
        if (sc === 'chapters' || sc === 'all') {
          const { result: chapterMeta, tokens: _mTok } = await meterLLMTokens(() => generateChapterMeta(stories, srcLang, lang));
          addTokenUsage(sl, _mTok, 'retitle');
          _applyChapterTitles(topics, chapterMeta, null);
          out.chapters = topics.map(t => ({ id: t.id, topic: t.topic, emoji: t.topicEmoji || '' }));
        }
        if (sc === 'title' || sc === 'all') {
          const { result: { title, icon }, tokens: _mTok } = await meterLLMTokens(() => generateStorylineTitle(topics.map(t => t.topic), stories, srcLang));
          addTokenUsage(sl, _mTok, 'retitle');
          sl.title = title; sl.icon = icon || sl.icon || '📖'; sl.titleAuto = false;
          out.title = title; out.icon = sl.icon;
        }
        upsertStoryline(sl);   // persists title AND accumulated tokens for either scope
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
        const { result: { text: summary, meta: summaryMeta }, tokens: _mTok } =
          await meterLLMTokens(() => generateStorylineSummary(topics, stories, vocab, srcLang));
        // Persist on the storyline object (+ cumulative tokens — storyline-level artefact, v59)
        const sl = findStoryline(slId);
        if (sl) { addTokenUsage(sl, _mTok, 'summary'); sl.summary = summary; sl.summaryMeta = summaryMeta; upsertStoryline(sl); }
        return json(res, 200, { summary });
      } catch(e) {
        return json(res, 500, { error: e.message });
      }
    }

    // ── Storyline storyboard (v55) — clone of the summary route above. The composed SVG is
    // server-validated (composeStoryboardSVG is the security boundary); the client only
    // injects the finished string. NOTE: synchronous like the summary — on a big story model
    // this call can run ~30 min (spike-measured); the ⏳ button just waits.
    if (M === 'POST' && url.pathname === '/api/storyline-storyboard') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, topics, scheme } = body;
      if (!slId || !Array.isArray(topics) || !topics.length)
        return json(res, 400, { error: 'Missing slId or topics' });
      const topicData = topics.map(t => findSaved(t)).filter(Boolean);
      if (!topicData.length) return json(res, 404, { error: 'No topics found' });
      // Stories / srcLang / majority-style derivation moved into _storyboardForStoryline (v68.1),
      // shared with the book-job storyboard post-pass so the two callers cannot drift.
      const _sbT0 = Date.now();
      try {
        const { storyboard, scheme: usedScheme } = await _storyboardForStoryline(slId, topicData, scheme);
        return json(res, 200, { storyboard, scheme: usedScheme });
      } catch(e) {
        // v55_b: a synchronous ~30-min call MUST NOT fail silently on the server console — the
        // toast is the only other witness and the tab may be long closed. (A dead Ollama runner
        // lands here as a network error; keep_alive is -1, so an empty `ollama ps` afterwards
        // means Ollama/its runner DIED, not that it finished and unloaded.)
        console.error(`  ✗ Storyline storyboard FAILED after ${((Date.now() - _sbT0) / 1000).toFixed(0)}s: ${e.message}`);
        console.error('────────────────────────────────────────────────────\n');
        return json(res, 500, { error: e.message });
      }
    }

    // Re-colour an existing storyboard (v55_r). NO model call and no backend requirement: the
    // validated panel JSON is stored, so this just re-composes it with a different palette —
    // instant, vs. the multi-minute generation. Storyboards made before v55_r have no stored
    // panels; they must be regenerated once (reported explicitly rather than failing silently).
    if (M === 'POST' && url.pathname === '/api/storyline-storyboard/scheme') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, scheme } = body;
      if (!slId) return json(res, 400, { error: 'Missing slId' });
      if (!Object.prototype.hasOwnProperty.call(STORYBOARD_SCHEMES, scheme)) return json(res, 400, { error: 'Unknown colour scheme' });
      const sl = findStoryline(slId);
      if (!sl) return json(res, 404, { error: 'Storyline not found' });
      if (!Array.isArray(sl.storyboardPanels) || !sl.storyboardPanels.length)
        return json(res, 409, { error: 'This storyboard predates colour schemes — regenerate it to enable re-colouring.' });
      // Pass the CURRENT chapter count: stored panels keep their model-assigned `chapter`
      // fields (v57), so a re-colour re-emits — and re-clamps — the data-chapter links.
      const { svg, stats } = composeStoryboardSVG(sl.storyboardPanels, scheme, (sl.chapters || []).length);
      if (!svg) return json(res, 500, { error: `Re-compose failed (${stats.valid} valid panels)` });
      sl.storyboard = svg; sl.storyboardScheme = scheme; upsertStoryline(sl);
      console.log(`  Storyboard re-coloured (${scheme}) for storyline ${slId}`);
      return json(res, 200, { storyboard: svg, scheme });
    }

    // Delete a stored storyboard. No LLM, so no backend requirement (works when Ollama is
    // down — you can always remove a picture). Idempotent: absent storyboard → still 200.
    if (M === 'DELETE' && url.pathname === '/api/storyline-storyboard') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId } = body;
      if (!slId) return json(res, 400, { error: 'Missing slId' });
      const sl = findStoryline(slId);
      if (sl && (sl.storyboard !== undefined || sl.storyboardMeta !== undefined)) {
        delete sl.storyboard; delete sl.storyboardMeta;
        delete sl.storyboardPanels; delete sl.storyboardScheme;
        upsertStoryline(sl);
        console.log(`  Storyboard deleted for storyline ${slId}`);
      }
      return json(res, 200, { ok: true });
    }

    // ── QC for generated texts (v55_g) ──────────────────────────────────────────
    // Generate a correction PROPOSAL for a topic's story. Never touches topic.story — stores the
    // proposal under topic.storyQcProposal so the client can show a diff and let the user accept.
    // Tutor (v61) — end-of-chapter comprehension chat. Stateless: the client sends the chapter
    // story, the words the learner got wrong / knows, and the conversation so far; the server
    // assembles the prompt and returns ONE reply. History is flattened into the user message (the
    // llm layer is single system+user), keeping the LLM plumbing unchanged. `opening:true` asks the
    // tutor to start the conversation with its first question.
    if (M === 'POST' && url.pathname === '/api/tutor') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend for the tutor.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
      const srcLang = clip(body.srcLang || 'en', 8), lang = clip(body.lang || 'en', 8);
      // v83_b (PLAN §12, user ruling): the tutor's REPLY language is the learner's UI LANGUAGE, not
      // srcLang ("I speak X") — the two are a genuinely separate setting since v81_ac, and the ask
      // was explicit for the WHOLE tutor, not just the new segment-explain flow. srcLang keeps its
      // own, different job below (tutorRetrieveContext's content-pairing filter) — only the REPLY
      // LANGUAGE moves. Falls back to srcLang so a client that hasn't sent uiLang yet (a cached
      // static-build copy, or any future stray caller) behaves exactly as before.
      const uiLang = clip(body.uiLang || body.srcLang || 'en', 8);
      // v62: the tutor is reachable from anywhere, so a chapter story is no longer required — a
      // global question has none. When present (chapter/lesson scope) it is sent inline by the
      // client because it is always the most relevant context.
      const story = clip(body.story, 4000);
      // Untrusted arrays: cap count + length. wrongWords are the focus; knownWords bound explanations.
      const arr = (a, cap, len) => (Array.isArray(a) ? a : []).slice(0, cap).map(x => clip(x, len)).filter(Boolean);
      const wrongWords = arr(body.wrongWords, 40, 60);
      const knownWords = arr(body.knownWords, 200, 60);
      // Conversation so far: [{role:'tutor'|'student', text}]. Cap turns + length to bound the prompt.
      const history = (Array.isArray(body.history) ? body.history : []).slice(-20)
        .map(m => ({ role: m && m.role === 'student' ? 'student' : 'tutor', text: clip(m && m.text, 800) }))
        .filter(m => m.text);
      // v62: scope + completed-chapter whitelist drive retrieval.
      const scopeIn = (body.scope && typeof body.scope === 'object') ? body.scope : {};
      const scope = {
        kind: ['global','storyline','chapter','lesson'].includes(scopeIn.kind) ? scopeIn.kind : 'global',
        topic: clip(scopeIn.topic, 200) || null,
        storylineId: clip(scopeIn.storylineId, 80) || null,
        label: clip(scopeIn.label, 120) || null,
        // v63: the exercise the learner is looking at. `answer` arrives ONLY once the client says
        // the question has been answered — before that the server is never told it, so the tutor
        // cannot leak it however it is asked. Same structural approach as the spoiler whitelist.
        question: clip(scopeIn.question, 400) || null,
        answered: scopeIn.answered === true,
        answer: (scopeIn.answered === true) ? (clip(scopeIn.answer, 120) || null) : null,
      };
      const completed = arr(body.completed, 400, 200);
      // The learner's newest message drives keyword relevance.
      const lastStudent = [...history].reverse().find(m => m.role === 'student');
      const retrieved = tutorRetrieveContext({
        question: lastStudent ? lastStudent.text : '', scope, completed, lang, srcLang });
      const S = langName(uiLang), L = langName(lang);
      const sys = fillPrompt(PROMPTS.tutor.system, {
        S, L,
        story: story.trim() || '(the learner is not currently inside a chapter)',
        scope: scope.label ? `${scope.kind} — ${scope.label}` : scope.kind,
        question: scope.question
          ? (scope.question + (scope.answered
              ? `\n(The learner HAS answered. Correct answer: ${scope.answer || '(unknown)'} — you may explain it fully.)`
              : '\n(The learner has NOT answered yet. You do not know the correct answer. Give a HINT that helps them work it out — never state the answer.)'))
          : '(the learner is not currently on a question)',
        retrieved: retrieved.text || '(nothing retrieved — rely on the conversation and the words below)',
        wrongWords: wrongWords.length ? wrongWords.join(', ') : '(none recorded)',
        knownWords: knownWords.length ? knownWords.join(', ') : '(none recorded)',
      });
      // Build the user turn: the transcript, then either the opening instruction or the student's
      // latest message (already included as the last history entry when role==='student').
      let userMsg;
      if (body.opening || history.length === 0) {
        userMsg = PROMPTS.tutor.opening;
      } else {
        const transcript = history.map(m => (m.role === 'student' ? 'Student: ' : 'Tutor: ') + m.text).join('\n');
        userMsg = `Conversation so far:\n${transcript}\n\nReply as the tutor (one short turn).`;
      }
      const _logReply = (reply) => console.log(`  Tutor [${scope.kind}] reply (${lang}←${uiLang}): ${reply.length} chars${wrongWords.length ? `, focus ${wrongWords.length}w` : ''}${retrieved.used.length ? `, ctx: ${retrieved.used.join(' | ')}` : ''}`);

      // v64: STREAMING (opt-in via body.stream). Server-Sent Events, so the learner sees the reply
      // appear word by word instead of waiting on "thinking…". The whole-reply JSON path below is
      // kept intact as a fallback — a client that doesn't ask for a stream, or one whose stream
      // fails, still works exactly as before.
      if (body.stream === true) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',          // don't let a proxy buffer the stream away
        });
        const send = (obj) => { try { res.write('data: ' + JSON.stringify(obj) + '\n\n'); } catch(_) {} };
        let acc = '', aborted = false;
        req.on('close', () => { aborted = true; });   // learner navigated away / closed the widget
        try {
          const { promptTokens, completionTokens } = await callLLMTutorStream(sys, userMsg, 500, null, (delta) => {
            if (aborted) return;
            acc += delta;
            send({ delta });
          });
          const reply = sanitizeTutorReply(stripRaw(acc));
          if (!aborted) {
            if (!reply) send({ error: 'Tutor returned an empty reply — try again.' });
            else { _logReply(reply); send({ done: true, reply, promptTokens, completionTokens }); }
          }
        } catch(e) {
          if (!aborted) send({ error: `Tutor failed: ${e.message}` });
        }
        return res.end();
      }

      try {
        const { text, promptTokens, completionTokens } = await callLLMTutor(sys, userMsg, 500);
        const reply = sanitizeTutorReply(stripRaw(String(text || '')));
        if (!reply) return json(res, 502, { error: 'Tutor returned an empty reply — try again.' });
        _logReply(reply);
        return json(res, 200, { reply, promptTokens, completionTokens });
      } catch(e) {
        return json(res, 502, { error: `Tutor failed: ${e.message}` });
      }
    }
    // PLAN §D4 (v82) — grade a `writing` lesson's submission. The only play-time API route in the
    // app besides /api/tutor: every other lesson type is generated once and played from static
    // content, but there is no submission to grade until the learner writes it. Stateless like the
    // tutor route — the server stores nothing here; the client decides what (if anything) to keep
    // (see renderWriting() in index.html).
    // v82_f (user): the question is now a genuine reading-comprehension question (source-language
    // only — see PROMPTS.writing), and grading judges CONTENT correctness against the story as well
    // as typos/grammar — the judge needs the question AND the story to do that, unlike phase 1's
    // typo-only check which needed neither.
    if (M === 'POST' && url.pathname === '/api/writing-feedback') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend for writing feedback.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
      const lang = clip(body.lang, 8), srcLang = clip(body.srcLang || 'en', 8);
      const text = clip(body.text, 3000).trim();
      const question = clip(body.question, 500).trim();
      // Capped, not num_ctx-sized (unit-generation-context.test.js's own documented alternative) —
      // the same choice /api/tutor already made for its own story field, and a single chapter's
      // story is well inside this bound (longest measured on the corpus: 4,691 chars).
      const story = clip(body.story, 4000).trim();
      if (!lang) return json(res, 400, { error: 'Missing lang' });
      if (!text) return json(res, 400, { error: 'Nothing to check — write something first.' });
      if (!question) return json(res, 400, { error: 'Missing question' });
      if (!story) return json(res, 400, { error: 'Missing story' });
      const L = langName(lang), S = langName(srcLang);
      const sys = fillPrompt(PROMPTS.writingFeedback.system, { L, S, question, story });
      const userMsg = fillPrompt(PROMPTS.writingFeedback.user, { L, text });
      try {
        // Live-tested against BOTH candidates before picking (phase 1): OLLAMA_QC_MODEL
        // (translategemma:12b, a translation-faithfulness checker) ignored the requested line format
        // entirely and was markedly slower, while OLLAMA_LESSON_MODEL (qwen3.6:35b-a3b, the default)
        // followed it exactly. This is a pedagogical-judgement task, closer in kind to
        // grammar/conjugation generation (which already use callLLMLesson) than to a translation
        // check — the measurement matches the a-priori reasoning, not just that one run.
        const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sys, userMsg, 500);
        const { correctness, correctnessNote, ok, issues } = parseWritingFeedback(stripRaw(String(raw || '')));
        console.log(`  Writing feedback (${lang}←${srcLang}): ${text.length} chars, verdict=${correctness}, ${issues.length} language issue(s)`);
        return json(res, 200, { correctness, correctnessNote, ok, issues, promptTokens, completionTokens });
      } catch(e) {
        return json(res, 502, { error: `Writing feedback failed: ${e.message}` });
      }
    }
    if (M === 'POST' && url.pathname === '/api/story-qc') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topicId } = body;
      const t = topicId ? findSavedById(topicId) : null;
      if (!t) return json(res, 404, { error: 'Topic not found' });
      if (!t.story || !t.story.trim()) return json(res, 400, { error: 'Topic has no story to QC' });
      const _t0 = Date.now();
      try {
        const { result: r, tokens: _mTok } = await meterLLMTokens(() => generateStoryQc(t.story, t.lang || 'it', t.script || null));
        addTokenUsage(t, _mTok, 'story_qc');   // cumulative per-chapter tokens (v59)
        // Persist the proposal (survives a client refresh; overwrites any prior proposal). Store
        // the exact original it was diffed against, so acceptance can't drift if the story changed.
        t.storyQcProposal = { corrected: r.corrected, against: t.story, verdict: r.verdict,
          rejected: r.rejected, changedSentences: r.changedSentences, totalSentences: r.totalSentences,
          changedRatio: r.changedRatio, wordEditRatio: r.wordEditRatio, meta: r.meta,
          at: new Date().toISOString() };
        saveStore(store);
        return json(res, 200, { corrected: r.corrected, original: t.story, verdict: r.verdict,
          rejected: r.rejected,
          changedSentences: r.changedSentences, totalSentences: r.totalSentences,
          changedRatio: r.changedRatio, wordEditRatio: r.wordEditRatio });
      } catch(e) {
        console.error(`  ✗ Story QC FAILED after ${((Date.now() - _t0) / 1000).toFixed(0)}s: ${e.message}`);
        return json(res, 500, { error: e.message });
      }
    }

    // Accept a stored QC proposal: the correction becomes topic.story, aiStory is pinned to the
    // ORIGINAL (so the diff → ai_error_hunt is original↔corrected), the QC model is stamped, and the
    // ai_error_hunt lesson is (re)built from the diff. No LLM here — pure application of the proposal.
    if (M === 'POST' && url.pathname === '/api/story-qc/accept') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topicId } = body;
      const t = topicId ? findSavedById(topicId) : null;
      if (!t) return json(res, 404, { error: 'Topic not found' });
      const prop = t.storyQcProposal;
      if (!prop || !prop.corrected) return json(res, 400, { error: 'No QC proposal to accept' });
      if (prop.rejected) return json(res, 409, { error: 'Proposal was flagged as a rewrite; not acceptable' });
      // Staleness guard: the proposal was diffed against `prop.against`. If the story has changed
      // since (a hand-edit, or a re-QC), applying it would compute against the wrong baseline.
      if (prop.against !== undefined && prop.against !== t.story) {
        delete t.storyQcProposal; saveStore(store);
        return json(res, 409, { error: 'Story changed since this proposal was generated; discarded. Re-run QC.' });
      }
      // Per-sentence selection (v55_m): `selected` is an array of indices into the CHANGED-pair list
      // (the order storyDiffSentences returns). Absent/null → accept ALL (backward compatible).
      // We reconstruct by starting from the model's full corrected text (spacing intact) and
      // REVERTING each UNSELECTED changed pair back to its original sentence — never re-splitting/
      // re-joining the story (which would risk the whitespace-mangling class of bug). If nothing
      // ends up selected, it's a no-op discard.
      const { selected } = body;
      let acceptedStory = prop.corrected;
      let acceptedCount = null;
      if (Array.isArray(selected)) {
        // v55_u: the REVIEW/selection granularity is qcDiffSentences (sentences), which is what the
        // client indexes its checkboxes off. Must NOT be storyDiffSentences (clauses) or `selected`
        // indices would address different fixes than the user ticked.
        const changed = qcDiffSentences(prop.against, prop.corrected);
        const sel = new Set(selected.map(Number));
        acceptedCount = 0;
        changed.forEach((pair, idx) => {
          if (sel.has(idx)) { acceptedCount++; return; }              // keep this fix
          // Revert: swap the corrected sentence back to the original in the running story. Only the
          // first occurrence, to avoid clobbering an identical sentence elsewhere.
          if (pair.corrected && pair.ai != null) {
            const at = acceptedStory.indexOf(pair.corrected);
            if (at >= 0) acceptedStory = acceptedStory.slice(0, at) + pair.ai + acceptedStory.slice(at + pair.corrected.length);
          }
        });
        if (acceptedCount === 0) {
          // Nothing selected → treat as discard (don't touch the story, drop the proposal).
          delete t.storyQcProposal; saveStore(store);
          return json(res, 200, { ok: true, story: t.story, errorHuntBuilt: false, lessons: t.lessons, acceptedCount: 0 });
        }
      }
      // aiStory = the immutable "before". Pin it to the original the proposal was diffed against
      // (only if not already set — a prior human/AI edit may already own it).
      if (!t.aiStory) t.aiStory = prop.against || t.story;
      const originalForDiff = t.aiStory;
      t.story = acceptedStory;
      stampUpdated(t);
      // Stamp the QC model on the topic (parallel to qcBy on lessons).
      t.storyQcBy = (prop.meta && prop.meta.model) || OLLAMA_QC_MODEL;
      t.storyQcAt = new Date().toISOString();
      // Rebuild the ai_error_hunt from original↔corrected using the existing diff.
      let huntBuilt = false;
      if (t.aiStory && t.aiStory !== t.story) {
        const existing = (t.lessons || []).find(l => l.type === 'ai_error_hunt');
        const sentences = storyDiffSentences(t.aiStory, t.story, existing?.sentences);
        if (sentences.length) {
          const lesson = {
            id: existing?.id || ('aeh_' + Date.now()), type: 'ai_error_hunt',
            title: existing?.title || 'AI Error Hunt',
            desc: 'Find AI errors that were corrected by a proofreader.',
            icon: '🔎', aiStory: t.aiStory, sentences,
            _genMeta: buildGenMeta({ type: 'ai_error_hunt', model: t.storyQcBy, valid: sentences.length }),
          };
          if (existing) t.lessons[t.lessons.indexOf(existing)] = lesson;
          else (t.lessons = t.lessons || []).push(lesson);
          huntBuilt = true;
        }
      }
      delete t.storyQcProposal; // consumed
      saveStore(store);
      console.log(`  ✓ Story QC accepted for "${t.topic}"${acceptedCount != null ? ` (${acceptedCount} of ${storyDiffSentences(originalForDiff, prop.corrected).length} fixes)` : ''} — story updated, ai_error_hunt ${huntBuilt ? 'rebuilt' : 'unchanged (no diff)'}`);
      return json(res, 200, { ok: true, story: t.story, errorHuntBuilt: huntBuilt, lessons: t.lessons, acceptedCount });
    }

    // Discard a stored QC proposal without applying it.
    if (M === 'POST' && url.pathname === '/api/story-qc/discard') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { topicId } = body;
      const t = topicId ? findSavedById(topicId) : null;
      if (!t) return json(res, 404, { error: 'Topic not found' });
      if (t.storyQcProposal) { delete t.storyQcProposal; saveStore(store); }
      return json(res, 200, { ok: true });
    }

    // ── Summary QC (v55_n) — the storyline-summary counterpart of story QC ───────
    // Propose a corrected summary. Never touches sl.summary — stores sl.summaryQcProposal.
    if (M === 'POST' && url.pathname === '/api/summary-qc') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, srcLang } = body;
      const sl = slId ? findStoryline(slId) : null;
      if (!sl) return json(res, 404, { error: 'Storyline not found' });
      if (!sl.summary || !sl.summary.trim()) return json(res, 400, { error: 'Storyline has no summary to QC' });
      const _t0 = Date.now();
      try {
        const { result: r, tokens: _mTok } = await meterLLMTokens(() => generateSummaryQc(sl.summary, srcLang || sl.srcLang || 'en'));
        addTokenUsage(sl, _mTok, 'summary_qc');   // storyline-level artefact (v59)
        sl.summaryQcProposal = { corrected: r.corrected, against: sl.summary, verdict: r.verdict,
          rejected: r.rejected, changedSentences: r.changedSentences, totalSentences: r.totalSentences,
          changedRatio: r.changedRatio, wordEditRatio: r.wordEditRatio, meta: r.meta, at: new Date().toISOString() };
        upsertStoryline(sl);
        return json(res, 200, { corrected: r.corrected, original: sl.summary, verdict: r.verdict,
          rejected: r.rejected, changedSentences: r.changedSentences, totalSentences: r.totalSentences,
          changedRatio: r.changedRatio, wordEditRatio: r.wordEditRatio });
      } catch(e) {
        console.error(`  ✗ Summary QC FAILED after ${((Date.now() - _t0) / 1000).toFixed(0)}s: ${e.message}`);
        return json(res, 500, { error: e.message });
      }
    }

    // Accept a summary QC proposal (optionally a per-sentence subset). No error-hunt — a summary
    // isn't drill text; acceptance simply writes sl.summary. Reuses the story-QC reconstruction
    // (revert unselected changed pairs in the corrected text; spacing-safe).
    if (M === 'POST' && url.pathname === '/api/summary-qc/accept') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId, selected } = body;
      const sl = slId ? findStoryline(slId) : null;
      if (!sl) return json(res, 404, { error: 'Storyline not found' });
      const prop = sl.summaryQcProposal;
      if (!prop || !prop.corrected) return json(res, 400, { error: 'No summary QC proposal to accept' });
      if (prop.rejected) return json(res, 409, { error: 'Proposal was flagged as a rewrite; not acceptable' });
      if (prop.against !== undefined && prop.against !== sl.summary) {
        delete sl.summaryQcProposal; upsertStoryline(sl);
        return json(res, 409, { error: 'Summary changed since this proposal was generated; discarded. Re-run QC.' });
      }
      let acceptedText = prop.corrected;
      let acceptedCount = null;
      if (Array.isArray(selected)) {
        // v55_u: the REVIEW/selection granularity is qcDiffSentences (sentences), which is what the
        // client indexes its checkboxes off. Must NOT be storyDiffSentences (clauses) or `selected`
        // indices would address different fixes than the user ticked.
        const changed = qcDiffSentences(prop.against, prop.corrected);
        const sel = new Set(selected.map(Number));
        acceptedCount = 0;
        changed.forEach((pair, idx) => {
          if (sel.has(idx)) { acceptedCount++; return; }
          if (pair.corrected && pair.ai != null) {
            const at = acceptedText.indexOf(pair.corrected);
            if (at >= 0) acceptedText = acceptedText.slice(0, at) + pair.ai + acceptedText.slice(at + pair.corrected.length);
          }
        });
        if (acceptedCount === 0) {
          delete sl.summaryQcProposal; upsertStoryline(sl);
          return json(res, 200, { ok: true, summary: sl.summary, acceptedCount: 0 });
        }
      }
      sl.summary = acceptedText;
      sl.summaryQcBy = (prop.meta && prop.meta.model) || OLLAMA_QC_MODEL;
      sl.summaryQcAt = new Date().toISOString();
      delete sl.summaryQcProposal;
      upsertStoryline(sl);
      console.log(`  ✓ Summary QC accepted for storyline ${slId}${acceptedCount != null ? ` (${acceptedCount} fixes)` : ''}`);
      return json(res, 200, { ok: true, summary: sl.summary, acceptedCount });
    }

    if (M === 'POST' && url.pathname === '/api/summary-qc/discard') {
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const { slId } = body;
      const sl = slId ? findStoryline(slId) : null;
      if (!sl) return json(res, 404, { error: 'Storyline not found' });
      if (sl.summaryQcProposal) { delete sl.summaryQcProposal; upsertStoryline(sl); }
      return json(res, 200, { ok: true });
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
      const mergeFlags = !!(body && body.mergeFlags);
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
          if (mergeFlags) {
            // Drift-safe: apply only the community flags/ratings/_miscFlags onto our items;
            // leave the maintainer's content untouched.
            mergeFlagsIntoTopic(exists, l);
            stampUpdated(exists);
          } else {
            // Update in place preserving generatedAt
            Object.assign(exists, l, { generatedAt: exists.generatedAt, updatedAt: new Date().toISOString() });
          }
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
    if (M === 'GET' && url.pathname === '/api/scripts') {
      return json(res, 200, _scriptsData);
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
