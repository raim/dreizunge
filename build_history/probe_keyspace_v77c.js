// probe_keyspace_v77c.js — settle the OPEN question in v76_card_gates.md:
//   "86 seeded solved keys, 0 counted, total 31" on a mixed-driven chapter, on the branch that
//   gates story unlock. Stated there as an open question: seeding artefact, or live bug?
//
// The claim under test is NOT "coverage works". It is: which KEY SPACE does topicCoverage read,
// and is it the one the probe seeded? Both are measured here rather than reasoned about.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const isMixed = t => (t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden);
const hasComp = t => (t.lessons || []).some(l => l && l.type === 'comprehension');
const ok = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;
const MIXED = store.topics.find(t => ok(t) && isMixed(t) && hasComp(t)) || store.topics.find(t => ok(t) && isMixed(t));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

function base(o) {
  o = o || {};
  C.run(`
    APP.lessonData = ${JSON.stringify(MIXED)};
    APP.lang = ${JSON.stringify(MIXED.lang)}; APP.srcLang = ${JSON.stringify(MIXED.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate:${!!o.canGen}, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {}, learned: {} };
    APP.cur = { lessonIdx: 0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0,
                exercises: [], cur: 0 };
    (function(){ var d=APP.lessonData, done={};
      (d.lessons||[]).forEach(function(L){ if(L) done[L.id]=true; });
      APP.progress.completed[d.topic]=done; })();
    true;`);
}
const seedQids = () => C.run(`(function(){
  var d=APP.lessonData, s={};
  (d.lessons||[]).forEach(function(L,i){
    try { (_lessonQidUniverse(i)||[]).forEach(function(q){ s[q]=true; }); } catch(e){}
  });
  APP.progress.solved[d.topic]=s; return Object.keys(s).length; })()`);
const seedItems = () => C.run(`(function(){
  var d=APP.lessonData, s={};
  (d.lessons||[]).forEach(function(L,i){
    try { (_lessonItemUniverse(i)||[]).forEach(function(k){ s[k]=true; }); } catch(e){}
  });
  APP.progress.solved[d.topic]=s; return Object.keys(s).length; })()`);
const report = () => JSON.parse(C.run(`JSON.stringify({
  cov: topicCoverage(true), complete: coverageComplete(true),
  target: _coverageTarget(), unlocked: storyUnlocked(APP.lessonData),
  gateLessons: storyUnlockLessons(APP.lessonData).map(function(L){ return (L.type||'standard')+':'+L.id; })
})`));

console.log(`chapter: "${MIXED.topic}"  ${MIXED.lang}<-${MIXED.srcLang}`);
console.log(`lessons: ${(MIXED.lessons||[]).map(l=>l.type||'standard').join(', ')}\n`);

// ── 1. Reproduce the reported state: seed QUESTION ids, as the v76 probe did ──
base();
const nQ = seedQids();
const r1 = report();
console.log('A. seeded from _lessonQidUniverse (what the v76 probe did)');
console.log(`   seeded keys        : ${nQ}`);
console.log(`   topicCoverage(true): ${JSON.stringify(r1.cov)}`);
console.log(`   coverageComplete   : ${r1.complete}`);
console.log(`   storyUnlocked()    : ${r1.unlocked}`);
console.log(`   gate lessons       : ${JSON.stringify(r1.gateLessons)}`);

// ── 2. Same chapter, seeded from the ITEM universe that v74_c made coverage read ──
base();
const nI = seedItems();
const r2 = report();
console.log('\nB. seeded from _lessonItemUniverse (what topicCoverage actually reads)');
console.log(`   seeded keys        : ${nI}`);
console.log(`   topicCoverage(true): ${JSON.stringify(r2.cov)}`);
console.log(`   coverageComplete   : ${r2.complete}`);
console.log(`   storyUnlocked()    : ${r2.unlocked}`);

// ── 3. Do the two key spaces overlap at all? ──
base();
const overlap = JSON.parse(C.run(`(function(){
  var d=APP.lessonData, q={}, it={};
  (d.lessons||[]).forEach(function(L,i){
    try { (_lessonQidUniverse(i)||[]).forEach(function(k){ q[k]=1; }); } catch(e){}
    try { (_lessonItemUniverse(i)||[]).forEach(function(k){ it[k]=1; }); } catch(e){}
  });
  var qk=Object.keys(q), ik=Object.keys(it);
  var inter=qk.filter(function(k){ return it[k]; });
  return JSON.stringify({ qids:qk.length, items:ik.length, shared:inter.length,
    qSample:qk.slice(0,2), iSample:ik.slice(0,2) });
})()`));
console.log('\nC. key spaces');
console.log(`   qid universe  : ${overlap.qids}   e.g. ${JSON.stringify(overlap.qSample)}`);
console.log(`   item universe : ${overlap.items}   e.g. ${JSON.stringify(overlap.iSample)}`);
console.log(`   shared keys   : ${overlap.shared}`);

