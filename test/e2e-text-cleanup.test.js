// e2e-text-cleanup.test.js
// v69_m — stage 2 of the upload cleanup: the model pass.
//
// Stage 1 (v68.1, `cleanExtractedText`) fixes what code can fix reliably: hard-wrapped lines,
// page numbers, bylines, lone URLs. What survives it is text that READS like prose but is not part
// of the article — an advertisement, a "read also" teaser, a photo caption. No mechanical rule can
// classify those, so the model is asked.
//
// The design point: the contract is DELETION ONLY, and the server VERIFIES it rather than trusting
// the prompt. `cleanTextChanges` checks the result is a word-level SUBSEQUENCE of the input, which
// rejects rewriting, rewording, translating and reordering in one cheap test. This is the same
// lesson as the error-hunt fix — a prompt cannot guarantee a contract; verification can.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, post, get, sleep, assert } = require('./lib');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert(at >= 0, 'missing ' + name);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The verifier ──────────────────────────────────────────────────────────
{
  const chk = new Function(ext(server, 'cleanTextChanges') + '\nreturn cleanTextChanges;')();
  const src = 'Il maltempo ha colpito il Nord. ADVERT Compra casa. I danni sono ingenti.';

  let r = chk(src, 'Il maltempo ha colpito il Nord. I danni sono ingenti.');
  assert(r.ok, 'a pure deletion is accepted');
  assert(r.dropped === 3, `dropped counts words removed (got ${r.dropped})`);

  assert(chk(src, src).ok, 'an unchanged text is accepted (nothing to remove is a valid answer)');
  assert(!chk(src, 'Il maltempo ha colpito il Sud. I danni sono ingenti.').ok,
    'a single reworded word is rejected');
  assert(!chk(src, 'I danni sono ingenti. Il maltempo ha colpito il Nord.').ok,
    'reordering is rejected — the subsequence check catches it');
  assert(!chk(src, 'Bad weather hit the North.').ok, 'translating is rejected');
  assert(!chk(src, src + ' Extra words.').ok, 'adding words is rejected');
  assert(chk(src, '').ok, 'an empty result is structurally a subsequence (the length floor rejects it separately)');
}
console.log('  verifier: deletion accepted; reword/reorder/translate/insert rejected: OK');

