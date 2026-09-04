// unit-inflection-label-backfill.test.js — v89_f.
//
// backfill-inflection-labels.js re-runs v89_d's form-label normalisation over the EXISTING corpus.
// Its DECISIONS are shared with the generator (inflection-labels.js, covered through
// unit-inflection-label-normalise.test.js); what is new and only here is the two pure halves that
// bracket the model call: which lessons are in scope, and how a repair is written back.
//
// ⚠️ The write-back is where the risk is, and it is not hypothetical. The user's server runs
// continuously and writes lessons.json on every answered question, while this script spends MINUTES
// inside model calls between its read and its write. So `applyPlan` re-reads and matches on CONTENT
// — topic id → lesson id → the item's own sentence + surfaceForm + original choices — never on an
// index (analysis-corrections.js's header has the standing reasoning). Sections 4–7 are that claim.
'use strict';
const assert = require('assert');
const path = require('path');
const { planBackfill, applyPlan } = require(path.join(__dirname, '..', 'backfill-inflection-labels.js'));

const item = (surfaceForm, choices, correctIndex, sentence) => ({
  sentence: sentence || ('Een zin met ' + surfaceForm + '.'), surfaceForm,
  lemma: 'x', lemmaChoices: ['x', 'y'], lemmaCorrectIndex: 0,
  formLabel: choices[correctIndex], formChoices: choices.slice(), formCorrectIndex: correctIndex,
  translation: 't', explanation: 'e',
});
const store = () => ({
  topics: [
    { id: 't_nl', topic: 'Dutch chapter', lang: 'nl', srcLang: 'de', lessons: [
      { id: 3, type: 'standard', vocab: [] },
      { id: 7, type: 'inflections', items: [
        item('geeft', ['Tegenwoordige tijd', 'Verleden tijd', 'Infinitief'], 0),
        item('wolken', ['Enkelvoud', 'Meervoud'], 1),
      ] },
      // ⚠️ Written because the first mutation run said so: with `standard`/`vocab` lessons alone,
      // removing the `type !== 'inflections'` check changed NOTHING (those lessons have no `items`,
      // so the item filter dropped them anyway) and the mutation stayed green. The TYPE is the scope
      // statement; field shape is not. A lesson of another type carrying inflection-shaped items is
      // contrived in this corpus — and is exactly, and only, what makes that check falsifiable.
      { id: 9, type: 'word_forms', items: [item('anders', ['Bijwoord', 'Bijvoeglijk naamwoord'], 0)] },
    ] },
    { id: 't_en', topic: 'English source', lang: 'de', srcLang: 'en', lessons: [
      { id: 7, type: 'inflections', items: [item('Köpfe', ['plural', 'singular'], 0)] },
    ] },
    { id: 't_novo', topic: 'No inflections', lang: 'it', srcLang: 'nl', lessons: [
      { id: 3, type: 'standard', vocab: [] },
    ] },
    { id: 't_bad', topic: 'Malformed', lang: 'it', srcLang: 'nl', lessons: [
      { id: 7, type: 'inflections', items: [
        { surfaceForm: 'a', sentence: 's', formChoices: ['one'], formCorrectIndex: 0 },        // < 2 choices
        { surfaceForm: 'b', sentence: 's', formChoices: ['one', 'two'], formCorrectIndex: 9 }, // index out of range
        { surfaceForm: 'c', sentence: 's', formChoices: ['one', 'two'] },                      // no index at all
        item('d', ['uno', 'due'], 0),                                                          // the one good item
      ] },
    ] },
  ],
});

// ── 1. Scope ───────────────────────────────────────────────────────────────────────────────────
{
  const plan = planBackfill(store());
  const ids = plan.map(p => p.topicId);
  assert.deepStrictEqual(ids, ['t_nl', 't_bad'], 'only non-English-source topics WITH usable inflections items: ' + JSON.stringify(ids));
  assert.ok(!ids.includes('t_en'), '⚠️ an English-source topic is skipped — the same gate the generator uses, and the reason an already-correct English label is never handed to a model that could reword it');
  assert.ok(!ids.includes('t_novo'), 'a topic with no inflections lesson is skipped');
  assert.strictEqual(plan.filter(p => p.topicId === 't_nl').length, 1,
    '⚠️ the Dutch topic contributes ONE entry — its word_forms lesson is out of scope even though its ' +
    'items are shaped identically. The lesson TYPE is the scope statement, not the field names');
  assert.strictEqual(plan[0].items.length, 2, 'both good items of the Dutch lesson are in');
  assert.strictEqual(plan[0].lessonId, 7, 'the LESSON id is carried — the write-back needs it');
  assert.strictEqual(plan[0].srcLang, 'de', 'and the source language, for the prompt');
  // One entry per LESSON, because that is the unit the model call is batched over.
  assert.strictEqual(plan.length, 2, 'one plan entry per lesson, not per item');
}
console.log('  plan: non-English sources with usable inflections items only, one entry per lesson: OK');

