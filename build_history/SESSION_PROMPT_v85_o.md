# Session prompt — written at the `v85_o` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_o`, `v85_p`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_o`**. Track A4 (comic/image
ingest) finished its original 4-milestone plan at `v85_n`. This session added ONE more feature on top,
at the user's own initiative: auto-detect panels as a suggestion pre-filling the manual-drawing UI.

**What just shipped (`v85_o`)**: `POST /api/comic-detect-panels` — the same one-shot-enumeration
prompt and parser from `probe_comic_panels_v85_i.js`, carried into production — pre-fills
`APP_COMIC.boxes` from the model's answer (same shape a hand-drawn box uses), fully editable/deletable
through the existing UI. A third sibling poller (`_startComicDetectJob`). See `roadmap_v85.md`'s
`v85_o` entry and `INTERNALS.md` §6b for the full mechanism table.

**A real parser gap was found by THIS milestone's own live verification, not by any prior probe.**
First live run against the real Page B fixture (through the actual production route): 0 of 6 panels
parsed, despite the model answering essentially perfectly — it had wrapped coordinates in bare ANGLE
brackets (`<23 58 407 396>`), a third format the parser (carried over from the probe) didn't account
for. Fixed, mutation-tested (confirmed the guard goes red without the fix), re-verified against the
same real fixture: all 6 panels, clean grid, matching the original probe's own success. **The lesson**:
even a prompt+parser combination already validated in a probe can still hit a REAL production surprise
the first time it's actually wired end-to-end and re-run — don't assume a probe's historical success
transfers automatically; the live re-check is what caught this, not code review.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_o` shipped entry.
3. `INTERNALS.md` **§6b** — FIVE consecutive comic-panel rows now exist (`v85_j` UI, `v85_k`/`v85_l`
   extraction, `v85_m` chapter formation, `v85_n` progress-card, `v85_o` auto-detect) — read all five
   before touching any part of this subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 281 checks
node test/run.js --quick                  → expect 244
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 686 `en` keys** (2 new keys:
`form.comic_detect`/`comic_detect_failed`). `APP_VERSION = 'v85_o'`.

⚠️ **THREE, not two, known failures in the baseline right now** — both suites (`run.js` and
`run.js --quick`) currently show a THIRD failure beyond the two documented `lessons.json`-mismatch
ones: `unit: UI journey transitions (PLAN §C0.1)`. This is a REAL, PRE-EXISTING, DATA-TRIGGERED bug,
confirmed unrelated to this cut's own code — see the dedicated section below for the full diagnosis
and why it just started failing now. Do not assume a fresh session's own baseline run is broken by
something IT did; check this section first.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_o`, never touched). If it shows modified, that is their own data — not
yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json` and
`git add -A` were BOTH blocked by this environment's own permission classifier earlier in the `v85`
line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files explicitly.

⚠️ **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated by default** —
pass `LESSONS_FILE=/tmp/...`. `v85_m` learned this the hard way; `v85_n` and `v85_o` both did it right.
Keep doing it right.

⚠️ **A different port than 3457/3458 may show as "in use" by an unrelated process** (a browser's own
network-service subprocess showed up in an `lsof` check this cut, not a Dreizunge server at all) —
`curl .../api/info` before assuming a port is actually occupied by something worth avoiding, and don't
hesitate to just pick a different port number if genuinely unsure.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix** — unless the failure is the documented `lessons.json` mismatch above.

## The habits that cost this project the most (full incident history: `roadmap_v84.md`'s "Rules
earned in session N…the v84 line" blocks)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable**, and mutation-test every guard.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order.**
5. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
6. **A live model call needs a live test AND a real human reading the output.** `v85_o` is a strong
   case: a prompt+parser already validated in an OLD PROBE still needed its OWN fresh live check once
   wired into production — the probe's historical success did not predict this cut's real finding.
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape.**
8. **A per-caller fix does not generalize to other callers of the same primitive.**
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.** Now FOUR-TIME-confirmed for this codebase: server-side job/poll
    primitives reuse cleanly; client-side polling wrappers need their own sibling every time
    (`startBackgroundJob`, `_pollBookJob`, and now a third: extraction/chapter-formation/detection
    each got their own poller rather than sharing).
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss** —
    including a nested `.querySelector(...).innerHTML` on a sub-element from `.querySelectorAll(...)`,
    which doesn't reflect real content even on a genuine match (found at `v85_n`).
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`.**
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY.**
17. **`server.js` changes need a FRESH PROCESS to verify live.**
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — safe ONLY when the backup was taken
    immediately before the ONE mutation being reverted, with nothing else changed in between (`v85_o`
    did this correctly for its own mutation test; verify the diff afterward regardless).
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
    the prompt was generalized in prose, OR just because it is the SAME prompt wired into a NEW code
    path — `v85_o`'s own finding is the second shape of this same lesson (`v85_l` was the first).**
25. **A background process started with a bare shell `&` inside a tool call may or may not survive
    past that tool call's own lifetime** — and its stdout is LOST unless explicitly redirected to a
    file; `v85_o` lost a diagnostic call's entire output this way once before catching it.
26. **A test asserting on ASYNC SIDE EFFECTS of a fire-and-forget server route must wait for the
    job's own completion signal before checking those side effects.**
27. **A manual `PORT=NNNN node server.js` live-verification run is NOT data-isolated the way the e2e
    harness's `boot()` is** — pass an explicit `LESSONS_FILE=/tmp/...` override every time.
