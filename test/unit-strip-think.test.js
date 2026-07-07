// Reasoning-model hardening: stripThink() must remove a chain-of-thought so it can never
// leak into a story, a translation, or a JSON payload — no matter which shape the model
// emits it in. Guards the model-dropdown work (which lets a user pick ANY installed model,
// including reasoning models like Qwen3 / QwQ / DeepSeek-R1). Pure function, so tested directly.
const assert = require('assert');
const path = require('path');
const { stripThink, stripRaw, extractJSON, extractArray } = require(path.join(__dirname, '..', 'llm.js'));

function eq(actual, expected, msg) { assert.strictEqual(actual, expected, msg); }

// ── (1) Well-formed closed pairs ────────────────────────────────────────────────
eq(stripThink('<think>weighing options</think>Hello'), 'Hello', 'closed <think> pair removed');
eq(stripThink('<thinking>hmm</thinking>Hallo'), 'Hallo', 'closed <thinking> pair removed');
eq(stripThink('<THINK>X</THINK>Y'), 'Y', 'tag matching is case-insensitive');
eq(stripThink('<think>line one\nline two\n{curly} [square]</think>Es war einmal.'),
   'Es war einmal.', 'multiline reasoning with punctuation removed');
eq(stripThink('<think>a</think>first<think>b</think>second'),
   'firstsecond', 'multiple closed blocks all removed');

// ── (2) Orphan CLOSE tag (reasoning first, no opening tag, then the answer) ──────
eq(stripThink('I should translate faithfully.</think>Die Katze schläft.'),
   'Die Katze schläft.', 'orphan close: drop everything up to the close tag');
eq(stripThink('step1</think>mid</think>ANSWER'),
   'ANSWER', 'multiple orphan closes: drop up to the LAST close tag');

// ── (3) Orphan OPEN tag (truncated: reasoning ran past the budget, never closed) ─
eq(stripThink('<think>I am still reasoning and got cut off'), '',
   'orphan open (truncated) collapses to empty — the answer never arrived');
eq(stripThink('Some answer then a stray <think>trailing reasoning cut off'),
   'Some answer then a stray', 'orphan open after content: drop from the open tag on');

// ── (4) Non-reasoning output is untouched (a no-op apart from trimming) ──────────
eq(stripThink('Es war einmal ein kleiner Hund, der gerne lief.'),
   'Es war einmal ein kleiner Hund, der gerne lief.', 'plain prose story unchanged');
eq(stripThink('  padded  '), 'padded', 'trims surrounding whitespace');
eq(stripThink('[{"target":"Hund","source":"dog"}]'),
   '[{"target":"Hund","source":"dog"}]', 'plain JSON array unchanged');
eq(stripThink(null), null, 'null passthrough (no crash)');
eq(stripThink(''), '', 'empty passthrough');

// ── (5) Idempotence — running twice equals running once ─────────────────────────
{
  const once = stripThink('<think>r</think>Answer</think>tail');
  eq(stripThink(once), once, 'stripThink is idempotent');
}

// ── (6) stripRaw still strips code fences AND now delegates think-removal ────────
eq(stripRaw('<think>plan</think>```json\n{"a":1}\n```'), '{"a":1}',
   'stripRaw removes think block + code fences');
eq(stripRaw('```\nplain\n```'), 'plain', 'stripRaw still removes bare code fences');

// ── (7) The JSON extractors survive a preceding reasoning block ──────────────────
{
  const obj = extractJSON('<think>let me build the object</think>\n{"topic":"Tiere","n":3}');
  eq(obj.topic, 'Tiere', 'extractJSON parses object after a think block');
  eq(obj.n, 3, 'extractJSON keeps numeric field after a think block');
  const arr = extractArray('reasoning about the list</think>\n[{"target":"Katze","source":"cat"}]');
  eq(arr[0].target, 'Katze', 'extractArray parses array after an orphan-close think block');
}

// A reasoning block that truncates before the JSON must NOT silently yield a bogus parse —
// stripThink empties it, and extractJSON then fails loudly (caller retries/errors).
assert.throws(() => extractJSON('<think>I will now produce the JSON but got cut off'),
  /No JSON object found/, 'truncated-think JSON surfaces as a clean parse failure, not garbage');

console.log('  unit-strip-think: all assertions passed');
