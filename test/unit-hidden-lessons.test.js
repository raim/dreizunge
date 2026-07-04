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

// 1. The shared visibility helper exists, is mode-aware AND mixed-aware (single source of truth).
//    v50: a mixed lesson hides only the EARLIER lessons it pools from; the mixed lesson, error
//    hunts, and any lessons AFTER it stay visible. Assert the behaviour, not the exact source.
assert.ok(/function lessonCountsFor\(d, L\)/.test(html), 'shared lessonCountsFor(d, L) helper exists');
assert.ok(/function _firstVisibleMixedIdx\(d\)/.test(html), 'mixed-index helper exists');
{
  // Rebuild lessonCountsFor + its helpers in a sandbox and check the new semantics directly.
  function ext(name){ const at=html.indexOf('function '+name+'('); const b=html.indexOf('{',at); let d=0,i=b; for(;i<html.length;i++){ if(html[i]==='{')d++; else if(html[i]==='}'){ d--; if(!d){ i++; break; } } } return html.slice(at,i); }
  const APPref = { _teacherMode: false };
  // _NEVER_POOLED is a module-level const the helper closes over; inject it.
  const NEVER = "const _NEVER_POOLED = new Set(['mixed','error_hunt','ai_error_hunt']);\n";
  const lcf = new Function('APP', NEVER + ext('_firstVisibleMixedIdx') + '\n' + ext('lessonCountsFor') + '\nreturn lessonCountsFor;')(APPref);
  const d = { lessons: [
    { type:'standard',    id:'a' },    // 0 earlier poolable → hidden
    { type:'grammar',     id:'b' },    // 1 earlier poolable → hidden
    { type:'ai_error_hunt', id:'ae' }, // 2 earlier ERROR HUNT → NOT pooled → stays visible
    { type:'mixed',       id:'m' },    // 3 the mixed lesson → visible
    { type:'standard',    id:'c' },    // 4 later → visible
    { type:'error_hunt',  id:'e' },    // 5 later error hunt → visible
  ] };
  APPref._teacherMode = false;
  assert.strictEqual(lcf(d, d.lessons[0]), false, 'earlier poolable lesson before mixed is hidden');
  assert.strictEqual(lcf(d, d.lessons[1]), false, 'earlier poolable lesson before mixed is hidden (2)');
  assert.strictEqual(lcf(d, d.lessons[2]), true,  'an earlier ERROR HUNT is NOT pooled → stays visible');
  assert.strictEqual(lcf(d, d.lessons[3]), true,  'the mixed lesson itself stays visible');
  assert.strictEqual(lcf(d, d.lessons[4]), true,  'a lesson AFTER the mixed lesson stays visible');
  assert.strictEqual(lcf(d, d.lessons[5]), true,  'a later error-hunt stays visible');
  // An earlier plain error_hunt also stays (both hunt types).
  const d3 = { lessons: [ { type:'error_hunt', id:'eh' }, { type:'standard', id:'s' }, { type:'mixed', id:'m' } ] };
  assert.strictEqual(lcf(d3, d3.lessons[0]), true, 'earlier plain error_hunt stays visible too');
  assert.strictEqual(lcf(d3, d3.lessons[1]), false, 'earlier standard is still hidden');
  // No mixed lesson → all visible.
  const d2 = { lessons: [ { type:'standard', id:'a' }, { type:'error_hunt', id:'e' } ] };
  assert.ok(d2.lessons.every(L => lcf(d2, L)), 'no mixed lesson → classic path, all visible');
  // Teacher mode → everything visible even with a mixed lesson.
  APPref._teacherMode = true;
  assert.ok(d.lessons.every(L => lcf(d, L)), 'teacher mode → everything visible');
  APPref._teacherMode = false;
}
assert.ok(/function setComplete\(d\)/.test(html), 'setComplete(d) exists');
assert.ok(/countedLessons\(d\)\.every\(L => done\[L\.id\]\)/.test(html),
  'setComplete: locked-path branch = every counted lesson done');

// 2. Progress count, story-unlock, next-up, render, and the continue jump all route through it.
assert.ok(/_countedLessons = countedLessons\(d\)/.test(html), 'progress count uses countedLessons(d)');
assert.ok(/const allDone=setComplete\(d\)/.test(html), 'story unlock uses setComplete(d)');
assert.ok(/_lessonCounts = \(L\) => lessonCountsFor\(d, L\)/.test(html), 'render-loop predicate aliases the shared helper');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&_lessonCounts\(L\)\)/.test(html),
  'next-up skips non-counted lessons (in-render)');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&lessonCountsFor\(d,L\)\)/.test(html),
  'continue/resume jump uses the shared helper (respects hidden + mixed-only)');
assert.ok(/if\(!_lessonCounts\(L\)\) return;/.test(html),
  'render loop omits non-counted lessons');
assert.ok(!/_mixedOnly/.test(html), 'the old inline _mixedOnly definitions are gone (consolidated)');

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

// 5. Bug: a visible vocab lesson's cross-lesson REVIEW pool must exclude hidden lessons (non-
//    teacher), or a learner gets quizzed on words from a lesson they can't see.
assert.ok(/const prevV=d\.lessons\.slice\(0,lessonIdx\)\.filter\(_vis\)\.flatMap/.test(html),
  'standard exercises filter the prev-vocab review pool by visibility');
assert.ok(/_vis = \(L\) => APP\._teacherMode \|\| !L\._hidden/.test(html),
  'standard exercises define a visibility filter for the review pool');
console.log('  standard review pool excludes hidden lessons (non-teacher): OK');

console.log('unit-hidden-lessons: ALL PASSED');
