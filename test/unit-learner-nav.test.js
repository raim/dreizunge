// unit-learner-nav.test.js
// v60 — learner UI: skip the lesson-set page for learners; redesign the completion card.
// Contract under test:
//   • _isLearner() = !_canEdit(); loadSaved routes learners past the lesson-set page by resuming
//     at the first unfinished lesson and auto-starting it; teachers keep the page (editing hub).
//   • _firstUnfinishedLessonIdx respects lessonCountsFor and returns -1 on a complete chapter.
//   • _storylineForTopic resolves the deck (preferring APP._slScreen), its ordered chapter
//     topics, and the encoded chain.
//   • The completion card has exactly Next + Back. Next opens the next questions directly
//     (next lesson in chapter → first unfinished lesson of the next chapter → hidden). Back →
//     storyline screen, or landing for a solo chapter. Drill + nav pills are teacher-only.
//   • Chapter complete → the FULL story is shown (not a 200-char teaser).
//   • Both loadSaved implementations (live + static) carry the learner branch (parity).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. _isLearner / _firstUnfinishedLessonIdx / _storylineForTopic (pure) ─────
{
  const APP = {
    info: {}, _teacherMode: false,
    progress: { completed: {} },
    lessonData: { topic: 'Ch1', lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    savedList: [{ id: 'tp_1', topic: 'Ch1' }, { id: 'tp_2', topic: 'Ch2' }],
    storylines: [{ id: 'sl_1', title: 'Deck', chapters: ['tp_1', 'tp_2'] }],
    _slScreen: null,
  };
  const lessonCountsFor = (d, L) => !L._hidden;   // simple visibility for the test
  const trio = new Function('APP', 'lessonCountsFor',
    ext(html, '_canEdit') + '\n' + ext(html, '_isLearner') + '\n' +
    ext(html, '_firstUnfinishedLessonIdx') + '\n' + ext(html, '_storylineForTopic') +
    '\nreturn { _isLearner, _firstUnfinishedLessonIdx, _storylineForTopic };')(APP, lessonCountsFor);

  // Learner = teacher mode OFF, INDEPENDENT of canGenerate (v60.1). A person with a backend can
  // still choose the learner experience by turning teacher mode off.
  assert.strictEqual(trio._isLearner(), true, 'teacher mode off → learner');
  APP._teacherMode = true; assert.strictEqual(trio._isLearner(), false, 'teacher mode on → not a learner');
  APP._teacherMode = false; APP.info.canGenerate = true;
  assert.strictEqual(trio._isLearner(), true, 'canGenerate does NOT make a teacher — still a learner (v60.1 fix)');
  APP.info.canGenerate = false;

  // Resume index.
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 0, 'fresh chapter resumes at 0');
  APP.progress.completed['Ch1'] = { a: {}, b: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 2, 'resumes at first unfinished');
  APP.progress.completed['Ch1'] = { a: {}, b: {}, c: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), -1, 'complete chapter → -1 (no auto-start)');
  // Hidden lessons don't count toward the resume target.
  APP.lessonData.lessons = [{ id: 'a' }, { id: 'h', _hidden: true }, { id: 'c' }];
  APP.progress.completed['Ch1'] = { a: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 2, 'hidden lesson skipped by resume');

  // Storyline resolution + _slScreen preference.
  const ctx = trio._storylineForTopic('Ch1');
  assert.ok(ctx && ctx.sl.id === 'sl_1' && ctx.topics.join(',') === 'Ch1,Ch2', 'resolves the deck + ordered topics');
  assert.strictEqual(decodeURIComponent(ctx.enc), '["Ch1","Ch2"]', 'encoded chain is the topic array');
  assert.strictEqual(trio._storylineForTopic('Solo'), null, 'a solo topic has no storyline');
}
console.log('  helpers: learner gate, resume index (hidden-aware), storyline resolution: OK');

// Regression (v60.1): _isLearner must NOT depend on _canEdit/canGenerate — a backend user who
// turns teacher mode off is a learner. The bug was the storyline-screen chapter click landing on
// the lesson-set page because canGenerate kept _isLearner false.
{
  const src = ext(html, '_isLearner');
  assert.ok(/!APP\._teacherMode/.test(src), '_isLearner is defined as !APP._teacherMode');
  assert.ok(!/_canEdit\(\)/.test(src), '_isLearner does NOT call _canEdit (would re-couple canGenerate)');
}

