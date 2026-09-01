# Session prompt — written at the `v88_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Point releases use an alphabetic suffix: `v88_b`, `v88_c`, … A bump to a new BASE
(`v89`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v88_a`**, the first release of a
**FRESH LINE** — `roadmap_v88.md` was cut at this release and is now the current roadmap.

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

**What shipped at this cut**: `v88_a` — storyline chapter management. Re-order (which also re-links
`continuedFromId`, scoped to that storyline's own chapters so forks survive), split off into
`"orphaned from <title>"`, and add an existing chapter (without removing it from its current
storyline). Two new server routes do each operation atomically, because a re-order rewrites several
topics and a half-applied chain is worse than none. One teacher-only panel on the storyline screen.
Full write-up: `roadmap_v88.md`'s own `v88_a` entry.

**🆕 NOTHING IS MID-FLIGHT, and no priority is set.** The `v87` line closed six items (R, U, Z, AC,
AK, AL) plus the three storyline asks; they are recorded where they shipped and are NOT in the open
list. Pick from "WHERE TO START" below — several entries are blocked on a user decision rather than
on work, so **asking the user which one they want is a reasonable first move**.

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

```
node test/run.js                          → expect 312 checks
node test/run.js --quick                  → expect 261
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

**⚠️ `unit-tap-word` is NO LONGER FLAKY** — its ~35% failure rate from `v80_t` to `v87_h` was a REAL
DEFECT (`Math.random()` in `tapWord()`), fixed at `v87_i`. A failure there now is a genuine
regression.

`unit-observations-log` remains a known intermittent flake (documented since `v81_b`/`v86_b`) — it
fails under suite load, not standalone; reproduce 5-10× before believing it.
`unit-ui-journeys`/`unit-word-progress` have each flaked across the `v86` line.
**But do NOT reach for the flake label first.** At `v87_o` two corpus-driven tests failed 8/8 —
DETERMINISTIC, so not flakiness — because the user's server had written a new chapter and broken two
fixture SELECTIONS; `git show HEAD:lessons.json` isolated it in one command. Don't run the full and
`--quick` suites CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **339 topics, 98 storylines, 33 languages, 733 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v88_a'`.

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

**Nothing is mid-flight.** Everything below is carried from `roadmap_v88.md`'s own "OPEN AT THE v88
CUT" section — see it for full detail. Several are blocked on a decision, not on effort.

**Buildable now, no decision needed:**
- **⭐ Audit the remaining "known flakes"** (`unit-observations-log`, `unit-ui-journeys`,
  `unit-word-progress`) the way `unit-tap-word` was audited at `v87_i`: find the failing assertion,
  instrument what it compares, decide whether the PRODUCT is varying or the guard is a proxy. One of
  four turned out to be a real defect; the others have never been checked.
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
