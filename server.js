#!/usr/bin/env node
'use strict';

const http  = require('http');
const { execFile } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { parseDialectGlossary, buildDialectTopic } = require('./dialect-glossary.js');
const { callLLM: _rawCallLLM, callLLMStream: _rawCallLLMStream, ping: pingOllama, release: releaseOllamaModel,
        warmup: _warmupLLM, listModels: listOllamaModels, setRequestTimeout, getRequestTimeout,
        stripRaw, extractJSON, extractArray, salvageArray } = require('./llm');
const { AsyncLocalStorage } = require('async_hooks');
const { buildExport } = require('./export-lessons');
const LEARNERS = require('./learners');

// ── Learner sessions (v65) ───────────────────────────────────────────────────
// Cookie-based, HttpOnly so page scripts can never read the token, SameSite=Lax so it isn't sent
// on cross-site requests. `Secure` is set only when the request arrived over TLS — forcing it on
// plain-HTTP LAN use would silently break login.
const SESSION_COOKIE = 'dz_session';
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
  const secure = !!(req.socket && req.socket.encrypted) || String(req.headers['x-forwarded-proto'] || '').includes('https');
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
const APP_VERSION  = 'v69_c';
// v58 provenance: schema 30 = 29 + OPTIONAL topic.source {author,licence,url,note} and
// topic.createdBy. Readers keep accepting >= 29 (both fields optional); only the WRITE stamp
// moves, so a v29 file loads untouched and is re-tagged 30 on its next save.
const SCHEMA_VERSION = 30;
// The generating user. Login is coming (roadmap); until then every write is 'admin', and the
// backfill script (backfill-createdby.js) stamps the same onto the existing corpus so the data
// is EXPLICIT rather than a read-time default.
const DEFAULT_USER = 'admin';
const STORAGE_FILE = process.env.LESSONS_FILE || path.join(__dirname, 'lessons.json');
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
const OLLAMA_THINK = { story: false, lessons: false, tutor: false };
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
           lessonFormat: OLLAMA_LESSON_FORMAT,
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
function saveStore(s) {
  try {
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
  return { coverageThreshold: (typeof s.coverageThreshold === 'number') ? s.coverageThreshold : 1 };
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
function langName(code) { return LANG_NAMES[code] || code || 'Italian'; }

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
function needsIntroScript(targetLang, srcLang) {
  const tgt = scriptsForLang(targetLang);
  if (!tgt.length) return false;            // target unmapped → no intro
  const srcArr = scriptsForLang(srcLang || 'en');
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
  const vocab     = vocabRows.slice(0, 8).map(toPair).filter(v => v.target && v.source);
  const sentences = sentRows.slice(0, 5).map(toPair).filter(s => s.target && s.source);

  if (vocab.length < 1) throw new Error(`Table parse: only ${vocab.length} vocab rows`);

  return { title: `Lesson ${lessonNum}`, desc: topic, icon: '📖', vocab, sentences };
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
  let text;
  try { ({ text } = await callLLMTranslation(system, user, opts.long ? 1000 : 640)); } catch (_) { return null; }
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
    try { ({ text: text2 } = await callLLMTranslation(sys2(escalate), usr2, opts.long ? 1200 : 760)); } catch (_) { return null; }
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
async function generateStoryQc(story, lang) {
  if (!story || !story.trim()) throw new Error('QC: empty story');
  const L = langName(lang);
  const _t0 = Date.now();
  console.log(`\n── Story QC ─────────────────────────────────────────`);
  console.log(`  Lang: ${L}, Model: ${OLLAMA_QC_MODEL}, ${story.length} chars`);
  const sys = fillPrompt(PROMPTS.storyQc.system, { L });
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
  console.log(`  ⚙ QC starting: ${topics.length} topic(s)${lessonIdx !== null ? `, lesson ${lessonIdx}` : ''}${onlyFlagged ? ', flagged-only' : ''} [${OLLAMA_QC_MODEL}]`);
  jobStep(jobId, `[${OLLAMA_QC_MODEL}] Starting QC…`);
  for (let ti = 0; ti < topics.length; ti++) {
    const tp = topics[ti];
    const lessons = tp.lessons || [];
    let touched = false;
    // v59: meter EVERY per-item QC call for this topic in one scope (the checkers discard
    // token counts internally; the _callLLM meter catches them all) and fold the total into
    // the chapter's cumulative stats. Nonzero tokens mark the topic touched so the
    // accumulation is PERSISTED even when every item came back clean.
    const { tokens: _lqTok } = await meterLLMTokens(async () => {
      for (let li = 0; li < lessons.length; li++) {
        if (lessonIdx !== null && li !== lessonIdx) continue;
        const ls = lessons[li];
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
        const _check = async (item, runner, label) => {
          checked++;
          let res;
          try { res = await runner(); } catch (e) { return; }
          const model = OLLAMA_QC_MODEL;
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
            jobStep(jobId, `[${model}] QC ${tp.topic} — ${checked} checked, ${flagged} flagged…`);
        };
        // Dispatch by lesson type. vocab/sentences exist on standard lessons; word_forms uses
        // `items` (cloze); synonyms uses `words` (related-word sets); grammar uses `grammar`
        // (noun target/source + article/plural); conjugation uses `conjugations` (infinitive +
        // source translation). intro_script is curated data (human QC only); math and the two
        // error-hunt types are intentionally out of scope. Anything else falls through to the
        // generic vocab/sentences scan.
        let _lessonQcRan = true;
        if (ls.type === 'word_forms') {
          for (const item of (ls.items || [])) {
            if (!item || !item.sentence) continue;
            await _check(item, () => qcCheckCloze(item, tp.lang, tp.srcLang, item.userFlag?.comment), 'cloze');
          }
        } else if (ls.type === 'synonyms') {
          for (const entry of (ls.words || [])) {
            if (!entry || !entry.base) continue;
            await _check(entry, () => qcCheckSynonymSet(entry, tp.lang, tp.srcLang, entry.userFlag?.comment), 'synset');
          }
        } else if (ls.type === 'grammar') {
          // Grammar lessons teach a noun with its article/plural; the target↔source translation
          // is the checkable pair (article/plural correctness is a separate, morphology-specific
          // check left for a future dedicated prompt).
          for (const g of (ls.grammar || [])) {
            if (!g || !g.target || !g.source) continue;
            await _check(g, () => qcCheckPair(g.target, g.source, tp.lang, tp.srcLang, g.userFlag?.comment), 'grammar');
          }
        } else if (ls.type === 'conjugation') {
          // Conjugation lessons carry an infinitive (target verb) + its source translation; QC the
          // translation pair. The per-form morphology is grammatical, not a translation, so it's
          // out of scope here (a dedicated conjugation-correctness prompt is future work).
          for (const c of (ls.conjugations || [])) {
            if (!c || !c.infinitive || !c.source) continue;
            await _check(c, () => qcCheckPair(c.infinitive, c.source, tp.lang, tp.srcLang, c.userFlag?.comment), 'conjug');
          }
        } else if (ls.type === 'intro_script') {
          // curated letter table — verified by humans (per-letter flag/star/edit), not the LLM.
          _lessonQcRan = false;
        } else if (ls.type === 'math' || ls.type === 'error_hunt' || ls.type === 'ai_error_hunt' || ls.type === 'mixed') {
          // Out of scope: math is procedural, error-hunt correctness is intrinsic to its own
          // story, and mixed lessons own no items (they pool from their source lessons, which are
          // QC'd in place). Don't stamp — nothing was examined.
          _lessonQcRan = false;
        } else {
          for (const key of ['vocab', 'sentences']) {
            const arr = ls[key];
            if (!Array.isArray(arr)) continue;
            const lessonIsDialect = !!ls._dialect;
            for (const item of arr) {
              if (!item || !item.target || !item.source) continue;
              // Dialect items get sourceOnly QC (verify gloss, never rewrite the dialect token) —
              // EXCEPT aiGenerated example sentences: the model authored those, so the dialect side is
              // NOT ground truth and must be checked too (full pair QC).
              if ((lessonIsDialect || item._dialect) && !item.aiGenerated) {
                await _check(item, () => qcCheckDialectPair(item.target, item.source, tp.lang, tp.srcLang, item.userFlag?.comment), 'pair');
              } else {
                await _check(item, () => qcCheckPair(item.target, item.source, tp.lang, tp.srcLang, item.userFlag?.comment), 'pair');
              }
            }
          }
        }
        // Stamp a full (not flagged-only) pass that left the lesson clean, so future bulk runs
        // skip it. Only when this pass actually ran a checker for the lesson (intro_script is
        // human-QC'd, never stamped) and produced no new flags for it. A flagged-only pass must
        // NOT stamp — it didn't examine the whole lesson.
        if (!onlyFlagged && _lessonQcRan && flagged === _flaggedBefore && !_lessonHasOpenQcFlag(ls)) {
          ls.qcAt = new Date().toISOString(); ls.qcBy = OLLAMA_QC_MODEL; touched = true;
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
    if (_lqTok.promptTokens + _lqTok.completionTokens > 0) { addTokenUsage(tp, _lqTok, 'lesson_qc'); touched = true; }

    if (includeStory && !onlyFlagged && lessonIdx === null && tp.story && tp.story.trim()) {
      const alreadyChecked = tp.storyQcCheckedBy === OLLAMA_QC_MODEL && tp.storyQcCheckedAt && !force;
      if (alreadyChecked) {
        console.log(`    ⏭ skip story "${tp.topic}" (QC'd ${tp.storyQcCheckedAt}, unedited)`);
      } else {
        jobStep(jobId, `[${OLLAMA_QC_MODEL}] Proofreading story: ${tp.topic}…`);
        try {
          const { result: qr, tokens: _sqTok } = await meterLLMTokens(() => generateStoryQc(tp.story, tp.lang || 'it'));
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

    if (touched) { upsert(tp); affected.push(tp.id); }
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
// similarity field in languages.json. The comparison is case-insensitive + trimmed, and blocks at
// >2 identical vocab items (or >1 sentence) in a single lesson. That COUNT threshold conflates two
// different things, measured against the real corpus:
//   • a genuine model failure — the model wrote the source language into both fields (100% of items
//     identical: an lb→en "History of Luxembourg" lesson, an it→en "Grandmas Doughs" lesson);
//   • legitimate loanwords / proper nouns, which occur in EVERY pair regardless of closeness
//     (38%: "pasta, tagliatelle, risotto"; "café, fans, notes"; "Champagne, Terroir").
// A RATIO threshold (identical/total) would separate them; see roadmap_v54 "identical-source/target
// heuristic". Until then, closeness is the only lever, so keep this list conservative: relaxing a
// pair also disables the check that catches real model failures for it.
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

// Shared by the /api/storyline-storyboard route and the book-job storyboard post-pass (v68.1) so
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
  let sys = fillPrompt(P.system, { L, S, diff, EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
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
  let sys = fillPrompt(P.system, { L, S, diff, EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
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

async function generateMathLLM(lang, srcLang, difficulty, instruction, jobId) {
  const _t0 = Date.now();
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

async function generateErrorHunt(story, lang, difficulty, jobId, priorVocab) {
  const _t0 = Date.now();
  jobStep(jobId, `[${OLLAMA_MODEL}] Generating error-hunt lesson…`);
  const sys = sysErrorHunt(lang, difficulty);
  const priorHint = priorVocab && priorVocab.length
    ? `\n\nPREFER errors on these words where they appear: ${priorVocab.slice(0,20).map(v=>v.target).join(', ')}`
    : '';
  const userMsg = `Here is the ${langName(lang)} story:\n\n${story}\n\nReturn the corrupted story now.${priorHint}`;
  // v68.1: same treatment as the other reasoning-model failures (v55_c/v60.5/v65.1) — corrupting
  // the story is a verbatim rewrite, not a reasoning task. With `think` unspecified a reasoning
  // model burned the token budget inside <think>, and the story-length rewrite then overran the
  // request timeout — the reported "add error-hunt lesson times out". The timeout gets the same
  // multiplier reasoning would (the OUTPUT is story-length either way, the longest of any lesson).
  const { text: corrupted, promptTokens, completionTokens } = await _callLLM(
    OLLAMA_MODEL, sys, userMsg, story.length * 2,
    { think: false, timeoutMs: Math.ceil(getRequestTimeout() * THINK_TIMEOUT_MULT) });
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
  const sys = sysGrammar(lang, srcLang, difficulty, userDialect, storyStyle);
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
        _genMeta: buildGenMeta({ type: 'grammar', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: valid.length, rejected: rejected.length, rejectReasons: genReasonHist(rejected), promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens }),
      },
      tokens: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
    };
  }
  throw new Error(`Grammar generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

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
      if (!/_{3,}/.test(sentence)) {
        const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + escapeRe(correct) + ')(?=[^\\p{L}\\p{N}]|$)', 'iu');
        if (re.test(sentence)) sentence = sentence.replace(re, (m, pre) => pre + '___');
        else reasons.push('no ___ blank and answer not in sentence');
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
  const L = langName(lang); const S = langName(srcLang || 'en');
  const n = (difficulty <= 1) ? 5 : (difficulty >= 3 ? 8 : 6);
  const sys = fillPrompt(PROMPTS.wordForms.system, { L, S, EXAMPLE: fillPrompt(promptExample(PROMPTS.wordForms, lang, srcLang), { L, S }) });
  const userMsg = fillPrompt(PROMPTS.wordForms.user, { L, S, story, n });
  const MAX_ATTEMPTS = 3;
  let totalPromptTokens = 0, totalCompletionTokens = 0, lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    jobStep(jobId, `[${OLLAMA_LESSON_MODEL}] Word-forms lesson attempt ${attempt}/${MAX_ATTEMPTS}…`);
    console.log(`    Word-forms attempt ${attempt}…`);
    const { text: raw, promptTokens, completionTokens } = await callLLMLesson(sys, userMsg, 1600);
    totalPromptTokens += promptTokens; totalCompletionTokens += completionTokens;
    const cleaned = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch(e) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) { lastError = 'Could not parse JSON: ' + cleaned.slice(0, 60); continue; }
      try { parsed = JSON.parse(m[0]); } catch(e2) { lastError = 'JSON extract failed'; continue; }
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

// ── Generate synonyms / antonyms / homophones lesson ──────────────────────────
// Picks key words from the story and asks the LLM for better in-context synonyms,
// antonyms, and homophones (all in the target language, glossed in the source
// language). The related words are flattened into a standard vocab lesson, so the
// existing flashcard/MCQ player, checker, and editor handle it with no new type.
// ── synonyms context sentence ────────────────────────────────────────────────
// Split text into candidate sentences and find the first that contains `base`
// (whole-word, normalized). Used to present a synonym/antonym target in context.
function _synSplitSentences(text) {
  return String(text == null ? '' : text)
    .split(/(?<=[.!?。！？\u2026])\s+|\n+/)
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

async function generateSynonyms(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
  opts = opts || {};
  const { story, userDialect, chainVocab, vocabMode: synVocabMode } = opts;
  const L = langName(lang), S = langName(srcLang || 'en');
  const storyKeywords = story ? extractKeywords(story, 8, lang) : '';
  const _priorWords = (chainVocab?.words || []).slice(0, 12).map(v => v.target).filter(Boolean);
  const priorWords = _priorWords.join(', ');
  const P = PROMPTS && PROMPTS.synonyms;
  let sys, userMsg;
  if (P && P.system) {
    sys = fillPrompt(P.system, { L, S, diff: difficultyLabel(difficulty || 2), EXAMPLE: fillPrompt(promptExample(P, lang, srcLang), { L, S }) });
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
    // Context-sentence pool: current story always; for non-extend modes also pull
    // sentences from the chain (storyline / previous lessons) so reinforced words
    // are shown in a familiar sentence.
    const storySents = _synSplitSentences(story || '');
    const chainSents = (synVocabMode !== 'extend' && Array.isArray(chainVocab?.sentences)) ? chainVocab.sentences : [];
    const sentPools = synVocabMode === 'extend' ? [storySents] : [storySents, chainSents];
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
      const sentence = findContextSentence(base, sentPools);
      words.push({ base, gloss: (entry.gloss ?? '').toString().trim(), sentence, synonyms, antonyms, homophones });
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
        _genMeta: buildGenMeta({ type: 'synonyms', model: OLLAMA_LESSON_MODEL, t0: _t0, attempts: attempt, valid: words.length, promptTokens: tp, completionTokens: tc }),
      },
      tokens: { promptTokens: tp, completionTokens: tc },
    };
  }
  throw new Error(`Synonyms generation failed after ${MAX_ATTEMPTS} attempts: ${lastError}`);
}

// ── Generate conjugation lesson ───────────────────────────────────────────────
async function generateConjugation(topic, lang, srcLang, difficulty, jobId, opts) {
  const _t0 = Date.now();
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
      _genMeta: buildGenMeta({ type: 'conjugation', model: OLLAMA_LESSON_MODEL, t0: _t0, valid: (parsed.conjugations || []).length, promptTokens, completionTokens }),
    },
    tokens: { promptTokens, completionTokens },
  };
}

async function generateOneLesson(lang, srcLang, topic, lessonNum, totalLessons, prevVocab, story, difficulty, jobId, opts) {
  const _t0 = Date.now();
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
          ? `Previous story (excerpt):\n${prevStory}\n\nNew topic: "${userTopic}". Write the continuation now. Plain prose, no headings.`
          : `Write a story for the topic: "${userTopic}". Plain prose, no headings.`;
      const storySystem = sysStory(lang, !!prevStory, storyLen, userDialect, storyStyle);
      // v60.7: reasoning is per-role and OFF by default. think:false keeps a story as plain prose
      // (and, on a reasoning model, avoids spending the whole num_predict inside <think> → empty
      // response — the v60.5 fix). When the user opts the STORY role into reasoning, thinkOpts
      // flips think:true AND bumps the token budget + timeout so the answer survives the think
      // block. (Mirrors the v55_c think:false applied to QC/storyboard.)
      const _baseStoryTokens = Math.min(4096, Math.ceil((storyLen||300) * 1.5) + 400);
      const _sOpts = thinkOpts('story', _baseStoryTokens);
      const { text, promptTokens, completionTokens } = await callLLM(
        storySystem, storyUserMsg, _sOpts.tokens, _sOpts);
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
  if (story) {
    upsert({
      topic: meta.topic || topic, topicEmoji: meta.topicEmoji || '📚',
      userTopic, userPrompt, lang, srcLang, difficulty: difficulty || 2, storyLen,
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
  const chainOpts = { userDialect, storyStyle, chainVocab, vocabMode: _vocabMode, story };

  if (lessonFormat === 'error_hunt' || lessonFormat === 'grammar' || lessonFormat === 'conjugation' || lessonFormat === 'math' || lessonFormat === 'synonyms' || lessonFormat === 'word_forms') {
    const genFn   = lessonFormat === 'math'
      ? (mathInstruction
          ? () => generateMathLLM(lang, srcLang, difficulty, mathInstruction, jobId)
          : () => Promise.resolve(generateMath(story, difficulty)))
                  : lessonFormat === 'error_hunt'  ? () => generateErrorHunt(story, lang, difficulty, jobId, chainVocab.words)
                  : lessonFormat === 'grammar'      ? () => generateGrammar(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'synonyms'     ? () => generateSynonyms(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  : lessonFormat === 'word_forms'   ? () => generateWordForms(topic, lang, srcLang, difficulty, jobId, chainOpts)
                  :                                   () => generateConjugation(topic, lang, srcLang, difficulty, jobId, chainOpts);
    const label   = lessonFormat === 'math'        ? 'Math'
                  : lessonFormat === 'error_hunt'  ? 'Error-hunt'
                  : lessonFormat === 'grammar'      ? 'Grammar'
                  : lessonFormat === 'synonyms'     ? 'Synonyms'
                  : lessonFormat === 'word_forms'   ? 'Word-forms'
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
      // Generate word_forms, synonyms, and error_hunt as additional lessons
      // (word_forms + synonyms supersede the old grammar/conjugation extras).
      const extraFmts = [
        { fmt: 'word_forms',  label: 'Word Forms',  fn: () => generateWordForms(topic, lang, srcLang, difficulty, jobId, chainOpts) },
        { fmt: 'synonyms',    label: 'Synonyms',    fn: () => generateSynonyms(topic, lang, srcLang, difficulty, jobId, chainOpts) },
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
    ...(_storyMeta ? { storyMeta: _storyMeta } : {}),
    ...(_translationMeta ? { translationMeta: _translationMeta } : {}),
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
  error_hunt:  (c) => generateErrorHunt(c.story, c.lang, c.diff, c.jobId, c.chainVocab.words),
  grammar:     (c) => generateGrammar(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  conjugation: (c) => generateConjugation(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  synonyms:    (c) => generateSynonyms(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  word_forms:  (c) => generateWordForms(c.topicName, c.lang, c.srcLang, c.diff, c.jobId, c.sharedGenOpts),
  math:        (c) => c.addMathInstr
    ? generateMathLLM(c.lang, c.srcLang, c.diff, c.addMathInstr, c.jobId)
    : generateMath(c.story, c.diff, c.addMathOps || null),
  // Topic-independent + LLM-free: ignores the story, builds from the script table.
  intro_script: (c) => generateIntroScript(c.lang, { script: c.introScript || null, difficulty: c.diff, srcLang: c.srcLang }),
};

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
  // 1) Per-chapter coherent titles + emojis. (v59: metered → storyline 'retitle' bucket,
  // same attribution as the manual retitle route — one call covers the whole chain.)
  try {
    const { result: chapterMeta, tokens: _mTok } = await meterLLMTokens(() => generateChapterMeta(stories, base.srcLang, base.lang));
    _applyChapterTitles(topics, chapterMeta, bj);
    const _slT = getStorylines().find(s => s.id === _chainId(chapterIds))
              || getStorylines().find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (_slT) { addTokenUsage(_slT, _mTok, 'retitle'); upsertStoryline(_slT); }
  } catch (e) { console.warn(`  Chapter-title post-pass failed: ${e.message}`); }
  // 2) Whole-storyline title + icon (reuse existing helper).
  try {
    const names = topics.map(t => t.topic);
    const { result: { title, icon }, tokens: _mTok } = await meterLLMTokens(() => generateStorylineTitle(names, stories, base.srcLang));
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (sl) { addTokenUsage(sl, _mTok, 'retitle'); sl.title = title; sl.icon = icon || sl.icon || '📖'; upsertStoryline(sl); }
  } catch (e) { console.warn(`  Storyline title post-pass failed: ${e.message}`); }
  // 3) Whole-storyline summary in the source language — same as the storyline-page
  // header-row summary (generateStorylineSummary + store on the storyline). Best-effort.
  try {
    const names = topics.map(t => t.topic);
    const vocab = topics.flatMap(t =>
      (t.lessons || []).flatMap(ls => (ls.vocab || []).map(v => v.source || v.target)));
    const { result: { text: summary, meta: summaryMeta }, tokens: _mTok } =
      await meterLLMTokens(() => generateStorylineSummary(names, stories, vocab, base.srcLang));
    const slId = _chainId(chapterIds);
    const all = getStorylines();
    const sl = all.find(s => s.id === slId)
            || all.find(s => chapterIds.every(id => s.chapters.includes(id)));
    if (sl && summary) { addTokenUsage(sl, _mTok, 'summary'); sl.summary = summary; sl.summaryMeta = summaryMeta; upsertStoryline(sl); }
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
function buildArcIntroLessons(lang, srcLang, chapterText, priorRef, difficulty) {
  if (!needsIntroScript(lang, srcLang)) return [];
  const srcArr = scriptsForLang(srcLang || 'en');
  const srcScripts = new Set(srcArr);
  const out = [];
  for (const scr of scriptsForLang(lang)) {
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
              const rFn = rType === 'word_forms'  ? generateWordForms
                        : rType === 'synonyms'    ? generateSynonyms
                        : rType === 'conjugation' ? generateConjugation   // legacy
                        :                           generateGrammar;       // legacy
              const { lesson } = await rFn(data.topic || placeholderTopic, base.lang, base.srcLang, base.diff, jobId, rOpts);
              if (lesson) lesson._arcMode = 'reinforce';
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

      // Arc script-teaching: when enabled and the target uses a script the source doesn't,
      // PREPEND an intro "learn the script" lesson covering the letters NEW to this chapter
      // (extend). Generated after the vocab/reinforcement lessons (so we know this chapter's
      // text) but ordered FIRST so the learner meets the new letters before the words that use
      // them. priorRef = the parent chapter, so chapter 1 seeds the alphabet introduced so far.
      if (base.arc && base.arcScript && Array.isArray(data.lessons)) {
        try {
          const chapterText = userStory || data.story || '';
          const introLessons = buildArcIntroLessons(base.lang, base.srcLang, chapterText, parent ? (parent.id || prevRef) : null, base.diff);
          if (introLessons.length) {
            data.lessons.unshift(...introLessons);
            jobStep(jobId, `🔡 Prepended script primer (${introLessons.map(l => l.script).join(', ')})`);
          }
        } catch (e) {
          console.warn(`  [book ${bookId}] chapter ${i+1} script primer failed, skipping: ${e.message}`);
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
        // Lesson QC only here — story QC is deliberately NOT auto-run during book generation (it
        // adds an LLM pass per chapter to an already-long job, unprompted). The user opts into
        // story QC via the storyline 🔍 sweep, which defaults includeStory:true.
        await _runQc(newJob(), qcTopics, { lessonIdx: null, onlyFlagged: false, includeStory: false });
      }
    } catch (e) { console.warn(`  [book ${bookId}] QC post-pass error: ${e.message}`); }
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
  const arcMode = (opts && opts.arcMode === 'grammar') ? 'grammar' : 'vocab';
  const arcTypes = ['word_forms', 'synonyms'];   // superseding reinforcement types
  let prevRef = null, recreated = 0, hidden = 0;
  for (let i = 0; i < chapterIds.length; i++) {
    const topic = findSavedById(chapterIds[i]);
    if (!topic) { prevRef = chapterIds[i]; continue; }
    const lang = topic.lang, srcLang = topic.srcLang || 'en', diff = topic.difficulty || 2;
    const story = topic.story || '';
    jobStep(jobId, `Re-creating chapter ${i + 1}/${chapterIds.length}: "${topic.topic}"…`);
    // Keep but hide existing lessons.
    for (const l of (topic.lessons || [])) { if (!l._hidden) { l._hidden = true; hidden++; } }
    const newLessons = [];
    const stamp = (lesson, suffix) => { lesson.id = 'ls_' + Date.now() + '_' + i + '_' + suffix; lesson._recreated = true; };
    // Gate: this chapter's own standard vocab lesson.
    // v59: meter this chapter's whole re-creation (gate + reinforcement, all formats)
    // and fold it into the chapter's cumulative totals — the roadmap's exact example
    // ("re-generating ADDS to that chapter's existing totals rather than being invisible").
    const { tokens: _rcTok } = await meterLLMTokens(async () => {
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
    topic.updatedAt = new Date().toISOString();
    saveStore(store);   // persist per-chapter so progress survives a mid-run failure
    prevRef = topic.id;
  }
  console.log(`  [recreate] done: ${recreated} new lesson(s) across ${chapterIds.length} chapter(s), ${hidden} hidden`);
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
      let b; try { b = JSON.parse(await readBody(req)); } catch(e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const r = LEARNERS.createUser(b.username, b.password);
      if (r.error) return json(res, 400, { error: r.error });
      const token = LEARNERS.createSession(r.username);
      setSessionCookie(req, res, token, 60 * 60 * 24 * 30);
      console.log(`  Learner registered: ${r.username}`);
      return json(res, 200, { ok: true, username: r.username });
    }
    if (M === 'POST' && url.pathname === '/api/auth/login') {
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
      const list = LEARNERS.listUsers().map(u => LEARNERS.summarize(u.username)).filter(Boolean);
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
        canGenerate: active !== 'none' });
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
      const hasThink = body.think && typeof body.think === 'object' &&
        (typeof body.think.story === 'boolean' || typeof body.think.lessons === 'boolean'
         || typeof body.think.tutor === 'boolean');
      if (!requested.length && !hasTimeout && !hasThink)
        return json(res, 400, { error: 'Nothing to set. Provide story, translation, lessons, qc, tutor, model, timeoutMs, or think.' });
      if (requested.length) {
        const available = await listOllamaModels();
        if (available.length) {
          const unknown = [...new Set(requested)].filter(m => !available.includes(m));
          if (unknown.length)
            return json(res, 400, { error: `Model(s) not installed in Ollama: ${unknown.join(', ')}`, available });
        }
      }
      if (hasTimeout) setRequestTimeout(body.timeoutMs);
      // A think-only toggle still needs setRuntimeModels (it reads body.think); a model change does
      // too. Only a timeout-only POST skips it.
      const activeModels = (requested.length || hasThink) ? setRuntimeModels(body) : currentModels();
      console.log(`  Models switched → story:${activeModels.story}${activeModels.think.story?'🧠':''} lessons:${activeModels.lessons}${activeModels.think.lessons?'🧠':''}${activeModels.translation!==activeModels.story?` transl:${activeModels.translation}`:''}${activeModels.tutor!==activeModels.story||activeModels.think.tutor?` tutor:${activeModels.tutor}${activeModels.think.tutor?'🧠':''}`:''}${activeModels.lessonFormat==='table'?' [table format]':''} timeout:${Math.round(activeModels.timeoutMs/1000)}s`);
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
        lessonCount: l.lessons?.length || 0,
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
      saved.updatedAt = new Date().toISOString();
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
              userStory, userTranslation, userDialect, storyStyle, reinforcePrior, vocabMode, useFullChain, userStoryLang, mathInstruction, fromLearned } = body;
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
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms','word_forms'].includes(lessonFormat) ? lessonFormat : 'standard';   // v68.1: word_forms was missing — the picker offered it but the route clamped it to 'standard'
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
              generated, topic, nChapters, chapterLen, storyStyle, sourceFile } = body;
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
      const fmt  = ['error_hunt','grammar','conjugation','all_types','math','synonyms','word_forms'].includes(lessonFormat) ? lessonFormat : 'standard';   // v68.1: word_forms was missing — the picker offered it but the route clamped it to 'standard'
      // Arc mode: each chapter = a vocab "gate" lesson + one or more reinforcement
      // lessons (grammar/conjugation/synonyms) generated in reinforce mode.
      const _arcTypes = (Array.isArray(arcReinforce) ? arcReinforce : ['word_forms','synonyms'])
        .filter(t => ['word_forms','synonyms','grammar','conjugation'].includes(t));
      const arcEnabled = !!arc;
      // Normalize the chain root (id or name) to a name for downstream context.
      const rootParent = continuedFrom ? (findSavedById(continuedFrom) || findSaved(continuedFrom)) : null;
      const base = { lang: lang || 'it', srcLang: srcLang || 'en', diff, fmt,
        continuedFrom: rootParent ? rootParent.id : null, userStoryLang: userStoryLang || null,
        arc: arcEnabled, arcTypes: _arcTypes.length ? _arcTypes : ['word_forms','synonyms'],
        arcMode: arcMode === 'grammar' ? 'grammar' : 'vocab',
        // Arc script-teaching opt-in. Default ON when the target uses a script the source
        // doesn't (so a learner of a new alphabet gets per-chapter primers automatically);
        // the client can pass arcScript:false to suppress it.
        arcScript: arcEnabled && (arcScript === undefined ? needsIntroScript(lang || 'it', srcLang || 'en') : !!arcScript),
        generated: !!generated, baseTopic, chapterLen: chapterLenN,
        sourceFile: (typeof sourceFile === 'string' && sourceFile.trim()) ? sourceFile.trim().slice(0,200) : null,
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
          fresh.updatedAt = new Date().toISOString();
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
      topic.updatedAt = new Date().toISOString();
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
      saved.updatedAt = new Date().toISOString();
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
          // intro_script letters: same flaggable merge so a flag/rating/edit on a letter persists.
          letters:   edited.letters   ? edited.letters.map((L,j) => mergeFlaggable((orig.letters||[])[j]||{}, L)) : orig.letters,
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
        // Invalidate the "QC'd & clean" stamp iff the lesson's CONTENT changed (a pure
        // flag/rating/qc clear must not force a re-QC). qcSignature ignores flag fields.
        if (merged.qcAt && qcSignature(orig) !== qcSignature(merged)) {
          _clearLessonQcStamp(merged);
          console.log(`    ↺ QC stamp cleared (edited) on "${merged.title || merged.type}"`);
        }
        return merged;
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
      const { id, topic, lessonFormat: fmt, difficulty: rawDiff, reinforcePrior: addReinforce, vocabMode: addVocabMode, mathInstruction: addMathInstr, mathOps: addMathOps, introScript: addIntroScript } = body;
      if (!id && !topic) return json(res, 400, { error: 'Missing id or topic' });
      if (!fmt)    return json(res, 400, { error: 'Missing lessonFormat' });
      const saved = id ? findSavedById(id) : findSaved((topic||'').trim());
      if (!saved)  return json(res, 404, { error: `Topic not found: ${id || topic}` });
      // Dialect topics: refuse LLM-authoring formats. Those generators run in the base language and
      // don't know the dialect — they'd inject standard-German / mis-judged content into a dialect
      // topic. Only the dialect-safe formats are allowed (standard vocab, math, mixed review).
      const _DIALECT_BLOCKED_FMTS = new Set(['synonyms','word_forms','error_hunt','grammar','conjugation','all_types']);
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
        const standardOpts = { userTranslation: saved.storyTranslation || null, userDialect: dialect, writingStyle: style, storyLang: saved.storyLang || 'target', story: saved.story || null, chainVocab: chainVocab.words, vocabMode: _addVocabMode };
        const sharedGenOpts = { userDialect: dialect, storyStyle: style, chainVocab, vocabMode: _addVocabMode, story };
        const genCtx = { lang, srcLang, topicName, story, diff, jobId, chainVocab, standardOpts, sharedGenOpts, addMathInstr, addMathOps, introScript: addIntroScript || null };
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

    // ── Re-create all lessons for a storyline (keep + hide old, add arc lessons) ──
    if (M === 'POST' && url.pathname === '/api/storyline/recreate-lessons') {
      if (active === 'none') return json(res, 503, { error: 'No LLM backend available.' });
      let body;
      try { body = JSON.parse(await readBody(req)); }
      catch (e) { return json(res, 400, { error: 'Invalid JSON' }); }
      const startId = body.id || body.chapterId || body.startId;
      if (!startId) return json(res, 400, { error: 'missing chapter id' });
      const jobId = newJob();
      console.log(`  Re-create storyline lessons: start=${startId}, arcMode=${body.arcMode || 'vocab'}`);
      _runRecreateJob(jobId, startId, { arcMode: body.arcMode })
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
          sl.title = title; sl.icon = icon || sl.icon || '📖';
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
      const S = langName(srcLang), L = langName(lang);
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
      const _logReply = (reply) => console.log(`  Tutor [${scope.kind}] reply (${lang}←${srcLang}): ${reply.length} chars${wrongWords.length ? `, focus ${wrongWords.length}w` : ''}${retrieved.used.length ? `, ctx: ${retrieved.used.join(' | ')}` : ''}`);

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
        const { result: r, tokens: _mTok } = await meterLLMTokens(() => generateStoryQc(t.story, t.lang || 'it'));
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
      t.updatedAt = new Date().toISOString();
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
            exists.updatedAt = new Date().toISOString();
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
