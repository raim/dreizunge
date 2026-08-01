// unit-story-context.test.js
// v71_t: the story caps, and the thing that had to be fixed before they could be removed.
//
// Roadmap item: "Remove the 6,000-char story caps; raise the timeout instead." Both caps came from
// v71_o as a fix for `Ollama returned empty response`, whose real cause was the token budget being
// consumed by reasoning — fixed in the same release by raising the base 2,200 → 3,200. Capping the
// story cost exactly what comprehension questions are best at: callbacks, character motive, what
// changed since chapter two.
//
// What the roadmap did NOT say, and what makes this more than a deletion: **Ollama's default
// num_ctx (~4096 tokens) truncates an over-long prompt silently.** Removing the app-side cap
// without sizing the context window would have moved the truncation from a deliberate trim (keep
// the current chapter whole, drop the oldest) into a blind one — with no error, and every attempt
// still "succeeding". That is a worse failure than the cap, because it is invisible.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const llm = require(path.join(ROOT, 'llm.js'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. estimateCtxTokens is pessimistic, and includes the reply ─────────────
// Under-estimating is the one failure mode that matters: it silently truncates. The estimate is
// deliberately 3.2 chars/token rather than the ~4 usual for English, because non-Latin scripts and
// rare vocabulary tokenize worse — and this app's corpus is Japanese, Arabic, Greek and Swahili as
// well as Italian.
{
  const chars = 40000, reply = 8000;
  const est = llm.estimateCtxTokens(chars, reply);
  assert.ok(est > chars / 4, `the estimate is more pessimistic than 4 chars/token (${est})`);
  assert.ok(est > reply, 'and it leaves room for the reply, not just the prompt');
  assert.ok(est >= Math.ceil(chars / 3.2) + reply, 'prompt + reply + headroom');
  // A short prompt must not be inflated into a large context.
  const small = llm.estimateCtxTokens(500, 1024);
  assert.ok(small < 2500, `a small prompt stays small (${small})`);
  console.log(`  estimate: 40k chars + 8k reply → ${est} tokens; 500 chars → ${small}`);
}

// ── 2. The ceiling clamps, and is settable ─────────────────────────────────
// The KV cache grows with the context, so an unbounded num_ctx is a memory hazard on the modest
// local hardware this app targets (the same concern that produced the v71_q num_thread setting).
{
  const before = llm.getNumCtxMax();
  assert.strictEqual(llm.setNumCtxMax(8192), 8192, 'the ceiling is settable');
  assert.strictEqual(llm.setNumCtxMax(999), 2048, 'and clamped at the bottom');
  assert.strictEqual(llm.setNumCtxMax(999999), 131072, 'and at the top');
  llm.setNumCtxMax(before);
  assert.strictEqual(llm.getNumCtxMax(), before, 'restored');
  console.log(`  ceiling: settable, clamped 2048–131072 (default ${before})`);
}

