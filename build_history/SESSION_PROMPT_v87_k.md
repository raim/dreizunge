# Session prompt — written at the `v87_k` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_l`, `v87_m`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_i`** — **item Z is CLOSED**: a
word tap now plays ALL that word's questions, across lesson types, in ascending lesson order, then
rejoins normal forward progress. Item AL closed at `v87_h` before it.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_g` added ONE new `en` key (`gen.wizard_step3_lessons`) after asking and being told which of
three options to take; `v87_h` added NONE (the unification deliberately reused each deleted control's
own existing string). Ask fresh THIS session before adding any.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`, and the user's own
live server was running on port 3000 throughout the `v87_g`/`v87_h`/`v87_i` cuts. `server.js` serves `index.html` with
`readFileSync` PER REQUEST, so a client edit is live on that server without restarting anything —
`v87_g` was live-verified that way, with nothing of the user's touched. `prompts.json` and `ui.json`
HOT-RELOAD live via `fs.watch` too.

**What shipped this cut**: a second user-reported BUG FIX — the lesson-set (teacher view) story reader
showed comic panel images only in the text-analysis view. Root cause: `renderStoryText` OPEN-CODED its
body render instead of calling `_storyBodyHtml`, the shared renderer the progress and exercise cards
use, so it never reached that function's comic-panel branch. Same shape as `v86_a`, fixed once and
reintroduced by a card that re-implemented rather than reused. Three MORE defects fell out of the same
line, none reported: the translation view's padding wrapper, TRACK T's three-state colouring (the copy
still used the superseded `v74_n` two-shade array), and the `data-tutor-select` marker — so `PLAN §12`'s
"select text, ask the tutor" had **never worked on that card**.

**⚠️ `v80_t` IS OVERTURNED FOR THAT PANEL, by explicit user ruling.** Identical code necessarily makes
its words tappable: inside `_highlightVocabHtml`, `stateByKey` drives BOTH the three-state classes and
the tap affordance, so they cannot be separated. The user was given that trade-off (including an
opt-out that would have preserved `v80_t` at the cost of the old colouring) and chose "fully identical
— tappable too, if it is possible such that the previous edit and qc functionality should still work."
That condition was verified, not assumed — see the `v87_k` entry. **The architecture line has moved**:
every `_storyBodyHtml` caller is a tappable, run-bearing surface; the genuinely read-only panels
(`_renderSavedStory`/`_renderChainStory`) still open-code the two-shade highlight.

