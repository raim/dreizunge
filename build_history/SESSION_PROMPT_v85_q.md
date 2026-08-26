# Session prompt — written at the `v85_q` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_q`**. This cut is a single item:
the `unit-ui-journeys.test.js` `#lang-select` crash carried unfixed since `v85_o` (two releases) is
now diagnosed and fixed. **Test-only — no application code changed.**

**What just shipped (`v85_q`)**:

Diagnosed the crash as a **test-harness DOM-stub artifact, confirmed NOT reachable in a real
browser** — not the application bug it could have been. Two distinct manifestations of the same root
cause (`lib-dom.js` never parses the page's STATIC markup, and has no `SELECT`/`OPTION` semantics for
markup it DOES parse dynamically), both fixed with per-file harness shims in
`unit-ui-journeys.test.js`, matching the existing convention in `unit-continue-pin.test.js` /
`unit-lang-picker-sync.test.js` for the first, and a new (but same-spirit) `querySelectorAll` wrapper
for the second, which had no precedent since it needs to catch dynamically-ID'd `<select>`s. Full
diagnosis chain, the "confirmed unreachable in a real browser" argument, and the mutation-testing
trail are in `roadmap_v85.md`'s `v85_q` entry — read it before touching `unit-ui-journeys.test.js` or
`lib-dom.js` again, so the same investigation doesn't get re-run from scratch.

`docs/index.html` was rebuilt for this release from the **committed** `lessons.json` (via
`git show HEAD:lessons.json` into a temp file, passed as `build-static.js`'s first argument) —
**not** the working tree's, which is the user's own live, uncommitted data (691 lines of it at this
cut; see the warning below). This keeps the static build honest about what's actually shipped without
touching or incorporating the user's private in-progress corpus.

See `roadmap_v85.md`'s `v85_q` entry and `INTERNALS.md` §6b (comic-panel subsystem, unaffected by this
cut) for the full mechanism table.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_q` shipped entry.
3. `INTERNALS.md` **§6b** — SIX consecutive comic-panel rows still stand (`v85_j` UI, `v85_k`/`v85_l`
   extraction, `v85_m` chapter formation, `v85_n` progress-card, `v85_o` auto-detect, `v85_p`
   real-usage fixes) — unaffected by `v85_q`, but still read all six before touching that subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 283 checks
node test/run.js --quick                  → expect 245
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 686 `en` keys** (UNCHANGED from
`v85_p` — this cut touched a test file only, no new strings, no corpus edit). `APP_VERSION = 'v85_q'`.

⚠️ **TWO known failures in the baseline** (back down from three — the `unit-ui-journeys` one is FIXED
this cut): both `run.js` and `run.js --quick` show `unit: current roadmap names the current line`
and `unit: docs/ built from current sources`, both because the WORKING-TREE `lessons.json` has grown
past what's committed (the user's own live testing — see the warning right below). Both are
DATA-DRIFT failures, not code bugs, and both will keep failing between releases as the user's own
corpus grows — that is expected, not a regression to chase.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_q`, never touched) — including comic-feature testing that added 691 lines
of new storylines/topics during the `v85_p`→`v85_q` window alone. If `lessons.json` shows modified,
that is their own data — not yours to revert, commit, or "fix around" without asking. `git checkout
-- lessons.json` and `git add -A` were BOTH blocked by this environment's own permission classifier
earlier in the `v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and
stage files explicitly by name. **`v85_q` needed this exact pattern for real** (not just for
inspection): `build-static.js` was invoked with that temp file as its explicit first argument to
rebuild `docs/index.html` from the committed corpus, never the dirty working-tree one — the pattern to
repeat verbatim any time a release needs a docs rebuild while `lessons.json` is dirty.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** —
pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the hard way; every cut since has done it right.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is one of the two documented `lessons.json` items above.

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
31. **A crash reproduced only inside a DOM-stub test harness needs the "would this survive in a real
    browser" question answered before it is treated as an app bug** — `v85_q`'s own `#lang-select`
    crash traced to `lib-dom.js` never parsing static markup outside the `<script>` block, so the
    fix belonged in the test (a harness shim, matching two existing precedents), not the app. Fixing
    ONE manifestation surfaced a SECOND, different-shaped instance of the identical root cause
    (a dynamically-rendered `<select>` this harness genuinely parses but has no `.options` semantics
    for) — the same "a per-caller fix does not generalize" shape as rule 8, one level down in the
    stack.
32. **Rebuilding a generated artifact (`docs/index.html`) while `lessons.json` is dirty with the
    user's own live data needs the BUILD SCRIPT pointed at the COMMITTED file, not the working tree
    one** — `build-static.js`'s `[lessons.json]` argument exists for exactly this; `git show
    HEAD:lessons.json > /tmp/x.json` then `node build-static.js /tmp/x.json` rebuilds honestly without
    ever reading, let alone incorporating, the user's uncommitted data.

# WHERE TO START

**The `unit-ui-journeys.test.js` investigation is DONE** (`v85_q`) — nothing carried forward from it.

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
  with a real server + fake LLM backend, but NOT live-verified against the real model (a deliberate
  choice — see `roadmap_v85.md`'s `v85_p` entry). The user is already testing this live.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The six comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read all six before touching any part of that subsystem.
