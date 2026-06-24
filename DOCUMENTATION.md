# Dreizunge — How it works

Dreizunge turns **any topic** into a set of language-learning lessons in **any of ~30
languages**, wrapped in a short generated story. Lessons are produced by a **local LLM via
Ollama**, saved to a single `lessons.json`, and can be **published as a fully static site**
that needs no server. This document explains the three ways the app runs, the different ways
to create content, and the feedback loop that is meant to make generated lessons steadily
better for every *source → target* language pair.

> The screenshots below are **mock-ups** (ASCII), not pixel captures — they show layout and
> the controls available in each mode.

---

## 1. The three layers

The same `index.html` runs in three modes. Which one you get depends on **whether a server
with an LLM is running** (`canGenerate`) and **whether Teacher mode is on** (`_teacherMode`).

| Layer | How you get it | `canGenerate` | Teacher mode | Generate? | Edit / rate / flag? | Play? |
|---|---|---|---|---|---|---|
| **Live** | `node server.js` with Ollama | `true` | **on** by default | ✅ everything | ✅ saved to `lessons.json` | ✅ |
| **Static / teacher** | open `docs/index.html`, press **🔓 Teacher mode** | `false` | on (you toggle it) | ❌ no LLM | ✅ in-memory, rides a JSON export | ✅ |
| **Static / student** | open `docs/index.html` (default) | `false` | **off** | ❌ | ❌ read-only | ✅ (locked progression) |

> A fourth, in-between state: running the server **without** an LLM (`LLM_BACKEND=none node
> server.js`). It behaves like *Live* for editing/import/play but with generation disabled —
> useful for offline study from an existing `lessons.json`.

### 1a. Live

The authoring environment. With Ollama detected, you can generate, edit, review, and publish.
Everything you do is persisted server-side to `lessons.json`.

```
┌────────────────────────────────────────────────────────────────┐
│  Dreizunge                                       🔓 Teacher mode │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Topic:   [ a vacation in Domburg                        ]   │ │
│ │ Target:  [🇮🇹 Italian ▾]      I speak: [🇬🇧 English ▾]      │ │
│ │ Difficulty: ●●○     Story length: [ ~300 words ▾ ]         │ │
│ │ Format:  [ Standard ▾ ]       Style: [ Creative ▾ ]        │ │
│ │ 📄 [ Upload a PDF… ]            [   Generate lessons →  ] 🛑 │ │
│ └────────────────────────────────────────────────────────────┘ │
│  Your library                                                    │
│   📖 🏖️ a vacation in Domburg   🇮🇹←🇬🇧      ↪  ✏️  ➕  🔍        │
│   📖 🍕 pizza dough             🌐           ↪  ✏️  ➕  🔍        │
│   📖 🧬 yeast metabolic oscillations 🇩🇪←🇬🇧 ↪  ✏️  ➕  🔍        │
└────────────────────────────────────────────────────────────────┘
   ↪ continue story   ✏️ edit/rename   ➕ add a lesson   🔍 QC review
```

Can do: generate stories + lesson sets (all formats), continue/extend storylines, add single
lessons, regenerate lessons, generate from a PDF, run **QC** (a second LLM pass that reviews
generated items), auto-title and summarise storylines, edit any lesson or story, ⭐-rate and
⚑-flag questions, export JSON, and **build the static site** (`/api/build-static`).

### 1b. Static / teacher

The published `docs/index.html` opened by someone who presses **🔓 Teacher mode**. There is no
server and no LLM, so nothing can be *generated* — but everything can be **reviewed and
corrected**. Edits, ⭐ ratings and ⚑ flags are held in memory and travel out with **Export
JSON**; they are not written back to any file on their own.

```
┌────────────────────────────────────────────────────────────────┐
│  🔓 Teacher mode (ON)                              [ ⬇ Export JSON ] │
│  🏖️ a vacation in Domburg   🇮🇹←🇬🇧        (all chapters unlocked) │
│   1. Vocabulary       ✏️                                         │
│      • la spiaggia  → the beach            ☆  ⚑                  │
│      • il mare      → the sea              ⭐  ⚑   ← liked       │
│   2. Word forms       ✏️                                         │
│   3. Synonyms         ✏️                                         │
└────────────────────────────────────────────────────────────────┘
```

Can do: unlock and play every chapter, edit lessons and the story, ⭐-rate good questions,
⚑-flag bad ones (with a comment and a suggested correction), and **Export JSON** to carry
those changes back to a Live machine. Cannot generate, QC, or auto-title (all need the LLM).

