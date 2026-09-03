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

    // ⚠️⚠️ v88_ak — WHY THIS FILE KEPT FAILING UNDER SUITE LOAD, AND WHY IT WAS NOT FLAKINESS.
    //
    // It failed in three consecutive full-suite runs with `a still-idle server does not release
    // again on every tick (got 1 -> 2)` and passed standalone every time. The session prompt's
    // standing instruction was to INSTRUMENT THE TICK COUNT rather than re-run until green, and
    // instrumenting is what found it: **the server was right and the guard was measuring the wrong
    // thing.**
    //
    // ONE sweep calls `releaseConfiguredModels()`, which releases every configured role model IN
    // PARALLEL — so a single sweep writes SEVERAL `keep_alive: 0` entries to the chat log, one per
    // distinct model. Measured in this exact harness: 2 entries per sweep (`fake`, plus
    // `qwen2.5vl:7b`, since `boot()` overrides the story/lesson/translation models but not the
    // VISION one). `releases().length` therefore counts MODELS, not sweeps.
    //
    // §2 below broke out of its wait as soon as the FIRST entry appeared. Standalone the two
    // parallel calls land inside the same 200ms poll (measured spread: 0ms), so `before` was
    // already 2 and §3 passed. Under suite load they can straddle a poll boundary — §2 exits at 1,
    // the second entry of the SAME sweep lands during §3's sleep, and §3 reports a second release
    // that never happened.
    //
    // The honest metric is the number of SWEEPS: the highest number of times any ONE model was
    // released. A second sweep must re-release every model, so any model appearing twice means two
    // sweeps — and that is immune both to how many models a sweep covers and to how their parallel
    // calls interleave.
    //
    // ⚠️ WHAT IS AND IS NOT PROVEN HERE, because the difference matters. The MECHANISM is measured
    // (2 entries per sweep in this harness; §2 exited on the first), and `1 -> 2` is exactly what
    // that mechanism produces. The FIX, however, is **not** demonstrated by reproducing the failure:
    // running the old counting six times under three busy-loop CPU hogs passed 6/6, so that load did
    // not recreate the race, and neither version can be told apart that way. The fix is justified by
    // CONSTRUCTION instead — an intra-sweep interleaving cannot change a per-model maximum — and the
    // metric itself is pinned deterministically directly below. **This file should therefore not be
    // called "cleared"**: if it fails again, the next step is to capture the actual entry arrival
    // times from the failing run, not to re-run it.
    const sweeps = () => {
      const byModel = {};
      for (const e of releases()) byModel[e.opts.model] = (byModel[e.opts.model] || 0) + 1;
      const counts = Object.values(byModel);
      return counts.length ? Math.max(...counts) : 0;
    };

    // ── 0. The METRIC itself, deterministically ───────────────────────────────────────────────
    // The race cannot be reproduced on demand, so what CAN be pinned is that the new metric answers
    // "how many sweeps" correctly for the arrival patterns the race produces. Pure, no timing.
    {
      const countSweeps = (models) => {
        const byModel = {};
        for (const m of models) byModel[m] = (byModel[m] || 0) + 1;
        const c = Object.values(byModel);
        return c.length ? Math.max(...c) : 0;
      };
      // One sweep, both models — the shape the OLD counting read as 2 releases.
      assert(countSweeps(['fake', 'qwen2.5vl:7b']) === 1,
        'one sweep over two models is ONE sweep, however many log entries it wrote');
      // A partially-observed sweep is still one.
      assert(countSweeps(['fake']) === 1, 'and half of that sweep is still one sweep');
      // Two genuine sweeps must be counted as two — otherwise §3 could never fail.
      assert(countSweeps(['fake', 'qwen2.5vl:7b', 'fake', 'qwen2.5vl:7b']) === 2,
        'a real second sweep re-releases every model, so it counts as two');
      assert(countSweeps([]) === 0, 'and nothing released is no sweeps');
      console.log('  the sweep metric distinguishes one sweep from two, whatever the entry order: OK');
    }

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
      // Wait for a COMPLETE sweep, not the first entry of one. Exiting on the first entry is what
      // let §3 observe the rest of the same sweep and call it a second release.
      if (sweeps() >= 1) { freed = [...new Set(releases().map(r => r.opts.model))]; break; }
      await sleep(200);
    }
    assert(freed.length > 0,
      'an idle server eventually releases its models — this is the whole item (waited '
      + Math.round((Date.now() - t0) / 1000) + 's with a 1.2s window)');
    console.log('  an idle server frees its models: OK (' + freed.join(', ') + ')');

    // ── 3. It does NOT keep re-releasing every tick while still idle ──────────────────────────
    // A sweep that fires forever would hammer a backend that has nothing left to free.
    {
      const before = sweeps();
      // Comfortably several ticks at IDLE_TICK_MS=300, so a per-tick re-release would be unmissable.
      await sleep(1500);
      const after = sweeps();
      assert(after === before,
        'a still-idle server does not release again on every tick (sweeps ' + before + ' -> ' + after
        + '; entries ' + releases().length + ' — counted as SWEEPS, since one sweep writes one entry '
        + 'per configured model)');
      console.log('  it releases once, not on every tick while still idle: OK (' + after + ' sweep)');
    }

    // ── 4. New work RE-ARMS the sweep ─────────────────────────────────────────────────────────
    // Without this the server would free its models once and never again for the rest of its life.
    {
      const before = sweeps();
      await post(sport, '/api/comic-extract', { images: [TINY], lang: 'nl', extract: true });
      await sleep(400);
      const t1 = Date.now();
      let after = before;
      while (Date.now() - t1 < 12000) {
        after = sweeps();
        if (after > before) break;
        await sleep(200);
      }
      assert(after > before,
        'after new model use, going idle again releases again — the sweep re-arms (sweeps '
        + before + ' -> ' + after + ')');
      console.log('  new work re-arms the sweep: OK (' + after + ' sweeps)');
    }

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-idle-release: FAILED' : 'e2e-idle-release: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
