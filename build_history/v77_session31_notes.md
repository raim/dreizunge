# Session 31 — `v77` → `v77_c`

§0b done, both halves. The progress-card rework proper (§0c onward) is **not started** — §0b was
the whole session's product work, plus one finding that changes how §0c has to begin.

Two releases: **`v77_b`** (the seven swallowing catches), **`v77_c`** (the coverage key-space
question). Both revert-verified, both green, `docs/` rebuilt at each.

---

## Baseline: GREEN, unusually

`182 / 158 / 0 / 0`, exactly as `HANDOVER.md` said. Worth recording because the last two sessions
both opened red and the prompt warned to treat any other number as a finding.

The data files were newer than the code (`lessons.json` 17:21, `learners.json`/`languages.json`
17:18, against 16:18 for the code) — the shape that produced session 30's red baseline. Benign this
time: session 30 ran `backfill-script.js --write` and `build-static.js` after its own final data
drop, so both guards were already satisfied. **Timestamps are still cheap evidence; they were
checked before concluding anything.**

---

## `v77_b` — the seven `catch(_) {}` blocks are visible

### The numbers in the prompt had drifted; the count had not

The prompt and roadmap disagreed about where `showComplete` lives (14314–14877 vs ~14212–14776) and
both were stale. Measured: **557 lines at 14368–14924**. The count of **exactly 7 empty catches** was
exact. The line numbers moved with `v76_i`/`v76_j`/`v76_k`; nobody had re-measured.

### What each one wraps — mapped BEFORE editing

| # | site name | wraps | what a throw costs |
|---|---|---|---|
| A | `learned-ledger` | `recordLearnedFromLesson` | learned-vocab ledger silently not updated |
| B | `pass-mark-gate` | `_belowThreshold`, `_threshPct`, `_lessonGate` | **learner silently treated as ABOVE the mark** |
| C | `header` | `comp-hdr` + storyline progress bar | header and along-the-storyline bar missing |
| D | `storyboard` | `_renderCompStoryboard` | storyboard panel missing |
| E | `lesson-icons` | `_compLessonIconsHtml` | per-lesson icon row missing |
| F | `action-buttons` | drill / repeat / crossword state | **whole action row left unset** |
| G | `coverage-left` | `_firstCoverageShortLessonIdx` | `v74_l` hide-list decides on a wrong signal |

**B is the one that matters for this rework.** It computes the exact branch ruling 2b rewrites: a
throw there leaves `_belowThreshold = false`, so a learner below the pass mark is treated as above
it — silently, with the suite green.

### The mechanism

```
_cardErrors()            -> [{where, msg}] for THIS render (reset at the top of showComplete)
APP._cardStrict = true   -> rethrow at the site instead of swallowing
```

Both, not one: the counter lets a test assert zero without changing control flow, the rethrow gives
`smoke-render` a failure at the site. **Default behaviour is unchanged** — a throw is still
swallowed, it is merely no longer invisible. That matters because this release must not be able to
break a card that renders today.

Two deliberate choices:

- **`var _cardErrs`, not `let`.** `v68.1` was a temporal-dead-zone crash in this very function; a
  hoisted binding cannot reproduce it, and the push is guarded so an early call degrades to a no-op.
- **Call sites are `typeof`-guarded** (`if (typeof _cardNote === 'function')`), per the harness
  convention in INTERNALS. A function extracted in isolation degrades to the old empty-catch
  behaviour instead of throwing a `ReferenceError` out of a catch block. Four test files do
  `ext(html, 'showComplete')` — all for regex assertions, none executing it, but the guard costs
  nothing and the next harness may.

### Proven by probe, not by reading

`build_history/probe_cardnote_v77b.js`, preserved:

```
1. clean render        -> _cardErrors() = []
2. storyboard throws   -> showComplete threw? no
                          _cardErrors() = [{"where":"storyboard","msg":"probe: storyboard exploded"}]
3. strict mode         -> showComplete threw? probe: storyboard exploded
4. clean render again  -> _cardErrors() = []
```

Step 4 failed on the first run, and it was **my probe, not the product**: steps 2–3 replaced
`_renderCompStoryboard` in the sandbox and never restored it, so the "clean" render was still
throwing. Session-29 rule 3 (a test that does not reset shared state tests whatever ran before it)
biting the probe written to check for exactly that class of thing.

### The measurement that actually de-risks the rework

`build_history/probe_cardsweep_v77b.js` sweeps the 32 gate rows; a wider sweep covered everything:

```
topics: 304   renders: 1216   renders that swallowed: 0   escaped throws: 0
```

**The shipped card swallows nothing today.** So the seven catches were not hiding a live bug — the
ledger is a *net for the rework*, which is what §0b wanted. If §0c breaks something inside one of
those blocks, it now says so instead of half-rendering.

`probe_gates_v76.js` re-run and diffed after: **identical**. The card's gate behaviour did not move.

### The guard

`test/unit-card-errors.test.js`. Behavioural, not a source pin: it breaks a real collaborator and
watches the ledger name the site. §5 is the one structural check and it asserts a **construct is
absent** (no empty `catch` in `showComplete`) rather than pinning a phrasing — so it survives the
rework moving that code, which is exactly what §0a asks of the eight files that currently pin source
text. Revert-verified: restoring the 7 empty catches fires *"exactly one site recorded, got []"* —
a named assertion, not a `TypeError` (`v70_l`).

---

## The finding that changes how §0c starts

While reading the test idiom I hit a comment in `unit-card-consistency`: **the stub DOM
auto-vivifies any id.** Checked:

```
id="comp-back"   -> 0 occurrences in index.html AND docs/index.html
id="comp-story"  -> 0 occurrences in index.html AND docs/index.html
```

**`comp-back` does not exist.** It was **deleted in `v71_k`** — `#comp-hdr`, whose title is the
route back, replaced it — and `unit-card-consistency` asserts its absence *on purpose*
(`assert.ok(!/id="comp-back"/.test(clientSrc), 'the Back button is gone from the markup')`).

So `v76_card_gates.md`'s finding 1, and the §0c bullet carried from it — *"the back button the
rework wants is already there and already dead, so the question is whether to revive it or replace
it, not whether to add it"* — is **backwards**. There is nothing to revive. The navigation spine
must be **built**, and reusing the id `comp-back` means updating that guard too.

`comp-story` is the same phantom. The real ids are `comp-story-text` / `comp-story-spk` /
`comp-story-xlate`, and they live **inside** `comp-story-unlocked` — which is the whole bordered
panel, with `comp-story-unlocked-lbl` the caption inside it. So §0c's rename is a **container**
rename, slightly larger than "rename the label".

The v76 probe did call the product function. Its **readout** went through the stub, so the
assertion never touched the thing being claimed — session-28 rule 2 arriving from a new direction,
and now standing rule 16.

Both documents corrected rather than annotated: `v76_card_gates.md` finding 1 and roadmap §0c.

---

## `v77_c` — the coverage key-space question, SETTLED

`v76_card_gates.md` left it open: 86 seeded solved keys, 0 counted, total 31, on the branch that
gates story unlock for every mixed-driven chapter. *"Either `APP.progress.solved` is not the store
`topicCoverage` reads, or the two functions key questions differently."*

