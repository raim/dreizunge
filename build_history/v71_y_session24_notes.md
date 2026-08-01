# v71_y — session 24 notes

Article symmetry moves from a deterministic rewriter to the QC pass. Closes the
`[NEXT — principle debt]` item created in `v71_x`.

Suite **158** (unchanged count; `unit-vocab-articles` rewritten), `check-inline` 0 on both builds.

---

## 1. What was removed

`VOCAB_ARTICLES`, `VOCAB_ELISIONS`, `splitArticle`, `normalizeVocabArticles` — ~2,300 characters of
article lists for 12 languages plus elision forms, running on **every generated lesson**.

Two faults, and the second is the one that mattered:

- **It encoded language knowledge** — the session-23 design principle.
- **It could only ever STRIP.** `la grandine` / `hail` became `grandine` / `hail`, dropping the
  gender an Italian learner needs, while symmetric siblings in the same lesson (`il tempo` /
  `the weather`) were untouched. The code made lessons *less* consistent than it found them.

## 2. What replaces it

Article symmetry is now check **(3)** inside `qcCheckPair`, the existing per-pair QC. This needed no
new machinery: that pass already runs one model call per vocab pair, writes `qc:{sug, field, at}`,
clears the flag when an item is fixed, and surfaces through the per-item flag UI.

Three properties the deterministic version could not have:

- **It sees the lesson's convention.** Up to 6 sibling pairs go into the prompt verbatim, marked
  *context only, do NOT correct them*. The convention is SHOWN rather than asserted — telling the
  model "Italian uses articles" would be the same language knowledge wearing a different hat.
- **It can fix either side.** `qc.field` already supported `'target'` | `'source'`, so this was
  wiring, not new capability. The right fix for `la grandine` / `hail` is to ADD "the", matching the
  lesson's symmetric siblings — the stripper structurally could not propose that.
- **It proposes, never rewrites.** A wrong call lands in the flag UI instead of silently in the data,
  which is the whole lesson of what was removed.

Bound definiteness markers (Arabic `ال`) are handled as a **stated property** — "if a language marks
definiteness with an attached prefix or suffix rather than a separate word, that is NOT a lone
article" — rather than by omitting Arabic from a table. It therefore holds for languages nobody
listed. This matters: 99 of the 131 asymmetric pairs in the corpus are `ar<-en`.

The generation prompts (`vocab`, `vocabFromText`, `vocabTable`) still require symmetry, so QC is the
safety net rather than the only defence. That ordering is why a *proposing* check is the right
shape: the defect is rare enough that occasional review beats automatic rewriting.

## 3. The `v71_d` guard, rewritten rather than deleted

`unit-vocab-articles` tested the functions I removed, so it failed — correctly. Its fixture is the
user's **real** export from storyline sl_15116115: 64 items, 42 asymmetric, per-chapter
`8,6,7,0,0,8,8,5`.

That measurement is kept. §1 now uses a **test-local** detector, and the file says why that is not a
breach of the principle: it measures a fixed, known dataset to keep a bug report on record — it
never runs against user data and never decides what the app produces. The moment such a table
decides content it belongs to the model instead. (Two attempts at writing one in session 23 were
both wrong, which is the argument in miniature.)

The per-chapter shape is also the clearest evidence for the new design: `8,6,7,0,0,8,8,5` is
all-or-nothing per chapter, i.e. the model decides per CALL. A per-item deterministic rule was the
wrong shape from the start.

§2–4 now assert the new arrangement: the rewriter is gone, QC covers symmetry with sibling context
and both-sides capability, the call site actually passes the siblings, and generation still demands
symmetry.

**What this file cannot prove**, stated in it: whether the model actually *catches* an asymmetric
pair. That needs a live QC run against a real backend.

## Revert-verified

| revert | assertion that fires |
|---|---|
| siblings not passed to `qcCheckPair` | the vocab QC call site passes the lesson's items as context |
| symmetry check removed from the prompt | the pair check covers article symmetry |
| `VOCAB_ARTICLES` reintroduced | VOCAB_ARTICLES is gone — it encoded language knowledge and could only ever strip |

## How to see it work — and this one genuinely needs you

1. Generate a multi-chapter storyline in a pair where the source language has articles
   (Italian from German is the reported case). Chapters should now come out symmetric *from the
   prompt alone* — that is the bet this release makes, and the thing to confirm.
2. If any pair is asymmetric, run **QC** over the storyline. The item should get a ⚑ suggestion
   proposing the fix that matches its lesson's convention — including, where appropriate,
   **adding** an article rather than stripping one.
3. Spot-check an Arabic chapter: `ال`-prefixed words must NOT be flagged as one-sided articles.

Point 3 is the one I would check first — it is the case the old table handled by omission and the
new prompt handles by description.

## Deliberately not done

- **No auto-apply.** QC proposes; the user accepts. Reverting to automatic rewriting would restore
  exactly the defect just removed.
- **No separate QC call for articles.** Folded into the existing pair check — a second pass would
  double the cost of a QC run for a defect class that is 131 items corpus-wide.
- **No language-rules data file.** Considered and rejected this session (see the tier list in
  `INTERNALS.md`): a file relocates the authorship problem rather than solving it. Revisit only if
  a genuinely LLM-free path needs linguistic data, as `scripts.json` does.

## Still owed

The live checks above · browser passes on `v71_i`–`v71_y` · the `v71_t` live comprehension check ·
`NUM_CTX_MAX` in practice · translate queue **380**.

**Open question for the user:** confirm the principle's boundary (correctness vs. handling).
`_sentenceUnits` splitting on `.!?…` sits on the line — punctuation is arguably typographic, but it
decides where a sentence *is*. Still flagged, not filed.

Code items ready: duplicate grammar targets (`v71_r`) · drill result card.
