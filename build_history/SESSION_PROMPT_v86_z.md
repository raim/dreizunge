# Session prompt — written at the `v86_z` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_z`**. `v86_y` shipped two
UI-consistency fixes on the story-view controls. This cut (`v86_z`) makes item W's whole CP1/CP2
text-explorer pipeline work in the static build too.

**What shipped this cut (`v86_z`)**:

User ask: *"Can we build the text analysis explorer also into the static docs/index.html?"* Item W
was live-only until now — `GET /api/analysis/:id`/`POST /api/analyze-chapter/:id` have no static
equivalent, so the 🔍 button had nothing to show on GitHub Pages.

`canonical-analysis.json` is OPTIONAL and typically covers only a FEW chapters (CP2 is a real model
call PER SENTENCE, minutes each — nobody runs it for the whole corpus at once; 3 of 338 chapters at
this cut). Baking whatever exists is an honest snapshot, the same "frozen at the last
`build-static.js` run" contract every other baked artifact already has.

`build-static.js` reads the store (env-overridable via `CANONICAL_ANALYSIS_FILE`, matching
`server.js`'s own convention), transforms each chapter into the SAME shape `GET /api/analysis/:id`
returns, and bakes it as `const STATIC_ANALYSIS` — a new, 7th fingerprinted `BUILD_SOURCES` entry. A
missing file degrades to `{}`, not a crash. `_ensureTextExplorerData()` gained a
`typeof STATIC_ANALYSIS !== 'undefined'` branch (the SAME convention `STATIC_LESSONS` checks already
use everywhere) that reads the snapshot directly and NEVER calls `fetch` — an absent chapter degrades
to the existing clean `error` cache state.

**Live-verified, not just asserted**: served the rebuilt `docs/index.html` from a plain static HTTP
server (no Node app server at all), opened a real analysed chapter, clicked 🔍, and confirmed the
actual rendered DOM contains real per-word `<mark>` elements from the baked data — screenshotted.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_z`) for the full design/verification; `v86_v`-`v86_y` if you need the rest
   of the comic review-card/retranslate/flags history this session built.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and needs another catch-up pass
   (last done through `v86_x`) — this cut's own `STATIC_ANALYSIS` addition is not in there either.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 298 checks
node test/run.js --quick                  → expect 255
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked once in earlier cuts THIS session too, all
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness, per CLAUDE.md's
own "Flaky tests" section — a test reading the live corpus directly can fail from real-time usage).

Corpus at this cut: **338 topics, 99 storylines, 33 languages, 713 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server was actively generating content
throughout this session, more than once — re-measure fresh at commit time if `unit-roadmap-version`
disagrees). No new `en` keys, no server change this cut. `docs/index.html` rebuilt after the
`APP_VERSION` edit — now 7 baked inputs, up from 6 (`canonical-analysis.json` added).
`lessons.json`/`canonical-analysis.json` untouched by this cut's own edits; re-check for concurrent
live-usage drift regardless. `APP_VERSION = 'v86_z'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_y` cuts — see those releases' own sections for the reasoning)

1. **When baking a new artifact into the static build, follow the EXISTING conventions exactly** —
   the env-override name (`CANONICAL_ANALYSIS_FILE`, matching `server.js`'s own), the
   `typeof X !== 'undefined'` static-detection idiom (`STATIC_LESSONS`'s own), and the fingerprinted-
   `BUILD_SOURCES` freshness guard were all copied from precedent, not invented fresh — a new,
   different pattern would have been one more thing a future session has to learn.
2. **A live-model-touching feature's OFFLINE counterpart still needs a REAL check** — serving the
   actual built `docs/index.html` from a plain HTTP server (not the app's own dev server) and clicking
   the real button, not just asserting the client function's return shape.
3. **When a scarce, expensive artifact (CP2 analysis, minutes per sentence) only covers a FEW
   chapters, say so plainly rather than implying full coverage** — the roadmap entry and this file
   both state "3 of 338" rather than "chapters are now available offline."
4. **A test that runs the REAL build script as a subprocess against isolated scratch files is worth
   the extra setup over asserting on internal function shapes alone** — `unit-static-analysis-bake`
   catches a bug in the ACTUAL CLI invocation, env var, and file-not-found path, not just the transform
   logic in isolation.
5. **Mutation-test every guard you write or rely on.**
6. **When splitting unrelated same-session work into separate releases, verify a file with ZERO
   changes from one release by diffing against `git show HEAD:<file>` rather than assuming** — used
   again this cut (`build-static.js`/`unit-static-freshness.test.js` were pure `v86_z`, confirmed via
   `git diff --stat HEAD` before touching either for the `v86_y` commit).

# WHERE TO START

- **A real, diagnosed generation-prompt bug, not yet fixed** (flagged at `v86_y`, still open):
  `PROMPTS.inflections.examples.default` (prompts.json) demonstrates `formLabel`/`formChoices`/
  `explanation` in ENGLISH even though its own `translation` field switches to German — internally
  inconsistent with the schema's own "{S}" instruction. Confirmed via a real corpus lesson
  (`tp_17880367188140000070`, nl-target/de-source, no dedicated example, falls back to this default):
  every one of those fields came out in DUTCH instead of German. `wordForms`'s own default example
  does NOT have this inconsistency — checked directly, not assumed. Recommended fix: rewrite the
  `default` example's `formLabel`/`formChoices`/`explanation` into German, matching its own
  `translation` field, mirroring this project's own established remedy for exactly this class of
  compliance failure (the German ALL-CAPS worked example, `_comicExtractPrompt`). User asked to
  "analyze and suggest," not build yet — still needs their go-ahead.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_z`'s own additions added — cheap,
  doc-only, keeps accumulating faster than it gets caught up (last full pass was through `v86_x`).
- **The wizard-page alternative for the review card** — explicitly NOT chosen at `v86_x`; revisit
  only if asked specifically.
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
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last full pass through `v86_x`); other sections are kept current inline as
each cut touches them.
