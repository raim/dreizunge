// unit-conjugation-distractors.test.js
// v78_d (user testing notes, group B) — a conjugation MCQ's wrong options must be OTHER FORMS OF
// THE SAME VERB, and the question is not padded to four.
//
// The pool used to be a shuffled UNION of this verb's other forms and every form of every other
// verb in the lesson, capped at three. Two consequences the user hit:
//
//   • **It stops being a grammar question.** Offered `parlo / sei / siamo / mangiate` for "io
//     (parlare)", a learner picks the one whose stem looks like the infinitive and never considers
//     the paradigm. That is a vocabulary question wearing a grammar badge.
//   • **It pads.** A verb with two contrasting forms got its question topped up from elsewhere
//     rather than asked with three options.
//
// Because the union was SHUFFLED, other verbs' forms crowded out the real paradigm even when the
// verb had plenty of its own — so this was not a rare fallback, it was the common case in any
// lesson carrying more than one verb.
//
// Note: no conjugation lesson exists in the bundled corpus (see the builder's own comment at
// `_cutCoverageRound`), so this file works from fixtures. That is also why the defect survived —
// there was no shipped data to notice it on.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

const C = loadClient({ quiet: true });
C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');

// Two Italian verbs in one lesson — the shape that produced the report. `essere` is deliberately
// the irregular one, because its forms look nothing like `parlare`'s and so were the most
// recognisable intruders.
const LESSON = {
  type: 'conjugation',
  conjugations: [
    { infinitive: 'parlare', source: 'sprechen', forms: [
      { pronoun: 'io',   form: 'io parlo' },
      { pronoun: 'tu',   form: 'tu parli' },
      { pronoun: 'lui',  form: 'lui parla' },
      { pronoun: 'noi',  form: 'noi parliamo' },
      { pronoun: 'voi',  form: 'voi parlate' },
      { pronoun: 'loro', form: 'loro parlano' },
    ] },
    { infinitive: 'essere', source: 'sein', forms: [
      { pronoun: 'io',   form: 'io sono' },
      { pronoun: 'tu',   form: 'tu sei' },
      { pronoun: 'lui',  form: 'lui è' },
      { pronoun: 'noi',  form: 'noi siamo' },
      { pronoun: 'voi',  form: 'voi siete' },
      { pronoun: 'loro', form: 'loro sono' },
    ] },
  ],
};

// The builder SAMPLES (`_cutCoverageRound(exs, 14)`) and shuffles, so one call is not evidence.
// Run it repeatedly and pool the results — a stray other-verb distractor at 1-in-N would otherwise
// pass by luck, which is the whole failure mode being guarded.
function buildMany(lesson, lang, runs) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const r = C.run(`JSON.stringify(buildConjugationExercises(${JSON.stringify(lesson)}, ${JSON.stringify(lang)}))`,
                    'buildConjugationExercises');
    out.push(...JSON.parse(r));
  }
  return out;
}

const RUNS = 40;
const all = buildMany(LESSON, 'it', RUNS);
const mcqs = all.filter(e => e.type === 'mcq_conjugation');
assert.ok(mcqs.length > 0, 'the builder produced conjugation MCQs at all (non-vacuity for everything below)');

// The forms belonging to each verb, as the builder itself derives them — read from the product's
// own merge step rather than re-typed here, so a change to the grouping rule cannot silently make
// this test assert against a stale idea of the paradigm.
const formsOf = {};
for (const v of LESSON.conjugations) {
  const merged = JSON.parse(C.run(
    `JSON.stringify(mergeConjugationForms(${JSON.stringify(v.forms)}, 'it'))`, 'mergeConjugationForms'));
  formsOf[v.infinitive] = new Set(merged.map(m => m.cleanForm));
}

// ── 1. Every wrong option is a form of the SAME verb ─────────────────────────
{
  let checked = 0;
  for (const ex of mcqs) {
    const own = formsOf[ex.infinitive];
    assert.ok(own, `fixture covers ${ex.infinitive}`);
    for (const ch of ex.choices) {
      assert.ok(own.has(ch),
        `"${ch}" is offered for ${ex.infinitive} (${ex.pronoun}) but is not one of its forms — ` +
        `choices: ${JSON.stringify(ex.choices)}`);
      checked++;
    }
  }
  console.log(`  every option in ${mcqs.length} MCQs over ${RUNS} builds is a form of its own verb (${checked} options)`);
}

