# HANDOVER — v74

One page. Read `build_history/roadmap_v74.md` next for the queue and the session protocol, and
`build_history/v73k_session27_notes.md` for what session 27 actually found.

## Green baseline

| command | expected |
|---|---|
| `node test/run.js` | **166 checks, ALL PASSED** |
| `node test/run.js --quick` | 145 |
| `node test/check-inline.js` | 0 failures |
| `node test/check-inline.js docs/index.html` | 0 failures |

`APP_VERSION = 'v74'`. Establish this before changing anything.

**If `unit-static-freshness` fails, run `node build-static.js`.** New in `v73_b`: it hashes every
baked input and stamps the digests into `docs/index.html`, so a stale static build is caught instead
of shipping silently. It fires whenever `index.html`, `lessons.json`, `ui.json`, `languages.json`,
`scripts.json` or `build-static.js` changes without a rebuild. **A failure here is the guard
working.** The data files travel separately from the code and routinely arrive newer.

## Starting the next session — the lesson flow, the completion card, comprehension

Full spec in `roadmap_v74.md` under "THIS SESSION". The short version: session 27 fixed four defects
in this area and each one exposed the next, so it is one block of work rather than three.

**Session 27 is suspected of breaking this area.** The user play-tested it and reported user
progress, lesson flow and completion cards as broken. Nine changes landed on this subsystem in one
sitting, each individually revert-verified, **with no browser in the loop** — the individual changes
were verified, the accumulation was not. `roadmap_v74.md` §0 has the prime suspect (`v73_g`'s icon
row calls `startLesson()` from the completion card, violating a documented `v68.1` precondition) and
the bisection points. **Establish what is actually broken before writing code.**

**QC work is postponed** by the user — the QC menu, `mergeFlaggable`, and the comprehension checker
all wait behind the lesson flow.

**Three further things are known-broken and measured**, none of them fixed:

1. **`topicCoverage().total` is nondeterministic** — 15 of 294 topics return a different denominator
   run to run (worst spread 4 questions, 2.9%), because builders sample which items to quiz. A
   learner sitting exactly on the pass mark can cross it by reloading. Needs a decision about
   seeding the universe, not a patch.
2. **Comprehension has no QC checker.** `v73_k` stopped it being falsely stamped clean, which made
   the gap honest rather than closing it. Needs a new prompt and a live model.
3. **`mergeFlaggable` deletes flags — and stars — that the client's payload predates.** No
   concurrency required. `if (!('qc' in v)) delete m.qc;` cannot distinguish "the user cleared this"
   from "the client never knew about it". **The same path carries `userRating`**, and stars are the
   input to an example pipeline that currently has none.

(3) is the cheapest and is upstream of the one item in `future_development.md` that outranks the
whole queue — but it is QC work and therefore postponed. Do the lesson flow first.

**Two findings from the play-test that change what the notes look like they say** (both measured,
full detail in `roadmap_v74.md` §1–§2):

- The progress bars are **three questions sharing one display**. `_compProgressHtml` shows completed
  LESSONS for a classic chapter and solved QUESTIONS for a mixed-driven one — hence `2/2` next to
  `67/83` on identical bars. And comprehension sits INSIDE the coverage universe but OUTSIDE the
  unlock rule, which is why a chapter reads "64/83, below threshold" with the story already
  unlocked. The right model is two gates: non-comprehension lessons unlock the story, the
  comprehension lesson unlocks the next chapter.
- "Too little highlighting" is **not** mainly the `v73_e` boundary fix. Measured on the reported
  chapter: 4 marks before, 2 after — but of 16 vocab words, **9 match only once a leading article is
  stripped** (`el churro` vs the story's `churros`) and **4 only via a stem** (`negociar` →
  `negocié`). Vocabulary is stored in dictionary form; stories use inflected forms. **Do not revert
  the word boundaries** — that trades 2 real marks for the every-`i`-highlighted bug.

## Owed by the USER — nothing here can be done in a dev container

The reason to stop adding code rather than continue. Ten releases without a browser or a live model.

