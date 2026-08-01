# Dreizunge — internals

The engineering counterpart to `DOCUMENTATION.md`. That file explains what the app *does* — the
three layers, how to generate, the feedback loop. This one records **what is true about the code
right now**: the constants worth tuning, the ways things fail silently, the invariants that look
like implementation details but are load-bearing, and the limits of the test harness.

**Read this instead of grepping the session notes.** The notes in `build_history/` are the
narrative record of *why* each decision was made and stay authoritative for that. This is the
reference for *what holds now*. Where the two disagree, the code wins and this file is stale —
please fix it.

Every entry below was found by measurement or by a test failing, not by reading anything. That is
the gap this document exists to close.

Last verified against **`v72`**.

---

## 1. Tuning knobs

| Constant | Where | Value | What it buys |
|---|---|---|---|
| `NUM_CTX_MAX` | `llm.js` | 16384 (env `OLLAMA_NUM_CTX_MAX`) | Context-window ceiling. See §1.1 |
| `OLLAMA_TIMEOUT` | `llm.js` | 720000 (12 min; env `OLLAMA_TIMEOUT`) | Base request timeout, clamped 30 s–60 min |
| `CHAIN_STORY_CHARS` | `server.js` | 40000 | Chain-story budget for comprehension |
| `THINK_TOKEN_MULT` / `THINK_TIMEOUT_MULT` | `server.js` | 2.5 / 3 | Applied when a role's reasoning is ON |
| `THINK_MIN_TOKENS` | `server.js` | 3000 | Floor for a thinking call's token budget |
| lesson token base | `server.js` | 3200 | Passed to `callLLMLesson`; ×2.5 when thinking |
| `MIXED_ROUND_CAP` | `index.html` | 30 | Max questions in one mixed sitting |
| `FAMILIAR_SHARE` | `index.html` | 0.15 | Share of a round spent on already-solved material |
| builder cap | `index.html` | 14 | Grammar/conjugation round size |
| coverage target | `index.html` | 0.8 default | Overridable per topic, per storyline, or globally |
| `NEEDED` / `CAP` | `index.html` | 15 / 120 | Qid-universe convergence: stop after 15 stable rounds, never exceed 120 |

### 1.1 `NUM_CTX_MAX` — the one with a real cost

`num_ctx` is how many tokens the model holds at once, **prompt and reply together**.

The comprehension call reserves ~8,000 tokens for the reply plus headroom; everything left is
story:

| ceiling | story chars that reach the model |
|---|---|
| (pre-`v71_t`) | 6,000 — hard cap |
| **16384** (default) | **~24,000** |
| 32768 | ~76,000 — exceeds `CHAIN_STORY_CHARS`, so nothing is trimmed for context reasons |

For scale, the longest chain in the bundled corpus is 46,758 chars (14 chapters).

**The cost is memory.** The KV cache scales linearly with context. Rough figures for an 8B-class
model at fp16 — *varies a lot by model size and quantization, treat as an order of magnitude*:
4096 ≈ 0.5 GB, 16384 ≈ 2 GB, 32768 ≈ 4 GB. That sits on top of the weights (~5 GB for an 8B at Q4).

Mitigations already in place: `num_ctx` is sent **only when a caller passes `opts.ctxTokens`**, and
today only `generateComprehension` does. Every other call keeps Ollama's default and its existing
memory profile.

**Unverified caveat.** Ollama keys its loaded model instance partly on load-time options, and
`num_ctx` is one of them — so alternating between large-context and default calls *may* force a
reload. Not measured (no live Ollama in the dev container). If comprehension generation is slow to
*start* while other types are fine, suspect this first.

---

## 2. Silent failure modes

The dangerous class: things that produce a plausible result while doing the wrong thing. Nothing
throws, no test necessarily fails, and the output looks fine.

**Ollama truncates an over-long prompt with no error.** Default `num_ctx` is ~4096. Exceed it and
the request still succeeds — the model just answers from whatever fragment survived. This is why
`v71_t` had to add context sizing *before* removing the story caps: deleting the app-side cap alone
would have moved trimming from our code (which keeps the current chapter whole) into Ollama's
(which cuts blindly and reports nothing). **Any change that makes a prompt bigger must size the
context window in the same commit.**

**A standard/vocab lesson has no `type` field.** It is the default shape. So `l.type === 'standard'`
is *always false*, and any assertion written that way is vacuous. Use `(l.type || 'standard')`. This
bit inside the very test written to catch a vacuous pass (`v71_u`).

