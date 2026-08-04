// unit-comprehension-gate.test.js
// v71_s: a comprehension lesson asks about the chapter's STORY, so it cannot be part of the gate
// that unlocks that story.
//
// User-reported, as a conceptual error rather than a bug: "text can only be comprehended once the
// story is unlocked". Before this release a learner had to finish EVERY counted lesson — the
// comprehension one included — before the story was revealed on the completion card, and learners
// never see the lesson-set page (v60.1) so that card is the only place it appears. They were being
// asked questions about text they had never been shown, answerable only by guessing — which then
// wrote "solved" entries into the coverage store and "known" entries into the ledger.
//
// The fix splits the gate in TWO layers. Missing either one leaves the circle intact, which is the
// main thing this file exists to pin:
//   • lesson layer   — setComplete requires every counted lesson;
//   • coverage layer — topicCoverage unions the universe over every counted lesson, so the
//                      comprehension questions sat inside the very denominator gating the unlock.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

// A chapter with real vocabulary AND a real comprehension lesson. Hand-built rather than taken
// from the corpus: the corpus fixture is not a constant (v71 harness rule), and this scenario needs
// an exact, stable question count on both sides of the gate.
const VOCAB = [
  { target: 'Haus',   source: 'house' },
  { target: 'Katze',  source: 'cat' },
  { target: 'Baum',   source: 'tree' },
  { target: 'Wasser', source: 'water' },
];
const QUESTIONS = [
  { q: 'Where did the cat sit?', choices: ['In the tree', 'In the water', 'On the house'], correctIndex: 0, why: 'It climbed.' },
  { q: 'What did it drink?',     choices: ['Water', 'Tree', 'House'],                      correctIndex: 0, why: 'Stated.' },
];
const mkTopic = (key, withComprehension) => ({
  topic: key, lang: 'de', srcLang: 'en',
  story: 'Die Katze sass im Baum. Das Haus war still. Sie trank Wasser.',
  lessons: [
    { id: key + '_v', type: 'standard', vocab: VOCAB },
    ...(withComprehension ? [{ id: key + '_c', type: 'comprehension', questions: QUESTIONS }] : []),
  ],
});

const seed = (topicObj) => C.run(`
  APP.lessonData = ${JSON.stringify(topicObj)};
  APP.lang = 'de'; APP.srcLang = 'en';
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:1 };
  APP.progress = { completed:{}, solved:{}, learned:{}, chapterDone:{} };
  APP.progress.completed[APP.lessonData.topic] = {};
  APP.progress.solved[APP.lessonData.topic] = {};
  APP.cur.lessonIdx = 0;
  APP._teacherMode = false; APP.muted = false;
  if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse(); true;`, 'seed-' + topicObj.topic);

// Mark a lesson's done-flag, the way finishing it does.
const finish = (lessonId) => C.run(
  `APP.progress.completed[APP.lessonData.topic][${JSON.stringify(lessonId)}] = {correct:1,total:1}; true;`);
// Solve every question a lesson can ask (a perfect play of it, played to exhaustion).
// Uses the qid UNIVERSE rather than a single derivation: buildStandardExercises samples one
// exercise type per vocab item (the v71_f finding), so one build covers only part of what the
// lesson can ask — and a coverage assertion built on it would silently measure the wrong thing.
// v74_c: this used to write qids from _lessonQidUniverse straight into the solved map. That
// bypassed markSolved entirely, so it re-implemented the recording rule — and a harness that
// re-implements the rule it is testing agrees with a broken implementation (the v73_i measuring
// script had exactly this bug). It now drives a REAL perfect play: build the lesson's full question
// set and credit each answer through markSolved, which is the only thing that knows a correct
// answer credits both a qid and its source item.
const solveLesson = (idx) => C.run(`(function(){
  const prev = APP.cur;
  APP.cur = { lessonIdx: ${idx} };
  const L = APP.lessonData.lessons[${idx}];
  const wasD = APP._derivingUniverse; APP._derivingUniverse = true;
  let exs = []; try { exs = lessonTypeMeta(L.type).build(L, ${idx}) || []; } catch(_) {}
  APP._derivingUniverse = wasD;
  let n = 0;
  exs.forEach(ex => { if (markSolved(ex)) n++; });
  APP.cur = prev;
  return n; })()`);

