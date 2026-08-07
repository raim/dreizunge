# Roadmap — v74 line

Cut from `v73_k` at the end of session 27. Previous roadmap: `roadmap_v73.md`.
Session 27's own record: `build_history/v73k_session27_notes.md`.

## Baseline at the cut

| command | expected |
|---|---|
| `node test/run.js` | **166 checks, ALL PASSED** |
| `node test/run.js --quick` | 145 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v74_b'` (session 28), `docs/index.html` built from the corpus in this tree. If the freshness guard
(`unit-static-freshness`, new in `v73_b`) fails, run `node build-static.js` — it means a baked input
moved. That is the guard working, not a defect.

## Shipped in the v74 line (session 28)

`v74_b` ✅ **one lesson-phase classification.** `_POST_STORY_TYPES` + `lessonPhase(L)` become the
single classification; `_NEVER_POOLED` and `_STORY_GATED_TYPES` are DERIVED from it rather than
restated. `error_hunt` / `ai_error_hunt` move to **post**, so they gate the next chapter instead of
the story. Measured: **29 chapters** had gated the story behind a corrupted copy of that story
(`corruptedStory`) — the `v71_s` circularity arriving through an unclassified type. **0** coverage
denominators moved (error hunts hold 0 questions). Suite 166. Notes:
`build_history/v74b_session28_notes.md`.

**§0's prime suspect is cleared.** `v73_g`'s icon row does NOT strand the learner — every startable
icon returns `true` and reaches `lesson-screen`, on both chapter shapes. `v73_i`'s keying is sound
and `v73_d` is not the cause of the red bar. **Nothing from session 27 was reverted.** The real cause
is §1a below.

### 1a. THE CAUSE of "user progress broken" — the denominator depends on audio state (OPEN)

`_lessonQidUniverse`'s cache key carries `'na'`/`'m'`/`'a'`. Listening exercises are not built when
muted or when no TTS voice matches, so the universe shrinks — but the **solved set is one flat map
per topic**, so solves earned in one audio state are measured against a denominator from another.
**284 of 298 topics** are affected. `Churros`: 83 audible / 67 muted / 51 no-TTS.

```
played MUTED → read audible: solved=64  cov=64/83 (77%)  storyUnlocked=true  chapterComplete=false
```

That is the user's report to the digit, and it is unrecoverable: the 16 missing questions are
listening items a muted app never offers. `ttsVoiceAvailableFor` returns `true` while voices load,
so the key can flip mid-session with no user action.

**Decision needed** (blocks counter (c)): audio-invariant universe / auto-credit unaskable qids /
exclude listening from coverage / **freeze-and-persist the universe per topic** — the last is the
only one that also closes the sampling nondeterminism (15 of 294 topics).

### 1b. The ruled lesson-flow definition (user, session 28)

| phase | types | role |
|---|---|---|
| **prep** | `standard`, `word_forms`, `synonyms`, `grammar`, `conjugation`, `math`, `intro_script` | vocabulary work toward the story |
| — | `mixed` | **not a lesson** — an alternative way to play the prep lessons |
| **story** | — | read and understand |
| **post** | `comprehension`, `error_hunt`, `ai_error_hunt` | gate the next chapter |

- **Gate 1 (story):** prep coverage ≥ pass mark.
- **Gate 2 (next chapter):** comprehension all-correct-once; error hunts merely played.
  **Optional to EXIST — no post lesson means no gate 2** (243 of 298 chapters).
- **Counters:** (a) storyline = underlying lessons solved ÷ total, mixed unfolded, hidden excluded;
  (b) chapter = same unit, current chapter; (c) percent = prep questions ÷ **prep** universe with the
  gate-1 mark. Measured: sharing one universe between bar and gate collapses §1's divergence window
  (`64..66`, `23..24`) to **none**.

**Shipped in session 28:** `v74_b` lesson-phase · `v74_c` item-keyed coverage (closes 1a) ·
`v74_d` math counts · `v74_e` hidden-never-counts guard · `v74_f` error-hunt routing guard ·
`v74_g` counters (b)/(c) · `v74_i` live-mode storyline progress · `v74_j` TTS voice ranking ·
`v74_k` storyline locks · `v74_l` section 3 · `v74_m` story paragraph formatter · `v74_n` two
highlight tiers · `v74_o` last card not a dead end · `v74_p` chapter-wide vocabulary panel ·
`v74_q` comprehension reason shown not spoken · `v74_r` mixed round as a toggle.
Counter (a) CLOSED as chapters, no change. **Sections 1, 3 and 4 are COMPLETE.**
Suite 170 / quick 149. See `v74b_session28_notes.md`.

