# Dreizunge roadmap — v80

*Cut at `v80` (end of session 34). The v79 line's SHIPPED table stays in `roadmap_v79.md` — this
file carries the protocol, the standing rules and everything still OPEN, so a fresh session reads
one roadmap and not two. Shipped rows for v79_k…v80 are in `roadmap_v79.md`; nothing in it is
superseded, it is simply history now.*

## ⚠️ Session protocol — READ FIRST

Unchanged from `roadmap_v75.md`. Re-read its protocol block and its definition-of-done before
writing anything, plus **"Rules earned in session 28"** and **"Rules earned in session 29"** — eight
rules now, and each one cost a wrong finding.

Standing design principle: **no language knowledge in the code**, where *permitted* means Unicode
machinery or corpus statistics, not a hand-authored table.

### What is in this file, in order

| section | what it is |
|---|---|
| **OPEN AT THE v80 CUT** | the findings that govern the open sections, then `§0` / `§0i` themselves |
| **TRACK T** | the text-focused progress card — the user's current focus shift |
| **THE LARGER PLAN** | the folded `implementation_plan.md`. Cite it as `PLAN §X`. **A bare `§3` is this file's item; `PLAN §3` is Track C.** |
| **SHIPPED IN THE v80 LINE** | finished releases, newest first. History, not work. |

Standing rules are in the "Rules earned in session 28…34" blocks — read the **"⚠️ How the rules are
NUMBERED"** note before citing one.

---


## ⚠️ OPEN AT THE v80 CUT — read these first

> **✅ RESTORED at the v80 cut, RECONCILED at `v80_d`.** The two sections below
> (`# 0. THE PROGRESS-CARD REWORK` and `# 0i. LESSON GENERATION REWORK`) were **LOST when
> `roadmap_v80.md` was created** — the open block was carried from partway down `roadmap_v79.md`
> and these sat above the cut point. They were restored VERBATIM and deliberately left
> un-reconciled, and **the reconciliation has since been done**: see `§0i — RECONCILED` and
> `§0's other sub-sections` immediately below, which annotate them without editing them, so the
> original wording and the judgement about it stay separable. **Do not delete a bullet silently;
> that is how the reason for a decision gets lost.**

## ✅ FINDINGS THAT GOVERN THE OPEN SECTIONS BELOW

*The reconciliation layer over the two RESTORED sections, plus the one diagnosis a future session
would otherwise re-derive. These sit here, above `# 0.`, because they comment on it.*

**The release write-ups moved.** Nine of them accumulated in this position and are now in
**`# SHIPPED IN THE v80 LINE`** at the foot of this file, newest first. Nothing there is open; go
there for how something was built or why a guard is shaped the way it is.

### ⚠️ §C1's FIRST bug did NOT reproduce — and the near-miss is the finding

*"I browsed forward to the story card and back, solved no comprehension lesson, yet could proceed to
the next chapter."* **Not reproduced, and one plausible reproduction of it was an ARTEFACT I nearly
shipped a fix for.**

Two readings were tested and both died:

1. **`index.html:15493`** (`nextLessonIdx = -1` when the just-played lesson is the gated one) —
   its comment says the fall-through lands on the below-mark branch where Next greys out, and
   `v77_o` **deleted the greying**. That looked like a stranded gate. Measured: the below-mark
   branch catches it correctly and sends the learner back into the comprehension lesson. **No bug.**
2. **The done-flag write** is guarded by `_record = !(_lc.total > 0) || _lc.solved >= _lc.total`,
   where `_lc` is `lessonCoverage` — whose universe `v74_c` narrowed to SOURCE ITEMS, while
   `v71_s`'s rule is stated in QUESTIONS. **36 of the 102 gated lessons have an empty item
   universe**, so `!(total > 0)` is true and the flag is written however badly the round went. On
   12 of the 17 such chapters with a successor, a probe could answer everything wrong and walk to
   the next chapter.
   **That reproduction is an ARTEFACT.** All 39 empty-universe gated lessons are `error_hunt` /
   `ai_error_hunt`, never `comprehension` — and `startLesson` sets `C.isErrorHunt`, which the
   enclosing `if (!C._review && !C.isErrorHunt && !lesson._drill)` **excludes from the recording
   block entirely**. The probe reached the branch only because it built `APP.cur` by hand without
   that flag. **The fix was written, measured against the corpus, and then REVERTED** — for
   comprehension lessons both universes are populated, so switching to the question universe would
   have changed a working gate with no defect behind it.

**So the first bug is still open, and the next session should not re-derive these two.** What has
NOT been modelled is the user's actual sequence — *browsing* forward to the story card and back,
i.e. the summary / story-unlocked pages and the Back link, rather than playing a lesson. That is
where to look next.

**⚠️ `v81_j` (session 38): a third reading, actually driving the browsing sequence rather than
tracing it by hand — and it died too.** Two readings were tried, both against a chapter whose
comprehension lesson is genuinely unsolved and whose story has genuinely just unlocked (not a
hand-built shortcut), driven through the REAL `check`/`showComplete`/`showStoryUnlocked`/`loadSaved`
call chain via `lib-dom`, not simulated:

1. **The story-unlocked page round trip.** Finish the chapter's last prep lesson for real (a
   non-review `showComplete()`) → click Next, which opens `showStoryUnlocked()` (the literal "story
   card") → click "← Back", which re-renders the progress card via `showComplete(true)` (a REVIEW
   render — `C._review = true`, `C.lessonIdx` repointed to the last COUNTED lesson per the
   `showComplete(true)` contract) → click Next again. **Traced by hand first, and the trace looked
   dangerous**: `showComplete`'s "finish what you just failed" override (`v77_t`, the block that
   redirects Next back into a story-gated lesson with work left) is itself gated on `!C._review`, so
   it is SKIPPED on the post-Back render — but `_target` was already initialised to `nextLessonIdx`
   (from `_firstUnfinishedLessonIdx`, unaffected by review mode) before that guard is even reached,
   so the skip changes nothing. **Run, not just traced: Next correctly opened the comprehension
   lesson.** No bug.
2. **Cross-chapter browsing, in BOTH the live-style client and the STATIC BUILD** (`docs/index.html`
   — habit 4's own lesson, "run the suite in the staged release directory," applied here too, since
   static's `loadSaved` assigns `APP.lessonData` a direct REFERENCE into the module-level
   `STATIC_LESSONS` array rather than a fresh fetch each time, which looked like exactly the kind of
   thing that could leak state across chapters). Chapter A (a genuine LATER chapter of a real
   storyline, so `_isLaterChapter()` is true and the `v81_b` review-card path fires on return) →
   finish its last prep lesson for real → Next opens the story card → Back → browse away entirely to
   chapter B via `loadSaved(B)` → browse back to A via `loadSaved(A)`. **In both builds, returning to
   A correctly routed to A's still-unsolved comprehension lesson** (`_firstUnfinishedLessonIdx`
   re-derives cleanly from `APP.progress`, which is keyed by topic name and untouched by the
   reference-sharing — the shared-reference concern was real but turned out not to matter here,
   because nothing in this path MUTATES the shared lesson object, only the separately-keyed progress
   store). No bug.

**Two things ruled OUT, not narrowed down to:** neither the review-mode override skip nor a stale
`APP.lessonData`/global-target reference survives a return to the chapter. **What is still
completely unmodelled**: the "Back LINK" specifically (as opposed to the "← Back" button on the
story-unlocked page, which is what reading 1 exercises) — there may be a THIRD navigational element
this has not identified yet, and the exact click sequence remains unconfirmed since the user's
original report predates any of this detail. **Recommendation for whoever picks this up next: get
the exact click sequence from the user before writing a fourth reading** — three plausible
mechanisms tried and dying is a good reason to stop guessing and ask, not a reason to guess harder.

### §0i — RECONCILED against `PLAN §C5/D1.` Four measured findings.

**Nothing below is deleted; each bullet is marked.**

- **~~"BLOCKED on §1 (the pass mark)"~~ — the citation DANGLES.** `§1` resolves to
  `roadmap_v75.md` §1 (*"The pass mark — needs the USER, not code"*). In THIS file `§1` is
  `useFullChain`, which is **shipped** — so a reader following the citation lands on a closed item
  and concludes the block is unblocked. **The pass-mark item was never carried into
  `roadmap_v80.md`**; it survived only in the handover's "Owed by the user" (`Churros` is 40 items
  where it was 83 questions). **The blocker is real and still owed by the user.** Cite it as
  "the pass mark, session prompt → Owed by the user", not as `§1`. **Since `v80_d` it lives in the
  session prompt's §9**, `HANDOVER.md` having been folded in and deleted.
- **Bullet 3 (a real re-generate function) — SHIPPED in the v45 line, but NOT what the bullet
  asks.** `POST /api/storyline/recreate-lessons` + `_runRecreateJob` exist, wired to the storyline
  bottom row and guarded (`unit-recreate-ui`, `e2e-recreate`). But it runs a FIXED recipe (vocab
  gate + reinforcement) or an explicit tick-list; **it never reads the chapter's existing lesson
  types**, which is precisely what "regenerates the EXISTING lesson types with the same settings"
  means. **Still open — and cheap:** the server already accepts an `addTypes` list, so this is
  deriving that list from `topic.lessons[].type` rather than new machinery.
- **Bullet 1 (align the two "add lessons" surfaces) — the misalignment is REAL and STRUCTURAL, and
  it runs the opposite way to the bullet's assumption.** The storyline picker and the
  book-generation arc share `ADD_LESSON_TYPES`, whose comment claims *"the two can never drift into
  offering different sets"* — **but the PER-CHAPTER dropdown is a third entry point and is
  hand-written markup** (`index.html` ~1144), covered by neither that claim nor
  `unit-add-lesson-registry` (which guards the SERVER registry). **The drift is not hypothetical:**
  `v78_j` added grammar+conjugation to the per-chapter menu, `v79_h` added `intro_script` to the
  registry — **drift in both directions, one release apart, and neither added a guard.**
  The two also encode one capability in two shapes: reinforcement is a TYPE (`review`) in the
  registry and an OPTION (`sial-vocab-mode`) per chapter.
- **Which way the alignment runs:** the per-chapter menu ALREADY has the per-type options the
  bullet asks for (difficulty, vocab mode, math instruction). **The storyline picker is the one
  lacking them**, along with the per-type count. So `§C5`'s Generation Card inherits this, and a
  cheap standing guard — the per-chapter `<select>` against `ADD_LESSON_TYPES` — would close the
  drift on its own.

### §0's other sub-sections — status against the plan

- **§0a rulings 1 / 2a / 2b / 3** — user rulings, all still standing, all shipped
  (`v77_l`, `v77_f`, `v77_o`, `v77_u` / `v78_k`). Keep as the record of WHY; nothing to reconcile.
- **§0b** — both halves DONE (`v77_b`, `v77_c`).
- **§0c** — the walk is complete. **⚠️ SUPERSEDED IN PART by plan §C2**, which removes the
  **next-chapter-unlocked card** (`v77_i`) from the flow. §0c BUILT that page; §C2 deletes it from
  the path. **✅ RESOLVED — the user ruled MERGE, shipped as `v80_e`**: the entry card is generalised
  to every chapter and the unlocked card is deleted, so one starter card serves both items. The
  reversal is closed; see the `v80_e` entry at the top of this roadmap. Still open in §0c and unmentioned by the plan:
  the summary page is reachable by ← but **is not forced before the first question** (an entry-path
  change the user has not seen — ask first).
- **§0d** — shipped (`v78_n`, `v77_l`); `comp-drill` confirmed alive (`v77_d`).
- **§0e ordering** — DROPPED by the user; `PROGRESSIVE STORY REVEAL` replaces it at LOW priority and
  **the plan does not mention it at all**, so it stays open here and is the only home for it.
- **§0e vocabulary panel** — cumulative half done (`v77_f`); ordering half dropped with the above.
  **Still open and unmentioned by the plan:** include vocabulary that was the question or the
  correct answer in **synonym and word_forms** lessons.
- **§0f** — shipped (`v77_v`). **§0g** — code shipped (`v77_t`); the **model-prompt change is still
  OWED BY THE USER** (needs a live model). **§0h** — question navigation, fully open, wants its own
  session; the plan does not cover it.


# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)

**Principle, in the user's words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow
exists so that the student ends up understanding the text. "Complete cards" are renamed **progress
cards** and become the spine that guides a learner through a story.

**Read `build_history/v77_card_gates.md` before touching the card** — the CORRECTED truth table
(32 rows, both gate families) and `probe_gates_v77.js` to re-run and diff.
**`v76_card_gates.md`'s TABLE is superseded and must not be built on**: four of its five findings
were artefacts of state its probe never seeded. That file is kept only for its corrected findings
and the settled coverage question.

## 0a. RULED — session 30 (user). These are decided; do not re-derive them.

All three were answered by the user at the end of session 30, after walking through each one against
the code. **Two of them delete shipped, tested behaviour.** Where a rule is superseded, delete it and
its assertions rather than layering a new rule on top — that layering is what §0a existed to prevent.

### Ruling 1 — `v74_l` is SUPERSEDED as a mechanism; its intent survives

> **User: "move the actions below the text as §0d already wants".**

`v74_l` (`index.html` ~14891) hides `comp-repeat`/`comp-drill`/`comp-crossword`/`comp-back` by id on
a genuine learner unlock and forces `comp-next` visible, so the story is not crowded by four routes
back into practice. **Keep that intent, drop that mechanism.** The story leads because the actions
move BELOW the text (§0d), not because buttons are taken away.

Consequences, all of them required together:

- **The hide-list goes.** With it go the three §0d conflicts it caused: Replay becomes ALWAYS
  available (a learner must be able to reach 100%), `comp-back` is freed for the §0c navigation
  spine, and `comp-next` stops being forced as the single route out.
- The premise `v74_l` was written on is gone anyway: once the card carries a third progress bar,
  cumulative vocabulary and back/next, it is no longer the "quiet card" the rule assumed.
- ~~Measured support: `v74_l`'s hide-list is **barely observable today**…~~ **WITHDRAWN `v77_e` —
  that measurement was wrong.** It came from the unseeded v76 table, where those buttons were
  already hidden for unrelated reasons. Re-measured by neutralising the hide-list and diffing the
  whole table: it changes **8 of 32 rows**, hiding **three otherwise-live buttons in each** (repeat,
  drill, crossword), on exactly the genuine learner unlocks. **The ruling stands — it was made on
  principle — but expect a bigger visible change than §0a assumed.**
- **Nuance not to lose:** the hide-list already keeps Repeat while coverage is short
  (`_coverageLeft`) and hides it only at 100%. So *"a learner must be able to reach 100%"* is
  already satisfied today; Repeat disappears only AT 100%, never on the way there. The case for
  moving the actions below the text stands on its own — the story should lead — but it is not
  rescuing a stranded learner.

### Ruling 2a — `v74_o` is SUPERSEDED (scope CONFIRMED by the user, session 31)

> **User, after the `v77_f` browser pass: "🎉 card only on finished stories."**
>
> **SETTLED — the shipped behaviour is correct, do not widen it.** `showComplete`'s terminal branch
> fires whenever there is nothing left in this chapter and no next chapter, which INCLUDES a learner
> who finished the LAST chapter while earlier ones are unplayed. That case is **not** a finished
> story and keeps `v74_o`'s hand-off. The gate is `_storyAllChaptersDone(slCtx)`, and both halves
> are asserted by clicking in `unit-story-finished`. **Do not "simplify" this to always show the
> card** — the narrower gate is the ruling, not an implementation detail.


> **User: "superseded — the story-finished card is the answer to the dead end".**

`v74_o` makes "nothing left to do" a TERMINAL state: Next is relabelled ↩ and hands the learner back
to the storyline (or home), reusing `APP._compBack` so the header and Next cannot disagree.

§0c makes that same state a WAYPOINT — the **story-finished card** (full story collapsible, complete
vocabulary learned, festive icon) is the next page in the walk. Under `v74_o` that card can never be
reached by pressing forward.

**The dead end `v74_o` fixed is real and must not come back.** It existed because `v71_h` greyed Next
here while `comp-back` was hidden — measured on the shipped "Paella und Chaos" with both chapters
complete: `comp-next` `disabled=true`, `comp-back` `display=none`. The story-finished card is a
better answer to that dead end than the hand-off, but only if it is actually reachable: **do not
delete `v74_o` until the story-finished card exists and Next reaches it.**

### Ruling 2b — below the pass mark, Next LEADS; the destination card is inert

> **User: "next could lead to the next card in the walk, but with no button active" → clarified:
> ALL of that card's action buttons inactive.**

This supersedes **`v71_d`**, not `v74_o` — worth stating plainly, because §0a originally attributed
the grey Next to `v74_o` and that was wrong: `v74_o` is the release that REMOVED greying from the
terminal branch. The surviving grey Next is `v71_d`'s `_belowThreshold` branch
(`_nextBlocked = true; compNext.disabled = true; compNext.classList.add('locked')`).

New behaviour: below the mark, **Next is active and moves to the next card in the walk**, and that
card renders with **all of its action buttons inactive** until the mark is met. The learner can read
ahead; they cannot act ahead.

`v71_d`'s principle is PRESERVED and in fact strengthened: Next never silently repurposes itself
into Repeat or Drill. It always means forward. What goes is the disabled button, not the rule behind
it. Inertness becomes a property of the CARD, not a lock on one button.

### Ruling 3 — article noise is accepted; take the high-recall matcher

> **User: "article noise was 'ok for now' still stands. we may later add a LLM call to judge which
> exact vocabulary is covered by lessons."**

So the mark means *"something from your vocabulary occurs here"*, not *"you have learned this
word"* — recall over precision. Take **whitespace splitting**: `+782` marks corpus-wide, 96 chapters
improved, 8 on the screenshot chapter — accepting that 4 of those are the article `la`. The clean
composed option (`+60`, 0 articles) is NOT chosen.

Two useful consequences:

- **No article table is needed at all.** Whitespace splitting needs no article set, so the
  corpus-derived `es: el, la` / `it: il, la, l'` / `ar: ال` work — and its two Italian false
  positives (`reti`, `per`) and the threshold tightening they wanted — is **not needed for this
  ruling**. That is squarely better under the standing design principle.
- **Keep "also mark articles" reversible.** The user's phrase is "ok for NOW", and the stated
  intention is to revisit with an LLM pass judging which vocabulary a lesson actually covers. Build
  the matcher so precision can be raised later without redoing the display.

**✅ SHIPPED `v77_u`** — 17 words across 13 chapters recovered. ~~**Not part of this ruling, ship regardless:** the apostrophe bug.~~ Vocab stores `l'evoluzione` with
ASCII `'` (U+0027), stories use `l’evoluzione` (U+2019), so even an exactly-present word never
matched — 15 `it`, 7 `en`, 4 `lb` chapters affected. That is a plain defect, not a judgement.

Inflection (`mutazione`/`mutazioni`) still misses under whitespace splitting; it is Tier 2 and stays
open.

### What these rulings cost in tests — read before starting

Eight test files touch the superseded rules: `smoke-render`, `unit-comprehension-gate`,
`unit-coverage-threshold`, `unit-drill`, `unit-lang-placeholder`, `unit-learner-nav`,
`unit-story-unlocked-card`, `unit-vocab-articles`.

**Several assert on SOURCE TEXT, not behaviour** — e.g. `unit-learner-nav` matches
`/_nextBlocked = true;/`, `/compNext\.disabled = true;/` and the literal `_endLbl` line against the
`showComplete` source. When the rework changes that code these fail as text mismatches. **Do not
re-pin them to the new text.** Replace each with an assertion about what the learner can DO — the
whole point of rulings 1, 2a and 2b is behavioural, and a source regex cannot express any of it.
`unit-story-unlocked-card`'s "Next-only for learners" line is `v74_l`'s and goes with it.

## 0b. Do this FIRST, before restructuring

**Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible** (564 lines, `index.html`
~14212–14776). A throw in any of them leaves the card half-rendered with the suite green. Session 29
lost real time to a bug that *looked* like a swallowed throw and was not. A counter the harness can
assert is zero, or a rethrow under a test flag, is enough. One small release, revert-verified, before
any of the work below.

**✅ DONE `v77_b`** — the 7 catches now report to a per-render ledger (`_cardErrors()`), with
`APP._cardStrict = true` rethrowing at the site. Default behaviour is unchanged: a throw is still
swallowed, it is merely no longer invisible. Measured across the whole corpus at the `v77_b` cut:
**1216 renders over all 304 topics swallowed ZERO errors**, so the catches hide nothing today — the
ledger is a net for the rework, not a bug-catcher for now. Guarded by `unit-card-errors`, which also
asserts no empty `catch` survives in `showComplete`.

**✅ DONE `v77_c` — the coverage key-space question is SETTLED: a seeding artefact, not a bug.**
`topicCoverage` reads ITEM keys (`v74_c`); the probe seeded QID keys; the two spaces are disjoint,
so 0 of 86 counted. `markSolved` writes both, and a learner driven through the real solve path
reaches 100% and unlocks in 4 rounds. Full measurement in `v76_card_gates.md`; guarded by
`unit-mixed-unlock-reachable`.

## 0c. The sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

  **summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

**✅ WALK COMPLETE:** summary `v77_h` · chapter questions (existing progress card) · story-unlocked
`v77_j` · next-chapter-unlocked `v77_i` · story-finished `v77_f`. Every page exists and every link
is asserted by clicking. **What remains in §0c is the spine's REACH, not its pages** — see §0d for
the layout work, and note that the summary page is reachable by ← but is not yet forced before the
first question (a lesson-entry change the user has not seen).

