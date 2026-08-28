# Session prompt — written at the `v85_t` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v85_p`, `v85_q`, …) unless a future
session has a good reason to switch to `v86_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v85_t`**. This cut builds the
remaining two items the user asked for directly ("continue with items A and C") out of three recorded
roadmap-only at `v85_r`'s own follow-up commit. Item B (`v85_s`) was already shipped. **All three
items from that roadmap-only cut are now closed.**

**What just shipped (`v85_t`)**:

**A — app version tooltip removed from BOTH builds.** The one client-facing surface of
`APP.info.version` (`#app-tagline`'s hover tooltip, `index.html`) is gone, along with
`build-static.js`'s own duplicate of the same line — checked for a second caller before declaring
this done (there was one; rule 8's shape). `APP.info.version` itself is untouched, still populated,
just has no reader left. `unit-app-motto.test.js` (the `v49` guard that originally REQUIRED this
tooltip) now asserts its ABSENCE instead, in both builds, mutation-tested.

**C1 — panel RESIZE via corner handles — built.** 4 drag handles per box (`nw`/`ne`/`sw`/`se`),
hit-tested in canvas space, mutually exclusive with starting a new box draw by construction. Resize
happens directly in natural pixel space with a live-clamped minimum size (the same "8 canvas px"
floor a degenerate fresh draw was already rejected for), so a handle dragged past the opposite corner
can never invert the box. Three new cases in `unit-comic-panel-ui.test.js` §7, mutation-tested.
`form.comic_help` (`ui.json`) updated to mention it.

**C2 — auto-detect misalignment LIVE-PROBED, confirmed a model-accuracy limitation.** This container
has a live Ollama with `qwen2.5vl:7b` installed (checked directly, not assumed absent) — ran
`build_history/probe_comic_panels_v85_i.js` for real against a crop of the user's own screenshot. The
model came back structurally clean (correct count, correct order, well-formed tags) but the boxes are
systematically too NARROW — roughly 23% of the crop's width goes unclaimed on the right edge, worst on
the right column. **Not fixed** — trying an alternative prompt/strategy is real, open-ended work
(~5-6 min per iteration on this machine) that the project's own standing practice scopes with the
user first. Left open with a concrete, MEASURED starting point instead of the previous "inferred, not
measured" state.

Full diagnosis chains (exact numbers, the crop caveat stated honestly, file/line references) are in
`roadmap_v85.md`'s `v85_t` entry — read it before re-deriving any of this from scratch.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v85.md` — its **index table** and **⚠️ Session protocol** block first, then
   the `v85_t` shipped entry. The "REPORTED AT THE `v85_r` CUT" section above it is now ALL FIXED —
   its "found" write-ups are kept as diagnosis records, not open items.
3. `INTERNALS.md` **§6b** — unaffected by A/B; the comic-panel rows (`v85_j` through `v85_p`) need a
   NEW row added for C1 (panel resize) whenever someone next touches that subsystem's map — not done
   this cut, worth doing before the map goes stale.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 686 `en` keys** (UNCHANGED from
`v85_s` — this cut touched `index.html`/`build-static.js`/`ui.json`/tests only, one existing UI
string reworded, no new keys, no corpus edit). `APP_VERSION = 'v85_t'`.

⚠️ **The baseline may show 0, 1, or 2 known failures depending on the user's OWN corpus growth AFTER
this cut** — `unit: current roadmap names the current line` and `unit: docs/ built from current
sources` both fail ONLY when the WORKING-TREE `lessons.json` has grown past what's committed here.
**At this cut's own commit, both pass** — `lessons.json` was clean (`git status --short` empty)
throughout this whole cut, so the corpus numbers above and `docs/index.html`'s rebuild both reflect
the current committed truth exactly. Don't be alarmed if they're red again by the time you read this;
diagnose which file is stale before touching anything, and if the tree is clean yet the counts still
disagree, the fix is to UPDATE THIS FILE's numbers, the same way `v85_s` did for `v85_r`'s.

⚠️ **This container HAS a live model backend** — worth knowing before assuming a "needs live
verification" item is unreachable. `curl -s http://localhost:11434/api/tags` confirmed Ollama running
with `qwen2.5vl:7b` (the vision model this app's comic-detect feature actually uses) installed and
already used for real in this session (`v85_t`'s C2 probe, 374.5s for one call). **Check what's
actually available before writing off a live-model item as "owed by the user, not doable in a
container"** — that section below still lists several such items from EARLIER cuts, written before
anyone checked. Don't assume the SAME models this cut used (`qwen2.5vl:7b`) cover every OTHER role
this app has (lesson generation, chapter titles, QC) — check `ollama list`/`/api/tags` fresh each
time, since the user's own installed-model set can change between sessions.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server (found bound to port 3000
across `v85_k` through `v85_t`, never touched). If `lessons.json` shows modified, that is their own
data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in the
`v85` line; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. **If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty**,
point `build-static.js` at that temp file explicitly (`node build-static.js /tmp/somewhere.json`) —
if it is CLEAN, the plain default is fine and simpler (`v85_t` used the default throughout).

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
8. **A per-caller fix does not generalize to other callers of the same primitive** — `v85_t`'s item A
   is a clean instance: `build-static.js` carried its OWN copy of the tooltip line, and would have
   kept writing it after `index.html`'s copy was removed if it hadn't been checked for explicitly.
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
    silently revert LATER, unrelated uncommitted work** — verify the diff afterward regardless. `v85_t`
    did this three more times (motto, resize handle, each restored+diffed).
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
    into it, not avoiding regeneration altogether.
33. **An all-or-nothing validation throw on ONE ITEM inside a MULTI-ITEM generation result discards
    every OTHER item too.**
34. **A render path's own `setTimeout`-based side effect needs its pending timer cancelled at the top
    of the function, unconditionally — not only inside whichever branch scheduled it.**
35. **Before declaring a "needs a live model" item unreachable, actually CHECK what's installed** —
    `v85_t`'s C2 investigation nearly stayed "inferred, not measured" out of an unstated assumption
    that no live backend was available in this container; `curl localhost:11434/api/tags` cost one
    call and turned an inference into a real, cited measurement. Check first, don't assume a container
    is always offline just because earlier sessions' "OWED BY THE USER" lists say so — that list can
    go stale exactly like any other claim in this document.
36. **A "redacted equivalent" image (a crop of a screenshot, not the pristine original) is still a
    legitimate probe input — but the SUBSTITUTION must be stated as a caveat next to the result, not
    silently treated as identical to the real thing.** `v85_t`'s C2 crop retained the app's OWN
    overlay lines from a prior (bad) detection — reasoned explicitly about which direction that bias
    would push the result (if anything, easier for the model, not harder) rather than ignoring it.
37. **A hit-tested UI affordance (drag handles, click targets) needs an EXPLICIT precedence rule when
    it can overlap with an EXISTING interaction on the same surface** — `v85_t`'s resize handles are
    checked BEFORE falling through to "start a new box draw" in the same pointerdown handler, by
    construction, not via a separate mode flag a caller could forget to check.

# WHERE TO START

**Nothing is pre-scoped from the `v85_r` roadmap-only cut any more** — all three items (A, B, C) are
shipped. The one deliberately-NOT-attempted half of C (auto-detect prompt/strategy work) is real,
scoped, and measured, but needs a ruling from the user on how far to take it before anyone builds
against it (see `roadmap_v85.md`'s `v85_t` entry for the concrete numbers to start from).

**Chapter-title post-pass failures are still open** (from `v85_r`) — genuinely needs a live-model
reproduction, not more code reading. If the user hits this again in real usage, capture the actual
raw model response before touching `generateChapterMeta` again. Given this container DOES have
`qwen2.5vl:7b`, check `ollama list` for whatever model `OLLAMA_MODEL`/`OLLAMA_LESSON_MODEL` actually
resolve to before assuming this is unreachable too.

**Live-verify `v85_r`'s article-symmetry fix and skill-ID fix in real usage** when the user next
generates lessons for real — particularly anything routing through `vocabFromText` (comic panels, PDF
uploads, pasted story+translation), since that path's article-symmetry prompt has NEVER been
regenerated against a live model with the fix in place.

**Live-verify `v85_s`'s speech-race fix and `v85_t`'s resize handles** on a real device — both are
mechanically proven (mutation-tested), neither has been touched/heard by a human yet.

**`INTERNALS.md` §6b could use a new comic-panel row for C1 (panel resize)** — not done this cut,
worth doing before the map goes stale the way earlier untracked additions have.

Nothing else is pre-scoped. Other real, unmeasured gaps carried forward: mobile/touch rendering for
the comic drawing UI and panel-display cards (now including the NEW resize handles — untested on
touch, though built with touch events wired the same way drawing already was); non-German target
languages for the case-restoration fix (German-only); Tier 2 (per-word image coordinates) still
explicitly out of scope.

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
- **`v85_r`'s article-symmetry fix** — needs live-model regeneration + a probe re-run (this ONE could
  actually be attempted in-container now that `v85_t` confirmed a live backend exists — check whether
  the TEXT model roles, not just vision, are also installed before assuming this still needs the user).
- **Chapter-title post-pass failures** — needs a live reproduction with the raw model output captured.
- **`v85_s`'s speech-race fix / `v85_t`'s resize handles** — mechanically sound, not yet touched/heard
  on a real device.
- **`v85_t`'s C2 auto-detect prompt/strategy work** — deliberately NOT attempted; needs the user's own
  scoping ruling first (how much iteration time is worth spending, which strategy to try first).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. The comic-panel entries (`v85_j` through
`v85_p`) are consecutive rows — read them before touching any part of that subsystem, and consider
adding `v85_t`'s resize addition as its own row while you're in there.
