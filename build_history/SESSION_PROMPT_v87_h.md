# Session prompt — written at the `v87_h` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_i`, `v87_j`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_h`** — **item AL is now CLOSED**:
the generation wizard is a genuine THREE-step flow (1 · Language / 2 · Text / 3 · Lessons), and all
three input modes (LLM-generate, PDF/paste upload, comic image) choose lesson types in ONE place.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_g` added ONE new `en` key (`gen.wizard_step3_lessons`) after asking and being told which of
three options to take; `v87_h` added NONE (the unification deliberately reused each deleted control's
own existing string). Ask fresh THIS session before adding any.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`, and the user's own
live server was running on port 3000 throughout the `v87_g`/`v87_h` cuts. `server.js` serves `index.html` with
`readFileSync` PER REQUEST, so a client edit is live on that server without restarting anything —
`v87_g` was live-verified that way, with nothing of the user's touched. `prompts.json` and `ui.json`
HOT-RELOAD live via `fs.watch` too.

**What shipped this cut**: item AL part 2 — `#pdf-panel` and `#comic-panel` no longer carry their own
duplicated lesson-type controls or their own start buttons. 21 ids deleted across the two panels;
every reader repointed to the wizard's canonical `#gen-skip-lessons-cb`/`#gen-arc-cb`/`#gen-arc-types`/
`#gen-arc-script-cb`/`#post-gen-storyboard-cb`/`#post-gen-analysis-cb`/`#gen-btn`. Request bodies,
field names and endpoints are unchanged — only where the CLIENT reads the answer from. New
`_genInputMode()`/`_genChapterCount()`/`_genArcApplicable()` (an upload's chapter count is its chunk
or extracted-panel count, not `APP.numChapters`), and `_applySkipLessonsUI()` became
`_applyLessonCardUI()`, owning the whole card. **A silent bug fixed**: `comicCreateChapter()` had never
sent `continuedFrom`. Full write-up: `roadmap_v87.md`'s own `v87_h` entry.

**Item AL is CLOSED — do not reopen it.** Its four originally-⚠️-OPEN questions were all answered at
the `v87_g` cut and both halves have shipped. Two things it deliberately did NOT do, each now carried
as its own item rather than as unfinished AL work:
- **Difficulty placement** — ruled out of scope by the user, deferred to its own design pass alongside
  the CP1/CP2 route ("difficulty means something different for each lesson type", and it may not be
  one dial at all). `#diff-select` was left exactly where it is, on the lesson card, all three modes.
- **`#per-chapter-row` and `#post-gen-qc-cb` stay LLM-only**, each for a measured reason recorded in
  the `v87_h` entry — the per-chapter picker indexes PLANNED chapters positionally, and QC here is
  client-orchestrated with no upload-path chaining. Extending either is its own piece of work; do NOT
  treat them as leftovers to tidy up.

**🆕 NO SINGLE PRIORITY IS SET FOR THIS SESSION.** The item the last two cuts were driving at is done,
and nothing else is mid-flight. Pick from the carried-forward list under "WHERE TO START" — several
entries there are blocked on a user decision rather than on work, so **asking the user which one they
want is a reasonable first move**, and the ones marked as needing a ruling should not be started
without one.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   item AL's status block, then `# ✅ SHIPPED IN THE v87 LINE` (`v87_b` → `v87_g`).
3. `build_history/roadmap_v86.md` is KEPT as the historical record for the whole `v86` line
   (`v86_a`…`v86_ag`) — go there for how something from THAT line was built.
4. `INTERNALS.md` **§6b** covers the jobs popover, the drafts store, and the `skipLessons` mechanism
   (`v87_b`→`v87_f`); still current through `v86_af` for item W's CP1/CP2 surface and `v86_x` for the
   comic-panel subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 306 checks