**✅ The story-finished page SHIPPED in `v77_f`** — built first because ruling 2a forbids deleting
`v74_o` until it exists and Next reaches it, so the rest of the walk is downstream of it.
`finished-screen` / `showStoryFinished()` / `finBackToCard()`, guarded by `unit-story-finished`.
**✅ `v77_g` renamed the preview panel to `comp-story-panel`**, so the name `story-unlocked` is now
free for the real page. **Still to build: summary (the walk's FIRST page), story-unlocked,
next-chapter-unlocked**, and the
back/next spine connecting them. `comp-back` does not exist — the spine must be built (see below).

- ✅ **SHIPPED `v77_h`.** The **summary card is the FIRST page** in the back/next sequence, showing
  the story summary in the SOURCE language, with progress bars empty, before any question of that
  chapter. `summary-screen` / `showStorySummary()` / `sumForwardToCard()`, reached by `comp-prev`.
  **Note on scope:** it is reachable by ← FROM the progress card; it is not yet forced before the
  first question on lesson entry. That would change the lesson-entry path (`loadSaved`'s learner
  auto-start, v60) and is a UX change the user has not seen — **ask before doing it.**
- Back/next also walks **already-played chapters**, to revisit, replay, or complete vocabulary.
  Hint from the user: such buttons already exist in the teacher-only lesson-set view.
- A **"story finished"** card at the end: full story (collapsible), the complete vocabulary learned,
  and a festive icon.
- ~~**`comp-back` already exists and is hidden in all 32 measured rows.** Decide: revive or replace.~~
  **CORRECTED `v77_b`: `comp-back` DOES NOT EXIST** — 0 occurrences of `id="comp-back"` in both
  `index.html` and `docs/index.html`. It was deleted in `v71_k` (`#comp-hdr`, whose title is the
  route back, replaced it), and `unit-card-consistency` asserts its absence deliberately. The table
  showed it because **`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story`
  is the same. **There is nothing to revive — the spine must be BUILT**, and reusing the id
  `comp-back` means updating that guard too.
- **`comp-story-unlocked` does not mean what its name says** (it is the preview label, shown while
  locked whenever canGenerate or teacher is on). Rename before adding a real unlocked card.
  **Note (`v77_b`): it is the whole bordered PANEL, not a label** — `comp-story-unlocked-lbl` is the
  caption inside it, and `comp-story-text` / `-spk` / `-xlate` are its children. The rename touches a
  container, so it is a slightly larger change than "rename the label".

## 0d. Layout and navigation

- Move progress bars, lesson icons and the replay/drill/crossword/next buttons **BELOW the text** on
  all progress cards. ~~(Check `comp-drill` first — grey or hidden in all 32 rows; possibly dead.)~~
  **CHECKED `v77_d`: `comp-drill` is ALIVE — keep it in the row.** It was grey in all 32 rows because
  the gate probe never wrote the wrong-answer ledger it reads; with mistakes recorded it goes LIVE,
  and `unit-card-consistency` has asserted exactly that since `v71_h`. Note it is `hidden` on the
  unlocked-learner row today — `v74_l`'s hide-list — so ruling 1 restores it there.
- ✅ **SHIPPED `v78_n`** — the ✕ returns to the progress card of the lesson being played.
- ✅ **MEASURED ALREADY TRUE (`v78_n`)** — `v71_h` always shows Replay and `repeatForCoverage` falls
  back to the current lesson when nothing is coverage-short, so 100% stays reachable. No code
  change; asserted in `unit-card-0d` §5 so it cannot regress silently.
- ✅ **SHIPPED `v78_n`** — one row per post-unlock lesson on every card of the chapter, labelled
  with the lesson's own title (no new ui.json key).

## §0e ordering — DROPPED by the user (session 32), replaced by a LOW-PRIORITY idea

**User: "forget about the ordering for now."** The measured re-plan below stands as the record of
WHY; the three options are withdrawn and no ruling is owed. `v77_f`'s deck-then-lesson order stays.

**Replacing it, at LOW priority and explicitly "needs more thinking" —
`PROGRESSIVE STORY REVEAL`:** *"at a later point we may show the story but just HIDE all non-learned
vocab and progressively reveal the story."*

Not scheduled. Recorded so it is not re-derived from scratch, with what is already known about it:

- **It inverts the highlight.** Today the matcher answers "which spans are known"; this needs the
  complement, "which spans are not", over the same offsets. `v78_h`'s `_storyWordSources` is the
  right input — it already carries per-word learned/not-learned — so this is a consumer of that
  collector, not a new matcher.
- **The measurement that killed ordering is the one to check first here too.** 83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen; the question for reveal is the
  reverse — what fraction of a STORY's words are covered by ANY source. `v78_h` measured 1043 marks
  over 90 chapters, which is marks, not coverage. **Measure coverage as a share of story tokens
  before designing anything**: if a typical story is 10% covered, "hide everything not learned"
  hides the story, and the feature is a blank page rather than a reveal.
- **It is a reading feature, so the failure mode is severe.** A story panel that hides too much has
  no fallback the learner can reach — unlike a highlight, which is ignorable. Any design needs an
  escape (reveal-all toggle), and the read-aloud must be decided too: does TTS speak hidden words?
- Interacts with §0f/§0c (the auto read-out being moved) and with the finished card, which shows
  the whole story. **Do not design it before the auto-read move lands**, or the same page will be
  redesigned twice.

## §0e ordering + §3 highlighting — the measurement that produced the above

The roadmap said this pair "needs re-planning, not implementing", because the v75 plan was measured
twice and found wrong. Re-planned here against the current corpus. **Two of the v75 plan's premises
are now dead, one item is ready to build, and one needs a USER RULING.**

### What is already done, and was not when the plan was written

- **The apostrophe fix shipped** as `v77_u` (`_hlKey` folds U+0027/U+2019 and case on both sides).
  The v75 note listed it as "ships regardless, it is a defect not a judgement". It is done.
- **The article-set work is moot.** Session 30 ruled article noise ACCEPTED, so the corpus-derived
  `es/it/ar` article sets, the `reti`/`per` false positives and the threshold tightening are all
  unnecessary. `roadmap_v74.md`'s claim that `_articleStatsFor` already derives them was wrong, and
  it no longer matters that it was wrong.
- **A matcher already exists**: `_highlightVocabHtml` + `_hlKey`, with per-word boundaries applied
  only to spaced scripts (`v73_d`). Any "one shared matcher" is an EXTENSION of this, not a new one.

### ✅ SHIPPED as `v78_k` — §3's ruled half

`_highlightVocabHtml` matches a multi-token vocab entry only as a whole phrase. Measured just now:
`['la variazione genetica']` against a story containing exactly that phrase marks it, but a story
containing only `variazione` marks nothing. **Whitespace splitting is the ruled change** (`+782`
marks over 96 chapters, session 29's measurement) and it is still unshipped. Article noise is
accepted, so no filtering is needed. This is a self-contained release.

### DEAD PREMISE: "ordered as the words appear in the story" is undefined for most of the panel

The v75 note says story-ordering is "the same token-alignment problem, not a separate nicety", which
is why it was coupled to §3. **Measured against the corpus, that is true of a seventh of the data.**

Simulating the cumulative panel — every solved word across a storyline, matched against the chapter
story actually on screen, via the PRODUCT matcher, 612 entries over 12 multi-chapter storylines:

```
exact match in the shown story        82   13%
only a word-form / stem match         24    4%
absent entirely                      506   83%
```

Per storyline it is worse than the average suggests: `The Lion's Mischief` has **221 cumulative
words and 25 in the story**; `Nights in Cairo` has **0 of 23**. Sorting by story position would give
a 25-word ordered head and a 196-word arbitrary tail — or, for Cairo, change nothing at all.

**Why the plan and the data disagree: two releases made decisions that were never compared.** The
v75 ordering note assumed the panel showed the CHAPTER's vocabulary. `v77_f` then made it cumulative
across the deck (133 words vs 24, measured at the time). Each was right on its own; together they
make "order as they appear in the story" an instruction about 17% of the list.

**And word forms do not rescue it.** The v75 note's "greedy matching, to allow for word forms" is
worth exactly the 4% above (`preferenza`, `lezione`, `планина` — real, and a rounding error against
83% absent). Greedy stem matching is a genuine cost — it is the one part of this that risks marking
the wrong word — for four points.

### NEEDS A USER RULING before anything is built

The intent behind §0e's ordering half is sound: **connect the vocabulary panel to the story in front
of the learner.** Story-ORDER turns out to be a poor instrument for it. Three ways to serve the
intent, all using the SAME matcher (so the coupling to §3 survives, on better grounds):

**~~The three options below are WITHDRAWN — the user dropped ordering (see above). Kept only as the
record of what was measured.~~**

1. **Mark, do not reorder.** Keep the existing deck-then-lesson order and use the matcher to flag
   the panel words that occur in THIS chapter's story. Well-defined for 100% of the panel (each word
   either occurs or does not), reuses §3's matcher exactly, and the panel stops jumping around as
   the learner moves between chapters. **Recommended.**
2. **Two zones**: an ordered "in this chapter" head, then everything else in the current order.
   Delivers the v75 wording literally, at the cost of a panel that is 17% sorted and 83% not.
3. **Order by recency of solving**, ignoring the story. Well-defined for the whole panel and needs
   no matcher — but it abandons the story connection, which was the point.

Option 1 is what the measurement argues for; **the user should rule**, because "ordered as the words
appear in the story" is their sentence and the substitution is a product judgement, not a bug fix.

### Sequencing, once ruled

1. §3 whitespace splitting — ruled, measured, self-contained, no dependency on the above.
2. Extract the shared matcher to return MATCHES WITH OFFSETS rather than substituted HTML. Today
   `_highlightVocabHtml` does a regex replace and returns a string, so it can answer "mark this" but
   not "where, and in what order" — every option above needs the second answer. Highlighting then
   becomes a thin wrapper that wraps the offsets, which keeps §3's behaviour byte-identical and
   revert-verifiable.
3. The ruled §0e behaviour, on top of that matcher.
4. **The Replay ordering fix rides here** (session-32 batch): pick the LEAST-COVERED counted lesson
   rather than the first coverage-short one. It touches the same card. Independent of the ruling.

### Traps carried forward

- **`probe_gates_v77.js` must be re-run and diffed** after any change to the progress cards, against
  `v77_card_gates.md` (**not** `v76_card_gates.md`, which is superseded).
- **One matcher, not two.** `v77_f`'s finished card deliberately did NOT order, precisely so it
  would not disagree with a matcher that did not exist yet. Whatever ships must serve both that card
  and the progress-card panel, or the two will disagree about the same story.
- `_cardErrors()` empty after any card render, and `_cardHeader(prefix)` + `.card-screen` on any new
  card page.

## 0e. Vocabulary on progress cards — ⚠️ LARGELY SUPERSEDED by TRACK T

> TRACK T puts the highlighted chapter TEXT on every progress card, which subsumes a separate
> vocabulary panel. The still-open half below (include words that were the question or the correct
> answer in synonym and word_forms lessons) becomes a question about **which words get highlighted**,
> not about a panel. Read it that way; do not build the panel.

- **Cumulative per lesson-set**: every word the learner has already solved correctly, not just the
  current lesson's. **User screenshot 2 shows the panel EMPTY** on a comprehension card, because a
  comprehension lesson has no vocab of its own — so today the panel is blank on exactly the cards
  where the story is the focus. This is not polish; it is a blank panel.
- Ideally ordered as the words appear in the story (greedy matching, to allow for word forms).
  **Do this as part of §3, sharing one matcher** — it is the same token-alignment problem, not a
  separate nicety. **`v77_f` deliberately did NOT attempt it** on the story-finished card: ordering
  there before §3 exists would guarantee the two disagree. That card lists every solved item across
  the story in deck-then-lesson order (133 words vs 24 for a single chapter, measured), which is the
  cumulative half of this item done; the ORDERING half is still open.
- Include vocabulary that was the question or the correct answer in **synonym and word_forms**
  lessons.

## 0f. Story read-out — ✅ SHIPPED `v77_v`

~~**Auto-start a read-out of the story chapter when it is unlocked and shown on the progress card**
(unless muted).~~ Done; `_autoReadStory`, guarded by `unit-story-autoread`. Cheap now, and only because of `v75_h`: the old flat 4-second advance net would have
cut a story chapter to ribbons. Watch for cancel-races with the card's other speech — `v75_h` made
`cancel()` conditional, and that must not be undone here.

## 0g. Comprehension flow

- ✅ **SHIPPED `v77_t`.** ~~A wrong answer currently returns to the card; Replay then replays only
  the normal lessons.~~ Next is green and active (`v77_o`) and now **restarts that lesson** while
  questions remain; the repeat **asks only the questions not yet answered correctly**. Guarded by
  `unit-comprehension-repeat`, both halves revert-verified.
- **Still OPEN, needs the user:** the model prompt change below.
- Model prompt change (user, needs a live model — OWED BY THE USER): explanations must NOT quote
  story sentences literally; keep the explanation in the SOURCE language; if a quote is required,
  translate it; and additionally report the exact underlying quote in the TARGET language. Read out
  the explanation for CORRECT answers too — both the source-language explanation and the
  target-language quote.

## ✅ 0h. Question navigation — **SHIPPED at `v80_p`**

> `C.ans` ledger + `check(replay)` + `qPrev()`. The lock is per-run by construction. See the
> `v80_p` entry. Original scope note kept:

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

---

### 0. ~~the forked-storyline display~~ — SHIPPED as `v79_k` (session 34), ONE PART STILL OPEN

**Three of the four parts shipped; see the shipped table for `v79_k`.** The fourth — "shared
chapters count the same way for every fork" — **needed no code and was measured to be already
true**: completion is keyed by topic NAME and is storyline-agnostic, so a chapter both forks *list*
already moves both decks identically. `unit-fork-display` §6 pins that (and revert-verify confirms
it passes on the pre-change code, so it is a pin, not a fix).

**⚠️ STILL OPEN — needs a user ruling, the question raised at the end of session 34.** Where a fork
is ASYMMETRIC the intent is still unmet, and it is a DATA question rather than a rendering one. At
this cut: `sl_1041030875` ("Dough of the Ancients") lists exactly one chapter, "Grandpas Dough
Talk", which continues from "pizza dough" — a chapter that storyline does not contain. So from that
side there is no fork parent to branch from, no shared prefix on screen, and playing "pizza dough"
moves the *other* deck (`sl_182891979`) from 0/2 to 1/2 while this one stays at 0/1. **The choice:
add the shared ancestor(s) to the storyline's `chapters[]`, or have the display reach back across
the `continuedFromId` link without changing the data.** Do not pick one without asking.

**Also found while measuring, and separate from all of the above:** `_slProgressStats` computes
`unlockedChapters = doneChapters + (doneChapters < total ? 1 : 0)`, so **every single-chapter
storyline reads 1/1 and a 100% bar before anything is played** (`sl_1041030875` does today). That
is the `v77_p` "the chapter in progress counts" rule meeting a one-chapter deck. Not touched — it
is not a fork bug and changing a headline number wants its own ruling.

**The original item, kept for the record.** Four parts, all on the storyline screen:

- the forked storyline is shown **completely** — every chapter, not the truncated stub — and all of
  it greyed out as it is today;
- clicking **any** greyed chapter opens that alternative storyline, so the learner can switch
  between forks from either side;
- **shared chapters count the same way for every fork** — a chapter both forks contain must not be
  progress on one and nothing on the other;
- the `⑂A/B/C` marker becomes **nothing** for the currently open storyline and the **storyline
  TITLE** for the others, and the node itself is clickable.

It lands on the surface `probe_gates_v77.js` measures. **Re-run it AND diff against
`v77_card_gates.md`** — running it without diffing proves nothing (`v76_card_gates.md`'s table is
superseded). The progress-counting part is the risky half: it is shared state between forks, so
check what `_counts` and the gate probe say before and after, not just what the screen looks like.

### 0b. POSTPONED by the user (session 33): import "new" mode — a possible FUTURE feature

Was on the session-33 bug list, deliberately deferred: *"import lessons as json: we currently have
merge and overwrite options; add a third option 'new' that re-assigns IDs to the imported stories
and chapters, such that it doesn't overwrite existing stories."*

Kept here rather than dropped, with the reason it is a session and not an afternoon: an id
re-assignment has to rewrite `continuedFromId`, the storylines' `chapters` arrays and the fork links
**consistently in one pass**. Get any one of the three wrong and the import succeeds while producing
broken chains rather than fresh stories — a silent failure of the worst kind, because the damage is
in data the user then keeps. **Do not start it without raising it with me first.**

### 1. ~~`useFullChain` does not do what its label says~~ — RULED and SHIPPED as `v79_b`

**User ruling, session 33: make the label TRUE.** Shipped — see the shipped table for the full
entry, `v79_session33_notes.md` for the measurements and how the guard was built. The label and
tooltip were left untouched because they became true; the console lines now say `Story context:` for
the story prompt and `Lesson context:` for the lesson chain.

**What the item said, kept because two of its claims turned out to be worth carrying:**

The main-page checkbox reads *"Pass the full storyline as context — better continuity, slower
generation"*, and the request field is `useFullChain`. **It controlled neither.** In `generate()` it
chose only between the PARENT CHAPTER'S story in full and its last `OLLAMA_MAX_PREV_STORY`
characters. So `Continuing from: "…" (using full chars)` in the console meant **the whole of ONE
chapter**, not the chain, while the separate chain-wide line fed LESSON generation only.

Two things the item did NOT say, both measured at the ruling and both load-bearing:

- **For 128 of 236 corpus continuations (54%) the box changed nothing at all** — the parent chapter
  is shorter than the 800-char tail, so "full" and "last 800" are the same string. The defect was
  therefore invisible on more than half the corpus, which is why it took a user report.
- **The story call passed no `ctxTokens`**, so Ollama used its ~4096 default. The single parent
  never approaches it; the chain crosses it at p90. "Small in code" was wrong: sizing `num_ctx` and
  the timeout is part of the change, not a follow-up (rule v71_t), and the chain's own budget has to
  be derived from the context ceiling so the trim happens where chapter boundaries are known.

### 2. ~~One chapter's vocabulary is in the wrong script~~ — WITHDRAWN, it is a `reinforce` artefact

Corrected by the user at the cut. `tp_17863746762340000193` has a Cyrillic story and a Latin
vocabulary lesson, and that lesson's `_genMeta` carries `_arcMode: "reinforce"` — the mode that
re-trains vocabulary from EARLIER chapters, which were Latin because the user was deliberately
switching this storyline to Cyrillic. **Working as designed; nothing to regenerate.** The plain
lesson in the same chapter, from the same builder minutes earlier, is correct Cyrillic.
`unit-script-choice` lists the id as EXPECTED, not known-bad. See the planned rework below.

### 2. PLANNED REWORK — remove `reinforce` / `neutral` / `extend` (user, v79 cut)

**The user intends to remove the arc-mode option entirely.** Recorded here because it is now load
-bearing for two other things, and because a removal is the moment to decide what replaces it rather
than what it did.

**What it does today.** `_arcMode` on a generated lesson is one of `reinforce` (re-train vocabulary
from EARLIER chapters), `neutral`, or `extend`. It is the mechanism behind the arc "review" lessons
and is stamped into `_genMeta`.

**What it explains.** The mixed-script chapter found at the v79 cut
(`tp_17863746762340000193` — Cyrillic story, Latin vocabulary) is a `reinforce` lesson faithfully
reproducing vocabulary from the storyline's earlier LATIN chapters, while the user was deliberately
switching that storyline to Cyrillic. **Not a defect** — but it shows the mode has no notion of a
storyline changing script mid-chain, and no notion of transliterating what it re-teaches. Anything
that replaces it will meet the same question.

**Why the removal interacts with work already queued:**
- **The per-text learning scheme** (see "NEEDS DESIGN") is the natural replacement, and the user
  framed it that way: *"we probably already have a TODO on this (around extend/reinforce
  redefinition)"*. **Do not remove the modes first and design the replacement after** — `reinforce`
  is currently the only thing aiming lesson generation at anything other than the current chapter,
  and the coverage measurement (9.2% of story tokens) says aiming is the whole problem.
- **`unit-script-choice`'s `EXPECTED_MIXED` entry exists only because `reinforce` exists.** It
  should be deleted in the same change, and that guard's "the generator was never told which script
  to use" message re-read — with `reinforce` gone, a mixed chapter really would mean that again.
- **`v79_a`'s script pin on lesson prompts** was justified by evidence that turned out to be a
  `reinforce` artefact (see the shipped table). It is retained on `v76_h`'s original reasoning, but
  its interaction with `reinforce` is genuinely open: a pinned prompt tells the model to write
  everything in Cyrillic while `reinforce` hands it Latin vocabulary to re-teach. **For a
  script-switching storyline transliteration is probably what the learner wants; for every other
  storyline the two never disagree.** Nobody has measured which the model actually does. If the
  modes are removed this question disappears with them, which is a reason to sequence the removal
  before touching the pin again.

**Open, for the user:** what replaces `reinforce`'s one useful property — that some lessons
deliberately revisit earlier material. The per-text scheme's difficulty ranking could subsume it
(revisit = an easier band), but that is a design choice, not a consequence.

### 2z. RULING (user, at the v80 cut) — language x lesson-type applicability is MODEL-DECLARED

**Decided.** Whether a lesson type makes sense in a language (conjugation for Chinese, cases for
Italian, articles for Serbian) is **not a table the app ships**. The model declares it, the answer is
**cached in `languages.json` with `_genMeta`-style provenance**, and it is **ternary plus a note** —
`yes` / `no` / `different-mechanism` — never boolean. A **human override wins and is marked as such**.
Asked once, not per generation.

**The reason, kept because it is the argument and not just the outcome:** the original request
offered `ova/ovo` vs `taj/ta/to` as Serbian articles. Serbian has no articles — those are
demonstratives, and definiteness in Serbian surfaces through **adjective aspect** (`star`/`stari`),
a different mechanism on a different word class. The cell is neither true nor false, and the note is
more useful to the generator than the boolean would be. A boolean is wrong on its first interesting
cell.

This keeps the knowledge in the tier `INTERNALS.md` §4 assigns it to: the cache is a MEASUREMENT,
not an authored language claim — which is what distinguishes it from the `cyrillic-sr` sounds column
that was authored, verified and **reverted**, and whose absence `unit-intro-script` still guards.

**Guard:** a source sweep that fails when a lesson type has no applicability policy, mirroring
`unit-script-pin-coverage` (rule 32 — guard the enumeration). **Scope:** decides only whether a
lesson is OFFERED; lesson quality stays QC's problem. Full design in
`PLAN §9b/D1.`

### 2x. TWO BUGS DIAGNOSED AT THE v80 DROP — not yet fixed

**(a) A new book NEVER gets a generated storyline title.** The `v78_r` guard at `server.js:5348` —
*generate only when there is none* — is correct and is a user ruling. But the storyline record is
created earlier in the same flow at `server.js:5207`/`5215` with
`upsertStoryline({ id: slId, title: chain[0], … })`, and `chain[0]` is the FIRST CHAPTER'S TOPIC
NAME. **So a title always exists by the time the guard looks and the `generateStorylineTitle` branch
is unreachable.** Reported as `Storyline title: keeping existing "ein eichhoernchen trifft ein
murmeltier — 1"`. **Do not weaken the guard** — it exists because regenerating from the new chapters
alone replaced a whole-story title with one about its tail. Mark the placeholder instead
(`titleAuto: true`, cleared on generation or user edit). **Checked: `summary` is NOT seeded, so the
summary guard works and this is title-only.** Guard BOTH halves or `v78_r` re-opens: a new book gets
a title that is not its first chapter's name, AND an existing storyline gaining a chapter keeps its
title. Full write-up: `PLAN §9c.`

**(b) The vocab article asymmetry is a COIN FLIP, and the prompt contradicts itself.** `prompts.json`
`vocab.system` says `BASE FORM ONLY … (with the usual article where the language uses one)` — PER
SIDE, appealing to each language's citation convention — and three bullets later `ARTICLE SYMMETRY …
BOTH sides or NEITHER` — CROSS SIDE. German cites `der Hund`, French cites bare `chien`, so a model
obeying the first rule produces exactly the reported defect, and the first rule is stated first and
framed as definitional. **Measured on the v80 drop:** `tp_17869977371640000022` **7 of 8**
asymmetric, `tp_17869980065780000104` **0 of 8** — same model, same `_genMeta.type`, `rejected: 0`,
four minutes apart. **A self-contradicting instruction does not bias output, it makes it UNSTABLE**,
which is why it "seems to have got worse" and why **one lesson can never validate a fix**. Fix by
REMOVING the contradicting clause plus a worked counter-example (rule 31 — adding another
prohibition is what made it worse, the `v79_i` failure repeated), then measure a RATE per
`_genMeta.at` cohort. Full write-up: `PLAN §F3/`§F3c.

### 2y. THREE MORE RULINGS (user, at the v80 cut)

**(a) Observations log scope: BOTH — keyed by a stable LOCAL id that an account can later ADOPT.**
Unblocks `PLAN §8/B1`, which was waiting only on this. **Adoption is a LINK, not a
rename:** an account accumulates a SET of local ids (one per browser/device), and an observation's
identity key stays the local id permanently, with `userId` as a resolved attribute. Re-keying to a
`userId` would make a second device un-adoptable. Payment and accounts themselves remain open.

**(b) Uploaded images: STORED SERVER-SIDE.** **They must NOT go into `lessons.json`** — it is a
single file every test parses and `build-static.js` bakes wholesale; base64 pages would multiply it.
Store as files, reference by path. **`build-static.js` then needs a decision it does not have:**
static export either omits images (image-derived chapters degrade to text-only, said so in the UI)
or copies assets and rewrites paths. Retention also sharpens the licence question in §3 below — from
"may we display this" to "may we host it".

**(c) Duplicate storyline titles: SUPERSEDED — the user RENAMED one to "Dough of the Ancients 2".**
The original ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair (both sides rendering the same `icon + title`, so each link named the storyline the
learner was already in). **The rename fixes it at the source and is the better answer.** The
enumeration guard — for every fork, the marker must be distinguishable from the open storyline's own
label — is still worth having but is now **PREVENTIVE**: nothing in the data enforces unique titles.
`unit-fork-display` already sweeps forks. **The tree still holds the old titles; the next data drop
brings the rename.** Original ruling text, superseded, kept for the reason: Both `Dough of the Ancients` storylines keep the same title
AND icon. **This breaks the `v79_k` fork marker**, which renders the other storyline's `icon + title`
so the learner knows where a greyed branch leads — with both identical, each side's link names the
storyline the learner is already in, which is worse than the `⑂A/B/C` letters it replaced. **So the
display must tolerate duplicates:** fall back to the branch's first differing chapter name when the
labels collide. **Guard as an enumeration, not as this pair** (rule 32): for EVERY fork in the
corpus, the marker must be distinguishable from the open storyline's own label —
`unit-fork-display` already sweeps forks and can carry it. Half a session.

### 3. Owed by the user

- ~~Regenerate the lesson in item 2~~ — withdrawn, see above.
- `sl` is fully translated (617 keys) and `languages.json` is complete at 1089/1089 cells — nothing
  outstanding there.
- ~~The `cyrillic-sr` sounds column for the `latin` letter table~~ — **WITHDRAWN, and it was never
  owed.** The absence ENFORCES a `v75_g` ruling pinned in `unit-intro-script`: *"a Serbian reader
  must NOT be offered a Latin course: they already read it"*, Serbian Latin being co-official. A
  column was authored and mechanically verified at this cut (26 respellings, zero non-Serbian
  characters) and then **reverted** — adding it would have silently reversed that ruling, and the
  guard caught it. **If the ruling is ever reopened, `unit-intro-script`'s assertion changes first
  and the table is already written up in the session-32 notes.**
- The per-text learning scheme discussion. **Its prerequisite measurement is DONE** — see "THE
  COVERAGE MEASUREMENT".

## USER TESTING NOTES — session 32, second batch (screenshots) — TRIAGED

### ✅ Done in `v78_i`

- **Chapter auto-read REMOVED from the progress card, and added nowhere else.** *"This supercedes
  previous instructions on putting it somewhere else."* §0f (`v77_v`) and the brief re-scoping to
  "the card before comprehension lessons" are both **withdrawn**. `_autoReadStory` is KEPT — the
  story is still readable from the speaker control, and the helper carries the four restraints
  (muted, review renders, once per chapter, never interrupting) that a future caller would otherwise
  rediscover. **`unit-story-autoread` now asserts it has NO CALL SITE**, so the ruling is a property
  of the product rather than a fact about one commit; a next session reading three releases of
  discussion about where to put it will fail the suite instead of putting it back.
- **Conjugation: multiple choice strongly preferred over typing.** Typing is now a FALLBACK for
  forms that cannot be asked as an MCQ, not a second question layered on the same form. **This also
  fixed a real defect the new corpus exposed:** `mcq_conjugation` and `type_conjugation` share ONE
  qid (`infinitive|pronoun`), so emitting both put two exercises with one identity into a round.
- **Conjugation solution shows the WHOLE phrase** — `vi ste`, not `ste`
  (`tp_17862850223960000178`, screenshot). The read-out had combined pronoun and form since it was
  written, so the app SAID the full phrase while SHOWING half of it; the reveal now uses the same
  composition, so the two cannot disagree.

### ✅ Done in `v78_j` — the three small specified items

- **Restore the FULL lesson suite to the single-chapter "add lesson" menu**
  (`Screenshot_2026-08-10_00-58-41.png`). Grammar and conjugation were hidden from this
  single-chapter version and should come back; the screenshot shows Vokabeln, Synonyme/Antonyme,
  Wortformen, Fehlerjagen, Verständnis, Mathematik, Mischübung, Schrift lernen — **missing Grammatik
  and Konjugation**. Find the menu's type list and the gate that trims it; check whether the
  omission is a hard-coded list or a capability gate (the script entry is gated by
  `scriptLessonAvailableForSet`, so at least one is real). **No new i18n** — both types already have
  registry entries and labels.
- **`translate-ui.js`: `--threads` and `--batch` on the command line.** Threads may already exist as
  an env var; batch size is the hard-coded 10-per-batch. Goal stated by the user: **integrate
  completely new languages more efficiently.** Cheap, and `unit-langnames` already drives the real
  mode with a stubbed backend, so it is testable headlessly.
- **Add Slovenian (`sl`).** `languages.json` entry + `_langScript` mapping (latin) + a `names` cell
  in all 32 languages. **Check `unit-intro-script`'s "every language is mapped in `_langScript`"
  assertion** — an unmapped code reads as "no script", which wrongly makes a Latin course look
  teachable to its speakers (v53). The `--langnames` run that just completed filled 1024/1024 cells;
  adding a language makes it 33×33 and reopens 65 of them.

### THE COVERAGE MEASUREMENT — done, session 32. Read this before designing anything.

The roadmap has said for three sections that this number comes first. It is measured now, through
the PRODUCT matcher (`_highlightVocabHtml` + `_storyWordSources`, never a re-implementation), over
**120 corpus chapters with a story**, and it reframes the request.

**How much of a chapter's story do its lessons teach today?**

```
TOKEN coverage (running words)  :  9.2%   (1946 of 21048)
TYPE  coverage (distinct words) :  8.2%   (1127 of 13764)

