# Card gates — the AS-IS truth table (measured, `v76`)

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

**1. `comp-back` is hidden in all 32 rows, on both chapters.** The element exists and is never
visible. The rework wants back/next through played chapters — that button is already there and
already dead, so the question is whether to revive it or replace it, not whether to add it.

**2. `comp-storyboard` is hidden in all 32 rows.** The storyboard is storyline-level; this is the
chapter card. If the "story finished" card is to show it, that is new wiring, not a display flag.

**3. `comp-story-unlocked` does NOT mean "the story is unlocked".** It shows whenever `canGenerate`
OR teacher mode is on, with the story still locked (classic rows 5–8, mixed rows 5–16). It is the
label element, reused for the *preview* caption. The new sequence has a genuinely distinct
"story unlocked" card, so this name will collide — rename it as part of the rework.

**4. `comp-drill` is grey or hidden in all 32 rows.** Never once enabled on either chapter. Before
moving the button row below the text, establish whether drill is reachable at all; if it is not,
this is a dead control taking up the row you are redesigning.

**5. The learner/teacher asymmetry is large.** On the classic chapter a learner sees drill and
crossword HIDDEN while a teacher sees them GREY; on the mixed chapter a learner sees crossword YES.
Any "hide editing controls in live mode" work (the recovered `_canEdit()` item) lands right here.

**6. `v74_l`'s hide-list is barely observable.** In the classic rows where the gate is true and the
learner is not a teacher (rows 3–4), drill/crossword/back were ALREADY hidden for other reasons.
`v74_l` only bites where those buttons would otherwise show. That is worth knowing before deciding
whether it survives: it may be carrying less weight than its test suggests.

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

**86 keys in, 0 counted, out of a total of 31.** Either `APP.progress.solved` is not the store
`topicCoverage` reads, or the two functions key questions differently. This is stated as an open
question, not a bug: the seeding may simply be at the wrong level, and it was not chased further.

It matters for the rework because **coverage is the gate for mixed-driven chapters** — the branch
that decides whether the story unlocks at all — and the rework puts the story at the centre of the
card. Resolve it first: if a learner genuinely cannot unlock a mixed-driven chapter, that is a live
bug affecting every such chapter in the corpus, and it is invisible from the classic-set tests.

**Suggested first probe next session:** find who writes `APP.progress.solved`, compare its key
shape to what `topicCoverage` reads, and settle whether the 4 rows are a seeding artefact or real.
