# v59 — cumulative token usage across all LLM calls (roadmap item 3)

One feature session on v58. Plan file: `roadmap_v59.md`.

## The design

The item's trap is per-site plumbing: the multi-call QC flow discards token counts inside its
per-item checkers, and chasing every call site individually is exactly the class of "forgot one"
bug this codebase keeps killing with choke points (upsert→createdBy, provLineHtml, _ttsPickVoice).
So: **one choke point.** Every server-side LLM call already converges on the `_callLLM` import
wrapper; v59 renames the raw import to `_rawCallLLM` and makes `_callLLM` a metering wrapper.
An **AsyncLocalStorage** (node builtin — zero-dep constraint intact) holds the active meter per
async context; `meterLLMTokens(fn)` runs `fn` in a fresh scope and resolves `{ result, tokens }`.
Concurrent jobs (background QC sweep + foreground summary generation) get separate contexts and
can never cross-attribute — this is executed, not assumed, by the unit test (two interleaved
scopes with randomized await delays). Calls outside any scope count nowhere here: the initial
generation pipeline keeps its own accumulation and is deliberately NOT wrapped (double count).
A throwing scope loses its tokens to accounting (the route 500s) — accepted and documented; the
QC sweep attributes per topic precisely to keep that window small.

## The attribution decision (the item demanded one)

- **Storyline-level artefacts → the STORYLINE** (`sl.tokenUsage`), not chapter 1, not spread:
  summary (route AND batch post-pass), storyboard, retitle (both scopes and the batch title
  steps — ONE call covers the whole chain; splitting it across N chapters would be noise),
  summary-QC. The storyline screen shows this bucket as its own line.
- **Chapter-scoped work → the chapter's `generationStats`** — the SAME
  `totalPromptTokens/totalCompletionTokens` the initial generation writes, so "total" finally
  means total: story-QC (route and sweep), lesson-QC sweeps, add-lesson, per-chapter recreate
  (the roadmap's exact example: re-generating ADDS instead of being invisible).
- Both carry a compact `tokensByType` tally. `totalMs` is untouched — it still means
  generation time; only tokens are cumulative.
- Subtlety: a QC sweep where every item comes back clean still consumed tokens — nonzero
  metered tokens mark the topic `touched`, so the accounting persists even with zero flags.
- A topic with no `generationStats` at all (imported/legacy) gets a defensive shell labeled
  `model: '(post-gen)'` — honest, never a fake model name.

## Sites wired (12)

summary ×2 (route + batch post-pass — **the v53_c stamp test caught the second call site** I
had missed; fixed the code, not the test), storyboard ×1, retitle ×3 (route 2 scopes + batch
title step) + batch chapter-title step ×1, summary_qc ×1, story_qc ×2 (route + sweep),
lesson_qc ×1 (sweep, the whole per-lesson loop in one metered closure — verified no
return/break escapes the closure), add_lesson ×1, recreate ×1 (per chapter). The retitle route
now persists via `upsertStoryline` for BOTH scopes (chapters-only scope previously relied on
`_applyChapterTitles`'s own `saveStore`, which still runs; the extra upsert persists the token
bucket).

## Display

Storyline screen stats block: appended `Storyline: N tokens (summary … · storyboard …)` line
from `sl.tokenUsage` (flows to live via /api/storylines and to static via the whole-object
bake — no projection change needed). Chapter page: the gen-stats line keeps its exact text but
gains a tooltip breaking the cumulative total into `initial generation: N` + per-type tallies.
The v55_s 4-field `/api/lessons` projection keeps its FIELD NAMES; values just grow.

## Tests

New `unit-token-usage.test.js` (registered; suite now **107 green**): section 1 is BEHAVIORAL —
the real `_callLLM`/`meterLLMTokens` bodies extracted and run against fake async backends,
including the concurrency non-cross-attribution proof; section 2 exercises `addTokenUsage`
semantics (cumulative totals, storyline bucket discrimination via `chapters`, per-type tally,
no-op on zero, defensive shell); sections 3–4 pin the 12 wiring sites, clean-sweep persistence,
the not-wrapped initial pipeline, the single `_rawCallLLM` convergence, display hooks, and the
v55_s projection names. Three QC sandbox tests (`dispatch`, `skip`, `collect`) gained
functional meter stubs (zero tokens; accounting is this test's job); the storyboard and
summary-stamp call-site guards were updated to the metered destructure shapes. Live smoke: the
server boots and serves /api/info and the 267-topic projection with the wrapper in place.

## i18n (protocol rule 3)

Two en-only keys: `tokens.storyline` ("Storyline"), `tokens.initial` ("initial generation").
Pending translate pass now totals **12 keys × 29 languages**.

## How to see it work (browser + Ollama; per protocol rule 2)

Open a chapter page and note its token total in the gen-stats line. Run story QC (🔍) on it, or
add a lesson (➕): the total GROWS by that call's tokens, and hovering the line shows the
breakdown ("initial generation: … · story_qc: … · add_lesson: …"). On a storyline screen,
generate/regenerate the summary or storyboard, or re-title: a new "Storyline: N tokens (…)"
line appears in the stats block at the bottom and grows with each run. Run a full storyline QC
sweep where nothing gets flagged: the chapters' totals still grow (clean answers cost tokens
too). All numbers survive a server restart (persisted), and the static build shows the same
numbers read-only.