### 1c. Static / student

The default public experience on GitHub Pages — a clean, read-only learner. Lessons unlock in
order: finish one to unlock the next; finish all chapters to continue a storyline. There are
no edit, generate, or review controls, and hidden lessons stay hidden.

```
┌────────────────────────────────────────────────────────────────┐
│  🏖️ a vacation in Domburg   🇮🇹←🇬🇧                              │
│    ✓  1. Vocabulary          done                                │
│    ▶  2. Word forms          play                                │
│    🔒 3. Synonyms            locked — finish #2 first            │
│    🔒 4. Listening           locked                              │
└────────────────────────────────────────────────────────────────┘
```

A single exercise, as a learner sees it:

```
┌────────────────────────────────────────────────────────────────┐
│  ❤️❤️❤️                              progress ▓▓▓▓▓░░░░  55%      │
│                                                                  │
│   Die ___ schliefen auf dem warmen Dach.                         │
│   “The cats were sleeping on the warm roof.”                     │
│                                                                  │
│        [   Katze   ]                 [   Katzen   ]              │
│                                                                  │
│                         [  Check  ]                              │
└────────────────────────────────────────────────────────────────┘
```

### The round-trip between layers

Static/teacher is not a dead end. Its **Export JSON** can be **imported on a Live machine**
(`Import` → `/api/lessons/import`), which folds the teacher's corrections, ⭐ ratings and ⚑
flags back into `lessons.json` — where they feed the improvement pipeline (§3) and can be
re-published. So a non-technical reviewer on the published site can improve the source material
without ever running a server.

```
   Live (author)  ──build-static──▶  docs/  ──publish──▶  Static/student (learn)
        ▲                                                      │
        │                                              Static/teacher (review)
        └──────────────  Import JSON  ◀──── Export JSON ───────┘
```

---

## 2. How content is organized

Four nested levels — useful to know before generating:

```
storyline            an ordered chain of chapters that share a continuing story
└─ chapter (topic)   one topic + its story + a set of lessons   ← a "lesson set"
   └─ lesson         one exercise set of a single type (vocab, word_forms, …)
      └─ item        one question (a vocab pair, a fill-in-the-blank, …)
```

A **chapter** (called a *topic* in the data) is what most people mean by a "lesson set": a
story plus several lessons built from it. A **storyline** chains chapters so vocabulary
introduced early is reinforced later. Everything lives in `lessons.json`.

---

## 3. Ways to generate lesson sets and stories

All generation happens in **Live** mode. There are six entry points.

| # | Way | How | What you get |
|---|---|---|---|
| A | **New topic** | type a topic, pick target/source, difficulty, length, format, style → *Generate* | a story + a lesson set (one chapter) |
| B | **Continue a storyline** | ↪ on a chapter | the next chapter, continuing the story and reinforcing prior vocabulary |
| C | **Add one lesson** | ➕ on a chapter, choose a format | a single lesson of that type, grounded in the chapter's story |
| D | **Recreate lessons** | regenerate a storyline's lessons | refreshed lessons across the chain (reinforce/extend aware) |
| E | **From a PDF / book** | 📄 upload a PDF | each chunk becomes a chapter with lessons (`/api/generate-book`) |
| F | **From your own text** | supply a story (and optionally its translation) | lessons built from *your* text instead of a generated story |

### Story + lessons in one go (A)

A topic generates a short **story** in the target language at the chosen length and style,
then builds lessons from it. The **difficulty** controls sentence length and vocabulary
reach; the **style** controls the story's tone.

```
┌──────────── Generating: “a vacation in Domburg” 🇮🇹←🇬🇧 ─────────────┐
│  🛠️  writing the story … ✓                                          │
│  🛠️  vocabulary lesson … ✓   (12 words)                             │
│  🛠️  word-forms lesson … ✓   (6 items)                              │
│  🛠️  listening lesson  … ▓▓▓▓▓▓░░░  attempt 1/3                      │
│                                                  [ 🛑 Stop ]         │
└─────────────────────────────────────────────────────────────────────┘
```

### Lesson formats (C) and the exercises they produce

When you **add a lesson** you pick a *format*; each format generates one or more *exercise
types* the learner then plays:

