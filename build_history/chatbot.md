# Feature Specification: Persistent Local AI Tutor

## Overview

Implement a persistent AI tutor that accompanies the learner throughout the app. Unlike general-purpose chatbots, this tutor should understand:

- the learner's progress
- completed stories
- learned vocabulary
- mastered concepts
- current lesson
- preferred language
- installed dialect packs

The tutor should primarily run on a local LLM (Ollama), e.g. Qwen 3.5.

The goal is not to replace the lesson generator, but to provide an always-available learning companion.

---

# Design Philosophy

The tutor is **not** a general chatbot.

Instead, it acts as an experienced guide that knows where the learner currently is in the curriculum and avoids spoilers or concepts that have not yet been introduced.

It should encourage discovery instead of immediately providing answers.

---

# Responsibilities

The tutor should be able to

- answer questions about the current story
- explain vocabulary
- explain grammar using already learned concepts
- discuss story understanding
- ask comprehension questions
- role-play conversations
- provide hints instead of solutions
- explain mathematics and science using concepts the learner already knows
- explain local dialect expressions
- connect concepts across stories

---

# Local LLM

The tutor should use a locally running LLM via Ollama.

Examples:

- Qwen 3.5
- future local models

No cloud model should be required for normal tutoring.

---

# Learner State

Maintain a structured learner profile.

Example:

```yaml
learner:
  source_language: German
  target_language: English

stories_completed:
  - little_i_01
  - greetings_02

concepts_mastered:
  - counting
  - greetings
  - zero

vocabulary:
  - hello
  - rabbit
  - meadow

current_story:
  little_i

current_chapter:
  6

current_lesson:
  word_forms

dialect_packs:
  - pfalz

interests:
  - mathematics
  - biology
```

The tutor receives this information before every response.

---

# Retrieval-Augmented Generation

Do **not** place all stories into the prompt.

Instead retrieve only relevant information.

Potential retrieval sources:

- story summaries
- current chapter
- character descriptions
- concept definitions
- vocabulary database
- previous lessons
- dialect dictionaries
- learner mistakes

Only the relevant fragments should be included in the prompt.

---

# Tutor Prompt

The tutor prompt should contain information such as

- source language
- target language
- learner level
- current story
- mastered concepts
- concepts not yet introduced
- known vocabulary
- preferred explanation language

Example instruction:

> Never introduce concepts that have not yet been unlocked.
> Explain new ideas using only previously mastered concepts whenever possible.

---

# Story Awareness

The tutor should know

- where the learner currently is
- which characters have already appeared
- which events have happened

It should avoid spoilers.

Example:

Learner:

> Why is little i lonely?

Tutor:

> What have you discovered about little i so far?

instead of immediately explaining complex numbers.

---

# Concept Awareness

Lessons unlock concepts.

The tutor should retrieve concept metadata.

Example:

```yaml
concept:
  negative_numbers

prerequisites:
  subtraction

next:
  complex_numbers
```

The tutor can therefore answer relative to learner progress.

---

# Vocabulary Awareness

The tutor should know which vocabulary has already been introduced.

When possible

- explain difficult words using easier known words
- gradually reduce use of the source language
- adapt explanations to learner level

---

# Dialect Packs

Support installable dialect packs.

Examples

- Palatinate German
- Swiss German
- Viennese
- Company-specific terminology

A dialect pack may contain

- vocabulary
- pronunciation
- idioms
- humor
- cultural notes
- example conversations

The tutor should automatically use installed packs when appropriate.

---

# Character Mode

The tutor may optionally appear as a recurring story character.

Examples

- wise owl
- librarian
- storyteller
- guide

This makes tutoring feel like part of the story rather than an external help system.

---

# Future Extensions

The tutor should later support

- discussing mathematics
- discussing biology
- historical discovery paths
- Socratic questioning
- teacher dashboards
- classroom mode
- learner-generated stories

without changing the overall architecture.

---

# Architecture

Separate two AI systems.

## Author AI

Large cloud model.

Responsibilities:

- generate stories
- generate lessons
- create illustrations
- create concept graphs
- create dialect packs

Runs offline or occasionally.

---

## Tutor AI

Local Ollama model.

Responsibilities:

- dialogue
- explanations
- questions
- hints
- discussion
- role-playing

Runs continuously.

---

# Implementation Goal

The tutor should become the central conversational interface of the app.

Stories and lessons remain structured learning activities, while the tutor provides contextual guidance, personalized explanations, and interactive discussion throughout the learner's journey.
