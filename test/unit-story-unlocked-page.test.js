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



// ── 6. Next opens the UNPLAYED lesson, never a replay ─────────────────────
// User report: Next led to a replay of earlier lessons instead of the comprehension questions.
//
// FINDING (v77_s), recorded because it changes what this section can claim: showComplete tries
// `nextLessonIdx >= 0` BEFORE the below-mark branch, so whenever an unfinished lesson exists the
// next-lesson branch wins and starts it. That is the behaviour asserted here, and it is correct.
//
// It also means v77_p's re-ordering INSIDE the below-mark branch is unreachable while any lesson
// is unfinished — that branch only runs when `_firstUnfinishedLessonIdx` is already -1, where its
// first choice can never match. Two earlier versions of this section tried to revert-verify that
// ordering and could not, and the reason was the scenario, not the assertion: the branch was never
// entered. The ordering is kept as a correct fallback, but it is NOT what protects the learner
// here, and this section does not pretend to test it.
//
// The open question the user's screenshot really poses is why `_firstUnfinishedLessonIdx` returned
// -1 while an unplayed comprehension lesson remained — that is where the replay came from, and it
// is still unexplained.
{
  const C = atUnlock();
  const unplayed = workLeft(C);
  assert.ok(unplayed >= 0, 'non-vacuity: there is an unplayed lesson in this chapter');
  const gated = C.run(`(function(){ var L = APP.lessonData.lessons[${unplayed}];
    return L ? (L.type || 'standard') : 'none'; })()`);
  C.run(`APP.progress.storyShown[APP.lessonData.topic] = 1; APP._started = null; showComplete(); true;`, 'again');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._started`), unplayed,
    `Next opens the first UNPLAYED lesson (${gated}), never a replay of a finished one`);
  console.log(`  Next opens the unplayed lesson (${gated}), not a replay`);
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
