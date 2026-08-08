# Roadmap — v76 line

Current cut: **`v76_g`**. Baseline `node test/run.js` **178**, `--quick` **155**, `check-inline` 0 on
both builds.

> **Carried forward from `roadmap_v75.md` in full, from §3 onward.** The v71→v72 boundary lost three
> items that were only recovered in `v73_k`; everything still open is reproduced below rather than
> referenced. `roadmap_v75.md` remains for the shipped table and the session-28/29 rules.

## Shipped after the v76 cut

| release | what |
|---|---|
| `v76_g` | **Script choice for digraphic languages — the data half.** Serbian is written in Cyrillic OR Latin and nothing told the model which, so it chose per generation (target → Latin, source → Cyrillic). `scripts.json` now declares **`_scriptChoice: ["sr"]`**, and `backfill-script.js` stamps `script`/`srcScript` on existing topics by Unicode detection. **The obvious gate `scriptsForLang(x).length > 1` is WRONG** — it is equally true of `ja`, which mixes hiragana and katakana concurrently; measured, `sr` texts mix in 0 of 5 and `ja` in 9 of 13. Nothing reads the field yet. |
| `v76_f` | **`--langnames` wrote only at the end** (user-reported) — every language accumulated in memory and `languages.json` was written once, after the loop, so any interruption discarded the whole run. `translateLang` in the same file has saved per batch all along; this mode never copied it (**standing rule 10, second time in the same function**). Extracted `_flushLangs()` and call it after every batch. `unit-langnames` §3 runs the REAL mode and kills it mid-run. |
| `v76_e` | **A mixed-language storyline lost its identity on the main page** (user-reported, `sl_9302163`). `loadSavedList` projected each chain through the **language-filtered** id index, and `storylines_renderChain` recovers the storyline by an exact full-length positional match — which a truncated chain can never satisfy — so it fell through to a synthetic `'c'+hash` id with no storyline behind it: no title, icon, storyboard or summary, and a short chapter count and deck. Reproduced the user's exact `c1935658823` at `libFilter=sr` / `libSrcFilter=all`. **A storyline is one unit: the filter decides WHETHER it is shown, never WHICH of its chapters are.** Same class as `v75_f`. |
| `v76_d` | **Test-only.** Two guards had pinned the shape of the corpus rather than their claim: `unit-coverage-threshold` compared a progress-row label against the raw title while the card truncates at 40 chars (the corpus moved to a 42-char one), and `unit-live-static-progress-parity` asserted `total 🔒 === 1`, which encoded a *two*-chapter storyline where the chain is now six. **In both cases the product was correct.** No version bump, no `docs/` rebuild — no shipped artifact moved. |
| `v76_c` | **`--langnames` shipped broken** — `callLLM` is positional and returns `{text}`; it was called with an options bag and its result read as a string. Only `--check` had ever been run, and `--check` never calls the model. Fixed, `llm.js` now rejects a non-string model with an actionable message, and `unit-langnames` runs the real mode against a stubbed backend. |
| `v76_b` | **`sr`/`hr` were missing from both language drop-downs** — the menus are hand-written `<option>` markup, not generated from `languages.json`, so adding a language is a two-file change and only one file had a guard. Options added; `unit-lang-menu-coverage` now asserts both directions plus `name`/`flag`/`tts`. Added **`translate-ui.js --langnames`** to fill `languages.json`'s 32x32 `names` matrix (151 cells were empty — including 31 for `lb`, a pre-existing hole nobody knew about). |

**Open from `v76_e`, needs the user:** the fix means filtering the library to one language now shows
a mixed-language storyline **whole**, including chapters in the other languages. The alternative
(fix identity only, keep truncating) leaves *"the lessons in a different language didn't show up"*
unfixed and still hands `openStorylineScreen` a short chain. Confirm or reverse.

**Open from `v76_e`, not fixed:** `_tryOpenStorylineByChainId`'s legacy fallback rebuilds chains
through `makeParentResolver`, which is **same-language guarded** (`index.html:1429`), so an old
bookmark or shared link carrying one of the synthetic `c…` ids cannot be resolved for a
mixed-language chain and lands on the landing page. No new `c…` ids are produced after `v76_e`.
Widening the parent resolver changes chain CONSTRUCTION and wants its own release.

**Open, not done:** the two menus should eventually be GENERATED from `languages.json`. Not done in
`v76_b` because they are deliberately ordered differently (`lang-select` leads with Italian) and
generating would silently reorder a user-visible menu. The guard makes the duplication safe until
someone decides the order.

