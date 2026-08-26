# Session prompt — written at the `v85_p` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_p`**. This cut is different from
every prior comic-panel release: the fixes came from the USER'S OWN FIRST REAL END-TO-END TEST of the
shipped feature (upload → draw → auto-detect → extract → create chapter, on their real server), not
from a probe or this session's own verification. Real usage found real problems no amount of
self-testing had.

**What just shipped (`v85_p`)**, both per explicit user rulings:

1. **One chapter per drawn panel, not one per page.** The original milestone-3 scoping decision
   didn't match what the user wanted once they actually tried it ("seems to have only one chapter
   instead of 6, one per panel"). `comicCreateChapter()` now builds one `chunks` entry PER PANEL
   (each with its OWN `comicPanels`, its own fresh crop); `_runBookJob`'s EXISTING sequential
   chaining (already used for multi-chunk PDF splits) links them automatically — no new server-side
   chaining logic, confirmed by reading it first.
2. **Storyboard generation made opt-in EVERYWHERE**, not just for comics. Found: `_runBookJob`'s
   storyboard post-pass had run UNCONDITIONALLY for every `/api/generate-book` caller since v68.1 —
   PDF uploads too, confirmed via code read to be universal and pre-existing, not something the comic
   feature introduced. This also explained a LATENT BUG in `PLAN §13` milestone 4's own
   `#post-gen-storyboard-cb` toggle: captured client-side but never actually sent in the initial
   request, so the unconditional server pass always beat it to the punch — the toggle had been a
   silent no-op the whole time it existed. Fixed with a new `postGenStoryboard` gate, threaded by
   ALL THREE callers (comic — new; PDF — had NO such control at all before, also new; the wizard's
   own multi-chapter flow — fixes its own latent no-op).

**Deferred, per the user's own explicit choice** (general model-reliability issues, confirmed to
affect PDF generation too, not comic-specific — worth their own dedicated round): skill-ID generation
flakiness (3 failed attempts, 462s, in the user's own real test), chapter-title post-pass failures,
vocab article-pairing inconsistency (German-with-article paired against English-without).

See `roadmap_v85.md`'s `v85_p` entry and `INTERNALS.md` §6b for the full mechanism table.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_p` shipped entry.
3. `INTERNALS.md` **§6b** — SIX consecutive comic-panel rows now exist (`v85_j` UI, `v85_k`/`v85_l`
   extraction, `v85_m` chapter formation, `v85_n` progress-card, `v85_o` auto-detect, `v85_p`
   real-usage fixes) — read all six before touching any part of this subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 283 checks
node test/run.js --quick                  → expect 245
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 686 `en` keys** (UNCHANGED from
`v85_o` — this cut's new UI controls reused existing `gen.post_gen_storyboard_lbl`/`form.arc_lbl`
keys, no new strings). `APP_VERSION = 'v85_p'`.

⚠️ **THREE known failures in the baseline, not two** — both `run.js` and `run.js --quick` show, beyond
the two `lessons.json`-mismatch ones, `unit: UI journey transitions (PLAN §C0.1)`. This is a REAL,
PRE-EXISTING, DATA-TRIGGERED bug, confirmed unrelated to `v85_j`-`v85_p`'s own code (reproduces
identically against the `v85_n` committed `index.html`, using the same live data). See the dedicated
section below — carried forward unfixed from `v85_o`, per the user's own explicit choice to finalize
releases first and investigate separately. **This is now TWO sessions old — worth actually doing the
investigation this cut, unless something more urgent comes up.**

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_p`, never touched) — including, this cut, actually testing the comic
feature end-to-end themselves and reporting real bugs. If `lessons.json` shows modified, that is their
own data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in the
`v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** —
pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the hard way; every cut since has done it right.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is one of the two documented `lessons.json`/`unit-ui-journeys` items.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output** — `v85_p`'s whole cut
   is the strongest version of this rule yet: no amount of THIS SESSION's own live-verification found
   what the user's own real usage found in one message. When a real user tests a shipped feature,
   their report is a MORE valuable signal than another self-run verification.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** — `v85_p`'s own storyboard fix broke `e2e-book-formats.test.js`'s stale assertion of the
   OLD unconditional behaviour; found only by re-running the FULL suite after the fix, not by
   reasoning about the change in isolation.
