# Session prompt — written at the `v86_ag` cut

**This is the LAST session prompt in the `v86` line — the user asked to cut to `v87` right after this
release.** If you're reading this, check `roadmap_v87.md` first; it may already exist and supersede
this file entirely (the same way this line's own `roadmap_v86.md` superseded `roadmap_v85.md`).

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_ag`**. `v86_af` built the
"direct relatives" distractor rule. This cut (`v86_ag`) tried the obvious follow-up fix, live-tested
it, found it didn't work, and reconsidered the diagnosis itself rather than guessing a third time.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. `prompts.json`
HOT-RELOADS live via `fs.watch` — no server restart needed after editing it.

**What shipped this cut (`v86_ag`)**:

Item P's own residual (recorded doc-only, just before this cut): `v86_af`'s "direct relatives" rule
still allowed `"Infinitief"` as a wrong choice against a combined tense+person correct answer, three
times in one real generation. Added a SECOND worked item (combined-dimension, tense+person) to both
`PROMPTS.inflections.examples.default` and `.de` — a genuine documentation improvement on its own
terms. Live-tested AGAIN against the real reported input (`tp_17880367188140000070`) — `"Infinitief"`
STILL appeared, byte-for-byte the same failure. Two separate live-tested prompt-reinforcement
attempts on this SAME prompt (`v86_ab`'s `{S}`-language fix, item AJ; this cut's combined-dimension
example) have now BOTH measured zero effect.

**Reconsidered the diagnosis rather than trying a third guess**: the original "datief" report was a
distractor naming a category that DOES NOT EXIST for that word class in that language (Dutch nouns
have zero case marking). `"Infinitief"` for a Dutch VERB is different — infinitive-vs-conjugated is
a real, common, pedagogically useful distinction, not linguistically nonsensical. The "direct
relatives only" rule, generalized from the noun-case incident, may be OVER-STRICT for verb mood/
finiteness specifically. Recorded as a genuinely open product/pedagogy question in item P
(`roadmap_v86.md`) — NOT resolved by guessing, and NOT chased with a third live-model cycle without
a decision first.

## Orient yourself, in this order

1. **This file**, whole — but check for `roadmap_v87.md` FIRST; this whole v86 line may already be
   superseded.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first (if
   still the current file). This cut's own section (`v86_ag`) plus `v86_z`-`v86_af` for the rest of
   this session's whole text-explorer/prompt-compliance/re-analyze/lesson-set-card history.
3. `INTERNALS.md` **§6b** is current through `v86_af` for item W's whole CP1/CP2 browser-integration
   surface (caught up THIS session); the comic-panel subsystem's own row is current through `v86_x`.

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
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness). Don't run the
full and `--quick` suites CONCURRENTLY on this box (found at `v86_ae`) — it produced one spurious
contention failure in an otherwise rock-solid test; run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 714 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). No new `en` keys this cut. `docs/index.html` rebuilt (`APP_VERSION` bump only —
`prompts.json` is server-side-only, not a static-build input).
`lessons.json`/`canonical-analysis.json`/`ui.json` unchanged since `v86_af`. `APP_VERSION = 'v86_ag'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_ag` cuts — see those releases' own sections for the reasoning)

1. **A worked example is a documentation artefact, not proof of model behaviour** — the
   combined-dimension example this cut added is correct and worth keeping on its own terms
   (internal consistency, teaches the shape correctly), completely independent of whether it changed
   what the real model actually does. Don't conflate "the example is right" with "the model now
   complies" — test each claim separately, as this cut's own write-up does.
2. **Two failed live-tested fixes for the SAME underlying pattern is a strong signal to reconsider
   the DIAGNOSIS, not just try a third wording** — `{S}`-language compliance and dimension-purity
   both resisted textual reinforcement. When reinforcement measurably fails twice, ask whether the
   RULE itself is right before assuming the WORDING needs to be stronger again.
3. **Not every "distractor from a different category" is the same class of bug** — a category that
   does not exist AT ALL for a word class/language (case for Dutch nouns) is categorically different
   from a category that DOES exist and is pedagogically relevant (infinitive for verbs), even though
   both look like "mixing dimensions" on the surface. Re-examine the ORIGINAL report's own specifics
   before generalizing a fix to a broader class of cases.
4. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **Item P's open pedagogy question (`roadmap_v86.md`)**: should infinitive-vs-conjugated count as a
  permitted distractor axis for VERBS specifically, distinct from case (genuinely absent for some
  languages)? Needs a product/pedagogy decision, not more prompt engineering — two live-model cycles
  have already failed to move this via wording alone.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card (`v86_ac`/`v86_ad`) does. Not requested; a quick, well-precedented follow-up if
  wanted.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **The wizard-page alternative for the review card** — explicitly NOT chosen at `v86_x`; revisit
  only if asked specifically.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed).
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P (the ORIGINAL live-model-check-needed items, not this cut's own P)** — needs a live-model
  check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_af` for item W's whole
CP1/CP2 browser-integration surface (caught up this session); the comic-panel subsystem's own row is
current through `v86_x`; other sections are kept current inline as each cut touches them.
