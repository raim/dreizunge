// E2E (live server + instrumented fake Ollama): a generated multi-chapter book
// must NOT truncate the user's topic. Regression for the 80-char slice in the
// /api/generate-book handler. Chapter 1 should store the FULL topic in
// userTopic/userPrompt, and the model's chapter-1 story prompt should contain
// the full topic (incl. text past char 80).
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot({ log: true });
  let failed = false;
  try {
    const { sport } = env;
    // > 80 chars, with a distinctive marker well past position 80.
    const LONG = 'Eliza versteht den Kohlenstoffkreislauf der Erde und moechte ihn im Labor '
      + 'nachstellen, um den Kindern Photosynthese zu zeigen — MARKER_PAST_EIGHTY';
    assert(LONG.length > 90, 'test topic is long enough');
    const marker = 'MARKER_PAST_EIGHTY';
    assert(LONG.indexOf(marker) > 80, 'marker is past char 80 (would be cut by old slice)');

    const start = await post(sport, '/api/generate-book', {
      generated: true, topic: LONG, nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 120 });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');

    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
    assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ')');

    const topics = env.readStore().topics || [];
    const root = topics.find(t => !t.continuedFromId);
    assert(root, 'root chapter exists');

    // Stored fields carry the FULL topic, untruncated.
    assert(root.userTopic === LONG, 'chapter 1 userTopic is the FULL topic\n  got: ' + JSON.stringify(root.userTopic));
    assert(root.userPrompt === LONG, 'chapter 1 userPrompt is the FULL topic\n  got: ' + JSON.stringify(root.userPrompt));

    // Placeholder/display title is short (shortened label, then post-pass title).
    assert((root.topic || '').length <= 60, 'display topic is short, not the full prompt (got len ' + (root.topic||'').length + ')');

    // The model received the full topic in chapter 1's story prompt.
    const storyCalls = env.readChatLog().filter(l => l.kind === 'story');
    assert(storyCalls.length >= 1, 'at least one story call');
    assert(storyCalls[0].usr.includes(LONG), 'chapter 1 story prompt contains the FULL topic');
    assert(storyCalls[0].usr.includes(marker), 'chapter 1 story prompt includes text PAST char 80 (no truncation)');

    console.log('  full topic len:', LONG.length, '| stored + sent to model intact');
    console.log('e2e-booktopic: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-booktopic FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