// ── 1. The premise: a comprehension lesson really does hold questions ────────
// If the builder ever stops producing them this whole file would pass vacuously — the gate would
// be "narrowed" by removing nothing. Asserted first, for the same reason §8 of unit-replay-focus
// now guards against its own vacuity.
{
  seed(mkTopic('GateA', true));
  const nComp = C.run(`(function(){ APP._derivingUniverse = true;
    const e = buildExercises(1); APP._derivingUniverse = false; return e.length; })()`);
  assert.strictEqual(nComp, QUESTIONS.length,
    `the comprehension lesson asks ${QUESTIONS.length} questions — the gate has something real to exclude`);
  console.log(`  premise: comprehension lesson yields ${nComp} questions`);
}

// ── 2. The coverage layer: comprehension is out of the unlock denominator ────
{
  seed(mkTopic('GateB', true));
  const full = C.run('topicCoverage().total');
  const narrowed = C.run('topicCoverage(true).total');
  assert.ok(full > narrowed,
    `the narrowed denominator drops the comprehension questions (${narrowed} vs ${full})`);
  assert.strictEqual(full - narrowed, QUESTIONS.length,
    'and drops exactly them — no more, no less');
  console.log(`  coverage layer: unlock denominator ${narrowed}, whole chapter ${full}`);
}

// ── 3. The lesson layer + the two gates disagreeing, which is the whole point ─
// A perfect play of the vocabulary lesson, and nothing else. The story must be READABLE; the
// chapter must NOT be complete. Before v71_s these were the same verdict and both were false.
{
  seed(mkTopic('GateC', true));
  solveLesson(0);
  finish('GateC_v');
  const unlocked = C.run('storyUnlocked(APP.lessonData)');
  const complete = C.run('setComplete(APP.lessonData)');
  assert.strictEqual(unlocked, true,
    'story unlocks once the non-comprehension lessons are done — the learner can now READ it');
  assert.strictEqual(complete, false,
    'but the chapter is NOT complete: the comprehension lesson has not been played');
  console.log('  gates disagree as designed: story unlocked, chapter incomplete');

  // Now play the comprehension lesson too → the chapter completes.
  solveLesson(1);
  finish('GateC_c');
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), true, 'story stays unlocked');
  assert.strictEqual(C.run('setComplete(APP.lessonData)'), true,
    'and the chapter completes once comprehension is done — progression still requires it');
}

// ── 3b. The coverage layer, exercised BEHAVIOURALLY ─────────────────────────
// §3 above runs at coverageThreshold 1, where `_setCompleteRaw` skips the coverage check entirely
// (`if (tgt < 1)`) — so it proves the lesson layer and nothing else. This scenario puts the gate
// wholly in the coverage layer's hands: a pass mark of 0.8, and enough comprehension questions
// that leaving them in the denominator holds the learner below it forever.
//   whole chapter    = 12 vocab + 6 comprehension = 18 → 12/18 = 67%, below the 80% mark
//   unlock-only      = 12 vocab                        → 12/12 = 100%
// So under the old rule this story could never unlock no matter how perfectly the vocabulary was
// learned, and the only way up was to answer questions about the story it was withholding.
{
  const many = { q: '', choices: ['a', 'b', 'c'], correctIndex: 0 };
  const topicG = {
    topic: 'GateG', lang: 'de', srcLang: 'en', story: 'Die Katze sass im Baum.',
    lessons: [
      { id: 'GateG_v', type: 'standard', vocab: VOCAB },
      { id: 'GateG_c', type: 'comprehension',
        questions: [1, 2, 3, 4, 5, 6].map(i => ({ ...many, q: 'Question ' + i + '?' })) },
    ],
  };
  seed(topicG);
  C.run("APP.info.coverageThreshold = 0.8; APP.lessonData.coverageTarget = 0.8; true;");
  const full = C.run('topicCoverage().total');
  const narrowed = C.run('topicCoverage(true).total');
  // v74_c: the denominator counts SOURCE ITEMS, not the questions built from them — so these are
  // the vocab entries and the comprehension questions themselves, not the 12/18 question instances
  // the builder used to emit. Derived from the fixture rather than hardcoded, so the structural
  // claim (unlock = vocabulary only; whole chapter = vocabulary + comprehension) survives a change
  // to either array.
  assert.strictEqual(narrowed, VOCAB.length, 'unlock denominator is the vocabulary items only');
  assert.strictEqual(full, VOCAB.length + 6, 'whole-chapter denominator adds the six comprehension questions');
  assert.ok(VOCAB.length / (VOCAB.length + 6) < 0.8,
    'the fixture keeps whole-chapter coverage below the 80% mark after a perfect vocabulary play, or the section proves nothing');

  solveLesson(0);            // a PERFECT play of the vocabulary
  finish('GateG_v');
  const pctFull = C.run('topicCoverage().solved') / full;
  assert.ok(pctFull < 0.8,
    `whole-chapter coverage is ${Math.round(pctFull * 100)}% — below the 80% mark, which is what used to hold the story shut`);
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), true,
    'the story unlocks anyway: the pass mark is measured over what the learner could actually study');
  assert.strictEqual(C.run('setComplete(APP.lessonData)'), false,
    'and the chapter is still incomplete, so progression is unaffected');
  console.log(`  coverage layer behaviourally: ${Math.round(pctFull * 100)}% whole-chapter vs 100% unlock-only → unlocked`);
}

