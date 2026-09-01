# Session prompt — written at the `v88_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Point releases use an alphabetic suffix: `v88_b`, `v88_c`, … A bump to a new BASE
(`v89`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v88_h`**. `roadmap_v88.md` was cut
at `v88_a` and is the current roadmap.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first. Every cut in the `v87` line asked first and was
given an explicit budget (often fewer keys than proposed — e.g. three instead of six at `v88_a`).
Ask again fresh THIS session.

**The user's own server runs on port 3000 across sessions** and WRITES to `lessons.json` while you
work — it generated four chapters during the `v87` line, and twice that broke a test. Check
`git status --short lessons.json` at the start and again at commit time. `server.js` serves
`index.html` with `readFileSync` PER REQUEST, so a CLIENT edit is live on their server without
restarting anything; a SERVER edit is not — start your own instance on another port to verify, and
**kill it by PID** (`pkill -f "node server.js"` matches theirs too).

**What shipped at this cut**: `v88_h` — **the flake audit**, the ⭐ item from this prompt's own
"buildable now" list. Test-only; no product change, no `ui.json` keys.
`unit-observations-log`'s inherited label was **wrong**: it failed STANDALONE at the same rate, not
"under suite load". Its `answer()` helper branched on `querySelectorAll('.choice')` before the
exercise TYPE, and `lib-dom` does not re-parse runtime `innerHTML`, so stale `.choice` nodes from the
previous MCQ render hijacked a TYPED exercise — `#type-in` stayed empty and `check()` correctly
graded it wrong. **The product is fine**; this was purely a test driver. Worse than the red runs: the
assertions sat behind `if (droveRight)`, so the section was **VACUOUS on many of the runs it passed**.
Both closed — the driver dispatches on `ex.type`, and `droveRight` is now asserted.
Proven with a DETERMINISTIC probe (render an MCQ, advance to a `listen_type`, watch the old driver
fail every time), because sampling could not settle it — one pre-fix batch of 40 passed clean.
Second inherited "known flake" in this project found to be a real defect; the first was `unit-tap-word`.
Full write-up: `roadmap_v88.md`'s own `v88_h` entry.

**🆕 NOTHING IS MID-FLIGHT, and the queue is explicit.** The `v87` line closed six items (R, U, Z,
AC, AK, AL) plus the three storyline asks; they are recorded where they shipped and are NOT in the
open list. **After `v88_a` the user handed over thirteen TODOs in one message.** They were each read
against the running code and written up as items **`AM`…`AX`** in `roadmap_v88.md`'s own
"🆕 OPENED AT THE `v88_a` → `v88_b` HANDOVER" block, which ends with a **suggested implementation
order** (a table, `v88_b` through `v88_h`). **Start there**, not from the older "WHERE TO START"
list below — that list is still accurate but is no longer the top of the queue.

**`v88_b` shipped the first row of that table (`AW` + `AT`). The next row is `v88_c` = `AQ` + `AM`.**

**Three rulings the user has ALREADY GIVEN — do not re-ask:**
1. **Item `AP`** (the `comic`→`image` rename): when an English string changes, **DELETE the stale
   non-`en` values** so the offline `translate-ui.js` pass refills them. (Renaming a KEY preserves
   its translations and is free; only changed English text costs anything.)
2. **Item `AN`**: build the recommended fix — **a separate TITLE field on the review card**, keeping
   the existing "the description is a fallback when nothing was extracted" ruling intact rather than
   reversing it. Half (2) — persisting `description` in `comicPanels` — was never blocked.
3. **Item `V`**: *"if multiple images are uploaded, mark all images as one panel, but still allow the
   user to modify, add and resort panels. each panel is one chapter."* So: each uploaded image gets a
   whole-image panel automatically (the same act item `AM` performs for one image), the panel list
   stays fully editable, and `comicCreateChapter()`'s existing one-chapter-per-panel behaviour
   (`v85_p`) is confirmed as correct — **item `V` is now fully specified and no longer blocked.**

**Still genuinely blocked on a user decision**: `AV` (display surface + which of three sources
generates it — needs a live three-way comparison, not a choice) and `AS` (whose recommendation is to
counter-propose page IMAGES rather than a pdf.js viewer).

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v88.md` — its **index table** and **⚠️ Session protocol** block first (the
   protocol gained THREE items across the `v87` line — read it, it is not the same block as `v87`'s),
   then "OPEN AT THE v88 CUT", then `# ✅ SHIPPED IN THE v88 LINE`.
3. `build_history/roadmap_v87.md` is KEPT as the record for the whole `v87` line (`v87_b`…`v87_p`,
   fifteen point releases) — go there for how anything from that line was built, and for the six
   items it closed.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v88_a`.

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the seven baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 320 checks
node test/run.js --quick                  → expect 267
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

**⚠️ `unit-tap-word` is NO LONGER FLAKY** — its ~35% failure rate from `v80_t` to `v87_h` was a REAL
DEFECT (`Math.random()` in `tapWord()`), fixed at `v87_i`. A failure there now is a genuine
regression.

**⚠️ `unit-observations-log` is NO LONGER FLAKY — and the claim carried here since `v81_b` was
WRONG.** It did NOT "fail under suite load, not standalone": it failed standalone at the same rate
(2/10, 3/60, 2/30 across batches). Root cause found and fixed at `v88_h` — its own `answer()` helper
branched on `document.querySelectorAll('.choice')` before considering the exercise TYPE, and
`lib-dom` does not re-parse runtime `innerHTML`, so stale `.choice` nodes from the previous MCQ
render hijacked a TYPED exercise. Worse, the assertions sat behind `if (droveRight)`, so the section
was **VACUOUS on many of the runs it passed**. A failure there now is a genuine regression.
`unit-ui-journeys`/`unit-word-progress` are **NOT cleared** — measured 12/12 each standalone, which
is too few to mean anything (this file's own rate would have survived 12 runs about a third of the
time). Treat them as UNVERIFIED, not clean.
**But do NOT reach for the flake label first.** At `v87_o` two corpus-driven tests failed 8/8 —
DETERMINISTIC, so not flakiness — because the user's server had written a new chapter and broken two
fixture SELECTIONS; `git show HEAD:lessons.json` isolated it in one command. Don't run the full and
`--quick` suites CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **340 topics, 98 storylines, 33 languages, 735 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v88_h'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

Now 54 numbered standing rules across "Rules earned in session 28…34" plus dedicated blocks for the
`v83`/`v84`/`v85`/`v86` lines — see `roadmap_v87.md`'s own copy of them. Read the **"⚠️ How the rules
are NUMBERED"** note before citing one.

**Earned at `v88_b`, and it paid for itself immediately:**

- **A SET-LEVEL guard finds the call sites a reading misses.** Item AT wrapped one caller per route,
  which looked complete. The guard section asserting *every* caller of all five routes is wrapped went
  red naming the offset of the next one — and there were **three more**, including `/api/storyline-title`'s
  four separate client callers. That section is the reason the release is complete rather than 60%
  complete. When a fix must apply to EVERY caller of something, assert over the whole set, not over
  the one you happened to change — and expect it to fail the first time.
- **When a fix has two halves — "it works" and "it doesn't leak" — the second half needs its own
  assertion.** `_ttsSpeakableText` had to reach the utterance AND reach nothing else; only the second
  claim can be observed at the source layer, and it is the one that would silently ruin a render.

Three earned or re-confirmed at the `v88_a` cut, still worth carrying forward explicitly:

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
- **`git checkout <file>` to undo a MUTATION discards every uncommitted change to that file.** Doing
  it at `v87_l` threw away a session's worth of unrelated client work that happened to live in the
  same file. Mutation-testing must restore from the copy taken before the mutation (`cp` to the
  scratchpad first, restore with `cp`), never from git — the tree during a build is full of work git
  does not know about yet.
- **`pkill -f "node server.js"` would kill the USER's server too.** At `v87_l` a test server was
  started on a spare port for a live model check; the user's own instance was running the identical
  command line. Always list by PID first (`ps -eo pid,cmd | grep '[n]ode server.js'`) and kill the
  ONE pid, and never assume the only matching process is yours.
- **`lib.js`'s `boot()` derives its port from the PROCESS ID — two servers in one test process
  COLLIDE.** The second fails to bind and every request silently reaches the FIRST. At `v87_p` a
  nested second boot made a section query the already-healed server and "fail" while the code was
  correct. Boot a second server only after stopping the first.
- **When a mutation stays GREEN, ask whether a SECOND guard is holding — do not just strengthen the
  test.** At `v87_p`, removing the server's `BACKEND !== 'none'` check changed nothing because
  `llm.js`'s `ping()` already refuses unless the backend is ollama. The honest outcome was to keep the
  (now correctly described) optimisation, say in the comment that it is not the protection, and record
  in the test that it cannot attribute the behaviour to one guard. Removing BOTH does go red.
- **A fixture chosen by a PROXY for the property a section asserts is one generated chapter away
  from red.** Third occurrence (`v81_d`, `v81_e`, now `v87_o` twice over). "The first chapter with a
  story and >=4 vocab words" is not "a chapter whose vocab appears in its story"; "a question
  `_wordQuestions` knows" is not "a question that grades the word". Select by the PROPERTY ITSELF —
  render the candidate and check, or try the state change and keep it only if it happens. And note
  that a cheap approximation is not enough either: a substring pre-check still picked a chapter the
  real matcher (which normalises via `_hlKey`/`stripFuri` and splits multi-token entries) marked
  nothing in.
- **A deterministic failure is NOT the documented flakiness — check before reaching for that label.**
  Two corpus-driven tests failed 8/8 at `v87_o`. The reflex was "known flaky family"; the determinism
  ruled that out in one command, and `git show HEAD:lessons.json` located the cause in the user's own
  live data rather than in any code change.
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

**🆕 FIRST: the thirteen TODOs handed over after `v88_a`** — items `AM`…`AX` in `roadmap_v88.md`,
with their own suggested order. **`v88_b` shipped row 1 (`AW` + `AT`), `v88_c` row 2 (`AQ` + `AM`),
`v88_d` row 3 (`AO` + `AN`); `v88_e` took two live bug reports (`AY`/`AZ`) out of order; `v88_f` shipped `AP`; `v88_g` shipped `AU`'s shutdown third; `v88_h` did the flake audit.** The rest of that table:

- **➡️ NEXT — `v88_h` — `AX`**: generate lessons from an EXISTING storyline for a DIFFERENT source
  language. The highest-value new feature left and much cheaper than it looks: `POST
  /api/generate-book` already runs the whole downstream pipeline (translation, chapter titles,
  lessons, arc, storyboard, analysis) from bare `chunks`, and BOTH the PDF and image paths are
  nothing but "build chunks, POST". A fourth input mode whose chunks are an existing storyline's
  chapter `story` fields is the same shape, and the target text is correct by construction.
  New work: one server-side resolution (storyline id → chapters in order → chunks), one dropdown on
  card 1 beside `#continue-select` (which already lists the right things and is read by all modes
  since item AL), and the input-mode plumbing in `_genInputMode()`/`_applyLessonCardUI()`/
  `doGenerate()`. **Three decisions to settle first**, none large: is the new storyline LINKED to
  its source (there is no "translation of" relation today)? Copy `comicPanels` across (recommend
  yes — the images belong to the text; interacts with item `A`)? And refuse the degenerate case
  (same `srcLang` as the source, which would silently duplicate a whole storyline for nothing).
