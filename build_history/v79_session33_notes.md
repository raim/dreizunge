# Session 33 — the `v79` line

Opened at the `v79` base cut. **Seven releases: `v79_b` through `v79_i`.** One ruling asked for and
given, one stale instruction found in the session prompt, the per-text learning scheme discussed
rather than built, then two data drops and a user bug list. Baseline 206 -> 212 checks, and
**six new standing rules (29-34)** — more than any session since 28, all of them earned from tests
that broke while their claims stayed true.

---

## 1. The baseline was green, and the corpus numbers agreed with `HANDOVER.md`

| check | expected | measured |
|---|---|---|
| `node test/run.js` | 206 | 206, all passed |
| `node test/run.js --quick` | 182 | 182 |
| `node test/check-inline.js` | 0 | 0 (1 block, 948,566 bytes) |
| `node test/check-inline.js docs/index.html` | 0 | 0 (1 block, 6,916,410 bytes) |
| corpus | 315 topics, 88 storylines | 315 / 88 |
| languages, `ui.json` `en` keys | 33, 617 | 33, 617 |

`unit-script-choice` reported `1 known-mixed`, which is the expected `reinforce` chapter. **Neither
fixer was run**, and neither needed to be — the point of checking the counts and the mtimes first
(rule 23) is that there was nothing to diagnose.

Worth recording for the next data drop: `scripts.json` (Aug 11 05:39) and `docs/index.html`
(Aug 11 05:52) are NEWER than `index.html` (Aug 10 13:59) and `server.js` (Aug 10 17:32) at this
cut. That ordering looks alarming under the mtime rule and is not: `docs/` is the newest file
because it was rebuilt last, which is exactly what a correct tree looks like. **The mtime rule
identifies which file a FIXER rewrote; it does not say the build must be older than its inputs.**

## 2. The session prompt was stale against its own cut — three items

