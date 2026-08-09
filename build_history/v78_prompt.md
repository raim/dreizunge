# Session prompt — the `v78` base cut

*(Rename this file for the version the session WRAPS UP WITH, per the convention set at the v75 cut.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v78`** base cut.

## Orient yourself

Read these four, in order. They are short by design — everything else is reachable from them.

1. `build_history/HANDOVER.md` — one page: baseline numbers, what fires on a data drop, what's owed
   by me, and where this session starts.
2. `build_history/roadmap_v78.md` — the **"⚠️ Session protocol — READ FIRST"** block, then
   **"USER TESTING NOTES"** (my notes from testing, already triaged into five groups).
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. Read this instead
   of grepping the notes for "what is the value of X". §2 carries one **open defect** I'm watching
   for in the browser.
4. `build_history/v77_session31_notes.md` — the previous session. Long, and worth it: twenty-three
   point releases, a "measured" truth table that was four-fifths wrong, and five of my own guards
   that passed under their own revert.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 192 checks
node test/run.js --quick                  → expect 168
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Confirm all four. **If a count differs, treat it as a finding and diagnose it — do not assume a
stale fixture.** Data files (`lessons.json`, `ui.json`, `learners.json`) often change between
sessions without that being mentioned; check timestamps against the code first.

- `unit-static-freshness` red → run `node build-static.js`.
- `unit-script-choice` red saying topics are unstamped → run `node backfill-script.js --write`.

Both are the guards working. A third kind happens too: at the `v78` cut a test failed on a NEW
chapter and **the test was wrong, not the product** — it had encoded a coincidence of the old
corpus. Diagnose before re-pinning.

## Read the rules before writing any probe

**Twenty-two standing rules** now, in `roadmap_v78.md` ("Rules earned in session 28/29/30/31").
Each one cost a wrong finding. The ones that cost the most last session:

- **A probe must CALL the product function**, never a re-typed copy.
- **A claim is only measured if the assertion touched the thing being claimed.** The stub DOM
  auto-vivifies any id, so an element-visibility probe must first assert the element exists in the
  MARKUP — two columns of a "measured" table were phantoms for a whole release.
- **Revert-verify every fix, and believe the result.** Five of my guards last session passed under
  their own revert; each was fixed or labelled. A guard that cannot fail is not a guard.
- **`build-static.js` re-implements client functions.** A fix to the client is not a fix to the
  published build — this caught me three times in one session.
- **The universe helpers return SETS, not arrays**, and a `.slice`/`.some` on them throws inside a
  `try` and silently does nothing.
- **A comment must not spell a pattern a test sweeps for** — it fails the check it documents.

---

# WHERE TO START

**1. My testing notes are already triaged** in `roadmap_v78.md` → "USER TESTING NOTES", in five
groups. **Start with group B** — small, self-contained, and each entry names the trap to avoid.
Two of them (chapter titles, math ordering) were already fixed as `v77_x`.

**2. One open defect I'm watching for:** `_firstUnfinishedLessonIdx` can return -1 with a lesson
still unplayed. Full note in `INTERNALS.md` §2, including the prime suspect and a debugging trap.
`v77_s` may already have cured it — I'll report if I see it again.

**3. Then the remaining queue**, in `roadmap_v78.md`:
- **§0e's ordering half + §3 highlighting**, sharing ONE matcher. **Needs re-planning, not
  implementing** — the roadmap records that the v75 plan was measured twice and is wrong.
- **§0h — question navigation.** Its own session: `C.cur`, `check()`, per-run answer state, and
  `_speakAndAdvance`, which today advances in one direction only.

## Standing tools — use them

- `_cardErrors()` — assert it is empty after any card render you add.
- `probe_gates_v77.js` — re-run and diff after any change to the progress cards. Use
  `v77_card_gates.md` for the table; **`v76_card_gates.md`'s table is superseded.**
- `_cardHeader(prefix)` + the `.card-screen` class — **every new card page must use both.**
  Markup parity is not header parity, and id parity is not width parity.

## Not in scope unless I raise it

Everything under "Owed by the USER" in `HANDOVER.md` needs me, not you — the browser passes, the
`en`-only UI keys awaiting translation, the "how the game works" copy, and the prompt changes that
need a live model.