**Section 2 (highlighting) is the only design section left, and its plan below is WRONG** — see the
session notes: `_articleStatsFor` returns `sampleSize: 0` on the chapters that need it, because it
reads grammar items. A corpus-derived replacement is measured there.

**Still open:** the pass mark. `Churros` is 40 items where it was 83 questions, and an item is
solved by ANY correct answer, so 80% is a materially lower bar than before. Deliberately left alone
— it wants a browser pass, not a guess.

## Shipped in the v73 line (session 27) — ten point releases

`v73_b` docs/ staleness guard · `v73_c` lib-dom runtime `innerHTML` parsing · `v73_d` completion-card
pass mark · `v73_e` story-highlight word boundaries · `v73_f` article-MCQ predictability gate +
chapter name on the progress row · `v73_g` completion-card lesson icon row · `v73_h` plural
distractors drawn from the corpus · `v73_i` a round never asks one question twice · `v73_j` QC
findings survive a chapter edited mid-pass · `v73_k` unchecked lesson types no longer stamped
QC-clean.

Suite 161 → 166. Five of the ten came from the user playing lessons, which no test in the suite
could have produced. Full detail in the session notes.

## THIS SESSION — the lesson flow, the completion card, and comprehension

Spec from the user's play-test of `sl_255710679` ("Paella und Chaos"), session 27 close. Where a
claim below is marked **measured**, it was reproduced against the corpus before being written down;
the rest need confirming in a browser first.

### 0. Read this before touching anything in this area

Session 27 shipped nine changes to the completion card and lesson flow in one sitting, each
individually revert-verified, **with no browser in the loop**. The user then reported the area as
broken. The individual changes were verified; the *accumulation* was not. Treat the whole block as
suspect until a browser pass clears it, and prefer reverting to re-fixing.

**Prime suspect — `v73_g` icon row.** `startLesson()` opens with: *"Learner routing (`loadSaved`)
relies on this: `goLessonSet` has already rendered the lesson-set page underneath, and a silent
false would strand a learner on a page they must never see (v68.1)."* The `v73_g` icon row calls
`startLesson()` **from the completion card**, where that precondition does not hold. The test
asserted the `onclick` ATTRIBUTE, never the resulting navigation — a vacuous assertion in the
feature the user reports as broken. Either route through `goLessonSet` first, or make the icons
non-clickable as the storyline row already is.

Bisection points, one change each, `docs/` rebuilt at every step:
`v73_g` icon row → drop to `v73_f` · `v73_i` exercise qid dedup (a global filter on every round,
best fit for "user progress") → drop to `v73_h` · `v73_d` pass-mark rework → drop to `v73_c`.

### 1. The progress bars measure three different things and present them as one

**Measured** on the reported chapters:

| | `Kälte und Paella` | `Churros und Chaos` |
|---|---|---|
| mixed-driven? | no | yes |
| bar shows | **2/2** (lessons) | **67/83** (questions) |
| `topicCoverage().total` | 31 | 83 |
| of which comprehension | 3 | 3 |
| `storyUnlockLessons` | `standard` only | `mixed` only |

Three defects fall out of this, and they are one root cause — **the bar, the unlock gate and the
chapter gate are three different questions sharing one display**:

- **Unit inconsistency.** `_compProgressHtml` branches on `_mixedDriven`: mixed chapters show
  question coverage, classic chapters show completed lessons. So `2/2` and `67/83` sit on identical
  bars meaning different things. The user's ask — show lessons-until-story-unlocked in both cases,
  even when four of five lessons are reached through a mixed lesson — resolves it in favour of the
  lesson count.
- **Comprehension is inside the coverage universe but outside the unlock rule.** `storyUnlockLessons`
  excludes it (`_STORY_GATED_TYPES`), yet its 3 questions are in `topicCoverage().total`. Hence the
  reported "64/83, bar red, below threshold, yet the story is unlocked" — the bar is measuring
  something the gate does not use.
- **Comprehension is a SECOND gate, not part of the first.** The user's model, and it is the right
  one: the non-comprehension lessons unlock *the story*; the comprehension lesson unlocks *the next
  chapter*, and must be played until every part is understood. Two gates, two indicators — never one
  bar trying to say both.

