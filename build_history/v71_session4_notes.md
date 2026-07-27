# v71_d — session notes (vocab articles, {lang} grammar, pass-mark lock)

Four user reports, three fixed, one answered diagnostically. Suite **144** (was 142), `--quick`
**124**, `check-inline` 0 on both builds, static rebuilt, both report `v71_d`.

---

## 1. ✅ Vocab articles: asymmetric in one lesson, fine in the next

> "We still get a lot of lessons with articles in one language but not the other… In the most recent
> 8 chapter storyline sl_15116115, some lessons have this problem, while others don't; what could be
> the reason for that?"

### The measurement

Taken from the user's own `lessons.json`, storyline `sl_15116115` (Italian from German, 8 chapters
generated from one PDF):

| chapter | asymmetric | what it looks like |
|---|---|---|
| ch1 | **8/8** | `teoria` / `die Theorie` |
| ch2 | 6/8 | the 2 clean items are adjectives — correctly article-less |
| ch3 | 7/8 | |
| **ch4** | **0/8** | articles on **both** sides — `la base` / `die Grundlage` |
| **ch5** | **0/8** | articles on **neither** — `fenomeno` / `Phänomen` |
| ch6 | 8/8 | |
| ch7 | 8/8 | |
| ch8 | 5/8 | the 3 clean items are verbs/adjectives |

**42 of 64 items asymmetric, and never once reversed** — zero items had an Italian article without a
German one.

### The answer

The split is **per chapter, all-or-nothing** — not scattered across items. Each chapter is a separate
generation call, and the model picks an article convention fresh each time: ch4 chose "both", ch5
chose "neither", the other six chose "German only". Within a call it is consistent; across calls it
is a coin flip.

The decisive detail: **the prompt already forbids this.** `PROMPTS.vocab` and `PROMPTS.vocabFromText`
both say *"never an article on one side only. If either language does not use articles, omit them on
both sides."* So the missing piece was never instruction — it was **enforcement**. And the QC pass
(`translategemma:12b`) ran on ch1, ch5 and ch8 while leaving ch1 fully asymmetric, so QC does not
check articles either.

### The fix

`normalizeVocabArticles(vocab, lang, srcLang)` in `server.js`, hooked at the single point where every
generation path finalises `lesson.vocab` (right after the dedupe, before the identical-field check).
It logs what it changed.

**Policy: STRIP the lone article, never add the missing one.** Adding needs the target noun's gender,
which cannot be derived without a model and would become a second place for gender to be wrong.
Stripping needs nothing and is always safe. Gender is taught by the dedicated `grammar` lesson type,
which carries its own `article` field and is untouched by this.

Two details worth keeping:

- **A single token is never an article.** `die` is a German article *and* an English verb; `la` is
  Italian for "the" *and* a musical note. Stripping a lone token would delete the vocab item itself.
- **Arabic is deliberately absent from the table** even though it has ال-: it is a bound prefix, not
  a separate word, so stripping it would corrupt the word. Languages with no table count as
  article-less, which matches the prompt's own rule.

**Test fixture is the real data** — all 64 items exported from the user's storyline. 42 → 0, with
ch4 and ch5 asserted untouched.

### Also found, NOT fixed

**9 vocabulary items are duplicated across chapters of this one storyline**, and 4 are taught twice
with *different* conventions: `legge` (ch1) vs `la legge` (ch4), `variazione` (ch6) vs
`la variazione` (ch4), `evoluzione` (ch7) vs `l'evoluzione` (ch4), plus `fenomeno`, `mutazione`,
`teoria`, `fattore`, `specie`, `cambiamento` repeated verbatim. The article normalisation makes the
*forms* consistent but does not stop the repetition. `PROMPTS.vocab.prevHint` already passes prior
vocab to the model, so the hint exists and is being ignored — a separate change. Logged in the
roadmap.

---

## 2. ✅ `{lang}` produced ungrammatical sentences

> "ex.read_translate.q: 'Übersetze diesen {lang}-Satz'. Here it is often not grammatically correct to
> just replace by {lang}. Just remove {lang} and find similar cases."

