// unit-next-chapter-entry.test.js
// v81_b (user ruling) — a chapter AFTER THE FIRST lands on its PROGRESS CARD. The entry card is the
// first chapter's alone.
//
// ⚠️ THIS FILE ASSERTED THE OPPOSITE UNTIL v81_b, and the history is worth keeping because this
// surface has now been ruled on three times:
//   • `v77_i` built a next-chapter-unlocked card so finishing a chapter did not pass silently;
//   • `v77_q` made that card the STARTER for chapters 2..N, leaving the entry card to chapter one;
//   • `PLAN §C2` asked for the unlocked card to be deleted — which could not work as written, since
//     it WAS the starter for those chapters;
//   • `v80_e` resolved that by generalising the ENTRY card to every chapter;
//   • `v81_b` picks the other resolution: **the PROGRESS CARD is the arrival screen.**
//
// The reason the last one is now available is that the v80 line changed what a progress card IS. It
// carries the story with its progress highlights, the vocabulary, the chapter icons and the play
// buttons — everything the entry card offered. That was not true when `v80_e` was decided, so this
// is a ruling made on different facts, not a reversal of a mistake.
//
// The claim `v77_i` was built for still holds and is still asserted: arriving at a chapter must not
// pass silently, and Next must open the chapter the card names.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const settle = () => new Promise(r => setTimeout(r, 50));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
const pair = (want) => (store.storylines || []).find(sl => {
  const ts = (sl.chapters || []).map(c => byId[c]);
  const hasSummary = !!String(sl.summary || '').trim();
  return ts.length >= 2 && ts[0] && (ts[0].lessons || []).length
      && ts[1] && (ts[1].lessons || []).length && hasSummary === want;
});
const SL = pair(true);
assert.ok(SL, 'the corpus has a storyline WITH a summary whose first two chapters carry lessons');
const FIRST = byId[SL.chapters[0]], SECOND = byId[SL.chapters[1]];
// The summary-less case is the one section 3 needs; assert it was found rather than skipping.
const SL_NOSUM = pair(false);
assert.ok(SL_NOSUM, 'the corpus has a storyline with NO summary whose first two chapters carry lessons');
const NS_SECOND = byId[SL_NOSUM.chapters[1]];

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

const BOOT = `
  APP.savedList = ${JSON.stringify(SAVED)};
  APP.storylines = ${JSON.stringify(store.storylines || [])};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
  APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
  APP._teacherMode = false; APP._slScreen = {};
  APP._shown = null; APP._loadedSaved = null; APP._started = null;
  show = function(id){ APP._shown = id; };
  loadSaved = function(x){ APP._loadedSaved = String(x); };
  startLesson = function(i){ APP._started = i; return true; };
  openStorylineScreen = function(id){ APP._navWent = 'storyline:' + id; };
  goLandingClean = function(){ APP._navWent = 'landing'; };
  saveProg = function(){};`;

function finishFirstChapter() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`${BOOT}
    APP.lessonData = ${JSON.stringify(FIRST)};
    APP.lang = ${JSON.stringify(FIRST.lang)}; APP.srcLang = ${JSON.stringify(FIRST.srcLang)};
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0 };
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var m = _solvedMap(APP.lessonData.topic);
      countedLessons(APP.lessonData).forEach(function(L){
        _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
      var d = APP.progress.completed[APP.lessonData.topic] = {};
      countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
    })();
    setComplete(APP.lessonData);
    showComplete(); true;`, 'render');
  return C;
}

// Arrive AT a chapter, the way loadSaved does: lessonData is the new chapter and the entry gate is
// asked. Drives the product's own gate (`_enterViaSummaryCard`), never a re-typed copy of it.
function arriveAt(topic) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`${BOOT}
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:0, total:0, mistakes:0 };
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    APP._entered = _enterViaSummaryCard(_firstUnfinishedLessonIdx(APP.lessonData)); true;`, 'arrive');
  return C;
}

