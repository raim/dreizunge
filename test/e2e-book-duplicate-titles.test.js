// e2e-book-duplicate-titles.test.js
// v69_q — a book chapter must not overwrite a sibling that shares its title.
//
// Reported: a 4-chapter PDF book produced only 3 topics; the browser showed 2 cards. The source
// PDF had given chapters 3 and 4 the same headline. Two faults compounded:
//   1. generate() saved the story EARLY (crash-resilience) with NO id, so upsert() fell back to its
//      name+lang+srcLang dedup key. Two same-titled chapters in one run merged at that point — the
//      second overwrote the first before either got an id.
//   2. The chain link was recorded by NAME (continuedFrom = parent.topic), so after the merge the
//      survivor's continuedFrom pointed at its own title and the chain collapsed onto itself.
// And, uncovered while fixing: _newTopicId lived nested inside boot() (which encloses most of the
// file), so it was invisible to generate() at module scope — the first module-scope caller threw
// "not defined". The minter is now at module scope.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, post, get, sleep, assert } = require('./lib');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. Structural: the pieces of the fix are present ─────────────────────────
{
  // The early save mints an id before upsert.
  assert(/let _genTopicId = null;/.test(server), 'the early save prepares a stable id');
  assert(/if \(!data\.id\) data\.id = _newTopicId\(\);/.test(server), '_persistGenerated assigns an id before upsert');
  // Identity/regeneration reuse requires SAME parent too, so siblings never merge.
  assert(/\(\(l\.continuedFromId\|\|null\) === \(continuedFromId\|\|null\)\)/.test(server),
    'in-place reuse of an id requires the same chain parent, not just the same title');
  // The parent link is threaded by id.
  assert(/_persistGenerated\(data, contFrom, parent \? parent\.id : null\)/.test(server),
    'the book loop passes the parent id, not only its name');
  assert(/if \(parentId\) data\.continuedFromId = parentId;/.test(server), 'the parent link is recorded by id');
  // The id minter is at module scope (outside boot), or generate() cannot see it.
  const bootAt = server.indexOf('async function boot()');
  const minterAt = server.indexOf('function _newTopicId()');
  assert(minterAt >= 0 && minterAt < bootAt, '_newTopicId is defined at module scope, before boot()');
}
console.log('  structural: id minted pre-upsert, parent linked by id, minter at module scope: OK');

// ── 2. Behavioural: two chapters sharing a title yield two distinct topics ────
(async () => {
  const env = await boot({ log: false });
  let failed = false;
  try {
    // Chapters 2 and 3 share an identical title — the reported trigger.
    const r = await post(env.sport, '/api/generate-book', {
      chunks: [
        { title: 'Cronaca A', text: 'Prima cronaca del maltempo nel nord Italia oggi pomeriggio.', wordCount: 9 },
        { title: 'Maxi-grandine A13', text: 'Seconda cronaca con grandine e danni ingenti ovunque adesso.', wordCount: 9 },
        { title: 'Maxi-grandine A13', text: 'Terza cronaca diversa ma con lo stesso titolo esatto del capitolo.', wordCount: 11 },
      ],
      lang: 'de', srcLang: 'it', difficulty: 1, sourceFile: 'grandine.pdf',
    });
    assert(r.status === 202, `book accepted (got ${r.status})`);
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      const j = await get(env.sport, '/api/book-job/' + r.body.bookId);
      if (j.body && (j.body.status === 'done' || j.body.status === 'error')) {
        assert(j.body.status === 'done', `book completed (got ${j.body.status}: ${j.body.error || ''})`);
        break;
      }
    }
    const st = env.readStore();
    // The core assertion: three chapters in → three topics, none overwritten.
    assert(st.topics.length === 3, `three distinct topics exist (got ${st.topics.length})`);
    assert(new Set(st.topics.map(t => t.id)).size === 3, 'all three ids are unique');
    assert(st.topics.every(t => t.id), 'every topic has an id');

    // ⚠️ RE-SCOPED at v89_t, and the reason is a finding in itself. This block used to locate the
    // two chapters by their SHARED title (/A13/) — which only worked because the chapter-title
    // post-pass was FAILING: fake-ollama answers that prompt with `["Chapter One", …]`, an array of
    // bare strings, and the parser could not read that shape, so the placeholder titles survived.
    // v89_t taught the parser that shape (it is the one a real model gave the user), the post-pass
    // now succeeds, and the chapters are legitimately renamed.
    //
    // So this test had been PASSING FOR THE WRONG REASON, and depending on a bug to do it. The two
    // chapters are now identified by their own STORY text — unique, supplied by this test, and
    // untouched by any titling — which is what "neither overwrote the other" was ever about.
    const byStory = (frag) => st.topics.filter(t => (t.story || '').includes(frag));
    const second = byStory('Seconda cronaca'), third = byStory('Terza cronaca');
    assert(second.length === 1, `the 2nd same-titled chapter is present exactly once (got ${second.length})`);
    assert(third.length === 1, `and the 3rd (got ${third.length})`);
    assert(second[0].id !== third[0].id, 'they are distinct topics');
    assert(second[0].story !== third[0].story, 'each kept its own story (neither overwrote the other)');
    // They went in sharing one title; whatever they are called now, they must not still collide —
    // that is the v69_q claim, stated on the data as it actually ends up.
    assert(second[0].topic !== third[0].topic || second[0].id !== third[0].id,
      'two chapters that arrived with the same title remain separately addressable');

    // ⚠️ And the post-pass genuinely RAN — otherwise the re-scoping above would quietly restore the
    // old accidental dependency, with this test green either way. This is the end-to-end proof that
    // v89_t's bare-string rung works through the whole stack, not just in its unit test.
    const renamed = st.topics.filter(t => /^Chapter (One|Two|Three)$/.test(t.topic || ''));
    assert(renamed.length === 3,
      `the chapter-title post-pass applied all three titles (got ${renamed.length}: ` +
      JSON.stringify(st.topics.map(t => t.topic)) + ')');

    // The storyline lists all three, and the chain does not point a topic at itself.
    const sl = (st.storylines || [])[0];
    assert(sl && sl.chapters.length === 3, `the storyline lists all three chapters (got ${sl ? sl.chapters.length : 0})`);
    assert(st.topics.every(t => t.continuedFromId !== t.id), 'no topic is chained to itself');
  } catch (e) {
    failed = true;
    console.error('e2e-book-duplicate-titles FAILED:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
  console.log('  behavioural: 3 same-context chapters (2 sharing a title) → 3 distinct topics: OK');
  console.log('e2e-book-duplicate-titles: ALL PASSED');
})();
