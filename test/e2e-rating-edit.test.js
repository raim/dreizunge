// E2E for the v46 rating system (Tier 1) + the words/items round-trip fix.
// item.userRating ("good example") must persist through /api/lessons/edit exactly
// like userFlag, and must be client-authoritative (clearing it client-side must not
// be resurrected from the stored copy). Critically this must work for synonyms
// (words[]) and word_forms (items[]) too — previously the merge didn't copy those
// arrays for an existing lesson, so a flag/rating on those types was lost on a live
// save. Seeds all three lesson shapes and checks set / persist / clear.
const { boot, post, assert } = require('./lib');

const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_rate', topic: 'Rate Topic', userTopic: 'Rate Topic', lang: 'de', srcLang: 'en',
    difficulty: 2, story: 'Es war einmal ein Test.',
    lessons: [
      { id: 'ls_std', type: 'standard', title: 'V',
        vocab: [{ target: 'Haus', source: 'house' }, { target: 'Katze', source: 'cat' }],
        sentences: [{ target: 'Das Haus ist groß.', source: 'The house is big.' }] },
      { id: 'ls_wf', type: 'word_forms', title: 'WF',
        items: [{ sentence: 'Es war einmal ein ___.', answer: 'Haus', choices: ['Haus','Hauses'] }] },
      { id: 'ls_syn', type: 'synonyms', title: 'SYN',
        words: [{ base: 'Haus', gloss: 'house', synonyms: [{ w: 'Gebäude', g: 'building' }] }] },
    ],
    generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  storylines: [], flags: {}, progress: {},
};

// Deep-ish clone so each POST sends fresh objects (the client re-serializes its state).
const clone = o => JSON.parse(JSON.stringify(o));

(async () => {
  const env = await boot({ seed: SEED });
  let failed = false;
  try {
    const { sport } = env;
    const lessons0 = clone(SEED.topics[0].lessons);

    // 1) Rate one item in each of the three lesson types; flag the word_forms item.
    const l1 = clone(lessons0);
    l1[0].vocab[0].userRating = { at: '2026-06-23T12:00:00.000Z' };           // vocab
    l1[1].items[0].userRating = { at: '2026-06-23T12:00:01.000Z' };           // word_forms
    l1[1].items[0].userFlag   = { comment: 'odd', correct: '', at: '2026-06-23T12:00:02.000Z' };
    l1[2].words[0].userRating = { at: '2026-06-23T12:00:03.000Z' };           // synonyms

    let r = await post(sport, '/api/lessons/edit', { id: 't_rate', lessons: l1 });
    assert(r.status === 200, 'edit accepted (got ' + r.status + ' ' + r.raw + ')');

    let t = env.readStore().topics.find(x => x.id === 't_rate');
    const std = t.lessons.find(l => l.id === 'ls_std');
    const wf  = t.lessons.find(l => l.id === 'ls_wf');
    const syn = t.lessons.find(l => l.id === 'ls_syn');
    assert(std.vocab[0].userRating && std.vocab[0].userRating.at === '2026-06-23T12:00:00.000Z', 'vocab rating persisted');
    assert(!std.vocab[1].userRating, 'unrated vocab item stays unrated');
    assert(wf.items[0].userRating && wf.items[0].userRating.at === '2026-06-23T12:00:01.000Z', 'word_forms rating persisted (items[] round-trips)');
    assert(wf.items[0].userFlag && wf.items[0].userFlag.comment === 'odd', 'word_forms flag persisted (items[] round-trips)');
    assert(syn.words[0].userRating && syn.words[0].userRating.at === '2026-06-23T12:00:03.000Z', 'synonyms rating persisted (words[] round-trips)');
    // content untouched
    assert(std.vocab[0].target === 'Haus' && wf.items[0].answer === 'Haus' && syn.words[0].base === 'Haus', 'content intact');

    // 2) Clear the vocab rating + the word_forms flag client-side (omit them); they must
    //    NOT be resurrected from the stored copy (client-authoritative).
    const l2 = clone(t.lessons);
    delete l2[0].vocab[0].userRating;
    delete l2[1].items[0].userFlag;
    // keep wf rating + syn rating
    r = await post(sport, '/api/lessons/edit', { id: 't_rate', lessons: l2 });
    assert(r.status === 200, 'second edit accepted');

    t = env.readStore().topics.find(x => x.id === 't_rate');
    const std2 = t.lessons.find(l => l.id === 'ls_std');
    const wf2  = t.lessons.find(l => l.id === 'ls_wf');
    const syn2 = t.lessons.find(l => l.id === 'ls_syn');
    assert(!std2.vocab[0].userRating, 'cleared vocab rating stays cleared (not resurrected)');
    assert(!wf2.items[0].userFlag, 'cleared word_forms flag stays cleared (not resurrected)');
    assert(wf2.items[0].userRating, 'word_forms rating still present after partial clear');
    assert(syn2.words[0].userRating, 'synonyms rating still present');

    console.log('e2e-rating-edit: ALL PASSED (rating + flag round-trip for vocab/word_forms/synonyms; client-authoritative clear)');
  } catch (e) { failed = true; console.error('FAIL:', e.message); }
  finally { env.stop(); }
  process.exit(failed ? 1 : 0);
})();
