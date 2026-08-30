# Session prompt — written at the `v86_aa` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_ab`, `v86_ac`, …) unless a future
session has a good reason to switch to `v87_a` instead — see the naming note under "What shipped"
below before touching the scheme again.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_aa`**. `v86_z` made item W's whole
CP1/CP2 text-explorer pipeline work in the static build. This cut (`v86_aa`) is a real, user-reported
prompt-compliance bug in CP2 itself, found the moment the user actually used `v86_z`'s own new offline
feature.

**What shipped this cut (`v86_aa`)**:

User report: *"In the text explorer the word analysis should ideally be in the source language. In
`tp_17880367188140000070`, a german->dutch lesson, they are in English."*

Root cause, found by inspecting the real prompt: `buildAnalysisPrompt()` (`canonical-analysis.js`)
explicitly instructs `"sense"` and the phrase `"gloss"` to be written IN the source language `S`, but
`"form"` (the grammatical-label field — part of speech plus inflection) had NO language instruction at
all, plus a hardcoded ENGLISH worked example (`e.g. "verb, 3rd person singular past"`) giving the
model a language cue with nothing to override it. Confirmed on the real cached chapter: `"sense"`
values were correctly German, `"form"` values were English, for every token — a field-level split,
not a wholesale failure. This is the same class of bug as `_comicExtractPrompt`'s earlier German-
capitalization fix, and `PROMPTS.inflections`'s own `formLabel` field already gets this right (the
precedent this fix mirrors: *"formLabel" names the grammatical form ... AS A SHORT PHRASE IN {S}*).

Fix: `"form"`'s instruction now explicitly names `S`, and the old English-only worked example is
REMOVED (not translated — a fixed literal in one language recreates the same bug for every other
source language). This is a PROMPT-ONLY fix. The 3 chapters already cached in
`canonical-analysis.json` (including the reported one) keep stale English `"form"` values until each
is re-analysed — nothing was re-run against the live corpus as a side effect of this fix.

**Naming note**: this is the FIRST double-letter release in the v86 line (`v86_a`…`v86_z` used up all
26 single letters). Mirrors the `v81_z` → `v81_aa` precedent from the v81 line; the
`SESSION_PROMPT_v*.md` filename regex in `unit-roadmap-version.test.js` already accepts `[a-z]+` from
that earlier fix, so no test change was needed here.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_aa`) for the full design/verification; `v86_v`-`v86_z` if you need the rest
   of the comic review-card/retranslate/flags/static-docs history this session built.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and needs another catch-up pass
   (last done through `v86_x`) — the `v86_z`/`v86_aa` additions are not in there either.

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
The full v86_z-cut suite ran clean with ZERO flakes (all four named ones included) immediately before
this cut's own commit — a useful data point if one of them flares up again, not proof they're gone.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 713 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server generates content concurrently —
re-measure fresh at commit time if `unit-roadmap-version` disagrees; already dropped from 338/99 to
336/97 once between this cut starting and its own commit). No new `en` keys, no client or
static-build CODE change this cut (the fix is entirely inside the CP2 model prompt in
`canonical-analysis.js`) — `docs/index.html` WAS rebuilt anyway, purely to catch up to the live
`lessons.json` drift above (still 7 baked inputs, unchanged from `v86_z`).
`lessons.json`/`canonical-analysis.json` untouched by this cut's own edits (the `lessons.json` diff is
100% the user's own concurrent live usage). `APP_VERSION = 'v86_aa'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_aa` cuts — see those releases' own sections for the reasoning)

1. **A field with no explicit language instruction in a multilingual prompt defaults to English** —
   not a hypothesis, a confirmed, reproducible pattern across THREE separate incidents now
   (`_comicExtractPrompt`'s capitalization fix, `PROMPTS.inflections`'s `formLabel` precedent, and
   this cut's own CP2 `"form"` fix). When adding a new field to any multilingual prompt, ask
   explicitly which language it must be written in and say so in the instruction — do not assume the
   model infers it from sibling fields that DO say so.
2. **A worked example that hardcodes ONE language recreates the bug it was meant to illustrate, for
   every OTHER language the prompt serves** — removing an ungeneralizable literal example is often
   the right fix, not translating it into one more language that still leaves everyone else broken.
3. **When a scarce, already-cached artifact's PROMPT changes, say plainly that the cache is now
   stale** rather than silently re-running it (CP2 is minutes per sentence) or implying the fix is
   retroactive.
4. **A live-usage report on a feature shipped THIS SAME SESSION is not noise — it means the feature
   is finally being exercised for real.** `v86_z` shipped the static text explorer; the very next
   message was a real bug found by actually using it.
5. **Mutation-test every guard you write or rely on.**
6. **A double-letter release-naming rollover (`v86_z` → `v86_aa`) needs no code change if a PRIOR
   line's rollover (`v81_z` → `v81_aa`) already generalized the regex** — checked before assuming a
   new fix was needed, per the "don't hardcode a specific roadmap filename" spirit in CLAUDE.md.

# WHERE TO START

- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_aa`'s own additions added —
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
  before this cut's own fix — re-analysing them (via the existing 🔤 curator batch trigger, or a
  chapter's own first 🔍 open) would pick up the corrected, source-language-localized labels. Not
  done automatically this cut (CP2 is minutes per sentence per chapter).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last full pass through `v86_x`); other sections are kept current inline as
each cut touches them.
