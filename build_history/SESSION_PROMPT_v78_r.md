# Session prompt — the `v78_r` base cut

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v78_r`** base cut.

## Orient yourself

Read these four, in order. They are short by design — everything else is reachable from them.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what fires on a data drop, what's owed
   by me, and where this session starts.
2. `build_history/roadmap_v78.md` — the **"⚠️ Session protocol — READ FIRST"** block, then the
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

**Twenty-six standing rules** now, in `roadmap_v78.md` ("Rules earned in session 28…32"). Each one
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

**1. Nothing is blocked on me except two translation passes** — `sl` has no `ui.json` block, and
Slovenian reopened `languages.json` name cells. Both are faster now with `--batch` / `--threads`.

**2. The next item is a DISCUSSION I asked for, not an implementation.** The per-text learning
scheme: `roadmap_v78.md` → "USER TESTING NOTES — session 32, second batch" → "NEEDS DESIGN".

**The prerequisite measurement is already DONE — read it, do not re-derive it**
(`roadmap_v78.md` → "THE COVERAGE MEASUREMENT", and session-32 notes §22). A chapter's lessons teach
**9.2% of its story's tokens / 8.2% of its distinct words**, median chapter 13.2%, none above 50% —
and the **rarest words are the LEAST covered (5.1%)**, the opposite of what I asked for. So it is a
generation problem AND a policy change, not a top-up.

**If you want one more number before we talk**, it is this: what share of the uncovered word types
are INFLECTIONS of words the lessons already teach. That decides between "generate ten times as
much" and "teach the forms of what is already taught", which are different products.

**3. Buildable without discussion, if I ask for it:**
- **§0h — question navigation.** Its own session: `C.cur`, `check()`, per-run answer state, and
  `_speakAndAdvance`, which today advances in one direction only.
- **§0d is EMPTY** — the Replay ordering fix shipped as `v78_l` and the three card items as
  `v78_n`. §0h is the only queued implementation item left, and it wants a session of its own.
  **Any change to the progress cards still requires re-running AND diffing `probe_gates_v77.js`
  against this cut** — running it without the diff proves nothing.

## Standing tools — use them

- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run and diff after any change to the progress cards. Use
  `v77_card_gates.md` for the table; **`v76_card_gates.md`'s table is superseded.**
- `_cardHeader(prefix)` + the `.card-screen` class — **every new card page must use both.**
- `_storyWordSources(d)` — the one collector for "what words does this chapter teach", with the
  probe that says whether each was answered. Both highlight shades read it; anything asking that
  question should too, rather than growing a second list.

## Not in scope unless I raise it

Everything under "Owed by the USER" in `HANDOVER.md` needs me, not you — the browser passes, the
`sl` UI block and `languages.json` name cells awaiting translation, the `cyrillic-sr` sounds column
for the `latin` table (a language judgement, not a code change), the "how the game works" copy, and
the prompt changes that need a live model.
