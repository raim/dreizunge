// unit-analysis-truncation.test.js — v90_z. The all-null-sentences defect, guarded at the layer
// where it is observable: the REQUEST canonical-analysis.js actually sends, and the RECORD it
// actually writes.
//
// ⚠️ WHY THIS RUNS AGAINST A REAL (fake) BACKEND OVER HTTP RATHER THAN A STUB.
// The whole defect lived in the request OPTIONS — a fixed `num_predict` of 1536 and an absent
// `num_ctx` — and a stubbed `callLLM` cannot see either: it would be asserting against this test's
// own idea of the call instead of the one llm.js builds and puts on the wire. That is the exact
// "guard at the layer where the claim is observable" rule, and `e2e-*.test.js`'s own precedent for
// reading `opts.num_ctx` / `opts.num_predict` back out of the fake's chat log (v79_b).
//
// ⚠️ The user report this exists for: "text-analysis is often missing sentences, and returning
// null-filled entries in canonical-analysis.json ... The console also didn't report on how many
// analyses were successful and how many just contain nulls." Measured across the live store before
// any fix: 1-24 tokens 0 of 78 failed, 26+ tokens 8 of 8 failed. Proven against the real production
// model at the same cut — n=24 came back `done_reason=stop` at eval=1520 of a 1536 cap, n=25 came
// back `done_reason=length` with 0 of 25 tokens resolved, and the same n=25 at 6144 resolved 25/25.
'use strict';
const fs = require('fs');
const assert = require('assert');
const { startFakeOllama, tmpFile } = require('./lib');

const mkTokens = (words) => words.map((w, i) => ({ tokenId: 't' + i, idx: i, text: w }));
const sentence = (words) => ({ sentenceId: 's0', text: words.join(' '), tokens: mkTokens(words) });

