# Claude Integration Task: Add `word_forms` Lesson Type

## Objective

Integrate a new lesson type called `word_forms` into the lesson generation system.

This lesson type is intended to eventually replace the existing `grammar` and `conjugation` lesson types with a more general, language-independent approach.

The core idea is:

> Words can change shape depending on context.

Instead of teaching grammar categories explicitly, learners practice selecting the correct form of a word within a sentence taken from the story.

---

# Educational Goals

The lesson should:

- Reinforce vocabulary already encountered in the story.
- Reinforce grammatical patterns implicitly.
- Work across many languages.
- Require minimal language-specific logic.
- Feel like revisiting the story rather than doing isolated grammar drills.

The learner should not need to know terms such as:

- conjugation
- declension
- participle
- past perfect

The lesson simply asks:

> Which word form fits here?

---

# Story-Based Design

The lesson generator MUST use sentences that already appear in the generated story.

Do NOT invent unrelated sentences.

Good:

Story sentence:

    Seven shook his head.

Exercise:

    Seven ___ his head.

Bad:

    Yesterday the king rode a horse.

if that sentence never appeared in the story.

---

# Generation Algorithm

Input:

- story text
- extracted story sentences
- source language
- target language
- learner level

For each exercise:

1. Select a sentence from the story.
2. Select exactly one word.
3. Prefer:
   - verbs
   - nouns with singular/plural forms
   - adjectives with common inflections
4. Replace that word with ___.
5. Generate 4 answer choices.
6. Exactly one answer must fit.
7. The original word from the story sentence must be the correct answer.
8. Distractors should be alternative forms from the same word family whenever possible.
9. Keep the remainder of the sentence unchanged.

---

# JSON Schema

{
  "type": "word_forms",
  "title": "Word Forms",
  "items": [
    {
      "sentence": "Seven ___ his head.",
      "translation": "Sieben schüttelte den Kopf.",
      "choices": [
        "shake",
        "shakes",
        "shook",
        "shaking"
      ],
      "correctIndex": 2
    }
  ]
}

---

# Required Fields

Each item must contain:

- sentence
- translation
- choices
- correctIndex

Requirements:

- exactly 4 choices
- exactly one correct answer
- correctIndex must be valid
- translation should be shown in the learner's source language
- sentence should remain recognizable from the story

---

# Validation Rules

Reject exercises if:

- the correct answer is missing from choices
- choices contain duplicates
- more than one choice fits naturally
- the sentence was not derived from the story
- correctIndex is out of range

---

# Relationship to Existing Lesson Types

Current lesson types:

- vocabulary
- grammar
- conjugation

New lesson type:

- word_forms

Goal:

- keep existing lesson types working
- add word_forms
- migrate grammar/conjugation generation to word_forms over time
- eventually deprecate grammar and conjugation

---

# Implementation Notes

Use the already extracted story sentences if available.

Do not require linguistic parsing trees or morphology graphs.

Keep the implementation lightweight enough to work reliably with smaller local models such as Qwen 2.5 7B.

Priority order for selected words:

1. verbs
2. nouns
3. adjectives
4. other inflectable words

The lesson should feel like a natural continuation of the story experience.
