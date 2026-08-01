# v71_w — session 22 notes

Roadmap quality item, found in `v71_s` and logged rather than fixed incidentally:
**two readers for "is this chapter complete".**

Suite **157** (unchanged count; the guard extends `unit-chapter-complete`), `check-inline` 0 on both.

---

## 1. It was worse than "two readers" — they diverged in BOTH directions

`v69_l` consolidated the question onto `chapterComplete()`. But only where it was looked for. The
storyline page kept **two** raw `every(ls => done[ls.id])` scans: the connector line between chapter
cards, and the progress bar's green-at-100% colour.

I measured rather than assumed, and the disagreement is real in both directions:

| case | shared `chapterComplete` | raw done-flag scan |
|---|---|---|
| mixed-driven chapter, every VISIBLE lesson done | `true` | `false` — **too strict** |
| every done-flag present, coverage below the pass mark | `false` | `true` — **too permissive** |

The first is the v48 hidden-lesson rule (a mixed lesson's pooled siblings are hidden and have no
done-flags — `countedLessons` already encodes this). The second is **the exact v69_l bug**, still
live on this page long after it was fixed for the gate immediately above it.

Nothing failed because on the bundled corpus they happened to agree — which is precisely why it
survived. Both symptoms are quiet: a connector line or bar colour that lies about an unfinished
chapter is only visible in a browser, and neither blocks anything, so nobody reports it.

## 2. The fix, and one deliberate non-fix

- **Connector line** → `_chapterComplete(prevTopic)`.
- **Bar colour** → `_chapterComplete(topic)`. 100% of done-flags is not the same as complete once a
  pass mark or a story-gated lesson (`v71_s`) is involved.
- **Bar fraction** → still a fraction, but over `countedLessons`. "How much of this chapter have you
  played" is a genuinely different question from completeness and is right to stay a raw count —
  but it was counting hidden lessons, so a mixed-driven chapter could never reach 100%.

**The distinction is the point, and it is now a rule in `INTERNALS.md`:** a progress *fraction* may
stay a raw count; any signal that asserts **finished** — a colour, a lock, a tick — must read the
shared rule.

## 3. The guard

Added to `unit-chapter-complete` (the v69_l file — its natural home) as behaviour plus source pins:

- (a) and (b) reproduce the old raw rule in the test and assert it **disagrees** with the shared
  reader in each direction. Measured, not asserted from the diff — if the two ever genuinely
  converge, these fail and the section should be revisited rather than trusted.
- (c) pins both call sites and asserts neither raw scan comes back.

Two harness snags worth recording:

- **This file had no live client.** The other sections are source-only + extracted functions, so my
  first draft referenced an undefined `C`. The block now stands up its own client rather than
  changing the harness the other sections depend on.
- **A 4,000-char slice of `_renderChapterCard` stopped before the bar colour.** The function is
  dense; widened to 9,000. A source pin that silently falls outside its own window is a vacuous
  pass — the same failure mode as `v71_u`'s `l.type === 'standard'`.

Revert-verified, all three independently: connector line, bar colour, and the fraction's
`countedLessons`, each failing as a named assertion.

## 4. `INTERNALS.md` updated

This closes the one **"Known outstanding"** item in the document written last session — §3's
one-rule-per-question entry now carries the divergence table above and the fraction-vs-finished
corollary. Verified-against tag moved to `v71_w`.

That is the intended loop working: the doc named a live inconsistency, the next session closed it,
and the doc now records the rule that prevents it recurring rather than the fact that it existed.

## How to see it work

Open a storyline whose chapters include a **mixed** lesson, with the earlier chapters played:

- The connector line between two chapter cards now fills green only when the previous chapter is
  genuinely complete — before, a mixed-driven chapter left it grey however much had been done.
- The progress bar reaches 100% on a mixed-driven chapter at all (it counted hidden lessons before),
  and only turns green when the chapter passes the mark rather than at 100% of done-flags.

## Deliberately not done

- **No change to `chapterComplete` itself.** It was already right; the bug was elsewhere reading
  something else.
- **No change to `_chapterStarted`** (the "has the learner begun this" helper). Different question,
  correctly a raw scan — the gate exists to stop reading ahead, not to confiscate work done.

## Still owed

Browser passes on `v71_i`–`v71_w` — this release changes two storyline-page visuals and nothing
else, so it is a good candidate to fold into the next pass · the `v71_t` live comprehension check ·
`NUM_CTX_MAX` in practice · translate queue **380**.

Code items unblocked: deterministic vocab QC (specified against real data; needs one decision —
whether the article rule should propose STRIPPING the source article or ADDING a target one, since
the user's own fix did the former) · duplicate grammar targets (`v71_r`) · drill result card.
