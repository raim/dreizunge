# HANDOVER — v77_p

One page. Read `build_history/roadmap_v77.md` next for the queue and the session protocol, then
`INTERNALS.md`, then `build_history/v77_session31_notes.md` for what session 31 found.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **188 checks, ALL PASSED** |
| `node test/run.js --quick` | 164 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v77_p'`. Establish this before changing anything.

**These numbers are the ones to trust.** Session 30's prompt said 170/149 and session 31's said
182/158; each was right for the tree it was written against and stale by the time it was read.
**If a prompt and this file disagree, measure — and check timestamps first.** The data files
(`lessons.json`, `ui.json`, `learners.json`) travel separately from the code and routinely arrive
newer. Session 31 opened green with newer data files, because session 30 had already run the
backfill and the static build after its own data drop.

**If `unit-script-choice` fails saying topics are unstamped, run `node backfill-script.js --write`.**
**If `unit-static-freshness` fails, run `node build-static.js`.** Both are the guards working.

## What session 31 settled — §0b DONE, and §0c STARTED

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

## Standing rules worth re-reading (18 now, in `roadmap_v77.md`)

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

## Next session — in this order

**CONTINUE §0c — the walk, backwards from the card that exists.**

`v77_f` built the LAST page (story-finished). Build the rest against it:

1. **The summary card — the walk's FIRST page.** Story summary in the SOURCE language, progress
   bars empty, shown before any question of that chapter.
2. ✅ **ALL FIVE PAGES OF THE WALK NOW EXIST** (`v77_f`/`h`/`i`/`j`). The user ruled that the
   story-unlocked page **sits beside** the progress card's panel, and a guard asserts the panel is
   still shown. What is left in §0c is the spine's REACH, not its pages. ✅ **The rename is DONE (`v77_g`)** —
   the preview panel is now `comp-story-panel`, so that name is free. Proven a pure rename: the
   gate table diffs identical in every state cell.
3. **The back/next spine joining them.** `comp-back` DOES NOT EXIST — it was deleted in `v71_k` and
   `unit-card-consistency` asserts its absence deliberately. **Build it; do not revive that id**
   without updating that guard. `showStoryFinished`/`finBackToCard` show the shape: handlers
   assigned in JS (rule 22), destination resolved through the one shared target.

✅ §0d and ruling 1 are DONE (`v77_l`). What remains: **§0e's ORDERING half** (vocabulary ordered as
the words appear in the story — belongs with §3 and ONE shared matcher), the **apostrophe fix**
(U+0027 vs U+2019, a plain defect, ships independently), and **§0h** (back/next on the QUESTION
cards), which is its own session — it is a question-runner change touching `_speakAndAdvance`.

**Tools built this session, use them:**
- `_cardErrors()` — assert it is empty after any card render you add (`v77_b`).
- `probe_gates_v77.js` — re-run and diff after every card change. It stayed identical across
  `v77_b` and `v77_f`.
- `v77_card_gates.md` — the corrected table. **Do not use `v76_card_gates.md`'s table.**

**§0a's last section still applies.** Six of the eight files that assert on `showComplete`'s source
text are untouched and still owed their behavioural replacement. `v77_f` did two of them:
`unit-learner-nav` §3's pins were DELETED (a regex cannot express where Next goes) and
`unit-story-unlocked-card` §7 was UPDATED because it was already behavioural. **Do not re-pin.**

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
- **`translate-ui.js --langnames`** — 151 `languages.json` name cells still empty (`sr`/`hr`, and 31
  for `lb`). It now saves as it goes, so an interrupted run keeps its progress.
- **`sr`/`hr`**: the `ui.json` pass, the 28 non-English `names` entries, and a **native-speaker check
  of the `cyrillic-sr` table** — it was authored in-container, the exact case the design principle
  warns about.
- **The translate pass** for `complete.words_solved` and `form.finish_mixed` (`en`-only). `t()` falls
  back through English meanwhile. **`v71_q`: never assert a dropped key absent.**
- **The comprehension QC checker** — needs a new prompt and a live model.

**New `ui.json` keys owed to the translate pass:** `summary.start` ("Start learning") from `v77_k`; `form.script_pick` = "Script…" (session 30), plus
four from `v77_f` — `finished.title`, `finished.vocab`, `finished.next`, `finished.back_card`. All
`en` only; `t()` falls back through English meanwhile.

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
