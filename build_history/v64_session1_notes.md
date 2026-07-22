# v64 — streamed tutor replies

Fourth step of the tutor arc (v61 end-of-chapter → v62 persistent widget → v63 per-question help →
v64 streaming). The most invasive change of the four, so the scope was cut deliberately.

## Scoping decision: ONLY the tutor streams

Stories, lessons, QC and translation keep the proven whole-reply call. Streaming buys nothing for a
JSON payload that must be parsed in full anyway, and — more importantly — the whole-reply path runs
through the v59 metering wrapper that every other feature depends on. Adding a second, streaming
path *beside* it rather than converting it keeps the blast radius to one route.

`llm.js` therefore gains `callLLMStream` as a **separate** function; `callLLM` is untouched.

## The hard part: suppressing reasoning mid-stream

`stripThink()` operates on a complete string. A stream must decide what to emit *before* the end
arrives, and a `<think>` tag can straddle a chunk boundary (`"<thi"` + `"nk>"`). Emitting a
reasoning block to the learner would be a visible correctness failure.

`makeThinkFilter()` is a small state machine: it tracks whether it is inside a reasoning block, and
when it is not, it emits everything except a 10-character tail that might still turn out to be a
partial opening tag. On `end()` it flushes the held-back tail — unless the stream died mid-thought,
in which case it emits nothing.

Verified against split tags, the `<thinking>` spelling, unterminated blocks, and 12 single-character
chunks reassembling exactly. Also proven end-to-end: a fake streaming Ollama emitting
`<think>internal SECRET reasoning</think>` produced **zero** occurrences of the secret in the SSE
frames, on both the streaming and the whole-reply path.

## Transport

Server-Sent Events, opt-in per request (`body.stream === true`). Frames are `{delta}`, then a
terminal `{done, reply, promptTokens, completionTokens}`, or `{error}`. `X-Accel-Buffering: no` stops
a reverse proxy from buffering the stream away. The handler watches `req.on('close')` so a learner
who closes the widget mid-reply stops the writes instead of erroring.

**The whole-reply JSON path is untouched and still there.** A client that doesn't ask to stream, or
one lacking `ReadableStream`/`TextDecoder`, gets exactly the previous behaviour — the client
feature-detects rather than assuming.

## Client

`_tutorStreaming` holds the in-flight reply; `_tutorRender` draws it as a live bubble, so
"thinking…" disappears the moment the first token lands. `_tutorReadStream` splits SSE frames,
handles all three kinds, and — if the stream is cut short without a terminal frame — keeps what
already arrived rather than discarding it. State is reset in `finally`, so a failure can never leave
the widget stuck busy.

## A guard that fired for the right reason

`unit-token-usage` failed on the v59 convergence assertion: `_rawCallLLM` matched 4 times, not 2.
The cause was benign — `_rawCallLLMStream` merely shares the prefix — but the guard was doing its
job, since a genuine second consumer of the raw whole-reply call would look identical. Fixed by
making the match word-bounded and adding a matching pin for the streaming import, so both
"the raw call is reachable only through the meter" and "the streaming call is used only by the tutor
wrapper" are now enforced separately.

## Tests

New `unit-tutor-streaming.test.js` (suite **115 green**): the think filter run for real across split
tags/unterminated blocks/tiny chunks; llm.js surface (NDJSON line parsing, inactivity timeout,
settle-once, whole-reply path still present); the route (SSE opt-in, well-formed frames, abort
handling, JSON fallback intact, streaming used by the tutor and nothing else); and the client (live
bubble, truncation safety, feature-detected fallback).

## How to see it work (browser + Ollama)

Open the tutor anywhere and ask something. The reply now appears word by word instead of after a
pause. With tutor reasoning enabled (🧠 in the model menu) the thinking phase stays invisible — you
see nothing until the actual answer starts, then it streams. Close the widget mid-reply: the server
stops writing rather than erroring. Everything else in the app is unchanged: story and lesson
generation still use the whole-reply path.

## Still open (roadmap_v64.md)

Server-side learner state (cross-device threads + a teacher view); Stage 3 concept graph; plus the
standing non-tutor items and ~45 accumulated en-only i18n keys.