// Regression (v60.1): resume + Next must be COVERAGE-aware. A mixed-driven set's mixed lesson never
// gets a done[id] boolean, so a naive !done[id] scan returns it forever and "Next" replays the same
// lesson (the reported "stuck in a lesson, progress bar doesn't move" bug). The resume helper short-
// circuits on setComplete, and Next delegates to it; startLesson clears the _review flag so a real
// round after a review render still records.
{
  const fu = ext(html, '_firstUnfinishedLessonIdx');
  assert.ok(/setComplete\(d\)/.test(fu), '_firstUnfinishedLessonIdx returns -1 when the set is complete (coverage rule)');
  const sc = ext(html, 'showComplete');
  assert.ok(/const nextLessonIdx = _setDone \? -1 : _firstUnfinishedLessonIdx\(APP\.lessonData\)/.test(sc),
    'Next delegates to the coverage-aware helper (no naive done[id] scan that traps on a mixed lesson)');
  assert.ok(/setComplete\(APP\.lessonData\)/.test(sc), 'Next treats a coverage-complete set as done → advances to next chapter');
  const start = ext(html, 'startLesson');
  assert.ok(/delete C\._review/.test(start), 'startLesson clears _review so a real round records progress');
  const prog = ext(html, '_compProgressHtml');
  assert.ok(/topicCoverage\(\)/.test(prog) && /_mixedDriven/.test(prog),
    'the within-chapter progress row shows coverage for a mixed-driven set (bar actually moves)');
  // Story-progress row: other chapters are counted from the list projection (no lessons[]), so a
  // mixed chapter (whose mixed lesson never gets a done[id]) must be recognized via lessonTypes,
  // else finished mixed chapters read as incomplete and the story row shows 0 (reported bug).
  assert.ok(/ch\.lessonTypes\) && ch\.lessonTypes\.includes\('mixed'\)/.test(prog),
    'story-progress detects mixed chapters via lessonTypes (projection has no lessons[])');
  assert.ok(/doneKeys >= Math\.max\(1, cnt - 1\)/.test(prog),
    'a finished mixed chapter counts as done (cnt-1 recorded lessons, mixed excluded)');
  assert.ok(/complete\.story_progress/.test(prog), 'the story-progress row is rendered when a storyline exists');
  // Quitting a question (the ✕) must also respect the learner split: back to the story/landing,
  // not the lesson-set editing page. (Reported: "press x and I still get the lesson-set page.")
  const cq = ext(html, 'confirmQuit');
  assert.ok(/if\(_isLearner\(\)\)\{[\s\S]*?openStorylineScreen\(ctx\.sl\.id, ctx\.enc\)[\s\S]*?goLandingClean\(\)/.test(cq),
    'confirmQuit sends a learner to the storyline/landing');
  assert.ok(/\} else \{\s*goLessonSet\(\);/.test(cq), 'a teacher still returns to the lesson-set page on quit');
}

