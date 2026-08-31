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

**`el.innerHTML` only reflects a STRING write, never `appendChild` (`v81_s`).** `buildPath()`
builds `#lesson-path` by `createElement`/`appendChild` in a loop (`v73_c`'s `innerHTML` setter is
never called for that element), so `document.getElementById('lesson-path').innerHTML` reads back
`''` even after real nodes were added — the getter just returns `_html`, the last STRING assigned,
and `appendChild` never touches it. Assert `.children.length` instead for anything built this way;
`innerHTML.length` silently proves nothing and the assertion passes vacuously on the empty string
comparison bug (`'' .length > 0` is `false`, so it at least fails loud here — but do not assume that
holds for every such check).

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

**Static HTML markup outside the `<script>` block is never parsed into `lib-dom`'s fake document at
all (`v81_r`).** `loadClient` extracts only the inline `<script>` content and runs it in a vm
sandbox; the rest of `index.html` (every literal `<button onclick="…">`, `<div id="…">`, etc.) is
never read. What LOOKS like DOM structure in a test is entirely one of two things: an
auto-vivified per-id stub handed out by `getElementById` (empty, no children, no attributes — see
the AUTO-VIVIFIES bullet above), or real parsed nodes created because product code assigned
`innerHTML` to one of those stubs at runtime (`v73_c`'s parser). A STATIC button's inline `onclick`
attribute is therefore unreachable by `querySelector`/`getAttribute` — there is no element there to
find. Simulating a click on one only works when product code has separately fetched it by id and
assigned a live `.onclick` function (`compNext.onclick = …`), or when the button's markup itself
came from a runtime `innerHTML` write (`unit-lessonset-storyline-link.test.js`'s
`#home-hdr-storyline span`). For a plain static button, call the function its `onclick` attribute
names directly instead, and say why in the test.

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
| **sentence-ordering (`order`) length gate** (`v82_g`) | `buildStandardExercises`'s `tsOrderable` filter — only sentences with `s.words.length <= 5` are candidates for `mkOrder`; a lesson whose sentences are all longer builds no `order` exercise at all (never a fallback to a long one). `read_translate` and every other sentence-derived type are unaffected — this is about the ORDERING task's own difficulty, not the sentence's eligibility |
| exercise renderer registry | `EX_RENDERERS[ex.type]`, dispatched by `renderEx()` |
| words this chapter teaches | `_storyWordSources(d)`; **per-word progress via `_wordProgress(d)`** (see TRACK T below) — `_solvedTargetWords(d)` is now a wrapper over it |
| the card truth table | `build_history/probe_gates_v77.js` → **`v80i_card_gates.txt`** (`v80e`, `v80`, `v77` and `v76` tables superseded). ⚠️ It SELECTS its chapters from the corpus, so a data drop moves the selection — disambiguate by re-running the PREVIOUS client against the CURRENT corpus |
| **the lesson-path node lock** | `buildPath()`'s node loop — `isLocked` is now **exactly** `_storyLocked` (`v81_i`, user ruling). The old sequential half ("previous lesson done") is REMOVED: it was already unenforced everywhere else (`_firstUnfinishedLessonIdx`'s `_playable` never read it, `tapWord` bypasses it). `_prevDone`/`_firstNode` still exist but now only feed the connector-line's CSS, not the lock. Guarded on the RENDERED node in `test/unit-hidden-lessons.test.js` §4 — ⚠️ `buildPath` sets `node.className` by direct property assignment, not parsed markup, so the `lib-dom` stub's `classList`/CSS-selector matching does NOT see it; read `node.className` as a raw string instead |
| **`writing` lesson type — `PLAN §D4`** (`v82_e`, reworked `v82_f`) | the ONLY lesson type graded by a LIVE model call at play time, not played from static content. Stem: `generateWriting()` (server.js), registered in `ADD_LESSON_GENERATORS`/`ARC_LESSON_TYPES` like every other type — produces ONE reading-comprehension `question` about the chapter's story, source-language ONLY (`v82_f`, user ruling — replaced an earlier bilingual `prompt`(target)/`hint`(source) pair; matches how `comprehension`'s own `q` field works). The learner still WRITES their answer in the TARGET language. Grading: `POST /api/writing-feedback` (stateless — no job, no `lessons.json` write), now receiving `question` + `story` alongside `text` so it can judge CONTENT correctness against the story, not just typos/grammar → `parseWritingFeedback()` parses a `"CORRECTNESS: <correct|partially correct|incorrect> — <note>"` line plus zero or more `"<wrong> => <fix> — <note>"` language-issue lines; a reply in neither shape surfaces as `correctness:'unknown'` with the raw reply as the note, never silently discarded. `story` is CAPPED (`clip(...,4000)`, the same choice `/api/tutor` makes for its own story field), not num_ctx-sized — both are the documented alternatives in `unit-generation-context.test.js`. Client: `LESSON_TYPE_META.writing` (`build:()=>[]`, bypasses `buildExercises`/`EX_RENDERERS` entirely — same shape as `error_hunt`); `startLesson()`'s `C.isWriting` routes to `renderWriting()`, its own render/submit/feedback path, not a new `EX_RENDERERS` entry. Completion is `APP.progress.completed[topic][lesson.id]` truthiness, same as `error_hunt` — no `qid`, no `_wordProgress`/BKT participation. `writing` is in `_POST_STORY_TYPES` (gated behind the story, like `comprehension`). Graded with `callLLMLesson` (the default model), NOT `callLLMQC` — measured live: the QC-role model ignored the requested output format and was markedly slower for this task. Static build: `renderWriting()` checks `APP.info.canGenerate` and shows an offline message instead of a textarea that could never be graded |

**PLAN §C0 — the router seam** (`v81_m`–`v81_u`)

| what | where |
|---|---|
| the one authoritative route state | `APP.screen`, written ONLY by `show(id)`. Never assign it directly — nothing else keeps it in sync |
| the explicit renderers | `showProgressCard`/`showStory`/`showGeneration`/`showGenerationClean`/`showSettings`/`showTeacher`/`showLessonSet`/`showLesson`/`showStoryline`/`showStorylineForTopic`/`showStorylineById`/`showStorylineByChainId`, defined right after `show(id)`. **Thin delegates**, not rewrites, to `showComplete`/`showStoryUnlocked`/`goLanding`/`goLandingClean`/`toggleModelPop`/`openTeacherDashboard`/`goLessonSet`/`startLesson`/`openStorylineScreen`/`_openStorylineForTopic`/`_openStorylineById`/`_tryOpenStorylineByChainId` |
| `showGeneration` vs `showGenerationClean` | NOT interchangeable. `goLandingClean` additionally resets the URL hash (`history.replaceState`) — collapsing the two would silently drop that for every "home" button. `showGenerationClean` is what all 7 header "🌍 home" buttons and the stranded-learner fallbacks call |
| **generation and progress/card state are now fully behind the seam** | `v81_o` rerouted every `goLanding`/`goLandingClean` caller; `v81_p` rerouted every EXTERNAL `showComplete` caller (10 sites: 9 in `index.html`, 1 in `build-static.js`) onto `showProgressCard`. `showStoryUnlocked` had already lost its one caller at `v81_n`. **What was left after `v81_p`**: nothing on `PLAN §C0`'s original four-name list — `§C0.4` (dead-path removal) partially shipped at `v81_q`; `v81_r` onward seams FIVE further surfaces from TWO separate user rulings, none drawn from the plan's original four-name list. Ruling 1 (`v81_r`): `showTeacher()`, chosen alone from a menu of options. Ruling 2, given once `v81_r` shipped: do THREE more, smallest first, no re-asking between them — `showLessonSet()` (`v81_s`), `showLesson()` (`v81_t`), `storyline-screen` (`v81_u`, the third and biggest, needing FOUR wrapper names of its own). **All three of ruling 2 are now shipped — nothing is currently owed on this track.** **"QC/editing" is NOT a screen-shaped surface in this codebase** (found scoping `v81_s`): proofread/edit/flag/dialect-studio controls are woven into both `lesson-set` and `storyline-screen`, not owned by any `.screen` of their own — the router seam gives a screen's ENTRY/EXIT one name, it does not separate the concerns mixed inside it. Treat that separation as a distinct, later, harder initiative if it is ever wanted, not part of this track |
| **`showTeacher()`** (`v81_r`) | wraps `openTeacherDashboard()` — the teacher dashboard, backend/teacher-only. Both its external callers (`#teacher-dash-btn`, the dashboard's own 🔄 refresh button) rerouted. No `build-static.js` copy exists to keep in sync: the static build hides the entry button entirely (`APP.info.canGenerate` gates it), so `openTeacherDashboard` is never reachable there |
| **`showLessonSet()`** (`v81_s`) | wraps `goLessonSet()` — the per-chapter lesson list. NOT named `showLibrary` — that label is already `lib.*` in `ui.json`, the LANDING page's saved-topics list, a different screen. 4 external callers rerouted (`index.html`'s own `loadSaved`, `doGenerate`'s cached-hit branch, one inline "📖 continue" button, `confirmQuit`'s teacher fallback). `build-static.js` has its OWN `loadSaved` with a matching internal call site — updated to match, same "both files" pairing as `v81_o`/`v81_p` |
| ⚠️ **`showComplete`'s TWO internal self-calls are deliberately NOT rerouted** | lines calling itself indirectly inside its own body (the "Next never greyed" fallback, the chapter-finished branch) are implementation detail, not an external entry point — rerouting them would just be a function referencing a wrapper of itself for no reason. `unit-coverage-threshold` pins one of these directly; leave it alone |
| ⚠️ **`build-static.js` re-implements `loadSaved` separately, AND is missing a branch `index.html` has** | its own `goLandingClean`/`showComplete`/`goLessonSet`/`startLesson`/`openStorylineScreen`/`_tryOpenStorylineByChainId` call sites needed matching reroutes (`v81_o`, `v81_p`, `v81_s`, `v81_t`, `v81_u` — `unit-learner-nav`'s static-parity check catches a miss). Separately, and NOT fixed: it has **no `_isLaterChapter()` branch at all** — a learner opening a later chapter in the static build may not land on the progress card the way `v81_b` intended. Found at `v81_p`, left for its own measurement and release |
| `showSettings` is not a `.screen` | settings has none yet (`PLAN §C4`, a separate later track) — it wraps the CURRENT popover toggle. `APP.screen` is correctly untouched by opening/closing it |
| **`showLesson(idx)`** (`v81_t`) | wraps `startLesson(idx)` — the exercise runner, `lesson-screen`, the plan's "exercise running" label. `startLesson` returns `false` on its guard exits (a hidden lesson a learner cannot reach) and callers branch on that return value, so the delegate forwards it rather than discarding it — check any future seam of a function whose return value is READ, not just called for effect. **12 external callers rerouted**, the largest single-name reroute in this track: `loadSaved`, `buildPath`'s node click, `startNextLesson`, `repeatForCoverage`, three separate `showComplete` `compNext.onclick` branches, `showStoryUnlocked`'s `us-next.onclick`, `showStorySummary`'s `sum-next.onclick`, `tapWord`, and one inline-rendered chapter-icon `onclick` (built via `innerHTML`, not static markup, so IT remains reachable by the test harness unlike the teacher/lesson-set exit buttons). `build-static.js`'s own `loadSaved` copy updated to match. Exit is already fully seamed: `confirmQuit()` routes through `showProgressCard`/`openStorylineScreen`/`showGenerationClean`/`showLessonSet`, all pre-existing seams — nothing new needed on that side |
| **`showStoryline`/`showStorylineForTopic`/`showStorylineById`/`showStorylineByChainId`** (`v81_u`) | `storyline-screen` — the biggest single surface in this track, needing FOUR wrapper names because FOUR distinct entry functions already existed with real, DIFFERENT behaviour (same reasoning `showGeneration`/`showGenerationClean` used for two, scaled up): `showStoryline(chainId, encodedChain)` wraps the raw `openStorylineScreen`; `showStorylineForTopic(topicName)` wraps `_openStorylineForTopic`, which resolves by topic membership and FALLS BACK to a standalone lesson set (`loadSaved`) if no storyline owns it — a real behavioural fork, not just a lookup; `showStorylineById(slId)` wraps `_openStorylineById`, which resolves by storyline id and PUSHES history (fork switching must stay reversible); `showStorylineByChainId(chainId)` wraps `_tryOpenStorylineByChainId`, the URL/hash-entry path, which REPLACES history and — unlike the other three — does **not** call `openStorylineScreen` at all: it independently re-renders (`_renderStorylineScreen` + `show()` inline), a genuinely separate code path. **17 external callers rerouted across index.html** (11 direct `openStorylineScreen`, 1 `_openStorylineForTopic`, 3 `_openStorylineById`, 2 `_tryOpenStorylineByChainId` — including a popstate-handler caller easy to miss on a first grep since its surrounding text looked identical to a self-recursive retry inside the wrapped function's own body; only reading both in full told them apart), plus 3 in `build-static.js`. The three RESOLVER functions' own internal calls into `openStorylineScreen`/their own retry recursion are deliberately left unrerouted — implementation detail, same treatment as `showComplete`'s self-calls. `closeStorylineScreen` (the "← Back" exit) was NOT given a seam name: none of the other close/exit helpers got one either (`closeModelPop` stayed itself under `showSettings`), and its only effect, `history.back()`, is a no-op in the test harness — nothing to seam against |
| ⚠️ **`showStoryline()` itself is invisible to every OTHER wrapper's mutation test** | none of `showStorylineForTopic`/`showStorylineById`/`showStorylineByChainId` calls `showStoryline` — they each reach `openStorylineScreen`/their own resolver directly. Breaking `showStoryline()` alone survived the whole rest of `unit-ui-journeys.test.js` silently at `v81_u` until a DEDICATED assertion was added for it specifically — the same "mutation surviving is not proof of correctness" lesson `v81_n` learned from `showSettings`'s dropped event argument, in a new shape: a seam with FOUR sibling names needs its OWN name proven, not just its siblings' |
| the acceptance test | `test/unit-ui-journeys.test.js` — the route-parity reference for `PLAN §C0`. Extend it, don't bypass it, when moving a surface behind these seams. ⚠️ It does NOT catch everything — `v81_o` broke three unrelated SOURCE-TEXT pins in `unit-learner-nav.test.js` that only a full-suite run surfaced. `v81_r`'s teacher-dashboard journey exits via a direct `showGenerationClean()` call, not a simulated click on the "🌍" button — that button is STATIC markup, and this harness never parses raw HTML outside the `<script>` block into its fake DOM (only JS-rendered `innerHTML` becomes real nodes), so there was never an element there to click. `v81_s`'s lesson-set journey hit a DIFFERENT harness gap while asserting entry rendered something: `buildPath()` builds `#lesson-path` via `createElement`/`appendChild`, and `.innerHTML` never reflects that — assert `.children.length` instead (see §5). `v81_t`'s mutation test needed the SAME isolation trick `v81_s` used: the pre-existing "learner" journey block (which exercises `showLesson()` indirectly via `us-next`) catches a broken delegate FIRST, before the new lesson-screen block even runs — a standalone script isolating just the new block's own assertions is what actually proves it is not vacuous. `v81_u` needed FOUR separate mutation tests, one per wrapper name — see the row above for why `showStoryline()` specifically needed its own |

**PLAN §C5 — splitting generation from the library** (`v81_v`–`v81_x` — a NEW track, distinct from
`PLAN §C0`: real UI redesign, not naming/routing. Two user rulings shape it: language pickers
duplicate but stay SYNCED (one shared value, shown on two screens) rather than being decoupled; and
"🌍 home" now means the LIBRARY, not generation)

| what | where |
|---|---|
| **stage 1 (`v81_v`) was naming/routing prep, zero visual change** | `goLibraryClean()`/`showLibraryClean()` added as the "home" destination; 10 callers rerouted from `showGenerationClean()`. Its body was DELIBERATELY byte-for-byte `goLandingClean()`'s at the time — both showed `'landing'`, because the screen split had not happened yet |
| **stage 2 (`v81_w`) is the actual split — real visual change, verified in a live browser, not only headlessly** | `#gen-area` + `.backend-row` + `.lang-box` (unchanged, own ids intact) MOVED out of `#landing` into a NEW `#generation-screen` (`sl-screen-hdr`/`sl-screen-body`, matching teacher-screen/lesson-set's own convention — no new CSS needed). `goLanding()`/`goLandingClean()` now `show('generation-screen')`; `goLibraryClean()` still shows `'landing'` — the two bodies FINALLY diverge, exactly as `v81_v`'s comment said they eventually must |
| **`landing`'s own nesting is NOT what it looks like — read before touching it again** | `.landing-inner` (opened right after `#landing`) closes RIGHT AFTER the language picker + "Generate new" button, NOT after the library section as the indentation suggests. `#tts-footer-landing`/`#teacher-mode-bar`/`.library` are children of `#landing` DIRECTLY, outside `.landing-inner`. Confirmed with a real HTML parser (Python's `html.parser`, stack-tracking `<div>`/`</div>`), not by eyeballing indentation — the file also carries one genuinely-orphaned extra `</div>` at the very end of the block (harmless; browsers silently ignore an unmatched closing tag), which the parser check must expect, not flag as a bug to fix |
| **the library's own picker is a NEW, separate, SIMPLER duplicate** — `lib-src-lang-select`/`lib-lang-select` | full option list (same values, "all" included — unlike the footer selects, which filter it out), NO script sub-picker (script choice is a generation-time decision, stays only on the canonical `.lang-box`). `selectSrcLang`/`selectLang` sync BOTH directions: changing either select's value calls the same function with `fromForm=true`, which now also writes the OTHER select's `.value` to match — but only on a REAL `fromForm=true` change, never on a `fromForm=false` footer-driven mid-story view (that distinction is why the library filter does not silently follow whatever language a learner happens to be reading) |
| **`applyUIStrings()` re-clones the mirror's OPTIONS from the canonical select on every call** | `Array.from(tgtSel.options).map(...)` into `lib-lang-select.innerHTML`, compared against `tgtSel.value`/`srcSel.value` (the CANONICAL select's own current value) for which option is `selected` — **not** `APP.lang`/`APP.srcLang`, which track the active RENDER CONTEXT and can differ from the form's own value while viewing an unrelated lesson (`selectLang`'s own `fromForm` guard is exactly this distinction, one line up) |
| ⚠️ **the static build's `_limitLangOptions` must be re-applied after every re-clone, not just once** | `renderPill()` hides `<option>`s for languages absent from a given static build — but `lib-lang-select`'s options are REBUILT from scratch by `applyUIStrings()` (unlike `lang-select`'s own options, which persist in place across repeated calls), so a hiding done once in `renderPill()` is silently LOST the next time a language change re-clones the mirror. Fixed by hoisting `_limitLangOptions` to module scope in `build-static.js` and calling it again inside `selectSrcLang`'s `loadUIStrings(...).then(...)` callback — the one static-mode path that re-triggers `applyUIStrings()` |
| **the static build's old "relabel to 🗣️From/📖To" hack is GONE** | it assumed ONE combined picker doing double duty as both the generation form and the library filter — obsolete now that there are two REAL, separate pickers, each already sensible as-is ("I speak"/"I learn" reads fine as a filter label too, and the generation screen's picker remains literally functional: SYNCED to the library filter even with generation itself disabled) |
| **`#offline-note`/`static.info`/`lib.empty` all referenced "above"/"below" the (now nonexistent) combined page** | reworded in `ui.json`'s `en` table only, per the project's `en`-only convention for a changed string: `form.offline` now says "tap 🌍 for your saved lessons", `static.info` says "go home (🌍) to pick a saved lesson", `lib.empty` keeps "above" — deliberately true again, because the new "✨ Generate new" button was placed ABOVE `#saved-list` on purpose so this one phrasing could stay literal |
| the acceptance tests | `test/unit-ui-journeys.test.js`'s generation block now asserts `'generation-screen'`, not `'landing'`, for `showGeneration()`/`showGenerationClean()` — and needed `await settle()` added to TWO spy blocks that had been passing without it by what turned out to be timing coincidence, not by being genuinely synchronous (`goLandingClean()`'s screen-transition happens inside an async `.finally()`). **New file `test/unit-lang-picker-sync.test.js`** is the dedicated guard for the sync mechanism itself: both directions of sync, the `fromForm=false` non-propagation property, the "all" reset, the static option lists matching source-text, and the onchange wiring — six checks, all mutation-tested |
| ⚠️ **the static build's "Generate new" button must be HIDDEN, not left clickable** (`v81_x`, same-session follow-up caught by the user in a live check of `docs/index.html`) | generation is entirely disabled in static mode — a visible `lib-generate-new-btn` opened `#generation-screen` onto nothing but the "no LLM" overlay. `renderPill()` now hides the button next to its existing `#gen-area`/`.backend-row` hiding. Guarded by `test/unit-static-gen-btn-hidden.test.js`, which — like `unit-static-selectlang-tts.test.js` — asserts against the WINNING `renderPill` definition in the BUILT `docs/index.html` (defined twice; the later one wins in a browser), not the builder's string-array source |

**PLAN §C4 — the Settings Card** (`v81_y` stage 1: shell + low-risk items; `v81_z` "keep going":
global mute-pill consolidation; `v81_aa`: the "arrow control" acceptance detail; `v81_ab`: arrow
visual follow-up + read-aloud icon consistency + the teacher-mode toggle finally consolidated;
`v81_ac`: UI language DECOUPLED from "I speak" and moved into Settings, reversing an earlier
placement decision; `v81_ad`: the speech-mismatch status pill, the LAST acceptance-detail fork.
Model selection and speech-language/sound-test remain RULED OUT of this track entirely. **§C4 is
now fully done — nothing is owed.**)

⚠️ **naming collision to know about, not a bug**: `showSettings()` (`v81_n`, `PLAN §C0.2`) already
existed before this track — it is the `#bpill` model-backend pill's click handler, wrapping
`toggleModelPop()`. It is UNRELATED to this section's `#settings-modal`/`openSettings()`/
`closeSettings()`, the new Settings Card. Both are internally called "settings" because both are,
in English, settings — but they open two different popovers with no shared code. Not user-visible
(the model pill carries no "Settings" label), but worth knowing before grepping for one and finding
the other.

| what | where |
|---|---|
| **the shell**: `#settings-pill` (⚙️) next to the existing "Sign in" pill | both live inside a NEW shared `#corner-pills` fixed wrapper (bottom-left) — placed "next to" rather than at a hardcoded pixel offset, so it tracks `#acct-badge`'s own width (Sign in vs. a signed-in username) automatically. `#acct-badge` keeps its own id and `display:none`-by-default toggle (`APP.info.canGenerate`-driven), now just without owning the `position:fixed` itself — the wrapper does. `#settings-pill` carries **no** default hiding: unlike the login pill, it must work in the static build, which never sets `canGenerate` |
| **the card**: `#settings-modal` | same modal idiom as `#acct-modal` (fixed inset overlay, centered white card, `×` close) — not a new visual language. `openSettings()`/`closeSettings()` mirror `openAccount()`/`closeAccount()` exactly. No dynamic state to refresh on open: every row inside keeps its own visibility current via the EXISTING `applyUIStrings()`/`updateUITranslateRow()` calls, unchanged, regardless of whether the card happens to be open |
| what actually moved in | four already-single-instance, self-contained controls, unchanged internally, including their existing show/hide conditions: `#ui-translate-row` (the missing-UI-strings notice — reads `APP.srcLang`, a global, so its DOM location never mattered to its own logic), `#export-static-btn`/`#teacher-dash-btn` (both `APP.info.canGenerate`-gated, hidden without a backend), and the `.import-btn` label (unconditionally visible, live and static alike — pre-existing, unrelated to this move) |
| ⚠️ **the teacher-mode toggle is deliberately OUT of this pass** | `v78_f` placed it in THREE instances on purpose — `teacher-mode-btn` (landing/library, full width), `teacher-ico-ls` (lesson-set footer, compact), `teacher-ico-sl` (storyline footer, compact) — by explicit user ruling: reachable from every page that HAS the footer controls, because the lesson-set page itself is invisible to learners. Folding all three into one shared Settings Card instance would reverse that ruling, not just relocate a control that happens to be scattered — it needs its own decision. `test/unit-settings-card.test.js` check #5 guards that this stage did not silently do it anyway |
| the acceptance tests | `test/unit-settings-card.test.js` — source-text containment checks (mutation-tested: temporarily pulling a control out of the `#settings-modal` slice, and temporarily collapsing `_TEACHER_TOGGLES` to one entry, both confirmed to turn the relevant check red) for what moved and what deliberately did not, plus a live DOM check that `openSettings()`/`closeSettings()` actually toggle the card. Verified in a real browser against BOTH the live server and the built `docs/index.html` (served over a plain static HTTP server) — the pill opens the card on every screen tried, and in static mode `#export-static-btn`/`#teacher-dash-btn` render `display:none` as expected while `.import-btn` stays visible |
| ⚠️ **model selection and speech-language/sound-test were RULED OUT of the Settings Card entirely**, not just deferred (`v81_z` scoping) | both are CONTEXT-BOUND — model choice only means anything while generating, speech/sound-test only means anything for whichever lesson is currently open — unlike every genuinely global item stage 1 absorbed. The model popover (`#bpill`/`toggleModelPop()`) stays on `#generation-screen`; the sound-test row (`#tts-voice-note`) stays wherever a lesson is being read. If this is ever revisited, it needs its own ruling, not an assumption that the roadmap's original list still applies verbatim |

**`v81_aa` — the "arrow control" acceptance detail**

The user's original UI brief, condensed to one roadmap sentence: "The source→target language
selector is visually reduced to an arrow control: remove its duplicated icons and descriptive text
without changing the selected language-pair state." Confirmed with the user before building — the
arrow is INERT, a plain separator glyph, not a clickable control; only the wrapper (icon + label)
around each `<select>` goes, not the selects' own interactivity.

| what | where |
|---|---|
| what was removed | the 🗣/📖 icon + `<label data-i18n="form.i_speak"/"form.i_learn">` pair that sat above each of the FOUR selects (`src-lang-select`/`lang-select` on `#generation-screen`, `lib-src-lang-select`/`lib-lang-select` on the library screen — both synced copies got the same treatment, since both are literally this same selector) |
| where the strings went | `title=` tooltips on the selects themselves — same convention `v79_o` already established for the sound-test row ("the strings stay in ui.json and move to the title attributes, so the explanation is one hover away and no translation is orphaned"). Static markup carries the English placeholder (`title="I speak"`/`title="I learn"`); `applyUIStrings()` wires the real localized value via `_setAttr(id, 'title', t(key))`, the SAME idiom every other title-tooltip in that function already uses |
| what became dead, and was removed rather than left as a no-op | the generic `document.querySelectorAll('.form-lbl[data-i18n]')` sweep — it existed to translate exactly these two labels and nothing else, so once they were gone it had zero elements left to match. An adjacent, already-dead, unrelated line (`const spkLbl = document.querySelector('.form-lbl[for-i-speak]')` — a selector that never matched anything, before OR after this change) was removed in the same edit since it sat in the exact block being restructured |
| the arrow itself | `.lang-pair-arrow` previously had NO CSS rule at all (bare "→" text, default inline flow) — now styled, since it graduated from a minor decorative touch next to two fully-labeled columns to the PRIMARY visual separator between two now-bare selects. `.lang-pair-row` changed `align-items` from `flex-end` to `center` — moot for the columns themselves (each is now just one child, so any alignment looks the same), but centers the arrow properly against them. ⚠️ Sizing SUPERSEDED at `v81_ab` — see that entry below for the current `font-size`/glyph |
| the acceptance test | `test/unit-lang-pair-arrow.test.js` (7 checks, 2 mutation-tested): no icon/label survives beside any of the four selects; each carries a static `title=` placeholder; `applyUIStrings()`'s wiring exists for the real value; the dead sweep is gone; the arrow rule has real `font-size`/`color`; exactly 2 arrows exist file-wide (one per synced copy). Note what it does NOT establish: `applyUIStrings()` has enough unrelated DOM dependencies (per `unit-lang-picker-sync.test.js`'s own experience) that a full harness run of it needs shimming disproportionate to what this file is about — the actual title VALUES after a real run, and the live rendered layout, were verified in a real browser instead (both screens, plus a live language change confirming the selected-pair STATE is unaffected), against both the live server and the rebuilt static build |

**`v81_z` — global mute-pill consolidation ("keep going" past stage 1)**