per-chapter TYPE coverage   min 0%   p25 5.3%   median 13.2%   p75 19.2%   max 48.6%
chapters below 25%: 108 of 120        chapters above 50%: 0
```

**So it is a GENERATION problem, not a gap-filling problem** — decisively, and that was the question
the number was for. A learner who has solved every lesson in a chapter can read roughly one word in
eleven of its story. "Exhaust the vocabulary of the input text" is not a matter of topping up the
last few items; the current corpus is an order of magnitude away.

**And the second cut changes the design, not just the scale.** Splitting the story's word types by
CORPUS FREQUENCY per language (statistics, not a word list — INTERNALS §4):

```
top-100 most frequent types    350 / 3878  =  9.0% covered
top-500                        466 / 3821  = 12.2% covered
rare (everything else)         311 / 6065  =  5.1% covered
```

**The RAREST words are the LEAST covered** — the exact opposite of the user's "start with the
hard/unusual words". The generator today skews slightly toward the common ones. So the request is a
change of POLICY, not only of volume: even at ten times the output, a generator that keeps picking
by whatever it currently picks by would still leave the hard words last.

**What this settles, and what it does not:**
- **Settled:** the per-text scheme needs generation aimed at the text, and it needs a difficulty
  ordering to aim with. Both are the user's own framing, and the data supports both.
- **Settled:** "if it's a simple short text, go towards the basic words as well" is not a separate
  mode — at 9% coverage of the top-100 band, the basic words are not covered either.
- **NOT settled, and the next thing to measure:** how much of the gap is *reachable*. A story
  contains proper nouns, numbers and inflected forms of words the lessons DO teach; the matcher
  counts an inflection as uncovered unless a `word_forms` lesson happens to list it. **Before
  sizing any generator, measure what share of the uncovered types are inflections of covered
  lemmas** — that is the difference between "generate ten times as much" and "teach the forms of
  what is already taught", and `v78_h`'s tier-2 note (corpus inflections from `word_forms` /
  `grammar.plural`) is the machinery that would answer it.
- **Caveat on the method, stated so it is not over-read:** "covered" here means the word appears in
  some lesson of that chapter, which is a strict reading — a learner also carries vocabulary from
  earlier chapters. The cumulative figure is worse in the other direction (83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen — see the §0e re-plan), so the two
  measurements bracket the real answer rather than agreeing on it. Neither is above 20%.

### → NEEDS DESIGN, and the user wants it discussed before it is built

**"DEVELOP A LEARNING SCHEME FOR EACH TEXT, where lessons are focussed on teaching the text."**
The user's framing, recorded close to verbatim because the shape matters more than any summary:

- Adding vocab lessons to a chapter should **exhaust the vocabulary of the input text** — the model
  should use vocab **not already covered by existing lessons**, ideally covering all non-basic
  vocabulary, and for a simple/short text (e.g. children's) going down to the basic words too.
- In the long run: **a full word-by-word dissection of the text**, with lessons presented
  semi-randomly around that dissection. **Start with the hard/unusual words**; the learner can
  indicate — or the app can detect — whether they understand the text sufficiently or need more
  basic lessons first.
- **Dynamic difficulty**: start mid-level; too hard → easier vocab; too easy → more specific/harder.
  Guided by the learner's history.
- **No short-cuts to the source-language interpretation.** The learner MUST prove vocabulary
  understanding first. (This is a hard constraint on the UI, not a preference — it rules out
  "reveal translation" affordances on the path being designed.)
- For a language pair, **draw on OTHER existing stories** for the dynamic quizzing, or suggest
  solving a simpler storyline first. **This needs both stories and individual questions ranked by
  difficulty.**

**Related existing item: the `extend` / `reinforce` redefinition.** The user is right that there is
already a TODO in that area — this supersedes and enlarges it. `reinforce` currently means "reuse
prior chapters' vocabulary"; the request above makes the real axis **coverage of THIS text**, which
is a different quantity and measurable today.

**The first measurement is DONE — see "THE COVERAGE MEASUREMENT" above: 9.2% of tokens, 8.2% of
types, rarest words least covered. It is a GENERATION problem, and a policy change as well as a
volume one.** The original framing of that question is kept below because the distinction it draws
is the one that mattered: **what fraction of a chapter's story tokens are already covered by its
lessons?** `v78_h` built
exactly the collector for it — `_storyWordSources` returns every word every source teaches — but
`v78_h` measured MARKS, not COVERAGE. Marks count occurrences; coverage is the share of the text a
learner could actually read. **Do that measurement first**: if a typical chapter covers 15% of its
story, "exhaust the vocabulary" is a generation problem; if it covers 70%, it is a gap-filling
problem, and those are different products. The same number is the prerequisite for the progressive
reveal idea below, so it is owed twice over.

## USER TESTING NOTES — session 32 batch, TRIAGED AND SCHEDULED

Five notes. Triaged with the code loaded, and **placed in the existing plan rather than queued as a
flat list** — two belong to sections that already exist, one is a decision rather than a defect, and
one was fixed on the spot.

### ✅ Fixed immediately — `v78_c`

- **`--langnames` crash: `Fatal: issues.some is not a function`.** Full note in the shipped table.
  **Invisible until a name is actually REJECTED** — on the happy path `issues` is empty and
  `[].some(fn)` never invokes `fn`. The 119 missing cells the run reported are unaffected: the crash
  was in the writer, not the survey.

### ✅ §7 — script lessons for a DIGRAPHIC SOURCE — `sl_56647998` — SHIPPED as `v78_g`

**User: "I generated a serbian-latin → serbian-cyrillic storyline but I can't add script lessons to
it. Script lessons would obviously fit such a script-focussed lesson."** Correct, and the cause is
exact — now with the reproduction case in the corpus (`tp_17862984310970000000`: `lang sr`,
`script cyrillic-sr`, `srcLang sr`, `srcScript latin`, both stamped by the v76_i picker).

`needsIntroScript(target, src)` computes the learner's readable scripts as
**`scriptsForLang(srcLang)` — every script the source LANGUAGE admits**. For `sr → sr` that is
`["cyrillic-sr","latin"]` on *both* sides, so `tgt.some(s => !src.has(s))` is **false** and the gate
concludes the learner already reads everything. `buildArcIntroLessons` skips every script for the
same reason (`srcScripts.has(scr) → continue`).

**The gate encodes "which scripts can this language be written in", where the question is "which
script is THIS chapter's source actually written in".** Since `v76_g`/`v76_h` that is a stored
per-topic fact: **`srcScript`**. The fix reads the chosen script when there is one —
`srcScript ? [srcScript] : scriptsForLang(srcLang)` — the same one-line shape in both functions.

Notes for whoever takes it:
- **The bug only bites when the SOURCE language is digraphic**, i.e. exactly the languages in
  `scripts.json` `_scriptChoice` (`["sr"]` today). `sr→en`, `ar→en` etc. are unaffected — which is
  why it survived: the corpus had no digraphic-source chapter until the user made one.
- **`index.html` carries its OWN `needsIntroScript`/`scriptTeachable` (≈1762/1894) — DoD item 5,
  data parity.** Fix both and assert parity, or the menu and the generator disagree about whether
  the option exists at all.
- Callers must pass the script through: `index.html:2540` and `:5033` gate the arc-script checkbox
  off `APP.lang`/`APP.srcLang` only; the v76_i picker already holds the chosen scripts.
- **Re-check `scriptTeachable` at the same time.** Once the source set narrows to ONE script its
  `soundsFor` test is being asked a sharper question than before — confirm the sr→sr direction is
  teachable in both directions rather than assuming it.
- Its own release. The gate itself is headless; only the end-to-end needs a live model.

### ✅ SHIPPED as `v78_l` — Replay's target ordering (NOT a conflict, an ORDER bug)

**User: "the replay button plays only comprehension lessons after a lesson is complete… preferably
those that haven't been seen before. Is this request in conflict with the definition of this
button?"**

**Answered: no. The definition is fine and the ORDER is wrong.** Replay is `repeatForCoverage`,
whose defined job is to raise COVERAGE. A lesson at 100% has nothing unsolved, so replaying it
raises nothing and it is correctly skipped. **An unplayed lesson is not at 100% — it is at zero**,
so "prefer ones not yet seen" is not a competing rule, it is the *strongest case* of the rule
already there.

What actually goes wrong: `_firstCoverageShortLessonIdx` returns the **first coverage-short lesson
in document order**, not the least covered. A comprehension lesson sits early and, since `v77_t`
narrows a repeat to the questions still unanswered, stays short for a long time — so it wins that
scan every time and later unplayed lessons are never reached.

Fix shape: choose the **least-covered** counted lesson (unplayed = 0% sorts first) rather than the
first short one. Keeps the button's meaning intact, no ruling needed. **Schedule with §0e/§3**,
which already owns the same card; re-run and diff `probe_gates_v77.js` after it.

### → §0c — auto read-out: RULED (user, session 32), but HELD for a screenshot

**User: "move auto-read from the progress card when the story unlocks to the card that is shown
before comprehension lessons. No other place. But the mute button should work on it."**

The read-out does not go on the finished card at all; it **moves**, and the current §0f call site is
**removed in the same change** — "no other place" is part of the ruling, not a side effect.

**HELD: do not implement yet.** The user will send a screenshot pinning which card is meant. "The
card shown before comprehension lessons" is ambiguous in the current walk — the summary card
(`v77_h`), the story-unlocked card (`v77_j`) and the progress card can all precede a comprehension
lesson, and `v77_j` exists *because* the story-unlock moment was given its own page. Guessing would
move the feature to the wrong screen and delete the working call site on the way.

When it is built:
- **Mute must work on it** — a REAL change, not a restatement of §0f's first restraint. §0f only
  checks `APP.muted` at fire time and then goes straight to `_doSpeakLang`, deliberately bypassing
  `speakBodyText` (which force-unmutes on a tap). "The mute button should work on it" means pressing
  🔇 **while it is reading** must stop it — i.e. `toggleMute` has to cancel speech in flight. Check
  what `toggleMute` does today before assuming.
- §0f's other three restraints carry over verbatim: never on a review render, once per chapter per
  session, never interrupt speech already in progress (`v75_h`).
- `_autoReadStory` already takes `(topicKey, story, langCode)`, so the move is a call-site change
  plus the mute wiring — not a rewrite.
- The `v77_v` guard asserts §0f's behaviour at the OLD site and must move with it, or it passes
  vacuously against a call site that no longer exists.

Measured, and still true: `_autoReadStory` has exactly one call site today (the progress card story
panel, `v77_v`), and the finished card `v77_f` has none. So this was never a regression.

### → Group B, unchanged

The remaining group-B items are **not** displaced by this batch and stay next in line.

## USER TESTING NOTES — session 31 batch, TRIAGED (not yet done unless marked)

Triaged with the code loaded. Grouped by what each needs, because several look like separate items
and are not. **Two were fixed immediately as `v77_x`** (chapter titles, math order).

### A. Fixed this session
- ✅ **Chapter-title generation failing on multi-chapter storylines** — `v77_x`. Root cause above;
  note it explains the user's own observation that the lesson-set page worked.
- ✅ **Math ordering shows the solved order** — `v77_x`.

### B. Small and self-contained — good first work for a fresh session
- ✅ **Clear-progress at CHAPTER level** — `v78_e`, on the **progress cards** (🧹 `comp-wipe`), via the
  shared `_clearChapterProgress`. The storyline page keeps its storyline-wide control and now shares
  the same rule; **`clearLessonProgress` turned out to be a THIRD copy carrying the `v77_s` defect
  and is fixed too.**
  **RESOLVED by the user (session 32): the "inside error / AI-error-hunt lessons" half meant
  something different — clearing the errors the LEARNER had marked, so they can be re-tagged, not a
  chapter wipe. The user then dropped it: "we can actually skip this." Not carried forward.**
  Still optional, never requested: a per-chapter control on the storyline page's chapter cards. Not
  scheduled — the progress card already carries it and those cards have the lock overlay and the
  `v76_d` element-counting trap. Raise it if it is wanted.
- ⚠️ **Sentence-translation read-out should include the `"Übersetze: "` prefix** (tp_579238210) — read
  the whole question in the source language. **RETRIAGED session 32 → needs the USER, not a fix.**
  `Übersetze: "{sentence}"` is `ex.order.q`, the WORD-ORDER exercise, and its question is entirely
  in the source language — which fits the note exactly. But **there is no read-out of it to add a
  prefix to**: every `speak`/`speakLang`/`speakBodyText` call site was enumerated, and `renderEx`
  auto-speaks only `listen_mcq`/`listen_type` (and speaks `ex.target`). `tOrder` renders no speaker
  control at all. So this is either a request to ADD a source-language question read-out to the
  order exercise — a new affordance, not a prefix fix — or it is about a screen other than the one
  found. **Ask before building.** Full note in the session-32 notes §3.
- ✅ **Synonym/antonym questions should state how many are to be found** ("<n> similar to <word>")
  — `v78_b`. Counted from `ex.correct`, the array Check scores against. New `_n` keys (owed to the
  translate pass); the uncounted keys stay as the fallback and must not be deleted.
- ✅ **Conjugation options must be alternative forms of THE SAME verb**, not other verbs, and need
  not be padded to four — `v78_d`. Same-verb pool, no cross-verb padding; the coverage universe was
  checked for the v71_s stranding trap and is unaffected.
- ✅ **Teacher-mode switch at the bottom of every page**, beside the UI-language and mute controls
  — `v78_f`. Three controls, ONE updater; the compact footer icon derives its glyph from the same
  label string the landing button shows, so there is no second spelling of "which icon means which
  state". Reused the existing `teacher.*` keys — nothing new owed to the translate pass.
  (User's "will later depend on credentials" is unchanged and still ahead: the control is wired to
  `APP._teacherMode` exactly as the landing button always was, and gating it on credentials is the
  same one change in the same one place it would have been before.)
- **Highlight word forms from conjugation and word-form lessons**, so covered vocabulary lights up
  more fully. **Belongs with §0e/§3 and the ONE shared matcher** — do not add a second matcher.

### C. Needs a live model — prompt work, verify with the user
- **Error-hunt lessons fail too often.** The user's diagnosis is concrete: make the error count
  length-dependent (1/2/3 by difficulty per paragraph or per word budget), relax "exactly", and use
  1/2/3 in TOTAL as the rejection floor. The reported failure ends in an empty Ollama response after
  three retries, so this also costs a whole add-lesson attempt.
- **Vocab lessons: article mismatch** (target `palazzo`, source `der Palast`). Prompt needs to be
  stricter, with BAD examples.
- **Word-form sentences are too long** — same treatment as synonyms.
- **Comprehension scope:** ask for chapter-level questions first, then whole-story ones, via the
  prompt rather than a new selector.
- **§0g's model-prompt change** (already recorded) belongs with these.

### D. Bugs needing reproduction — ask the user for the case
- **Bulk "add lessons": ticking mixed produced no mixed lessons**, and adding mixed alone appears to
  require another lesson type alongside it. Should work on its own, per chapter.
- **Live mode: edit windows keep the PREVIOUS chapter's content** when browsing between chapters
  (lesson editor, QC story proposals). Smells like a render that reuses a panel without clearing it
  — the same shape as several card bugs this session.

### E. Larger features — need their own release, and a decision first
- **Second script for Serbian (Latin ⇄ Cyrillic):** an LLM-generated alternative script plus a
  toggle beside the translate button in every read-story field. Note `v75_g` already ships an
  `sr`/`hr` table and a native review is OWED — settle that first.
  **Extended session 32 — the SAME toggle is wanted for the UI.** The `sr` `ui.json` pass that
  arrived at the session-32 drop is complete (612 keys) and **written entirely in LATIN script,
  zero Cyrillic**. User's ruling: *"we can keep this for now, but later perhaps add both options."*
  So `sr` UI stays Latin-only and is **not** a defect. When it is picked up, note the shape: this is
  the same question as the story toggle and the same question as `_scriptChoice`, in a third place —
  a language whose UI, whose story text and whose lesson content can each be in either script. It
  wants ONE notion of "which script is this learner reading", not three toggles that can disagree.
  **Sequence it after §7** (script lessons for a digraphic source), which is the first thing to
  actually READ the per-topic `script`/`srcScript` fields; §7 establishes whether that pair is the
  right carrier before a third consumer is built on it.
- **Live main page should mirror the static one**, with generation moved behind a button/card, and
  every "continue story" affordance redirecting there.
- **Floating pill listing running LLM jobs, one row each, with a working STOP per job.**
- **Token accounting must include deleted lessons/chapters** — record the spend when deleting, or
  the total is not a total.
- **Social-media preview for storyline URLs** (title + storyboard). Server-side OG tags; cheap only
  if the storyboard is already reachable as an image.
- **Startup check for missing ENGLISH ui.json keys**, not only other languages. Note
  `unit-ui-key-exists` already does this in the SUITE — this is about the running app.

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- ~~**Live mode with teacher mode OFF must hide every editing control.**~~ **DONE in `v79_j`**
  (session 33). `_canEdit()` now keys on teacher mode alone; the truth table moves in exactly one
  cell and `unit-can-edit-teacher-mode` holds it. **One thing this entry got wrong, kept as a
  warning:** it read as though `_canEdit()` were the whole conflation. It is not —
  `Edit / rename topic` (index.html, the library row) is a pure editing control gated directly on
  `canGenerate` and was never a `_canEdit()` caller, so a fix touching only that function would look
  complete and leave the pencil in place. It stays visible **by user ruling** (session 33: Continue
  story / Add lesson / Edit-rename are "generation, not editing"), which is a decision rather than
  an oversight — revisit it with the larger learner/teacher rework, not on its own.

---

## Owed by the USER — not doable in a container

**New `en`-only keys from `v78_b`, owed to the translate pass:** `ex.syn.q_synonyms_n`
(`{n} similar to {word}`) and `ex.syn.q_antonyms_n` (`{n} opposite to {word}`). **Both carry TWO
placeholders** — a translation that drops `{n}` silently loses the feature for that language, so
these are worth a glance when the file comes back. The uncounted `ex.syn.q_synonyms` /
`ex.syn.q_antonyms` are still in use as the fallback and are already translated: **do not delete
them.** `unit-syn-count` §5 asserts en-only, which is correct only while the keys are new — flip it
to "no language holds the English string verbatim" once the pass has run (`v71_q`).

**New `en`-only keys from `v77_i`, owed to the translate pass:** `unlocked.title`
("Next chapter unlocked!"), `unlocked.next`, `unlocked.back_card`, `unlocked.progress`
("{done} of {total} chapters").

**New `en`-only keys from `v77_h`, owed to the translate pass:** `summary.title`
("The story so far"), `summary.open`, `summary.next` ("Back to your progress"),
`summary.chapters` ("{n} chapters").

**New `en`-only keys from `v77_f`, owed to the translate pass:** `finished.title`
("Story finished!"), `finished.vocab` ("Everything you learned"), `finished.next`
("See the whole story"), `finished.back_card` ("Back to the chapter"). `t()` falls back through
English meanwhile. **`v71_q`: never assert a dropped key absent.**

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

## ⚠️ How the rules are NUMBERED — read before citing one

**The standing rules run to 35, but the numbering in this file is not continuous, and that is a
wart rather than a gap.** Two blocks restart at `1.`: "Rules earned in session 28" (rules 1–8) and
"Rules earned in session 29 (continued)" / "Rules earned in session 29" (which carry what the rest
of the corpus cites as rules **10–14**, and which a grep for `^10\.` will therefore never find).
"Rules earned in session 30" resumes at `15.` and the numbering is continuous from there to 35.

**Do not renumber them.** Every "rule 23", "rule 29", "rule 32" citation across the session prompt,
`INTERNALS.md`, the session prompts, the session notes and several test files is by number, and a
renumber would silently invalidate all of them — the exact failure mode rule 29 is about. When a
session says "thirty-five standing rules" it means **numbered to 35**, not thirty-five entries;
`^\d+\. \*\*` finds 33, and the "9. Package" line inside the definition-of-done list is not a rule
at all and will inflate any naive count by one.

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

**How to start a session (REVISED at the `v80_d` cut — there are TWO documents now, not four):**
read the current **session prompt** first, `build_history/SESSION_PROMPT_v*.md`, highest version
(baseline numbers, what session 35 shipped, what is owed by the USER, open decisions — it absorbed
`HANDOVER.md`, which no longer exists), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one, and it now carries the folded **THE LARGER PLAN**
section that was `implementation_plan.md`), then `INTERNALS.md`. The
`build_history/v*_session*_notes.md` files are history: search them, do not read them cold. Establish the green baseline (`node test/run.js` +
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
   implicitly `a`, so the sequence is `v77` → `v77_b` → `v77_c` → … — the same convention the v69–v76
   lines ran. **This is the `v80` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v80 line.
   (This paragraph is the one version-specific line in the block and had shipped stale FOUR times by
   session 32 — `roadmap_v73.md` said "the `v72` line", `roadmap_v76.md` said "the `v75` line" for
   its whole run, and this file was written at the v78 cut still naming the v77 line, in BOTH
   sentences. **It is no longer maintained by hand: `unit-roadmap-version` asserts that the
   highest-numbered roadmap names the same base version as `server.js`'s `APP_VERSION`.** A note
   telling the next session to check something is not a guard; four repeats is enough evidence that
   this one was never going to be checked.)
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
   **(v77_h, user) The zip's TOP-LEVEL DIRECTORY must be named for the release it contains**, not
   for the base cut: `dreizunge_v77_f.zip` unpacks to `dreizunge_v77_f/`. Unpacking every point
   release into the same `dreizunge_v77/` silently overwrites the previous one, or merges into it —
   which is how a stale file survives a release. Rename the directory before zipping; do not rely
   on the working directory's name.

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

15. **A fix to the client is not a fix to the published build.** `build-static.js` re-implements
    part of `index.html` — currently `loadSavedList` and `savedItemHtml`. Any change to the landing
    page must be applied twice and asserted against `docs/index.html`. The `v76_e` guard passed for
    two releases while the published build stayed broken.

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

## Rules earned in session 31

21. **A variable declared with `let` further down the same function cannot be read earlier — check
    the declaration line before reaching for a value.** `showComplete` computes `_storyDone` ~60
    lines BELOW its Next wiring; reading it there is a `ReferenceError` on every terminal card, and
    it is the exact `v68.1` bug in the exact `v68.1` function. **And the obvious fix is worse:**
    re-deriving the value inline creates a second copy of the rule, which is how the storyline
    page's connector line drifted in `v71_w`. Extract one function both sites call.
22. **A handler declared inline in markup is one a headless test can never click.** The stub DOM
    does not turn an `onclick="f()"` attribute into a callable property. `comp-next` has always
    assigned its handler in JS; anything testable must do the same.

19. **Three of `v76_card_gates.md`'s findings were seeding artefacts, in three different stores**
    (`comp-back`/`comp-story`: the stub DOM itself; the coverage rows: `solved` keyed by item vs
    qid; `comp-drill`: `learned` never written at all). A gate table is only as good as the state it
    seeds, and "the element was never enabled in 32 rows" usually means **the store that enables it
    was never populated** — not that the feature is dead. Before deleting a control as unreachable,
    find its enabling store and write it the way the PRODUCT writes it.
20. **When a passing test contradicts a written finding, the test is usually right.**
    `unit-card-consistency` asserted "drill is live once mistakes exist" while the truth table said
    "never once enabled", and the contradiction sat in the tree for a release because prose is read
    as measurement and a green assertion is read as a detail. Grep the suite for the element before
    trusting a table about it.

16. **An element-visibility probe against the stub DOM must first assert the element exists in the
    MARKUP.** `lib-dom` auto-vivifies any id, so `getElementById('anything')` returns a fresh stub
    with no `display` and no `disabled` — which reads as "present and visible", or as "present and
    hidden" once the probe's own legend maps it. Two of the nine columns in `v76_card_gates.md`
    (`comp-back`, `comp-story`) were phantoms for a whole release, and the roadmap carried
    "the button is already there and already dead" into a rework that was about to reuse it.
    The probe DID call the product function — but the READOUT went through the stub, so the
    assertion never touched the thing being claimed (session-28 rule 2, from a new direction).
17. **When two stores are keyed differently, seeding one and reading the other measures nothing.**
    The `v76` coverage question — "86 keys in, 0 counted" — was a probe seeding the QID universe
    into a store `topicCoverage` reads by ITEM key. Before concluding a gate is unreachable, seed
    it the way the PRODUCT writes it (here: `markSolved`), or drive the real path.
18. **A guard that asserts a construct is ABSENT survives a rewrite; one that pins a phrasing does
    not.** `unit-card-errors` asserts zero empty `catch` blocks in `showComplete` rather than
    matching the new call text — so it keeps working as the rework moves that code, which is
    precisely what §0a asks of the eight files that currently pin source text.

## Rules earned in session 32

23. **A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** The
    `v78` baseline opened red on both data-sensitive guards, each with a documented one-line remedy.
    Running either remedy **destroys the evidence** that says whether the remedy was right: three
    cheap facts (corpus counts unchanged at 308/86, `lessons.json` the OLDEST file in the tree, the
    hash the freshness guard names) narrowed it before anything was written, and the first
    hypothesis they suggested turned out to be **wrong** — the backfill did not reproduce the hash
    `docs/` was built from. The real cause was one thing: the shipped `lessons.json` was the user's
    NEWER file (7 topics with an `ai_error_hunt` lesson `docs/` lacked). **Corollary: when the
    remedies interact, the ORDER is part of the diagnosis** — `build-static.js` first, the fixer the
    failure literally asks for, would have baked the unstamped corpus and overwritten the evidence.
    Backfill, then rebuild.
24. **A note instructing the next session to check something is not a guard.** The protocol's
    version sentence went stale four times, each correction ending in a fresh reminder to check it
    next time; the fourth repeat got BOTH its sentences wrong, the second having survived every
    earlier fix. If a fact can be derived from a source of truth, assert it (`unit-roadmap-version`).
    A reminder is what you write when you have decided not to.

25. **Never put emoji — or any non-BMP character — in a string literal inside the script that writes
    a file.** Session 32 truncated `roadmap_v78.md` **to zero bytes** with a heredoc containing
    `\ud83e\uddf9` surrogate escapes: encoding rejects lone surrogates, and the exception arrives
    AFTER the file is opened for writing, so a "failed" write is not a no-op. Write such blocks with
    a `cat` heredoc to a temp file and splice the FILE in, so the bytes come from disk rather than
    from an escape the writer must encode. `unit-roadmap-version` caught it on the next run, and the
    packaged zip was the only intact copy — both worth remembering.

26. **When two releases each change the same surface, re-measure the older plan against the newer
    behaviour before scheduling it.** §0e's "order the vocabulary as the words appear in the story"
    assumed a per-CHAPTER panel; `v77_f` later made that panel CUMULATIVE across the deck. Neither
    was wrong, and nothing forced them to be compared — so a plan carried unchanged across three
    roadmaps turned out to describe **17% of the data** (measured: 83% of cumulative panel words
    never occur in the story on screen). The check was one probe over the corpus and was available
    the whole time. **A plan carried forward unchanged across N roadmaps is a plan whose premises
    have not been checked against N roadmaps' worth of changes.**

27. **When a comment predicts a failure mode, check every site the prediction covers — not the one
    in front of you.** `v76_h` wrote down that naming the script inside the language name "is not
    enough on its own — the model still drifts", fixed the STORY prompt, and left three LESSON
    prompt builders with the name alone. Two sessions later the corpus produced exactly the
    predicted artefact: a chapter with a pure-Cyrillic story and Latin vocabulary. **A note saying
    "X is not enough" is a search instruction: grep for every place X is done alone.**

28. **A corpus artefact is evidence of a cause only once you have checked what generated it.** At
    the v79 cut a Cyrillic chapter with Latin vocabulary was read as prompt drift, and a fix was
    written and shipped on that reading. The lesson's own `_genMeta` said `_arcMode: "reinforce"` —
    a mode whose JOB is to re-teach earlier chapters' vocabulary, which was Latin on purpose. One
    field, already in the data, would have settled it before any code was written. **`_genMeta`
    records how every lesson was made: read it before diagnosing what a lesson contains.**

## Rules earned in session 33

29. **When a pin breaks, ask whether the CLAIM changed or only the TEXT did — and if only the text,
    re-anchor rather than re-pin.** Five source pins broke this session and not one of them had a
    false claim: `unit-reasoning-model-safety` and `unit-reasoning-toggle` sliced from a line that
    moved; `unit-book-script` matched an inline copy that was deliberately deleted in favour of a
    shared helper; `unit-add-lessons` pinned an exact function signature and an exact call string
    that both grew an argument. Re-pinning each to the new text would have preserved the brittleness
    that cost the diagnosis in the first place. **The repair is to express the claim at the level
    the claim actually lives** — the function rather than its arity, the helper rather than one
    site's copy — **and to add a non-vacuity check so the widened pin cannot go silently empty.**

30. **A COUNT is a proxy, and proxies fail on the thing they should welcome.**
    `unit-intro-script` asserted a helper appeared exactly three times, meaning "no call site
    hand-rolls this question". A legitimate new call site — using the helper correctly, fixing a
    real bug — broke it. Replaced by the rule itself: exactly one definition, at least two callers,
    and every call asked about a SET rather than about `APP` globals. **If a test asserts a number,
    ask what rule the number stands for and whether the rule can be asserted instead.**

31. **Before strengthening an instruction, check whether the instruction is already there and being
    CONTRADICTED.** The word-forms prompt already said distractors must be wrong in the sentence;
    three bullets earlier it recommended, as "the easiest reliable exercise", exactly the tense swap
    that produces indecidable items. A concrete recipe beats an abstract prohibition in any model.
    **A prompt is a document, not a set: read the whole of it and look for the bullet that ASKS for
    the defect before writing a sterner version of a rule that is already present.** Corollary,
    also earned here: the prompt had only POSITIVE examples. A worked counter-example — the broken
    item beside its repair — is worth more than another sentence of prohibition.

32. **A release that says it closed a hole is a claim, not a measurement.** `v79_a`'s shipped row
    read as though the script problem was solved; it covered three prompts of fourteen, and four
    releases later a Cyrillic chapter got an all-Latin conjugation lesson. The row is now marked
    SUPERSEDED in place, because the next session would otherwise read it exactly as this one did.
    **When a fix has a natural scope ("every prompt that…", "every call site that…"), enumerate the
    scope from the source and guard the ENUMERATION, not the instances you happened to fix.**
    `unit-script-pin-coverage` sweeps every `sys*`/`generate*` function out of `server.js` and
    demands each be classified; it found 29 builders, three more than a hand-written list had,
    including a story-QC path that returns a corrected copy of a chapter and could therefore
    silently transliterate one that was already right. The sweep found bugs its author did not know
    to look for.

33. **A green guard near a defect is not evidence about that defect — find out what it actually
    compares.** `unit-script-choice` looked like the guard for "a chapter's lessons are in the wrong
    script" and stayed green through exactly that bug, because `backfill-script.js` compares a
    chapter's STORY with its VOCABULARY and the reported chapter's vocabulary was fine. Likewise
    `e2e-bookjob`'s `/Previous story/` assertion passed for both behaviours of `useFullChain` and
    could not see that release at all. **Read a passing test as the sentence it can actually
    justify** — here, "no chapter's story and vocabulary disagree" — and write the missing one.

34. **Prefer guarding at the layer where the claim is observable, and say plainly what remains
    unverified.** Three of this session's releases (`v79_f`, `v79_g`, `v79_i`) can only prove that
    an instruction REACHES a prompt or that a wiring is correct; whether the model complies is
    observable only on a live generation. Where a claim was a wiring fact — "the server sized the
    context window" — the guard moved to the backend (`fake-ollama` now logs `think`, `num_ctx` and
    `num_predict`), because no prompt assertion can reach it. Where it could not move, the limit is
    written into the shipped row rather than left implied.


## Rules earned in session 34

35. **A warning carried forward in the notes is a claim about a DESIGN, not a fact about the
    problem — measure the warned-about thing before you plan around it.** Three documents (the
    session prompt, `roadmap_v79.md` §0 and `INTERNALS.md` §6b) all warned that the fork task's
    progress half was "the risky one", that it was "shared state between forks rather than a
    rendering change", and that making a shared chapter count for both forks "collides with the
    `_rendered` guard, and how you resolve that collision IS the design decision in this task."
    **Both halves of that were wrong, and ten minutes of measurement said so before anything was
    edited.** Progress needed **no change at all**: `APP.progress.completed` and `chapterDone` are
    keyed by topic **name**, so completion was already storyline-agnostic, and playing a shared
    prefix moved both decks identically (0/4 -> 2/4 on each side, measured through
    `chapterComplete` and `_slProgressStats`). And the `_rendered` collision existed only for the
    design where a fork column redraws the whole other storyline including its prefix — the design
    the user then rejected ("don't draw the shared prefix multiple times, keep the forking"), after
    which the guard was never touched. **The warning was true of a plan nobody had committed to.**

    Why this is worth a rule rather than a note: a carried-forward warning is written by a session
    that was *anticipating*, and it hardens into fact by repetition across documents. Three
    restatements read as three confirmations when they are one guess. The tell is grammatical — a
    warning phrased in the future tense ("you will hit", "it collides with", "how you resolve that
    IS the design decision") is a prediction; one phrased in the past ("measured at the v79 cut",
    "it changes 8 of 32 rows") is a measurement. **Spend the first probe on the predicted obstacle.**
    If it is real you have lost nothing and gained a baseline; if it is not, you have been spared
    designing around a constraint that does not exist.

    Corollary, and the reason the real defect was found at all: when the warned-about mechanism
    turns out not to be the problem, **the actual defect is usually one layer out.** Here the fork
    asymmetry was never in the completion helpers — it was in **membership**, a storyline's
    `chapters[]` not listing a chapter its own chain continues from, which is data rather than code
    and needed a user ruling rather than a fix.

(If you add a new standing rule, append it here so the next session inherits it.)

---

# TRACK T — THE TEXT-FOCUSED PROGRESS CARD (user, at the `v80_f` cut)

*The user's third focus shift on the progress card. Recorded here at the moment it was proposed,
with the measurements that were taken BEFORE any of it was designed — `v80_f` (the inflection share)
and the token-density numbers below. **This supersedes parts of §0 and `PLAN §C2`; what it
supersedes is struck THERE with a pointer here, never silently.***

## T0. The proposal, as given

- **MORE TEXT FOCUS.** The chapter text with highlighted vocabulary is visible on **all** progress
  cards of that chapter, **even before the text is unlocked**.
- Highlighted words are **tappable**, opening a random question associated with that word (vocab,
  word_forms, grammar, conjugation, synonyms…).
- The text is **progressively solved**: highlight goes **red → green**, red = no associated question
  solved, green = **all** associated questions solved. Comprehension unlocks only when every
  highlighted word is green (**or by pass-mark fraction**).
- **All question cards show the text too** (today only comprehension does), with the word or
  sentence currently asked **underlined** as well as coloured.
- **Drop** the chapter-wise progress bars and the progress-card copy ("Mach weiter",
  "Kapitel freigeschaltet!"). Keep the play buttons for now.
- Tapping a word opens ONE of its questions; after answering (right or wrong) the next question is a
  **randomly chosen different word** of the same text, but the learner may always tap another word.
  Revisiting a word **prefers questions not yet solved**.
- Mapping: **for now**, reuse the current highlighting; **for new lessons**, change the prompt so the
  model maps questions to exact words/phrases/sentences. Comprehension lessons should map their
  "why" explanation to the sentences it refers to.
- The learner can **select** a word/phrase/sentence and generate a lesson on it interactively (the
  model or tutor gets the chapter as context).
- **Later, for comics:** show the panels and project the highlights onto them — needs per-word
  **coordinates**.

## T1. VERDICT — extend, do not restart. Most of the machinery is already here.

| the design needs | what exists today |
|---|---|
| word → its questions | **`_storyWordSources(d)`** → `{word, lessonId, probes}` for synonyms, word_forms, grammar, conjugation |
| which words are solved | **`_solvedTargetWords`** + **`_solvedExtraWords`**, resolving `probes` through `qid()` against `_solvedMap` |
| two-tone highlighting | **`_highlightVocabHtml(html, words, strongWords)`** — already LIVE on the storyline chain panel |
| per-item solved state | `_lessonItemUniverse` / item keys (`v74_c`) |
| the text on a card | `_renderSummaryField`, `_storyParasHtml`, `furiHtml` |

**The red/green idea is already half-built**: today's dark shade means *any* question about the word
was answered. Nothing here justifies a new project. **Only the comic-panel coordinates are genuinely
new**, and they are cleanly isolated.

## T2. ⚠️ TWO OF THE PROPOSAL'S PREMISES DO NOT SURVIVE MEASUREMENT

**(a) ~~"Progress will be obvious from the greening text, so the bars can go."~~ ✅ RULED at the
`v80_n` cut: KEEP THE BARS FOR NOW.** The measurement below is why, and `v80_l` sharpened it: a
learner on a worked chapter would see ~12 highlighted words of ~189, of which ~1 is green. The text
cannot carry the progress signal on its own yet. **The bars stay; revisit only if highlight density
and the green share both rise.**
Measured: a chapter has **189 story tokens, of which 12.3 are highlighted — 6%.** Ninety-four per
cent of the text stays plain however much the learner solves. A learner at half-done sees six green
words. **Dropping the bars on this reasoning is not supported**; it may still be right for other
reasons, but it needs its own decision. **Do not treat T0's bullet as settled.**

**(b) "We can use the current highlighting to map questions to the text."**
It holds for **47.3%** of taught words and cannot be pushed past **~56.9%** by matching alone —
`v80_f`, above. **36.4% of taught words are ABSENT from the story in any form.** That is a
GENERATION problem, not a matching one.

**Consequence for T0's ordering:** the proposal treats prompt-side mapping as the *later* option and
matching as the *now* option. **The measurement inverts that.** Prompt-side mapping is the only
lever that touches the 36.4%, and it costs one prompt change instead of a per-chapter matcher.

## T3. What it SUPERSEDES — struck at the source, pointing here

- **§0e** vocabulary on progress cards, and **§0d**'s bars → subsumed by the highlighted text
  (subject to T2a).
- **`PLAN §C2`**'s third progress bar, bottom-row chapter title, and "text comprehension" labelling
  → the copy goes with the bars.
- **`v80_e`'s card copy.** "Kapitel freigeschaltet!" is named for removal. The merged starter card
  **survives as the container**; its title/copy does not. **`v80_e`'s structural win — one starter
  card per chapter — is NOT superseded** and this track depends on it.
- **§0c**'s walk partially collapses: if the text is on every card, the story-unlocked page stops
  being a separate destination.

## T4. What it makes MORE valuable, not less

- **`PLAN §8/B1`, the observations log.** Per-word question history is exactly what this design reads
  and exactly what the current `{seen, wrong}` counters cannot replay. **Its value now decays faster.**
- **The pass mark** (owed by the user). T0's "or via pass mark fraction" makes it load-bearing:
  green-when-all is unreachable in practice if a word has many questions.
- **`PLAN §F2`/`§F3`** prompt QC: a malformed item is far more visible when it is reached by tapping
  a word in the text.

## T5. Open questions the user must settle before building

1. ~~**Green = ALL questions, or a fraction?**~~ **✅ MEASURED at `v80_l` — ALL is NOT a wall. Use
   ALL.** A highlighted word carries a mean of **1.70** associated questions and **53.6% carry
   exactly ONE**, so for most words "all questions solved" means "the one question solved". The
   fraction machinery T0 hedges about is not needed for this reason.
   **⚠️ But the same measurement raises a harder question in its place — see T5.4.**
2. ~~**What about lessons with no story word?**~~ **✅ RULED at the `v80_n` cut: tapping a word
   ENTERS THE USUAL LESSON FLOW**, including questions that are not themselves reachable by tapping,
   and **the play buttons stay.**

   This is a bigger simplification than it looks, and it changes T6. Tapping is a **way IN to the
   existing runner**, not a parallel one-question mode — so the 376 `intro_script` and 218 `math`
   items are not stranded, because the flow that a tap starts is the same flow the play buttons
   start. T6 step 3 ("build a single-question round from a probe") is therefore **wrong as written**:
   the work is *resolve word → lesson + entry point*, then hand off to `startLesson`, which already
   exists. Measured context, unchanged: **82% of items sit in text-anchored lessons.**
3. **T2a: do the bars actually go?**
4. **✅ RULED at the `v80_o` cut — OPTION 1: ACCEPT IT.** The mostly-red text ships as-is. Red means
   "not done", which is true, and `§T2a`'s ruling (the bars stay) means the text is a SECONDARY
   display — the headline progress signal is the bars, so the text does not have to carry it. **No
   extra colouring work; no scoping of the panel.** The two alternatives are recorded below and were
   NOT taken: a distinct PARTIAL colour, and scoping the panel to the chapter's own words.

   **⚠️ What this ruling does NOT settle**, so it is not re-opened by surprise later: 84% red is
   mostly UNFINISHED WORK, not a display artefact. Green = ALL is not the wall (mean 1.70 questions
   per word). If the screen should be greener, the levers are upstream and none of them is a
   colouring change — learners finishing chapters, the **6%** token-highlight density (`§T2a`), and
   the **47%** vocabulary matchability (`v80_f`), of which the last is a GENERATION fix.

   The measurement that produced this ruling: `v80_l` ran TRACK T's own colouring over
   the REAL history in `learners.json` — 2 users with history, 58 chapters they have actually
   worked, 1484 highlighted words:

   ```
   GREEN   every associated question solved    129    8.7%
   PARTIAL some but not all                    107    7.2%
   RED     none                               1248   84.1%

   chapters showing at least one GREEN word     23 of 58   39.7%
   chapters showing NOTHING but red             30 of 58   51.7%
   ```

   **Composed with T2a's density, this is what a learner sees on a worked chapter: of ~189 words on
   screen, ~12 are highlighted, and ~1 is green.** Over half of worked chapters would show no green
   at all.

   This is not a bug and the fix is not technical — 84% red is an ACCURATE report that the work is
   unfinished. But T0's premise is that *"progress should be obvious from the greening text"*, and on
   this install it would mostly report "you have done almost nothing". **That is a design and
   motivation question, and it is the user's.** Options that do not need new measurement: keep the
   bars after all (T2a), colour PARTIAL distinctly so effort shows before completion, or scope the
   text panel to the chapter's own words rather than the whole story.

   ⚠️ Three users, one install. A portrait of THIS install, not a population.

## T7. DEFERRED — a wrong answer should decrease the solved counter

*Raised by the user at the `v80_u` device pass; **explicitly deferred**, not dropped. Recorded here
rather than in a release entry because it is an OPEN design item, and the release entries are
history.*

**The request:** *"a wrongly answered question on a vocab that had been answered correctly should
also decrease the solved counter."* For TRACK T's colouring that is reasonable — a word the learner
has started getting wrong should stop being green.

**⚠️ Why it is not a small change.** `INTERNALS` records the solved store as **MONOTONIC** — *"one
correct answer ever = solved, the coverage model"* — and it is read by:

- `topicCoverage` / `lessonCoverage` → the completion fraction and the pass mark
- `setComplete` / `chapterComplete` → whether a chapter is finished
- `storyUnlocked` → **whether the story is readable at all**
- `_firstUnfinishedLessonIdx` and `_firstCoverageShortLessonIdx` → what Next and Replay open
  (the `v80_b` code)

Turning a ratchet into a fluctuating value means **a finished chapter can become unfinished and an
unlocked story can RE-LOCK**, mid-session, as a consequence of one wrong answer. That may be
acceptable, but it is a product decision and it is not the one the user was making.

**THE SCOPING QUESTION TO ANSWER FIRST** — the two readings differ enormously in blast radius:

1. **HIGHLIGHT ONLY.** A wrong answer moves the word green → partial in `_wordProgress` / the story
   colouring, and the solved store is untouched. Coverage, completion, the pass mark and the gates
   all keep their current meaning. Contained; buildable in a session; needs a second per-word counter
   (a "recent wrong" set) rather than a change to the solved store.
2. **THE WHOLE COVERAGE MODEL.** `markSolved` gains an inverse and every reader above inherits the
   new behaviour. Its own release, and it **must** re-run the `§C1` gate probes
   (`probe_gates_v80c1.js`) and `probe_gates_v77.js`, because the gates it feeds are the ones
   sessions 35–36 spent two releases fixing.

**Reading 1 is what TRACK T actually needs.** Reading 2 is a different feature — mastery decay —
which is `PLAN §9b/D2` territory and is already blocked on `§8/B4` running BKT in shadow mode.
**Do not implement 2 under cover of 1.**

## T6. Build order — ✅ FULLY UNBLOCKED at the `v80_o` cut

*Every `§T5` question is settled: `T5.1` measured (green = ALL), `T5.2` ruled (tapping enters the
usual lesson flow), `T5.3`/`T2a` ruled (the bars stay), `T5.4` ruled (accept the red screen). Nothing
below waits on the user any more except step 5, which needs a live model.*

1. ~~**Per-word solved FRACTION**~~ **✅ SHIPPED as `v80_q`** — `_wordProgress` + `_wordState`;
   both originals are wrappers over it. See the `v80_q` entry.
2. ~~**The shared text panel**~~ **✅ SHIPPED as `v80_r` + `v80_s`** — renderer, three states,
   asked-span underline, and the panel on EVERY question card, collapsed where the story leaks the
   answer (ruled option 3).
3. ~~**Tap → the lesson flow.**~~ **✅ SHIPPED as `v80_t`** — `_wordQuestions` + `tapWord`, landing
   on an unsolved question where one exists. `§0h` (`v80_p`) was built first, as this predicted.
4. **The gate change** (comprehension unlocks on green) — lands on `_storyLockedLesson` /
   `storyUnlocked`, i.e. the `v80_b` code. ~1 session.
5. **Prompt-side exact mapping** — needs a live model. **The user's, not a container's.**
6. **Comic coordinates** — isolated, last.

---


---

# THE LARGER PLAN — folded in from `implementation_plan.md` at the `v80_d` cut

> **⚠️ READ THIS BEFORE CITING ANYTHING BELOW.**
>
> The file `build_history/implementation_plan.md` **no longer exists.** It was a one-off evaluation of the
> user's larger plan (PDF focus) against these roadmaps, written at the `v80` cut, and keeping it
> alive created a SECOND home for open items — which is exactly how the two `v80` diagnoses came to
> be recorded in three places and missing from the durable one. It is folded in here whole.
>
> **Citation mapping.** Anything that said `implementation_plan.md §X` now reads **`PLAN §X`** and
> lives in this section. The letter-form labels are unchanged and unambiguous — `PLAN §C1`,
> `PLAN §D2`, `PLAN §F2`, `PLAN §8/B1`, `PLAN §9b/D8`, `PLAN §9c`, `PLAN §10` — because this roadmap
> has no sections of its own by those names. **The bare-number labels DO collide**: this roadmap
> already has a `§0`, `§1`, `§2` and `§3` of its own, and the plan had different ones. That is why
> every heading below carries the `PLAN §` prefix. **A bare `§3` means the roadmap's highlighting
> item; `PLAN §3` means Track C.**
>
> **Three duplications were resolved on the way in, not silently:**
> - `PLAN §2.6` and `PLAN §2.7` each appeared **TWICE, byte-identical** (3647 and 4857 bytes). One
>   copy of each was dropped. Nothing was lost — they were identical, and that was verified by
>   comparison rather than by eye.
> - `PLAN §2.5` appeared twice with **different content**: the corrected version
>   (*"PDF needs NO decision"*, revised under user challenge) and the superseded original
>   (*"PDF is the only case that still needs a decision"*). **Both are kept**, the original struck
>   with a pointer, because the reason a decision was reversed is worth more than the tidiness.

## ⚠️ WHAT HAS MOVED SINCE THE PLAN WAS WRITTEN — read this before acting on any section below

The plan was written at the `v80` cut. Sessions 35 acted on it. **These are the deltas; the sections
themselves are left as written, so the original reasoning stays readable.**

| plan section | status at the `v80_d` cut |
|---|---|
| **`PLAN §0.2`** — "I damaged `roadmap_v80.md`, re-carry and reconcile both sections" | **DONE.** Both sections were restored at the `v80` cut and RECONCILED in session 35 — see "SESSION 35 — the reconciliation pass" above. Its prerequisite is discharged. |
| **`PLAN §0.3`** — duplicate storyline title | **SUPERSEDED by user ruling** (`§2y`): the user RENAMED one to "Dough of the Ancients 2". The fork-marker guard is preventive, not corrective. |
| **`PLAN §0.3`** — single-chapter `1/1` and 100% bar | **STILL OPEN.** Belongs with `PLAN §C1`, as the plan says. |
| **`PLAN §0.3`** — `unit-story-unlocked-page` §6 does not discriminate | **DONE, shipped `v80_c`.** It fails under revert now. See the `v80_c` entry above, which also CLOSES the `_firstUnfinishedLessonIdx` "open defect" as a misattribution. |
| **`PLAN §0.4`** — are QC tokens recorded | **Answered: yes.** Only a run-level total is missing. |
| **`PLAN §C1`** — the two progress-card gate bugs | **HALF DONE.** The SECOND bug (Replay reaching comprehension before the story unlocked) is **shipped as `v80_b`**, measured 27 of 94 partly-played chapters before / 0 after, revert-verified. The **FIRST bug is NOT reproduced**, and **two readings of it are dead ends** — see the `v80_b` block above before spending time on it. The single-chapter 100% bar and the header off-by-one are still folded in here and untouched. |
| **`PLAN §10`**, session 1 (repair and reconcile) | **DONE** (sessions 35). |
| **`PLAN §10`**, session 2 (`§C1`) | **HALF DONE**, as above. |
| **`PLAN §10`**, session 3 (`§8/B1` or `§D1`) | **UNCHANGED and next.** `§8/B1` is still the only item whose value DECAYS while it waits. |

Everything else below is unchanged and still open.

---

> **Internal cross-references inside this folded section** (`§F3`, `§8/B1`, `§C1` written bare in
> the plan's own prose) are relative to the PLAN, not to the roadmap above. They were left as
> written rather than rewritten in 73KB of prose, because a mechanical rewrite of `§` across that
> much text is exactly the kind of edit that changes a claim by accident.

*Written at the `v80` cut, against `roadmap_v79.md` (shipped history), `roadmap_v80.md` (open
items), `INTERNALS.md` and the 35 standing rules. No code was written for this document. Every
claim about the current code below was checked in the tree at this cut; where I could not check
something, it says so.*

---

## PLAN §0 — Read this first — four findings that change the plan before it starts

### PLAN §0.1 — `bayesian_knowledge_tracing.md` ARRIVED — Track B is unblocked, but not where expected

The document is now in `build_history/`. It is sound, and its central choice is the right one:
**skills (knowledge components) are the BKT unit, not lessons or chapters**, with one canonical
skill shared across every story that exercises it (§7), and storyline/language/global progress as
*aggregations* rather than separate models (§5, §11, §12). That is the standard framing and it
avoids the usual mistake.

**But the blocking work is not the BKT.** The update rule is about ten lines of arithmetic and needs
no design. Four things stand between the document and a working implementation, and they were
checked against the tree at this cut:

**(a) THE EXISTING EVIDENCE CANNOT BE REPLAYED.** `learners.json` stores
`state.progress.learned["<target>|<source>"].vocab[word] = { source, seen, wrong }` — **aggregate
counters, not an ordered observation stream.** BKT is sequential: `P(L)` is updated per attempt, in
order, and "wrong early then right" (learning) is a different state from "right then wrong"
(decay). From `seen: 7, wrong: 0` neither can be recovered. So either BKT starts from zero evidence
going forward, or the existing counters seed `pMastery` crudely and the history is discarded. **The
document's §13 `observations` log is therefore not optional and not a later refinement — it is the
prerequisite**, and the sooner it starts recording the sooner BKT has anything to run on.

**(b) THE CURRENT KEY CONTRADICTS §7.** Evidence is bucketed by **language PAIR** (`it|de`, `en|de`),
so a learner meeting German from English and the same learner meeting German from Italian have
separate records today. §7 explicitly requires one canonical `de:vocab:gehen` regardless of route.
That is a schema migration, and the pair-keyed data cannot be merged without deciding whether
source language is a property of the *evidence* (probably yes) or of the *skill* (probably no).

**(c) SKILL TAGGING IS THE REAL COST, AND IT IS LANGUAGE KNOWLEDGE.** §3/§4 require every exercise to
name the skill it tests. Nothing emits that today. Worse, `de:wordform:gehen:present:1sg` cannot be
computed by the app from the string `gehe` — it needs lemmatisation and morphological analysis,
which INTERNALS §4 puts squarely in the model's tier. So skill IDs will be **model output**, and
**the document does not address canonicalisation**: the same skill will arrive as
`de:vocab:gehen`, `de:vocabulary:gehen`, `de:vocab:Gehen`, `de:vocab:gehen:infinitive` across
generations, and §7's "one canonical skill" quietly fails. **A registry with model-proposed IDs
resolved against existing entries is needed on day one**, not later. This is the single largest
piece of new machinery in the whole plan and it is invisible in the document.

**(d) THE MASTERY GATES COLLIDE WITH THE APP'S EXISTING PROGRESSION.** §5 redefines story progress as
"percentage of required skills with P(mastery) >= 0.70" and §6 makes chapter unlocking depend on
mastery thresholds. Dreizunge **already has** a progression system — `chapterComplete`,
`lessonCountsFor`/`countedLessons`, the `coverageTarget` pass mark with storyline/chapter override,
`_slProgressStats` — and it is the most heavily guarded surface in the codebase
(`probe_gates_v77.js`, the `unit-story-unlocked-*` family, `unit-fork-display` §6). **§5/§6 are a
REPLACEMENT of that, not an addition.** They are also a product decision, not a technical one: the
current pass mark is a teacher-set number the user has ruled on more than once.

**Consequence for ordering:** Track B's *instrumentation* can start early and independently; Track
B's *gates* should be last or never, and must not be assumed. See §8.

**One measurement to take before anything else**, because it decides whether BKT will discriminate
at all: across all of `learners.json` only **40 words have ever been answered wrong (3.0%)**. With
the document's suggested `pGuess = 0.20`, `pSlip = 0.10`, an observation stream that is 97% correct
drives `pMastery` to ceiling almost everywhere — so §6's thresholds would unlock everything
immediately and §5's percentage would read ~100% for every learner. **Check first whether `wrong`
counts FIRST attempts or only un-retried ones.** If exercises are retried until correct, the stream
is not independent, BKT's assumptions do not hold, and the fix is in the answer recording, not in
the model parameters.

### PLAN §0.2 — I damaged `roadmap_v80.md` at the cut, and this plan lands on the damage

When I created `roadmap_v80.md` I carried the open block from line 611 of `roadmap_v79.md` onward.
**Two whole open sections sit BEFORE that line and were lost:**

- `# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)` — with sub-items `0d`…`0h`
- `# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1`

