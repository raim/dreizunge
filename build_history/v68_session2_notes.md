# v68 session 2 — red baseline: provenance stamps missing `source` on live writes (v68.1)

## What was broken

Session start found the suite RED: 115 green, 2 failed — `unit-story-stamp` (v53_d) and
`unit-translation-stamp` (v55_f). Both failures were the same corpus invariant: every topic's
`storyMeta`/`translationMeta` must carry `source` ("where the value came from"). 11 topics violated
it — exactly the ones generated live on 2026-07-21/22, after the v68 cut (the Corriere hail-article
uploads + a few generated `de|en` topics).

**Root cause — a latent contract mismatch, not a regression.** `source` was only ever written by the
one-time `backfill-provenance.js` run (v53_e). The live server stamped `model`, `origin`, tokens and
`at` — never `source`. So the "every stamp has a source" invariant was satisfiable only while the
corpus stayed frozen; the first live generation after the release was guaranteed to turn the suite
red. It had been latent since v53_e/v55_f and merely needed real usage to fire.

## The fix (v68.1)

1. **Live stamps now write `source: 'recorded at generation'`** at all six sites (story:
   user-provided, generated; translation: generated, failed, user-provided, skipped-same-model),
   paired with the existing `.origin` assignments.
2. **Boot heal `fixMetaSource()`** (beside v67.1's `fixLessonIds`): any `storyMeta`/`translationMeta`
   lacking `source` gets `'recorded at generation'`. The label is provably accurate — backfill
   ALWAYS sets `source`, so a stamp missing it can only have been written by the live server. The
   heal is idempotent, adds nothing else, and never invents stamps on stampless (pre-v53) topics.
   Your at-home library heals itself on the next server start.
3. **Shipped corpus healed** by booting the new server against it: 22 stamps across the 11 topics;
   a before/after diff confirmed zero other changes (storylines, flags, all other topic fields
   byte-identical).
4. **Guards:**
   - `unit-story-stamp` / `unit-translation-stamp`: structural asserts that every live
     `_storyMeta.origin` / `_translationMeta.origin` assignment is paired with a
     `source = 'recorded at generation'` stamp — count equality, so a new origin site without a
     source stamp fails.
   - **New `unit-meta-source-heal`**: boots the server against a store with a pre-v68.1 live-shaped
     row, a backfilled row, and a stampless row; asserts the live row gains `source` (and ONLY
     `source`, via `deepStrictEqual` after stripping it), the backfilled row keeps its more specific
     source, and the stampless row stays stampless. Registered in `test/run.js`.

Static build re-run (rule 4 — `lessons.json` is baked). Suite **118 green**; `check-inline` 0 on
both `index.html` and `docs/index.html`. No new `ui.json` keys. No version bump (mid-session fix,
not a packaging point; bump to consider at the next cut: v68.1 → v69).

## ⚠ LATENT BUG FOUND while auditing — same class (fixed below in v68.1b)

A manually pasted story (no file upload) is live-stamped `origin='user-provided'`; only the
storyline sourceFile post-pass refines that, and only to `'file-upload'`. But the corpus invariant
(unit-story-stamp §7b) allows origins `['generated','dialect-rewrite','file-upload','user-pasted',
'unknown']` and asserts `model '(user-provided)' → origin ∈ {file-upload, user-pasted}`. So the next
time a story is PASTED (not uploaded) and never joins a sourceFile storyline, its stamp keeps
`origin='user-provided'` and the suite goes red again the same way. None of the current 278 topics
hit it (all current `(user-provided)` rows were either backfilled as `user-pasted` or refined to
`file-upload`).

## ✅ FIXED in the same session (v68.1b) — pasted-story origin vocabulary

The latent bug above was fixed immediately after (user go-ahead), same class as the first:

- **Live stamp** for a pasted story now writes `origin='user-pasted'` (the corpus vocabulary)
  instead of the out-of-vocabulary `'user-provided'`. The sourceFile post-pass still refines it to
  `'file-upload'` (it matches both the new value and the legacy one, for robustness).
- **`fixMetaSource()` extended**: persisted legacy `origin='user-provided'` rows (pre-v68.1 live
  writes) are refined at boot, classified exactly the way `backfill-provenance.js` classified them —
  chapter of a sourceFile storyline → `'file-upload'` + `sourceFile`, otherwise → `'user-pasted'`.
  Guarded on the `'(user-provided)'` model sentinel so a model-authored row can never be relabelled
  as an upload; refinement never touches `model`.
- **Guards**: `unit-story-stamp` now asserts the pasted stamp is `'user-pasted'` AND that the legacy
  stamp string is *gone* (negative assert, so it can't come back), plus that the refinement exists.
  `unit-meta-source-heal` gained two fixtures — a legacy pasted story (→ `user-pasted`, no
  sourceFile invented) and a legacy chapter inside a sourceFile storyline (→ `file-upload` +
  `sourceFile`, model untouched) — and asserts `source` is healed in the same pass.
- **Shipped corpus**: verified byte-identical after a boot against a copy — no legacy rows exist in
  it, so no data change and no static rebuild owed (nothing baked changed in v68.1b).

Suite green; `check-inline` 0 on both builds. No new `ui.json` keys.

## Library adoption (post-fix upload)

The user then uploaded their current live `lessons.json` (00:42, newer than the zip's 00:21 copy).
Structural diff against the zip's corpus: identical except ONE new lesson — a `mixed` lesson
(`ls_1784766663416_3o7o`, ~00:31) added to "Verwüstete Agrarlandschaften", the storyline the v68
duplicate-id bug had stuck. **0 duplicate ids, 0 missing ids — the v67.1 repair is holding under
continued use.** The upload predates this session's heal, so the same 11 topics / 22 stamps lacked
`source`; healed by booting the new server against it (verified: only `source` added, storylines
and flags byte-identical, 0 legacy origins). Adopted as the shipped corpus; static build re-run
(rule 4). Suite green on the adopted data; `check-inline` 0 on both builds.

## v68.1c — the completion-crash cluster (user report: "solving questions → stuck; closing shows the lesson-set page")

Three defects behind one report; all in the shared client, so live AND static were affected.

**(a) `showComplete` crashed on EVERY completion — the "stuck".** The v66.1 pass-mark enforcement
wired the Next button using `_belowThreshold`, but the `let _belowThreshold` declaration sat ~35
lines BELOW it → temporal-dead-zone ReferenceError on every call. The exception escaped through
`renderEx`, so finishing a lesson froze the screen on the last question with the button disabled.
`node --check` can't catch TDZ (runtime, not syntax), and no headless test executed `showComplete`.
Fixed by moving the `_teacher`/`_belowThreshold` computation above its first consumer.

**(b) The v60.8/v66.1 threshold gate silently never fired.** The same block tested
`d.topic === APP.lessonData?.topic` — but no `d` exists in `showComplete` (the condition was
apparently transplanted from `setComplete`, which takes `d` as a parameter). The ReferenceError was
swallowed by the block's try/catch, leaving `_belowThreshold` permanently false. Now keyed off the
card's own `topicKey`.

**(c) An incomplete mixed-driven set read as "complete" — the perpetual stuck + the lesson-set
leak.** The mixed lesson gets a done-flag on every play (`showComplete` records one before the
crash point; `confirmQuit` records partial progress on ✕). After that, `_firstUnfinishedLessonIdx`'s
plain `!done[id]` scan found nothing, returned -1, and `loadSaved` rendered the review card for a
set whose coverage was below target — which then CRASHED per (a), stranding the learner on the
lesson-set page `goLessonSet` had rendered underneath (the page learners must never see, v60.1).
Fixed: past the `setComplete` early-return (set NOT complete), a learner's scan now falls back to
`_firstVisibleMixedIdx` — exactly what the function's v60.1 contract always promised. Additionally,
`startLesson` now returns false when it could not take over the screen (hidden lesson / a mixed
round that built empty, e.g. every pooled item flagged in the static build), and BOTH `loadSaved`
implementations (live + static, parity) route that case to the storyline screen / landing — the
same target as `confirmQuit` — so no code path leaves a learner on the lesson-set page.

**Guards:** `unit-learner-nav` §6 — comment-stripped declaration-before-use scan of `showComplete`
(TDZ), the undefined-`d` pattern banned, behavioral mixed-resume checks via the extracted real
functions (incomplete+all-flags → mixed idx; complete → -1; teacher → classic; classic set → -1),
`startLesson`'s success signal, and the stranded-learner fallback asserted in both loadSaveds.
§4b updated to the new success-checked routing shape. Static build re-run (client changed). Suite
green; `check-inline` 0 on both builds. No new `ui.json` keys.

**How to see it work (browser, teacher mode OFF, static or live):**
1. Open any chapter, answer through a full lesson → the completion card now appears (previously:
   frozen last question). Below-pass-mark completions now actually show "keep going" + the drill
   button (the gate had never fired before).
2. Open the stuck mixed chapter ("Verwüstete Agrarlandschaften"): it must resume INTO the mixed
   practice round, not show a review card or the lesson-set page, and repeated rounds must raise
   the coverage bar until the chapter completes for real.
3. Quit a round with ✕, reopen the chapter → same: practice resumes; the lesson-set page never
   appears with teacher mode off.
