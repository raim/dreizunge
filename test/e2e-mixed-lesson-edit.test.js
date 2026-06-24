// E2E for the mixed-lesson round-trip bug: a no-LLM "mixed review" lesson is added via
// /api/lessons/edit (the client _postLessonEdit path). The server must preserve its
// `type` and `perType` — previously the merge cherry-picked content fields and dropped
// `type`, so on reload the lesson became a "Vocabulary" lesson and crashed at play time.
const { boot, post, assert } = require('./lib');

const SEED = {
  schemaVersion: 29,
  topics: [{
    id: 't_mix', topic: 'Mix Topic', userTopic: 'Mix Topic', lang: 'de', srcLang: 'en',
    difficulty: 2, story: 'Es war einmal ein Test.',
    lessons: [{ id: 'ls_a', type: 'standard', title: 'V', vocab: [{ target: 'Haus', source: 'house' }], sentences: [] }],
    generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  storylines: [], flags: {}, progress: {},
};

(async () => {
  const env = await boot({ seed: SEED });
  let failed = false;
  try {
    const { sport } = env;
    const base = { id: 'ls_a', type: 'standard', title: 'V', vocab: [{ target: 'Haus', source: 'house' }], sentences: [] };

    // 1) Append a NEW mixed lesson (mirrors the client creating it + _postLessonEdit).
    let r = await post(sport, '/api/lessons/edit', { id: 't_mix',
      lessons: [base, { id: 'ls_mix', type: 'mixed', title: 'Mixed review', icon: '🔀', perType: 3 }] });
    assert(r.status === 200, 'edit accepted (got ' + r.status + ' ' + r.raw + ')');

    let topic = env.readStore().topics.find(t => t.id === 't_mix');
    let mix = (topic.lessons || []).find(l => l.id === 'ls_mix');
    assert(mix, 'mixed lesson persisted');
    assert(mix.type === 'mixed', 'type preserved on add (got ' + mix.type + ')');
    assert(mix.perType === 3, 'perType preserved on add (got ' + mix.perType + ')');
    const std = (topic.lessons || []).find(l => l.id === 'ls_a');
    assert(std && std.vocab && std.vocab[0].target === 'Haus', 'existing lesson content intact');

    // 2) Edit the mixed lesson's perType — it must persist (and stay type=mixed).
    r = await post(sport, '/api/lessons/edit', { id: 't_mix',
      lessons: [base, { id: 'ls_mix', type: 'mixed', title: 'Mixed review', icon: '🔀', perType: 5 }] });
    assert(r.status === 200, 'second edit accepted');
    topic = env.readStore().topics.find(t => t.id === 't_mix');
    mix = (topic.lessons || []).find(l => l.id === 'ls_mix');
    assert(mix.type === 'mixed' && mix.perType === 5, 'perType update persisted (type=' + mix.type + ', perType=' + mix.perType + ')');

    console.log('e2e-mixed-lesson-edit: ALL PASSED');
  } catch (e) { failed = true; console.error('FAIL:', e.message); }
  finally { env.stop(); }
  process.exit(failed ? 1 : 0);
})();
