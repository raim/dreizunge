// unit-word-gate.test.js
// v81_a — TRACK T step 4: the WORD gate on the story unlock.
//
// T0: "only if ALL questions associated with each highlighted word (or via pass mark fraction) are
// solved we progress to the comprehension questions."
//
// ⚠️ IT SHIPS OPT-IN, and the measurement is the reason. Making word-green the gate outright would
// RE-LOCK 21 of the 22 chapter/learner pairs whose story is unlocked today — 95%, measured over the
// real `learners.json`. A word accumulates questions from vocab, from sentences (v80_v) and from
// every probe-bearing lesson, so "all questions about this word" is a far higher bar than "the
// lessons are done". A story a learner has EARNED would close again mid-session, which is the same
// hazard §T7 raises for the solved counter and the reason that item was deferred.
//
// So: the mechanism is here and the switch is the user's. `wordGate` is read from the topic, then
// the storyline, then `APP.info`. Unset — the default — leaves the v71_s rule untouched.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// A synthetic chapter, so the fraction is arithmetic rather than a corpus accident: four vocab
// words, one lesson, no sentences. Solving N of them makes the fraction exactly N/4.
const WORDS = [
  { target: 'chat',   source: 'Katze' },
  { target: 'chien',  source: 'Hund'  },
  { target: 'oiseau', source: 'Vogel' },
  { target: 'souris', source: 'Maus'  },
];
const TOPIC = {
  id: 'tp_wg', topic: 'WG', lang: 'fr', srcLang: 'de',
  story: 'Le chat et le chien.',
  lessons: [
    { id: 'L1', vocab: WORDS },
    { id: 'L2', type: 'comprehension', questions: [{ q: 'x', choices: ['a', 'b'], correctIndex: 0 }] },
  ],
};

function scene(opts) {
  const o = opts || {};
  const C = loadClient({ quiet: true });
  const topic = JSON.parse(JSON.stringify(TOPIC));
  if (o.topicGate != null) topic.wordGate = o.topicGate;
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = []; APP.storylines = ${JSON.stringify(o.storylines || [])};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1${o.infoGate != null ? ', wordGate:' + o.infoGate : ''} };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP.lessonData = ${JSON.stringify(topic)};
    if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
    saveProg = function(){};
    // Solve the first N vocab words, through the product's own key function.
    (function(){
      var d = APP.lessonData, m = _solvedMap(d.topic), L = d.lessons[0];
      (L.vocab || []).slice(0, ${o.solve || 0}).forEach(function(v){
        m[qid({ type:'mcq_source_target', target: v.target, source: v.source }, L.id)] = 1;
      });
    })();
    true;`, 'scene');
  return C;
}

// ── 1. The fraction is what it says ─────────────────────────────────────
{
  for (const [solved, want] of [[0, 0], [1, 0.25], [2, 0.5], [4, 1]]) {
    const C = scene({ solve: solved });
    assert.strictEqual(C.run(`_wordGateFraction(APP.lessonData)`), want,
      `${solved} of 4 words solved → fraction ${want}`);
  }
  console.log('  the green fraction is arithmetic and correct');
}

// ── 2. ⚠️ UNSET is the DEFAULT and changes NOTHING ──────────────────────
// The load-bearing claim of this release. With no `wordGate` anywhere, the v71_s rule answers, and
// it must answer the same whatever the words say.
{
  const none = scene({ solve: 0 });
  const most = scene({ solve: 4 });
  assert.strictEqual(none.run(`_wordGateTarget(APP.lessonData)`), null, 'no gate configured');
  // The lesson rule governs: neither prep lesson is done, so the story is locked in BOTH.
  assert.strictEqual(none.run(`storyUnlocked(APP.lessonData)`), false, 'locked with 0 words green');
  assert.strictEqual(most.run(`storyUnlocked(APP.lessonData)`), false,
    'and STILL locked with ALL words green — the default ignores the words entirely');
  console.log('  unset: the v71_s rule answers, words are ignored');
}

// ── 3. ⚠️ THE DISCRIMINATOR — configured, the words decide ──────────────
// Same states as §2, with a threshold set. The verdicts must now DIFFER, or the gate is inert.
{
  const half = scene({ solve: 2, infoGate: 0.5 });
  const none = scene({ solve: 0, infoGate: 0.5 });
  const all  = scene({ solve: 4, infoGate: 0.5 });
  assert.strictEqual(none.run(`storyUnlocked(APP.lessonData)`), false, 'below the threshold: locked');
  assert.strictEqual(half.run(`storyUnlocked(APP.lessonData)`), true, 'AT the threshold: unlocked');
  assert.strictEqual(all.run(`storyUnlocked(APP.lessonData)`), true, 'above it: unlocked');
  // Non-vacuity against §2: the SAME "all words green" state was LOCKED with no gate configured.
  assert.strictEqual(scene({ solve: 4 }).run(`storyUnlocked(APP.lessonData)`), false,
    'non-vacuity: this state is locked when no gate is configured — so the gate is what decided');
  console.log('  configured: the word fraction decides, and it is what changed the answer');
}

// ── 4. Most specific configuration wins ─────────────────────────────────
{
  const C = scene({ solve: 4, topicGate: 1, infoGate: 0 });
  assert.strictEqual(C.run(`_wordGateTarget(APP.lessonData)`), 1, 'the topic overrides APP.info');
  const D = scene({ solve: 1, topicGate: 0.9, infoGate: 0 });
  assert.strictEqual(D.run(`storyUnlocked(APP.lessonData)`), false,
    'and the topic threshold is the one applied');
  console.log('  topic > storyline > APP.info');
}

// ── 5. A chapter that tracks NO words falls back, rather than opening ───
// Answering "unlocked" on no evidence would hand the story to a learner who has done nothing.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = []; APP.storylines = [];
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:1, wordGate:0 };
    APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
    APP._teacherMode = false;
    APP.lessonData = { id:'tp_e', topic:'E', lang:'fr', srcLang:'de', story:'x',
      lessons:[{ id:'L1', type:'math', items:[] },
               { id:'L2', type:'comprehension', questions:[{q:'x',choices:['a'],correctIndex:0}] }] };
    saveProg = function(){}; true;`, 'empty');
  assert.strictEqual(C.run(`_wordGateFraction(APP.lessonData)`), null,
    'no tracked words → the gate has no opinion');
  // wordGate:0 would unlock everything if the fraction defaulted to 0-or-more; it must not.
  assert.strictEqual(C.run(`storyUnlocked(APP.lessonData)`), false,
    'so the lesson rule answers, and an unplayed chapter stays locked');
  console.log('  no tracked words: falls back rather than opening on no evidence');
}

