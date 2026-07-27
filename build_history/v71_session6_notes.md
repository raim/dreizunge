# v71_g — two questions answered, both pinned with tests

No product code changed this session. `index.html`, `server.js`, `docs/index.html`, `ui.json` and
`prompts.json` are byte-identical to `v71_f`. Two questions were investigated from the code and the
answers were locked in as regression guards. Suite **146** (was 145).

Version is bumped to `v71_g` to mark the test additions, but the running app is unchanged from
`v71_f` — a static rebuild would be a no-op and was skipped.

---

## Q1 — should the repeat-focus fix extend to synonyms and word_forms lessons?

**No, and the reason is a property, not a preference.**

The `v71_f` top-up exists to compensate for `buildStandardExercises` **sampling** — it picks one
exercise type per vocab item, so a single derivation surfaces only part of the lesson's question
universe, and a replay's pool was missing most of the unsolved material.

Measured, one derivation vs. the full universe:

| builder | items | universe | one derivation | samples? |
|---|---|---|---|---|
| standard | 12 vocab | 12 | **6** | yes → fix needed |
| synonyms | 5 words | 5 | 5 | no |
| word_forms | 5 items | 5 | 5 | no |
| grammar | 3 items | 8 | 8 | no |

synonyms, word_forms and grammar emit their **entire** question set on every build — exactly one
exercise per relation/item, deterministically. A perfect learner reaches 100% in **one round**.
Extending the top-up there would add a re-derivation loop that provably never finds anything
missing: dead complexity guarding a problem those builders do not have.

**Pinned:** `unit-replay-focus` §8 asserts `oneDerivation === universe` for all three
deterministic builders. If a future edit makes one of them sample, that assertion fails and flags
that this decision must be revisited — so the "no" is not a comment that can silently rot.

## Q2 — how do error-hunt lessons play into the pass-mark counter?

Two facts that look contradictory, both true and both intended:

1. **An error hunt IS a counted lesson.** `_NEVER_POOLED` keeps `error_hunt` / `ai_error_hunt` out
   of the mixed-lesson hiding rule — they are the final test and always count.
2. **An error hunt contributes ZERO coverage questions.** Its builder returns `[]`, so its qid
   universe is empty and it neither raises nor lowers the `topicCoverage` denominator.

The consequence, reproduced on a real corpus chapter (8 standard lessons + a trailing
`ai_error_hunt`): coverage **100%**, every standard lesson done, and `setComplete` still **false**.
Because `_setCompleteRaw` requires *every* counted lesson to carry a done-flag — the error hunt
included — and `showComplete` deliberately does **not** write one for an error hunt (`!C.isErrorHunt`
at the record-completion gate).

**The reconciliation — and why it is correct, not a bug:** `ehCheck()` writes the error hunt's OWN
completion record directly (`completed[topic][ehId] = { score, suspect, missed, … }`) at play time,
before calling `showComplete`. `showComplete` skips error hunts *precisely so it does not clobber*
that richer record with its generic `{ correct, total }` one. So the flag exists exactly when the
hunt has been **played** — never on coverage alone.

Net behaviour: **a chapter ending in an error hunt completes only after the final test is taken**,
even at 100% coverage. That is the intended gate — the test cannot be skipped past. It applies
identically to classic sets (the `every(done)` branch) and mixed-driven sets (the
`every(L.type==='mixed' || done)` branch); both count the error hunt, both wait for it.

This interaction had **no test at all** before now — the exact kind of subtle two-rule coupling that
a future refactor of either `lessonCountsFor` or the `showComplete` recording gate could break
silently.

**Pinned:** `unit-errorhunt-passmark.test.js` (live DOM, 5 sections):
- the error hunt counts but adds 0 to the denominator;
- 100% coverage + others done + hunt unplayed → `setComplete` **false**;
- driving the **real** `renderErrorHunt` + `ehCheck` → flag written → `setComplete` **true**;
- source guard that `showComplete`'s recording stays gated on `!C.isErrorHunt`;
- the same gate holds for a mixed set with a trailing error hunt.

Revert-verified: removing `ehCheck`'s self-record fails both the behavioural assertion (§3, "playing
the error hunt records its own completion") and the source guard (§4).

## Harness change

`test/lib-dom.js` gained `after()` / `before()` sibling-insert stubs on the mock element. `ehCheck`
appends its results panel with `wrap.after(...)`, which the stub lacked — so any test driving the
real error-hunt path threw `TypeError: wrap.after is not a function`. The stubs mirror the existing
`insertAdjacentElement` behaviour (accept the nodes, no layout). This is a real harness gap, not a
workaround: without it the error-hunt render path could not be exercised at all. `smoke-render`
still passes, so nothing depended on their absence.

## Owed

Unchanged from `v71_f`: browser passes on the PDF chapter work, the typed diff, the locked Next, and
the replay focus; the stale `showComplete` comment ("rounds re-sample on every play") that is now
doubly wrong; cross-chapter vocab duplication; and the outstanding i18n re-translation.