**The second. It is a seeding artefact, not a bug.**

`v74_c` moved coverage onto SOURCE ITEM keys while round assembly kept QUESTION ids. Measured
(`build_history/probe_keyspace_v77c.js`), on `Flucht vor dem Krieg nach Wien`:

```
qid universe  : 61   e.g. "1:listen_mcq:36icb3"
item universe : 24   e.g. "1:i:s5vjl1"
shared keys   : 0                        <- disjoint, which is why 0 of 86 counted

seeded from _lessonQidUniverse  -> topicCoverage(true) 0/21   storyUnlocked=false
seeded from _lessonItemUniverse -> topicCoverage(true) 21/21  storyUnlocked=true
```

All four bad rows unlock when seeded on the space coverage actually reads. The `:i:` marker in the
item key is what keeps the two from colliding in one flat map — exactly as `markSolved`'s `v74_c`
comment says.

**No learner was ever affected**, and that was checked on the real path rather than inferred.
Driving `buildExercises` + `markSolved` with **no seeding at all**:

```
coverage by round : 62 -> 95 -> 95 -> 100      unlocked in 4 rounds
markSolved wrote  : both spaces (17 item keys, 23 qid keys from one pass)
```

One round is not enough because **builders SAMPLE** (INTERNALS: "a builder that caps is sampling").
Replaying is the designed way up — `repeatForCoverage` — so convergence over several rounds is the
correct behaviour, not a workaround.

### The guard

`test/unit-mixed-unlock-reachable.test.js`. Nothing previously asserted that a mixed-driven
chapter's unlock is **reachable**, which is the gap `v76_card_gates.md` flagged as "invisible from
the classic-set tests".

It drives the real solve path rather than seeding either map — seeding is the mistake that produced
the question. §2 reproduces the reported symptom (qid seeding → 0 counted → locked) and doubles as
the non-vacuity floor for §3, so §3 cannot pass for a trivial reason. It picks a *different* chapter
from the probe (`Жива ЕКС ЈУ заједница у Бечу`, hr<-sr, 130 qids / 45 items), which generalises the
finding past one fixture. Non-vacuity assertion that a mixed-driven chapter exists at all, per the
corpus-is-not-a-constant rule.

Revert-verified by disabling `v74_c`'s item crediting in `markSolved`: fires *"markSolved credits
the SOURCE ITEM, not only the question"*.

---

## Baseline now

| command | before | after |
|---|---|---|
| `node test/run.js` | 182 | **184** |
| `node test/run.js --quick` | 158 | **160** |
| `node test/check-inline.js` | 0 | 0 |
| `node test/check-inline.js docs/index.html` | 0 | 0 |

`APP_VERSION = 'v77_c'`. `docs/` rebuilt. `probe_gates_v76.js` diffs identical to the session-open
run.

---

## How to see it work

Both releases are headless-observable, so this is thin — but two things are worth a browser glance:

- **Nothing should look different.** That is the claim. Open any completion card, finished or not,
  learner or teacher: identical to `v77`. `v77_b` changes only what happens when something throws.
- **To see the ledger fire**, open the console on a completion card and run
  `_renderCompStoryboard = () => { throw new Error('x'); }` then re-open the card. It renders as
  before (storyboard panel missing), and `_cardErrors()` now returns
  `[{where:'storyboard', msg:'x'}]` instead of nothing. `APP._cardStrict = true` makes the same
  render throw instead.

## i18n

**No new `ui.json` keys in this session.** Nothing user-facing changed.

---

## `v77_d` — `comp-drill` is not dead (docs only, no version bump)

User hint: *"it may only be active via user-specific wrongly answered question."* Correct, and it
makes finding 4 the **third** seeding artefact in the same table.

`drillCandidates` reads `_learnedLedger(lang, srcLang)` = `APP.progress.learned["lang|srcLang"]`.
The gate probe seeded `APP.progress = { completed:{}, solved:{} }` — **no `learned` key at all**. An
empty ledger means `buildDrillLesson` returns `null`, so `drillAvailable` is false. **Grey was the
correct answer to the question actually asked:** this learner has nothing to drill.

Measured (`build_history/probe_drill_v77d.js`):

```
wrong known  total  drillAvailable  comp-drill
1     0      1      false           grey
1     2      3      false           grey
1     3      4      true            LIVE        <- DRILL_MIN=4 pool floor
4     0      4      true            LIVE

driven through recordLearnedFromLesson (the real writer, 2 wrong answers):
  ledger 8 entries (2 with wrong>0) -> drillAvailable true -> comp-drill LIVE
```

**The suite already knew.** `unit-card-consistency` §4 has asserted *"drill is live once mistakes
exist"* since `v71_h`, green the whole time. A passing test and a "measured" table contradicted each
other for a release — new standing rule 20.

**One mistake of mine on the way, worth recording** because it is the same shape as the bug hunt it
sat inside. My first run of step D drove the real writer and reported **8 ledger entries, 0 with
`wrong>0`** — which looked exactly like a live defect in `recordLearnedFromLesson`. It was my probe:
the function takes `wrongTargets instanceof Set ? wrongTargets : new Set()`, and I passed an
**Array**, which degrades silently to "nothing was wrong". The product is correct — `showComplete`
builds a real `Set` at `index.html` ~14314 with the same `stripFuri`/`trim` normalisation. Checked
that before concluding anything. (Note for future probes: `instanceof Set` is also realm-sensitive,
so the Set must be built INSIDE the sandbox, which is why the probe does.)

**Consequences for §0d:** keep `comp-drill` in the button row — it is live. It is `hidden` on the
unlocked-learner row today, which is `v74_l`'s hide-list taking the drill from a learner who has
mistakes and has just unlocked the story; ruling 1 deletes that list, so the button returns there.
That is the right outcome: replaying to 100% and drilling mistakes are the two ways up.

**Floor worth knowing:** `DRILL_MIN = 4`. One mistake with fewer than three other known words yields
no drill — not reachable in practice, since `recordLearnedFromLesson` adds the whole lesson's
vocabulary on every play.

No code changed, so **no version bump and no `docs/` rebuild** — same call as `v76_d`.

---

## `v77_e` — the truth table is regenerated (docs only, no version bump)

Having found three seeding artefacts in `v76_card_gates.md`, I audited the two findings nobody had
re-checked. **Both were the same class of error**, which makes four of five.

**Finding 2 — `comp-storyboard` "hidden in all 32 rows".** `_renderCompStoryboard` resolves its
storyline through `APP.savedList`, which the gate probe left empty, so it returned early every time.
With `savedList` populated the board is visible in all 32 rows. **§0c's "if the story-finished card
is to show it, that is new wiring, not a display flag" is backwards — the wiring exists and works.**

A trap worth recording: the board reads as `innerHTML` **0 chars while visible**, which looked like
a half-render. It is not — the renderer uses `appendChild`, and the stub DOM's `innerHTML` getter
only returns strings that were assigned. `children.length` is 1, tag `SVG`. **Assert `children`, not
`innerHTML`, for anything the card appends.**

