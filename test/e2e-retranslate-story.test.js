// E2E (live server): POST /api/retranslate-story (v86_w, user-requested).
//
// User's own words: "We need a button to retranslate a story after we found and manually fixed
// errors in the original story, e.g. and especially an extracted text." A manual `/api/save-story`
// fix does NOT re-translate on its own (deliberately, per that route's own cost/latency reasoning —
// see server.js's comment on this route) — `storyTranslation` can silently keep describing the
// PRE-fix text until this route is explicitly called.
const { boot, post, assert } = require('./lib');

(async () => {
  const env = await boot({ seed: {
    schemaVersion: 29,
    topics: [
      { id: 'tp_fixed', topic: 'Fixed Sign', lang: 'nl', srcLang: 'en', difficulty: 1,
        story: 'U Rijdt Nu 500 Meter\n\nOnteigeningszone\n\nDit Raakt Ons Allemaal.',
        storyTranslation: 'STALE: the pre-fix run-on translation.',
        lessons: [] },
      { id: 'tp_nostory', topic: 'No Story Yet', lang: 'nl', srcLang: 'en', difficulty: 1,
        lessons: [] },
    ],
    storylines: [], flags: {}, progress: {},
  } });
  let failed = false;
  try {
    const { sport } = env;

    // 1) A real re-translation call: replaces storyTranslation, stamps fresh translationMeta,
    //    persists to disk, and books tokens onto the topic's own generationStats.
    const r1 = await post(sport, '/api/retranslate-story', { topic: 'Fixed Sign' });
    assert(r1.status === 200, 'retranslate succeeds (got ' + r1.status + ' ' + JSON.stringify(r1.body) + ')');
    assert(r1.body.storyTranslation === 'Once upon a time there was a test. The cat and the house stayed the same.',
      'returns the fresh translation from the (fake) translation model, not the stale one: ' + JSON.stringify(r1.body));
    const saved = env.readStore().topics.find(t => t.id === 'tp_fixed');
    assert(saved.storyTranslation === r1.body.storyTranslation, 'the fresh translation is PERSISTED onto the topic, not just returned');
    assert(saved.translationMeta && saved.translationMeta.origin === 'generated', 'translationMeta is stamped fresh');
    assert(saved.translationMeta.source === 're-translated after a manual story edit', 'translationMeta names the REAL reason, distinguishing this from an at-generation translation');
    console.log('  a real re-translation replaces the stale translation and stamps fresh meta, persisted to disk: OK');

    // 2) A topic with NO story at all: a clean 400, not a crash or a translation of the empty string.
    const r2 = await post(sport, '/api/retranslate-story', { topic: 'No Story Yet' });
    assert(r2.status === 400, 'a topic with no story yet is rejected cleanly (got ' + r2.status + ')');
    console.log('  a topic with no story yet is rejected with a clean 400, not a crash: OK');

    // 3) An unknown topic: 404, not a crash.
    const r3 = await post(sport, '/api/retranslate-story', { topic: 'Does Not Exist' });
    assert(r3.status === 404, 'an unknown topic 404s (got ' + r3.status + ')');
    console.log('  an unknown topic 404s cleanly: OK');

    // 4) Missing BOTH `topic` and `topicId` in the body: 400, not a crash.
    const r4 = await post(sport, '/api/retranslate-story', {});
    assert(r4.status === 400, 'a missing topic/topicId 400s (got ' + r4.status + ')');
    console.log('  a body with neither topic nor topicId 400s cleanly: OK');

    // 5) v86_y: the storyline "read full story" page's own batch caller resolves by ID, not name —
    //    no name lookup, no ambiguity from a title collision. A second topic proves the SAME route
    //    handles both keys, not just whichever one happens to be tested first.
    const r5 = await post(sport, '/api/retranslate-story', { topicId: 'tp_fixed' });
    assert(r5.status === 200, 'retranslate by topicId succeeds (got ' + r5.status + ' ' + JSON.stringify(r5.body) + ')');
    assert(r5.body.storyTranslation === 'Once upon a time there was a test. The cat and the house stayed the same.',
      'topicId path returns the same fresh translation as the topic-name path');
    const r6 = await post(sport, '/api/retranslate-story', { topicId: 'tp_does_not_exist' });
    assert(r6.status === 404, 'an unknown topicId 404s cleanly (got ' + r6.status + ')');
    console.log('  the SAME route also resolves by topicId (the storyline page\'s own batch caller), and an unknown id 404s cleanly: OK');

    console.log('e2e-retranslate-story: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
})();
