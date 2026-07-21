# Concept Graph

## Motivation

Traditional learning systems are organized around **courses**, **chapters**, or **lessons**.

```
Course
 ├── Chapter 1
 ├── Chapter 2
 ├── Chapter 3
 └── ...
```

This assumes that every learner follows the same linear path.

Our app is fundamentally different.

Stories may branch.
Different teachers may write different stories.
Learners may choose different paths.
Stories from the community may later merge again.

Therefore **stories cannot define the curriculum**.

Instead, the curriculum is represented by a **Concept Graph**.

---

# Basic Idea

The concept graph is a directed graph (preferably a DAG) whose nodes represent concepts that can be learned.

Examples:

```
Counting

↓

Addition

↓

Multiplication

↓

Negative numbers

↓

Complex numbers

↓

Euler Identity
```

or

```
Warm Pond

↓

RNA

↓

Catalysis

↓

Metabolism

↓

Cells
```

The learner progresses through concepts, not through chapters.

---

# Stories Become Paths

Stories are simply different routes through the same graph.

Example:

```
Little i

↓

Zero

↓

Negative Numbers

↓

Imaginary Numbers

↓

Complex Plane

↓

Euler Identity
```

Another teacher may instead create

```
Pirates

↓

Navigation

↓

Angles

↓

Rotation

↓

Complex Numbers

↓

Euler Identity
```

Both stories teach exactly the same mathematical concepts.

The learner arrives at the same destination through different narratives.

---

# Lessons Teach Concepts

Each lesson should declare which concepts it teaches.

Example

```json
{
  "lesson": "word_forms",
  "teaches": [
    "english_present_tense",
    "third_person_singular"
  ]
}
```

Another example

```json
{
  "lesson": "rabbit_growth",
  "teaches": [
    "recurrence_relation",
    "fibonacci_sequence"
  ]
}
```

The lesson itself is only one way of teaching these concepts.

---

# Concepts Have Prerequisites

Every concept specifies what should already be known.

Example

```
Complex Numbers

requires

↓

Negative Numbers

↓

Multiplication

↓

Addition
```

A learner should normally master the prerequisites first.

---

# Concepts Unlock New Concepts

After mastering

```
Negative Numbers
```

the learner may unlock

```
Complex Numbers
```

or perhaps

```
Coordinate Systems
```

depending on the chosen storyline.

---

# The Learner State

Instead of storing

```
Chapter 4 completed
```

the learner profile stores

```yaml
mastered:

- counting
- addition
- multiplication
- negative_numbers
```

This is much more flexible.

---

# Story Progress

Story progress becomes

```
Story Chapter

↓

Concepts introduced

↓

Concept mastery
```

The chapter itself is not important.

The concepts are.

---

# Story Generation

An LLM generating a new chapter should receive

```
Current Story

+

Current Characters

+

Current Concepts

+

Allowed New Concepts
```

It should **not** introduce arbitrary new ideas.

Instead it advances the learner along the concept graph.

---

# Tutor Integration

The tutor also consults the concept graph.

Suppose the learner asks

> Why do imaginary numbers exist?

The tutor checks

```
Known

✓ Addition

✓ Multiplication

✓ Negative Numbers

Not yet learned

✗ Rotation

✗ Complex Plane

✗ Euler Formula
```

The tutor therefore answers using only already-mastered concepts, avoiding spoilers.

---

# Multiple Domains

The graph naturally supports many subjects.

## Mathematics

```
Counting

↓

Addition

↓

Negative Numbers

↓

Complex Numbers

↓

Euler Identity
```

---

## Biology

```
Warm Pond

↓

Purines

↓

RNA

↓

Catalysis

↓

Metabolism

↓

Cells
```

---

## Language

```
Greetings

↓

Simple Sentences

↓

Verb Forms

↓

Subordinate Clauses

↓

Humor

↓

Dialect
```

---

## Chemistry

```
Atoms

↓

Molecules

↓

Chemical Bonds

↓

Reactions

↓

Catalysis

↓

Metabolism
```

---

# Cross-Domain Connections

One of the most exciting possibilities is connecting concepts across domains.

Example

```
Exponential Growth
```

may appear in

- Fibonacci rabbits
- bacterial growth
- population genetics
- radioactive decay
- compound interest

These are different stories teaching the same underlying mathematical idea.

Likewise

```
Networks
```

may connect

- ecosystems
- metabolic pathways
- social networks
- graph theory
- computer science

The concept graph allows learners to recognize that ideas learned in one context reappear in many others.

---

# Community Stories

Teachers or learners may publish entirely new stories.

They simply specify

```
Story

↓

Introduces

↓

Concepts
```

The app automatically knows where this story fits into the curriculum.

---

# Historical Routes

The graph can also encode the historical development of knowledge.

Example

```
Counting

↓

Egyptian Mathematics

↓

Greek Geometry

↓

Arabic Numerals

↓

Fibonacci

↓

Euler

↓

Gauss

↓

Fourier

↓

Riemann
```

Learners may choose to follow history as one possible path through the graph.

---

# Why This Architecture?

The concept graph separates

- **knowledge** (the graph)
- **stories** (narrative paths)
- **lessons** (teaching activities)
- **AI generation** (content creation)

This makes the system extensible.

Stories can change.
Lessons can improve.
New teachers can contribute.

But the underlying conceptual structure remains stable.