`roadmap_v80.md` contains zero references to `0d`, `0h`, `0i`, "PROGRESS-CARD REWORK" or "LESSON
GENERATION REWORK"; `roadmap_v79.md` contains four. This is my error, made in the last ten minutes
of the previous session, and it is not cosmetic: **those two sections are the direct ancestors of
this plan's "CLEAN-UP PROGRESS CARDS" and "NEW LESSON GENERATION CARD".**

**Prerequisite task, before any of the below: re-carry both sections into `roadmap_v80.md`, then
reconcile them against this plan item by item** — each old bullet is either (a) superseded by a new
one, (b) still open and unmentioned here, or (c) already shipped. A superseded item must be struck
with a pointer, not silently dropped; that is how `v77_p`'s preview-panel removal stayed
comprehensible three releases later. Budget half a session.

### PLAN §0.3 — Two open items from session 34 are still unanswered and one is cheap

- **The duplicate storyline title** (`sl_182891979` / `sl_1041030875`, both `🧈🔥 Dough of the
  Ancients`, the only duplicate in 90) — each side's fork link names the storyline the learner is
  already in. An authoring call.
- **Single-chapter storylines read `1/1` and a 100% bar before anything is played** —
  `_slProgressStats` adds one for the in-progress chapter. This one is **inside the progress-card
  clean-up below** and should be folded into it rather than fixed separately (§C1).
- **`unit-story-unlocked-page` §6 does not discriminate under revert** (carried since `v77_p`). It
  needs no ruling and it is a guard that cannot fail, which is worse than no guard. **Do it first,
  before the big plan starts** — half a session, and it protects the surface the progress-card
  rework is about to churn.

### PLAN §0.4 — One question in the plan is already answered

> *"are tokens used for QC recorded? if not they should be."*

