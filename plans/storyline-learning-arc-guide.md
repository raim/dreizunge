# Building a good storyline learning arc (Dreizunge)

A *learning arc* is a chained storyline where each chapter does three things at once:

1. **Reinforce** vocabulary from earlier chapters (spaced repetition),
2. **Introduce** new vocabulary, and
3. **Practice using** it — the grammar (noun forms) and conjugation (verb forms) of words the learner has met.

The story is the carrier; the lessons are the curriculum riding on top of it. This guide
explains how to get a good arc with today’s features, and proposes how to automate it —
including the goal-oriented case: *“teach me enough to read this PDF.”*

---

## 1. The three levers

Everything below is built from three mechanics (see `lesson-generation-paths.md` for the internals):

### a) Chaining
Generate each chapter as a **continuation** of the previous one (the web form’s “continue
from” / the chain link). This gives two things: the story flows on from where it left off,
and the generator gains access to **chain vocab** — the accumulated vocabulary of all prior
chapters (`collectChainVocab`).

### b) `vocabMode` — the spiral control
This decides what the chain vocab *does*:

| Mode | Effect | Use it for |
|---|---|---|
| `neutral` | chain vocab ignored; each chapter is independent | one-offs, not arcs |
| **`reinforce`** | **prefer prior words where they fit, *and* add new ones** | the backbone of an arc — reuse + grow |
| `extend` | **avoid** prior words (exclusion list) → only new vocab | a “breadth” chapter, or late-stage variety |

`reinforce` is the key: it is *not* “repeat only” — the lesson still introduces fresh
vocabulary, but weaves in earlier words where the story allows. That reuse-plus-growth is
the spiral.

### c) Lesson-type mix
- **standard** (vocab + sentences) → introduce/reinforce vocabulary (base forms).
- **grammar** → practice the *derived noun forms* (gender/article/plural) of story words.
- **conjugation** → practice the *conjugated verb forms* used in the story.
- **all_types** → all of the above in one chapter (vocab + grammar + conjugation + error-hunt).

Because grammar/conjugation in `reinforce` mode prefer prior **nouns/verbs**, they become the
“use what we learned” step — drilling the inflections of words the learner already knows.

---

## 2. A recommended arc recipe (manual, works today)

Per chapter, in the web generation form:

1. **Continue from** the previous chapter (chain it).
2. Set **lesson format = `all_types`** (vocab + grammar + conjugation + error-hunt in one go).
3. Set **vocab mode = `reinforce`**.
4. **Ramp difficulty**: chapters 1–2 at difficulty 1, middle chapters at 2, final chapters at 3.
5. **Grow story length** gradually (e.g. 120 → 180 → 250 words) so reading load rises with competence.
6. Keep a consistent **style/dialect** across the arc so register stays stable.

What this produces: a connected story where each chapter re-meets earlier words, adds a new
batch, and drills the grammar/conjugation of the growing pool — difficulty rising as you go.

> **Tip — pacing new vocab.** Standard lessons add ~8 new words/chapter. For a tight arc,
> 5–8 chapters gives ~40–60 core words plus their forms. If you want a “consolidation”
> chapter with little new material, use `reinforce` with a short story; for a “breadth”
> chapter, switch that one to `extend`.

---

## 3. Doing it in batch

- **`translate-lessons.js`** — already chains chapters of a template into one storyline. To make the *translated* arc spiral, it should pass `vocabMode: reinforce` (today it’s neutral); see §5. Good when you have a source storyline you want in another language.
- **`generate-lessons.js`** — generates *independent* topics per language pair (no chain). It’s for breadth across languages, not for a single arc.
- **PDF “book”** — chains chapters from your text, but currently `neutral` + a single format. It gives narrative continuity, not yet a spiral (§4–5).

---

## 4. The goal-oriented case: “understand this PDF by the end”

Here the arc has a **target**: the vocabulary and grammar needed to read the PDF. The ideal
shape:

```
[warm-up chapters: foundational / most-frequent words]  →  reinforce + grow
        ↓
[build-up chapters: the PDF’s domain vocabulary, introduced in frequency order]
        ↓
[finale: the actual PDF text as the last chapter(s)]  ← learner already knows most words
```

By the time the real PDF text arrives, `reinforce` has already taught most of its words, so
the final chapters are comprehension rather than cold reading.

The current book generator doesn’t do this — it chops the PDF into chapters and generates
each independently. Turning it into a goal-oriented arc is the automation opportunity.

---

## 5. Proposed automation (staged)

### Stage A — Quick win (small change): make the book path spiral
Flip the per-chapter options in the book/PDF generator from `vocabMode: null` to
**`reinforce`**, default the format to **`all_types`** (or expose both as toggles in the
PDF dialog), and keep `useFullChain` so each chapter sees the whole story so far. This alone
turns “chained chapters” into a real arc with almost no new code. Likewise pass
`vocabMode: 'reinforce'` from `translate-lessons.js`.

*Effect:* every chapter reinforces prior vocab, adds new, and drills grammar/conjugation —
the arc behaviour, applied to any pasted text or PDF.

### Stage B — Goal-oriented PDF arc (the interesting one)
A planner that targets comprehension of the PDF:

1. **Extract the target vocabulary** from the PDF (content words, frequency-ranked; `extractKeywords` is a starting point, ideally lemmatised to base forms). This is the “syllabus”.
2. **Order it** foundational/frequent → rare/specialised, and **bucket** it into chapter-sized batches (~6–10 new words each).
3. **Generate warm-up + build-up chapters** that each introduce one batch via `all_types` + `reinforce`, so earlier batches keep recurring. Stories can be short, themed around the batch, all chained.
4. **Track coverage**: keep a running set of “taught” lemmas; ensure every target word is introduced before the finale (optionally a coverage report: “94% of the PDF’s content words covered”).
5. **Finale**: append the real PDF text as the last chapter(s) with `reinforce`, so it reuses the taught pool — now a comprehension exercise.

Implementation could be a new script (`build-arc.js`, mirroring the existing batch tools:
analyse → plan → drive `/api/generate` chapter by chapter, resolving ids like
`translate-lessons.js`) or a server endpoint (`POST /api/generate-arc`) reusing the book-job
machinery. The planner (steps 1–2, 4) is LLM-light — mostly tokenising/ranking — with the
heavy LLM work being the per-chapter generation that already exists.

**Open design questions worth deciding before building:**
- *Difficulty curve* — fixed ramp (1→2→3) vs. tied to coverage progress?
- *Batch size / chapter count* — derive from PDF vocabulary size, or fix a target length?
- *Lemmatisation quality* — `extractKeywords` is frequency/stopword-based, not a POS tagger; good lemma grouping (so “laufen/läuft/lief” count as one target) needs either better heuristics or an LLM pass.
- *Coverage threshold* — 100% is unrealistic for a real PDF; pick a sensible target (e.g. cover the top-N frequent content words).

---

## 6. Pitfalls

- **Neutral chaining isn’t an arc.** A chained storyline with `vocabMode: neutral` looks connected but doesn’t reinforce — the most common reason an arc feels flat.
- **Small models drift.** With long `useFullChain` context, smaller models may lose the thread or under-reinforce; keep stories moderate and verify a chapter or two.
- **“Reinforce” needs words to reuse.** Chapter 1 has nothing prior, so the spiral only becomes visible from chapter 2+.
- **QC the arc.** Run QC (storyline-level 🔍) after generating — across many chapters, a few bad pairs or capitalization slips are likely; fix them before the arc is “done”.
- **Vocab base forms vs. story forms.** Vocab lists teach citation forms; grammar/conjugation teach the inflected forms from the story. That split is intentional — don’t “fix” a vocab list to match an inflected story word.
