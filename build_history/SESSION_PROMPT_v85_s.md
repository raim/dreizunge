# Session prompt — written at the `v85_s` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_s`**. This cut builds ONE item
the user asked for directly ("do B") out of three recorded roadmap-only at `v85_r`'s own follow-up
commit — the progress-card word-tap speech race. Items A (app-version tooltip) and C (comic
auto-detect misalignment + panel resize) are still open, see `roadmap_v85.md`'s "REPORTED AT THE
`v85_r` CUT" section.

**What just shipped (`v85_s`)**:

**Progress-card word-tap sometimes speaks the WRONG question — FIXED.** Root cause: `tapWord()`
(`index.html`) calls `showLesson()`, whose `startLesson()` unconditionally renders exercise 0 first;
then, once the built run exists, `tapWord()` itself corrects onto the word's REAL question with a
SECOND, synchronous `renderEx()` call. Each `renderEx()` call for a `listen_mcq`/`listen_type`
exercise queues its own 350ms auto-speak `setTimeout` — and nothing cancelled the FIRST one before
the second was scheduled, so two timers raced to `speak()` on the same shared TTS output; whichever
the engine did not fully preempt (usually the first, since it fires first) is what the learner heard.
**Fixed** with a single module-level `_speakTimeout` id, `clearTimeout`'d unconditionally at the very
top of `renderEx()` — not only inside the listen-type branch, so a listen→non-listen double-render is
covered too, not just listen→listen. New test `unit-word-tap-speech-race.test.js` drives `renderEx()`
directly (the race lives entirely in its own timeout bookkeeping) with three cases: the exact
double-render shape, a single-render non-vacuity check, and the listen→non-listen generalisation.
**Mutation-tested**: reverted the fix, confirmed the new test fails reproducing the EXACT symptom
(both utterances fire, "FALSCH" then "RICHTIG"), restored, confirmed green.

Full diagnosis chain (file/line references) is in `roadmap_v85.md`'s `v85_r` follow-up commit
("REPORTED AT THE `v85_r` CUT" §B) — this cut just builds what that entry already scoped.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"REPORTED AT THE `v85_r` CUT"** section (items A and C are STILL OPEN there) and the `v85_s`
   shipped entry.
3. `INTERNALS.md` **§6b** — unaffected by this cut; the six comic-panel rows (`v85_j` through `v85_p`)
   still stand for that subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 686 `en` keys** (UNCHANGED — this cut
added one test, no new strings, no corpus edit). `APP_VERSION = 'v85_s'`.

