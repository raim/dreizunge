# Session 32 — opened at the `v78` cut, shipped `v78_b`

Short session. Most of it went into the baseline, which was red for a reason worth writing down,
and the rest into one group-B item plus one guard that replaces a note that had failed four times.

**Closing state:** `APP_VERSION = 'v78_b'`, suite **194** (`--quick` **170**), `check-inline` 0 on
both builds, `docs/` rebuilt.

---

## 1. The red baseline was a finding, not a chore

`node test/run.js` opened at **192 checks, 2 failed** — `unit-static-freshness` and
`unit-script-choice`. Both are the guards the prompt and HANDOVER tell you to clear with a one-line
fixer. I nearly did that. The reason not to: **HANDOVER records both as already cleared AT the v78
cut**, so a fresh red is either a second data drop or something else, and the fixers are not
diagnostics.

What the evidence said, in the order it arrived:

- **Corpus size had NOT moved.** 308 topics / 86 storylines — exactly the numbers HANDOVER records
  for the cut. So "a new data drop arrived" was already doubtful.
- **`lessons.json` was the OLDEST file in the tree** (17:19; everything else 17:23). A file that had
  just been rewritten by `backfill-script.js --write` would be the newest. (Session-29 rule 4:
  timestamps are evidence, and cheap. They were the whole first half of this diagnosis.)
- `unit-static-freshness` named exactly one stale input: `lessons.json`, docs built from
  `919bcac2cbcb`, on disk `dfa8a16082be`.

**First hypothesis, and it was WRONG.** I guessed the shipped `lessons.json` was simply the
*pre-backfill* copy — that packaging had picked up the file from before the cut's stamping run, and
that everything else in the tree was post-backfill. That predicts a specific, checkable thing: run
the backfill and the hash should come out at `919bcac2cbcb`. It came out at `d3c6c01027d7`. So
`docs/` was built from a corpus that is neither the shipped file nor the shipped file plus stamps.

Worth stating plainly because the hypothesis was *plausible and cheap to check, and checking it is
the only reason the real answer got found*. Had I run both fixers on the strength of it, the tests
would have gone green and the actual difference would never have surfaced.

**What was actually different.** I extracted the corpus baked into `docs/index.html` (bracket-matched
out of `const STATIC_LESSONS = …`) and diffed it topic by topic against disk:

| | |
|---|---|
| topics in both | 308, same ids, none added or removed |
| topics differing | **9** |
| 7 of them | disk has an **`ai_error_hunt` lesson** the baked copy lacks |
| 2 of them | an edited `synonyms` / `word_forms` lesson, `updatedAt` **~80 minutes newer** on disk |
| present only in `docs/` | nothing except the older copies of those two edited lessons |

So the shipped `lessons.json` is the user's **newer working file**, and `docs/` was a corpus behind
it. The `ai_error_hunt` lessons come from the story-QC acceptance path (`/api/story-qc/accept`),
which mutates the topic in place and calls `saveStore` — consistent with the user having run story
QC after the cut's build.

**Two consequences that matter more than the fix:**

1. **Order matters, and the obvious order is wrong.** Running `build-static.js` first — the fixer the
   freshness failure literally asks for — would have baked the UNSTAMPED corpus into `docs/` and
   overwritten the only remaining copy of the pre-drop baked state. Backfill first, rebuild second.
   Nothing in HANDOVER says this, because HANDOVER lists the two guards independently.
2. **The freshness guard did exactly the job it was written for.** `unit-static-freshness`'s header
   comment describes the failure as "a static build on GitHub Pages quietly serving an older corpus
   than the live server, which nobody sees until a chapter is missing." That is precisely what was
   in the tree: seven topics whose error-hunt lesson existed live and not on Pages.

**Verified before rebuilding** that nothing existed only in the baked copy, so the rebuild could not
lose user content. Baseline then confirmed at the documented **192 / 168 / 0 / 0**.

### Rule earned (23)

**A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** When a
guard's remedy is a single documented command, running it destroys the evidence that would have
said whether the remedy was right. Check what MOVED first — here, three cheap facts (corpus counts,
mtimes, the named hash) narrowed it before any file was written. Corollary, learned the hard way in
the same hour: **when the remedies interact, the order is part of the diagnosis.**

---

## 2. `v78_b` — synonym/antonym questions state how many words to find

User testing note, group B: *"Synonym/antonym questions should state how many are to be found
('<n> similar to <word>')."*

`syn_select` is **the only multi-select exercise in the app**. Every other type is answered by one
tap or one typed string, so "have I finished answering?" never arises. Here it does, and there was
no signal: a learner who had tapped one of three correct words had nothing telling them two
remained, and Check scored the round. The question was testing a guess about the QUESTION rather
than about the vocabulary.

