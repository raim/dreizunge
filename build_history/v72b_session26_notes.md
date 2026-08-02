# v72_b — session 26

Baseline in: **159 checks, 3 RED.** Baseline out: **160 checks, all green**
Shipped: `v72_a` … `v72_e`. `APP_VERSION` = `v72_e`.
(`--quick` 139), `check-inline` 0 failures on `index.html` and `docs/index.html`,
`docs/` rebuilt and byte-verified.

---

## 1. The red baseline was three different things

The handover said `ui.json` had been refilled. Archive timestamps said more than that:
code cut at 07:24, **`lessons.json` changed at 09:17**, `ui.json` at 11:19, `docs/` rebuilt
at 11:21. The corpus had moved too, and nobody had mentioned it. Treating all three failures
as "the translate pass landed" would have been wrong for one of them.

| check | cause | verdict |
|---|---|---|
| `unit-model-settings` | translate pass | guard wrong, data right |
| `unit-ui-verbatim-en` | translate pass | guard right, **data defective** |
| `smoke-render` | corpus moved at 09:17 | **code right, fixture drifted** |

### 1a. `unit-model-settings` — the case the roadmap predicted

It asserted `prov.by` / `prov.from` were absent from every non-`en` language. They were deleted
in `v71_q` *so that* the offline pass would refill them against the new English. The pass ran, so
the guard fired. This is DoD §3 verbatim: *a test asserting a key is "en-only" is correct while the
key is new and wrong once it has been translated.*

Checked the refill before trusting it: all 29 languages carry the `{user}` placeholder, and **no**
language renders the two provenance labels identically — which was the actual `v71_q` defect
(German showed both as "von"). Now `Benutzer: {user}` / `Quelle`.

Restated in the durable form: not missing, placeholder intact, and **not colliding**. Verbatim-English
is left to `unit-ui-verbatim-en` rather than duplicated here, so the two cannot drift.

### 1b. `unit-ui-verbatim-en` — a real defect in the returned file

- `models.threads = "Threads"` untranslated in **ar, he, hi, ko, uk, zh, th, el**
- `el/storyboard.title = "Storyboard"` — a **regression**: `v71_k` swept this exact entry and it
  came back