// ── 2. Malformed items are dropped, not repaired blindly ───────────────────────────────────────
// The generator only ever sees items validateInflectionsItems has already accepted; the corpus has
// no such guarantee, so an item whose formCorrectIndex does not point into its own choices cannot
// have formLabel re-derived and must not be sent at all.
{
  const plan = planBackfill(store());
  const bad = plan.find(p => p.topicId === 't_bad');
  assert.strictEqual(bad.items.length, 1, 'only the one well-formed item survives: ' + JSON.stringify(bad.items.map(i => i.surfaceForm)));
  assert.strictEqual(bad.items[0].surfaceForm, 'd', 'and it is the right one');
}
console.log('  malformed items (too few choices, a correct index that points nowhere) are dropped: OK');

// ── 3. --topic narrows to one, by id or by name ────────────────────────────────────────────────
{
  assert.deepStrictEqual(planBackfill(store(), { topic: 't_nl' }).map(p => p.topicId), ['t_nl'], 'by id');
  assert.deepStrictEqual(planBackfill(store(), { topic: 'Malformed' }).map(p => p.topicId), ['t_bad'], 'by name');
  assert.deepStrictEqual(planBackfill(store(), { topic: 'nope' }).map(p => p.topicId), [], 'an unknown target plans nothing');
}
console.log('  --topic narrows by id or by name: OK');

// The normalised shape a model reply would have produced, for the Dutch lesson.
const repaired = (p) => ({
  topicId: p.topicId, lessonId: p.lessonId, before: p.before,
  items: p.items.map(it => {
    const next = it.formChoices.map(c => 'DE ' + c);
    return Object.assign({}, it, { formChoices: next, formLabel: next[it.formCorrectIndex] });
  }),
});

// ── 4. The happy write-back ────────────────────────────────────────────────────────────────────
{
  const s = store();
  const p = planBackfill(s).find(x => x.topicId === 't_nl');
  const r = applyPlan(s, [repaired(p)]);
  assert.strictEqual(r.applied, 2, 'both items written');
  assert.deepStrictEqual(r.skipped, [], 'nothing skipped');
  const items = s.topics.find(t => t.id === 't_nl').lessons.find(l => l.type === 'inflections').items;
  assert.deepStrictEqual(items[0].formChoices, ['DE Tegenwoordige tijd', 'DE Verleden tijd', 'DE Infinitief'], 'choices replaced in place');
  assert.strictEqual(items[1].formLabel, 'DE Meervoud', 'and formLabel follows the NON-ZERO correct index');
  assert.strictEqual(items[1].formLabel, items[1].formChoices[items[1].formCorrectIndex],
    'the validator invariant survives the write-back');
  assert.strictEqual(items[0].explanation, 'e', 'nothing else on the item was touched');
  assert.strictEqual(s.topics.find(t => t.id === 't_en').lessons[0].items[0].formChoices[0], 'plural',
    'and no other topic was touched');
}
console.log('  the write-back replaces choices and re-derives formLabel in place, touching nothing else: OK');

// ── 5. ⚠️ A repair whose item CHANGED on disk is dropped, never guessed at ──────────────────────
{
  for (const [mutate, what] of [
    [(it) => { it.formChoices = ['Iets anders', 'Nog iets']; }, 'its choices were rewritten'],
    [(it) => { it.sentence = 'Een heel andere zin.'; }, 'its sentence was rewritten'],
    [(it) => { it.surfaceForm = 'gaf'; }, 'its surfaceForm changed'],
    [(it) => { it.formChoices = it.formChoices.slice(0, 2); }, 'it lost a choice'],
  ]) {
    const s = store();
    const p = planBackfill(s).find(x => x.topicId === 't_nl');
    const res = repaired(p);
    const live = s.topics.find(t => t.id === 't_nl').lessons.find(l => l.type === 'inflections').items;
    const snapshot = JSON.parse(JSON.stringify(live[0]));
    mutate(live[0]);                                  // the server wrote while the model was thinking
    const after = JSON.parse(JSON.stringify(live[0]));
    const r = applyPlan(s, [res]);
    assert.strictEqual(r.applied, 1, `${what}: only the UNCHANGED item is repaired`);
    assert.strictEqual(r.skipped.length, 1, `${what}: the stale one is reported`);
    assert.ok(/changed on disk/.test(r.skipped[0].why), `${what}: with a reason a human can act on — got ${JSON.stringify(r.skipped[0])}`);
    assert.deepStrictEqual(live[0], after, `${what}: and is left EXACTLY as the other writer left it`);
    assert.notDeepStrictEqual(live[0], snapshot, `${what}: sanity — the fixture really did change`);
    assert.ok(live[1].formChoices.every(c => c.startsWith('DE ')), `${what}: its sibling was still repaired`);
  }
}
console.log('  an item that changed on disk between the read and the write is reported and left alone: OK');

