// E2E: storyline chapter management — re-order, split off, add existing (user request).
//
// "Allow to re-order chapters of a storyline. Allow to split off storyline's chapters into separate
// storylines, choose a generic name ('orphaned from <title>') for the split-off storyline. Allow to
// add existing chapters to a given storyline."
//
// Server-side rather than client-side on purpose: a re-order is not ONE write — it rewrites
// continuedFromId across several topics, and a half-applied chain is worse than no re-order. Per the
// standing rule ("server.js changes need a FRESH PROCESS"), this is the verification path.
//
// The re-linking rule under test is the user's own ruling ("re-link the chain too"), scoped to the
// storyline's own chapters so that forks survive:
//   • chapter[i] continues chapter[i-1]
//   • chapter[0] keeps the storyline's EXTERNAL parent (a storyline continuing another must not be
//     cut loose by a shuffle)
//   • a chapter in ANOTHER storyline that continues one of these is untouched
const { boot, post, get, assert } = require('./lib');

const T = (id, extra) => ({ id, topic: 'Chapter ' + id, lang: 'de', srcLang: 'en', lessons: [],
  story: 'Story of ' + id, ...(extra || {}) });

const SEED = () => ({
  schemaVersion: 29, flags: {}, progress: {},
  topics: [
    T('tp_ext'),                                   // an EXTERNAL parent, outside the storyline
    T('tp_1', { continuedFromId: 'tp_ext', continuedFrom: 'Chapter tp_ext' }),
    T('tp_2', { continuedFromId: 'tp_1', continuedFrom: 'Chapter tp_1' }),
    T('tp_3', { continuedFromId: 'tp_2', continuedFrom: 'Chapter tp_2' }),
    T('tp_loose'),                                 // exists, belongs to no storyline
    T('tp_fork', { continuedFromId: 'tp_2', continuedFrom: 'Chapter tp_2' }),   // another branch off tp_2
  ],
  storylines: [
    { id: 'sl_a', title: 'Alpha', icon: '📖', chapters: ['tp_1', 'tp_2', 'tp_3'], lang: 'de', srcLang: 'en' },
    { id: 'sl_fork', title: 'Fork', icon: '🌿', chapters: ['tp_fork'], lang: 'de', srcLang: 'en' },
  ],
});
const linkOf = (env, id) => {
  const t = env.readStore().topics.find(x => x.id === id);
  return t ? (t.continuedFromId || null) : 'MISSING';
};