// ── 1. Next opens the next chapter DIRECTLY ────────────────────────────────
{
  const C = finishFirstChapter();
  assert.strictEqual(C.run(`!!document.getElementById('comp-next').disabled`), false,
    'non-vacuity: Next is live after finishing a chapter with another ahead');
  assert.strictEqual(C.run(`APP._loadedSaved`), null, 'non-vacuity: nothing loaded before the click');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  const loaded = C.run(`APP._loadedSaved`);
  assert.ok(loaded, 'Next loads the next chapter');
  assert.ok(loaded === (SECOND.id || SECOND.topic) || loaded.includes(SECOND.id || ''),
    `and it is the chapter that actually comes next (loaded "${loaded}")`);
  assert.notStrictEqual(C.run(`APP._shown`), 'unlocked-screen',
    'the deleted interstitial is not shown — there is one starter card now, not two');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'no error was swallowed on the way');
  console.log(`  finishing a chapter -> opens "${SECOND.topic}" directly`);
}

// ── 2. The target is resolved at RENDER time, not re-resolved at click ─────
// v77_i's structural point, kept: the button and whatever consumes it cannot name different
// chapters. Re-resolving at click time is what APP._compBack was reused to avoid in v74_o.
{
  const C = finishFirstChapter();
  const stashed = C.run(`APP._unlNext && (APP._unlNext.topic || '')`);
  assert.strictEqual(stashed, SECOND.topic, 'the next chapter is stashed when the card renders');
  // Move the goalposts AFTER render: a click that re-resolved would now pick something else.
  C.run(`APP._unlNext = { id: 'sentinel-id', topic: 'SENTINEL' }; true;`);
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._loadedSaved`), 'sentinel-id',
    'the click uses the STASHED target, so the render and the click cannot disagree');
  console.log('  the destination is stashed at render time');
}

// ── 3. On arrival a LATER chapter shows its PROGRESS CARD ───────────────
// v81_b. `_enterViaSummaryCard` declines, and `loadSaved` lands on the progress card rather than
// dropping the learner into a question — a chapter with no arrival screen at all was the failure
// mode `v77_i` was built to prevent, and it is still prevented, by a different screen.
{
  const C = arriveAt(SECOND);
  assert.strictEqual(C.run(`_isLaterChapter(APP.lessonData)`), true,
    'non-vacuity: this chapter really is after the first');
  assert.strictEqual(C.run(`APP._entered`), false,
    'the entry card declines for a later chapter (v81_b, reversing v80_e)');
  console.log('  a later chapter gets no entry card');
}

// ── 4. The FIRST chapter still gets its entry card, when there is a summary ──
// The half of `v77_k` that survives: the entry card is the first chapter's alone, and only when the
// storyline HAS a summary — otherwise it is a blank page between the learner and their lesson.
{
  const FIRST_WITH = byId[SL.chapters[0]];
  const C = arriveAt(FIRST_WITH);
  assert.strictEqual(C.run(`_isLaterChapter(APP.lessonData)`), false, 'non-vacuity: first chapter');
  assert.ok(C.run(`!!_summaryOfStory()`), 'non-vacuity: this storyline HAS a summary');
  assert.strictEqual(C.run(`APP._entered`), true, 'the first chapter still shows the entry card');
  assert.strictEqual(C.run(`APP._shown`), 'summary-screen', 'and that card is the entry card');
  console.log('  the first chapter keeps its entry card');
}

// ── 5. A summary-less FIRST chapter still gets NO card ──────────────────
{
  const NS_FIRST = byId[SL_NOSUM.chapters[0]];
  const C = arriveAt(NS_FIRST);
  assert.strictEqual(C.run(`!!_summaryOfStory()`), false, 'non-vacuity: no summary');
  assert.strictEqual(C.run(`APP._entered`), false,
    'a summary-less first chapter shows no entry card — it would be blank');
  console.log('  no summary + first chapter: no card, as before');
}

// ── 6. Forward starts the lesson — the card orients, it does not block ─────
{
  const C = arriveAt(byId[SL.chapters[0]]);          // v81_b: the entry card is the first chapter's
  const want = C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);
  assert.ok(want >= 0, 'non-vacuity: there is a lesson to start');
  C.run(`document.getElementById('sum-next').onclick(); true;`, 'go');
  assert.strictEqual(C.run(`APP._started`), want,
    'forward starts the lesson the learner came to play');
  console.log('  forward starts the lesson');
}

(async () => {
// ── 7. ⚠️ THE OTHER HALF — a later chapter LANDS on its progress card ────
// §3 only shows the entry card declines. That alone would be satisfied by dropping the learner
// straight into a question — the failure `v77_i` was built to prevent. This asserts the DESTINATION.
//
// ⚠️ It drives the REAL `loadSaved`, with fetch stubbed to hand back the chapter, NOT a copy of its
// branch. The first version ran a hand-written copy and **mutation-testing showed it could not fail**
// when the landing was removed from the product — it was testing its own copy. `unit-story-summary`
// makes the same point about this same function: proving the decision works while leaving the WIRING
// unguarded is the gap.
await (async () => {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP._landed = null; APP._started = null;
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    showComplete = function(){ APP._landed = 'progress-card'; };
    showStorySummary = function(){ APP._landed = 'entry-card'; };
    saveProg = function(){};
    goLessonSet = async function(){ return true; };
    fetch = function(){ return Promise.resolve({ ok:true,
      json: function(){ return Promise.resolve(${JSON.stringify(SECOND)}); } }); };
    loadSaved(${JSON.stringify(SECOND.id)}); true;`, 'land');
  await settle();
  assert.strictEqual(C.run(`APP._landed`), 'progress-card',
    'a later chapter lands on its PROGRESS card');
  assert.strictEqual(C.run(`APP._started`), null,
    'and does NOT drop the learner straight into a question — the silent arrival v77_i was built ' +
    'to prevent is still prevented, by a different screen');
  console.log('  a later chapter lands on the progress card, not in a question');
})();