// ── 6. ⚠️ Content-keyed, not index-keyed: a REORDERED lesson still repairs correctly ────────────
// The non-vacuity for §5. If the match were positional, reordering would silently write each
// repair onto the wrong item — which is precisely the failure an index key produces, and precisely
// why analysis-corrections.js forbids one.
{
  const s = store();
  const p = planBackfill(s).find(x => x.topicId === 't_nl');
  const res = repaired(p);
  const lesson = s.topics.find(t => t.id === 't_nl').lessons.find(l => l.type === 'inflections');
  lesson.items.reverse();                             // a regeneration reshuffled them
  const r = applyPlan(s, [res]);
  assert.strictEqual(r.applied, 2, 'both repairs still land');
  assert.deepStrictEqual(r.skipped, [], 'and nothing is reported stale');
  const byWord = Object.fromEntries(lesson.items.map(it => [it.surfaceForm, it.formChoices]));
  assert.deepStrictEqual(byWord['geeft'], ['DE Tegenwoordige tijd', 'DE Verleden tijd', 'DE Infinitief'],
    'each repair landed on ITS OWN item, not on whatever now sits at that index');
  assert.deepStrictEqual(byWord['wolken'], ['DE Enkelvoud', 'DE Meervoud'], 'and the other one likewise');
}
console.log('  a reordered lesson still repairs each item correctly — the key is content, not position: OK');

// ── 7. A vanished topic or lesson is reported, not thrown on ───────────────────────────────────
{
  const s = store();
  const p = planBackfill(s).find(x => x.topicId === 't_nl');
  const res = repaired(p);
  s.topics = s.topics.filter(t => t.id !== 't_nl');   // deleted while we were thinking
  const r = applyPlan(s, [res]);
  assert.strictEqual(r.applied, 0, 'nothing applied');
  assert.deepStrictEqual(r.skipped, [{ topicId: 't_nl', why: 'topic gone' }], 'and it says so');

  const s2 = store();
  const p2 = planBackfill(s2).find(x => x.topicId === 't_nl');
  const res2 = repaired(p2);
  const t2 = s2.topics.find(t => t.id === 't_nl');
  t2.lessons = t2.lessons.filter(l => l.type !== 'inflections');
  const r2 = applyPlan(s2, [res2]);
  assert.strictEqual(r2.applied, 0, 'nothing applied when the lesson is gone');
  assert.strictEqual(r2.skipped[0].why, 'lesson gone', 'and it says which');
}
console.log('  a topic or lesson deleted between the read and the write is reported, not crashed on: OK');

// ── 8. A model that returned everything unchanged writes nothing ───────────────────────────────
// Otherwise a re-run would report work it did not do, and idempotence would be unobservable.
{
  const s = store();
  const p = planBackfill(s).find(x => x.topicId === 't_nl');
  const r = applyPlan(s, [{ topicId: p.topicId, lessonId: p.lessonId, before: p.before, items: p.items }]);
  assert.strictEqual(r.applied, 0, 'identical labels count as no change');
  assert.deepStrictEqual(r.skipped, [], 'and are not an error either');
  // Idempotence: applying a real repair twice applies it once.
  const s2 = store();
  const p2 = planBackfill(s2).find(x => x.topicId === 't_nl');
  const res2 = repaired(p2);
  assert.strictEqual(applyPlan(s2, [res2]).applied, 2, 'first run writes');
  assert.strictEqual(applyPlan(s2, [res2]).applied, 0,
    'a second run of the SAME repair writes nothing — the originals it keys on are no longer there');
}
console.log('  an unchanged reply writes nothing, and re-running a repair is not a second write: OK');

console.log('unit-inflection-label-backfill: ALL PASSED');
