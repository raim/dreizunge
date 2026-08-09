# Card gates — the AS-IS truth table (measured, `v76`)

> ## ⚠️ SUPERSEDED BY `build_history/v77_card_gates.md`
> **The TABLE below is unreliable — do not build on it.** Four of its five findings were artefacts
> of state the probe never seeded (the stub DOM itself, `savedList`, the learned ledger, and the
> coverage key space), each corrected in place below. `v77_card_gates.md` carries the regenerated
> table, produced by a probe that asserts element existence in the markup and seeds every store the
> card reads. This file is kept for its corrected findings and the settled coverage question.

Produced for the progress-card rework. **Derived by RUNNING `showComplete` across every gate
combination**, not by reading it: the function is 564 lines with 7 swallowing `catch(_) {}` blocks,
so source reading is precisely what cannot be trusted here. The probe is preserved as
`build_history/probe_gates_v76.js` — re-run it after any change to the card and diff the output.

Each row seeds a gate, then asserts the gate actually moved before the row is recorded. The four
rows where it did not are reported rather than quietly presented under a label they do not have.

```
### A. CLASSIC set (completion-driven gate)
chapter: "Wiener Kälte und Barcelona"  es<-de  |  lessons: standard, comprehension, ai_error_hunt
legend: YES visible | grey disabled | - hidden | ABSENT no such element

tchr   canGen want   rvw    GATE   story      story-unlockednext       back       repeat     drill      crossword  storyboard vocab      
--------------------------------------------------------------------------------------------------------------------------------------
.      .      .      .      false  YES        YES        YES        -          YES        -          -          -          YES        
.      .      .      R      false  YES        -          YES        -          YES        grey       grey       -          YES        
.      .      U      .      true   YES        YES        YES        -          YES        -          -          -          YES        
.      .      U      R      true   YES        YES        YES        -          YES        -          -          -          YES        
.      G      .      .      false  YES        YES        YES        -          YES        -          -          -          YES        
.      G      .      R      false  YES        YES        YES        -          YES        grey       grey       -          YES        
.      G      U      .      true   YES        YES        YES        -          YES        -          -          -          YES        
.      G      U      R      true   YES        YES        YES        -          YES        -          -          -          YES        
T      .      .      .      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      .      .      R      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      .      U      .      true   YES        YES        YES        -          YES        grey       grey       -          YES        
T      .      U      R      true   YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      .      .      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      .      R      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      U      .      true   YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      U      R      true   YES        YES        YES        -          YES        grey       grey       -          YES        

  all 16 rows: storyUnlocked() followed the seed.


### B. MIXED-driven set (coverage-driven gate)
chapter: "Das vergessene Manuskript"  es<-de  |  lessons: standard, standard, synonyms, mixed, comprehension
legend: YES visible | grey disabled | - hidden | ABSENT no such element

tchr   canGen want   rvw    GATE   story      story-unlockednext       back       repeat     drill      crossword  storyboard vocab      
--------------------------------------------------------------------------------------------------------------------------------------
.      .      .      .      false  YES        -          YES        -          YES        grey       YES        -          YES        
.      .      .      R      false  YES        -          grey       -          YES        grey       grey       -          YES        
.      .      U      .      false  YES        -          YES        -          YES        grey       YES        -          YES        
.      .      U      R      false  YES        -          grey       -          YES        grey       grey       -          YES        
.      G      .      .      false  YES        YES        YES        -          YES        grey       YES        -          YES        
.      G      .      R      false  YES        YES        grey       -          YES        grey       grey       -          YES        
.      G      U      .      false  YES        YES        YES        -          YES        grey       YES        -          YES        
.      G      U      R      false  YES        YES        grey       -          YES        grey       grey       -          YES        
T      .      .      .      false  YES        YES        YES        -          YES        grey       YES        -          YES        
T      .      .      R      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      .      U      .      true   YES        YES        YES        -          YES        grey       YES        -          YES        
T      .      U      R      true   YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      .      .      false  YES        YES        YES        -          YES        grey       YES        -          YES        
T      G      .      R      false  YES        YES        YES        -          YES        grey       grey       -          YES        
T      G      U      .      true   YES        YES        YES        -          YES        grey       YES        -          YES        
T      G      U      R      true   YES        YES        YES        -          YES        grey       grey       -          YES        

  !! 4 row(s) where storyUnlocked() did NOT follow the seed:
     want=true got=false  (teacher=false canGen=false review=false)
     want=true got=false  (teacher=false canGen=false review=true)
     want=true got=false  (teacher=false canGen=true review=false)
     want=true got=false  (teacher=false canGen=true review=true)
```

