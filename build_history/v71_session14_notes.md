# v71_o — session 14 notes

Comprehension follow-ups, the typed-diff threshold, and the JSON-parsing bug that turned out to
affect five generators, not one. New `lessons.json` merged (294 topics, 82 storylines, **3 real
comprehension lessons**).

Suite **152**, `check-inline` 0 on both builds.

---

## 1. Comprehension generation failure — fixed, and it was not only comprehension

Reported: three attempts, all `JSON extract failed`; then, with thinking on,
`Ollama returned empty response`. Two separate causes.

**(a) The parse never stripped `<think>`.** The generator hand-rolled its own JSON extraction —
strip ``` fences, then match the first `{` to the last `}`. On a reasoning model the first `{` is
usually *inside the model's own reasoning*, so valid output failed to parse every time. `llm.js`
has exported `stripRaw`/`extractJSON`/`salvageArray` all along, and they strip `<think>` first;
that is why they exist. Now parsed through them, with a salvage path for a bare questions array.

> **The same hand-rolled block existed in four other generators** — grammar, word_forms, synonyms
> and conjugation. All four would fail identically on a reasoning model. Fixed in the same pass;
> `const m = cleaned.match(...)` no longer appears anywhere in `server.js`.

**(b) The empty response.** A long chapter plus a reasoning model spent the entire budget on
reading and thinking, leaving nothing for the answer. The story fed to the prompt is now bounded
(6,000 chars) and the base token budget raised 2,200 → 3,200 (`callLLMLesson` multiplies this when
lessons-reasoning is on).

Also normalised the key names models actually use: `choices` / `options` / `answers` for the option
list, `q` / `question` / `prompt` for the question.

## 2. Quiz language → the learner's language

`"Every question and every option is written in {L}"` → `{S}`, plus the JSON template, which still
asked for `<{L}>` question and option strings. The quiz tests whether the **story** was understood;
asking in the target language made the question wording a second test.

Worth noting: the three lessons already in the corpus came out in German anyway — the model was
doing the sensible thing despite the instruction. The prompt now says what we want.

## 3. Full story context up to the current chapter

`collectChainStory(saved, maxChars)` walks the same `continuedFromId` chain as `collectChainVocab`
(same name fallback for un-migrated entries) and assembles earlier chapters oldest-first, then the
current one.

**Budgeted from the OLDEST end.** The current chapter is always kept whole and what remains is spent
on predecessors, newest first. Trimming from the other end would silently cut off the chapter the
questions are actually about and leave the model asking about chapters the learner read days ago.
The generator's own 6,000-char cap is therefore skipped when a chain was supplied — it would undo
exactly that.

## 4. The "why" is shown, and read aloud

The generator already wrote a one-sentence reason naming the part of the story that settles the
answer, and it was being thrown away. On a wrong comprehension answer the reveal now shows the
**reason** instead of restating the correct option — which taught nothing, since the option is
already highlighted on screen.

Read aloud through a new `speakLang(text, langCode)`: the reason is in the learner's language, and
reading a German sentence with an Italian voice is worse than not reading it at all. Falls back to
the plain correct answer when the model omitted a reason.

*Not done:* the reason is shown only on a WRONG answer, since that is the reveal the request named.
Showing it on a correct answer too would be a one-line change if wanted.

## 5. Typed answers: whole-word view past three wrong characters

Below the threshold the per-letter diff is the useful view — it shows a missed umlaut at a glance.
Past it the two rows become a scatter of red boxes harder to read than the answer itself, so the
display switches to the wrong word struck through beside the correct one. Counted in **edit
operations**, so a substitution is one wrong letter and not two. Threshold is a named constant,
`TYPED_DIFF_MAX_WRONG = 3`.

## 6. Error-hunt-on-the-result-card: dropped

Per instruction, error hunt stays a normal lesson. Removed from the queue; the result-card arc is
now complete.

---

## How to see it work

1. Add a comprehension lesson to a chapter deep in a storyline — the log should read
   `Story context: N chapters, M chars`. Questions should reference events from earlier chapters.
2. Questions, options and reasons should all be in **your** language; the story stays in the target.
3. Answer one wrong: the reveal is the *reason*, spoken in your language, not the option text.
4. Type a badly wrong answer in a listen-type lesson: struck-through word + correct word, no
   per-letter boxes. Type a near-miss: per-letter boxes as before.
5. Try a grammar / synonyms / word_forms / conjugation lesson **with thinking on** — these were
   silently broken the same way comprehension was.

## Still owed

- Browser passes on `v71_i` … `v71_o`.
- Translate pass: `v71_l`'s four en keys. This release adds none.
- **Two items from this batch are NOT done** (they arrived in the same message and are queued):
  tutor default → thinking mode ON, and a cores/threads setting in the model menu.
- Drill traceability decision (`v71_n` notes).
- Queue: error-hunt word alignment → book generation (3) → tutor (4) → cosmetics (6).

## Tests

`unit-comprehension` §8–9: parsing survives six real output shapes (including reasoning text with
braces before the JSON — the reported failure); the story cap and budget; key-name tolerance; the
`{S}` prompt change with the old `{L}` instruction asserted GONE; the chain walker and its
oldest-end trimming; the reason reveal and its language-targeted read-out.

`unit-typed-diff` §11: near-misses stay per-letter (including a missed umlaut), the boundary at
exactly three is still per-letter, mangled words switch to whole-word, and the whole-word branch
escapes what was typed — it is a separate branch from the letter renderer, so escaping is asserted
separately.

Revert-verified: disabling the threshold fails; reverting the prompt to `{L}` fails; dropping the
chain preference fails.
