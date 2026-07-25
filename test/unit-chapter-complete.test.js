// unit-chapter-complete.test.js
// v69_l — ONE definition of "chapter complete" (roadmap item).
//
// The app had two, and they disagreed:
//   • `setComplete()` — every counted lesson played AND coverage at or above the pass mark. Honest,
//     but only authoritative for the ACTIVE topic, because coverage reads live state.
//   • "all lessons carry a done-flag" — what the storyline lock, the green dot and the completion
//     card's story-progress row used for every OTHER chapter.
// So a chapter could unlock its successor, show a green dot and count toward the storyline total
// while its own completion card said "keep going" — the reported case: three lessons flagged done,
// coverage 10/34, pass mark 80%.
//
// Recomputing coverage for other chapters would mean swapping APP.lessonData and re-deriving every
// question universe on each storyline render. Instead the verdict is PERSISTED when computable and
// read back when not, with a staleness check so a chapter that CHANGES SHAPE (a lesson added or
// removed — exactly what the user did) falls back rather than trusting an old stamp.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}

// Build chapterComplete with its real dependencies; setComplete is stubbed so each case controls
// the "live" verdict for the active topic independently of coverage machinery.
function make(APP, opts = {}) {
  const src = [ext('_chapterDoneMap'), ext('_recordChapterDone'), ext('chapterComplete')].join('\n');
  return new Function('APP', 'countedLessons', 'setComplete', 'saveProg',
    src + '\nreturn { chapterComplete, _recordChapterDone, _chapterDoneMap };')(
    APP,
    (d) => (d.lessons || []).filter(L => !L._hidden),
    opts.setComplete || (() => false),
    opts.saveProg || (() => {}));
}
const chapter = (topic, n, extra = {}) => ({
  topic, id: 'tp_' + topic,
  lessons: Array.from({ length: n }, (_, i) => ({ id: String(i + 1), type: i ? 'word_forms' : 'vocab' })),
  ...extra,
});

// ── 1. The active topic is decided LIVE, not by flags ────────────────────────
{
  const ch = chapter('Active', 3);
  const APP = { lessonData: ch, progress: { completed: { Active: { 1: {}, 2: {}, 3: {} } } } };
  // Every lesson flagged done, but coverage is below the mark → setComplete says false.
  let m = make(APP, { setComplete: () => false });
  assert.strictEqual(m.chapterComplete(ch), false,
    'the reported case: all lessons flagged done but below the pass mark → NOT complete');
  m = make(APP, { setComplete: () => true });
  assert.strictEqual(m.chapterComplete(ch), true, 'at or above the mark → complete');
}
console.log('  active topic: decided by the live rule, not by done-flags: OK');

// ── 2. Other chapters read the persisted verdict ─────────────────────────────
{
  const other = chapter('Other', 3);
  const APP = { lessonData: chapter('Elsewhere', 1), progress: { completed: { Other: { 1: {}, 2: {}, 3: {} } } } };
  let saves = 0;
  const m = make(APP, { saveProg: () => { saves++; } });

  // Without a stamp: falls back to done-flags (historical behaviour, never LESS permissive).
  assert.strictEqual(m.chapterComplete(other), true, 'no stamp → done-flag fallback');

  // Record "not complete" for it (as the card would when the learner is below the mark).
  const prevActive = APP.lessonData;
  APP.lessonData = other;
  m._recordChapterDone(other, false);
  APP.lessonData = prevActive;
  assert.strictEqual(m.chapterComplete(other), false,
    'a recorded "below the mark" verdict overrides the flags for a non-active chapter');
  assert.strictEqual(saves, 1, 'recording persists');

  // Recording the same verdict again must not re-persist (setComplete runs inside render paths).
  m._recordChapterDone(other, false);
  assert.strictEqual(saves, 1, 'an unchanged verdict does not write again');
  m._recordChapterDone(other, true);
  assert.strictEqual(saves, 2, 'a changed verdict does write');
  assert.strictEqual(m.chapterComplete(other), true, 'and is read back');
}
console.log('  other chapters: persisted verdict wins; writes only on change: OK');

// ── 3. Staleness: a chapter that changes shape is not trusted ────────────────
// This is the case the user actually created — adding a mixed lesson to a finished chapter.
{
  const ch = chapter('Grew', 3);
  const APP = { lessonData: ch, progress: { completed: { Grew: { 1: {}, 2: {}, 3: {} } } } };
  const m = make(APP, { setComplete: () => true });
  m._recordChapterDone(ch, true);
  APP.lessonData = chapter('Elsewhere', 1);              // make it a non-active chapter
  assert.strictEqual(m.chapterComplete(ch), true, 'the fresh stamp is used');

  // A teacher adds a lesson: the stamp's lesson count no longer matches.
  const grown = chapter('Grew', 4);
  assert.strictEqual(m.chapterComplete(grown), false,
    'a stale stamp is ignored; the new lesson has no done-flag, so the chapter is incomplete again');
  // …and once the learner finishes the new lesson, the flags agree again.
  APP.progress.completed.Grew['4'] = {};
  assert.strictEqual(m.chapterComplete(grown), true, 'finishing the added lesson completes it again');
}
console.log('  staleness: adding a lesson invalidates the stamp (the reported scenario): OK');

// ── 4. Hidden lessons and empty chapters ─────────────────────────────────────
{
  const APP = { lessonData: chapter('Elsewhere', 1), progress: { completed: { H: { 1: {} } } } };
  const m = make(APP);
  const withHidden = { topic: 'H', lessons: [{ id: '1' }, { id: '2', _hidden: true }] };
  assert.strictEqual(m.chapterComplete(withHidden), true, 'hidden lessons are not required');
  assert.strictEqual(m.chapterComplete({ topic: 'Empty', lessons: [] }), false, 'an empty chapter is never complete');
  assert.strictEqual(m.chapterComplete(null), false, 'a missing chapter is never complete');
}
console.log('  hidden lessons excluded; empty/missing chapters are not complete: OK');

// ── 5. Every consumer uses the shared reader ─────────────────────────────────
{
  // The storyline lock chain.
  assert.ok(/const _chapterComplete = \(t\) => chapterComplete\(byTopic\[t\]\);/.test(html),
    'the storyline lock uses the shared reader');
  // The storyline progress / green dot.
  assert.ok(/if \(chapterComplete\(s\)\) doneChapters\+\+;/.test(html),
    'the storyline progress counts chapters with the shared reader');
  // The completion card's story-progress row, where the whole chapter is available.
  assert.ok(/if \(_chLessons\) \{ if \(chapterComplete\(ch\)\) doneCh\+\+; continue; \}/.test(html),
    'the story-progress row uses it whenever the chapter has lessons[]');
  // setComplete records on EVERY exit — via a wrapper, so a future edit cannot miss one.
  assert.ok(/function setComplete\(d\) \{\s*const v = _setCompleteRaw\(d\);/.test(html),
    'setComplete is a thin recording wrapper around the rule');
  assert.ok(/function _setCompleteRaw\(d\) \{/.test(html), 'the rule itself is intact');
  // The stamp carries the shape it was valid for.
  assert.ok(/m\[d\.topic\] = \{ done: !!done, n, at: new Date\(\)\.toISOString\(\) \};/.test(html),
    'the stamp records the counted-lesson count for staleness detection');
}
console.log('  all consumers share one reader; setComplete records via a wrapper: OK');

console.log('unit-chapter-complete: ALL PASSED');
