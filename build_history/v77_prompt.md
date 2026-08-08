# Session prompt — the progress-card rework (wraps up as `v77`)

*(Named for the version this session WRAPS UP WITH, per the convention set at the v75 cut.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v77`** base cut.

Orient yourself by reading, in order:

1. `build_history/HANDOVER.md` — one page: baseline numbers, the naming convention, what's owed by
   me (not doable in a container), and where this session starts.
2. `build_history/roadmap_v77.md` — read the "⚠️ Session protocol — READ FIRST" block and follow its
   definition-of-done for every change. Note the standing design principle: no language knowledge in
   the code, where *permitted* means Unicode machinery or corpus statistics, not a hand-authored
   table.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. Read this instead
   of grepping the notes for "what is the value of X".
4. `build_history/v76_session30_notes.md` — the previous session. Long, and worth it: nine point
   releases, a red baseline that turned out to BE the reported bug, and three separate mistakes of
   mine that existing guards caught.

Then establish a green baseline before changing anything:

```
node test/run.js                        → expect 182 checks
node test/run.js --quick                → expect 158
node test/check-inline.js               → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If the count differs from 182, treat that as a finding and diagnose it before
doing anything else — do not assume a stale fixture.** Data files (`lessons.json`, `ui.json`,
`learners.json`) often change between sessions without that being mentioned; check file timestamps
against the code before concluding anything. Session 30 opened RED at 2 of 176 and *neither* failure
was a stale fixture in the "delete and move on" sense — both were tests that had pinned the shape of
the corpus, and one of them was standing on the exact storyline the user had just reported a bug in.

- If `unit-static-freshness` fails, a baked input moved: run `node build-static.js` and say so.
- If `unit-script-choice` fails saying topics are unstamped, run `node backfill-script.js --write`.
  Both of those are the guards working, not breakage.

## Read the rules before writing any probe

Read **"Rules earned in session 28"**, **"…session 29"** and **"…session 30"** in
`roadmap_v77.md` — fifteen now, and each one cost a wrong finding. The expensive ones:

- **A probe must CALL the product function**, never a re-typed copy — least of all one lifted from a
  test stub.
- **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
- **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not the
  data it was derived from.
- **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
  whatever else it thinks it's testing.
- **(30) A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the
  claim.** `total 🔒 === 1` silently meant "a two-chapter storyline" and broke on a six-chapter one
  while the product was correct.
- **(30) A guard whose scenario matches nothing may never reach the branch it tests.**
  `loadSavedList` returns early on an empty filtered list, and a "must not be shown" assertion
  passed under its own revert because of it.
- **(30) A fix to the client is not a fix to the published build.** `build-static.js` re-implements
  `loadSavedList` and `savedItemHtml`; the `v76_e` guard passed for two releases while `docs/`
  stayed broken. Use `loadClient({ file })` to assert against `docs/index.html`.

---

# THE TASK: the progress-card rework

Read `build_history/roadmap_v77.md` **§0** (the whole rework, with my notes merged and the roadmap
items absorbed), then `build_history/v76_card_gates.md` — the **measured AS-IS truth table** for the
card, 32 rows across both gate families, derived by RUNNING `showComplete`, not by reading it.
`build_history/probe_gates_v76.js` is preserved: **re-run it and diff after any change to the card.**

**Principle, in my words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow exists so
the student ends up understanding the text. "Complete cards" are renamed **progress cards** and
become the spine that guides a learner through a story.

## Do §0b FIRST — it is unblocked and it de-risks everything after

1. **Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible.** Verified at the `v76_i`
   cut: `showComplete` spans **564 lines** (`index.html` 14314–14877) and contains exactly **7**
   empty catch blocks. A throw in any of them leaves the card half-rendered with the suite green.
   A counter the harness can assert is zero, or a rethrow under a test flag, is enough. One small
   release, revert-verified, before any of the work below.

   **This is not theoretical.** Session 30 hit exactly this shape in `server.js`: a `ReferenceError`
   from a variable that wasn't in scope was swallowed by its own `catch`, and every error-hunt
   lesson was silently dropped. It was caught only because a test asserted the RESULT, not the call.

2. **Then settle the coverage key-space question** recorded in `v76_card_gates.md`: on a
   mixed-driven chapter, 86 seeded solved keys, 0 counted, total 31 — the branch that gates story
   unlock for every mixed-driven chapter. Stated there as an open question, not a bug; it may be
   that the seeding is at the wrong level. It is invisible from the classic-set tests.

## The three rulings are ANSWERED — §0c is unblocked

I settled all three at the end of session 30, walking through each against the code. They are
written up in full in `roadmap_v77.md` §0a. **Do not re-derive them.** In short:

1. **`v74_l` is superseded as a MECHANISM, its intent survives.** Stop hiding
   repeat/drill/crossword/back by id; instead move the actions BELOW the text (§0d) so the story
   leads. Consequences: Replay is ALWAYS available, `comp-back` is freed for the navigation spine,
   Next stops being forced as the only route out.
2. **(a) `v74_o` is superseded** — "nothing left to do" becomes the story-finished card in the walk
   instead of a hand-off back to the storyline. **But the dead end it fixed is real: do not delete
   `v74_o` until the story-finished card exists and Next reaches it.**
   **(b) Below the pass mark, Next LEADS** to the next card in the walk, and that card renders with
   **all of its action buttons inactive**. This supersedes **`v71_d`**, not `v74_o` — §0a used to
   attribute the grey Next to the wrong release. `v71_d`'s principle is kept: Next always means
   forward and never silently becomes Repeat.
3. **Article noise stays accepted** — take **whitespace splitting** (`+782`), not the clean composed
   option. A mark means "something from your vocabulary occurs here". This means **no article table
   is needed at all**. Keep it reversible: I may later add an LLM pass judging which vocabulary a
   lesson actually covers. The apostrophe fix (U+0027 vs U+2019) ships regardless — it is a defect.

**Expect test churn, and read §0a's last section before touching it.** Eight files touch these
rules, and several assert on the SOURCE TEXT of `showComplete` (`/_nextBlocked = true;/` and
similar). When the code changes they will fail as text mismatches. **Do not re-pin them to the new
text** — replace them with assertions about what the learner can DO. All three rulings are
behavioural; a source regex cannot express any of them.

## §0c onward — the sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

**summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

Full detail in roadmap §0c–§0h. The parts most likely to be got wrong:

- **`comp-back` already exists and is hidden in all 32 measured rows** — the back button the rework
  wants is already there and already dead. Decide: revive or replace.
- **`comp-story-unlocked` does not mean what its name says** — it is the *preview* label, shown
  while locked whenever `canGenerate` or teacher mode is on. **Rename it before adding a real
  unlocked card**, or the two will collide.
- **`comp-drill` is grey or hidden in all 32 rows** — possibly dead. Check before redesigning the
  button row around it.
- **Vocabulary is EMPTY on comprehension cards today** (screenshot 2), because a comprehension
  lesson has no vocab of its own — so the panel is blank on exactly the cards where the story is
  meant to be the focus. It should be cumulative per lesson-set. Do the "order as they appear in
  the story" part **as part of §3, sharing one matcher** — it is the same token-alignment problem.
- **§0h (back/next on the QUESTION cards) is its own release, probably its own session.** It is a
  question-runner change (`C.cur`, `check()`, per-run answer state) and it interacts with
  `_speakAndAdvance`, which today advances in one direction only. Scope it separately.

## What is NOT in scope for this session

- The language/script work is finished as of `v76_i` unless my browser pass turns something up.
- Everything in "Owed by the user" in `HANDOVER.md` needs me, not you.
