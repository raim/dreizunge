# Prompt examples audit — what we currently show the model

Groundwork for todos #3/#4 (example injection from rated questions). This catalogs
**every example currently baked into `prompts.json`**, how it is described to the model,
and the seams where dynamic, rated-question examples would attach. No code changes — this
is a map of the current state.

## How a prompt is assembled (server side)

- `prompts.json` is hot-reloaded into `PROMPTS`. Each lesson type has a key (e.g.
  `wordForms`, `synonyms`, `vocab`) with a `system` string plus optional fragments
  (`user`, `dialectNote`, `writingStyleNote`, `storyHint`, `priorHint`, `chainHint`, …).
- `fillPrompt(template, vars)` replaces `{token}` placeholders; **unknown tokens are left
  intact**. Common tokens: `{L}` (target language name), `{S}` (source/learner language),
  `{diff}` / `{lessonDiff}` (difficulty), `{story}`, `{topic}`, `{n}` / `{nExercises}`,
  `{sentLen}`.
- A builder concatenates the filled `system` with **conditionally appended** notes/hints.
  Example (synonyms, server ~1300): `system` + (`storyHint` if story keywords) +
  (`priorHint` if reinforce words). **This append pattern is exactly the seam an
  `{EXAMPLE}` / `exampleNote` slot would use** — see "Injection seam" at the end.

**Key fact for #3/#4:** every example below is **static** — hardcoded in the `system`
string, in a **single fixed language pair**, with **no variation by target language,
lesson type difficulty, or topic**. The placeholders `{L}`/`{S}` describe the *task*
languages, but the example's own content stays in whatever pair the author wrote.

---

## Examples currently in each prompt

### wordForms (`wordForms.system`) — the richest example set
Biggest prompt (~4.2k chars). Teaches one fill-in-the-blank-with-the-right-form MCQ per
story sentence. Contains a **schema block** plus **three worked examples** described in
prose:

- **GOOD example** — labeled `GOOD example ({L}=English, {S}=German)`. Gives a story
  sentence ("The cats were sleeping on the warm roof."), the resulting item JSON
  (`sentence` with `___`, `translation` in {S}, `choices` `["cat","cats"]`,
  `correctIndex`, short `explanation`), then a one-line rationale: only "cats" fits
  "were"; two real forms is enough, don't pad.
- **BAD example #1** — labeled `BAD — never do this`. A `shook/shakes/shook/shaking`
  item where the blank is **ambiguous** (both past and present read correctly), with the
  rationale that an ambiguous blank must be avoided; also warns against misspellings and
  {S}-language fillers.
- **BAD example #2** — `BAD translation — never do this`. Shows the wrong move of putting
  the {L} sentence in the `translation` field instead of a real {S} translation.

Described as: explicit `GOOD`/`BAD` labels, each followed by a JSON snippet and a prose
"why". Fixed pair: **English←German**. Multiple `e.g.` demos also appear inline in the
RULES (tense-mismatch wrong-choice strategy, etc.).

### synonyms (`synonyms.system`)
One **schema block** + one **`Example ({L}=German, {S}=English)`**: the `base:"klein"`
word object with `synonyms` (`winzig`, `gering`), one `antonym` (`groß`), empty
`homophones`. Described as a single positive format demo; no BAD example. Fixed pair:
**German←English**. Rules emphasize {L}/{S} field discipline and "never invent
homophones".

### vocab (`vocab.system`)
**Two** positive format examples, each a pair of `{target,source}` objects:
- `Example (German lesson, Italian speaker)`: `laufen→correre`, `der Hund→il cane`.
- `Example (Italian lesson, English speaker)`: `correre→to run`, `il cane→the dog`.
Purpose: demonstrate the target/source direction across two different pairs. No sentences
example (only vocab rows shown). Fixed pairs: **German←Italian** and **Italian←English**.

### vocabFromText (`vocabFromText.system`)
One example (count 1) in the same style as `vocab` — vocab extracted from a provided text;
same target/source row format demo. (Variant of vocab for the PDF/book-import path.)

