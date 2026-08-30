# Session prompt — written at the `v87_f` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v87_g`, `v87_h`, …) unless a future
session has a good reason to switch to `v88_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v87_f`** — item AK (new, from a real
user screenshot): "create chapters with no lessons yet" is now a real, working choice across ALL
THREE input modes (LLM-generate wizard, PDF/paste upload, comic-image upload), built in one pass per
the user's own explicit request.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.
`v87_f` added three new `en` keys under the standing per-session confirmation given earlier this
session (at `v87_b`). Ask again fresh THIS session before adding any more.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. `prompts.json` and
`ui.json` HOT-RELOAD live via `fs.watch` — no server restart needed after editing either.

**What shipped this cut**: item AK — "we generally want to have texts and chapters first, let the
user edit those, and THEN add lessons for them," confirmed "if you can, do it in one pass" for all
three input modes. A `skipLessons` flag threaded through `generate()`/`/api/generate`/
`/api/generate-book`/`_runBookJob` (chapters get `story` + `lessons:[]` and NOTHING else — the
existing "add lessons" tick-list, unchanged, is how they get lessons later), plus one shared
checkbox pattern on the wizard/PDF-panel/comic-panel. Live-verified end to end against the real
model: created a real zero-lesson chapter, then used the pre-existing, untouched add-lesson endpoint
to bring it to 1 lesson — the exact loop the user asked for. Full write-up: `roadmap_v87.md`'s own
`v87_f` entry under "SHIPPED IN THE v87 LINE".

**Explicitly deferred, not built**: run-now-vs-schedule-with-smart-defaults, the user's own framing
for a FUTURE wizard concept ("at a later point we want to have or auto-select meaningful defaults").
This cut only needed "don't schedule lessons at all yet" to become real — don't build the scheduling
half without a fresh ask.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v87.md` — its **index table** and **⚠️ Session protocol** block first, then
   its "OPEN AT THE v87 CUT" list, then `# ✅ SHIPPED IN THE v87 LINE` (`v87_b` → `v87_f`).
3. `build_history/roadmap_v86.md` is KEPT as the historical record for the whole `v86` line
   (`v86_a`…`v86_ag`, thirty-three point releases, under `# ✅ SHIPPED IN THE v86 LINE`) — go there for
   how something from THAT line was built.
4. `INTERNALS.md` **§6b** now covers the jobs popover, the drafts store (both kinds), AND the
   `skipLessons` mechanism (`v87_b`→`v87_f`, adjacent sections near the end); still current through
   `v86_af` for item W's whole CP1/CP2 browser-integration surface, and through `v86_x` for the
   comic-panel subsystem's own row (drawing/extraction/creation — distinct from drafts/skipLessons).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 306 checks
node test/run.js --quick                  → expect 259
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked at least once across the `v86` line too
(`unit-tap-word` failed 7 of 20 standalone runs at the `v87_b` cut, matching the documented rate),
all confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness — CLAUDE.md's
own "Flaky tests" section). Don't run the full and `--quick` suites CONCURRENTLY on this box (found
at `v86_ae`) — it produced one spurious contention failure in an otherwise rock-solid test; run them
one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 725 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). `en` keys rose from 722 → 725 (`form.skip_lessons_lbl`, `form.create_chapters`,
`pdf.create_chapters_only` — this cut). `lessons.json`/`canonical-analysis.json` unchanged since
`v86_ag`. `drafts.json` may exist at the project root (server-created, gitignored) — normal, not
part of the tracked tree. `APP_VERSION = 'v87_f'`.

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

Two more, earned this cut, worth carrying forward explicitly:
- **A source-text-anchored test can break from an UNRELATED, correct edit nearby** — adding
  `!base.skipLessons &&` to an existing condition (or a new field to an existing destructure) broke
  THREE pre-existing tests (`unit-arc-reinforce-types`, `unit-my-story`, `unit-book-script`) that each
  pinned an exact substring adjacent to the changed token. None of their underlying claims were wrong
  — only the anchor was too brittle to survive a nearby, unrelated addition. Re-anchor on the STABLE
  part of the claim (e.g. "this destructure block contains field X somewhere," not "field X is the
  token right before the closing brace") when fixing this class of break, not just on whatever string
  happens to make it pass again.
- **A stale browser cache can look exactly like a real bug** — a fresh `preview_start` without an
  explicit forced `navigate` reused an OLD in-memory `UI_STRINGS` that predated a same-session
  `ui.json` edit, showing a raw translation key instead of real text. A single forced reload resolved
  it. When a just-added `ui.json` key doesn't show up as expected in a live check, force-reload before
  concluding the wiring is broken.

# WHERE TO START

Item U (`v87_b`→`v87_d`), item R (`v87_d`/`v87_e`), and item AK (`v87_f`) are all closed for their
current scope. Everything below is carried from `roadmap_v87.md`'s own "OPEN AT THE v87 CUT" section
— see it for full detail and pointers back to `roadmap_v86.md`/`v85.md` where each item's original
diagnosis lives.

- **Item AK's own deferred half**: run-now-vs-schedule-with-smart-defaults for lesson generation —
  explicitly future work per the user's own framing; needs a fresh design conversation before
  starting, not assumed wanted yet.
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
  `roadmap_v87.md`'s own carry-forward section for specifics. (Item V, multi-image comic upload, is
  the one that would extend item R's own comic-draft scope if it's ever built.)
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — now covers the jobs popover, the drafts
store (both kinds), AND the `skipLessons` mechanism (`v87_b`→`v87_f`); current through `v86_af` for
item W's whole CP1/CP2 browser-integration surface; the comic-panel subsystem's own row (drawing/
extraction/creation) is current through `v86_x`; other sections are kept current inline as each cut
touches them.
