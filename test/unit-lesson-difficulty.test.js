// unit-lesson-difficulty.test.js
// v56 — an added lesson must RECORD the difficulty it was generated at.
// User: "I generated a new lesson for 'Constanze am Meer' with diff=3, but it is displayed as
// beginner level." Diagnosis: the display was never wrong — the lesson list renders
// `L.difficulty || topicDiff`, and fell back because the lesson carried NO difficulty. The
// add-lesson route computed `diff` (request → topic → 2), used it for the prompt, and dropped it.
// Only math/intro_script lessons stored it (they need it at play time), which hid the gap.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. The add-lesson route stores the difficulty it generated at ─────────────
assert.ok(/const diff\s*=\s*Math\.max\(1, Math\.min\(3, parseInt\(rawDiff, 10\) \|\| saved\.difficulty \|\| 2\)\)/.test(server),
  'add-lesson still derives difficulty: request → topic → 2 (clamped 1..3)');
assert.ok(/const newLesson = \{ difficulty: diff, \.\.\.result\.lesson, id: newLessonId \}/.test(server),
  'the added lesson RECORDS that difficulty (this is the fix)');
// Spread order matters: a generator that sets its own difficulty (math/intro_script) must still win.
const spreadIdx = server.indexOf('{ difficulty: diff, ...result.lesson');
assert.ok(spreadIdx > 0, 'difficulty is written BEFORE the spread, so a generator-supplied value overrides it');

// ── 2. The display reads the LESSON's difficulty, falling back to the topic ───
// (Unchanged — asserted so the fix can't be "undone" by someone hard-coding the topic difficulty.)
assert.ok(/DIFF_SHORT\(\)\[L\.difficulty \|\| topicDiff\]/.test(client),
  'the lesson list shows the lesson difficulty, falling back to the topic');

// ── 3. Behaviour: an advanced lesson on a beginner topic now shows advanced ───
{
  const label = (L, topicDiff) => (L.difficulty || topicDiff);   // the display's expression
  assert.strictEqual(label({ difficulty: 3 }, 1), 3, 'advanced lesson on a beginner topic → advanced (was 1)');
  assert.strictEqual(label({}, 1), 1, 'a lesson with no difficulty still falls back to the topic (old lessons)');
  assert.strictEqual(label({ difficulty: 1 }, 3), 1, 'a beginner lesson on an advanced topic → beginner');
}

// ── 4. Existing corpus lessons stay valid (no backfill, fallback covers them) ─
{
  const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  let withDiff = 0, total = 0, bad = 0;
  for (const t of lessons.topics) for (const L of (t.lessons || [])) {
    total++;
    if (L.difficulty !== undefined) { withDiff++; if (!(L.difficulty >= 1 && L.difficulty <= 3)) bad++; }
  }
  assert.strictEqual(bad, 0, 'every stored lesson difficulty is within 1..3');
  assert.ok(total > 0 && withDiff >= 0, `corpus: ${withDiff}/${total} lessons carry a difficulty (the rest fall back to the topic)`);
}

console.log('  lesson difficulty: add-lesson records it; display reads lesson→topic; old lessons fall back');
console.log('unit-lesson-difficulty: ALL PASSED');