- Then `AX` (generate lessons from an existing storyline for a DIFFERENT source language — the
  highest-value new feature left, and it reuses `/api/generate-book`'s existing chunks pipeline
  wholesale) and `AR` (library sorting — the trap is the `GET /api/lessons` WHITELIST projection,
  not the sort). **Item `V` is fully specified** and shares `AM`'s whole-image-panel act.
- Then `AU`'s shutdown half (small, no decision: `SIGINT`/`SIGTERM` → `release()` the configured
  models; `llm.js` already exports `release()` and there is no
  signal handler at all), `AX`, `AR`. **Item `V` is fully specified** by the user's ruling and shares
  `AM`'s own whole-image-panel act, so it slots in beside the image work.
- Then `AP` (the `comic`→`image` rename — deliberately after the four image releases), `AU`'s
  shutdown half, `AX`, `AR`. Item `V` is now fully specified too (see the rulings above) and can be
  slotted in beside the image work, since it shares `AM`'s own whole-image-panel act.

**⚠️ `ui.json` keys.** `AQ`'s and `AN`'s are SPENT (both now renamed to `form.image_*` by `AP`), and
`AP` itself is done — still 735 `en` keys, since a rename adds none. **`AR` is the only open item that
needs a count** — the user has ruled on HOW the
rename handles stale translations (delete the non-`en` values, let `translate-ui.js` refill them) but
not on how many strings may change; `AR` wants ~5. **Ask fresh, as every `v87` cut did** — and note
`v88_b` closed two reports with ZERO new keys by reusing existing strings. Try that first every time.

