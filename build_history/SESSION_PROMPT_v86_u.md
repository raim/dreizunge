# Session prompt — written at the `v86_u` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_u`**. `v86_o`-`v86_t` shipped
item W ("text explorer" mode) and six follow-up rounds. This cut (`v86_u`) is unrelated to item W:
it closes the single most-carried-forward open item in the whole line.

**What shipped this cut (`v86_u`)**:

**The `unit-article-choices` reproducible red, investigated and fixed — green for the first time in
NINE cuts.** The user asked, directly: "why is there triple-counting? did we build in
language-specific article checks?" — answer: no language-specific code anywhere; a real, generic
counting bug.

Root cause: `_forEachGrammarItem`'s three-tier traversal ("this lesson, then the open chapter, then
the whole library") was built to feed a `Set`-building consumer (`_pluralChoicesFor`), where
revisiting the same value twice costs nothing. `_articleStatsFor` was layered onto the SAME traversal
later to COUNT occurrences into a ratio — and the three tiers legitimately overlap in real use: the
lesson passed in as `items` normally IS an entry of the open chapter (`APP.lessonData`), which is
itself normally one entry of the full library (`APP.savedList`). Confirmed against the real call site
(`buildExercises` passes `APP.lessonData.lessons[lessonIdx]` by direct reference, not a copy): the
currently-open lesson's own article mix was being counted **up to 3×** the weight of every other
lesson's.

Why this only ever showed up for Italian, and why that's a real linguistic edge and not a coincidence:
Italian's masculine article splits between "il" (default) and "lo" (required before s+consonant/z/
gn/ps/x/y-initial nouns) — a PHONOLOGICAL condition the gender-only 90%-dominance heuristic can't see.
Measured fresh over the whole corpus: 91.7% (33/36) — genuinely near the 90% cutoff, unlike German or
French which sit near 100%. Found the exact and ONLY affected lesson in the whole corpus:
`tp_17879184840560000089` ("Een schoon bad"), the one Italian grammar lesson containing an
s+consonant-initial masculine noun (specchio, spazzolino).

Fixed with dual dedup in `_forEachGrammarItem` — `seenArrays` (catches `items` vs. the same lesson
reached again via `APP.lessonData.lessons`, always the same object by construction) plus
`seenLessonIds` (catches the open chapter's own lesson reached a THIRD time via `APP.savedList`,
where a separately-fetched copy of the same topic is a DIFFERENT object with the SAME lesson id).
Verified against the real corpus: zero of 24 article-bearing grammar lessons now flip verdict
depending on which one is "open"; the affected lesson's sample size now matches the unbiased,
lesson-independent baseline EXACTLY (n=36, was inflated to n up-to-46 depending on bias). New
corpus-independent fixture added (`unit-article-choices.test.js` §2b) so this stays covered
regardless of what `lessons.json` contains in the future. Mutation-tested: reverting the fix
reproduces the EXACT predicted wrong numbers (32 instead of 24) in the new test.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. Item
   W's own section (✅ SHIPPED across six cuts, `v86_o`-`v86_t`) if you need that history; **items
   AG/AH/AI** (CP2-quality/cost/curation-UI follow-ups, scoped not built) if picking those up.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface — `v86_t`'s `_comicPanelsFlatTextHtml` rename is STILL not reflected there (carried
   forward again; small, doc-only, keeps getting bumped for higher-priority work).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 293 checks
node test/run.js --quick                  → expect 251
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-article-choices` is GREEN now — if it goes red again, it is a NEW finding, not the same known
issue; do not assume it's the `v86_u` bug recurring without checking (this cut's fix is
corpus-independent and covered by its own fixture, so a fresh red here means something else changed).

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 704 `en` keys** — an inherently live
snapshot for the topic/storyline counts (the user's own live server was actively generating/editing
content WHILE this cut's own test suite ran, causing the count to swing to 337/98 and back to 336/97
mid-session — re-measure fresh at commit time if `unit-roadmap-version` disagrees, don't assume a
stale number is the guard's fault, and don't chase every transient fluctuation from concurrent live
usage). No new `en` keys this cut. `canonical-analysis.json` untouched this cut. `lessons.json` DID
change content during this cut (real, concurrent user activity on their own running server), but the
fix itself touched no lesson/topic data. `docs/index.html` rebuilt after the `APP_VERSION` edit, and
again after the corpus settled, to stay in sync with `lessons.json`. `APP_VERSION = 'v86_u'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-14 added across the
`v86_o`-`v86_t` cuts, see those releases' own sections for the reasoning)

1. **A helper written to be safe for one consumer (dedup-free traversal feeding a `Set`) is not
   automatically safe for a DIFFERENT consumer of the same helper (a COUNTING consumer)** — new this
   cut, and the entire root cause: check what invariant a shared helper actually provides, not just
   what it happens to return correctly for its first caller.
2. **When a heuristic threshold produces an unexpected verdict for one specific language, ask whether
   that language has a REAL linguistic property near the threshold before assuming a bug** — it can
   be both: a real edge (Italian's phonologically-split article) AND a real bug (triple-counting)
   compounding at the same threshold. This cut needed to establish both halves separately.
3. **Reproduce against the REAL object graph, not a naive re-serialization**, when verifying a fix
   that depends on reference identity — a first verification script here re-parsed JSON separately
   from `APP.lessonData`, silently breaking the very reference-sharing the bug depended on, and
   produced a MISLEADING "still broken" result until rewritten to match the real app's own object
   graph (`APP.lessonData` pointing at the SAME object already in `APP.savedList`).
4. **Mutation-test every guard you write or rely on** — reverting this cut's fix reproduced the exact
   predicted wrong number, not just "some" failure; that precision is what makes the guard trustworthy.
5. **A carried-forward open item stays worth investigating even after many cuts of deferral** — this
   was flagged at `v86_m`, carried through eight more cuts as "not yet investigated," and turned out
   to be a real, findable, fixable bug the whole time, not corpus noise.
6. **Measure before editing** — the 91.7% Italian ratio and the exact single affected lesson were
   both established by running real queries against the real corpus before writing any fix.
7. **Guard at the layer where the claim is observable** — the new test fixture asserts the actual
   `sampleSize`/`predictable` OUTPUT of `_articleStatsFor` for a hand-built minimal case, not a proxy.
8. **Ask before restarting a dev server you did not start.**
9. **When a fix targets ONE known write path to some piece of state, check whether OTHER write paths
   to the SAME state exist before considering the class of bug closed.**
10. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
    made — don't override it with same-session optimism without a real reason.**
11. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
    and their real costs, don't just build the first thing asked.**
12. **When enriching a shared pipeline stage (CP2) for one consumer's need, check what ELSE consumes
    it before designing the enrichment.**
13. **When two views are meant to look the same except for one specific difference (colour/
    highlighting), share the ACTUAL WRAPPING MARKUP, not just similar-looking parallel code.**

# WHERE TO START

- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; no
  code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s item W row** needs a small update for `v86_t`'s `_comicPanelsFlatTextHtml`
  rename — cheap, doc-only, carried forward again this cut.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed).
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P** needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which never got it (only the completion/progress card panel did).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for both the
comic-panel subsystem and item W's whole CP1/CP2 browser-integration surface (`v86_t`'s rename not
yet reflected there); other sections are kept current inline as each cut touches them.