| Format (`lessonFormat`) | Teaches | Exercise types produced |
|---|---|---|
| **Standard** | core vocabulary + sentences | listening-MCQ, listening-type, target→source MCQ, source→target MCQ, word-order, read & translate |
| **Word forms** | inflection (case, number, tense, degree) | fill-in-the-blank: pick the right form |
| **Synonyms** | sense relations | select-all synonyms / antonyms |
| **Grammar** | gender, article, plural | article MCQ, plural MCQ, type-the-plural |
| **Conjugation** | verb paradigms | conjugation MCQ, type-the-form |
| **Error hunt** | proofreading | find the deliberately corrupted word in the story |
| **Math** | arithmetic in the target language | number-order, calculation, (LaTeX expression) |
| **Mixed** | review | a blend of the above across the storyline |

> Internally each generator validates and *salvages* model output (dedupes choices, repairs a
> missing blank, drops unfixable items) so a weak local model still yields a usable lesson
> rather than failing outright.

---

## 4. The feedback → improvement pipeline

This is the part that is meant to make lessons better over time, in **every source → target
combination**, from ordinary use.

### The two signals (and a third, automatic, one)

While playing or editing, each question carries two one-tap affordances, plus an automatic
quality check:

```
┌─ word_forms · “Plurals” ───────────────────────────────────────────┐
│   [ Die ___ schliefen auf dem warmen Dach. ]              ☆   ⚑    │
│     choices:  Katze | Katzen          correct: Katzen              │
│     translation:  The cats were sleeping on the warm roof.         │
│                                                                    │
│   ☆ → ⭐  “this is a GOOD example” (item.userRating)               │
│   ⚑      report a problem + suggested fix   (item.userFlag)        │
│   🔍      QC: a second LLM flags suspect items (item.qc)           │
└─────────────────────────────────────────────────────────────────────┘
```

- **⭐ Like / rate** — marks an item as a *good example* worth imitating (`item.userRating`).
- **⚑ Flag** — reports a problem, with an optional comment and a corrected version
  (`item.userFlag`).
- **🔍 QC** *(Live only)* — a second LLM pass reviews generated items and attaches suggestions
  (`item.qc`); re-running clears the ones now fine.

All three ride the same client-authoritative save path, so they survive editing, export, and
re-import — including ratings made by a reviewer in **Static / teacher** mode.

### From ⭐ ratings to better prompts

Generation prompts contain a worked **`{EXAMPLE}`** block. By default that's a small curated
example shipped in `prompts.json`. The pipeline lets *your own* ⭐-rated items become the
example — and, crucially, keyed by the exact language pair they came from:

```
   Any (source → target) pair, while playing or editing
   ┌────────────┐   ⭐ rate        ┌──────────────────────┐
   │ a lesson   │ ───────────────▶ │ item.userRating      │   stored on the
   │   item     │   ⚑ flag         │ item.userFlag        │   lesson; saved /
   │            │ ───────────────▶ │ item.qc  (LLM QC)    │   exported / imported
   └────────────┘                  └──────────┬───────────┘
                                              │   node harvest-examples.js lessons.json
                                              ▼
                                   ┌──────────────────────┐
                                   │     examples.json    │   { "wordForms":
                                   │     "de__en": …       │     { "de__en": "<good items>" } }
                                   └──────────┬───────────┘
                                              │   loadPrompts() overlays it on prompts.json
                                              ▼
                                   ┌──────────────────────┐
                                   │  prompt {EXAMPLE}    │   promptExample(P, L, S):
                                   │  injected per pair   │   pair → language → default
                                   └──────────┬───────────┘
                                              │   next generation in that pair
                                              ▼
                                   better lessons for de → en
```

The steps:

1. **Harvest.** `node harvest-examples.js lessons.json` scans for ⭐-rated items in the
   example-enabled lesson types (word_forms, synonyms, grammar, conjugation), strips each to
   its schema fields, applies a light structural check, and writes `examples.json` keyed by
   **prompt type** and **`"<target>__<source>"` pair** — e.g. `wordForms.de__en`. (⭐ is the
   human quality signal; re-running regenerates the file from `lessons.json`.)
2. **Overlay.** On start (and on file change), the server overlays `examples.json` onto the
   curated examples in `prompts.json`. `examples.json` lives next to your data and is
   env-overridable (`EXAMPLES_FILE`); `prompts.json` remains the shipped, curated layer.
3. **Resolve, per pair.** When generating, `promptExample(P, lang, srcLang)` picks the most
   specific example available: an exact **`de__en`** pair first, then a per-language **`de`**
   example, then the shipped **`default`**.