## ⚠️ Session protocol — READ FIRST

Unchanged from `roadmap_v75.md`. Re-read its protocol block and its definition-of-done before
writing anything, plus **"Rules earned in session 28"** and **"Rules earned in session 29"** — eight
rules now, and each one cost a wrong finding.

Standing design principle: **no language knowledge in the code**, where *permitted* means Unicode
machinery or corpus statistics, not a hand-authored table.

---

# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)

**Principle, in the user's words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow
exists so that the student ends up understanding the text. "Complete cards" are renamed **progress
cards** and become the spine that guides a learner through a story.

**Read `build_history/v76_card_gates.md` before touching the card.** It carries the measured AS-IS
truth table (32 rows, both gate families) and a preserved probe to re-run and diff.

## 0a. BLOCKING — three rulings the user still owes

Nothing in §0 should be built before these are settled; each one changes what the cards are.

1. **Does `v74_l` survive?** It strips the story-unlocked card to Next-only for learners. The rework
   wants that same card to show the story as the focus, keep Replay always available, and carry a
   third progress bar. These are incompatible — `v74_l` looks SUPERSEDED, and if so it should be
   deleted with its test rather than worked around. Note the table finding: `v74_l`'s hide-list is
   barely observable today, because those buttons are usually already hidden for other reasons.
2. **Does `v74_o` survive?** "Nothing left to do → return to the storyline." Back/next turns that
   terminal state into a waypoint. The user's screenshot 2 shows the grey Next this rule produces;
   the user wants it green and active, restarting the comprehension lesson.
3. **What does a highlight MEAN?** See §3 — the measured choice is +782 marks with articles as noise
   versus +60 clean. That is a product judgement about what a mark tells a learner, and it must be
   written into this roadmap next to the numbers or the next session will re-derive both and pick
   differently.

## 0b. Do this FIRST, before restructuring

**Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible** (564 lines, `index.html`
~14212–14776). A throw in any of them leaves the card half-rendered with the suite green. Session 29
lost real time to a bug that *looked* like a swallowed throw and was not. A counter the harness can
assert is zero, or a rethrow under a test flag, is enough. One small release, revert-verified, before
any of the work below.

**Then settle the coverage key-space question** in `v76_card_gates.md` — 86 seeded solved keys, 0
counted, total 31, on the branch that gates story unlock for every mixed-driven chapter.

## 0c. The sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

  **summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

- The **summary card is the FIRST page** in the back/next sequence, showing the story summary in the
  SOURCE language, with progress bars empty, before any question of that chapter.
- Back/next also walks **already-played chapters**, to revisit, replay, or complete vocabulary.
  Hint from the user: such buttons already exist in the teacher-only lesson-set view.
- A **"story finished"** card at the end: full story (collapsible), the complete vocabulary learned,
  and a festive icon.
- **`comp-back` already exists and is hidden in all 32 measured rows.** Decide: revive or replace.
- **`comp-story-unlocked` does not mean what its name says** (it is the preview label, shown while
  locked whenever canGenerate or teacher is on). Rename before adding a real unlocked card.

## 0d. Layout and navigation

- Move progress bars, lesson icons and the replay/drill/crossword/next buttons **BELOW the text** on
  all progress cards. (Check `comp-drill` first — grey or hidden in all 32 rows; possibly dead.)
- Closing a question card (the ✕, upper left) must return to **the progress card of the lesson being
  played**, not to the storyline.
- **Replay must ALWAYS be available**, including after the story is unlocked and comprehension and
  error-hunt lessons are done. The learner must be able to reach 100%.
- Show the **third progress bar** (post-unlock lessons: comprehension, error hunts) on ALL progress
  cards of that chapter, iff such lessons exist. User screenshot 2 shows it appearing only on
  partial completion today.

## 0e. Vocabulary on progress cards

- **Cumulative per lesson-set**: every word the learner has already solved correctly, not just the
  current lesson's. **User screenshot 2 shows the panel EMPTY** on a comprehension card, because a
  comprehension lesson has no vocab of its own — so today the panel is blank on exactly the cards
  where the story is the focus. This is not polish; it is a blank panel.
- Ideally ordered as the words appear in the story (greedy matching, to allow for word forms).
  **Do this as part of §3, sharing one matcher** — it is the same token-alignment problem, not a
  separate nicety.
