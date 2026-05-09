GPT-5.5

# UI Localization + Source→Target Lesson Generation Plan

## Goal

The app should support:

* UI translated into many languages
* the selected UI language automatically becoming the lesson source language
* independently selectable target language
* fully local/offline translation of UI strings using TranslateGemma or Qwen

Example:

| UI Language   | Source Language | Target Language |
| ------------- | --------------- | --------------- |
| German        | German          | Italian         |
| French        | French          | Japanese        |
| Luxembourgish | Luxembourgish   | English         |

The UI language determines:

* menus
* buttons
* explanations
* prompts
* feedback text
* lesson source language

The target language is selected independently.

---

# Core Architecture

## IMPORTANT

Do NOT translate:

* HTML
* JS
* templates

Translate ONLY:

* semantic UI strings

---

# Directory Structure

```text
app/
  index.html
  lessons.json

  i18n/
    en.json
    de.json
    fr.json
    it.json
    lb.json
    ...

  tools/
    translate-ui.js
```

---

# Canonical UI Source

Create:

```text
i18n/en.json
```

This is the ONLY manually maintained UI language file.

Example:

```json
{
  "app_title": "Dreizunge",
  "start_lesson": "Start lesson",
  "continue_story": "Continue story from",
  "generate": "Generate",
  "repair": "Repair",
  "check": "Check",
  "correct": "Correct!",
  "wrong": "Try again",
  "lesson_complete": "Lesson complete!",
  "hearts_remaining": "Hearts remaining",
  "advanced_text_understanding": "Advanced - Text Understanding"
}
```

All other languages are auto-generated from this file.

---

# HTML Localization Strategy

Replace hardcoded UI text with localization keys.

Example:

BAD:

```html
<button>Check</button>
```

GOOD:

```html
<button data-i18n="check"></button>
```

---

# Runtime Translation System

At startup:

```js
APP.uiLang = localStorage.getItem('uiLang') || 'en';
```

Load UI file:

```js
const UI = await fetch(`i18n/${APP.uiLang}.json`).then(r=>r.json());
```

Translation helper:

```js
function tr(k){
  return UI[k] || `[${k}]`;
}
```

Apply translations:

```js
document.querySelectorAll('[data-i18n]').forEach(el=>{
  el.textContent = tr(el.dataset.i18n);
});
```

---

# IMPORTANT RULE

Never hardcode English strings in JS anymore.

BAD:

```js
alert("Lesson complete!");
```

GOOD:

```js
alert(tr("lesson_complete"));
```

---

# Automatic UI Translation Script

Create:

```text
tools/translate-ui.js
```

Usage:

```bash
node tools/translate-ui.js
```

The script should:

1. load `i18n/en.json`
2. translate all values
3. validate output
4. write translated files:

   * de.json
   * fr.json
   * it.json
   * lb.json
   * etc.

---

# Translation Model Usage

TranslateGemma or Qwen should ONLY be used for:

* UI localization
* deterministic short-form translation

NOT for:

* lesson generation
* pedagogical JSON generation

---

# Recommended Translation Prompt

```text
Translate the following UI string from English to German.

Rules:
- preserve meaning
- short UI wording
- no explanations
- output only the translation

Text:
"Start lesson"
```

---

# IMPORTANT IMPLEMENTATION DETAIL

Translate ONE STRING AT A TIME.

DO NOT translate the entire JSON in one prompt.

Correct approach:

```js
for (const [key,val] of Object.entries(en)) {
   translated[key] = await translate(val,targetLang);
}
```

Reasons:

* much more reliable
* easy retries
* avoids malformed JSON
* avoids context drift
* easy caching

---

# Validation Layer

After translation:

* ensure all keys exist
* ensure no extra keys exist
* ensure output is valid JSON

Reject and retry failed entries.

---

# Recommended Language Registry

```js
LANGS = {
  de:{name:"Deutsch",flag:"🇩🇪"},
  it:{name:"Italiano",flag:"🇮🇹"},
  fr:{name:"Français",flag:"🇫🇷"},
  lb:{name:"Lëtzebuergesch",flag:"🇱🇺"}
}
```

Use this registry for:

* UI selector
* prompts
* TTS
* localization
* language metadata

---

# Lesson Generation Architecture

Lessons are NOT translated after generation.

Lessons must be generated natively for:

```text
source language → target language
```

because:

* distractors depend on source language
* explanations depend on source language
* grammar depends on source language
* MCQ plausibility depends on source language

---

# Final Lesson Flow

```text
UI language selected
→ becomes source language

target language selected separately

Prompt:
"Generate lessons for a German speaker learning Italian."
```

---

# Lesson Schema Recommendation

Avoid language-specific field names like:

```json
{
  "it": "...",
  "en": "..."
}
```