// ── 3. num_ctx is sent ONLY when asked for ─────────────────────────────────
// This is the whole safety argument for the change: every other generator keeps Ollama's own
// default and therefore its existing memory profile. Verified against the request body the module
// actually builds, by intercepting the HTTP layer rather than trusting the source.
{
  const http = require('http');
  const bodies = [];
  const realRequest = http.request;
  http.request = function (opts, cb) {
    const chunks = [];
    const fake = {
      on(ev, fn) { if (ev === 'error') this._err = fn; return this; },
      setTimeout() { return this; },
      write(d) { chunks.push(String(d)); },
      end() {
        bodies.push(chunks.join(''));
        const res = {
          statusCode: 200,
          setEncoding() {},
          on(ev, fn) {
            if (ev === 'data') fn(JSON.stringify({ message: { content: '{"ok":1}' } }));
            if (ev === 'end') fn();
            return res;
          },
        };
        cb(res);
      },
      destroy() {},
    };
    return fake;
  };
  const parseOpts = (i) => JSON.parse(bodies[i]).options || {};
  (async () => {
    await llm.callLLM('m', 'sys', 'user', 1024, {});
    assert.ok(!('num_ctx' in parseOpts(0)),
      'a normal call sends NO num_ctx — Ollama keeps deciding, memory profile unchanged');
    await llm.callLLM('m', 'sys', 'user', 1024, { ctxTokens: 12000 });
    assert.strictEqual(parseOpts(1).num_ctx, 12000, 'a caller that asks gets exactly what it asked for');
    await llm.callLLM('m', 'sys', 'user', 1024, { ctxTokens: 999999 });
    assert.strictEqual(parseOpts(2).num_ctx, llm.getNumCtxMax(), 'clamped to the ceiling');
    await llm.callLLM('m', 'sys', 'user', 1024, { ctxTokens: 100 });
    assert.strictEqual(parseOpts(3).num_ctx, 4096,
      'and never BELOW Ollama\'s usual default — asking for less would be a pessimisation');
    http.request = realRequest;
    console.log('  num_ctx: absent unless requested, clamped both ways');
    runRest();
  })().catch(e => { http.request = realRequest; throw e; });

  function runRest() {
    // ── 4. The chain budget: sized for a real storyline, trimmed from the oldest end ──
    // Measured against the bundled corpus when this was written: 75 of 294 chains exceeded the old
    // 6,000-char budget. The worst — a 14-chapter storyline at 46,758 chars — kept about three
    // chapters, so a question about chapter two could not be asked at all.
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
    const byId = new Map(store.topics.filter(t => t.id).map(t => [t.id, t]));
    const byName = new Map(store.topics.map(t => [t.topic, t]));
    const chainChars = (t) => {
      const seen = new Set(); let cur = t, total = 0, n = 0;
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        const s = String(cur.story || '').trim();
        if (s) { total += s.length + String(cur.topic || '').length + 4; n++; }
        const pid = cur.continuedFromId || (cur.continuedFrom ? byName.get(cur.continuedFrom)?.id : null);
        cur = pid ? byId.get(pid) : null;
      }
      return { total, n };
    };
    const chains = store.topics.map(chainChars).filter(c => c.n > 0);
    const overOld = chains.filter(c => c.total > 6000).length;
    const longestSingle = Math.max(...store.topics.map(t => String(t.story || '').length));
    assert.ok(overOld > 0,
      `the corpus really does contain chains the old cap would cut (${overOld}) — otherwise this change is untested against data`);
    // The single-chapter cap that was deleted: prove it was dead code, not a live protection.
    assert.ok(longestSingle < 6000,
      `no single chapter ever reached the deleted 6,000-char cap (longest ${longestSingle}) — it was dead code`);
    // And the new budget actually covers the corpus, so the trim is now the exception.
    const overNew = chains.filter(c => c.total > 40000).length;
    assert.ok(overNew < overOld / 5,
      `the new budget cuts far fewer chains (${overNew} vs ${overOld})`);
    console.log(`  corpus: ${overOld} chains over the old cap, ${overNew} over the new; longest single chapter ${longestSingle}`);

    // ── 5. The trim direction must survive ────────────────────────────────
    // The one property that must never regress: when a chain IS over budget, the CURRENT chapter
    // is kept whole and the OLDEST are dropped. Trimming the other way would silently remove the
    // chapter the questions are actually about.
    const fn = server.slice(server.indexOf('function collectChainStory'),
                            server.indexOf('function collectChainVocab'));
    assert.ok(/const current = out\[out\.length - 1\];/.test(fn), 'the current chapter is identified');
    assert.ok(/for \(let i = out\.length - 2; i >= 0; i--\)/.test(fn),
      'and predecessors are added newest-first, so the oldest fall off the end');
    assert.ok(/out\.reverse\(\)/.test(fn), 'the narrative still reads forwards');
    console.log('  trim direction: current chapter kept whole, oldest dropped');

    // ── 6. Question count is sized on the CURRENT chapter ─────────────────
    // Before v71_t this counted the whole chain, so every chained chapter asked the maximum 8
    // regardless of its own length. The 6,000-char cap hid it (a trimmed chain also always
    // produced 8) — same output, wrong reason, and the reason breaks once the chain is sent whole.
    const gen = server.slice(server.indexOf('async function generateComprehension'));
    assert.ok(/const sizingText = String\(story \|\| ''\)\.trim\(\) \|\| storyText;/.test(gen),
      'question count is sized on the current chapter, falling back to the chain');
    assert.ok(/const words = sizingText\.split/.test(gen), 'and the word count uses it');
    console.log('  question count: sized on the current chapter, not the chain');

    // ── 7. The last-resort fit to the ceiling ─────────────────────────────
    // The ceiling is a MEMORY decision and can legitimately sit below what a 40,000-char chain
    // needs (at the 16384 default: ~12,500 prompt tokens + 8,000 reply overflows it). When it
    // does, something must give — the point is that this code decides, not Ollama. Trimming from
    // the FRONT drops the oldest chapters and keeps the current one, which is last in the
    // assembled text; Ollama's own truncation makes no such promise and reports nothing.
    assert.ok(/let storyForPrompt = storyText;/.test(gen), 'the story starts whole');
    assert.ok(/storyForPrompt = '…' \+ storyForPrompt\.slice\(_cut\)/.test(gen),
      'and any last-resort trim takes from the FRONT — the oldest chapters');
    assert.ok(!/storyForPrompt\.slice\(0,/.test(gen),
      'never from the back, which would drop the chapter the questions are about');
    // Arithmetic check: the surviving text must actually fit the ceiling it was cut to.
    const ceiling = llm.getNumCtxMax();
    const replyTokens = Math.max(3000, Math.ceil(3200 * 2.5));
    const maxChars = Math.max(1000, Math.floor((ceiling - replyTokens - 512) * 3.2) - 1200);
    assert.ok(maxChars > 0, 'the derived character budget is positive');
    assert.ok(llm.estimateCtxTokens(maxChars + 1200, replyTokens) <= ceiling,
      `the trimmed size genuinely fits the ceiling (${maxChars} chars → within ${ceiling})`);
    console.log(`  ceiling fit: ${maxChars} chars survives at num_ctx ${ceiling}, trimmed from the oldest end`);

    console.log('unit-story-context: ALL PASSED');
  }
}
