// E2E (live server + fake Ollama): item AU, shutdown half (v88_g) — stopping the server frees the
// models it may have loaded into VRAM.
//
// User request: "we should free the occupied memory for unused models (ollama stop) … and when
// server.js is stopped."
//
// Why this needed doing at all: llm.js sends `keep_alive: -1` on EVERY /api/chat request, so a model
// this server loads stays resident indefinitely — including after the server process is gone. Until
// this cut there were ZERO `process.on()` handlers in server.js, so Ctrl-C simply orphaned them.
//
// ⚠️ NOT to be confused with the release that already existed: `generate()` calls release() to swap
// the story model out for a DIFFERENT lesson model, but only when OLLAMA_LESSON_MODEL !==
// OLLAMA_MODEL — false in the default configuration, so it never fires for most users. That is a
// mid-generation optimisation; this is the shutdown path, and they are independent.
//
// The discriminator is `keep_alive`: llm.js's release() sends 0 (Ollama's "unload now"), every
// ordinary generation sends -1. The fake records both, so this test reads what actually went over
// the wire rather than trusting a log line.
'use strict';
const fs = require('fs');
const { boot, assert } = require('./lib');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // Distinct models per role, so the de-duplication has something real to de-duplicate and the
  // assertion below can name which models were freed.
  const env = await boot({ log: true, extraEnv: {
    OLLAMA_MODEL: 'story-m', OLLAMA_LESSON_MODEL: 'lesson-m',
    OLLAMA_TRANSLATION_MODEL: 'story-m',           // deliberately a DUPLICATE of the story model
    OLLAMA_QC_MODEL: 'qc-m', OLLAMA_VISION_MODEL: 'vision-m',
  } });
  let failed = false;
  try {
    const releases = () => (fs.existsSync(env.logPath)
      ? fs.readFileSync(env.logPath, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
        .filter(e => e && e.opts && e.opts.keep_alive === 0)
      : []);

    // ── 1. Nothing is released while the server is simply running ─────────────────────────────
    // Non-vacuity for §2: without this, a test that only counts releases at the end could pass on a
    // server that releases constantly, which would be its own (worse) bug.
    assert(releases().length === 0,
      'a running server releases nothing (got ' + JSON.stringify(releases().map(r => r.opts.model)) + ')');
    console.log('  a running server releases nothing: OK');

    // ── 2. SIGTERM frees every DISTINCT configured model ──────────────────────────────────────
    // stopServer(), NOT stop(): the latter also kills the fake Ollama and deletes the chat log, so
    // the very requests this test exists to observe would have nowhere to land. That is the trap
    // this section was written into the first time.
    env.stopServer('SIGTERM');
    await sleep(2500);                // the handler races a 6s deadline; a fake backend answers at once

    const freed = [...new Set(releases().map(r => r.opts.model))].sort();
    assert(freed.length > 0,
      'stopping the server released SOMETHING — this is the whole item (got none)');
    assert(JSON.stringify(freed) === JSON.stringify(['lesson-m', 'qc-m', 'story-m', 'vision-m']),
      'every DISTINCT configured model is freed, and the duplicated one only once — expected '
      + '["lesson-m","qc-m","story-m","vision-m"], got ' + JSON.stringify(freed));

    // De-duplication is a real claim, not an incidental one: OLLAMA_TRANSLATION_MODEL is set to the
    // same name as OLLAMA_MODEL above, so a naive implementation would emit five requests.
    const perModel = {};
    releases().forEach(r => { perModel[r.opts.model] = (perModel[r.opts.model] || 0) + 1; });
    assert(perModel['story-m'] === 1,
      'the model configured for TWO roles is released exactly once, not twice (got '
      + perModel['story-m'] + ')');
    console.log('  SIGTERM frees every distinct configured model, de-duplicated: OK');

    // ── 3. keep_alive is the discriminator, and it is 0 ───────────────────────────────────────
    // Pins WHAT was sent, not merely that a request happened: keep_alive:0 is Ollama's "unload now".
    // A release that sent -1 would look identical in every other respect and free nothing.
    releases().forEach(r => assert(r.opts.keep_alive === 0,
      'each shutdown request carries keep_alive:0 (got ' + r.opts.keep_alive + ')'));
    console.log('  each shutdown request is a real release (keep_alive:0): OK');

  } catch (e) { failed = true; console.error(e); }
  finally { try { env.stop(); } catch (_) {} }
  console.log(failed ? 'e2e-shutdown-release: FAILED' : 'e2e-shutdown-release: ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
