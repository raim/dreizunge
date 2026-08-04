I'm continuing development of Dreizunge (a single-file index.html client +
server.js, zero-dependency Node language-learning app). Fresh session picking
up from the v74 cut.

Orient yourself by reading, in order:
1. build_history/HANDOVER.md — one page: baseline numbers, what's owed by me
   (not doable in a container), open decisions, and where this session starts.
2. build_history/roadmap_v74.md — read the "⚠️ Session protocol — READ FIRST"
   block and follow its definition-of-done for every change. Note the standing
   design principle: no language knowledge in the code, where *permitted* means
   Unicode machinery, not a hand-authored table.
3. INTERNALS.md — constants, silent-failure modes, invariants, harness limits.
   Read this instead of grepping the notes for "what is the value of X".
4. build_history/v73k_session27_notes.md — the previous session. Long, and worth
   it: ten point releases, five of them from bugs I found by playing rather than
   from anything the suite could produce.

Then establish a green baseline before changing anything:
  node test/run.js            → expect 166 checks
  node test/run.js --quick    → expect 145
  node test/check-inline.js   → expect 0 failures
  node test/check-inline.js docs/index.html → expect 0 failures

Confirm all four. If the count differs from 166, treat that as a finding and
diagnose it before doing anything else — don't assume a stale fixture. Data
files (lessons.json, ui.json) often change between sessions without that being
mentioned; check file timestamps against the code before concluding anything.
If unit-static-freshness fails, that is the v73_b guard doing its job — a baked
input moved. Run `node build-static.js` and say so in the notes.

## This session — the lesson flow, the completion card, comprehension

FIRST: I play-tested v74 and reported user progress, lesson flow and completion cards as broken.
Session 27 shipped nine changes to this subsystem in one sitting with no browser in the loop. Read
roadmap_v74.md §0 before anything else — it names the prime suspect and the bisection points, one
change per version with docs/ rebuilt at each. Establish what is actually broken before writing
code, and prefer reverting to re-fixing.

QC work is POSTPONED. Not the QC menu, not mergeFlaggable, not the comprehension checker.

Full spec in roadmap_v74.md under "THIS SESSION". It's one block of work rather
than three: session 27 fixed four defects in this area and each exposed the next.

The design work is specified in roadmap_v74.md §1-§4, from my play-test notes.
Two of those items are not what they look like, and both were measured before
being written down — read them there rather than taking my note at face value:

  - The progress bars are three questions sharing one display (lessons vs
    questions vs the unlock gate), which is why one chapter reads 2/2 and the
    next 67/83 on identical bars, and why a chapter can read "below threshold"
    with the story already unlocked.
  - "Too little highlighting" is mostly NOT the v73_e boundary fix. Vocabulary
    is stored in dictionary form while stories use inflected forms. Do NOT
    revert the word boundaries.

Also still open and measured, but behind the above:
  - topicCoverage().total is nondeterministic — 15 of 294 topics return a
    different denominator run to run. Needs a DECISION about seeding the
    universe, not a patch; tell me the options before writing code.

Do NOT start the comprehension QC checker in a container. It needs a new prompt
and a live model; queue it for me.

Also carry forward, and don't let these drop again — they were lost once already
at the v71→v72 roadmap boundary and only recovered in v73_k (roadmap_v74.md,
"RECOVERED"):
  - Global QC: a checkbox menu of what to QC, merged with my request to make the
    book's automatic QC opt-in from the lesson-type menu and run it AFTER the
    storyboard pass. Note that reverses the v68.1 ordering decision.
  - Crossword: show the correct word's translation instead of the empty
    underline. Needs a decision first — word_forms items have no translation.
  - Live mode with teacher mode OFF must hide every editing control. Same
    _canEdit() conflation as the authorization plan.

## How I'd like you to work

- Measure before changing. Several of the last session's conclusions were the
  opposite of what the code looked like, and only measurement caught it — twice
  the measuring script had the same bug as the code it was checking.
- Revert-verify every new guard: break the product code and confirm the NAMED
  assertion fires, not a TypeError. A revert that leaves the product in an
  incoherent state verifies nothing.
- Watch for vacuous assertions specifically. The last session found nine, all
  the same shape: the assertion is downstream of the thing under test, or the
  fixture is arranged so the distinction never arises. For each assertion, ask
  what edit to the product code would make it fail — then actually make it.
- One change at a time, suite green between changes, version bumped, docs/
  rebuilt.
- Tell me what you'd work on and why before starting, and don't begin a code
  change until I've agreed.

MY TODOs:

* the storyline/chapter QC menu is still what I most want to use — but AFTER
  the lesson flow is trustworthy again.
* scan the remaining roadmap base-version boundaries for lost [OPEN] blocks —
  only 1 of 28 has been checked, and that one had three live items in it.
* I still owe browser passes on v71_i–v74, now including the completion card
  specifically (the new gate row and lesson icon row together, on a phone).
* think about whether the corpus needs a repair pass rather than more guards:
  5 lessons would be rejected by the app's own rule, 157 identical
  source/target vocab pairs, 1 lesson in the wrong script entirely.