node test/run.js --quick                  → expect 259
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked at least once across the `v86` line too;
**`unit-tap-word` failed 4 of 12 standalone runs on an UNTOUCHED tree at the `v87_g` cut**, and was
the ONLY failure in the `v87_h` release run — matching the documented rate — all confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling
randomness — CLAUDE.md's own "Flaky tests" section). Don't run the full and `--quick` suites
CONCURRENTLY on this box (found at `v86_ae`) — run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 726 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 725 → 726 at `v87_g` (`gen.wizard_step3_lessons`; `gen.wizard_step3` and
`gen.wizard_step4` are deliberately kept but now UNUSED, so their 33-language translations survive if
a chaptering step ever returns) and are UNCHANGED at `v87_h`. `lessons.json`/`canonical-analysis.json` unchanged since `v86_ag`.
`drafts.json` may exist at the project root (server-created, gitignored) — normal. `APP_VERSION = 'v87_h'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

Now 54 numbered standing rules across "Rules earned in session 28…34" plus dedicated blocks for the
`v83`/`v84`/`v85`/`v86` lines — see `roadmap_v87.md`'s own copy of them. Read the **"⚠️ How the rules
are NUMBERED"** note before citing one. Three earned or re-confirmed at THIS cut, worth carrying
forward explicitly:

- **A written-up plan's factual claims are still claims — measure them.** Item AL's own write-up said
  "PDF/comic chapters never set `storyStyle` today" as the justification for making writing-style
  LLM-only. Half wrong: `pdfGenerateAll()` really does send it, the server stores it per chapter, and
  it reaches real lesson prompts (`sysGrammar`/`sysConjugation`/`generateWriting`/`synonyms`).
  Building to the plan's sentence would have silently DELETED a working capability. Only
  `comicCreateChapter()` genuinely hardcodes `storyStyle: null`. Rule 35, from a new direction: the
  document a previous session wrote is a design claim, not a measurement.
- **A "does not exist" assertion is VACUOUS in this DOM harness.** `lib-dom`'s `makeDocument()`
  AUTO-VIVIFIES every id (`getElementById` mints a div on a miss, deliberately). So
  `!!document.getElementById('gone-id')` is always true and its negation always red — a guard written
  that way fails on a CORRECT tree. Absence claims belong at the SOURCE layer. Found by writing it
  and watching it fail, not by reasoning.
- **The auto-vivify trap has a SECOND, worse form: a guard that has been green for releases.**
  `unit-arc-options.test.js` §1 claimed "if a form loses its container, the picker silently renders
  nowhere" — via `!!document.getElementById(id)` through the harness. It stayed GREEN through the
  `v87_h` release that DELETED `#pdf-arc-types` from `index.html` entirely: exactly the failure it was
  written to catch. When you delete an id, GREP the tests for a guard that claims to protect it and
  check that guard actually fails.
- **A cross-realm object literal breaks `deepStrictEqual`.** An object built inside the `vm` context
  carries THAT realm's `Object.prototype`; `assert.deepStrictEqual` reports a mismatch even when
  every value is equal. Go through `JSON.stringify`/`JSON.parse`, as the older assertions in
  `unit-gen-wizard` already did.

Still the most load-bearing habit across the whole `v86` line: **when a live-tested prompt fix
measures zero effect, reconsider the diagnosis before trying a third wording.**

# WHERE TO START

**Nothing is mid-flight.** Item U (`v87_b`→`v87_d`), item R (`v87_d`/`v87_e`), item AK (`v87_f`) and
item AL (`v87_g`/`v87_h`) are all closed for their own scope. Everything below is carried from
`roadmap_v87.md`'s own "OPEN AT THE v87 CUT" section — see it for full detail. Several are blocked on
a decision, not on effort; those are marked.

**Buildable now, no decision needed:**
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Not requested, but a quick, well-precedented follow-up.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works, but
  wants its own design pass first.

**⚠️ Blocked on a user decision — do NOT start without one:**
- **Item P's pedagogy question**: should infinitive-vs-conjugated count as a permitted distractor axis
  for VERBS specifically, distinct from case? TWO live-model cycles already failed to move this via
  wording alone — a third guess is explicitly the wrong move.
- **Difficulty placement** (from item AL, above) — needs its own design pass.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — needs a prompt-design decision
  AND a live-model measurement before any code ships.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question (does a
  correction survive a chapter re-analysis? no, today).
- **Item C (comic/PDF upload-card UX)** — needs the user's confirmation of the recommendation. Note
  `v87_h` just reshaped both panels; re-read the recommendation against the CURRENT markup before
  putting it to the user, since some of it may already be satisfied.
- **Item A (move comic images out of `lessons.json`)** — needs the user's go-ahead before touching the
  6 existing topics.
- **Item B (vision-role model picker)** — needs a short design choice.
- **Item AK's own deferred half**: run-now-vs-schedule-with-smart-defaults. Confirmed at `v87_g` as
  NOT part of item AL ("schedule" there meant deferring the lesson-generation decision, already built).

**⚠️ Blocked on a live reproduction the user has to hit:**
- **Item AE (mobile-backgrounding)** — the `v86_d` fix did NOT recover on a real device; needs another
  occurrence with diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half**.
- **Item E** (chapter-title post-pass failures) — needs the raw model response captured.
- **Item T** (two questions initiated via text-selection → grammar click, never answered).

**Scoped but needing one more thing:**
- **Item AD (source-language furigana)** — needs a live-model check and a toggle-sharing design
  question settled.
- **Item F's "add explanations" half** — open and unscoped in detail.
- **Items G, N, O, V, X, Y, Z, AC** — each independently startable or needing user input; see
  `roadmap_v87.md`'s own carry-forward section. (Item V, multi-image comic upload, would extend item
  R's comic-draft scope.)

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.
