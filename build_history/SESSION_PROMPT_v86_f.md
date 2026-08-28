# Session prompt — written at the `v86_f` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_f`**. This cut is a third
same-session follow-on in the `v86_d`/`v86_e`/`v86_f` real-device-testing round — the user said
"continue with the rotate item" right after `v86_e` shipped.

**What just shipped (`v86_f`)**:

**Item I — rotate the uploaded/captured comic image**, scoped at `v86_c`, built with option (a) from
that scoping (rotating invalidates any panel boxes already drawn, matching the existing "a new image
invalidates old boxes" precedent — not the coordinate-transform alternative). A fixed
90°-clockwise-per-click `#comic-rotate-btn`, using the SAME offscreen-canvas-redraw shape as the
existing downscale step (`onComicFileChosen`), routed through the SAME `img.onload ->
_comicFinishSetup()` path a fresh upload uses — so `APP_COMIC.naturalW`/`naturalH` are read straight
from the newly-loaded ROTATED image (no hand-computed dimension math to drift out of sync), and panel
invalidation comes for free from the existing `comicClearPanels()` call already inside
`_comicFinishSetup()` — no new invalidation logic needed at all.

Full diagnosis (the test-coverage strategy for a canvas-rotation function in a harness with no 2D
canvas context at all, the three mutation tests) is in `roadmap_v86.md`'s `v86_f` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, D, E, F, G, H still open; I, J, K all shipped
   now), then the `v86_d`/`v86_e`/`v86_f` shipped entries.
3. `INTERNALS.md` **§6b** — comic-panel rows are now SIX cuts overdue (C1 resize `v85_t`, resize-sync
   `v85_u`, listener fix + camera capture `v86_c`, visibility fix + partial-drop toast + item J
   `v86_d`, item K `v86_e`, item I `v86_f`) — this is genuinely overdue now; add them the first time
   you're in this subsystem, don't let a seventh cut pass without it.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 690 `en` keys** — one new key this cut
(`form.comic_rotate`, up from 689). `APP_VERSION = 'v86_f'`.

⚠️ **When this harness's DOM stub lacks a browser API entirely (here: `canvas.getContext('2d')`
always returns `undefined` — no 2D canvas context is stubbed at all), the function's own FALLBACK
branch for "no context available" becomes the one thing that IS directly, behaviourally testable** —
the "happy path" (a real working canvas) can only get a source-level check, but the fallback itself is
exactly what fires on every test run here, so testing it for real (does it throw? does it corrupt
state before bailing?) is not a consolation prize, it's real coverage of what this harness actually
exercises. Applied this cut to `comicRotateImage()`, following the same precedent `_comicRedraw()`'s
own test already set.

⚠️ **A refactor/new-feature that can reuse an EXISTING invalidation/cleanup path is almost always
better than writing a parallel one.** `comicRotateImage()` needed zero new "clear the boxes" logic —
routing through the same `img.onload -> _comicFinishSetup()` shape a fresh upload already uses gave it
for free, and also meant `APP_COMIC.naturalW`/`naturalH` get read from the actual rotated image rather
than computed via `_comicRotatedDims()` a second time at the call site (which would have created two
sources of truth for the same swap).

⚠️ **Two DIFFERENT tests have now flaked transiently across this line's own baseline runs**
(`unit-observations-log.test.js`, `unit-dreizunge-launcher.test.js`) — both confirmed to pass cleanly
standalone every time, both unrelated to anything touched. If either shows up red in a full-suite run,
re-run standalone before assuming a regression.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server. If `lessons.json` shows
modified, that is their own data — not yours to revert, commit, or "fix around" without asking. `git
checkout -- lessons.json` and `git add -A` were BOTH blocked by this environment's own permission
classifier earlier in this project's history; use `git show HEAD:lessons.json >
/tmp/somewhere.json` (read-only) and stage files explicitly by name. If a release needs
`docs/index.html` rebuilt while `lessons.json` is dirty, point `build-static.js` at that temp file
explicitly — if it's CLEAN, the plain default is fine.

⚠️ **This container HAS a live model backend** — `qwen2.5vl:7b` via Ollama, used for real in the `v85`
line. Check `ollama list`/`curl localhost:11434/api/tags` fresh each session before assuming a
"needs live verification" item is unreachable.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — check whether an EXISTING invalidation/setup path can be reused before
   writing a new one (new emphasis this cut).
2. **A fix that adds a NEW, REPEATING call path to a function needs that function checked for hidden
   "runs once" assumptions.**
3. **Guard at the layer where the claim is observable** — and when the harness has NO support at all
   for a browser API, its own fallback branch may be the one thing genuinely testable, not just a
   consolation prize (new emphasis this cut, from `comicRotateImage()`'s no-2D-context branch).
4. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it — including
   its SUBTLE behavioural differences, not just the obvious happy path.**
7. **A live model call needs a live test AND a real human reading the output** — but not every bug
   needs one.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
9. **A per-caller fix does not generalize to other callers of the same primitive** — but the SAME
   PATTERN often does, once the first instance is done and named clearly.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**

# WHERE TO START

**Items A, B, C, D, E, F, G, H from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are unchanged
and still open.** I, J, and K have ALL shipped now (`v86_d`, `v86_e`, `v86_f`) — the whole
real-device-testing round from this session is closed out.

A reasonable ordering, not a ruling:
- **Live-verify `v86_d`/`v86_e`/`v86_f` on a real device** — all three mechanically proven
  (mutation-tested), NONE actually watched on a real phone since landing. Given this subsystem's own
  recent track record (multiple consecutive cuts needing a live-testing correction — `v86_b`, `v86_c`,
  `v86_d`), this is worth doing before building anything further on top of it, not after. Probably the
  single highest-value next step.
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G, H** are each independently startable.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
