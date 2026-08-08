// probe_gates.js — derive the AS-IS completion-card truth table by RUNNING showComplete.
// Not read from source: the function is 564 lines with 7 swallowing catch(_) {} blocks, so source
// reading is exactly what cannot be trusted. Each gate is driven through what it ACTUALLY reads,
// and every row records whether the gate followed the seed.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(require('path').join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const isMixed = t => (t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden);
const hasComp = t => (t.lessons || []).some(l => l && l.type === 'comprehension');
const ok = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;

const CLASSIC = store.topics.find(t => ok(t) && !isMixed(t) && hasComp(t))
             || store.topics.find(t => ok(t) && !isMixed(t));
const MIXED   = store.topics.find(t => ok(t) &&  isMixed(t) && hasComp(t))
             || store.topics.find(t => ok(t) &&  isMixed(t));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`);

const ELEMENTS = ['comp-story', 'comp-story-unlocked', 'comp-next', 'comp-back', 'comp-repeat',
                  'comp-drill', 'comp-crossword', 'comp-storyboard', 'comp-vocab'];
const vis = id => C.run(`(function(){ var e=document.getElementById(${JSON.stringify(id)});
  if(!e) return 'ABSENT';
  if(e.style.display==='none') return '-';
  return e.disabled ? 'grey' : 'YES'; })()`);

function seed(topic, o) {
  C.run(`
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP._teacherMode = ${!!o.teacher};
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
  const gate = C.run(`(function(){ try { return storyUnlocked(APP.lessonData); } catch(e){ return 'ERR'; } })()`);
  let threw = null;
  try { C.run(`showComplete(${o.review ? 'true' : ''});`); } catch (e) { threw = e.message; }
  return { gate, threw };
}

function table(label, topic) {
  console.log('\n\n### ' + label);
  console.log('chapter: "' + topic.topic + '"  ' + topic.lang + '<-' + topic.srcLang +
    '  |  lessons: ' + (topic.lessons || []).map(l => l.type || 'standard').join(', '));
  console.log('legend: YES visible | grey disabled | - hidden | ABSENT no such element\n');
  const head = ['tchr', 'canGen', 'want', 'rvw', 'GATE'];
  console.log(head.map(h => h.padEnd(7)).join('') +
              ELEMENTS.map(e => e.replace('comp-', '').padEnd(11)).join(''));
  console.log('-'.repeat(head.length * 7 + ELEMENTS.length * 11));
  const bad = [];
  for (const teacher of [false, true])
  for (const canGen of [false, true])
  for (const unlocked of [false, true])
  for (const review of [false, true]) {
    const { gate, threw } = seed(topic, { teacher, canGen, unlocked, review });
    if (gate !== unlocked) bad.push({ teacher, canGen, unlocked, review, gate });
    const flags = [teacher ? 'T' : '.', canGen ? 'G' : '.', unlocked ? 'U' : '.', review ? 'R' : '.',
                   String(gate)];
    console.log(flags.map(f => String(f).padEnd(7)).join('') +
                ELEMENTS.map(e => String(vis(e)).padEnd(11)).join('') +
                (threw ? '   THREW: ' + threw : ''));
  }
  if (bad.length) {
    console.log('\n  !! ' + bad.length + ' row(s) where storyUnlocked() did NOT follow the seed:');
    for (const m of bad) console.log('     want=' + m.unlocked + ' got=' + m.gate +
      '  (teacher=' + m.teacher + ' canGen=' + m.canGen + ' review=' + m.review + ')');
  } else {
    console.log('\n  all 16 rows: storyUnlocked() followed the seed.');
  }
}

table('A. CLASSIC set (completion-driven gate)', CLASSIC);
table('B. MIXED-driven set (coverage-driven gate)', MIXED);