**They are.** `server.js` calls `addTokenUsage(_liveTopic(), _lqTok, 'lesson_qc')` and
`addTokenUsage(tp, _sqTok, 'story_qc')`. Chapter-level QC folds into
`generationStats.totalPromptTokens/totalCompletionTokens` — the same fields initial generation
writes, so "total" means total — and both carry a per-type tally in `tokensByType`. What is **not**
there: the `/api/qc` route itself has no `addTokenUsage` call at its own level, so a bulk QC run
attributes to the chapters it touched and nowhere else. If you want a *run-level* number ("this QC
sweep cost X"), that is a small addition and it belongs with the QC card (§F3), not with plumbing.

---

## PLAN §1 — The strategic read: this plan is three products, not one

The plan as written mixes work at incompatible scales. Sorting it that way is most of the planning
value, because the small items are being blocked by the big ones for no reason.

| Track | What it is | Scale | Depends on |
|---|---|---|---|
| **A — Ingest** | Image upload, vision extraction, chaptering, word map | **New subsystem**, weeks | **Nothing — no rulings left.** PDF text already works (§2.5) |
| **B — Pedagogy** | BKT, adaptive selection, tutor, recommendation, learning arcs | **New subsystem**, weeks | Design doc ARRIVED; B1 can start now, B7 needs a ruling |
| **C — Surface** | Progress cards, UI/settings card, generation card, QC card, LMGTFY | **Incremental**, 1–2 sessions each | Mostly nothing |
| **D — Lessons** | Mixed-lesson selection, cases/articles, generic lessons | **Incremental**, 1 session each | Language-knowledge ruling (§5) |
| **E — Export** | Printable exams and teaching material | **Small, self-contained** | Nothing |

**Recommended order: C → E → D → A → B.** (A moved cheaper after the §2 correction — image ingest needs no dependency at all — but it still follows C, because the ingest UI lands on surfaces C is about to rework.) Reasons, in order of weight:

1. **Track C is where every user complaint in this document actually is.** The screenshots are all
   surface. Shipping C makes the app better for the corpus that already exists.
2. **Track A changes the architecture** (§2) and should not be started while the surface is churning.
3. **Track B needs a corpus and a design document** that do not yet exist (§0.1). It also needs
   learner data, and the session-33 measurement is stark: across all of `learners.json` only **40
   words have ever been answered wrong** (574 with any record, 3.0%). **A BKT model fitted on that
   would be fitting noise.** BKT is the right long-term answer and the wrong next thing.
4. **Track E is small, has no dependencies, and is the only item with a clear non-digital user.**
   It is the best "spare half session" filler in the whole plan.

---

## PLAN §2 — INGEST ARCHITECTURE — corrected after the user's challenge

**My first draft of this section was wrong for images, and the user was right.** It framed
everything around PDF extraction and let the PDF difficulty contaminate the PNG case, which has
almost none of it. Corrected, with what was checked:

### PLAN §2.1 — What the code already does

The app talks to Ollama over **`/api/chat`** with `messages:[{role,content}]`, using Node's built-in
`http`/`https` (`qc-lessons.js:67`, and `server.js` carries the same shape). **Ollama's chat API
accepts `images:[<base64>]` on a message.** So sending a PNG to a vision model is *an extra field on
a request the app already makes* — no new transport, no new dependency, no `package.json`. The
"zero-dependency" property is not at risk for image ingest at all.

### PLAN §2.2 — The model can do both jobs, and the protocol is documented

Checked against the Ollama library and the MiniCPM-V CookBook:

- **`minicpm-v4.6` exists** (Ollama library) — SigLIP2-400M + **Qwen3.5-0.8B**, edge-focused,
  explicitly benchmarked on **RefCOCO** (a referring-expression *grounding* benchmark) and OCRBench.
- **`minicpm-v4.5` exists** — 8B on Qwen3-8B, OpenCompass 77.2, *"leading performance on OCRBench"*
  and *"state-of-the-art performance for PDF document parsing"*.
- **Grounding has a documented protocol** (`MiniCPM-V-CookBook/inference/minicpm-v4_5_grounding.md`):
  ask `Please provide the bounding box coordinate of the region this sentence describes:
  <ref>NAME</ref>`; the model answers with `<box>x1 y1 x2 y2</box>`, **normalised to 0–1000**,
  converted by `x = bbox[0]/1000 * width`.

So: **text extraction and panel coordinates from one model, one call shape, zero dependencies.**
That is the user's proposal and it is sound.

**Model choice, revised:** the plan's original `minicpm-v:8b-2.6-q4_K_M` is superseded by **`v4.5`**,
which is the same size class and explicitly better at OCR and document parsing. **`v4.6` is NOT the
newer-and-better option for this job** — its LLM is 0.8B, built for phones; it is the right pick for
on-device, the wrong one for ingest quality. Confirm what is pulled with `ollama list`.

### PLAN §2.3 — Cropping is a non-issue — three ways out, cheapest first

My draft implied cropping needed an image library. It does not:

1. **Do not crop.** Store the boxes as data and render each panel with CSS
   (`background-position`/`object-fit`) or a canvas draw at display time. The original PNG stays the
   only asset. **Recommended** — it is also reversible, so a bad box is re-editable forever.
2. **Crop in the browser** with `<canvas>` + `toBlob()` if real files are wanted. Free, no server.
3. **Crop in pure Node** — genuinely feasible, `zlib` is built in (verified): inflate IDAT, unfilter
   scanlines, crop, refilter, deflate. A few hundred lines and no dependency. Only worth it for
   server-side batch.

### PLAN §2.4 — What is still genuinely uncertain — and it is ONE thing

Not "can it do boxes" (it can), but: **the documented example grounds ONE region from a
description. Comic panel extraction needs N boxes enumerated in reading order, unprompted.** That is
a different task, and it is where a vision model most plausibly returns *well-formed, plausible,
wrong* output — coordinates that parse cleanly and do not match the page. That failure is invisible
unless something compares them to the image.

**So the first move in Track A4 is a measurement, not a feature** — the pattern that has worked all
session. Roughly 40 lines: post one real `murmel-comics.org/stories/2640` page to `/api/chat` with
`images:[b64]`, ask for panels, parse `<box>`, and render the boxes back over the source image as an
HTML overlay for a human to eyeball. Twenty minutes, and it answers what no amount of planning will:
does it enumerate all panels, in order, at usable precision? Record the answer as a probe with its
numbers in the header, like `probe_word_forms_v79i.js`.

**Reading order is the second unknown** and may be easier solved deterministically: given boxes,
sort top-to-bottom then left-to-right (right-to-left for manga) rather than trusting the model's
sequence. Worth testing both.

### PLAN §2.6 — The interactive word map (user, at the v80 cut) — build it where coordinates are FREE

**The idea:** overlay the image with the coordinates of the extracted text so the learner can click
a word *in the picture* and get a vocab/grammar question about it.

This is the best fit for the product's own one-line description — *"explore the language of existing
texts"* — that anything in the plan has, and most of it already exists: the question types are
built, `_storyWordSources(d)` already collects "what words does this chapter teach", and the
per-word progress store is keyed by word. **What is new is only the coordinate map and an on-demand
question for an arbitrary word.**

But the difficulty is wildly different per input type, and that should drive the order:

**Tier 0 — born-digital PDF: coordinates are EXACT and FREE.** `pdf.js`'s text layer returns per-item
text with a transform matrix — position, scale, font size — for every text run on the page, with no
model call and no error. **A clickable word map over a PDF page is a rendering exercise, not a
research one.** If §2.5 goes the `pdf.js` route, this feature comes almost free with it. **Build it
here first.** It also proves the whole interaction — hit targets, question-on-click, tracking —
against a source of truth, so that when the image path arrives, only the coordinates are in doubt.

**Tier 1 — images, BUBBLE-level (recommended first image step).** Ask the model for text-block /
speech-bubble boxes, not words: few per panel, coarse, and the same referring-expression shape as
panel grounding — the model's demonstrated strength. Clicking a bubble opens the transcribed text as
**ordinary HTML with each word clickable**. Perfect hit targets, no per-word coordinates needed, and
it degrades gracefully: a slightly wrong bubble box is still a usable click target, whereas a
slightly wrong word box lands on the wrong word and teaches the wrong thing.

**Tier 2 — images, true PER-WORD boxes. This is the speculative one, and it is a real step up.**
A comic page can carry 100+ words. Per-word grounding means either many boxes in one response —
where confabulation risk scales with count and nothing in the output signals it — or one call per
word, which is not affordable. **Do not design around this until the §2.4 overlay probe has run**,
and extend that probe to ask for word boxes in one bubble so both questions are answered by the same
20 minutes of work.

There is also a **derived** option worth testing cheaply: take the bubble box plus the transcribed
string and *estimate* word positions by proportional layout inside the box. Free, no extra tokens,
and probably fine for typeset prose — but comics are hand-lettered with unknown line breaks, so
expect it to fail exactly where it is being asked to work. Test it against Tier 2 output rather than
assuming either way.

**Cheap verification, whichever tier ships:** boxes must lie inside the image bounds, must not
mutually overlap beyond a threshold, and the union of text boxes must account for the extracted
string. None of that needs language knowledge, and it catches the well-formed-but-wrong failure that
is otherwise invisible. **A wrong box is worse than no box** — it silently teaches the learner that a
word means something it does not — so the overlay should fail closed: no confident box, no click
target.

**One product question, not a technical one:** this feature stores and re-displays someone's
artwork with an interactive layer on top. The plan already scopes the corpus to *"known texts w/o
copyright"*; `murmel-comics.org` needs its licence checked before it becomes the demo case, and
user-uploaded images need a decision about whether they are stored server-side at all.

### PLAN §2.7 — Two REAL pages, read by eye at the v80 cut — what they change

The user supplied two German comics. They bracket the difficulty so well that they should become
the two fixtures for all of Track A. **Everything below is from reading the pages, not from running
a model** — these are the things the §2.4 probe has to be built to catch, not results.

**Page B ("Ein Scheissland", signed M. Lüq) — the EASY case, and the right ACCEPTANCE fixture.**
A clean 2x3 grid of rectangular panels under a title. Caption boxes sit at the top of each panel,
hand-lettered all-caps. Reading order is unambiguous left-to-right, top-to-bottom, so the
deterministic sort proposed in §2.4 is provably enough here. Two pieces of *in-scene* text (a sign
and a banner) sit inside the drawings rather than in caption boxes — a useful wrinkle, because they
must be distinguishable from narration and are exactly the kind of thing a naive "text on page"
extraction flattens together.

**Page A ("Weg? Woanders? Oder nur unsichtbar?") — the HARD case, and the right REGRESSION fixture.**
It defeats four assumptions at once:

1. **Rotated text.** The title runs diagonally; a whole caption runs bottom-to-top at 90 degrees up
   the middle of the page. **Axis-aligned bounding boxes cannot represent this** — the AABB of a
   rotated line overlaps everything beside it, so a per-word click map built on AABBs will put the
   wrong word under the pointer, and the overlap check proposed in §2.6 will fire on correct output.
   Either boxes carry a rotation, or rotated text is detected and excluded.
2. **Unframed content.** A large heart illustration and its caption have no panel border at all.
   **Panel detection by finding rectangles finds nothing there** — grouping has to be semantic.
3. **Text outside the frame.** Captions sit below their panels rather than inside them, so
   "associate text with the panel whose box contains it" is wrong on this page and right on page B.
4. **Genuinely ambiguous reading order.** Where the vertical caption falls relative to the heart
   caption is a judgement a human makes from layout. A top-to-bottom-then-left-to-right sort will
   produce a confident wrong answer.

**The finding that reaches beyond the overlay: WORDS ARE BROKEN ACROSS LINES.** Page A hyphenates
`SON-` / `DERN` across a line break; page B splits `WILL` / `KOMMEN` across lines **with no hyphen
at all**. This breaks three things, only one of which is the word map:

- the map, because one word occupies two disjoint boxes;
- **vocabulary extraction**, because the lesson would teach `son` and `dern` as words;
- **the story text itself**, which would carry the break into every downstream lesson and QC pass.

So de-hyphenation and line-rejoining belong in the extraction step, before anything else sees the
text — and the no-hyphen case means it cannot be done by looking for hyphens. It is a language
judgement, so it is the model's, per INTERNALS section 4.

**The finding with the most pedagogical weight: ALL-CAPS DESTROYS GERMAN NOUN CAPITALISATION.**
Both pages are lettered entirely in capitals. German capitalises nouns, and that distinction is
information a learner is being taught. `KÖPFE`, `MENSCHEN`, `ANGST`, `SCHATZ` must come back as
`Köpfe`, `Menschen`, `Angst`, `Schatz`, while adjectives and verbs must not. **Extraction from
capitals is therefore not transcription, it is restoration**, and the same applies to `SS` -> `ß`
(`GROSSES` -> `großes`, but `SCHEISSLAND` is a judgement). Hand-drawn umlauts are an accuracy risk on
top. None of this is the app's to decide; all of it must be asked for explicitly in the prompt and
then QC'd, because a silently mis-capitalised noun teaches the wrong rule.

**What this implies for the plan:**

- **Ship against page B, regress against page A.** A version that handles B well and *refuses* A
  cleanly is a good version. A version that produces confident boxes for A is a broken one, and
  page A is how you find out.
- **Fail closed becomes a hard requirement, not a nicety** (section 2.6). Page A is the page where
  plausible-but-wrong output is most likely and least detectable.
- **The probe needs GROUND TRUTH**, or it measures nothing. Somebody has to transcribe both pages by
  hand once, into a fixture, including the intended reading order and the restored capitalisation.
  That is an hour of work and it is what makes every later extraction change measurable instead of
  eyeballed.
- **Content curation is not only about copyright.** Page B is pointed political satire; page A is
  about bereavement. Both are legitimate reading material and neither is automatically suitable for
  an arbitrary learner or an auto-generated "meet and greet" corpus. The corpus needs a suitability
  axis alongside the licence one.
- **Page B is signed by an identifiable artist.** The licence question in section 2.6 is live for
  this specific page, not hypothetical.

### PLAN §2.5 — PDF needs NO decision — corrected again (user, at the v80 cut)

**My §2 draft asked for a PDF ruling that does not exist.** The user's correction: PDF is used for
TEXT only and already works; comics arrive as PNG. Checked, and it is more settled than that:

- **`pdf.js` is already loaded**, from `cdnjs` at `index.html:4394-4402` — the same CDN pattern the
  app already uses for KaTeX. So the "single-file client" property was **already relaxed for exactly
  this**, and nothing new is being decided.
- **Extraction already reads per-item GEOMETRY**, not just strings. `page.getTextContent()` items
  are grouped by `item.transform[5]` (y) and the minimum `item.transform[4]` (x) is kept per line,
  because — as the `v71_b` comment there says — the vertical gap distinguishes a paragraph break
  from a wrap and the left edge marks an indent.

**Rasterisation was never needed.** Delete the option list; there is no dependency question, no
`package.json`, no ruling. The two input paths are simply separate: **PDF/markdown/paste → text,
already built. PNG → vision model, needs nothing new (§2.1).**

**But this has a consequence for §2.6 that runs the other way, and it is good news:** the exact
per-word coordinates the word map wants are **already flowing through `_extractPdfText` and being
discarded.** `content.items` carries a full transform per text run; the current code takes `y` and
the line-minimum `x` and drops the rest. Tier 0 of the word map is therefore not new plumbing — it
is *keeping* what is already read, alongside the text that is already produced. That makes it the
cheapest place in the whole plan to build and prove the click-a-word interaction, against
coordinates that cannot be wrong.

One caveat to measure rather than assume: pdf.js emits text *runs*, not words. A run may be several
words or part of one, so word-level boxes need splitting a run by character widths — approximate,
but bounded and checkable, and vastly better than the image case.

### ~~PLAN §2.5 PDF is the only case that still needs a decision~~ — SUPERSEDED

> **Superseded by `PLAN §2.5` above** (*"PDF needs NO decision — corrected again"*), which the
> user's challenge produced. Kept, not deleted: this is the version that says what the
> decision WAS, and a reversal without its original is unreadable three cuts later.

A PDF is not an image; feeding it to a vision model requires **rasterising** it first, and that is
the one step with no built-in. Options:

- **Rasterise in the browser** with `pdf.js` from a CDN → canvas → PNG → the exact same vision path
  as 2.1. One code path for PDFs and comics both. Costs the single-file client property for the live
  app and needs a decision for `docs/index.html`.
- **Text-layer-only fast path**: `pdf.js` can extract an existing text layer with no model call at
  all — free and exact for born-digital PDFs, which is most uploaded prose. Fall back to
  rasterise+vision for scans and comics.
- Accept a Node dependency (**needs an explicit ruling**, ends a long-held invariant).

**Recommendation: browser `pdf.js` doing text-layer-first, rasterise-on-fallback, feeding the
existing chat+images path.** Images need no library at all; PDFs need only a client-side one; the
server stays zero-dependency in every case.

## PLAN §3 — Track C — the surface clean-up (do this first)

Ordered so that each session ends shippable. Every one of these lands on `probe_gates_v77.js`
territory; **re-run and diff against `v80_card_gates.txt`** (the `v77` table is superseded, and the
`v80` baseline exists because the drop moved it).

### PLAN §C1 — Progress-card structural fixes (1 session) — the BUGS first, before any cosmetics

Two of the plan's items are **defects**, not design, and they should not wait behind the cosmetic
list:

- **"I browsed forward to the story card and back, solved no comprehension lesson, yet could
  proceed to the next chapter."**
- **"Via the replay button or otherwise, I could play the comprehension lessons BEFORE the
  chapter-story was unlocked."**

These are the same suspicion from both sides: **the gate is being computed from render state rather
than from lesson state**, so navigation can move the learner past a gate that never opened. They
are also the two items most likely to be *masked* by the cosmetic rework, so measure them before
touching the cards.

**First move is a probe, not an edit** — the pattern that worked for the fork task. Drive
`chapterComplete`, `lessonCountsFor`/`countedLessons` and the unlock gate directly, reproduce both
sequences, and report what each says before and after. Fold in the **single-chapter 100% bar**
(§0.3) here, since it is the same helper (`_slProgressStats` adding one for the in-progress
chapter) and the same screen.

**Also here:** the storyline header bar being partially green before any question — the plan reads
this as an index-off-by-one ("current-1"). **Verify that before implementing it**; the same helper
produces the 100%-on-one-chapter result, so a single root cause may explain both, and fixing them
as two off-by-ones would leave the real one.

### PLAN §C2 — Progress-card content and copy (1 session)

Low-risk, high-visibility, all guarded by the gate probe:

- ~~third progress bar for comprehension lessons on the entry card;~~ **⚠️ AT RISK from TRACK T**,
  which proposes dropping the chapter bars entirely. **T2a shows that reasoning is unsupported**
  (only 6% of story tokens are highlighted), so this is NOT settled either way — do not build the
  third bar and do not delete the others until the user rules. See TRACK T.
- the bottom-row message replaced by the **chapter title** on all card states (entry, in-progress,
  unlocked-in-green) — one change applied consistently, so build it as one helper with a state
  argument, not four call sites;
- post-unlock questions labelled **"text comprehension"** rather than by the next chapter's name.
  **Check `ui.json` for an existing key first** — the plan says to reuse one if present, and adding
  a key means 33 languages;
- ~~the "next chapter unlocked!" card **removed from the flow**, going straight to the next entry
  card;~~ **RULED AND SHIPPED as `v80_e` — MERGE.** As written this was not executable: since
  `v77_q` there was no entry card for chapters 2..N, because that card WAS it. The entry card is
  now generalised to every chapter and the unlocked card is deleted. **See the `v80_e` entry at
  the top of this roadmap.**
- entry card shows the story summary as the storyline page does, **default uncollapsed**;
- chapter entry cards ≥2 remodelled to match chapter 1.

**Watch for:** removing a card from the flow interacts with C1's navigation bug. Do C1 first or the
two fixes will be hard to attribute.

### PLAN §C3 — Read-out everywhere (1 session)

Speech buttons on every vocabulary field and every chapter text field, on the final card too, with
**each item read in its own language** (vocab in target, translation in source). Clicking an
individual vocab item reads it.

This is the natural home for **"show the no-TTS-available message when the user clicks speech and
that language has no voice"** — the app already has `_ttsNoVoice` and the 🗣 pill for exactly this,
so it is wiring, not new behaviour. It also inherits `v79_n`'s `_speechLocaleFor`, so per-chapter
speech locale applies automatically. **`unit-speech-locale` §11 already guards that a voice picked
for one language never speaks another** — the property this feature depends on most.

### PLAN §C4 — The Settings Card and floating pills (1–2 sessions) — the biggest UI change here

A cog pill next to the login pill on **all** pages, including static, absorbing: the UI control row,
speech-language setting, model selection, sound test, missing-UI-entries, teacher mode, import,
static export, learners. Plus a **global mute pill** replacing every scattered mute button — while
keeping all read-out buttons, which are a different thing.

**Three specific risks, from this session's scars:**

1. **The static build re-implements client functions.** `build-static.js` overrides 19 of them.
   `unit-static-selectlang-tts` now guards that overrides keep their live twin's UI-refresh calls —
   **extend its `REFRESHERS` list as the SC adds refreshers.** The list is a judgement, and the test
   says so.
2. **"Available in the static page" is a requirement, not a footnote.** Model selection, import and
   learners have no meaning without a server. Decide per item whether it is *hidden* or *disabled
   with a reason* in static mode, and write the decision down — a silently missing control reads as
   a bug.
3. **The mute consolidation touches `data-mute-tip`/`updateMuteButtons`**, which already has a
   guard (`unit-tts-test-row`) that broke twice this session on text-level pins. Expect to
   re-anchor it, and re-anchor at the claim.

### PLAN §C5 — Generation Card, QC Card, flag pill (1–2 sessions)

- Generation moves off the main page into its own card, aligned with the storyline and
  "add lesson" entry points — **this is the resurrected `§0i` from `roadmap_v79.md`** (§0.2), which
  was marked BLOCKED on §1; check what that block was before assuming it is gone.
- QC bulk actions get a card with **selectable QC types** (already in the old roadmap).
- The download-flagged pill shrinks to a filled-flag pill, expanding on click, with a
  **guarded "clear all flags"** and clearing on GitHub-link click.

### PLAN §C6 — LMGTFY widget (half a session, do it as a filler)

Self-contained and genuinely small: extend a story-interpretation prompt to emit a list of unusual
or technical terms (`«programma di ricerca»` in `tp_17851387238120000029`), render a collapsible
floating widget of search links, search engine settable in the SC.

**Two notes.** The prompt must call `scriptPinNote` if it emits target-language text —
`unit-script-pin-coverage` **sweeps the source** and a new prompt fails until classified. And
"words the model itself doesn't recognise" is a self-report; treat the list as a *suggestion
surface*, never as a claim about the language, per the "no language knowledge in the code"
principle.

---

## PLAN §4 — Track E — export (1 session, no dependencies, do it early)

Printable **(a) exams** (MCQ + text fields) and **(b) teaching material** (full story with vocab
highlights, full translation without). Both are pure transforms of data that already exists, and
`_storyWordSources(d)` is already the single collector for "what words does this chapter teach".

**Print, not PDF-generation.** A print stylesheet plus a print-optimised render costs nothing and
sidesteps §2 entirely; the browser makes the PDF. Only reach for real PDF generation if you need
server-side batch export, and that is a Track A decision.

This is the item I would slot into any session that finishes early.

---

## PLAN §5 — Track D — lesson types (1 session each, but ONE needs a ruling first)

### PLAN §D1 — Mixed-lesson composition (1 session)

Let the user pick which lessons join a mixed lesson via a dropdown of the chapter's lesson
ids/titles/types. The plan notes this could optionally include **all lessons of previous chapters**
and thereby **replace reinforce/extend**. That is the more interesting half and the riskier one:
replacing an existing feature deserves its own decision and its own release, not a checkbox in a
dropdown release. **Split it: composition first, reinforce/extend replacement second.**

### PLAN §D2 — Cases and articles — NEEDS A RULING, and it is the "no language knowledge" line

The plan asks for noun cases and definite/indefinite article distinctions (`der/die/das`,
`ein/eine`; `ova/ovo` vs `taj/ta/to`), and explicitly anticipates *"a table languages × lesson
types to indicate whether a given lesson type makes sense in that language"*.

**That table is language knowledge in the app**, and `INTERNALS.md` §4 makes its absence a design
principle with a documented list of known violations. The project has already ruled this way once,
in a neighbouring case: the `cyrillic-sr` sounds column was authored, mechanically verified, and
**reverted**, because its absence enforces a `v75_g` ruling — and `unit-intro-script` catches its
return.

So this needs an explicit decision, and there is a middle path worth considering: **let the MODEL
declare per-language applicability at generation time and cache the answer as data** (in
`languages.json`), rather than the app encoding a table. That keeps the knowledge in the tier
INTERNALS §4 assigns it to, and the cache is then a measurement, not a claim.

The "reveal the full phrase, correct article and word form together" part needs no ruling and can
ship independently.

### PLAN §D3 — Generic, story-independent lessons (1 session)

A user prompt field producing lessons not tied to a story ("train colour names, include brown").
The plan's own scoping is right: **standard vocabulary first**, one lesson type, one prompt field,
following the existing LLM-math precedent. Note the new prompt needs `scriptPinNote` (§C6) and a
`_genMeta` record like every other generator.

---

## PLAN §6 — Track F — QC rework (1 session, mostly independent)

Ordered by how much each is worth:

**F1. Word-forms QC: detect distractors that also make an error-free sentence.** This is the same
defect `probe_word_forms_v79i.js` measures, now stated as a QC job. **Read the probe's header
first**: it is explicitly *"a measuring instrument for a human, NOT a validator — rejecting these
mechanically would mean the app encoding per-language grammar, which the model owns."* So F1 must
be **model adjudication**, not a deterministic rule, or it walks straight into §5's problem.

Also carry forward the `v80` finding: the regenerated lesson went from *5 items all two-choice* to
*6 items with 1 two-choice*, while the corpus-wide percentage stayed flat at 15% because
un-regenerated lessons dominate the denominator. **QC on old lessons is therefore worth more than
another prompt revision**, and F1 is how you get it.

**F2. The malformed word-forms items** in `tp_586040741` — the blanked word shown in the sentence
with the underline appended at the end (`"...across the path.___"`, answer `cast`). This one **is**
deterministic and safe: the item is broken as *structure*, independent of language — the answer
token appears in the stem and the blank is not where the word was. No language knowledge needed.
~~**Do this one first; it is the cheapest real win in the whole document.**~~ **✅ SHIPPED as
`v80_g`** — the blank-position half. The answer-visible half was measured and deliberately left
unenforced; see the `v80_g` entry at the top of this roadmap.

**F3. THE ARTICLE MESS — diagnosed at the v80 cut. It is a rule-31 case, and the "fixes" are why it
got worse.**

The user reports German->French vocab in `tp_17869977371640000022` full of pairs where the German
side carries an article and the French side does not. Both languages HAVE articles, so this is not a
"one language lacks them" case. **The generation prompt contains two rules that contradict each
other**, and the contradiction is not subtle once both are read together. From `prompts.json`,
`vocab.system`, in this order:

1. `BASE FORM ONLY: give every vocab word in its dictionary/citation form — verbs in the infinitive,
   nouns in the singular (with the usual article where the language uses one)`
2. `ARTICLE SYMMETRY for nouns: give the article on BOTH sides ("der Hund" <-> "il cane") or on
   NEITHER side ("Hund" <-> "cane") — never an article on one side only.`

**Rule 1 is PER-SIDE and appeals to each language's own citation convention. Rule 2 is a CROSS-SIDE
constraint.** They cannot both be satisfied for a pair whose two languages have different
lexicographic conventions — and German/French is exactly that pair: German dictionaries cite nouns
**with** the definite article because it carries gender (`der Hund`), French dictionaries cite the
bare noun with a gender tag (`chien, n.m.`). **A model following rule 1 faithfully produces
`der Hund` <-> `chien`, which is precisely the reported defect.** Rule 1 is stated first and is
framed as the definitional rule ("BASE FORM ONLY"), so it wins.

**Why it got WORSE with the attempts to fix it — three compounding reasons:**

- **The symmetry rule was ADDED next to the contradicting clause rather than reconciling it**
  (rule 31: *before strengthening an instruction, check whether it is already there and being
  CONTRADICTED*). This is the same failure as `v79_i`, where the word-forms prompt banned indecidable
  distractors and recommended them three bullets earlier. Adding a prohibition beside a live
  contradiction does not remove the contradiction; it makes the prompt longer and the behaviour less
  predictable.
- **A deterministic normaliser was removed for good reasons, and nothing replaced its coverage.**
  `server.js:4438` records it: the old code split `hail` into `grandine`/`hail` and *"dropped the
  gender an Italian learner needs while symmetric siblings in the same lesson kept theirs. It made
  lessons LESS consistent than it found them."* Removing it was right — but the comment then says
  *"the generation prompt still forbids a one-sided article; QC is the safety net"*, and the
  generation prompt does **not** forbid it cleanly, because of rule 1. **The safety net was hung on
  a claim that is not true.**
- **The QC check is context-dependent and degrades quietly.** `qcCheckPair` takes `siblings` — the
  other vocab items in the same lesson — and `server.js:1536` states that omitting them *"degrades
  the article check to a judgement without context"*. So the check's strength varies with what it is
  handed, and a lesson generated wholly one-sided gives it consistent-looking siblings to agree with.

**A fourth contradiction, across prompts:** `vocab` asks for nouns **with** the article; `grammar`
asks for `"{L} noun in singular form (no article)"` and adds `"target" must have no article
prepended`, carrying the article in a separate field. Two lesson types, two opposite conventions for
the same noun. That is defensible per lesson type but it means "the article convention" is not one
thing in this codebase, and any fix must say which convention applies where.

**The fix, in order, and NOT another sentence of prohibition:**

1. **Remove the contradiction.** Rule 1's parenthetical `(with the usual article where the language
   uses one)` is the clause to change — it is what invokes per-language citation convention. Decide
   which convention wins for vocab pairs and state it ONCE.
2. **Add a WORKED COUNTER-EXAMPLE, not a rule.** The word-forms prompt was fixed this way in
   `v79_i`: a shown broken item plus its repair. Here that is `der Hund <-> chien` marked BROKEN,
   with `der Hund <-> le chien` and `Hund <-> chien` both shown as acceptable.
3. **Then measure.** A probe over the corpus counting one-sided-article pairs per language pair,
   with the numbers in its header, so "it got worse" stops being an impression. **The `v80` lesson
   applies: the corpus-wide rate cannot move until lessons are REGENERATED, so measure per
   `_genMeta.at` cohort, not in aggregate** — that is exactly how the word-forms improvement was
   nearly missed.
4. **Only then** revisit whether the QC check should be strengthened. It may be adequate once it is
   no longer compensating for a self-contradicting prompt.

**Note this is downstream of the D1 ruling.** "Does this language use articles at all" is now a
model-declared, cached fact — so the symmetry rule can consult data instead of asking the model to
re-derive it inside every generation.

**F3c. MEASURED at the v80 drop — the contradiction produces a COIN FLIP, not a constant bias.**

The user reported that chapter 1 of the new German->French storyline had the asymmetry and chapter 2
did not. Measured on the drop:

| chapter | asymmetric vocab pairs |
|---|---|
| `tp_17869977371640000022` "Stille vor dem Winter" | **7 of 8** |
| `tp_17869980065780000104` "Brücke der Existenz" | **0 of 8** |

And the two are **generated identically**: same model (`qwen3.6:35b-a3b`), same `_genMeta.type`
(`standard`), `rejected: 0` on both, **four minutes apart**. No different prompt, no different code
path, no retry that could explain it.

**This is the strongest available evidence for the rule-31 diagnosis**, and it sharpens it: a
self-contradicting instruction does not bias the output consistently, it makes the outcome
**unstable** — the model resolves the conflict differently from sample to sample. Two consequences:

- **It explains "seems to have gotten worse".** With a coin flip, a run of bad luck reads exactly
  like a regression, and a run of good luck reads exactly like a fix. Neither impression is
  measuring anything.
- **Therefore a single lesson can never validate the fix.** N=1 cannot distinguish "corrected" from
  "got lucky", and chapter 2 above is precisely a lucky sample of the broken prompt. **The F3 probe
  must sample MANY lessons per `_genMeta.at` cohort and report a RATE with its denominator**, not an
  example.

The failure direction also confirms the mechanism exactly: every asymmetric pair has the German
source carrying the article (`das Eichhörnchen`, `der Winter`, `die Begegnung`) and the French target
bare (`écureuil`, `hiver`, `rencontre`) — German citation convention applied on one side, French on
the other, which is what rule 1's `(with the usual article where the language uses one)` asks for.

**F3b. QC PROMPTS BELONG IN `prompts.json` (user, v80 cut).** Partly true already: `storyQc` and
`srcRepair` live there and are read via `fillPrompt(PROMPTS.storyQc.system, ...)`. **The lesson-level
QC prompt is still inline in `server.js`.** Moving it is small, but the user's second clause is the
valuable half — *"more systematically aligned with the generating prompts"*. The article mess is the
argument for it: **a QC prompt that checks a convention lives in a different file from the
generation prompt that sets it, so the two drift and nobody notices.** Pairing them — same file,
adjacent keys, ideally a shared fragment for any rule both must state — is what would have made this
contradiction visible. Do it as part of the F3 fix, not separately.

**F4. Run-level QC token accounting** (§0.4) — small, do it alongside the QC card.

---

## PLAN §7 — Track A — ingest (multi-session; blocked on §2)

Sequenced so each step is independently useful:

1. **A1 — plain text / markdown upload with a separate chaptering card.** No §2 dependency at all,
   and it builds the chaptering UI that PDF and comics will reuse. **Also delivers the plan's
   "allow to edit the source field when generating from an uploaded text"**, which appears twice in
   the plan and is small.
2. **A2 — language detection**, both the cheap script-based path and the LLM query. The
   script-based half already has machinery: `backfill-script.js` and the `script` stamp.
3. **A3 — the PDF word map** (§2.5/§2.6 Tier 0), not PDF extraction, which already works. Keep the
   per-item transforms `_extractPdfText` currently discards.
4. **A4 — comics via vision model.** Needs no dependency and no PDF ruling, so it can start
   BEFORE A3. **Begin with the §2.4 overlay probe** against `murmel-comics.org/stories/2640`: boxes
   drawn back over the source page, eyeballed by a human, numbers recorded in the probe header.
   Panel *enumeration* and reading order are the unknowns, not OCR.

**Check `/api/generate-book` first** — it exists at `server.js:6515` and may already do part of A1.
And `roadmap_v80.md` §0b records import **"new" mode as POSTPONED by the user**; A1 overlaps it, so
reconcile rather than re-decide.

---

## PLAN §8 — Track B — pedagogy (UNBLOCKED; staged so each step stands alone)

`bayesian_knowledge_tracing.md` is in `build_history/`. §0.1 evaluates it. The staging below follows
from that evaluation, and its shape is: **instrument, then tag, then run BKT in the dark, then
show it, and only then — maybe — let it control anything.**

**B1 — the observations log (do this FIRST, and it can start today).** Append-only, per §13:
`{userId, skillId, correct, evidence, storylineId, lessonId, timestamp}`. Two properties matter more
than the schema: **record the FIRST attempt distinctly from retries** (§0.1's measurement), and
record even when `skillId` is unknown — an observation tagged `null` is recoverable later, an
observation never written is gone. **This is worth doing before any of Track A**, because every day
it runs is a day of evidence BKT will have, and the existing counters cannot be replayed into it.

**B2 — the skill registry and canonicalisation.** The piece §0.1(c) says the document omits. Model
proposes an ID, the app resolves it against existing entries, near-misses are merged, and the
resolution is recorded so a wrong merge is reversible. **Build the registry before the taggers**, or
every tagger will mint its own dialect. This is also where the `de:` / language prefix and the
target-vs-source question from §0.1(b) get settled.

**B3 — tag NEW lessons at generation.** One lesson type first (vocabulary — the same choice §D3
makes, and `_storyWordSources(d)` already collects the words). Every prompt that gains a skill field
must still call `scriptPinNote` and record `_genMeta`. Do **not** backfill 321 topics until one type
has been through QC.

**B4 — BKT in SHADOW MODE.** Compute `pMastery` and show it nowhere. Run it alongside the existing
`chapterComplete`/pass-mark gate and **log where the two disagree.** This is the measurement that
tells you whether §5/§6 are worth adopting, and it costs nothing if the answer is no. It also
surfaces the 97%-correct saturation problem (§0.1) as data rather than as a prediction.

**B5 — surface it read-only.** The §11 aggregate views (vocabulary/grammar/word-forms/reading), and
§8's corpus-vs-independent split, which is free once `evidence` is recorded. Still controlling
nothing.

**B6 — the scoped tutor.** *Not* the adaptive tutor of the user's §4 — the small one: a chapter-
scoped window that knows the story up to and specifically about this chapter. It is independently
useful, needs no BKT, and belongs with Track C's card work. §9's confidence-weighted chat evidence
comes much later and needs an update rule the document does not specify.

**B7 — mastery-driven progression (§5/§6). A PRODUCT DECISION, and possibly never.** It replaces a
gate the user has ruled on repeatedly. Do not start it without an explicit ruling, and not before B4
has shown what would actually change.

**B8 — the corpus.** Automated meet & greet lessons like `sl_1271936135`, plus out-of-copyright
texts. A content project as much as a code one, and it gates recommendation (§6 of the user plan):
a recommender over 90 storylines recommends the same things to everyone.

**B9 — prerequisites and CEFR (§14, §11).** Last. **CEFR mapping is the same language-knowledge
ruling as §5's languages x lesson-types table** — a CEFR level per skill is a language judgement, so
it belongs in data the model fills, not in a table the app ships.

**Still true, and it constrains B4 hardest:** at a 3.0% error rate a difficulty policy has almost no
learner signal to work with and must come from corpus statistics first. The two measurements already
identified remain the right prerequisites — **inflection share** and **learner-known share** — and
one pass over the same inventory yields both.

## PLAN §9 — Cross-cutting risks

**R1 — The single file is at 1.14 MB.** Every track adds to it. Nothing in the plan addresses it,
and `check-inline.js` runtime and browser parse time both scale with it. **Decide before Track A
whether the client stays one file**, because the ingest UI is the largest single addition proposed.

**R2 — The static build will drift again.** It re-implements 19 functions. Every card in Track C
either works in static mode or is deliberately absent, and `unit-static-selectlang-tts` only guards
the refresher pairing. **Expect to extend that guard once per Track C session.**

**R3 — Pricing implies auth, and auth is nowhere in this plan.** "Requires subscription to stably
store progress", "only direct LLM use will cost" — none of that exists today. It is at least its own
track and possibly its own product decision. **It should not be discovered mid-Track-B.**

**R4 — The plan has no failure mode for the model.** Ingest, tutor, QC adjudication and term
extraction all assume a working LLM. The app already handles "no LLM" gracefully; each new
model-dependent feature needs the same, and the plan's own pricing model makes some of them
*expected* to be unavailable.

**R5 — Rule 24 applies to this document.** It is a plan, not a guard. Nothing here is protected
until it is a test.

---

## PLAN §9b — THE DECISIONS STILL OUTSTANDING — the complete list

Everything else in this document is buildable without asking. These are not.

**D1. The languages x lesson-types table — RULED at the v80 cut (user chose the proposed option).**

**Applicability is MODEL-DECLARED, CACHED AS DATA, TERNARY, WITH PROVENANCE.** Not a table the app
ships, and not a question asked at every generation.

The argument that decided it, kept because it is the reason and not just the outcome: the plan's own
example proposed *"ova/ovo vs. taj/ta/to"* as Serbian articles. **Serbian has no articles.** Those
are demonstratives, and the nearer analogue to definiteness in Serbian is **adjective aspect** —
the definite/indefinite adjective forms (`star` / `stari`) — a different mechanism on a different
word class. So the cell "Serbian x articles" is neither `true` nor `false`, and the honest answer
*"no articles; definiteness surfaces through adjective morphology"* is **more useful to the
generator than the boolean**, because it says what to teach instead. A boolean table is wrong on its
first interesting cell, and the interesting cells are the only ones needing a table at all.

**The shape:**

- **Ternary plus a note**, never boolean: `yes` / `no` / `different-mechanism`, with a sentence.
  The note is what turns a refused "cases" request for Italian into a useful preposition lesson.
- **Cached in `languages.json`**, keyed by `(language, lessonType)`, **with `_genMeta`-style
  provenance** — model, date, prompt version — exactly as lessons carry it. That is what makes this
  a MEASUREMENT rather than an authored claim, which is the tier INTERNALS §4 permits, and what
  makes it re-derivable when the prompt improves and auditable when it is wrong.
- **A human override wins and is MARKED as an override**, distinguishable from a cached answer. The
  user is the language authority this project trusts (`v75_g` is exactly that), and an override that
  looks like a cache entry loses the ruling behind it.
- **Asked once, not per generation.** Per-generation is non-deterministic — the same language must
  not get a conjugation lesson on Tuesday and not on Wednesday — and pays tokens repeatedly for a
  stable fact.

**Why not the alternatives:** a hand-authored table scales badly across two growing axes (33
languages x ~14 types) and caps quality at the maintainer's linguistics; no gating at all produces
the incoherent lessons this is meant to prevent.

**The honest cost, recorded rather than glossed:** a wrong CACHED answer is stickier than a wrong
per-call one, because nothing re-asks. Provenance is the mitigation — a prompt-version change can
invalidate and re-derive the affected cells.

**Guard it the way this project already guards this shape:** a source SWEEP that fails when a lesson
type has no applicability policy, mirroring `unit-script-pin-coverage`, which sweeps the source so a
new prompt cannot skip `scriptPinNote`. Rule 32 — guard the enumeration, not the cells that happened
to get filled.

**Scope limit:** this decides only whether a lesson is OFFERED. Whether the generated lesson is any
good remains QC's problem (§F). And the other half of the original request — **revealing the full
phrase with the correct article and word form together** — needs no table and can ship at any time.

*Unblocks: D2 (cases/articles), D3 (generic lessons) partly, B9 (CEFR, same mechanism).*

**D2. Mastery-driven progression (BKT §5/§6, plan §8/B7).** Replaces the `coverageTarget` pass mark
you have ruled on repeatedly. §8/B4 runs BKT in shadow mode first, so this can be decided from a
disagreement log instead of a prediction. **Do not decide it now** — decide it when B4 has data.
*Blocks: B7 only.*

**D3. Corpus licence AND suitability.** `murmel-comics.org` page B is signed by an identifiable
artist, so the licence question is concrete, not hypothetical. Separately, suitability is its own
axis: page B is political satire, page A is about bereavement — both legitimate reading, neither
automatically right for an auto-generated beginner corpus. *Blocks: B8, and the comic demo.*

**D4. Uploaded images — RULED: STORED SERVER-SIDE (user, v80 cut).**

Three consequences that follow immediately and are design constraints, not opinions:

- **Images must NOT go into `lessons.json`.** It is a single JSON file that every test loads, that
  `build-static.js` bakes wholesale, and that the corpus checks parse repeatedly. Base64 comic pages
  would multiply its size by orders of magnitude and slow the entire suite. **Store as files in an
  asset directory, reference by path from the topic record** — the same relationship `docs/` already
  has to the corpus.
- **The static build needs a decision it does not have yet.** `build-static.js` bakes lessons into
  `docs/index.html`; it cannot bake megabytes of PNG. Either the static export omits images (and
  image-derived chapters degrade to text-only), or it copies assets alongside and rewrites paths.
  **Cheapest honest answer: text-only in static, and say so in the UI** rather than shipping a
  storyline whose pages silently fail to load.
- **Retention makes D3 sharper, not softer.** Storing a signed artist's page server-side is a
  stronger act than transiently reading it. The licence question moves from "can we display this"
  to "can we host this".

**D5. Does the client stay ONE file?** `index.html` is 1.14 MB with a ~972 KB inline script, and the
ingest UI is the largest single addition proposed. Note §2.5 shows the property is **already**
partly relaxed — pdf.js and KaTeX both load from CDN — so the question is where the line actually
is, not whether to cross it. *Blocks: nothing immediately; gets harder the longer it waits.*

**D6. Observations log scope — RULED: BOTH, keyed by a stable local id an account can adopt
(user, v80 cut).** Payment and accounts remain open; this decides only the key, which was the part
that blocks §8/B1.

**The design that follows, with the traps named:**

- A client-generated stable id (UUID) in `localStorage`, written on first observation. Every
  observation carries it. No account needed to start recording — which is what makes B1 startable
  now.
- **Adoption must be a LINK, not a rename.** An account accumulates a SET of local ids: one per
  browser and device. Re-keying observations to a `userId` loses the ability to adopt a second
  browser later, and breaks if two devices are adopted in either order.
- **Therefore an observation's identity key is the local id, permanently**, and `userId` is a
  resolved attribute. This is the choice that is expensive to reverse, so it is stated here rather
  than discovered at implementation.
- **Two traps to handle explicitly:** a browser adopted by account A and later signed into account
  B (the observations do not move — they were A's evidence when made), and clearing `localStorage`
  (the evidence is orphaned, not lost; an un-adopted id is simply never claimed).
- Pseudonymous by construction, which is the right default for evidence collected before anyone has
  agreed to anything.

**D7. Does mixed-lesson composition REPLACE reinforce/extend (§D1)?** Replacing a shipped feature
deserves its own release and its own decision, not a checkbox. *Blocks: the second half of D1.*

**D8. Duplicate storyline titles — RESOLVED IN THE DATA (user renamed one to "Dough of the
Ancients 2" at the v80 cut).**

The earlier ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair. The rename removes the defect at its source and is the better fix — the marker renders
the other storyline's `icon + title`, and two distinguishable titles is exactly what it needs.

**The guard is still worth building, but it is now PREVENTIVE, not corrective**, and should be
described that way rather than as a bug fix: for every fork in the corpus, the marker must be
distinguishable from the open storyline's own label. Nothing in the data enforces unique titles, so
a future duplicate would silently reproduce the defect. `unit-fork-display` already sweeps forks and
can carry the assertion in a few lines. **Lower priority than it was — it now protects against a
recurrence rather than fixing a live problem.**

> **✅ SHIPPED as `v80_h`.** The rename was CONFIRMED in the tree first, as the note below asks
> (0 duplicate-title groups across 91 storylines), so this landed as preventive. The marker now
> falls back to naming the branch's own chapter, and `unit-fork-display` §8 injects a synthetic
> duplicate AND an empty title so the sweep cannot pass vacuously. Revert-verified.

**~~Note for the next data drop~~ — DISCHARGED at `v80_h`:** the rename has ARRIVED. The tree now
carries "Dough of the Ancients 2" and 0 duplicate-title groups. Original note follows.

**Note for the next data drop:** the tree at this cut still carries the OLD duplicate titles; the
rename lives in the user's copy. The next `lessons.json` will bring it, and a title change is
exactly the kind of quiet data movement the session protocol says to diff for rather than assume.

## ✅ PLAN §9c — THE STORYLINE TITLE IS NEVER GENERATED FOR A NEW BOOK — **SHIPPED at `v80_l`**

> Fixed by option 2 below (mark the placeholder), with `v78_r` unweakened and every authoring path
> clearing the flag. All 91 existing storylines keep their titles. See the `v80_l` entry.
> Diagnosis kept in full:

**User report:** generating a multi-chapter German->French storyline skipped the title with
`Storyline title: keeping existing "ein eichhoernchen trifft ein murmeltier — 1"`, and the title had
to be made by hand afterwards.

**Diagnosed, and it is a precondition that stopped being true.** `server.js:5348` guards the title
generation with `v78_r`'s rule — *"only when there is none. A continuation must not rename a
storyline the learner already has"* — which is correct and was a user ruling. But the storyline
record is created **earlier in the same flow**, at `server.js:5207` and `5215`:

```js
upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds, ... })
```

`chain[0]` is the FIRST CHAPTER'S TOPIC NAME — here `"ein eichhoernchen trifft ein murmeltier — 1"`,
complete with the auto-numbering suffix. **So by the time the guard asks "is there a title?", there
always is one.** The `else` branch that calls `generateStorylineTitle` is unreachable for any
storyline created through this path. The title is not skipped because the storyline is a
continuation; it is skipped because a PLACEHOLDER was seeded as if it were an authored title.

**The guard is right and must not be weakened** — `v78_r` exists because regenerating a title from
the new chapters alone replaced a whole-story title with one about its tail. The fix is to make the
guard able to tell a placeholder from a real title. Options, in preference order:

1. **Do not seed a title at all** for a new storyline (`title: ''` or omitted), letting the existing
   guard do exactly what it says. Cleanest, but every reader of `sl.title` must tolerate an empty
   one until the post-pass runs — check the storyline list, the fork marker (which renders
   `icon + title`), and `build-static.js`.
2. **Mark the placeholder** — `titleAuto: true`, cleared when a real title is generated or the user
   edits it. Explicit, survives a crash between the two steps, and makes "was this authored?"
   answerable elsewhere too. **Recommended.**
3. Compare `sl.title` to `chain[0]` and treat equality as absent. Cheapest, and wrong the moment a
   user deliberately names a storyline after its first chapter.

**Guard it where the claim is observable:** a new multi-chapter book gets a title that is NOT its
first chapter's topic name, and an EXISTING storyline gaining a chapter keeps its title unchanged.
Both halves are needed — the second is the `v78_r` ruling, and a fix that only asserts the first
would re-open it.

**Scope checked, not assumed:** the same `_slPre2` pattern guards the storyline SUMMARY at
`server.js:5373`, but **`summary` is never seeded** by `upsertStoryline` — the only writes are the
generated one and the user's edit. So the summary guard works as intended and **this is a
title-only bug**. Fix the title; leave the summary path alone.

## PLAN §10 — Suggested next three sessions — revised after the v80 rulings

Four decisions landed at this cut (§9b D1, D4, D6, D8), which changes what is startable.

1. **Repair and reconcile.** The two restored roadmap sections at the top of `roadmap_v80.md`'s open
   block — strike what this plan supersedes **with a pointer**, keep what is still open. Then
   `unit-story-unlocked-page` §6, the guard that does not discriminate under revert. Ends with a
   roadmap that describes reality and one fewer guard that cannot fail.

2. **C1 — the two progress-card gate bugs**, measured before edited (browse-forward-and-back skipping
   comprehension; replay reaching comprehension before the story unlocked), with the
   single-chapter 100% bar and the header-bar off-by-one folded in, since all three may share a root
   cause in `_slProgressStats`. Highest user-visible value in the document.

3. **Either of two now-unblocked one-session items**, whichever suits:
   - **§8/B1, the observations log** — unblocked by D6. Append-only, first-attempt distinct from
     retries, local-id keyed, recording even when `skillId` is unknown. **The only item whose value
     DECAYS while it waits**, because the existing `{seen, wrong}` counters cannot be replayed.
   - **The applicability cache** (D1) — model call, ternary + note, provenance, sweep guard. No UI,
     no migration, and it is the prerequisite for cases/articles lessons and for CEFR.

**Small and independent, for any session that finishes early:** the fork-marker fallback (D8, half a
session, `unit-fork-display` already has the sweep), **F2** the malformed word-forms detector — the
cheapest real win in the document — and **Track E**, printable export.

**Still open, and none of it blocks the above:** the corpus licence and suitability question (D3,
now sharper since images are retained), payment and accounts beyond the key design (D6), whether the
client stays one file (D5, which only gets harder), and whether mixed lessons replace
reinforce/extend (D7). **Mastery-driven progression (D2) should NOT be decided until §8/B4 has run
BKT in shadow mode and produced a disagreement log** — deciding it now would be guessing.

---

# SHIPPED IN THE v80 LINE

*Moved here at the `v80_k` cut. These nine release write-ups had accumulated **between** the
protocol block and the first OPEN section, so a reader following the protocol scrolled 569 lines of
finished work — 17.5% of the file — before reaching anything actionable. That is the rot pattern
the v80 cut itself hit, when "WHERE TO START" had grown three items numbered "0".*

*Nothing was edited, only relocated, and reordered newest-first. The findings that comment on OPEN
sections stayed where they were: `§C1`'s non-reproduction, `§0i — RECONCILED`, and
`§0`'s sub-section status all sit directly above the sections they annotate, which is the only
place they make sense.*

### `v80_z` — the CHAPTER ICON row replaces the storyboard on the cards

User request: one `topicEmoji` per chapter, at lesson-icon size, between the story/vocabulary and the
lesson-type buttons, clickable through to that chapter.

**Shipped:** `_chapterIconsHtml(topicKey, slCtx)`, rendered into the `*-storyboard` slot on all four
card prefixes — the progress card renders it inline (it builds its own header block), the other three
get it from `_cardHeader`, so all four agree.

**⚠️ The storyboard is NOT deleted, and that distinction is the whole design.** `v71_k` built it,
`unit-storyboard-frames` guards it, and the **storyline page still renders it**. Only its PLACE on
the cards is taken. The storyboard is a picture OF the deck; this is a way THROUGH it, which is what
a progress card wants.

**The element keeps the id `*-storyboard`, and that is deliberate.** Renaming would touch **82 client
references and 12 test references** for a cosmetic gain. The id is now historical and says so in both
the markup and `_cardHeader`.

**Locking mirrors the lesson-icon row exactly**, read through `chapterComplete` so the row cannot
disagree with the cards: the current chapter is marked and **carries no onclick** (a link to the page
you are on is a dead control); a reached chapter links by **id**, not by name; an unreached one is
**dimmed and inert** rather than hidden, so the deck stays legible; teacher mode unlocks all of it. A
drill renders **no row** — a synthetic set has no chapter of its own, the same reason `comp-hdr` and
the lesson-icon row hide there.

Row order is now: `hdr → story → vocab → chapter icons → lesson buttons → progress bars → actions`.

**Three guards needed updating, and each was a claim change rather than a re-pin:**

- `smoke-render`'s row order — the slot moved down with its new contents.
- `unit-learner-nav` — asserted `showComplete` renders the storyboard into the card. It now asserts
  the opposite, **plus** that `_renderCompStoryboard` still exists for the storyline page. Deleting
  it was never the ask, and a guard that did not say so would let a future session remove it.
- `unit-card-errors` — injected its fault into `_renderCompStoryboard`, which the card no longer
  calls, so the ledger stayed empty and §2 failed. **The injection was pointing at a function nobody
  ran.** Repointed at `_chapterIconsHtml`; the claim (a throw inside a wrapped block is recorded and
  still swallowed) is unchanged.

**Guard:** `unit-chapter-icons`, six sections. §5 is the discriminator — an unreached chapter is shown
but not clickable, with non-vacuity both ways (some locked, some reachable) so the rule cannot
degenerate into "everything is a link". Mutation-tested: forcing `reachable = true` and removing the
drill guard each fail it.

**⚠️ Two gaps stated rather than claimed:** the `ids.length < 2` rule (a one-chapter deck shows no
row) is NOT exercised — every fixture is a 3-chapter storyline, and mutation-testing showed it
unguarded. And the three other card prefixes get the row from shared code that is not separately
rendered here.

**A fixture bug worth carrying:** §6 first marked the drill on `APP.cur.lesson`, but `showComplete`
reads `APP.lessonData.lessons[C.lessonIdx]`. It looked right and did nothing, so the section failed
against correct behaviour — the same class of error as `v80_t`'s shuffled-content fixtures.

### `v80_y` — two of the three layout items, and `summary.title` retired

#### `summary.title` is GONE; `lesson.read_summary` replaces it

The user's suggestion, and it is better than what `v80_x` did. `v80_x` fixed `summary.title` in `en`
and `de` and left **31 languages holding a translation of the old idiom** — *"The story so far"*,
which means a recap and which most had rendered literally as *"progress so far"* (German:
*"Bisheriger Fortschritt"*, on a card showing a summary).

`lesson.read_summary` already reads **`Summary` / `Zusammenfassung`** and is **already translated in
all 32 languages**. Swapping to it fixes every language at once instead of owing 31 a pass, and
`summary.title` is removed from `ui.json` entirely (617 `en` keys again).

#### Progress bars moved to the BOTTOM of the progress card

Below the play buttons. Under TRACK T the STORY is the progress display and leads the card; the bars
are the numeric backup and no longer compete with it for the top. **The storyline HEADER bar is
untouched** — it belongs to the header, not to this card.

New row order: `hdr → storyboard → story → vocab → lessons → progress → actions`.
`smoke-render`'s row-order list is updated with the reason; **the `§0d` principle it encodes is
unchanged** and still separately asserted — the story precedes the icons and the action row.

#### The vocabulary list is now the COMPLEMENT of the highlighted text

Only solved words that do **NOT** appear in the story, plus the probe-bearing sources (synonyms,
word_forms, grammar, conjugation) which are usually absent from the prose. The list and the
highlighted text sit on the same card since `v80_w`, so a word in both was said twice — and the
highlight says more, because it carries the red/green state. The list now answers a different
question: *what does this chapter teach that the story does not show you?*

Matched by substring, the same test the highlighter uses, so a word is hidden from the list exactly
when it is marked in the text. `v80_f` measured only 47% of taught words as findable in the story, so
the list keeps roughly half its entries rather than emptying.

**⚠️ Its guard needed a synthetic case, and the reason is worth carrying.** The real fixture's solved
words do not appear in its story at all, so `listed === solved` and the equality assertion would hold
**with no filter at all**. Rather than leave a non-vacuity that cannot fire, the rule is tested on a
built case where it must bite (`chat` in the story, `oiseau` not). The corpus fixture still checks the
card matches the rule; the synthetic one checks the rule is a rule.

**A silent catch nearly shipped.** The gloss lookup added `catch(_) {}` inside `showComplete`, which
`v77_b` bans outright — it reports to `_cardNote` now. `unit-card-errors` caught it, which is exactly
what that guard exists for.

#### ⚠️ STILL OPEN — the third layout item, and the postponed flow reversal

- **Replace the storyboard row with clickable chapter icons** (`topicEmoji`, at lesson-type-icon
  size, above the lesson-type buttons, leading to that chapter's progress card). **Not started.** It
  is bigger than it looks: the storyboard on result cards is `v71_k`'s feature with its own guard
  (`unit-storyboard-frames`), and `_cardHeader` renders it for FOUR card prefixes, so replacing it is
  a claim change on an existing feature rather than a layout tweak. It wants its own release.
- **Entry cards for chapters > 1** — postponed by the user; partly reverses `v80_e`. See `v80_x`.

### `v80_x` — the lesson-set storyline link (TWO defects), the translate toggle, and a mistranslated header

#### ⚠️ The storyline link: the reported bug was the SECOND of two defects

User report: *"in teacher mode, in a lessonset page, clicking the storyline title (top row) leads to
the main page instead of to the storyline page."* Measured before changing anything, and the row had
two problems one line apart:

1. **IT NEVER RENDERED.** The chip looked its storyline up in `slTitles = APP.storylines || {}`,
   indexed by `'c'+hash` and `'root:'+topic` — keys from a schema this app has not used in many
   versions. `APP.storylines` is an **ARRAY**, so every lookup returned `undefined`, every chip
   rendered as `''`, and the row was hidden on every chapter. A render of a real storyline chapter
   returned an **empty** `#home-hdr-storyline`.
