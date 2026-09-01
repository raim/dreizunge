// unit-story-finished.test.js
// v77_f — the story-finished card: the last page of the progress-card walk (roadmap §0c).
//
// Ruling 2a: "nothing left to do" stops being a hand-off back to the storyline (v74_o) and becomes
// a card in the walk. But v74_o fixed a REAL dead end — a disabled arrow beside no other
// affordance — and that must not come back. So the contract has two halves, and both are asserted
// here by CLICKING, never by matching source:
//
//   1. When the whole story is finished, Next LEADS to the story-finished card.
//   2. When it is NOT finished, Next still hands off exactly as v74_o does — celebrating a story
//      whose earlier chapters are unplayed would be a lie.
//   3. The new card has its own way out, or it IS the dead end v74_o removed.
//
// These replace the source pins deleted from unit-learner-nav §3 (roadmap §0a: a source regex
// cannot express "where does Next take the learner").
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const settle = () => new Promise(r => setTimeout(r, 60));
const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
// A multi-chapter storyline, so "finished" and "not finished" are genuinely different states.
//
// ⚠️ v88_o: the LAST chapter must belong to NO OTHER storyline. Every section here stands on that
// chapter and lets the card resolve its own deck via `_storylineForTopic()` — which returns the
// FIRST storyline containing the topic. A chapter that is also a member of a one-chapter storyline
// therefore resolves to THAT one, the card sees a finished single-chapter story, and §2's
// "an unfinished story does not open the finished card" fails against completely correct code.
//
// This is not hypothetical: the user's own server generated `tp_…0013` into both
// `sl_143869450` (6 chapters) and `sl_454402490` (1 chapter), and this file went red 8/8 while
// passing against the previous corpus. Third-plus instance of the standing rule — select by the
// PROPERTY the section asserts (the card must resolve back to THIS storyline), not by a proxy for
// it (`>= 2 chapters with stories`).
const _slsWith = id => (store.storylines || []).filter(s => (s.chapters || []).includes(id));
const SL = (store.storylines || []).find(sl => {
  const ts = (sl.chapters || []).map(c => byId[c]).filter(Boolean);
  if (ts.length < 2 || !ts.every(t => (t.story || '').length > 0)) return false;
  const last = ts[ts.length - 1];
  return _slsWith(last.id).length === 1;      // the card will resolve back to THIS storyline
});
assert.ok(SL, 'the corpus has a multi-chapter storyline whose chapters carry stories AND whose last '
  + 'chapter belongs to no other storyline (see the comment above — a shared last chapter makes '
  + 'every section here resolve the wrong deck)');
const TOPICS = (SL.chapters || []).map(c => byId[c]).filter(Boolean);
const LAST = TOPICS[TOPICS.length - 1];

// The landing projection carries whole topics, which is what the finished card reads for the story
// text and the solved sets (v76_e: a storyline is one unit — never a filtered projection).
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