**Finding 5 — "the learner/teacher asymmetry is large".** With every store seeded, learner and
teacher agree on drill, crossword, next, storyboard, vocab, hdr and lessons. Two genuine differences
remain: `comp-story-unlocked` (the preview label, finding 3) and `v74_l`'s hide-list, which is
learner-only.

### Finding 6 WITHDRAWN — and this one changes an input to ruling 1

§0a cited, as measured support for ruling 1, that *"`v74_l`'s hide-list is barely observable today —
drill/crossword/back were ALREADY hidden for other reasons. It defends less behaviour than its test
implies."* **That measurement came from the unseeded table and is wrong.**

Measured properly, by neutralising the hide-list and diffing the whole 32-row table:

```
v74_l ON   .  .  U  .   next=YES  repeat=-    drill=-    crossword=-
v74_l OFF  .  .  U  .   next=YES  repeat=YES  drill=YES  crossword=YES/grey
```

**8 of 32 rows change, and each hides three otherwise-live buttons.** The affected rows are exactly
the genuine learner unlocks, on both chapters. The ruling stands — the user made it on principle,
not on this number — but **the visible change is considerably bigger than §0a assumed**, and that is
worth knowing before the release is scoped.

**One nuance ruling 1 should not lose:** the hide-list already keeps Repeat while coverage is short
(`_coverageLeft`), hiding it only when there is nothing left to gain. So ruling 1's stated motivation
— *"Replay must ALWAYS be available… the learner must be able to reach 100%"* — **is already
satisfied today**: Repeat disappears only AT 100%, never on the way there. The case for moving the
actions below the text stands on its own (the story should lead); it is not rescuing a stranded
learner, and the release notes should not claim it is.

### The replacement

`build_history/v77_card_gates.md` carries the regenerated table;
`build_history/probe_gates_v77.js` produces it and (1) asserts every element exists in the MARKUP
before reporting a state, (2) seeds `storylines`, `savedList`, the learned ledger, `completed` and
`solved` **on the item key space**, (3) reports `_cardErrors()` per row. **All 32 rows follow the
seed; no row swallows an error.**

`v76_card_gates.md` is marked superseded at the top and its findings corrected in place.

### A guard caught me mid-experiment

The `cp` restoring `index.html` after the neutralisation experiment silently failed on a shell
quoting error, and I ran the suite against a tree that still had `v74_l` disabled.
**`unit-story-unlocked-card (v74_l)` fired**, alongside `unit-static-freshness`. Restored, byte-hash
compared against the pre-experiment copy, suite green. Recorded because it is session-28 rule 6 from
the other side: the environment admits one writer, and the definition-of-done cycle is what makes an
accidental divergence impossible to miss.

---

## `v77_f` — the story-finished card (§0c's last page)

The first piece of the §0c walk, and deliberately the first: **`v74_o` cannot be deleted until this
card exists and Next reaches it** (ruling 2a), so everything else in the walk is downstream of it.

### What shipped

A new `finished-screen`: festive icon, the WHOLE story chapter by chapter (each a native
`<details>`, so it collapses without script and survives the static build), the cumulative
vocabulary learned across the story, and two actions — Back to the progress card, and onward to the
storyline.

Next on `showComplete`'s terminal branch now leads here **when the story is genuinely finished**.

### Ruling 2a is applied to ONE path, not wholesale — and that is deliberate

The terminal branch fires for "nothing left in this chapter and no next chapter". That is **not**
the same as "the story is finished": a learner who completes the LAST chapter while earlier ones sit
unplayed reaches it too. Celebrating there would be a lie, so that case keeps `v74_o`'s hand-off.

So `v74_o` is superseded on the finished path and **preserved on the unfinished one**. Both halves
are asserted, by clicking, in `unit-story-finished`. The dead end `v74_o` fixed cannot come back in
either direction, and the new card carries its own way out — without that it would BE the dead end.

### Two mistakes caught while writing it

1. **A temporal-dead-zone bug, the v68.1 shape, in the v68.1 function.** My first version read
   `_storyDone` at the Next wiring — which is declared with `let` **59 lines below**. It would have
   thrown a `ReferenceError` on every terminal card. Caught by checking declaration order before
   running anything.
2. **I then wrote a second copy of the rule to avoid it** — precisely the shape INTERNALS warns
   about ("one rule per question"; the storyline connector line drifted this way in `v71_w`). Backed
   out and extracted **`_storyAllChaptersDone(slCtx)`**, which both sites now call. It reads through
   `chapterComplete`, the canonical reader, so it cannot drift from the storyline page either.

Also: the two new buttons assign their handlers in JS rather than inline, matching how `comp-next`
is wired. The stub DOM does not turn an inline `onclick` attribute into a function, so an inline
handler is one a headless test can never click.

### The source pins §0a predicted

Two files failed, exactly as §0a said they would, and **neither was re-pinned to the new text**:

- **`unit-learner-nav` §3** carried three pure source pins on the terminal branch
  (`compNext.onclick = () => { endDrill(); compBackToStory(); };` and the `_endLbl` ternary). Deleted,
  with a comment pointing at their replacement. A source regex cannot express "where does Next take
  the learner", which is the entire claim. What remains there is structural and still true: Next is
  never hidden and never greyed on that branch.
- **`unit-story-unlocked-card` §7** was already behavioural — it clicks Next and asserts where it
  lands — so it was UPDATED rather than replaced: Next now reaches the finished card, and the
  guarantee the section exists for ("not nowhere") is asserted one step further along the walk.

### The guard

`test/unit-story-finished.test.js`, five sections, all by clicking:

```
finished story: Next -> story-finished card
unfinished story: Next -> hand-off (v74_o preserved)
finished card: out -> storyline, back -> progress card
finished card: 8 chapters, 133 learned words
vocabulary is cumulative: 133 across the story vs 24 for one chapter
```

Section 5 is the §0e complaint answered: the panel was blank on comprehension cards because a
comprehension lesson has no vocab of its own. It now reads every chapter's solved items.
**Ordering "as the words appear in the story" is NOT attempted** — that is §3 and shares a matcher
with the highlighting work, so doing it here would guarantee the two disagree later.

**Revert-verified in BOTH directions**, which matters because the ruling has two halves:
forcing `_finish = false` fires *"Next opens the story-finished card"*; forcing it true fires
*"an UNFINISHED story does not open the finished card — that would be a lie"*.

Section 1 also asserts `_cardErrors()` is empty across the walk — the `v77_b` ledger doing the job
it was built for.

### Verified against the published build (rule 15)

`build-static.js` does not re-implement `showComplete`, but the claim was checked rather than
assumed: driving `docs/index.html` through the same harness reaches `finished-screen` with **8
chapters, 133 chips, nothing swallowed** — identical to the live client.

### i18n — four new `en`-only keys

`finished.title` ("Story finished!"), `finished.vocab` ("Everything you learned"),
`finished.next` ("See the whole story"), `finished.back_card` ("Back to the chapter").
**Owed to the translate pass.**

### How to see it work