// ── 2. The generator retries with specific feedback ──────────────────────────
{
  const gen = ext(server, 'cleanNarrativeText');
  assert(/for \(let attempt = 1; attempt <= ATTEMPTS; attempt\+\+\)/.test(gen), 'it retries');
  assert(/YOUR PREVIOUS ATTEMPT WAS REJECTED/.test(gen), 'and says what was wrong');
  for (const phrase of ['you rewrote or reworded', 'you kept only', 'you returned nothing'])
    assert(gen.includes(phrase), `feedback covers: ${phrase}`);

  // v69_o — lessons from the first real run, on a real PDF:
  //  (a) The floor is a WARNING, not a verdict. It assumed every chunk is mostly article, but a
  //      chunk can legitimately BE mostly furniture (a related-links block, a footer). Two attempts
  //      independently agreed on ~32% retention, which is evidence the model was RIGHT. So a
  //      heavy-but-structurally-valid answer is remembered and used if nothing better arrives,
  //      flagged for the human — who can undo it.
  assert(/if \(!best \|\| chk\.kept > best\.chk\.kept\) best = \{ text: out, chk \};/.test(gen),
    'a heavy deletion is remembered rather than discarded');
  assert(/if \(best\) \{[\s\S]{0,400}heavy: true/.test(gen), 'and returned flagged when nothing better arrives');
  //  (b) The run must never stall: if nothing is usable, the text comes back UNCHANGED rather than
  //      throwing, so the remaining chunks still get processed.
  assert(/unchanged: true, note: lastProblem/.test(gen), 'an unusable result returns the text unchanged');
  //  (c) think stays OFF. Escalating to reasoning is wrong for a verbatim-copy contract, does not
  //      address over-deletion, and cost 36 minutes (base timeout × THINK_TIMEOUT_MULT) on a
  //      200-word chunk — which is what made a real run look hung.
  assert(/\{ think: false, timeoutMs: getRequestTimeout\(\) \}/.test(gen),
    'no reasoning escalation, and the plain request timeout (output is bounded by input here)');
  assert(!/timeoutMs: Math\.ceil\(getRequestTimeout\(\) \* THINK_TIMEOUT_MULT\)/.test(gen),
    'the 3× reasoning timeout is not USED here (the comment explaining why may mention it)');
  assert(/promptTokens \+= r\.promptTokens \|\| 0/.test(gen), 'retries are metered');
}
console.log('  generator: escalating feedback, length floor, adaptive think, metering: OK');

// ── 3. Client wiring ─────────────────────────────────────────────────────────
{
  assert(/id="pdf-aiclean-btn"/.test(html), 'the button exists');
  assert(/onclick="aiCleanChunks\(\)"/.test(html), 'and is wired');
  // It needs a backend, so it must never appear in the static build.
  assert(/_aiRow\.style\.display = APP\.info\?\.canGenerate \? '' : 'none';/.test(html),
    'the model pass is hidden without a backend (static build)');
  // Undoable: an automated edit to the user's text must be reversible.
  assert(/function aiCleanUndo\(\)/.test(html) && /_aiCleanBackup = _pdfChunks\.map\(c => c\.text\);/.test(html),
    'the pre-pass chunk texts are kept so the pass can be undone');
  // Per chunk, so one failure cannot lose the rest.
  const fn = ext(html, 'aiCleanChunks');
  assert(/for\(let i=0; i<_pdfChunks\.length; i\+\+\)/.test(fn), 'it runs per chunk');
  assert(/catch\(e\)\{[\s\S]{0,120}failed\+\+/.test(fn), 'a failing chunk is counted, not fatal');
}
console.log('  client: backend-gated button, per-chunk, undoable: OK');

// ── 4. End to end ────────────────────────────────────────────────────────────
(async () => {
  const env = await boot({ log: false });
  let failed = false;
  try {
    const article = [
      'Il maltempo ha colpito il Nord.',
      'ADVERT Compra casa a Milano!',
      'Read also: our best recipes',
      'Photo: Getty Images',
      'I danni sono ingenti e diffusi ovunque.',
    ].join('\n');

    const r = await post(env.sport, '/api/clean-text', { text: article, lang: 'it' });
    assert(r.status === 200, `cleanup accepted (got ${r.status})`);
    assert(!/ADVERT|Read also|Photo:/.test(r.body.text), 'the advertisement, teaser and caption are gone');
    assert(/Il maltempo ha colpito il Nord\./.test(r.body.text), 'the article survives…');
    assert(/I danni sono ingenti e diffusi ovunque\./.test(r.body.text), '…in full');
    assert(r.body.dropped > 0 && r.body.kept > 0, 'the response reports what it removed');
    assert(r.body.meta && r.body.meta.type === 'text_cleanup', 'the pass is provenance-stamped like every other generation');

    // Verify the returned text really is deletion-only against the input.
    const A = article.split(/\s+/).filter(Boolean), B = r.body.text.split(/\s+/).filter(Boolean);
    let i = 0, ok = true;
    for (const w of B) { while (i < A.length && A[i] !== w) i++; if (i >= A.length) { ok = false; break; } i++; }
    assert(ok, 'every kept word appears in the original, in order');

    // Guards.
    assert((await post(env.sport, '/api/clean-text', { text: 'too short' })).status === 400, 'a too-short text is refused');
    assert((await post(env.sport, '/api/clean-text', { text: 'x'.repeat(20001) })).status === 400, 'an over-long text is refused (split it first)');

    // v69_o — the two failure modes seen on a real PDF, driven through the real server by making
    // the fake misbehave. FAKE_CLEAN_MODE is read by test/fake-ollama.js.
    // (a) An over-deleting model: the answer is APPLIED but flagged, because it may well be right —
    //     a chunk can legitimately be mostly links or teasers, and the pass is undoable.
    // The fake backend is spawned as a child and inherits process.env, so the mode is set here.
    env.stop(); await sleep(400);            // boot() uses a pid-derived port: one server at a time
    process.env.FAKE_CLEAN_MODE = 'overdelete';
    let env2 = await boot({ log: false });
    try {
      const long = ['Prima frase che resta.', 'Seconda frase importante.',
                    'Terza frase del racconto.', 'Quarta frase conclusiva.'].join('\n');
      const rr = await post(env2.sport, '/api/clean-text', { text: long, lang: 'it' });
      assert(rr.status === 200, 'an over-deleting model still returns 200');
      assert(rr.body.heavy === true, 'and the result is flagged heavy for review');
      assert(rr.body.kept < rr.body.total * 0.4, 'the heavy deletion really is below the floor');
      assert(rr.body.note && /kept only/.test(rr.body.note), 'with a note explaining the concern');
    } finally { env2.stop(); await sleep(300); }

    // (b) A model that REWRITES instead of deleting violates the hard contract three times over.
    //     The text must come back UNCHANGED rather than throwing, so a multi-chunk run keeps going.
    process.env.FAKE_CLEAN_MODE = 'rewrite';
    env2 = await boot({ log: false });
    try {
      const long = 'Prima frase che resta. Seconda frase importante. Terza frase del racconto.';
      const rr = await post(env2.sport, '/api/clean-text', { text: long, lang: 'it' });
      assert(rr.status === 200, 'a rewriting model does not fail the request');
      assert(rr.body.unchanged === true, 'the chunk is reported as left alone');
      assert(rr.body.text === long, 'and the original text is returned intact');
    } finally { env2.stop(); await sleep(300); }

    delete process.env.FAKE_CLEAN_MODE;

    // (c) behavioural: cleanup spend really lands on the storyline, in its own bucket.
    env2 = await boot({ log: false });
    try {
      const bk = await post(env2.sport, '/api/generate-book', {
        chunks: [{ title: 'A', text: 'Prima frase del racconto lungo abbastanza.', wordCount: 6 },
                 { title: 'B', text: 'Seconda frase del racconto lungo abbastanza.', wordCount: 6 }],
        lang: 'de', srcLang: 'en', difficulty: 2, sourceFile: 'x.pdf',
        cleanupTokens: { promptTokens: 1234, completionTokens: 567 } });
      assert(bk.status === 202, 'book job accepted');
      for (let i = 0; i < 200; i++) {
        await sleep(500);
        const j = await get(env2.sport, '/api/book-job/' + bk.body.bookId);
        if (j.body && (j.body.status === 'done' || j.body.status === 'error')) break;
      }
      const sl = (env2.readStore().storylines || [])[0];
      assert(sl && sl.tokenUsage, 'the storyline has a token ledger');
      assert(sl.tokenUsage.tokensByType.cleanup === 1801,
        `cleanup spend is booked under its own type (got ${JSON.stringify(sl.tokenUsage.tokensByType)})`);
      assert(sl.tokenUsage.totalPromptTokens >= 1234, 'and counts toward the storyline total');
    } finally { env2.stop(); await sleep(300); }
  } catch (e) {
    failed = true;
    console.error('e2e-text-cleanup FAILED:', e.message);
  } finally {
    try { env.stop(); } catch (_) {}          // already stopped before the failure-mode cases
  }
  if (failed) process.exit(1);
  console.log('  end to end: furniture removed, article kept verbatim, stamped, guarded: OK');
  
// ── v69_p: reporting and token attribution ───────────────────────────────────
{
  // (a) The deterministic pass reports what it did — it runs silently in the browser, so without
  // this the only evidence was the text looking different.
  const det = ext(html, 'cleanExtractedText');
  assert(/_lastCleanStats = \{/.test(det), 'the deterministic pass records stats');
  for (const k of ['junkDropped', 'wrapsJoined', 'shortDropped', 'wordsIn', 'wordsOut'])
    assert(det.includes(k), `stats include ${k}`);
  const apply = ext(html, '_applyUploadCleanup');
  assert(/console\.log\(`🧹 Text cleanup \(no LLM\)/.test(apply), 'and a summary is logged');
  assert(/Text cleanup off/.test(apply), 'turning it off is reported too');

  // (b) The model pass announces itself BEFORE the first call and names the model. The old log
  // only appeared once a chunk finished, so a slow pass looked like nothing happening.
  const gen = ext(server, 'cleanNarrativeText');
  assert(/console\.log\(`  \[\$\{OLLAMA_MODEL\}\] Cleaning text \(\$\{_words\} words/.test(gen),
    'the server announces the model and size before working');
  const client = ext(html, 'aiCleanChunks');
  assert(/console\.log\(`✨ AI text cleanup: \$\{_pdfChunks\.length\} chunk\(s\)/.test(client),
    'the client announces the run before the first chunk');
  assert(/chunk \$\{i\+1\}\/\$\{_pdfChunks\.length\}/.test(client), 'and reports each chunk as it lands');
  assert(/AI text cleanup done/.test(client), 'with a closing summary');

  // (c) Token spend is attributed to the storyline. It happens BEFORE any storyline exists, so it
  // travels with the book job and is added server-side — and is sanitised, being client-supplied.
  assert(/tokens: \{ promptTokens, completionTokens \}/.test(gen), 'the endpoint returns its spend');
  assert(/_aiCleanTokens\.promptTokens\s*\+= data\.tokens\.promptTokens \|\| 0;/.test(client),
    'the client accumulates it across chunks');
  assert(/cleanupTokens: \{ \.\.\._aiCleanTokens \}/.test(html), 'and sends it with the book job');
  assert(/Math\.max\(0, Math\.min\(1e7, body\.cleanupTokens\.promptTokens \| 0\)\)/.test(server),
    'the server sanitises the client-supplied figure');
  assert(/addTokenUsage\(sl, base\.cleanupTokens, 'cleanup'\)/.test(server),
    "and books it against the storyline under its own 'cleanup' bucket");
  // Undoing the pass must not charge the storyline for text that was discarded.
  const undo = ext(html, 'aiCleanUndo');
  assert(/_aiCleanTokens = \{ promptTokens: 0, completionTokens: 0 \};/.test(undo),
    'undoing the pass clears the pending charge');
}
console.log('  v69_p: deterministic summary, model announced up front, tokens booked to the storyline: OK');

console.log('e2e-text-cleanup: ALL PASSED');
})();
