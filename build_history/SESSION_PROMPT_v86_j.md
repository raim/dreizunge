# Session prompt — written at the `v86_j` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_j`**. The user answered both
`v86_i` diagnostic questions directly. **AF is resolved** (very likely never a real bug — they never
watched the screen for the toast). **AE is still genuinely open**, but its own leading hypothesis was
REFUTED by their answer, and the whole visibility-recovery mechanism now has rich diagnostic console
logging — the next occurrence should be immediately diagnosable, not another round of guessing.

**What just shipped (`v86_j`)**:

1. **AF resolved**: *"i did not watch the screen. please add a console message as well."* Confirms
   the toast likely fired all along. `_comicApplyDetectedPanels` now logs to console on EVERY outcome
   — a clean pass, and any drop (partial or total) with the RAW (0-1000 model-space) coordinates of
   the DROPPED box(es) specifically, so the user's own geometry hypothesis ("the 4th panel looks
   shifted outside the image") can be confirmed directly from console on the next detection.
2. **AE's leading hypothesis (page discarded/reloaded while backgrounded) was REFUTED**: *"it looked
   almost exactly like i left it… when i reloaded it stayed the same."* `APP_COMIC` is never persisted
   until a chapter exists — a real discard-and-reload would have come back EMPTY, not "almost exactly
   as left". The JS context surviving means this is a real listener/logic gap, or the visibility event
   genuinely never fired — neither of which was visible from console before this cut.
3. **Diagnostic logging added throughout the WHOLE visibility-recovery mechanism**, not just the one
   function either report was about: `_comicExtractCheckOnce`, `_comicDetectCheckOnce`,
   `_comicBookCheckOnce` all log on every call (stale vs. current, the fetch outcome, the parsed
   status, panels applied); the shared `visibilitychange` listener logs UNCONDITIONALLY on every fire,
   even with nothing tracked, so its own aliveness can be confirmed independently of whether it had a
   job to act on.

**This cut is diagnostic, not a fix** — no behaviour changed anywhere, only visibility. AE's own root
cause is still unknown. Full diagnosis (why the "page discarded" hypothesis was refuted, exactly what
each new log line covers) is in `roadmap_v86.md`'s `v86_j` entry and its updated AE/AF write-ups.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   **item AE in full** (still open — the "LIVE-TESTING ROUND" section, right before "✅ FINDINGS THAT
   GOVERN") before touching the comic-panel subsystem again. AF is now marked ✅ resolved there, kept
   for the record. Then the rest of "OPEN AT THE v86 CUT" (original items A–G, the `v86_h` batch's P,
   R–AD, all still open).
3. `INTERNALS.md` **§6b** is current through `v86_g` — the `v86_h`/`v86_i`/`v86_j` small fixes
   (comprehension prompt, tutor logging, QC accept-relax, static tap-parity, showToast guard, comic
   diagnostic logging) are NOT yet documented there — three cuts of small-fix backlog now, worth a
   pass if a future session is in that area anyway (none individually big enough to be worth an
   interruption on their own).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 287 checks
node test/run.js --quick                  → expect 248
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **Two DIFFERENT kinds of "expected" failure can show up in a full run, neither a regression**: (1)
`unit-static-freshness`, if `lessons.json` is dirty (check `git status --short lessons.json` first).
(2) `unit-article-choices`, which reads the LIVE `lessons.json` directly — can fail purely from the
user's own corpus growing mid-session (confirmed twice now via a before/after comparison against the
committed tree). If either shows up, verify against `git show HEAD:lessons.json` before assuming a
regression.