(async () => {
  const logPath = tmpFile('dz_analysis_chatlog', '.jsonl');
  const fake = await startFakeOllama(logPath);
  // llm.js reads OLLAMA_HOST once, at require time — so the env must be set BEFORE the require.
  process.env.OLLAMA_HOST = 'http://127.0.0.1:' + fake.port;
  const ca = require('../canonical-analysis.js');
  const calls = () => (fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    : []).filter(c => c.kind === 'canonical_analysis');

  let failed = false;
  try {
    // ── 1. The budget is a FUNCTION of the token count, with a floor and a ceiling ──────────────
    // 1536 was the constant that caused the defect; it survives only as the FLOOR, so no sentence
    // that used to fit gets a smaller budget than it always had.
    {
      assert.strictEqual(ca.analysisTokenBudget(1), 1536, 'a one-token sentence keeps the old 1536 as a floor, not less');
      assert.strictEqual(ca.analysisTokenBudget(0), 1536, 'an empty token list floors too, rather than asking for 400');
      const b24 = ca.analysisTokenBudget(24), b25 = ca.analysisTokenBudget(25), b39 = ca.analysisTokenBudget(39);
      assert.ok(b25 > b24 && b39 > b25, 'the budget GROWS with the token count — the whole point; a constant is what failed');
      // The measured requirement on the real production model, which the budget must clear.
      assert.ok(b24 >= 1520, `n=24 needs 1520 measured output tokens, budget gives ${b24}`);
      assert.ok(b25 >= 1663, `n=25 needs 1663 measured output tokens, budget gives ${b25}`);
      assert.ok(b39 >= 2563, `n=39 needs 2563 measured output tokens, budget gives ${b39}`);
      assert.ok(ca.analysisTokenBudget(100000) <= 12288, 'a pathological token list is capped, not allowed to ask for the world');
    }
    console.log('  budget scales with token count, floors at the old 1536, clears every measured requirement: OK');

    // ── 2. The REQUEST carries a sized num_predict AND a num_ctx ────────────────────────────────
    // ⚠️ num_ctx is half the fix and the easy half to forget. llm.js omits it unless the caller asks,
    // and Ollama then truncates an over-long PROMPT silently (its own v71_t note). Raising the output
    // budget without this trades one silent truncation for a strictly worse one.
    {
      const before = calls().length;
      const words = Array.from({ length: 30 }, (_, i) => 'parola' + i);
      await ca.analyzeSentence('fake', sentence(words), { langName: 'Italian', srcLangName: 'German' });
      const c = calls().slice(before);
      assert.strictEqual(c.length, 1, 'a sentence that parses needs exactly one call — no speculative retry');
      assert.strictEqual(c[0].opts.num_predict, ca.analysisTokenBudget(30),
        'the request carries the budget sized from THIS sentence, not a constant');
      assert.ok(c[0].opts.num_predict > 1536, 'a 30-token sentence asks for more than the old fixed cap');
      assert.ok(c[0].opts.num_ctx >= c[0].opts.num_predict,
        `num_ctx must be present and hold the whole reply, got ${c[0].opts.num_ctx}`);
    }
    console.log('  the request sizes num_predict from the token count and sends a num_ctx that holds it: OK');

    // ── 3. A TRUNCATED reply is detected and retried at double — the defect itself ──────────────
    // The fake cuts the JSON mid-object and returns `done_reason:'length'` below 3000, exactly as a
    // real truncation arrives. Before this fix the truncated JSON was swallowed by a bare catch and
    // every token was written null, permanently, with no log and no counter.
    {
      const before = calls().length;
      const rec = await ca.analyzeSentence('fake', sentence(['ZZZBIG', 'due', 'tre']), {});
      const c = calls().slice(before);
      assert.strictEqual(c.length, 2, 'a truncated reply is RETRIED — one call means the truncation was swallowed again');
      assert.strictEqual(c[0].opts.num_predict, 1536, 'the first attempt uses the sized budget (floor, for a 3-token sentence)');
      assert.strictEqual(c[1].opts.num_predict, 3072, 'the retry is exactly DOUBLE the first attempt, not another constant');
      assert.ok(c[1].opts.num_ctx >= 3072, 'the retry raises num_ctx with the budget — otherwise the prompt truncates instead');
      assert.strictEqual(rec.tokens.length, 3);
      assert.ok(rec.tokens.every(t => t.lemma), 'after the retry every token is resolved — this is the user-visible fix');
      assert.strictEqual(rec.retried, true, 'the record says a retry happened, so a reader need not infer it');
      assert.ok(!rec.truncated, 'a sentence the retry rescued is not left marked truncated');
    }
    console.log('  a truncated reply is detected via done_reason and retried at exactly double, resolving every token: OK');

    // ── 3b. ⚠️ done_reason IS READ — the branch a broken-JSON fixture can never prove ───────────
    // Found by mutation-testing §3: deleting the `done_reason === 'length'` arm outright left this
    // file GREEN, because the ZZZBIG fixture ALSO breaks the JSON and the parse-error arm covered
    // for it. Two signals that always fire together are one signal. "ZZZCUT" fires ONLY the stop
    // reason — the reply is valid JSON, it just stops early — which is also the realistic shape of a
    // model that was cut off between token objects rather than inside one.
    {
      const before = calls().length;
      const rec = await ca.analyzeSentence('fake', sentence(['ZZZCUT', 'due', 'tre']), {});
      const c = calls().slice(before);
      assert.strictEqual(c.length, 2,
        'a VALID-JSON reply carrying done_reason:length must still be retried — the stop reason is the only signal here');
      assert.strictEqual(c[1].opts.num_predict, 3072);
      assert.ok(rec.tokens.every(t => t.lemma), 'the retry resolves the tokens the truncated reply had dropped');
      assert.strictEqual(rec.retried, true);
    }
    console.log('  a valid-JSON reply with done_reason:length is retried too — the stop reason is read, not inferred: OK');

    // ── 3c. A sentence that fails BOTH attempts is MARKED, not silently nulled ──────────────────
    // The original defect's end state, which must now leave evidence: the record says why, and the
    // coverage counts it. Exactly one retry — an unbounded escalation would stall a whole chapter.
    {
      const before = calls().length;
      const rec = await ca.analyzeSentence('fake', sentence(['ZZZHUGE', 'due', 'tre']), {});
      const c = calls().slice(before);
      assert.strictEqual(c.length, 2, 'exactly ONE retry, then it stops — not an unbounded escalation');
      assert.strictEqual(rec.truncated, true, 'a sentence still truncated after the retry SAYS so — it used to be silently null');
      assert.strictEqual(rec.retried, true);
      assert.ok(rec.parseError, 'and it carries the parse failure that used to be swallowed by a bare catch');
      assert.strictEqual(rec.unresolved, 3, 'the unresolved count rides along on the record');
      assert.ok(rec.tokens.every(t => t.confidence === 'unresolved'),
        'it still degrades per-token rather than throwing — one bad reply must not abort a long chapter');
      assert.strictEqual(ca.analysisCoverage([rec]).truncatedSentences, 1, 'and the coverage report counts it as truncated');
    }
    console.log('  a sentence that fails both attempts is recorded truncated/retried with its parse error, never silently null: OK');

    // ── 3d. ⚠️ The PARSE-FAILURE arm, on its own — a backend that reports no stop reason ────────
    // The mirror of §3b, and the second mutation-testing finding: once ZZZBIG carried done_reason
    // too, deleting the parse arm ALSO left this file green. llm.js's header states the contract —
    // a null doneReason means "unknown", never "not truncated" — so the observable shape of the
    // failure has to be enough on its own.
    {
      const before = calls().length;
      const rec = await ca.analyzeSentence('fake', sentence(['ZZZNODR', 'due', 'tre']), {});
      const c = calls().slice(before);
      assert.strictEqual(c.length, 2,
        'unparseable + every token unresolved must trigger the retry even with NO done_reason — a backend need not report one');
      assert.ok(rec.tokens.every(t => t.lemma), 'and the retry resolves it');
      assert.ok(!rec.truncated, 'nothing claims truncation when the backend never said so — null is "unknown", not "length"');
    }
    console.log('  a parse failure with no done_reason at all still triggers the retry — the two signals are independent: OK');

    // ── 3e. ⚠️ The BETTER of the two attempts is kept, not simply the later one ─────────────────
    // Third mutation-testing finding. ZZZWORSE resolves 1 of 3 at the small budget and returns
    // invalid JSON at the large one — a real shape (more room, more rambling). Always taking the
    // retry would throw away the partial analysis the first attempt genuinely produced.
    {
      const before = calls().length;
      const rec = await ca.analyzeSentence('fake', sentence(['ZZZWORSE', 'due', 'tre']), {});
      assert.strictEqual(calls().slice(before).length, 2, 'the retry did happen — otherwise this proves nothing about which is kept');
      assert.strictEqual(rec.unresolved, 2,
        'the FIRST attempt (1 of 3 resolved) is kept — a retry that resolved nothing must not discard real work');
      assert.ok(rec.tokens[0].lemma, 'the one token the first attempt did resolve survives the retry');
    }
    console.log('  a retry that comes back worse is discarded — the better attempt is kept: OK');

    // ── 4. A parse failure is REPORTED, never swallowed ─────────────────────────────────────────
    // `catch (e) { parsed = {} }` is the single line that turned a truncation into 39 null tokens
    // with no trace. The degrade stays; the silence does not.
    {
      const toks = mkTokens(['Katze', 'schläft']);
      const broken = ca.parseAnalysisReply('not json at all', toks);
      assert.strictEqual(broken.tokens.length, 2, 'an unparseable reply still degrades per-token rather than throwing');
      assert.ok(broken.tokens.every(t => t.confidence === 'unresolved'));
      assert.ok(broken.parseError && typeof broken.parseError === 'string' && broken.parseError.length > 0,
        'the parse failure travels OUT to the caller — it used to be discarded entirely');
      assert.strictEqual(broken.unresolved, 2, 'the unresolved count is computed once, here, not re-derived by every caller');
      const good = ca.parseAnalysisReply(JSON.stringify({
        tokens: [{ i: 0, lemma: 'Katze', form: 'noun', sense: 'cat', confidence: 'high' },
                 { i: 1, lemma: 'schlafen', form: 'verb', sense: 'sleeps', confidence: 'high' }], phrases: [] }), toks);
      assert.strictEqual(good.parseError, null, 'a reply that parses reports NO error — otherwise the signal means nothing');
      assert.strictEqual(good.unresolved, 0);
    }
    console.log('  a parse failure is reported as parseError instead of being swallowed into an empty object: OK');

    // ── 5. analysisCoverage answers the question the user asked the console to answer ───────────
    // ⚠️ No new field was needed: `confidence:'unresolved'` has been on every failed token since CP2
    // shipped. It was simply never counted.
    {
      const cov = ca.analysisCoverage([
        { tokens: [{ confidence: 'high' }, { confidence: 'low' }] },                      // good
        { tokens: [{ confidence: 'unresolved' }, { confidence: 'unresolved' }], truncated: true },  // the defect
        { tokens: [{ confidence: 'high' }, { confidence: 'unresolved' }] },               // good, with a gap
        { tokens: [] },                                                                   // no tokens: not a failure
      ]);
      assert.strictEqual(cov.unresolvedSentences, 1, 'ONLY the all-null sentence counts as unresolved — a gap is not a failure');
      assert.strictEqual(cov.unresolvedTokens, 3, 'every unresolved token is counted, including the one inside a good sentence');
      assert.strictEqual(cov.truncatedSentences, 1);
      assert.deepStrictEqual(ca.analysisCoverage([]), { unresolvedSentences: 0, unresolvedTokens: 0, truncatedSentences: 0 });
    }
    console.log('  analysisCoverage counts all-null sentences apart from partial gaps, off the existing unresolved marker: OK');

    // ── 6. The chapter result carries the coverage, so the job can report it ────────────────────
    {
      const chapter = { chapterId: 'c1', lang: 'it', srcLang: 'de', sentences: [
        sentence(['una', 'frase', 'corta']),
        { sentenceId: 's1', text: 'con ZZZOMIT dentro', tokens: mkTokens(['con', 'ZZZOMIT', 'dentro']) },
      ] };
      const out = await ca.analyzeChapter('fake', chapter, {});
      assert.strictEqual(out.sentenceCount, 2);
      assert.strictEqual(typeof out.unresolvedSentences, 'number', 'the chapter result reports coverage — the job logs it from here');
      assert.strictEqual(out.unresolvedSentences, 0, 'one omitted token is a GAP, not an unresolved sentence');
      assert.strictEqual(out.unresolvedTokens, 1, 'the single omitted token is still counted and reportable');
    }
    console.log('  analyzeChapter reports unresolved sentence/token counts alongside its existing totals: OK');

    console.log('unit-analysis-truncation: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('unit-analysis-truncation FAILED:', e.message);
  } finally {
    try { fake.child.kill(); } catch (_) {}
    try { fs.unlinkSync(logPath); } catch (_) {}
    process.exit(failed ? 1 : 0);
  }
})();
