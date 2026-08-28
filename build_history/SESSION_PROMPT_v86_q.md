# Session prompt — written at the `v86_q` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_q`**. `v86_o` shipped item W
("text explorer" mode) end to end; `v86_p` added an opt-in generation-time checkbox. This cut
(`v86_q`) is a second same-session round of chat-driven follow-ups on the same feature, found while
the user live-tested `v86_o`/`v86_p` against their own real dev server.

**What shipped this cut (`v86_q`)**:

1. **Comic panel images now show in the TRANSLATION and TEXT-EXPLORER views too** — previously
   target-language-only. A new, simpler `_comicPanelImageStripHtml(d)` (image-only, no per-panel
   caption — neither view has per-panel text to pair an image with) is prepended to both
   `_storyBodyHtml`'s translation branch and `_textExplorerBodyHtml`.
2. **A `analyzeChaptersRun()` batch curator trigger** — a 🔤 button (not 🔍, taken by QC on the same
   row) on storyline header cards (all chapters) and individual lesson-set cards (one chapter).
   Fire-and-forget per chapter, reuses `v86_o`'s existing `/api/analyze-chapter/:id` route — no new
   server code. Covers chapters that already exist, the retroactive complement to `v86_p`'s
   generation-time checkbox.

A real, legitimate test invariant broke and was fixed correctly (not just silenced):
`unit-provenance-fields.test.js` pinned a storyline chapter card at exactly 3 action buttons
(continue/QC/delete) — updated to 4 once the new 🔤 button was intentionally added, re-verified the
assertion actually fails without it.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   item W's own section (✅ SHIPPED, `v86_o`+`v86_p`+`v86_q` all referenced) if you need the history.
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically — it
   still has NOT been updated for item W's full surface across all three cuts (`v86_o`/`v86_p`/
   `v86_q`) — flagged twice now, still not done, three cuts' worth of undocumented surface.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 292 checks
node test/run.js --quick                  → expect 251
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged across FIVE cuts now (`v86_m`→`v86_q`)**:
`unit-article-choices`, which reads the LIVE `lessons.json` directly — one `it`-language article
lesson somewhere in the live corpus can't build a full 3-way MCQ. Still not investigated — cheap to
diagnose, the test itself names the failure mode. This is now the single most-carried-forward open
item in this whole line; strongly worth doing next before a sixth cut carries it again unchanged.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 704 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. `en`
keys grew by 2 this cut (`text_explorer.batch_toast`/`batch_failed`, the batch-trigger's own summary
toast). `lessons.json` was never touched this cut (confirmed clean via `git status --short
lessons.json` throughout — including around this session's own extensive live browser-testing
against the user's real dev server, restarted multiple times to pick up each round of changes,
always confirmed with the user first). `APP_VERSION = 'v86_q'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-12 added across the
`v86_o`/`v86_p` cuts — see those releases' own sections for the reasoning)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable.**
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change** —
   confirmed again this cut: `unit-provenance-fields.test.js`'s pinned button count needed updating,
   not reverting, once a real fourth action was intentionally added.
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone —
   but re-run it a few times before assuming that's the explanation.**
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **Ask before restarting a dev server you did not start** — done multiple times this session
   (once to free a long-running analysis job for a faster retest, several more times to load each
   round of new code), every single time confirmed with the user first, never assumed.
8. **When two roadmap items describe the same underlying capability from two different angles, check
   for overlap BEFORE scoping either one in isolation.**
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.**
10. **Small, mechanical, independently-testable groundwork is a reasonable thing to land in an
    otherwise-investigation-heavy session.**
11. **Mutation-test every guard you write or rely on** — a fetch-orchestration guard shipped broken
    in `v86_o` until a real end-to-end client test caught it.
12. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
    and their real costs, don't just build the first thing asked.**
13. **When a feature's icon/affordance would collide with an EXISTING one on the same surface (this
    cut: 🔍 already meant "QC" on the exact row a new action needed adding to), pick a genuinely
    distinct one rather than letting two different actions share a symbol** — new this cut, the
    user's own explicit reason for choosing 🔤 over 🔍 for the batch trigger.

# WHERE TO START

Item W (all steps + three follow-up rounds) is done for now. Nothing new was opened this cut beyond
what's already listed below (unchanged from `v86_p`, still true):

- **The `unit-article-choices` reproducible red** — FIVE cuts running now, still not investigated.
  Genuinely the top thing to do next at this point — it's cheap, the test names its own failure mode.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed) — `POST
  /api/jobs/cancel` flips a status flag but no job type actually stops its own in-flight work. Most
  visible for CP2 (minutes-long per-chapter jobs), true for every job type.
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P** needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.
- **`INTERNALS.md` §6b** needs a row for item W's whole surface (three cuts' worth now) — doc-only,
  cheap, increasingly overdue.
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which never got it (only the completion/progress card panel did).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
