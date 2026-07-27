// unit-card-consistency.test.js
// v71_h: two card changes, both user-requested.
//   1. The drill result card ("card D") is gone. A finished drill returns to the LAUNCHING
//      chapter's real completion card instead of a stripped waystation the learner tapped through.
//   2. Every completion card shows the SAME button row — Next / Repeat / Drill / Crossword / Back —
//      with each greyed (present but disabled) when it cannot act, so controls never jump position.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed-static');

function topic(target) {
  return {
    id: 'T', topic: 'T', lang: 'de', srcLang: 'en', story: 'Es war einmal ein Haus.',
    coverageTarget: target, lessons: [
      { id: 'l1', type: 'standard', vocab: [{ target: 'HAUS', source: 'house' }, { target: 'HUND', source: 'dog' }, { target: 'BAUM', source: 'tree' }] },
      { id: 'l2', type: 'standard', vocab: [{ target: 'STERN', source: 'star' }, { target: 'MOND', source: 'moon' }, { target: 'SONNE', source: 'sun' }] },
    ],
  };
}
const seed = (t, opt = {}) => C.run(`
  APP.lang='de'; APP.srcLang='en'; APP._teacherMode=${!!opt.teacher}; APP.muted=false;
  APP.lessonData=${JSON.stringify(t)}; APP.info={backend:'none',canGenerate:false,coverageThreshold:${t.coverageTarget}};
  APP.storylines=[]; APP.savedList=[]; show=function(){};
  APP.progress={completed:{},solved:{},learned:{}}; APP.progress.completed['T']={}; APP.progress.solved['T']={};
  if (typeof _invalidateQidUniverse==='function') _invalidateQidUniverse(); true;`, 'seed');
const solve = (i, frac) => C.run(`(function(){const s=APP.progress.solved['T'];const u=[..._lessonQidUniverse(${i})];
  const n=Math.ceil(u.length*${frac});u.slice(0,n).forEach(id=>s[id]=1);
  APP.progress.completed['T']['l'+(${i}+1)]={done:true,correct:n,total:u.length};})()`);
const withMistakes = () => C.run(`APP.progress.learned['de|en']={vocab:{
  HAUS:{source:'house',seen:2,wrong:1}, HUND:{source:'dog',seen:2,wrong:1},
  BAUM:{source:'tree',seen:2,wrong:0}, X:{source:'x',seen:2,wrong:0}},sentences:{}}; true;`);

const ROW = ['comp-next', 'comp-repeat', 'comp-drill', 'comp-crossword', 'comp-back'];
const state = id => C.run(`(function(){const e=document.getElementById(${JSON.stringify(id)});
  if(!e) return 'MISSING';
  if(e.style.display==='none') return 'HIDDEN';
  if(e.disabled) return 'GREY';
  return 'LIVE';})()`);
const rowStates = () => ROW.reduce((o, id) => (o[id] = state(id), o), {});

// ── 1. Card D is gone: a finished drill lands on the real chapter card ───────
{
  seed(topic(0.8)); solve(0, 1.0); solve(1, 1.0);   // fully solved → complete card
  withMistakes();
  C.run(`startDrill();`);
  assert.strictEqual(C.run(`APP.lessonData.topic`), '__drill__', 'startDrill switched to the ephemeral topic');
  // Finish the drill through the real exit (renderEx running out of questions).
  C.run(`APP.cur.cur = APP.cur.exercises.length; renderEx();`);
  assert.strictEqual(C.run(`APP.lessonData.topic`), 'T', 'a finished drill restores the real topic');
  assert.ok(C.run(`!APP._drillPrev`), 'and clears the drill-return marker');
  // The real card renders: progress bars present (the drill card hid them), Back present.
  assert.notStrictEqual(C.run(`document.getElementById('comp-progress').style.display`), 'none',
    'the real card shows progress bars — the stripped drill card did not');
  assert.notStrictEqual(C.run(`document.getElementById('comp-back').style.display`), 'none',
    'and shows Back — the drill card hid it');
  assert.strictEqual(C.calls.errors.length, 0, 'no errors while ending the drill onto the real card');
  console.log('  card D removed: finished drill lands on the real chapter card, topic restored');
}

// ── 2. A drill BELOW the mark lands on the below-mark card, not "complete" ───
// The coverage the drill credited is real, so if it is still short the learner sees "Keep going!".
{
  seed(topic(0.8)); solve(0, 0.4); solve(1, 0.4);   // below the mark
  withMistakes();
  C.run(`startDrill(); APP.cur.cur = APP.cur.exercises.length; renderEx();`);
  assert.strictEqual(C.run(`document.getElementById('comp-title').textContent`), UI.en['complete.keep_going'],
    'a drill that leaves coverage short returns to the below-mark card');
}

