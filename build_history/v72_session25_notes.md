# v72 — session 25 notes

The diacritic ("umlaut") half of the deterministic vocab QC, plus the `v72` base cut.

Suite **159** (+1), `--quick` **138**, `check-inline` 0 on both builds.

---

## 1. The rule did not survive contact with the data — twice

Implemented as specified, then measured before shipping. Two findings changed the design.

**Both originally-reported defects are already hand-fixed.** `naturliche` → 0 occurrences;
`symbiosi` → now `simbiosi`. The rule's value today is preventing their RETURN, not cleaning up —
worth knowing so a future session does not assume the check is broken when it finds almost nothing.

**Precision was poor.** The scan produces 5 candidates corpus-wide, and most are **minimal pairs** —
real, distinct words differing only by a diacritic:

| candidate | suggestion | verdict |
|---|---|---|
| `souffle` (fr) | `soufflé` | breath vs. the dish — **not a typo** |
| `inizio` (it) | `iniziò` | beginning vs. "he began" — **not a typo** |
| `Cremant` (en) | `Crémant` | probably real |

Shipping that straight into the flag UI at roughly 1-in-5 precision would train the user to dismiss
flags, which costs the QC checks that do work.

## 2. So the scan generates candidates and the model decides

Deciding typo-vs-distinct-word requires knowing the language — the session-23 principle says that is
the model's job. The final shape:

- **Deterministic scan** — Unicode-only (NFD + combining-mark strip, plus the handful of letters
  carrying their diacritic as a distinct codepoint: ß/æ/œ/ø). Compares corpus forms against each
  other. No language knowledge, high recall, free.
- **Model adjudication** — only the survivors reach `qcCheckDiacriticCandidate`, which asks one
  question: misspelling, or a different correctly-spelled word? **Defaults to OK on anything
  unclear** — a missed typo is cosmetic, a false flag is corrosive.

Recorded in `INTERNALS.md` as a reusable shape: *deterministic scan + model adjudication*, for
checks that are cheap to generate candidates for and expensive to decide.

## 3. It is a DIACRITIC check, not an umlaut check

The roadmap filed it as "missing umlaut". Naming it that in code would smuggle in exactly the
language knowledge the principle forbids — and would miss the identical defect in `é`, `ñ`, `ç`,
`å`, `ø`. Nothing in the implementation knows what language it is looking at.

**The capitalisation rule is a German fact in disguise.** The roadmap specified it to suppress
`Zahlen`/`zählen`, and it does — but only because German capitalises nouns. It fails for `souffle`/
`soufflé` and `inizio`/`iniziò`, which are the same class of pair in languages without that
convention. Kept as a free pre-filter; never as the decision. Pinned in the test so nobody mistakes
one for the other.

## 4. Implementation notes

- **Case is preserved** in the strip (`_stripDiacriticsCase`), unlike the client's `normDiacritics`.
  That is what makes the pre-filter work at all — lowercasing would make `Zahlen` and `zählen`
  collide. Parity with the client on the codepoint folds is asserted, since the two must agree about
  what counts as the same word.
- **The index is built from the WHOLE store**, not the topics in scope: the accented form that
  proves a typo may live in another chapter. Deterministic and cheap, so widening costs nothing.
- **Findings file under their own checker identity** (`QC_DIACRITIC_BY = 'diacritics'`) in the
  existing `qcByModel` map, so a model saying "OK" cannot erase a mechanical finding or vice versa.
  `_check` gained an optional `by` parameter; the multi-checker shape already existed for comparing
  QC models.
- **Multi-word fields are skipped** — per-token checking needs tokenisation rules that vary by
  language, which is the thing being avoided.
- **Language-scoped index** — a French accent cannot flag an English word.

## Revert-verified

| revert | assertion that fires |
|---|---|
| scan decides directly, no model | the QC run adjudicates each candidate |
| case folded in the strip | Zahlen is not reported as a typo for zählen |

## How to see it work — needs a live model

Run **QC** over a storyline and watch for `⚑ flag [diacritic] [diacritics] "…"`.

The expected outcome on the shipped corpus is **no flags at all** — the model should reject all five
candidates as real words. That is success, not failure: both genuine defects were already fixed by
hand. If it flags `souffle` or `inizio`, the adjudication prompt needs tightening; that is the thing
to watch.

## 5. The `v72` cut

`v71_z` exhausted the letter suffixes. `roadmap_v72.md` is a fresh base roadmap carrying the full
session-protocol block and every open item forward verbatim; `roadmap_v71.md` stays as the
historical record of the 24-session v71 line.

Files a fresh session needs, all current:
`build_history/HANDOVER.md` (step 0) · `build_history/roadmap_v72.md` · `INTERNALS.md` · this file.

The protocol's session-start list now names HANDOVER first and INTERNALS third — previously a new
session had to discover both.

## Still owed

**Two live QC checks now**: article symmetry (`v71_y` — check Arabic `ال` first) and diacritics
(this release — expect zero flags). Plus browser passes on `v71_i`–`v72`, the `v71_t` comprehension
generation check, `NUM_CTX_MAX`, translate queue **380**.

**Open decision unchanged:** the design principle's boundary. `_sentenceUnits` splitting on `.!?…`
still sits on the line — and it now blocks a real item (the PDF chapter splitter chunks Arabic far
too coarsely for the same reason).