The prompt now reads **"3 similar to Haus"**. The count is `ex.correct.length` — the same array
`check()` scores against (`ex.correct.some(...)`) — so the number displayed and the number required
cannot drift apart. `unit-syn-count` §3 asserts that join by rendering and scoring the same object.

**A NEW key, not a reworded one.** `ex.syn.q_synonyms_n` / `ex.syn.q_antonyms_n` sit beside the
existing uncounted keys rather than replacing their English values. `translate-ui.js` fills keys
that are **missing**, not keys whose English value **changed** (session protocol, DoD item 3), so
editing the old values in place would have left the other 31 languages rendering the uncounted
prompt indefinitely, with nothing flagging it. The uncounted keys stay live as the fallback below.

**Fallback, and why it is not defensive clutter.** The builder guarantees a non-empty `correct`
(`if(!correct.length) return null`), but `tSynSelect` is also reachable from edited and imported
lesson data where it is not. A zero or missing count falls back to the uncounted key rather than
rendering "0 similar to" or "undefined similar to". §4 is the section that catches this, and it is
the section that caught a real mistake under revert (below).

### Revert-verification — and the part that needed a second pass

Reverting the render fails §1 as a named assertion carrying the actual markup, not a `TypeError`.

But §1 aborting the file means **§2–§6 were never executed** under that revert (v71_r: "a failure
appearing after you fix another one may not be new — it may be running for the first time", from the
other direction). So each later section was verified separately against a revert it alone could see:

- **§6 (`docs/`)** — restored `index.html`, left `docs/` built from the reverted client. §1–§5 pass,
  §6 fails naming `node build-static.js`. Discriminates.
- **§4 (fallback)** — first weakening I tried (`(ex.correct||[]).length` instead of
  `Array.isArray(...)`) is **behaviourally equivalent**, and the section correctly still passed;
  that is not a vacuous pass, it is a non-difference. The real failure mode is using the `_n` key
  unconditionally, which renders "0 similar to" — §4 fails on exactly that, with §1–§3 still green.

Recording the equivalent-weakening attempt because "I reverted something and the test still passed"
reads as a failed guard and here it was the guard being right.

**How to see it work** (browser): open any storyline chapter with a `synonyms` lesson — e.g. the
`synonyms` lesson on *Das Ich trifft das i=√(-1)* (`tp_579238210`) — and play to a synonym or
antonym question. The green/red prompt line above the tiles now begins with a number: *"2 similar
to …"*. Tapping fewer than that many and pressing Check still scores as wrong, as before; the
change is that the learner can now see how many the round is asking for. Tile count is unchanged,
so the number narrows the question without answering it.

---

## 3. A note NOT acted on — it presupposes a feature that does not exist

Group B: *"Sentence-translation read-out should include the `\"Übersetze: \"` prefix (tp_579238210) —
read the whole question in the source language."*

`Übersetze: "{sentence}"` is `ex.order.q`, the **word-order** exercise: the question is the source
sentence and the learner orders target-language tokens. Everything in that question is in the
source language, which fits "read the whole question in the source language" exactly.

**But there is no read-out of it.** Enumerated every `speak()` / `speakLang()` / `speakBodyText()`
call site in the client: `renderEx` auto-speaks only for `listen_mcq` and `listen_type`, and speaks
`ex.target`. `tOrder` renders no speaker control at all, and no question-level read-out exists for
any exercise except `tRead`'s 🔊 (which speaks the target sentence, not the question).

So the note is either **(a)** a request to ADD a question read-out to the order exercise, in the
source language, including the prefix — a new affordance, not a prefix fix — or **(b)** about a
different screen than the one I found. Group B triage read it as a small fix to an existing
read-out; on the code that reading does not hold.

**Owed by the user: which of the two.** Guessing here would have built an affordance nobody asked
for, on the reasoning that the note implies one. Left untouched.

---

## 4. The protocol's version sentence — a note replaced by a guard

The session-protocol block carries one version-specific sentence naming the release line it belongs
to. `roadmap_v78.md` said **"This is the `v77` line"**, and the very next line said "this file stays
current through the whole **v77** line".

The roadmap's own parenthetical documents this having happened at `roadmap_v73.md` ("the v72 line")
and `roadmap_v76.md` ("the v75 line", for its entire run). Each correction ended with a note asking
the next session to check it again. **It was missed again at the v78 cut, in both sentences** —
the fourth failure, and the second sentence had survived every previous correction because each one
only fixed the first.

Corrected, and then replaced as a mechanism: **`unit-roadmap-version`** asserts that the
highest-numbered `roadmap_v*.md` names the same base version as `server.js`'s `APP_VERSION`, in
every sentence that names one. Both sentences revert-verified separately against the exact
historical mistakes (`v77` in sentence 1; `v77` in sentence 2), each failing while the other passes.