// playThrough: how many chapters of the deck to complete before standing on `standOn`.
function play(nChapters, standOn) {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
    APP._teacherMode = false; APP._slScreen = {}; true;`, 'setup');
  for (const t of TOPICS.slice(0, nChapters)) {
    C.run(`
      APP.lessonData = ${JSON.stringify(t)};
      APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
      APP.cur = { lessonIdx:0, exercises:[], cur:0 };
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      (function(){
        var m = _solvedMap(APP.lessonData.topic);
        countedLessons(APP.lessonData).forEach(function(L){
          _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
        var d = APP.progress.completed[APP.lessonData.topic] = {};
        countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
      })();
      setComplete(APP.lessonData); true;`, 'play');
  }
  C.run(`
    APP.lessonData = ${JSON.stringify(standOn)};
    APP.lang = ${JSON.stringify(standOn.lang)}; APP.srcLang = ${JSON.stringify(standOn.srcLang)};
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                hearts:3, streak:4, bestStreak:4 };
    APP._navWent = null; APP._shown = null;
    openStorylineScreen = function(id){ APP._navWent = 'storyline:' + id; };
    goLandingClean = function(){ APP._navWent = 'landing'; };
    show = function(id){ APP._shown = id; };
    showComplete(); true;`, 'render');
  return C;
}
const clickNext = C => C.run(`document.getElementById('comp-next').onclick(); true;`, 'next');

// ── 1. Every chapter done → Next LEADS to the story-finished card ───────────
{
  const C = play(TOPICS.length, LAST);
  assert.strictEqual(C.run(`!!document.getElementById('comp-next').disabled`), false,
    'Next is live at the end of a finished story');
  clickNext(C);
  assert.strictEqual(C.run(`APP._shown`), 'finished-screen', 'Next opens the story-finished card');
  assert.strictEqual(C.run(`APP._navWent`), null,
    'and does NOT hand off to the storyline on the way — that is what ruling 2a supersedes');
  // The card swallowed nothing while rendering (v77_b).
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'rendering the walk to the finished card swallowed no errors');
  console.log('  finished story: Next -> story-finished card');
}

// ── 2. NOT finished → v74_o's hand-off is untouched ────────────────────────
// Stand on the LAST chapter with the earlier ones unplayed: nothing is left in this chapter and
// there is no next chapter, so the terminal branch fires — but the story is not finished.
{
  const C = play(0, LAST);
  // Complete only the chapter being stood on, so the terminal branch is genuinely reached.
  C.run(`(function(){
    var m = _solvedMap(APP.lessonData.topic);
    countedLessons(APP.lessonData).forEach(function(L){
      _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
    var d = APP.progress.completed[APP.lessonData.topic] = {};
    countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
    setComplete(APP.lessonData);
  })(); APP._navWent = null; APP._shown = null; showComplete(); true;`, 'partial');
  // Non-vacuity: this must really be the "nothing left" branch, or the section proves nothing
  // about it (session-28 rule 3).
  assert.strictEqual(C.run(`!!document.getElementById('comp-next').disabled`), false,
    'Next is live here too — this is the terminal branch, not the below-mark lock');
  clickNext(C);
  assert.notStrictEqual(C.run(`APP._shown`), 'finished-screen',
    'an UNFINISHED story does not open the finished card — that would be a lie');
  assert.ok(String(C.run(`APP._navWent`) || '').length > 0,
    'it hands off exactly as v74_o does, so the dead end stays fixed');
  console.log('  unfinished story: Next -> hand-off (v74_o preserved)');
}

// ── 3. The finished card is not itself a dead end ──────────────────────────
{
  const C = play(TOPICS.length, LAST);
  clickNext(C);
  C.run(`APP._navWent = null; document.getElementById('fin-out').onclick(); true;`, 'out');
  assert.ok(String(C.run(`APP._navWent`) || '').startsWith('storyline:'),
    'the finished card leads onward to the storyline');
  // Back returns to the progress card — the walk's previous page.
  const C2 = play(TOPICS.length, LAST);
  clickNext(C2);
  C2.run(`APP._shown = null; document.getElementById('fin-back').onclick(); true;`, 'back');
  assert.strictEqual(C2.run(`APP._shown`), 'complete-screen',
    'Back returns to the progress card it came from');
  console.log('  finished card: out -> storyline, back -> progress card');
}

// ── 4. It shows the WHOLE story and what was learned ───────────────────────
{
  const C = play(TOPICS.length, LAST);
  clickNext(C);
  const html = C.run(`document.getElementById('fin-story').innerHTML || ''`);
  // One collapsible section per chapter of the deck — not just the chapter just played.
  const sections = (html.match(/<details/g) || []).length;
  assert.strictEqual(sections, TOPICS.length,
    `the whole story is shown: ${TOPICS.length} chapters, found ${sections}`);
  assert.ok(TOPICS.length >= 2, 'non-vacuity: the deck really has more than one chapter');
  // Every chapter's title appears, including chapters other than the one just finished.
  // Compared through the product's OWN escaper: titles carry apostrophes ("Marakana's Cold Wind")
  // and the card escapes them, so a raw-string match fails for a reason that has nothing to do
  // with the claim (session-28 rule 1 — call the product function).
  for (const t of TOPICS) {
    const escaped = C.run(`esc(${JSON.stringify(t.topic)})`);
    assert.ok(html.includes(escaped), `chapter "${t.topic}" appears in the full story`);
  }
  const vocab = C.run(`document.getElementById('fin-vocab').innerHTML || ''`);
  const chips = (vocab.match(/vocab-chip/g) || []).length;
  assert.ok(chips > 0, 'the learned vocabulary is listed (found ' + chips + ' chips)');
  console.log(`  finished card: ${sections} chapters, ${chips} learned words`);
}

// ── 5. The vocabulary is CUMULATIVE, not just the last chapter's ───────────
// This is the §0e complaint the card exists to answer: the panel was blank or single-lesson.
{
  const all = play(TOPICS.length, LAST);
  clickNext(all);
  const nAll = (all.run(`document.getElementById('fin-vocab').innerHTML || ''`).match(/vocab-chip/g) || []).length;
  const one = play(1, TOPICS[0]);
  // Stand on chapter 1 with only chapter 1 played, then force the card open directly.
  one.run(`showStoryFinished(); true;`, 'direct');
  const nOne = (one.run(`document.getElementById('fin-vocab').innerHTML || ''`).match(/vocab-chip/g) || []).length;
  assert.ok(nAll > nOne,
    `a fully played story lists more words than a single chapter (${nAll} vs ${nOne})`);
  console.log(`  vocabulary is cumulative: ${nAll} across the story vs ${nOne} for one chapter`);
}



// ── 6. v77_m (user-reported): a STALE done-stamp must not finish a story ───
// Reported from a browser: the finished card appeared after only the FIRST chapter was solved.
// `chapterComplete` will trust a cached `chapterDone` stamp whose lesson count still matches, and
// a stamp can outlive the progress it described — a reset, a re-import, a chapter replayed under
// an older build. For every other caller that is the right trade; for the END-OF-STORY
// celebration it is the wrong one, because over-celebrating retires a story with chapters unplayed.
{
  const C = play(1, TOPICS[0]);          // ONLY the first chapter genuinely played
  // Plant exactly the stale evidence: a done stamp for a later chapter that was never completed.
  // Plant it on EVERY chapter the learner has not played. Stamping only one would leave the others
  // genuinely unfinished, and `every` would be false for a reason that has nothing to do with the
  // stamp — the section would then pass under its own revert, which is exactly what it did on the
  // first attempt (standing rule: a guard whose scenario matches nothing never reaches the branch).
  C.run(`(function(){
    var played = APP.lessonData.topic, m = _chapterDoneMap();
    (_storylineForTopic(played).sl.chapters || []).forEach(function(cid){
      var e = (APP.savedList||[]).find(function(x){ return x.id === cid; });
      if (!e || e.topic === played) return;
      m[e.topic] = { done: true, n: countedLessons(e).length };   // stamp says done, flags do not
    });
  })(); true;`, 'stale');
  // Non-vacuity: the stamp really does fool the general-purpose reader, or this proves nothing.
  const fooled = C.run(`(function(){
    var later = ${JSON.stringify(TOPICS[TOPICS.length - 1].topic)};
    var e = (APP.savedList||[]).find(function(x){ return x.topic === later; });
    return chapterComplete(e); })()`);
  assert.strictEqual(fooled, true,
    'the planted stamp really does make chapterComplete say "finished" — otherwise this is vacuous');
  const done = C.run(`_storyAllChaptersDone(_storylineForTopic(APP.lessonData.topic))`);
  assert.strictEqual(done, false,
    'but the story is NOT finished on a stamp alone — the done-flags must actually be there');
  console.log('  a stale done-stamp does not finish a story');
}

// ── 7. v77_m (user): the story-unlocked page highlights vocabulary ─────────
// It was missing the marking the progress card's panel has had since v74_n, so the same story lit
// up on one screen and not the other — on the page whose whole job is reading it.
{
  const topic = TOPICS.find(t => (t.lessons || []).some(L => (L.vocab || []).length));
  if (topic) {
    const C = play(TOPICS.length, LAST);
    C.run(`APP.lessonData = ${JSON.stringify(topic)}; showStoryUnlocked(); true;`, 'unlock');
    const html = C.run(`document.getElementById('us-story').innerHTML || ''`);
    assert.ok(html.length > 0, 'the story-unlocked page renders the story');
    assert.ok(/<mark|class="[^"]*vocab/i.test(html),
      'and marks the chapter vocabulary in it, as the progress card panel does');
    console.log('  story-unlocked page highlights vocabulary');
  } else {
    assert.fail('no chapter in this storyline carries vocabulary — cannot test highlighting');
  }
}

(async () => {
// ── 8. v77_o (user-reported, LIVE mode): chapters arrive metadata-only ─────
// The live /api/lessons list is a PROJECTION — `lessons[]` without vocab (v74_i) and NO `story` —
// while the static build ships whole topics. The finished card read its chapters straight off that
// list, so in live mode every drop-down was empty. Same live/static asymmetry as v55_s and v74_i.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  const PROJ = SAVED.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
    lessonCount: t.lessonCount,
    lessons: (t.lessons || []).map(L => ({ id: L.id, type: L.type, _hidden: L._hidden })) }));
  const FULL = Object.fromEntries(TOPICS.map(t => [t.id, t]));
  C.run(`
    APP.savedList = ${JSON.stringify(PROJ)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{} };
    APP._teacherMode = false;
    APP.lessonData = ${JSON.stringify(LAST)};
    APP.lang = ${JSON.stringify(LAST.lang)}; APP.srcLang = ${JSON.stringify(LAST.srcLang)};
    show = function(id){ APP._shown = id; };
    true;`, 'live-setup');
  // Non-vacuity: the projection really does lack the stories, or the fix is untested.
  assert.strictEqual(C.run(`_finChapters().filter(function(c){ return !!c.story; }).length`), 0,
    'the live projection carries no chapter stories — this is the reported starting state');
  C.run(`fetch = function(u){
      var m = String(u).match(/id=(tp_\\d+)/);
      var full = ${JSON.stringify(FULL)}[m ? m[1] : ''];
      return Promise.resolve({ ok: !!full, json: function(){ return Promise.resolve(full); } });
    }; true;`, 'stub-fetch');
  C.run(`showStoryFinished(); true;`, 'render');
  await settle();
  const withStory = C.run(`_finChapters().filter(function(c){ return !!c.story; }).length`);
  assert.ok(withStory > 0,
    'the card hydrates the chapters it was handed without stories (got ' + withStory + ')');
  const sections = (C.run(`document.getElementById('fin-story').innerHTML || ''`).match(/<details/g) || []).length;
  assert.strictEqual(sections, TOPICS.length,
    `and every chapter drop-down has content (${sections} of ${TOPICS.length})`);
  console.log('  live projection: chapters hydrated, ' + sections + ' drop-downs filled');
}

console.log('unit-story-finished: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
