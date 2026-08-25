// E2E: POST /api/comic-extract (PLAN §2.4 / Track A4 milestone 2, v85_k) — a real fresh-spawned
// server, a real (fake) Ollama backend, real HTTP round trips. Per this project's own standing rule
// ("server.js changes need a FRESH PROCESS to verify live"), this is the correct verification path
// for the new route/job — not a curl against any long-running dev server.
//
// Covers: the batch call is accepted and returns a jobId; polling /api/job/:id reaches 'done' with
// panels in the SAME order as the images were sent; the server actually attaches `images` to the
// Ollama request (proven via fake-ollama.js's own request log, not just "the call didn't error");
// the `data:image/...;base64,` prefix is stripped before reaching Ollama (bare base64 only, per
// Ollama's own contract); one panel's failure doesn't lose the rest of the batch, and results stay
// index-aligned with what was sent; and the two validation guards (no images / too many images).
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

// A tiny, deliberately-fake "image" — the fake Ollama backend never decodes it, only counts/logs it,
// so it does not need to be a real JPEG for this test's purposes.
const FAKE_IMG = (n) => 'data:image/jpeg;base64,' + Buffer.from('fake-panel-' + n).toString('base64');

(async () => {
  const env = await boot({ log: true });
  try {
    const { sport } = env;

    // ── 1. Basic success: 2 panels, both extract cleanly, in order ────────────
    {
      const start = await post(sport, '/api/comic-extract', { images: [FAKE_IMG(1), FAKE_IMG(2)], lang: 'de' });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      assert(start.body.jobId, 'response carries a jobId');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');
      const panels = fin.data.panels;
      assert(Array.isArray(panels) && panels.length === 2, 'exactly 2 panel results, matching the 2 images sent');
      panels.forEach((p, i) => {
        assert(p.caption === 'Fake caption text.', `panel ${i} caption matches the fake's canned reply`);
        assert(p.inScene === 'Fake sign text.', `panel ${i} inScene matches the fake's canned reply`);
        assert(!p.error, `panel ${i} has no error`);
      });
      console.log('  2-panel batch: both extracted cleanly, in order: OK');
    }

    // ── 2. The server actually attached `images` to the Ollama request, and stripped the
    //      `data:image/...;base64,` prefix before sending (bare base64 only) ─────────────────
    {
      const entries = env.readChatLog().filter(e => e.kind === 'comic_extract');
      assert(entries.length >= 2, 'fake-ollama logged >=2 comic_extract requests (got ' + entries.length + ')');
      const last2 = entries.slice(-2);
      last2.forEach((e, i) => {
        assert(e.opts && Array.isArray(e.opts.images) && e.opts.images.length === 1,
          `request ${i} carried exactly one image`);
        const prefix = e.opts.images[0].prefix;
        assert(!/^data:/.test(prefix), `image ${i} reached Ollama WITHOUT the data:...;base64, prefix (got "${prefix}")`);
      });
      console.log('  images attached to the Ollama request, data: prefix stripped before sending: OK');
    }

    // ── 3. One panel fails (an empty/invalid crop), the rest of the batch still completes,
    //      and results stay INDEX-ALIGNED with what was sent (not compacted) ──────────────────
    {
      const start = await post(sport, '/api/comic-extract', { images: [FAKE_IMG(3), '', FAKE_IMG(4)], lang: 'de' });
      assert(start.status === 202, 'accepted despite one bad image in the batch');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job still reaches done (one bad panel does not fail the whole batch)');
      const panels = fin.data.panels;
      assert(panels.length === 3, 'still 3 results — the failed slot is a placeholder, not a skip (got ' + panels.length + ')');
      assert(!panels[0].error && panels[0].caption === 'Fake caption text.', 'panel 0 (good image) succeeded');
      assert(panels[1].error, 'panel 1 (empty image) recorded an error, not a silent skip');
      assert(!panels[2].error && panels[2].caption === 'Fake caption text.', 'panel 2 (good image) succeeded despite panel 1 failing');
      console.log('  one bad panel fails without losing the rest of the batch; results stay index-aligned: OK');
    }

    // ── 4. Validation guards ───────────────────────────────────────────────────
    {
      const noImages = await post(sport, '/api/comic-extract', { images: [], lang: 'de' });
      assert(noImages.status === 400, 'empty images array rejected with 400 (got ' + noImages.status + ')');
      const tooMany = await post(sport, '/api/comic-extract', { images: Array(31).fill(FAKE_IMG(1)), lang: 'de' });
      assert(tooMany.status === 400, '31 images rejected with 400 (got ' + tooMany.status + ')');
      console.log('  validation: empty batch and over-cap batch both rejected with 400: OK');
    }

    console.log('e2e-comic-extract: ALL PASSED');
  } finally {
    env.stop();
  }
})().catch(err => { console.error(err); process.exit(1); });
