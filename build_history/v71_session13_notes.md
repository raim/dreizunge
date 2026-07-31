# v71_n — session 13 notes

**Drill / learned-ledger correctness.** Two of the three bundled TODOs are fixed; the third
(traceability to the exact lesson) needs a decision — see below.

Suite **152**, `check-inline` 0 on both builds.

---

## The reported symptom

> "I had 'studiare wrong once' and keep being asked for it, including by the tutor."

`learners.json` explained it exactly: the `it|de` ledger held **one** entry with `wrong > 0` —
`studiare {seen:1, wrong:1}`. `drillCandidates` selects on `wrong > 0`, so that single entry **was**
the entire it←de drill pool. Every drill could only ask that word, and the tutor's focus list reads
the same ledger.

## Root cause — a `v71_h` regression

`v71_h` routed a finished drill through `renderEx → endDrill() → showComplete(true)`. `endDrill()`
swaps the real topic back, and `showComplete(true)` then **rebuilds `APP.cur`** from that restored
topic. So by the time the ledger was written, `lesson` pointed at a real chapter lesson and
`_wrongTargets` had been discarded.

Reproduced end to end before fixing — a drill that asked `STUDIEREN` and was answered entirely
correctly left it at `{seen: 3, wrong: 1}`, unchanged.

Three consequences, all fixed:

1. **The decay never fired.** `recordLearnedFromLesson` decays `wrong` only when `lesson._drill`,
   and that flag was false by then. A word answered right in a drill kept its mistake forever.
2. **Mistakes made IN a drill were never counted either** — the same discarded `_wrongTargets`.
3. **The real chapter's words were credited with a round they never took part in** (`HAUS` went
   `seen 3 → 4` after a drill that only asked `STUDIEREN`).

## A second bug found while reproducing

`recordLearnedFromLesson` ran on **review renders too**. `showComplete(true)` fires every time a
finished chapter is opened — and once more after every drill, since `v71_h`. So `seen` was counting
**how often the card had been looked at**, not how often the word had been practised: three views of
a completed chapter read as three exposures.

Now suppressed on review. A review render is by definition not a play — nothing was answered.

## Fixes

- `renderEx` records the drill's outcome **before** `endDrill()` swaps the topic back. That is the
  only moment the drill lesson and its wrong-set both still exist.
- `showComplete` records only when `!C._review`.

Verified: a clean drill now takes `STUDIEREN` to `{seen: 4, wrong: 0}`, the real chapter's words are
untouched, and `drillAvailable` flips to **false** — so the drill button greys itself out with
nothing left to drill (the third TODO in this bundle, satisfied by fixing the first).

Missing it again in a drill still takes `wrong` **up** — the decay must not launder mistakes.

## The third TODO needs a decision

> "Can we trace the exact lesson that is replayed? If the lesson has been deleted or edited, we
> should remove it from the drill."

**The ledger has no lesson provenance.** It is keyed by word — `{target: {source, seen, wrong}}` —
and a drill synthesises an ephemeral lesson from those pairs. There is no lesson to trace to.

Two ways to get there, both with a real cost:

1. **Record provenance**: add `lessons: [id]` (or topic ids) to each ledger entry as it is written.
   Clean, but it only helps words practised from now on — every existing entry stays untraceable,
   and the ledger grows.
2. **Prune against the corpus**: when building the drill, drop words that no longer appear in any
   saved lesson for that language pair. Needs no new data and fixes existing entries — but in LIVE
   mode `APP.savedList` carries `lessonCount`, not `lessons`, so the check cannot see the words and
   would prune valid entries. Reliable in the static build, wrong in live.

Option 2 is the tempting one and I think it is a trap in live mode. Option 1 is honest but slow to
take effect. A third possibility is to do nothing here: with the decay fixed, a stale word now
leaves the pool as soon as it is answered right once, which may be enough in practice.

## Still owed

- Browser passes on `v71_i` … `v71_n`.
- Comprehension prompt still unexercised against a live model (`v71_l`).
- Translate pass: `v71_l`'s four en keys. **This release adds none.**
- Queue: error-hunt on the result card (needs the extra-score decision) → error-hunt word alignment
  → book generation (3) → tutor (4) → cosmetics (6).

## Tests

`unit-drill-ledger` (new, 6 sections): the decay on a clean drill; mistakes still counting up; the
real chapter untouched; three review renders recording nothing; a normal round still recording (the
over-correction guard — if review suppression leaked into ordinary play the ledger would stop
filling entirely); and the CALL ORDER pinned at source level, since the bug was where the call sits
relative to `endDrill()` and no assertion on the numbers explains that to the next editor.

Revert-verified: moving the record call back after `endDrill()` fails; letting review renders record
again fails.