2. **THE DESTINATION WAS WRONG.** The click ran `loadSaved(chain[0])` — loading the first chapter's
   TOPIC rather than opening the storyline. With a name that no longer resolves, `loadSaved` falls
   through to the landing page, which is exactly what the user saw.

Both fixed by asking the resolver the cards already use: `_storylineForTopic` finds the deck by
MEMBERSHIP, so a rename cannot break it, and `_openStorylineById` is the destination every other
storyline link uses.

**⚠️ Defect 1 is why the user's report and the code disagree.** They saw a row; the code cannot draw
one. Either their build differs, or the element they clicked is a different one. **The fix is right
regardless** — a dead lookup and a wrong destination are both defects — but if the symptom persists,
that is the thread to pull, and it is worth asking WHICH element rather than assuming.

**Guard:** `unit-lessonset-storyline-link` — renders in both modes, names the right storyline, opens
by id, and shows nothing for a solo chapter. Its fixture is deliberately the SECOND chapter of a
storyline: the old code keyed off `chain[0]`, so a first chapter would have hidden defect 2 behind a
coincidence.
**A harness note worth carrying:** the first version asserted on `className`, which lib-dom does not
write back when `classList.add` runs — that tests the HARNESS, not the product. Asserted through
`classList.contains` instead.

#### The translate toggle on the standardized story display

Added to the question panel in the same style as the progress card's, per the user's request. It
reuses **`APP._compStoryLang` — the same state the card uses** — so the two screens cannot disagree
about which language is showing; a second flag would be a second source of truth for one question.
The translation is rendered **unhighlighted**, because target words are not in a source text and
marking them there would match nothing or, worse, coincidental substrings. No translation, no
button.

#### `summary.title` was a mistranslated idiom

The entry card read *"📖 Bisheriger Fortschritt"* — a literal German rendering of the English idiom
*"The story so far"*, which means a recap, not progress. Now **`Summary` / `Zusammenfassung`**.

**⚠️ 31 other languages still hold a translation of the OLD idiom** and are owed a pass: `nl pt fr tr
hi ar sv ru zh ko it pl es ja he uk cs vi id ro th el fi hu da ca lb sw sr hr sl`. They are not
wrong for what the key used to say — they are wrong for what it says now, which is a different and
easier string to translate.

#### ⚠️ STILL OPEN from this device pass — three layout items and one flow reversal

1. **Progress bars to the BOTTOM** of all progress cards, below the play buttons — except the
   storyline header bar.
2. **Replace the storyboard row with chapter ICONS** (`topicEmoji`), at lesson-type-icon size, placed
   just above the lesson-type buttons and below the story and vocabulary, and CLICKABLE through to
   that chapter's progress card.
3. **The vocabulary list should show only words NOT in the story** (carried from `v80_v`).
4. **⚠️ Entry cards for chapters > 1 should be SKIPPED**, jumping straight to that chapter's progress
   card. **This partly reverses `v80_e`**, which generalised the entry card to every chapter after
   `v77_q` had made the unlocked card the starter for chapters 2..N. The net effect is that chapters
   ≥2 get NO starter card and the progress card becomes the arrival screen. That is coherent — but it
   is the third ruling on this surface, and `v80_e`'s guard (`unit-next-chapter-entry`) asserts the
   opposite in six sections, so it needs its own release and a careful rewrite of that file rather
   than a quick edit.

### `v80_w` — ONE story renderer for question cards AND progress cards; `v77_p` reversed

The user asked the obvious question — *"can't we just use the same renderer as on question cards?"* —
and the answer is yes, once the parts that genuinely differ are separated from the part that must
agree.

**`_storyBodyHtml(d, opts)` is now the one BODY renderer.** The frames stay different, and should:
the question panel is a `<details>` with a speak button, the progress card writes into
`#comp-story-text` and has a translation toggle. Only the body is shared — the part where the two
screens were disagreeing.

**They really were disagreeing.** The question panel used the TRACK T three-state map; the progress
card still used the `v74_n` two-shade call. Same story, two meanings, on screens a learner moves
between in one tap. **That is the exact drift `v74_n` was written to fix once already**, reappearing
because TRACK T only updated one side of it. A shared body is what stops it recurring — a third
screen now inherits the rule instead of copying it.

#### ⚠️ `v77_p` is REVERSED, by the same authority that made it

`v77_p` was a user ruling: *"skip all story preview fields — only show the vocabulary."* Its reasoning
was recorded and is worth keeping: *a teaser of the reward is not the reward*, and on a locked card
the preview pushed the vocabulary — the thing the learner can use — below a paragraph they were not
meant to read yet.

**TRACK T removes that PREMISE.** The story is no longer a reward to be earned; it is the progress
display, and T0 puts it on all progress cards *"even before the chapter text is unlocked"*. A hidden
progress display shows no progress. The old reasoning is left in the guard rather than deleted: if
the text-focus direction is ever abandoned, `v77_p` is what to restore.

**The unlock still means something**, and this is pinned: it governs the CAPTION (preview vs
unlocked) and, more importantly, the comprehension lessons — `_storyLockedLesson` is untouched, so a
comprehension lesson is still unreachable until the story opens. **Only the DISPLAY changed, not the
gate.**

#### The 200-character preview is gone

It showed a truncated story until the chapter was finished, which under TRACK T hides most of the
progress display on exactly the cards where the learner is still working. T0: keep attention on the
text throughout.

#### Four guards updated, none deleted

- `unit-learner-nav` — three claims rewritten: no truncation, renders through the shared body, and
  carries no highlighting call of its own. It now also pins that there is exactly ONE
  `_storyBodyHtml` as well as one `_storyParasHtml`.
  **⚠️ Its first rewrite failed on its own explanatory COMMENT**, which mentioned the removed call by
  name; it strips comments before asserting on code. Matching prose is not matching behaviour.
- `unit-story-translation-toggle` — the two truncation assertions are withdrawn and replaced by the
  claim that replaces them: an incomplete chapter shows the SAME text as a complete one.
- `unit-story-unlocked-card` — the `.solved` two-shade match is re-read as "not red"
  (`wp-partial|wp-green`). The claim is unchanged: marking does not depend on progress, only the
  shade does.
- `unit-story-unlocked-page` — asserts the REVERSE of `v77_p`, plus the two things the unlock still
  governs.

Mutation-tested: restoring `v77_p`'s locked-hide, and making the card render without the shared body,
each fail.

### `v80_v` — two more from the device pass; `§T7` opened for the deferred one

#### (a) Sentence questions now count toward the word counter and the highlights

A sentence-translation question puts a whole story sentence in front of the learner, but nothing
marked it: answering one moved no highlight at all, which the user saw on screen.
`_wordProgress` gained a third source, `sentence`, alongside `extra` and `vocab`.

**⚠️ Scoped to words the chapter TEACHES — the user's ruling, and the right one.** Attributing every
word of the sentence would green function words nobody was taught and make the text look finished.
Only words already tracked by the vocab or probe passes can gain a sentence question, so this can
never INTRODUCE a word into the display — it only adds evidence about one already there.

**Measured effect** on the same 1506 words of real learner history:

```
             before        after
GREEN          250          214
PARTIAL        126          217
RED           1130         1075
```

That redistribution is the point: words that looked finished on their vocab question alone now show
as partial, because a sentence exercising them is still unanswered. **This makes the display stricter,
not more generous** — worth knowing given `§T5.4`'s ruling to accept a red-heavy screen.

The wrappers `_solvedExtraWords` / `_solvedTargetWords` read `bySrc.extra` / `bySrc.vocab` only, so
they are unaffected and the `v80_q` capture-and-diff equivalence still holds. `unit-word-progress`
now sums over ALL buckets rather than two, written so a fourth source cannot silently break it.

#### (b) The story panel repaints after an answer

`markSolved` has just run, so the word the learner worked on may have changed state. TRACK T's premise
is that the text IS the progress display, and a display that only updates on the next render is not
one. Cheap because the panel has been ONE renderer since `v80_r` — the repaint calls the same
function that drew it, skips on a replay (which changes no state), and preserves the open state so
the panel is never yanked shut under the learner.

#### `§T7` — the deferred item, written up where it belongs

*"A wrongly answered question on a vocab that had been answered correctly should decrease the solved
counter."* **Deferred by the user; recorded as TRACK T `§T7`**, not in a release entry, because it is
an OPEN design item and the release entries are history.

The write-up states the blast radius — the solved store is MONOTONIC and is read by coverage, chapter
completion, the pass mark, `storyUnlocked` and both resume scans, so a fluctuating counter means **a
finished chapter can become unfinished and an unlocked story can RE-LOCK mid-session** — and names
the scoping question that has to be answered first: HIGHLIGHT-only (contained, one session, needs a
second per-word counter) versus THE WHOLE COVERAGE MODEL (its own release, and it must re-run the
`§C1` gate probes). **Reading 1 is what TRACK T needs; reading 2 is mastery decay, which is
`PLAN §9b/D2` and already blocked on `§8/B4`.**

#### ⚠️ `unit-tap-word` flaked ONCE after this change — 1 in ~40, cause not established

The `--quick` suite failed it once immediately after the sentence pass landed; 28 subsequent runs
(12 + 16) were green, as were two full suites. **Not declared fixed.** `v80_t` established that
`buildExercises` is non-deterministic in CONTENT, and the guard accumulates over builds precisely
because of that — a rate this low is consistent with a residual sampling case the accumulation does
not cover.

**If it recurs, do not re-run until green.** Capture the assertion text: the section that fires names
which invariant broke, and the `v80_t` write-up lists what each section assumes about run content.

#### Still open from the pass — three items

1. The vocabulary list under the text should show only words **NOT** in the story, and may include
   solved synonyms/antonyms.
