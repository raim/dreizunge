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
| **the teacher-mode toggle, finally consolidated** | `v78_f`'s original reachability justification (three instances, because no single page reached every learner) is satisfied by the Settings Card itself now — reachable via `#settings-pill` on every screen including static. The full-width `#teacher-mode-bar` and the two compact footer icons (`teacher-ico-ls`/`teacher-ico-sl`) are ALL gone; `teacher-mode-btn` is the SINGLE remaining instance, moved into `#settings-modal`'s action row, unchanged internally (same `onclick="toggleTeacherMode()"`, same inline styling). `_TEACHER_TOGGLES` is down to one entry — kept as a list, not hard-coded, so a FUTURE second instance still has one place to register rather than reintroducing per-instance drift. Two now-unnecessary "force the bar visible" snippets removed (live `init()` and `build-static.js`'s init override) — `#settings-modal` carries no default hiding, so there was nothing left to force |
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
| **the persistent tutor** (`v62`, extended `v83_b`) | `_tutorScope()` derives WHERE the learner is asking from (`kind: 'lesson'\|'chapter'\|'storyline'\|'global'`); `_tutorGatherContext()` bundles `scope`, `lang` (target), `srcLang` ("I speak X" — drives `tutorRetrieveContext`'s content-pairing filter and the ledger lookup, server.js), `uiLang` (since `v83_b` — the REPLY language, `APP.uiLang \|\| srcLang`, a genuinely separate job from `srcLang` even though both used to be the same field), `story`, `wrongWords`/`knownWords`, `completed` (the spoiler whitelist). `_tutorSend(opening)` posts it plus the running `history` to `POST /api/tutor` (stateless; `callLLMTutor`/`callLLMTutorStream`, own model role `OLLAMA_TUTOR_MODEL`); the server computes `S = langName(uiLang)`, `L = langName(lang)` and fills `PROMPTS.tutor.system`. A pre-filled STUDENT turn (not `opening:true`) is the shape both `askTutorAboutQuestion()` (per-question 🦉 hint) and `_storySelExplain(mode)` (`PLAN §12` below) use — push `{role:'student', text:...}` onto `_tutorState.history`, `_tutorSaveThread()`, `_tutorSend(false)` |
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