// ── 3. The button row is identical across every card ─────────────────────────
// Same five buttons present on all of them; only which are LIVE vs GREY changes.
{
  const cards = [];
  const render = (label, setup) => { setup(); C.run(`showComplete();`); cards.push([label, rowStates()]); };

  render('mid-chapter', () => { seed(topic(1.0)); solve(0, 1.0);
    C.run(`APP.cur={lessonIdx:0,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[]};`); });
  render('below-mark-no-drill', () => { seed(topic(0.8)); solve(0, 0.5); solve(1, 0.5);
    C.run(`APP.cur={lessonIdx:1,correct:2,total:6,mistakes:4,bestStreak:1,exercises:[]};`); });
  render('below-mark-drill', () => { seed(topic(0.8)); solve(0, 0.4); solve(1, 0.4); withMistakes();
    C.run(`APP.cur={lessonIdx:1,correct:2,total:6,mistakes:4,bestStreak:1,exercises:[]};`); });
  render('complete', () => { seed(topic(0.8)); solve(0, 1.0); solve(1, 1.0);
    C.run(`APP.cur={lessonIdx:1,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[]};`); });
  render('review', () => { seed(topic(0.8)); solve(0, 1.0); solve(1, 1.0);
    C.run(`APP.cur={lessonIdx:1,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[],_review:true};`); });

  // No button is ever HIDDEN or MISSING on any card — every one is present (LIVE or GREY).
  cards.forEach(([label, st]) => {
    ROW.forEach(id => assert.ok(st[id] === 'LIVE' || st[id] === 'GREY',
      `${label}: ${id} is present (${st[id]}) — the row is consistent, nothing hidden`));
  });
  // Repeat, Crossword and Back are LIVE on every one of these cards (always a route/way out).
  cards.forEach(([label, st]) => {
    assert.strictEqual(st['comp-repeat'], 'LIVE', `${label}: Repeat is live`);
    assert.strictEqual(st['comp-crossword'], 'LIVE', `${label}: Crossword is live`);
    assert.strictEqual(st['comp-back'], 'LIVE', `${label}: Back is live`);
  });
  console.log('  consistent row: all 5 buttons present on every card (' + cards.map(c => c[0]).join(', ') + ')');
}

// ── 4. Greyed states mean exactly what they should ──────────────────────────
{
  // Drill: GREY when there are no mistakes, LIVE when there are.
  seed(topic(0.8)); solve(0, 0.5); solve(1, 0.5);
  C.run(`APP.cur={lessonIdx:1,correct:2,total:6,mistakes:4,bestStreak:1,exercises:[]}; showComplete();`);
  assert.strictEqual(state('comp-drill'), 'GREY', 'drill is greyed with no mistakes in the ledger');
  seed(topic(0.8)); solve(0, 0.4); solve(1, 0.4); withMistakes();
  C.run(`APP.cur={lessonIdx:1,correct:2,total:6,mistakes:4,bestStreak:1,exercises:[]}; showComplete();`);
  assert.strictEqual(state('comp-drill'), 'LIVE', 'drill is live once mistakes exist');

  // Next: GREY below the mark (locked) and on a finished solo chapter (nothing forward), LIVE mid-chapter.
  seed(topic(1.0)); solve(0, 1.0);
  C.run(`APP.cur={lessonIdx:0,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[]}; showComplete();`);
  assert.strictEqual(state('comp-next'), 'LIVE', 'Next is live when a next lesson exists');
  seed(topic(0.8)); solve(0, 1.0); solve(1, 1.0);
  C.run(`APP.cur={lessonIdx:1,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[]}; showComplete();`);
  assert.strictEqual(state('comp-next'), 'GREY', 'Next is greyed on a finished solo chapter, not removed');

  // A greyed button carries an explanatory tooltip, not the default action label.
  assert.ok(C.run(`document.getElementById('comp-drill').title`).length > 0, 'a greyed drill button explains itself');

  // Crossword: GREY (never HIDDEN) when the lesson cannot build a puzzle. This is the case a hide
  // regression would slip through, so it is asserted directly.
  seed(topic(0.8));
  C.run(`APP.lessonData.lessons[0] = { id:'cw-none', type:'standard', vocab:[{target:'你好', source:'hi'}] };
    if (typeof _invalidateQidUniverse==='function') _invalidateQidUniverse();
    var s=APP.progress.solved['T']; var u=[..._lessonQidUniverse(0)]; u.forEach(id=>s[id]=1);
    APP.progress.completed['T']={ 'cw-none': { done:true, correct:1, total:1 } };
    APP.cur={lessonIdx:0,correct:1,total:1,mistakes:0,bestStreak:1,exercises:[]}; showComplete();`);
  assert.strictEqual(state('comp-crossword'), 'GREY',
    'crossword is greyed (never hidden) when the lesson has no crossable words');
}

// ── 5. Greyed buttons cannot be activated ───────────────────────────────────
{
  seed(topic(0.8)); solve(0, 1.0); solve(1, 1.0);
  C.run(`APP.cur={lessonIdx:1,correct:3,total:3,mistakes:0,bestStreak:3,exercises:[]}; showComplete();`);
  assert.strictEqual(C.run(`document.getElementById('comp-next').disabled`), true, 'a greyed Next is disabled');
  assert.strictEqual(C.run(`document.getElementById('comp-drill').disabled`), true, 'a greyed drill is disabled');
}

console.log('unit-card-consistency: ALL PASSED');
