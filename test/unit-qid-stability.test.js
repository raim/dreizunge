// unit-qid-stability.test.js
// Commit A keystone: stable per-question IDs. Exercises are re-derived every play with
// shuffle/pick/slice, so a durable "solved" bit needs an id derived from CONTENT + skill, not
// from the shuffle. This test proves:
//   1) qid ignores shuffled fields (choices order, distractors, math_order.numbers order);
//   2) qid distinguishes different skills on the same item, and the same skill across lessons;
//   3) markSolved is monotonic, per-topic, and never records a flagged question;
//   4) end-to-end: the real buildStandardExercises pipeline yields STABLE qids across
//      independent re-derivations (different RNG), i.e. the id survives the actual shuffle.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(name){
  const at = html.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('function not found: ' + name);
  const b = html.indexOf('{', at); let d = 0, i = b;
  for (; i < html.length; i++){ if (html[i] === '{') d++; else if (html[i] === '}'){ d--; if (!d){ i++; break; } } }
  return html.slice(at, i);
}

// ── Sandbox with the qid module + its tiny deps ──────────────────────────────
const APP = { lessonData: null, cur: null, progress: { completed: {}, solved: {} } };
let saved = 0;
const sandbox = {
  APP,
  saveProg: () => { saved++; },
  stripFuri: s => String(s == null ? '' : s),   // simplified; qid only needs a stable passthrough
};
const src = [
  ext('_qidHash'), ext('_qidCanonical'), ext('qid'),
  ext('_solvedMap'), ext('isSolved'), ext('markSolved'),
  // markSolved calls _exFlagState → _exFlagTarget → _resolveExItem; stub the flag lookup so we
  // can control "is this flagged" without the whole resolver graph.
  'function _exFlagState(ex){ return ex && ex.__flagged ? { comment: "x" } : null; }',
].join('\n');
const make = new Function(...Object.keys(sandbox), src + '\nreturn { qid, _qidCanonical, markSolved, isSolved, _solvedMap };');
const M = make(...Object.values(sandbox));

// ── 1) Shuffle-independence ──────────────────────────────────────────────────
const a1 = { type: 'mcq_target_source', target: 'Katze', source: 'cat', choices: ['cat','dog','fish','bird'] };
const a2 = { type: 'mcq_target_source', target: 'Katze', source: 'cat', choices: ['bird','fish','dog','cat'] }; // reshuffled + different distractors would still...
assert.strictEqual(M.qid(a1, 'L1'), M.qid(a2, 'L1'), 'MCQ qid ignores choice order');
const m1 = { type: 'math_order', direction: 'asc', numbers: [3,1,2], correct: ['1','2','3'] };
const m2 = { type: 'math_order', direction: 'asc', numbers: [2,3,1], correct: ['1','2','3'] };
assert.strictEqual(M.qid(m1, 'L1'), M.qid(m2, 'L1'), 'math_order qid ignores shuffled numbers');
const c1 = { type: 'math_calc', a: '3', op: '+', b: '4', correct: '7', choices: ['7','8','6','9'] };
const c2 = { type: 'math_calc', a: '3', op: '+', b: '4', correct: '7', choices: ['9','6','8','7'] };
assert.strictEqual(M.qid(c1, 'L1'), M.qid(c2, 'L1'), 'math_calc qid ignores choice order');
console.log('  qid is stable across shuffled choices / numbers: OK');

// ── 2) Distinctness: skill, item, lesson ─────────────────────────────────────
const listen = { type: 'listen_mcq', target: 'Katze', source: 'cat' };
const typed  = { type: 'listen_type', target: 'Katze', source: 'cat' };
assert.notStrictEqual(M.qid(listen, 'L1'), M.qid(typed, 'L1'), 'different skill on same item → different qid');
assert.notStrictEqual(M.qid(a1, 'L1'), M.qid({ ...a1, target: 'Hund', source: 'dog' }, 'L1'), 'different item → different qid');
assert.notStrictEqual(M.qid(a1, 'L1'), M.qid(a1, 'L2'), 'same item in a different lesson → different qid');
// conjugation: each pronoun form is its own question
const cj1 = { type: 'mcq_conjugation', infinitive: 'sein', pronoun: 'ich', correct: 'bin' };
const cj2 = { type: 'mcq_conjugation', infinitive: 'sein', pronoun: 'du', correct: 'bist' };
assert.notStrictEqual(M.qid(cj1, 'L1'), M.qid(cj2, 'L1'), 'each conjugation pronoun form is a distinct qid');
// syn vs antonym on the same base
const syn = { type: 'syn_select', mode: 'synonyms', base: 'big' };
const ant = { type: 'syn_select', mode: 'antonyms', base: 'big' };
assert.notStrictEqual(M.qid(syn, 'L1'), M.qid(ant, 'L1'), 'synonyms vs antonyms on same base → distinct qid');
// stable across repeated calls
assert.strictEqual(M.qid(a1, 'L1'), M.qid(a1, 'L1'), 'qid is deterministic across calls');
// id shape
assert.ok(/^L1:mcq_target_source:[0-9a-z]+$/.test(M.qid(a1, 'L1')), 'qid has the <lesson>:<type>:<hash> shape');
console.log('  qid distinguishes skill / item / lesson, deterministic, well-formed: OK');