**⚠️ Still blocked on a user decision**: `AV` (where a language summary is shown, and which of three
sources generates it — needs a live three-way comparison, not a choice) and `AS` (recommendation:
counter-propose page IMAGES rather than a pdf.js viewer — the PDF bytes are never stored, and chapter
text has no offset back into the PDF).

---

**The older list.** Everything below is carried from `roadmap_v88.md`'s own "OPEN AT THE v88
CUT" section — see it for full detail. Several are blocked on a decision, not on effort.

**Buildable now, no decision needed:**
- **⭐ Finish the flake audit.** `unit-tap-word` (`v87_i`) and `unit-observations-log` (`v88_h`) are
  both done, and **both inherited "known flake" labels turned out to be wrong** — one a `Math.random()`
  in the PRODUCT, one a test driver branching on a proxy. `unit-ui-journeys`/`unit-word-progress`
  remain UNVERIFIED (12/12 each is not enough runs to clear them). Instrument the failing assertion;
  do not re-confirm the label.
- **⚠️ THREE test files share `unit-observations-log`'s defective driver shape** — `unit-question-nav`,
  `unit-inflection-speak-lang`, `unit-tap-word` all branch on `if (btns.length)` before considering
  `ex.type`. Grep for `querySelectorAll('.choice')` ahead of any type check. `unit-question-nav` is
  the most exposed (navigating BETWEEN questions is exactly the MCQ-then-typed sequence that
  triggers it) but measured 14/14 clean, so `v88_h` deliberately did NOT change it — altering four
  test files on one file's evidence is how a cleanup becomes a regression. `roadmap_v88.md`'s `v88_h`
  entry carries the deterministic probe that demonstrates the bug.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Quick and well-precedented.
