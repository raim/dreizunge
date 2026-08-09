// probe_drill_v77d.js — is `comp-drill` DEAD, or was it never seeded?
// v76_card_gates.md finding 4: "comp-drill is grey or hidden in all 32 rows. Never once enabled on
// either chapter. Before moving the button row below the text, establish whether drill is reachable
// at all; if it is not, this is a dead control taking up the row you are redesigning."
//
// The drill quizzes WRONGLY ANSWERED words, which live in APP.progress.learned[lang|srcLang] — a
// store the gate probe never wrote. Same shape as the v77_c key-space finding: a store seeded at
// the wrong level reads as a dead feature.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const ok = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;
const TOPIC = store.topics.find(t => ok(t) && (t.lessons || []).some(l => (l.vocab || []).length >= 6));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

function base(o) {
  o = o || {};
  C.run(`
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate:false, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {}, learned: {} };
    APP.cur = { lessonIdx: 0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0,
                exercises: [], cur: 0 };
    true;`);
}
const drillState = () => C.run(`(function(){
  var e = document.getElementById('comp-drill');
  if(!e) return 'ABSENT';
  if(e.style.display === 'none') return 'hidden';
  return e.disabled ? 'grey' : 'LIVE';
})()`);
const avail = () => C.run(`drillAvailable(APP.lessonData.lang, APP.lessonData.srcLang)`);

// Seed the learned ledger the way recordLearnedFromLesson does: nWrong words with wrong>0,
// nKnown with wrong=0.
const seedLedger = (nWrong, nKnown) => C.run(`(function(){
  var led = _learnedLedger(APP.lessonData.lang, APP.lessonData.srcLang);
  led.vocab = {};
  for (var i=0;i<${nWrong};i++) led.vocab['WRONG'+i] = { source:'w'+i, seen:3, wrong:2 };
  for (var j=0;j<${nKnown};j++) led.vocab['KNOWN'+j] = { source:'k'+j, seen:3, wrong:0 };
  return Object.keys(led.vocab).length;
})()`);

console.log(`chapter: "${TOPIC.topic}"  ${TOPIC.lang}<-${TOPIC.srcLang}`);
console.log(`DRILL_SIZE=${C.run('DRILL_SIZE')}  DRILL_MIN=${C.run('DRILL_MIN')}\n`);

// ── 1. Exactly what the v76 gate probe did: no learned ledger at all ──
base();
C.run(`showComplete();`);
console.log('A. empty ledger (what the v76 gate table measured)');
console.log(`   drillAvailable : ${avail()}`);
console.log(`   comp-drill     : ${drillState()}   <- the "never once enabled" row\n`);

// ── 2. A learner who has actually got things wrong ──
console.log('B. seeded ledger — how many entries does a drill need?');
console.log('   wrong known  total  drillAvailable  comp-drill');
for (const [w, k] of [[1,0],[1,1],[1,2],[1,3],[2,2],[4,0],[8,4]]) {
  base();
  const n = seedLedger(w, k);
  const a = avail();
  C.run(`showComplete();`);
  console.log(`   ${String(w).padEnd(6)}${String(k).padEnd(6)}${String(n).padEnd(7)}${String(a).padEnd(16)}${drillState()}`);
}

// ── 3. Does the button go live for a TEACHER too, and under the v74_l hide-list? ──
console.log('\nC. the same seeded learner across the gate flags');
console.log('   teacher unlocked  comp-drill');
for (const teacher of [false, true]) for (const unlocked of [false, true]) {
  base({ teacher });
  seedLedger(4, 4);
  if (unlocked) C.run(`(function(){ var d=APP.lessonData, done={};
    (d.lessons||[]).forEach(function(L){ if(L) done[L.id]=true; });
    APP.progress.completed[d.topic]=done; })();`);
  C.run(`showComplete();`);
  console.log(`   ${String(teacher).padEnd(8)}${String(unlocked).padEnd(10)}${drillState()}`);
}

// ── 4. Is the ledger ever populated in normal play? Drive the real writer. ──
base();
const real = JSON.parse(C.run(`(function(){
  var d = APP.lessonData;
  var L = (d.lessons||[]).find(function(x){ return (x.vocab||[]).length >= 4; });
  if(!L) return JSON.stringify({ skipped:true });
  // recordLearnedFromLesson(lesson, wrongTargets) is what showComplete calls on a real play.
  // It takes a SET: 'wrongTargets instanceof Set ? wrongTargets : new Set()' silently discards
  // anything else, so an Array degrades to "nothing was wrong". Built here exactly as the product
  // builds it (index.html ~14314): same Set, same stripFuri/trim normalisation, same realm.
  var wrong = new Set((L.vocab||[]).slice(0,2).map(function(v){
    return stripFuri(String(v.target)).trim(); }));
  recordLearnedFromLesson(L, wrong);
  var led = _learnedLedger(d.lang, d.srcLang);
  var entries = Object.entries(led.vocab);
  return JSON.stringify({
    entries: entries.length,
    withWrong: entries.filter(function(e){ return e[1].wrong > 0; }).length,
    available: drillAvailable(d.lang, d.srcLang)
  });
})()`));
C.run(`showComplete();`);
console.log('\nD. driven through recordLearnedFromLesson (the real writer, 2 wrong answers)');
console.log(`   ledger entries : ${real.entries}  (${real.withWrong} with wrong>0)`);
console.log(`   drillAvailable : ${real.available}`);
console.log(`   comp-drill     : ${drillState()}`);
