# Session prompt — written at the `v86_b` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_c`, `v86_d`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_b`**. This cut is a direct
correction: the user reported, immediately after `v86_a`, "i still don't see the comic panels in the
progress cards" — contradicting `v85_u`'s own "confirmed already built" conclusion. That conclusion
was wrong. Read `roadmap_v86.md`'s `v86_b` entry before assuming ANYTHING this line's earlier
sessions concluded is still accurate — it corrects the record rather than silently overwriting it.

**What just shipped (`v86_b`)**: comic panels ACTUALLY now render on the progress card and question
panel. Root cause: both real callers of the shared story renderer (`_renderCompStory`,
`_exStoryPanelHtml`) unconditionally passed an explicit `text:` override to `_storyBodyHtml` — which
defeats its comic-panel branch based on WHETHER an override was passed, not whether it happens to
equal the default. On the plain story side the override was `d.story` either way — functionally a
no-op for VALUE, yet still defeated the branch by existing. This is why nothing caught it: the
rendered TEXT never differed; only the PANEL IMAGE did, and nothing had checked for that specifically
against a real comic-derived topic through the real UI functions (as opposed to `_storyBodyHtml`
directly, which `unit-comic-story-panel.test.js` already tested correctly — just never through its
real callers). Fixed at both call sites; three new tests exercise the real functions end to end.
Found and fixed two more real, pre-existing issues while verifying (a source-text-pinning test, and a
smoke-test fixture that turned out to already be a real comic topic from the grown corpus) — see the
roadmap entry for both.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the **"OPEN AT THE v86 CUT"** section (items A, B, C, E, F, G, H — still open; item D's own text was
   corrected this cut, see below), then the `v86_b` shipped entry.
3. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. **Comic-panel rows are overdue** (item H) — add them the first time you're in that
   subsystem for real.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 284 checks
node test/run.js --quick                  → expect 246
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **333 topics, 95 storylines, 33 languages, 686 `en` keys** (unchanged — this cut
touched no `lessons.json`, no `ui.json`). `APP_VERSION = 'v86_b'`.

⚠️ **Two DIFFERENT tests flaked transiently while establishing this cut's own baseline**
(`unit-observations-log.test.js`, `unit-dreizunge-launcher.test.js`) — both confirmed to pass cleanly
standalone, both unrelated to anything this cut touched. If either shows up red in a full-suite run,
re-run it standalone before assuming a regression; this project's test suite has a real, if
infrequent, flake rate under back-to-back full-suite runs (possibly worsened by a live server or
model call running concurrently — check what else is running on the machine).

⚠️ **A guard that pins the EXACT SHAPE of a function call (a literal source-text regex) will break on
any legitimate change to that call, even a correct one** — `unit-learner-nav.test.js` had to be
loosened this cut for exactly this reason (rule 5/34). When a call's ARGUMENTS are what a fix
legitimately needs to change, pin the DURABLE claim (e.g. "some call reaches this renderer, gated on
this condition"), not the literal argument list.

⚠️ **A test fixture picked from the REAL, LIVE corpus can silently become a DIFFERENT kind of fixture
as the corpus grows** — `smoke-render.test.js`'s own topic picker landed on a real comic-derived
topic once the corpus grew enough to have several; a test block that overrode `.story` without
clearing `.comicPanels` broke only once this cut's OWN fix made the comic-panel branch reachable.
Rule 29's shape, found from an unexpected direction: not the corpus growing past a COUNT assertion,
but past a STRUCTURAL assumption a fixture never stated explicitly.

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

1. **Measure before editing** — and when a PRIOR session's own conclusion contradicts what the user
   is now reporting, re-measure from scratch rather than trusting the earlier conclusion. `v86_b`'s
   whole cut is this: `v85_u` traced `_storyBodyHtml`'s own internal logic correctly and concluded
   "confirmed already built" — without ever rendering the REAL calling functions against real data.
2. **Guard at the layer where the claim is observable.** A test that calls the INNER function
   directly proves the inner function correct; it proves NOTHING about whether any real caller
   reaches it. Check the callers too, especially when a bug report says the feature isn't visible.
3. **A guard that pins the EXACT ARGUMENTS of a call breaks on any legitimate change to those
   arguments** — pin the durable claim instead.
4. **A test fixture drawn from the real corpus can silently become a different STRUCTURAL kind of
   fixture as the corpus grows**, not just drift on a count.
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output** — but THIS bug needed
   neither; it was a pure rendering/wiring defect, verified entirely against already-stored data.
   Don't assume every "why isn't X showing" report needs a live model investigation.
7. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified.
8. **A per-caller fix does not generalize to other callers of the same primitive** — `_storyBodyHtml`
   had exactly TWO real callers and BOTH had the same bug; check every one, not just the one a bug
   report points at.
9. **A rigorously measured finding for ONE contributing factor is not proof there is only one.**
10. **When a change is the FIRST of its kind to touch the live app or write to a real corpus, ASK how
    far it should go before building.**

# WHERE TO START

**Items A, B, C, E, F, G, H from `roadmap_v86.md`'s "OPEN AT THE v86 CUT" section are unchanged and
still open** — none built this cut, all still scoped there. Item D's own TEXT was corrected this cut
(it previously said Tier 1 was confirmed working; it was not, until `v86_b` — the item ITSELF, Tier 2
per-word image-coordinate highlighting, is unchanged and still the real next ask).

A reasonable ordering, not a ruling:
- **Item C (comic/PDF upload-card UX)** needs the user's own confirmation of the recommendation
  before any code.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is now genuinely buildable-on-top-of a WORKING
  Tier 1 (as of `v86_b`) — worth asking the user if this is next, now that the foundation actually
  works.
- **Items B, E, F, G, H** are each independently startable.

**Live-verify `v86_b`'s own fix on a real device** — mechanically proven (mutation-tested against
real stored data), but nobody has looked at a real comic-derived progress card in an actual browser
since this fix landed.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map.
