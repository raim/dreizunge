// unit-hidden-lessons.test.js
// Bug: a teacher-hidden lesson (_hidden) leaked into the learner's path in static (non-teacher)
// mode and, being unsolvable there, blocked progress to the next lesson and prevented story
// unlock / 100% progress. Fix: in non-teacher mode hidden lessons are omitted from the path and
// from all progress/lock/unlock/next computations; in teacher mode they still show and count.
// These assertions pin the source wiring + the lock-chain semantics (DOM render is browser-tested).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1. The counts helper exists and is mode-aware.
assert.ok(/_lessonCounts\s*=\s*\(L\)\s*=>\s*APP\._teacherMode\s*\|\|\s*!L\._hidden/.test(html),
  '_lessonCounts = teacher-mode OR not-hidden');

// 2. Progress count, story-unlock, next-up, and render all route through the counts helper.
assert.ok(/_countedLessons\s*=\s*\(APP\.lessonData\?\.lessons\|\|\[\]\)\.filter\(_lessonCounts\)/.test(html),
  'progress count filters by _lessonCounts');
assert.ok(/allDone=d\.lessons\.filter\(_lessonCounts\)\.every/.test(html),
  'story unlock filters by _lessonCounts');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&_lessonCounts\(L\)\)/.test(html),
  'next-up skips hidden in non-teacher mode (in-render)');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&\(APP\._teacherMode\|\|!L\._hidden\)\)/.test(html),
  'continue/resume jump skips hidden in non-teacher mode');
assert.ok(/if\(!_lessonCounts\(L\)\) return;/.test(html),
  'render loop omits hidden lessons in non-teacher mode');

// 3. Lock chain no longer keys off the raw previous index (which could be a hidden lesson) but
//    off the previous COUNTED lesson's done state.
assert.ok(/isLocked=!_firstNode&&!_prevDone&&!APP\._teacherMode/.test(html),
  'lock is based on previous counted lesson, not raw i-1');
assert.ok(!/isLocked=i>0&&!done\[d\.lessons\[i-1\]\.id\]/.test(html),
  'old i-1-based lock removed');

// 4. Logic model: a hidden middle lesson must not block the lesson after it (non-teacher).
function lockChain(lessons, doneIds, teacher) {
  const counts = L => teacher || !L._hidden;
  let prevDone = true, first = true; const out = [];
  for (const L of lessons) {
    if (!counts(L)) continue;
    const isDone = doneIds.has(L.id);
    const locked = !first && !prevDone && !teacher;
    out.push({ id: L.id, locked });
    prevDone = isDone; first = false;
  }
  return out;
}
const lessons = [
  { id: 'a' },
  { id: 'h', _hidden: true },   // teacher-hidden, never completed
  { id: 'b' },
];
// Non-teacher: hidden 'h' is dropped; 'a' done → 'b' unlocked (not blocked by 'h').
const nonTeacher = lockChain(lessons, new Set(['a']), false);
assert.deepStrictEqual(nonTeacher.map(x => x.id), ['a', 'b'], 'hidden lesson omitted for learner');
assert.strictEqual(nonTeacher.find(x => x.id === 'b').locked, false, 'next lesson NOT blocked by hidden lesson');
// If 'a' is NOT done, 'b' is legitimately locked (normal gating still works).
assert.strictEqual(lockChain(lessons, new Set(), false).find(x => x.id === 'b').locked, true,
  'normal locking still applies when the real previous lesson is undone');
// Teacher mode: hidden lesson shows and counts; nothing locked (teacher gating off).
const teacher = lockChain(lessons, new Set(['a']), true);
assert.deepStrictEqual(teacher.map(x => x.id), ['a', 'h', 'b'], 'hidden lesson visible to teacher');
assert.ok(teacher.every(x => !x.locked), 'teacher mode never locks');
console.log('  hidden lessons: omitted + non-blocking for learner, visible for teacher: OK');

console.log('unit-hidden-lessons: ALL PASSED');