The roadmap finds itself by NUMBER rather than by name, so the guard survives the next cut without
being edited. It also fails usefully at a base bump — a new base version with no matching roadmap
is protocol item 7 not yet done, and it says so.

### Rule earned (24)

**A note instructing the next session to check something is not a guard.** Four repeats of the same
stale line, each ending in a fresh reminder, is enough evidence that the reminder was never the
mechanism. If a fact can be derived from a source of truth, assert it; the reminder is what you
write when you have decided not to.

---

## 5. New `en`-only keys — OWED to the translate pass

| key | English |
|---|---|
| `ex.syn.q_synonyms_n` | `{n} similar to {word}` |
| `ex.syn.q_antonyms_n` | `{n} opposite to {word}` |

Both carry two placeholders (`{n}` and `{word}`); a translation that drops `{n}` silently loses the
whole feature for that language, so it is worth a glance when the file comes back.

`unit-syn-count` §5 asserts they are en-only. **Per the protocol, that half of the section is
correct only while the keys are NEW** — when the translate pass returns, flip it to "no language
holds the English string verbatim" (`v71_q`: never assert a dropped key absent). Flagged in the
test's own comment so it is not read as permanent.

The uncounted `ex.syn.q_synonyms` / `ex.syn.q_antonyms` remain in use as the fallback and are
already translated — do not delete them.

---


---

## 7. The second data drop (session 32, mid-session) — `ui.json` + `lessons.json` + `learners.json`

The user sent a translated `ui.json` and current data. **Validated before merging**, per DoD item 3
and rule 23 — the ordering matters because a merge is not reversible without the previous copy.

**`ui.json`, the returning file.** 32 languages, none added or removed. `en` came back at **612 keys
against the tree's 614** — exactly the "did a key vanish" case the protocol names. The difference
was entirely the two `v78_b` keys, which the file predates: **no `en` key vanished, and no `en` value
had drifted** (0 changed). Safe to take wholesale.

What it gained: **`sr` went 0 → 612, fully translated.** `hr` is still 0. The other 30 languages are
unchanged, each still missing the same 14–16 accumulated keys. The `sr` pass is genuine, not English
passed through — 19 values identical to `en`, in line with `de` (28) and `it` (26).

**Flagged, not assumed: the `sr` UI is 100% Latin script, 0 Cyrillic characters.** Plausibly what the
user wants, but `sr` is the one digraphic language in the corpus and they have just built a
Latin→Cyrillic storyline, so it is worth a confirmation rather than a guess.

**`lessons.json`.** 308 → 309 topics, 86 → 87 storylines; 2 new topics, 1 removed, 2 new storylines,
1 removed. Both data guards fired again, and this time **the diagnosis was already written** — the
freshness guard named only the two files just replaced (no surprise third input), and the script
guard named **the same two `sr` topics as the previous drop**. That confirms the earlier reading:
the backfill runs in the container, the user runs from their own copy, so the stamps are lost on
every round-trip and `backfill-script.js --write` is a **per-drop step, not a one-off repair**. Now
recorded as such in HANDOVER. Backfill first, then `build-static.js`. No test needed correcting.

