// e2e-import-storyboard.test.js
// v75_f — a flagged merge-import must not destroy a storyline's derived content.
//
// User-reported: "i flagged some lessons in the static and imported with merge. This seems to have
// lost the storyboard."
//
// Cause, and it is not in the import merge itself — `mergeFlags` correctly leaves topic CONTENT
// alone. `/api/lessons/import` then calls `_syncStorylineForTopic` for every incoming topic,
// unconditionally, and that function looked a chain up by ID ALONE — the id being a hash of the
// chapter list. A storyline whose stored id is not that hash (imported from elsewhere, or created
// before its chapter list settled) was therefore not recognised as its own chain: `existing` missed,
// `partialMatch` hit, `isExtension` was false because the chain had not grown, and it fell through
// to the FORK branch, which rebuilds a storyline from six fields —
// id/title/icon/chapters/lang/srcLang. `storyboard`, `storyboardMeta`, `storyboardPanels`,
// `storyboardScheme`, `summary`, `summaryMeta` and `tags` are not among them.
//
// The rebuilt copy is `unshift`ed to the FRONT of the array, so the dedup step then saw two
// storylines with an identical chapter sequence and had to choose. Its tie-break prefers a
// "curated" title (one that is not just the first chapter's name) — which is a proxy for
// authorship, NOT for content. When both copies looked auto-titled it kept the first, i.e. the
// bare one, and the storyboard and summary went with the other.
//
// Note what made this survivable-looking in testing: with a curated storyline title the tie-break
// happens to save the right copy. Only the auto-looking title exposes it. That is why §C below is
// the one that matters, and why the fix is at the identity check rather than at the tie-break.
const { boot, post, assert } = require('./lib');

const T1 = 'tp_1000000001', T2 = 'tp_1000000002';
// The chain hash the server derives. Copied ONLY to build a seed whose id deliberately does NOT
// match it — never used to test the server's own logic.
const chainId = ids => 'sl_' + Math.abs(JSON.stringify(ids).split('')
  .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));

