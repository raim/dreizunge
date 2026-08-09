// probe_cardsweep_v77b.js — with the ledger in place, does the SHIPPED card swallow anything?
// Same 32 gate rows as probe_gates_v76.js, but reading _cardErrors() after each render.
// This is the measurement §0b exists to make: the seven catches were invisible, so nobody knew.
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
const CLASSIC = store.topics.find(t => ok(t) && !isMixed(t) && hasComp(t)) || store.topics.find(t => ok(t) && !isMixed(t));
const MIXED = store.topics.find(t => ok(t) && isMixed(t) && hasComp(t)) || store.topics.find(t => ok(t) && isMixed(t));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

function seed(topic, o) {
  C.run(`
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate: ${!!o.canGen}, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {} };
    true;`);
  if (o.unlocked) {
    C.run(`(function(){
      var d = APP.lessonData, done = {};
      (d.lessons||[]).forEach(function(L){ if(L) done[L.id] = true; });
      APP.progress.completed[d.topic] = done;
      var solved = {};
      (d.lessons||[]).forEach(function(L, i){
        try { (_lessonQidUniverse(i)||[]).forEach(function(q){ solved[q] = true; }); } catch(e){}
      });
      APP.progress.solved[d.topic] = solved;
    })();`);
  }
  C.run(`APP.cur = { lessonIdx: 0, correct: 1, total: 1, mistakes: 0, bestStreak: 1, flagCount: 0,
                     exercises: [], ${o.review ? '_review: true,' : ''} cur: 0 }; true;`);
  try { C.run(`showComplete(${o.review ? 'true' : ''});`); } catch (e) { return [{ where: 'THREW', msg: e.message }]; }
  return JSON.parse(C.run(`JSON.stringify(_cardErrors())`));
}

let totalRows = 0, dirtyRows = 0;
const byWhere = {};
for (const [label, topic] of [['CLASSIC', CLASSIC], ['MIXED', MIXED]]) {
  console.log(`\n### ${label}: "${topic.topic}"  ${topic.lang}<-${topic.srcLang}`);
  for (const teacher of [false, true])
  for (const canGen of [false, true])
  for (const unlocked of [false, true])
  for (const review of [false, true]) {
    const errs = seed(topic, { teacher, canGen, unlocked, review });
    totalRows++;
    if (errs.length) {
      dirtyRows++;
      const flags = `${teacher?'T':'.'}${canGen?'G':'.'}${unlocked?'U':'.'}${review?'R':'.'}`;
      console.log(`  ${flags}  ` + errs.map(e => `${e.where}: ${e.msg}`).join(' | '));
      errs.forEach(e => { byWhere[e.where] = (byWhere[e.where] || 0) + 1; });
    }
  }
  if (!dirtyRows) console.log('  (no swallowed errors)');
}

console.log(`\n=== ${dirtyRows} of ${totalRows} rows swallowed at least one error ===`);
for (const w of Object.keys(byWhere)) console.log(`   ${w}: ${byWhere[w]} row(s)`);
if (!dirtyRows) console.log('   the shipped card swallows nothing on these two chapters.');