`{lang}` interpolates a language **name** — a noun (`Italian`, `Italienisch`, `Italiano`). Used
**attributively** it modifies a following noun and must agree with it: German needs
*"diesen italienischen Satz"*, Italian *"questa frase italiana"*. A noun in that slot cannot be
rescued by the translator either, because the placeholder is filled at runtime — the bug is in the
**shape** of the string, not the translation.

**Seven strings were attributive.** Removed where the language is obvious from context, made
**prepositional** where the information matters:

| key | was | now |
|---|---|---|
| `ex.read_translate.q` | Translate this {lang} sentence: | Translate this sentence: |
| `ex.listen_mcq.q` | …choose the {lang} meaning: | …choose the meaning: |
| `ex.listen_type.q` | Type the {lang} word you hear: | Type the word you hear: |
| `tts.approx_dialect` | ≈ {lang} voice (approximate) | ≈ approximate voice for {lang} |
| `tts.no_voice_silent` | No {lang} voice installed… | No voice installed for {lang}… |
| `tts.no_voice_hint` | No {lang} voice is installed… | No voice is installed for {lang}… |
| `form.translation_placeholder` | Paste the {lang} translation | Paste the translation ({lang}) |

**203 stale translations removed** across 29 languages — they embed the broken shape (the German ones
*were* the reported bug), and `t()` falls back to English cleanly until the translate pass reruns.

### What the guard taught me

My first detector flagged Turkish `{lang} içinde`, Korean `{lang}로`, Hindi `{lang} में` and Chinese
`在{lang}中` — all **postpositional and correct**. Those languages place the role-marking particle
*after* the noun, which is indistinguishable from an English-style modifier without parsing.

**Cross-language attributive detection is not automatable.** So the guard now:

- checks the **English source** strictly (every translation derives from it), with an explicit
  2-key allowlist for legitimate verb-object uses — `"may not handle {lang} well"`,
  `"learn {lang} for?"` — and an assertion that the allowlist has not quietly grown;
- replaces the cross-language attributive check with a **language-neutral staleness check**: no
  translation may interpolate `{lang}` for a key whose English has dropped it.

A short explicit allowlist keeps the guard strict; a clever heuristic would not.

---

## 3. ✅ Below the pass mark, Next is now locked

> "What happens when the user presses next, but hasn't yet passed the pass mark threshold? …the next
> button could be grayed out and inactive, instead of showing a separate 'Mach weiter' card.
> However, the 'Mach weiter' phrase could be used instead of the 'Lektion abgeschlossen'."

Half of this already worked: it is the **same card**, and the title already switched to
`complete.keep_going` ("Keep going!" / "Mach weiter") when below the mark. There was never a separate
card.

What was missing is exactly the other half. Next was **silently repurposed** — below the mark it
became ↻ Repeat, or 🎯 Drill if no replay existed — so the one button a learner reads as "forward"
meant three different things by state, and the standalone Repeat button *hid itself* to avoid showing
two ↻ icons. v70_g's own comment already said the learner should "pick among repeat, drill, crossword
… instead of Next silently meaning one of them"; **the code had drifted from its own stated design.**

Now: one below-mark branch, Next disabled + greyed with a tooltip naming the required percentage
(`complete.next_locked`), and Repeat / Drill / Crossword each showing as themselves. Two unreachable
branches (29 lines) and the two vestigial `_nextIsRepeat` / `_nextIsDrill` flags removed rather than
left permanently false.

**One nuance found while testing:** the lock only applies once **every lesson in the chapter has been
played**. While lessons remain, Next legitimately moves forward *within* the chapter — which is what
v66.1's rule actually says ("no branch below the mark advances to the **next chapter**"). The test
fixture had to be corrected to reach the real state; the first version silently tested the wrong one.

### Four existing suites encoded the old behaviour

`unit-drill`, `unit-learner-nav`, `unit-coverage-threshold` (§5b and §5c) and `smoke-render` all
asserted the exact expressions and branch ordering that changed. Each was rewritten to assert the
**surviving guarantee** rather than deleted:

- **v66.1** — below the mark Next never advances. Now enforced at the button itself, which is
  strictly stronger than a branch that had to be ordered correctly.
- **v69.2** — the learner is never dead-ended. Rewritten as: at least one route up
  (repeat / drill / crossword) is visible, and the coverage replay is still reachable via
  `repeatForCoverage`. **This assertion must never soften** — it is the one three user reports were
  about.
