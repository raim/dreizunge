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
  // v71_s: the rule gained an optional `skipStoryGated` parameter so the story-unlock gate can be
  // measured over the same rule with the comprehension lessons removed, rather than a second copy
  // of it. The assertion still pins what it always pinned — ONE shared rule function — and stays
  // deliberately strict about there being exactly one.
  assert.ok(/function _setCompleteRaw\(d(, skipStoryGated)?\) \{/.test(html), 'the rule itself is intact');
  assert.strictEqual((html.match(/function _setCompleteRaw\(/g) || []).length, 1,
    'and there is exactly one of it');
  // storyUnlocked is the narrowed gate and must NOT record a chapter-done stamp — it is not
  // chapter completion, and stamping it would make a chapter read as finished before its
  // comprehension lesson had been played at all.
  assert.ok(/function storyUnlocked\(d\) \{/.test(html), 'the narrowed story gate exists');
  const _su = html.slice(html.indexOf('function storyUnlocked(d) {'));
  assert.ok(!/_recordChapterDone/.test(_su.slice(0, _su.indexOf('function _setCompleteRaw'))),
    'storyUnlocked does not stamp chapter completion');
  // The stamp carries the shape it was valid for.
  assert.ok(/m\[d\.topic\] = \{ done: !!done, n, at: new Date\(\)\.toISOString\(\) \};/.test(html),
    'the stamp records the counted-lesson count for staleness detection');
}
console.log('  all consumers share one reader; setComplete records via a wrapper: OK');

// ── v71_w: the storyline page had a SECOND rule, and it diverged both ways ──
// v69_l consolidated "is this chapter complete" onto one reader — but only where it was looked
// for. The storyline page kept two raw `every(ls => done[ls.id])` scans: the connector line
// between chapter cards, and the progress bar's green-at-100% colour. Nothing failed, because on
// the bundled corpus they happened to agree. Measured, they do not:
//
//   • too STRICT  — a mixed-driven chapter with every VISIBLE lesson done reads as unfinished,
//                   because the hidden pooled siblings have no done-flags (the v48 rule that
//                   countedLessons already encodes).  shared: true,  raw: false
//   • too PERMISSIVE — a chapter with every done-flag but coverage below the pass mark reads as
//                   finished.  shared: false,  raw: true   ← the exact v69_l bug, still live here
//
// Both are quiet: a connector line or a bar colour that lies about an unfinished chapter is only
// visible in a browser. Asserted as BEHAVIOUR (both directions) plus a source pin that no raw
// scan comes back. This block needs a live client, which the rest of this file does not — so it
// builds its own rather than changing the harness the other sections rely on.
{
  const { loadClient } = require('./lib-dom');
  const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

  const seed = (t, completed, active) => C.run(`
    APP.savedList = ${JSON.stringify([t])};
    APP.lessonData = ${JSON.stringify(active ? t : null)};
    APP.lang = 'de'; APP.srcLang = 'en';
    APP.info = { backend:'none', canGenerate:false, coverageThreshold: 0.8 };
    APP.progress = { completed: ${JSON.stringify(completed)}, solved: {}, learned: {}, chapterDone: {} };
    APP.progress.solved[${JSON.stringify(t.topic)}] = {};
    APP.cur.lessonIdx = 0;
    APP._teacherMode = false;
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-' + t.topic);
  // The rule the storyline page USED to apply, reproduced here so the divergence is measured
  // rather than asserted from the diff.
  const rawScan = (t, completed) => {
    const done = completed[t.topic] || {};
    const sets = t.lessons || [];
    return sets.length > 0 && sets.every(ls => done[ls.id]);
  };

  // (a) too strict: a hidden (pooled) sibling has no done-flag, but it is not counted.
  const tHidden = { topic: 'CmpHidden', lang: 'de', srcLang: 'en', lessons: [
    { id: 'a', vocab: [{ target: 'Haus', source: 'house' }] },
    { id: 'h', vocab: [{ target: 'Katze', source: 'cat' }], _hidden: true } ] };
  const cHidden = { CmpHidden: { a: { correct: 1, total: 1 } } };
  seed(tHidden, cHidden, false);
  const sharedHidden = C.run(`chapterComplete(${JSON.stringify(tHidden)})`);
  assert.strictEqual(sharedHidden, true, 'shared reader: hidden lessons do not block completion');
  assert.strictEqual(rawScan(tHidden, cHidden), false,
    'a raw done-flag scan would say unfinished — the divergence');

  // (b) too permissive: every done-flag present, coverage below the pass mark.
  const tMark = { topic: 'CmpMark', lang: 'de', srcLang: 'en', coverageTarget: 0.8, lessons: [
    { id: 'x', vocab: [{ target: 'Haus', source: 'house' }, { target: 'Katze', source: 'cat' },
                       { target: 'Baum', source: 'tree' }] } ] };
  const cMark = { CmpMark: { x: { correct: 1, total: 6 } } };
  seed(tMark, cMark, true);
  const sharedMark = C.run(`chapterComplete(APP.lessonData)`);
  assert.strictEqual(sharedMark, false, 'shared reader: below the pass mark is NOT complete');
  assert.strictEqual(rawScan(tMark, cMark), true,
    'a raw done-flag scan would say finished — the v69_l bug, still live on the storyline page');

  // (c) Source: the storyline page must not reintroduce either scan.
  const sl = html.slice(html.indexOf('function _renderChapterCard'));
  const card = sl.slice(0, 9000);   // the function is dense; 4000 chars stopped before the bar
  assert.ok(/const _prevAllDone = _chapterComplete\(prevTopic\);/.test(card),
    'the connector line reads the shared rule');
  assert.ok(/const _chDone = _chapterComplete\(topic\);/.test(card),
    'and so does the bar colour — 100% of done-flags is not the same as complete');
  assert.ok(!/_prevSets\.every\(ls => _prevDone\[ls\.id\]\)/.test(html),
    'the raw previous-chapter scan is gone');
  assert.ok(!/_pct >= 100 \? 'var\(--green\)'/.test(html),
    'the bar no longer colours itself complete from a raw percentage');
  // The FRACTION stays a fraction — a different question, legitimately — but over counted lessons.
  assert.ok(/countedLessons\(s \|\| \{ lessons: \[\] \}\)/.test(card),
    'the progress fraction counts the lessons a learner can actually play');
  console.log('  storyline page: connector line + bar colour read the one rule (both divergences pinned)');
}

console.log('unit-chapter-complete: ALL PASSED');