**`v87_j` before it** fixed a saved text analysis rendering "lädt…" forever (two client-side defects in
item W's seam), and **`v87_i`** shipped item Z and, with it, the `unit-tap-word` flake — which was never
corpus noise but `Math.random()` in `tapWord()`. **Update your priors accordingly** (rules block below).

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   item AL's status block, then `# ✅ SHIPPED IN THE v87 LINE` (`v87_b` → `v87_k`).
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

**⚠️ `unit-tap-word` IS NO LONGER FLAKY, and the reason matters more than the fact.** It failed ~35%
of standalone runs from `v80_t` to `v87_h` and was documented as `buildExercises` corpus sampling
throughout. It was a REAL DEFECT — `Math.random()` inside `tapWord()` — fixed at `v87_i`. It should
now pass every time; **a failure there is a genuine regression, not noise.**

`unit-observations-log` is still a known intermittent flake (documented since `v81_b`/`v86_b`) —
reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys` and
`unit-word-progress` have each flaked at least once across the `v86` line. **But do not assume any of
those three is corpus noise either** — that assumption held for `unit-tap-word` for seven releases and
was wrong. Each deserves the same discriminating measurement (find the assertion, instrument what it
compares, check whether the product is actually varying). Don't run the full and `--quick` suites
CONCURRENTLY on this box (found at `v86_ae`) — run them one at a time.

Corpus at this cut: **337 topics, 97 storylines, 33 languages, 726 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 725 → 726 at `v87_g` (`gen.wizard_step3_lessons`; `gen.wizard_step3` and
`gen.wizard_step4` are deliberately kept but now UNUSED, so their 33-language translations survive if
a chaptering step ever returns) and are UNCHANGED at `v87_h`. `lessons.json`/`canonical-analysis.json` MOVED at this cut (336 → 337 topics) — the user's own live
server generated a topic mid-session, which is exactly the "inherently live snapshot" this line warns
about; both files were swept into the `v87_i` release commit so the guarded counts stay consistent
with the tree.
`drafts.json` may exist at the project root (server-created, gitignored) — normal. `APP_VERSION = 'v87_k'`.

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
- **A card that RE-IMPLEMENTS a shared renderer will silently miss everything that renderer grew.**
  `v87_k`: the lesson-set story reader open-coded its body render instead of calling
  `_storyBodyHtml`, and so missed FOUR things — comic images (the reported symptom), the translation
  wrapper, TRACK T's three-state colouring, and the tutor-selection marker, meaning `PLAN §12` never
  worked there at all. Only one was ever reported; the other three were invisible. When two surfaces
  are meant to show "the same thing", assert EXACT STRING EQUALITY between their renders, not that
  both contain some feature — the weaker check passes the moment they drift.
- **A branch that tests IDENTITY (`o.text == null`) is defeated by any caller that always passes the
  value.** That is `v86_a`, and `v87_k` is the same defect reintroduced by a different caller. When
  fixing one, grep for OTHER callers of the same option rather than fixing the one that was reported.
- **When a user reports "it just hangs", check whether TWO states render the SAME string.** The
  `v87_j` text-explorer bug presented as a hang with no error because `!entry` (never fetched) and
  `status:'loading'` (in flight) both rendered the loading label — so a chapter nothing had even
  tried to load looked identical to one mid-request. Reproduce in the harness and count the FETCHES,
  not the pixels: zero fetches is the finding.
- **A second surface added over a shared cache needs the repaint path widened too.** `v86_ad` gave the
  lesson-set card its own explorer flag over the SAME cache, but every repaint in the data path still
  named the completion card — so the new surface fetched correctly and then refreshed the old one.
  When adding a second consumer of a shared async cache, grep the RESOLVE path for hard-coded
  renderers, not just the trigger path.
- **A "known flake" is a HYPOTHESIS, not a fact — and this one was wrong for seven releases.**
  `unit-tap-word`'s ~35% failure was blamed on `buildExercises` corpus sampling by every session since
  `v80_t`, including in this prompt. The cause was `Math.random()` in the PRODUCT. The discriminating
  measurement took one instrumented run: the test already computed the value separating "the tap
  truncated the run" from "the lesson really is one question" (`full`), and they were equal every
  time. Before re-confirming an inherited flake, find the assertion and instrument what it compares.
- **A guard that pins a PROXY fails in BOTH directions.** `n > 1` ("the run holds the whole lesson")
  stood in for a claim the very next line stated properly (`n === full`). A proxy goes red on correct
  behaviour and green on broken behaviour; both happened in this one file.
- **The auto-vivify trap has a SECOND, worse form: a guard that has been green for releases.**
  `unit-arc-options.test.js` §1 claimed "if a form loses its container, the picker silently renders
  nowhere" — via `!!document.getElementById(id)` through the harness. It stayed GREEN through the
  `v87_h` release that DELETED `#pdf-arc-types` from `index.html` entirely: exactly the failure it was
  written to catch. When you delete an id, GREP the tests for a guard that claims to protect it and
  check that guard actually fails.
- **A guard is only as good as the FIXTURE it runs against.** Two assertions added at `v87_i` stayed
  GREEN when the code they protected was deleted — not because they were written badly, but because
  the fixture did not exercise the case (an opening lesson whose type made a reset moot; a word whose
  questions all sat in ONE lesson, so there was no order to get wrong). Mutation-testing found both.
  The fixes: a seam that reproduces the state directly, and a SECOND fixture selected for the property
  the section actually depends on. **Mutation-test every new assertion, not just the feature** — and
  when one stays green, ask what the fixture is failing to cover.
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
- **⭐ Audit the three remaining "known flakes"** (`unit-observations-log`, `unit-ui-journeys`,
  `unit-word-progress`) the way `unit-tap-word` was audited at `v87_i`: find the failing assertion,
  instrument what it compares, then decide whether the PRODUCT is varying or the guard is a proxy. One
  of the four turned out to be a real defect; the other three have never been checked. Self-contained,
  and each one settled removes a recurring tax on every session's baseline.
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
- **Items G, N, O, V, X, Y, AC** — each independently startable or needing user input; see
  `roadmap_v87.md`'s own carry-forward section. (Item V, multi-image comic upload, would extend item
  R's comic-draft scope.)

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.
