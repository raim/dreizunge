// unit-generation-context.test.js
// v72_f — WHAT STORY TEXT REACHES THE MODEL, and whether the context window was sized for it.
//
// Two failures live here and neither one is visible at runtime:
//
//   1. A prompt carrying the whole story but omitting `ctxTokens` runs at Ollama's DEFAULT num_ctx
//      (~4096) and is truncated SILENTLY (v71_t). The model answers from a fragment and every
//      attempt "succeeds". generateWordForms was inside that limit by ~110 tokens — about 380
//      characters of story — with no guard.
//
//   2. `generateComprehension` prefers `chainStory || story`. Four of its five call paths supplied
//      the chain and one did not, so the SAME lesson had 5.5x more context when added afterwards
//      than when created with the chapter.
//
// Both are asserted against the source, because both are about what the code SENDS. A behavioural
// test would need a live model to notice either.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

function body(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing generator: ' + name);
  const b = server.indexOf('{', at);
  let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}

// ── 1. Which prompts carry raw story text at all ────────────────────────────
// Derived from the SOURCE rather than hard-coded, so ADDING a story-bearing prompt fails this test
// and forces a decision about sizing instead of inheriting the default silently.
//
// Both halves matter. An earlier draft of this file checked prompts.json only — and prompts.json
// holds five of them while server.js interpolates the story inline in five MORE places
// (generateErrorHunt, and three of generateOneLesson's four branches). A guard that saw half the
// problem while reporting "all accounted for" is worse than none.
{
  const inPrompts = Object.keys(prompts).filter(k => /\{story\}/.test(JSON.stringify(prompts[k]))).sort();
  assert.deepStrictEqual(inPrompts, ['comprehension', 'inflections', 'synonyms', 'tutor', 'vocabFromText', 'wordForms'],
    'the set of prompts.json entries embedding the FULL story has changed. A new one must either ' +
    'size num_ctx (see generateSynonyms) or cap the text (see the standard vocab branch, which ' +
    'slices to 1200 chars) — then add it here.\n  found: ' + inPrompts.join(', '));

  // Inline `${story}` interpolations. Counted, not listed, because the surrounding template text
  // changes often; the number is what must not creep up unnoticed.
  const inline = (server.match(/\$\{story\}/g) || []).length;
  assert.strictEqual(inline, 5,
    'server.js interpolates the story directly into a prompt in exactly 5 places (error-hunt, ' +
    'generateOneLesson x3, continue-storyline). Found ' + inline + '. A new one needs num_ctx ' +
    'sizing at its call site — check it, then update this count.');

  // `vocab`'s standard branch deliberately sends an EXCERPT. That cap is real but partial: it
  // covers ONE of generateOneLesson's four branches, which is why the call site sizes num_ctx too.
  assert.ok(/\{storyExcerpt\}/.test(JSON.stringify(prompts.vocab)),
    'the standard vocab branch still sends a capped excerpt');
  assert.ok(/story\.slice\(0, 1200\)/.test(server), 'and the cap is still 1200 chars');
  console.log(`  full-story prompt sites: ${inPrompts.length} in prompts.json + ${inline} inline: OK`);
}

// ── 2. Every full-story lesson generator sizes num_ctx ──────────────────────
{
  for (const fn of ['generateWordForms', 'generateInflections', 'generateSynonyms', 'generateComprehension', 'generateOneLesson']) {
    const src = body(fn);
    assert.ok(/callLLMLesson\(/.test(src), fn + ' calls the lesson model');
    assert.ok(/ctxTokens:/.test(src),
      fn + ' sizes num_ctx — it sends the whole story, and without this Ollama truncates the ' +
      'prompt silently at its default (~4096 tokens) rather than failing');
    assert.ok(/estimateCtxTokens\(/.test(src), fn + ' derives the size from the actual prompt length');
    assert.ok(/timeoutMs:/.test(src), fn + ' also raises the timeout — a bigger context takes longer');
  }
  // The converse, and a RULING rather than an oversight (session 26): grammar and conjugation send
  // 8 extracted keywords and never the story, because gender/article/plural/verb paradigms are
  // dictionary properties of a word — a passage cannot make the answer more correct. A synonym is
  // different: its validity depends on which sense the sentence picks out, which is why v72_d gave
  // that generator the story. Asserted so the resemblance to the old synonyms bug does not get
  // "fixed".
  for (const fn of ['generateGrammar', 'generateConjugation']) {
    const src = body(fn);
    assert.ok(!/\bstory\b\s*,\s*n\s*\}/.test(src),
      fn + ' does not embed the raw story (it sends storyKeywords) — if that changes it needs sizing');
  }
  // generateErrorHunt uses _callLLM directly rather than callLLMLesson, and is the hungriest call
  // of all: it embeds the whole story AND asks for the whole story back. Truncating its input is
  // uniquely bad — the reply would be a corrupted FRAGMENT, the length check would reject it, and
  // all three retries would burn reporting a word-count mismatch rather than the real cause.
  {
    const eh = body('generateErrorHunt');
    assert.ok(/ctxTokens: estimateCtxTokens\(/.test(eh), 'generateErrorHunt sizes num_ctx too');
  }
  console.log('  every full-story generator sizes num_ctx; keyword-only ones deliberately do not: OK');
}

// ── 3. Comprehension gets the chain from EVERY path that can supply one ─────
{
  const comp = body('generateComprehension');
  assert.ok(/chainStory \|\| story/.test(comp),
    'generateComprehension still prefers the chain and falls back to the chapter');

  // The path that was missing it: generate() builds chainOpts, and comprehension is reachable there.
  const gen = body('generate');
  assert.ok(/generateComprehension\(topic, lang, srcLang, difficulty, jobId, chainOpts\)/.test(gen),
    'generate() still routes comprehension through chainOpts');
  assert.ok(/collectChainStory\(/.test(gen),
    'generate() collects the chain STORY — it already collected chain VOCAB two lines away, and ' +
    'that asymmetry was the bug: the same lesson saw one chapter here and the whole storyline when ' +
    'added later');
  assert.ok(/chainStory: _chainStory\.text/.test(gen), 'and puts it on chainOpts');

  // Every construction of generator options that feeds comprehension carries chainStory. Counted,
  // so a new call path that forgets it is visible rather than merely absent.
  const sites = server.match(/chainStory: /g) || [];
  assert.ok(sites.length >= 5,
    'all comprehension call paths pass chainStory (found ' + sites.length + ', expected >= 5: ' +
    'generate, arc, re-create, add-lesson, ADD_LESSON_GENERATORS)');
  console.log(`  comprehension receives the chain from ${sites.length} call sites: OK`);
}

// ── 4. The chain is assembled current-chapter-last and trimmed from the front ─
// Not a style point: the questions are set on the chapter the learner just read, so trimming the
// wrong end would drop exactly the material being quizzed.
{
  const src = body('collectChainStory');
  assert.ok(/out\.reverse\(\)/.test(src), 'oldest first, so the narrative reads forwards');
  assert.ok(/Always keep the current chapter whole/.test(src), 'the current chapter is never trimmed');
  const gen = body('generate');
  assert.ok(/id: null, topic, story, continuedFromId:/.test(gen),
    'generate() builds the synthetic node the same way the arc path does — the chapter is not ' +
    'persisted yet at that point, so it cannot be walked from the store');
  console.log('  chain assembly keeps the current chapter whole: OK');
}

console.log('unit-generation-context: ALL PASSED');
