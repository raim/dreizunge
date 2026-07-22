// unit-reasoning-model-safety.test.js
// v60.5 — reasoning models (e.g. qwen3.6:...-a3b) spend num_predict inside a <think> block, so a
// prose/JSON call with no `think:false` and a small budget returns nothing after stripThink →
// "Ollama returned empty response" (the reported story-generation failure). Guard: the generation
// calls that produce prose or JSON (no reasoning needed) pass { think: false }, and the opts object
// actually reaches _callOllama through the role wrapper + v59 meter.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');

// ── 1. opts propagates end-to-end: callLLM → _callLLM (meter) → _rawCallLLM → _callOllama ──
{
  assert.ok(/function callLLM\(system, userMsg, maxTokens, opts\) \{\s*return _callLLM\(OLLAMA_MODEL, system, userMsg, maxTokens, opts\);/.test(server),
    'the story-role callLLM wrapper forwards opts (was dropped — the root cause)');
  assert.ok(/async function _callLLM\(\.\.\.args\) \{[\s\S]*?_rawCallLLM\(\.\.\.args\)/.test(server),
    'the v59 meter forwards ...args, so opts survives metering');
  assert.ok(/function callLLM\(model, system, userMsg, maxTokens, opts\)/.test(llm),
    'llm.callLLM accepts opts');
  assert.ok(/opts && typeof opts\.think === 'boolean' \? \{ think: opts\.think \} : \{\}/.test(llm),
    '_callOllama emits think:true|false to Ollama when requested (v60.7: both directions)');
  // Graceful degradation: a NON-thinking model that rejects the param retries once without it.
  assert.ok(/does not support thinking/i.test(llm) && /think: undefined/.test(llm),
    'a model that rejects think:false is retried without it (non-reasoning models still work)');
}
console.log('  opts propagation callLLM→meter→_callOllama + reject-retry: OK');

// ── 2. Story generation honors the per-role reasoning toggle (default off) ────
{
  const storyCall = server.slice(server.indexOf('const storySystem = sysStory('), server.indexOf('story = text.trim();'));
  assert.ok(/thinkOpts\('story', _baseStoryTokens\)/.test(storyCall),
    'story generation resolves reasoning via thinkOpts (per-role, default off = think:false)');
  assert.ok(/Math\.min\(4096,/.test(storyCall), 'story base budget is 4096 headroom (was 2048)');
  // thinkOpts default-off returns think:false, so the empty-response protection still holds.
  const to = server.slice(server.indexOf('function thinkOpts('), server.indexOf('function thinkOpts(') + 500);
  assert.ok(/if \(!on\) return \{ think: false/.test(to), 'thinkOpts default (off) returns think:false');
  assert.ok(/think: true/.test(to) && /THINK_TOKEN_MULT/.test(to) && /THINK_TIMEOUT_MULT/.test(to),
    'thinkOpts on → think:true + bumped tokens & timeout');
}
console.log('  story generation: per-role thinkOpts (default off) + roomier budget: OK');

// ── 3. The tiny-budget JSON meta calls also disable thinking ──────────────────
// 256/128-token calls vanish entirely into a think block on a reasoning model; both produce JSON
// (a stray think block would also break extractJSON), and the topic-info fallback would otherwise
// silently strip every reasoning-model generation's emoji/name.
{
  assert.ok(/Return the JSON with topic and topicEmoji[\s\S]{0,120}256, \{ think: false \}/.test(server),
    'topic-info meta call passes think:false');
  assert.ok(/sysTransMeta, toTranslate, 128, \{ think: false \}/.test(server),
    'meta-translation call passes think:false');
}
console.log('  meta/translation JSON calls: think:false: OK');

// ── 3b. The post-pass calls must never reason (v65.1 regression) ─────────────
// Reported: chapter-title, storyline-title and storyline-summary post-passes all failed with
// "Ollama returned empty response" on a reasoning model — even with thinking OFF for the story
// role — because these three calls never received the v60.5 think:false treatment. Their budgets
// are tiny (240 / 80 / 400 tokens), so a reasoning model spends the lot before writing anything.
{
  for (const [fn, budget] of [['generateChapterMeta', '60 * n + 120'],
                              ['generateStorylineTitle', '80'],
                              ['generateStorylineSummary', '400']]) {
    const at = server.indexOf('async function ' + fn + '(');
    assert.ok(at > 0, `found ${fn}`);
    const body = server.slice(at, at + 2000);
    const wanted = `_callLLM(OLLAMA_MODEL, sys, user, ${budget}, { think: false })`;
    assert.ok(body.includes(wanted),
      `${fn} passes think:false (short structured output — reasoning starves it)`);
  }
}
console.log('  post-pass title/summary calls: think:false (v65.1 regression): OK');

// ── 3c. Thinking needs an absolute token FLOOR (v65.1) ──────────────────────
// Reported: story generation still failed with thinking ON. The multiplier alone is not enough —
// a 50-word story's base budget is ~475 tokens, so ×2.5 is ~1187, less than a 35B reasoning model
// spends inside <think> before writing a word.
{
  assert.ok(/const THINK_MIN_TOKENS = 3000;/.test(server), 'a floor exists for thinking budgets');
  assert.ok(/tokens: Math\.max\(THINK_MIN_TOKENS, Math\.ceil\(\(baseTokens \|\| 1024\) \* THINK_TOKEN_MULT\)\)/.test(server),
    'the thinking budget is max(floor, base × multiplier) — a short output cannot starve reasoning');
}
console.log('  thinking token floor (v65.1): OK');

// ── 3d. Story translation always runs (v65.1) ───────────────────────────────
// Was gated on the translation model DIFFERING from the story model, so a single-model setup
// produced no translations at all — which is why the read-story translation toggle looked missing.
{
  assert.ok(/const shouldAutoTranslate = !!story && !storyTranslation;/.test(server),
    'translation runs whenever a story exists and none was supplied (no model-difference condition)');
  // Scoped to the auto-translate DECISION: the same comparison legitimately appears elsewhere
  // (VRAM release must not free the same model twice; a startup log line).
  {
    const at = server.indexOf('const shouldAutoTranslate');
    const decision = server.slice(at - 600, at + 200);
    assert.ok(!/OLLAMA_TRANSLATION_MODEL !== OLLAMA_MODEL/.test(decision),
      'the old model-difference gate is gone from the translate decision');
  }
  assert.ok(/sysTranslation\(lang, srcLang\), story,[\s\S]{0,120}\{ think: false \}/.test(server),
    'the translation call is reasoning-safe too');
}
console.log('  story translation: always on + reasoning-safe (v65.1): OK');


// ── 4. The empty-response guard message still exists (what the user saw) ──────
{
  assert.ok(/Ollama returned empty response/.test(llm), 'empty-response guard present');
  assert.ok(/only a reasoning block \(no answer\)/.test(llm),
    'reasoning-only guard present (the specific failure mode think:false prevents)');
}
console.log('  empty-response + reasoning-only guards intact: OK');

console.log('unit-reasoning-model-safety: ALL PASSED');
