// unit-story-summary.test.js
// v77_h — the story-summary card: the FIRST page of the progress-card walk (roadmap §0c).
//
// Contract, all asserted by CLICKING rather than by matching source:
//   1. ← on the progress card opens the summary card.
//   2. The summary shown is the STORYLINE's, in the SOURCE language — it is authored there and
//      nothing is translated on the way.
//   3. → returns to the progress card. The walk goes both ways or it is not a walk.
//   4. When the storyline has NO summary the control is HIDDEN, so it can never lead to a blank
//      page. (37 of 84 storylines carry no summary.)
//   5. The card renders with the progress bars EMPTY — it sits before any question of the chapter.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
const pick = wantSummary => (store.storylines || []).find(sl => {
  const has = !!String(sl.summary || '').trim();
  if (has !== wantSummary) return false;
  return (sl.chapters || []).some(c => byId[c] && (byId[c].lessons || []).length);
});
const SL_WITH = pick(true), SL_WITHOUT = pick(false);
// The corpus is not a constant: both cases must exist or the file has nothing to say (rule: assert
// the case was found, or the section goes vacuous on new data).
assert.ok(SL_WITH, 'the corpus has a storyline WITH a summary');
assert.ok(SL_WITHOUT, 'the corpus has a storyline WITHOUT a summary');

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