| what | where |
|---|---|
| the pill | `#mute-pill`, `class="mute-btn"`, added to `#corner-pills` alongside `#settings-pill`/`#acct-badge`. `updateMuteButtons()` was ALREADY generic (`document.querySelectorAll('.mute-btn')`) — only the button was scattered, so the updater needed zero code changes |
| what was removed | six `.mute-btn` instances: the dead, always-`display:none` `#tts-footer-landing` copy (v79_l already documented it as toggled by nothing — removing its mute-btn is safe, the select elements it also carries stay, per that same prior decision); the library header; the `lesson-set`/`storyline-screen` footers (`stop-gen-btn`/`teacher-ico-*` in the same row are untouched); the question-nav `.btn-row`'s own toggle; and the sound-test row's copy (`data-mute-tip`/`tts.voice_mute_hint`, its "if the sound is bad, mute it" tooltip — now unused, left in `ui.json` rather than pruned across every language, a separate cleanup) |
| ⚠️ **a real, previously-unknown bug found and fixed as a drive-by**: `#qback` (the "← previous question" button) carried `class="mute-btn"` too | copied along with the rest of its inline styling when the row was built — coincidental, since `.mute-btn` carries no CSS rule of its own, it exists ONLY as `updateMuteButtons()`'s query-selector target. Because that updater rewrites `textContent`/`title` on EVERY matching element, clicking mute anywhere while a question with `cur>0` was open silently turned qback's "←" into a second 🔇/🔊 icon with the WRONG tooltip — `onclick` stayed `qPrev()`, so the click itself still worked, only the label lied. Reproduced with a standalone harness script BEFORE fixing (confirmed corrupted text/title), and again AFTER (confirmed clean) — not inferred from reading alone. Fixed by dropping the stray class; nothing else about `#qback` changed |
| the acceptance tests | `test/unit-mute-consolidation.test.js` (6 checks, all mutation-tested): exactly one real `.mute-btn` remains file-wide (a naive `class="mute-btn"` text search over-matches — TWO of the file's own explanatory comments contain that literal string; the count regex requires an immediately-preceding `<button`); it lives in `#corner-pills`; `updateMuteButtons()` is unchanged; `#qback` no longer carries the class; and a live-DOM repro of the FIXED bug (built via `innerHTML`, since the harness never parses static markup into real nodes — see `INTERNALS.md` §5) confirms a mute toggle updates the real pill and leaves a "←"-alike button untouched. Also required updating TWO pre-existing guards whose claims changed, not just their text (rule 29): `unit-tts-test-row.test.js` (the sound-test row's mute button is now REQUIRED ABSENT, inverted from requiring it present) and `unit-speech-locale.test.js` §10 (`tts.mute_hint_short` must no longer appear at all, rather than surviving as a tooltip) |
| verified live | real browser against the running server: the corner pill toggles correctly and is the ONLY `.mute-btn` in the live DOM; the library header, `lesson-set` footer, and generation screen's sound-test row all confirmed mute-button-free |

**`v81_ab` — three user follow-ups: the arrow gets thicker, read-aloud icons stop looking like the mute button, and the teacher-mode toggle finally moves into the Settings Card**

