// probe_gates_v80c1.js — the two progress-card gate bugs from implementation_plan.md §C1.
//
// Reported by the user, both about navigation stepping over a gate:
//   BUG 1  "I browsed forward to the story card and back, solved no comprehension lesson, yet
//           could proceed to the next chapter."
//   BUG 2  "Via the replay button or otherwise, I could play the comprehension lessons BEFORE
//           the chapter-story was unlocked."
//
// The plan's suspicion is that "the gate is computed from render state rather than lesson state".
// This probe does NOT assume that. It drives the PRODUCT functions (rule: a probe must call the
// product function, never a re-typed copy) and reports which branch of showComplete each scenario
// actually lands on, plus what the replay helpers resolve to.
//
// It reports. It does not assert. A fixer is not a diagnosis (rule 23), and neither is a probe:
// this exists so the edit that follows is aimed at something measured.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── Fixture selection, reported so a data drop that moves it is visible ──────
// The scenario needs: prep lessons, at least one STORY-GATED lesson after them, a story, and a
// storyline with a LATER chapter (bug 1 is "could proceed to the next chapter" — with no next
// chapter there is nothing to proceed to and the probe would measure the terminal branch instead).
const isPost = L => L && (L.type === 'comprehension' || L.type === 'error_hunt' || L.type === 'ai_error_hunt');
const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));

function pick() {
  for (const sl of (store.storylines || [])) {
    const ids = sl.chapters || [];
    for (let i = 0; i < ids.length - 1; i++) {         // not the last chapter
      const t = byId[ids[i]];
      if (!t) continue;
      const ls = (t.lessons || []).filter(L => L && !L._hidden);
      if ((t.story || '').length > 100 && ls.some(L => !isPost(L)) && ls.some(isPost)) return { t, sl, at: i };
    }
  }
  return null;
}
const PICK = pick();
if (!PICK) { console.log('NO FIXTURE: no storyline chapter with prep + story-gated lessons and a successor.'); process.exit(0); }
const { t: TOPIC, sl: SL, at: AT } = PICK;

const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons,
  lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length }));

const GATED = (TOPIC.lessons || []).map((L, i) => ({ L, i })).filter(x => isPost(x.L));
console.log('fixture');
console.log('  storyline : ' + (SL.title || SL.id) + '  (' + (SL.chapters || []).length + ' chapters, this is #' + (AT + 1) + ')');
console.log('  chapter   : ' + TOPIC.topic + '  [' + TOPIC.id + ']');
console.log('  lessons   : ' + (TOPIC.lessons || []).map((L, i) => i + ':' + (L.type || 'standard') + (isPost(L) ? '*' : '')).join(' ') + '   (* = story-gated)');
console.log('  next ch.  : ' + ((byId[(SL.chapters || [])[AT + 1]] || {}).topic || '(unresolved)'));
console.log('');

