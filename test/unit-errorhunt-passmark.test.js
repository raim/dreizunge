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
{
  seed(0.8);
  C.run(`(function(){
    const s = APP.progress.solved['EHT'], done = APP.progress.completed['EHT'];
    [0,1].forEach(i => {
      for (let r=0;r<25;r++) buildExercises(i).forEach(ex => { const id = qid(ex, APP.lessonData.lessons[i].id); if (id) s[id]=1; });
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
      for (let r=0;r<25;r++) buildExercises(i).forEach(ex => { const id = qid(ex, APP.lessonData.lessons[i].id); if (id) s[id]=1; });
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
      for (let r=0;r<25;r++) buildExercises(0).forEach(ex => { const id = qid(ex, 'm_a'); if (id) s[id]=1; }); })();
    APP.progress.completed['EHM']['m_a'] = { done:true, correct:1, total:1 }; true;`);
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), false,
    'a mixed set with a trailing error hunt is incomplete until the hunt is played');
  C.run(`APP.progress.completed['EHM']['m_eh'] = { correct:1, wrong:0, missed:0, score:10, suspect:[], total:1 }; true;`);
  assert.strictEqual(C.run(`setComplete(APP.lessonData)`), true,
    'and completes once it is');
  console.log('  mixed set + trailing error hunt: same gate, completes when the hunt is played');
}

console.log('unit-errorhunt-passmark: ALL PASSED');