// ── 4. The circularity is genuinely gone ────────────────────────────────────
// The sharp version: with NOTHING about the comprehension lesson answered, is the story readable?
// Under the old rule the answer was no, and it could only become yes by answering questions about
// the unreadable story.
{
  seed(mkTopic('GateD', true));
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), false, 'nothing done yet → story locked');
  solveLesson(0); finish('GateD_v');
  const compSolved = C.run(`(function(){
    const s = APP.progress.solved[APP.lessonData.topic];
    const L = APP.lessonData.lessons[1];
    return Object.keys(s).filter(id => id.startsWith(L.id + ':')).length; })()`);
  assert.strictEqual(compSolved, 0, 'no comprehension question has been answered…');
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), true,
    '…and the story is readable anyway — the circle is broken');
}

// ── 5. Chapters WITHOUT a comprehension lesson are untouched ────────────────
// The narrowed gate must be a no-op for the overwhelming majority of chapters, or this release
// silently changed when every existing story unlocks.
{
  seed(mkTopic('GateE', false));
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), C.run('setComplete(APP.lessonData)'),
    'no comprehension lesson → the two gates agree (nothing done)');
  solveLesson(0); finish('GateE_v');
  assert.strictEqual(C.run('storyUnlocked(APP.lessonData)'), C.run('setComplete(APP.lessonData)'),
    'no comprehension lesson → the two gates agree (everything done)');
  assert.strictEqual(C.run('topicCoverage(true).total'), C.run('topicCoverage().total'),
    'and the coverage denominators are identical');
  console.log('  chapters without comprehension: both gates identical, denominators identical');
}

// ── 6. storyUnlocked must not stamp chapter completion ──────────────────────
// _recordChapterDone persists a verdict that OTHER chapters are read back from. Stamping the
// narrowed gate would make a chapter read as finished on the storyline page while its
// comprehension lesson had never been opened.
{
  seed(mkTopic('GateF', true));
  solveLesson(0); finish('GateF_v');
  C.run('storyUnlocked(APP.lessonData); true;');
  const stampAfterUnlock = C.run('JSON.stringify(APP.progress.chapterDone || {})');
  assert.ok(!/GateF/.test(stampAfterUnlock) || /"done":false/.test(stampAfterUnlock),
    'storyUnlocked leaves no "done:true" stamp behind: ' + stampAfterUnlock);
  assert.strictEqual(C.run('chapterComplete(APP.lessonData)'), false,
    'and the shared chapter-complete reader still says the chapter is unfinished');
  console.log('  storyUnlocked does not stamp chapter completion');
}

