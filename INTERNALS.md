# Dreizunge — internals

The engineering counterpart to `DOCUMENTATION.md`. That file explains what the app *does* — the
three layers, how to generate, the feedback loop. This one records **what is true about the code
right now**: the constants worth tuning, the ways things fail silently, the invariants that look
like implementation details but are load-bearing, and the limits of the test harness.

**Read this instead of grepping the session notes.** The notes in `build_history/` are the
narrative record of *why* each decision was made and stay authoritative for that. This is the
reference for *what holds now*. Where the two disagree, the code wins and this file is stale —
please fix it.

Every entry below was found by measurement or by a test failing, not by reading anything. That is
the gap this document exists to close.

Last verified against **`v79_j`**.

---

## 1. Tuning knobs

| Constant | Where | Value | What it buys |
|---|---|---|---|
| `NUM_CTX_MAX` | `llm.js` | 16384 (env `OLLAMA_NUM_CTX_MAX`) | Context-window ceiling. See §1.1 |
| `OLLAMA_TIMEOUT` | `llm.js` | 720000 (12 min; env `OLLAMA_TIMEOUT`) | Base request timeout, clamped 30 s–60 min |
| `CHAIN_STORY_CHARS` | `server.js` | 40000 | Chain-story budget for comprehension AND, since `v79_b`, for the story prompt when `useFullChain` is set |
| `OLLAMA_MAX_PREV_STORY` | `server.js` | 800 (env) | Tail of the previous chapter fed to the story prompt when `useFullChain` is OFF. 54% of corpus continuations have a parent shorter than this, so for them the checkbox changes nothing either way |
| `THINK_TOKEN_MULT` / `THINK_TIMEOUT_MULT` | `server.js` | 2.5 / 3 | Applied when a role's reasoning is ON |
| `THINK_MIN_TOKENS` | `server.js` | 3000 | Floor for a thinking call's token budget |
| lesson token base | `server.js` | 3200 | Passed to `callLLMLesson`; ×2.5 when thinking |
| `MIXED_ROUND_CAP` | `index.html` | 30 | Max questions in one mixed sitting |
| `FAMILIAR_SHARE` | `index.html` | 0.15 | Share of a round spent on already-solved material |
| builder cap | `index.html` | 14 | Grammar/conjugation round size |
| coverage target | `index.html` | 0.8 default | Overridable per topic, per storyline, or globally |
| `NEEDED` / `CAP` | `index.html` | 15 / 120 | Qid-universe convergence: stop after 15 stable rounds, never exceed 120 |

### 1.1 `NUM_CTX_MAX` — the one with a real cost

`num_ctx` is how many tokens the model holds at once, **prompt and reply together**.

The comprehension call reserves ~8,000 tokens for the reply plus headroom; everything left is
story:

| ceiling | story chars that reach the model |
|---|---|
| (pre-`v71_t`) | 6,000 — hard cap |
| **16384** (default) | **~24,000** |
| 32768 | ~76,000 — exceeds `CHAIN_STORY_CHARS`, so nothing is trimmed for context reasons |

For scale, the longest chain in the bundled corpus is 46,758 chars (14 chapters).

**The cost is memory.** The KV cache scales linearly with context. Rough figures for an 8B-class
model at fp16 — *varies a lot by model size and quantization, treat as an order of magnitude*:
4096 ≈ 0.5 GB, 16384 ≈ 2 GB, 32768 ≈ 4 GB. That sits on top of the weights (~5 GB for an 8B at Q4).

Mitigations already in place: `num_ctx` is sent **only when a caller passes `opts.ctxTokens`**, and
only `generateComprehension` and — since `v79_b` — the story call do. Every other call keeps
Ollama's default and its existing memory profile.

**`v79_b`'s story call asks for a window only when it needs one.** The chain is fed when the
storyline behind a continuation is longer than one chapter; a single parent takes the old path and
reserves nothing. That matters because of the caveat below: the fewer calls that alternate between
sizes, the less often a reload can be provoked. Corpus scale, measured at the v79 cut over 236
continuations: parent chapter median 671 chars (max 4,691, ~3,203 estimated tokens — always under
the ~4096 default), whole storyline median 3,297, p90 8,021 (~4,244 tokens, OVER the default) and
max 43,312. So the sizing is not defensive: the chain crosses the default at the 90th percentile.

**Unverified caveat.** Ollama keys its loaded model instance partly on load-time options, and
`num_ctx` is one of them — so alternating between large-context and default calls *may* force a
reload. Not measured (no live Ollama in the dev container). If comprehension generation is slow to
*start* while other types are fine, suspect this first.

---

## 2. Silent failure modes

The dangerous class: things that produce a plausible result while doing the wrong thing. Nothing
throws, no test necessarily fails, and the output looks fine.

**A data drop can leave `docs/` behind the live corpus, and the FIXERS hide it (`v78_b`).** Both
data-sensitive guards (`unit-static-freshness`, `unit-script-choice`) have a documented one-line
remedy, and running it is what destroys the evidence about whether the remedy was right. At the
`v78_b` baseline both were red with the corpus counts UNCHANGED (308/86) and `lessons.json` the
OLDEST file in the tree — so no fixer had run, and the shipped data was the user's newer working
file. Diffing the corpus baked into `docs/index.html` against disk showed **7 topics carrying an
`ai_error_hunt` lesson the published build lacked** (story-QC acceptance had added them after the
build). **Order is part of the fix: `backfill-script.js --write` FIRST, `build-static.js` SECOND** —
rebuilding first bakes the unstamped corpus and overwrites the last copy of the previous baked
state. Diff baked-vs-disk before rebuilding, so a rebuild cannot lose user content.

**One rule for "clear this chapter's progress", and it has been copied twice (`v78_e`).** The stores
that can answer *"is this chapter done"* are `completed`, `solved`, **`chapterDone`** (the cached
completeness STAMP `chapterComplete` trusts ahead of the flags) and `storyShown`. Missing the stamp
is the `v77_s` defect: the chapter still reads "finished" after a wipe, later chapters stay unlocked
and the storyline bar stays green with nothing played. **`_clearChapterProgress(topicKey)` is the
single reader of that list**; `slBottomClearProgress` loops over it, `clearThisChapterProgress`
(the card's 🧹) calls it for the current chapter, and `clearLessonProgress` — which was a THIRD copy
still carrying the `v77_s` defect until `v78_e` — now routes through it. Adding a new completeness
store means adding it HERE, and `unit-chapter-clear-progress` §3 asserts the entry points agree by
diffing their resulting state rather than checking each alone.

**"Which scripts can this language be written in" is not "which script is this pair written in"
(`v78_g`).** `scriptsForLang(code)` answers the first. Every script gate must ask the second, via
**`_scriptSideOf(langCode, chosen)`**, passing the per-topic `script` / `srcScript` stamped since
`v76_g`/`v76_h`. Getting this wrong is invisible for every monoscript language — the two answers
coincide — and wrong only for the languages in `scripts.json` `_scriptChoice` (`["sr"]`), where it
made a Serbian-Latin → Serbian-Cyrillic storyline report that the learner needed no alphabet.
**Gate and BUILDER must narrow identically**: `needsIntroScript` narrowing while
`buildArcIntroLessons` still walked `scriptsForLang(lang)` passes the gate and then skips every
script in the loop, returning `[]` with no error. Both functions exist in **two copies** (server +
client) and are asserted byte-identical.

**Naming the script inside the language name is NOT enough — every target-text prompt needs the PIN
(`v76_h`, completed `v79_a`).** `langName(lang, script)` yields "Serbian (written in Cyrillic
script)", and the model still drifts between scripts inside one text. `v76_h` added the explicit
rule (`PROMPTS.story.scriptNote`) to the STORY prompt and left the three LESSON prompt builders with
the name alone. The corpus shows exactly the predicted result: `tp_17863746762340000193` has a story
in pure Cyrillic and vocabulary whose TARGET words are Latin — **a Cyrillic chapter teaching Latin
words, so nothing the learner studied could ever be highlighted in the text they were reading.**
`scriptPinNote(lang, script, role)` is the one place that rule lives, and **all fourteen
target-text prompts append it** (`v79_f`): the three vocabulary builders, the story, error-hunt,
grammar, conjugation, word-forms, synonyms, comprehension, LLM math, story QC, and both dialect
generators. `sysStory` used to carry an inline COPY of the rule — written first, left behind when
the helper was extracted — and that duplication is why the lesson prompts ended up with a weaker
version of it. There is one now.

**`v79_a` claimed to close this and covered three prompts of fourteen.** Four releases later
`tp_17864554460460000107`, a `cyrillic-sr` chapter, got a conjugation lesson entirely in Latin. The
lesson is that the pin is TWO facts, not one, and each can fail alone:

1. **the prompt appends the pin** — guarded by `unit-script-pin-coverage`, which SWEEPS every
   `sys*`/`generate*` function out of the source and requires each to be classified as needing the
   pin, delegating to one that does, or exempt with a stated reason. A new lesson type fails that
   test until someone decides which side it is on, because a new lesson type is exactly the event
   that reintroduced this bug.
2. **the script REACHES the prompt** — of the three `sharedGenOpts` shapes, only the arc path
   carried it before `v79_f`; the add-lessons and re-create-storyline-lessons paths were blind for
   every lesson type no matter how many prompts carried the pin. Every construction site is now
   asserted to include a `script`.

**`unit-script-choice` cannot see this class of bug.** `backfill-script.js` compares a chapter's
STORY against its VOCABULARY, so a conjugation table, synonyms list or comprehension question in the
wrong script leaves it green. Read a passing run as "no chapter's story and vocabulary disagree",
never as "no chapter mixes scripts".

**Since `v79_f` every pinned prompt logs which of the two failures happened** —
`[script] conjugation prompt pinned to Cyrillic for sr`, or a WARNING when a digraphic language
reaches a prompt with no script. That line separates "the script never arrived" from "the model was
told and ignored it": two different bugs with one identical symptom, and the reason the first report
was mis-diagnosed twice.

**Ollama truncates an over-long prompt with no error.** Default `num_ctx` is ~4096. Exceed it and
the request still succeeds — the model just answers from whatever fragment survived. This is why
`v71_t` had to add context sizing *before* removing the story caps: deleting the app-side cap alone
would have moved trimming from our code (which keeps the current chapter whole) into Ollama's
(which cuts blindly and reports nothing). **Any change that makes a prompt bigger must size the
context window in the same commit.**

**~~OPEN DEFECT (`v77_s`)~~ — CLOSED at `v80_c`: this was a MISATTRIBUTION, not a defect.**
Measured across every state built in session 35: `_firstUnfinishedLessonIdx` returned the correct
index (the unplayed comprehension lesson) in all of them, and the named prime suspect
(`if (setComplete(d)) return -1;`) was never the exit taken. What actually goes to -1 is
`showComplete`'s **local** `nextLessonIdx`, set on purpose by the `v71_s` line
(`nextLessonIdx === C.lessonIdx && !C._review && _isStoryGatedLesson(lesson)`), so that Next cannot
silently mean "replay the lesson you just played". The learner then falls to the below-mark branch,
whose behaviour `unit-story-unlocked-page` §6 now pins. **`v77_s` did not cure this; there was
nothing to cure. Do not chase it again.** The original note follows, kept for the reasoning.

**OPEN DEFECT (`v77_s`) — `_firstUnfinishedLessonIdx` can return -1 with a lesson still unplayed.**
User-reported: the story was unlocked, a comprehension lesson had never been played, and Next was
greyed (pre-`v77_o`) / offered a replay. That state requires the helper to have returned -1, because
`showComplete` tries the `nextLessonIdx >= 0` branch FIRST — whenever it returns a lesson, that
lesson is what Next starts.

**Prime suspect, first line of the helper: `if (setComplete(d)) return -1;`.** If the chapter reads
COMPLETE, the helper stops looking, unplayed lessons and all. `setComplete`/`chapterComplete` will
trust a cached `chapterDone` STAMP ahead of the flags — and `v77_s` found that stamp surviving a
progress wipe, which is exactly how a chapter can read complete while its lessons are unplayed.
**So the `v77_s` wipe fix may already have cured this**; it has not been confirmed against the
user's data. If the symptom recurs, dump `APP.progress.chapterDone[topic]` alongside
`countedLessons(d).length` before anything calls `chapterComplete` — that reader RE-STAMPS as a side
effect, so inspect the stamp first or you will read a record your own check just wrote.

**`showComplete` computes `_storyDone` ~60 lines BELOW its Next wiring (`v77_f`).** Reading it at
the Next branch is a temporal-dead-zone `ReferenceError` on every terminal card — the `v68.1` bug in
the `v68.1` function. Both sites now call **`_storyAllChaptersDone(slCtx)`**, declared above
`showComplete`, rather than either reaching forward or re-deriving the rule inline: a second copy is
how the storyline page's connector line drifted in `v71_w`. It reads through `chapterComplete`, the
canonical completeness reader, so the card, the title and the storyline page cannot disagree. A solo
chapter has no storyline and is never "a story finished" by this rule.

**A handler declared inline in markup is not callable in the stub DOM (`v77_f`).** `onclick="f()"`
in the HTML never becomes a callable `.onclick` property, so a headless test cannot click it.
`comp-next` has always assigned its handler in JS; `fin-back`/`fin-out` follow it for the same
reason. Anything a test must exercise assigns in JS.

**`showComplete`'s seven `catch(_) {}` blocks swallowed everything (fixed `v77_b`).** A throw in any
of them left the card half-rendered with the whole suite green. They now report site and message to
a per-render ledger: **`_cardErrors()`** returns what this render swallowed, and **`APP._cardStrict
= true`** rethrows at the site. Default behaviour is unchanged — still swallowed, no longer
invisible. The dangerous one is `pass-mark-gate`: a throw there leaves `_belowThreshold = false`, so
a learner below the mark is treated as above it. Measured at the `v77_b` cut: **0 swallowed errors
across 1216 renders over all 304 topics**, so this is a net for future work rather than a live bug.
`unit-card-errors` asserts no empty `catch` survives in the function.

**A standard/vocab lesson has no `type` field.** It is the default shape. So `l.type === 'standard'`
is *always false*, and any assertion written that way is vacuous. Use `(l.type || 'standard')`. This
bit inside the very test written to catch a vacuous pass (`v71_u`).

**A new lesson type without a `fake-ollama` branch is skipped invisibly.** The arc loop deliberately
refuses to abandon a run for one failing type, so the omission looks like nothing happened.
`comprehension` shipped in `v71_l` and was untested end-to-end until `v71_u`. When adding a matcher,
place it **before** any looser one that could swallow it — `correctIndex` is shared by comprehension
and word_forms.

**`callLLMLesson` spreads the caller's opts AFTER its think policy.** So a caller passing
`timeoutMs` or `tokens` *overrides* the ×3 / ×2.5 that reasoning mode applies. "Raise the timeout"
is easy to write as a reduction — this happened during `v71_t` and was caught before shipping. If
you pass either, use the multiplier so it can only ever raise.

**A builder that caps is sampling.** Grammar and conjugation ended with `shuffle(exs).slice(0, 14)`,
which read as "deterministic" for two releases while cutting a complete pool at random — ~53% of
every replay re-asked solved questions (`v71_r`). "Deterministic" and "needs no coverage handling"
are different claims.

---

## 3. Invariants

Load-bearing rules that look like details. Breaking one usually produces a plausible-but-wrong
result rather than a crash.

**`_derivingUniverse` means: full set, no cap, no coverage bias.** When this flag is set a builder
must return *every* question it can produce. Grammar and conjugation ignored it until `v71_r`,
forcing the coverage denominator to be rediscovered by up to 120 re-derivations.

**A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the *last counted
lesson* so the vocab recap resolves. Nothing was answered. Anything that **judges** the learner —
records a done-flag, locks Next, counts an exposure — must be behind `!C._review`. Three separate
bugs from this shape (`v71_n`, `v71_s` twice).

**`collectChainStory` trims from the OLDEST end and keeps the current chapter whole.** Questions
are set on the chapter just read, so that text must survive. Any trim added elsewhere must preserve
this direction — the last-resort context fit in `generateComprehension` cuts from the front for
exactly this reason.

**A lesson has ONE phase, and everything else derives from it (`v74_b`).** `lessonPhase(L)` returns
`prep` or `post`; `_POST_STORY_TYPES` = `comprehension`, `error_hunt`, `ai_error_hunt`.
`_NEVER_POOLED` (= post ∪ `mixed`) and `_STORY_GATED_TYPES` (= post) are **derived**, not restated.
Before this the concept existed three times over and the copies disagreed: `_NEVER_POOLED` held the
complete set while `_STORY_GATED_TYPES` listed only `comprehension`, so **29 chapters gated the story
behind an error hunt** — a lesson that renders `corruptedStory`, a mangled copy of the very story
still locked. `mixed` is **prep**: it is not a lesson but an alternative way to play the prep lessons,
and letting it drift to post would strand every mixed-driven chapter. A new lesson type declares its
phase once, here, instead of being added to two tables and forgotten from a third.

