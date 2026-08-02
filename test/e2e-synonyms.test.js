// E2E: a synonyms lesson attaches a context sentence (from the story) to each word
// group whose base word appears in the story.
const { boot, post, get, assert, sleep } = require('./lib');

const STORY = 'Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_syn', topic: 'Test Topic', userTopic: 'Test Topic',
    lang: 'de', srcLang: 'en', difficulty: 2,
    story: STORY, lessons: [],
    generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
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

(async () => {
  const env = await boot({ seed: SEED, log: true });
  let failed = false;
  try {
    const { sport } = env;
    const start = await post(sport, '/api/lessons/add-lesson', { id: 't_syn', lessonFormat: 'synonyms', difficulty: 2 });
    assert(start.status === 202, 'add-lesson accepted (got ' + start.status + ' ' + start.raw + ')');
    const fin = await waitJob(sport, start.body.jobId);
    assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');

    const topic = env.readStore().topics.find(t => t.id === 't_syn');
    const syn = (topic.lessons || []).find(l => l.type === 'synonyms');
    assert(syn && Array.isArray(syn.words) && syn.words.length, 'synonyms lesson with words');

    // Every base word here appears in the story, so each group gets a context sentence.
    const withSentence = syn.words.filter(w => w.sentence && w.sentence.length > 0);
    assert(withSentence.length >= 1, 'at least one word group has a context sentence\n  ' +
      JSON.stringify(syn.words.map(w => ({ base: w.base, sentence: w.sentence }))));
    for (const w of withSentence) {
      assert(w.sentence.toLowerCase().includes(w.base.toLowerCase()), 'sentence contains its base word');
    }
    // Schema preserved.
    assert(syn.words.every(w => Array.isArray(w.synonyms)), 'words keep synonyms arrays');

    // v72_d: the model now quotes its own context sentence, and the server verifies the quote.
    // The fake returns one real quote and one invented sentence, so both branches are covered.
    const byBase = Object.fromEntries(syn.words.map(w => [w.base, w.sentence]));
    assert(byBase.Haus === 'Die Katze und das Haus blieben gleich.',
      'a verbatim quote from the story is KEPT as the context sentence (got ' + JSON.stringify(byBase.Haus) + ')');
    assert(byBase.Katze && !/sehr klein/.test(byBase.Katze),
      'an invented sentence is REJECTED and replaced by the server search (got ' +
      JSON.stringify(byBase.Katze) + ') — otherwise the learner is shown text that is not in the story');
    assert(STORY.includes(byBase.Katze),
      'and whatever replaces it really is from the story');
    assert(/Synonyms context: 2 sentence\(s\) quoted from the story, 1 rejected as not verbatim/.test(env.srvlog()),
      'the server reports 2 quotes kept and 1 rejected\n  --- log ---\n' +
      env.srvlog().split('\n').filter(l => /Synonyms/.test(l)).join('\n'));

    // The model must actually RECEIVE the story — it cannot quote what it never saw. Checked
    // against the prompt the fake model was sent, not against the server's own log, because
    // verbatimStorySentence validates using the server's copy of the story either way and would
    // keep passing if the prompt quietly went back to eight extracted keywords.
    // (An earlier draft asserted this with `... || true` — vacuous, and it passed happily.)
    const synReq = env.readChatLog().filter(c => c.kind === 'synonyms');
    assert(synReq.length >= 1, 'the synonyms generation call was logged');
    assert(synReq[0].usr.includes(STORY),
      'the STORY itself is in the synonyms prompt — not just keywords extracted from it\n  usr: ' +
      JSON.stringify(synReq[0].usr).slice(0, 300));
    // The wording of the sentence rule lives in prompts.json and is pinned by
    // unit-prompt-strictness; the fake's log truncates `sys`, so it is not re-checked here.
    console.log('  context sentences: 1 model quote kept, 1 invention rejected and replaced');

    // v72_e: an antonym-only entry survives. Before this the server dropped any word without a
    // synonym, so telling the model "[] is better than a shaky synonym" would have quietly deleted
    // words instead of trimming their lists.
    const gleich = syn.words.find(w => w.base === 'gleich');
    assert(gleich, 'an antonym-only word is KEPT (the server used to drop it for having no synonym)');
    assert(gleich.synonyms.length === 0 && gleich.antonyms.length === 1,
      'and keeps its shape: no synonyms, one antonym');
    assert(/1 antonym-only/.test(env.srvlog()), 'and the generator reports it');
    console.log('  antonym-only entry survives generation');
    console.log('  groups with context sentence:', withSentence.length + '/' + syn.words.length);
    console.log('  e.g.', JSON.stringify(withSentence[0].base), '->', JSON.stringify(withSentence[0].sentence));
    console.log('e2e-synonyms: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-synonyms FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
