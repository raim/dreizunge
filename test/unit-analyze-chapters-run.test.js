// unit-analyze-chapters-run.test.js
// Item W follow-up (v86_p, user-requested): analyzeChaptersRun() — the "batch curator trigger"
// companion to qcRun(), reachable from the library/storyline cards' new 🔤 button (NOT 🔍 — that's
// QC's own icon on the SAME row, the user's own explicit reason for a different icon here).
//
// Contract under test:
//   1. No backend (APP.info.canGenerate:false) -> a "no backend" toast, ZERO fetch calls.
//   2. An empty chapter-id array -> a silent no-op (no fetch, no toast) — covers both the storyline
//      button (data-chain could theoretically decode to []) and defensive misuse.
//   3. One fetch to /api/analyze-chapter/:id PER chapter id, in the array's own order; a
//      `cached:true` response counts as "cached", anything else (a real 202+jobId) counts as
//      "queued" — proven via the real toast text carrying both real numbers.
//   4. A non-ok response for ONE chapter does not abort the batch — the rest still fire, and it
//      counts as "failed", surfaced in the toast.
//   5. The button is disabled + shows an hourglass DURING the run, and is restored to its EXACT
//      original state (not just re-enabled) once it finishes.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

function client() {
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    window._toasts = []; showToast = function(msg){ window._toasts.push(msg); };
    true;`, 'seed');
  return C;
}

async function main() {

// ── 1. No backend: a toast, zero fetch calls ────────────────────────────────
{
  const C = client();
  C.run(`APP.info = { canGenerate:false };
    window._fetchCalls = []; fetch = function(u){ window._fetchCalls.push(u); return Promise.reject(new Error('should not be called')); };
    (async()=>{ await analyzeChaptersRun(['tp_a','tp_b'], null); })();
    true;`, 't1');
  await new Promise(r => setTimeout(r, 30));
  const r = JSON.parse(C.run('JSON.stringify({ toasts: window._toasts, fetchCalls: window._fetchCalls })'));
  assert.strictEqual(r.fetchCalls.length, 0, 'no backend -> zero fetch calls, not even the first chapter');
  assert.ok(r.toasts.length === 1, `exactly one toast shown (got ${JSON.stringify(r.toasts)})`);
}
console.log('  analyzeChaptersRun(): no backend -> a toast, zero fetch calls: OK');

// ── 2. Empty chapter-id array: silent no-op ─────────────────────────────────
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._fetchCalls = []; fetch = function(u){ window._fetchCalls.push(u); return Promise.resolve({ ok:true, json:()=>Promise.resolve({}) }); };
    (async()=>{ await analyzeChaptersRun([], null); })();
    true;`, 't2');
  await new Promise(r => setTimeout(r, 30));
  const r = JSON.parse(C.run('JSON.stringify({ toasts: window._toasts, fetchCalls: window._fetchCalls })'));
  assert.strictEqual(r.fetchCalls.length, 0, 'an empty id array makes no fetch calls at all');
  assert.strictEqual(r.toasts.length, 0, 'an empty id array shows no toast either — a true no-op');
}
console.log('  analyzeChaptersRun(): an empty chapter-id array is a silent no-op: OK');

// ── 3. One fetch PER chapter, in order; cached vs queued tallied correctly ──
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._fetchCalls = [];
    fetch = function(u, opts){
      window._fetchCalls.push(u);
      if(u.endsWith('tp_cached')) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ cached:true, available:true }) });
      return Promise.resolve({ ok:true, json:()=>Promise.resolve({ jobId:'j_'+u }) });
    };
    (async()=>{ await analyzeChaptersRun(['tp_new1','tp_cached','tp_new2'], null); })();
    true;`, 't3');
  await new Promise(r => setTimeout(r, 60));
  const r = JSON.parse(C.run('JSON.stringify({ toasts: window._toasts, fetchCalls: window._fetchCalls })'));
  assert.deepStrictEqual(r.fetchCalls, [
    '/api/analyze-chapter/tp_new1', '/api/analyze-chapter/tp_cached', '/api/analyze-chapter/tp_new2',
  ], `one POST per chapter, in the SAME order the array was given (got ${JSON.stringify(r.fetchCalls)})`);
  assert.strictEqual(r.toasts.length, 1, 'exactly one summary toast, not one per chapter');
  assert.ok(r.toasts[0].includes('2') && r.toasts[0].includes('1'),
    `the toast carries the REAL tally — 2 queued (new jobs), 1 already cached (got "${r.toasts[0]}")`);
}
console.log('  analyzeChaptersRun(): one fetch per chapter in order, cached vs. queued correctly tallied in the toast: OK');

// ── 4. One chapter fails, the rest still fire — not aborted, counted as failed ──
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._fetchCalls = [];
    fetch = function(u){
      window._fetchCalls.push(u);
      if(u.endsWith('tp_bad')) return Promise.resolve({ ok:false, status:404, json:()=>Promise.resolve({ error:'no such chapter' }) });
      return Promise.resolve({ ok:true, json:()=>Promise.resolve({ jobId:'j' }) });
    };
    (async()=>{ await analyzeChaptersRun(['tp_ok1','tp_bad','tp_ok2'], null); })();
    true;`, 't4');
  await new Promise(r => setTimeout(r, 60));
  const r = JSON.parse(C.run('JSON.stringify({ toasts: window._toasts, fetchCalls: window._fetchCalls })'));
  assert.strictEqual(r.fetchCalls.length, 3, `all 3 chapters were attempted — one failure does not abort the batch (got ${r.fetchCalls.length})`);
  assert.ok(r.toasts[0].includes('1') && /failed/i.test(r.toasts[0]),
    `the toast surfaces the 1 failure explicitly, not silently (got "${r.toasts[0]}")`);
}
console.log('  analyzeChaptersRun(): one failed chapter does not abort the rest, and is surfaced in the toast: OK');

