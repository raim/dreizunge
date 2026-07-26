# Roadmap v71

> **STATE AT HANDOFF: cut as `v71`.** Clean cut after a long v70 line (15 point releases,
> `v70_b` → `v70_p`). Everything in v70 shipped and is green; this roadmap starts the next session
> from a true baseline rather than a repeatedly-patched one. `roadmap_v70.md` is now a **closed
> archive** — everything still open has been carried here.
>
> **The v71 cut is NOT a pure version bump.** It carries updated `ui.json` (a partial translation
> pass) and updated `lessons.json` (283 topics, 80 storylines), plus one test whose assertion was
> restated. Suite green at **138**, `check-inline` 0 on both builds.

---

## How to start a session (read these, in order)
1. **This file** — the highest-numbered `build_history/roadmap_v*.md` is always the current one.
2. The two most recent session-notes files: `build_history/v70_session1_notes.md` (notes 1–16 cover
   the whole v70 line) and any `v71_session*` notes once they exist.
3. Establish the green baseline BEFORE touching anything: `node test/run.js` and
   `node test/check-inline.js` (0 failures on both `index.html` and `docs/index.html`).
   **The runner reports its own total** (added v70): the closing line reads
   `ALL CHECKS PASSED (138 checks)`, and a failing run reads `FAILED <n> of 138: <labels>`.
   **Quote that line — never hand-derive the figure.** A hand-derived count once drifted to 152
   against an actual 133 and sat in two documents unnoticed; that is what the self-report prevents.
   Currently **138** (133 `test/*.test.js` files + 5 static checks). `--quick` reports **119** in
   ~10s, skipping the server-spawning steps — a smaller number there is correct, not a regression.

---

## ✅ What shipped in v70 (full detail in `v70_session1_notes.md`, notes 1–16)

- **Harness self-reports its check count** (v70) — after a documented figure was found wrong in two
  places. Counted at one site inside `run()`, so it cannot drift.
- **`--quick` actually skips server-spawning tests** — six were registered outside the block.
- **Insecure-transport warning** (v70_b) — plain HTTP on a non-loopback host warns in the account
  modal and once per process on the console. Guidance, never a gate.
- **Crosswords** (v70_c → v70_j, plus v70_o) — the whole feature: layout engine, play mode as a
  *mode over an existing lesson* rather than a lesson type, learner reachability, UX (auto-advance,
  per-letter marking, reveal), varying puzzles + word-pool options, mixed/synonym/word-form
  sources, thin-lesson top-up, and the browser-pass fixes.
- **Completion screen** (v70_g, v70_l) — one icon action row; Repeat split from Next; drill no
  longer gated on the pass mark, so a finished lesson still has a route back in.
- **PDF chapters break on sentences** (v70_k) — false paragraph boundaries left by cleanup were
  cutting sentences in half.
- **Synonym context** (v70_m, v70_n) — trimmed to the sentence holding the word, then *clamped*,
  because the ten worst cases were each a single enormous sentence.
- **Storyline full-story translation toggle** (v70_p).

---

## 🔭 Open work carried into v71

### Near-term, concrete
- **[NEXT — carried, still open] Drill result card is redundant.** A drill session shows its own
  completion card; it should return to the card the learner came from. Touches the `showComplete`
  branch chain and `APP._drillPrev`. **Deferred twice on purpose:** that branch order has already
  fixed three user-reported dead ends (v66.1, v69.2) and the failure mode is a learner left with no
  forward affordance — quiet, and only visible in a browser. Wants a session that re-reads the
  branch order cold. Smallest item here.
- **[NEXT] Typing exercises should show a letter-by-letter diff.** When a typed answer is wrong,
  show BOTH the typed text and the correct one, marking the differing characters. Affects
  `listen_type` and any free-text answer. Self-contained and fully unit-testable — but note it
  needs proper **sequence alignment**, not positional comparison: `hause` vs `haus` differs by one
  insertion, not four substitutions. Highest learner value of the open items.
- **[quality — specified against real data] Deterministic vocab QC.** Validated against the user's
  pre-edit export (`lessons_witharticles.json`, storyline `sl_613012330`):
  - **Article mismatch** — source carries a `der/die/das/ein…` article, target carries none.
    15 hits in those two chapters; 16/334 corpus-wide for de→en. The user's own fix STRIPPED the
    German article rather than adding a target one (except one case that went the other way), so the
    check should **flag the asymmetry, not prescribe a direction**.
  - **Missing umlaut** — a word whose umlaut-stripped form matches another form in the corpus that
    HAS umlauts, **with the same capitalisation**. Catches `naturliche`/`natürliche`; the case rule
    suppresses the `Zahlen`/`zählen` false positive. 2 candidates corpus-wide, 1 real.
  - Both defects **survived hand-editing** (`naturliche Selektion`, and `symbiosi` → `simbiosi`),
    which is the argument for automating it. Surface through the existing per-item flag UI; no
    model call needed.
- **[small] Clamp the synonym context SERVER-side too.** `findContextSentence` returns the first
  story sentence containing the word, uncapped, so a 135-word period is stored in full. The client
  clamps for display (v70_n), so nothing is broken — but the stored data stays bloated and any
  other consumer sees the full passage. Duplicating the clamp would create a second definition that
  can drift; decide between sharing the helper and accepting display-side-only.
- **[i18n] `_sentenceUnits` only splits on `.!?…`.** Arabic prose uses `،` `؛` `:` and often has no
  full stop for a whole passage, so it reads as ONE sentence. Harmless for synonym cards after the
  v70_n clamp, but **the PDF chapter splitter has the same blind spot** — an Arabic book would
  chunk far more coarsely than a European one. Not yet reported; real.

### i18n — partially done, needs a second pass
- **558 missing entries across 24 keys.** The v71 translation pass covered **6 of 29 languages**
  (nl pt fr de it es), all partial, and was exported before v70_o — so `crossword.done` was never
  in it. 23 languages are untouched: `tr hi ar sv ru zh ko pl ja he uk cs vi id ro th el fi hu da
  ca lb sw`. `--qc` reports **0 structural defects**; every "error" is one of these absences.
- **`crossword.done` was missing from `en`** in the uploaded file and had to be restored — the code
  calls `t('crossword.done')`, so shipping it would have shown a raw key on the crossword button.
  **Lesson: validate a returning `ui.json` against the current one before merging** (key counts per
  language, and whether any `en` key disappeared).

### Owed, and only the user can do them
- **Browser pass on the drill + typing changes** once they land.
- **PDF model-cleanup on a real article** — genuinely empirical: does the local model over- or
  under-delete? Knobs are the 40% floor and the `textCleanup` category list.
- **Native-speaker review** of generated vocabulary. The QC above catches mechanical defects, not
  wrong-but-plausible translations.

### Larger, not yet started
- **Concept graph / dependency-aware curriculum.** Deliberately untouched until the small queue is
  clear. Large authoring project; do not start it opportunistically.
- **Word games beyond the crossword** — wordle-like, other word-play. The crossword's conventions
  (deterministic seeding per attempt, credit only what the exercise genuinely demonstrates,
  content-based availability) should be reused rather than re-invented.

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
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
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
   implicitly `a`, so the sequence is `v71` → `v71_b` → `v71_c` → … — the same convention the v69
   and v70 lines ran. **The next release off this tree is `v71_b`** (`v71` shipped). A new base
   number (`v72`) is a fresh cut, not a point release. Roadmaps are per BASE version, so point
   releases do not each get one — `roadmap_v71.md` stays current through the whole v71 line.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.

(If you add a new standing rule, append it here so the next session inherits it.)