- **v70_g** — no two visible action buttons share an icon. This is the property the `_nextIsDrill`
  flag was protecting by hand; it is now checked directly on the rendered card instead of by
  regexing the source for a flag.

---

## 4. ⏳ Repeat focus — answered, not implemented

> "If we press the 'repeat' button, does it focus on vocabulary from the current lesson that we
> haven't seen yet? The focus could be stronger."

**It depends on the lesson type, and the user's instinct is right.**

- **`mixed` lessons: yes, strongly.** The builder computes `needed = ceil(target × universe) − solved`
  and collects *exactly* that many distinct **unsolved** qids from earlier siblings, re-deriving each
  builder up to 40 times to converge (builders sample, so one derivation surfaces only a subset).
- **`classic` lessons: no.** `repeatForCoverage()` → `_firstCoverageShortLessonIdx()` →
  `startLesson(idx)` lands on a classic lesson, whose round builder just re-samples. The code comment
  admits it: *"rounds re-sample on every play, so fresh questions advance coverage."* Random
  re-sampling means already-solved questions can be re-shown while unsolved ones stay unseen.

The machinery to fix it already exists (`_lessonQidUniverse`, `_solvedMap`, `qid`) and is
typeof-guarded for the unit harnesses. The change is to apply the same unsolved-first preference in
the classic round builder. **Not attempted this session** — it is a sampling change in the round
builder, deserves its own change with a coverage-convergence test, and the session had already
touched the completion card.

---

## i18n — 1 new key + 7 rewritten, `en` only

New: `complete.next_locked` — `'Reach {pct}% solved to continue'`.
Rewritten: the seven in §2. **203 stale translations deleted** and owed to the translate pass.

## Owed

- **Browser pass** on the locked Next (greyed, tooltip, Repeat visible, "Keep going!" title) and on
  everything still owed from `v71_b` / `v71_c`.
- **Repeat focus** (§4) — the actual fix.
- **Cross-chapter vocab duplication** (§1) — 9 repeats in one storyline, 4 with clashing forms.
- **Re-translation** of the 7 rewritten strings + the 12 keys from `v71_b` + 1 from `v71_c`.

---

# v71_e — translation merge

The user supplied `ui_json.bak`: an older `ui.json` carrying **new translations** but predating the
`v71_d` string changes. Merged into the current file.

## What the two files actually differed by

Checked before merging rather than merging and hoping:

- **The only differing VALUES anywhere were the 7 English strings `v71_d` rewrote.** No translation
  value differed on any shared key, in any of the 29 languages — so the merge was purely additive on
  the translation side and could not silently overwrite anything.
- The backup's apparent "+7 keys per language" was **exactly** the 7 keys `v71_d` deleted. A naive
  merge would have restored all 203 stale entries — i.e. reintroduced the reported bug
  (`Übersetze diesen {lang}-Satz`) in every language at once, while the English above it stayed
  fixed and the guard for four of the seven did not yet exist.

## Merge policy

Base = current `ui.json` (English authoritative). For each non-English language, add keys the current
file lacks; **never overwrite an existing value**; **hold back the 7 rewritten keys**.

| | count |
|---|---|
| translations added | **30** |
| stale entries held back | **203** (7 keys × 29 languages) |
| value conflicts | 0 |
| keys lost vs. before | 0 |

Gained: **`crossword.done` in 7 languages** — the roadmap listed this as "translated nowhere", so
that gap is now closed for nl/pt/fr/de/it/pl/es — and **Polish +24 crossword strings** plus
`acct.insecure`, `complete.repeat`, `teacher.render_error`, taking `pl` from 532 to 556 keys.

## Guard widened

`unit-lang-placeholder` pinned only 3 of the 7 rewritten keys against re-translation. **A merge is
the most likely way for the other 4 to come back**, and this merge offered to do exactly that, so all
seven are now pinned. Revert-verified by merging a single stale entry back in: fails as
`tts.approx_dialect: stale translations stay cleared until re-translated`.

## Coverage after the merge

577 English keys. Best-covered languages (nl, pt, fr, de, it, pl, es) are at 556 — missing 21. The
other 22 languages sit at 532 — missing 45. **1137 entries outstanding** overall, of which 203 are
the deliberately-cleared `v71_d` rewrites awaiting re-translation.
