// unit-next-chapter-unlocked.test.js
// v77_i — the next-chapter-unlocked card: the walk's FOURTH page (roadmap §0c).
//
// Finishing a chapter opens the next one, and that moment used to pass silently — Next called
// loadSaved directly and the learner arrived mid-lesson without being told what they had earned.
//
// Contract, asserted by CLICKING (this replaces the source pin deleted from unit-learner-nav §3,
// which matched the loadSaved call that has now moved into this card — roadmap §0a):
//   1. Finishing a chapter with another ahead → Next opens the card, naming the chapter.
//   2. → from the card reaches THAT chapter via loadSaved. The destination is unchanged.
//   3. ← returns to the progress card: the walk is two-way.
//   4. The card names the chapter the button resolved — not a re-resolved, possibly different one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
// A storyline whose FIRST chapter has a successor with real lessons, so "there is a next chapter"
// is genuinely true (the corpus is not a constant — assert the case was found).
const SL = (store.storylines || []).find(sl => {
  const ts = (sl.chapters || []).map(c => byId[c]);
  return ts.length >= 2 && ts[0] && (ts[0].lessons || []).length && ts[1] && (ts[1].lessons || []).length;
});
assert.ok(SL, 'the corpus has a storyline whose first two chapters both carry lessons');
const FIRST = byId[SL.chapters[0]], SECOND = byId[SL.chapters[1]];

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

function finishFirstChapter() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
    APP._teacherMode = false; APP._slScreen = {};
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
    APP._shown = null; APP._loadedSaved = null; APP._navWent = null;
    show = function(id){ APP._shown = id; };
    loadSaved = function(x){ APP._loadedSaved = String(x); };
    openStorylineScreen = function(id){ APP._navWent = 'storyline:' + id; };
    goLandingClean = function(){ APP._navWent = 'landing'; };
    showComplete(); true;`, 'render');
  return C;
}

// ── 1. Next opens the card and NAMES the chapter ───────────────────────────
{
  const C = finishFirstChapter();
  // Non-vacuity: this must really be the next-chapter branch, not the terminal or locked one.
  assert.strictEqual(C.run(`!!document.getElementById('comp-next').disabled`), false,
    'Next is live after finishing a chapter with another ahead');
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._shown`), 'unlocked-screen',
    'Next opens the next-chapter-unlocked card instead of loading the chapter silently');
  assert.strictEqual(C.run(`APP._loadedSaved`), null,
    'and does NOT load the next chapter on the way — the card comes first');
  const named = C.run(`document.getElementById('unl-chapter').textContent || ''`);
  assert.ok(named.length > 0, 'the card names a chapter');
  assert.strictEqual(named, SECOND.topic, 'and it is the chapter that actually comes next');
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'no error was swallowed reaching the card');
  console.log(`  finishing a chapter -> card naming "${named}"`);
}

// ── 2. → reaches that chapter. The destination is unchanged. ───────────────
{
  const C = finishFirstChapter();
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  C.run(`document.getElementById('unl-next').onclick(); true;`, 'go');
  const loaded = C.run(`APP._loadedSaved`);
  assert.ok(loaded, '→ from the card loads the next chapter');
  assert.ok(loaded === (SECOND.id || SECOND.topic) || loaded.includes(SECOND.id || ''),
    `it loads the chapter the card named (loaded "${loaded}")`);
  console.log('  -> continues into that chapter (same destination as before)');
}

// ── 3. ← returns to the progress card: the walk is two-way ─────────────────
{
  const C = finishFirstChapter();
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  C.run(`APP._shown = null; document.getElementById('unl-back').onclick(); true;`, 'back');
  assert.strictEqual(C.run(`APP._shown`), 'complete-screen',
    'back returns to the progress card');
  assert.strictEqual(C.run(`APP._loadedSaved`), null,
    'and going back does not silently start the next chapter anyway');
  console.log('  <- returns to the progress card');
}

// ── 4. The card reads the STASHED target, not a re-resolved one ────────────
// If the card resolved "next chapter" again for itself, the two could disagree — which is the
// mistake v74_o avoided by reusing APP._compBack rather than deciding twice.
{
  const C = finishFirstChapter();
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  const stashed = C.run(`APP._unlNext && APP._unlNext.topic`);
  assert.strictEqual(stashed, SECOND.topic, 'the target was stashed at render time');
  assert.strictEqual(C.run(`document.getElementById('unl-chapter').textContent`), stashed,
    'and the card names exactly what was stashed');
  console.log('  card and button agree on which chapter is next');
}