| owed | since | why it needs a human |
|---|---|---|
| **Browser passes on `v71_i`–`v74`** | 10 releases | Several changes are only visible in a browser. **Now including the completion card specifically**: the `v73_d` gate row, the `v73_g` lesson icon row, and whether the two together crowd the card on a phone. |
| **Live QC run — article symmetry** | `v71_y` | Whether the model CATCHES an asymmetric pair is a judgement no test can make. **Check Arabic first**: `ال`-prefixed words must not be flagged as one-sided articles. |
| **Live QC run — diacritics** | `v72` | The scan finds 5 candidates corpus-wide; the model must reject the minimal pairs (`souffle`/`soufflé`, `inizio`/`iniziò`). Rejecting all 5 is CORRECT. |
| **Live comprehension generation** | `v71_t` | Whether the removed story caps improved the questions. Watch for `Story context: … → num_ctx≈…`. |
| **`NUM_CTX_MAX` decision** | `v71_t` | A memory choice on hardware nobody here can see. 16384 default; 32768 roughly doubles the surviving story. |
| **QC on 8 `ui.json` entries** | `v72_b` | One key, `models.threads`, in ar/he/hi/ko/uk/zh/th/el — all verbatim English. Parked in `PENDING_QC` in `test/unit-ui-verbatim-en.test.js`, which fails if a new fallback appears AND if a parked one gets translated (remove it from the list then). |
| **Native-speaker vocab review** | ongoing | Nothing in the suite can judge whether a generated word is the one a native speaker would use. |
| **Live synonyms run** | `v72_d`, `v72_e`, `v73` | Two log lines: `Synonyms context: N quoted, M rejected` — 0 quoted means the model ignored the field; and `N antonym-only`. |
| **Corpus curation — ⭐ ratings** | ongoing | **0 items in the corpus are starred.** The rating UI exists, `harvest-examples.js` exists, `promptExample()` resolves at 4 generation sites — and `examples.json` does not exist. Every generation in every language falls through to a generic default. Needs judgement, not code, and it is upstream of every lesson the app produces. |

## Open decisions blocking work

1. **Duplicate targets.** `v73_i` stopped a duplicate becoming a duplicate QUESTION; the duplicate
   DATA is untouched and still reaches the editor, the vocab chips and the distractor pools. Note
   that one instance is legitimate — `der/die Angestellte` are two real nouns sharing a plural — so
   a rule keyed on target alone throws away good data. Dedupe on the pair, repair the corpus, or
   flag in QC?
2. **Crossword translation highlight** — `word_forms` items have no translation field, so there is
   nothing to put in the gap. Restrict to vocabulary/synonym clues, or give word_forms a translation?
3. **Coverage universe seeding** — see item 1 of the section above.
4. **Script-mismatch detection.** `scripts.json._langScript` already maps `he→hebrew`, `ar→arabic`,
   so a check is a registry lookup plus `\p{Script=…}` — no language knowledge. Measured: 1 topic,
   7 words out of 4,670 targets — a Hebrew lesson whose grammar items are Arabic words carrying the
   Hebrew article `ה`, one plural reading `"udades"` (Spanish debris). Rare but shipping today.
   Block at generation, flag in QC, or both? The tolerance policy is the hard part: loanwords will
   trip a naive check.

*(Rulings kept so they are not re-opened: the design principle's boundary is Unicode machinery, not
hand-authored tables, session 25; `el/storyboard.title` stays "Storyboard" as a loanword, session 26;
grammar and conjugation stay story-free, session 26; article MCQs build only where the corpus shows
the article is predictable from gender, session 27.)*

## What changed in session 27, one line each

`v73_b` docs/ staleness guard — fired on the archive as delivered · `v73_c` lib-dom parses
`innerHTML`, retiring a "needs a browser" claim that was false in all three of its parts · `v73_d`
completion-card pass mark: a green bar above a locked Next · `v73_e` story highlighting: a vocab
entry `"I"` lit every `i` in every word, 54 marks → 13 · `v73_f` article MCQs suppressed where the
corpus shows the article is not predictable from gender (en 0/6 suppressed, de 9/9 kept) · `v73_g`
completion-card lesson icon row · `v73_h` plural distractors drawn from the corpus, replacing
`plural + 'e'` · `v73_i` a round never asks one question twice · `v73_j` QC findings survive a
chapter edited mid-pass — 9 flags logged, 5 kept, diagnosed from the user's console log · `v73_k`
unchecked lesson types no longer stamped QC-clean, plus three TODOs recovered from a roadmap
boundary.

**Five of the ten came from the user playing lessons.** Nothing in the suite could have produced
them, and that ratio is the strongest argument for clearing the owed browser passes.

## Two things worth carrying into how you work

**Nine vacuous assertions were found in this session alone**, every one by breaking the product and
demanding the named assertion fire — none by reading. The shape is always the same: the assertion is
downstream of the thing under test, or the fixture is arranged so the distinction never arises. Two
needed three attempts to make bite. A revert must also leave the product in a *coherent* wrong
state: one apparent "no failure" turned out to be a `TypeError`, which verifies nothing.

**Items are lost at roadmap base cuts, not in the idea documents.** An entire `[OPEN — …]` block of
three items vanished at the v71 → v72 boundary and was absent from `roadmap_v72`, `roadmap_v73`, the
previous `HANDOVER.md`, and the first draft of `future_development.md`. They are restored in
`roadmap_v74.md` under RECOVERED. **Only 1 of 28 roadmap boundaries has been checked.**
