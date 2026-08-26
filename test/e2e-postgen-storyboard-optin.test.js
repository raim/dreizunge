// E2E: v85_p — the storyboard post-pass in _runBookJob ran UNCONDITIONALLY for every caller of
// /api/generate-book since v68.1 (PDF/document uploads, comic chapters, and the wizard's own
// multi-chapter "generated" flow), making PLAN §13 milestone 4's own #post-gen-storyboard-cb toggle
// a SILENT NO-OP for book-style generation — found via a real user report after testing the comic
// feature ("we don't want storyboards as a standard generation unless explicitly selected"), then
// confirmed via code read to be pre-existing and universal, not comic-specific. Fixed: the post-pass
// now requires `postGenStoryboard: true` in the request body. This test proves BOTH directions —
// omitting the flag must NOT produce a board (the actual regression that was reported), and setting
// it must still work (so the fix is a real gate, not an accidental permanent disable).
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. Without postGenStoryboard: no board gets created — the actual bug being fixed ──
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [{ title: 'Chapter One', text: 'Ein Test ohne Storyboard. '.repeat(8), wordCount: 30 }],
        // postGenStoryboard deliberately OMITTED — this is the default, no-checkbox-checked case.
      });
      assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
      assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ')');
      const topicId = final.chapters[0].topicId;
      const sls = env.readStore().storylines || [];
      const sl = sls.find(s => (s.chapters || []).includes(topicId));
      assert(sl, 'a storyline was created for the chapter');
      assert(!sl.storyboard, 'NO storyboard was generated when postGenStoryboard was omitted — the actual bug report');
      console.log('  postGenStoryboard omitted: no storyboard generated (the fix): OK');
    }

    // ── 2. With postGenStoryboard:true — the toggle still actually works ──────────
    {
      const start = await post(sport, '/api/generate-book', {
        lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
        chunks: [{ title: 'Chapter Two', text: 'Ein Test mit Storyboard. '.repeat(8), wordCount: 30 }],
        postGenStoryboard: true,
      });
      const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
      assert(final && final.status === 'done', 'book done with postGenStoryboard:true');
      const topicId = final.chapters[0].topicId;
      const sls = env.readStore().storylines || [];
      const sl = sls.find(s => (s.chapters || []).includes(topicId));
      assert(sl, 'a storyline was created');
      assert(sl.storyboard, 'a storyboard WAS generated when postGenStoryboard:true was sent — the toggle is a real gate, not a permanent disable');
      console.log('  postGenStoryboard:true: a storyboard is still generated (the toggle works both ways): OK');
    }

    console.log('e2e-postgen-storyboard-optin: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-postgen-storyboard-optin FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
