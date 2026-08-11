# Session prompt — the `v79` base cut

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v79`** base cut.

## Orient yourself

Read these four, in order. They are short by design — everything else is reachable from them.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what fires on a data drop, what's owed
   by me, and where this session starts.
2. `build_history/roadmap_v79.md` — the **"⚠️ Session protocol — READ FIRST"** block, then the
   **"USER TESTING NOTES"** sections (mine, already triaged).
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. Read this instead
   of grepping the notes for "what is the value of X".
4. `build_history/v78_session32_notes.md` — the previous session. Long, and worth it: thirteen point
   releases, a plan that described a seventh of its data, a roadmap truncated to zero bytes, and
   three guards that caught things nobody was looking for.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 206 checks
node test/run.js --quick                  → expect 182
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If a count differs, treat it as a finding and diagnose it — do not assume a
stale fixture.** Data files (`lessons.json`, `ui.json`, `learners.json`, `languages.json`) often
change between sessions without that being mentioned; check timestamps against the code first.

- `unit-static-freshness` red → run `node build-static.js`.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

**But read rule 23 first: the fixers are not a diagnosis, and running one destroys the evidence that
says whether it was right.** Check three cheap things before either — corpus counts, file mtimes (a
file a fixer just rewrote is the NEWEST), and the hash the freshness guard names. **Order matters:
backfill FIRST, build-static SECOND.** Session-32 notes §1 and §7 are the long form.

A third kind happens too: a test can fail on NEW data and **be wrong itself** — twice last session
(`unit-mixed-unlock-reachable` at the v78 cut, `unit-replay-focus` §8c on the first conjugation
lesson, which had been measuring the corpus for years). Diagnose before re-pinning.

## Read the rules before writing any probe

**Twenty-eight standing rules** now, in `roadmap_v79.md` ("Rules earned in session 28…32"). Each one
cost a wrong finding. The ones that cost the most last session:

- **A fixer is not a diagnosis** (23), and **a note telling the next session to check something is
  not a guard** (24) — if a fact can be derived from a source of truth, assert it.
- **When two releases change the same surface, re-measure the older plan against the newer
  behaviour** (26). A plan carried unchanged across three roadmaps described 17% of its data.
- **Never put emoji in a Python string literal** (25). It truncated `roadmap_v78.md` to zero bytes;
  the exception arrives AFTER the file is opened, so a failed write is not a no-op.
- **A probe must CALL the product function**, never a re-typed copy.
- **A claim is only measured if the assertion touched the thing being claimed.**
- **Revert-verify every fix, and believe the result.** When an early section aborts the file, the
  later sections were never executed — verify each against a revert only it can see.
- **`build-static.js` re-implements client functions.** A fix to the client is not a fix to the
  published build.
- **A comment must not spell a pattern a test sweeps for.**

---

# WHERE TO START

**1. Read `roadmap_v79.md`'s "⚠️ OPEN AT THE v79 CUT" block first.** Three things are open and two
of them need ME, not you.

**2. The one that needs a RULING before any code: `useFullChain` does not do what its label says.**
The checkbox promises "Pass the full storyline as context"; it actually chooses between the PREVIOUS
CHAPTER in full and its last N characters. So every continuation is written from one chapter of
context however the box is set. Either make the label true (feed `_chainStory` into the story
prompt — it already exists, with a chapter count and a budget) or make it honest (reword the tooltip
and rename the field). **The first changes what every continuation costs in tokens and wall-clock on
a model that already takes ~100s per 100-word story, so ask me rather than choosing.**

**3. Owed by me, do not attempt it:** regenerating the vocabulary lesson of
`tp_17863746762340000193`, whose target words are Latin in a Cyrillic chapter. `v79_a` stops any NEW
chapter arriving that way; this one predates the fix and needs a live model. `unit-script-choice`
lists it by id — **delete that entry when I confirm it is regenerated, and if a second id ever
appears, that means the fix did not hold rather than that the list should grow.**

**4. The per-text learning scheme is a DISCUSSION I asked for.** Its prerequisite measurement is
already done — do not re-derive it. `roadmap_v79.md` → "THE COVERAGE MEASUREMENT": a chapter's
lessons teach **9.2% of its story's tokens, 8.2% of its distinct words**, and the **rarest words are
the least covered (5.1%)**, the opposite of "start with the hard words". Generation problem AND a
policy change. If you want one more number first, it is what share of the uncovered types are
INFLECTIONS of words already taught.

**5. Buildable without a ruling:** **§0h — question navigation.** Its own session: `C.cur`,
`check()`, per-run answer state, and `_speakAndAdvance`, which advances in one direction only.
§0d is empty.

## Standing tools — use them

- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run **and diff** after any change to the progress cards. Running it
  without diffing against the previous cut proves nothing. `v77_card_gates.md` for the table;
  **`v76_card_gates.md`'s is superseded.**
- `_cardHeader(prefix)` + `.card-screen` — every new card page must use both.
- `_storyWordSources(d)` — the one collector for "what words does this chapter teach", with the
  probe saying whether each was answered. Both highlight shades read it.
- `scriptPinNote(lang, script)` — **any new prompt that emits target-language text must call it**,
  or a digraphic language silently drifts (that is `v79_a`, and it is exactly how a Cyrillic chapter
  came to teach Latin vocabulary).
- `probe_coverage_v78n.js` / `probe_coverage_bands_v78n.js` — the coverage numbers, with their
  results in the headers so a later run has something to diff.

## Not in scope unless I raise it

Everything under "Owed by the user" in the roadmap's open block — the mixed-script lesson, the
`cyrillic-sr` sounds column for the `latin` table (a language judgement, not a code change), the
"how the game works" copy, and the prompt changes that need a live model.
