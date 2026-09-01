// unit-observations-log.test.js
// PLAN §8/B1 (v81_j) — the append-only observations log, per bayesian_knowledge_tracing.md §13.
//
// Two properties matter more than matching the doc's 6-field schema exactly (the roadmap's own
// framing): record the FIRST attempt distinctly from retries, and preserve a canonical B3 skill
// ID when a vocabulary exercise has one. This file pins both, plus the wiring into `check()` —
// assertions on the helper alone prove nothing about whether the caller actually invokes it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons }));

// A standard (vocab) lesson with enough entries for a real MCQ (3 distractors + the answer), that
// ALSO belongs to a storyline — so §6/§7 can exercise storylineId/topicId/lessonId together instead
// of needing a second fixture for each.
function slFor(topicName) {
  return (store.storylines || []).find(sl => (sl.chapters || []).some(cid => {
    const t = store.topics.find(x => x.id === cid);
    return t && t.topic === topicName;
  }));
}
const FIX = (() => {
  for (const t of store.topics) {
    const ls = t.lessons || [];
    const idx = ls.findIndex(L => L && (!L.type || L.type === 'standard') && !L._hidden &&
      (L.vocab || []).length >= 4);
    if (idx < 0) continue;
    const sl = slFor(t.topic);
    if (!sl) continue;
    return { t, idx, slId: sl.id };
  }
  return null;
})();
assert.ok(FIX, 'the corpus has a standard lesson (>=4 vocab, in a storyline) to drive a real round through');

