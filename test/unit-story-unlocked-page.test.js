// unit-story-unlocked-page.test.js
// v77_j — the story-unlocked card: the walk's THIRD page (roadmap §0c).
//
// The moment the story becomes readable is what every prep lesson was for, and it was only ever a
// panel among the bars and buttons. USER RULING: the new page "sits beside it" — the panel STAYS on
// the progress card; this page gives the moment a page of its own.
//
// Contract, asserted by clicking:
//   1. When the prep gate has just flipped and work remains, Next opens the page, showing the story.
//   2. → from the page starts the lesson the card resolved — forward never skips a lesson.
//   3. ONCE per chapter: the second time, Next goes straight to the lesson.
//   4. NEVER on a review render — re-opening a finished chapter is not the moment of unlocking.
//   5. The progress card's own story panel is UNAFFECTED (the ruling: beside, not instead).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A chapter with PREP lessons and at least one story-gated lesson after them, so "the story
// unlocks while work remains" is a state this chapter can actually be in.
const isPost = L => L && (L.type === 'comprehension' || L.type === 'error_hunt' || L.type === 'ai_error_hunt');
const TOPIC = store.topics.find(t =>
  (t.story || '').length > 100 &&
  (t.lessons || []).some(L => L && !L._hidden && !isPost(L) && !L.type) &&
  (t.lessons || []).some(isPost));
assert.ok(TOPIC, 'the corpus has a chapter with prep lessons AND a story-gated lesson');

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

// Seed a learner who has completed every PREP lesson (so the story gate is open) but not the
// story-gated ones (so work remains in the chapter).
function atUnlock(opts) {
  opts = opts || {};
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData, m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      (d.lessons||[]).forEach(function(L, i){
        if (!L || _isStoryGatedLesson(L)) return;      // prep only — leave the gated ones open
        try { _lessonItemUniverse(i).forEach(function(k){ m[k]=1; }); } catch(e){}
        done[L.id] = { done:true, correct:4, total:4 };
      });
    })();
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                ${opts.review ? '_review: true,' : ''} hearts:3, streak:2, bestStreak:2 };
    APP._shown = null; APP._started = null;
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    saveProg = function(){};
    showComplete(${opts.review ? 'true' : ''}); true;`, 'render');
  return C;
}
// The chapter's first story-gated lesson — section 6 needs it by index.
const GATED_IDX = (TOPIC.lessons || []).findIndex(isPost);
const gateOpen = C => C.run(`storyUnlocked(APP.lessonData)`);
const workLeft = C => C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);

// ── 1-2. Next opens the page; → continues into the resolved lesson ─────────
{
  const C = atUnlock();
  // Non-vacuity: this must genuinely be "gate open, work remains", or the section proves nothing.
  assert.strictEqual(gateOpen(C), true, 'the prep gate is open on this fixture');
  assert.ok(workLeft(C) >= 0, 'and there is still a lesson left in the chapter');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._shown`), 'unlockstory-screen',
    'Next opens the story-unlocked page at the moment the gate flips');
  assert.strictEqual(C.run(`APP._started`), null, 'and does not start the lesson on the way');
  const body = C.run(`document.getElementById('us-story').innerHTML || ''`);
  assert.ok(body.length > 0, 'the page shows the story');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'no error was swallowed reaching the page');
  const want = workLeft(C);
  C.run(`document.getElementById('us-next').onclick(); true;`, 'go');
  assert.strictEqual(C.run(`APP._started`), want,
    'forward from the page starts the lesson the card resolved — it never skips one');
  console.log('  gate flips: Next -> story page -> the next lesson');
}

// ── 3. Once per chapter ────────────────────────────────────────────────────
{
  const C = atUnlock();
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'first');
  assert.strictEqual(C.run(`APP._shown`), 'unlockstory-screen', 'shown the first time');
  // Render the card again, as a fresh completion would.
  C.run(`APP._shown = null; APP._started = null; showComplete(); true;`, 're-render');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'second');
  assert.notStrictEqual(C.run(`APP._shown`), 'unlockstory-screen',
    'NOT shown a second time — a celebration that repeats is noise');
  assert.ok(C.run(`APP._started`) != null,
    'the second time Next goes straight to the lesson');
  console.log('  shown once per chapter, then Next is direct again');
}

