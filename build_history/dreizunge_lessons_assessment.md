# Dreizunge lessons.json — Quality Assessment

**Scanned:** 114 topics, all language pairs  
**Total issues found:** ~320 across 44 topics with problems  
**No empty lessons** — all lesson sets have content

---

## Error Categories

### 1. `src==tgt` — Same word in source and target (107 cases, 18 topics)

The most common issue. The model used an international loanword or proper noun unchanged in both the English source and the target language field. These are technically not wrong — "nausea", "bar", "café", "pasta", "zombie", "aroma", "hotel" — but they're **useless as vocabulary exercises** since the user learns nothing.

**Worst offenders:**
- `Grandmas Doughs` (en→it): "dough", "crust", "knead", "ferment", "yeast", "elastic", "puff" — 9 items, nearly an entire lesson of English words in the Italian field
- `Cremant vs. Champagne` (en→lb): "Champagne", "Terroir", "Méthode Champenoise", "Vinification", "Complex", "Subtle" — 14 items across two lessons, almost entirely French/English wine terminology used unchanged in Lëtzebuergesch
- `History of Luxembourg` (en→lb): "Barons", "Castles", "Prosperity", "Resilience", "Dynasty" — 8 items
- `Local Pienza Specialties` (en→it): "pasta", "tagliatelle", "risotto" — Italian food names used as-is for Italian lessons (arguably correct but useless)
- `wir fahren nach london` (de→en): "tumultuous", "fascinated", "diplomat" — English words used as their own English translation

**Affected pairs:** en→it (most), en→lb, en→de, de→en, de→lb, en→fr, fr→it, it→en, de→it, de→fr

**Fix strategy:**
- Add a **posterior validation step** in `generateOneLesson`: after parsing, filter out vocab items where `source.toLowerCase() === target.toLowerCase()` (or ratio > 0.9 after stripping punctuation)
- On failure (>2 src==tgt items), retry with a stronger prompt addendum: *"Do NOT use loanwords unchanged. If the target language uses the same word, skip it and choose a different vocabulary item."*
- Alternatively, flag these in the UI with a `⚠` chip style so the user knows the lesson is partially degraded

---

### 2. `form==infinitive` — English conjugation lessons are trivial (87 cases, 2 topics)

English present-tense conjugation is almost identical across persons (only 3rd singular adds -s). So the model correctly generates: I run / you run / we run / they run — but this makes the conjugation exercise useless since every answer is just the infinitive.

**Affected topics:**
- `Zahlenreise` (de→en): "run", "play", "eat", "go" — 4 verbs, all trivial
- `Cyanobakterien für Energiegewinnung` (de→en): "use", "utilize", "convert", "produce", "extract" — 5 verbs

**Fix strategy:**
- Skip conjugation lessons when `lang === 'en'` — English conjugation is pedagogically useless at the present tense level
- Or switch to **past tense** for English (run/ran, eat/ate, go/went) which is actually irregular and worth learning
- Add a check in `generateConjugation`: if >60% of forms equal the infinitive, either retry with past tense or skip the lesson type entirely for English target

---

### 3. Wrong language script (5 sentence cases, 1 topic)

`בבלוב` (he→en) has completely swapped source and target in its sentence lessons:
- Source field contains English sentences ("The Germans underwent a remarkable journey...")
- Target field contains Hebrew sentences ("הגרמנים עברו מסע ממרתק...")
- Some Hebrew targets also contain Cyrillic (общество) and Latin fragments (RAINY)

This means the exercise is backward — it's asking the student to translate from English to Hebrew, but Hebrew→English should present the Hebrew and ask for English.

**Fix strategy:**
- **Manual re-generation** of `בבלוב` — it cannot be auto-fixed without re-running the lesson generator
- Add a **posterior script check** for he/ar source lessons: if sentence `source` field contains >80% Latin characters, swap source/target
- Add to the generation retry logic: detect language bleed in sentences using the same Unicode block checks already applied to vocab

---

### 4. Wrong language in vocabulary source field (3 cases)

- `בבלוב` (he→en): source vocab " kompleks" — Latin word instead of Hebrew
- `تجول في شيكاغو` (ar→en): source "コンcert" — Japanese katakana mixed into Arabic source field
- `ساعة اللوجان` (ar→en): source " widow" — English word in Arabic source field

**Fix strategy:** same as above — add posterior script validation for Arabic and Hebrew source fields in `generateOneLesson`

---

### 5. German nouns not capitalised (57 vocab items, ~10 topics)

German nouns must be capitalised. Many vocab items in German target lessons have lowercase nouns:

**Examples:**
- `Winnie adore le miel` (fr→de): "hunger", "wachte auf", "kletterte" — should be "Hunger" etc. (though verbs/adjectives are correct as lowercase)
- `Esibizione problematica` (it→de): "schiefgegangen", "versorgen", "verschwinden" — these are verbs/adjectives, so actually fine
- `meeting men` (en→de): "belebt", "beeindruckt", "plötzlich" — adjectives/adverbs, correct lowercase
- `Convincing Team` (en→de): "entwickeln", "optimiert", "erstaunlich" — verbs/adjectives, correct
- `per lavorare al circo` (it→de): "arbeiten", "frei", "begeistert" — verbs/adjectives, correct

**Verdict:** Most flagged items are actually **verbs or adjectives** which should be lowercase. The truly wrong ones are nouns: "hunger" → "Hunger", "Dialekt" used inconsistently.