// ── 5. v77_q (user): this card is the STARTER for chapters 2..N ────────────
// "It should replace the entry progress card as a starter for all but the first chapter, but it
// looks the same as the entry card" — so it carries the storyline header, the storyboard, the
// story summary and the chapter progress bars, and the entry card is confined to chapter one.
{
  const C = finishFirstChapter();
  C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');
  assert.strictEqual(C.run(`APP._shown`), 'unlocked-screen', 'the starter card is shown');
  // The storyline header, filled — not just present in the markup.
  assert.ok((C.run(`document.getElementById('unl-hdr-title').textContent || ''`)).length > 0,
    'it carries the storyline title, like every other progress card');
  assert.ok((C.run(`document.getElementById('unl-hdr-prog-txt').textContent || ''`)).length > 0,
    'and the storyline progress fraction');
  // The summary — the thing that makes it "look the same as the entry card".
  const sl = (store.storylines || []).find(x => x.id === SL.id);
  if (String(sl.summary || '').trim()) {
    assert.ok((C.run(`document.getElementById('unl-sumtext').innerHTML || ''`)).length > 0,
      'and the story summary, as the entry card shows it');
  }
  // The chapter progress bars, from the shared renderer.
  const bars = C.run(`document.getElementById('unl-progress').innerHTML || ''`);
  assert.ok(bars.length > 0, 'and the chapter progress bars');
  console.log('  starter card: header, summary and bars, like the entry card');
}

// ── 6. v77_q: the ENTRY card is chapter ONE only ───────────────────────────
// Two starter cards in a row would be the double interstitial v77_k already removed, in a new form.
{
  const C = finishFirstChapter();
  C.run(`APP.lessonData = ${JSON.stringify(SECOND)};
         APP.lang = ${JSON.stringify(SECOND.lang)}; APP.srcLang = ${JSON.stringify(SECOND.srcLang)};
         APP._skipEntryCard = false; APP._shown = null; true;`, 'ch2');
  const usedEntry = C.run(`_enterViaSummaryCard(0)`);
  assert.strictEqual(usedEntry, false,
    'a later chapter does NOT open the entry card — its starter is the next-chapter card');
  // Non-vacuity: the FIRST chapter still does.
  C.run(`APP.lessonData = ${JSON.stringify(FIRST)};
         APP.lang = ${JSON.stringify(FIRST.lang)}; APP.srcLang = ${JSON.stringify(FIRST.srcLang)};
         APP._skipEntryCard = false; APP._shown = null; true;`, 'ch1');
  const first = C.run(`_enterViaSummaryCard(0)`);
  assert.strictEqual(first, true, 'the FIRST chapter still opens the entry card');
  console.log('  entry card is chapter one only; later chapters use the starter card');
}



// ── 7. v77_q (user): EVERY progress card renders the IDENTICAL header ──────
// "They should all have the identical header, that itself looks identical to the storyline header."
// Asserted on what the headers RENDER, not on the markup: four of the five carried the right ids
// and still showed a different title, because each renderer overwrote _cardHeader's title
// afterwards and dropped the storyline icon while the fraction matched. Markup parity is not
// header parity.
{
  const C = finishFirstChapter();
  C.run(`APP._unlNext = ${JSON.stringify(SECOND)}; true;`, 'target');
  const seen = {};
  for (const [pre, call] of [['comp', 'showComplete()'], ['sum', 'showStorySummary()'],
                             ['unl', 'showNextChapterUnlocked()'], ['us', 'showStoryUnlocked()'],
                             ['fin', 'showStoryFinished()']]) {
    C.run(call + '; true;', pre);
    seen[pre] = {
      title: C.run(`document.getElementById('${pre}-hdr-title').textContent || ''`),
      frac:  C.run(`document.getElementById('${pre}-hdr-prog-txt').textContent || ''`),
      board: C.run(`(document.getElementById('${pre}-storyboard').children || []).length`),
    };
  }
  // Non-vacuity: the reference header must actually say something, or "all equal" is trivially true.
  assert.ok(seen.comp.title.length > 0 && seen.comp.frac.length > 0,
    'the completion card header is populated (the reference every other card must match)');
  for (const pre of ['sum', 'unl', 'us', 'fin']) {
    assert.strictEqual(seen[pre].title, seen.comp.title, `${pre}: same storyline title as the card`);
    assert.strictEqual(seen[pre].frac,  seen.comp.frac,  `${pre}: same storyline progress fraction`);
    assert.strictEqual(seen[pre].board, seen.comp.board, `${pre}: same storyboard under the header`);
  }
  console.log(`  all five card headers identical: "${seen.comp.title}" ${seen.comp.frac}`);
}

console.log('unit-next-chapter-unlocked: ALL PASSED');
