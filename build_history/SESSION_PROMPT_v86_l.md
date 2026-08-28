# Session prompt — written at the `v86_l` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_l`**. The user said "continue
with item AA" right after `v86_k` shipped, picking the genuinely-close-to-easy item from that cut's
own recommendation.

**What just shipped (`v86_l`)**:

**Item AA — teacher-mode button → a dropdown with two explicit named options.** The old
`#teacher-mode-btn` (single button, "click to flip", `onclick="toggleTeacherMode()"`) is now
`#teacher-mode-select` — a native `<select>` with two options, `id="teacher-mode-opt-teacher"`/
`"-student"`, wired via `onchange="setTeacherMode(this.value)"`. `_teacherMode` (the underlying
boolean — gates story unlocking, hidden-lesson visibility, the editor, mixed-lesson pooling, and more
throughout the app) is completely unchanged; only the control's own presentation changed.
`updateTeacherModeBtn()` kept its name but now also re-localizes BOTH option labels on every pass
(two new `en` keys, `teacher.option_teacher`/`teacher.option_student`). `INTERNALS.md`'s own `PLAN
§C4` row updated in place so it doesn't go stale describing the old shape.

Full diagnosis (the exact test rewrite, the two mutation tests) is in `roadmap_v86.md`'s `v86_l`
entry.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   the full "OPEN AT THE v86 CUT" section (item AA now shipped; everything else — items A, B, C, D, E,
   G, item F's own "add explanations" half, item AD (source-language furigana), the rest of the
   `v86_h` batch, and item AE (still open, needs the user to hit it again with diagnostic logging in
   place) — is unchanged and still open).
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically; the
   small fixes since (`v86_h` through `v86_l`, outside that subsystem) are documented inline in their
   own existing sections as each shipped (the `PLAN §C4` row just updated for `v86_l` is the latest
   example of that pattern) rather than batched into a catch-up pass — keep doing it that way as you
   go, it's cheaper than letting it accumulate.

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

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 692 `en` keys** — an inherently live
snapshot for the topic/storyline counts (see `v86_g`'s own note); re-measure fresh if
`unit-roadmap-version` disagrees. `en` keys are up 2 from `v86_k` (`teacher.option_teacher`/
`teacher.option_student`). `APP_VERSION = 'v86_l'`.

⚠️ **When a control's underlying STATE is reused across dozens of call sites but its own PRESENTATION
changes, separate the two cleanly before touching anything.** Item AA changed `#teacher-mode-btn` into
`#teacher-mode-select` and `toggleTeacherMode()` into `setTeacherMode(mode)`, but `_teacherMode` itself
— read directly by dozens of unrelated call sites throughout the app — never moved. Confirmed this
split was clean by grepping every `_teacherMode` reference before touching the control, not assumed.

⚠️ **When a control already owns its own per-language update function, reuse it for new i18n needs
rather than reaching for a second mechanism** (`data-i18n` markup sweeps, in this codebase). Item AA's
two new option labels are set inside the EXISTING `updateTeacherModeBtn()`, which was already being
called on every `applyUIStrings()` pass — no new sweep needed.

⚠️ **Before search-replacing an old element id across every test file that mentions it, re-read what
each assertion is actually CLAIMING.** `unit-settings-card.test.js`'s and `unit-static-flags.test.js`'s
own claims (single-instance containment, `localStorage` persistence) were about the CONTROL's identity
and behaviour, not its markup shape — updating the id was enough; the claims themselves didn't need
rewriting, unlike `unit-teacher-toggle.test.js` itself, whose claims WERE about the old button shape
and needed a full rewrite.

⚠️ **Check `git status --short lessons.json` at the start of this session.** The user is actively
using this app for real work on their own separate, long-running dev server — confirmed actively
testing across many consecutive cuts this session already. If `lessons.json` shows modified, that is
their own data — not yours to revert, commit, or "fix around" without asking. `git checkout --
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

1. **Measure before editing** — grep every reference to a control's underlying state before touching
   the control's own presentation, so a shape change doesn't accidentally also change the state model.
2. **Reuse a control's own existing per-language update function for new i18n needs, rather than a
   second mechanism** — new emphasis this cut.
3. **Guard at the layer where the claim is observable** — re-read what each existing test is actually
   CLAIMING before deciding whether a shape change needs a rewrite or just an id update.
4. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** — keep
   updating pinned tests to match real behaviour changes, not just extending them.
5. **A test that reads the LIVE corpus directly (not an isolated fixture) can fail from the user's own
   real-time usage alone.** Always verify against the COMMITTED tree before assuming a regression.
6. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
7. **A live model call needs a live test AND a real human reading the output.**
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — but a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. READING `lessons.json`/
   `learners.json` for diagnosis is always fine; writing to either is the restricted action.
9. **"A per-caller fix does not generalize" cuts both ways — proactively check SIBLING callers of a
   fixed primitive, don't wait for a second bug report to find them.**
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
`v86_j` diagnostic logging in place; do not attempt a fix without that console evidence in hand.

Otherwise, a reasonable ordering, not a ruling:
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and the toggle-sharing
  design question settled — one furigana setting for both directions, or two independent ones).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of the "don't lose
  generation work" story item S already closed the server-side half of.
- **Item P** and **item AB's own retrieval fix** both need a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** is architecturally load-bearing, but the
  migration of the 6 existing topics needs the user's own go-ahead first.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
