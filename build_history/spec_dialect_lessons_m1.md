# Spec — German-dialect lessons from uploaded material (milestone 1)

Status: spec for review. Goal of M1: **upload a Dialect↔German glossary table and/or a parallel
text → get vocab + sentence lessons faithful to the uploaded material.** Generated dialect
*stories* are explicitly deferred to M2 (see end).

## What already exists (don't rebuild)

Investigating the current code, a dialect scaffold is already wired — this changes the work from
"greenfield" to "make the existing path faithful + add a table importer":

- **Free-text dialect hint.** The generate request carries `userDialect` (client: `#user-dialect-input`,
  index.html ~3795/3837). The server threads it into *every* generator's system prompt via
  `PROMPTS.*.dialectNote` ("The target language variety is: {dialect}…") — `sysLesson`,
  `sysLessonFromText`, `sysLessonTable`, `sysStory`, `sysGrammar`, `sysConjugation`, and the
  meta path (server.js 518/536/553/930/1045/1058/1649). It persists on the topic
  (`saved.userDialect`) and rides chapter continuation (server.js 3374/3392).
- **User-provided story + translation import.** `userStory` + `userTranslation` (client ~3793–3836)
  flow into generation; `userStoryLang` marks whether the pasted text is the target/source/other
  language (server.js 1975–1981). When a translation is supplied it's used as `storyTranslation`
  instead of auto-translating (server.js 2009).
- **Extract-lessons-from-provided-text prompt.** `sysLessonFromText` already exists — it builds
  vocab/sentence lessons *from a supplied text* rather than inventing content.
- **QC + per-item flag/star/edit** for vocab/sentences/word_forms/synonyms, and the editor.

**The two real gaps for M1:** (1) there is **no glossary-table importer** — only free prose; and
(2) the current `dialectNote` leans on the *model's* dialect knowledge (the risky path from our
discussion), rather than anchoring strictly to uploaded ground-truth rows.

## Design principle (the safety spine)

For a dialect, **the user is the source of truth, the model is a packager/aligner, never an
author.** Every dialect token shown to a learner must trace back to an uploaded row or an aligned
span of uploaded parallel text. The model may *segment, align, and template* that material into
exercises; it may **not** invent dialect words/spellings. This is the Hangul-table principle
applied to a whole language variety.

Concretely that means M1 has **two ingestion modes**, both faithful:

1. **Glossary table** (most reliable) — rows of `dialect | High German | (optional) gloss/notes`.
   Lessons are built *directly* from rows; the LLM is optional (only to generate example
   sentences, and only when asked — see "LLM use" below).
2. **Parallel text** (dialect text + High German translation) — aligned sentence-by-sentence;
   sentence-pair lessons come from the alignment; vocab is mined from the alignment with the
   translation as the gloss authority.

A dialect text **without** a translation is M2-territory (the model would have to translate the
dialect itself — unreliable). For M1, require a translation for the text mode, or fall back to
glossary-only.

## Data model

A dialect is **not** a full languages.json entry (no flag/TTS/30 localized names, and TTS won't
speak it well anyway). Instead, model it as a **variety of an existing base language**:

```
// on the saved topic / lesson set
dialect: {
  id: "de-bar",                 // slug
  label: "Bairisch",            // shown in UI
  base: "de",                   // the High-German pair side (existing languages.json entry)
  source: "de",                 // the "translation" side the learner reads (usually de; could be en)
  note: "Munich urban Bairisch, informal", // free-text → feeds dialectNote, scoped not authoritative
  glossary: [ { d: "<dialect>", g: "<High German>", note?: "" }, ... ],   // uploaded rows
  curated: true|false           // true once a human has reviewed; gates story generation in M2
}
```

- **`base: "de"`** reuses everything language-shaped (UI strings, the German voice for the *German*
  side, difficulty specs). The dialect side renders as text with `dir="auto"` (already content-aware)
  and **no TTS** unless the user explicitly maps it to the base voice (off by default — a Bairisch
  word read by a standard German voice is misleading).
