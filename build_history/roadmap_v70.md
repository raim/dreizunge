# Roadmap v70

> **STATE AT HANDOFF: about to CUT AS `v70`.** This is a clean cut after a long v69 line
> (18 point releases, v69_b → v69_t). v69 shipped correctly and is fully green — this roadmap starts
> the next session from a true baseline rather than a repeatedly-patched one. The v69 roadmap
> (`roadmap_v69.md`) is now a closed archive; everything still open has been carried here.
>
> **First cut of v70 is a pure version bump** (`v69_t` → `v70`): no behavioural change, so the suite
> and `check-inline` must stay green and byte-identical apart from the version string and the derived
> static build. Confirm that before doing anything else.

---

## How to start a session (read these, in order)
1. **This file** — the highest-numbered `build_history/roadmap_v*.md` is always the current one.
2. The two most recent session-notes files: `build_history/v69_session1_notes.md` (notes 1–24 cover
   the whole v69 line) and any `v70_session*` notes once they exist.
3. Establish the green baseline BEFORE touching anything: `node test/run.js` (currently **152
   checks**) and `node test/check-inline.js` (0 failures on both `index.html` and `docs/index.html`).

---

## ✅ What shipped in v69 (summary — full detail in v69_session1_notes.md, notes 1–24)
The v69 line is done and verified. Headline items, so the next session doesn't re-investigate them:
- **Knowledge-aware rounds** (v69_h): 3-tier composition, familiar words last, never excluded.
- **Pass-mark hierarchy** (v69_i, corrected v69_r/v69_s): per-chapter → per-storyline → global
  default, one control per page at the BOTTOM. The old v65.1 global-threshold header row was a
  second, duplicate control — removed in v69_s; the `/api/coverage-threshold` endpoint is retained
  as the hierarchy's fallback.
- **One definition of "chapter complete"** (v69_l): `setComplete()` is the single rule; its verdict
  is persisted per chapter (`APP.progress.chapterDone`) and read by every consumer via
  `chapterComplete()`, with a staleness check on lesson count.
- **PDF cleanup, both stages** (v69_m/o/p): deterministic pass + a VERIFIED deletion-only model pass
  (`/api/clean-text`, subsequence check). Heavy deletion is a warning not a reject (a chunk can
  legitimately be mostly furniture); an unusable result returns the text unchanged so a run never
  stalls; the deterministic pass logs a summary; the model pass announces the model up front; and
  cleanup tokens are booked to the storyline under a `cleanup` bucket.
- **Teacher dashboard** (v69_n, fixed v69_t): overview (`/api/learners`) + flag triage
  (`/api/flag-summary`, student reports first). Honest `chaptersCompleted` (was chapters *touched*).
- **Book same-title chapter fix** (v69_q): chapters sharing a title no longer overwrite each other;
  id minted at the early save, chaining by id. Also moved `_newTopicId` to module scope.
- **Render smoke harness** (v69_k): `test/lib-dom.js` + `test/smoke-render.test.js` execute the real
  client render paths in a stub DOM — catches TDZ / undefined-reference crashes that source-level
  assertions cannot see. Extended with the dashboard panels.
- **Screen-structure guard** (v69_t): `unit-screen-structure` asserts no `.screen` is nested inside
  another `.screen` — the exact bug that made the dashboard render into a hidden parent.
- **UI translations**: all 30 languages, self-validating via `translate-ui.js --qc` / `ui-qc.js`.

---

## 🔭 Open work carried into v70

