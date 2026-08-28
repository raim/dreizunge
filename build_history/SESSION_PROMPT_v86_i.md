# Session prompt — written at the `v86_i` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_i`**. The user began
live-verifying the whole `v86_d`–`v86_h` round on their device. Three things confirmed working (item
L, items I/M). **Two real problems were reported and investigated this cut, but NOT resolved** — both
genuinely need the user's own answers to specific diagnostic questions before a confident fix can be
attempted, per this line's own hard-earned rule about guessing at live-device bugs.

**What just shipped (`v86_i`)**:

A single, real, unrelated bug found and fixed WHILE investigating the two open problems (ruled out as
the cause of either, specifically): `showToast()`'s own null-guard checked the global translate
function `t` (always truthy — dead code) instead of `toastEl`, the element it had just looked up.
Harmless today (`#toast` is static markup, always present), but genuinely wrong — the ORIGINAL bug
would throw if that element were ever conditionally absent. Fixed, tested, mutation-tested.

**Two problems remain OPEN, recorded as items AE and AF in `roadmap_v86.md`** — read them in full
before touching either:

- **AE — the mobile-backgrounding fix (`v86_d`) did NOT recover on a real device.** Backgrounded mid-
  extraction, brought the tab back, still got "no extracted text yet" despite the console showing the
  server had genuinely finished. The service worker and job-expiry were both investigated and ruled
  out. Leading hypothesis: the mobile browser may have fully DISCARDED the tab's JS context and
  reloaded the page while backgrounded — a failure mode `v86_d`'s own `visibilitychange`-listener
  approach cannot help with at all, since it depends on in-memory state surviving. **Needs the user's
  own answer to two questions before building anything**: did the page look freshly reloaded when
  reopened? Roughly how long was it backgrounded? See `roadmap_v86.md`'s AE for the full reasoning and
  the localStorage-based redesign this would need if the hypothesis is confirmed.
