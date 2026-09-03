// E2E (live server + fake Ollama): item AU, idle release third (v88_l) — models are freed from VRAM
// after a period with no model use.
//
// User's ruling at v88_l: "release after 30 min idle is ok" — RAISED TO 60 MIN at v88_ai on their
// own follow-up ("Increase idle time before releasing models from 30 min to 60 min"), because a
// model reloaded from cold costs more than the VRAM it was holding on their usage. That window
// is THEIRS, not a default this code
// picked, because the cost is real: releasing means the next generation pays a full model reload,
// which on a 35B model is tens of seconds before the first token. `keep_alive: -1` exists precisely
// to avoid that, so the tradeoff had to be priced by the person whose machine it is.
//
// The window is env-overridable (IDLE_RELEASE_MS) so this test can use a 1.2s one instead of
// sitting for half an hour. That is not a test-only backdoor: a deployment with different habits
// can set it, and 0 disables the sweep entirely.
//
// ⚠️ The claim is NOT "a timer fires". It is that a real `keep_alive: 0` request reaches Ollama —
// the same discriminator e2e-shutdown-release uses, since a release and an ordinary generation are
// otherwise indistinguishable on the wire.
'use strict';
const fs = require('fs');
const { boot, post, get, assert } = require('./lib');

const TINY = 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // A 1.2s idle window and a 1s tick would race; the server's tick is fixed at 60s, so this test
  // drives the DECISION through /api/info-independent means: it asserts the policy via a short
  // window plus a manual wait long enough for one tick is impossible. Instead the sweep is exercised
  // by the shutdown path's own machinery, and the POLICY is asserted directly in unit-idle-policy.
  // What THIS file proves is the end-to-end wiring: with a tiny window, an idle server eventually
  // emits a real release.
  const env = await boot({ log: true, extraEnv: { IDLE_RELEASE_MS: '1200', IDLE_TICK_MS: '300' } });
  let failed = false;
  try {
    const { sport, fport } = env;
    const releases = () => (fs.existsSync(env.logPath)
      ? fs.readFileSync(env.logPath, 'utf8').split('\n').filter(Boolean)
          .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
          .filter(e => e && e.opts && e.opts.keep_alive === 0)
      : []);

    // ── 1. A job that outlives the idle window keeps its models ──────────────────────────────
    // ⚠️ This section was VACUOUS in its first form: it started a job and waited 400ms against a
    // 1.2s window, so it passed because the WINDOW had not elapsed, not because the running-job
    // guard did anything. Removing that guard left it green — caught by mutation, exactly the
    // "ask what the fixture is failing to cover" case.
    //
    // The guard's real scenario is a job that runs LONGER than the window — a 30-minute generation
    // under a 30-minute idle setting — where releasing would pull the models out from under live
    // work. So the fake is told to hold its call open for 3s against a 1.2s window, and the wait
    // deliberately crosses that window while the job is still running.
    const slow = await post(fport, '/__slow', { ms: 3000 });
    assert(slow.status === 200, 'the fake holds model calls open');
    await post(sport, '/api/comic-extract', { images: [TINY], lang: 'nl', extract: true });
    await sleep(2200);            // > the 1.2s idle window, and the job is STILL running
    const during = await get(sport, '/api/jobs');
    assert((during.body.jobs || []).some(j => j.status === 'running'),
      'the job really is still running at this point (non-vacuity for the guard itself)');
    assert(releases().length === 0,
      'nothing is released while a job is running, even though the idle window has elapsed — '
      + 'without this guard a long generation loses its models mid-run');
    await post(fport, '/__slow', { ms: 0 });   // let everything else run at normal speed
    console.log('  a job outliving the idle window keeps its models: OK');

    // ── 2. Once idle past the window, the models are freed ────────────────────────────────────
    const t0 = Date.now();
    let freed = [];
    while (Date.now() - t0 < 12000) {
      freed = [...new Set(releases().map(r => r.opts.model))];
      if (freed.length) break;
      await sleep(200);
    }
    assert(freed.length > 0,
      'an idle server eventually releases its models — this is the whole item (waited '
      + Math.round((Date.now() - t0) / 1000) + 's with a 1.2s window)');
    console.log('  an idle server frees its models: OK (' + freed.join(', ') + ')');

    // ── 3. It does NOT keep re-releasing every tick while still idle ──────────────────────────
    // A sweep that fires forever would hammer a backend that has nothing left to free.
    {
      const before = releases().length;
      await sleep(1500);
      const after = releases().length;
      assert(after === before,
        'a still-idle server does not release again on every tick (got ' + before + ' -> ' + after + ')');
      console.log('  it releases once, not on every tick while still idle: OK');
    }

    // ── 4. New work RE-ARMS the sweep ─────────────────────────────────────────────────────────
    // Without this the server would free its models once and never again for the rest of its life.
    {
      const before = releases().length;
      await post(sport, '/api/comic-extract', { images: [TINY], lang: 'nl', extract: true });
      await sleep(400);
      const t1 = Date.now();
      let after = before;
      while (Date.now() - t1 < 12000) {
        after = releases().length;
        if (after > before) break;
        await sleep(200);
      }
      assert(after > before,
        'after new model use, going idle again releases again — the sweep re-arms (got '
        + before + ' -> ' + after + ')');
      console.log('  new work re-arms the sweep: OK');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-idle-release: FAILED' : 'e2e-idle-release: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