function open(sl) {
  const topic = (sl.chapters || []).map(c => byId[c]).find(t => t && (t.lessons || []).length);
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:2, total:4, mistakes:2 };
    APP._shown = null; APP._navWent = null;
    show = function(id){ APP._shown = id; };
    openStorylineScreen = function(id){ APP._navWent = 'storyline:' + id; };
    goLandingClean = function(){ APP._navWent = 'landing'; };
    showComplete(); true;`, 'render');
  return { C, topic };
}
const state = (C, id) => C.run(`(function(){ var e=document.getElementById(${JSON.stringify(id)});
  if(!e) return 'MISSING'; if(e.style.display==='none') return 'HIDDEN';
  return e.disabled ? 'GREY' : 'LIVE'; })()`);

// ── 1-2. ← opens the card, showing the storyline's own summary ─────────────
{
  const { C } = open(SL_WITH);
  assert.strictEqual(state(C, 'comp-prev'), 'LIVE',
    'the ← control is offered when the storyline has a summary');
  C.run(`document.getElementById('comp-prev').onclick(); true;`, 'prev');
  assert.strictEqual(C.run(`APP._shown`), 'summary-screen', '← opens the summary card');
  const txt = C.run(`document.getElementById('sum-sumtext').innerHTML || ''`);
  assert.ok(txt.length > 0, 'the summary card is populated');
  // It is THIS storyline's summary, not some other text. Compared through the product's own
  // escaper, since the summary carries punctuation the card escapes.
  const head = String(SL_WITH.summary).trim().slice(0, 40);
  assert.ok(txt.includes(C.run(`esc(${JSON.stringify(head)})`)),
    "the text shown is this storyline's own summary");
  // Rendering the walk swallowed nothing (v77_b).
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'no error was swallowed reaching the summary card');
  console.log('  ← opens the summary card, showing this storyline\'s summary');
}

// ── 3. → returns to the progress card ──────────────────────────────────────
{
  const { C } = open(SL_WITH);
  C.run(`document.getElementById('comp-prev').onclick(); true;`, 'prev');
  C.run(`APP._shown = null; document.getElementById('sum-next').onclick(); true;`, 'fwd');
  assert.strictEqual(C.run(`APP._shown`), 'complete-screen',
    '→ returns to the progress card — the walk goes both ways');
  console.log('  → returns to the progress card');
}

// ── 4. No summary → the control is hidden, never a blank page ──────────────
{
  const { C } = open(SL_WITHOUT);
  assert.strictEqual(state(C, 'comp-prev'), 'HIDDEN',
    'with no summary the ← control is hidden, so it cannot lead to a blank page');
  console.log('  no summary: the control is hidden rather than leading nowhere');
}

// ── 5. The bars are EMPTY: this page precedes any question of the chapter ───
{
  const { C } = open(SL_WITH);
  C.run(`document.getElementById('comp-prev').onclick(); true;`, 'prev');
  // v77_p (user ruling): the entry card shows ALL the progress bars, the same ones every other
  // progress card shows. §0c's "bars empty" was right when this page only ever preceded the first
  // question; it is now the entry point for EVERY visit, including resuming a half-played chapter,
  // where an empty bar would misreport where the learner is. The claim is therefore that it renders
  // the SAME bars — asserted by comparing against the progress card's own renderer rather than by
  // matching markup, so the two cannot drift.
  const prog = C.run(`document.getElementById('sum-progress').innerHTML || ''`);
  assert.ok(prog.length > 0, 'the entry card shows progress bars');
  const cardProg = C.run(`(function(){ try {
    return _compProgressHtml(APP.lessonData && APP.lessonData.topic,
      _storylineForTopic(APP.lessonData && APP.lessonData.topic), { skipStoryRow: true });
  } catch(e){ return 'THREW:' + e.message; } })()`);
  assert.strictEqual(prog, cardProg,
    'and they are exactly the progress card\'s bars — one renderer, so the two cannot disagree');
  console.log('  entry card: shows the same progress bars as the progress card');
}

// ── 6. Section ORDER — v82_e (user report, with two screenshots); RESCOPED at the progress-card
// popup redesign, see below ──
// The entry card (summary-screen) and the progress card (complete-screen) are two separate STATIC
// markup blocks in index.html, not one shared render — so nothing stops them drifting apart, and
// they had: the progress card moved its bars to the BOTTOM (v80_y/v81_b) and its content-box to the
// TOP, but the entry card was never brought forward from the v77_o-era order it was written to.
// v82_e's fix made the two cards match section-for-section; the progress-card popup redesign
// deliberately ends that parity for the progress card alone — see the comment below the entry-card
// assertion for what replaced it and why.
//
// Asserted on SOURCE POSITION rather than a live DOM walk — deliberately, not as a shortcut. Both
// cards are STATIC markup (`loadClient()`'s harness never loads index.html's <body>, only its
// <script>, so there is no live tree to walk here at all), and nothing in the client ever reorders
// these containers at runtime (confirmed: every `sum-*`/`comp-*` reference in index.html is a
// `getElementById` read/write, never an `insertBefore`/`append` reorder) — so source position IS
// the render order, not a proxy that could diverge from it the way a regex over computed text can.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // Absolute source position, not scoped to the screen — safe because every id checked here is
  // already prefixed distinctly per screen (`sum-*` vs `comp-*`), so there is no cross-screen
  // collision to guard against, and each element must exist exactly once in the file.
  const posOf = (elId) => {
    const re = new RegExp(`id="${elId}"`, 'g');
    const hits = [...html.matchAll(re)];
    assert.strictEqual(hits.length, 1, `${elId} appears exactly once in index.html (got ${hits.length})`);
    return hits[0].index;
  };
  const orderOf = (ids) =>
    ids.map(([label, elId]) => [label, posOf(elId)])
       .sort((a, b) => a[1] - b[1]).map(p => p[0]);
  const entryOrder = orderOf(
    [['content', 'sum-sumbox'], ['storyboard', 'sum-storyboard'], ['actions', 'sum-actions'],
     ['bars', 'sum-progress'], ['title', 'sum-title']]);
  assert.deepStrictEqual(entryOrder, ['content', 'storyboard', 'actions', 'bars', 'title'],
    `entry card section order — got ${JSON.stringify(entryOrder)}`);
  // user (progress-card redesign): SUPERSEDES the cross-card parity claim this section used to
  // assert. The progress card's storyboard/actions/bars moved OFF the scrolling page entirely, into
  // `#comp-nav-modal` — a popup reached via the ☰ button in the story panel's own header row. The
  // entry/summary card above was NOT asked to change and keeps exactly its old mirrored layout, so
  // the two cards can no longer read as "one shared row order" the way this test used to require —
  // that was always a proxy for "moving between the two screens feels the same," and it no longer
  // can, by the user's own design: the progress card now deliberately reads DIFFERENTLY, text-first,
  // precisely because it is the one this redesign is about.
  //
  // What DOES still hold, and is asserted instead: content still leads the progress card's own
  // scrolling page, and the verdict/title is still the LAST thing on it — the popup, when open, is
  // a separate overlay on top, not a row of "the page" in the sense this test measures.
  const progressPageOrder = orderOf(
    [['content', 'comp-story-panel'], ['title', 'comp-title']]);
  assert.deepStrictEqual(progressPageOrder, ['content', 'title'],
    `progress card's own scrolling-page order — got ${JSON.stringify(progressPageOrder)}`);
  console.log('  entry card keeps its own order; the progress card leads with content and closes ' +
    'with the verdict on its own page (machinery now lives in a popup): OK');
}



