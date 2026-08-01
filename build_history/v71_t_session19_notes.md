# v71_t — session 19 notes

The roadmap's next immediate item: **remove the 6,000-char story caps**. Its prescription was
incomplete, and the missing piece was the whole job.

Suite **156** (+1 new file), `check-inline` 0 on both builds.

---

## 0. The roadmap said "remove the caps, raise the timeout". That alone would have made it worse.

`num_ctx` was never set on the Ollama request. The model therefore ran at Ollama's default context
(~4,096 tokens), and **Ollama truncates an over-long prompt silently** — no error, no warning, the
request still succeeds and the model answers from whatever fragment survived.

So deleting the app-side cap would have moved the truncation from a DELIBERATE trim (keep the
current chapter whole, drop the oldest) into a BLIND one, while every attempt still looked like it
worked. That is a worse failure than the cap it replaced, because it is invisible — and it would
have been indistinguishable from success in exactly the live test the roadmap asked for.

Sizing the context window had to come first. That is the substance of this release; the cap
deletion is two lines.

## 1. Measured before changing anything

| finding | number |
|---|---|
| `MAX_STORY_CHARS` (single-chapter cap) — longest single chapter in the corpus | **4,691 chars** → the cap **never once fired**: dead code |
| `collectChainStory` 6,000-char budget — chains exceeding it | **75 of 294** |
| worst case (*The Two Tongues*, 14 chapters) | **46,758 chars** → roughly 3 chapters survived |

The single-chapter cap was protecting against a case that does not occur. The real loss was in the
chain, where a question about chapter two could not be asked at all — which is precisely what
comprehension questions are best at.

## 2. Changes

**`llm.js` — `num_ctx` support.** A settable ceiling (`NUM_CTX_MAX`, default 16384, env
`OLLAMA_NUM_CTX_MAX`) plus per-call `opts.ctxTokens`. Sent **only when a caller asks**: every other
generator keeps Ollama's own default, so this cannot regress the memory profile of normal
generation. `estimateCtxTokens` is deliberately pessimistic (3.2 chars/token, not the ~4 usual for
English) because this corpus is Japanese, Arabic, Greek and Swahili as well as Italian, and
under-estimating is the one failure mode that silently truncates.

The ceiling is a CEILING, not a fixed size — the KV cache grows with the context, so pinning a
large value would spend memory on every small call.

**`collectChainStory`** — budget 6,000 → 40,000 (`CHAIN_STORY_CHARS`). Trim direction unchanged
and now pinned by test: current chapter whole, oldest dropped.

**`generateComprehension`** — `MAX_STORY_CHARS` deleted; per-call `ctxTokens` + `timeoutMs`.

## 3. Two bugs found while doing it

**My own timeout would have REDUCED the think-mode limit.** `callLLMLesson` spreads the caller's
opts AFTER its own think policy (`{ ...pol, ...opts }`), so a `timeoutMs` passed by the caller wins
— including over the ×3 that `thinkOpts` applies when lessons-reasoning is on. My first version
passed ×2, which would have cut a reasoning run SHORTER than before while the commit message said
"raise the timeout". Now uses `THINK_TIMEOUT_MULT`, so it can only ever raise. **Standing point:**
`callLLMLesson`'s opts override the think policy — any caller passing `timeoutMs` or `tokens` must
check it is not lowering them.

**Question count was sized on the whole chain.** `n = clamp(words/90, 3, 8)` counted `storyText`,
which since v71_o is the chain — so every chained chapter asked the maximum 8 regardless of how
short it actually was. The 6,000-char cap hid it (a trimmed chain also always exceeded the ceiling
and produced 8): same output, wrong reason, and the reason breaks the moment the whole chain is
sent. Now sized on the CURRENT chapter, which is what the questions are about, falling back to the
chain when there is no single-chapter story.

## 4. A gap the new test exposed in my own fix

`estimateCtxTokens(40000 chars, 8000 reply)` = **21,012 tokens**, against a default ceiling of
16,384. So the very longest chains would STILL have hit silent truncation — the exact failure this
release exists to remove, reintroduced by picking the budget and the ceiling independently.

Added a last-resort fit: when the estimate exceeds the ceiling, trim to fit **from the front**
(oldest chapters; the current chapter is last in the assembled text and survives) and log it. The
principle is unchanged — a deliberate trim beats a blind one — and now it holds at any ceiling.

Net effect at the default ceiling: **~24,000 chars reach the model, versus 6,000 before.** Raising
the ceiling raises that directly.

## Revert-verified (three mechanisms, independently)

| revert | assertion that fires |
|---|---|
| `num_ctx` not sent | a caller that asks gets exactly what it asked for |
| trim from the back | any last-resort trim takes from the FRONT — the oldest chapters |
| count sized on the chain | question count is sized on the current chapter |

## Owed: the live check

**No test can judge whether this worked** — that is a judgement about the questions the model asks,
as the roadmap said. Generate a comprehension lesson on a long chain (*The Two Tongues*, or
*The Lion's Warning Revisited*, 13 chapters / 43,634 chars) and:

1. Watch for `Story context: … chars → num_ctx≈…, timeout …s` in the server log.
2. If the chain exceeds the ceiling you will also see `Story trimmed to fit context ceiling: …`.
   That line is not an error — it is the deliberate trim reporting itself, which is the whole point.
3. Then read the questions: do any reach BACK across chapters — a callback, a motive established
   earlier, something that changed since chapter two? That is the thing the caps were costing.

## Your decision: `NUM_CTX_MAX`

16384 is conservative, chosen without knowing the machine. It is a **memory** decision — the KV
cache grows with the context. If the hardware has headroom, `OLLAMA_NUM_CTX_MAX=32768` roughly
doubles the story that survives. It is deliberately NOT wired into the model menu yet: the v71_q
`numThread` setting is the obvious template, but adding a knob before knowing whether the default
is even right seemed premature. Say the word and it is a small follow-up.

## Deliberately not done

- **No model-menu UI for the ceiling** (above).
- **No change to the 3,200 token base** — v71_o raised it 2,200 → 3,200 and that fix was correct;
  this release does not touch it.
- **No change to `num_ctx` for other roles** (story, translation, QC, tutor). None of them sends a
  long prompt today. If the tutor ever gets chain context, it needs the same treatment.

## Still owed

Browser passes on `v71_i`–`v71_t` · the live comprehension check above · translate queue **380**.
Unchanged: error-hunt word alignment · tutor investigation (4) · book learning-arc form wiring ·
the two deferred cosmetics · hiding editing controls in live/non-teacher mode · decisions on drill
traceability and `el/storyboard.title`.

Open quality items: two readers for "is this chapter complete" (v71_s) · duplicate grammar targets
(v71_r).
