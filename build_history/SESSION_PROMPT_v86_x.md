# Session prompt — written at the `v86_x` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_x`**. `v86_w` shipped a
comic-extract prompt fix and a retranslate-story button. This cut (`v86_x`) is a layout fix to
`v86_v`'s own comic text-review card, from the user trying it in real usage.

**What shipped this cut (`v86_x`)**:

**User feedback on the review card**: *"the popover for text confirmation could be bigger and should
allow to view the text without scrolling. it could be a whole page in the sequence of pages for
storyline generation."* Asked the user to choose between a bigger modal and restructuring into its
own wizard page (a real architectural tradeoff — a wizard page needs new back-navigation wiring and
state to return to panel-drawing if the user goes back). **User chose the bigger modal.**

`comicOpenReview()`'s modal box grew from a fixed 520px to near-fullscreen (`95vw` × `90vh`), and —
the change that actually buys back vertical space — its body switched from a single-column flex list
to a CSS GRID (`repeat(auto-fill,minmax(340px,1fr))`), so panels flow into multiple columns on a wide
screen instead of stacking one under another. Each panel's own fields grew too (bigger image, bigger
caption font, textarea 2→4 rows) — the other half of "too small to read without scrolling WITHIN one
panel's own field," not just the overall box.

**Visually verified** at three viewport sizes on an isolated server instance: desktop (1440×900)
shows 3 columns; a 7-panel case scrolls the outer container gracefully (the deliberate safety net);
mobile (375×812) collapses to one column with confirmed zero horizontal overflow.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_x`) for the full design-choice reasoning; `v86_v`/`v86_w` if you need that
   history.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's OWN row predates `v86_o` and has not been kept current since
   (carried forward again — three cuts' worth of comic-review-card/retranslate additions now).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 296 checks
node test/run.js --quick                  → expect 253
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. Two OTHER flakes
(`unit-ui-journeys`, `unit-word-progress`) appeared once in the `v86_w` cut too, both confirmed
pre-existing/unrelated — `buildExercises`'s own corpus-sampling randomness (CLAUDE.md's "Flaky tests"
section) can surface almost any test touching generated exercise content.

Corpus at this cut: **338 topics, 98 storylines, 33 languages, 711 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh at commit time if `unit-roadmap-version`
disagrees. No new `en` keys, no server change this cut. `lessons.json`/`canonical-analysis.json`
untouched by this cut's own edits (re-check for concurrent live-usage drift regardless).
`docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_x'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`/
`v86_w` cuts, and this cut's own finding below — see those releases' own sections for the reasoning)

1. **When a UI complaint has more than one possible fix with meaningfully different engineering
   cost/risk (a bigger modal vs. a new wizard page), ask which the user wants rather than picking one
   silently** — new this cut: the two options were laid out with their real tradeoffs, and the user's
   answer (bigger modal) was the lower-risk one, not necessarily the one a guess would have landed on.
2. **A layout/CSS-only change still needs a REAL check, not just "looks right in my head"** —
   verified at three actual viewport sizes via the browser tooling, including checking
   `scrollWidth`/`clientWidth` directly rather than eyeballing a screenshot for horizontal overflow.
3. **A markup-level test should read the REAL rendered output (the tracked element's own `innerHTML`),
   not a source-text regex over `index.html`** — same lesson as `v86_v`'s own vacuous-test finding,
   applied again here for the grid/sizing assertions.
4. **Mutation-test every guard you write or rely on.**
5. **When restructuring uncommitted work into cleanly separable releases, verify the split with a
   real `diff` against a known-good backup, not just "I think I reverted the right lines"** — used
   this cut (and the one before it) to confirm each commit's `index.html` was EXACTLY the intended
   state, nothing more, nothing less.

# WHERE TO START

- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s item W row** needs a small update for `v86_t`'s `_comicPanelsFlatTextHtml`
  rename — cheap, doc-only, carried forward across several cuts now.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`/`v86_w`/`v86_x`'s own additions
  (`comicOpenReview()` and friends, `retranslateStory()`, the prompt fix) added — also cheap, doc-only.
- **A further comic-extract prompt refinement**: distinguish a BLANK-LINE structural break from a
  single-newline same-block continuation (see `v86_w`'s own "byte-identical" finding); needs another
  live probe round, ideally without concurrent Ollama load.
- **A "re-extract just this panel" affordance from inside the review card** (not requested yet).
- **The wizard-page alternative for the review card** — explicitly NOT chosen this cut; revisit only
  if the user asks for it specifically after living with the bigger modal for a while.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed).
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P** needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which never got it (only the completion/progress card panel did).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and has not
been kept current since (`v86_v`/`v86_w`/`v86_x`'s additions are the latest gap); other sections are
kept current inline as each cut touches them.
