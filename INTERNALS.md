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

Last verified against **`v76_j`**.

---

## 1. Tuning knobs

| Constant | Where | Value | What it buys |
|---|---|---|---|
| `NUM_CTX_MAX` | `llm.js` | 16384 (env `OLLAMA_NUM_CTX_MAX`) | Context-window ceiling. See §1.1 |
| `OLLAMA_TIMEOUT` | `llm.js` | 720000 (12 min; env `OLLAMA_TIMEOUT`) | Base request timeout, clamped 30 s–60 min |
| `CHAIN_STORY_CHARS` | `server.js` | 40000 | Chain-story budget for comprehension |
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
today only `generateComprehension` does. Every other call keeps Ollama's default and its existing
memory profile.

**Unverified caveat.** Ollama keys its loaded model instance partly on load-time options, and
`num_ctx` is one of them — so alternating between large-context and default calls *may* force a
reload. Not measured (no live Ollama in the dev container). If comprehension generation is slow to
*start* while other types are fine, suspect this first.

---

## 2. Silent failure modes

The dangerous class: things that produce a plausible result while doing the wrong thing. Nothing
throws, no test necessarily fails, and the output looks fine.

**Ollama truncates an over-long prompt with no error.** Default `num_ctx` is ~4096. Exceed it and
the request still succeeds — the model just answers from whatever fragment survived. This is why
`v71_t` had to add context sizing *before* removing the story caps: deleting the app-side cap alone
would have moved trimming from our code (which keeps the current chapter whole) into Ollama's
(which cuts blindly and reports nothing). **Any change that makes a prompt bigger must size the
context window in the same commit.**

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

---

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
