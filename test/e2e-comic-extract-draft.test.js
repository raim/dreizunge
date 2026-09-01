// E2E (live server + fake Ollama): item AO (v88_d) — the SERVER writes extraction results onto the
// draft, so an extraction started on a phone survives the tab that started it.
//
// User report: "I keep losing extracted text, when text extraction is started on the mobile phone.
// The job is listed in the job popover but has no link associated, and clicking on the comic draft
// job opens the generation page without the extracted text."
//
// Measured causes (all three had to close, or the report recurs): the job carried no `link`;
// `_comicExtractCheckOnce()` is the only writer of the panel text, so a dead tab loses it; and
// `jobDone()` deletes the job after FIVE MINUTES, so a link that could only read the job store would
// work briefly then fail silently. The durable fix is server-side.
//
// The client halves (flushing the draft, sending its id, the popover link's two branches) are in
// unit-comic-extract-durable. This file drives the REAL /api/comic-extract route against the fake
// Ollama and then reads drafts.json back through the API — no test-only endpoint, no re-implemented
// job runner.
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, post, get, assert, tmpFile } = require('./lib');

const TINY_DATA_URL = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitJob(sport, jobId, ms = 20000) {
  const t0 = Date.now();
  for (;;) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    if (Date.now() - t0 > ms) throw new Error('job did not finish: ' + JSON.stringify(r.body));
    await sleep(150);
  }
}

