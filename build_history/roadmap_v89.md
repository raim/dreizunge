# Dreizunge roadmap — v89

**This is the `v89` line.** Cut from `roadmap_v88.md` at its last commit (the `v88_am` release), at
the user's own explicit request ("cut v89") — the same shape as every prior cut, and for the same
reason: the `v88` line finished what it set out to do.

It ran **thirty-nine point releases** (`v88_a`…`v88_am`) and closed, among much else: the **thirteen
TODOs** handed over after `v88_a` (items `AM`…`AX`), **item `AU`** end to end (job cancel, idle
release, and the swallowed-cancel audit), **item `AI`** (the curator overlay over CP2's token
analysis, then its table), **item `Y`** (the storyline header's edit buttons behind one pencil), the
**chapter-wise progress lock** on both surfaces that carried it, the **teacher walkthrough** and its
generalisation into a student browse mode, and the standing **"some LLM jobs have no cancel button"**
item — every formerly-blocking model route is now a listed, cancellable job.

**`roadmap_v88.md` is kept and is not superseded as a record** — the whole `v88` line's release
history (`v88_a`…`v88_am`) lives there under `# ✅ SHIPPED IN THE v88 LINE` and was NOT copied here.
Go there for how something was built or why a guard is shaped the way it is;
this file stays current through the whole v89 line.

> **⚠️ WHAT WAS CARRIED, AND WHAT WAS NOT.** Carried: this protocol block, the open items that are
> genuinely still open (each cross-checked against the `v88` shipped list before being carried —
> three were stale and are NOT here), the findings that govern the open sections, `§0`/`§0i` with
> their reconciliation, the standing RULES (now including a block for the `v88` line, which earned
> more than any line before it), **TRACK T** and **THE LARGER PLAN**. **Not carried**: the `v88`
> line's own `# ✅ SHIPPED IN THE v88 LINE` section, and the items that line CLOSED — the thirteen
> `AM`…`AX` TODOs, **AU**, **AI**, **Y**, and the cancel-button item — which are recorded as shipped
> in their own entries there rather than carried as open work.

### What is in this file, in order

| section | what it is |
|---|---|
| **OPEN AT THE v89 CUT** | fresh, top-of-file summary of everything still genuinely open, reconciled against the `v88` shipped list — then the findings that govern the open sections, then `§0` / `§0i` themselves, then the standing RULES |
| **SHIPPED IN THE v89 LINE** | this line's own release history, newest first |
| **TRACK T** | the text-focused progress card — steps 1–4 and `§T7` all shipped in the v81 line; nothing open here at this cut |
| **THE LARGER PLAN** | the folded `implementation_plan.md`. Cite it as `PLAN §X`. **A bare `§3` is this file's item; `PLAN §3` is Track C.** `PLAN §12`, `PLAN §7.0` Track A (CP1-5), and `PLAN §13` are ALL fully shipped. `PLAN §7.0` CP6 remains open (a CONDITIONAL, not a queued slice). `PLAN §2.4` / Track A4 (comic/image ingest) is fully shipped as its FOUR-milestone core plus several `v85`/`v86`/`v87`/`v88`-line follow-ups. |

Standing rules are in the "Rules earned in session 28…34" blocks, plus two more from the `v83` line,
three from the `v84` line, six from the `v85` line, EIGHT from the `v86` line, and the `v88` line's
own block below — read the **"⚠️ How the rules are NUMBERED"** note before citing one. The `v87`
line's rules are in `roadmap_v87.md`'s own copy.

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

# ⚠️ OPEN AT THE v89 CUT

## 🆕 THE SHORT LIST — everything genuinely open, reconciled at this cut

*Each line below was cross-checked against `roadmap_v88.md`'s shipped section before being written
here. **Nothing is owed**: the `v88` line closed every item it was handed. The fuller diagnoses live
in the carried sections further down and, where noted, in the older roadmaps.*

**Buildable now, no decision needed:**
- **Item `V`** (multi-image upload) — FULLY SPECIFIED by the user's ruling and unblocked. Each
  uploaded image gets a whole-image panel (the act `AM` already performs for one), the panel list
  stays editable, and `comicCreateChapter()`'s one-chapter-per-panel formation (`v85_p`) is confirmed
  correct. Mostly a question of the DRAFT shape holding more than one page.
- **The completion card (`_renderCompStory`) still has no force-regenerate control** — only the
  lesson-set card does. Quick and well-precedented.
- **⭐ Finish the flake audit.** `unit-ui-journeys` and `unit-word-progress` remain **UNVERIFIED**
  (12/12 each is far too few runs to clear them). ⚠️ Both inherited "known flake" labels that have
  been examined so far turned out to be WRONG — `unit-tap-word` was a `Math.random()` in the PRODUCT
  (`v87_i`), `unit-observations-log` was a test driver branching on a proxy (`v88_h`), and
  `e2e-idle-release` was a guard counting log entries as sweeps (`v88_ak`). **Three for three.**
  Instrument the failing assertion; do not re-confirm the label.
- **⚠️ THREE test files share `unit-observations-log`'s defective driver shape** —
  `unit-question-nav`, `unit-inflection-speak-lang`, `unit-tap-word` all branch on `if (btns.length)`
  before considering `ex.type`. `unit-question-nav` is the most exposed but measured 14/14 clean, so
  `v88_h` deliberately did NOT change it: altering four test files on one file's evidence is how a
  cleanup becomes a regression. `roadmap_v88.md`'s `v88_h` entry carries the deterministic probe.
- **Item D** (Tier 2 image-coordinate highlighting) — buildable, wants its own design pass first.
- **⚠️ `_jobsTracked` and the whole `kind:'sync'` popover path have NO CALLERS** since `v88_al`.
  Superseded, not broken, and marked as such in its own comment. Deleting it means removing
  `_jobsInflight` and the `sync` branch of `_jobsEffectiveList`/`_jobsRenderList` and re-scoping the
  tests that pin them — a purely internal cleanup, deliberately left for its own release.
- **Offline mode hides controls SILENTLY** on the storyline and lesson-set pages — `#offline-note`
  exists only on the generation screen, which is why a backend outage reads as broken buttons.
  Offered at `v87_p` and not taken up; small, and would have saved two user reports.

**Raised by `v89_c`/`v89_d`'s own measurements — the label pass is SHIPPED, these two are what it left:**
- **A BACKFILL over the existing inflections lessons.** `v89_d` normalises labels at GENERATION
  time only, so the mixed corpus `v89_c` measured is still mixed — the user still hears a Dutch
  label in a German voice on every chapter generated before `v89_d`. Offered and not taken up yet:
  it rewrites `lessons.json` with a model call per lesson, which is the user's call. The shape is
  settled — `normaliseInflectionLabels` is already a pure function over validated items, so a
  `backfill-*.js` script (the precedent this repo already has four of) can call it directly.
- **⚠️ `explanation`, `title` and `desc` drift the same way as `formLabel` did** — measured on the
  same nl/de chapters (*"De werkwoordsvorm 'geeft' is de tegenwoordige tijd…"* against a German
  `{S}`). Deliberately NOT folded into `v89_d`: `explanation` **quotes target-language word forms
  inside itself**, so a translation pass over it can corrupt the very forms the exercise teaches,
  where a form label is pure metalanguage with nothing to lose. Wants its own design pass — most
  likely a prompt that is told to leave quoted material alone, then a measurement like `v89_c`'s.

**⚠️ Blocked on a user decision — do NOT start without one:**
- **Card 2's green "✨ Generate" button is mislabelled** (`#comic-generate-btn` runs the TEXT
  EXTRACTION but is labelled `form.image_generate` = "✨ Generate"). Rewording costs that string's
  translations, so **ask for a key budget first**. `form.image_extract` exists but the button can run
  extraction AND/OR description, so it is not a drop-in.
