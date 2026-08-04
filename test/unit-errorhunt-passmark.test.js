// unit-errorhunt-passmark.test.js
// v71_g: how an error-hunt lesson interacts with the pass-mark / completion counter.
//
// This was a question, and the answer has a subtlety worth pinning so a future edit cannot break it
// silently. Two facts that look contradictory but are both correct:
//
//   1. An error hunt IS a counted lesson. `_NEVER_POOLED` keeps error_hunt / ai_error_hunt out of
//      the "hidden because a mixed lesson pools it" rule — they are the final test and always count.
//   2. An error hunt contributes ZERO to the coverage denominator. Its builder returns [], so its
//      qid universe is empty and topicCoverage neither gains nor loses questions from it.
//
// The consequence: for a classic set that ends in an error hunt, coverage can read 100% with every
// OTHER lesson done, yet setComplete stays false — because setComplete requires every counted
// lesson (the error hunt included) to carry a done-flag, and showComplete deliberately does NOT
// write one for an error hunt (`!C.isErrorHunt`). The reconciliation: ehCheck() writes the error
// hunt's OWN richer completion record (score / suspect / missed) at play time, and showComplete
// skips it precisely so that record is not clobbered by the generic one. So the chapter completes
// exactly when the error hunt is actually PLAYED — never before — which is the intended gate: the
// final test must be taken, not skipped past on coverage alone.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

