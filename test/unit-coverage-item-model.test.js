// unit-coverage-item-model.test.js
// v74_c — coverage counts SOURCE ITEMS (the vocabulary / sentences / synonym groups / word-form
// items that sit in lessons.json), not the questions a builder spins out of them.
//
// This file guards the PROPERTY that motivated the change, over the real corpus, because both
// defects it closes were properties of real data rather than of any fixture:
//
//   • AUDIO. The qid universe was cached under an audio key ('na'/'m'/'a'), because listening
//     exercises are not built when muted or voiceless — while the solved store is one flat map per
//     topic. So solves earned in one audio state were measured against a denominator derived in
//     another. Measured before v74_c: 284 of 298 topics changed denominator; `Churros und Chaos`
//     was 83 audible, 67 muted, 51 with no voice. A learner who had answered every question they
//     were ever asked read 64/83 — below the mark, Next locked, and unrecoverable, because the 16
//     missing questions were listening items a muted app never offers.
//   • SAMPLING. Builders that cap sample which items to quiz, so the denominator moved run to run
//     on 15 of 294 topics. An item count cannot sample: no builder runs at all.
//
// Both are asserted here as ZERO, not as "improved".
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client(topic, extra){
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} };
    APP._teacherMode = false;
    APP.cur = { lessonIdx:0, exercises:[], cur:0 };
    ${extra || ''} true;`, 'setup');
  return C;
}
const MUTED   = 'APP.muted = true;';
const NO_VOICE = 'ttsVoiceAvailableFor = function(){ return false; };';

const topics = (store.topics || []).filter(t => (t.lessons || []).length);
assert.ok(topics.length > 50, 'the corpus has enough chapters for this to mean something');

// ── 1. The denominator does not depend on audio state ────────────────────────
{
  const drift = [];
  let sawListening = 0;
  for (const t of topics) {
    let audible, muted, voiceless, qAudible, qMuted;
    try {
      audible   = client(t).run(`topicCoverage().total`, 'a');
      muted     = client(t, MUTED).run(`topicCoverage().total`, 'm');
      voiceless = client(t, NO_VOICE).run(`topicCoverage().total`, 'n');
      // Non-vacuity: this chapter must actually CONTAIN audio-dependent questions, or it proves
      // nothing. Measured against the qid universe, which is still audio-keyed by design.
      qAudible = client(t).run(`(function(){var n=0;countedLessons(APP.lessonData).forEach(function(L){
        n += _lessonQidUniverse(APP.lessonData.lessons.indexOf(L)).size;});return n;})()`, 'qa');
      qMuted   = client(t, NO_VOICE).run(`(function(){var n=0;countedLessons(APP.lessonData).forEach(function(L){
        n += _lessonQidUniverse(APP.lessonData.lessons.indexOf(L)).size;});return n;})()`, 'qm');
    } catch (_) { continue; }
    if (qAudible !== qMuted) sawListening++;
    if (audible !== muted || audible !== voiceless) {
      drift.push(`${t.topic}: ${audible} audible / ${muted} muted / ${voiceless} voiceless`);
    }
  }
  // Without this the section goes vacuous the day the corpus loses its listening content: every
  // denominator would trivially agree and the guard would prove nothing (v71_r rule).
  assert.ok(sawListening > 20,
    `the corpus contains chapters whose QUESTION count really does move with audio (${sawListening}), so item-invariance is a real claim`);
  assert.deepStrictEqual(drift, [],
    'no chapter changes its coverage denominator when muted or when no TTS voice is available');
  console.log(`  audio: 0 of ${topics.length} chapters drift (${sawListening} would have, question-keyed)`);
}

// ── 2. The denominator is deterministic across fresh derivations ─────────────
// A learner sitting exactly on the pass mark used to be able to cross it, or fall back below it,
// by reloading. An item count is read from the data, so this is structural rather than lucky.
{
  const wobbled = [];
  for (const t of topics.slice(0, 60)) {
    const seen = new Set();
    for (let r = 0; r < 4; r++) {
      try { seen.add(client(t).run(`topicCoverage().total`, 'r')); } catch (_) {}
    }
    if (seen.size > 1) wobbled.push(`${t.topic}: ${[...seen].join('/')}`);
  }
  assert.deepStrictEqual(wobbled, [], 'the denominator is identical on every fresh derivation');
  console.log('  determinism: 0 of 60 chapters return a different total run to run');
}

// ── 3. The denominator is exactly the lesson's own source array ──────────────
// One registry (`_ITEM_ARRAYS`) decides which array holds a type's items, so a synonyms lesson
// carrying a stale `items` array from an earlier shape must NOT have it counted — a naive
// "sum every array" pass double-counted exactly that and reported 45 where the truth is 40.
{
  const topic = {
    id: 'IM', topic: 'IM', lang: 'de', srcLang: 'en',
    lessons: [
      { id: 'v', type: 'standard', vocab: [{ target: 'Haus', source: 'house' }, { target: 'Hund', source: 'dog' }],
        sentences: [{ target: 'Das Haus ist gross.', source: 'The house is big.' }] },
      { id: 's', type: 'synonyms', words: [{ base: 'klein' }, { base: 'gross' }],
        items: [{ sentence: 'stale ___ array' }] },   // must be ignored: not this type's array
      { id: 'w', type: 'word_forms', items: [{ sentence: 'Es war ___ Test.', choices: ['ein','eine'], correctIndex: 0 }] },
      { id: 'm', type: 'math', numbers: [1,2,3],
        exercises: [ { type:'math_calc', a:'1', op:'+', b:'2', correct:'3', choices:['3','4'] },
                     { type:'math_calc', a:'2', op:'+', b:'3', correct:'5', choices:['5','6'] },
                     { type:'math_order', direction:'asc', numbers:[3,1,2], correct:['1','2','3'] } ] },
      { id: 'e', type: 'error_hunt', sentences: [{ target: 'whole story as one entry' }] },
    ],
  };
  const C = client(topic);
  assert.strictEqual(C.run(`_lessonItemUniverse(0).size`, 'a'), 3, 'standard: 2 vocab + 1 sentence');
  assert.strictEqual(C.run(`_lessonItemUniverse(1).size`, 'b'), 2,
    'synonyms: its `words` only — a stale `items` array on the same lesson is not counted');
  assert.strictEqual(C.run(`_lessonItemUniverse(2).size`, 'c'), 1, 'word_forms: its `items`');
  assert.strictEqual(C.run(`_lessonItemUniverse(3).size`, 'd'), 3,
    'v74_d: math counts — its `exercises` array is authored and baked, not generated at runtime');
  assert.strictEqual(C.run(`_lessonItemUniverse(4).size`, 'e'), 0,
    'an error hunt is a play-it-once task; its `sentences` entry is the whole story, not an item');
  console.log('  registry: each type contributes only its own array (math counts, error hunts do not)');
}

// ── 3b. A math question credits its baked item, in either math format ────────
// The 30 shipped math lessons hold 225 authored exercises. Without a resolver branch they would sit
// permanently unsolvable in the denominator — a chapter that can never complete, which is the same
// shape of bug as the audio dependence in §1.
{
  const topic = {
    id: 'MA', topic: 'MA', lang: 'de', srcLang: 'en',
    lessons: [{ id: 'M', type: 'math',
      exercises: [ { type:'math_calc', a:'1', op:'+', b:'2', correct:'3', choices:['3','4'] },
                   { type:'math_order', direction:'asc', numbers:[3,1,2], correct:['1','2','3'] } ] }],
  };
  const C = client(topic);
  assert.strictEqual(C.run(`lessonCoverage(0).total`, 'a'), 2, 'both baked math exercises are items');
  C.run(`markSolved({ type:'math_calc', a:'1', op:'+', b:'2', correct:'3' }); true;`, 'm1');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'b'), 1, 'a calculation credits its item');
  // The ordering item is identified by direction + the SORTED set, so a differently-shuffled
  // presentation of the same question is the same item.
  C.run(`markSolved({ type:'math_order', direction:'asc', numbers:[2,3,1], correct:['1','2','3'] }); true;`, 'm2');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'c'), 2,
    'an ordering question credits its item however the numbers were shuffled on screen');
  assert.strictEqual(C.run(`lessonCoverage(0).pct`, 'd'), 100, 'a fully played math lesson reaches 100%');
  console.log('  math: baked exercises are items, and both math formats credit them');
}

// ── 4. A correct answer credits the SOURCE ITEM, in any question format ──────
// This is what makes the model audio-proof end to end: a muted learner is never offered the
// listening formats, so crediting per-format would re-import the dependence removed in §1.
{
  const topic = {
    id: 'IC', topic: 'IC', lang: 'de', srcLang: 'en',
    lessons: [{ id: 'L', type: 'standard',
      vocab: [{ target: 'Haus', source: 'house' }, { target: 'Hund', source: 'dog' }] }],
  };
  const C = client(topic);
  const before = C.run(`lessonCoverage(0).solved`, 'b');
  assert.strictEqual(before, 0, 'nothing solved yet');
  // The same word, credited through a NON-listening format.
  C.run(`markSolved({ type:'mcq_source_target', target:'Haus', source:'house' }); true;`, 'm1');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'c'), 1, 'the vocabulary item is solved');
  // Crediting the same word again through a LISTENING format must not double-count it.
  C.run(`markSolved({ type:'listen_mcq', target:'Haus', source:'house' }); true;`, 'm2');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'd'), 1,
    'the same item asked in another format is the same item, not a second one');
  C.run(`markSolved({ type:'listen_type', target:'Hund', source:'dog' }); true;`, 'm3');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'e'), 2, 'a different item is a different solve');
  assert.strictEqual(C.run(`lessonCoverage(0).pct`, 'f'), 100, 'both items solved → 100%');
  console.log('  crediting: any format credits the item; the same item never counts twice');
}

// ── 5. Pre-v74_c progress is re-keyed, not reset ─────────────────────────────
// Progress earned before this release is stored as `lessonId:type:hash(canonical)`. Most of it is
// recomputable from the item, so it is migrated rather than thrown away.
{
  const topic = {
    id: 'MG', topic: 'MG', lang: 'de', srcLang: 'en',
    lessons: [{ id: 'L', type: 'standard',
      vocab: [{ target: 'Haus', source: 'house' }, { target: 'Hund', source: 'dog' }] }],
  };
  const C = client(topic);
  // Seed ONLY a legacy question key, as an older build would have written.
  C.run(`(function(){ var s = _solvedMap('MG');
    s[qid({ type:'listen_mcq', target:'Haus', source:'house' }, 'L')] = 1; return true; })()`, 'seed');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'a'), 0,
    'a legacy question key alone does not credit the item — otherwise migration would be untestable');
  const credited = C.run(`_migrateSolvedToItems(APP.lessonData)`, 'mig');
  assert.strictEqual(credited, 1, 'migration re-keys the one item that legacy progress covers');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'b'), 1, 'and coverage now reflects it');
  // Idempotent: running it again must not double-count or throw.
  assert.strictEqual(C.run(`_migrateSolvedToItems(APP.lessonData)`, 'mig2'), 0,
    'migration is idempotent — a second run credits nothing');
  assert.strictEqual(C.run(`lessonCoverage(0).solved`, 'c'), 1, 'and coverage is unchanged');
  console.log('  migration: legacy question keys re-key onto items, idempotently');
}

// ── 6. Hidden lessons never count for ANYTHING ──────────────────────────────
// User ruling, session 28. It already held, but nothing pinned it, and it is the kind of rule that
// rots quietly: `lessonCountsFor` is the single choke point (`if (L._hidden) return false;` before
// any other test, plus `_aiExamples`, which is review-only dialect-studio content), and every other
// rule — the coverage denominator, the story-unlock gate, chapter completion, the completion-card
// icon row — derives from `countedLessons`. Asserted over the real corpus at the choke point AND at
// the denominator, so a future rule that walks `d.lessons` directly is caught.
{
  const withHidden = (store.topics || []).filter(t =>
    (t.lessons || []).some(L => L && (L._hidden || L.hidden || L._aiExamples)));
  // Non-vacuity: if the corpus ever stops shipping hidden lessons this section proves nothing.
  assert.ok(withHidden.length > 3,
    `the corpus contains chapters with hidden lessons (${withHidden.length}), so the rule is testable`);

  const counted = [], leaked = [];
  for (const t of withHidden) {
    let C; try { C = client(t); } catch (_) { continue; }
    // (a) no hidden lesson survives lessonCountsFor
    const bad = JSON.parse(C.run(`JSON.stringify(countedLessons(APP.lessonData)
      .filter(L => L._hidden || L.hidden || L._aiExamples).map(L => L.id))`, 'a'));
    if (bad.length) counted.push(`${t.topic}: ${bad.join(',')}`);
    // (b) and none of their items reaches the chapter denominator by any other route
    const n = C.run(`(function(){
      var U = new Set();
      countedLessons(APP.lessonData).forEach(function(L){
        _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ U.add(k); }); });
      var hit = 0;
      (APP.lessonData.lessons || []).forEach(function(L){
        if (!L || !(L._hidden || L.hidden || L._aiExamples)) return;
        _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ if (U.has(k)) hit++; }); });
      return hit; })()`, 'b');
    if (n) leaked.push(`${t.topic}: ${n} item(s)`);
  }
  assert.deepStrictEqual(counted, [], 'no hidden lesson is ever a counted lesson');
  assert.deepStrictEqual(leaked, [], 'and no hidden lesson\'s items reach the coverage denominator');

  // A mixed lesson pools its earlier siblings — it must not drag a hidden one back in.
  const topic = {
    id: 'HD', topic: 'HD', lang: 'de', srcLang: 'en',
    lessons: [
      { id: 'a', type: 'standard', vocab: [{ target: 'Haus', source: 'house' }] },
      { id: 'b', type: 'standard', _hidden: true, vocab: [{ target: 'Hund', source: 'dog' }] },
      { id: 'x', type: 'mixed' },
    ],
  };
  const C2 = client(topic);
  assert.strictEqual(C2.run(`_lessonItemUniverse(2).size`, 'c'), 1,
    'the mixed union takes the visible sibling only — a hidden lesson is not pooled and not counted');
  assert.strictEqual(C2.run(`topicCoverage().total`, 'd'), 1,
    'so the chapter denominator is the visible content alone');
  console.log(`  hidden: 0 counted, 0 items leaking, across ${withHidden.length} chapters`);
}
console.log('unit-coverage-item-model: ALL PASSED');
