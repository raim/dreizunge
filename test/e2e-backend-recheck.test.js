// E2E: the server RE-DETECTS its backend instead of deciding once at startup (user request).
//
// Reported twice by the user, the second time as "any idea why the continue story buttons have
// disappeared?": the server had been started while Ollama was not up, printed "not found — offline
// mode", and stayed offline for the whole session even after Ollama was running. Every
// generation-gated control vanishes client-side when `canGenerate` is false, so it reads as broken
// buttons rather than as a state. `pingOllama()` had exactly ONE call site in server.js and `active`
// was never revisited.
//
// This boots a server pointed at a port with NOTHING on it, then starts a stand-in backend there and
// watches the server heal — the actual reported scenario, end to end, through /api/info.
const { boot, get, assert, sleep } = require('./lib');
const http = require('http');

const PING_PORT = 19731;   // nothing listens here when the server starts

function startFakeBackend(port) {
  return new Promise(resolve => {
    const srv = http.createServer((q, r) => {
      r.writeHead(200, { 'Content-Type': 'application/json' });
      r.end(JSON.stringify({ models: [] }));      // what /api/tags returns; ping only checks < 500
    });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}
async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return true;
    await sleep(1000);
  }
  throw new Error('timed out waiting for: ' + label);
}
const canGenerate = async sport => {
  const r = await get(sport, '/api/info');
  return !!(r.body && r.body.canGenerate);
};

(async () => {
  // OLLAMA_HOST points at a dead port, so startup detection must land on offline — the exact state
  // the user was stuck in.
  // A fast cadence so the loop is exercised in seconds. Without it §4 below is VACUOUS — its wait
  // was shorter than the 15s default, so removing the LLM_BACKEND=none guard left it GREEN (found by
  // mutation-testing, which is the only reason this knob exists).
  const FAST = { BACKEND_RECHECK_OFFLINE_MS: '400', BACKEND_RECHECK_ONLINE_MS: '400' };
  const env = await boot({ extraEnv: { OLLAMA_HOST: 'http://127.0.0.1:' + PING_PORT, ...FAST } });
  let fake = null;
  try {
    const { sport } = env;

    // ── 1. Startup with no backend: offline, as before ──────────────────────
    assert(!(await canGenerate(sport)), 'starts offline when nothing answers the ping');
    assert(/not found — offline mode/.test(env.srvlog()), 'and says so on the console');
    console.log('  starts offline when the backend is not up: OK');

    // ── 2. ⚠️ THE FIX: the backend appears LATE and the server notices on its own ──
    // Before this, `active` was set once at boot and there was no second ping — the server stayed
    // offline until restarted, which is the whole complaint.
    fake = await startFakeBackend(PING_PORT);
    await waitFor(() => canGenerate(sport), 20000, 'the server to re-detect the backend');
    assert(await canGenerate(sport), 'canGenerate flipped to true without a restart');
    assert(/reachable again/.test(env.srvlog()),
      'and the transition is logged once, so an operator can see it happened');
    console.log('  a late-starting backend is picked up automatically, no restart: OK');

    // ── 3. Logged ONLY on a transition — a healthy server does not print every poll ──
    {
      const before = (env.srvlog().match(/reachable again/g) || []).length;
      await sleep(3000);
      const after = (env.srvlog().match(/reachable again/g) || []).length;
      assert(after === before,
        'no repeat logging while it stays healthy (got ' + before + ' → ' + after + ') — a line ' +
        'every poll would bury the console');
      console.log('  no log spam while healthy: OK');
    }

  } finally {
    if (fake) fake.close();
    await env.stop();
  }

  // ⚠️ Run AFTER the first server is stopped, NOT nested inside it: lib.js's boot() derives its port
  // from the process id, so two servers booted in one test process collide — the second fails to
  // bind and every request silently reaches the FIRST one. Cost a real debugging detour here (this
  // section "failed" while the code was correct, because it was querying the already-healed server).
  // ── 4. An explicitly disabled backend is NEVER revisited ─────────────────
  // LLM_BACKEND=none is an operator choice to run without a model, not a detection result — the
  // re-check must never override the configuration.
  //
  // ⚠️ HONEST NOTE about what this proves. TWO independent guards enforce it: server.js declines to
  // schedule the loop at all, and llm.js's `ping()` returns false unless BACKEND === 'ollama'. So
  // mutating EITHER one alone leaves this section green — confirmed by trying it. That is not a
  // vacuous test: the CLAIM (a disabled backend never comes back online, even with something
  // answering on its port) is real, observable, and asserted here against a live stand-in backend.
  // It simply cannot attribute the behaviour to one guard, and neither should a reader.
  {
    // ⚠️ The backend must be UP for this to prove anything: with nothing listening, a server whose
    // guard had been REMOVED would still report offline and this would pass regardless. Found by
    // mutation-testing twice — first the wait was shorter than the 15s default poll (hence FAST),
    // then the fake backend had already been closed by the finally block above.
    const fake2 = await startFakeBackend(PING_PORT);
    const off = await boot({ extraEnv: { LLM_BACKEND: 'none', OLLAMA_HOST: 'http://127.0.0.1:' + PING_PORT, ...FAST } });
    try {
      assert(!(await canGenerate(off.sport)), 'LLM_BACKEND=none starts offline');
      await sleep(3000);   // MANY re-check cycles at the fast cadence, and the backend IS answering
      assert(!(await canGenerate(off.sport)),
        'and STAYS offline even though the backend is reachable — configuration beats detection');
      assert(!/reachable again/.test(off.srvlog()), 'and it never even logs a transition');
    } finally { await off.stop(); fake2.close(); }
    console.log('  LLM_BACKEND=none is never overridden by re-detection: OK');
  }

  console.log('e2e-backend-recheck: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