- Include vocabulary that was the question or the correct answer in **synonym and word_forms**
  lessons.

## 0f. Story read-out

**Auto-start a read-out of the story chapter when it is unlocked and shown on the progress card**
(unless muted). Cheap now, and only because of `v75_h`: the old flat 4-second advance net would have
cut a story chapter to ribbons. Watch for cancel-races with the card's other speech — `v75_h` made
`cancel()` conditional, and that must not be undone here.

## 0g. Comprehension flow

- A wrong answer currently returns to the card; Replay then replays only the normal lessons.
- **Next should be green and active**, restarting the comprehension lesson directly.
- **A repeated comprehension lesson must ask only the questions not yet answered correctly.**
- Model prompt change (user, needs a live model — OWED BY THE USER): explanations must NOT quote
  story sentences literally; keep the explanation in the SOURCE language; if a quote is required,
  translate it; and additionally report the exact underlying quote in the TARGET language. Read out
  the explanation for CORRECT answers too — both the source-language explanation and the
  target-language quote.

## 0h. Question navigation — its own release, probably its own session

Back/next on the QUESTION cards. Already-made choices are shown (right or wrong) and cannot be
reverted, but the lock lasts only for that question set: replaying via the progress card makes them
playable again.

This is not a card change — it is a question-runner change (`C.cur`, `check()`, per-run answer
state) and it interacts with `_speakAndAdvance`, which today advances in one direction only. Scope
it separately.

---

# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1

- Align the teacher-only "add lessons" button on the lesson-set/chapter page with the storyline-level
  bulk "add lessons" selection menu. Per-type options on the right of each lesson type (math: LLM
  prompt; vocab: extend/neutral/reinforce), possibly including the difficulty selector, plus a
  per-type **count** defaulting to 1 (e.g. 2 vocab, 1 synonym, 1 comprehension).
  **MERGE HERE: the recovered "Global QC checkbox menu" item** — same menu, and it also wants the
  book's automatic QC made opt-in from the lesson-type menu and run AFTER the storyboard pass.
  That reverses the `v68.1` ordering decision.
- **PERHAPS: remove extend/neutral/reinforce entirely** and make "extend" the standard: whenever a
  lesson is generated it uses words of the chapter NOT YET covered by previous lessons up to this
  chapter. Aim to cover a story's vocabulary as completely as possible, focused on specific/rarer
  words. Re-inject unsolved items from previous sections outside the model, the way the lesson flow
  already reduces to unsolved.
  **BLOCKED on §1 (the pass mark).** This moves the denominator; settling the target afterwards
  means both moved at once and neither measurement is interpretable.
- Add a real **re-generate lessons** function on the storyline page, beside "add lessons", that
  regenerates the EXISTING lesson types with the same settings but new prompts and models — so older
  storylines can get better lessons.

---

# CARRIED FORWARD from the v75 line (unchanged unless noted)

> §4 "Browsing completion cards" is **ABSORBED into §0c** and deleted as a separate item — it was
> the back/next request. Everything else below is still open.

### 3. Highlighting — measured TWICE, NOT shipped; the v75 plan was too narrow

> **REVISED at the v76 cut, after the user's screenshot.** The chapter in
> `Screenshot_2026-08-04_23-28-47.png` (`Genetik und Mendel`, it←de, `tp_17851395481530000335`)
> scores **0 marks today**, from THREE independent causes, only one of which the plan below covers:
>
> 1. **Stored articles** — `"la variazione"` vs the story's `"della variazione"`. (Covered below.)
> 2. **An apostrophe mismatch nobody had spotted.** Vocab stores `l'evoluzione` with ASCII `'`
>    (U+0027); the story has `l’evoluzione` with U+2019. Not equal — so even the exactly-present
>    word never matched. 15 `it`, 7 `en`, 4 `lb` chapters have ASCII apostrophes in vocab; 18 `it`
>    and 92 `en` stories carry the typographic one.
> 3. **Inflection** — `mutazione`/`adattamento` vs `mutazioni`/`adattamenti`. That is Tier 2 below.
>
> **Measured comparison of the candidate fixes** (product highlighter, 282 chapters):
>
> ```
>                                    screenshot ch.   corpus            improved in
>   as stored (today)                    0 marks       3233 marks        -
>   split vocab on whitespace            8             4015   (+782)     96 chapters
>   strip leading token (plan below)     4             3377   (+144)     56 chapters
>   normalise apostrophes only           1             3235   (+2)       10 chapters
>   articles + elided + apostrophes      5             3293   (+60)      22 chapters
> ```
>
> **Whitespace splitting wins on count and loses on meaning:** on that chapter 4 of its 9 marks are
> the article `la` — it highlights the commonest word in the text as if it were learned vocabulary,
> and `mutazione`/`adattamento` still miss. The composed version marks
> `variazione, trasmissione, genetica, DNA, evoluzione` — **5 marks, 0 articles**, and corpus-wide
> **0 bare articles**. Corpus-derived article sets came out as `es: el, la` / `it: il, la, l'` /
> `ar: ال`, with `it` also catching two false positives (`reti`, `per`) that want the threshold
> tightened before shipping.
>
> **The user has accepted article noise ("that's ok for now"). §0a ruling 3 is whether that still
> holds now the cost is measured.** Ship the composed version unless the user rules otherwise; keep
> "also mark articles" as a separate reversible toggle.
>
> Also new here: include vocabulary that was the question or correct answer in **synonym and
> word_forms** lessons (§0e), and share ONE matcher with §0e's story-order vocabulary display.