// ── 3) markSolved: monotonic, per-topic, flag-aware ──────────────────────────
APP.lessonData = { topic: 'T1', lessons: [{ id: 'L1' }] };
APP.cur = { lessonIdx: 0 };
saved = 0;
const idA = M.markSolved(a1);
assert.ok(idA, 'markSolved returns a qid');
assert.strictEqual(saved, 1, 'first solve persists');
M.markSolved(a1);
assert.strictEqual(saved, 1, 're-solving the same question does not persist again (monotonic)');
assert.ok(M.isSolved('T1', idA), 'isSolved true after markSolved');
assert.ok(!M.isSolved('T2', idA), 'solved set is per-topic');
// flagged questions are never recorded
const flagged = { type: 'mcq_target_source', target: 'X', source: 'y', __flagged: true };
const before = saved;
assert.strictEqual(M.markSolved(flagged), '', 'flagged question is not recorded');
assert.strictEqual(saved, before, 'flagged solve does not persist');
console.log('  markSolved: monotonic, per-topic, excludes flagged: OK');

// ── 4) End-to-end stability through the REAL builder pipeline ────────────────
// Rebuild buildStandardExercises with its deps, derive the same lesson twice (independent
// RNG), and assert the qid of every produced exercise is drawn from ONE stable universe —
// i.e. re-derivation never invents a new id for the same underlying content.
const buildSrc = [ext('shuffle'), ext('pick'), ext('buildStandardExercises')].join('\n');
const buildEnv = {
  APP: { lessonData: null, lang: 'de', _teacherMode: false },
  jaTokenize: t => [t],
};
const buildFns = new Function(...Object.keys(buildEnv), buildSrc + '\nreturn { buildStandardExercises };')(...Object.values(buildEnv));
const lesson = {
  id: 'L1', type: 'standard',
  vocab: [
    { target: 'Katze', source: 'cat' }, { target: 'Hund', source: 'dog' },
    { target: 'Vogel', source: 'bird' }, { target: 'Fisch', source: 'fish' },
    { target: 'Maus', source: 'mouse' }, { target: 'Pferd', source: 'horse' },
  ],
  sentences: [
    { target: 'Die Katze schläft', source: 'The cat sleeps', words: ['Die','Katze','schläft'] },
    { target: 'Der Hund läuft', source: 'The dog runs', words: ['Der','Hund','läuft'] },
    { target: 'Der Vogel singt', source: 'The bird sings', words: ['Der','Vogel','singt'] },
  ],
};
buildEnv.APP.lessonData = { lang: 'de', lessons: [lesson] };
// Derive many times; collect the qid universe each run and assert every run's ids are a
// subset of the union, and that the union stabilises (no new ids after enough runs) — proving
// the ids are content-derived, not shuffle-derived.
const universe = new Set();
const runs = [];
for (let r = 0; r < 40; r++){
  const exs = buildFns.buildStandardExercises(lesson, 0);
  const ids = exs.map(e => M.qid(e, 'L1'));
  ids.forEach(id => { assert.ok(id, 'every derived exercise yields a non-empty qid'); universe.add(id); });
  runs.push(new Set(ids));
}
// After 40 shuffled derivations, re-deriving must not produce an id outside the universe.
for (let r = 0; r < 10; r++){
  const exs = buildFns.buildStandardExercises(lesson, 0);
  exs.forEach(e => assert.ok(universe.has(M.qid(e, 'L1')),
    'a re-derived exercise reuses an existing qid (stable across shuffle)'));
}
// Sanity: the universe is bounded and reasonable (content, not per-shuffle explosion).
assert.ok(universe.size >= 6 && universe.size <= 60,
  `qid universe is bounded by content, got ${universe.size}`);
console.log(`  end-to-end: ${universe.size} stable qids across 50 shuffled derivations: OK`);

// ── 5) Clear-progress wiring drops the solved store too (source guards) ──────
assert.ok(/delete APP\.progress\.solved\[tp\]/.test(html),
  'storyline clear-progress also deletes the solved store for each topic');
assert.ok(/if \(APP\.progress\.solved\) delete APP\.progress\.solved\[topic\]/.test(html),
  'per-topic clear-progress also deletes the solved store');
// markSolved is actually wired into the correct-answer path.
assert.ok(/C\.correct\+\+; C\.total\+\+; C\.streak\+\+;[\s\S]{0,80}markSolved\(ex\)/.test(html),
  'markSolved is called on a correct answer');
console.log('  clear-progress clears solved; markSolved wired to correct-answer path: OK');

console.log('unit-qid-stability: ALL PASSED');
