#!/usr/bin/env node
'use strict';
// spike-qc-correct.js — THROWAWAY spike for the "QC for generated texts" feature
// (roadmap_v55.md → OPEN — QC for generated texts → corrected text + auto error-hunt).
//
// The feature: a QC model reviews a generated story and returns a CORRECTED text, stored as a
// PROPOSAL; the (original, corrected) diff then seeds an ai_error_hunt lesson via the EXISTING
// storyDiffSentences() machinery. The whole design hinges on one unknown the roadmap flagged:
//
//   does the QC model CORRECT (a few targeted edits) or REWRITE (wholesale)?
//
// `generateErrorHunt` already guards "identical story, no changes"; the feature needs the INVERSE
// guard, "too many changes" — but that guard needs a threshold, and the threshold needs data.
// This spike measures the edit distribution on REAL corpus stories before any UI/storage is built:
//   1. run a correction prompt through the QC model on N real stories,
//   2. diff original↔corrected with the SAME storyDiffSentences server.js uses,
//   3. report changed-sentence ratio + char-delta, and classify clean / corrected / rewrite,
//   4. dump each (original, corrected, diff) to files for eyeballing.
//
// Verdict (per roadmap spike discipline): if most results land in a clean "corrected" band with a
// separable "rewrite" tail, the guard is feasible → build it. If corrections are indistinguishable
// from rewrites (no threshold separates them), STOP and rethink the prompt or the approach.
//
// Usage:
//   node spike-qc-correct.js --list                       # candidate stories
//   node spike-qc-correct.js [--n 5] [--lang it]          # run on N stories (optionally one lang)
//   node spike-qc-correct.js --topic "The Plan Unfolds"   # one specific story
//   OLLAMA_QC_MODEL=qwen2.5:7b node spike-qc-correct.js --n 6
// Flags: --model <m> --n <k> --lang <code> --topic <name> --max-tokens <n> --timeout <ms> --out <dir>
//
// Imported by nothing; deleting it is always safe. When the feature lands, the correction prompt
// moves to prompts.json (`storyQc`), the classifier thresholds become the "too many changes" guard,
// and storyDiffSentences is reused verbatim (it's already the ai_error_hunt diff).

const fs = require('fs');
const path = require('path');
const { callLLM, warmup, setRequestTimeout, stripThink, stripRaw } = require('./llm.js');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return (i >= 0 && argv[i + 1] != null) ? argv[i + 1] : d; };
const LIST       = argv.includes('--list');
const LESSONS    = flag('lessons', path.join(__dirname, 'lessons.json'));
const MODEL      = flag('model', process.env.OLLAMA_QC_MODEL || process.env.OLLAMA_TRANSLATION_MODEL || 'qwen2.5:7b');
const N          = parseInt(flag('n', '5'), 10);
const LANG       = flag('lang', null);
const TOPIC      = flag('topic', null);
const MAX_TOKENS = parseInt(flag('max-tokens', '2048'), 10);
const TIMEOUT_MS = setRequestTimeout(flag('timeout', process.env.OLLAMA_TIMEOUT || '3600000'));
const OUT_DIR    = flag('out', path.join(__dirname, 'spike_qc_out'));

const LANG_NAMES = { en:'English', de:'German', fr:'French', it:'Italian', es:'Spanish', nl:'Dutch',
  lb:'Luxembourgish', sw:'Swahili', ja:'Japanese', pl:'Polish', ar:'Arabic' };
const langName = c => LANG_NAMES[c] || c;

// ── The correction prompt (moves to prompts.json `storyQc` when the feature lands) ──
// Deliberately conservative: correct ERRORS ONLY, preserve everything else verbatim. The whole
// point of the spike is to see whether the model actually honours "don't rewrite".
const SYS = `You are a meticulous {L} proofreader. You are given a {L} story that may contain spelling, grammar, agreement, or punctuation errors introduced by an AI text generator.

Your job is to CORRECT errors ONLY. This is proofreading, not rewriting.
- Fix spelling, grammar, gender/number agreement, verb forms, and punctuation.
- Preserve the author's wording, sentence structure, vocabulary, and style EXACTLY where they are already correct.
- Do NOT rephrase, simplify, embellish, reorder, add, or remove content for style. If a sentence is already correct, return it UNCHANGED, character for character.
- Keep the same paragraph breaks.
- If the whole story is already correct, return it exactly as given.

Output ONLY the corrected {L} story text. No preamble, no notes, no markdown, no explanation of what you changed.`;