// ── 4. The four bad rows, re-run with the correct key space ──
console.log('\nD. the 4 rows that did not follow the seed in v76_card_gates.md');
let bad = 0;
for (const teacher of [false]) for (const canGen of [false, true]) for (const review of [false, true]) {
  base({ teacher, canGen });
  seedItems();
  const g = C.run(`storyUnlocked(APP.lessonData)`);
  if (!g) bad++;
  console.log(`   teacher=${teacher} canGen=${canGen} review=${review} -> storyUnlocked=${g}`);
}
console.log(`\n   ${bad} of 4 still fail to unlock when seeded on the item key space.`);

// ── 5. The decisive check: don't seed EITHER map — drive the real solve path. ──
// Session-28 rule 1: call the product function. markSolved is what a learner's correct answer
// actually runs, and v74_c says it records BOTH key spaces. If that holds, a real learner reaches
// the unlock and the 4 bad rows are purely an artefact of how the v76 probe seeded.
base();
const viaPlay = JSON.parse(C.run(`(function(){
  var d = APP.lessonData;
  var before = Object.keys(_solvedMap(d.topic)).length;
  var built = 0;
  (d.lessons||[]).forEach(function(L,i){
    if(!L || L.type === 'mixed') return;
    var prev = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
    try {
      var exs = buildExercises(i) || [];
      exs.forEach(function(ex){ try { markSolved(ex); built++; } catch(e){} });
    } catch(e){}
    APP.cur.lessonIdx = prev;
  });
  var m = _solvedMap(d.topic), keys = Object.keys(m);
  return JSON.stringify({
    exercisesSolved: built,
    keysWritten: keys.length - before,
    itemKeys: keys.filter(function(k){ return /:i:/.test(k); }).length,
    qidKeys:  keys.filter(function(k){ return !/:i:/.test(k); }).length,
    cov: topicCoverage(true), unlocked: storyUnlocked(APP.lessonData)
  });
})()`));
console.log('\nE. driven through markSolved (no seeding — the real learner path)');
console.log(`   exercises solved   : ${viaPlay.exercisesSolved}`);
console.log(`   keys written       : ${viaPlay.keysWritten}  (item: ${viaPlay.itemKeys}, qid: ${viaPlay.qidKeys})`);
console.log(`   topicCoverage(true): ${JSON.stringify(viaPlay.cov)}`);
console.log(`   storyUnlocked()    : ${viaPlay.unlocked}`);

// ── 6. One round is a SAMPLE, not the universe (builders sample — INTERNALS harness trap).
// So the question is whether replaying converges on the unlock, which is the designed way up
// (repeatForCoverage). If it plateaus below 100% the unlock is unreachable and that IS a bug.
base();
const conv = JSON.parse(C.run(`(function(){
  var d = APP.lessonData, hist = [], rounds = 0;
  for (var r = 0; r < 40; r++){
    (d.lessons||[]).forEach(function(L,i){
      if(!L || L.type === 'mixed') return;
      var prev = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
      try { (buildExercises(i)||[]).forEach(function(ex){ try { markSolved(ex); } catch(e){} }); }
      catch(e){}
      APP.cur.lessonIdx = prev;
    });
    rounds++;
    var c = topicCoverage(true);
    hist.push(c.pct);
    if (storyUnlocked(d)) return JSON.stringify({ rounds: rounds, hist: hist, unlocked: true, cov: c });
  }
  return JSON.stringify({ rounds: rounds, hist: hist, unlocked: storyUnlocked(d), cov: topicCoverage(true) });
})()`));
console.log('\nF. replaying (the designed way up)');
console.log(`   coverage by round  : ${conv.hist.join(' -> ')}`);
console.log(`   rounds to unlock   : ${conv.unlocked ? conv.rounds : 'NEVER (plateaued)'}`);
console.log(`   final              : ${JSON.stringify(conv.cov)}  storyUnlocked=${conv.unlocked}`);
