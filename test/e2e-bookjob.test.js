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

    // ── v79_b: `useFullChain` passes the FULL STORYLINE to the story prompt, and sizes num_ctx ──
    //
    // Before this release the flag chose between the parent chapter whole and its last 800 chars,
    // so a continuation was written from ONE chapter of context however the box was set. The claim
    // is about identity — which chapters reached the prompt — so it is asserted by identity: every
    // fake story carries a unique `STORYTEXT[<ms>]` marker, and chapter 3's prompt must contain
    // chapter 1's marker as well as chapter 2's. `/Previous story/` above cannot see the
    // difference; it passed for both behaviours.
    //
    // Both branches are exercised by one job. Chapter 2's parent is the root, so its chain is ONE
    // chapter and it keeps the pre-v79_b shape exactly — no header, no num_ctx reserved (the KV
    // cache grows with the window, so asking for one that is not needed is not free). Chapter 3's
    // chain is two chapters and must carry both.
    {
      const marker = s => (String(s || '').match(/STORYTEXT\[\d+\]/) || [null])[0];
      const m1 = marker(chain[0].story), m2 = marker(chain[1].story);
      assert(m1 && m2 && m1 !== m2, 'non-vacuity: chapters 1 and 2 have distinct story markers '
        + '(' + m1 + ' / ' + m2 + ')');

      const c2 = storyCalls[1], c3 = storyCalls[2];
      // Chapter 2 — single-parent branch, unchanged from before v79_b.
      assert(c2.usr.includes(m1), 'chapter 2 prompt carries chapter 1');
      assert(/Previous story \(full\):/.test(c2.usr), 'chapter 2 says the previous chapter is passed in full');
      assert(!c2.opts || c2.opts.num_ctx === null,
        'chapter 2 reserves no num_ctx — one chapter has never approached the default '
        + '(got ' + JSON.stringify(c2.opts) + ')');
      // Chapter 3 — the chain branch. THIS is what the checkbox promised and did not deliver.
      assert(c3.usr.includes(m2), 'chapter 3 prompt carries chapter 2');
      assert(c3.usr.includes(m1), 'chapter 3 prompt carries chapter 1 TOO — the whole storyline, '
        + 'not just the previous chapter (this is the v79_b claim)');
      assert(/Previous story \(the full storyline so far, 2 chapters\):/.test(c3.usr),
        'chapter 3 names the chain and its chapter count');
      assert(c3.opts && Number.isInteger(c3.opts.num_ctx) && c3.opts.num_ctx >= 4096,
        'chapter 3 sizes num_ctx for the longer prompt — without it Ollama truncates silently '
        + 'and every generation still "succeeds" (got ' + JSON.stringify(c3.opts) + ')');
      // The per-role reasoning toggle is OFF by default, and that is now observed at the backend
      // rather than pinned to a source line (both source pins broke on a line move this release).
      assert(c3.opts.think === false, 'story generation still sends think:false by default');
      console.log('  v79_b full-chain story context: ch2 1 chapter/no num_ctx, '
        + 'ch3 2 chapters/num_ctx=' + c3.opts.num_ctx + ': OK');
    }

    // Post-pass generated a source-language storyline summary (TODO item 6).
    const slArr = env.readStore().storylines || [];
    const sl = slArr.find(s => (s.chapters || []).some(cid => chain.some(c => c.id === cid)));
    assert(sl, 'a storyline exists for the generated chain');
    assert(sl.summary && /FAKE SUMMARY/.test(sl.summary), 'storyline has a generated summary (got: ' + JSON.stringify(sl.summary) + ')');
    console.log('  storyline summary post-pass: OK');

    // v77_w (user): book generation no longer runs an automatic QC pass. Story QC was already
    // excluded (an LLM pass per chapter, unprompted, on an already-long job) and the user made the
    // same call for lesson QC: it is the slowest part of the job, and QC loses nothing by being
    // deferred — it is a review step, and everything it would flag is still there afterwards.
    //
    // The claim here is now the ABSENCE of the pass. It is worth asserting rather than deleting:
    // an automatic QC pass creeping back in is exactly the kind of change that would be noticed
    // only as "generation got slow again", which is what prompted this.
    const allItems = chain.flatMap(c => (c.lessons || []).flatMap(ls =>
      [...(ls.vocab || []), ...(ls.sentences || [])]));
    assert(allItems.length > 0, 'the generated chain has items to QC (non-vacuity)');
    const flagged = allItems.filter(it => it && it.qc);
    assert(flagged.length === 0,
      'generation runs NO automatic QC pass (got ' + flagged.length + ' tagged of ' + allItems.length + ')');
    console.log('  no auto-QC during generation: OK (0/' + allItems.length + ' items tagged)');

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