2. **All progress cards should show the story** with the new highlights (`§T0`'s first bullet).
3. Those cards must use the **SAME renderer** as the lesson panel — they still call `_storyParasHtml`
   and the two-shade highlighter directly, a 4th and 5th renderer, which is exactly the drift
   unifying `_exStoryPanelHtml` was meant to stop. **Do 3 with 2; doing 2 alone adds a sixth.**

### `v80_u` — three fixes from the user's device pass; six items still open

#### (a) The story panel is NEVER collapsed — supersedes `v80_s`'s option 3

*"Don't collapse the story text on some questions… we now want to keep the user's attention on the
text throughout progress cards and questions."* The leakage measured at `v80_s` is unchanged and real
— the story contains the answer for word_forms 60.4%, error_hunt 93.6% — but it is now an **ACCEPTED
COST, not a defect**: scanning the text for the answer is reading practice, which is what TRACK T is
for. Recorded rather than deleted, so the trade stays visible.

#### (b) ⚠️ The story-unlock gate is GONE from the panel — and it was never a static-build bug

Reported as *"in static `docs/index.html`, the first questions don't show the story"*. **Not a build
difference.** `_exStoryPanelHtml` deferred to `storyUnlocked`, with an escape for teacher mode or
`canGenerate`. In the app a backend makes `canGenerate` true, so the panel showed; in the static build
it is false, so the same chapter showed nothing. **One rule, two environments, opposite outcomes** —
which is exactly the shape a "static build bug" report takes when the cause is a gate.

T0 settles it anyway: the text is visible *"even before the chapter text is unlocked"*, because under
TRACK T the text IS the progress display and a hidden one displays nothing. **The LESSON-level gate is
untouched** — comprehension is still unreachable until the story unlocks (`_storyLockedLesson`).

#### (c) French elision: `j'` + `emporte` is now `j'emporte`

The TTS read *"j apostrophe emporte"* on a conjugation lesson, because the speech string was
`ex.pronoun + ' ' + correct` and the corpus stores the elided pronoun WITH its apostrophe. The user's
guess — that the space was the cause — was right; it is not an array-vs-string issue.

`_joinPronoun()` binds an apostrophe-final pronoun directly to the form, for every apostrophe-like
code point, since the corpus mixes U+0027 and U+2019. **No language knowledge is added**: it reads a
character, not a dictionary — the same class of rule as the apostrophe FOLDING in
`_highlightVocabHtml` (`v77_u`) and as case-insensitivity. Applied to both speech strings and to the
displayed answer, so what is shown and what is spoken cannot disagree.

Guarded and mutation-tested: forcing the panel closed and removing the elision test each fail
`unit-story-panel-states`.

#### ⚠️ STILL OPEN from the same pass — six items, deliberately not started

1. **Live highlight refresh after answering.** Cheap; the panel is one renderer now (`v80_r`).
2. **Full SENTENCES should count toward the word counter and highlights** (screenshot 14-09). The
   sentence-translation question uses a story sentence; nothing marks its words. Needs a decision on
   whether a sentence marks EVERY word in it or only the taught ones.
3. **The vocabulary list under the text should show only words NOT in the story**, and may include
   solved synonyms/antonyms (14-11-13). Small, and it makes the list complementary to the highlights
   rather than a duplicate of them.
4. **All progress cards should show the story with the new highlights** (14-07). The completion card
   currently shows the vocabulary list and no story. This is TRACK T's `§T0` first bullet and the
   largest of the six.
5. **The story on the progress/summary cards must use the SAME renderer** as the lesson panel
   (14-11-13/49). Today those call `_storyParasHtml` + the two-shade highlighter directly — a fourth
   and fifth renderer, which is precisely the drift `_exStoryPanelHtml` was unified to stop.
6. **⚠️ A wrong answer should DECREASE the solved counter.** This one is NOT small and should not be
   done casually: `INTERNALS` records the solved store as **MONOTONIC** — *"one correct answer ever =
   solved, the coverage model"* — and coverage, chapter completion, the pass mark, `storyUnlocked`
   and `_firstCoverageShortLessonIdx` all read it. Making it decrease turns a ratchet into a
   fluctuating value, so a chapter could become INCOMPLETE again and a story could RE-LOCK. That may
   be exactly what the user wants for TRACK T's colouring, but it needs its own release, a decision
   about whether the un-solving is scoped to the HIGHLIGHT only or to the whole coverage model, and
   a re-run of the `v80_b` / `§C1` gate probes.

### `v80_t` — SHIPPED: TRACK T step 3, tapping a word enters the lesson flow

`§T5.2`, ruled: *"tapping a word should enter the usual lesson flow, including questions that are not
reachable by tapping, and we keep the play buttons."* So this is a way IN to the existing runner, not
a parallel one-question mode — which is why there is **no new round machinery**.

**Shipped:** `_wordQuestions(d, word)` resolves a word to its candidate questions across both word
sources; `tapWord(word)` picks one (**unsolved preferred**, T0), calls `startLesson`, and moves
`C.cur` onto that question. Marks are tappable **only on the TRACK T panel** — the storyline and
progress-card callers pass no state map and have no run to start. `§0h` (`v80_p`) is what makes the
landing safe: entering at question N is an ordinary run position, not a special state.

#### Two real product defects, both caught by the guard rather than by reading

- **Hidden lessons were valid tap destinations.** `startLesson` refuses them outside teacher mode, so
  a tap would report success and then do nothing. Fixed in the resolver, not the test.
- **The entry-point scan could land on a SOLVED question.** It ran two sequential passes — qid match,
  then text match — and when every qid candidate was solved, the first pass matched a solved question
  and the text pass never ran, **even though the run held an unsolved question about the same word**.
  A probe names only some of the ways a word is asked (for vocab, just `mcq_source_target`), so the
  qid pass is not a superset of the text pass and cannot be tried first. Now ONE scan matching either
  way, then preferring unsolved.

#### ⚠️ `buildExercises` is NON-DETERMINISTIC IN CONTENT, not just in order

This is the finding to carry. The guard was flaky through **six** successive attempts and **every
failure was the TEST being wrong about correct behaviour**. The cause each time was the same
assumption: that the set of questions about a word is stable across builds. It is not — `startLesson`
rebuilds and re-samples, so a fixture chosen from one build does not hold on the next.

The fixture sweep, §1 and §4 now all accumulate across several builds instead of asserting on one.
**Verified 15 consecutive green runs**; a single green run proves nothing here.

**Anything that samples the corpus for a fixture must assume the same.** `unit-question-nav`
(`v80_p`) hit the shuffled-ORDER version of this; this is the harder, content-level version.

#### ⚠️ Mutation coverage is UNEVEN, and measured rather than assumed

```
disabling the entry-point scan                   caught 6/6
dropping the SCAN's unsolved preference          caught 5/6
dropping the POOL's unsolved preference          caught 1/6   <- effectively unguarded
```

The pool mutation survives because the scan compensates for a bad pool pick: the pool's remaining job
is choosing WHICH LESSON when a word is taught in several, and this fixture's word is taught in one.
Recorded in the test's "does not establish" block rather than glossed — a mutation score quoted as a
single number would have hidden it.

**Not built, and not an oversight:** T0's *"after answering, the next question is a randomly chosen
DIFFERENT word"*. The run continues in its own order, which is `§T5.2` working as intended. Word
hopping would be a further change and a further ruling.

### `v80_s` — TRACK T step 2 COMPLETE: the story panel is on every question card (user ruling, option 3)

**Ruled: option 3.** The panel renders on EVERY question card — T0's requirement — and starts
**COLLAPSED** wherever the story would hand over the answer. A learner who opens it is doing what
they could already do from the progress card, so it is a nudge rather than a wall.

**Open by default:** comprehension (the text IS the material) and vocab/listening MCQs, where the
story cannot give a translation away.
**Collapsed by default:** `word_form`, `syn_select`, `listen_type`, `type_plural`,
`type_conjugation`, and the error-hunt kinds — measured leakage of 60.4%, 93.6% and 41.2% for the
sentence-context types, plus the typed kinds, which leak the SPELLING of the word being typed.

**The `smoke-render` negative was MOVED, not deleted.** It had asserted "a non-comprehension question
shows no story panel" since `v71_s` with no recorded reason. The claim it protected still holds —
the leak is now handled by the panel being CLOSED rather than ABSENT — so it now asserts the panel
renders and still comes AFTER the Check button, which is the half that file can see.

**⚠️ A guard that could not fail, caught by mutation-testing rather than by review.** The first
version of `unit-story-panel-states` §5 pinned the SOURCE — that `_open ? ' open' : ''` appears in
the return. Mutating `_open` to a constant `true` — the exact leak the ruling exists to prevent —
**left it green**: it proved the expression existed, not that it discriminated. Rewritten to RENDER
each question type and inspect the `open` attribute, which is where the claim is observable
(rule 34). All three mutations now fail it: `_open = true`, dropping `word_form` from the leak list,
and disabling the leak test entirely.

**This is the second time this session that pinning source text produced a guard that could not
fail** (the first was `unit-story-unlocked-page` §6, fixed at `v80_c`). Worth remembering as a habit:
when a guard's claim is about BEHAVIOUR, rendering and inspecting beats matching the source, and
mutation-testing is what tells the two apart.

### `v80_r` — TRACK T step 2 (part): one story-panel renderer, three states, asked-span underline. **A RULING IS OWED.**

**Shipped:**

- **`_highlightVocabHtml` gained two optional arguments** — a Map of `_hlKey` → `red|partial|green`
  and a Set of keys to underline. **When neither is passed, nothing changes**, which is why they are
  extra parameters rather than a replacement: every existing caller keeps the `v74_n` two-shade
  behaviour, asserted.
- **`_wordStateMap(d)`** derives the states from `_wordProgress` (`v80_q`), so the panel and the
  progress card cannot disagree about what the learner has. A word reachable through both sources
  takes the WORST state, so one unsolved question stops it reading as done.
- **`_askedKeys(ex)`** — the span the current question is about, **underlined on top of its colour**
  (T0: "underline additionally to the coloring"), so the two signals do not compete.
- **`_exStoryPanelHtml` is now the ONE panel renderer** and is ready for every question type;
  `_cardHeader` is the precedent.
- Four CSS classes, guarded — an emitted class with no style rule renders as nothing, which would
  make an unfinished chapter look finished.

#### ⚠️ THE PANEL IS STILL COMPREHENSION-ONLY, and T0 says it should not be

T0: *"ALL question cards should ALSO show text (currently only for comprehension questions)."*
Implementing that hit a `smoke-render` negative — *"a non-comprehension question shows no story
panel"* — which has stood since `v71_s` **with no recorded reason**. Rather than delete it, measured
what it might be protecting:

```
word_forms   203 of 336 items (60.4%)  the FILLED sentence appears verbatim in the story
error_hunt    44 of  47 items (93.6%)  the CORRECTED sentence appears in the story
synonyms      14 of  34 items (41.2%)
```

**The story contains the answer.** Opening the panel on those screens turns a fill-the-blank into a
reading-off exercise. So the guard was protecting something real; its comment simply never said what,
and now it does.

**This needs a USER RULING, because it trades T0's text focus against answer leakage per lesson
type** — not a code decision. Options:

1. **Comprehension only** (today). Safe; T0's requirement unmet.
2. **All types except `word_forms`, `error_hunt`, `synonyms`** — the sentence-context types. Vocab
   and listening questions would get the panel. **⚠️ `listen_type` still leaks the SPELLING**, so it
   probably belongs on the exclusion list too.
3. **All types, panel COLLAPSED by default** on the leaky ones. The learner can still open it, so it
   is a nudge rather than a wall — and arguably fine, since a determined learner can already open
   the story from the progress card.
4. **All types, with the asked sentence masked** in the panel. Most faithful to T0, most work, and
   it needs the generation-side sentence mapping T0 itself proposes.

**My read: 3.** It satisfies T0, costs almost nothing, and the leak it permits is one the learner can
already reach by other means. But it is the user's call and the scope is PINNED by
`unit-story-panel-states` §5 so it cannot widen silently.

### `v80_q` — SHIPPED: TRACK T step 1, the per-word progress collector

`_solvedExtraWords` and `_solvedTargetWords` each answered *"has this word been solved at all?"* and
returned a SET. TRACK T needs the FRACTION — red when none of a word's questions is solved, green
when all are (`§T5.1`, ruled ALL). **A set cannot express the middle.**

**Shipped:** `_wordProgress(d)` → `{ word: { n, ok, bySrc } }`, the ONE collector, walking both word
sources. `_wordState(rec)` returns the three states TRACK T will paint. **Both original functions are
now thin wrappers over it**, so "which words does this chapter teach" and "how much of each does the
learner have" cannot drift apart.

**⚠️ THE REFACTOR WAS WRONG ON THE FIRST ATTEMPT, and the method is why that is known.** Before
touching anything, both functions' output was CAPTURED over **59 real chapter/user pairs** from
`learners.json` — 379 solved words. After the change: **390**. Eleven words had appeared from
nowhere.

Cause: one counter per word, which MERGED the two sources — so solving a `word_forms` question about
a word marked it solved on the VOCAB side too. Fixed by counting per source as well as in total
(`bySrc`), which is what both audiences actually want: TRACK T needs the TOTAL (green = every
associated question, whatever kind), the existing callers need their own side.

A second, smaller difference survived that fix: two words swapped places. `b.length - a.length` is
**not a total order**, so equal-length words came out in whatever order the underlying Set happened
to hold. Tie-broken by text now — same meaning, and the output no longer depends on insertion order.
**Final state: sets identical on all 118 captured outputs.**

**This is the concrete value of capture-and-diff over "the tests still pass".** The whole suite was
green with the contamination bug in place, because no existing test distinguished the two sources.

**Guard:** `unit-word-progress`, five sections against real learner histories — 1506 words, 250
green / 126 partial / 1130 red. Non-vacuity is asserted for all three states, PARTIAL specifically
because it is the state a Set could not express. **§3 is the discriminator**: a word solved through
one source only must not appear in the other's list, checked over 373 genuinely one-sided words.
Mutation-tested: merging the sources fails it, and so does green = ANY instead of ALL.

**⚠️ NOT established (rule 34):** nothing paints yet. `_wordState` returns the states; no caller uses
`partial`. `§T5.4` was ruled ACCEPT, so the red-heavy screen ships as-is when step 2 lands. The
equivalence with the pre-refactor implementation rests on the capture-and-diff done AT the change,
not on the guard — a captured baseline would rot on the next data drop.

### `v80_p` — SHIPPED: `§0h` question navigation. TRACK T's step 3 is now unblocked.

**`§0h`, verbatim:** *"Already-made choices are shown (right or wrong) and cannot be reverted, but
the lock lasts only for that question set: replaying via the progress card makes them playable
again."* Built first because the `§T5.2` ruling put it on TRACK T's critical path — tapping a word
enters the usual lesson flow, which needs "enter at question N", which is this.

**The obstacle was ONE line.** `renderEx` ran
`C.answered=false; C.sel=null; C.placed=[]; C.usedIdx=[];` **unconditionally**, so a question
revisited came back blank and playable. Everything else followed from that.

**Shipped:**

- **`C.ans`, a per-RUN answer ledger** — verdict plus selection, typed text, syn tiles and placed
  order. It lives on the RUN, so `§0h`'s "the lock lasts only for that question set" holds **by
  construction**: replaying builds a new run and an empty ledger. No separate unlock path to get
  wrong.
- **`check(replay)`** — a flag on the SAME function rather than a second "paint the answered state"
  function. The painting is ~60 lines of per-type DOM work interleaved with the scoring, and a
  second implementation would drift the moment either changed. **With one path, a replayed question
  cannot look different from a live one.** A replay does not score, spend a heart, `markSolved`,
  write the ledger, speak, or auto-advance — six narrow `if(!replay)` guards, no lifted code.
- **`_restoreAnswer`** puts the SELECTION back; the verdict is `check(true)`'s job, so exactly one
  place knows what an answered question looks like. Placed-order types redraw through the product's
  own `updateSbox` / `updateMathPlaced` rather than a copy of that logic.
- **`qPrev()` + a `←` button**, hidden on the first question. Forward is untouched:
  `_speakAndAdvance` still advances one way only, as `§0h` describes.
- **On a replay the verdict comes from the LEDGER, never from re-grading the DOM.** Re-grading would
  be a second source of truth, and for typed answers it would read whatever the restored input holds
  rather than what the learner submitted.

**Guard:** `unit-question-nav`, six sections, driving a REAL lesson through
`startLesson`/`renderEx`/`check` rather than asserting on source text. Mutation-tested both ways:
disabling the restore fails *"still ANSWERED, not blank"*; removing the `!replay` scoring guard fails
*"the score did NOT change"*.

**⚠️ A fixture bug worth carrying, because it looked exactly like a product bug.** Exercises are
SHUFFLED per run, so the question at index 0 is not the same TYPE every time. The first version of
the test assumed choice buttons and failed on **2 runs in 12** — intermittently, which is the worst
way for a guard to be wrong. The helper now reports the SHAPE it answered and the assertions branch
on it, so the test measures whichever shape actually occurred. **Verified 15 consecutive green runs
before shipping**; a single green run would have proved nothing.

**⚠️ NOT established (rule 34):** the sections exercise CHOICE and TYPED questions. The ledger also
stores synonym tiles and placed-order state and `_restoreAnswer` puts them back, but **no fixture
drives those types, so their restore is UNVERIFIED.** A device pass on an ordering lesson and a
synonym lesson is owed. `ui.json` gained one `en` key, `ex.back_title` (617 → 618), owed to the
translate pass.

### `v80_o` — `§T5.4` ruled: TRACK T is fully unblocked

**User ruling: OPTION 1 — accept the mostly-red screen.** It ships as-is. Red means "not done",
which is true, and `§T2a`'s ruling means the text is a SECONDARY display: the bars carry the headline
progress signal, so the greening text does not have to. **No extra colouring work, no scoping of the
panel.** The two alternatives are recorded in `§T5.4` and were not taken.

**Every `§T5` question is now settled**, and `§T6` waits on nothing except its step 5, which needs a
live model:

| question | outcome |
|---|---|
| `T5.1` green = ALL or a fraction? | **MEASURED** `v80_l` — ALL. Mean 1.70 questions per word; 53.6% carry one. |
| `T5.2` lessons with no story word? | **RULED** `v80_n` — tapping enters the USUAL lesson flow; play buttons stay. |
| `T2a`/`T5.3` do the bars go? | **RULED** `v80_n` — they stay. |
| `T5.4` the mostly-red screen? | **RULED** `v80_o` — accept it. |

**⚠️ Written into `§T5.4` so it is not re-opened by surprise:** 84% red is UNFINISHED WORK, not a
display artefact. If the screen should ever be greener, every lever is upstream and none is a
colouring change — chapter completion, the **6%** token-highlight density (`§T2a`), and the **47%**
vocabulary matchability (`v80_f`), of which the last is a GENERATION fix.

**What this means for the build order.** `§T6` is buildable end to end in a container except step 5:

1. per-word solved FRACTION — generalise `_solvedExtraWords` from a set to counts (~1 session)
2. the shared text panel on every card and question screen (~1 session)
3. tap → the lesson flow — **revised down by the `T5.2` ruling** to *resolve word → (lesson, entry
   point) → `startLesson`*, ~1 session, **with `§0h` on its critical path**
4. the gate change — lands on `_storyLockedLesson` / `storyUnlocked`, i.e. the `v80_b` code
5. prompt-side exact mapping — **needs a live model; the user's**
6. comic coordinates — isolated, last

**`§0h` (question navigation) is now the natural first move**, not step 1: step 3 needs "enter the
lesson at question N", which is exactly what `§0h` is about, and `§0h` was already flagged as wanting
its own session.

### `v80_n` — DATA DROP: the Serbian script defects are CLEARED, and three TRACK T rulings

#### The drop, diffed

1073 → **1074 lessons**, 324 topics / 91 storylines unchanged. Four topics touched:

| chapter | change |
|---|---|
| Flüstern der Zukunft | **`ls_534284213` (standard) DELETED** |
| Geheimnis der Sprache | **`ls_1786370351359` (conjugation) REPLACED** by `ls_1787127555744` |
| Flucht ins Leere | + `ls_1787063282011` error_hunt |
| Brücke der Existenz | + `ls_1787059371457_onji` mixed |

**`probe_lesson_script_v80h.js` now reports 0 of 94.** The two real defects from `v80_m` are gone,
and the replacement conjugation lesson carries **294 Cyrillic characters** — `бити`, `ја/сам`,
`ти/си`, `он/она/оно/је` — against 0 in the one it replaced. The console line the user saw
(*"conjugation prompt pinned to Cyrillic for sr"*) matches what landed.

**⚠️ A win NOT claimed.** `ls_1787059371457_onji` carries a `ls_<timestamp>_<suffix>` id, which looks
like `v80_i`'s collision-dedupe firing in the wild. **It is not.** The suffix is 4 characters, which
is the CLIENT's format (`index.html:7582`, `slice(2,6)`); the dedupe mints 6 (`server.js:335`,
`slice(2,8)`). There is still no evidence `_dedupeLessonIds` has ever fired on real activity — it
remains preventive.

**`learners.json` also dropped** (one more `chapterDone`). `v80_l`'s numbers re-measured and hold:
84.2% red / 8.6% green over 59 worked chapters, against 84.1% / 8.7% over 58. **The conclusion is
not sensitive to the drop.**

#### Three rulings — `PLAN §F3` deferred to the user's own testing

- **`§T2a` — KEEP THE BARS FOR NOW.** The chapter progress bars stay. The greening text cannot carry
  the progress signal on its own at ~12 highlighted words of ~189, of which ~1 green.
- **`§T5.2` — tapping a word ENTERS THE USUAL LESSON FLOW**, including questions not themselves
  reachable by tapping; the play buttons stay. **This simplifies TRACK T materially and corrects
  `§T6` step 3**, which had specified a single-question mode: tapping is a way IN to the existing
  runner, so the 376 `intro_script` and 218 `math` items are not stranded, and the build is *resolve
  word → (lesson, entry point) → `startLesson`* rather than new round machinery. Revised down from
  ~2 sessions to ~1, **with `§0h` (question navigation) now on its critical path**, since "enter at
  question N" is exactly what `§0h` is about.
- **`PLAN §F3`** — the user will test the article fix directly. Baseline for that comparison is
  `v80j_article_symmetry.txt`: 1.0% overall, **bimodal** (191 chapters at 0%, two at 100%).

### `v80_m` — CORRECTION to `v80_h`: four of the seven "all-Latin" lessons were never defects

**`v80_h` reported 7 lessons carrying none of their chapter's script. The real number is 2.** Four
of the seven were `comprehension` lessons, and **comprehension questions are written in the SOURCE
language throughout the corpus** — `de->fr` yields German questions, `ar->en` Arabic, `it->de`
Italian. That is the design: you read the target-language story and answer in a language you
understand. The detector had no business claiming them.

**Measured across non-Latin-target chapters**, which is what settles it rather than an opinion:

| type | carries target-script text |
|---|---|
| `standard` | 61 of 62 |
| `synonyms` / `word_forms` / `grammar` / `intro_script` / `error_hunt` | 100% |
| **`comprehension`** | **1 of 5** |

So absence means nothing for that type. `lessonScriptDefect` now exempts it. **This is a per-TYPE
fact about where the app puts each language, not a language fact**, so it lives in code rather than
in `scripts.json`. The guard's new §7 asserts the exemption **with its non-vacuity**: the same text
under `type: 'standard'` is still flagged, so this is an exemption for one type and not the rule
going quiet.

**How the error happened, since it is the interesting part.** `v80_h` swept the corpus and found 7;
the sweep was correct. What was never checked was whether the ABSENCE meant a defect for every type
it counted. Rule 30 in a new costume: a count is a proxy, and this proxy failed on four cases it
should have welcomed. The tell was available at the time — one flagged comprehension lesson sat in
the very topic being examined, and its German questions were visible in the sample output.

**The two REAL defects, and they are milder than "all-Latin" suggests:**

| storyline | chapter | lesson | type |
|---|---|---|---|
| Max und die Zukunft | Flüstern der Zukunft | `ls_534284213` | standard |
| Zwei Schriften, Ein Herz | Geheimnis der Sprache | `ls_1786370351359` | conjugation |

Both contain **correct Serbian written in gajica (Latin) rather than Cyrillic** — `miris`, `grad`,
`tišina`, `Reka šapuće priče`, `sam/si/je/smo/ste/su`, `ići/idem/ideš`. The vocabulary and the
grammar are right; only the orthography is wrong for a chapter stamped `cyrillic-sr`. **That is a
transliteration away, not a regeneration** — and the detector cannot tell that case from a genuine
wrong-language one, which is now stated in its "does not establish" block.

### `v80_l` — MEASURED: the learner-known share; and SHIPPED: `PLAN §9c`, the storyline title

#### (a) The learner-known share — TRACK T's `§T5.1` answered, and a harder question raised

`build_history/probe_learner_known_v80l.js`, pinned in `v80l_learner_known.txt`. It runs TRACK T's
own colouring over the REAL history in `learners.json`, driving the product's helpers
(`_storyWordSources`, `qid()`, `_solvedMap`) rather than re-deriving them.

**`§T5.1` — "green = ALL questions, or a fraction?" — ANSWERED: ALL is not a wall. Use ALL.**
A highlighted word carries a mean of **1.70** associated questions and **53.6% carry exactly ONE**.
For most words, "all questions solved" means "the one question solved". The fraction machinery T0
hedges about is not needed for this reason.

**But the same pass raises the harder question, now `§T5.4`.** Over 58 chapters two users have
actually worked, 1484 highlighted words:

```
GREEN   every associated question solved    129    8.7%
PARTIAL some but not all                    107    7.2%
RED     none                               1248   84.1%

chapters showing at least one GREEN word     23 of 58   39.7%
chapters showing NOTHING but red             30 of 58   51.7%
```

**Composed with the density number from `§T2a`: of ~189 words on screen, ~12 are highlighted and ~1
is green.** Over half of worked chapters would show no green at all.

**This is not a bug and the fix is not technical** — 84% red is an ACCURATE report that the work is
unfinished. But T0's premise is that *"progress should be obvious from the greening text"*, and on
this install it would mostly report "you have done almost nothing". **A design and motivation
question, and the user's.**

⚠️ Two users with history, one install. A portrait of THIS install, not a population.

#### (b) `PLAN §9c` — SHIPPED. The title generator was unreachable, not skipped.

`upsertStoryline` seeds `title: chain[0]` — the first chapter's topic name, auto-numbering suffix
and all — when the storyline record is created, which happens **earlier in the same flow** than the
title post-pass. So the `v78_r` guard's question *"is there a title?"* always answered yes and the
`generateStorylineTitle` branch was unreachable for every storyline created that way. **The title
was not skipped because the book was a continuation; it was skipped because a placeholder looked
like an author's work.**

**Option 2 from the diagnosis, as recommended: mark the placeholder.** `titleAuto: true` at both
seed sites (fork branch and plain new-storyline branch), and the guard now requires a title that is
non-empty **and** not a placeholder. **The `v78_r` ruling is not weakened** — that was explicit in
the diagnosis, and an authored title is still never overwritten.

**The other half, which is where this fix could have broken the ruling from the opposite side:**
every authoring path CLEARS the flag — the generated title, the user's edit through
`POST /api/storylines`, and the `storyline-retitle` endpoint. Without that, a book the user named by
hand would be retitled by the post-pass the next time a chapter was added.

**Legacy books are safe by construction.** A storyline created before this flag has no `titleAuto`
at all, and `!undefined` is true, so it reads as AUTHORED and keeps its title. Asserted against the
corpus, not just reasoned: **all 91 existing storylines keep their titles.**

**Guard:** `unit-storyline-title-auto`, five sections, asserting BOTH halves — a fix that only
proved "new books get a title" would re-open `v78_r`. Mutation-tested: removing the flag from a seed
site, or the `!titleAuto` from the guard, each fail it. Section 5 pins that `upsertStoryline` still
seeds no `summary`, since that is what makes the summary guard sound; if it ever starts to, it
acquires this same bug.

**⚠️ Unverified:** whether `generateStorylineTitle` returns a GOOD title needs a live model. What is
asserted is that it is now REACHED, which is the bug that was diagnosed.

### `v80_k` — the roadmap reorganised: a MOVE, not a rewrite

**Measured before acting**, because "the roadmap feels big" is not a finding:

```
lines   1-35    protocol + shipped table
lines  35-604   nine release write-ups        <- 569 lines, 17.5%
lines 604-3243  open work, TRACK T, the folded plan
```

The problem was **position, not size**. A reader following the protocol scrolled 569 lines of
finished work to reach anything actionable — the same rot pattern the v80 cut itself hit, when
"WHERE TO START" had grown three items numbered "0". The rest of the file was healthy: pointers
resolved, eight SUPERSEDED markers all carrying pointers, no contradictions.

**So the release entries MOVED to `# SHIPPED IN THE v80 LINE` at the foot of the file, newest first.
Three blocks deliberately did NOT move** — `§C1`'s non-reproduction, `§0i — RECONCILED`, and `§0`'s
sub-section status — because they comment on the sections directly below them and are meaningless
anywhere else. The protocol block gained a four-row index of the file's own shape, and the RESTORED
warning was updated: it still said reconciling those sections was "the first task of the next
session", which has been done since `v80_d`.

**Verified as a move, not an edit.** Headings before 129, after 131 (one renamed, three added).
Content lines dropped: 10 — all of them the two paragraphs deliberately rewritten. Every one of the
nine release headings present exactly once. **This check exists because `v80_d`'s blanket
`str.replace` silently mangled six sentences including a heading; prose cannot be revert-verified,
so it gets a diff instead.**

