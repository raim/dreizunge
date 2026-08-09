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



// ── 6. v77_p (user): Next opens the UNPLAYED work, not a replay ────────────
// Reported from a browser: on a chapter whose story had just unlocked, Next led to a replay of
// earlier lessons instead of the comprehension questions the learner had never seen — so the
// learner had to press Replay to get past their own replays. Forward must mean the next thing you
// have NOT done; coverage replay is the fallback, not the first choice.
{
  const C = atUnlock();
  // Make a prep lesson coverage-SHORT after the fact, leaving its done-flag in place. Without a
  // coverage-short lesson that is DIFFERENT from the unplayed one, both candidate targets coincide
  // and "unplayed beats replay" is not being tested at all — the first version of this section
  // passed under its own revert for exactly that reason. Done here rather than in the shared
  // fixture so the other sections keep the state they were written against.
  C.run(`(function(){
    var d = APP.lessonData, m = _solvedMap(d.topic);
    for (var i = 0; i < (d.lessons||[]).length; i++) {
      var L = d.lessons[i];
      if (!L || _isStoryGatedLesson(L)) continue;
      // _lessonItemUniverse returns a SET, not an array — calling .slice on it throws, and inside
      // a try/catch that means "seeded nothing" rather than a visible failure. (That is exactly
      // what happened on the first attempt at this section: the swallowed TypeError left the prep
      // gate closed and the failure surfaced two sections away, in an unrelated assertion.)
      var uni = [];
      try { uni = Array.from(_lessonItemUniverse(i) || []); } catch(e){}
      if (uni.length < 4) continue;
      // ONE item, not half: the prep gate is coverage-aware, so removing a large slice re-LOCKS
      // the story and the comprehension lessons stop counting as unfinished at all. One missing
      // item leaves the gate open while making the lesson coverage-short — which is precisely the
      // state the user reported (story unlocked, Replay still offered).
      delete m[uni[uni.length - 1]];
      break;
    }
  })(); true;`, 'short');
  // Consume the once-per-chapter story page first, so Next takes its normal route rather than
  // opening the unlocked page (which section 3 already covers).
  C.run(`APP.progress.storyShown[APP.lessonData.topic] = 1; APP._started = null; showComplete(); true;`, 'again');
  const unplayed = workLeft(C);
  assert.ok(unplayed >= 0, 'non-vacuity: there is an unplayed lesson in this chapter');
  // Non-vacuity that makes this test DISCRIMINATE: a coverage-short lesson must exist and must be
  // a DIFFERENT lesson, or "unplayed beats replay" is not being tested at all.
  const covShort = C.run(`(typeof _firstCoverageShortLessonIdx === 'function') ? _firstCoverageShortLessonIdx() : -1`);
  assert.ok(covShort >= 0, 'a coverage-short lesson exists (the replay candidate)');
  assert.notStrictEqual(covShort, unplayed,
    'and it is a DIFFERENT lesson from the unplayed one, so the preference is observable');
  // HONEST LIMITATION, recorded rather than papered over: this section asserts the RESULT (Next
  // opens the unplayed lesson) and that result is correct, but it does NOT discriminate under
  // revert — swapping the product back to coverage-first leaves it green. The two candidates
  // differ when measured here, so the likely cause is that `endDrill()`, which the handler runs
  // BEFORE choosing a target, changes the state `_firstCoverageShortLessonIdx` reads. Until that
  // is chased down, treat this as a result check, not as protection for the ORDER — the ordering
  // claim is currently unguarded (standing rule 13: a guard that cannot fail is not a guard).
  const gated = C.run(`(function(){ var L = APP.lessonData.lessons[${unplayed}];
    return L ? (L.type || 'standard') : 'none'; })()`);
  C.run(`APP._started = null; document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._started`), unplayed,
    `Next opens the first UNPLAYED lesson (${gated}), not a replay of finished ones`);
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
