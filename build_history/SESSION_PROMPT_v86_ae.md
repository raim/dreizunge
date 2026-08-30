# Session prompt — written at the `v86_ae` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_af`, `v86_ag`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_ae`**. `v86_ad` gave the
lesson-set card's own story display flags + a real text explorer. This cut (`v86_ae`) is a TTS
voice-mismatch bug in `inflection_lemma`'s answer-reveal.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.

**A real Ollama backend IS reachable in this sandbox** (confirmed at `v86_ad`, corrected an earlier
`v86_ac` claim) — it just takes several seconds to answer a COLD `/api/info` call.

**What shipped this cut (`v86_ae`)**:

User: *"I generated a new inflection class lesson `ls_1788092767813` for `tp_17880367188140000070`,
but the answer in Dutch is still readout with the German voice. Is it possible to just issue the
correct word form in German? That may be difficult for some languages, though. Please do as you
think works best. If it's difficult, we could also just omit the readout."* Also confirmed: `v86_aa`'s
CP2 `"form"` fix works after re-analysis.

Traced end to end: `check()`'s `inflection_lemma` answer-reveal already correctly resolves to the
TARGET-language voice (its own answer genuinely IS target-language text) — that IS the designed,
tested behaviour (`unit-inflection-speak-lang`'s own pre-existing regression guard proved it). The
bug is that a voice can CLAIM to match a requested language (passing `_ttsMakeUtterance`'s own filter
honestly) without actually being a reliable, correctly-accented voice for it on a given device/
browser — a real TTS-engine limitation this app's own "refuse rather than approximate" policy cannot
detect, since it only refuses when NO voice claims to match at all.

Fix, per the user's own explicit fallback: `inflection_lemma`'s answer-reveal now speaks NOTHING
(still auto-advances) rather than attempting a source-language substitution — rejected as needing a
clean single-word source-language equivalent that doesn't reliably exist (`explanation` is a full
sentence, not a word). `inflection_form` is completely unchanged. The test file's own former
regression guard (asserting the OPPOSITE — that `inflection_lemma` keeps speaking) was replaced, not
extended, since this cut intentionally reverses that behaviour.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_ae`) plus `v86_z`-`v86_ad` for the rest of this session's whole text-
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
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness). **NEW at this
cut**: running the FULL and `--quick` suites CONCURRENTLY (two `node test/run.js` processes at once,
on this same box) produced ONE spurious failure in a test that is rock-solid standalone
(`unit-story-translation-toggle`) — resource contention between two full suite runs, not a real
flake tied to that test specifically. Don't run full+quick concurrently if avoidable; if a failure
only shows up that way, re-run the ONE affected test standalone before treating it as real.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 714 `en` keys** — an inherently live
snapshot (the user's own live server generates content concurrently; re-measure fresh at commit
time). No new `en` keys this cut. `docs/index.html` rebuilt (client code change).
`lessons.json`/`canonical-analysis.json`/`ui.json` unchanged since `v86_ad`'s own commit.
`APP_VERSION = 'v86_ae'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_ae` cuts — see those releases' own sections for the reasoning)

1. **A voice CLAIMING to match a requested language tag is not the same as it actually sounding
   right** — `_ttsMakeUtterance`'s "refuse rather than approximate" policy only catches the case
   where NO voice claims to match; a voice that lies (or is simply a poor-quality match) about its
   own language passes that check and still sounds wrong. This is a real, currently-undetectable-by-
   code limitation for any BARE, isolated word readout in an arbitrary target language.
2. **When a "fix pronunciation" ask turns out to need per-language data that doesn't reliably exist
   (a clean single-word source-language equivalent, here), the user's own offered fallback
   ("just omit it") is often the right call — don't over-build a fragile partial solution when a
   plain, honest silence is available and was explicitly pre-approved.**
3. **A test asserting the OLD, now-intentionally-reversed behaviour must be REPLACED, not left
   standing next to a new contradicting one** — `unit-inflection-speak-lang`'s former §3 asserted
   exactly what this cut undoes; extending instead of replacing would have shipped a self-
   contradicting test suite.
4. **Don't run the full and `--quick` suites concurrently on the same box** — found this cut when it
   produced one spurious failure in an otherwise rock-solid test. Sequential (or one at a time) is
   slower but avoids resource-contention false positives.
5. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **A possible follow-up refinement, NOT built**, from the "datief" report at `v86_ab`: constrain
  inflection wrong-choice generation to DIRECT RELATIVES of the asked dimension. Needs a product
  decision on scope before any prompt change ships. (An in-progress DRAFT of this exists in the
  working tree's own `prompts.json` diff at the time this file was written — check `git status` /
  `git diff prompts.json` before assuming it's untouched; it may need finishing or discarding.)
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card (`v86_ac`/`v86_ad`) does. Not requested; a quick, well-precedented follow-up if
  wanted.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_ae`'s own additions added —
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
