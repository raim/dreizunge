// E2E: POST /api/comic-extract with the new `describe` flag (user request) — a real fresh-spawned
// server, a real (fake) Ollama backend, real HTTP round trips. Per this project's standing rule
// ("server.js changes need a FRESH PROCESS to verify live"), this is the correct verification path
// for the new job behaviour, not a curl against a long-running dev server.
//
// The ask: "additionally or alternatively to text extraction, ask the model to give a short 1-2
// sentence description of the image in the target language. This will be used as the chapter text,
// if no text is extracted."
//
// The single most important claim here is the LAZINESS rule (user ruling: describe "only when no
// text was found"). A vision call is one-per-panel and slow, so describing every panel of a fully
// lettered page would roughly double the wait for a result that would never be used. That claim is
// only checkable by COUNTING the model calls the server actually made — which is why fake-ollama.js
// gained its own `comic_describe` kind rather than this test merely inspecting the response body.
//
// `lang: 'FORCE_NOTEXT'` is the lever for "a panel that yields no lettering": langName() echoes an
// unknown code straight through into _comicExtractPrompt, and fake-ollama's comic_extract branch
// then returns unlabeled prose, which _parseComicExtraction turns into empty caption+inScene. NOT
// FORCE_EMPTY — that returns a truly empty body, which callLLMVision rejects as a failure, so it
// exercises the ERROR path instead (§4 below pins that the two are handled differently).
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
const FAKE_IMG = (n) => 'data:image/jpeg;base64,' + Buffer.from('fake-panel-' + n).toString('base64');
const countKind = (env, kind) => env.readChatLog().filter(e => e.kind === kind).length;

// A chapter with a real story, so §7 can prove the continued-from chain's text actually reaches the
// description prompt rather than an empty string being threaded through.
// TWO chained chapters, not one: with a single chapter the route's own `anchor.story` fallback covers
// the case, so a test seeded that way cannot tell "walked the chain" from "used the anchor" — found
// by mutation-testing, where stubbing collectChainStory out stayed GREEN.
const SEED = { schemaVersion: 29, flags: {}, progress: {}, storylines: [],
  topics: [
    { id: 'tp_first', topic: 'Erstes', lang: 'de', srcLang: 'en', lessons: [],
      story: 'ERSTESKAPITEL Es war einmal ein Anfang.' },
    { id: 'tp_prior', topic: 'Vorgaenger', lang: 'de', srcLang: 'en', lessons: [],
      continuedFromId: 'tp_first',
      story: 'Es war einmal ein Vorgaenger. Der Hund lief durch den Garten.' },
  ] };

