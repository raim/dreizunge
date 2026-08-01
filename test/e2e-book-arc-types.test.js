// E2E (live server + fake Ollama): the book arc honours the TICKED lesson types.
//
// v71_u closed a split: the book/PDF forms offered a two-option arc <select> ('vocab' → one review
// lesson, 'grammar' → word_forms + synonyms) while the storyline add-lessons run had had the full
// tick-list since v71_p. Same operation, two UIs, two code paths — so a type added to one silently
// did not exist in the other. `comprehension`, added in v71_l, was never reachable from a book.
//
// This file exists because of a gap found by revert-verification: with the client sending
// `arcTypes` and the server rewired to consume it, making the server IGNORE the list entirely
// (falling back to the legacy default) failed NOTHING in the whole suite. Every source-level
// assertion still passed, because each half was individually correct — nothing checked that the
// list actually reaches the generator. That is exactly how a wiring change looks finished while
// doing nothing, so the assertion belongs at the only level that can see it: a real run.
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot({ log: true });
  let failed = false;
  try {
    const { sport } = env;

    // Ticked: word_forms + synonyms + comprehension. Deliberately NOT 'review' — the legacy
    // default — so a server that ignored arcTypes would produce visibly different lessons.
    const arcTypes = ['word_forms', 'synonyms', 'comprehension'];
    const start = await post(sport, '/api/generate-book', {
      generated: true, topic: 'Numbers', nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 120, arc: true, arcTypes });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');

    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
    assert(final && final.status === 'done',
      'book job done (status=' + (final && final.status) + ' err=' + (final && final.error) + ')');

    const topics = env.readStore().topics || [];
    const root = topics.find(t => !t.continuedFromId);
    assert(root, 'a root chapter exists');
    const ch2 = topics.find(t => t.continuedFromId === root.id);
    assert(ch2, 'a second chapter exists');

    // Chapter 1 is the vocab gate only — the arc starts from chapter 2 (unchanged by v71_u).
    assert((root.lessons || []).length === 1,
      'chapter 1 is still the gate lesson only (got ' + (root.lessons || []).length + ')');

    const types = (ch2.lessons || []).map(l => l && (l.type || 'standard'));
    console.log('  chapter 2 lesson types:', JSON.stringify(types));

    // THE ASSERTION THE SUITE WAS MISSING: every ticked type was actually generated.
    for (const want of arcTypes) {
      assert(types.includes(want),
        'ticked type "' + want + '" was generated (got [' + types.join(', ') + '])');
    }
    // comprehension is the one that could not be produced from a book AT ALL before v71_u.
    assert(types.includes('comprehension'),
      'comprehension is reachable from a book arc — it was not, before v71_u');

    // And the legacy default must NOT appear: a review lesson here means the server fell back and
    // ignored the list. This is the half that the source-level tests could not see.
    // NB: a standard/vocab lesson carries NO `type` field — it is the default shape. Matching on
    // `l.type === 'standard'` made this check vacuous in the first draft (it could never be true),
    // which would have let a server that ignored arcTypes slip straight through the very test
    // written to catch it. Normalised here, and in the type list above.
    const reviewish = (ch2.lessons || []).filter(l =>
      l && (l.type || 'standard') === 'standard' && l._arcMode === 'reinforce');
    assert(reviewish.length === 0,
      'no legacy vocab-review lesson was added — the ticked list was honoured, not the default ' +
      '(found ' + reviewish.length + ')');

    // Reinforcement tagging drives the path badge; every arc lesson carries it.
    const arcLessons = (ch2.lessons || []).filter(l => l && arcTypes.includes(l.type));
    assert(arcLessons.length === arcTypes.length, 'one lesson per ticked type');
    assert(arcLessons.every(l => l._arcMode === 'reinforce'),
      'every arc lesson is tagged as reinforcement');
    console.log('  arc types honoured end-to-end: OK');

    // ── Back-compat: a legacy client sending arcMode still works ────────────
    // A cached page or a static build may still send the old shape. It must map to what it always
    // meant — 'vocab' = one review lesson — not to an empty arc.
    // No store reset in the harness, so the legacy run's chapters are identified by exclusion:
    // anything not present after the first run.
    const seenIds = new Set((env.readStore().topics || []).map(t => t.id));
    const legacy = await post(sport, '/api/generate-book', {
      generated: true, topic: 'Colours', nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 120, arc: true, arcMode: 'vocab' });
    assert(legacy.status === 202, 'legacy book accepted (got ' + legacy.status + ')');
    const lf = await waitBookJob(sport, legacy.body.bookId, { timeoutMs: 90000 });
    assert(lf && lf.status === 'done', 'legacy book job done (status=' + (lf && lf.status) + ')');
    const lTopics = (env.readStore().topics || []).filter(t => !seenIds.has(t.id));
    assert(lTopics.length === 2, 'legacy run added 2 new chapters (got ' + lTopics.length + ')');
    const lRoot = lTopics.find(t => !lTopics.some(o => o.id === t.continuedFromId));
    const lCh2 = lTopics.find(t => t.continuedFromId === (lRoot && lRoot.id));
    assert(lCh2, 'legacy run produced a second chapter');
    const lReview = (lCh2.lessons || []).filter(l => l && l._arcMode === 'reinforce');
    assert(lReview.length === 1,
      "legacy arcMode:'vocab' still means exactly one review lesson (got " + lReview.length + ')');
    assert((lReview[0].type || 'standard') === 'standard',
      'and it is the vocab-review lesson it always was (got ' + (lReview[0].type || 'standard') + ')');
    console.log('  legacy arcMode back-compat: OK');

    console.log('e2e-book-arc-types: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-book-arc-types FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
