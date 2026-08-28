# Session prompt — written at the `v86_d` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_d`**. This cut fixes TWO live bugs
the user found back-to-back in the same real-device testing session — both in the comic-panel
subsystem, neither the `v86_c` listener regression recurring (confirmed by reading, not assumed) —
plus item J, scoped at `v86_c`.

**What just shipped (`v86_d`)**:

1. **Mobile-backgrounding fix for both comic pollers.** Live report: "on my phone, i started an
   extraction from a photo, console said: … `[comic-extract] done: 1 panel(s), 0 failed` … yet the
   generator interface seems to have lost that." The server-side job had genuinely finished — mobile
   browsers throttle/suspend `setInterval` on a backgrounded tab, so the client's normal 2000ms poll
   never got a chance to see it. Fixed with a shared `visibilitychange` listener that re-checks any
   in-flight comic-extract/comic-detect job the instant the tab becomes visible again, off-schedule.
   **`_pollComicBookJob` (book/chapter creation) has the SAME vulnerability and is explicitly NOT yet
   fixed** — its `while`+`sleep` shape needs its own small adaptation; carried as item K.
2. **Auto-detect silently dropping panels, now surfaced.** Second live report, same session: "the
   console actually said 4 panels where detected: … `[comic-detect] done: 4 panel(s) suggested`" while
   the UI showed only 3. NOT the `v86_c` listener regression (auto-detect never touches the pointer/
   drag listeners that bug was about) — `_comicApplyDetectedPanels` was already correctly dropping a
   malformed/inverted box (shipped `v85_o`), but did so completely SILENTLY unless every suggested box
   was dropped. Now toasts on any drop, partial or total, naming the kept/suggested counts.
3. **Item J — a "use whole image as one panel" shortcut** (scoped at `v86_c`, built this cut). A new
   button sets the whole image as a single panel box, replacing any existing boxes — same "fresh
   detection replaces, doesn't merge" precedent auto-detect already established.

Full diagnosis (root causes, the exact mutation-test failures, why neither bug was the `v86_c`
regression recurring) is in `roadmap_v86.md`'s `v86_d` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, E, F, G, H, K — still open; K is new this
   cut), then the `v86_b`/`v86_c`/`v86_d` shipped entries.
3. `INTERNALS.md` **§6b** — comic-panel rows are now FOUR cuts overdue (C1 resize `v85_t`, resize-sync
   `v85_u`, listener fix + camera capture `v86_c`, this cut's visibility fix + partial-drop toast +
   item J) — add them the first time you're in that subsystem, don't let a fifth cut pass without it.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 689 `en` keys** — TWO new keys this cut
(`form.comic_single_panel`, `form.comic_detect_partial`, up from 687). `APP_VERSION = 'v86_d'`.

⚠️ **A poller built on `setInterval` (or any timer) can be silently starved on a backgrounded mobile
tab** — confirmed live this cut, the root cause of item 1 above. If you build or touch ANY client-side
job-polling code, ask whether it needs the same `visibilitychange`-triggered off-schedule re-check
this cut added to `_startComicExtractJob`/`_startComicDetectJob`. `_pollComicBookJob` still doesn't
have it (item K) — don't let a THIRD poller ship without this checked either way.

⚠️ **A filter that silently drops bad data is a UX bug even when the filtering itself is correct.**
`_comicApplyDetectedPanels`'s malformed-box filter (shipped `v85_o`) was never wrong — but dropping
without telling the user left them staring at "fewer panels than the model reported" with zero signal.
Before shipping any silent `.filter()`/discard in a path the user can observe the OUTPUT of, ask
whether a partial loss needs its own toast, not just a total one.

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

⚠️ **A `setInterval` mocked with a NEVER-RESOLVING `fetch` in a test leaves a REAL timer running
forever** if you don't clean it up — this harness's timers are the real Node event loop, not a fake
clock. Hit this writing this cut's own visibility-recovery tests (a hung `node test/*.test.js`
process). Fix: either resolve the mock, or manually null out the tracked job-id variable so the
poller's own guard clears itself on its next tick.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — and when a PRIOR session's own "fixed"/"confirmed working" claim
   contradicts what the user is now reporting, re-measure from scratch, INCLUDING checking whether the
   new report is actually the SAME root cause as a prior fix or a genuinely different one (this cut's
   two live bugs looked superficially similar — "fewer panels than expected" — but were unrelated).
2. **A fix that adds a NEW, REPEATING call path to a function needs that function checked for hidden
   "runs once" assumptions** — event listener registration is the classic shape, but watch for any
   accumulating state or non-idempotent side effect.
3. **Guard at the layer where the claim is observable** — but when the harness stubs the relevant
   browser API as a no-op (here, `addEventListener`, `visibilitychange`/`visibilityState`), a counting
   spy or a source-level check is the honest fallback, not giving up on a behavioural test entirely.
4. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — but not every bug
   needs one; this cut's two fixes were both pure client-side wiring/UX defects.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
9. **A per-caller fix does not generalize to other callers of the same primitive** — this cut's own
   `_pollComicBookJob` gap (item K) is exactly this: the SAME class of bug, a DIFFERENT poller, not yet
   fixed, named explicitly rather than silently left.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss** — new this cut.

# WHERE TO START

**Items A, B, C, E, F, G, H from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are unchanged and
still open** — none built this cut. Item I (rotate image) is still scoped-not-built. **Item K is new
this cut** (`_pollComicBookJob` needs the same mobile-backgrounding fix `v86_d` gave the other two
pollers).

A reasonable ordering, not a ruling:
- **Item K** is a direct, well-understood extension of what THIS cut just built — probably the
  cheapest next win, and closes a known live-bug class before it's independently reported.
- **Item I (rotate button)** is fully scoped from real-device testing and ready to build.
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G, H** are each independently startable.

**Live-verify this cut's two fixes on a real device** — both mechanically proven (mutation-tested),
neither actually watched on a real phone since landing. Given this subsystem's own recent track record
(three consecutive cuts now needing a live-testing correction), this is worth doing before building
anything further on top of it, not after.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
