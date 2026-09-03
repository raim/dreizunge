# Session prompt — written at the `v88_a` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Point releases use an alphabetic suffix: `v88_b`, `v88_c`, … A bump to a new BASE
(`v89`) needs its own roadmap, per the protocol.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v88_aj`**. `roadmap_v88.md` was cut
at `v88_a` and is the current roadmap.

**IMPORTANT — the user is translating `ui.json` locally by hand.** Before adding or editing ANY `en`
key, tell them explicitly and let them pause first. Every cut in the `v87` line asked first and was
given an explicit budget (often fewer keys than proposed — e.g. three instead of six at `v88_a`).
Ask again fresh THIS session.

**The user's own server runs on port 3000 across sessions** and WRITES to `lessons.json` while you
work — it generated four chapters during the `v87` line, and twice that broke a test. Check
`git status --short lessons.json` at the start and again at commit time. `server.js` serves
`index.html` with `readFileSync` PER REQUEST, so a CLIENT edit is live on their server without
restarting anything; a SERVER edit is not — start your own instance on another port to verify, and
**kill it by PID** (`pkill -f "node server.js"` matches theirs too).

**What shipped at this cut**: `v88_r` — **the progress card's arrows now BROWSE chapters and a new
▶ plays** (user request). **ZERO new `ui.json` keys** — the budget the user chose when asked.

Built as an OVERRIDE, exactly as `v88_o` was: `showComplete()`'s gate chain computes what it always
computed, and `_browseApplyNav()` runs at the end of the render, MOVES that destination onto ▶ and
repoints → at the **adjacent** chapter. ▶ takes the chain WHOLE (in-chapter lesson, story-unlock
page, below-mark work, **and** the next unfinished chapter) — "continue the course"; → is free
browsing. The one branch ▶ withholds is the terminal one: ▶ greys, → carries the exit, so `v74_o`'s
"never a dead end" and `v77_f`'s finished card both survive. The within-chapter progression the user
asked to KEEP (vocab first, then comprehension/text-hunt to complete a chapter) was not touched —
only the chapter-wise lock went. ▶ sits in the ☰ popup as asked AND is mirrored beside the arrows
(`← ☰ ▶ →`), and `_captureNextAction`/`_storyTapMaybeAdvance` now read ▶ first, → second.

⚠️ **Two pre-existing defects were found by building it, and both are fixed here:**
1. **`_backToChapterProgress` has NEVER existed in the static build.** It sits above
   `@static-exclude-end`, so `docs/index.html` calls it and never defines it — the ← "previous
   chapter" button has been a `ReferenceError` in the published build since `v82_e`. `build-static.js`
   now supplies its own `STATIC_LESSONS` version.
2. **`renderEx` could crash on a review card.** A review render's synthetic `APP.cur` has no `cur`,
   and the length guard reads `C.cur >= C.exercises.length` — `undefined >= 0` is FALSE, so a stray
   speech-advance timer rendered `exercises[undefined]`. Latent until → started loading the next
   chapter asynchronously. Found because `smoke-render` exited 1 AFTER printing ALL PASSED.

Also: `_compEndForward()` extracted so the end-of-storyline destination is ONE rule with two askers,
and TWO more fixed-size source windows (`unit-progress-card-nav`, `unit-drill-ledger`) replaced with
structural bounds after failing in the false-positive direction. Eight test files migrated from
`comp-next` to `comp-play`. Full write-up: `roadmap_v88.md`'s own `v88_r` entry.

**`v88_s` shipped immediately after, completing the same user request**: the **chapter-wise
progress lock is GONE**, on BOTH surfaces that carried it — the storyline screen's 🔒 chapter cards
(`_renderChapterCard`'s `_isLocked`) and the storyboard panel click that silently REDIRECTED to the
last unlocked incomplete chapter (`_sbChapterTarget`). Neither ever fired live (both are scoped
`!canGenerate && !teacherMode`); the PUBLISHED build is where they had force, which is where the
students are. What remains is not a progress gate: `!isFirst && _sets.length === 0`, "this chapter
has no lessons yet". **ONE `ui.json` key REMOVED** across all 33 languages (the resume toast
explained a redirect that no longer happens) — hence 751, not 752.

`unit-storyline-lock-hardening` was RENAMED to `unit-storyline-chapter-access` and rewritten: its
assertions did not fail, they became assertions of the wrong thing. `unit-live-static-progress-parity`
was RE-ANCHORED (rule 29) — it observed `v74_i`'s shared-completion fix THROUGH the lock, and its own
non-vacuity check asserted the deleted rule was still running; the claim moved to the connector line,
where `chapterComplete` is still observable. Eight mutations red. Full write-up: the `v88_s` entry.

**`v88_t` then took the first two items of a NEW live-test batch the user handed over mid-session**:
the comic/image review card's extracted-text field is a resizable textarea instead of a single-line
input (it holds the whole body of a photographed sign, not a short caption), and the library sorts by
ONE key — the unconditional source-language pre-sort is gone, "my language" and "target language"
are two more options in the dropdown, and the flag headers follow the chosen key instead of always
naming the source language. Zero new keys. Two findings worth carrying: a comment inside a JS
TEMPLATE LITERAL must not contain backticks (`check-inline.js` caught it), and `_populateLibSelects`
had a branch no fixture had ever reached because `lib-dom` auto-vivifies a div with no `.options`.

**`v88_u` then shipped three of that batch's text-analysis items**: the explorer no longer AUTO-STARTS
an analysis (toggling a VIEW used to queue a multi-minute CP2 run per sentence against the user's own
model, unconfirmed — it now READS, and only the analysis button WRITES; a new settled `'none'` status
renders the plain unclickable story), analysed words lost their blue fill (the hover outline is the
whole affordance), and the QUESTION card got its own 🔍 with a THIRD independent flag over the shared
cache. Zero keys. Ten mutations red. Full write-up: the `v88_u` entry.

**`v88_w` took three more reports, two of them arriving mid-release.** It reworded the last two
"comics" in the jobs popover (`Extracting image panels`,
`Image draft`). ⚠️ **The finding is bigger than the fix**: both were hardcoded English in
`server.js`, which is why `v88_f`'s `comic`→`image` rename could not reach them — **server job labels
are the one user-facing surface `ui.json` does not cover, and are therefore never translated in any
UI language.** Known gap, not an oversight; closing it needs keys plus a client-side lookup for
server-minted strings. `d.kind === 'comic'` (a stored draft field), the `comic-extract` link type and
`Detecting comic panels` (the user's own exception) all deliberately keep the word.

It also fixed **a regression `v88_u` shipped**: removing `.te-tok`'s blue fill unmasked the BROWSER's
own `<mark>` yellow, because the analysed tokens are `<mark>` elements. **Removing an override does
not remove a style when the element type has one of its own.** ⚠️ `v88_u`'s guard was a PROXY
(`!/background/`) which the broken version satisfied exactly AND which would have gone red on the
correct fix — both failure directions in one release. And it routed the **static landing card's
artwork** through `_slArtworkHtml`: it read `sl.storyboard` directly, so `v87_m`'s `thumbMode` never
reached the one surface that re-implements `loadSavedList` — `v87_m`'s guard had checked `index.html`
alone. Eleven mutations red across the three.

**`v88_x` shipped the text-analysis resume.** ⚠️ **The measurement changed the design.** The chapter
the user said "did not finish" had finished — but 2 of its 6 sentences held a full set of token slots
and NOT ONE lemma, because `parseAnalysisReply` degrades a malformed reply the same way for every
token in a sentence (deliberately, so one bad reply cannot abort a long chapter) and nothing ever
revisited it. Measured store-wide: **3 of 51 sentences (5.9%) in 2 of 18 chapters**, both of them
chapters the user reported. So "already analysed" cannot mean "has tokens" — `_analysisSentenceUsable`
requires at least one real lemma, reusing `computeFrequency`'s own definition of "resolved".

There was also nothing to resume FROM: `writeAnalysisChapter` ran once, after the whole chapter, so a
run that died persisted nothing. The release therefore adds THREE things — opt-in `reuse`/`onProgress`
hooks on `analyzeChapter`, a per-sentence checkpoint flagged `partial:true`, and a three-way dialog
(cancel / "Analyse only what is missing" / "Re-analyse everything from scratch") whose counts come
from the server's own shadow. Reuse matches on sentence TEXT, not index, so it serves a died-mid-run
prefix, a story that grew, and a failed sentence with one rule.

⚠️ **TWO cache short-circuits exist on that path** — the route's and `_kickOffAnalysisJob`'s (which
repeats the test for `_runBookJob`'s postGenAnalysis). Teaching only the route about `resume` left the
other firing and a live request returned `{cached:true}` having done nothing; found by issuing it
against a running server, not by reading the route. Also fixed: `_teStoryHtml` dropped everything past
the last analysed sentence, so a partial would have rendered a TRUNCATED chapter.

Verified live on `tp_…093` against a real 35B model: "analysing 1 sentence(s)", `6 reused`, sentence 5
went from 23 unresolved to 23 resolved. Fourteen mutations red.

**`v88_y` answered a user question with "already built", then found why it had never worked.** The
review card's fields carried PLACEHOLDERS and no labels — and a placeholder vanishes once its field
has content, so the only label-shaped words on screen were the EMPTY title field's placeholder,
sitting directly above the CAPTION field holding the extracted text. The user had been typing their
chapter title into the caption (measured: `title:""`, title text in `caption`), which explains all
three of their image-upload reports at once.

⚠️ **And my first reading of that card was WRONG — the user caught it.** I said "four fields"; they
said three. Both true: the image-description box rendered only when a description already existed, so
the third VISIBLE field was `inScene`, whose string said *"What's happening in the scene"* — which
describes a DESCRIPTION, while the field holds TEXT VISIBLE IN THE PICTURE (`server.js`'s own
`CAPTION:`/`IN-SCENE:` contract). Reading the extraction prompt before writing the labels is what
caught it; the labels already drafted would have shipped the wrong reading with a confident label on
top. Now: a visible label above every field, that string reworded, and the description box always
rendered (empty when absent). Two keys, both approved.

Also: **the server half of item AN had ZERO coverage** — grepping the suite for `topicAuto` returned
no hits, so everything that actually SUPPRESSES title generation was unverified. New
`e2e-authored-chapter-title`, with its two limits recorded in the file (the fake returns no usable
titles, so nothing is renamed either way; non-vacuity comes from the titling calls in the request
log, and the skip is pinned at the source). Seven mutations red.

**`v88_z` closed the `AU` cancel residue — and it was EIGHT sites, not the two this prompt carried
as "one read each".** `runCancellable` makes the in-flight model call throw `CANCELLED`, but a runner
that loops over items and wraps each in `try { … } catch { continue; }` catches that like any other
failure: the loop runs to the end and the job reports DONE. **Being inside a cancel scope is
necessary and NOT sufficient**, and nothing said so until now. Six real sites fixed — `_runQc`'s
per-item check and story QC, `_runRecreateJob`'s add-types loop, and THREE inside `generate` itself
(the meta/title call, meta translation, story translation) plus its extra-lesson-formats loop, which
between them meant a cancelled generation kept producing the whole chapter.

⚠️ **The set-level guard found four times what the reading did** (`v88_b`'s rule again), and its
FIRST version reported CORRECT code — eight sites, six of them synchronous, which cannot throw
`CANCELLED` at all. **A rule that reports correct code is a rule nobody keeps.** Now scoped to try
blocks that actually `await`, brace-matched rather than sampled by a line window. Six mutations red.

**`v88_aa` fixed the wizard bounce — and I had wrongly called it blocked.** The user reported that
card 3's Generate led back to the text-confirmation popover and made them press Generate a second
time. True, and the comment in `doGenerate()` justified it as *"the user's own ruling was to KEEP the
review stop"*. ⚠️ **That comment MISREAD the ruling, and I repeated the misreading to the user before
checking.** Its actual words (`roadmap_v87.md`): *"Keep the live review stop. Extraction/chunking/
panel editing stay live in CARD 2, exactly as today; only lesson-type selection and THE FINAL 'GO'
MOVE LATER."* The review stop is card 2's panel editing; the final go was always card 3's. Card 3 now
calls `comicCreateChapter()` directly, card 2 gained a **"Review extracted text"** button (existing
key) so dismissing the popup no longer strands the text, and the review card has ONE behaviour and
ONE label on both entries (`_comicReviewMode` deleted). Three test sections were re-scoped to the
OPPOSITE claim — they had pinned the bug in the ruling's own name. Nine mutations red.
**Rule 35, sharpest form: a comment citing a ruling is a claim about that ruling.**

**`v88_ab` closed the description-suppression ruling — and the RULING changed the design twice.**
The user chose **COMBINE** (chapter text = extracted text AND description, as two blocks), replacing
`v87_l`'s fallback ruling outright. **ZERO `ui.json` keys**: `v88_y` had already worded all four
review-card labels neutrally, so nothing encoded the old semantics. The combine itself is two lines.

⚠️ **What the work actually was: the rule had THREE copies** — the wizard's `_comicPanelText`, the
render GATE `_comicPanelsHaveText`, and the renderer `_comicStoryPanelsHtml` — which is precisely how
`v88_e`/item AY happened. All three now delegate to one `_comicTextFromFields(fields)`.

⚠️ **And combining opened a THIRD way for a comic chapter's two copies of its text to disagree**
(`story` vs `comicPanels[i]`; `v86_g` and `v88_e` were the first two, from opposite directions).
Re-deriving a LEGACY chapter under the new rule would show the description on the highlighted story
panel and nowhere else — item AY's asymmetry again — and a story EDIT would have duplicated it,
caused by the `v86_g` sync written to keep the two in step. One change fixes both:
**`_comicStoryPanelsHtml` reads `d.story` directly for the single-panel case.** Measured: for all 18
chapters carrying panels the old derivation reproduced `story` character-for-character, so it is a
NO-OP today and a guarantee going forward. `v86_g`'s sync is kept but is **no longer the protection**
(`v87_p`'s ruling), and it deliberately does NOT delete `description` — item AN lost one already.

Three guards were asserting the wrong thing, including one that re-implemented the renderer's join
INLINE and claimed to be testing the renderer. ⚠️ **A new non-vacuity assertion could never fire**
and mutation-testing caught it: for ONE panel the flat path emits identical markup AND identical
text, so `comic-story-panel-text` cannot discriminate. Ten mutations red. Full write-up: the
`v88_ab` entry.

**`v88_ac` came out of a user QUESTION, not a report** — *"what is dirty in `canonical-analysis.json`?
let's clean it up"*. The dirty diff was nothing: one correctly-formed entry their own server had
written. ⚠️ **But auditing the file to answer found a real leak** — `DELETE /api/lessons/delete`
cleans up storylines, chain links and every flag, but never the CP1/CP2 analysis, so each deleted
chapter left its whole token analysis behind forever. Invisible in normal use (nothing can address a
dead id) and unbounded: **5 of 20 entries were orphans, 12% of the file.** `deleteAnalysisChapter()`
had existed since `v86_ac`; nothing called it from there. Fixed targeted at the ONE id, deliberately
NOT as a load-time sweep — that version is one partial read of `lessons.json` away from wiping every
analysis on the box, and the e2e asserts an unrelated chapter survives the delete precisely so the
sweep cannot pass. The 5 orphans were pruned (20 → 15 entries, 245 → 217 KB) and the result verified
against the user's own running server. Two mutations red. Zero keys.

**`v88_ad` shipped item AI's first cut** — the user asked for "a review/edit interface for text
analysis entries" and answered its three design questions: a **sticky overlay** (corrections survive
a re-analysis), the **existing token popover** as the editor, targeting the **unresolved** tokens.
Zero keys. The measurement that made the case: `reviewed:false` was written on every token by
`canonical-analysis.js` and **never once set or read** (533/533 at the default), and 63 of 483
tokens (13%) have no lemma at all.

⚠️ **The key is NOT `tokenId`** — that is `chapterId:sN:tM`, a pure index, and a correction keyed to
it would silently RE-ATTACH TO A DIFFERENT WORD after a story edit. It is (sentence text, surface,
occurrence), `v88_x`'s own precedent. ⚠️ **And `build-static.js` is a SECOND surface over the same
cache** — it reads `canonical-analysis.json` directly, so without the same merge every correction
would be missing from `docs/`, the build students actually read. Caught before writing code, by
asking who else reads the analysis; both callers share one module. Fifteen mutations red, including
two fixtures that could not tell right from wrong.

**`v88_ae` shipped both halves of the next user message** — *"do the curator table and show a warning
upon story rewrite."* ONE key (`text_explorer.corrections_orphaned`, wording the user picked from
three); everything else reuses existing strings and the table's header is the chapter's own name.
The table is one editable row per token with an unresolved filter, saving **only the rows that
changed** (saving all of them would turn every model value into a "correction" and pin the chapter
against future prompt improvements). Orphaned corrections are LISTED, never deleted (user ruling),
always visible even under the filter — an orphan is the one row kind findable no other way.

⚠️ **The dry-run route was WRONG in its first version and the e2e caught it**: it asked the
TOKEN-level question of CP1 output, but CP1's tokens carry `text` and split naively (`"lauft."`)
while CP2's carry `surface` — so it matched nothing and called every correction doomed. A candidate
story has never been through CP2; the honest question is SENTENCE-level and now has its own
function. ⚠️ **The e2e also corrected the lifecycle**: a story save does NOT re-run CP2, so the
correction still applies to the stale analysis until the RE-ANALYSIS. Ten mutations red.

**`v88_af` answered a live report** — *"translation job is not listed in the job popover (and ideally
should be cancel-able)."* ⚠️ **"Not listed" understated it**: of the THREE translation triggers,
`retranslateStory`/`retranslateChain` were `_jobsTracked` at `v88_b`, but `triggerUITranslation` was
the one caller never wrapped AND its route registered no job — invisible in every channel at once,
for what is ~19 sequential model calls per language (755 keys at 40 per call).

Made a REAL job rather than a `_jobsTracked` sync row, deliberately: **a sync row cannot carry a
cancel button** (`canCancel` needs a server-side job id), which is the diagnosis under the open
"some LLM jobs have no cancel button" item — **so this is the first of those routes converted, and
the pattern for the rest**. ⚠️ Reading the loop found TWO defects nobody reported: the per-batch
`try/catch` swallowed `CANCELLED` (`v88_z`'s exact shape — it would have run every remaining batch
and reported DONE), and `saveUI` ran ONCE after the whole loop, so a cancelled run kept **nothing**
(`v88_x`'s rule). Both fixed; the checkpoint is what makes a re-run resume and the cancel safe to
press. Four mutations red, and the e2e's cancel is driven by OBSERVED PROGRESS (poll until the job
reports `batch 2/3`) rather than a timer, so it is deterministic.

⚠️ **`v88_ag` then fixed the bug that report was ACTUALLY about.** The user corrected it mid-release:
*"above message was potentially wrong, i had click a QC, not the translation button."* `v88_af`'s
defect was real and measured, but it was the wrong trigger. **THREE QC entry points existed and only
`/api/qc` was a job** — `/api/story-qc` and `/api/summary-qc` both blocked and registered nothing,
and neither caller was `_jobsTracked`. Both converted (not just the clicked one), same pattern.

⚠️ **The fix introduced a HANG and the suite caught it the hard way**: the shared `_qcPoll` continued
on ANY unrecognised status, so a stubbed fetch with no `status` re-armed a 2s timer forever —
`unit-lesson-set-story-explorer` printed ALL PASSED **and never exited**, stalling the whole suite.
`v88_r`'s rule: a process that will not die is a finding. Only `running`/`pending` continue now.
⚠️ **And that fix was briefly UNGUARDED** — repairing the stub removed the only thing exercising the
path — so the claim moved to `unit-jobs-sync-inflight`. ⚠️ **And `v88_m`'s set-level guard fired
correctly** on the two new QC jobs: it required the LITERAL `runCancellable(jobId`, so it was really
asserting "wrapped AND spelled jobId". It now derives each job's own variable and demands that id —
**stronger**, not looser. Eight mutations red.

**`v88_ah` answered "where can i enter the curator table?" — and the question was a bug report.**
It is the `▤` button in the text explorer's bar (🔍 on the progress card, 🔬 on the lesson-set card).
⚠️ **But `v88_ae` gated the whole bar on `unresolved || orphans`, so a fully-resolved chapter offered
NO WAY IN.** Wrong for a review interface, and wrong in the case that matters most: a confidently
WRONG lemma is precisely what an unresolved worklist can never surface. The table button now renders
for any analysed chapter; only the JUMP stays conditional. Two `v88_ae` guards had to be re-scoped —
they were asserting the old behaviour, not failing. Three mutations red.

**`v88_ai` shipped an EIGHT-ITEM user batch** (one message, a follow-up exclusion, and a live
correction mid-build). **Closes item `Y`.** ZERO keys. Analysis curation is now **teacher-mode only**
and **lesson-set only**, rendered **below** the text; the artwork toggle repaints without a reload
(`v86_ad`'s lesson again — four surfaces offered it, one was repainted); the analysis view is inert
to stray taps; the chapter-management row moved below the summary; item Y put the header's five
authoring buttons behind one pencil with `▶`/`🔗` left beside it; idle release went 30 → 60 min.

⚠️ **The ▤ button was INERT when first shipped** — the chapter id was interpolated with
`JSON.stringify`, whose double quotes closed the double-quoted `onclick`. **My guard was a proxy**
(it checked the markup merely CONTAINED the function name, true of the broken version too) and my
live check had called the function instead of clicking the button. Both fixed; re-verified with a
real `.click()`. Sixteen mutations red, three of which stayed green first and each exposed a real
weakness in the guards.

**`v88_aj` moved the storyboard/images switch INTO the storyboard menu** and removed it from the
library, storyline and lesson-set pages (user request). Zero keys. `v88_ai`'s `_slArtRepaint` is
still needed — one trigger now, but it is opened from the storyline screen while two other surfaces
display the artwork it changes.

⚠️⚠️ **I BROKE THE USER'S RUNNING APP MID-EDIT, and the mechanism must not be repeated.** I replaced
`_slThumbToggleHtml` BEFORE removing its three call sites. **`server.js` serves `index.html` with
`readFileSync` PER REQUEST** — the warning at the top of this file — so the instant that edit hit
disk their browser loaded a client where `loadSavedList()` threw `ReferenceError`, and they reported
"live mode currently shows no saved lessons" plus dead `#sl=` deep links. **In this repo a rename
must delete the callers FIRST, or land as one atomic edit; there is no "not finished yet" window.**

⚠️ **A defect the tests could not see**: the menu label prefixed an icon onto a string that already
had one ("🎬 🎬 Show the storyboard…"). The assertions used `includes`, which a doubled prefix
satisfies. Now EQUALITY. **Third proxy-guard failure in three releases** — containment is the shape
that keeps hiding these. Two more `v87_m`/`v87_n` guards were re-scoped (the fourth time in this
line that a guard had become an assertion of the wrong thing). Five mutations red.

---

## ⚠️ START HERE — THE FOUR-FIELD QUESTION IS ANSWERED; ONE OF ITS CONSEQUENCES IS NOT

`v88_aa` handed over the user's own question — *"which of `story`, `panel.title`, `panel.caption`
and `panel.description` actually becomes user-visible text?"*, with a request to clarify what roles
those four play. **That was put to them at the `v88_ab` cut, with a store-wide measurement, and all
four sub-questions were answered.** The measurement table `v88_aa` wrote is still accurate and is
worth reading once (it is reproduced with counts in `roadmap_v88.md`'s `v88_ab` entry). The rulings:

| question | the user's ruling | status |
|---|---|---|
| a description suppressed by extracted text | **COMBINE** — the story is extracted text AND description, both, always. Replaces `v87_l`'s fallback ruling | **shipped `v88_ab`** |
| is the `caption` / `inScene` split earning its keep in the UI | **keep as-is** — two extraction fields, one rendered block | nothing to build |
| should `panel.title` be rendered anywhere | **leave it write-only** — it names the chapter and sets `topicAuto:false`; that is the job | nothing to build |
| `ui.json` budget | **propose each key first** | none were needed; `v88_ab` shipped zero |

**⚠️ THE ONE THING THAT REMAINS FROM IT — and it is a decision, not effort.** `v88_ab` changed how a
chapter's text is FORMED and RENDERED. It did **not** rewrite stored data, so **the two chapters the
user actually reported still read `"De Manteling"`**: `tp_17883458445860000053` (description 128
chars, intact in `comicPanels[0].description`) and `tp_17883426979990000196` (159 chars, likewise
intact). Nothing is lost and the new rule governs everything created from now on, but those two do
not fix themselves. Three ways to close it, and **the user has not been asked which** — ask before
building any of them:
  • **Nothing** — each is a ~10-second paste through the existing story-repair UI, and they may
    prefer to just do it (they hand-pasted a whole chapter for exactly this reason on `2026-09-02`,
    `tp_17883793024690000067`, which is how live the annoyance was).
  • **A one-shot repair action** — a button that re-forms `story` from the panel under the new rule.
    Costs a `ui.json` key and a decision about where it lives.
  • **A load-time migration** — ⚠️ recommend AGAINST without an explicit go-ahead: `schemaVersion` is
    a load-time SHAPE adapter, not a per-field migration hook, so this means inventing a mechanism
    AND silently rewriting the user's own chapter text on their running server.

**✅ ITEM AI IS COMPLETE AS SCOPED** — `v88_ad` shipped the editable popover, the sticky overlay and
the unresolved worklist; `v88_ae` shipped the curator table and the story-rewrite warning. Nothing
from that request is owed.

Still unbuilt and **NOT decided** — ask before starting either: whether `reviewed` should ever mean
anything at SENTENCE or CHAPTER level (today it is per-token, which is what CP2's schema already
had), and whether a fully curated chapter should be exempt from the `stale` re-hash.

⚠️ **A known, deliberate limit, now warned about but not solved**: a correction is keyed on the
SENTENCE TEXT, so rewriting a sentence orphans its corrections. `v88_ae` makes that visible in three
places (a Cancel/Continue warning before the save, an orphan block in the curator table, the
worklist bar appearing for orphans alone) — but **retyping an orphan against the new sentence is
still manual**. If the user asks for more, the shapes worth putting to them are a fuzzy re-key
(match the orphan's surface inside the new sentence) or a side-by-side "old sentence → new sentence"
repair view. Do NOT loosen the KEY itself: an approximate key silently re-attaches a correction to
the wrong word, which is worse than losing it.

⚠️ **`v88_ab`'s residue is CLOSED — by the user, not by a release.** They deleted the two isolated
"De Manteling" storylines. The surviving `tp_17881715830570000091` is the chapter that extracted
correctly (heading in `caption`, 310-char body in `inScene`, no description), so the combine rule
has nothing to add there. Do not re-open it.

**⚠️ TWO ITEMS STILL NEED A RULING** (item 3 of the previous list is now closed by `v88_ab`).
Verbatim where quoted:

1. **⚠️ NEEDS A RULING — card 2's green "✨ Generate" button is mislabelled.** The wizard's
   structure is now right (`v88_aa`): card 3 owns the one Generate. What remains is that
   `#comic-generate-btn` on card 2 — which runs the TEXT EXTRACTION, the correct act for that card —
   is labelled `form.image_generate` = "✨ Generate", which is what the user kept reading as the
   chapter-generation button. Rewording it costs that string's translations, so **ask for a key
   budget first**. `form.image_extract` ("✨ Extract text") exists but the button can run extraction
   AND/OR description, so it is not a drop-in.

2. **⚠️ LARGELY ANSWERED AT `v88_af`/`v88_ag` — some LLM-based jobs still have no cancel BUTTON.**
   THREE routes are now converted (`/api/ui-translate`, `/api/story-qc`, `/api/summary-qc`), so the
   pattern is proven twice over. **What remains is the REST of the `_jobsTracked` sync list** —
   `/api/storyline-title`, `/api/storyline-summary`, `/api/storyline-retitle`,
   `/api/retranslate-story`, `/api/writing-feedback` — which are listed but not cancellable. Each is
   the same mechanical conversion (`newJob` + `runCancellable` + a client poller; add a per-item
   `CANCELLED` re-throw and a checkpoint only where there IS a loop). ⚠️ Still a RULING because each
   turns a blocking route into a polled one, and `v88_ag` showed that carries its own risk: the
   first shared poller looped forever on an unrecognised status and hung the suite. Ask before
   converting more, and if asked, convert them together with ONE poller rather than one each.
   The original diagnosis, unchanged: The
   ui.json translation was one of them and is now a real, cancellable job, so **the conversion
   pattern is proven and is the recommended answer for the rest**: `newJob` + `runCancellable` + a
   per-item re-throw of `CANCELLED` + a per-item checkpoint, then a client poller. What remains is
   WHICH of the other sync routes are worth converting — still a ruling, because each conversion
   turns a blocking route into a polled one. The original diagnosis, unchanged (user screenshot:
   "Erstelle Zusammenfassung", "Neuer Titel…"). Untouched by `v88_z`, which fixed cancels that were
   swallowed, not buttons that are absent. **Diagnosed**: both are `kind:'sync'` rows — the
   synchronous LLM routes `v88_b` surfaced in the popover from `_jobsInflight`. `_jobsRenderList`'s
   `canCancel` is `j.kind === 'job' && …`, and the comment there explains why sync was excluded:
   there is no server-side job id for `POST /api/jobs/cancel` to look up. So it needs either an
   `AbortController` on the client fetch (stops the waiting, leaves the model running) **or** the
   sync routes registering real cancellable jobs. Ask before building.

⚠️ **A partial EXTRACTION is now a known failure mode, and it is not the same as a mislabelled
field.** Measuring item 3 showed the two reported chapters are the same photographed sign as
`tp_17881715830570000091` — which extracted correctly, `caption` = the sign's heading, `inScene` =
its body paragraph. The two broken ones simply never got the body. `v88_y` fixed the field CONFUSION
and `v88_ab` fixed the SUPPRESSION, but nothing yet notices that an extraction returned a 12-character
heading for a sign full of text. Worth raising as its own item rather than assuming it is covered.


**⚠️ The WITHIN-chapter progression is untouched and is meant to stay** — the user was explicit:
*"we do still want the 'play mode' question progress within chapters, to first solve vocab, then, to
really complete a chapter, solve the comprehension or text hunt lessons."* That is the gate chain
plus `storyUnlocked`/`_storyLockedLesson` plus the full-story lock row on the storyline screen (the
one 🔒 that legitimately survives there). Do not "finish the job" by removing those.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v88.md` — its **index table** and **⚠️ Session protocol** block first (the
   protocol gained THREE items across the `v87` line — read it, it is not the same block as `v87`'s),
   then "OPEN AT THE v88 CUT", then `# ✅ SHIPPED IN THE v88 LINE`.
3. `build_history/roadmap_v87.md` is KEPT as the record for the whole `v87` line (`v87_b`…`v87_p`,
   fifteen point releases) — go there for how anything from that line was built, and for the six
   items it closed.
4. `INTERNALS.md` **§6b, the feature → function map** — read it BEFORE grepping for where anything
   lives. Current through `v88_ab`.

## Establish a green baseline before changing anything

**⚠️ Run `node build-static.js` at EVERY release, even a server-only one.** `APP_VERSION` lives in
`server.js` and is BAKED into `docs/index.html`, so "no client change → no rebuild" is wrong and cost
a red suite at `v88_g`. `unit-static-freshness` will NOT catch it (it compares the seven baked
inputs, and `server.js` is not among them); `unit-version-derivation` is the one that does.

```
node test/run.js                          → expect 333 checks
node test/run.js --quick                  → expect 274
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

**⚠️ `e2e-idle-release` FAILED AGAIN in the full run at `v88_ag`, and passed standalone.** Nothing in
`v88_af`/`v88_ag` touches `releaseOllamaModel` or the idle timer — but those two releases added TWO
new e2e files (`e2e-ui-translate`, `e2e-qc-job`), both of which hold model calls open with the slow
fake, so suite load is genuinely higher than when this was characterised. **Per the standing
instruction below, the NEXT occurrence should be met by INSTRUMENTING THE TICK COUNT, not by
re-running until it passes** — this session did exactly one standalone re-run and is recording that
rather than claiming the file is clear.

**⚠️ `e2e-idle-release` is LOAD-SENSITIVE — newly characterised at `v88_aa`, and NOT cleared.**
Failed once in a full-suite run with `a still-idle server does not release again on every tick
(got 1 -> 2)` — the idle timer ticked twice inside the observation window. Measured **7 of 8 passes
standalone**, and neither `v88_z` (catch blocks in `generate`/QC/recreate) nor `v88_aa` (client +
tests) touches `releaseOllamaModel` or the idle timer. Treated as pre-existing timing sensitivity
under load, NOT as a cleared flake and NOT as a regression — if it fails again, instrument the tick
count rather than re-running until it passes.

⚠️ **AND A REAL CONTRIBUTOR TO LOAD FLAKINESS WAS FOUND AND CLEARED at `v88_aa`**: FOUR orphaned
`test/fake-ollama.js` servers were still listening, the oldest **29 hours** old, leaked from e2e runs
whose `fake.child.kill()` never fired (several from interrupted mutation batches). They hold ports.
An unexplained `e2e-writing` failure earlier in that session is plausibly theirs and should NOT be
considered diagnosed. **Check `ps -eo pid,cmd | grep '[f]ake-ollama'` before trusting a load flake.**

⚠️ **A wait-loop trap that cost 20 leaked processes**: `until ! pgrep -f "test/run.js"; do sleep; done`
NEVER EXITS — `pgrep -f` matches the waiting shell's OWN command line, which contains that string.
Twenty of them span for up to 11 hours. Wait on the OUTPUT FILE instead (`until tail -1 out.txt |
grep -qE '^(ALL CHECKS PASSED|FAILED [0-9]+ of)'`), or bracket the pattern (`"[t]est/run.js"`). Same
family as the standing `pkill -f "node server.js"` warning, from the other direction.

**⚠️ `unit-tap-word` is NO LONGER FLAKY** — its ~35% failure rate from `v80_t` to `v87_h` was a REAL
DEFECT (`Math.random()` in `tapWord()`), fixed at `v87_i`. A failure there now is a genuine
regression.

**⚠️ `unit-observations-log` is NO LONGER FLAKY — and the claim carried here since `v81_b` was
WRONG.** It did NOT "fail under suite load, not standalone": it failed standalone at the same rate
(2/10, 3/60, 2/30 across batches). Root cause found and fixed at `v88_h` — its own `answer()` helper
branched on `document.querySelectorAll('.choice')` before considering the exercise TYPE, and
`lib-dom` does not re-parse runtime `innerHTML`, so stale `.choice` nodes from the previous MCQ
render hijacked a TYPED exercise. Worse, the assertions sat behind `if (droveRight)`, so the section
was **VACUOUS on many of the runs it passed**.

**⚠️ AND THAT FIX WAS NOT COMPLETE — `v88_h`'s claim of "no longer flaky" was itself carried too
confidently.** This file was still failing ~1 in 6 standalone at the start of the `v88_r` session,
for the SAME root cause in a THIRD shape the type list did not cover: `order` (and its `math_order`
/ no-keyboard glyph variants) is neither typed nor choice-driven — `check()` grades `APP.cur.placed`,
the tiles the learner dragged — so those fell through to the stale-`.choice` path exactly as a typed
exercise did. Taught to `answer()` and fixed after `v88_s`. **The fix was then found to be VACUOUS**:
thirty consecutive runs never produced an `order` exercise at all (the corpus had moved on), so the
new branch shipped green and unexercised. It now has its own DETERMINISTIC section that constructs
both an `order` exercise and a glyph-ordered one and drives each in both directions. **Five mutations
red.** A failure there now really is a genuine regression.

`unit-ui-journeys`/`unit-word-progress` are **NOT cleared** — measured 12/12 each standalone, which
is too few to mean anything (this file's own rate would have survived 12 runs about a third of the
time). Treat them as UNVERIFIED, not clean.
**But do NOT reach for the flake label first.** At `v87_o` two corpus-driven tests failed 8/8 —
DETERMINISTIC, so not flakiness — because the user's server had written a new chapter and broken two
fixture SELECTIONS; `git show HEAD:lessons.json` isolated it in one command. Don't run the full and
`--quick` suites CONCURRENTLY on this box (`v86_ae`).

Corpus at this cut: **343 topics, 97 storylines, 33 languages, 755 `en` keys** — an inherently live
snapshot; re-measure fresh at commit time. `APP_VERSION = 'v88_aj'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most

Now 54 numbered standing rules across "Rules earned in session 28…34" plus dedicated blocks for the
`v83`/`v84`/`v85`/`v86` lines — see `roadmap_v87.md`'s own copy of them. Read the **"⚠️ How the rules
are NUMBERED"** note before citing one.

**Earned at `v88_ab`:**

- **A ruling that replaces another ruling must be hunted for in the TESTS, not waited for in red.**
  `unit-comic-extraction` §6c asserted the superseded rule under a message that stated it as a
  principle. It was not failing; it had become an assertion of the wrong thing — `v88_s`'s rule, now
  seen twice in three releases. When a user replaces a ruling, grep the suite for the ruling's own
  words before writing any code.
- **A guard that RE-IMPLEMENTS the thing it claims to test cannot fail when that thing changes.**
  `e2e-save-story-comic-sync` rebuilt the renderer's `[caption, inScene].join()` inline and asserted
  *"the renderer's own join reproduces the corrected story"* — about a function the file never calls.
  This cut made that sentence false in two independent ways and the guard stayed green. Assert what
  the layer can observe (here: the stored fields), and pin the screen where the screen is rendered.
- **Two code paths that produce IDENTICAL output cannot host a non-vacuity assertion.** The
  description-only single-panel fixture was meant to prove it reached the per-panel pairing rather
  than the flat fallback — but `_comicPanelsFlatTextHtml` emits the same wrapper for one panel, and
  with `story === description` the text matches too. Mutation-testing was the only thing that could
  have found it. When a marker stays green under mutation, ask whether the two branches are
  *distinguishable at all* before strengthening the assertion, and move the claim to a fixture where
  they are.
- **A non-vacuity check can go RED on a correct tree by picking the wrong discriminator.** Proving
  `docs/index.html` and `index.html` are different files via `!html.includes('STATIC_LESSONS =')`
  fails, because the source mentions that name a dozen times in `typeof` guards. Discriminate on
  what the BUILD PRODUCES (only the built file DECLARES it; only the source keeps
  `@static-exclude-start`), never on what the build merely reads.
- **A behaviour ruling does not carry a data migration with it — say so instead of assuming either
  way.** Combining fixed how chapters are formed; the two chapters the user reported still hold the
  old `story`. `schemaVersion` is a load-time SHAPE adapter, not a per-field migration hook, so
  "just migrate it" means inventing a mechanism and silently rewriting the user's chapter text on
  their running server. Ship the behaviour, state the residue, let the user choose.
- **Measure the reported artefact against a SIBLING that worked.** The two suppressed chapters
  looked like a field-labelling problem until a third chapter from the same photographed sign turned
  up with `caption` = heading and `inScene` = body, extracted correctly. That one comparison
  reclassified the failure from "the user filled in the wrong box" to "the extraction returned only
  the headline" — a different open item, and one nothing yet detects.

**Earned at `v88_s`:**

- **A guard can go WRONG without going RED.** `unit-storyline-lock-hardening` pinned a rule the user
  then asked to delete; every assertion still passed, against the wrong claim. Worse, its own
  non-vacuity check ("a later chapter is still locked") became an assertion that the deleted rule was
  still running — so it would have gone red on the CORRECT tree. When a feature is removed, grep the
  tests for the ones NAMED after it and rewrite them to the new claim, rather than waiting for red.
- **State a deletion as an ABSENCE over the whole file, not as a passing fixture.** A lock can
  survive its own removal as a dead branch no fixture reaches. `!/chainBlocked/.test(html)` is the
  assertion that cannot be satisfied by luck.
- **When a rule has TWO copies, deleting one leaves the rule alive.** The storyline screen's chapter
  gate had a second life inside `_sbChapterTarget` as a silent redirect, with no 🔒 anywhere to make
  it visible. Found by asking "where else is this question asked?" before editing, not after.

**Earned at `v88_r`:**

- **A non-zero exit code with no failing assertion is a FINDING, not harness noise.** `smoke-render`
  printed `ALL PASSED` and then crashed on a stray `setTimeout` from a `check()` fixture. The lazy
  reading is "a leaked timer in a test". The real one was a product crash: `renderEx`'s
  `C.cur >= C.exercises.length` guard is FALSE for `undefined`, and a review render's synthetic
  `APP.cur` has no `cur`. The feature being built is what made that state reachable in normal use.
- **A guard written against `index.html` says nothing about `docs/index.html`.** Every guard for the
  ← previous-chapter button passed for four releases while the function it calls was not defined in
  the static build at all — it sits above `@static-exclude-end`. When a client helper is added near
  the server functions, check which side of that marker it landed on, and assert against the BUILT
  file.
- **When a mutation stays green, say so in the test rather than strengthening it.** `walkActive()`
  in `_browseApplyNav` is not what keeps a teacher walk in charge of the arrows — the call ORDER is.
  `v87_p`'s ruling applied verbatim: keep the (now honestly described) optimisation, record the
  non-attribution, and pin the mechanism that IS attributable.
- **Take the WHOLE of what a request moves, not the tidy part of it.** The first draft gave ▶ only
  the in-chapter branches, which left `_nextChapter()`'s branch reachable by nothing and made the
  story-finished card unreachable by forward. "Move the next function" meant the whole function.

**Earned at `v88_b`, and it paid for itself immediately:**

- **A SET-LEVEL guard finds the call sites a reading misses.** Item AT wrapped one caller per route,
  which looked complete. The guard section asserting *every* caller of all five routes is wrapped went
  red naming the offset of the next one — and there were **three more**, including `/api/storyline-title`'s
  four separate client callers. That section is the reason the release is complete rather than 60%
  complete. When a fix must apply to EVERY caller of something, assert over the whole set, not over
  the one you happened to change — and expect it to fail the first time.
- **When a fix has two halves — "it works" and "it doesn't leak" — the second half needs its own
  assertion.** `_ttsSpeakableText` had to reach the utterance AND reach nothing else; only the second
  claim can be observed at the source layer, and it is the one that would silently ruin a render.

Three earned or re-confirmed at the `v88_a` cut, still worth carrying forward explicitly:

- **A written-up plan's factual claims are still claims — measure them.** Item AL's own write-up said
  "PDF/comic chapters never set `storyStyle` today" as the justification for making writing-style
  LLM-only. Half wrong: `pdfGenerateAll()` really does send it, the server stores it per chapter, and
  it reaches real lesson prompts (`sysGrammar`/`sysConjugation`/`generateWriting`/`synonyms`).
  Building to the plan's sentence would have silently DELETED a working capability. Only
  `comicCreateChapter()` genuinely hardcodes `storyStyle: null`. Rule 35, from a new direction: the
  document a previous session wrote is a design claim, not a measurement.
- **A "does not exist" assertion is VACUOUS in this DOM harness.** `lib-dom`'s `makeDocument()`
  AUTO-VIVIFIES every id (`getElementById` mints a div on a miss, deliberately). So
  `!!document.getElementById('gone-id')` is always true and its negation always red — a guard written
  that way fails on a CORRECT tree. Absence claims belong at the SOURCE layer. Found by writing it
  and watching it fail, not by reasoning.
- **`git checkout <file>` to undo a MUTATION discards every uncommitted change to that file.** Doing
  it at `v87_l` threw away a session's worth of unrelated client work that happened to live in the
  same file. Mutation-testing must restore from the copy taken before the mutation (`cp` to the
  scratchpad first, restore with `cp`), never from git — the tree during a build is full of work git
  does not know about yet.
- **`pkill -f "node server.js"` would kill the USER's server too.** At `v87_l` a test server was
  started on a spare port for a live model check; the user's own instance was running the identical
  command line. Always list by PID first (`ps -eo pid,cmd | grep '[n]ode server.js'`) and kill the
  ONE pid, and never assume the only matching process is yours.
- **`lib.js`'s `boot()` derives its port from the PROCESS ID — two servers in one test process
  COLLIDE.** The second fails to bind and every request silently reaches the FIRST. At `v87_p` a
  nested second boot made a section query the already-healed server and "fail" while the code was
  correct. Boot a second server only after stopping the first.
- **When a mutation stays GREEN, ask whether a SECOND guard is holding — do not just strengthen the
  test.** At `v87_p`, removing the server's `BACKEND !== 'none'` check changed nothing because
  `llm.js`'s `ping()` already refuses unless the backend is ollama. The honest outcome was to keep the
  (now correctly described) optimisation, say in the comment that it is not the protection, and record
  in the test that it cannot attribute the behaviour to one guard. Removing BOTH does go red.
- **A fixture chosen by a PROXY for the property a section asserts is one generated chapter away
  from red.** Third occurrence (`v81_d`, `v81_e`, now `v87_o` twice over). "The first chapter with a
  story and >=4 vocab words" is not "a chapter whose vocab appears in its story"; "a question
  `_wordQuestions` knows" is not "a question that grades the word". Select by the PROPERTY ITSELF —
  render the candidate and check, or try the state change and keep it only if it happens. And note
  that a cheap approximation is not enough either: a substring pre-check still picked a chapter the
  real matcher (which normalises via `_hlKey`/`stripFuri` and splits multi-token entries) marked
  nothing in.
- **A deterministic failure is NOT the documented flakiness — check before reaching for that label.**
  Two corpus-driven tests failed 8/8 at `v87_o`. The reflex was "known flaky family"; the determinism
  ruled that out in one command, and `git show HEAD:lessons.json` located the cause in the user's own
  live data rather than in any code change.
- **A card that RE-IMPLEMENTS a shared renderer will silently miss everything that renderer grew.**
  `v87_k`: the lesson-set story reader open-coded its body render instead of calling
  `_storyBodyHtml`, and so missed FOUR things — comic images (the reported symptom), the translation
  wrapper, TRACK T's three-state colouring, and the tutor-selection marker, meaning `PLAN §12` never
  worked there at all. Only one was ever reported; the other three were invisible. When two surfaces
  are meant to show "the same thing", assert EXACT STRING EQUALITY between their renders, not that
  both contain some feature — the weaker check passes the moment they drift.
- **A branch that tests IDENTITY (`o.text == null`) is defeated by any caller that always passes the
  value.** That is `v86_a`, and `v87_k` is the same defect reintroduced by a different caller. When
  fixing one, grep for OTHER callers of the same option rather than fixing the one that was reported.
- **When a user reports "it just hangs", check whether TWO states render the SAME string.** The
  `v87_j` text-explorer bug presented as a hang with no error because `!entry` (never fetched) and
  `status:'loading'` (in flight) both rendered the loading label — so a chapter nothing had even
  tried to load looked identical to one mid-request. Reproduce in the harness and count the FETCHES,
  not the pixels: zero fetches is the finding.
- **A second surface added over a shared cache needs the repaint path widened too.** `v86_ad` gave the
  lesson-set card its own explorer flag over the SAME cache, but every repaint in the data path still
  named the completion card — so the new surface fetched correctly and then refreshed the old one.
  When adding a second consumer of a shared async cache, grep the RESOLVE path for hard-coded
  renderers, not just the trigger path.
- **A "known flake" is a HYPOTHESIS, not a fact — and this one was wrong for seven releases.**
  `unit-tap-word`'s ~35% failure was blamed on `buildExercises` corpus sampling by every session since
  `v80_t`, including in this prompt. The cause was `Math.random()` in the PRODUCT. The discriminating
  measurement took one instrumented run: the test already computed the value separating "the tap
  truncated the run" from "the lesson really is one question" (`full`), and they were equal every
  time. Before re-confirming an inherited flake, find the assertion and instrument what it compares.
- **A guard that pins a PROXY fails in BOTH directions.** `n > 1` ("the run holds the whole lesson")
  stood in for a claim the very next line stated properly (`n === full`). A proxy goes red on correct
  behaviour and green on broken behaviour; both happened in this one file.
- **The auto-vivify trap has a SECOND, worse form: a guard that has been green for releases.**
  `unit-arc-options.test.js` §1 claimed "if a form loses its container, the picker silently renders
  nowhere" — via `!!document.getElementById(id)` through the harness. It stayed GREEN through the
  `v87_h` release that DELETED `#pdf-arc-types` from `index.html` entirely: exactly the failure it was
  written to catch. When you delete an id, GREP the tests for a guard that claims to protect it and
  check that guard actually fails.
- **A guard is only as good as the FIXTURE it runs against.** Two assertions added at `v87_i` stayed
  GREEN when the code they protected was deleted — not because they were written badly, but because
  the fixture did not exercise the case (an opening lesson whose type made a reset moot; a word whose
  questions all sat in ONE lesson, so there was no order to get wrong). Mutation-testing found both.
  The fixes: a seam that reproduces the state directly, and a SECOND fixture selected for the property
  the section actually depends on. **Mutation-test every new assertion, not just the feature** — and
  when one stays green, ask what the fixture is failing to cover.
- **A cross-realm object literal breaks `deepStrictEqual`.** An object built inside the `vm` context
  carries THAT realm's `Object.prototype`; `assert.deepStrictEqual` reports a mismatch even when
  every value is equal. Go through `JSON.stringify`/`JSON.parse`, as the older assertions in
  `unit-gen-wizard` already did.

Still the most load-bearing habit across the whole `v86` line: **when a live-tested prompt fix
measures zero effect, reconsider the diagnosis before trying a third wording.**

# WHERE TO START

**🆕 FIRST: the thirteen TODOs handed over after `v88_a`** — items `AM`…`AX` in `roadmap_v88.md`,
with their own suggested order. **`v88_b` shipped row 1 (`AW` + `AT`), `v88_c` row 2 (`AQ` + `AM`),
`v88_d` row 3 (`AO` + `AN`); `v88_e` took two live bug reports (`AY`/`AZ`) out of order; `v88_f` shipped `AP`; `v88_g` shipped `AU`'s shutdown third; `v88_h` did the flake audit; `v88_i` shipped `AX`; `v88_j` shipped `AR`; `v88_k` shipped `AU`'s cancel third; `v88_l` completed `AU` with idle release; `v88_m` wired ALL job kinds for cancel; `v88_n` added reverse sort; `v88_o` added the teacher walkthrough, `v88_p` fixed it, `v88_q` made it start on the summary; `v88_r` generalised it into a student BROWSE mode and split forward into ▶ play / → browse; `v88_s` removed the chapter-wise progress lock on both surfaces that carried it.** The rest of that table:

**🆕 THE THIRTEEN TODOs ARE DONE.** Every item from the `v88_a` handover has shipped, plus two live
bug reports (`AY`/`AZ`) and the flake audit. What remains is either the pre-existing open list or
work the user deferred. **Ask the user what they want next** — that is a reasonable first move here.

**🆕 NOTHING IS OWED.** The browse-mode request is complete end to end (`v88_r` + `v88_s`). **Ask
the user what they want next.**

**Buildable now, no decision needed:**
- **Item `V`** (multi-image upload) is FULLY SPECIFIED by the user's ruling and unblocked — each
  uploaded image gets a whole-image panel (the act `AM` already performs for one image), the panel
  list stays editable, and `comicCreateChapter()`'s existing one-chapter-per-panel formation
  (`v85_p`) is confirmed correct. Mostly a question of the DRAFT shape holding more than one page
  (`_comicDraftSaveDebounced`'s own comment scopes it to one image today).
- **⚠️ `AU` residue, now small**: all eight job kinds are wrapped (`v88_m`), but only
  `_runComicExtractJob` has been checked for a per-item `try/catch` that SWALLOWS a cancel (it
  re-throws on `CANCELLED` now). `_runQc` and `_runRecreateJob` both have per-item tolerance and have
  NOT been checked — a cancelled job there may still report DONE. One read each.
- **⚠️ `AU` cancel follow-up, small and concrete**: `_runRecreateJob` has the same per-item
  `try/catch` shape that made `_runComicExtractJob` report a cancelled job as DONE. Wrap it in
  `runCancellable` and re-throw on `CANCELLED`. Only three job kinds are wrapped so far (comic
  extract, comic detect, analysis); the rest cancel status-only — pre-`v88_k` behaviour, not a
  regression, but each is a one-line wrap plus a check for swallowing catches.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Quick and well-precedented.

**⚠️ `ui.json` keys.** 752 `en` keys now. Every item that needed keys this line has spent them
(`AQ` 1, `AN` 1, `AX` 2, `AR` 4; `AP` renamed 24 without adding any). **Nothing is pre-approved for
the next session.** The user's standing ruling on changed English text: delete the stale non-`en`
values so `translate-ui.js` refills them. **Ask fresh for a count, as every `v87` cut did**
— and note that `v88_b` closed two user reports with ZERO new keys by reusing existing strings, and
`v88_g`/`v88_h` needed none at all. Try that first every time.

**⚠️ POSTPONED BY THE USER (not blocked — deferred)**: **`AV`** (the language/grammar summary) and
**`AS`** (the PDF viewer). Both were put to the user at the `v88_i` handover and both were answered
"postpone". Do NOT restart either without being asked. `AS`'s standing recommendation, if it ever
comes back, is to counter-propose page IMAGES rather than a pdf.js viewer — the PDF bytes are never
stored, and chapter text has no offset back into the PDF.

---

**The older list.** Everything below is carried from `roadmap_v88.md`'s own "OPEN AT THE v88
CUT" section — see it for full detail. Several are blocked on a decision, not on effort.

**Buildable now, no decision needed:**
- **⭐ Finish the flake audit.** `unit-tap-word` (`v87_i`) and `unit-observations-log` (`v88_h`) are
  both done, and **both inherited "known flake" labels turned out to be wrong** — one a `Math.random()`
  in the PRODUCT, one a test driver branching on a proxy. `unit-ui-journeys`/`unit-word-progress`
  remain UNVERIFIED (12/12 each is not enough runs to clear them). Instrument the failing assertion;
  do not re-confirm the label.
- **⚠️ THREE test files share `unit-observations-log`'s defective driver shape** — `unit-question-nav`,
  `unit-inflection-speak-lang`, `unit-tap-word` all branch on `if (btns.length)` before considering
  `ex.type`. Grep for `querySelectorAll('.choice')` ahead of any type check. `unit-question-nav` is
  the most exposed (navigating BETWEEN questions is exactly the MCQ-then-typed sequence that
  triggers it) but measured 14/14 clean, so `v88_h` deliberately did NOT change it — altering four
  test files on one file's evidence is how a cleanup becomes a regression. `roadmap_v88.md`'s `v88_h`
  entry carries the deterministic probe that demonstrates the bug.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Quick and well-precedented.
- **Item D (Tier 2 image-coordinate highlighting)** — buildable, wants its own design pass first.

**⚠️ Blocked on a user decision — do NOT start without one:**
- **Item P's pedagogy question** (infinitive-vs-conjugated as a distractor axis for VERBS). TWO
  live-model cycles already failed to move it by wording; a third guess is explicitly the wrong move.
- **Difficulty placement** — ruled out of scope for item AL and deferred to its own design pass
  alongside the CP1/CP2 route ("difficulty means something different for each lesson type").
- **Item AH** (three CP2 speed ideas; recommendation is "hint, not skip") — needs a product decision.
- **Item AG** (CP2 clitic pronouns / explanations) — needs a prompt-design decision AND a live
  measurement.
- **Item AI** (teacher-editable CP1/CP2 analysis) — one open design question flagged.
- **Item C (comic/PDF upload-card UX)** — note `v87_h`/`v87_l` reshaped both panels; re-read the
  recommendation against the CURRENT markup before putting it to the user.
- **Item A** (move comic images out of `lessons.json`) — needs a go-ahead before touching existing
  topics. Note `v87_m` added `GET /api/comic-thumb/:id`, which is a natural stepping stone.
- **Item B** (vision-role model picker) — short design choice.
- **Item AK's deferred half**: run-now-vs-schedule-with-smart-defaults.

**⚠️ Blocked on a live reproduction the user has to hit:**
- **Item AE** (mobile-backgrounding — the `v86_d` fix did NOT recover on a real device),
  **item AB's "stuck mid-sentence" half**, **item E** (chapter-title post-pass failures, needs the
  raw model response), **item T** (two text-selection→grammar questions never answered).

**Scoped but needing one more thing:**
- **Item AD** (source-language furigana) — live check + a toggle-sharing question.
- **Item F's "add explanations" half** — open and unscoped in detail.
- **Items G, N, O, V, X, Y** — each independently startable or needing user input.

**Offered and not taken up** (from `v87_p`'s diagnosis): offline mode hides controls SILENTLY on the
storyline and lesson-set pages — the `#offline-note` only exists on the generation screen, which is
why a backend outage reads as broken buttons. Small, and would have saved the user two reports.

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map. Read it BEFORE grepping for where anything
lives.
