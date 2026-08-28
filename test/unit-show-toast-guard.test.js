// unit-show-toast-guard.test.js — v86_i.
//
// Found while investigating a live report of a "missing" toast (comic-detect's own partial-drop
// warning, v86_d): showToast()'s own null-guard checked `t` (the global translate function, ALWAYS
// truthy — a dead no-op) instead of `toastEl`, the element it had just looked up two words earlier.
// Harmless in practice (#toast is static markup, always present in the DOM — this is why it was
// never the actual cause of that live report), but genuinely wrong: if #toast were ever
// conditionally absent, the ORIGINAL bug would throw on the very next line (`toastEl.textContent`
// on null) instead of the intended silent no-op. Fixed to check `toastEl` itself.
'use strict';
const assert = require('assert');
const { loadClient } = require('./lib-dom');

const C = loadClient({ quiet: true });

// ── 1. The happy path still works (regression check) ───────────────────────
{
  const r = JSON.parse(C.run(`
    showToast('hello');
    const el = document.getElementById('toast');
    JSON.stringify({ text: el.textContent, hasShowClass: el.classList.contains('show') })`));
  assert.strictEqual(r.text, 'hello', 'showToast sets the toast element\'s text');
  assert.strictEqual(r.hasShowClass, true, 'showToast adds the "show" class');
}
console.log('  showToast(): sets text and shows the toast (happy path unaffected): OK');

// ── 2. The guard checks the ELEMENT it looked up, not something unrelated — mutation-tested ──
{
  // Simulate #toast being absent (the ORIGINAL bug's own untested branch) — must be a clean no-op,
  // not a throw. This is the actual behavioural claim the fix makes; the harness's #toast is static
  // markup and always present, so removing it here is the only way to exercise this branch at all.
  const threw = C.run(`
    const origGetById = document.getElementById.bind(document);
    document.getElementById = function(id){ return id === 'toast' ? null : origGetById(id); };
    let threwFlag = false;
    try { showToast('should not throw'); } catch(e) { threwFlag = true; }
    document.getElementById = origGetById;
    JSON.stringify(threwFlag)`);
  assert.strictEqual(JSON.parse(threw), false, 'showToast() does not throw when #toast is absent (guard present, checks the right variable)');
}
console.log('  showToast(): does not throw when #toast is absent — the guard checks the element itself: OK');

console.log('unit-show-toast-guard: ALL PASSED');