## What the table says

**1. ~~`comp-back` is hidden in all 32 rows~~ — WRONG, corrected `v77_b`. `comp-back` DOES NOT
EXIST.** `grep -c 'id="comp-back"'` is **0** in both `index.html` and `docs/index.html`: the button
was DELETED in `v71_k`, and `#comp-hdr` (the storyline header, whose title is the route back)
replaced it. `unit-card-consistency` asserts its absence on purpose.

The row read `-` because **`lib-dom` auto-vivifies any id** — `document.getElementById('comp-back')`
returns a fresh stub with no `display` and no `disabled`, so the probe measured a phantom and
reported it as a real, hidden element. `comp-story` is the same phantom (the real ids are
`comp-story-text` / `comp-story-spk` / `comp-story-xlate`, inside the `comp-story-unlocked` panel).

**Consequence for §0c: there is nothing to revive. The navigation spine must be BUILT**, and it must
not reuse the id `comp-back` without also updating the guard that asserts it is gone.

**Rule earned:** an element-visibility probe against the stub DOM must first assert the element
exists in the MARKUP, or it measures a phantom. Two of the nine columns in the table below are
phantoms for exactly this reason.

**2. ~~`comp-storyboard` is hidden in all 32 rows.~~ — WRONG, corrected `v77_e`. It RENDERS.**
Second seeding artefact: `_renderCompStoryboard` resolves its storyline through `APP.savedList`,
which the probe left empty, so it returned early every time. With `savedList` populated the board is
visible on the chapter card in all 32 rows. **So "that is new wiring, not a display flag" is
backwards — the wiring already exists.** Trap for whoever tests it: the renderer uses `appendChild`,
not `innerHTML`, so the stub DOM reports `innerHTML` as EMPTY even when the board is present. Assert
`children.length`.

**3. `comp-story-unlocked` does NOT mean "the story is unlocked".** It shows whenever `canGenerate`
OR teacher mode is on, with the story still locked (classic rows 5–8, mixed rows 5–16). It is the
label element, reused for the *preview* caption. The new sequence has a genuinely distinct
"story unlocked" card, so this name will collide — rename it as part of the rework.

**4. ~~`comp-drill` is grey or hidden in all 32 rows. Never once enabled.~~ — WRONG, corrected
`v77_d`. The drill is ALIVE and reachable in normal play.** Third seeding artefact in this table.

The drill quizzes WRONGLY ANSWERED words, which live in `APP.progress.learned["lang|srcLang"]` —
a store the gate probe never wrote (it seeded `APP.progress = { completed:{}, solved:{} }` only).
An empty ledger means `buildDrillLesson` returns `null`, so `drillAvailable` is false and the button
is correctly greyed. **Grey there was the right answer to the question actually asked: this learner
has nothing to drill.**

Measured (`build_history/probe_drill_v77d.js`):

```
wrong known  total  drillAvailable  comp-drill
1     0      1      false           grey
1     2      3      false           grey
1     3      4      true            LIVE      <- DRILL_MIN=4 pool floor
4     0      4      true            LIVE

driven through recordLearnedFromLesson (the real writer, 2 wrong answers):
  ledger 8 entries (2 with wrong>0) -> drillAvailable true -> comp-drill LIVE
```

**The suite already said so.** `unit-card-consistency` §4 has asserted *"drill is live once mistakes
exist"* since `v71_h`, and it is green. The truth table and a passing test contradicted each other
for a full release, because the table was read as measurement and the test as a detail.

**Consequence for §0d: `comp-drill` is not a dead control — keep it in the row.** One live
interaction to note, though: on the **unlocked learner** row it is `hidden`, and that is `v74_l`'s
hide-list taking the drill away from a learner who *has* mistakes and has just unlocked the story.
Ruling 1 deletes that hide-list, so the button returns there — which is the correct outcome, since
Replay-to-100% and drilling mistakes are the two ways up.

