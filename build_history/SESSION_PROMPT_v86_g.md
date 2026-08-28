# Session prompt — written at the `v86_g` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_g`**. Fourth same-session cut in
the `v86_d`…`v86_g` real-device-testing round — the user reported three things at once after `v86_f`
shipped: a stale-text bug, a recurrence of a panel-count mismatch, and a move-panel feature request.

**What just shipped (`v86_g`)**:

1. **Item L — progress card / question panel showed STALE text for a comic/image chapter after a
   story edit.** Root-caused against the user's real reported topic (`sl_1597155858`) by reading its
   actual stored data (read-only, `lessons.json` untouched): `story` held the corrected text, but
   `comicPanels[0].caption`/`inScene` still held the ORIGINAL pre-edit text — a completely separate
   copy `/api/save-story` never touched. Fixed for the unambiguous SINGLE-panel case (syncs
   `comicPanels[0]` on save); multi-panel deliberately left alone (item O — genuinely ambiguous which
   edited sentence belongs to which panel, not guessed at).
2. **Item M — drag-to-move a comic panel box**, the companion to the existing resize handles. A
   pointer-down inside a box's body (not a handle) now translates it instead of drawing a new
   overlapping box; a handle grab still wins at a box's own corner.
3. **Item N — investigated, NOT a code fix**: a "3 shown, 4 detected" report was re-investigated by
   re-reading `_comicApplyDetectedPanels` in full — confirmed it has ZERO merging logic, so the most
   likely explanation is a genuine MODEL accuracy limitation for this specific borderless comic layout
   (consistent with `roadmap_v85.md`'s own `v85_u` finding), not a fresh bug. Not pursued further this
   cut — flagged for a live-model probe if the user wants it pursued.

Full diagnosis (the exact stored-data evidence for item L, the mutation tests for both fixes) is in
`roadmap_v86.md`'s `v86_g` entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, D, E, F, G, H, N, O still open; I, J, K, L, M
   all shipped now), then the `v86_e`/`v86_f`/`v86_g` shipped entries.
3. `INTERNALS.md` **§6b** — comic-panel rows are now SEVEN cuts overdue. This is genuinely overdue;
   add them the first time you're in this subsystem.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 285 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **At the `v86_g` cut itself, `lessons.json` was DIRTY (the user actively testing) at release time.**
`docs/index.html` was rebuilt from the last COMMITTED `lessons.json` (`git show HEAD:lessons.json`),
never the dirty working copy — per the standing rule, a generated artifact may be freely rebuilt from
safe committed sources, but the user's uncommitted live data must never be baked into it. This means
`unit-static-freshness` (added `v73_b`) will show ONE EXPECTED failure — `docs/index.html` fingerprints
`lessons.json` against whatever is CURRENTLY on disk, which disagrees with the committed version it was
actually built from — for as long as `lessons.json` stays dirty. This is NOT a regression and not
something to "fix" by baking the dirty file; `git status --short lessons.json` at the start of THIS
session should tell you whether it's still the case. If `lessons.json` is clean, this failure won't
appear at all and the baseline really is 0 failures.

Corpus at this cut: **334 topics, 96 storylines, 33 languages, 690 `en` keys** — `en` keys unchanged
from `v86_f` (no new UI strings this cut); topics/storylines are a live SNAPSHOT, up from 333/95 —
the user was actively using the app (their own real corpus) while this cut was being built. This
number WILL drift again the moment they answer another question; that is expected, not a bug (per the
standing rule that `lessons.json` changes on every answered question and is never worth pinning
tightly — measure fresh rather than trusting this line if `unit-roadmap-version` disagrees).
`APP_VERSION = 'v86_g'`.

⚠️ **A chapter can have TWO independent copies of its "story" text**: `story` (the canonical field
every other surface reads) and, for a comic/image-derived chapter, `comicPanels[i].caption`/
`inScene` (a per-panel copy, extracted once at upload time). A route or function that edits `story`
must ask whether it ALSO needs to touch `comicPanels` — `/api/save-story` didn't, for every cut since
the comic feature shipped, until this one. Search for other writers of `story` (lesson generation,
QC-accept, dialect edits) and check each one against this same question — item L only fixed the ONE
call site (`/api/save-story`) the user's actual report reached; the class of bug may not be fully
closed.

⚠️ **"Same symptom as before" is not proof of "same bug as before."** Item N's panel-count report
LOOKED like it could be the `v86_c` listener regression recurring — it wasn't (auto-detect fills boxes
programmatically, never touching the pointer/drag listeners that bug was about). Re-read the actual
code path a NEW report goes through before assuming a fix didn't work; a superficially identical
symptom can have a completely different, unrelated cause.

⚠️ **Reading a user's LIVE data file to diagnose a bug is fine (and was essential here); writing to
it is not.** Item L's diagnosis required reading the actual stored `story`/`comicPanels`/`aiStory`
values for a real topic in `lessons.json` — this is how the root cause was found with certainty rather
than guessed at. The standing rule is about MUTATION (staging, committing, reverting), not about
reading for diagnosis — read freely when it settles an otherwise-uncertain question.

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
"needs live verification" item is unreachable. Item N (panel-detection accuracy) is a genuine
candidate for a live-model probe if the user wants it pursued.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules)

1. **Measure before editing** — when the evidence is genuinely uncertain (item N), report the
   diagnosis and recommend rather than guess at a fix with no strong evidence behind it.
2. **A shared field can have a SEPARATE, stale copy elsewhere that nothing keeps in sync** — new
   emphasis this cut (item L). When adding a NEW derived-data field (a per-panel copy, a cached
   summary, an extracted snippet), ask what happens to it when the SOURCE it was derived from changes.
3. **Guard at the layer where the claim is observable** — read the ACTUAL stored data for a reported
   real case when a client-side theory alone can't settle the question (item L was root-caused this
   way, not by reasoning about the code in isolation).
4. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
5. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output** — item N is exactly
   this kind of open question, not yet acted on.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json` for
   diagnosis is always fine; writing to it is the restricted action.
9. **A per-caller fix does not generalize to other callers of the same primitive** — item L only fixed
   `/api/save-story`; other writers of `story` were not audited this cut (see the warning above).
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**
11. **A silent `.filter()`/discard in any path whose OUTPUT the user can observe needs a toast on
    partial loss, not just total loss.**
12. **Before refactoring any function, check whether anything actually exercises IT — or only its
    callers with it mocked out.**

# WHERE TO START

**Items A, B, C, D, E, F, G, H, N, O from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are still
open.** I, J, K, L, and M have ALL shipped now (`v86_d` through `v86_g`).

A reasonable ordering, not a ruling:
- **Live-verify the WHOLE `v86_d`…`v86_g` round on a real device** — every fix mechanically proven
  (mutation-tested), NONE actually watched on a real phone/tablet since landing. This subsystem has
  now had FIVE consecutive cuts driven by real-device reports; a live-verification pass before adding
  anything further is probably the single highest-value next step.
- **Item N (panel-detection accuracy)** needs the user's own decision on whether to invest in a
  live-model probe/prompt-tuning pass, or accept it as a known limitation.
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, F, G, H** are each independently startable.
- **Item O (multi-panel story-edit sync)** needs a design decision (per-panel edit UI vs. a risky
  sentence-alignment heuristic) before any code — not a "just build it" item.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