// A synthetic classic set: two standard lessons + a trailing error hunt. Synthetic on purpose — the
// interaction under test is structural, and a fixed shape makes the counts assertable exactly.
const TOPIC = {
  id: 'EHT', topic: 'EHT', lang: 'de', srcLang: 'en', lessons: [
    { id: 'l_a', type: 'standard', vocab: [{ target: 'HAUS', source: 'house' }, { target: 'HUND', source: 'dog' }] },
    { id: 'l_b', type: 'standard', vocab: [{ target: 'BAUM', source: 'tree' }, { target: 'STERN', source: 'star' }] },
    { id: 'l_eh', type: 'error_hunt', story: 'Das ist ein Baum.', corruptedStory: 'Das ist ein Haus.',
      edits: [{ find: 'Haus', replace: 'Baum', type: 'grammar', reason: 'wrong noun' }] },
  ],
};
const seed = (tgt) => C.run(`
  APP.lang='de'; APP.srcLang='en'; APP._teacherMode=false; APP.muted=false;
  APP.lessonData = ${JSON.stringify(TOPIC)};
  APP.lessonData.coverageTarget = ${tgt};
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:${tgt} };
  APP.progress = { completed:{}, solved:{}, learned:{} };
  APP.progress.completed['EHT'] = {};
  APP.progress.solved['EHT'] = {};
  if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-eh');

// ── 1. The error hunt counts, but adds nothing to the denominator ────────────
{
  seed(0.8);
  const counted = C.run(`countedLessons(APP.lessonData).map(L => L.type)`);
  assert.deepStrictEqual([...counted], ['standard', 'standard', 'error_hunt'],
    'the error hunt is a counted lesson (final test, never pooled/hidden)');
  assert.strictEqual(C.run(`_lessonQidUniverse(2).size`), 0, 'its question universe is empty');
  const total = C.run(`topicCoverage().total`);
  const stdTotal = C.run(`_lessonQidUniverse(0).size + _lessonQidUniverse(1).size`);
  assert.strictEqual(total, stdTotal, 'so the coverage denominator is exactly the standard lessons');
  console.log(`  error hunt: counted lesson, 0 coverage questions, denominator ${total}`);
}

// ── 2. 100% coverage + every other lesson done, error hunt NOT played → NOT complete ──
// v74_c: these blocks used to write qids straight into the solved map, which re-implemented the
// recording rule and could not see item credit. They now credit through markSolved — the real path,
// and the only one that knows a correct answer credits both a qid and its source item. APP.cur is
// MUTATED and restored rather than replaced (INTERNALS.md: sections silently depend on its default).
{
  seed(0.8);
  C.run(`(function(){
    const s = APP.progress.solved['EHT'], done = APP.progress.completed['EHT'];
    [0,1].forEach(i => {
      const _prevIdx = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
      for (let r=0;r<25;r++) buildExercises(i).forEach(ex => { markSolved(ex); });
      APP.cur.lessonIdx = _prevIdx;
      done[APP.lessonData.lessons[i].id] = { done:true, correct:1, total:1 };
    }); return true; })();`);
  assert.strictEqual(C.run(`topicCoverage().pct`), 100, 'coverage is 100%');
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), false,
    'but the chapter is NOT complete — the final test has not been taken');
  console.log('  coverage 100%, error hunt unplayed: setComplete=false (must take the test)');
}

// ── 3. Playing the error hunt (its own record) completes the chapter ─────────
// ehCheck writes completed[topic][ehId] directly; showComplete skips error hunts so it is not
// overwritten. Simulate ehCheck's write and confirm the gate opens.
{
  // continue from state in §2 is not guaranteed (each seed resets), so rebuild it.
  seed(0.8);
  C.run(`(function(){
    const s = APP.progress.solved['EHT'], done = APP.progress.completed['EHT'];
    [0,1].forEach(i => {
      const _prevIdx = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
      for (let r=0;r<25;r++) buildExercises(i).forEach(ex => { markSolved(ex); });
      APP.cur.lessonIdx = _prevIdx;
      done[APP.lessonData.lessons[i].id] = { done:true, correct:1, total:1 };
    }); return true; })();`);
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), false, 'precondition: not yet complete');
  // Drive the REAL error-hunt completion path, not a hand-written stand-in: renderErrorHunt builds
  // C.ehEditMap, then ehCheck scores and persists completed[topic][ehId]. The stub DOM returns
  // nothing for querySelector (so no visual marks), but the recording path only needs ehEditMap and
  // ehSuspect, both of which are real. This is what makes the revert of ehCheck's write fail here.
  C.run(`APP.cur = { lessonIdx: 2, ehSuspect: new Set(), ehChecked: false, correct:0, total:0 };
         renderErrorHunt(); ehCheck(); true;`, 'play-error-hunt');
  assert.ok(C.run(`!!APP.progress.completed['EHT']['l_eh']`),
    'playing the error hunt records its own completion (ehCheck)');
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), true,
    'once the error hunt is played, the chapter completes');
  console.log('  error hunt played (real ehCheck): setComplete=true');
}

// ── 4. showComplete must NOT write a done-flag for an error hunt ─────────────
// If it did, it would overwrite ehCheck's richer record (score/suspect/missed) with a generic one.
// Guarded at source: the record-completion block is gated on !C.isErrorHunt.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sc = html.slice(html.indexOf('function showComplete'));
  const body = sc.slice(0, sc.indexOf('\nfunction '));
  assert.ok(/if\(!C\._review && !C\.isErrorHunt && !lesson\._drill\)\{/.test(body),
    'showComplete records completion only for non-error-hunt, non-drill, non-review lessons');
  // And ehCheck writes its own record, so the flag still exists after playing.
  assert.ok(/completed\[topicKey\]\[lesson2\.id\]=\{/.test(html),
    'ehCheck persists the error hunt\'s own completion record');
}

// ── 5. An error hunt never blocks a mixed-driven set differently ─────────────
// The mixed path requires "every counted lesson except the mixed one is done", which includes the
// error hunt — same gate, reached by the other branch of _setCompleteRaw. A quick check that a
// mixed set with a trailing error hunt is likewise incomplete until the hunt is played.
{
  const mtopic = {
    id: 'EHM', topic: 'EHM', lang: 'de', srcLang: 'en', lessons: [
      { id: 'm_a', type: 'standard', vocab: [{ target: 'HAUS', source: 'house' }, { target: 'HUND', source: 'dog' }] },
      { id: 'm_mix', type: 'mixed', perType: 3 },
      { id: 'm_eh', type: 'error_hunt', story: 'x', corruptedStory: 'y', edits: [{ find: 'y', replace: 'x', type: 'grammar', reason: 'r' }] },
    ],
  };
  C.run(`
    APP.lessonData = ${JSON.stringify(mtopic)}; APP.lessonData.coverageTarget = 0.8;
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{}, learned:{} };
    APP.progress.completed['EHM']={}; APP.progress.solved['EHM']={};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    (function(){ const s = APP.progress.solved['EHM'];
      const _p = APP.cur.lessonIdx; APP.cur.lessonIdx = 0;
      for (let r=0;r<25;r++) buildExercises(0).forEach(ex => { markSolved(ex); });
      APP.cur.lessonIdx = _p; })();
    APP.progress.completed['EHM']['m_a'] = { done:true, correct:1, total:1 }; true;`);
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), false,
    'a mixed set with a trailing error hunt is incomplete until the hunt is played');
  C.run(`APP.progress.completed['EHM']['m_eh'] = { correct:1, wrong:0, missed:0, score:10, suspect:[], total:1 }; true;`);
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), true,
    'and completes once it is');
  console.log('  mixed set + trailing error hunt: same gate, completes when the hunt is played');
}

// ── 4. v74_b: an error hunt gates the NEXT CHAPTER, never the story itself ──────────────────
// An error hunt renders `lesson.corruptedStory` — a mangled copy of the chapter's story. Requiring
// one before the story unlocks asks the learner to repair text they have never been shown: exactly
// the circularity v71_s removed for `comprehension`, arriving through a type nobody had classified.
// `_STORY_GATED_TYPES` listed only `comprehension` while `_NEVER_POOLED` already held the complete
// post-story set, so the two copies disagreed and the incomplete one owned the gate.
//
// Asserted over the SHIPPED CORPUS rather than a fixture, because the defect was a property of real
// data (29 chapters). Guarded against going vacuous per the v71_r rule: if the corpus ever stops
// containing a visible error hunt, the section fails loudly instead of silently proving nothing.
{
  const EH = new Set(['error_hunt', 'ai_error_hunt']);
  let chaptersWithVisibleEh = 0, offenders = [];
  for (const t of (store.topics || [])) {
    if (!(t.lessons || []).some(L => L && EH.has(L.type))) continue;
    C.run(`
      APP.lessonData = ${JSON.stringify(t)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{}, learned:{} };
      APP._teacherMode = false;
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`);
    const counted = JSON.parse(C.run(
      `JSON.stringify(countedLessons(APP.lessonData).map(L => L.type || 'standard'))`));
    if (!counted.some(ty => EH.has(ty))) continue;   // hidden / pooled away → nothing to prove here
    chaptersWithVisibleEh++;
    const inGate = JSON.parse(C.run(
      `JSON.stringify(storyUnlockLessons(APP.lessonData).map(L => L.type || 'standard'))`))
      .filter(ty => EH.has(ty));
    if (inGate.length) offenders.push(`${t.topic} [${inGate.join(',')}]`);
  }
  // Non-vacuity: the assertion below is only meaningful if the corpus HAS such chapters.
  assert.ok(chaptersWithVisibleEh > 0,
    'the corpus contains at least one chapter with a visible error hunt (else this section proves nothing)');
  assert.deepStrictEqual(offenders, [],
    'no chapter gates its story behind an error hunt, which shows a corrupted copy of that story');
  console.log(`  corpus: ${chaptersWithVisibleEh} chapters with a visible error hunt, 0 gating the story`);
}

// ── 5. v74_f: the card ROUTES the learner to the hunt — it does not strand them ──────────────
// Since v74_b an error hunt is post-story: the story unlocks without it, and it gates the NEXT
// chapter instead. That makes "coverage reads 100% but the chapter is not complete" the CORRECT
// state, not a defect — but only because the completion card hands the learner the hunt. If the
// forward button ever pointed past it, that same correct state would become a dead end in which
// every bar reads full and nothing explains what is left.
//
// Asserted over the SHIPPED CORPUS, and on the button's real handler rather than its markup: the
// distinction between "renders a → glyph" and "actually starts the hunt" is the whole point, and
// checking the attribute would be the vacuous version (v73_g's icon-row test asserted the onclick
// STRING and could not see navigation at all).
{
  const EH = new Set(['error_hunt', 'ai_error_hunt']);
  const setup = (t) => {
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(t)};
      APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} };
      APP._teacherMode = false;
      APP.cur = { lessonIdx:0, exercises:[], cur:0 };
      if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
      true;`);
    // a perfect play of everything EXCEPT the hunt
    C.run(`(function(){
      var m = _solvedMap(APP.lessonData.topic);
      countedLessons(APP.lessonData).forEach(function(L){
        _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k] = 1; }); });
      var d = APP.progress.completed[APP.lessonData.topic] = {};
      countedLessons(APP.lessonData).forEach(function(L){
        if (L.type !== 'error_hunt' && L.type !== 'ai_error_hunt') d[L.id] = { done:true, correct:1, total:1 }; });
      return true; })()`);
  };

  const misrouted = [], notComplete = [];
  let withPrep = 0, huntOnly = 0;
  for (const t of (store.topics || [])) {
    const ls = t.lessons || [];
    if (!ls.some(L => L && EH.has(L.type) && !L._hidden)) continue;
    const ehIdx = ls.findIndex(L => L && EH.has(L.type) && !L._hidden);
    const prep  = ls.map((L, i) => ({ L, i }))
                    .filter(({ L }) => L && !L._hidden && !EH.has(L.type) && L.type !== 'comprehension');
    setup(t);
    if (prep.length) {
      withPrep++;
      // Finish the LAST prep lesson and press the card's forward button for real.
      C.run(`APP.cur = { lessonIdx:${prep[prep.length - 1].i}, exercises:[], cur:0,
              correct:3, total:4, mistakes:1, hearts:3, streak:2, bestStreak:2 };
             showComplete(); true;`);
      const went = C.run(`(function(){
        var e = document.getElementById('comp-next');
        if (!e) return 'no-button';
        if (e.classList.contains('locked')) return 'LOCKED';
        try { e.onclick && e.onclick(); } catch (err) { return 'threw:' + err.message; }
        return String(APP.cur.lessonIdx); })()`);
      if (String(went) !== String(ehIdx)) misrouted.push(`${t.topic}: forward went to ${went}, hunt is ${ehIdx}`);
    } else {
      // A chapter that is nothing BUT an error hunt: no prep, so nothing gates the story.
      huntOnly++;
      if (C.run(`storyUnlocked(APP.lessonData)`) !== true) {
        misrouted.push(`${t.topic}: hunt-only chapter did not unlock its story`);
      }
      if (C.run(`startLesson(${ehIdx}) === false`)) misrouted.push(`${t.topic}: hunt not startable`);
    }
    // Playing it completes the chapter — the gate opens exactly on play, never before.
    // Some chapters carry TWO hunts (`ai_error_hunt` + `error_hunt`); setComplete requires every
    // counted lesson, so ALL of them must be played. Marking only the first is what a careless
    // fixture would do, and it would have reported a product bug that is not there.
    setup(t);
    const before = C.run(`setComplete(APP.lessonData)`);
    const after = C.run(`(function(){
      var d = APP.progress.completed[APP.lessonData.topic];
      countedLessons(APP.lessonData).forEach(function(L){
        if (L.type === 'error_hunt' || L.type === 'ai_error_hunt')
          d[L.id] = { correct:3, wrong:0, missed:0, score:30, total:3 }; });
      return setComplete(APP.lessonData); })()`);
    if (before !== false || after !== true) {
      notComplete.push(`${t.topic}: setComplete ${before} → ${after} (want false → true)`);
    }
  }
  // Non-vacuity on BOTH shapes: the section must actually have exercised each branch.
  assert.ok(withPrep > 5, `chapters with prep AND a hunt exist (${withPrep}), so the routing claim is real`);
  assert.ok(huntOnly > 0, `error-hunt-only chapters exist (${huntOnly}), so the no-prep branch is real`);
  assert.deepStrictEqual(misrouted, [],
    'the completion card sends the learner to the error hunt — it never points past it');
  assert.deepStrictEqual(notComplete, [],
    'and the chapter completes exactly when the hunt is played, never before');
  console.log(`  routing: ${withPrep} chapters hand the learner the hunt, ${huntOnly} hunt-only chapters unlock and complete`);
}

