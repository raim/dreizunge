# Bayesian Knowledge Tracing for Language Learning in Dreizunge

Dreizunge can use **Bayesian Knowledge Tracing (BKT)** as a persistent learner model. The architecture should be **domain-independent in principle**: the same mechanism could later track mathematical, scientific, or other learning objectives. For the current implementation, however, we restrict the model to **language learning**.

The central principle is:

> **BKT tracks what the learner knows; stories and lessons provide the contexts in which that knowledge is acquired and tested.**

---

## 1. The fundamental unit: a language-learning skill

Do **not** make a chapter or lesson a BKT unit.

Instead, define relatively granular **knowledge components (KCs)** or language-learning skills.

Examples:

```json
{
  "skillId": "de:vocab:gehen",
  "language": "de",
  "type": "vocabulary",
  "description": "Understand and use 'gehen'"
}
```

```json
{
  "skillId": "de:wordform:gehen:present:1sg",
  "language": "de",
  "type": "word_form",
  "description": "Use 'gehen' correctly in first-person singular present"
}
```

```json
{
  "skillId": "de:grammar:article:accusative",
  "language": "de",
  "type": "grammar",
  "description": "Select the correct article in the accusative"
}
```

Possible skill types include:

* vocabulary
* word forms
* conjugation
* grammar
* sentence patterns
* reading comprehension
* listening comprehension
* spelling
* script/character recognition
* pronunciation
* translation
* idiomatic expressions

Initially, skills should be **reasonably granular but not excessively fine-grained**.

---

# 2. BKT state

For every learner and skill, store a probability of mastery:

```json
{
  "skillId": "de:wordform:gehen:present:1sg",
  "pMastery": 0.73
}
```

Standard BKT represents the learner's knowledge state with:

```text
P(L) = probability that the learner has mastered the skill
P(T) = probability of learning after an opportunity
P(S) = probability of slipping despite knowing
P(G) = probability of guessing correctly despite not knowing
```

A simple initial model could use global parameters:

```json
{
  "pLearn": 0.15,
  "pSlip": 0.10,
  "pGuess": 0.20
}
```

There is no need to estimate skill-specific parameters initially.

---

# 3. Lessons generate evidence

Every exercise should identify the skill it primarily tests.

For example:

> Ich ___ jeden Morgen zur Arbeit.

```text
gehe
gehst
geht
gehen
```

The learner selects:

```text
gehe
```

The application records an observation:

```json
{
  "skillId": "de:wordform:gehen:present:1sg",
  "correct": true,
  "language": "de",
  "evidence": "corpus",
  "storylineId": "story_123",
  "lessonId": "lesson_456",
  "timestamp": "..."
}
```

BKT updates `pMastery`.

Thus existing LLM-generated lessons do not need to become the knowledge model. They simply produce **structured evidence linked to knowledge components**.

---

# 4. One lesson can test several skills

A lesson can contain several exercises targeting different skills:

```json
{
  "lessonId": "lesson_123",
  "skills": [
    "de:vocab:gehen",
    "de:wordform:gehen:present",
    "de:grammar:present_1sg"
  ]
}
```

But individual exercises should preferably specify their principal target:

```json
{
  "question": "Ich ___ jeden Morgen zur Arbeit.",
  "skillId": "de:wordform:gehen:present:1sg"
}
```

This makes the learner model much more reliable.

---

# 5. Storyline progress is an aggregation

A storyline should not have a separate BKT model.

Suppose a storyline introduces:

```text
Chapter 1
    greetings
    introducing yourself

Chapter 2
    family vocabulary
    possessives

Chapter 3
    past tense

Chapter 4
    idiomatic expressions
```

The relevant skills might have current mastery values:

```text
vocabulary:greeting             0.94
vocabulary:name                 0.91
grammar:personal_pronouns       0.82
grammar:possessive              0.63
wordform:sein:present           0.87
grammar:past                    0.41
idiom:...                       0.18
```

Story progress can then be calculated from these values.

For example:

> **Story progress = percentage of required skills with P(mastery) ≥ 0.70**

The learner's story progress therefore represents **actual demonstrated language knowledge**, rather than simply chapters read.

---

# 6. Story progression can depend on mastery

This naturally produces a game-like progression system.

For example:

```text
Chapter 5 unlocks when:

german:vocab:family       >= 0.70
german:possessives        >= 0.65
german:wordform:haben     >= 0.60
```

The learner cannot simply click through the story. They need to demonstrate sufficient mastery of the relevant language material.

Importantly:

> **The application—not the LLM—determines whether the learner has unlocked the next part of the story.**

The LLM generates narrative and exercises; the knowledge-tracing layer controls progression.

---

# 7. The same skill can occur in multiple storylines

Suppose the learner encounters:

```text
Story A → German → vocabulary:gehen
Story B → German → vocabulary:gehen
Story C → German → word forms of gehen
Chatbot → German → use of gehen
```

All relevant evidence contributes to the same underlying skill.

There should be one canonical skill:

```text
de:vocab:gehen
```

rather than separate knowledge states for:

```text
gehen in Story A
gehen in Story B
```

This allows learners to move between stories without resetting their language knowledge.

---

# 8. Corpus knowledge versus real-language ability