**⚠️ NOT cut as `roadmap_v81.md`, deliberately.** The convention is one roadmap per version line and
this is still v80. A `v81` file describing v80 work reads as wrong two cuts later, and the natural
boundary is TRACK T — cutting there gives the new file a real reason to exist and a clean thing to
carry forward.

### `v80_j` — SHIPPED: `PLAN §F3`, the article contradiction removed — and §F3c SHARPENED at corpus scale

#### The measurement first, because §F3c forbids validating this on one lesson

`build_history/probe_article_symmetry_v80j.js` (pinned: `v80j_article_symmetry.txt`). **It is
explicitly NOT language-blind** — "is this an article" is a language fact, so the article lists are
hand-written and live in the probe ONLY, never in `server.js` or `index.html`. Pairs where either
language has no article system (Serbian, Polish, Japanese…) or marks definiteness by PREFIX (Arabic,
Hebrew) are EXCLUDED and reported as excluded, because a bare noun is correct there and counting it
would invent a defect.

```
vocab pairs seen   4643
pairs COUNTED      3069   (both languages use word articles)
ASYMMETRIC           31   1.0%
```

**⚠️ The 1.0% is the least interesting number here. The DISTRIBUTION is the finding:**

```
all symmetric (0%)      191 chapters
partial (1-49%)           4
majority (50-99%)         1
all asymmetric (100%)     2
```

**This sharpens §F3c: the coin is flipped ONCE PER LESSON, not per pair.** A per-pair random effect
would clump around a middle rate; what the corpus shows is the ENDS. The model resolves the
contradiction once and then applies its resolution consistently to every noun in that lesson. Two
consequences worth carrying:

- **A 1% corpus rate and an unusable lesson are the same defect.** Two chapters are 8-of-8
  asymmetric. Averaging hides exactly the cases a learner meets.
- **It explains the user's report precisely** — "chapter 1 bad, chapter 2 fine" is not inconsistency
  in the reporting, it is the shape of the defect.

The asymmetry concentrates where the diagnosis predicts: **German as one side** (`de->en` 5.3%,
`de->it` 2.1%), German being the language whose dictionaries cite `der Hund`.

**⚠️ `tp_17869977371640000022` now measures 0 of 8, where §F3c measured 7 of 8.** The user regenerated
that lesson at the `v80_i` drop. **This is NOT evidence the prompt was fixed — the fix had not
shipped yet. It is the coin landing the other way**, and it is the cleanest possible illustration of
why §F3c says one lesson can never validate anything here.

#### The fix — rule 31 applied, not another prohibition

`prompts.json` `vocab.system`:

- **REMOVED** the contradicting per-side clause from BASE FORM ONLY —
  ~~`nouns in the singular (with the usual article where the language uses one)`~~. This is the
  clause that wins today: it is stated first and framed as definitional.
- **ARTICLE SYMMETRY now says it OVERRIDES each language's own dictionary convention**, and says why
  — removing the contradiction from the prompt is not enough on its own, because the model still
  knows German convention; without this the contradiction simply moves from the prompt into the
  model.
- **Added a WORKED COUNTER-EXAMPLE** showing both the correct pairing (`der Hund` ↔ `le chien`) and
  the forbidden one (`der Hund` ↔ `chien`), naming it as the shape a faithful model produces by
  default. **No new prohibition was added** — that is what made this worse twice.

**Guard:** `unit-prompt-article-rule`. It pins TEXT, which rule 29 warns about, and does so knowingly
— the claim here IS about the prompt's text, and there is no behavioural layer to assert instead
because the behaviour is a model's. Four sections, including a count that **exactly ONE bullet
mentions articles**: a rising count is the signature of the failure mode §F3 names.

**⚠️ WHAT REMAINS UNVERIFIED, and it is the important half.** Nothing here shows the model obeys.
Judging this needs regeneration against a LIVE model across MANY lessons, then re-running the probe
against the 1.0% / bimodal baseline above. **That is the user's step.** Until then the prompt is
consistent and the outcome is unmeasured.


### `v80_i` — DATA DROP + a live progress-integrity bug it exposed

#### The drop, diffed rather than assumed

324 topics / 91 storylines (unchanged), 1072 → **1073 lessons**, **4 topics modified**, none added or
removed.

| topic | change |
|---|---|
| `tp_17864554460460000107` *Ein neues Kapitel beginnt* | **`6:conjugation` DELETED** — the all-Latin Serbian lesson `v79_f` found |
| `tp_17869977371640000022` *Stille vor dem Winter* | `1:standard` replaced by a regenerated standard **+ a new comprehension lesson** |
| `tp_17869990828330000253` *Flucht ins Leere* | synonyms + conjugation regenerated with fresh ids, **+ a `mixed` lesson** |
| `tp_17869980065780000104` *Brücke der Existenz* | synonyms + conjugation regenerated with fresh ids |

**⚠️ The deletion landed in `...0107`, not `...0022`** as the accompanying note said. `...0022` GAINED
a lesson. Recorded because the two are easy to confuse and the note will be read again.

**Still open from `v80_h`:** 6 of 95 lessons in non-Latin chapters carry zero target-script
characters (was 7 — the deleted one). 4 comprehension, 1 standard, 1 conjugation, all Serbian.

**Gate table: NO client drift.** The raw diff against `v80e_card_gates.txt` shows the crossword
column flipping `grey`→`YES` across 16 rows. Re-running the SAME client against the PREVIOUS data
reproduces the v80e baseline **exactly**, so the entire difference is the drop moving the probe's
chapter selection. New baseline: `v80i_card_gates.txt`. **This is the second cut running where that
diff looked like a regression and was not** — the check takes one command and should be automatic.

#### ⚠️ THE FINDING: two lessons in one chapter could share an id, and share a done-flag

Reading the diff showed the two regenerated chapters had previously held **three lessons all with
`id: 6`** — `word_forms`, `synonyms`, `conjugation`.

**Demonstrated, not inferred.** Against the previous corpus: marking ONLY the word_forms lesson done
made the synonyms AND conjugation lessons read as done. Progress is keyed `completed[topic][L.id]`
and item keys are `${lessonId}:i:${hash}`, so the three shared one flag. **A learner finishes one of
three lessons and the chapter believes all three are finished.**

**It is LIVE, not historical.** `server.js` hardcodes `id: 6` for word_forms (3899), synonyms (4151)
AND conjugation (4368) — **any chapter generated with two of those three collides.** The corpus is
clean at this cut only because the user's regeneration happened to assign fresh `ls_` ids. Nobody
was looking for this; it surfaced from diffing a data drop.

**Fixed at `saveStore` — the ONE choke point all 23 write paths funnel through** — rather than at the
six `lessons.push` sites, where a seventh insertion path would reintroduce it. Only duplicates are
renamed and **the FIRST holder keeps the id**, so existing learner progress keyed on it survives; the
later lesson gets a fresh id and starts unsolved, which is honest, since it was never separately
answerable before.

**Guard:** `unit-lesson-id-unique`, five sections. Section 1 asserts **the generators still collide**
— so if someone later gives the three types distinct ids, the guard says so rather than the fix
quietly becoming dead code that still looks green. Others: first-holder-keeps-id, idempotence,
per-topic scoping (the same id in two chapters is legitimate), and the live corpus being clean.

#### Two guards failed on the drop, both honestly, and both are worth reading

- **`unit-lesson-script-output` §1** pinned the reported PAIR — the broken lesson and its
  regeneration. The user deleted the broken one, **which is exactly what the detector exists to
  prompt**, and the section failed. *Pinning a corpus item whose purpose is to be cleaned up is a
  guard that breaks on success.* Rewritten to sweep real `cyrillic-sr` lessons for the absence of
  false positives, with the flagged case synthetic.
- **`unit-story-unlocked-page` §6** — the discriminating section built at `v80_c` — refused to run
  because its precondition (the two resume helpers must DISAGREE) no longer held for the chapter
  `find()` happened to return. **It failed rather than passing vacuously, which is the whole point of
  it.** Now SWEEPS candidate chapters for one that can be put into the state, and asserts one exists.


### `v80_h` — SHIPPED: the fork-marker fallback (`PLAN §9b/D8`), and a NEW defect it uncovered

Both items chosen because they **survive TRACK T**: neither touches the progress card.

#### (a) `PLAN §9b/D8` — the fork marker must DISTINGUISH. Preventive, and now enforced.

**First, the measurement the note asked for.** D8 said the tree still carried the OLD duplicate
titles and that the next drop would bring the rename — *"exactly the kind of quiet data movement the
protocol says to diff for rather than assume"*. Diffed: **the rename LANDED.** "Dough of the Ancients
2" is in the tree and there are **0 duplicate-title groups across 91 storylines**. So this is
preventive, as D8 predicted.

**Shipped:** the marker falls back to naming the BRANCH's own chapter when the other storyline's
title is empty or identical to the open deck's label. The chapter differs per column by
construction, so it distinguishes even when two storylines are titled the same.

**Guard:** `unit-fork-display` §8, and it does **two** things on purpose. It sweeps every real fork
(15 markers) — necessary, but it would pass today and keep passing right until the drop that
reintroduces a duplicate, which is rule 24 in test form. So it **also injects a synthetic duplicate
title and an empty one** and asserts the fallback fires. Revert-verified: with the fallback disabled
the marker reads back the open deck's own label and the section fails.

#### (b) ⚠️ NEW — 7 lessons carry NONE of their chapter's script, and only ONE was known

Looking at `tp_17864554460460000107` (the known duplicate-conjugation topic) showed the expected
pair — the all-Latin `id=6` and the correct regeneration. **It also showed that lesson `id=9`, the
COMPREHENSION lesson, is equally all-Latin on a `cyrillic-sr` chapter.** Nobody had flagged it.

~~Swept: **7 of 96 lessons (7.3%)**~~ **⚠️ CORRECTED at `v80_m`: the real number is 2.** The four
comprehension lessons were NEVER defects — comprehension questions are written in the SOURCE
language by design. See the `v80_m` entry.
Arabic, Hebrew and Japanese chapters are clean.

**Why it went unseen is the interesting part.** `v79_f` fixed the PROMPT and
`unit-script-pin-coverage` guards that all fourteen prompts carry the pin. **But a pin is an
instruction, and a model can ignore it — nothing checked the OUTPUT.** Rule 34: guard at the layer
where the claim is observable. "This lesson is in the target script" is observable in the LESSON.

**Shipped:** `lessonScriptDefect(lesson, script)` in `server.js`, taking the alphabet from
`scripts.json` — **never a hardcoded Unicode range**, so a script added to that file is covered with
no code change (asserted for `arabic`). It yields **no opinion** for Latin, unstamped, or unknown
scripts, and does not claim a nearly empty lesson, which is a different defect.

**Guard:** `unit-lesson-script-output`, on synthetic fixtures plus the one pinned real pair (broken
flagged, regenerated clean). The corpus still holds the 7, so a corpus-wide assertion would be red
on arrival and then "fixed" by weakening it — that count belongs to the probe.

**⚠️ NOT wired into generation.** `lessonScriptDefect` exists and is guarded; nothing rejects or
retries on it, because whether a retry actually converges needs a live model to establish. **That is
the next step, and it is the user's to run.**

**A note on the guard that caught my own mistake:** the fixture builder padded with SPACES, so the
all-Latin fixture had ~85 Latin characters and never cleared the detector's 200-character floor. The
`null` assertions in the section above it passed **vacuously**; the explicit non-vacuity assertion
is what failed and exposed it. Worth remembering next time a non-vacuity line looks like ceremony.

**Not fixed here: the 7 existing lessons.** The detector guards new work. Repairing them means
regenerating user content, and `v79_f` established that deleting or replacing a lesson is asked
about first — **the duplicate conjugation pair in `tp_17864554460460000107` is still two lessons and
still wants a ruling.**


### `v80_g` — SHIPPED: `PLAN §F2`, a word_forms blank must be WHERE A WORD WAS REMOVED

**Chosen because it survives TRACK T.** A malformed item is broken as *structure*, so no
progress-card redesign obsoletes it — and under TRACK T it gets **more** visible, since the learner
reaches it by tapping the word in the text.

**The real finding is not that the items are malformed — it is why they PASSED.**
`validateWordFormsItems` already existed, with salvage steps and a giveaway check. It let
`"...across the path.___"` (answer `cast`) through because **it only ever asked whether a blank
EXISTS, never where it is**, and its giveaway check compares whole tokens, so `casting` ≠ `cast`.
The rule was missing, not broken.

**Shipped:** one structural rejection — terminal punctuation immediately followed by the blank.
No language knowledge (INTERNALS: "no language knowledge in the code"), and it holds for Arabic
`\u061F`/`\u06D4`, the CJK `\u3002`, and fullwidth `\uFF01\uFF1F` as well as `.!?`.

**Measured across the corpus** (`build_history/probe_word_forms_defects_v80g.js`, reports only):

```
word_forms lessons                76
items                            345
items with a structural defect     8   (2.3%)
  ORPHAN_BLANK                     6   (1.7%)   <- now rejected at generation
  ANSWER_SHOWN_STEM                3   (0.9%)   <- measured, NOT enforced (below)
```

**Four of the six ORPHAN_BLANK hits are Arabic**, two English — that cross-language spread is the
evidence the signal is structural rather than an artefact of Latin punctuation.

**⚠️ The stem band is deliberately NOT enforced, and the reason matters.** The first version of the
detector compared the answer against a 4-character slice of each token, which let 1–2 character
tokens match nearly anything: it reported 20 hits, of which eyeballing showed only 2 were real
(`asistiendo` vs `a`, `avrei` vs `a`, `perdono` vs `per`, `there` vs `the`). Tightened to "one whole
word is a prefix of the other, both ≥ 4 characters", it drops to 3 — but prefix-matching **is** mild
morphology, and rejecting on it at generation time would discard good items in
morphologically-rich languages. So it is reported by the probe and left to a human. **A detector
that is 90% noise is worse than none, and that was only visible because the band was sampled rather
than trusted.**

**Guard:** `unit-word-forms-defects` pins the DETECTOR on **synthetic** fixtures, not the corpus —
the corpus still holds those 8 items, so a corpus-driven assertion would be red on arrival and would
then be "fixed" by weakening it. It extracts `validateWordFormsItems` from `server.js` and runs it,
so it tests the product function rather than a copy. Five sections, including a **discriminator**
(a blank immediately before the stop, `"Ieri sono ___."`, must still be accepted — otherwise the
rule degenerates into "reject anything ending in a blank") and a check that the new reason is the
one that FIRES rather than being shadowed by an earlier check. Revert-verified.

**Not fixed here: the 8 existing corpus items.** The rule guards NEW generation. Cleaning the corpus
means editing or regenerating user content, and `v79_f` established that deleting a lesson is asked
about first.


### `v80_f` — MEASURED: the inflection share. The text-focus design's ceiling is a GENERATION problem, not a matching one

**Taken before designing anything**, because it decides whether "the text turns green" is expressible
on the existing corpus. Instrument: `build_history/probe_inflection_v80f.js`, output pinned in
`build_history/v80f_inflection.txt`. **It reports; it does not assert.** Its middle bands are edit
distance and shared stems, which are not morphology — read the bands, never a single number.

Over **301 chapters / 6,707 highlightable words** (the exact set the app renders: vocab targets plus
every `_storyWordSources` word):

```
EXACT     whole token in the story              36.8%
SUBSTR    inside a token (compound)             10.5%
--------  WHAT THE APP MATCHES TODAY            47.3%
NORM      matches once apostrophes/dashes fold   0.2%   <- free, and NEGLIGIBLE
NEAR/stem shares a stem with a token             9.5%   <- credible inflection
NEAR/edit only within edit distance              6.6%   <- mostly noise
ABSENT    nothing in the story resembles it     36.4%   <- THE CEILING
```

**The headline is ABSENT = 36.4%.** More than a third of the words a chapter teaches do not occur in
its story **in any form**. No matcher — lemmatiser, LLM, or otherwise — can turn those green, because
there is nothing to turn. That is not a matching defect; it is the generator writing vocabulary the
story does not use, and it lands squarely on `PLAN §F3`'s prompt work.

**A matcher is worth about ten points, not fifty.** 47.3% → **56.9%** on the credible band
(stem-sharing), or 63.6% if the edit-distance band is trusted, which it should not be: its own
samples include `chaud→chaque`, `vois→fois`, `sais→mais`, `klein→ein`. The apostrophe/dash
normalisation band was measured on the suspicion that it was a free win — it is **0.2%, 14 words**.
Measured rather than assumed, and it is not worth a line of code.

**Inflection load differs enormously by language, so one policy will not fit:**

| lang | n | matched today | + stem band | ABSENT |
|---|---|---|---|---|
| `en` | 2174 | 58.0% | 4.8% | 31.9% |
| `it` | 1587 | 43.8% | 15.1% | 35.9% |
| `de` | 965 | 37.6% | 9.8% | 46.5% |
| `ar` | 561 | 45.3% | 5.0% | 30.8% |
| `sr` | 507 | 31.6% | 17.6% | 43.2% |
| `fr` | 390 | 42.1% | 11.3% | 42.3% |
| `lb` | 231 | 63.2% | 4.8% | 26.4% |

`en` needs almost no matcher (4.8% stem band); `sr` and `it` are where a matcher pays. `de` has the
worst ceiling at 46.5% absent — consistent with separable prefixes and compounds, but **this probe
cannot tell that from bad generation, and should not be read as if it could.**

**⚠️ Two defects in the probe's FIRST version, fixed and worth carrying as a lesson.** It keyed the
space-less-script exclusion on the topic's `script` stamp — but only **19 of 324 topics carry one**
(it is stamped where a language has a script CHOICE, i.e. `sr`), so all **13 Japanese chapters were
scored with a token model that cannot apply to them**: the precise error the exclusion existed to
prevent, committed by the exclusion itself. Now keyed on `lang`, and the 13 are reported apart
(30.5% by substring, on 177 words). **A guard that reads the wrong field is worse than no guard.**

**What this means for the design.** The proposal's *"we could use the current highlighting approach
to map questions to the text"* holds for roughly half the vocabulary and cannot be pushed past ~57%
by matching alone. The two levers are ordered by payoff:
1. **Generation-side mapping** (the proposal's own later bullet): have the model emit the surface
   form as it appears in the text alongside the base form. This addresses the 36.4% as well, because
   a generator asked to anchor its vocabulary in the text stops producing unanchorable words.
2. **A matcher** (LLM or lemmatiser) for the existing corpus, worth ~10 points, per-language.


### `v80_e` — SHIPPED: ONE starter card per chapter (user ruling on the `PLAN §C2` / §0c reversal)

**The reversal is ruled: MERGE.** `PLAN §C2` asked for the "next chapter unlocked!" card to be
*"removed from the flow, going straight to the next entry card"*. **That sentence could not be
executed as written**, and the reason is a ruling of the user's own: `v77_q` had made the unlocked
card the STARTER for chapters 2..N and reduced the entry card to chapter one only
(`_enterViaSummaryCard` bailed on `me > 0`). So for every chapter after the first there WAS no
"next entry card" to go straight to — removing the unlocked card would have deleted the starter for
most of the corpus and dropped learners into a lesson unannounced, which is precisely what `v77_i`
was built to stop.

**What shipped.** The entry card is generalised to every chapter; the unlocked card is deleted.

- `_enterViaSummaryCard` no longer bails on later chapters. Its gate is now *"would this card carry
  anything?"*: **a summary exists, OR this is not the first chapter.** That reproduces BOTH previous
  behaviours rather than picking one.
- `showComplete`'s next-chapter branch opens the chapter directly. The target is still stashed at
  RENDER time (`APP._unlNext`), which is the part of `v77_i` worth keeping — the render and the
  click cannot name different chapters.
- `showStorySummary` picks its title by arrival: `unlocked.title` when carried here by finishing the
  previous chapter, `summary.title` on a plain entry. A new `#sum-chapter` line names the chapter,
  carried over from `#unl-chapter` with its styling.
- `showNextChapterUnlocked()`, the `unlocked-screen` markup and `APP._skipEntryCard` are **deleted**.
  The flag existed only to stop the two cards stacking; with one card there is nothing to stack.

**⚠️ The measurement that shaped the gate.** Gating on the summary ALONE — the obvious reading of
"go to the entry card" — would have silently dropped the acknowledgement for every later chapter of
a summary-less storyline. Measured at this cut: **14 multi-chapter storylines have no summary,
covering 25 chapters at index ≥ 1.** That is why the `|| isLater` clause exists, and
`unit-next-chapter-entry` §4 asserts it **on a storyline chosen for having no summary**, with §5
asserting the other half (a summary-less FIRST chapter still gets no card, so the rule is not
simply "always show").

**No translate pass.** The `unlocked.*` keys are **reused, not orphaned** — all four are translated
in all 32 languages, and the merged card needed exactly the wording they already carried. Dropping
them would have wasted 128 translated cells and adding replacements would have cost 33 languages.

**⚠️ DELIBERATELY LOST, recorded rather than implied.** The old card's ← ("back to the chapter you
just finished") is gone. After the merge the learner has already moved to the next chapter by the
time the card renders, so a back link there would return them to a card for the chapter they are now
IN. The header title still reaches the storyline, from which the previous chapter is one tap away.
**If the user wants that link back, it needs a different mechanism, not a revert.**

**Guards.** `unit-next-chapter-unlocked.test.js` (v77_i) is **replaced by
`unit-next-chapter-entry.test.js`** — the screen went, the CLAIM did not, so the file asserts the
same guarantee against the merged card in six sections. Mutation-tested: dropping `|| isLater`,
restoring the `me > 0` bail, and dropping the chapter name each fail it. `unit-story-summary`'s
"does not stack a second interstitial" section is **WITHDRAWN with its reasoning** — the condition
cannot occur any more — and re-asserted as the property that now matters, plus a pin that
`_skipEntryCard` has not come back. `smoke-render` drops `unl` from the five-card header parity
sweep and now asserts the old id has not returned.

**Gate table: no drift.** `probe_gates_v77.js` re-run and diffed. The raw diff against
`v80_card_gates.txt` shows a column flipping `YES`→`grey` across 16 rows, which reads as a
regression and is not one: that baseline was generated on the OLDER 321/90 corpus, so the probe
now SELECTS a different chapter. Re-running the probe against the PRE-MERGE client on the
CURRENT corpus gives **32 of 32 rows identical**. New baseline: `v80e_card_gates.txt`.

**⚠️ TRACK T (added at the `v80_f` cut) names this card's COPY for removal** — "Kapitel freigeschaltet!" among it. The structural win here (one starter card per chapter) is NOT superseded and TRACK T depends on it; the title and copy are. See TRACK T §T3.

**Still open in `PLAN §C2`:** the third progress bar, the chapter title in the bottom row,
"text comprehension" labelling, the summary uncollapsed by default. Its last bullet — *"chapter
entry cards ≥2 remodelled to match chapter 1"* — is **largely discharged by this merge**, since
those chapters now use the entry card itself.


### `v80_d` — SHIPPED: the document set consolidated from four to two

**Four documents held the same facts and the durable one was the least complete.** The two `v80`
diagnoses landed in `HANDOVER.md`, the session prompt and the plan, and were **missing from this
roadmap** until someone noticed. That was the argument, and it is now closed.

- **`implementation_plan.md` — FOLDED IN and DELETED.** It lives in "THE LARGER PLAN" below. Its
  section labels are preserved with a `PLAN §` prefix, because the plan's bare `§0/§1/§2/§3`
  collide with this roadmap's own. **A bare `§3` is the highlighting item; `PLAN §3` is Track C.**
- **`HANDOVER.md` — MERGED into the session prompt and DELETED.** Verified first: **zero references
  from `test/` or any `.js`/`.json`/`.html`**; the mentions were prose.
- **`SESSION_PROMPT_v79.md` was still present**, two cuts stale, though the convention says the
  prompt is RENAMED at each cut and not kept alongside. **Found by the new guard, not by reading.**
  Archived as `v79_prompt.md`, matching the older convention the `v74`–`v78` prompts already use.

**Three duplications inside the plan were resolved on the way in, not silently:** `PLAN §2.6` and
`PLAN §2.7` each appeared **twice, byte-identical** (verified by comparison, not by eye) — one copy
of each dropped; `PLAN §2.5` appeared twice with **different content**, and both are kept with the
superseded one struck and pointed at the correction.

**`unit-roadmap-version` now guards the NUMBERS, which is what makes this honest** (rule 24: a note
is not a guard). Prose work cannot be revert-verified the way code can, so the consolidation would
otherwise have ended as a green suite, a lot of churn, and no evidence. It now pins:

- the prompt's `expect NNN checks` against **run.js's actual `run()` count**, full and `--quick`,
  derived statically because this test runs *inside* the suite it would otherwise spawn;
- the prompt's four corpus numbers against `lessons.json`, `languages.json` and `ui.json` — the
  exact things that rotted (`HANDOVER.md` said 321/90 while the tree held 324/91, written **four
  minutes after** `lessons.json`, so the number was carried rather than measured);
- the prompt's `APP_VERSION` against `server.js`;
- that **exactly one** session prompt exists, and that neither deleted file has been recreated —
  named explicitly, so restoring the second home for open items has to be a decision rather than a
  drift.

**Mutation-tested in both directions:** a stale number in the prompt fails it, and so does a real
change to the suite with the prompt left alone.

**⚠️ One scar worth carrying.** A blanket `str.replace` across four documents, rewriting a filename
to a phrase, silently mangled six sentences including a heading — *"folded in from the folded THE
LARGER PLAN section"*. It was caught by grepping for the replacement afterwards. Rule 25's cousin:
**check what a mechanical rewrite DID, not just that it ran.**


### `v80_c` — SHIPPED: `unit-story-unlocked-page` §6 now discriminates, and it closes an open question

**The guard that could not fail, carried since `v77_p`, now fails under revert.** It had asserted
`APP._started === _firstUnfinishedLessonIdx(...)` — the product compared against the same product
function. Its own note said two earlier attempts had concluded the below-mark branch "was never
entered". **That was half right, and the missing half was the section:**

1. **The branch IS entered** — through `index.html`'s
   `nextLessonIdx === C.lessonIdx && !C._review && _isStoryGatedLesson(lesson)` line, which forces
   `nextLessonIdx` to -1 for a learner who has just played the comprehension lesson without fully
   solving it. **That is the state the user reported from**, which is why scenarios built around a
   lesson not yet played could never reach it.
2. **The two candidate targets have to be made to DISAGREE.** An unplayed lesson sits at 0%
   coverage, which is *also* the least-covered — so both orderings return the same index and any
   assertion passes either way. They separate only when the gated lesson is PARTLY solved (still
   unfinished, its done-flag withheld until every item is solved) while an earlier lesson is
   covered LESS.

Revert-verified both ways: with `v77_p`'s ordering swapped back, Next goes to lesson 0 — **the
user's reported bug, reproduced** — and §6 fails. Three non-vacuity assertions guard the setup, and
one of them (`APP._usNextLesson === undefined`) pins that the below-mark branch is the one answering,
so the section cannot silently drift back to measuring the easy branch.


### `v80_b` — SHIPPED: a story-gated lesson is not a Replay target while the story is locked

**`PLAN §C1`'s SECOND bug, reproduced, fixed and revert-verified.** The user's
report: *"via the replay button or otherwise, I could play the comprehension lessons BEFORE the
chapter-story was unlocked."*

**Cause, measured rather than guessed:** `_firstUnfinishedLessonIdx` has applied a story-lock
filter since `v71_s`. `_firstCoverageShortLessonIdx` — which the Replay button reaches through
`repeatForCoverage`, and which the below-mark Next branch falls back to — **never applied it**. The
rule existed in one of the two resume paths. `v78_l` then made that scan prefer the LEAST-covered
lesson, and an unplayed comprehension lesson sits at 0%, which is the lowest fraction there is — so
the ordering change quietly made the missing gate easier to hit.

**Measured on the corpus** (`build_history/probe_gates_v80c1.js`), from an ORDINARY half-played
chapter — no constructed state, just a learner part-way through the first lesson:

```
chapters with a story-gated lesson                    102
  Replay opens a gated lesson, story locked (before)   27 of 94 partly-played
  Replay opens a gated lesson, story locked (after)     0
```

**The fix is one rule, not two copies.** The filter moved out of `_firstUnfinishedLessonIdx` into a
top-level `_storyLockedLesson(L, d)` that both scans call. **Two guards had to be re-wired and the
reason is worth carrying:** `unit-learner-nav` EXTRACTS `_firstUnfinishedLessonIdx` and evals it
standalone, so the rule used to travel with the function; it now splices `_storyLockedLesson` in
alongside it, **deliberately not a stub** — a stub would let that section pass while the real rule
was broken. `unit-replay-target`'s ordering fixture was passing on an accident: it has no story and
no progress, so the real `storyUnlocked()` said "locked", and the sections that mean to measure
ORDER would have started measuring the GATE. It now sets the gate state explicitly, and a new §8
asserts the new rule **with the discriminator built in** — the same fixture, locked and unlocked,
must give different answers (rule 33: a green guard near a defect is not evidence about it).


### ⚠️ CLOSED — the "`_firstUnfinishedLessonIdx` returns -1 with a lesson still unplayed" defect

Carried in the session prompt ("One OPEN DEFECT the user is watching for", in `HANDOVER.md` until it was folded in at `v80_d`) and `INTERNALS.md` §2 since
`v77_s`, with `if (setComplete(d)) return -1;` named as the prime suspect. **Measured this session:
the helper is not the thing returning -1.** In every state built here it returned the correct index
(the comprehension lesson). What goes to -1 is `showComplete`'s **local** `nextLessonIdx`, set
deliberately by the `v71_s` line above — so the symptom is real, the attribution was wrong, and
there is no defect in the helper to chase. **`v77_s` did not cure it; it was never broken.**

The behaviour that line produces is now under test by §6 rather than merely described.