### 2. Story highlighting — the note is right, the cause is not what it looks like

The user reports too little highlighting after `v73_e` fixed too much. **Measured** on
`tp_17856930149110000139`: 16 vocab words, 1150-char story, **4 marks before `v73_e`, 2 after**.

But the boundary fix is a minor part of it. Of the 16 vocab words:

| | count | example |
|---|---|---|
| match exactly once a leading article is stripped | **9** | `el churro` vs story's `churros` |
| match only via stem | **4** | `asistir` → `asistiendo`, `negociar` → `negocié` |
| genuinely absent from the story | 3 | |

**Vocabulary is stored in dictionary form — with article, in the infinitive, singular — while the
story uses inflected forms.** Exact matching therefore finds at best 2 of a possible 13, and did so
long before `v73_e`. Do not "fix" this by reverting the word boundaries; that trades 2 real marks
for the every-`i`-highlighted bug.

Two tiers of repair, both corpus-derived rather than language knowledge:

1. **Strip a leading article before matching.** The article set per language is already derived —
   `_articleStatsFor` collects exactly this for the MCQ work (`v73_f`). Recovers most of the 9.
2. **Use the inflections the corpus already holds.** `word_forms` lessons contain the forms;
   `grammar` items carry `plural`. Matching against those is data, not a stemmer.

Anything beyond that is prefix matching, which over-matches — take it only with a measurement.

Separately, and simpler: the user wants **all learned vocabulary of the chapter** highlighted.
That is the word SELECTION in `renderStoryText`, which currently filters to completed lessons on the
home screen — independent of the matching problem above.

### 3. The story-unlocked card

- `complete.story_unlocked` → **"read and understand the chapter"**. English only; delete the other
  29 so the translate pass refills them. (The `v71_q` rule: a key dropped for refill must not be
  asserted absent — see `unit-model-settings`, which broke on exactly that.)
- Only the **Next** button on that card.
- Story text: **not italic, larger**.
- `ex.badge.comprehension` → **"did you get this?"** (from "Understanding the story").

### 4. Remaining items from the play-test

- **Solved-vocabulary panel** (card bottom): allow line wrapping, fixed width matching the storyline
  header, and show the whole chapter's solved vocabulary rather than the round's.
- **Storyline page / card of `sl_255710679` in static**: every story unlocked, yet the storyline bar
  reads `4/8 — 96%` (two metrics rendered as one) and "read complete story" still appears locked.
  Confirm in a browser before changing.
- **All stories unlocked** → Next must not be greyed; it should return to the storyline. A separate
  congratulatory card can come later.
- **Live vs static divergence**: on the storyline page in live mode (non-teacher), chapter progress
  is not shown in the chapter fields; static shows a bar. One of the two is wrong — decide which.
- **Batch-generation menu**: add **mixed lesson** to the lesson-type picker, both for first
  generation of a book and in "add lessons". Note `renderLessonTypeChecks` is the shared renderer
  and `v73_c` made its render → read round trip testable headlessly.
- **Comprehension TTS**: do not read out the "why" explanation — it often mixes source and target
  language in one utterance.


## Recommended order

**QC work is POSTPONED by the user** — the QC menu, `mergeFlaggable`, and the comprehension checker
all wait. The lesson flow comes first because session 27 is suspected of breaking it.

1. **Browser pass + bisect** against §0 above. Establish what is actually broken before writing code.
2. **§1, the progress bars** — one root cause behind three reported defects, and it is a design
   decision (two gates, two indicators) rather than a patch.
3. **§3 and §4's text/layout items** — small, and they make the flow legible while the rest is
   being reasoned about.
4. **§2 highlighting** — needs the measurement above respected: do not revert the word boundaries.

## Open — the queue

### Owed by the user (nothing here is doable in a dev container)

See the table in `HANDOVER.md` — it is the authoritative list and has grown across nine releases.
The two most informative right now:

- **Live synonyms run** (`v72_d`, `v72_e`, `v73`). Partially done: the user reports the new synonyms
  "look good so far", which is what prompted the `v73` antonym change. Still to confirm: the log
  lines `Synonyms context: N quoted, M rejected` and `N antonym-only`, and whether antonym counts
  recover after `v73`.
- **Browser passes on `v71_i`–`v73`** — nine releases deep.

### Open decisions blocking work