// ── 5. The button is disabled mid-run and restored to its EXACT original state after ──
// A single-id call also fires the v86_ac pre-check GET first (see §6-9 below) — respond to it
// immediately with {available:false} so this test's own controllable pending promise is the POST,
// exactly as before that fix.
{
  const C = client();
  let resolveFetch;
  C.run(`APP.info = { canGenerate:true };
    fetch = function(u){
      if(u.indexOf('/api/analysis/') === 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ available:false }) });
      return new Promise(res => { window._resolveFetch = res; });
    };
    document.getElementById('fake-btn').innerHTML = '🔤';
    window._runPromise = analyzeChaptersRun(['tp_a'], document.getElementById('fake-btn'));
    true;`, 't5-start');
  await new Promise(r => setTimeout(r, 20));
  const mid = JSON.parse(C.run(`JSON.stringify({ disabled: document.getElementById('fake-btn').disabled, html: document.getElementById('fake-btn').innerHTML })`));
  assert.strictEqual(mid.disabled, true, 'the button is disabled WHILE the batch is running');
  assert.strictEqual(mid.html, '⏳', 'the button shows an hourglass while running');
  C.run(`window._resolveFetch({ ok:true, json:()=>Promise.resolve({ jobId:'j' }) }); true;`, 't5-resolve');
  await new Promise(r => setTimeout(r, 30));
  const after = JSON.parse(C.run(`JSON.stringify({ disabled: document.getElementById('fake-btn').disabled, html: document.getElementById('fake-btn').innerHTML })`));
  assert.strictEqual(after.disabled, false, 'the button is re-enabled once the batch finishes');
  assert.strictEqual(after.html, '🔤', 'the button\'s ORIGINAL icon is restored, not left as the hourglass');
}
console.log('  analyzeChaptersRun(): the button is disabled+hourglassed mid-run, restored exactly after: OK');

// ── 6-9. v86_ac: a SINGLE-chapter call doubles as "re-analyze", gated by confirm() ──────────
// User: "I expected to be able to generate the text analysis annotation on the lesson-set card...
// there should be a way to re-generate it... we can just use the same button, but reroute via a
// warning that this would override an existing text annotation."

