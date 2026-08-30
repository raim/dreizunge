# Session prompt — written at the `v86_y` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_y`**. `v86_x` shipped the comic
review card's layout redesign. This cut (`v86_y`) is two UI-consistency fixes on the story-view
controls, both from real usage of the `v86_v`-`v86_x` work.

**What shipped this cut (`v86_y`)**:

1. **The 🔍 text-explorer button and the two 🌐 language flags are now genuinely mutually
   exclusive.** User: *"the text analyzing button is an alternative to the two language flags, so
   when clicked the language flag should look unclicked, and clicking on the flag should go to the
   other view."* Root cause: `toggleTextExplorer()` forces `_compStoryLang` back to `'target'` on
   toggle-ON, so the flag renderer kept the target flag looking active even though a THIRD view was
   showing. Fixed by passing `null` as the "current" flag while explorer is on (matches neither
   flag), and by having `toggleCompStoryLang(lang)` also turn explorer off — a flag click while
   explorer was on used to be an invisible same-state re-render.

2. **Retranslate + language-view parity between the lesson-set chapter page and the storyline "read
   full story" page.** User: *"Both should be available on both cards, and on the storyline page,
   the button should translate all chapters."* New `retranslateChain(chainId, btn)` on the storyline
   page, reusing the SAME `data-chain` id array `analyzeChaptersRun()`'s own button already reads —
   one POST per chapter (isolated failures), syncing BOTH `APP.savedList` and the chain's own render
   cache, then re-rendering. `/api/retranslate-story` now accepts `{topicId}` as well as `{topic}`.
   Gated identically to `#story-qc-btn` (`canGenerate` alone), matching `#story-retranslate-btn`'s
   own already-corrected gate.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_y`) for the full reasoning; `v86_v`/`v86_w`/`v86_x` if you need that
   history for the comic review card / retranslate button / layout redesign.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and has not been kept current since
   — this cut's `retranslateChain()`/flag-exclusivity fix are NOT reflected there either (a doc-only
   catch-up pass was done once already this session, through `v86_x` — it is stale again already;
   consider whether it's worth doing a SECOND pass or waiting for more cuts to accumulate first).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 297 checks
node test/run.js --quick                  → expect 254
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress` flaked once each in the `v86_w` cut too, both confirmed pre-existing/unrelated.

Corpus at this cut: **338 topics, 99 storylines, 33 languages, 713 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server was actively generating content
DURING this cut, more than once — re-measure fresh at commit time if `unit-roadmap-version`
disagrees). 2 new `en` keys this cut (`toast.retranslate_batch`, `toast.retranslate_batch_failed`).
`docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_y'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_x` cuts — see those releases' own sections for the reasoning)

1. **A toggle that silently forces a SHARED piece of state to a fixed value (here,
   `toggleTextExplorer` forcing `_compStoryLang` to 'target') can leave an UNRELATED renderer that
   also reads that state showing a stale "active" indicator** — new this cut: the flags never knew
   explorer mode existed, so they kept reporting whichever language `_compStoryLang` happened to
   hold, correct or not.
2. **When two surfaces are meant to offer the SAME control, check both for the SAME gate, not just
   the same button** — the storyline page's retranslate button needed the identical `canGenerate`-
   only gate the lesson-set page's own button already uses (itself a `v86_w`-cut fix), not a fresh
   guess.
3. **Verify a baseline is genuinely green BEFORE layering a new fix on top**, and say so in the
   write-up — this cut's own roadmap entry states the pre-fix 296/296 confirmation explicitly, not as
   an assumption.
4. **Splitting unrelated fixes into separate commits sometimes means reverting a NEWER file back to a
   git-tracked HEAD version rather than hand-editing** — `build-static.js` and
   `unit-static-freshness.test.js` had zero `v86_y` content, so `git show HEAD:<file>` was the exact,
   verifiable revert, not a manual diff-and-hope.
5. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **A follow-up request already in flight this session, not yet its own release**: baking PLAN §7.0
  CP1/CP2's analysis into `docs/index.html` (the static build) — build-static.js changes and a new
  client-side STATIC_ANALYSIS branch were implemented and live-verified in the SAME session this cut
  shipped from, held out of `v86_y`'s own commit to keep it a single coherent change; ships next as
  its own cut (see this session's own history for the design/implementation, already done — just
  needs its release wrap-up).
- **A real, diagnosed generation-prompt bug, not yet fixed**: `PROMPTS.inflections.examples.default`
  (prompts.json) demonstrates `formLabel`/`formChoices`/`explanation` in ENGLISH even though its own
  `translation` field switches to German — internally inconsistent with the schema's own "produce
  formLabel/explanation in {S}" instruction. Confirmed via a REAL corpus lesson
  (`tp_17880367188140000070`, nl-target/de-source, which has no dedicated example and falls back to
  this flawed default): every one of those fields came out in DUTCH (the TARGET language) instead of
  German — the model didn't even follow the flawed example's OWN language, it drifted to the
  language it was most immersed in while scanning the story. `wordForms`'s own default example does
  NOT have this inconsistency (its explanation correctly matches {S}); `inflections` is the one
  broken case, checked directly rather than assumed. Recommended fix: rewrite the `default` example's
  `formLabel`/`formChoices`/`explanation` into German, matching its own `translation` field, mirroring
  this project's own established remedy for exactly this class of compliance failure (the German
  ALL-CAPS capitalization worked example, `_comicExtractPrompt`) — a live A/B re-test on the SAME
  reported chapter afterward would confirm it, the same way that fix was confirmed. Not yet
  implemented — the user asked to "analyze and suggest," not to build yet.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_y`'s own additions added — cheap,
  doc-only, but keeps accumulating faster than it gets caught up.
- **The wizard-page alternative for the review card** — explicitly NOT chosen at `v86_x`; revisit
  only if asked specifically.
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

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last done through `v86_x`, already stale again); other sections are kept
current inline as each cut touches them.
