# Session prompt — written at the `v87_c` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_d`, `v87_e`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_c`** — a small, immediate
follow-up to `v87_b` (item U, the jobs popover), built the same session the user asked for it.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_b` DID add four new `en` keys (`jobs.*`) — asked first, the user confirmed it was safe at the
time; `v87_c` added none (reused `tutor.title`/`tutor.thinking`). Ask again fresh next session rather
than assuming that answer still holds.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. `prompts.json` and
`ui.json` HOT-RELOAD live via `fs.watch` — no server restart needed after editing either.

**What shipped this cut**: a user-requested follow-up to `v87_b` — "a tutor job should also be part
of the jobs popover" — plus a real, unrelated stacking-context bug found while testing it live (the
popover was rendering fully invisible behind the tutor widget whenever both were open). Full
write-up: `roadmap_v87.md`'s own `v87_c` entry under "SHIPPED IN THE v87 LINE".

**What's IN PROGRESS, not yet shipped**: item R (unfinished-project persistence — save parsed-but-
not-yet-generated chapters as a resumable draft) was being scoped/built when this cut closed out
ahead of it. Exploration done this session (not yet acted on):
- Confirmed the actual gap: `/api/split-chapters` is STATELESS (server.js) — chapter-splitting
  output lives ONLY in client memory (`_pdfChunks`, `_pdfRawText`, `_llmChunks`, `_uploadFileName` —
  all top-level `let`s in index.html, none persisted, none even in `localStorage`) until
  `pdfGenerateAll()` fires `/api/generate-book`, the FIRST moment anything reaches disk. A closed tab
  or lost connection any time before that click loses real work — including an expensive LLM
  chapter-split (`_llmChunks`), not just a paste.
- `_renderPdfChunks()` (index.html) is called after EVERY `_pdfChunks` mutation (15 call sites) — the
  one integration point that can carry a debounced autosave without instrumenting each individual
  mutator (upload, LLM-split, manual merge/split/delete/reorder/retitle all funnel through it).
- The roadmap's own scoping note (`roadmap_v86.md`'s `R` entry) says the resume UI "likely" belongs
  in the SAME popover as item U — which now exists (`v87_b`/`v87_c`) and was built generically enough
  (`kind`, `link.type`) to extend with a `kind:'draft'` entry without redesigning it.
- **Not yet decided**: the exact draft data shape (a new `store.drafts` array vs. something else),
  the `POST/GET/DELETE /api/drafts` endpoint shapes, and whether autosave should be debounced-on-every-
  edit (matching item S's "persist as it finishes" precedent) or a coarser milestone-only save. Read
  `roadmap_v87.md`'s own `R` entry (`roadmap_v86.md`, referenced from there) before re-deriving this.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   its "OPEN AT THE v87 CUT" list (item R and item U's own entries), then
   `# ✅ SHIPPED IN THE v87 LINE` (`v87_b`, `v87_c`) for how the jobs popover was built.
3. `build_history/roadmap_v86.md` is KEPT as the historical record for the whole `v86` line
   (`v86_a`…`v86_ag`, thirty-three point releases, under `# ✅ SHIPPED IN THE v86 LINE`) — go there for
   how something from THAT line was built, and for item R's own original scoping (its `R` entry) and
   item S's (its `S` entry, the "already-generated lessons" half R is the counterpart to).
4. `INTERNALS.md` **§6b** now also covers the jobs popover (`v87_b`/`v87_c`, its own section near the
   end); still current through `v86_af` for item W's whole CP1/CP2 browser-integration surface, and
   through `v86_x` for the comic-panel subsystem's own row.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 301 checks
node test/run.js --quick                  → expect 257
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

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 718 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time), unchanged from `v87_b` (this cut added no new `en` keys, touched no lesson/language data).
`lessons.json`/`canonical-analysis.json` unchanged since `v86_ag`. `APP_VERSION = 'v87_c'`.

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

Two more, earned THIS session, worth carrying forward explicitly:
- **A numerically-higher `z-index` does not guarantee paint order if an ANCESTOR establishes its own
  stacking context** — `.jobs-pop`'s `z-index:902` lost to `#tutor-widget`'s `z-index:901` because
  `.jobs-pop` lived inside `#bottom-bar` (`position:fixed`+`z-index:900`, its own stacking context),
  capping every descendant's effective paint order regardless of the descendant's own z-index value.
  Found by actually opening both floating panels together in the browser pane, not by reading the
  CSS. When two `position:fixed` overlays need to layer correctly, check whether either is nested
  inside a THIRD fixed/z-indexed ancestor before trusting the z-index numbers alone.
- **A test harness's own stub can be silently broken in a way that makes an assertion pass or fail
  for the wrong reason** — `test/lib-dom.js`'s `Element.contains()` unconditionally returns `false`
  (confirmed by direct probe: `el.contains(el)` → `false`), so a naive "click inside doesn't close /
  click outside does close" test built on it would ALWAYS pass regardless of whether the real
  `_jobsPopOutside` logic is correct. Caught by writing the test, watching it fail on the "obviously
  true" inside-case, and investigating the harness rather than the app code. When a DOM API a test
  depends on isn't in `lib-dom.js`'s explicit feature list ("layout, styling and event dispatch are
  out of scope" — its own header comment), verify it actually works before trusting an assertion
  built on it, or the harness's `.parentNode` (also found dead for the statically-parsed tree, same
  session) — check with a throwaway probe, don't assume "it's a DOM method, it must work."

# WHERE TO START

- **Item R** (unfinished-project persistence) — IN PROGRESS, see "What's IN PROGRESS" above for the
  exploration already done. This is the natural next piece of work.
- **Item U's remaining half**: once item R exists, fold its "unfinished projects" list into the SAME
  jobs popover (`v87_b`/`v87_c`) as a new `kind:'draft'` entry — the popover was built generically
  enough for this.
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

`INTERNALS.md` §6b has the full feature → function map — now also covers the jobs popover
(`v87_b`/`v87_c`); current through `v86_af` for item W's whole CP1/CP2 browser-integration surface;
the comic-panel subsystem's own row is current through `v86_x`; other sections are kept current
inline as each cut touches them.