8. **A per-caller fix does not generalize to other callers of the same primitive** — the storyboard
   opt-in flag needed threading through THREE independent callers (comic, PDF, wizard), found by
   grepping every caller of `/api/generate-book`, not by fixing the one the bug report named.
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** `v85_p`'s own chapter-per-panel redesign relied on `_runBookJob`'s
    EXISTING chaining — checked by reading the function fully before assuming it would "just work"
    for N chunks the same way it already does for a multi-chunk PDF split. It did.
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path** — `v85_p`'s own storyboard-opt-in fix is exactly this shape: the comic feature
    didn't introduce the unconditional-storyboard bug, it just made someone actually NOTICE it.
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss**,
    including nested `.querySelector(...).innerHTML` on `.querySelectorAll(...)` results.
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`.**
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY.**
17. **`server.js` changes need a FRESH PROCESS to verify live.**
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — safe only when the backup was taken
    immediately before the ONE mutation being reverted; verify the diff afterward regardless (`v85_p`
    did this twice, correctly, for two separate mutation tests).
19. **When ONE value/id needs to reach a completion handler reachable from MULTIPLE entry points,
    thread it through ALL of them explicitly.**
20. **A live model call's OWN token budget can interact with its OWN behaviour in ways a shorter test
    won't show.**
21. **A guard's own mutation test can reveal it fires EARLIER/MORE OFTEN than the comment claims.**
22. **A destructive or blanket git action (`git checkout -- <file>`, `git add -A`) can be BLOCKED by
    this environment's own permission classifier.**
23. **An "index-aligned by construction" claim between a client array and a server response array
    needs a test that actually BREAKS one element and checks the SURVIVORS' indices.**
24. **A prompt validated on ONE real fixture does not transfer its validated behaviour just because
    the prompt was generalized in prose, OR wired into a new code path.**
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime**, and its stdout is LOST unless explicitly redirected.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route must wait for the
    job's own completion signal before checking those side effects.**
27. **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated the way the e2e
    harness's `boot()` is** — pass an explicit `LESSONS_FILE=/tmp/...` override every time.
28. **A test's own "canned model response" fixture should reflect what the REAL model was actually
    observed to say, not just the idealized instruction-compliant form.**
29. **A test that reads the REAL, LIVE `lessons.json` to pick its own fixtures can go from green to
    red PURELY FROM THE CORPUS GROWING**, with no code change at all.
30. **A real user's bug report after actually using a shipped feature can surface MULTIPLE independent
    findings in one message — separate them, triage which are in-scope-now vs. deferred, and get
    explicit rulings on genuine design forks (chapter granularity) rather than assuming which fix the
    report implies.** `v85_p`'s own four-part report needed exactly this: two design-fork rulings
    (chapter granularity, storyboard scope) via `AskUserQuestion`, one clear bug fixed outright
    (missing lesson-type controls, no ambiguity), and two items explicitly deferred at the user's own
    request rather than silently expanded into.

# WHERE TO START

**Do the `unit-ui-journeys.test.js` investigation this cut** (see the dedicated section above and the
one it inherited from `v85_o`) — it's carried unfixed for two releases now. Determine whether
`applyUIStrings()`'s `#lang-select` crash is a real, user-facing bug (reachable in an actual browser)
or purely a test-harness DOM-stub-timing artifact, before deciding whether it needs an application
fix, a test fix, or both.

**The deferred model-reliability issues** (skill-ID flakiness, title-gen flakiness, vocab article-
pairing) are real and reported by the user directly — worth their own dedicated investigation
whenever the user wants to prioritize it. Not comic-specific; affects PDF generation too.

Nothing else is pre-scoped for the comic-panel subsystem. Other real, unmeasured gaps: real
mobile/touch rendering (neither the drawing UI nor the panel-display cards checked on a device);
non-German target languages (the case-restoration fix is German-only); the HARD `§2.7` fixture (Page
A) never tried with any model/strategy; Tier 2 (per-word image coordinates) still explicitly out of
scope.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport.
- **The skill-ID / title-gen / vocab-pairing model-reliability issues** — real, reported by the user
  directly, deferred at their own request. Needs its own investigation round.
- **`v85_p`'s own fixes, against the user's real environment** — mechanically verified via e2e tests
  with a real server + fake LLM backend, but NOT live-verified against the real model this cut (a
  deliberate choice — see this file's own note above). The user is already testing this live.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The six comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read all six before touching any part of this subsystem.
