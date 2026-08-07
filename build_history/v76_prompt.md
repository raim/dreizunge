I'm continuing development of Dreizunge (a single-file index.html client +
server.js, zero-dependency Node language-learning app). Fresh session picking
up from the v75 cut.

Orient yourself by reading, in order:
1. build_history/HANDOVER.md — one page: baseline numbers, the naming
   convention, what's owed by me (not doable in a container), and where this
   session starts.
2. build_history/roadmap_v75.md — read the "⚠️ Session protocol — READ FIRST"
   block and follow its definition-of-done for every change. Note the standing
   design principle: no language knowledge in the code, where *permitted* means
   Unicode machinery or corpus statistics, not a hand-authored table.
3. INTERNALS.md — constants, silent-failure modes, invariants, harness limits.
   Read this instead of grepping the notes for "what is the value of X".
4. build_history/v74b_session28_notes.md — the previous session. Very long, and
   worth it: nineteen point releases, and the reported bug turned out to be
   none of the three things the roadmap suspected.

Then establish a green baseline before changing anything:
  node test/run.js            → expect 170 checks
  node test/run.js --quick    → expect 149
  node test/check-inline.js   → expect 0 failures
  node test/check-inline.js docs/index.html → expect 0 failures
Confirm all four. If the count differs from 170, treat that as a finding and
diagnose it before doing anything else — don't assume a stale fixture. Data
files (lessons.json, ui.json) often change between sessions without that being
mentioned; check file timestamps against the code before concluding anything.
If unit-static-freshness fails, that is the v73_b guard doing its job — a baked
input moved. Run `node build-static.js` and say so in the notes.

## Read section "Rules earned in session 28" in the roadmap before writing any
## probe. Three of them cost that session a wrong finding each.

The short version, because they were expensive:
- A probe must CALL the product function, never a re-typed copy — least of all
  one lifted from a test stub. Two false findings came from re-implementing
  lessonCountsFor and the read-full-story lock instead of invoking them.
- A claim about behaviour is only measured if the assertion touched the thing
  being claimed. `setComplete=false` is not evidence about a button.
- A non-vacuity check must be evaluated on the data the assertion actually runs
  against, not the data it was derived from.
- A headless harness that builds APP.savedList from whole topics is testing
  STATIC mode, whatever else it thinks it's testing. That blind spot hid a
  live-mode bug from 167 green checks.

## What I owe you, and what I've done since

I've run the browser pass on v75. [REPLACE THIS PARAGRAPH — say what you found,
or say "not yet" so the session plans around it.] The pass mark is the number I
was asked to look at: Churros und Chaos is 40 items where it used to be 83
questions, and an item is solved by ANY correct answer, so 80% is a lower bar
than it was. Tell me what you'd recommend before changing it.

## This session

Work the roadmap_v75.md queue in order, but check each item against the SHIPPED
table in the same file before starting it — session 26 carried an item through
four releases that had already shipped.

1. The pass mark — blocked on my browser pass. Discuss before touching.
2. Highlighting (roadmap §2). MEASURED but not shipped, and the OLD plan in
   roadmap_v74.md is wrong: _articleStatsFor reads grammar items and returns
   sampleSize 0 on the chapters that need it. The corpus-derived replacement is
   measured in the session 28 notes. Size it by the per-chapter effect (Churros
   2 → 10 marks), not the +1% aggregate. Do NOT revert the word boundaries.
3. Browsing completion cards of already-played lessons, with explicit back/next
   so I can revisit and replay. This turns v74_o's "nothing left to do" terminal
   state into a waypoint and interacts with v74_l's Next-only rule — revisit
   both branches together rather than adding a third navigation rule on top.
4. _sbChapterTarget (index.html ~8065) — the seventh and last known instance of
   the raw-lessons pattern. Its test extracts it in isolation, so the harness
   needs reworking first.
5. The storyline-page TTS selector, which was lost with no note explaining why.
   I'd like to choose between English variants for readout.

Still queued for me, don't start them in a container: the comprehension QC
checker (needs a new prompt and a live model), and the translate pass for the
four ui.json keys listed in the roadmap.

Also carry forward, and don't let these drop again — they were lost once at the
v71→v72 roadmap boundary and only recovered in v73_k:
- Global QC: a checkbox menu of what to QC, merged with my request to make the
  book's automatic QC opt-in from the lesson-type menu and run it AFTER the
  storyboard pass. Note that reverses the v68.1 ordering decision.
- Crossword: show the correct word's translation instead of the empty underline.
  Needs a decision first — word_forms items have no translation.
- Live mode with teacher mode OFF must hide every editing control. Same
  _canEdit() conflation as the authorization plan.

## How I'd like you to work

- Measure before changing. Several of session 28's conclusions were the opposite
  of what the code looked like, and only measurement caught it.
- Revert-verify every new guard: break the product code and confirm the NAMED
  assertion fires, not a TypeError. A revert that leaves the product in an
  incoherent state verifies nothing. If a revert PASSES, the guard is vacuous —
  that happened three times in session 28 and each one was a real hole.
- Watch for vacuous assertions specifically, and for source pins that pin the
  defect's own spelling. Session 28 replaced four of those; three sat directly
  next to the bug they were guarding.
- One change at a time, suite green between changes, version bumped, docs/
  rebuilt, packaged. Don't let the tree drift past the last zip I hold.
- Tell me what you'd work on and why before starting, and don't begin a code
  change until I've agreed.