// 6. Not yet analysed (available:false): no confirm() prompt at all, POST sent WITHOUT force.
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._confirmCalls = 0; confirm = function(){ window._confirmCalls++; return true; };
    window._fetchCalls = [];
    fetch = function(u, opts){
      window._fetchCalls.push({ u, body: opts && opts.body });
      if(u.indexOf('/api/analysis/') === 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ available:false }) });
      return Promise.resolve({ ok:true, json:()=>Promise.resolve({ jobId:'j' }) });
    };
    (async()=>{ await analyzeChaptersRun(['tp_new'], null); })();
    true;`, 't6');
  await new Promise(r => setTimeout(r, 40));
  const r = JSON.parse(C.run('JSON.stringify({ confirmCalls: window._confirmCalls, fetchCalls: window._fetchCalls, toasts: window._toasts })'));
  assert.strictEqual(r.confirmCalls, 0, 'a never-before-analysed chapter never triggers the confirm() prompt');
  assert.deepStrictEqual(r.fetchCalls.map(c => c.u), ['/api/analysis/tp_new', '/api/analyze-chapter/tp_new'],
    'the pre-check GET, then the POST, in that order');
  assert.strictEqual(r.fetchCalls[1].body, '{}', 'a first-time run posts an empty body — no force flag');
  assert.strictEqual(r.toasts.length, 1, 'the run completes normally, with its usual summary toast');
}
console.log('  analyzeChaptersRun(): a not-yet-analysed single chapter skips confirm() entirely, posts without force: OK');

// 7. Already analysed (available:true) + user CONFIRMS: POST sent WITH force:true.
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._confirmCalls = 0; confirm = function(){ window._confirmCalls++; return true; };
    window._fetchCalls = [];
    fetch = function(u, opts){
      window._fetchCalls.push({ u, body: opts && opts.body });
      if(u.indexOf('/api/analysis/') === 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ available:true }) });
      return Promise.resolve({ ok:true, json:()=>Promise.resolve({ jobId:'j' }) });
    };
    (async()=>{ await analyzeChaptersRun(['tp_old'], null); })();
    true;`, 't7');
  await new Promise(r => setTimeout(r, 40));
  const r = JSON.parse(C.run('JSON.stringify({ confirmCalls: window._confirmCalls, fetchCalls: window._fetchCalls, toasts: window._toasts })'));
  assert.strictEqual(r.confirmCalls, 1, 'an already-analysed chapter DOES trigger exactly one confirm() prompt');
  assert.strictEqual(r.fetchCalls[1].body, JSON.stringify({ force: true }), 'confirming re-analysis posts {force:true}, overriding the cache-hit short-circuit');
  assert.strictEqual(r.toasts.length, 1, 'a confirmed re-analysis completes normally, with its usual summary toast');
}
console.log('  analyzeChaptersRun(): an already-analysed single chapter confirms before posting {force:true}: OK');

// 8. Already analysed + user DECLINES: NO POST at all, button restored, no toast — a true cancel.
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    confirm = function(){ return false; };
    window._fetchCalls = [];
    fetch = function(u, opts){
      window._fetchCalls.push(u);
      if(u.indexOf('/api/analysis/') === 0) return Promise.resolve({ ok:true, json:()=>Promise.resolve({ available:true }) });
      return Promise.resolve({ ok:true, json:()=>Promise.resolve({ jobId:'j' }) });
    };
    document.getElementById('fake-btn').innerHTML = '🔤';
    window._runPromise = analyzeChaptersRun(['tp_old'], document.getElementById('fake-btn'));
    true;`, 't8');
  await new Promise(r => setTimeout(r, 40));
  const r = JSON.parse(C.run(`JSON.stringify({ fetchCalls: window._fetchCalls, toasts: window._toasts,
    disabled: document.getElementById('fake-btn').disabled, html: document.getElementById('fake-btn').innerHTML })`));
  assert.deepStrictEqual(r.fetchCalls, ['/api/analysis/tp_old'], 'declining the confirm makes NO /api/analyze-chapter call at all — a true cancel, not a soft force:false run');
  assert.strictEqual(r.toasts.length, 0, 'declining shows no summary toast either — silent cancel');
  assert.strictEqual(r.disabled, false, 'the button is still restored (re-enabled) after a declined confirm');
  assert.strictEqual(r.html, '🔤', 'the button\'s original icon is restored after a declined confirm too');
}
console.log('  analyzeChaptersRun(): declining the re-analyze confirm makes no server call, restores the button, shows no toast: OK');

// 9. A BATCH call (length > 1) never confirms, even when every chapter is already analysed —
//    asking once per chapter would be intrusive; a batch run's job is "fill in what's missing."
{
  const C = client();
  C.run(`APP.info = { canGenerate:true };
    window._confirmCalls = 0; confirm = function(){ window._confirmCalls++; return true; };
    window._fetchCalls = [];
    fetch = function(u){ window._fetchCalls.push(u); return Promise.resolve({ ok:true, json:()=>Promise.resolve({ cached:true, available:true }) }); };
    (async()=>{ await analyzeChaptersRun(['tp_c1','tp_c2'], null); })();
    true;`, 't9');
  await new Promise(r => setTimeout(r, 40));
  const r = JSON.parse(C.run('JSON.stringify({ confirmCalls: window._confirmCalls, fetchCalls: window._fetchCalls })'));
  assert.strictEqual(r.confirmCalls, 0, 'a multi-chapter batch never calls confirm(), regardless of cache state');
  assert.deepStrictEqual(r.fetchCalls, ['/api/analyze-chapter/tp_c1', '/api/analyze-chapter/tp_c2'],
    'no pre-check GET at all for a batch call — straight to the POST for each chapter, as before v86_ac');
}
console.log('  analyzeChaptersRun(): a multi-chapter batch call never confirms and never pre-checks — unchanged batch semantics: OK');

console.log('unit-analyze-chapters-run: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