// ── 4. Never on a review render ────────────────────────────────────────────
// Re-opening a finished chapter is not the moment of unlocking. Three separate bugs have come from
// judging the learner on a review render (INTERNALS: "a review render is not a play"), and this
// page DOES judge: it writes APP.progress.storyShown.
//
// HONEST NOTE, measured rather than assumed: on a review render `nextLessonIdx` is -1, so the
// next-lesson branch is not reached at all and the page cannot appear for that reason alone. The
// `!C._review` condition in the product is therefore defence in depth, NOT the thing keeping this
// section green — removing it does not make this section fail. It is kept because the branch's
// entry condition is not this section's to guarantee, and because `_markStoryShown` writes
// progress. The assertions below are written to state what is actually true, so they cannot be
// read as evidence for a guard they do not exercise (session-28 rule 2).
{
  const C = atUnlock({ review: true });
  assert.strictEqual(gateOpen(C), true, 'the gate is open here too, so this is not vacuous');
  assert.strictEqual(C.run(`APP._usNextLesson`), undefined,
    'a review render does not reach the next-lesson branch at all — this is WHY the page cannot appear');
  const shown = C.run(`document.getElementById('comp-next').onclick(); APP._shown;`);
  assert.notStrictEqual(shown, 'unlockstory-screen',
    'and so a review render never opens the story-unlocked page');
  assert.strictEqual(C.run(`!!APP.progress.storyShown[APP.lessonData.topic]`), false,
    'nor does it consume the once-per-chapter showing');
  console.log('  review render: branch not reached, page not shown, showing not consumed');
}

// ── 5. The progress card's own story panel is untouched (user ruling) ──────
// "Sits beside it" — the page is additional, not a replacement. If building the page had hidden
// the panel, the story would have STOPPED being available on the card, which is the opposite of
// what §0c wants.
{
  const C = atUnlock();
  const panel = C.run(`(function(){ var e=document.getElementById('comp-story-panel');
    if(!e) return 'MISSING'; return e.style.display === 'none' ? 'HIDDEN' : 'SHOWN'; })()`);
  assert.strictEqual(panel, 'SHOWN',
    'the progress card still shows its story panel — the page sits BESIDE it, not instead of it');
  assert.ok(C.run(`(document.getElementById('comp-story-text').innerHTML || '').length`) > 0,
    'and that panel still carries the story text');
  console.log('  progress-card story panel still shown (page sits beside it)');
}