### grammar (`grammar.system`)
One **`Example (German ← French)`**: a single noun row
`{target:"Baum",source:"arbre",gender:"m",article:"der",plural:"Bäume"}`. The only inline
`e.g.` is a clarification, not a format demo ("If {L} has no grammatical gender (e.g.
English), set gender and article to null"). Fixed pair: **German←French**. Heavy CRITICAL
rules on field-language discipline.

### conjugation (`conjugation.system`)
**No labeled "Example" block**, but the RULES carry **inline `e.g.` paradigm demos**
embedded in prose: English `I/you/we/they → "watch"` and `he/she/it → "watches"`; German
`er/sie/es` shares a row while `ich/du/wir/ihr` stay separate (the `geht` case). These act
as examples-by-instruction rather than a JSON snippet. Pairs shown: **English** and
**German** paradigms.

### math (`math.system`)
**No "Example" label**, but each of the three exercise types is introduced with a **sample
JSON object** acting as a format example: `math_calc` (`7+8`), `math_order`
(`asc [8,3,13,5]`), `math_latex` (`F_7` Fibonacci). These are language-neutral (numbers),
so no {L}/{S} pair is baked in.

### Types with NO examples
`errorHunt`, `translation`, `meta`/`metaTranslation`, `story` (+ its dialect/furigana/
continuation notes), `storylineTitle`, `storylineSummary`, `chapterTitles`, `srcRepair`,
`vocabTable`, `storyStyles`. These rely on schema + rules only.

---

## Summary table

| Prompt | # examples | Form | Fixed language pair | GOOD/BAD? |
|---|---|---|---|---|
| wordForms | 3 | JSON snippet + prose rationale | English←German | 1 GOOD, 2 BAD |
| synonyms | 1 | JSON snippet | German←English | positive only |
| vocab | 2 | `{target,source}` rows | German←Italian, Italian←English | positive only |
| vocabFromText | 1 | `{target,source}` rows | (same style as vocab) | positive only |
| grammar | 1 | JSON noun row | German←French | positive only |
| conjugation | 0 labeled | inline `e.g.` paradigm prose | English, German | instruction-only |
| math | 0 labeled | sample JSON per type | language-neutral | format-only |
| (others) | 0 | — | — | — |

---

## Observations relevant to #3/#4

1. **Examples are static and mono-pair.** The "difficult" types #3/#4 targets — wordForms,
   synonyms (and arguably grammar/conjugation) — each show their example in ONE author-
   chosen language pair (English←German, German←English, German←French). A learner of, say,
   Italian←English never sees an Italian example. This is exactly the gap #3/#4 wants to
   close with per-target-language examples.
2. **No difficulty/topic variation.** The example never changes with `{diff}`,
   `{lessonDiff}`, or `{topic}`. #4's "order by target language, difficulty, other props,
   and closest examples" has no current analogue.
3. **GOOD/BAD framing already exists** (wordForms). Rated questions (⭐) map naturally to
   "GOOD"; flagged questions (⚑) could map to "BAD" — the prompt vocabulary is already
   there to receive both.
4. **Injection seam is well-established.** Builders already append optional fragments
   (`storyHint`, `priorHint`, `chainHint`) after the `system` string via `fillPrompt`.
   A dynamic example block would be the same shape: a new optional `exampleNote` template
   in `prompts.json` (with an `{EXAMPLE}` / `{examples}` token), filled by the builder from
   selected rated items and appended only when examples exist — otherwise emit the warning
   #6 calls for. The static GOOD/BAD blocks in `system` can stay as fallbacks.
5. **Format is consistent and machine-buildable.** Every example is a compact JSON
   snippet matching the type's schema, optionally followed by a one-line rationale. Rated
   real items already have that exact shape (a vocab row, a word_forms `items[]` entry, a
   synonyms `words[]` entry), so converting a rated question into an example string is a
   direct serialization — no reformatting needed.

### Open design questions these surface (for the #3/#4 session)
- Which token/fragment name and where per type (one shared `exampleNote`, or per-type)?
- How many examples to inject, and do we include a rationale line (and from where — the
  flag comment for BAD, nothing for GOOD)?
- Selection/ordering: exact target-language match required; difficulty + type as soft
  sort keys; how to define "closest"; fallback + the #6 "no good examples" warning.
- Source pool: any ⭐-rated item store-wide, vs. only items in "manually curated" tagged
  stories (#4).
