// unit-replay-target.test.js
// v78_l (user testing notes) — Replay targets the LEAST-COVERED lesson, not the first short one.
//
// User: "the replay button plays only comprehension lessons after a lesson is complete. We would
// also want to replay other lessons from the same chapter, preferably those that haven't been seen
// before. Is this request in conflict with the definition of this button?"
//
// Answered: no. Replay is `repeatForCoverage` — its defined job is to raise COVERAGE, so a lesson at
// 100% is correctly skipped, because replaying it raises nothing. But an UNPLAYED lesson is not at
// 100%, it is at ZERO. "Prefer ones not yet seen" is therefore not a competing rule, it is the
// strongest case of the rule already there. Only the ORDER was wrong: the scan returned the first
// coverage-short lesson in DOCUMENT order, and a comprehension lesson sits early and stays short
// (since `v77_t` a repeat asks only the questions still unanswered), so it won every scan and later
// unplayed lessons were never reached.
//
// This file drives the PRODUCT function against a stubbed coverage map, because the real coverage
// depends on the solved ledger and the corpus — neither of which should decide whether the ordering
// rule is correct.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));

// `cov` maps lesson index -> {solved,total}. Anything absent is treated as fully covered.
function client(lessons, cov) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)};
    APP.lessonData = { topic: 'T', lessons: ${JSON.stringify(lessons)} };
    countedLessons = (d) => d.lessons.filter(L => L && L.type !== 'mixed');
    lessonCoverage = (i) => (${JSON.stringify(cov)})[i] || { solved: 1, total: 1 };
    // v80_b: these sections are about ORDERING, so the story gate is held OPEN explicitly. It used
    // to be open only by accident — this fixture has no story and no progress, so the real
    // storyUnlocked() said "locked", and once the scan started honouring that (v80_b) the ordering
    // sections would have been measuring the gate instead of the order. Section 8 asserts the gate.
    storyUnlocked = () => true;
    true;`, 'seed');
  return C;
}
const pick = (C) => C.run(`_firstCoverageShortLessonIdx()`, 'pick');

const LESSONS = [
  { id: 'l0', type: 'comprehension' },   // early, and perpetually short
  { id: 'l1', type: 'standard' },
  { id: 'l2', type: 'standard' },        // never played
  { id: 'l3', type: 'mixed' },           // never a Replay target
];

// ── 1. The user's case: an unplayed lesson beats an early, partly-done one ──
{
  const C = client(LESSONS, {
    0: { solved: 9, total: 10 },   // comprehension, 90% — first in document order
    1: { solved: 5, total: 5 },    // finished
    2: { solved: 0, total: 8 },    // NEVER PLAYED
  });
  assert.strictEqual(pick(C), 2,
    'Replay goes to the unplayed lesson, not the early comprehension one that merely comes first');
  console.log('  an unplayed lesson outranks an early, nearly-finished one');
}

// ── 2. Non-vacuity: this is an ORDER change, not "always pick the last" ─────
// Reverse the coverage and the answer must move with it, or §1 could pass on a rule that always
// returns the highest index.
{
  const C = client(LESSONS, {
    0: { solved: 0, total: 10 },   // comprehension, never played
    1: { solved: 5, total: 5 },
    2: { solved: 7, total: 8 },    // nearly done
  });
  assert.strictEqual(pick(C), 0,
    'when the comprehension lesson IS the least covered, Replay goes there — the rule follows ' +
    'coverage, not position');
  console.log('  the choice tracks coverage in both directions');
}

// ── 3. Fraction, not remaining count ───────────────────────────────────────
// A 4-question lesson never played should outrank a 40-question one that is 90% done, even though
// the latter has more questions outstanding (4 vs 4 — deliberately equal, so only the rule decides).
{
  const C = client(LESSONS, {
    0: { solved: 36, total: 40 },  // 90%, 4 remaining
    1: { solved: 5, total: 5 },
    2: { solved: 0, total: 4 },    // 0%, 4 remaining
  });
  assert.strictEqual(pick(C), 2,
    'with the same number of questions left, the LESS COVERED lesson wins — the rule is a fraction');
  console.log('  equal remainders are broken by coverage fraction, not by count');
}

// ── 4. Fully covered lessons are still skipped — the button\'s definition ───
// This is what makes the change compatible with "Replay raises coverage" rather than a redefinition
// of the button.
{
  const C = client(LESSONS, { 0: { solved: 10, total: 10 }, 1: { solved: 5, total: 5 }, 2: { solved: 8, total: 8 } });
  assert.strictEqual(pick(C), -1,
    'nothing is short, so Replay has no target — it does not invent one by re-asking solved work');
  console.log('  a fully covered chapter yields no target');
}

// ── 5. `mixed` is never a target, and a zero-total lesson is not either ────
{
  const C = client(LESSONS, {
    0: { solved: 4, total: 4 }, 1: { solved: 5, total: 5 }, 2: { solved: 3, total: 3 },
    3: { solved: 0, total: 9 },     // the mixed lesson, wide open — must still be ignored
  });
  assert.strictEqual(pick(C), -1, 'a mixed lesson is never a Replay target, however short it is');

  const C2 = client(LESSONS, { 0: { solved: 0, total: 0 }, 1: { solved: 5, total: 5 }, 2: { solved: 2, total: 2 } });
  assert.strictEqual(pick(C2), -1,
    'a lesson with no questions at all is not a target — 0/0 is not "least covered"');
  console.log('  mixed lessons and empty lessons are excluded');
}

// ── 6. Ties keep document order ─────────────────────────────────────────────
// So a chapter whose lessons are equally covered behaves exactly as it did before this change,
// which is what keeps this an ordering fix rather than a reshuffle.
{
  const C = client(LESSONS, {
    0: { solved: 1, total: 4 }, 1: { solved: 5, total: 5 }, 2: { solved: 2, total: 8 },  // both 25%
  });
  assert.strictEqual(pick(C), 0, 'an exact tie resolves to the earlier lesson, as before');
  console.log('  ties keep document order');
}

// ── 7. A throwing coverage call does not abort the scan ────────────────────
// `lessonCoverage` is wrapped in a try per lesson; one bad lesson must not cost the whole chapter
// its Replay target.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)};
    APP.lessonData = { topic: 'T', lessons: ${JSON.stringify(LESSONS)} };
    countedLessons = (d) => d.lessons.filter(L => L && L.type !== 'mixed');
    lessonCoverage = (i) => { if (i === 0) throw new Error('boom'); return { solved: 0, total: 5 }; };
    true;`, 'seed');
  assert.strictEqual(C.run(`_firstCoverageShortLessonIdx()`), 1,
    'a lesson whose coverage throws is skipped and the scan continues');
  console.log('  a throwing coverage call skips that lesson only');
}

