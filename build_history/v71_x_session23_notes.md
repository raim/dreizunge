# v71_x — session 23 notes

A design principle from the user, and its first application.

Suite **158** (+1), `check-inline` 0 on both builds.

---

## 1. The principle

> **No language knowledge in the code.** Producing correct language content is the model's job —
> instruct it in the prompt instead.

Recorded in `INTERNALS.md` ("Design principle") and in the roadmap's standing rules.

The line I drew, and flagged for confirmation: this covers anything deciding whether content is
**correct** — article lists, gender, pronouns, inflection, "which languages use articles",
sentence-final punctuation. It does *not* cover mechanical/typographic facts deciding how text is
**handled** — Unicode normalisation, script/RTL detection, diacritic folding for comparison. Those
are properties of the encoding, and the model cannot help with them at runtime.
**The test: does this decide whether content is right, or only how it is displayed/compared?**

## 2. The code already violated it, in two places

Inventoried before changing anything.

**`normalizeVocabArticles` (`server.js`) — the harmful one, NOT fixed here.** Runs on every
generated lesson, holds article lists for 12 languages, and prescribes a direction. Traced against
real corpus data:

```
la grandine / hail       → becomes:  grandine / hail
il tempo / the weather   → untouched (symmetric)
```

It strips the gender an Italian learner needs while symmetric siblings in the same lesson keep
theirs — **the code makes the lesson less consistent than it found it.** Left alone deliberately:
it exists because in `v71_d` the model obeyed the "no one-sided article" rule only per call, so
removing it bets that the prompt alone now holds, and only a live generation run can settle that.
Logged as `[NEXT — principle debt]` with three options.

**`ARTICLE_CHOICES` (`index.html`) — removed.** See below.

## 3. Removing the table made the app BETTER, which I did not expect

My first assessment was wrong and I checked it rather than shipping it. I told the user the
data-derived fallback was "safe, no decision needed" because the code already had
`|| [...new Set(items.map(x => x.article))]`. Measuring showed removing the table would leave **6 of
20** grammar lessons unable to build an article MCQ at all.

But measuring *which* six reversed the conclusion. Only **one** was covered by the table (`de`); the
other five were `en`/`he`, which the table never covered — so they already built none. And a
**corpus-derived** fallback does better than either:

| | article MCQs build |
|---|---|
| old hardcoded table | 15 of 20 |
| `_articleChoicesFor` (corpus-derived) | **19 of 20** |

The table covered de/fr/it/es/pt/nl/ru and nothing else, so English lessons could never build one.
Drawing on every article the model has actually produced gives `en` a/an/the — four lessons gained
an exercise. Hebrew still builds none, correctly: one definite article, no indefinite — a fact
**nobody had to write down**, which is the principle paying for itself immediately.

Also gone: `ru: ['м','ж','с']`, gender labels standing in for articles — the clearest case of the
code holding a theory about a language. And `de: ['der','die','das']` was nominative-only, wrong the
moment a lesson uses another case.

## 4. It also blocks the vocab QC item

The article-mismatch rule needs exactly the per-language table the principle rejects. The evidence
is this session: **two attempts at such a table were both wrong** — `le` matched the prefix of
`legge`, and a missing English entry made 19 perfectly symmetric `il tempo`/`the weather` pairs look
like violations. Either would have "fixed" correct data.

The corpus makes it worse: of 131 asymmetric pairs, **99 are `ar<-en`**, where Arabic definiteness
is the bound prefix `ال` and no word-splitting rule applies. Marked BLOCKED with the measurements,
and the note that it should be model-backed or not at all. The umlaut rule is unaffected — it
compares corpus forms against each other and encodes no rule about German.

## 5. Two test traps hit

**A negative assertion matched its own explanation.** `!/ru: \['м','ж','с'\]/` failed because the
comment explaining the removal quotes the deleted entry. Same trap as `v71_t`'s `MAX_STORY_CHARS`.
Pin against CODE (anchored `^\s*`), not prose.

**Cross-realm arrays.** `assert.deepStrictEqual(x, [])` fails on values returned from the vm
sandbox: an array built inside it has a different `Array.prototype`, so the prototype check fails
even when contents match. Compare `.length` or element-wise. Added to `INTERNALS.md`.

## Revert-verified

Restoring the table fails with the number: `article MCQs build in at least 19 lessons (got 15);
the removed table managed 15`.

## How to see it work

Open a **grammar** lesson in an English-target chapter — e.g. *Von A bis Z* or *Das kleine Ich bin
ich*. Before this release those built no 🏷️ article questions at all, because `en` was not in the
table. They now ask them, with a/an/the drawn from the corpus.

German lessons are unchanged in behaviour (der/die/das are what the corpus contains); the difference
is that the choices are now evidence rather than assertion.

## Still owed

**Confirm the principle's boundary** (§1) — I drew it at correctness-vs-handling and want that
checked. `_sentenceUnits` splitting on `.!?…` sits right on the line: punctuation is arguably
typographic, but it decides where a sentence *is*. Flagged, not filed.

**`normalizeVocabArticles` decision** — delete and strengthen the prompt / flag without rewriting /
leave and revisit. Wants a live generation run.

Unchanged: browser passes on `v71_i`–`v71_x` · the `v71_t` live comprehension check · `NUM_CTX_MAX`
in practice · translate queue **380** · duplicate grammar targets · drill result card.