- **A partial EXTRACTION is a known failure mode with no detector.** Measured at `v88_ab`: a
  photographed sign whose caption came back as its 12-character heading, while a sibling chapter from
  the same photo extracted the body correctly into `inScene`. `v88_y` fixed the field CONFUSION and
  `v88_ab` the SUPPRESSION, but **nothing notices that an extraction returned a headline for a sign
  full of text.** Worth raising as its own item rather than assuming it is covered.
- **A curator correction is keyed on the SENTENCE TEXT**, so rewriting a sentence orphans it.
  `v88_ae` made that visible in three places, but **retyping an orphan against the new sentence is
  still manual**. If asked for more, the shapes are a fuzzy re-key or a side-by-side repair view.
  ⚠️ **Do NOT loosen the KEY itself** — an approximate key silently re-attaches a correction to the
  wrong word, which is worse than losing it.
- Whether **`reviewed`** should ever mean anything at SENTENCE or CHAPTER level (it is per-token
  today, which is what CP2's schema already had), and whether a fully curated chapter should be
  exempt from the `stale` re-hash.
- **Item P's pedagogy question** (infinitive-vs-conjugated as a distractor axis for VERBS). TWO
  live-model cycles already failed to move it by wording; a third guess is explicitly the wrong move.
- **Difficulty placement** — ruled out of scope for item AL, deferred to its own design pass
  alongside the CP1/CP2 route ("difficulty means something different for each lesson type").
- **Item AH** (three CP2 speed ideas; recommendation is "hint, not skip") — product decision.
- **Item AG** (CP2 clitic pronouns / explanations) — prompt-design decision AND a live measurement.
- **Item C** (comic/PDF upload-card UX) — `v87_h`/`v87_l` reshaped both panels; re-read the
  recommendation against the CURRENT markup before putting it to the user.
- **Item A** (move comic images out of `lessons.json`) — needs a go-ahead before touching existing
  topics. `v87_m`'s `GET /api/comic-thumb/:id` is a natural stepping stone.
- **Item B** (vision-role model picker) — short design choice.
- **Item AK's deferred half** — run-now-vs-schedule-with-smart-defaults.

**⚠️ Blocked on a live reproduction the user has to hit:**
- **Item AE** (mobile-backgrounding — the `v86_d` fix did NOT recover on a real device),
  **item AB's "stuck mid-sentence" half**, **item E** (chapter-title post-pass failures, needs the
  raw model response), **item T** (two text-selection→grammar questions never answered).

**Scoped but needing one more thing:**
- **Item AD** (source-language furigana) — live check + a toggle-sharing question.
- **Item F's "add explanations" half** — open and unscoped in detail.
- **Items G, N, O, X** — each independently startable or needing user input.

**⚠️ POSTPONED BY THE USER (deferred, not blocked):** **`AV`** (the language/grammar summary) and
**`AS`** (the PDF viewer). Both were put to the user at the `v88_i` handover and answered "postpone".
Do NOT restart either without being asked. `AS`'s standing recommendation, if it returns, is to
counter-propose page IMAGES rather than a pdf.js viewer — the PDF bytes are never stored, and chapter
text has no offset back into the PDF.

