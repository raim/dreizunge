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
