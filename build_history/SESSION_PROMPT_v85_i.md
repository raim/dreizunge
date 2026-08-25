# Session prompt — written at the `v85_i` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_b`, `v85_c`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_i`** — this is where a long,
continuous run on `PLAN §13` (the generator-page redesign) ends: **`PLAN §13` is now FULLY SHIPPED**,
all five milestones (`v85_c` through `v85_i`, eight releases across one session):

- `v85_c`/`v85_d`/`v85_e` — the wizard shell, the chaptering-card split, the "create storyline now"
  shortcut (milestones 1–2)
- `v85_f` — label reword + per-chapter lesson-type override (milestone 3)
- `v85_g` — storyboard + QC opt-in toggles (milestone 4)
- `v85_h`/`v85_i` — the `doDialectImport()` language-pair bug, then attribution fields at generation
  time for both the pasted-story and PDF-upload paths (milestone 5, the last one)

`v85_b`, right before all of this, shipped two small unrelated fixes (speech-recognition
auto-activation removed; a `#bottom-bar-toggle` button). See `roadmap_v85.md`'s `v85_i` entry (top of
`# SHIPPED IN THE v85 LINE`) for the full write-up of what just shipped, and its own updated index
table for the "PLAN §13 done" note.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first (the
   index table now says `PLAN §13` is fully shipped), then the `v85_i` shipped entry for what just
   landed, then `PLAN §13` itself if you need the historical assessment/build-order detail (nothing in
   it is open any more, but the reasoning behind each milestone's scope is still there).
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives (carries the wizard-shell entries for `v85_c` through `v85_h`; `v85_i`'s own attribution
   wiring was not given its own §6b row — grep `_readGenAttribution`/`_applyGenAttribution` directly
   if needed).
4. `roadmap_v84.md`'s own `# SHIPPED IN THE v84 LINE` if you need to know HOW something already
   working was built — not copied here, go there directly.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 273 checks
node test/run.js --quick                  → expect 239
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 675 `en` keys** (unchanged from
`v85_g`/`v85_h` — the attribution fields reused EXISTING `prov.*` ui.json keys, no new strings
needed). `APP_VERSION = 'v85_i'`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted evaluation/play data — not yours to revert,
commit, or "fix around" without asking. Back it up, `git checkout --` it for any build/test work,
restore it after.

⚠️ **The user's own main dev server (port 3000) was confirmed, as of `v85_h`, to still be running
`v85_b`'s code** — Node loads `server.js` once at process start, and does NOT hot-reload it, unlike
`index.html` (`fs.readFileSync` per request). Ask before restarting it. For any `server.js` change,
verify via `test/lib.js`'s `boot()` (spawns a fresh `node server.js` per e2e run) — NOT a `curl`
against the user's own long-running server, which will give a false negative. `ui.json`'s own
`fs.watch` hot-reload was ALSO separately observed not to pick up an edit live (`v85_e`/`v85_g`) — a
narrower, different staleness (that one DOES have a watcher, it just didn't fire).

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — re-run the full suite for every affected file, not just the one you changed.
8. **A per-caller fix does not generalize to other callers of the same primitive** — grep every call
   site. `v85_h`'s dialect bug AND `v85_i`'s attribution wiring were both this shape: a value/id
   needed threading through MULTIPLE independent completion paths, not just the obvious first one.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee
   whose enforcement lived in a step the optimization skips** — mutation-test it against every
   EXISTING guard it touches.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser
    over the changed region**, not by eyeballing indentation.
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** This whole line's own recurring finding — sometimes the claim holds
    up cleanly (`v85_g`, `v85_i`'s schema/endpoint half), sometimes it doesn't (`v85_d`, `v85_f`,
    `v85_i`'s "which completion path(s)" half) — read first regardless, every time.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** (`v85_e`).
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** — check
    `.tagName`/`.children.length` against the expected real result, not `!!` truthiness.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`** — wrap in `(async()=>{...})()`,
    await OUTSIDE via `settle()`.
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY** — a call-count check alone can't always distinguish a deliberate skip from a guard-less
    crash silently swallowed by a `try/catch`; a second signal may be needed.
17. **`server.js` changes need a FRESH PROCESS to verify live** — the user's own long-running dev
    server does NOT pick them up. Use a real e2e test (`boot()`), not `curl` against port 3000.
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — caught via `git diff --stat` before it went
    anywhere at `v85_h`. Prefer `git diff`/targeted string replacement over "restore from an old
    snapshot" once several edits have landed since that snapshot was taken.
19. **When ONE value/id needs to reach a completion handler that's reachable from MULTIPLE entry
    points (a synchronous cache hit, an async background job, AND that job's own resume-after-reload
    path), thread it through ALL of them explicitly** — `v85_i`'s `genAttribution` needed to ride on
    `APP.activeJob`'s own persisted shape specifically so `resumeBackgroundJob()`'s two branches
    wouldn't silently drop it; found only by reading that function in full, not by assuming the
    background-job path was "just like" the cached one.

# WHERE TO START

`PLAN §13` is fully done. Nothing pre-scoped is queued right now — the natural next candidate, per
the roadmap's own sequencing, is the **browser-reachable single-chapter CP1-4 pipeline** that `PLAN
§13`'s own build order deliberately deferred until milestones 1–5 shipped. This is NOT ready to build
directly: it explicitly **needs its own background-job design first** — CP2's per-sentence LLM calls
are slow (one 4-sentence chapter took 12+ minutes even on a warm model, measured live — see
`roadmap_v83.md`'s own addendum note on the blocked `v83_p` re-verification attempt for the same
finding from a different angle). **Ask the user before starting design work on this** — it is a new,
unscoped initiative, not a continuation of an already-approved plan the way every `PLAN §13` milestone
was.

**Explicitly out of scope, confirmed with the user across this whole `v85` line — do not reopen
without asking**: comic/image import (`PLAN §7.0` Track A4, no code exists); the CP1-6 pipeline's
cross-chapter arc-sequencing (a DIFFERENT, harder piece than the single-chapter CP1-4 pipeline above —
do not conflate the two); spell-check-driven auto error-hunt generation.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport, and every network-touching path across the whole line was verified with the
  network layer stubbed rather than a real LLM backend round-trip.
- **`v85_h`'s dialect fix, against the user's OWN real dev server** — verified via a fresh e2e-spawned
  process only (see the warning above).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map, including the whole speech-recognition
subsystem, the `PLAN §7.0` pipeline, and the `v85_c`→`v85_h` generator-wizard entries — read those
entries before touching any of these areas.
