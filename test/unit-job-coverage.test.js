// unit-job-coverage.test.js — v89_ak.
//
// ⚠️ THIS FILE EXISTS BECAUSE THE CLAIM KEPT BEING WRONG. `v88_ag` converted the QC routes and its
// write-up said "all EIGHT formerly-blocking model routes are now listed, cancellable jobs behind
// one shape". It was wrong twice, and both times a USER found it:
//   • `v89_af` — /api/storyline-storyboard awaited a ~30-minute generator and answered 200.
//   • `v89_ag` — a book job was listed but the popover refused to offer its cancel.
// Each was fixed as an instance. This is the ENUMERATION, so the next omission fails here instead of
// reaching a user: it walks EVERY route in server.js, decides which ones reach a model, and requires
// each of those to be a listed job — or to be on an explicit, reasoned exemption list.
//
// The audit that produced it also found two more (`/api/clean-text`, `/api/split-chapters`), which
// nobody had reported: a document import could spend minutes in the model with no popover row at all.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── Walk every route block by REAL brace matching ───────────────────────────────────────────────
// ⚠️ Not by regex over a fixed window. An earlier hand sweep used one and misread three routes —
// it reported /api/generate as non-cancellable (it is) and /api/generate-book as untracked (it is,
// in its own store). A wrong inventory is worse than none, because it retires the question.
function routeBlocks() {
  const out = [];
  const re = /if \(M === '(GET|POST|PUT|DELETE|PATCH)' && url\.pathname[^\n]*/g;
  let m;
  while ((m = re.exec(src))) {
    const at = m.index;
    let d = 0, i = src.indexOf('{', at), end = src.length;
    for (; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) { end = i + 1; break; } }
    }
    out.push({ path: (m[0].match(/'(\/api\/[^']*)'/) || [])[1] || m[0].slice(0, 50), body: src.slice(at, end) });
  }
  return out;
}
// A route "reaches a model" if it calls one directly, or calls a generator that does.
const DIRECT = /callLLM\w*\(|_callLLM\(/;
const GENERATORS = /\b(generate|qcProse|cleanNarrativeText|splitChaptersLLM|_storyboardForStoryline|_runBookJob|_runRecreateJob|_runAnalysisJob|_runComicExtractJob|_runComicDetectJob|generateStoryQc|generateSummaryQc|generateStorylineTitle|generateStorylineSummary|normaliseExtractedText|generateDialectStory|_runQc|_kickOffAnalysisJob|tutorReply)\w*\s*\(/;

// ⚠️ EXEMPTIONS ARE NAMED, WITH A REASON. An unexplained exemption is how a real gap hides in a
// green test — the whole failure mode this file exists to stop.
const EXEMPT = {
  '/api/tutor':
    'streaming and stateless (INTERNALS §6b) — the generic job store was never built for that shape. ' +
    'It IS in the popover, as a SYNTHETIC entry the client derives from _tutorState.busy.',
};

const modelRoutes = routeBlocks().filter(r => DIRECT.test(r.body) || GENERATORS.test(r.body));

// ── 1. Every model-backed route is a job, or a named exemption ──────────────────────────────────
{
  assert.ok(modelRoutes.length >= 18,
    `the walk found ${modelRoutes.length} model-backed routes — far too few means the matcher broke ` +
    'and every assertion below is vacuous');
  const offenders = [];
  for (const r of modelRoutes) {
    if (EXEMPT[r.path]) continue;
    const isJob = /runAsJob\(res/.test(r.body) || /newJob\(/.test(r.body)
      // The book store is a second, deliberate tracker with its own cancel route (v89_ag).
      || /bookJobs|startBookJob|_runBookJob/.test(r.body)
      // Some routes create their job one level down, inside the runner they call.
      || /_kickOffAnalysisJob\(/.test(r.body);
    if (!isJob) offenders.push(r.path);
  }
  assert.deepStrictEqual(offenders, [],
    '⚠️ these model-backed routes are NOT listed jobs, so they run with no popover row and no ' +
    'cancel: ' + offenders.join(', ') + '. Convert with runAsJob (validation OUTSIDE the job, ' +
    'v88_al), or add a REASONED entry to EXEMPT above.');
}
console.log(`  all ${modelRoutes.length} model-backed routes are listed jobs (1 named exemption): OK`);

// ── 2. ⚠️ The two the audit itself found ────────────────────────────────────────────────────────
// Pinned by name as well as by the sweep: they are the evidence the enumeration was worth running,
// and a regression on either is a regression on the audit's own finding.
for (const p of ['/api/clean-text', '/api/split-chapters']) {
  const r = modelRoutes.find(x => x.path === p);
  assert.ok(r, `${p} still exists and still reaches a model`);
  assert.ok(/runAsJob\(res/.test(r.body), `${p} is a job (found blocking by the v89_ak audit)`);
  assert.ok(/label:/.test(r.body), `${p} carries a label — without one it is not user-facing at all`);
  assert.ok(/jobStep\(jobId/.test(r.body), `${p} reports a progress step`);
  // v88_al: a 400/503 answers the REQUEST. Turning it into a failed job loses the status code and
  // makes a malformed call look like a model failure.
  const beforeJob = r.body.slice(0, r.body.indexOf('runAsJob('));
  assert.ok(/json\(res, 400/.test(beforeJob) && /json\(res, 503/.test(beforeJob),
    `${p} validates BEFORE creating the job (v88_al)`);
}
console.log('  /api/clean-text and /api/split-chapters are jobs, labelled, validated outside: OK');

// ── 3. ⚠️ Every job-returning route has a client that POLLS ─────────────────────────────────────
// A converted route whose caller still reads the response body sees a 202 {jobId} instead of its
// payload and silently drops the result — the exact half-conversion `v89_af` had to catch on the
// storyboard's SECOND caller.
{
  const missing = [];
  for (const p of ['/api/clean-text', '/api/split-chapters', '/api/storyline-storyboard',
                   '/api/text-qc', '/api/story-qc', '/api/retranslate-story']) {
    let idx = -1, seen = 0;
    while ((idx = client.indexOf(`'${p}'`, idx + 1)) !== -1) {
      seen++;
      const around = client.slice(Math.max(0, idx - 400), idx + 400);
      // A POST caller must poll; a DELETE/GET of the same path need not.
      if (/method:\s*'?POST/.test(around) && !/_jobAwait\(|_qcPoll\(|_startComic|_pollBookJob|pollJob\(/.test(around))
        missing.push(p);
    }
    assert.ok(seen > 0, `${p} has at least one client caller`);
  }
  assert.deepStrictEqual([...new Set(missing)], [],
    '⚠️ these POST callers do not poll, so they read the 202 {jobId} as their payload and drop the ' +
    'real result: ' + missing.join(', '));
}
console.log('  every converted route has a polling client caller: OK');

// ── 4. ⚠️ The popover offers cancel for every kind that HAS a server-side job ───────────────────
// v89_ag's finding, kept as a rule rather than an instance: `book` was excluded on reasoning that
// was true of the ROUTE and wrong as a conclusion.
{
  const at = client.indexOf('const canCancel =');
  assert.ok(at > -1, 'the popover computes canCancel');
  const line = client.slice(at, client.indexOf(';', at));
  for (const kind of ['job', 'book'])
    assert.ok(new RegExp(`'${kind}'`).test(line), `kind='${kind}' can be cancelled — it has a server-side job`);
  // `sync` no longer exists (v89_am) and is kept here deliberately: the rule is about ANY kind
  // without a server-side job, so a kind that cannot occur is still the right thing to be safe about.
  for (const kind of ['sync', 'tutor', 'draft'])
    assert.ok(!new RegExp(`'${kind}'`).test(line),
      `kind='${kind}' still cannot — no server-side job to cancel, so a button would be a lie`);
}
console.log('  the popover offers cancel exactly for the kinds that have a server job: OK');

// ── 5. ⚠️ The five v88_al routes are awaited as jobs at EVERY call site ─────────────────────────
// Inherited from `unit-jobs-sync-inflight.test.js` §5 when `v89_am` deleted the dead `kind:'sync'`
// registry that file otherwise tested. Kept because its value never depended on that registry: this
// is a claim about a SET of call sites, which no single rendered state can observe, and a tenth
// caller added later without the poller is exactly what should fail here.
//
// ⚠️ That section had itself been RE-SCOPED once, at `v88_al`, from the OPPOSITE claim — it used to
// assert every caller was inside a `_jobsTracked(...)` wrapper. Both halves are asserted below: the
// poller is present AND the superseded wrapper is absent, because a one-sided check would miss a
// half-migrated call site.
{
  const routes = ['/api/storyline-retitle', '/api/storyline-title', '/api/storyline-summary',
                  '/api/retranslate-story', '/api/writing-feedback'];
  let total = 0;
  for (const route of routes) {
    let from = 0, hits = 0;
    for (;;) {
      const at = client.indexOf(`fetch('${route}'`, from);
      if (at < 0) break;
      hits++; total++;
      const before = client.slice(Math.max(0, at - 400), at);
      assert.ok(before.includes('_jobAwait('),
        `${route} at offset ${at} is awaited as a JOB (_jobAwait), not left blocking`);
      assert.ok(!before.includes('_jobsTracked('),
        `${route} at offset ${at} does not go through the deleted sync-row wrapper`);
      from = at + 1;
    }
    assert.ok(hits > 0, `found at least one caller of ${route}`);
  }
  assert.ok(total >= 9, `non-vacuity: all nine known call sites are covered (found ${total})`);
  console.log(`  the five v88_al routes are awaited as jobs at every call site (${total}): OK`);
}

// ── 6. ⚠️ The dead sync path is GONE, not merely unused ─────────────────────────────────────────
// `v89_am` removed `_jobsTracked`, `_jobsInflight` and the `kind:'sync'` branch. Asserted so the
// cleanup cannot be silently re-introduced — and because a half-removal (the registry gone but the
// branch left, or vice versa) would be worse than either state.
{
  assert.ok(!/^(?!\s*\/\/).*_jobsTracked\s*\(/m.test(client.replace(/^\s*\/\/.*$/gm, '')),
    'no _jobsTracked function or call survives outside comments');
  assert.ok(!/_jobsInflight/.test(client.replace(/^\s*\/\/.*$/gm, '')),
    'and no _jobsInflight registry');
  const at = client.indexOf('function _jobsEffectiveList');
  // ⚠️ Comments stripped first: the function's own note explains that the kind:'sync' branch was
  // removed, and the word appears there. Matching raw source would fail on the very comment that
  // documents the removal — a guard tripping over its own explanation.
  const body = client.slice(at, client.indexOf('\n}', at)).replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/'sync'/.test(body), "and _jobsEffectiveList emits no kind:'sync' rows");
  // ⚠️ Non-vacuity: the TUTOR synthetic entry must still be there. It is a different thing — its
  // source of truth is _tutorState.busy, and it is the only synthetic row carrying a `link`.
  assert.ok(/'__tutor__'/.test(body) && /_tutorState\.busy/.test(body),
    'the tutor synthetic entry SURVIVES — it was never part of the sync registry');
}
console.log('  the dead sync path is removed, and the tutor entry is not: OK');

console.log('unit-job-coverage: ALL PASSED');
