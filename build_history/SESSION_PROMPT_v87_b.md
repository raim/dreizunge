# Session prompt — written at the `v87_b` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_c`, `v87_d`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_b`** — the v87 line's first real
release, built on `v87_a` (the fresh line-cut from `roadmap_v86.md` at `v86_ag`).

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session. This
cut DID add four new `en` keys (`jobs.*`) — asked first, the user confirmed it was safe at the time.
Ask again fresh next session rather than assuming that answer still holds.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. `prompts.json` and
`ui.json` HOT-RELOAD live via `fs.watch` — no server restart needed after editing either.

**What shipped this cut**: item U (the roadmap's own carry-forward list) — a jobs popover, the
running/scheduled-jobs half of "a single place to see everything in flight." Full build write-up:
`roadmap_v87.md`'s own `v87_b` entry under "SHIPPED IN THE v87 LINE". The "unfinished projects" half
of item U stays open, blocked on item R (not yet built) — see WHERE TO START below.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   its "OPEN AT THE v87 CUT" list (item U's entry now points at the `v87_b` write-up for what
   shipped), then `# ✅ SHIPPED IN THE v87 LINE` (currently one entry, `v87_b`) for how it was built.
3. `build_history/roadmap_v86.md` is KEPT as the historical record for the whole `v86` line
   (`v86_a`…`v86_ag`, thirty-three point releases, under `# ✅ SHIPPED IN THE v86 LINE`) — go there for
   how something from THAT line was built. It is NOT the current roadmap.
4. `INTERNALS.md` **§6b** now also covers the jobs popover (`v87_b`, its own section near the end);
   still current through `v86_af` for item W's whole CP1/CP2 browser-integration surface, and through
   `v86_x` for the comic-panel subsystem's own row.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 300 checks
node test/run.js --quick                  → expect 256
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked at least once across the `v86` line too
(re-confirmed live at this cut: `unit-tap-word` failed 7 of 20 standalone runs, matching the
documented rate), all confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling
randomness — CLAUDE.md's own "Flaky tests" section). Don't run the full and `--quick` suites
CONCURRENTLY on this box (found at `v86_ae`) — it produced one spurious contention failure in an
otherwise rock-solid test; run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 718 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 714 → 718 (the four `jobs.*` strings, this cut). `lessons.json`/
`canonical-analysis.json` unchanged since `v86_ag`. `APP_VERSION = 'v87_b'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

Now 54 numbered standing rules across "Rules earned in session 28…34" plus dedicated blocks for the
`v83`/`v84`/`v85`/`v86` lines — see `roadmap_v87.md`'s own copy of them. Read the **"⚠️ How the rules
are NUMBERED"** note before citing one. The single most load-bearing habit across the whole `v86`
line, worth restating here explicitly: **when a live-tested prompt fix measures zero effect,
reconsider the diagnosis before trying a third wording** — this happened TWICE in `v86`'s own final
stretch (item AJ, item P) and both times the right move was a clear-eyed write-up and a user ruling,
not another guess.

This cut's own small additions to that discipline (not yet promoted to numbered rules, but worth
carrying): **render a new popover in the actual browser pane, at both desktop and mobile widths,
before trusting its CSS positioning** — `.jobs-pop`'s first anchor (`right:0`, copied from
`.bmodels-pop`) looked correct on paper and ran off the left edge of the viewport in practice, since
the two pills sit in different positions within their row. And **when a new call site is added
before an existing async bootstrap step, check whether it actually runs after that step resolves,
not just whether it's textually placed near a similar existing call** — `refreshJobsPill()`'s first
draft sat next to `refreshTutorAvailability()`, both inside `init()` but BEFORE `loadUIStrings()`
awaits, so `t()` returned raw keys at boot until the first navigation; moving it to after
`loadUIStrings()` fixed it, but the sibling call it was modeled on has the same latent gap, left
alone as out of scope.

# WHERE TO START

Everything below is carried from `roadmap_v87.md`'s own "OPEN AT THE v87 CUT" section — see it for
full detail and pointers back to `roadmap_v86.md`/`v85.md` where each item's original diagnosis lives.

- **Item U's remaining half**: fold item R's own "unfinished projects" list into the jobs popover
  just shipped (`v87_b`) — blocked on item R existing first.
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S, and now
  also the blocker for item U's second half.
- **Item P's open pedagogy question**: should infinitive-vs-conjugated count as a permitted
  distractor axis for VERBS specifically, distinct from case (genuinely absent for some languages)?
  Needs a product/pedagogy decision — two live-model cycles have already failed to move this via
  wording alone; don't try a third without one.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Not requested; a quick, well-precedented follow-up if wanted.
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with
  diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item E** (chapter-title post-pass failures) needs a live reproduction with the raw model response
  captured.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item B (vision-role model picker)** needs a short design choice before building.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works, but
  needs its own design pass first.
- **Items G, N, O, T, V, X, Y, Z, AC** — each independently startable or needing user input; see
  `roadmap_v87.md`'s own carry-forward section for specifics.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — now also covers the jobs popover (`v87_b`);
current through `v86_af` for item W's whole CP1/CP2 browser-integration surface; the comic-panel
subsystem's own row is current through `v86_x`; other sections are kept current inline as each cut
touches them.