| what | where |
|---|---|
| **the arrow, round 2**: thicker, sized to the selects, never taller | `.lang-pair-arrow` now pins an explicit `height:44px` (the select's own LIVE-measured height) with `display:flex;align-items:center`, so the arrow's box can never exceed the selector's by construction, not by font-metric luck. The glyph itself changed from thin `→` to the heavy round-tipped `➜` (U+279C) at `font-size:34px;font-weight:900` — a Unicode arrow's visual weight lives mostly in the glyph, not the CSS weight, so swapping the character mattered more than bumping the number |
| **every "click to hear THIS text" trigger stopped showing 🔊** | it was visually indistinguishable from the newly-consolidated global mute pill (`v81_z`), even though the two are unrelated (app-wide sound on/off vs. "speak this one thing now"). Landed in two steps: first 🗣 (matching the pre-existing `.lang-footer-lbl.tts-pill` speech-state pill), then an immediate follow-up swapped that to 💬 (U+1F4AC) EVERYWHERE the app used 🗣 for speech — not just the ~12 read-aloud triggers, but the tts-pill itself, the dialect-glossary labels (`form.use_dialect`/`dialect.studio.intro`, baked per-language in `ui.json`, mechanically swept), and the sound-test button. The ONE 🗣️ left untouched is the icon-picker's own palette entry (`EMOJI_CATEGORIES`) — a real risk here, since a naive global replace would have corrupted it (it uses the VS16 variant `🗣️`, which contains the bare `🗣` as a prefix); the actual replacement used a negative lookahead for the VS16 codepoint specifically to spare it |
| ⚠️ **`tts.voice_test`'s icon moved from a baked ui.json string into code** | was `"🔊 1, 2, 3"` per language (33 blocks); now `"1, 2, 3"` (language-agnostic digits, so the mechanical strip was safe) with the icon prefixed in code — matching the established convention (`gen.title`/`settings.title` also add their emoji in code, not the translated string) |
| the acceptance tests | `test/unit-speech-icon-consistency.test.js` (6 checks, 1 mutation-tested) enumerates every `onclick="...speak...("` call site (Rule 32: guard the enumeration) across BOTH `index.html` and `build-static.js`'s two re-implementations, plus the two triggers invisible to that enumeration (`#us-spk`, JS-property-assigned; `#sum-sum-spk`, unwired — a pre-existing, unrelated gap, not this change's doing). The one deliberate exception, the "🐢 Slow" playback-speed variant, never showed 🔊 and keeps its own turtle+text label |
| **the teacher-mode toggle, finally consolidated** | `v78_f`'s original reachability justification (three instances, because no single page reached every learner) is satisfied by the Settings Card itself now — reachable via `#settings-pill` on every screen including static. The full-width `#teacher-mode-bar` and the two compact footer icons (`teacher-ico-ls`/`teacher-ico-sl`) are ALL gone; the SINGLE remaining instance lives in `#settings-modal`'s action row. `_TEACHER_TOGGLES` is down to one entry — kept as a list, not hard-coded, so a FUTURE second instance still has one place to register rather than reintroducing per-instance drift. Two now-unnecessary "force the bar visible" snippets removed (live `init()` and `build-static.js`'s init override) — `#settings-modal` carries no default hiding, so there was nothing left to force. **`v86_l`** (user-requested): the control ITSELF changed shape — `#teacher-mode-btn` (a single "click to flip" button, `onclick="toggleTeacherMode()"`) became `#teacher-mode-select` (a `<select>` with two explicit named `<option>`s, `id="teacher-mode-opt-teacher"`/`-student"`, `onchange="setTeacherMode(this.value)"`) — a bare lock icon never made which mode it meant obvious without reading the tooltip. `updateTeacherModeBtn()` now also syncs BOTH option labels (not just the selected state) on every `applyUIStrings()` pass, via two new `en`-only keys (`teacher.option_teacher`/`teacher.option_student`) rather than static markup + a `data-i18n` sweep, since this control already owned an update function. |
| the acceptance tests | `test/unit-settings-card.test.js` check #5 REWRITTEN (not just re-anchored, rule 29): the claim inverted from "three v78_f instances survive untouched" to "exactly one instance, inside the card, the old three-instance markup fully gone" — mutation-tested both directions (renaming the surviving instance's id, and reintroducing one of the old ids alongside it). `test/unit-teacher-toggle.test.js` REWRITTEN wholesale: the old file's footer-containment and three-presentations-agree checks no longer apply to a single instance; what survives is the functional claim that still matters regardless of instance count — clicking flips `APP._teacherMode`, persists to `localStorage`, and shows the correct label each direction — mutation-tested |
| verified live | real browser: the old bar/icons are gone from the DOM entirely; the single toggle lives inside `#settings-modal`, clicking it flips state and re-labels correctly; the arrow's live-measured height exactly matches the select's (44px = 44px) |

**`v81_ac` — UI language DECOUPLED from "I speak", moved into Settings (reversing a prior decision)**

Two rulings given directly, after presenting the mechanism found by measuring first (not
guessed): **(1) FULLY DECOUPLE** — `APP.uiLang` is a genuinely SEPARATE field from `APP.srcLang`
("I speak"), not the same field serving two roles, so generating or playing a story never forces
the app's own chrome to switch language; **(2) STORYLINE ONLY** — `goLessonSet`'s identical
auto-follow-on-open mechanism is untouched, keeps its old conflated behaviour, gets no overrule
option. The measurement that grounded both rulings: `APP.srcLang` was ALREADY the field
`loadUIStrings()`/`applyUIStrings()` rendered the chrome in, and BOTH `goLessonSet` and
`openStorylineScreen` auto-overwrote it (and, with it, the visible UI language) to match whatever
content's own source language you opened — the footer selectors did the same thing manually,
mid-story, non-persistently.

| what | where |
|---|---|
| **the new field** | `APP.uiLang` (`loadUiLang()`/`saveUiLang()`, `localStorage['imp3_uilang']`) — falls back to the EXISTING `imp3_srclang` value when nothing has ever been saved, so an existing learner's UI does not silently change on this release, only becomes independently adjustable going forward. `APP.overruleStorylineLang` (`loadOverruleStorylineLang()`/`saveOverruleStorylineLang()`, `imp3_overrule_sl`) — default OFF, preserving the pre-existing auto-follow behaviour for storylines exactly |
| ⚠️ **which `APP.srcLang` call sites became `APP.uiLang`, and which stayed** | ONLY the ones that render the app's own CHROME: `updateDocDir()`'s `dir` check (the OTHER half, `tgt-rtl` content-direction marking, stays keyed on `APP.lang` — a genuinely separate, unaffected concern), the `loadUIStrings()`/`applyUIStrings()` call chain (every caller — `init()`, `triggerUITranslation()`, the target-select's own option-label loop, `topicLabelText()`), and `_restoreFormLang()`'s restore-on-return. The OTHER ~55 `APP.srcLang` usages (generation-request payloads, translation hints, per-word learned-ledger keys, tutor scope, content fallbacks) are untouched — those are "I speak"/content concerns, not UI-chrome concerns, and were deliberately NOT touched despite superficially looking similar |
| **`selectSrcLang(code, fromForm)` — the actual decoupling** | `fromForm=true` (the generation form's OWN "I speak" picker, both synced copies) no longer calls `loadUIStrings` AT ALL — returns early after updating the library filter. `fromForm=false` (the lesson-set footer, the ONLY remaining caller now that the storyline footer is gone) still sets `APP.uiLang` and reloads UI strings, preserving its old "mid-story glance in another language" behaviour exactly — TRANSIENT, not persisted via `saveUiLang()`, same as it was never persisted via `saveSrcLang()` either. `build-static.js` has its OWN copy of this function — kept paired |
| **`openStorylineScreen()` — content vs. chrome, split into two independent checks** | `APP.srcLang = slSrc` runs UNCONDITIONALLY (content context always follows the storyline's own source language, regardless of the overrule setting). The UI-language auto-follow (`APP.uiLang = slSrc; loadUIStrings(slSrc)`) is gated behind `!APP.overruleStorylineLang`. `APP._slLangMismatch` is computed on every open (`overruleStorylineLang && slSrc !== APP.uiLang`) for the warning pill, whether or not the auto-follow actually ran |
| ⚠️ **`goLessonSet`'s auto-follow — NOT simply "unconditional, no overrule", a real bug was found and fixed here** | `APP.srcLang` still ALWAYS follows the opened topic, unconditionally — that part really is unchanged. But `goLessonSet` is not just the standalone lesson-set's own entry point: it is the SHARED plumbing `loadSaved()` uses for EVERY chapter open, including a storyline's own "continue to the next chapter" — so an unconditional `APP.uiLang` follow here was silently overriding the overrule flag on every chapter transition inside a storyline, reported live by the user and reproduced with call-site instrumentation before fixing. Fixed by checking storyline MEMBERSHIP (`_storylineIdForTopic(APP.lessonData.topic)`), not entry point: `_slOverruled = _slId && APP.overruleStorylineLang` gates the `APP.uiLang` follow (and sets `APP._slLangMismatch`, mirroring `openStorylineScreen`) ONLY when the topic actually belongs to a storyline. A genuinely standalone topic (`_storylineIdForTopic` returns `null`) keeps the old fully-unconditional behaviour — that case really is still out of the "storyline only" ruling's scope. `build-static.js` needed no separate fix: neither `goLessonSet` nor its own `loadSaved` override call into anything that duplicates this logic, so the live fix applies verbatim |
| **the Settings Card additions** | `#ui-lang-select` (`selectUiLang(code)` — sets + persists `APP.uiLang`, reloads UI strings, re-renders whatever's active, the same "retranslate everything" step `selectSrcLang` used to do before decoupling) and `#overrule-sl-lang-cb` (`toggleOverruleStorylineLang()` — flips + persists the flag, and if a storyline happens to already be open, re-evaluates the mismatch pill immediately rather than waiting for the next open). Both live in `#settings-modal`, on the SAME row (the checkbox originally forced itself onto its own line via `flex-basis:100%`, dropped in a same-session follow-up) |
| **the checkbox's visible label is short on purpose** | `settings.overrule_sl_lang` = "Fix" (shortened, same-session follow-up, from "Keep fixed while playing storylines") — the fuller explanation survives as `settings.overrule_sl_lang_title`, a hover tooltip on `#overrule-sl-lang-row`, the SAME "short label + `title=` tooltip" convention `v79_o` already established for the sound-test row |
| **the storyline footer, and what survived it** | `#lang-footer-storyline`'s language `<select>` is GONE (moved to Settings); its `.tts-pill` (💬 — SPEECH-VOICE availability, an unrelated, class-driven-uniformly concern) and its stop-gen button both STAY, unrelated to language selection. `#lang-footer-lessonset`'s own picker (`src-lang-select-footer-ls`) is completely untouched, out of scope by the "storyline only" ruling |
| **the warning pill** | `#sl-lang-mismatch-pill` inside `_renderStorylineScreen()` — shown when `APP._slLangMismatch` is true, text from `t('storyline.lang_mismatch', {lang: localizedLangName(_firstTopicSrc, APP.uiLang)})`. Re-read (not re-derived) from the flag whichever caller set — `openStorylineScreen()` for the storyline-browsing entry, `goLessonSet()` for a chapter opened via `loadSaved()` (see the bug-fix row above) — since this render function has other callers (e.g. after an edit) where recomputing risks drifting from the value the actual open used |
| the acceptance tests | `test/unit-ui-lang-decouple.test.js` (14 checks, 2 explicitly mutation-tested, plus a live functional repro exercising the bug scenario and the still-in-scope standalone case side by side): the storyline footer picker is gone while lesson-set's survives; the Settings Card holds both new controls sharing one row with the shortened label + tooltip; `selectSrcLang`'s `fromForm=true` branch provably never reaches `loadUIStrings` while `fromForm=false` still does; `updateDocDir()` reads `uiLang` for chrome direction and STILL reads `APP.lang` for content direction; `openStorylineScreen`'s AND `goLessonSet`'s content-context vs. chrome-language splits (the latter including the storyline-membership gate that fixes the reported bug); the warning pill's markup/wiring/string; `_restoreFormLang()`'s restore-from-persisted-preference; a live functional round-trip of the overrule toggle; and `build-static.js`'s override staying paired. Fallout: ONE pre-existing test (`unit-ui-journeys.test.js`) needed its fixture updated to seed `APP.uiLang` (and persist it via `saveUiLang()`, since `_restoreFormLang()` now compares against a REAL `localStorage` read) — found by running the full suite, not assumed; the other 40 files that also set `APP.srcLang` never actually exercise the router functions this touches, confirmed by the full suite passing clean everywhere else |
| verified live | real browser, against BOTH the live server and the rebuilt static build: "I speak" changing to German left the (English) UI completely alone; the Settings picker changing UI language to German correctly re-translated the whole chrome without touching `APP.srcLang`; opening a German-source storyline CHAPTER via `loadSaved()` (the exact reported path) with overrule ON kept the UI in English, where it had previously leaked to German; the SAME storyline with overrule OFF auto-followed to German exactly as before this release; a genuinely standalone topic still auto-followed regardless of the fix; returning to the library restored the UI language to the persisted preference; the lesson-set footer's old mid-story-glance behaviour survived unchanged; the checkbox now shares the picker's row with the shortened "Fix" label and the full tooltip |

**`v81_ad` — the speech-mismatch status pill, `PLAN §C4`'s LAST acceptance-detail fork — §C4 is now fully done**

Two SEPARATE mechanisms, measured before writing code: `_speechLocaleFor(lang, topicId)` (`v79_n`)
is the AUTHORED "intended" locale (chapter, then storyline, then `languages.json`'s default).
`APP.ttsLang` is a SEPARATE global OVERRIDE, set only by the lesson-set footer's "speech language"
picker (`onTtsLangSelectGlobal`/`onTtsSelect`) — which lists every LANGUAGE's tts code, not just
locale variants of the one being read. `activeTtsCode()` prefers `APP.ttsLang` when set; an explicit-
langCode read-out bypasses it entirely via `_speechLocaleFor(langCode)` directly (`_speakChunks`),
already guarded by `unit-speech-locale.test.js` §11. So "mismatch" is exactly one comparison:
`APP.ttsLang` vs. `_speechLocaleFor()` for the open lesson.

| what | where |
|---|---|
| the resolver | `_speechMismatchInfo()` (next to `_speechLocaleFor`) — `null` unless a lesson is open, an override is active, AND the two locales disagree (case/underscore normalized); else `{active, intended}` |
| the pill | `#speech-mismatch-pill` inside `#settings-modal`, styled like the existing `#sl-lang-mismatch-pill` (same warning-pill convention). `updateSpeechMismatchPill()` refreshes it — called from `openSettings()` only (the same "sync on every open" choice `#overrule-sl-lang-cb` already made), not kept live while the card is closed |
| the restore action | `restoreIntendedSpeech()` clears `APP.ttsLang`/`APP._ttsVoiceName` (the SAME reset pair `goLanding()`/`goLandingClean()`/`goLibraryClean()` already use) so `activeTtsCode()` falls through to `_speechLocaleFor()` on its own — not a second speech mechanism |
| language names, not raw codes | `_speechCodeLangName(code)` reverse-looks-up which `LANGS` entry owns a tts code (same pattern as `refreshTtsVoiceState`'s `_ttsNoVoice` call) and localizes it via the existing `localizedLangName()` |
| ⚠️ **a measured non-bug, not this release's scope** | `buildPath()` (the lesson-set page's own renderer) unconditionally resets `APP.ttsLang` to the LANGUAGE's plain default tts on every render, ignoring any chapter/storyline `speechLocale` — today this happens to equal `_speechLocaleFor()`'s own answer for every chapter in the corpus, because **zero topics or storylines currently set `speechLocale` at all** (checked directly against `lessons.json`). If that ever changes, `buildPath` would need to seed from `_speechLocaleFor()` instead — left alone here since nothing today depends on it |
| the acceptance test | `test/unit-speech-mismatch-pill.test.js`, 14 checks: the resolver's null cases (no lesson, no override, exact match, a normalized-equal match), a genuine cross-language mismatch, inheriting a chapter- AND storyline-level `speechLocale` as "intended" (future-proofing, per the row above), the pill's hidden/shown states and text, restore clearing both fields and re-hiding the pill immediately, `openSettings()` refreshing the pill on every open, markup containment inside `#settings-modal`, the wired `onclick`, and the ui.json strings. Mutation-tested the resolver three ways and the `openSettings()` refresh call |
| verified live | real browser against the running server (a genuine mismatch showed correctly localized names in the session's active UI language, and a real `.click()` on the Restore button cleared it) and against the rebuilt `docs/index.html` (LANGS seeded manually, since the static harness never runs `init()`). One harness-only false alarm along the way: `lib-dom.js`'s `.click()` is a documented no-op that never dispatches `onclick` — calling `restoreIntendedSpeech()` directly (and the real browser's real click) both confirmed the button is correctly wired |

**PLAN §8/B1–B4 — observations, target-language skills, vocabulary tags, and shadow BKT** (`v81_j`–`v81_l`)

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
| **B4 shadow calculation** | `BKT_SHADOW`, `bktShadowSkills(observations)`, and `refreshBktShadow(d)`. Each new graded observation recomputes canonical skill `pMastery` from the append-only log using `{pInit:.20, pLearn:.15, pSlip:.10, pGuess:.20}`. The derived cache is `APP.progress.bktShadow` (`skills`, tagged `topics`, and disagreement transitions) |
| **B4 boundary** | only topics with reviewed `vocab[].skillId` values are compared. `refreshBktShadow` reads `_setCompleteRaw(d)` only to log a changed `gateComplete`/`bktComplete` disagreement. **No gate, renderer, picker, or progression reader consumes BKT state.** Pending and legacy topics are incomparable (`null`), not failures |

**TRACK T — the text-focused progress card** (all in `index.html`, built across the `v80` line)

| what | where |
|---|---|
| **per-word progress — the ONE collector** | `_wordProgress(d)` → `Map<word, {n, ok, bySrc}>`. `bySrc` is `{extra, vocab, sentence}`; `n`/`ok` are the totals. **`_solvedExtraWords` and `_solvedTargetWords` are thin wrappers over it** — do not compute word state any other way |
| **the denominator is BUILDABLE questions only** (`v81_d`) | `_wordProgress` / `_wordQuestions` intersect declared probes with `_lessonQidUniverse`. Declared ≠ buildable: measured 60.8% — `type_conjugation` 0 of 210, `syn_select` 142 of 192. ⚠️ **SCOPED TO THE OPEN CHAPTER**: `_lessonQidUniverse` indexes into `APP.lessonData` and ignores the `d` argument, so for any other chapter it returns an EMPTY set and would filter everything — it fails OPEN there. `_renderChainStory` is the live path (`v74_n`) |
| **`§T7` demotion — a wrong answer un-greens a word** (`v81_e`) | `APP.progress.wrong[topic][qid]`, written by `markWrong`, CLEARED by `markSolved`. Read by `_wordState` (green → **partial**) and by `_wordQuestions`/`tapWord` (a since-failed question counts as work to do). ⚠️ **HIGHLIGHT ONLY, by user ruling**: it is a SEPARATE counter (`rec.bad`), never subtracted from `n`/`ok`, so `_wordGateFraction` — which reads `ok >= n` — cannot inherit it and a mistake can never re-lock a story. Pinned by `unit-word-progress` §9 |
| **tapping a word with NO question** (`v81_f`) | `_wordLessons(d, word)` — the ONE "which lessons TEACH this word" resolver, separate from `_wordQuestions` (which answers "which QUESTIONS"). `tapWord` consults it ONLY when there is no question, so a question-less destination never competes with real ones. ⚠️ 79 words are taught only by a HIDDEN lesson and correctly still return false — `startLesson` refuses those, and that is the load-bearing refusal, not `_wordLessons`' own filter |
| **storyline progress bar vs its label** (`v81_g`) | `_slProgressStats`: `pct` = `doneChapters/total` (the BAR, completion — coverage-aware `chapterComplete`), `unlockedChapters` = `doneChapters + 1` (the LABEL, access — the `v77_p` user ruling). ⚠️ They deliberately DISAGREE: a deck can read 3/3 with a 67% bar. `pct` feeds the three bars, `unlockedChapters` feeds `_slProgressLabel` only |
| the three states it paints | `_wordState(rec)` → `'red' \| 'partial' \| 'green'`. GREEN = **every** associated question solved (`§T5.1`, ruled) |
| **the ONE story renderer** | `_storyBodyHtml(d, {text, highlight, ex})` — used by the question panel AND the progress cards. The FRAMES differ (a `<details>` vs `#comp-story-text`); only the body is shared. Since `v83_b`, when `highlight !== false` it also wraps its output in `<div class="story-selectable">` — the hook `PLAN §12`'s selection popover looks for, so every caller gets it for free. The `highlight === false` (source-language/translation) path is deliberately NOT wrapped, for the same reason it skips highlighting |
| **progress-card popup redesign** (`v83_c`, user, not a PLAN item) | `#complete-screen`'s "machinery" — `comp-storyboard`/`comp-lessons`/`comp-actions`/`comp-progress`/`comp-nav-btns` — moved OFF the scrolling page into `#comp-nav-modal` (same fixed-overlay shape as `#settings-modal`), reached via a ☰ button in the story panel's own `<summary>` header row, placed BEFORE the translation flags. Every relocated id keeps its EXACT existing `showComplete()` wiring — nothing was reimplemented, only moved. `_syncCompHdrNav()` (called once, at the very end of `showComplete()`, after every branch that can set `comp-next`'s destination has run) mirrors `comp-prev`/`comp-next`'s FINAL resolved state (text/title/aria-label/display/disabled/onclick) onto a header-row duplicate pair — a generic copy, not a re-derivation of the ~7 branches. `openCompNav()`/`closeCompNav()` mirror `openSettings()`/`closeSettings()`. The popup closes via `show(id)`'s own multi-`try` chain (same choke point PLAN §12's `_storySelHide()` uses — covers every screen change AND every same-screen `showComplete()` re-render, since that function ends with `show('complete-screen')`) and explicitly in `openCrosswordFromComplete()` (the one path that opens another overlay — `#cw-modal` — without a screen change). ⚠️ "Fill the full available screen" (`#complete-screen .comp-body{flex:1}` → `#comp-story-panel[open]{flex:1}` → `#comp-story-text{flex:1}`) was REVOKED at `v83_f` — the panel is back to natural content-sized height; the rule was removed from the stylesheet, not disabled, and `unit-progress-card-nav.test.js` §6 guards its ABSENCE. **SCOPE, decided by reading all four card screens' markup**: only `complete-screen` had enough "machinery" to justify hiding it at the time — the entry/summary card's own bars were ALWAYS EMPTY by design (`v77_h`) and its actions were one button. Two old ordering-invariant tests this knowingly supersedes (`unit-story-summary.test.js` §6, `smoke-render.test.js`'s row-order section) were REWRITTEN to state the new claim, not loosened |
| **… extended to the entry card** (`v83_d`, user follow-up: "navigation and next buttons could also be used on the entry card, incl. the progress bars") | `summary-screen`'s own `sum-storyboard`/`sum-actions`/`sum-progress` moved into a NEW `#sum-nav-modal` (same shape as `#comp-nav-modal`), reached via ☰ in `#sum-sumbox`'s header row — no back button exists on this card, so only `sum-next` gets a duplicate (`sum-sum-next`, no `sum-sum-prev`). The mirror/close logic was made properly SHARED rather than copy-pasted: `_syncCompHdrNav`'s inline mirror closure became a top-level `_mirrorNavBtn(srcId, dstId)`, called by both `_syncCompHdrNav` (end of `showComplete()`) and the new `_syncSumHdrNav` (end of `showStorySummary()`); `show(id)` now calls `_closeCardNavPopups()` (closes both `comp-nav-modal` and `sum-nav-modal`, a no-op on whichever was never open) instead of a direct `closeCompNav()`. `ui.json`'s `complete.nav_open`/`complete.nav_title` are reused verbatim for the entry card, not duplicated. ⚠️ "Thicker arrows" originally shipped here as a stroke (`-webkit-text-stroke`) — SUPERSEDED at `v83_e`, see that row below. `unit-story-summary.test.js` §6 needed a THIRD rewrite (its entry-card self-order sub-assertion broke the same way the progress card's had) |
| **… arrows swapped to the language-pair glyph** (`v83_e`, user: "even thicker... same as used between the source and target language selectors") | The `v83_d` stroke fix replaced with the ACTUAL reference glyph: `.lang-pair-arrow` is `➜` (U+279C) at `font-weight:900`, `34px`. `comp-story-next`/`sum-sum-next` now render `➜` statically at `26px`/`900` (scaled to fit the row); `comp-story-prev` reuses the SAME glyph with `transform:scaleX(-1)` rather than a different "leftwards" character. This forced `_mirrorNavBtn` to STOP mirroring `textContent` (a fixed glyph can't survive being overwritten back to `←`/`→` every render) — title/aria-label/display/disabled/onclick are still copied |
| **… fill-height REVOKED, question cards collapsed by default** (`v83_f`, user, two rulings) | 1) The `v83_c` fill-height flex chain (see the `v83_c` row above) was REMOVED from the stylesheet entirely, not disabled — `unit-progress-card-nav.test.js` §6 now guards its ABSENCE. 2) `_exStoryPanelHtml`'s `#ex-story-panel` (question/exercise screens, NOT the progress card) flips to collapsed by default, unconditionally — see the "question-screen panel" row above for the full ruling history. Four test files that had pinned the old `open` behaviour each needed the same fix: `unit-story-panel-states.test.js` §5, `unit-story-translation-toggle.test.js` (an explicit "same as the progress card" claim, now false — the two panels deliberately differ), `smoke-render.test.js` (comprehension's own exception, gone), `unit-progress-card-nav.test.js` §6 |
| **story-panel border: red→green with comprehension progress** (`v83_g`, user: "how far away the user is from the pass mark to get to understanding questions") | Two candidate "pass marks" exist on the progress card — `_topicMarkPct` (general chapter coverage) and the comprehension lessons' own separate 100%-required gate (`v71_s`) — a genuine ambiguity RULED by the user: the comprehension-specific one. `_sumCoverageFrac(rows)` (near `lessonCoverage`, index.html) SUMS `{solved,total}` across every row of `_postRows` — the SAME array `showComplete()` already builds for the post-unlock progress bars — into one fraction (empty → 1, nothing to be far from). `_redGreenHex(frac)` linearly interpolates `--red`/`--green`'s ACTUAL hex (`#ff4b4b`/`#58cc02`), clamped `[0,1]`. `_postRows` was hoisted OUTSIDE `showComplete()`'s drill/non-drill branch so a drill (never populates it) still resolves to green rather than a stale colour. Applied once, after the whole progress-bars block, to `#comp-story-panel.style.borderColor` — unconditionally, regardless of which branch ran. New `unit-story-border-color.test.js` |
| **the persistent tutor** (`v62`, extended `v83_b`, `v86_m`) | `_tutorScope()` derives WHERE the learner is asking from (`kind: 'lesson'\|'chapter'\|'storyline'\|'global'`); `_tutorGatherContext()` bundles `scope`, `lang` (target), `srcLang` ("I speak X" — drives `tutorRetrieveContext`'s content-pairing filter and the ledger lookup, server.js), `uiLang` (since `v83_b` — the REPLY language, `APP.uiLang \|\| srcLang`, a genuinely separate job from `srcLang` even though both used to be the same field), `story`, `wrongWords`/`knownWords`, `completed` (the spoiler whitelist). `_tutorSend(opening)` posts it plus the running `history` to `POST /api/tutor` (stateless; `callLLMTutor`/`callLLMTutorStream`, own model role `OLLAMA_TUTOR_MODEL`); the server computes `S = langName(uiLang)`, `L = langName(lang)` and fills `PROMPTS.tutor.system`. A pre-filled STUDENT turn (not `opening:true`) is the shape both `askTutorAboutQuestion()` (per-question 🦉 hint) and `_storySelExplain(mode)` (`PLAN §12` below) use — push `{role:'student', text:...}` onto `_tutorState.history`, `_tutorSaveThread()`, `_tutorSend(false)`. `tutorRetrieveContext`'s own "grab up to 4 topics by recency" fallback (fires when the question tokenizes to nothing) is now gated on `hasHistory: history.length > 0` sent by the route (`v86_m`) — reserved for a genuinely fresh/opening question with no history; a topic-less CONTINUATION mid-conversation (the real context is the history itself) now retrieves nothing instead of grabbing unrelated topics by recency |
| **`PLAN §12` — select story text → ask the tutor** (`v83_b`) | A SECOND, independent interaction over the same `.story-selectable`-wrapped container the per-word tap (`wp-tap`/`tapWord`) already uses; a click collapses the selection so `_storySelMaybeShow`'s `sel.isCollapsed` check is what lets the two coexist without either eating the other's click. `_storySelInit()` (wired once at boot) attaches document-level `mouseup`/`touchend`; a non-collapsed selection inside `.closest('.story-selectable')` shows `#story-sel-popover` (grammar/meaning buttons) near the selection via `_storySelShowPopover`. **Snapping rule: raw, exactly as selected** (trimmed/whitespace-collapsed) — no word/sentence-boundary snapping, deliberately, to avoid per-language tokenisation (the "no language knowledge in the code" line). `_selectionSegmentText(range)` reads the selection's own HTML and hands it to `_plainTextNoFurigana(html)` — a PURE STRING helper (testable without a live Selection) that strips `<rt>` (furigana READINGS, `furiHtml`'s `<ruby>base<rt>reading</rt></ruby>`) before extracting text, since a raw `selection.toString()` across a ruby folds the reading into the segment. `_storySelExplain(mode)` composes the pre-filled student turn (`ui.json` `tutor.sel_grammar_q`/`tutor.sel_meaning_q`, `{segment}`) — no new `/api/tutor` payload shape beyond `uiLang` above |
| the question-screen panel | `_exStoryPanelHtml(ex)` — on **every** question type, no story-unlock gate (T0). Default open/closed state RULED THREE TIMES: `v80_s` (collapsed, scoped to leak-prone types) → `v80_u` (never collapsed, all types) → `v83_f` (user follow-up: collapsed, all types, no exception) — `const _open = false`, current. Distinct from the progress card's own `#comp-story-panel`, which still opens by default — the two are DELIBERATELY different now |
| three-state colouring + asked underline | `_highlightVocabHtml(html, words, strong, stateByKey, underlineKeys)` — the last two are OPTIONAL; omit them and the pre-`v80` two-shade behaviour is unchanged |
| word → state map / asked span | `_wordStateMap(d)` (worst state wins when a word has two sources), `_askedKeys(ex)` |
| **tap a word → the lesson flow** | `tapWord(word)` → `_wordQuestions(d, word)` → `startLesson` + `C.cur`. **A way IN to the existing runner, not a one-question mode** (`§T5.2`, ruled). Prefers UNSOLVED questions |
| the chapter icon row | `_chapterIconsHtml(topicKey, slCtx)` — renders into the `*-storyboard` slot on the cards. **That id is HISTORICAL**: the slot used to hold the storyboard, which now appears only on the storyline page — as the raw board SVG, embedded directly, with no per-panel framing |
| ⚠️ **`_renderCompStoryboard` and its two single-caller helpers (`_sbPanelSpans`, `_sbFrameState`) are DELETED** (`v81_q`, `PLAN §C0.4`, user ruling) | had zero live callers anywhere — including the storyline page, which `v80_z`'s own entry believed still used it (it did not; see `roadmap_v80.md`'s `v80_z` entry and its `v81_q` addendum). `_sbPanelChapter` STAYS, still used by `_sbNavClick`/`_sbMarkCurrentPanels`. Before assuming something with zero callers is dead, check for a standing warning like this one FIRST — this exact function carried one, and the resolution needed a fresh user ruling, not just a caller search |
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
  make the solved store fall is reading 2 (mastery decay, `PLAN §9b/D2`). B4 now gathers shadow
  evidence, but a change remains unruled until its disagreement log is meaningful. ⚠️ Its readers
  include the ROUND BUILDERS, not just coverage and the gates.

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
| **difficulty-tiered furigana density** (`v82_i`, restored — dead since ~v40) | `sysStory(...,  difficulty)`'s last parameter selects via `_furiganaNoteFor(P, difficulty)` among `prompts.json`'s `story.furiganaNote1/2/3` (beginner/standard/advanced); an unrecognised/missing difficulty falls back to the flat `story.furiganaNote`. All three tiers carry the same "MANDATORY, FOR THE WHOLE STORY" + worked-example structure the flat note was fixed with at `v82_c` — the tier-3 (sparse) wording specifically needed a CONCRETE worked example to actually produce sparse output; an abstract "be selective" instruction alone measured as producing full coverage, same density as beginner |

**Generation-side QC detectors** (all in `server.js`; each has a corpus PROBE that reports and a unit guard that pins the DETECTOR on synthetic fixtures)

| what | where |
|---|---|
| word_forms blank position | inside `validateWordFormsItems` — rejects a blank appended AFTER sentence-final punctuation. **Pure structure, no language knowledge**, and it holds for Arabic `؟`/`۔`, CJK `。` and fullwidth marks. Probe: `probe_word_forms_defects_v80g.js` |
| ⚠️ the "answer visible in the stem" half | **MEASURED AND DELIBERATELY NOT ENFORCED.** Prefix-matching is mild morphology and would discard good items in inflected languages. Reported by the probe, left to a human (`v80_g`) |
| lesson written in the wrong script | `lessonScriptDefect(lesson, scriptName)` — alphabet comes from `scripts.json`, **never a hardcoded Unicode range**, so a script added there is covered with no code change. **EXEMPTS `comprehension`**: those questions are in the SOURCE language by design across the whole corpus (`v80_m` — the `v80_h` version wrongly flagged four of them). Probe: `probe_lesson_script_v80h.js` |
| unique lesson ids within a topic | `_dedupeLessonIds(topics)`, called from `saveStore` — the ONE choke point all 23 write paths funnel through |
| **`updatedAt` stamping** (`v82_h`) | `stampUpdated(saved)`, next to `saveStore` — the ONE choke point all nine stamp sites funnel through. Guarantees the timestamp strictly ADVANCES even when two saves for the same record land in the same wall-clock millisecond (bumps the previous value +1ms rather than reusing `Date.now()` verbatim) — genuinely possible under load, and the root cause of a flake reconfirmed three releases running before being traced here. Any NEW route that stamps a topic/lesson's `updatedAt` must call this, not `new Date().toISOString()` directly — `unit-stamp-updated.test.js` asserts zero raw stamp sites remain |
| the vocab article contradiction | `prompts.json` `vocab.system` — the per-side clause was REMOVED and a worked counter-example added (`v80_j`, rule 31). **Unverified by design**: whether the model obeys needs regeneration across MANY lessons and a re-run of `probe_article_symmetry_v80j.js` against its 1.0%/bimodal baseline |

**Speech**

| what | where |
|---|---|
| voice ranking and choice | `_ttsRankVoices(voices, code)`, `_ttsPickVoice()` |
| which locale a lesson speaks | `activeTtsCode()`, `lessonLang()` / `lessonSrcLang()` |
| **pronoun + verb form, for speech AND display** | `_joinPronoun(pron, form)` — an apostrophe-final pronoun binds directly (`j'` + `emporte` → `j'emporte`). With a space the TTS reads the apostrophe aloud. **Orthographic, not lexical**: it reads a character, not a dictionary, and covers every apostrophe code point since the corpus mixes U+0027 and U+2019 (`v80_u`) |
| the story read-aloud | `speakBodyText(el, lang, text)`; the panel's 🔊 and the card's 🔊 read whatever language is currently SHOWN |
| which language the story panel shows | `APP._compStoryLang` — **shared** by the question panel (`toggleExStoryLang`) and the progress card (`toggleCompStoryLang`), so the two screens cannot disagree |

**`PLAN §7.0` CP1 — canonical text + analysis records** (`v83_h`, TWO NEW STANDALONE FILES, not part of `index.html`/`server.js`)

| what | where |
|---|---|
| the pure core | `canonical-text.js` → `buildCanonicalText(topic)` — takes a `lessons.json`-shaped topic, returns a chapter→sentence→token record tree. `chapterId` REUSES the topic's own `id`; `sentenceId`/`tokenId` are POSITION-derived (`{chapterId}:s{n}`, `{sentenceId}:t{n}`), deterministic across independent calls on unchanged text |
| sentence/token splitting | `splitCanonicalSentences(text)` (sentence-level, paragraph-aware — mirrors server.js's `qcSplitSentences` but ALSO keeps paragraph breaks, which that one discards), `tokenizeCanonicalSentence(text, lang)` (CJK vs spaced, script-class only — mirrors `jaTokenize`/`CJK_LANGS`/`isPunct`) |
| staleness detection | `textHash(s)` / `sourceTextHash` — a truncated SHA-1, NOT a security property, purely so a future consumer can tell whether the text at a stable id has drifted since the record was built |
| provenance | `cp1Provenance(extra)` — deliberately NOT server.js's `buildGenMeta` (that shape is for MODEL generation calls; CP1 makes none) |
| the CLI | `build-canonical-text.js` — report-only by default, `--write` to persist, same convention as `backfill-script.js`. `--out <path>` redirects output (used by the test suite so a run never resizes the committed `canonical-text.json`). Selects a deterministic representative sample (one topic per language, then fills to `--limit`) unless `--all`/`--topic` is given |
| the output store | `canonical-text.json` — keyed by chapter id, entirely separate from `lessons.json`. **Nothing reads it yet** — CP1 is report-only by design; do not wire it into the player without a CP2+ ruling |
| ⚠️ **why neither file `require`s server.js** | server.js binds an HTTP port as a side effect of being loaded (no `require.main` guard) — requiring it from an offline analysis script would start a live server. The needed tokenisation primitives are COPIED instead, mirroring the SAME duplication convention already used for `jaTokenize` between server.js and index.html |
| ⚠️ **a self-referential test-guard trap, found while building this** | `unit-canonical-text.test.js` checks "no server.js dependency" by scanning `canonical-text.js`'s source for a literal `require` call naming it — and the file's OWN explanatory comment had spelled that exact call as an example of what it was NOT doing, which the regex matched. Same class of trap `unit-screen-structure`/`unit-card-consistency` already document: **never spell a source-scanned pattern in a comment near the code it checks** |
| ⚠️ **Unicode Private Use Area sentinels must be `\uXXXX` escapes, never literal characters** | the ported `jaTokenize`'s U+E000/U+E001 sentinels silently became empty strings mid-edit when written as literal characters — invisible control characters do not reliably survive file edits/tooling. Caught only by generating real furigana-bearing output and finding the group split apart, not by a clean diff |

**`PLAN §7.0` CP2 — analysis report: lemma/form/phrase/sense/frequency/script** (`v83_i`, ONE NEW STANDALONE FILE, sits ON TOP of CP1's output — asked for by the user by name)

| what | where |
|---|---|
| the core, model-in-the-loop | `canonical-analysis.js` → `analyzeSentence(model, sentenceRec, opts)` makes ONE real LLM call per CP1 sentence record, proposing lemma/form/sense per token plus multiword `phrases`. UNLIKE CP1, this stage genuinely needs a model — a lemma/sense cannot be derived from Unicode script classes |
| the model call itself | goes through `llm.js`'s `callLLM` — the SAME standalone, side-effect-free module `server.js` itself requires. No bespoke HTTP client, no `server.js` dependency (that would bind a port) |
| the uncertainty contract | `parseAnalysisReply(raw, tokens)` — every result is ALIGNED TO THE REAL TOKEN LIST, never to whatever the model returned. A token the model's JSON never mentions gets `confidence:'unresolved'` — a state DISTINCT from the model answering `'low'`. Never dropped, never fabricated. Exercised through a REAL HTTP call to `test/fake-ollama.js`'s new `careful linguistic analyst` branch (not just a hand-written string), per rule 7 |
| phrase validation | contiguous, in-range spans only; an invalid phrase (out-of-range, non-integer, backwards) is dropped and counted in `phrasesDropped`, never coerced |
| frequency (no model call) | `computeFrequency(analyzedChapters)` — deterministic, keyed `"lang::lemma"` so the same surface string in two languages is never merged. Explicitly a SAMPLE frequency (whatever chapters one CLI run analysed), not a corpus-wide claim |
| script (no model call) | `scriptsForLangCP2(lang)` — reads `scripts.json`'s `_langScript` directly (a plain JSON data file, safe to `require`), defaulting to `['latin']` for any language it has no entry for, mirroring server.js's own `scriptsForLang` default |
| provenance | `cp2Provenance(extra)` — UNLIKE CP1's `cp1Provenance`, this one DOES carry a `model` field, because a real LLM call produced the content it describes |
| the CLI | `build-canonical-analysis.js` — reads CP1's OWN `canonical-text.json` (not `lessons.json` directly — CP2 sits on top of CP1's sentence/token boundaries, never re-derives its own). Report-only by default, `--write` to persist to its own `canonical-analysis.json`, `--out`/`--in` redirect for testing. Default `--limit` is 2 chapters (not CP1's 24) — model calls are slow, unlike CP1's deterministic transform |
| ⚠️ **mutation-testing a `--write` CLI is not risk-free** | the first mutation-test run for this CLI's guard used a mutated CLI that wrote into the REAL committed `canonical-text.json` (a hand-edited mutation bypassed the `--out` redirect entirely). Caught immediately via `git status`/`git diff --stat`, restored with `git checkout --`. **A future mutation test of a `--write` CLI should point `--in`/`--out` at scratch copies of BOTH the input and output before mutating**, not rely on the mutation "probably" respecting the redirect flags |
| ⚠️ **`analyzeSentence` MUST send `think:false`** (`v83_o`, real bug, found by a real user run) | a real run against `qwen3.6:35b-a3b` (a reasoning-capable model) failed with `Ollama returned empty response` — the exact, already-documented `v71_o` failure mode server.js's own `OLLAMA_THINK` table (§ near line 240) already solved for its own structured-JSON roles (`story`/`lessons` stay non-thinking always). CP2's task is in that SAME category and had simply never adopted the fix. The fake-Ollama test harness CANNOT catch this — it has no concept of a reasoning model at all; the guard that DOES catch it (`unit-canonical-analysis.test.js` §10) checks the actual HTTP request body via `fake-ollama.js`'s own request logging (`FAKE_LOG`), not the source. Any FUTURE CP-stage model call needs the SAME `think:false` unless it is genuinely an open-ended reasoning task (mirroring server.js's own `tutor`-only exception) |
| ⚠️ **`sense` must stay in the token's OWN grammatical register** (`v83_p`, real bug, found by the user reviewing a real generated lesson) | the prompt now explicitly forbids the model from switching a conjugated/inflected token's gloss to the dictionary/infinitive form — a real run had paired "kommen" (lemma, infinitive) against "venne" (sense, past tense) as if they were the SAME register. `parseAnalysisReply`/CP2's token records now ALSO carry `surface` (the token's own literal text, from OUR OWN token list — known even for an unresolved token) so downstream stages can pair a register-CONSISTENT target/source, not just fix the prompt and hope |

**`PLAN §7.0` CP3 — proposed curriculum plan: concepts/prerequisites/ordering** (`v83_j`, ONE NEW STANDALONE FILE, sits ON TOP of CP2's output, NO model call of its own)

| what | where |
|---|---|
| the core, deterministic (no LLM call) | `curriculum-plan.js` → `buildCurriculumPlan(chapterAnalysis, opts)` aggregates a CP2 chapter analysis record into `vocab`/`phrase` CONCEPTS. UNLIKE CP1/CP2, this stage never touches `llm.js` at all — it is a policy decision over facts CP2 already established, not a second opinion on what a word means |
| concept extraction | `extractVocabConcepts` (one concept per distinct RESOLVED lemma, aggregated across every sentence — an unresolved token contributes no concept), `extractPhraseConcepts` (one per distinct validated CP2 phrase string) |
| ⚠️ **`surface` is chosen from the SAME occurrence as `sense`** (`v83_p`) | a concept's `surface` (the token's own literal text) and `sense` (contextual gloss) are BOTH picked from ONE `bestOcc` — never independently. Picking them separately could pair one occurrence's surface against a DIFFERENT occurrence's (differently-inflected) sense, reintroducing the exact register mismatch this fix exists for. Mutation-tested: picking surface from the LAST occurrence instead of the SAME one as sense — RED |
| the uncertainty/evidence contract | `suitableFamilies`/`planReason` are derived ONLY from evidence already in the CP2 record (multiple distinct `form` strings → `word_forms`/`inflections`; a `form` containing "verb" → `conjugation`; any non-`high` occurrence pulls the whole concept's `confidence` down to `'low'`) — never a guessed family with no supporting evidence |
| prerequisites | `linkPhrasePrerequisites` — a phrase concept depends on the VOCAB concepts (if proposed) covering its own constituent tokens' lemmas ("teach the parts before the whole"). The ONLY prerequisite relationship this stage has evidence for; it does NOT model grammar-level teaching order (e.g. tense before tense) |
| ordering | `orderConcepts` — frequency-desc / first-occurrence-asc as the base priority, but a Kahn's-algorithm-style pass ALWAYS places prerequisites before their dependents, even against a large frequency advantage (mutation-tested: a phrase with frequency 5 whose prerequisite has frequency 1 still sorts the prerequisite first) |
| comparing against what's already generated | `compareWithExistingLessons(vocabConcepts, topic)` — READ-ONLY, case-insensitive lemma-vs-`vocab.target` match against a REAL `lessons.json` topic's already-generated lessons. Reports the gap in BOTH directions (proposed-but-not-taught, and taught-but-not-proposed) |
| provenance | `cp3Provenance(extra)` — CP3-specific, carries NO `model` field (same reasoning as CP1's `cp1Provenance`: no LLM call happened at this stage) |
| the CLI | `build-curriculum-plan.js` — reads CP2's OWN `canonical-analysis.json` as input (never re-derives concepts from `lessons.json` directly), and reads `lessons.json` too but ONLY read-only, for the comparison step. Report-only by default, `--write`/`--out`/`--in`/`--lessons` same redirect convention as CP1/CP2's CLIs |
| ⚠️ **this mutation test was done SAFELY, learning from CP2's incident** | the "never writes `lessons.json`" guard was mutation-tested by pointing `--lessons` at a SCRATCH copy before mutating the CLI to write into it — the scratch copy changed (proving the mutation is real and the guard would catch it), the REAL committed `lessons.json` never touched at any point. Applies the standing rule CP2's incident produced |

**`PLAN §7.0` CP4 — vocabulary lesson through the existing contract** (`v83_k`, ONE NEW STANDALONE FILE, sits ON TOP of CP3's output, NO model call, NEVER touches `lessons.json` — a PARALLEL route, the legacy generator is completely untouched)

| what | where |
|---|---|
| the core, deterministic (no LLM call) | `curriculum-lesson.js` → `emitVocabLesson(plan, opts)` turns a CP3 chapter plan's VOCAB concepts into ONE lesson object shaped exactly like server.js's own `generateOneLesson` output (`id`/`type`/`title`/`desc`/`icon`/`vocab`/`sentences`), plus the plan's own mandatory provenance fields (`sourceSpans`/`planReason`/`pipelineVersion`) CP1-3 have carried all along. Capped at 8 vocab items, the SAME cap `generateOneLesson` applies |
| ⚠️ **`vocab[i].target` is the SURFACE form, not the lemma** (`v83_p`, real bug from a real generated lesson) | a user-reviewed lesson paired "kommen" (lemma, infinitive) against "venne" (sense, past tense) — a register mismatch. `target: c.surface \|\| c.lemma` now pairs a REGISTER-MATCHED target/source; `lemma` is kept as its OWN separate field (the concept's stable dictionary identity, still needed for cross-chapter dedup — see `apply-cp-lessons.js` below). Mutation-tested: reverting to `target: c.lemma` — RED |
| deliberately empty fields, not faked | `sentences: []` (a real example sentence needs translating the exact story sentence, a genuine NEW model call this stage does not make) and `skillLinks: []` (real skill-registry integration would invent a per-generator dialect the plan's own text warns against — left an explicit open TODO, not shortcut) |
| "validate it" | `validateLessonShape(lesson)` — the SAME structural floor `generateOneLesson` enforces on its own model output (non-empty vocab, no duplicate targets, non-empty target/source, the identical-source-target ratio — `IDENTICAL_MIN_ITEMS`/`IDENTICAL_MIN_RATIO` copied verbatim from server.js's own v53_g measurement) — reports (`{valid, errors, warnings}`), never throws |
| ⚠️ **the STRONGEST proof, at the layer where the claim is actually observable** | `unit-curriculum-lesson.test.js` §4 extracts the REAL, UNMODIFIED `buildStandardExercises` straight from `index.html` (the same `new Function(...)` extraction pattern `unit-beginner-types.test.js` already uses) and runs a CP4-emitted lesson through it — REAL playable exercises come out, not just a shape that looks right on paper. This is what "validate it" actually means, not merely a schema check |
| the CLI | `build-curriculum-lesson.js` — reads CP3's OWN `curriculum-plan.json` as input (never `canonical-analysis.json` or `lessons.json` directly). Report-only by default, `--write`/`--out`/`--in`/`--max-items` same redirect convention as CP1-3's CLIs. No `OLLAMA_*` configuration needed — no model call |
| the output store | `curriculum-lesson.json` — entirely separate from `lessons.json`. **Nothing reads it yet, nothing is wired into the player** — CP4 is a new PARALLEL route per the plan's own text, not a replacement; that's CP6's call, later, after multilingual coverage/quality/recovery are all measured |

**`PLAN §7.0` CP5 — consumption of the curriculum plan: silent (`v83_l`) → visible (`v83_m`)** (the FIRST CP stage to touch `index.html`/`server.js` at all)

| what | where |
|---|---|
| the user's own scoping rulings | `v83_l` (asked directly, this being the first CP stage with any live-app surface): **silent shadow-mode wiring**, not a visible signal. `v83_m` (asked for BY NAME after trying the silent version): **build the visible surface** — a small, clearly-"experimental"-labelled row, opt-in visible (inside the nav popup, not the main card), NOT a change to the red→green border or any other established signal |
| the server route (unchanged since `v83_l`) | `GET /api/cp-shadow/:chapterId` (server.js) — READ-ONLY, no POST/write path anywhere. `cp5ShadowFor(chapterId)` reads `CURRICULUM_PLAN_FILE` (env-overridable, mirrors `UI_FILE`/`SKILLS_FILE`/`LESSONS_FILE`) fresh from disk each call. Absence (the overwhelming common case) returns `{chapterId, available:false}`, not a 404/error. Reuses `curriculum-plan.js`'s OWN `compareWithExistingLessons` — `server.js` requiring a CP-stage file is the SAFE direction (the reverse is forbidden) |
| the client hook | `refreshCp5Shadow(d)` (index.html) — fire-and-forget, called from `showComplete()` right after the `v83_g` border-colour block. Records into `APP.progress.cp5Shadow` (mirrors `bktShadow`'s shape) on success; on `available:true` it ALSO calls `_renderCp5Row(cp)` (new at `v83_m`) |
| the visible row | `#comp-cp5-row` (in `#comp-nav-modal`, the popup, not the main card) — hidden/empty by default. `_renderCp5Row(cp)` paints it ONLY when `cp.chapterId` still matches the CURRENTLY OPEN chapter (`APP.lessonData.id`) — a slow response can resolve after a `next`/`back` navigation, and painting one chapter's data onto another's row would be a real bug. Label reads "🧪 Experimental word analysis" (`ui.json`: `complete.cp5_label`/`complete.cp5_summary`) — presented as a pipeline PROPOSAL, not a verified fact |
| ⚠️ **the row is reset SYNCHRONOUSLY on every render** | `showComplete()` clears `#comp-cp5-row` (`display:none`, empty `innerHTML`) BEFORE calling `refreshCp5Shadow` — the popup's DOM persists across an in-app chapter navigation, so without this a stale row from a PREVIOUS chapter that HAD data would still show while a DIFFERENT chapter (with none) is open, until/unless that chapter's own lookup happened to resolve and overwrite it. Mutation-tested: removing the reset — RED. Removing `_renderCp5Row`'s current-chapter check — RED (a late response painted the wrong chapter's row) |
| ⚠️ **the "silent" claim from `v83_l` is now a NARROWER "identical except one element" claim** | per the project's own standing rule (rewrite a superseded invariant, don't just loosen it), `unit-cp5-shadow.test.js` §5 now strips `#comp-cp5-row` out of the captured markup before diffing — everything else must still be byte-identical, and `#comp-cp5-row` itself must show the exact real fetched numbers |
| test infra addition (`v83_l`) | `test/lib.js`'s `boot({..., extraEnv})` — a backward-compatible optional param merged into the spawned server's env, so a test can point `CURRICULUM_PLAN_FILE` at a scratch fixture without every OTHER e2e test paying for a dedicated per-boot isolated file |

**`apply-cp-lessons.js`** (`v83_n`) — the FIRST script in this whole track that WRITES into a real `lessons.json`. Everything through CP1-5 (`v83_h`…`v83_m`) was deliberately inert or report-only.

| what | where |
|---|---|
| what it does | Chains CP1→CP2→CP3→CP4 for `--topic <id>` or every chapter of `--storyline <id>` (in order), and appends an ADDITIVE, clearly-tagged (`_pipeline:'cp4'`) "standard" vocab lesson per topic. Report-only by default, `--write` to persist — same convention as every CP CLI. `--lessons`/`--out` redirect BOTH the read and write target, independently, for safe testing |
| ⚠️ **NEVER edits or removes an existing lesson** | proven byte-for-byte in `unit-apply-cp-lessons.test.js` §1 — a target topic's own pre-existing lesson AND a completely unrelated topic are both diffed as byte-identical before/after a real `--write` run, not just "the count looks right" |
| cross-chapter dedup | `curriculum-plan.js`'s new `excludeAlreadyTaughtConcepts(concepts, alreadyTaughtLemmas)` — the SIMPLE half of the multi-chapter roadmap note (see `roadmap_v83.md`'s `PLAN §7.0` §0). Before choosing a chapter's vocabulary, EARLIER chapters in the same storyline (by the storyline's own `chapters` array) have their taught vocabulary excluded — both pre-existing LEGACY lessons AND this SAME script's own earlier-chapter additions within the same run (`alreadyTaughtByTopicId`, grows chapter by chapter as the loop proceeds) |
| ⚠️ **`vocabTargetsOf` compares by `lemma`, not `target`** (`v83_p`, a second real bug found while fixing the first) | once CP4's `target` became the SURFACE form (see above), building the "already taught" set from `vocab.target` alone silently broke cross-chapter dedup for exactly the inflected words the register fix was for — a later chapter's candidate `lemma` ("kommen") would never match an earlier chapter's `target` ("kam"). Fixed to prefer `v.lemma \|\| v.target` (a LEGACY lesson's vocab item has no `lemma` field, so it still falls back to `target` there). Mutation-tested: reverting to `target`-only — RED, caught by a hand-built pre-existing lesson with `target`/`lemma` deliberately different |
| ⚠️ **`--replace` must exclude the OLD lesson it is about to replace from "already taught"** | a real bug found while building this script: without this, every re-run would starve itself — the words a lesson taught last time would look "already covered" by that very lesson, leaving nothing to regenerate. Fixed (`ownLessons` filters out the topic's own `_pipeline:'cp4'` lesson when `REPLACE` is true) and mutation-tested (`unit-apply-cp-lessons.test.js` §5 asserts a `--replace` run recovers the SAME vocabulary, not an empty lesson) |
| idempotent by default | a second run with no `--replace` skips a topic that already carries a `_pipeline:'cp4'` lesson — checked BEFORE the (real, model-calling) CP1-4 chain runs, so a no-op run costs nothing |
| a chapter with nothing new to teach | `emitVocabLesson` already throws "no vocab concepts to teach" when the dedup filter leaves nothing — caught and logged as a clean skip, never a forced empty lesson |
| ⚠️ **the strongest proof, reused from CP4** | `unit-apply-cp-lessons.test.js` §7 reads a lesson THIS SCRIPT actually wrote to disk back exactly as the real app would, and runs it through the REAL, unmodified `buildStandardExercises` — real playable exercises come out |

**`install.sh`** (`v83_q`, one-line local installer — README.md's "Option A", NOT a `PLAN §7.0` item)

| what | where |
|---|---|
| what it does | `curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh \| sh` — clones the repo (or updates an existing checkout), installs Ollama via Ollama's OWN official installer if not already present, makes sure Ollama is actually reachable (starts it in the background if not), checks the machine can handle the model (`v83_s`, see below), pulls `qwen3.6:35b-a3b` — README.md's own recommended BEST-quality model as of `v83_r`, per a real measured comparison; set `DREIZUNGE_MODEL=qwen2.5:7b` for the much lighter, still-solid alternative — and PRINTS the command to start the server (`v83_s`: no longer starts it itself — a `curl \| sh` installer ending in a foreground process was surprising, and stdin is already consumed by `curl` at that point anyway) |
| ⚠️ **every mutating step is gated behind an idempotency check** | existing checkout → update, not re-clone; Ollama already installed → skip its installer; Ollama already running → skip starting it; model already pulled → skip pulling it. The ONE genuinely destructive-adjacent case (a non-git directory already occupying the target path) REFUSES rather than silently overwriting |
| ⚠️ **resource sanity check** (`v83_s`) | gated to the BUILT-IN DEFAULT MODEL only (an explicit `DREIZUNGE_MODEL` override could be any size). RAM (`/proc/meminfo` on Linux, `sysctl hw.memsize` on macOS): WARNS under 16GB, never refuses — mmap means a lower-RAM machine can often still run it, just slower. Disk (checked at Ollama's OWN model store — `OLLAMA_MODELS` if set, else its real default `~/.ollama`, NOT the tiny git checkout dir): REFUSES under 25GB free — a failed multi-GB download helps no one. Both thresholds independently re-derived and checked against concrete inputs in `test/unit-install-script.test.js` §9, since the real branches can't be forced to fire on a well-resourced CI/dev box |
| what it deliberately does NOT do | auto-install Node.js or git — both are CHECKED (`has node \|\| die`, `has git \|\| die`) with clear manual-install guidance, never silently installed. Only Ollama was explicitly asked for; the script does not quietly expand that into installing a language runtime or VCS tool nobody asked it to |
| verified | `test/unit-install-script.test.js` — real `sh -n` syntax validity (not eyeballed), executable + correct shebang, `set -eu` present, every idempotency gate checked structurally, README.md's own documented one-liner cross-referenced against the real default branch (`main`, checked via `git symbolic-ref` before writing either file) and the real script path. **Also exercised as a REAL end-to-end run** (fresh install AND the update-existing-checkout path) against the real GitHub repo before shipping — see `roadmap_v83.md`'s own `v83_q` write-up for that run's actual output, including the finding that the public repo was still several releases behind local `HEAD` at the time |
| mutation-tested | disabling the "Ollama already installed" check (forcing the installer branch even when Ollama is present) — RED. Disabling the "refuse a non-git directory" guard (silently overwriting it instead) — RED |
| ⚠️ `bin/dreizunge` PATH launcher (`v84_c`) | a small POSIX `sh` script, symlinked to `~/.local/bin/dreizunge` by `install.sh` (idempotently — an already-correct symlink is detected, a pre-existing non-symlink FILE at that path is left alone). Resolves its OWN real location by following symlinks BY HAND (portable to macOS's non-GNU `readlink`, unlike `readlink -f`), `cd`s to the checkout, runs `node server.js` in the FOREGROUND (Ctrl-C stops it, no daemonizing), opens the browser once the port answers (backgrounded, silent if `xdg-open`/`open` are missing). `--no-browser` skips that. Verified via a REAL run through a symlink from an unrelated cwd against a stub HTTP server (`test/unit-dreizunge-launcher.test.js`) AND a real `install.sh` end-to-end run (scratch `$HOME`, confirmed idempotent + the installed symlink genuinely starts the real app) |
| ⚠️ `llm.js`'s `warmup()` needed the SAME `v83_o` `think:false` fix (`v83_r`) | making `qwen3.6:35b-a3b` the default surfaced a THIRD live instance of the `v83_o` bug — `warmup(model, log)` (called once at server startup via `server.js`'s `_warmupLLM`) called `_callOllama(model, '', 'hi', 1)` with no `think:false`, so a reasoning model burns its 1-token budget thinking and the warmup silently fails ("not ready (Ollama returned empty response) — continuing"). Found by re-running `install.sh` end-to-end against the new default, not by source review. Fixed identically to `v83_o`: `{ think: false }` added to that one `_callOllama` call. Verified at the HTTP layer in its own file, `test/e2e-warmup-think.test.js` (registered inside `run.js`'s `!quick` block — it spawns a fake Ollama server, so folding it into the always-run `unit-reasoning-model-safety.test.js` would have violated `v70_b`'s own `--quick` guard, which caught exactly that on the first attempt) |

**PWA install support** (`v84_b`, local server only)

| what | where |
|---|---|
| what it does | `manifest.json`/`icon.svg`/`sw.js` (repo root) — a real web app manifest + a minimal service worker (caches the app shell only — `/`, `/manifest.json`, `/icon.svg` — network-first, never touches `/api/*`), served by three new `GET` routes in `server.js` right after `GET /`. `index.html` gets `<link rel="manifest">`/`<meta name="theme-color">` in `<head>`, and a feature-detected `navigator.serviceWorker.register('/sw.js')` call BELOW the `@static-engine-end` marker |
| ⚠️ local server only — NOT in `docs/index.html` | the registration call lives below `@static-engine-end`, the same marker `build-static.js`'s slicer already excludes, so it never reaches the static build automatically. The `<link rel="manifest">` tag DOES reach `docs/index.html` (it's in `<head>`, above the marker) — harmless, 404s silently there |
| ✅ registration confirmed working in a real browser | a sandboxed preview browser failed during the build itself ("unknown error fetching the script" — reasoned as a sandbox restriction, not a bug); the user then confirmed it works for real in Google Chrome on Ubuntu via `localhost:3000`, same day |
| ⚠️ a LAN IP over plain HTTP does NOT get an install option | service workers need a secure context (HTTPS or the `localhost`/`127.0.0.1` loopback exception) — a LAN address like `http://192.168.0.180:3000` never qualifies, confirmed on Android Chrome (no install option, address bar shows the insecure-⚠️ instead of a lock). Same root cause as `transportInsecure()`/`warnInsecureTransport()`'s existing credentials-over-HTTP warning, not a separate bug. Dev-only workaround: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`. Real fix for LAN/phone use: a TLS-terminating reverse proxy in front of the server — not built |
| ⚠️ found while building this: `test/lib-dom.js`'s `loadClient()` had a fragile trailing-regex | assumed `init();` was the LAST statement in `index.html`'s client script; the first code ever added after it (this release's own SW registration) silently un-suppressed `init()` in ~80 unit tests (real network-bound bootstrap ran against the harness's empty-object stub `fetch`, crashing inside `applyUIStrings` on unpopulated `LANGS`). Its own self-check guard missed this too — a fixed `src.slice(-200)` tail window no longer reached `init();`. Fixed at the root: anchor on `@static-engine-end` for `index.html`, fall back to the old trailing-regex ONLY for `docs/index.html` (which never carries the marker), and check the WHOLE resulting `src` in the self-check, not a fixed tail |
| verified | `test/e2e-pwa-install.test.js` (spawns a real server) — all three files served with correct status/MIME/content; `index.html` wires manifest/theme-color/registration with a silent catch; `docs/index.html` does not attempt registration; `sw.js`'s fetch handler structurally can never intercept `/api/*` (comment-stripped before the check) |
| mutation-tested | wrong `Content-Type` for `/sw.js` — RED. Removing the silent `.catch(() => {})` — RED. Dropping `sw.js`'s `SHELL` allow-list gate — RED. `loadClient()`: reverting to the old trailing-regex — RED (reproduces the 80-test crash). Forcing the marker branch unconditionally — RED |

**Mobile progress-card UI follow-ups** (`v84_d`, real-device driven)

| what | where |
|---|---|
| ⚠️ `#comp-story-panel`'s header row is TWO rows | SUPERSEDED at `v84_e` — see its own table below: nav moved OUT of `<summary>` entirely, below the whole text field. Kept here only as the "title now truncates via `flex:1;overflow:hidden;text-overflow:ellipsis`, like `.topic-name-big`" fact, which is STILL true |
| `#bottom-bar` (repo root markup, `index.html`) | wraps `#corner-pills` (account/settings/mute) and `#tutor-fab` (owl), both UNCHANGED in id/markup/JS-toggling — only their positioning moved from independently-fixed to flex children of one shared, full-width, translucent (`rgba(255,255,255,.85)` + `backdrop-filter:blur(8px)`) bar. `--bottom-bar-h` CSS var is the one place its height is stated; `.toast`/`#gen-status`/`.static-flag-banner`/`#tutor-widget`'s reopened position all offset FROM it. **`v85_b`** added `#bottom-bar-toggle` (hide/show the whole bar) — see its own row below |
| `_exStoryPanelHtml(ex) + flagUi` (was `flagUi + _exStoryPanelHtml(ex)`) | question-card flag/star row moved below the collapsed story panel — pure reorder in the `ex-area` innerHTML assembly, no markup changes |
| `_isTouchDevice()` / `_storySelShowPopover` touch branch | mobile "ask the tutor" selection popover was rendering correctly but hidden under the browser's OWN native "Copy/Share" selection toolbar (browser-chrome UI, no page-level z-index can beat it). Touch devices (`'ontouchstart' in window \|\| navigator.maxTouchPoints > 0`) now get `position:fixed`, pinned above `#bottom-bar` via the SAME `--bottom-bar-h` var, horizontally centered — deliberately NOT anchored near the selection at all. Desktop keeps the original near-selection placement |
| verified live | `showComplete()` against a real 46-char chapter title on a real 375px mobile viewport (2 rows, no overflow, title genuinely truncates); `#bottom-bar` confirmed full-width/translucent, `#tutor-widget` confirmed opening above it; touch-popover fix confirmed with `navigator.maxTouchPoints` genuinely emulated, ignoring a mid-screen fake selection rect entirely |
| mutation-tested | progress-card header reverted to single-row order — RED. `_isTouchDevice()` forced to always `false` — RED |

**Second mobile follow-up batch** (`v84_e`, same conversation — nav-below-text, entry→progress, tap-to-advance)

| what | where |
|---|---|
| nav (prev/☰/next) moved BELOW the whole text field | on BOTH `#comp-story-panel` and `#sum-sumbox` — lives as a sibling row AFTER the `<details>`/box, NOT inside the collapsible body (a user CAN collapse `#comp-story-panel`; a nav row inside the body would vanish with it). Supersedes `v84_d`'s own two-row-within-`<summary>` split |
| `sum-next`'s `onclick` (`showComplete()`/summary render fn, `index.html`) | no longer branches on `_entry` (ENTRY vs WALK) — both cases now call `sumForwardToCard()` (the chapter's own progress card). The `_entry`-derived LABEL ("Start" vs "Next") is unchanged; only the destination changed |
| `_storyTapMaybeAdvance()` / `_storyTapInit()` | bound to `click` on `document`. Scoped by id allow-list to `#comp-story-text`/`#sum-sumtext` only (NOT the shared `.story-selectable` class those share with `#ex-story-text`). Excludes `.wp-tap` (highlighted words keep `tapWord()`'s own behaviour) and any tap that leaves a real (non-collapsed) selection behind (the SAME `sel.isCollapsed` signal `PLAN §12`'s `_storySelMaybeShow` already trusts). Explicit `!btn.disabled` check — deliberately calls `.onclick()` directly rather than `.click()`, since the test harness's `.click()` is a no-op stub |
| verified live | real `target.click()` DOM dispatch (not a direct function call) on a `<p>` inside a REAL chapter's `#comp-story-text`, spied `comp-next.onclick`, confirmed fires exactly once; same dispatch on a synthetic `.wp-tap` mark confirmed it does NOT; `#sum-sumtext` confirmed the same for `sum-next` |
| mutation-tested | dropping the `.wp-tap` exclusion — RED. Dropping the drag-select exclusion — RED. Dropping the `disabled` check — RED |
| ⚠️ cross-realm `vm.Context` gotcha (found writing this) | `assert.deepStrictEqual` on a plain object returned DIRECTLY from `C.run()` (`test/lib-dom.js`) fails even when every key/value is equal, since the object's `[[Prototype]]` belongs to a different `vm.Context`'s `Object`. Fix: round-trip through `JSON.parse(C.run('JSON.stringify(...)'))` |

---

**`v85_b` — two small user-requested fixes, unrelated to each other** (done BEFORE starting
`PLAN §13` milestone 1 — see `roadmap_v85.md`'s own `v85_b` entry for the full write-up)

| what | where |
|---|---|
| **speech-recognition no longer auto-activates** | `v84_k`…`v84_m` had `APP.micMuted` default `false` (active/auto-listening). `v85_b` flips the default to `true` (off) and adds ONE reset line in `startLesson()` (`APP.micMuted = true`, alongside its other per-round resets) so a mic left active from a PREVIOUS lesson cannot leak into a new one — the learner must tap `#speech-mic-pill` (`_speechMicPillClick()`) to activate it, per lesson. `_speechMicRefresh()`, `_speechStartSession()`, `_speechListenSession()` and the whole continuous-session/stale-generation-guard machinery are UNCHANGED — only the default and the per-lesson reset moved. `_speechKindFor(ex)` (speakability) is untouched |
| ⚠️ `test/unit-speech-recognition.test.js` did not need touching | its `client()` helper drives `_speechMicRefresh()` directly with an explicit `APP.micMuted` override per test (never through `startLesson()`), so the new default/reset is invisible to that file by construction — the new behaviour is guarded by a SEPARATE file, `test/unit-mic-lesson-reset.test.js`, which drives a real `startLesson()` |
| **`#bottom-bar` hide/show toggle** | `#bottom-bar-toggle` — its own independently `position:fixed` element, left edge of the screen, written as a MARKUP SIBLING of `#bottom-bar` (immediately before it), not a child of `#corner-pills` — so it stays clickable even while the bar itself is `display:none`. `toggleBottomBar()` flips `APP.bottomBarHidden` (persisted: `localStorage['imp3_bottombar_hidden']`, same `imp3_*` convention as `noKeyboard`/`libSrcFilter`) and calls `_applyBottomBarVisibility()` — the ONE function that applies it: bar `display`, toggle glyph (▾ hide / ▴ show) + title, AND collapses `--bottom-bar-h` to `0px` while hidden so everything else already anchored "above the bar" via that same shared var (see the row above) settles to the true bottom instead of leaving a gap for a bar that isn't there. Called once at `init()` in BOTH `index.html` and `build-static.js`'s own separate `init()` override, so a persisted "hidden" preference survives a reload in both builds — the "both files" pairing this table's own `PLAN §C0` rows keep re-learning |
| the acceptance tests | `test/unit-bottom-bar-toggle.test.js`: markup (sibling, not nested), default state, one tap (hidden + glyph + `--bottom-bar-h` computed as `0px`), a second tap (fully restored), persistence (both directions write `localStorage`, same scope as `unit-teacher-toggle.test.js`'s own persisted-flag check — the harness builds flags like this from `localStorage` at module-load time, before test code runs, so the READ side isn't independently re-assertable here) |

---

**`v85_c` — `PLAN §13` milestone 1: the generator-page wizard shell** (see `roadmap_v85.md`'s own
`v85_c` entry for the full write-up, including the live-browser click-through)

| what | where |
|---|---|
| **the shell**: `#gen-wizard` wraps `#gen-card-1`/`-2`/`-3` | `#generation-screen`'s `.sl-screen-body` used to lay `.backend-row` → `.lang-box` → `#gen-area` (topic/text-source → `#gen-form-section` → `#gen-btn-row`) → `#offline-note` all out flat, always visible. Now `#gen-wizard` sits between `.backend-row` and `#offline-note` (both UNCHANGED, still outside it) and shows exactly ONE `.gen-card` at a time. `#gen-area`'s own id/wrapper is UNCHANGED — it now contains `#gen-card-2`+`#gen-card-3` instead of their content directly, so `unit-ui-journeys.test.js`'s "the generation controls are visible" check (`#gen-area`'s own `style.display`) still passes untouched |
| **card contents, all UNCHANGED internally** | `#gen-card-1` = `.lang-box` (source/target language + script pickers). `#gen-card-2` = the text-source cluster: `#topic-label`/`#topic-input`, `#user-story-checks`, `#pdf-panel`, `#user-story-panel`, `#dialect-panel` — every `onchange`/`onclick` (`onUseStoryCb`/`onUseDialectCb`/`pdfGenerateAll`/`doDialectImport`/etc.) byte-for-byte unchanged. At `v85_c`, `#gen-card-3` was a CATCH-ALL for everything else — **`v85_d` split it** (see its own row below); this row's original 3-card shape no longer exists in the tree, kept here only as the milestone-1 record |
| **navigation** | `_genWizardGoto(n)` (clamped, `Math.max`/`Math.min` against `_GEN_WIZARD_CARDS` — `3` at `v85_c`, `4` from `v85_d`) sets `_genWizardStep`, toggles each `#gen-card-N`'s `style.display` (`''`/`'none'`) and each `#gen-step-pill-N`'s `.active` class. `_genWizardNext()`/`_genWizardBack()` are thin ±1 wrappers. Each card's own Back/Next buttons (`#gen-step-back-2`/`#gen-step-next-1`/etc.) are NEW, small, wizard-only — placed ADJACENT to the unchanged markup, never inserted inside an existing id'd container |
| **the stepper** | `#gen-wizard-steps` reuses the EXISTING `.pdf-stepper`/`.pdf-step`/`.pdf-step.active` classes verbatim (until now only `#pdf-stepper`'s own per-chunk PDF-import progress pills) — zero new CSS, same visual language at a new, page level. Pills (3 at `v85_c`, 4 from `v85_d`), each `onclick="_genWizardGoto(n)"` for a free/ungated direct jump — no validation gates a step |
| **the reset hook** | `show(id)` — the one authoritative route function (`PLAN §C0`) — now also runs `if(id==='generation-screen') _genWizardGoto(1)`, so `goLanding()`/`goLandingClean()` (its only two callers of `show('generation-screen')`) always re-enter at card 1, even if a learner was left deep in the wizard. Mutation-tested: removing the hook is what `test/unit-gen-wizard.test.js`'s own dedicated check catches |
| ⚠️ **no new validation** | `#topic-input` was ALREADY required by `doGenerate()`'s own guard before this existed — the wizard only made an already-mandatory field's VISIBILITY sequential (behind one "Next" click), it did not add a requirement. "Click through defaults, generate" needs the same number of REQUIRED interactions as before `v85_c` |
| new `ui.json` (`en` only) | `gen.wizard_step1`/`step2`/`step3`, `gen.wizard_back`, `gen.wizard_next` (662→667 `en` keys at `v85_c`) — wired via `_setText`/`t()` in `applyUIStrings()`, with matching static English fallback text in the raw HTML (same convention `#topic-label`/`#gen-screen-title` already use, so there's no flash-of-empty-pill before `applyUIStrings()` runs) |
| the acceptance tests (as of `v85_c`) | `test/unit-gen-wizard.test.js`: markup nesting (each existing block inside its own card, via `indexOf(needle, lo)` bounded search — NOT unbounded `indexOf`, which would find `.lang-box`'s OTHER pre-existing user, `#lib-lang-box` in the library filter, instead), default state (card 1 shown, pill 1 only active), `_genWizardNext`/`_genWizardBack` clamping at both ends, `_genWizardGoto` direct jump, the `show()` reset hook (mutation-tested), and the `#gen-area`-untouched invariant. Extended, not replaced, at `v85_d` — see its own row |
| ⚠️ **div-balance verification method, worth reusing** | after any wizard-restructuring edit, a real HTML parser (Python's `html.parser`, stack-tracking start/end tags) was run over just the `#generation-screen`…next-screen region to confirm zero stray/missing closing tags — the same technique `PLAN §C5`'s own `landing`-nesting row used, reused again at both `v85_c` and `v85_d` |

**`v87_j` — BUG FIX: a saved text analysis rendered "lädt…" forever** (user report; full write-up in
`roadmap_v87.md`'s own `v87_j` entry). TWO independent client-side defects in item W's own seam; the
server, store and staleness hash were read and found correct and are UNCHANGED.

| what | where |
|---|---|
| ⚠️ **defect 1: the flag outlived the chapter, the fetch did not** | `_ensureTextExplorerData()` was called from `toggleTextExplorer()`/`toggleLsTextExplorer()` and NOWHERE else — not on navigation, not on re-render. `APP._textExplorer`/`APP._lsTextExplorer` live on `APP` and survive a chapter change, so arriving at another chapter with the mode already on rendered a chapter with no cache entry and fetched nothing. Harness-reproduced first: **zero fetches**, loading string forever. No error and no retry, because `!entry` and `status:'loading'` render the SAME string — "never fetched" is indistinguishable from "in flight" |
| ⚠️ **defect 2: the data path repainted the WRONG CARD** | `v86_ad` gave the lesson-set card its own explorer toggle (`#story-body`, own `APP._lsTextExplorer`) over the SAME cache, but every repaint in the analysis path was a bare `_renderCompStory()` — the completion card. Toggling on the lesson-set card fetched, reached `ready`, then repainted the other card; `#story-body` kept the loading string. Measured: `_renderCompStory` ×2, `renderStoryText` ×1, body still loading. **Reproduces the report with one toggle and no navigation** |
| **`_teRepaint()`** | one helper, refreshes whichever explorer surfaces are open, each branch guarded by its own flag — a no-op for a closed surface, so a late job callback cannot force a render that fights the view the learner switched to. All 13 repaints in the data path route through it |
| **`_ensureTextExplorerData(chapterId)`** | takes the id as an argument (defaults to `APP.lessonData`, so both toggle callers are unchanged). `renderStoryText`/`_renderCompStory` fire it fire-and-forget for the chapter they are PAINTING when it has no cache entry. Terminates by construction: the `'loading'` entry is created BEFORE the repaint, so the repaint it triggers finds an entry and does not re-fire |
| the acceptance tests | `unit-text-explorer.test.js` §8 (arrive at a chapter with the mode already on → it fetches, reaches ready, no loading string) and §9 (lesson-set card repaints its own `#story-body`, AND the completion card is NOT repainted — so the fix cannot regress into "repaint everything"). Both written from the reproduction, both mutation-tested red |

---

**`v87_i` — item Z: a word tap plays ALL that word's questions, then rejoins forward progress**
(full write-up in `roadmap_v87.md`'s own `v87_i` entry). ⚠️ **SUPERSEDES `§T5.2`** — "tapping enters
the usual lesson flow, including questions not reachable by tapping" — on an explicit user ruling
after the conflict was put to them.

| what | where |
|---|---|
| **the shape change** | `tapWord()` no longer picks ONE candidate and opens that lesson. It builds a run of the word's own questions across lessons (`_buildWordRun`), opens it via the real `startLesson` (so per-round state — hearts, the `§0h` ledger, mic reset, screen switch — is not duplicated), then REPLACES `C.exercises`, sets `C.cur = 0`, clears the opening lesson's per-type render flags, and marks `C._wordRun` |
| ⚠️ **`Math.random()` was the `unit-tap-word` "flake"** | `pool[Math.floor(Math.random() * pool.length)]` chose among the word's lessons; the fixture's two held 6 and 1 questions, so ~35% of runs opened a legitimately one-question lesson and the `n > 1` assertion failed on CORRECT behaviour. Documented as `buildExercises` corpus sampling since `v80_t` and re-confirmed every session — it was neither corpus noise nor unrelated. The discriminator sat one line below it the whole time (`full`, what `startLesson` builds: `n === full` in every run). 37 consecutive passes after removal |
| **reuses `buildMixedExercises`'s mechanism, does not invent one** | `qid()` already resolves an exercise to its source lesson via `ex._srcLessonIdx`, the tag `mixed` rounds introduced — so a multi-lesson run was already a supported shape. `_buildWordRun` reuses BOTH load-bearing details for the same reasons: the 40-derivation convergence loop (builders sample/shuffle, so a wanted qid may not surface in one derivation) and the `_srcLessonIdx` tag (so `markSolved`/`_exFlagTarget` credit the question's OWN lesson). `_mixedSkips()` keeps `error_hunt`/`writing`/`mixed` out — they own their whole render path |
| ⚠️ **"where Next would have led" is NOT `afterComplete()`** | despite being the inline `onclick` in the markup: `showComplete()` REASSIGNS `#comp-next.onclick`, so the static name is stale except for a finished drill. That is exactly why `_storyTapMaybeAdvance()` (plain-text tap) calls `btn.onclick()` dynamically. `_captureNextAction()` reuses that indirection incl. its `disabled` check, and captures on the way IN — by the time the detour ends, the card behind may have been re-rendered. Nothing captured → the ordinary progress card, a fallback not a dead end |
| **order + scope, both user rulings** | ASCENDING LESSON ORDER (corrected by LIVE measurement: grouping by `_wordQuestions`' own return order — story probes first, vocab last — measured as lessons 2, 6, 0 on a real chapter, which is not "the order the learner would otherwise have met them in"). Scope: only unsolved-or-wrong, with the pre-existing fallback to all of them so a fully-solved word is still tappable |
| ⚠️ **TWO more vacuous guards, both caught by mutation-testing this same file** | (1) the per-type-flag assertion stayed GREEN when the reset was deleted — this fixture's opening lesson is an ordinary type — so it now reproduces the state at the seam (wrapping `showLesson` to leave the flags set as a `grammar` lesson would). (2) the ascending-order assertion stayed GREEN when the sort was removed, because the primary fixture's word has all its questions in ONE lesson. Fixed with a SECOND fixture, `FIXZ`, selected for cross-lesson SPREAD rather than co-occurrence (picks 血の関税 / "send", 3 questions across 3 lessons), plus its own non-vacuity assertion |
| the acceptance tests | `unit-tap-word.test.js` §2 rewritten to the new contract; new §2a (flag reset, at the seam), §2a2 (ascending order, cross-lesson fixture), §2b (plays ALL of them, non-vacuity enforced), §2c (DETERMINISM across repeated taps — the assertion that would have caught the original flake as a defect), §2d (return to `#comp-next`, fires once, marker cleared first), §2e (disabled Next → normal card); §4 rewritten (its old "don't land on a solved question" invariant is now unsatisfiable by construction, which is a STRONGER claim) and §4b added (fully-solved fallback). SEVEN mutations confirmed red |

---

**`v87_h` — item AL part 2: PDF and comic uploads route through the ONE lesson card** (full write-up
in `roadmap_v87.md`'s own `v87_h` entry). ⚠️ **SUPERSEDES the `v85_p` / `v86_o` rows below for WHERE
the arc/skip-lessons/storyboard/analysis controls live** — their server-side halves are unchanged and
those rows are still accurate about the mechanism, only not about the ids.

| what | where |
|---|---|
| **21 ids DELETED, across two panels** | `#pdf-skip-lessons-row`/`-cb`, `#pdf-arc-row`/`#pdf-arc-types`/`#pdf-arc-cb`/`#pdf-arc-lbl`, `#pdf-storyboard-row`/`-cb`, `#pdf-analysis-row`/`-cb`, `#pdf-gen-btn`/`#pdf-gen-lbl`; `#comic-skip-lessons-row`/`-cb`, `#comic-arc-row`/`#comic-arc-types`/`#comic-arc-cb`/`#comic-arc-lbl`, `#comic-storyboard-row`/`-cb`, `#comic-analysis-row`/`-cb`, `#comic-create-btn`/`#comic-create-lbl`. Every READER of them moved to the canonical `#gen-skip-lessons-cb`/`#gen-arc-cb`/`#gen-arc-types`/`#gen-arc-script-cb`/`#post-gen-storyboard-cb`/`#post-gen-analysis-cb`/`#gen-btn` — request bodies, field names and endpoints are byte-for-byte unchanged, only where the CLIENT reads the answer from |
| **what SURVIVED, by user ruling** | The live review stop: `#pdf-chunk-list`, `#split-mode-row`, `#pdf-sel-panel`, the cleanup pass, `#pdf-stepper` (progress, not a control); `#comic-panel-list`, upload/camera/rotate/detect/whole-image, `#comic-extract-btn`, `#comic-clear-btn`, and `comicOpenReview()`'s text-review card. **`comicExtractPanels()`/`splitChaptersLLM()` timing is UNCHANGED** — this was the explicit ruling, and `#gen-btn` in comic mode dispatches to `comicOpenReview()` (not `comicCreateChapter()`) so the review card still sits between "start" and creation |
| **`_genInputMode()` / `_genChapterCount()` / `_genArcApplicable()`** | The abstraction the unification required: the wizard's rows were gated on `APP.numChapters > 1`, meaningless for an upload. Modes: `llm`/`paste`/`pdf`/`comic`/`dialect` (comic wins if two flags are somehow set). Counts: `_pdfChunks.length`; panels WITH extracted text (an un-extracted box is not a chapter); `1` for paste; `0` for dialect. `_genArcApplicable()` deliberately keeps the two paths' DIFFERENT rules — `n > 1` for LLM (a planned single chapter never offered an arc), `n >= 1` for uploads (`#pdf-arc-row` was shown for a single chunk) |
| **`_applySkipLessonsUI()` → `_applyLessonCardUI()`** | Renamed when it grew past the skip-lessons checkbox into owning the whole card. The old name is kept as a one-line delegate, so item AK's own notes and the inline `onchange` still resolve. Called from the checkbox, `onNumChaptersSlider()`, `_renderPdfChunks()`, `_comicRenderList()`, both draft-restore paths, and all three mode toggles |
| ⚠️ **two things are deliberately NOT mode-independent** | `#per-chapter-row` stays LLM-only: `_renderPerChapterTypes()` builds rows from `APP.numChapters` and `_applyPerChapterTypes()` matches them POSITIONALLY against the finished book — an upload's chunks are still splittable/mergeable/deletable, so the two never lined up. `#post-gen-qc-cb` (new `#post-gen-qc-row` id, for gating) stays LLM-only: QC here is CLIENT-orchestrated via `_applyPostGenFeatures()` chained onto `doGenerate()`'s book job, and the upload paths have no such chaining — offering it would be a no-op checkbox. Storyboard/analysis have no such problem: both ride the INITIAL `/api/generate-book` request all three modes send |
| **the start button is DERIVED, not pushed** | `#pdf-gen-btn`'s visibility used to be assigned from SIX imperative sites (`pdfGenerateAll()` ×2, `_pollBookJob`'s `finally`, `_reconnectBookJob()`, `_renderPdfChunks()`, `pdfSelOpen()`). `_applyLessonCardUI()` computes it: withheld when nothing is ready, a chunk is `active`, `_pdfBookId`/`_comicBookId` is set, or `_pdfSelMode` is on. `_genStartBtnLabel()` reuses each mode's OWN existing string — ZERO new `ui.json` keys |
| ⚠️ **`comicCreateChapter()` never sent `continuedFrom`** | A real, SILENT bug, found by reading the source while scoping item AL, not from a report: `pdfGenerateAll()` and `doGenerate()` both always sent it; the comic path did not, so a comic-sourced chapter could never be linked as a continuation — with the picker sitting right there on the form, settable, and the value dropped. Fixed here because continue-from only became universal when `v87_g` moved it to card 1. The comic path also gains `arcScript`/`script`/`srcScript` |
| **`_readArcScript()`** | One reader for all three paths: `#gen-arc-script-cb` ANDed with `needsIntroScript(...)` — the same predicate `buildArcIntroLessons()` opens with (`if (!needsIntroScript(...)) return []`, server.js), confirmed by READING it. Reproduces exactly what `pdfGenerateAll()` computed inline before, and gives the learner an off switch |
| ⚠️ **a SECOND vacuous guard found — same auto-vivify trap** | `unit-arc-options.test.js` §1 claimed "if a form loses its container, the picker silently renders nowhere", via `!!document.getElementById(id)` — and `lib-dom` auto-vivifies. It stayed GREEN through the release that DELETED `#pdf-arc-types` from `index.html`. Re-anchored to the source. `unit-arc-reinforce-types`'s "both forms render the same options" check had the same shape and became the structural claim instead (one container; every `readArcTypeChecks()` call site names it) |
| the acceptance tests | `unit-gen-wizard.test.js` §12a–e (deleted ids absent AND unreferenced, survivors asserted present; the mode/count helpers; `_applyLessonCardUI()`'s truth table per mode and under skip-lessons; the derived start button across five ready/busy states; the comic dispatch landing on `comicOpenReview()`). FIVE mutations confirmed red. Re-anchored: `unit-comic-chapter` (now also the `continuedFrom` regression guard), `unit-postgen-storyboard-optin`, `unit-postgen-analysis-optin`, `unit-arc-reinforce-types`, `unit-arc-options`; `unit-comic-panel-ui`'s "comic mode hides `#gen-form-section`" assertion INVERTED, not deleted |

---

**`v87_g` — item AL part 1: the wizard collapses from FOUR cards to THREE** (`roadmap_v87.md`'s own
`v87_g` entry has the full write-up, incl. the four user rulings it was blocked on). ⚠️ **This
SUPERSEDES the `v85_c`/`v85_d`/`v85_e` rows below for card NUMBERS and card CONTENTS** — those rows
are kept as the historical record of how the shell was built, and their mechanics (navigation, the
stepper, the reset hook, the `#gen-form-section` single-toggle constraint) are all still accurate.

| what | where |
|---|---|
| **the new card map** | `#gen-card-1` = language pair + script pickers + **`#continue-row`** (continue-select, `#cont-pin-clear`, `#cont-all-langs`, `#use-full-chain-row`). `#gen-card-2` = `#topic-input`, `#user-story-checks`, the four panels (`#pdf-panel`/`#user-story-panel`/`#dialect-panel`/`#comic-panel`) **+ `#story-len-row`/`#num-chapters-row`/`#style-wrap`**. `#gen-card-3` = the OLD `#gen-card-4` renumbered, plus everything lesson-related: `#gen-skip-lessons-row`, `#lesson-type-hdr`, `#diff-wrap`, `#format-wrap`, **`#gen-arc-row`** (was NESTED inside `#num-chapters-row`), `#per-chapter-row`, **`#reinforce-prior-row`/`#vocab-mode-select`** (was nested inside `#continue-row`), `#post-gen-row`, `#gen-btn-row`. `_GEN_WIZARD_CARDS` is back to `3`; the stepper lost its 4th pill |
| **DELETED** | the old `#gen-card-3` ("Chapters") shell itself, `#gen-step-pill-4`, `#gen-step-back-4`/`#gen-step-next-3`, `#gen-create-now-btn` AND `_genWizardCreateNow()` (the function too, not just its button — user ruling: superseded by `#gen-skip-lessons-cb`, which goes further, to zero lessons) |
| ⚠️ **`_applyTextShapingVisibility()` — a NEW function that exists to repair a regression the move itself causes** | `#story-len-row`/`#num-chapters-row`/`#style-wrap` used to sit INSIDE `#gen-form-section`, which `onUseDialectCb()` and `onUseComicCb()` each hide with one `gf.style.display` toggle. On card 2 they are OUTSIDE it, so both modes would newly leave them visible. This one function owns all three rows for all three exclusive panel modes and is called at the END of `onUseStoryCb()`/`onUseDialectCb()`/`onUseComicCb()` (after each has settled the other checkboxes). `#gen-form-section` now spans ONLY `#gen-card-3`, so dialect mode's single-toggle guarantee still holds for the lesson card |
| ⚠️ **`#style-wrap` is NOT hidden for the own-story/PDF path — item AL's write-up was WRONG about this** | AL says "PDF/comic chapters never set `storyStyle` today". Measured: `pdfGenerateAll()` DOES send `storyStyle`, `/api/generate-book` stores it as `base.storyStyle` per chapter, and it reaches real lesson prompts — `sysGrammar`/`sysConjugation` take it as a parameter (`server.js:4173`/`5065`), `generateWriting`/`synonyms` apply it as a `writingStyleNote` (`server.js:4690`), and the `add-lesson` route re-reads `saved.storyStyle` for any lesson added later. ONLY `comicCreateChapter()` hardcodes `storyStyle: null`. So the helper hides style for dialect+comic only; hiding it for own-story/PDF would DELETE a working capability |
| **`ui.json`** | ONE new `en` key, `gen.wizard_step3_lessons` = "3 · Lessons" (725→726). `gen.wizard_step3`/`gen.wizard_step4` are KEPT but now UNUSED — the step NUMBER is baked into each pill string in all 33 languages, so pill 3 could not reuse step4 ("4 · Lessons"), and overwriting step3's `en` value would leave its 32 translations actively WRONG ("3 · Kapitel" on a Lessons step) where a missing key merely falls through to English (`t()`) |
| ⚠️ **a "does not exist" DOM assertion is VACUOUS in this harness** | `test/lib-dom.js`'s `makeDocument()` AUTO-VIVIFIES every id (`getElementById` mints a div on a miss, deliberately). `!!document.getElementById('gen-card-4')` is therefore always true and its negation always red — the first draft of the guard failed on a CORRECT tree. Absence claims belong at the SOURCE layer. Related: an object literal built inside the `vm` context carries that realm's `Object.prototype`, so `assert.deepStrictEqual` mismatches even on equal values — go through `JSON.stringify`/`JSON.parse` |
| the acceptance tests | `test/unit-gen-wizard.test.js` rewritten in place (12 sections, no new `run()` line): per-card nesting for every moved block; the deletions asserted absent at the source layer AND each moved id asserted to appear EXACTLY ONCE (a copy left behind would still satisfy "is inside card N"); `#gen-form-section` spanning only the lesson card with the shaping rows outside it; clamping at `[1,3]` with a stale `_genWizardGoto(4)` clamping down; `_applyTextShapingVisibility()`'s truth table AND its wiring into all three toggles; pill 3 rendering a key that exists in `en`. FIVE mutations confirmed red. `unit-per-chapter-types`/`unit-post-gen-features` re-anchored from `#gen-card-4` to `#gen-card-3` |
| ⚠️ **still OPEN — item AL part 2** | `#pdf-panel`/`#comic-panel` still embed their OWN duplicated arc/skip-lessons/storyboard/analysis rows and their own start buttons; routing all three input modes through card 3 is not done. `comicCreateChapter()` still never sends `continuedFrom` (a real, silent bug). User ruling for part 2: KEEP the live review stop — `comicExtractPanels()`/`splitChaptersLLM()` timing must not change |

---

**`v85_d` — `PLAN §13` milestone 2, PARTIAL: the chaptering-card split** (the "create storyline now"
shortcut was investigated, not built — see `roadmap_v85.md`'s own `v85_d` entry, `### ⚠️ OPEN`
subsection, for the full finding: the plan's "reuses the existing empty-lesson-type no-op" claim
points at `recreateStorylineLessons()`, a POST-HOC add-to-existing-storyline endpoint, not the INITIAL
generation flow — `/api/generate-book`'s `lessonFormat` has no `'none'` value today)

| what | where |
|---|---|
| **the split** | `v85_c`'s catch-all `#gen-card-3` (chaptering+lesson-selection+Generate, one block) became TWO cards: `#gen-card-3` = chaptering (`#story-len-row`/`#num-chapters-row`/`#style-wrap`/`#continue-row`, unchanged), `#gen-card-4` = lesson-selection + Generate (`#lesson-type-hdr`/`#diff-wrap`/`#format-wrap`/`#gen-btn-row`, unchanged). `_GEN_WIZARD_CARDS` is now `4`; the stepper gained a 4th pill |
| ⚠️ **`#gen-form-section`'s span is DELIBERATELY UNCHANGED — it now wraps BOTH new cards, not just one** | `onUseDialectCb()` hides "the normal generation form" with ONE line, `gf.style.display=on?'none':''` (untouched, not this cut's to touch) — splitting the section it targets into two SEPARATE cards would have broken that single-toggle guarantee (hiding it would only visibly matter for whichever card the wizard currently shows). Fixed by nesting `#gen-card-3`/`#gen-card-4` INSIDE `#gen-form-section`'s ORIGINAL open/close tags rather than replacing them — so the one hide call still suppresses both atomically. `#gen-btn-row` moved from a SIBLING of `#gen-form-section` to a DESCENDANT of it (inside `#gen-card-4`) — harmless: `onUseDialectCb()`'s own separate `gbr.style.display` toggle on it still runs, now merely redundant with the section-level hide. Verified live: dialect mode still hides both cards atomically post-split |
| the acceptance tests | `test/unit-gen-wizard.test.js` rewritten in place (same file, no new `run()` line): adds the `#gen-form-section`-wraps-both-cards check (mutation-tested: moving the section's close tag to right after card 3 goes red), splits the old card-3 nesting check into card-3(chaptering)/card-4(lesson-selection) checks, extends the clamp/jump/reset checks to 4 steps |
| ⚠️ **the "create storyline now, add lessons later" shortcut was OPEN at `v85_d`** | ✅ RESOLVED at `v85_e` — see its own row below for what shipped |

---

**`v85_e` — `PLAN §13` milestone 2 completed: the "create storyline now" shortcut** (the user's ruling
on `v85_d`'s own open question — *"skip the arc, standard set only"*, NOT new server-side scoping —
see `roadmap_v85.md`'s own `v85_e` entry for the full write-up)

| what | where |
|---|---|
| **`#gen-create-now-btn`** | new button on `#gen-card-3` (chaptering), below its fields, in its OWN row separate from the Back/Next nav (a shortcut is an alternative to stepping through card 4, not a step in the sequence itself) |
| **`_genWizardCreateNow()`** | forces `#gen-arc-cb` off and `#format-select`/`APP.lessonFormat` to `'standard'` (via the REAL `onFormatSelect('standard')`, not a direct `.value=` assignment — `APP.lessonFormat` is what `doGenerate()` actually reads), then calls the completely UNMODIFIED `doGenerate()` — the same call the normal Generate button makes. Zero new pipeline/endpoint code: "add lessons later" means the storyline screen's EXISTING per-chapter "add lessons" dropdown, unchanged |
| ⚠️ **a pre-existing bug found and fixed, affecting the OLD Generate button too, not just this new one** | `doGenerate()`'s empty-topic guard (`document.getElementById('topic-input').focus()`) predates the wizard and assumed the field was always visible. Since `v85_c`, a learner can reach `#gen-card-3`/`#gen-card-4` — where `#topic-input`'s own `#gen-card-2` is `display:none` — without typing a topic (wizard navigation is deliberately ungated). `.focus()` on a hidden field is silently invisible. This shortcut made the failure mode MORE reachable (it lives on card 3), which is what surfaced it. Fixed at the ONE guard itself: `_genWizardGoto(2)` before `.focus()`, reveal-then-focus — fixes both the shortcut path and the pre-existing button path with one change, no duplication |
| new `ui.json` (`en` only) | `gen.wizard_create_now` (the button label — kept close to `PLAN §13`'s own original phrasing), `gen.wizard_create_now_hint` (the button's `title` — spells out the ACTUAL mechanism, since the label alone reads as "zero lessons" but the real behaviour is "standard set only") (668→670 `en` keys) |
| the acceptance tests | `test/unit-gen-wizard.test.js` extended in place (10 checks total, no new `run()` line): `_genWizardCreateNow()` forces both fields even starting from the opposite state and calls `doGenerate()` exactly once (mutation-tested, independently for each field); an already-correct-fields no-op sanity check; the `doGenerate()` guard fix (mutation-tested: reverting `_genWizardGoto(2)` goes red) |
| ⚠️ **`ui.json`'s `fs.watch` hot-reload did not pick up this edit live** | confirmed via `curl localhost:3000/api/ui?lang=en` that the running dev server's in-memory copy stayed stale after the file edit — a known Node/editor-tool interaction (an editor writing via temp-file-then-rename can silently stop a `fs.watch` watcher for the original path), NOT a code bug. The file itself parses clean and the automated tests read it fresh, independent of any running server; only the LIVE server's own cache was affected, fixed by the same restart the session protocol already gates behind asking first |

---

**`v85_f` — `PLAN §13` milestone 3: label reword + per-chapter lesson-type override** (the user's
ruling on how the override should work — *"sequential, reusing existing per-chapter endpoint"*, NOT a
new server-side per-chapter `arcTypes` body shape — see `roadmap_v85.md`'s own `v85_f` entry for the
full write-up and the investigation that found `/api/generate-book`'s `arcTypes` is uniform per book,
never per-chapter, today)

| what | where |
|---|---|
| **the label reword** | `form.arc_lbl` — ALREADY one shared `ui.json` key for both `#gen-arc-lbl` and `#pdf-arc-lbl`, translated into all 33 languages. `en` value changed to "🎯 Add more lesson types to each chapter" (+ matching static HTML fallback in both places); other languages lag until translated, same pattern `v85_d`'s `gen.wizard_step3` reword used |
| **`#per-chapter-row`** (on `#gen-card-4`) | checkbox + `#per-chapter-list`, same multi-chapter-only visibility gate `onNumChaptersSlider()` already applies to `#gen-arc-row` (extended, not duplicated) — including resetting (uncheck + hide) if the learner drops back to 1 chapter with it already open |
| **`_renderPerChapterTypes()`** | renders ONE `renderLessonTypeChecks()` tick-list PER PLANNED CHAPTER (`1..APP.numChapters` — chapters don't exist yet, only a count is known), each its own container (`#per-chapter-types-N`) + class (`pc-lt-check-N`) so `_readPerChapterTypes(n)` can read them back independently as an array of arrays |
| **`renderLessonTypeChecks()`'s new `noMixed` option** | suppresses the "🔀 finish with mixed review" row — `mixed` owns no content of its own, it's created CLIENT-SIDE against an already-loaded chapter's lesson list (`doAddLesson()`'s own `mixed` branch), which the per-chapter picker never loads (only `topicId`s, once the book job finishes). The TWO existing callers (`renderArcTypeChecks`, `doAddLesson`'s own card) omit the option and are UNCHANGED — proven by a dedicated test, not just asserted |
| **the override REPLACES the shared arc for that generation** | `doGenerate()`'s multi-chapter branch captures `perChapterTypes` via `_readPerChapterTypes(nCh)` BEFORE the `/api/generate-book` request fires (the picker's own DOM lives on a screen the learner may leave long before the book job finishes) and skips setting `gbody.arc`/`gbody.arcTypes` entirely when the override is on — even if `#gen-arc-cb` is left checked. A type must never be requested twice for the same chapter |
| **`_applyPerChapterTypes(finalJob, perChapterTypes)`** | runs AFTER the book job completes (chained via `.then()` onto `_pollGenBook()`'s own returned promise, not awaited inline — `doGenerate()` stays fire-and-forget for the book job exactly as before this milestone). One `/api/lessons/add-lesson` call per (chapter, type) pair, SEQUENTIALLY (gentle on the backend); one call's failure is caught and does not abort the rest of the batch |
| ⚠️ **`_pollGenBook()` now RETURNS the final job status** | previously fire-and-forget, its resolution discarded by its one pre-existing caller. Hoisted `j` out of the polling loop and added `return j;` at the end — the ONLY new caller (`_applyPerChapterTypes`) needs `chapters[].topicId`; every other behaviour is unchanged |
| the acceptance tests | new `test/unit-per-chapter-types.test.js` (8 checks, several mutation-tested): markup nesting, the visibility gate + reset, exactly N real rows rendered, `noMixed` proven not to affect existing callers, per-row read independence, `doGenerate()` never setting `gbody.arc` when the override is on, `_applyPerChapterTypes()`'s call targeting/skip logic/failure isolation, and `_pollGenBook()`'s return value. `test/unit-recreate-ui.test.js` (pre-existing, checks `form.arc_lbl`'s KEY exists, not its value) needed no change |
| ⚠️ **two harness gotchas hit writing that file, both now documented in its own header** | `document.getElementById`/`.querySelector` NEVER return null on a miss (`lib-dom.js` auto-vivifies an empty `<div>` stub, deliberately) — `!!getElementById(...)`/`!!querySelector(...)` are therefore ALWAYS true; check `.tagName` against the expected real result (or a container's `.children.length`) instead. Separately, `vm.runInContext` (`C.run()`) executes each string as a plain script — a bare top-level `await` inside one is a SyntaxError; wrap async work in its own `(async()=>{...})()` IIFE inside the string, do the real `await` OUTSIDE via a `settle()`-style delay between separate `C.run()` calls (the shape `unit-ui-journeys.test.js` already used) |

---

**`v85_g` — `PLAN §13` milestone 4: the additional-features card (storyboard + QC toggles)** (see
`roadmap_v85.md`'s own `v85_g` entry for the full write-up — unlike `v85_d`/`v85_f`, THIS
investigation found the plan's "reuses existing machinery" claim held up cleanly on both counts, no
ruling needed)

| what | where |
|---|---|
| **`#post-gen-row`** (on `#gen-card-4`) | two checkboxes, `#post-gen-storyboard-cb`/`#post-gen-qc-cb`, same multi-chapter-only gate `onNumChaptersSlider()` already applies to `#gen-arc-row`/`#per-chapter-row` (extended again) — including unchecking both if the learner drops back to 1 chapter |
| **`doGenerate()`'s multi-chapter branch** | captures `postGen = {storyboard, qc}` BEFORE the `/api/generate-book` request fires (same reasoning `perChapterTypes` uses). Chained onto `_pollGenBook()`'s returned promise AFTER `_applyPerChapterTypes` (sequential — gentler on the backend, and QC has more content once per-chapter extras have landed), and ONLY when at least one toggle is on |
| **`_applyPostGenFeatures(finalJob, opts)`** | resolves the NEW storyline from the freshly-`loadSavedList()`-refreshed `APP.storylines` by finding the entry whose `.chapters` includes the book's first chapter id (cheaper than recomputing the server's `_chainId()` hash, which isn't exposed client-side at all). If `storyboard` is on AND a storyline resolved: `POST /api/storyline-storyboard` with the resolved `slId` + REAL topic NAMES read from `APP.savedList` (the ACTUAL, possibly-retitled names — `/api/storyline-storyboard`'s handler resolves topics server-side via `findSaved(name)`, confirmed by reading it, so names are all it needs). If `qc` is on: `qcRun({storylineId})` — the SAME function/endpoint the storyline screen's own manual "QC all chapters" button already calls, which already loops every chapter in ONE request — falling back to `qcRun({topicId: <first chapter>})` if no storyline resolved (a defensive fallback; this release's own multi-chapter-only gate means a storyline should always resolve in practice) |
| ⚠️ **deliberately scoped narrower than the full milestone** | wired ONLY onto the multi-chapter book-completion path. Single-chapter generation keeps its own EXISTING separate manual trigger (`#story-qc-btn` → `/api/story-qc`, a DIFFERENT route from `/api/qc`) — automating that path too is left as a documented follow-up, not folded in here |
| ⚠️ **title/summary generation deliberately left untouched** | reading `_runBookJob`'s own post-pass (`server.js`) confirmed chapter titles, storyline title, and storyline summary ALL already run automatically, with "never overwrite an authored value" guards already in place — the original assessment's "storyboard and QC... as toggles" sentence never named title generation, so `v85_g` didn't touch it |
| the acceptance tests | new `test/unit-post-gen-features.test.js` (7 checks, several mutation-tested): markup nesting, the visibility gate + reset, `doGenerate()` only calling `_applyPostGenFeatures` when needed, the storyboard/qc calls' exact shapes with each toggle independently on/off, the "no storyline resolved" skip (mutation-tested with a SECOND signal — `setGenStatus` never called with the storyboard status — because a guard-less crash on `sl.id` being null and a deliberate skip both show zero storyboard `fetch` calls from the stub's own side; the fetch-count check alone didn't distinguish them, worth remembering for the next similar guard), and failure isolation (a rejected storyboard call doesn't block `qcRun`) |

---

**`v85_h` — `PLAN §13` milestone 5, part 1: the `doDialectImport()` language-pair bug** (see
`roadmap_v85.md`'s own `v85_h` entry for the full write-up)

| what | where |
|---|---|
| **the bug was on BOTH sides, not just the client** | `doDialectImport()` (`index.html`) hardcoded `base:'de', source:'de'` in its request body — AND `/api/dialect-import`'s handler (`server.js`) ALSO hardcoded `base: 'de'` in its own call to `buildDialectTopic()` (`dialect-glossary.js`), ignoring whatever the client sent. Fixing only one side would have done nothing |
| the fix | client now sends `base:APP.lang, source:APP.srcLang` (the live selected pair from `#src-lang-select`/`#lang-select` on card 1 — confirmed via `buildDialectTopic()`'s own `lang: base, srcLang: source` mapping that these are exactly the right fields); server now reads `body.base` (sanitized the same way `body.source` already was), instead of hardcoding it. Omitting `base`/`source` in the request still defaults to `'de'`/`'de'`, unchanged |
| ⚠️ **`#continue-select` (the control the original bug note named) is a red herring** — worth knowing before re-deriving this | it lives inside `#continue-row`/`#gen-form-section` (chaptering), which `onUseDialectCb()` already HIDES while dialect mode is active — not reachable from the dialect form at all. The control that actually matters is the language pickers on card 1, which stay visible in dialect mode |
| ⚠️ **`server.js` changes need a FRESH PROCESS to verify live, not the user's own dev server** | confirmed via `/api/info` that the user's long-running port-3000 server was STILL running `v85_b`'s code throughout this entire session — Node loads route-handling code once at startup, unlike `index.html` (`fs.readFileSync` per request). A `curl` against port 3000 testing this exact fix gave a false negative. `test/lib.js`'s `boot()` (spawns a fresh `node server.js` per e2e run) is the correct verification path for any `server.js` change — and it doesn't need the user's restart-permission at all |
| the acceptance tests | `test/unit-dialect-panel.test.js` extended (static-analysis, matching that file's convention): the function no longer contains a hardcoded `base:'de'`, and does reference `APP.lang`/`APP.srcLang`. `test/e2e-dialect-import.test.js` extended (2 checks against a real fresh-spawned server): an explicit `base`/`source` pair lands on the saved topic's `lang`/`srcLang`; omitting both still defaults to `de`/`de`. Both mutation-tested |
| ⚠️ **milestone 5's SECOND item (attribution fields at generation time) was OPEN at `v85_h`** | ✅ RESOLVED at `v85_i` — see its own row below for what shipped |

---

**`v85_i` — `PLAN §13` milestone 5, part 2 (LAST item): attribution fields at generation time — `PLAN §13` IS NOW FULLY DONE** (the user's ruling on `v85_h`'s own open question — cover BOTH the
single-pasted-story path AND the PDF/document-upload path — see `roadmap_v85.md`'s own `v85_i` entry
for the full write-up)

| what | where |
|---|---|
| **nothing server-side changed** | the schema (`topic.source = {author,licence,url,note}`, `sanitizeTopicSource()`) and endpoint (`POST /api/topic-source`, resolves by an EXISTING topic id) already existed and already worked — proven by `openProvEdit()`/`saveProvEdit()`, the post-hoc editor on `#prov-stats`. This item is pure client-side wiring |
| **`#gen-source-row`** (inside `#user-story-panel`) | 4 inputs, reusing the SAME `ui.json` keys (`prov.author`/`prov.licence`/`prov.url`/`prov.note`) the post-hoc editor already uses — zero new UI strings. No visibility gate of its own; inherits `#user-story-panel`'s (only meaningful once "this is my own story or document" is checked) |
| **`_readGenAttribution()`** | reads the 4 fields, returns `null` if ALL are empty — so nothing is ever sent for a plain LLM-topic generation, which has no external source to attribute |
| **`_applyGenAttribution(ids, source)`** | one `POST /api/topic-source` call per id, SEQUENTIALLY, each id's own failure isolated from the rest (mirrors `_applyPerChapterTypes`'s own per-call isolation) — updates `APP.savedList`/`APP.lessonData`'s own cached copies on success |
| **wired into THREE completion paths, each read in full first** | (1) `doGenerate()`'s single-pasted-story branch — BOTH the immediate `resp.cached` hit and the async `startBackgroundJob()` path (which needed `genAttribution` threaded as a NEW 3rd parameter, riding on `APP.activeJob`/its `localStorage` copy so a reload mid-generation doesn't lose it — `resumeBackgroundJob()`'s own TWO branches, job-finished-while-closed and still-running-reattach, both needed the same threading); (2) `pdfGenerateAll()` (an entirely separate function from `doGenerate()`) — one shared attribution applied to EVERY resulting chapter id; (3) the default LLM-topic path — correctly untouched, `_readGenAttribution()`'s fields are simply never read for it |
| ⚠️ **`_pollBookJob()` now RETURNS the final job status**, same treatment `_pollGenBook()` got at `v85_f`/`v85_g` | previously discarded; the ONLY new caller (this item's own PDF-path attribution) needs `chapters[].topicId` |
| the acceptance tests | new `test/unit-gen-attribution.test.js` (11 checks, several mutation-tested): markup, `_readGenAttribution()`'s null-vs-filled shape, all three completion paths independently (including BOTH `resumeBackgroundJob()` branches), `_pollBookJob()`'s return value, and `_applyGenAttribution()`'s per-id call/cache/failure-isolation behaviour |

**`PLAN §2.4` / Track A4 milestone 1 — comic upload + panel-drawing UI (`v85_j`)** (all in `index.html`, client-side only, NO model call anywhere in this milestone — see `roadmap_v85.md`'s own "PLAN §2.4 — UI SCOPING" section for the full plan)

| what | where |
|---|---|
| **`#comic-panel`** (inside `#gen-card-2`, sibling of `#pdf-panel`/`#user-story-panel`/`#dialect-panel`) | file input (`#comic-file-input`, `accept="image/png,image/jpeg"`) → `#comic-draw-wrap` (an `<img>` + an absolutely-positioned `<canvas>` overlay for drawing) → `#comic-panel-list` (the drawn-box list, reorder/delete) → `#comic-panel-actions` (`#comic-clear-btn` + a live count) |
| **the toggle** | `onUseComicCb()`, structurally identical to `onUseDialectCb()` — toggles `.open` on `#comic-panel`, hides `#gen-form-section`/`#gen-btn-row`/`#topic-label`/`#topic-input`. Mutually exclusive with BOTH `use-story-cb` and `use-dialect-cb`, in BOTH directions — required a small hook added to `onUseStoryCb()`/`onUseDialectCb()` each (checking+closing comic when either turns on), since neither pre-existing function knew about a third mode. Does NOT touch the pre-existing story↔dialect asymmetry (dialect already excludes story; story never excluded dialect) — left as found, out of scope for this addition |
| **state** | `APP_COMIC = {dataUrl, naturalW, naturalH, boxes, drawing}` — module-level, not on `APP` itself. Boxes are stored in NATURAL IMAGE PIXEL coordinates, not the 0-1000-normalized space this session's vision-model probes used — that conversion (if still needed at all) belongs at extraction time (milestone 2), not here, so this milestone's data model doesn't assume any particular backend/model choice |
| **the drawing mechanic** | `_comicSetupCanvas()` sizes the canvas to the DISPLAYED (CSS) size of the image, not its natural resolution (it only ever draws selection rectangles, never the image itself). `_comicPointerStart/Move/End` handle both mouse AND touch (`touchstart`/`touchmove`/`touchend`, `{passive:false}` so `preventDefault()` can suppress scroll-while-drawing) through one shared `_comicEventXY(e)` coordinate extractor. `_comicPointerEnd` normalizes the drag direction (`Math.min`/`Math.max`, so a bottom-right-to-top-left drag still yields `x1<x2, y1<y2`), scales CSS→natural pixels, and REJECTS a near-zero drag (`<8px` either axis) rather than storing a degenerate "panel" |
| **`_comicRedraw()`'s no-2D-context guard** | `if(!canvas\|\|!canvas.getContext) return;` / `if(!ctx) return;` — genuinely load-bearing, not defensive dead code: mutation-tested by removing it, which throws a `TypeError` on `canvas.getContext` as early as `onUseComicCb()`'s own `comicClearPanels()` call, since `test/lib-dom.js`'s DOM stub has no 2D canvas support at all |
| **the list** | `_comicRenderList()` — one row per box (colored number badge matching the canvas overlay's own color cycling, `_COMIC_COLORS`, 8 colors), `↑`/`↓` (`comicMovePanel`, bounds-checked no-ops past either end) and `✕` (`comicDeletePanel`). `comicClearPanels()` empties everything; called automatically on a NEW image upload (old boxes would reference the wrong image) and when comic mode is unchecked |
| **`_comicPanels()`** | the accessor milestone 2's extraction step is meant to read through, RETURNS A DEFENSIVE COPY (`APP_COMIC.boxes.map(b=>({...b}))`) — so a caller can freely mutate what it gets back without corrupting `APP_COMIC`'s own state, and so the internal storage shape can change later without hunting down every call site |
| new `ui.json` keys, `en` only per standing rule | `form.use_comic`, `form.comic_help`, `form.comic_choose`, `form.comic_clear` — all include their own emoji prefix, same convention as `form.use_story`/`form.use_dialect` |
| the acceptance tests | new `test/unit-comic-panel-ui.test.js` (10 checks): markup nesting, the toggle's form-hiding + BOTH-DIRECTION mutual exclusion with story/dialect, drag geometry (both drag directions, near-zero-drag rejection), list mutation (delete/reorder/clear, reorder bounds-checked), `_comicPanels()`'s defensive-copy guarantee, and the no-2D-context guard (mutation-tested) |
| what this milestone does NOT do | no server call, no `llm.js` change, no chapter/lesson formation from drawn panels — those are milestones 2-4, not yet started |

**`PLAN §2.4` / Track A4 milestone 2 — batch text extraction (`v85_k`)** (client crop → one server job →
`qwen2.5vl:7b`, per the user's own ruling; see `roadmap_v85.md`'s "PLAN §2.4" RESULT PART 3 for why)

| what | where |
|---|---|
| **`opts.images` on `llm.js`'s `_callOllama`** | an array of BARE base64 strings (no `data:...;base64,` prefix — Ollama's own `/api/chat` contract), attached to the USER message only. Every prior vision call in this codebase (all four `§2.4` probe scripts) hand-rolled its own HTTP request BECAUSE this was missing; this is the one place that duplication now converges on. NOT threaded into `callLLMStream` — no streaming caller needs images yet |
| **`OLLAMA_VISION_MODEL`** (server.js) | a new role, same runtime-mutable pattern as story/translation/lessons/qc/tutor (`currentModels()`/`setRuntimeModels()`/`/api/models` all extended) — but DELIBERATELY does not fall back to `OLLAMA_MODEL`/the `all` override the way every other role does, since the general text-model default has zero vision capability; falling back would produce a confusing failure instead of a clear one. Defaults to `qwen2.5vl:7b` |
| **`callLLMVision()`** | the vision role's wrapper, same shape as `callLLMQC`/`callLLMTutor` — goes through the SAME `_callLLM` token-metering choke point every other role does |
| **`OLLAMA_ANALYSIS_MODEL`** (server.js, `v86_n`) | a new role, groundwork for `PLAN §7.0` CP2's per-token lemma/form/sense pipeline (`canonical-analysis.js`), reconciled with item W "text explorer mode" (`roadmap_v86.md`) — **not yet called from any route**, no `callLLMAnalysis()` wrapper exists yet, this cut only makes it a real, independently-switchable role (`currentModels()`/`setRuntimeModels()`/`/api/models` GET+POST/`/api/info` all extended, same pattern as every other role). UNLIKE vision, DOES fall back to `OLLAMA_MODEL`/the `all` override — analysis needs no special model capability, so the general default is a legitimate fit. Defaults to `OLLAMA_MODEL` itself (not the CLI pipeline's own cheap dev default `qwen2.5:7b` — a real measured comparison, `roadmap_v86.md`'s `v83_n`→`v83_p` note, found that model 2/8 wrong on this exact task where the production text model was 0/8 wrong). Not a "thinking" role — `canonical-analysis.js`'s own `analyzeSentence` always passes `think:false` itself, never reads `OLLAMA_THINK` |
| **`POST /api/comic-extract`** | async, returns a `jobId` immediately (`newJob()`/`jobStep()`/`jobDone()`/`jobFail()` — the GENERIC job primitive, confirmed to reuse cleanly here, unlike the CLIENT-side `startBackgroundJob` wrapper checked at milestone-1-scoping time). Body: `{images:[dataUrl,...], lang}`. Validates: non-empty (rejects an all-empty batch, but does NOT filter out individual empty/invalid entries — see the next row for why), capped at 30 images/batch |
| **`_runComicExtractJob(jobId, images, lang)`** | one `callLLMVision` call per image, SEQUENTIALLY, tolerating one panel's failure without losing the rest of the batch (same shape as `_runRecreateJob`'s per-type try/catch) — a failed panel gets a placeholder result object (`{caption:'',inScene:'',raw:'',error}`), not a skipped array slot, so the client's INDEX ALIGNMENT between its `APP_COMIC.boxes` and the server's `panels[]` response survives a partial failure. **Found live** (not assumed): the route handler originally FILTERED empty/invalid entries out of `images` before the job ever saw them — this silently desynced indices on the very first partial-failure test; fixed by normalizing-not-filtering, only rejecting when the WHOLE batch is empty |
| **`_comicExtractPrompt(langName, lang)`** | generalized across all 33 target languages where possible — case-restoration only applies to scripts that HAVE case at all (the MODEL decides that, per `PLAN §2`'s own "the app does not encode per-language grammar" principle). **THREE live-verification rounds settled the worked-example question** (`v85_k`→`v85_l`): round 1 (synthetic panel, principle-only prompt) — case-restoration did NOT fire; round 2 (the SAME real comic panel this session's probes used, principle-only prompt) — STILL did not fire, disproving "maybe synthetic text doesn't read as comic lettering"; the worked example is genuinely the necessary ingredient, not a probe-run coincidence. Fix (`v85_l`): the German worked example is restored, but CONDITIONALLY — only when `lang === 'de'`, the one language with real evidence; every other language stays principle-only and UNMEASURED, not silently assumed equivalent. Round 3 (same real panel, FIXED prompt): EXACT match to ground truth on both fields, through the actual production route. `test/e2e-comic-extract.test.js` §5 guards the conditional (present for `de`, absent for `fr`) against a silent regression |
| **`_parseComicExtraction(raw)`** | parses a `CAPTION: ...` / `IN-SCENE: ...` labeled response into `{caption, inScene, raw}` — either field empty is ambiguous between "no text of that kind" (a valid, silent panel) and "parsing found nothing" (a real failure); `raw` is kept alongside so a human reviewing results can tell them apart |
| **client: `_comicCropDataUrl(box)`** | crops the FULL-RESOLUTION `#comic-draw-img` (not the CSS-scaled canvas) to one box's natural-pixel bounds via a throwaway `<canvas>`, `toDataURL('image/jpeg', 0.92)` — §2.3's "crop in the browser, free" option, chosen over sending the whole page + coordinates (the exact thing that failed three ways in `§2.4` RESULT PART 1) |
| **client: `comicExtractPanels()`** | crops every drawn box (in order), POSTs them all in ONE batch (per the user's own ruling: draw first, extract in one batch afterward), hands the returned `jobId` to `_startComicExtractJob()` |
| **client: `_startComicExtractJob()`** | a structural SIBLING of `startBackgroundJob()` (same poll-every-2s-against-`/api/job/:id` shape) — NOT a reuse of it, confirmed at scoping time: `startBackgroundJob` is hardwired to story-generation's own completion actions |
| **client: `_comicApplyExtraction(panels)`** | merges server results onto `APP_COMIC.boxes` BY INDEX, tolerates fewer results than boxes and a non-array argument (both no-ops, not crashes) |
| **`_comicRenderList()`** (extended) | now shows a text preview (or an error, or "no text found") once a panel has been extracted, instead of just its pixel size — `_comicPanelSummary`/`_comicPanelSummaryHtml` (plain-text for the `title=` tooltip, escaped HTML for the row) |
| new `ui.json` keys, `en` only | `form.comic_extract`, `form.comic_extracting`, `form.comic_extract_failed` |
| the acceptance tests | `test/e2e-comic-extract.test.js` (a REAL fresh-spawned server + fake Ollama — the route/job is server.js, needs a fresh process per the standing rule): batch success in order, `images` actually reaches the fake AND the `data:` prefix is stripped first, one bad panel doesn't lose the rest (index-aligned — this is the test that caught the filter bug above), both validation guards. `test/unit-comic-extraction.test.js` (client side, 7 checks): crop geometry via a mocked canvas context, POST body shape, zero-panel no-op, network-failure recovery, both poll outcomes (a REAL 2000ms wait, same convention as `unit-gen-attribution.test.js`'s own `startBackgroundJob` test), and `_comicApplyExtraction`'s index-merge/tolerance behaviour. `test/fake-ollama.js` gained a `comic_extract` routing branch (keyed on the prompt's own opening sentence, since `system` is empty for this call — every other role has a non-empty system prompt) and now logs `images` (length + a short prefix, not the full base64) |
| **live-verified** (not just the fake) | a fresh `PORT=3457` server (NOT the user's own — a real dev server was found already bound to port 3000, untouched, across BOTH `v85_k` and `v85_l`) against the REAL `qwen2.5vl:7b`: full pipeline confirmed end-to-end (checkbox → upload → draw → extract → poll → merge → render). `v85_l` re-ran the SAME real comic panel used throughout this session's probes through the ACTUAL `/api/comic-extract` route (not a probe re-implementation) and got an EXACT match to ground truth — see `_comicExtractPrompt`'s own row above |

**`PLAN §2.4` / Track A4 milestone 3 — chapter formation from extracted panels (`v85_m`)** (one uploaded
page = one chunk = one chapter, fed through the SAME `/api/generate-book` pipeline PDF/pasted-story
uploads already use — see `roadmap_v85.md`'s "PLAN §2.4 — UI SCOPING" section for the plan)

| what | where |
|---|---|
| **confirmed before building**: chunk text becomes `story` VERBATIM | read `generate()`'s own `userStory` handling: `if (userStory) story = userStory.trim();` — no model rewrite, exactly like PDF/pasted-story chapters. This is WHY joining panel text into one chunk's `text` is sufficient; the model is only asked to generate LESSONS from it, never to rewrite the narrative |
| **confirmed before building**: `_pollBookJob()`/`_applyBookProgress()` do NOT reuse | both are hardwired to `#pdf-panel`'s own state (`_pdfChunks`, `#pdf-gen-btn`) — the same "checked, not assumed" pattern milestone 2's scoping used for `startBackgroundJob`. A new sibling poller was written instead |
| **user ruling**: caption AND in-scene text both become part of the story | (not caption-only) — keeps sign/banner text learnable via the normal vocab/comprehension pipeline, at the cost of prose that occasionally reads as "and the sign says X" |
| **client: `_comicBuildStoryText()`** | joins each panel's caption then in-scene text (its own line each), panels separated by a blank line, IN READING ORDER (`_comicPanels()`'s own array order — already correct, since that's what the user drew/reordered). A panel with NEITHER field (never extracted, or extracted to nothing) is skipped entirely, not rendered as an empty paragraph |
| **client: `comicCreateChapter()`** | builds ONE `chunks` entry (`{title, text, wordCount, comicPanels}`) and POSTs it to `/api/generate-book` — the SAME endpoint `pdfGenerateAll()` uses. `comicPanels` re-crops each box FRESH via `_comicCropDataUrl` (not a cached crop from the extraction step — simpler than caching, and correct as long as boxes haven't been redrawn since extracting, a known simplification). Fails cleanly with no network call if there are zero panels or none have any extracted text yet |
| **client: `_pollComicBookJob()`** | a structural SIBLING of `_pollBookJob()` (same poll-every-2s-against-`/api/book-job/:id` shape), with its OWN `_comicBookId`/`_comicBookPolling` state and its own UI updates (reuses `#comic-extract-status`, disables BOTH `#comic-create-btn` and `#comic-extract-btn` while a chapter is being created — redrawing/re-extracting mid-creation would race the already-sent snapshot) |
| **server: `_runComicExtractJob`'s sibling attachment point** | `_runBookJob`, one line before `_persistGenerated`: `if (chunks[i].comicPanels) data.comicPanels = chunks[i].comicPanels;`. `upsert()` spreads `data` with no field whitelist, so no schema migration was needed — confirmed by reading `upsert()` before relying on it. Absent for every other chunk source (PDF, pasted text, generated) |
| new `ui.json` keys, `en` only | `form.comic_create`, `form.comic_create_failed` |
| the acceptance tests | `test/e2e-comic-chapter.test.js` (real fresh-spawned server + fake Ollama — this is a `_runBookJob` change, needs a fresh process): `comicPanels` survive the whole pipeline onto the persisted topic, `story` is the chunk text VERBATIM, and an ordinary (non-comic) chunk gets NO `comicPanels` field (additive, not a default). `test/unit-comic-chapter.test.js` (client side, 6 checks): the join logic (including the empty-panel-skip case), zero-panels/no-text-yet no-ops, the POST body shape (fresh crops, not cached ones), and both poll outcomes (a REAL 2000ms wait, same convention as `unit-gen-attribution.test.js`) |
| **live-verified** (real model, both halves) | REUSED the exact real-extracted text from `v85_l`'s own confirmed-correct extraction (no need to re-run vision extraction) and POSTed it straight to the real `/api/comic-extract`→`/api/generate-book` pipeline on a fresh `PORT=3457` server. First attempt hit a real, PRE-EXISTING lesson-generation flake (`"Vocabulary item 1 has no model-proposed skillId"` — a known non-determinism in `qwen3.6:35b-a3b`'s lesson output, unrelated to this milestone's own code); an identical retry succeeded, confirming it was a one-off model hiccup, not a bug introduced here. The persisted topic's `story` matched the extracted text exactly, `comicPanels` carried the correct box/caption/inScene/image, and a real lesson was generated from it. **A live-verification side effect was found and cleaned up**: the verification server used the DEFAULT `lessons.json` path (no `LESSONS_FILE` override, unlike the e2e harness's isolated temp files), so the test chapter was briefly written into the user's REAL corpus — caught immediately via a before/after topic-id diff and removed with `DELETE /api/lessons/delete`, confirmed byte-for-byte back to the committed baseline (aside from two of the user's OWN unrelated real edits made on their separate live server during the same window, correctly left untouched) |

**`PLAN §2.4` / Track A4 milestone 4 — progress-card integration (`v85_n`)** — the LAST milestone in
the original `PLAN §2.4` plan. **Track A4 is now FULLY SHIPPED** (milestones 1-4, `v85_j` through
`v85_n`). Comic-sourced chapters ONLY, per the standing ruling made earlier in this line.

| what | where |
|---|---|
| **`_storyBodyHtml`'s new branch** | `if (o.text == null && Array.isArray(d.comicPanels) && d.comicPanels.length) return _comicStoryPanelsHtml(d, o);` — placed BEFORE the `o.highlight === false` check and the normal highlight/wrap logic, so a comic-sourced chapter reaches every one of this ONE shared renderer's callers (progress card, question panel, chain view, saved-story reader) automatically, with zero per-caller wiring. `o.text != null` (a caller substituting different text, e.g. a translation) bypasses the branch — the panels describe `d.story` specifically |
| **`_comicStoryPanelsHtml(d, o)`** | Tier 1 per `PLAN §2.6` (bubble/panel-level boxes, ordinary clickable HTML text) — NOT per-word image coordinates (Tier 2, still out of scope, still unmeasured). Calls the EXACT SAME chain the normal path uses (`furiHtml` → `_highlightVocabHtml` → `_storyParasHtml`, plus `_wordStateMap`/`_askedKeys`) once PER PANEL instead of once for the whole story, so a solved/unsolved vocab word inside a panel's text lights up exactly like it would in the plain-text renderer. `o.highlight === false` still renders the panels (an image is useful regardless) but skips both the `story-selectable` tutor-selection wrapper and vocab marking, matching the plain-text path's own behaviour for that flag |
| **panel markup** | `.comic-story-panels` > one `.comic-story-panel` per drawn panel (in the SAME order they were drawn/extracted) → `.comic-story-panel-img` (only rendered if `p.image` is truthy — a panel with no image renders no `<img>` tag at all, not a broken/empty-`src` one) + `.comic-story-panel-text` (the joined caption+in-scene text, run through the highlighting chain) |
| new CSS | `.comic-story-panels`/`.comic-story-panel`/`.comic-story-panel-img`/`.comic-story-panel-text` — a simple vertical card stack, image above text, `object-fit:contain` so a panel's own aspect ratio is preserved rather than cropped |
| the acceptance tests | new `test/unit-comic-story-panel.test.js` (7 checks): markup/ordering, NO REGRESSION for a plain (non-comic) topic, `opts.text` bypassing the branch, `highlight:false` behaviour, PER-PANEL vocab highlighting via the shared machinery, empty-field joining (no stray `<br>`), and a missing image rendering no `<img>` tag. **A second, DEEPER DOM-stub limitation was found and worked around while writing this file** (beyond the documented null-on-miss one): a nested `.querySelector(...).innerHTML` on a sub-element pulled out of an EARLIER `.querySelectorAll(...)` result does not reflect real content on this harness, even though `.textContent` and attribute reads on the exact same nested match DO work correctly. Worked around by parsing the RAW HTML STRING directly for the two checks that needed it, rather than round-tripping through the stub DOM a second level deep |
| **live-verified** | a fresh, EXPLICITLY-ISOLATED `LESSONS_FILE` verification server this time (the `v85_m` mistake — using the default path and briefly polluting the real corpus — was not repeated). Injected a synthetic comic-sourced topic via `_storyBodyHtml` directly and screenshotted the rendered output: two panels, each with its own highlighted vocab words, one panel with a (slow-loading external test) image and one deliberately without — confirmed the no-image panel renders no broken image element, matching the unit test's own claim |
| what remains genuinely unmeasured | real mobile/touch rendering of the panel cards; a comic chapter with many (10+) panels (layout/scroll behaviour untested at that scale); Tier 2 (per-word image coordinates) remains explicitly out of scope, not attempted |

**`PLAN §2.4` / Track A4 milestone 5 — auto-detect panels (`v85_o`)** — an ADDITION on top of the
already-complete 4-milestone plan, not a milestone the original scoping named. User: "how about auto
recognition of panels. did'nt it work reasonably well with qwen?" — a real, accurate memory of `PLAN
§2.4`'s own "RESULT PART 3" finding.

| what | where |
|---|---|
| **the design choice** | a SUGGESTION, not a replacement for manual drawing — pre-fills `APP_COMIC.boxes` in the SAME shape a hand-drawn box uses (milestone 1), fully reviewable/editable/deletable through the existing UI before extraction. Chosen specifically because the underlying model result (`qwen2.5vl:7b`'s one-shot enumeration) was only ever measured on `§2.7`'s EASY fixture — never the hard one — so treating it as auto-apply would have been trusting an unmeasured case |
| **`_COMIC_DETECT_PROMPT`** (server.js) | the EXACT one-shot enumeration prompt from `probe_comic_panels_v85_i.js`, carried over verbatim — no parameters, unlike `_comicExtractPrompt` (no language dependency; panel geometry isn't a language question) |
| **`_parseComicDetectedPanels(text)`** | the probe's own (twice-corrected) parser, carried over — AND EXTENDED with a THIRD fix found by THIS milestone's own live check (not by any prior probe): the real model sometimes wraps coordinates in bare ANGLE brackets (`Panel 1: <23 58 407 396>`), a format neither the `<box>` tag nor the bracket/bare fallback (square brackets only) accounted for. First live run against the real Page B fixture through the ACTUAL production route parsed **0 of 6 panels** despite the model answering essentially perfectly (near-identical box values to the original probe's own success) — a parser gap, not a model regression, caught only because this milestone verified through the real endpoint rather than trusting the probe's own historical result. Fixed (`[\[<]?`/`[\]>]?` accepts either bracket style), MUTATION-TESTED (reverted the fix, confirmed the guard test goes red — 2 of 4 panels parsed instead of 4), then re-verified against the real fixture again: all 6 panels, matching the original probe's clean grid |
| **`POST /api/comic-detect-panels`** | async, returns a `jobId` (generic job primitive, same as extraction/chapter-formation). Body `{image: dataUrl}` — the FULL uploaded page, not a crop (this is the one place in the whole feature that still asks the model to locate something, by design — the suggestion it produces is what the user edits BEFORE any crop is made). Response: boxes normalized 0-1000 (the model's own coordinate space) |
| **client: `comicDetectPanels()`** | POSTs the full page, hands the returned `jobId` to `_startComicDetectJob()` — a THIRD sibling poller (extraction, chapter-formation, now detection each have their own — server-side job/poll primitives keep reusing cleanly, client-side wrappers keep needing their own, a now four-times-confirmed pattern for this codebase) |
| **client: `_comicApplyDetectedPanels(panels)`** | converts normalized 0-1000 boxes to `APP_COMIC`'s own natural-pixel storage using the image's ACTUAL dimensions (`APP_COMIC.naturalW/H`) — the SAME shape a hand-drawn box uses, so every existing consumer (reorder/delete/redraw/extract) works identically on a detected box. DROPS a malformed/inverted box (`x2<=x1` or `y2<=y1`) rather than storing it broken — the server hands back exactly what it parsed, unfiltered (confirmed at `e2e-comic-detect.test.js`'s own scoping note), so filtering is deliberately the client's job, the only side that knows the image's real dimensions. REPLACES any existing boxes (a fresh detection is a fresh suggestion, not a merge) — a hand-drawn box the user wants kept must be re-drawn after detection, not before |
| new UI | `#comic-detect-row` (shown once an image is uploaded, alongside the draw area) → `#comic-detect-btn` + `#comic-detect-status` |
| new `ui.json` keys, `en` only | `form.comic_detect`, `form.comic_detect_failed` |
| the acceptance tests | `test/e2e-comic-detect.test.js` (real fresh-spawned server + fake Ollama): batch success in order, validation. `test/fake-ollama.js`'s own canned response deliberately MIXES the `<box>` tag and angle-bracket formats within one reply (matching the real mixed behavior this milestone's live check found), so the e2e test exercises BOTH parser branches, not just the idealized always-tagged case. `test/unit-comic-detect.test.js` (client side, 8 checks): POST body (full page, not a crop), both poll outcomes (real 2000ms wait), normalized-to-pixel conversion math, malformed-box dropping, replace-not-merge, and a clean failure (with a toast) on an empty result |
| **live-verified, twice** (real model, real production route, isolated `LESSONS_FILE` throughout) | first run against the real Page B fixture: 0 panels parsed — the angle-bracket gap above, found live, not in any prior probe. Fixed, mutation-tested, re-run against the SAME real fixture: all 6 panels, clean 2×3 grid, matching the original probe's own successful values almost exactly |

**`v85_p` — real-usage bug fixes, found by the user's own first live test of the whole comic feature**
(a genuinely different kind of finding than every prior comic-panel entry: not a probe, not this
session's own verification server, but the USER actually using their shipped feature on their own
real server and reporting back what broke)

| what | where |
|---|---|
| **ONE CHAPTER PER PANEL, not one per page** (redesigns milestone 3) | reversed after the user's own report ("the generated story, from 6 manually chosen panels, seems to have only one chapter instead of 6"). `comicCreateChapter()` now builds ONE `chunks` entry PER DRAWN PANEL (each with its OWN `comicPanels: [thatPanel]`, its own fresh crop), instead of joining all panels into one chunk. `_runBookJob`'s EXISTING sequential chunk-chaining (already used for a multi-chunk PDF split) links them into one storyline automatically — confirmed by reading it before relying on it, no new server-side chaining logic needed. A panel with no extracted text contributes NO chunk (filtered client-side, not sent as a broken chapter) |
| **`_comicPanelText(b)`** (replaces the removed `_comicBuildStoryText()`) | returns ONE panel's own caption+in-scene text — no more cross-panel joining |
| **the storyboard post-pass made OPT-IN everywhere** (`_runBookJob`, `server.js`) | had run UNCONDITIONALLY for every `/api/generate-book` caller since v68.1 (PDF uploads, comics, the wizard's own multi-chapter flow) — found via the user's report ("we don't want storyboards as a standard generation unless explicitly selected"), confirmed via code read to be pre-existing and universal, not comic-specific. This also explains a LATENT BUG in PLAN §13 milestone 4's own `#post-gen-storyboard-cb` toggle: it was captured client-side but never actually SENT in the initial request, so it had been a silent no-op for book-style generation the whole time (the unconditional server pass always beat it to the punch). Now gated on `base.postGenStoryboard`, threaded from `body.postGenStoryboard` |
| **new UI: `#comic-arc-row`/`#comic-arc-cb`/`#comic-arc-types`** | mirrors `#pdf-arc-row`'s EXACT existing pattern (the comic panel had NO lesson-type controls at all before — always the bare single vocab lesson) — reuses `renderArcTypeChecks`/`readArcTypeChecks`, the SAME shared tick-list PDF and the wizard both already use |
| **new UI: `#comic-storyboard-row`/`#comic-storyboard-cb`** | reuses the EXISTING `gen.post_gen_storyboard_lbl` ui.json key (no new string) |
| **new UI: `#pdf-storyboard-row`/`#pdf-storyboard-cb`** | the PDF panel had the SAME gap — no storyboard control at all, relying entirely on the (now-fixed) unconditional server pass. Also reuses `gen.post_gen_storyboard_lbl` |
| **`doGenerate()`'s multi-chapter branch** | `gbody.postGenStoryboard = postGen.storyboard` — one line, closing the latent no-op described above for the wizard's own flow |
| the acceptance tests | `test/e2e-postgen-storyboard-optin.test.js` (the core fix, both directions, mutation-tested — reverting the gate makes the "omitted" case go red). `test/unit-postgen-storyboard-optin.test.js` (client threading for `pdfGenerateAll()` and `doGenerate()`). `test/e2e-comic-chapter.test.js` and `test/unit-comic-chapter.test.js` REWRITTEN for one-chapter-per-panel (N chunks, N chained chapters, each with its own story/comicPanels, a textless panel filtered not broken). `test/e2e-book-formats.test.js`'s own storyboard assertion — a PRE-EXISTING test that encoded the OLD unconditional behaviour — was FLIPPED (not deleted) to match the new, correct, opt-in default; found by re-running the full suite after the fix, exactly the "downstream consumer assumed the old shape" rule this project's own standing discipline warns about |
| **not live-verified against the real model this cut** | these are mechanical/request-shape fixes (chunk count, field wiring, a boolean gate), thoroughly covered by e2e tests against a real server + real job/store pipeline (just a fake LLM backend) — a live check would mostly re-exercise MODEL RELIABILITY, which the user explicitly asked to defer to a separate round. The user is already testing this feature live on their own server; that is the live-verification path for this cut |

**`v85_t` — panel resize via corner handles** (user: "i can resize the selected comic panels now,
but…" — no, wait, that ask came LATER, at `v86_g`; this cut is what MADE that later request possible
at all, by adding resize in the first place. Milestone-1 UI only ever let a learner draw/delete/reorder
boxes, never adjust an EXISTING one's edges)

| what | where |
|---|---|
| **hit-testing** | `_COMIC_HANDLES = ['nw','ne','sw','se']`, `_comicHandleXY(b, handle, sx, sy)` (a corner's CANVAS-space coordinate for a given box), `_comicHitHandle(x, y)` (scans `APP_COMIC.boxes` LAST-drawn-first — so an overlapping later box's handle wins, matching what's visually on top — against a `_COMIC_HANDLE_HIT = 12`px tolerance) |
| **`_comicPointerStart`'s dispatch** | a handle hit sets `APP_COMIC.resizing = {i, handle}` and returns WITHOUT starting a new box draw — checked BEFORE the fallback "start drawing" branch, so grabbing a handle never also begins an overlapping new box |
| **`_comicPointerMove`'s resize branch** | moves ONLY the handle's own edge(s) (`nw`/`sw` move `x1`, `ne`/`se` move `x2`; `nw`/`ne` move `y1`, `sw`/`se` move `y2`), clamped against the OPPOSITE edge with an 8-canvas-px-converted-to-natural-px floor (`minGapX`/`minGapY`) so a fast drag can't invert the box or shrink it to zero mid-gesture — clamped LIVE, not corrected after the fact |
| **`APP_COMIC.resizing`** | mutually exclusive with `drawing` (and, from `v86_g` on, `moving` — see below); `_comicPointerEnd`/`_comicPointerCancel` both clear it |
| new draw affordance | `_comicRedraw()` now also draws an 8×8px filled+white-outlined square at each box's 4 corners, for EVERY box (not just a "selected" one — this UI has no such concept), so resize handles are discoverable without a prior click |
| the acceptance tests | `unit-comic-panel-ui.test.js` §7 (3 checks): grabbing a handle resizes correctly (2x-scale conversion, same shape as the drawing test), a drag away from any handle still draws a new box (resize must not swallow ordinary drawing), a handle dragged past the opposite corner clamps to the 8px floor rather than inverting |

**`v85_u` — canvas/image resize-sync fix, PLUS a genuine model-accuracy finding** (user-reported: "when
i zoom in/out on the page, the selected panel squares move relative to the image")

| what | where |
|---|---|
| **root cause** | `_comicSetupCanvas()` sized the canvas ONCE, at upload time, to `#comic-draw-img`'s then-current CSS size — any LATER resize (zoom, orientation change, responsive reflow) left the canvas's own `width`/`height` stale, so the SAME `sx`/`sy` conversion `_comicRedraw()`/hit-testing use drew/hit-tested against the WRONG scale |
| **`_comicWatchImageResize()`/`_comicUnwatchImageResize()`** | a `ResizeObserver` on `#comic-draw-img` that re-calls `_comicSetupCanvas()` on every real size change — watching a SECOND time disconnects the first observer first (does not stack); closing comic mode disconnects it (does not leak). Wired into `_comicFinishSetup()`, the SAME function every image-load path (upload, camera, and later `v86_f`'s rotate) already funnels through |
| **the SEPARATE model-accuracy finding this cut also made** | a live probe against the real fixture found the auto-detect model (`qwen2.5vl:7b`) has genuine, measured accuracy limits on panel geometry for a HARD (ambiguous/borderless) layout — a finding independent of this cut's own code fix, and one that resurfaced again at `v86_g`'s own item N (see below) |
| the acceptance tests | `unit-comic-panel-ui.test.js` §8 (4 checks): a ResizeObserver notification re-syncs the canvas (spy-based, since this harness doesn't model real resize events), watching twice disconnects the first observer, closing comic mode disconnects it, and a source check that the real image-load path actually wires up the watch (this harness's `FileReader` gap means `onComicFileChosen`'s own onload path can't be driven behaviourally — same limitation `v86_c`/`v86_f` below hit again) |

**`v86_c` — a `v85_u` REGRESSION found and fixed (duplicate canvas listeners), plus camera capture**
(user, after real testing: "panel recognition is really bad, this worked better before the fix, and
occured twice" — a manually-drawn 4-panel comic showing only 3 boxes, one spanning two panels' width)

| what | where |
|---|---|
| **the regression** | `_comicSetupCanvas()` called `addEventListener` for all 8 pointer/touch events on EVERY invocation, no matching removal — harmless before `v85_u` (ran once per image), but `v85_u`'s own `ResizeObserver` made it run REPEATEDLY per image, so a single real drag could fire `_comicPointerStart`/`Move`/`End` multiple times each, corrupting an in-progress box mid-gesture |
| **the fix** | split SIZING (idempotent, safe to re-run) from LISTENER WIRING, now guarded by a module-level `_comicListenersWired` flag — wires the canvas's pointer/touch listeners EXACTLY ONCE for the page's whole lifetime (`#comic-draw-canvas` is static markup, never recreated) |
| **camera capture** | `#comic-camera-input` (`<input type="file" accept="image/*" capture="environment">`) + `#comic-camera-btn`, routed through the SAME `onComicFileChosen()` as a regular upload — `capture="environment"` opens the device camera directly on mobile, harmlessly ignored (falls back to an ordinary picker) on desktop |
| **`_comicDownscaleDims(w, h, maxDim)`/`_COMIC_MAX_DIM = 1600`** | pure sizing math (split out for testability, no `Image`/canvas dependency) — ANY chosen image (camera OR file pick, both funnel through `onComicFileChosen`) is downscaled to at most 1600px on its long edge via an offscreen-canvas re-encode (JPEG, quality 0.88) before it ever becomes `APP_COMIC.dataUrl`. No 2D canvas support (or this harness's own DOM stub) falls back to the ORIGINAL, unresized image rather than losing the upload |
| new `ui.json` key, `en` only | `form.comic_camera` |
| the acceptance tests | `unit-comic-panel-ui.test.js` §9 (listener-stacking, via a counting spy on `addEventListener` — asserts EXACTLY 8 registrations across THREE `_comicSetupCanvas()` calls, not 24; mutation-tested to `actual: 24, expected: 8`, the exact predicted 3×8 multiplier), §10 (camera markup), §11 (`_comicDownscaleDims` math: both orientations, exactly-at-limit no-op, already-small no-op, zero-dimension guard) |

**`v86_d` — mobile-backgrounding fix for the extract/detect pollers, a silent-panel-drop UX fix, plus
item J** (user, mid-generation, on a phone: extraction finished server-side per the console log, but
"the generator interface seems to have lost that" — the client never applied a completed job)

| what | where |
|---|---|
| **root cause** | mobile browsers throttle/suspend `setInterval` on a backgrounded tab — `_startComicExtractJob`/`_startComicDetectJob`'s normal 2000ms poll could be delayed indefinitely or never fire again while the phone was locked, even though the server had already finished |
| **the fix — a re-invokable check function per poller** | `_comicExtractJobId`/`_comicExtractCheckOnce(jobId)` and `_comicDetectJobId`/`_comicDetectCheckOnce(jobId)` — each check re-validates its tracked job id BOTH before and after its own `await fetch(...)`, so a stale/superseded call (a later interval tick, a newer job, or — from `v86_e` on — an off-schedule visibility-triggered call) is a safe no-op, never re-applying an already-finished or already-superseded result. `_startComicExtractJob`/`_startComicDetectJob` are now thin: they set the tracked id and call the check function on the SAME 2000ms interval as before — the foregrounded case is unchanged |
| **the shared `visibilitychange` listener** | ONE listener for all comic pollers (extended to a THIRD, `_comicBookId`/`_comicBookCheckOnce`, at `v86_e` — see below): on the tab becoming visible again, calls each poller's own check function off-schedule, on top of (not instead of) its normal interval |
| **the silent-panel-drop UX fix** (found mid-session, same cut, from a SECOND live report: "the console actually said 4 panels where detected… 3 shown in the browser") | `_comicApplyDetectedPanels` was already correctly dropping a malformed/inverted box (`v85_o`) — but SILENTLY, unless every suggested box was dropped (only the fully-empty case toasted). Now toasts on ANY drop, naming the kept/suggested counts (`form.comic_detect_partial`) for a partial drop, and the previously-unguarded "every suggestion was malformed" case (0 survivors from a non-empty input) now fails cleanly with the existing "no panels found" toast instead of silently leaving `APP_COMIC.boxes` empty |
| **item J — `comicUseWholeImageAsPanel()`** | `#comic-single-panel-btn`, sets `APP_COMIC.boxes = [{x1:0,y1:0,x2:naturalW,y2:naturalH}]` — REPLACES existing boxes (matches auto-detect's own "fresh detection replaces" precedent), no-ops with no image loaded |
| new `ui.json` keys, `en` only | `form.comic_single_panel`, `form.comic_detect_partial` |
| the acceptance tests | `unit-comic-extraction.test.js`/`unit-comic-detect.test.js` §8 (mobile-backgrounding: job-id tracking, an off-schedule check applies a result correctly, a stale job id is a no-op never calling `fetch`, source check on the listener's own wiring); `unit-comic-detect.test.js` §7b/§7c (partial-drop toast, all-malformed-drop toast); `unit-comic-panel-ui.test.js` §12 (item J: full-image box, replace-not-append, no-op with no image) |

**`v86_e` — item K: the SAME mobile-backgrounding fix extended to `_pollComicBookJob`** (book/chapter
creation — the one poller `v86_d` explicitly left open, since it wasn't `setInterval`-shaped)

| what | where |
|---|---|
| **the shape difference** | `_pollComicBookJob` was a single `async function` running one `while(true){ …; await _sleep(2000); }` loop with a `try/finally` for cleanup — no standalone "check" step to re-invoke off-schedule without restructuring |
| **the refactor** | split into `_comicBookCheckOnce(bookId)` (one fetch-and-handle step, gated on the PRE-EXISTING `_comicBookId` — no new tracking variable needed) + `_comicBookFinish()` (the old `finally` block's cleanup, now called explicitly on any terminal branch). `_pollComicBookJob` is now a thin loop calling the check function each iteration, stopping once `_comicBookId` no longer matches |
| **preserved deliberately, NOT "fixed" into consistency** | a network failure mid-poll is NOT terminal here (unlike `_comicExtractCheckOnce`/`_comicDetectCheckOnce`, which DO toast+clear-state on a fetch failure) — book creation can run long, a flaky blip shouldn't abort the whole flow, matching the ORIGINAL pre-refactor behaviour exactly |
| the acceptance tests | `unit-comic-chapter.test.js` §3 (6 checks, the REAL functions for the first time — every prior test in this file mocked `_pollComicBookJob` itself): `'done'`/`'error'`/404-gone statuses, the network-hiccup-is-not-terminal case (fetch rejects once then succeeds — a real ~2s wait), the off-schedule/stale-id safety shape, and a source check that the shared listener now also calls `_comicBookCheckOnce(_comicBookId)` |

**`v86_f` — item I: rotate the uploaded/captured image** (user, testing camera capture: a photo can
come in sideways)

| what | where |
|---|---|
| **`comicRotateImage()`/`_comicRotatedDims(w, h)`** | fixed 90°-clockwise-per-click (`#comic-rotate-btn`, placed FIRST in `#comic-detect-row` — rotating is naturally a before-you-draw-panels step). Same offscreen-canvas-redraw shape as `onComicFileChosen`'s own downscale step (`canvas.translate(rw,0); canvas.rotate(Math.PI/2); ctx.drawImage(img,0,0,w,h)`, the standard 90°-CW-onto-a-swapped-dimension-canvas recipe), then routes through the SAME `img.onload -> _comicFinishSetup(img, status)` shape a fresh upload uses — so `APP_COMIC.naturalW`/`naturalH` are read straight from the newly-loaded ROTATED image (no hand-computed dimension math to drift out of sync), and panel-box invalidation comes for free from `_comicFinishSetup`'s own existing `comicClearPanels()` call — no new invalidation logic needed at all |
| **chosen over the coordinate-transform alternative** | any panel boxes already drawn are invalidated by a rotation (matches the pre-existing "a new image invalidates old boxes" precedent) rather than recomputed through the rotation transform — the SIMPLER of two options scoped at `v86_c`, since rotation is naturally a before-you-draw-panels step |
| **test-coverage note, worth remembering for ANY future canvas-drawing function** | this harness's DOM stub has NO 2D canvas context at all — normally a testability GAP (source-check-only, like `onComicFileChosen`'s own downscale branch), but here it means the function's OWN no-context FALLBACK branch is exactly what fires on every test run, so THAT branch is directly, behaviourally testable (does it throw? does it corrupt state before bailing?) — not a consolation prize, real coverage of what this harness actually exercises |
| the acceptance tests | `unit-comic-panel-ui.test.js` §12b/§13/§14: `_comicRotatedDims` swap math, a no-op with no image (spy confirms no canvas even created), the no-2D-context fallback (does not throw, leaves state untouched — mutation-tested), a source check that the real path reaches `_comicFinishSetup()`, markup/wiring |

**`v86_g` — item L: progress-card comic-panel text sync on a story edit, item M: drag-to-move a panel
box** (user reported both, plus item N below, in the same real-device-testing round)

| what | where |
|---|---|
| **item L's root cause** | `_comicStoryPanelsHtml` (the progress-card/question-panel renderer for any `comicPanels`-bearing chapter — see `v85_n` above) builds its text EXCLUSIVELY from `comicPanels[i].caption`/`inScene`, a SEPARATE copy of the text extracted once at upload time — never from `story` at all. `/api/save-story` (server.js) updates `story` but had never touched `comicPanels`, so a human-corrected story stayed stale on those two surfaces forever, confirmed against the user's real reported topic by reading its actual stored data (`lessons.json`, read-only) |
| **item L's fix** | `/api/save-story` now syncs `comicPanels[0].caption` to the full corrected story (clearing `inScene`) whenever `story` actually changes AND the chapter has EXACTLY ONE panel — the unambiguous case. A multi-panel chapter is deliberately left untouched (see `roadmap_v86.md`'s item O — no way to know which edited sentence belongs to which panel from one flat story string) |
| **item M — `_comicHitBox(x, y)`** | finds which box (if any) a pointer-down landed inside, same last-drawn-first scan convention as `_comicHitHandle`. Checked AFTER the handle hit-test in `_comicPointerStart` (a handle grab still wins at a box's own corner — unchanged ordering) but BEFORE the "start a new box" fallback. `APP_COMIC.moving = {i, startX, startY, orig}` tracks the drag; `_comicPointerMove`'s move branch translates the box by the delta (converted to natural pixels the same way resize already is), clamped at the image boundary as ONE offset so width/height are preserved EXACTLY (never distorted by clamping each edge independently against the wall) |
| the acceptance tests | new `test/e2e-save-story-comic-sync.test.js` (real server, isolated temp store, 4 cases: single-panel sync, multi-panel untouched, no-comicPanels no-crash, unchanged-story no-op — mutation-tested twice). `unit-comic-panel-ui.test.js` §12b (move, 5 checks: body-drag translates+preserves size, handle-priority still wins, boundary clamp preserves size exactly, a grab outside any box still draws new, `_comicPointerCancel` clears `moving` too — mutation-tested twice) |
| **item N (investigated, NOT a code change)** | a "3 shown, 4 detected" report was investigated by re-reading `_comicApplyDetectedPanels` in full — it has ZERO merging logic, so the leading explanation is a genuine model-accuracy limitation on a borderless/hard-to-segment layout (echoing `v85_u`'s own finding above), not a fresh bug. See `roadmap_v86.md`'s item N for the full write-up; flagged for a live-model probe if the user wants it pursued, not built |

**`v86_r` — the SECOND write path to `topic.story` never got `v86_g`'s comicPanels sync** (real
user bug, unrelated to item W below — `v86_g`'s own fix only covered ONE of two write paths)

| what | where |
|---|---|
| **the gap `v86_g` missed** | `POST /api/story-qc/accept` (server.js) — accepting a stored QC proposal, the path a real `ai_error_hunt` correction goes through — ALSO writes `t.story` directly, at a completely separate point in the code from `/api/save-story`. `v86_g` never checked for a second write path; this one shipped the exact same staleness bug for months until the user found it on their own real chapter |
| **the fix** | the SAME sync logic (`comicPanels[0].caption = story; delete comicPanels[0].inScene`, single-panel only) now also runs inside `/api/story-qc/accept`, right where it writes `t.story` |
| **the backfill** | `backfill-comic-panel-sync.js` (new CLI, dry-run by default, same convention as `backfill-createdby.js`/`backfill-script.js`) — scans every comic-sourced topic for a single-panel mismatch. Real corpus result: 8 comic-sourced chapters, 0 multi-panel, exactly 1 stale (the user's own reported one) — run with `--write` only after the user's explicit go-ahead, confirmed idempotent by a third dry run |
| the acceptance tests | `e2e-story-qc-accept-comic-sync.test.js` (3 checks) — mirrors `e2e-save-story-comic-sync.test.js`'s own structure, using the real reported strings as its fixture |

**PLAN §7.0 CP1/CP2, item W — "text explorer" mode: hover/click any word for its grammar** (`v86_o`
built the whole feature; `v86_p`/`q`/`s` are same-session follow-ups, all found via the user's own
live testing against a real running server)

| what | where |
|---|---|
| **the cache file** | `canonical-analysis.json` (repo root, env-overridable via `CANONICAL_ANALYSIS_FILE`) — UNLIKE `curriculum-plan.json` (a manually-produced, read-only CLI artifact server.js never writes), this one IS written by the server itself. Read fresh from disk on every request via `readAnalysisStore()`; written via `writeAnalysisChapter()`. Committed to git as of `v86_s`'s own follow-up commit, a deliberate choice (mirrors `canonical-text.json`'s own precedent) — expect it to accumulate real diff churn as more chapters get explored, similar to `learners.json` |
| **the background job** | `_runAnalysisJob(jobId, topic)` — CP1 (`buildCanonicalText`, instant) then CP2 (`analyzeChapter`, ONE model call PER SENTENCE, sequential — ~3+ min/sentence measured live on this container's CPU-only inference). Enriches each cached sentence with CP1's own raw `text`/`paraBreakBefore` so the client never needs a second CP1 pass |
| **the shared job-kickoff helper** | `_kickOffAnalysisJob(topic)` (defined INSIDE `boot()`, alongside `_runBookJob` — it needs `active`, which is `boot()`-local) — factored out at `v86_p` so `POST /api/analyze-chapter/:chapterId` and `_runBookJob`'s own `postGenAnalysis` opt-in share ONE lock (`analyzingChapters`, a `chapterId -> jobId` Map)/cache-hit implementation, not two independently-maintained copies |
| **the routes** | `GET /api/analysis/:chapterId` mirrors `cp5ShadowFor`'s own shape (absent → `available:false`) plus a `stale` field (re-hashes the chapter's LIVE story via CP1 on every read — a post-analysis story edit marks the cache stale without deleting it). `POST /api/analyze-chapter/:chapterId` — cache-hit short-circuits `200 {cached:true}`, else `202 {jobId}` polled via the existing `/api/job/:id` |
| **generation-time opt-in (`v86_p`)** | `postGenAnalysis` (mirrors `postGenStoryboard` verbatim) — THREE client call sites: `#pdf-analysis-cb`/`#comic-analysis-cb` (threaded into their own `/api/generate-book` body) and `#post-gen-analysis-cb` (`doGenerate()`'s generated-batch branch — found as a THIRD caller only while writing `v86_p`'s own tests). Server-side, `_runBookJob` calls `_kickOffAnalysisJob(saved)` once PER CHAPTER the instant it's persisted (NOT once per storyline like the storyboard post-pass — analysis has nothing to gain from waiting for the whole book) |
| **retroactive batch trigger (`v86_q`)** | `analyzeChaptersRun(chapterIds, btn)` — a 🔤 button (deliberately not 🔍, QC's own icon on the same row) on storyline header cards (`data-chain`, the SAME array export/delete already carry) and `savedItemHtml`'s per-chapter row. Takes a raw chapter-id ARRAY, not a `{storylineId}`/`{topicId}` scope object like `qcRun()` — CP1/CP2 has no server-side "resolve a storyline" endpoint, so the client loops itself, POSTing `/api/analyze-chapter/:id` per chapter, fire-and-forget (no blocking poll-to-completion the way `qcRun()` has) |
| **client view: rendering** | `_textExplorerBodyHtml(d)` → `_teStoryHtml(story, sentences)` (v86_s: reconstructs paragraph/line structure from the RAW story text via forward-only `indexOf` alignment per SENTENCE — NOT from CP1's own `paraBreakBefore` flag, which cannot distinguish a single line break between two sentences from a plain space) → `_teSentenceHtml(s)` (same alignment technique one level down, per TOKEN) → `_teTokenMarkHtml(tok, surface)` (the actual `<mark data-lemma/form/sense/conf>`). `_teEscText(t)` converts an embedded `\n` to `<br>` — the FIRST draft's own bug: a `\n` mid-sentence survives verbatim in CP1's `sentence.text` but was never converted, so the browser silently collapsed it to a space |
| **client view: comic panels** | `_comicPanelsFlatTextHtml(d, textHtml)` (`v86_q`, RENAMED + reworked at `v86_t` — was `_comicPanelImageStripHtml`) — takes the caller's ALREADY-BUILT text and wraps it in the SAME padded `.comic-story-panel-text` card markup the default view uses (single-panel: image+text share one card; multi-panel: each image its own card, plus one further text-only card), prepended in BOTH `_storyBodyHtml`'s `highlight:false` (translation) branch and `_textExplorerBodyHtml` — neither view has per-panel TEXT to pair an image with (translation is one flat string; CP2 has no panel-boundary awareness at all). `v86_t`'s own rename fixed a real bug: the original image-only strip left the caller's text as a bare unstyled sibling, so the SAME chapter's text started at a visibly different x-position in this view vs. the default one (user caught via two screenshots) |
| **client view: fetch orchestration + polling** | `toggleTextExplorer()` (forces `APP._compStoryLang='target'` on toggle-ON) → `_ensureTextExplorerData()` (GET the shadow; miss/stale → POST the kickoff) → `_startTextExplorerJob`/`_textExplorerCheckOnce` (same 2s-poll shape as the three comic pollers, hooked into their SAME shared `visibilitychange` listener — v86_o reused the `v86_d` mobile-backgrounding fix rather than reinventing it) |
| **client view: popover** | `_teShowWordPopover(ev, el)` — same `position:fixed`/click-to-dismiss shape as `openRetitleMenu`, re-derived (not shared — that one's a button list, this is a read-only info card) |
| **⚠️ a real self-mutation bug the tests caught, not a source read** | `_ensureTextExplorerData`'s FIRST draft created a fresh cache entry with `status:'loading'`, THEN checked "is status loading/analyzing/ready — if so bail", matching the entry it had JUST created on EVERY call, short-circuiting the very first invocation always. Fixed by checking a PRE-EXISTING entry (looked up before creating this call's own) — caught by `unit-text-explorer.test.js`'s own end-to-end fetch-stub test, not by inspection |
| **live-verification (`v86_o`)** | a separate, isolated server instance (own port, own scratch cache file — never the user's real running dev server) analysed `tp_17865786341910000220` ("Vittoria Ingannevole"), the SAME chapter `v83_n`→`v83_p` measured: ~13-14 min wall-clock for 4 sentences/26 tokens, zero apparent wrong lemma/form/sense, matching that earlier measurement, plus 4 well-formed multi-word phrases the earlier CLI-only run didn't separately call out |
| **NOT done / open** | the question panel's own story view (`_exStoryPanelHtml`) never got the 🔍 toggle — only the completion/progress card panel did. Item AG (CP2 enrichment — clitic-pronoun decomposition, an `explanation` field, comparing real `inflections` lesson data against CP2's coarser output) and items AH/AI (cost-reduction options; a teacher-editable curation UI) are recorded in `roadmap_v86.md`, none started. Job cancellation is cosmetic-only app-wide (`POST /api/jobs/cancel` flips a status flag; no job type, including `_runAnalysisJob`, checks it mid-loop) |
| the acceptance tests | `e2e-analysis.test.js` (7), `unit-text-explorer.test.js` (11, incl. the layout-fidelity fixes), `e2e-postgen-analysis-optin.test.js` (3), `unit-postgen-analysis-optin.test.js` (5), `unit-analyze-chapters-run.test.js` (5) |

**`v86_v` — an intermediate text-review card between comic extraction and lesson generation** (user-
requested: "we want an intermediate card... where the user can go through each panel and the
extracted text, to edit and confirm... Only THEN we move to lesson generation")

| what | where |
|---|---|
| **the opener** | `comicOpenReview(auto)` — filters `APP_COMIC.boxes` to panels with usable extracted text (`b.text` present, no `.error`; a panel never extracted or whose extraction errored is skipped, nothing to edit there), seeds a LOCAL edit buffer (`_comicReviewBuffer`, one entry per editable panel, keyed by BUFFER position) from each panel's own `caption`/`inScene`, and builds a modal overlay. `auto` (true when fired automatically right after extraction) suppresses the "nothing extracted yet" toast a MANUAL call (the retargeted "Create chapter" button) still shows |
| **why a local buffer, not live two-way binding** | Cancel must be a true no-op — the panel list has to keep showing exactly what extraction returned. Editing `APP_COMIC.boxes` directly while typing would make that unrecoverable once the user starts editing then backs out |
| **the step functions** | `_comicReviewEdit(k, field, value)` (writes into the buffer only), `_comicReviewConfirm()` (writes the buffer back onto `APP_COMIC.boxes` BY EACH PANEL'S OWN ORIGINAL INDEX — not buffer position, which diverges whenever a panel was filtered out — then calls the real, UNTOUCHED `comicCreateChapter()`), `_comicReviewCancel()`/`_comicReviewClose()` (removes the tracked overlay via object reference, `_comicReviewOverlayEl`, never a `getElementById` lookup — this node is never registered under any id, same as `showChoiceDialog`'s own dynamically-created overlays) |
| **why the gate sits ABOVE `comicCreateChapter()`, not inside it** | that function's own chunk-building/POST logic is already thoroughly tested directly (`unit-comic-chapter.test.js`) — this review step wraps it unchanged, so every one of those tests keeps testing the real submission logic with no UI in between |
| **⚠️ a real test-harness limitation, not a bug in the feature** | `test/lib-dom.js`'s `addEventListener` is a no-op BY DESIGN (it lets render code execute without throwing; it does not simulate real dispatch). A first draft wired the modal's interactivity through `addEventListener` closures — exactly `showChoiceDialog`'s own pattern — which would have made it untestable for behaviour, forcing a fallback to source-regex assertions. Rewired to the SAME onclick/oninput-ATTRIBUTE convention every other dynamically-rendered list in this file already uses (`comicDeletePanel`/`comicMovePanel`), so `_comicReviewEdit`/`_comicReviewConfirm`/`_comicReviewCancel` are plain, directly-callable, directly testable functions |
| **⚠️ a vacuous test caught mid-development** | verifying the automatic open-on-extraction wiring via a source regex, a first mutation (deleting the real `comicOpenReview(true)` call) left an explanatory COMMENT containing the same call text, which the regex couldn't distinguish from the real call — replaced with a behavioural test (stub `comicOpenReview`, call the real `_comicExtractCheckOnce()`), which the same mutation correctly fails |
| the acceptance tests | `unit-comic-review-card.test.js` (6 checks at `v86_v`, a 7th markup-level check added at `v86_x` below) |

**`v86_w` — comic-extract prompt: preserve visual structure via newlines; restore punctuation/case**
(user-reported, a real extracted Dutch road-sign chapter with no line structure at all)

| what | where |
|---|---|
| **the newline-structure instruction (VERIFIED live)** | `_comicExtractPrompt(langName, lang)` (server.js) now tells the model to insert a newline at a REAL visual structural break (a colour-block banner, a boxed/highlighted band, an unusually wide gap) even with no punctuation there — explicitly NOT for ordinary word-wrap. Live A/B on the actual reported photo (cropped to the sign's front face): the OLD prompt produced a garbled CAPTION/IN-SCENE split plus fabricated text not on the sign at all (a hallucination); the NEW prompt correctly kept it one IN-SCENE block, split into real lines, no hallucination |
| **the punctuation/capitalization addition (SHIPPED, UNCONFIRMED live)** | same prompt, a further paragraph mirroring the shape of the EXISTING capitalization-restoration instruction — bounded by "only where certain, never inventing words." Live-tested against the SAME photo: byte-identical output to the newline-only version — no measurable effect on this specific image (the model already treats the stylized all-caps banner as an intentional label). Kept anyway per the user's own explicit choice after being told plainly it wasn't confirmed |
| **a further refinement, NOT attempted** | distinguish a BLANK-LINE structural break from a single-newline same-block continuation — the model currently uses a single newline uniformly for every line-like separation it perceives, unlike the user's own manual correction (blank line between real blocks, one line joining two sentences within a block) |
| the acceptance tests | `e2e-comic-extract.test.js` (unchanged — matches on the fake model's OWN response-triggering conditions, not exact prompt text, so the prompt additions don't require new fixtures) |

**`v86_w` (same commit) — a "retranslate story" button — NOT comic-specific, works for any chapter**

| what | where |
|---|---|
| **why it exists** | user-requested: a manual `/api/save-story` fix (a typo, an extracted-text correction) does NOT re-translate `storyTranslation` on its own (a real LLM call, deliberately not triggered on every edit) — it could silently keep describing the pre-fix text indefinitely |
| **the route** | `POST /api/retranslate-story` (server.js) — mirrors `/api/storyline-retitle`'s shape (find-by-topic-name, one `callLLMTranslation` call via `sysTranslation(lang, srcLang)`, persist `storyTranslation`+`translationMeta`, return) |
| **the client** | `retranslateStory()` + a 🔄 `#story-retranslate-btn` next to the story's edit/QC icons in `buildPath()`'s own story-panel header row |
| **⚠️ a real gate bug found and fixed, not a style nit** | a first draft gated the button on `_canEdit() && APP.info?.canGenerate && d.story` — `unit-can-edit-teacher-mode.test.js`'s own sweep (§4, built specifically to catch a NEW call site re-widening `_canEdit()` with a capability term, whether via `\|\|` — the original `v79_j` bug — or `&&`, this one) correctly caught it. Fixed by DROPPING `_canEdit()` entirely, matching `#story-qc-btn`'s own precedent exactly (`canGenerate && d.story`, open to anyone — re-translating doesn't let anyone free-edit content, it re-runs one deterministic call and overwrites one derived field) |
| the acceptance tests | `e2e-retranslate-story.test.js` (4), `unit-retranslate-story.test.js` (4, incl. the visibility-gate truth table) |

**`v86_x` — the review card's own layout: near-fullscreen grid, not a narrow 520px single column**
(real-usage feedback: "the popover... could be bigger and should allow to view the text without
scrolling. it could be a whole page in the sequence of pages for storyline generation")

| what | where |
|---|---|
| **the design choice, asked not guessed** | bigger modal vs. a real wizard page (its own `#gen-card-N` step, needing new back-navigation wiring and state to return to panel-drawing) are genuinely different engineering costs — the user was asked, and chose the bigger modal |
| **the box** | `comicOpenReview()`'s modal box: `520px` fixed → `max-width:min(1200px,95vw);width:95vw;height:90vh` |
| **the layout — the change that actually buys back vertical space** | the body switched from a single-column flex list to a CSS GRID (`display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr))`), so panels flow into multiple columns on a wide screen instead of stacking one under another. Per-panel fields grew too (image `max-height:160px` vs. a fixed 72px, bigger caption font, `inScene` textarea 2→4 rows) — the OTHER half of "too small to read," not just the overall box |
| **visually verified, not just asserted** | desktop (1440×900): 3 columns, 6 panels nearly fitting two rows unscrolled. A 7-panel case scrolls the outer container gracefully (the deliberate safety net for a comic with more panels than fit). Mobile (375×812): collapses to one column; `document.documentElement.scrollWidth === clientWidth` confirmed — zero horizontal overflow at any size |
| the acceptance tests | `unit-comic-review-card.test.js` §1b — reads the ACTUAL markup `comicOpenReview()` built (off the tracked overlay's own `innerHTML`), not a source regex; mutation-tested by reverting the box sizing |

**`v86_y` — progress-card story-view controls: flags/explorer mutual exclusivity + retranslate parity**
(item W follow-ups, both from real usage of `v86_v`-`v86_x`'s own comic/translation work)

| what | where |
|---|---|
| flags/explorer mutual exclusivity | `_renderCompStory()` passes `null` (not `'target'`) as `_storyFlagButtonsHtml`'s `current` arg while `APP._textExplorer` is on, so NEITHER flag renders active; `toggleCompStoryLang(lang)` now ALSO sets `APP._textExplorer=false` first, so clicking a flag always exits explorer mode instead of leaving it silently active underneath |
| retranslate + language-flag parity, lesson-set ↔ storyline | `retranslateChain(chainId, btn)` (index.html) — the storyline "read full story" page's own new 🔄, loops `POST /api/retranslate-story` once per chapter via the SAME `data-chain` id array `analyzeChaptersRun` already reads, syncing both `APP.savedList` and the chain's own render cache, one failure isolated from the rest; server's `/api/retranslate-story` extended to accept `{topicId}` (not just `{topic}`) for this caller |
| the acceptance tests | `unit-text-explorer.test.js` §7, `unit-retranslate-chain.test.js` |

**`v86_z` — the static `docs/index.html` build gets item W's whole text explorer too** (user-requested:
"Can we build the text analysis explorer also into the static docs/index.html?")

| what | where |
|---|---|
| the bake | `build-static.js` reads `canonical-analysis.json` (env `CANONICAL_ANALYSIS_FILE`, mirrors `server.js`'s own `ANALYSIS_STORE_FILE`), transforms each cached chapter into the SAME shape `GET /api/analysis/:id` returns, bakes as `const STATIC_ANALYSIS` — a 7th fingerprinted `BUILD_SOURCES` entry. A missing file degrades to `{}`, not a crash |
| the client branch | `_ensureTextExplorerData()` gained `typeof STATIC_ANALYSIS !== 'undefined'` (the SAME convention `STATIC_LESSONS` already uses everywhere) — reads the snapshot directly, NEVER calls `fetch`; an absent chapter degrades to the existing clean `error` cache state, no retry possible statically |
| live-verified | a plain static HTTP server (no app server at all) serving the rebuilt `docs/index.html` — real per-word `<mark>` elements confirmed actually rendering from the baked data, not just asserted from source |
| the acceptance tests | `unit-static-analysis-bake.test.js` (spawns the REAL `build-static.js` CLI against isolated scratch files — a real bake AND a missing-file degrade), `unit-text-explorer.test.js` §8 |

**`v86_aa` — CP2's own `"form"` field now uses the SOURCE language's terminology, not hardcoded English**
(user report: a german→dutch lesson's per-word analysis came back in English)

| what | where |
|---|---|
| the bug | `buildAnalysisPrompt()` (canonical-analysis.js) explicitly instructed `"sense"`/the phrase `"gloss"` to be written IN `S`, but `"form"` (the grammatical-label field) had NO language instruction at all, PLUS a hardcoded ENGLISH worked example (`e.g. "verb, 3rd person singular past"`) — the model defaulted `"form"` to English regardless of the real source language, confirmed via the real cached chapter (every `"sense"` correctly German, every `"form"` English) |
| the fix | `"form"`'s own instruction now explicitly names `S`; the English-only literal example REMOVED rather than translated (a fixed literal in one language recreates the same bug for every OTHER source language) |
| the acceptance tests | `unit-canonical-analysis.test.js` (new block: `buildAnalysisPrompt(..., 'Dutch', 'German')`, mirroring the real report) |

**`v86_ab` — the SAME class of bug, this time in `PROMPTS.inflections`'s own `default` worked example**

| what | where |
|---|---|
| the bug | `PROMPTS.inflections.examples.default` (prompts.json) — the ONLY example used for a target language with no dedicated entry (only `default` and `de` exist) — demonstrated `formLabel`/`formChoices`/`explanation` in ENGLISH despite its OWN `translation` field being German, directly contradicting the schema's own "AS A SHORT PHRASE IN {S}" instruction |
| the fix | rewrote those 3 fields into German, matching the example's own `translation` field. `de`'s own example checked too and found NOT to have this defect (its `translation` is English, so English fields ARE consistent with its own implied `S`) |
| the acceptance tests | `unit-prompt-examples.test.js` §5 |

**`v86_ac` — the library-list row's own 🔤 button now doubles as "re-analyze," gated by a confirm warning**
(user: found no way to force a re-run once `v86_aa`'s CP2 prompt fix landed)

| what | where |
|---|---|
| server | `POST /api/analyze-chapter/:chapterId` accepts an optional `{force:true}` body — a new `deleteAnalysisChapter(chapterId)` (mirrors `writeAnalysisChapter`'s own read-modify-write shape) clears the cached CP2 result FIRST, so the route's EXISTING cache-hit short-circuit naturally re-runs it — no separate "force" branch needed past the delete step |
| client | `analyzeChaptersRun(chapterIds, btn)` — for a SINGLE-chapter call (`ids.length===1`, the library row's own usage) pre-checks `GET /api/analysis/:id` first; if already analysed, `confirm()`s before sending `{force:true}` — a decline makes NO server call at all, button restored, no toast. A multi-chapter BATCH call (the storyline page's "analyze all") is DELIBERATELY UNCHANGED — no pre-check, no confirm, silent skip-if-cached, since asking per-chapter in a loop would be intrusive |
| the acceptance tests | `unit-analyze-chapters-run.test.js` §6-9 (real DOM, all 4 combinations), `e2e-analysis.test.js` §7-8 (real server + fake-Ollama round trip) |

**`v86_ad` — the lesson-set card's OWN story display (`#story-section`) gains flags + a real text explorer**
(user, after THREE rounds of "which card do you mean" — the library row and the completion card were
both investigated and found NOT to be what was meant)

| what | where |
|---|---|
| the surface | `#story-section` ("📖 Read the story") inside the `#lesson-set` screen — teachers land there (`v60`'s own routing; learners skip the screen entirely), DISTINCT from both the library row (`v86_ac`) and the completion card (`_renderCompStory`, item W above). Its own `🔍` is `story-qc-btn` (QC proofreading), a completely unrelated feature |
| the fix, full parity (asked, not assumed) | `renderStoryText(d, targetEl)` ITSELF gained the flags/explorer logic — every one of its 6 real call sites always targets the SAME default `#story-body` (no caller ever supplies an explicit `targetEl`), so baking it into the one existing function keeps every caller automatically consistent, rather than adding a second wrapper only some would use. Reuses the SAME `_storyFlagButtonsHtml`/CP1-CP2 cache machinery (`_teCacheStore`/`_ensureTextExplorerData`/`_textExplorerBodyHtml`, already generic) under a SEPARATE `APP._lsStoryLang`/`APP._lsTextExplorer` state pair — NOT the completion card's own `APP._compStoryLang`/`APP._textExplorer`, since a teacher can have both cards open in different senses at once |
| new icon | `🔬` for the explorer toggle — `🔍` is QC on this SAME row, `🔎` is already the AI-hunt checkbox's own icon further down it |
| `toggleLsStoryLang`/`toggleLsTextExplorer` | mirror `toggleCompStoryLang`/`toggleTextExplorer` exactly, including `v86_y`'s own mutual-exclusivity fix, replicated here rather than re-derived |
| live-verified | a REAL Ollama backend (an isolated scratch server, its own `LESSONS_FILE`) — clicking `🔬` genuinely kicks off a real `POST /api/analyze-chapter` job (confirmed via the real cache entry's own `status`/`step` fields), not just a client-side flag flip |
| the acceptance tests | `unit-lesson-set-story-explorer.test.js` (5 sections, against the REAL DOM via `buildPath()`/`loadClient()`, not mocks) |

**`v86_ae` — `inflection_lemma`'s answer-reveal is now silent, not a mispronounced target-language word**
(user report, later self-corrected to a DIFFERENT real bug — see `v86_af`/item AJ below)

| what | where |
|---|---|
| the finding | `inflection_lemma`'s TTS answer-reveal ALREADY correctly resolves to the TARGET-language voice — that IS the designed, tested behaviour (`v82_d`'s own regression guard proved it). The real issue: a voice can CLAIM to match a requested language tag (passing `_ttsMakeUtterance`'s own filter honestly) without actually being a reliable, correctly-accented voice for it on a given device/browser — a real TTS-engine limitation this app's "refuse rather than approximate" policy (`v55_x`) cannot detect, since it only refuses when NO voice claims to match at all |
| the fix | `check()`'s `speakOk`/`speakBad` (index.html) now resolve to `''` for `ex.type==='inflection_lemma'` on BOTH the correct and wrong path — speaks NOTHING, still auto-advances (`_speakAndAdvance`'s own `!text` short-delay path needed no change). `inflection_form` completely UNCHANGED (its own SOURCE-language label, fixed at `v82_d`, already works and was not part of this report) |
| the acceptance tests | `unit-inflection-speak-lang.test.js` — §3/§4 REPLACE (not extend) the old `v82_d`-era regression guard that asserted the OPPOSITE; §5 confirms `inflection_form` stays untouched |

**`v86_af` — inflection wrong choices must be DIRECT RELATIVES of the correct answer's own dimension**
(the user's own refinement of a real "datief" report, immediately after `v86_ab` shipped)

| what | where |
|---|---|
| the rule | `PROMPTS.inflections`'s own `formChoices` instruction (prompts.json) — a wrong choice must stay on the SAME grammatical axis (or axes) `formLabel` already names; a SINGLE-dimension answer (e.g. `"plural"`) may only vary that ONE dimension (e.g. `"singular"`), never introduce an unrelated one (case, tense…) even if genuinely real for the language |
| both worked examples fixed to comply | `default`'s/`de`'s own `formChoices` shrank to EXACTLY the same single dimension as their own correct answer — the SAME "worked example contradicts its own instruction" bug class as `v86_aa`/`v86_ab` |
| ⚠️ CONFIRMED STILL BROKEN for combined-dimension answers (`roadmap_v86.md` item P) | a real post-`v86_af` live generation offered `"Infinitief"` (a mood/finiteness value) against a tense+person correct answer, in all 3 items — the single-dimension case IS fixed, the combined-dimension case is NOT, not yet re-attempted |
| the acceptance tests | `unit-prompt-examples.test.js` §6 |

**`v86_af`'s own follow-up investigation — item AJ (`roadmap_v86.md`), a real model-behaviour finding, NO code fix**: `PROMPTS.inflections`'s `{S}`-designated fields comply RELIABLY when `{S}` is English,
UNRELIABLY otherwise. Confirmed by direct comparison, not guessed: an it→en lesson complied
perfectly even with the OLD, pre-`v86_ab` prompt wording; a live-tested nl→de generation — even
WITH a much-strengthened reinforcement (an explicit "MUST be IN {S} — NEVER in {L}" per field plus a
closing checklist, tried and reverted after measuring zero effect) — still produced every `{S}`
field in Dutch except `translation`. Working hypothesis: English is this model's own DEFAULT meta-
commentary language, so the instruction only visibly "works" when it is redundant with that default,
not because it actively overrides context. **User's own ruling, ending the investigation without a
code change**: leave it — target-language grammar descriptions are pedagogically defensible on
their own terms. A "translate layer" (a SECOND, translation-framed LLM call for just the `{S}`
fields, mirroring the one field — `translation` itself — that DOES reliably switch language in
every case) is recorded as a scoped-but-unbuilt option, not designed further.

---

**The jobs popover (item U, `roadmap_v87.md`, `v87_b`/`v87_c`/`v87_d`)** — "a single place to see
everything in flight"; now covers running/scheduled jobs AND unfinished-project drafts (item R,
`v87_d`, below).

| what | where |
|---|---|
| the job store's own new metadata | `newJob(meta)` (server.js) — OPTIONAL `{label, link}`, defaulting to null so every pre-existing call site is unchanged. Only a job with a `label` is TOP-LEVEL/user-facing; a labelless one (the per-chapter `generate()` inside `_runBookJob`, still bare `newJob()`) is an internal sub-job, deliberately excluded from the aggregate — the book job itself (the separate `bookJobs` store, `newBookJob(titles, label)`) is the one entry that represents it |
| the aggregate route | `GET /api/jobs` (server.js) — merges `jobs` (labeled entries only) + `bookJobs` into one array, newest first. No owner/session concept (single-learner deployment, the standing rule) |
| `link` shape | `{type:'topic'\|'storyline'\|'tutor', id?}` or null — several kinds (a brand-new topic mid-generation, comic extraction/detection) have nothing to link to yet; `tutor` carries no `id` at all (see the synthetic-entry row below) |
| the client fab + popover | `#jobs-pill` (index.html, in `#bottom-bar`'s `#corner-pills`) + `#jobs-pop` (body-level, NOT inside `#jobs-fab` — see the stacking-context row below) — `refreshJobsPill()` (same availability gate as `refreshTutorAvailability`), `openJobsPop`/`closeJobsPop`/`toggleJobsPop` (same outside-click/Esc shape as `toggleModelPop`), `_jobsFetchAndRender`/`_jobsRenderList`/`_jobsEffectiveList` |
| polling cadence | `/api/jobs` polls every 3s ONLY while the popover is open (`_jobsPollIv`) — no standing interval; the badge count refreshes once per screen navigation, piggy-backing on `show()`'s existing call to `refreshTutorAvailability()` — PLUS instantly on every tutor busy-state transition (see below) |
| ⚠️ `refreshJobsPill()` is called from `init()` AFTER `loadUIStrings()`, unlike `refreshTutorAvailability()` (called BEFORE it) | found live: calling it earlier left the pill's `title` attribute showing the raw `t()` key (`"jobs.title"`) until the learner's first `show()` navigation, since a plain page load with no hash never calls `show()` on its own. `refreshTutorAvailability()` has this exact same latent gap, left alone as out of this item's scope |
| a live in-flight tutor question is a SYNTHETIC entry, not a real job (`v87_c`, user-requested follow-up) | `POST /api/tutor` is stateless (no job, no persisted id — see the tutor's own row above), so `_jobsEffectiveList()` prepends `{id:'__tutor__', kind:'tutor', link:{type:'tutor'}, ...}` sourced from `_tutorState.busy` whenever it's true, ahead of the real `/api/jobs` data — `_tutorSend()` calls the new no-fetch `_jobsUpdateBadgeAndList()` at BOTH busy transitions so the badge/list react instantly, not on the next poll/nav. `_jobsOpenLink`'s `tutor` branch calls `toggleTutorWidget()` (only if closed) instead of navigating |
| ⚠️⚠️ `#jobs-pop` lived INSIDE `#jobs-fab`/`#bottom-bar` at `v87_b` — a genuine stacking-context bug, found live (`v87_c`) | `#bottom-bar` (`position:fixed`+`z-index:900`) is ITSELF a stacking context, so no z-index on a descendant (however high) can ever out-rank a BODY-LEVEL sibling like `#tutor-widget` (`z-index:901`) — opening both together rendered the popover fully invisible behind the tutor widget, despite `.jobs-pop`'s own `z-index:902` reading numerically higher. Fixed by moving `#jobs-pop` to the body level, a sibling of `#tutor-widget` — the SAME fab/widget split that feature already uses (button stays in the bar, floating panel doesn't). `.jobs-pop`'s CSS also simplified to ONE unconditional `position:fixed` rule at every width, dropping `v87_b`'s own pill-relative-anchor + media-query-fallback pair — that two-mode anchoring is what caused `v87_b`'s OWN left-vs-right bug, so this removes a whole bug class, not just one instance |
| the acceptance tests | `test/e2e-jobs-list.test.js` (live server + fake Ollama, 3 checks) — labeled+linked QC/analysis jobs, a book job aggregates as ONE entry before and after completion, a source-level check (`_runBookJob`'s own `newJob()` call passes no meta) mirroring `e2e-recreate.test.js`'s own precedent. Mutation-tested (deleting the aggregate route's label filter turns the "every entry carries a label" assertion red). `test/unit-jobs-popover.test.js` (`lib-dom.js` harness, 7 checks, `v87_c`) — the synthetic-entry merge, a structural regression guard for the stacking fix (checked directly: `Element.contains()`/`.parentNode` are DEAD STUBS in this harness for the statically-parsed tree — `el.contains(el)` returns `false` — so the guard uses a source-position check instead, not assumed vacuous, mutation-tested), the CSS rule, the rendered tutor row, `_jobsOpenLink`'s open-only-if-closed behaviour. `_jobsPopOutside`'s inside/outside discrimination is explicitly NOT unit-tested (same dead-`.contains()` reason) — verified live in a real browser instead |

---

**Unfinished-project drafts (item R, `roadmap_v87.md`, `v87_d`/`v87_e`)** — persists parsing/setup
work BEFORE the learner clicks Generate, so a closed tab or lost connection doesn't lose it. Two
kinds, one store: `kind:'chunks'` (the PDF/paste-then-split flow's `_pdfChunks`, `v87_d`) and
`kind:'comic'` (the comic-image upload flow's `APP_COMIC`, `v87_e`). The "AI generates everything
from a topic" path has no pre-generation client-side parsing state to lose at all (confirmed by
reading `doGenerate()`'s multi-chapter branch: `gbody` is built straight from form fields, no
chunk-splitting step) and is correctly NOT covered by either kind.

| what | where |
|---|---|
| the store | `drafts.json` (server.js, `DRAFTS_FILE` env override for tests) — deliberately its OWN file, same reasoning as `SKILLS_FILE`: ephemeral pre-lesson-generation state, never read by `build-static.js`, must never collide with `lessons.json`'s own schema/migration/dedup logic. Gitignored (`.gitignore`), same category as `learners.json` — operational state, not curated content worth versioning, and may hold text (or an image) from a personal upload |
| the routes | `POST /api/drafts` (upsert by `id`; dispatches on `body.comic` being present — a `kind:'comic'` record carries `comic:{dataUrl,naturalW,naturalH,boxes}` and `chunks:null`, a `kind:'chunks'` record the reverse, the two shapes are mutually exclusive within one record) — bodies mirror `pdfGenerateAll()`'s or `comicCreateChapter()`'s own eventual `/api/generate-book` request almost exactly, so resuming needs no translation. `GET /api/drafts` (summaries only — no chunk text, no image data), `GET /api/drafts/:id` (full content, for resume), `DELETE /api/drafts/:id` (idempotent) |
| comic-specific validation | `comic.dataUrl` required + capped at 8MB (the client's own `_COMIC_MAX_DIM=1600` downscale keeps the real case well under this — generous headroom for a hostile/unexpected body, same "generous but real cap" shape as every other upload limit in server.js); `comic.boxes` required, capped at 100 (a page realistically has far fewer panels) |
| the autosave hooks | TWO, independent — `_draftSaveDebounced()` (index.html) at the tail of `_renderPdfChunks()` (15 call sites) for the chunks flow; `_comicDraftSaveDebounced()` at the top of `_comicRenderList()` (11 call sites — draw, delete, move, extraction landing, review-confirm) for the comic flow. Each guards to a no-op when there's nothing real to save, or once real generation has started (`_pdfBookId`/`_comicBookId` set — `bookJobs` owns durability from that point). 1.5s debounce, not per-keystroke, for both |
| discard | `discardDraft()`/`discardComicDraft()` — each acts on ITS OWN tab-local id (`_draftId`/`_comicDraftId`, kept SEPARATE, same precedent as `_pdfBookId`/`_comicBookId` already being independent); called by `_clearUpload()`/`onUseComicCb()`'s "off" branch (explicit "drop this") and by `pdfGenerateAll()`/`comicCreateChapter()` the instant real generation starts. `_jobsDiscardDraftById(id)` (the popover's own 🗑, kind-agnostic) — acts on an ARBITRARY id, since a listed draft may belong to a DIFFERENT tab/session; only clears whichever LOCAL id happens to match |
| resume | `resumeDraft(draftId)` (index.html) is now a DISPATCHER: fetches the record, and for `d.kind==='comic'` delegates to `_resumeComicDraftFrom(d)`, else runs the original chunks-populate logic inline. `_resumeComicDraftFrom(d)` deliberately does NOT route through `_comicFinishSetup()` (the fresh-upload path) — that function's first act is `comicClearPanels()`, which would discard the very boxes the draft exists to restore; it re-implements just the image-load + canvas-setup half, then restores `APP_COMIC.boxes` directly. Both resume paths land on the SAME wizard step (`gen-card-2`, "Text") either kind's own upload panel (`#pdf-panel`/`#comic-panel`) lives in |
| ⚠️⚠️ TWO real bugs found only by actually resuming a `chunks` draft live, not by reading the code (`v87_d`) | (1) the resumed chunk list rendered real content into a DOM node that was simply `display:none` — `#pdf-panel` needs its own `.open` class added, the same as every real upload path already does at the equivalent point; `resumeDraft()` was missing it entirely. (2) `_genWizardGoto(3)` looked right from the step's OWN LABEL ("3 · Chapters") but `#pdf-panel` actually lives inside `gen-card-2` ("2 · Text") — confirmed by searching the raw markup for its nearest enclosing `gen-card`, not assumed from the label. Both fixed; the resumed screen was re-screenshotted afterward. `v87_e`'s comic-resume path was built with this lesson already applied (checked `#comic-panel`'s own nesting FIRST) and needed no equivalent fix, confirmed live on the first try |
| integration with item U | `GET /api/jobs` (server.js) merges `loadDrafts()` in as `kind:'draft'`, `link:{type:'draft',id}`, `status:'draft'` (never `'running'`/`'pending'` — never inflates the badge's running-count). The label differs by the record's OWN `kind`: `Draft: "file.pdf" (N chapters)` vs. `Comic draft (N panels)`. `_jobsRenderList()` gives every draft row (either kind) the same 📝 icon and an EXTRA 🗑 discard button; `_jobsOpenLink`'s `draft` branch always calls the same `resumeDraft(id)` — the kind-dispatch happens inside that function, not in the popover |
| the acceptance tests | `test/e2e-drafts.test.js`/`test/unit-drafts.test.js` (chunks kind, `v87_d`, 11 checks total) — see that cut's own history for detail. `test/e2e-drafts-comic.test.js` (live server + fake Ollama, 4 checks, `v87_e`) — comic-specific validation, full round-trip including an un-extracted (`text:null`) box, the aggregate's distinct label, upsert, and a chunks+comic draft coexisting independently. `test/unit-drafts-comic.test.js` (`lib-dom.js` harness, 3 checks) — the comic autosave guard's own four branches (checked independently, not assumed to mirror the chunks flow's), `discardComicDraft()`'s fetch behaviour, and `resumeDraft()`'s dispatch onto `_resumeComicDraftFrom()` for a comic-kind record (mutation-tested: removing the dispatch turns that assertion red) — including a check that dispatching to the comic path leaves `_pdfChunks` completely untouched, the two kinds' local state never cross-contaminating |
| NOT covered | multiple images / one draft per page (item V, multi-image comic upload, is itself unbuilt — this follows the SAME single-image-at-a-time scope the live feature already has); no UI affordance to browse ALL drafts beyond what the popover already lists |

---

**Decoupling chaptering from lesson generation (item AK, `roadmap_v87.md`, `v87_f`)** — a wizard/
panel choice: create chapters with NO lessons at all, add them later via the pre-existing "add
lessons" tick-list. User-requested from a real screenshot of the comic panel-review card.

| what | where |
|---|---|
| the foundation, already existing | `generate()` (server.js) has saved a chapter's `story` to disk with `lessons: []` BEFORE generating any lesson since `v69_q` — a crash-recovery safety net, not a deliberate stopping point until this item. The "add lessons to an existing chapter" mechanism (`ADD_LESSON_TYPES`, the per-chapter dropdown, the storyline-wide tick-list) also already existed, unchanged — this item's ONLY new server behaviour is a way to stop BEFORE generating the first lesson |
| `skipLessons` | `generate()`'s `userOpts.skipLessons` — true, the ENTIRE "Lessons" section (both the special-format branch and the standard/`isAllTypes` branch) is skipped; the function returns right after the pre-existing early save. `/api/generate` and `/api/generate-book` both thread `body.skipLessons` through (`userOpts.skipLessons`/`base.skipLessons`); the book route makes it win over `arc`/`arcTypes` (a contradiction if a client sent both), and `_runBookJob`'s own arc-reinforcement + script-intro blocks gate on it too, defensively |
| the client checkbox | ONE shared markup/label pattern (`⏸️ No lessons yet — just create the chapters, add lessons later`, `ui.json`'s `form.skip_lessons_lbl`, reused verbatim across all three surfaces) — `#gen-skip-lessons-cb` (wizard card 3, `_applySkipLessonsUI()` hides the now-moot arc-row/per-chapter-row/format-select, layered on TOP of the pre-existing chapter-count gate those rows already had), `#pdf-skip-lessons-cb` (`#pdf-panel`, shares `#pdf-arc-row`'s own visibility gate inside `_renderPdfChunks()`), `#comic-skip-lessons-cb` (`#comic-panel`, same shape inside `_comicRenderList()` — this panel is the one the original screenshot showed) |
| the three send-paths | `doGenerate()`'s single-chapter body AND its `nCh>1` multi-chapter `gbody` (one shared `skipLessons` local, read once near the top of the function — also used to bypass a stale-`APP.lessonFormat==='error_hunt'` guard that would otherwise wrongly demand a story/continuation even when skipping lessons entirely), `pdfGenerateAll()`, `comicCreateChapter()` — each sends `skipLessons` and skips attaching the now-irrelevant `arc`/`arcTypes`/`lessonFormat`-specific fields |
| the button label swap | `#gen-btn` (`_applySkipLessonsUI()`), `#pdf-gen-lbl` (`_renderPdfChunks()`) — `Generate lessons →`/`Generate storyline` become `Create chapters →`/`Create chapters` (new `form.create_chapters`/`pdf.create_chapters_only` keys) when checked. `#comic-create-lbl` needed no change — already neutral ("Create chapter") |
| deliberately untouched | `comicOpenReview()`'s text-review step (already did the "let the user edit those" half of the original ask); the storyboard/text-explorer-analysis checkboxes on all three surfaces (they enrich the story/chapter, not lesson content) |
| explicitly deferred, not built | run-now-vs-schedule-with-smart-defaults — the user's own framing, future work; this item only needed "don't schedule lessons at all yet" |
| live-verified end to end against the real model | generated a real chapter with `skipLessons:true` (`qwen3.6:35b-a3b`), confirmed real story text + `lessons:[]` both in the job result and on disk, confirmed it renders cleanly in the lesson-set screen (no crash), then called the EXISTING, untouched `/api/lessons/add-lesson` against that SAME zero-lesson chapter — accepted, and the resulting real job left the chapter at exactly 1 lesson. The full loop the user asked for, proven live |
| the acceptance tests | `test/e2e-skip-lessons.test.js` (fake-ollama, 5 checks, mutation-tested) — all three server entry points, both WITH `skipLessons:true` (zero lessons, arc sent-but-ignored) and WITHOUT it (explicit regression guard: the normal path is unchanged) |
| ⚠️ three PRE-EXISTING tests broken by this item's own source-text edits, found and fixed | `unit-arc-reinforce-types.test.js`, `unit-my-story.test.js`, `unit-book-script.test.js` each pinned an EXACT substring of a line this item had to change (adding `!base.skipLessons &&`/`skipLessons` to an existing condition or destructure). Each re-anchored on the STABLE part of the same claim (e.g. "a `{...} = userOpts` block contains `fromLearned` somewhere," not "is the token right before the closing brace") rather than the exact original wording — the underlying claim was never wrong, only the anchor was too brittle to survive an unrelated nearby edit |

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
