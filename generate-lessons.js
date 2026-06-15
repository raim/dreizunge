#!/usr/bin/env node
'use strict';
// generate-lessons.js  (v42)
// Batch-generates lessons for multiple language pairs via the Dreizunge server API.
// The server (server.js) must be running.
//
// Compatible with the v41/v42 framework: topics carry stable tp_ ids, storylines
// are id-keyed, and the import file is rebuilt from the server's authoritative
// state at the end of the run. Lesson formats include the v42 additions
// 'synonyms' and 'math'.
//
// Usage:
//   node generate-lessons.js --topic "greetings and introductions"
//   node generate-lessons.js --topic "food and cooking" --langs de,fr,ja
//   node generate-lessons.js --topic "food" --src-langs en,de
//   node generate-lessons.js --topic "food" --langs de,fr --src-langs en
//   node generate-lessons.js --topic "food" --difficulty 1 --story-len 150
//   node generate-lessons.js --topic "food" --format all_types
//   node generate-lessons.js --topic "food" --format synonyms   # synonyms/antonyms/homophones
//   node generate-lessons.js --topic "food" --format math
//   node generate-lessons.js --topic "food" --concurrency 2 --output results.jsonl
//   node generate-lessons.js --topic "food" --resume results.jsonl
//   node generate-lessons.js --topic "food" --dry-run
//   node generate-lessons.js --topic "food" --force   # re-generate even if cached on server
//
// --format: standard | all_types | grammar | conjugation | synonyms | math
//
// Output: JSONL file (one record per language pair) + a .import.json importable
// into Dreizunge. Each record includes full lesson content + generation stats.

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getFlag(name, aliases = []) {
  const flags = [name, ...aliases];
  for (const f of flags) {
    const i = args.indexOf(f);
    if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  }
  return null;
}
function hasFlag(name, aliases = []) {
  return [name, ...aliases].some(f => args.includes(f));
}

const SERVER_URL       = getFlag('--server-url') || process.env.SERVER_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 2000;
const JOB_TIMEOUT_MS   = 10 * 60 * 1000;

const TOPIC       = getFlag('--topic');
const LANGS_ARG   = getFlag('--langs');
const SRC_LANGS_ARG = getFlag('--src-langs');
const DIFFICULTY  = parseInt(getFlag('--difficulty') || '1', 10);
const STORY_LEN   = parseInt(getFlag('--story-len') || '200', 10);
const FORMAT      = getFlag('--format') || 'standard';
const STYLE       = getFlag('--style') || 'neutral';
const CONCURRENCY = parseInt(getFlag('--concurrency') || '1', 10);
const _topicSlug = TOPIC.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const OUTPUT_FILE = getFlag('--output') ||
  `lessons-${_topicSlug}-d${DIFFICULTY}-${FORMAT}-${STYLE}.jsonl`;
const IMPORT_FILE = OUTPUT_FILE.replace(/\.jsonl$/, '') + '.import.json';
const RESUME_FILE = getFlag('--resume');
const DRY_RUN     = hasFlag('--dry-run', ['--dry']);
const FORCE       = hasFlag('--force');
const VERBOSE     = hasFlag('--verbose', ['-v']);
const TAG         = getFlag('--tag') || 'script-generated';

if (!TOPIC) {
  console.error('Usage: node generate-lessons.js --topic "topic in english" [options]');
  console.error('       --langs de,fr,ja          target languages (default: all)');
  console.error('       --src-langs en,de          source languages (default: all)');
  console.error('       --difficulty 1|2|3         (default: 1)');
  console.error('       --story-len N              words (default: 200)');
  console.error('       --format standard|all_types|grammar|conjugation (default: standard)');
  console.error('       --style neutral|creative|funny|... (default: neutral)');
  console.error('       --concurrency N            parallel generations (default: 1)');
  console.error('       --output FILE.jsonl        (default: lessons-<timestamp>.jsonl)');
  console.error('       --resume FILE.jsonl        skip pairs already in this file');
  console.error('       --force                    re-generate even if server has it cached');
  console.error('       --tag TAG                  storyline tag to apply (default: script-generated)');
  console.error('       --dry-run                  print pairs without generating');
  process.exit(1);
}

// ── Load language list ────────────────────────────────────────────────────────
let LANGS_DATA = {};
try {
  LANGS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'languages.json'), 'utf8'));
} catch(e) {
  console.error('Cannot read languages.json:', e.message); process.exit(1);
}
const ALL_LANGS = Object.keys(LANGS_DATA);

const targetLangs = LANGS_ARG
  ? LANGS_ARG.split(',').map(l => l.trim()).filter(l => LANGS_DATA[l])
  : ALL_LANGS;