**A new lesson type without a `fake-ollama` branch is skipped invisibly.** The arc loop deliberately
refuses to abandon a run for one failing type, so the omission looks like nothing happened.
`comprehension` shipped in `v71_l` and was untested end-to-end until `v71_u`. When adding a matcher,
place it **before** any looser one that could swallow it — `correctIndex` is shared by comprehension
and word_forms.

**`callLLMLesson` spreads the caller's opts AFTER its think policy.** So a caller passing
`timeoutMs` or `tokens` *overrides* the ×3 / ×2.5 that reasoning mode applies. "Raise the timeout"
is easy to write as a reduction — this happened during `v71_t` and was caught before shipping. If
you pass either, use the multiplier so it can only ever raise.

**A builder that caps is sampling.** Grammar and conjugation ended with `shuffle(exs).slice(0, 14)`,
which read as "deterministic" for two releases while cutting a complete pool at random — ~53% of
every replay re-asked solved questions (`v71_r`). "Deterministic" and "needs no coverage handling"
are different claims.

---

## 3. Invariants

Load-bearing rules that look like details. Breaking one usually produces a plausible-but-wrong
result rather than a crash.

**`_derivingUniverse` means: full set, no cap, no coverage bias.** When this flag is set a builder
must return *every* question it can produce. Grammar and conjugation ignored it until `v71_r`,
forcing the coverage denominator to be rediscovered by up to 120 re-derivations.

**A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the *last counted
lesson* so the vocab recap resolves. Nothing was answered. Anything that **judges** the learner —
records a done-flag, locks Next, counts an exposure — must be behind `!C._review`. Three separate
bugs from this shape (`v71_n`, `v71_s` twice).

**`collectChainStory` trims from the OLDEST end and keeps the current chapter whole.** Questions
are set on the chapter just read, so that text must survive. Any trim added elsewhere must preserve
this direction — the last-resort context fit in `generateComprehension` cuts from the front for
exactly this reason.

**Comprehension is gated BY the story, so it cannot gate it.** `storyUnlocked()` is the narrowed
gate (everything except story-gated types); `setComplete()` is the whole chapter. The circularity
was **two-layered** — the lesson list *and* the coverage denominator — and fixing only one leaves it
intact at any pass mark below 1.0 (`v71_s`).

**A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule that
refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
silently means "replay this".

**One rule per question.** Recurring failure mode: a second copy of a rule that then drifts.
Consolidated cases — `_itemWithheld` (had three spellings), `chapterComplete`, `_setCompleteRaw`
(narrowed by parameter, not duplicated), `_mixedSkips`, and the storyline page's connector line and
progress-bar colour (`v71_w`).

That last one is the clearest illustration of why this matters, because the two rules **diverged in
both directions** and nothing failed for two releases:

| case | shared `chapterComplete` | raw `every(ls => done[ls.id])` |
|---|---|---|
| mixed-driven chapter, all visible lessons done | `true` | `false` — too strict |
| every done-flag, coverage below the pass mark | `false` | `true` — too permissive |

The second row is the exact `v69_l` bug, still live on the storyline page long after it was fixed
for the gate. Both symptoms are quiet — a connector line or bar colour that lies about an unfinished
chapter is only visible in a browser.

**Corollary:** a progress *fraction* ("how much have you played") is a legitimately different
question from completeness and may stay a raw count — but any signal that asserts **finished**
(a colour, a lock, a tick) must read the shared rule.

---

## 4. Design principle — no language knowledge in the code

**Established session 23.** The code should not encode facts about particular human languages.
Producing correct language content is the model's job; instruct it in the prompt instead.

Where this bites, and why: a per-language table has to be written by whoever is editing the code,
and it is wrong in ways that are invisible until a native speaker looks. It also scales badly —
every new language needs an entry, and a missing entry fails silently rather than loudly.

**What counts as language knowledge (avoid):** article lists, gender rules, pronoun sets,
plural/inflection rules, "which languages use articles", sentence-final punctuation sets, anything
that decides whether content is *correct*.

**What does not (fine):** mechanical and typographic facts that decide how text is *handled* —
Unicode normalisation, script/RTL detection, which script a language is written in, diacritic
folding for comparison. These are properties of the encoding, not judgements about the language.

