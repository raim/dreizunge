# HANDOVER — v78_e

One page. Session 32 shipped **`v78_b`** … **`v78_e`** from the `v78` cut. **Read
`build_history/roadmap_v78.md`** next for the queue and the session protocol, then `INTERNALS.md`,
then `build_history/v78_session32_notes.md` (session 32) and `build_history/v77_session31_notes.md`.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **196 checks, ALL PASSED** |
| `node test/run.js --quick` | 172 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v78_e'`. Corpus: **309 topics, 87 storylines**. Establish this before changing
anything.

**These numbers are the ones to trust.** Session 30's prompt said 170/149, session 31's said
182/158, session 32's said 192/168; each was right for the tree it was written against and stale by
the time it was read. **If a prompt and this file disagree, measure — and check timestamps first.**

## ⚠️ On a data drop: the guards fire, but the FIXERS ARE NOT A DIAGNOSIS

Both data-sensitive guards go red when the user's data files arrive, and each has a documented
one-line remedy. **Running the remedy destroys the evidence** that says whether the remedy was
right. Session 32 hit this twice; `v78_session32_notes.md` §1 is the long form. Short form:

- **Check three cheap things first** — corpus counts (`topics` / `storylines`), file **mtimes**
  (a file just rewritten by a fixer is the NEWEST; if `lessons.json` is the oldest, no fixer ran),
  and the hash `unit-static-freshness` names.
- **ORDER MATTERS.** `node backfill-script.js --write` **first**, `node build-static.js` **second**.
  Rebuilding first bakes the unstamped corpus and overwrites the only surviving copy of the
  previous baked state.
- **Diff the baked corpus against disk before rebuilding**, so a rebuild cannot lose user content.
  At the `v78_b` baseline the shipped `lessons.json` was the user's NEWER file and `docs/` was a
  corpus behind it: **7 topics had an `ai_error_hunt` lesson the published build did not.**
- **The script stamps are lost on every round-trip.** The same two `sr` topics came back unstamped
  at both drops this session: the backfill runs in the container, the user runs from their own copy,
  so `backfill-script.js --write` is a per-drop step, not a one-off repair.