- Keeps languages.json untouched (no migration, no 30-name translation burden). The pair shows in
  the UI as e.g. "Bairisch → Deutsch" sourced from the topic's `dialect`, not the global lang list.

## Ingestion

### A. Glossary table importer (NEW — the main M1 build)
- Accept **paste or file** of TSV/CSV/Markdown-table/2-column text. Reuse the PDF/text upload
  affordance; add a "📋 Dialect glossary" import mode.
- **Parse client-side** (deterministic, no LLM): detect delimiter, header row, and which column is
  dialect vs High German (heuristic + a tiny mapping UI: "Column 1 = Bairisch, Column 2 = Deutsch").
  Drop empty rows; trim; keep an optional 3rd "note" column.
- Result → `dialect.glossary[]`. **No model call needed to import.**
- Validation surfaced to the user: row count, duplicates, empty cells — so they trust what went in.

### B. Parallel-text importer (extends existing user-story path)
- Reuse `userStory` (dialect text) + `userTranslation` (High German) with `userStoryLang:'target'`.
- **Alignment**: split both into sentences; if counts match, pair 1:1 (deterministic). If they
  differ, *that* is the one place an LLM helps — a constrained "align these dialect sentences to
  their German translations, output index pairs only" call (cheap, low-risk, no text generation).
  Fall back to paragraph-level pairing if alignment is low-confidence.

## Lesson generation (faithful)

Add a generation mode `fromDialectMaterial` that builds lessons **without inventing dialect**:

- **Vocab lessons** ← glossary rows directly: `{ target: row.d, source: row.g }`. Zero LLM. This is
  just the existing vocab lesson shape populated from rows. Difficulty buckets by row order or a
  frequency/length heuristic (like the script-letter cap).
- **Sentence lessons** ← aligned parallel-text pairs: `{ target: dialectSentence, source: germanSentence }`.
  Zero LLM (alignment already done).
- **Example sentences for glossary words (OPT-IN, M1.5):** only if the user ticks "make example
  sentences," and only via a *tightly constrained* prompt seeded with the glossary as few-shot so
  output mimics the uploaded orthography. Mark these items `aiGenerated:true` and **force them
  through QC + the flag/star review** before they're trusted. Off by default.
- **word_forms / synonyms**: NOT in M1 for dialect (they require the model to reason about dialect
  morphology/synonymy — unreliable). Defer.

The existing `dialectNote` stays, but its role is **demoted to a styling hint** for the optional
example-sentence path, never the authority for vocab/sentence content.

## LLM use in M1 — summary (kept minimal + safe)
| Step | LLM? | Risk |
|---|---|---|
| Import glossary table | No | none (deterministic parse) |
| Vocab lessons from rows | No | none |
| Sentence lessons from aligned pairs | No | none |
| Parallel-text alignment when counts mismatch | Yes (index-only) | low (no generation) |
| Example sentences for glossary words | Yes, opt-in | medium → gated by QC + flag review |
| Dialect story generation | **No — deferred to M2** | high |