1. **Duplicate targets** (`v71_r`) — **evidence re-measured in session 26; the original data is
   gone.** The "six grammar lessons" this was written about are no longer in the corpus. What is
   live is **2 synonyms lessons with a repeated `base`**, both Arabic. Same defect class — two
   exercises collide on one qid, so the round asks the word twice while coverage counts it once —
   but rule on the CURRENT shape. Dedupe or repair?
2. **Crossword translation highlight**: `word_forms` items have no translation field.

*(Rulings from the v72 line, kept because each closes an item that would otherwise be re-opened:
the design principle's boundary — Unicode machinery, not hand-authored tables, session 25;
`el/storyboard.title` stays "Storyboard" as a loanword, session 26; grammar and conjugation stay
story-free, session 26.)*

### Ready to implement, no decision needed

- **Arabic presentation forms** — measured in session 26 (`v72f_session26_notes.md` §7), **not
  urgent**, and explicitly **NOT a blanket NFKC**: measured across the corpus, NFKC changes 158
  strings and corrupts several — `sˤ` → `sʕ` in `letters[].ipa` is a different phoneme, `① ② ③` →
  `1 2 3` destroys a lesson whose glyphs are the content, and Japanese full-width `！` is flattened
  to ASCII. **0 of 4670** typed-answer targets are affected, so no learner is ever marked wrong. The
  one live effect: `verbatimStorySentence` can never accept a model quote for those three topics, so
  the `v72_d` feature silently no-ops there. If actioned: fold **only** the two presentation-form
  blocks, **at comparison time**, never rewriting stored text — or better, fix `_cleanPdfText` so
  new imports never store them.
- **Clamp the synonym context SERVER-side** — `findContextSentence` returns an uncapped sentence;
  the client clamps for display (`v70_n`) so nothing is broken, but stored data stays bloated.
  Cheaper than it was — `_sentenceSplit` is genuinely shared now, with a parity test to copy. One
  wrinkle: a stored fragment loses the `frag` flag, which exists only client-side, so decide whether
  stored fragments carry ellipses or the honesty marker is lost.
- **`_SENT_END_RE`** (`index.html` ~4044, 4062, 4156, 4210) — the last hand-authored punctuation
  list in the segmentation area. It answers a *different* question from splitting ("does this string
  END like a sentence?", for the paragraph-wrap repair and title heuristics), which is why it was
  left alone through `v72_a`–`v72_c`. Fair game now; part of the cleanup pass.

### RECOVERED — dropped at the v71 → v72 boundary (restored in `v73_k`, still open at v74)

An entire `[OPEN — cosmetics deferred in v71_q]` block of three items vanished when `roadmap_v72.md`
was cut from `roadmap_v71.md`. None appears in `roadmap_v72`, `roadmap_v73`, `HANDOVER.md` — or in
`future_development.md`, whose scan grepped for unchecked checkboxes and read the topical idea docs
but did not walk `[OPEN — …]` blocks inside superseded roadmaps. All three re-verified as still open
on `v73_k`.

**Check `[OPEN`/`[QUEUE` blocks at every base-version cut.** That is where items are lost — not in
the idea documents, which nobody deletes.

1. **Global QC: a checkbox menu of what to QC**, including re-checking already-QCed items. Needs a
   scope picker and changes to how QC jobs batch — the same treatment the lesson-type picker got in
   `v71_p`, not a quick pass. **Merge with the user's session-27 request** (below): make the book's
   automatic QC opt-in from the same menu that selects lesson types, and run it after the storyboard
   post-pass rather than before. Note that reverses the `v68.1` ordering decision ("a slow board must
   never delay content flags") — which is defensible once QC is opt-in, but should be reversed
   knowingly. `renderLessonTypeChecks` is the menu, and `v73_c` made its render → read round trip
   provable headlessly, so the client half is now testable.
2. **Crossword: show the correct word's translation highlighted instead of the empty underline.**
   Needs a decision first. Clues come from three shapes — vocabulary (`target ← source`), synonyms
   (`base ← gloss`), and word_forms, where the clue IS a blanked sentence and the "empty underline"
   lives. A word_forms item stores only the sentence and its choices, **no translation**, so there is
   nothing to put in the gap. Either restrict this to vocabulary/synonym entries, or give word_forms
   clues a translation field.
3. **Live mode with teacher mode OFF must hide every editing control**, as static mode does. The
   learner should be able to continue the story, download and share a link — nothing else. Verified
   still open: `_canEdit()` is `!!(APP.info?.canGenerate || APP._teacherMode)`, so a learner on a
   live backend sees editing controls with teacher mode off. **This is the same `_canEdit()`
   conflation the authorization plan above calls out in step 2** — capability (is a backend
   available?) OR authority (has this browser ticked a box?) in one function. Do them together.

### Backlog — see `future_development.md`

`build_history/future_development.md` (session 27) is the scan of everything wanted across 128
files in `build_history/` and never built, each entry re-measured against the code. Two items in it
outrank most of this queue on current evidence:

- **The example pipeline is complete in code and empty in data.** `promptExample()` resolves at 4
  generation sites; `examples.json` absent, **0** corpus items starred, **1** curated per-language
  example (`wordForms.de`). Every generation in every language falls through to the generic default.
  Needs curation, not code, and sits upstream of every lesson the app produces.
- **5 lessons in the shipped corpus would be rejected by the app's own rule** (≥3 identical
  source/target items AND ≥60% of the lesson) — including the two `dreizunge_lessons_assessment.md`
  named as total model failures. The guard runs at generation time only, so it never cleaned what
  prompted it. **General case: every generation-time guard in this codebase leaves an unmeasured
  residue** (diacritics, article symmetry, identical-ratio).

### Larger, not started
- **Concept graph / dependency-aware curriculum.** Deliberately untouched until the small queue is
  clear. Large authoring project; do not start it opportunistically.
- **Word games beyond the crossword.** Reuse the crossword's conventions (deterministic seeding per
  attempt, credit only what the exercise genuinely demonstrates, content-based availability) rather
  than re-inventing them.

