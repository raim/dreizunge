Q: but will qwen generate nice lessons, if it doesn't know the language?


A: GPT-5.3

That is the central concern — and the answer is:

> often surprisingly yes, but only up to a point.

The key distinction is:

* **surface fluency**
  vs
* **structural manipulation of already-provided text**

Qwen may be weak at *inventing* Luxembourgish prose from scratch, but much stronger at:

* reusing existing Luxembourgish sentences
* extracting vocabulary
* generating exercises around provided text
* maintaining JSON structure

because the hard linguistic realization has already been done.

---

# Important insight

Your lesson-generation task is mostly:

## transformation

not free generation.

If Qwen receives:

```text id="6og1m6"
"D'Maus leeft duerch de Bësch."
```

it does not need deep Luxembourgish competence to produce:

```json id="lqll6z"
{
  "target": "Bësch",
  "en": "forest"
}
```

or:

```json id="svob3j"
{
  "sentence": "D'Maus leeft duerch de Bësch.",
  "translation": "The mouse runs through the forest."
}
```

especially if you help it.

---

# Where Qwen will still fail

Likely:

* subtle grammar correctness
* idiomatic phrasing
* pronunciation
* morphology
* tokenization in exotic scripts
* rare vocabulary nuance

But:

* lesson structure
* distractors
* exercise assembly
* JSON validity

will probably still be much better than TranslateGemma.

---

# The crucial trick

You should stop asking Qwen to *invent* target-language material.

Instead:

## provide the linguistic substrate explicitly

Example:

```text id="8kivhk"
Here is a story in Luxembourgish.

ONLY use vocabulary and sentences from this story.
Do not invent new Luxembourgish text unless necessary.
```

Now Qwen mainly performs:

* segmentation
* annotation
* pedagogical packaging

which is easier.

---

# This is actually how many NLP pipelines work

One model:

* generates or translates content

Another model:

* structures
* annotates
* classifies
* extracts

The second model does not require native-level fluency.

---

# Very important improvement

You can constrain lesson generation heavily.

Instead of:

```text id="jlwm0y"
Generate beginner lessons about this story.
```

use:

```text id="zqlty4"
Extract exactly 8 vocabulary items appearing in the story.
Extract exactly 5 sentences appearing in or minimally adapted from the story.
```

This massively reduces hallucinations.

---

# Another powerful trick: retrieval-style prompting

Instead of asking Qwen to compose target-language text:

provide candidate material:

```text id="pdx7c9"
Vocabulary candidates:
...

Sentence candidates:
...
```

and ask it only to:

* choose
* rank
* organize
* simplify

This is much easier than generation.

---

# Realistically, there are three competence regimes

## 1. High-resource languages

Italian, French, Spanish, German

→ Qwen can probably do everything directly.

---

## 2. Medium-resource languages

Dutch, Polish, Swedish, Turkish

→ Qwen can usually structure and lightly generate.

---

## 3. Low-resource languages

Luxembourgish, Welsh, Basque, etc.

→ Qwen should not invent much text.
Use it as:

* organizer
* extractor
* formatter

---

# Strong hybrid architecture

For weaker languages:

## TranslateGemma

* creates story
* maybe sentence bank

## Qwen

* creates structured lessons
* exercise logic
* JSON
* distractors

## Optional validation pass

with TranslateGemma again

---

# Another very practical solution

You can ask Qwen to generate lessons in an intermediate representation:

```json id="rzgmyh"
{
  "sourceSentence": "...",
  "focusWord": "...",
  "exerciseType": "ordering"
}
```

Then a language-specialized model fills in final target-language refinements.

This is extremely robust.

---

# The deeper pattern

You are discovering an important truth about LLM systems:

> multilingual competence and symbolic reliability are often anti-correlated.

Translation models:

* excellent lexical realism
* poor structured reasoning

Instruction models:

* excellent structure
* weaker rare-language fluency

So compositional architectures become much stronger than monolithic prompting.
