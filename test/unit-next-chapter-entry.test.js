// unit-next-chapter-entry.test.js
// v80_e (user ruling: MERGE) — one starter card per chapter, for every chapter.
//
// Supersedes unit-next-chapter-unlocked.test.js (v77_i). That card is DELETED. The claim it was
// built to protect is NOT: finishing a chapter opens the next one, and that moment must not pass
// silently — v77_i existed because Next called loadSaved directly and the learner arrived
// mid-lesson without being told what they had earned. So this file asserts the same guarantee
// against the merged card rather than dropping it with the screen.
//
// Why the merge: v77_q had made the next-chapter-unlocked card the STARTER for chapters 2..N,
// carrying the entry card's header, storyboard, summary field and bars under a second set of ids.
// The user's plan (PLAN §C2) then asked for it to be removed "going straight to the next entry
// card" — which could not work as written, because since v77_q there was no entry card for
// chapters 2..N. Generalising the entry card is what makes that sentence true.
//
// Contract, asserted by CLICKING:
//   1. Finishing a chapter with another ahead → Next opens THAT chapter directly (no interstitial
//      of its own), and the target is still resolved at render time.
//   2. On arrival the entry card meets the learner and NAMES the chapter — the acknowledgement
//      v77_i existed for, now on the card that was already going to be shown.
//   3. It appears for a later chapter even when the storyline has NO summary. This is the
//      regression the merge could most easily have introduced: gating on the summary alone would
//      have silently dropped the acknowledgement for 25 chapters at this cut.
//   4. Forward from it starts the lesson — it orients, it does not block.
//
// ⚠️ DELIBERATELY LOST, recorded rather than implied: the old card's ← ("back to the chapter you
// just finished") is gone. After the merge the learner has already moved to the next chapter by the
// time the card renders, so a back link there would return them to a card for the chapter they are
// now IN, not the one they left. The header title still reaches the storyline, from which the
// previous chapter is one tap away.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

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

// ── 3. On arrival the entry card meets the learner and names the chapter ───
{
  const C = arriveAt(SECOND);
  assert.strictEqual(C.run(`APP._entered`), true,
    'arriving at a later chapter is met by the entry card');
  assert.strictEqual(C.run(`APP._shown`), 'summary-screen', 'and that card is the entry card');
  const named = C.run(`document.getElementById('sum-chapter').textContent || ''`);
  assert.strictEqual(named, SECOND.topic,
    'the card NAMES the chapter — the acknowledgement v77_i existed for');
  assert.strictEqual(C.run(`document.getElementById('sum-chapter').style.display`), '',
    'and that name is visible');
  assert.strictEqual(C.run(`document.getElementById('sum-title').textContent`), UI.en['unlocked.title'],
    'titled as a chapter arrival, reusing the key the deleted card already owned in 32 languages');
  assert.strictEqual(C.run(`APP._started`), null, 'and it does not skip straight into the lesson');
  console.log(`  arriving at chapter 2 -> entry card naming "${named}"`);
}

// ── 4. It appears with NO summary — the regression the merge could have caused ──
// Gating on `_summaryOfStory()` alone would drop the acknowledgement for every later chapter of a
// summary-less storyline: 25 chapters at this cut. This is the discriminating case, so it is
// asserted on a storyline chosen for having no summary rather than on a convenient one.
{
  const C = arriveAt(NS_SECOND);
  assert.strictEqual(C.run(`!!_summaryOfStory()`), false,
    'non-vacuity: this storyline genuinely has no summary');
  assert.strictEqual(C.run(`APP._entered`), true,
    'a later chapter still gets its starter card when the storyline has no summary');
  assert.strictEqual(C.run(`document.getElementById('sum-chapter').textContent`), NS_SECOND.topic,
    'and it still names the chapter');
  console.log('  no summary: a later chapter still gets its card');
}

// ── 5. The FIRST chapter of a summary-less storyline still gets NO card ────
// The other half of the gate, and the reason it is not simply "always show": v77_k kept the entry
// card off a page that would be blank. Without this the section above could pass on a rule that
// shows the card unconditionally.
{
  const NS_FIRST = byId[SL_NOSUM.chapters[0]];
  const C = arriveAt(NS_FIRST);
  assert.strictEqual(C.run(`!!_summaryOfStory()`), false, 'non-vacuity: still no summary');
  assert.strictEqual(C.run(`APP._entered`), false,
    'the FIRST chapter of a summary-less storyline shows no entry card — it would be blank');
  console.log('  no summary + first chapter: no card, as before');
}

// ── 6. Forward starts the lesson — the card orients, it does not block ─────
{
  const C = arriveAt(SECOND);
  const want = C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);
  assert.ok(want >= 0, 'non-vacuity: there is a lesson to start');
  C.run(`document.getElementById('sum-next').onclick(); true;`, 'go');
  assert.strictEqual(C.run(`APP._started`), want,
    'forward starts the lesson the learner came to play');
  console.log('  forward starts the lesson');
}

console.log('unit-next-chapter-entry: ALL PASSED');