Finish every chapter of a storyline, then open any chapter of it and press **→** on the progress
card. You should land on a card with 🎉, the whole story as collapsible chapters (the first one
open), and every word you have solved across the story. **←** returns to the progress card; **→**
goes back to the storyline. On a story with unplayed chapters, → still goes straight to the
storyline as before.

---

## `v77_g` — the preview panel is renamed (§0c prerequisite)

The panel holding the story on the progress card was named for a claim it does not make: it is
shown whenever the story is DISPLAYED, including while still LOCKED, as a truncated preview for a
teacher or anyone with `canGenerate`. Across the corrected gate table it appears in 24 of 32 rows,
most of them locked. §0c adds a genuinely distinct story-unlocked PAGE, and the two would have
collided — so the panel is now **`comp-story-panel`** and the old name is free.

It is the whole bordered PANEL, with the caption and `comp-story-text` / `-spk` / `-xlate` as its
children, so this touched five sites in the client plus three test files and two probes.

**Proven to be a pure rename rather than asserted to be one:** the corrected gate table diffs
**identical in every state cell** — only the column name moves.

**The guard matters more than usual here.** `unit-card-consistency` now sweeps the client for the
old id, because a half-done rename is INVISIBLE without it: the stub DOM auto-vivifies any id, so a
leftover lookup would return a live-looking element for ever rather than failing (standing rule 16).
Revert-verified by putting one old reference back.

**And it caught me first.** The comment I wrote at the panel explaining the rename SPELLED the old
id, and so failed the sweep it was documenting — session-29 rule 1 (*a comment near a source-scanned
pattern must not spell the pattern*), arriving exactly as written down. The comment now says so and
deliberately avoids naming it.

---

## `v77_h` — the summary card, and the first link of the spine

§0c's FIRST page, built against the LAST one that already existed. The walk now has both ends.

**The summary is a STORYLINE property, not a topic one** (`sl.summary`), and it is already authored
in the SOURCE language — measured across the corpus: 47 of 84 storylines carry one, each in its own
`srcLang`. So §0c's *"in the SOURCE language"* needed no translation step, only the right field.

The card shows the storyline's icon and title, the chapter count, the summary, and a
**deliberately EMPTY progress bar** — this page states the shape of the journey, not the learner's
position in it, because it sits before any question of the chapter.

**The spine's first link.** Reached by a new **`comp-prev`** ← on the progress card, returning by →.
It is a NEW id rather than a revived `comp-back`: that button was deleted in `v71_k` and
`unit-card-consistency` asserts its absence deliberately, so §0c's spine is built, exactly as the
`v77_b` correction said it would have to be.

**Hidden, not greyed, when there is no summary** (37 of 84 storylines). "There is no summary" is not
a state the learner can act their way out of, unlike an empty drill — so a greyed button would be
noise, and a live one would lead to a blank page.

Direction comes from the client's one `RTL_LANGS` rule: the summary is `srcLang` text on a card
whose chapter may be target-RTL, and a second direction rule would drift.

### Scope call worth flagging

§0c says the summary card comes *"before any question of that chapter"*. It is currently reachable
by ← FROM the progress card — it is **not** forced on lesson entry. Forcing it would change
`loadSaved`'s learner auto-start (v60 learner nav), which is the path every learner takes into every
lesson, and that is a UX change the user has not seen. **Left as an open question rather than
assumed.** The card and its renderer are ready either way.

### The guard

`test/unit-story-summary.test.js`, four sections, all by clicking: ← opens the card and shows THIS
storyline's summary (compared through the product's own `esc`), → returns to the progress card, the
control is HIDDEN with no summary, and the bar renders empty. Both storyline cases are derived from
the corpus with a non-vacuity assertion that each exists.

**Revert-verified both halves:** always-showing the control fires *"with no summary the ← control is
hidden…"*; removing the return handler fires *"→ returns to the progress card — the walk goes both
ways"*. Section 1 also asserts `_cardErrors()` is empty.

### Packaging fixed (user-reported)

`dreizunge_v77_f.zip` unpacked into `dreizunge_v77/`, so every point release overwrote or merged
into the previous one — which is exactly how a stale file survives a release. The release directory
is now **renamed to match the version before zipping**, verified by unpacking: `dreizunge_v77_h.zip`
→ `dreizunge_v77_h/`. Added to the session protocol's packaging step.

### Ruling 2a — CONFIRMED

The user's browser pass hit the 🎉 card at the end of the last chapter of a completed story, and
ruled: **only on finished stories.** The shipped narrow gate (`_storyAllChaptersDone`) is correct;
recorded in §0a as settled with a "do not widen this" note, since the simplification is tempting and
would be wrong.

---

## `v77_i` — the next-chapter-unlocked card (the walk's fourth page)

Finishing a chapter opens the next one. **That moment passed silently**: Next called
`loadSaved(ch.id …)` directly, so the learner was dropped into the next chapter's first unfinished
lesson without ever being told what they had earned. §0c names it.

Next now goes through a card that names the chapter and shows the position along the deck
(`{done} of {total} chapters`, bar filled to match), then carries them in. **Same Next, same
destination, one acknowledgement in between**; ← returns to the progress card, so the walk stays
two-way.

**The target is stashed at RENDER time** (`APP._unlNext`) rather than re-resolved by the card. If
the card asked "what is the next chapter?" for itself, the two could answer differently — the exact
mistake `v74_o` avoided by reusing `APP._compBack` instead of deciding twice. §4 of the guard
asserts the card names precisely what was stashed.

**Another `unit-learner-nav` source pin retired.** It matched
`loadSaved(ch.id || encTopic(ch.topic))` *inside* `showComplete`; that call now lives in the card,
so the pin failed as a text mismatch. Not re-pinned (§0a): the behavioural claim — the learner
reaches the next chapter — is asserted by clicking in the new file, and what remains in
`unit-learner-nav` is structural (the chapter is still resolved and stashed there).

Revert-verified: restoring the direct `loadSaved` call fires *"Next opens the next-chapter-unlocked
card instead of loading the chapter silently"*.

**A UX note the user should weigh in a browser:** this adds one tap to a common path. §0c asks for
exactly this page, so it is built as specified — but it is the kind of change that reads differently
in the hand than on paper. It is one line to revert (`compNext.onclick`) if it feels like friction.

### Walk status after this session

```
summary ✅ v77_h → chapter questions (existing card) → story-unlocked ⛔ NOT BUILT
        → next-chapter-unlocked ✅ v77_i → story-finished ✅ v77_f
```

**`story-unlocked` is the one page still missing**, and it needs a decision before it is built: a
panel that already does this job works today on the progress card (`comp-story-panel`, renamed in
`v77_g` precisely so the page could exist). Whether the new page REPLACES that panel or sits beside
it is a UX call, not a code one.

---

## `v77_j` — the story-unlocked page. **The walk is complete.**

**User ruling: "sits beside it."** The panel on the progress card stays; the page is additional.
That ruling is asserted, not just followed — §5 of the guard checks `comp-story-panel` is still
SHOWN and still carries the story text on the very render that opens the page. Building the page by
hiding the panel would have made the story LESS available, which is the opposite of §0c's principle.