28. **A test's own "canned model response" fixture should reflect what the REAL model was actually
    observed to say, not just the idealized instruction-compliant form** — `v85_o`'s fake-ollama
    response deliberately mixes the requested tag format with the angle-bracket format the real model
    was caught using, so the test exercises both parser paths, not just the happy one.
29. **A test that reads the REAL, LIVE `lessons.json` to pick its own fixtures (instead of a fixed/
    seeded snapshot) can go from green to red PURELY FROM THE CORPUS GROWING**, with no code change
    at all — `unit-ui-journeys.test.js`'s storyline-screen scenario exposed a previously-NEVER-
    EXERCISED code path this exact way at the `v85_o` cut (see the dedicated section right below).
    When a test fails and you didn't touch the code it tests, check whether it depends on live data
    before assuming it's your change.

## ⚠️ A REAL, PRE-EXISTING BUG WAS FOUND AT THE `v85_o` CUT — NOT FIXED, FLAGGED FOR FOLLOW-UP

`node test/run.js` (full suite) currently fails a THIRD test beyond the two documented `lessons.json`
mismatches: **`unit: UI journey transitions (PLAN §C0.1)`**. Confirmed, rigorously, to be UNRELATED to
any `v85_j`-`v85_o` comic-panel work:
- Reproducible 5/5, not a flake.
- Reproduces IDENTICALLY against the `v85_n` (pre-`v85_o`) committed `index.html`, using the SAME
  live `lessons.json` — i.e. it is not caused by this cut's code changes at all.

**Root cause, diagnosed**: `test/unit-ui-journeys.test.js` reads the REAL, LIVE `lessons.json`
directly (`fs.readFileSync(... 'lessons.json' ...)`, not an isolated fixture) to pick its test
topics — `TOPIC` (for the lesson journeys) and `SL` (a real storyline, for the storyline-screen
journey) are each independently `.find()`-selected from WHATEVER the corpus currently contains.
`client()` sets `APP.uiLang = TOPIC.srcLang`. `openStorylineScreen()` conditionally calls
`loadUIStrings(slSrc)` — reloading and RE-APPLYING every UI string — whenever the storyline's own
source language differs from the current UI language. As long as `TOPIC.srcLang` and `SL`'s chapter's
`srcLang` happened to match (both `en`, in every corpus state up to now), that reload branch was NEVER
actually exercised by this test. **The corpus grew during this exact session** — including via the
user's own real, live test of the `v85_m`/`v85_n` comic-upload feature (a genuine 6-panel
`comicPanels` chapter, "Knödel Kingdom", now sitting in the real corpus) — which shifted WHICH topic
`TOPIC`'s own `.find()` now lands on, and its `srcLang` no longer matches `SL`'s. This is the FIRST
time this reload branch has ever actually run under this test, and `applyUIStrings()` — a GENERIC,
comic-unrelated function that touches `#lang-select` (`document.getElementById('lang-select')`)
among many other elements — crashes: `Array.from(tgtSel.options)` throws because `tgtSel.options` is
`undefined`. In the STUB test-harness DOM this means `#lang-select` wasn't found (an auto-vivified
fake stub was returned instead, per this harness's own documented null-on-miss behaviour) at the
exact moment `applyUIStrings` ran inside this specific async chain. **Whether this is ALSO a real,
user-facing bug in an actual browser (where a null `getElementById` result would just skip via the
existing `if(tgtSel)` guard, not crash) or purely a test-harness artifact of the STUB DOM's timing has
NOT been determined** — that is the first thing to check before deciding whether this needs an
application fix, a test fix, or both.

**User's own explicit ruling on how to proceed**: finalize `v85_o` cleanly first (done — this bug is
NOT part of that commit), investigate this SEPARATELY afterward. **Do this investigation before
building anything else** — a red full-suite baseline is exactly the kind of finding this project's
own protocol says not to paper over or leave for "later" without an explicit note, and this note IS
that explicit flag. Start by reproducing with `node test/unit-ui-journeys.test.js` directly, then
trace whether `#lang-select` is genuinely missing from the DOM at that point (stub-timing bug) or
whether `loadUIStrings`/`applyUIStrings` has a REAL bug reachable in a live browser too.

# WHERE TO START

Nothing pre-scoped is queued for the comic-panel subsystem. Real, unmeasured gaps remain if a future
session wants to push further (none block anything currently working):
- Real mobile/touch rendering — neither the drawing UI nor the panel-display cards have been checked
  on a real device.
- A comic chapter with many (10+) panels — layout/scroll behaviour at that scale is untested.
- Non-German target languages — the extraction prompt's case-restoration fix is German-only.
- The HARD `§2.7` fixture (Page A: rotated text, unframed panels, ambiguous order) has never been
  tried with ANY model or strategy, including the now-production auto-detect feature.
- Multi-page comic storylines — one page = one chapter, no continuation wiring.
- Tier 2 (per-word image coordinates) remains explicitly out of scope.
**Ask the user which (if any) to pursue** — none is an open ruling, all are new scope decisions.

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
- **The WHOLE `PLAN §2.4` comic-panel feature (`v85_j`-`v85_o`)** — verified end-to-end against REAL
  comic content through the actual production routes, multiple times, but on ONE real fixture, one
  language, one machine, never a real mobile device. See "WHERE TO START" above for specific gaps.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The five comic-panel entries (`v85_j`/`v85_k`-
`v85_l`/`v85_m`/`v85_n`/`v85_o`) are consecutive rows — read all five before touching any part of this
subsystem.