- **AF — the auto-detect partial-drop toast (`v86_d`) apparently did not appear.** Code re-read in
  full; no bug found that would explain a missing toast for a genuine partial drop. Leading
  hypothesis: the user's own evidence ("no console message") may not be conclusive — `showToast()`
  has never logged to the console, only shown a ~2.2-second visual popup, so this may be a report
  based on the wrong evidence rather than proof the fix is broken. **Needs the user's own answer**:
  did they actually watch the SCREEN for those two seconds, or only check console? The separate
  panel-COUNT mismatch (3 shown, 4 detected) is item N's own already-recorded finding (likely a model-
  accuracy limitation) — the user's own new geometry observation (a box shifted past the image edge)
  is consistent with the existing clamp/filter logic working as designed, not a code bug.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   read **items AE and AF in full** (new "LIVE-TESTING ROUND" section, right before "✅ FINDINGS THAT
   GOVERN") before doing anything with either — do NOT attempt a fix for either without first getting
   the user's own answers to the diagnostic questions recorded there. Then the rest of "OPEN AT THE
   v86 CUT" (items A–G original, P/R–Z/AA–AD from the `v86_h` batch, all still open).
3. `INTERNALS.md` **§6b** is current through `v86_g` — keep it that way (add rows for `v86_h`/`v86_i`'s
   own small fixes if hunting for their functions cost real time later).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 287 checks
node test/run.js --quick                  → expect 248
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **Two DIFFERENT kinds of "expected" failure can show up in a full run right now, neither a
regression**: (1) `unit-static-freshness`, if `lessons.json` is dirty from the user's own live testing
(check `git status --short lessons.json` first — if clean, this won't appear). (2)
`unit-article-choices`, which reads the LIVE `lessons.json` directly (not an isolated fixture) — this
cut found it can fail purely from the user's own corpus growing during a session (confirmed via a
direct before/after comparison against the committed tree). If either shows up, verify against the
COMMITTED `lessons.json` (`git show HEAD:lessons.json`) before assuming a regression — the exact
technique used this cut.

Corpus at this cut: **335 topics, 97 storylines, 33 languages, 690 `en` keys** — `en` keys unchanged
from `v86_h`; topics/storylines moved TWICE just during this cut's own release ceremony (333→334→335,
95→96→97) as the user kept testing live. Re-measure if `unit-roadmap-version` disagrees — this number
is an inherently live snapshot (see `v86_g`'s own note), not something to trust blindly.
`APP_VERSION = 'v86_i'`.

⚠️ **A "the fix didn't work" report from a live device needs the SAME rigor as a bug report — don't
assume the fix is broken before checking whether the OBSERVATION method itself could be misleading.**
Item AF's own leading hypothesis is exactly this: the user checked console output for evidence of a
purely VISUAL, non-logged UI element. This doesn't mean the report is wrong — it means the NEXT step
is a clarifying question, not a code change, when the code itself shows no bug on a careful re-read.

⚠️ **A client-side fix that depends on in-memory JS state surviving in the browser has a real,
unstated assumption: the page's JS context must actually survive.** Mobile browsers can and do
discard a backgrounded tab's whole process under memory pressure, which no `visibilitychange` listener
can help with — that class of fix needs state to be recoverable from a FRESH page load (e.g.
`localStorage`), not just recoverable within a surviving one. Item AE is the live case; if confirmed,
this same class of gap likely also needs checking wherever ELSE this codebase assumed backgrounding
means "throttled" rather than "possibly discarded".

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server — confirmed actively
testing THIS session too. If `lessons.json` shows modified, that is their own data — not yours to
revert, commit, or "fix around" without asking. `git checkout -- lessons.json` and `git add -A` were
BOTH blocked by this environment's own permission classifier earlier in this project's history; use
`git show HEAD:lessons.json > /tmp/somewhere.json` (read-only) and stage files explicitly by name. If
a release needs `docs/index.html` rebuilt while `lessons.json` is dirty, point `build-static.js` at
that temp file explicitly — if it's CLEAN, the plain default is fine.

⚠️ **This container HAS a live model backend** — check `ollama list`/`curl localhost:11434/api/tags`
fresh each session. Items P and AB (from `v86_h`'s own batch) both still need a live-model check
before any code ships.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — and when a user reports "the fix didn't work", re-read the ACTUAL code
   in full before assuming the fix is broken; item AF found no bug on a careful re-read, which is
   itself real information, not a dead end.
2. **A fix that depends on in-memory state surviving needs an explicit check: can that state actually
   be destroyed by something outside the code's control (a mobile OS discarding a backgrounded tab)?**
   New this cut, from item AE's own leading hypothesis.
3. **Guard at the layer where the claim is observable** — and when a user's own evidence for "it
   didn't happen" might itself be looking at the wrong layer (console vs. screen), that's worth
   surfacing as a clarifying question, not silently assumed either way.
4. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them.
5. **A test that reads the LIVE corpus directly (not an isolated fixture) can fail from the user's own
   real-time usage alone** — confirmed this cut for `unit-article-choices`, joining
   `unit-roadmap-version`'s own corpus-count check as a second guard with this property. Always verify
   against the COMMITTED tree before assuming a regression.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output.**
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
9. **A per-caller fix does not generalize to other callers of the same primitive.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**
13. **A feature added to ONE `init()` needs an explicit decision about every OTHER `init()`-shaped
    entry point this codebase maintains separately (the static build's own).**

# WHERE TO START

**Items AE and AF are the priority** — but BOTH are blocked on the user's own answers to the
diagnostic questions recorded in `roadmap_v86.md`. Do not attempt either fix speculatively; ask first
if the answers aren't already in hand.

Once those are answered (or if the user has moved on to something else):
- **Original items A–G, plus the whole `v86_h` batch (P, R–AD)** are all still open — see
  `roadmap_v86.md`'s own "WHERE TO START"-shaped guidance in the `v86_h` session prompt (superseded by
  this file, but the item-by-item ordering advice there still holds) for a reasonable ordering.
- **Item AA (teacher/student dropdown)** remains a good, genuinely-close-to-easy pick if a
  self-contained win is wanted while AE/AF await answers.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g`.