Shown when the prep gate flips and work remains in the chapter, **once per chapter**
(`APP.progress.storyShown`), with the story as the only thing on the page. → continues into the
lesson the card resolved, so forward never skips one. Reuses existing `en` keys — no new i18n owed.

### A vacuous assertion of mine, caught by revert-verifying

My §4 asserted "never on a review render". Reverting `!C._review` produced **no failure** — the
assertion was passing for a reason it did not name. Measured: on a review render `nextLessonIdx` is
**-1**, so the next-lesson branch is not reached at all and the page cannot appear for that reason
alone.

So `!C._review` is **defence in depth, not the load-bearing part**. I kept it — the branch's entry
condition is not that line's to guarantee, and showing the page WRITES progress, which is exactly
what INTERNALS says must sit behind `!C._review` — but the test and the code comment now *say* so,
rather than the guard implying it exercises something it does not. This is standing rule 13 (a guard
whose scenario never reaches the branch) caught by the discipline that exists for it.

### One interaction with an existing guard

`unit-errorhunt-passmark` protects a real user-reported guarantee: forward must reach the error hunt
and **never point past it**. Forward now passes THROUGH the story-unlocked page on the one render
where the gate flips, so the test follows the walk one page further rather than the claim being
weakened — the page's own forward starts exactly the lesson the card resolved. Still green across
25 chapters that hand the learner a hunt.

### The walk, complete

```
summary ✅ v77_h → chapter questions (existing card) → story-unlocked ✅ v77_j
        → next-chapter-unlocked ✅ v77_i → story-finished ✅ v77_f
```

Every page exists; every link is asserted by clicking, not by matching source. What remains in §0c
is the spine's REACH rather than its pages: the summary page is reachable by ← but is **not** forced
before the first question, because that changes the lesson-entry path every learner takes and the
user has not seen it.

---

## `v77_k` — one column for the walk, and the entry card becomes the entry point

Both user-requested.

### (a) The width jump

`#complete-screen` carried the 540px cap that matches `.sl-screen`. **The four pages added in
`v77_f..v77_j` carried no width rule at all** and sized to their content — so the column changed
shape as the learner moved through the walk and the title line moved with it.

The cap now lives on a shared **`.card-screen`** worn by all five card screens, so the storyline
page, the entry card, every progress card and the final card share one column, and `.comp-body`'s
inset already matched `.sl-screen-body` exactly.

`v71_p`'s guard fired on this change — correctly, it pinned `#complete-screen`'s max-width — and was
**widened rather than re-pinned**: it now asserts the class resolves to the storyline's width, that
all five screens wear it, and that the inner padding matches. A page that forgets the class is the
regression, and that is now the thing being caught. Revert-verified by removing the class from one
screen.

### (b) The entry point

`loadSaved` now opens a chapter on the summary card, whose forward starts the lesson the learner
came to play. Two conditions, both deliberate: skipped when the storyline has no summary (37 of 84
have none, and a blank page between learner and lesson is worse than none), and skipped when
arriving from the next-chapter-unlocked card — **that card is already the orientation for the next
chapter, and two interstitials back to back read as friction rather than context.**

### Revert-verification caught a real gap in my own guard

My first version of the entry guard called `_enterViaSummaryCard` directly. Reverting the CALL SITE
in `loadSaved` did **not** fail it: the test proved the decision function worked while leaving the
WIRING completely unguarded — precisely the class of hole this project keeps finding.

Fixed by driving the real `loadSaved` with `fetch` and `goLessonSet` stubbed, which turned out to be
straightforward. Now removing the call fires *"entering a chapter shows the summary card FIRST"*.
Worth remembering: **`loadSaved` IS drivable headlessly** — it only needs `fetch` returning the
topic JSON — so entry-path behaviour does not have to be asserted on source.

(The decision was also extracted into `_enterViaSummaryCard` so the product and its guard cannot
diverge; the earlier draft had the test re-typing the branch, session-28 rule 1.)

---

## `v77_l` — §0d: the story leads, and `v74_l` is retired

The card ran: storyboard → bars → verdict → lesson icons → buttons → **then the story**. The thing
the entire lesson flow exists to deliver arrived last, under a screenful of machinery. That is the
gap between the principle and the code that §0d was written to close.

It now runs **verdict (one line) → THE STORY → the words in it → storyboard → bars → icons →
actions.** `v71_m`'s reasoning survives *inside* the lower group — the bars still precede the
machinery that describes them — what changed is that the whole group moved below the text.

`v74_l`'s hide-list is gone. §0d removes the **premise** rather than the buttons: the actions no
longer sit above the story, so nothing competes with it for the top of the card. Both of ruling 1's
consequences now hold — **Replay is always available**, and **Next is no longer the only route out**.

### Measured, and it matched the prediction exactly

`v77_e` predicted from the corrected gate table that retiring the hide-list would change **8 of 32
rows**, hiding three otherwise-live buttons in each. Re-running the probe after the change:

```
8 rows changed;  repeat  -  -> YES     drill  -  -> YES     crossword  -  -> YES/grey
```

Exactly the genuine learner unlocks, on both chapters. A prediction made from a corrected table,
confirmed by measurement — which is the payoff for having rebuilt that table in `v77_e`.

### Five guards updated, none re-pinned

§0d touches more tests than any release this session, and each failure was the guard doing its job:

- **`smoke-render` row order** — asserted the OLD order. Rewritten to assert the NEW one, plus two
  standalone assertions naming the principle ("the story comes BEFORE the buttons / the bars"), so
  a failure reads as the principle breaking rather than a pair of ids swapping.
- **`unit-story-unlocked-card` §3** — pinned the hiding itself. Replaced with ruling 1's
  consequences: Replay always offered, drill not stripped, and **Next is not the only route out**
  (computed from what is actually shown, not from a list).
- **`unit-story-unlocked-card` §4** — two pure source pins on the deleted `_hide` expression. The
  SAFETY claim underneath them — a learner short of coverage always has a way up — is now asserted
  behaviourally, and under ruling 1 it holds unconditionally, which is stronger than the old
  carve-out.
- **`unit-coverage-threshold` §1** — sliced the card from `complete-screen` to `comp-story-panel`,
  silently assuming the story was the LAST row. When the story moved up, the slice stopped
  containing half the card. The boundary is now the next screen, so the slice is the whole card
  whatever order its rows are in. **This one was passing for a reason it never stated** — a latent
  version of the same fixture-coupling that has bitten this project repeatedly.
- **`unit-card-errors` §5 — my own test, and it was rule 30.** It asserted `_cardNote` appeared at
  least SEVEN times. Retiring the hide-list deleted one instrumented block and it failed although
  nothing was wrong: a hard-coded COUNT of a repeated element, pinning the fixture rather than the
  claim, written by me three days after recording that rule. The invariant is "no catch has an EMPTY
  body", which is what `v77_b` was for; counting is left to the log line. (Measured on the way: 12
  catches, 6 reporting to the ledger, 6 handling their error in place.)

---

## `v77_m` — three defects from the user's browser pass

**(a) Row order.** `v77_l` put the story directly under the title. That led the card but stopped
matching the storyline page, and the two screens are meant to be the same column. Now:
**title+bar → storyboard → chapter-wise bars → story (+vocabulary) → icons → buttons.**
§0d's principle is untouched and still asserted — the story precedes the lesson icons and the
action row, which is what "the actions sit below the text" asks for.

