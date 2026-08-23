// unit-stamp-updated.test.js
// stampUpdated() guarantees `updatedAt` strictly ADVANCES on every call, even when two saves for
// the same record land within the same wall-clock millisecond — which `new Date().toISOString()`
// alone cannot tell apart. Root cause of a flake `e2e-lesson-edit-roundtrip` reconfirmed as
// "pre-existing, load-shaped" three releases running (v82_c, v82_e, v82_g) without being diagnosed:
// its own non-vacuity check (`after.updatedAt !== before`) is exactly the property this guards.
//
// Why a dedicated unit test, not just trusting the e2e flake staying quiet: a fix that merely
// LOWERS the collision probability could pass 35 lucky standalone runs (as this one did, post-fix)
// while still being wrong under real contention. This test forces the exact collision — two calls
// with `Date.now()` pinned to the identical millisecond — so the property is proven, not hoped for.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(name) {
  const at = server.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing ' + name);
  const b = server.indexOf('{', at); let d = 0, i = b;
  for (; i < server.length; i++) { const c = server[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}
const stampUpdated = new Function('return ' + ext('stampUpdated'))();

// ── 1. The forced collision: two calls, Date.now() pinned to the SAME millisecond ────────────
{
  const FIXED = Date.parse('2026-01-01T00:00:00.000Z');
  const origNow = Date.now;
  Date.now = () => FIXED;
  try {
    const rec = {};
    stampUpdated(rec);
    const first = rec.updatedAt;
    stampUpdated(rec);   // Date.now() returns the IDENTICAL value again — the exact flake trigger
    const second = rec.updatedAt;
    assert.ok(first && second, 'both calls set updatedAt');
    assert.notStrictEqual(first, second,
      'a second stamp in the SAME millisecond still strictly advances updatedAt (got ' + first + ' twice)');
    assert.ok(Date.parse(second) > Date.parse(first), 'and the advance is FORWARD in time');
    // A third call, same pinned millisecond again, must advance once more — not just "differ from
    // the first" by accident of only comparing two values.
    stampUpdated(rec);
    assert.ok(Date.parse(rec.updatedAt) > Date.parse(second), 'a third same-millisecond call advances again');
  } finally {
    Date.now = origNow;
  }
}
console.log('  same-millisecond collision: updatedAt strictly advances on every call: OK');

// ── 2. The common case: real time gaps are NOT overridden — no artificial clock skew ─────────
{
  const rec = {};
  stampUpdated(rec);
  const first = Date.parse(rec.updatedAt);
  const realNow = Date.now();
  // A later real stamp should reflect the ACTUAL time, not the previous value + 1ms, when the two
  // are genuinely far apart — the +1ms bump is a same-millisecond fallback, not the normal path.
  const origNow = Date.now;
  Date.now = () => realNow + 5000;
  try {
    stampUpdated(rec);
    assert.ok(Date.parse(rec.updatedAt) >= realNow + 5000,
      'a real 5-second gap is reflected as-is, not clamped to prev+1ms');
  } finally { Date.now = origNow; }
}
console.log('  a real time gap is not overridden by the collision guard: OK');

// ── 3. A brand-new record (no prior updatedAt) is stamped with the current time, not 1970 ────
{
  const rec = { updatedAt: undefined };
  const before = Date.now();
  stampUpdated(rec);
  assert.ok(Date.parse(rec.updatedAt) >= before, 'first-ever stamp uses "now", not a prev-based fallback');
}
console.log('  a fresh record (no prior updatedAt) stamps "now": OK');

// ── 4. A null/undefined record is a no-op, not a throw — every call site passes a real object,
//    but defensive callers (or a future one) should not crash on a not-found lookup.
{
  assert.strictEqual(stampUpdated(null), null, 'null is handled without throwing');
  assert.strictEqual(stampUpdated(undefined), null, 'undefined is handled without throwing');
}
console.log('  null/undefined records are a safe no-op: OK');

// ── 5. Every real call site uses the shared helper, not a re-inlined new Date().toISOString() ──
// The whole point is ONE choke point — a site that reverts to the raw pattern silently reopens the
// same collision this file exists to close.
{
  const rawSites = (server.match(/\.updatedAt\s*=\s*new Date\(\)\.toISOString\(\)/g) || []).length;
  assert.strictEqual(rawSites, 0,
    'no call site stamps updatedAt directly any more — all route through stampUpdated()');
  const helperCalls = (server.match(/\bstampUpdated\(/g) || []).length;
  assert.ok(helperCalls >= 10, `stampUpdated is actually called from real sites (found ${helperCalls} references)`);
}
console.log('  every updatedAt write site routes through the shared helper: OK');

console.log('unit-stamp-updated: ALL PASSED');