**`sl_56647998` arrived with it** — the storyline from the user's script-lesson report:
`tp_17862984310970000000`, `lang sr` / `script cyrillic-sr` → `srcLang sr` / `srcScript latin`, both
fields stamped by the v76_i picker. **So §7 now has a real reproduction case in the shipped corpus**
rather than a synthetic one, and the fix is testable against the data that prompted the report
(v70_n's rule, from the good direction for once).

## 8. `v78_c` — the `--langnames` crash

`isBlocking` is `issues => issues.some(i => i.severity === 'error')`: it takes the whole ARRAY. The
`--langnames` writer called it as `issues.some(isBlocking)`, so it received one issue OBJECT per
invocation and evaluated `issue.some(...)`.

**Why it shipped, and why the mode's own guard was green: it is unreachable on the happy path.**
When a name validates, `issues` is empty, and `[].some(fn)` never invokes `fn` at all. The defect
only exists once a name is REJECTED. That is the same shape as `v76_c` — in the same mode — where
`--langnames` shipped broken because only its no-op `--check` path had ever been run. The other two
call sites in the file were already correct, which is the tell: the mistake was made once, at the
site nobody could reach.

`unit-langnames` §4 forces a rejection (the model answers with an empty string for one code) and
asserts the run **completes**, reports the rejected cell, does **not** write the bad value, and
still writes the good cells in the same and later batches — the last of these separating "handled
the rejection" from "gave up quietly". Under revert it reproduces the user's exact message.

Not affected: the survey. The 119 missing cells were counted correctly, and `v76_f`'s per-batch save
means the `lb` names earned before the crash were kept.

## 9. `v78_d` — conjugation distractors

The wrong-answer pool was `shuffle([...wrongSameVerb, ...wrongOther])` — a UNION with every form of
every other verb in the lesson, capped at three. Because it was **shuffled**, the intruders crowded
out the real paradigm even when the verb had six forms of its own, so this was not a rare fallback:
it was the common case in any lesson carrying more than one verb.

Measured under revert on a two-verb Italian fixture: `essere (voi)` → **`siete / parli / parla /
parlano`**. Three of four from `parlare`. A learner answers by matching the stem to the infinitive
and never looks at the paradigm — a vocabulary question wearing a grammar badge.

Now same-verb only, and **no padding**: a verb with two contrasting forms asks a two-option question
rather than being topped up from a neighbour.

**Checked for the v71_s trap** — "when a builder is narrowed, narrow the COVERAGE UNIVERSE to
match", because a form that yields no MCQ leaves its universe key unreachable. It holds without
change: a fully syncretic verb merges to ONE `cleanForm`, so its only index is 0 and `fi % 3 === 0`
still emits the typed variant; any verb with more than one distinct form gives every form a
same-verb distractor. Asserted (§5) rather than argued.

§1 and §4 revert-verified **independently** — §4 by a targeted weakening that pads only when short,
which passes §1 and fails §4, which is the only combination that proves §4 is not riding on §1.

## 10. `v78_e` — chapter-level clear-progress, and a third copy of the `v77_s` bug

The user's note carried its own trap: *"reuse it, do not re-implement, or the new button will forget
`chapterDone` all over again."* **That was already true of code in the tree.**

`slBottomClearProgress` (storyline-wide) had the rule. `clearLessonProgress` (the lesson-set page)
was a **second, older implementation** — and it cleared `completed` and `solved` but **not**
`chapterDone` or `storyShown`, which is precisely the `v77_s` defect: clearing from that page left
every chapter still reading "finished". So the new control would have been a third copy, and one of
the existing two was already wrong.

Extracted **`_clearChapterProgress(topicKey)`** as the single rule; all three entry points call it.

**The guard asserts PARITY, not behaviour-in-isolation.** Wiping every chapter one-by-one must leave
byte-identical state to the storyline-wide wipe. That is what catches a future re-implementation
that drops a store — its own unit checks would pass, and the diff would not. Revert-verified by
reintroducing exactly the `v77_s` mistake: §1 and §2 still pass, §3 fails.

The card re-renders through **`showComplete(true)`**, the REVIEW render. A play render would
re-judge a chapter nobody just played and re-record the completion it had just erased — the third
time this shape has mattered (v71_n, v71_s, and here). §5 asserts the argument value, and
discriminates.

**Found on the way — a stale source pin.** `unit-qid-stability` §5 pinned two source PHRASINGS
(`delete APP.progress.solved[tp]`). The extraction renamed the variable to `topicKey` and the pin
broke **while the product was correct** — standing rule 18, arriving exactly as written. Retired
behaviourally rather than re-pinned to the new spelling, and the **replacement itself was
revert-verified** (session-29 rule 8: replacing a brittle pin is a change that needs verifying, and
the first replacement of the `if (!u)` pin was vacuous in a NEW way).

## 11. An incident: the roadmap was truncated to zero bytes

Writing a doc update, a Python heredoc contained emoji as `\ud83e\uddf9` surrogate escapes.
`str.encode('utf-8')` rejects lone surrogates, so the write threw **after** the file had been opened
for writing — leaving `roadmap_v78.md` at 0 bytes.

**`unit-roadmap-version` caught it on the very next suite run**, which is the first time that guard
(written earlier the same session, to retire a note that kept going stale) earned its keep. Restored
from the packaged `v78_b` zip and the later edits re-applied; the suite was green at 196 throughout,
so nothing shipped from the damaged state.

### Rule earned (25)

**Never put emoji — or any non-BMP character — in a string literal inside the script that writes a
file.** Write such blocks with a `cat` heredoc to a temp file and splice that file in, so the bytes
come from the file rather than from an escape the writer has to encode. And note the failure mode:
the exception arrives *after* truncation, so a "failed" write is not a no-op. **This is also an
argument for the packaged zip: it was the only intact copy of a file the working tree had lost.**

---

## 6. What the next session should know

- **Baseline for `v78_b`: 194 / 170 / 0 / 0.** Two new guards since the cut's 192.
- **The two group-B items I did not reach** are unchanged and still small: clear-progress at chapter
  level (reuse `slBottomClearProgress`, do not re-implement — `v77_s` fixed what it forgets), and
  conjugation options being alternative forms of the same verb. The word-form highlighting item
  still belongs with §0e/§3 and the one shared matcher.
- **The `Übersetze:` note needs the user** before anything is built for it (§3 above).
- **Expect the data-drop guards to fire again** on the next drop — but read §1 before reaching for
  the fixers, and run **backfill before build-static**.