### (original v75 note follows) Highlighting — measured, NOT shipped, and the old plan is WRONG

`roadmap_v74.md` §2 said the article set "is already derived — `_articleStatsFor` collects exactly
this". **It does not.** That function reads `x.article` from GRAMMAR items via `_forEachGrammarItem`;
`Churros und Chaos` has no grammar lesson, so it returns `{choices:[], predictable:false,
sampleSize:0}` — empty on the very chapter the complaint came from.

Reproduced (16 vocab, 1150-char story): **2 exact, 8 recovered by stripping the leading token,
3 stem-only, 3 genuinely absent.**

A corpus-derived replacement, statistics rather than language knowledge — a true article appears
often as the FIRST token of a multi-token vocab entry and almost never as a standalone entry:

```
es  ["el:25","la:19"]      it  ["il:38","la:30"]
de  ["sich:6"]   <- German vocab stores no articles; nothing to fix
fr / nl  []      <- too little data to clear the threshold
```

End-to-end across 284 chapters with a story and vocab: **3233 → 3278 marks (+1% overall)**, but
`Churros` 2 → 10 and `Barbera` 4 → 10. **Narrow corpus-wide, decisive where it bites** — size it by
the per-chapter effect, not the aggregate. The filter (`count>=3`, `standalone*4<leading`,
`len<=4`) is a first cut and wants its threshold justified by measurement in its own release.

**Do NOT revert the word boundaries** — `v73_e` traded the every-`i` bug for 2 real marks.

Tier 2 (corpus inflections from `word_forms` / `grammar.plural`) is untouched and would address the
3 stem-only cases.

### 3b. The Android English voice — MEASURED session 29, a real hole in `v74_j`, NOT shipped

User, at the v75 cut: *"i still get caribbean sounding english on the static site at github, and
only on android"*. Not a cache and not a stale deploy — **`v74_j` fixed only the case where the
exact locale is PRESENT.** `languages.json` maps `en → en-GB`; with no `en-GB` voice installed,
`_ttsRankVoices` falls through `usable → exact → quality`, nothing is exact, and quality alone
decides — so a NETWORK voice in an arbitrary region beats the LOCAL `en-US`. Measured by calling the
product ranker: `en-GB` absent → **`en-NG`**; typical Android inventory → **`en-IN`**.

