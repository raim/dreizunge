# Session prompt — written at the `v86_r` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_r`**. `v86_o`/`v86_p`/`v86_q`
shipped item W ("text explorer" mode) and three rounds of follow-ups. This cut (`v86_r`) is
UNRELATED to item W — a real, user-reported live bug found while the user was reviewing their own
corpus, not a follow-up on anything just built.

**What shipped this cut (`v86_r`)**:

**A real bug, and its root cause.** The user reported a comic-sourced chapter's progress card
showing stale, garbled text that had already been corrected weeks earlier (visible correctly on the
storyline reader, not on the progress card) — "I thought we fixed this in a previous session." They
had: `v86_g` fixed exactly this class of bug (`_comicStoryPanelsHtml` reads `comicPanels[i].caption`/
`inScene`, a separate copy of the text; a story edit updates `story` but leaves that copy stale) — but
only for `POST /api/save-story`. `POST /api/story-qc/accept` (accepting a stored QC proposal, the
exact path the user's real `ai_error_hunt` correction went through) is a SECOND, independent write to
`topic.story` that never got the fix. Same sync logic now applied there too.

**A real backfill, with the user's explicit go-ahead.** The fix only prevents this going forward. A
new `backfill-comic-panel-sync.js` (dry-run by default, matching this project's `backfill-*.js`
convention) scanned the real corpus: 8 comic-sourced chapters, 0 multi-panel, exactly 1 stale (the
user's own reported chapter). Run with `--write` only after the user said "yes" explicitly — per the
standing rule on touching their real data. Confirmed idempotent by a third, final dry run.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. Item
   W's own section (✅ SHIPPED across `v86_o`/`v86_p`/`v86_q`) if you need that history; `v86_r`'s own
   section for this cut's unrelated bug fix.
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically — it
   still has NOT been updated for either item W's full surface (three cuts now) OR this cut's second
   sync point (`/api/story-qc/accept`) — flagged repeatedly, still not done, genuinely overdue at
   this point; a future session should just do it rather than flag it a fourth time.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 293 checks
node test/run.js --quick                  → expect 251
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged across SIX cuts now (`v86_m`→`v86_r`)**:
`unit-article-choices`, which reads the LIVE `lessons.json` directly — one `it`-language article
lesson somewhere in the live corpus can't build a full 3-way MCQ. Still not investigated. This is now
by far the single most-carried-forward open item in this whole line — do this one next, before a
seventh cut carries it again unchanged. It is cheap: the test itself names the failure mode.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 704 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. No new
`en` keys this cut (no user-facing string change — a server-side sync fix + a CLI backfill script).
`lessons.json` DID change this cut, deliberately and with the user's own explicit "yes": exactly one
field on one topic (`comicPanels[0].caption`/`inScene`), applied via the backfill script, not a
direct hand-edit. `git status --short lessons.json` shows that one diff and nothing else, confirmed.
`docs/index.html` rebuilt after BOTH the `APP_VERSION` edit and the `lessons.json` backfill.
`APP_VERSION = 'v86_r'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-13 added across the
`v86_o`/`v86_p`/`v86_q` cuts — see those releases' own sections for the reasoning)

1. **Measure before editing** — confirmed again this cut: reading `git status --short lessons.json`,
   the real topic data, and the exact reported strings BEFORE writing any fix is what turned "I
   thought we fixed this" into a precise root-cause diagnosis (a second write path) rather than a
   guess or a re-application of the `v86_g` fix in the wrong place.
2. **Guard at the layer where the claim is observable.**
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change.**
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone —
   but re-run it a few times before assuming that's the explanation.**
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **Ask before restarting a dev server you did not start, and before writing to lessons.json** —
   this cut's backfill script was run dry-run FIRST, its findings shown to the user, and `--write`
   only followed an explicit "yes" — the standing rule held exactly as intended.
8. **When a fix targets ONE known write path to some piece of state, check whether OTHER write paths
   to the SAME state exist before considering the class of bug closed** — new this cut, the whole
   reason `v86_g`'s own fix (real, correct, and tested) still left a second live bug for the user to
   find. A single-instance grep for a field name is cheap insurance against exactly this.
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.**
10. **Mutation-test every guard you write or rely on.**
11. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
    and their real costs, don't just build the first thing asked.**

# WHERE TO START

- **The `unit-article-choices` reproducible red** — SIX cuts running now, still not investigated.
  This is genuinely the top priority at this point.
- **`INTERNALS.md` §6b** needs a row for item W's whole surface (three cuts) AND this cut's second
  comic-sync point — doc-only, cheap, now overdue across four separate cuts' worth of flags.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed) — `POST
  /api/jobs/cancel` flips a status flag but no job type actually stops its own in-flight work.
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
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which never got it (only the completion/progress card panel did).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
