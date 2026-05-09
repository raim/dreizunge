Q :* new lesson type: currently we generate a fixed lesson structure of
  vocabulary and sentence reconstruction lessen. We want a second type,
  where a story is passed to the LLM and the LLM should provide 
  the same stories but with systematically introduced errors of three
  types: spelling, grammar and logic. The model should report the
  introduced errors in a json format, and both should be stored in
  lessons.json. The current difficulty level selector
  should have a fourth entry: "Advanced - Text Understanding" to choose
  this lesson type. If the user selects an existing lesson from the 
  CONTINUE STORY FROM selection, no topic is required, and the lesson is
  added to the existing entry for this lesson. The user is presented the
  text with errors, and gets points
  for marking the correct location of errors. Come up with a fun, simple
  and minimal way to point out errors.
  


A: GPT-5.3

This is a very strong direction. It moves the app from:

* phrase memorization,
  to:
* active language comprehension,
* proofreading,
* semantic understanding,
* discourse-level reasoning.

And importantly:

* it reuses your strongest asset already present in the system:
  the generated story.

This is much more pedagogically coherent than isolated Duolingo-style fragments.

# Core idea

You now have two lesson families:

## Type A — current

Structured exercises:

* vocab
* MCQ
* ordering
* listening

## Type B — new

Narrative proofreading:

* spelling
* grammar
* semantic/logic anomalies

This creates a very nice progression:

* beginner → phrase level
* advanced → discourse level

---

# Recommended architecture

Do NOT overload current lesson objects.

Instead introduce explicit lesson types.

Example:

```json
"id": 4,
"type": "error_hunt",
"title": "Advanced Text Understanding",
"difficulty": 4,
```

This will save enormous complexity later.

---

# Recommended data structure

Add to `lessons.json`:

```json
{
  "id": 4,
  "type": "error_hunt",
  "title": "Advanced - Text Understanding",
  "desc": "Find spelling, grammar and logic mistakes",
  "sourceStory": "... original story ...",
  "corruptedStory": "... modified story ...",

  "errors": [
    {
      "id": 1,
      "type": "spelling",
      "original": "microscopio",
      "corrupted": "microscopioo",
      "start": 183,
      "end": 195,
      "explanation": "extra letter"
    },
    {
      "id": 2,
      "type": "grammar",
      "original": "le cellule oscillavano",
      "corrupted": "le cellule oscillava",
      "start": 302,
      "end": 323,
      "explanation": "verb agreement"
    },
    {
      "id": 3,
      "type": "logic",
      "original": "added glucose",
      "corrupted": "removed all nutrients",
      "start": 510,
      "end": 534,
      "explanation": "contradicts experiment"
    }
  ]
}
```

---

# VERY important design decision

The model should NEVER generate:

* only corrupted text.

Instead:

## generate ORIGINAL + EDIT SCRIPT

Meaning:

* keep original story immutable,
* apply modifications algorithmically.

This is critical.

---

# Why?

If the LLM rewrites whole paragraphs:

* offsets drift,
* hallucinations accumulate,
* unrelated wording changes appear,
* correction validation becomes impossible.

Instead:

## Ask for localized edits only.

Example prompt:

```text
Given this story:

[story]

Introduce:
- 4 spelling mistakes
- 3 grammar mistakes
- 2 logical inconsistencies

Return ONLY JSON:

{
  "edits":[
    {
      "type":"grammar",
      "find":"le cellule oscillavano",
      "replace":"le cellule oscillava",
      "reason":"subject-verb disagreement"
    }
  ]
}
```

Then your JS applies edits deterministically.

This is MUCH more robust.

---

# Why this matters enormously

Current problem in your app:

* whole generated lessons drift semantically.

This new design avoids that entirely.

You:

* own the source story,
* own exact corruption locations,
* can validate edits automatically.

Huge improvement.

---

# Difficulty scaling

Excellent opportunity.

## Difficulty 1

Only spelling:

* doubled letters
* missing accents
* capitalization

## Difficulty 2

Simple grammar:

* agreement
* tense
* articles

## Difficulty 3

Subtle grammar + semantics

## Difficulty 4 ("Advanced")

Logic contradictions:

* timeline inconsistency
* scientific contradiction
* impossible actions
* character inconsistency

Example:

```text
Elena carefully adjusted the microscope.

↓

Elena carefully adjusted the telescope.
```

or

```text
The yeast synchronized after glucose addition.

↓

The yeast died instantly after glucose addition.
```

These are excellent comprehension tasks.

---

# UI concept — keep it simple

Your instinct is correct:
minimal interaction.

# Best UX:

## click-to-mark

User taps/clicks words.

Marked tokens become:

* red underline
* orange highlight

Then:

* "Check answers"

---

# Why token-level marking works

Advantages:

* trivial to implement,
* mobile-friendly,
* visually clear,
* no text selection APIs,
* no drag handling.

---

# Recommended interaction

Story rendered as token spans:

```html
<span class="tok" data-i="183">microscopioo</span>
```

Click toggles:

```js
tok.classList.toggle('suspect');
```

---

# Scoring

Elegant simple scoring:

## Correct mark

+10

## False positive

-3

## Missed error

-5

Bonus:

* perfect detection streaks.

---

# Important refinement

Some errors span multiple words.

So internally:

* store char ranges,
* but UI maps tokens overlapping range.

---

# Strong recommendation:

distinguish error types visually AFTER checking

Before checking:

* all user marks same color.

After checking:

* spelling = blue
* grammar = orange
* logic = purple

This creates learning feedback.

---

# Another strong feature

After success:

```text
You found:
✓ 3 spelling mistakes
✓ 2 grammar mistakes
✓ 1 logic contradiction
```

Then reveal:

* explanations,
* corrected text.

Excellent pedagogy.

---

# Critical prompt-engineering advice

DO NOT ask the LLM:

```text
rewrite story with mistakes
```

That will become unstable chaos.

Instead:

# Ask for EDIT OPERATIONS ONLY.

This is the key architectural insight.

---

# Example robust prompt

```text
You are generating proofreading exercises.

Given this story:

[story]

Introduce exactly:
- 3 spelling mistakes
- 2 grammar mistakes
- 1 logical inconsistency

Rules:
- preserve story structure
- modify only small local spans
- do not rewrite paragraphs
- mistakes must be subtle but identifiable

Return JSON only:

{
  "edits":[
    {
      "type":"spelling",
      "find":"oscillazione",
      "replace":"oscilazione",
      "reason":"missing consonant"
    }
  ]
}
```

---

# Then validate automatically

Your code can verify:

```js
story.includes(find)
```

before applying.

This is enormously valuable.

---

# Integration into existing app

You already have:

* stories,
* lesson selection,
* progression,
* difficulty system.

So this fits naturally.

You mainly need:

## new lesson renderer

```js
if(ex.type==='error_hunt')
```

---

# One more major advantage

This approach works MUCH better with weaker LLMs.

Even:

* translation models,
* smaller Qwen variants,
* multilingual models

can usually produce:

* localized edit operations

far more reliably than:

* huge structured lesson JSONs.

So this may become your most scalable lesson type.