**FIXED in v74_c — was: the coverage denominator depends on AUDIO STATE.** `_lessonQidUniverse`'s cache key carries
`'na'`/`'m'`/`'a'` (`index.html` ~13181), because listening exercises are not built when muted or
when no TTS voice matches — but the solved store is one flat map per topic. So solves earned in one
audio state are measured against a denominator derived in another. **284 of 298 topics** change
denominator; `Churros und Chaos` is 83 audible, 67 muted, 51 with no TTS voice. A learner who played
muted and then unmuted reads `64/83` — below the mark, Next locked, and unrecoverable, because the
16 missing questions are listening items a muted app never offers. `ttsVoiceAvailableFor` returns
`true` while voices are still loading, so the key can flip mid-session with no user action.
**Closed by `v74_c`: coverage counts SOURCE ITEMS (`_lessonItemUniverse`), read from `lessons.json`,
so no builder runs. Measured after: 0 of 298 topics drift with mute/TTS, and the denominator is
identical on every fresh derivation. `_lessonQidUniverse` still exists and is still audio-keyed —
it drives ROUND ASSEMBLY, which legitimately needs question identity. `markSolved` records both.**

**Coverage and round assembly use DISJOINT key spaces (`v74_c`, measured `v77_c`).** Coverage counts
SOURCE ITEMS (`_lessonItemUniverse`, keys `lessonId:i:hash`); round assembly keys QUESTIONS
(`_lessonQidUniverse`, keys `lessonId:type:hash`). Both live in the one flat `APP.progress.solved`
map per topic and cannot collide because of the `:i:` marker. **`markSolved` writes both** — the qid
for "which question to ask next", the item key for "what the learner knows". Measured on a
mixed-driven chapter: 61 qids, 24 items, **0 shared**. Consequence for anyone writing a probe:
seeding `_lessonQidUniverse` into `solved` moves coverage by exactly nothing, which is what produced
the "86 keys in, 0 counted, total 31" open question in `v76_card_gates.md` — a seeding artefact, not
a bug. Seed items, or better, drive `markSolved`. And note that **one round does not cover the
universe** (builders sample): coverage converges over several replays — 62→95→95→100, unlocking in 4
— which is `repeatForCoverage` working as designed, not a workaround. Guarded by
`unit-mixed-unlock-reachable`.

**Comprehension is gated BY the story, so it cannot gate it.** `storyUnlocked()` is the narrowed
gate (everything except story-gated types); `setComplete()` is the whole chapter. The circularity
was **two-layered** — the lesson list *and* the coverage denominator — and fixing only one leaves it
intact at any pass mark below 1.0 (`v71_s`).

**A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule that
refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
silently means "replay this".

**A storyline is ONE unit; the library language filter decides whether it is shown, not which of
its chapters it has (`v76_e`).** `loadSavedList` keeps two id indexes: `byId` (language-filtered,
for deciding what appears) and `byIdAll` (every topic, for resolving a chain). **Every chain-scoped
lookup must use `byIdAll`** — a chain may legitimately contain a chapter the current filter hides,
and `byId` reads it as missing. Before this, chains were projected through `byId` and then matched
back against `sl.chapters` by exact length and position, which a projected chain can never satisfy;
the renderer fell through to a synthetic `'c'+hash` chain id with no storyline object behind it, so
title, icon, storyboard and summary all vanished and the chapter count and deck payload were short.
Only mixed-language storylines are affected, which is why it survived: with every chapter in one
language pair the filter removes none of them and the exact match succeeds. Measured on the reported
data (`sl_9302163`, six chapters over `sr<-en` / `sr<-de` / `hr<-sr`) at `libFilter=sr`,
`libSrcFilter=all`: 5 of 6 chapters survived and the card was keyed `c1935658823`.
`build_history/probe_landing_v76e.js` re-runs the measurement.

**Identity is carried through a projection, never recovered by hashing it.** Third instance of this
shape. `v75_f`: a storyline rebuilt (losing its storyboard) because its stored id was not the hash
of its chapter list. `v76_e`: a storyline unrecognised because its chapter list was filtered before
it was matched. **If a list is filtered and then matched back against its source by length or
position, the filter and the match are the same bug waiting.** Related: the import dedup's
title-based tie-break still decides which copy of a duplicated chain survives on a non-content
signal — no longer reachable from the import path, but unfixed.

**Several scripts is not the same as a script CHOICE (`v76_g`).** `_langScript` lists more than one
script for both `sr` and `ja`, but Serbian is written in Cyrillic **or** Latin (a choice) while
Japanese mixes hiragana **and** katakana in one sentence (no choice). So
`scriptsForLang(x).length > 1` must NOT gate a script picker, a prompt instruction, or a stamp —
the gate is `scripts.json` `_scriptChoice`. Measured over target-language text per topic: `sr`
mixes its two scripts in **0 of 5** topics, `ja` in **9 of 13**. The declaration is tier 3; the
check on it is tier 2 (`unit-script-choice` §2 tests it against the corpus in both directions), so
a wrong entry fails loudly rather than silently offering a meaningless choice. Topics carry
`script` (target side) and `srcScript` (source side), stamped by `backfill-script.js` from Unicode
detection alone. **As of `v76_g` nothing READS these fields** — generation is still not told which
script to use, which is why the corpus split target→Latin, source→Cyrillic.

**Telling the model the script is one function (`v76_h`).** `langName(code, script)` is where every
prompt gets its `{L}`/`{S}`, so decorating the name there reaches all ~56 call sites without
threading a parameter. `script` is ignored unless `hasScriptChoice(code)`, and `_validScript()`
rejects anything not declared in `scripts.json` — the value goes into a prompt, so it is validated
rather than trusted. `prompts.json` `story.scriptNote` adds the consistency rule; naming the script
alone still lets the model drift between scripts inside one text. **`upsert()` REPLACES an entry
rather than merging**, so a field must be on the object `generate()` RETURNS, not only on its
mid-flight upsert — the final `upsert(data)` in the caller would otherwise drop it.

**The continue-story PIN (`v76_j`).** `APP.contPin` (persisted as `imp3_contpin`) fixes which story
is being continued. `repopulateContinueSelect` re-inserts the pinned topic when the language filters
would drop it, badges it with its language pair, and restores it in preference to the previous
value — so a mixed-language storyline, whose last chapter is in a different pair from the one the
form lands on, can be continued at all. **The cancel is wired to `onContinueSelectChange()`, NOT to
`_updateReinforcePriorVisibility()`**: the latter is also called programmatically at the end of
every rebuild, so a cancel placed there would let a rebuild cancel the pin it exists to restore.