All 9 deleted so the pass refills them (the guard's own prescribed remedy, and what `v71_k` did).
The guard is precise, not noisy: 11 other verbatim entries (`⚑ {n}`, `IPA`, `URL / DOI`, export
formats) are correctly exempt.

> **Translate queue: 0 → 9.** And `el/storyboard.title` has now been deleted twice. Deleting a
> third time will not break the loop — **open decision 4 needs ruling.**

### 1c. `smoke-render` — the interesting one

The section picks a chapter from the corpus and now landed on *Abenddämmerung in Turin*, which is
**mixed-driven**. For a mixed-driven, coverage-incomplete set `_firstUnfinishedLessonIdx`
deliberately returns the mixed **driver** (the `v68.1` fix — without it a learner with a done-flag
on every lesson can never raise coverage again). So `nextLessonIdx = 2`, and the branch at
`index.html:13649` wins *above* the `_belowThreshold` lock at 13654.

Per the `v71_r` rule, checked whether the guard was right before blaming the data. It was not the
code: running the identical scenario against a non-mixed-driven chapter gives `disabled=true`,
`locked`, `onclick=null`, title "Keep going!" — all four assertions pass. Only **7 of 57**
multi-chapter storylines are mixed-driven; the picker happened to find one.

**So the guard was protecting nothing, and had been bitten this way before** (the `v71_k` note in
the same file records the previous instance). Fixed properly rather than by repointing:

- the lock fixture is now selected **by shape** — no visible `mixed` lesson, non-empty coverage
  universe, `_firstUnfinishedLessonIdx === -1` — which are precisely the preconditions for
  *reaching* the branch, not for passing it
- **an assertion that such a chapter was found**, so the section fails loudly instead of going
  vacuous on the next corpus swap
- both fixtures print their chapter name, so a silent no-op is visible in the log
- **new**: the mixed-driven side is now asserted in its own right — below the mark it must *not*
  lock, because Next is what carries the learner back into the mixed round. A future change that
  "fixes" the lock by making it unconditional now fails loudly instead of re-opening the dead end
  `v68.1` closed.

---

## 2. The drill result card was already done

Went to plan it; the code contradicted the roadmap. Per INTERNALS (*where the two disagree, the
code wins*):

- `roadmap_v71.md:227`, under **✅ What shipped in `v71_h`**: *"Drill result card removed."*
- `index.html:11898–11919` — the real drill exit in `renderEx`: ledger write, `endDrill()`,
  `showComplete(true)` on the restored topic
- `index.html:13629` — the old `if (lesson._drill)` branch is commented **"NORMALLY UNREACHABLE …
  defensive fallback only"**
- guarded by `unit-drill`, `unit-drill-ledger`, `unit-card-consistency`

**How it survived four deferrals:** `roadmap_v71.md` holds *both* entries — shipped at line 227 and
`[NEXT — carried, still open]` at line 491. The open list was carried forward mechanically into
`roadmap_v72.md` and `HANDOVER.md` without being cross-checked against the shipped list **in the
same file**.

> **New standing rule (added to the protocol):** a carried-forward open item must be checked against
> the same file's shipped list before it is carried again.

Mild irony worth keeping: the `smoke-render` fix *was* the cold re-read of that branch chain the
item kept being deferred for, and it found a real gap — the `v68.1` mixed resume had no test at all.

---

## 3. `v72_a` — sentence segmentation (the actual change)

Measured before changing anything, as the roadmap demanded.

### The naive drop-in is not safe

| | shared | new | lost |
|---|---|---|---|
| `Intl.Segmenter`, as-is | 3644 | **854** | 60 |

**598 of the 854 come from single line breaks**, not punctuation — `Intl.Segmenter` treats `\n` as
a boundary. Many shatter PDF-derived text mid-clause (*"…dei vigili del fuoco per ⏎ sottopassi
allagati"*), which is exactly the corruption `v70_k`'s paragraph repair exists to prevent. This is
the "riskier than it looks" the roadmap warned about, and it was real.

### What shipped

`Intl.Segmenter`, **single newlines flattened to spaces first** (paragraphs are already split on
`\n\n+`, so a surviving `\n` is a wrap), **no locale passed** — locale changed the result on **0 of
1533** paragraphs, so passing one would add an `APP.lang` dependency to a pure helper for nothing.
The old scan is kept as a fallback for engines without `Intl.Segmenter`, so they degrade to the
*old* behaviour rather than to none.

Whole-corpus effect of the **shipped** code:

| lang | before | after | Δ |
|---|---|---|---|
| **ja** | 33 | **176** | **+143** |
| **ar** | 511 | 617 | **+106** |
| en | 1728 | 1682 | −46 |
| it | 1768 | 1736 | −32 |
| fr | 172 | 171 | −1 |
| others | — | — | 0 |
| **total** | 5235 | 5405 | **+170** |

**0 of 775 samples change a single character.** The `v71_b` corruption class is safe.

The negatives are almost entirely the *old* code being wrong:
- **51 were mid-sentence hesitation ellipsis** — `"Forse... forse c'è qualcosa"` — which the old
  scan split and Unicode correctly does not
- most of the rest are one bundled story whose characters are *named* `0`, `1`, `2` and lowercase
  `i`, so sentences really do start with a digit and Unicode reads `. 1` as a list marker
- one is a straight fix: German `Enden ca. ⏎ 1,5 cm` — the old scan split at the abbreviation

User accepted both behaviour changes ("ignoring changes to existing lessons, these are fine").

### Finding: the Arabic ruling was right about `،؛` and incomplete

`؟` (U+061F) **is** a sentence terminator and was not in `[.!?…]` — `/[.!?…]/.test('؟')` is
`false`. Arabic gains 106 boundaries, loses none. Three diagnoses now on record: first wrong (add
`،؛`), second incomplete (length only), actual cause **a missing terminator *and* length**. Both
halves of the old ruling are now pinned by test — `؟` splits, `،` and `؛` do not.

### Finding: there were already two splitters, and they had drifted

`server.js` `_synSplitSentences` split on `[.!?。！？…]` — it **already handled CJK**. The client did
not. The two halves of the synonym pipeline had disagreed for an unknown number of releases, with
the server accidentally the more correct one, and nothing failed. Merged per the user's
instruction: one `_sentenceSplit`, byte-identical in both files, parity asserted.

### `_SENT_END_RE` is still there, deliberately

Lines ~4044, 4062, 4156, 4210 of `index.html`. It answers a *different* question — "does this
string END like a sentence?" — for the paragraph-wrap repair and the title/heading heuristics, not
for splitting. Left alone to keep `v72_a` to one change. **It is the remaining instance of the
hand-authored-list exception in that file.**

---

## Owed by the user (not doable in a container)

- **Browser pass** on `v72_a`. Segmentation feeds the synonym context card and the PDF chapter
  splitter; both are DOM-owed. Worth checking a Japanese story's synonym cards specifically —
  that path went from one unit per paragraph to real sentences.
- **Translate pass** for the 9 deleted `ui.json` entries.
- **Rule decision 4** (`el/storyboard.title`), or it returns a third time.

---

## 4. `v72_b` — the length fallback (item b), and two regressions it surfaced

`_splitLongUnit` sub-splits any unit over `_MAX_UNIT_CHARS = 300`. The budget is measured, not
invented: corpus unit lengths run p50=60, p90=131, p95=160, **p99=325**. At 300 it touches 1.1% of
units and the affected population is **68 ar, 63 it, 2 de** — the complaint's own languages. At 200
it would catch 2.6% and start splitting ordinary English and Dutch.

Break candidates come from `Intl.Segmenter` at **word** granularity: `isWordLike === false` and not
whitespace means punctuation, in any script. Verified it finds `،` `؛` in Arabic, `、` `。` in
Japanese, `,` `;` `—` in Latin — no hand-written list, which is the whole point. This is also the
place where `،` and `؛` legitimately *are* used: the v71 ruling that they must not end a **sentence**
still stands and is still tested. Breaking an over-long unit at a clause separator is a length
decision, not a claim about sentences.

### Regression 1, caught by an existing invariant: cuts must land on whitespace

The first implementation used any word boundary. `unit-pdf-paragraphs` failed with **937 words
against 934** — `Intl.Segmenter` reports boundaries INSIDE a token (`l'aria` → `l` `'` `aria`,
`30-32` → `30` `-` `32`), so cutting there and rejoining with a space invents words. Fixed by
anchoring every candidate to existing whitespace. A script with no whitespace therefore yields no
safe cut and is left whole — correct, and free, since everything over budget uses whitespace.

**This is the second time in this session that a pre-existing invariant caught something review did
not.** Worth the note: the word-count assertion is doing real work.

### Regression 2, mine, from `v72_a`, found only by measuring

`v72_a` gave CJK real sentence boundaries for the first time — and CJK puts **no whitespace** at
them. `_unitsToText` rejoins with `' '`, so it inserted a space after every `。`, changing the text
of **all 13 Japanese stories in the corpus**. The suite was green throughout, because every PDF
fixture is Latin, where the separator really is a space.

Found by checking an exact-text roundtrip rather than the word counts I had been using — word
counts are meaningless for Japanese, which is precisely why it hid. Units now carry `sep`, the
separator that was actually there, derived by locating each piece in the source. Hand-built units
without `sep` still default to a space.

> The general lesson, worth carrying: **a metric that is meaningless for a language cannot guard
> that language.** Every whitespace-based check in this codebase is blind to CJK by construction.

### One more consequence: fragments have to say they are fragments

Sub-splitting broke `smoke-render`'s v70_n assertion — the huge Italian sentence now split into
units, `_synContext` picked one, it fit under the word cap, and `_synClamp` therefore added no `…`.
The learner would have read a mid-sentence excerpt as if it were a whole sentence. Units produced by
`_splitLongUnit` now carry `frag` / `fragFirst` / `fragLast`, and `_synContext` restores the elision
marker itself rather than relying on the clamp to do it.

### Result

| | before v72_a | after v72_a | after v72_b |
|---|---|---|---|
| units | 5235 | 5405 | 5479 |
| units over 300 chars | 139 | 139 | **0** (in whitespace-using scripts) |
| p99 unit length | 325 | 325 | **274** |
| words gained/lost | — | — | **0** |
| ja roundtrip exact | n/a | ✗ 13/13 wrong | ✓ |

---

## 5. `v72_c` — the last hand-written punctuation list in this area

`_synClamp` starts its excerpt window just after a nearby clause break so the card reads as a
phrase. It asked a hand-written `/[,;:—–،؛。、]$/`, which had the **same gap as the sentence
terminator list, one script further out**: it covers `،` and `、` but not the Devanagari danda `।`
— and **Hindi is a shipped language**. Armenian `։` and Ethiopic `።` were missing too.

Replaced with `_endsClause`, using the same `isWordLike === false` test as `_splitLongUnit`, so
there is now **one** way to ask "is this punctuation?" rather than two drifting ones.

**Measured before switching, as the protocol requires.** Across all 286 synonym cards in the corpus:
39 are long enough to clamp, the clause scan actually fires on **19** of them, and the old list and
Unicode agree on **all 19**. So the "no change" result is not vacuous — the branch is genuinely
exercised. A pure generalisation: identical output today, correct output for scripts the list never
covered. `_SYN_CLAUSE_RE` survives only as the no-`Intl.Segmenter` fallback.

`_synClamp` had **no unit test at all** — it was reached only through `smoke-render`'s DOM path.
It has one now, including the Devanagari case, which fails if the list is put back.

> **A test-writing note worth keeping.** The first version of that test put the target at word 10,
> so the window started at word 0, the clause scan never ran, and the assertion passed while proving
> nothing — the same vacuity failure as the `smoke-render` fixture in §1c, committed twice in one
> session. The fixture now places the target far enough in that the branch is reached, and the
> assertion pins the exact start word (`… w11`) rather than testing a vague property.

---

## 6. `v72_d` — the synonyms model never saw the story

Raised by the user, and the code was worse than my first answer to them. `generateSynonyms` received
`opts.story` and threw it away on the next line:

```js
const storyKeywords = story ? extractKeywords(story, 8, lang) : '';
```

`extractKeywords` returns **eight bare words** — a frequency count of tokens ≥5 characters. That was
the entirety of what reached the prompt. Only *afterwards* did `findContextSentence` search the story
for a sentence containing each base word and staple it on.

So the model chose synonyms for a word in **isolation**, and the learner was then shown that word in
a sentence nothing had checked the synonyms against — while the prompt itself demanded they be
"directly substitutable in a sentence". The failure mode is polysemy: `preferenze` in an
electoral-law story means preference *votes*, and a model working from a topic string can reasonably
answer with the "tastes" sense.

**The data was already there.** Stories are small — corpus p50 787 chars (~225 tokens), max 4691 —
and `generateComprehension` already had the whole num_ctx-sizing pattern for exactly this, including
the `v71_t` silent-truncation guard. Nothing had to be invented.

### What changed

- the **story** goes into the synonyms prompt (`prompts.json` → `synonyms.storyBlock`), with the
  keyword hint kept as the degradation path when it would not fit the num_ctx ceiling
- `num_ctx` and timeout are sized per call, as comprehension does
- the model returns, per word, `"sentence"` — the story sentence it chose the synonyms against
- the synonyms rule is now anchored to *that* sentence: "replace `base` in that exact sentence …
  the quoted sentence decides which sense is meant"

### The quote is verified, not trusted

`verbatimStorySentence` checks the returned sentence appears in the story character-for-character
(whitespace normalised — a model will not reproduce line wrapping) **and** contains the base word
whole-word. Failure falls back to `findContextSentence`, so this can only improve on the old path.
An invented sentence would be strictly worse than the arbitrary-but-real one it replaced.

Six failure modes, each with its own test: paraphrase, translation, truncation with `…`, two
sentences joined across a line break, a real quote that does not contain the base word, and an
outright invention.

The fake model now returns **one real quote and one invention**, so the e2e exercises both branches
rather than just "a sentence exists".

> **Two vacuity slips, caught.** I first wrote `assert(/story/.test(env.srvlog()) || true, …)` —
> which passes unconditionally. Replaced with a check on the generator's own log line. Then reverting
> the story-passing did **not** fail anything, because `verbatimStorySentence` validates against the
> server's copy of the story either way — so nothing proved the story reached the *prompt*. The e2e
> now boots with `log: true` and asserts the story is in the prompt the fake model received. That is
> the third vacuity slip this session; the pattern is always the same — asserting on something
> downstream of the thing I changed.

**Not verifiable here:** whether the synonyms are actually better needs a live model. The plumbing is
fully tested; the quality gain is owed to the user, and the log line
`Synonyms context: N quoted, M rejected` is the signal to watch — 0 quoted means the model ignored
the field or the prompt was truncated.

---

## 7. Measurement only — Arabic presentation forms (no code changed)

Found while checking decision 2's evidence: three topics store Arabic in **Unicode presentation
forms** (U+FB50–FDFF, U+FE70–FEFF) rather than standard letters — a PDF-extraction artifact.
`اﻟﺘْﺮﺗﻴﺐ` is 6 presentation-form characters out of 8. Nothing in the codebase folds them: the only
`normalize()` calls are `NFD` for diacritics.

Measured before proposing anything, and the result argues for a **much smaller** change than it
first looked like.

### The alarming case does not occur

| | count |
|---|---|
| typed-answer targets in the corpus | 4670 |
| …containing presentation forms | **0** |

So no learner ever types Arabic and is marked wrong. The affected fields are 5 synonyms `base`, 6
`synonyms[].w`, 4 `antonyms[].w` — all **MCQ**, chosen by clicking, never compared to typed input —
plus `story` / `userTopic` / `userPrompt` / `userStory` on three topics. Rendering is unaffected;
presentation forms display correctly, which is why nobody has reported anything.

### A blanket NFKC would be actively harmful

The obvious fix is "normalise everything to NFKC". Measured across the whole corpus: **158 strings
change, and most of them are not Arabic.**

| before | after | why it matters |
|---|---|---|
| `sˤ` | `sʕ` | **IPA corruption.** U+02E4 (pharyngealisation) becomes U+0295 (a pharyngeal fricative) — a different phoneme. In `letters[].ipa`, i.e. the pronunciation being taught. |
| `① ② ③` | `1 2 3` | lesson title where the glyph **is** the content |
| `＋ － ×` | `+ - ×` | ditto, a maths lesson description |
| `がない！` | `がない!` | Japanese full-width punctuation flattened to ASCII across `story`, `sentences[].target` and `words[]` |

So NFKC is not a normalisation here, it is data loss. Any fix must be scoped to the two Arabic
presentation-form blocks and nothing else.

### The one real live effect is in `v72_d`, shipped this session

For these three Arabic topics the story is in presentation forms. A model asked to quote it will
almost certainly reply in standard Arabic letters, because that is how Arabic is written everywhere
else. Verified against the real corpus text:

```
model quotes it EXACTLY          -> ACCEPTED
model quotes it in NORMAL forms  -> rejected
```

Nothing breaks — `verbatimStorySentence` falls back to `findContextSentence`, which is what the
fallback is for — but the new feature would **silently never engage** for exactly the language whose
long sentences most needed better context selection.

### Recommended shape, if it is ever actioned

Fold the two presentation-form blocks **at comparison time only**, the way `normDiacritics` already
folds accents — never rewrite the stored text, which is the source document and should stay as
imported. The better long-term fix is upstream: stop `_cleanPdfText` storing presentation forms in
the first place, so new imports are clean and old ones stay readable.

**Not urgent.** Zero learner-visible breakage today, one silent no-op in a feature that degrades
correctly.

---

## 8. `v72_e` — the prompt demanded shaky synonyms (user-reported)

The synonyms rule said **"at least 1, up to 4"**. A floor of one forces the model to produce
*something* even when nothing really fits, and the consequence is not a harmless extra: the client
builds a **select-all**, so a learner who does not tick the questionable word is marked **WRONG**.
A doubtful synonym does not merely fail to teach — it teaches something false.

Three changes, because the constraint lived in three places and only fixing the prompt would have
made things worse.

**The prompt** now says `0-4`, QUALITY OVER QUANTITY, with an explicit substitution test against the
quoted sentence, an instruction to *drop* candidates the model is unsure of, and the reason spelled
out — a model told *why* a rule exists follows it more reliably than one handed a bare instruction.
Antonyms get the same standard. And a new rule: **an entry needs one relation, not both.**

**The server** dropped any entry without a synonym (`if (!synonyms.length) continue;`). That is the
part that made the prompt change dangerous on its own: telling the model "[] beats a shaky synonym"
would have silently deleted whole words whose *antonyms* were solid. Now `!synonyms.length &&
!antonyms.length`.

**The client** already handled it — `buildSynonymsExercises` makes one select-all per relation and
returns null for the empty one, so an antonym-only word yields exactly one exercise. Verified rather
than assumed, in both directions plus the neither-relation case.

> The shape worth remembering: a rule that looks like it lives in the prompt was really enforced in
> **three** places, and the prompt was the only one visible. Before loosening a generation
> constraint, check what downstream code assumes about the old one — the server's filter and the
> prompt's floor had silently agreed with each other for releases.

Not verifiable here: whether the synonyms are actually better needs a live model. The log now reports
`N antonym-only`, which is the signal that the model is using the new latitude — a run showing 0
antonym-only and full 4-synonym lists means it ignored the change.

---

## Still open, unchanged

- `lib-dom` innerHTML parsing — wants its own session. **Now the largest ready item.**
- Clamp synonym context server-side — small, needs a decision. Cheaper now: `_sentenceSplit` is
  genuinely shared, so there is a precedent and a parity test to copy.
- **`_SENT_END_RE`** is the one hand-authored list still in this area (`index.html` ~4044, 4062,
  4156, 4210). It answers a different question — "does this string END like a sentence?" — for the
  paragraph-wrap repair and the title/heading heuristics. `_SYN_CLAUSE_RE` was resolved in `v72_c`.
