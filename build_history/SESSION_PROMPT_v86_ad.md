# Session prompt — written at the `v86_ad` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_ae`, `v86_af`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_ad`**. `v86_ac` gave the
library-list row's own 🔤 button a force-regenerate confirm flow. This cut (`v86_ad`) is a FOURTH
distinct UI surface finally getting flags + a real text explorer.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.

**What shipped this cut (`v86_ad`)**:

Three rounds of "which card do you mean" before landing on the real request: *"i don't really see
the lesson-set card's 🔤 button that now doubles as 're-analyze'"* → the library row's own button
(the real `v86_ac` target) works fine → *"but the re-analyze works for the button on the storyline
card"* → narrowed to the completion/progress card (`_renderCompStory`), which had 🔍 but no force-
regenerate → a speculative fix was drafted there, then REVERTED once the user's actual, final
clarification arrived: *"i meant the lesson-set card that is only visible in teacher mode, it's text
display should also have language flags and text-analysis buttons."* That is `#story-section` ("📖
Read the story") inside the `#lesson-set` screen — teachers land there (`v60`'s own routing; learners
skip it entirely), and its own 🔍 is `story-qc-btn` (QC proofreading), unrelated to text analysis.

Built with the user's explicit choice of FULL PARITY (asked via a scoping question, not assumed):
`renderStoryText(d, targetEl)` itself gained the flags/explorer logic — every one of its 6 real call
sites always targets the SAME `#story-body`, so one function stays the shared source of truth rather
than adding a second wrapper only some callers would use. Reuses the exact same
`_storyFlagButtonsHtml`/CP1-CP2 cache machinery the completion card already uses (already generic:
chapter-id-keyed data, a plain HTML string return, no DOM-id assumptions), under a SEPARATE
`APP._lsStoryLang`/`APP._lsTextExplorer` state pair — a teacher can have both this card and a
student-preview of the completion card open in different senses without one flipping the other.
Replicates `v86_y`'s own flags/explorer mutual-exclusivity fix here too. New icon `🔬` for the
explorer toggle (🔍 and 🔎 both already taken on this exact row); the existing `v86_ac` confirm/force
flow is reused verbatim for the regenerate control.

**Live-verified against a REAL Ollama backend** — an isolated scratch server confirmed the whole
flow end-to-end, including a genuine `POST /api/analyze-chapter` job actually firing against the
real model. This also corrected `v86_ac`'s own mistaken claim that no backend was reachable in this
sandbox — one is, a first check there was just too impatient for a cold `/api/info` response.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_ad`) plus `v86_z`-`v86_ac` for the rest of this session's whole text-
   explorer/prompt-compliance/re-analyze history.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and needs another catch-up pass
   (last done through `v86_x`) — everything from `v86_z` onward is not in there either.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 299 checks
node test/run.js --quick                  → expect 256
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked once in earlier cuts THIS session too, all
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness).

**A real Ollama backend IS reachable in this sandbox** — confirmed at this cut (corrects `v86_ac`'s
own mistaken claim). It just takes several seconds to answer a COLD `/api/info` call — wait, don't
assume `canGenerate:false` from an impatient first check.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 714 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). No new `en` keys this cut. `docs/index.html` rebuilt (client code change).
`lessons.json`/`canonical-analysis.json` drifted further from live concurrent usage during this cut
(the user's own re-analysis testing of `tp_17880367188140000070`, plus their `ui.json` translation
work) — re-measured fresh at commit time, corpus counts unchanged at 336/97 despite the file-level
drift.
`APP_VERSION = 'v86_ad'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_ad` cuts — see those releases' own sections for the reasoning)

1. **"The lesson-set card" and similar terms can refer to MULTIPLE distinct UI surfaces in this app**
   — this cut took three clarifying rounds to find the right one (library row → completion card →
   `#story-section`). When a user names a card/screen you haven't just built or read, verify which
   ONE by reading the actual markup/state gating before assuming — don't guess from a plausible-
   sounding function name.
2. **A speculative fix built on a guess should be REVERTED, not kept "as a bonus," once the real
   target is confirmed** — the completion-card addition was undone cleanly before shipping; keeping
   untested, unrequested surface area in a release just because it's "probably fine" is scope creep.
3. **When a shared rendering function has EXACTLY ONE real calling pattern across every call site**
   (here: `renderStoryText` always targets the default `#story-body`), bake new logic directly into
   it rather than adding a parallel wrapper only some callers would remember to use — checked by
   actually grepping every call site first, not assumed.
4. **A `confirm()` before this session's own environment check was WRONG about backend reachability
   — verify infrastructure claims (canGenerate, backend up/down) with a patient check before stating
   them in a roadmap entry**, and correct the record plainly when a later check contradicts an
   earlier one, rather than leaving the wrong claim standing.
5. **A live browser click-through against a REAL backend is worth doing when one is actually
   available** — it caught nothing THIS time (the mutation-tested units already had it right), but it
   also surfaced the wrong "no backend" claim from the previous cut, which a unit-test-only pass
   never would have.
6. **Mutation-test every guard you write or rely on** — this cut's own fixture bug (a token missing
   `surface`, silently rendering as if absent) was caught BECAUSE the test asserted on the real
   rendered marks, not a shape/count.

# WHERE TO START

- **A possible follow-up refinement, NOT built**, from the "datief" report at `v86_ab`: constrain
  inflection wrong-choice generation to DIRECT RELATIVES of the asked dimension — e.g. for a
  `"plural"` item, the only genuinely meaningful wrong choice is `"singular"`. Needs a product
  decision on scope before any prompt change ships.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card (`v86_ad`) and the library row (`v86_ac`) do. Not requested; a quick, well-
  precedented follow-up (the exact code drafted and reverted this cut) if wanted.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_ad`'s own additions added —
  cheap, doc-only, keeps accumulating faster than it gets caught up (last full pass through `v86_x`).
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

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last full pass through `v86_x`); other sections are kept current inline as
each cut touches them.
