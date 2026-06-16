// E2E (live server + instrumented fake Ollama): the two _runBookJob changes.
//  (1) generated chapters after the first continue the same story (continuation
//      directive + full prior-story context), instead of re-injecting the base topic.
//  (2) chapter 1 = 1 lesson; chapters 2+ = 2 lessons (standard + whole-storyline review).
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot({ log: true });
  let failed = false;
  try {
    const { sport } = env;

    const start = await post(sport, '/api/generate-book', {
      generated: true, topic: 'Numbers', nChapters: 3, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 120, arc: true, arcMode: 'vocab', arcReinforce: ['grammar', 'conjugation'] });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');

    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
    assert(final, 'book job produced a status');
    assert(final.status === 'done', 'book job done (status=' + final.status + ' err=' + (final.error) + ')');

    // Order the three saved chapters along the continuedFromId chain.
    const topics = env.readStore().topics || [];
    assert(topics.length === 3, 'exactly 3 chapters saved (got ' + topics.length + ')');
    const root = topics.find(t => !t.continuedFromId);
    assert(root, 'a root chapter exists');
    const chain = [root]; let cur = root;
    for (let k = 0; k < 5; k++) { const nx = topics.find(t => t.continuedFromId === cur.id); if (!nx) break; chain.push(nx); cur = nx; }
    assert(chain.length === 3, 'single 3-long chain (got ' + chain.length + ')');

    // (2) lesson counts + tagging.
    const counts = chain.map(c => (c.lessons || []).length);
    console.log('  lesson counts per chapter:', counts);
    assert(counts[0] === 1, 'chapter 1 has exactly 1 lesson (got ' + counts[0] + ')');
    assert(counts[1] === 2, 'chapter 2 has exactly 2 lessons (got ' + counts[1] + ')');
    assert(counts[2] === 2, 'chapter 3 has exactly 2 lessons (got ' + counts[2] + ')');
    assert(!(chain[0].lessons || []).some(l => l._arcMode === 'reinforce'), 'chapter 1 has NO reinforce lesson');
    assert((chain[1].lessons || []).some(l => l._arcMode === 'reinforce'), 'chapter 2 has a reinforce lesson');
    assert(!(chain[1].lessons || []).some(l => l._arcMode === 'extend'), 'no separate extend lesson remains');
    console.log('  change 2 (arc lesson structure): OK');

    // (1) continuation prompts.
    const storyCalls = env.readChatLog().filter(l => l.kind === 'story');
    assert(storyCalls.length >= 3, 'at least 3 story calls (got ' + storyCalls.length + ')');
    assert(/New topic: "Numbers"|topic: "Numbers"/.test(storyCalls[0].usr), 'chapter 1 story uses base topic "Numbers"');
    for (const idx of [1, 2]) {
      const c = storyCalls[idx];
      assert(/Continue the previous chapter's story directly/.test(c.usr), 'chapter ' + (idx + 1) + ' uses the continuation directive');
      assert(!/topic: "Numbers"/.test(c.usr), 'chapter ' + (idx + 1) + ' does NOT re-inject base topic');
      assert(/Previous story/.test(c.usr), 'chapter ' + (idx + 1) + ' includes the previous story');
      assert(/STORYTEXT\[/.test(c.usr), 'chapter ' + (idx + 1) + ' prior-story context present');
    }
    console.log('  change 1 (generated continuation): OK');

    console.log('e2e-bookjob: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-bookjob FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
