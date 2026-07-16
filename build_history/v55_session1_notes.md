# v55 — Session 1 notes: storyline SVG storyboard 🎬

**Session arc:** spike verdict → build. This session started as the spike hand-off (see the two
addenda at the end of `v53_session1_notes.md`): run 1 exposed the llm.js socket-inactivity timeout;
run 2 (with the hardened spike: warmup, 60-min timeout, tok/s reporting) PASSED — 3/3 valid panels,
attempt 1, `qwen3.6:35b-a3b`, 918 prompt / 4096 completion tokens, 1829s ≈ **2.2 tok/s**, user
verdict "not great but recognisable, we can use that." Feature then built to the roadmap_v54
▶ NEXT BUILD spec. Full shipped summary: top of `roadmap_v55.md` (kept single-sourced there).

## Spike findings that shaped the build (the why behind three decisions)
1. **`completionTokens === 4096` — the cap, exactly.** The live response was TRUNCATED and
   `salvageArray` repaired the cut-off tail into 3 clean panels. So the generator budgets
   **6000 tokens**, and the salvage chain is not optional politeness — it converted a truncated
   response into the passing spike.
2. **2.2 tok/s → ~30 min per storyboard** on the user's box. The route stays a synchronous clone of
   `/api/storyline-summary` (the roadmap decided that), made survivable by the new **llm.js
   `opts.timeoutMs`** per-call override (clamped 30s–60min, honored by BOTH the socket timeout and
   the belt-and-braces guard timer — the v53_c timer-clearing lesson still applies). The root cause
   writeup (socket-INACTIVITY timeout on a `stream:false` request) is in the run-1 addendum.
   **Job/polling remains the carried fallback** if sync proves unacceptable live.
3. **`warmup()` mislabelled every failure "timed out".** A thinking model spends the 1-token warmup
   budget inside its reasoning block → empty answer → generic catch. It now prints the real error.
   (The warmup still does its job either way — the model gets loaded.)

## Build order (per protocol, suite green after each)
1. **Server:** llm.js timeoutMs → prompts.json `storylineStoryboard` (the exact live-proven spike
   prompt) → `composeStoryboardSVG` + `generateStorylineStoryboard` + route → `unit-storyboard`
   registered. Suite 98 green.
2. **Client:** 🎬 button (after 📝, gated canGenerate AND ≥2 chapters), title localization,
   `genStorylineStoryboard()`, storyboard strip above the summary in BOTH the storyline screen and
   the landing card, 3 ui.json en keys. Suite green after one caught bug (below).
3. **Release:** APP_VERSION v55, static rebuild (docs carries v55 + the new code; storylines bake
   whole so `sl.storyboard` rides automatically), LIVE-TEST §79, roadmap_v55.md, these notes.

## Bugs caught DURING the session (before any user could)
- **`escHtml` in an attribute** (aria-label) — caught by `unit-attr-escaping`, the guard born from
  the word_forms truncation bug. Fixed to `escAttr` in both render spots, including the
  string-concat form the guard's regex cannot even see. The suite paying rent.
- **My own test was too blunt:** it grepped for `foreignObject`/`onerror=` as substrings and failed
  on their ESCAPED (i.e. correctly neutralised) forms inside text nodes. Rewritten to assert the
  actual security property: the emitted TAG SET equals the composer's whitelist, and no tag carries
  an event/href attribute. Neutralised ≠ absent.
- **Inline-bake probe:** a caption containing `</script>` cannot survive into `sl.storyboard`
  un-escaped (it would otherwise end the static build's inline `<script>` block). Verified by
  running the extracted composer against exactly that input.

## Composer design notes (for whoever touches it next)
- It is **self-contained on purpose** (constants + helpers nested inside the function) so
  `unit-storyboard` can extract-and-run it pure, per the suite's `ext()` idiom. Do not "tidy" the
  helpers out to module scope — that breaks the test's execution model.
- Output SVG is **responsive** (viewBox + `width:100%;max-width`), no fixed pixel size — panels fit
  the storyline card on mobile.
- Palette names are the model's ONLY color vocabulary; unknown names fall back (fill→ink,
  stroke→none, bg→paper). Raw color strings from the model are never emitted.