**⚠️ `ui.json` keys.** **755 `en` keys** across 33 languages. The `v88` line spent very few: whole
stretches of it (`v88_ab`, `v88_ad`, `v88_af`, `v88_ag`, `v88_ai`, `v88_al`, `v88_am`) shipped with
**ZERO**, by reusing strings the app already had — item Y's six menu labels come from the buttons'
own `title` attributes, and the job labels are server-minted English. **Nothing is pre-approved.**
The user's standing ruling on changed English text: delete the stale non-`en` values so
`translate-ui.js` refills them. **Ask fresh for a count every time, and try zero first.**

⚠️ **Server job labels remain the one user-facing surface `ui.json` does not cover** (`v88_w`), and
that grew in the `v88` line as eight routes became jobs. A known gap, not an oversight; closing it
needs keys plus a client-side lookup for server-minted strings.


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

### ~~Y. Storyline-card UI redesign: edit buttons behind a single pencil~~ — ✅ SHIPPED `v88_ai` / `v88_am`

Closed. `v88_ai` put the storyline PAGE header's five authoring buttons behind one pencil (keeping
`▶` and `🔗` beside it, on the user's explicit exclusion); `v88_am` extended the same treatment to the
library storyline cards and the chapter cards. **ZERO `ui.json` keys** — the row labels come from the
buttons' own `title` attributes. Two mechanisms, deliberately: `_slEditMenuSync` MIRRORS the page's
static markup, `_cardEditPopHtml` BUILDS rows for cards rendered as strings. Full write-ups in
`roadmap_v88.md`.

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

### ~~AI. Surface CP1/CP2 analysis — and let a curator EDIT it~~ — ✅ SHIPPED `v88_ad` / `v88_ae`

Closed, including the design question it had carried since `v86_s` (*does a correction survive a
re-analysis?*). The user ruled **sticky overlay**: corrections live in their own store
(`analysis-corrections.js`) and are re-applied after every re-analysis. ⚠️ **The key is NOT
`tokenId`** — that is `chapterId:sN:tM`, a pure index, and a correction keyed to it would silently
re-attach to a DIFFERENT word after a story edit. `v88_ae` added the per-chapter curator table and a
warning before a rewrite orphans corrections. **What remains is NOT this item**: whether `reviewed`
should mean anything at sentence/chapter level, and whether retyping an orphan should be assisted —
both listed in THE SHORT LIST above. Full write-ups in `roadmap_v88.md`.

## ✅ CLOSED IN THE v88 LINE — the thirteen TODOs, and four standing items

*The `AM`…`AX` TODO table that stood here is gone: **every one of those thirteen shipped**, along
with two live bug reports (`AY`/`AZ`) and the flake audit. So did four items that had been carried
as open for whole lines — **`AU`** (cancel, idle release, and the swallowed-cancel audit), **`AI`**
(the curator overlay and its table), **`Y`** (the storyline header pencil), and the standing
**"some LLM jobs have no cancel button"** item. `roadmap_v88.md`'s `# ✅ SHIPPED IN THE v88 LINE`
section is the record for all of them — go there for how any of it was built.*

⚠️ **Three bullets the `v88_am` session prompt still carried as open were STALE and are deliberately
not here** — the protocol's own rule (*"a carried-forward open item must be cross-checked against the
shipped list before being carried again"*) caught all three at this cut:
- the **`AU` residue** (*"`_runQc` and `_runRecreateJob` have NOT been checked — one read each"*) —
  fixed at `v88_z`, which found **eight** sites, not two;
- **item `AI`**'s *"one open design question flagged"* — answered and shipped at `v88_ad`/`v88_ae`;
- **item `Y`** — shipped at `v88_ai`, extended to the cards at `v88_am`.

⚠️ And note a stale sentence that survives INSIDE `roadmap_v88.md`'s own shipped section: the
`v88_k`/`v88_m` entries say *"`_runRecreateJob` … is NOT yet covered"*. True when written, superseded
by `v88_z`. Read a shipped entry as a record of its own moment, not as a live claim.

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
   implicitly `a`, so the sequence is `v89_a` → `v89_b` → `v89_c` → … — the same convention the v69–v88
   lines ran. **This is the `v89` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v89 line.
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

## Rules earned in the v88 line

*Thirty-nine point releases. These are the ones that cost something to learn; the incident behind
each lives in `roadmap_v88.md`'s own entry for that release.*

- **⚠️ CONTAINMENT IS THE PROXY THAT KEEPS HIDING DEFECTS.** Three releases in a row shipped a bug
  past a guard that used `includes`: `_teOpenCuratorTable` appeared in markup that could not work
  (`v88_ai` — the id was interpolated with `JSON.stringify`, whose double quotes closed the
  double-quoted `onclick`); a menu label rendered "🎬 🎬 Show the storyboard…" because the string
  already carried its icon (`v88_aj`); and a too-greedy icon strip stayed green because the button's
  own `title` attribute satisfied the check (`v88_am`). **Assert on the delimited value** — the label
  span, the whole attribute, an equality — not on the string being present somewhere.
- **A guard can become an assertion of the WRONG THING without ever going red.** Seven times in this
  line (`v88_s`, `v88_ab`, `v88_ah`, `v88_aj` twice, `v88_al` three times). When a user replaces a
  ruling, GREP THE SUITE FOR THE RULING'S OWN WORDS before writing code — and **re-scope rather than
  delete**: a set-level guard's value survives the reversal of what it pins.
