# Session prompt — written at the `v86_e` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_e`**. This cut is a direct,
same-session follow-on to `v86_d` — the user said "please continue with item K" right after `v86_d`
shipped, closing the one gap that cut's own diagnosis explicitly left open.

**What just shipped (`v86_e`)**:

**Item K — the same mobile-backgrounding fix `v86_d` gave `_startComicExtractJob`/
`_startComicDetectJob`, now extended to `_pollComicBookJob` (book/chapter creation).** This poller
wasn't `setInterval`-shaped like the other two — it was a single `while(true){ …; await
_sleep(2000); }` loop with a `try/finally` for cleanup, so the fix needed its own small refactor, not
a copy-paste: split into `_comicBookCheckOnce(bookId)` (one fetch-and-handle step, gated on the
PRE-EXISTING `_comicBookId` tracking variable) + `_comicBookFinish()` (the old `finally` block's
cleanup), with `_pollComicBookJob` now a thin loop calling the check function each iteration. The
shared `visibilitychange` listener now re-checks all THREE comic pollers. One deliberate behavioural
difference from extract/detect, preserved: a network hiccup mid-poll is NOT terminal for book
creation (unlike extract/detect, which DO treat a fetch failure as terminal) — matches the ORIGINAL
pre-refactor code exactly, verified with a dedicated retry test. Six new tests exercise the REAL
`_pollComicBookJob`/`_comicBookCheckOnce` for the first time — every existing test in
`unit-comic-chapter.test.js` had mocked `_pollComicBookJob` itself.

Full diagnosis (the exact shape difference that made this "not a copy-paste", the mutation-test
failures) is in `roadmap_v86.md`'s `v86_e` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, E, F, G, H, I — still open; J and K both
   shipped now), then the `v86_c`/`v86_d`/`v86_e` shipped entries.
3. `INTERNALS.md` **§6b** — comic-panel rows are now FIVE cuts overdue (C1 resize `v85_t`,
   resize-sync `v85_u`, listener fix + camera capture `v86_c`, visibility fix + partial-drop toast +
   item J `v86_d`, item K `v86_e`) — add them the first time you're in that subsystem, this is
   getting genuinely overdue.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 689 `en` keys** — unchanged from
`v86_d` (item K added tests to an EXISTING file, no new UI strings). `APP_VERSION = 'v86_e'`.

⚠️ **A `while(true){ …; await sleep(2000); }` poller has the SAME mobile-backgrounding vulnerability
as a `setInterval` one, but fixing it is NOT a copy-paste of the `setInterval` fix.** The pattern that
generalizes: split into (a) a re-invokable "check once" async function gated on a tracked job-id
variable, safe to call concurrently/repeatedly (idempotent — the id is nulled as the FIRST step of
handling a terminal result, so a second concurrent call becomes a no-op), and (b) a thin driver loop
(interval OR while+sleep, whichever shape it already had) that just calls the check function on
schedule. The `visibilitychange` listener then calls the SAME check function off-schedule. All THREE
comic pollers now share this shape — a fourth long-running client poll anywhere in this codebase
should be checked against it too.

⚠️ **A refactor that preserves behaviour needs the SUBTLE behavioural differences preserved too, not
just the happy path.** `_pollComicBookJob`'s network-failure handling (retry forever, no toast) was
deliberately DIFFERENT from `_startComicExtractJob`/`_startComicDetectJob`'s own (toast + terminal) —
easy to accidentally "fix" into consistency during a refactor without noticing it's a real, intentional
behavioural difference. Caught here by writing a dedicated test for it BEFORE assuming the refactor
was done.

⚠️ **A test file that only ever MOCKS the function you're about to refactor gives you zero coverage of
that refactor.** `unit-comic-chapter.test.js` had tested `comicCreateChapter()` thoroughly for
sessions, but every single test replaced `_pollComicBookJob` with a stub — so the refactor at this cut
had NO pre-existing safety net at all. Six new tests were added calling the real function before
trusting the refactor. Check this before refactoring any function: does anything actually exercise IT,
or only its callers with it mocked out?

⚠️ **A `setInterval`/while+sleep poller mocked with a NEVER-RESOLVING `fetch` in a test leaves a REAL
timer running forever** if not cleaned up — this harness's timers are the real Node event loop. Hit
this at `v86_d` writing the extract/detect visibility tests; not an issue for `_pollComicBookJob`'s own
tests since every test path here reaches a genuine terminal state (done/error/404) rather than staying
"in flight" forever.

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

1. **Measure before editing** — and when a live report LOOKS like a prior regression recurring, check
   whether the code path involved could even be the same one before assuming it is (this line's own
   `v86_d` did exactly this for its second bug: superficially similar symptom, genuinely unrelated
   cause).
2. **A fix that adds a NEW, REPEATING call path to a function needs that function checked for hidden
   "runs once" assumptions.**
3. **Guard at the layer where the claim is observable** — a counting spy or a source-level check is
   the honest fallback when the harness stubs the relevant browser API as a no-op.
4. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it — including
   its SUBTLE behavioural differences, not just the obvious happy path** (new emphasis this cut).
7. **A live model call needs a live test AND a real human reading the output** — but not every bug
   needs one.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
9. **A per-caller fix does not generalize to other callers of the same primitive** — but the SAME
   PATTERN often does, once the first instance is done and named clearly (this cut's own item K).
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out** — new this cut.

# WHERE TO START

**Items A, B, C, D, E, F, G, H, I from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are unchanged
and still open.** J and K both shipped (`v86_d`, `v86_e`).

A reasonable ordering, not a ruling:
- **Item I (rotate button)** is fully scoped from real-device testing and ready to build.
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G, H** are each independently startable.

**Live-verify `v86_d`'s AND `v86_e`'s own fixes on a real device** — both mechanically proven
(mutation-tested), neither actually watched on a real phone since landing. Given this subsystem's own
recent track record (three consecutive cuts now needing a live-testing correction — `v86_b`, `v86_c`,
`v86_d`), this is worth doing before building anything further on top of it, not after.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