const srcLangs = SRC_LANGS_ARG
  ? SRC_LANGS_ARG.split(',').map(l => l.trim()).filter(l => LANGS_DATA[l])
  : ALL_LANGS;

// Build pair list: skip same-language pairs
const pairs = [];
for (const lang of targetLangs) {
  for (const srcLang of srcLangs) {
    if (lang !== srcLang) pairs.push({ lang, srcLang });
  }
}

if (pairs.length === 0) {
  console.error('No valid language pairs after filtering.'); process.exit(1);
}

// ── Resume: load already-done pairs ──────────────────────────────────────────
const donePairs = new Set();
if (RESUME_FILE && fs.existsSync(RESUME_FILE)) {
  const lines = fs.readFileSync(RESUME_FILE, 'utf8').trim().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const r = JSON.parse(line);
      if (r.lang && r.srcLang && r.status === 'ok') donePairs.add(`${r.lang}:${r.srcLang}`);
    } catch(_) {}
  }
  console.log(`Resuming — ${donePairs.size} pairs already done in ${RESUME_FILE}`);
}

const pendingPairs = pairs.filter(p => !donePairs.has(`${p.lang}:${p.srcLang}`));
const outFile = RESUME_FILE || OUTPUT_FILE;

// ── Summary ───────────────────────────────────────────────────────────────────
const langName = code => (LANGS_DATA[code]?.name || code);
console.log(`\n🌍 generate-lessons.js`);
console.log(`${'─'.repeat(50)}`);
console.log(`  Topic       : "${TOPIC}"`);
console.log(`  Target langs: ${targetLangs.length} (${targetLangs.join(', ')})`);
console.log(`  Src langs   : ${srcLangs.length} (${srcLangs.join(', ')})`);
console.log(`  Pairs total : ${pairs.length} (${pendingPairs.length} pending)`);
console.log(`  Difficulty  : ${DIFFICULTY}  Story len: ${STORY_LEN}w  Format: ${FORMAT}  Style: ${STYLE}`);
console.log(`  Concurrency : ${CONCURRENCY}`);
console.log(`  Tag         : ${TAG}`);
console.log(`  Output      : ${outFile}`);
console.log(`  Import file : ${IMPORT_FILE}`);
if (FORCE)   console.log(`  Force regen : yes`);
if (DRY_RUN) console.log(`  Dry run     : yes — not generating`);
console.log(`${'─'.repeat(50)}\n`);