// loadSaved is async (it awaits fetch and goLessonSet), so the assertions must run after the
// microtask queue drains. Without this the section would read APP._shown before loadSaved has
// written it and would pass or fail on timing rather than behaviour.
const settle = () => new Promise(r => setTimeout(r, 50));

// ── 6. v77_k: the summary card is the ACTUAL ENTRY POINT ───────────────────
// Opening a chapter shows the summary first, and its forward starts the lesson the learner came
// to play. Driven through loadSaved — the real entry path — rather than by calling the renderer.
(async () => {
  const topic = (SL_WITH.chapters || []).map(c => byId[c]).find(t => t && (t.lessons || []).length);
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP._shown = null; APP._started = null; APP._skipEntryCard = false;
    show = function(id){ APP._shown = id; };
    startLesson = function(i){ APP._started = i; return true; };
    saveProg = function(){};
    true;`, 'setup');
  const idx = C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`);
  assert.ok(idx >= 0, 'non-vacuity: this chapter has an unfinished lesson to enter');

  // Drives the REAL entry path — loadSaved itself, with fetch stubbed to hand back this chapter —
  // rather than the decision function alone. Calling `_enterViaSummaryCard` directly would prove
  // the decision works while leaving the WIRING unguarded: removing the call from loadSaved would
  // not fail such a test, which is exactly the gap revert-verification exposed here.
  C.run(`
    goLessonSet = async function(){ return true; };
    fetch = function(){ return Promise.resolve({ ok:true,
      json: function(){ return Promise.resolve(${JSON.stringify(topic)}); } }); };
    loadSaved(${JSON.stringify(topic.id)}); true;`, 'enter');
  await settle();
  assert.strictEqual(C.run(`APP._shown`), 'summary-screen',
    'entering a chapter shows the summary card FIRST');
  assert.strictEqual(C.run(`APP._started`), null, 'and does not start the lesson underneath it');
  C.run(`document.getElementById('sum-next').onclick(); true;`, 'start');
  assert.strictEqual(C.run(`APP._started`), idx,
    'forward from the entry card starts the lesson the learner came to play');
  console.log('  entry: chapter -> summary card -> the lesson');

  // ~~Arriving from the next-chapter-unlocked card must NOT stack a second interstitial.~~
  // WITHDRAWN at v80_e, because the condition it protected against cannot occur any more. That
  // card is DELETED and merged into this one (user ruling, PLAN §C2), so there is exactly one
  // starter card per chapter and nothing for it to stack with. `APP._skipEntryCard` — the flag
  // this section drove — went with it.
  //
  // Re-asserted as the property that actually matters now, which is the same property stated
  // without the deleted machinery: entering a chapter shows the card ONCE, and going forward from
  // it lands in the lesson rather than on another card.
  C.run(`APP._shown = null; APP._started = null;
    loadSaved(${JSON.stringify(topic.id)}); true;`, 're-enter');
  await settle();
  assert.strictEqual(C.run(`APP._shown`), 'summary-screen', 're-entering shows the one starter card');
  C.run(`document.getElementById('sum-next').onclick(); true;`, 'start');
  assert.strictEqual(C.run(`APP._started`), idx,
    'and forward from it lands in the lesson, not on a second interstitial');
  assert.ok(!/_skipEntryCard/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')),
    'the skip flag is gone with the card it existed for — if it returns, so has the double card');
  console.log('  one starter card per chapter, forward goes to the lesson');
  
})().catch(e => { console.error(e); process.exit(1); });

