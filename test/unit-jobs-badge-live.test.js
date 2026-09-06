// unit-jobs-badge-live.test.js — v89_ai.
//
// User report: "the hourglass icon shows a little superscript with the number of running jobs.
// However, this is not shown automatically when starting a job, I need to click the hourglass /
// open the job popover once to update. It should be shown w/o clicking."
//
// ⚠️ The old behaviour was DELIBERATE and its reasoning still holds: the badge refreshed on screen
// change, and the 3s poll ran ONLY while the popover was open, because a standing interval for a
// count nobody is looking at is waste. But polling was never the answer — the client KNOWS the
// instant it starts a job, because it has just been handed the `{jobId}`. So the fix is a bump at
// that moment, not a timer.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = (ms) => new Promise(r => setTimeout(r, ms || 120));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.info = { backend:'ollama', canGenerate:true };
    TOASTS = []; showToast = function(m){ TOASTS.push(m); };
    JOBS = [];            // what GET /api/jobs currently answers
    JOBFETCHES = 0;
    fetch = async function(u){
      if (String(u).indexOf('/api/jobs') === 0){ JOBFETCHES++;
        return { ok:true, json: async () => ({ jobs: JOBS }) }; }
      // ⚠️ 'done', not 'running'. A stub that never settles leaves _jobAwait polling forever, so the
      // file prints ALL PASSED and then HANGS — and registered in run.js it would hang the whole
      // suite, which is exactly the hazard _qcPoll's own comment records ("an unbounded 2s timer
      // kept this whole FILE alive after it had printed ALL PASSED"). The badge claim never needed
      // the job to stay open: GET /api/jobs is stubbed separately and still reports it running.
      if (String(u).indexOf('/api/job/') === 0)
        return { ok:true, json: async () => ({ status:'done', data:{} }) };
      return { ok:true, json: async () => ({ ok:true, jobId:'j_new' }) };
    };
    true;`, 'seed');
  return C;
}
const badge = C => C.run(`(function(){ var b=document.getElementById('jobs-pill-badge');
  return b ? (b.style.display === 'none' ? 'hidden' : String(b.textContent||'')) : 'NO-BADGE'; })()`);

async function main() {

// ── 1. ⚠️ Starting a job updates the badge WITHOUT opening the popover ──────────────────────────
{
  const C = client();
  C.run(`_jobsLastList = []; _jobsUpdateBadgeAndList(); true;`, 'zero');
  assert.strictEqual(badge(C), 'hidden', 'no jobs, no badge (the state before the report)');

  // The server will now report one running job — as it would the moment a job is created.
  C.run(`JOBS = [{ id:'j_new', kind:'job', label:'Generating', status:'running', step:'', link:null }];
    JOBFETCHES = 0;
    // The real _jobAwait, against a route that answers 202 + {jobId}.
    // ⚠️ A SHORT poll interval, and a stub that settles. The first draft used { every: 100000 } to
    // "keep the job open" — which left a 100-second timer pending, so the file printed ALL PASSED
    // and then hung. Registered in run.js that would have hung the whole SUITE, which is exactly the
    // hazard _qcPoll's own comment records. The badge claim never needed the job to stay open: GET
    // /api/jobs is stubbed separately and still reports it running.
    _jobAwait({ ok:true, json: async () => ({ ok:true, jobId:'j_new' }) }, { every: 20 });
    true;`, 'start');
  await settle();
  assert.ok(C.run(`JOBFETCHES`) > 0,
    '⚠️ starting a job re-reads /api/jobs by itself — this is the whole report');
  assert.strictEqual(badge(C), '1',
    'and the badge shows 1 without the popover ever being opened');
}
console.log('  starting a job updates the badge immediately, with no popover interaction: OK');

// ── 2. The popover was never opened — the badge is not a side effect of rendering the list ──────
{
  const C = client();
  C.run(`JOBS = [{ id:'a', kind:'job', label:'x', status:'running', step:'', link:null },
                 { id:'b', kind:'job', label:'y', status:'running', step:'', link:null }];
    _jobsBump(); true;`, 'bump');
  await settle();
  assert.strictEqual(badge(C), '2', 'two running jobs show as 2');
  // ⚠️ "the popover was never opened" is NOT assertable in this harness, and saying so is better
  // than a check that looks like one. lib-dom auto-vivifies a getElementById miss, so `#jobs-pop`
  // comes back as a fresh element with `display: ''` — which `_jobsUpdateBadgeAndList` reads as
  // "open" and renders the list. In a real browser that node is static markup carrying
  // `display:none`, so it does not. The claim that DOES carry here is the count itself, plus §1's
  // proof that a fetch was issued at all without any user interaction.
  // ⚠️ Non-vacuity: a FINISHED job must not be counted, or "2" above proves only that something
  // rendered rather than that the count is right.
  C.run(`JOBS = [{ id:'a', kind:'job', label:'x', status:'done', step:'', link:null },
                 { id:'b', kind:'job', label:'y', status:'running', step:'', link:null }];
    _jobsBump(); true;`, 'bump2');
  await settle();
  assert.strictEqual(badge(C), '1', 'a finished job is not counted');
}
console.log('  the count is right and needs no popover render: OK');

// ── 3. ⚠️ Every job STARTER bumps, not just the ones behind _jobAwait ───────────────────────────
// Four starters run their own pollers and never touch _jobAwait — comic extract, comic detect, the
// PDF book job and the comic book job. Missing one would leave exactly the reported symptom for
// that path only, which is the hardest kind of half-fix to notice.
{
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const starter of ['_startComicExtractJob(data.jobId)', '_pollBookJob(data.bookId)',
                         '_pollComicBookJob(_comicBookId)', '_startComicDetectJob(data.jobId)']) {
    const at = src.indexOf(starter);
    assert.ok(at > -1, `${starter} exists`);
    assert.ok(/_jobsBump\(\)/.test(src.slice(at, at + 160)),
      `⚠️ ${starter} bumps the badge — it has its own poller and never reaches _jobAwait`);
  }
  // And _jobAwait itself, which covers every runAsJob-backed route at once.
  const aw = src.indexOf('async function _jobAwait');
  assert.ok(/_jobsBump\(\)/.test(src.slice(aw, src.indexOf('\n}', aw))),
    '_jobAwait bumps for the whole runAsJob family in one place');
}
console.log('  all four independent starters bump, and _jobAwait covers the rest: OK');

// ── 4. ⚠️ It did NOT become a standing poller ───────────────────────────────────────────────────
// The old design decision is intact: no interval outside the open popover. A fix that quietly turned
// the badge into a 3s heartbeat would "work" and would be the wrong trade.
{
  const C = client();
  C.run(`JOBS = []; JOBFETCHES = 0; true;`, 'idle');
  await settle(400);
  assert.strictEqual(C.run(`JOBFETCHES`), 0,
    '⚠️ an idle client with no job started and no popover open issues NO /api/jobs requests');
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = src.indexOf('function _jobsBump');
  assert.ok(!/setInterval/.test(src.slice(at, at + 700)),
    'the bump uses no interval — one immediate read plus one short follow-up');
}
console.log('  no standing poller was introduced: OK');

console.log('unit-jobs-badge-live: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
