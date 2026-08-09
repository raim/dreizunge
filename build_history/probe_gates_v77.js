// probe_gates_v77.js — the CORRECTED card truth table. Supersedes probe_gates_v76.js.
//
// Why a replacement rather than a re-run: four of the five findings the v76 table produced were
// artefacts of what that probe did NOT seed, each in a different store —
//
//   finding 1  comp-back / comp-story  -> the elements DO NOT EXIST; lib-dom auto-vivified them
//   finding 2  comp-storyboard hidden  -> APP.savedList empty, so the storyline never resolved
//   finding 4  comp-drill never live   -> APP.progress.learned never written (the drill reads it)
//   the OPEN   coverage 0 of 86        -> seeded qid keys into a store read by item key
//
// Only finding 3 (comp-story-panel is the preview label) survived, and even that was understated:
// it is the whole bordered PANEL, not a label.
//
// So this probe:
//   1. asserts every element EXISTS IN THE MARKUP before reporting a state (rule 16),
//   2. seeds every store the card reads — storylines, savedList, learned ledger, completed,
//      and solved on the ITEM key space (rule 17),
//   3. reports _cardErrors() per row, so a swallowed throw can no longer masquerade as a gate.
'use strict';
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require(path.join(__dirname, '..', 'test', 'lib-dom'));

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── the elements, checked against the MARKUP first ──────────────────────────
const WANT = ['comp-story-text', 'comp-story-panel', 'comp-story-spk', 'comp-next', 'comp-repeat',
              'comp-drill', 'comp-crossword', 'comp-storyboard', 'comp-vocab', 'comp-hdr',
              'comp-lessons', 'comp-back'];
const REAL = [], PHANTOM = [];
for (const id of WANT) (HTML.includes(`id="${id}"`) ? REAL : PHANTOM).push(id);
console.log('elements present in markup : ' + REAL.join(', '));
console.log('elements that DO NOT EXIST : ' + (PHANTOM.length ? PHANTOM.join(', ') : '(none)'));
console.log('  (a phantom would read as a real element through lib-dom auto-vivification — rule 16)\n');

const byId = Object.fromEntries(store.topics.filter(t => t.id).map(t => [t.id, t]));
const isMixed = t => (t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden);
const ok = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;