**Floor worth knowing:** `DRILL_MIN = 4`. One mistake with fewer than three other known words yields
no drill. Not reachable in practice — `recordLearnedFromLesson` adds the whole lesson's vocabulary on
every play, so any real lesson clears the floor on its first completion.

**5. ~~The learner/teacher asymmetry is large.~~ — mostly the same artefact (`v77_e`).** With every
store seeded, learner and teacher agree on drill, crossword, next, storyboard, vocab, hdr and
lessons. The genuine differences are exactly two: `comp-story-unlocked` (the preview label — finding
3, teacher/canGenerate only) and **`v74_l`'s hide-list, which applies to learners only**.

**6. ~~`v74_l`'s hide-list is barely observable.~~ — WRONG, corrected `v77_e`. It is doing a LOT.**
That claim was derived from the unseeded table, where the buttons were already hidden for reasons
that had nothing to do with `v74_l`. Measured properly — by neutralising the hide-list and diffing
the whole table — it changes **8 of 32 rows** and hides **three otherwise-live buttons in each**
(repeat, drill, crossword), on exactly the genuine learner unlocks.

**Ruling 1's blast radius is therefore larger than §0a assumed.** Not a reason to revisit the
ruling — it was made on principle — but the visible change is bigger than "it defends less behaviour
than its test implies".

**And one nuance not to lose:** the hide-list ALREADY keeps Repeat while coverage is short
(`_coverageLeft`), hiding it only when there is nothing left to gain. So ruling 1's stated
motivation — *"a learner must be able to reach 100%"* — is already satisfied today: Repeat vanishes
only AT 100%, never on the way there.

## OPEN — a coverage key-space mismatch, found while building this

The four bad rows are all: **learner, mixed-driven chapter, cannot reach `storyUnlocked` even with
every lesson marked complete AND every question id from `_lessonQidUniverse` marked solved.**

Measured directly:

```
seeded APP.progress.solved[topic]  : 86 keys   (from _lessonQidUniverse over every lesson)
topicCoverage(true)                : { solved: 0, total: 31, pct: 0 }
coverageComplete(true)             : false
_coverageTarget()                  : 1
storyUnlockLessons(d)              : ["mixed:ls_1785742966414_1obq"]
```

**86 keys in, 0 counted, out of a total of 31.**

## ✅ SETTLED `v77_c` — a SEEDING ARTEFACT, not a bug

The second guess was right: **the two functions key questions differently, and the seeding was at
the wrong level.** `v74_c` moved coverage onto SOURCE ITEM keys (`lessonId:i:hash`) while round
assembly still keys on QUESTION ids (`lessonId:type:hash`). The probe seeded `_lessonQidUniverse`
into `APP.progress.solved`, which `topicCoverage` never reads.

Measured (`build_history/probe_keyspace_v77c.js`), on `Flucht vor dem Krieg nach Wien`:

```
qid universe  : 61   e.g. "1:listen_mcq:36icb3"
item universe : 24   e.g. "1:i:s5vjl1"
shared keys   : 0                       <- disjoint, which is why 0 of 86 counted

seeded from _lessonQidUniverse  -> topicCoverage(true) 0/21   storyUnlocked=false
seeded from _lessonItemUniverse -> topicCoverage(true) 21/21  storyUnlocked=true
```

All 4 bad rows unlock when seeded on the key space coverage actually reads. **`markSolved` writes
BOTH** (the `:i:` marker keeps them from colliding), so a real learner was never affected — driven
through `buildExercises` + `markSolved` with no seeding at all, coverage converges
**62 -> 95 -> 95 -> 100 and unlocks in 4 rounds.** One round is not enough because builders SAMPLE;
replaying is the designed way up, exactly as `repeatForCoverage` intends.

Guarded by `test/unit-mixed-unlock-reachable.test.js`, which drives the real solve path rather than
seeding either map — seeding is the mistake that produced the question. Revert-verified by
disabling `v74_c`'s item crediting.

It matters for the rework because **coverage is the gate for mixed-driven chapters** — the branch
that decides whether the story unlocks at all — and the rework puts the story at the centre of the
card. Resolve it first: if a learner genuinely cannot unlock a mixed-driven chapter, that is a live
bug affecting every such chapter in the corpus, and it is invisible from the classic-set tests.

**Done in `v77_c`** — the answer is above. The 4 rows are a seeding artefact; the product is
correct, and the mixed-driven unlock is now guarded as reachable.