- **⚠️ In this repo a rename must delete the CALLERS FIRST, or land atomically.** `server.js` serves
  `index.html` with `readFileSync` PER REQUEST, so a half-applied edit is live in the user's browser
  the instant it hits disk. `v88_aj` replaced a function before removing its three call sites and
  took the user's app down: `loadSavedList()` threw `ReferenceError`, the library never rendered, and
  every `#sl=` deep link died with it. **There is no "not finished yet" window.**
- **A process that will not die is a FINDING** (`v88_r`'s rule, re-earned at `v88_ag`). A shared
  poller that treated an unrecognised job status as "still working" re-armed a 2s timer forever;
  `unit-lesson-set-story-explorer` printed ALL PASSED and never exited, stalling the whole suite.
  **Only genuinely in-flight statuses may continue polling.**
- **"Known flake" is a hypothesis, and it has now been WRONG THREE TIMES OUT OF THREE.** `v88_ak`'s
  `e2e-idle-release` was the third: one sweep releases every configured model IN PARALLEL, so it
  writes several log entries, and the test counted ENTRIES as a proxy for SWEEPS. **Instrument the
  failing assertion before re-running.** And when a fix cannot be demonstrated by REPRODUCING the
  failure, say so in the file rather than calling it cleared.
- **A SET-LEVEL guard finds the call sites a reading misses** (`v88_b`'s rule, repaid repeatedly).
  `v88_z` found EIGHT swallowed cancels where the prompt carried "one read each" for two. But a
  set-level rule that reports CORRECT code is a rule nobody keeps — scope it to what can actually
  exhibit the defect. And when it fires on a naming difference rather than a real violation
  (`v88_ag`), make it STRONGER — derive the identifier — rather than renaming the code to satisfy it.
- **Being inside a cancel scope is NECESSARY AND NOT SUFFICIENT** (`v88_z`). A runner that wraps each
  item in a try/catch that continues swallows `CANCELLED` like any other failure and runs to the end
  reporting DONE. **Re-throw it.** Wherever there is a long loop, add a per-item CHECKPOINT too
  (`v88_x`, `v88_af`): a run that dies persisting nothing has nothing to resume from.
- **A second surface over shared state needs the repaint path widened too** (`v86_ad`'s rule, hit
  from both directions). `v88_ad`: `build-static.js` reads the analysis file DIRECTLY, so a
  read-time-only merge would have left every curator correction out of the published build. `v88_ai`:
  four surfaces offered the artwork toggle and only the library was repainted. **Ask who ELSE reads
  this before choosing where a rule lives.**
- **A fixed-size source window is a guard that measures distance, not truth** (`v88_r`, `v88_aj`).
  A 200-character window went red because a menu grew a fourth entry. Bound it STRUCTURALLY — slice
  the function's own body — rather than widening the number, which only moves the next failure.
- **A behaviour ruling does not carry a data migration with it** (`v88_ab`). Ship the behaviour,
  state the residue, and let the user choose — `schemaVersion` is a load-time SHAPE adapter, not a
  per-field migration hook, so "just migrate it" means inventing a mechanism AND silently rewriting
  the user's own content on their running server.
- **A comment citing a ruling is a claim ABOUT that ruling** (`v88_aa`, rule 35's sharpest form). Its
  actual words had been misread, quoted and acted on for two releases. Read the source ruling.
- **Two code paths that produce IDENTICAL output cannot host a non-vacuity assertion** (`v88_ae`).
  Mutation-testing is the only thing that finds this; when a marker stays green, ask whether the
  branches are distinguishable at all before strengthening it.
- **The DOM harness's traps keep costing releases**: `getElementById` AUTO-VIVIFIES and caches, so a
  test that creates its own element with the same id inspects a DIFFERENT object and fails on a
  correct tree (`v88_ad`, `v88_am`) — read through the same accessor the code uses. And **any
  backslash or backtick inside a template literal is processed twice** (`v88_t`, re-earned at
  `v88_al` and `v88_am`): a regex written with escaped slashes can arrive as a line comment.
- **Measure the reported artefact against a SIBLING that worked** (`v88_ab`). One comparison
  reclassified "the user filled in the wrong box" into "the extraction returned only the headline".
- **Validation belongs OUTSIDE a job** (`v88_al`). A 400/404/503 is an answer about the REQUEST;
  turning it into a failed job makes a malformed call look like a model failure and robs the caller
  of its status code.

---

# ✅ SHIPPED IN THE v89 LINE

*Entries go at the TOP of this section, newest first, and a merge conflict between two sessions
lands exactly here: resolve it by keeping BOTH entries, ordered by version.*

## ✅ v89_e — the progress card follows the finger and springs back

User, after asking for the evaluation first: *"is it easy that the text field actually moves with
swiping?"* → *"yes, do A"*. **ZERO `ui.json` keys.**

### Tiers B and C were rejected on evidence, not taste

Recorded because the next session will want to try them:

- **The neighbouring chapter's text is not in memory.** `_backToChapterProgress` FETCHES it
  (`/api/lessons/load`), and all **343** `APP.savedList` entries were measured to carry no `story`
  field. There is nothing to slide IN from the side without a prefetch.
- **Where forward LEADS is decided at render time.** `comp-next`'s destination comes out of
  `showComplete()`'s ~7-branch gate chain and lives in its `onclick` closure. A carousel has to know
  the destination BEFORE the gesture — which is exactly the re-derivation `v88_r` and `v89_b`
  refused. That is an architectural change, not an animation one.

So: tier A. The card tracks the finger, clamped, and returns. **The commit rule from `v89_b` is
untouched** — every one of its nine sections still passes unchanged.

| what | where |
|---|---|
| the drag | `_cardSwipeMove` / `_cardSwipeDragBegin` / `_cardSwipeDragTo` / `_cardSwipeDragEnd` / `_cardSwipeCancel` (index.html, beside `v89_b`'s own handlers) |
| the curve, as a pure function | `_cardSwipeOffset(dx, max)` — 1:1 up to `_SWIPE_MIN_PX`, then asymptotically damped toward `max`. Pure so it can be checked as arithmetic rather than inferred from pixels |
| constants | `_SWIPE_LOCK_PX = 10` (axis decision), `_SWIPE_DRAG_MAX = 96`, `_SWIPE_DEAD_MAX = 24` |
| two rules now SHARED by the drag and the commit | `_cardSwipeInScope(target)` and `_cardSwipeBtnFor(dx)`, split out of `_cardSwipeNav` — so the card can never travel toward a destination the release would then refuse |
| the new markup | `id="comp-body"` on `#complete-screen`'s `.comp-body`. `class` stays FIRST: `smoke-render` pins the first occurrence of the literal `class="comp-body"` against `id="comp-hdr"`'s position, and three other cards carry the same class |

### ⚠️ Three things that decide the implementation, none of them obvious

1. **`#comp-body` moves, NOT `#complete-screen`.** A transformed ancestor becomes the containing
   block for its `position:fixed` descendants — and `#comp-nav-modal` is one. Moving the screen would
   quietly stop the ☰ overlay covering the viewport. The modal is `#comp-body`'s SIBLING, so moving
   the body cannot reach it. (`#story-sel-popover`, PLAN §12's own fixed element, sits at document
   top level and is outside either way.) It is also the whole card rather than `#comp-story-panel` —
   that panel is a `<details>` the learner can collapse, and dragging a collapsed one would animate
   an empty box.
2. **`touchmove` is the ONE non-passive listener, and `preventDefault` is reached only on an 'x'
   lock.** Owning the horizontal axis means calling it, or the page keeps scrolling under a card
   that is visibly following the finger. A vertical gesture never reaches that line, which is what
   keeps scrolling a long card untouched — asserted directly, and live-verified through a real
   `TouchEvent` whose `defaultPrevented` came back `false`.
3. **The axis is decided ONCE, at 10px, and never revisited** — a gesture that starts as a scroll
   stays a scroll even if the finger later curves hard sideways, and `_cardSwipeNav` now refuses to
   commit a `'y'`-locked gesture however far off-axis it ends.

**Release: spring vs snap, and it is not decoration.** An abandoned drag EASES home (`.22s`, the
`.rise-up` easing reused). A commit SNAPS, and `_cardSwipeNav` clears the transform ITSELF, before
calling `btn.onclick()` — the handler can re-render synchronously, and clearing a transform
afterwards is clearing it on a card the learner has already been shown displaced.

**Nothing may leave the card parked.** `touchcancel`, a SECOND FINGER landing mid-drag (which arrives
as a `touchstart`, never a `touchend`), a `touchmove` reporting no touches, and an orphan `touchend`
each put it back. Every one of those stranded a transform in an earlier draft.

### Verified live, then guarded

Real `TouchEvent`s against the running app: 6px → nothing; 40px → `translateX(-40px)` with
`transition:none` and `user-select:none`; 300px → `translateX(-91px)`, damped short of the 96 cap;
released at 20px → transform cleared, spring transition applied, selection handed back, **no
navigation**; a vertical drag → no movement and `defaultPrevented === false`, then curving 300px
sideways still moved nothing and still did not navigate; a committed swipe → `-86px` mid-drag,
transform and transition both **empty at release** (a snap), and `"Der Waldpfad"` →
`"Landschaft hinter dem Zaun"`.

`unit-card-swipe-nav.test.js` grows from 9 sections to 16. **Seventeen mutations, all red — after a
fix.** The first run left ONE green: dropping `from.axis !== 'x'` from the move guard. That was the
finding. `APP._swipeEl` is only ever set on the `'x'` branch, so the `|| !APP._swipeEl` half I had
written beside it caught everything and made the axis test itself unfalsifiable. **The redundant
half is now gone** — a condition that cannot fail on its own is not a guard — and the mutation goes
red. Same class of finding as `v89_d`'s `Array.isArray`, two releases running.

## ✅ v89_d — the form labels are NORMALISED into the source language, not merely asked for

User request, following `v89_c`'s measurement: *"yes, do the normalisation pass"*.
**ZERO `ui.json` keys** (one new `prompts.json` entry, which is not user-translated).

### Why a transformation and not a better instruction

`PROMPTS.inflections` has asked for `{S}` form labels since the type shipped. `v89_c` hardened that
instruction and MEASURED the result against the live model: **0 of 3 runs compliant before, 1 of 3
after.** An instruction the model may ignore is the wrong shape for a field the readout depends on.

This file had already settled the right shape once. A few hundred lines below, the META pass does
exactly this for `topic`, with its own comment saying why — *"a cheap targeted call that's more
reliable than hoping the meta model follows language instructions"*. `v89_d` is that pass, applied
to the labels. **Nothing new was invented**: the same `metaTranslation` "return the same keys"
contract, the same `srcLang !== 'en'` gate, the same keep-the-original-on-failure posture.

| what | where |
|---|---|
| the pass | `normaliseInflectionLabels(items, srcLang, jobId)` (server.js), immediately above `generateInflections` |
| the prompt | `PROMPTS.inflectionLabels.system` (prompts.json) — "already in `{S}` → return it UNCHANGED", keep the same dimensions, keep values that differed different, never add/drop/reorder keys |
| where it runs | `generateInflections`, **AFTER `validateInflectionsItems`** — the pass relies on `formCorrectIndex` already pointing at `formLabel` inside `formChoices`, which is exactly what the validator has just established |
| the model | `callLLMTranslation` — it *is* a translation, the role exists, and it falls back to the main model when unset, so it adds no configuration burden. `think:false`, for the reason the story-translation call site already gives |
| batching | ONE request per LESSON. A flat `{"0":"…","1":"…"}` map across every item, `keysByItem[i][j]` built on the way OUT so the way BACK is a direct lookup, never a search that could re-derive the pairing differently |
| the invariant | `formLabel` is **derived** as `next[formCorrectIndex]`, never translated separately — that keeps `validateInflectionsItems`'s own rule (formLabel is one of formChoices, at formCorrectIndex) true by construction rather than by hoping two independent translations of one string come back identical |

### The failure posture: per ITEM, and always toward the original

An item keeps its own labels untouched when its reply is short, empty, non-string, or **collapses two
of its options onto one phrase**. That last one is the case that matters: `formChoices` IS the
multiple-choice list, and two options that translate to the same `{S}` phrase make the question
unanswerable — strictly worse than leaving it in the wrong language. A wrong-shaped reply (array,
bare string, null, unparsable) keeps everything and **still reports its token cost**, so a failed
pass cannot hide from `_genMeta`. A `CANCELLED` is re-thrown, not swallowed (item AU, `v88_z`).

Per item rather than per lesson because a lesson with one repaired item and one untouched is
strictly better than two untouched ones, and an item's options are only ever compared with each
other.

### ⚠️ Two limits, stated rather than buried

1. **It only fixes NEW lessons.** The mixed corpus `v89_c` measured stays mixed. A backfill over the
   existing inflections lessons was OFFERED and not built — it rewrites `lessons.json` with a model
   call per lesson, which is the user's call, not a bug fix's.
2. **`explanation`, `title` and `desc` drift the SAME way and are deliberately out of scope.**
   Measured on the same nl/de chapters: Dutch explanations against a German `{S}`
   (*"De werkwoordsvorm 'geeft' is de tegenwoordige tijd…"*). They are not folded in because
   `explanation` **quotes target-language word forms inside itself**, so a translation pass over it
   can corrupt the very forms the exercise is teaching. A form label is pure metalanguage with
   nothing to lose; an explanation is not. Recorded as its own item.

### Guards

- **`e2e-inflection-label-lang.test.js`** (new) — the real server, through `/api/lessons/add-lesson`,
  both halves of the gate from ONE boot: `t_nl` normalised, `t_en` untouched. It asserts the
  substitution is **positional** (each key landed on the choice it was sent for), that the second
  fixture item's **non-zero** `formCorrectIndex` still drives `formLabel` (index 0 would let a bug
  that always reads `choices[0]` pass by accident), that `lemmaChoices`/`explanation`/`translation`
  are untouched, and — via `FAKE_LOG` — that exactly **one** normalisation call was made for **two**
  inflections lessons. The fake returns Dutch-looking labels ON PURPOSE: a fixture already in the
  right language could not tell a working pass from a missing one.
- **`unit-inflection-label-normalise.test.js`** (new) — the failure modes, with a scripted model.
  ⚠️ `extractAsync`, not `extract`: this function is `async`, and slicing from `function` instead of
  `async function` silently strips the keyword, turning every `await` into a construction-time
  syntax error.
- **Ten mutations, all red** — after a fix. The first run left ONE green: removing `Array.isArray`
  from the shape check. That was the finding, exactly as the standing rule says. Indexing an array
  by `"0"`,`"1"`,… yields NUMBERS, every value failed the string check, every item fell back anyway,
  and the outcome was identical. The case that distinguishes the two is **an array of the right
  strings** — without the guard it would be applied as though the "same keys" contract had been met.
  That case is now in the file, and the mutation goes red.

## ✅ v89_c — the inflections lemma is read aloud again; the form label stays source-language by ruling

User report, two halves: *"inflections lesson: the grammar form is now given in the target language,
but readout is still in the source language voice. For the lemma-type question, the correct answer
(the lemma) is not read-out at all. Also read this out, it is always in the target language."*
**ZERO `ui.json` keys.**

### ⚠️ The first half was NOT the bug it looked like — measure before editing

"The grammar form is now given in the target language" reads as a design statement. It is not: the
live corpus is **genuinely mixed**, and neither half of it is a majority everywhere.

| chapter | `formLabel` | which language |
|---|---|---|
| nl target / de source | `"Tegenwoordige tijd, 3e persoon enkelvoud"` | **TARGET** (Dutch) |
| it target / nl source | `"imperativo presente (2ª persona plurale)…"` | **TARGET** (Italian) |
| en target / ja source | `"複数形"` | source (Japanese) |
| de target / en source | `"dative singular"` | source (English) |
| en target / de source | `"Plural"` | source (German) |
| nl target / de source, *"Der Waldpfad"* | `"Präsens, 3. Person Singular"` | source (German) |

`PROMPTS.inflections` has always asked for `{S}`. The model complies when `{S}` is English and
drifts into `{L}` when it is not — which is `roadmap_v86.md`'s **item AJ**, recorded there as a
model-behaviour finding, showing up in the corpus. **Reading the label with the target voice would
have fixed the top two rows by breaking the bottom four.** Put to the user with that measurement.

**User ruling: the form label stays a SOURCE-language explanation.** So `speakOkLang`/`speakBadLang`
are unchanged, and the lever is the prompt instead. The accepted cost, stated: chapters that already
hold a target-language label keep the source voice until they are regenerated.

### The second half: the lemma readout comes back (reversing `v86_ae`)

`check()`'s `speakOk`/`speakBad` no longer carry an `inflection_lemma` branch at all — the type falls
into the generic `stripFuri(ex.target)` tail with `speakOkLang` null, i.e. the target voice, exactly
as it behaved before `v86_ae`. Both paths, correct and wrong: the request named the ANSWER, and the
wrong-answer reveal is where the correct lemma is shown.

⚠️ **`v86_ae`'s reasoning is not withdrawn, its RULING is overruled.** An isolated target-language
word form really can be mispronounced by a voice that CLAIMS the language tag but sounds wrong on a
given device — `_ttsMakeUtterance`'s "refuse rather than approximate" policy (`v55_x`) only refuses
when NO voice claims the language at all. `v86_ae` took the user's own offered fallback ("we could
also just omit the readout"); this cut is the user asking for the readout back with that trade-off
already known and confirmed. **If the mispronunciation returns, the lever is the VOICE policy, not
this branch.**

### Prompt hardening — an explicit negative, a field partition, and a re-read step

`PROMPTS.inflections.system` (prompts.json) gains, in the per-field bullets, in a new RULE, and again
in the schema block:

- `formLabel` is `IN {S}, THE LEARNER'S OWN LANGUAGE — NOT in {L}`; `formChoices` is
  `IN {S} (never in {L})`. The bare positive `{S}` is what was already being ignored.
- A rule that **partitions the fields**: exactly three are `{L}` (`surfaceForm`, `lemma`,
  `lemmaChoices`, plus the quoted `sentence`); every other field is `{S}` — and it names the trap
  out loud, that a grammatical form BELONGS to `{L}` so its name feels like it should be written in
  `{L}`.
- A **re-read step** before returning the JSON: check every `formLabel` and every `formChoices`
  entry, rewrite any that came out in `{L}`.

### ⚠️ MEASURED AGAINST THE LIVE MODEL — it helps, and it does NOT fix the drift

A scratch spike ran the OLD and the NEW system prompt against the user's own Ollama
(`qwen3.6:35b-a3b`), three runs each, same real nl-target/de-source chapter ("Naturraum für
Biodiversität"), no writes to `lessons.json`:

| prompt | runs fully in `{S}` (German) | labels in `{S}` |
|---|---|---|
| OLD | **0 of 3** | 0 of 13 |
| NEW | **1 of 3** | 5 of 15 |

**Report that as it is: a partial mitigation, not a fix.** The old prompt never once produced a
German label for this pair; the new one produced a completely clean run — and then two completely
drifted ones. It ships because it strictly improves and costs nothing, **not** because the problem
is solved.

Two findings worth keeping:

1. **The drift is per-RUN and all-or-nothing.** Every run in the spike was internally consistent —
   five German labels or five Dutch ones, never a mix. The model picks a language for the whole item
   set, which means a per-item repair would be repairing a decision made once, higher up.
2. **`unit-prompt-strictness`'s new section cannot see any of this.** It pins the instruction TEXT.
   The 1-of-3 above is the only kind of evidence that bears on behaviour, and it came from a spike,
   not from the suite. Re-measure; do not read the green test as proof.

**The lever that would actually settle it, NOT built here** (recorded in the open list): a
post-parse NORMALISATION pass in `generateInflections` — send `formLabel` + `formChoices` through the
existing translation route with "render these grammatical-form labels in `{S}`" and replace them.
That converts an instruction the model may ignore into a transformation it cannot skip, and it is
one extra call per lesson, not per item. Left for the user's call rather than added to a bug fix.

### Verified live, on the very chapter the report came from

Driven through the running app on `Naturraum für Biodiversität` (nl target, de source — a chapter
whose labels ARE in the target language), with the TTS engine stubbed to record and every progress
write neutralised, one exercise per observation:

- `inflection_lemma`, answer `"geven"` → spoken, **`nl-NL`**. Under `v86_ae` this was silence.
- `inflection_form`, answer `"Voltooid deelwoord"` → spoken, **`de-DE`**.

⚠️ **That second line is the user's original complaint, and it is now the RULED behaviour**: a Dutch
label read with the German voice. On chapters that already hold a target-language label they will
keep hearing exactly that until those chapters are regenerated. Said plainly rather than buried,
because it is the one thing about this cut that could read as "not fixed".

### Guards, and what they honestly cover

- **`unit-inflection-speak-lang.test.js` §3/§4 RE-SCOPED, not deleted** — the third ruling this pair
  of sections has carried (`v82_d` target audio → `v86_ae` silence → `v89_c` target audio again).
  They now assert the utterance COUNT, its LANGUAGE (`de-DE`) and that the text is the correct lemma
  itself. §5 is the non-vacuity that makes them mean anything: the two questions one inflections item
  builds must resolve to DIFFERENT voices, and `inflection_form` still speaks `it-IT`.
- ⚠️ That file's fake TTS engine now **fires `onend`**, the shape `unit-speak-advance`'s own fake
  already used. §4 asserts auto-advance after a SPOKEN reveal; with an engine that never ends, the
  advance came only from `_speakAndAdvance`'s `START_GRACE_MS` watchdog — the test would have been
  measuring the wedged-engine safety net instead of the ordinary path. **Six mutations, all red**:
  re-silencing either path, giving the lemma the source voice on either path, giving the form label
  the target voice on either path.
- **`unit-prompt-strictness.test.js`** gains an inflections section — eight assertions, **eight
  mutations all red**. ⚠️ It guards prompt TEXT, which is all a prompt is, but it **cannot guard
  model BEHAVIOUR**: it proves the instruction is present and was not quietly reworded away (which
  is exactly what happened to this same field's worked example at `v86_ab`), not that the drift
  stopped. Re-measure the corpus; do not read the green test as evidence.

## ✅ v89_b — swipe the progress card left/right = its ← / → arrows

User request: *"progress card allow to swipe right and left on mobile phone, same as if the back and
forward arrows were pressed. So on the vocab-highlight view tapping starts questions, and swiping
moves back and forth."* **ZERO `ui.json` keys** — the gesture has no strings of its own.

### The two gestures are complementary, on one surface

`_storyTapMaybeAdvance` (the mobile tap follow-up) already owns the progress card's story body: a
tap PLAYS (`comp-play`, falling back to `comp-next`). The swipe BROWSES (`comp-prev`/`comp-next`,
one chapter, no completion check — `v88_r`'s arrows). That pairing is the request, so the two live
side by side in the source and share their tap-vs-drag signal.

| what | where |
|---|---|
| the gesture | `_cardSwipeInit()` / `_cardSwipeStart` / `_cardSwipeEnd` (index.html, directly after `_storyTapMaybeAdvance`) |
| **the decision, split out so it can be driven** | `_cardSwipeNav(from, to)` — returns whether it navigated. Same shape as `_storyTapMaybeAdvance`: the harness's `addEventListener` is a no-op, so the plumbing is thin and the rule is a plain function |
| thresholds | `_SWIPE_MIN_PX = 60`, `_SWIPE_X_OVER_Y = 2` |
| wired from | BOTH inits — `index.html`'s and `build-static.js`'s own replacement one, per `v86_h`'s lesson (see below) |

**It presses the buttons, it does not re-derive a destination.** `comp-next`'s target depends on ~7
branches in `showComplete()`; the swipe reads `comp-prev`/`comp-next` — the SOURCE buttons
`_syncCompHdrNav`/`_mirrorNavBtn` already copy from — and calls their resolved `onclick`. A HIDDEN
arrow (`display:none`, i.e. no previous chapter) and a DISABLED one are both unreachable: a gesture
has no greyed state of its own to show, so it must not reach a destination the card withheld.

**Touch only, `passive:true`.** A mouse drag across story text is a SELECTION (PLAN §12's popover)
and there is no desktop gesture to disambiguate it from. Nothing calls `preventDefault` on the touch
itself, so vertical scrolling through a long card is untouched; a mostly-vertical drag is rejected
by the ratio, and a drag that left a non-collapsed selection is rejected by the SAME `sel.isCollapsed`
signal PLAN §12 and `_storyTapMaybeAdvance` already trust.

**Scope:** anywhere in `#complete-screen` EXCEPT `#comp-nav-modal`. The request says "progress card",
not "the story field", so the whole card swipes — but the ☰ popup is a dialog stacked on top of it,
and its chapter-icon strip (`#comp-storyboard`) is the one horizontally-scrolling element on this
screen. Nothing outside the popup on this card scrolls sideways (checked element by element), so no
further exclusion was invented. Analysis mode (`APP._textExplorer`) is deliberately NOT excluded,
unlike the tap: `v88_ai` made that body inert as a QUESTION surface, and browsing to the next
chapter is navigation, not a question.

### ⚠️ The capture-phase click swallow is load-bearing, not defensive

A horizontal touch drag is not a scroll, so the browser still synthesises a `click` on `touchend`.
Without suppression, a swipe starting on plain text would ALSO run `_storyTapMaybeAdvance` (play) and
one starting on a highlighted word would ALSO run `tapWord` — a second, different navigation stacked
on the swipe's. `_cardSwipeSwallowClick` is registered on `document` in the CAPTURE phase, the
outermost listener there is: `stopPropagation()` there means the event never reaches the target and
never bubbles back to the document-level tap handler either. It disarms after ONE click and expires
after 700ms, so an ordinary tap is never eaten.

### Verified in the live app, not only in the harness

Driven through real `TouchEvent`s against the running server (standing rule: verify at the layer the
user touches — a live check that CALLS the function proves nothing about the gesture):

- swipe left on the story body: **"Der Waldpfad" → "Landschaft hinter dem Zaun"**; swipe right: back.
- a mostly-vertical drag over the same text: **no move**.
- swipe across a **highlighted** word, then the synthetic click: the click came back
  `cancelled` and the card **stayed on the progress card** — `tapWord` did not fire.
- control, same word, plain click with no swipe in front of it: **still opens `lesson-screen`**. The
  swallow is scoped to the post-swipe window and has not broken tap-to-lesson.

### Guards

`unit-card-swipe-nav.test.js` (new, 9 sections) + a second assertion in
`unit-static-story-tap-parity.test.js` for the static build's own `init()`.

⚠️ **The DOM harness auto-vivifies a FLAT, detached element per id — there is no page tree**, so
`closest('#complete-screen')` returns null even from a span inside `#comp-story-text` (probed before
writing the file). Every section therefore BUILDS the nesting the real markup has, by `appendChild`
on the very objects `getElementById` hands out, so the product code walks the same ancestry it walks
in a browser. **Twelve mutations, all red**: dropping either scope check, flipping the direction,
dropping the 60px minimum, dropping the ratio, ignoring `disabled`, ignoring `display:none`, dropping
the selection check, never arming the swallow, accepting a two-finger pinch, never expiring the
swallow window, and swallowing every click instead of one.