The learner might become very good at exercises generated from the Dreizunge corpus without being equally capable of using the language spontaneously.

Therefore, every observation should retain its **evidence/source type**.

For example:

```json
{
  "skillId": "de:wordform:gehen:present",
  "correct": true,
  "evidence": "corpus"
}
```

versus:

```json
{
  "skillId": "de:wordform:gehen:present",
  "correct": true,
  "evidence": "conversation"
}
```

Possible evidence types:

```text
corpus
story
lesson
chat
free_text
translation
listening
real_world
```

The UI could consequently distinguish:

```text
German

Corpus mastery       81%
Independent use      54%
```

Initially, there is no need for two separate BKT models. Store the evidence source and derive these views from the same underlying learner model.

---

# 9. The persistent chatbot becomes another source of evidence

The chatbot can access the learner's current skill state.

If the learner asks:

> Why is it *der* here and not *den*?

the chatbot can identify the relevant KC:

```text
de:grammar:article:case
```

If the subsequent interaction provides evidence of understanding, it can generate an observation such as:

```json
{
  "skillId": "de:grammar:article:accusative",
  "correct": true,
  "evidence": "chat",
  "confidence": 0.86
}
```

Initially, however, LLM-inferred evidence should be treated more cautiously than controlled exercises.

A useful distinction is:

```text
controlled exercise → strong evidence
free conversation    → weaker evidence
LLM interpretation   → confidence-weighted evidence
```

This prevents an LLM error from suddenly assigning mastery to a learner.

---

# 10. Target-language progress is independent of the story

A learner may encounter German through:

```text
Little i
Scottish teacher
migration story
conversation
vocabulary lessons
grammar lessons
```

All of these contribute to the same:

```text
German learner model
```

The story is the **context through which the evidence was obtained**, not a separate knowledge system.

This is especially important for learner-generated stories.

A student could create an entirely new German storyline while still contributing evidence to the existing canonical German skill model.

---

# 11. Language-level progress

Overall German progress can be an aggregation of German skills:

```text
German

Vocabulary       74%
Grammar          61%
Word forms       68%
Reading          72%
Listening        54%
Writing          47%
```

These do not need to be separate BKT systems.

They are queries over the same underlying skill states.

For example:

```text
German vocabulary =
weighted aggregation of German vocabulary skills
```

and:

```text
German grammar =
weighted aggregation of German grammar skills
```

Eventually, skills can also be mapped onto CEFR levels:

```text
German

A1        91%
A2        73%
B1        42%
B2        17%
```

---

# 12. Whole Dreizunge progress

At the highest level:

```text
Dreizunge
│
├── German
│   ├── vocabulary
│   ├── grammar
│   ├── word forms
│   ├── reading
│   └── listening
│
├── Italian
│   ├── vocabulary
│   ├── grammar
│   └── ...
│
├── English
│   └── ...
│
└── ...
```

Again, no additional BKT model is required.

The Dreizunge dashboard simply aggregates the learner's knowledge across languages.

---

# 13. Minimal implementation

A first implementation really only needs three persistent data structures.

## `skills`

The canonical language-learning knowledge components.

```json
{
  "id": "de:wordform:gehen:present:1sg",
  "language": "de",
  "type": "word_form",
  "description": "Use gehen correctly in first-person singular present"
}
```

## `learner_skills`

The current BKT state.

```json
{
  "userId": "...",
  "skillId": "de:wordform:gehen:present:1sg",
  "pMastery": 0.73,
  "attempts": 12,
  "correct": 9,
  "lastSeen": "2026-08-12"
}
```

## `observations`

The evidence that produced the state.

```json
{
  "userId": "...",
  "skillId": "de:wordform:gehen:present:1sg",
  "correct": true,
  "evidence": "story",
  "storylineId": "story_123",
  "lessonId": "lesson_456",
  "timestamp": "..."
}
```

This provides both the **current learner model** and the history needed to debug and improve it.

---

# 14. Add prerequisites later

Once the basic system works, skills can have prerequisite relationships:

```json
{
  "id": "de:grammar:past:perfect",
  "prerequisites": [
    "de:wordform:haben:present",
    "de:wordform:sein:present",
    "de:past_participle"
  ]
}
```

This enables the system to answer:

> **What should this learner learn next?**

rather than merely:

> What lesson comes next in this story?

This is where the knowledge graph begins to become useful, but it is **not necessary for the initial BKT implementation**.

---

# 15. Overall architecture

```text
                 CANONICAL LANGUAGE SKILLS
                           │
             ┌─────────────┴─────────────┐
             │                           │
       prerequisites                skill metadata
             │                           │
             └─────────────┬─────────────┘
                           │
                           ▼
                  LLM-GENERATED LESSONS
                           │
                    exercises/questions
                           │
                           ▼
                       ANSWERS
                           │
                           ▼
                          BKT
                           │
                           ▼
                 LEARNER SKILL STATE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
      Storyline        Target language    Dreizunge
       progress           progress         progress
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                    NEXT-LESSON SELECTION
```

The key separation is:

**LLM → generates learning experiences**

**BKT → estimates what the learner knows**

**Story engine → determines narrative progression**

**Progress layer → aggregates the learner model**

This gives Dreizunge a persistent, cross-story learner model while allowing the narrative layer to remain highly flexible and LLM-driven.