// ── 6. Next opens the UNPLAYED work, never a replay of an earlier lesson ───
// User report: Next led to a replay of earlier lessons instead of the comprehension questions.
// `v77_p` fixed that by ordering the below-mark branch's fallback UNFINISHED-first, then
// coverage-short.
//
// ⚠️ THIS SECTION DID NOT DISCRIMINATE UNDER REVERT until v80_c, and the note it carried since
// `v77_p` said so honestly. It asserted `APP._started === _firstUnfinishedLessonIdx(...)`, which
// compares the product against the same product function — a tautology. Two earlier attempts
// concluded the below-mark branch "was never entered". **That conclusion was half right, and the
// missing half is the whole section:**
//
//   1. The branch IS entered — via index.html's `nextLessonIdx === C.lessonIdx && ...
//      _isStoryGatedLesson(lesson)` line, which forces `nextLessonIdx` to -1 for a learner who has
//      just played the comprehension lesson and not fully solved it. That is exactly the state the
//      user reported from, which is why the earlier scenarios (built around a lesson NOT yet
//      played) could never reach it.
//   2. The two candidate targets must be made to DISAGREE. An unplayed lesson sits at 0% coverage,
//      which is also the least-covered, so both orderings return the same index and any assertion
//      passes either way. They separate only when the gated lesson is PARTLY solved (so it is
//      still unfinished, its done-flag being withheld until every item is solved) while an earlier
//      lesson is covered LESS.
//
// Built below, and revert-verified: with `v77_p`'s ordering swapped back, Next goes to lesson 0 —
// the reported bug, reproduced — and this section fails.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    // The pass mark is 1 here, not 0.8: at 1 the story-unlock gate skips its coverage test
    // entirely, so the story can be unlocked (every prep lesson done-flagged) while coverage is
    // still short — which is what puts the card in the below-mark branch at all.
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(TOPIC)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData, m = _solvedMap(d.topic), done = APP.progress.completed[d.topic] = {};
      (d.lessons||[]).forEach(function(L, i){
        if (!L) return;
        var u = Array.from(_lessonItemUniverse(i));
        if (_isStoryGatedLesson(L)) {
          // Partly solved: unfinished (no done-flag) but NOT the least-covered lesson.
          u.slice(0, Math.max(0, u.length - 1)).forEach(function(k){ m[k] = 1; });
          return;
        }
        // Lesson 0 is left barely covered; every other prep lesson is finished outright.
        if (i === 0) u.slice(0, 2).forEach(function(k){ m[k] = 1; });
        else u.forEach(function(k){ m[k] = 1; });
        done[L.id] = { done:true, correct:4, total:4 };
      });
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    })();
    APP._shown = null; APP._started = null;
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    saveProg = function(){};
    APP.cur = { lessonIdx:${GATED_IDX}, exercises:[], cur:0, correct:1, total:3, mistakes:2,
                hearts:2, streak:0, bestStreak:0 };
    showComplete(); true;`, 'render');

  const unfinished = C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);
  const covShort   = C.run(`_firstCoverageShortLessonIdx()`);

  // Non-vacuity, in three parts. Each one is a way this section could go quietly green.
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`), true,
    'non-vacuity: the story is unlocked, so the comprehension lesson is legitimately reachable');
  assert.strictEqual(unfinished, GATED_IDX,
    'non-vacuity: the unfinished lesson is the story-gated one the learner just played');
  assert.notStrictEqual(covShort, unfinished,
    'THE DISCRIMINATOR: the coverage-short target and the unfinished target must DIFFER, or both ' +
    'orderings give the same answer and this section proves nothing');
  assert.ok(covShort >= 0 && covShort < unfinished,
    'and the coverage-short one is EARLIER — "a replay of earlier lessons", as reported');
  assert.strictEqual(C.run(`APP._usNextLesson`), undefined,
    'non-vacuity: the next-lesson branch was NOT taken, so the below-mark branch is what answers ' +
    'here — the entry condition the two earlier attempts could not reach');

  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  const started = C.run(`APP._started`);
  assert.strictEqual(started, unfinished,
    'Next opens the UNPLAYED comprehension work (lesson ' + unfinished + ')');
  assert.notStrictEqual(started, covShort,
    'and NOT the earlier, less-covered lesson (' + covShort + ') — the v77_p ordering, now actually ' +
    'under test');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'and nothing was swallowed getting there');
  console.log('  below the mark, Next opens unplayed work (' + unfinished + ') not a replay (' + covShort + ')');
}

// ── 7. v77_p (user): no story PREVIEW — locked means locked ────────────────
// The panel used to show a truncated teaser while the story was still locked, for a teacher or
// anyone with canGenerate, pushing the vocabulary below a paragraph the learner is not meant to
// read yet. A teaser of the reward is not the reward.
{
  const C = atUnlock();
  // Lock the story again by clearing the prep progress, and turn ON the flags that used to force
  // the preview — that combination is precisely what produced "Vorschau der Geschichte".
  C.run(`APP.progress.completed[APP.lessonData.topic] = {};
         APP.progress.solved[APP.lessonData.topic] = {};
         APP.info.canGenerate = true; APP._teacherMode = false;
         showComplete(); true;`, 'locked');
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`), false,
    'non-vacuity: the story really is locked in this state');
  assert.strictEqual(C.run(`document.getElementById('comp-story-panel').style.display`), 'none',
    'no story panel is shown while the story is locked — not even a truncated preview');
}

console.log('unit-story-unlocked-page: ALL PASSED');
