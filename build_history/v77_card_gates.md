# Card gates — the CORRECTED truth table (measured, `v77_e`)

**This supersedes the table in `v76_card_gates.md`.** Read that file only for its corrected
findings and the settled coverage question; **do not use its table.**

## Why it had to be regenerated

Four of the five findings the v76 table produced were artefacts of state the probe did **not** seed
— each in a different store:

| v76 finding | what was actually wrong |
|---|---|
| 1. `comp-back` hidden in all 32 rows | **The element does not exist.** Deleted in `v71_k`; `lib-dom` auto-vivified it. `comp-story` likewise. |
| 2. `comp-storyboard` hidden in all 32 rows | `APP.savedList` was empty, so `_storylineOfTopic` never resolved and the renderer returned early. |
| 4. `comp-drill` never once enabled | `APP.progress.learned` was never written — the drill quizzes wrongly-answered words. |
| OPEN: 86 keys in, 0 counted | Seeded the **qid** universe into a store `topicCoverage` reads by **item** key (`v74_c`). |

Only finding 3 survived (`comp-story-unlocked` is the preview label) — and it was understated: it is
the whole bordered **panel**, not a label.

`build_history/probe_gates_v77.js` regenerates this. It (1) asserts every element exists in the
MARKUP before reporting a state, (2) seeds every store the card reads — `storylines`, `savedList`,
the learned ledger, `completed`, and `solved` **on the item key space** — and (3) reports
`_cardErrors()` per row, so a swallowed throw can no longer masquerade as a gate.

## The table

```
elements present in markup : comp-story-text, comp-story-unlocked, comp-story-spk, comp-next, comp-repeat, comp-drill, comp-crossword, comp-storyboard, comp-vocab, comp-hdr, comp-lessons
elements that DO NOT EXIST : comp-back
  (a phantom would read as a real element through lib-dom auto-vivification — rule 16)



### A. CLASSIC set (completion-driven gate)
chapter: "Alpine Roots"  sr<-en  |  lessons: intro_script, standard, word_forms, comprehension, comprehension
storyline: sl_9302163 +board
legend: YES visible | grey disabled | - hidden

tchr   canGen want   rvw    GATE   story-text story-unlockedstory-spk  next       repeat     drill      crossword  storyboard vocab      hdr        lessons    
------------------------------------------------------------------------------------------------------------------------------------------------------------
.      .      .      .      false  YES        -          YES        YES        YES        YES        grey       YES        YES        YES        YES        
.      .      .      R      false  YES        -          YES        YES        YES        YES        grey       YES        YES        YES        YES        
.      .      U      .      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      .      U      R      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      G      .      .      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
.      G      .      R      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
.      G      U      .      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      G      U      R      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
T      .      .      .      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      .      .      R      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      .      U      .      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      .      U      R      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      .      .      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      .      R      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      U      .      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      U      R      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        

  all 16 rows: storyUnlocked() followed the seed.
  no row swallowed an error.


### B. MIXED-driven set (coverage-driven gate)
chapter: "Frozen Belgrade Derby"  sr<-en  |  lessons: standard, intro_script, word_forms, synonyms, standard, mixed, comprehension
storyline: sl_9302163 +board
legend: YES visible | grey disabled | - hidden

tchr   canGen want   rvw    GATE   story-text story-unlockedstory-spk  next       repeat     drill      crossword  storyboard vocab      hdr        lessons    
------------------------------------------------------------------------------------------------------------------------------------------------------------
.      .      .      .      false  YES        -          YES        YES        YES        YES        YES        YES        YES        YES        YES        
.      .      .      R      false  YES        -          YES        grey       YES        YES        grey       YES        YES        YES        YES        
.      .      U      .      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      .      U      R      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      G      .      .      false  YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        
.      G      .      R      false  YES        YES        YES        grey       YES        YES        grey       YES        YES        YES        YES        
.      G      U      .      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
.      G      U      R      true   YES        YES        YES        YES        -          -          -          YES        YES        YES        YES        
T      .      .      .      false  YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        
T      .      .      R      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      .      U      .      true   YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        
T      .      U      R      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      .      .      false  YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        
T      G      .      R      false  YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        
T      G      U      .      true   YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        YES        
T      G      U      R      true   YES        YES        YES        YES        YES        YES        grey       YES        YES        YES        YES        

  all 16 rows: storyUnlocked() followed the seed.
  no row swallowed an error.
```

## What the corrected table says

**1. All 32 rows now follow the seed, and no row swallows an error.** The four unreachable mixed
rows are gone (`v77_c`), and the `v77_b` ledger reports clean across the whole table.

**2. `comp-back` DOES NOT EXIST.** The §0c navigation spine must be **built**, not revived, and
`unit-card-consistency` asserts the absence of that id deliberately.

**3. `comp-storyboard` renders on the chapter card already.** So §0c's *"if the story-finished card
is to show it, that is new wiring"* is wrong — the wiring exists and works. Note for anyone testing
it: the renderer uses `appendChild`, not `innerHTML`, so the stub DOM's `innerHTML` reads **empty
even when the board is present**. Assert on `children.length` / `childNodes.length` instead.

**4. `comp-drill` is LIVE in 24 of 32 rows.** Not a dead control. Keep it in the row §0d
restructures.

**5. `v74_l`'s hide-list is NOT "barely observable" — that claim came from the unseeded table.**
Measured by neutralising the hide-list and diffing: it changes **8 of 32 rows**, and in each it
hides **three buttons that would otherwise be live**:

```
v74_l ON   .  .  U  .   ... next=YES  repeat=-    drill=-    crossword=-
v74_l OFF  .  .  U  .   ... next=YES  repeat=YES  drill=YES  crossword=YES/grey
```

The affected rows are exactly the genuine learner unlocks (`teacher=false`, gate true), on both
chapters. **Ruling 1's blast radius is larger than §0a assumed** — this is not a reason to revisit
the ruling, which was made on principle, but the change will be visibly bigger than "it defends less
behaviour than its test implies" suggested.

**6. One nuance ruling 1 should not lose.** The hide-list already keeps Repeat when coverage is
short (`_coverageLeft`), and hides it only when there is nothing left to gain. So the stated
motivation — *"a learner must be able to reach 100%"* — is **already satisfied today**; Repeat
disappears only at 100%, not on the way there. The case for moving the actions below the text stands
on its own (the story should lead), but it is not rescuing a stranded learner.
