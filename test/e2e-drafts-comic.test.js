// E2E (live server + fake Ollama): item R follow-up (roadmap_v87.md) — unfinished-project drafts
// for the COMIC upload flow. Extends the base drafts feature (test/e2e-drafts.test.js, which covers
// the 'chunks'/PDF kind's validation, upsert, and GET /api/jobs integration in full — not repeated
// here) with the 'comic' kind's own specifics: dispatch on body.comic, the image size cap, the
// panel-count cap, and the aggregate's own differently-worded label.
'use strict';
const fs = require('fs');
const { boot, post, get, req, assert, tmpFile } = require('./lib');

const TINY_DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');

const BOXES = [
  { x1: 0, y1: 0, x2: 100, y2: 100, text: { caption: 'A man runs.', inScene: 'A man is running in a park.', raw: '', error: null } },
  { x1: 100, y1: 0, x2: 200, y2: 100, text: null },   // not yet extracted — a real mid-workflow state
];

(async () => {
  const scratchDrafts = tmpFile('dz_drafts', '.json');
  const env = await boot({ log: true, extraEnv: { DRAFTS_FILE: scratchDrafts } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. Validation specific to the comic shape ──────────────────────────────────────────────
    {
      const noImage = await post(sport, '/api/drafts', { comic: { boxes: BOXES } });
      assert(noImage.status === 400, 'a comic draft with no dataUrl is rejected (got ' + noImage.status + ')');
      const noBoxes = await post(sport, '/api/drafts', { comic: { dataUrl: TINY_DATA_URL, boxes: [] } });
      assert(noBoxes.status === 400, 'a comic draft with zero boxes is rejected (got ' + noBoxes.status + ')');
      const tooManyBoxes = await post(sport, '/api/drafts', {
        comic: { dataUrl: TINY_DATA_URL, boxes: Array(101).fill(BOXES[0]) } });
      assert(tooManyBoxes.status === 400, 'over-100 boxes rejected (got ' + tooManyBoxes.status + ')');
      const hugeImage = await post(sport, '/api/drafts', {
        comic: { dataUrl: 'data:image/jpeg;base64,' + 'A'.repeat(8_000_001), boxes: BOXES } });
      assert(hugeImage.status === 400, 'an over-8MB image is rejected (got ' + hugeImage.status + ')');
      console.log('  comic validation: no image / no boxes / too many boxes / oversized image all rejected: OK');
    }

    // ── 2. Create, round-trip, and the aggregate's own comic-specific label ─────────────────────
    let draftId;
    {
      const r1 = await post(sport, '/api/drafts', {
        lang: 'de', srcLang: 'en', comic: { dataUrl: TINY_DATA_URL, naturalW: 800, naturalH: 600, boxes: BOXES },
      });
      assert(r1.status === 200 && r1.body.id, 'comic draft created (got ' + r1.status + ' ' + r1.raw + ')');
      draftId = r1.body.id;

      const full = await get(sport, '/api/drafts/' + draftId);
      assert(full.status === 200 && full.body.kind === 'comic', 'kind is "comic" (got "' + full.body.kind + '")');
      assert(full.body.comic.dataUrl === TINY_DATA_URL, 'the image round-trips byte-for-byte');
      assert(full.body.comic.boxes.length === 2, 'both boxes round-trip');
      assert(full.body.comic.boxes[0].text.caption === 'A man runs.', 'extracted text round-trips');
      assert(full.body.comic.boxes[1].text === null, 'an UN-extracted box (text:null) round-trips as null, not dropped or coerced');
      assert(full.body.chunks === null, 'a comic draft carries no chunks (the two shapes are mutually exclusive)');

      const list = await get(sport, '/api/drafts');
      const summary = list.body.drafts.find(d => d.id === draftId);
      assert(summary && summary.kind === 'comic', 'the list summary also carries kind');
      assert(summary.chapterCount === 2, 'the summary counts BOXES for a comic draft, not chunks (got ' + summary.chapterCount + ')');

      const jobs = await get(sport, '/api/jobs');
      const entry = jobs.body.jobs.find(j => j.id === draftId);
      assert(entry, 'the comic draft appears in the jobs aggregate');
      assert(/^Comic draft/.test(entry.label), 'the label is worded distinctly from a text draft (got "' + entry.label + '")');
      assert(/2 panels/.test(entry.label), 'the label states the panel count (got "' + entry.label + '")');
      assert(entry.link && entry.link.type === 'draft' && entry.link.id === draftId, 'links the same way a text draft does');
      console.log('  comic draft: create, full round-trip (including an un-extracted box), list summary, jobs-aggregate label: OK');
    }

    // ── 3. Upsert by id works the same way for the comic shape ─────────────────────────────────
    {
      const editedBoxes = [...BOXES, { x1: 200, y1: 0, x2: 300, y2: 100, text: null }];
      const r2 = await post(sport, '/api/drafts', {
        id: draftId, lang: 'de', srcLang: 'en',
        comic: { dataUrl: TINY_DATA_URL, naturalW: 800, naturalH: 600, boxes: editedBoxes },
      });
      assert(r2.status === 200 && r2.body.id === draftId, 'update-in-place returns the SAME id');
      const list = await get(sport, '/api/drafts');
      assert(list.body.drafts.length === 1, 'still exactly one draft after the update (got ' + list.body.drafts.length + ')');
      assert(list.body.drafts[0].chapterCount === 3, 'the summary reflects the new box count (got ' + list.body.drafts[0].chapterCount + ')');
      console.log('  comic draft: upsert-by-id updates in place, no duplicate: OK');
    }

    // ── 4. A text/chunks draft and a comic draft coexist independently ─────────────────────────
    {
      const rText = await post(sport, '/api/drafts', {
        lang: 'it', srcLang: 'en', chunks: [{ title: 'Ch1', text: 'x', wordCount: 1 }] });
      assert(rText.status === 200, 'a text draft can be created alongside the comic one');
      const list = await get(sport, '/api/drafts');
      assert(list.body.drafts.length === 2, 'both drafts coexist (got ' + list.body.drafts.length + ')');
      const kinds = list.body.drafts.map(d => d.kind).sort();
      assert(JSON.stringify(kinds) === JSON.stringify(['chunks', 'comic']), 'one of each kind present (got ' + JSON.stringify(kinds) + ')');
      console.log('  a text draft and a comic draft coexist independently, each with its own kind: OK');
    }

    console.log('e2e-drafts-comic: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-drafts-comic FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    try { fs.unlinkSync(scratchDrafts); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