### i18n
**0 entries missing** — the pass landed between v72 and v72_b and filled all 30 languages to 596
keys. `ui.json` is byte-identical to the file the user supplied; **nothing was deleted.**

**8 entries are PARKED pending the user's own QC**, listed as `PENDING_QC` in
`test/unit-ui-verbatim-en.test.js`: `models.threads` in **ar, he, hi, ko, uk, zh, th, el** — one
key, eight languages. All came back verbatim English. They are held rather than deleted at
the user's request, and the guard compares against that list **exactly in both directions** — a new
fallback fails, and a parked entry that has since been translated also fails so the list is forced
to shrink. Do not treat `PENDING_QC` as an exemption list; it is a to-do list with a deadline
enforced by the suite.

`el/storyboard.title` is **no longer one of them** — decision 4 was ruled in session 26: keep
"Storyboard" as a loanword. It has moved to `APPROVED_LOANWORDS`, so the v71_k → reinstate loop is
closed. That leaves **8** parked entries, all of them `models.threads`.

**Validate a returning `ui.json` before merging** — per-language key counts, whether any `en` key
vanished, **and run `node test/run.js`**: the returning file carried 9 untranslated entries that
only `unit-ui-verbatim-en` caught.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read `build_history/HANDOVER.md` first (one page: baseline numbers,
what is owed by the USER, open decisions), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one), then `INTERNALS.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- **A carried-forward open item must be cross-checked against the SHIPPED list in the same file
  before it is carried again.** Added session 26: the "Drill result card" item was carried through
  four releases while `roadmap_v71.md` recorded it as shipped in `v71_h` on line 227 — the open
  entry sat 264 lines below the entry that closed it. Deferring an item is not evidence that it is
  still open.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v74` → `v74_b` → `v74_c` → … — the same convention the v69–v73
   lines ran. **This is the `v74` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v74 line.
   (This paragraph is the one version-specific line in the block and has been carried forward stale
   twice — `roadmap_v73.md` shipped saying "This is the `v72` line". **Check it at every base cut.**)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.
- **`APP.cur` has a DEFAULT (`lessonIdx: 0`, index.html:1651) that sections silently depend on.**
  `_exFlagTarget` resolves a flagged item through `APP.cur?.lessonIdx`, and `assembleCoverageRound`
  keys the solved-set through the same fallback. So a section that needs a real lesson index must
  **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or `delete` the
  object — doing either broke an unrelated later section in v71_r. Mutating also mirrors real play,
  where `openLesson` sets `C.lessonIdx = idx` immediately before `buildExercises(idx)`.