if (DRY_RUN) {
  pendingPairs.forEach((p, i) =>
    console.log(`  ${String(i+1).padStart(4)}  ${p.lang.padEnd(4)} ← ${p.srcLang.padEnd(4)}  ${langName(p.lang)} ← ${langName(p.srcLang)}`));
  console.log(`\n${pendingPairs.length} pairs would be generated.`);
  process.exit(0);
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpRequest(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = lib.request({
      hostname: u.hostname, port: u.port,
      path: u.pathname + (u.search || ''), method,
      headers: {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { reject(new Error(`JSON parse error: ${e.message}\n${d.slice(0,200)}`)); }
      });
    });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function pollJob(jobId) {
  const start = Date.now();
  while (Date.now() - start < JOB_TIMEOUT_MS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const { body } = await httpRequest('GET', `${SERVER_URL}/api/job/${jobId}`);
    if (body.status === 'done')   return { ok: true,  data: body.data, step: body.step };
    if (body.status === 'error')  return { ok: false, error: body.error, step: body.step };
    if (VERBOSE) process.stdout.write(`    [${jobId}] ${body.step}\r`);
  }
  return { ok: false, error: 'Job timed out' };
}

// ── JSONL writer ──────────────────────────────────────────────────────────────
function appendRecord(record) {
  fs.appendFileSync(outFile, JSON.stringify(record) + '\n', 'utf8');
}

// ── Import file: proper lessons.json-compatible format for the Dreizunge importer ──
const _importTopics = [];
const _importStorylines = [];
function appendImportTopic(data, storylines) {
  const { generationStats: _gs, fromCache: _fc, ...topicObj } = data;
  const existing = _importTopics.findIndex(t => t.topic === topicObj.topic && t.lang === topicObj.lang && t.srcLang === topicObj.srcLang);
  if (existing >= 0) _importTopics[existing] = topicObj;
  else _importTopics.push(topicObj);
  // Merge storylines if provided (may be array or single)
  for (const sl of (Array.isArray(storylines) ? storylines : storylines ? [storylines] : [])) {
    const slIdx = _importStorylines.findIndex(s => s.id === sl.id);
    if (slIdx >= 0) _importStorylines[slIdx] = sl;
    else _importStorylines.push(sl);
  }
  fs.writeFileSync(IMPORT_FILE, JSON.stringify(
    { schemaVersion: 29, topics: _importTopics, storylines: _importStorylines }, null, 2
  ), 'utf8');
}

// ── Summarise lesson data for the record ─────────────────────────────────────
function summarise(data) {
  const lessons = data.lessons || [];
  const vocabCount    = lessons.reduce((n, l) => n + (l.vocab?.length || 0), 0);
  const sentenceCount = lessons.reduce((n, l) => n + (l.sentences?.length || 0), 0);
  const grammarCount  = lessons.reduce((n, l) => n + (l.grammar?.length || 0), 0);
  const conjCount     = lessons.reduce((n, l) => n + (l.conjugations?.length || 0), 0);
  return { lessonCount: lessons.length, vocabCount, sentenceCount, grammarCount, conjCount };
}

// ── Generate one pair ─────────────────────────────────────────────────────────
async function generatePair(pair, idx, total) {
  const { lang, srcLang } = pair;
  const label = `${String(idx+1).padStart(4)}/${total}  ${lang}←${srcLang}`;
  process.stdout.write(`${label}  generating…`);
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  try {
    const { status, body } = await httpRequest('POST', `${SERVER_URL}/api/generate`, {
      topic:           TOPIC,
      lang,
      srcLang,
      difficulty:      DIFFICULTY,
      storyLen:        STORY_LEN,
      lessonFormat:    FORMAT,
      storyStyle:      STYLE,
      forceRegenerate: FORCE,
    });

    if (status === 503) throw new Error('Server has no LLM backend');
    if (status !== 202 && !(status === 200 && body.cached))
      throw new Error(`Unexpected status ${status}: ${body.error || JSON.stringify(body)}`);

    // Cache hit — server returned data directly (status 200)
    if (body.cached) {
      const data = body.data;
      const rec = {
        topic: TOPIC, lang, srcLang,
        translatedTopic: data.topic,
        startedAt, durationMs: Date.now() - t0,
        status: 'cached',
        error: null,
        generationStats: data.generationStats || null,
        ...summarise(data),
        lessons: data.lessons,
        quality: null,
      };
      appendRecord(rec);
      const _sl1 = await tagStoryline(data.topic, TAG);
      appendImportTopic(data, _sl1);
      console.log(`  cached (${data.topic})`);
      return rec;
    }

    // Poll for job completion
    const result = await pollJob(body.jobId);
    const durationMs = Date.now() - t0;

    if (!result.ok) {
      const rec = {
        topic: TOPIC, lang, srcLang, translatedTopic: null,
        startedAt, durationMs, status: 'failed',
        error: result.error, generationStats: null,
        lessonCount: 0, vocabCount: 0, sentenceCount: 0,
        grammarCount: 0, conjCount: 0,
        lessons: [], quality: null,
      };
      appendRecord(rec);
      console.log(`  FAILED: ${result.error}`);
      return rec;
    }

    const data = result.data;
    const rec = {
      topic: TOPIC, lang, srcLang,
      translatedTopic: data.topic,
      startedAt, durationMs,
      status: 'ok',
      error: null,
      generationStats: data.generationStats || null,
      ...summarise(data),
      lessons: data.lessons,
      quality: null,
    };
    appendRecord(rec);
    const _sl2 = await tagStoryline(data.topic, TAG);
    appendImportTopic(data, _sl2);
    const stats = data.generationStats;
    const tokStr = stats ? ` ${stats.totalPromptTokens + stats.totalCompletionTokens}tok` : '';
    console.log(`  ok  "${data.topic}"  ${(durationMs/1000).toFixed(1)}s${tokStr}`);
    return rec;

  } catch(e) {
    const durationMs = Date.now() - t0;
    const rec = {
      topic: TOPIC, lang, srcLang, translatedTopic: null,
      startedAt, durationMs, status: 'failed',
      error: e.message, generationStats: null,
      lessonCount: 0, vocabCount: 0, sentenceCount: 0,
      grammarCount: 0, conjCount: 0,
      lessons: [], quality: null,
    };
    appendRecord(rec);
    console.log(`  ERROR: ${e.message}`);
    return rec;
  }
}

// ── Tag all storylines that contain a given translated topic name ─────────────
async function tagStoryline(translatedTopic, tag) {
  try {
    const { body: storylines } = await httpRequest('GET', `${SERVER_URL}/api/storylines`);
    if (!Array.isArray(storylines)) return null;

    const { body: lessons } = await httpRequest('GET', `${SERVER_URL}/api/lessons`);
    if (!Array.isArray(lessons)) return null;
    const topicById = {};
    for (const l of lessons) if (l.id) topicById[l.id] = l.topic;

    const topicLower = translatedTopic.trim().toLowerCase();
    // Tag ALL storylines whose chapters include this topic (one per lang pair)
    const matched = storylines.filter(s =>
      (s.chapters || []).some(chId => (topicById[chId]||'').trim().toLowerCase() === topicLower)
    );
    if (!matched.length) return null;

    const results = [];
    for (const sl of matched) {
      const existingTags = Array.isArray(sl.tags) ? sl.tags : [];
      const updatedTags = existingTags.includes(tag) ? existingTags : [...existingTags, tag];
      if (!existingTags.includes(tag)) {
        await httpRequest('POST', `${SERVER_URL}/api/storylines`, { slId: sl.id, tags: updatedTags });
        if (VERBOSE) console.log(`    tagged storyline "${sl.id}" with "${tag}"`);
      }
      results.push({ ...sl, tags: updatedTags });
    }
    return results;
  } catch(e) {
    if (VERBOSE) console.warn(`    tag failed: ${e.message}`);
    return null;
  }
}

async function main() {
  // Verify server is up
  try {
    const { body } = await httpRequest('GET', `${SERVER_URL}/api/info`);
    if (!body.canGenerate) {
      console.error('❌ Server is running but has no LLM backend (offline mode). Start Ollama first.');
      process.exit(1);
    }
    console.log(`✓ Server: ${body.backend} / model: ${body.ollamaModel}\n`);
  } catch(e) {
    console.error(`❌ Cannot reach server at ${SERVER_URL}: ${e.message}`);
    console.error('   Start server.js first.');
    process.exit(1);
  }

  const total = pendingPairs.length;
  let done = 0, ok = 0, failed = 0;
  const runStart = Date.now();

  // Process in batches of CONCURRENCY
  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = pendingPairs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((pair, bi) =>
      generatePair(pair, i + bi, total)
    ));
    for (const r of results) {
      done++;
      if (r.status === 'ok' || r.status === 'cached') ok++; else failed++;
    }
    // ETA
    const elapsed = (Date.now() - runStart) / 1000;
    const rate = done / elapsed;
    const remaining = total - done;
    const eta = rate > 0 ? Math.round(remaining / rate) : '?';
    process.stdout.write(`  [${done}/${total}  ok:${ok}  failed:${failed}  eta:${eta}s]\n`);
  }

  // Final summary
  const totalMs = Date.now() - runStart;

  // Rebuild import file from server's authoritative data — topics now have IDs,
  // all storylines exist and are tagged. Much more reliable than accumulating incrementally.
  try {
    process.stdout.write('  Rebuilding import file from server… ');
    const { body: allLessons }    = await httpRequest('GET', `${SERVER_URL}/api/lessons`);
    const { body: allStorylines } = await httpRequest('GET', `${SERVER_URL}/api/storylines`);

    // Filter to only the topics we generated in this run (by lang+srcLang+translatedTopic)
    const generatedKeys = new Set(
      _importTopics.map(t => `${t.topic}|${t.lang}|${t.srcLang}`)
    );
    const topics = (Array.isArray(allLessons) ? allLessons : [])
      .filter(t => generatedKeys.has(`${t.topic}|${t.lang||''}|${t.srcLang||''}`));

    // Keep storylines that contain at least one of our topic IDs
    const ourTopicIds = new Set(topics.map(t => t.id).filter(Boolean));
    const storylines = (Array.isArray(allStorylines) ? allStorylines : [])
      .filter(sl => (sl.chapters||[]).some(chId => ourTopicIds.has(chId)));

    fs.writeFileSync(IMPORT_FILE, JSON.stringify(
      { schemaVersion: 29, topics, storylines }, null, 2
    ), 'utf8');
    console.log(`✓ (${topics.length} topics, ${storylines.length} storylines)`);
  } catch(e) {
    console.warn(`  ⚠ Could not rebuild import file: ${e.message} — using incremental version`);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Done in ${(totalMs/1000).toFixed(1)}s`);
  console.log(`   ok: ${ok}  failed: ${failed}  total: ${done}`);
  console.log(`   Output: ${outFile}`);
  console.log(`   Import: ${IMPORT_FILE} (${_importTopics.length} topics — importable in Dreizunge)`);
  if (failed > 0) {
    console.log(`   Re-run with --resume ${outFile} to retry failed pairs.`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