The prompt's item 3 said regenerating `tp_17863746762340000193` was owed by the user, and put the
mixed-script lesson and the `cyrillic-sr` sounds column under "not in scope". **All three had been
withdrawn by the user after the prompt was written**, and the tree already carried the corrected
reading in three places: `roadmap_v79.md` open item 2, `HANDOVER.md` ("Nothing is owed by the
user"), and `unit-script-choice.test.js:157`, which lists the id as `EXPECTED_MIXED` with a comment
saying the entry should go when `reinforce` goes — not when the chapter is regenerated.

The `cyrillic-sr` column is the sharper case: it is not deferred, it is **barred**. Its absence
enforces the `v75_g` ruling pinned in `unit-intro-script`, a column was authored at the v79 cut and
reverted, and adding it would silently reverse that ruling. "Not in scope" and "the guard will stop
you" are different states and the prompt recorded the weaker one.

**What survives of item 3 unchanged:** if a SECOND mixed id ever appears it means the fix did not
hold rather than that the list should grow — still right, now for a different reason. A second id
means a second script-switching storyline, not prompt drift.

This is `HANDOVER.md`'s own instruction working: *"Every session prompt so far has quoted a count
that was right when written and stale when read. If a prompt and this file disagree, measure."* It
applies to instructions as well as counts.

## 3. `v79_b` — `useFullChain` now does what its label says

### The ruling

Presented with the two options and measured costs; the user ruled **make the label true**.

### What was wrong

`generate()` chose between the parent chapter's story in full and its last `OLLAMA_MAX_PREV_STORY`
(800) characters. `_chainStory` — chain-wide, with a chapter count and a budget — is built ~200
lines LATER and feeds lesson generation only. So a continuation was written from one chapter of
context however the box was set.

### Three measurements taken before the ruling, because they change the decision

Over the 236 corpus continuations whose parent resolves:

```
chapter story length          min 67   median 749   p90 2334   max 4691 chars
box ON  (parent in full)      median 671   p90 2892   max 4691
full chain (all ancestors)    median 3297  p90 8021   max 43312
growth vs today               median x3.3  p90 x15.5
parent <= 800 chars           128 of 236 = 54.2%
```

- **For 54% of continuations the checkbox was a no-op.** The parent is shorter than the tail budget,
  so "full" and "last 800" are the same string. That is why the defect needed a user report: it is
  invisible on more than half the corpus.
- **The label was promising about 3.3x the context it passed** at the median.
- **The story call passed no `ctxTokens`.** `_resolveNumCtx` returns null when the caller does not
  ask, so no `num_ctx` reaches Ollama and its ~4096 default applies. Through the product's own
  `estimateCtxTokens`: today's longest parent estimates 3,203 tokens and fits; the chain estimates
  4,244 at p90 and 15,272 at max. **"Small in code" was wrong.** Feeding the chain without sizing
  the window would have replaced a trim we choose with a silent one Ollama makes, with every
  generation still reporting success — the exact failure `v71_t` exists to prevent.

### What shipped

- The story prompt takes `collectChainStory(parentNode, budget)` — the **same collector the lesson
  path uses**, so the two contexts cannot drift apart, and its trim drops predecessors from the
  OLDEST end while keeping the most recent chapter whole.
- **The budget is derived from the context ceiling** and handed to the collector, so the trim
  happens where the chapter boundaries are known rather than mid-sentence afterwards:
  `min(CHAIN_STORY_CHARS, floor((ceiling - reply - 512) * 3.2) - 1200)`.
- **`num_ctx` and the timeout are sized, but only when the chain is actually fed.** The KV cache
  grows with the window, so reserving one that is not needed is not free. `Math.max` on the timeout
  means it can only ever RAISE the limit, never cut a reasoning run short.
- **A single-chapter chain keeps the pre-`v79_b` shape exactly** — no `## title` header, no
  `num_ctx`. The change is confined to the case it is for.
- **No i18n change.** The existing label and tooltip became true. That was a real dividend of the
  ruling: the other option would have needed a reworded tooltip in 33 languages.
- **Console lines distinguish the two contexts**, which the roadmap asked for either way:
  `Story context:` is the story prompt, `Lesson context:` the lesson chain (three sites renamed).

### How it is guarded, and why the obvious guard was not enough

`e2e-bookjob` already asserted `/Previous story/` on the continuation prompts. **That assertion
passes for both behaviours** — it cannot see this change at all, which is a good reminder that a
green assertion near a defect is not evidence about it.

The claim is about IDENTITY (which chapters reached the prompt), so it is asserted by identity:
every fake story carries a unique `STORYTEXT[<ms>]` marker, and chapter 3's prompt must contain
**chapter 1's** marker as well as chapter 2's. Non-vacuity first: the two markers are asserted
distinct before either is looked for.

**One book job exercises both branches.** Chapter 2's parent is the root, so its chain is one
chapter: old shape, no `num_ctx`. Chapter 3's chain is two: both markers, header naming the chapter
count, `num_ctx` present.

**Revert-verified separately, twice**, because they are two claims and one revert would have hidden
the other:

| revert | failing assertion |
|---|---|
| `_useChain = false` | *chapter 3 prompt carries chapter 1 TOO — the whole storyline* |
| `_ctxOpts` forced empty | *chapter 3 sizes num_ctx for the longer prompt* |

### `fake-ollama` now logs the request OPTIONS

`{kind, sys, usr}` gained `opts: {think, num_ctx, num_predict}`. **"The server sized the context
window" is a wiring claim no prompt assertion can reach** — the server could have ignored
`ctxTokens` entirely and all 206 checks would have stayed green. Additive to the log line, so no
existing reader breaks.

### Two source pins broke, and were NOT re-pinned

`unit-reasoning-model-safety` §2 and `unit-reasoning-toggle` both slice `server.js` from
`const storySystem = sysStory(` to `story = text.trim();` and match `thinkOpts('story', ...)` inside
it. Hoisting `_baseStoryTokens`/`_sOpts` above the prompt — necessary, because the context budget is
sized against the reply allowance — put both outside the window.

**The claim was still true; the window had stopped reaching the line.** That is the `v71_w` rule
arriving from the other direction (there, a slice that stopped short of the line it pinned; here, a
slice that starts after it). So:

- both windows widened to the whole story-generation block,
- each given a **non-vacuity check** that the slice really contains the `callLLM` it makes claims
  about — without it the widened pin could go silently vacuous the same way,
- and the same claim now asserted at the BACKEND too (`think:false` observed in the chat log), so a
  future line move cannot take the guard with it.

Revert-verified: replacing `thinkOpts('story', ...)` with a literal `{think:true}` fails both.

### Definition of done

Suite 206 green, `--quick` 182, `check-inline` 0 on both builds. `APP_VERSION` bumped to `v79_b`
and `build-static.js` re-run; **the rebuilt `docs/index.html` diffs to ZERO lines against the
previous build once the version string is normalised**, which is the check that a rebuild cannot
lose user content. `INTERNALS.md` updated: constants table (`OLLAMA_MAX_PREV_STORY` added,
`CHAIN_STORY_CHARS` note extended), the `num_ctx` section's "only `generateComprehension` sends it"
line corrected, and the corpus scale figures recorded there rather than only here.

### How to see it work (browser + live model)

Generate a **chapter 3 or later** of a storyline with the box on. The console should show, on the
story call:

```
    Continuing from: "…" (story prompt: full storyline, 2 chapters, N chars)
    Story context: 2 chapters, N chars -> num_ctx~…, timeout …s
```

and, separately, `Lesson context: …` for the lesson prompts. **Chapter 2 deliberately looks
unchanged** — that is the single-parent branch, not a failure. Expect the story call to be slower in
proportion to the context; the median chapter now carries about 3.3x what it did.

## 4. The August data drop — one fixer, one test that was wrong

`lessons.json` and `learners.json` arrived mid-session: **321 topics, 90 storylines** (was 315/88).
Two checks went red.

**`unit-static-freshness`** — the drop is newer than `docs/`. Checked `unit-script-choice` FIRST
(rule 23): `20 stamped, 0 outstanding, 1 known-mixed`, so there was nothing for the backfill to do
and `build-static.js` alone was correct. Running backfill first would have been a no-op that muddied
the evidence.

**`unit-story-unlocked-card` §8 — the TEST was wrong, not the code.** It selected the first chapter
with a mixed lesson and ANY vocabulary; on this drop that is `tp_17865784443240000119`, whose
vocabulary is EIGHT words — few enough that a single round solves all of them. Its "a shorter play
solves fewer words" step then compared 8 with 8. The selector now requires at least 20 words and
says why, so the precondition is stated rather than hoped for. **Second time a selector like this
has picked an unsuitable chapter on new data** (`unit-replay-focus` §8c was the first), and it is
also latently flaky: at 5 rounds the same chapter measured 7 of 8, non-monotonic, because the draw
is random.

## 5. The user's bug list — four releases

Full entries are in the roadmap's shipped table; what follows is only what a future session needs
that the table does not repeat.

**`v79_c` (summary Cancel).** The generalisable part: **Save worked BY ACCIDENT.** It found the
right panel through `ta.parentElement`; Cancel guessed at ids. Two paths answering "which element is
this?" two different ways, and only the guessing one was wrong. When a fix touches one of a pair
like that, check whether the other is right for a reason or by luck.

**`v79_d` (TTS fallback).** `v74_j` was not wrong, it was incomplete, **and its own mechanism is
why**: it added a tier that is FLAT whenever the requested locale is absent, so in that case the
sort falls straight through to the pre-`v74_j` behaviour. A tier that only fires on a match cannot
fix the no-match case. Worth remembering when reading any "we fixed the ranking" claim.

**`v79_f` (the script pin).** The biggest finding of the session and the one with the most reusable
shape — see §6.

**`v79_g` (glyph card).** Two of the three decisions in it were AMBIGUOUS in the request and were
ruled on rather than guessed: "and now underline" (read as *no* underline) and what a tapped chip
should say. The screenshot also carried a bug that was not on the list — the badge naming Serbian in
English inside a German sentence — which is a reminder that a screenshot is evidence about
everything in it, not only about the thing being reported.

## 6. `v79_f`: what to take from it

**A release that says it closed a hole is a claim, not a measurement.** `v79_a`'s shipped row read
as though the script problem was solved; it covered THREE prompts of FOURTEEN. The row is now marked
SUPERSEDED in place, because the next session would otherwise read it exactly as this one did.

**The pin is two facts and each fails alone.** The prompt must append it, AND the script must reach
the prompt. `tp_17864554460460000107` failed on the first while the path supplied the script
correctly; the add-lessons path failed on the second while the prompts were being fixed. A guard for
either one alone would have gone green on a broken app.

**Guard the SHAPE, not the list.** `unit-script-pin-coverage` sweeps every `sys*`/`generate*`
function out of the source and demands a classification. It found 29 builders — three more than a
hand-written list would have had, including `generateStoryQc`, a proofreader that returns a
corrected copy of the story and could therefore silently transliterate a chapter that was already
right. **The sweep found bugs the author did not know to look for**, which is the whole argument for
sweeps over enumerations.

**Three tests went red and none of them was noise.** Two were genuine consequences of the change
(an argument list, an extracted-source harness missing a stub). The third, `unit-book-script`,
matched `sysStory`'s INLINE copy of the rule — the copy deliberately deleted in this release. It was
re-anchored on the shared helper rather than restored: restoring it would have meant keeping the
duplication that caused the bug. **"Make the test pass again" and "keep the test's claim true" are
different instructions**, and this is the third time in two sessions the difference has mattered.

**What is NOT verified:** every guard here proves the instruction reaches the prompt. Whether
`qwen3.6:35b-a3b` then honours it on a conjugation table is only observable live. Regenerate that
chapter's conjugation lesson with the model up and watch for the new `[script]` log line.

## 7. `v79_h` and `v79_i` — two reports whose diagnosis was the opposite of the request

Both were asked for as "make X do Y". In both cases the thing that needed changing was somewhere
else, and changing the obvious thing would have been wrong.

**`v79_h`: the gate was right, the ROW was missing.** The user reported the script lesson not being
offered on an en<-ar storyline. `scriptLessonAvailableForSet` answers TRUE for it and the
per-chapter dropdown offers the option correctly — but the STORYLINE form renders from
`ADD_LESSON_TYPES`, and `intro_script` was not in that array at all, so no storyline could offer it
for any language pair. Touching the gate would have broken a correct function to fix an absent row.
The server's `ARC_LESSON_TYPES` whitelist was missing it too, so a client-only fix would have had
the tick dropped **with no error**.

**`v79_i`: the prompt already said it, and contradicted itself.** See rule 31. The transferable
part is the shape: *"strengthen the prompt"* was the request, and the correct action was to DELETE
the bullet that asked for the defect. A stronger version of a rule that is already present changes
nothing.

## 8. Five source pins broke this session and none of them had a false claim

Recorded together because the pattern only became visible in aggregate, and it is now rules 29-30.

| test | what it pinned | why it broke |
|---|---|---|
| `unit-reasoning-model-safety` | a slice starting at `const storySystem = sysStory(` | `thinkOpts` hoisted ABOVE that line |
| `unit-reasoning-toggle` | the same slice | same |
| `unit-book-script` | `sysStory`'s INLINE copy of the script rule | the copy was deliberately deleted for a shared helper |
| `unit-add-lessons` | the exact signature `_pickLessonTypes(titleText)` and the exact call text | the argument list grew |
| `unit-intro-script` | "the helper appears exactly 3 times" | a legitimate new call site appeared |

Every one was re-anchored at the level the claim lives, with a non-vacuity check added where the
widened window could otherwise go empty. **None was re-pinned to the new text.** The last is the
sharpest: a COUNT stood in for "no call site hand-rolls this question", and it failed on a new call
site that used the helper correctly — the exact thing it should have welcomed.

## 9. The Aug 14 drop — and why it says nothing about `v79_i`

`lessons.json` arrived again on the 14th; `learners.json` was byte-identical to the 13th. Corpus
unchanged at **321 topics / 90 storylines**. `unit-static-freshness` went red (expected: the drop is
newer than `docs/`); `unit-script-choice` reported `20 stamped, 0 outstanding, 1 known-mixed`, so
`build-static.js` alone was correct and no backfill was run.

`build_history/probe_word_forms_v79i.js` moved from 8 flagged items to 7. **That is not evidence about the prompt
change.** `tp_872660509`'s word-forms lesson still carries its original `_genMeta.at`
(2026-08-12T12:25:21), so it was never regenerated — one item was removed by hand between the drops.
The probe header now records both cuts and says so, because a later session finding "17% -> 15%"
next to a prompt fix would read it as a result. **The `v79_i` prompt has not yet met a model.**

## 10. Still owed at the end of this session

- **Package.** The zip's top-level directory must be `dreizunge_v79_i/`, not `dreizunge_v79/`.
- Everything in `HANDOVER.md`'s "Owed by the user" that a container cannot do — unchanged by this
  session.
- The per-text learning scheme remains a DISCUSSION. Nothing was built for it here.
- **Two items from the user's list are untouched, and each is a session:** import "new" mode
  (re-assign ids so an import cannot overwrite — needs a consistent rewrite of `continuedFromId`,
  storyline `chapters` and the fork links, or it produces broken chains rather than fresh ones), and
  the forked-storyline display rework (all chapters shown, greyed, clickable, switchable, with
  shared chapters counting the same for every fork — it lands on the surface `probe_gates_v77.js`
  measures, so re-run and DIFF that probe).
- **A live pass on three releases.** `v79_f`, `v79_g` and `v79_i` are all guarded at the layer where
  the claim is observable here, which is not the layer where the claim ultimately matters:
  regenerate a word-forms lesson and re-run `build_history/probe_word_forms_v79i.js`; regenerate the conjugation
  lesson of `tp_17864554460460000107` and watch for the new `[script]` log line; and play a
  script-primer lesson to hear the glyph and the tapped chip.
