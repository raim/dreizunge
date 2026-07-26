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
3. Establish the green baseline BEFORE touching anything: `node test/run.js` and
   `node test/check-inline.js` (0 failures on both `index.html` and `docs/index.html`).
   **The runner reports its own total** (added v70): the closing line reads
   `ALL CHECKS PASSED (136 checks)`, and a failing run reads `FAILED <n> of 136: <labels>`.
   **Quote that line — never hand-derive the figure.** A hand-derived count drifted to 152 against
   an actual 133 and sat in two documents unnoticed; that is what the self-report exists to prevent.
   Currently **137** (132 `test/*.test.js` files + 5 static checks). `--quick` reports **118**,
   skipping the e2e steps — a smaller number there is correct, not a regression.

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

## ✅ What shipped in the v70 line (detail in `v70_session1_notes.md`)
- **v70** — the cut: pure version bump, no behavioural change.
- **v70 (docs)** — the suite's check count was wrong in two documents (152 vs an actual 133). The
  scary reading was ruled out first: every test file on disk is wired, and `run.js` has no dangling
  reference. Root enabler fixed rather than just the number — see below.
- **v70 (harness)** — **the runner reports its own check count.** `ALL CHECKS PASSED (136 checks)`,
  `FAILED <n> of 136: …`. Counted at one site inside `run()`, so the figure cannot drift from the
  steps executed. Quote it; never hand-derive it.
- **v70_j** — **crossword: thin lessons top up from earlier ones.** Availability follows the pool
  a puzzle would actually use, so a lesson whose vocabulary is article+noun phrases still offers a
  crossword. Availability is now CONTENT-based, not type-based.
- **v70_i** — **crossword: mixed lessons, synonyms, word forms.** Fixes a user-reported
  disappearance (a mixed lesson owns no vocab, so the button vanished for the very lesson a
  mixed-driven set resumes into). Synonyms and word-form lessons now contribute words too.
- **v70_h** — **crossword: varying puzzles + word-pool options.** Regenerate (🎲) draws a new
  attempt; options for word count, source (this lesson / earlier lessons / everything learned
  across storylines) and "favour words I got wrong". Arrow-key + Backspace navigation, and an
  auto-check when the last cell is filled.
- **v70_g** — **completion screen: one icon action row.** Drill / crossword / primary action on a
  single row, icons with tooltips + aria-labels. Below the mark with nothing left to play, the
  primary becomes REPEAT (↻) instead of Next (→).
- **v70_f** — **crossword UX.** Auto-advance on typing; Check no longer erases the grid and marks
  each letter green/red; a Solve button reveals the answer and credits nothing.
- **v70_e** — **crossword reachable by learners.** v70_d put the entry point only on the lesson
  node, which learners never see (v60 learner nav skips the lesson-set page), so no student could
  open one. Entry added to the completion screen, alongside the drill.
- **v70_d** — **crossword play mode.** A 🧩 button on any vocab lesson opens a crossword built from
  that lesson's words. Solving an entry credits the lesson's OWN `mcq_source_target` question, so
  coverage moves per word and the qid universe does not grow.
- **v70_c** — crossword layout engine (stage 1, library only — no user-visible change).
- **v70_b** — **insecure-transport warning.** Plain HTTP on a non-loopback host now says so, in the
  account modal (where the password is typed) and once per process on the server console. Guidance,
  never a gate: LAN-without-TLS stays a supported deployment, the same reason the cookie's `Secure`
  flag is conditional. One shared `isSecureRequest()` now serves both the cookie and the warning.

## 🔭 Open work carried into v70

### Near-term, concrete
- ~~**[small, test hygiene] `e2e-*` tests registered outside the `if (!quick)` block**~~ —
  **✅ done in the v70_b line.** It was SIX, not seven (the earlier count included the v70_b e2e
  before it was moved). `--quick` is now 117 steps in ~10s and genuinely spawns no servers, guarded
  by `unit-run-summary` §6.
- **[i18n debt] TWELVE keys await translation.** `teacher.render_error`, `acct.insecure` (v70_b),
  twenty `crossword.*` keys (v70_d/f/h/j) and `complete.repeat` (v70_g). Present in `en`; missing
  in the 29 other languages (667 entries). One `translate-ui.js` run clears all of them. They fall back to English meanwhile, and
  `--qc` reports **0 structural defects** — every "error" it lists is one of these absences. This
  is now the largest single item of debt in the tree and worth an offline pass soon.
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
- ~~**[small] TLS guidance / warning banner**~~ — **✅ shipped in v70_b**, see below.

### Product ideas / larger
- **Word-game lesson types — IN PROGRESS.**
  - ✅ **Stage 1 (done): the crossword layout engine.** `_crosswordLayout()` in `index.html` —
    pure, deterministic, client-side, no model call. Guarded by `unit-crossword-layout` (grid
    well-formedness, adjacency, numbering, determinism, degenerate input, placement floor).
    **Deliberately not wired to anything yet** — it is a library, and the tree stays shippable.
  - ✅ **Stage 2 (done, v70_d): play mode, option C.** Built as a MODE over an existing vocab
    lesson, not a lesson type. No `LESSON_TYPE_META` entry, no `editorBranch`, no `_qidCanonical`
    case, no new qid universe. `openCrossword(idx)` / `checkCrossword()` / `closeCrossword()`.
  - ~~Stage 3: the authoring entry point.~~ **Obsolete** — option C removed the need for one. Any
    vocab lesson can be played as a crossword, so there is no crossword lesson to author.
  - ✅ **Learner reachability (v70_e).** The completion screen is the learner-visible entry; the
    lesson-node button remains for teachers. **Standing lesson: a learner-facing feature placed on
    the lesson-set page is unreachable.** `_canEdit()` is NOT the gate that matters — learners skip
    that whole screen. Check reachability against `_isLearner()`, not against an edit permission.
  - ⬜ **Known consequence of C:** a crossword is not an assignable unit. It does not appear in the
    lesson list as its own node, the editor, or the teacher dashboard. If a teacher ever needs to
    assign "the crossword", that is a real feature request and means revisiting option B.
  - ⬜ Later: a wordle-like lesson, other word-play, reusing the same engine conventions.
  - **Known limit:** the engine accepts Latin/Cyrillic/Greek only. Han/Kana/Hangul are excluded
    (one glyph per cell is not a puzzle); Arabic and Hebrew are excluded pending a decision on
    contextual shaping + RTL grid geometry — a real feature, not an oversight, but it means the
    word-game family is unavailable for those languages.
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
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v70` → `v70_b` → `v70_c` → … — the same convention the v69
   line ran (`v69` → `v69_b` → … → `v69_t`). **The next release off this tree is `v70_k`** (`v70_j`
   shipped). A new base number (`v71`) is a fresh cut, not a point release. Roadmaps are per BASE
   version, so point releases do not each get one — `roadmap_v70.md` stays current through the
   whole v70 line.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)
