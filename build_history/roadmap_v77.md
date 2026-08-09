# Roadmap — v77 line

Current cut: **`v77`**. Baseline `node test/run.js` **182**, `--quick` **158**, `check-inline` 0 on
both builds.

> **Carried forward from `roadmap_v76.md` in full.** Everything below — the session protocol, the
> fifteen standing rules, and every open item — survives the base cut. The shipped table lists the
> v76 line for context; new releases are appended above it.

> **Carried forward from `roadmap_v75.md` in full, from §3 onward.** The v71→v72 boundary lost three
> items that were only recovered in `v73_k`; everything still open is reproduced below rather than
> referenced. `roadmap_v75.md` remains for the shipped table and the session-28/29 rules.

## Shipped after the v76 cut

| release | what |
|---|---|
| `v77_p` | **(user) Four more.** (a) **Next opens UNPLAYED work first.** `v77_o` preferred a coverage-short lesson, so on a chapter whose story had just unlocked Next replayed earlier lessons instead of opening the comprehension questions — the learner had to press Replay to get past their own replays. Order is now: first unfinished lesson → coverage-short → re-render. (b) **No story PREVIEW at all.** The panel appeared while the story was still LOCKED, truncated, for teacher/canGenerate, pushing the vocabulary below a paragraph the learner is not meant to read. It now appears ONLY on a genuine unlock. (c) **The headline fraction counts CHAPTERS, not lessons** — unlocked chapters, in `_slProgressStats`/`_slProgressLabel`, so the storyline page and every card change together. (d) **The entry card shows the real progress bars**, via the same `_compProgressHtml`; §0c's "bars empty" was right when the page only preceded the first question, but it is now the entry point for every visit including resuming. **Known gap: the ordering claim in (a) is asserted as a RESULT but does not discriminate under revert** — see the note in `unit-story-unlocked-page` §6. |
| `v77_o` | **(user) Four items.** (a) **The entry card is laid out like every other progress card** — storyboard, bars, summary, actions, title at the bottom; its own 📖 icon is gone (the storyboard is the picture). The storyboard comes from the SAME `_renderCompStoryboard`, now taking an optional target id, rather than a second implementation. (b) **The static build now opens on the entry card too.** `build-static.js` re-implements `loadSaved`, so `v77_k`'s entry point had landed in `index.html` only — **rule 15 again, third time**. Both now call the same `_enterViaSummaryCard`. (c) **LIVE-mode fix (user-reported): the finished card's chapter drop-downs were EMPTY.** The live `/api/lessons` list is a PROJECTION with `lessons[]` metadata-only and **no `story`**, while static ships whole topics — the v55_s / v74_i asymmetry in a third place. Chapters are now hydrated (STATIC_LESSONS, then `/api/lessons/load`), cached, with the card rendering immediately and re-rendering when the fetches land. Reproduced against a real projection and revert-verified. (d) **NEXT IS NEVER GREYED** (user ruling): below the mark it leads to a COVERAGE-short lesson first — so a mixed round re-samples toward what is not yet solved — then the first unfinished lesson. `v71_d`'s principle is kept (Next means forward, never silently Repeat); the dead arrow is gone, and six guards were replaced behaviourally. |
| `v77_n` | **(user) The card header finally matches the storyline page, and the verdict moves to the bottom.** (a) `align-items:stretch` on `.card-screen`: the card screens ARE the `.screen` element, and `.screen` is a **centring** flex column, so every direct child shrank to its own content width — the header rendered as a narrow centred pill while the storyline page's spanned the full column. The storyline page never showed this because it nests its content in a full-width `.sl-screen` inside its `.screen`. **Copying the header markup verbatim could never have fixed this**; it was the container. (b) The progress message ("Mach weiter!" / "Lektion abgeschlossen!") moves BELOW the play buttons on every progress card — it is a verdict on what just happened, not a heading for what follows, and putting it first pushed the storyboard and bars down so the card did not open like the page. Order is now header → storyboard → bars → story → words → icons → actions → verdict. Both revert-verified. |
| `v77_m` | **(user, from a browser pass) Three fixes.** (a) **Row order now MIRRORS THE STORYLINE PAGE** — title+bar → storyboard → chapter-wise bars → story (+vocabulary) → icons → buttons — so moving between the two screens jumps in neither width nor order. `v77_l` had put the story directly under the title, which led the card but no longer matched the page; §0d's principle is unchanged and still asserted (the story precedes the icons and the action row). (b) **The story-finished card no longer fires on a STALE done-stamp.** `chapterComplete` trusts a cached `chapterDone` stamp whose lesson count still matches, and a stamp outlives the progress it described; for every other caller that is the right trade, but for the end-of-story celebration it retires a story with chapters still unplayed. The celebration now requires the done-FLAGS, and an unverifiable chapter counts as NOT done. (c) **The story-unlocked page highlights vocabulary**, via the same `_highlightVocabHtml` two-shade pass the progress card panel has had since `v74_n` — the same story was lighting up on one screen and not the other, on the page whose whole job is reading it. |
| `v77_l` | **§0d — THE STORY LEADS, and `v74_l`'s hide-list is RETIRED (ruling 1).** The card ran storyboard → bars → verdict → icons → buttons → *then* the story: the thing the whole lesson flow exists to deliver arrived last, under a screenful of machinery. It now runs **verdict → THE STORY → the words in it → storyboard → bars → icons → actions.** `v71_m`'s point survives inside the lower group (bars still precede what describes them); the group moved below the text. Ruling 1's hide-list is gone — **Replay is always available and Next is no longer the only route out**. §0d removed the PREMISE rather than the buttons. Measured: **exactly 8 of 32 rows changed, repeat/drill `-`→`YES` in each**, matching `v77_e`'s prediction. Five guards updated behaviourally, none re-pinned. |
| `v77_k` | **(user) One column for the whole walk, and the entry card becomes the ACTUAL entry point.** (a) The 540px cap moved off `#complete-screen` onto a shared **`.card-screen`** worn by all five card screens — the four pages added in `v77_f..v77_j` had **no width rule at all** and sized to their content, so entering a lesson jumped the column and moved the title line. Now the storyline page, the entry card, every progress card and the final card share one column and one inset (`.comp-body` == `.sl-screen-body`). `v71_p`'s guard was widened from "the result card matches" to "EVERY page matches, and each one wears the class". (b) **`loadSaved` now opens a chapter on the summary card**, whose forward starts the lesson — §0c's "the FIRST page … before any question". Skipped when the storyline has no summary (37 of 84) and when arriving from the next-chapter-unlocked card, so two interstitials never stack. Decision extracted as `_enterViaSummaryCard` so the guard calls the product rather than a copy; guard drives the real `loadSaved` with `fetch` stubbed. 1 new `en` key (`summary.start`). |
| `v77_j` | **§0c's THIRD PAGE — the story-unlocked card. THE WALK IS NOW COMPLETE.** The moment the story becomes readable — what every prep lesson was for — was only ever a panel among the bars and buttons. **User ruling: the page "sits beside it"** — the panel STAYS on the progress card and is asserted to stay; this page gives the moment a page of its own, with the story as the only thing on it. Shown when the prep gate flips and work remains, **once per chapter** (`APP.progress.storyShown`), then → continues into the lesson the card resolved, so forward never skips one. Reuses existing `en` keys — no new i18n. Revert-verified. Honest finding recorded: the `!C._review` condition is **defence in depth, not load-bearing** — measured, a review render leaves `nextLessonIdx` at -1, so the branch is unreachable there anyway, and the guard says so instead of claiming credit. |
| `v77_i` | **§0c's FOURTH PAGE — the next-chapter-unlocked card.** Finishing a chapter opens the next one, and that moment passed SILENTLY: Next called `loadSaved` directly and the learner arrived mid-lesson without being told what they had earned. Next now goes through a card that names the chapter and shows the position along the deck, then carries them in — **same Next, same destination, one acknowledgement in between**; ← returns to the progress card. The target is stashed at RENDER time (`APP._unlNext`) rather than re-resolved by the card, so the two cannot disagree about which chapter is next (the reason `v74_o` reused `APP._compBack`). Revert-verified; gate table identical. 4 new `en` keys. One more `unit-learner-nav` source pin retired behaviourally — the `loadSaved` call it matched moved into the card. |
| `v77_h` | **§0c's FIRST PAGE — the story-summary card**, plus the first link of the navigation spine. New `summary-screen`: the storyline summary in the SOURCE language (it is authored there — measured, 47 of 84 storylines carry one), the chapter count, and the **progress bar EMPTY**, because this page sits before any question of the chapter. Reached by a new **`comp-prev`** ← on the progress card and returns by →. **A new id, not `comp-back`** — that was deleted in `v71_k` and its absence is asserted deliberately, so the spine is BUILT. The control is **hidden** when the storyline has no summary (37 of 84), so it can never lead to a blank page. Direction is taken from the client's one `RTL_LANGS` rule rather than a second spelling. Both halves revert-verified; the gate table diffs identical. 4 new `en` keys. |
| `v77_g` | **The story PANEL is renamed to `comp-story-panel`** — §0c's prerequisite. The old id claimed "the story is unlocked", but the panel is shown while the story is still LOCKED (a truncated preview for teacher/canGenerate) in most of the 24 of 32 rows it appears in, and §0c's genuinely distinct story-unlocked PAGE would have collided with it. It is the whole bordered panel: the caption and `comp-story-text`/`-spk`/`-xlate` are children. Pure rename, proven so — the corrected gate table diffs identical in every state cell, only the column name moves. `unit-card-consistency` now sweeps the client for the old id, because a half-done rename is INVISIBLE otherwise: the stub DOM auto-vivifies any id, so a leftover lookup returns a live-looking element for ever (rule 16). Caught on the way: the explanatory comment naming the old id failed that very sweep — session-29 rule 1, arriving exactly as written. |
| `v77_f` | **§0c's LAST PAGE — the story-finished card.** New `finished-screen`: festive icon, the whole story chapter by chapter (native `<details>`, so it collapses without script and survives the static build), the **cumulative** vocabulary learned across the story, Back to the progress card and onward to the storyline. `showComplete`'s terminal branch now leads here **when the story is genuinely finished**. **Ruling 2a is applied to ONE path deliberately:** the terminal branch also fires for a learner who finished the LAST chapter with earlier ones unplayed, where celebrating would be a lie — that case keeps `v74_o`'s hand-off. Both halves clicked and revert-verified. Found on the way: reading `_storyDone` at the Next wiring is a **temporal-dead-zone throw** (it is declared 59 lines below — the v68.1 shape in the v68.1 function), and the obvious fix duplicates the rule, so `_storyAllChaptersDone(slCtx)` is now the single reader for both sites. The `v77_b` ledger asserted empty across the walk; verified against `docs/index.html` too. 4 new `en` keys. |
| `v77_e` | **Docs only, no product change, no version bump. The card truth table is REGENERATED** as `v77_card_gates.md`; `v76_card_gates.md`'s table is superseded. Findings 2 and 5 audited and both were the same class of artefact — `comp-storyboard` renders fine once `APP.savedList` is seeded (the renderer uses `appendChild`, so the stub's `innerHTML` reads empty even when the board is there), and the learner/teacher asymmetry all but vanishes once every store is written. **Finding 6 withdrawn:** `v74_l`'s hide-list is not "barely observable" — measured by neutralising it, it changes **8 of 32 rows**, hiding three otherwise-live buttons in each. New probe `probe_gates_v77.js` asserts element existence in the markup and seeds every store the card reads. |
| `v77_d` | **Docs only, no product change, no version bump.** §0d's open question answered: **`comp-drill` is not dead.** The gate table's "never once enabled in 32 rows" was a third seeding artefact — the drill reads `APP.progress.learned[lang\|srcLang]`, which the probe never wrote, so grey was the correct answer to "this learner has nothing to drill". With the real writer (`recordLearnedFromLesson`, 2 wrong answers) the button is LIVE. **`unit-card-consistency` §4 had asserted this since `v71_h` and was green throughout** — a passing test and a "measured" table contradicted each other for a release. Probe preserved as `probe_drill_v77d.js`. |
| `v77_c` | **§0b, second half — the coverage key-space question is SETTLED as a seeding artefact.** `v74_c` moved coverage onto SOURCE ITEM keys (`lessonId:i:hash`) while round assembly kept QUESTION ids (`lessonId:type:hash`); the two spaces are **disjoint**, so the v76 probe's 86 seeded qids counted 0 against a 31-item total. `markSolved` writes both, so no learner was ever affected — driven through `buildExercises`+`markSolved` with no seeding, coverage converges 62→95→95→100 and unlocks in 4 rounds (builders SAMPLE, so replaying is the designed way up). New guard `unit-mixed-unlock-reachable` drives the real solve path, because seeding is the mistake that produced the question. |
| `v77_b` | **§0b, first half — the 7 swallowing `catch(_) {}` blocks in `showComplete` are visible.** Each now reports site + message to a per-render ledger (`_cardErrors()`); `APP._cardStrict = true` rethrows at the site. **Default behaviour is unchanged** — still swallowed, just no longer invisible. `var` not `let` for the ledger, deliberately: `v68.1` was a TDZ crash in this very function. Call sites are `typeof`-guarded per the harness convention. Measured after: **0 swallowed errors across 1216 renders over all 304 topics**, and the `probe_gates_v76` truth table diffs identical. Found on the way: **`comp-back` and `comp-story` do not exist** — two columns of the "measured" gate table are stub-DOM phantoms. |
| `v77` | **Base cut.** The `v76_k` static-build fix, folded into the version bump. |
| `v76_k` | **The `v76_e` bug was still live in the published `docs/` build** (user-reported). `build-static.js` carries its OWN copy of `loadSavedList` which overrides the client's, so the fix landed in `index.html` only. Same duplication hazard as `v76_b`. Now guarded by a test that drives **the built artefact** (`loadClient({file})`), because every source-level assertion about `index.html` passed throughout. |
| `v76_j` | **"Continue story" landed with an empty "continue from" field** (user-reported, `sl_9302163`). `continueFromLesson` switched the TARGET language — which repopulates the menu — before switching the SOURCE, so the menu was built for a pair with no chapters and the chapter's own option never existed. Only a mixed-language storyline can show it. Plus the **pin**: arriving by this route fixes the story, it is offered whatever the language filters say, and it is cancelled by the ✕ or by "— new story —" (persisted, user's rulings). Note: the reordering is defensive and NOT independently observable — the pin subsumes it, and the test says so. |
| `v76_i` | **The script picker.** Rendered under each language select, only when `scripts.json` `_scriptChoice` lists that language, labelled `Cyrillic`/`Latin`. **Inherits from the chapter being continued**, explicit pick only for a brand-new story (user's ruling); an explicit pick is the per-chapter override. Because `continueFromLesson` prefills the landing form rather than opening its own dialog, "new story" and "add chapter" share one control. New `en` key: `form.script_pick`. |
| `v76_h` | **The model is told which script to write in.** `langName(code, script)` — the choke point every prompt fills `{L}`/`{S}` from — now names it (`"Serbian (written in Cyrillic script)"`), plus a `story.scriptNote` consistency rule. `script`/`srcScript` accepted at `/api/generate`, **validated against scripts.json rather than trusted**, threaded through the generator opts, and persisted on the topic so the next chapter can inherit. Found on the way: a `ReferenceError` in `generateErrorHunt` swallowed by its own catch, and `fake-ollama` truncating logged prompts at 400 chars, which made any tail assertion vacuous. |
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

**Not part of this ruling, ship regardless:** the apostrophe bug. Vocab stores `l'evoluzione` with
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
  separate nicety. **`v77_f` deliberately did NOT attempt it** on the story-finished card: ordering
  there before §3 exists would guarantee the two disagree. That card lists every solved item across
  the story in deck-then-lesson order (133 words vs 24 for a single chapter, measured), which is the
  cumulative half of this item done; the ORDERING half is still open.
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
> **RULED (session 30 — see §0a ruling 3): article noise stays accepted.** Take **whitespace
> splitting** (`+782`, 96 chapters), NOT the composed version — the mark means "something from your
> vocabulary occurs here", not "you have learned this word". Consequence: **no article set is
> needed at all**, so the corpus-derived `es/it/ar` article work below, and the `reti`/`per` false
> positives and threshold tightening it wanted, are not required for this. Keep "also mark
> articles" reversible — the user's word is "ok for NOW", with an LLM pass judging which
> vocabulary a lesson actually covers as the intended later refinement. The apostrophe fix
> (U+0027 vs U+2019) ships regardless: it is a defect, not a judgement.
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
   implicitly `a`, so the sequence is `v77` → `v77_b` → `v77_c` → … — the same convention the v69–v76
   lines ran. **This is the `v77` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v77 line.
   (This paragraph is the one version-specific line in the block and has shipped stale THREE times —
   `roadmap_v73.md` said "the `v72` line", and `roadmap_v76.md` said "the `v75` line" for its whole
   run until session 30 caught it. **It was updated deliberately at this cut. Check it again at the
   next one.**)
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

(If you add a new standing rule, append it here so the next session inherits it.)
