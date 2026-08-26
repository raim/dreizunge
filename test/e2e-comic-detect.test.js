// E2E: PLAN §2.4 / Track A4 milestone 5 (v85_o) — comic panel AUTO-DETECTION (a suggestion, not a
// requirement — see server.js's own comment on _runComicDetectJob for why). Covers: the call is
// accepted and returns a jobId; polling /api/job/:id reaches 'done' with panels parsed correctly
// from the model's response, in order (the SAME parser carried over verbatim from
// probe_comic_panels_v85_i.js); and validation (no image). Malformed/inverted-box FILTERING is a
// client-side responsibility (the server doesn't know the image's own natural pixel dimensions) —
// covered by unit-comic-detect.test.js instead, where that logic actually lives.
const { boot, post, get, assert, sleep } = require('./lib');

async function waitJob(sport, jobId, timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await get(sport, '/api/job/' + jobId);
    if (r.status === 200 && (r.body.status === 'done' || r.body.status === 'error')) return r.body;
    await sleep(200);
  }
  throw new Error('job timed out');
}

const FAKE_PAGE = 'data:image/jpeg;base64,' + Buffer.from('fake-comic-page').toString('base64');

(async () => {
  const env = await boot();
  try {
    const { sport } = env;

    // ── 1. Basic success: 4 panels parsed from the model's response, in order ─────
    {
      const start = await post(sport, '/api/comic-detect-panels', { image: FAKE_PAGE });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      assert(start.body.jobId, 'response carries a jobId');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');
      const panels = fin.data.panels;
      assert(Array.isArray(panels) && panels.length === 4, 'exactly 4 panels parsed (got ' + JSON.stringify(panels) + ')');
      assert(JSON.stringify(panels[0]) === JSON.stringify([20, 60, 480, 390]), 'panel 1 box matches the model response exactly, in order (got ' + JSON.stringify(panels[0]) + ')');
      assert(JSON.stringify(panels[1]) === JSON.stringify([520, 60, 980, 390]), 'panel 2 box matches, in order (got ' + JSON.stringify(panels[1]) + ')');
      console.log('  4-panel detection: parsed correctly, in order, matching the fake model response: OK');
    }

    // ── 2. Validation: no image ────────────────────────────────────────────────
    {
      const noImage = await post(sport, '/api/comic-detect-panels', {});
      assert(noImage.status === 400, 'missing image rejected with 400 (got ' + noImage.status + ')');
      console.log('  validation: missing image rejected with 400: OK');
    }

    console.log('e2e-comic-detect: ALL PASSED');
  } catch (e) {
    console.error('e2e-comic-detect FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
    process.exitCode = 1;
  } finally {
    env.stop();
  }
})();