- **Item D (Tier 2 image-coordinate highlighting)** — buildable, wants its own design pass first.

**⚠️ Blocked on a user decision — do NOT start without one:**
- **Item P's pedagogy question** (infinitive-vs-conjugated as a distractor axis for VERBS). TWO
  live-model cycles already failed to move it by wording; a third guess is explicitly the wrong move.
- **Difficulty placement** — ruled out of scope for item AL and deferred to its own design pass
  alongside the CP1/CP2 route ("difficulty means something different for each lesson type").
- **Item AH** (three CP2 speed ideas; recommendation is "hint, not skip") — needs a product decision.
- **Item AG** (CP2 clitic pronouns / explanations) — needs a prompt-design decision AND a live
  measurement.
- **Item AI** (teacher-editable CP1/CP2 analysis) — one open design question flagged.
- **Item C (comic/PDF upload-card UX)** — note `v87_h`/`v87_l` reshaped both panels; re-read the
  recommendation against the CURRENT markup before putting it to the user.
- **Item A** (move comic images out of `lessons.json`) — needs a go-ahead before touching existing
  topics. Note `v87_m` added `GET /api/comic-thumb/:id`, which is a natural stepping stone.
- **Item B** (vision-role model picker) — short design choice.
- **Item AK's deferred half**: run-now-vs-schedule-with-smart-defaults.

**⚠️ Blocked on a live reproduction the user has to hit:**
- **Item AE** (mobile-backgrounding — the `v86_d` fix did NOT recover on a real device),
  **item AB's "stuck mid-sentence" half**, **item E** (chapter-title post-pass failures, needs the
  raw model response), **item T** (two text-selection→grammar questions never answered).

**Scoped but needing one more thing:**
- **Item AD** (source-language furigana) — live check + a toggle-sharing question.
- **Item F's "add explanations" half** — open and unscoped in detail.
- **Items G, N, O, V, X, Y** — each independently startable or needing user input.

**Offered and not taken up** (from `v87_p`'s diagnosis): offline mode hides controls SILENTLY on the
storyline and lesson-set pages — the `#offline-note` only exists on the generation screen, which is
why a backend outage reads as broken buttons. Small, and would have saved the user two reports.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.