**`makeParentResolver` is same-language guarded** (`index.html:1429` — returns `null` when the
parent's `lang` or `srcLang` differs). So any path that rebuilds a chain from `continuedFrom` links
rather than reading `storylines[]` **cannot reconstruct a mixed-language chain**. The v29
`storylines[]` path is what the app uses, so this is latent rather than live; the one reachable
consequence is that `_tryOpenStorylineByChainId`'s legacy fallback cannot resolve an old bookmark
carrying a pre-`v76_e` synthetic `c…` id for such a chain. Know it is there before touching chain
construction.

**Model output that quotes source text is verified, never trusted.** `v72_d`: `generateSynonyms`
asks the model to quote the story sentence it chose the synonyms against, and
`verbatimStorySentence` (server.js) checks the quote character-for-character against the story
(whitespace normalised) *and* that it contains the base word whole-word. Anything failing either
check falls back to `findContextSentence`, so the feature can only improve on the old path. The six
ways a model breaks a quote — paraphrase, translation, truncation with `…`, two sentences joined,
an irrelevant real quote, an invented one — each have a test. Apply the same shape to any future
"have the model cite the source" feature: the check is cheap, and an unverified quote shows the
learner text that is not in their story.

**Story context and `num_ctx` are one decision, made per call site.** `v72_f`. Two traps, both
silent, both measured rather than reasoned about:

- **A prompt carrying the whole story must pass `ctxTokens`.** Omitting it means Ollama's own
  default (~4096 tokens), and Ollama **truncates rather than failing** (`v71_t`) — the model answers
  from a fragment while every attempt reports success. Five generators embed the full story:
  `generateWordForms`, `generateSynonyms`, `generateComprehension`, `generateOneLesson`,
  `generateErrorHunt`. All five now size it. Error-hunt is the hungriest — it sends the story *and*
  asks for it back — and truncation there is uniquely misleading: the reply is a corrupted fragment,
  the length check rejects it, and all three retries burn reporting a word-count mismatch.
- **`prompts.json` is only half the picture.** Five prompts declare `{story}`; server.js
  interpolates `${story}` inline in **five more** places. A guard that reads only `prompts.json`
  sees half the problem and reports "all accounted for" — the first draft of
  `unit-generation-context.test.js` did exactly that. It now checks both, and pins the inline count.
- **The 1200-char vocab cap covers one of four branches.** `generateOneLesson` has four prompt
  branches; only the plain one slices to 1200. The table branch sends the whole story and the two
  own-text branches send the whole story *plus* its whole translation. Reading the comment on the
  capped branch and concluding "vocab is capped" is wrong.

**Grammar and conjugation are story-free ON PURPOSE** (ruled session 26). They receive 8 extracted
keywords, never the story. Gender, article, plural and verb paradigms are dictionary properties of a
word, so a passage cannot make the answer more correct — unlike a synonym, whose validity depends on
which sense the sentence picks out. Recorded because the shape looks exactly like the pre-`v72_d`
synonyms bug and will otherwise be "fixed" by a future session. `unit-generation-context.test.js`
asserts they do NOT embed the raw story.

**Only comprehension sees more than the current chapter.** It is the sole consumer of `chainStory`,
via five call paths. Four of them supplied it and `generate()` did not — while collecting chain
*vocab* two lines above — so the same lesson had one chapter of context when created with the
chapter and the whole storyline when added afterwards (measured: 749 chars against 4,139, a 5.5x
difference for identical output). Fixed in `v72_f`. The current chapter is not persisted at that
point, so `generate()` builds the same synthetic node the arc path does.

Chapter-only is *correct* for the rest, and for two of them it is now load-bearing:
`verbatimStorySentence` (synonyms) validates the model's quote against the current chapter, and
`validateWordFormsItems` requires items to be derived from it. Feeding either the chain would make
the model quote text that fails its own validation, every time, silently falling back.

**One rule per question.** Recurring failure mode: a second copy of a rule that then drifts.
Consolidated cases — `_itemWithheld` (had three spellings), `chapterComplete`, `_setCompleteRaw`
(narrowed by parameter, not duplicated), `_mixedSkips`, the storyline page's connector line and
progress-bar colour (`v71_w`), and `_sentenceSplit` (`v72_a` — the client's `_sentenceSplit` and the
server's `_synSplitSentences` were independently written and had **already** drifted: the server's
terminator list contained `。！？` and the client's did not, so the two halves of the synonym
pipeline disagreed about what a sentence is, with the *server* accidentally the more correct one.
Nothing failed. Now one implementation, byte-identical in both files, asserted by
`unit-sentence-segmentation.test.js`).

That last one is the clearest illustration of why this matters, because the two rules **diverged in
both directions** and nothing failed for two releases:

| case | shared `chapterComplete` | raw `every(ls => done[ls.id])` |
|---|---|---|
| mixed-driven chapter, all visible lessons done | `true` | `false` — too strict |
| every done-flag, coverage below the pass mark | `false` | `true` — too permissive |

The second row is the exact `v69_l` bug, still live on the storyline page long after it was fixed
for the gate. Both symptoms are quiet — a connector line or bar colour that lies about an unfinished
chapter is only visible in a browser.

**Corollary:** a progress *fraction* ("how much have you played") is a legitimately different
question from completeness and may stay a raw count — but any signal that asserts **finished**
(a colour, a lock, a tick) must read the shared rule.

---

## 4. Design principle — no language knowledge in the code

**Established session 23.** The code should not encode facts about particular human languages.
Producing correct language content is the model's job; instruct it in the prompt instead.

Where this bites, and why: a per-language table has to be written by whoever is editing the code,
and it is wrong in ways that are invisible until a native speaker looks. It also scales badly —
every new language needs an entry, and a missing entry fails silently rather than loudly.

**What counts as language knowledge (avoid):** article lists, gender rules, pronoun sets,
plural/inflection rules, "which languages use articles", sentence-final punctuation sets, anything
that decides whether content is *correct*.

**What does not (fine):** mechanical and typographic facts that decide how text is *handled* —
Unicode normalisation, script/RTL detection, which script a language is written in, diacritic
folding for comparison. These are properties of the encoding, not judgements about the language.

The line: **does this decide whether content is right, or only how it is displayed/compared?**

**Confirmed by the user, session 25**, with a condition worth stating separately: *permitted* means
**Unicode machinery**, not "any table I author myself". Sentence segmentation is handling and is
allowed — but a hand-written `[.!?…]` list is still the wrong tool, because it is a table someone
typed and it fails silently for scripts nobody thought about (it omits `。`). Reach for
`Intl.Segmenter`, `normalize()`, `Intl.Collator` and the like; a literal character class listing
punctuation per language is the smell.

### Where should language knowledge live? Four tiers

"Move the table to a JSON file" is not progress on its own — a file still has to be **authored** by
someone asserting a fact about a language they may not speak, is still wrong in ways invisible until
a native speaker looks, and still fails silently for any language missing an entry. The cost is in
authorship, not location. What a file *does* change is who can correct it: a native speaker can edit
JSON; nobody can reasonably ask them to edit a 15,000-line `index.html`.

In preference order:

1. **The model, at authoring time.** Instruct it in the prompt. Best where a model is in the path.
2. **Derived from what the model already produced.** Read the corpus rather than a table.
   `_articleChoicesFor` (`v71_x`) collects every article seen on any grammar item in that language.
   No authorship, self-correcting as the corpus grows, and — importantly — **works offline in the
   static build**, because the knowledge is baked into data rather than fetched from a model.
   This tier is easy to forget and is usually the answer.
3. **A hand-authored data file**, only where neither of the above is possible: a genuinely LLM-free
   path. `scripts.json` is the legitimate case — the intro "learn the script" course has no model
   available, so the letter tables must come from somewhere. Note it also documents what it
   deliberately omits (`_stub_comment`: Thai is not reducible to a letter→sound table). A tier-3
   file must declare its own limits.
4. **A hand-authored table in code.** Never. This is what `ARTICLE_CHOICES` and `VOCAB_ARTICLES`
   were.

`languages.json` is not on this ladder: names, flags and BCP-47 TTS codes are registry data, not
linguistic rules.

Evidence that tier 2 beats tier 4 rather than merely matching it: replacing `ARTICLE_CHOICES` with
corpus-derived choices took article MCQs from **15 of 20** grammar lessons to **19 of 20**, because
the table covered de/fr/it/es/pt/nl/ru and nothing else.

### A useful shape: deterministic scan + model adjudication

Tier 2 (derive from the corpus) and tier 1 (ask the model) combine well when a check is **cheap to
generate candidates for and expensive to decide**. The diacritic QC (`v72`) is the worked example:

- A Unicode-only scan finds every word whose accent-stripped form matches an accented form
  elsewhere in the corpus. Deterministic, free, no language knowledge, high recall.
- That produces **5 candidates corpus-wide**, most of which are MINIMAL PAIRS — real distinct words
  differing only by a diacritic (`souffle` breath / `soufflé` the dish; `inizio` beginning /
  `iniziò` he began). Deciding typo-vs-word requires knowing the language.
- So the model adjudicates only the survivors. Cost is negligible; precision is the model's.

The roadmap originally specified a capitalisation rule to settle it (`Zahlen` / `zählen`). That
works only because German capitalises nouns — a language fact in disguise. It is kept as a free
pre-filter, never as the decision.

**Default to OK on anything unclear.** A missed typo is cosmetic; a false flag trains the user to
dismiss the whole QC panel, which costs the checks that do work.

### Known violations, in order of harm

1. ~~**`VOCAB_ARTICLES` + `normalizeVocabArticles` (`server.js`)**~~ — **removed in `v71_y`.**
   It ran on every generated lesson, held article lists for 12 languages, and could only ever
   STRIP: `la grandine` / `hail` became `grandine` / `hail`, dropping the gender an Italian learner
   needs while its symmetric siblings (`il tempo` / `the weather`) kept theirs — the code made
   lessons *less* consistent than it found them.
   Article symmetry moved into the QC pass (`qcCheckPair`), which is tier 1 done properly: it sees
   the lesson's other pairs so it can follow their convention, can fix EITHER side, and **proposes
   rather than rewrites** — a wrong call lands in the flag UI instead of silently in the data. It
   also handles bound definiteness markers (Arabic `ال`) as a stated property rather than by
   omitting Arabic from a table, so it holds for languages nobody listed. The generation prompts
   still require symmetry, so QC is the safety net rather than the only defence.
2. ~~**`ARTICLE_CHOICES` (`index.html`)**~~ — **removed in `v71_x`.** Distractors now come from
   every article the model has produced in that language (`_articleChoicesFor`, nearest source
   first). Worth recording that this was strictly better, not a compromise: article MCQs now build
   in **19 of 20** grammar lessons against **15** with the table, because the table covered
   de/fr/it/es/pt/nl/ru and nothing else, so English lessons could never build one. Hebrew still
   builds none — one definite article, no indefinite — a fact nobody had to write down.
3. ~~**`_sentenceUnits` splits on `.!?…` only** (`index.html`)~~ — **resolved in `v72_a`.**
   `_sentenceSplit` now takes its boundaries from `Intl.Segmenter` (UAX #29) with **no locale
   passed**: sentence breaking is script-driven, and passing one changed the result on **0 of 1533**
   corpus paragraphs, so a locale would add an `APP.lang` dependency to a pure helper and buy
   nothing. The hand-authored list is gone from the decision path; it survives only as a fallback
   for engines without `Intl.Segmenter`, where the correct behaviour is to degrade to the *old*
   behaviour rather than to none.

   Measured over the whole corpus: **+170 sentence units, and not one character of text gained or
   lost in any of 775 samples.** Japanese went from **33 units to 176** — it really had been reading
   as one sentence per paragraph.

   **The Arabic ruling above was right about `،` / `؛` and incomplete.** Those are clause
   separators and Unicode is right to ignore them — that still holds, and is now pinned by a test.
   But `؟` (U+061F, Arabic question mark) *is* a sentence terminator and was **not** in `[.!?…]`:
   `/[.!?…]/.test('؟')` is `false`. Arabic gained **106 boundaries and lost none**. So the history
   is: first diagnosis wrong (add `،؛`), second incomplete (length only), actual cause **a missing
   terminator *and* length**. The length item (character-budget fallback) is still open and still
   needs no language knowledge.

   Two behaviour changes worth knowing, both accepted by the user as improvements:
   - **Mid-sentence ellipsis no longer splits.** `"Forse... forse c'è qualcosa"` is hesitation
     inside a sentence; the old scan split it. 51 corpus boundaries were wrong this way. This is
     most of the apparent "losses" (it −32, de −5, fr −1).
   - **`. ` before a digit no longer splits** (en −46). Nearly all of these come from one bundled
     story whose characters are *named* `0`, `1`, `2` and lowercase `i`, so sentences genuinely
     begin with a digit and Unicode reads `. 1` as a list marker. A corpus artifact, not a language
     problem — but if it ever matters, that is where to look.

   **A single newline is flattened to a space before segmenting.** `Intl.Segmenter` treats a line
   break as a sentence end; `_sentenceUnits` has already split paragraphs on `\n\n+`, so a
   surviving `\n` is a line *wrap*. Without the flatten, PDF-derived text shatters mid-clause —
   **598 of 854** new boundaries came from line breaks alone, re-opening exactly the corruption
   `v70_k`'s paragraph repair exists to prevent. Do not remove that line.

   **Item (b) shipped too, as `v72_b`.** `_splitLongUnit` sub-splits any unit over
   `_MAX_UNIT_CHARS` (300 — chosen from the corpus, where p99 = 325, so it touches ~1% of units and
   the affected set is 68 Arabic, 63 Italian, 2 German: exactly the languages the complaint named).
   Break candidates come from `Intl.Segmenter` at **word** granularity — a segment with
   `isWordLike === false` that is not whitespace is punctuation, in any script — so there is no
   second punctuation list either. Note this is where `،` and `؛` legitimately *are* used: the v71
   ruling was that they must not end a SENTENCE, and that still stands and is still tested. Using a
   clause separator to break an over-long unit is a length decision, not a claim about sentences.

   **Cuts are anchored to existing whitespace, and that is load-bearing.** `Intl.Segmenter` reports
   word boundaries INSIDE a token — `l'aria` segments as `l` `'` `aria`, `30-32` as `30` `-` `32` —
   so cutting at an arbitrary word boundary and rejoining with a space invents words. The first
   implementation did exactly that and was caught by the PDF paragraph test's word-count invariant
   (937 against 934), not by review. A consequence: a script with no whitespace yields no safe cut
   and its units are left whole. That is correct — cutting CJK by character count would split
   mid-word — and costs nothing, because everything over budget in the corpus uses whitespace.

   **Units now carry `sep`, the whitespace that really preceded them.** `v72_a` gave CJK real
   sentence boundaries for the first time, and CJK has no whitespace at them, so `_unitsToText`
   rejoining with `' '` inserted a space after every `。` and changed the text of **all 13** Japanese
   stories in the corpus. It survived a green suite because every PDF fixture is Latin, where the
   separator genuinely is a space. Units built by hand without `sep` still default to a space, so
   older callers are unaffected. Guarded by section 10 of the segmentation test.

   **Fragments are flagged.** A unit produced by `_splitLongUnit` is part of a sentence, so it
   carries `frag` / `fragFirst` / `fragLast`. `_synContext` uses these to keep the `v70_n` elision
   marker: without it a fragment that happens to fit under the word cap renders with no ellipsis and
   the learner reads a mid-sentence excerpt as though it were whole.

   **One hand-authored list remains in this area:**
   - `_SENT_END_RE` (`index.html` ~4044, 4062, 4156, 4210) — answers a *different* question, "does
     this string END like a sentence?", for the paragraph-wrap repair and the title/heading
     heuristics, not for splitting.
   - ~~`_SYN_CLAUSE_RE`~~ — **resolved in `v72_c`.** `_synClamp` now asks `_endsClause`, which uses
     the same `isWordLike === false` test as `_splitLongUnit`, so there is one way to ask "is this
     punctuation?" instead of two. The list had the identical gap one script further out: it held
     `،` and `、` but not the Devanagari danda `।`, and **Hindi is a shipped language** (Armenian `։`
     and Ethiopic `።` were missing too). Measured before switching — on all 286 synonym cards in the
     corpus the clause scan actually runs on 19 of the 39 long enough to clamp, and list and Unicode
     agree on all 19. A pure generalisation: identical today, correct for scripts the list never
     covered. `_SYN_CLAUSE_RE` survives only as the no-`Intl.Segmenter` fallback.

4. **`CLOSE_LANG_PAIRS` (`server.js` ~2205)** — **LIVE, and missing from this list until `v73_c`.**
   A hand-authored table of 21 language pairs judged "close enough" that identical source/target
   vocabulary is legitimate rather than a model failure. It gates whether a generated lesson is KEPT
   or REJECTED, which puts it on the correctness side of this section's own test, and its comment
   concedes it "is the ONLY place language 'similarity' is recorded". Tier 4 by the ladder above.
   Worth stating why it survived: entries 1–3 are all struck through, so this section has read as
   "no violations remain" while a live one sat outside it. **An inventory that only records what was
   found is not an inventory** — the next session in this area should re-scan `server.js` and
   `index.html` for per-language tables rather than trusting this list.
   No obvious tier-2 replacement: "are these two languages close?" cannot be derived from the corpus
   the way `_articleChoicesFor` derives articles, because the corpus is exactly what the judgement is
   about. Moving it to `languages.json` (open in `roadmap_v54`, `roadmap_v65`, then silently
   dropped) is tier 3 at best and does not reduce the authorship cost.

Not yet actioned — recorded so the next change in this area does not add to the pile.

### Consequence for the deterministic vocab QC item

The roadmap's article-mismatch rule **cannot be built as specified**: detecting "source has an
article, target does not" requires exactly the per-language table this principle rejects. Evidence
that the table is the hard part: two attempts at one during the session that produced this entry
were both wrong — `le` matched the prefix of `legge`, and a missing English entry made 19 perfectly
symmetric pairs look like violations. Either would have "fixed" correct data.

The umlaut rule is unaffected: it compares corpus forms against each other and encodes no rule about
German.

---

## 5. Test harness limits

**`lib-dom`'s `querySelectorAll` matches TAG names only**, over the tree parsed from `index.html`.
It does **not** parse `innerHTML` assigned at runtime. So anything rendered by setting `innerHTML`
— including every tick-list built by `renderLessonTypeChecks` — cannot be read back headlessly.
Assert on the produced markup string instead, and note the boundary. Extending `lib-dom` to parse
runtime `innerHTML` would fix this for every future picker test; it touches every harness in the
suite, so it wants its own session.

**A JS-assigned `className` is invisible to `classList`/CSS-selector matching (`v81_i`).**
`el.className = '…'` as a plain property write (e.g. `buildPath`'s `node.className='lesson-node'+…`)
does **not** update `classList._s`, which is what `matchesCompound` and `querySelectorAll('.foo')`
actually read — that sync only happens for attributes parsed out of an `innerHTML` string. So
`node.classList.contains('locked')` and `el.querySelectorAll('.lesson-node')` both silently return
false/empty against a node built this way, even though the node genuinely carries that class. Read
`node.className` as a raw string (`.split(/\s+/).includes('locked')`) instead for anything created
via `createElement` + a direct property assignment.

**Values cross a vm realm boundary.** An array built inside the sandbox has a different
`Array.prototype`, so `assert.deepStrictEqual(x, [])` fails on the prototype check alone even when
the contents match. Compare `.length`, or contents element-wise.

**Some functions are extracted in isolation** by unit harnesses (`ext(html, 'fnName')` + `new
Function`). Any helper such a function references must be `typeof`-guarded, or the harness gets a
`ReferenceError`. Follow the existing convention — degrade to the older behaviour, which is the
safe direction.

**`APP.cur` has a default (`lessonIdx: 0`) that sections silently depend on.** A test needing a real
index must **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or
`delete` the object. Mutating also mirrors production, where `openLesson` sets `C.lessonIdx = idx`
immediately before `buildExercises(idx)`.

**The corpus is not a constant.** Any scenario leaning on "the first topic/lesson of type X in
`lessons.json`" breaks when the data is replaced. Prefer hand-built fixtures for anything needing
exact counts — and if a section only means something when the corpus contains a particular case,
**assert that the case was found**, or the section goes vacuous on new data.

**`build-static.js` re-implements part of the client (`v76_k`).** It carries its OWN
`loadSavedList` and `savedItemHtml`, which OVERRIDE the ones in `index.html`. A change to the
landing page must be made in BOTH files: the `v76_e` storyline fix landed in `index.html` only and
the published `docs/` build stayed broken for two releases while every source-level assertion
passed. `loadClient({ file: 'docs/index.html' })` drives the built artefact under the same harness
— use it for any landing-page claim. (`init()` is suppressed there too, so `LANGS`/`UI_STRINGS`
must be seeded or the storyline header throws on `LANGS.it.flag`.)

**`lib-dom` AUTO-VIVIFIES any id (`v77_b`).** `document.getElementById('anything')` returns a fresh
stub element with no `style.display` and no `disabled`, whether or not the id exists in the markup.
So a probe that reads visibility by id **cannot distinguish "present and visible" from "does not
exist"**, and a legend mapping `display:none`→hidden will report a non-existent element as a real,
hidden one. This is how `v76_card_gates.md` carried two phantom columns (`comp-back`, `comp-story`)
through a release as measured truth, and how the roadmap came to say the §0c back button was
"already there and already dead" when `comp-back` was deleted in `v71_k`. **Assert the id exists in
the MARKUP first** — `unit-card-consistency` does exactly this for the row it checks, and says why.

**A `<select>` has no `.options` in the stub DOM (`v76_j`).** It does not parse `innerHTML`, so any
product code reading `sel.options` (`repopulateContinueSelect`, `continueFromLesson`,
`applyUIStrings`) sees `undefined`. Tests define the getter a real DOM would provide, derived from
the markup the product itself wrote. `applyUIStrings()` iterates **seven** selects
(`lang-select`, `src-lang-select`, `diff-select`, `format-select`, `style-select`,
`vocab-mode-select`, `user-story-lang`) asynchronously via `loadUIStrings`, so a test that calls
`selectLang`/`selectSrcLang` and shims only the select it cares about still crashes the runner
**after** its assertions have passed.

**A ref is treated as an id only when it matches `/^tp_\d+$/` (`v76_j`).** `continueFromLesson`
falls back to matching the topic NAME otherwise, so a mnemonic fixture id (`tp_z`, `tp_a`) resolves
to nothing and a test fails for a reason unrelated to what it is testing.

**`fake-ollama` truncates logged prompts (`v76_h`).** `readChatLog()` entries carry `sys` cut to
8000 chars — it was **400** until `v76_h`, and every note appended after a prompt's `system` block
(the script rule, dialect, writing style, continuation) falls past that. A test asserting on a
prompt's TAIL was checking the truncation, not the prompt. Also: booting a **second** live
environment while the first is running returns an empty chat log — use one environment and slice
the log from a mark taken before each run.

**A count of a repeated element pins the fixture, not the claim (`v76_d`).** `total 🔒 === 1`
encoded "a two-chapter storyline" and broke when the corpus offered a six-chapter one — while the
product was correct. The chapter-card lock overlay and the full-story lock row are *different
elements*; count by kind, or assert the specific one the claim is about.

**`loadSavedList` returns early on an empty filtered list.** A "this must NOT be shown" assertion
written with a filter that matches nothing never reaches the storyline branch, and passes under its
own revert. Pair every such negative with a positive assertion proving the render got that far.

**Driving `loadSavedList` headlessly needs two stubs**, neither of them the code under test:
`window.fetch` (it fetches `/api/lessons` and `/api/storylines`) and `_populateLibSelects` (the stub
DOM has no `<option>` lists, so the menu populator throws). It is `async`, so flush microtasks
before reading `#saved-list`.

**Wiring changes need a run, not source assertions.** When one side sends and the other consumes,
assertions on each half prove nothing about the join. In `v71_u` the server could ignore `arcTypes`
entirely with the whole 156-check suite green. If a change is "A now passes X to B", the test must
observe **B's output** — usually an e2e against the live server + `fake-ollama`.

---

## 6. Where things live

| | |
|---|---|
| `index.html` | The entire client — UI, builders, coverage model, progress. Single inline `<script>` |
| `server.js` | HTTP routes, generators, job runner, store persistence |
| `llm.js` | Ollama/OpenAI transport, timeouts, `num_ctx`, think options, JSON salvage |
| `lessons.json` | The store: topics, lessons, storylines |
| `docs/index.html` | Static build — `node build-static.js lessons.json docs` |
| `test/run.js` | The suite. `node test/run.js` |
| `test/check-inline.js` | Parses the inline script; run on **both** `index.html` and `docs/index.html` |
| `test/lib-dom.js` | Headless DOM stub for client unit tests |
| `test/lib.js` | Live-server + `fake-ollama` harness for e2e |
| `build_history/` | Roadmap + per-session notes (the narrative record) |

**Definition of done** for a change is in the roadmap's session-protocol block, not here.

### 6b. Feature → function map

**Names, deliberately, not line numbers** — names survive edits and line numbers do not. `grep -n
"function NAME"` finds any of these in one call. The point of this table is to convert exploration
into a direct read: a session that knows the entry point spends its context on the problem instead
of on locating it.

**Storyline screen and forks** (all in `index.html`)

| what | where |
|---|---|
| the whole storyline screen | `_renderStorylineScreen(chainId, encodedChain, topics)` |
| chapter → successors, built inside it | local `_succMap`, and `byTopic` (keyed by **topic name**, not id) |
| the recursion that draws the chain | `_renderChain(topic, prevTopic, isFirst, depth, chainBlocked)` |
| one chapter's card | `_renderChapterCard(...)` → `savedItemHtml(s, connector, hideStory, hideProv, slChapter)` |
| the branch point (side-by-side columns) | the `kids.length > 1` block inside `_renderChain` |
| the fork marker | that block: **empty** for the open storyline's own column, the other storyline's icon+title (clickable) for the rest. Was `'⑂ ' + String.fromCharCode(65+bi)` until `v79_k` |
| **the greyed branch for another storyline** | `_renderAltBranch(kidTopicName, altSl)` — one `.sl-fork-alt` wrapper at `opacity:.5` carrying **every** chapter of that fork from the branch point down, cards inert (`pointer-events:none`) so the wrapper's `_openStorylineById` takes the click |
| which storyline a foreign successor belongs to | `_altStorylineFor(kidTopicName)` — first storyline listing it that is not the open one |
| open a storyline by id | `_openStorylineById(slId)` — **pushes** history (fork switching must be reversible); contrast `_tryOpenStorylineByChainId`, which *replaces* and is for URL entry, and `_openStorylineForTopic`, which resolves by topic and is ambiguous where forks live |

**⚠️ A correction, recorded because the wrong version of this row cost a session's assumption:** the
pre-`v79_k` row said the `else` arm "renders only `kids[0]`". **It did not.** It rendered one card
per foreign kid — the 3-way fork correctly drew two — and the truncation was that it **never
recursed**, so an alternative storyline with four chapters showed as a single card. Measured at the
`v79_j` cut with `build_history/probe_forks_v79k.js` before anything was changed.
| "is this chapter finished" | `_chapterComplete(t)` (local) → `chapterComplete(t)` (global) |
| which lessons count toward completion | `lessonCountsFor(d, L)`, `countedLessons(d)` |
| chain parent resolution | `continuedFromId` first, else name — see the comment at "Resolve a lesson's chain parent" |

Two facts a fork change runs into immediately, both established by reading the above rather than
assumed: `byTopic` is keyed by topic **name**, so anything keyed by id needs converting; and
`_rendered` (a `Set`) guarantees each chapter card is drawn at most once across the whole tree.

**How `v79_k` resolved that second one — by the user's ruling, "don't draw the shared prefix
multiple times, keep the forking".** The greyed branch starts **at the fork**, not at the other
storyline's first chapter, so the chapters both forks share stay drawn exactly once, above the
branch, which is where a shared prefix belongs. `_rendered` is therefore untouched and still
holds — the anticipated collision never happens, because the design says the prefix is one thing
rather than a copy per fork. `_renderAltBranch` also adds every card it draws to `_rendered`, so
two fork columns cannot both claim a chapter their branches share further down.

**Progress attribution needed no change at all, and this is the fact to keep:** `APP.progress.completed`
and `chapterDone` are keyed by **topic name**, globally, and `_slProgressStats` walks a storyline's
own `chapters[]`. Completion is therefore storyline-agnostic already — a chapter both forks *list*
moves both decks identically, measured. Where a fork looks asymmetric, the cause is **membership**
(one storyline's `chapters[]` not listing the shared chapter), never the completion helpers.

**Progress, cards, gates**

| what | where |
|---|---|
| card render errors | `_cardErrors()` — assert empty after any card render |
| card page scaffolding | `_cardHeader(prefix)` + `.card-screen` (both required for a new card page) |
| exercise build / answer / advance | `buildExercises(i)`, `pickChoice(i, el)`, `check(replay)`, `markSolved(ex)` |
| exercise renderer registry | `EX_RENDERERS[ex.type]`, dispatched by `renderEx()` |
| words this chapter teaches | `_storyWordSources(d)`; **per-word progress via `_wordProgress(d)`** (see TRACK T below) — `_solvedTargetWords(d)` is now a wrapper over it |
| the card truth table | `build_history/probe_gates_v77.js` → **`v80i_card_gates.txt`** (`v80e`, `v80`, `v77` and `v76` tables superseded). ⚠️ It SELECTS its chapters from the corpus, so a data drop moves the selection — disambiguate by re-running the PREVIOUS client against the CURRENT corpus |
| **the lesson-path node lock** | `buildPath()`'s node loop — `isLocked` is now **exactly** `_storyLocked` (`v81_i`, user ruling). The old sequential half ("previous lesson done") is REMOVED: it was already unenforced everywhere else (`_firstUnfinishedLessonIdx`'s `_playable` never read it, `tapWord` bypasses it). `_prevDone`/`_firstNode` still exist but now only feed the connector-line's CSS, not the lock. Guarded on the RENDERED node in `test/unit-hidden-lessons.test.js` §4 — ⚠️ `buildPath` sets `node.className` by direct property assignment, not parsed markup, so the `lib-dom` stub's `classList`/CSS-selector matching does NOT see it; read `node.className` as a raw string instead |

**PLAN §8/B1–B3 — observations, target-language skills, and vocabulary tags** (`v81_j`–`v81_k`)

| what | where |
|---|---|
| the append-only log itself | `APP.progress.observations` (array), lazily created by `_obsLog()`. One record per graded answer: `{userId, skillId, correct, evidence, storylineId, topicId, lessonId, qid, firstAttempt, timestamp}` — `userId` stays `null` until auth (`PLAN §9` R3); `skillId` is a canonical target-language ID only for a B3-resolved vocabulary exercise, otherwise `null` |
| where it is written | `recordObservation(ex, correct)`, called from `check(replay)` right after `markSolved`/`markWrong`, behind the same `!replay` guard — a replay must not add evidence for an answer already given. `buildStandardExercises` copies a resolved `vocab[].skillId` to its vocabulary-derived exercise first |
| registry + new-lesson tagger | `skills.json` → `loadSkillRegistry()` / `resolveVocabularySkillTags()` in `server.js`; B2 routes are `/api/skills`, `/resolve`, `/register`, `/alias`, `/alias` DELETE. The model proposes `<target>:vocab:<dictionary-form>`; only an explicit registry registration/alias reaches `vocab[].skillId`, while pending proposals stay in `vocab[].skillProposal` |
| **⚠️ SCOPE** | only exercises graded through `check()` (`EX_RENDERERS`-driven types) are logged. `error_hunt`/`ai_error_hunt` and the crossword grade differently and are NOT wired — a follow-up, not an oversight |
| `firstAttempt` | `!log.some(o => o.qid === id)` at write time — O(n) per write, acceptable at single-learner volumes. The log necessarily starts EMPTY, so anything solved/wrong before this shipped reads as a "first" attempt if it recurs — this is `§0.1(a)`'s "existing evidence cannot be replayed" finding, not new |
| storyline attribution | `_storylineIdForTopic(topicName)` — a cheap, UI-independent lookup. **Not** `_storylineForTopic`, which is scoped to the storyline browsing screen and does unrelated JSON-encoding work |
| survives a chapter wipe | `_clearChapterProgress` deliberately does **not** clear `observations` (or `learned`) — both are evidence of what the learner has demonstrated, independent of whether a chapter's gate state is reset |
| growth ceiling not addressed | `learners.js`'s `MAX_STATE_BYTES` (2MB) caps the whole synced `progress` blob; nothing here prunes the log |

**TRACK T — the text-focused progress card** (all in `index.html`, built across the `v80` line)

| what | where |
|---|---|
| **per-word progress — the ONE collector** | `_wordProgress(d)` → `Map<word, {n, ok, bySrc}>`. `bySrc` is `{extra, vocab, sentence}`; `n`/`ok` are the totals. **`_solvedExtraWords` and `_solvedTargetWords` are thin wrappers over it** — do not compute word state any other way |
| **the denominator is BUILDABLE questions only** (`v81_d`) | `_wordProgress` / `_wordQuestions` intersect declared probes with `_lessonQidUniverse`. Declared ≠ buildable: measured 60.8% — `type_conjugation` 0 of 210, `syn_select` 142 of 192. ⚠️ **SCOPED TO THE OPEN CHAPTER**: `_lessonQidUniverse` indexes into `APP.lessonData` and ignores the `d` argument, so for any other chapter it returns an EMPTY set and would filter everything — it fails OPEN there. `_renderChainStory` is the live path (`v74_n`) |
| **`§T7` demotion — a wrong answer un-greens a word** (`v81_e`) | `APP.progress.wrong[topic][qid]`, written by `markWrong`, CLEARED by `markSolved`. Read by `_wordState` (green → **partial**) and by `_wordQuestions`/`tapWord` (a since-failed question counts as work to do). ⚠️ **HIGHLIGHT ONLY, by user ruling**: it is a SEPARATE counter (`rec.bad`), never subtracted from `n`/`ok`, so `_wordGateFraction` — which reads `ok >= n` — cannot inherit it and a mistake can never re-lock a story. Pinned by `unit-word-progress` §9 |
| **tapping a word with NO question** (`v81_f`) | `_wordLessons(d, word)` — the ONE "which lessons TEACH this word" resolver, separate from `_wordQuestions` (which answers "which QUESTIONS"). `tapWord` consults it ONLY when there is no question, so a question-less destination never competes with real ones. ⚠️ 79 words are taught only by a HIDDEN lesson and correctly still return false — `startLesson` refuses those, and that is the load-bearing refusal, not `_wordLessons`' own filter |
| **storyline progress bar vs its label** (`v81_g`) | `_slProgressStats`: `pct` = `doneChapters/total` (the BAR, completion — coverage-aware `chapterComplete`), `unlockedChapters` = `doneChapters + 1` (the LABEL, access — the `v77_p` user ruling). ⚠️ They deliberately DISAGREE: a deck can read 3/3 with a 67% bar. `pct` feeds the three bars, `unlockedChapters` feeds `_slProgressLabel` only |
| the three states it paints | `_wordState(rec)` → `'red' \| 'partial' \| 'green'`. GREEN = **every** associated question solved (`§T5.1`, ruled) |
| **the ONE story renderer** | `_storyBodyHtml(d, {text, highlight, ex})` — used by the question panel AND the progress cards. The FRAMES differ (a `<details>` vs `#comp-story-text`); only the body is shared |
| the question-screen panel | `_exStoryPanelHtml(ex)` — on **every** question type, never collapsed (`v80_u`), no story-unlock gate (T0) |
| three-state colouring + asked underline | `_highlightVocabHtml(html, words, strong, stateByKey, underlineKeys)` — the last two are OPTIONAL; omit them and the pre-`v80` two-shade behaviour is unchanged |
| word → state map / asked span | `_wordStateMap(d)` (worst state wins when a word has two sources), `_askedKeys(ex)` |
| **tap a word → the lesson flow** | `tapWord(word)` → `_wordQuestions(d, word)` → `startLesson` + `C.cur`. **A way IN to the existing runner, not a one-question mode** (`§T5.2`, ruled). Prefers UNSOLVED questions |
| the chapter icon row | `_chapterIconsHtml(topicKey, slCtx)` — renders into the `*-storyboard` slot on the cards. **That id is HISTORICAL**: the slot used to hold the storyboard, which now appears only on the storyline page |
| **the word GATE (opt-in)** | `_wordGateFraction(d)`, `_wordGateTarget(d)`, consumed by `storyUnlocked`. `wordGate` is read topic → storyline → `APP.info`. **UNSET = the old `v71_s` rule, and unset is the default** |
| the vocabulary list under the text | in `showComplete` — only solved words **NOT** in the story, plus the probe sources. It is the COMPLEMENT of the highlighting, not a copy of it |

**Question navigation (`§0h`, `v80_p`)**

| what | where |
|---|---|
| the per-run answer ledger | `C.ans[i] = {ok, sel, placed, usedIdx, typed, synSel}` — created in `startLesson`, so **the lock is per-RUN by construction**: replaying makes the questions playable again |
| repaint an answered question | `check(replay)` — the SAME function that paints a live answer, with scoring, hearts, `markSolved`, the ledger write, speech and auto-advance guarded off. **One code path, so a replayed question cannot look different from a live one** |
| restore the selection | `_restoreAnswer(ex, rec)`; placed-order kinds redraw through `updateSbox` / `updateMathPlaced` |
| back one question | `qPrev()` + the `←` button, hidden on the first question. Forward is unchanged — `_speakAndAdvance` advances one way only |

**⚠️ Invariants worth knowing before you touch any of the above**

- **`buildExercises` is non-deterministic in CONTENT, not just order.** The set of questions a run
  holds for a given word differs between builds. Any test that samples the corpus for a fixture must
  accumulate across several builds and be verified over ~15 consecutive runs (`v80_t`).
- **Lesson ids must be unique WITHIN a topic.** Progress is keyed `completed[topic][L.id]` and item
  keys are `${lessonId}:i:${hash}`, so duplicates share one done-flag — three lessons with `id: 6`
  meant finishing one marked all three. Enforced at `saveStore` by `_dedupeLessonIds` (`v80_i`),
  because the generators still emit literal `id: 6` for word_forms, synonyms AND conjugation.
- **The solved store is MONOTONIC** — one correct answer ever = solved. `§T7` was RULED at `v81_e` as
  HIGHLIGHT ONLY and did NOT change this: the demotion is a parallel `wrong` map. Anything that would
  make the solved store fall is reading 2 (mastery decay, `PLAN §9b/D2`, blocked on `§8/B4`) and is
  not ruled. ⚠️ Its readers include the ROUND BUILDERS, not just coverage and the gates.

- **A REVIEW RENDER IS NOT A COMPLETE CHAPTER** (`v81_c`). `showComplete(true)` means "record no
  play"; it does NOT mean "this chapter is finished", and since `v81_b` a later chapter LANDS on it
  with work outstanding. Anything asking "is there work left" must ask the DATA (`setComplete` /
  `_firstUnfinishedLessonIdx`), never the `_review` flag. The old shortcut sent 52 of 72 later
  chapters straight past their comprehension lesson.
- **26.1% of highlighted words are DEAD TAPS** (181 of 693, measured `v81_d`). Every mark on the
  TRACK T panel carries `wp-tap`, but a quarter resolve to no question and `tapWord` returns false
  with no fallback. Open; `probe_tap_reachable_v81d.js` measures it.

**Roles, menus, scripts**

| what | where |
|---|---|
| edit rights (role axis) | `_canEdit()` — teacher mode only since `v79_j`; `_isLearner()` alongside |
| generation affordances (capability axis) | gated directly on `APP.info.canGenerate` — Continue story, Add lesson, Edit/rename |
| storyline add-lessons tick list | `ADD_LESSON_TYPES` + `renderLessonTypeChecks()` + `_pickLessonTypes()` |
| server whitelist for storyline runs | `ARC_LESSON_TYPES` / `sanitizeArcTypes()` in `server.js` — **client and server are two halves of one decision** |
| per-chapter lesson generators | `ADD_LESSON_GENERATORS` in `server.js` |
| is a script lesson applicable | `scriptLessonAvailableForSet(d)` → `needsIntroScript()` → `scriptsForLang()` |
| script pin on prompts | `scriptPinNote(lang, script, role)` in `server.js`; swept by `unit-script-pin-coverage` |
| chapter script reaching a generator | every `sharedGenOpts` construction (three of them) must carry `script` |

**Story generation and context**

| what | where |
|---|---|
| the chain fed to prompts | `collectChainStory(node, budget)`, budget `CHAIN_STORY_CHARS` |
| story prompt assembly | the `else` branch of `generate()` in `server.js`; system from `sysStory()` |
| context-window sizing | `estimateCtxTokens()` / `_resolveNumCtx()` in `llm.js`; only callers passing `ctxTokens` get a `num_ctx` |

**Generation-side QC detectors** (all in `server.js`; each has a corpus PROBE that reports and a unit guard that pins the DETECTOR on synthetic fixtures)

| what | where |
|---|---|
| word_forms blank position | inside `validateWordFormsItems` — rejects a blank appended AFTER sentence-final punctuation. **Pure structure, no language knowledge**, and it holds for Arabic `؟`/`۔`, CJK `。` and fullwidth marks. Probe: `probe_word_forms_defects_v80g.js` |
| ⚠️ the "answer visible in the stem" half | **MEASURED AND DELIBERATELY NOT ENFORCED.** Prefix-matching is mild morphology and would discard good items in inflected languages. Reported by the probe, left to a human (`v80_g`) |
| lesson written in the wrong script | `lessonScriptDefect(lesson, scriptName)` — alphabet comes from `scripts.json`, **never a hardcoded Unicode range**, so a script added there is covered with no code change. **EXEMPTS `comprehension`**: those questions are in the SOURCE language by design across the whole corpus (`v80_m` — the `v80_h` version wrongly flagged four of them). Probe: `probe_lesson_script_v80h.js` |
| unique lesson ids within a topic | `_dedupeLessonIds(topics)`, called from `saveStore` — the ONE choke point all 23 write paths funnel through |
| the vocab article contradiction | `prompts.json` `vocab.system` — the per-side clause was REMOVED and a worked counter-example added (`v80_j`, rule 31). **Unverified by design**: whether the model obeys needs regeneration across MANY lessons and a re-run of `probe_article_symmetry_v80j.js` against its 1.0%/bimodal baseline |

**Speech**

| what | where |
|---|---|
| voice ranking and choice | `_ttsRankVoices(voices, code)`, `_ttsPickVoice()` |
| which locale a lesson speaks | `activeTtsCode()`, `lessonLang()` / `lessonSrcLang()` |
| **pronoun + verb form, for speech AND display** | `_joinPronoun(pron, form)` — an apostrophe-final pronoun binds directly (`j'` + `emporte` → `j'emporte`). With a space the TTS reads the apostrophe aloud. **Orthographic, not lexical**: it reads a character, not a dictionary, and covers every apostrophe code point since the corpus mixes U+0027 and U+2019 (`v80_u`) |
| the story read-aloud | `speakBodyText(el, lang, text)`; the panel's 🔊 and the card's 🔊 read whatever language is currently SHOWN |
| which language the story panel shows | `APP._compStoryLang` — **shared** by the question panel (`toggleExStoryLang`) and the progress card (`toggleCompStoryLang`), so the two screens cannot disagree |


---

**Keep 6b current the cheap way:** when a session's write-up names a function it had to hunt for,
add the row. A wrong row is worse than a missing one, so only add names verified in that session.

## 7. Maintaining this file

Add an entry when a session discovers something a future session would otherwise rediscover:
a constant worth tuning, a way something fails quietly, an invariant that is not obvious from the
code, or a harness limit that shaped how a test was written.

**Reference sections by NAME, not number.** Sections get inserted (the design principle became §4
in session 23, pushing three others down), so `§4` in an older note may point somewhere else
entirely. Release tags are stable; section numbers are not.

Keep the *why* in the session notes and link to it by release tag. Entries here should be short and
checkable — a number, a rule, a named function. If an entry cannot be verified against the code in
under a minute, it is probably narrative and belongs in the notes.
