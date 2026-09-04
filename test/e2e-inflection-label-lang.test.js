// E2E: v89_d — the inflections form labels are NORMALISED into the source language after parsing.
//
// Why this exists as a transformation and not an instruction: `PROMPTS.inflections` has always asked
// for `{S}` form labels, and `v89_c` MEASURED the live model's compliance at 0 of 3 runs before that
// cut's prompt hardening and 1 of 3 after. A post-parse pass converts an instruction the model may
// ignore into a step it cannot skip.
//
// The fake model deliberately returns Dutch-looking metalanguage for BOTH topics, so a working pass
// and a missing one are distinguishable — a fixture already in the right language could not tell
// them apart. The normalisation branch echoes each key back with a "DE " marker, which is what lets
// this file assert the POSITIONAL mapping rather than merely that something changed.
//
// Both halves of the gate are driven from ONE boot (one server, one port): topic `t_nl` has a
// non-English source and must be normalised, `t_en` has an English one and must be left completely
// alone — the same `srcLang !== 'en'` gate the meta-translation pass already uses, and the one
// roadmap_v86.md's item AJ justifies.
const { boot, post, get, assert, sleep } = require('./lib');

const STORY = 'Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
const mkTopic = (id, srcLang) => ({
  id, topic: 'Test ' + id, userTopic: 'Test ' + id,
  lang: 'de', srcLang, difficulty: 2,
  story: STORY, lessons: [],
  generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});
const SEED = {
  schemaVersion: 29,
  topics: [mkTopic('t_nl', 'nl'), mkTopic('t_en', 'en')],
  storylines: [], flags: {}, progress: {},
};

async function waitJob(sport, jobId, timeoutMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(300);
  }
  throw new Error('job timed out');
}
async function addInflections(sport, id) {
  const start = await post(sport, '/api/lessons/add-lesson', { id, lessonFormat: 'inflections', difficulty: 2 });
  assert(start.status === 202, id + ': add-lesson accepted (got ' + start.status + ' ' + start.raw + ')');
  const fin = await waitJob(sport, start.body.jobId);
  assert(fin.status === 'done', id + ': job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');
}

(async () => {
  const env = await boot({ seed: SEED, log: true });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. A non-English source language: every label comes back normalised ────────────────────
    await addInflections(sport, 't_nl');
    const nl = (env.readStore().topics.find(t => t.id === 't_nl').lessons || []).find(l => l.type === 'inflections');
    assert(nl, 'an inflections lesson was appended to t_nl');
    assert(Array.isArray(nl.items) && nl.items.length === 2,
      'both fixture items survived validation (got ' + (nl.items || []).length + ')');

    for (const it of nl.items) {
      assert(it.formChoices.every(c => c.startsWith('DE ')),
        'every formChoice went through the normalisation pass: ' + JSON.stringify(it.formChoices));
      // The invariant validateInflectionsItems establishes must still hold AFTER the substitution:
      // formLabel is one of formChoices, at formCorrectIndex. This is the assertion that catches a
      // pass which translates formLabel separately and lets the two drift apart.
      assert(it.formLabel === it.formChoices[it.formCorrectIndex],
        'formLabel is still formChoices[formCorrectIndex] (' + JSON.stringify(it.formLabel) +
        ' vs ' + JSON.stringify(it.formChoices[it.formCorrectIndex]) + ')');
      assert(new Set(it.formChoices.map(c => c.toLowerCase())).size === it.formChoices.length,
        'the normalised choices are still distinct: ' + JSON.stringify(it.formChoices));
    }

    // POSITIONAL, not merely "something was replaced": each normalised value must be the marker
    // plus the ORIGINAL string that sat at that index, so a pass that shuffled or reused one key
    // for several choices fails here.
    const orig = {
      blieben: ['Verleden tijd, meervoud', 'Tegenwoordige tijd, meervoud', 'Infinitief'],
      war:     ['Tegenwoordige tijd, 3e persoon enkelvoud', 'Verleden tijd, 3e persoon enkelvoud'],
    };
    for (const it of nl.items) {
      const want = orig[it.surfaceForm];
      assert(want, 'fixture item recognised: ' + it.surfaceForm);
      assert(JSON.stringify(it.formChoices) === JSON.stringify(want.map(c => 'DE ' + c)),
        it.surfaceForm + ': each key landed on the choice it was sent for\n  got:  ' +
        JSON.stringify(it.formChoices) + '\n  want: ' + JSON.stringify(want.map(c => 'DE ' + c)));
    }
    // The second fixture item carries a NON-ZERO formCorrectIndex on purpose — index 0 would let a
    // pass that always re-derives formLabel from choices[0] pass by accident.
    const war = nl.items.find(i => i.surfaceForm === 'war');
    assert(war.formCorrectIndex === 1, 'the "war" item still has its non-zero correct index (got ' + war.formCorrectIndex + ')');
    assert(war.formLabel === 'DE Verleden tijd, 3e persoon enkelvoud',
      'and formLabel was re-derived from THAT index, not from the first choice (got ' + JSON.stringify(war.formLabel) + ')');

    // Everything the pass is NOT scoped to must be untouched — otherwise this would be a silent
    // widening of what v89_d claims to change.
    assert(war.lemmaChoices.every(c => !c.startsWith('DE ')), 'lemmaChoices are untouched (target-language, not labels)');
    assert(!war.explanation.startsWith('DE '), 'explanation is untouched — deliberately out of scope (it quotes target-language forms)');
    assert(!war.translation.startsWith('DE '), 'translation is untouched');
    console.log('  nl source: ' + nl.items.length + ' item(s) normalised, positionally, invariant intact');

    // ── 2. An English source language: the pass never runs at all ──────────────────────────────
    await addInflections(sport, 't_en');
    const en = (env.readStore().topics.find(t => t.id === 't_en').lessons || []).find(l => l.type === 'inflections');
    assert(en && (en.items || []).length === 2, 'an inflections lesson was appended to t_en');
    assert(en.items.every(it => it.formChoices.every(c => !c.startsWith('DE '))),
      'an English-source lesson keeps the model\'s own labels verbatim: ' + JSON.stringify(en.items.map(i => i.formChoices)));

    // Not just "the output looks unchanged" — the CALL must not have been made, which is the whole
    // point of the gate (an already-correct English label is never handed to a model that could
    // reword it, and the run costs nothing extra).
    const kinds = env.readChatLog().map(c => c.kind);
    const nNorm = kinds.filter(k => k === 'inflection_labels').length;
    assert(nNorm === 1,
      'exactly ONE normalisation call was made across both topics — the non-English one\n  kinds: ' + JSON.stringify(kinds));
    const nInfl = kinds.filter(k => k === 'inflections').length;
    assert(nInfl === 2, 'both topics did generate an inflections lesson (so §2 is a real skip, not a failed generation): ' + nInfl);
    console.log('  en source: pass skipped entirely — 1 normalisation call for 2 inflections lessons');

    // ── 3. One call per LESSON, not per item or per label ──────────────────────────────────────
    const call = env.readChatLog().find(c => c.kind === 'inflection_labels');
    const sent = JSON.parse(call.usr);
    assert(Object.keys(sent).length === 5,
      'all five labels of the lesson went in ONE request (3 + 2), not one request each: ' + JSON.stringify(Object.keys(sent)));
    console.log('  batching: ' + Object.keys(sent).length + ' labels in a single request');

    console.log('e2e-inflection-label-lang: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-inflection-label-lang FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