(async () => {
  const scratchDrafts = tmpFile('dz_drafts_ao', '.json');
  const env = await boot({ log: true, extraEnv: { DRAFTS_FILE: scratchDrafts } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. A draft exists, exactly as the client's pre-extraction flush leaves it ──────────────
    const created = await post(sport, '/api/drafts', {
      lang: 'nl', srcLang: 'de',
      comic: { dataUrl: TINY_DATA_URL, naturalW: 1280, naturalH: 721, boxes: [
        { x1: 0, y1: 0, x2: 600, y2: 700, text: null },
        { x1: 600, y1: 0, x2: 1280, y2: 700, text: null },
      ] } });
    assert(created.status === 200, 'draft created (got ' + created.status + ')');
    const draftId = created.body.id;
    assert(draftId, 'the draft has an id');

    // ── 2. The extraction job carries a LINK, with the draft id inside it ──────────────────────
    // The absence of any link is exactly why the popover row had no "open →" button:
    // _jobsRenderList renders it only `if (j.link)`.
    const started = await post(sport, '/api/comic-extract', {
      images: [TINY_DATA_URL, TINY_DATA_URL], lang: 'nl', extract: true, draftId });
    assert(started.status === 202, 'extraction accepted (got ' + started.status + ' ' + JSON.stringify(started.body) + ')');
    const jobId = started.body.jobId;
    assert(jobId, 'a job id came back');

    const listed = await get(sport, '/api/jobs');
    assert(listed.status === 200, '/api/jobs reads');
    const row = (listed.body.jobs || []).find(j => j.id === jobId);
    assert(row, 'the extraction job appears in the aggregate list');
    assert(row.link && row.link.type === 'comic-extract',
      'it carries a comic-extract link — it carried NONE before this cut (got ' + JSON.stringify(row.link) + ')');
    assert(row.link.id === jobId, 'the link names the job (the fast path)');
    assert(row.link.draftId === draftId, 'and the draft (the DURABLE path)');
    console.log('  the extraction job carries a link naming both the job and the draft: OK');

    // ── 3. When it finishes, the results are on the DRAFT — index-aligned, description kept ────
    const done = await waitJob(sport, jobId);
    assert(done.status === 'done', 'the job finished (got ' + done.status + ' ' + (done.error || '') + ')');
    const panels = done.data && done.data.panels;
    assert(Array.isArray(panels) && panels.length === 2,
      'two panel results, one per image sent (got ' + JSON.stringify(panels) + ')');

    const back = await get(sport, '/api/drafts/' + draftId);
    assert(back.status === 200, 'the draft reads back');
    const boxes = back.body.comic.boxes;
    assert(boxes.length === 2, 'both panels are still there (got ' + boxes.length + ')');
    // The claim is that the RESULT reached the draft at all — a tab that died mid-job wrote nothing.
    assert(boxes[0].text && typeof boxes[0].text === 'object',
      'panel 1 has a result written onto it by the SERVER (got ' + JSON.stringify(boxes[0].text) + ')');
    assert(boxes[1].text && typeof boxes[1].text === 'object', 'panel 2 likewise');
    assert(boxes[0].x1 === 0 && boxes[1].x1 === 600, 'and the coordinates are untouched');
    // `description` was NEVER in the draft sanitiser's whitelist before this cut (item AN's third
    // instance), so it was silently stripped on every autosave — including the autosave that would
    // have followed this very write.
    for (const f of ['caption', 'inScene', 'description', 'raw']) {
      assert(f in boxes[0].text, `the round-tripped result keeps \`${f}\` (got ` + JSON.stringify(boxes[0].text) + ')');
    }
    console.log('  the finished job wrote its results onto the draft, all text fields intact: OK');

    // ── 3b. A RE-EXTRACTION preserves a title the user typed ───────────────────────────────────
    // Found by this file, not by a report: the job result replaces the whole `text` object, so
    // without an explicit carry-over a second extraction pass deletes an authored title — exactly
    // the class of silent loss item AN exists to close, reintroduced through a different door.
    {
      const named = JSON.parse(JSON.stringify(back.body.comic.boxes));
      named[0].text.title = 'De Manteling';
      // A REAL description to carry through the save — the fake model returns lettering for every
      // panel, so without seeding one the description assertion below would pass on an empty string
      // whether the whitelist kept the field or not.
      named[1].text.description = 'A cat sleeps.';
      const saved = await post(sport, '/api/drafts', { id: draftId, lang: 'nl', srcLang: 'de',
        comic: { dataUrl: TINY_DATA_URL, naturalW: 1280, naturalH: 721, boxes: named } });
      assert(saved.status === 200, 'the typed title is saved onto the draft');

      // ⚠️ The REAL regression path for item AN's third instance, and the one the server's own
      // direct write cannot exercise: an autosave goes through POST /api/drafts, whose box
      // sanitiser is a WHITELIST. `description` was never listed there, so this exact round trip —
      // extract, then autosave — is what silently deleted it. Asserted here, immediately after a
      // route round trip and before anything overwrites the text again.
      const roundTripped = await get(sport, '/api/drafts/' + draftId);
      assert(roundTripped.status === 200, 'the draft reads back after a route save');
      assert(roundTripped.body.comic.boxes[1].text.description === 'A cat sleeps.',
        'the sanitiser KEEPS description through a save (got '
        + JSON.stringify(roundTripped.body.comic.boxes[1].text) + ')');
      assert(roundTripped.body.comic.boxes[0].text.title === 'De Manteling',
        'and keeps the typed title through the same save');

      const again = await post(sport, '/api/comic-extract', {
        images: [TINY_DATA_URL, TINY_DATA_URL], lang: 'nl', extract: true, draftId });
      assert(again.status === 202, 're-extraction accepted');
      const d3 = await waitJob(sport, again.body.jobId);
      assert(d3.status === 'done', 're-extraction finished (got ' + d3.status + ')');

      const after = await get(sport, '/api/drafts/' + draftId);
      assert(after.body.comic.boxes[0].text.title === 'De Manteling',
        'the user-typed title SURVIVES a re-extraction (got '
        + JSON.stringify(after.body.comic.boxes[0].text) + ')');
      assert(after.body.comic.boxes[0].text.caption,
        'while the extracted fields were genuinely rewritten (non-vacuity)');
      console.log('  a re-extraction rewrites the extracted fields but keeps the typed title: OK');
    }

    // ── 4. Safe degradation: an unknown draft id must not fail an extraction that worked ───────
    // Persistence is an enhancement layered on top of a job that has already succeeded; losing it is
    // a downgrade to the old behaviour, never a reason to fail.
    {
      const s2 = await post(sport, '/api/comic-extract', {
        images: [TINY_DATA_URL], lang: 'nl', extract: true, draftId: 'draft_does_not_exist' });
      assert(s2.status === 202, 'extraction with a bogus draft id is still accepted');
      const d2 = await waitJob(sport, s2.body.jobId);
      assert(d2.status === 'done', 'and still completes normally (got ' + d2.status + ')');
      const still = await get(sport, '/api/drafts/' + draftId);
      assert(still.status === 200 && still.body.comic.boxes.length === 2,
        'the REAL draft is untouched by the bogus run');
      console.log('  an unknown draft id degrades safely — the job still succeeds, nothing corrupted: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} try { fs.unlinkSync(scratchDrafts); } catch (_) {} }
  console.log(failed ? 'e2e-comic-extract-draft: FAILED' : 'e2e-comic-extract-draft: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
