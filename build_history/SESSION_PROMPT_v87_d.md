# Session prompt — written at the `v87_d` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_e`, `v87_f`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_d`** — item R (unfinished-project
drafts) shipped, folded into item U's own jobs popover as originally scoped. Item U is now CLOSED —
all three of its own sub-parts (`v87_b`, `v87_c`, `v87_d`) are done.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_b` and `v87_d` both added new `en` keys — asked ONCE, at the `v87_b` cut, the user confirmed it
was safe; `v87_d` reused that same standing confirmation rather than re-asking mid-session (the
session-prompt note says ask again fresh NEXT session, not on every cut within one). Ask again fresh
this time, since a new session is starting.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. `prompts.json` and
`ui.json` HOT-RELOAD live via `fs.watch` — no server restart needed after editing either.

**What shipped this cut**: item R — unfinished-project drafts (the PDF/paste-then-split upload flow
only; the comic-image flow is NOT covered, a natural follow-up), folded into item U's jobs popover
per that item's own scoping note. Two real bugs found and fixed by actually resuming a draft live,
not by reading the code — see `roadmap_v87.md`'s own `v87_d` entry under "SHIPPED IN THE v87 LINE"
for the full write-up, including what those bugs were and how they were found.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   its "OPEN AT THE v87 CUT" list, then `# ✅ SHIPPED IN THE v87 LINE` (`v87_b` → `v87_d`) for how
   the jobs popover / drafts were built.
3. `build_history/roadmap_v86.md` is KEPT as the historical record for the whole `v86` line
   (`v86_a`…`v86_ag`, thirty-three point releases, under `# ✅ SHIPPED IN THE v86 LINE`) — go there for
   how something from THAT line was built, and for item R's/item S's own original scoping.
4. `INTERNALS.md` **§6b** now covers the jobs popover AND the drafts store (`v87_b`→`v87_d`, two
   adjacent sections near the end); still current through `v86_af` for item W's whole CP1/CP2
   browser-integration surface, and through `v86_x` for the comic-panel subsystem's own row.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 303 checks
node test/run.js --quick                  → expect 258
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked at least once across the `v86` line too
(re-confirmed live at the `v87_b` cut: `unit-tap-word` failed 7 of 20 standalone runs, matching the
documented rate), all confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling
randomness — CLAUDE.md's own "Flaky tests" section). Don't run the full and `--quick` suites
CONCURRENTLY on this box (found at `v86_ae`) — it produced one spurious contention failure in an
otherwise rock-solid test; run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 722 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 718 → 722 (`toast.draft_resumed`/`draft_missing`/`draft_discarded`,
`jobs.discard` — this cut). `lessons.json`/`canonical-analysis.json` unchanged since `v86_ag`.
A NEW file, `drafts.json`, may exist at the project root (server-created, gitignored, holds
in-progress unfinished-project drafts) — this is normal and not part of the tracked tree.
`APP_VERSION = 'v87_d'`.

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

Three more, earned across `v87_c`/`v87_d`, worth carrying forward explicitly:
- **A numerically-higher `z-index` does not guarantee paint order if an ANCESTOR establishes its own
  stacking context** (`v87_c`) — `.jobs-pop`'s `z-index:902` lost to `#tutor-widget`'s `z-index:901`
  because `.jobs-pop` lived inside `#bottom-bar` (`position:fixed`+`z-index:900`, its own stacking
  context), capping every descendant's effective paint order regardless of its own z-index value.
  Found by actually opening both floating panels together in the browser pane, not by reading the
  CSS. When two `position:fixed` overlays need to layer correctly, check whether either is nested
  inside a THIRD fixed/z-indexed ancestor before trusting the z-index numbers alone.
- **A test harness's own stub can be silently broken in a way that makes an assertion pass or fail
  for the wrong reason** (`v87_c`) — `test/lib-dom.js`'s `Element.contains()` AND `.parentNode` both
  unconditionally return `false`/`null` for the statically-parsed tree (confirmed by direct probe),
  so any assertion built on either would pass or fail independent of whether the real logic is
  correct. When a DOM API a test depends on isn't in `lib-dom.js`'s explicit feature list ("layout,
  styling and event dispatch are out of scope" — its own header comment), verify it actually works
  with a throwaway probe before trusting an assertion built on it.
- **A step number derived from its own LABEL TEXT can be wrong — confirm it against the actual markup
  nesting** (`v87_d`) — `_genWizardGoto(3)` looked right because wizard step 3 is labeled "Chapters"
  and a draft's own content IS chapters, but the real chunk-list container (`#pdf-panel`) lives inside
  card 2 ("Text"), not card 3 (a different feature — per-chapter lesson-type overrides). Found by
  searching the raw markup for `#pdf-panel`'s nearest enclosing `gen-card`, then confirmed by actually
  screenshotting the resumed screen — a label-text assumption about UI structure is exactly the kind
  of claim that needs the same "render and inspect the actual output" discipline as a behavioural one.

# WHERE TO START

Item U is fully closed (`v87_b`→`v87_d`). Everything below is carried from `roadmap_v87.md`'s own
"OPEN AT THE v87 CUT" section — see it for full detail and pointers back to `roadmap_v86.md`/`v85.md`
where each item's original diagnosis lives.

- **Item R's comic-image half** — the drafts feature just shipped covers the PDF/paste-then-split
  upload flow only; comic-image upload (`APP_COMIC`) has its own, different state shape and is not
  covered. Not scoped in detail; a natural follow-up if the user wants it, not assumed wanted.
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

`INTERNALS.md` §6b has the full feature → function map — now covers the jobs popover AND the drafts
store (`v87_b`→`v87_d`); current through `v86_af` for item W's whole CP1/CP2 browser-integration
surface; the comic-panel subsystem's own row is current through `v86_x`; other sections are kept
current inline as each cut touches them.
