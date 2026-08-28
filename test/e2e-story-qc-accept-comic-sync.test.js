// E2E (live server): POST /api/story-qc/accept syncing comicPanels for a SINGLE-panel chapter
// (v86_r).
//
// User-reported LIVE bug (real case: sl_1597155858 / tp_17877511606660000499, "Cleanliness
// Command"): a comic/image-derived chapter's progress card and question panel render from
// comicPanels[i].caption/inScene (_comicStoryPanelsHtml in index.html), NOT from `story` — the SAME
// gap `e2e-save-story-comic-sync.test.js` already covers for `/api/save-story` (fixed at v86_g), but
// THIS route is a SECOND, independent write path to `t.story` that never got that fix: accepting a
// stored QC proposal (the exact path a real ai_error_hunt-driven correction goes through). Confirmed
// against the real reported data: `story` held the corrected text ("vorreste trovarlo"), while
// `comicPanels[0]` still held the original OCR'd typo ("vorrestevoletrovarlo") — the storyline
// reader (reads `story` directly) showed the fix; the progress card (reads comicPanels) did not.
const { boot, post, assert } = require('./lib');

const SINGLE_ORIGINAL = 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorrestevoletrovarlo!!!\nGrazie!';
const SINGLE_CORRECTED = 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorreste trovarlo!!!\nGrazie!';

function seedTopic(id, topic, comicPanels) {
  return {
    id, topic, lang: 'it', srcLang: 'en', difficulty: 1,
    story: SINGLE_ORIGINAL, aiStory: SINGLE_ORIGINAL,
    comicPanels,
    storyQcProposal: { corrected: SINGLE_CORRECTED, against: SINGLE_ORIGINAL, verdict: 'corrected', meta: { model: 'fake-qc' } },
    lessons: [],
  };
}

(async () => {
  const env = await boot({ seed: {
    schemaVersion: 29,
    topics: [
      seedTopic('tp_single', 'Clean Restroom', [
        { x1: 40, y1: 101, x2: 692, y2: 770,
          caption: 'Aiutateci a mantenere pulito questo bagno:',
          inScene: 'lasciatelo come vorrestevoletrovarlo!!!\nGrazie!' },
      ]),
      seedTopic('tp_multi', 'Multi Panel', [
        { x1: 0, y1: 0, x2: 100, y2: 100, caption: 'Panel one text.', inScene: '' },
        { x1: 100, y1: 0, x2: 200, y2: 100, caption: 'Panel two text.', inScene: '' },
      ]),
      { id: 'tp_nocomic', topic: 'No Comic', lang: 'it', srcLang: 'en', difficulty: 1,
        story: SINGLE_ORIGINAL, aiStory: SINGLE_ORIGINAL,
        storyQcProposal: { corrected: SINGLE_CORRECTED, against: SINGLE_ORIGINAL, verdict: 'corrected', meta: { model: 'fake-qc' } },
        lessons: [] },
    ],
    storylines: [], flags: {}, progress: {},
  } });
  let failed = false;
  try {
    const { sport } = env;

    // 1) Single-panel chapter: accepting the QC proposal SYNCS comicPanels[0] to match — the exact
    //    real-world path (ai_error_hunt correction) the reported bug went through.
    const r1 = await post(sport, '/api/story-qc/accept', { topicId: 'tp_single' });
    assert(r1.status === 200, 'accept succeeds for the single-panel chapter (got ' + r1.status + ' ' + JSON.stringify(r1.body) + ')');
    const saved1 = env.readStore().topics.find(t => t.id === 'tp_single');
    assert(saved1.story === SINGLE_CORRECTED, 'story field itself is updated to the accepted correction');
    assert(saved1.comicPanels[0].caption === SINGLE_CORRECTED, 'comicPanels[0].caption is synced to the FULL corrected story: ' + JSON.stringify(saved1.comicPanels[0]));
    assert(!('inScene' in saved1.comicPanels[0]), 'comicPanels[0].inScene is CLEARED, not left holding the stale typo alongside the synced caption');
    const rendered = [saved1.comicPanels[0].caption, saved1.comicPanels[0].inScene].filter(Boolean).join('\n');
    assert(rendered === SINGLE_CORRECTED, 'the renderer\'s own caption+inScene join reproduces the corrected story EXACTLY — the real reported bug, now fixed');
    console.log('  single-panel chapter: accepting a QC proposal syncs comicPanels[0] (caption+inScene) to match: OK');

    // 2) Multi-panel chapter: deliberately NOT synced — same ambiguity as /api/save-story's own fix.
    const r2 = await post(sport, '/api/story-qc/accept', { topicId: 'tp_multi' });
    assert(r2.status === 200, 'accept succeeds for the multi-panel chapter (got ' + r2.status + ')');
    const saved2 = env.readStore().topics.find(t => t.id === 'tp_multi');
    assert(saved2.story === SINGLE_CORRECTED, 'story field itself is still updated');
    assert(saved2.comicPanels[0].caption === 'Panel one text.', 'comicPanels are left UNTOUCHED for a multi-panel chapter — not synced (ambiguous), not wiped');
    assert(saved2.comicPanels[1].caption === 'Panel two text.', 'comicPanels[1] likewise untouched');
    console.log('  multi-panel chapter: comicPanels are deliberately left untouched (ambiguous, not guessed at): OK');

    // 3) A chapter with NO comicPanels at all: no crash, nothing added.
    const r3 = await post(sport, '/api/story-qc/accept', { topicId: 'tp_nocomic' });
    assert(r3.status === 200, 'accept succeeds for a chapter with no comicPanels at all (got ' + r3.status + ')');
    const saved3 = env.readStore().topics.find(t => t.id === 'tp_nocomic');
    assert(saved3.story === SINGLE_CORRECTED, 'story field updated');
    assert(!('comicPanels' in saved3), 'no comicPanels field is created where none existed');
    console.log('  a chapter with no comicPanels at all: no crash, no comicPanels field created: OK');

    console.log('e2e-story-qc-accept-comic-sync: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAIL:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
})();
