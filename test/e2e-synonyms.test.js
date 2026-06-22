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
  const env = await boot({ seed: SEED });
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