(async () => {
  const env = await boot({ seed: SEED() });
  try {
    const { sport } = env;

    // ── 1. RE-ORDER with re-linking ─────────────────────────────────────────
    {
      const r = await post(sport, '/api/storyline/chapters',
        { slId: 'sl_a', chapters: ['tp_3', 'tp_1', 'tp_2'], relink: true });
      assert(r.status === 200, 'accepted (got ' + r.status + ' ' + r.raw + ')');
      const sl = env.readStore().storylines.find(s => s.id === 'sl_a');
      assert(JSON.stringify(sl.chapters) === JSON.stringify(['tp_3', 'tp_1', 'tp_2']),
        'the chapters array is the new order (got ' + JSON.stringify(sl.chapters) + ')');
      // The chain follows the array — this is what makes the storyline SCREEN, which draws a tree
      // from these links rather than from the array, actually show the new sequence.
      assert(linkOf(env, 'tp_3') === 'tp_ext',
        'the NEW first chapter inherits the storyline\'s external parent, so the storyline is not ' +
        'cut loose from what it continues (got ' + linkOf(env, 'tp_3') + ')');
      assert(linkOf(env, 'tp_1') === 'tp_3', 'second chapter continues the first (got ' + linkOf(env, 'tp_1') + ')');
      assert(linkOf(env, 'tp_2') === 'tp_1', 'third continues the second (got ' + linkOf(env, 'tp_2') + ')');
      console.log('  re-order: array AND chain both follow, external parent preserved: OK');
    }

    // ── 2. ⚠️ A FORK IN ANOTHER STORYLINE IS UNTOUCHED ──────────────────────
    // The reason re-linking is scoped to this storyline's own chapters. tp_fork lives in sl_fork and
    // continues tp_2; re-ordering sl_a must not steal or sever that branch.
    {
      assert(linkOf(env, 'tp_fork') === 'tp_2',
        'the other branch still continues the chapter it always did (got ' + linkOf(env, 'tp_fork') + ')');
      const forkSl = env.readStore().storylines.find(s => s.id === 'sl_fork');
      assert(JSON.stringify(forkSl.chapters) === JSON.stringify(['tp_fork']), 'and its own storyline is unchanged');
      console.log('  a fork branching off a re-ordered chapter is left intact: OK');
    }

    // ── 3. ADD an existing chapter, WITHOUT removing it from its storyline ───
    // The user's ruling: "add without removing" — the model already supports a chapter in several
    // storylines, which is exactly what a fork's shared prefix relies on.
    {
      const r = await post(sport, '/api/storyline/chapters',
        { slId: 'sl_fork', chapters: ['tp_fork', 'tp_2'] });      // no relink: membership, not re-sequencing
      assert(r.status === 200, 'accepted');
      const st = env.readStore();
      assert(st.storylines.find(s => s.id === 'sl_fork').chapters.includes('tp_2'), 'the chapter joined the storyline');
      assert(st.storylines.find(s => s.id === 'sl_a').chapters.includes('tp_2'),
        'and it is STILL in its original storyline — add does not move (user ruling)');
      assert(linkOf(env, 'tp_2') === 'tp_1',
        'and adding did not touch the chain: membership is not re-sequencing (got ' + linkOf(env, 'tp_2') + ')');
      console.log('  add existing: joins without leaving, and without re-linking: OK');
    }

    // ── 4. Validation: ghosts and duplicates are refused ─────────────────────
    // A storyline listing an id that resolves to nothing renders as a gap and breaks "last chapter"
    // lookups — which is exactly how a continue button can silently disappear.
    {
      let r = await post(sport, '/api/storyline/chapters', { slId: 'sl_a', chapters: ['tp_1', 'tp_ghost'] });
      assert(r.status === 400 && /Unknown chapter id/.test(r.body.error || ''), 'a ghost id is refused: ' + r.raw);
      r = await post(sport, '/api/storyline/chapters', { slId: 'sl_a', chapters: ['tp_1', 'tp_1'] });
      assert(r.status === 400 && /Duplicate/.test(r.body.error || ''), 'a duplicate id is refused: ' + r.raw);
      r = await post(sport, '/api/storyline/chapters', { slId: 'sl_a', chapters: [] });
      assert(r.status === 400, 'an empty list is refused (that is a delete, not a re-order)');
      r = await post(sport, '/api/storyline/chapters', { slId: 'sl_nope', chapters: ['tp_1'] });
      assert(r.status === 404, 'an unknown storyline is a 404');
      console.log('  validation: ghost ids, duplicates, empty list and unknown storyline all refused: OK');
    }

    // ── 5. SPLIT OFF into "orphaned from <title>" ───────────────────────────
    {
      const before = env.readStore().storylines.find(s => s.id === 'sl_a').chapters.slice();
      assert(before.length >= 3, 'setup: sl_a still has several chapters (' + JSON.stringify(before) + ')');
      const r = await post(sport, '/api/storyline/split', { slId: 'sl_a', fromIndex: 1 });
      assert(r.status === 200, 'split accepted (' + r.raw + ')');
      const st = env.readStore();
      const orig = st.storylines.find(s => s.id === 'sl_a');
      const made = st.storylines.find(s => s.id === r.body.newId);
      assert(made, 'a new storyline exists');
      assert(made.title === 'orphaned from Alpha',
        'named with the generic pattern the user asked for (got "' + made.title + '")');
      assert(JSON.stringify(orig.chapters) === JSON.stringify(before.slice(0, 1)), 'the original keeps the head');
      assert(JSON.stringify(made.chapters) === JSON.stringify(before.slice(1)), 'the new one takes the tail');
      assert(made.lang === 'de' && made.srcLang === 'en', 'and inherits the language pair');
      // The split-off head is a ROOT now — no longer a continuation of what it was split away from.
      assert(linkOf(env, made.chapters[0]) === null,
        'the split-off head is detached from the chapter left behind (got ' + linkOf(env, made.chapters[0]) + ')');
      // …but the rest of the moved run keeps its own internal links, so it arrives intact.
      if (made.chapters.length > 1) {
        assert(linkOf(env, made.chapters[1]) === made.chapters[0],
          'and the chapters after it still continue each other (got ' + linkOf(env, made.chapters[1]) + ')');
      }
      console.log('  split: "orphaned from <title>", head detached, the rest arrives intact: OK');
    }

    // ── 6. Split bounds ─────────────────────────────────────────────────────
    // fromIndex 0 would move everything and leave an empty storyline behind — a rename pretending to
    // be a split. Refused rather than half-done.
    {
      let r = await post(sport, '/api/storyline/split', { slId: 'sl_fork', fromIndex: 0 });
      assert(r.status === 400, 'splitting at 0 is refused (got ' + r.status + ')');
      r = await post(sport, '/api/storyline/split', { slId: 'sl_fork', fromIndex: 99 });
      assert(r.status === 400, 'splitting past the end is refused');
      console.log('  split bounds: 0 and past-the-end both refused: OK');
    }

    console.log('e2e-storyline-chapters: ALL PASSED');
  } finally {
    await env.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