**(b) The story-finished card fired after only the FIRST chapter.** I could not reproduce it on my
corpus — the user's data is newer (their chapters carry 4 and 3 lessons, mine 3 and 2) and the
trigger is progress state I do not have. So I fixed the mechanism rather than chasing the symptom.

`chapterComplete` will trust a cached `chapterDone` **stamp** whose lesson count still matches. A
stamp can outlive the progress it described — a reset, a re-import, a chapter replayed under an
older build. For every other caller that is deliberately conservative in the PERMISSIVE direction.
**For the end-of-story celebration it is conservative in the wrong direction**, because
over-celebrating retires a story while chapters are still unplayed. The celebration now requires the
done-FLAGS to actually be there, and a chapter it cannot verify counts as NOT done.

**(c) The story-unlocked page had no vocabulary highlighting** — the same story lit up on the
progress card and not on the page whose entire job is reading it. Same `_highlightVocabHtml`, same
two shades (whole-chapter vocabulary marked, solved words stronger), so they cannot diverge again.

### My guard for (b) was vacuous, and revert-verification caught it

I planted a stale stamp on ONE later chapter of an eight-chapter storyline. The others were still
genuinely unfinished, so `every` was false for reasons having nothing to do with the stamp — and the
section **passed under its own revert**. Rewritten to stamp every unplayed chapter, so the scenario
actually reaches the branch; it now fires *"the story is NOT finished on a stamp alone"*. Standing
rule 13 again, and the second time this session my own guard needed it.

The non-vacuity check is the load-bearing part: §6 first asserts the planted stamp really does make
`chapterComplete` say "finished". Without that, the fix could be tested against a stamp that never
fooled anything.

---

## `v77_n` — the header, and the verdict line

**(a) Why the header never matched, despite identical markup.** `v71_k`/`v71_m` copied the
storyline page's header block verbatim — same classes, same bar — and it still rendered as a narrow
centred pill next to the page's full-width bar. The markup was never the problem: **the card screens
ARE the `.screen` element, and `.screen` is a centring flex column** (`align-items:center`), so every
direct child shrank to its own content width. The storyline page escapes this because it nests its
content in a full-width `.sl-screen` INSIDE its `.screen` — one extra wrapper that no amount of
header-copying could substitute for.

`align-items:stretch` on `.card-screen` fixes it for all five card pages at once. Guarded, because a
new card page that forgets `.card-screen` gets both the width jump and this.

**(b) The verdict line moved below the play buttons.** "Mach weiter!" / "Lektion abgeschlossen!" is a
verdict on what just happened, not a heading for what follows. As the first row it pushed the
storyboard and the bars down, so the card did not open the way the storyline page opens — which is
the whole point of the mirroring. Reading order is now: header → storyboard → bars → the story →
its words → lesson icons → actions → verdict.

Both revert-verified. Note the first revert attempt for (a) silently did nothing — my `replace`
target did not match the file — and the guard passing was the tell. Checked the actual CSS text and
redid it, at which point it fired correctly.

---

## `v77_o` — four user items, two of them real bugs

**(a) Entry card layout.** Now identical to the other progress cards: storyboard, bars, summary,
actions, title at the bottom. Its own 📖 icon is gone — the storyboard is the picture, and two
images stacked read as a dialog. The storyboard comes from the SAME `_renderCompStoryboard` (given
an optional target id) rather than a second implementation. My first attempt MOVED the rendered
nodes across, which hung the harness: **the stub DOM's `appendChild` does not detach from the old
parent**, so `while (src.children.length)` never terminates.

**(b) The static build did not open on the entry card — rule 15, third time this session.**
`build-static.js` re-implements `loadSaved`, so `v77_k`'s entry point landed in `index.html` only.
Both now call the same `_enterViaSummaryCard`, so there is one decision rather than two that drift.

**(c) LIVE mode: the finished card's drop-downs were empty.** The live `/api/lessons` list is a
PROJECTION — `lessons[]` metadata-only (v74_i) and **no `story` at all** — while the static build
ships whole topics. The card read its chapters straight off that list, so it worked in static and
was blank in live: the v55_s / v74_i asymmetry in a third place, and the reason the user saw it only
in live mode. Chapters are hydrated the way `_toggleSavedStory` already does it (STATIC_LESSONS,
then `/api/lessons/load`), cached, with the card rendering IMMEDIATELY and re-rendering when the
fetches land. Reproduced against a real projection (2 chapters, 0 stories → 2 stories) before and
after, and revert-verified.

**(d) Next is never greyed.** Below the mark it now leads to a **coverage-short** lesson first —
which for a mixed lesson is the one with unsolved questions left, so a replay re-samples toward what
the learner has NOT solved rather than re-asking what they have. The same signal `repeatForCoverage`
uses, so the button and Next cannot disagree about where the work is. Then the first unfinished
lesson; then a re-render. Never a dead end.

`v71_d`'s principle survives and is what the guards now assert: **Next means forward and never
silently becomes Repeat.** Six guards changed, none re-pinned — the strongest is `smoke-render`,
which now CLICKS Next below the mark and asserts it starts the coverage-short lesson without
carrying the learner out of the chapter (the v69.2 guarantee, expressed as behaviour).

**Session-29 rule 1 caught me twice more:** a comment naming the removed lock flag failed the sweep
that proves the flag is gone, and backticks in a `build-static.js` comment broke the template
literal it lives in. Both are now written without the spelled name.

---

## `v77_p` — four more from the browser, and one guard I could not make honest

**(a) Next opened a REPLAY instead of the comprehension questions.** `v77_o` looked for a
coverage-short lesson before an unfinished one, so on a chapter whose story had just unlocked,
forward meant "replay what you have already done" — the learner had to press Replay to get past
their own replays. Forward should mean the next thing you have NOT done. Order is now: first
unfinished lesson, then coverage-short (which for a mixed lesson still targets unsolved questions),
then a re-render.

Also answered the user's question: the GREYED Next in their screenshot was already fixed by
`v77_o` — nothing sets `compNext.disabled = true` any more. That screenshot predates the build.

**(b) No story preview.** The panel used to appear while the story was LOCKED, truncated, for a
teacher or anyone with canGenerate — the misnaming that survived until `v77_g`. It pushed the
vocabulary, the thing a locked learner can actually use, below a paragraph they are not meant to
read yet. Gone: the panel appears only on a genuine unlock.

**(c) The headline fraction counts CHAPTERS.** "4/7 lessons" measures the machinery; a story is read
in chapters, which is the unit the storyboard, the deck and the walk are already in. Changed in the
SHARED `_slProgressStats`/`_slProgressLabel`, so the storyline page and every progress card move
together — they cannot disagree about how far along the story is.

**(d) The entry card shows the real progress bars**, through the same `_compProgressHtml`. §0c's
"bars empty" was right when this page only ever preceded the first question; since `v77_k` it is the
entry point for EVERY visit, including resuming a half-played chapter, where an empty bar misreports
where the learner is.

