// unit-llm-timeout-handle.test.js
// v53_c: `_callOllama` guarded its request with
//     Promise.race([call, new Promise((_,rej)=>setTimeout(rej, OLLAMA_TIMEOUT))])
// and never cleared the losing timer. An un-cleared setTimeout keeps the libuv event loop alive, so
// every CLI script that ends after a successful call (translate-ui.js, generate-lessons.js,
// translate-lessons.js, qc-lessons.js) sat idle for the REMAINDER of OLLAMA_TIMEOUT — 12 minutes by
// default — before exiting. Reported as "translate-ui.json doesn't end when finished".
// Guards: (a) the race clears its timer, (b) the pattern that caused it cannot come back.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');

// (a) Source-level: the timer handle is captured and cleared.
assert.ok(/clearTimeout\(_guardTimer\)/.test(llm), 'the race clears its losing timer');
assert.ok(/_guardTimer\.unref\(\)/.test(llm), 'the guard timer is unref\'d as a second line of defence');
assert.ok(!/Promise\.race\(\[call,\s*\n?\s*new Promise\(\(_, reject\) => setTimeout\(/.test(llm),
  'the old leaking inline-setTimeout race is gone');

// Any setTimeout used as a rejection guard must be reachable for clearing (assigned, not inline).
const inlineRaceGuards = llm.match(/Promise\.race\(\[[^\]]*new Promise\([^)]*setTimeout\(/g) || [];
assert.strictEqual(inlineRaceGuards.length, 0,
  'no Promise.race guard uses an unreachable inline setTimeout');

// (b) Behavioural: reproduce both shapes and prove the fixed one lets the loop drain.
// We spy on setTimeout to capture the handles, because the leaky shape by definition leaves a live
// 10-minute timer behind — this test would otherwise hang exactly the way translate-ui.js did.
function makeSpy() {
  const created = [];
  const real = global.setTimeout;
  global.setTimeout = (fn, ms, ...a) => { const h = real(fn, ms, ...a); created.push(h); return h; };
  return { created, restore: () => { global.setTimeout = real; } };
}
const live = () => process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;

function leaky(ms) {                                    // the pre-v53_c shape
  const call = new Promise(res => setTimeout(() => res('ok'), 5));
  return Promise.race([call, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
function fixed(ms) {                                    // the shape llm.js now uses
  const call = new Promise(res => setTimeout(() => res('ok'), 5));
  let t;
  const guard = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); if (t.unref) t.unref(); });
  return Promise.race([call, guard]).finally(() => clearTimeout(t));
}

(async () => {
  const spy = makeSpy();

  const before = live();
  assert.strictEqual(await leaky(600000), 'ok', 'leaky race still resolves');
  const afterLeaky = live();
  assert.ok(afterLeaky > before,
    'the OLD shape leaves a live timer behind (this is what held the process open for OLLAMA_TIMEOUT)');

  const midpoint = spy.created.length;
  assert.strictEqual(await fixed(600000), 'ok', 'fixed race still resolves');
  // Only the fixed call's own guard should have been cleared; the leaked one is still ticking.
  assert.strictEqual(live(), afterLeaky, 'the NEW shape adds no lingering timer of its own');

  // The fixed guard still rejects when the call really is slow.
  let rejected = false;
  const slow = new Promise(res => setTimeout(res, 200));
  let t2;
  const g2 = new Promise((_, rej) => { t2 = setTimeout(() => rej(new Error('Ollama timeout')), 20); });
  await Promise.race([slow, g2]).finally(() => clearTimeout(t2)).catch(e => { rejected = /timeout/i.test(e.message); });
  assert.ok(rejected, 'the guard still fires when the call exceeds the timeout');

  // Clean up the deliberately-leaked timer, or THIS test hangs for 10 minutes — which is precisely
  // the bug under guard.
  spy.created.forEach(h => clearTimeout(h));
  spy.restore();
  assert.ok(midpoint > 0, 'spy captured the timers');

  console.log('  llm.js race guard: timer cleared, no lingering handle, still times out: OK');
  console.log('unit-llm-timeout-handle: ALL PASSED');
})();
