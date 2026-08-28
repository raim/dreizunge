# Session prompt — written at the `v86_k` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_k`**. Asked "what would you do
next?", this cut built item S (incremental lesson persistence during multi-lesson generation) plus a
quick live-verification of item F's article-symmetry fix alongside it, per the given recommendation.

**What just shipped (`v86_k`)**:

1. **Item S — persist each lesson AS IT FINISHES**, not batched until the whole chapter completes.
   Built in `_runRecreateJob` (the exact function behind the user's own real log example) via a new
   `persistLesson(lesson)` closure, wired into all four lesson-success sites. Then, checking whether
   the fix generalized, found `_runBookJob`'s own arc-reinforcement loop had the SAME gap and fixed it
   too — `_persistGenerated(...)` now runs after each successful arc lesson, not once at the end.
   Confirmed safe to call both repeatedly by reading `upsert()`'s own id-matching behaviour first.
2. **Item F's live-verification half — CONFIRMED.** `probe_article_symmetry_v80j.js` re-run against
   the live corpus: the two chapters it originally named are now BOTH 0% asymmetric. Overall rate
   1.3%, and the remaining "worst" chapters turned out to be correct per-language citation convention
   (spot-checked directly), not a defect. The "add explanations" half of item F is still open.

Full diagnosis (the exact mutation tests, the `upsert()` safety reasoning, the probe output) is in
`roadmap_v86.md`'s `v86_k` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the full "OPEN AT THE v86 CUT" section (S and F's live-verification half both shipped now; item F's
   "add explanations" ask, items A, B, C, D, E, G, item AD (source-language furigana, newly scoped),
   the whole `v86_h` batch minus Q/S, and AE (still open, needs the user to hit it again with
   diagnostic logging in place) — everything else is unchanged and still open).
3. `INTERNALS.md` **§6b** is current through `v86_g` — the small fixes since (`v86_h` through `v86_k`)
   are NOT yet documented there — four cuts of small-fix backlog now, worth a pass if a future session
   is in that area anyway.

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
user's own corpus growing mid-session. If either shows up, verify against `git show HEAD:lessons.json`
before assuming a regression.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 690 `en` keys** — an inherently live
snapshot (see `v86_g`'s own note); re-measure fresh if `unit-roadmap-version` disagrees, this file's
own number moved twice DURING the `v86_g`→`v86_j` stretch alone. `APP_VERSION = 'v86_k'`.

⚠️ **Before assuming a fix like item S needs its own new save primitive, check whether the EXISTING one
is already safe to call more often than it currently is.** `upsert()`/`_persistGenerated()` turned out
to already be fully idempotent-by-id — the fix was calling them MORE OFTEN in the right places, not
writing new persistence machinery. Read the primitive's own contract before assuming you need to
invent one.

⚠️ **"A per-caller fix does not generalize" cuts both ways — check the SIBLING callers of a fixed
primitive as a matter of course, not just when someone reports the sibling is ALSO broken.** Item S's
own `_runBookJob` half was found by proactively asking "does this same gap exist anywhere else?", not
from a second bug report. `_runRecreateJob` and `_runBookJob` are structurally similar (both multi-type
per-chapter generation loops) but use DIFFERENT persistence primitives (`saveStore` directly vs.
`_persistGenerated`) — read each site's own actual code before assuming the same patch applies
verbatim.

⚠️ **A corpus-wide static probe (no live model call) can settle a "did the fix actually work" question
directly, cheaply, and is worth reaching for before a live-model round-trip.**
`probe_article_symmetry_v80j.js` answered item F's live-verification ask in seconds, read-only, no
Ollama call needed — it was never actually a "needs a live model" question, just an unmeasured one.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server — confirmed actively
testing across several consecutive cuts this session already. If `lessons.json` shows modified, that
is their own data — not yours to revert, commit, or "fix around" without asking. `git checkout --
lessons.json` and `git add -A` were BOTH blocked by this environment's own permission classifier
earlier in this project's history; use `git show HEAD:lessons.json > /tmp/somewhere.json` (read-only)
and stage files explicitly by name. If a release needs `docs/index.html` rebuilt while `lessons.json`
is dirty, point `build-static.js` at that temp file explicitly — if it's CLEAN, the plain default is
fine.

⚠️ **This container HAS a live model backend** — check `ollama list`/`curl localhost:11434/api/tags`
fresh each session. Item P and item AB's own retrieval fix both still need a live-model check before
any code ships. Item AD (source-language furigana) will need one too once built.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — item F's own live-verification was settled by actually running the
   existing probe, not by assuming the fix worked or didn't.
2. **Before writing new persistence machinery, check whether the existing primitive already supports
   being called more often** — new emphasis this cut, from item S's own `upsert()`/`_persistGenerated`
   reasoning.
3. **Guard at the layer where the claim is observable** — a corpus-wide static probe answered a
   "needs live verification" question without any live model call at all; don't assume "needs a live
   model" when a cheaper, read-only measurement of the ACTUAL DATA would settle it just as well.
4. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them.
5. **A test that reads the LIVE corpus directly (not an isolated fixture) can fail from the user's own
   real-time usage alone.** Always verify against the COMMITTED tree before assuming a regression.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — but not every
   "verification" ask actually needs a live model; check first.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
9. **"A per-caller fix does not generalize" cuts both ways — proactively check SIBLING callers of a
   fixed primitive, don't wait for a second bug report to find them** — new emphasis this cut.
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss — and now ALSO a console log.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**
13. **A feature added to ONE `init()` needs an explicit decision about every OTHER `init()`-shaped
    entry point this codebase maintains separately.**

# WHERE TO START

**Item AE (mobile-backgrounding) is still open** — blocked on the user hitting it again with the
new `v86_j` diagnostic logging in place; do not attempt a fix without that console evidence in hand.

Otherwise, a reasonable ordering, not a ruling:
- **Item AA (teacher/student dropdown)** remains a good, genuinely-close-to-easy pick for a
  self-contained win.
- **Item AD (source-language furigana)** is now scoped (this session's own corpus-quality pass) — a
  real, moderately-sized feature (multiple generator prompts + client rendering), density should reuse
  the existing difficulty-tier mechanism per the user's own decision. Needs the toggle-sharing design
  question settled (one furigana setting for both directions, or two independent ones) before the
  client-side half.
- **Item R** (unfinished-project persistence) is worth revisiting now that item S's server-side half
  of the "don't lose generation work" story is done — R is the remaining CLIENT-facing half (surfacing
  partial progress to a reconnecting client, and a resumable "unfinished" project list).
- **Item P** and **item AB's own retrieval fix** both need a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g`.