The line: **does this decide whether content is right, or only how it is displayed/compared?**

### Where should language knowledge live? Four tiers

"Move the table to a JSON file" is not progress on its own — a file still has to be **authored** by
someone asserting a fact about a language they may not speak, is still wrong in ways invisible until
a native speaker looks, and still fails silently for any language missing an entry. The cost is in
authorship, not location. What a file *does* change is who can correct it: a native speaker can edit
JSON; nobody can reasonably ask them to edit a 15,000-line `index.html`.

In preference order:

1. **The model, at authoring time.** Instruct it in the prompt. Best where a model is in the path.
2. **Derived from what the model already produced.** Read the corpus rather than a table.
   `_articleChoicesFor` (`v71_x`) collects every article seen on any grammar item in that language.
   No authorship, self-correcting as the corpus grows, and — importantly — **works offline in the
   static build**, because the knowledge is baked into data rather than fetched from a model.
   This tier is easy to forget and is usually the answer.
3. **A hand-authored data file**, only where neither of the above is possible: a genuinely LLM-free
   path. `scripts.json` is the legitimate case — the intro "learn the script" course has no model
   available, so the letter tables must come from somewhere. Note it also documents what it
   deliberately omits (`_stub_comment`: Thai is not reducible to a letter→sound table). A tier-3
   file must declare its own limits.
4. **A hand-authored table in code.** Never. This is what `ARTICLE_CHOICES` and `VOCAB_ARTICLES`
   were.

`languages.json` is not on this ladder: names, flags and BCP-47 TTS codes are registry data, not
linguistic rules.

Evidence that tier 2 beats tier 4 rather than merely matching it: replacing `ARTICLE_CHOICES` with
corpus-derived choices took article MCQs from **15 of 20** grammar lessons to **19 of 20**, because
the table covered de/fr/it/es/pt/nl/ru and nothing else.

### A useful shape: deterministic scan + model adjudication

Tier 2 (derive from the corpus) and tier 1 (ask the model) combine well when a check is **cheap to
generate candidates for and expensive to decide**. The diacritic QC (`v72`) is the worked example:

- A Unicode-only scan finds every word whose accent-stripped form matches an accented form
  elsewhere in the corpus. Deterministic, free, no language knowledge, high recall.
- That produces **5 candidates corpus-wide**, most of which are MINIMAL PAIRS — real distinct words
  differing only by a diacritic (`souffle` breath / `soufflé` the dish; `inizio` beginning /
  `iniziò` he began). Deciding typo-vs-word requires knowing the language.
- So the model adjudicates only the survivors. Cost is negligible; precision is the model's.

The roadmap originally specified a capitalisation rule to settle it (`Zahlen` / `zählen`). That
works only because German capitalises nouns — a language fact in disguise. It is kept as a free
pre-filter, never as the decision.

**Default to OK on anything unclear.** A missed typo is cosmetic; a false flag trains the user to
dismiss the whole QC panel, which costs the checks that do work.

### Known violations, in order of harm

1. ~~**`VOCAB_ARTICLES` + `normalizeVocabArticles` (`server.js`)**~~ — **removed in `v71_y`.**
   It ran on every generated lesson, held article lists for 12 languages, and could only ever
   STRIP: `la grandine` / `hail` became `grandine` / `hail`, dropping the gender an Italian learner
   needs while its symmetric siblings (`il tempo` / `the weather`) kept theirs — the code made
   lessons *less* consistent than it found them.
   Article symmetry moved into the QC pass (`qcCheckPair`), which is tier 1 done properly: it sees
   the lesson's other pairs so it can follow their convention, can fix EITHER side, and **proposes
   rather than rewrites** — a wrong call lands in the flag UI instead of silently in the data. It
   also handles bound definiteness markers (Arabic `ال`) as a stated property rather than by
   omitting Arabic from a table, so it holds for languages nobody listed. The generation prompts
   still require symmetry, so QC is the safety net rather than the only defence.
2. ~~**`ARTICLE_CHOICES` (`index.html`)**~~ — **removed in `v71_x`.** Distractors now come from
   every article the model has produced in that language (`_articleChoicesFor`, nearest source
   first). Worth recording that this was strictly better, not a compromise: article MCQs now build
   in **19 of 20** grammar lessons against **15** with the table, because the table covered
   de/fr/it/es/pt/nl/ru and nothing else, so English lessons could never build one. Hebrew still
   builds none — one definite article, no indefinite — a fact nobody had to write down.