⚠️ **The baseline may show 0, 1, or 2 known failures depending on the user's OWN corpus growth since
this cut** — `unit: current roadmap names the current line` and `unit: docs/ built from current
sources` both fail ONLY when the WORKING-TREE `lessons.json` has grown past what's committed (the
user's own live testing on their separate dev server — see the warning right below). **At the exact
moment this cut was committed, both of those passed** (`lessons.json` happened to match `HEAD`
exactly) — a genuine change from `v85_q`/`v85_r`, where the user's live growth had already outpaced
the commit. Don't be alarmed if they're red again by the time you read this; that is the user living
their life, not a regression. Both are DATA-DRIFT failures, never a code bug — diagnose which file
(`lessons.json` topic/storyline counts vs. this file's stated numbers) before touching anything.

⚠️ **A separate, real thing observed THIS cut, worth naming explicitly:** `docs/index.html` showed as
modified on disk PARTWAY THROUGH the session, built from a `lessons.json` state that matched NEITHER
`HEAD` nor the current working tree — almost certainly the user running `node build-static.js`
themselves against their own live corpus at some point, independent of anything this session did
(confirmed: no test in the suite executes `build-static.js` against the real `docs/` directory —
checked directly, the only tests that DO execute it use temp output dirs). **Treated the same as
`lessons.json` while investigating** (left untouched, not staged) — but UNLIKE `lessons.json`, once
this cut needed a genuine `docs/index.html` rebuild anyway (a real `index.html` code change), it was
safe to just rebuild it fresh from the COMMITTED `lessons.json` and overwrite whatever was there:
`docs/index.html` is a GENERATED artifact with nothing hand-authored in it, unlike `lessons.json`
itself. The distinction that matters: never read or bake the user's UNCOMMITTED personal data into a
build; freely regenerate a build ARTIFACT from safe, committed sources whenever code changes require it.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_s`, never touched). If `lessons.json` shows modified, that is their own
data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in the
`v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. **If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty**,
point `build-static.js` at that temp file explicitly (`node build-static.js /tmp/somewhere.json`) —
`v85_q` through `v85_s` all did this, never reading the working-tree file for the build.

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
6. **A live model call needs a live test AND a real human reading the output.**
7. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape.**
8. **A per-caller fix does not generalize to other callers of the same primitive.**
9. **A "safe-looking" optimization that reads fresh state can still defeat an existing guarantee.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **When restructuring markup into new wrapper elements, verify div-balance with a real HTML parser.**
12. **When a plan document's own claim about "reuses existing machinery X" doesn't survive reading X's
    actual code, STOP and ask.**
13. **A new UI affordance that makes an EXISTING code path more reachable can surface a pre-existing
    bug in that path.**
14. **This harness's `document.getElementById`/`.querySelector` NEVER return null on a miss.**
15. **`vm.runInContext` (`C.run()`) rejects a bare top-level `await`.**
16. **Two code paths that both produce "the same observable zero-calls result" can still differ in
    WHY.**
17. **`server.js` changes need a FRESH PROCESS to verify live.**
18. **Restoring a working file from a LOCAL BACKUP taken for an earlier, unrelated mutation test can
    silently revert LATER, unrelated uncommitted work** — verify the diff afterward regardless. `v85_s`
    did this once more (the renderEx mutation test), correctly, diffing after the restore.
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
    findings in one message — separate them, triage which are in-scope-now vs. deferred.**
31. **A crash reproduced only inside a DOM-stub test harness needs the "would this survive in a real
    browser" question answered before it is treated as an app bug.**
32. **A generated build artifact (`docs/index.html`) can be freely rebuilt from safe, COMMITTED
    sources whenever code changes require it, even if the file already shows as modified from
    something else entirely** — the distinction is never reading/baking UNCOMMITTED personal data
    (`lessons.json`) into it, not avoiding regeneration altogether. `v85_s` drew this line explicitly
    after `v85_q`/`v85_r` had been more cautious than necessary about it.
33. **An all-or-nothing validation throw on ONE ITEM inside a MULTI-ITEM generation result discards
    every OTHER item too** — check whether a SIBLING failure shape is wrongly routed to a harder
    failure path than one the module already handles gracefully.
34. **Two `renderEx()`-shaped calls back-to-back (or any render path with a `setTimeout`-based side
    effect) need their OWN pending timers cancelled at the top of the function, unconditionally** —
    not only inside whichever branch scheduled the timer, so a render of a DIFFERENT shape (listen →
    non-listen) still supersedes a stale one. `v85_s`'s `_speakTimeout` fix is the first instance of
    this; grep for other bare `setTimeout(...)` calls inside render paths before assuming this is the
    only one.

# WHERE TO START

**Two items from `v85_r`'s "REPORTED AT THE `v85_r` CUT" roadmap section are still open** — the user
has NOT yet asked for either:
- **A. Remove the app-version hover tooltip** — a one-line deletion at `index.html:6843` (line number
  as of `v85_r`; re-grep for `_v.title=APP.info.version` if this cut's edits moved it). Small, no
  design questions.
- **C. Comic panel auto-detection misses real panel boundaries on hand-drawn pages; no panel resize**
  — two related but separable asks. The misalignment is most likely the already-flagged "never
  measured on the HARD `§2.7` fixture" model-accuracy gap, not a coordinate-math bug (checked). The
  resize affordance is a confirmed, real, standalone feature gap (draw/delete/reorder exist; resize
  does not). See the roadmap entry for the exact investigation already done before starting either.

**Chapter-title post-pass failures are still open** (from `v85_r`) — genuinely needs a live-model
reproduction, not more code reading. If the user hits this again in real usage, capture the actual
raw model response before touching `generateChapterMeta` again.

**Live-verify `v85_r`'s article-symmetry fix and skill-ID fix in real usage** when the user next
generates lessons for real — particularly anything routing through `vocabFromText` (comic panels, PDF
uploads, pasted story+translation), since that path's article-symmetry prompt has NEVER been
regenerated against a live model with the fix in place.

**Live-verify `v85_s`'s own fix** — the mutation test proves the RACE is gone mechanically, but
nobody has confirmed on a real device that the CORRECT question's audio now plays cleanly (timing,
audio glitches, etc. are not this harness's domain).

Nothing else is pre-scoped. Other real, unmeasured gaps carried from `v85_q`/`v85_r`: mobile/touch
rendering for the comic drawing UI and panel-display cards; non-German target languages for the
case-restoration fix (German-only); the HARD `§2.7` fixture (Page A) never tried with any
model/strategy; Tier 2 (per-word image coordinates) still explicitly out of scope.

**Explicitly out of scope, confirmed with the user across the whole `v85` line — do not reopen without
asking**: the CP1-6 pipeline's cross-chapter arc-sequencing; spell-check-driven auto error-hunt
generation. The browser-reachable single-chapter CP1-4 pipeline (deferred by `PLAN §13`) remains a
separate, not-yet-scoped follow-up. A separate, NOT-yet-reported gap noticed in passing at `v85_r`:
`vocabTable.system` (the markdown-table format for non-JSON models) has no BASE FORM ONLY instruction
at all — not a contradiction, just an absence — left alone.

## ⚠️ OWED BY THE USER, not doable in a container

- **The whole `v84_g`…`v84_m` speech-recognition arc** — still not live-verified on a real device.
- **Windows Tier 1 install docs (`v84_n`)** — reasoned, not measured.
- **`apply-cp-lessons.js`'s `v83_p` re-verification** — blocked by machine resource contention.
- **The PASS MARK** — needs a browser pass, not code.
- **The whole `v85_c`…`v85_i` wizard shell / attribution wiring** — not checked on a real mobile
  device/viewport.
- **`v85_r`'s article-symmetry fix** — needs live-model regeneration + a probe re-run.
- **Chapter-title post-pass failures** — needs a live reproduction with the raw model output captured.
- **`v85_s`'s own fix** — mechanically sound (mutation-tested), but not yet heard on a real device.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The six comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read all six before touching any part of that subsystem.
