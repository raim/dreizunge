# Session prompt — written at the `v88_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Point releases use an alphabetic suffix: `v88_b`, `v88_c`, … A bump to a new BASE
(`v89`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v88_z`**. `roadmap_v88.md` was cut
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

**What shipped at this cut**: `v88_r` — **the progress card's arrows now BROWSE chapters and a new
▶ plays** (user request). **ZERO new `ui.json` keys** — the budget the user chose when asked.

Built as an OVERRIDE, exactly as `v88_o` was: `showComplete()`'s gate chain computes what it always
computed, and `_browseApplyNav()` runs at the end of the render, MOVES that destination onto ▶ and
repoints → at the **adjacent** chapter. ▶ takes the chain WHOLE (in-chapter lesson, story-unlock
page, below-mark work, **and** the next unfinished chapter) — "continue the course"; → is free
browsing. The one branch ▶ withholds is the terminal one: ▶ greys, → carries the exit, so `v74_o`'s
"never a dead end" and `v77_f`'s finished card both survive. The within-chapter progression the user
asked to KEEP (vocab first, then comprehension/text-hunt to complete a chapter) was not touched —
only the chapter-wise lock went. ▶ sits in the ☰ popup as asked AND is mirrored beside the arrows
(`← ☰ ▶ →`), and `_captureNextAction`/`_storyTapMaybeAdvance` now read ▶ first, → second.

⚠️ **Two pre-existing defects were found by building it, and both are fixed here:**
1. **`_backToChapterProgress` has NEVER existed in the static build.** It sits above
   `@static-exclude-end`, so `docs/index.html` calls it and never defines it — the ← "previous
   chapter" button has been a `ReferenceError` in the published build since `v82_e`. `build-static.js`
   now supplies its own `STATIC_LESSONS` version.
2. **`renderEx` could crash on a review card.** A review render's synthetic `APP.cur` has no `cur`,
   and the length guard reads `C.cur >= C.exercises.length` — `undefined >= 0` is FALSE, so a stray
   speech-advance timer rendered `exercises[undefined]`. Latent until → started loading the next
   chapter asynchronously. Found because `smoke-render` exited 1 AFTER printing ALL PASSED.

Also: `_compEndForward()` extracted so the end-of-storyline destination is ONE rule with two askers,
and TWO more fixed-size source windows (`unit-progress-card-nav`, `unit-drill-ledger`) replaced with
structural bounds after failing in the false-positive direction. Eight test files migrated from
`comp-next` to `comp-play`. Full write-up: `roadmap_v88.md`'s own `v88_r` entry.

**`v88_s` shipped immediately after, completing the same user request**: the **chapter-wise
progress lock is GONE**, on BOTH surfaces that carried it — the storyline screen's 🔒 chapter cards
(`_renderChapterCard`'s `_isLocked`) and the storyboard panel click that silently REDIRECTED to the
last unlocked incomplete chapter (`_sbChapterTarget`). Neither ever fired live (both are scoped
`!canGenerate && !teacherMode`); the PUBLISHED build is where they had force, which is where the
students are. What remains is not a progress gate: `!isFirst && _sets.length === 0`, "this chapter
has no lessons yet". **ONE `ui.json` key REMOVED** across all 33 languages (the resume toast
explained a redirect that no longer happens) — hence 751, not 752.

`unit-storyline-lock-hardening` was RENAMED to `unit-storyline-chapter-access` and rewritten: its
assertions did not fail, they became assertions of the wrong thing. `unit-live-static-progress-parity`
was RE-ANCHORED (rule 29) — it observed `v74_i`'s shared-completion fix THROUGH the lock, and its own
non-vacuity check asserted the deleted rule was still running; the claim moved to the connector line,
where `chapterComplete` is still observable. Eight mutations red. Full write-up: the `v88_s` entry.

**`v88_t` then took the first two items of a NEW live-test batch the user handed over mid-session**:
the comic/image review card's extracted-text field is a resizable textarea instead of a single-line
input (it holds the whole body of a photographed sign, not a short caption), and the library sorts by
ONE key — the unconditional source-language pre-sort is gone, "my language" and "target language"
are two more options in the dropdown, and the flag headers follow the chosen key instead of always
naming the source language. Zero new keys. Two findings worth carrying: a comment inside a JS
TEMPLATE LITERAL must not contain backticks (`check-inline.js` caught it), and `_populateLibSelects`
had a branch no fixture had ever reached because `lib-dom` auto-vivifies a div with no `.options`.

**`v88_u` then shipped three of that batch's text-analysis items**: the explorer no longer AUTO-STARTS
an analysis (toggling a VIEW used to queue a multi-minute CP2 run per sentence against the user's own
model, unconfirmed — it now READS, and only the analysis button WRITES; a new settled `'none'` status
renders the plain unclickable story), analysed words lost their blue fill (the hover outline is the
whole affordance), and the QUESTION card got its own 🔍 with a THIRD independent flag over the shared
cache. Zero keys. Ten mutations red. Full write-up: the `v88_u` entry.

**`v88_w` took three more reports, two of them arriving mid-release.** It reworded the last two
"comics" in the jobs popover (`Extracting image panels`,
`Image draft`). ⚠️ **The finding is bigger than the fix**: both were hardcoded English in
`server.js`, which is why `v88_f`'s `comic`→`image` rename could not reach them — **server job labels
are the one user-facing surface `ui.json` does not cover, and are therefore never translated in any
UI language.** Known gap, not an oversight; closing it needs keys plus a client-side lookup for
server-minted strings. `d.kind === 'comic'` (a stored draft field), the `comic-extract` link type and
`Detecting comic panels` (the user's own exception) all deliberately keep the word.

It also fixed **a regression `v88_u` shipped**: removing `.te-tok`'s blue fill unmasked the BROWSER's
own `<mark>` yellow, because the analysed tokens are `<mark>` elements. **Removing an override does
not remove a style when the element type has one of its own.** ⚠️ `v88_u`'s guard was a PROXY
(`!/background/`) which the broken version satisfied exactly AND which would have gone red on the
correct fix — both failure directions in one release. And it routed the **static landing card's
artwork** through `_slArtworkHtml`: it read `sl.storyboard` directly, so `v87_m`'s `thumbMode` never
reached the one surface that re-implements `loadSavedList` — `v87_m`'s guard had checked `index.html`
alone. Eleven mutations red across the three.

**`v88_x` shipped the text-analysis resume.** ⚠️ **The measurement changed the design.** The chapter
the user said "did not finish" had finished — but 2 of its 6 sentences held a full set of token slots
and NOT ONE lemma, because `parseAnalysisReply` degrades a malformed reply the same way for every
token in a sentence (deliberately, so one bad reply cannot abort a long chapter) and nothing ever
revisited it. Measured store-wide: **3 of 51 sentences (5.9%) in 2 of 18 chapters**, both of them
chapters the user reported. So "already analysed" cannot mean "has tokens" — `_analysisSentenceUsable`
requires at least one real lemma, reusing `computeFrequency`'s own definition of "resolved".

There was also nothing to resume FROM: `writeAnalysisChapter` ran once, after the whole chapter, so a
run that died persisted nothing. The release therefore adds THREE things — opt-in `reuse`/`onProgress`
hooks on `analyzeChapter`, a per-sentence checkpoint flagged `partial:true`, and a three-way dialog
(cancel / "Analyse only what is missing" / "Re-analyse everything from scratch") whose counts come
from the server's own shadow. Reuse matches on sentence TEXT, not index, so it serves a died-mid-run
prefix, a story that grew, and a failed sentence with one rule.

⚠️ **TWO cache short-circuits exist on that path** — the route's and `_kickOffAnalysisJob`'s (which
repeats the test for `_runBookJob`'s postGenAnalysis). Teaching only the route about `resume` left the
other firing and a live request returned `{cached:true}` having done nothing; found by issuing it
against a running server, not by reading the route. Also fixed: `_teStoryHtml` dropped everything past
the last analysed sentence, so a partial would have rendered a TRUNCATED chapter.

Verified live on `tp_…093` against a real 35B model: "analysing 1 sentence(s)", `6 reused`, sentence 5
went from 23 unresolved to 23 resolved. Fourteen mutations red.

**`v88_y` answered a user question with "already built", then found why it had never worked.** The
review card's fields carried PLACEHOLDERS and no labels — and a placeholder vanishes once its field
has content, so the only label-shaped words on screen were the EMPTY title field's placeholder,
sitting directly above the CAPTION field holding the extracted text. The user had been typing their
chapter title into the caption (measured: `title:""`, title text in `caption`), which explains all
three of their image-upload reports at once.

⚠️ **And my first reading of that card was WRONG — the user caught it.** I said "four fields"; they
said three. Both true: the image-description box rendered only when a description already existed, so
the third VISIBLE field was `inScene`, whose string said *"What's happening in the scene"* — which
describes a DESCRIPTION, while the field holds TEXT VISIBLE IN THE PICTURE (`server.js`'s own
`CAPTION:`/`IN-SCENE:` contract). Reading the extraction prompt before writing the labels is what
caught it; the labels already drafted would have shipped the wrong reading with a confident label on
top. Now: a visible label above every field, that string reworded, and the description box always
rendered (empty when absent). Two keys, both approved.

Also: **the server half of item AN had ZERO coverage** — grepping the suite for `topicAuto` returned
no hits, so everything that actually SUPPRESSES title generation was unverified. New
`e2e-authored-chapter-title`, with its two limits recorded in the file (the fake returns no usable
titles, so nothing is renamed either way; non-vacuity comes from the titling calls in the request
log, and the skip is pinned at the source). Seven mutations red.

**`v88_z` closed the `AU` cancel residue — and it was EIGHT sites, not the two this prompt carried
as "one read each".** `runCancellable` makes the in-flight model call throw `CANCELLED`, but a runner
that loops over items and wraps each in `try { … } catch { continue; }` catches that like any other
failure: the loop runs to the end and the job reports DONE. **Being inside a cancel scope is
necessary and NOT sufficient**, and nothing said so until now. Six real sites fixed — `_runQc`'s
per-item check and story QC, `_runRecreateJob`'s add-types loop, and THREE inside `generate` itself
(the meta/title call, meta translation, story translation) plus its extra-lesson-formats loop, which
between them meant a cancelled generation kept producing the whole chapter.

⚠️ **The set-level guard found four times what the reading did** (`v88_b`'s rule again), and its
FIRST version reported CORRECT code — eight sites, six of them synchronous, which cannot throw
`CANCELLED` at all. **A rule that reports correct code is a rule nobody keeps.** Now scoped to try
blocks that actually `await`, brace-matched rather than sampled by a line window. Six mutations red.

**⚠️ TWO ITEMS ARE STILL OWED, plus one needing a ruling.** Verbatim where quoted:

1. **⚠️ NEEDS A RULING, and it is NOT the item it looks like — MEASURED at `v88_z`.**
   *"The second page of the generation wizard, and its popover parts, should really only generate and
   confirm the text(s) for one or more chapters, and NOT start generation."* **Structurally this is
   already true**: `v87_h` (item AL part 2) deleted `#pdf-gen-btn`/`#comic-create-btn` and made
   card 3's `#gen-btn` the ONE start button for all three modes, and `v88_c` (item AQ) made the
   auto-opened review card stop at card 3. Traced afresh: PDF and LLM have no generate trigger on
   card 2, and the comic path's card-3 button dispatches through `doGenerate()`.
   **What is left is two things, each needing a decision the user has to make:**
   (a) card 2's prominent green **"✨ Generate"** (`#comic-generate-btn` → `comicExtractPanels()`)
   runs the TEXT EXTRACTION, which is the correct step for that card — it is the LABEL that reads as
   chapter generation. Rewording `form.image_generate` costs its translations.
   (b) the review popover's **"✅ Confirm & create chapter"** does start generation — but only when
   opened FROM card 3's start button, which routes there deliberately: **the user's own earlier
   ruling was to KEEP that review stop** between start and creation. Removing it reverses that
   ruling. Do NOT do either unilaterally.
2. **⚠️ NEEDS A RULING — some LLM-based jobs still have no cancel BUTTON** (user screenshot:
   "Erstelle Zusammenfassung", "Neuer Titel…"). Untouched by `v88_z`, which fixed cancels that were
   swallowed, not buttons that are absent. **Diagnosed**: both are `kind:'sync'` rows — the
   synchronous LLM routes `v88_b` surfaced in the popover from `_jobsInflight`. `_jobsRenderList`'s
   `canCancel` is `j.kind === 'job' && …`, and the comment there explains why sync was excluded:
   there is no server-side job id for `POST /api/jobs/cancel` to look up. So it needs either an
   `AbortController` on the client fetch (stops the waiting, leaves the model running) **or** the
   sync routes registering real cancellable jobs. Ask before building.

3. **⚠️ NEEDS A RULING — an image DESCRIPTION becomes unreachable once the panel has any extracted
   text.** (`v88_y` fixed the field CONFUSION behind this report, but not the underlying rule.) User:
   *"I am still loosing image description if I assign a title in the text confirmation interface, eg.
   sl_580844164 did have a finished description that i can't access anymore."* **Measured — the data
   is NOT lost**: `tp_17883458445860000053`'s panel still holds a 128-char `description`
   ("Een landschap met heuvels…"). What happened is that the chapter's STORY was built from
   `[caption, inScene]` only (index.html, two sites — see `_comicPanelText` and the
   `comicCreateChapter` path), and `caption` was the sign's 12-char headline "De Manteling". So a
   12-character extraction suppressed a 128-character description, and the story is now just
   "De Manteling". ⚠️ **This collides with a STANDING USER RULING** — *"the description is a fallback
   when nothing was extracted"* (`v88_d`/item AN) — so the fix is a product decision, not a bug fix:
   the ruling is too crude for a headline-only extraction. **Put the options to the user before
   building** (combine both, fall back on a length threshold, or surface the description separately);
   do not quietly change the ruling.

**⚠️ The WITHIN-chapter progression is untouched and is meant to stay** — the user was explicit:
*"we do still want the 'play mode' question progress within chapters, to first solve vocab, then, to
really complete a chapter, solve the comprehension or text hunt lessons."* That is the gate chain
plus `storyUnlocked`/`_storyLockedLesson` plus the full-story lock row on the storyline screen (the
one 🔒 that legitimately survives there). Do not "finish the job" by removing those.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v88.md` — its **index table** and **⚠️ Session protocol** block first (the
   protocol gained THREE items across the `v87` line — read it, it is not the same block as `v87`'s),
   then "OPEN AT THE v88 CUT", then `# ✅ SHIPPED IN THE v88 LINE`.
3. `build_history/roadmap_v87.md` is KEPT as the record for the whole `v87` line (`v87_b`…`v87_p`,
   fifteen point releases) — go there for how anything from that line was built, and for the six
   items it closed.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v88_z`.

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the seven baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 329 checks
node test/run.js --quick                  → expect 272
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
was **VACUOUS on many of the runs it passed**.

**⚠️ AND THAT FIX WAS NOT COMPLETE — `v88_h`'s claim of "no longer flaky" was itself carried too
confidently.** This file was still failing ~1 in 6 standalone at the start of the `v88_r` session,
for the SAME root cause in a THIRD shape the type list did not cover: `order` (and its `math_order`
/ no-keyboard glyph variants) is neither typed nor choice-driven — `check()` grades `APP.cur.placed`,
the tiles the learner dragged — so those fell through to the stale-`.choice` path exactly as a typed
exercise did. Taught to `answer()` and fixed after `v88_s`. **The fix was then found to be VACUOUS**:
thirty consecutive runs never produced an `order` exercise at all (the corpus had moved on), so the
new branch shipped green and unexercised. It now has its own DETERMINISTIC section that constructs
both an `order` exercise and a glyph-ordered one and drives each in both directions. **Five mutations
red.** A failure there now really is a genuine regression.

`unit-ui-journeys`/`unit-word-progress` are **NOT cleared** — measured 12/12 each standalone, which
is too few to mean anything (this file's own rate would have survived 12 runs about a third of the
time). Treat them as UNVERIFIED, not clean.
**But do NOT reach for the flake label first.** At `v87_o` two corpus-driven tests failed 8/8 —
DETERMINISTIC, so not flakiness — because the user's server had written a new chapter and broken two
fixture SELECTIONS; `git show HEAD:lessons.json` isolated it in one command. Don't run the full and
`--quick` suites CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **344 topics, 99 storylines, 33 languages, 754 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v88_z'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

Now 54 numbered standing rules across "Rules earned in session 28…34" plus dedicated blocks for the
`v83`/`v84`/`v85`/`v86` lines — see `roadmap_v87.md`'s own copy of them. Read the **"⚠️ How the rules
are NUMBERED"** note before citing one.

**Earned at `v88_s`:**

- **A guard can go WRONG without going RED.** `unit-storyline-lock-hardening` pinned a rule the user
  then asked to delete; every assertion still passed, against the wrong claim. Worse, its own
  non-vacuity check ("a later chapter is still locked") became an assertion that the deleted rule was
  still running — so it would have gone red on the CORRECT tree. When a feature is removed, grep the
  tests for the ones NAMED after it and rewrite them to the new claim, rather than waiting for red.
- **State a deletion as an ABSENCE over the whole file, not as a passing fixture.** A lock can
  survive its own removal as a dead branch no fixture reaches. `!/chainBlocked/.test(html)` is the
  assertion that cannot be satisfied by luck.
- **When a rule has TWO copies, deleting one leaves the rule alive.** The storyline screen's chapter
  gate had a second life inside `_sbChapterTarget` as a silent redirect, with no 🔒 anywhere to make
  it visible. Found by asking "where else is this question asked?" before editing, not after.

**Earned at `v88_r`:**

- **A non-zero exit code with no failing assertion is a FINDING, not harness noise.** `smoke-render`
  printed `ALL PASSED` and then crashed on a stray `setTimeout` from a `check()` fixture. The lazy
  reading is "a leaked timer in a test". The real one was a product crash: `renderEx`'s
  `C.cur >= C.exercises.length` guard is FALSE for `undefined`, and a review render's synthetic
  `APP.cur` has no `cur`. The feature being built is what made that state reachable in normal use.
- **A guard written against `index.html` says nothing about `docs/index.html`.** Every guard for the
  ← previous-chapter button passed for four releases while the function it calls was not defined in
  the static build at all — it sits above `@static-exclude-end`. When a client helper is added near
  the server functions, check which side of that marker it landed on, and assert against the BUILT
  file.
- **When a mutation stays green, say so in the test rather than strengthening it.** `walkActive()`
  in `_browseApplyNav` is not what keeps a teacher walk in charge of the arrows — the call ORDER is.
  `v87_p`'s ruling applied verbatim: keep the (now honestly described) optimisation, record the
  non-attribution, and pin the mechanism that IS attributable.
- **Take the WHOLE of what a request moves, not the tidy part of it.** The first draft gave ▶ only
  the in-chapter branches, which left `_nextChapter()`'s branch reachable by nothing and made the
  story-finished card unreachable by forward. "Move the next function" meant the whole function.

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
`v88_d` row 3 (`AO` + `AN`); `v88_e` took two live bug reports (`AY`/`AZ`) out of order; `v88_f` shipped `AP`; `v88_g` shipped `AU`'s shutdown third; `v88_h` did the flake audit; `v88_i` shipped `AX`; `v88_j` shipped `AR`; `v88_k` shipped `AU`'s cancel third; `v88_l` completed `AU` with idle release; `v88_m` wired ALL job kinds for cancel; `v88_n` added reverse sort; `v88_o` added the teacher walkthrough, `v88_p` fixed it, `v88_q` made it start on the summary; `v88_r` generalised it into a student BROWSE mode and split forward into ▶ play / → browse; `v88_s` removed the chapter-wise progress lock on both surfaces that carried it.** The rest of that table:

**🆕 THE THIRTEEN TODOs ARE DONE.** Every item from the `v88_a` handover has shipped, plus two live
bug reports (`AY`/`AZ`) and the flake audit. What remains is either the pre-existing open list or
work the user deferred. **Ask the user what they want next** — that is a reasonable first move here.

**🆕 NOTHING IS OWED.** The browse-mode request is complete end to end (`v88_r` + `v88_s`). **Ask
the user what they want next.**

**Buildable now, no decision needed:**
- **Item `V`** (multi-image upload) is FULLY SPECIFIED by the user's ruling and unblocked — each
  uploaded image gets a whole-image panel (the act `AM` already performs for one image), the panel
  list stays editable, and `comicCreateChapter()`'s existing one-chapter-per-panel formation
  (`v85_p`) is confirmed correct. Mostly a question of the DRAFT shape holding more than one page
  (`_comicDraftSaveDebounced`'s own comment scopes it to one image today).
- **⚠️ `AU` residue, now small**: all eight job kinds are wrapped (`v88_m`), but only
  `_runComicExtractJob` has been checked for a per-item `try/catch` that SWALLOWS a cancel (it
  re-throws on `CANCELLED` now). `_runQc` and `_runRecreateJob` both have per-item tolerance and have
  NOT been checked — a cancelled job there may still report DONE. One read each.
- **⚠️ `AU` cancel follow-up, small and concrete**: `_runRecreateJob` has the same per-item
  `try/catch` shape that made `_runComicExtractJob` report a cancelled job as DONE. Wrap it in
  `runCancellable` and re-throw on `CANCELLED`. Only three job kinds are wrapped so far (comic
  extract, comic detect, analysis); the rest cancel status-only — pre-`v88_k` behaviour, not a
  regression, but each is a one-line wrap plus a check for swallowing catches.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Quick and well-precedented.

**⚠️ `ui.json` keys.** 752 `en` keys now. Every item that needed keys this line has spent them
(`AQ` 1, `AN` 1, `AX` 2, `AR` 4; `AP` renamed 24 without adding any). **Nothing is pre-approved for
the next session.** The user's standing ruling on changed English text: delete the stale non-`en`
values so `translate-ui.js` refills them. **Ask fresh for a count, as every `v87` cut did**
— and note that `v88_b` closed two user reports with ZERO new keys by reusing existing strings, and
`v88_g`/`v88_h` needed none at all. Try that first every time.

**⚠️ POSTPONED BY THE USER (not blocked — deferred)**: **`AV`** (the language/grammar summary) and
**`AS`** (the PDF viewer). Both were put to the user at the `v88_i` handover and both were answered
"postpone". Do NOT restart either without being asked. `AS`'s standing recommendation, if it ever
comes back, is to counter-propose page IMAGES rather than a pdf.js viewer — the PDF bytes are never
stored, and chapter text has no offset back into the PDF.

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