The graph becomes the "curriculum of ideas," while stories and lessons are simply different ways of exploring it.

# Granular Learning Objectives

A "concept" such as **Complex Numbers** is still too broad to accurately represent learner progress.

Instead, every concept consists of multiple **learning objectives** (LOs).

For example:

```
Concept:
Complex Numbers

├── Understand that x² = -1 has no real solution.
├── Know the definition of i = √(-1).
├── Recognize complex numbers in the form a + bi.
├── Add complex numbers.
├── Multiply complex numbers.
├── Understand that multiplying by i corresponds to a 90° rotation.
├── Represent complex numbers on the complex plane.
├── Understand Euler's Formula.
└── Understand Euler's Identity.
```

A learner rarely masters an entire concept at once.

Instead, individual learning objectives are unlocked and mastered over time.

---

# Learning Objectives Become the Fundamental Graph

The graph should ultimately connect learning objectives rather than entire concepts.

Example

```
Addition

↓

Multiplication

↓

Negative Numbers

↓

Equation x² = -1 has no real solution

↓

Definition of i

↓

Complex Number Representation

↓

Complex Plane

↓

Rotation by i

↓

Euler Formula

↓

Euler Identity
```

Concepts are simply collections of nearby objectives.

---

# Lessons Target Learning Objectives

Every lesson should declare exactly which objectives it teaches.

Example

```json
{
  "lesson_type": "story_dialogue",
  "teaches": [
    "definition_of_i",
    "recognize_complex_numbers"
  ]
}
```

A later lesson might teach

```json
{
  "lesson_type": "visual_rotation",
  "teaches": [
    "rotation_by_i"
  ]
}
```

This allows multiple lessons to teach the same objective.

---

# Stories Target Learning Objectives

Stories should also declare which objectives they introduce.

Example

```
Little i Chapter 1

↓

Who am I?

↓

No mathematical objective yet
```

```
Little i Chapter 3

↓

Meet Zero

↓

Objective:
Negative numbers exist.
```

```
Little i Chapter 8

↓

Meet π

↓

Objective:
Recognize recurring numerical patterns.
```

```
Little i Final Chapter

↓

Meet e

↓

Objectives:

• Euler Formula
• Euler Identity
```

---

# Learner State

Instead of

```yaml
completed:

- chapter5
```

store

```yaml
mastered:

- counting
- addition
- subtraction
- negative_numbers
- definition_of_i

learning:

- complex_plane
- rotation_by_i
```

The tutor therefore knows exactly what has already been learned.

---

# Partial Mastery

Learning objectives should support mastery levels.

Example

```yaml
definition_of_i:

    introduced: true

    practiced: 5

    mastery: 0.82
```

or

```yaml
rotation_by_i:

    introduced: true

    mastery: beginner
```

The exact scoring system is implementation-dependent.

---

# Lesson Selection

The lesson generator should prefer objectives that

- are unlocked
- are not yet mastered
- have suitable prerequisites
- fit the current story

instead of simply selecting the next chapter.

---

# Tutor Integration

The tutor should reason about learning objectives rather than chapters.

Suppose the learner asks

> Why does multiplying by i rotate a point?

The tutor checks

```
Known

✓ Cartesian coordinates

✓ Complex numbers

✓ Definition of i

Not yet learned

✗ Complex plane

✗ Rotation

✗ Euler Formula
```

The tutor can therefore respond

> "That's a wonderful question. We've already discovered what i is, but we haven't yet explored why it behaves like a rotation. We'll discover that together soon."

No spoilers are necessary.

---

# Multiple Learning Paths

The same learning objective can be reached through many different stories.

Example

```
Rotation by i

← Little i story

← Pirate navigation story

← Clock hands

← Video game character turning

← Robot movement
```

Each learner may experience a different narrative while mastering exactly the same objective.

---

# Cross-Domain Objectives

Learning objectives can naturally connect different subjects.

Example

```
Exponential Growth
```

appears in

- Fibonacci rabbits
- bacterial growth
- yeast fermentation
- compound interest
- radioactive decay

Likewise

```
Feedback Loops
```

appear in

- metabolism
- ecosystems
- control systems
- neural networks
- economics

The concept graph therefore becomes a graph of ideas rather than school subjects.

---

# Historical Discovery

Historical learning paths become another layer over the same graph.

Example

```
Arabic Numerals

↓

Zero

↓

Negative Numbers

↓

Imaginary Numbers

↓

Euler

↓

Gauss
```

The learner experiences roughly the same sequence in which humanity discovered these ideas.

---

# Design Principle

The central abstraction of the app is **not the chapter**, and ultimately not even the **concept**.

The fundamental unit is the **learning objective**.

Stories, lessons, games, conversations, historical narratives, and teacher-created content are simply different ways of helping learners master these objectives.

The concept graph then becomes a network of connected learning objectives, organized into higher-level concepts, allowing adaptive tutoring, personalized learning paths, and community-generated content while maintaining a coherent and shared curriculum.

## Note by chatGPT

I think this refinement is important because it aligns very well with how modern educational systems (e.g. Knowledge Space Theory, Bayesian Knowledge Tracing, and mastery learning) model progress. It also gives your LLMs much clearer targets: instead of asking them to "teach complex numbers," you ask them to generate a story or lesson that advances one or two specific learning objectives. That makes generation easier to control and much easier to evaluate automatically.
