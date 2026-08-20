// unit-hidden-lessons.test.js
// Bug: a teacher-hidden lesson (_hidden) leaked into the learner's path in static (non-teacher)
// mode and, being unsolvable there, blocked progress to the next lesson and prevented story
// unlock / 100% progress. Fix: in non-teacher mode hidden lessons are omitted from the path and
// from all progress/lock/unlock/next computations; in teacher mode they still show and count.
// These assertions pin the source wiring; §4 additionally renders the real lesson path (buildPath)
// into a stub DOM and reads the nodes it produces, so the lock claims are checked as behaviour too.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
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
  // AI-example (review-only) lessons are hidden from the learner path regardless of position.
  const dAi = { lessons: [ { type:'standard', _aiExamples:true, sentences:[{}], id:'ai' }, { type:'standard', id:'s' } ] };
  assert.strictEqual(lcf(dAi, dAi.lessons[0]), false, 'AI-example lesson is hidden from the learner path (review-only)');
  assert.strictEqual(lcf(dAi, dAi.lessons[1]), true, 'a normal lesson beside it stays visible');
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
// v71_s: the branch now measures over `_counted`, which is countedLessons(d) for chapter
// completion and the story-gated-free subset for the story-unlock gate. Both spellings are pinned
// so the derivation cannot quietly stop going through countedLessons.
assert.ok(/const _counted = skipStoryGated \? storyUnlockLessons\(d\) : countedLessons\(d\);/.test(html),
  'the counted set is derived from countedLessons (or its story-gated-free subset)');
assert.ok(/_counted\.every\(L => done\[L\.id\]\)/.test(html),
  'setComplete: locked-path branch = every counted lesson done');
assert.ok(/function storyUnlockLessons\(d\) \{ return countedLessons\(d\)\.filter/.test(html),
  'the narrowed set is a FILTER of countedLessons, not a second visibility rule');

// 2. Progress count, story-unlock, next-up, render, and the continue jump all route through it.
assert.ok(/_countedLessons = countedLessons\(d\)/.test(html), 'progress count uses countedLessons(d)');
// v71_s: the lesson-set page's story section expands on the narrowed gate, for the same reason the
// result card does — the story must be readable before the comprehension lesson that asks about it.
assert.ok(/const allDone=storyUnlocked\(d\)/.test(html), 'story unlock uses storyUnlocked(d)');
assert.ok(/_lessonCounts = \(L\) => lessonCountsFor\(d, L\)/.test(html), 'render-loop predicate aliases the shared helper');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&_lessonCounts\(L\)\)/.test(html),
  'next-up skips non-counted lessons (in-render)');
assert.ok(/findIndex\(L=>!done\[L\.id\]&&lessonCountsFor\(d,L\)\)/.test(html),
  'continue/resume jump uses the shared helper (respects hidden + mixed-only)');
assert.ok(/if\(!_lessonCounts\(L\)\) return;/.test(html),
  'render loop omits non-counted lessons');
assert.ok(!/_mixedOnly/.test(html), 'the old inline _mixedOnly definitions are gone (consolidated)');

// 3. v81_i (user ruling): the sequential "previous lesson done" lock was REMOVED from the path —
//    it was already unenforced everywhere except this render (_firstUnfinishedLessonIdx's
//    _playable never consulted it, tapWord bypasses it: 438 of 447 taps, 98%, measured against a
//    fresh learner). What must NOT go with it is the STORY GATE, fixed at v80_b after two dead-end
//    readings — it is now the only lock a node can carry.
assert.ok(/isLocked=_storyLocked,/.test(html),
  'the sequential lock is gone: isLocked is exactly the story gate, nothing ORed onto it — ' +
  '_prevDone may still exist (it now only feeds the connector-line styling), but not here');
assert.ok(/const _storyLocked = _isStoryGatedLesson\(L\) && !APP\._teacherMode && !storyUnlocked\(d\);/.test(html),
  'a story-gated lesson is locked until the story unlocks (teachers exempt) — unchanged by v81_i');
assert.ok(!/isLocked=i>0&&!done\[d\.lessons\[i-1\]\.id\]/.test(html),
  'old i-1-based lock removed');