// ── Diff, lifted verbatim from server.js storyDiffSentences (the ai_error_hunt diff) ──
function splitSentences(text) {
  const result = [];
  text.split(/\n\n+/).forEach((para, pi) => {
    if (pi > 0) result.push({ para: true });
    const parts = para.trim().split(/(?<=[.!?,;:"""«»„\u2018\u2019])\s*/);
    parts.map(s => s.trim()).filter(Boolean).forEach(s => result.push(s));
  });
  return result;
}
function storyDiffSentences(aiStory, correctedStory) {
  const aArr = splitSentences(aiStory).filter(s => typeof s === 'string');
  const bArr = splitSentences(correctedStory).filter(s => typeof s === 'string');
  const m = aArr.length, n = bArr.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = aArr[i - 1] === bArr[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const ops = []; let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aArr[i - 1] === bArr[j - 1]) { ops.unshift({ type: 'eq', ai: aArr[i - 1], corrected: bArr[j - 1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.unshift({ type: 'ins', corrected: bArr[j - 1] }); j--; }
    else { ops.unshift({ type: 'del', ai: aArr[i - 1] }); i--; }
  }
  const pairs = []; let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.type === 'eq') { pairs.push({ ai: op.ai, corrected: op.corrected, changed: false }); k++; }
    else {
      let dels = [], ins = [];
      while (k < ops.length && ops[k].type !== 'eq') { ops[k].type === 'del' ? dels.push(ops[k].ai) : ins.push(ops[k].corrected); k++; }
      const maxLen = Math.max(dels.length, ins.length);
      for (let x = 0; x < maxLen; x++) pairs.push({ ai: dels[x] || null, corrected: ins[x] || null, changed: true });
    }
  }
  return { pairs, aCount: aArr.length, changed: pairs.filter(p => p.changed) };
}

// Levenshtein at word level, for a magnitude-of-change signal independent of sentence splitting.
function wordLev(a, b) {
  const wa = a.split(/\s+/), wb = b.split(/\s+/);
  const dp = Array.from({ length: wa.length + 1 }, (_, i) => [i, ...new Array(wb.length).fill(0)]);
  for (let j = 0; j <= wb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= wa.length; i++) for (let j = 1; j <= wb.length; j++)
    dp[i][j] = wa[i - 1] === wb[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[wa.length][wb.length];
}

// Classify the edit magnitude. Thresholds are the SPIKE'S HYPOTHESIS for the "too many changes"
// guard — the point is to see whether they actually separate real results.
function classify(orig, corrected) {
  const diff = storyDiffSentences(orig, corrected);
  const changedRatio = diff.aCount ? diff.changed.length / diff.aCount : 0;
  const words = orig.split(/\s+/).length;
  const wordEditRatio = words ? wordLev(orig, corrected) / words : 0;
  let verdict;
  if (diff.changed.length === 0) verdict = 'clean';           // no changes at all
  else if (changedRatio <= 0.5 && wordEditRatio <= 0.35) verdict = 'corrected'; // targeted edits
  else verdict = 'rewrite';                                   // wholesale — reject in the real guard
  return { verdict, changedSentences: diff.changed.length, totalSentences: diff.aCount,
    changedRatio: +changedRatio.toFixed(3), wordEditRatio: +wordEditRatio.toFixed(3), diff };
}

function loadStories() {
  const d = JSON.parse(fs.readFileSync(LESSONS, 'utf8'));
  let c = d.topics.filter(t => t.story && !t.userStory && t.story.length > 150 && t.story.length < 1600);
  if (LANG)  c = c.filter(t => t.lang === LANG);
  if (TOPIC) c = c.filter(t => t.topic === TOPIC);
  return c;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all = loadStories();
  if (LIST) {
    console.log(`Candidate generated stories in ${path.basename(LESSONS)} (150–1600 chars):\n`);
    all.forEach(t => console.log(`  [${t.lang}] "${t.topic}" — ${t.story.length}c, ${t.storyMeta?.model || '?'}`));
    console.log(`\n${all.length} total.`);
    return;
  }
  const stories = TOPIC ? all : all.sort(() => Math.random() - 0.5).slice(0, N);
  if (!stories.length) { console.error('No matching stories. Try --list.'); process.exit(1); }

  console.log(`\n── QC-correction SPIKE ──────────────────────────────`);
  console.log(`  Model    : ${MODEL}   stories: ${stories.length}   timeout: ${Math.round(TIMEOUT_MS / 60000)}min`);
  await warmup(MODEL);

  const tally = { clean: 0, corrected: 0, rewrite: 0, failed: 0 };
  const rows = [];
  for (const [idx, t] of stories.entries()) {
    const L = langName(t.lang);
    const sys = SYS.replace(/\{L\}/g, L);
    const _ta = Date.now();
    try {
      const { text, completionTokens } = await callLLM(MODEL, sys, t.story, MAX_TOKENS, { think: false });
      const corrected = stripRaw(stripThink(text)).trim();
      const secs = ((Date.now() - _ta) / 1000).toFixed(0);
      if (!corrected) { tally.failed++; console.log(`  [${idx + 1}/${stories.length}] ${t.topic}: EMPTY response after ${secs}s`); continue; }
      const c = classify(t.story, corrected);
      tally[c.verdict]++;
      rows.push({ topic: t.topic, lang: t.lang, verdict: c.verdict, changed: `${c.changedSentences}/${c.totalSentences}`,
        changedRatio: c.changedRatio, wordEditRatio: c.wordEditRatio, secs, tok: completionTokens });
      const fn = path.join(OUT_DIR, `${String(idx + 1).padStart(2, '0')}_${t.verdict || c.verdict}_${t.topic.replace(/[^a-z0-9]+/gi, '_').slice(0, 30)}`);
      fs.writeFileSync(fn + '.orig.txt', t.story);
      fs.writeFileSync(fn + '.corrected.txt', corrected);
      fs.writeFileSync(fn + '.diff.json', JSON.stringify(c.diff.changed, null, 2));
      const bar = c.verdict === 'clean' ? '·' : c.verdict === 'corrected' ? '✎' : '⚠';
      console.log(`  [${idx + 1}/${stories.length}] ${bar} ${c.verdict.padEnd(9)} ${t.topic.slice(0, 34).padEnd(34)} ` +
        `sent ${String(c.changedSentences + '/' + c.totalSentences).padEnd(6)} wordΔ ${String(c.wordEditRatio).padEnd(5)} ${secs}s`);
    } catch (e) {
      tally.failed++;
      console.log(`  [${idx + 1}/${stories.length}] ${t.topic}: ${e.message} after ${((Date.now() - _ta) / 1000).toFixed(0)}s`);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ model: MODEL, tally, rows }, null, 2));
  console.log(`\n  Tally    : clean ${tally.clean} · corrected ${tally.corrected} · rewrite ${tally.rewrite} · failed ${tally.failed}`);
  console.log(`  Files    : ${OUT_DIR}/ (per story: .orig / .corrected / .diff.json; + summary.json)`);
  console.log(`  Verdict  : a clean 'corrected' band with a separable 'rewrite' tail → the "too many`);
  console.log(`             changes" guard is feasible; build it. If corrected≈rewrite are muddled,`);
  console.log(`             the prompt isn't holding "proofread, don't rewrite" — fix that first.`);
  console.log('────────────────────────────────────────────────────\n');
}

main().catch(e => { console.error(e); process.exit(1); });
