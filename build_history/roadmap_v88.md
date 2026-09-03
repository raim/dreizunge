# Dreizunge roadmap — v88

**This is the `v88` line.** Cut from `roadmap_v87.md` at its last commit (the `v87_p` release), at the
user's own explicit request ("continue with these and cut to v88, make sure internals and roadmap are
up to date for a fresh session") — the same shape as every prior cut, and for the same reason: the
`v87` line finished what it set out to do. It shipped **item AL end to end** (the generation wizard
restructured from four cards to three, `v87_g`, then all three input modes routed through one
canonical lesson step, `v87_h`), **item Z** (`v87_i` — a word tap now plays every question tied to
that word, which also removed a `Math.random()` that had been misdiagnosed as a corpus flake for
seven releases), **item AC** (`v87_m`/`v87_n` — comic panel images instead of the storyboard, teacher's
choice per storyline, on all three surfaces), the comic **image-description** fallback with
story-so-far context (`v87_l`/`v87_o`), **multi-type add-lessons** on the lesson-set page (`v87_o`),
**backend re-detection** so a late-starting Ollama no longer strands a whole session (`v87_p`), and
FOUR user-reported bug fixes found and fixed live (`v87_j`, `v87_k`, `v87_n`, plus the `v87_p`
diagnosis). It closes here with the storyline chapter-management trio — re-order, split-off,
add-existing — shipped as this line's own `v88_a`.

**`roadmap_v87.md` is kept and is not superseded as a record** — the whole `v87` line's release
history (`v87_b`…`v87_p`) lives there under `# ✅ SHIPPED IN THE v87 LINE` and was NOT copied here.
Go there for how something was built or why a guard is shaped the way it is; this file stays current
through the whole v88 line.

> **⚠️ WHAT WAS CARRIED, AND WHAT WAS NOT.** Carried: this protocol block, the open items that are
> genuinely still open, the findings that govern the open sections, `§0`/`§0i` with their
> reconciliation, the standing RULES (now including the ones earned across the `v87` line — see
> below), **TRACK T** and **THE LARGER PLAN**. **Not carried**: the `v87` line's own
> `# ✅ SHIPPED IN THE v87 LINE` section (`roadmap_v87.md` is the record for that), and the items that
> line CLOSED — **Z**, **AC**, **AL**, and the three storyline-editing asks — which are recorded as
> shipped in their own entries there rather than carried as open work.

### What is in this file, in order

| section | what it is |
|---|---|
| **OPEN AT THE v88 CUT** | fresh, top-of-file summary of everything still genuinely open — including the **thirteen TODOs handed over after `v88_a`** (items `AM`…`AX` plus a re-framing of item `V`), each evaluated against the running code, with a **suggested implementation order** at the foot of that block — then the findings that govern the open sections, then `§0` / `§0i` themselves, then the standing RULES |
| **SHIPPED IN THE v88 LINE** | this line's own release history, newest first |
| **TRACK T** | the text-focused progress card — steps 1–4 and `§T7` all shipped in the v81 line; nothing open here at this cut |
| **THE LARGER PLAN** | the folded `implementation_plan.md`. Cite it as `PLAN §X`. **A bare `§3` is this file's item; `PLAN §3` is Track C.** `PLAN §12`, `PLAN §7.0` Track A (CP1-5), and `PLAN §13` are ALL fully shipped. `PLAN §7.0` CP6 remains open (a CONDITIONAL, not a queued slice). `PLAN §2.4` / Track A4 (comic/image ingest) is fully shipped as its FOUR-milestone core plus several `v85`/`v86`/`v87`-line follow-ups. |

Standing rules are in the "Rules earned in session 28…34" blocks, plus two more from the `v83` line,
three from the `v84` line, six from the `v85` line, EIGHT from the `v86` line and the `v87` line's own
block below — read the **"⚠️ How the rules are NUMBERED"** note before citing one.

## ⚠️ Session protocol — READ FIRST

1. **Establish the green baseline before changing anything** — all four checks, and the corpus
   counts. A differing count is a FINDING, not a stale fixture. **And a DETERMINISTIC failure is not
   the documented flakiness**: at `v87_o` two tests failed 8/8 because the user's own live server had
   written a new chapter between runs, breaking two fixture SELECTIONS — `git show HEAD:lessons.json`
   located it in one command.
2. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35). A fixer is not a diagnosis (rule 23). **A previous session's write-up is a
   claim too**: item AL's own text asserted "PDF/comic chapters never set storyStyle", and building
   to that sentence would have deleted a working capability (`v87_g`).
3. **Revert-verify every fix and believe the result.** For anything claiming to preserve behaviour,
   CAPTURE the old output and DIFF it — "the tests still pass" is not the same claim (`v80_q`).
4. **A note telling the next session to check something is not a guard** (rule 24).
5. **Guard at the layer where the claim is observable** (rule 34), then MUTATION-TEST it: if breaking
   the rule leaves the guard green, the guard is wrong. **Four vacuous guards were found this way in
   the `v87` line alone** — including two that had been green for releases. `test/lib-dom.js`
   AUTO-VIVIFIES every id, so a "this element does not exist" DOM assertion can never fail.
6. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus for a fixture must accumulate across several builds, and be verified over ~15
   consecutive runs, not one. **And a fixture must be selected by the PROPERTY the section asserts**,
   not by a weaker proxy for it — three separate occurrences now (`v81_d`, `v81_e`, `v87_o` twice).
7. A version bump to a new BASE needs its own roadmap. **This is that roadmap for `v88`.**
7b. **⚠️ EVERY release needs `node build-static.js`, including a SERVER-ONLY one (`v88_g`).**
   `APP_VERSION` lives in `server.js` but is BAKED into `docs/index.html`, so a release that touches
   no client file still leaves the static build stale. The habit "no client change → no rebuild" is
   what fails here, and `unit-static-freshness` does NOT catch it — it compares the seven baked
   INPUTS, and `server.js` is not one of them. `unit-version-derivation` is the guard that does.
   Just run the rebuild at every release and stop reasoning about whether it is needed.
8. **Never put emoji in a Python string literal** (rule 25) — write emoji-bearing blocks via a `cat`
   heredoc and splice the file in. And **check what a mechanical rewrite DID**, not just that it ran
   (`v80_d` mangled six sentences including a heading).
9. **A live model call needs a live test, not just a plausible prompt.** Re-confirmed at `v87_l`: the
   new image-description prompt was run against the REAL vision model on a REAL wordless comic panel
   from the corpus before shipping, which is the only way "1-2 sentences in the target language" was
   ever more than a hope.
10. **Ask before restarting a dev server you did not start, and before deleting data you did not
    create.** The user's own server runs on port 3000 across sessions and WRITES to `lessons.json`
    while you work — check `git status --short lessons.json` before and at commit time. Start your
    own on another port for live checks, and **kill it by PID**: `pkill -f "node server.js"` matches
    the user's instance too (`v87_l`).
11. **Two independently live-tested prompt-reinforcement attempts for the SAME underlying pattern,
    both measuring zero effect, is a signal to reconsider the DIAGNOSIS, not the wording** (the `v86`
    line, rules 49/50 below) — don't ship a third guess without a product/pedagogy decision first.
12. **Never restore a mutation-test with `git checkout <file>`** — it discards every uncommitted
    change in that file, not just the mutation (`v87_l`, a session's work). `cp` to the scratchpad
    first, restore with `cp`.

Standing design principle: **no language knowledge in the code**, where *permitted* means Unicode
machinery or corpus statistics, not a hand-authored table. Script tables live in `scripts.json`;
article lists live in a PROBE and must never migrate into the app (`v80_j`).

---

# ⚠️ OPEN AT THE v88 CUT

## 🆕 CARRIED FORWARD FROM THE v86 LINE, GENUINELY STILL OPEN

*Everything below survived the cut on its merits, not by mechanical carry — each item is restated
fresh, pointing at where its full diagnosis lives in `roadmap_v86.md` (or `v85.md`, where the item
predates that line too) rather than repeating it here. Letters are kept stable across cuts — an item
does not get renumbered just because a cut happened.*

### A. Move comic panel images OUT of `lessons.json` (from `v85_u`)

**⚠️ UPDATED at `v88_i`: a translated chapter now COPIES its source chapter's `comicPanels`** (item
AX, the user's own ruling — "copy comic panels for now, but we want to move images out of
`lessons.json` later"). So the same image can now exist under TWO topic ids, and this item's
migration must treat a translated chapter as a **second reference to the SAME image**, not as its own
copy — `translationOfId` is exactly the link that identifies the pair. Getting this wrong would
silently double the storage the migration exists to reclaim.

Still unactioned. A CONFIRMED, measured violation of an EXISTING ruling (`D4`, THE LARGER PLAN
section below) the comic feature never implemented. Full scoping in `roadmap_v85.md`'s `v85_u`
entry, item 4. **The migration of existing topics needs the user's own go-ahead before touching
them.**

### B. A vision-role model picker, restricted to capable models (from `v85_u`)

Still unactioned. Most server plumbing exists (`/api/models` already accepts a `vision` field); the
new part is capability filtering (Ollama's `/api/show` capabilities field vs. a family-name
allowlist) — needs a short design choice before building. Full scoping in `roadmap_v85.md`'s `v85_u`
entry, item 5.

### C. Comic/PDF upload-card UX reorganisation (from `v85_u`)

Still unactioned. The recommendation (route comic AND PDF through the SAME staged wizard flow
`PLAN §13` already built for the AI-generated-book path, instead of each keeping its own immediate-
generate shortcut) is not yet confirmed by the user. Full scoping in `roadmap_v85.md`'s `v85_u`
entry, item 6. **Needs the user's own confirmation before anyone starts.**

### D. Tier 2 per-word image-coordinate vocab highlighting (from `v85_u`, restated from `PLAN §2.6`)

Buildable now that Tier 1 (panel-image-above-text) genuinely works (confirmed `v86_b`). Highlighting
vocabulary words AT THEIR LOCATION IN THE IMAGE, not just in the transcribed text below it, still
needs its own design pass first (does a vision model return per-word bounding boxes reliably enough
to trust, at what granularity) before anyone estimates it.

### E. Chapter-title post-pass failures (from `v85_r`)

Already substantially hardened; no further static defect found by reading. Needs a LIVE reproduction
with the raw model response captured.

### F. Item F's "add explanations" ask (from `v85_r`)

The live-verification half of this item is DONE and confirmed (`roadmap_v86.md`'s `F` entry,
`v86_k`). This remaining half — adding explanations to article-symmetry-flagged pairs — remains open
and unbuilt.

### G. Live-verify the whole `v85_s`/`v85_t`/`v85_u` mechanical fixes on a real device

Still open, needs the user's own device.

### N. Comic auto-detect panel-boundary accuracy — investigated, likely a MODEL limitation, not a code bug

No merging logic exists to explain a "3 shown, 4 detected" report; flagged for a live-model probe if
wanted, not changed.

### O. Multi-panel `comicPanels` sync on a story edit — genuinely harder, not scoped

The single-panel case was fixed twice over (`v86_g`, `v86_r`, two independent write paths). The
multi-panel case is genuinely ambiguous (which panel does an edited sentence belong to?) and remains
unscoped.

### P. ⚠️ Inflection MCQ distractors sometimes mix grammatical DIMENSIONS — the combined-dimension case is a genuine open pedagogy question, not more prompt-engineering work

The single-dimension case (the original "datief" report — a category that DOES NOT EXIST at all for
a word class in a language) was fixed and confirmed (`v86_af`). The combined-dimension case (e.g.
`"Infinitief"` offered against a tense+person correct answer) resisted TWO separate live-tested
fixes (`v86_af`'s own rule, `v86_ag`'s added worked example) — full history and the reconsidered
diagnosis in `roadmap_v86.md`'s own `P` entry. **Genuinely open, needing a product/pedagogy
decision**: should infinitive-vs-conjugated count as a permitted distractor axis specifically for
VERBS, distinct from case (genuinely absent for some languages)? Two live-model cycles have already
failed to move this via wording alone — a third attempt without answering this question first is not
recommended.

### T. Two questions initiated via text-selection → grammar click were never answered (needs reproduction)

Still open, from a screenshot report; needs live reproduction.

### V. Multiple image upload for comic generation — each image its own chapter; "add images" after the first upload

Still open, not started.

### X. Alternative-correct-answer handling for typing/ordering (and similar) lesson types

Still open — the user's own thoughts on this are recorded verbatim in `roadmap_v86.md`'s `X` entry.

### Y. Storyline-card UI redesign: fuse title-edit/gen/QC buttons into ONE popover behind a single pencil icon

Still open, not started.

### AB. The "stuck mid-sentence" half of item AB (from `v86_m`)

The "unrelated context" half shipped at `v86_m`. This half remains open, needs live reproduction.

### AD. Furigana for SOURCE-language Japanese content

Scoped, not built — needs a live-model check and a toggle-sharing design question settled.

### AE. The mobile-backgrounding recovery fix (`v86_d`) did NOT recover, on a real device

Still open — diagnostic logging is in place (`v86_j`); blocked on the user hitting it again with
that logging active.

### AG. CP2's `form` field is coarser than `inflections`' own decomposition — clitic pronouns, explanations

Scoped (`v86_s`), real comparison data already in `roadmap_v86.md`. Needs a prompt-design decision
and a live-model measurement before any code ships.

### AH. Making CP2 faster: three user-proposed mechanisms, evaluated

Recommendation is "hint, not skip" (`v86_t`); no code started, needs a product decision on which
mode(s) to build.

### AI. Surface CP1/CP2 analysis — and let a curator EDIT it — from the teacher/curator interface

Scoped (`v86_s`/onward); one open design question flagged (does a correction survive a chapter
re-analysis? no, today). Not started.

## 🆕 OPENED AT THE `v88_a` → `v88_b` HANDOVER — the user's own TODO list, evaluated

*Thirteen TODOs handed over in one message at the start of the session after `v88_a`. Each was
READ AGAINST THE RUNNING CODE before being written up here (protocol item 2 — a user report is a
symptom, not a diagnosis, and a previous session's write-up is a claim), so what follows is where
the defect actually is, not where the report points. One of the thirteen — "multiple photos treated
like multiple panels" — is **item V**, already open since the `v86` line, and was NOT given a new
letter; its entry below records only what this pass added to it. Letters `AM`…`AX` are new.*

**Four of them (`AM`, `AN`, `AO`, `AQ`) are one code region** — `_comicFinishSetup()` /
`comicOpenReview()` / `_comicReviewConfirm()` / `comicCreateChapter()` / `_comicExtractCheckOnce()`,
all within ~400 lines of `index.html`. They were reported as four separate symptoms from one real
session with a photographed sign. Read the region ONCE and land them as two releases (see the
suggested order at the foot of this block), not four.

### ~~AM. On upload, pre-select the whole image as one panel~~ — ✅ SHIPPED `v88_c`

**User's words**: "Upon image upload, let's pre-select the whole image as one panel, as if the button
associated with `form.comic_single_panel` had been pressed already."

**Measured**: `comicUseWholeImageAsPanel()` (`v86_d`, item J) already does exactly this and is
already idempotent-safe — it REPLACES `APP_COMIC.boxes` rather than appending. The fresh-upload path
funnels through **`_comicFinishSetup(img, status)`** for BOTH the downscaled and the
not-downscaled branch of `onComicFileChosen()`, and that function already calls `comicClearPanels()`
as its first act. So this is one call at the end of `_comicFinishSetup()`.

**⚠️ The one thing not to break**: `_resumeComicDraftFrom()` deliberately does NOT route through
`_comicFinishSetup()` (its own comment says why — `comicClearPanels()` would discard the boxes the
draft exists to restore). Putting the call anywhere more general than `_comicFinishSetup` would
destroy a resumed draft's panels. Guard the resume path explicitly, at the DOM layer (render and
inspect the panel list), not by pinning the source.

Effort: an hour including the guard. No ui.json keys. No decision needed.

### ~~AN.~~ ✅ SHIPPED `v88_d` — a caption typed in the review card silently discarded the generated description

**User's words**: "image upload bug: I lost an already generated image description, perhaps because I
added title 'De Manteling' in `tp_17882063882590000007`."

**Reproduced from the stored data, not from the report.** `tp_17882063882590000007` has
`story: "De Manteling"`, `comicPanels[0].caption: "De Manteling"`, `inScene: ""` — and **no
`description` field at all**. Two independent losses, both real:

1. **`_comicPanelText(b)`** returns `[caption, inScene].filter(Boolean).join('\n') || description`.
   The description is a strict FALLBACK — per an explicit earlier user ruling ("[the description]
   will be used as the chapter text, if no text is extracted"). Typing anything into the caption
   field therefore makes `extracted` truthy and the description stops contributing to the chapter
   text. Working as ruled; **experienced as data loss**, because the user was typing a TITLE, not
   correcting an extraction.
2. **`comicCreateChapter()`'s `comicPanels` metadata carries `caption` and `inScene` only** — it
   never writes `description`. So even when the description IS the chapter text (case 1's fallback),
   the description itself is not persisted anywhere; the stored topic keeps the derived `story` and
   nothing else. **This half is a plain defect with no ruling behind it** and should be fixed
   regardless of how (1) is decided: persist `description` on the panel like the other two fields.

**⚠️ Needs a user ruling on (1) only**, and it is a ruling that REVISES an earlier one. The three
candidates, in the order they are worth considering:
- **A separate title field.** The review card has no title input; the caption field is being used as
  one. Give the card its own title, keep caption meaning "text lettered in the panel". Costs one
  ui.json key, and makes the ruling above correct again instead of overriding it.
- **Caption + description both contribute** when both exist. Cheapest, but reverses the ruling and
  will produce "the sign says X. A man stands beside a fence." prose in every mixed panel.
- **Keep the ruling, warn instead** — the review card greys the description when a caption is typed,
  so the loss is at least visible. Weakest: it makes the behaviour legible without making it useful.

Recommendation: the separate title field. Do (2) unconditionally first — it is not blocked on this.

### ~~AO.~~ ✅ SHIPPED `v88_d` — an extraction started on a phone was LOST, and the job row had no link

**User's words**: "I keep losing extracted text, when text extraction is started on the mobile phone.
The job is listed in the job popover but has no link associated, and clicking on the comic draft job
opens the generation page without the extracted text. The job popover link should lead to the text
confirmation popover of the text extraction routine."

**Three measured causes, not one.** All three must be closed or the report recurs:

1. **The job carries no `link`.** `POST /api/comic-extract` calls
   `newJob({ label: 'Extracting comic panels (N)' })` with **no `link` field** — and `_jobsRenderList()`
   renders the "open →" button only `if (j.link)`. Same for `/api/comic-detect-panels`. This is
   exactly what the user sees, and `newJob()`'s own comment even predicts it ("comic
   extraction/detection … simply carry `link:null`"). The user is asking for a NEW link type —
   `{type:'comic-extract', id:jobId}` — which `_jobsOpenLink()` resolves by fetching `/api/job/:id`,
   applying `_comicApplyExtraction(j.data.panels)`, and opening `comicOpenReview()`.
2. **The result is only ever applied by the ORIGINATING tab.** `_comicExtractCheckOnce()` is the only
   writer of `APP_COMIC.boxes[i].text`. If that tab is gone (phone locked past the browser's tab
   eviction, page reloaded, app switched away and killed), nothing ever applies the panels — which is
   why resuming the comic DRAFT shows the image and boxes but no text: the draft's `text` field is
   only ever populated as a downstream effect of that same poller (via `_comicRenderList()`'s
   autosave hook). This is the same failure family as **item AE**, but it is NOT the same bug and is
   not fixed by AE's visibility listener — AE is about a *live* tab that was backgrounded; this is
   about a tab that no longer exists.
3. **The job store forgets the result after five minutes.** `jobDone()` calls
   `_scheduleCleanup(id, 5 * 60 * 1000)`. So (1) alone gives a link that works for five minutes and
   then silently stops — a worse failure than no link. **The durable fix is to make the SERVER write
   the extraction results onto the draft**: pass the client's `_comicDraftId` in the
   `/api/comic-extract` body, and have `_runComicExtractJob` persist per-panel results into that
   draft record on completion. Then resuming the draft — which is what the user already instinctively
   clicked — carries the text, from any device, with no five-minute window.

Do all three. (3) is the fix; (1) is what the user asked for and is the fast path back to the review
card; (2) is a consequence of (3).

Effort: a release. `unit-comic-review-card` and `e2e-drafts-comic` already exist to build on.
**Mutation-test the durability claim by killing the client**, not by asserting the request body.

### ~~AP.~~ ✅ SHIPPED `v88_f` — rename the whole `comic` branch of `ui.json` to `image`

**User's words**: "Let's rename the whole comic branch in `ui.json` to just 'image'. Uploading comics
is just a possible application of the tool. We don't need to mention comic in related `ui.json`
entries. Just image. Only for the panel-recognition, currently in German 'Automatische
Panel-Erkennung', we can use 'detect comic panels'."

**Measured scope**: **22 keys** (`form.use_comic` plus `form.comic_*`), 33 languages in the file, but
only **122 translated cells across six languages** (`en`, `pt`, `fr`, `de`, `it`, `es` — 20 keys each
outside `en`). Every other language is unfilled and costs nothing. Two further keys mention comics in
their VALUE but not their key name: `storyline.thumb_show_images` and `storyline.thumb_show_storyboard`.

**Two separable halves, with very different costs:**
- **Renaming the KEYS** (`form.comic_extract` → `form.image_extract`, …) is mechanical, preserves
  every existing translation, and is **guarded**: `unit-ui-key-exists` asserts every literal
  `t('…')` in `index.html` resolves in `en`, so a half-done rename goes red. Effectively free.
- **Changing the English TEXT** invalidates the five non-`en` translations for each string touched.
  The `unit-ui-verbatim-en` precedent is the right handling: DELETE the now-stale non-`en` value so
  the offline `translate-ui.js` pass refills it, rather than leaving a translation that describes a
  concept the English no longer names.

**⚠️ This is a `ui.json` edit and needs the user's explicit budget before a key is touched** (protocol
— every cut in the `v87` line asked and was given a smaller number than proposed). The user has
already made one carve-out themselves: the auto-detect control keeps "detect comic panels", because
there the word is doing real work.

**Sequencing**: land this AFTER `AM`/`AN`/`AO`/`AQ`. Those releases are likely to add a key
(`AQ` needs a confirm-only label; `AN`'s recommended fix needs a title label), and renaming the
branch twice is the avoidable half of the cost.

### ~~AQ.~~ ✅ SHIPPED `v88_c` — "Create chapter" after extraction ran the WHOLE generation — and then hides the button that was supposed to start it

**User's words**: "BUG … Apparently the generate chapter button after image text extraction
automatically starts the book generation, and the next button leads to a lesson selection site that
has no generate button at all. … we want that button to just store chapter text as draft, no lessons
yet. Translation, lessons, titles etc. should ONLY be generated on the third page." — with the
server log showing a full run: translation, `arc=[review]`, `Lesson 1/1`.

**Diagnosed, and the diagnosis is exact.** `comicOpenReview(auto)` is reached two ways and **the
`auto` flag is never carried to the confirm handler**:
- from `#gen-btn` on **card 3** (`doGenerate()`'s comic branch) — where confirm SHOULD generate, and
  the user has just chosen their lesson types;
- **automatically from card 2** the instant extraction succeeds (`_comicExtractCheckOnce()`'s
  `comicOpenReview(true)`, added at `v86_v`) — where the user has not yet seen card 3 at all.

Both land on `_comicReviewConfirm()`, which unconditionally calls `comicCreateChapter()`.
`comicCreateChapter()` reads `#gen-skip-lessons-cb` — a control on **card 3**, still at its default —
so the auto path generates everything. **The vanishing button is the same bug's second half, not a
separate one**: `comicCreateChapter()` sets `_comicBookId`, and `_applyLessonCardUI()` computes
`busy = mode==='comic' && _comicBookId`, `startable = n>0 && !busy` → `#gen-btn-row` hidden. Card 3
therefore correctly shows no start button, because a book job really IS running. The screenshot is
consistent with the code; nothing there is a second defect.

**Fix**: carry the open REASON into `_comicReviewConfirm()`. Auto-opened → write the buffer back,
save the comic draft, `_genWizardGoto(3)`, and stop. Opened from `#gen-btn` → unchanged. The
auto-path confirm button also needs its own label (`form.comic_review_confirm` currently reads
"✅ Confirm & create chapter", which would be a lie) — **one new `ui.json` key, needs the budget**.

**⚠️ Guard at the behaviour layer**: assert that the auto path issues ZERO `/api/generate-book`
requests and that the card-3 path issues exactly one. A source-level assertion about which function
`_comicReviewConfirm` names cannot fail for the state that actually matters (protocol item 5).

This is the most expensive of the four bugs: every occurrence spends a full multi-minute generation
the user did not ask for, on text they had not finished reviewing. **Fix it first.**

### ~~AR.~~ ✅ SHIPPED `v88_j` — sort the library by token usage, generation date and last-edit date

**User's words**: "main page: sort saved stories/lessons (for selected language combinations) by
total token usage, generation and last-edit date."

**Measured**: `loadSavedList()` sorts hard-coded — storylines by `srcLang.localeCompare` then newest
`updatedAt||generatedAt` descending, orphans the same way. There is no sort state and no control.
Adding one is a small client change plus a select in the library header (where `#lib-filter` and the
language selects already live).

**⚠️ The one real trap is server-side.** `GET /api/lessons` is a **WHITELIST projection** and does
**not** carry `generationStats.totalPromptTokens/totalCompletionTokens`. Sorting by token usage
without adding them there gives a feature that works in the STATIC build (which ships whole topics)
and silently does nothing live — the exact failure `v74_i` and `v79_n` both record in a comment at
that very site, twice. Storyline-level tokens (`tokenUsage`) DO already arrive, because
`GET /api/storylines` returns whole storyline objects. So: one scalar (`tokens`, the pre-summed
total — not the whole `generationStats` block) added to the projection, and the sort reads storyline
tokens + its chapters'.

Decision needed: **is "total token usage" for a storyline its own `tokenUsage` plus its chapters', or
the storyline bucket alone?** `addTokenUsage()`'s own comment records a deliberate ruling that
storyline-level work is NOT spread across chapters, so the two numbers are genuinely different
things. Recommendation: sum both, and say so in the label.

Effort: one release. ~5 ui.json keys (a select label + three or four option labels) — **needs the
budget**.

### AS. Evaluate: a built-in PDF viewer on the progress card instead of the chapter text

**User's words**: "Evaluate for the roadmap: for uploaded pdfs, can we use a built-in pdf viewer on
the progress card, instead of the chapter text? We would need to highlight vocab and map our text
analysis in the pdf viewer instead of our own text panel."

**Evaluated; the recommendation is to DEFER, and the reason is not the viewer.** Three findings:

1. **The PDF is never stored.** `_loadPdfFile()` reads the file into `_pdfOrig = {text, pages}` and
   the bytes are dropped on the floor. Drafts persist `chunks` (title/text/wordCount) and a
   `sourceFile` STRING — a filename, not a file. So this feature starts with "persist multi-megabyte
   binaries", which is **item A's open ruling** (comic images out of `lessons.json`, a CONFIRMED `D4`
   violation) with a bigger payload. **`AS` is blocked behind `A`, not behind viewer work.**
2. **pdf.js is a CDN dependency, loaded lazily at upload time** (`cdnjs.cloudflare.com`, hard-coded).
   Rendering at *upload* time in an online session is one thing; rendering at *study* time makes a
   remote script a prerequisite for reading a chapter — against this app's zero-dependency,
   `sw.js`-offline shape.
3. **The mapping is the actual cost, and it is worse than it sounds.** A chapter's text is not a
   region of the PDF: it is `cleanExtractedText()` applied to pdf.js output and then re-chunked by
   length / paragraph / page, with the chunk boundaries hand-editable afterward. Nothing retains a
   character offset back to a page, let alone to a text-layer span. TRACK T's highlighting, the
   text explorer's per-word spans and the comic panel-image path all key off OUR text. Mapping them
   onto pdf.js's text layer means carrying provenance through extraction, cleaning, splitting and
   manual editing — the whole pipeline, not the renderer.

**The cheap 80%** that delivers the same intent — "see the original, not just the transcription" —
is the machinery `v85_n`/`v87_m` already built for comics: render the source PAGE AS AN IMAGE above
the chapter text, keep highlighting in our own text panel. Per-page PNGs are the same storage class
as comic panel images (so they ride on item A's ruling rather than needing a new one), pdf.js can
rasterise them at upload time when it is already loaded, and nothing about the text pipeline has to
change. Recommend putting THIS to the user as the counter-proposal.

### AT. Storyline title re-generation does not appear in the running-jobs popover

**User's words**: "Storyline title re-generation did not appear in the running job popover. It
should."

**Measured, and the cause generalises.** `POST /api/storyline-retitle` is **fully synchronous** — it
awaits `generateChapterMeta()` / `generateStorylineTitle()` inline and returns the result. It never
calls `newJob()`, so there is nothing for `GET /api/jobs` to aggregate. **`/api/storyline-summary`,
`/api/retranslate-story` and `/api/writing-feedback` have the identical shape** — every long
synchronous LLM route is invisible to the popover, and retitle is simply the one the user happened
to run and wait on.

Two ways, and the cheaper one is also the better precedent:
- **Client-side synthetic entries.** `_jobsEffectiveList()` already does exactly this for the tutor
  (`id:'__tutor__'`, synthesised from `_tutorState.busy`, with its own comment explaining why
  teaching the server about a stateless request shape was the wrong move). Generalise that one-off
  into a small in-flight registry the client's `fetch` wrappers register with, and every synchronous
  route becomes visible at once — including the three nobody has reported yet.
- **Convert the routes to jobs.** Correct, more invasive, and buys cancellability — which is
  precisely what **item AU** wants. If `AU` is taken, revisit; if not, the synthetic route is right.

Recommendation: synthetic registry now (small, no server change, closes the report and three latent
siblings); revisit if `AU` converts these routes anyway.

### ~~AU.~~ ✅ COMPLETE — shutdown `v88_g`, cancel `v88_k`, idle `v88_l`, and ALL EIGHT job kinds wired at `v88_m` (the `v88_k` entry's "the rest cancel status-only, not a regression" was WRONG — see `v88_m`)

**User's words**: "It seems difficult to cancel individual ollama jobs? If it IS possible, it would be
great to have individual cancel buttons in the new 'running jobs' popover. If we can only cancel by
model type, we would need a second popover, listing all actively running models and add a cancel
button there. Also, we should free the occupied memory for unused models (`ollama stop`) and when
`server.js` is stopped."

**Yes, per-job cancellation is possible.** Three measured facts:

1. **`POST /api/jobs/cancel` already exists** and already calls `job.abort()` if present — but
   **nothing in the codebase ever sets `job.abort`** (grepped: `server.js:8059` is the only
   occurrence). The route today flips a status field and the model keeps generating to completion.
   The route is a stub with a real shape, which is the good half.
2. **The transport can be aborted.** `_callOllama()` builds a plain `http.request`; `req.destroy()`
   is already used by its own timeout path, and Ollama stops generating when the client disconnects.
   **⚠️ CORRECTION, measured at the `v88_j` handover.** This entry previously said "the cost is the
   threading, not the mechanism, and it touches every generator". **That is wrong**, and it was
   written by this line's own session — the third such self-correction here (see item AU's point 3
   and `v88_g`). There is **already ONE choke point**: `_callLLM` (`server.js:131`), whose own
   comment states that *"EVERY server-side LLM call converges on \_callLLM (the four role wrappers
   and all direct call sites go through this one function)"*, and which **already uses
   `AsyncLocalStorage`** to scope per-async-context state — the exact mechanism a per-job abort
   registry needs, sitting three lines from where it would go. Measured surface: 35 wrapper call
   sites all funnel through that one function; `llm.js` needs a seam in TWO places (`_callOllama`
   and `callLLMStream` — the other three `lib.request` sites are ping/listModels/release, short
   calls nobody cancels); and the `think:false` retry creates a SECOND request, which a registry
   that is REPLACED on each new request handles naturally. Still do ONE job kind end to end first
   (server log shows generation stopping, `ollama ps` frees) before widening — but the estimate
   "touches every generator" should not be carried forward.
3. **VRAM is never freed at shutdown, and half the machinery is already written.** `llm.js` sends
   `keep_alive: -1` on every `/api/chat` — models stay resident indefinitely. `llm.js` exports
   `release(model)` (a `keep_alive: 0` call, i.e. `ollama stop`).
   **⚠️ CORRECTION, measured at `v88_g` — an earlier draft of this item said "`server.js` never
   calls it", and that is WRONG.** It is called, at `server.js:5629`, inside `generate()` — but only
   to free the story model before loading a DIFFERENT lesson model, and only when
   `OLLAMA_LESSON_MODEL !== OLLAMA_MODEL`, which is FALSE in the default configuration (both default
   to `OLLAMA_MODEL`). So in the default setup it never fires, which is how the wrong claim survived
   a grep. **What genuinely does not exist is a SHUTDOWN release**: there are ZERO `process.on()`
   handlers in `server.js` or `llm.js` (verified by grepping for `process.on(`/`SIGINT`/`SIGTERM`,
   not inferred), so Ctrl-C leaves every model resident. This is rule 35 landing on this session's
   own write-up: a document's factual claims are claims until measured, including ones I wrote. The shutdown half is small and self-contained: a signal handler that
   `release()`s the distinct configured models (story / lessons / translation / QC / vision) and
   exits. **The IDLE half — the last piece of item AU, and the design work is now done for it.**
   What is already in place after `v88_g`/`v88_k`, so a fresh session does not re-derive it:
   `llm.js` exports `release(model)` (a `keep_alive: 0` call), `releaseConfiguredModels()` already
   de-duplicates the five role models and runs them in parallel behind a deadline, and
   `_callLLM` (`server.js:131`) is the ONE choke point every model call passes through — so
   "when did a model last get used" is a single timestamp written in one place, not a survey.
   **A sketch that fits the existing shapes**: stamp `_lastLLMUseAt` in `_callLLM`; a
   `setInterval` (unref'd, like `llm.js`'s own guard timer) checks it and calls
   `releaseConfiguredModels()` once past the window; skip entirely while any job is running
   (`jobs` already knows) so an idle timer can never interrupt live work.
   **⚠️ What genuinely needs the USER, and is the whole reason this is still open**: the WINDOW,
   and whether they accept the cost. A release means the next generation pays a full model
   RELOAD — on a 35B model that is tens of seconds before the first token, and this app's
   `keep_alive: -1` exists precisely to avoid it. So the tradeoff is "VRAM back while idle" vs
   "the next lesson starts slower", and only the user can price that on their own machine.
   Ask for a window (e.g. 15/30/60 minutes, or never) rather than picking one.

Split it: **shutdown release** (small, no decision, do it first), **per-job cancel** (real
plumbing), **idle release** (needs a policy).

### AV. A LANGUAGE/grammar summary, distinct from the content summary

**User's words**: "let's add a 'language/grammar summary' in the source language, that doesn't explain
the content (as the current summary does) but the language used in this text, e.g. writing style,
difficulty, or highlight whether the text contains unusual grammar or phrases. It could e.g. name the
one most unusual construct. I am not yet sure where it should be displayed, along with the
conventional summary, or as a choice for each storyline. Perhaps this should be generated based on
inflections lessons or the CP2 text analysis?"

**Where it fits**: `sl.summary` is a STORYLINE property (`generateStorylineSummary`, persisted by
`/api/storyline-summary`, metered into the storyline's own `summary` token bucket) and is rendered on
the progress-card entry page (roadmap `§0c`) and the storyline screen. A `sl.languageSummary` beside
it is the natural shape — same route pattern, same token bucket convention, same two render sites.

**The user's own display question already has a precedent**: `v87_n` shipped exactly this shape for
comic artwork — a **teacher's choice per storyline**, toggled on all three surfaces, with the tooltip
offering the way back (`unit-storyline-artwork` §6/§6b). Recommend reusing it rather than re-deciding.

**The user's own generation question is the one that needs measuring, not deciding.** Three sources
are available and they are not equivalent: the raw story text (an LLM call like the existing summary
— simplest, and the only one that works for a chapter with no lessons and no analysis);
`inflections` lessons (a curated, already-QC'd view of the grammar, but only where such lessons were
generated); CP2 canonical analysis (per-sentence `form`/lemma decomposition — the richest, and the
one that could name "the one most unusual construct" from evidence rather than from the model's
impression). **Do not pick from the armchair**: run all three on ONE chapter against the real model
and compare the outputs before writing the prompt (protocol item 9). Note that item **AJ**'s ruling
applies — a target-language grammar description is defensible; do not re-litigate `{S}` compliance.

Needs a product decision on display AND a live measurement on source. Not startable as written.

### AW. An ALL-CAPS word is read out letter by letter

**User's words**: "For the word ONTEIGENINGSZONE in the extracted text of
`tp_17880367188140000070`, the readout of the full text reads this all-caps word letter by letter. Is
there a simple way to avoid this? For example, all-caps words longer then 3 letters should be read
out as a word?"

**Yes, and there is exactly one place to do it.** `_ttsMakeUtterance(text, ttsCode, rate)` is the
single site where any text becomes a `SpeechSynthesisUtterance` — verified by reading every caller:
`_doSpeak` and `_doSpeakLang` both funnel through `_speakChunks`, `_doSpeakLangThen` through
`_speakChunksThen`, and `_speakAndAdvance` calls it directly. Lower-casing (or title-casing) runs of
≥4 upper-case letters there fixes every readout at once, and it is **the kind of rule this codebase
is allowed to hold**: it is Unicode-general orthography (`\p{Lu}`), not a hand-authored language
table (§4's own tier rule).

Two things to get right, both cheap: **do not touch the DISPLAYED text** — the fix belongs to the
utterance only, and the panel/story render must keep the sign's real capitalisation; and **leave
short runs alone**, because a genuine initialism (BBC, EU, USA) is *correctly* spelled out. The
user's own ">3 letters" threshold is the right default.

Effort: under an hour. No ui.json keys. No decision. **The best first commit of the session** — it is
the smallest thing here with a guaranteed user-visible payoff.

### ~~AX.~~ ✅ SHIPPED `v88_i` — generate lessons from an EXISTING storyline for a different SOURCE language

**User's words**: "Allow to generate lessons based on existing storylines and chapters, but for a
different source language. This could be a drop-down menu in the generation interface, with the same
choice as 'continue from'. This would skip the story generation part (otherwise via LLM, PDF, comic),
and start with the target language text."

**Much cheaper than it looks, because the pipeline it needs already exists.** `POST /api/generate-book`
takes `chunks: [{title, text, wordCount}]` and runs the entire rest of the pipeline — translation,
chapter titles, lessons, arc, storyboard, analysis — from that text alone. Both the PDF path
(`pdfGenerateAll()`) and the comic path (`comicCreateChapter()`) are nothing but "build chunks, POST".
A fourth input mode whose chunks are **an existing storyline's chapter stories** is the same shape,
and the target text is already correct by construction.

New work, in full: one server-side resolution (storyline id → its chapters' `story` fields → chunks,
in chapter order), one dropdown on card 1 beside `#continue-select` (which already lists exactly the
right things and is already read by all three modes since item AL), and the input-mode plumbing in
`_genInputMode()` / `_applyLessonCardUI()` / `doGenerate()`.

Three decisions to settle first, none of them large:
- The result is a NEW storyline (a different language pair cannot join the existing one) — but should
  it be LINKED to its source, and shown as such? There is no "translation of" relation today.
- Copy `comicPanels` across? The images belong to the text and would otherwise be lost for the new
  pair. Recommendation: yes, and note it interacts with **item A**.
- Guard against the degenerate selection — the same `srcLang` as the source storyline, which would
  silently duplicate a whole storyline for nothing.

This is the highest-value NEW feature in this batch: it turns every existing storyline into content
for a second language pair at the cost of the lesson generation alone.

### Item V — what this pass adds

**User's words this time**: "Allow multiple photos/images to be loaded and treated like multiple
panels in the image-based story-generation pipeline."

Still **item V**, open since the `v86` line; not renumbered. What is new is the framing: the user now
describes multiple images as **multiple PANELS**, where V's own title says "each image its own
chapter". Those are different products — `comicCreateChapter()` already makes **one chapter per
panel** (`v85_p`, reversing its own original scoping after the user's first real test), so
"each image is a panel" and "each image is a chapter" happen to coincide TODAY and would diverge the
moment several panels are drawn on one of several images. **Settle which one the user means before
building**, and note `_comicDraftSaveDebounced()`'s own scoping comment — "this flow is
single-image-at-a-time today (item V/multi-image is unbuilt), so ONE draft holds ONE page" — the
draft shape is part of this item's cost.

### ⭐ Suggested implementation order for these thirteen

*Ordered by (a) damage per occurrence, (b) whether a user decision blocks it, (c) whether it shares a
code region with something already being opened. `AP` is deliberately NOT first despite being
mechanical — see its own entry.*

| # | release | items | why here |
|---|---|---|---|
| 1 | `v88_b` | **AW** + **AT** | The two smallest with no decision behind either, in unrelated regions. `AW` is one function; `AT` reuses the tutor's own synthetic-entry precedent. A clean first commit that closes two reports. |
| 2 | `v88_c` | **AQ** + **AM** | The most damaging bug in the batch (a full unwanted generation per occurrence) plus the one-line fix in the same function region. Do not separate them — both live in the review/confirm/upload path. |
| 3 | `v88_d` | **AO** + **AN(2)** | The data-loss pair, same region again, now that the flow above is settled. `AN`'s half (2) — persisting `description` — is unblocked; `AN`(1) waits on the ruling. |
| 4 | `v88_e` | **AP** | The rename, once the four image releases have settled the final key set. Mechanical, guarded by `unit-ui-key-exists`, but needs the translation budget. |
| 5 | `v88_f` | **AU**, shutdown half | `SIGINT`/`SIGTERM` → `release()` the configured models. Small, self-contained, no decision, and the machinery is already exported and unused. |
| 6 | `v88_g` | **AX** | The highest-value new feature, and the one that reuses the most existing pipeline. |
| 7 | `v88_h` | **AR** | Library sorting — worthwhile, but the projection change is the trap, not the sort. |
| 8 | later | **AU** cancel + idle halves | Real plumbing through every generator. Prove one job kind end to end first. |
| — | blocked | **AN(1)**, **AV**, **AS**, **V** | Each needs a user ruling or a live measurement before any code. `AS`'s recommendation is to counter-propose page images rather than build the viewer. |

**Older open items worth folding in while nearby**: `AE` shares a symptom family with `AO` (read its
diagnostic logging before writing `AO`'s, and say explicitly in the write-up why `AO` does not close
it); item **A** governs `AS` and touches `AX`; item **C** (upload-card UX) should be re-read against
the markup `AQ` leaves behind rather than the markup it was written against. And the `v88_a`
prompt's own two no-decision entries — **the completion card's missing force-regenerate control**
and the **flake audit** of `unit-observations-log`/`unit-ui-journeys`/`unit-word-progress` — remain
the best filler work if a release above finishes early.

## ✅ RESOLVED BY USER RULING AT THE v86 CUT — no code change, not carried as open tasks

**Item AJ** — `PROMPTS.inflections`'s `{S}`-designated fields comply reliably only when `{S}` is
English; two live-tested reinforcement attempts measured zero effect otherwise. **User's ruling**:
leave it — target-language grammar descriptions are pedagogically defensible on their own terms.
Full comparative analysis in `roadmap_v86.md`'s own `AJ` entry. A "translate layer" (a second,
translation-framed LLM call) is recorded there as a scoped-but-unbuilt option if ever wanted.

## ✅ FINDINGS THAT GOVERN THE OPEN SECTIONS BELOW

*The reconciliation layer over the two RESTORED sections, plus the one diagnosis a future session
would otherwise re-derive. These sit here, above `# 0.`, because they comment on it.*

**The release write-ups moved.** Nine of them accumulated in this position and are now in
**`# SHIPPED IN THE v80 LINE`** at the foot of this file, newest first. Nothing there is open; go
there for how something was built or why a guard is shaped the way it is.

### ⚠️ §C1's FIRST bug did NOT reproduce — and the near-miss is the finding

*"I browsed forward to the story card and back, solved no comprehension lesson, yet could proceed to
the next chapter."* **Not reproduced, and one plausible reproduction of it was an ARTEFACT I nearly
shipped a fix for.**

Two readings were tested and both died:

1. **`index.html:15493`** (`nextLessonIdx = -1` when the just-played lesson is the gated one) —
   its comment says the fall-through lands on the below-mark branch where Next greys out, and
   `v77_o` **deleted the greying**. That looked like a stranded gate. Measured: the below-mark
   branch catches it correctly and sends the learner back into the comprehension lesson. **No bug.**
2. **The done-flag write** is guarded by `_record = !(_lc.total > 0) || _lc.solved >= _lc.total`,
   where `_lc` is `lessonCoverage` — whose universe `v74_c` narrowed to SOURCE ITEMS, while
   `v71_s`'s rule is stated in QUESTIONS. **36 of the 102 gated lessons have an empty item
   universe**, so `!(total > 0)` is true and the flag is written however badly the round went. On
   12 of the 17 such chapters with a successor, a probe could answer everything wrong and walk to
   the next chapter.
   **That reproduction is an ARTEFACT.** All 39 empty-universe gated lessons are `error_hunt` /
   `ai_error_hunt`, never `comprehension` — and `startLesson` sets `C.isErrorHunt`, which the
   enclosing `if (!C._review && !C.isErrorHunt && !lesson._drill)` **excludes from the recording
   block entirely**. The probe reached the branch only because it built `APP.cur` by hand without
   that flag. **The fix was written, measured against the corpus, and then REVERTED** — for
   comprehension lessons both universes are populated, so switching to the question universe would
   have changed a working gate with no defect behind it.

**So the first bug is still open, and the next session should not re-derive these two.** What has
NOT been modelled is the user's actual sequence — *browsing* forward to the story card and back,
i.e. the summary / story-unlocked pages and the Back link, rather than playing a lesson. That is
where to look next.

### §0i — RECONCILED against `PLAN §C5/D1.` Four measured findings.

**Nothing below is deleted; each bullet is marked.**

- **~~"BLOCKED on §1 (the pass mark)"~~ — the citation DANGLES.** `§1` resolves to
  `roadmap_v75.md` §1 (*"The pass mark — needs the USER, not code"*). In THIS file `§1` is
  `useFullChain`, which is **shipped** — so a reader following the citation lands on a closed item
  and concludes the block is unblocked. **The pass-mark item was never carried into
  `roadmap_v80.md`**; it survived only in the handover's "Owed by the user" (`Churros` is 40 items
  where it was 83 questions). **The blocker is real and still owed by the user.** Cite it as
  "the pass mark, session prompt → Owed by the user", not as `§1`. **Since `v80_d` it lives in the
  session prompt's §9**, `HANDOVER.md` having been folded in and deleted.
- **Bullet 3 (a real re-generate function) — SHIPPED in the v45 line, but NOT what the bullet
  asks.** `POST /api/storyline/recreate-lessons` + `_runRecreateJob` exist, wired to the storyline
  bottom row and guarded (`unit-recreate-ui`, `e2e-recreate`). But it runs a FIXED recipe (vocab
  gate + reinforcement) or an explicit tick-list; **it never reads the chapter's existing lesson
  types**, which is precisely what "regenerates the EXISTING lesson types with the same settings"
  means. **Still open — and cheap:** the server already accepts an `addTypes` list, so this is
  deriving that list from `topic.lessons[].type` rather than new machinery.
- **Bullet 1 (align the two "add lessons" surfaces) — the misalignment is REAL and STRUCTURAL, and
  it runs the opposite way to the bullet's assumption.** The storyline picker and the
  book-generation arc share `ADD_LESSON_TYPES`, whose comment claims *"the two can never drift into
  offering different sets"* — **but the PER-CHAPTER dropdown is a third entry point and is
  hand-written markup** (`index.html` ~1144), covered by neither that claim nor
  `unit-add-lesson-registry` (which guards the SERVER registry). **The drift is not hypothetical:**
  `v78_j` added grammar+conjugation to the per-chapter menu, `v79_h` added `intro_script` to the
  registry — **drift in both directions, one release apart, and neither added a guard.**
  The two also encode one capability in two shapes: reinforcement is a TYPE (`review`) in the
  registry and an OPTION (`sial-vocab-mode`) per chapter.
- **Which way the alignment runs:** the per-chapter menu ALREADY has the per-type options the
  bullet asks for (difficulty, vocab mode, math instruction). **The storyline picker is the one
  lacking them**, along with the per-type count. So `§C5`'s Generation Card inherits this, and a
  cheap standing guard — the per-chapter `<select>` against `ADD_LESSON_TYPES` — would close the
  drift on its own.

### §0's other sub-sections — status against the plan

- **§0a rulings 1 / 2a / 2b / 3** — user rulings, all still standing, all shipped
  (`v77_l`, `v77_f`, `v77_o`, `v77_u` / `v78_k`). Keep as the record of WHY; nothing to reconcile.
- **§0b** — both halves DONE (`v77_b`, `v77_c`).
- **§0c** — the walk is complete. **⚠️ SUPERSEDED IN PART by plan §C2**, which removes the
  **next-chapter-unlocked card** (`v77_i`) from the flow. §0c BUILT that page; §C2 deletes it from
  the path. **✅ RESOLVED — the user ruled MERGE, shipped as `v80_e`**: the entry card is generalised
  to every chapter and the unlocked card is deleted, so one starter card serves both items. The
  reversal is closed; see the `v80_e` entry at the top of this roadmap. Still open in §0c and unmentioned by the plan:
  the summary page is reachable by ← but **is not forced before the first question** (an entry-path
  change the user has not seen — ask first).
- **§0d** — shipped (`v78_n`, `v77_l`); `comp-drill` confirmed alive (`v77_d`).
- **§0e ordering** — DROPPED by the user; `PROGRESSIVE STORY REVEAL` replaces it at LOW priority and
  **the plan does not mention it at all**, so it stays open here and is the only home for it.
- **§0e vocabulary panel** — cumulative half done (`v77_f`); ordering half dropped with the above.
  **Still open and unmentioned by the plan:** include vocabulary that was the question or the
  correct answer in **synonym and word_forms** lessons.
- **§0f** — shipped (`v77_v`). **§0g** — code shipped (`v77_t`); the **model-prompt change is still
  OWED BY THE USER** (needs a live model). **§0h** — question navigation, fully open, wants its own
  session; the plan does not cover it.



# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)

**Principle, in the user's words: THE STORY TEXT MUST BE THE FOCUS OF ATTENTION.** The lesson flow
exists so that the student ends up understanding the text. "Complete cards" are renamed **progress
cards** and become the spine that guides a learner through a story.

**Read `build_history/v77_card_gates.md` before touching the card** — the CORRECTED truth table
(32 rows, both gate families) and `probe_gates_v77.js` to re-run and diff.
**`v76_card_gates.md`'s TABLE is superseded and must not be built on**: four of its five findings
were artefacts of state its probe never seeded. That file is kept only for its corrected findings
and the settled coverage question.

## 0a. RULED — session 30 (user). These are decided; do not re-derive them.

All three were answered by the user at the end of session 30, after walking through each one against
the code. **Two of them delete shipped, tested behaviour.** Where a rule is superseded, delete it and
its assertions rather than layering a new rule on top — that layering is what §0a existed to prevent.

### Ruling 1 — `v74_l` is SUPERSEDED as a mechanism; its intent survives

> **User: "move the actions below the text as §0d already wants".**

`v74_l` (`index.html` ~14891) hides `comp-repeat`/`comp-drill`/`comp-crossword`/`comp-back` by id on
a genuine learner unlock and forces `comp-next` visible, so the story is not crowded by four routes
back into practice. **Keep that intent, drop that mechanism.** The story leads because the actions
move BELOW the text (§0d), not because buttons are taken away.

Consequences, all of them required together:

- **The hide-list goes.** With it go the three §0d conflicts it caused: Replay becomes ALWAYS
  available (a learner must be able to reach 100%), `comp-back` is freed for the §0c navigation
  spine, and `comp-next` stops being forced as the single route out.
- The premise `v74_l` was written on is gone anyway: once the card carries a third progress bar,
  cumulative vocabulary and back/next, it is no longer the "quiet card" the rule assumed.
- ~~Measured support: `v74_l`'s hide-list is **barely observable today**…~~ **WITHDRAWN `v77_e` —
  that measurement was wrong.** It came from the unseeded v76 table, where those buttons were
  already hidden for unrelated reasons. Re-measured by neutralising the hide-list and diffing the
  whole table: it changes **8 of 32 rows**, hiding **three otherwise-live buttons in each** (repeat,
  drill, crossword), on exactly the genuine learner unlocks. **The ruling stands — it was made on
  principle — but expect a bigger visible change than §0a assumed.**
- **Nuance not to lose:** the hide-list already keeps Repeat while coverage is short
  (`_coverageLeft`) and hides it only at 100%. So *"a learner must be able to reach 100%"* is
  already satisfied today; Repeat disappears only AT 100%, never on the way there. The case for
  moving the actions below the text stands on its own — the story should lead — but it is not
  rescuing a stranded learner.

### Ruling 2a — `v74_o` is SUPERSEDED (scope CONFIRMED by the user, session 31)

> **User, after the `v77_f` browser pass: "🎉 card only on finished stories."**
>
> **SETTLED — the shipped behaviour is correct, do not widen it.** `showComplete`'s terminal branch
> fires whenever there is nothing left in this chapter and no next chapter, which INCLUDES a learner
> who finished the LAST chapter while earlier ones are unplayed. That case is **not** a finished
> story and keeps `v74_o`'s hand-off. The gate is `_storyAllChaptersDone(slCtx)`, and both halves
> are asserted by clicking in `unit-story-finished`. **Do not "simplify" this to always show the
> card** — the narrower gate is the ruling, not an implementation detail.


> **User: "superseded — the story-finished card is the answer to the dead end".**

`v74_o` makes "nothing left to do" a TERMINAL state: Next is relabelled ↩ and hands the learner back
to the storyline (or home), reusing `APP._compBack` so the header and Next cannot disagree.

§0c makes that same state a WAYPOINT — the **story-finished card** (full story collapsible, complete
vocabulary learned, festive icon) is the next page in the walk. Under `v74_o` that card can never be
reached by pressing forward.

**The dead end `v74_o` fixed is real and must not come back.** It existed because `v71_h` greyed Next
here while `comp-back` was hidden — measured on the shipped "Paella und Chaos" with both chapters
complete: `comp-next` `disabled=true`, `comp-back` `display=none`. The story-finished card is a
better answer to that dead end than the hand-off, but only if it is actually reachable: **do not
delete `v74_o` until the story-finished card exists and Next reaches it.**

### Ruling 2b — below the pass mark, Next LEADS; the destination card is inert

> **User: "next could lead to the next card in the walk, but with no button active" → clarified:
> ALL of that card's action buttons inactive.**

This supersedes **`v71_d`**, not `v74_o` — worth stating plainly, because §0a originally attributed
the grey Next to `v74_o` and that was wrong: `v74_o` is the release that REMOVED greying from the
terminal branch. The surviving grey Next is `v71_d`'s `_belowThreshold` branch
(`_nextBlocked = true; compNext.disabled = true; compNext.classList.add('locked')`).

New behaviour: below the mark, **Next is active and moves to the next card in the walk**, and that
card renders with **all of its action buttons inactive** until the mark is met. The learner can read
ahead; they cannot act ahead.

`v71_d`'s principle is PRESERVED and in fact strengthened: Next never silently repurposes itself
into Repeat or Drill. It always means forward. What goes is the disabled button, not the rule behind
it. Inertness becomes a property of the CARD, not a lock on one button.

### Ruling 3 — article noise is accepted; take the high-recall matcher

> **User: "article noise was 'ok for now' still stands. we may later add a LLM call to judge which
> exact vocabulary is covered by lessons."**

So the mark means *"something from your vocabulary occurs here"*, not *"you have learned this
word"* — recall over precision. Take **whitespace splitting**: `+782` marks corpus-wide, 96 chapters
improved, 8 on the screenshot chapter — accepting that 4 of those are the article `la`. The clean
composed option (`+60`, 0 articles) is NOT chosen.

Two useful consequences:

- **No article table is needed at all.** Whitespace splitting needs no article set, so the
  corpus-derived `es: el, la` / `it: il, la, l'` / `ar: ال` work — and its two Italian false
  positives (`reti`, `per`) and the threshold tightening they wanted — is **not needed for this
  ruling**. That is squarely better under the standing design principle.
- **Keep "also mark articles" reversible.** The user's phrase is "ok for NOW", and the stated
  intention is to revisit with an LLM pass judging which vocabulary a lesson actually covers. Build
  the matcher so precision can be raised later without redoing the display.

**✅ SHIPPED `v77_u`** — 17 words across 13 chapters recovered. ~~**Not part of this ruling, ship regardless:** the apostrophe bug.~~ Vocab stores `l'evoluzione` with
ASCII `'` (U+0027), stories use `l’evoluzione` (U+2019), so even an exactly-present word never
matched — 15 `it`, 7 `en`, 4 `lb` chapters affected. That is a plain defect, not a judgement.

Inflection (`mutazione`/`mutazioni`) still misses under whitespace splitting; it is Tier 2 and stays
open.

### What these rulings cost in tests — read before starting

Eight test files touch the superseded rules: `smoke-render`, `unit-comprehension-gate`,
`unit-coverage-threshold`, `unit-drill`, `unit-lang-placeholder`, `unit-learner-nav`,
`unit-story-unlocked-card`, `unit-vocab-articles`.

**Several assert on SOURCE TEXT, not behaviour** — e.g. `unit-learner-nav` matches
`/_nextBlocked = true;/`, `/compNext\.disabled = true;/` and the literal `_endLbl` line against the
`showComplete` source. When the rework changes that code these fail as text mismatches. **Do not
re-pin them to the new text.** Replace each with an assertion about what the learner can DO — the
whole point of rulings 1, 2a and 2b is behavioural, and a source regex cannot express any of it.
`unit-story-unlocked-card`'s "Next-only for learners" line is `v74_l`'s and goes with it.

## 0b. Do this FIRST, before restructuring

**Make the 7 swallowing `catch(_) {}` blocks in `showComplete` visible** (564 lines, `index.html`
~14212–14776). A throw in any of them leaves the card half-rendered with the suite green. Session 29
lost real time to a bug that *looked* like a swallowed throw and was not. A counter the harness can
assert is zero, or a rethrow under a test flag, is enough. One small release, revert-verified, before
any of the work below.

**✅ DONE `v77_b`** — the 7 catches now report to a per-render ledger (`_cardErrors()`), with
`APP._cardStrict = true` rethrowing at the site. Default behaviour is unchanged: a throw is still
swallowed, it is merely no longer invisible. Measured across the whole corpus at the `v77_b` cut:
**1216 renders over all 304 topics swallowed ZERO errors**, so the catches hide nothing today — the
ledger is a net for the rework, not a bug-catcher for now. Guarded by `unit-card-errors`, which also
asserts no empty `catch` survives in `showComplete`.

**✅ DONE `v77_c` — the coverage key-space question is SETTLED: a seeding artefact, not a bug.**
`topicCoverage` reads ITEM keys (`v74_c`); the probe seeded QID keys; the two spaces are disjoint,
so 0 of 86 counted. `markSolved` writes both, and a learner driven through the real solve path
reaches 100% and unlocks in 4 rounds. Full measurement in `v76_card_gates.md`; guarded by
`unit-mixed-unlock-reachable`.

## 0c. The sequence (the big one)

Progress cards become an ordered walk, with back/next, over:

  **summary → chapter questions → story-unlocked → next-chapter-unlocked → story-finished**

**✅ WALK COMPLETE:** summary `v77_h` · chapter questions (existing progress card) · story-unlocked
`v77_j` · next-chapter-unlocked `v77_i` · story-finished `v77_f`. Every page exists and every link
is asserted by clicking. **What remains in §0c is the spine's REACH, not its pages** — see §0d for
the layout work, and note that the summary page is reachable by ← but is not yet forced before the
first question (a lesson-entry change the user has not seen).

**✅ The story-finished page SHIPPED in `v77_f`** — built first because ruling 2a forbids deleting
`v74_o` until it exists and Next reaches it, so the rest of the walk is downstream of it.
`finished-screen` / `showStoryFinished()` / `finBackToCard()`, guarded by `unit-story-finished`.
**✅ `v77_g` renamed the preview panel to `comp-story-panel`**, so the name `story-unlocked` is now
free for the real page. **Still to build: summary (the walk's FIRST page), story-unlocked,
next-chapter-unlocked**, and the
back/next spine connecting them. `comp-back` does not exist — the spine must be built (see below).

- ✅ **SHIPPED `v77_h`.** The **summary card is the FIRST page** in the back/next sequence, showing
  the story summary in the SOURCE language, with progress bars empty, before any question of that
  chapter. `summary-screen` / `showStorySummary()` / `sumForwardToCard()`, reached by `comp-prev`.
  **Note on scope:** it is reachable by ← FROM the progress card; it is not yet forced before the
  first question on lesson entry. That would change the lesson-entry path (`loadSaved`'s learner
  auto-start, v60) and is a UX change the user has not seen — **ask before doing it.**
- Back/next also walks **already-played chapters**, to revisit, replay, or complete vocabulary.
  Hint from the user: such buttons already exist in the teacher-only lesson-set view.
- A **"story finished"** card at the end: full story (collapsible), the complete vocabulary learned,
  and a festive icon.
- ~~**`comp-back` already exists and is hidden in all 32 measured rows.** Decide: revive or replace.~~
  **CORRECTED `v77_b`: `comp-back` DOES NOT EXIST** — 0 occurrences of `id="comp-back"` in both
  `index.html` and `docs/index.html`. It was deleted in `v71_k` (`#comp-hdr`, whose title is the
  route back, replaced it), and `unit-card-consistency` asserts its absence deliberately. The table
  showed it because **`lib-dom` auto-vivifies any id**, so the probe measured a phantom; `comp-story`
  is the same. **There is nothing to revive — the spine must be BUILT**, and reusing the id
  `comp-back` means updating that guard too.
- **`comp-story-unlocked` does not mean what its name says** (it is the preview label, shown while
  locked whenever canGenerate or teacher is on). Rename before adding a real unlocked card.
  **Note (`v77_b`): it is the whole bordered PANEL, not a label** — `comp-story-unlocked-lbl` is the
  caption inside it, and `comp-story-text` / `-spk` / `-xlate` are its children. The rename touches a
  container, so it is a slightly larger change than "rename the label".

## 0d. Layout and navigation

- Move progress bars, lesson icons and the replay/drill/crossword/next buttons **BELOW the text** on
  all progress cards. ~~(Check `comp-drill` first — grey or hidden in all 32 rows; possibly dead.)~~
  **CHECKED `v77_d`: `comp-drill` is ALIVE — keep it in the row.** It was grey in all 32 rows because
  the gate probe never wrote the wrong-answer ledger it reads; with mistakes recorded it goes LIVE,
  and `unit-card-consistency` has asserted exactly that since `v71_h`. Note it is `hidden` on the
  unlocked-learner row today — `v74_l`'s hide-list — so ruling 1 restores it there.
- ✅ **SHIPPED `v78_n`** — the ✕ returns to the progress card of the lesson being played.
- ✅ **MEASURED ALREADY TRUE (`v78_n`)** — `v71_h` always shows Replay and `repeatForCoverage` falls
  back to the current lesson when nothing is coverage-short, so 100% stays reachable. No code
  change; asserted in `unit-card-0d` §5 so it cannot regress silently.
- ✅ **SHIPPED `v78_n`** — one row per post-unlock lesson on every card of the chapter, labelled
  with the lesson's own title (no new ui.json key).

## §0e ordering — DROPPED by the user (session 32), replaced by a LOW-PRIORITY idea

**User: "forget about the ordering for now."** The measured re-plan below stands as the record of
WHY; the three options are withdrawn and no ruling is owed. `v77_f`'s deck-then-lesson order stays.

**Replacing it, at LOW priority and explicitly "needs more thinking" —
`PROGRESSIVE STORY REVEAL`:** *"at a later point we may show the story but just HIDE all non-learned
vocab and progressively reveal the story."*

Not scheduled. Recorded so it is not re-derived from scratch, with what is already known about it:

- **It inverts the highlight.** Today the matcher answers "which spans are known"; this needs the
  complement, "which spans are not", over the same offsets. `v78_h`'s `_storyWordSources` is the
  right input — it already carries per-word learned/not-learned — so this is a consumer of that
  collector, not a new matcher.
- **The measurement that killed ordering is the one to check first here too.** 83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen; the question for reveal is the
  reverse — what fraction of a STORY's words are covered by ANY source. `v78_h` measured 1043 marks
  over 90 chapters, which is marks, not coverage. **Measure coverage as a share of story tokens
  before designing anything**: if a typical story is 10% covered, "hide everything not learned"
  hides the story, and the feature is a blank page rather than a reveal.
- **It is a reading feature, so the failure mode is severe.** A story panel that hides too much has
  no fallback the learner can reach — unlike a highlight, which is ignorable. Any design needs an
  escape (reveal-all toggle), and the read-aloud must be decided too: does TTS speak hidden words?
- Interacts with §0f/§0c (the auto read-out being moved) and with the finished card, which shows
  the whole story. **Do not design it before the auto-read move lands**, or the same page will be
  redesigned twice.

## §0e ordering + §3 highlighting — the measurement that produced the above

The roadmap said this pair "needs re-planning, not implementing", because the v75 plan was measured
twice and found wrong. Re-planned here against the current corpus. **Two of the v75 plan's premises
are now dead, one item is ready to build, and one needs a USER RULING.**

### What is already done, and was not when the plan was written

- **The apostrophe fix shipped** as `v77_u` (`_hlKey` folds U+0027/U+2019 and case on both sides).
  The v75 note listed it as "ships regardless, it is a defect not a judgement". It is done.
- **The article-set work is moot.** Session 30 ruled article noise ACCEPTED, so the corpus-derived
  `es/it/ar` article sets, the `reti`/`per` false positives and the threshold tightening are all
  unnecessary. `roadmap_v74.md`'s claim that `_articleStatsFor` already derives them was wrong, and
  it no longer matters that it was wrong.
- **A matcher already exists**: `_highlightVocabHtml` + `_hlKey`, with per-word boundaries applied
  only to spaced scripts (`v73_d`). Any "one shared matcher" is an EXTENSION of this, not a new one.

### ✅ SHIPPED as `v78_k` — §3's ruled half

`_highlightVocabHtml` matches a multi-token vocab entry only as a whole phrase. Measured just now:
`['la variazione genetica']` against a story containing exactly that phrase marks it, but a story
containing only `variazione` marks nothing. **Whitespace splitting is the ruled change** (`+782`
marks over 96 chapters, session 29's measurement) and it is still unshipped. Article noise is
accepted, so no filtering is needed. This is a self-contained release.

### DEAD PREMISE: "ordered as the words appear in the story" is undefined for most of the panel

The v75 note says story-ordering is "the same token-alignment problem, not a separate nicety", which
is why it was coupled to §3. **Measured against the corpus, that is true of a seventh of the data.**

Simulating the cumulative panel — every solved word across a storyline, matched against the chapter
story actually on screen, via the PRODUCT matcher, 612 entries over 12 multi-chapter storylines:

```
exact match in the shown story        82   13%
only a word-form / stem match         24    4%
absent entirely                      506   83%
```

Per storyline it is worse than the average suggests: `The Lion's Mischief` has **221 cumulative
words and 25 in the story**; `Nights in Cairo` has **0 of 23**. Sorting by story position would give
a 25-word ordered head and a 196-word arbitrary tail — or, for Cairo, change nothing at all.

**Why the plan and the data disagree: two releases made decisions that were never compared.** The
v75 ordering note assumed the panel showed the CHAPTER's vocabulary. `v77_f` then made it cumulative
across the deck (133 words vs 24, measured at the time). Each was right on its own; together they
make "order as they appear in the story" an instruction about 17% of the list.

**And word forms do not rescue it.** The v75 note's "greedy matching, to allow for word forms" is
worth exactly the 4% above (`preferenza`, `lezione`, `планина` — real, and a rounding error against
83% absent). Greedy stem matching is a genuine cost — it is the one part of this that risks marking
the wrong word — for four points.

### NEEDS A USER RULING before anything is built

The intent behind §0e's ordering half is sound: **connect the vocabulary panel to the story in front
of the learner.** Story-ORDER turns out to be a poor instrument for it. Three ways to serve the
intent, all using the SAME matcher (so the coupling to §3 survives, on better grounds):

**~~The three options below are WITHDRAWN — the user dropped ordering (see above). Kept only as the
record of what was measured.~~**

1. **Mark, do not reorder.** Keep the existing deck-then-lesson order and use the matcher to flag
   the panel words that occur in THIS chapter's story. Well-defined for 100% of the panel (each word
   either occurs or does not), reuses §3's matcher exactly, and the panel stops jumping around as
   the learner moves between chapters. **Recommended.**
2. **Two zones**: an ordered "in this chapter" head, then everything else in the current order.
   Delivers the v75 wording literally, at the cost of a panel that is 17% sorted and 83% not.
3. **Order by recency of solving**, ignoring the story. Well-defined for the whole panel and needs
   no matcher — but it abandons the story connection, which was the point.

Option 1 is what the measurement argues for; **the user should rule**, because "ordered as the words
appear in the story" is their sentence and the substitution is a product judgement, not a bug fix.

### Sequencing, once ruled

1. §3 whitespace splitting — ruled, measured, self-contained, no dependency on the above.
2. Extract the shared matcher to return MATCHES WITH OFFSETS rather than substituted HTML. Today
   `_highlightVocabHtml` does a regex replace and returns a string, so it can answer "mark this" but
   not "where, and in what order" — every option above needs the second answer. Highlighting then
   becomes a thin wrapper that wraps the offsets, which keeps §3's behaviour byte-identical and
   revert-verifiable.
3. The ruled §0e behaviour, on top of that matcher.
4. **The Replay ordering fix rides here** (session-32 batch): pick the LEAST-COVERED counted lesson
   rather than the first coverage-short one. It touches the same card. Independent of the ruling.

### Traps carried forward

- **`probe_gates_v77.js` must be re-run and diffed** after any change to the progress cards, against
  `v77_card_gates.md` (**not** `v76_card_gates.md`, which is superseded).
- **One matcher, not two.** `v77_f`'s finished card deliberately did NOT order, precisely so it
  would not disagree with a matcher that did not exist yet. Whatever ships must serve both that card
  and the progress-card panel, or the two will disagree about the same story.
- `_cardErrors()` empty after any card render, and `_cardHeader(prefix)` + `.card-screen` on any new
  card page.

## 0e. Vocabulary on progress cards — ⚠️ LARGELY SUPERSEDED by TRACK T

> TRACK T puts the highlighted chapter TEXT on every progress card, which subsumes a separate
> vocabulary panel. The still-open half below (include words that were the question or the correct
> answer in synonym and word_forms lessons) becomes a question about **which words get highlighted**,
> not about a panel. Read it that way; do not build the panel.

- **Cumulative per lesson-set**: every word the learner has already solved correctly, not just the
  current lesson's. **User screenshot 2 shows the panel EMPTY** on a comprehension card, because a
  comprehension lesson has no vocab of its own — so today the panel is blank on exactly the cards
  where the story is the focus. This is not polish; it is a blank panel.
- Ideally ordered as the words appear in the story (greedy matching, to allow for word forms).
  **Do this as part of §3, sharing one matcher** — it is the same token-alignment problem, not a
  separate nicety. **`v77_f` deliberately did NOT attempt it** on the story-finished card: ordering
  there before §3 exists would guarantee the two disagree. That card lists every solved item across
  the story in deck-then-lesson order (133 words vs 24 for a single chapter, measured), which is the
  cumulative half of this item done; the ORDERING half is still open.
- Include vocabulary that was the question or the correct answer in **synonym and word_forms**
  lessons.

## 0f. Story read-out — ✅ SHIPPED `v77_v`

~~**Auto-start a read-out of the story chapter when it is unlocked and shown on the progress card**
(unless muted).~~ Done; `_autoReadStory`, guarded by `unit-story-autoread`. Cheap now, and only because of `v75_h`: the old flat 4-second advance net would have
cut a story chapter to ribbons. Watch for cancel-races with the card's other speech — `v75_h` made
`cancel()` conditional, and that must not be undone here.

## 0g. Comprehension flow

- ✅ **SHIPPED `v77_t`.** ~~A wrong answer currently returns to the card; Replay then replays only
  the normal lessons.~~ Next is green and active (`v77_o`) and now **restarts that lesson** while
  questions remain; the repeat **asks only the questions not yet answered correctly**. Guarded by
  `unit-comprehension-repeat`, both halves revert-verified.
- **Still OPEN, needs the user:** the model prompt change below.
- Model prompt change (user, needs a live model — OWED BY THE USER): explanations must NOT quote
  story sentences literally; keep the explanation in the SOURCE language; if a quote is required,
  translate it; and additionally report the exact underlying quote in the TARGET language. Read out
  the explanation for CORRECT answers too — both the source-language explanation and the
  target-language quote.

## ✅ 0h. Question navigation — **SHIPPED at `v80_p`**

> `C.ans` ledger + `check(replay)` + `qPrev()`. The lock is per-run by construction. See the
> `v80_p` entry. Original scope note kept:

Back/next on the QUESTION cards. Already-made choices are shown (right or wrong) and cannot be
reverted, but the lock lasts only for that question set: replaying via the progress card makes them
playable again.

This is not a card change — it is a question-runner change (`C.cur`, `check()`, per-run answer
state) and it interacts with `_speakAndAdvance`, which today advances in one direction only. Scope
it separately.

---

# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1

- Align the teacher-only "add lessons" button on the lesson-set/chapter page with the storyline-level
  bulk "add lessons" selection menu. Per-type options on the right of each lesson type (math: LLM
  prompt; vocab: extend/neutral/reinforce), possibly including the difficulty selector, plus a
  per-type **count** defaulting to 1 (e.g. 2 vocab, 1 synonym, 1 comprehension).
  **MERGE HERE: the recovered "Global QC checkbox menu" item** — same menu, and it also wants the
  book's automatic QC made opt-in from the lesson-type menu and run AFTER the storyboard pass.
  That reverses the `v68.1` ordering decision.
- **PERHAPS: remove extend/neutral/reinforce entirely** and make "extend" the standard: whenever a
  lesson is generated it uses words of the chapter NOT YET covered by previous lessons up to this
  chapter. Aim to cover a story's vocabulary as completely as possible, focused on specific/rarer
  words. Re-inject unsolved items from previous sections outside the model, the way the lesson flow
  already reduces to unsolved.
  **BLOCKED on §1 (the pass mark).** This moves the denominator; settling the target afterwards
  means both moved at once and neither measurement is interpretable.
- Add a real **re-generate lessons** function on the storyline page, beside "add lessons", that
  regenerates the EXISTING lesson types with the same settings but new prompts and models — so older
  storylines can get better lessons.

---

---

### 0. ~~the forked-storyline display~~ — SHIPPED as `v79_k` (session 34), ONE PART STILL OPEN

**Three of the four parts shipped; see the shipped table for `v79_k`.** The fourth — "shared
chapters count the same way for every fork" — **needed no code and was measured to be already
true**: completion is keyed by topic NAME and is storyline-agnostic, so a chapter both forks *list*
already moves both decks identically. `unit-fork-display` §6 pins that (and revert-verify confirms
it passes on the pre-change code, so it is a pin, not a fix).

**⚠️ STILL OPEN — needs a user ruling, the question raised at the end of session 34.** Where a fork
is ASYMMETRIC the intent is still unmet, and it is a DATA question rather than a rendering one. At
this cut: `sl_1041030875` ("Dough of the Ancients") lists exactly one chapter, "Grandpas Dough
Talk", which continues from "pizza dough" — a chapter that storyline does not contain. So from that
side there is no fork parent to branch from, no shared prefix on screen, and playing "pizza dough"
moves the *other* deck (`sl_182891979`) from 0/2 to 1/2 while this one stays at 0/1. **The choice:
add the shared ancestor(s) to the storyline's `chapters[]`, or have the display reach back across
the `continuedFromId` link without changing the data.** Do not pick one without asking.

**Also found while measuring, and separate from all of the above:** `_slProgressStats` computes
`unlockedChapters = doneChapters + (doneChapters < total ? 1 : 0)`, so **every single-chapter
storyline reads 1/1 and a 100% bar before anything is played** (`sl_1041030875` does today). That
is the `v77_p` "the chapter in progress counts" rule meeting a one-chapter deck. Not touched — it
is not a fork bug and changing a headline number wants its own ruling.

**The original item, kept for the record.** Four parts, all on the storyline screen:

- the forked storyline is shown **completely** — every chapter, not the truncated stub — and all of
  it greyed out as it is today;
- clicking **any** greyed chapter opens that alternative storyline, so the learner can switch
  between forks from either side;
- **shared chapters count the same way for every fork** — a chapter both forks contain must not be
  progress on one and nothing on the other;
- the `⑂A/B/C` marker becomes **nothing** for the currently open storyline and the **storyline
  TITLE** for the others, and the node itself is clickable.

It lands on the surface `probe_gates_v77.js` measures. **Re-run it AND diff against
`v77_card_gates.md`** — running it without diffing proves nothing (`v76_card_gates.md`'s table is
superseded). The progress-counting part is the risky half: it is shared state between forks, so
check what `_counts` and the gate probe say before and after, not just what the screen looks like.

### 0b. POSTPONED by the user (session 33): import "new" mode — a possible FUTURE feature

Was on the session-33 bug list, deliberately deferred: *"import lessons as json: we currently have
merge and overwrite options; add a third option 'new' that re-assigns IDs to the imported stories
and chapters, such that it doesn't overwrite existing stories."*

Kept here rather than dropped, with the reason it is a session and not an afternoon: an id
re-assignment has to rewrite `continuedFromId`, the storylines' `chapters` arrays and the fork links
**consistently in one pass**. Get any one of the three wrong and the import succeeds while producing
broken chains rather than fresh stories — a silent failure of the worst kind, because the damage is
in data the user then keeps. **Do not start it without raising it with me first.**

### 1. ~~`useFullChain` does not do what its label says~~ — RULED and SHIPPED as `v79_b`

**User ruling, session 33: make the label TRUE.** Shipped — see the shipped table for the full
entry, `v79_session33_notes.md` for the measurements and how the guard was built. The label and
tooltip were left untouched because they became true; the console lines now say `Story context:` for
the story prompt and `Lesson context:` for the lesson chain.

**What the item said, kept because two of its claims turned out to be worth carrying:**

The main-page checkbox reads *"Pass the full storyline as context — better continuity, slower
generation"*, and the request field is `useFullChain`. **It controlled neither.** In `generate()` it
chose only between the PARENT CHAPTER'S story in full and its last `OLLAMA_MAX_PREV_STORY`
characters. So `Continuing from: "…" (using full chars)` in the console meant **the whole of ONE
chapter**, not the chain, while the separate chain-wide line fed LESSON generation only.

Two things the item did NOT say, both measured at the ruling and both load-bearing:

- **For 128 of 236 corpus continuations (54%) the box changed nothing at all** — the parent chapter
  is shorter than the 800-char tail, so "full" and "last 800" are the same string. The defect was
  therefore invisible on more than half the corpus, which is why it took a user report.
- **The story call passed no `ctxTokens`**, so Ollama used its ~4096 default. The single parent
  never approaches it; the chain crosses it at p90. "Small in code" was wrong: sizing `num_ctx` and
  the timeout is part of the change, not a follow-up (rule v71_t), and the chain's own budget has to
  be derived from the context ceiling so the trim happens where chapter boundaries are known.

### 2. ~~One chapter's vocabulary is in the wrong script~~ — WITHDRAWN, it is a `reinforce` artefact

Corrected by the user at the cut. `tp_17863746762340000193` has a Cyrillic story and a Latin
vocabulary lesson, and that lesson's `_genMeta` carries `_arcMode: "reinforce"` — the mode that
re-trains vocabulary from EARLIER chapters, which were Latin because the user was deliberately
switching this storyline to Cyrillic. **Working as designed; nothing to regenerate.** The plain
lesson in the same chapter, from the same builder minutes earlier, is correct Cyrillic.
`unit-script-choice` lists the id as EXPECTED, not known-bad. See the planned rework below.

### 2. PLANNED REWORK — remove `reinforce` / `neutral` / `extend` (user, v79 cut)

**The user intends to remove the arc-mode option entirely.** Recorded here because it is now load
-bearing for two other things, and because a removal is the moment to decide what replaces it rather
than what it did.

**What it does today.** `_arcMode` on a generated lesson is one of `reinforce` (re-train vocabulary
from EARLIER chapters), `neutral`, or `extend`. It is the mechanism behind the arc "review" lessons
and is stamped into `_genMeta`.

**What it explains.** The mixed-script chapter found at the v79 cut
(`tp_17863746762340000193` — Cyrillic story, Latin vocabulary) is a `reinforce` lesson faithfully
reproducing vocabulary from the storyline's earlier LATIN chapters, while the user was deliberately
switching that storyline to Cyrillic. **Not a defect** — but it shows the mode has no notion of a
storyline changing script mid-chain, and no notion of transliterating what it re-teaches. Anything
that replaces it will meet the same question.

**Why the removal interacts with work already queued:**
- **The per-text learning scheme** (see "NEEDS DESIGN") is the natural replacement, and the user
  framed it that way: *"we probably already have a TODO on this (around extend/reinforce
  redefinition)"*. **Do not remove the modes first and design the replacement after** — `reinforce`
  is currently the only thing aiming lesson generation at anything other than the current chapter,
  and the coverage measurement (9.2% of story tokens) says aiming is the whole problem.
- **`unit-script-choice`'s `EXPECTED_MIXED` entry exists only because `reinforce` exists.** It
  should be deleted in the same change, and that guard's "the generator was never told which script
  to use" message re-read — with `reinforce` gone, a mixed chapter really would mean that again.
- **`v79_a`'s script pin on lesson prompts** was justified by evidence that turned out to be a
  `reinforce` artefact (see the shipped table). It is retained on `v76_h`'s original reasoning, but
  its interaction with `reinforce` is genuinely open: a pinned prompt tells the model to write
  everything in Cyrillic while `reinforce` hands it Latin vocabulary to re-teach. **For a
  script-switching storyline transliteration is probably what the learner wants; for every other
  storyline the two never disagree.** Nobody has measured which the model actually does. If the
  modes are removed this question disappears with them, which is a reason to sequence the removal
  before touching the pin again.

**Open, for the user:** what replaces `reinforce`'s one useful property — that some lessons
deliberately revisit earlier material. The per-text scheme's difficulty ranking could subsume it
(revisit = an easier band), but that is a design choice, not a consequence.

### 2z. RULING (user, at the v80 cut) — language x lesson-type applicability is MODEL-DECLARED

**Decided.** Whether a lesson type makes sense in a language (conjugation for Chinese, cases for
Italian, articles for Serbian) is **not a table the app ships**. The model declares it, the answer is
**cached in `languages.json` with `_genMeta`-style provenance**, and it is **ternary plus a note** —
`yes` / `no` / `different-mechanism` — never boolean. A **human override wins and is marked as such**.
Asked once, not per generation.

**The reason, kept because it is the argument and not just the outcome:** the original request
offered `ova/ovo` vs `taj/ta/to` as Serbian articles. Serbian has no articles — those are
demonstratives, and definiteness in Serbian surfaces through **adjective aspect** (`star`/`stari`),
a different mechanism on a different word class. The cell is neither true nor false, and the note is
more useful to the generator than the boolean would be. A boolean is wrong on its first interesting
cell.

This keeps the knowledge in the tier `INTERNALS.md` §4 assigns it to: the cache is a MEASUREMENT,
not an authored language claim — which is what distinguishes it from the `cyrillic-sr` sounds column
that was authored, verified and **reverted**, and whose absence `unit-intro-script` still guards.

**Guard:** a source sweep that fails when a lesson type has no applicability policy, mirroring
`unit-script-pin-coverage` (rule 32 — guard the enumeration). **Scope:** decides only whether a
lesson is OFFERED; lesson quality stays QC's problem. Full design in
`PLAN §9b/D1.`

### 2x. TWO BUGS DIAGNOSED AT THE v80 DROP — not yet fixed

**(a) A new book NEVER gets a generated storyline title.** The `v78_r` guard at `server.js:5348` —
*generate only when there is none* — is correct and is a user ruling. But the storyline record is
created earlier in the same flow at `server.js:5207`/`5215` with
`upsertStoryline({ id: slId, title: chain[0], … })`, and `chain[0]` is the FIRST CHAPTER'S TOPIC
NAME. **So a title always exists by the time the guard looks and the `generateStorylineTitle` branch
is unreachable.** Reported as `Storyline title: keeping existing "ein eichhoernchen trifft ein
murmeltier — 1"`. **Do not weaken the guard** — it exists because regenerating from the new chapters
alone replaced a whole-story title with one about its tail. Mark the placeholder instead
(`titleAuto: true`, cleared on generation or user edit). **Checked: `summary` is NOT seeded, so the
summary guard works and this is title-only.** Guard BOTH halves or `v78_r` re-opens: a new book gets
a title that is not its first chapter's name, AND an existing storyline gaining a chapter keeps its
title. Full write-up: `PLAN §9c.`

**(b) The vocab article asymmetry is a COIN FLIP, and the prompt contradicts itself.** `prompts.json`
`vocab.system` says `BASE FORM ONLY … (with the usual article where the language uses one)` — PER
SIDE, appealing to each language's citation convention — and three bullets later `ARTICLE SYMMETRY …
BOTH sides or NEITHER` — CROSS SIDE. German cites `der Hund`, French cites bare `chien`, so a model
obeying the first rule produces exactly the reported defect, and the first rule is stated first and
framed as definitional. **Measured on the v80 drop:** `tp_17869977371640000022` **7 of 8**
asymmetric, `tp_17869980065780000104` **0 of 8** — same model, same `_genMeta.type`, `rejected: 0`,
four minutes apart. **A self-contradicting instruction does not bias output, it makes it UNSTABLE**,
which is why it "seems to have got worse" and why **one lesson can never validate a fix**. Fix by
REMOVING the contradicting clause plus a worked counter-example (rule 31 — adding another
prohibition is what made it worse, the `v79_i` failure repeated), then measure a RATE per
`_genMeta.at` cohort. Full write-up: `PLAN §F3/`§F3c.

### 2y. THREE MORE RULINGS (user, at the v80 cut)

**(a) Observations log scope: BOTH — keyed by a stable LOCAL id that an account can later ADOPT.**
Unblocks `PLAN §8/B1`, which was waiting only on this. **Adoption is a LINK, not a
rename:** an account accumulates a SET of local ids (one per browser/device), and an observation's
identity key stays the local id permanently, with `userId` as a resolved attribute. Re-keying to a
`userId` would make a second device un-adoptable. Payment and accounts themselves remain open.

**(b) Uploaded images: STORED SERVER-SIDE.** **They must NOT go into `lessons.json`** — it is a
single file every test parses and `build-static.js` bakes wholesale; base64 pages would multiply it.
Store as files, reference by path. **`build-static.js` then needs a decision it does not have:**
static export either omits images (image-derived chapters degrade to text-only, said so in the UI)
or copies assets and rewrites paths. Retention also sharpens the licence question in §3 below — from
"may we display this" to "may we host it".

**(c) Duplicate storyline titles: SUPERSEDED — the user RENAMED one to "Dough of the Ancients 2".**
The original ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair (both sides rendering the same `icon + title`, so each link named the storyline the
learner was already in). **The rename fixes it at the source and is the better answer.** The
enumeration guard — for every fork, the marker must be distinguishable from the open storyline's own
label — is still worth having but is now **PREVENTIVE**: nothing in the data enforces unique titles.
`unit-fork-display` already sweeps forks. **The tree still holds the old titles; the next data drop
brings the rename.** Original ruling text, superseded, kept for the reason: Both `Dough of the Ancients` storylines keep the same title
AND icon. **This breaks the `v79_k` fork marker**, which renders the other storyline's `icon + title`
so the learner knows where a greyed branch leads — with both identical, each side's link names the
storyline the learner is already in, which is worse than the `⑂A/B/C` letters it replaced. **So the
display must tolerate duplicates:** fall back to the branch's first differing chapter name when the
labels collide. **Guard as an enumeration, not as this pair** (rule 32): for EVERY fork in the
corpus, the marker must be distinguishable from the open storyline's own label —
`unit-fork-display` already sweeps forks and can carry it. Half a session.

### 3. Owed by the user

- ~~Regenerate the lesson in item 2~~ — withdrawn, see above.
- `sl` is fully translated (617 keys) and `languages.json` is complete at 1089/1089 cells — nothing
  outstanding there.
- ~~The `cyrillic-sr` sounds column for the `latin` letter table~~ — **WITHDRAWN, and it was never
  owed.** The absence ENFORCES a `v75_g` ruling pinned in `unit-intro-script`: *"a Serbian reader
  must NOT be offered a Latin course: they already read it"*, Serbian Latin being co-official. A
  column was authored and mechanically verified at this cut (26 respellings, zero non-Serbian
  characters) and then **reverted** — adding it would have silently reversed that ruling, and the
  guard caught it. **If the ruling is ever reopened, `unit-intro-script`'s assertion changes first
  and the table is already written up in the session-32 notes.**
- The per-text learning scheme discussion. **Its prerequisite measurement is DONE** — see "THE
  COVERAGE MEASUREMENT".

## USER TESTING NOTES — session 32, second batch (screenshots) — TRIAGED

### ✅ Done in `v78_i`

- **Chapter auto-read REMOVED from the progress card, and added nowhere else.** *"This supercedes
  previous instructions on putting it somewhere else."* §0f (`v77_v`) and the brief re-scoping to
  "the card before comprehension lessons" are both **withdrawn**. `_autoReadStory` is KEPT — the
  story is still readable from the speaker control, and the helper carries the four restraints
  (muted, review renders, once per chapter, never interrupting) that a future caller would otherwise
  rediscover. **`unit-story-autoread` now asserts it has NO CALL SITE**, so the ruling is a property
  of the product rather than a fact about one commit; a next session reading three releases of
  discussion about where to put it will fail the suite instead of putting it back.
- **Conjugation: multiple choice strongly preferred over typing.** Typing is now a FALLBACK for
  forms that cannot be asked as an MCQ, not a second question layered on the same form. **This also
  fixed a real defect the new corpus exposed:** `mcq_conjugation` and `type_conjugation` share ONE
  qid (`infinitive|pronoun`), so emitting both put two exercises with one identity into a round.
- **Conjugation solution shows the WHOLE phrase** — `vi ste`, not `ste`
  (`tp_17862850223960000178`, screenshot). The read-out had combined pronoun and form since it was
  written, so the app SAID the full phrase while SHOWING half of it; the reveal now uses the same
  composition, so the two cannot disagree.

### ✅ Done in `v78_j` — the three small specified items

- **Restore the FULL lesson suite to the single-chapter "add lesson" menu**
  (`Screenshot_2026-08-10_00-58-41.png`). Grammar and conjugation were hidden from this
  single-chapter version and should come back; the screenshot shows Vokabeln, Synonyme/Antonyme,
  Wortformen, Fehlerjagen, Verständnis, Mathematik, Mischübung, Schrift lernen — **missing Grammatik
  and Konjugation**. Find the menu's type list and the gate that trims it; check whether the
  omission is a hard-coded list or a capability gate (the script entry is gated by
  `scriptLessonAvailableForSet`, so at least one is real). **No new i18n** — both types already have
  registry entries and labels.
- **`translate-ui.js`: `--threads` and `--batch` on the command line.** Threads may already exist as
  an env var; batch size is the hard-coded 10-per-batch. Goal stated by the user: **integrate
  completely new languages more efficiently.** Cheap, and `unit-langnames` already drives the real
  mode with a stubbed backend, so it is testable headlessly.
- **Add Slovenian (`sl`).** `languages.json` entry + `_langScript` mapping (latin) + a `names` cell
  in all 32 languages. **Check `unit-intro-script`'s "every language is mapped in `_langScript`"
  assertion** — an unmapped code reads as "no script", which wrongly makes a Latin course look
  teachable to its speakers (v53). The `--langnames` run that just completed filled 1024/1024 cells;
  adding a language makes it 33×33 and reopens 65 of them.

### THE COVERAGE MEASUREMENT — done, session 32. Read this before designing anything.

The roadmap has said for three sections that this number comes first. It is measured now, through
the PRODUCT matcher (`_highlightVocabHtml` + `_storyWordSources`, never a re-implementation), over
**120 corpus chapters with a story**, and it reframes the request.

**How much of a chapter's story do its lessons teach today?**

```
TOKEN coverage (running words)  :  9.2%   (1946 of 21048)
TYPE  coverage (distinct words) :  8.2%   (1127 of 13764)

per-chapter TYPE coverage   min 0%   p25 5.3%   median 13.2%   p75 19.2%   max 48.6%
chapters below 25%: 108 of 120        chapters above 50%: 0
```

**So it is a GENERATION problem, not a gap-filling problem** — decisively, and that was the question
the number was for. A learner who has solved every lesson in a chapter can read roughly one word in
eleven of its story. "Exhaust the vocabulary of the input text" is not a matter of topping up the
last few items; the current corpus is an order of magnitude away.

**And the second cut changes the design, not just the scale.** Splitting the story's word types by
CORPUS FREQUENCY per language (statistics, not a word list — INTERNALS §4):

```
top-100 most frequent types    350 / 3878  =  9.0% covered
top-500                        466 / 3821  = 12.2% covered
rare (everything else)         311 / 6065  =  5.1% covered
```

**The RAREST words are the LEAST covered** — the exact opposite of the user's "start with the
hard/unusual words". The generator today skews slightly toward the common ones. So the request is a
change of POLICY, not only of volume: even at ten times the output, a generator that keeps picking
by whatever it currently picks by would still leave the hard words last.

**What this settles, and what it does not:**
- **Settled:** the per-text scheme needs generation aimed at the text, and it needs a difficulty
  ordering to aim with. Both are the user's own framing, and the data supports both.
- **Settled:** "if it's a simple short text, go towards the basic words as well" is not a separate
  mode — at 9% coverage of the top-100 band, the basic words are not covered either.
- **NOT settled, and the next thing to measure:** how much of the gap is *reachable*. A story
  contains proper nouns, numbers and inflected forms of words the lessons DO teach; the matcher
  counts an inflection as uncovered unless a `word_forms` lesson happens to list it. **Before
  sizing any generator, measure what share of the uncovered types are inflections of covered
  lemmas** — that is the difference between "generate ten times as much" and "teach the forms of
  what is already taught", and `v78_h`'s tier-2 note (corpus inflections from `word_forms` /
  `grammar.plural`) is the machinery that would answer it.
- **Caveat on the method, stated so it is not over-read:** "covered" here means the word appears in
  some lesson of that chapter, which is a strict reading — a learner also carries vocabulary from
  earlier chapters. The cumulative figure is worse in the other direction (83% of a learner's
  cumulative vocabulary does not occur in the chapter on screen — see the §0e re-plan), so the two
  measurements bracket the real answer rather than agreeing on it. Neither is above 20%.

### → NEEDS DESIGN, and the user wants it discussed before it is built

**"DEVELOP A LEARNING SCHEME FOR EACH TEXT, where lessons are focussed on teaching the text."**
The user's framing, recorded close to verbatim because the shape matters more than any summary:

- Adding vocab lessons to a chapter should **exhaust the vocabulary of the input text** — the model
  should use vocab **not already covered by existing lessons**, ideally covering all non-basic
  vocabulary, and for a simple/short text (e.g. children's) going down to the basic words too.
- In the long run: **a full word-by-word dissection of the text**, with lessons presented
  semi-randomly around that dissection. **Start with the hard/unusual words**; the learner can
  indicate — or the app can detect — whether they understand the text sufficiently or need more
  basic lessons first.
- **Dynamic difficulty**: start mid-level; too hard → easier vocab; too easy → more specific/harder.
  Guided by the learner's history.
- **No short-cuts to the source-language interpretation.** The learner MUST prove vocabulary
  understanding first. (This is a hard constraint on the UI, not a preference — it rules out
  "reveal translation" affordances on the path being designed.)
- For a language pair, **draw on OTHER existing stories** for the dynamic quizzing, or suggest
  solving a simpler storyline first. **This needs both stories and individual questions ranked by
  difficulty.**

**Related existing item: the `extend` / `reinforce` redefinition.** The user is right that there is
already a TODO in that area — this supersedes and enlarges it. `reinforce` currently means "reuse
prior chapters' vocabulary"; the request above makes the real axis **coverage of THIS text**, which
is a different quantity and measurable today.

**The first measurement is DONE — see "THE COVERAGE MEASUREMENT" above: 9.2% of tokens, 8.2% of
types, rarest words least covered. It is a GENERATION problem, and a policy change as well as a
volume one.** The original framing of that question is kept below because the distinction it draws
is the one that mattered: **what fraction of a chapter's story tokens are already covered by its
lessons?** `v78_h` built
exactly the collector for it — `_storyWordSources` returns every word every source teaches — but
`v78_h` measured MARKS, not COVERAGE. Marks count occurrences; coverage is the share of the text a
learner could actually read. **Do that measurement first**: if a typical chapter covers 15% of its
story, "exhaust the vocabulary" is a generation problem; if it covers 70%, it is a gap-filling
problem, and those are different products. The same number is the prerequisite for the progressive
reveal idea below, so it is owed twice over.

## USER TESTING NOTES — session 32 batch, TRIAGED AND SCHEDULED

Five notes. Triaged with the code loaded, and **placed in the existing plan rather than queued as a
flat list** — two belong to sections that already exist, one is a decision rather than a defect, and
one was fixed on the spot.

### ✅ Fixed immediately — `v78_c`

- **`--langnames` crash: `Fatal: issues.some is not a function`.** Full note in the shipped table.
  **Invisible until a name is actually REJECTED** — on the happy path `issues` is empty and
  `[].some(fn)` never invokes `fn`. The 119 missing cells the run reported are unaffected: the crash
  was in the writer, not the survey.

### ✅ §7 — script lessons for a DIGRAPHIC SOURCE — `sl_56647998` — SHIPPED as `v78_g`

**User: "I generated a serbian-latin → serbian-cyrillic storyline but I can't add script lessons to
it. Script lessons would obviously fit such a script-focussed lesson."** Correct, and the cause is
exact — now with the reproduction case in the corpus (`tp_17862984310970000000`: `lang sr`,
`script cyrillic-sr`, `srcLang sr`, `srcScript latin`, both stamped by the v76_i picker).

`needsIntroScript(target, src)` computes the learner's readable scripts as
**`scriptsForLang(srcLang)` — every script the source LANGUAGE admits**. For `sr → sr` that is
`["cyrillic-sr","latin"]` on *both* sides, so `tgt.some(s => !src.has(s))` is **false** and the gate
concludes the learner already reads everything. `buildArcIntroLessons` skips every script for the
same reason (`srcScripts.has(scr) → continue`).

**The gate encodes "which scripts can this language be written in", where the question is "which
script is THIS chapter's source actually written in".** Since `v76_g`/`v76_h` that is a stored
per-topic fact: **`srcScript`**. The fix reads the chosen script when there is one —
`srcScript ? [srcScript] : scriptsForLang(srcLang)` — the same one-line shape in both functions.

Notes for whoever takes it:
- **The bug only bites when the SOURCE language is digraphic**, i.e. exactly the languages in
  `scripts.json` `_scriptChoice` (`["sr"]` today). `sr→en`, `ar→en` etc. are unaffected — which is
  why it survived: the corpus had no digraphic-source chapter until the user made one.
- **`index.html` carries its OWN `needsIntroScript`/`scriptTeachable` (≈1762/1894) — DoD item 5,
  data parity.** Fix both and assert parity, or the menu and the generator disagree about whether
  the option exists at all.
- Callers must pass the script through: `index.html:2540` and `:5033` gate the arc-script checkbox
  off `APP.lang`/`APP.srcLang` only; the v76_i picker already holds the chosen scripts.
- **Re-check `scriptTeachable` at the same time.** Once the source set narrows to ONE script its
  `soundsFor` test is being asked a sharper question than before — confirm the sr→sr direction is
  teachable in both directions rather than assuming it.
- Its own release. The gate itself is headless; only the end-to-end needs a live model.

### ✅ SHIPPED as `v78_l` — Replay's target ordering (NOT a conflict, an ORDER bug)

**User: "the replay button plays only comprehension lessons after a lesson is complete… preferably
those that haven't been seen before. Is this request in conflict with the definition of this
button?"**

**Answered: no. The definition is fine and the ORDER is wrong.** Replay is `repeatForCoverage`,
whose defined job is to raise COVERAGE. A lesson at 100% has nothing unsolved, so replaying it
raises nothing and it is correctly skipped. **An unplayed lesson is not at 100% — it is at zero**,
so "prefer ones not yet seen" is not a competing rule, it is the *strongest case* of the rule
already there.

What actually goes wrong: `_firstCoverageShortLessonIdx` returns the **first coverage-short lesson
in document order**, not the least covered. A comprehension lesson sits early and, since `v77_t`
narrows a repeat to the questions still unanswered, stays short for a long time — so it wins that
scan every time and later unplayed lessons are never reached.

Fix shape: choose the **least-covered** counted lesson (unplayed = 0% sorts first) rather than the
first short one. Keeps the button's meaning intact, no ruling needed. **Schedule with §0e/§3**,
which already owns the same card; re-run and diff `probe_gates_v77.js` after it.

### → §0c — auto read-out: RULED (user, session 32), but HELD for a screenshot

**User: "move auto-read from the progress card when the story unlocks to the card that is shown
before comprehension lessons. No other place. But the mute button should work on it."**

The read-out does not go on the finished card at all; it **moves**, and the current §0f call site is
**removed in the same change** — "no other place" is part of the ruling, not a side effect.

**HELD: do not implement yet.** The user will send a screenshot pinning which card is meant. "The
card shown before comprehension lessons" is ambiguous in the current walk — the summary card
(`v77_h`), the story-unlocked card (`v77_j`) and the progress card can all precede a comprehension
lesson, and `v77_j` exists *because* the story-unlock moment was given its own page. Guessing would
move the feature to the wrong screen and delete the working call site on the way.

When it is built:
- **Mute must work on it** — a REAL change, not a restatement of §0f's first restraint. §0f only
  checks `APP.muted` at fire time and then goes straight to `_doSpeakLang`, deliberately bypassing
  `speakBodyText` (which force-unmutes on a tap). "The mute button should work on it" means pressing
  🔇 **while it is reading** must stop it — i.e. `toggleMute` has to cancel speech in flight. Check
  what `toggleMute` does today before assuming.
- §0f's other three restraints carry over verbatim: never on a review render, once per chapter per
  session, never interrupt speech already in progress (`v75_h`).
- `_autoReadStory` already takes `(topicKey, story, langCode)`, so the move is a call-site change
  plus the mute wiring — not a rewrite.
- The `v77_v` guard asserts §0f's behaviour at the OLD site and must move with it, or it passes
  vacuously against a call site that no longer exists.

Measured, and still true: `_autoReadStory` has exactly one call site today (the progress card story
panel, `v77_v`), and the finished card `v77_f` has none. So this was never a regression.

### → Group B, unchanged

The remaining group-B items are **not** displaced by this batch and stay next in line.

## USER TESTING NOTES — session 31 batch, TRIAGED (not yet done unless marked)

Triaged with the code loaded. Grouped by what each needs, because several look like separate items
and are not. **Two were fixed immediately as `v77_x`** (chapter titles, math order).

### A. Fixed this session
- ✅ **Chapter-title generation failing on multi-chapter storylines** — `v77_x`. Root cause above;
  note it explains the user's own observation that the lesson-set page worked.
- ✅ **Math ordering shows the solved order** — `v77_x`.

### B. Small and self-contained — good first work for a fresh session
- ✅ **Clear-progress at CHAPTER level** — `v78_e`, on the **progress cards** (🧹 `comp-wipe`), via the
  shared `_clearChapterProgress`. The storyline page keeps its storyline-wide control and now shares
  the same rule; **`clearLessonProgress` turned out to be a THIRD copy carrying the `v77_s` defect
  and is fixed too.**
  **RESOLVED by the user (session 32): the "inside error / AI-error-hunt lessons" half meant
  something different — clearing the errors the LEARNER had marked, so they can be re-tagged, not a
  chapter wipe. The user then dropped it: "we can actually skip this." Not carried forward.**
  Still optional, never requested: a per-chapter control on the storyline page's chapter cards. Not
  scheduled — the progress card already carries it and those cards have the lock overlay and the
  `v76_d` element-counting trap. Raise it if it is wanted.
- ⚠️ **Sentence-translation read-out should include the `"Übersetze: "` prefix** (tp_579238210) — read
  the whole question in the source language. **RETRIAGED session 32 → needs the USER, not a fix.**
  `Übersetze: "{sentence}"` is `ex.order.q`, the WORD-ORDER exercise, and its question is entirely
  in the source language — which fits the note exactly. But **there is no read-out of it to add a
  prefix to**: every `speak`/`speakLang`/`speakBodyText` call site was enumerated, and `renderEx`
  auto-speaks only `listen_mcq`/`listen_type` (and speaks `ex.target`). `tOrder` renders no speaker
  control at all. So this is either a request to ADD a source-language question read-out to the
  order exercise — a new affordance, not a prefix fix — or it is about a screen other than the one
  found. **Ask before building.** Full note in the session-32 notes §3.
- ✅ **Synonym/antonym questions should state how many are to be found** ("<n> similar to <word>")
  — `v78_b`. Counted from `ex.correct`, the array Check scores against. New `_n` keys (owed to the
  translate pass); the uncounted keys stay as the fallback and must not be deleted.
- ✅ **Conjugation options must be alternative forms of THE SAME verb**, not other verbs, and need
  not be padded to four — `v78_d`. Same-verb pool, no cross-verb padding; the coverage universe was
  checked for the v71_s stranding trap and is unaffected.
- ✅ **Teacher-mode switch at the bottom of every page**, beside the UI-language and mute controls
  — `v78_f`. Three controls, ONE updater; the compact footer icon derives its glyph from the same
  label string the landing button shows, so there is no second spelling of "which icon means which
  state". Reused the existing `teacher.*` keys — nothing new owed to the translate pass.
  (User's "will later depend on credentials" is unchanged and still ahead: the control is wired to
  `APP._teacherMode` exactly as the landing button always was, and gating it on credentials is the
  same one change in the same one place it would have been before.)
- **Highlight word forms from conjugation and word-form lessons**, so covered vocabulary lights up
  more fully. **Belongs with §0e/§3 and the ONE shared matcher** — do not add a second matcher.

### C. Needs a live model — prompt work, verify with the user
- **Error-hunt lessons fail too often.** The user's diagnosis is concrete: make the error count
  length-dependent (1/2/3 by difficulty per paragraph or per word budget), relax "exactly", and use
  1/2/3 in TOTAL as the rejection floor. The reported failure ends in an empty Ollama response after
  three retries, so this also costs a whole add-lesson attempt.
- **Vocab lessons: article mismatch** (target `palazzo`, source `der Palast`). Prompt needs to be
  stricter, with BAD examples.
- **Word-form sentences are too long** — same treatment as synonyms.
- **Comprehension scope:** ask for chapter-level questions first, then whole-story ones, via the
  prompt rather than a new selector.
- **§0g's model-prompt change** (already recorded) belongs with these.

### D. Bugs needing reproduction — ask the user for the case
- **Bulk "add lessons": ticking mixed produced no mixed lessons**, and adding mixed alone appears to
  require another lesson type alongside it. Should work on its own, per chapter.
- **Live mode: edit windows keep the PREVIOUS chapter's content** when browsing between chapters
  (lesson editor, QC story proposals). Smells like a render that reuses a panel without clearing it
  — the same shape as several card bugs this session.

### E. Larger features — need their own release, and a decision first
- **Second script for Serbian (Latin ⇄ Cyrillic):** an LLM-generated alternative script plus a
  toggle beside the translate button in every read-story field. Note `v75_g` already ships an
  `sr`/`hr` table and a native review is OWED — settle that first.
  **Extended session 32 — the SAME toggle is wanted for the UI.** The `sr` `ui.json` pass that
  arrived at the session-32 drop is complete (612 keys) and **written entirely in LATIN script,
  zero Cyrillic**. User's ruling: *"we can keep this for now, but later perhaps add both options."*
  So `sr` UI stays Latin-only and is **not** a defect. When it is picked up, note the shape: this is
  the same question as the story toggle and the same question as `_scriptChoice`, in a third place —
  a language whose UI, whose story text and whose lesson content can each be in either script. It
  wants ONE notion of "which script is this learner reading", not three toggles that can disagree.
  **Sequence it after §7** (script lessons for a digraphic source), which is the first thing to
  actually READ the per-topic `script`/`srcScript` fields; §7 establishes whether that pair is the
  right carrier before a third consumer is built on it.
- **Live main page should mirror the static one**, with generation moved behind a button/card, and
  every "continue story" affordance redirecting there.
- **Floating pill listing running LLM jobs, one row each, with a working STOP per job.**
- **Token accounting must include deleted lessons/chapters** — record the spend when deleting, or
  the total is not a total.
- **Social-media preview for storyline URLs** (title + storyboard). Server-side OG tags; cheap only
  if the storyboard is already reachable as an image.
- **Startup check for missing ENGLISH ui.json keys**, not only other languages. Note
  `unit-ui-key-exists` already does this in the SUITE — this is about the running app.

## RECOVERED — carried since v71, still not done

These were lost once at the v71→v72 roadmap boundary and recovered in `v73_k`. **Do not let them
drop again.**

- **Global QC**: a checkbox menu of what to QC, merged with the user's request to make the book's
  automatic QC opt-in from the lesson-type menu and run it AFTER the storyboard pass. **Note this
  reverses the `v68.1` ordering decision.**
- **Crossword**: show the correct word's translation instead of the empty underline. **Needs a
  decision first** — `word_forms` items have no translation.
- ~~**Live mode with teacher mode OFF must hide every editing control.**~~ **DONE in `v79_j`**
  (session 33). `_canEdit()` now keys on teacher mode alone; the truth table moves in exactly one
  cell and `unit-can-edit-teacher-mode` holds it. **One thing this entry got wrong, kept as a
  warning:** it read as though `_canEdit()` were the whole conflation. It is not —
  `Edit / rename topic` (index.html, the library row) is a pure editing control gated directly on
  `canGenerate` and was never a `_canEdit()` caller, so a fix touching only that function would look
  complete and leave the pencil in place. It stays visible **by user ruling** (session 33: Continue
  story / Add lesson / Edit-rename are "generation, not editing"), which is a decision rather than
  an oversight — revisit it with the larger learner/teacher rework, not on its own.

---

## Owed by the USER — not doable in a container

**New `en`-only keys from `v78_b`, owed to the translate pass:** `ex.syn.q_synonyms_n`
(`{n} similar to {word}`) and `ex.syn.q_antonyms_n` (`{n} opposite to {word}`). **Both carry TWO
placeholders** — a translation that drops `{n}` silently loses the feature for that language, so
these are worth a glance when the file comes back. The uncounted `ex.syn.q_synonyms` /
`ex.syn.q_antonyms` are still in use as the fallback and are already translated: **do not delete
them.** `unit-syn-count` §5 asserts en-only, which is correct only while the keys are new — flip it
to "no language holds the English string verbatim" once the pass has run (`v71_q`).

**New `en`-only keys from `v77_i`, owed to the translate pass:** `unlocked.title`
("Next chapter unlocked!"), `unlocked.next`, `unlocked.back_card`, `unlocked.progress`
("{done} of {total} chapters").

**New `en`-only keys from `v77_h`, owed to the translate pass:** `summary.title`
("The story so far"), `summary.open`, `summary.next` ("Back to your progress"),
`summary.chapters` ("{n} chapters").

**New `en`-only keys from `v77_f`, owed to the translate pass:** `finished.title`
("Story finished!"), `finished.vocab` ("Everything you learned"), `finished.next`
("See the whole story"), `finished.back_card` ("Back to the chapter"). `t()` falls back through
English meanwhile. **`v71_q`: never assert a dropped key absent.**

- **A browser pass.** Nineteen releases deep. `v74_c` changed what coverage MEANS, `v74_i` was the
  only `server.js` change of the session (live mode is the half that cannot be exercised headlessly,
  only simulated), and `v74_j` / `v74_n` are visual.
- **Serbian/Croatian follow-ups (`v75_g`):** the 28 non-English `names` entries in
  `languages.json`, the `ui.json` translate pass for `sr` and `hr` (both are empty stubs), and
  **a native-speaker check of the 30 `cyrillic-sr` rows** — especially the letter names and the
  IPA column. The table was authored in-container, which is exactly the case the design
  principle warns is wrong in ways that stay invisible until a native speaker looks.
- **The comprehension QC checker** — needs a new prompt and a live model. Correctly queued, not
  started in a container.
- **The translate pass.** Changed in English and DROPPED from the other 29 languages for refill:
  `complete.story_unlocked`, `ex.badge.comprehension`. New and English-only:
  `complete.words_solved` = "Words you can read in this chapter",
  `form.finish_mixed` = "Finish the chapter with a mixed review round (no AI)".
  **(v75_b) These two were MISSING FROM `en` TOO** — the returning `ui.json` predated them, so they
  rendered as raw key text. Now present in `en`; every other language is missing exactly these two
  and nothing else (verified). `t()` falls back through English, so nothing is broken meanwhile.
  **`v71_q`: never assert a dropped key absent.** **When the file comes back, `unit-ui-key-exists`
  catches it if it predates the code again.**

---

## ⚠️ STANDING RULE — session 37 (user), IN FORCE UNTIL REVOKED

**"I am the only teacher/student at the moment, so it doesn't really matter if a change affects the
user progress."**

This is a standing instruction, not a one-off ruling for a single release. Its consequences:

- **Progress impact is NOT a blocker.** A change that invalidates, resets or re-colours existing
  learner progress may ship on its merits. Do not design around preserving `learners.json`, and do
  not add migration machinery for it unasked.
- **It does NOT license skipping measurement.** Keep measuring what a change does to the numbers —
  the measurements have repeatedly found real defects (`v81_d`'s 92 vanished words, `v81_h`'s
  colouring shift) and they are how a release is understood. What changes is only the WEIGHT given to
  a progress regression when deciding whether to ship, not whether it is looked at.
- **It does NOT relax the monotonic-solved-store rule** (`§T7` reading 1 vs 2). That distinction is
  about what the app CLAIMS the learner has done, and it is a ruled design boundary, not a
  data-preservation concern.
- ⚠️ **Revocable.** If a second learner ever exists, this rule lapses and progress-preserving
  behaviour becomes load-bearing again. Check it is still in force before leaning on it.

## ⚠️ How the rules are NUMBERED — read before citing one

**The standing rules run to 46, but the numbering in this file is not continuous, and that is a
wart rather than a gap.** Two blocks restart at `1.`: "Rules earned in session 28" (rules 1–8) and
"Rules earned in session 29 (continued)" / "Rules earned in session 29" (which carry what the rest
of the corpus cites as rules **10–14**, and which a grep for `^10\.` will therefore never find).
"Rules earned in session 30" resumes at `15.` and the numbering is continuous from there through 35
("Rules earned in session 34"), and again through 36–37 ("Rules earned in the v83 line"), 38–40
("Rules earned in the v84 line"), and 41–46 ("Rules earned in the v85 line", added at THIS cut) — a
whole release line rather than one numbered session, since that is the unit this project's cuts
actually happen at now. **This note itself had gone stale once already** (it stopped at "36–37" for
two whole lines' worth of later additions before this cut fixed it) — update it EVERY time a new
"Rules earned in the vNN line" block is added, in the same edit, not as a follow-up.

**Do not renumber them.** Every "rule 23", "rule 29", "rule 32" citation across the session prompt,
`INTERNALS.md`, the session prompts, the session notes and several test files is by number, and a
renumber would silently invalidate all of them — the exact failure mode rule 29 is about. When a
session says "thirty-five standing rules" it means **numbered to 35**, not thirty-five entries;
`^\d+\. \*\*` finds 33, and the "9. Package" line inside the definition-of-done list is not a rule
at all and will inflate any naive count by one.

## Rules earned in session 28 — read these before writing a probe

1. **A probe must call the product function, never a re-typed copy** — and least of all one lifted
   from a test stub. Two false findings came from re-implementing `lessonCountsFor` and the
   read-full-story lock instead of invoking them. One reported a hole that did not exist; the other
   reported a fix as not working when it already was.
2. **A claim about behaviour is only measured if the assertion touched the thing being claimed.**
   `setComplete=false` is not evidence about a button. Three inference-not-measurement errors this
   session: math's generator, the `lessonCountsFor` stub, and the error-hunt "lock".
3. **A non-vacuity check must be evaluated on the data the assertion actually runs against**, not on
   the data it was derived from. Two guards passed under their own reverts because the fixture had
   been projected before the assertion saw it.
4. **A guard that reads its own explanatory comment is a guard that lies.** A negative match on
   `white-space:nowrap` found the comment naming what had been replaced.
5. **A headless harness that builds `APP.savedList` from whole topics is testing STATIC mode**,
   whatever else it thinks it is testing. That blind spot hid `v74_i` from 167 green checks — every
   existing test ran in the static shape, and the live shape existed only in a browser.
6. **Where the environment admits only one writer, unexplained state is yours.** Mid-session a
   version bump and three edits landed without the definition-of-done being run, so the tree drifted
   past the artifact the user held; the changes were then not recognised as mine. The suite-docs-
   package cycle exists to make that drift impossible. Follow it per change.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session (REVISED at the `v80_d` cut — there are TWO documents now, not four):**
read the current **session prompt** first, `build_history/SESSION_PROMPT_v*.md`, highest version
(baseline numbers, what session 35 shipped, what is owed by the USER, open decisions — it absorbed
`HANDOVER.md`, which no longer exists), then THIS file (the highest-numbered
`build_history/roadmap_v*.md` is the current one, and it now carries the folded **THE LARGER PLAN**
section that was `implementation_plan.md`), then `INTERNALS.md`. The
`build_history/v*_session*_notes.md` files are history: search them, do not read them cold. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- **A carried-forward open item must be cross-checked against the SHIPPED list in the same file
  before it is carried again.** Added session 26: the "Drill result card" item was carried through
  four releases while `roadmap_v71.md` recorded it as shipped in `v71_h` on line 227 — the open
  entry sat 264 lines below the entry that closed it. Deferring an item is not evidence that it is
  still open.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test. For render
   paths (anything drawn in the client), add/extend a `smoke-render` case — source assertions cannot
   see runtime scope, TDZ, or layout.
2. **Browser-only behavior → session notes** *(the former LIVE-TEST-CHECKLIST.md is a closed
   archive — do NOT add sections to it)*. If the change is browser-only or Ollama-only (UI, RTL,
   TTS, rendering, anything not exercisable headlessly), the session notes MUST contain a short
   "how to see it work" description — what to click and what to expect — so the user can verify it
   in normal use.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
   **(v71) When a translated `ui.json` comes BACK, validate before merging:** per-language key
   counts, and whether any `en` key vanished. A returning file may predate recent releases.
   **A test asserting a key is "en-only" is correct while the key is new and wrong once it has been
   translated** — assert instead that no language holds the English string verbatim.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
   **Point releases use an alphabetic suffix** (user, v70): the base cut is the bare number and is
   implicitly `a`, so the sequence is `v88_a` → `v88_b` → `v88_c` → … — the same convention the v69–v86
   lines ran. **This is the `v88` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v88 line.
   (This paragraph is the one version-specific line in the block and had shipped stale FOUR times by
   session 32 — `roadmap_v73.md` said "the `v72` line", `roadmap_v76.md` said "the `v75` line" for
   its whole run, and this file was written at the v78 cut still naming the v77 line, in BOTH
   sentences. **It is no longer maintained by hand: `unit-roadmap-version` asserts that the
   highest-numbered roadmap names the same base version as `server.js`'s `APP_VERSION`.** A note
   telling the next session to check something is not a guard; four repeats is enough evidence that
   this one was never going to be checked.)
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
   **(v75) Prompt files are named for the version the session WRAPS UP WITH**, not the one it starts
   from: the prompt that opened the session ending in `v75` is `build_history/v75_prompt.md`. The old
   `session_{n}_prompt.md` names were renamed to match (`session_28_prompt.md` → `v74_prompt.md`,
   `session_29_prompt.md` → `v75_prompt.md`) — the session numbering had drifted from the version
   numbering and only one of the two is meaningful later.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).
   **(v77_h, user) The zip's TOP-LEVEL DIRECTORY must be named for the release it contains**, not
   for the base cut: `dreizunge_v77_f.zip` unpacks to `dreizunge_v77_f/`. Unpacking every point
   release into the same `dreizunge_v77/` silently overwrites the previous one, or merges into it —
   which is how a stale file survives a release. Rename the directory before zipping; do not rely
   on the working directory's name.

**(v71) Test-quality rules — added because five guards failed in one session, in five distinct ways:**
- **Verify every guard by reverting its fix and watching it fail.** Four of the five were caught
  this way; the one that was not is the one that reached a release.
- **A vacuous guard passes for the wrong reason.** (v70_f: "a Check after reveal credits nothing"
  passed trivially, because reveal marks every entry done and Check skips done entries.)
- **A conditional guard only sometimes exists.** (v70_g: repeat assertions wrapped in
  `if (replayTargetExists)`, which in that scenario did not.)
- **A guard should fail as a named assertion, not a `TypeError`.** (v70_l: reverting the highlight
  threw inside the sandbox — a far weaker signal for whoever hits it.)
- **Test the caller, not just the helper.** (v70_m: five assertions on `_synContext`, none on
  `tSynSelect` — reverting the render passed them all.)
- **Test against the data that prompted the report.** (v70_n: the synonym trim was green and did
  nothing, because the fixture was a multi-sentence paragraph — the shape the fix handled, not the
  135-word single sentence the user was complaining about.)

**(v71) Reachability rule:** a learner-facing feature placed on the lesson-set page is unreachable —
learners skip that screen entirely (v60 learner nav). `_canEdit()` is NOT the gate that matters;
check against `_isLearner()`. When reporting a new affordance, say WHERE it lives in the navigation,
not just that it exists.

**(v71) Known harness traps** (each cost a debugging cycle):
- The stub DOM does **not** parse `innerHTML` — `querySelectorAll` returns `[]`. Assert against the
  markup string; `getElementById` persists stubs, which is what makes interaction testable.
- Values returned from `C.run` belong to another realm, so `deepStrictEqual` against a local `[]`
  fails on prototype identity. Compare lengths or spread first.
- `_lessonQidUniverse` caches on `topic|lessonIdx` and returns the cached Set **without
  re-deriving**. Swapping a lesson's content under a fixed topic+index is something only a test
  does — give such scenarios their own topic key.
- `build()` **samples**: it emits a round, not the full question set, and a different subset per
  call. Never derive a question's identity by rebuilding; synthesize the exercise shape and let
  `qid()` key it.
- Fixture data is **not** a constant. A scenario that leans on "the first topic in `lessons.json`"
  will break when the bundled data is replaced.
- **`APP.cur` has a DEFAULT (`lessonIdx: 0`, index.html:1651) that sections silently depend on.**
  `_exFlagTarget` resolves a flagged item through `APP.cur?.lessonIdx`, and `assembleCoverageRound`
  keys the solved-set through the same fallback. So a section that needs a real lesson index must
  **mutate and restore the field** (`APP.cur.lessonIdx = i` … `= 0`), never replace or `delete` the
  object — doing either broke an unrelated later section in v71_r. Mutating also mirrors real play,
  where `openLesson` sets `C.lessonIdx = idx` immediately before `buildExercises(idx)`.

**(session 23) DESIGN PRINCIPLE — no language knowledge in the code.** The code must not encode
facts about particular human languages: article lists, gender rules, pronoun sets, inflection,
"which languages use articles", sentence-final punctuation. Producing correct language content is
the MODEL's job — instruct it in the prompt instead. A per-language table is written by whoever is
editing the code, is wrong in ways invisible until a native speaker looks, and fails silently for
any language missing from it.
*Not* covered: mechanical/typographic facts that decide how text is HANDLED rather than whether it
is CORRECT — Unicode normalisation, script/RTL detection, diacritic folding for comparison.
The test: **does this decide whether content is right, or only how it is displayed/compared?**
Known violations inventoried in `INTERNALS.md` → "Design principle"; the worst
(`normalizeVocabArticles`) actively degrades real data.

**(v71_w) Rules:**
- **A progress FRACTION and a FINISHED signal are different questions.** "How much have you played"
  may stay a raw count; anything asserting completeness — a colour, a lock, a tick, a connector line
  — must read the shared rule. The storyline page got this wrong for two releases in both
  directions at once, and nothing failed because the two rules agreed on the bundled data.
- **A source-pin regex that falls outside its own slice window is a vacuous pass.** A 4,000-char
  slice of `_renderChapterCard` stopped before the line being pinned. Check the pin actually sees
  what it claims to.

**(v71_u) Rules:**
- **Wiring changes need a RUN, not source assertions.** When one side sends and the other consumes,
  assertions on each half prove nothing about the join: in `v71_u` the server could ignore
  `arcTypes` entirely and the whole 156-check suite stayed green. If a change is "A now passes X to
  B", the test must observe B's OUTPUT.
- **A standard/vocab lesson has NO `type` field** — it is the default shape. `l.type === 'standard'`
  is never true, and an assertion written that way is vacuous (this bit inside the very test written
  to catch a vacuous pass). Use `(l.type || 'standard')`.
- **A test that re-implements the code it tests cannot fail when that code is deleted.**
  `unit-arc-options` kept passing after its feature was removed. If a test builds its own copy of a
  block to run it, it is testing the copy.
- **New lesson types need a `fake-ollama` branch**, or an e2e will skip them silently — the arc loop
  correctly refuses to abandon a run for one bad type, so the omission is invisible. Order matters:
  place a new matcher before any looser one that could swallow it (`correctIndex` is shared by
  comprehension and word_forms).

**(v71_t) Rules:**
- **Ollama truncates an over-long prompt SILENTLY.** `num_ctx` defaults to ~4096 and there is no
  error when the prompt exceeds it. Any change that makes a prompt bigger must size the context
  window in the same commit, or the extra text is discarded invisibly and the change looks like it
  worked. A deliberate trim in our code always beats letting the backend cut blindly.
- **`callLLMLesson` spreads the caller's opts AFTER its think policy**, so a caller passing
  `timeoutMs` or `tokens` OVERRIDES the ×3 / ×2.5 that reasoning mode applies. Check you are not
  lowering them — "raise the timeout" is easy to write as a reduction.

**(v71_s) Rules:**
- **A review render is not a play.** `showComplete(true)` repoints `APP.cur` at the LAST counted
  lesson so the vocab recap resolves, so anything that JUDGES the learner — records a done-flag,
  locks Next, counts an exposure — must be behind `!C._review`, or it judges a lesson nobody just
  played. Third time this shape has bitten (v71_n, v71_s twice).
- **A withheld done-flag makes `_firstUnfinishedLessonIdx` keep returning that lesson.** Any rule
  that refuses to mark a lesson done must also stop Next pointing back at it, or the forward button
  silently means "replay this" and steps over the v71_d lock.
- **When a builder or gate is narrowed by lesson type, narrow the COVERAGE UNIVERSE to match.** A
  denominator that counts questions the round will never ask can never be satisfied.

**(v71_r) Diagnosis rules:**
- **A red baseline is a finding until proven otherwise.** When only the DATA files are newer than
  the code, the obvious read is "stale fixture" — but check whether the guard is *right* first.
  In v71_r the fixture had indeed moved AND the property it asserted was false, hiding a live
  defect. Fixing the fixture alone would have shipped the bug.
- **A failure appearing *after* you fix another one may not be new — it may be running for the
  first time.** An earlier `assert` aborts the file, so everything below it is unexecuted. Verify by
  patching the PRISTINE tree to skip the original failure and watching the later section pass,
  before assuming your change caused it.
- **Guard a guard against going vacuous on new data.** If a section only means something when the
  corpus contains a case (here: a lesson exceeding its builder's cap), assert that such a case was
  actually found. Without it the section silently becomes a no-op — which is precisely how §8
  passed while grammar sampled at random.

## Rules earned in session 29 (continued — see the session notes for the full set)

5. **A whitelist fails silently and per-type, so its guard must be per-type AND driven off the
   registry**, or it guards only the types someone thought of.
6. **A "curated title" is a proxy for authorship, not for content.** Deciding which copy of a
   duplicated record survives by any signal other than its content will eventually delete content.
7. **"Every language has key X" goes stale when a LANGUAGE is added**, exactly as "key X is absent
   everywhere" goes stale when the translate pass runs. Scope such claims to the languages actually
   translated, and floor them for non-vacuity.
8. **Replacing a brittle source pin is itself a change that needs revert-verifying.** The first
   replacement of the `if (!u)` pin was vacuous in a NEW way — its match window reached past the
   block it meant to check — and only the paired behavioural test exposed it.

## Rules earned in session 29

1. **A comment near a source-scanned pattern must not spell the pattern.** The repair comment for
   `common.cancel` contained a literal `t('…')` call and failed the very sweep it documented —
   rule 4 above, arriving from the other direction: a correct guard made to fail by prose *about*
   code. A source scanner cannot tell the two apart.
2. **When a guard asserts the precondition of a render, assert it against the state the render
   LEAVES.** A precondition checked before `showComplete()` passed under its own revert, because
   rendering the card is what marks the lesson done and flips the branch it was guarding.
3. **A test that does not reset shared state is a test of whatever ran before it.** `seed()`
   preserves `APP.progress` by design and the §3 lock probe writes completion keyed by topic NAME;
   one corpus change made two fixtures the same chapter and the leak surfaced. A section needing
   empty progress must clear it and say so.
4. **Timestamps are evidence, and cheap.** `ui.json` older than `index.html` was the entire
   diagnosis of the first red check.

## Rules earned in session 30

15. **A fix to the client is not a fix to the published build.** `build-static.js` re-implements
    part of `index.html` — currently `loadSavedList` and `savedItemHtml`. Any change to the landing
    page must be applied twice and asserted against `docs/index.html`. The `v76_e` guard passed for
    two releases while the published build stayed broken.

12. **A test that hard-codes a COUNT of a repeated element is pinning the fixture, not the claim.**
    `total 🔒 === 1` meant "a two-chapter storyline"; it broke on a six-chapter chain while the
    product was correct. Count by element KIND (the chapter-card overlay and the full-story row are
    different elements), or assert the specific element the claim is about.
13. **A guard whose scenario matches nothing may never reach the branch it tests.** `loadSavedList`
    returns early on an empty filtered list, so a "this must NOT be shown" check written with a
    filter matching nothing passed under its own revert. A negative assertion needs a positive one
    beside it proving the render got that far.
14. **Identity must be CARRIED through a projection, never recovered by hashing it.** Third time:
    `v75_f` (a storyline rebuilt because its stored id was not the hash of its chapters), `v76_e`
    (a storyline unrecognised because its chapter list was filtered before it was matched). If a
    list is filtered and then matched back against its source by length or position, the filter and
    the match are the same bug waiting.

## Rules earned in session 31

21. **A variable declared with `let` further down the same function cannot be read earlier — check
    the declaration line before reaching for a value.** `showComplete` computes `_storyDone` ~60
    lines BELOW its Next wiring; reading it there is a `ReferenceError` on every terminal card, and
    it is the exact `v68.1` bug in the exact `v68.1` function. **And the obvious fix is worse:**
    re-deriving the value inline creates a second copy of the rule, which is how the storyline
    page's connector line drifted in `v71_w`. Extract one function both sites call.
22. **A handler declared inline in markup is one a headless test can never click.** The stub DOM
    does not turn an `onclick="f()"` attribute into a callable property. `comp-next` has always
    assigned its handler in JS; anything testable must do the same.

19. **Three of `v76_card_gates.md`'s findings were seeding artefacts, in three different stores**
    (`comp-back`/`comp-story`: the stub DOM itself; the coverage rows: `solved` keyed by item vs
    qid; `comp-drill`: `learned` never written at all). A gate table is only as good as the state it
    seeds, and "the element was never enabled in 32 rows" usually means **the store that enables it
    was never populated** — not that the feature is dead. Before deleting a control as unreachable,
    find its enabling store and write it the way the PRODUCT writes it.
20. **When a passing test contradicts a written finding, the test is usually right.**
    `unit-card-consistency` asserted "drill is live once mistakes exist" while the truth table said
    "never once enabled", and the contradiction sat in the tree for a release because prose is read
    as measurement and a green assertion is read as a detail. Grep the suite for the element before
    trusting a table about it.

16. **An element-visibility probe against the stub DOM must first assert the element exists in the
    MARKUP.** `lib-dom` auto-vivifies any id, so `getElementById('anything')` returns a fresh stub
    with no `display` and no `disabled` — which reads as "present and visible", or as "present and
    hidden" once the probe's own legend maps it. Two of the nine columns in `v76_card_gates.md`
    (`comp-back`, `comp-story`) were phantoms for a whole release, and the roadmap carried
    "the button is already there and already dead" into a rework that was about to reuse it.
    The probe DID call the product function — but the READOUT went through the stub, so the
    assertion never touched the thing being claimed (session-28 rule 2, from a new direction).
17. **When two stores are keyed differently, seeding one and reading the other measures nothing.**
    The `v76` coverage question — "86 keys in, 0 counted" — was a probe seeding the QID universe
    into a store `topicCoverage` reads by ITEM key. Before concluding a gate is unreachable, seed
    it the way the PRODUCT writes it (here: `markSolved`), or drive the real path.
18. **A guard that asserts a construct is ABSENT survives a rewrite; one that pins a phrasing does
    not.** `unit-card-errors` asserts zero empty `catch` blocks in `showComplete` rather than
    matching the new call text — so it keeps working as the rework moves that code, which is
    precisely what §0a asks of the eight files that currently pin source text.

## Rules earned in session 32

23. **A fixer is not a diagnosis, and two guards firing together may be one cause seen twice.** The
    `v78` baseline opened red on both data-sensitive guards, each with a documented one-line remedy.
    Running either remedy **destroys the evidence** that says whether the remedy was right: three
    cheap facts (corpus counts unchanged at 308/86, `lessons.json` the OLDEST file in the tree, the
    hash the freshness guard names) narrowed it before anything was written, and the first
    hypothesis they suggested turned out to be **wrong** — the backfill did not reproduce the hash
    `docs/` was built from. The real cause was one thing: the shipped `lessons.json` was the user's
    NEWER file (7 topics with an `ai_error_hunt` lesson `docs/` lacked). **Corollary: when the
    remedies interact, the ORDER is part of the diagnosis** — `build-static.js` first, the fixer the
    failure literally asks for, would have baked the unstamped corpus and overwritten the evidence.
    Backfill, then rebuild.
24. **A note instructing the next session to check something is not a guard.** The protocol's
    version sentence went stale four times, each correction ending in a fresh reminder to check it
    next time; the fourth repeat got BOTH its sentences wrong, the second having survived every
    earlier fix. If a fact can be derived from a source of truth, assert it (`unit-roadmap-version`).
    A reminder is what you write when you have decided not to.

25. **Never put emoji — or any non-BMP character — in a string literal inside the script that writes
    a file.** Session 32 truncated `roadmap_v78.md` **to zero bytes** with a heredoc containing
    `\ud83e\uddf9` surrogate escapes: encoding rejects lone surrogates, and the exception arrives
    AFTER the file is opened for writing, so a "failed" write is not a no-op. Write such blocks with
    a `cat` heredoc to a temp file and splice the FILE in, so the bytes come from disk rather than
    from an escape the writer must encode. `unit-roadmap-version` caught it on the next run, and the
    packaged zip was the only intact copy — both worth remembering.

26. **When two releases each change the same surface, re-measure the older plan against the newer
    behaviour before scheduling it.** §0e's "order the vocabulary as the words appear in the story"
    assumed a per-CHAPTER panel; `v77_f` later made that panel CUMULATIVE across the deck. Neither
    was wrong, and nothing forced them to be compared — so a plan carried unchanged across three
    roadmaps turned out to describe **17% of the data** (measured: 83% of cumulative panel words
    never occur in the story on screen). The check was one probe over the corpus and was available
    the whole time. **A plan carried forward unchanged across N roadmaps is a plan whose premises
    have not been checked against N roadmaps' worth of changes.**

27. **When a comment predicts a failure mode, check every site the prediction covers — not the one
    in front of you.** `v76_h` wrote down that naming the script inside the language name "is not
    enough on its own — the model still drifts", fixed the STORY prompt, and left three LESSON
    prompt builders with the name alone. Two sessions later the corpus produced exactly the
    predicted artefact: a chapter with a pure-Cyrillic story and Latin vocabulary. **A note saying
    "X is not enough" is a search instruction: grep for every place X is done alone.**

28. **A corpus artefact is evidence of a cause only once you have checked what generated it.** At
    the v79 cut a Cyrillic chapter with Latin vocabulary was read as prompt drift, and a fix was
    written and shipped on that reading. The lesson's own `_genMeta` said `_arcMode: "reinforce"` —
    a mode whose JOB is to re-teach earlier chapters' vocabulary, which was Latin on purpose. One
    field, already in the data, would have settled it before any code was written. **`_genMeta`
    records how every lesson was made: read it before diagnosing what a lesson contains.**

## Rules earned in session 33

29. **When a pin breaks, ask whether the CLAIM changed or only the TEXT did — and if only the text,
    re-anchor rather than re-pin.** Five source pins broke this session and not one of them had a
    false claim: `unit-reasoning-model-safety` and `unit-reasoning-toggle` sliced from a line that
    moved; `unit-book-script` matched an inline copy that was deliberately deleted in favour of a
    shared helper; `unit-add-lessons` pinned an exact function signature and an exact call string
    that both grew an argument. Re-pinning each to the new text would have preserved the brittleness
    that cost the diagnosis in the first place. **The repair is to express the claim at the level
    the claim actually lives** — the function rather than its arity, the helper rather than one
    site's copy — **and to add a non-vacuity check so the widened pin cannot go silently empty.**

30. **A COUNT is a proxy, and proxies fail on the thing they should welcome.**
    `unit-intro-script` asserted a helper appeared exactly three times, meaning "no call site
    hand-rolls this question". A legitimate new call site — using the helper correctly, fixing a
    real bug — broke it. Replaced by the rule itself: exactly one definition, at least two callers,
    and every call asked about a SET rather than about `APP` globals. **If a test asserts a number,
    ask what rule the number stands for and whether the rule can be asserted instead.**

31. **Before strengthening an instruction, check whether the instruction is already there and being
    CONTRADICTED.** The word-forms prompt already said distractors must be wrong in the sentence;
    three bullets earlier it recommended, as "the easiest reliable exercise", exactly the tense swap
    that produces indecidable items. A concrete recipe beats an abstract prohibition in any model.
    **A prompt is a document, not a set: read the whole of it and look for the bullet that ASKS for
    the defect before writing a sterner version of a rule that is already present.** Corollary,
    also earned here: the prompt had only POSITIVE examples. A worked counter-example — the broken
    item beside its repair — is worth more than another sentence of prohibition.

32. **A release that says it closed a hole is a claim, not a measurement.** `v79_a`'s shipped row
    read as though the script problem was solved; it covered three prompts of fourteen, and four
    releases later a Cyrillic chapter got an all-Latin conjugation lesson. The row is now marked
    SUPERSEDED in place, because the next session would otherwise read it exactly as this one did.
    **When a fix has a natural scope ("every prompt that…", "every call site that…"), enumerate the
    scope from the source and guard the ENUMERATION, not the instances you happened to fix.**
    `unit-script-pin-coverage` sweeps every `sys*`/`generate*` function out of `server.js` and
    demands each be classified; it found 29 builders, three more than a hand-written list had,
    including a story-QC path that returns a corrected copy of a chapter and could therefore
    silently transliterate one that was already right. The sweep found bugs its author did not know
    to look for.

33. **A green guard near a defect is not evidence about that defect — find out what it actually
    compares.** `unit-script-choice` looked like the guard for "a chapter's lessons are in the wrong
    script" and stayed green through exactly that bug, because `backfill-script.js` compares a
    chapter's STORY with its VOCABULARY and the reported chapter's vocabulary was fine. Likewise
    `e2e-bookjob`'s `/Previous story/` assertion passed for both behaviours of `useFullChain` and
    could not see that release at all. **Read a passing test as the sentence it can actually
    justify** — here, "no chapter's story and vocabulary disagree" — and write the missing one.

34. **Prefer guarding at the layer where the claim is observable, and say plainly what remains
    unverified.** Three of this session's releases (`v79_f`, `v79_g`, `v79_i`) can only prove that
    an instruction REACHES a prompt or that a wiring is correct; whether the model complies is
    observable only on a live generation. Where a claim was a wiring fact — "the server sized the
    context window" — the guard moved to the backend (`fake-ollama` now logs `think`, `num_ctx` and
    `num_predict`), because no prompt assertion can reach it. Where it could not move, the limit is
    written into the shipped row rather than left implied.


## Rules earned in session 34

35. **A warning carried forward in the notes is a claim about a DESIGN, not a fact about the
    problem — measure the warned-about thing before you plan around it.** Three documents (the
    session prompt, `roadmap_v79.md` §0 and `INTERNALS.md` §6b) all warned that the fork task's
    progress half was "the risky one", that it was "shared state between forks rather than a
    rendering change", and that making a shared chapter count for both forks "collides with the
    `_rendered` guard, and how you resolve that collision IS the design decision in this task."
    **Both halves of that were wrong, and ten minutes of measurement said so before anything was
    edited.** Progress needed **no change at all**: `APP.progress.completed` and `chapterDone` are
    keyed by topic **name**, so completion was already storyline-agnostic, and playing a shared
    prefix moved both decks identically (0/4 -> 2/4 on each side, measured through
    `chapterComplete` and `_slProgressStats`). And the `_rendered` collision existed only for the
    design where a fork column redraws the whole other storyline including its prefix — the design
    the user then rejected ("don't draw the shared prefix multiple times, keep the forking"), after
    which the guard was never touched. **The warning was true of a plan nobody had committed to.**

    Why this is worth a rule rather than a note: a carried-forward warning is written by a session
    that was *anticipating*, and it hardens into fact by repetition across documents. Three
    restatements read as three confirmations when they are one guess. The tell is grammatical — a
    warning phrased in the future tense ("you will hit", "it collides with", "how you resolve that
    IS the design decision") is a prediction; one phrased in the past ("measured at the v79 cut",
    "it changes 8 of 32 rows") is a measurement. **Spend the first probe on the predicted obstacle.**
    If it is real you have lost nothing and gained a baseline; if it is not, you have been spared
    designing around a constraint that does not exist.

    Corollary, and the reason the real defect was found at all: when the warned-about mechanism
    turns out not to be the problem, **the actual defect is usually one layer out.** Here the fork
    asymmetry was never in the completion helpers — it was in **membership**, a storyline's
    `chapters[]` not listing a chapter its own chain continues from, which is data rather than code
    and needed a user ruling rather than a fix.

## Rules earned in the v83 line

36. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
    shape** (`v83_p`). Changing `PLAN §7.0` CP4's `vocab[i].target` field from lemma to surface form
    silently broke `apply-cp-lessons.js`'s own cross-chapter dedup, which read `vocab.target`
    assuming it WAS the lemma — found only by re-running the FULL test suite for every affected file
    after the first fix, not by reasoning about that one fix in isolation. Any future change to a
    shared record shape (a token record, an analysis record, a concept record, a lesson shape) needs
    the SAME sweep: what else reads this field, and does it still mean what that reader assumes?

37. **A per-caller `think:false` fix does not generalize — every OTHER caller of a raw model call
    needs the SAME check, independently** (`v83_o`, `v83_r`). `v83_o` fixed CP2's `analyzeSentence`
    sending no `think:false` against a reasoning model; `v83_r` found a THIRD, unrelated caller
    (`llm.js`'s own `warmup()`) with the identical gap, only because changing the DEFAULT MODEL
    happened to exercise it end-to-end months later. Grep for every `_callOllama`/`callLLM` call site
    before trusting that "the reasoning-model bug is fixed" — one fixed call site proves nothing
    about the others. Corollary: a NEW test that spawns a server belongs in its OWN e2e file, never
    folded into an existing always-run unit file — `unit-run-summary.test.js` (`v70_b`) will catch it
    if you try, and the fix is to split the file, never to loosen that guard.

## Rules earned in the v84 line

38. **A resource teardown that can fire its "should I resume?" check SYNCHRONOUSLY must run AFTER the
    state that check reads has been updated, not before** (`v84_l`). `_speechStopListening()` was
    originally called BEFORE `check()`/`pickChoice()` on a correct answer — stopping a
    `SpeechRecognition` session can fire its `onend` event synchronously, and `onend`'s own "should I
    resume listening?" logic read `APP.cur.answered`, which hadn't been set yet. Stop-then-check meant
    that read saw `false` and spawned a superfluous second session for a question already answered.
    Any teardown whose own completion callback re-reads mutable state needs the state write to
    happen first, or the callback sees a lie.

39. **An inline `style=""` always wins over a stylesheet rule regardless of selector specificity — and
    this class of bug is invisible to a DOM-rendering test harness with no real CSS cascade** (`v84_l`).
    A pill's `background`/`border`/`opacity` had been set inline since one release, silently making
    every later `.active`/`.listening`/`.muted` class rule a complete no-op for TWO releases before
    anyone noticed — five releases' worth of mutation-tested unit tests stayed green throughout,
    because `test/lib-dom.js` renders the DOM tree but implements no CSS cascade. Found only by
    starting a real server and reading the element's actual COMPUTED style in a real browser. If a
    claim is about rendered/computed style rather than DOM structure, `test/lib-dom.js` cannot verify
    it — that claim needs either a live-browser check or a SOURCE-LEVEL guard (grep the inline style
    for the properties that must not be there), not a DOM-structure assertion that looks like it's
    testing the right thing.

40. **An "obviously safe" optimization that reads fresh state on every call can still defeat an
    existing guarantee whose enforcement actually lived in a step the optimization skips** (`v84_m`).
    Reusing an already-open speech-recognition session across two consecutive same-language questions
    looked safe — the phrase handler already re-reads `APP.cur` fresh every time, the standard defence
    against stale state. It wasn't: the real protection against a stale PREVIOUS question's phrase
    leaking into the CURRENT one was `_speechStopListening()`'s `.stop()` call cancelling that old
    phrase's pending timer before it could ever fire — an optimization that skips the stop, even while
    reading state correctly everywhere else, reopens exactly that hole. Mutation-test any reuse/skip
    optimization against every EXISTING guard the skipped step was part of, not just against the new
    behaviour it's meant to add. Corollary from the same release: when a test mock's shape stops
    matching the real API it mocks (here: turning `interimResults` on meant every real result now
    carries `isFinal`, which the mock hadn't been updated to set), EVERY existing assertion built on
    that mock can silently misclassify its inputs — a green suite proved nothing until the mock itself
    was fixed to match the real contract.


## Rules earned in the v85 line

41. **Before declaring a "needs a live model" item unreachable in a container, actually CHECK what is
    installed** (`v85_t`/`v85_u`). `curl localhost:11434/api/tags` cost one call and turned a would-be
    "owed by the user" item into a real, cited, live-probed measurement (`qwen2.5vl:7b` was already
    there). A "not doable in a container" list written by an earlier session can go stale exactly like
    any other claim in these documents — don't inherit it without checking.
42. **A rigorously measured finding for ONE contributing factor is not proof there is only one**
    (`v85_u`). The `v85_t` live probe measured a real model-accuracy limitation with real numbers —
    correct, and still true. The user's own next-session follow-up report ("when I zoom...") revealed
    a SECOND, fully-code-fixable bug (a canvas/image resize desync) that was very likely compounding
    on top of it, probably dominating what the original screenshot actually showed. Measuring one
    factor well is not the same claim as measuring the whole picture.
43. **Check whether an EXISTING ruling already answers what looks like a new design question — grep
    the roadmap before deciding fresh** (`v85_u`). "Move comic images out of `lessons.json`" was not a
    new problem needing a new decision; it was `D4` (a `v80`-era ruling) that a LATER feature
    (`v85_j`-`v85_p`) simply never implemented. The fix was "do what was already decided," and finding
    that took one grep, not a design session.
44. **Check whether server-side (or otherwise existing) plumbing already covers a requested
    client-facing feature before estimating its size** (`v85_u`). A "add a model picker for comic
    parsing" ask looked like a multi-layer feature; `/api/models` already accepted the exact field
    needed, unused by any client control. The real gap was one line in a `roles` array plus a
    genuinely new capability-filter concept — always check both sides before sizing a request.
45. **A "redacted equivalent" probe input (a crop of a screenshot, not the pristine original) is still
    a legitimate measurement — but the substitution must be stated as an explicit caveat next to the
    result, with reasoning about which direction it could bias the finding** (`v85_t`). The crop used
    still carried a prior (bad) detection's own overlay lines; reasoned explicitly that this should
    make the model's job EASIER, not harder, so a worse-than-expected result was not explained away by
    it.
46. **A hit-tested UI affordance (drag handles, click targets) that can overlap an EXISTING interaction
    on the same surface needs an EXPLICIT precedence rule, checked first, by construction** (`v85_t`).
    Panel-resize handles are checked BEFORE falling through to "start a new box draw" in the same
    pointerdown handler — not via a separate mode flag a caller could forget to set.

## Rules earned in the v86 line

47. **A worked example that contradicts its own instruction can recur MULTIPLE times, across the
    SAME prompt and across DIFFERENT prompts** (`v86_aa`/`v86_ab`/`v86_af`) — check every worked
    example's own internal consistency against the rule it demonstrates whenever a language- or
    category-compliance bug is suspected. This exact bug class hit `_comicExtractPrompt` (an earlier
    line), then `canonical-analysis.js`'s CP2 prompt, then `PROMPTS.inflections` TWICE in this one
    line (a language fix, then a distractor-dimension fix) — a worked example is not "just an
    illustration," it is read by the model as evidence of what compliance looks like.
48. **A component CLAIMING to satisfy a request is not proof it actually does** (`v86_ae`) —
    `_ttsMakeUtterance`'s own "refuse rather than approximate" policy only catches the case where
    NOTHING claims to match a requested language; a voice (or any resource) that claims compliance
    but delivers poorly cannot be caught by a pure existence check. The same shape likely recurs
    anywhere a component self-reports capability.
49. **Two independently live-tested reinforcement attempts for the SAME underlying prompt pattern,
    both measuring zero effect, is a strong signal to reconsider the DIAGNOSIS, not the wording**
    (`v86_ab`'s `{S}`-language fix, item AJ; `v86_ag`'s combined-dimension example, item P) — a third
    guess without a product/pedagogy decision first is not recommended; the pattern itself is the
    finding.
50. **A distractor/category referencing something that DOES NOT EXIST AT ALL for a word class in a
    language is a different, worse bug than one referencing something that exists but is merely a
    different (still valid) dimension** (`v86_ag`) — conflating the two (generalizing a fix from
    "Dutch nouns have no case" to "verbs must never see a mood-category distractor") produced an
    over-strict rule for a case the original report never actually covered. Re-examine the ORIGINAL
    report's own specifics before generalizing a fix's scope to a broader class.
51. **`prompts.json` and `ui.json` HOT-RELOAD via `fs.watch`** (`v86_ad`/`v86_af`) — a running server
    picks up an edit within ~100ms, no restart needed. Checked directly this line after nearly
    attributing a live-test failure to a stale server; don't assume "the server needs a restart"
    without first checking whether the file in question is on that reload list.
52. **A user's own vocabulary for "the X card/screen" can refer to MULTIPLE distinct UI surfaces in
    the same app** (`v86_ad`) — took three rounds of clarification (a library-list row → the
    completion card → the actual target, a THIRD surface) to find the real one. Verify which ONE by
    reading the actual markup/gating, don't guess from a plausible function name — and REVERT any
    speculative fix built on a wrong guess before shipping, rather than keeping it "as a bonus."
53. **Running the FULL and `--quick` test suites CONCURRENTLY on the same box can produce a spurious
    contention failure in an otherwise rock-solid, unrelated test** (`v86_ae`) — re-run the ONE
    affected test standalone before treating a suite-only failure as real; prefer running the two
    suites sequentially when verifying a release.
54. **A live browser/API click-through against a REAL model, when one is actually reachable, is
    worth doing even after unit tests already pass** (`v86_ad`) — it surfaced an infrastructure-level
    mistake (an earlier cut's own wrong "no backend reachable in this sandbox" claim) that unit
    coverage alone could not have caught, since the units mock the backend by design.

(If you add a new standing rule, append it here so the next session inherits it.)

---


---


# ✅ SHIPPED IN THE v88 LINE

## ✅ v88_ag — QC runs as a listed, cancellable job (the report `v88_af` answered in the wrong place)

**User report**: *"translation job is not listed in the job popover (and ideally should be
cancel-able)"*, then, while `v88_af` was being written: *"above message was potentially wrong, i had
click a QC, not the translation button."* **ZERO `ui.json` keys.**

⚠️ **`v88_af` is kept, and is not wasted work — but it was the wrong bug.** The translation defect it
fixed is real and was measured before it was fixed (`triggerUITranslation` was genuinely the one
translation caller `_jobsTracked` had never been applied to, and its route registered no job). It
simply was not what the user hit. Recorded plainly rather than quietly folded in: the investigation
was right about the mechanism and wrong about the trigger, and the correction came from the user,
not from the tests.

### THREE QC entry points, and only ONE of them was a job

`/api/qc` (the lesson QC sweep) has always registered `newJob`. **`/api/story-qc` and
`/api/summary-qc` both AWAITED the proofread and answered only when it finished, registering
nothing** — and neither `runStoryQc()` nor `runSummaryQc()` was `_jobsTracked` either. So clicking
🔍 on a story ran a full-story model call with **no row anywhere in the popover**. Exactly the
report.

**Both are converted**, not only the one that was clicked — the same "where else is this question
asked?" that `v88_s` earned. They are the same control in two places, and fixing one would have left
the other waiting for the next report.

Real jobs rather than `_jobsTracked` sync rows, for the reason established at `v88_af`: a sync row
cannot carry a cancel button, because `_jobsRenderList`'s `canCancel` needs a server-side job id for
`POST /api/jobs/cancel`. Each route now answers **202 + `{jobId}`**, runs under `runCancellable`,
and hands the **unchanged payload** through `jobDone` — the client reads exactly the same fields, they
just arrive as the job's `data`. Labels are load-bearing: `/api/jobs` skips any job without one.

### ⚠️ The fix introduced a HANG, and the suite caught it the hard way

`runStoryQc`/`runSummaryQc` share ONE poller (`_qcPoll`) so the two cannot drift the way the three QC
entry points already had. Its first version continued polling on **any** status it did not
recognise — and `unit-lesson-set-story-explorer`'s stubbed fetch answers with a QC payload carrying
no `status` at all. The result was not a failing assertion: the file printed **ALL PASSED and then
never exited**, re-arming a 2s timer forever, and the whole suite stalled behind it. `v88_r`'s rule
in its clearest form — *a non-zero exit, or a process that will not die, is a FINDING*.

Fixed at the source: only `running`/`pending` continue; anything else is terminal. ⚠️ **And the fix
was briefly UNGUARDED** — updating that test's stub to speak the new protocol removed the only thing
exercising the path, so a mutation of the guard stayed green. The claim moved to
`unit-jobs-sync-inflight`, where it is asserted directly on the poller's own registry and the button
it restores.

### The cancel path had to be asserted separately

A cancelled QC must hand the button back (a control stuck on ⏳ makes the user's own deliberate act
look like a wedged app, with nothing to click to recover), must render no proposal, and must be
**silent** — toasting "⚠ QC failed" would report a deliberate cancel as an error, the same
distinction `jobFailOrCancel` draws server-side. Each of those is its own assertion; a mutation
removing the button restore stayed green until they existed.

### ⚠️ `v88_m`'s set-level guard fired — correctly — and got STRONGER for it

`e2e-job-cancel`'s "every LABELLED job runs inside `runCancellable`" section went red on the two new
QC jobs. They ARE wrapped: the guard required the **literal** `runCancellable(jobId`, so it was
really asserting *"wrapped AND the variable is spelled `jobId`"*, and these two live in one scope so
they are `_qcJobId`/`_sqJobId`. The lazy fix is to rename the variables to satisfy the matcher. The
guard now derives each job's OWN variable from its `newJob` assignment and demands **that** id be the
one wrapped — **strictly stronger than before**, since a body that wrapped some other job's id used
to pass and no longer does. Exactly the value `v88_b` claimed for set-level guards: it found the
call sites a reading would have missed, and it was right both times.

**Eight mutations red**: story QC registered without a label (the reported bug restored);
`runCancellable` removed from story QC; summary QC left unconverted; the poller re-arming on an
unrecognised status (the hang); the cancel path not restoring the button; the cancel path toasting
an error; a genuinely unwrapped labelled job (the strengthened guard's old half); and a body wrapping
the WRONG job id (its new half).

`e2e-qc-job.test.js` also pins that a cancelled proofread leaves **no proposal behind** — the user
stopped it precisely because they did not want its answer — and that a completed job still persists
the proposal server-side, which is what survives a client refresh.

## ✅ v88_af — the ui.json translation is a real job: listed, cancellable, and it keeps what it finished

**User report**: *"translation job is not listed in the job popover (and ideally should be
cancel-able)."* **ZERO `ui.json` keys.**

### "Not listed" understated it — it was invisible in every channel at once

There are THREE translation triggers in the client. `retranslateStory()` and `retranslateChain()`
were both wrapped in `_jobsTracked` at `v88_b`, so they show as `sync` rows — verified live in the
browser before touching anything, by starting a tracked call and watching the row and the badge
appear. `triggerUITranslation()` is the third, and it was **the one caller `_jobsTracked` was never
applied to**; the route it calls registered no server job either. So it appeared NOWHERE: not in
`jobs`, not as a sync row, nothing but a small inline "⏳ Translating…" in the settings row.

⚠️ **And it is one of the longest LLM operations in the app**: `translateUIToLang` batches 40 keys
per model call, so 755 `en` keys is **~19 sequential calls per language** — for a user who is
translating `ui.json` by hand across 33 languages, the single operation most worth being able to
watch and stop.

### A real JOB, not a `_jobsTracked` sync row — deliberately

A sync row **cannot** carry a cancel button: `_jobsRenderList`'s `canCancel` is
`j.kind === 'job' && …`, because `POST /api/jobs/cancel` needs a server-side job id to look up. That
is the diagnosis standing under the open "some LLM jobs have no cancel button" item. Wrapping the
client call would have fixed the listing and left the cancel impossible. So the route now answers
**202 + `{jobId}`** and runs under `newJob` + `runCancellable`, which buys the listing AND the cancel
from machinery that already exists — and is the pattern the remaining sync routes can follow.

⚠️ The label is not cosmetic: `/api/jobs` **skips any job without one** (`if (!j.label) continue`,
for labelless per-chapter sub-jobs), so an unlabelled registration would have left it exactly as
invisible as before. Asserted.

### ⚠️ Two defects this project has already paid for, both present in that loop

Neither was in the report; both were found by reading the function the fix had to touch.

1. **`v88_z`'s exact shape.** The per-batch `try { … } catch { }` swallows `CANCELLED` like any
   other failure, so a cancelled job would run **every remaining batch to the end and report DONE**.
   Being inside a cancel scope is necessary and NOT sufficient. Re-thrown.
2. **`v88_x`'s rule, in a second long loop.** `saveUI` ran **once, after the whole loop**, so a run
   that was cancelled, timed out, or died with the server persisted **nothing** — nineteen model
   calls' worth of work discarded, with nothing to resume from. It now checkpoints after every
   batch. Since the function already skips keys that exist, the checkpoint is also what makes a
   re-run cheap: it resumes exactly where the cancel stopped, which is what makes the button safe to
   press.

`translateUIToLang(lang, jobId)` takes the job id as OPTIONAL — `ensureUIForLang` still calls it
with none on a plain language switch, and that path is unchanged.

### The client polls instead of awaiting

`triggerUITranslation` reads `{jobId}` and polls `/api/job/:id`, same shape as
`_textExplorerCheckOnce` (module-level id so a superseded run cannot repaint over a newer one).
⚠️ **`cancelled` is handled as its own outcome, not as an error** — reporting the user's own
deliberate act as "Translation failed" is exactly what `jobFailOrCancel` exists to avoid on the
server side — and the strings are reloaded on that path too, because the completed batches really
are saved.

### The guard is deterministic, not a race

`e2e-ui-translate.test.js`, six checks. A 100-key fixture gives 3 batches (40/40/20), and the cancel
is driven by **observed progress** — poll until the job's own step reports `batch 2/3`, then cancel —
so nothing depends on machine speed. That makes three claims provable rather than probable: batch 1
is already on disk mid-run; after the cancel the count is **exactly** what batch 1 had persisted (a
swallowed `CANCELLED` would have produced all 100); and a re-run finishes the rest without
re-translating what survived. The fake gained a UI-translator branch that echoes each key with an
`XX ` marker, so a translated value cannot be confused with the English one it was given.

**Four mutations red**: the job registered without a label (the reported bug restored); the
per-batch catch swallowing `CANCELLED` again; the checkpoint moved back outside the loop; and
`runCancellable` removed.

## ✅ v88_ae — item AI's curator TABLE, and a rewrite no longer orphans corrections silently

Both halves of one user message: *"do the curator table and show a warning upon story rewrite."*
**ONE new `ui.json` key**, `text_explorer.corrections_orphaned`, wording chosen by the user from
three options; everything else reuses existing strings (`text_explorer.lemma`/`form`/`sense` as
column headers, `text_explorer.unresolved` as the filter, `prov.save`, `dialog.cancel`,
`check.continue`, `toast.saved`), and the table's HEADER is the chapter's own name — data, not a UI
string, and more useful than a generic title.

### The user also closed `v88_ab`'s residue themselves

They deleted the two isolated "De Manteling" storylines. Measured at this cut: the surviving
chapter is `tp_17881715830570000091`, which is the one that extracted **correctly** — `caption` =
the sign's heading, `inScene` = its 310-character body, `description` empty — inside the
"Wald und Wildnis" storyline. So the combine rule has nothing left to add there and **nothing is
owed on that item.**

⚠️ **And it confirmed `v88_ac` in real use**: the analysis store went 15 → 14 entries with **zero
orphans**, so the chapter delete pruned its analysis exactly as intended, on the user's own data.

### The rewrite warning — and the bug the test found in it

A correction is keyed on the SENTENCE TEXT, so rewriting a sentence stops its corrections applying.
Deliberate, and now no longer silent: a dry-run route (`POST /api/analysis-correction-impact/:id`)
runs CP1 on the CANDIDATE story and reports how many currently-applying corrections would lose their
sentence. The story editor asks before committing and offers Cancel / Continue.

⚠️ **The first version of that route was wrong, and the e2e caught it.** It ran
`partitionCorrections` — the TOKEN-level question — over CP1 output. But CP1's tokens carry `text`
and are split naively (`"lauft."` keeps its period), while CP2's carry `surface`; the token
partition therefore matched nothing and reported **every** correction as doomed. A candidate story
has never been through CP2, so the token question cannot be asked of it at all. The honest question
is SENTENCE-level — *will this correction still have a sentence to attach to* — and it now has its
own function (`partitionCorrectionsBySentence`) with the distinction written down, because the two
partitions look interchangeable and are not.

⚠️ **The e2e also corrected the LIFECYCLE this release assumed.** Saving a story does not re-run
CP2: the cached analysis is marked stale and keeps its old sentences, so immediately after a rewrite
the correction *still applies* to what the explorer is still showing. Orphaning becomes real at the
RE-ANALYSIS. The test now asserts that whole sequence, and the warning's wording is future tense
("will stop applying") for exactly this reason.

Deliberate properties: the check **fails open** (a check that cannot run must not stand between a
curator and a story repair), it charges only against corrections that currently APPLY (otherwise it
cries wolf on every subsequent save), and it returns immediately for the overwhelmingly common case
of a chapter with no corrections at all. The client asks the SERVER rather than testing
`newStory.includes(sentenceText)` — containment is a PROXY for "is still a sentence", and proxy
guards are how `v87_i` and `v88_w` both shipped broken.

### The curator table

`_teOpenCuratorTable(chapterId)` — one editable row per token, grouped in sentence order, with a
filter that narrows to the unresolved. Modal shape and attribute-wired handlers are
`comicOpenReview`'s, deliberately: edits live in a LOCAL buffer so Cancel is a true no-op, and every
handler is a plain callable function rather than a closure only a real click can reach. The
worklist bar gained a second button (`▤`) beside the jump — the user's own reasoning for "popover
first, table after" was that walking a word IN CONTEXT and working through many at once are
different jobs, so neither replaces the other.

⚠️ **The table sends only the rows that CHANGED.** Saving all of them would turn every
model-produced value into a "curator correction", mark the whole chapter reviewed, and pin it
against future prompt improvements — quietly defeating the point of an overlay. Editing a value and
putting it back counts as unchanged.

### Orphans are listed, never deleted

The user's ruling. `analysisShadowFor` now reports `correctionCount` as what actually APPLIES (so it
never overstates the curation a reader is seeing) plus `orphanedCorrections` in full, and the table
lists them in their own block, always visible — **exempt from the "only unresolved" filter**,
because an orphan is the one row kind that cannot be found any other way, and a chapter whose tokens
are all resolved is exactly when it would otherwise never be seen. The worklist bar therefore
appears for orphans alone. Clearing all three fields deletes a correction, which is how an orphan is
dropped once a curator decides it is stale.

**Ten mutations red**: the partition calling everything applied; the sentence partition ignoring the
sentence text; the dry run asking the token question of CP1 output (the real bug, pinned so it
cannot return); `wouldOrphan` charged against all corrections rather than the applying ones; the
table saving every row; the filter hiding orphans; the table dropping orphan rows; the warning never
blocking; the warning firing when nothing is at risk; and the bar ignoring orphans.

### Also fixed while writing the tests

Two of this file's own e2e sections were loose. §12's correction is keyed to a hand-typed sentence
text that matches no real sentence — so it was stored but ORPHANED from the start, which §13 then
tripped over. It is kept (the delete claim it makes holds either way) and now says so, and §13
measures a DELTA rather than an absolute so the two stay independent. §14 originally picked
`tp_ana3`, which §9 deletes: in an ordered e2e a late section cannot choose a fixture freely.

## ✅ v88_ad — item AI, first cut: a curator can correct CP2's analysis, and the correction sticks

**Closes the open design question item `AI` has carried since `v86_s`.** User request at the
`v88_ac` cut: *"perhaps we need a review/edit interface for text analysis entries."* **ZERO
`ui.json` keys** — the editor reuses `text_explorer.lemma`/`form`/`sense`, `prov.save` and
`dialog.cancel`, and the worklist bar is a count composed with the existing
`text_explorer.unresolved`. The user's standing budget was "tell me each key before adding it";
nothing had to be asked for.

### The measurement that made the case

`canonical-analysis.js` writes **`reviewed: false`** onto every token it emits, at three separate
sites — and **nothing has ever set it or read it**: 533 of 533 tokens in the live store sat at the
default. The schema slot for this feature has existed since the beginning; the feature never got
built. And there is real work for it: **63 of 483 tokens (13%) are `unresolved` with no lemma at
all**, and 2 of 44 sentences carry not one resolved lemma — the same defect `v88_x` measured at
5.9%. (Also noted: `confidence` is only ever `high` or `unresolved` in practice. The `.te-tok-low`
styling has never matched a real token.)

### The three rulings

1. **Sticky overlay.** Corrections live in their own store and are re-applied after every
   re-analysis. Ruled over "locked tokens" and "wiped but warned".
2. **The editor is the existing token popover** — `_teShowWordPopover`, until now explicitly "a
   read-only info card".
3. **The first cut targets the unresolved tokens**, as a worklist.

### ⚠️ The key is NOT `tokenId`, and that is the load-bearing decision

The obvious key is the token's own id. It is wrong: `tokenId` is `chapterId:sN:tM`, a pure INDEX
into the current segmentation. A story edit that inserts a sentence renumbers every sentence after
it. A correction keyed that way would silently **re-attach to a different word** — worse than being
lost, because the curator would never know. The key is instead **(sentence TEXT, token SURFACE,
which occurrence of that surface in that sentence)**, which is `v88_x`'s own precedent (its resume
matched on sentence text, for these reasons, and was verified live).

### Where the merge lives, and the second surface that nearly got missed

Applied on **read**, in `analysisShadowFor` — not baked into the stored record. A correction made
after the last analysis must show immediately, and `canonical-analysis.json` stays honestly the
model's own output. That one function is the whole live read path (the GET route, the analyse
route's short-circuit, `_kickOffAnalysisJob`).

⚠️ **But `build-static.js` does not go through it.** It reads `canonical-analysis.json` DIRECTLY to
bake `STATIC_ANALYSIS_DATA`, which makes it a SECOND surface over the same cache — and in this
project a second surface that re-implements a shared read has twice shipped missing what the shared
path grew (`v87_k`'s lesson-set reader missed four features; `v88_w`'s static landing card missed
`thumbMode`). Without the same merge there, **every correction would be silently absent from
`docs/`** — the build students actually read, and the one nobody would think to check. Caught before
any code was written, by asking who else reads the analysis. Both callers now share ONE merge
function, which is why it lives in its own module (`analysis-corrections.js`) rather than in
`server.js`: `build-static.js` cannot require the server, and `canonical-analysis.js` drags in
`llm.js`. `analysis-corrections.json` was added to `BUILD_SOURCES` too, or a corrected chapter would
ship stale from `docs/` with nothing saying so.

### The asymmetry that IS the feature

- **Re-analysing a chapter KEEPS its corrections.** `deleteAnalysisChapter` (the `force` path) drops
  the whole model record and CP2 rewrites every token; the overlay is untouched and re-applies. This
  is the ruling, and it is asserted end to end against a real server that really re-runs the model.
- **Deleting the CHAPTER takes them.** ⚠️ `v88_ac` had just fixed exactly this leak for
  `canonical-analysis.json` (5 of 20 entries were orphans of deleted chapters); a second per-chapter
  store added without the same cleanup would have reintroduced it on day one.

### Client

`_teShowWordPopover` becomes an editor: three inputs prefilled with the model's own values (a
curator corrects an analysis, they do not write one from scratch), Save, Cancel. Clearing all three
fields removes the correction and the model's own analysis shows through again — expressed as
clearing rather than a second verb, because that is what a curator does in the editor.

⚠️ **The popover dismissed itself on the next document click**, which — the moment it gained inputs
— would have closed the editor as soon as a curator clicked into a field. Fixed with the same
attribute-level `stopPropagation` the token mark already used. And the popover is now tracked **by
reference** rather than looked up by id, following `_comicReviewOverlayEl`'s precedent: an id lookup
for a dynamically-created node is exactly what the DOM harness cannot answer (it auto-vivifies a
fresh div on a miss, so the lookup returns the WRONG element and every assertion fails on a correct
tree — which is precisely what happened while writing the test).

Editing is **live-build only** (`typeof STATIC_LESSONS === 'undefined'`): the published build has no
server to save to and a baked snapshot, so an edit there would appear to work and survive nothing.
Deliberately NOT gated on `teacherMode` or `canGenerate` — a correction needs no model, so it is the
one analysis action that still works with Ollama switched off.

### ⚠️ Two fixtures that could not tell right from wrong, both found by mutation

- **The occurrence index was untested twice over.** Both the module's fixture and the client's used
  `"Een … een"` — and the capitalised one is a DIFFERENT surface, so every token was occurrence 0 of
  its own surface. A mutation hardcoding `occ = 0` stayed GREEN on both. Both fixtures now repeat a
  surface identically-cased, and both directions are asserted (occurrence 0 hits ONLY index 0,
  occurrence 1 ONLY index 3) — either alone is satisfied by a merge that ignores the index.
- **A comment claimed a protection that cannot exist.** The renderer counted occurrences before its
  two skip-checks, commented as guarding against divergence from the server. The mutant moving it
  after stayed green, and working out why showed the two are *provably* equivalent: a token skipped
  for failing to align can never be followed by a same-surface token that aligns, since the cursor
  only moves forward. The ordering is kept (it mirrors the server's loop literally) but the comment
  now says it is not load-bearing — `v87_p`'s ruling. The claim that IS real moved to a **cross-layer**
  guard: the attributes the real renderer emits are fed into the real server-side merge, and the
  token it resolves is asserted. Neither side's own tests could catch that disagreement; each is
  self-consistent.

**Fifteen mutations red**, including: the old fallback key without occurrence, a merge that mutates
its input, a blank field blanking the model's value, `confidence` left unresolved, `saveCorrection`
appending instead of upserting, the save baking into `canonical-analysis.json` (edit-in-place rather
than an overlay), `analysisShadowFor` not merging, the chapter delete not pruning, **the force path
dropping corrections (the ruling itself)**, `build-static.js` not applying them, the client not
stamping the key, the popover losing its `stopPropagation`, and editing offered in the static build.

### Not in this cut

The per-chapter curator TABLE (the user chose "popover first"), and `reviewed` as a per-sentence or
per-chapter state — it is per-token, which is what the schema already had.

## ✅ v88_ac — deleting a chapter no longer leaks its analysis, and 5 orphans are gone

**Not a user report — found by answering a user QUESTION.** They asked what was dirty in
`canonical-analysis.json` and said "let's clean it up". The dirty diff turned out to be nothing:
one complete, correctly-formed entry their own server had written for `tp_17883793024690000067`,
plus the `chapterCount` 19→20 and `generatedAt` bump. **But auditing the file to answer the question
found a real leak.** ZERO `ui.json` keys.

### The leak

`DELETE /api/lessons/delete` cleans up every per-chapter artefact — the topic itself, storyline
membership, the `continuedFromId` chain (with the fork-collapse merge), and every flag by slug and
by id — **except the CP1/CP2 analysis**. So each deleted chapter left its whole token analysis
behind in `canonical-analysis.json`, permanently.

It is invisible in normal use, which is why it survived: nothing in the UI can address an id that no
longer exists, and the file is only ever appended to, so the store grows and nothing ever reads the
dead entries. Measured in the working tree at the `v88_ab` cut: **5 of 20 entries orphaned, 12% of
the analysis bytes**, the oldest 5 days old.

| orphan | size | analysed |
|---|---|---|
| `tp_17880322416810000009` | 5.8 KB | 2026-08-29 |
| `tp_17881986169040000025` | 6.9 KB | 2026-08-31 |
| `tp_17882063882590000007` | 1.1 KB | 2026-09-01 |
| `tp_17883419204170000088` | 1.1 KB | 2026-09-02 |
| `tp_17883426979990000196` | 1.1 KB | 2026-09-02 |

Two of those are chapters this line's own write-ups name: `tp_17882063882590000007` is item AN's
reported chapter, and `tp_17883426979990000196` is one of the two "De Manteling" chapters measured
for `v88_ab` — the user deleted it between the two cuts, which is also what moved the topic count
345→344.

### The fix is one call, and the SHAPE of it is the part worth defending

`deleteAnalysisChapter(chapterId)` has existed since `v86_ac` for the "force re-analyse" path. The
gap was only that the delete route never called it. It now does, targeted at the one id being
deleted.

⚠️ **Deliberately NOT a sweep.** The tempting implementation is "on load, drop every entry with no
matching chapter" — it would have cleaned the 5 orphans in one line and is one partial or failed
read of `lessons.json` away from **deleting every analysis on the box**. The e2e asserts against
that directly: an unrelated chapter's entry must be untouched by the delete, which the sweep version
fails. Both mutations red — the leak restored, and the sweep substituted.

### The one-time prune

The 5 existing orphans were removed by mirroring exactly what `deleteAnalysisChapter` writes
(`schemaVersion`, re-derived `chapterCount`, fresh `generatedAt`, `JSON.stringify(store, null, 2)`
with no trailing newline — verified byte-identical to the on-disk convention first, so the cleanup
does not show up as a whole-file reformat). 20 → 15 entries, 245.2 → 217.1 KB, zero orphans.
Verified against the user's own RUNNING server afterwards: a surviving chapter's analysis still
resolves with `available:true`, and a pruned id degrades to `available:false` rather than erroring —
the absent case the route was already written to treat as normal.

### ⚠️ Found while auditing, NOT fixed here — the `reviewed` flag has never been read

`canonical-analysis.js` writes `reviewed: false` onto every token it emits, at three separate sites.
**Nothing anywhere sets it true, and nothing reads it** — 533 of 533 tokens in the store carry the
default. It is a schema placeholder for **item AI** (teacher-editable CP1/CP2 analysis), which is
scoped but not started and carries one open design question: *does a curator's correction survive a
re-analysis?* Today it cannot — `deleteAnalysisChapter` drops the whole chapter entry and CP2
rewrites it from scratch, so any edit is lost on the next re-run. **Put to the user at this cut; not
started.**

## ✅ v88_ab — an image description is no longer suppressed by a headline, and the story rule has one home

**Closes open item 3** (*"an image DESCRIPTION becomes unreachable once the panel has any extracted
text"*), the last of the three items carried into this session needing a ruling. **ZERO `ui.json`
keys** — the review card's four labels (`form.image_title_ph`, `form.image_caption_ph`,
`form.image_scene_ph`, `form.image_description_lbl`) were all worded neutrally by `v88_y` and none
of them encoded the fallback semantics, so the ruling change needed no new string and no re-wording
of an existing one. The user's budget this session was "tell me each key before adding it"; nothing
had to be asked for.

### The measurement came first, and it sharpened the question the previous cut had framed

`v88_aa` handed this over with one example. Measured across the whole store before proposing
anything:

| | count |
|---|---|
| chapters carrying `comicPanels` | 18 (**every one of them single-panel**) |
| panels with any `description` at all | 3 |
| → description SUPPRESSED by extracted text | **2** |
| → description used as the story (the `v87_l` fallback firing) | 1 |
| panels with BOTH `caption` and `inScene` | 6 |
| panels with a stored `panel.title` | **0 of 18** |

The two suppressed panels are `tp_17883458445860000053` (caption 12 chars, description 128) and
`tp_17883426979990000196` (12 / 159) — extracted/description length ratios of **0.09 and 0.08**, so
the suppressed side was never the close call the old ruling implicitly assumed. ⚠️ **And they are
not user error.** A third chapter from the same photographed sign, `tp_17881715830570000091`, shows
what a COMPLETE extraction of it looks like: `caption` = the sign's heading *"De Manteling"*,
`inScene` = the sign's body paragraph. The two broken chapters are the same sign with the body
simply not extracted — so the failure mode is a PARTIAL EXTRACTION, not a mislabelled field, and
`v88_y`'s field-confusion fix (correct in itself) could never have reached it.

### The user's four rulings, asked with that measurement in hand

1. **Combine.** The chapter story is extracted text **AND** description, both, always — not a length
   threshold, not a separate block, not "keep it and expose it". This REPLACES the `v87_l` ruling
   (*"the description is a fallback when nothing was extracted"*) rather than refining it.
2. **`caption` / `inScene` stay as they are** — two extraction fields, ONE rendered block. The split
   is an extraction-time concept and the user chose to keep it that way.
3. **`panel.title` stays write-only.** It names the chapter at creation and sets `topicAuto:false`;
   that is a real job, done. Notably it has never once been stored (0 of 18) — it postdates `v88_d`
   and `v88_y` only just made its field legible.
4. Keys: propose each one first. None were needed.

### One rule, one home

The combine is a two-line change. What took the work is that **the rule had three copies**, which is
exactly how `v88_e`/item AY happened (the renderer's copy had never learned that `description`
counts, so a description-only chapter rendered as images with no text). All three now delegate to a
new `_comicTextFromFields(fields)`:

- `_comicPanelText(b)` — the wizard's in-flight panel, fields under `b.text`. Now a one-line wrapper.
- `_comicPanelsHaveText(d)` — the render GATE, reading a saved chapter's flat `comicPanels[i]`.
- `_comicStoryPanelsHtml(d, o)` — the per-panel renderer, same flat shape.

Separator: extracted and description are joined with a **blank line**, because `_storyParasHtml`
splits on `/\n\n+/` — that is what makes them the two `<p>` blocks the ruling asked for. `caption`
and `inScene` keep their SINGLE newline, which is ruling 2 expressed in the same function. Order is
extracted-first, which also keeps `comicCreateChapter`'s title placeholder (`text.slice(0,40)`)
reading the lettering rather than a generated scene description.

### ⚠️ The ruling opened a THIRD way for the two copies of the text to disagree

A comic chapter stores its text twice — `story`, and `comicPanels[i]` extracted at upload time.
Keeping those agreeing has already cost two releases from opposite directions: `v86_g` (a story edit
left the panel copy stale forever, so the progress card alone kept showing the reported typo) and
`v88_e` (the panel copy's rule had never learned about `description`). Combining adds a third input,
and with it two new divergences that the tests would NOT have caught:

1. **Legacy chapters.** An existing chapter's `story` was built under the OLD rule. Re-deriving it
   under the new one would show the description on the highlighted story panel while the translation
   view, the text explorer and every lesson — all of which read `story` — would not. **That is item
   AY's asymmetry exactly, in a new shape**, and it would have landed on the two chapters the user
   actually reported.
2. **A story EDIT.** `/api/save-story` collapses an edited story into `caption` and clears
   `inScene`, its own comment justifying this as *"so the renderer's own join reproduces `story`
   exactly"*. Under the combine rule that join would append `description` a SECOND time — the
   description duplicated on screen, caused by the very sync written to keep the two in step.

Both are fixed by one change, not two: **`_comicStoryPanelsHtml` reads `d.story` directly for the
unambiguous single-panel case** and only derives per panel when there is more than one. Measured
justification: for all 18 chapters carrying panels the old derivation reproduced `story`
character-for-character, the sole exception being a panel with no text at all — which never reaches
this renderer because `_comicPanelsHaveText` gates it to the flat path. **So it is a no-op on every
chapter that exists today**; what it buys is that no future one can drift. Multi-panel keeps
deriving, for the same reason `v86_g` scoped its sync to one panel: a flat story string cannot be
split back across panels.

⚠️ **`v86_g`'s sync is therefore no longer the protection** — `v87_p`'s ruling applied verbatim: the
sync is KEPT (the stored fields should still describe the chapter honestly), both its sites say in
their comments that they are an optimisation now rather than the guarantee, and the guarantee is
pinned where it is observable. The sync deliberately does **not** delete `description`: this project
has lost a user's generated description once already (item AN), and it does not need to, because
nothing re-derives on that path any more.

### Three guards were asserting the wrong thing, and one of them twice over

- `unit-comic-extraction` §6c asserted `both === 'Cap\nScene'` under the message *"extracted
  lettering WINS — the description is never appended to real text"*. Not failing — **asserting the
  superseded ruling**. Re-scoped to the opposite claim (`v88_s`'s rule again), with the reported
  12-vs-128 shape as its own case.
- `unit-comic-story-text` §4's fixture spread a chapter whose `story` and whose panel copy
  **disagreed** — a state measured never to occur. It passed only because the renderer ignored
  `story`. Split into the realistic single-panel shape, a multi-panel case that pins the shared rule,
  the combine end to end, and the story-edit divergence.
- `e2e-save-story-comic-sync` re-implemented the renderer's join INLINE and claimed the result was
  *"the renderer's own join"* — **a claim about a function that file never calls**, which this cut
  made false in two ways at once. A guard that pins a re-implementation cannot fail when the real
  renderer changes. Re-scoped to what it can honestly observe (the stored fields), with the screen
  pinned in `unit-comic-story-text`, plus a new fixture carrying a `description` so the sync's
  interaction with the new rule is covered at all — the three existing fixtures all predate the
  field and none of them had one.

### ⚠️ A non-vacuity assertion that could NEVER fire, caught by mutation-testing

The first draft of the description-only section asserted `comic-story-panel-text` to claim it had
reached the per-panel pairing rather than the flat fallback. Mutating `_comicPanelsHaveText` to
ignore `description` left it **GREEN**: for ONE panel, `_comicPanelsFlatTextHtml` emits the
*identical* wrapper markup, and with `story === description` the visible text is identical too — the
two paths are indistinguishable in that fixture, in both markup and text. A proxy marker again
(`v88_w`'s rule). The gate's claim moved to a MULTI-panel, description-only fixture, where the two
paths genuinely differ, and the single-panel section now RECORDS that it cannot carry that claim
rather than pretending to.

A second self-inflicted one is worth recording because it went red on a CORRECT tree: the new
static-build guard's non-vacuity check used `!html.includes('STATIC_LESSONS =')` to prove the two
files differ — but `index.html` mentions `STATIC_LESSONS` a dozen times, in
`typeof STATIC_LESSONS !== 'undefined'` guards. The discriminator has to be something the BUILD
produces, not something the build merely reads: only `docs/index.html` DECLARES it, and only
`index.html` still carries `@static-exclude-start`.

### Also fixed: two comments making false claims about the code around them

Rule 35, both found while editing rather than reported:

- The review card said `caption` and `inScene` *"stay separate because `_comicStoryPanelsHtml`
  renders them separately"*. **That renderer has always joined them.** The sentence was the stated
  justification for keeping two fields, so it is corrected in place with the user's ruling recorded
  next to it — the real reason they stay separate is that the extraction prompt produces them
  separately and the review card is where a mis-assignment gets corrected.
- `_comicPanelText`'s own header still quoted the `v87_l` fallback ruling as current. The superseded
  ruling is now quoted AS superseded, with the measurement that replaced it.

### Guard for the published build

`_comicTextFromFields` is a new client helper added near the comic wizard — the exact accident
`v88_r` found, where `_backToChapterProgress` sat inside the `@static-exclude` region and was a
`ReferenceError` in `docs/index.html` for four releases while every guard read the source file.
`unit-comic-extraction` §6d asserts the built file DEFINES all three functions and carries **no
surviving copy** of the `v87_l` expression (an absence over the whole file, `v88_s`'s rule).

**Ten mutations red**: the old fallback rule restored; a single-newline separator; description-first
ordering; `caption`/`inScene` split into two blocks; the renderer re-deriving instead of reading
`d.story`; the gate ignoring `description`; the renderer ignoring `description` on the multi-panel
path; the server sync deleting `description`; and two on the published build (the helper renamed
away, and the old expression left in place).

### ⚠️ What this does NOT do — the two reported chapters keep their current story

The change is to how a chapter's text is FORMED and RENDERED, not a rewrite of stored data.
`tp_17883458445860000053` and `tp_17883426979990000196` still have `story: "De Manteling"`, and the
renderer still shows exactly that, because the single-panel path reads `story`. **This is deliberate
and is the honest scope of a behaviour ruling**: `schemaVersion` is a load-time shape adapter, not a
per-field migration hook, so applying the new rule retroactively would mean either inventing a
migration mechanism or silently rewriting the user's own chapter text on their running server.
Neither was asked for. Each is a ~10-second fix through the existing story-repair UI, and the
description is intact in `comicPanels[0].description` for both — **put to the user at the handover.**

## ✅ v88_aa — card 3's Generate generates, instead of bouncing back to the confirmation popover

**User report**: *"I remember for a recent image-based generation that card 3 actually led back to
card 2 or to the text confirmation popover and required to click generate there, instead of just
generating from card 3."* Correct, and it matches the code exactly. **ZERO `ui.json` keys.**

### ⚠️ I had called this BLOCKED on a user ruling. Checking the ruling's actual words proved me wrong

`doGenerate()`'s comic branch routed to `comicOpenReview()`, and the comment there justified it:
*"the user's own part-2 ruling was to KEEP the review stop, so the click must still land on it."*
Earlier this session I repeated that and told the user the item needed a fresh decision. It did not.
The ruling's real text (`roadmap_v87.md`):

> **"Keep the live review stop.** Extraction/chunking/panel editing stay live in **card 2**, exactly
> as today; only lesson-type selection and **THE FINAL 'GO' MOVE LATER."**

The "review stop" is card 2's panel editing — untouched by any of this. The final "go" was always
meant to be card 3's. **The bounce contradicted the ruling it cited**, and the user's request and the
standing ruling agreed all along. Rule 35 in its sharpest form: a comment citing a ruling is a claim
about that ruling, and this one had been carried, quoted and acted on for two releases.

### The change

- `doGenerate()`'s comic branch calls `comicCreateChapter()` directly. `comicCreateChapter` already
  carries its own "no extracted text yet" guard, so nothing was lost by removing the popover from
  the path.
- **Card 2 gains a "Review extracted text" button.** Card 3's Generate was doubling as the only way
  back into the review card for anyone who dismissed the auto-popup — removing that routing without
  replacing the affordance would have stranded a learner's extracted text behind a popup they closed
  once. Label reuses the EXISTING `form.image_review_title`; shown only once some panel actually has
  text (caption, in-scene **or** description), so it can never open the empty card
  `comicOpenReview()` itself only toasts about.
- The review card now has **one behaviour on both entries**: save the text, go to card 3. With the
  routing gone, `_comicReviewMode` had one reader and now has none, so it is deleted — and the
  confirm button carries ONE label, because a second one would be a promise it cannot keep.
  `form.image_review_confirm` is no longer referenced anywhere in the client.

### Four test files re-scoped, three of them to the OPPOSITE claim

`unit-gen-wizard` §12e asserted *"comic mode routes to `comicOpenReview()` and NOT to
`comicCreateChapter()` — the review stop is kept, by ruling"*. `unit-comic-review-autopath` §3
asserted a card opened from `#gen-btn` *"still POSTs exactly one /api/generate-book"* — as the
non-vacuity for its own "never generate" claim. `unit-comic-review-card` asserted *"confirm hands off
to the REAL `comicCreateChapter()`"*. All three pinned the bug, in the ruling's own name.

The non-vacuity §1/§2 needed did not disappear — it MOVED to where generation now lives
(`unit-gen-wizard` §12e: `#gen-btn` generates exactly once), and that is stated in the file so a
later reader knows the "never generates" claim is bounded rather than universal.
`unit-comic-title-field`'s four sections now perform confirm-then-`comicCreateChapter()` — the same
two acts in the same order, the way the UI now does them.

### ⚠️ A guard that stayed green, and the auto-vivify trap under it

Removing the new reopen button left everything green: nothing asserted it. Written first as a DOM
check (`tagName === 'BUTTON'`) it still could not fail — `lib-dom` auto-vivifies a plain div for any
id, and **measured, the PRE-EXISTING `comic-clear-btn` and `comic-generate-btn` report `DIV` too**.
Existence moved to the SOURCE layer (the markup, and its `onclick` wiring); the show/hide logic
stayed at the DOM layer, where it is genuinely observable because our own code writes it.

**Verified live** on the user's own running server, driving the reported flow: with a panel carrying
extracted text, pressing card 3's Generate gives `bouncedToPopover: 0, startedGeneration: 1`, and the
"Review extracted text" button renders visible.

**Guard**: `unit-gen-wizard` §12e (rewritten), `unit-comic-review-autopath` (§3 rewritten, §3b new,
§4 collapsed to one label), `unit-comic-review-card`, `unit-comic-title-field`. **NINE mutations
red** — the bounce restored, confirm generating again, confirm not routing to card 3, the reopen
button removed, always visible, never visible, description-only no longer counting, the button wired
to the wrong action, and the old create-chapter label returning.

## ✅ v88_z — cancelling a job actually stops it: SIX more swallowed cancels, found by a set-level guard

The `AU` residue the session prompt carried as *"one read each"* for `_runQc` and `_runRecreateJob`.
It was eight sites, not two. **ZERO `ui.json` keys.**

### The defect, one level below where `v88_k` fixed it

`runCancellable` makes the in-flight model call throw `CANCELLED`. A runner that loops over items and
wraps each in `try { … } catch { continue; }` catches that throw **like any other failure** — so the
loop runs to the end, every remaining item "failing" silently, and the job reports **DONE**. The user
presses cancel, the popover agrees, and the GPU keeps working: exactly the symptom `v88_k` shipped to
prevent, reintroduced one level lower.

Being inside a cancel scope is **necessary and not sufficient**, and nothing said so until now.

### ⚠️ THE SET-LEVEL GUARD FOUND FOUR TIMES WHAT THE READING DID

The prompt named two functions. Written as a sweep over *every* cancellable runner — `v88_b`'s rule,
"assert over the whole set, not the one you happened to change, and expect it to fail the first
time" — it named **eight**, of which **six were real**:

| where | what a cancel used to do |
|---|---|
| `_runQc`'s per-item `_check` | every remaining item "fails" silently; the run completes |
| `_runQc`'s story-QC catch | same, per topic |
| `_runRecreateJob`'s add-types loop | keeps generating every remaining lesson type |
| `generate`'s meta/title call | falls back to a placeholder title and **generates the whole chapter anyway** |
| `generate`'s meta-translation call | continues with the untranslated title |
| `generate`'s story-translation call | records "translation failed", continues |
| `generate`'s extra-lesson-formats loop | generates every REMAINING lesson type after the stop |

Every one wraps a real `await` on a model call in a tolerant catch that continues. The tolerance is
right — one fumbled format must not lose a whole run — and it simply never distinguished a failure
from a deliberate stop. All six now re-throw `CANCELLED` and keep the tolerance for everything else,
the same shape and the same reasoning as `_runComicExtractJob`'s own fix at `v88_k`.

### ⚠️ The first version of the guard reported CORRECT code, and that is a bug in a guard

It flagged every `catch` in every runner: eight sites, six of them **synchronous** — writing a
checkpoint, building a diacritic index. A synchronous try cannot throw `CANCELLED`, because only an
in-flight model call does. **A rule that reports correct code is a rule nobody keeps**, and this one
would have been switched off or loosened within a release.

Scoped to try blocks that actually `await`, and the block is **BRACE-MATCHED** rather than sampled by
a line window — the "does it await" question is asked of the real try body, not of a fixed span that
would drift into the neighbouring statement. (An eighth fixed-size window in this line would have
been a poor way to police a rule about not cutting corners.)

Catches that re-throw unconditionally, and the outermost one routing to `jobFailOrCancel`, are
excluded by name: those are the ones that already behave.

**Guard**: `e2e-job-cancel` §6, sweeping every function named as `runCancellable`'s work — so a
seventh loop added later cannot ship swallowing. It asserts the sweep found at least five runners, so
a pattern that stops matching is a failure rather than a silent pass. **SIX mutations red**, one per
restored site.

## ✅ v88_y — the review card says which field is which, and the server half of item AN finally has a test

**User question**: *"if the user enters a title, such as here 't Manteling', it could be used as a
title for that chapter and would suppress title generation; easy?"*

**It was already built.** Item AN (`v88_d`) wired all five hops: the review card's `title` field →
`userTitle` wins over the derived placeholder → chunk `titleAuthored:true` → `topicAuthored` → the
saved topic gets `topicAuto:false` → `_applyChapterTitles` returns early for it. So the honest answer
was "done" — except for **why it had never worked for the user**, which turned out to be the same
defect behind their two previous reports.

**TWO `ui.json` keys**, both approved when the finding was put to them: one new label, one reworded
string (whose five translations were deleted per the standing ruling).

### ⚠️ The card had no labels, and the one label-shaped thing on screen named the wrong field

Every field carried a PLACEHOLDER and nothing else. **A placeholder disappears the moment its field
has content.** So on a panel with extracted text, the only label-shaped words on screen were the
EMPTY title field's placeholder — sitting directly above the CAPTION field that held the text. That
reads as label-above-field, and the user typed their chapter title into the caption. Measured in
their own data: `title:""`, with the title text in `caption`.

That one arrangement explains all three reports:
- *"if I assign a title"* — they were editing the caption;
- *"I'm losing the image description"* — the story is built from `[caption, inScene]`, so a caption
  they had just filled kept the description out (it is a fallback only when nothing was extracted);
- and the chapter title came from the text-derived placeholder, because the real title field stayed
  empty.

### ⚠️ AND MY FIRST READING OF THE CARD WAS WRONG — the user caught it

I described "four fields"; the user replied that they only ever saw three. Both true, and the gap is
the bug. The image-description box rendered **only when a description already existed**
(`buf.description ? … : ''`), so on a panel with none it was absent — and the third visible field was
`inScene`, whose string read **"What's happening in the scene"**. That describes a *description*,
while the field holds **text visible in the picture** (`server.js`'s own `CAPTION:` / `IN-SCENE:`
extraction contract: a narration box, and words drawn into the scene — signs, banners). The user
looked for the description, found a field that seemed to ask for one, and never saw the real one.

**Checking the extraction prompt before writing the labels is what caught this** — the labels I had
already written would have shipped the wrong reading with a confident label on top of it. Rule 35 in
its most literal form: my own summary of a card was a claim about it.

### What shipped

- **A visible label above every field, always.** Three reuse existing strings verbatim (they were
  already written as field names); the description needed one new key. The placeholders are dropped —
  with a permanent label, an empty field repeating the same words is the doubled text that made this
  ambiguous to begin with.
- **`form.image_scene_ph` reworded** to *"Text in the picture (signs, banners)"* — it now says what
  the field wants. Five stale translations deleted.
- **The description box always renders**, empty when absent. "No description was generated" is
  exactly the state worth seeing, and the old conditional hid it precisely then.
- `caption` and `inScene` stay separate despite both being extracted text: `_comicStoryPanelsHtml`
  renders them separately.

### ⚠️ The server half of item AN had ZERO coverage

`unit-comic-title-field` proved `titleAuthored` reaches the request body and stopped there. Grepping
the whole suite for `topicAuto` returned **no hits** — so everything that actually SUPPRESSES title
generation was unverified. That is the same shape that produced two failures in this line already
(`v88_x`'s two cache short-circuits; `v87_m`'s guard that only checked `index.html`), so it got a real
e2e: a chunk-based book with one authored and one un-authored chapter, against a live server.

**Two limits are recorded in the file rather than implied.** The fake returns no usable titles, so
`_applyChapterTitles` falls back to each chapter's existing name and NOTHING is renamed either way —
"the authored title survived" cannot be distinguished from "nothing was renamed" by reading titles
alone. Non-vacuity therefore comes from the fake's own request log (`chapter_titles` calls really
happened, so the post-pass ran), and the SKIP itself is pinned at the source — including that it
short-circuits **before** computing a replacement title, and still reserves the authored name so a
later auto-titled chapter cannot be given it. A first attempt asserted "the neighbour was retitled"
and failed: it was measuring the FAKE, not the product.

**Guard**: `unit-comic-title-field` (+1 section, fixture switched to the user's exact panel state —
empty title, empty description) and the new `e2e-authored-chapter-title`. **SEVEN mutations red** —
the labels removed, the description conditional restored, the misleading string restored, a label
moved after its field, `topicAuthored` never set, the post-pass skip removed, and the skip moved to
after the rename.

## ✅ v88_x — text analysis resumes instead of restarting, and a failed sentence is no longer permanent

**User request**: *"text analysis: did not finish for tp_17851387238120000029, while the server was
still running. Was this a timeout problem? If a text is already half-annotated, a second run should
skip the existing annotation and just do the rest. I think this would be an option of the current
'overwrite' dialogue … we should get an option 'overwrite' or 'expand existing'."*

**THREE new `ui.json` keys — exactly the budget the user approved**: two button labels, plus a
rewritten `text_explorer.confirm_reanalyze` whose changed English cost its four existing translations
(deleted per the standing ruling, so `translate-ui.js` refills them).

### ⚠️ MEASURE FIRST: the reported chapter had finished, and that is not the good news it sounds like

`tp_…029`'s stored analysis was **complete** — 6 of 6 sentences, 103 tokens, written the night
before. The run did not time out. But **2 of its 6 sentences hold a full set of token slots and not
one lemma**: `parseAnalysisReply` degrades an unparseable or malformed model reply the SAME way for
every token in that sentence — deliberately, so one bad reply cannot abort a chapter that takes many
minutes. Nothing ever revisited them. A third of that chapter was unusable, which is exactly what
"did not finish" looks like from the reader's side.

Measured across the whole live store before writing any code: **3 of 51 sentences (5.9%) in 2 of 18
chapters, 86 tokens stranded** — and both affected chapters are ones the user reported, the second
(*"some words in the middle of the text say 'nicht analysiert'"*, `tp_…093`, sentence 5) arriving
mid-release and landing on the same defect.

**So the request was right and its premise was not**, which changed the design: "already analysed"
cannot mean "has tokens".

### There was nothing to resume FROM, either

`writeAnalysisChapter` ran **once, after the whole chapter finished**. A run that timed out, was
cancelled, or died with the server persisted **nothing** — every completed sentence thrown away. The
store confirms it: all 18 chapters complete, no partials, because a partial could never be written.
So the feature is three things, not one:

- **`analyzeChapter` gained two opt-in hooks** (`canonical-analysis.js`): `reuse(sentence, i)` returns
  an already-analysed sentence to keep, `onProgress(i, soFar)` fires after each NEWLY analysed one.
  Absent by default, so every existing caller is byte-identical — asserted, not assumed. A reused
  sentence deliberately does not fire `onProgress`: nothing was computed, and re-persisting an
  unchanged prefix would write the store once per sentence for free.
- **The run checkpoints after every new sentence**, flagged `partial:true`. A failed checkpoint never
  fails the run — the analysis in hand is worth more than the save.
- **`_analysisSentenceUsable(sent)`**: a sentence is analysed when at least one token carries a real
  lemma. That is `computeFrequency`'s own definition of "resolved", reused rather than re-invented.

**Reuse matches on sentence TEXT, not index.** Index matching is right only while CP1's segmentation
is unchanged — which is precisely when nothing needs resuming. The valuable cases are the others: a
run that died (the store holds a prefix), a story that GREW (the hash differs, most sentences are
word-for-word identical), and a sentence whose reply failed. Text matching serves all three with one
rule and cannot pair an old analysis with a different sentence that happens to share its slot.

### ⚠️ THERE ARE TWO CACHE SHORT-CIRCUITS, AND READING THE ROUTE FOUND ONE

The route has its own; `_kickOffAnalysisJob` repeats the test for its OTHER caller (`_runBookJob`'s
`postGenAnalysis`, which has no route to pre-check for it). Teaching only the route about `resume`
left the second one firing, and **a live resume request came straight back `{cached:true}` having
done nothing at all.** Found by issuing the request against a running server — the code reads
correctly at either site in isolation. `v88_b`'s lesson in a new shape: when a fix must apply to
every gate, assert over the OUTCOME, which is what the e2e now does.

A `partial` is deliberately still `available`: the explorer renders the half it has (some words
clickable beats none). What it must not do is satisfy either short-circuit — asserted with a PLAIN
post, no flags, because doing it with `{resume:true}` was vacuous (`!resume` already opens the gate).

### ⚠️ A partial would have rendered a TRUNCATED chapter

`_teStoryHtml` emitted only the gaps BETWEEN located sentences, so everything past the last one was
silently dropped. Invisible while every analysis was complete and reached the end of the text — and
fatal the moment a partial renders, which is the whole point of this release. It also recovers any
trailing text CP1's splitter left behind (it breaks only on recognised sentence punctuation, so a
chapter ending without one already lost its last line). Not routed through `_teGapHtml`: that returns
null for any gap containing a blank line, which the caller reads as "close the paragraph" and which
would DISCARD the gap's own text — for a tail the text is the point.

### The dialog

`showChoiceDialog` already existed for exactly this shape of decision, so no new machinery. Cancel /
**Analyse only what is missing** / **Re-analyse everything from scratch**. The counts it states
(`{done} of {total}`) come from the SERVER's shadow (`usableSentences`/`totalSentences`), not from
counting tokens client-side — the number shown and the sentences the run redoes must come from one
definition of "usable", or the dialog promises work the run does not do.

`force` and `resume` are mutually exclusive **by construction**: `force` deletes the record before
the shadow is read, so a resume flag alongside it is inert. Worth stating because the mutation
"force also resumes" stays GREEN — that is the design, not a hole, and the ORDER of those two lines
is what is pinned instead.

### Verified live, end to end, on the user's own reported chapter

Against a real Ollama and a real 35B model, on `tp_…093`, with the store pointed at a scratch copy so
the user's data was untouched: the job reported **"CP2: analysing 1 sentence(s)"**, the server logged
**`7 sentence(s), 123 token(s), 6 reused`**, and sentence 5 went from 23 unresolved tokens to 23
resolved. One model call instead of seven. Server started on a spare port and killed by PID.

### Four vacuous or brittle assertions found by mutation, and what each taught

- **`/catch \(e\)/` matched the FUNCTION's outer catch**, not the checkpoint's own — removing the
  checkpoint's guard left it green. Pinned to the one statement it is about.
- **The partial-gate assertion posted `{resume:true}`**, which opens the gate by itself, so
  `!shadow.partial` was untested. A plain post is the only thing that exercises it.
- **`unit-analyze-chapters-run` §7 asserted "the user said yes"** — now two different answers that
  must post two different bodies. Split, and the resume half is the one that decides whether the user
  pays for the whole chapter again.
- **The concurrency section counted a RUNNING TOTAL across the whole file** (7) and spelled every
  earlier section's arithmetic into its own assertion. Three new sections broke it on a correct
  render of its own claim. Measured as a delta now — the same class as the fixed-size source windows
  this line keeps hitting: an absolute standing in for a local property.

**Guard**: `unit-canonical-analysis` (+2 sections, counted over REAL HTTP calls to the fake — "the
result contains the reused sentence" would pass just as well if it were re-analysed and came back the
same), `e2e-analysis` (+4 sections, staged by editing the store directly, since the fake model always
answers and no fixture can produce a failed sentence on demand), `unit-text-explorer` (+2),
`unit-analyze-chapters-run` (migrated). **FOURTEEN mutations red.**

## ✅ v88_w — the "comics" job labels, a yellow highlight I caused, and the static landing card's artwork

Three user reports, two of them arriving while the previous release was still being written. **ZERO
`ui.json` keys.**

### 1. The last two "comics" in the jobs popover

*"The job popover on the lower right still has two mentions of 'comics'. We aimed to replace these,
since 'comics' is just one use case of the image upload. Below the image the text 'detect comic
panels' is OK, since this really refers to an image of a comics/manga."*

`Extracting comic panels (N)` → `Extracting image panels (N)`; `Comic draft (N panels)` →
`Image draft (N panels)`.

**⚠️ Why `v88_f`'s `comic`→`image` rename could not have caught them.** Both are **hardcoded English
in `server.js`**, not `ui.json` keys. `unit-ui-key-exists` sweeps every string reaching `t()` —
including, since `v88_f`, the conditional-call shape `CALL_RE` could not see. None of that can see a
job label, because **server job labels are the one user-facing surface `ui.json` does not cover at
all.** They are consequently **never translated**, in any UI language. Recorded, not closed: closing
it needs keys plus a client-side lookup for server-minted strings.

Deliberately keeping the word: `d.kind === 'comic'` (a stored DRAFT field — renaming it orphans every
draft on disk), `link:{type:'comic-extract'}` (a protocol token), and `Detecting comic panels` (**the
user's own explicit exception**).

The guard sweeps the **whole set** of job labels, not the two reported (`v88_b`'s rule), stripping
`${…}` interpolations first — those are code, and without that the draft label fails on its own
`d.comic` field access. `deepStrictEqual` against a one-element list pins the exemption in BOTH
directions: it cannot silently grow, and renaming the detection job breaks it too.

### 2. ⚠️ A regression I shipped in `v88_u`, reported within minutes

*"it seems that you just changed the word highlight in text analysis view from light blue to yellow.
I wanted it to be cleared, i.e. NO COLOR, and only keep the frame that is shown on mouse-over."*

Correct, and the cause is exact: **the analysed tokens are `<mark>` elements**, and a bare `<mark>`
carries the BROWSER's own yellow fill and black text. `v88_u` merely DELETED the blue declaration,
which unmasked the default. **Removing an override does not remove a style when the element type has
one of its own.** Now `background:none;color:inherit`, and `.te-tok-low`'s grey block goes the same
way (a grey highlight is still a highlight; its muted TEXT colour stays, being a property of the word
rather than a marker painted behind it).

**⚠️ THE GUARD WAS A PROXY, AND THE PROXY IS WHY IT SHIPPED.** `v88_u` asserted
`!/background/.test(rule)` — "the rule declares no background" — as a stand-in for "the word is not
filled". Different claims for a `<mark>`. The broken version satisfied the proxy exactly, **and the
proxy would have gone RED on the correct fix**, since suppressing a UA default REQUIRES declaring
`background:none`. A proxy fails in both directions; this one demonstrated both within one release.
Restated properly: every `.te-tok*` rule must SET a background, and every background it sets must be
`none`/`transparent` — red on a colour, red on a missing declaration, green on the fix. The mutation
reproducing `v88_u`'s exact shape now goes red, plus a non-vacuity assertion that these really are
`<mark>` elements, which is the whole premise.

### 3. The static landing card ignored the artwork mode

*"in the static docs/index.html main page, we still see the story board where in live and in static
storylinepage we do see the images, e.g. sl_143869450"*

`build-static.js`'s own `loadSavedList` read `sl.storyboard` **directly**, so `v87_m`'s
per-storyline `thumbMode` never reached the one surface that re-implements this render. Measured
against the real bake: `sl_143869450` ("Wald und Verfall") has `thumbMode:"images"`, a storyboard,
and inline panel images on all 7 chapters — so it showed the storyboard on the landing card and
images everywhere else.

**`v87_m`'s own guard asserted "neither surface reads `.storyboard` directly any more" — against
`index.html` alone.** That is exactly the `v55_p` trap `unit-static-landing-parity` exists for, and
the direct read sat **two lines under that file's own warning comment** about it. Now routed through
`_slArtworkHtml`, which works offline unchanged because `_slImageStripHtml` prefers
`comicPanels[0].image` (baked inline) and only falls back to the live thumb route.

The guard is two-sided: `_slArtworkHtml(` joins the parity hook list *and* a new FUNCTIONAL section
builds a real static bundle from a fixture carrying **two** storylines — one in images mode with both
artworks available, one in the default mode — loads the built file in the DOM harness, renders the
landing list and asserts each card shows the right thing. The images-mode fixture is discriminating:
without it, a card that always renders the storyboard passes everything else in that file.

### ⚠️ Two old traps, sprung again while fixing these

- **Backticks in a comment inside a template literal** (`build-static.js` this time) — third
  occurrence this session, and the file already carries a note about it elsewhere.
- **A fixed-size window**, again: the new functional guard first sliced 4000 chars from the artwork
  slot and ran into the *other* storyline's card, failing on a correct render. Bounded by the next
  `slgroup-` instead. Seventh in this line.

### ⚠️ And a fourth: a fixture the live corpus broke, for the third time in this line

`unit-story-unlocked-card` §7 went red **3/3 — deterministic, so not the documented flakiness**
(protocol item 1) — because the user's own server had generated `tp_…093` into **two** storylines at
once (`sl_790942494`, 2 chapters, and `sl_143869450`, 7). Every case there marks THIS storyline's
chapters complete and then lets the card resolve its own deck through `_storylineForTopic()`, which
returns the FIRST storyline containing the topic. So "is the whole story finished?" was being asked
of a deck the test had never touched, and case (a) correctly answered "back to the storyline" instead
of the finished card.

**Identical defect and identical fix to the one `v88_o` applied to `unit-story-finished`** — that
release's own write-up says a proxy fails in both directions, and this file kept the proxy. The
selector now requires every chapter of the candidate storyline to belong to **no other deck**, which
is the property the section actually depends on rather than a stand-in for it. Isolated in two
commands (`git show HEAD:lessons.json`, then the same run against the working tree), exactly as the
protocol prescribes.

**Guard**: `unit-jobs-popover` (+1 section), `unit-text-explorer` (§7d rewritten),
`unit-static-landing-parity` (+1 functional section, fixture extended), `e2e-drafts-comic` (label
claim updated, unchanged in substance). **ELEVEN mutations red.**

## ✅ v88_u — three text-analysis fixes: no auto-start, no blue fill, and the question card gets its own 🔍

Three items from the user's live-test batch, all in the text-explorer view. **ZERO new `ui.json`
keys** (the three approved for the re-analyse dialog are still unspent — that item is separate).

### 1. ⚠️ Looking at a chapter no longer queues an hour of GPU time

*"Do NOT auto-start text-analysis from the progress cards, when the magnifying glass button is
clicked and no analysis exists. Just show the text where words just can not be clicked if an
analysis is not yet available."*

`_ensureTextExplorerData` fired the job-kickoff route whenever the GET came back unavailable. So
**merely toggling a VIEW started a multi-minute CP2 run — one model call per sentence — against the
user's own Ollama, with no confirmation, on every chapter they happened to open in explorer mode.**
Starting work that expensive is a decision, and it already has a control that asks first: the
analysis button (`analyzeChapters`, which pre-checks and confirms before forcing a re-run).

The view now READS and only that control WRITES. A new settled status, **`'none'`**, means "asked,
and there is no analysis" — a settled state, not a transient, so it joins `ready`/`loading`/
`analyzing` in the early return and the view stops re-asking on every repaint. `analyzeChapters`
**deletes the cache entry** when it queues a run, which is what lets a freshly analysed chapter light
up without a reload.

**`'none'` renders the plain story, not a status line.** The easy reading of the request would have
been a "not analysed yet" message; the user asked for the TEXT. It reuses the existing
nothing-to-annotate branch verbatim — real paragraphs, no `.te-tok` spans, so no word is clickable.
The static build's "absent from the bake" case moved from `'error'` to `'none'` for the same reason:
offline, only some chapters are ever baked, so that is the DEFAULT, not a fault the learner can act
on.

### 2. Analysed words are no longer filled blue

*"In text analysis view: don't show the blue highlight of analyzed text, just show the blue frame
around the word on mouse-over."* `.te-tok` loses its `background:#eaf2ff`; `.te-tok:hover`'s outline
is the whole affordance now. On a fully analysed chapter the fill marked **every word**, which
signals nothing, and it fought the red→green vocabulary colouring the same text carries. Padding and
radius stay so the hover outline has something to hug.

### 3. The question card gets its own 🔍

*"Question card: the collapsed text-view should also have the button to view the text analysis."*
Open since `v86_ad` and recorded as such in INTERNALS: the progress card and the lesson-set card both
grew a 🔍; the panel a learner spends the most time beside never did.

A **THIRD independent flag** (`APP._exTextExplorer`), matching the precedent `v86_ad` set rather than
reusing `APP._textExplorer` — three surfaces can be open in different senses, and toggling one must
not silently flip another's visible state. The chapter-id-keyed CACHE is shared, so the data is
fetched once however many surfaces ask. Picking a language flag exits explorer mode, the same rule
the other two follow.

**`_teRepaint` was widened in the same commit, not after a bug report.** `v86_ad`'s own lesson — "a
second surface added over a shared cache needs the repaint path widened too" — is exactly what this
release would otherwise have reproduced. The panel rebuild that `toggleExStoryLang` had inline became
`_exStoryPanelRefresh()`, shared by both toggles and the repaint, so the three callers cannot
disagree about whether the panel stays open.

### ⚠️ THREE comments had to be reworded because they spelled patterns the new guards SWEEP

The job route's name inside `_ensureTextExplorerData`, and `chainBlocked`/the resume key in `v88_s`
before it. **Third and fourth occurrence in two releases.** The rule is old — a comment near a
source-scanned pattern must not spell the pattern — and it keeps being rediscovered by the guard
rather than by review, which is the system working, but worth stating plainly: when you write an
absence assertion, expect your own explanatory comment to be the first thing that fails it.

### Two sections were re-anchored, not patched

`unit-text-explorer` §2b asserted the **opposite** of the new behaviour (that an unavailable GET
fires the POST and moves to `'analyzing'`). Rewritten to assert **no POST is made at all** — stated
that way rather than as "the entry is `'none'`", because the entry could reach `'none'` while a POST
also fired, and the POST is the thing that costs the user an hour of GPU. Backed by a SOURCE-layer
sweep (§2d) proving the view path does not name that route, so a POST reintroduced on a branch no
fixture reaches still fails. §8's static-miss case moved from `'error'` to `'none'`, keeping its own
claim (degrades cleanly rather than hanging) intact.

### ⚠️ A fixture that made a mutation pass

The new §7b first seeded BOTH other explorer flags to `true` and asserted all three true afterwards
— which the mutation "copy my flag onto the completion card's" satisfies exactly, and it stayed
GREEN. Seeded to DIFFERENT values (one on, one off) it goes red. *"Leaves the others alone" is not
observable when the others already agree with you.*

**Guard**: `unit-text-explorer` grows to 15 checks. **TEN mutations red** — the view starting a job
again, `'none'` rendering a status line, `'none'` not terminal, a queued run leaving the cached
`'none'`, the question panel losing its 🔍, that 🔍 reusing the completion card's flag, the panel
ignoring the analysis, the blue fill restored, the repaint dropping the third surface, and the
language flag no longer exiting explorer mode.

## ✅ v88_t — two live-test fixes: the extracted-text field is resizable, and the library sorts by ONE key

Two items from the user's live-test batch, taken together because both are small, contained and
unrelated to each other's code. **ZERO new `ui.json` keys** — the two new sort options reuse
`gen.story_lang_source` / `gen.story_lang_target` verbatim.

### 1. The extracted-text field was a single line (user report, with a screenshot)

*"the extracted text confirmation window is a single line even though the text can be long. It
should be a resizable text field just like the 'image description' field below it."*

The review card's CAPTION field was an `<input>`. "Caption" is the wrong intuition for what lands
there: on a photographed information board — the screenshot's own case — the extracted caption is
the whole body of the sign, several sentences. A one-line field showed the first few words and hid
the rest behind horizontal scrolling, **on the one screen whose entire job is checking that text
before a chapter is built from it**. Now a `rows="3"` textarea with `resize:vertical`, matching the
in-scene field directly below it and the image description below that. The chapter TITLE stays an
`<input>` — a title really is one line, and the guard pins that too, or a blanket "make everything a
textarea" edit would pass.

**⚠️ The comment explaining it broke the build**, because it lives inside a JS template literal and
contained backticks. Same trap `build-static.js` already carries a note about. Caught by
`check-inline.js`, which is why that check runs on every release.

### 2. The library sorted by source language FIRST, and the dropdown only ordered within each group

*"On the main page, we sort by source language and THEN by the new sorter (token usage, generated,
last-edited). Let's add language sorting as an option in the dropdown menu, and allow both source
and target language sorting, and drop the main previous source language sorting all together."*

The source language was an **unconditional outer sort**, and `v88_j`/`v88_n` had both treated that as
deliberate and worth protecting — `v88_n`'s own entry even recorded it as "a usability finding about
the grouping". It meant *"sort by token usage"* never produced a list in token order: it produced
language groups, each internally in token order. Now the dropdown owns the whole ordering and the
two languages are simply two more keys in it.

- **Sorted by NAME, not by code.** `de`/`en`/`it`/`nl` sort as "German"/"English"/"Italian"/"Dutch"
  only by accident, and the flag headers spell the name out — a list ordered by code under a
  name-ordered header reads as broken. Unknown codes fall back to the code so they still sort
  deterministically.
- **Ties inside a language run keep "last edited, newest first"** — without it the list reshuffles
  between renders for no reason. The tiebreak is deliberately NOT reversed by the direction toggle,
  so reversing "my language" swaps the language runs without shuffling each run's contents.
- **⚠️ The flag headers FOLLOW the sort now**, and vanish when it is not a language sort. A header
  saying "German" over a run of rows is a claim that the list is grouped that way, and after this
  release it is only grouped that way when the chosen key IS that language. Keeping source-language
  headers over a token sort would emit one header per row wherever the languages interleave — worse
  than none. This was not in the request; it follows from it, and stating it as a separate rule
  (`_langHdrBy`) is what keeps the two decisions from drifting.
- The reverse button now applies to the language keys too. `v88_n` had deliberately excluded the
  grouping from reversal; with no grouping left there is nothing to exclude.

### ⚠️ A whole render branch had never been reachable in the test harness

Adding a second TARGET language to the fixture — needed to test the target-language sort at all —
made `loadSavedList()` throw. `_populateLibSelects` runs only when the library holds more than one
target language, and it did `Array.from(srcSel.options)`. **`lib-dom` auto-vivifies a plain `div` for
any id**, and a div has no `.options`, so that branch threw for every headless render of a
multi-language library. No fixture had ever been multi-target-language, so it had never run. Guarded
on `.options`, not just on the element. In a browser the guard never fires; what it buys is that the
branch can be exercised at all.

### The fixture had to be redesigned twice

`unit-library-sort` grew a fifth storyline (`E`, sharing A/B/C's SOURCE and D's TARGET) so the two
language keys partition the library **differently** — otherwise a `srcLang`↔`lang` mix-up passes.
Then the dates had to change as well: the first attempt had `srclang` and `edited` produce the
IDENTICAL order, so a sort ignoring the language key entirely would have passed. All five keys now
give five different orders, and §3b asserts that explicitly rather than trusting it.

Every expected order also moved from `.slice(0,3)` to the **whole list**. The slice existed only to
step around the source-language pre-sort, which parked the en-source storyline last regardless of its
value — the very behaviour this release removes, and invisible through the slice.

**§4b-ii was rewritten to the opposite claim.** It asserted that reversing leaves the language GROUPS
alone; that was correct when a grouping existed and is now false by design. It asserts the inversion:
reversing a language key swaps the language runs, headers included, while each run's internal
tiebreak stays put.

**Guard**: `unit-comic-review-card` (per-FIELD tag assertions, read from the real rendered markup —
"there are three textareas" would stay green if caption reverted while another field gained one) and
`unit-library-sort` (11 checks, incl. the new `headers()` helper). **Nine mutations red** — caption
back to an input, caption un-resizable, the title turned into a textarea, the source-language
pre-sort restored, the two language keys swapped, headers always by source language, language sort
by code instead of name, the reversal skipping the language keys, and the tiebreak removed.

## ✅ v88_s — the chapter-wise progress lock is GONE, on both surfaces that carried it

**User request** (the second half of the same message `v88_r` served, answered "yes, as a second
release" when the two surfaces were put to them): *"we remove the chapter-wise progress locking as
the default play mode for students. Students can ALSO browse through chapters."*

`v88_r` made the progress card's → browse freely. A 🔒 on the storyline screen would have
contradicted it on the one surface where a student PICKS a chapter — and only in the published
build, where the student actually is.

### Both copies of the same gate went, and finding the second one was the point

Neither fired live: both are scoped `!APP.info.canGenerate && !APP._teacherMode`, and `canGenerate`
is true on a running server. **The published `docs/index.html` is where they had force.**

1. **`_renderChapterCard`'s `_isLocked`** — the visible 🔒 overlay. Gone with it: the transitive
   "something earlier is unfinished" flag threaded down `_renderChain`'s recursion (`v69.2d`), the
   predecessor-completion test (`v74_k`), the fail-closed `!prevTopic` clause (`v46` Bug #2), and the
   started-chapter helper that existed only to stop the gate confiscating work in progress. **What
   remains is not a progress gate at all**: `!isFirst && _sets.length === 0` — a chapter whose
   lessons have not been generated has nothing behind it to open, which is a fact about the DATA.
2. **`_sbChapterTarget`** — the same rule wearing different clothes. A student clicking a storyboard
   panel for a "locked" chapter was silently REDIRECTED to the last unlocked incomplete chapter,
   with a toast to explain it. **A click that opens a different chapter than the one clicked is the
   exact opposite of what the ruling asks for.** The `completed` and `free` parameters went with it;
   the function is now clamp-and-return, kept as a NAME because `_sbNavClick` and
   `_sbMarkCurrentPanels` share the panel→chapter mapping and "the frame and the link cannot
   disagree" is pinned at the source layer.

**Removing one and leaving the other is how a rule survives its own deletion**, so the cross-check
that both went lives in one place (`unit-storyline-chapter-access` §3).

**One `ui.json` key REMOVED**, from all 33 languages: the resume toast explained a redirect that no
longer happens. Removing costs the user nothing to translate; leaving it would have left a dead
string plus a guard asserting its existence — decoration.

### Three test files needed re-scoping, and one of them was named for the deleted rule

- **`unit-storyline-lock-hardening` → `unit-storyline-chapter-access`** (renamed via `git mv`,
  rewritten). Its assertions did not FAIL — they became assertions of the wrong thing, which is the
  worse outcome. The new claim is stronger and easier to break: **no progress state may reach the
  predicate at all**, asserted as an ABSENCE over the whole client, because a deleted rule must not
  survive as a dead branch some fixture happens not to reach. Its chain-REPAIR half is untouched:
  chaining unresolved chapters to their storyline-order predecessor shapes the connector lines and
  render order, which the lock's removal does not affect.
- **`unit-storyboard-nav` §3** — every fixture that used to be REDIRECTED now asserts the clicked
  panel is the chapter opened. §4/§5's two lock assertions became absence assertions (no `free`
  flag recomputed, no resume string anywhere).
- **⚠️ `unit-live-static-progress-parity`, re-anchored (rule 29).** It observed `v74_i`'s
  shared-completion fix THROUGH the lock — "the chapter after a completed one opens" — and its own
  non-vacuity check asserted that a later chapter is *still locked*, i.e. that the deleted rule is
  still running. **The claim did not change, only the mechanism.** `chapterComplete` still decides
  the CONNECTOR LINE into the next chapter, and `v74_i`'s defect shows there just as sharply: under
  the raw `every(done-flag)` rule a mixed-driven chapter can never be finished, because the pooled
  prep lessons it hides never receive a done-flag. So the observation moved to `path-line done`
  (exactly one, which is non-vacuous in both directions: a broken rule gives 0 or all), and the lock
  reading became `deepStrictEqual(locked, all-false)` — `v88_s`'s own claim carried into the static
  projection. **Mutation-tested both ways**: reinstating the lock, RED; swapping the connector back
  to the raw done-flag rule, RED.

**⚠️ Two comments had to be reworded** because they spelled identifiers the new guards SWEEP for
(`chainBlocked`, the resume key). Standing rule: a comment near a source-scanned pattern must not
spell the pattern — it fails the very check it documents. Caught by the guards, not by review.

**Verified live** on the user's own server with `canGenerate` forced false and teacher mode off, on
a real 6-chapter storyline: **six 🔒 glyphs and ten inert card wrappers before, one glyph and zero
inert wrappers after** — and the survivor is inside `.storyline-story`, the full-story row's own
gate, not a chapter card. That gate is the WITHIN-chapter progression the user explicitly kept.

**Guard**: `unit-storyline-chapter-access` (4 checks, rewritten) + `unit-storyboard-nav` §3/§4/§5 +
`unit-live-static-progress-parity`. **Eight mutations red** — the predecessor lock reinstated, the
"no lessons yet" case dropped as well, the first chapter made markable, the storyboard redirect
reinstated, the resume key resurrected, the chain flag threaded again, and the parity file's two.

## ✅ v88_r — the progress card's arrows BROWSE chapters; a new ▶ plays. Chapter-wise locking is gone for students.

**User request**: *"Can we make the new teacher play mode also available for students? Let's allow to
browse through texts by the current arrows and instead move the 'next' function to play the next
questions to a play button in the progress card menu. That is, we remove the chapter-wise progress
locking as the default play mode for students. Students can ALSO browse through chapters, and play
each chapter separately via the new play button or by clicking on words in the vocab-highlight view.
[…] However, we do still want the 'play mode' question progress within chapters, to first solve
vocab, then, to really complete a chapter, solve the comprehension or text hunt lessons."*

**ZERO new `ui.json` keys** — the user's chosen budget. `walk.next` ("Next chapter") already existed
from `v88_o` and is exactly what the browse arrow means; `complete.continue` ("Continue") labels ▶;
`complete.repeat_none` explains the greyed one. Third release in this line to close a user request
with no new strings.

### The shape: an OVERRIDE, not a rewire — the same decision `v88_o` made, for the same reason

`showComplete()`'s Next/Back decision tree is still the most expensive code in this client to get
wrong (the `§C1` gate analysis, `v77_card_gates.md`'s 32-row truth table, four user-reported dead
ends). **Not one branch's computation changed.** `_browseApplyNav()` runs at the END of the render —
before `_walkApplyNav()`, before the header mirror — and MOVES what the chain resolved onto ▶, then
repoints → at the next chapter.

**▶ takes the chain's destination WHOLE, not just its in-chapter part.** "Move the next function to
a play button" means the whole function: the next unfinished lesson here, the story-unlocked page,
the below-mark remediation, **and the next UNFINISHED chapter** when this one is done. So ▶ is
"continue the course, wherever the pedagogy says that is" and → is "browse to the chapter next
door". They can both land on a chapter and mean different things; that is the point. The first
draft of this release withheld the chapter branch from ▶ — which left the most delicate branch in
the file reachable by nothing and would have made `showStoryFinished` unreachable by forward.

**The one branch ▶ does NOT take is the terminal one.** There the chain resolves to *leaving* — the
story-finished card or the storyline — and a ▶ meaning "back to the library" would lie about what it
plays. ▶ greys there (present and greyed, `v71_h`'s rule, never hidden) and → carries the exit, so
`v74_o`'s "the last card is never a dead end" and `v77_f`'s finished card both survive intact.

**What the user asked to KEEP is exactly what was not touched.** The within-chapter progression —
vocab first, then the comprehension/text-hunt lessons to actually complete a chapter — is the gate
chain plus `storyUnlocked`/`_storyLockedLesson`, and none of it moved. What went is the CHAPTER-wise
lock: → no longer waits for this chapter to be finished.

### ⚠️ Browsing is NOT `_nextChapter()`, and that is the discriminating case

`_nextChapter()` scans for the next UNFINISHED chapter and skips finished ones — right for "continue
the course", wrong for browsing. → mirrors `comp-prev`'s own `_prevChapter` instead (`v82_e`:
*"going back is revisiting what came before, not hunting for outstanding work"*), one step, always,
and lands through `_backToChapterProgress`, which forces the PROGRESS card and deliberately never
consults `_enterViaSummaryCard`. **`unit-browse-mode` §3 is the fixture that tells the two apart**:
chapter 2 finished, chapter 3 not, standing on chapter 1 — the old rule answers 3, browsing must
answer 2. Without that section a browse built on `_nextChapter` passes every other assertion here.

### ⚠️ `_backToChapterProgress` HAS NEVER EXISTED IN THE STATIC BUILD — the ← button was dead since `v82_e`

It was added at `v82_e` among the server-calling functions, i.e. **above `@static-exclude-end`**, so
`build-static.js` drops it: `docs/index.html` *calls* it and never *defines* it. The progress card's
← "previous chapter" has been throwing a `ReferenceError` in the published build for four releases,
silently doing nothing. Nothing caught it because every guard for that button ran against
`index.html`. Pointing the FORWARD arrow at the same helper is what surfaced it. `build-static.js`
now supplies its own `STATIC_LESSONS` version, the same shape as its `loadSaved` reimplementation,
and `unit-browse-mode` §12 asserts the built file DEFINES it — the assertion that would have caught
the original.

### ⚠️ A real crash, latent until this release made it ordinary

A review render's synthetic `APP.cur` carries `_review:true`, an empty `exercises` array and **no
`cur` at all**. `renderEx`'s length guard is `C.cur >= C.exercises.length` — **`undefined >= 0` is
false** — so a speech-advance timer left over from the previous round walked straight past it into
`C.exercises[undefined]` and threw *"Cannot read properties of undefined (reading 'type')"*. Rare
while landing on a review card mid-flight was rare; → now loads the next chapter ASYNCHRONOUSLY and
lands on exactly that card, so a learner pressing it right after answering has that timer in the
air. Guarded at the top of `renderEx`. **Found by a stray timer crashing `smoke-render` AFTER it
printed ALL PASSED** — an exit code with no failing assertion, which is the shape that gets dismissed
as harness noise. It was not.

### One rule, two askers

The terminal branch's "there is no next chapter, so where does forward lead?" is now
`_compEndForward(slCtx, isDrill)` — extracted VERBATIM, because the browse arrow standing on the last
chapter asks the same question and (unlike that branch) can be reached with work still outstanding. A
second copy is the shape that drifted for the storyline page's connector line in `v71_w`.
`unit-browse-mode` §4b pins the caller count and asserts the inline copy is gone.

### ▶ is in the popup AND beside the arrows

The request says "in the progress card menu", and that is where it lives — `#comp-actions`, inside
`#comp-nav-modal` with the rest of the machinery. But the popup is two taps away while browsing is
one, and ▶ is the move the card is *asking* for; leaving it deeper than the arrow would invert the
card's own priority. So it is mirrored into the nav row as `← ☰ ▶ →` through the SAME
`_mirrorNavBtn` the arrows already use — a copy of the resolved state, never a re-derivation. Put to
the user as a question before building; they chose both.

`_captureNextAction` (the word-tap detour, item Z) and `_storyTapMaybeAdvance` (a tap on plain story
text) both read "where forward would have led". They now read **▶ first, → second** — together the
pair reproduces exactly what `comp-next` alone meant before, and reading only `comp-next` would have
turned a tap-to-continue into a tap-to-leave-the-chapter. This is the user's own third route in
("play each chapter … by clicking on words in the vocab-highlight view").

### ⚠️ A guard that stayed green, and was left honest rather than strengthened

`_browseApplyNav`'s `if(walkActive()) return;` looked like what keeps a teacher walk in charge of the
arrows. **Deleting it left every guard green** — `_walkApplyNav()` runs immediately afterwards and
repoints both arrows, so the ORDERING is the protection. Following `v87_p`'s ruling on exactly this
situation: the check is KEPT (it avoids a pointless transient assignment and one wasted closure per
walked chapter), its comment now says it is not the protection, the test records that its
behavioural assertion cannot attribute itself to one guard, and the ordering — which IS attributable
— is pinned at the source layer. Swapping the two calls goes red.

### Fixed-size windows, the fifth and sixth

Two more source-scanning guards failed in the FALSE-POSITIVE direction the moment the markup grew:
`unit-progress-card-nav`'s `vocabAt - detailsEnd < 400` (a fourth button in the nav row) and
`unit-drill-ledger`'s `indexOf('function renderEx()') + 3000` (an eleven-line comment). Both replaced
with STRUCTURAL bounds that are strictly stronger — the nav row now asserts the exact id membership
AND order of the gap; the drill ledger slices to `renderEx`'s own closing brace. **A fixed-size
window over generated markup is a proxy, and a proxy fails in both directions.**

### Migration

Eight existing test files clicked `comp-next` for a claim about where PLAY leads. Each moved to
`comp-play`; the claims are unchanged, because the chain still resolves the same destination in the
same branch. `unit-story-unlocked-card` §7 needed real re-scoping rather than a substitution — all
three of its cases are the terminal branch, so ▶ correctly greys there and → carries `v74_o`'s
"never a dead end" guarantee; case (c)'s "a finished later chapter is not re-offered" is now a claim
about ▶, while → browsing into it is deliberate.

**Verified live** on the user's own running server (a real 6-chapter storyline, `Enteignung und
Wald`): → walked chapters 1 → 2 → 3 and ← back to 2, every landing the review progress card, no
completion required anywhere; the nav row renders `← ☰ ▶ →`.

**Guard**: new `unit-browse-mode.test.js`, 13 checks. **Twelve mutations red** — the arrows never
repointed, browse skipping finished chapters, ▶ never inheriting the chain, ▶ also taking the end
branch, the end rule copied instead of shared, the header duplicate unmirrored, the walk override
reordered, the drill exemption removed, the tap-advance reading only `comp-next`, the `renderEx`
guard removed, the static override removed, and the branch kind hardcoded.

## ✅ v88_q — the teacher walk starts on the story summary, when there is one

**User request**: *"the teacher play button SHOULD start with the summary, if one is available."*
One new `ui.json` key (`walk.summary`, the Back title on chapter 1).

**Why this is the right entry, not just a preference**: the summary page IS the walk's first page for
a learner (`§0c`, `v77_k` — *"the summary card is the ACTUAL ENTRY POINT"*: the story so far, in the
source language, bars empty, before any question). Starting a teacher somewhere else would have them
previewing a course the learner never sees.

### The shape

**Index `-1` IS the summary page.** The walk now runs `-1 → 0 → 1 → … → n-1`, which keeps one
position variable rather than a second "am I on the summary" flag that could disagree with it.

- **Forward from the summary → chapter 1.** `_walkApplySumNav()` repoints `sum-next`, mirroring
  `_walkApplyNav`'s shape exactly: after the branch that decides it, before `_syncSumHdrNav()` so the
  header duplicate inherits it, and a complete no-op when no walk is active. Without it the page's
  own forward means *"back into the card you came from"* — right for a learner, wrong here.
- **Back from chapter 1 → the summary**, when there is one; out to the library when there is not.

**⚠️ Chapter 1 is still LOADED first, and that ordering is forced, not incidental.**
`_summaryOfStory()` resolves through `_storylineForTopic(APP.lessonData?.topic)` — it reads the OPEN
chapter to find the storyline — so "does this storyline have a summary?" cannot be asked before a
chapter exists. `walkStoryline()` therefore opens chapter 1 and only then steps back to `-1`. Pinned
by its own assertion, because a later "optimise the extra render away" would break the question
rather than the answer.

**"If one is available" is a real condition.** `_summaryOfStory()` returns null for empty summary
text, and `showStorySummary()` on such a storyline renders a blank card — so the no-summary path goes
straight to chapter 1. Both directions are guarded, and the mutation that always starts on the
summary goes red.

### Three older sections were re-scoped, not patched

Giving the fixture storyline a summary made §1/§2/§7 land on the summary instead of chapter 1 — they
are about how a CHAPTER is opened (the review render), not about the entry page. Rather than widen
their assertions to accept either, each now pins `_summaryOfStory` to null, so a failure in any of
them still names one thing. **An assertion that accepts two outcomes has stopped discriminating
between them**, which is how a guard quietly becomes decoration.

**Guard**: `unit-teacher-walk` grows to 11 checks — the summary entry, the no-summary entry, the
forward override, and Back's two destinations. **Four mutations red**: never starting on the summary
(the `v88_p` behaviour), always starting on it (the blank card), Back always exiting, and the
summary's forward left unrepointed.

## ✅ v88_p — the walkthrough's Next actually walks, and the ▶ reaches the storyline screen

**User report**: *"The teacher play button should also be available on the storyline card, not just
on the main page. And it currently doesn't work, clicking play did open the first chapter progress
card, but it's next button just openend a question."* No new `ui.json` keys.

### ⚠️ The bug was mine, and `v88_o`'s own exit rule caused it

`walkGoto()` calls `showLessonSet()` → `goLessonSet()` → **`show('lesson-set')`** before rendering the
card. `v88_o` had added "navigating anywhere but the progress card ends the walk" to `show()` — and
that rule fired on the walk's OWN transit. So `APP_WALK` was already null by the time
`showComplete(true)` ran, `_walkApplyNav()` no-opped, and `comp-next` kept the learner's handler:
Next started a lesson instead of stepping to chapter 2. Exactly what the user saw.

Fixed with `_walkNavigating`, set for the duration of `walkGoto`'s own navigation only. The exit rule
still fires for every genuine departure — §6 still passes.

### ⚠️ The test could not have caught it, because the stub removed the bug

`unit-teacher-walk`'s seed contained `showLessonSet = async function(){}` — an empty stub, written
because "language/dir setup is not what this file tests". **That stub deleted the exact interaction
that breaks the feature.** Six sections passed against code that did not work when a human clicked it.

The stub now reproduces the real navigation (`show('lesson-set')`), and **§7 asserts the transit
happens** before asserting the walk survives it — so it cannot go quiet if the navigation is ever
removed. Reverting the fix now fails; so does restoring the empty stub, because §7's non-vacuity
check catches that too.

**The lesson is sharper than "the fixture was wrong".** Every stub is a claim that the stubbed thing
is irrelevant to what is being tested — and that claim is exactly what a navigation-ordering bug
falsifies. When stubbing a call that a feature makes *on its way to the state under test*, the stub
has to keep whatever that call does to shared state. Fourth "the fixture, not the assertion" finding
in this line (`v88_l`, `v88_n`, `v88_m`'s window, this).

### The storyline screen's ▶

Same walk, same teacher gate, in `#sl-screen-walk-btn` alongside the other header controls. The
screen already knows which storyline it shows, so `walkStorylineFromScreen()` needs no
data-attributes — unlike the library card, which is one of many on a page.

**⚠️ Gated on `APP._teacherMode` but NOT on `APP.info.canGenerate`**, unlike every neighbouring button
in that row. Walking reads chapters that already exist and makes no model call at all, so it works in
the static build too; gating it on a live backend would have removed it exactly where a teacher
reviewing published material would want it. The guard pins the absence of `canGenerate` deliberately,
so a later "make it consistent with its neighbours" edit fails loudly.

**Guard**: `unit-teacher-walk` grows to 8 checks. Four mutations red (the transit fix, the empty
stub, the screen button's teacher gate, and the screen entry point naming the wrong storyline).

## ✅ v88_o — a teacher walkthrough of a storyline's progress cards

**User request**: *"currently we only see progress cards in student mode. let's allow a teacher mode
access, started via a play button on the storyline card, and where there is NO locking/unlocking,
back/next buttons just lead through chapters, playing lessons is optional."* Six new `ui.json` keys.

### ⚠️ Built as an OVERRIDE, never a rewire — and that was the whole design decision

`showComplete()`'s Next/Back decision tree is the most expensive code in this client to get wrong:
the `§C1` gate analysis, `v77_card_gates.md`'s 32-row corrected truth table, and several releases
spent on it. So **not one existing branch is touched**. Every gate still computes exactly what it
computed before; `_walkApplyNav()` runs at the very END of the render — after all branches, just
before `_syncCompHdrNav()` so the header duplicates inherit the destinations — and REPOINTS the two
buttons. With no walk active it is a complete no-op.

That no-op is the load-bearing claim, and it has its own section: with `APP_WALK` null, a disabled
Next stays disabled, an un-wired one stays un-wired, and the styling is untouched. **A learner's card
cannot have changed**, which is the only way to add a mode to this function safely.

### The mode

`▶` on the storyline card (teacher-only) opens chapter 1. Back/Next are linear over
`sl.chapters` — no completion checks, no pass mark, no "next unfinished lesson", no locking. Lessons
stay clickable, so playing them is optional: the difference between previewing a course and taking
it. Forward is **disabled** on the last chapter rather than hidden (a vanished control reads as a
bug; a greyed one reads as "you are at the end"), and Back on chapter 1 leaves the walk for the
library rather than dead-ending.

**It records nothing.** Every chapter opens through `showComplete(true)` — the REVIEW render, whose
own comment says it "neither records progress nor shows per-round stats". A teacher paging through
cannot mark chapters complete or write into a learner's ledger. Not offered as a choice: a preview
that mutates progress would be a trap.

**Teacher-gated at BOTH layers** — the button renders only in teacher mode AND `walkStoryline()`
refuses independently. A mode that unlocks every chapter must not depend on markup for that.
Navigating anywhere but the progress card ends the walk, so a stale walk can never repoint the nav on
a card reached by another route.

### ⚠️ Two existing tests went red, and only ONE was caused by this release

- **`unit-storyline-lang-filter` — mine.** It read a 4000-char window from the group id, and the new
  header button pushed `FIXTURE_SUMMARY` past it, so it reported a MISSING summary against a
  perfectly good render. Bounded by the NEXT `slgroup-` now. **Third window-too-narrow bug in this
  line** (`v88_m`'s cancel coverage, `v88_n`'s order regex, this) — a fixed-size window over
  generated markup is a proxy, and it fails in the false-positive direction the moment the markup
  grows.
- **`unit-story-finished` — NOT mine, and the diagnosis is worth keeping.** It failed **8/8 against
  the live corpus and PASSED against `HEAD`'s** — deterministic, so not flakiness (protocol item 1).
  Cause: the user's own server had generated `tp_…0013` into **TWO** storylines — `sl_143869450`
  (6 chapters) and `sl_454402490` (1 chapter). Every section stands on the fixture storyline's LAST
  chapter and lets the card resolve its own deck via `_storylineForTopic()`, which returns the FIRST
  storyline containing that topic — the one-chapter one. The card correctly saw a finished
  single-chapter story, and §2's "an unfinished story does not open the finished card" asserted
  against the wrong deck entirely.
  **Fixed by selecting on the property**: the last chapter must belong to no other storyline. The
  old predicate (`>= 2 chapters, all with stories`) was a proxy for "the card will resolve back to
  THIS storyline", and a proxy fails in both directions.

**Guard**: `unit-teacher-walk` (6 checks) — the walk opens chapter 1 via the review render, next/back
step with no gating, both ends of the walk, the learner no-op, teacher-gating at both layers, and the
walk ending on navigation away. **Five mutations red.**

⚠️ **A note on the mutation-testing INSTRUMENT.** The first run of these mutations grepped the output
for `AssertionError` and reported one as GREEN — it had actually failed with a `TypeError`, which the
grep did not match. **A mutation harness that can report a false green is worse than not running
one.** Check the test's own verdict line (`ALL PASSED` / `FAILED`), never a grep for one error type.

## ✅ v88_n — item AR follow-up: a reverse-sort button, and a usability finding about the grouping

**User request**: *"please add a reverse sorting button."* One new `ui.json` key
(`lib.sort_reverse`, the button's tooltip).

### ⚠️ The report that came first, and what it actually was

The same message opened with *"selecting 'tokens', 'last edited' or 'generated' doesn't really change
the list"* — then the user corrected themselves: *"sorry it works, i didn't see it in the all
languages settings."* **Both readings were right, and the measurement explains why.**

Run against the REAL corpus (341 topics, 98 storylines), the three keys produce genuinely different
orders — **63 to 78 of 98 positions differ** between any pair. The sort was never broken. But the
PRIMARY key is source language (`srcOf(a).localeCompare(srcOf(b))`), because that is what the flag
headers group by, and the leading language groups are tiny (`ar` 2, `es` 2, `fr` 2). So in the
all-languages view the first several cards are **identical across all three keys** — `edited` and
`created` share their first five — and the top of the page, which is all you see without scrolling,
barely moves.

**This is a real usability finding, not a bug**: a global metric like token usage is being asked
"which stories cost the most", and the answer can sit anywhere down the page behind the language
grouping. Recorded here rather than acted on, because changing the grouping is a product decision the
user has not been asked. **If it comes up: the obvious options are to drop the language headers while
a non-default sort is active, or to sort globally and keep the per-card language badge (which already
exists) as the only language cue.**

### The button

`APP.libSortDir` (`'desc'` default — every existing order was already newest/highest first, so an
existing user sees no change until they press it), persisted like `libSort`, with the arrow reflecting
the state on every rebuild for the same reason the select does: the markup default is `▼`, so a
reload would otherwise show it while sorting ascending.

**⚠️ The direction flips the chosen KEY only, never the source-language grouping.** Reversing the
grouping would reorder the flag-headed GROUPS rather than the list the learner asked to sort — a
different and unrequested change. `_dir` multiplies `chainCmp`/`orphanCmp` and is deliberately kept
out of the `srcOf` comparison.

### ⚠️ Two mutations stayed GREEN, and the fixture was why

- **Applying the direction to the grouping too** — undetected, because the fixture had all three
  storylines in ONE source-language pair, so the grouping had nothing to reorder. A fourth storyline
  in a different source language (`sl_D`, `en`) fixes it: `de` sorts before `en`, so it must stay
  LAST in both directions, and reversing the grouping moves it to the front. The mutation now reports
  `DCBA`.
- **The toggle not flipping** — simply untested; `onLibSortDirToggle` had no assertion at all. Now
  pressed twice and checked both ways.

Both are the same lesson the `v88_l` idle guard taught two releases earlier: **when a mutation stays
green, the fixture is usually what is failing to cover it, not the assertion wording.** Adding the
fourth card also required widening the order-reading regex, which was `[ABC]` — it reported three
cards against a four-card render, the same "the extractor, not the feature" trap this file already
carried a comment about.

**Guard**: `unit-library-sort` grows to 9 checks. **Four mutations red**, including the two that were
green before the fixture was fixed.

## ✅ v88_m — every labelled job is actually cancellable (fixing what `v88_k` half-shipped)

**User report**: *"there is no cancel button yet in the jobpopover."*

**The button was there; their TAB was stale.** `server.js` serves `index.html` with `readFileSync`
per request, so a client edit is live without a restart — but an already-open tab keeps running the
JS it loaded. `curl http://localhost:3000/ | grep jobs-row-cancel` returned 3 hits, and the service
worker is network-first for the shell, so nothing was caching it. A reload shows the button. **That
half of the report needed no code change.**

### ⚠️ But investigating it exposed a real defect that `v88_k` shipped

Their live job list had exactly one running job — `Adding inflections lesson: "Graffiti im Verfall"`
— and **that job kind was NOT wrapped in `runCancellable`**. `v88_k` wrapped THREE of the EIGHT
labelled job kinds and shipped a cancel button for **all** of them. So on the job the user actually
had, the button would have appeared, flipped a status, left the model running, and toasted *"that job
had already finished"* — which is false.

`v88_k`'s own entry called this out as *"the rest cancel status-only — pre-`v88_k` behaviour, not a
regression"*. **That framing was wrong.** Before `v88_k` there was no button, so status-only cancel
was invisible; after it, every one of those jobs grew a control that lies. The entry stated the exact
principle it violated: *"a dead cancel button is worse than none, because the learner believes the
model stopped."* Shipping the button for eight kinds while wiring three made that true of five of
them.

### The fix

All eight labelled job kinds now run inside `runCancellable`, and each one's OUTER catch routes
through `jobFailOrCancel` so a deliberate stop settles as `cancelled` rather than `error`:
single-chapter `generate`, the QC sweep, add-lesson, recreate/add-storyline-lessons, the dialect
story (an inline async IIFE — wrapped in place), plus the three from `v88_k` (comic extract, comic
detect, analysis). Inner/validation `jobFail` calls are deliberately left alone: those are real
failures, not cancels.

### The guard is a SET-level claim, because that is what failed

`e2e-job-cancel` §5 walks `server.js` for every `newJob({ … label: … })` — a labelled job is by
definition one the popover LISTS and therefore offers a button for — and asserts each runs inside a
cancel scope. Source-level on purpose: no single running job can observe a claim about all of them,
which is exactly why `v88_k`'s per-job e2e passed while five kinds were unwired.

⚠️ **Bounded by the NEXT `newJob()`, not a fixed span.** The first version used a 60-line window and
reported add-lesson as unwrapped — its launch is 69 lines below its `newJob()`, with a long
`doGenLesson` definition in between. A window wide enough for that would start borrowing the
neighbouring route's wrap and go green for the wrong reason. A job's launch always precedes the next
job's creation, so that is the honest boundary. Mutation: unwrapping add-lesson again reports its
exact line.

### ⚠️ A tooling mistake that silently discarded work

Three of these wraps were applied and then **lost**: the edit script wrote the file only at the END,
so a later assertion failure in the same run discarded every earlier edit. The audit then showed them
missing and it looked like the edits had never matched. Fixed by writing per edit. **A batch editor
that commits once at the end turns one bad pattern into a silent rollback of everything before it** —
write incrementally, or verify after every run rather than after the batch.

## ✅ v88_l — item AU, idle release: models are freed after 30 minutes idle. **Item AU is now COMPLETE.**

**User's ruling**: *"release after 30 min idle is ok."* No `ui.json` keys. This is the third and last
piece of item AU — shutdown shipped at `v88_g`, per-job cancel at `v88_k`.

**The window was the user's to set, and that is why this waited.** Releasing means the next
generation pays a full model RELOAD; `keep_alive: -1` exists precisely to avoid that, and on a 35B
model it is tens of seconds before the first token. That is a tradeoff on THEIR machine, not a
default this code could pick. The design was written into item AU's entry at the `v88_k` handover so
the question could be asked once and answered in a line.

### What it does

`_lastLLMUseAt` is stamped in **`_callLLM`** — the one function every server-side model call
converges on, so "when was a model last used" is a single write rather than a survey of call sites.
Stamped **before the await as well as after**: a long generation is USE for its whole duration, and
stamping only on completion would let a 20-minute call look idle for 20 minutes.

An unref'd 60s interval checks the policy and reuses `releaseConfiguredModels()` wholesale (built for
the shutdown path at `v88_g`) — same de-duplication of the five role models, same parallel calls,
same no-op when `BACKEND === 'none'`. Unref'd like `llm.js`'s own guard timer: an idle sweep must
never be the reason a process refuses to exit.

Three guards on the policy, each with its own reason:
- **Never while a job is running.** A job can sit between model calls (assembling a prompt, writing
  the store, waiting on a poll), so "no call in flight" is NOT "idle" — without this, a long
  multi-step job has its models pulled out from under it mid-run.
- **Release once, not every tick.** `_idleReleased` stops the sweep hammering a backend that has
  nothing left to free.
- **New use re-arms it.** Otherwise the server frees its models once and never again for the rest of
  its life.

`IDLE_RELEASE_MS` / `IDLE_TICK_MS` are env-overridable — not a test backdoor: a deployment with
different habits can tune both, and `IDLE_RELEASE_MS=0` disables the sweep entirely.

### ⚠️ Two scoping bugs, both found by instrumenting rather than reading

1. **`bookJobs` is declared INSIDE `boot()`** (which opens at ~6002), unlike the module-scope `jobs`
   map — so `_anyJobRunning()`, living after boot's closing brace, threw
   `ReferenceError: bookJobs is not defined` on its very first tick. The throw happened inside a
   `setInterval`, so the only symptom the e2e saw was **"the release never happened"**, with no clue
   why. Fixed by publishing `_bookJobsRef` where the map is created; moving the map to module scope
   would have touched every book-job call site for no benefit. **`_idleTick` is now also wrapped in
   try/catch** — an exception on a bare interval is an UNCAUGHT one, and taking the server down for a
   VRAM optimisation is a far worse trade than skipping a sweep.
2. **A TDZ risk, avoided deliberately.** `_lastLLMUseAt`/`_idleReleased` are written by `_callLLM`
   (~line 150) but the policy lives ~9,700 lines below. A `let` referenced from above its declaration
   is a runtime `ReferenceError` — this codebase has shipped exactly that before (`v68.1`) — and
   "module evaluation finishes before the first request" is a reason it happens to work, not a
   reason to rely on it. The declarations sit beside their writer.

### ⚠️ A guard that stayed GREEN, and what it was failing to cover

The first version of the e2e's §1 started a job and checked for no release after 400ms — against a
1.2s window. **Removing the running-job guard entirely left it passing**: it was the WINDOW that had
not elapsed, not the guard doing anything. Rewritten so the fake holds its call open for 3s and the
wait deliberately CROSSES the 1.2s window while the job is still running, plus an assertion that the
job really is still running at that moment. The mutation now goes red.

That is the "when a mutation stays green, ask what the fixture is failing to cover" rule, and it is
the only section here whose first form proved nothing.

**Guard**: `e2e-idle-release` (4 checks, live server + fake Ollama) — a job outliving the window keeps
its models, an idle server frees them, it does not re-release every tick, and new work re-arms the
sweep. **Four mutations red.** The discriminator is the same as `e2e-shutdown-release`'s: a real
`keep_alive: 0` request on the wire, since a release and an ordinary generation are otherwise
indistinguishable.

### ⚠️ A note on process, recorded because it cost something

While debugging this, a server was booted MANUALLY with a 1.2-second idle window and **no
`LLM_BACKEND=none`** — so it connected to the user's REAL Ollama rather than the fake, and may have
released their loaded models. The consequence is benign (a reload on next use, exactly the tradeoff
being shipped) but it was careless: the protocol's rule about the user's own environment covers
starting servers, and a manual boot must force `LLM_BACKEND=none` or point `OLLAMA_HOST` at nothing.
The e2e harness was always safe — it points at the fake. **Manual boots are the hazard, not tests.**

## ✅ v88_k — item AU, cancel third: cancelling a job actually stops the model

**User request**: *"individual cancel buttons in the new 'running jobs' popover."* Three new
`ui.json` keys. **Item AU's third and last piece is IDLE RELEASE, still open** — see its entry, which
now carries the design work this cut did rather than a bare "needs a decision".

### What was actually broken

`POST /api/jobs/cancel` has called `job.abort()` since it was written — but **nothing in the codebase
ever SET `job.abort`** (one occurrence in the whole tree: the call itself). Cancelling flipped a
status field to `'cancelled'` while the request ran to completion. The popover said stopped, the GPU
disagreed, and the next job queued behind one nobody wanted.

### ⚠️ The estimate in this item's own entry was wrong

It said *"the cost is the threading, not the mechanism, and it touches every generator"*. **Measured
before building**: `_callLLM` (`server.js:131`) is ALREADY the one function every server-side LLM
call converges on — its own comment says so — and it ALREADY uses `AsyncLocalStorage` to scope
per-async-context state, which is exactly what a per-job abort registry needs, three lines from where
it goes. 35 wrapper call sites funnel through it. **There is no threading; the scope carries the
handle.** Third self-correction in this line (see item AU point 3 and `v88_g`); the entry is fixed so
the bad estimate is not carried forward.

### The mechanism

`llm.js` publishes an aborter per request (`opts.onRequest`), in BOTH transports — `_callOllama` and
`callLLMStream`. Only the tutor streams today, but a cancel that silently skips one transport is
worse than none: the learner presses stop and watches a model keep running with no way to tell why.
Destroying the socket is the real mechanism — Ollama aborts generation when the client disconnects —
not a status flag.

`server.js` adds `_cancelALS`, mirroring the token meter directly above it. The store holds the ONE
request currently in flight, **replaced on each new call** — which is what the `think:false` retry in
`llm.js` needs, since that retry issues a SECOND request and cancelling must destroy the one actually
running. `runCancellable(jobId, fn)` runs a job body in that scope and wires `job.abort` to it.
`_callLLM` also **refuses to START a call once cancelled**, or a multi-step job (a book chapter, a QC
sweep) would keep issuing requests after the user pressed stop — each individually cancellable, none
of them wanted.

**A cancel is distinguished from a failure**, by an exported `CANCELLED` sentinel rather than by
regex-matching prose. Without it every cancel surfaces as `"Ollama network: socket hang up"` and the
job's error field lies about what happened. `jobFailOrCancel()` settles such a job as `cancelled`,
not `error` — a deliberate stop must not look like an alarming failure the user caused themselves.

**⚠️ A per-item catch will SWALLOW a cancel.** `_runComicExtractJob`'s per-panel `try/catch` exists so
one bad panel cannot lose the batch — and it turned a cancelled job into a DONE one with the
cancelled panel listed as merely errored. Found by the e2e, not by reading. It now re-throws on
`CANCELLED`. **`_runRecreateJob` has the same per-type shape and is NOT yet covered** — recorded
below.

### The button

Offered only for a genuinely running SERVER job (`kind:'job'`). Not for a draft (parked, not
running), a finished job (nothing to stop), the synthetic `tutor` entry (no server-side job at all —
`/api/tutor` is stateless, so the route would find nothing), or a `book` job (the separate `bookJobs`
store has its own `/api/book-job/cancel`, which this route does not reach). **A dead cancel button is
worse than none**, because the learner believes the model stopped.

The route now answers `{ok, stopped}`. `stopped:false` means it found nothing to abort — a real race,
since the popover polls every 3s and a job can finish between render and click. The client reports
the two differently: claiming "cancelled" when nothing stopped is the very bug this item fixes, and
doing it in the UI rather than the server would be no better.

### Guards

`e2e-job-cancel` (4 checks, live server) — a job in flight, the cancel **destroying the socket**
(observed as the fake's own `res` `'close'`, the only honest evidence: a server that merely relabels
produces an identical status and an identical 200), the job settling as `cancelled`, and honesty
about cancelling something unknown or already finished. `unit-jobs-cancel-button` (4 checks) — which
rows get a button, and the two reply cases. **Eight mutations red.**

`test/fake-ollama.js` gained a runtime `POST /__slow` control (hold a response open without
answering). ⚠️ It could NOT be an env var: the server's own boot-time `warmup()` is itself an
`/api/chat` call, so a fake slow from process start **hangs boot** — which is how the first two
versions of this test "failed" against correct code.

### Still open in item AU

**Per-item catches that may swallow a cancel.** `_runRecreateJob` has the same per-type `try/catch`
shape `_runComicExtractJob` did; it is not wrapped in `runCancellable` yet and not covered by a test.
Wrap it and re-throw on `CANCELLED` when its turn comes — and check any future job with per-item
error tolerance for the same thing. **Three of the labelled job kinds are wrapped** (comic extract,
comic detect, analysis); the rest still cancel status-only, which is the pre-`v88_k` behaviour and
not a regression.

## ✅ v88_j — item AR: sort the library by last-edit date, generation date, or token usage

**User request**: *"main page: sort saved stories/lessons (for selected language combinations) by
total token usage, generation and last-edit date."* Four new `ui.json` keys.

### ⚠️ The trap is not the sort

`loadSavedList()` sorted hard-coded (source language, then newest `updatedAt`), and adding a control
over that is small. The real hazard is that **`GET /api/lessons` is a WHITELIST projection** and does
not carry `generationStats`. A token sort built without adding a field there **works in the STATIC
build** — which ships whole topics and has the field for free — **and silently does nothing LIVE**.
That is the exact `v74_i`/`v79_n` failure, recorded in a comment at that very site, twice. One
pre-summed `tokens` scalar now rides in the projection (not the whole `generationStats` block, which
is far larger and whose other fields nothing in the list reads), omitted when zero so an unmetered
topic's payload is unchanged.

`unit-library-sort` §5 guards this at the SERVER SOURCE, deliberately: it is a claim about another
process's whitelist, and no client-side state can observe it.

### The decision that had a real answer

A storyline's "total token usage" is its **own `tokenUsage` PLUS its chapters'**. `addTokenUsage()`
records a deliberate ruling that storyline-level work (summary, storyboard, retitle, summary-QC) is
NOT spread across chapters — so the two are genuinely different numbers, and only their sum answers
"what did this story cost". The fixture is built so this is observable rather than assumed: chapter
**A** has the FEWEST chapter tokens (10) but the MOST in total (510, because its storyline carries
500 of its own), so "sum both" and "chapters only" produce different orders. The mutation that zeroes
the storyline bucket returns exactly the `BCA` the assertion message names.

The chain→storyline lookup is keyed by the chapter-id list — the same identity the renderer below
already recovers a storyline by (`matchSl`) — so the two agree by construction rather than via a
second hash of a projection, which is the `v75_f`/`v76_e` failure.

### Scope kept deliberately narrow

- **The source-language grouping is NOT part of the sort choice.** It is what the flag headers
  render, so folding it into the control would break the grouping, not just the order. The chosen key
  sorts WITHIN each language group — which is also what "for selected language combinations" asks
  for.
- **`edited` is the default**, because it is what the library has always done: an existing user sees
  no change until they ask for one.
- **Persisted** (`imp3_libsort`), like `libSrcFilter` — a chosen sort is a preference, not a
  per-visit decision — and reflected back into the `<select>` on every rebuild, since the markup's
  own default is `edited` and a reload would otherwise show the wrong label while sorting correctly.
- Storylines and orphans get the same key through parallel comparators; the ONE list builder does
  both, so there is no second ordering path to keep in step.

**Guard**: `unit-library-sort` (5 checks) — the three orders, the control reflecting the persisted
key, and the projection. **Four mutations red.**

⚠️ **A test-authoring note.** The first version of the order-reading helper scanned the markup for
`tp_` ids and reported an EMPTY order against a perfectly good render, because `data-chain` carries
topic NAMES, not ids. Keyed off `slgroup-sl_X` instead, and the helper now asserts it found all three
— a short list means the render failed, not that the sort is wrong, and those two must not be
confusable.

## ✅ v88_i — item AX: generate lessons from an existing storyline for a DIFFERENT source language

**User request**: *"Allow to generate lessons based on existing storylines and chapters, but for a
different source language. This could be a drop-down menu in the generation interface, with the same
choice as 'continue from'. This would skip the story generation part (otherwise via LLM, PDF, comic),
and start with the target language text."* Two new `ui.json` keys.

**Almost nothing here is new, which was the whole argument for building it.** `POST
/api/generate-book` already runs the entire downstream pipeline — translation into the new source
language, chapter titles, lessons, arc, storyboard, analysis — from bare `chunks`, and both the PDF
and image paths are nothing but "build chunks, POST". This adds a **fourth way to obtain those
chunks**: an existing storyline's chapter `story` fields. The target text is correct by construction,
so the "skip the story generation part" the user asked for is not a new code path — it is simply what
the chunks path already does.

**Resolved SERVER-side, and that is forced, not a preference**: the client's `savedList` projection
carries no story text at all (the same reason `/api/comic-extract` resolves `continuedFrom` on the
server). So the request is tiny — `{translateFrom: slId, lang, srcLang, …}` — and no story text
crosses the wire twice.

### The user's three rulings, each guarded

1. **Lineage carries the ID, not just the title.** `translationOfId` on both the chapter (the source
   CHAPTER's id) and the storyline (the source STORYLINE's id), plus `translationOfTitle` as a
   display snapshot that survives the source being renamed or deleted. The id stays authoritative and
   is never resolved against the title.
   **⚠️ Existing provenance was MEASURED before deciding, not assumed unsuitable.** `source` is
   `{author, url, licence}` — EXTERNAL attribution, rendered by `_provSrcBits` as an author/licence
   line; 339 of 340 topics have it `null` and the one that doesn't is an xkcd credit. Reusing it
   would conflate "who wrote the original work" with "which chapter of this app this came from" and
   corrupt both readings. `continuedFrom`/`continuedFromId` mean chapter-continues-chapter, a chain,
   not a translation. So: a dedicated field, as the user's second option allowed.
2. **`comicPanels` copied across, "for now".** ⚠️ This DUPLICATES image data inside `lessons.json` —
   exactly the `D4` violation **item A** exists to fix. Recorded in item A's own entry as well: its
   migration must treat a translated chapter as a **second reference to the SAME image**, not as its
   own copy, or the fix will silently double the storage it is trying to reclaim.
3. **The same-source-language case is REFUSED**, with an error naming the language. It would
   otherwise silently duplicate an entire storyline — every chapter, every lesson, a full multi-minute
   generation — and produce nothing the learner does not already have. A confusing no-op that costs
   model time is worse than an error. **The picker excludes it too**, so the refusal is a backstop for
   a stale form rather than the primary UX.

### The client

One dropdown on card 1 beside `#continue-select` — *"the same choice as 'continue from'"* — but its
OWN row, deliberately: extending a story and re-teaching it to a different speaker are different
acts, and one control offering both would make each harder to read. Picking a translation **clears
the continuation**, so `_genInputMode()`'s precedence (translate wins over leftover upload/paste
state) is never a silent surprise.

The picker offers only storylines whose TARGET language matches the form (their text is the text
being reused) and whose source language differs (the server refuses the rest). **It hides its own row
when nothing qualifies** — an empty picker is a question the learner cannot answer. Everything else —
arc, storyboard, analysis, skip-lessons — comes free from the wizard's ONE shared lesson card that
item AL made universal.

### Guards

`e2e-translate-storyline` (6 checks, live server + fake Ollama) — both refusals, one new chapter per
source chapter, **the target text reused VERBATIM** (the item's whole point), lineage by id at both
levels, and panels copied. `unit-translate-picker` (5 checks) — the picker's two filters, the
self-hiding row, the mode/count switch, the dispatch body, and the continue-from clearing.
**Ten mutations red.**

⚠️ Two test-authoring notes worth keeping. There is **no single-topic GET route** — `/api/lessons` is
a whitelist projection carrying neither `story` nor `comicPanels` — so the e2e asserts on the
PERSISTED STORE, which is the stronger claim anyway. And the first "nothing qualifies" fixture was
wrong: setting `srcLang='de'` does not empty the picker, because an `nl←en` storyline is a perfectly
valid thing to translate FOR German speakers. Getting that backwards is how a vacuity check ends up
asserting against a populated control.

**Not built, deliberately**: any UI that DISPLAYS the lineage. The ids are stored and
`/api/storylines` returns whole objects (so a storyline's lineage is already reachable), but the
topic projection does not carry `translationOfId` yet — adding it is the `v74_i`/`v79_n` whitelist
trap and belongs with whatever surface actually renders it.

## ✅ v88_h — the flake audit: `unit-observations-log` was never a load flake, and it was VACUOUS as often as it was red

The ⭐ item from the `v88` prompt's own "buildable now" list: *"audit the remaining known flakes the
way `unit-tap-word` was audited at `v87_i`."* Test-only change, no `ui.json` keys, no product change.

**The inherited claim was wrong, exactly as `unit-tap-word`'s was.** Every session prompt since
`v81_b` has said `unit-observations-log` *"fails under suite load, not standalone; reproduce 5-10×
before believing it."* Measured: it fails **standalone**, at roughly the same rate it fails in the
suite — 2/10, 3/60, 2/30 across separate batches. Load has nothing to do with it. That is the second
"known flake" in this project found to be a real defect rather than noise, and both were found the
same way: by instrumenting the failing assertion instead of re-confirming the label.

### The diagnosis, taken causally rather than statistically

The rate is low and VARIABLE (one 40-run batch passed clean), so sampling could never have settled
this. Instrumenting every failure printed the same thing:

```
{"type":"listen_type","exCorrect":"weg","tiValue":"","choices":4,"recorded":false}
```

`tiValue: ""` with `choices: 4` on a TYPED exercise. The section's own `answer()` helper asked
`document.querySelectorAll('.choice')` FIRST and took the MCQ branch whenever it returned anything —
but **`lib-dom`'s `querySelectorAll` matches over the tree parsed from `index.html` and does not
re-parse `innerHTML` assigned at runtime** (a limitation INTERNALS has documented for a long time).
So the four `.choice` nodes from the PREVIOUS exercise's MCQ render were still visible after
advancing to a typed one. The helper drove those, left `#type-in` empty, and `check()` correctly
graded the empty string as wrong — recording a "correct" answer as incorrect.

**Proven deterministically, not inferred**: a probe that renders an MCQ and then advances to a
`listen_type` reproduces it every time —

```
OLD driver -> {"drove":false}            {"seenChoices":4,"ti":""}
NEW driver -> {"drove":true,"path":"typed"} {"seenChoices":4,"ti":"lopen","correctCount":1}
```

**⚠️ The product is fine.** `check()` compares `normDiacritics(#type-in.value)` against
`normDiacritics(ex.correct)` and is correct. This was entirely a test-driver defect. Worth saying
plainly, because the `unit-tap-word` precedent makes "known flake → real product bug" the tempting
conclusion, and here it would have been the wrong one.

### The worse half: the section was VACUOUS on many of the runs it PASSED

The probe's `drove:false` is the finding that matters more than the red runs. The assertions sat
behind `if (droveRight) { … }`, so whenever the driver failed to drive, **both assertions were
silently skipped and the section passed having checked nothing**. Same root cause, opposite symptom —
and the invisible one had presumably been happening for as long as the visible one.

Both halves are closed:
- **`answer()` dispatches on the EXERCISE TYPE**, not on "are there `.choice` buttons" — the
  protocol's own rule (select by the property the section asserts, not a proxy for it), applied to a
  test's DRIVER rather than its fixture. The type list mirrors `check()`'s own typed branch.
- **`droveRight` is now ASSERTED**, with a message naming the offending exercise type and saying
  explicitly not to re-wrap it in an `if`. A driver that cannot drive is a finding, not a reason to
  check nothing.

`listen_type` lands second in ~4 runs in 30, so the typed path is genuinely exercised — the fix is
not vacuous either.

**Mutation**: reverting the dispatch gives 2 failures in 30 runs; with it, 0 in 30, and 30/30 again
after the vacuity assertion was added. Sampling ALONE would not have been conclusive (one pre-fix
batch of 40 passed clean) — the deterministic probe is what carries the claim.

### The other two named "flakes", and a wider finding

`unit-ui-journeys` and `unit-word-progress` were measured at **12/12 and 12/12 standalone**. Not
cleared — that is too few runs to call them clean, and this file's own rate would have survived 12
runs about a third of the time. They are simply **not reproduced yet**, and the prompt's claim about
them is unverified rather than disproven.

**⚠️ THREE OTHER TEST FILES SHARE THE DEFECTIVE DRIVER SHAPE** — `unit-question-nav`,
`unit-inflection-speak-lang`, `unit-tap-word` all branch on `if (btns.length)` before considering the
exercise type. `unit-question-nav` is the most exposed (navigating BETWEEN questions is exactly the
MCQ-then-typed sequence that triggers it) and measured 14/14 clean, so it is **not changed here**:
altering four test files on the strength of one file's evidence is how a cleanup becomes a
regression. Recorded as a follow-up with the exact shape to grep for (`querySelectorAll('.choice')`
ahead of any type check) and the deterministic probe that demonstrates it.

## ✅ v88_g — item AU, shutdown half: stopping the server frees model VRAM

**User request** (one third of item AU): *"we should free the occupied memory for unused models
(`ollama stop`) and when `server.js` is stopped."* The shutdown third only — per-job cancel and idle
release stay open, for the reasons in item AU's own entry. No `ui.json` keys.

### ⚠️ A correction to this session's own write-up, made before any code

Item AU's entry said **"`server.js` never calls `release()`"**. **That is wrong**, and it was written
by this session. `releaseOllamaModel` IS called, at `server.js:5629`, inside `generate()` — to free
the story model before loading a DIFFERENT lesson model. What made the false claim survivable is that
the call is guarded by `OLLAMA_LESSON_MODEL !== OLLAMA_MODEL`, which is **false in the default
configuration** (both default to `OLLAMA_MODEL`), so it never fires for most users and never appears
in a casual log. The original grep that produced the claim had filtered too aggressively.

**What genuinely did not exist** — verified by grepping `process.on(` / `SIGINT` / `SIGTERM` across
`server.js` and `llm.js`, and finding **zero matches**, rather than by inference — is a SHUTDOWN
release. Every `/api/chat` request llm.js sends carries `keep_alive: -1`, so a model this server
loads stays in VRAM indefinitely, including after the process is gone.

Rule 35 landing on this line's own documents: **a previous session's write-up is a claim, not a
measurement — including one I wrote an hour earlier.** Both the roadmap entry and the session prompt
were corrected in place before the fix was designed, because the wrong sentence would otherwise have
justified a wrong design (deleting a working mid-generation optimisation as "dead code").

### The fix

`process.on('SIGINT'|'SIGTERM')` → `shutdown(signal)` → `releaseConfiguredModels()` → exit.

- **De-duplicated.** The five role models collapse by default (translation and lesson both fall back
  to `OLLAMA_MODEL`), and releasing one name five times is four doomed round trips against a backend
  that may already be going away.
- **Reads CURRENT values, not boot-time ones** — `/api/models` can change them at runtime, and it is
  the models actually loaded that need freeing.
- **In PARALLEL.** `_releaseOllama` has its own 10s socket timeout, so five sequential calls would
  blow the deadline below on their own; these are independent one-shot requests.
- **Time-bounded, and exits either way.** The sweep races a 6s deadline. **Ctrl-C must stay
  responsive**: a wedged or already-dead Ollama would otherwise hold the process open for 10s per
  model. Failing to free VRAM is a far smaller problem than a server that will not die. A SECOND
  signal exits immediately (code 130) rather than queueing another sweep — that is what a second
  Ctrl-C means.
- **`BACKEND === 'none'` returns early**: nothing was ever loaded through `llm.js`, so there is
  nothing to free and no reason to make five doomed calls on the way out.

### The guard, and two harness changes it needed

`e2e-shutdown-release.test.js` boots a real server against the fake Ollama with **five distinct role
models, one of them deliberately duplicated**, and reads what actually went over the wire.

- **`test/fake-ollama.js` now logs `model` and `keep_alive`.** `keep_alive` IS the discriminator: a
  release sends `0` ("unload now"), an ordinary generation sends `-1`. Without it a release is
  indistinguishable from any other request. Purely additive — every existing consumer reads named
  fields off `opts`.
- **`test/lib.js` gained `stopServer(sig)`.** The first version of this test used `env.stop()`, which
  also kills the fake Ollama and deletes the chat log — so the very requests it exists to observe had
  nowhere to land, and it failed with "released nothing" against a CORRECT implementation. A teardown
  helper is not a signalling helper.

§1 is the non-vacuity partner: a running server must release NOTHING. Without it a test that only
counts releases at the end would pass on a server that releases constantly — a worse bug than the one
being fixed.

**Three mutations red**: removing the signal handlers (the pre-`v88_g` state); removing the
de-duplication (the doubled model freed twice); releasing only the story model (an incomplete sweep).

## ✅ v88_f — item AP: the `comic` branch of `ui.json` is now the `image` branch

**User request**: *"Let's rename the whole comic branch in `ui.json` to just 'image'. Uploading comics
is just a possible application of the tool. We don't need to mention comic in related `ui.json`
entries. Just image. Only for the panel-recognition, currently in German 'Automatische
Panel-Erkennung', we can use 'detect comic panels'."*

**The measurement made this far cheaper than the plan assumed.** 24 keys, but **only THREE whose
ENGLISH TEXT actually contained "comic"** — the other 21 carried it in the KEY NAME only. Renaming a
key preserves every translation it has; only CHANGED ENGLISH costs anything. Translations existed in
six languages (`en`/`pt`/`fr`/`de`/`it`/`es`, 122 cells); the other 27 languages were unfilled and
cost nothing. **The original plan's "22 keys, needs a budget" framing was true but misleading** — it
counted the renames, which are free, not the text changes, which are the actual cost.

**Six English strings changed**, and the user's own carve-out is one of them:

| key | was | now |
|---|---|---|
| `form.use_image` | 🖼️ I have a **comic page** image | 🖼️ I have an image |
| `form.image_help` | Upload a **comic page**, then drag… | Upload an image, then drag… |
| `form.image_choose` | 🖼️ Upload a **comic page** | 🖼️ Upload an image |
| `form.image_detect` | 🔍 Auto-detect panels | 🔍 **Detect comic panels** |
| `storyline.thumb_show_images` | Show the **comic** images instead… | Show the images instead… |
| `storyline.thumb_show_storyboard` | …instead of the **comic** images | …instead of the images |

The last two are NOT in the `form.comic_*` branch and keep their names — they were found by
searching VALUES rather than keys, and would otherwise have been the one place the old framing
survived. `form.image_detect` is the only string that gains the word, per the user's ruling that
there it does real work.

**Stale translations DELETED, per the user's ruling**, so `translate-ui.js` refills them rather than
leaving a translation describing a concept the English no longer names — the `unit-ui-verbatim-en`
precedent (`v71_k`). 30 cells dropped (6 strings × 5 languages); 16 keys per language carried across
untouched.

**⚠️ The static markup carries a duplicate of each English string** and had to be updated too:
`#use-comic-lbl`, `#comic-help`, `#comic-choose-lbl`, `#comic-detect-lbl` each hold an English
DEFAULT rendered before `loadUIStrings()` applies `ui.json` — and baked as-is into the static build.
Missing these would have left the old wording in exactly the place a first-time visitor sees first.
Not caught by any guard; found by grepping the rendered markup for the visible strings.

**Element ids, function names and CSS classes are UNCHANGED** (`#comic-panel`, `APP_COMIC`,
`comicOpenReview`, `.comic-story-panel`). The ask was about `ui.json` entries — what the learner
READS — and renaming internals would have been a large, guard-free diff with no user-visible effect.
Code comments describing the original comic use case are likewise kept: they are historically
accurate.

### ⚠️ The rename found a live hole in `unit-ui-key-exists`

Mutation-testing the rename produced a mutation that **stayed GREEN**: putting a since-deleted key
back into the client left the guard passing. The cause is that `CALL_RE` matches only a key that is
the WHOLE argument — `t('a.b')` — and the call site in question is a CONDITIONAL,
`t(auto ? 'form.image_review_save' : 'form.image_review_confirm')` (introduced at `v88_c`), so
**neither branch was ever checked**. There are **six such sites in the client, twelve keys**,
including the two `storyline.thumb_*` keys this very release edited. The guard's headline claim —
"every key the client asks `t()` for exists" — was simply false for that shape.

Closed with a second pass that scans the argument list of every `t(` call for key-shaped literals,
bounded to the call's own parentheses and restricted to the conditional shape `CALL_RE` cannot see.
Sweep count went 606 → **616**. It carries **its own non-vacuity assertion** (`condFound >= 8`),
because the first pass's count cannot show that the second one still matches anything, and a
silently-empty second pass is precisely the regression it exists to prevent.

Three mutations red: each ternary branch un-renamed (the case that used to pass), and the second
pass silently matching nothing.

**The lesson generalises past this file**: a sweep's regex defines what it actually covers, and
"every X" in a guard's message is a claim about the regex, not about the code. Mutation-testing the
FEATURE is what exposed it — reading the guard would not have.

## ✅ v88_e — items AY + AZ: a comic chapter's three views no longer disagree about what to show

**Two live bug reports, mid-session, on a chapter the user had just made.** Taken ahead of item AP
(the `comic`→`image` rename, which moves to `v88_f`): a defect in real usage outranks a mechanical
rename, and AP's key set is unaffected by the delay. **No `ui.json` keys.**

**User report 1**: *"in the progress card of `tp_17882535928630000095` the vocab-highlight does not
show text, while the translation and text-analysis view do show text."*
**User report 2**: *"perhaps related: while text-analysis is running, the text is not shown in the
original story language vocab-highlight view, while the image is not showing in the text-analysis
view (which shows the `[qwen3.6:35b-a3b] CP2: analysing 2 sentence(s)…` message)."*

**They are related, and the user's hunch was right about the first half — but they are TWO defects.**

### Item AY — the per-panel renderer only ever read `caption` + `inScene`

`_comicStoryPanelsHtml()` builds each panel's body from `[p.caption, p.inScene].filter(Boolean)`.
The reported chapter is **description-only**: read from `lessons.json`, `comicPanels[0]` has
`caption: ''`, `inScene: ''`, and — because it predates `v88_d` — **no `description` field at all**;
its story came from `v87_l`'s image-description fallback. So the default view had nothing to render
and produced an image with no text, while the translation view (`o.text != null`) and the text
explorer both bypass the per-panel path and show the flat story. **That is exactly the asymmetry
reported**, and report 2's first half is this same bug with nothing to do with analysis timing.

Two halves to the fix, because the chapter needs both:
- **`_comicStoryPanelsHtml` now honours the description fallback**, mirroring `_comicPanelText()`'s
  own rule so the renderer and the chapter-formation path stop deciding separately what counts as a
  panel's text. This serves chapters created from `v88_d` onward, which persist the field.
- **`_comicPanelsHaveText(d)` gates the per-panel branch.** When the panels contribute nothing at
  all — every chapter created before `v88_d`, including the reported one — the per-panel pairing has
  nothing to pair, and the flat rendering (image strip + the whole highlighted story) is strictly
  better. It is also the shape the translation view already used, so the two stop disagreeing.

**⚠️ Fixing "no text" must not create "no image".** The ordinary highlighted path now carries the
panel strip too — but **scoped to `o.text == null`**, deliberately: the panels describe `d.story`
specifically, so a caller SUBSTITUTING different text must not get an image strip wrapped around it.
That is a standing ruling `unit-comic-story-panel` §3 has pinned since `v85_n`, and the first cut of
this fix broke it. **The existing guard caught it** — which is the argument for that assertion
existing at all.

### Item AZ — the explorer's TRANSIENT states dropped the image

`_textExplorerBodyHtml()`'s four early returns (`loading`, `analyzing`, `error`, no chapter id)
returned a BARE `<p class="te-status">` with no `_comicPanelsFlatTextHtml` wrapper, while the two
settled states have always had one. So a comic chapter's panel image vanished for the whole of a
multi-minute CP2 run and reappeared only when it finished — precisely report 2's second half.
**Same class as `v87_k`**: a surface that short-circuits the shared renderer silently loses
everything that renderer grew. One `status()` helper now routes all four through it;
`_comicPanelsFlatTextHtml` is a no-op without `comicPanels`, so non-comic chapters are unchanged.

### A proxy assertion, replaced rather than re-pinned

`unit-tutor-selection` asserted the literal source spelling `wrap(_storyParasHtml(` as its stand-in
for *"the selection wrapper is applied via the shared renderer, not per-caller"*. The AY refactor
kept that claim perfectly true and broke the regex anyway — **a proxy fails in both directions**
(the `v87_i` rule, from a new direction). Replaced with the actual claim: `wrap` is defined inside
the renderer, the renderer returns through it, and **every emission of `data-tutor-select="1"` is a
renderer's own `wrap` definition, never inlined at a call site**.

Note what the first attempt at that got wrong: asserting the marker appears EXACTLY ONCE. It appears
twice for good reason — `_comicStoryPanelsHtml` has legitimately had its own `wrap` since `v85_n`.
"Not per-caller" is not "not more than once", and a guard that conflates them would block a correct
change later. Mutation-tested both ways: inlining the marker at a call site goes red, and so does
removing the wrap from `_storyBodyHtml`.

**Guards**: `unit-comic-story-text.test.js` (7 checks) — the reported chapter rendered end to end,
the three views agreeing, a chapter WITH lettering still getting per-panel pairing (non-vacuity, or
the fix would collapse `PLAN §2.4` milestone 4 entirely), a description-only PANEL, a non-comic
chapter untouched, and the image surviving all three transient explorer states plus the settled one.
**Five mutations red**, plus two more on the corrected tutor assertion.

## ✅ v88_d — item AO (an extraction started on a phone is no longer lost) + item AN (a typed title no longer destroys the image description)

Row 3 of the thirteen-TODO order: the data-loss pair, in the region `v88_c` had just settled. **One
new `ui.json` key**, `en` only, on the budget the user granted. **Both items turned out to have a
cause nobody had reported**, found by reading the code around the reported one.

### Item AO — three causes, and the reported one was the least important

**User report**: *"I keep losing extracted text, when text extraction is started on the mobile phone.
The job is listed in the job popover but has no link associated, and clicking on the comic draft job
opens the generation page without the extracted text. The job popover link should lead to the text
confirmation popover of the text extraction routine."*

**All three had to close, or the report recurs:**

1. **The job carried no `link`.** `POST /api/comic-extract` called `newJob({ label })` with nothing
   else, and `_jobsRenderList()` renders "open →" only `if (j.link)`. This is the half the user could
   SEE, and `newJob()`'s own comment had predicted it ("comic extraction/detection … simply carry
   `link:null`").
2. **`_comicExtractCheckOnce()` is the ONLY writer of `APP_COMIC.boxes[i].text`.** When the tab that
   started the job is gone — phone locked past the browser's tab eviction, page reloaded, app
   switched away and killed — nothing ever applies the result. The panels sit in the job store, the
   draft still holds the image and the boxes, and the expensive vision work is simply gone. **This is
   the actual loss**, and it is NOT item AE (that one is about a *live* tab that was backgrounded;
   this is a tab that no longer exists).
3. **`jobDone()` schedules cleanup at FIVE MINUTES.** So closing (1) alone would have produced a link
   that works briefly and then silently stops — **worse than no link at all**.

**So the durable fix is SERVER-side**: `applyExtractionToDraft(draftId, panels)` writes the results
onto the draft as the job finishes, index-aligned exactly as the client's own
`_comicApplyExtraction()` does. **Called BEFORE `jobDone()`** — that call starts the five-minute
timer, so the durable copy must already exist by the time the job is observable as finished. After
this the draft is the record: resuming it from any device carries the text, with no window and no
dependency on the originating tab.

The client **flushes the draft before extracting** (`await _comicDraftSaveNow()`), because the
autosave is debounced 1.5s and extraction is precisely the moment where "the draft might not exist
yet" costs the whole result. The link carries both ids — `id` (the job, instant) and `draftId` (the
draft, durable) — and `_jobsOpenComicExtract()` **prefers the draft**, falling back to the job store
only when there is no draft id. It opens the review card in **AUTO mode** (item AQ, `v88_c`): nobody
arriving from the popover has seen the wizard's lesson card, so confirming must save and continue,
never start a generation with card 3's controls at their defaults. `v88_c`'s fix composes here
without changes — a second entry point, same reasoning.

### Item AN — three losses, of which the user had only found one

**User report**: *"image upload bug: I lost an already generated image description, perhaps because I
added title 'De Manteling' in `tp_17882063882590000007`."*

**Reproduced from the stored data, not the report.** That topic has `story: "De Manteling"`,
`comicPanels[0].caption: "De Manteling"`, `inScene: ""`, and **no `description` field at all**.

1. **The card had no title field**, so the user typed a title into CAPTION — and `_comicPanelText()`
   reads caption as extracted lettering, which SUPPRESSES the description (their own earlier ruling:
   the description is a fallback *"if no text is extracted"*). Working exactly as ruled; experienced
   as data loss. **User's ruling this cut**: a separate TITLE field, which keeps caption meaning
   "text lettered in the panel" and leaves the earlier ruling true rather than reversing it.
2. **`comicCreateChapter()`'s `comicPanels` never wrote `description`.** So even on the fallback path
   where the description WAS the chapter's text, the description itself survived nowhere. No ruling
   blocked this; fixed unconditionally.
3. **⚠️ `POST /api/drafts`'s box whitelist never listed `description` either** — found by READING
   that route while wiring item AO, not from any report. Every autosave through it stripped the
   field, so a description-only panel saved as a draft and resumed came back with nothing to make a
   chapter from. **It would also have quietly undone item AO's whole durability story**: the server
   writes the descriptions onto the draft, and the client's very next autosave would have deleted
   them again. This is the `v74_i`/`v79_n` whitelist failure in a third place.

**A fourth, prevented rather than found.** The e2e exposed that a job result REPLACES the whole
`text` object, so a re-extraction would delete a title the user had typed — item AN's own loss,
reintroduced through a different door. Both writers (`_comicApplyExtraction` client-side,
`applyExtractionToDraft` server-side) now carry the title forward. **They had to be fixed together**:
if only one did it, the outcome would depend on which writer happened to run.

**A typed title is AUTHORED.** It becomes the chunk's title, travels as `titleAuthored`, and is
stamped `topicAuto: false` on the saved topic; `_applyChapterTitles()` skips those. Without it the
user would type a title, watch it save, and find it silently replaced by the post-pass minutes later
— a new instance of exactly the loss this item closes. This mirrors the ruling `titleAuto` already
encodes for STORYLINE titles (`v80_l` / `PLAN §9c`, *"a hand-named book would be retitled by the
post-pass"*), which is why the flag has the same shape and name. The skipped chapter's name is still
reserved against collisions, so a later auto-titled chapter cannot be given it.

New key: `form.comic_title_ph` = `Chapter title (optional)`.

### Guards

`unit-comic-extract-durable` (4 checks — the flush-and-send, the link's two branches, and the
whitelist), `unit-comic-title-field` (6 checks), `e2e-comic-extract-draft` (4 checks, live server +
fake Ollama, driving the REAL `/api/comic-extract` route — no test-only endpoint and no
re-implemented job runner). **Nine mutations, all red.**

**⚠️ Two layers were genuinely needed, and a mutation proved it.** Removing `description` from the
draft whitelist left the e2e GREEN at first, because `applyExtractionToDraft` writes to the file
directly and bypasses the sanitiser. The unit's source-level section caught it; the e2e was then
strengthened to round-trip through `POST /api/drafts` (the real autosave path) so it catches it too.
Neither layer alone covered the claim.

**⚠️ A harness trap worth remembering.** `lib-dom`'s `src` is a PLAIN PROPERTY — assigning it never
fires `onload`, and `_resumeComicDraftFrom()` awaits exactly that event. Without a shim the resume
promise never settles and **everything after the await is unreachable**. That is a SILENT trap, not a
loud one: the boxes are restored BEFORE the await, so a section asserting only on `APP_COMIC.boxes`
passes while the rest of the function never ran. `v88_c`'s own §6 sits on the right side of this by
luck; this file installs the shim explicitly.

## ✅ v88_c — item AQ (the auto-opened review card no longer generates a whole book) + item AM (upload pre-selects the whole image)

Row 2 of the thirteen-TODO order. Both live in the same ~400-line region of `index.html`
(`_comicFinishSetup` / `comicOpenReview` / `_comicReviewConfirm` / `comicCreateChapter`), which is
why they shipped together rather than as two reads of the same code. **One new `ui.json` key**, `en`
only, on the budget the user granted.

### Item AQ — the reported bug, and its second half was the same bug

**User report**, with the server log attached: *"the generate chapter button after image text
extraction automatically starts the book generation, and the next button leads to a lesson selection
site that has no generate button at all. … we want that button to just store chapter text as draft,
no lessons yet. Translation, lessons, titles etc. should ONLY be generated on the third page."* The
log showed a full run — `Translating story to German…`, `arc=[review]`, `Lesson 1/1` — on text the
user had not finished reviewing.

**Diagnosed exactly.** `comicOpenReview(auto)` is reached TWO ways and **the `auto` flag never
reached `_comicReviewConfirm()`**, which called `comicCreateChapter()` unconditionally:

- from **`#gen-btn` on wizard card 3** (`doGenerate()`'s comic branch) — where confirming SHOULD
  generate: the learner has just chosen lesson types and pressed the start button;
- **automatically from card 2**, the instant extraction succeeds (`_comicExtractCheckOnce()`'s
  `comicOpenReview(true)`, added at `v86_v`) — where the learner has **not seen card 3 at all**, so
  `#gen-skip-lessons-cb` (which lives THERE) was still at its default and `comicCreateChapter()`
  read that as "generate everything".

**⚠️ The vanishing card-3 button is the SAME defect's second half, not a separate one.**
`comicCreateChapter()` sets `_comicBookId`; `_applyLessonCardUI()` then computes
`busy = mode==='comic' && _comicBookId`, `startable = n>0 && !busy`, and hides `#gen-btn-row`. Card 3
was correctly showing no start button, because a book job really was running. Nothing there needed
its own fix — §1's `_comicBookId === null` assertion pins that it stays available once the first half
is fixed. **This is worth remembering as a shape**: two symptoms one navigation apart, one cause.

**The fix** is a module-level `_comicReviewMode` (`'auto'` | `'generate'`) set at open and read at
confirm. The write-back of the edit buffer is shared; only the ENDING differs. The auto path
`_comicRenderList()`s — which is what PERSISTS the reviewed text, since every `APP_COMIC.boxes`
mutation funnels through it and it calls `_comicDraftSaveDebounced()` at the top (item R follow-up) —
then `_genWizardGoto(3)` and stops. So "store the chapter text as draft, no lessons yet" is
satisfied by machinery that already existed; nothing new persists anything.

**One new key**: `form.comic_review_save` = `✅ Save text & continue`. The existing
`form.comic_review_confirm` (`✅ Confirm & create chapter`) would be a lie on the auto path, and a
button that misdescribes its own effect is how this bug reached a user in the first place. The card-3
path keeps the original string.

**⚠️ Guarded at the BEHAVIOUR layer, not the source layer** (protocol item 5). The sections COUNT
`/api/generate-book` requests issued by the REAL `comicCreateChapter()` under a stubbed `fetch` —
"no generation happened" is a state, and a source-level check of which function
`_comicReviewConfirm` names could not fail for it. §3 is the non-vacuity partner: without it,
"never generate" would pass §1 and §2 while breaking the feature outright.

**Mutations, all red**: removing the fix (the reported bug returns); inverting the mode (each path
does the other's job); returning without `_genWizardGoto(3)` (the user is stranded on card 2 with
their text saved and nowhere to go); making the label mode-independent again.

### Item AM — a fresh upload pre-selects the whole image as one panel

**User request**: *"Upon image upload, let's pre-select the whole image as one panel, as if the button
associated with `form.comic_single_panel` had been pressed already."*

One call to the pre-existing `comicUseWholeImageAsPanel()` (`v86_d`, item J) at the end of
**`_comicFinishSetup()`** — the fresh-upload path's one choke point, reached by BOTH branches of
`onComicFileChosen()` (downscaled and not). Nothing is taken away: drawing a box, auto-detecting, or
pressing the button itself all REPLACE this, because `comicUseWholeImageAsPanel()` and
`_comicApplyDetectedPanels()` both replace rather than append. The commonest upload is one photo of
one thing, for which the whole image IS the panel — the old default (no panels, every downstream
control inert) made the common case do the most work.

**⚠️ The placement is the whole risk, and it is guarded through the REAL function.**
`_resumeComicDraftFrom()` deliberately does NOT route through `_comicFinishSetup()` (its own comment
says why: `comicClearPanels()` there would discard the boxes a draft exists to restore). Put the
pre-select anywhere more general and a resumed draft's panels are replaced by one giant box.
**Mutation-tested by actually adding the call to the resume path** and watching §6 go red — not by
reasoning about where the call sits. That mutation also required making the section's `fetch` stub
URL-aware: the real resume path calls `loadSavedList()`, which needs ARRAYS, and a one-shape stub
killed the path before it restored a box — i.e. the section would have been **vacuous**, passing for
the wrong reason.

**This is also the per-image act item V now needs.** The user's ruling on multi-image upload — *"if
multiple images are uploaded, mark all images as one panel, but still allow the user to modify, add
and resort panels. each panel is one chapter"* — is exactly this behaviour repeated per image, over a
panel list that stays editable, feeding `comicCreateChapter()`'s existing one-chapter-per-panel
formation (`v85_p`). **Item V is fully specified and no longer blocked**; it is now mostly a question
of the draft shape holding more than one page.

## ✅ v88_b — item AW (an ALL-CAPS word is spoken, not spelled) + item AT (synchronous LLM routes appear in the jobs popover)

**The first release off the thirteen-TODO handover.** Both were picked for the same reason: no user
decision stands behind either, they live in unrelated regions so they cannot interact, and each
closes a report the user could otherwise hit again the same day. **Neither costs a `ui.json` key** —
item AT deliberately reuses seven labels that already existed.

### Item AW — `_ttsSpeakableText()`

**User report**: *"For the word ONTEIGENINGSZONE in the extracted text of `tp_17880367188140000070`,
the readout of the full text reads this all-caps word letter by letter. Is there a simple way to
avoid this? For example, all-caps words longer then 3 letters should be read out as a word?"*

The cause is the speech engine's own heuristic — a run of capitals is an initialism, so spell it —
which is **correct for BBC or EU and wrong for a photographed sign that simply shouts**. Nothing in
this codebase was doing anything wrong; the input simply looked like an initialism.

**Shipped exactly the user's own rule**: a run of **four or more** capitals is a word. Three-letter
runs are untouched, precisely because that is where the genuine initialisms live.

**One fix site, and that is a measured claim, not a convenience.** `_ttsMakeUtterance()` is the ONLY
place in the client where any text becomes a `SpeechSynthesisUtterance` — verified by reading every
caller, not by grepping for the constructor: `_doSpeak` and `_doSpeakLang` both funnel through
`_speakChunks`, `_doSpeakLangThen` through `_speakChunksThen`, and `_speakAndAdvance` calls it
directly. `_ttsChunks()` splits on SENTENCE boundaries, so a chunk can never arrive with a word cut
in half and the transform can safely run per chunk.

**TITLE-cased, not lower-cased.** Both defeat the spell-it-out heuristic completely; title-casing
changes the string less (a capitalised German/Dutch noun stays capitalised, a sentence-initial word
does not suddenly start lower-case). Engines do not pronounce on case beyond this heuristic, so the
smaller edit is the safer one.

**§4 compliance is the reason this is allowed to exist at all.** `\p{Lu}` is Unicode machinery, not
a hand-authored table, and the rule is orthographic rather than about any one language — the "no
language knowledge in the code" tier test. Caseless scripts (Japanese, Arabic, Devanagari) cannot
match it and are returned byte-identical; Greek and Cyrillic are handled by the same rule with no
ASCII assumption. All four are pinned.

**⚠️ It is a SPOKEN projection and nothing else.** The rendered surfaces must go on showing
ONTEIGENINGSZONE — a sign that stops looking like a sign is a worse bug than the one being fixed.
`unit-tts-allcaps` §3 pins this at the SOURCE layer (exactly one call site, and it is inside
`_ttsMakeUtterance`) deliberately: "no renderer calls this" is a claim about a SET of call sites,
and no single rendered fixture can observe it.

**Mutations, all red**: removing the call site (fix present but unreachable — §1 alone stayed green,
which is exactly why §2 exists); lowering the threshold to 3; swapping `\p{Lu}` for `[A-Z]`.

### Item AT — `_jobsTracked()`, an in-flight registry for synchronous routes

**User report**: *"Storyline title re-generation did not appear in the running job popover. It
should."*

**The popover was not failing to show the job — the job did not exist.**
`POST /api/storyline-retitle` is FULLY SYNCHRONOUS: it awaits `generateChapterMeta()` /
`generateStorylineTitle()` inline and returns the result, never calling `newJob()`. So `GET /api/jobs`
has nothing to aggregate. **Measuring that turned one report into five routes**:
`/api/storyline-title`, `/api/storyline-summary`, `/api/retranslate-story` and
`/api/writing-feedback` have the identical shape. Retitle is merely the one the user happened to sit
and wait on; the other four were equally invisible and unreported.

**Fixed client-side, following the precedent the tutor entry already set** for exactly this
situation (a real request the server's job store was never built to represent — streaming, no
persisted id). `_jobsEffectiveList()`'s tutor one-off is generalised into a registry any awaited call
can join. **`_jobsTracked(label, fn)` uses `try/finally`, not `then`/`catch`**: a route that throws
(offline, a 500, a JSON parse failure) must still remove its entry, or a failed re-title parks a
permanent "running" row and a permanent badge count — strictly worse than the invisible job this
item exists to fix. Pinned by its own section.

**⚠️ The tutor entry is deliberately NOT migrated onto the registry.** Its source of truth is
`_tutorState.busy` — a flag that already exists, is set from two places, and survives a re-render —
and it is the only entry carrying a `link`. Re-expressing it as a registration would add a second,
weaker source for state that is already correct. Its existing guards (`unit-jobs-popover` §1/§2) are
untouched and still pass.

**Nine call sites across five routes.** `/api/storyline-title` alone has FOUR client callers
(`genStorylineTitle` from the library storyline card — most likely the exact control the user
pressed — `genLessonTitle`, `genSavedItemTitle`, `genStorylineTitleFromScreen`), and
`/api/retranslate-story` has two. **Three of those were found by the guard, not by reading**: the
first pass wrapped one caller per route and `unit-jobs-sync-inflight` §5 went red naming the offset
of the next. That section is the reason the release is complete rather than 60% complete, and it is
the one deliberately source-level section in the file — "no synchronous model-backed route is left
untracked" is a claim about a SET of call sites.

**Zero new `ui.json` keys.** Every label reuses a string that already existed, chosen so the popover
row and the surface that already reported the same work cannot drift: `retitle.working_title` /
`retitle.working_chapters` (the same strings `_doRetitle`'s own toast shows),
`lesson.generating_title` (the same string `setTitleGenStatus` shows), `lesson.gen_topic_title`,
`lesson.gen_summary`, `models.translation`, `ex.writing.grading`.

The batch re-translate (`retranslateChain`) is tracked **per chapter, not once around the loop** —
the loop is sequential, so one entry per iteration is what actually tells the user how far the batch
has got.

**Mutations, all red**: dropping the sync entries from `_jobsEffectiveList`; replacing `try/finally`
with a plain `await` (the phantom-job leak); unwrapping one call site; making the synthetic ids
collide.

**⚠️ Recorded for whoever takes item AU.** Converting these five routes to real jobs is the other
option and is the RIGHT one if per-job cancellation is ever built, because a cancel button needs a
server-side job to cancel. That decision is written into both the code comment and item AT's own
entry so it is not re-derived from scratch.

## ✅ v88_a — storyline chapter management: re-order, split off, add existing. And the v88 line cut.

**User request** (the three remaining items from a four-part message; the first, item AC, shipped at
`v87_m`): *"Allow to re-order chapters of a storyline. Allow to split off storyline's chapters into
separate storylines, choose a generic name ('orphaned from <title>') for the split-off storyline.
Allow to add existing chapters to a given storyline, via a dropdown menu on the teacher view
storyline card, same as the 'continue from' selection in the generation wizard's first page."*

**Three rulings taken before building** (at the `v87_m` scoping): re-ordering **re-links
`continuedFromId`**, not just the array; adding a chapter **adds without removing** it from its
current storyline; and the four features ship as **separate releases**.

**Why the whole operation is SERVER-side.** `storyline.chapters` is an ordered array that is BOTH
membership and order, and `POST /api/storylines` already upserts it — so the tempting reading is
"this is all client work". It is not: a re-order also rewrites `continuedFromId` across SEVERAL
topics, and a half-applied chain is worse than no re-order at all. Two new routes do each operation
atomically:
- **`POST /api/storyline/chapters`** `{slId, chapters[], relink?}` — sets the order, optionally
  re-links. Serves BOTH re-ordering and adding, because they are the same write.
- **`POST /api/storyline/split`** `{slId, fromIndex}` — moves `[fromIndex..]` into a new storyline
  named `"orphaned from <title>"`, the user's own wording.

**⚠️ The re-linking rule, and why forks survive it.** The storyline SCREEN draws a tree from
`continuedFromId` while the main page uses the array, which is exactly why the user ruled that a
re-order must re-link — otherwise it would look like it did nothing on the screen. The rewrite is
scoped to THIS storyline's own chapters:
- `chapter[i]` continues `chapter[i-1]`.
- **`chapter[0]` keeps the storyline's EXTERNAL parent** — taken from whichever chapter was first
  BEFORE the shuffle, so a storyline that continues another storyline is not cut loose merely because
  its chapters were reordered. An "external" parent that is itself one of these chapters is ignored,
  or position 0 would silently recreate the old order.
- **A chapter in ANOTHER storyline that continues one of these is left completely untouched.** Its
  link still resolves (the chapter still exists), so a fork keeps both branches. This is what made
  the user's chosen option safe without the "refuse on forks" fallback they were offered, and it is
  pinned by its own e2e section rather than argued for in a comment.

**Split**: the moved head is detached (`continuedFromId = null`) — it is no longer a continuation of
what it was split away from, which is the whole point — while the rest of the moved run keeps its own
internal links, so the new storyline arrives intact rather than as loose chapters. `fromIndex` 0 is
REFUSED: it would move every chapter and leave an empty storyline behind, i.e. a rename pretending to
be a split. Ghost ids, duplicates, an empty list and an unknown storyline are all refused too — a
storyline listing an id that resolves to nothing renders as a gap and breaks "last chapter" lookups,
which is one way a continue button can silently vanish.

**Client**: ONE teacher-only panel on the STORYLINE SCREEN, collapsed behind a `⇅` until asked for,
because that is where the chapters are — a re-order needs the list in front of you, and `v87_n` was
the lesson about putting a control somewhere other than where the user is looking. Each row carries
`↑`/`↓`/`✂` with the boundary buttons disabled rather than silently failing; the add-picker offers
every saved chapter except the ones already here, newest first, matching the "continue from" shape the
user named. All three operations funnel through one `_slChaptersPost()` that posts, reloads, and
**re-derives the chapter list from the stored storyline** rather than reusing the screen's opening
snapshot — otherwise a moved or split chapter renders in its old slot.

**The two operations differ only in what they SEND**, which is where the rulings actually live:
re-order posts `relink:true`; adding posts no relink at all, because joining a storyline is a
membership change, not a re-sequencing, and the chapter may still legitimately belong elsewhere. Both
are pinned by the unit test, and mutation-testing each direction goes red.

**`ui.json`: three new `en` keys** (`sl.manage_chapters`, `sl.add_chapter`, `sl.split_here`), per the
user's own choice of three over six — the `↑`/`↓` arrows carry no tooltip (self-evident) and a
successful split shows no toast (the panel re-renders with the chapters gone and the new storyline
appears in the library). 730 → 733.

**Tests**: new `e2e-storyline-chapters.test.js` (6 sections, real spawned server: re-order moves array
AND chain with the external parent preserved; a fork in another storyline is untouched; add joins
without leaving and without re-linking; ghost/duplicate/empty/unknown all refused; split naming, head
detachment and tail integrity; split bounds) and `unit-storyline-chapters.test.js` (8 sections, the
panel's gating, contents and — the load-bearing part — the exact request bodies). FOUR mutations
confirmed red, each caught by the right layer: dropping the external parent and leaving the split head
attached fail the e2e; dropping `relink` from a re-order and adding it to an append fail the unit test.

**This release also CUTS THE v88 LINE**: `roadmap_v88.md` created from `roadmap_v87.md`'s last commit
per protocol item 7, carrying the protocol block (now with three new items earned across the `v87`
line), the genuinely-open items, the findings, `§0`/`§0i`, the standing RULES, TRACK T and THE LARGER
PLAN — and NOT the `v87` shipped section, which stays in `roadmap_v87.md` as that line's record. Six
items that the `v87` line closed (R, U, Z, AC, AK, AL) were dropped from the carried open list rather
than carried as ✅ entries: they are recorded where they shipped.

---

# TRACK T — THE TEXT-FOCUSED PROGRESS CARD (user, at the `v80_f` cut)

*The user's third focus shift on the progress card. Recorded here at the moment it was proposed,
with the measurements that were taken BEFORE any of it was designed — `v80_f` (the inflection share)
and the token-density numbers below. **This supersedes parts of §0 and `PLAN §C2`; what it
supersedes is struck THERE with a pointer here, never silently.***

## T0. The proposal, as given

- **MORE TEXT FOCUS.** The chapter text with highlighted vocabulary is visible on **all** progress
  cards of that chapter, **even before the text is unlocked**.
- Highlighted words are **tappable**, opening a random question associated with that word (vocab,
  word_forms, grammar, conjugation, synonyms…).
- The text is **progressively solved**: highlight goes **red → green**, red = no associated question
  solved, green = **all** associated questions solved. Comprehension unlocks only when every
  highlighted word is green (**or by pass-mark fraction**).
- **All question cards show the text too** (today only comprehension does), with the word or
  sentence currently asked **underlined** as well as coloured.
- **Drop** the chapter-wise progress bars and the progress-card copy ("Mach weiter",
  "Kapitel freigeschaltet!"). Keep the play buttons for now.
- Tapping a word opens ONE of its questions; after answering (right or wrong) the next question is a
  **randomly chosen different word** of the same text, but the learner may always tap another word.
  Revisiting a word **prefers questions not yet solved**.
- Mapping: **for now**, reuse the current highlighting; **for new lessons**, change the prompt so the
  model maps questions to exact words/phrases/sentences. Comprehension lessons should map their
  "why" explanation to the sentences it refers to.
- The learner can **select** a word/phrase/sentence and generate a lesson on it interactively (the
  model or tutor gets the chapter as context).
- **Later, for comics:** show the panels and project the highlights onto them — needs per-word
  **coordinates**.

## T1. VERDICT — extend, do not restart. Most of the machinery is already here.

| the design needs | what exists today |
|---|---|
| word → its questions | **`_storyWordSources(d)`** → `{word, lessonId, probes}` for synonyms, word_forms, grammar, conjugation |
| which words are solved | **`_solvedTargetWords`** + **`_solvedExtraWords`**, resolving `probes` through `qid()` against `_solvedMap` |
| two-tone highlighting | **`_highlightVocabHtml(html, words, strongWords)`** — already LIVE on the storyline chain panel |
| per-item solved state | `_lessonItemUniverse` / item keys (`v74_c`) |
| the text on a card | `_renderSummaryField`, `_storyParasHtml`, `furiHtml` |

**The red/green idea is already half-built**: today's dark shade means *any* question about the word
was answered. Nothing here justifies a new project. **Only the comic-panel coordinates are genuinely
new**, and they are cleanly isolated.

## T2. ⚠️ TWO OF THE PROPOSAL'S PREMISES DO NOT SURVIVE MEASUREMENT

**(a) ~~"Progress will be obvious from the greening text, so the bars can go."~~ ✅ RULED at the
`v80_n` cut: KEEP THE BARS FOR NOW.** The measurement below is why, and `v80_l` sharpened it: a
learner on a worked chapter would see ~12 highlighted words of ~189, of which ~1 is green. The text
cannot carry the progress signal on its own yet. **The bars stay; revisit only if highlight density
and the green share both rise.**
Measured: a chapter has **189 story tokens, of which 12.3 are highlighted — 6%.** Ninety-four per
cent of the text stays plain however much the learner solves. A learner at half-done sees six green
words. **Dropping the bars on this reasoning is not supported**; it may still be right for other
reasons, but it needs its own decision. **Do not treat T0's bullet as settled.**

**(b) "We can use the current highlighting to map questions to the text."**
It holds for **47.3%** of taught words and cannot be pushed past **~56.9%** by matching alone —
`v80_f`, above. **36.4% of taught words are ABSENT from the story in any form.** That is a
GENERATION problem, not a matching one.

**Consequence for T0's ordering:** the proposal treats prompt-side mapping as the *later* option and
matching as the *now* option. **The measurement inverts that.** Prompt-side mapping is the only
lever that touches the 36.4%, and it costs one prompt change instead of a per-chapter matcher.

## T3. What it SUPERSEDES — struck at the source, pointing here

- **§0e** vocabulary on progress cards, and **§0d**'s bars → subsumed by the highlighted text
  (subject to T2a).
- **`PLAN §C2`**'s third progress bar, bottom-row chapter title, and "text comprehension" labelling
  → the copy goes with the bars.
- **`v80_e`'s card copy.** "Kapitel freigeschaltet!" is named for removal. The merged starter card
  **survives as the container**; its title/copy does not. **`v80_e`'s structural win — one starter
  card per chapter — is NOT superseded** and this track depends on it.
- **§0c**'s walk partially collapses: if the text is on every card, the story-unlocked page stops
  being a separate destination.

## T4. What it makes MORE valuable, not less

- **`PLAN §8/B1`, the observations log — ✅ SHIPPED at `v81_j`.** Per-word question history is exactly
  what this design reads and exactly what the current `{seen, wrong}` counters cannot replay.
- **The pass mark** (owed by the user). T0's "or via pass mark fraction" makes it load-bearing:
  green-when-all is unreachable in practice if a word has many questions.
- **`PLAN §F2`/`§F3`** prompt QC: a malformed item is far more visible when it is reached by tapping
  a word in the text.

## T5. Open questions the user must settle before building

1. ~~**Green = ALL questions, or a fraction?**~~ **✅ MEASURED at `v80_l` — ALL is NOT a wall. Use
   ALL.** A highlighted word carries a mean of **1.70** associated questions and **53.6% carry
   exactly ONE**, so for most words "all questions solved" means "the one question solved". The
   fraction machinery T0 hedges about is not needed for this reason.
   **⚠️ But the same measurement raises a harder question in its place — see T5.4.**
2. ~~**What about lessons with no story word?**~~ **✅ RULED at the `v80_n` cut: tapping a word
   ENTERS THE USUAL LESSON FLOW**, including questions that are not themselves reachable by tapping,
   and **the play buttons stay.**

   This is a bigger simplification than it looks, and it changes T6. Tapping is a **way IN to the
   existing runner**, not a parallel one-question mode — so the 376 `intro_script` and 218 `math`
   items are not stranded, because the flow that a tap starts is the same flow the play buttons
   start. T6 step 3 ("build a single-question round from a probe") is therefore **wrong as written**:
   the work is *resolve word → lesson + entry point*, then hand off to `startLesson`, which already
   exists. Measured context, unchanged: **82% of items sit in text-anchored lessons.**
3. **T2a: do the bars actually go?**
4. **✅ RULED at the `v80_o` cut — OPTION 1: ACCEPT IT.** The mostly-red text ships as-is. Red means
   "not done", which is true, and `§T2a`'s ruling (the bars stay) means the text is a SECONDARY
   display — the headline progress signal is the bars, so the text does not have to carry it. **No
   extra colouring work; no scoping of the panel.** The two alternatives are recorded below and were
   NOT taken: a distinct PARTIAL colour, and scoping the panel to the chapter's own words.

   **⚠️ What this ruling does NOT settle**, so it is not re-opened by surprise later: 84% red is
   mostly UNFINISHED WORK, not a display artefact. Green = ALL is not the wall (mean 1.70 questions
   per word). If the screen should be greener, the levers are upstream and none of them is a
   colouring change — learners finishing chapters, the **6%** token-highlight density (`§T2a`), and
   the **47%** vocabulary matchability (`v80_f`), of which the last is a GENERATION fix.

   The measurement that produced this ruling: `v80_l` ran TRACK T's own colouring over
   the REAL history in `learners.json` — 2 users with history, 58 chapters they have actually
   worked, 1484 highlighted words:

   ```
   GREEN   every associated question solved    129    8.7%
   PARTIAL some but not all                    107    7.2%
   RED     none                               1248   84.1%

   chapters showing at least one GREEN word     23 of 58   39.7%
   chapters showing NOTHING but red             30 of 58   51.7%
   ```

   **Composed with T2a's density, this is what a learner sees on a worked chapter: of ~189 words on
   screen, ~12 are highlighted, and ~1 is green.** Over half of worked chapters would show no green
   at all.

   This is not a bug and the fix is not technical — 84% red is an ACCURATE report that the work is
   unfinished. But T0's premise is that *"progress should be obvious from the greening text"*, and on
   this install it would mostly report "you have done almost nothing". **That is a design and
   motivation question, and it is the user's.** Options that do not need new measurement: keep the
   bars after all (T2a), colour PARTIAL distinctly so effort shows before completion, or scope the
   text panel to the chapter's own words rather than the whole story.

   ⚠️ Three users, one install. A portrait of THIS install, not a population.

## ✅ T7. RULED AND SHIPPED at `v81_e` — a wrong answer takes a word out of green

*Raised by the user at the `v80_u` device pass; **explicitly deferred**, not dropped. Recorded here
rather than in a release entry because it is an OPEN design item, and the release entries are
history.*

**The request:** *"a wrongly answered question on a vocab that had been answered correctly should
also decrease the solved counter."* For TRACK T's colouring that is reasonable — a word the learner
has started getting wrong should stop being green.

**⚠️ Why it is not a small change.** `INTERNALS` records the solved store as **MONOTONIC** — *"one
correct answer ever = solved, the coverage model"* — and it is read by:

- `topicCoverage` / `lessonCoverage` → the completion fraction and the pass mark
- `setComplete` / `chapterComplete` → whether a chapter is finished
- `storyUnlocked` → **whether the story is readable at all**
- `_firstUnfinishedLessonIdx` and `_firstCoverageShortLessonIdx` → what Next and Replay open
  (the `v80_b` code)

Turning a ratchet into a fluctuating value means **a finished chapter can become unfinished and an
unlocked story can RE-LOCK**, mid-session, as a consequence of one wrong answer. That may be
acceptable, but it is a product decision and it is not the one the user was making.

**✅ THE SCOPING QUESTION IS ANSWERED: the user ruled READING 1, HIGHLIGHT ONLY, and it shipped at
`v81_e`.** The two readings and their blast radius are kept below because the ruling only holds while
the distinction does — see the `v81_e` entry for the containment guard that pins it.

⚠️ **One reader was MISSING from the list above when the ruling was made**, found by grepping the
solved store rather than trusting the note (rule 35): the ROUND BUILDERS —
`buildStandardExercises`, `buildMixedExercises`, `buildComprehensionExercises` and
`assembleCoverageRound` — all read it to bias rounds toward unsolved questions. Under reading 2,
un-solving would therefore also change WHICH QUESTIONS GET ASKED, feeding a wrong answer back into
sampling. That is arguably the most attractive part of the idea and it is the part nobody has costed.
Anyone re-opening reading 2 must start from that.

**THE TWO READINGS** — they differ enormously in blast radius:

1. **HIGHLIGHT ONLY.** A wrong answer moves the word green → partial in `_wordProgress` / the story
   colouring, and the solved store is untouched. Coverage, completion, the pass mark and the gates
   all keep their current meaning. Contained; buildable in a session; needs a second per-word counter
   (a "recent wrong" set) rather than a change to the solved store.
2. **THE WHOLE COVERAGE MODEL.** `markSolved` gains an inverse and every reader above inherits the
   new behaviour. Its own release, and it **must** re-run the `§C1` gate probes
   (`probe_gates_v80c1.js`) and `probe_gates_v77.js`, because the gates it feeds are the ones
   sessions 35–36 spent two releases fixing.

**Reading 1 is what TRACK T actually needs.** Reading 2 is a different feature — mastery decay —
which is `PLAN §9b/D2` territory and is already blocked on `§8/B4` running BKT in shadow mode.
**Do not implement 2 under cover of 1.**

## ✅ T4/STEP 4 — SHIPPED as `v81_a`, OPT-IN, and the measurement is why

T0: *"only if ALL questions associated with each highlighted word (or via pass mark fraction) are
solved we progress to the comprehension questions."*

**Measured before building it.** Making word-green the story gate outright would **RE-LOCK 21 of the
22 chapter/learner pairs whose story is unlocked today — 95%.** Green fraction of currently-unlocked
chapters, over the real `learners.json` at this cut:

```
  0%      5 chapters
  1-49%  11
  50-79%  5
  100%    1
```

**The cause is not learner laziness.** A word accumulates questions from vocab, from SENTENCES
(`v80_v`) and from every probe-bearing lesson, so *"all questions about this word"* is a far higher
bar than *"the lessons are done"*. A story a learner has EARNED would close again mid-session —
**the same hazard `§T7` raises for the solved counter, and the reason that item was deferred.**

**So the MECHANISM ships and the SWITCH is the user's.** `wordGate` is read from the topic, then the
storyline, then `APP.info`; a number in 0..1 is the fraction of tracked words that must be green.
**Unset — the default, and what every existing learner gets — leaves the `v71_s` rule exactly as it
was.** It REPLACES the lesson rule rather than combining with it: an `OR` would be a no-op (word-green
is the stricter measure in practice) and an `AND` is the 95% re-lock.

A chapter that tracks no words falls back to the lesson rule rather than answering "unlocked" on no
evidence.

**Guard:** `unit-word-gate`, six sections. **§2 is the one that matters today** — with no gate
configured, a chapter with ALL words green is still LOCKED, i.e. the default ignores the words
entirely. §3 is the discriminator: the same state, with a threshold set, unlocks — so the gate is
demonstrably what changed the answer. Mutation-tested.

~~**⚠️ THE RULING THE USER STILL OWES:** whether to switch it on, and at what fraction.~~
**✅ RULED — see the `v81_a` entry under `# SHIPPED IN THE v81 LINE`: "leave it as it is", the gate
stays available and off.** The follow-up measurement asked for there (does the pass mark rescue it?
no) is the input that closed it. The remaining options are CONTINGENT, not owed: per-storyline for
NEW books only, or redefine "green" to match the chapter's coverage rule — and the latter needs the
`§T7` scoping decision first.

*Struck at `v81_c`, not deleted. This paragraph and the entry that answers it sat ~245 lines apart in
one file and disagreed, and the `v81_b` session prompt carried the stale side forward into "THREE
RULINGS THE USER OWES" — the working rule about cross-checking a carried item against the SHIPPED
list in the same file, arriving from the other direction: here the OPEN text was the copy that went
stale.*

The numbers that produced the ruling: switching it on at 1.0 today would lock 95% of earned stories;
a fraction that does not regress anyone is somewhere below 0.5 on this install, which is weak as a
gate.

**⚠️ `v81_d` moves these numbers.** They were measured with a denominator that counted questions no
round can build — see the `v81_d` entry. Any future re-opening of this ruling must re-measure first.

## T6. Build order — ✅ FULLY UNBLOCKED at the `v80_o` cut

*Every `§T5` question is settled: `T5.1` measured (green = ALL), `T5.2` ruled (tapping enters the
usual lesson flow), `T5.3`/`T2a` ruled (the bars stay), `T5.4` ruled (accept the red screen). Nothing
below waits on the user any more except step 5, which needs a live model.*

1. ~~**Per-word solved FRACTION**~~ **✅ SHIPPED as `v80_q`** — `_wordProgress` + `_wordState`;
   both originals are wrappers over it. See the `v80_q` entry.
2. ~~**The shared text panel**~~ **✅ SHIPPED as `v80_r` + `v80_s`** — renderer, three states,
   asked-span underline, and the panel on EVERY question card, collapsed where the story leaks the
   answer (ruled option 3).
3. ~~**Tap → the lesson flow.**~~ **✅ SHIPPED as `v80_t`** — `_wordQuestions` + `tapWord`, landing
   on an unsolved question where one exists. `§0h` (`v80_p`) was built first, as this predicted.
4. **The gate change** (comprehension unlocks on green) — lands on `_storyLockedLesson` /
   `storyUnlocked`, i.e. the `v80_b` code. ~1 session.
5. **Prompt-side exact mapping** — needs a live model. **The user's, not a container's.**
6. **Comic coordinates** — isolated, last.

---


---

# THE LARGER PLAN — folded in from `implementation_plan.md` at the `v80_d` cut

> **⚠️ READ THIS BEFORE CITING ANYTHING BELOW.**
>
> The file `build_history/implementation_plan.md` **no longer exists.** It was a one-off evaluation of the
> user's larger plan (PDF focus) against these roadmaps, written at the `v80` cut, and keeping it
> alive created a SECOND home for open items — which is exactly how the two `v80` diagnoses came to
> be recorded in three places and missing from the durable one. It is folded in here whole.
>
> **Citation mapping.** Anything that said `implementation_plan.md §X` now reads **`PLAN §X`** and
> lives in this section. The letter-form labels are unchanged and unambiguous — `PLAN §C1`,
> `PLAN §D2`, `PLAN §F2`, `PLAN §8/B1`, `PLAN §9b/D8`, `PLAN §9c`, `PLAN §10` — because this roadmap
> has no sections of its own by those names. **The bare-number labels DO collide**: this roadmap
> already has a `§0`, `§1`, `§2` and `§3` of its own, and the plan had different ones. That is why
> every heading below carries the `PLAN §` prefix. **A bare `§3` means the roadmap's highlighting
> item; `PLAN §3` means Track C.**
>
> **Three duplications were resolved on the way in, not silently:**
> - `PLAN §2.6` and `PLAN §2.7` each appeared **TWICE, byte-identical** (3647 and 4857 bytes). One
>   copy of each was dropped. Nothing was lost — they were identical, and that was verified by
>   comparison rather than by eye.
> - `PLAN §2.5` appeared twice with **different content**: the corrected version
>   (*"PDF needs NO decision"*, revised under user challenge) and the superseded original
>   (*"PDF is the only case that still needs a decision"*). **Both are kept**, the original struck
>   with a pointer, because the reason a decision was reversed is worth more than the tidiness.

## ⚠️ WHAT HAS MOVED SINCE THE PLAN WAS WRITTEN — read this before acting on any section below

The plan was written at the `v80` cut. Sessions 35 acted on it. **These are the deltas; the sections
themselves are left as written, so the original reasoning stays readable.**

| plan section | status at the `v80_d` cut |
|---|---|
| **`PLAN §0.2`** — "I damaged `roadmap_v80.md`, re-carry and reconcile both sections" | **DONE.** Both sections were restored at the `v80` cut and RECONCILED in session 35 — see "SESSION 35 — the reconciliation pass" above. Its prerequisite is discharged. |
| **`PLAN §0.3`** — duplicate storyline title | **SUPERSEDED by user ruling** (`§2y`): the user RENAMED one to "Dough of the Ancients 2". The fork-marker guard is preventive, not corrective. |
| **`PLAN §0.3`** — single-chapter `1/1` and 100% bar | **✅ RULED AND SHIPPED at `v81_g`** — bar = completion, label = access. ONE root cause with the header bar, not two off-by-ones, and it is NOT the index the plan guessed: `pct` is computed from `unlockedChapters`, so ALL 91 decks show a partly-green bar at `doneChapters = 0` and all 27 single-chapter decks read 1/1 at 100%. The `+1` is the `v77_p` USER RULING and cannot just be removed. See `PLAN §C1` for the one question that needs answering. |
| **`PLAN §0.3`** — `unit-story-unlocked-page` §6 does not discriminate | **DONE, shipped `v80_c`.** It fails under revert now. See the `v80_c` entry above, which also CLOSES the `_firstUnfinishedLessonIdx` "open defect" as a misattribution. |
| **`PLAN §0.4`** — are QC tokens recorded | **Answered: yes.** Only a run-level total is missing. |
| **`PLAN §C1`** — the two progress-card gate bugs | **HALF DONE.** The SECOND bug (Replay reaching comprehension before the story unlocked) is **shipped as `v80_b`**, measured 27 of 94 partly-played chapters before / 0 after, revert-verified. The **FIRST bug is NOT reproduced**, and **two readings of it are dead ends** — see the `v80_b` block above before spending time on it. The single-chapter 100% bar and the header off-by-one are still folded in here and untouched. |
| **`PLAN §10`**, session 1 (repair and reconcile) | **DONE** (sessions 35). |
| **`PLAN §10`**, session 2 (`§C1`) | **HALF DONE**, as above. |
| **`PLAN §10`**, session 3 (`§8/B1` or `§D1`) | **`§8/B1` ✅ SHIPPED at `v81_j`** — the observations log, wired into `check()`. `§D1` is untouched. |

Everything else below is unchanged and still open.

---

> **Internal cross-references inside this folded section** (`§F3`, `§8/B1`, `§C1` written bare in
> the plan's own prose) are relative to the PLAN, not to the roadmap above. They were left as
> written rather than rewritten in 73KB of prose, because a mechanical rewrite of `§` across that
> much text is exactly the kind of edit that changes a claim by accident.

*Written at the `v80` cut, against `roadmap_v79.md` (shipped history), `roadmap_v80.md` (open
items), `INTERNALS.md` and the 35 standing rules. No code was written for this document. Every
claim about the current code below was checked in the tree at this cut; where I could not check
something, it says so.*

---

## PLAN §0 — Read this first — four findings that change the plan before it starts

### PLAN §0.1 — `bayesian_knowledge_tracing.md` ARRIVED — Track B is unblocked, but not where expected

The document is now in `build_history/`. It is sound, and its central choice is the right one:
**skills (knowledge components) are the BKT unit, not lessons or chapters**, with one canonical
skill shared across every story that exercises it (§7), and storyline/language/global progress as
*aggregations* rather than separate models (§5, §11, §12). That is the standard framing and it
avoids the usual mistake.

**But the blocking work is not the BKT.** The update rule is about ten lines of arithmetic and needs
no design. Four things stand between the document and a working implementation, and they were
checked against the tree at this cut:

**(a) THE EXISTING EVIDENCE CANNOT BE REPLAYED.** `learners.json` stores
`state.progress.learned["<target>|<source>"].vocab[word] = { source, seen, wrong }` — **aggregate
counters, not an ordered observation stream.** BKT is sequential: `P(L)` is updated per attempt, in
order, and "wrong early then right" (learning) is a different state from "right then wrong"
(decay). From `seen: 7, wrong: 0` neither can be recovered. So either BKT starts from zero evidence
going forward, or the existing counters seed `pMastery` crudely and the history is discarded. **The
document's §13 `observations` log is therefore not optional and not a later refinement — it is the
prerequisite**, and the sooner it starts recording the sooner BKT has anything to run on.

**(b) THE CURRENT KEY CONTRADICTS §7.** Evidence is bucketed by **language PAIR** (`it|de`, `en|de`),
so a learner meeting German from English and the same learner meeting German from Italian have
separate records today. §7 explicitly requires one canonical `de:vocab:gehen` regardless of route.
That is a schema migration, and the pair-keyed data cannot be merged without deciding whether
source language is a property of the *evidence* (probably yes) or of the *skill* (probably no).

**(c) SKILL TAGGING IS THE REAL COST, AND IT IS LANGUAGE KNOWLEDGE.** §3/§4 require every exercise to
name the skill it tests. Nothing emits that today. Worse, `de:wordform:gehen:present:1sg` cannot be
computed by the app from the string `gehe` — it needs lemmatisation and morphological analysis,
which INTERNALS §4 puts squarely in the model's tier. So skill IDs will be **model output**, and
**the document does not address canonicalisation**: the same skill will arrive as
`de:vocab:gehen`, `de:vocabulary:gehen`, `de:vocab:Gehen`, `de:vocab:gehen:infinitive` across
generations, and §7's "one canonical skill" quietly fails. **A registry with model-proposed IDs
resolved against existing entries is needed on day one**, not later. This is the single largest
piece of new machinery in the whole plan and it is invisible in the document.

**(d) THE MASTERY GATES COLLIDE WITH THE APP'S EXISTING PROGRESSION.** §5 redefines story progress as
"percentage of required skills with P(mastery) >= 0.70" and §6 makes chapter unlocking depend on
mastery thresholds. Dreizunge **already has** a progression system — `chapterComplete`,
`lessonCountsFor`/`countedLessons`, the `coverageTarget` pass mark with storyline/chapter override,
`_slProgressStats` — and it is the most heavily guarded surface in the codebase
(`probe_gates_v77.js`, the `unit-story-unlocked-*` family, `unit-fork-display` §6). **§5/§6 are a
REPLACEMENT of that, not an addition.** They are also a product decision, not a technical one: the
current pass mark is a teacher-set number the user has ruled on more than once.

**Consequence for ordering:** Track B's *instrumentation* can start early and independently; Track
B's *gates* should be last or never, and must not be assumed. See §8.

**One measurement to take before anything else**, because it decides whether BKT will discriminate
at all: across all of `learners.json` only **40 words have ever been answered wrong (3.0%)**. With
the document's suggested `pGuess = 0.20`, `pSlip = 0.10`, an observation stream that is 97% correct
drives `pMastery` to ceiling almost everywhere — so §6's thresholds would unlock everything
immediately and §5's percentage would read ~100% for every learner. **Check first whether `wrong`
counts FIRST attempts or only un-retried ones.** If exercises are retried until correct, the stream
is not independent, BKT's assumptions do not hold, and the fix is in the answer recording, not in
the model parameters.

### PLAN §0.2 — I damaged `roadmap_v80.md` at the cut, and this plan lands on the damage

When I created `roadmap_v80.md` I carried the open block from line 611 of `roadmap_v79.md` onward.
**Two whole open sections sit BEFORE that line and were lost:**

- `# 0. THE PROGRESS-CARD REWORK (user, at the v76 cut)` — with sub-items `0d`…`0h`
- `# 0i. LESSON GENERATION REWORK (user, at the v76 cut) — BLOCKED on §1`

`roadmap_v80.md` contains zero references to `0d`, `0h`, `0i`, "PROGRESS-CARD REWORK" or "LESSON
GENERATION REWORK"; `roadmap_v79.md` contains four. This is my error, made in the last ten minutes
of the previous session, and it is not cosmetic: **those two sections are the direct ancestors of
this plan's "CLEAN-UP PROGRESS CARDS" and "NEW LESSON GENERATION CARD".**

**Prerequisite task, before any of the below: re-carry both sections into `roadmap_v80.md`, then
reconcile them against this plan item by item** — each old bullet is either (a) superseded by a new
one, (b) still open and unmentioned here, or (c) already shipped. A superseded item must be struck
with a pointer, not silently dropped; that is how `v77_p`'s preview-panel removal stayed
comprehensible three releases later. Budget half a session.

### PLAN §0.3 — Two open items from session 34 are still unanswered and one is cheap

- **The duplicate storyline title** (`sl_182891979` / `sl_1041030875`, both `🧈🔥 Dough of the
  Ancients`, the only duplicate in 90) — each side's fork link names the storyline the learner is
  already in. An authoring call.
- **Single-chapter storylines read `1/1` and a 100% bar before anything is played** —
  `_slProgressStats` adds one for the in-progress chapter. This one is **inside the progress-card
  clean-up below** and should be folded into it rather than fixed separately (§C1).
- **`unit-story-unlocked-page` §6 does not discriminate under revert** (carried since `v77_p`). It
  needs no ruling and it is a guard that cannot fail, which is worse than no guard. **Do it first,
  before the big plan starts** — half a session, and it protects the surface the progress-card
  rework is about to churn.

### PLAN §0.4 — One question in the plan is already answered

> *"are tokens used for QC recorded? if not they should be."*

**They are.** `server.js` calls `addTokenUsage(_liveTopic(), _lqTok, 'lesson_qc')` and
`addTokenUsage(tp, _sqTok, 'story_qc')`. Chapter-level QC folds into
`generationStats.totalPromptTokens/totalCompletionTokens` — the same fields initial generation
writes, so "total" means total — and both carry a per-type tally in `tokensByType`. What is **not**
there: the `/api/qc` route itself has no `addTokenUsage` call at its own level, so a bulk QC run
attributes to the chapters it touched and nowhere else. If you want a *run-level* number ("this QC
sweep cost X"), that is a small addition and it belongs with the QC card (§F3), not with plumbing.

---

## PLAN §1 — The strategic read: this plan is three products, not one

The plan as written mixes work at incompatible scales. Sorting it that way is most of the planning
value, because the small items are being blocked by the big ones for no reason.

| Track | What it is | Scale | Depends on |
|---|---|---|---|
| **A — Ingest** | Image upload, vision extraction, chaptering, word map | **New subsystem**, weeks | **Nothing — no rulings left.** PDF text already works (§2.5) |
| **B — Pedagogy** | BKT, adaptive selection, tutor, recommendation, learning arcs | **New subsystem**, weeks | Design doc ARRIVED; B1 can start now, B7 needs a ruling |
| **C — Surface** | Progress cards, UI/settings card, generation card, QC card, LMGTFY | **Incremental**, 1–2 sessions each | Mostly nothing |
| **D — Lessons** | Mixed-lesson selection, cases/articles, generic lessons | **Incremental**, 1 session each | Language-knowledge ruling (§5) |
| **E — Export** | Printable exams and teaching material | **Small, self-contained** | Nothing |

**Recommended order: C → E → D → A → B.** (A moved cheaper after the §2 correction — image ingest needs no dependency at all — but it still follows C, because the ingest UI lands on surfaces C is about to rework.) Reasons, in order of weight:

1. **Track C is where every user complaint in this document actually is.** The screenshots are all
   surface. Shipping C makes the app better for the corpus that already exists.
2. **Track A changes the architecture** (§2) and should not be started while the surface is churning.
3. **Track B needs a corpus and a design document** that do not yet exist (§0.1). It also needs
   learner data, and the session-33 measurement is stark: across all of `learners.json` only **40
   words have ever been answered wrong** (574 with any record, 3.0%). **A BKT model fitted on that
   would be fitting noise.** BKT is the right long-term answer and the wrong next thing.
4. **Track E is small, has no dependencies, and is the only item with a clear non-digital user.**
   It is the best "spare half session" filler in the whole plan.

---

## PLAN §2 — INGEST ARCHITECTURE — corrected after the user's challenge

**My first draft of this section was wrong for images, and the user was right.** It framed
everything around PDF extraction and let the PDF difficulty contaminate the PNG case, which has
almost none of it. Corrected, with what was checked:

### PLAN §2.1 — What the code already does

The app talks to Ollama over **`/api/chat`** with `messages:[{role,content}]`, using Node's built-in
`http`/`https` (`qc-lessons.js:67`, and `server.js` carries the same shape). **Ollama's chat API
accepts `images:[<base64>]` on a message.** So sending a PNG to a vision model is *an extra field on
a request the app already makes* — no new transport, no new dependency, no `package.json`. The
"zero-dependency" property is not at risk for image ingest at all.

### PLAN §2.2 — The model can do both jobs, and the protocol is documented

Checked against the Ollama library and the MiniCPM-V CookBook:

- **`minicpm-v4.6` exists** (Ollama library) — SigLIP2-400M + **Qwen3.5-0.8B**, edge-focused,
  explicitly benchmarked on **RefCOCO** (a referring-expression *grounding* benchmark) and OCRBench.
- **`minicpm-v4.5` exists** — 8B on Qwen3-8B, OpenCompass 77.2, *"leading performance on OCRBench"*
  and *"state-of-the-art performance for PDF document parsing"*.
- **Grounding has a documented protocol** (`MiniCPM-V-CookBook/inference/minicpm-v4_5_grounding.md`):
  ask `Please provide the bounding box coordinate of the region this sentence describes:
  <ref>NAME</ref>`; the model answers with `<box>x1 y1 x2 y2</box>`, **normalised to 0–1000**,
  converted by `x = bbox[0]/1000 * width`.

So: **text extraction and panel coordinates from one model, one call shape, zero dependencies.**
That is the user's proposal and it is sound.

**Model choice, revised:** the plan's original `minicpm-v:8b-2.6-q4_K_M` is superseded by **`v4.5`**,
which is the same size class and explicitly better at OCR and document parsing. **`v4.6` is NOT the
newer-and-better option for this job** — its LLM is 0.8B, built for phones; it is the right pick for
on-device, the wrong one for ingest quality. Confirm what is pulled with `ollama list`.

### PLAN §2.3 — Cropping is a non-issue — three ways out, cheapest first

My draft implied cropping needed an image library. It does not:

1. **Do not crop.** Store the boxes as data and render each panel with CSS
   (`background-position`/`object-fit`) or a canvas draw at display time. The original PNG stays the
   only asset. **Recommended** — it is also reversible, so a bad box is re-editable forever.
2. **Crop in the browser** with `<canvas>` + `toBlob()` if real files are wanted. Free, no server.
3. **Crop in pure Node** — genuinely feasible, `zlib` is built in (verified): inflate IDAT, unfilter
   scanlines, crop, refilter, deflate. A few hundred lines and no dependency. Only worth it for
   server-side batch.

### PLAN §2.4 — What is still genuinely uncertain — and it is ONE thing

Not "can it do boxes" (it can), but: **the documented example grounds ONE region from a
description. Comic panel extraction needs N boxes enumerated in reading order, unprompted.** That is
a different task, and it is where a vision model most plausibly returns *well-formed, plausible,
wrong* output — coordinates that parse cleanly and do not match the page. That failure is invisible
unless something compares them to the image.

**So the first move in Track A4 is a measurement, not a feature** — the pattern that has worked all
session. Roughly 40 lines: post one real `murmel-comics.org/stories/2640` page to `/api/chat` with
`images:[b64]`, ask for panels, parse `<box>`, and render the boxes back over the source image as an
HTML overlay for a human to eyeball. Twenty minutes, and it answers what no amount of planning will:
does it enumerate all panels, in order, at usable precision? Record the answer as a probe with its
numbers in the header, like `probe_word_forms_v79i.js`.

**Reading order is the second unknown** and may be easier solved deterministically: given boxes,
sort top-to-bottom then left-to-right (right-to-left for manga) rather than trusting the model's
sequence. Worth testing both.

### PLAN §2.4 — RESULT (Aug 25 2026) — the overlay probe ran, three strategies, all negative

The probe finally ran, against the exact fixture named above (`murmel-comics.org/stories/2640`,
fetched with the user's one-off authorization for this internal dev probe; local copy kept only in
the session scratchpad, not the repo — the site's own licence is still unchecked, see `§2.7`). Model:
`minicpm-v4.5` (`§2.2`'s actual recommendation — pulled fresh for this, not the already-present
`v4.6`/`v:8b-2.6`). Machine: this dev box, CPU-only, with two OTHER large models also resident during
every call (`qwen3.6:35b`, `qwen2.5:7b`) — not a clean single-model bench, but this app's real
deployment shape is exactly this kind of shared box, so the numbers are not irrelevant.

Three DIFFERENT strategies were tried, each getting its own probe file (all three now committed under
`build_history/`, each with its full numeric results in its own header — read them for the raw
per-call output, this is a summary):

1. **`probe_comic_panels_v85_i.js` — one-shot enumeration** ("list every panel, in reading order, one
   `<box>` per line"). The first 4 of 6 true panels came back genuinely well-formed and consistent — a
   clean, evenly-spaced 2-column grid. From panel 5 on the response DEGENERATED: confabulated
   self-correction prose leaking into what should be terse coordinate lines, an invented in-panel sign
   text, and by panel ~14 an outright repetition loop, ending with 26 claimed "panels" for a page that
   has 6. One call, 6.4 minutes.

2. **`probe_comic_panels_grounded_v85_i.js` — stateless per-panel grounding**, `§2.2`'s actual proven
   protocol (one `<ref>NAME</ref>` → `<box>` call per panel, no shared memory between calls). A quick
   separate count call was cheap and correct both times it was tried (0.7-66s, "6", right answer). The
   FIRST attempt used a full instructional sentence as the `<ref>` NAME with a 48-token budget — the
   model echoed the whole sentence back before answering, truncating the box's last number on 4 of 6
   calls. The SECOND attempt (short name, no-echo instruction, 200-token budget) fixed the echo/
   truncation, but surfaced a DIFFERENT problem: six fully independent calls do not agree on a
   consistent layout — two different claimed panel numbers landed on nearly the same, overlapping
   region. Individually plausible boxes, no global consistency. ~8-10 minutes per full run (7 calls).

3. **`probe_comic_panels_stateful_v85_i.js` — stateful grounding** (each call is told the boxes
   already found for earlier panels and instructed to answer with a different region — directly
   targeting finding 2's consistency problem). Did not fix it: panel sizes came back wildly
   inconsistent (one plausible 355×315 panel next to a 50×50 sliver, nowhere near panel-sized), and 2
   of 6 calls STILL degenerated — one response literally contained HTML anchor-tag markup
   (`rel="noopener noreferrer" target="_blank">670</a>`) in place of a fourth coordinate, unprompted
   and unrelated to anything in the conversation. 8.7 minutes.

**VERDICT.** Three structurally different prompt strategies, three different failure modes, all on
the EASY/acceptance fixture (`§2.7`'s clean 2×3-grid "Page B") — none produced a fully self-consistent
set of correctly-sized, non-overlapping panel boxes. The one thing that stayed reliable across every
run was the cheap "how many panels?" count call. Per the user's own decision after reviewing all three
overlays live, THIS IS NOT A PROMPTING PROBLEM TO KEEP ITERATING ON — it is either a model-quantization
ceiling (`minicpm-v4.5` at this build) or a machine-load ceiling (CPU-only, three large models
resident), or both, and either way further prompt tuning on this exact setup has diminishing odds of
paying off. **Track A4 (comic panel-grid extraction) is NOT ruled out, but is NOT viable as measured.**
Two forward paths, neither started: (a) the same probes against a different backend (larger/
un-quantized model, GPU, or a cloud vision API) to separate "the model" from "the approach" as the
cause; (b) fall back to `§2.6`'s own coarser Tier 1 target (bubble-level boxes, not precise panel-grid
splitting) which may not need reliable full-page panel enumeration to be useful. **Do not resume
Track A4 by writing panel-splitting production code — the measurement says it isn't ready, and no
ruling has been made on which of the two forward paths (if either) to take next.**

### PLAN §2.4 — RESULT PART 2 (Aug 25 2026, same session) — a THIRD forward path, tested, more promising

User's own idea, put directly to the failure just measured: if panel ENUMERATION is what breaks, take
it out of the model's job entirely — let the USER draw the panel rectangles by hand (mouse drag on a
canvas overlaying the uploaded image; `§2.3`'s existing "store boxes as data, don't crop for storage"
decision covers this regardless of who drew the box), and give the model only the narrower, different
task of TEXT EXTRACTION from an already-correct, already-known region. None of the three panel-finding
probes above tested this — they all tested localization, never extraction-from-a-known-region.

Measured with a new probe, `probe_comic_text_extract_v85_i.js`, on a hand-cropped real panel from the
same Page B fixture (panel 3 — chosen because it contains BOTH of `§2.7`'s flagged risks in one panel:
a caption vs. an in-scene sign that must be told apart, and a word split across a line break with no
hyphen, "WILL"/"KOMMEN", that must be rejoined). Two runs:

- **v1** (plain instructions): the caption/in-scene SPLIT was exactly right and the caption's letters
  matched perfectly, but case-restoration and word-rejoining — the two specific transformations `§2.7`
  flagged as highest-value — were both ignored outright (not attempted-and-wrong, just skipped), plus
  one OCR letter error ("nicht" → "mcht"). ~65s, far cheaper than any panel-finding call.
- **v2** (added a worked example + "your answer is WRONG if it contains any word in all capital
  letters" framing): **case-restoration was FULLY fixed** — the caption came back a perfect, correctly-
  cased, correctly-umlauted match to ground truth, and the in-scene field's case fixed too. Word-
  rejoining and the OCR letter error were UNCHANGED by this fix (different failure category — visual
  recognition and a structural instruction don't respond to the same prompt lever). A NEW defect
  appeared: the crop deliberately included a small sliver of the *next* panel (realistic — a human-
  drawn box will rarely be pixel-perfect), and the model transcribed that bleed-through as an
  unlabeled third line instead of ignoring it.

**VERDICT.** This is the most promising result in the whole `§2.4` series. The single highest-
pedagogical-weight requirement (German case restoration — without it the app would silently teach
wrong noun capitalization) is solvable with prompt engineering alone, and ported across text sources
once fixed. What's NOT yet solved: OCR letter-level accuracy (didn't move with any prompt change
tried), line-rejoin (didn't move either), and crop-boundary bleed-through (newly discovered, means a
production UI needs either generous-then-tightened cropping or an explicit "ignore any text touching
the crop edge" instruction). **This changes the forward-path picture from PART 1 above**: rather than
"different backend" or "fall back to Tier 1 bubble-level," a THIRD path now has real positive signal —
manual panel selection (removing localization risk entirely) + model text-extraction (which just
proved partially, iterably fixable). Still not production-ready, and no ruling has been made on
whether to pursue this over the other two paths — but this is the first `§2.4` measurement with more
good news than bad.

### PLAN §2.4 — RESULT PART 3 (Aug 25 2026, same session) — a different model changes the picture entirely

User asked "could we use a more powerful model?" No GPU exists on this machine (`lspci` confirms
Intel integrated graphics only, no CUDA), so a genuinely bigger local model was expected to be
impractically slow; a same-size-class BUT different/newer architecture was tried instead: pulled
`qwen2.5vl:7b` (6.0GB) and re-ran every probe from PART 1 and PART 2 against it, unchanged prompts,
same fixture, same crop, for a clean model-vs-model comparison:

- **Text extraction** (`probe_comic_text_extract_v85_i.js`): a PERFECT match on both fields, first
  try — resolved every remaining minicpm-v4.5 defect at once (the OCR letter error, the un-rejoined
  split word, AND the crop-bleed-through line) at a cost of ~294s vs ~65-85s per call.
- **One-shot panel enumeration** (`probe_comic_panels_v85_i.js`): correct format (unlike minicpm,
  which ignored the requested tag), CORRECT COUNT (6), and a clean, consistent, evenly-spaced grid in
  EXACT reading order — no confabulation, no repetition loop, the single failure mode this whole probe
  series was built to catch. ~296s for the call.
- **Stateless grounding** (`probe_comic_panels_grounded_v85_i.js`): the one place qwen2.5vl:7b did
  NOT do well — 2 of 6 boxes came back geometrically inverted (negative height), and two others
  duplicated the same region, the identical consistency failure minicpm-v4.5 had with this exact
  strategy. Much faster though (1.6-1.9 min for all 7 calls vs 8-10 min) — machine load had dropped
  by this point in the session, so per-call cost is not directly comparable across the two models'
  runs.
- **Stateful grounding** (`probe_comic_panels_stateful_v85_i.js`): clean success — fixed exactly what
  stateless grounding got wrong (no negative boxes, no duplicates), a consistent 6-panel grid matching
  the one-shot result. 2.5 min for all 7 calls. Notably, feeding prior answers into context helped
  qwen2.5vl:7b (stateless→stateful went from broken to clean) but did NOT help minicpm-v4.5 in the
  same test (stateless→stateful stayed broken, differently) — the value of "give the model its own
  prior answers" is model-dependent, not a universal fix.

A parser bug was found and fixed along the way (not a model defect): the number-matching regexes
across all three panel-finding probes required literal digits only, so a legitimately negative
boundary coordinate (`<box>-10 -6 378 394</box>`, a corner panel's box slightly overshooting the image
edge) silently produced a garbled, wrong-looking box instead of a parse failure or a correct negative
value. Fixed by allowing an optional `-` per coordinate in all three probe files' parsers — worth
remembering for any production parser built on this protocol.

**VERDICT.** `qwen2.5vl:7b` passes 3 of the 4 tasks tested cleanly (text extraction, one-shot
enumeration, stateful grounding) and fails the 4th (stateless grounding) in the SAME way `minicpm-v4.5`
did. This is a genuinely different picture than PART 1: **the simplest strategy — one-shot
enumeration — now works outright**, on the easy fixture, with this model. Two things are still
unverified: (1) whether this generalizes to `§2.7`'s HARD fixture (Page A — rotated text, unframed
panels, text outside its panel, ambiguous order), the actual regression case the whole `§2.4` protocol
was designed to stress-test, not yet tried with any model; (2) per-call latency (~5 min for a single
qwen2.5vl:7b vision call when the machine is under its earlier load, as low as ~15-20s when it is not)
is workload-dependent on this CPU-only box, not a fixed number — real production timing needs
measuring under realistic concurrent load, not this session's on-and-off contention. **No ruling has
been made on which panel-finding strategy (if any) to build on, nor on whether Track A4 moves forward
with `qwen2.5vl:7b`, a cloud backend (not yet tried), or the manual-panel-selection design from PART 2
— all three remain live options with real positive signal behind them now.**

### PLAN §2.4 — UI SCOPING (Aug 25 2026, same session) — the manual-panel-selection design, milestone plan

User: "start scoping the UI." This is the PART 2 design — user draws panel rectangles by hand,
removing localization from the model's job, model only extracts text per drawn panel — chosen because
it tested more reliably than any model-driven panel-FINDING strategy in PART 1/3. Two rulings made
before scoping: **uploaded page images are stored inline as base64 in `lessons.json`** (consistent
with the existing "everything is one JSON store" architecture; no static-asset route exists anywhere
in this app today, and building one is out of scope for now — revisit if corpus size becomes a real
problem); **panels are drawn first, extracted in one batch afterward**, not one-at-a-time with a wait
after each rectangle.

**What already exists and where this plugs in** (verified by reading the actual code, not assumed):
- `#gen-card-2`'s text-source cluster (`#pdf-panel`/`#user-story-panel`/`#dialect-panel`, each a
  sibling `<div>` gated by its own checkbox in `#user-story-checks`) is the right home for a NEW
  sibling `#comic-panel` — the existing upload entry point (`#upload-file-input`, `onUploadFileChosen`)
  is text-shaped end to end (PDF/txt branch, then a chunking-into-chapters pipeline) and cannot carry
  an image through it; this needs its own parallel path, not a branch inside the existing one.
- `_storyBodyHtml(d, opts)` is the ONE shared story renderer already reaching every progress card,
  question panel, and the storyline chain view (the precedent: translation-toggling and
  highlighting both reach every caller for free through this one function). A new branch here,
  keyed on a new `d.comicPanels` field, is the correct integration point for PART 2's progress-card
  ruling (comic-sourced chapters only) — low risk, because it is one data-shape check in code every
  consumer already shares, not four separate call sites to keep in sync.
- The SERVER-SIDE job primitive (`newJob`/`jobStep`/`jobDone`/`jobFail`, the generic `/api/job/:id`
  poll route) is genuinely generic — `data` is an opaque payload, not tied to story-generation. A new
  comic-extraction job type can call it exactly like `_runBookJob` does. The CLIENT-SIDE
  `startBackgroundJob` wrapper does NOT reuse directly — it is hardwired to story-generation's own
  completion actions (`showStorylineForTopic`, `j.data.topic`) — a new, structurally similar sibling
  function is needed, following the pattern, not the code. (Checked per rule 12 — the "reuses existing
  machinery" claim holds for the server half, not the client half.)
- `llm.js`'s `_callOllama` has NO `images` support today — every one of this session's probe scripts
  hand-rolled its own raw HTTP call to `/api/chat` because of this. Production code should add
  `opts.images` to the existing call (it already has an `opts` bag for `think`/`stop`/`ctxTokens` —
  same shape), not keep the probes' one-off duplication.
- Per `§2.3`, cropping happens CLIENT-SIDE via `<canvas>` + `toBlob()`/`toDataURL()` (free, no new
  dependency) — the probes' crops were made with a system ImageMagick call, which is not available
  inside the deployed app; the production path was always meant to be the browser canvas route this
  session's fixture work skipped only because it was faster to script.

**Milestone plan** (mirrors `PLAN §13`'s own build order — ship the model-independent part first):

1. **Upload entry + panel-drawing UI, no model calls.** New `#comic-panel` (image file input, accepts
   image types — `#upload-file-input`'s `accept` needs extending or a second input), the uploaded
   image displayed with a canvas overlay for mouse-drag rectangle drawing, a list of drawn boxes with
   delete/reorder, reading order = draw order (adjustable). Entirely testable without touching
   `server.js`/`llm.js` at all — the first new UI affordance of its kind in this app (no drag-rectangle
   precedent exists), so this alone is real, not-trivial client-side work.
2. **Batch extraction.** "Extract text" action crops each drawn box client-side (canvas), sends all N
   crops to a NEW server endpoint/job (`llm.js` gets `opts.images`; a new job type mirrors
   `_runBookJob`'s shape), a new client-side poller (sibling to, not a reuse of, `startBackgroundJob`)
   shows one combined wait instead of N interruptions, matching this session's own probe-validated
   prompt (worked example for case-restoration, caption/in-scene labeling).
3. **Chapter formation.** Panel texts, in reading order, concatenate into the ordinary `d.story` field
   (backward-compatible with every existing text consumer: vocab extraction, comprehension questions,
   search) — comic-sourced content becomes chunked text feeding the SAME chaptering/lesson-type
   pipeline PDF/pasted-story uploads already use. `d.comicPanels` (box, text, kind, image) is stored
   alongside for milestone 4.
4. **Progress-card integration** (comic-sourced chapters only, per the standing ruling). New branch in
   `_storyBodyHtml`: when `d.comicPanels` is present, render each panel's image with its transcribed
   text, each WORD individually clickable/highlightable via the EXISTING vocab-highlighting machinery
   (`_highlightVocabHtml`) applied to the transcribed text — Tier 1 per `§2.6`, not per-word image
   coordinates (Tier 2, still explicitly out of scope, still not measured).

**Not yet started — no code written for any of this.** No ruling yet on which vision model/backend
milestone 2 targets (open per PART 3 above), nor on exact box-storage schema field names. Milestone 1
has no such dependency and could start independently of that open question, since it touches no model
at all.

### PLAN §2.6 — The interactive word map (user, at the v80 cut) — build it where coordinates are FREE

**The idea:** overlay the image with the coordinates of the extracted text so the learner can click
a word *in the picture* and get a vocab/grammar question about it.

This is the best fit for the product's own one-line description — *"explore the language of existing
texts"* — that anything in the plan has, and most of it already exists: the question types are
built, `_storyWordSources(d)` already collects "what words does this chapter teach", and the
per-word progress store is keyed by word. **What is new is only the coordinate map and an on-demand
question for an arbitrary word.**

But the difficulty is wildly different per input type, and that should drive the order:

**Tier 0 — born-digital PDF: coordinates are EXACT and FREE.** `pdf.js`'s text layer returns per-item
text with a transform matrix — position, scale, font size — for every text run on the page, with no
model call and no error. **A clickable word map over a PDF page is a rendering exercise, not a
research one.** If §2.5 goes the `pdf.js` route, this feature comes almost free with it. **Build it
here first.** It also proves the whole interaction — hit targets, question-on-click, tracking —
against a source of truth, so that when the image path arrives, only the coordinates are in doubt.

**Tier 1 — images, BUBBLE-level (recommended first image step).** Ask the model for text-block /
speech-bubble boxes, not words: few per panel, coarse, and the same referring-expression shape as
panel grounding — the model's demonstrated strength. Clicking a bubble opens the transcribed text as
**ordinary HTML with each word clickable**. Perfect hit targets, no per-word coordinates needed, and
it degrades gracefully: a slightly wrong bubble box is still a usable click target, whereas a
slightly wrong word box lands on the wrong word and teaches the wrong thing.

**Tier 2 — images, true PER-WORD boxes. This is the speculative one, and it is a real step up.**
A comic page can carry 100+ words. Per-word grounding means either many boxes in one response —
where confabulation risk scales with count and nothing in the output signals it — or one call per
word, which is not affordable. **Do not design around this until the §2.4 overlay probe has run**,
and extend that probe to ask for word boxes in one bubble so both questions are answered by the same
20 minutes of work.

There is also a **derived** option worth testing cheaply: take the bubble box plus the transcribed
string and *estimate* word positions by proportional layout inside the box. Free, no extra tokens,
and probably fine for typeset prose — but comics are hand-lettered with unknown line breaks, so
expect it to fail exactly where it is being asked to work. Test it against Tier 2 output rather than
assuming either way.

**Cheap verification, whichever tier ships:** boxes must lie inside the image bounds, must not
mutually overlap beyond a threshold, and the union of text boxes must account for the extracted
string. None of that needs language knowledge, and it catches the well-formed-but-wrong failure that
is otherwise invisible. **A wrong box is worse than no box** — it silently teaches the learner that a
word means something it does not — so the overlay should fail closed: no confident box, no click
target.

**One product question, not a technical one:** this feature stores and re-displays someone's
artwork with an interactive layer on top. The plan already scopes the corpus to *"known texts w/o
copyright"*; `murmel-comics.org` needs its licence checked before it becomes the demo case, and
user-uploaded images need a decision about whether they are stored server-side at all.

### PLAN §2.7 — Two REAL pages, read by eye at the v80 cut — what they change

The user supplied two German comics. They bracket the difficulty so well that they should become
the two fixtures for all of Track A. **Everything below is from reading the pages, not from running
a model** — these are the things the §2.4 probe has to be built to catch, not results.

**Page B ("Ein Scheissland", signed M. Lüq) — the EASY case, and the right ACCEPTANCE fixture.**
A clean 2x3 grid of rectangular panels under a title. Caption boxes sit at the top of each panel,
hand-lettered all-caps. Reading order is unambiguous left-to-right, top-to-bottom, so the
deterministic sort proposed in §2.4 is provably enough here. Two pieces of *in-scene* text (a sign
and a banner) sit inside the drawings rather than in caption boxes — a useful wrinkle, because they
must be distinguishable from narration and are exactly the kind of thing a naive "text on page"
extraction flattens together.

**Page A ("Weg? Woanders? Oder nur unsichtbar?") — the HARD case, and the right REGRESSION fixture.**
It defeats four assumptions at once:

1. **Rotated text.** The title runs diagonally; a whole caption runs bottom-to-top at 90 degrees up
   the middle of the page. **Axis-aligned bounding boxes cannot represent this** — the AABB of a
   rotated line overlaps everything beside it, so a per-word click map built on AABBs will put the
   wrong word under the pointer, and the overlap check proposed in §2.6 will fire on correct output.
   Either boxes carry a rotation, or rotated text is detected and excluded.
2. **Unframed content.** A large heart illustration and its caption have no panel border at all.
   **Panel detection by finding rectangles finds nothing there** — grouping has to be semantic.
3. **Text outside the frame.** Captions sit below their panels rather than inside them, so
   "associate text with the panel whose box contains it" is wrong on this page and right on page B.
4. **Genuinely ambiguous reading order.** Where the vertical caption falls relative to the heart
   caption is a judgement a human makes from layout. A top-to-bottom-then-left-to-right sort will
   produce a confident wrong answer.

**The finding that reaches beyond the overlay: WORDS ARE BROKEN ACROSS LINES.** Page A hyphenates
`SON-` / `DERN` across a line break; page B splits `WILL` / `KOMMEN` across lines **with no hyphen
at all**. This breaks three things, only one of which is the word map:

- the map, because one word occupies two disjoint boxes;
- **vocabulary extraction**, because the lesson would teach `son` and `dern` as words;
- **the story text itself**, which would carry the break into every downstream lesson and QC pass.

So de-hyphenation and line-rejoining belong in the extraction step, before anything else sees the
text — and the no-hyphen case means it cannot be done by looking for hyphens. It is a language
judgement, so it is the model's, per INTERNALS section 4.

**The finding with the most pedagogical weight: ALL-CAPS DESTROYS GERMAN NOUN CAPITALISATION.**
Both pages are lettered entirely in capitals. German capitalises nouns, and that distinction is
information a learner is being taught. `KÖPFE`, `MENSCHEN`, `ANGST`, `SCHATZ` must come back as
`Köpfe`, `Menschen`, `Angst`, `Schatz`, while adjectives and verbs must not. **Extraction from
capitals is therefore not transcription, it is restoration**, and the same applies to `SS` -> `ß`
(`GROSSES` -> `großes`, but `SCHEISSLAND` is a judgement). Hand-drawn umlauts are an accuracy risk on
top. None of this is the app's to decide; all of it must be asked for explicitly in the prompt and
then QC'd, because a silently mis-capitalised noun teaches the wrong rule.

**What this implies for the plan:**

- **Ship against page B, regress against page A.** A version that handles B well and *refuses* A
  cleanly is a good version. A version that produces confident boxes for A is a broken one, and
  page A is how you find out.
- **Fail closed becomes a hard requirement, not a nicety** (section 2.6). Page A is the page where
  plausible-but-wrong output is most likely and least detectable.
- **The probe needs GROUND TRUTH**, or it measures nothing. Somebody has to transcribe both pages by
  hand once, into a fixture, including the intended reading order and the restored capitalisation.
  That is an hour of work and it is what makes every later extraction change measurable instead of
  eyeballed.
- **Content curation is not only about copyright.** Page B is pointed political satire; page A is
  about bereavement. Both are legitimate reading material and neither is automatically suitable for
  an arbitrary learner or an auto-generated "meet and greet" corpus. The corpus needs a suitability
  axis alongside the licence one.
- **Page B is signed by an identifiable artist.** The licence question in section 2.6 is live for
  this specific page, not hypothetical.

### PLAN §2.5 — PDF needs NO decision — corrected again (user, at the v80 cut)

**My §2 draft asked for a PDF ruling that does not exist.** The user's correction: PDF is used for
TEXT only and already works; comics arrive as PNG. Checked, and it is more settled than that:

- **`pdf.js` is already loaded**, from `cdnjs` at `index.html:4394-4402` — the same CDN pattern the
  app already uses for KaTeX. So the "single-file client" property was **already relaxed for exactly
  this**, and nothing new is being decided.
- **Extraction already reads per-item GEOMETRY**, not just strings. `page.getTextContent()` items
  are grouped by `item.transform[5]` (y) and the minimum `item.transform[4]` (x) is kept per line,
  because — as the `v71_b` comment there says — the vertical gap distinguishes a paragraph break
  from a wrap and the left edge marks an indent.

**Rasterisation was never needed.** Delete the option list; there is no dependency question, no
`package.json`, no ruling. The two input paths are simply separate: **PDF/markdown/paste → text,
already built. PNG → vision model, needs nothing new (§2.1).**

**But this has a consequence for §2.6 that runs the other way, and it is good news:** the exact
per-word coordinates the word map wants are **already flowing through `_extractPdfText` and being
discarded.** `content.items` carries a full transform per text run; the current code takes `y` and
the line-minimum `x` and drops the rest. Tier 0 of the word map is therefore not new plumbing — it
is *keeping* what is already read, alongside the text that is already produced. That makes it the
cheapest place in the whole plan to build and prove the click-a-word interaction, against
coordinates that cannot be wrong.

One caveat to measure rather than assume: pdf.js emits text *runs*, not words. A run may be several
words or part of one, so word-level boxes need splitting a run by character widths — approximate,
but bounded and checkable, and vastly better than the image case.

### ~~PLAN §2.5 PDF is the only case that still needs a decision~~ — SUPERSEDED

> **Superseded by `PLAN §2.5` above** (*"PDF needs NO decision — corrected again"*), which the
> user's challenge produced. Kept, not deleted: this is the version that says what the
> decision WAS, and a reversal without its original is unreadable three cuts later.

A PDF is not an image; feeding it to a vision model requires **rasterising** it first, and that is
the one step with no built-in. Options:

- **Rasterise in the browser** with `pdf.js` from a CDN → canvas → PNG → the exact same vision path
  as 2.1. One code path for PDFs and comics both. Costs the single-file client property for the live
  app and needs a decision for `docs/index.html`.
- **Text-layer-only fast path**: `pdf.js` can extract an existing text layer with no model call at
  all — free and exact for born-digital PDFs, which is most uploaded prose. Fall back to
  rasterise+vision for scans and comics.
- Accept a Node dependency (**needs an explicit ruling**, ends a long-held invariant).

**Recommendation: browser `pdf.js` doing text-layer-first, rasterise-on-fallback, feeding the
existing chat+images path.** Images need no library at all; PDFs need only a client-side one; the
server stays zero-dependency in every case.

## PLAN §3 — Track C — the surface clean-up (do this first)

Ordered so that each session ends shippable. Every one of these lands on `probe_gates_v77.js`
territory; **re-run and diff against `v80_card_gates.txt`** (the `v77` table is superseded, and the
`v80` baseline exists because the drop moved it).

### PLAN §C0 — UI architecture rework: bounded screen ownership, not a rewrite

**Direction accepted by the user at the `v81_l` cut.** Separate generation, settings, QC/editing,
progress/story, and later library browsing into screen-level surfaces. Do it incrementally while
each affected flow is reworked—not in a whole-codebase refactor before product work, and not after
new flows have been cemented into the monolith.

The current client already has a generic `show(id)` switcher and several `.screen` roots, but no
authoritative `APP.screen`/route state. The landing surface still combines generation with the
library; settings and QC/editing are scattered controls or panels. Preserve all of their supported
entry/exit behaviour while giving each future screen one owner.

> **One screen owns its rendering and event wiring; shared state and navigation live outside
> screens; no screen reaches into another screen's DOM.**

**Implementation sequence:**

1. **C0.1 — lock journey behaviour before moving it.** Add behavioural transition tests for the
   learner walk (progress card → story → lesson → return), and for generation/settings entry and
   exit. Test the rendered/interactive route outcome, not the source spelling of a helper. This is
   the next code slice.
2. **C0.2 — small router seam.** Make one authoritative route state (`APP.screen` or equivalent)
   and explicit screen renderers such as `showProgressCard`, `showStory`, `showGeneration`, and
   `showSettings`. It must first preserve every current entry point; no visual redesign bundled in.
3. **C0.3 — move only the surface under active rework.** Start with generation and settings, then
   progress/card state plus story navigation. Move QC/editing, exercise running, and library browsing
   later, one bounded surface at a time.
4. **C0.4 — remove only proven-dead paths.** An old story-display or navigation path goes only after
   route-parity tests cover every supported entry point and a caller search finds none.

**Story-display rule:** retain one canonical story-panel body renderer with mode/options (for example
`{context:'progress'|'summary'|'unlocked', actions, collapsed}`), rather than accumulating near-
duplicate story views. Each screen owns its surrounding card/layout and actions; the shared renderer
owns only the story body. `_storyBodyHtml` is the current seam and must remain the sole body renderer.

**Distribution rule:** keep the single-inline-client/static-build model. “Modules” initially means
well-delimited functions and state ownership inside `index.html`; external client files are a
separate architecture decision requiring a deliberately designed and verified embed/bundle path.

This rework does **not** authorise a second app, a playback rewrite, changed gates, altered learner
progress, or a wholesale DOM rewrite. It is the enabling structure for future progress-card work and
the new generation/settings/QC pages.

### PLAN §C1 — Progress-card structural fixes (1 session) — the BUGS first, before any cosmetics

Two of the plan's items are **defects**, not design, and they should not wait behind the cosmetic
list:

- **"I browsed forward to the story card and back, solved no comprehension lesson, yet could
  proceed to the next chapter."**
- **"Via the replay button or otherwise, I could play the comprehension lessons BEFORE the
  chapter-story was unlocked."**

These are the same suspicion from both sides: **the gate is being computed from render state rather
than from lesson state**, so navigation can move the learner past a gate that never opened. They
are also the two items most likely to be *masked* by the cosmetic rework, so measure them before
touching the cards.

**First move is a probe, not an edit** — the pattern that worked for the fork task. Drive
`chapterComplete`, `lessonCountsFor`/`countedLessons` and the unlock gate directly, reproduce both
sequences, and report what each says before and after. Fold in the **single-chapter 100% bar**
(§0.3) here, since it is the same helper (`_slProgressStats` adding one for the in-progress
chapter) and the same screen.

**✅ MEASURED at `v81_f` (session 37), and the plan's reading is WRONG.** The header bar is NOT an
index off-by-one. Both symptoms are the SAME LINE — `_slProgressStats`'s
`unlockedChapters = doneChapters + (doneChapters < total ? 1 : 0)` — and `pct` is computed from
`unlockedChapters`, so the bar measures how much of the deck is OPEN, not how much is DONE. On a
fresh install, with `doneChapters = 0` everywhere:

```
deck size   decks   bar shown before anything is played
 1 chapter    27     100%   <-- and the label reads 1/1
 2 chapters   22      50%
 3 chapters   12      33%
 4 chapters    9      25%
 …
14 chapters    1       7%
                     ALL 91 storylines show a partly-green bar at doneChapters = 0.
27 of 91 — every single-chapter deck — read 1/1 and 100% before a single question.
```

So the roadmap's warning was right: fixing these as two off-by-ones would have left the real one.
**⚠️ AND THE `+1` IS A USER RULING** (`v77_p`: "the chapter in progress counts, which is why a fresh
storyline reads 1/2 rather than 0/2"), so it cannot simply be removed — that would reverse a ruling.

**THE RULING NEEDED, and it is one question:** the label and the bar currently mean the same thing.
The minimal change that keeps `v77_p` intact is to **split them** — the LABEL keeps counting UNLOCKED
chapters (1/1, 1/2 — the ruled behaviour), while the BAR counts COMPLETED ones, so a fresh deck reads
1/2 with an empty bar and a single-chapter deck reads 1/1 with an empty bar. The cost is that a deck
can read 2/2 with a half-full bar, because "2 of 2 chapters open" and "1 of 2 finished" are then
different statements. The alternative is to leave the bar alone and accept 100%-before-play on 30%
of the corpus. **Not implemented — a headline number is not ours to redefine (rule 24).**

**The original note:** the plan reads this as an index-off-by-one ("current-1"). **Verify that before
implementing it**; the same helper
produces the 100%-on-one-chapter result, so a single root cause may explain both, and fixing them
as two off-by-ones would leave the real one.

### PLAN §C2 — Progress-card content and copy (1 session)

Low-risk, high-visibility, all guarded by the gate probe:

- ~~third progress bar for comprehension lessons on the entry card;~~ **⚠️ AT RISK from TRACK T**,
  which proposes dropping the chapter bars entirely. **T2a shows that reasoning is unsupported**
  (only 6% of story tokens are highlighted), so this is NOT settled either way — do not build the
  third bar and do not delete the others until the user rules. See TRACK T.
- the bottom-row message replaced by the **chapter title** on all card states (entry, in-progress,
  unlocked-in-green) — one change applied consistently, so build it as one helper with a state
  argument, not four call sites;
- post-unlock questions labelled **"text comprehension"** rather than by the next chapter's name.
  **Check `ui.json` for an existing key first** — the plan says to reuse one if present, and adding
  a key means 33 languages;
- ~~the "next chapter unlocked!" card **removed from the flow**, going straight to the next entry
  card;~~ **RULED AND SHIPPED as `v80_e` — MERGE.** As written this was not executable: since
  `v77_q` there was no entry card for chapters 2..N, because that card WAS it. The entry card is
  now generalised to every chapter and the unlocked card is deleted. **See the `v80_e` entry at
  the top of this roadmap.**
- entry card shows the story summary as the storyline page does, **default uncollapsed**;
- chapter entry cards ≥2 remodelled to match chapter 1.

**Watch for:** removing a card from the flow interacts with C1's navigation bug. Do C1 first or the
two fixes will be hard to attribute.

### PLAN §C3 — Read-out everywhere (1 session)

Speech buttons on every vocabulary field and every chapter text field, on the final card too, with
**each item read in its own language** (vocab in target, translation in source). Clicking an
individual vocab item reads it.

This is the natural home for **"show the no-TTS-available message when the user clicks speech and
that language has no voice"** — the app already has `_ttsNoVoice` and the 🗣 pill for exactly this,
so it is wiring, not new behaviour. It also inherits `v79_n`'s `_speechLocaleFor`, so per-chapter
speech locale applies automatically. **`unit-speech-locale` §11 already guards that a voice picked
for one language never speaks another** — the property this feature depends on most.

### PLAN §C4 — The Settings Card and floating pills (1–2 sessions) — the biggest UI change here

A cog pill next to the login pill on **all** pages, including static, absorbing: the UI control row,
speech-language setting, model selection, sound test, missing-UI-entries, teacher mode, import,
static export, learners. Plus a **global mute pill** replacing every scattered mute button — while
keeping all read-out buttons, which are a different thing.

**Acceptance details retained from the user's original UI brief:**

- The source→target language selector is visually reduced to an **arrow control**: remove its
  duplicated icons and descriptive text without changing the selected language-pair state.
- If a lesson is using speech different from its intended target/chapter/storyline locale, the SC
  shows an explicit status pill and a **one-click restore action** for the intended speech. This is
  not a second read-out control: it is state visibility and recovery for the global speech setting.
  Individual read-out buttons remain in place and continue to speak their own field language.

**Three specific risks, from this session's scars:**

1. **The static build re-implements client functions.** `build-static.js` overrides 19 of them.
   `unit-static-selectlang-tts` now guards that overrides keep their live twin's UI-refresh calls —
   **extend its `REFRESHERS` list as the SC adds refreshers.** The list is a judgement, and the test
   says so.
2. **"Available in the static page" is a requirement, not a footnote.** Model selection, import and
   learners have no meaning without a server. Decide per item whether it is *hidden* or *disabled
   with a reason* in static mode, and write the decision down — a silently missing control reads as
   a bug.
3. **The mute consolidation touches `data-mute-tip`/`updateMuteButtons`**, which already has a
   guard (`unit-tts-test-row`) that broke twice this session on text-level pins. Expect to
   re-anchor it, and re-anchor at the claim.

### PLAN §C5 — Generation Card, QC Card, flag pill (1–2 sessions)

- Generation moves off the main page into its own card, aligned with the storyline and
  "add lesson" entry points — **this is the resurrected `§0i` from `roadmap_v79.md`** (§0.2), which
  was marked BLOCKED on §1; check what that block was before assuming it is gone.
- QC bulk actions get a card with **selectable QC types** (already in the old roadmap).
- The download-flagged pill shrinks to a filled-flag pill, expanding on click, with a
  **guarded "clear all flags"** and clearing on GitHub-link click.
- Keep those three cards independently reachable: a Generation Card is the common destination for
  landing, storyline continuation, and single-chapter "add lesson" affordances; a QC Card owns bulk
  runs rather than absorbing the local item/story repair controls; the flag pill is adjacent to the
  login/SC pills and reveals its details only on demand.

### PLAN §C6 — LMGTFY widget (half a session, do it as a filler)

Self-contained and genuinely small: extend a story-interpretation prompt to emit a list of unusual
or technical terms (`«programma di ricerca»` in `tp_17851387238120000029`), render a collapsible
floating widget of search links, search engine settable in the SC.

**Two notes.** The prompt must call `scriptPinNote` if it emits target-language text —
`unit-script-pin-coverage` **sweeps the source** and a new prompt fails until classified. And
"words the model itself doesn't recognise" is a self-report; treat the list as a *suggestion
surface*, never as a claim about the language, per the "no language knowledge in the code"
principle.

---

## PLAN §4 — Track E — export (1 session, no dependencies, do it early)

Printable **(a) exams** (MCQ + text fields) and **(b) teaching material** (full story with vocab
highlights, full translation without). Both are pure transforms of data that already exists, and
`_storyWordSources(d)` is already the single collector for "what words does this chapter teach".

**Print, not PDF-generation.** A print stylesheet plus a print-optimised render costs nothing and
sidesteps §2 entirely; the browser makes the PDF. Only reach for real PDF generation if you need
server-side batch export, and that is a Track A decision.

This is the item I would slot into any session that finishes early.

---

## PLAN §5 — Track D — lesson types (1 session each, but ONE needs a ruling first)

### PLAN §D1 — Mixed-lesson composition (1 session)

Let the user pick which lessons join a mixed lesson via a dropdown of the chapter's lesson
ids/titles/types. The plan notes this could optionally include **all lessons of previous chapters**
and thereby **replace reinforce/extend**. That is the more interesting half and the riskier one:
replacing an existing feature deserves its own decision and its own release, not a checkbox in a
dropdown release. **Split it: composition first, reinforce/extend replacement second.**

### PLAN §D2 — Cases and articles — NEEDS A RULING, and it is the "no language knowledge" line

The plan asks for noun cases and definite/indefinite article distinctions (`der/die/das`,
`ein/eine`; `ova/ovo` vs `taj/ta/to`), and explicitly anticipates *"a table languages × lesson
types to indicate whether a given lesson type makes sense in that language"*.

**That table is language knowledge in the app**, and `INTERNALS.md` §4 makes its absence a design
principle with a documented list of known violations. The project has already ruled this way once,
in a neighbouring case: the `cyrillic-sr` sounds column was authored, mechanically verified, and
**reverted**, because its absence enforces a `v75_g` ruling — and `unit-intro-script` catches its
return.

So this needs an explicit decision, and there is a middle path worth considering: **let the MODEL
declare per-language applicability at generation time and cache the answer as data** (in
`languages.json`), rather than the app encoding a table. That keeps the knowledge in the tier
INTERNALS §4 assigns it to, and the cache is then a measurement, not a claim.

The "reveal the full phrase, correct article and word form together" part needs no ruling and can
ship independently.

### PLAN §D3 — Generic, story-independent lessons (1 session)

A user prompt field producing lessons not tied to a story ("train colour names, include brown").
The plan's own scoping is right: **standard vocabulary first**, one lesson type, one prompt field,
following the existing LLM-math precedent. Note the new prompt needs `scriptPinNote` (§C6) and a
`_genMeta` record like every other generator.

### PLAN §D4 — Free-text WRITING + feedback (user, `v82` cut) — a new CATEGORY, not just a new type

*"The user is supposed to WRITE a short text on a given topic, and a new model prompt receives that
text and provides feedback on typos, grammar, and eventually also content. First versions likely
already work with our current default model."*

**Architecturally distinct from every lesson type shipped so far, in one specific way worth naming
before building it:** every existing type — `standard` through `inflections` — is generated ONCE, at
chapter-generation time, validated, stored, and then PLAYED many times from that static content. This
type cannot work that way. The learner's submission does not exist until they write it, so grading it
needs a LIVE model call **at play time**, not a batch one at generation time. The only existing
precedent for a live, per-session model call is the tutor chat (`callLLMTutor`/`callLLMTutorStream`,
`OLLAMA_TUTOR_MODEL`) — not any lesson generator. That has real consequences, not just an
implementation detail:

- **The static build cannot offer it at all.** `docs/index.html` has no server behind it — that is
  the whole point of the static build — and grading needs one. Either this lesson type is excluded
  from the static export entirely (say so in the UI, the same honest-degradation call already made
  for D4/images in §9b), or it is the first feature that makes "no server needed" no longer true for
  part of the app. **Worth surfacing now, before anyone assumes it "just works" in both modes like
  everything else does.**
- **It needs a new play-time API route**, not just a new generator function — every other type's
  server-side surface is `generate*` (batch) + `qcCheck*` (batch); this needs the shape of
  `/api/tutor` (live, per-request) instead, with the SUBMITTED TEXT as the payload rather than a
  topic/difficulty pair.
- **There is no single "correct answer" to store or check against**, unlike every MCQ/fill-in/select
  type — the model's feedback (typos found, grammar corrections, eventually content commentary) IS
  the exercise output, generated fresh per submission, not selected from pre-authored choices. QC in
  the existing sense (checking one generator's OUTPUT against a rubric before showing it to a
  learner) does not apply the same way here — there is nothing to QC in advance, because there is no
  advance.

**Scoping, following the user's own staging:**
1. **Typos + grammar first** — the narrower, more mechanically checkable half, and the one the user
   already expects to work with the current default model.
2. **Content feedback second**, explicitly flagged by the user as likely needing a stronger model or
   more careful prompting — "does this text actually address the topic" is a harder judgement than
   "is this sentence grammatical."

**Open, not decided here:** what the learner-facing UI is (a text box + submit, presumably new —
nothing existing takes free-form prose input at play time), whether a submission is stored at all
(and if so, whether it goes in `lessons.json` alongside everything else, or somewhere separate, given
it is per-learner content generated at play time rather than per-topic content generated once — closer
in shape to `APP.progress`/observations than to a lesson's own `items`/`vocab`), and whether/how this
interacts with the learner-progress and coverage machinery every other exercise type feeds (`markSolved`,
`_wordProgress`, the pass mark) — a free-text submission has no `qid` in the existing sense.

---

## PLAN §6 — Track F — QC rework (1 session, mostly independent)

Ordered by how much each is worth:

**F1. Word-forms QC: detect distractors that also make an error-free sentence.** This is the same
defect `probe_word_forms_v79i.js` measures, now stated as a QC job. **Read the probe's header
first**: it is explicitly *"a measuring instrument for a human, NOT a validator — rejecting these
mechanically would mean the app encoding per-language grammar, which the model owns."* So F1 must
be **model adjudication**, not a deterministic rule, or it walks straight into §5's problem.

Also carry forward the `v80` finding: the regenerated lesson went from *5 items all two-choice* to
*6 items with 1 two-choice*, while the corpus-wide percentage stayed flat at 15% because
un-regenerated lessons dominate the denominator. **QC on old lessons is therefore worth more than
another prompt revision**, and F1 is how you get it.

**F2. The malformed word-forms items** in `tp_586040741` — the blanked word shown in the sentence
with the underline appended at the end (`"...across the path.___"`, answer `cast`). This one **is**
deterministic and safe: the item is broken as *structure*, independent of language — the answer
token appears in the stem and the blank is not where the word was. No language knowledge needed.
~~**Do this one first; it is the cheapest real win in the whole document.**~~ **✅ SHIPPED as
`v80_g`** — the blank-position half. The answer-visible half was measured and deliberately left
unenforced; see the `v80_g` entry at the top of this roadmap.

**F3. THE ARTICLE MESS — diagnosed at the v80 cut. It is a rule-31 case, and the "fixes" are why it
got worse.**

The user reports German->French vocab in `tp_17869977371640000022` full of pairs where the German
side carries an article and the French side does not. Both languages HAVE articles, so this is not a
"one language lacks them" case. **The generation prompt contains two rules that contradict each
other**, and the contradiction is not subtle once both are read together. From `prompts.json`,
`vocab.system`, in this order:

1. `BASE FORM ONLY: give every vocab word in its dictionary/citation form — verbs in the infinitive,
   nouns in the singular (with the usual article where the language uses one)`
2. `ARTICLE SYMMETRY for nouns: give the article on BOTH sides ("der Hund" <-> "il cane") or on
   NEITHER side ("Hund" <-> "cane") — never an article on one side only.`

**Rule 1 is PER-SIDE and appeals to each language's own citation convention. Rule 2 is a CROSS-SIDE
constraint.** They cannot both be satisfied for a pair whose two languages have different
lexicographic conventions — and German/French is exactly that pair: German dictionaries cite nouns
**with** the definite article because it carries gender (`der Hund`), French dictionaries cite the
bare noun with a gender tag (`chien, n.m.`). **A model following rule 1 faithfully produces
`der Hund` <-> `chien`, which is precisely the reported defect.** Rule 1 is stated first and is
framed as the definitional rule ("BASE FORM ONLY"), so it wins.

**Why it got WORSE with the attempts to fix it — three compounding reasons:**

- **The symmetry rule was ADDED next to the contradicting clause rather than reconciling it**
  (rule 31: *before strengthening an instruction, check whether it is already there and being
  CONTRADICTED*). This is the same failure as `v79_i`, where the word-forms prompt banned indecidable
  distractors and recommended them three bullets earlier. Adding a prohibition beside a live
  contradiction does not remove the contradiction; it makes the prompt longer and the behaviour less
  predictable.
- **A deterministic normaliser was removed for good reasons, and nothing replaced its coverage.**
  `server.js:4438` records it: the old code split `hail` into `grandine`/`hail` and *"dropped the
  gender an Italian learner needs while symmetric siblings in the same lesson kept theirs. It made
  lessons LESS consistent than it found them."* Removing it was right — but the comment then says
  *"the generation prompt still forbids a one-sided article; QC is the safety net"*, and the
  generation prompt does **not** forbid it cleanly, because of rule 1. **The safety net was hung on
  a claim that is not true.**
- **The QC check is context-dependent and degrades quietly.** `qcCheckPair` takes `siblings` — the
  other vocab items in the same lesson — and `server.js:1536` states that omitting them *"degrades
  the article check to a judgement without context"*. So the check's strength varies with what it is
  handed, and a lesson generated wholly one-sided gives it consistent-looking siblings to agree with.

**A fourth contradiction, across prompts:** `vocab` asks for nouns **with** the article; `grammar`
asks for `"{L} noun in singular form (no article)"` and adds `"target" must have no article
prepended`, carrying the article in a separate field. Two lesson types, two opposite conventions for
the same noun. That is defensible per lesson type but it means "the article convention" is not one
thing in this codebase, and any fix must say which convention applies where.

**The fix, in order, and NOT another sentence of prohibition:**

1. **Remove the contradiction.** Rule 1's parenthetical `(with the usual article where the language
   uses one)` is the clause to change — it is what invokes per-language citation convention. Decide
   which convention wins for vocab pairs and state it ONCE.
2. **Add a WORKED COUNTER-EXAMPLE, not a rule.** The word-forms prompt was fixed this way in
   `v79_i`: a shown broken item plus its repair. Here that is `der Hund <-> chien` marked BROKEN,
   with `der Hund <-> le chien` and `Hund <-> chien` both shown as acceptable.
3. **Then measure.** A probe over the corpus counting one-sided-article pairs per language pair,
   with the numbers in its header, so "it got worse" stops being an impression. **The `v80` lesson
   applies: the corpus-wide rate cannot move until lessons are REGENERATED, so measure per
   `_genMeta.at` cohort, not in aggregate** — that is exactly how the word-forms improvement was
   nearly missed.
4. **Only then** revisit whether the QC check should be strengthened. It may be adequate once it is
   no longer compensating for a self-contradicting prompt.

**Note this is downstream of the D1 ruling.** "Does this language use articles at all" is now a
model-declared, cached fact — so the symmetry rule can consult data instead of asking the model to
re-derive it inside every generation.

**F3c. MEASURED at the v80 drop — the contradiction produces a COIN FLIP, not a constant bias.**

The user reported that chapter 1 of the new German->French storyline had the asymmetry and chapter 2
did not. Measured on the drop:

| chapter | asymmetric vocab pairs |
|---|---|
| `tp_17869977371640000022` "Stille vor dem Winter" | **7 of 8** |
| `tp_17869980065780000104` "Brücke der Existenz" | **0 of 8** |

And the two are **generated identically**: same model (`qwen3.6:35b-a3b`), same `_genMeta.type`
(`standard`), `rejected: 0` on both, **four minutes apart**. No different prompt, no different code
path, no retry that could explain it.

**This is the strongest available evidence for the rule-31 diagnosis**, and it sharpens it: a
self-contradicting instruction does not bias the output consistently, it makes the outcome
**unstable** — the model resolves the conflict differently from sample to sample. Two consequences:

- **It explains "seems to have gotten worse".** With a coin flip, a run of bad luck reads exactly
  like a regression, and a run of good luck reads exactly like a fix. Neither impression is
  measuring anything.
- **Therefore a single lesson can never validate the fix.** N=1 cannot distinguish "corrected" from
  "got lucky", and chapter 2 above is precisely a lucky sample of the broken prompt. **The F3 probe
  must sample MANY lessons per `_genMeta.at` cohort and report a RATE with its denominator**, not an
  example.

The failure direction also confirms the mechanism exactly: every asymmetric pair has the German
source carrying the article (`das Eichhörnchen`, `der Winter`, `die Begegnung`) and the French target
bare (`écureuil`, `hiver`, `rencontre`) — German citation convention applied on one side, French on
the other, which is what rule 1's `(with the usual article where the language uses one)` asks for.

**F3b. QC PROMPTS BELONG IN `prompts.json` (user, v80 cut).** Partly true already: `storyQc` and
`srcRepair` live there and are read via `fillPrompt(PROMPTS.storyQc.system, ...)`. **The lesson-level
QC prompt is still inline in `server.js`.** Moving it is small, but the user's second clause is the
valuable half — *"more systematically aligned with the generating prompts"*. The article mess is the
argument for it: **a QC prompt that checks a convention lives in a different file from the
generation prompt that sets it, so the two drift and nobody notices.** Pairing them — same file,
adjacent keys, ideally a shared fragment for any rule both must state — is what would have made this
contradiction visible. Do it as part of the F3 fix, not separately.

**F4. Run-level QC token accounting** (§0.4) — small, do it alongside the QC card.

---

## PLAN §7 — Track A — ingest and the parallel curriculum pipeline (multi-session)

### PLAN §7.0 — the new lesson architecture: analyse and plan in parallel, deliver through the existing app

**Direction accepted by the user at the `v81_l` cut.** The new approach is different enough upstream
that TEXT → ANALYSIS → CURRICULUM PLAN should be designed cleanly, but it must **not** become a
second app. Keep the existing player, editor, export, static publishing, learner progress, and
playable lesson contract as the delivery path until the new route has demonstrated coverage, quality,
and recovery across several languages. The critical change is that lessons cease to be primarily
generated chapter-by-chapter: they execute a persistent learning plan over the whole text. A chapter
remains a learner delivery boundary, not the boundary of curriculum intelligence.

```
text source (PDF / text / markdown / comic / generated story)
  → canonical text model (story → chapters → sentences → stable spans/tokens)
  → language analysis (lemmas, forms, senses, phrases, frequency, script, provenance)
  → curriculum planner (what matters in this text, chapter, and for this learner?)
  → lesson plan (concept → exercise types, ordering, prerequisites, reason)
  → generator / validator (existing playable lesson types, richer metadata)
  → existing player / editor / export / static build
  → append-only observations → per-learner BKT skill estimates
```

**The semantic ladder is not "every word is a skill":**

```
token in sentence → normalised surface → lemma or multiword phrase → sense in context → language skill
```

Thus several forms such as *went*, *goes*, and *going* can contribute to one `go` vocabulary skill
and separate form skills; *take care of* may be one phrase concept, not three unrelated words.
Likewise, corpus presence is **not** evidence that a learner knows a word or that it has the same
sense. Reuse prior analysis, verified lemma data, exercise templates, and error patterns; let the
planner decide whether the learner needs the concept.

**Version and provenance are mandatory from the first record, not a migration afterthought.** The
planned fields are `topic.analysisVersion`, `topic.curriculumVersion`, `lesson.pipelineVersion`,
`lesson.sourceSpans`, `lesson.skillLinks`, and `lesson.planReason`. Every derived lemma, phrase,
frequency value, or model decision must state how and from which stable source span it was derived.
That makes re-analysis honest: an older result is visibly old rather than being represented as if the
current logic had produced it.

**Relationship to shipped Track B:** B1–B4 already supply the bottom of this diagram—append-only
learner evidence, reviewed target-language canonical IDs, vocabulary lesson links, and shadow BKT.
They are deliberately narrower than the new planner: current B3 tags only new standard vocabulary
lessons, and B4 controls nothing. Future `lesson.skillLinks` must preserve that reviewed canonical
identity rather than invent per-generator dialects.

**Migration sequence (each stage is independently useful):**

1. **CP1 — canonical text + analysis records, report-only.** Define stable story/chapter/sentence/
   span/token records and provenance. Analyse a small representative corpus without changing any
   existing lesson, learner state, player, or publishing output. **This is the next implementation
   slice.**
2. **CP2 — analysis report.** Add lemma/form/phrase/sense/frequency/script proposals and retain the
   exact derivation or model evidence. This is language analysis, not client-side morphology; it
   must expose uncertainty/review rather than silently guessing.
3. **CP3 — proposed curriculum plan.** Emit concepts, reasons, prerequisites, ordering, and suitable
   existing exercise families for a text/chapter/learner. Compare it with current generated lessons
   on a small representative set; still emit no new lessons.
4. **CP4 — one lesson family through the existing contract.** Start with vocabulary meaning/form,
   validate it, and retain the legacy generation route in parallel. Only then add language-specific
   families such as conjugation, grammar, articles, error patterns, and comprehension.
5. **CP5 — consume the plan read-only.** Let the red→green text progress card read analysis and skill
   data with a legacy fallback. BKT remains a measurement until a separate product ruling. **A narrow
   slice of this already shipped**: `cp5ShadowFor()`/`GET /api/cp-shadow/:chapterId` (server.js) reads
   CP3's `curriculum-plan.json` and paints a concept-count summary into the chapter-complete popup —
   but this reads CP3 (concepts), not CP1/CP2 (per-token lemma/form/sense). **Item W ("text explorer"
   mode, roadmap section above) is THIS bullet's per-token half — ✅ SHIPPED `v86_o`**: a background
   CP1+CP2 job + per-chapter cache, `GET /api/analysis/:chapterId` mirroring `cp5ShadowFor`'s own
   shape, and a client toggle view painting real per-token lemma/form/sense directly from the story.
   See item W's own roadmap section for the full build + live-verification write-up.
6. **CP6 — retire nothing by assumption.** Consider retiring legacy generation only after the new
   route has measured multilingual coverage, quality, recovery/re-analysis, and player compatibility.

This section changes architecture upstream, not the current delivery shell. It does **not** authorise
a parallel player, new progress system, bulk corpus rewrite, or a BKT-driven gate.

> **📝 NOTE, added after `v83_m` shipped, during planning for browser integration (user conversation,
> not yet built) — MULTI-CHAPTER / STORYLINE-WIDE GENERATION.**
>
> Batch processing across many chapters in ONE run already works today — every CP1-4 CLI already
> accepts `--limit N`/`--all`, proven at `v83_h` (24 chapters, 14 languages, one command). What does
> **not** exist yet is the pipeline being AWARE it is looking at one continuous, ordered story.
> Two genuinely different pieces of work were distinguished in that conversation, and they should
> stay distinguished rather than being built (or deferred) as one lump:
>
> 1. **Cross-chapter DEDUPLICATION — SIMPLE, do this early, probably alongside the first browser-
>    reachable slice.** Before choosing chapter N's vocabulary, exclude lemmas already taught in
>    chapters 1…N-1 of the SAME storyline. Needs no new model call and no new pipeline stage:
>    `compareWithExistingLessons` (CP3) already does almost this — it just needs widening from "this
>    chapter's own lessons" to "every earlier chapter's lessons in the storyline" (a loop over the
>    storyline's earlier topics, unioning their `vocab.target` values) — plus a filter step in CP4
>    before it picks its top N concepts. `emitVocabLesson` already degrades cleanly to "skip, nothing
>    new to teach" when a chapter's remaining vocab concepts are empty, so "generate less or no
>    lesson for an already-covered chapter" falls out for free once the filter exists. **Without
>    this, running the pipeline across multiple chapters of one story has a real failure mode**: the
>    same highest-frequency words get re-proposed as "new" in every chapter, since CP3's ranking has
>    no memory between chapters today — worse than the legacy generator, which already avoids this
>    via its own `chainVocab`/`vocabMode:'extend'` mechanism. Mirror that existing mechanism's
>    *intent*, not its implementation (CP3's concepts have stable ids; the comparison can be a lookup
>    against `conceptId`/`lemma`, not a fuzzy word-list diff the way the legacy prompt hint is).
> 2. **Genuine cross-chapter curriculum SEQUENCING — moderate effort (roughly CP3-sized), NOT
>    necessary for now.** Deciding WHAT to teach WHEN across a whole story's arc (e.g. "teach this in
>    chapter 2 because chapter 5's phrase needs it as a prerequisite") is real design work: it needs
>    every chapter's analysis available before any one chapter's plan is finalised, and a genuinely
>    different data shape (a storyline-level plan, not N independent chapter-level ones). **Explicitly
>    NOT authorised or scoped by this note** — defer until (1) has shipped and been used for real, and
>    only revisit if the simpler dedup alone proves insufficient in practice.
>
> Neither piece changes CP1 or CP2 at all — both are CP3/CP4-only extensions. Do not build (2) by
> assuming it is a small extension of (1); they were kept separate on purpose in the conversation that
> produced this note, precisely because the two have very different effort/necessity profiles.

> **📝 NOTE, added after `v83_p` shipped — REAL-WORLD EVALUATION, `v83_n`→`v83_p`.** The user ran
> `apply-cp-lessons.js` for real, twice, against the SAME chapter (`tp_17865786341910000220`,
> "Vittoria Ingannevole", de→it, 8-word vocabulary lesson each time), and reviewed both outputs
> word-by-word against the real source text. This is the first genuine quality signal Track A has
> produced — recorded here so it is not lost to chat history, and so a future session does not
> re-derive it from scratch or re-litigate a question already answered by real evidence.
>
> **Run 1 — `qwen2.5:7b`** (the throwaway-server default model this whole project's own docs
> recommend for quick checks — NOT this topic's own legacy-generation model): 2 of 8 words wrong.
> `"riesen"` proposed as the LEMMA for a token that appears singular in the story (`RIESE`) — a real
> lemmatisation error (plural form proposed for a singular occurrence) — glossed `"mostro"`
> ("monster") instead of `"gigante"` ("giant"). `"geben"` (from the idiom "es gibt") glossed
> `"offre"` ("offers") instead of correctly reading the idiomatic "there is/exists" sense. One more
> item, `"ein"` (the bare indefinite article), was translated with a stray trailing hyphen ("un-",
> not a real word) — weak, though not as clearly wrong as the two above.
>
> **Run 2 — `qwen3.6:35b-a3b`** (the SAME model this topic's own LEGACY lessons were generated
> with, chosen deliberately for a fair, apples-to-apples comparison, and the run that surfaced the
> `v83_o` `think:false` bug before it could complete): ZERO wrong translations. `"Riese"` correctly
> lemmatised (singular, matching the story) and correctly glossed `"gigante"`. `"geben"` correctly
> read as `"esistere (in senso impersonale)"` — the idiomatic sense, explained. A NEW item this run
> surfaced, `"sie"`, was correctly traced back across two sentences to its real antecedent ("die
> Regierung") and glossed accordingly — genuinely sophisticated contextual disambiguation, exactly
> what CP2's design intends. This SAME run is also what surfaced the `v83_p` register-mismatch bug
> (`"kommen"`/`"venne"`), independent of translation correctness — a lemma/surface packaging bug at
> CP4, not a CP2 language-analysis error.
>
> **What this evidence actually supports**: the two clear CP2 accuracy errors in run 1 look like a
> SMALL-MODEL limitation, not a flaw in the pipeline's own design — run 2, same chapter, same
> prompt, larger model, zero equivalent errors, plus noticeably more sophisticated context-tracking.
> **This should inform any future decision about which model a browser-triggered CP2 call defaults
> to** — `qwen2.5:7b`-class models are cheap in a throwaway-server dev-loop sense but demonstrably
> weaker for this specific task; do not assume the DEFAULT dev-check model is an adequate PRODUCTION
> default without re-measuring.
>
> **Two gaps this evidence surfaced that remain OPEN, unaffected by `v83_o`/`v83_p`'s fixes** (first
> named in `v83_n`'s own roadmap write-up, repeated here since they are exactly the kind of finding
> this note exists to keep from being lost): (1) **no function-word filtering** — a bare article
> (`"ein"`) was proposed as a standalone vocabulary item in BOTH runs, regardless of model size; CP2/
> CP3 have no mechanism to recognise and exclude/deprioritise pure grammatical function words the
> way the legacy generator's own prompt evidently does. (2) **confidence does not survive into CP4's
> written lesson** — CP2/CP3 track a `confidence` per proposal, but `emitVocabLesson`'s final
> `vocab[i]` object never carries it; a reviewer (or a future UI) cannot tell from the written lesson
> alone which words the model was actually unsure about, even though that information existed
> earlier in the pipeline and was simply dropped at the last packaging step.

Sequenced so each step is independently useful:

1. **A1 — plain text / markdown upload with a separate chaptering card.** No §2 dependency at all,
   and it builds the chaptering UI that PDF and comics will reuse. **Also delivers the plan's
   "allow to edit the source field when generating from an uploaded text"**, which appears twice in
   the plan and is small.
2. **A2 — language detection**, both the cheap script-based path and the LLM query. The
   script-based half already has machinery: `backfill-script.js` and the `script` stamp.
3. **A3 — the PDF word map** (§2.5/§2.6 Tier 0), not PDF extraction, which already works. Keep the
   per-item transforms `_extractPdfText` currently discards.
4. **A4 — comics via vision model.** Needs no dependency and no PDF ruling, so it can start
   BEFORE A3. **Begin with the §2.4 overlay probe** against `murmel-comics.org/stories/2640`: boxes
   drawn back over the source page, eyeballed by a human, numbers recorded in the probe header.
   Panel *enumeration* and reading order are the unknowns, not OCR.

**Check `/api/generate-book` first** — it exists at `server.js:6515` and may already do part of A1.
And `roadmap_v80.md` §0b records import **"new" mode as POSTPONED by the user**; A1 overlaps it, so
reconcile rather than re-decide.

---

## PLAN §8 — Track B — pedagogy (UNBLOCKED; staged so each step stands alone)

`bayesian_knowledge_tracing.md` is in `build_history/`. §0.1 evaluates it. The staging below follows
from that evaluation, and its shape is: **instrument, then tag, then run BKT in the dark, then
show it, and only then — maybe — let it control anything.**

**B1 — the observations log (do this FIRST, and it can start today).** Append-only, per §13:
`{userId, skillId, correct, evidence, storylineId, lessonId, timestamp}`. Two properties matter more
than the schema: **record the FIRST attempt distinctly from retries** (§0.1's measurement), and
record even when `skillId` is unknown — an observation tagged `null` is recoverable later, an
observation never written is gone. **This is worth doing before any of Track A**, because every day
it runs is a day of evidence BKT will have, and the existing counters cannot be replayed into it.

**B2 — the skill registry and canonicalisation. ✅ SHIPPED at `v81_k`.** The registry is separate
from `lessons.json`; model proposals resolve only through explicit target-language registrations or
reversible same-type aliases. Source is evidence context, never part of a skill's canonical ID.

**B3 — tag NEW lessons at generation. ✅ SHIPPED at `v81_k`.** One lesson type first: standard
vocabulary. Every amended prompt still calls `scriptPinNote` and records `_genMeta`; unregistered
proposals stay pending beside the row, and no historical topic was backfilled.

**B4 — BKT in SHADOW MODE. ✅ SHIPPED at `v81_l`.** `pMastery` is recomputed only from reviewed
skill-tagged observations and shown nowhere. It runs alongside the existing `chapterComplete`/
pass-mark gate, logging only changed disagreement pairs; it cannot influence progression. It can now
accumulate the evidence that tells you whether §5/§6 are worth adopting.

**B5 — surface it read-only.** The §11 aggregate views (vocabulary/grammar/word-forms/reading), and
§8's corpus-vs-independent split, which is free once `evidence` is recorded. Still controlling
nothing.

**B6 — the scoped tutor.** *Not* the adaptive tutor of the user's §4 — the small one: a chapter-
scoped window that knows the story up to and specifically about this chapter. It is independently
useful, needs no BKT, and belongs with Track C's card work. §9's confidence-weighted chat evidence
comes much later and needs an update rule the document does not specify.

**B7 — mastery-driven progression (§5/§6). A PRODUCT DECISION, and possibly never.** It replaces a
gate the user has ruled on repeatedly. Do not start it without an explicit ruling, and not before B4
has shown what would actually change.

**B8 — the corpus.** Automated meet & greet lessons like `sl_1271936135`, plus out-of-copyright
texts. A content project as much as a code one, and it gates recommendation (§6 of the user plan):
a recommender over 90 storylines recommends the same things to everyone.

**B9 — prerequisites and CEFR (§14, §11).** Last. **CEFR mapping is the same language-knowledge
ruling as §5's languages x lesson-types table** — a CEFR level per skill is a language judgement, so
it belongs in data the model fills, not in a table the app ships.

**Still true, and it constrains B4 hardest:** at a 3.0% error rate a difficulty policy has almost no
learner signal to work with and must come from corpus statistics first. The two measurements already
identified remain the right prerequisites — **inflection share** and **learner-known share** — and
one pass over the same inventory yields both.

## PLAN §9 — Cross-cutting risks

**R1 — The single file is at 1.14 MB.** Every track adds to it. Nothing in the plan addresses it,
and `check-inline.js` runtime and browser parse time both scale with it. **Decide before Track A
whether the client stays one file**, because the ingest UI is the largest single addition proposed.

**R2 — The static build will drift again.** It re-implements 19 functions. Every card in Track C
either works in static mode or is deliberately absent, and `unit-static-selectlang-tts` only guards
the refresher pairing. **Expect to extend that guard once per Track C session.**

**R3 — Pricing implies auth, and auth is nowhere in this plan.** "Requires subscription to stably
store progress", "only direct LLM use will cost" — none of that exists today. It is at least its own
track and possibly its own product decision. **It should not be discovered mid-Track-B.**

**R4 — The plan has no failure mode for the model.** Ingest, tutor, QC adjudication and term
extraction all assume a working LLM. The app already handles "no LLM" gracefully; each new
model-dependent feature needs the same, and the plan's own pricing model makes some of them
*expected* to be unavailable.

**R5 — Rule 24 applies to this document.** It is a plan, not a guard. Nothing here is protected
until it is a test.

---

## PLAN §9b — THE DECISIONS STILL OUTSTANDING — the complete list

Everything else in this document is buildable without asking. These are not.

**D1. The languages x lesson-types table — RULED at the v80 cut (user chose the proposed option).**

**Applicability is MODEL-DECLARED, CACHED AS DATA, TERNARY, WITH PROVENANCE.** Not a table the app
ships, and not a question asked at every generation.

The argument that decided it, kept because it is the reason and not just the outcome: the plan's own
example proposed *"ova/ovo vs. taj/ta/to"* as Serbian articles. **Serbian has no articles.** Those
are demonstratives, and the nearer analogue to definiteness in Serbian is **adjective aspect** —
the definite/indefinite adjective forms (`star` / `stari`) — a different mechanism on a different
word class. So the cell "Serbian x articles" is neither `true` nor `false`, and the honest answer
*"no articles; definiteness surfaces through adjective morphology"* is **more useful to the
generator than the boolean**, because it says what to teach instead. A boolean table is wrong on its
first interesting cell, and the interesting cells are the only ones needing a table at all.

**The shape:**

- **Ternary plus a note**, never boolean: `yes` / `no` / `different-mechanism`, with a sentence.
  The note is what turns a refused "cases" request for Italian into a useful preposition lesson.
- **Cached in `languages.json`**, keyed by `(language, lessonType)`, **with `_genMeta`-style
  provenance** — model, date, prompt version — exactly as lessons carry it. That is what makes this
  a MEASUREMENT rather than an authored claim, which is the tier INTERNALS §4 permits, and what
  makes it re-derivable when the prompt improves and auditable when it is wrong.
- **A human override wins and is MARKED as an override**, distinguishable from a cached answer. The
  user is the language authority this project trusts (`v75_g` is exactly that), and an override that
  looks like a cache entry loses the ruling behind it.
- **Asked once, not per generation.** Per-generation is non-deterministic — the same language must
  not get a conjugation lesson on Tuesday and not on Wednesday — and pays tokens repeatedly for a
  stable fact.

**Why not the alternatives:** a hand-authored table scales badly across two growing axes (33
languages x ~14 types) and caps quality at the maintainer's linguistics; no gating at all produces
the incoherent lessons this is meant to prevent.

**The honest cost, recorded rather than glossed:** a wrong CACHED answer is stickier than a wrong
per-call one, because nothing re-asks. Provenance is the mitigation — a prompt-version change can
invalidate and re-derive the affected cells.

**Guard it the way this project already guards this shape:** a source SWEEP that fails when a lesson
type has no applicability policy, mirroring `unit-script-pin-coverage`, which sweeps the source so a
new prompt cannot skip `scriptPinNote`. Rule 32 — guard the enumeration, not the cells that happened
to get filled.

**Scope limit:** this decides only whether a lesson is OFFERED. Whether the generated lesson is any
good remains QC's problem (§F). And the other half of the original request — **revealing the full
phrase with the correct article and word form together** — needs no table and can ship at any time.

*Unblocks: D2 (cases/articles), D3 (generic lessons) partly, B9 (CEFR, same mechanism).*

**D2. Mastery-driven progression (BKT §5/§6, plan §8/B7).** Replaces the `coverageTarget` pass mark
you have ruled on repeatedly. §8/B4 runs BKT in shadow mode first, so this can be decided from a
disagreement log instead of a prediction. **Do not decide it now** — decide it when B4 has data.
*Blocks: B7 only.*

**D3. Corpus licence AND suitability.** `murmel-comics.org` page B is signed by an identifiable
artist, so the licence question is concrete, not hypothetical. Separately, suitability is its own
axis: page B is political satire, page A is about bereavement — both legitimate reading, neither
automatically right for an auto-generated beginner corpus. *Blocks: B8, and the comic demo.*

**D4. Uploaded images — RULED: STORED SERVER-SIDE (user, v80 cut).**

Three consequences that follow immediately and are design constraints, not opinions:

- **Images must NOT go into `lessons.json`.** It is a single JSON file that every test loads, that
  `build-static.js` bakes wholesale, and that the corpus checks parse repeatedly. Base64 comic pages
  would multiply its size by orders of magnitude and slow the entire suite. **Store as files in an
  asset directory, reference by path from the topic record** — the same relationship `docs/` already
  has to the corpus.
- **The static build needs a decision it does not have yet.** `build-static.js` bakes lessons into
  `docs/index.html`; it cannot bake megabytes of PNG. Either the static export omits images (and
  image-derived chapters degrade to text-only), or it copies assets alongside and rewrites paths.
  **Cheapest honest answer: text-only in static, and say so in the UI** rather than shipping a
  storyline whose pages silently fail to load.
- **Retention makes D3 sharper, not softer.** Storing a signed artist's page server-side is a
  stronger act than transiently reading it. The licence question moves from "can we display this"
  to "can we host this".

**D5. Does the client stay ONE file?** `index.html` is 1.14 MB with a ~972 KB inline script, and the
ingest UI is the largest single addition proposed. Note §2.5 shows the property is **already**
partly relaxed — pdf.js and KaTeX both load from CDN — so the question is where the line actually
is, not whether to cross it. *Blocks: nothing immediately; gets harder the longer it waits.*

**D6. Observations log scope — RULED: BOTH, keyed by a stable local id an account can adopt
(user, v80 cut).** Payment and accounts remain open; this decides only the key, which was the part
that blocks §8/B1.

**The design that follows, with the traps named:**

- A client-generated stable id (UUID) in `localStorage`, written on first observation. Every
  observation carries it. No account needed to start recording — which is what makes B1 startable
  now.
- **Adoption must be a LINK, not a rename.** An account accumulates a SET of local ids: one per
  browser and device. Re-keying observations to a `userId` loses the ability to adopt a second
  browser later, and breaks if two devices are adopted in either order.
- **Therefore an observation's identity key is the local id, permanently**, and `userId` is a
  resolved attribute. This is the choice that is expensive to reverse, so it is stated here rather
  than discovered at implementation.
- **Two traps to handle explicitly:** a browser adopted by account A and later signed into account
  B (the observations do not move — they were A's evidence when made), and clearing `localStorage`
  (the evidence is orphaned, not lost; an un-adopted id is simply never claimed).
- Pseudonymous by construction, which is the right default for evidence collected before anyone has
  agreed to anything.

**D7. Does mixed-lesson composition REPLACE reinforce/extend (§D1)?** Replacing a shipped feature
deserves its own release and its own decision, not a checkbox. *Blocks: the second half of D1.*

**D8. Duplicate storyline titles — RESOLVED IN THE DATA (user renamed one to "Dough of the
Ancients 2" at the v80 cut).**

The earlier ruling was "keep both identical", which would have broken the `v79_k` fork marker for
that pair. The rename removes the defect at its source and is the better fix — the marker renders
the other storyline's `icon + title`, and two distinguishable titles is exactly what it needs.

**The guard is still worth building, but it is now PREVENTIVE, not corrective**, and should be
described that way rather than as a bug fix: for every fork in the corpus, the marker must be
distinguishable from the open storyline's own label. Nothing in the data enforces unique titles, so
a future duplicate would silently reproduce the defect. `unit-fork-display` already sweeps forks and
can carry the assertion in a few lines. **Lower priority than it was — it now protects against a
recurrence rather than fixing a live problem.**

> **✅ SHIPPED as `v80_h`.** The rename was CONFIRMED in the tree first, as the note below asks
> (0 duplicate-title groups across 91 storylines), so this landed as preventive. The marker now
> falls back to naming the branch's own chapter, and `unit-fork-display` §8 injects a synthetic
> duplicate AND an empty title so the sweep cannot pass vacuously. Revert-verified.

**~~Note for the next data drop~~ — DISCHARGED at `v80_h`:** the rename has ARRIVED. The tree now
carries "Dough of the Ancients 2" and 0 duplicate-title groups. Original note follows.

**Note for the next data drop:** the tree at this cut still carries the OLD duplicate titles; the
rename lives in the user's copy. The next `lessons.json` will bring it, and a title change is
exactly the kind of quiet data movement the session protocol says to diff for rather than assume.

## ✅ PLAN §9c — THE STORYLINE TITLE IS NEVER GENERATED FOR A NEW BOOK — **SHIPPED at `v80_l`**

> Fixed by option 2 below (mark the placeholder), with `v78_r` unweakened and every authoring path
> clearing the flag. All 91 existing storylines keep their titles. See the `v80_l` entry.
> Diagnosis kept in full:

**User report:** generating a multi-chapter German->French storyline skipped the title with
`Storyline title: keeping existing "ein eichhoernchen trifft ein murmeltier — 1"`, and the title had
to be made by hand afterwards.

**Diagnosed, and it is a precondition that stopped being true.** `server.js:5348` guards the title
generation with `v78_r`'s rule — *"only when there is none. A continuation must not rename a
storyline the learner already has"* — which is correct and was a user ruling. But the storyline
record is created **earlier in the same flow**, at `server.js:5207` and `5215`:

```js
upsertStoryline({ id: slId, title: chain[0], icon: '📖', chapters: chapterIds, ... })
```

`chain[0]` is the FIRST CHAPTER'S TOPIC NAME — here `"ein eichhoernchen trifft ein murmeltier — 1"`,
complete with the auto-numbering suffix. **So by the time the guard asks "is there a title?", there
always is one.** The `else` branch that calls `generateStorylineTitle` is unreachable for any
storyline created through this path. The title is not skipped because the storyline is a
continuation; it is skipped because a PLACEHOLDER was seeded as if it were an authored title.

**The guard is right and must not be weakened** — `v78_r` exists because regenerating a title from
the new chapters alone replaced a whole-story title with one about its tail. The fix is to make the
guard able to tell a placeholder from a real title. Options, in preference order:

1. **Do not seed a title at all** for a new storyline (`title: ''` or omitted), letting the existing
   guard do exactly what it says. Cleanest, but every reader of `sl.title` must tolerate an empty
   one until the post-pass runs — check the storyline list, the fork marker (which renders
   `icon + title`), and `build-static.js`.
2. **Mark the placeholder** — `titleAuto: true`, cleared when a real title is generated or the user
   edits it. Explicit, survives a crash between the two steps, and makes "was this authored?"
   answerable elsewhere too. **Recommended.**
3. Compare `sl.title` to `chain[0]` and treat equality as absent. Cheapest, and wrong the moment a
   user deliberately names a storyline after its first chapter.

**Guard it where the claim is observable:** a new multi-chapter book gets a title that is NOT its
first chapter's topic name, and an EXISTING storyline gaining a chapter keeps its title unchanged.
Both halves are needed — the second is the `v78_r` ruling, and a fix that only asserts the first
would re-open it.

**Scope checked, not assumed:** the same `_slPre2` pattern guards the storyline SUMMARY at
`server.js:5373`, but **`summary` is never seeded** by `upsertStoryline` — the only writes are the
generated one and the user's edit. So the summary guard works as intended and **this is a
title-only bug**. Fix the title; leave the summary path alone.

## PLAN §10 — Suggested next three sessions — revised after the v80 rulings

Four decisions landed at this cut (§9b D1, D4, D6, D8), which changes what is startable.

1. **Repair and reconcile.** The two restored roadmap sections at the top of `roadmap_v80.md`'s open
   block — strike what this plan supersedes **with a pointer**, keep what is still open. Then
   `unit-story-unlocked-page` §6, the guard that does not discriminate under revert. Ends with a
   roadmap that describes reality and one fewer guard that cannot fail.

2. **C1 — the two progress-card gate bugs**, measured before edited (browse-forward-and-back skipping
   comprehension; replay reaching comprehension before the story unlocked), with the
   single-chapter 100% bar and the header-bar off-by-one folded in, since all three may share a root
   cause in `_slProgressStats`. Highest user-visible value in the document.

3. **Either of two now-unblocked one-session items**, whichever suits:
   - **§8/B1, the observations log** — unblocked by D6. Append-only, first-attempt distinct from
     retries, local-id keyed, recording even when `skillId` is unknown. **The only item whose value
     DECAYS while it waits**, because the existing `{seen, wrong}` counters cannot be replayed.
   - **The applicability cache** (D1) — model call, ternary + note, provenance, sweep guard. No UI,
     no migration, and it is the prerequisite for cases/articles lessons and for CEFR.

**Small and independent, for any session that finishes early:** the fork-marker fallback (D8, half a
session, `unit-fork-display` already has the sweep), **F2** the malformed word-forms detector — the
cheapest real win in the document — and **Track E**, printable export.

**Still open, and none of it blocks the above:** the corpus licence and suitability question (D3,
now sharper since images are retained), payment and accounts beyond the key design (D6), whether the
client stays one file (D5, which only gets harder), and whether mixed lessons replace
reinforce/extend (D7). **Mastery-driven progression (D2) should NOT be decided until §8/B4 has run
BKT in shadow mode and produced a disagreement log** — deciding it now would be guessing.

---

## PLAN §11 — Teacher-mode generator tutor (user, `v82` cut) — conversational authoring, not another form

*"Generator/teacher-mode version of the tutor, where you can tell it to generate lesson types in a
certain way and the LLM decides how, similar to how I can tell YOU (Claude Sonnet) to generate
storylines or lessons. For example, we want to upload a PDF and the model suggests the best
split-into-chapters splits and types of lessons to generate, and it can actually do that! This may
require a more powerful model than our current default qwen3.6?"*

**What this is, precisely, because it is easy to conflate with two things it is not:**
- **Not §7.0's CP1–CP6 pipeline.** That is a fully automated batch pipeline (canonicalize → analyse
  → plan → generate), designed to run without a human in the loop once built, chapter by chapter. This
  is the OPPOSITE shape: a human — the teacher — steers generation turn by turn through natural
  language, the way the user directs a session with Claude Code itself. §7.0 is relevant as a likely
  SUPPLIER of the underlying moves (chaptering, lesson-type suggestion) this surface would call, not
  as the thing being proposed.
- **Not the existing student-facing tutor**, reused wholesale. The `v62` tutor (`callLLMTutor`/
  `callLLMTutorStream`, one persistent floating thread, `OLLAMA_TUTOR_MODEL`) is the right STARTING
  MATERIAL — same chat shape, same streaming, arguably the same per-role model slot — but it is
  presently pure conversation: it answers, it does not act. This proposal needs the model to actually
  DO things (split a chapter, generate a specific lesson type with specific instructions), which the
  current tutor has no mechanism for at all.

**The hard part is exactly that gap: getting the model from "here is what I would generate" to
actually generating it.** Two shapes worth naming, not deciding between yet:
1. **Tool/function calling** — the model emits a structured call (`generate_lesson({type, topic,
   difficulty, instructions})`, `split_chapters({boundaries})`), the app executes it against the
   EXISTING generator functions (`ADD_LESSON_GENERATORS`, `generateOneLesson`, the book-generation
   chaptering already in `/api/generate-book`), and reports the result back into the conversation.
   This reuses everything already built for one-shot generation — the tutor turn becomes a director,
   not a new author.
2. **Structured-output parsing** — cheaper to build, more brittle: ask for a JSON plan in the reply
   and parse it, no true tool-calling needed. Degrades worse when the model doesn't comply, which is
   exactly the concern the user raised about model capability.

**The user's own capability question is the right one to lead with, not an afterthought:** local
models via Ollama vary widely in tool-calling reliability, and `qwen3.6:35b-a3b` (the current default
for `story`/`lessons`) was never evaluated for it — every existing generator call is single-shot,
structured-JSON-in-structured-JSON-out, never a multi-turn plan-then-act loop. **This is a genuine
prerequisite to measure, not a formality**: before building either shape above, run a small probe —
a handful of realistic "split this PDF into chapters and pick lesson types" requests against the
current default and whatever stronger model is being considered, and record whether tool calls (or
parseable structured plans) come back reliably. The app's model-role architecture already has the
seam this needs: a new role (or reusing `OLLAMA_TUTOR_MODEL`) that can be pointed at a different,
possibly larger model independent of `OLLAMA_LESSON_MODEL`, the same way `qc` and `tutor` already run
separate models from `story`/`lessons` today.

**The PDF example in the user's own framing is not a separate feature — it is THE first concrete use
case**, and it already has groundwork: §7.0's A1 (plain text/markdown upload with a chaptering card)
and A3 (the PDF word map) are the ingest half; this section is the CONVERSATIONAL layer that would
sit on top and let the teacher steer those same moves by instruction ("split at the natural scene
breaks, not evenly," "make chapter 3 a comprehension-heavy review") rather than only through a form.

**Not scoped here, deliberately:** which specific actions the tutor can trigger first (a minimal
useful set, not "everything §5/§7 can generate," is worth choosing explicitly rather than defaulting
to "all of it"), how a partially-wrong generated plan gets corrected mid-conversation rather than
restarted, and whether this is a NEW screen/widget or an extension of the existing tutor thread
(reusing v62's ONE continuous thread would mean student help and teacher authoring share a
transcript, which may or may not be wanted — a real product question, not a technical one).

---

## PLAN §12 — Interactive text-selection tutor (user, `v83` cut) — explain a segment, in context, via the tutor

*"On all story chapter text views, we can click words that are covered by a lesson. We additionally
allow the user to select text segments and the user can then select between 'grammar' and 'meaning'.
It could open the tutor with a pre-filled prompt asking the tutor to explain this text segment,
either the grammar or the meaning in the context of the whole story."* Plus: *"The tutor should be
primed to use the selected UI language, even if different from a specific lesson's source
language."*

**What already exists, precisely, because the new work is smaller than it looks stacked next to it:**
- **Per-word tapping is a SEPARATE, existing mechanism** — `_storyBodyHtml(d, opts)` (the ONE story
  renderer, per `INTERNALS.md` §6b) renders lesson-covered words as
  `<mark class="story-vocab-hl wp-tap" role="button" tabindex="0">`, and `tapWord(word)` opens the
  matching exercise. This request does NOT change that path — it ADDS a second, independent
  interaction (free-text-range selection) over the SAME rendered container, which must coexist with
  the existing per-word click targets rather than replace them. Concretely: a `mouseup`/
  `selectionchange` listener on the story container reading `window.getSelection()`, distinct from
  the `<mark>` elements' own `onclick`.
- **The tutor's live-call shape is the exact precedent to reuse, not invent.** `/api/tutor`
  (`callLLMTutor`/`callLLMTutorStream`, stateless, `OLLAMA_TUTOR_MODEL`) already takes `scope`,
  `story`, `wrongWords`/`knownWords`, and a `history` transcript, and already supports an `opening`
  flag that asks the model to generate ITS OWN first turn. **This request needs a DIFFERENT shape the
  tutor does not have yet**: the STUDENT's first turn pre-filled with a SPECIFIC, client-composed
  prompt ("Explain the grammar of: '<segment>'" / "Explain the meaning of: '<segment>', in the
  context of the story") — not the tutor inventing an opener, and not the learner typing it by hand.
  This is closer to `_tutorSend(opening)`'s NON-opening path (a real "student" history entry, sent as
  the first item) than to its `opening:true` path.
- **`PLAN §D4`'s two releases are the closest LIVE-MODEL-PRIMING precedent** (`v82_e`/`v82_f`,
  `roadmap_v82.md`) — a client action composes a prompt, sends it with context (the story) to a live
  route, and the RIGHT model/prompt shape for a judgement task was NOT obvious on the first attempt
  in either half of that build (the QC-vs-lesson model choice, then the advanced-furigana wording).
  Budget for the same here: whatever prompt template asks the tutor to "explain this segment" will
  likely need at least one live iteration against a real answer before it reads well.

**The two real open questions, in order of how much they change the shape of the work:**

1. **Which language does the tutor reply in — `srcLang` (current, unchanged for the REST of the
   tutor) or `APP.uiLang` (what the user is asking for HERE)?** Measured, not assumed: today
   `_tutorGatherContext()` sends `srcLang = sc.srcLang || APP.srcLang` — the LESSON's own source
   language (the "I speak X" pairing) — and the server prompt tells the tutor to write in that
   language. `APP.uiLang` is a SEPARATE, DELIBERATELY DECOUPLED setting since `v81_ac` (UI language
   moved into Settings, independent of "I speak"), so a learner can genuinely have UI language ≠
   lesson source language ≠ lesson target language — three potentially different values. The user's
   ask is explicit for THIS new flow ("primed to use the selected UI language, even if different from
   a specific lesson's source language"), but does not say whether the EXISTING general tutor
   conversation should also switch from `srcLang` to `uiLang`, or whether only this new
   segment-explanation entry point should. **Get this ruled before building the request payload** —
   it decides whether `/api/tutor` needs a new field at all (if only the NEW flow uses `uiLang`, the
   route needs to accept and honour an explicit override; if ALL tutor replies should move to
   `uiLang`, that is a wider, back-compatible-across-every-caller change to `_tutorGatherContext`
   itself, not scoped to this feature).
2. **What exactly counts as "a text segment"?** A native browser selection can span partial words,
   cross `<mark>` boundaries, include punctuation, or (worse) cross paragraph breaks inside the
   `_storyBodyHtml` container. Decide the SNAPPING rule (word-boundary-aligned? sentence-bounded?
   raw as selected?) before building the popover — this is exactly the kind of thing worth a quick
   measurement against `_storyBodyHtml`'s actual DOM shape rather than assuming `getSelection()`
   hands back something clean.

**Not scoped here, deliberately:**
- The exact UI for "select, then choose grammar/meaning" (a floating mini-toolbar anchored to the
  selection is the obvious shape, matching how most rich-text editors do it, but the app has no
  existing precedent for a selection-anchored popover to reuse or diverge from).
- Whether this reuses the ONE existing floating tutor widget/thread (`v62`, one continuous
  conversation) or opens a fresh, scoped mini-conversation per explanation — reusing the single
  thread means a segment-explanation sits in the same transcript as general Q&A, which may or may not
  read well; `PLAN §11`'s own open question about the teacher-tutor sharing a thread with the
  student-tutor is the same shape of question, unresolved there too.
- Whether "explain the grammar" and "explain the meaning" are two DIFFERENT prompt templates
  (`PROMPTS.tutor` gaining two new variants) or one template with a mode flag — a design detail, not
  a blocker, but affects `prompts.json`'s shape.
- Static-build behaviour: like `writing` (`PLAN §D4`), this needs a live model call, so it is
  unavailable in `docs/index.html` by construction. Say so honestly in the UI (same call `v82_e`
  made) rather than showing a selection popover that can never resolve.
- Whether the story TRANSLATION language (when a learner is reading the source-language rendering of
  a chapter, e.g. via `toggleExStoryLang`/`toggleCompStoryLang`) affects which text a selection
  captures, or whether selection is only meaningful over the TARGET-language story text. Given the
  whole point is explaining TARGET-language grammar/meaning, selecting over the SOURCE-language
  rendering may need to be disabled or handled differently — check `APP._compStoryLang` (the shared
  toggle both screens read) before assuming selection "just works" on whichever side is showing.

## PLAN §13 — Generator page redesign (user, `v85` cut) — step-wise wizard around what already exists

*"Let's make it a step-wise process, with individual cards and back/next navigation, where default
settings allow to just click through or skip the navigation and just generate a default set of
lessons first... we want to allow to just generate chapters without lessons first as well."* Five
steps as given: (1) language/script select, with "continue from" working for every text-source type;
(2) text source — LLM-generated, PDF/text upload, or comic/image parser, each carrying obligatory
attribution fields (author/url/etc.); (3) chaptering (word/chapter count, formatting/length/LLM split,
comic panels) — from which a storyline can ALREADY be generated (title, optional summary/storyboard,
optional spell-check round auto-generating hidden error-hunt lessons over the ORIGINAL text's real
errors); (4) lesson selection — common-for-all-chapters (as now, reworded away from "learning arc"
framing) and per-chapter, plus the `PLAN §7.0` CP1-6 pipeline as an option; (5) additional features —
title/summary/storyboard/QC as opt-in toggles.

**Assessed this session before any code was written — most of this already exists.** The current
`#generation-screen` is one long always-visible form, not step-wise, but nearly every capability above
is already built:

- Language/script/`continue-select`: exists (`#src-lang-select`/`#lang-select`,
  `#src-script-wrap`/`#script-wrap`, `#continue-select`). Already wired into LLM-story generation AND
  PDF upload (`pdfGenerateAll()` reads it). **Gap, confirmed**: `doDialectImport()` does not read
  `#continue-select` at all, and hardcodes `base:'de', source:'de'` regardless of the actual selected
  pair — a real, narrow bug independent of the wizard itself.
- Text source: LLM-generated and PDF/text upload both exist (`#pdf-panel`, `#user-story-panel`).
  **Comic/image parser does not exist at all** — this is `PLAN §7.0` Track A's own **A4**, still at
  "begin with the §2.4 overlay probe," no code. Attribution fields: the schema already supports this
  (`topic.source = {author, licence, url, note}`, `v58` provenance) with a working endpoint
  (`/api/topic-source`), but the only client call site edits an EXISTING topic after the fact — not
  present in the generation flow itself.
- Chaptering: word/chapter-count (`#num-chapters-slider`) and split-mode (¶/↔/📄/✨LLM,
  `#split-mode-para/-len/-page/-llm`) both exist. Comic-panel splitting is blocked on the same A4 gap.
  Title/summary generation (`generateStorylineTitle`) already runs automatically once a book has ≥2
  chapters — not a toggle today, but the machinery exists. Storyboard is a separate, manual post-hoc
  `🎬` button, not part of the generation flow. **Spell-check → auto-generate hidden error-hunt
  lessons from the ORIGINAL text's real errors does not exist** — two adjacent-sounding mechanisms
  already exist and are NOT it: `error_hunt` deliberately corrupts a CLEAN story (the opposite
  direction), and `ai_error_hunt`/the existing text-cleanup diff is explicitly "deletion-only" (ad/
  furniture removal, never spelling/grammar correction). This is genuinely new work, though it can
  reuse the existing "(original, corrected) diff seeds an error-hunt lesson" machinery structurally
  with a new prompt.
- Lesson selection: the common-for-all-chapters ticklist exists and ALREADY replaced the old
  two-button arc-mode chooser at `v71_u` — there is no leftover legacy control in the client HTML. The
  ONLY thing still called "learning arc" is the checkbox LABEL that reveals the ticklist
  ("🎯 Build a learning arc per chapter") — confirmed with the user this is a wording/framing
  complaint, not a request to remove a second mechanism; reword it (and the PDF path's identical
  `#pdf-arc-lbl`), no logic change. Per-chapter type selection exists but ONLY post-hoc (the
  storyline-screen's per-chapter "add lessons" dropdown) — offering it AT generation time is new UI
  reusing the existing picker/endpoint shape, not new machinery.
- Additional features: storyboard and QC (`/api/qc`) both exist as separate manual triggers; folding
  them into the generation flow as toggles is wiring, not new pipeline work.

**The one real conflict with an existing plan, found and reconciled with the user directly**: "the new
pipeline should eventually design a complete lesson arc over chapters, selecting appropriate types for
the given source/target language pair, and for the given text" is, word for word, the cross-chapter
curriculum **sequencing** piece this same file's own `PLAN §7.0` note (added after `v83_m`) explicitly
separated out and marked *"moderate effort, roughly CP3-sized, NOT necessary for now... explicitly NOT
authorised or scoped... defer until the simpler [cross-chapter vocabulary] dedup has shipped and been
used for real."* That simpler dedup piece has ALSO not shipped to the browser yet — `apply-cp-lessons.js`
(CP1-4 chained, additive) is still CLI-only. **Ruled by the user this cut: build the step-wise UX
first, land the browser-reachable SINGLE-CHAPTER CP1-4 pipeline as a generation-time option once that
shell exists (its own follow-up build — needs a background-job design, since CP2's per-sentence calls
are slow: one 4-sentence chapter took 12+ minutes even on a warm model in a live test this session),
and leave BOTH comic import and the cross-chapter arc-sequencing piece explicitly out of scope** —
reopening the sequencing piece now would skip the very prerequisite that `PLAN §7.0` note called out.

**Approved implementation approach for the wizard shell itself** (full detail, including the exact
existing `id`s/functions each card wraps and the suggested per-release build order, is in this
session's own plan-mode transcript — condensed here so it survives past that): wrap the EXISTING
sections as `.gen-card`s inside a new `#gen-wizard`, don't rewrite them — this is a 1.15MB single-file
client with extensive `id`-selector test coverage, and the lowest-risk path (which also happens to be
what "click through with defaults" actually requires) is a navigation layer that shows/hides existing
markup, not a new form/data model. Reuse the existing `.pdf-step`/`.pdf-step.done/.active` pill visual
language for the page-level stepper (currently a per-chunk progress indicator, same look fits a
page-level one). A "Create storyline now, add lessons later" action on the chaptering card reuses the
existing empty-lesson-type no-op (`index.html`, `if(!addTypes || !addTypes.length) return;`) — chapter/
storyline creation and lesson generation are already loosely separable server-side, so this is a UI
affordance, not new backend logic.

**Suggested build order, each its own release** (per this project's own "one release per commit"
rule): (1) wizard shell + language/script + text-source cards, pure re-layout, zero behaviour change,
verified with a real click-through of all three text sources in the browser preview; (2) chaptering
card + "create storyline now" shortcut; (3) lesson-selection card + reworded label + per-chapter
override at generation time; (4) additional-features card (title/summary/storyboard/QC as toggles);
(5) the small independent gap-fills (attribution fields, dialect `continue-from` wiring) whenever
convenient. The browser-reachable CP1-4 option is its own build AFTER (1)-(5), not part of this
sequence.

**Not scoped here, deliberately** (per the ruling above): comic/image import; cross-chapter curriculum
arc-sequencing; spell-check-driven auto error-hunt generation (flagged during assessment, genuinely
new, not confirmed in scope — ask before starting it, since it needs a new prompt).