// 4. The claim above is about BEHAVIOUR, not source text — a regex pinning source text for a claim
//    about behaviour cannot fail even when the render disagrees (this cost v80_c and v80_s two
//    releases). So render the real path and read the DOM it produces.
{
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

  // counts(t, L) mirrors buildPath's own _lessonCounts = L => lessonCountsFor(d, L) exactly, so
  // "visible" below can never desync from what the render actually omits (mixed-lesson pooling
  // hides earlier lessons independent of the _hidden flag — filtering on _hidden alone would have
  // gotten row indices wrong the moment the fixture happened to contain a mixed lesson).
  const counts = (t, L) => C.run(`lessonCountsFor(${JSON.stringify(t)}, ${JSON.stringify(L)})`, 'cf');

  // Fixture chosen BY SHAPE, not picked once and hand-verified: a chapter where, among the COUNTED
  // (visible) lessons only — raw array position is not what matters, a mixed lesson can hide
  // earlier ones — there is (i) a non-story-gated lesson that is NOT the first counted lesson, so
  // it stands in for "previous counted lesson undone", and (ii) a story-gated one, so the gate
  // itself is exercised in the same render.
  // ⚠️ "not first in the RAW lesson array" is not enough: the old sequential lock exempted only the
  // first COUNTED node (_firstNode), so a candidate that is merely raw-index > 0 but happens to
  // render as row 0 (everything before it hidden by mixed-pooling) passes vacuously under the very
  // mutation this section exists to catch — found by mutation-testing this guard, not assumed.
  let fixture = null;
  for (const t of store.topics) {
    const ls = t.lessons || [];
    if (ls.length < 3) continue;
    const vis = ls.filter(L => L && counts(t, L));
    if (vis.length < 2) continue;
    const gated = vis.find(L => C.run(`_isStoryGatedLesson(${JSON.stringify(L)})`, 'g'));
    if (!gated) continue;
    const later = vis.slice(1).find(L => !C.run(`_isStoryGatedLesson(${JSON.stringify(L)})`, 'g2'));
    if (!later) continue;
    fixture = { t, gated, later };
    break;
  }
  assert.ok(fixture, 'the corpus has a chapter with a story-gated lesson and a later non-gated, ' +
    'non-first counted lesson — without one this section proves nothing');
  const { t: topic, gated: gatedL, later: laterL } = fixture;
  const gatedIdx = topic.lessons.indexOf(gatedL), laterIdx = topic.lessons.indexOf(laterL);

  function render(extra = '') {
    C.run(`
      APP.savedList = ${JSON.stringify((store.topics || []).map(x => ({ id: x.id, topic: x.topic, lang: x.lang, srcLang: x.srcLang, lessons: x.lessons })))};
      APP.storylines = ${JSON.stringify(store.storylines || [])};
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} };
      APP._teacherMode = false;
      ${extra}
      buildPath(); true;`, 'render-path');
    // Not querySelectorAll('.lesson-node'): these nodes get their class from a direct
    // `node.className = …` property assignment (buildPath, not innerHTML markup), and the stub
    // DOM's classList/selector matching is only kept in sync for PARSED markup — so a class
    // selector silently returns nothing for a programmatically-set className. Filtering the raw
    // string is what's actually true of the rendered node either way.
    const el = C.document.getElementById('lesson-path');
    return (el.children || []).filter(c => String(c.className || '').includes('lesson-node'));
  }
  const isLockedNode = (n) => String(n.className || '').split(/\s+/).includes('locked');
  const visible = (topic.lessons || []).filter(L => L && counts(topic, L));
  const rowOf = (L) => visible.indexOf(L);

  // (a) a non-story-gated lesson is clickable regardless of whether the previous lesson is done —
  //     nothing is marked done at all here, which under the OLD sequential rule would have locked
  //     every node after the first.
  {
    const nodes = render();
    assert.strictEqual(nodes.length, visible.length,
      'one rendered node per counted lesson — otherwise rowOf() indexes the wrong node');
    const later = topic.lessons[laterIdx];
    const n = nodes[rowOf(later)];
    assert.ok(n, 'the later non-gated lesson has a rendered node');
    assert.ok(!isLockedNode(n),
      'a non-story-gated lesson is NOT locked even though the previous lesson is undone');
    assert.strictEqual(typeof n.onclick, 'function', 'and it is clickable');
  }

  // (b) a story-gated lesson stays locked while the story is locked, learner mode.
  {
    const nodes = render();
    assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`, 'u'), false,
      'the fixture starts with the story locked, or (b) proves nothing');
    const gated = topic.lessons[gatedIdx];
    const n = nodes[rowOf(gated)];
    assert.ok(n, 'the story-gated lesson has a rendered node');
    assert.ok(isLockedNode(n), 'it IS locked while the story is locked');
    assert.notStrictEqual(typeof n.onclick, 'function', 'and carries no click handler');
  }

  // (c) teacher mode is exempt from the story gate too.
  {
    const nodes = render('APP._teacherMode = true;');
    const gated = topic.lessons[gatedIdx];
    const n = nodes[rowOf(gated)];
    assert.ok(!isLockedNode(n), 'in teacher mode the story-gated node is NOT locked');
    assert.strictEqual(typeof n.onclick, 'function', 'and is clickable');
  }
  console.log(`  lesson-path lock (rendered): "${topic.topic}" — non-gated lesson ${laterIdx} clickable ` +
    `with nothing done, story-gated lesson ${gatedIdx} locked/learner, open/teacher: OK`);
}
console.log('  hidden lessons: omitted for learner, visible for teacher: OK');

// 5. Bug: a visible vocab lesson's cross-lesson REVIEW pool must exclude hidden lessons (non-
//    teacher), or a learner gets quizzed on words from a lesson they can't see.
assert.ok(/const prevV=d\.lessons\.slice\(0,lessonIdx\)\.filter\(_vis\)\.flatMap/.test(html),
  'standard exercises filter the prev-vocab review pool by visibility');
assert.ok(/_vis = \(L\) => APP\._teacherMode \|\| !L\._hidden/.test(html),
  'standard exercises define a visibility filter for the review pool');
console.log('  standard review pool excludes hidden lessons (non-teacher): OK');

console.log('unit-hidden-lessons: ALL PASSED');