### A guard I could not make discriminate — recorded, not hidden

§6 asserts Next opens the unplayed lesson. That result is correct and it is asserted by clicking.
**But it does not fail under revert**: swapping the product back to coverage-first leaves it green,
even though the two candidate lessons demonstrably differ when measured in the same test. The likely
cause is that `endDrill()`, which the handler runs BEFORE choosing a target, changes the state
`_firstCoverageShortLessonIdx` reads.

I have written that limitation into the test rather than letting a green tick imply protection it
does not give (standing rule 13: a guard that cannot fail is not a guard). **The ordering claim is
currently unguarded and is owed.**

### Two more instances of traps already on the rules list

- **`_lessonItemUniverse` returns a SET, not an array.** My fixture called `.slice` on it; the
  `TypeError` was swallowed by the surrounding `try/catch`, so the seeding silently did nothing and
  the failure surfaced two sections away as "the prep gate is open on this fixture". A swallowed
  error masquerading as a data problem — the exact shape `v77_b` exists to end, in a test rather
  than in the product.
- **Backticks in a comment inside a template literal**, for the third time this session.

---

## `v77_q` — one card family

**(a) One starter card per chapter.** The next-chapter-unlocked card now does the entry card's job
for every chapter after the first: same header, same storyboard, the story SUMMARY, and the chapter
progress bars (empty on a first visit, which is exactly what a starter should show). The entry card
is confined to chapter one, so the learner never meets two competing starters. The planned "how the
game works" collapsible belongs on both and should be written once, read twice.

**(b) All five headers are identical, and that had to be MEASURED.** My first pass added the missing
ids to the four newer cards, wired one `_cardHeader(prefix)`, and every markup check passed. Driving
the five renderers showed the fraction and storyboard matching on all of them — and **four different
titles**: each renderer still overwrote `_cardHeader`'s title afterwards and dropped the storyline
icon. `🐰 Fibonaccis Hasen` on the completion card, `Fibonaccis Hasen` everywhere else.

**Markup parity is not header parity**, and the guard now says so: it compares what the five headers
RENDER — title, fraction, storyboard child count — against the completion card as reference, with a
non-vacuity check that the reference is populated. Revert-verified by making one card write its own
title again.

That is the same lesson as `v77_n`'s: the header block had been copied faithfully for releases and
still did not match, because the thing that differed was never in the markup.

---

## `v77_t` — §0g, the comprehension flow

**(a) A repeat asks only what is left.** The filter reads the SOLVED store, which is monotonic and
is the same signal `v71_s` uses to decide the lesson is done — so the round empties exactly when the
lesson completes, and the filter cannot disagree with the done-rule. A first play still asks
everything (asserted as the non-vacuity floor), and a fully-solved lesson falls back to the full set
rather than rendering a blank round.

**(b) Next restarts the lesson you just failed.** A wrong answer returns the learner to the card,
where Next used to offer whatever `_firstUnfinishedLessonIdx` found next — often an earlier normal
lesson — so the questions just got wrong sank out of reach and Replay was the only way back. Now, if
the lesson just played is story-gated and still has unanswered questions, Next restarts it. Scoped
to the lesson just played: "finish this", not a standing preference for gated lessons. §5 of the
guard asserts the override releases once every question is answered, so it cannot trap anyone.

**`_lessonQidUniverse` returns a SET**, like `_lessonItemUniverse`. My first version called `.some`
on it; the `TypeError` was swallowed by the surrounding `try` and the override silently never fired
— Next kept walking to lesson 0 and everything looked correct-but-unchanged. **Second time this
session the same Set-not-Array trap cost a debugging round**, both times hidden by a `try/catch`.
Worth a standing rule: the universe helpers return Sets; `Array.from` them at the boundary.

---

## `v77_u` — the apostrophe defect

Vocabulary stores `l'evoluzione` with ASCII U+0027; stories are written with the typographic U+2019.
Compared literally those are different strings, so a word EXACTLY present in the story never
matched. Carried since v75 as "ship regardless of ruling 3", and it is a plain defect rather than a
judgement about matching policy.

Fixed as **Unicode machinery, not a table** — one character class folds the apostrophe code points,
which is the same class of rule as the case-insensitivity the matcher already applied, so no
language knowledge is added. The design principle is asserted structurally in the guard.

**Both sides had to fold.** The regex alone would have made the word match while leaving it with the
WEAK mark, because the two-tier `v74_n` display keys the solved set by the word's text. Fixing only
the regex would have half-cured the defect in a way nobody would have noticed.

**Measured on the shipped corpus: 17 words across 13 chapters** (`it` 5, `en` 6, `lb` 2) now match
that never could. The guard re-measures it, so a regression shows up as a number rather than as
silence. Inflection still misses under whitespace splitting — Tier 2, still open.

## `v77_v` — §0f, the story reads itself when it unlocks

The reading is the easy part; the restraints are the substance, and each protects something that has
broken before:

- **Muted means muted.** `speakBodyText` force-unmutes — it treats a tap as consent. Auto-play has
  no tap and therefore no consent, so it goes to the speech layer directly rather than through that
  function. Asserted that mute is still on afterwards, not just that nothing was said.
- **Never on a review render** — re-opening a finished chapter is not the moment of unlocking.
- **Once per chapter per session.** `showComplete` re-renders into the same DOM repeatedly; without
  this every re-render would restart the reading.
- **Never interrupts speech in progress.** `v75_h` made `cancel()` conditional for exactly these
  races; the guard asserts auto-read neither speaks NOR cancels while something else is running.

All four revert-verified separately. `v77_p` helps here too: `_showStory` now means a genuine
unlock, so the reading cannot fire on a locked teaser.

---

## `v77_w` — no QC pass during generation (user)

Story QC was already excluded from book generation, for a stated reason: an LLM pass per chapter,
unprompted, on an already-long job. The user has now made the same call for LESSON QC, and the
reasoning generalises cleanly — **QC is a REVIEW step, not a generation step.** Deferring it costs
nothing, because everything it would flag is still there afterwards; running it inline costs the
slowest part of every book job.

Everything on-demand is untouched: the storyline 🔍 sweep (which still defaults
`includeStory: true`), the per-chapter QC from the saved list, `_runQc` itself and `/api/qc`.

Two guards changed, and both now assert the ABSENCE of the automatic pass **paired with positive
assertions that QC still exists** — otherwise "generation runs no QC" would pass equally well if QC
had been deleted outright, which is the failure mode of every absence-assertion.

Session-29 rule 1 caught me a fourth time: the comment I wrote pointing at how to restore the old
behaviour SPELLED the call the new guard sweeps for, and so failed the check it documented.

---

## Open defect carried forward — `_firstUnfinishedLessonIdx` returning -1

The user's replay report is **not** explained by anything shipped. Recorded in INTERNALS §2 so the
next session meets it where the code is, not only in a session note.

Shape: `showComplete` tries `nextLessonIdx >= 0` FIRST, so whenever the helper returns a lesson,
that lesson is what Next starts. The reported state — story unlocked, comprehension unplayed, Next
greyed or offering a replay — therefore requires the helper to have returned -1.

