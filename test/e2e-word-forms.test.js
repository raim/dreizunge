// E2E: the word_forms lesson type generates and stores a valid lesson. Seeds a
// topic whose story matches the fake-Ollama's word_forms items, runs add-lesson,
// and asserts the stored lesson shape passes the spec's required fields.
const { boot, post, get, assert, sleep } = require('./lib');

const STORY = 'Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_wf', topic: 'Test Topic', userTopic: 'Test Topic',
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
    const start = await post(sport, '/api/lessons/add-lesson', { id: 't_wf', lessonFormat: 'word_forms', difficulty: 2 });
    assert(start.status === 202, 'add-lesson accepted (got ' + start.status + ' ' + start.raw + ')');

    const fin = await waitJob(sport, start.body.jobId);
    assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');

    const topic = env.readStore().topics.find(t => t.id === 't_wf');
    const wf = (topic.lessons || []).find(l => l.type === 'word_forms');
    assert(wf, 'a word_forms lesson was appended\n  lessons: ' + JSON.stringify((topic.lessons || []).map(l => l.type)));
    assert(Array.isArray(wf.items) && wf.items.length >= 1, 'lesson has items');

    // Required fields per spec for every item.
    for (const it of wf.items) {
      assert(typeof it.sentence === 'string' && /_{3,}/.test(it.sentence), 'item has a ___ sentence');
      assert(typeof it.translation === 'string', 'item has a translation');
      assert(Array.isArray(it.choices) && it.choices.length === 4, 'item has exactly 4 choices');
      assert(new Set(it.choices.map(c => c.toLowerCase())).size === 4, 'choices are distinct');
      assert(Number.isInteger(it.correctIndex) && it.correctIndex >= 0 && it.correctIndex < 4, 'correctIndex valid');
      assert(typeof it.explanation === 'string' && it.explanation.length > 0, 'item has a non-empty explanation');
    }
    console.log('  word_forms lesson: ' + wf.items.length + ' valid item(s)');
    console.log('  first sentence:', JSON.stringify(wf.items[0].sentence));
    // E0: generation metadata is persisted on the lesson.
    assert(wf._genMeta && typeof wf._genMeta === 'object', 'lesson has _genMeta');
    assert(typeof wf._genMeta.model === 'string' && wf._genMeta.model, '_genMeta.model set');
    assert(wf._genMeta.valid === wf.items.length, '_genMeta.valid matches item count');
    assert(Number.isInteger(wf._genMeta.attempts) && wf._genMeta.attempts >= 1, '_genMeta.attempts set');
    assert(wf._genMeta.rejectReasons && typeof wf._genMeta.rejectReasons === 'object', '_genMeta.rejectReasons present');
    assert(typeof wf._genMeta.at === 'string', '_genMeta.at timestamp set');
    assert(Number.isInteger(wf._genMeta.ms), '_genMeta.ms set');
    console.log('  _genMeta:', JSON.stringify(wf._genMeta));
    console.log('e2e-word-forms: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-word-forms FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