3. **`_sentenceUnits` splits on `.!?…` only** (`index.html`) — already logged separately: Arabic
   uses `،` `؛` and often none of these. Borderline (punctuation is arguably typographic), but it
   decides where a sentence *is*, which changes content.

Not yet actioned — recorded so the next change in this area does not add to the pile.

### Consequence for the deterministic vocab QC item

The roadmap's article-mismatch rule **cannot be built as specified**: detecting "source has an
article, target does not" requires exactly the per-language table this principle rejects. Evidence
that the table is the hard part: two attempts at one during the session that produced this entry
were both wrong — `le` matched the prefix of `legge`, and a missing English entry made 19 perfectly
symmetric pairs look like violations. Either would have "fixed" correct data.

The umlaut rule is unaffected: it compares corpus forms against each other and encodes no rule about
German.

---

## 5. Test harness limits

**`lib-dom`'s `querySelectorAll` matches TAG names only**, over the tree parsed from `index.html`.
It does **not** parse `innerHTML` assigned at runtime. So anything rendered by setting `innerHTML`
— including every tick-list built by `renderLessonTypeChecks` — cannot be read back headlessly.
Assert on the produced markup string instead, and note the boundary. Extending `lib-dom` to parse
runtime `innerHTML` would fix this for every future picker test; it touches every harness in the
suite, so it wants its own session.

**Values cross a vm realm boundary.** An array built inside the sandbox has a different
`Array.prototype`, so `assert.deepStrictEqual(x, [])` fails on the prototype check alone even when
the contents match. Compare `.length`, or contents element-wise.

**Some functions are extracted in isolation** by unit harnesses (`ext(html, 'fnName')` + `new
Function`). Any helper such a function references must be `typeof`-guarded, or the harness gets a
`ReferenceError`. Follow the existing convention — degrade to the older behaviour, which is the
safe direction.

**`APP.cur` has a default (`lessonIdx: 0`) that sections silently depend on.** A test needing a real
index must **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or
`delete` the object. Mutating also mirrors production, where `openLesson` sets `C.lessonIdx = idx`
immediately before `buildExercises(idx)`.

**The corpus is not a constant.** Any scenario leaning on "the first topic/lesson of type X in
`lessons.json`" breaks when the data is replaced. Prefer hand-built fixtures for anything needing
exact counts — and if a section only means something when the corpus contains a particular case,
**assert that the case was found**, or the section goes vacuous on new data.

**Wiring changes need a run, not source assertions.** When one side sends and the other consumes,
assertions on each half prove nothing about the join. In `v71_u` the server could ignore `arcTypes`
entirely with the whole 156-check suite green. If a change is "A now passes X to B", the test must
observe **B's output** — usually an e2e against the live server + `fake-ollama`.

---

## 6. Where things live

| | |
|---|---|
| `index.html` | The entire client — UI, builders, coverage model, progress. Single inline `<script>` |
| `server.js` | HTTP routes, generators, job runner, store persistence |
| `llm.js` | Ollama/OpenAI transport, timeouts, `num_ctx`, think options, JSON salvage |
| `lessons.json` | The store: topics, lessons, storylines |
| `docs/index.html` | Static build — `node build-static.js lessons.json docs` |
| `test/run.js` | The suite. `node test/run.js` |
| `test/check-inline.js` | Parses the inline script; run on **both** `index.html` and `docs/index.html` |
| `test/lib-dom.js` | Headless DOM stub for client unit tests |
| `test/lib.js` | Live-server + `fake-ollama` harness for e2e |
| `build_history/` | Roadmap + per-session notes (the narrative record) |

**Definition of done** for a change is in the roadmap's session-protocol block, not here.

---

## 7. Maintaining this file

Add an entry when a session discovers something a future session would otherwise rediscover:
a constant worth tuning, a way something fails quietly, an invariant that is not obvious from the
code, or a harness limit that shaped how a test was written.

**Reference sections by NAME, not number.** Sections get inserted (the design principle became §4
in session 23, pushing three others down), so `§4` in an older note may point somewhere else
entirely. Release tags are stable; section numbers are not.

Keep the *why* in the session notes and link to it by release tag. Entries here should be short and
checkable — a number, a rule, a named function. If an entry cannot be verified against the code in
under a minute, it is probably narrative and belongs in the notes.
