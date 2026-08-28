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
{
  const C = client();
  let resolveFetch;
  C.run(`APP.info = { canGenerate:true };
    fetch = function(){ return new Promise(res => { window._resolveFetch = res; }); };
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

console.log('unit-analyze-chapters-run: ALL PASSED');
}

main().catch(err => { console.error(err); process.exit(1); });
