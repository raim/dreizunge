// unit-word-forms-decidable.test.js
// v79_i (user report, tp_872660509): "A new word form lesson produced almost entirely lessons where
// actually both present and past tense or infinitive versions of the word would provide a
// meaningful sentence. The alternative forms in word forms MUST BE WRONG without the story
// context."
//
// The rule was ALREADY in the prompt, and the prompt contradicted it three bullets earlier:
//
//   "PREFER VERBS. The easiest reliable exercise: blank a verb, and use the SAME verb in a
//    different tense/conjugation that does NOT fit the sentence's time as the wrong choice
//    (e.g. a past form where the sentence is present, or vice-versa)."
//
// versus, later:
//
//   "If the sentence does not force a single form (e.g. it works in both present and past) then
//    blank a DIFFERENT word, or choose another sentence."
//
// The first is a concrete recipe, the second an abstract prohibition, and the model followed the
// recipe — five of the six items in the reported lesson are a bare present/past pair. So this is
// not "the prompt was too weak"; **the prompt asked for the defect**. That distinction matters for
// the next report of this shape: check whether the instruction is absent, or present and
// contradicted, before writing a stronger version of a rule that is already there.
//
// What is testable HERE is the prompt's contract, not the model's compliance — no model runs in
// this harness, and whether qwen honours the new wording is only observable on a live generation.
// So: the contradiction is gone, the decidability rule and its self-check are present, and the
// counter-example that shows the failure is present. `build_history/probe_word_forms_v79i.js` measures the corpus
// and is what a later run should diff against.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PROMPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

const sys = PROMPTS.wordForms && PROMPTS.wordForms.system;
assert.ok(sys && sys.length > 500, 'prompts.json still carries a word-forms system prompt');

// ── 1. The contradiction is gone ──────────────────────────────────────────────────────────────
// Anchored on what the old bullet MEANT rather than its exact words: any instruction that offers
// "a different tense as the wrong choice" as a recipe re-creates the bug, however it is phrased.
{
  assert.ok(!/different tense\/conjugation that does NOT fit/i.test(sys),
    'the "use a different tense as the wrong choice" recipe is gone — it is what produced the '
    + 'reported lesson');
  assert.ok(!/PREFER VERBS\. The easiest reliable exercise/i.test(sys),
    'and so is the bullet that recommended it');
  // The sentence's own time, not the story's, is the only admissible evidence.
  assert.ok(/story's tense does NOT count|cannot see the story/i.test(sys),
    'the prompt says explicitly that the story\'s tense is not evidence, because the learner '
    + 'sees only the one sentence');
}

// ── 2. The decidability rule is stated, and stated OPERATIONALLY ───────────────────────────────
// "Every other choice must be clearly wrong" was already there and was not enough. What is new is
// a check the model can actually run, on each item, before returning it.
{
  assert.ok(/SENTENCE ALONE MUST DECIDE|sentence alone must decide/i.test(sys),
    'the prompt states that the sentence alone must decide the answer');
  assert.ok(/CHECK EVERY ITEM BEFORE YOU RETURN IT/i.test(sys),
    'and gives a per-item check rather than only a prohibition');
  assert.ok(/each wrong choice|EACH wrong choice/i.test(sys),
    'the check is to substitute each wrong choice and re-read the sentence');
  assert.ok(/FEWER/i.test(sys),
    'and returning fewer items is explicitly preferred over padding to the requested count — '
    + 'without this the model trades correctness for the number it was asked for');
  assert.ok(/DO NOT build an item on tense alone/i.test(sys),
    'the specific failure mode is named, not merely implied');
}

// ── 3. A worked COUNTER-example ────────────────────────────────────────────────────────────────
// The prompt's only examples were positive ones. A small model imitates examples far more reliably
// than it obeys prohibitions, so the failure now has a worked example of its own.
{
  assert.ok(/BROKEN ITEM/i.test(sys), 'the prompt shows a broken item, not only good ones');
  assert.ok(/lingered/i.test(sys),
    'built from the reported lesson\'s own item, so the example is a real failure rather than an '
    + 'invented one');
  assert.ok(/FIXED/i.test(sys), 'and shows the repaired version beside it');
  // The fix must demonstrate an IN-SENTENCE trigger, which is the whole point.
  assert.ok(/plural subject/i.test(sys),
    'the repaired example names the word in the sentence that decides the answer');
}

// ── 4. The explanation field now carries the trigger ───────────────────────────────────────────
// It was optional and vague ("why the correct form fits"). Naming the triggering WORD is the same
// check as rule 2, expressed as output the author can inspect afterwards — so a bad item is
// visible in the saved lesson, not only at generation time.
{
  const expl = sys.slice(sys.indexOf('"explanation"'));
  assert.ok(/WORD IN THE SENTENCE/i.test(expl.slice(0, 500)),
    'the explanation must name the triggering word in the sentence');
  assert.ok(!/is OPTIONAL/i.test(expl.slice(0, 200)),
    'and is no longer described as optional decoration');
}

// ── 5. The prompt is still WIRED, and still sized ──────────────────────────────────────────────
// A prompt edit that quietly grew the system message past the context window would substitute one
// silent failure for another (v71_t). generateWordForms sizes num_ctx from the actual lengths, so
// what matters is that the sizing is still there and still reads this prompt.
{
  const fn = server.slice(server.indexOf('async function generateWordForms('),
                          server.indexOf('function generateSynonyms(') > 0
                            ? server.indexOf('function generateSynonyms(')
                            : server.indexOf('async function generateSynonyms('));
  assert.ok(fn.length > 0, 'found generateWordForms');
  assert.ok(/PROMPTS\.wordForms\.system/.test(fn), 'it still builds from this prompt');
  assert.ok(/ctxTokens:\s*_ctxTokens/.test(fn),
    'and still sizes num_ctx from the prompt it actually sends — a longer system prompt must not '
    + 'push the story out of the window silently');
  assert.ok(/estimateCtxTokens\(sys\.length \+ userMsg\.length/.test(fn),
    'sized from the REAL lengths, so this edit is accounted for automatically');
  // The reported chapter is English; the largest corpus story plus this prompt must still fit the
  // ceiling, or the fix would break generation for long chapters.
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const longest = Math.max(...store.topics.map(t => String(t.story || '').trim().length));
  const est = Math.ceil((sys.length + longest + 400) / 3.2) + 1600 + 512;
  assert.ok(est <= 16384,
    `the new prompt plus the longest corpus story (${longest} chars) still fits the num_ctx `
    + `ceiling (est ${est} tokens)`);
  console.log(`  prompt ${sys.length} chars; longest story ${longest} -> est ${est} tokens, fits`);
}

console.log('  contradiction removed, decidability rule + per-item check present: OK');
console.log('  counter-example built from the reported item: OK');
console.log('unit-word-forms-decidable: ALL PASSED');