// ── 8. ⚠️ v81_c — ARRIVING IS NOT FINISHING ────────────────────────────────
// User-reported at the v81_b device pass: *"it seems we are now skipping the comprehension
// lesson!!"*
//
// §7 proves WHERE a later chapter lands. It stubs `showComplete`, so it cannot see what that card
// then DOES — and that gap was the bug. `showComplete` computed "is there an in-chapter next" as
// `C._review || setComplete(...)`, on the premise that a review render is by definition an
// already-complete chapter. v81_b falsified that premise by landing an UNFINISHED chapter here, so
// Next could not see the chapter's own unplayed lesson and walked on to the next chapter instead.
// Measured over the corpus before the fix: 0 of 72 later chapters reached their comprehension
// lesson (`build_history/probe_comp_skip_v81c.js`).
//
// So this section runs the REAL `showComplete` and CLICKS the REAL `comp-next` — the claim is about
// a button, and only pressing it can touch that claim (session-28 rule 2). Two things are asserted
// because the same premise produced both: where Next goes, and what the card SAYS.
await (async () => {
  // A fixture the bug can actually be seen on: a later chapter with a story-gated lesson, at least
  // one other counted lesson to carry the pass mark, and a NEXT chapter for Next to wrongly walk to.
  const GATED = (() => {
    for (const sl of (store.storylines || [])) {
      const ids = sl.chapters || [];
      for (let i = 1; i < ids.length - 1; i++) {
        const t = byId[ids[i]];
        if (!t || (t.lessons || []).length < 2) continue;
        const types = (t.lessons || []).map(L => (L && L.type) || 'standard');
        if (!types.includes('comprehension')) continue;
        return t;
      }
    }
    return null;
  })();
  // Guard the guard against going vacuous on new data: if the corpus stops carrying such a chapter
  // this section must FAIL LOUDLY, not quietly stop testing anything.
  assert.ok(GATED, 'the corpus has a NON-LAST later chapter with a comprehension lesson and a sibling');

  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP._went = null; APP._started = null;
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    endDrill = function(){};
    saveProg = function(){};
    goLessonSet = async function(){ return true; };
    fetch = function(){ return Promise.resolve({ ok:true,
      json: function(){ return Promise.resolve(${JSON.stringify(GATED)}); } }); };
    true;`, 'seed');

  // The reported state: the ordinary lessons are done and solved, the comprehension lesson is not.
  // Seeded the way the PRODUCT writes it — item keys through `_lessonItemUniverse` — because a
  // store seeded by hand measures nothing (rule 17).
  C.run(`APP.lessonData = ${JSON.stringify(GATED)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData, m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      countedLessons(d).forEach(function(L){
        if (_isStoryGatedLesson(L)) return;
        _lessonItemUniverse(d.lessons.indexOf(L)).forEach(function(k){ m[k] = 1; });
        done[L.id] = { correct: 4, total: 4 };
      });
    })(); true;`, 'state');

  const gatedIdx = C.run(`APP.lessonData.lessons.findIndex(function(L){ return _isStoryGatedLesson(L); })`);
  assert.ok(gatedIdx >= 0, 'the fixture chapter really carries a story-gated lesson');
  assert.strictEqual(C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`), gatedIdx,
    'and it is the one thing left to do — so anything Next does other than open it is a skip');
  // Non-vacuity for the mechanism the bug ran through: the old code only walked on because the
  // chapter was ABOVE its pass mark without the comprehension lesson. If a corpus change made this
  // fixture fall below the mark, the below-threshold branch would rescue it and this section would
  // pass without exercising the defect at all.
  assert.ok(C.run(`(function(){ var c = topicCoverage(); return c.total > 0 && (c.solved/c.total) >= _coverageTarget(); })()`),
    'the pass mark is already met WITHOUT the comprehension lesson — the state the skip needed');

  // Drive the real landing, then watch where the real button goes.
  C.run(`loadSaved(${JSON.stringify(GATED.id)}); true;`, 'land');
  await settle();
  C.run(`loadSaved = function(x){ APP._went = 'CHAPTER:' + String(x); };
    showStoryUnlocked = function(){ APP._went = 'story-unlocked-page'; };
    compBackToStory = function(){ APP._went = 'back-to-storyline'; }; true;`, 'watch');

  // The title is READ now and asserted last. Ordering is deliberate: an assert aborts the file, so
  // if the title check came first a regression in the Next wiring would be masked by it and the two
  // halves of this fix could not be attributed separately under mutation-testing. Reading before
  // the click keeps the value the ARRIVAL render produced.
  const title = C.run(`(document.getElementById('comp-title')||{}).textContent || ''`);

  C.run(`document.getElementById('comp-next').onclick(); true;`, 'forward');
  assert.strictEqual(C.run(`APP._went`), null,
    'Next does NOT leave the chapter while its comprehension lesson is unplayed');
  assert.strictEqual(C.run(`APP._started`), gatedIdx,
    'Next opens the comprehension lesson itself');

  assert.strictEqual(title, C.run(`t('complete.keep_going')`),
    'the arrival card does not announce "Lesson complete!" — nothing was played to complete');
  console.log('  arrival with work left: Next opens the comprehension lesson, card says "keep going"');
})();

// ── What this does NOT establish (rule 34) ──────────────────────────────
// • Nothing here says the progress card is a GOOD arrival screen; only that it is the one reached.
//   That is a device judgement, and it is owed.
// • The entry card's own contents are `unit-story-summary`'s subject, not this file's.
// • §8 fixes the FORWARD path. Whether a learner who instead taps a lesson icon or a play button
//   can still reach the comprehension lesson is a different route and is not asserted here.

console.log('unit-next-chapter-entry: ALL PASSED');
})();