// ── 6. Bad configuration is ignored, not obeyed ─────────────────────────
// A threshold that is not a number in 0..1 must leave the old rule in charge, never be coerced.
// ⚠️ The first version of this section interpolated its values into the scene UNQUOTED, so the
// string '0.5' arrived as the number 0.5 and the test failed on a case it was not actually
// creating. Values are injected as JSON now, so a string stays a string.
{
  const bad = (v) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = []; APP.storylines = [];
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:1, wordGate: ${JSON.stringify(v)} };
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
      APP._teacherMode = false;
      APP.lessonData = ${JSON.stringify(TOPIC)};
      saveProg = function(){}; true;`, 'bad');
    return C.run(`_wordGateTarget(APP.lessonData)`);
  };
  for (const v of ['0.5', -1, 2, null, 'yes', true]) {
    assert.strictEqual(bad(v), null,
      JSON.stringify(v) + ' is not a valid threshold and is ignored');
  }
  // Non-vacuity: a VALID one is still accepted, so the check is not simply rejecting everything.
  assert.strictEqual(bad(0.5), 0.5, 'non-vacuity: a valid threshold is accepted');
  assert.strictEqual(bad(0), 0, 'and 0 is valid — it is a threshold, not a missing value');
  console.log('  out-of-range and non-numeric thresholds are ignored; valid ones accepted');
}

// ── What this does NOT establish (rule 34) ──────────────────────────────
// • Nothing in the corpus sets `wordGate`, so the DEFAULT path is what ships and what every existing
//   learner gets. §2 is therefore the section that matters most today.
// • The 95% re-lock figure comes from a one-off measurement over `learners.json` at the v81 cut, not
//   from this file — it depends on learner history, which changes with every drop.
console.log('unit-word-gate: ALL PASSED');