Use:

```json
{
  "source": "...",
  "target": "..."
}
```

Example:

```json
{
  "sourceLang": "de",
  "targetLang": "it",

  "vocab": [
    {
      "target": "microscopio",
      "source": "Mikroskop"
    }
  ]
}
```

This keeps lessons language-agnostic and scalable.

---

# Summary

## TranslateGemma/Qwen responsibilities

### TranslateGemma

* UI localization only
* deterministic translation

### Qwen

* story generation
* lesson generation
* pedagogy
* exercises

---

# Long-Term Advantages

This architecture provides:

* scalable multilingual UI
* reusable lessons
* clean separation of concerns
* automatic localization updates
* easy maintenance
* offline generation capability
* support for dialects/minority languages later

----

Q:do we still want english prompts for the LLM or should we also switch those?

GPT-5.5

You probably want a hybrid strategy:

# keep system/developer prompts in English

but

# localize user-facing pedagogical prompts selectively

This is the important distinction.

---

# 1. Internal control prompts

KEEP IN ENGLISH

These include:

* JSON schema instructions
* formatting constraints
* output rules
* parser requirements
* repair instructions
* validation prompts

Example:

```text id="zw8crz"
Output valid JSON only.
Do not add explanations.
Preserve schema exactly.
```

These should remain English because:

* models are most robust there,
* instruction tuning is strongest there,
* structured output reliability is higher.

Especially for:
Qwen

---

# 2. Pedagogical framing

SHOULD MATCH SOURCE LANGUAGE

These include:

* learner explanations
* grammar hints
* exercise wording
* vocabulary semantics
* error explanations

Example:

BAD for German learner:

```text id="lfy7mn"
Generate beginner lessons for an English speaker learning Italian.
```

BETTER:

```text id="b8nvh6"
Generate beginner lessons for a German speaker learning Italian.
```

BEST:

```text id="zjlwmn"
Der Lernende spricht Deutsch und lernt Italienisch.
Erkläre schwierige Begriffe auf Deutsch.
```

because:

* distractors,
* false cognates,
* grammar transfer,
* pedagogical choices

all depend on the learner language.

---

# Recommended architecture

# Meta-instructions in English

# Learner context in source language

Example final prompt:

```text id="xby0rf"
You are a language lesson generator.

Output valid JSON only.
Preserve schema exactly.
Do not add markdown.

The learner speaks German and learns Italian.

All explanations and translations should use German.
All target-language content should use Italian.

Topic:
"yeast metabolic oscillations"
```

This is likely the optimal compromise.

---

# Why NOT fully localize prompts?

If you fully translate:

* schemas,
* formatting instructions,
* repair rules,
* structural constraints

you risk:

* degraded JSON quality,
* hallucinated fields,
* instruction drift,
* syntax corruption.

This becomes especially severe in:

* smaller models,
* dialects,
* low-resource languages.

---

# Another important insight

You should separate prompts into layers.

---

# Recommended prompt structure

## Layer 1 — stable English control prompt

```text id="n7v0xf"
You are a structured language lesson generator.
Output valid JSON only.
...
```

---

## Layer 2 — localized pedagogical context

Generated dynamically:

```text id="v9xbgz"
The learner speaks German.
The learner studies Italian.
Use German explanations.
```

---

## Layer 3 — user topic

```text id="w2npd9"
Topic:
yeast metabolic oscillations
```

---

# This is extremely important for dialect support

Example:
Luxembourgish UI.

You do NOT want:

```text id="ez1mt5"
Output valabel JSON nëmmen.
```

because:

* model robustness collapses,
* parsing reliability drops.

Instead:

```text id="k7m78w"
Output valid JSON only.

The learner speaks Luxembourgish.
Use Luxembourgish translations when possible.
```

Much safer.

---

# Strong recommendation

Make prompt templates modular.

Example:

```js id="mx2du0"
PROMPTS = {
  control_en: "...",
  pedagogy: "...",
  repair: "...",
}
```

Then compose dynamically.

---

# Another major benefit

You can later:

* swap models,
* benchmark models,
* A/B prompts,
* test multilingual performance

without rewriting everything.

---

# Recommendation for TranslateGemma specifically

TranslateGemma should probably NEVER see:

* JSON generation prompts,
* lesson synthesis prompts,
* repair prompts.

Use it only for:

* deterministic translation tasks.

Qwen remains orchestrator.

---

# Final recommendation

## KEEP:

* schemas
* formatting instructions
* parser rules
* repair constraints
* system prompts

in English.

## LOCALIZE:

* learner context
* pedagogical explanations
* vocabulary semantics
* grammar explanations
* UI

This gives:

* maximum robustness,
* multilingual pedagogy,
* stable JSON generation.
