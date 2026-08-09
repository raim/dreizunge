// probe_table_audit_v77e.js — audit the REMAINING findings of v76_card_gates.md.
// Three of its findings turned out to be seeding artefacts (comp-back/comp-story: the stub DOM;
// the coverage rows: item vs qid keys; comp-drill: the learned ledger). Findings 2 and 5 are the
// ones nobody has re-checked, and §0c is about to be built on them.
//
// Finding 2: "comp-storyboard is hidden in all 32 rows. The storyboard is storyline-level; this is
//             the chapter card. If the story-finished card is to show it, that is new wiring."
// Finding 5: "The learner/teacher asymmetry is large."
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// Pick a chapter that BELONGS to a storyline which HAS a storyboard — the precondition the
// renderer needs. If none exists the finding cannot be tested and we must say so, not pass quietly.
const withBoard = (store.storylines || []).filter(sl => sl.storyboard && (sl.chapters || []).length);
console.log(`storylines: ${(store.storylines||[]).length}, of which carry a storyboard: ${withBoard.length}`);

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
let SL = null, TOPIC = null;
for (const sl of withBoard) {
  const t = (sl.chapters || []).map(c => byId[c]).find(x => x && (x.story || '').length > 200);
  if (t) { SL = sl; TOPIC = t; break; }
}
if (!TOPIC) { console.log('NO chapter in a storyboarded storyline — finding 2 untestable here.'); process.exit(0); }
console.log(`chapter: "${TOPIC.topic}"  in storyline "${SL.title || SL.id}" (${(SL.chapters||[]).length} chapters)\n`);

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

// savedList is the landing-page projection of every topic — what _storylineOfTopic resolves through.
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang }));

function seed(o) {
  o = o || {};
  C.run(`
    APP.lessonData = ${JSON.stringify(TOPIC)};
    APP.lang = ${JSON.stringify(TOPIC.lang)}; APP.srcLang = ${JSON.stringify(TOPIC.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate:${!!o.canGen}, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {}, learned: {} };
    APP.savedList = ${o.saved ? JSON.stringify(SAVED) : '[]'};
    APP.cur = { lessonIdx: 0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0,
                exercises: [], cur: 0 };
    true;`);
}
const vis = id => C.run(`(function(){ var e=document.getElementById(${JSON.stringify(id)});
  if(!e) return 'ABSENT';
  if(e.style.display==='none') return '-';
  return e.disabled ? 'grey' : 'YES'; })()`);
const errs = () => C.run(`JSON.stringify(_cardErrors())`);
const boardHtml = () => C.run(`(document.getElementById('comp-storyboard').innerHTML||'').length`);

// ── Finding 2 ──────────────────────────────────────────────────────────────
console.log('FINDING 2 — comp-storyboard');
seed({ saved: false });
C.run(`showComplete();`);
console.log(`  savedList EMPTY (what the gate probe seeded): comp-storyboard = ${vis('comp-storyboard')}, innerHTML ${boardHtml()} chars`);
console.log(`     swallowed: ${errs()}`);

seed({ saved: true });
C.run(`showComplete();`);
console.log(`  savedList POPULATED:                          comp-storyboard = ${vis('comp-storyboard')}, innerHTML ${boardHtml()} chars`);
console.log(`     swallowed: ${errs()}`);

// Did the storyline context resolve at all? Distinguishes "no wiring" from "no data".
seed({ saved: true });
const ctx = C.run(`(function(){ try {
  var sl = _storylineOfTopic(APP.lessonData);
  return sl ? (sl.id + ' / storyboard:' + (sl.storyboard ? sl.storyboard.length + ' chars' : 'none')) : 'NOT RESOLVED';
} catch(e){ return 'THREW: ' + e.message; } })()`);
console.log(`  _storylineOfTopic -> ${ctx}`);

// ── Finding 5 ──────────────────────────────────────────────────────────────
console.log('\nFINDING 5 — learner/teacher asymmetry, with every store seeded');
console.log('  tchr canGen unlk  drill      crossword  next       storyboard story-unlocked');
for (const teacher of [false, true])
for (const canGen of [false, true])
for (const unlocked of [false, true]) {
  seed({ teacher, canGen, saved: true });
  // give the learner mistakes so drill is genuinely available (v77_d)
  C.run(`(function(){ var led=_learnedLedger(APP.lessonData.lang, APP.lessonData.srcLang);
    led.vocab={}; for(var i=0;i<4;i++) led.vocab['W'+i]={source:'w'+i,seen:3,wrong:2}; })();`);
  if (unlocked) C.run(`(function(){ var d=APP.lessonData, done={};
    (d.lessons||[]).forEach(function(L){ if(L) done[L.id]=true; });
    APP.progress.completed[d.topic]=done; })();`);
  C.run(`showComplete();`);
  console.log(`  ${teacher?'T':'.'}    ${canGen?'G':'.'}      ${unlocked?'U':'.'}     ` +
    ['comp-drill','comp-crossword','comp-next','comp-storyboard','comp-story-panel']
      .map(i => String(vis(i)).padEnd(11)).join(''));
}
