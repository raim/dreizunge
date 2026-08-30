# Session prompt — written at the `v86_ab` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_ac`, `v86_ad`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_ab`**. `v86_aa` fixed a real
prompt-compliance bug in CP2's `"form"` field (English instead of the source language). This cut
(`v86_ab`) is the SAME class of bug, found in a different prompt entirely.

**What shipped this cut (`v86_ab`)**:

This was diagnosed (not built) back at `v86_y`: *"in inflection lessons, we often get readout in the
wrong language, please analyze the new lesson in `tp_17880367188140000070` and suggest whether and
how we could fix this."* The user then asked to build it, and — independently, while this cut was
already in progress — reported a live example that confirms the SAME lesson still shows the bug:
*"Welche grammatikalische Form hat boeren? ... Richtige Antwort: meervoud ... 'Boeren' is het
meervoud van 'de boer', gevormd door toevoeging van -en."* — `formLabel`/`explanation` in DUTCH (the
TARGET language), not German (the SOURCE language) as the schema requires.

Root cause: `PROMPTS.inflections.examples.default` (`prompts.json`) — used for any target language
without its own dedicated example (only `default` and `de` exist; `nl`, this report's own target,
falls through to `default`). Its schema instruction says `"formLabel" names the grammatical form ...
AS A SHORT PHRASE IN {S}`, but the worked example itself demonstrated `formLabel`/`formChoices`/
`explanation` all in ENGLISH while its own `translation` field is German — internally contradicting
the very instruction it was meant to illustrate. Fixed by rewriting those three fields into German,
matching the example's own `translation`. Same remedy as `_comicExtractPrompt`'s capitalization fix
and `v86_aa`'s CP2 `"form"` fix — a self-contradicting worked example gives the model no coherent
language cue, wherever exactly it drifts (English there, Dutch here — same root cause either way).

Also answered, directly, the user's own follow-up pedagogical question on that same reported item:
*"one of the other options was 'datief', wouldn't that also be correct in this case?"* — No: modern
Dutch has lost noun-case marking almost entirely (unlike German), so `"boeren"` has no dative form
distinct from its plural; `"datief"` is an imperfectly-chosen distractor (borrowing a German-shaped
case category Dutch doesn't have), not a second correct answer. Noted as a possible future
refinement to the wrong-choice generation instructions, NOT built without being asked.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_ab`) and `v86_aa`'s for the two related prompt-compliance fixes; `v86_v`-
   `v86_z` for the rest of the comic review-card/retranslate/flags/static-docs history this session.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and needs another catch-up pass
   (last done through `v86_x`) — the `v86_z`/`v86_aa`/`v86_ab` additions are not in there either.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 298 checks
node test/run.js --quick                  → expect 255
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked once in earlier cuts THIS session too, all
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness, per CLAUDE.md's
own "Flaky tests" section — a test reading the live corpus directly can fail from real-time usage).

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 713 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server generates content concurrently —
re-measure fresh at commit time if `unit-roadmap-version` disagrees; already dropped once this
session, from 338/99 to 336/97). No new `en` keys, no client-code change this cut (`prompts.json` is
server-side-only, not a static-build input) — `docs/index.html` WAS rebuilt anyway, purely for the
`APP_VERSION` bump. `lessons.json`/`canonical-analysis.json` untouched by this cut's own edits.
`APP_VERSION = 'v86_ab'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_ab` cuts — see those releases' own sections for the reasoning)

1. **A field with no explicit language instruction in a multilingual prompt defaults unpredictably**
   — sometimes English, sometimes the TARGET language, never reliably the SOURCE language the schema
   actually asked for. Confirmed across FOUR separate incidents now (`_comicExtractPrompt`'s
   capitalization fix, `PROMPTS.inflections`'s own `formLabel` field's pre-existing correct design,
   `v86_aa`'s CP2 `"form"` fix, and this cut). When adding a field to a multilingual prompt, state
   its language explicitly — never assume the model infers it from sibling fields or from the
   instruction text alone if the WORKED EXAMPLE contradicts it.
2. **A worked example that contradicts its own instruction is worse than no example at all** — the
   model has both a rule ("write X in language S") and a demonstration that appears to break that
   rule, and real usage shows it sometimes follows the demonstration instead. Check every worked
   example for INTERNAL CONSISTENCY (do its own fields actually agree on what S/L are, using its own
   translation/sentence fields as ground truth) before trusting it teaches the instruction correctly.
3. **The SAME class of bug can recur in a SECOND, unrelated prompt in the same session** — `v86_aa`
   (CP2) and `v86_ab` (inflections) are different files, different prompts, different call sites, but
   the identical root cause. Fixing one instance is not evidence the codebase is now clean of the
   pattern; each prompt's own worked examples need their own check.
4. **A live report during an in-progress diagnosed-but-unbuilt fix is independent confirmation, not
   noise** — `v86_ab`'s own live example arrived WHILE the fix from the SAME root-cause diagnosis was
   being built, for the exact chapter already named at `v86_y`. Treat it as corroboration, not a new
   investigation.
5. **Answer a user's own specific technical/pedagogical question directly and correctly, inline, even
   while mid-release** — the "datief" question was real linguistics (Dutch case-marking), not a
   feature request; answering it plainly cost nothing and didn't need to wait for the code fix.
6. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **A possible follow-up refinement, NOT built**: constrain inflection wrong-choice generation so a
  distractor category must genuinely apply to the TARGET language's own morphology (found via the
  "datief" report — Dutch has no noun case at all, so offering a case-label distractor for a Dutch
  item is never plausible, only for languages that actually have that category). Needs a product
  decision on scope (case only, or every dimension) before any prompt change ships.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_ab`'s own additions added —
  cheap, doc-only, keeps accumulating faster than it gets caught up (last full pass was through
  `v86_x`).
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
- **The 3 chapters cached in `canonical-analysis.json` have stale, English `"form"` values** from
  before `v86_aa`'s own fix — re-analysing them (via the existing 🔤 curator batch trigger, or a
  chapter's own first 🔍 open) would pick up the corrected, source-language-localized labels.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last full pass through `v86_x`); other sections are kept current inline as
each cut touches them.