Corpus at this cut: **335 topics, 97 storylines, 33 languages, 690 `en` keys** — moved AGAIN since
`v86_i` (334→335, 96→97) as the user kept testing live during this cut too. This number is an
inherently live snapshot (see `v86_g`'s own note) — re-measure fresh if `unit-roadmap-version`
disagrees, do not trust it blindly; it may well have moved again by the time you read this.
`APP_VERSION = 'v86_j'`.

⚠️ **When a live report seems to confirm a hypothesis, check whether it actually does before building
around it.** `v86_i`'s own "page discarded and reloaded" hypothesis for AE felt plausible and was
written up with real reasoning — but the user's own answer (state persisted across backgrounding)
directly refuted it. The fix here was not "build the fix for hypothesis #1 anyway" — it was
recognizing the hypothesis was wrong and choosing DIAGNOSTIC LOGGING over a second guess, since a
second wrong guess would cost another whole round-trip with the user testing live.

⚠️ **A user's own report can be evidence about the WRONG LAYER without being a false report.** AF's
"no console message" was true and unhelpful — the user genuinely saw nothing in console, but a toast
was never going to appear there. The lesson generalizes: when a report says "X didn't happen" and the
code shows no bug that would explain X not happening, consider whether X was ever observable through
the channel being checked, before assuming the code is wrong.

⚠️ **Diagnostic logging is a legitimate, shippable unit of work on its own, separate from a fix.**
This whole cut added ZERO behavioural changes and is still a real, valuable release: it converts a
future "the fix didn't work, IDK why" report into one with hard evidence attached. Don't feel obliged
to find/ship an actual behavioural fix before releasing when the honest next step is "make the next
occurrence diagnosable."

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server — confirmed actively
testing across `v86_h`, `v86_i`, AND `v86_j` in a row. If `lessons.json` shows modified, that is their
own data — not yours to revert, commit, or "fix around" without asking. `git checkout -- lessons.json`
and `git add -A` were BOTH blocked by this environment's own permission classifier earlier in this
project's history; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files
explicitly by name. If a release needs `docs/index.html` rebuilt while `lessons.json` is dirty, point
`build-static.js` at that temp file explicitly — if it's CLEAN, the plain default is fine.

⚠️ **This container HAS a live model backend** — check `ollama list`/`curl localhost:11434/api/tags`
fresh each session. Items P and AB (from `v86_h`'s own batch) both still need a live-model check
before any code ships.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — and when a user's ANSWER to a diagnostic question refutes your own
   leading hypothesis, actually update the hypothesis, don't quietly build around the original one
   anyway. `v86_j`'s own AE write-up does this explicitly.
2. **A fix that depends on in-memory state surviving needs an explicit check: can that state actually
   be destroyed by something outside the code's control?** Still true, but THIS cut's own evidence
   suggests it was NOT the actual cause for AE — don't discard this class of concern generally, just
   this specific instance of it.
3. **Guard at the layer where the claim is observable** — and when a user's own evidence for "it
   didn't happen" might be looking at the wrong layer (console vs. screen, confirmed this cut for
   AF), that's worth surfacing as a clarifying question BEFORE guessing at a fix, which is exactly
   what happened here and settled it in one round-trip.
4. **When you can't yet fix a bug with confidence, making the NEXT occurrence diagnosable is a real,
   valuable, shippable unit of work — not a consolation prize.** New emphasis this cut.
5. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them.
6. **A test that reads the LIVE corpus directly (not an isolated fixture) can fail from the user's own
   real-time usage alone** — confirmed AGAIN this cut (`unit-article-choices`). Always verify against
   the COMMITTED tree before assuming a regression.
7. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
8. **A live model call needs a live test AND a real human reading the output.**
9. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
10. **A per-caller fix does not generalize to other callers of the same primitive** — but here, the
    SAME diagnostic-logging pattern WAS deliberately applied to all three comic pollers proactively
    (not just the one either report was about), since they share the exact same class of gap.
11. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
12. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss** — and now ALSO a console log, per this cut's own AF fix.
13. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**
14. **A feature added to ONE `init()` needs an explicit decision about every OTHER `init()`-shaped
    entry point this codebase maintains separately.**

# WHERE TO START

**Item AE is still open and is the priority if the user reports the same mobile-backgrounding failure
again** — this time with real console evidence attached, thanks to this cut's own logging. Do not
guess at a fix without that evidence in hand; ask for the console output specifically if a fresh
report comes in without it.

Otherwise, the full backlog remains: original items A–G, plus the whole `v86_h` batch (P, R–AD). A
reasonable ordering, not a ruling:
- **Item AA (teacher/student dropdown)** remains a good, genuinely-close-to-easy pick for a
  self-contained win.
- **Items R and S** (unfinished-project persistence, incremental lesson saves) are worth designing
  TOGETHER.
- **Item P** and **item AB's own retrieval fix** both need a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G** are each independently startable (F gained new scope at `v86_h` — read its
  extended write-up).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g`.