**Fix strategy:**
- Add to vocab lesson prompt: *"German nouns MUST be capitalised (e.g. 'der Hunger', not 'hunger'). Verbs and adjectives are lowercase."*
- This is already in the TODO — it's a prompt improvement, not data-fixable retroactively without re-generation

---

### 6. Error hunt nonsense edits (2 cases, 1 topic)

`Duesseldorf Weekend` (en→it) has two error hunt edits with:
- `find: "Duesseldorf"` → `replace: "Dusseldorf"` — reason: "Swap 'u' for 'u' (no change, but required for the rule)"
- `find: "sussurrano"` → `replace: "sussurano"` — reason: "Swap 's' for 's'"

Both are no-ops where the model hallucinated a rule without making an actual change.

**Fix strategy:**
- Add posterior check in `generateErrorHunt`: filter out edits where `e.find === e.replace`
- Also filter edits where `e.reason` matches `/swap.*same|no.change|required for the rule/i`

---

### 7. Duplicate vocab across lessons in same topic (250+ cases, ~60 topics)

Almost every topic with 3 lessons has some vocabulary repeated between lesson[1] and lesson[2]. This is the most pervasive issue but also the **least harmful** — some repetition is pedagogically useful for reinforcement.

**Genuinely bad duplicates** (verbatim same word, same lesson set):
- `Cremant vs. Champagne` (en→lb): 8 words repeated exactly between lesson[0] and lesson[1]
- `energy from photosynthetic organisms` (en→pl): 8 words repeated between lesson[0] and lesson[1]
- `Problems with Hotel WLAN` (en→it): 8 words repeated between lesson[0] and lesson[1]
- `Arno Wins Fairly` (en→it): 7 words repeated between lesson[0] and lesson[1]
- `Bavarian Dialects` (en→de): many fillers ("ähm", "äh", "ähnlich") repeated across all 3 lessons

**Fix strategy:**
- The existing `prevVocab` avoidance mechanism (already in the prompt) should prevent this but apparently doesn't always work
- Add a **deduplication step** after lesson generation: before saving, remove any vocab/sentence items whose `target` already appears in an earlier lesson of the same topic
- Strengthen the prompt: *"Do NOT repeat any of these words from previous lessons of this topic: {prevVocab}"*

---

### 8. `בבלוב` (he→en) — requires full re-generation

This topic has structural source/target swap issues throughout all lessons that cannot be fixed by data manipulation alone. The entire topic should be re-generated.

---

### 9. `Translategemma für Luxemburgerisch` / `Funktioniert es mit gemischten Modellen?` (de→lb)

These are **test/debug topics** from translategemma evaluation — not real lessons. Several src==tgt issues ("Freiheit", "Versuch", "Wörter") because the model failed to translate. These topics should probably be **deleted or hidden** from the public static build.

---

## Summary Table

| Error Type | Count | Affected Topics | Severity | Auto-fixable? |
|---|---|---|---|---|
| src==tgt loanwords | 107 | 18 | Medium | Partially (filter + retry) |
| English conj trivial | 87 | 2 | Low | Yes (skip en conjugation) |
| Source/target swapped (he→en) | 10 | 1 | High | No — re-generate |
| Wrong script in source | 3 | 2 | High | No — re-generate |
| Error hunt no-ops | 2 | 1 | Low | Yes (filter find==replace) |
| German nouns not capitalised | ~10 actual nouns | ~5 | Low | Prompt fix only |
| Duplicate vocab | 250+ | ~60 | Low | Yes (dedup step) |
| Debug/test topics | — | 2 | Low | Delete or hide |

---

## Recommended Fixes by Priority

### Immediate (data fixes, no re-generation needed)
1. **Filter find==replace edits** in `generateErrorHunt` — 2-line code fix
2. **Deduplicate vocab** within topics post-generation — add to lesson save pipeline
3. **Delete/hide test topics**: `Translategemma für Luxemburgerisch`, `Funktioniert es mit gemischten Modellen?`

### Prompt/generation fixes (next session)
4. **src==tgt filter**: add posterior check, retry with avoidance instruction if >2 loanwords hit
5. **English conjugation**: skip conjugation lesson type when `lang === 'en'`, or switch to past tense
6. **German capitalisation**: strengthen prompt for noun capitalisation
7. **Script validation**: extend existing wrong-language retry to sentence level for he/ar

### Manual re-generation needed
8. **`בבלוב`** (he→en): structural source/target swap — re-generate entire topic
9. **`ar→en` topics** (`تجول في شيكاغو`, `ساعة اللوجان`): script contamination in source fields

---

## Notes on Language Quality

- **en→it** (41 topics, largest set): generally good, mainly loanword src==tgt issues. Italian stories and vocab are fluent.
- **en→de** (15 topics): good German, some capitalisation issues in vocab. Conjugation lessons are solid.
- **de→en** (10 topics): conjugation lessons are trivially useless for English target. Vocab quality good.
- **en→lb** (8 topics): Lëtzebuergesch quality is inconsistent — many src==tgt loanwords suggest the model struggles with the language. The Crémant/Champagne wine topics are particularly problematic.
- **en→ja** (6 topics): Japanese lessons appear structurally correct based on script checks.
- **he→en, ar→en**: both language pairs have significant issues — source/target confusion, script contamination. Needs stronger prompts or a different model for these pairs.
- **de→fr, fr→de**: small set, generally clean.