## QC for dialect (reuse Plan C dispatch)
- Vocab/sentence pairs from uploaded material are ground truth → QC can **verify the German side**
  (`qcCheckPair`) but should **not** "correct" the dialect side (the model isn't an authority).
  Add a `qcDirection:'sourceOnly'` flag for dialect lessons so QC flags a suspect German gloss but
  never rewrites the dialect token.
- AI example sentences (M1.5) → full QC + human flag/star, like any generated content.

## UI
- Landing form: a "🗣 Dialect" entry that opens a small panel: name the dialect, pick base (de),
  paste/upload glossary and/or parallel text + translation, optional note. Produces a dialect
  topic.
- Lesson rendering: dialect side `dir="auto"`, no TTS button (or a clearly-labeled "read with
  standard German voice — approximate" toggle, default off).
- Saved-list: dialect topics badged with the dialect label.

## i18n
New en-only keys (form labels, importer, badges): `dialect.*` (panel title, base-pick, glossary
upload, parallel-text upload, column-mapping, row-count, the "approximate voice" warning, the
"AI example — unverified" badge). List them for the translate pass; numbers/labels stay en-only
until the feature lands.

## Tests (headless where possible)
- Glossary parser: TSV/CSV/2-col/markdown → rows; delimiter + header detection; empty/dup handling.
- Vocab-from-rows + sentences-from-pairs builders produce valid lesson shapes (no LLM).
- Sentence aligner: equal-count → 1:1 deterministic; the LLM-align path stubbed (verify it's only
  called on mismatch and only consumes index pairs).
- QC `sourceOnly` direction: dialect lessons never get a `T:` (dialect-side) rewrite.

## Milestone boundary
- **M1 (this spec):** faithful lessons from uploaded glossary/parallel text. No invented dialect.
- **M1.5:** opt-in AI example sentences, gated by QC + review.
- **M2 (separate spec):** generated dialect stories — only per-dialect after `curated:true`
  (human/native review of sample output), seeded with the uploaded material as few-shot, clearly
  labeled AI-generated, routed through QC + flagging. High risk; not started.

## Decisions locked (user, this round)
1. **Upload shape: glossary tables first.** Build order: table importer → vocab-from-rows → (parallel
   text + alignment is a later step). The importer is the critical path.
2. **Pilot dialect: East Tyrolean (Osttirolerisch)**, a southern-Austrian variety with Slavic-
   influenced vocabulary → `base: "de"`. The Slavic loanwords are exactly what the model does NOT
   know, so they validate the "rows are ground truth, model never authors" spine. Real material to
   be supplied later.
3. **Direction: target = dialect, source = High German** (`source: "de"`). Learner sees a dialect
   prompt, reads/answers in High German. ⇒ the **German side is the gloss authority** (QC verifies
   German; the existing `de` voice handles the source side). Glossary column default:
   **Col 1 = Osttirolerisch (target), Col 2 = Deutsch (source)** — matches natural typing order.
4. **TTS: approximate German voice, ON as a labeled toggle** ("≈ German voice (approximate)"),
   default-on but clearly marked so a learner isn't misled into thinking it's authentic. To be
   *evaluated* on real words — East Tyrolean phonology diverges enough that distinctive/Slavic words
   will sound rough; testing beats guessing, and `base:"de"` gives `de-DE` for free.
5. **Glossary is three columns:** `dialect | High German | optional note`. The **note** (mood,
   register, usage — e.g. "derb", "veraltet", "nur Pustertal") is stored on the vocab item
   (`item.note`), shown in the editor and as a small hint on the card. It is **metadata only —
   never sent to the model as content.**
6. **One row = one vocab item, verbatim.** No splitting, no multi-sense expansion, no model
   involvement in import. A dialect word whose German side is a phrase or has several senses is kept
   exactly as the row was typed (put multiple senses on separate rows if desired). This is the
   faithfulness guarantee.

## Importer parsing rules (M1, deterministic — no LLM)
- Accept paste or file: TSV / CSV / Markdown table / 2–3 column whitespace-aligned text.
- Detect delimiter (tab > comma > 2+ spaces / `|`), optional header row (skip if it looks like
  "dialect/deutsch/…" labels), trim cells, drop fully-empty rows.
- Map columns: default **1→target(dialect), 2→source(de), 3→note**; show a one-line confirm UI so
  the user can re-map if their file is ordered differently. Never auto-guess past 3 columns.
- Per-row → `{ target: col1, source: col2, note: col3||undefined }`. Verbatim; no normalization
  beyond trim. Report row count, dropped-empties, and duplicate `target` values back to the user.
- Duplicates are **kept** (a dialect word with two senses is two rows) but surfaced so the user can
  spot accidental dupes.

## Vocab item shape (dialect)
`{ target, source, note?, _dialect:true }` — `_dialect:true` marks the item so: (a) QC runs
`sourceOnly` (verify/▲flag the German, never rewrite the dialect `target`); (b) the card shows the
optional `note` hint; (c) TTS uses the approximate-voice toggle rather than a real target voice.
