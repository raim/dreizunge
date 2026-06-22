// E2E: POST /api/storyline/recreate-lessons hides the existing lessons (kept) and
// appends freshly generated arc lessons per chapter (gate + reinforcement from ch.2).
const { boot, post, get, assert, sleep } = require('./lib');

const STORY = 'Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
const now = new Date().toISOString();
const chapter = (id, topic, extra) => ({
  id, topic, userTopic: topic, lang: 'de', srcLang: 'en', difficulty: 2,
  story: STORY, generatedAt: now, updatedAt: now,
  lessons: [{ id: 'orig_' + id, type: 'standard', vocab: [{ target: 'Haus', source: 'house' }], sentences: [] }],
  ...extra,
});
const SEED = {
  schemaVersion: 29,
  topics: [
    chapter('c1', 'Chapter One', {}),
    chapter('c2', 'Chapter Two', { continuedFromId: 'c1', continuedFrom: 'Chapter One' }),
  ],
  storylines: [{ id: 'sl1', title: 'My Story', icon: '📖', chapters: ['c1', 'c2'] }],
  flags: {}, progress: {},
};

async function waitJob(sport, jobId, timeoutMs = 90000) {
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
    const start = await post(sport, '/api/storyline/recreate-lessons', { id: 'c1', arcMode: 'vocab' });
    assert(start.status === 202, 'recreate accepted (got ' + start.status + ' ' + start.raw + ')');
    const fin = await waitJob(sport, start.body.jobId);
    assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');

    const store = env.readStore();
    const c1 = store.topics.find(t => t.id === 'c1');
    const c2 = store.topics.find(t => t.id === 'c2');

    // Original lessons kept but hidden.
    const orig1 = c1.lessons.find(l => l.id === 'orig_c1');
    const orig2 = c2.lessons.find(l => l.id === 'orig_c2');
    assert(orig1 && orig1._hidden === true, 'chapter 1 original lesson kept + hidden');
    assert(orig2 && orig2._hidden === true, 'chapter 2 original lesson kept + hidden');

    // New (re-created) lessons appended and visible.
    const new1 = c1.lessons.filter(l => l._recreated && !l._hidden);
    const new2 = c2.lessons.filter(l => l._recreated && !l._hidden);
    assert(new1.length >= 1, 'chapter 1 got >=1 new lesson (gate)');
    assert(new2.length >= 2, 'chapter 2 got gate + reinforcement (got ' + new2.length + ')');
    assert(new2.some(l => l._arcMode === 'reinforce'), 'chapter 2 has a reinforcement lesson');

    console.log('  c1 lessons:', c1.lessons.map(l => (l._hidden ? 'hidden:' : 'new:') + l.type).join(', '));
    console.log('  c2 lessons:', c2.lessons.map(l => (l._hidden ? 'hidden:' : (l._arcMode || 'new') + ':') + l.type).join(', '));
    console.log('  job result:', JSON.stringify(fin.data || fin.result || {}));
    console.log('e2e-recreate: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-recreate FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