## i18n — keys owed to the TranslateGemma pass (protocol rule 3)
New **en-only**: `storyboard.gen` ("🎬 Generate storyboard"), `storyboard.title` ("Storyboard"),
`storyboard.empty` ("The model produced no usable storyboard panels — try again."). The standing
debt (1630 keys / 29 langs, all of `sw`, plus v54's 4 `drill.*` keys) grows by these 3.

## Owed / next session
- **LIVE-TEST §79** (user, browser + Ollama): button gating (≥2 chapters), ⏳→panels above summary in
  both places, persistence + stamp, clean re-generate, offline render in docs, the EXPLICIT
  injection check, the empty-state toast, and the >12-min survival.
- LIVE-TEST §§72–78 still unrun from prior sessions.
- Carried storyboard follow-ups (see roadmap_v55 "Still open"): job/polling fallback, panel-quality
  tuning, no delete-UI.
- `spike-storyboard.js` is now REDUNDANT with the shipped feature (kept this release for the user's
  own re-runs / prompt tuning; delete whenever — nothing imports it).

## Files touched
`llm.js` (timeoutMs, warmup message), `prompts.json` (+storylineStoryboard), `server.js` (composer,
generator, route, APP_VERSION v55), `index.html` (button, gate, localization, 2 render spots,
genStorylineStoryboard), `ui.json` (+3 en), `test/unit-storyboard.test.js` (new),
`test/run.js` (+1), `docs/index.html` (rebuilt), `build_history/` (LIVE-TEST §79, roadmap_v55.md,
roadmap_v54.md shipped-marker, these notes).

**Final state:** suite **98 green**, check-inline **0** on both builds, `APP_VERSION v55`.

---

# v55_b — silent-failure observability (first live run died invisibly)

**Live run (user, 2026-07-13):** 9-chapter de storyline on `qwen3.6:35b-a3b` — console printed the
generation header, then NOTHING, and `ollama ps` went empty. Diagnosis facts: (a) the per-call
60-min timeout WAS in effect (callLLM forwards opts — verified; the picker's `timeout:720s` is the
global, which the override bypasses); (b) `keep_alive: -1` means models never self-unload, so an
empty `ollama ps` = **Ollama or its runner DIED**, not finished-and-idled; (c) both failure paths
(runner crash → network error; garbage response → non-array throw) ended in the route's silent
`catch → json 500` — the browser toast was the only witness. Inherited from the summary route,
where a silent 30-second failure is tolerable; for a 30-minute call it is not.

**Fixed (server-only):** the generator logs response ARRIVAL before parsing (elapsed + tokens +
tok/s) and a 200-char raw excerpt on the non-array throw; the route catch logs
`✗ Storyline storyboard FAILED after Ns: <msg>`. Guarded by three new `unit-storyboard` assertions.
Suite 101 assertions-wise / 98 steps green, check-inline 0 both builds, APP_VERSION v55_b
(static rebuilt for the derived version only — no client change).

**NOT yet fixed (needs the user's evidence):** the actual crash. Prime suspect is memory: with
`keep_alive:-1`, every model touched this boot stays resident (qwen2.5:7b was warmed at startup,
then the 35B was loaded on top), and the 9-chapter prompt + num_predict 6000 grows the KV cache.
Check `journalctl -u ollama --since "today" | tail -80` (or the Ollama log) and
`dmesg -T | grep -i -E "oom|killed"` around the run's time window. If OOM confirmed, options:
restart Ollama before storyboard runs, have the model picker release the previous model, or a
finite keep_alive. The summary route shares the silent catch — extend the same logging there if it
ever bites (deliberately not touched now, one change at a time).

---

# v55_c — think:false for the storyboard (second live failure, root-caused by v55_b's logging)

**Live run 2 (user, 2026-07-13):** 4-chapter de storyline, `qwen3.6:35b-a3b` →
`✗ FAILED after 1279s: Ollama returned empty response`. NOT a crash — Ollama answered, with
nothing in it. Mechanism: qwen3.6 is a thinking model and Ollama's NATIVE thinking support routes
reasoning into `message.thinking` while `message.content` stays empty until thinking ends. The run
burned the entire `num_predict 6000` inside the reasoning block (1279s ≈ 6000 tok at ~4.7 tok/s —
the arithmetic fits), so `content` was `''` → llm.js line-160 reject. Same mechanism as the v55
warmup mislabel, at full scale. The spike's earlier pass on this model was luck (thinking length is
nondeterministic).

**Fix:** the storyboard call now passes `think: false` (storyboard layout is mechanical JSON —
chain-of-thought adds nothing and at ~2–5 tok/s costs everything). Plumbing is generic:
`opts.think === false` adds the top-level `/api/chat` field in `_callOllama`, and `callLLM` retries
once WITHOUT it if the model rejects the parameter (`does not support thinking`) — so qwen2.5:7b
et al. keep working as the story model. NOT applied to any other generator (one change at a time),
but note the hazard is shared: lessons/summaries/QC on a thinking story model can burn budget the
same way — if it bites, the same one-line opts addition fixes each call site. Guarded by three new
`unit-storyboard` assertions (conditional body field, fallback retry, generator opts).

**Expected effect on the user's box:** content generation starts immediately; a storyboard is
~1000–2000 JSON tokens → roughly 4–15 min on the 35B instead of 21+ min of silent thinking, and
the empty-response failure mode is gone. Run 1's crash (empty `ollama ps`) remains a SEPARATE open
item — journal/dmesg evidence still owed.

Suite green, check-inline 0 both builds, APP_VERSION v55_c (static rebuilt for version derivation).

---

# v55_d — captions become hover tooltips (user refinement)

The always-on caption text row under each panel is dropped; the caption is now a hover-only
`<title>` inside each panel's `<g>` (also the accessible choice — screen readers announce it).
User's two calls: drop the band entirely (no always-visible fallback), and keep panels at 170px
(the height just loses the 30px band → outer viewBox height 194 = 170 + 2×12, was 224).

Composer change only (`composeStoryboardSVG`): removed the `CAPTION_H` constant and the `<text>`
caption line; each panel is wrapped in `<g><title>…</title> frame + art </g>` so hover covers the
whole panel. `unit-storyboard` updated: captions asserted as `<title>` tooltips not visible
`<text>`, height-has-no-band (194) assertion, and the tag-set whitelist gains `g`+`title`. The
security surface GREW slightly — the caption now flows into `<title>` — so a new assertion checks a
hostile caption is escaped INSIDE the title (`<title>&lt;script&gt;…`); verified.

Tradeoff accepted (user-chosen): hover-only means no caption on touch devices. Not a regression to
fix — it's the requested behaviour. Suite green, check-inline 0 both builds, APP_VERSION v55_d.

---

# v55_e — storyboard delete (toggle-menu on the 🎬 button)

User asked for a delete affordance. Chosen interaction (user's call): the SINGLE 🎬 button is
stateful — no storyboard yet → generate directly; storyboard present → a `showChoiceDialog`
regenerate/delete menu. Keeps the title row to one button.

- **Server:** `DELETE /api/storyline-storyboard` — removes `storyboard` + `storyboardMeta`,
  persists, idempotent (absent → 200), and deliberately does NOT require an LLM backend (you can
  always remove a picture; matters when Ollama is down). Mirrors the existing
  `DELETE /api/lessons/delete` posture.
- **Client:** `onStorylineStoryboardBtn()` dispatcher (button now calls this, not the generator
  directly) branches on `_slHasStoryboard()`; `deleteStorylineStoryboard()` clears the in-screen
  strip, the `APP.storylines` cache, and refreshes the landing card. Button title flips
  gen↔menu in the visibility gate.
- **i18n (4 en-only):** `storyboard.regenerate`, `storyboard.delete`, `storyboard.deleted`,
  `storyboard.menu`. Added to the growing TranslateGemma debt.
- **Tests:** `unit-storyboard` gained a DELETE-route contract block (removes both fields, no-backend,
  idempotent) + client-wiring assertions (dispatcher, menu options, cache clear, ui keys).

**Deliberate limitation — no delete in the STATIC build.** The button is gated on
`canGenerate`, which is false in `docs/` (published read-only artifact; baked storyboards are
immutable there like all baked content). The DELETE route is backend-free so the SERVER build can
delete even with Ollama down — that's the case that matters. If offline delete is ever wanted, it's
a static-`init()` + localStorage-override change (same shape as the filter-persistence note), not a
route change.

Suite green, check-inline 0 both builds, APP_VERSION v55_e.

---

# v55_f — translation provenance stamp (roadmap "translation stamp" item)

Closes the provenance arc: story (v53_d/e) and storyboard (v55) were stamped; translation was the
last generator whose `generationStats.models.translation === null` conflated "no separate pass ran"
with "unknown". Per the roadmap: "same treatment as the story; small."

**Audit first (corpus, not memory):** unlike the story (whose per-artefact ms/tokens were wholly
missing), translation provenance was ALREADY recorded at topic level for 243/267 in
`models.translation`. Only 2 topics carry a `storyTranslation` artefact and 2 a `userTranslation`;
the rest ran a distinct translation model (recorded) or folded translation into the story model.
So the real gap was the null-conflation, not a missing stamp.

**Server (`server.js`):** `_translationMeta` mirrors `_storyMeta`, stamped in four distinguishable
states — `generated` (distinct translation model, model = OLLAMA_TRANSLATION_MODEL, timed+tokens),
`failed` (attempted, threw → '(none)'), `user-provided` (userTranslation supplied), and
`skipped-same-model` (translation model == story model, no pass). Persisted as `topic.translationMeta`
on BOTH upserts (early-save + final), beside `storyMeta`. `generationStats.models.translation` is
deliberately UNCHANGED — the stamp is additive, disambiguation lives in `translationMeta.origin`,
exactly as `storyMeta` sits beside `models.story`.

**Backfill (`backfill-provenance.js` extended):** `stampTranslationMeta(t)` derives from the record —
`models.translation` set → generated; `userTranslation` → user-provided; `models` present with
`translation === null` → '(none)' skipped-same-model (a POSITIVE "not run" record, independent of the
story model — user stories have `models.story === null` too); no `models` block at all → '(unknown)'.
Runs on the story-SKIP path too (all 267 already have storyMeta, so the story stamper `continue`s —
a loop-end-only translation stamper would never fire; this was a real bug caught in dry-run:
`translationMeta written: 0` until refactored into a function called on both paths). Idempotent; the
no-op guard now counts translation changes. Corpus result: 241 generated, 16 '(none)', 2
user-provided, 8 '(unknown)' = 267. The 8 unknowns are exactly the pre-`models`-field topics.

**Tests:** `unit-translation-stamp` (mutation-tested origin⇔model coherence both directions, backfill
idempotency + skip-path firing + no-op guard, additive-to-models invariant). Suite 99 green,
check-inline 0 both builds. Static rebuilt (corpus baked → 267 translationMeta in docs). `.bak`
removed. APP_VERSION v55_f.

**Owed:** nothing browser-only (server + data + headless test). Consumers of `translationMeta` must
handle the '(none)'/'(user-provided)'/'(unknown)' sentinels and treat `.backfilled` as
inferred-not-recorded — same contract as `storyMeta`.

---

# QC for generated texts — SPIKE (no product change)

Picked the "QC for generated texts" roadmap item and applied the spike-first discipline the
storyboard taught us: this feature wants live-model tuning, and its whole design hinges on ONE
unknown — does the QC model CORRECT (targeted edits) or REWRITE (wholesale)? The "too many changes"
guard the roadmap calls for needs a threshold, and a threshold needs data. So: measure before
building. Built **`spike-qc-correct.js`** (root, throwaway, imported by nothing).

**Audit finding that shrinks the feature:** the BACK half already exists. `ai_error_hunt` +
`storyDiffSentences` already build an error-hunt lesson from an (aiStory, correctedStory)
sentence-level diff — today driven by a HUMAN editing `topic.story`. The QC feature just swaps the
human corrector for a QC-model corrector, stored as a PROPOSAL (never overwriting `topic.story`
without acceptance). Pieces already present: `OLLAMA_QC_MODEL` (v52_e), `qc.by`/`qcByModel` stamping
(v52_g), the per-model collect-compare UI, and the entire diff→lesson rebuild path (server.js
~4147). What's missing is the FRONT half: a correction prompt, proposal storage, an accept flow, and
the inverse "too many changes" guard.

**What the spike does:** runs a conservative "proofread, don't rewrite" correction prompt through
the QC model on N real corpus stories, diffs original↔corrected with storyDiffSentences lifted
VERBATIM from server.js, and classifies each as clean / corrected / rewrite via two independent
signals (changed-sentence ratio ≤0.5 AND word-level Levenshtein ratio ≤0.35 = corrected; above =
rewrite). Dumps .orig/.corrected/.diff.json per story + summary.json. `think:false` (v55_c lesson).

**Verified headlessly (no Ollama here):** the classifier separates the three cases cleanly on
synthetic pairs — identical→clean, one spelling fix→corrected (ratio 0.5, wordΔ 0.125), total
rewrite→rewrite (1.0/1.0). 69 candidate corpus stories across 9 languages. Suite still green,
no product file touched, no version bump.

**Owed — the live verdict (user):** run e.g. `OLLAMA_QC_MODEL=qwen2.5:7b node spike-qc-correct.js
--n 8`, eyeball a few .corrected.txt against .orig.txt, and read the tally. GO if there's a clean
'corrected' band with a separable 'rewrite' tail (→ the guard is feasible; build front half: `storyQc`
prompt in prompts.json, proposal storage, accept flow reusing the ai_error_hunt rebuild, threshold
as the guard). NO-GO if corrected≈rewrite are muddled (→ the prompt isn't holding "don't rewrite";
fix the prompt or reconsider before building UI on an unproven corrector). Report the tally + a
couple of diffs and I'll take it from there.

---

# v55_g — QC for generated texts: correction proposal + auto error-hunt (SHIPPED)

Spike verdict was a clean GO. The `summary.json` pinned the guard from real data: the 'corrected'
band topped out at changedRatio 0.21 / wordEditRatio 0.033; the single rewrite (a broken
translategemma:4b Luxembourgish story the QC model near-fully rewrote to fix) sat at 0.938 / 0.844.
A wide empty gulf → thresholds set at **0.6 / 0.5** with margin on both sides. The rewrite case also
taught the design: a genuinely-broken story requires so many fixes it reads as a rewrite, and that's
exactly what the guard must catch — a 0.844 diff makes a noise error-hunt, and silent wholesale
replacement isn't QC. So a rewrite is surfaced (rejected:true) with a "too broken to QC" message, not
silently applied.

**Audit shrank the build:** the BACK half already existed. `ai_error_hunt` + `storyDiffSentences`
already build the lesson from an (aiStory, corrected) diff (human-driven). The feature swaps the
human corrector for a QC-model corrector, stored as a PROPOSAL.

**Server:** `classifyStoryQc` (pure — clean/corrected/rewrite via OR of the two spike ratios) +
`generateStoryQc` (QC model, think:false per v55_c, prompt `storyQc` in prompts.json, stamps
`story_qc` with verdict/ratios, NEVER mutates topic.story). Three routes: `POST /api/story-qc`
(propose — persists `topic.storyQcProposal` with the exact `against` original; requires backend),
`POST /api/story-qc/accept` (apply — pins `aiStory` to the original, sets `story`, stamps
`storyQcBy`/`storyQcAt`, rebuilds ai_error_hunt from the diff, consumes the proposal; NO backend —
pure application; 409 if the proposal was a rewrite), and `POST /api/story-qc/discard`. `callLLMQC`
extended to forward opts (think).

**Client:** 🔍 button by the story ✏️ edit toggle (gated canGenerate + story present). `runStoryQc`
→ review panel (reuses #aeh-diff-panel) with an inline word-level diff, verdict header, and
Accept/Discard (rewrite → Discard-only + warning). Proposal persists across reload (re-rendered on
story open). 8 en-only ui keys (`qc.*`).

**Tests:** `unit-qc-correct` — the three verdicts on spike-shaped inputs, the OR-guard mutation-tested
on BOTH axes (word-edit alone; sentence-ratio alone), the boundary just under threshold, generator
contract (think:false, no story mutation, story_qc stamp), and the full 3-route contract (propose
never writes story; accept pins aiStory + rebuilds hunt + 409s a rewrite; backend-requirement
asymmetry). Suite 100 green, check-inline 0 both builds, static rebuilt, APP_VERSION v55_g.

**Owed:** LIVE-TEST §80 (browser + Ollama). `spike-qc-correct.js` now redundant with the feature
(kept for the user's own prompt/threshold tuning; delete whenever). The QC-of-SUMMARIES half of the
roadmap item is NOT built — only stories; summaries would be a parallel route over
`sl.summary`/`generateStorylineSummary` if wanted. Consumers: `topic.storyQcProposal` is transient
(deleted on accept/discard); `storyQcBy`/`storyQcAt` are the persisted provenance.

---

# v55_h — fix: story QC crashed with "stripThink is not defined"

User's first live QC run (Italian, qwen2.5:7b, 414 chars) crashed after 77s: `stripThink is not
defined`. NOT a model issue — a plain import bug: `generateStoryQc` called `stripThink(text)` but
server.js's llm.js import (line 12) never included `stripThink` (I copied the two-function
`stripRaw(stripThink(...))` pattern from the spike, which imported both). Any model hits it; the
crash is before the model output matters.

**Fix (one line):** `stripRaw` ALREADY calls `stripThink` internally (llm.js:104), so the wrapper
was redundant — dropped it: `stripRaw(text).trim()`. No new import needed.

**Why the test missed it:** `unit-qc-correct` extracted `generateStoryQc` as a STRING and
regex-checked it; it never RAN the function, so an undefined bare identifier inside slipped through.
Added a regression guard: for every llm.js export the server calls as a bare identifier, assert it's
imported (or locally defined). Verified the guard FAILS on the reintroduced bug and passes on the
fix. Audited all 12 llm.js exports — `stripThink` was the only gap.

Suite 100 green, check-inline 0 both builds, APP_VERSION v55_h. LIVE-TEST §80 QC re-run is now
unblocked with ANY model (no model restriction — the crash was code, not qwen2.5:7b).

---

# v55_i — QC guard: detect mechanically-corrupted corrections (run-together words)

User ran QC (qwen2.5:7b) on a qwen2.5:7b-generated Italian story; the model returned the quoted
sentence "Che vita avrebbero avuto…?" with ALL interior spaces collapsed into one 49-char word,
and the diff panel showed the mangled run-together text. Diagnosed by reproducing the full pipeline:
the client splitter AND inline-diff are CLEAN (verified on the exact sentence — spaces preserved);
`stripRaw`/`stripThink` don't touch interior whitespace. Root cause = the QC MODEL itself collapsed
the spaces (a known small-model failure mode inside quotes). The real correction underneath was
legit (avuto→avute, feminine-plural agreement), but the whitespace mangling made it garbage.

Not a code bug — but a guard GAP: a "correction" that mangles text mechanically is not a valid
proofread and must be rejected, not shown as an acceptable diff. Added a 4th verdict **'corrupt'** to
`classifyStoryQc` via `_qcCorruption`: fires on (a) a run-together token ≥25 chars AND >1.5× the
original's longest token, or (b) wholesale space loss (corrected keeps <60% of the original's spaces,
min 10). Both signals verified on the real case (49-char token vs 11 original max; space ratio 0.22)
and guarded against false positives (a legit long German compound near the original's own max does
NOT trip it). 'corrupt' sets rejected:true → the accept route's existing 409 covers it; the client
shows a distinct `qc.corrupt_warn` message, Discard-only. `unit-qc-correct` gains 3 corrupt cases
(the real sentence, wholesale space loss, and the false-positive negative control).

Note the guard catches the OUTPUT corruption regardless of which model; it does not try to PREVENT
qwen2.5:7b from mangling quotes (a prompt/model issue). A user hitting 'corrupt' can re-run (often
nondeterministic), switch the QC model, or edit by hand. Suite 100 green, check-inline 0 both builds,
APP_VERSION v55_i. LIVE-TEST §80 gains a corrupt-verdict check.

---

# v55_j — QC display fix (whitespace) + immediate error-hunt on accept; v55_i corruption re-diagnosed

**User corrected my v55_i diagnosis, and was right.** The lost spaces were a DISPLAY bug, not model
corruption — proven by reproducing the review-panel path: the sentence splitter breaks a quoted
sentence on its `"` punctuation, so a quoted sentence with one changed interior word becomes a
ONE-SIDED pair (`a=fragment, b=""` then `a="", b=fragment`) rather than an aligned `a,b` pair. The
inline word-diff then ran each fragment against an EMPTY counterpart, making every token a del-only
or ins-only, and the `if(wa[i].trim())` guard dropped the whitespace-only tokens → all spaces gone.
The manually-generated ai_error_hunt LESSON never showed this because it renders whole sentences, not
a word-diff. Exactly the user's read.

**Display fix:** in `renderStoryQcProposal`, a one-sided changed pair now renders as a whole
`<del>`/`<ins>` block (spaces intact) instead of word-diffing against empty. Verified on the exact
Italian quoted sentence.

**v55_i re-framed (guard KEPT, not reverted):** the `corrupt` verdict was added on a misdiagnosis,
but it's a harmless correct defense against GENUINE model corruption (a model really can run words
together), and it does NOT fire on clean output — verified the real story+clean correction classifies
as 'corrected', not 'corrupt'. So it stays; the notes now record that the triggering case was a
display bug, and the guard is belt-and-suspenders for the real thing.

**Accept-without-reload:** the accept route now returns `lessons: t.lessons`, and `acceptStoryQc`
updates `d.lessons` from it before `buildPath()`, so the rebuilt 🔎 ai_error_hunt appears immediately
(buildPath renders from d.lessons; previously the cache was stale until a reload re-fetched the
topic). Tests assert both the route payload and the client cache update, plus the one-sided-pair
rendering. Suite 100 green, check-inline 0 both builds, APP_VERSION v55_j.

---

# v55_k — bulk story QC: proposal-accumulation in the storyline sweep

User chose the proposal-accumulation approach: the storyline 🔍 sweep now also proofreads each
chapter's STORY, accumulating one proposal per chapter for individual review. No spike — the model
behavior was already proven (v55_g); this is wiring an existing proven function into the existing
bulk loop. The review UI already existed (opening a chapter's story auto-shows its pending proposal,
v55_g line 4700), so the new surface is just a badge telling the user WHICH chapters to look at.

**Server (`_runQc`):** after the per-topic lessons loop, in a FULL sweep only (`includeStory` &&
!onlyFlagged && lessonIdx===null && story present), run `generateStoryQc(tp.story, tp.lang)` and:
clean → clear any obsolete proposal, stamp checked; corrected/rewrite/corrupt → store
`tp.storyQcProposal` (accumulate). Skip-control mirrors the lesson `qcAt`: `storyQcCheckedBy`/
`storyQcCheckedAt` (distinct from the accept-provenance `storyQcBy`/`storyQcAt`) skip an unedited
story already checked by THIS model unless `force`. `includeStory` defaults true from `/api/qc`
(`includeStory !== false`); job payload adds `storyProposed`/`storyClean`.

**Deliberately OUT of the automatic post-book QC pass** (`includeStory:false` there) — story QC adds
an LLM pass per chapter to an already-long generation; the user opts in via the sweep, it's not baked
into book generation.

**Staleness (the edge flagged earlier, now closed):** a story edit (`/api/save-story`) clears
`storyQcCheckedBy/At` AND drops any pending proposal (it was diffed against the old text). The accept
route also guards: if `prop.against !== t.story` (story changed since the proposal), it 409s and
discards rather than applying a correction against the wrong baseline.

**Client:** the topic-summary payload exposes `storyQcPending`; the storyline 🔍 button shows a green
📝<count> of chapters with pending story proposals (next to the red lesson-flag count), and the
per-topic 🔍 shows 📝. `qcRun` already re-fetches the list after a sweep, so badges refresh; the toast
adds "N story proposal(s)". 2 en keys (`qc.story_pending`, `qc.toast.story_proposed`). Review/accept
uses the existing per-story panel (open the chapter story). `unit-qc-correct` gains bulk-integration +
staleness assertions; `unit-qc-skip` updated for the two changed call sites (both behavior-preserving).

Suite 100 green, check-inline 0 both builds, APP_VERSION v55_k. First storyline sweep now pays N
story-QC calls (≈47–77s each on the user's box, measured v55_g); the skip stamp makes re-sweeps cheap.

---

# v55_l — fix: bulk story QC crashed "generateStoryQc is not defined" (scope bug)

User's §81 live test hit `⚠ story QC failed for "Whispers of Words": generateStoryQc is not defined`.
Root cause: in v55_g I inserted the QC helper family (splitSentences, storyDiffSentences, _wordLev,
_qcCorruption, classifyStoryQc, generateStoryQc) after storyDiffSentences — NOT realizing that whole
region is textually INSIDE `boot()` (boot spans lines 2967→3547). Function declarations hoist only
within their enclosing scope, so these were visible to the routes (also inside boot) but NOT to
`_runQc`, which is defined at module scope BEFORE boot(). The per-story 🔍 and accept/discard worked
(routes); only the bulk sweep (_runQc) crashed. Same class as the v55_h stripThink bug — an
undefined reference the string-only tests structurally cannot see.

**Fix:** moved the entire 151-line QC family out to true module scope, immediately before _runQc, so
both _runQc (pre-boot) and the routes (in boot) reach it. Single definition of each, verified.

**Why the tests missed it, and the real guard added:** unit-qc-skip EXECUTES _runQc but via a
string-extract harness with an injected generateStoryQc stub, and its topics had no story — so the
branch never ran. I added (a) executing story-QC cases to that harness (topic WITH a story → asserts
generateStoryQc is called, proposal accumulated, skip/force/suppress all work), which pins the LOGIC;
and crucially (b) a MODULE-SCOPE invariant in unit-qc-correct: every function _runQc calls
(generateStoryQc, classifyStoryQc, storyDiffSentences, splitSentences, _wordLev, _qcCorruption) must
be defined textually before boot(). Verified this guard FAILS on the buggy (nested) server and passes
on the fix — it captures the actual defect, not just the logic. The harness stub alone would NOT have
caught it (it fabricates the scope); the module-scope guard does.

Lesson compounding from v55_h: string-only and stub-harness tests both fabricate scope/imports and
will keep missing undefined-reference bugs. The durable fix is invariant checks on the real source
layout (imports present; callees module-scope). Both now exist for the QC path.

Suite 100 green, check-inline 0 both builds, APP_VERSION v55_l. §81 live test unblocked.

---

# v55_m — QC: accept individual corrections (per-sentence checkboxes)

User asked to accept individual errors, not just the whole corrected text. Chose per-sentence
checkboxes (the diff is sentence-granular; true per-word was deemed not worth the reconstruction
risk). Each changed sentence in the review panel gets a checkbox (default on) + a select all/none
toggle; Accept applies only the ticked fixes.

**Reconstruction (server, the correctness-critical part):** the accept route takes `selected` (indices
into the changed-pair list). It reconstructs by starting from the model's FULL corrected text (spacing
intact) and REVERTING each UNSELECTED changed pair back to its original sentence (indexOf + splice,
first occurrence). This deliberately avoids re-splitting/re-joining the story — which would reintroduce
the whitespace-mangling class of bug (v55_i). Empty selection → treated as discard. `selected` absent
→ accept all (backward compatible). Verified: select-all → full corrected; select-subset → only those
fixes; select-none → original, spacing intact.

**The bug caught before shipping — index alignment.** The checkbox indices must map 1:1 to the server's
changed-pair order. The client's existing `_qcSentencePairs` (filtered) produces INTERLEAVED empty-string
one-sided entries for quoted sentences, which do NOT match the server's del+ins-collapsed pairing —
unchecking fix #k would have reverted a DIFFERENT fix. Fixed by adding a client `_qcChangedPairs` that
replicates the server's storyDiffSentences collapsing exactly; the render now indexes off that. Pinned
by a new unit-qc-correct test that asserts client/server changed-pair ORDER equality across cases
(incl. the quoted-sentence case) — plus selective-reconstruction cases. This is the third
client/server duplicated-logic parity trap this project has hit; the test is the guard.

**Client:** checkboxes + select all/none; Accept sends the checked indices, blocks empty selection with
a toast, handles acceptedCount. 4 en keys (qc.accept_selected/all/none/none_selected). Suite 100 green,
check-inline 0 both builds, APP_VERSION v55_m. LIVE-TEST §80/§81 gain a per-sentence-selection check.

---

# v55_n — summary QC (closes the QC arc)

The last unbuilt half of the QC item: proofread a storyline SUMMARY. Simpler than story QC — no
aiStory, no ai_error_hunt (a summary isn't drill text); acceptance just writes sl.summary.

**Server:** `generateSummaryQc(summary, srcLang)` beside generateStoryQc (module scope, pre-boot) —
reuses the storyQc proofreading prompt (text-agnostic) and `classifyStoryQc` verbatim (same
clean/corrected/rewrite/corrupt guard), stamps `summary_qc`. Routes `/api/summary-qc` (+/accept,
/discard) mirror the story routes: propose stores `sl.summaryQcProposal` (never sl.summary), accept
reuses the story-QC revert-unselected reconstruction (per-sentence `selected`, spacing-safe, staleness
409, empty→discard) and writes sl.summary + summaryQcBy/At, no error-hunt. Accept needs no backend.

**Client — shared renderer (parity-trap avoidance, as promised):** factored the story-QC panel into
`_renderQcProposalInto(prop, {panelId,cbClass,acceptCall,discardCall})` + `_qcSelectedIdx` +
parametrized `_qcToggleAll`; story QC now delegates to it, summary QC reuses it. `_qcChangedPairs`
(the server-aligned pairing) stays defined ONCE — no duplicate diff logic for summary. 🔍 button in
the summary strip header (gated canEdit + summary exists); review panel #sum-qc-panel below it.
2 en keys (qc.summary_btn, qc.summary_accepted).

**Tests:** unit-qc-correct gains summary-QC coverage — shared classifier, no error-hunt, module-scope
guard for generateSummaryQc, full route contract (propose/accept/discard, staleness, backend
asymmetry), and asserts the client shares the renderer (_qcChangedPairs defined once). Runtime
reconstruction spot-checked. Suite 100 green, check-inline 0 both builds, APP_VERSION v55_n.

**QC ARC COMPLETE:** story QC (v55_g) + bulk story QC (v55_k) + per-sentence accept (v55_m) + summary
QC (v55_n), all sharing one classifier + one renderer + one reconstruction. Owed: LIVE-TEST §82.

---

# v55_o — collapsible model selection (pickers → popover under the backend pill)

The roadmap's UI item: the four inline model pickers (story/lessons/translation/qc + timeout) cluttered
the home page's backend row. They now collapse into the **Backend status pill** — click → popover.
Client-only (`index.html`), no server change, as specced.

**Implementation:** `#bpill` + `#bmodels-pop` live in a new `.bpill-wrap` (position:relative = the
positioning context); `#bmodels` moved INSIDE the popover; the pill gains a ▾ caret and a `clickable`
class ONLY when Ollama is up and models are actually listed (so the static build and any /api/models
failure leave a plain, non-clickable pill rather than a dead affordance). Popover open/close:
`toggleModelPop`/`openModelPop`/`closeModelPop`, closing on outside-click (containment-checked against
the wrapper) or Esc, with both listeners attached on open and removed on close. Fields stack vertically
in the popover (`.bmodels-pop .bmodels{flex-direction:column}`); fixed-position fallback under 520px.

**Two traps avoided (both from this session's lessons):**
1. `renderModelPicker` no longer touches `box.style.display` — the POPOVER owns visibility. Otherwise a
   re-render (e.g. after switching a role) would fight the user's open/closed state. `switchModel`
   deliberately does NOT close the popover; asserted.
2. `renderPill` rebuilds `pill.className`, which silently wiped the `clickable` class. It happened to
   self-correct because every caller ran `renderModelPicker()` right after — pure call-order luck. Made
   it explicit (carry `wasClickable` over) rather than depend on that coupling; asserted.

**Tests:** `unit-model-popover` — markup nesting (#bmodels inside #bmodels-pop, both inside the wrapper),
visibility ownership (no box.style.display in the picker), clickable-only-under-Ollama incl. the
fetch-failure path, renderPill class preservation, listener symmetry (every add has a matching remove;
outside-click deferred a tick so the opening click can't close it), and switchModel not closing the
popover. The roadmap predicted "little the headless suite can assert beyond the pill exists" — in fact
the structural contract is exactly where this project's UI bugs live, so it's worth pinning.
1 en key (`models.pill_hint`). Suite 101 green, check-inline 0 both builds, APP_VERSION v55_o.
Owed: LIVE-TEST §83 (the visual/interaction proof is browser-only).

---

# v55_p — fix: storyboard missing from the STATIC landing card (build-static parity)

User: "the storyboard is shown on the main page in the saved lessons list in the live version, but
not the static version." Correct, and a real bug.

**Root cause — a DUPLICATED renderer, not a data problem.** The storyline object is baked whole
(`cleanedStorylines = rawStorylines`), so `sl.storyboard` WAS in the static bundle all along. But the
landing card is rendered by TWO separate implementations: `loadSavedList()` in index.html (live) and a
static `loadSavedList()` injected by build-static.js. v55 added the storyboard strip to the live one
only — so it rendered live and silently vanished offline. The summary strip worked in both because it
predates the split. (v55's note "storylines are baked whole, so sl.storyboard rides automatically" was
right about the DATA and wrong about the RENDER — the roadmap's own "server↔client parity where
generators are duplicated" rule applies to this pair too.)

**Fix:** added the storyboard strip to build-static.js's landing renderer, mirroring the live one
(same class/id/aria, ABOVE the summary). Verified functionally: injected a storyboard into a corpus,
rebuilt, confirmed `slsb-wrap` + the SVG appear in docs/index.html.

**The real guard — `unit-static-landing-parity` (new, FUNCTIONAL not grep):** build-static.js already
accepts in/out paths, so the test builds a REAL static bundle from a fixture corpus (2-chapter
storyline carrying both a summary and a storyboard) into a temp dir and asserts the output actually
renders both strips, in the right order (storyboard above summary), plus a source-level parity check
that every landing-card hook in the live renderer exists in the static one. Verified it FAILS on the
reverted fix ("the STATIC landing card renders the storyboard strip") and passes on the fix.

This is the 4th duplicated-logic parity trap this project has hit (server/client generators, the QC
diff pairing, the QC renderer, now the landing renderer). Pattern for whoever adds the NEXT landing-card
feature: it must go in BOTH loadSavedList impls, and the parity test's hook list must gain its marker.
Suite 102 green, check-inline 0 both builds, APP_VERSION v55_p. LIVE-TEST §79 gains a static check.

---

# v55_q — cosmetic: globe moved left of the title/tagline (was stacked above)

User request. `.land-top` was `text-align:center` with the globe as a block-ish inline-block above
`dreizunge` + the tagline. Now: `.land-top` is a centered flex ROW (`gap:14px`) holding the globe and
a new `.land-titles` column (title over tagline, left-aligned) — the conventional logo/wordmark lockup.
Dropped the globe's stacked `margin-bottom:8px` and added `flex:none` so it can't shrink; removed the
tagline's vestigial `align-self:flex-end;margin-bottom:4px` (it did nothing — the old parent wasn't
flex — but WOULD have pushed the tagline right in the new column). The spin-globe animation is
untouched.

**Parity checked first** (the v55_p lesson): `build-static.js` has NO copy of the header markup/CSS
(0 matches) — it inherits index.html's body — so unlike the landing-card renderer there's no second
place to update. Verified after rebuild: docs/index.html carries `land-titles` + the flex `.land-top`.

**Verified visually-ish:** rendered the real extracted markup+CSS through wkhtmltoimage with debug
backgrounds and measured the boxes: globe x175–230 (56px) LEFT of title x231–412, vertically centered
on one row = the requested layout. (The tagline didn't paint and flex `gap` collapsed in that render —
artifacts of wkhtmltoimage's ancient QtWebKit, not the CSS; modern browsers handle both.)

No test added — pure cosmetics, single-use classes, and a regression here is instantly visible. Suite
102 green, check-inline 0 both builds, APP_VERSION v55_q. Owed: an eyeball in the browser (LIVE §84).

---

# v55_r — storyboard: story style fed to the model + colour schemes (+ a whitelist hole closed)

User asked two things: (1) do we send the story writing style to the storyboard model? (2) add a
primitive colour-scheme selection.

**(1) Answer: NO, we didn't — now we do.** `generateStorylineStoryboard(topics, stories, vocab,
srcLang)` never received the style, so a "children" story and a "horror" story produced
identically-toned art. (It also took a `vocab` arg it never used — a copy-paste from the summary
generator; dropped.) Now the route computes the MAJORITY `storyStyle` across the storyline's chapters
(the user's own framing: "majority of stories used children"; ties → first chapter; all-unstyled →
null) and the generator appends a tone note built from the SAME vocabulary the story generator uses
(`PROMPTS.storyStyles` via `getStoryStyle`, so 'creative' → null → no note). The stamp records
`meta.storyStyle`.

**(2) Colour schemes — 5: classic, pastel, vivid, night, mono.** Key insight that made this cheap:
the model only ever emits palette NAMES, and the composer maps names → hex — so a scheme is just an
alternative hex map for the same names. The prompt is unchanged, and **re-colouring needs no model
call**: the validated panel JSON is now persisted (`sl.storyboardPanels` + `sl.storyboardScheme`), so
`POST /api/storyline-storyboard/scheme` re-composes locally — instant, vs. the 4–30 min generation.
Pre-v55_r storyboards have no stored panels and get an explicit "regenerate to enable re-colouring"
409 rather than a silent failure. DELETE clears panels+scheme too. Client: 🎨 in the 🎬 menu →
scheme picker; the scheme LIST comes from `/api/info` (`storyboardSchemes: Object.keys(...)`) so it
can never drift from the server — no hardcoded list (asserted). Unlabelled schemes fall back to a
capitalized name rather than a raw key. `night` inverts `ink` to a light stroke so line art stays
visible on the dark ground.

**Bug my own test caught, in the SECURITY BOUNDARY — prototype-chain lookups (predates v55_r).**
`STORYBOARD_SCHEMES['__proto__']` is truthy → a bogus scheme PASSED the route's validation and
yielded an all-undefined palette. Worse, the colour whitelist had the same hole since v55: a model
emitting `fill:"constructor"` produced `fill="function Object() { [native code] }"`, and
`fill:"__proto__"` → `fill="[object Object]"`. Not escapable (those values contain no quotes, so no
XSS) but it broke the closed-whitelist guarantee the composer exists to provide. Fixed: ALL palette
and scheme lookups are now `hasOwnProperty`-guarded, in the composer and both routes. Verified
before/after: hostile names now resolve to the palette default. Pinned by tests over
`__proto__`/`constructor`/`toString`/`hasOwnProperty` as both scheme names and colour names, plus an
invariant that every emitted fill/stroke is a real palette value.

Tests: unit-storyboard gains the scheme section (key parity across all 5 — a missing key would
silently fall back mid-drawing; each scheme paints its own hexes; fallbacks; free re-colour route
contract: no model, no backend, own-property validation; client reads the list from /api/info).
8 en keys. Suite 102 green, check-inline 0 both builds, APP_VERSION v55_r. Owed: LIVE-TEST §85.

---

# v55_s — storyline generation stats now show in LIVE mode (were static-only)

User: stats appear on the static storyline page but not the live one. Correct.

**Root cause — a DATA gap, not a rendering one** (the opposite of v55_p, worth noting: same
symptom shape, different half). `#sl-screen-stats` is rendered by ONE shared block in index.html
(not gated on mode) which reads `generationStats` off the `APP.savedList` entries. Static mode sets
`APP.savedList = STATIC_LESSONS` — whole topic objects, stats included → it rendered. Live mode
fills savedList from `/api/lessons`, whose list payload is a deliberately slim summary (it already
notes it "omits the full lessons[]") and which omitted `generationStats` entirely → `s.generationStats`
undefined → zero lines → the block hid itself. So the feature looked static-only.

**Fix — a compact PROJECTION, not the whole object.** The renderer reads exactly four fields
(totalMs, model, totalPromptTokens, totalCompletionTokens). Measured against the real corpus:
shipping the full `generationStats` would add ~103KB to the 94KB list payload (+107%) — almost all of
it the per-lesson token breakdown, which no list consumer reads; the four-field projection adds ~24KB
(+25%). It keeps the SAME SHAPE, so the single renderer works unchanged in both modes and the lesson
page (which reads full stats from the on-demand topic fetch) is untouched. Topics without stats stay
absent (JSON.stringify drops undefined).

**Guard:** `unit-static-landing-parity` gains a live/static stats-parity block — it reads the fields
the renderer actually uses out of index.html and asserts the list payload provides every one, plus
that the payload ships a projection rather than the full object. Verified it FAILS with the
projection removed ("/api/lessons projects generationStats") and passes with it.

Suite 102 green, check-inline 0 both builds, APP_VERSION v55_s. Owed: LIVE-TEST §86.