// ── 7. Source pins: one rule, not two ───────────────────────────────────────
// The failure mode this codebase keeps hitting (three _itemWithheld spellings, v71_l) is a second
// copy of a rule that then drifts. storyUnlocked must delegate to _setCompleteRaw, never restate it.
{
  const su = html.slice(html.indexOf('function storyUnlocked(d) {'));
  const body = su.slice(0, su.indexOf('function _setCompleteRaw'));
  assert.ok(/_setCompleteRaw\(d, true\)/.test(body),
    'storyUnlocked delegates to the shared rule with the story-gated lessons skipped');
  assert.ok(!/countedLessons\(d\)\.every/.test(body),
    'and does not restate the completion rule locally');
  assert.ok(/function storyUnlockLessons\(d\) \{ return countedLessons\(d\)\.filter/.test(html),
    'the narrowed lesson set is a filter of countedLessons, not a parallel visibility rule');
  // v74_b: this used to pin the literal `new Set(['comprehension'])` — a claim about spelling that
  // could not see the defect it sat next to. The table was a SECOND, incomplete copy of the
  // post-story classification (`_NEVER_POOLED` already held the complete one), so the error hunts
  // were absent from it and 29 corpus chapters gated the story behind a corrupted copy of that
  // story. Asserted behaviourally now: every post-story type is story-gated, no prep type is, and
  // the pooling table DERIVES from the same set rather than restating it.
// Behaviour FIRST, source pins after: an `assert` aborts the file, so a source pin placed above
// would shadow the behavioural failure and report a spelling change where the real signal is that
// the gate moved (v71_r — a later section that never runs proves nothing).
  for (const ty of ['comprehension', 'error_hunt', 'ai_error_hunt']) {
    assert.strictEqual(C.run(`lessonPhase({ type: ${JSON.stringify(ty)} })`, 'ph'), 'post',
      `${ty} depends on the story, so it is post-story`);
    assert.strictEqual(C.run(`_isStoryGatedLesson({ type: ${JSON.stringify(ty)} })`, 'g'), true,
      `${ty} is therefore story-gated and cannot sit in the story's own gate`);
  }
  // `mixed` is the one that must NOT drift into post: it is an alternative way to play the prep
  // lessons, so treating it as its own phase would take the mixed round out of the story gate and
  // strand every mixed-driven chapter. A standard lesson carries no `type` field at all (v71_u).
  for (const ty of ['standard', 'word_forms', 'synonyms', 'grammar', 'conjugation', 'mixed']) {
    assert.strictEqual(C.run(`lessonPhase({ type: ${JSON.stringify(ty)} })`, 'ph2'), 'prep',
      `${ty} is preparation for the story`);
    assert.strictEqual(C.run(`_isStoryGatedLesson({ type: ${JSON.stringify(ty)} })`, 'g2'), false,
      `${ty} is not story-gated`);
  }
  assert.strictEqual(C.run(`lessonPhase({})`, 'ph3'), 'prep',
    'a lesson with no type field is a standard lesson, hence prep');
  assert.ok(/const _STORY_GATED_TYPES = _POST_STORY_TYPES;/.test(html),
    'story-gating is derived from the phase set, not a second table');
  assert.ok(/const _NEVER_POOLED = new Set\(\[\.\.\._POST_STORY_TYPES, 'mixed'\]\);/.test(html),
    'and so is the pooling exclusion — one classification, two derived rules');
  console.log('  source: one shared rule, narrowed by a derived phase set');
}

// ── 8. "Repeat until correct": a comprehension lesson is DONE only at 100% ──
// User requirement: comprehension must be "solved completely (repeat lessons until correct) before
// proceeding to the next chapter". Understanding a text is pass/fail in a way vocabulary practice
// is not — a learner who answered three of five questions about a story has not understood it, and
// the chapter's pass mark (which may be 80%) is the wrong instrument.
//
// Implemented at the WRITE site: the done-flag is simply not recorded until the lesson's coverage
// is complete. `done[L.id]` has ~12 readers and every one of them inherits the requirement without
// learning a second rule — including setComplete, the path lock and the chapter gate.
{
  seed(mkTopic('GateH', true));
  const compIdx = 1;
  // Finish the vocabulary lesson first. Without it an earlier unfinished lesson exists, and the
  // card's "next lesson in this chapter" branch legitimately wins ahead of the below-mark lock —
  // so the assertion below would be testing branch order, not the 100% rule.
  solveLesson(0); finish('GateH_v');
  // v74_c: the 100% rule is measured over the lesson's SOURCE ITEMS, which for a comprehension
  // lesson are precisely its questions — so this reads the item universe, not the qid universe.
  const uni = C.run(`Array.from(_lessonItemUniverse(${compIdx}))`);
  assert.ok(uni.length >= 2, 'the comprehension lesson has several questions to be partial about');

  // Play it, getting only the FIRST question right.
  const partial = () => C.run(`(function(){
    const s = APP.progress.solved[APP.lessonData.topic];
    s[${JSON.stringify(uni[0])}] = 1;
    APP.cur = { lessonIdx: ${compIdx}, exercises: [], cur: 0, correct: 1, total: ${uni.length},
                mistakes: ${uni.length - 1}, hearts: 3, streak: 0, bestStreak: 1 };
    showComplete();
    return JSON.stringify(APP.progress.completed[APP.lessonData.topic] || {}); })()`);
  const afterPartial = JSON.parse(partial());
  assert.ok(!afterPartial['GateH_c'],
    'a partially-solved comprehension lesson is NOT recorded as done — the learner repeats it');
  assert.strictEqual(C.run('setComplete(APP.lessonData)'), false,
    'so the chapter does not complete, and the next chapter stays locked');
  // Next must be locked, with the remediation buttons available (the v71_d route back in).
  assert.ok(C.run(`document.getElementById('comp-next').classList.contains('locked')`),
    'Next is visibly locked while questions remain unanswered');

  // Now solve the rest → the flag lands and the chapter completes.
  C.run(`(function(){ const s = APP.progress.solved[APP.lessonData.topic];
    ${JSON.stringify(uni)}.forEach(id => s[id] = 1); return true; })()`);
  const afterFull = JSON.parse(C.run(`(function(){
    APP.cur = { lessonIdx: ${compIdx}, exercises: [], cur: 0, correct: ${uni.length},
                total: ${uni.length}, mistakes: 0, hearts: 3, streak: 2, bestStreak: 2 };
    showComplete();
    return JSON.stringify(APP.progress.completed[APP.lessonData.topic] || {}); })()`));
  assert.ok(afterFull['GateH_c'], 'once every question is solved the lesson records as done');
  assert.ok(!C.run(`document.getElementById('comp-next').classList.contains('locked')`),
    'and Next unlocks');
  console.log(`  100% rule: partial play not recorded, full play recorded (${uni.length} questions)`);
}

// ── 9. A review render must not be judged ───────────────────────────────────
// showComplete(true) repoints APP.cur at the LAST counted lesson so the vocab recap resolves — the
// comprehension one, in any chapter ending with it. Nothing was answered on a review render, so
// applying the 100% rule there would lock Next on an ALREADY-FINISHED chapter and hide the
// "story complete" ending behind a "Keep going!" card. (Caught by smoke-render, not by design.)
{
  seed(mkTopic('GateI', true));
  solveLesson(0); finish('GateI_v');
  // Chapter finished except that comprehension was never played — then re-opened for review.
  C.run(`(function(){
    APP.cur = { lessonIdx: 1, exercises: [], cur: 0, correct: 0, total: 0, mistakes: 0,
                hearts: 3, streak: 0, bestStreak: 0 };
    showComplete(true); return true; })()`);
  assert.ok(!C.run(`document.getElementById('comp-next').classList.contains('locked')`),
    'a review render does not apply the 100% rule');
  const recorded = JSON.parse(C.run('JSON.stringify(APP.progress.completed[APP.lessonData.topic]||{})'));
  assert.ok(!recorded['GateI_c'], 'and records nothing for the lesson it merely pointed at');
  console.log('  review render: not judged, not recorded');
}

// ── 10. A mixed lesson never pools comprehension ────────────────────────────
// Same conceptual error by a side door: a mixed round drawing from an earlier comprehension
// sibling would ask story questions while the story was still locked. It also keeps the
// comprehension lesson visible as its own node instead of being folded in as a hidden sibling.
{
  const topicJ = {
    topic: 'GateJ', lang: 'de', srcLang: 'en', story: 'Die Katze sass im Baum.',
    lessons: [
      { id: 'GateJ_v', type: 'standard', vocab: VOCAB },
      { id: 'GateJ_c', type: 'comprehension', questions: QUESTIONS },
      { id: 'GateJ_m', type: 'mixed', perType: 3 },
    ],
  };
  seed(topicJ);
  const srcIdx = C.run(`(function(){
    APP._derivingUniverse = true;
    const exs = buildExercises(2) || [];
    APP._derivingUniverse = false;
    return Array.from(new Set(exs.map(e => e._srcLessonIdx).filter(v => v !== undefined))); })()`);
  assert.ok(!srcIdx.includes(1), 'the mixed round draws nothing from the comprehension lesson');
  const anyComp = C.run(`(function(){
    APP._derivingUniverse = true;
    const exs = buildExercises(2) || [];
    APP._derivingUniverse = false;
    return exs.some(e => e && e.type === 'comprehension_mcq'); })()`);
  assert.strictEqual(anyComp, false, 'and asks no comprehension question');
  // The mixed lesson's own coverage universe must agree, or its denominator counts questions it
  // will never ask and the round can never reach the target.
  const mixUni = C.run('_lessonQidUniverse(2).size');
  const compUni = C.run('_lessonQidUniverse(1).size');
  const vocabUni = C.run('_lessonQidUniverse(0).size');
  assert.strictEqual(mixUni, vocabUni,
    `the mixed universe is the poolable siblings only (${mixUni} vs vocab ${vocabUni}, comprehension ${compUni})`);
  console.log(`  mixed pooling: comprehension excluded from both the round and the denominator`);
}

console.log('unit-comprehension-gate: ALL PASSED');
