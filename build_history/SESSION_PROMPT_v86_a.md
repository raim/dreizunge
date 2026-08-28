# Session prompt — written at the `v86_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_b`, `v86_c`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_a`**, cut fresh from
`roadmap_v85.md` at the user's own request ("once we are done with these, let's cut to v86") after a
real-device follow-up round on the comic-panel subsystem closed out the `v85` line. This file is
short on purpose (a fresh cut, not an accumulated one) — the real backlog lives in `roadmap_v86.md`'s
own "OPEN AT THE v86 CUT" section (items A–H), carried forward from `v85_u` on their merits, not
mechanically. Read that section before starting anything; it points at exactly where each item's full
diagnosis lives in `roadmap_v85.md` rather than repeating it.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section in full (items A–H — none built yet, all scoped).
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. **Two comic-panel rows are overdue** (item H below) — add them the first time you're in
   that subsystem for real, don't let a third cut pass without it.
4. `roadmap_v85.md`'s own `# ✅ SHIPPED IN THE v85 LINE` if you need to know HOW something already
   working was built (twenty-one point releases, `v85_a`…`v85_u`) — not copied here, go there
   directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 686 `en` keys** (unchanged from the
`v85` line's end — this cut touched no code, no `lessons.json`, no `ui.json`). `APP_VERSION = 'v86_a'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (bound to port 3000 across
the entire `v85` line, never touched — check whether it still is). If `lessons.json` shows modified,
that is their own data — not yours to revert, commit, or "fix around" without asking. `git checkout --
lessons.json` and `git add -A` were BOTH blocked by this environment's own permission classifier in
the `v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. **If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty**,
point `build-static.js` at that temp file explicitly — if it's CLEAN, the plain default is fine.

⚠️ **`docs/index.html` is ~9.1MB**, up from ~8.4MB across the `v85` line — this is item A's own
measurement made real (comic-panel base64 images baked wholesale), not a mistake to chase.

⚠️ **This container HAS a live model backend** — confirmed in the `v85` line: `qwen2.5vl:7b` via
Ollama, used for real (a live probe, not just a plausible prompt). Check `ollama list`/`curl
localhost:11434/api/tags` fresh each session before assuming a "needs live verification" item is
unreachable — the `v85` line found several such items were NOT actually blocked, just never checked.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules, see that file's own "How the rules
are NUMBERED" note before citing one)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified (rule 32).
6. **A live model call needs a live test AND a real human reading the output** — and check what's
   actually installed before assuming a container can't do this at all (rule 41).
7. **A per-caller (or per-role) fix does not generalize to other callers of the same primitive** —
   grep every call site, and check whether server-side plumbing for a requested feature already
   exists before estimating its size (rules 8, 44).
8. **A rigorously measured finding for ONE contributing factor is not proof there is only one** (rule
   42) — the `v85` line's own clearest instance: a live-probed model-accuracy finding was real, and a
   SEPARATE, fully-fixable UI bug was very likely compounding on top of it the whole time.
9. **Check whether an EXISTING ruling already answers what looks like a new design question** — grep
   the roadmap before deciding fresh (rule 43). Item A below is exactly this: a `v80`-era ruling
   (`D4`) a later feature simply never implemented.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

**Nothing is pre-scoped as mandatory** — items A–H in `roadmap_v86.md`'s own "OPEN AT THE v86 CUT"
section are all real, all scoped, none confirmed as THIS session's priority by the user yet. A
reasonable ordering, not a ruling:

- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code — ask first if picking this up.
- **Item A (move comic images out of `lessons.json`)** is the most architecturally load-bearing (it
  affects `docs/index.html` size, every test that parses `lessons.json`, and the static-export
  degrade) — but the migration step for the 6 existing topics needs the user's own go-ahead first.
- **Items B (vision model picker), D (Tier 2 image-coordinate highlighting), E/F (live-verification
  owed items), G (device verification), H (`INTERNALS.md` rows)** are each independently startable.

Ask the user which they want prioritized, rather than picking on inference — several of these
(A's migration, C's recommendation) explicitly need their own go-ahead first.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
