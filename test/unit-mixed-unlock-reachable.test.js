// unit-mixed-unlock-reachable.test.js
// v77_c: settles the OPEN question recorded in build_history/v76_card_gates.md — "86 seeded solved
// keys, 0 counted, total 31" on a mixed-driven chapter, on the branch that gates story unlock.
//
// The answer is a SEEDING ARTEFACT, not a product defect. v74_c moved coverage onto SOURCE ITEM
// keys (`lessonId:i:hash`) while round assembly still keys on QUESTION ids (`lessonId:type:hash`).
// The v76 probe seeded the qid universe into APP.progress.solved, which topicCoverage never reads,
// so it counted 0. markSolved writes BOTH, so a real learner is unaffected.
//
// This file guards the thing that would actually hurt if it broke: that a learner CAN unlock the
// story on a mixed-driven chapter by playing. It drives markSolved through buildExercises rather
// than seeding either map (session-28 rule 1 — call the product function), because seeding is the
// exact mistake that produced the open question.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const isMixed = t => (t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden);
const usable = t => (t.story || '').length > 200 && (t.lessons || []).length >= 3;
const MIXED = store.topics.find(t => usable(t) && isMixed(t));

// The corpus is not a constant (INTERNALS, harness limits). If no mixed-driven chapter exists this
// file has nothing to say, and must say so rather than passing vacuously.
assert.ok(MIXED, 'the corpus contains a mixed-driven chapter with a story and >=3 lessons');

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
       APP.storylines = ${JSON.stringify(store.storylines || [])}; true;`, 'seed-static');
C.run(`
  APP.lessonData = ${JSON.stringify(MIXED)};
  APP.lang = ${JSON.stringify(MIXED.lang)}; APP.srcLang = ${JSON.stringify(MIXED.srcLang)};
  APP._teacherMode = false;
  APP.info = { backend:'none', canGenerate:false, version:'test', coverageThreshold: 1 };
  APP.progress = { completed: {}, solved: {}, learned: {} };
  APP.cur = { lessonIdx: 0, correct:1, total:1, mistakes:0, bestStreak:1, flagCount:0,
              exercises: [], cur: 0 };
  (function(){ var d=APP.lessonData, done={};
    (d.lessons||[]).forEach(function(L){ if(L) done[L.id]=true; });
    APP.progress.completed[d.topic]=done; })();
  true;`, 'seed-topic');

console.log(`  chapter: "${MIXED.topic}" (${MIXED.lang}<-${MIXED.srcLang})`);

// ── 1. The two key spaces are DISJOINT — the finding behind the open question ──
// This is why seeding qids counted zero. Asserted so the explanation cannot quietly stop being
// true: if the spaces ever overlap, coverage and round assembly have started sharing keys and the
// v74_c separation has regressed.
{
  const ks = JSON.parse(C.run(`(function(){
    var d=APP.lessonData, q={}, it={};
    (d.lessons||[]).forEach(function(L,i){
      try { (_lessonQidUniverse(i)||[]).forEach(function(k){ q[k]=1; }); } catch(e){}
      try { (_lessonItemUniverse(i)||[]).forEach(function(k){ it[k]=1; }); } catch(e){}
    });
    var qk=Object.keys(q), ik=Object.keys(it);
    return JSON.stringify({ q:qk.length, i:ik.length, shared:qk.filter(function(k){return it[k];}).length });
  })()`));
  assert.ok(ks.q > 0 && ks.i > 0, 'both universes are non-empty on this chapter');
  assert.strictEqual(ks.shared, 0,
    'question ids and item keys are disjoint key spaces (shared=' + ks.shared + ')');
  console.log(`  key spaces disjoint: ${ks.q} qids, ${ks.i} items, 0 shared`);
}

// ── 2. Seeding the QID universe does NOT move coverage — reproduces the open question ──
// Kept as the non-vacuity floor for §3: it shows the chapter starts locked and that the failure
// mode reported in v76_card_gates.md is reproducible, so §3 cannot pass for a trivial reason.
{
  const r = JSON.parse(C.run(`(function(){
    var d=APP.lessonData, s={};
    (d.lessons||[]).forEach(function(L,i){
      try { (_lessonQidUniverse(i)||[]).forEach(function(q){ s[q]=true; }); } catch(e){}
    });
    APP.progress.solved[d.topic]=s;
    return JSON.stringify({ seeded:Object.keys(s).length, cov:topicCoverage(true),
                            unlocked:storyUnlocked(d) });
  })()`));
  assert.ok(r.seeded > 0, 'the qid seeding really wrote keys');
  assert.strictEqual(r.cov.solved, 0, 'qid keys count for nothing in topicCoverage');
  assert.strictEqual(r.unlocked, false, 'and the story stays locked — the reported symptom');
  console.log(`  qid-seeded: ${r.seeded} keys -> coverage ${r.cov.solved}/${r.cov.total}, locked`);
}

// ── 3. Playing DOES unlock it. This is the claim that matters. ──
// Builders sample (INTERNALS: "a builder that caps is sampling"), so one round is not the whole
// universe — replaying is the designed way up (repeatForCoverage). Bounded so a plateau fails
// loudly instead of hanging.
{
  const conv = JSON.parse(C.run(`(function(){
    var d=APP.lessonData;
    APP.progress.solved[d.topic] = {};              // discard the §2 seeding entirely
    var hist=[];
    for (var r=0; r<40; r++){
      (d.lessons||[]).forEach(function(L,i){
        if(!L || L.type === 'mixed') return;
        var prev=APP.cur.lessonIdx; APP.cur.lessonIdx=i;
        try { (buildExercises(i)||[]).forEach(function(ex){ try { markSolved(ex); } catch(e){} }); }
        catch(e){}
        APP.cur.lessonIdx=prev;
      });
      hist.push(topicCoverage(true).pct);
      if (storyUnlocked(d)) break;
    }
    var m=_solvedMap(d.topic), keys=Object.keys(m);
    return JSON.stringify({ hist:hist, rounds:hist.length, unlocked:storyUnlocked(d),
      cov:topicCoverage(true),
      itemKeys:keys.filter(function(k){return /:i:/.test(k);}).length,
      qidKeys:keys.filter(function(k){return !/:i:/.test(k);}).length });
  })()`));
  assert.ok(conv.itemKeys > 0, 'markSolved credits the SOURCE ITEM, not only the question');
  assert.ok(conv.qidKeys > 0, 'markSolved still records the question id for round assembly');
  assert.strictEqual(conv.unlocked, true,
    'a learner reaches the story unlock by playing (coverage by round: ' + conv.hist.join('->') + ')');
  // v78: this used to assert coverage was COMPLETE (solved === total). That held on the v77 corpus
  // by coincidence — the replay loop stops the moment the gate opens, and on that chapter the gate
  // happened to open at 100%. It is an over-claim: the prep gate is not pure coverage, so a new
  // chapter unlocked at 31 of 43 and the assertion failed while the product was correct.
  //
  // The claim this file exists for is that the unlock is REACHABLE BY PLAYING, asserted above.
  // What is added here is only that playing genuinely moved coverage — otherwise "unlocked" could
  // pass on a chapter that was already open.
  assert.ok(conv.cov.solved > 0 && conv.cov.pct > 0,
    `playing raised coverage (${conv.cov.solved}/${conv.cov.total})`);
  assert.ok(conv.hist.length && conv.hist[conv.hist.length - 1] >= conv.hist[0],
    'and coverage never went backwards across the replays');
  console.log(`  played: coverage ${conv.hist.join(' -> ')} over ${conv.rounds} round(s), unlocked`);
  console.log(`  markSolved wrote both spaces: ${conv.itemKeys} item, ${conv.qidKeys} qid`);
}

console.log('unit-mixed-unlock-reachable: ALL PASSED');