`unit-tts-voice-ranking` §5 builds exactly this inventory but asserts only that the app *speaks*,
never which voice — deliberately, from `v55_x` (*"a regional accent is not the failure v55_x
refuses"*). **That position is what the user is disputing, so this needs a ruling, not a patch.**

**Blocked on a design-principle decision.** "`en-US` is closer to `en-GB` than `en-JM`" is a
hand-authored language fact. Non-violating signals: **`voice.default`** (the platform's own pick) or
**`navigator.language`** (the device's region). Third option: leave the ranking and ship §6's
selector, so the user picks once and `imp3_voice_*` persists it — that store is written ONLY on an
explicit pick and is **not** the cause here.

### 3c. Serbian and Croatian — ✅ SHIPPED `v75_g` (table authored; native review OWED)

**Serbian does NOT "just use standard Cyrillic".** `scripts.json`'s `cyrillic` table is the
**33-letter Russian alphabet** — it contains `Ё Й Ы Э Щ Ъ Ь Ю Я`, none of which are Serbian, and
reads `Е` as *ye* (`ipa: je`) where Serbian has plain `/e/`. Serbian Cyrillic is 30 letters and adds
`Ђ Ј Љ Њ Ћ Џ`. Mapping `sr → cyrillic` would teach the Russian alphabet under a Serbian flag, and
leaving `sr` unmapped is not an option either (the file's own header: an unmapped code reads as
"no script"). Croatian is Latin only — `"hr": "latin"`, no new table.

Serbian is digraphic (both scripts official and equal), so the `ja: ["hiragana","katakana"]`
precedent fits: `"sr": ["cyrillic-sr", "latin"]`. **Needs a ruling** because one option is content
authoring: (a) author a 30-row `cyrillic-sr` table — which is exactly what the design principle
exists to prevent; (b) ship `sr` Latin-only now, add Cyrillic when a native speaker or the model
produces it; (c) have the model generate it under the existing prompt machinery, then QC it.
Both languages also need a `tts` code (`sr-RS`, `hr-HR`), 29 `names` entries each, and a `ui.json`
stub for `translate-ui.js`.

### 4. Browsing completion cards — ✅ ABSORBED into §0c (the progress-card rework)

Deleted as a separate item at the v76 cut: it *is* the back/next request. Its warning survives in
§0a — it interacts with `v74_l` and `v74_o`, and both need a ruling rather than a third navigation
rule layered on top.

### 5. `_sbChapterTarget` — the seventh and last known raw-lessons instance

`index.html` ~8065. Not fixed in session 28 because its test extracts it in isolation and calls it
with synthetic progress maps, so switching to `chapterComplete` (which reads `APP.progress` and the
v69_l stamp) needs that harness reworked first.

### 6. The storyline-page TTS selector

`dreizunge_v39_summary.md:331` records `_buildGlobalTtsSelectors()` building selectors "in all footer
rows (lesson-set, **storyline** screens)". Today `const ids = ['ls']`, the `-sl` elements are absent
from the markup, but the function's own existence check still looks for `tts-lang-select-sl`.
**No note anywhere in build_history explains the removal** — the dangling reference suggests an
incomplete removal rather than a decision. The user wants to choose between English variants for
readout; `v74_j` makes that safe (the menu now preselects what would actually be spoken).

Also dead: `#tts-row` / `buildTtsSelector()`, permanently `display:none` with the comment "replaced
by global TTS selectors in footers", still rebuilt on every lesson-set entry.

---

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- **Live mode with teacher mode OFF must hide every editing control.** Same `_canEdit()` conflation
  as the authorization plan. (`v74_h` deliberately did NOT reuse `hideProv` as a screen proxy for
  exactly this reason — see the session notes.)

---

## Owed by the USER — not doable in a container

- **A browser pass.** Nineteen releases deep. `v74_c` changed what coverage MEANS, `v74_i` was the
  only `server.js` change of the session (live mode is the half that cannot be exercised headlessly,
  only simulated), and `v74_j` / `v74_n` are visual.
- **Serbian/Croatian follow-ups (`v75_g`):** the 28 non-English `names` entries in
  `languages.json`, the `ui.json` translate pass for `sr` and `hr` (both are empty stubs), and
  **a native-speaker check of the 30 `cyrillic-sr` rows** — especially the letter names and the
  IPA column. The table was authored in-container, which is exactly the case the design
  principle warns is wrong in ways that stay invisible until a native speaker looks.
- **The comprehension QC checker** — needs a new prompt and a live model. Correctly queued, not
  started in a container.
- **The translate pass.** Changed in English and DROPPED from the other 29 languages for refill:
  `complete.story_unlocked`, `ex.badge.comprehension`. New and English-only:
  `complete.words_solved` = "Words you can read in this chapter",
  `form.finish_mixed` = "Finish the chapter with a mixed review round (no AI)".
  **(v75_b) These two were MISSING FROM `en` TOO** — the returning `ui.json` predated them, so they
  rendered as raw key text. Now present in `en`; every other language is missing exactly these two
  and nothing else (verified). `t()` falls back through English, so nothing is broken meanwhile.
  **`v71_q`: never assert a dropped key absent.** **When the file comes back, `unit-ui-key-exists`
  catches it if it predates the code again.**

---

## Rules earned in session 28 — read these before writing a probe

1. **A probe must call the product function, never a re-typed copy** — and least of all one lifted
   from a test stub. Two false findings came from re-implementing `lessonCountsFor` and the
   read-full-story lock instead of invoking them. One reported a hole that did not exist; the other
   reported a fix as not working when it already was.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors this
   session: math's generator, the `lessonCountsFor` stub, and the error-hunt "lock".
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.
4. **A guard that reads its own explanatory comment is a guard that lies.** A negative match on
   `white-space:nowrap` found the comment naming what had been replaced.
5. **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
   whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks — every
   existing test ran in the static shape, and the live shape existed only in a browser.
6. **Where the environment admits only one writer, unexplained state is yours.** Mid-session a
   version bump and three edits landed without the definition-of-done being run, so the tree drifted
   past the artifact the user held; the changes were then not recognised as mine. The suite-docs-
   package cycle exists to make that drift impossible. Follow it per change.

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
   implicitly `a`, so the sequence is `v76` → `v76_b` → `v76_c` → … — the same convention the v69–v75
   lines ran. **This is the `v76` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v76 line.
   (This paragraph is the one version-specific line in the block and has been carried forward stale
   THREE times now — `roadmap_v73.md` shipped saying "This is the `v72` line", and this file shipped
   the whole v76 line saying "the `v75` line" until session 30. **Check it at every base cut.**)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
   **(v75) Prompt files are named for the version the session WRAPS UP WITH**, not the one it starts
   from: the prompt that opened the session ending in `v75` is `build_history/v75_prompt.md`. The old
   `session_{n}_prompt.md` names were renamed to match (`session_28_prompt.md` → `v74_prompt.md`,
   `session_29_prompt.md` → `v75_prompt.md`) — the session numbering had drifted from the version
   numbering and only one of the two is meaningful later.
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

## Rules earned in session 29 (continued — see the session notes for the full set)

5. **A whitelist fails silently and per-type, so its guard must be per-type AND driven off the
   registry**, or it guards only the types someone thought of.
6. **A "curated title" is a proxy for authorship, not for content.** Deciding which copy of a
   duplicated record survives by any signal other than its content will eventually delete content.
7. **"Every language has key X" goes stale when a LANGUAGE is added**, exactly as "key X is absent
   everywhere" goes stale when the translate pass runs. Scope such claims to the languages actually
   translated, and floor them for non-vacuity.
8. **Replacing a brittle source pin is itself a change that needs revert-verifying.** The first
   replacement of the `if (!u)` pin was vacuous in a NEW way — its match window reached past the
   block it meant to check — and only the paired behavioural test exposed it.

## Rules earned in session 29

1. **A comment near a source-scanned pattern must not spell the pattern.** The repair comment for
   `common.cancel` contained a literal `t('…')` call and failed the very sweep it documented —
   rule 4 above, arriving from the other direction: a correct guard made to fail by prose *about*
   code. A source scanner cannot tell the two apart.
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES.** A precondition checked before `showComplete()` passed under its own revert, because
   rendering the card is what marks the lesson done and flips the branch it was guarding.
3. **A test that does not reset shared state is a test of whatever ran before it.** `seed()`
   preserves `APP.progress` by design and the §3 lock probe writes completion keyed by topic NAME;
   one corpus change made two fixtures the same chapter and the leak surfaced. A section needing
   empty progress must clear it and say so.
4. **Timestamps are evidence, and cheap.** `ui.json` older than `index.html` was the entire
   diagnosis of the first red check.

## Rules earned in session 30

12. **A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the claim.**
    `total 🔒 === 1` meant "a two-chapter storyline"; it broke on a six-chapter chain while the
    product was correct. Count by element KIND (the chapter-card overlay and the full-story row are
    different elements), or assert the specific element the claim is about.
13. **A guard whose scenario matches nothing may never reach the branch it tests.** `loadSavedList`
    returns early on an empty filtered list, so a "this must NOT be shown" check written with a
    filter matching nothing passed under its own revert. A negative assertion needs a positive one
    beside it proving the render got that far.
14. **Identity must be CARRIED through a projection, never recovered by hashing it.** Third time:
    `v75_f` (a storyline rebuilt because its stored id was not the hash of its chapters), `v76_e`
    (a storyline unrecognised because its chapter list was filtered before it was matched). If a
    list is filtered and then matched back against its source by length or position, the filter and
    the match are the same bug waiting.

(If you add a new standing rule, append it here so the next session inherits it.)
