# Session prompt — written at the `v86_w` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_w`**. `v86_v` shipped the comic
text-review card. This cut (`v86_w`) is two unrelated fixes from one real-usage report.

**What shipped this cut (`v86_w`)**:

**A real-usage report on a Dutch road-sign photo** (`photo_2026-08-29_20-55-02.jpg`, chapter
`sl_169961753`) surfaced three things, only two of which needed code:

1. *"I manually changed the text by introducing newlines... which should be recorded as an ai error
   hunt."* — checked the stored lesson directly: **already built**, no code needed. The existing
   pure-diff `ai_error_hunt` machinery (fires on any `/api/save-story` edit with the checkbox on) had
   already recorded it correctly.

2. *"We should change the prompt such that it uses [visual] clues and itself separates the text by
   newlines."* — `_comicExtractPrompt` now instructs the model to insert a newline at a REAL visual
   structural break (a colour-block banner, a boxed/highlighted band, an unusually wide gap) even when
   there is no punctuation there, while explicitly NOT doing this for ordinary word-wrap. **Live
   A/B-tested against the actual reported photo** (cropped to the sign's front face): the OLD prompt
   produced a garbled CAPTION/IN-SCENE split PLUS fabricated text that is not on the sign at all
   ("ONTEIGENINGSDATUM: JUNI 16 2015 ZOEK DEZE TROUW" — a hallucination); the NEW prompt correctly
   classified the whole sign as one IN-SCENE block and split it into four real lines, no hallucination,
   in 52-115s vs. the old prompt's 574s. **A genuine, verified improvement.**

   A follow-up user message asked for MORE: also restore natural capitalization and punctuation
   (comic lettering conventionally omits both), bounded by "only where certain, never inventing
   words." Added, mirroring the shape of the EXISTING capitalization-restoration paragraph. Live-
   tested against the SAME photo: **byte-identical output to the newline-only version** — no
   measurable effect on this specific image. Reported to the user plainly as an honest non-result, not
   a success; shipped anyway per their own explicit choice, since it is low-risk (mirrors an
   already-working instruction, doesn't conflict with anything) and may help on a different caption
   style this one test photo didn't exercise. **Neither round reproduces the user's own ideal exactly**
   — they used a blank-line break between the three real structural blocks and kept the two trailing
   sentences joined on one line; the model uses a single newline uniformly for every line-like
   separation it perceives, with no paragraph-vs-line distinction. A further refinement is possible
   (ask explicitly for a BLANK line at a structural break vs. a single newline for a plain sentence-to-
   sentence continuation within the same block) but not attempted this cut — each live probe round
   took 9-19 minutes under heavy CONCURRENT Ollama load from the user's own live server usage during
   this very session, and two rounds were already spent.

3. *"We need a button to retranslate a story after we found and manually fixed errors."* — a manual
   `/api/save-story` fix does NOT re-translate on its own (a real LLM call, deliberately not
   triggered on every edit — same cost/latency reasoning as `/api/storyline-retitle`'s own "not on
   every edit" precedent), so `storyTranslation` could silently keep describing the pre-fix text
   indefinitely. New `POST /api/retranslate-story` (mirrors `/api/storyline-retitle`'s shape:
   find-by-name, one `callLLMTranslation` call, persist, return) plus a client 🔄 button next to the
   story's edit/QC icons. A first draft gated the button on `_canEdit() && canGenerate && d.story` —
   `unit-can-edit-teacher-mode.test.js`'s own sweep (§4, built specifically to catch a NEW call site
   re-widening `_canEdit()` with a capability term) correctly caught it, whether the operator is `||`
   (the original v79_j bug) or `&&` (this one). Fixed by DROPPING `_canEdit()` entirely and matching
   `#story-qc-btn`'s own precedent exactly (`canGenerate && d.story`, open to anyone) — re-translating
   doesn't let anyone free-edit content, it re-runs one deterministic LLM call and overwrites one
   derived field, the same class of action QC's button already is with no teacher-mode gate either.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_w`) for the full prompt-fix reasoning and the live-test transcripts; `v86_v`
   (comic text-review card) if you need that history.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's OWN row predates `v86_o` and has not been kept current since
   (carried forward again — `v86_v`'s `comicOpenReview()`/`_comicReview*` AND this cut's prompt
   change/`retranslateStory()` are both NOT yet reflected there).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 296 checks
node test/run.js --quick                  → expect 253
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` (`unit-observations-log.test.js`) is a KNOWN pre-existing intermittent flake
(documented since `v81_b`/`v86_b`) — reproduce standalone 5-10× before treating a failure there as
real. Two OTHER flakes appeared once this cut too (`unit-ui-journeys`, `unit-word-progress`) — both
confirmed 5/5 clean standalone and absent on a full re-run; `buildExercises`'s own corpus-sampling
randomness (documented in `CLAUDE.md`'s "Flaky tests" section) can surface almost any test that
touches generated exercise content, not just the two named above. Don't assume a NEW name here is a
regression without the standalone-reproduce step.

`unit-coverage-item-model` (a full corpus scan) can take several MINUTES if a real Ollama inference is
running concurrently on this box — confirmed via `ps` (100%+ CPU, growing CPU-time) during this cut,
not assumed; a live-model probe run alongside the test suite made this especially visible this
session (9-19 minutes per probe round, vs. the usual near-instant).

Corpus at this cut: **338 topics, 98 storylines, 33 languages, 711 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server was actively generating/editing
content THROUGHOUT this session, more than once — re-measure fresh at commit time if
`unit-roadmap-version` disagrees). 2 new `en` keys this cut (`toast.retranslate_done`,
`toast.retranslate_failed`). `lessons.json` and `canonical-analysis.json` both changed during this
cut from the user's own concurrent live usage, not from any edit made here. `docs/index.html` rebuilt
after the `APP_VERSION` edit. `APP_VERSION = 'v86_w'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 1-8 added at the `v86_v`
cut, and this cut's own findings below — see those releases' own sections for the reasoning)

1. **Report an inconclusive live-test result AS inconclusive, even when the user will ship it
   anyway** — new this cut: round 2's prompt addition came back byte-identical to round 1 on the real
   test photo, and that was stated plainly (not framed as a success) before asking whether to ship it.
2. **A carried-forward feature request can turn out to be ALREADY BUILT** — checking the stored data
   directly (the `ai_error_hunt` lesson) before writing any code saved a wasted duplicate-mechanism.
3. **When mirroring an existing route's SHAPE for a new one, check what the existing route
   DELIBERATELY does NOT do, and why** — `/api/retranslate-story` mirrors `/api/storyline-retitle`'s
   "separate, user-triggered, not automatic on every edit" reasoning specifically, not just its code
   shape.
4. **Live-model probe throughput degrades sharply under concurrent real usage on the same box** — 
   each round here took 9-19 minutes (vs. this project's usual "a few seconds to a couple minutes")
   because the user's own live server was actively running inference throughout; budget for this when
   a user is actively using the app during the same session doing verification work.
5. **A source-regex assertion cannot tell a REAL call from a COMMENT containing the same text** (from
   `v86_v`, reconfirmed relevant any time a mutation test is written against source text rather than
   runtime behaviour).
6. **Know your test harness's OWN limitations before designing a feature's interactivity around
   them** (from `v86_v` — `test/lib-dom.js`'s `addEventListener` no-op).
7. **Mutation-test every guard you write or rely on.**
8. **Ask before restarting a dev server you did not start.**

# WHERE TO START

- **A further refinement to the comic-extract newline instruction** — distinguish a BLANK-LINE
  structural break from a single-newline same-block continuation (see this cut's own "byte-identical"
  finding); needs another live probe round, ideally when the box isn't under concurrent Ollama load.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s item W row** needs a small update for `v86_t`'s `_comicPanelsFlatTextHtml`
  rename — cheap, doc-only, carried forward across several cuts now.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`'s `comicOpenReview()`/`_comicReview*`
  AND this cut's prompt change/`retranslateStory()` added — also cheap, doc-only.
- **A "re-extract just this panel" affordance from inside the review card** (`v86_v`'s own natural
  follow-up, not requested yet).
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
been kept current since (`v86_v` and this cut's own additions are the latest gap); other sections are
kept current inline as each cut touches them.
