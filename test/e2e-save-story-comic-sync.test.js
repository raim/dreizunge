// E2E (live server): /api/save-story syncing comicPanels for a SINGLE-panel chapter (v86_g).
//
// User-reported LIVE bug: a comic/image-derived chapter's progress card and question panel render
// from comicPanels[i].caption/inScene (_comicStoryPanelsHtml in index.html), NOT from `story` — a
// separate copy of the text, extracted once at upload time. /api/save-story (the "story repair" UI's
// write-back, and the error-hunt editor's "corrected story" field — both POST here) updated `story`
// correctly but left comicPanels stale forever after, so the progress card/question panel kept
// showing the OLD text (confirmed against a real reported case: `story` held the corrected text,
// `comicPanels[0]` still held the original OCR'd text with the exact reported typo). Fixed for the
// UNAMBIGUOUS single-panel case only — multi-panel has no way to know which edited sentence belongs
// to which panel from one flat story string, deliberately left unfixed (see roadmap_v86.md item L).
const { boot, post, assert } = require('./lib');

(async () => {
  const env = await boot({ seed: {
    schemaVersion: 29,
    topics: [
      {
        id: 'tp_single', topic: 'Clean Restroom', lang: 'it', srcLang: 'en', difficulty: 1,
        story: 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorrestevoletrovarlo!!!\nGrazie!',
        aiStory: 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorrestevoletrovarlo!!!\nGrazie!',
        comicPanels: [
          { x1: 40, y1: 101, x2: 692, y2: 770,
            caption: 'Aiutateci a mantenere pulito questo bagno:',
            inScene: 'lasciatelo come vorrestevoletrovarlo!!!\nGrazie!' },
        ],
        lessons: [],
      },
      {
        id: 'tp_multi', topic: 'Multi Panel', lang: 'it', srcLang: 'en', difficulty: 1,
        story: 'Panel one text.\nPanel two text.',
        comicPanels: [
          { x1: 0, y1: 0, x2: 100, y2: 100, caption: 'Panel one text.', inScene: '' },
          { x1: 100, y1: 0, x2: 200, y2: 100, caption: 'Panel two text.', inScene: '' },
        ],
        lessons: [],
      },
      {
        id: 'tp_nocomic', topic: 'No Comic', lang: 'it', srcLang: 'en', difficulty: 1,
        story: 'Just a plain story.',
        lessons: [],
      },
    ],
    storylines: [], flags: {}, progress: {},
  } });
  let failed = false;
  try {
    const { sport } = env;

    // 1) Single-panel chapter: a story edit SYNCS comicPanels[0] to match — caption gets the full
    //    corrected text, inScene is cleared (not left stale alongside it).
    const corrected = 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorreste trovarlo!!!\nGrazie!';
    const r1 = await post(sport, '/api/save-story', { topic: 'Clean Restroom', story: corrected });
    assert(r1.status === 200, 'save-story succeeds for the single-panel chapter (got ' + r1.status + ')');
    const saved1 = env.readStore().topics.find(t => t.id === 'tp_single');
    assert(saved1.story === corrected, 'story field itself is updated');
    assert(saved1.comicPanels[0].caption === corrected, 'comicPanels[0].caption is synced to the FULL corrected story: ' + JSON.stringify(saved1.comicPanels[0]));
    assert(!('inScene' in saved1.comicPanels[0]), 'comicPanels[0].inScene is CLEARED, not left holding stale text alongside the synced caption');
    // Reconstructs the renderer's own [caption, inScene].filter(Boolean).join(\'\\n\') exactly:
    const rendered = [saved1.comicPanels[0].caption, saved1.comicPanels[0].inScene].filter(Boolean).join('\n');
    assert(rendered === corrected, 'the renderer\'s own caption+inScene join reproduces the corrected story EXACTLY, not the stale original');
    console.log('  single-panel chapter: a story edit syncs comicPanels[0] (caption+inScene) to match: OK');

    // 2) Multi-panel chapter: deliberately NOT synced (no way to know which edited sentence belongs
    //    to which panel) — comicPanels are left exactly as they were, not guessed at or wiped.
    const r2 = await post(sport, '/api/save-story', { topic: 'Multi Panel', story: 'Rewritten entirely.' });
    assert(r2.status === 200, 'save-story succeeds for the multi-panel chapter (got ' + r2.status + ')');
    const saved2 = env.readStore().topics.find(t => t.id === 'tp_multi');
    assert(saved2.story === 'Rewritten entirely.', 'story field itself is still updated');
    assert(saved2.comicPanels[0].caption === 'Panel one text.', 'comicPanels are left UNTOUCHED for a multi-panel chapter — not synced (ambiguous), not wiped');
    assert(saved2.comicPanels[1].caption === 'Panel two text.', 'comicPanels[1] likewise untouched');
    console.log('  multi-panel chapter: comicPanels are deliberately left untouched (ambiguous, not guessed at): OK');

    // 3) A chapter with NO comicPanels at all: no crash, nothing added.
    const r3 = await post(sport, '/api/save-story', { topic: 'No Comic', story: 'A new plain story.' });
    assert(r3.status === 200, 'save-story succeeds for a chapter with no comicPanels at all (got ' + r3.status + ')');
    const saved3 = env.readStore().topics.find(t => t.id === 'tp_nocomic');
    assert(saved3.story === 'A new plain story.', 'story field updated');
    assert(!('comicPanels' in saved3), 'no comicPanels field is created where none existed');
    console.log('  a chapter with no comicPanels at all: no crash, no comicPanels field created: OK');

    // 4) An UNCHANGED story (same text re-saved) does NOT re-sync — cheap no-op guard, matches the
    //    _storyChanged gating this fix rides on (also gates the QC-stamp invalidation just above it).
    const before = env.readStore().topics.find(t => t.id === 'tp_single').comicPanels[0].caption;
    const r4 = await post(sport, '/api/save-story', { topic: 'Clean Restroom', story: corrected });
    assert(r4.status === 200, 'save-story succeeds when re-saving the SAME story (got ' + r4.status + ')');
    const after = env.readStore().topics.find(t => t.id === 'tp_single').comicPanels[0].caption;
    assert(after === before, 'an unchanged story is a no-op for comicPanels too (still the already-synced caption)');
    console.log('  re-saving an UNCHANGED story is a no-op (guarded by the same _storyChanged check): OK');

    console.log('e2e-save-story-comic-sync: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
})();