- Sometimes **the test is wrong, not the product** (the `v78` cut's `unit-mixed-unlock-reachable`).
  Expect one or two per drop and diagnose rather than re-pin.

## ⚠️ Writing docs: NEVER put emoji in a Python string literal

Session 32 truncated `roadmap_v78.md` **to zero bytes** by writing a heredoc containing `\ud83e\uddf9`
surrogate escapes — the write threw mid-flight after opening the file. `unit-roadmap-version`
caught it on the next run and the file was restored from the packaged `v78_b` zip, but the
re-application cost real time. **Write emoji-bearing doc blocks via a `cat` heredoc to a temp file
and splice that file in**, never as literals inside the script doing the splice.

## What session 32 shipped

**`v78_b`** — a synonym/antonym question states HOW MANY words to find ("3 similar to Haus").
`syn_select` is the only multi-select exercise in the app, so it is the only one where "have I
finished answering?" is a real question, and there was no signal at all. Counted from `ex.correct`,
the same array `check()` scores against. **New `_n` keys, not reworded old ones** — the translate
pass keys off MISSING, not CHANGED. Plus **`unit-roadmap-version`**, retiring a protocol note that
had gone stale four times.

**`v78_c`** — `translate-ui.js --langnames` crashed on the first REJECTED name (`isBlocking` takes
the whole issues ARRAY; it was called as a per-item predicate). **Unreachable on the happy path**,
so the mode's own guard stayed green — the `v76_c` shape again, in the same mode.

**`v78_d`** — conjugation MCQ distractors are now OTHER FORMS OF THE SAME VERB, and the question is
not padded to four. The old pool was a shuffled UNION with every other verb's forms, so `essere
(voi)` was offered `siete / parli / parla / parlano` — three of four from `parlare`, answerable by
stem-matching without touching the paradigm.

**`v78_e`** — clear progress for ONE CHAPTER, via a shared **`_clearChapterProgress(topicKey)`**.
**Found on the way: `clearLessonProgress` was a THIRD copy of the wipe carrying the exact `v77_s`
defect** — no `chapterDone`, no `storyShown` — so clearing from the lesson-set page left the chapter
still reading "finished". All three entry points now share one rule, and the guard asserts PARITY
between them rather than each in isolation.

**⚠️ One group-B note was RETRIAGED and needs the USER:** the *"`Übersetze: ` prefix in the
sentence-translation read-out"* item presupposes a read-out that **does not exist** — every speech
call site was enumerated; the word-order exercise has no speaker control and no auto-speak. It is
either a request for a NEW source-language question read-out or it is about another screen.
**Ask before building.** Session-32 notes §3.

## ⚠️ Open questions the USER owes an answer to

- **Where exactly the auto-read moves** (ruled: to the card before comprehension lessons, nowhere
  else; a screenshot is coming). Roadmap "session 32 batch" → §0c. **Do not guess the card.**
- **"Inside error / AI-error-hunt lessons"** in the clear-progress note: the CHAPTER wipe, or
  resetting just that lesson? The two remaining placements wait on this.
- **Is a Latin-script `sr` UI intended?** The returning `ui.json` translates `sr` fully (612 keys)
  and it is **100% Latin, zero Cyrillic** — plausible, but `sr` is the digraphic language and the
  user has just built a Latin→Cyrillic storyline, so it is worth confirming rather than assuming.
- **`hr` is still 0 keys**, and the other 30 languages are still missing the same 14–16 accumulated
  `en`-only keys.

**Still open in group B:** the **teacher-mode switch at the bottom of every page**, the two
remaining clear-progress placements (storyline-page chapter cards; error lessons), and the word-form
highlighting item, which belongs with §0e/§3 and the ONE shared matcher.

## What session 31 settled — §0b DONE, and §0c STARTED

**`v77_v` shipped §0f** (the story is read aloud when it unlocks — muted stays muted, once per
chapter, never interrupting speech in progress) and **`v77_u` shipped the APOSTROPHE fix**: 17
vocabulary words across 13 chapters now match that never could, folded as Unicode machinery rather
than a table.

**`v77_t` shipped §0g's code half:** a repeated comprehension lesson asks only the questions not yet
answered correctly, and Next restarts that lesson while any remain. **§0g's model-prompt change is
still OWED BY THE USER** (needs a live model). Next up was agreed as the **apostrophe fix**
(U+0027 vs U+2019) as a quick standalone release.

**`v77_s` (user):** wiping progress now clears the **`chapterDone` stamp**, so chapters re-lock and
the storyline bar empties — both of the user's first two notes were that one bug. Summaries moved
into the standard read-aloud field. **⚠️ And a RETRACTION: `v77_p`'s below-mark re-ordering is
unreachable while any lesson is unfinished** (`nextLessonIdx >= 0` is tried first), so it is not
what fixes the reported replay. **Open: why `_firstUnfinishedLessonIdx` returns -1 while an unplayed
comprehension lesson remains.** Prime suspect is its first line, `if (setComplete(d)) return -1;` —
a chapter that reads COMPLETE stops the search, and `chapterComplete` trusts the cached
`chapterDone` stamp that `v77_s` found surviving a wipe. **The `v77_s` fix may already have cured
it**; the user is watching for a recurrence. Full note in INTERNALS §2.

**`v77_q` (user):** the next-chapter card is now the STARTER for chapters 2..N (summary, header,
storyboard, bars) and the entry card is chapter one only; and **all five progress cards render an
identical header**, matching the storyline page, from one `_cardHeader(prefix)`. **Any new card page
must call it** — markup parity is not header parity, as the first attempt proved.

**`v77_p` (user):** Next opens UNPLAYED work before a coverage replay (it was sending learners into
replays instead of the comprehension questions); the story PREVIEW panel is gone entirely (locked
means locked, vocabulary only); the headline fraction counts **unlocked chapters, not lessons**; and
the entry card shows the real progress bars. **⚠️ Owed: the ordering claim in the first item does not
discriminate under revert** — `unit-story-unlocked-page` §6 records why, and it needs chasing.

**`v77_o` (user):** the entry card matches the other cards and now opens the STATIC build too
(`build-static.js` re-implements `loadSaved` — **rule 15, third time**); the finished card hydrates
chapters that the LIVE list projection ships without `story`; and **Next is never greyed** — below
the mark it leads to a coverage-short lesson, so a mixed round re-samples toward what is unsolved.

**`v77_n` (user):** the card header now spans the column like the storyline page's —
`.card-screen` needed `align-items:stretch`, because the card screens ARE the centring `.screen`
while the storyline page nests its content in a full-width `.sl-screen`. **Any new card page needs
`.card-screen` for this reason too.** The progress message also moved below the play buttons.

**`v77_m` fixed three things the user found in a browser pass:** the card's row order now mirrors the
storyline page (title+bar → storyboard → chapter bars → story+vocabulary → icons → buttons); the
story-finished card no longer fires on a **stale `chapterDone` stamp** (it now requires the
done-flags, and an unverifiable chapter counts as NOT done); and the story-unlocked page highlights
vocabulary like the card panel does.

**`v77_l` shipped §0d and ruling 1.** The card now reads verdict → **story** → its words → then the
storyboard, bars, icons and actions. `v74_l`'s hide-list is retired: Replay is always available and
Next is no longer the only route out. Measured: exactly 8 of 32 rows changed, as `v77_e` predicted.

**`v77_k` (user-requested):** every page of the walk now shares the storyline page's 540px column
via `.card-screen` — **the four pages added in `v77_f..v77_j` had no width rule at all** — and the
summary card is the **actual entry point**: opening a chapter shows it first and its forward starts
the lesson. Skipped when there is no summary, and after the next-chapter card so interstitials
never stack. **Add `.card-screen` to any new card page**, or the width jump comes back;
`smoke-render` asserts all five wear it.

**`v77_j` shipped the story-unlocked page — the walk is COMPLETE.** Shown once per chapter when the
prep gate flips; the progress card's own story panel stays, per the user's "sits beside it" ruling,
and is asserted to stay.

**`v77_i` shipped the next-chapter-unlocked card** — finishing a chapter now names what it opened
before carrying the learner in. Same destination, one page in between.

**`v77_h` shipped the summary card** — §0c's first page — and with it the first link of the
navigation spine (`comp-prev`, a NEW id: `comp-back` stays deleted). Hidden when the storyline has
no summary, so it never leads to a blank page.

**Ruling 2a is CONFIRMED by the user's browser pass:** the 🎉 card appears only on genuinely
finished stories. The narrower gate is the ruling — do not widen it.

**`v77_g` renamed the preview panel** to `comp-story-panel`, freeing the name for §0c's real
story-unlocked page. Pure rename, measured. `unit-card-consistency` now sweeps for the old id — a
half-done rename is invisible otherwise, since the stub auto-vivifies any id.

**`v77_f` shipped the story-finished card** — §0c's last page, built first because ruling 2a forbids
deleting `v74_o` until it exists and Next reaches it. New `finished-screen`: the whole story as
collapsible chapters, the cumulative vocabulary learned, back to the progress card, onward to the
storyline. **Ruling 2a was applied to ONE path deliberately:** the terminal branch also fires for a
learner who finished the LAST chapter with earlier ones unplayed, where a celebration would be a
lie — that case keeps `v74_o`'s hand-off. Both halves are clicked and revert-verified. **Say if you
want the card in both cases.**

**Still to build in the walk: summary (its FIRST page), story-unlocked, next-chapter-unlocked**, and
the back/next spine. §0h (back/next on the QUESTION cards) remains its own session.

## What session 31 settled — §0b is DONE, both halves

Opened GREEN at 182. Two releases, `v77_b` and `v77_c`, both revert-verified.

- **`v77_b`** — the **7 swallowing `catch(_) {}` blocks in `showComplete` are visible.** Each reports
  site+message to a per-render ledger (`_cardErrors()`); `APP._cardStrict = true` rethrows at the
  site. **Default behaviour unchanged.** Measured after: **0 swallowed errors across 1216 renders
  over all 304 topics** — the catches hide nothing today, so this is a net for the rework. The
  `probe_gates_v76` truth table diffs identical.
- **`v77_c`** — the **coverage key-space question is SETTLED: a seeding artefact, not a bug.**
  Coverage reads ITEM keys (`v74_c`), the v76 probe seeded QID keys, and the two spaces are
  **disjoint** (61 vs 24, 0 shared). `markSolved` writes both; a learner driven through the real
  solve path converges 62→95→95→100 and unlocks in **4 rounds** (builders sample, so replaying is
  the designed way up). New guard drives the real path instead of seeding.

## ⚠️ A correction session 31 found — read before starting §0c

**`comp-back` DOES NOT EXIST.** 0 occurrences of `id="comp-back"` in `index.html` and
`docs/index.html`. It was **deleted in `v71_k`** (`#comp-hdr`'s title is the route back), and
`unit-card-consistency` asserts its absence deliberately. The gate table showed it because
**`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story` is the same.

So §0c's *"already there and already dead — revive or replace"* is backwards: **the navigation spine
must be BUILT**, and reusing that id means updating the guard too. Also: **`comp-story-unlocked` is
the whole bordered PANEL**, not a label — the §0c rename touches a container and its four children.
Both `v76_card_gates.md` and roadmap §0c have been corrected in place.

## Standing rules worth re-reading (25 now, in `roadmap_v78.md`)

1. **A probe must call the product function, never a re-typed copy.**
2. **A claim is only measured if the assertion touched the thing being claimed.**
3. **A non-vacuity check must run on the data the assertion actually runs against.**
4. **A headless harness building `APP.savedList` from whole topics is testing STATIC mode.**
5. **(new, 12)** A test that hard-codes a COUNT of a repeated element pins the fixture, not the claim.
6. **(new, 13)** A guard whose scenario matches nothing may never reach the branch it tests —
   `loadSavedList` returns early on an empty list, and a negative assertion passed under its revert.
7. **(new, 14)** **Identity must be CARRIED through a projection, never recovered by hashing it.**
   Third instance (`v75_f`, `v76_e`). If a list is filtered and then matched back against its source
   by length or position, the filter and the match are the same bug waiting.
8. **(new, 15)** **A fix to the client is not a fix to the published build.** `build-static.js`
   re-implements part of `index.html` (`loadSavedList`, `savedItemHtml`). The `v76_e` guard passed
   for two releases while `docs/` stayed broken. Assert against `docs/index.html` —
   `loadClient({ file })` drives it under the same harness.

## Next session — START HERE

### 1. The user's testing notes are ALREADY TRIAGED — see roadmap "USER TESTING NOTES".

Session 31 triaged the batch into five groups (A fixed, B small, C prompt work, D needs
reproduction, E larger features). **Start from group B** — small, self-contained, and each one
names the trap to avoid. The user may have more notes since; triage those the same way.

### 1b. How that triage went, if more notes arrive

The user tested heavily across this session and has collected more notes than one session should
swallow. **Do not start §0e/§3 or §0h before reading them.** Expect the same pattern this whole
session followed: most items are small, several are the same bug seen from different angles, and one
or two will turn out to be measurement artefacts rather than defects.

What worked, and is worth repeating:
- **Measure before believing the report OR the code.** Four of five findings in
  `v76_card_gates.md` were seeding artefacts; two of the user's own notes turned out to be one bug
  (`v77_s`); and one of my own fixes turned out to be unreachable dead code (`v77_p`, retracted in
  `v77_s`). A browser symptom and its cause were rarely the same thing.
- **Group before fixing.** "Bar fully green" and "wipe doesn't re-lock" looked like two items and
  were one stale `chapterDone` stamp.
- **Say so when a fix is unproven.** Two guards this session could not be made to discriminate;
  both are labelled in-place rather than left to imply protection they do not give.

### 2. One OPEN DEFECT the user is watching for

`_firstUnfinishedLessonIdx` can return -1 with a lesson still unplayed — full note in INTERNALS §2,
including the prime suspect and the debugging trap. **`v77_s` may already have cured it.** If the
user reports it again, that note is the starting point.

### 3. Then the remaining queue

- **§0e's ordering half + §3 highlighting**, sharing ONE matcher. **Needs re-planning, not
  implementing:** the roadmap records that the v75 plan was measured twice and is wrong. `v77_u`
  already fixed the apostrophe half of that area.
- **§0h — question navigation.** Its own session: `C.cur`, `check()`, per-run answer state, and
  `_speakAndAdvance`, which today advances in one direction only.
- Smaller, still open: §3b (the Android English voice), §5 (`_sbChapterTarget`), §6 (the
  storyline-page TTS selector), and the RECOVERED items carried since v71.

### 4. Standing tools built this session — use them

- `_cardErrors()` — assert it is empty after any card render you add (`v77_b`).
- `probe_gates_v77.js` — re-run and diff after every card change. Do NOT use
  `v76_card_gates.md`'s table; `v77_card_gates.md` is the corrected one.
- `_cardHeader(prefix)` — **every new card page must call it**, and must wear `.card-screen`.
  Markup parity is not header parity (`v77_q`) and id parity is not width parity (`v77_n`).

## Owed by the user, not doable in a container

- **A browser pass**, now including `v76_e` — see "how to see it work" in the session-30 notes.
- **Confirm the `v76_e` product judgement**: filtering the library to one language now shows a
  mixed-language storyline **whole**, including its chapters in other languages. The alternative
  leaves *"the lessons in a different language didn't show up"* unfixed. Say if you want it reversed.
- **The Android English voice.** `v74_j` fixed only the case where the exact locale is PRESENT; with
  no `en-GB` installed the ranker falls through to quality alone and a NETWORK `en-NG`/`en-IN` beats
  the LOCAL `en-US`. The obvious fix is barred by the design principle — choose between
  `voice.default`, `navigator.language`, or shipping §6's selector so you pick once.
- **The pass mark.** `Churros` is 40 items where it was 83 questions, and an item is solved by ANY
  correct answer, so 80% is a materially lower bar. Needs a browser pass, not a code change.
- **`translate-ui.js --langnames`** — `languages.json` name cells still empty. The last real run
  reported **119 missing of 1024**: `lb` 31, `sr` 32, `hr` 32, and 2 each (`sr`/`hr`) for 12 other
  languages. **`v78_c` fixed the crash that ended that run**, so it can be re-run; it saves per
  batch, so an interrupted run keeps its progress.
- **`sr`/`hr`**: the `ui.json` pass is **DONE for `sr`** (612 keys, arrived session 32) and **still
  owed for `hr`** (0 keys). Also still owed: the 28 non-English `names` entries, and a
  **native-speaker check of the `cyrillic-sr` table** — authored in-container, the exact case the
  design principle warns about. **Worth confirming: the returning `sr` UI is 100% LATIN script,
  zero Cyrillic.** Plausibly intended, but `sr` is the digraphic language and the user has just
  built a Latin→Cyrillic storyline.
- **The translate pass** for `complete.words_solved` and `form.finish_mixed` (`en`-only). `t()` falls
  back through English meanwhile. **`v71_q`: never assert a dropped key absent.**
- **The comprehension QC checker** — needs a new prompt and a live model.

**`en`-only keys owed to the translate pass.** The 30 already-translated languages are each missing
**14–16** of the current 617 `en` keys; `sr` is complete as of the session-32 drop and `hr` has none.
The named ones:
- **`v78_e`** — `chapter.clear_progress`, `chapter.clear_progress_confirm`,
  `chapter.clear_progress_done`.
- **`v78_b`** — `ex.syn.q_synonyms_n`, `ex.syn.q_antonyms_n`. **Both carry TWO placeholders — a
  translation that drops `{n}` loses the feature for that language.** The uncounted `ex.syn.q_*`
  keys stay as the fallback: **do not delete them.**
- **`v77_k`** `summary.start`; **session 30** `form.script_pick`; **`v77_f`** `finished.title`,
  `finished.vocab`, `finished.next`, `finished.back_card`.

`t()` falls back through English meanwhile. **A test asserting a key is "en-only" is correct while
the key is NEW and wrong once it has been translated** — `unit-syn-count` §5 still asserts it and
will need flipping to "no language holds the English string verbatim" after the next pass.

## Known, not fixed

- **`_tryOpenStorylineByChainId`'s legacy fallback** rebuilds chains through `makeParentResolver`,
  which is **same-language guarded**, so an old bookmark carrying a pre-`v76_e` synthetic `c…` id
  cannot be resolved for a mixed-language chain. No new `c…` ids are produced after `v76_e`.
- **`_sbChapterTarget`** (`index.html` ~8065) — the last known instance of the raw-lessons pattern.
- **The storyline-page TTS selector** — `ids = ['ls']`, the `-sl` elements are gone, but the
  function's existence check still looks for `tts-lang-select-sl`. Also dead: `#tts-row` /
  `buildTtsSelector()`, permanently `display:none`, still rebuilt on every lesson-set entry.
- **The two language menus should eventually be GENERATED from `languages.json`** — they are
  deliberately ordered differently, so generating would silently reorder a user-visible menu.
  `unit-lang-menu-coverage` makes the duplication safe meanwhile.
- **The import dedup's title-based tie-break** still decides which copy of a duplicated chain
  survives on a non-content signal (`v75_f`). No longer reachable from the import path.
