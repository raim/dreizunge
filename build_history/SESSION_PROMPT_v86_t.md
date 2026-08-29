# Session prompt — written at the `v86_t` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_t`**. `v86_o`-`v86_s` shipped
item W ("text explorer" mode) and five follow-up rounds. This cut (`v86_t`) is a sixth, found via
the user's own real screenshots.

**What shipped this cut (`v86_t`)**:

**A real, user-caught visual bug.** The SAME comic-sourced chapter's text started at a visibly
DIFFERENT horizontal position in the progress card vs. the text-explorer view — "apparently one
view has margins, the other doesn't." Root cause: `v86_q`'s own image-strip helper returned the
image markup, with the caller's text HTML concatenated AFTER it as a bare sibling — only the
DEFAULT view's per-panel case nests text inside `.comic-story-panel-text`, which supplies the actual
padding. Fixed per the user's own diagnosis ("these should really use the same code to display
text, just update the highlighting colours"): the helper (renamed `_comicPanelsFlatTextHtml`) now
takes the caller's built text as a parameter and wraps it in the EXACT SAME card markup the default
view uses. Visually verified via a real side-by-side screenshot comparison on an isolated server
instance (never the user's own running dev server), not just asserted by tests.

**A second, smaller cause, found immediately after**: the user reported the text still jumped
"minimally." Real cause: `.te-tok` had no `font-weight` at all (normal 400) vs `.story-vocab-hl`'s
own 600/800 — narrower per character, shifting word-wrap points even with identical padding. Fixed
with one CSS line. A genuine residual difference is left BY DESIGN and NOT chased further, per the
user's own explicit call ("we can leave it if hard to fix"): the default view marks only this
chapter's own vocabulary, the text-explorer marks EVERY token — a few function words are bold in one
view and plain in the other, inherent to the feature's own "every word gets a mark" point.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. Item
   W's own section (✅ SHIPPED across six cuts now) if you need that history; **items AG/AH/AI**
   (CP2-quality/cost/curation-UI follow-ups, scoped not built) if picking those up.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface (caught up in a doc-only pass alongside AG/AH/AI) — this cut's own `_comicPanelsFlatTextHtml`
   rename is NOT yet reflected there; a future session touching that row should update the name.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 293 checks
node test/run.js --quick                  → expect 251
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged across EIGHT cuts now (`v86_m`→`v86_t`)**:
`unit-article-choices`, which reads the LIVE `lessons.json` directly — one `it`-language article
lesson somewhere in the live corpus can't build a full 3-way MCQ. Still not investigated. This is by
a wide margin the single most-carried-forward open item in this whole line — do this one next.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 704 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. No new
`en` keys this cut. `lessons.json`/`canonical-analysis.json` untouched this cut (confirmed clean via
`git status --short` throughout — including around this session's own extensive live/visual
verification, always on an isolated server instance, never the user's own running dev server).
`docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_t'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-14 added across the
`v86_o`-`v86_s` cuts — see those releases' own sections for the reasoning)

1. **Measure before editing** — this cut's own bug was found by the user comparing two REAL
   screenshots pixel-by-pixel, not by reading source; the fix was then verified the same way
   (rendered both views on an isolated instance, screenshotted, compared) before calling it done.
2. **Guard at the layer where the claim is observable** — a string-match assertion alone
   ("comic-story-panel-text" appears somewhere) would have missed the real bug (WHICH element it's
   nested inside, and whether the padding actually applies) — the fix's own tests check card COUNT
   and nesting structure, not just substring presence.
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change.**
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone.**
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **Ask before restarting a dev server you did not start** — this cut specifically verified on a
   SEPARATE port/instance because the user's own server was actively running on port 3000 at the
   time; never touched it.
8. **When a fix targets ONE known write path to some piece of state, check whether OTHER write paths
   to the SAME state exist before considering the class of bug closed.**
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.**
10. **Mutation-test every guard you write or rely on.**
11. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
    and their real costs, don't just build the first thing asked.**
12. **When enriching a shared pipeline stage (CP2) for one consumer's need, check what ELSE consumes
    it before designing the enrichment.**
13. **When two views are meant to look the same except for one specific difference (colour/
    highlighting), share the ACTUAL WRAPPING MARKUP, not just similar-looking parallel code** — new
    this cut, the user's own explicit fix direction, and the root cause of this whole bug (two
    independently-built "similar" structures drifted visually apart).

# WHERE TO START

- **The `unit-article-choices` reproducible red** — EIGHT cuts running now. Top priority.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s item W row** needs a small update for this cut's `_comicPanelsFlatTextHtml`
  rename — cheap, doc-only.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed).
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

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for both the
comic-panel subsystem and item W's whole CP1/CP2 browser-integration surface (this cut's own rename
not yet reflected there); other sections are kept current inline as each cut touches them.