// ── 6. v74_h: the lesson says HOW MANY errors there are ─────────────────────────────────────
// User request. Without a count the task has no stopping condition: a learner who has found three
// cannot know whether to keep hunting, and over-marking is scored as `wrong`, so the missing number
// costs them points.
//
// The number MUST be `C.ehEditMap.size` — what ehCheck actually scores against
// (`editTokens = new Set([...C.ehEditMap.keys()])`) — and NOT `lesson.edits.length`. buildEhEditMap
// drops an edit whose `replace` text cannot be located in the corrupted story (`if(pos<0) return;`)
// and maps a multi-word edit onto several token indices, so the two genuinely differ on shipped
// data. Displaying `edits.length` would ask for errors that cannot be found.
{
  const EH = new Set(['error_hunt', 'ai_error_hunt']);
  const missing = [], wrongCount = [];
  let rendered = 0, wouldHaveLied = 0;
  for (const t of (store.topics || [])) {
    const idx = (t.lessons || []).findIndex(L => L && EH.has(L.type) && L.corruptedStory);
    if (idx < 0) continue;
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(t)};
      APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
      APP.cur = { lessonIdx:${idx}, exercises:[], cur:0, ehSuspect:new Set() };
      renderErrorHunt(); true;`);
    const html = C.document.getElementById('ex-area').innerHTML || '';
    const m = html.match(/🔍 (\d+)/);
    const mapSize = C.run(`APP.cur.ehEditMap.size`);
    const editsLen = C.run(`(APP.lessonData.lessons[${idx}].edits || []).length`);
    if (mapSize !== editsLen) wouldHaveLied++;
    if (mapSize > 0) {
      rendered++;
      if (!m) { missing.push(String(t.topic)); continue; }
      if (Number(m[1]) !== mapSize) {
        wrongCount.push(`${t.topic}: showed ${m[1]}, scored against ${mapSize}`);
      }
    } else if (m) {
      // A lesson whose edits all failed to locate is broken; "find 0 errors" would read as an
      // instruction rather than as the symptom it is.
      missing.push(`${t.topic}: showed a count of 0`);
    }
  }
  assert.ok(rendered > 10, `error hunts with locatable edits exist (${rendered}), so this is testable`);
  // Non-vacuity for the CHOICE of counter: if the two numbers never differed, this section could
  // not tell a correct implementation from one reading `edits.length`.
  assert.ok(wouldHaveLied > 0,
    `on shipped data ehEditMap.size and edits.length differ (${wouldHaveLied} chapters), so using the wrong one would be visible`);
  assert.deepStrictEqual(missing, [], 'every error hunt with locatable errors displays the count');
  assert.deepStrictEqual(wrongCount, [],
    'and the displayed count is the one ehCheck scores against, never the raw edits array');
  console.log(`  count shown on ${rendered} error hunts; ${wouldHaveLied} would have been wrong from edits.length`);
}

console.log('unit-errorhunt-passmark: ALL PASSED');
