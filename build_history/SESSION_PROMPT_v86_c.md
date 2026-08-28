# Session prompt — written at the `v86_c` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_c`**. This cut is a direct
correction AGAIN: the user's next real-device test found `v85_u`'s own resize-sync fix had introduced
a genuine REGRESSION in comic panel drawing — worse than before that fix shipped. Read
`roadmap_v86.md`'s `v86_c` entry before assuming any "fixed" claim from `v85_u`/`v86_a`/`v86_b` still
holds without its own fresh check; this line has now had TWO consecutive corrections to earlier
sessions' own conclusions (`v86_b` corrected `v85_u`'s "confirmed built" claim; `v86_c` corrects
`v85_u`'s "fixed" claim about canvas resize-sync).

**What just shipped (`v86_c`)**:

1. **A genuine `v85_u` regression, found and fixed.** `_comicSetupCanvas()` re-registered all 8
   pointer/touch listeners on EVERY call, with no matching removal — latent and harmless before
   `v85_u` (that function ran exactly once per image), activated by `v85_u`'s own ResizeObserver
   (which fires more than once per image by design). A single real drag could fire the same pointer
   handler multiple times, corrupting an in-progress box — confirmed to match the user's EXACT
   reported symptom ("one box spans two panels", occurring twice). Fixed by wiring listeners exactly
   once, ever, for the canvas's whole lifetime (correct: the canvas element is static, never
   recreated). Mutation-tested against the EXACT predicted multiplier (24 = 3 calls × 8 events).
2. **Camera capture with automatic downscale** (the user's second, unrelated ask). A new
   `capture="environment"` file input opens the device camera directly on mobile; routes through the
   SAME upload handler as a regular file pick, which now downscales ANY chosen image to at most
   1600px on its long edge before use — directly related to `v85_u`'s own mobile-photo context-size
   fix (this addresses the SAME class of problem at the source instead of after the fact).

Full diagnosis (why the regression happened, why nothing caught it until real use, the exact
mutation-test numbers) is in `roadmap_v86.md`'s `v86_c` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, E, F, G, H — still open, unchanged this cut),
   then the `v86_b`/`v86_c` shipped entries.
3. `INTERNALS.md` **§6b** — comic-panel rows are now THREE cuts overdue (C1 resize `v85_t`, resize-sync
   `v85_u`, this cut's listener fix + camera capture) — add them the first time you're in that
   subsystem, don't let a fourth cut pass without it.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 687 `en` keys** — the ONE new key this
cut (`form.comic_camera`, up from 686). `APP_VERSION = 'v86_c'`.

⚠️ **When a fix introduces a NEW repeating call path to a function that was previously "called once
and done," CHECK whether that function has any hidden "only runs once" assumption baked into its own
body** — `v85_u`'s regression is exactly this: `_comicSetupCanvas()`'s listener-attachment code was
never WRONG in isolation, it just silently assumed (never stated, never tested) that it would only
ever run once. Adding a legitimate second call path (a ResizeObserver) broke that unstated assumption.
Before adding ANY new caller to an existing function, read the WHOLE function for state that
accumulates or side effects that aren't naturally idempotent (event registration is the classic case;
also watch for anything appending to an array, incrementing a counter, or creating a new object each
call where a singleton was implicitly assumed).

⚠️ **This harness stubs `addEventListener` as a total no-op** (real event dispatch isn't modelled at
all) — the only way to test registration COUNT is to temporarily replace it with a counting spy
(`unit-comic-panel-ui.test.js` §9 does exactly this). Keep this in mind for ANY future bug involving
duplicate event firing — it won't reproduce through a normal simulated-event test here.

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

1. **Measure before editing** — and when a PRIOR session's own "fixed"/"confirmed working" claim
   contradicts what the user is now reporting, re-measure from scratch. This line has now needed this
   TWICE in a row (`v86_b` on `v85_u`'s "confirmed built", `v86_c` on `v85_u`'s own resize-sync fix).
2. **A fix that adds a NEW, REPEATING call path to a function needs that function checked for hidden
   "runs once" assumptions** — event listener registration is the classic shape, but watch for any
   accumulating state or non-idempotent side effect.
3. **Guard at the layer where the claim is observable** — but when the harness stubs the relevant
   browser API as a no-op (here, `addEventListener`), a counting spy on that API is the honest
   fallback, not giving up on a behavioural test entirely.
4. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — but not every bug
   needs one; both `v86_b` and this cut's regression were pure client-side wiring defects.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
9. **A per-caller fix does not generalize to other callers of the same primitive.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

**Items A, B, C, E, F, G, H from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are unchanged and
still open** — none built this cut. Item D's own text was already corrected at `v86_b` (Tier 1 now
genuinely works; Tier 2, the item itself, is unchanged and still the real next ask).

A reasonable ordering, not a ruling:
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G, H** are each independently startable.

**Live-verify `v86_b`'s AND `v86_c`'s own fixes on a real device** — both mechanically proven
(mutation-tested), neither actually watched/drawn-on on a real phone/tablet since landing. Given this
line's own recent track record (two consecutive "confirmed working, actually wasn't" corrections),
this is worth doing BEFORE building anything further on top of the comic-panel subsystem, not after.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
