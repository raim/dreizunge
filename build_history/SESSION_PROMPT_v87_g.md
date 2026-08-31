# Session prompt — written at the `v87_g` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_h`, `v87_i`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_g`** — the generation wizard is
now a genuine THREE-step flow (1 · Language / 2 · Text / 3 · Lessons), which is **part 1 of item AL**.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_g` added ONE new `en` key (`gen.wizard_step3_lessons`) after asking and being told which of
three options to take. Ask again fresh THIS session before adding any more.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`, and the user's own
live server was running on port 3000 throughout the `v87_g` cut. `server.js` serves `index.html` with
`readFileSync` PER REQUEST, so a client edit is live on that server without restarting anything —
`v87_g` was live-verified that way, with nothing of the user's touched. `prompts.json` and `ui.json`
HOT-RELOAD live via `fs.watch` too.

**What shipped this cut**: item AL part 1 — the wizard restructuring. The four ⚠️ OPEN questions item
AL had recorded were **all asked before any code was written**, and answered: keep the live review
stop for PDF/comic; leave difficulty exactly where it is; renumber to 3 steps; move full-chain to
card 1 and delete the create-now shortcut. Continue-from (+ show-other-languages + full-chain) moved
to card 1; story-length/chapter-count/writing-style to card 2; skip-lessons, the arc tick-list (which
was nested inside `#num-chapters-row`) and vocab-mode to card 3. `#gen-card-3` ("Chapters"),
`#gen-create-now-btn` and `_genWizardCreateNow()` are gone. Full write-up, including a MEASURED
correction to item AL's own text about `storyStyle`: `roadmap_v87.md`'s own `v87_g` entry.

**🆕 THE PRIORITY FOR THIS SESSION — item AL PART 2, `roadmap_v87.md`, the half the item is really
named for.** Read item AL's own status block first (it is now the first thing in that entry), then
the `v87_g` shipped entry. In short:
- `#pdf-panel` and `#comic-panel` still carry their OWN duplicated `#pdf-arc-row`/`#comic-arc-row`,
  skip-lessons, storyboard and analysis rows, and their own start buttons (`pdfGenerateAll()` /
  `comicOpenReview()`, fired from a button inside card 2). Route all three input modes through card
  3's ONE canonical lesson-type block — the user's own "current 4/Lessons should be the ONLY place
  where we can select lesson types to be generated (optionally)".
- **The user's ruling on HOW, already given: KEEP THE LIVE REVIEW STOP.** Extraction, chunk splitting
  and panel editing stay live in card 2, exactly as today — `comicExtractPanels()` and
  `splitChaptersLLM()`'s own TIMING must not change. Only the lesson-type choice and the final "go"
  move to card 3.
- **A real bug, confirmed by reading the source, still unfixed**: `comicCreateChapter()` never reads
  or sends `continuedFrom`, unlike `pdfGenerateAll()` and `doGenerate()` — comic-sourced chapters
  cannot be linked as a continuation, silently. It belongs to part 2.
- Watch the gates: `#gen-arc-row`/`#per-chapter-row`/`#post-gen-row` are gated on
  `APP.numChapters > 1`, which means nothing for PDF/comic (their chapter count is
  `_pdfChunks.length` / `_comicPanels().length`). `#post-gen-qc-cb` is client-orchestrated for the
  LLM book path only and has no PDF/comic wiring today — decide deliberately, don't expose a
  no-op checkbox.

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
**`unit-tap-word` failed 4 of 12 standalone runs on an UNTOUCHED tree at the `v87_g` cut**, matching
the documented rate — all confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling
randomness — CLAUDE.md's own "Flaky tests" section). Don't run the full and `--quick` suites
CONCURRENTLY on this box (found at `v86_ae`) — run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 726 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 725 → 726 (`gen.wizard_step3_lessons` — this cut; `gen.wizard_step3` and
`gen.wizard_step4` are deliberately kept but now UNUSED, so their 33-language translations survive if
a chaptering step ever returns). `lessons.json`/`canonical-analysis.json` unchanged since `v86_ag`.
`drafts.json` may exist at the project root (server-created, gitignored) — normal. `APP_VERSION = 'v87_g'`.

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
- **A cross-realm object literal breaks `deepStrictEqual`.** An object built inside the `vm` context
  carries THAT realm's `Object.prototype`; `assert.deepStrictEqual` reports a mismatch even when
  every value is equal. Go through `JSON.stringify`/`JSON.parse`, as the older assertions in
  `unit-gen-wizard` already did.

Still the most load-bearing habit across the whole `v86` line: **when a live-tested prompt fix
measures zero effect, reconsider the diagnosis before trying a third wording.**

# WHERE TO START

**Item AL part 2 first** — see the standalone section above and item AL's own status block in
`roadmap_v87.md`. Its four originally-⚠️-OPEN questions are ANSWERED now; don't re-ask them, but DO
go back to the user for anything genuinely new that part 2 surfaces.

Item U (`v87_b`→`v87_d`), item R (`v87_d`/`v87_e`), and item AK (`v87_f`) are all closed for their
own scope. Everything else below is carried from `roadmap_v87.md`'s own "OPEN AT THE v87 CUT"
section — see it for full detail.

- **Item AK's own deferred half**: run-now-vs-schedule-with-smart-defaults for lesson generation —
  confirmed at the `v87_g` cut as NOT part of item AL ("schedule" there meant deferring the
  lesson-generation decision, which item AK already built). Still genuinely future work.
- **Item P's open pedagogy question**: should infinitive-vs-conjugated count as a permitted
  distractor axis for VERBS specifically, distinct from case? Two live-model cycles have already
  failed to move this via wording alone; don't try a third without a product/pedagogy decision.
- **Difficulty placement** (from item AL) — ruled OUT of scope for AL and deferred to its own design
  pass alongside the CP1/CP2 route: "difficulty means something different for each lesson type", and
  it may not be one dial at all.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question flagged;
  not started.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Not requested; a quick, well-precedented follow-up if wanted.
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with
  diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item E** (chapter-title post-pass failures) needs a live reproduction with the raw model response
  captured.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation
  — note item AL part 2 reshapes those same two panels, so do AL part 2 first.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item B (vision-role model picker)** needs a short design choice before building.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable but needs its own design pass first.
- **Items G, N, O, T, V, X, Y, Z, AC** — each independently startable or needing user input; see
  `roadmap_v87.md`'s own carry-forward section. (Item V, multi-image comic upload, is the one that
  would extend item R's own comic-draft scope if it's ever built.)
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.
