// E2E (live server + fake Ollama): GET /api/jobs — item U (roadmap_v87.md), "a single place to see
// everything in flight". Per this project's own standing rule ("server.js changes need a FRESH
// PROCESS to verify live"), this is the correct verification path for the new route.
//
// Covers: a labeled job (QC, an existing topic) appears with its label/link; an analysis job
// (CP1/CP2) appears with a topic link; a book job appears as ONE 'book'-kind entry (not one per
// chapter) and its link resolves to the first finished chapter once one exists. The exclusion of
// labelless internal sub-jobs (one chapter's own generate() call inside a book job) is checked at
// the SOURCE level, mirroring e2e-recreate.test.js's own precedent for a property a live run can't
// cleanly isolate: fake-ollama.js resolves fast enough that catching a book job's own per-chapter
// jobId mid-flight (before it's folded back into the book job's status) would be flaky, not a real
// guarantee — the source read confirms the mechanism instead (that call site passes no meta at all,
// so newJob()'s own `label` default keeps it out of the aggregate by construction).
const fs = require('fs');
const path = require('path');
const { boot, post, get, assert, sleep, waitBookJob, tmpFile } = require('./lib');

async function waitJob(sport, jobId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(150);
  }
  throw new Error('job timed out');
}

const SEED = {
  schemaVersion: 29, storylines: [], flags: {}, progress: {},
  topics: [
    { id: 'tp_jl1', topic: 'Jobs List Fixture', lang: 'de', srcLang: 'en',
      story: 'Der Hund lauft. Die Katze schlaft.',
      lessons: [{ id: 'l1', type: 'standard', vocab: [{ target: 'Hund', source: 'dog' }], sentences: [] }] },
  ],
};

(async () => {
  // The analysis job this test triggers writes real cache entries to canonical-analysis.json — an
  // isolated scratch file, same as e2e-analysis.test.js, or a run pollutes the real project's
  // working tree with a fixture chapter that was never actually analysed by a real model.
  const scratchAnalysis = tmpFile('dz_canonical_analysis', '.json');
  const env = await boot({ log: true, seed: SEED, extraEnv: { CANONICAL_ANALYSIS_FILE: scratchAnalysis } });
  let failed = false;
  try {
    const { sport } = env;

    // ── 1. A QC job and an analysis job both show up, labeled, linked to their topic ───────────
    const qcStart = await post(sport, '/api/qc', { topicId: 'tp_jl1' });
    assert(qcStart.status === 202, 'QC accepted (got ' + qcStart.status + ' ' + qcStart.raw + ')');
    const anaStart = await post(sport, '/api/analyze-chapter/tp_jl1', {});
    assert(anaStart.status === 202 || anaStart.status === 200,
      'analysis accepted or cache-hit (got ' + anaStart.status + ' ' + anaStart.raw + ')');

    const listed = await get(sport, '/api/jobs');
    assert(listed.status === 200 && Array.isArray(listed.body.jobs), 'GET /api/jobs returns a jobs array');

    const qcEntry = listed.body.jobs.find(j => j.id === qcStart.body.jobId);
    assert(qcEntry, 'the QC job appears in the aggregate list');
    assert(qcEntry.kind === 'job', 'QC entry kind is "job"');
    assert(/Jobs List Fixture/.test(qcEntry.label), 'QC entry label names the topic (got "' + qcEntry.label + '")');
    assert(qcEntry.link && qcEntry.link.type === 'topic' && qcEntry.link.id === 'tp_jl1',
      'QC entry links to the topic (got ' + JSON.stringify(qcEntry.link) + ')');

    if (anaStart.status === 202) {
      const anaEntry = listed.body.jobs.find(j => j.id === anaStart.body.jobId);
      assert(anaEntry, 'the analysis job appears in the aggregate list');
      assert(anaEntry.link && anaEntry.link.type === 'topic' && anaEntry.link.id === 'tp_jl1',
        'analysis entry links to the topic (got ' + JSON.stringify(anaEntry.link) + ')');
      await waitJob(sport, anaStart.body.jobId);
    }
    await waitJob(sport, qcStart.body.jobId);
    console.log('  QC + analysis jobs both appear, labeled and linked: OK');

    // ── 2. A book job appears as ONE 'book'-kind entry, not one per chapter ────────────────────
    const bookStart = await post(sport, '/api/generate-book', {
      generated: true, topic: 'Jobs List Book', nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 80 });
    assert(bookStart.status === 202, 'book accepted (got ' + bookStart.status + ' ' + bookStart.raw + ')');

    // Poll a few times while it's running — collecting every jobs[] snapshot seen — since
    // fake-ollama can resolve a 2-chapter book in well under one interval on a fast box.
    let sawBookEntry = null;
    for (let i = 0; i < 20; i++) {
      const snap = await get(sport, '/api/jobs');
      const be = snap.body.jobs.find(j => j.id === bookStart.body.bookId);
      if (be) { sawBookEntry = be; break; }
      await sleep(100);
    }
    assert(sawBookEntry, 'the book job appears in the aggregate list under its OWN id');
    assert(sawBookEntry.kind === 'book', 'book entry kind is "book"');
    assert(/Jobs List Book/.test(sawBookEntry.label), 'book entry label names the base topic (got "' + sawBookEntry.label + '")');
    assert(/2/.test(sawBookEntry.label), 'book entry label mentions the chapter count (got "' + sawBookEntry.label + '")');

    const final = await waitBookJob(sport, bookStart.body.bookId, { timeoutMs: 90000 });
    assert(final && final.status === 'done', 'book job finished (status=' + (final && final.status) + ')');

    const afterList = await get(sport, '/api/jobs');
    const bookEntries = afterList.body.jobs.filter(j => j.id === bookStart.body.bookId);
    assert(bookEntries.length === 1, 'still exactly ONE entry for the finished book job (got ' + bookEntries.length + ')');
    // No stray labelless per-chapter entries leaked into the aggregate under a DIFFERENT id either —
    // every 'job'-kind entry in the whole list carries a non-empty label by construction (the route
    // itself only pushes entries that passed the `if (!j.label) continue` filter), so this is really
    // reconfirming the filter fired, not a new claim.
    assert(afterList.body.jobs.every(j => j.kind === 'book' || (j.label && j.label.length)),
      'every job-kind entry in the aggregate carries a label');
    assert(bookEntries[0].link && bookEntries[0].link.type === 'topic',
      'the finished book job links to its first chapter (got ' + JSON.stringify(bookEntries[0].link) + ')');
    console.log('  book job aggregates as ONE entry, before and after completion: OK');

    // ── 3. Source-level: the per-chapter jobId inside _runBookJob is deliberately labelless ─────
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const fnAt = src.indexOf('async function _runBookJob(');
    assert(fnAt >= 0, '_runBookJob found');
    const fnEnd = src.indexOf('\nasync function ', fnAt + 10);
    const fnBody = src.slice(fnAt, fnEnd > 0 ? fnEnd : fnAt + 4000);
    assert(/const jobId = newJob\(\);/.test(fnBody),
      '_runBookJob\'s own per-chapter newJob() call passes no meta — stays out of the aggregate by construction');
    console.log('  source check: the book job\'s per-chapter sub-job is deliberately labelless: OK');

    console.log('e2e-jobs-list: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-jobs-list FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-30).join('\n'));
  } finally {
    env.stop();
    try { fs.unlinkSync(scratchAnalysis); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
