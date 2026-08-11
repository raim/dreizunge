# Session 33 — the `v79` line

Opened at the `v79` base cut. **One release: `v79_b`.** One ruling asked for and given, one stale
instruction found in the session prompt, and the per-text learning scheme discussed rather than
built (the user's choice for this session).

---

## 1. The baseline was green, and the corpus numbers agreed with `HANDOVER.md`

| check | expected | measured |
|---|---|---|
| `node test/run.js` | 206 | 206, all passed |
| `node test/run.js --quick` | 182 | 182 |
| `node test/check-inline.js` | 0 | 0 (1 block, 948,566 bytes) |
| `node test/check-inline.js docs/index.html` | 0 | 0 (1 block, 6,916,410 bytes) |
| corpus | 315 topics, 88 storylines | 315 / 88 |
| languages, `ui.json` `en` keys | 33, 617 | 33, 617 |

`unit-script-choice` reported `1 known-mixed`, which is the expected `reinforce` chapter. **Neither
fixer was run**, and neither needed to be — the point of checking the counts and the mtimes first
(rule 23) is that there was nothing to diagnose.

Worth recording for the next data drop: `scripts.json` (Aug 11 05:39) and `docs/index.html`
(Aug 11 05:52) are NEWER than `index.html` (Aug 10 13:59) and `server.js` (Aug 10 17:32) at this
cut. That ordering looks alarming under the mtime rule and is not: `docs/` is the newest file
because it was rebuilt last, which is exactly what a correct tree looks like. **The mtime rule
identifies which file a FIXER rewrote; it does not say the build must be older than its inputs.**

## 2. The session prompt was stale against its own cut — three items

The prompt's item 3 said regenerating `tp_17863746762340000193` was owed by the user, and put the
mixed-script lesson and the `cyrillic-sr` sounds column under "not in scope". **All three had been
withdrawn by the user after the prompt was written**, and the tree already carried the corrected
reading in three places: `roadmap_v79.md` open item 2, `HANDOVER.md` ("Nothing is owed by the
user"), and `unit-script-choice.test.js:157`, which lists the id as `EXPECTED_MIXED` with a comment
saying the entry should go when `reinforce` goes — not when the chapter is regenerated.

The `cyrillic-sr` column is the sharper case: it is not deferred, it is **barred**. Its absence
enforces the `v75_g` ruling pinned in `unit-intro-script`, a column was authored at the v79 cut and
reverted, and adding it would silently reverse that ruling. "Not in scope" and "the guard will stop
you" are different states and the prompt recorded the weaker one.

**What survives of item 3 unchanged:** if a SECOND mixed id ever appears it means the fix did not
hold rather than that the list should grow — still right, now for a different reason. A second id
means a second script-switching storyline, not prompt drift.

This is `HANDOVER.md`'s own instruction working: *"Every session prompt so far has quoted a count
that was right when written and stale when read. If a prompt and this file disagree, measure."* It
applies to instructions as well as counts.

## 3. `v79_b` — `useFullChain` now does what its label says

### The ruling

Presented with the two options and measured costs; the user ruled **make the label true**.

### What was wrong

`generate()` chose between the parent chapter's story in full and its last `OLLAMA_MAX_PREV_STORY`
(800) characters. `_chainStory` — chain-wide, with a chapter count and a budget — is built ~200
lines LATER and feeds lesson generation only. So a continuation was written from one chapter of
context however the box was set.

### Three measurements taken before the ruling, because they change the decision

Over the 236 corpus continuations whose parent resolves:

```
chapter story length          min 67   median 749   p90 2334   max 4691 chars
box ON  (parent in full)      median 671   p90 2892   max 4691
full chain (all ancestors)    median 3297  p90 8021   max 43312
growth vs today               median x3.3  p90 x15.5
parent <= 800 chars           128 of 236 = 54.2%
```

- **For 54% of continuations the checkbox was a no-op.** The parent is shorter than the tail budget,
  so "full" and "last 800" are the same string. That is why the defect needed a user report: it is
  invisible on more than half the corpus.
- **The label was promising about 3.3x the context it passed** at the median.
- **The story call passed no `ctxTokens`.** `_resolveNumCtx` returns null when the caller does not
  ask, so no `num_ctx` reaches Ollama and its ~4096 default applies. Through the product's own
  `estimateCtxTokens`: today's longest parent estimates 3,203 tokens and fits; the chain estimates
  4,244 at p90 and 15,272 at max. **"Small in code" was wrong.** Feeding the chain without sizing
  the window would have replaced a trim we choose with a silent one Ollama makes, with every
  generation still reporting success — the exact failure `v71_t` exists to prevent.

### What shipped

- The story prompt takes `collectChainStory(parentNode, budget)` — the **same collector the lesson
  path uses**, so the two contexts cannot drift apart, and its trim drops predecessors from the
  OLDEST end while keeping the most recent chapter whole.
- **The budget is derived from the context ceiling** and handed to the collector, so the trim
  happens where the chapter boundaries are known rather than mid-sentence afterwards:
  `min(CHAIN_STORY_CHARS, floor((ceiling - reply - 512) * 3.2) - 1200)`.
- **`num_ctx` and the timeout are sized, but only when the chain is actually fed.** The KV cache
  grows with the window, so reserving one that is not needed is not free. `Math.max` on the timeout
  means it can only ever RAISE the limit, never cut a reasoning run short.
- **A single-chapter chain keeps the pre-`v79_b` shape exactly** — no `## title` header, no
  `num_ctx`. The change is confined to the case it is for.
- **No i18n change.** The existing label and tooltip became true. That was a real dividend of the
  ruling: the other option would have needed a reworded tooltip in 33 languages.
- **Console lines distinguish the two contexts**, which the roadmap asked for either way:
  `Story context:` is the story prompt, `Lesson context:` the lesson chain (three sites renamed).

### How it is guarded, and why the obvious guard was not enough

`e2e-bookjob` already asserted `/Previous story/` on the continuation prompts. **That assertion
passes for both behaviours** — it cannot see this change at all, which is a good reminder that a
green assertion near a defect is not evidence about it.

The claim is about IDENTITY (which chapters reached the prompt), so it is asserted by identity:
every fake story carries a unique `STORYTEXT[<ms>]` marker, and chapter 3's prompt must contain
**chapter 1's** marker as well as chapter 2's. Non-vacuity first: the two markers are asserted
distinct before either is looked for.

**One book job exercises both branches.** Chapter 2's parent is the root, so its chain is one
chapter: old shape, no `num_ctx`. Chapter 3's chain is two: both markers, header naming the chapter
count, `num_ctx` present.

**Revert-verified separately, twice**, because they are two claims and one revert would have hidden
the other:

| revert | failing assertion |
|---|---|
| `_useChain = false` | *chapter 3 prompt carries chapter 1 TOO — the whole storyline* |
| `_ctxOpts` forced empty | *chapter 3 sizes num_ctx for the longer prompt* |

### `fake-ollama` now logs the request OPTIONS

`{kind, sys, usr}` gained `opts: {think, num_ctx, num_predict}`. **"The server sized the context
window" is a wiring claim no prompt assertion can reach** — the server could have ignored
`ctxTokens` entirely and all 206 checks would have stayed green. Additive to the log line, so no
existing reader breaks.

### Two source pins broke, and were NOT re-pinned

`unit-reasoning-model-safety` §2 and `unit-reasoning-toggle` both slice `server.js` from
`const storySystem = sysStory(` to `story = text.trim();` and match `thinkOpts('story', ...)` inside
it. Hoisting `_baseStoryTokens`/`_sOpts` above the prompt — necessary, because the context budget is
sized against the reply allowance — put both outside the window.

**The claim was still true; the window had stopped reaching the line.** That is the `v71_w` rule
arriving from the other direction (there, a slice that stopped short of the line it pinned; here, a
slice that starts after it). So:

- both windows widened to the whole story-generation block,
- each given a **non-vacuity check** that the slice really contains the `callLLM` it makes claims
  about — without it the widened pin could go silently vacuous the same way,
- and the same claim now asserted at the BACKEND too (`think:false` observed in the chat log), so a
  future line move cannot take the guard with it.

Revert-verified: replacing `thinkOpts('story', ...)` with a literal `{think:true}` fails both.

### Definition of done

Suite 206 green, `--quick` 182, `check-inline` 0 on both builds. `APP_VERSION` bumped to `v79_b`
and `build-static.js` re-run; **the rebuilt `docs/index.html` diffs to ZERO lines against the
previous build once the version string is normalised**, which is the check that a rebuild cannot
lose user content. `INTERNALS.md` updated: constants table (`OLLAMA_MAX_PREV_STORY` added,
`CHAIN_STORY_CHARS` note extended), the `num_ctx` section's "only `generateComprehension` sends it"
line corrected, and the corpus scale figures recorded there rather than only here.

### How to see it work (browser + live model)

Generate a **chapter 3 or later** of a storyline with the box on. The console should show, on the
story call:

```
    Continuing from: "…" (story prompt: full storyline, 2 chapters, N chars)
    Story context: 2 chapters, N chars -> num_ctx~…, timeout …s
```

and, separately, `Lesson context: …` for the lesson prompts. **Chapter 2 deliberately looks
unchanged** — that is the single-parent branch, not a failure. Expect the story call to be slower in
proportion to the context; the median chapter now carries about 3.3x what it did.

## 4. Still owed at the end of this session

- **Package.** The zip's top-level directory must be `dreizunge_v79_b/`, not `dreizunge_v79/`.
- Everything in `HANDOVER.md`'s "Owed by the user" that a container cannot do — unchanged by this
  session.
- The per-text learning scheme remains a DISCUSSION. Nothing was built for it here.