// ── 7. v77_r (user): the summary lives in the standard read-aloud FIELD ────
// "Both the summary on the entry card and the presentation of unlocked chapter should embed their
// text into our usual fields that have read-out buttons." Wherever there is body text on a card,
// there must be a way to hear it — asserted as a working handler, not as a button that exists.
{
  const { C } = open(SL_WITH);
  C.run(`document.getElementById('comp-prev').onclick(); true;`, 'prev');
  assert.notStrictEqual(C.run(`document.getElementById('sum-sumbox').style.display`), 'none',
    'the summary sits in the bordered field, like every other body text on a card');
  assert.ok(C.run(`typeof document.getElementById('sum-sum-spk').onclick === 'function'`),
    'and carries a working read-aloud button');
  assert.ok((C.run(`document.getElementById('sum-sum-spk').title || ''`)).length > 0,
    'with a label');
  // The translate button appears ONLY when a translation exists — a dead button is worse than none.
  const hasAlt = !!String(SL_WITH.summaryTranslation || SL_WITH.summaryTarget || '').trim();
  assert.strictEqual(C.run(`document.getElementById('sum-sum-xlate').style.display`) !== 'none', hasAlt,
    'the translate button appears exactly when there is a translation to show');
  console.log('  summary is in the standard field, with read-aloud' + (hasAlt ? ' and translate' : ''));
}

// ── 8. v77_r (user-reported): wiping progress RE-LOCKS the chapters ────────
// The wipe cleared `completed` and `solved` but not `chapterDone` — the cached completeness STAMP
// that `chapterComplete` trusts ahead of the flags. So after a wipe every chapter still read
// "finished": later chapters stayed unlocked and the storyline bar stayed fully green with nothing
// played. Both symptoms, one cause.
{
  const topic = (SL_WITH.chapters || []).map(c => byId[c]).find(t => t && (t.lessons || []).length);
  const { C } = open(SL_WITH);
  C.run(`
    APP.lessonData = ${JSON.stringify(topic)};
    (function(){ var d = APP.lessonData, m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      countedLessons(d).forEach(function(L){
        try { _lessonItemUniverse(d.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); } catch(e){}
        done[L.id] = { done:true, correct:4, total:4 }; });
    })();
    setComplete(APP.lessonData); true;`, 'play');
  assert.strictEqual(C.run(`chapterComplete(APP.lessonData)`), true,
    'non-vacuity: the chapter really is complete before the wipe');
  assert.ok(C.run(`!!_chapterDoneMap()[APP.lessonData.topic]`),
    'and a done-STAMP was written — the thing the wipe used to leave behind');
  // Drive the PRODUCT's own wipe — re-typing what it does would test the copy, not the button
  // (session-28 rule 1), and the whole defect was that the real one missed a store.
  C.run(`
    confirm = function(){ return true; };
    _renderStorylineScreen = function(){};
    APP._slScreen = { chainId: 'x', encodedChain: 'x', topics: [APP.lessonData.topic] };
    _slBottomChapters = function(){ return { topics: [APP.lessonData.topic] }; };
    slBottomClearProgress(); true;`, 'wipe');
  // ORDER MATTERS: `chapterComplete` re-stamps as a side effect, so the stamp must be inspected
  // BEFORE anything asks the question — otherwise the check reads a record it has just created
  // itself. (That is exactly how the first version of this assertion failed against a correct fix.)
  // This is the discriminating part: clearing `completed`/`solved` alone leaves a stale "finished"
  // record behind for any later reader that trusts it.
  assert.strictEqual(C.run(`!!(APP.progress.chapterDone && APP.progress.chapterDone[APP.lessonData.topic])`), false,
    'the cached done-STAMP is cleared by the wipe, not left behind for the next reader');
  assert.strictEqual(C.run(`chapterComplete(APP.lessonData)`), false,
    'and the chapter is NOT complete afterwards — so the next chapter re-locks');
}

console.log('unit-story-summary: ALL PASSED');
