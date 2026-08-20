// PLAN §8/B4 — BKT runs from the append-only observation log in shadow mode only.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

const C = loadClient({ quiet: true });

// 1. The BKT update is a deterministic Bayesian posterior followed by learning. It consumes only
// canonical skill observations, preserves append order, and never treats an untagged row as a KC.
{
  const got = JSON.parse(C.run(`JSON.stringify(bktShadowSkills([
    {skillId:'it:vocab:successione', correct:true, timestamp:'2026-01-01T00:00:00.000Z'},
    {skillId:'it:vocab:successione', correct:false, timestamp:'2026-01-02T00:00:00.000Z'},
    {skillId:null, correct:true, timestamp:'2026-01-03T00:00:00.000Z'}
  ]))`));
  const rec = got['it:vocab:successione'];
  assert.strictEqual(rec.attempts, 2, 'only resolved skill observations are counted');
  assert.strictEqual(rec.correct, 1);
  assert.strictEqual(rec.lastSeen, '2026-01-02T00:00:00.000Z');
  // Correct from .20 -> .60 exactly under the documented global parameters; a later wrong lowers it.
  assert.ok(Math.abs(rec.pMastery - 0.28421052631578947) < 1e-12,
    'posterior then pLearn update follows the BKT parameters, in observation order');
  assert.strictEqual(Object.keys(got).length, 1, 'untagged evidence does not invent a skill state');
  console.log('  BKT: canonical observations update one deterministic skill state');
}

// 2. Shadow comparison is defined only for a topic that declares reviewed skills. It reads the
// existing gate but cannot change it; it records a disagreement transition once rather than once
// per render/answer.
{
  const got = JSON.parse(C.run(`(function(){
    APP.progress = { observations:[
      {skillId:'it:vocab:successione',correct:true,timestamp:'2026-01-01T00:00:00.000Z'},
      {skillId:'it:vocab:successione',correct:true,timestamp:'2026-01-02T00:00:00.000Z'}
    ] };
    _setCompleteRaw = function(){ return false; };
    var topic = { id:'bkt-topic', topic:'BKT topic', lessons:[{ vocab:[{skillId:'it:vocab:successione'}] }] };
    var first = refreshBktShadow(topic);
    var second = refreshBktShadow(topic);
    _setCompleteRaw = function(){ return true; };
    var agreement = refreshBktShadow(topic);
    APP.progress.observations.push({skillId:'it:vocab:successione',correct:false,timestamp:'2026-01-03T00:00:00.000Z'});
    var changed = refreshBktShadow(topic);
    var legacy = refreshBktShadow({id:'legacy', lessons:[{vocab:[{target:'old'}]}]});
    return JSON.stringify({
      first, second, agreement, changed, legacy,
      disagreements:APP.progress.bktShadow.disagreements,
      stored:APP.progress.bktShadow.topics['bkt-topic']
    });
  })()`));
  assert.strictEqual(got.first.bktComplete, true, 'two correct observations clear the .70 BKT threshold');
  assert.strictEqual(got.first.gateComplete, false, 'the existing gate is read as-is, not replaced');
  assert.strictEqual(got.disagreements.length, 2,
    'one initial disagreement and one changed disagreement are retained; identical refresh is silent');
  assert.strictEqual(got.agreement.bktComplete, true);
  assert.strictEqual(got.agreement.gateComplete, true, 'agreement is observable without adding a disagreement');
  assert.strictEqual(got.changed.bktComplete, false, 'a later wrong changes BKT only');
  assert.strictEqual(got.changed.gateComplete, true, 'the gate remains whatever its existing rule says');
  assert.strictEqual(got.legacy, null, 'untagged legacy topics are explicitly incomparable, not failed');
  assert.deepStrictEqual(got.stored.requiredSkillIds, ['it:vocab:successione']);
  console.log('  BKT shadow: tagged-topic comparison logs transitions and leaves the gate untouched');
}

console.log('unit-bkt-shadow: ALL PASSED');
