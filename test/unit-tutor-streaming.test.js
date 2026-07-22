// unit-tutor-streaming.test.js
// v64 — streamed tutor replies. Scoped deliberately: ONLY the tutor streams; stories, lessons, QC
// and translation keep the proven whole-reply path (streaming buys nothing for a JSON payload, and
// confining it to one caller keeps it away from the v59 metering choke point every other feature
// depends on). Contract:
//   • llm.js gains callLLMStream + makeThinkFilter; callLLM is untouched.
//   • Reasoning is suppressed AS IT STREAMS, including when a <think> tag straddles chunks — a
//     stream must decide what to emit before the end arrives, so stripThink() cannot be used.
//   • The route speaks SSE only when the client opts in (body.stream === true); the JSON path
//     remains as a fallback, so an old client or a failed stream still works.
//   • A client that navigates away mid-stream stops the writes rather than erroring.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llmSrc = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { makeThinkFilter } = require(path.join(ROOT, 'llm.js'));

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. Streaming reasoning suppression (the risky part) ──────────────────────
{
  const run = (chunks) => {
    const f = makeThinkFilter();
    let out = '';
    for (const c of chunks) out += f.push(c);
    return out + f.end();
  };
  assert.strictEqual(run(['Hello there.']), 'Hello there.', 'plain text passes through');
  assert.strictEqual(run(['<think>secret</think>Answer!']), 'Answer!', 'a whole think block is dropped');
  assert.strictEqual(run(['<think>a', ' b', '</think>', 'Answer!']), 'Answer!', 'a think block spanning chunks is dropped');
  // THE case stripThink cannot handle mid-stream: the tag itself split across chunk boundaries.
  assert.strictEqual(run(['<thi', 'nk>secret</thi', 'nk>Answer!']), 'Answer!', 'a SPLIT think tag is still dropped');
  assert.strictEqual(run(['<thinking>x</thinking>Hi']), 'Hi', 'the <thinking> spelling is handled too');
  assert.strictEqual(run(['<think>never closed']), '', 'an unterminated think block emits nothing');
  assert.ok(!run(['<think>SECRET</think>ok']).includes('SECRET'), 'reasoning content never reaches the caller');
  // Text is not corrupted by the hold-back buffer.
  assert.strictEqual(run(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']), 'abcdefghijkl',
    'many tiny chunks reassemble exactly (hold-back tail is flushed)');
}
console.log('  streaming think-filter: split tags, unterminated blocks, exact reassembly: OK');

// ── 2. llm.js surface: streaming added WITHOUT disturbing the whole-reply path ─
{
  assert.ok(/module\.exports = \{ callLLM, callLLMStream, makeThinkFilter,/.test(llmSrc),
    'callLLMStream + makeThinkFilter are exported alongside the untouched callLLM');
  const st = extFn(llmSrc, 'callLLMStream');
  assert.ok(/stream: true/.test(st), 'the streaming call asks Ollama to stream');
  assert.ok(/line\.indexOf\('\\n'\)/.test(st), 'NDJSON is parsed line-wise (a chunk may split a line)');
  assert.ok(/p\.message\?\.content \|\| p\.response/.test(st), 'content deltas are read from either field shape');
  // Inactivity timeout, not a total one: a stream producing tokens is healthy however long it runs.
  assert.ok(/const bump = \(\) =>/.test(st) && /clearTimeout\(idle\)/.test(st),
    'the timeout is reset on every chunk (inactivity, not total duration)');
  assert.ok(/settled/.test(st), 'the promise is settled exactly once (guards double-resolve on done+end)');
  // The whole-reply path still exists unchanged for every other caller.
  assert.ok(/stream: false/.test(llmSrc), 'the non-streaming call is still there for stories/lessons/QC');
}
console.log('  llm.js: streaming added, whole-reply path untouched: OK');

// ── 3. Server: SSE opt-in, JSON fallback preserved, abort handled ────────────
{
  const at = server.indexOf("url.pathname === '/api/tutor'");
  const route = server.slice(at, server.indexOf("url.pathname === '/api/story-qc'", at));
  assert.ok(/if \(body\.stream === true\) \{/.test(route), 'streaming is opt-in per request');
  assert.ok(/'Content-Type': 'text\/event-stream/.test(route), 'the stream is Server-Sent Events');
  assert.ok(/'X-Accel-Buffering': 'no'/.test(route), 'proxies are told not to buffer the stream away');
  assert.ok(/send\(\{ delta \}\)/.test(route), 'deltas are streamed to the client');
  assert.ok(/send\(\{ done: true, reply, promptTokens, completionTokens \}\)/.test(route),
    'a terminal frame carries the full reply and token counts');
  // Abort: the learner closing the widget must not blow up the handler.
  assert.ok(/aborted = true/.test(route), 'client disconnect is detected');
  assert.ok(/if \(aborted\) return;/.test(route), 'writes stop once the client is gone');
  // The JSON path survives untouched as the fallback.
  assert.ok(/const \{ text, promptTokens, completionTokens \} = await callLLMTutor\(sys, userMsg, 500\);/.test(route),
    'the whole-reply JSON path is still present as a fallback');
  // Only the tutor streams.
  assert.strictEqual((server.match(/callLLMTutorStream\(/g) || []).length, 2,
    'the streaming wrapper is defined and used exactly once — no other role streams');
  const w = extFn(server, 'callLLMTutorStream');
  assert.ok(/thinkOpts\('tutor', maxTokens\)/.test(w), 'streaming honours the tutor reasoning policy');
}
console.log('  server: SSE opt-in, abort-safe, JSON fallback intact, tutor-only: OK');

// ── 4. Client: live bubble + graceful degradation ────────────────────────────
{
  assert.ok(/let _tutorStreaming = '';/.test(html), 'a buffer holds the in-flight reply');
  const rd = extFn(html, '_tutorReadStream');
  assert.ok(/getReader\(\)/.test(rd) && /TextDecoder/.test(rd), 'the SSE body is read incrementally');
  assert.ok(/msg\.delta/.test(rd) && /msg\.done/.test(rd) && /msg\.error/.test(rd), 'all three frame kinds are handled');
  // A stream cut short must not lose what already arrived.
  assert.ok(/if\(!finished && _tutorStreaming\.trim\(\)\)/.test(rd),
    'a truncated stream keeps the partial reply instead of discarding it');
  // Fallback when streaming is unavailable.
  const send = extFn(html, '_tutorSend');
  assert.ok(/_tutorCanStream\(\) && ct\.includes\('text\/event-stream'\) && r\.body/.test(send),
    'streaming is used only when the client and response both support it');
  assert.ok(/data=await r\.json\(\)/.test(send), 'otherwise the whole-reply JSON path is used');
  assert.ok(/_tutorState\.busy = false; _tutorStreaming = '';/.test(send), 'state is always reset in finally');
  const cs = extFn(html, '_tutorCanStream');
  assert.ok(/ReadableStream/.test(cs) && /TextDecoder/.test(cs), 'capability is feature-detected, not assumed');
  // The live bubble replaces "thinking…" once the first token lands.
  const rn = extFn(html, '_tutorRender');
  assert.ok(/if\(_tutorStreaming\) html \+= bubble\(\{ role:'tutor', text:_tutorStreaming \}\);/.test(rn),
    'the in-flight reply renders as a live bubble');
  assert.ok(/else if\(_tutorState\.busy\)/.test(rn), '"thinking…" shows only until the first token arrives');
}
console.log('  client: live bubble, truncation-safe, feature-detected fallback: OK');

console.log('unit-tutor-streaming: ALL PASSED');