// ── 2. loadSaved routes learners past the lesson-set page (live) ──────────────
{
  const ls = ext(html, 'loadSaved');
  assert.ok(/await goLessonSet\(\)/.test(ls), 'loadSaved still runs goLessonSet (lang/dir setup + hash)');
  assert.ok(/if\(_isLearner\(\)\)\{[\s\S]*?_firstUnfinishedLessonIdx\(APP\.lessonData\)[\s\S]*?startLesson\(idx\)/.test(ls),
    'a learner resumes at the first unfinished lesson and auto-starts it');
  // The teacher path is the fall-through: no startLesson call outside the learner branch.
  const afterGo = ls.slice(ls.indexOf('await goLessonSet()'));
  assert.ok(/_isLearner\(\)/.test(afterGo), 'the branch is gated on _isLearner (teachers keep the page)');
}
console.log('  loadSaved: learner auto-start, teacher keeps the page: OK');

// ── 3. Completion card = Next + Back; Next chains; teacher-only extras ────────
{
  const sc = ext(html, 'showComplete');
  // Next: next lesson in chapter, else next chapter's first unfinished, else hidden.
  assert.ok(/compNext\.textContent = t\('complete\.next'\)/.test(sc), 'Next is a plain "Next"');
  assert.ok(/startLesson\(nextLessonIdx\)/.test(sc), 'Next → next lesson in this chapter directly');
  assert.ok(/_nextChapter\(\)/.test(sc) && /loadSaved\(ch\.id \|\| encTopic\(ch\.topic\)\)/.test(sc),
    'Next → next chapter (resumes its first unfinished lesson via loadSaved)');
  assert.ok(/compNext\.style\.display = 'none'/.test(sc), 'Next hides when nothing is left to do');
  // Back target stashed; storyline or landing.
  assert.ok(/APP\._compBack = \(sl && slEnc\) \? \{ kind: 'storyline'/.test(sc), 'Back target: storyline when present');
  assert.ok(/: \{ kind: 'landing' \}/.test(sc), 'Back target: landing for a solo chapter');
  const back = ext(html, 'compBackToStory');
  assert.ok(/openStorylineScreen\(b\.id, b\.enc\)/.test(back) && /goLandingClean\(\)/.test(back),
    'compBackToStory dispatches to the storyline screen or the landing page');
  // Teacher-only extras.
  assert.ok(/const _teacher = !!APP\._teacherMode/.test(sc), 'card teacher gate keys off teacher MODE (v60.1), not _canEdit');
  assert.ok(/_db\.style\.display = \(\(_teacher \|\| _belowThreshold\) && drillAvailable/.test(sc),
    'drill shows for a teacher OR a below-threshold learner (v60.8 pass-mark gate)');
  assert.ok(/if \(_teacher && !lesson\._drill\) \{/.test(sc), 'nav pills are teacher-only');
  // The card markup has exactly the two primary buttons wired.
  assert.ok(/id="comp-next" onclick="afterComplete\(\)"/.test(html), 'markup: Next button');
  assert.ok(/id="comp-back"[^>]*onclick="compBackToStory\(\)"/.test(html), 'markup: Back button');
  assert.ok(/id="comp-progress"/.test(html), 'markup: progress-summary container');
}
console.log('  completion card: Next chains lesson→chapter, Back to story/home, teacher-only extras: OK');

// ── 4. Full story on unlock + progress summary ────────────────────────────────
{
  const sc = ext(html, 'showComplete');
  // v60.6: the story render moved into _renderCompStory. Full story when complete; a 200-char
  // preview only in the teacher/not-yet-done peek.
  const rcs = ext(html, '_renderCompStory');
  assert.ok(/_el\.textContent = allDone \? full : \(full\.slice\(0, 200\)/.test(rcs),
    'chapter complete → FULL story; otherwise a 200-char preview (teacher peek)');
  assert.ok(/_lbl\.textContent = _allDone2 \? t\('complete\.story_unlocked'\) : t\('complete\.story_preview'\)/.test(sc),
    'unlock vs preview label reflects completion');
  const prog = ext(html, '_compProgressHtml');
  assert.ok(/complete\.chapter_progress/.test(prog) && /complete\.story_progress/.test(prog),
    'progress summary covers within-chapter AND along-storyline');
  assert.ok(/setComplete\(d\)/.test(prog), 'the current chapter uses the real counted-completion check');
  // Drill card skips the progress summary (synthetic topic).
  assert.ok(/if \(lesson\._drill\) \{ _progEl\.innerHTML = ''; _progEl\.style\.display = 'none'; \}/.test(sc),
    'a drill card hides the progress summary');
}
console.log('  full-story-on-unlock + within/along progress summary: OK');

// ── 4b. Review mode: a learner re-opening a COMPLETE chapter (v60.1) ──────────
{
  const sc = ext(html, 'showComplete');
  assert.ok(/function showComplete\(review\)/.test(html), 'showComplete accepts a review flag');
  assert.ok(/if\(review\)\{[\s\S]*?_review:true \}/.test(sc), 'review builds a synthetic no-round C');
  assert.ok(/!C\._review &&/.test(sc), 'review mode records NO progress (chapter already complete)');
  // loadSaved routes a learner with no unfinished lesson into the review card, not the page.
  const ls = ext(html, 'loadSaved');
  assert.ok(/else showComplete\(true\)/.test(ls), 'learner + complete chapter → review card (live)');
  const lsS = ext(builder, 'loadSaved');
  assert.ok(/else showComplete\(true\)/.test(lsS), 'learner + complete chapter → review card (static parity)');
}
console.log('  review mode for a re-opened complete chapter (live+static): OK');

// ── 4c. Chapter storyboard panel on the completion card (v65.1) ─────────────
{
  const fn = ext(html, '_renderCompStoryboard');
  // Reuses the v57 mapping, so the panel shown can never disagree with the one the board links to.
  assert.ok(/_sbPanelChapter\(i, groups\.length, chapters\.length, g\.getAttribute\('data-chapter'\)\)/.test(fn),
    'the panel is selected with the SAME mapping the storyboard click handler uses');
  assert.ok(/const chapterIdx = idx \+ 1;/.test(fn), '_sbPanelChapter is 1-based; the deck index is 0-based');
  // Cropped to the panel bounding box rather than shrinking the whole board.
  assert.ok(/out\.setAttribute\('viewBox'/.test(fn), 'a fresh SVG is cropped to the panel bounding box');
  assert.ok(/querySelectorAll\('defs'\)/.test(fn), 'defs are carried over so gradients/patterns still resolve');
  // Must never break the card.
  assert.ok(/catch\(_\)\{ \/\* a malformed board must never break the completion card \*\/ \}/.test(fn),
    'a malformed storyboard degrades silently');
  assert.ok(/id="comp-storyboard"/.test(html), 'the card has a storyboard slot');
  assert.ok(/else _renderCompStoryboard\(topicKey, _slCtx\)/.test(html), 'showComplete renders it for non-drill cards');
}
console.log('  chapter storyboard panel on the completion card: OK');


// ── 5. Static build parity ────────────────────────────────────────────────────
{
  const ls = ext(builder, 'loadSaved');
  assert.ok(/await goLessonSet\(\)/.test(ls), 'static loadSaved awaits goLessonSet');
  assert.ok(/_isLearner==='function' && _isLearner\(\)/.test(ls) && /_firstUnfinishedLessonIdx\(APP\.lessonData\)/.test(ls),
    'static loadSaved carries the SAME learner branch (parity — the two renderers must not drift)');
  // i18n keys exist (en).
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['complete.next', 'complete.back_story', 'complete.back_home', 'complete.chapter_progress', 'complete.story_progress', 'complete.story_preview']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
}
console.log('  static loadSaved parity + i18n keys: OK');

console.log('unit-learner-nav: ALL PASSED');
