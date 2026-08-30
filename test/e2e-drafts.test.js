// E2E (live server + fake Ollama): item R (roadmap_v87.md) — unfinished-project drafts. Per this
// project's own standing rule ("server.js changes need a FRESH PROCESS to verify live"), this is
// the correct verification path for the new /api/drafts routes and their DRAFTS_FILE persistence.
//
// Covers: POST creates a fresh draft and returns its id; POSTing again WITH that id updates it in
// place (no duplicate); GET lists summaries (no chunk text — the popover's own data source shape);
// GET /:id returns the full draft; DELETE removes it (idempotent — deleting twice is not an error);
// validation (no chunks, too many chunks); and the actual point of this item — GET /api/jobs (item
// U's own aggregate) includes a draft as kind:'draft', linked, and does NOT count it toward the
// running-jobs total (status:'draft', not 'running').
'use strict';
const fs = require('fs');
const { boot, post, get, req, assert, tmpFile } = require('./lib');

const CHUNKS = [
  { title: 'Chapter One', text: 'Es war einmal ein Test.', wordCount: 5 },
  { title: 'Chapter Two', text: 'Die Katze und das Haus.', wordCount: 5 },
];

(async () => {
  // DRAFTS_FILE isolated — same reasoning as e2e-analysis.test.js's own CANONICAL_ANALYSIS_FILE:
  // every boot needs its own scratch file or a run pollutes the real project's working tree.
  const scratchDrafts = tmpFile('dz_drafts', '.json');
  const env = await boot({ log: true, extraEnv: { DRAFTS_FILE: scratchDrafts } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. Validation ────────────────────────────────────────────────────────────────────────
    {
      const noChunks = await post(sport, '/api/drafts', { lang: 'de', srcLang: 'en' });
      assert(noChunks.status === 400, 'empty chunks rejected (got ' + noChunks.status + ')');
      const tooMany = await post(sport, '/api/drafts', { chunks: Array(201).fill({ title: 'x', text: 'y', wordCount: 1 }) });
      assert(tooMany.status === 400, 'over-200 chunks rejected (got ' + tooMany.status + ')');
      console.log('  validation: no chunks / too many chunks both rejected: OK');
    }

    // ── 2. Create, then update IN PLACE (upsert by id, no duplicate) ───────────────────────────
    let draftId;
    {
      const r1 = await post(sport, '/api/drafts', {
        lang: 'de', srcLang: 'en', difficulty: 2, sourceFile: 'my-book.pdf', chunks: CHUNKS,
      });
      assert(r1.status === 200 && r1.body.id, 'first save creates a draft (got ' + r1.status + ' ' + r1.raw + ')');
      draftId = r1.body.id;

      const editedChunks = [...CHUNKS, { title: 'Chapter Three', text: 'Ein neues Kapitel.', wordCount: 3 }];
      const r2 = await post(sport, '/api/drafts', {
        id: draftId, lang: 'de', srcLang: 'en', difficulty: 2, sourceFile: 'my-book.pdf', chunks: editedChunks,
      });
      assert(r2.status === 200 && r2.body.id === draftId, 'second save with the same id updates in place, same id returned');

      const list = await get(sport, '/api/drafts');
      assert(list.status === 200 && list.body.drafts.length === 1,
        'exactly ONE draft exists after two saves to the same id (got ' + (list.body.drafts || []).length + ')');
      assert(list.body.drafts[0].chapterCount === 3, 'the listed summary reflects the UPDATED chunk count (3, got ' + list.body.drafts[0].chapterCount + ')');
      assert(list.body.drafts[0].chunks === undefined, 'the list endpoint is a SUMMARY — no chunk text included');
      console.log('  create then update-in-place: exactly one draft, summary reflects the edit: OK');
    }

    // ── 3. GET /:id returns the full draft ──────────────────────────────────────────────────────
    {
      const r = await get(sport, '/api/drafts/' + draftId);
      assert(r.status === 200, 'GET /api/drafts/:id ok (got ' + r.status + ')');
      assert(r.body.chunks.length === 3, 'full draft carries all 3 chunks');
      assert(r.body.chunks[2].title === 'Chapter Three', 'chunk content round-trips correctly');
      assert(r.body.sourceFile === 'my-book.pdf', 'sourceFile round-trips');
      const missing = await get(sport, '/api/drafts/no-such-id');
      assert(missing.status === 404, 'an unknown draft id 404s cleanly (got ' + missing.status + ')');
      console.log('  GET /api/drafts/:id: full content round-trips, unknown id 404s: OK');
    }

    // ── 4. GET /api/jobs includes the draft — linked, NOT counted as running ────────────────────
    {
      const jobs = await get(sport, '/api/jobs');
      assert(jobs.status === 200, 'GET /api/jobs ok');
      const entry = jobs.body.jobs.find(j => j.id === draftId);
      assert(entry, 'the draft appears in the jobs aggregate (item U)');
      assert(entry.kind === 'draft', 'kind is "draft"');
      assert(entry.link && entry.link.type === 'draft' && entry.link.id === draftId,
        'links to itself via {type:"draft", id} (got ' + JSON.stringify(entry.link) + ')');
      assert(/3/.test(entry.label) && /my-book\.pdf/.test(entry.label),
        'label names the source file and current chapter count (got "' + entry.label + '")');
      const running = jobs.body.jobs.filter(j => j.status === 'running' || j.status === 'pending').length;
      assert(running === 0, 'a draft does NOT count toward the running-jobs total (status:"draft", not "running") — got ' + running);
      console.log('  GET /api/jobs: draft is linked and labeled, excluded from the running count: OK');
    }

    // ── 5. DELETE removes it; deleting again is a clean no-op, not an error ────────────────────
    {
      const d1 = await req(sport, 'DELETE', '/api/drafts/' + draftId);
      assert(d1.status === 200 && d1.body.ok, 'delete ok (got ' + d1.status + ' ' + d1.raw + ')');
      const list = await get(sport, '/api/drafts');
      assert(list.body.drafts.length === 0, 'the draft is gone (got ' + list.body.drafts.length + ' remaining)');
      const d2 = await req(sport, 'DELETE', '/api/drafts/' + draftId);
      assert(d2.status === 200 && d2.body.ok, 'deleting an already-gone draft is still a clean 200, not an error');
      const jobsAfter = await get(sport, '/api/jobs');
      assert(!jobsAfter.body.jobs.some(j => j.id === draftId), 'the deleted draft no longer appears in GET /api/jobs');
      console.log('  DELETE: removes the draft, idempotent, and it drops out of the jobs aggregate: OK');
    }

    // ── 6. A SECOND, independent draft — confirms drafts are keyed by id, not a singleton ──────
    {
      const r = await post(sport, '/api/drafts', { lang: 'it', srcLang: 'en', sourceFile: 'other.pdf', chunks: CHUNKS });
      assert(r.status === 200, 'a second draft can be created independently');
      const list = await get(sport, '/api/drafts');
      assert(list.body.drafts.length === 1 && list.body.drafts[0].id === r.body.id,
        'exactly the new draft is present (the first one stays deleted, not resurrected)');
      console.log('  a second, independent draft works correctly after the first was deleted: OK');
    }

    console.log('e2e-drafts: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-drafts FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    try { fs.unlinkSync(scratchDrafts); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
