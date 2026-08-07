I'm continuing development of Dreizunge (a single-file index.html client +
server.js, zero-dependency Node language-learning app). Fresh session picking
up from the v73 cut.

Orient yourself by reading, in order:

1. build_history/HANDOVER.md — one page: baseline numbers, what's owed by me
   (not doable in a container), open decisions, and the two-part spec for this
   session under "Starting the next session".
2. build_history/roadmap_v73.md — read the "⚠️ Session protocol — READ FIRST"
   block and follow its definition-of-done for every change. Note the standing
   design principle: no language knowledge in the code, where *permitted* means
   Unicode machinery, not a hand-authored table.
3. INTERNALS.md — constants, silent-failure modes, invariants, harness limits.
   Read this instead of grepping the notes for "what is the value of X".
4. build_history/v72f_session26_notes.md — the previous session, which is the
   one whose findings this session is built on.

Then establish a green baseline before changing anything:
  node test/run.js            → expect 161 checks
  node test/check-inline.js   → expect 0 failures
  node test/check-inline.js docs/index.html → expect 0 failures
Confirm all three. If the count differs from 161, treat that as a finding and
diagnose it before doing anything else — don't assume a stale fixture. Note that
data files (lessons.json, ui.json) sometimes change between sessions without
that being mentioned; check file timestamps against the code before concluding
anything.

## This session has two parts, in this order

**Part 1 — lib-dom runtime innerHTML parsing.** The full spec is in HANDOVER.md.
Expect the suite to go red across the board before it goes green; treat every
failure as a finding and say in the notes which assertions turn out to have been
passing vacuously, because that's the real payoff. Definition of done includes
converting at least one existing test from matching a markup string to asserting
on parsed nodes — otherwise the capability is unproven.

**Part 2 — cleanup, refactoring, documentation.** Seven evidence-backed items in
HANDOVER.md, each naming the defect that produced it. Don't broaden it into
general tidying. The specific caution: in this codebase "refactoring" has one
recurring failure mode — a second copy of a rule that then drifts — and the last
session alone found two such pairs that had agreed by coincidence for releases,
so nothing ever failed. Prefer removing a second copy over reorganising code
that works.

## How I'd like you to work

- Measure before changing. Several of the last session's conclusions were the
  opposite of what the code looked like, and only measurement caught it.
- Revert-verify every new guard: break the product code and confirm the named
  assertion fires, not a TypeError. A guard that can't be made to fail isn't one.
- Watch for vacuous assertions specifically. The last session produced four, all
  the same shape: asserting on something downstream of the thing under test. For
  each assertion you write, ask what edit to the product code would make it fail.
- One change at a time, suite green between changes, version bumped, docs/ rebuilt.
- Tell me what you'd work on and why before starting, and don't begin a code
  change until I've agreed.