const mkTopic = (id, name, parent) => ({
  id, topic: name, userTopic: name, lang: 'de', srcLang: 'en', difficulty: 2,
  story: 'Es war einmal ' + name + '.',
  ...(parent ? { continuedFromId: parent, continuedFrom: 'Kapitel Eins' } : {}),
  lessons: [{ id: 'ls_' + id, type: 'standard', title: 'V',
              vocab: [{ target: 'Haus', source: 'house' }], sentences: [] }],
  generatedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const seedWith = (slId, slTitle) => ({
  schemaVersion: 29,
  topics: [mkTopic(T1, 'Kapitel Eins', null), mkTopic(T2, 'Kapitel Zwei', T1)],
  storylines: [{
    id: slId, title: slTitle, icon: '📖', chapters: [T1, T2], lang: 'de', srcLang: 'en',
    summary: 'THE SUMMARY', summaryMeta: { model: 'x' },
    storyboard: '<div>THE STORYBOARD</div>', storyboardMeta: { model: 'y' },
    storyboardPanels: 3, storyboardScheme: 'warm', tags: ['adventure'],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  flags: {}, progress: {},
});

// The payload the STATIC build actually produces (`_flaggedExportPayload`): the legacy `lessons`
// shape with `mergeFlags:true` and NO `storylines` key — that rides only when the user edited a
// storyline summary. Built to match the export rather than to match the import, because the whole
// defect lives in the gap between them.
const flaggedExport = (seed) => ({
  lessons: seed.topics.map(t => ({
    ...t,
    lessons: t.lessons.map(L => ({
      ...L,
      vocab: L.vocab.map(v => ({ ...v, userFlag: { comment: 'wrong', at: new Date().toISOString() } })),
    })),
  })),
  scope: null, mergeFlags: true,
  exportedAt: new Date().toISOString(), exportedBy: 'dreizunge-static-user',
});

const DERIVED = ['storyboard', 'storyboardMeta', 'storyboardPanels', 'storyboardScheme',
                 'summary', 'summaryMeta', 'tags'];

(async () => {
  let failed = false;
  const cases = [
    ['id == chain hash, curated title',     chainId([T1, T2]), 'Die grosse Reise'],
    ['id != chain hash, curated title',     'sl_legacy123',    'Die grosse Reise'],
    // The reported shape: the tie-break cannot separate the copies, so it kept the bare one.
    ['id != chain hash, auto-looking title','sl_legacy123',    'Kapitel Eins'],
  ];
  for (const [label, slId, slTitle] of cases) {
    const seed = seedWith(slId, slTitle);
    const env = await boot({ seed });
    try {
      // Non-vacuity, on the data the assertions below actually run against: the seed must really
      // be in the store with its derived content, or "it survived" is trivially true.
      const before = env.readStore().storylines;
      assert(before.length === 1, `${label}: seeded one storyline (got ${before.length})`);
      assert(DERIVED.every(k => before[0][k] !== undefined),
        `${label}: the seeded storyline carries every derived field`);

      const r = await post(env.sport, '/api/lessons/import', flaggedExport(seed));
      assert(r.status === 200, `${label}: import accepted (got ${r.status})`);

      const after = env.readStore().storylines;
      // No duplicate: the chain must still be ONE storyline. A second copy is the shape the
      // dedup then has to guess about, and guessing is what lost the content.
      assert(after.length === 1,
        `${label}: the chain is still ONE storyline after import (got ${after.length}: ` +
        after.map(s => s.id + '/' + (s.storyboard ? 'sb' : 'no-sb')).join(', ') + ')');
      const sl = after[0];
      const lost = DERIVED.filter(k => sl[k] === undefined);
      assert(lost.length === 0,
        `${label}: the storyline keeps its derived content across the import; LOST: ${lost.join(', ')}`);
      assert(sl.storyboard === '<div>THE STORYBOARD</div>',
        `${label}: the storyboard is the SAME one, not a blank rebuild`);
      assert(sl.id === slId,
        `${label}: the storyline keeps its identity (${sl.id} != ${slId}) — a new id orphans ` +
        `every client-side reference to it`);

      // The import must still have done its job, or "nothing was lost" is satisfied by
      // "nothing happened".
      const topic = env.readStore().topics.find(t => t.id === T1);
      assert(topic.lessons[0].vocab[0].userFlag,
        `${label}: the imported flag was actually applied — otherwise this proves nothing`);
      console.log(`  ${label}: storyboard, summary and tags intact; flags applied`);
    } catch (e) {
      failed = true;
      console.error('FAIL: ' + (e && e.message ? e.message : e));
    } finally {
      await env.stop();
    }
  }
  // ── The reported case, with the real chapter ids and titles ─────────────────────────────
  // From `dreizunge-flagged-1785844074192.json` and its import diff. BOTH chains in that export
  // hit the defect; only one lost its content, and the difference is two characters. The storyline
  // title is truncated to 20 chars, so the 9-chapter chain is titled "Das kleine Ich bin i" while
  // its first chapter is "Das kleine Ich bin ich" — not equal, so the tie-break called it curated
  // and kept it. The 11-chapter chain is titled "Das kleine i", exactly its first chapter's name,
  // so both copies looked auto-generated and the bare one won on array order alone.
  // Pinned with the real values because "it depends on whether the title happens to match" is not
  // a property anyone should have to rediscover.
  {
    const C11 = ['tp_17815283212820000053','tp_17815284454040000147','tp_17815285515500000284',
      'tp_17815286603790000369','tp_17815287786440000451','tp_17815288869990000571',
      'tp_17815290049040000673','tp_17815291150260000733','tp_17815292264030000856',
      'tp_17815293398070000971','tp_17815294559340001022'];
    const names = ['Das kleine i','+, -, ∗, /','Eine Abenteuerliche Nacht','Die Welt der Sieben',
      'Zwischen Zahlen','Der Eins','Der Panikattacke','8 oder ∞','Die Wahrheit','Neue Einsicht','i ist i'];
    const seed = {
      schemaVersion: 29,
      topics: C11.map((id, i) => mkTopic(id, names[i], i ? C11[i - 1] : null)),
      storylines: [{
        id: 'sl_1854567313', title: 'Das kleine i', icon: '🔍', chapters: C11,
        lang: 'en', srcLang: 'de', tags: ['manually curated', 'children'],
        summary: 'SUMMARY-11', summaryMeta: { model: 'q' },
        storyboard: '<svg>STORYBOARD-11</svg>', storyboardMeta: { model: 'q' },
        storyboardPanels: 5, storyboardScheme: 'children',
        createdAt: '2026-06-15T12:58:41.315Z', updatedAt: '2026-07-14T13:03:36.000Z',
      }],
      flags: {}, progress: {},
    };
    // Non-vacuity for THIS section specifically: the seeded id must genuinely differ from the
    // chain hash, or the case degenerates into the already-passing case A.
    assert(chainId(C11) !== 'sl_1854567313',
      'the reported storyline id really is not its chain hash (hash=' + chainId(C11) + ')');
    assert(seed.topics[0].topic === seed.storylines[0].title,
      'and its title really does equal its first chapter name — the condition the tie-break cannot see');
    const env = await boot({ seed });
    try {
      const r = await post(env.sport, '/api/lessons/import', {
        lessons: seed.topics.map(t => ({ ...t, lessons: t.lessons.map(L => ({ ...L,
          vocab: L.vocab.map(v => ({ ...v, userFlag: { comment: 'wrong', at: new Date().toISOString() } })) })) })),
        scope: null, mergeFlags: true, exportedBy: 'dreizunge-static-user',
      });
      assert(r.status === 200, 'reported case: import accepted (got ' + r.status + ')');
      const after = env.readStore().storylines;
      assert(after.length === 1, 'reported case: still ONE storyline (got ' + after.length + ')');
      assert(after[0].id === 'sl_1854567313',
        'reported case: kept its id — the diff showed it replaced by sl_286814306');
      assert(after[0].storyboard === '<svg>STORYBOARD-11</svg>', 'reported case: storyboard intact');
      assert(after[0].summary === 'SUMMARY-11', 'reported case: summary intact');
      assert(after[0].icon === '🔍', 'reported case: icon intact — the rebuild hardcoded 📖');
      assert(JSON.stringify(after[0].tags) === '["manually curated","children"]',
        'reported case: the "manually curated" tag intact');
      console.log('  reported case (11 chapters, auto-looking title): id, storyboard, summary, icon, tags all intact');
    } catch (e) {
      failed = true;
      console.error('FAIL: ' + (e && e.message ? e.message : e));
    } finally {
      await env.stop();
    }
  }

  if (!failed) console.log('e2e-import-storyboard: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