### Why the pair matters (and the cross-pair story)

A harvested example carries the *actual* `{S}` translations it was rated with, so it is only
ever served back to **its own pair** — which means its baked-in translations are always
correct for that learner. As people study different combinations, the matrix of
`source → target` examples fills in from real, human-approved material:

- An English speaker learning German stars good `de→en` items → future `de→en` lessons imitate them.
- A French speaker learning German stars good `de→fr` items → future `de→fr` lessons get *their* examples; they do **not** inherit the English ones (whose translations would be wrong for them).
- A pair nobody has rated yet falls back to the curated per-language example, then the default — so output is never worse than today.

This is the core ambition: **the same act of liking a good question improves that exact
language combination for the next learner**, without anyone hand-authoring 30×30 examples.

### Honest status / caveats

- Whether same-language examples actually improve weak-model output is a **hypothesis still to
  be measured** live (via each lesson's `_genMeta`: attempts, valid, rejected). The plumbing is
  in place; the measurement is not yet done.
- ⭐ is a human signal, not a correctness proof. The harvester does only a *light structural*
  check; a hand-seeded example (e.g. the German `wordForms` seed in `prompts.json`) still wants
  a native review before being relied on.
- The example format is intentionally simple ("here are good items"); the *constraints* live in
  each prompt's rules, not in the example.

### Seeing the activity

`report-edits.js` turns the timestamps already in `lessons.json` into a sortable report of
what was generated, edited, ⭐-rated and ⚑-flagged, and when:

```
node report-edits.js lessons.json --out report.html      # sortable HTML
node report-edits.js lessons.json --kinds question,flag   # markdown, filtered
```

| When (UTC) | Storyline | Chapter | Lessonset type | Question | Action |
|---|---|---|---|---|---|
| 2026-06-08 12:00 | “…Journey” | “At the Market” | word_forms “Plurals” | [gute Wahl] | ⭐ rated |
| 2026-06-07 11:00 | “…Journey” | “At the Market” | word_forms “Plurals” | [Der Hund ___] | 🚩 flagged |

---

## 5. Exercise types (reference)

| Internal name | What the learner does |
|---|---|
| `listen_mcq` | hear the target language, pick the meaning |
| `listen_type` | hear the target language, type it back |
| `mcq_target_source` | see target word/sentence, pick the source-language meaning |
| `mcq_source_target` | see the source meaning, pick the target translation |
| `order` | reassemble shuffled tokens into the correct sentence |
| `read_translate` | read a target sentence, choose its translation |
| `word_form` | fill the blank with the correct inflected form |
| `syn_select` | select all synonyms (or antonyms) of a word |
| `mcq_article`, `mcq_plural`, `type_plural` | gender/article and plural drills |
| `mcq_conjugation`, `type_conjugation` | verb-form drills |
| `math_order`, `math_calc`, `math_latex` | arithmetic in the target language |

---

## 6. Command-line tools

All zero-dependency Node scripts (no `npm install`):

| Tool | Purpose |
|---|---|
| `node server.js` | run the Live app (auto-detects Ollama; `LLM_BACKEND=none` for offline) |
| `node build-static.js [lessons.json] [out-dir]` | build the static site into `docs/` |
| `node harvest-examples.js [lessons.json] [--out examples.json]` | turn ⭐-rated items into per-pair prompt examples |
| `node report-edits.js [lessons.json] [--out report.html]` | activity / edit report (HTML or markdown) |
| `node export-lessons.js …` | export lessons/chapters to HTML or markdown for reading or print |

---

## 7. Files and where things live

| File | Role | Layer |
|---|---|---|
| `lessons.json` | all content (storylines, chapters, lessons, items) + ratings/flags | data, both |
| `prompts.json` | LLM prompt templates + **curated** `{EXAMPLE}` blocks (shipped) | Live |
| `examples.json` | **harvested** per-pair examples (from ratings); overlays `prompts.json` | Live (optional) |
| `languages.json` | the ~30 supported languages | both |
| `ui.json` | UI strings / translations | both |
| `index.html` | the whole app (one inline script) | both |
| `docs/index.html` | the built static site for publishing | Static |

Environment knobs: `OLLAMA_MODEL`, `OLLAMA_TRANSLATION_MODEL`, `LLM_BACKEND=none`,
`LESSONS_FILE`, `EXAMPLES_FILE`, `UI_FILE`.