**(session 23) DESIGN PRINCIPLE — no language knowledge in the code.** The code must not encode
facts about particular human languages: article lists, gender rules, pronoun sets, inflection,
"which languages use articles", sentence-final punctuation. Producing correct language content is
the MODEL's job — instruct it in the prompt instead. A per-language table is written by whoever is
editing the code, is wrong in ways invisible until a native speaker looks, and fails silently for
any language missing from it.
*Not* covered: mechanical/typographic facts that decide how text is HANDLED rather than whether it
is CORRECT — Unicode normalisation, script/RTL detection, diacritic folding for comparison.
The test: **does this decide whether content is right, or only how it is displayed/compared?**
Known violations inventoried in `INTERNALS.md` → "Design principle"; the worst
(`normalizeVocabArticles`) actively degrades real data.

**(v71_w) Rules:**
- **A progress FRACTION and a FINISHED signal are different questions.** "How much have you played"
  may stay a raw count; anything asserting completeness — a colour, a lock, a tick, a connector line
  — must read the shared rule. The storyline page got this wrong for two releases in both
  directions at once, and nothing failed because the two rules agreed on the bundled data.
- **A source-pin regex that falls outside its own slice window is a vacuous pass.** A 4,000-char
  slice of `_renderChapterCard` stopped before the line being pinned. Check the pin actually sees
  what it claims to.

**(v71_u) Rules:**
- **Wiring changes need a RUN, not source assertions.** When one side sends and the other consumes,
  assertions on each half prove nothing about the join: in `v71_u` the server could ignore
  `arcTypes` entirely and the whole 156-check suite stayed green. If a change is "A now passes X to
  B", the test must observe B's OUTPUT.
- **A standard/vocab lesson has NO `type` field** — it is the default shape. `l.type === 'standard'`
  is never true, and an assertion written that way is vacuous (this bit inside the very test written
  to catch a vacuous pass). Use `(l.type || 'standard')`.
- **A test that re-implements the code it tests cannot fail when that code is deleted.**
  `unit-arc-options` kept passing after its feature was removed. If a test builds its own copy of a
  block to run it, it is testing the copy.
- **New lesson types need a `fake-ollama` branch**, or an e2e will skip them silently — the arc loop
  correctly refuses to abandon a run for one bad type, so the omission is invisible. Order matters:
  place a new matcher before any looser one that could swallow it (`correctIndex` is shared by
  comprehension and word_forms).

**(v71_t) Rules:**
- **Ollama truncates an over-long prompt SILENTLY.** `num_ctx` defaults to ~4096 and there is no
  error when the prompt exceeds it. Any change that makes a prompt bigger must size the context
  window in the same commit, or the extra text is discarded invisibly and the change looks like it
  worked. A deliberate trim in our code always beats letting the backend cut blindly.
- **`callLLMLesson` spreads the caller's opts AFTER its think policy**, so a caller passing
  `timeoutMs` or `tokens` OVERRIDES the ×3 / ×2.5 that reasoning mode applies. Check you are not
  lowering them — "raise the timeout" is easy to write as a reduction.

**(v71_s) Rules:**
- **A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the LAST counted
  lesson so the vocab recap resolves, so anything that JUDGES the learner — records a done-flag,
  locks Next, counts an exposure — must be behind `!C._review`, or it judges a lesson nobody just
  played. Third time this shape has bitten (v71_n, v71_s twice).
- **A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule
  that refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
  silently means "replay this" and steps over the v71_d lock.
- **When a builder or gate is narrowed by lesson type, narrow the COVERAGE UNIVERSE to match.** A
  denominator that counts questions the round will never ask can never be satisfied.

**(v71_r) Diagnosis rules:**
- **A red baseline is a finding until proven otherwise.** When only the DATA files are newer than
  the code, the obvious read is "stale fixture" — but check whether the guard is *right* first.
  In v71_r the fixture had indeed moved AND the property it asserted was false, hiding a live
  defect. Fixing the fixture alone would have shipped the bug.
- **A failure appearing *after* you fix another one may not be new — it may be running for the
  first time.** An earlier `assert` aborts the file, so everything below it is unexecuted. Verify by
  patching the PRISTINE tree to skip the original failure and watching the later section pass,
  before assuming your change caused it.
- **Guard a guard against going vacuous on new data.** If a section only means something when the
  corpus contains a case (here: a lesson exceeding its builder's cap), assert that such a case was
  actually found. Without it the section silently becomes a no-op — which is precisely how §8
  passed while grammar sampled at random.

(If you add a new standing rule, append it here so the next session inherits it.)