// ── 8. v80_b: a story-gated lesson is not a Replay target while the story is LOCKED ─────────
// implementation_plan.md §C1, the user's second report: "via the replay button or otherwise, I
// could play the comprehension lessons BEFORE the chapter-story was unlocked." The resume scan
// (_firstUnfinishedLessonIdx) had applied this rule since v71_s; this scan never did, so Replay
// walked straight past the gate. Both now ask the one shared rule, _storyLockedLesson.
//
// Measured on the corpus before the fix (`build_history/probe_gates_v80c1.js`): from an ORDINARY
// half-played chapter, 27 of 94 chapters with a story-gated lesson sent Replay into one. 0 after.
{
  const cov = { 0: { solved: 0, total: 10 }, 1: { solved: 5, total: 5 }, 2: { solved: 7, total: 8 } };
  // Locked: the comprehension lesson is the least covered, so ONLY the gate can keep Replay off it.
  const CL = loadClient({ quiet: true });
  CL.run(`LANGS = ${JSON.stringify(LANGS)};
    APP.lessonData = { topic: 'T', lessons: ${JSON.stringify(LESSONS)} };
    countedLessons = (d) => d.lessons.filter(L => L && L.type !== 'mixed');
    lessonCoverage = (i) => (${JSON.stringify(cov)})[i] || { solved: 1, total: 1 };
    storyUnlocked = () => false;
    true;`, 'seed');
  assert.strictEqual(CL.run(`_firstCoverageShortLessonIdx()`), 2,
    'story LOCKED: Replay skips the comprehension lesson even though it is the least covered');
  // Non-vacuity, and the discriminator: with the gate OPEN the same fixture picks it. Without this
  // the section would pass on a rule that never offers a gated lesson at all.
  const CU = loadClient({ quiet: true });
  CU.run(`LANGS = ${JSON.stringify(LANGS)};
    APP.lessonData = { topic: 'T', lessons: ${JSON.stringify(LESSONS)} };
    countedLessons = (d) => d.lessons.filter(L => L && L.type !== 'mixed');
    lessonCoverage = (i) => (${JSON.stringify(cov)})[i] || { solved: 1, total: 1 };
    storyUnlocked = () => true;
    true;`, 'seed');
  assert.strictEqual(CU.run(`_firstCoverageShortLessonIdx()`), 0,
    'story UNLOCKED: the same fixture picks the comprehension lesson — the gate is what differs');
  // And teacher mode is exempt, as it is everywhere else in this rule.
  CL.run(`APP._teacherMode = true; true;`);
  assert.strictEqual(CL.run(`_firstCoverageShortLessonIdx()`), 0,
    'teacher mode is exempt from the story gate here too');
  console.log('  story-gated lessons are not Replay targets while the story is locked');
}

console.log('unit-replay-target: ALL PASSED');