### Near-term, concrete
- **[i18n debt] One key awaits translation: `teacher.render_error`.** Present in `en`; missing in the
  29 other languages (added after the user's last export). One `translate-ui.js` run clears it. This
  is the ONLY outstanding translation key. It falls back to English meanwhile.
- **[verify in normal use] The v69 batch still wants a browser pass.** Most of it is
  server-testable and guarded, but these are only fully confirmable by using the app, and some are
  genuinely empirical:
  - **PDF model-cleanup on a real article** (the most empirical): how well a local model separates
    article from furniture is unknown headlessly. If it OVER-deletes, tune the 40% floor
    (`cleanNarrativeText`, one constant); if it UNDER-deletes, extend the prompt's category list in
    `prompts.json → textCleanup`. The heavy-path and unchanged-path behaviours are already correct
    and guarded — this is about tuning, not correctness.
  - Teacher dashboard with a REAL learner account (the user had none during development, so panel 1
    has only ever been exercised with fixtures + the empty state; panel 2 surfaces the user's 40
    existing teacher-mode flags).
  - Pass-mark controls (one per page, bottom) and the highlighted `{word}` in questions.
- **[small] TLS guidance / warning banner** when learner accounts are used over plain HTTP on a
  non-loopback host. The dashboard makes accounts real; this is the remaining safety gap before
  putting the app on a LAN. Low effort, high value.

### Product ideas / larger
- **More word-game lesson types** — crossword from the lesson's words, a wordle-like lesson, other
  word-play — all client-side over stored vocab, NO model calls. Best value/risk ratio of the
  remaining features: no server surface, no new generation failure modes, and the smoke harness now
  makes new render paths much safer to add. Strong candidate for the first real v70 feature.
- **Per-learner preferences** (tutor model, difficulty) — more meaningful now that accounts and the
  dashboard exist.
- **Stage 3 — concept graph.** Concept ontology + `teaches:` / `prerequisites:` per lesson; mastery
  over concepts rather than chapters. Still the big, separable authoring project; don't start it
  until the small queue is clear.
- The 🗣 pill could host the TTS language/voice selects the way the backend pill hosts the model
  picker (v55_o) — deliberately unbundled.

### Waiting on user / external
- **mein-osttirol.rocks dictionary** (1165 entries): do NOT import until written permission from
  info@mein-osttirol.rocks is on file.
- **Native review** of the eight `latin.sounds.*` columns (owed since v53).

### Known-but-accepted (do not re-investigate)
- The user's library still contains ONE already-merged A13 topic from a book run that predated the
  v69_q fix. That fix prevents NEW merges; it does not retroactively un-merge. Recovering the lost
  chapter needs a regenerate of that book — the user's call, not a bug to chase.
- The PDF cleanup 40% floor firing as a warning ("kept ~62/197") on a furniture-heavy chunk is
  CORRECT behaviour (v69_o), not a defect.

---

## 🧭 Lessons the hard way (this line paid for these — honour them)
- **Structural scans of `index.html` MUST strip the inline `<script>` first.** The v69_t dashboard
  bug (a screen nested in another screen) hid for several replies because `<div`/`</div>` inside the
  640 KB inline script fooled every raw regex/brace count. `unit-screen-structure` now strips
  scripts before parsing; do the same in any new structural check.
- **The browser's computed state beats source analysis for render/layout bugs.** The dashboard cause
  was pinned in one click by logging `getComputedStyle` + `getBoundingClientRect` (`parent`,
  `width/height`), after source reasoning repeatedly misread it. When a render "succeeds" but nothing
  shows, probe the live element, don't re-read the file.
- **Verify LLM output against the contract; a prompt cannot guarantee behaviour.** Error-hunt,
  text-cleanup and translation-QC all validate structurally (subsequence / word-count / placeholder
  integrity) and retry with specific feedback. Reuse this shape for any new generator.
- **The fake backend must model every real generator**, or an e2e passes on broken output (this bit
  error-hunt and text-cleanup). Add a fake branch with any new endpoint.
- **Over-broad source assertions match Claude's own explanatory COMMENTS.** Recurred twice this line
  (`THINK_TIMEOUT_MULT`, `q_nolang`). Scope assertions to actual USAGE, not mere mention.
- **`boot()` in `test/lib.js` binds a pid-derived port → one server at a time.** Stop the first
  before booting another, or requests silently hit the wrong backend and look like a code bug.
  `boot({seed})` takes an object; the fake inherits `process.env` (used for `FAKE_CLEAN_MODE`).
- **Two builds diverge.** The static build bakes whole topics (full `lessons[]`, no live-only
  projection fields like `lessonCount`); live-only data must be baked or handled. Re-run
  `build-static.js` after any `index.html` / `*.json` change and keep `check-inline` at 0 on BOTH.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md` is
the current one), then the most recent `build_history/v*_session*_notes.md`. Establish the green
baseline (`node test/run.js` + `node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)