// Prefer a chapter that belongs to a STORYBOARDED storyline, so the storyboard row is meaningful.
function pick(mixed) {
  for (const sl of (store.storylines || [])) {
    if (!sl.storyboard) continue;
    const t = (sl.chapters || []).map(c => byId[c]).find(x => x && ok(x) && isMixed(x) === mixed);
    if (t) return t;
  }
  return store.topics.find(t => ok(t) && isMixed(t) === mixed);
}
const CLASSIC = pick(false), MIXED = pick(true);
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang }));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])};
       APP.savedList  = ${JSON.stringify(SAVED)}; true;`);

const vis = id => C.run(`(function(){ var e=document.getElementById(${JSON.stringify(id)});
  if(!e) return 'ABSENT';
  if(e.style.display==='none') return '-';
  return e.disabled ? 'grey' : 'YES'; })()`);

function seed(topic, o) {
  C.run(`
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP._teacherMode = ${!!o.teacher}; APP._cardStrict = false;
    APP.info = { backend:'none', canGenerate:${!!o.canGen}, version:'probe', coverageThreshold: 1 };
    APP.progress = { completed: {}, solved: {}, learned: {} };
    true;`);
  // The wrong-answer ledger the DRILL reads. Without it comp-drill is grey for a reason that has
  // nothing to do with the gate under test (v77_d).
  if (o.mistakes !== false) C.run(`(function(){
    var led = _learnedLedger(APP.lessonData.lang, APP.lessonData.srcLang);
    led.vocab = {};
    for (var i=0;i<4;i++) led.vocab['WRONG'+i] = { source:'w'+i, seen:3, wrong:2 };
    for (var j=0;j<4;j++) led.vocab['KNOWN'+j] = { source:'k'+j, seen:3, wrong:0 };
  })();`);
  if (o.unlocked) C.run(`(function(){
    var d = APP.lessonData, done = {};
    (d.lessons||[]).forEach(function(L){ if(L) done[L.id] = true; });
    APP.progress.completed[d.topic] = done;
    // ITEM keys — the space topicCoverage actually reads (v74_c / v77_c). Seeding the qid
    // universe here is what made four rows of the v76 table unreachable.
    var solved = {};
    (d.lessons||[]).forEach(function(L, i){
      try { (_lessonItemUniverse(i)||[]).forEach(function(k){ solved[k] = true; }); } catch(e){}
    });
    APP.progress.solved[d.topic] = solved;
  })();`);
  C.run(`APP.cur = { lessonIdx: 0, correct: 1, total: 1, mistakes: 0, bestStreak: 1, flagCount: 0,
                     exercises: [], ${o.review ? '_review: true,' : ''} cur: 0 }; true;`);
  const gate = C.run(`(function(){ try { return storyUnlocked(APP.lessonData); } catch(e){ return 'ERR'; } })()`);
  let threw = null;
  try { C.run(`showComplete(${o.review ? 'true' : ''});`); } catch (e) { threw = e.message; }
  const swallowed = JSON.parse(C.run(`JSON.stringify(_cardErrors())`));
  return { gate, threw, swallowed };
}

function table(label, topic) {
  const sl = C.run(`(function(){ try { var s=_storylineOfTopic(${JSON.stringify(topic)});
    return s ? (s.id + (s.storyboard ? ' +board' : ' -board')) : 'none'; } catch(e){ return 'ERR'; } })()`);
  console.log('\n\n### ' + label);
  console.log('chapter: "' + topic.topic + '"  ' + topic.lang + '<-' + topic.srcLang +
    '  |  lessons: ' + (topic.lessons || []).map(l => l.type || 'standard').join(', '));
  console.log('storyline: ' + sl);
  console.log('legend: YES visible | grey disabled | - hidden\n');
  const head = ['tchr', 'canGen', 'want', 'rvw', 'GATE'];
  console.log(head.map(h => h.padEnd(7)).join('') +
              REAL.map(e => e.replace('comp-', '').padEnd(11)).join(''));
  console.log('-'.repeat(head.length * 7 + REAL.length * 11));
  const bad = [], dirty = [];
  for (const teacher of [false, true])
  for (const canGen of [false, true])
  for (const unlocked of [false, true])
  for (const review of [false, true]) {
    const { gate, threw, swallowed } = seed(topic, { teacher, canGen, unlocked, review });
    if (gate !== unlocked) bad.push({ teacher, canGen, unlocked, review, gate });
    if (swallowed.length) dirty.push({ teacher, canGen, unlocked, review, swallowed });
    console.log([teacher?'T':'.', canGen?'G':'.', unlocked?'U':'.', review?'R':'.', String(gate)]
                  .map(f => String(f).padEnd(7)).join('') +
                REAL.map(e => String(vis(e)).padEnd(11)).join('') +
                (threw ? '   THREW: ' + threw : ''));
  }
  console.log(bad.length
    ? '\n  !! ' + bad.length + ' row(s) where storyUnlocked() did NOT follow the seed:\n' +
      bad.map(m => `     want=${m.unlocked} got=${m.gate} (teacher=${m.teacher} canGen=${m.canGen} review=${m.review})`).join('\n')
    : '\n  all 16 rows: storyUnlocked() followed the seed.');
  console.log(dirty.length
    ? '  !! ' + dirty.length + ' row(s) swallowed an error: ' + JSON.stringify(dirty)
    : '  no row swallowed an error.');
}

table('A. CLASSIC set (completion-driven gate)', CLASSIC);
table('B. MIXED-driven set (coverage-driven gate)', MIXED);
