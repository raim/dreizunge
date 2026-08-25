// E2E: PLAN §2.4 / Track A4 milestone 3 (v85_m) — a comic-sourced chunk's `comicPanels` field
// survives generate-book's whole pipeline onto the persisted topic, and the chunk's text becomes
// the chapter's story VERBATIM (no model rewrite — confirmed by reading generate()'s own userStory
// handling before building this: `if (userStory) story = userStory.trim();`). This is pure data
// plumbing, not a new model-call shape, so no new fake-ollama routing is needed — the existing
// chunk-based book generation path (already exercised by e2e-bookfile.test.js et al.) covers it.
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;
    const STORY_TEXT = 'So wurde ein großes Schild aufgestellt.\n\nRiesen sind hier nicht willkommen.';
    const COMIC_PANELS = [
      { x1: 0, y1: 0, x2: 100, y2: 150, caption: 'So wurde ein großes Schild aufgestellt.', inScene: '', image: 'data:image/jpeg;base64,AAAA' },
      { x1: 100, y1: 0, x2: 200, y2: 150, caption: '', inScene: 'Riesen sind hier nicht willkommen.', image: 'data:image/jpeg;base64,BBBB' },
    ];

    // ── 1. A comic-sourced chunk's comicPanels survive onto the persisted topic ────
    const start = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
      chunks: [{ title: 'Comic chapter', text: STORY_TEXT, wordCount: STORY_TEXT.split(/\s+/).length,
                 comicPanels: COMIC_PANELS }],
    });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');
    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
    assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ', err=' + (final && final.error) + ')');
    const topicId = final.chapters[0].topicId;
    assert(topicId, 'the chapter has a persisted topic id');

    const store = env.readStore();
    const topic = store.topics.find(t => t.id === topicId);
    assert(topic, 'the persisted topic exists in the store');
    assert(topic.story === STORY_TEXT, 'the chapter\'s story is the chunk text VERBATIM, not model-rewritten\n  got: ' + JSON.stringify(topic.story));
    assert(Array.isArray(topic.comicPanels) && topic.comicPanels.length === 2, 'comicPanels survived onto the persisted topic (got ' + JSON.stringify(topic.comicPanels) + ')');
    assert(topic.comicPanels[0].caption === COMIC_PANELS[0].caption, 'panel 0 caption matches what was sent');
    assert(topic.comicPanels[1].inScene === COMIC_PANELS[1].inScene, 'panel 1 inScene matches what was sent');
    assert(topic.comicPanels[0].image === COMIC_PANELS[0].image, 'panel 0 image (cropped data URL) survived unchanged');
    console.log('  comicPanels survive generate-book\'s pipeline onto the persisted topic, story is verbatim: OK');

    // ── 2. An ORDINARY (non-comic) chunk gets NO comicPanels field — additive, not a default ──
    const start2 = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
      chunks: [{ title: 'Plain chapter', text: 'Ein ganz normaler Text ohne Comic.', wordCount: 6 }],
    });
    const final2 = await waitBookJob(sport, start2.body.bookId, { timeoutMs: 90000 });
    assert(final2 && final2.status === 'done', 'plain book done');
    const plainTopic = env.readStore().topics.find(t => t.id === final2.chapters[0].topicId);
    assert(plainTopic && plainTopic.comicPanels === undefined, 'a chunk with no comicPanels does not get one fabricated on its persisted topic');
    console.log('  an ordinary (non-comic) chunk gets no comicPanels field: OK');

    console.log('e2e-comic-chapter: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-comic-chapter FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