// ── 2. Non-vacuity: the OTHER verb's forms are genuinely tempting and genuinely present ──
// Without this, §1 could pass because the two verbs happen to share their forms, or because the
// fixture's second verb never reached the builder at all.
{
  const shared = [...formsOf['parlare']].filter(f => formsOf['essere'].has(f));
  assert.deepStrictEqual(shared, [],
    'the two fixture verbs share NO form — so an intruder would have been detectable in §1');
  const verbsSeen = new Set(mcqs.map(e => e.infinitive));
  assert.ok(verbsSeen.has('parlare') && verbsSeen.has('essere'),
    'both verbs produced questions — §1 ran against a lesson that really had two verbs to confuse');
  console.log('  the fixture verbs share no forms and both were exercised');
}

// ── 3. The correct answer is the asked pronoun's form, and it is among the choices ──
{
  for (const ex of mcqs) {
    assert.ok(ex.choices.includes(ex.correct),
      `the correct form "${ex.correct}" is on offer for ${ex.infinitive} (${ex.pronoun})`);
    assert.ok(formsOf[ex.infinitive].has(ex.correct), 'and it belongs to that verb');
  }
  console.log('  the correct form is always among the options');
}

// ── 4. No padding: a two-form verb asks a three-option question ──────────────
// The other half of the user's note. A verb with exactly two contrasting forms can offer exactly
// one distractor; before v78_d it was topped up to four from the neighbouring verb.
{
  const small = { type: 'conjugation', conjugations: [
    { infinitive: 'dovere', source: 'müssen', forms: [
      { pronoun: 'io', form: 'io devo' },
      { pronoun: 'noi', form: 'noi dobbiamo' },
    ] },
    // A second verb with a full paradigm sits right there as padding material. If the builder is
    // willing to borrow, it has six forms to borrow from — so this fixture makes padding visible
    // rather than merely possible.
    { infinitive: 'essere', source: 'sein', forms: [
      { pronoun: 'io',   form: 'io sono' },
      { pronoun: 'tu',   form: 'tu sei' },
      { pronoun: 'lui',  form: 'lui è' },
      { pronoun: 'noi',  form: 'noi siamo' },
      { pronoun: 'voi',  form: 'voi siete' },
      { pronoun: 'loro', form: 'loro sono' },
    ] },
  ] };
  const dov = buildMany(small, 'it', RUNS)
    .filter(e => e.type === 'mcq_conjugation' && e.infinitive === 'dovere');
  assert.ok(dov.length > 0, 'the two-form verb produced questions');
  for (const ex of dov) {
    assert.strictEqual(ex.choices.length, 2,
      `a two-form verb asks a TWO-option question, not a padded four: ${JSON.stringify(ex.choices)}`);
  }
  console.log('  a two-form verb is asked with two options, not padded');
}

// ── 5. Narrowing the builder did not strand coverage (v71_s) ─────────────────
// "When a builder is narrowed, narrow the COVERAGE UNIVERSE to match" — a denominator counting
// questions the round will never ask can never be satisfied. Removing the cross-verb pool means a
// form with no same-verb distractor now yields no MCQ, so the claim to check is that every merged
// form still produces SOME exercise.
//
// It holds structurally: a verb whose forms all merge to one cleanForm has cleanForms.length === 1,
// so its only index is 0 and `fi % 3 === 0` emits a type_conjugation; any verb with more than one
// distinct form gives every one of its forms at least one same-verb distractor. Asserted rather
// than argued, on a verb that is fully syncretic — the only case that could regress.
{
  const flat = { type: 'conjugation', conjugations: [
    { infinitive: 'x', source: 'x', forms: [
      { pronoun: 'io',  form: 'io uguale' },
      { pronoun: 'tu',  form: 'tu uguale' },
      { pronoun: 'noi', form: 'noi uguale' },
    ] },
  ] };
  const built = buildMany(flat, 'it', 5);
  assert.ok(built.length > 0,
    'a fully syncretic verb still yields an exercise — otherwise its coverage keys are unreachable');
  assert.ok(built.some(e => e.type === 'type_conjugation'),
    'and it is the typed variant that carries it (no MCQ is possible with one distinct form)');
  assert.ok(!built.some(e => e.type === 'mcq_conjugation'),
    'no MCQ is invented for it — a question with no honest distractor is not asked');
  console.log('  a fully syncretic verb still produces an exercise, and no fake MCQ');
}

console.log('unit-conjugation-distractors: ALL PASSED');