(async () => {
  const env = await boot({ log: true, seed: SEED });
  try {
    const { sport } = env;

    // ── 1. describe-only: no extraction call at all, description becomes the panel's content ──
    {
      const before = { ex: countKind(env, 'comic_extract'), de: countKind(env, 'comic_describe') };
      const start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(1), FAKE_IMG(2)], lang: 'de', extract: false, describe: true });
      assert(start.status === 202, 'accepted (got ' + start.status + ' ' + start.raw + ')');
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done (status=' + fin.status + ', err=' + (fin.error || '') + ')');
      const panels = fin.data.panels;
      assert(panels.length === 2, 'two panel results, index-aligned with the two images sent');
      panels.forEach((p, i) => {
        assert(p.description && /Hund/.test(p.description), `panel ${i} carries the description`);
        assert(p.caption === '' && p.inScene === '', `panel ${i} has no transcription — none was asked for`);
        assert(!p.error, `panel ${i} has no error`);
      });
      assert(countKind(env, 'comic_extract') === before.ex,
        'extract:false really made ZERO extraction calls — not just discarded their result');
      assert(countKind(env, 'comic_describe') === before.de + 2, 'exactly one describe call per panel');
      console.log('  describe-only: no extraction call, one description per panel: OK');
    }

    // ── 2. ⚠️ THE LAZINESS RULE: both requested, but the panels DO yield text => no describe calls ──
    {
      const before = { ex: countKind(env, 'comic_extract'), de: countKind(env, 'comic_describe') };
      const start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(3), FAKE_IMG(4)], lang: 'de', extract: true, describe: true });
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done');
      const panels = fin.data.panels;
      panels.forEach((p, i) => {
        assert(p.caption === 'Fake caption text.', `panel ${i} transcribed normally`);
        assert(p.description === '', `panel ${i} got NO description — it already had lettering`);
      });
      assert(countKind(env, 'comic_extract') === before.ex + 2, 'two extraction calls, one per panel');
      assert(countKind(env, 'comic_describe') === before.de,
        'and ZERO description calls — the expensive second call is skipped for a panel that has text ' +
        '(this is the whole point of the laziness rule; without it a lettered page pays double)');
      console.log('  both requested + text found: extraction only, NO wasted description calls: OK');
    }

    // ── 3. Both requested and a panel yields NOTHING => the description call does happen ──────
    {
      const before = { ex: countKind(env, 'comic_extract'), de: countKind(env, 'comic_describe') };
      const start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(5)], lang: 'FORCE_NOTEXT', extract: true, describe: true });
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done');
      const p = fin.data.panels[0];
      assert(p.caption === '' && p.inScene === '', 'setup: the panel really did yield no lettering');
      assert(p.description && /Hund/.test(p.description),
        'a wordless panel DOES get a description — which is what makes it a usable chapter');
      assert(countKind(env, 'comic_extract') === before.ex + 1, 'extraction was still attempted first');
      assert(countKind(env, 'comic_describe') === before.de + 1, 'and the description followed it');
      console.log('  both requested + no text found: extraction first, then the description: OK');
    }

    // ── 4. An extraction ERROR is NOT "no text": the panel is not silently papered over ───────
    // Deliberate scope boundary. "Used as the chapter text, if no text is extracted" means a panel
    // that really has no lettering — not one whose extraction FAILED. An extraction error is usually
    // transient (model timeout, oversized image) and re-runnable; substituting a description there
    // would hide a failure behind plausible-looking content. So the error surfaces as an error.
    {
      const before = countKind(env, 'comic_describe');
      const start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(8)], lang: 'FORCE_EMPTY', extract: true, describe: true });
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'the batch still completes — one panel failing never loses the job');
      const p = fin.data.panels[0];
      assert(p.error, 'the failed panel reports its error rather than looking empty');
      assert(p.description === '', 'and gets NO description — a failure is not a wordless panel');
      assert(countKind(env, 'comic_describe') === before, 'no description call was made for it');
      console.log('  an extraction ERROR is surfaced, not replaced by a description: OK');
    }

    // ── 5. An OLDER client (neither flag sent) is unchanged: extract only ─────────────────────
    {
      const before = countKind(env, 'comic_describe');
      const start = await post(sport, '/api/comic-extract', { images: [FAKE_IMG(6)], lang: 'de' });
      const fin = await waitJob(sport, start.body.jobId);
      assert(fin.status === 'done', 'job done');
      assert(fin.data.panels[0].caption === 'Fake caption text.', 'still extracts, exactly as before');
      assert(countKind(env, 'comic_describe') === before,
        'and never describes — a client that predates this feature keeps its old behaviour');
      console.log('  older client (no flags): extract-only, unchanged: OK');
    }

    // ── 6. Asking for neither is rejected, rather than running a job that would do nothing ────
    {
      const r = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(7)], lang: 'de', extract: false, describe: false });
      assert(r.status === 400, 'neither operation requested => 400 (got ' + r.status + ')');
      assert(/nothing to do/i.test(r.body.error || ''), 'and says why: ' + (r.body.error || ''));
      console.log('  neither operation requested: rejected with a real message: OK');
    }

    // ── 7. ⚠️ THE STORY SO FAR reaches the description prompt (user request) ─────────────────
    // "For images where we get a description and no text extraction, we should pass the previous
    // whole story as context for the image." Two sources, both meaning "the story so far": the
    // CONTINUED-FROM chain (assembled server-side by collectChainStory — the client's savedList
    // projection carries no story text, so it could not send it) and the panels already described
    // earlier in the same batch. fake-ollama marks a reply MITKONTEXT when the prompt carried the
    // context block, so this proves the text REACHED the model rather than merely being computed.
    {
      // No continuedFrom, single panel: nothing precedes it, so no context block.
      let start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(20)], lang: 'de', extract: false, describe: true });
      let fin = await waitJob(sport, start.body.jobId);
      assert(!/MITKONTEXT/.test(fin.data.panels[0].description),
        'a first panel with nothing before it gets NO context block — there is no story yet');

      // Same call, but continuing a chapter that HAS a story.
      start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(21)], lang: 'de', extract: false, describe: true, continuedFrom: 'tp_prior' });
      fin = await waitJob(sport, start.body.jobId);
      assert(/MITKONTEXT/.test(fin.data.panels[0].description),
        "the continued-from chapter's story reached the description prompt");
      const ctxEntry = JSON.stringify(env.readChatLog().filter(e => e.kind === 'comic_describe').pop());
      assert(/Es war einmal ein Vorgaenger/.test(ctxEntry),
        'and it is the REAL story text of that chapter, not a placeholder');
      assert(/ERSTESKAPITEL/.test(ctxEntry),
        'and the WHOLE chain — the chapter before it too, via collectChainStory, which is what ' +
        '"the previous whole story" means rather than just the immediate parent');

      // A multi-panel batch with NO continuedFrom: panel 1 has no context, panel 2 has panel 1's.
      start = await post(sport, '/api/comic-extract',
        { images: [FAKE_IMG(22), FAKE_IMG(23)], lang: 'de', extract: false, describe: true });
      fin = await waitJob(sport, start.body.jobId);
      assert(!/MITKONTEXT/.test(fin.data.panels[0].description), 'panel 1 of a fresh batch: still no context');
      assert(/MITKONTEXT/.test(fin.data.panels[1].description),
        'panel 2 IS described with panel 1 as context — the story so far grows within the batch, ' +
        'which is what stops a recurring character being reintroduced in every chapter');
      console.log('  the story so far (continued-from chain AND earlier panels) reaches the prompt: OK');
    }

    console.log('e2e-comic-describe: ALL PASSED');
  } finally {
    await env.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