// ── Harness ─────────────────────────────────────────────────────────────────
// `prepDone` seeds the PREP lessons only, which is what opens the story gate. `curIdx` is the
// lesson the card is rendering for — that is the "render state" the plan suspects, so it is a
// parameter rather than a constant.
function scene(opts) {
  const o = opts || {};
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList  = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:${o.target == null ? 1 : o.target} };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP._slScreen = {};
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){
      var d = APP.lessonData, m = _solvedMap(d.topic);
      var done = APP.progress.completed[d.topic] = {};
      if (${o.prepDone ? 'true' : 'false'}) {
        (d.lessons||[]).forEach(function(L, i){
          if (!L || _isStoryGatedLesson(L)) return;
          try { _lessonItemUniverse(i).forEach(function(k){ m[k]=1; }); } catch(e){}
          done[L.id] = { done:true, correct:4, total:4 };
        });
      }
    })();
    // Record where each exit goes, WITHOUT taking the exit — the destination is the finding.
    APP._went = null; APP._started = null; APP._shown = null;
    show                    = function(id){ APP._shown = id; };
    startLesson             = function(i){ APP._started = i; APP._went = 'lesson:' + i; return true; };
    showNextChapterUnlocked = function(){ APP._went = 'NEXT-CHAPTER'; };
    showStoryUnlocked       = function(){ APP._went = 'story-unlocked-page'; };
    showStoryFinished       = function(){ APP._went = 'story-finished'; };
    compBackToStory         = function(){ APP._went = 'back-to-storyline'; };
    saveProg                = function(){};
    APP.cur = { lessonIdx:${o.curIdx || 0}, exercises:[], cur:0, correct:${o.correct == null ? 4 : o.correct},
                total:4, mistakes:0, hearts:3, streak:1, bestStreak:1 };
    showComplete(); true;`, 'render');
  return C;
}
const q = (C, expr) => C.run(expr);
function report(C, label) {
  const gate    = q(C, `storyUnlocked(APP.lessonData)`);
  const setDone = q(C, `setComplete(APP.lessonData)`);
  const first   = q(C, `_firstUnfinishedLessonIdx(APP.lessonData)`);
  const errs    = JSON.parse(q(C, `JSON.stringify(_cardErrors())`));
  q(C, `document.getElementById('comp-next').onclick(); true;`);
  const went    = q(C, `APP._went`);
  console.log('  ' + label);
  console.log('    storyUnlocked=' + gate + '  setComplete=' + setDone + '  _firstUnfinishedLessonIdx=' + first);
  console.log('    Next -> ' + went + (errs.length ? '   [swallowed: ' + errs.length + ']' : ''));
  return { gate, setDone, first, went };
}

// ── BUG 1 ───────────────────────────────────────────────────────────────────
// The comprehension lesson's done-flag is deliberately withheld until every question is answered
// correctly (v71_s). So "played it, got some wrong" is a real, common state in which the lesson is
// unfinished. Rendering the card FOR that lesson is what browsing forward and back produces.
console.log('BUG 1 — can the learner reach the next chapter with a story-gated lesson unfinished?');
const G = GATED[0].i;
report(scene({ prepDone: true, curIdx: 0 }),                    'A  card for a PREP lesson, comprehension never played');
report(scene({ prepDone: true, curIdx: G, correct: 0 }),        'B  card for the COMPREHENSION lesson, none of it correct');
report(scene({ prepDone: true, curIdx: G, correct: 0, target: 0.8 }), 'C  as B, but with the pass mark at 0.8 instead of 1');
console.log('');

// ── BUG 2 ───────────────────────────────────────────────────────────────────
// Story LOCKED (no prep done). _firstUnfinishedLessonIdx applies a _storyLocked filter; the probe
// asks whether the REPLAY path applies the same one, since that is the path the user named.
console.log('BUG 2 — with the story LOCKED, where do the replay helpers point?');
{
  const C = scene({ prepDone: false, curIdx: 0 });
  const gate  = q(C, `storyUnlocked(APP.lessonData)`);
  const first = q(C, `_firstUnfinishedLessonIdx(APP.lessonData)`);
  const cov   = q(C, `(typeof _firstCoverageShortLessonIdx === 'function') ? _firstCoverageShortLessonIdx() : 'ABSENT'`);
  const nameOf = i => (typeof i === 'number' && i >= 0)
    ? i + ':' + ((TOPIC.lessons[i] || {}).type || 'standard') + (isPost(TOPIC.lessons[i]) ? ' (STORY-GATED)' : '')
    : String(i);
  console.log('    storyUnlocked=' + gate);
  console.log('    _firstUnfinishedLessonIdx  -> ' + nameOf(first));
  console.log('    _firstCoverageShortLessonIdx -> ' + nameOf(cov));
  // repeatForCoverage is what the Replay button calls; drive it rather than reasoning about it.
  q(C, `APP._started = null; repeatForCoverage(); true;`);
  console.log('    repeatForCoverage() starts -> ' + nameOf(q(C, `APP._started`)));
}
console.log('');
console.log('(reported, not asserted — see the header)');

// ── FOLLOW-UP, added after the first run reported bug 1 NOT reproducing ──────
// The below-threshold branch caught scenarios B and C, which is correct behaviour, so the reading
// of index.html:15493 that motivated them was wrong. What is left to check is the state the
// done-flag WRITE creates. v71_s withholds a story-gated lesson's done-flag until every question
// is right — but the guard it is written behind is:
//     _record = !(_lc.total > 0) || _lc.solved >= _lc.total;
// `_lc` is lessonCoverage, whose universe is the lesson's SOURCE ITEMS (v74_c). A comprehension
// lesson's questions are not items. So if that universe is EMPTY, `!(total > 0)` is true and the
// flag is written on any play, however badly it went — which would make the chapter complete and
// the next chapter reachable with nothing comprehended.
console.log('FOLLOW-UP — the item universe of each lesson, and what the done-flag write depends on');
{
  const C = scene({ prepDone: true, curIdx: 0 });
  const rows = JSON.parse(C.run(`JSON.stringify((APP.lessonData.lessons||[]).map(function(L,i){
    var u = { n: -1 }, cov = null;
    try { u.n = _lessonItemUniverse(i).size; } catch(e) { u.n = 'THREW'; }
    try { cov = lessonCoverage(i); } catch(e) { cov = null; }
    var qn = 'n/a';
    try { if (typeof _lessonQidUniverse === 'function') qn = Array.from(_lessonQidUniverse(i)||[]).length; } catch(e) { qn = 'THREW'; }
    return { i: i, type: (L.type||'standard'), gated: !!_isStoryGatedLesson(L),
             counted: !!lessonCountsFor(APP.lessonData, L), items: u.n, qids: qn,
             covTotal: cov ? cov.total : null };
  }))`));
  for (const r of rows) {
    console.log('    ' + r.i + ':' + r.type.padEnd(14) + ' gated=' + (r.gated ? 'Y' : 'n')
      + ' counted=' + (r.counted ? 'Y' : 'n') + '  items=' + r.items + '  qids=' + r.qids
      + '  lessonCoverage.total=' + r.covTotal
      + (r.covTotal === 0 ? '   <-- done-flag write is UNCONDITIONAL here' : ''));
  }
}
console.log('');

// If that universe is empty, this is the sequence: play the gated lesson, answer everything wrong,
// and see what the card offers next. correct:0 with a real round recorded.
console.log('BUG 1 (retry) — play the gated lesson badly, with the round actually recorded');
{
  const C = scene({ prepDone: true, curIdx: GATED[0].i, correct: 0 });
  const flag = C.run(`JSON.stringify(APP.progress.completed[APP.lessonData.topic][APP.lessonData.lessons[${GATED[0].i}].id] || null)`);
  console.log('    done-flag written for the gated lesson: ' + flag);
  const r = report(C, 'after that play');
  console.log('    chapterComplete(active topic) = ' + C.run(`chapterComplete(APP.lessonData)`));
}

// ── BUG 2 (retry) — solved but not FLAGGED ──────────────────────────────────
// The first bug-2 run found the replay helper pointing at a prep lesson, because a prep lesson was
// still coverage-short. But _firstCoverageShortLessonIdx iterates countedLessons(d), which INCLUDES
// the story-gated lessons, and — unlike _firstUnfinishedLessonIdx — applies NO _storyLocked filter.
// So the state that matters is: every prep lesson fully SOLVED (nothing coverage-short) but not yet
// DONE-flagged (story still locked). A learner who answers a round correctly and leaves before the
// card renders is in exactly that state: markSolved writes as they answer, the done-flag is written
// by showComplete.
console.log('BUG 2 (retry) — prep fully SOLVED but not done-flagged, so the story is still locked');
{
  const C = scene({ prepDone: false, curIdx: 0 });
  C.run(`(function(){
    var d = APP.lessonData, m = _solvedMap(d.topic);
    (d.lessons||[]).forEach(function(L, i){
      if (!L || _isStoryGatedLesson(L)) return;
      try { _lessonItemUniverse(i).forEach(function(k){ m[k]=1; }); } catch(e){}
    });
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
  })(); true;`, 'solve-not-flag');
  const nameOf = i => (typeof i === 'number' && i >= 0)
    ? i + ':' + ((TOPIC.lessons[i] || {}).type || 'standard') + (isPost(TOPIC.lessons[i]) ? ' (STORY-GATED)' : '')
    : String(i);
  console.log('    storyUnlocked = ' + C.run(`storyUnlocked(APP.lessonData)`) + '   (locked = the learner has not earned the story)');
  console.log('    _firstUnfinishedLessonIdx    -> ' + nameOf(C.run(`_firstUnfinishedLessonIdx(APP.lessonData)`)) + '   (applies the _storyLocked filter)');
  console.log('    _firstCoverageShortLessonIdx -> ' + nameOf(C.run(`_firstCoverageShortLessonIdx()`)) + '   (does it?)');
  C.run(`APP._started = null; repeatForCoverage(); true;`);
  console.log('    Replay button (repeatForCoverage) starts -> ' + nameOf(C.run(`APP._started`)));
}