Prime suspect is its very first line, `if (setComplete(d)) return -1;`: a chapter that reads COMPLETE
stops the search regardless of unplayed lessons. `setComplete`/`chapterComplete` trust the cached
`chapterDone` STAMP ahead of the flags, and `v77_s` found that stamp surviving a progress wipe —
which is precisely how a chapter reads complete while its lessons are unplayed. **The `v77_s` wipe
fix may already have cured this.** Unconfirmed against the user's data; they are watching for it.

Debugging note for whoever picks it up: inspect `APP.progress.chapterDone[topic]` BEFORE calling
`chapterComplete`. That reader re-stamps as a side effect, so a check made after it reads a record
the check itself just wrote — which is how a correct fix looked broken for one round in `v77_r`.

---

## What §0c inherits

- **`comp-back` must be built, not revived** (above). Check `unit-card-consistency` before choosing
  an id.
- **`comp-story-unlocked` is a panel, not a label** — the rename touches a container and its four
  children.
- **`comp-drill` is ALIVE** (`v77_d`) — keep it in the row. Expect it to become visible on the
  unlocked-learner row once ruling 1 removes `v74_l`'s hide-list.
- **Use `v77_card_gates.md`, not `v76_card_gates.md`,** for the table. Re-run `probe_gates_v77.js`
  and diff after any card change.
- **`comp-storyboard` already renders on the chapter card** — the story-finished card needs no new
  storyboard wiring, only a decision about placement.
- **Ruling 1 is a bigger change than §0a assumed** (8 of 32 rows, three buttons each), and its
  "reach 100%" motivation is already satisfied. Scope accordingly.
- **The ledger is available to §0c**: assert `_cardErrors()` is empty after any card render you add,
  and the seven blind spots stay closed as the code moves.
- **The eight files that pin `showComplete`'s source text** are untouched — `v77_b` did not change
  any of the lines they match (`/_nextBlocked = true;/` etc.), so they are still green and still
  owed their behavioural replacement when §0a's rulings land.

## New standing rules (16–18, appended to `roadmap_v77.md`)

16. **An element-visibility probe against the stub DOM must first assert the element exists in the
    MARKUP**, or it measures a phantom. Cost: two phantom columns carried as "measured" for a
    release, and a roadmap bullet pointing the rework at a button that isn't there.
17. **When two stores are keyed differently, seeding one and reading the other measures nothing.**
    Seed the way the PRODUCT writes it, or drive the real path.
18. **A guard that asserts a construct is ABSENT survives a rewrite; one that pins a phrasing does
    not.**

## Still owed by the user (unchanged from the v77 handover)

Everything in `HANDOVER.md` → "Owed by the user" carries forward untouched: the browser pass, the
`v76_e` product judgement, the Android English voice, the pass mark, `--langnames`, the `sr`/`hr`
native-speaker check of `cyrillic-sr`, the translate pass for `complete.words_solved` /
`form.finish_mixed` / `form.script_pick`, and the comprehension QC checker.


## `v77_x` — two defects from the user's testing notes

**(a) Chapter titles failed on multi-chapter storylines.** The model answered with PAIR ARRAYS, one
per line, no enclosing array:

```
["Erste Begegnung", "🐕"]
["Parkfreundschaft", "🌳"]
```

Every rung of the parsing ladder looks for `{…}` objects, so a perfectly readable answer was
rejected three times and the post-pass gave up — silently, leaving the placeholder titles in place.

**The user's own observation was the diagnostic**: title generation worked from the lesson-set page.
That path asks for ONE chapter and gets one object; only the multi-chapter request provokes the pair
form. A bug that looks intermittent is often a bug in the branch that only one caller reaches.

Fixed in BOTH places — a pair-array rung in the ladder AND the normaliser, which reads `.title` off
its input. Without the second, a properly-formed top-level array of pairs would parse successfully
and yield an empty title for every chapter: **a parse that succeeds into the wrong shape is worse
than one that fails, because nothing reports it.**

**(b) Math ordering presented the numbers already sorted.** Not a shuffle bug — `shuffle` is uniform
and therefore returns the answer about 1 build in 24 for four numbers, 1 in 6 for three. The learner
sees a question that is already finished. Reshuffles until the presented order differs, bounded, and
falls back to the original order for a set that cannot differ. Verified over 400 builds: 0 present
the solution, where the old behaviour would have produced roughly 17.

---

# Session 31 — closing summary

**`v77` → `v77_w`.** Baseline `182 / 158 / 0 / 0` → **`191 / 167 / 0 / 0`**. Twenty-one point
releases, every one revert-verified and packaged with `docs/` rebuilt.

## What was actually done

- **§0b** (the assignment) — the seven swallowing catches made visible, and the coverage key-space
  question settled.
- **§0c** — the whole progress-card walk BUILT: summary, story-unlocked, next-chapter-unlocked,
  story-finished, plus the navigation spine and one shared header.
- **§0d** and **ruling 1** — the story leads; `v74_l`'s hide-list retired.
- **§0f** — the story reads itself when it unlocks.
- **§0g** — the comprehension repeat asks only what is left, and Next restarts the lesson you failed.
- **The apostrophe defect** — carried since v75, 17 words across 13 chapters recovered.
- **`v77_w`** — no QC pass during generation.

## What this session was really about

Measurement. Four of five findings in the "measured" `v76_card_gates.md` were seeding artefacts, and
correcting them changed what §0c had to build (`comp-back` did not exist; the spine had to be built,
not revived). A prediction made from the CORRECTED table — that retiring `v74_l` would change 8 of
32 rows — then held exactly.

The same discipline caught my own work repeatedly: **five of my own guards passed under their own
revert**, each for a different reason, and each was fixed or labelled rather than left green. Two
are still labelled as not discriminating; one of my fixes (`v77_p`) was retracted outright as
unreachable dead code once the branch order was checked.

**Recurring traps, all now written down:** the stub DOM auto-vivifies any id; the universe helpers
return Sets, not arrays; `chapterComplete` re-stamps as a side effect; a comment must not spell a
pattern a test sweeps for (that one caught me four times); and `build-static.js` re-implements
client functions, so a client fix is not a published fix (three times).

## The user's testing notes — triaged into the roadmap

The user supplied a batch of testing notes at the end of the session. They are triaged in
`roadmap_v77.md` → "USER TESTING NOTES", in five groups: **A** fixed here (`v77_x`), **B** small and
self-contained, **C** prompt work needing a live model, **D** bugs needing reproduction, **E** larger
features needing a decision first.

Two observations from doing the triage with the code loaded, which a cold reading would have missed:
- **The clear-progress-per-chapter request must reuse `slBottomClearProgress`**, not re-implement
  it — `v77_s` just fixed what that function forgets to clear, and a fresh implementation would
  forget `chapterDone` all over again.
- **The word-form highlighting request belongs with §0e/§3 and the ONE shared matcher.** Adding a
  second matcher is exactly what §0e was written to prevent.

## Owed by the user

Eleven `en`-only UI keys for the translate pass; the "how the game works" copy for the entry and
starter cards; §0g's model-prompt change; and everything in HANDOVER → "Owed by the user".
