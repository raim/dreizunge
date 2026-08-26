// E2E: PLAN §2.4 Track A4 milestone 3, REDESIGNED at v85_p — ONE CHAPTER PER PANEL, not one chapter
// per page. Reversed after a real user report: the original "whole page = one chunk = one chapter"
// scoping decision (still true for milestone 3 as originally shipped, v85_m) did not match what the
// user actually wanted once they tried it for real. Each panel is now its own `chunks` entry;
// _runBookJob's EXISTING chaining (already used for a multi-chunk PDF split) links them into one
// storyline automatically — no new server-side chaining logic, confirmed before relying on it.
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;
    // .trim() matches generate()'s own `story = userStory.trim()` — the fixture's .repeat() leaves a
    // trailing space the STORED story does not carry.
    const PANEL_TEXT = (n) => `Panel ${n} caption text, unique per panel. `.repeat(4).trim();
    const panelChunk = (n, x1) => ({
      title: `Panel ${n}`, text: PANEL_TEXT(n), wordCount: 20,
      comicPanels: [{ x1, y1: 0, x2: x1 + 100, y2: 150, caption: PANEL_TEXT(n), inScene: '',
                      image: `data:image/jpeg;base64,PANEL${n}` }],
    });

    // ── 1. Three panels -> three CHAINED chapters, each with its OWN comicPanels ──
    const start = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
      chunks: [panelChunk(1, 0), panelChunk(2, 100), panelChunk(3, 200)],
    });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');
    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 120000 });
    assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ', err=' + (final && final.error) + ')');
    assert(final.chapters.length === 3, 'exactly 3 chapters — one per panel, not one for the whole page (got ' + final.chapters.length + ')');
    const topicIds = final.chapters.map(c => c.topicId);
    assert(topicIds.every(Boolean), 'every panel got its own persisted topic id');
    assert(new Set(topicIds).size === 3, 'three DISTINCT topic ids, not the same chapter reused');

    const store = env.readStore();
    const topics = topicIds.map(id => store.topics.find(t => t.id === id));
    topics.forEach((topic, i) => {
      assert(topic, `chapter ${i + 1}'s topic exists in the store`);
      assert(topic.story === PANEL_TEXT(i + 1), `chapter ${i + 1}'s story is THAT panel's own text, verbatim (got ${JSON.stringify(topic.story).slice(0, 60)})`);
      assert(Array.isArray(topic.comicPanels) && topic.comicPanels.length === 1, `chapter ${i + 1} carries exactly its OWN one panel's comicPanels, not all three's`);
      assert(topic.comicPanels[0].caption === PANEL_TEXT(i + 1), `chapter ${i + 1}'s comicPanels caption matches THAT panel, not a mixed-up one`);
    });
    console.log('  3 panels -> 3 chained chapters, each with its OWN story text and comicPanels (not mixed up): OK');

    // Chained into one storyline — the SAME chaining PDF's own multi-chunk splitting already uses.
    const sls = store.storylines || [];
    const sl = sls.find(s => topicIds.every(id => (s.chapters || []).includes(id)));
    assert(sl, 'all 3 panel-chapters landed in ONE chained storyline, not three separate ones');
    console.log('  the 3 panel-chapters are chained into ONE storyline: OK');

    // ── 2. A panel with NO extracted text contributes NO chapter (filtered client-side, but the
    //      server-side contract this test proves is: a chunks array can legitimately have fewer
    //      entries than panels were drawn — nothing here requires all panels to produce a chapter) ──
    const start2 = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
      chunks: [panelChunk(1, 0)],   // only 1 of (hypothetically) several drawn panels had real text
    });
    const final2 = await waitBookJob(sport, start2.body.bookId, { timeoutMs: 90000 });
    assert(final2 && final2.status === 'done', 'a single-panel chunks array still works (chapter formation does not require a minimum panel count)');
    assert(final2.chapters.length === 1, 'exactly 1 chapter for 1 chunk');
    console.log('  a shorter chunks array (some panels had no text) still forms a valid, smaller storyline: OK');

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
