# HANDOVER — v75

One page. Read `build_history/roadmap_v75.md` next for the queue and the session protocol, and
`build_history/v74b_session28_notes.md` for what session 28 actually found — it is long, and the
findings matter more than the diffs.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **170 checks, ALL PASSED** |
| `node test/run.js --quick` | 149 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v75'`. Establish this before changing anything.

**If `unit-static-freshness` fails, run `node build-static.js`.** It hashes every baked input and
stamps the digests into `docs/index.html`, so a stale static build is caught instead of shipping
silently. **A failure here is the guard working.** The data files travel separately from the code
and routinely arrive newer.

## What session 28 settled

Nineteen point releases, `v74_b` -> `v74_r`, then cut to **`v75`**. The headline: **the roadmap's prime suspect was wrong.**
Nothing from session 27 was reverted. `v73_g`'s icon row does navigate, `v73_i`'s keying is sound,
`v73_d` is not the cause of the red bar. The real defect was older and larger.

- **`v74_b`** one lesson-phase classification. 29 chapters had gated the story behind an error hunt,
  which renders a corrupted copy of that story.
- **`v74_c`** coverage counts SOURCE ITEMS, not generated questions. This was the cause of the
  reported "user progress broken": the qid universe was cached under an audio key, so a learner who
  played muted and then unmuted read `64/83` with Next locked and no way to recover. **284 of 298
  topics -> 0.** Also closes the sampling nondeterminism.
- **`v74_d`** math counts (225 authored exercises, 25 chapters).
- **`v74_e`** hidden lessons never count (guard). **`v74_f`** the card routes to the error hunt (guard).
- **`v74_g`** counters (b) and (c). **`v74_i`** live-mode storyline progress. **`v74_k`** the
  storyline locks. **`v74_o`** the last card is not a dead end.
- **`v74_j`** TTS voice ranking: locale before quality. **`v74_l`-`v74_r`** sections 3 and 4 complete.

## Three standing rules earned the hard way

1. **A probe must call the product function, never a re-typed copy** - and least of all one lifted
   from a test stub. Two false findings this session came from re-implementing `lessonCountsFor` and
   the read-full-story lock rather than invoking them.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors.
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.

Also: **a headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks.

## Naming convention (set by the user at the v75 cut)

**A session's prompt file is named for the version that session WRAPS UP WITH**, not the one it
starts from. The session that ended in `v75` opened with `build_history/v75_prompt.md`. The old
`session_{n}_prompt.md` files were renamed to match — `session_28_prompt.md` -> `v74_prompt.md`,
`session_29_prompt.md` -> `v75_prompt.md` — because the session numbering had drifted from the
version numbering and only the version number stays meaningful later. Session NOTES keep their
existing `v{ver}_session{n}_notes.md` form.

## Next session - in this order

1. **The pass mark.** `Churros` is 40 items where it was 83 questions, and an item is solved by ANY
   correct answer, so 80% is a materially lower bar than before. Deliberately not guessed at. **Needs
   the user's browser pass, not a code change.**
2. **Highlighting (roadmap section 2).** Measured, not shipped. **The roadmap's stated plan does not
   work**: `_articleStatsFor` reads grammar items and returns `sampleSize: 0` on the very chapters
   that need it. A corpus-derived alternative is measured in the session notes (`Churros` 2 -> 10
   marks; only Spanish and Italian store articles with their vocabulary). It wants its own release
   with the threshold justified. **Do NOT revert the word boundaries** - `v73_e` traded the every-`i`
   bug for 2 real marks.
3. **Browsing completion cards** of already-played lessons, with explicit back/next (user request).
   Note this turns `v74_o`'s "nothing left to do" terminal state into a waypoint and interacts with
   `v74_l`'s Next-only rule - revisit those two branches together rather than layering a third
   navigation rule on top.
4. **`_sbChapterTarget`** (`index.html` ~8065) - the seventh and last known instance of the
   raw-lessons pattern. Not fixed because its test extracts it in isolation with synthetic progress
   maps, so switching it to `chapterComplete` needs that harness reworked first.
5. **The storyline-page TTS selector.** `dreizunge_v39_summary.md:331` records selectors built "in
   all footer rows (lesson-set, **storyline** screens)". Today `ids = ['ls']`, the `-sl` elements are
   gone, but the function's own existence check still looks for `tts-lang-select-sl`. No note
   anywhere explains the removal. Also dead: `#tts-row` / `buildTtsSelector()`, permanently
   `display:none`, still rebuilt on every lesson-set entry.

## Owed by the user, not doable in a container

- **A browser pass.** Now 19 releases deep. `v74_c` changed what coverage means, `v74_i` touched the
  live list projection (the first `server.js` change in the session), and `v74_j`/`v74_n` are visual.
- **The comprehension QC checker** - needs a new prompt and a live model. Queued, correctly.
- **The translate pass.** `complete.story_unlocked` and `ex.badge.comprehension` were changed in
  English and dropped from the other 29 languages for refill; `complete.words_solved` and
  `form.finish_mixed` are new and English-only. `t()` falls back through English, so nothing is
  broken meanwhile. **`v71_q`: never assert a dropped key absent.**

## One process failure worth not repeating

Mid-session I bumped `APP_VERSION` and edited three files **without running the definition-of-done or
packaging**, so the tree drifted past the artifact the user was holding. I then found the changes,
failed to recognise them as mine, and asked the user about them - the container has one writer.
**Where the environment admits only one agent, unexplained state is yours.** The protocol's
suite-docs-package cycle exists precisely to make that drift impossible; follow it per change.
