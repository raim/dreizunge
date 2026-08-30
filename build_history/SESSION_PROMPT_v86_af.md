# Session prompt — written at the `v86_af` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_ag`, `v86_ah`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_af`**. `v86_ae` silenced
`inflection_lemma`'s answer-reveal. `v86_af` built the "direct relatives" refinement — and surfaced a
bigger `{S}`-language-compliance problem while doing it, which has SINCE been fully investigated
(a live-tested prompt reinforcement, a comparative analysis against a working case, and an explicit
user ruling to leave it as-is) and recorded as item AJ in `roadmap_v86.md`'s own "OPEN AT THE v86
CUT" section — nothing pending there, no code change needed unless asked to build the recorded
"translate layer" option.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.

**A real Ollama backend IS reachable in this sandbox** — confirmed at `v86_ad`. It just takes several
seconds to answer a COLD `/api/info` call. `prompts.json` HOT-RELOADS live via `fs.watch` (confirmed
at this cut) — no server restart is ever needed after editing it.

**What shipped this cut (`v86_af`)**:

The user's own refinement of the `v86_ab` "datief" report: *"perhaps we should note in the roadmap
whether to decide to only ask for direct relatives of the asked form. for example for plural the
only alternative wrong option is singular."* `PROMPTS.inflections`'s `formChoices` instruction now
states this explicitly (wrong choices must stay on the SAME grammatical axis as the correct answer,
never introduce a different one even if real for the language), and both worked examples (`default`,
`de`) were fixed to comply — the same "worked example contradicts its own instruction" bug class
fixed twice already this session.

**A NEW, still-OPEN finding, surfaced while investigating**: the user corrected their own earlier
`v86_ae` report — *"the lemmas where readin the correct voice, but the grammar labels were in dutch
but read in german, e.g. Tegenwoordige tijd, derde persoon enkelvoud."* The REAL generated lesson
data (`ls_1788092767813`, generated hours after `v86_ab`'s fix, confirmed NOT a stale-server issue —
`prompts.json` hot-reloads) shows `title`/`desc`/`formLabel`/`formChoices`/`explanation` ALL in DUTCH
instead of German — every `{S}`-designated field except `translation`. `v86_ab`'s fix (making the
example internally consistent) was evidently NOT a strong enough signal for this real model
(`qwen3.6:35b-a3b`) against this much target-language-dominated surrounding context. `v86_ae`'s own
fix stays (harmless, independently defensible) but did not address the real symptom — the lemma
readout was never actually broken. **NOT fixed. The user was asked whether to proceed with a
stronger prompt reinforcement + a live-model test (each real generation ~5-6 minutes) — check for
their answer before doing anything else with `prompts.json`'s inflections instructions.**

## Orient yourself, in this order

1. **This file**, whole — especially "WHERE TO START" below.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_af`) plus `v86_z`-`v86_ae` for the rest of this session's whole text-
   explorer/prompt-compliance/re-analyze/lesson-set-card history.
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
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness). Don't run the
full and `--quick` suites CONCURRENTLY on this box (found at `v86_ae`) — it produced one spurious
contention failure in an otherwise rock-solid, unrelated test; run them one at a time.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 714 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). No new `en` keys this cut. `docs/index.html` rebuilt (`APP_VERSION` bump only —
`prompts.json` is server-side-only, not a static-build input).
`lessons.json`/`canonical-analysis.json`/`ui.json` unchanged since `v86_ae`. `APP_VERSION = 'v86_af'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_af` cuts — see those releases' own sections for the reasoning)

1. **A worked-example fix (making it internally consistent) is necessary but NOT ALWAYS sufficient
   to steer a real model** — `v86_ab` fixed the example's own contradiction, and the real model
   STILL produced the wrong language for most `{S}`-designated fields on a real generation. One
   example against an otherwise target-language-dominated prompt may be too weak a signal; verify
   against the REAL model on the REAL reported input before declaring a prompt fix complete, not
   just against the example's own internal consistency.
2. **A user's own follow-up correction ("that may have been a misunderstanding") can mean an EARLIER
   fix this same session solved a DIFFERENT problem than the one actually reported** — `v86_ae`'s
   silence fix is still defensible on its own merits, but it was NOT the real report's fix. Don't
   assume a shipped, tested fix closes a report just because it touches the same feature area —
   confirm the SPECIFIC symptom described.
3. **Before assuming a live-model report is caused by a stale/unreloaded server, check whether the
   relevant file actually hot-reloads** — `prompts.json` does (`fs.watch`, confirmed this cut, ~100ms
   debounce), which ruled out that hypothesis immediately rather than after an unnecessary
   restart-and-ask round trip.
4. **When a prompt fix needs live-model verification and each real call costs real minutes, ASK
   before spending that time** — the user was asked explicitly whether to proceed with the stronger
   fix + live test, rather than assumed.
5. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **RESOLVED, without a code change — item AJ in `roadmap_v86.md`'s own "OPEN AT THE v86 CUT"
  section**: the stronger prompt reinforcement WAS tried and live-tested against the real reported
  input — it made NO difference (identical Dutch output for every `{S}`-designated field). A
  comparative analysis against a WORKING case (`tp_17877511606660000499`, it→en, where `{S}`=English
  complies perfectly even with the OLD, weaker prompt wording) is recorded in full there, along with
  a working hypothesis (English is this model's own default meta-commentary language; the
  instruction only visibly "works" when it's redundant with that default) and a recorded-not-built
  "translate layer" option (a second, translation-framed LLM call). **The user's own ruling**: leave
  it — target-language grammar labels are pedagogically defensible, not just a tolerated bug. Nothing
  further needed here unless a future session is explicitly asked to build the translate layer.
- **A possible follow-up refinement, NOT built**: the "direct relatives" rule (`v86_af`, this cut)
  applies to `formChoices` only — check whether `lemmaChoices`' own wrong-choice generation has any
  analogous implausibility issue, not investigated yet.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card (`v86_ac`/`v86_ad`) does. Not requested; a quick, well-precedented follow-up if
  wanted.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_af`'s own additions added —
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