function open() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false; APP.muted = true;
    APP.lessonData = ${JSON.stringify(FIX.t)};
    APP.lang = ${JSON.stringify(FIX.t.lang)}; APP.srcLang = ${JSON.stringify(FIX.t.srcLang)};
    show = function(id){ APP._shown = id; };
    speak = function(){};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    true;`, 'open');
  return C;
}

// ── 1. _obsLog() lazily creates ONE array and reuses it (identity, not a fresh [] each call) ──
{
  const C = open();
  const same = C.run(`(function(){
    var a = _obsLog(); a.push('x'); var b = _obsLog();
    return a === b && b.length === 1;
  })()`);
  assert.strictEqual(same, true, '_obsLog() returns the SAME array on repeat calls');
  console.log('  _obsLog(): one array, reused');
}

// ── 2. _storylineIdForTopic resolves a real membership and returns null for a non-member ──
{
  const C = open();
  const got = C.run(`_storylineIdForTopic(${JSON.stringify(FIX.t.topic)})`);
  assert.strictEqual(got, FIX.slId, '_storylineIdForTopic resolves the fixture storyline');
  const none = C.run(`_storylineIdForTopic('__no_such_topic_at_all__')`);
  assert.strictEqual(none, null, 'a topic in no storyline resolves to null, not undefined or a throw');
  console.log('  _storylineIdForTopic: real membership resolved, non-member is null');
}

// ── 3. recordObservation: full field shape, firstAttempt true→false on repeat, null when untagged ──
{
  const C = open();
  C.run(`APP.cur = { lessonIdx: ${FIX.idx} }; true;`);
  const ex = { target: 'apfel', source: 'apple', correct: 'apfel', type: 'mcq_target_source' };
  const first = JSON.parse(C.run(`recordObservation(${JSON.stringify(ex)}, true); JSON.stringify(_obsLog())`));
  assert.strictEqual(first.length, 1, 'one observation written');
  const o = first[0];
  assert.strictEqual(o.userId, null, 'userId is null (no auth model yet)');
  assert.strictEqual(o.skillId, null, 'an untagged/legacy exercise remains explicitly unassigned');
  assert.strictEqual(o.correct, true, 'correct carries the verdict passed in');
  assert.strictEqual(o.evidence, 'corpus', 'evidence is "corpus" — the only type Dreizunge produces today');
  assert.strictEqual(o.storylineId, FIX.slId, 'storylineId resolved from the open topic');
  assert.strictEqual(o.topicId, FIX.t.id, 'topicId is the open topic\'s id');
  assert.strictEqual(o.lessonId, FIX.t.lessons[FIX.idx].id, 'lessonId is the CURRENT lesson\'s id (via APP.cur.lessonIdx)');
  assert.ok(o.qid, 'qid is set');
  assert.strictEqual(o.firstAttempt, true, 'the very first observation of this qid is a first attempt');
  assert.ok(typeof o.timestamp === 'string' && o.timestamp, 'timestamp is a non-empty string');

  // Same qid again (a retry, or the same exercise answered a second time) → firstAttempt flips.
  const second = JSON.parse(C.run(`recordObservation(${JSON.stringify(ex)}, false); JSON.stringify(_obsLog())`));
  assert.strictEqual(second.length, 2, 'appended, not overwritten — this is an append-only log');
  assert.strictEqual(second[1].firstAttempt, false, 'a second observation of the SAME qid is not a first attempt');
  assert.strictEqual(second[1].correct, false, 'and carries its own (different) verdict');

  // A DIFFERENT question is its own first attempt.
  const ex2 = { target: 'birne', source: 'pear', correct: 'birne', type: 'mcq_target_source' };
  const third = JSON.parse(C.run(`recordObservation(${JSON.stringify(ex2)}, true); JSON.stringify(_obsLog())`));
  assert.strictEqual(third.length, 3);
  assert.strictEqual(third[2].firstAttempt, true, 'a different qid is its own first attempt');
  assert.notStrictEqual(third[2].qid, third[0].qid, 'sanity: the two exercises really did get different qids');
  console.log('  recordObservation: full field shape correct; firstAttempt true only once per qid');
}

// ── 4. Withheld items are excluded, exactly like markSolved/markWrong ──
// `_itemWithheld` reads the flag off the RESOLVED SOURCE ITEM (`_exFlagTarget`), not off the
// exercise object directly — so the fixture must flag a REAL vocab item and build `ex` from it,
// or `_resolveExItem` finds no match and the flag is silently inert (proving nothing).
{
  const C = open();
  const n = C.run(`(function(){
    APP.cur = { lessonIdx: ${FIX.idx} };
    var item = APP.lessonData.lessons[${FIX.idx}].vocab[0];
    item.userFlag = true;
    var ex = { target: item.target, source: item.source, correct: item.target, type: 'mcq_target_source' };
    recordObservation(ex, true);
    return _obsLog().length;
  })()`);
  assert.strictEqual(n, 0, 'a flagged/withheld item is not recorded as evidence');
  console.log('  recordObservation: withheld items excluded');
}

// ── 5. Defensive: no lessonData / no exercise never throws, never appends ──
{
  const C = open();
  const ok = C.run(`(function(){
    APP.lessonData = null;
    recordObservation({target:'x',correct:'x'}, true);
    recordObservation(null, true);
    return true;   // did not throw
  })()`);
  assert.strictEqual(ok, true, 'recordObservation degrades safely with no lessonData / no exercise');
  console.log('  recordObservation: defensive on missing lessonData/exercise');
}

// ── 6. THE WIRING: check() actually calls recordObservation, live and wrong, never on replay ──
// Mirrors the answerWrong() pattern from unit-tap-word.test.js — drives a REAL exercise through
// the DOM-facing check(), because assertions on recordObservation alone (§3 above) prove nothing
// about whether check() calls it (v71_u rule).
{
  // v88_h (the flake audit): dispatch on the EXERCISE TYPE, not on "are there .choice buttons".
  //
  // The old shape asked `document.querySelectorAll('.choice')` first and took the MCQ branch if it
  // returned anything — but lib-dom's querySelectorAll matches over the tree parsed from
  // index.html and does NOT re-parse innerHTML assigned at runtime (INTERNALS → harness limits).
  // So on a TYPED exercise it still saw four stale `.choice` buttons, drove the MCQ path, left
  // `#type-in` empty, and check() correctly graded the empty string as wrong — recording a
  // "correct" answer as incorrect. Measured, not guessed: instrumenting the failure printed
  // `{"type":"listen_type","tiValue":"","choices":4,"recorded":false}` on every occurrence.
  //
  // That is the whole of this file's intermittency: ~2 runs in 30, entirely dependent on whether
  // buildExercises' non-deterministic content happens to put a TYPED exercise second. It is NOT a
  // product bug (check() compares the typed value against ex.correct and is correct), and it is NOT
  // "fails under suite load, not standalone" as the session prompt has claimed since v81_b — it
  // fails standalone at the same rate.
  //
  // The type list mirrors check()'s own typed branch (`listen_type`/`type_plural`/
  // `type_conjugation`); anything else that renders choices takes the MCQ path.
  const TYPED = ['listen_type', 'type_plural', 'type_conjugation'];
  function answer(C, wantCorrect) {
    return C.run(`(function(){
      var Cur = APP.cur, ex = Cur.exercises[Cur.cur];
      var typed = ${JSON.stringify(TYPED)}.indexOf(ex.type) >= 0;
      var btns = typed ? [] : [].slice.call(document.querySelectorAll('.choice'));
      if (btns.length) {
        var correctBtn = null, wrongBtn = null;
        for (var i = 0; i < btns.length; i++) {
          if (btns[i].textContent.trim() === String(ex.correct)) correctBtn = btns[i];
          else if (!wrongBtn) wrongBtn = btns[i];
        }
        var pick = ${wantCorrect ? 'correctBtn' : 'wrongBtn'};
        if (!pick) return false;
        pickChoice(btns.indexOf(pick), pick);
        if (!APP.cur.answered) check();
        return APP.cur.answered;
      }
      var ti = document.getElementById('type-in');
      if (ti) {
        ti.value = ${wantCorrect ? 'ex.correct' : "'zzz-not-the-answer'"};
        check();
        return APP.cur.answered;
      }
      return false;
    })()`);
  }

  const C = open();
  C.run(`startLesson(${FIX.idx}); true;`, 'start');
  assert.strictEqual(C.run(`_obsLog().length`), 0, 'nothing recorded before any answer');

  const droveWrong = answer(C, false);
  assert.ok(droveWrong, 'the fixture is a drivable shape (MCQ or typed) for a wrong answer');
  assert.strictEqual(C.run(`_obsLog().length`), 1, 'one wrong answer -> exactly one observation');
  assert.strictEqual(C.run(`_obsLog()[0].correct`), false, 'and it is recorded as incorrect');
  assert.strictEqual(C.run(`_obsLog()[0].firstAttempt`), true, 'first time this question is seen');

  // Replaying the SAME (already-answered) question must NOT add a second observation — a review
  // render is not a play (INTERNALS).
  C.run(`check(true); true;`, 'replay');
  assert.strictEqual(C.run(`_obsLog().length`), 1, 'check(true) (replay) adds NO observation');

  // Move to the next question and answer it correctly.
  const advanced = C.run(`(function(){ if (APP.cur.cur + 1 >= APP.cur.exercises.length) return false;
    APP.cur.cur++; APP.cur.answered = false; renderEx(); return true; })()`);
  if (advanced) {
    // v88_h: `droveRight` is now ASSERTED, not merely tested. The old `if (droveRight)` silently
    // skipped both assertions whenever the driver failed to drive — which is exactly what the stale
    // `.choice` bug caused on a typed exercise, so this section was VACUOUS on some passing runs and
    // red on others, from the same root cause. A driver that cannot drive is a finding, not a reason
    // to check nothing.
    const droveRight = answer(C, true);
    assert.ok(droveRight,
      'the second exercise is drivable to a CORRECT answer (type: '
      + C.run(`APP.cur.exercises[APP.cur.cur].type`) + '). If this fails, the driver above does not '
      + 'handle that exercise type — do NOT re-wrap this in an `if`, teach answer() the type.');
    assert.strictEqual(C.run(`_obsLog().length`), 2, 'a second LIVE answer -> a second observation');
    assert.strictEqual(C.run(`_obsLog()[1].correct`), true, 'recorded as correct this time');
  }
  console.log(`  check() wiring: live answers recorded (${C.run('_obsLog().length')} total), replay recorded none`);

  // B3 path: a canonical skill ID survives real exercise construction and the DOM-facing
  // `check()` call. Build until the normal random round surfaces a tagged vocabulary exercise;
  // the builder is intentionally non-deterministic in content, so this steers the fixture instead
  // of assuming a source-object match or a particular question type.
  const tagged = open();
  const skillId = `${FIX.t.lang}:vocab:registry-proof`;
  const built = tagged.run(`(function(){
    var vocab = APP.lessonData.lessons[${FIX.idx}].vocab;
    // Exercise item resolution is content-keyed (not object-identity keyed), and this corpus
    // fixture may contain duplicate forms. Tag the whole generated vocab pool so whichever
    // canonical source row the real resolver selects still proves propagation, not sampling luck.
    vocab.forEach(function(v){ v.skillId = ${JSON.stringify(skillId)}; });
    var at = -1;
    for(var attempt = 0; attempt < 40 && at < 0; attempt++) {
      startLesson(${FIX.idx});
      at = APP.cur.exercises.findIndex(function(ex){ return ex.skillId === ${JSON.stringify(skillId)}; });
    }
    if (at < 0) return null;
    APP.cur.cur = at; APP.cur.answered = false; renderEx();
    return APP.cur.exercises[at].skillId || null;
  })()`);
  assert.strictEqual(built, skillId, 'a resolved vocab ID is carried onto its built exercise');
  assert.ok(answer(tagged, false), 'the tagged vocabulary exercise is live-answerable');
  assert.strictEqual(tagged.run(`_obsLog()[0].skillId`), skillId,
    'check() records the canonical skill ID, not null or a model proposal');
  assert.strictEqual(tagged.run(`APP.progress.bktShadow.skills[${JSON.stringify(skillId)}].attempts`), 1,
    'the same live observation is consumed by B4 shadow mode after it is appended');
  console.log('  B3 skill path: resolved vocab ID -> exercise -> live observation');
}

console.log('unit-observations-log: ALL PASSED');
