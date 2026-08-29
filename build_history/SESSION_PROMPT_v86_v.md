# Session prompt — written at the `v86_v` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_v`**. `v86_u` closed the
`unit-article-choices` red that had been carried for nine cuts (unrelated to item W or comics). This
cut (`v86_v`) is a fresh, user-requested comic-panel feature.

**What shipped this cut (`v86_v`)**:

**An intermediate text-review card between comic text extraction and lesson generation.** User's own
words: *"For extracted text from comic/images, we want an intermediate card after successful text
extraction where the user can go through each panel and the extracted text, to edit and confirm the
extracted text. Only THEN we move to lesson generation."*

`comicOpenReview()` opens a modal listing every panel with usable extracted text (its cropped image +
an editable caption input + in-scene textarea, seeded from that panel's own text — panels never
extracted, or whose extraction errored, are skipped, nothing to edit there). Reached BOTH
automatically (fired the instant `_comicExtractCheckOnce` applies a successful extraction) and
manually (the pre-existing "Create chapter" button, retargeted from `comicCreateChapter()` to here,
for a user who dismissed the auto-popup and wants to reopen it before generating). Confirming writes
the edited buffer back onto `APP_COMIC.boxes` **by each panel's own original index** (not buffer
position — the two diverge whenever a panel was filtered out of the review), then calls the real,
completely UNTOUCHED `comicCreateChapter()` — the gate sits entirely above the existing
chunk-building/POST logic, so every one of `unit-comic-chapter.test.js`'s own tests of that logic
keeps testing it directly, with no UI in between. Cancel is a true no-op: edits live in a local
buffer, never written onto `APP_COMIC.boxes` until confirm.

**A real, pre-existing test-harness limitation surfaced along the way**: `test/lib-dom.js`'s
`addEventListener` is a no-op BY DESIGN (it lets render code execute without throwing; it does not
simulate real event dispatch). A first draft wired the modal's interactivity through
`addEventListener` closures — exactly the pattern `showChoiceDialog()` already uses — which would
have made it **untestable for behaviour**, forcing a fallback to source-regex assertions (the exact
anti-pattern this project's own standing rules warn against: a regex can't see whether code actually
RUNS, only whether it's textually present). Rewired to the SAME onclick/oninput-ATTRIBUTE convention
every other dynamically-rendered list in this file already uses (`comicDeletePanel`/`comicMovePanel`)
— `_comicReviewEdit`/`_comicReviewConfirm`/`_comicReviewCancel` are now plain, directly-callable,
directly testable functions. One test (verifying the automatic open-on-extraction wiring) was ALSO
caught being vacuous mid-development: a first mutation deleted the real call but left an explanatory
comment containing the same function-call text, which a regex-based assertion could not tell apart
from the real call — replaced with a behavioural test (stubs `comicOpenReview`, calls the real
`_comicExtractCheckOnce()`), which the same mutation now correctly fails.

Server untouched — `caption`/`inScene` were already plain client-held fields all the way through to
`comicCreateChapter()`'s own request-body construction, so no route or job-pipeline change was needed
for this feature at all.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_v`) for the comic review-card design and the harness-limitation finding.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's OWN row has not been touched since before `v86_o` — this
   cut's `comicOpenReview()`/`_comicReview*` functions are NOT yet reflected there (carried forward,
   doc-only, keeps getting bumped for higher-priority work).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 294 checks
node test/run.js --quick                  → expect 252
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-article-choices` is GREEN — if it goes red again, that is a NEW finding, not the `v86_u` bug
recurring (that fix is corpus-independent and covered by its own fixture).

`unit-coverage-item-model` (a full corpus scan) can take SEVERAL MINUTES on this container if a real
Ollama inference is running concurrently on the same box — confirmed via `ps` during this cut (100%+
CPU, growing CPU-time) rather than assumed; don't treat a slow-but-progressing test run as hung.

Corpus at this cut: **337 topics, 98 storylines, 33 languages, 709 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server was actively generating content
DURING this cut's own test runs, more than once — re-measure fresh at commit time if
`unit-roadmap-version` disagrees, don't assume a stale number is the guard's fault, and don't chase
every transient mid-session fluctuation from concurrent live usage). 5 new `en` keys this cut
(`form.comic_review_title`, `form.comic_review_hint`, `form.comic_caption_ph`, `form.comic_scene_ph`,
`form.comic_review_confirm`). `lessons.json` changed DURING this cut from the user's own concurrent
usage, not from any edit made here. `docs/index.html` rebuilt after the `APP_VERSION` edit, and again
if the corpus drifted further before commit. `APP_VERSION = 'v86_v'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-13 added across the
`v86_o`-`v86_t` cuts, and this cut's own two findings below — see those releases' own sections for the
reasoning)

1. **Know your test harness's OWN limitations before designing a feature's interactivity around
   them** — new this cut: `test/lib-dom.js`'s `addEventListener` is a documented no-op, so any
   interactivity built purely on `addEventListener` closures is invisible to every test in this
   suite. Check how EXISTING similar UI (`comicDeletePanel`, `showChoiceDialog`) is actually wired
   and tested before choosing a new pattern — the onclick/oninput-attribute convention exists
   precisely because it is testable here.
2. **A source-regex assertion cannot tell a REAL call from a COMMENT containing the same text** —
   new this cut: a mutation-testing pass caught its own first assertion being vacuous exactly this
   way; the fix was a behavioural test (stub the callee, invoke the real caller), not a smarter regex.
3. **When a new UI step should GATE an existing action, put the gate ABOVE the existing function,
   untouched** — `comicCreateChapter()`'s own well-tested chunk-building/POST logic needed zero
   changes; `comicOpenReview()` sits entirely above it and calls it unchanged on confirm.
4. **Mutation-test every guard you write or rely on** — this cut's by-index-vs-by-buffer-position
   writeback bug was deliberately reintroduced and confirmed caught before being trusted.
5. **A carried-forward open item stays worth investigating even after many cuts of deferral** (from
   `v86_u`, still true generally, not specific to this cut).
6. **Ask before restarting a dev server you did not start.**
7. **When a fix targets ONE known write path to some piece of state, check whether OTHER write paths
   to the SAME state exist before considering the class of bug closed.**
8. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
   and their real costs, don't just build the first thing asked** (not applicable this cut — the
   user's request was concrete and unambiguous, but keep this live for the next one that isn't).

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
- **`INTERNALS.md`'s comic-panel subsystem row** needs this cut's `comicOpenReview()`/
  `_comicReviewEdit`/`_comicReviewConfirm`/`_comicReviewCancel` added — also cheap, doc-only.
- **The review card's own natural follow-ups, not built this cut** (none requested; only build if
  asked): a "re-extract just this panel" affordance from inside the review card; letting the review
  card also touch panel geometry (crop bounds), not just text.
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
been kept current since (this cut's additions are the latest gap); other sections are kept current
inline as each cut touches them.
