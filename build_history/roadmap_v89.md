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
three from the `v84` line, six from the `v85` line, EIGHT from the `v86` line, the `v88` line's own
block below, and **TEN from the `v89` line** — read the **"⚠️ How the rules are NUMBERED"** note
before citing one. ⚠️ **`v89`'s rule 1 is the one to read first if you are about to make a large
mechanical edit to a file**: a substring used to BOUND an edit deleted 2,518 lines of this very
document, and only a commit made minutes earlier saved it. The `v87`
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
- ~~Item `V` (multi-image upload)~~ — **DONE at `v89_al`.** Each uploaded image becomes its own
  whole-image panel; `comicCreateChapter()`'s one-chapter-per-panel formation carries the rest. The
  user CLARIFIED the ambiguous ruling ("mark all images as one panel" means **each** image is a
  panel). The draft holds N pages.
- ~~Finish the flake audit~~ — **DONE at `v89_ad`.** `unit-ui-journeys` and `unit-word-progress` are
  **not flaky**: 40/40 standalone each, 60/60 under seeded shuffles, 15/15 under 8-way CPU load. The
  failures were TORN READS of `lessons.json` caused by a non-atomic `fs.writeFileSync` in the
  product — reproduced 3-in-25 with a churning corpus, 0-in-25 through an atomic writer. **Four for
  four**: every examined "known flake" label was hiding a real defect. All seven durable-store
  writes now go through `atomic-write.js`.
- **⚠️ TWO test files share `unit-observations-log`'s defective driver shape** (was three; re-checked
  at the `v89_ag` cut and **`unit-inflection-speak-lang` no longer has it**) —
  `unit-question-nav` and `unit-tap-word` still branch on `if (btns.length)`
  before considering `ex.type`. `unit-question-nav` is the most exposed but measured 14/14 clean, so
  `v88_h` deliberately did NOT change it: altering four test files on one file's evidence is how a
  cleanup becomes a regression. `roadmap_v88.md`'s `v88_h` entry carries the deterministic probe.
- **Item D** (Tier 2 image-coordinate highlighting) — buildable, wants its own design pass first.
- ~~`_jobsTracked` / the `kind:'sync'` popover path~~ — **DELETED at `v89_am`.** The surviving claim
  (all five `v88_al` routes awaited as jobs at every call site) moved into `unit-job-coverage`; the
  tutor synthetic entry is untouched and was never part of it.
- **Offline mode hides controls SILENTLY** on the storyline and lesson-set pages — `#offline-note`
  exists only on the generation screen, which is why a backend outage reads as broken buttons.
  Offered at `v87_p` and not taken up; small, and would have saved two user reports.

**🆕 Raised by the user at the `v89_m` cut:**

- ~~A one-chapter book silently discards every selected lesson type~~ — **FIXED at `v89_p`**
  (the `i >= 1` gate removed; `standard` and parentless `review` filtered with logged reasons). The
  diagnosis is kept below because its method note outlives the fix:
  User report, then the user supplied the server log for the run itself, expecting it to be post-hoc.
  **It was the run, and it closes the investigation completely.**

  ```
  Book generation started: 1 chapter(s) (from upload), id=book_8c0ac123f3a75740
    lang=nl srcLang=de difficulty=1 format=standard
    arc=[standard,word_forms,inflections,conjugation,comprehension]  arcScript=off  continuedFrom=-
  [book …] chapter 1/1: "Flexvervoer…" arc[+standard,word_forms,inflections,conjugation,comprehension]
  [qwen3.6:35b-a3b] Lesson 1/1…
  Done in 239.7s — 2067 total tokens
  ```

  The five types were **sent, received and echoed back**; `skipLessons` was NOT set; and exactly
  **one** lesson was generated — `Lesson 1/1`, the standard one.

  **THE CAUSE, one line in `_runBookJob` (server.js):**

  ```js
  // Arc reinforcement lessons. Reinforcement only begins from the SECOND chapter…
  if (!base.skipLessons && base.arc && i >= 1 && Array.isArray(data.lessons)) {
  ```

  ⚠️ **`i >= 1`.** For a one-chapter book — **every photographed comic panel and every one-chunk
  PDF** — `i` is only ever `0`, so the block never runs and every selected type is discarded in
  silence, *after being logged back as though honoured*. That echo is what made it hard to see.

  **It is a UI/server MISMATCH, and each half is defensible alone:**
  - Client: `_genArcApplicable()` returns **`n >= 1` for non-LLM modes**, so the tick-list renders
    and is settable for a single panel (`v89_n` verified this by reading the source).
  - Server: `i >= 1` is right **if** these are reinforcement of PRIOR chapters — chapter 1 has none.

  ⚠️ **So the fix needs a RULING, not a patch.** Do the ticks mean *"which lesson types should each
  chapter get"* (server wrong for chapter 1) or *"which types reinforce earlier chapters"* (UI must
  not offer them at `n === 1`)? The tick-list reads as the former to a user; the code is built as the
  latter. **Whichever it is, silently discarding an explicit selection is the bug** — at minimum the
  server should LOG the discard instead of echoing the types back.

- ~~"Continued from" was lost CLIENT-SIDE~~ — **FIXED at `v89_s`**. The send paths now read
  `APP.contPin` (the durable record) when the picker is blank, via one shared `_continueFromRef()`
  used by all eight sites. ⚠️ Measured then: a real `<select>` clears its value on ANY `innerHTML`
  rebuild, so the picker resetting under the learner needs no language change — only a rebuild
  against an empty or stale `APP.savedList`.

- ~~The chapter-title post-pass failed silently~~ — **FULLY CLOSED**: the CAUSE at `v89_t` (the
  parser now reads an array of bare strings) and the SILENCE at `v89_y` (a ⚠️ badge on the
  chapter card, cleared by any applied title or a manual rename). ⚠️ The raw placeholder is
  deliberately KEPT rather than replaced by a derived name — an invented title reads as
  deliberate, which makes a bad one harder to notice than an obviously-raw one.

- ~~The static build cannot offer the LLM-free alphabet course~~ — **FIXED at `v89_q`**
  (the static `init()` now awaits `loadScripts()`; guarded behaviourally against the built
  `docs/index.html`, since both halves were individually correct and only the composition was
  broken). The original diagnosis follows, because the hosting plan's Tier 2.4 points at it:
  `window.SCRIPTS_DATA` into `docs/index.html`, and `loadScripts()` exists precisely to pick it up
  (`if (window.SCRIPTS_DATA) { … }`) — but **the static `init()` never calls it**, so the module-level
  `SCRIPTS_DATA` stays `{}`. `scriptsUsedInLessonSet` then offers nothing and
  `introScriptExercisesFrom` loses its distractor pool. **Same shape as the `_storyTapInit` gap
  `v86_h` found**: pure client-side, no backend needed, data already shipped, one missing call.
  One line in `build-static.js` plus a guard in `unit-static-story-tap-parity`'s shape.
  ⚠️ **Do this before any publishing work** — see the hosting section, Tier 2.4.

  *(The full `init()` audit is recorded there too: the other 17 functions the live `init()` calls and
  the static one does not are all genuinely backend-dependent — tutor, jobs, learner accounts, the
  generation form — and correctly absent.)*

**Raised by `v89_l`:**
- ~~`OLLAMA_TUTOR_MODEL` and `OLLAMA_ANALYSIS_MODEL` are missing from `configuredModels()`~~ —
  **FIXED at `v89_r`**, and the list now guards itself: `unit-model-roles.test.js` enumerates every
  `let OLLAMA_*_MODEL` in server.js and requires each to appear in `configuredModels()` AND in
  `/api/models`'s validated `requested` array, so a future role cannot be added and forgotten.

**Raised by `v89_c`/`v89_d`'s own measurements — the label pass is SHIPPED, these two are what it left:**
- ~~A backfill over the existing inflections lessons~~ — **SHIPPED at `v89_f`**: 15 lessons, 28 of
  60 items rewritten. What it LEFT open: **terminology is consistent within a lesson but not across
  the corpus** (one German lesson says `Präteritum`, another `Vergangenheit` — both correct, both
  internally coherent, which is all the per-item distinctness check can see). Making the corpus
  agree needs a per-language glossary handed to the model; that is a feature, not a fix.
- **⚠️ `explanation`, `title` and `desc` drift the same way as `formLabel` did** — measured on the
  same nl/de chapters (*"De werkwoordsvorm 'geeft' is de tegenwoordige tijd…"* against a German
  `{S}`). Deliberately NOT folded into `v89_d`: `explanation` **quotes target-language word forms
  inside itself**, so a translation pass over it can corrupt the very forms the exercise teaches,
  where a form label is pure metalanguage with nothing to lose. Wants its own design pass — most
  likely a prompt that is told to leave quoted material alone, then a measurement like `v89_c`'s.

**🆕 Raised by the user at the `v89_h` cut:**

- **⭐ A "wrong" answer is sometimes ALSO CORRECT** — **strategy 2 (answer-time) SHIPPED at `v89_j`**
  for the four meaning-based MCQ types, opt-in and report-only. ⚠️ **Strategy 1 was tried at `v89_u`
  and MEASURED AS INEFFECTIVE — do not retry it as written.** Two reasons, both recorded there:
  the note below says "harden the prompt so DISTRACTORS must be wrong for this item", but the model
  never picks those distractors (`wS`/`wV` sample sibling glosses CLIENT-side); and the nearest real
  lever — forbidding interchangeable ITEMS in one lesson — measured **3/3 defective before, 3/3
  after** on the reported text, because that text itself says "gratis en kosteloos" and "teach this
  text" beats "avoid synonyms". The rule was kept as free-and-correct, not as a fix.

  ~~The remaining candidate is a generation-time QC pass over the built options~~ — **SHIPPED at
  `v89_v`** as an OPT-IN check inside the existing QC run (shift-click), not at generation: the
  distractors are resampled every round, so the POOL is what gets judged. ⚠️ The role was
  measured — the QC-role model catches nothing here; the answer-check role finds it and stays
  quiet on a clean lesson. **Still open**: `inflection_form` in scope for the answer-time check
  — ⚠️ **POSTPONED by the user at the `v89_w` cut**, noted here rather than carried as active
  work. The ENGLISH distractor in a German-source lesson is **DEPRIORITISED**: the original
  string is gone from the corpus and the user judged the only remaining example unrepresentative
  ("exceptionally poor input text"). Do not chase it.

  **The instance they sent** (`Gratis und Kostenlos`, nl→de, `read_translate`): target `KOSTELOOS`,
  options `This is incorrect.` / `KOSTENLOS` / `UMSONST` / `(das Bord stehen lassen)`, correct
  answer `UMSONST`. **`KOSTENLOS` is a perfectly good German rendering** — arguably the closest one —
  and the learner was marked wrong for it. ⚠️ Note also, though it is a DIFFERENT defect: one
  distractor (`This is incorrect.`) is in ENGLISH in a German-source lesson.

  The user named the two strategy families, and they are not alternatives — they are cheap-and-partial
  vs. expensive-and-real:
  1. **Minimise at GENERATION, via the prompt** — tell the model that a distractor must be wrong for
     *this* item, not merely different. ⚠️ **`v89_c`/`v89_d` are the cautionary precedent**: the
     inflections prompt asked for source-language labels for three whole release lines and was obeyed
     in **1 run of 3** once hardened. **An instruction is not a mechanism.** Worth doing (it is
     nearly free) and worth measuring the way `v89_c` did — never worth believing without the
     measurement.
  2. **Decide with a LIVE model**, either at generation (a QC pass over each option: "is this
     genuinely wrong for THIS item?") or at answer time (only when the learner picked a "wrong" one,
     so the cost is paid on the rare path). **The shapes already exist** — `qcCheckPair`/`callLLMQC`
     for the first, and `POST /api/writing-feedback` (stateless, no job, graded live at play time)
     for the second. Answer-time is the better bet: it costs nothing on correct answers, and a
     "your answer is also acceptable" verdict is more useful to a learner than a silently-fixed
     lesson.
  ⚠️ **Do not ship (2) as a silent auto-accept.** A model deciding the learner was right after all
  changes `markSolved`/BKT state, and a wrong verdict there corrupts progress rather than one
  question. Show the verdict, and decide the progress question separately.

- ~~On a phone, the select-text→tutor popover is unusable~~ — **FIXED at `v89_i`** (pinned to the top
  of the visible area via `visualViewport.offsetTop`). What REMAINS open from this report: **the
  Google "Touch to Search" bar itself is not suppressed, and cannot be from a page.** The diagnosis
  is kept below because its lesson outlives the fix:
  - **The popover IS created and IS placed correctly.** Reproduced under mobile emulation (375×812,
    `maxTouchPoints:5`, explorer mode ON as in the screenshot): `display:flex`, `position:fixed`,
    rect `top 700 / bottom 736` in an 812 viewport — inside it. So neither "explorer mode blocks it"
    nor "`--bottom-bar-h` collapsed to 0" is the cause; both were measured and ruled out.
  - **What is left is where 76px-from-the-bottom lands on a real Android Chrome**: its
    *Touch to Search* bar draws over roughly the bottom 130–150 CSS px, and the native Copy/Share
    toolbar draws near the selection. Both are BROWSER CHROME, not DOM — no z-index reaches them.
    The popover is behind the Touch-to-Search bar in the user's screenshot.
  - ⚠️ **This is the SECOND time this exact bug has been fixed.** The `v84`-era comment on
    `_storySelShowPopover` records the first: the popover was hidden under the native Copy/Share
    toolbar, and the fix was to pin it to the BOTTOM. That fix has now collided with a different
    piece of chrome at the bottom. **Pinning to a fixed edge is the losing move; pick the region no
    chrome uses (the TOP, below the app header) or place from `window.visualViewport`.**
  - **The other half — "suppress the automatic Google search link" — is Chrome's Touch to Search,
    and a page cannot remove it directly.** Do not promise it without testing on a real device;
    the levers worth trying are consuming the tap (`preventDefault` on the story surfaces) and
    `-webkit-touch-callout`, neither of which this session could verify from an emulator.

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

### B. ~~Model-picker rows for the roles it does not yet show~~ — CLOSED at `v89_w`

All eight server roles now have a row. ⚠️ The open design question — *"Ollama's capabilities
field vs. a family-name allowlist"* — was settled by MEASUREMENT: the vision row filters on
`/api/show` `capabilities`, because `translategemma:12b` and `qwen3.6:35b-a3b` both report
vision and a name allowlist would have kept only `qwen2.5vl`, dropping six working models.
Three `ui.json` keys, granted. See the `v89_w` entry.

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

## ✅ RESOLVED BY USER RULING AT THE v89 CUT — no code change, not carried as open tasks

**The completion card's missing "force-regenerate" (text-analysis) control** — carried as buildable
filler work since the `v88_a` prompt. **User's ruling: *"we don't need it, completion card is not
thought to generate text analysis."*** Do not build it, and do not re-derive it as a symmetry gap.

The observation behind the item was correct as far as it went: the lesson-set card has BOTH
`#ls-story-explorer-btn` (view) and `#ls-story-analyze-btn` → `analyzeChaptersRun` (generate /
re-generate, with `v88_x`'s Expand-vs-Overwrite dialog), while the completion card has only
`#comp-story-explorer-btn`. Toggling the explorer there on an unanalysed chapter fires
`_ensureTextExplorerData` and degrades to the empty state with no control to fix it.

⚠️ **The ruling is a SURFACE decision, not a cost one**, and that is what stops it coming back: the
lesson-set card is a teacher/curator surface, the completion card is where a LEARNER lands after
finishing a chapter, and generation belongs on the former. The asymmetry is the design. A future
session noticing "these two surfaces show the same explorer but only one can generate it" is looking
at the intended state.

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



# 🖥️ WHAT A REAL GPU SERVER WOULD BUY (measured at the `v89_m` cut)

User request: *"a coarse estimate how much faster our most limiting functions (tutor, text analysis)
would run on a proper server with unlimited GPU and VRAM resources."*

**Coarse, but derived from measurements on the actual box rather than from feel.** Re-measure before
spending money on it.

## The finding that decides everything: there is no GPU at all

```
nvidia-smi                    -> not present
/api/ps  qwen3.6:35b-a3b      -> size 23.1 GB, vram 0.0 GB      ← 100% CPU
lscpu                         -> Intel Core Ultra 7 165U (14 threads, 15 W laptop class)
free -g                       -> 62 GB RAM
```

Every model runs **entirely on a low-power laptop CPU**. That is the single fact behind every
"this is slow" report in this line.

## The throughput anchor

One real `/api/chat` against `qwen3.6:35b-a3b` (the tutor's and the analysis role's default):

| phase | measured |
|---|---|
| **prefill** (reading the prompt) | **13.9 tok/s** |
| **decode** (writing the answer) | **5.5 tok/s** |
| model **load** (cold, from disk) | **~70 s** |

⚠️ **Prefill at 13.9 tok/s is the part that hurts most**, and it is invisible in a "how fast does it
type" intuition. Every long-context task — the tutor (a whole story in its system prompt), CP2
analysis, lesson generation — pays it before producing a single token.

**Sanity check of the model of the system:** inflections generation was measured at 300–440 s per
lesson (`v89_c`'s spike). Predicted from the two rates: ~2,100 prompt tokens ÷ 13.9 = 151 s, plus
~600 output ÷ 5.5 = 109 s → **~260 s**. Same ballpark, so the two rates do explain the observed
latencies.

## Reference figures for a proper server

`qwen3.6:35b-a3b` is a 35 B **MoE with ~3 B active** parameters, ~24 GB at Q4 — it fits one A100/H100
comfortably and one 24 GB consumer card just barely. Single-stream, for a 3 B-active MoE:

| phase | laptop CPU (measured) | one datacentre GPU (typical) | factor |
|---|---|---|---|
| prefill | 13.9 tok/s | 2,000–10,000 tok/s | **~150–700×** |
| decode | 5.5 tok/s | 80–200 tok/s | **~15–35×** |
| model load | ~70 s | 2–5 s, and **kept resident** | effectively removed |

## The two functions the user named

**Tutor** — story context (capped at 4,000 chars ≈ 1,200 tokens) plus history in, ~250 tokens out:

| | prefill | decode | total |
|---|---|---|---|
| now | 1,200 ÷ 13.9 ≈ **86 s** | 250 ÷ 5.5 ≈ **45 s** | **~130 s** (+70 s on a cold model) |
| GPU | ≈ 0.4 s | ≈ 2.5 s | **~3 s** |

### **≈ 40× faster — and up to ~60× when the current cold-load penalty is included.**

**Text analysis (CP2)** — `analyzeChapter` runs **per sentence**; ~15 sentences in a typical chapter,
each roughly 800 prompt + 300 output tokens:

| | per sentence | whole chapter (15) |
|---|---|---|
| now | ≈ 58 s prefill + 55 s decode ≈ **113 s** | **~28 minutes** |
| GPU, serial | ≈ 0.3 s + 3 s ≈ **3.3 s** | **~50 seconds** |

### **≈ 34× faster serially — and realistically 50–150× for a whole chapter**, because the sentences are independent and a GPU serves them with continuous batching. The laptop cannot overlap them at all.

## Three things the raw multiplier understates

1. **Concurrency is the bigger win for multiple users.** Single-request latency improves ~20–40×;
   *throughput* with continuous batching improves far more, because the laptop serialises everything
   onto one busy CPU. This matters more than latency for the multi-user plan below.
2. **The idle-release trade-off disappears.** `v88_l`'s 60-minute release exists because a 24 GB model
   parked in RAM on a laptop is expensive. With enough VRAM you keep every role resident and the
   ~70 s cold-load penalty — currently paid on the first request after any quiet hour — is gone.
3. **The model choices get re-opened.** `v89_l` picked `qwen2.5:14b` over `qwen3.6:35b-a3b` because a
   dense 12 B was **4× slower** than a 3 B-active MoE *on CPU*. On a GPU that ordering can invert:
   dense models parallelise better, and VRAM stops being the binding constraint. **⚠️ Every
   model-role default in this repo was measured on CPU and should be re-measured on the target
   hardware.** `v89_l`'s own five-case bench is the harness to re-run.

## What would NOT get faster

Nothing in the app's own hot paths is CPU-bound outside the model: `lessons.json` is read once at
boot, `buildExercises` is milliseconds, the static build is seconds. **A GPU buys model time and
nothing else** — which, given the numbers above, is essentially all of the wall-clock anyway.

# 🌐 PUTTING THIS ON THE INTERNET, MULTI-USER — a rough prioritisation (`v89_m`)

User request: *"a rough prioritization list for making this app available on a live server,
accessible from the internet, with multiple users, where users can generate and optionally publish
lesson sets."*

**Ordered by what breaks first, not by what is most interesting.** Everything below is grounded in
what the code actually does today; the ⚠️ items are ones this line already has evidence for.

---

## TIER 0 — Do not expose the current server to the internet at all

These are not "nice to have first". Each one is a way the app as it stands loses data or gives a
stranger the keys.

### 0.1 ⚠️ `lessons.json` is a single global file, read ONCE at boot and written WHOLESALE

`let store = loadStore()` runs at line ~756, one call site; `saveStore` writes the whole in-memory
object. **This is already a proven data-loss mechanism, not a theoretical one** — it silently reverted
`v89_f`'s 28 backfilled items within minutes (`v89_g`, and INTERNALS' silent-failure-modes section).

With two users it is worse than a backfill clobber: **every save by user A overwrites every change
user B made since A's process last read the file.** With two *server processes* it is unbounded.

> **Nothing else on this list matters until this is fixed.** It is the difference between a
> single-user toy and a service.

The shape of the fix is a real decision (a database; or per-user stores plus a shared read-only
corpus; or an append-only log). **It is the one architectural choice the rest of the plan hangs off,
so make it first and deliberately.**

### 0.2 There is no authentication, and every write is `admin`

`DEFAULT_USER = 'admin'` — literally every generated object is stamped with it. `learners.json` holds
one learner. There is no login, no session, no ownership field that means anything. Anyone who
reaches the port is the administrator.

### 0.3 Unbounded, unauthenticated LLM spend

`/api/generate`, `/api/generate-book`, `/api/tutor`, `/api/answer-check` and the rest will run a model
for anyone who posts to them. On a metered GPU that is a bill; on a shared one it is a denial of
service against your own users. **Needs auth (0.2) plus per-user quotas and a queue before it is
reachable from outside.**

### 0.4 Jobs are global and unscoped

`/api/jobs` lists everybody's jobs with their labels — which contain chapter titles and user text.
`/api/job/:id` and `POST /api/jobs/cancel` have no ownership check, so any user can read or cancel any
other user's work. **Small to fix once 0.2 exists; unfixable before it.**

### 0.5 Transport

`v70_b` already warns about plain HTTP (`e2e-tls-warning`). On the internet this is TLS + a reverse
proxy, non-negotiable, and cheap — put it in Tier 0 because it costs an afternoon, not because it is
hard.

---

## TIER 1 — What makes it genuinely multi-user

### 1.1 A real user model, and what "mine" means
Ownership on topics, storylines and learner progress; `createdBy` becoming meaningful rather than a
constant. ⚠️ **`backfill-createdby.js` already exists** and stamped the corpus — that groundwork is
done, the semantics are not.

### 1.2 Per-user learner state
`learners.json` is one learner today, and the standing rule *"one learner; progress impact is not a
blocker on shipping"* is a **single-user rule that must be retired deliberately** the moment there are
two. Grep for it before starting: several tests lean on it.

### 1.3 One model backend, many users → a queue
Today generation is effectively serialised by the hardware and nobody notices. With N users you need
an explicit queue with fairness, plus per-user concurrency caps. ⚠️ The `runAsJob` + `_jobAwait` shape
(`v88_al`) is already the right primitive — every long route is a listed, cancellable job. **The
scheduler is the missing half, not the plumbing.**

### 1.4 Abuse surface on user-supplied text
Stories are pasted or photographed by users and go straight into prompts. Prompt injection here does
not reach other users' data, but it does reach your model spend and your output. Worth a bounded
review, not a rewrite.

---

## TIER 2 — Publishing, which is half-built already

### 2.1 ⚠️ The static build is the publishing mechanism, and it exists
`build-static.js` already produces a self-contained read-only `docs/index.html` with the corpus baked
in. **"Publish a lesson set" is much closer than it looks** — the missing parts are per-set (rather
than whole-corpus) export, and a share URL.

### 2.2 What "publish" means for the corpus
A published set must be a **snapshot**, not a live pointer into a mutable global store — otherwise a
later edit silently rewrites what somebody else linked to. This is 0.1's decision showing up again;
resolve it there and this follows.

### 2.3 Moderation and licence
Published content is user-generated and often photographed from the world (`ATTRIBUTIONS.md` and the
provenance fields already track some of this). Decide the policy before the first publish button, not
after.

### 2.4 ⚠️ Fix the static build's own gaps first
`v89_m`'s audit found `loadScripts()` is never called by the static `init()`, so `SCRIPTS_DATA` stays
`{}` and the **LLM-free alphabet course cannot be offered** in a published build even though it needs
no backend. Publishing a broken artifact is worse than not publishing. See the open list.

---

## TIER 3 — Operational, once it is actually serving people

- **Backups of whatever replaces `lessons.json`.** The `.bak` convention the backfills use is a
  single-user habit and does not survive contact with a service.
- **Observability**: the `_genMeta`/`generationStats` provenance already recorded per lesson is a
  good start; per-user cost accounting is not there.
- **Idle release vs. residency** (`v88_l`): a laptop-shaped trade-off. On a server, keep models
  resident — see the GPU section above.
- **⚠️ Re-measure every model-role default on the target hardware.** All of them, including
  `v89_l`'s, were chosen on CPU, and `v89_l` showed the CPU ordering can be the reverse of the GPU
  one.

---

## The one-line version

> **Fix the store (0.1), add identity (0.2), then rate-limit and scope the jobs. Publishing is the
> easy part and is half-built; the store decision is the hard part and everything else depends on
> it.**

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

## Rules earned in the v89 line

*The incident behind each lives in this file's own entry for that release.*

1. **⚠️ AN UNBOUNDED SEARCH USED TO DELIMIT AN EDIT DESTROYS FILES** (`v89_o`, and AGAIN at
   `v89_v` — the second time it was COMMITTED). Twice in one line, by the same hand, with the rule
   already written down after the first.
   - `v89_o`: two `.index()` calls bracketed a region for replacement. The closing marker also
     existed, almost identically worded, in a shipped entry hundreds of lines below — differing by
     a period inside the bold. **2,518 lines deleted**: every shipped entry, both planning
     sections, every rules block. Caught only because the file had just been committed.
   - `v89_v`: the "fix" was a line-index splice, which rule 1 as first written appeared to bless —
     but its END was `next(k for k in range(i, len) if 'wants' in lines[k] and 'ruling' in lines[k])`,
     an unbounded scan for a two-word conjunction. It matched far below. **956 lines deleted**,
     including the GPU-estimate and multi-user sections the user had asked for that same session,
     and it was **committed and pushed past a green suite** — no test reads roadmap prose.
   
   **⚠️ THE RULE, IN THE FORM THAT WOULD HAVE STOPPED BOTH: assert the SPAN, not the technique.**
   Using line indices is not the safeguard; `assert j - i < N` is. A delimiter search that can run
   off the end is the same defect whether it returns a character offset or a line number. And
   `git diff --numstat` before committing costs nothing — a documentation edit that reports
   `+128 / -956` is telling you exactly what it did.
2. **⚠️ COMMIT BEFORE A LARGE MECHANICAL EDIT.** The only reason `v89_o` cost minutes instead of a
   session was that `v89_n` had just been committed. Treat "the working tree is the only copy" as the
   actual risk it is.
3. **When a diagnosis needs a SERVER-SIDE ARTIFACT, ask for it FIRST and stop analysing** (`v89_o`).
   Three releases went to one bug report: `v89_m` called it a race (wrong), `v89_n` corrected that and
   narrowed to three hypotheses, `v89_o` closed it from a single log the user had all along. **The log
   was named as decisive at `v89_m` and would have ended it there.** Two releases were spent narrowing
   a hypothesis space one line of log collapsed to nothing.
4. **A label in evidence you already hold is evidence** (`v89_n`). `Adding word_forms lesson` is
   `/api/lessons/add-lesson`, the MANUAL route — quoted during the investigation, then reasoned past,
   producing a confident "race, not a loss" that the user had to correct. **A chapter filling up is
   not evidence of WHAT filled it.**
5. **A server that ECHOES a parameter back is not a server that HONOURED it** (`v89_o`). The book job
   logged `arc=[standard,word_forms,inflections,conjugation,comprehension]` and then built one
   standard lesson, because the arc block is gated on `i >= 1`. **A log line that reports intent
   rather than outcome actively hides the defect** — prefer logging what was DONE, and log discards
   explicitly.
6. **⚠️ Reproduce the INTERACTION, not the STATE** (`v89_k`). `v89_i` measured a popover's rect from a
   programmatically-set selection plus a bare synthetic `touchend` — a sequence that never reaches the
   handlers under suspicion — concluded it was healthy, and shipped a fix for the wrong thing. The bug
   lived entirely in the two events the repro skipped.
7. **A running server silently reverts every offline edit to `lessons.json`** (`v89_g`/`v89_h`). Now
   in INTERNALS' silent-failure-modes section, with the recovery procedure. It ate a completed
   backfill.
8. **Measure the model, do not reason about its size** (`v89_l`). The cheapest model was the one
   disqualified (a false ACCEPT, the one direction that must not fail), and a dense 12B was 4× slower
   than a 3B-active MoE three times its size. **Active parameters, not parameter count, predicted
   latency.**
9. **An instruction is not a mechanism** (`v89_c`/`v89_d`). `PROMPTS.inflections` asked for
   source-language labels for three release lines and was obeyed in **1 run of 3** even after
   hardening. The fix that worked was a post-parse TRANSFORMATION the model cannot skip.
10. **When a mutation stays GREEN, that is the finding — and ask WHICH of the two it is** (`v89_d`,
    `v89_e`, `v89_f`, `v89_g`, `v89_k`). Five releases in this line hit it. Sometimes the GUARD was
    unfalsifiable and had to go (`Array.isArray`, `|| !APP._swipeEl`); sometimes the guard was right
    and the FIXTURE was too weak (`type !== 'inflections'`); sometimes an OLDER guard was masking the
    new one (`v89_k`, twice in one file). **These have different fixes. Decide which before editing
    either side.**


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

## ✅ v89_am — the dead `kind:'sync'` path is deleted

Carried as an explicit follow-up since `v88_al`, and its own comment said so in place: *"THIS
FUNCTION NOW HAS NO CALLERS… Deliberately NOT deleted in this release… a purely internal cleanup with
its own risk, landed in a release whose subject is a user-visible behaviour change."* **ZERO
`ui.json` keys, zero behaviour change.**

Removed: `_jobsTracked`, `_jobsInflight`/`_jobsInflightSeq`, and the `kind:'sync'` branch of
`_jobsEffectiveList`. Confirmed dead first — the only surviving references in `index.html` were the
definition and its own comments.

| | |
|---|---|
| **⚠️ the TUTOR entry is NOT part of this** | It looks like a sibling and is not. Its source of truth is `_tutorState.busy` — a flag that already exists, is set from two places, survives a re-render, and is the only synthetic row carrying a `link`. `v88_b`'s own comment records that it was deliberately never migrated onto the registry. `_jobsEffectiveList` keeps it and says why |
| **the surviving CLAIM was moved, not dropped** | `unit-jobs-sync-inflight.test.js` §5 asserted the five `v88_al` routes are awaited as jobs at **every** call site — nine of them. That never depended on the registry: it is a claim about a SET of call sites, which no rendered state can observe. Moved into `unit-job-coverage.test.js`, where the rest of that question now lives; the file was then deleted. ⚠️ That section had itself been re-scoped once, at `v88_al`, from the OPPOSITE claim (every caller inside a `_jobsTracked` wrapper), so both halves are asserted: the poller present AND the wrapper absent |
| **the comments were cleaned too** | Deleting the code left three paragraphs describing a mechanism that no longer exists. Replaced by one short history block ending in the rule that outlives it: **any future blocking route uses `runAsJob` + `_jobAwait`, not a client-side row** |
| **⚠️ `sync` is KEPT in two cancel-button guards on purpose** | They assert a kind with no server-side job never gets a cancel button. The rule is about ANY such kind, so a kind that can no longer occur is still the right thing to be safe about — annotated so a later reader does not "tidy" it away as dead |
| **guards** | `unit-job-coverage.test.js` §6: the registry, the wrapper and the `'sync'` branch are gone — asserted with comments stripped first, because the function's own note explains the removal and a raw match would trip over its own explanation. **Three mutations red**, including the one that matters most for a deletion: **removing the TUTOR entry as well.** Without it §6 would only be saying "nothing is there", which an over-zealous cleanup would also satisfy |

## ✅ v89_al — item V: multiple images, each its own panel

User: *"Allow multiple photos/images to be loaded and treated like multiple panels in the
image-based story-generation pipeline."* Open since the `v86` line. **ZERO `ui.json` keys.**

⚠️ **The ruling's wording was ambiguous and the user CLARIFIED it at this cut.** The recorded ruling
read *"if multiple images are uploaded, mark all images as one panel"* — which parses both as "mark
EACH image as a panel" and as "merge all images into ONE panel". The user's clarification: **each
image is a panel.** N images give N panels. The wrong reading would have collapsed a whole upload
into a single chapter, so the clarification is now attached to every place that quotes the sentence.

`roadmap_v88.md` had also flagged a second ambiguity — "each image is a panel" and "each image is a
chapter" coincide today and diverge the moment several panels are drawn on one of several images —
and told a later session to **settle it before building**. Settled: images become PANELS.
`comicCreateChapter()` already forms one chapter per panel (`v85_p`), so three panels drawn on one
page correctly give three chapters from that page.

| | |
|---|---|
| **⚠️ THE SEAM, and why this was affordable at all** | `dataUrl`/`naturalW`/`naturalH` still mean **the ACTIVE page**, so all ~20 canvas, hit-test, redraw, resize and move call sites are untouched — they still see exactly one image, as they always did. What is new is `APP_COMIC.pages`, `pageIdx`, and a `page` on each box. Switching pages swaps the active three and redraws |
| **⚠️ cropping follows the BOX, not the screen** | `_comicCropDataUrl` cropped from the displayed image — correct for one page, silently wrong for several: every panel would have been extracted from whichever page the user happened to be looking at. It now resolves the box's own page. Kept SYNCHRONOUS (all three callers are, and `comicOpenReview` is not even async) via a per-page offscreen `Image` started at load time, with a whole-page box short-circuiting to that page's own dataUrl — which is also the dominant shape here |
| **the single-file path is byte-for-byte unchanged** | It carries most of this region's test surface and several past bugs (`v85_u` the resize observer, `v86_c` duplicated listeners, `v88_c` item AM), so the multi path was added BESIDE it rather than by generalising it and hoping. One file still REPLACES (`comicClearPanels` + item AM's whole-image pre-select); several files APPEND |
| **⚠️ "use whole image" now acts on the ACTIVE page only** | It replaced the entire box list, which for a multi-page upload would delete every other page's panels — most of the user's work — behind a button that says "use whole image", singular |
| **the draft** | Boxes carry `page`; the EXTRA pages ride in `comic.pages` while page 0 stays `dataUrl`, so a draft written here still resumes on an older build and a ~1MB page is not sent twice. ⚠️ Both the per-box `page` and `pages` had to be added to the SERVER's draft whitelist — the projection where `description` was silently dropped once already (item AN). A stripped `page` is worse than it looks: every box would collapse onto page 0 and be cropped from the wrong image on resume. Capped at 30 pages, matching the extraction route's own image cap, and an oversized page is skipped rather than failing the whole draft |
| **live-verified** | Three real canvas-generated JPEGs of different sizes (600×400, 500×700, 900×300) through the REAL handler: three pages, three whole-image panels each at its own page's size, page strip visible. Cropping all three while page 0 is displayed gives `600x400 / 500x700 / 900x300`, and the same after switching to page 2 — identical. A partial box drawn on page 2 crops to `200x150` from either view. Draft round trip: 2 extra pages stored, all four box pages preserved, all three pages and the strip back after a real resume |
| **guards** | `unit-comic-multi-image.test.js`, five sections. **Eight mutations red** — including "crop from the displayed page", which is the pre-item-V behaviour. ⚠️ The hit-test mutation first came back GREEN: the fixture's two boxes gave the same answer either way, and only a point inside BOTH (the scan runs last-first, so an unfiltered hit-test returns the other page's box) can tell them apart |

## ✅ v89_ak — the job-coverage audit: the enumeration, not another instance

User request, after the class produced two reports in one session. **ZERO `ui.json` keys.**

⚠️ **The claim kept being wrong.** `v88_ag`'s write-up said *"all EIGHT formerly-blocking model
routes are now listed, cancellable jobs behind one shape"*. It was wrong twice, and a USER found it
both times — `v89_af` (the storyboard awaited a ~30-minute generator and answered 200) and `v89_ag`
(a book job was listed but the popover refused its cancel). Each was fixed as an INSTANCE. This cut
does the enumeration instead.

| | |
|---|---|
| **the method, and why the first attempt was thrown away** | A hand sweep with `awk` over fixed windows misread three routes — it called `/api/generate` non-cancellable (it is) and `/api/generate-book` untracked (it is, in its own store). **A wrong inventory is worse than none, because it retires the question.** Redone by walking every route block with real brace matching, then classifying by whether it calls a model directly OR calls a generator that does |
| **the result: 21 model-backed routes** | 18 already correct. **1 named exemption**: `/api/tutor` is streaming and stateless (INTERNALS §6b) and appears in the popover as a client-derived SYNTHETIC entry. **2 REAL GAPS nobody had reported** |
| **⚠️ `/api/clean-text`** | The PDF "Remove ads & boilerplate" pass. It AWAITED `cleanNarrativeText` and answered 200 — and that function makes up to THREE model calls per chunk, with `aiCleanChunks` looping it once per chunk. A document import could spend many minutes in the model with no popover row and no cancel |
| **⚠️ `/api/split-chapters`** | The ✨ LLM chapter split: one model call over a whole document, invisible while it ran |
| **both converted the same way** | `runAsJob` + label + `jobStep`, validation still OUTSIDE the job (`v88_al`). Clean-text is one job PER CHUNK — the loop is sequential, so exactly one row is live at a time and each is individually cancellable; a cancel stops the BATCH rather than counting as one failed chunk. Both client callers moved to `_jobAwait`, which is where `v89_af` had to catch a half-conversion on the storyboard's SECOND caller |
| **live-verified** | `POST /api/split-chapters` → `202 {jobId}`, popover row `[running] "Splitting 3 paragraphs into chapters" kind=job` with its step; cancel → `stopped:true`. `/api/clean-text` → `"Cleaning text (21 words)"`, cancellable. And validation still answers the REQUEST: 400 on a short text and on a one-paragraph split, not a failed job |
| **⚠️ the guard is the ENUMERATION, and that is the point** | `unit-job-coverage.test.js` walks every route itself and requires each model-backed one to be a listed job or to carry a **reasoned** entry in an explicit `EXEMPT` map — an unexplained exemption is how a real gap hides in a green test. It also pins that every converted route has a POLLING client caller, and `v89_ag`'s rule as a RULE (cancel for `job`/`book`, never for `sync`/`tutor`/`draft`). **Seven mutations red**, the decisive one being a SYNTHETIC new route added mid-file that reaches a model and answers inline — caught by name |

## ✅ v89_aj — source/provenance is edited on the STORYLINE and inherited by its chapters

User request: *"Source/provenance editing currently lives on chapter-level, however we usually want
to edit this on story level. Please add a full editor for this on the storyline page. The entry is
inherited on chapter level and a chapter level entry in lessons.json is only required if it differs
from the inherited story-level provenance field. If an entry exists, we want to show it more
prominently, author and URL should be shown and clickable on the main page in the story fields, same
font as the number of chapters and edited date entries … on a separate line below the title. And on
the story page and progress/completion card in the top row (story title), in smaller font below the
title."*

**ZERO `ui.json` keys** — the `prov.*` family (`edit_title`/`author`/`licence`/`url`/`note`/`save`)
already existed and is already hand-translated, so the new editor came up in Dutch on the first run.

| | |
|---|---|
| **the rule, named on both sides** | `sourcesEqual(a,b)` and `effectiveSource(topic, storyline)` on the server, `provEffective(d)` on the client. A chapter's stored `source` MEANS "this chapter differs"; its absence means "inherit". Every read goes through the resolver — reading `d.source` directly is how a surface would show nothing for a chapter inheriting a perfectly good entry |
| **⚠️ equality treats absent and blank as the same** | The editor always sends all four fields, so `{author:'x', licence:'', url:'y', note:''}` must equal a stored `{author:'x', url:'y'}` — otherwise nothing ever matches and every chapter keeps a redundant copy |
| **⚠️ a duplicate is not inert** | Saving a chapter entry equal to its storyline's DELETES it instead. Left in place it would silently detach that chapter from every later storyline-level edit — the storyline edit would reach every other chapter and not this one. Setting the storyline also frees chapter entries that now merely repeat it (`freed` in the response), rather than waiting for a chapter save that may never come |
| **⚠️ `upsertStoryline` merges, so `delete` does not clear** | It does `{...existing, ...sl}`, so deleting a key on the local object is undone by the spread. Clearing writes an explicit null and drops the key after the merge. Found by reading that function rather than by trusting `delete` |
| **⚠️ the savedList projection, for the FOURTH time** | Chapter `source` had to be added to the whitelist. The projection's own comments record this trap three times already (`v74_i`, `v79_n`, `v89_y`): a field left out works in the STATIC build, which ships whole topics, and is silently dead LIVE |
| **⚠️ an id collision I introduced, caught by an existing e2e** | The new line under the storyline title was first given `id="sl-screen-prov"` — which ALREADY belonged to the storyline page's provenance/stats footer (`provLineForChapters`). `getElementById` then handed my node to the footer's renderer too, silently breaking it. `e2e-pass-mark`'s ordering assertion is what caught it; renamed to `sl-screen-src` |
| **the three surfaces** | Landing storyline card: a second `.storyline-title-sub` line — the SAME class as the chapter-count/date line, so "same font" holds by construction rather than by a copied value (verified: 11px vs 11px). Storyline page: under the title row, with the teacher-gated editor pencil. Completion card: under the story title, showing the EFFECTIVE (usually inherited) entry. The link carries `event.stopPropagation()` because these lines sit inside clickable storyline cards |
| **live-verified against an ISOLATED store** | `LESSONS_FILE=<copy>`, so the user's own data was never touched. Landing card shows `Erik Meinhardt · CC BY-SA` on its own 11px line with a working link; the storyline editor round-trips (`Randall Munroe` persisted and the line repainted); the completion card shows the INHERITED entry for a chapter with no `source` of its own |
| **guards** | `unit-provenance-inherit.test.js`, six sections: equality (blanks vs absence, and a real difference in each of the four fields), inheritance (own wins / inherit / empty is not a value), both routes enforcing the rule, the savedList whitelist, client rendering (clickable, DOI-expanded, escaped, non-propagating), and all three surfaces plus the editor's POST body. **Nine mutations red** |

## ✅ v89_ai — the running-jobs badge updates when a job STARTS

User report: *"the hourglass icon shows a little superscript with the number of running jobs. However,
this is not shown automatically when starting a job, I need to click the hourglass / open the job
popover once to update. It should be shown w/o clicking."* **ZERO `ui.json` keys.**

⚠️ **The old behaviour was deliberate, and its reasoning is still right.** `refreshJobsPill()` ran once
per screen change, and the 3s poll ran **only while the popover was open** — the codebase's own
"per-feature pollers only run while relevant" convention. A standing interval for a count nobody is
looking at really is waste.

**But polling was never the answer.** The client KNOWS the moment a job starts: it has just been
handed the `{jobId}`. So the badge is bumped at that instant. No new timer, no change to the polling
policy — one extra `GET /api/jobs` per job STARTED.

| | |
|---|---|
| **`_jobsBump()`** | An immediate re-read, plus ONE 4s follow-up so a job that finishes in a second or two does not leave the count stale until the next navigation. Two cheap checks, not a loop |
| **⚠️ five call sites, because `_jobAwait` is not the only starter** | `_jobAwait` covers the whole `runAsJob` family in one place. FOUR others run their own pollers and never touch it — comic extract, comic detect, the PDF book job and the comic book job. Missing one would have left exactly the reported symptom on that path alone, which is the hardest kind of half-fix to notice |
| **guards** | `unit-jobs-badge-live.test.js`: §1 starting a job through the REAL `_jobAwait` re-reads `/api/jobs` and the badge reads `1` with no popover interaction; §2 the count is right and a FINISHED job is not counted (non-vacuity — without it, "2" would only prove something rendered); §3 all four independent starters bump, asserted per starter; §4 **an idle client issues NO requests**, i.e. this did not quietly become a standing poller. **Five mutations red** |
| **⚠️ my own test hung, and that is a finding not a nuisance** | It printed ALL PASSED and then never exited — a 100-second `_jobAwait` poll timer left pending by a stub that never settled. Registered in `run.js` that would have hung the WHOLE SUITE, which is precisely what `_qcPoll`'s own comment records happening once before. Found by instrumenting `setTimeout` to list still-pending timers rather than by guessing. ⚠️ It also took two attempts because a `pkill -f "unit-jobs-badge-live"` matched the shell command that CONTAINED that string and killed the edit mid-flight — a self-inflicted wound worth remembering |

## ✅ v89_ah — the text-analysis token popover can actually save

User report, on `tp_17886338472190000441`: *"editing text analysis individually didn't work, save had
no effect. Second, editing via the text analysis table (icon ▤) worked, but left a blue line left of
the edited word."* **ZERO `ui.json` keys.** One real defect, one non-defect, and a guard that had been
pinning the defect as correct.

### ⚠️ It was never a logic error — the handler was broken in the MARKUP

`JSON.stringify` emits DOUBLE quotes, and the Save button interpolated them straight into a
double-quoted `onclick`. The browser parsed:

```html
onclick="_teSaveCorrection(" tp_178…",0,0,"riesenfrei")"=""
```

The handler truncated to `_teSaveCorrection(` — **SyntaxError on every click** — and the remainder
became a garbage attribute name. Nothing was ever sent to the server. Confirmed in a real browser by
reading the button's own `outerHTML`, then fixed with `escAttr(saveCall)` and verified end to end:
type → Save → the correction really lands (`reviewed:true`) and the popover closes.

| | |
|---|---|
| **⚠️⚠️ THE SAME BUG WAS FIXED AT `v88_ai`, ON THE BUTTON NEXT DOOR** | That entry's own comment: *"the cause was ESCAPING… the ids were interpolated with JSON.stringify, which yields DOUBLE quotes — inside a double-quoted onclick attribute those close the attribute, so the handler was the fragment before them and the click did nothing."* It fixed `_teOpenCuratorTable`'s ▤ button and **never swept for the second instance**, which `v88_ad` had added a few hundred lines away. "Where else is this question asked?" was not asked. A sweep at this cut finds **zero** remaining instances |
| **⚠️ and the same TEST mistake, twice** | `v88_ai`'s comment also records *"my guard had asserted the markup merely CONTAINED `_teOpenCuratorTable` — a substring present in the broken version too, which is why a test passed over a button that could not work."* `unit-text-explorer` then asserted the popover's innerHTML contained `_teSaveCorrection("tp_te1",0,0,"landschap")` — the **UNESCAPED** form, i.e. it required exactly the broken markup. **The guard was pinning the defect.** Re-pointed to read `getAttribute('onclick')` (which decodes entities as a browser does) and to `new Function(...)` the result, so "the browser can actually run this" is the claim. Mutation-confirmed: it now goes red on the unescaped form |
| **⚠️ every existing test drove the FUNCTION, never the BUTTON** | Which is why a full green suite meant nothing here. `v89_x` learned this ("driving a helper directly proved nothing about the caller") and it repeated. The new file asserts on the RENDERED attribute only |
| **a second, independent defect found on the way** | The dismiss was `document.addEventListener('click', () => _teCloseWordPop(), {once:true})` — fire on ANY click, no containment test. Correct while the popover was read-only; `v88_ad` added three inputs and a Save button and never updated it, so **the first click INTO a field removed the editor**. Both other popovers in the file already test `contains(e.target)` (`_modelPopOutside`, the language picker's `h(e)`). Now the same, plus Escape, with both listeners torn down in `_teCloseWordPop` |
| **⚠️ and that failure mode was DESTRUCTIVE** | Three empty strings is the route's documented CLEAR gesture. So a save whose fields had vanished would **delete** the correction rather than fail. `_teSaveCorrection` now refuses when the editor is not open — gated on `_teWordPopEl`, not on the inputs, because a `getElementById` miss returns null in a browser but an auto-vivified stub in lib-dom, so a fields-only check is exactly the guard that cannot fail where it matters |
| **the blue line is NOT a bug** | `.te-tok-reviewed{border-left:2px solid var(--blue)}` — `v88_ad`'s marker for "a human curated this token", so curation is visible rather than silently indistinguishable from the model's own output. It persists after a restart because the correction persists, which is the feature working. Left as is; it is undiscoverable without a legend, which is a separate (and key-costing) question for the user |
| **guards** | `unit-te-popover-save.test.js`: §1 the rendered onclick is complete, PARSES, and carries the right four arguments; §2 a surface containing a quote and an apostrophe still yields a runnable handler with the value intact; §3 a save with no open editor sends NOTHING; §4 the dismiss checks containment and tears its listeners down. **Five mutations red**, including the reported bug reproduced exactly |

## ✅ v89_ag — a running story/book job can be cancelled from the popover

User report: *"creating a story has no cancel/open buttons in the job popover."* **ZERO `ui.json`
keys.** Both halves investigated; one was a real defect and one is honest behaviour.

⚠️ **The cancel was a DELIBERATE exclusion whose reasoning was right and whose conclusion was
wrong.** `_jobsRenderList`'s own comment: *"`book` is excluded too: multi-chapter generation lives in
the separate `bookJobs` store with its own cancel route (`/api/book-job/cancel`), which this one does
not reach."* True of the route — but **the answer is to reach it, not to withhold the button**. A
book job is the longest-running thing in the app, chapter after chapter, so it is precisely the one a
learner wants to stop; the route already existed and already worked, and the PDF panel's own
`pdfCancelBook()` had been calling it all along. Only the popover was denied it.

| | |
|---|---|
| **the fix** | `canCancel` widens by exactly ONE kind (`job` → `job` or `book`), and `_jobsCancelById(id, kind)` dispatches: `/api/book-job/cancel` + `{bookId}` for a book, `/api/jobs/cancel` + `{jobId}` otherwise. The kind is looked up from the current effective list by id — the same way the open button resolves its `link`, and for the same reason `_jobsLastList` is at module scope at all |
| **⚠️ the exclusion is NARROWED, not removed** | `sync`, `tutor` and `draft` still offer no cancel. They have no server-side job at all, so `POST /api/jobs/cancel` would look up the id, find nothing and answer `stopped:false` — a button there would be a lie. That is the original comment's real point, and it still holds |
| **⚠️ the route had to learn to tell the truth first** | `/api/book-job/cancel` answered a bare `{ok:true}` whether or not it found a running job. Fine for its only previous caller (`pdfCancelBook()` ignores the body), but `v88_k`'s ruling on this very button is that *telling a learner "cancelled" while the model is still running is the exact bug it exists to prevent* — and **a caller cannot be honest about an outcome the route will not tell it**. It now answers `{ok, stopped}`, matching `/api/jobs/cancel` |
| **`cancelBookJob(bj)` is a NAMED function** | Same reason as `v89_af`'s `pingFailureIsHard`: inline in the route the decision was invisible to a test, and **a mutation reporting `stopped: true` unconditionally left the suite GREEN**. Named, it is driven over running / done / error / cancelled / pending / unknown — including cancelling the SAME job twice, which must report false the second time or a double-click claims two cancels |
| **the OPEN button is honest, not broken** | A book job's `link` is `{type:'topic', id: firstTopicId}` where `firstTopicId` is the first chapter that has one — and `topicId` stays null until that chapter is SAVED. So during chapter 1 there is genuinely nothing to open, and the button appears as soon as the first chapter lands. `bookJobs` carries no storyline id either, so there is no earlier target to point at. Left as is; noted here so it is not "fixed" into a link that goes nowhere |
| **guards** | `unit-book-job-cancel.test.js`: §1 a running book job offers cancel and a finished one does not, with `sync`/`tutor`/`draft` still excluded (the narrowing) and a plain job as the non-vacuity partner; §2 the book kind reaches the book ROUTE with the book BODY while plain jobs are untouched; §3 "cancelled" is claimed only when something was really stopped, plus the lifted `cancelBookJob` driven over six states and a double-cancel. **Nine mutations red, one only after a first pass came back green** |

## ✅ v89_af — storyboard runs as a job, and a stalled machine is no longer read as a dead Ollama

Two user reports, one release. **ZERO `ui.json` keys.**

### 1. *"storyboard generation doesn't show up in job popover"*

`/api/storyline-storyboard` **awaited** `_storyboardForStoryline` and answered 200 when it finished —
no job, no progress line, no cancel. Its own comment called it *"a synchronous ~30-min call"*, so the
**longest model call in the app was the one with no row anywhere**.

⚠️ Exactly the defect `v88_ag` fixed for `/api/story-qc` and `/api/summary-qc`, found the same way —
a user noticing a click showed nothing. That release's write-up says *"all EIGHT formerly-blocking
model routes are now listed"*; this route was never in that count, because it is reached from the
**storyline screen** rather than from a lesson card. The enumeration was of the wrong set.

| | |
|---|---|
| **the conversion** | `runAsJob` with a `label` and a `link: {type:'storyline'}` (which is what gives the popover row its "open →" button), plus a `jobStep` naming the model and the chapter count. Validation stays OUTSIDE the job — `v88_al`'s rule: a 503/400/404 answers the REQUEST, and turning it into a failed job makes a malformed call look like a model failure |
| **⚠️ BOTH client callers, not just the reported one** | `genStorylineStoryboard()` is the button. The post-generation pass (`opts.storyboard`) calls the SAME route, and left unconverted it would have read the 202 `{jobId}` as a response with no `storyboard` field and **silently dropped the result** — the exact half-conversion `v88_aj` warns about. Both go through `_jobAwait` now; the DELETE route is untouched (no model call) |
| **live-verified end to end** | Real storyline, real server: `POST → 202 {jobId}`; `GET /api/jobs` shows `kind:"job"`, `status:"running"`, the label, the link and the step `[qwen3.6:35b-a3b] Generating storyboard (2 chapter(s))…`; cancel returns `stopped:true` and the job settles `cancelled`. `canCancel` is derived client-side from `kind==='job' && running`, so the popover really will draw the button |

### 2. *"I still get these messages when the laptop loses its wlan connection… it shouldn't need wlan, right?"*

**They are right, and the network was never the cause.** What I ruled out, by measuring on their own
machine rather than reasoning:

- **Ollama listens on `127.0.0.1` only** — nothing about it is routable.
- `localhost` resolves from `/etc/hosts` (nsswitch is `files` first) in **3ms**; `dns` is never consulted.
- **360 probes across three minutes of live wlan flapping: ZERO failures**, worst DNS 3ms, worst HTTP 10ms.
- Inference load does not starve it either: 34 probes during a real generation, worst **45ms**.
- Not suspend/resume — the journal shows no suspend at all.

⚠️ **What the machine does show**: `llama-server` resident at **22.4GB**, `free` at **0**, and
**11.4M pages swapped in / 17.8M out**. And the wlan failures are **1564 `ip-config-unavailable`
events in one boot** — that is **DHCP timing out, not signal loss**. So the two symptoms are
**siblings, not cause and effect**: the machine stalls, DHCP misses its deadline and the wlan drops,
and the 2-second Ollama ping misses its deadline and the server declares itself offline.

| | |
|---|---|
| **the actual defect** | The re-check treated **a timeout and a refused connection as the same observation**. `ECONNREFUSED`/`EHOSTUNREACH`/`ENOTFOUND` is proof nothing is listening. A timeout on a swapping box is proof of nothing — and two of them, 60 seconds apart, flipped the whole server into offline mode |
| **the fix** | `pingFailureIsHard(code)` — a NAMED function, and that matters: as an inline ternary the decision was invisible to a source check, and **a mutation flattening it to `true` (restoring the reported bug exactly) left the suite GREEN**. A hard refusal still needs 2 checks; a soft stall needs `BACKEND_SOFT_FAILS` (4). The background re-check also gets its own `BACKEND_PING_TIMEOUT_MS` (15s, was 2s) — nobody is waiting on a 60-second background timer, so a tight timeout buys nothing and costs a false offline |
| **and it now SAYS why** | The old line was just *"Ollama unreachable (2 checks)"* — naming neither the reason nor the timing, which is precisely why the user could ask "why does that happen?" and nobody could answer. It now prints the code and the elapsed ms, and adds a plain-language line when the failure was a timeout rather than a refusal |
| **guards** | `unit-storyboard-job.test.js`. §1-2 the route and BOTH callers. §3 the loop's wiring **plus the lifted `pingFailureIsHard` driven over 9 codes**. §4 BEHAVIOURAL: a real dead port reports `ECONNREFUSED`, a real accept-then-say-nothing server reports `TIMEOUT` after its full budget, and a real answering server clears the recorded failure — the three cases the whole distinction rests on. **Nine mutations red, two of them only after a first pass came back green** |
| **⚠️ the same trap as `v89_ae`, twice in two releases** | §4's first draft used `execFileSync` to run its probes, which **blocks the parent's event loop** — so the stub server could not accept while the child probed, and the live-server case failed and looked like a broken ping. The refused and stalled cases passed only by accident: the kernel refuses a dead port and completes a handshake into the backlog without the process running. A synchronous call in a test whose subject needs the event loop measures nothing |

## ✅ v89_ae — ui.json hot-reload survives more than one hand edit

Found while verifying `v89_ad` against the user's own restarted server, by asking a question about
THEIR workflow rather than about the code: they hand-translate `ui.json`, so does an edit made the
way an editor actually saves still hot-reload? **ZERO `ui.json` keys, one behaviour fixed.**

⚠️ **PRE-EXISTING, and `v89_ad` only covered half of it.** `fs.watch(path)` follows the INODE on
Linux. `v89_ad` made `saveUI` re-arm after the SERVER's own atomic write — but the common way for
anything else to save a file is write-temp-then-rename, which is what **`sed -i`, VS Code and vim in
its default configuration all do**. Measured on a real file with the real watcher shape:

```
in-place edit      → reloads: 1
1st rename edit    → reloads: 4
2nd rename edit    → reloads: 4    ⚠️ WATCH IS DEAD
```

So the app picked up the user's first hand edit and then silently ignored every one after it, until
the server restarted or happened to write `ui.json` itself. Nothing indicated this had happened —
the symptom is "my translation didn't show up", which reads as the translation being wrong.

| | |
|---|---|
| **the fix** | `_watchUI` re-arms inside its OWN callback, not only from `saveUI`. Closing and reopening a watch raises no event of its own, so it cannot feed itself. After: `1 / 4 / 7` — the second rename-based edit reloads |
| **⚠️ the guard is DRIVEN, not read** | `unit-atomic-write.test.js` §5 lifts the real `_watchUI` out of `server.js` and runs it against a real file through a real in-place edit and two real renames. A source-level check that the function "contains a re-arm" could not fail for the thing that matters |
| **⚠️ and the first draft of that guard failed for the wrong reason** | It settled with `execFileSync('sleep', …)`, which **blocks the event loop** — so the watcher's own `setTimeout(reloadUI, 100)` never ran, every reload count read 0, and it looked like a broken watcher. Replaced with a real `await`; the file's section 5 is now async. Worth remembering: a synchronous sleep in a test that is waiting on a TIMER measures nothing |
| **guards** | §5 rewritten as above (in-place reloads, 1st rename reloads, **2nd rename reloads** — that last one is the whole assertion), plus the source check that `saveUI` re-arms. Two mutations red: removing the in-callback re-arm reproduces the pre-`v89_ae` gap exactly; removing the reload entirely also goes red. 10/10 stable |

## ✅ v89_ad — the flake audit's real finding: the tests were never flaky, the WRITER was

User instruction: *"do the flake audit"* — `unit-ui-journeys` and `unit-word-progress`, carried as
"known flakes — `buildExercises` corpus-sampling randomness" since the `v88` line.
**ZERO `ui.json` keys.**

⚠️ **FOUR FOR FOUR.** Every "known flake" this project has actually examined turned out to be a real
defect the label was hiding — `v87_i` a `Math.random()` in the PRODUCT, `v88_h` a test driver
branching on a proxy, `v88_ak` a guard counting log entries as sweeps, and now this. **The label was
wrong again, and this time the defect risks the user's whole corpus.**

| | |
|---|---|
| **the measurement, before any code** | 40/40 standalone each. 60/60 for `unit-word-progress` under seeded shuffles (a real mulberry32 PRNG, so the orderings are plausible). 15/15 each under 8-way CPU load — the `e2e-idle-release` shape. Clean every way that was tried. **The files are not flaky.** |
| **⚠️ a probe of mine produced a FALSE ALARM, and saying so is the point** | Forcing `Math.random` to a CONSTANT (0 / 0.5 / 0.9999) made `unit-word-progress` §6 fail deterministically (`meinen 2/3`, `aufessen 1/2`). Tempting, and wrong: a constant `random` makes `shuffle` change which items get SELECTED, not just their order, so it explores permutations a fair shuffle cannot produce. 60 real seeds all pass. Recorded because the adversarial-extremes technique is worth reusing and its failure mode is worth knowing |
| **⚠️ a claim of mine was WRONG and is corrected here** | While explaining the item I said neither file calls `buildExercises` — from grepping the test sources. They reach it INDIRECTLY, through the product: instrumenting `Math.random` inside the sandbox counted **54,991** calls for `unit-ui-journeys` and **448,081** for `unit-word-progress`, every one of them `shuffle` inside `mk`/`wV`/`mkLMcq`/`pick`/`buildSynonymsExercises`. For these two files the label's stated MECHANISM was real; only its conclusion was wrong |
| **the actual cause, reproduced** | The one condition never tried: `lessons.json` being rewritten while the test reads it — which is what the user's own live server does all day, and what really happened during a `--quick` run earlier in this same session (the corpus moved 348→350→351 mid-run and `unit-word-progress` failed). With a churning corpus in an isolated copy: **3 failures in 25 runs**, all `SyntaxError: Unterminated string in JSON`. Same churn rate through an ATOMIC writer: **0 of 25**. Then re-run through the REAL `saveStore` lifted from `server.js`: **0 of 25** |
| **⚠️ the far more serious half** | `fs.writeFileSync` on a 10MB file is a truncate followed by many `write()` calls. A torn READ is the mild consequence. A crash in that window — SIGKILL, OOM, power cut — leaves a **partial `lessons.json`**, and **there is no backup anywhere in this project**. 352 topics, 99 storylines. The same window covered `learners.json` (credentials, rewritten on EVERY answered question), `ui.json` (hand-translated into five languages), `drafts.json` (item R's whole durability story) and `canonical-analysis.json` (minutes of CP2 time per sentence) |
| **it was already known, and worked around** | `reloadUI`'s own comment says a parse error is *"skipped rather than blanking the strings (e.g. mid-write)"*. A reader defending itself against a torn file is the symptom; nobody had gone to the writer |
| **the fix** | `atomic-write.js` — write to `FILE.tmp<pid>`, then `rename(2)`, which is atomic within a filesystem. The temp is the target path plus a suffix, so it can never land on another filesystem (the one way rename stops being atomic). All **seven** durable-store writes converted: `STORAGE_FILE`, `SKILLS_FILE`, `DRAFTS_FILE`, `UI_FILE`, `ANALYSIS_STORE_FILE` ×2 in `server.js`, and `LEARNERS_FILE` in `learners.js`. The one-shot maintenance scripts are deliberately left alone — a human runs them one at a time and re-runs on failure |
| **⚠️ the trap this could not have been a blind sweep for** | `fs.watch(path)` follows the INODE on Linux, and an atomic write REPLACES the file. Converting `saveUI` without more would have left the watcher pointed at a file nobody writes again, and **the user's own hand edits to `ui.json` would have silently stopped hot-reloading**. `_watchUI()` is now re-armable and is called after every write |
| **⚠️ and a security detail** | `rename` preserves the TEMP file's mode, so `learners.json`'s 0600 has to be set on the temp — writing 0644 and chmod-ing after the swap would publish the credential store for the width of that window |
| **⚠️ a SECOND, unrelated red found by the same run — and it was deterministic** | `unit-story-unlocked-page` failed **15 of 15**, which is never the documented flakiness (`v87_o`'s rule: a deterministic failure is a different animal). `git show HEAD:lessons.json` isolated it in one command — it PASSES against the committed corpus. Its file-wide fixture was a `find()` on a STRUCTURAL predicate ("has prep lessons and a story-gated one") that never checked the state every section actually needs: that completing the prep leaves work behind. The live server added chapters, the selection moved to one where `_firstUnfinishedLessonIdx` returned -1, and the file died. ⚠️ **§6 of that same file had already learned this exact lesson** — *"`find()`-ing one chapter and hoping is how this section broke on the first data drop"* — and sweeps for its own fixture; the file-wide pick never did. It now MEASURES the state through the real helpers and takes whichever chapter produces it. 12/12 after, 0/15 before; the mutation that restores "take the first candidate" goes red |
| **⚠️ MY OWN NEW TEST WAS FLAKY, 4 of 12** | Caught by measuring it rather than by trusting a single green run. §1 `SIGKILL`s its writer process, which legitimately cannot clean up its temp file — and §3's debris check scanned the whole TEMP DIRECTORY, so it caught that orphan. The over-broad assertion was the bug, not the writer: the TARGET file was always intact, and a stale temp is exactly what the explicit chmod defends. Scoped to the file under test: 20/20 |
| **guards** | `unit-atomic-write.test.js`, asserted at the BEHAVIOUR layer: §1 races a real reader against a real writer process on a 3MB file and requires zero torn reads — **with a non-vacuity arm that requires the OLD writer to actually be caught**, so a machine too fast to race fails loudly instead of passing hollow. §2 a failed write leaves the previous good file intact, and (its own section) cleans the temp on a failed RENAME. §3 the credential mode survives a STALE 0644 temp. §4 no bare `fs.writeFileSync` survives in either live-server file. §5 proves a pre-replace watch really is dead, which is WHY §5's source check on the re-arm matters. **Seven mutations red — after two came back GREEN and were fixed**: the chmod and the debris cleanup were both unreachable in the cases I first wrote |

## ✅ v89_ac — ONE QC engine, two modes, and a picker in front of every QC button

User ruling: *"can we merge or unify the two text QC functions, and at all places where texts can be
edited the QC icon should open a popover that allows the user to select between the light version (as
currently for PDF and comics) and the heavier (as currently for story-QC)?"* — **2 `ui.json` keys**
(`qc.mode.light`, `qc.mode.heavy`), **all four surfaces**.

What was here before: THREE functions across TWO contracts. `generateStoryQc`, `generateSummaryQc`
(a near-verbatim COPY of it — its own comment said *"same proofreading prompt (text-agnostic)"*), and
`normaliseExtractedText`. They are now one `qcProse(text, lang, {mode, kind, …})`.

| | |
|---|---|
| **⚠️ `mode` names a BEHAVIOUR, not a flag on one** | It selects a prompt AND a verifier AND a retry policy, together. **HEAVY** may change words — that is what fixing grammar IS — and is verified STATISTICALLY (`changedRatio`/`wordEditRatio`/corruption → clean\|corrected\|rewrite\|corrupt), one shot. **LIGHT** may not change a word and is verified STRUCTURALLY (exact word and line counts, bounded per-word edit distance), 3 attempts with feedback, and hands back the input rather than throwing. The merge had to preserve that split, not blur it |
| **⚠️ the parity test is a real DIFF, not "the tests still pass"** | `test/fixtures/qc-premerge.json` holds **9 outputs CAPTURED from the pre-merge functions** — all four heavy verdicts, the summary path, and light's first-try / retry-then-accept / give-up / empty-input. `unit-qc-unify-parity.test.js` replays each case's recorded reply sequence through the merged engine and deep-compares. **A first draft read the old source via `git show <tag>:server.js`** — works here, fails on any clone without the tag, so a guard would have gone red for a reason unrelated to the code. Capturing the OUTPUT is also the more literal reading of the standing rule |
| **shapes matched exactly, on purpose** | The light wrapper keeps two DISTINCT return shapes (a give-up carries no counts; a success carries no `failed`/`note`), because widening either — harmless for both consumers — would be the one difference the diff had to report, and a diff you explain away is worth less than an empty one |
| **kept mode-specific, deliberately** | `scriptPinNote` stays HEAVY-only: `v79_f` added it because a proofreader that silently transliterates rewrites a chapter that was already right, and that risk only exists where the model may rewrite. Light's own verifier would refuse a transliteration outright |
| **the picker** | `_qcPickMode(dflt)` fronts all four buttons (story, summary, comic panels, PDF chunks) and reuses `showChoiceDialog` — labelled options, Esc/backdrop cancel, resolves to a value — so the only new strings are the two labels. ⚠️ **The default is per surface and it is a safety property**: extracted text offers LIGHT first and primary, because heavy's licence to change words is, on a photographed sign, falsification rather than a fix. Cancelling starts no model call at all |
| **⚠️ a z-index bug found in a BROWSER, not by a test** | The comic review card sets its own `zIndex:400` (to clear the generation wizard), so the picker opened from inside it rendered at the `.modal-overlay` default of 300 — present in the DOM, fully interactive, and completely invisible behind the card that asked for it. `showChoiceDialog` now computes its z-index above every open overlay, which fixes the whole class for future callers |
| **⚠️ a second live finding: a flagged heavy result showed no warning** | Heavy on `"Der hund lief schnel durch den park."` returned `verdict:'rewrite', rejected:true` — a SHORT text trips the change ratio easily, which the `v86_h` comment already predicted, so this is the COMMON case for heavy on extracted text. The batch proposal carried no verdict, so the panel warned about nothing. It now escalates the worst row to the whole proposal, reusing `qc.rewrite_warn`/`qc.corrupt_warn` and inheriting `v86_h`'s ruling for free: `rewrite` still offers Accept, only `corrupt` withholds it |
| **live-verified** | Picker → light → real `translategemma:12b` → the diff panel, in a browser, end to end. And heavy through the batch route by curl: `"Der hund lief schnel durch den park."` → `"Der Hund lief schnell durch den Park."`, logged as `Extracted text QC (heavy)` with its verdict |
| **guards** | `unit-qc-unify-parity.test.js` (9 captured outputs + the heavy-throws-on-empty contract + §4 proving the modes are genuinely different behaviours) — **eleven mutations red**, one of which was found only after a first pass stayed green. `unit-text-qc-ui.test.js` §3d (picker: order, primary, labels, mode travels, cancel is a no-op) and §3e (flagged verdicts) — **twelve more red** |

## ✅ v89_ab — the text QC PROPOSES, through the panel story QC already used

User question — *"is this the same QC that we already had for story texts, available on the lesson-set
teacher view page with 'Proofread with QC model'?"* — then ruling: **yes, do the diff panel.**
**ZERO `ui.json` keys**: every string on the panel was already written and hand-translated.

⚠️ **The question was a finding.** `v89_aa` shipped a QC that applied straight away and leaned on
undo, while `runStoryQc` (`v55_g`) had shown a reviewable diff for thirty releases. The two are NOT
the same feature — see the table below — but the older one had the better interaction, and
`_renderQcProposalInto` was already factored for exactly this (`v55_n`, two callers). **The
comparison should have happened before `v89_aa` was designed, not after the user asked.**

| | `runStoryQc` (`v55_g`) | `/api/text-qc` (`v89_aa`) |
|---|---|---|
| runs on | a **saved** chapter's story | text that is **not a chapter yet** — draft comic panels, PDF chunks |
| may change words? | **yes** — that is what a grammar fix is | **no** — word count and line count pinned |
| verification | statistical: `changedRatio`/`wordEditRatio` + corruption heuristics → clean/corrected/rewrite/corrupt | structural: exact word and line counts, bounded per-word edit distance |
| why they differ | a generated story has no ground truth, so a grammar fix is pure gain | **extracted text is a TRANSCRIPTION of something real** — "fixing" a photographed sign's grammar falsifies what the learner is looking at |

| | |
|---|---|
| **the reuse, and how small it was** | `_renderQcProposalInto(prop, o)` gained exactly two things: `prop.pairs` (use caller-supplied rows instead of diffing one text pair into sentences) and `o.cleanKey`. Both existing callers are untouched. Checkboxes, indices, select-all/none, the inline diff and the accept/discard row are shared verbatim — which is the payoff `v55_n` was factored for |
| **one row per ITEM, not per sentence** | The text QC is a BATCH of N panels or chunks, and a batch's natural question is *"which of these texts do I accept?"*. `_qcInlineDiff` renders an item pair exactly as it renders a sentence pair, so a multi-line panel shows its changes inline like anything else |
| **`o.cleanKey`** | `qc.clean` reads *"…the story is already clean"*, which is wrong on a comic panel. The text QC passes `ex.writing.no_issues` instead — a string the app already had, rather than a translation spent on a nuance |
| **⚠️ the PDF backup moved to ACCEPT time** | Taking it before the run would arm the undo button for a proposal the user then discarded. `_aiCleanBackup` is now filled by the first `apply` call, and `done(n)` sets `_chunksDirty` / reveals undo only when something was really applied |
| **⚠️ a proposal dies with the card that owns it** | `comicOpenReview` rebuilds the overlay from scratch, so a surviving `_textQcProposal` would point at a panel node that no longer exists AND hold an `apply` closure over a replaced buffer. `_comicReviewClose` drops it — **but only its own**, so a PDF proposal on another screen survives |
| **live-verified** | Real `translategemma:12b` through the actual route on two shouted German panels: the panel rendered "Proofreader suggestions (2)" with per-item red/green diffs, both textareas still shouted. Unticking row 2 and accepting applied row 1 only, left row 2 shouted, closed the panel and cleared the proposal |
| **⚠️ a guard that overclaimed, corrected** | `v89_aa`'s "the textarea already on screen shows it" was reading an AUTO-VIVIFIED `getElementById` stub, not the rendered node — it proved the write happens (the mutation does turn it red), not that the on-screen box updates. Reworded to say exactly that; the real-DOM behaviour is verified in a browser instead |
| **guards** | `unit-text-qc-ui.test.js` §1/§2 re-scoped to propose-then-accept, plus **§3b partial acceptance** (tick one of two → only that one lands; tick none → `qc.none_selected` and the proposal stays open) and **§3c** the ownership rule. **Nine mutations red**, including "apply at propose time" (the whole `v89_aa` behaviour) and "ignore the ticks" |

## ✅ v89_aa — extracted text is un-shouted automatically, and a text QC can be run on demand

User report, two runs of the SAME comic: *"Some texts are correctly un-capitalized others not. We
generally want to un-capitalize and issue a correct normal capitalization for the extracted language.
Also, we want the possibility to run a pure text QC on that page, on a similar page after PDF
extraction that could catch cases where de-capitalization failed, or where we can generally detect
and fix typos."* User rulings: **2 `ui.json` keys** (`qc.btn.text`, `qc.toast.text_done`), **both
surfaces**.

⚠️ **AN INSTRUCTION IS NOT A MECHANISM, demonstrated as clearly as this project has ever managed.**
`_comicExtractPrompt` has asked for normal capitalization since `v85_k` — in detail, with a German
worked example `v85_l` proved necessary across three live rounds. The corpus holds
`ES GIBT EIN LAND, WO DIE KÖPFE ALLER MENSCHEN KNÖDELN GLEICHEN` — **the very sentence that worked
example spells out** — transcribed in full caps anyway. The prompt is KEPT (it works most of the
time and costs nothing); a mechanism now catches what survives it.

| | |
|---|---|
| **the detector, and why its floor is 4** | `shoutedRun(text)` = longest run of consecutive ALL-CAPS words; `needsCaseNormalise` fires at ≥ 4. **Measured over all 20 corpus panels carrying text**, not chosen: genuine failures scored 9, 11, 15, 19, 20, 20, 33; text that must be LEFT scored 3 (`REIZEN DOOR ZEELAND`, a brand lockup), 2 (`GRATIS / KOSTENLOS`, a real bilingual sign) and 1 (`ONTEIGENINGSZONE`, `PULITO`). A floor of 4 separates them with room either side. **Rewriting the second group would be the bug** — those signs really are set in capitals and the learner is reading a photograph of them. Same judgement `_ttsSpeakableText` makes leaving 3-letter runs alone (item AW). Unicode properties only, no per-language table (PLAN §4): Greek/Cyrillic ride the same rule; a caseless script scores 0 and is never sent anywhere |
| **the verifier, which is what makes it safe unattended** | `textNormaliseChanges(before, after)`. `cleanNarrativeText`'s contract is "deletion only"; this one's is **"surface only"** — same discipline, different invariant. Word count pinned, line count pinned (`v88_z` established that a line break is real content, a sign's own boundary), and a word whose surface key changed is allowed ONLY as a bounded repair (`_lev ≤ max(1, len/4)`). Three rejected attempts with pointed feedback, then the input is returned UNCHANGED rather than thrown — this runs inside the extraction job, where a throw would cost the panel its transcription |
| **⚠️ the ß bug, caught by a LIVE run and not by any test** | `_surfaceKey` folds **UP**, not down. German ß upper-cases to SS, so un-shouting `GROSSES` → `großes` is a CASE mapping and the right answer — but folded down it scored two edits, blew the repair budget, was rejected as a word substitution, and **the retry then returned a visibly worse, timid result that left the whole line shouted**. Folding up maps ß→SS, ﬁ→FI and every expanding case pair onto its own upper form |
| **⚠️ the model choice was measured, and the first measurement was WRONG** | Four real shouted German panels, one call each: **translategemma:12b 4/4** (101–144s), qwen3.6:35b-a3b 3/4 (~43s), qwen2.5:14b 3/4 (27–165s). Neither failure is a near miss — qwen3.6 returned one item **entirely in lower case** (`so wurde zur abschreckung an der grenze…`, which for German is just a different wrong), and qwen2.5 left `angst`/`riesen` lower-case, stably, 3 runs of 3. **An earlier draft used `OLLAMA_MODEL` on the strength of ONE item**, where qwen3.6 was correct and twice as fast; the fuller matrix reversed it. A single sample was the whole error. Lands on the QC role, whose default already IS translategemma:12b. ⚠️ Worth knowing: `v89_v` measured qwen2.5:14b as the BETTER model for the ambiguity QC — one role cannot serve both |
| **automatic vs on-demand — the gate is deliberately asymmetric** | The extraction job runs the pass ONLY when the detector fires, so a panel the vision model already got right costs nothing. `/api/text-qc` (a batch, a `runAsJob`, so a page is one cancellable unit) does **NOT** gate on the detector: half of what the user asked it to find — typos — leaves no all-caps trace at all, and gating it would ship a typo check that cannot see typos |
| **the two surfaces** | Comic review card: corrections land in `_comicReviewBuffer` (what confirm saves from) AND in the on-screen textarea, so Cancel is the undo and no extra control or string was needed. PDF chunk panel: reuses `aiCleanChunks`' own backup slot and undo button — both are "the last model pass over this chunk text", and one undo meaning that is clearer than two meaning half each. ⚠️ They send DIFFERENT languages: the card sends `APP.lang` (what `/api/comic-extract` itself sends), the PDF panel `APP.srcLang` (what `aiCleanChunks` beside it already assumes) |
| **live-verified, not just faked** | A fresh `PORT=3461` server (the user's own on 3000 untouched) against the real `translategemma:12b`, through the ACTUAL route: `NATÜRLICH KAM DANN NIE EIN RIESE / GIBT JA KEINE` → `Natürlich kam dann nie ein Riese.\n Gibt ja keine.`; the sign panel → `So wurde zur Abschreckung an der Grenze von der Regierung ein großes Schild aufgestellt.\n Riesen sind hier nicht willkommen.` — `großes` restored, `RIÉSEN`→`Riesen` and `SINd`→`sind` repaired, line structure kept. Then the same click driven in a real browser end to end |
| **guards** | `unit-text-normalise.test.js` (detector both sides of the floor incl. the four real corpus strings that must be left alone, caseless scripts, and the verifier's full accept/refuse table) — **nine mutations red**. `unit-text-qc-ui.test.js` (both surfaces, driven through the REAL `_jobAwait` with a stubbed `fetch`) — **ten mutations red** after three of the first eleven came back GREEN and were fixed: a cancel stub that withheld its payload, an assertion on `wordCount` that **the verifier makes invariant so it could never fail**, and a non-unique anchor. ⚠️ The cancel property is enforced by `_jobAwait`, not by `_textQcRun`'s own redundant check — confirmed by mutating `_jobAwait`'s branch instead and watching §3 go red; both the code and the test say so in place |

## ✅ v89_z — the comic review card has ONE text box, not two

User question, then user ruling: *"I still don't understand the multiple text fields in image
recognition… the text on a sign in the panel is recorded in an extra field. Why do we need that? Do
all texts end up in the story text? I think, we don't need to distinguish text in signs or banners.
Visually separated texts should just be separated by a newline."* → *"yes, do the UI merge."*
**ZERO `ui.json` keys** — the merged box reuses `form.image_caption_ph`; `form.image_scene_ph` is
left in the file untouched (it is hand-translated into five languages and costs nothing to keep).

⚠️ **This REVERSES the `v88_ab` ruling** ("KEEP the split as-is"). That earlier ruling was made when
the question was whether the DESCRIPTION should be combined; the caption/in-scene split was never the
thing being examined and got waved through. This time the question was asked directly, and the
answer measured before answering it.

| | |
|---|---|
| **the measurement that decided it** | The user's question — *"do all texts end up in the story text?"* — is answerable from the code, and the answer is **yes, always, identically**. `_comicTextFromFields` is `[src.caption, src.inScene].filter(Boolean).join('\n')`; `_comicStoryPanelsHtml` and the server's own assembly re-join the same way; and a story EDIT already collapses them (`caption = corrected`, `delete inScene`). **No consumer has ever distinguished the two fields.** So the split was purely an artifact of the extraction contract leaking into the UI — two boxes for one string, where an edit to the wrong one still landed in the same place |
| **what changed** | `_comicReviewText(buf)` (new) renders `caption` + `inScene` joined by ONE newline into a single `rows="6"` textarea; `_comicReviewEdit(k,'text',v)` (new branch) writes the whole value to `caption` and **CLEARS `inScene`** |
| **⚠️ why the clear is not optional** | Without it a hidden `inScene` survives the edit and is re-appended downstream by `_comicTextFromFields` — the learner deletes a line, saves, and watches it come back. The mutation that only drops the clear is the one this is guarded against most directly |
| **what did NOT change** | The extraction prompt's `CAPTION:`/`IN-SCENE:` contract, `_parseComicExtraction`, the stored field shape, and every consumer. The split still earns its keep at the model boundary — it gives the vision model two named slots to fill, which is a better prompt than one — it just no longer surfaces as two boxes. The DESCRIPTION box is untouched and still joins with a BLANK line (`v88_ab`) |
| **guards** | `unit-comic-review-card.test.js` §v89_z: both extracted parts visible in exactly one box (`_comicReviewEdit(0,'text'` appears once, `'inScene'` never), the join is a single newline with no stray newline when either side is empty, an edit clears `inScene`, `title`/`description` still route to themselves (non-vacuity), and a **round-trip check** — what the box shows `===` what `_comicPanelText` derives, which is the property the whole change rests on. `unit-comic-title-field.test.js` re-scoped to the merged field. **Five mutations red**: leave `inScene` alive after an edit; drop the merged routing; show only the caption; leave the stray newline; bind the box to `buf.caption` |

## ✅ v89_y — a failed chapter-title post-pass is finally visible

User ruling on the item `v89_t` left open: **make the failure visible.** **1 `ui.json` key, granted.**

`v89_t` fixed the *cause* of the user's `0/1 titles came back named` — the parser could not read an
array of bare strings. What it deliberately left open was the **silence**: when the post-pass
genuinely fails, the chapter keeps the placeholder it was created with, which for an uploaded chunk
is the raw first 40 characters of the source text. The only way to learn your chapter is called
*"Flexvervoer Welkom op de hub Domburg, St"* was to read a terminal — which is exactly how the user
found it.

### ⚠️ A MARK, not a replacement title

The ruling was to surface the failure, not to paper over it. The alternative — deriving a nicer
fallback name — was offered and **not** chosen, and the reason is worth keeping:

> An invented title reads as **deliberate**, which makes a bad one **harder** to notice than an
> obviously-raw one.

So the raw placeholder stays exactly as it is, and gains a ⚠️ badge beside it whose tooltip says what
happened and what to do: *"Title could not be generated — rename it yourself."* The badge is the
pencil's invitation; the machinery it points at already exists.

| what | where |
|---|---|
| set | `_titleStorylinePostPass`'s catch — the one place the post-pass gives up |
| ⚠️ never on a user-named chapter | `topicAuto === false` is skipped: its title is exactly what was wanted, so there is no failure to report. Same flag item `AN` uses to protect a hand-written title |
| ⚠️ written to the LIVE store | `findSavedById(tp.id)` before writing — the post-pass is minutes long, and `v73_j` records precisely what happens to writes through references captured before an await |
| cleared by any applied title | inside `_applyChapterTitles`, so **every** path that titles a chapter clears it — including the manual storyline retitle, which shares that function |
| cleared by a manual rename | `/api/lessons/save-meta`, ⚠️ **before** its no-op short-circuit: a learner who looks at the flagged title and decides it is fine has dealt with it, and re-confirming the name must dismiss the mark |
| the badge | `_titleFailedBadge(s)`, rendered beside the title in `savedItemHtml` |

**A mark that cannot be dismissed is worse than no mark** — it becomes furniture and stops being
read. That is why three separate paths clear it.

### ⚠️ It rides in the savedList WHITELIST, or it is dead in live mode

`/api/lessons/list` is a whitelist projection, and its own comments already record this trap **twice**
(`v74_i`, `v79_n`): a field left out works perfectly in the STATIC build — which ships whole topics
and gets it for free — and silently does nothing LIVE. `_titleFailed` is in the projection, omitted
when falsy so an ordinary chapter's payload is unchanged. Its own mutation is red.

### Guards

`unit-title-failed-marker.test.js` (new, 5 sections). **Nine mutations red — after a fix.**

⚠️ The "never persist the mark" mutation stayed GREEN: the assertion was `/saveStore\(store\)/`, and
that text is still present inside `if (false) { saveStore(store); … }`. **The containment trap this
repo has written down three times, met a fourth.** Now asserted on the guarded form,
`if (_marked) { saveStore(store)`, and the mutation is red.

## ✅ v89_x — the app stopped answering its own questions; the mic stopped apologising

Two user-reported speech-input bugs. **ZERO `ui.json` keys.**

### ⚠️ 1. The app was answering its own questions

User: *"for listen-type question the automatic read-out IS the correct answer, and if speech input is
active, it seems the app answers the question itself via the readout of the correct answer being
recognized by the speech input."*

**Exactly right, and the ordering in `renderEx` says why.** It calls `_speechMicRefresh()` — which
opens the recognition session immediately — and only THEN queues the readout, 350ms later. So the mic
was already listening when the app spoke `ex.target`. For `listen_type` that string **is the answer**,
so recognition heard it, matched it, and filled it in. The learner watched the question answer itself.

`_speechStartWhenQuiet(gen, cfg, ex)` now holds the session shut until the engine falls quiet.

**Polled, not chained to a TTS callback** — deliberately. The readout is started by `renderEx` on its
own timer and can be re-queued by the unlock path (`_ttsPendingAfterUnlock`); a poll observes the
ENGINE, whoever started it, and cannot be bypassed by a path that does not know to call back.

Same three-way shape `_speakAndAdvance`'s watchdog already settled on, for the same reasons:

| case | outcome |
|---|---|
| speech observed, then stopped | open the mic — the ordinary case |
| never started within `_MIC_WAIT_START_MS` | open anyway — muted, no voice, TTS not unlocked |
| `_MIC_WAIT_CAP_MS` reached | open regardless — a wedged engine must never silence input for the rest of the question |

⚠️ `pending` counts as talking: a queued utterance has not been spoken yet, and treating it as silence
would reopen the whole bug for the common case where the readout is one tick away.

**One shared predicate.** `_exAutoSpeaks(ex)` is used by `renderEx` to DO the readout and by the mic
to WAIT for it. Two copies would drift, and the drift would be **silent** — the mic would quietly go
back to opening during the readout with nothing on screen to show for it. A question that reads
nothing out still opens the mic **synchronously**, so the majority of questions pay no delay.

### 2. The "didn't catch that" toast is gone

User: *"the 'i couldn't catch that' pill appears too often; we can remove the pill, since its obvious
that a correct answer wasn't recognized."*

All four `showToast(t('ex.mic_no_match'))` sites removed. In continuous listening they fired on every
non-matching phrase — i.e. **on ordinary background noise**.

**The informative half stays**, and is asserted so a later cleanup does not take it too: the
`#mic-heard-pill` still shows WHAT was heard, in red, self-clearing. That is not an apology — it
names the word that was misheard, which is the thing a learner can act on. And a typed answer still
receives the heard text, visible and editable rather than merely announced.

⚠️ **`ex.mic_no_match` is deliberately LEFT in `ui.json`.** The user hand-translated it into five
languages; deleting the key would throw that away for cosmetic tidiness, and restoring the toast
later would cost it again.

### Guards, and three of my own assertions that were vacuous

`unit-speech-readout-race.test.js` (new, 7 sections). **Eleven mutations red — after three fixes, all
found BY the mutations rather than by review:**

1. ⚠️ **Reverting `_speechMicRefresh` to open the mic directly — restoring the reported bug in full —
   left every section GREEN.** Each drove `_speechStartWhenQuiet` *directly*, so none of them touched
   the one call site that makes the behaviour reachable. A wiring assertion was added.
2. The heard-pill assertion pinned one of **three** call sites, so removing the typed-answer one
   stayed green. Now counted: all three, or fail.
3. The abandon-on-question-change section waited **500ms against a 1500ms grace**, so deleting the
   guard outright left it green — the unguarded version had not reached its own start point either.
   The window now outlasts the grace.

## ✅ v89_w — the model picker reaches all eight roles; item B closed by measurement

User: *"Model-picker rows: yes, please add these."* **3 `ui.json` keys, granted explicitly.**

The picker offered five of the server's eight roles. `vision`, `analysis` and `answerCheck` were
settable by env and by `POST /api/models` but had **no row**, so nobody could point them anywhere
from inside the app. `switchModel(role, model)` was already fully generic, so two of the three rows
cost nothing but a label.

⚠️ **One row, two features**: `answerCheck` drives BOTH the answer-time re-check (`v89_j`) and the
ambiguous-options QC pass (`v89_v`), because both call `callLLMAnswerCheck`. That is also why its
default was worth measuring twice.

### ⚠️ Item B's open design question, settled by measurement rather than taste

Item B named the fork explicitly: *"Ollama's `/api/show` capabilities field vs. a family-name
allowlist."* Measured on this box:

| model | `capabilities` |
|---|---|
| `qwen2.5vl:7b` | `["completion","vision"]` |
| `translategemma:12b` | `["completion","vision"]` — gemma3 is multimodal |
| `qwen3.6:35b-a3b` | reports vision |
| `qwen2.5:14b` | `["completion","tools"]` |

**A family-name allowlist would have kept only `qwen2.5vl` and dropped six working vision models.**
The capabilities field it is. `modelCapabilities(model)` (llm.js) probes `/api/show`, cached per
process — the installed set changes when a human runs `ollama pull`, which is not worth N round trips
per picker open. `capabilitiesReset()` exists so a test or a future rescan control can clear it.

`GET /api/models` now returns `visionCapable`. Verified against a live instance: **9 models, 7
vision-capable**, with the two pure-text `qwen2.5` builds correctly excluded, and all eight roles
present in `active`.

⚠️ **A model whose capabilities cannot be read is cached as UNKNOWN, not as capable.** Guessing
capable would put a text model in the vision picker, which is the exact failure the filter exists to
prevent.

### Two ways a filter can strand a user, both closed

- **An empty probe result falls back to the full list**, never an empty `<select>` — an empty picker
  reads as broken and would leave a user unable to change a setting that was working.
- **The active value is always present in its own row**, even when the filter would drop it. Without
  that, a role already pointed at something unlisted would silently *display* another model's name
  while being set to a different one — worse than showing nothing.

### Guards

`unit-model-picker-roles.test.js` (new, 4 sections). ⚠️ §1 derives the expected rows **from the
server's own role declarations**, not from a list repeated in the test — the same reasoning as
`unit-model-roles` (`v89_r`): a guard that must be edited when a role is added is one that gets
forgotten. §2 pins that the filter reads capabilities and **explicitly not** a family-name allowlist,
with the measurement in its comment.

**Eight mutations, all red**, including filtering by name instead of capability, dropping the probe,
rendering an empty select, and letting a filtered row hide the active value.

## ✅ v89_v — an explicit QC run catches "the wrong answer is also correct"

User ruling after `v89_u`'s negative result: *"implement that an explicit QC run catches it, but
don't do on default. it is a very rare case."* **ZERO `ui.json` keys.**

### Why it is a LESSON-level check, unlike every other checker in `_runQc`

The ambiguity is a property of a **pair**, and **there is no option set to inspect**: `wS`/`wV`
(index.html) resample the distractors from the sibling items on *every round*, so what a learner saw
is not stored anywhere and is not reproducible. What IS stable is the **pool** — if two items have
interchangeable `{S}` answers, the question is ambiguous whenever those two land together. So the
pool is what gets judged.

**ONE model call per lesson**, not per pair: a 13-item lesson has 156 ordered pairs, and asking about
each would cost more than generating the lesson did.

### ⚠️ The role was MEASURED, and the obvious choice was the wrong one

It is a QC check, so `callLLMQC` looked right. It is not:

| model | the user's own lesson | a clean control |
|---|---|---|
| `translategemma:12b` (QC-role default) | **`[]` twice — catches nothing** | `[]` |
| `qwen2.5:14b` (answer-check default) | **the pair, twice**, with a correct German reason | **`[]` twice** |

So it uses **`callLLMAnswerCheck`**. That is the same role `v89_l` benchmarked for precisely this
judgement ("is this other answer also valid?"), and the same finding writing-feedback recorded from
the other direction — the QC-role model ignores a requested output format. The test pins the role
**with the measurement in its comment**, so a future "it's a QC check, use the QC model" tidy-up has
to argue with evidence.

### ⚠️ Its own flag bucket, and that is load-bearing

`_check` **clears** whatever flag exists for the model it is writing under. Running this pass with
the plain QC model key would therefore have **silently wiped every translation flag that model had
raised**. It writes under `QC_AMBIGUOUS_BY` instead — the same synthetic-key pattern
`QC_DIACRITIC_BY` already established — so both findings coexist on one item and each clears only
its own.

Reusing `_check` (with an instant runner resolving from the single call) rather than writing flags by
hand also inherits its mid-pass re-resolution and its per-model bookkeeping — the parts `v73_j` and
`v88_z` took two releases to get right.

### How it is reached, and why it costs no key

Tied to the **shift-click** QC gesture — already this screen's "do the thorough, deliberate run"
action. A dedicated button or settings row would cost a `ui.json` key, which the user translates by
hand. An explicit `scope.checkAmbiguous` still overrides, so a dedicated control can be added later
without touching that line. **Default is off in three places** — the client's default, the route's,
and `_runQc`'s own parameter — each with its own red mutation.

### It refuses to invent

An index the model made up is **dropped, not clamped**. Clamping would attach a real-sounding finding
to an item nobody judged — the same harm as a false positive but harder to spot, because the note
reads plausibly. A good pair beside a bad one still survives; over-correcting to `[]` would throw
away a real finding.

⚠️ **Silence is the expected answer** and every unusable reply produces it: prose, an empty response,
an object instead of an array, garbage. The asymmetry is deliberate and is what makes this safe to
offer at all — **a missed pair costs a rare confusing question; a false one sends a curator to break
a lesson that was correct.** A lesson with fewer than two items never reaches the model.

### ⚠️ A THIRD guard broke on an added field — the same brittle-anchor class as `v89_p`

`unit-qc-skip` pinned **the entire `/api/qc` destructure and the entire options literal**, character
for character, plus the client's body literal. Adding `checkAmbiguous` beside `force` broke three
assertions whose CLAIM — *"force is read, force is passed, force is sent"* — remained perfectly true.

Re-anchored on the claim: `force` **appears in** the destructure, **appears in** the `_runQc` options,
**appears in** the request body. A field added beside it is not a regression. Verified both ways —
removing `force` from either side still turns them red.

> **Twice in one line now** (`v89_p`, `v89_v`): a guard anchored on an exact enumeration fails on
> every legitimate ADDITION to that enumeration, and the failure reads as a regression in something
> unrelated. Anchor on the member you care about, not on the whole list.

### Guards

`unit-qc-ambiguous-options.test.js` (new, 4 sections) drives the real checker with a stubbed call.
**Eight mutations, all red**, including defaulting it ON, running it regardless of the flag, writing
under the plain QC key, and using the QC role.


### ⚠️ POSTSCRIPT, written at `v89_w`: this release also DELETED 956 LINES OF THIS FILE

The open-item edit above used a line-index splice whose END was an unbounded scan —
`next(k for k in range(i, len) if 'wants' in lines[k] and 'ruling' in lines[k])`. It matched far
below its paragraph and took **the GPU-estimate section, the multi-user prioritisation section, the
whole §0 progress-card rework, §0i, and three carried-forward sections** with it. Two of those were
documents the user had asked for in this same session.

⚠️ **It was committed**, past a full green suite — nothing in the suite reads roadmap prose, and
`unit-roadmap-version` only checks the numbers it pins. Found at `v89_w` while looking for item B
and noticing its section was gone. Restored from `v89_u` with every later edit re-applied.

This is `v89_o`'s mistake repeated **with the rule already written**, which is why rule 1 was
rewritten: the safeguard is asserting the SPAN SIZE, not using line indices, and
`git diff --numstat` before a commit would have shown `+128 / -956` in one line.
## ✅ v89_u — strategy 1 measured: the prompt does NOT fix the "wrong answer is also correct" defect

User: *"now do the wrong-answer generation prompt."* **ZERO `ui.json` keys.**
**Two findings, and the second one is a negative result that is worth more than the change itself.**

### ⚠️ Finding 1: the roadmap's framing aimed at a lever that does not exist

Strategy 1 was written as *"harden the generation prompt so **distractors** must be wrong for THIS
item."* **The model never chooses those distractors.** For the four meaning-based MCQ types they are
picked **client-side**, at build time:

```js
function wS(c,p,n){ return shuffle(p.filter(s => s.source !== c.source)).slice(0,n).map(s => s.source); }
```

Sibling items' glosses, sampled at random, filtered only by **exact string inequality**. Same shape
in `wV` for the vocab MCQs. No prompt anywhere controls them — so hardening a "distractor"
instruction would have been pure theatre, and would have looked like a fix.

**What the model DOES control is which items share a lesson.** That is the only place a prompt can
touch this defect, so that is where the rule went: `PROMPTS.vocab` and `PROMPTS.vocabFromText` now
say no two items in one lesson may be interchangeable, **and explain the mechanism** — that the app
builds each question by taking one item as the answer and the others as wrong options, so two
interchangeable entries produce a question with two right answers. (This repo has its own evidence
that a model told WHY follows more reliably: the synonyms prompt's own "marked WRONG" clause.)

### ⚠️ Finding 2: it was measured, and it changed nothing

Same protocol as `v89_c`: the real prompt, the live model, the **exact sign text that produced the
user's bug** (`GRATIS / KOSTELOOS / …gratis en kosteloos…`), three runs each.

| | runs with two interchangeable glosses |
|---|---|
| **OLD prompt** | **3 of 3** — `GEBÜHRENFREI`+`KOSTENLOS`; `gratis`+`kostenlos`; `gratis`+`kostenlos` |
| **NEW prompt** | **3 of 3** — `kostenlos`+`gratis`; `gratis`+`kostenlos`; `gratis`+`kostenlos` |

**No improvement whatsoever.** Worse than `v89_c`'s precedent, where hardening at least moved 0/3
to 1/3.

**The reason is structural, not a wording problem.** The source text *says* "gratis en kosteloos" —
both words are in the sign. So "teach the vocabulary of this text" and "do not include two
interchangeable items" are in **direct conflict**, and the text wins every time. No phrasing resolves
that, because the model is being faithful to its actual instruction.

⚠️ One run (NEW 1) arguably came out *worse*: it swapped the glosses to `gratis`→`kostenlos` and
`kosteloos`→`gratis`, cross-linking the pair. n=1, so noise — but not evidence of improvement either.

### The rule is KEPT, and must not be believed

Kept because it is free, it is correct advice, and it may help the many texts that do **not** force a
synonym pair — none of which this measurement can speak to. **Not** kept as a fix: the entry above
and the guard's own comment both say the measurement showed no effect on the reported case.

> **The only thing measured to handle this defect is `v89_j`'s answer-time re-check** — which, in the
> user's own session log, returned `"umsonst" vs "kostenlos" -> also_acceptable`. It is opt-in and
> off by default.

### The recommended next step, now that the lever is understood

A **generation-time QC pass over the built options** — for each MCQ, ask a model whether any
distractor is also a valid answer, and if so resample or drop the item. That is strategy 2a from the
original note, and it is now the only remaining candidate that could work, because it operates where
the distractors are actually chosen. ⚠️ Both halves already exist: `PROMPTS.answerCheck` +
`parseAnswerCheck` (`v89_j`) are exactly the judgement needed, and `callLLMQC`/`qcCheckPair` are the
generation-time shape. The cost is one model call per option set, which is why it wants its own
ruling rather than being assumed.

### Guards

`unit-prompt-strictness.test.js` gains a vocab section: the rule is present in **both** prompts, and
so are its **mechanism** and its **consequence** — a bare instruction stripped of its reason reads as
style, which is the difference this repo has measured before. Five mutations red, including
weakening it in `vocabFromText` only.

⚠️ The guard's own comment states plainly that prompt text is not behaviour and points at this
entry's measurement, so no future session reads a green test as evidence the defect is handled.


## ✅ v89_t — the chapter-title parser reads an array of bare strings

The third and last defect visible in the user's `v89_o` server log. **ZERO `ui.json` keys.**

```
Attempt 1/3: 0/1 titles came back named
Attempt 2/3: 0/1 titles came back named
Attempt 3/3: 0/1 titles came back named
Chapter-title post-pass failed: no usable titles after 3 attempts
```

…and the chapter kept its raw 40-character placeholder, *"Flexvervoer Welkom op de hub Domburg, St"*.

### ⚠️ The log's own wording identified the cause, with no guessing

This function fails in **two distinguishable ways**, and it says which:

| log line | meaning |
|---|---|
| `Attempt N failed: <reason>` | the reply could not be parsed at all |
| `0/N titles came back named` | the reply parsed **into the wrong shape** |

The user's log shows the second, three times. So the model's answer was **well-formed JSON that the
normaliser then read nothing out of** — which narrows the candidates to a handful, all testable
offline. Driving the real parser with each: an array of bare **strings**, `["Hub Domburg"]`, parses
at the first rung and then has `.title` read off a `String`, giving `''` for every chapter. **Exactly
the observed symptom**, and the only candidate that produces the second wording rather than the first.

> Same class as `v77_x`'s pair-array finding, and the same lesson its comment already states:
> **a parse that succeeds into the WRONG SHAPE is worse than one that fails**, because the retry
> loop sees a well-formed answer and nothing reports it. `v77_x` added the pair rung; this adds the
> string rung.

### Two rungs

- **An array of bare strings** — normalised to `{title, emoji:'📖'}`. Works alone, multi-chapter, and
  **mixed with objects in one reply**, which is what a real model actually produces.
- **A bare object**, `{"title":…}` — the most natural answer when exactly one title was asked for.
  ⚠️ **Accepted only when `n === 1`**, where it is unambiguous. For `n > 1` a single object genuinely
  IS a wrong-shaped answer and must still fail, or the retry loop is denied the chance to get a real
  one. Its own mutation covers that.

### Guards

`unit-chapter-title-shapes.test.js` (new, 4 sections) drives the **real** `_generateChapterMetaOnce`
with only its one model call stubbed, so every parsing rung is exercised as it ships:

1. the reported failure — bare strings, alone, multi-chapter, and mixed with objects;
2. the bare object accepted at `n === 1` and **still refused at `n === 2`**;
3. every shape that already worked (objects, `v77_x` pairs, fenced JSON, prose-wrapped, loose
   one-per-line objects) — non-vacuity plus a regression guard on two earlier findings;
4. ⚠️ **genuinely unusable replies must STILL fail.** A parser that never fails would turn every bad
   answer into a silent empty title — the defect of §1, reintroduced from the other side.

**Five mutations, all red**, including "accept a bare object for any `n`" and "invent a title when
the model gave none".

### ⚠️⚠️ The suite had NEVER exercised the success path — and one test depended on the bug

`e2e-book-duplicate-titles` went red on this fix, and the reason is the finding:

**`fake-ollama` answers the chapter-titles prompt with `["Chapter One", "Chapter Two", "Chapter
Three"]` — an array of bare strings.** The exact broken shape. So for as long as that fixture has
existed, **every book e2e in the suite has exercised the post-pass's FAILURE path and never its
success path.** That is why nothing caught this before a user did.

And `e2e-book-duplicate-titles` located its two chapters by their shared title (`/A13/`), which only
worked *because* the titles were never replaced. **It was passing for the wrong reason, and the
reason was this bug.**

Re-scoped rather than patched: the chapters are now found by their own STORY text — unique, supplied
by the test, untouched by any titling — which is what *"neither overwrote the other"* was always
about. And a new assertion pins that the post-pass **actually ran**, so the re-scoping cannot quietly
restore the old accidental dependency. ⚠️ **That assertion is now the end-to-end proof of this fix**:
removing the bare-string rung turns the e2e red, verified.

The fake is deliberately left as it is. It emits the shape a real model gave the user, and now it
exercises the string rung through the whole stack.

### ⚠️ Still not fixed, deliberately: the failure is silent in the app

When the post-pass genuinely fails, it `console.warn`s and the chapter keeps its raw placeholder
title. The user found this by reading a terminal, not by using the app. Making it visible — or
falling back to something better than the first 40 characters of the source text — is a **behaviour
change that needs a ruling**, not a bug fix. Recorded in the open list.


## ✅ v89_s — the continue-from send paths read the RECORD, not the view

User: *"now fix the continuedFrom send path."* **ZERO `ui.json` keys.**

### The view/record split

`#continue-select` is a **view**. ⚠️ **Measured in a real browser rather than assumed: a `<select>`
clears its `value` on ANY `innerHTML` rebuild — even when the matching option survives it.** So
`repopulateContinueSelect()` depends entirely on its own restore line:

```js
const _want = _pin || prev;
if (_want && [...contSel.options].some(o => o.value === _want)) contSel.value = _want;
```

…which fails whenever the wanted chapter is **not among the freshly built options** — and the
pin-survival branch that would re-offer it looks the chapter up in `APP.savedList`. So a rebuild
while that list is **empty or stale** leaves the picker blank, with the learner never having touched
it. Every send path then read that blank and sent `null`.

That is what `v89_o` saw in the user's log: **`continuedFrom=-`**, on a comic chapter meant to extend
a nine-chapter storyline.

### `APP.contPin` was already the record — nothing needed inventing

It has every property this needs, and had all along:

| property | why it matters here |
|---|---|
| set by the picker's own `onchange` | it captures the learner's *explicit* act, not a derived state |
| persisted to `localStorage`, restored at APP init | survives a reload |
| **CLEARED when the learner picks "— new story —"** | ⚠️ the fallback **cannot resurrect a cancelled choice** — the property that makes this safe rather than merely sticky |

`_continueFromRef()` is now the one resolver: the shown value if there is one, else the pin, else
null. **All eight send sites use it** — the two `doGenerate` bodies, `pdfGenerateAll`'s two,
`comicCreateChapter`, `/api/comic-extract`'s context call, and the continue-language helper.

⚠️ **A pin whose chapter no longer exists is dropped, not sent.** A dangling ref resolves server-side
to no parent and produces the same orphan this fix exists to prevent, only harder to see. Checked
against `APP.savedList`, the same projection the picker is built from.

⚠️ The fallback **logs when it fires** (`console.warn`). If the picker is ever reset under a learner
again, there is now a record of it — which is exactly what `v89_o` had none of.

### ⚠️ The harness cannot reproduce the reset, and the test says so

The DOM stub keeps `select.value` as a plain property that `innerHTML` never touches, and exposes no
`options` collection at all. **A test that drove the real rebuild and expected the browser's reset
would pass on the stub without reproducing anything** — which is what the first draft of §5 did, and
why it was rewritten. The reset is now applied *explicitly*, labelled as standing in for browser
behaviour the stub lacks, with the browser measurement cited. Recorded in INTERNALS §5, along with
the one-line `options` getter that shims the rest.

⚠️ **My first hypothesis was wrong and is worth recording**: I assumed a *language change* lost the
selection. It does not — the pin-survival branch carries it through precisely that case. Only a
rebuild against an empty/stale `savedList` defeats it.

### Guards

`unit-continue-from.test.js` (new, 6 sections): the shown value wins; an empty picker falls back;
a cancelled choice stays cancelled; a deleted chapter is dropped; the loss sequence with the fix
holding through it; and — structurally — **no line that sends `continuedFrom` may read
`#continue-select` directly**. That last one matters because the defect was *eight call sites each
doing the same wrong thing independently*: fixing seven of eight would look identical from any
single behavioural test.

Four mutations, all red: removing the fallback, sending a deleted pin, ignoring the visible
selection, and putting `comicCreateChapter` back on the raw select.


## ✅ v89_r — every model role is now released, and the list guards itself

User: *"now fix the tutor and analysis models in configuredModels."* **ZERO `ui.json` keys.**

`OLLAMA_TUTOR_MODEL` and `OLLAMA_ANALYSIS_MODEL` join `configuredModels()` — the list the idle
release (`v88_l`) and the shutdown sweep free. **A role missing from it is a model this server can
LOAD and never FREE**, which defeats the whole point of the idle release on a machine where RAM is
the constraint, and it fails silently: nothing throws, the model just sits there.

Both had been missing since they were introduced.

### ⚠️ The real fix is that the list now guards ITSELF

Three of eight roles were missing. `answerCheck` was caught at `v89_l` only because its default
names a model no other role does; `tutor` and `analysis` were found by an audit, not by a test.

> **A guard that has to be edited when a role is added is a guard that will be forgotten exactly
> when it matters.**

So `unit-model-roles.test.js` (new) **enumerates the roles from the source** — every
`let OLLAMA_*_MODEL` declaration — and requires each to appear in **both** lists a role must join:

| list | what a miss costs |
|---|---|
| `configuredModels()` | the model is loaded and never freed |
| `/api/models`'s `requested` array | the role is accepted **without being validated** against the installed models — and if it is missing from `setRuntimeModels` too, silently ignored (`v89_l` found this the hard way) |

**Adding a role and forgetting either now fails the suite.** The extraction asserts its own
non-vacuity (≥ 8 roles found, and both ends of the list present by name), so a change to the
declaration shape fails loudly rather than quietly matching nothing.

`unit-answer-check` §7's per-role membership check is kept — this file's subject is the answer-check
specifically, and a failure there names it directly — with a note that it is now the weaker half.

### Mutations

Five, all red: dropping `tutor`, dropping `analysis`, dropping the story model, dropping `analysis`
from the `/api/models` validation, and — the one that matters most — **adding a plausible new role
(`OLLAMA_GRADER_MODEL`) and wiring it nowhere**. The guard enumerates nine and fails.

⚠️ One mutation was rejected as ARTIFICIAL rather than counted: renaming a declaration to
`OLLAMA_TUTOR_MODEL2` left the guard green, but only because `[A-Z_]*MODEL\b` cannot match a name
ending in a digit — and no real role is named that way. **A mutation that stays green because it is
not a thing anyone would write is not evidence of a weak guard**; the realistic version was written
instead, and it is red.


## ✅ v89_q — the static build now loads its own baked scripts table

User: *"now fix the loadScripts gap in the static build."* **ZERO `ui.json` keys.**

### One missing call, and a whole feature unreachable

`build-static.js` bakes `scripts.json` into `docs/index.html` as `window.SCRIPTS_DATA`, and
`loadScripts()` exists precisely to pick it up — its first line short-circuits on exactly that. **The
static `init()` never called it.** So the module-level `SCRIPTS_DATA` stayed `{}` in every published
build, and:

- `scriptsForLang()` returned `[]` for every language,
- `scriptsUsedInLessonSet()` therefore offered nothing,
- **the LLM-free ALPHABET COURSE could not be reached in a published build at all** — despite needing
  no backend and despite the data being shipped in the file.

Exactly the shape `v86_h` found for `_storyTapInit`: a pure client-side feature, present and correct,
with the one wire-up missing. One line, beside `loadLanguages()` — its sibling, and the function
`loadScripts`'s own comment already calls itself a mirror of.

### ⚠️ Guarded BEHAVIOURALLY, because a source check could not have seen this

`unit-static-scripts-data.test.js` (new) loads the **built** `docs/index.html` under the DOM harness
and asserts what a published page actually does:

| § | claim |
|---|---|
| 1 | the baked table has data, the loader is present, and **the module-level table is EMPTY until the loader runs** — the state every published build shipped in |
| 2 | ⚠️ the user-visible consequence: `scriptsUsedInLessonSet()` on a `ja→en` set returns **`[]`** on an empty table and the real scripts once loaded |
| 3 | the built `init()` awaits the call, after `loadLanguages()` |

**§1 and §2 are the point.** The bug was invisible to every source-level check in the suite because
**both halves were individually correct** — the data was baked, the loader was written. Only the
composition was broken, and only a behavioural probe of the built artifact can see a composition.

`unit-static-story-tap-parity.test.js` gains the wire-up assertion as its **third**, so "what the
static init must call" stays answerable in one place.

### ⚠️ Two standing traps, both hit, both already documented

1. **A backtick in a comment inside a template literal.** The static `init()` lives inside one in
   `build-static.js`, and the first version of the explanatory comment used backticks around
   `window.SCRIPTS_DATA` / `loadScripts()`. It **terminated the literal and broke the build outright**
   (`SyntaxError: Unexpected identifier 'window'`). INTERNALS' harness-traps note says exactly this.
   The comment now carries a line saying why it has no backticks.
2. **A comment that spells the pattern being scanned.** §3's mutation check stayed GREEN with the
   call deleted, because the bare-name regex `/loadScripts\(\)/` matched the new COMMENT. Now matched
   on the delimited **`await loadScripts();`**. That is this repo's rule-1 ("assert on the delimited
   value") and its comment-near-a-scanned-pattern rule, both in one miss — **found by the mutation,
   not by review.**

### Mutation

Removing `await loadScripts();` from `build-static.js` and rebuilding turns the new file red.


## ✅ v89_p — a one-chapter book now honours every ticked lesson type

User ruling on `v89_o`'s question: *"the ticks mean lesson types per chapter — fix the server."*
**ZERO `ui.json` keys.**

### The fix

`_runBookJob`'s arc block was gated on **`i >= 1`**, so on a one-chapter book — **every photographed
comic panel and every one-chunk PDF** — it never ran and every ticked type was discarded, *after the
route had logged them back as if honoured*. The gate is gone.

```js
- if (!base.skipLessons && base.arc && i >= 1 && Array.isArray(data.lessons)) {
+ if (!base.skipLessons && base.arc && Array.isArray(data.lessons)) {
```

### Two types are FILTERED instead, and each skip is LOGGED

⚠️ **The logging is not decoration.** `v89_o`'s own finding was that a route which echoes a parameter
back while quietly dropping it is what makes this class of bug invisible for months. So each skip
now prints its reason.

- **`'standard'`** — `generate()` above **already** produced this chapter's standard lesson
  (`lessonFormat` is forced to `'standard'` whenever `base.arc` is set), so generating it again in
  the loop is a straight duplicate. ⚠️ **That duplicate is PRE-EXISTING for chapters 2+**, not
  introduced here. It is removed for **every** chapter rather than left inconsistent — opening the
  gate for chapter 1 would otherwise have added a second copy there too.
  *(Context, not attribution: 80 of 344 corpus chapters carry more than one `standard` lesson.
  Several routes can produce that, so the number does not prove this path caused them.)*
- **`'review'` when there is no parent** — it drills the vocab of PRIOR chapters
  (`vocabMode:'reinforce'` over `chainVocab`); on a first chapter that list is empty, so it would
  review nothing. **This is the one part of the old `i >= 1` reading that survives the ruling**, and
  it survives narrowly: for this type only.

### ⚠️ The guard that pinned the old ruling was RE-SCOPED, not deleted

`e2e-book-arc-types.test.js` asserted *"chapter 1 is still the gate lesson only"* — **exactly the
`i >= 1` behaviour the user replaced.** It is inverted in place, with the count spelled out so a
regression in either direction names itself: chapter 1 now carries one lesson per ticked type **plus**
its single standard gate lesson.

### Two new sections, for the case nothing covered

⚠️ **No test in the suite exercised a ONE-chapter book** — which is the shape of every comic and
one-chunk PDF, and the entire reason this bug survived. Both new sections drive `chunks` (the upload
path that `comicCreateChapter`/`pdfGenerateAll` actually use), not `generated`, which cannot produce a
one-chapter book at all.

- **The reported shape**: a one-chapter book with `['standard','word_forms','inflections',
  'comprehension']` gets all three real types, and `'standard'` **exactly once** despite being ticked.
- **The `review` carve-out**: skipped on a first chapter, the *other* ticked type still generated, and
  the log line asserted verbatim — a silently-dropped type is the defect this cut exists to end.

⚠️ One assertion had to be corrected while writing it: `_arcMode === 'reinforce'` is set on **every**
arc lesson, not only reviews, so the first version failed against a correct fix. The observable
signature of a skipped review is the absence of a **second** `standard` lesson.

### Five mutations, all red

Restoring the `i >= 1` gate (the bug itself), dropping either filter, dropping both, and skipping
silently without the log line.

### ⚠️ A THIRD guard broke on this change, and its anchor was the problem

`unit-arc-reinforce-types` sliced the server source from the literal
`base.arc && i >= 1 && Array.isArray(data.lessons))` — **the very condition the ruling removed**. Its
own comment records that this anchor had already broken once (`v87`'s decoupling added
`!base.skipLessons &&`) and had been re-anchored on *"the STABLE suffix"*. `i >= 1` was part of that
suffix.

⚠️ **It failed CONFUSINGLY, not clearly**: `indexOf` returned `-1`, `slice(-1)` yielded one
character, and the reported failure was the unrelated-sounding *"the book arc dispatches through
it"*.

Re-anchored on **`for (const aType of _types)`** — the loop the claim is actually about. A condition
in front of a block is precisely what a future ruling changes; the loop is what would have to be
rewritten for the assertion to stop meaning anything. And **the anchor now asserts it was found**, so
a miss fails AT the anchor instead of silently going vacuous. Verified both ways: renaming the loop
variable makes it fail loudly.

### Still open from the same report

**The lost "continued from" is NOT fixed and is not server-side.** `v89_o` proved it from the log:
`continuedFrom=-` — the client never sent it. See the open list; the send path's
`?.value || null` pattern is a three-time hazard there and wants fixing as a class.


## ✅ v89_o — the log settled it: a one-chapter book discards every selected lesson type

User supplied the server log for the failing run, expecting it to be post-hoc. **It was the run
itself, and it closes the investigation completely.** **Documentation only — the fix needs a ruling
first. ZERO `ui.json` keys.**

### The evidence, in three lines

```
Book generation started: 1 chapter(s) (from upload), id=book_8c0ac123f3a75740
  … arc=[standard,word_forms,inflections,conjugation,comprehension]  arcScript=off  continuedFrom=-
[qwen3.6:35b-a3b] Lesson 1/1…
```

The five types were **sent, received and echoed back**. `skipLessons` was not set. Exactly **one**
lesson was generated.

### The cause: `i >= 1`

```js
// Arc reinforcement lessons. Reinforcement only begins from the SECOND chapter:
// chapter 1 ships just its standard vocab lesson…
if (!base.skipLessons && base.arc && i >= 1 && Array.isArray(data.lessons)) {
```

For a one-chapter book — **every single photographed comic panel and every one-chunk PDF** — `i` is
only ever `0`. The block never runs. The types are discarded in silence, after being logged back as
though they had been honoured, which is precisely what made this hard to see from the outside.

### ⚠️ It is a UI/server mismatch, and needs a RULING rather than a patch

| side | says |
|---|---|
| client | `_genArcApplicable()` returns **`n >= 1`** for non-LLM modes, so the tick-list renders and is settable for a single panel (`v89_n` verified this) |
| server | `i >= 1` is correct **if** these are reinforcement of PRIOR chapters — chapter 1 has none |

Do the ticks mean *"which lesson types should each chapter get"* (server wrong for chapter 1) or
*"which types reinforce earlier chapters"* (UI must not offer them at `n === 1`)? **The tick-list
reads as the former to a user; the code is built as the latter.** Whichever the user rules,
**silently discarding an explicit selection is the bug** — and at minimum the server should log the
discard instead of echoing the types back.

### The other two findings from the same log

- **`continuedFrom=-` — the lineage was lost CLIENT-side.** The server never received it, so it is
  exonerated. `comicCreateChapter` sends `document.getElementById('continue-select')?.value || null`,
  so an empty or unrendered picker sends `null` silently. ⚠️ **This send path reading card-1/card-3
  controls the learner's route may never have populated is now a THREE-TIME hazard**: item `AL` (the
  field was never sent at all), `v86_v` (the same shape inverted — an auto-opened card meant
  `#gen-skip-lessons-cb` was read at its default), and now this. **Worth fixing as a class**: have
  the send path assert its inputs rather than `?.value || null` them away.
- **The chapter-title post-pass failed silently.** `no usable titles after 3 attempts` — which is why
  the chapter kept the raw first-40-characters placeholder as its title. Visible in the log, invisible
  in the app.

### And one confirmation, unlooked for

The same log shows `v89_j`'s answer re-check working in the user's own session:
`"umsonst" vs "kostenlos" -> also_acceptable`, `"kostenlos" vs "gratis" -> wrong` (×3). Live, on real
answers, with the conservative default holding.

### The method note worth keeping

Three releases were spent on this report: `v89_m` called it a race (wrong), `v89_n` corrected that and
listed three hypotheses, and `v89_o` closed it from **one artifact the user had all along**. ⚠️ **The
log was asked for at `v89_m` and would have ended the investigation there.** When a diagnosis needs a
server-side artifact, ask for it FIRST and stop analysing — two of the three releases here were spent
narrowing a hypothesis space that a single log line collapsed to nothing.


## ✅ v89_n — a correction: the missing lessons were a LOSS, not a race

User, correcting `v89_m`: *"i restarted those manually."* **Documentation only. ZERO `ui.json` keys.**

### The mistake, and how it was available to be avoided

`v89_m` recorded the comic chapter's missing lessons as *"a RACE, not a loss"*, on the grounds that
the chapter read `lessons: []` and had entries minutes later. **The entries were the user's own
manual re-adds.**

⚠️ **The evidence was in hand and read the wrong way round.** The running jobs were labelled
`Adding word_forms lesson` / `Adding standard lesson` — and `Adding …` is
**`/api/lessons/add-lesson`**, the manual per-chapter route, *not* the book job that created the
chapter. That label was quoted in the investigation and then reasoned past. **A chapter filling up is
not evidence of what filled it.**

**Both halves of the original report are real losses.** The original generation produced zero
lessons, and the lineage was dropped.

### What `v89_n` RULED OUT, by reading the source

Recorded so nobody re-checks them:

- ❌ *"The lesson-type list is never rendered for a one-panel comic."* `_applyLessonCardUI` renders it
  under `!skip && _genArcApplicable()`, and **`_genArcApplicable()` returns `n >= 1` for non-LLM
  modes** — true for a single panel. The `APP.numChapters > 1` gate sits on `onNumChaptersSlider`'s
  call site only, which the comic path never uses. The user could and did see the list.
- ❌ *"`comicCreateChapter` never sends these fields."* It sends `continuedFrom`, `skipLessons` and
  `arc`/`arcTypes`. Item `AL` already fixed the missing-`continuedFrom` bug once.

### What remains, and why the source cannot settle it

1. **`skipLessons` was true** — the only mechanism found that yields *exactly zero* lessons, and the
   route forces `arc:false` when it is set, which would discard the types too. **One cause, both
   symptoms.** ⚠️ But it does not explain the lost lineage, and `_applyLessonCardUI` HIDES the arc row
   when skip is on, so the types could not have been picked while it was.
2. **Two independent losses** from card-3/card-1 controls not being in the state the send path reads.
   ⚠️ `comicOpenReview`'s own comment already records the **inverse** of this (`v86_v`: the card
   auto-opening meant `#gen-skip-lessons-cb` "is still at its default and comicCreateChapter() read
   it as generate everything"), which establishes that **this send path reading card 3's controls
   when the learner's journey did not pass through card 3 is a known hazard shape here** — previously
   seen in the other direction.
3. **The book job errored** after `v69_q`'s early `lessons: []` crash-recovery save.

### ⚠️ Do not attempt a fix before reading the server log

Three live hypotheses and a send path that fails silently is exactly the shape that produces a
confident wrong patch. The log separates all three in one read: `generate()` logs
`Continuing from: "…"` on receipt, the route logs its resolved lesson plan, and a failure logs itself.

## ✅ v89_m — the wind-down: two planning documents, two new open items, one audit

User, wrapping up: *"provide a coarse estimate how much faster our most limiting functions (tutor,
text analysis) would run on a proper server"*, *"add a rough prioritization list for making this app
available on a live server… with multiple users"*, and *"make sure roadmap, internals etc. are all up
to date, and/or suggest loose ends"*. **Documentation only — no product code changed.**
**ZERO `ui.json` keys.**

### 🖥️ The GPU estimate — measured, not felt

New roadmap section. **The finding that decides it: there is no GPU at all.** `/api/ps` reports
`vram=0.0GB` for a 23.1 GB model, `nvidia-smi` is absent, and the CPU is an Intel Core Ultra 7 165U
— a 15 W laptop part. Everything runs on it.

The anchor, from one real `/api/chat`: **prefill 13.9 tok/s, decode 5.5 tok/s, cold model load ~70 s.**
⚠️ **Prefill is the part that hurts and the part intuition misses** — every long-context task pays it
before emitting a token. Cross-checked against a known measurement: the two rates predict ~260 s for
an inflections lesson; `v89_c` measured 300–440 s. The model of the system holds.

**Tutor ≈ 40× faster** (~130 s → ~3 s), **whole-chapter CP2 analysis ≈ 34× serially and 50–150× in
practice** (~28 min → ~50 s), because its per-sentence calls are independent and a GPU batches them
where a laptop cannot overlap them at all. Three things the multiplier understates are recorded
there, the sharpest being: ⚠️ **every model-role default in this repo was chosen on CPU, and `v89_l`
showed the CPU ordering can be the reverse of the GPU one** — a dense 12 B was 4× slower than a
3 B-active MoE here, which need not hold on a GPU.

### 🌐 The multi-user plan — ordered by what breaks first

New roadmap section, four tiers. **Tier 0.1 is `lessons.json` itself**: read once at boot, written
wholesale, and **already a proven data-loss mechanism** — it is the same write that ate `v89_f`'s
backfill (`v89_g`/`v89_h`). With two users, every save by one overwrites everything the other did
since. The section says plainly that nothing else on the list matters until that is decided, and
that the decision is architectural and should be made first and deliberately.

The rest: no auth at all (`DEFAULT_USER = 'admin'` on every write), unbounded unauthenticated LLM
spend, unscoped jobs (`/api/jobs` leaks other users' labels; cancel has no ownership check), TLS.
Then per-user state, a queue in front of the single backend, and publishing — which is **half-built
already**, since `build-static.js` is exactly the read-only artifact a "publish" button would emit.

### Two new open items

- **⚠️ A comic-sourced chapter lost its "continued from"** — user report, **confirmed from the data**:
  `tp_17885199795390000039` has no lineage and landed in its own storyline, while **8 of 8** other
  user-pasted chapters have one. ⚠️ **This entry originally called the lesson-type half a "RACE, not
  a loss", and that was WRONG** — corrected at `v89_n` after the user said *"i restarted those
  manually."* The lessons that appeared were their own re-adds, and the job labels said so at the
  time (`Adding … lesson` is `/api/lessons/add-lesson`, not the book job). **Both halves of the
  report are real losses.** The 65 s translation, against a 12–16 s norm, is still true and still
  says the box was loaded — but it explains slowness, not emptiness. See the open item for the
  corrected hypothesis space and the decisive next step: `generate()` logs `Continuing from: "…"` on
  receipt, so the server log for that job settles it in one read.
- **⚠️ The static build cannot offer the LLM-free alphabet course** — `window.SCRIPTS_DATA` is baked
  into `docs/index.html` and `loadScripts()` exists to pick it up, but the static `init()` never calls
  it, so `SCRIPTS_DATA` stays `{}`. Same shape as the `_storyTapInit` gap `v86_h` found. Flagged to be
  done **before** any publishing work.

### The audit

Every one of the line's eleven releases (`v89_b`…`v89_l`) has a roadmap entry and an INTERNALS
record. ⚠️ One imprecision fixed: INTERNALS' silent-failure-modes note credited the
running-server clobber to `v89_g`, the release that **found** it, with no pointer to `v89_h`, the one
that **guarded** it — a future reader looking for the guard had the wrong tag. Now reads *"found at
`v89_g`, guarded at `v89_h`"*, and names the guard and the honest limit of its coverage.

## ✅ v89_l — the answer re-check gets its own model role, and the default was measured

User: *"which model is used for re-checking an answer. could this be done by an especially cheap and
fast model?"* → *"add an OLLAMA_ANSWERCHECK_MODEL role and use the winner as a default."*
**ZERO `ui.json` keys.**

### The measurement, because the answer is not "the cheapest"

The real `PROMPTS.answerCheck`, five cases with known answers, against four installed models on the
user's own box. **Three of the five are tempting near-misses on purpose**: the failure that matters
is a FALSE "also acceptable", so a model that says yes to everything scores 2/5 here, not 5/5.

| model | size | correct | **false accepts** | avg |
|---|---|---|---|---|
| `qwen2.5:7b` | 4.7 GB | 3/5 | **1** | 22.6s |
| `translategemma:12b` (the QC role) | 8.1 GB | 5/5 | 0 | 106.0s |
| **`qwen2.5:14b`** ← **new default** | 9.0 GB | 5/5 | 0 | **25.3s** |
| `qwen3.6:35b-a3b` (the old lesson-model default) | 23.9 GB | 5/5 | 0 | 39.1s |

Two findings worth keeping:

1. **The cheapest model is the disqualified one.** `qwen2.5:7b` approved *"Sie las ein Buch"* for
   *"Sie liest ein Buch"* — a tense error — and was not meaningfully faster anyway.
2. **A dense 12B loses badly to a 3B-active MoE.** `translategemma:12b` is accurate and **4× slower**
   than the 35b-a3b it is a third the size of. Parameter count is not the axis that predicts latency
   here; active parameters are.

`qwen2.5:14b` matches the old default's accuracy at **~35% less latency and under half the size**.

⚠️ **Five cases is an indication, not a verdict**, and laptop latencies swing wide — the 35b's own
row ranged 6s to 50s in a single run. Re-measure before treating the default as settled.

### The role

| what | where |
|---|---|
| the role | `OLLAMA_ANSWERCHECK_MODEL` (server.js), beside the other seven. Runtime-mutable via `/api/models`, read live at the call site |
| the default | `qwen2.5:14b` — **unless `OLLAMA_MODEL` is set explicitly**, in which case it follows the LESSON model. That is `OLLAMA_QC_MODEL`'s own escape hatch, reused: a deliberate "one model for everything" setup must not be made to pull in a second download |
| the caller | `callLLMAnswerCheck`; `/api/answer-check` uses it instead of `callLLMLesson` |
| ⚠️ **`configuredModels()`** | it had to join the idle/shutdown RELEASE list. **This is the only role whose default names a model no other role names**, so omitting it would leave exactly one model this server can load and never free — on a laptop, where that is the whole point of the idle release |
| ⚠️ **`/api/models`'s `requested` array too** | that array is what gets validated against the installed models. A role missing from it is accepted without ever being checked; missing from both it and `setRuntimeModels`, it is silently ignored. Found by `e2e-models` §6d failing on the first run |

### ⚠️ Recorded, NOT fixed: two other roles are missing from the release list

`OLLAMA_TUTOR_MODEL` and `OLLAMA_ANALYSIS_MODEL` are also absent from `configuredModels()`, with the
same exposure whenever they are pointed at something the listed roles do not cover. Pre-existing, and
noted in place rather than folded into an unrelated release. It is in the open list.

### Not built, deliberately: the picker row

The client model picker (`renderModelPicker`) lists five roles — story, lessons, translation, qc,
tutor. `vision`, `analysis` and now `answerCheck` are all absent, which is exactly the scope of
**open item B**. Adding a row costs a `ui.json` key and the granted budget was three, all spent. Item
B's entry now names all three roles instead of only vision. Settable via env and `/api/models`
meanwhile.

### Guards

- **`e2e-models.test.js` §6d** — the role switches independently, leaves `analysis` and `lessons`
  untouched, does not flip the lesson format, is exposed on `/api/info`, is reset by the `{model}`
  convenience, and rejects an uninstalled name with 400. Under `boot()` every role is env-set to
  `fake`, so what this pins is the role's INDEPENDENCE, not the measured default.
- **`unit-answer-check.test.js` §7** — the part no e2e can see: membership of `configuredModels()`,
  the default expression including its escape hatch, and that the route calls the new role.
  ⚠️ **§2 was RE-SCOPED, not deleted** — it pinned `callLLMLesson`, which is precisely what this cut
  replaced.

## ✅ v89_k — a live selection owns the finger (the regression `v89_e` shipped)

User, after `v89_i`: *"i still don't see the grammar/meaning popover on the phone."*

### ⚠️ `v89_i`'s fix was correct. It was not the bug.

Two releases were spent on the visible symptom. The actual cause was shipped by **`v89_e`**, this
session, three releases earlier:

1. A finger adjusting a **selection** moves horizontally, so `_cardSwipeMove`'s axis lock called it
   a swipe.
2. `_cardSwipeDragBegin` sets `user-select: none` on `#comp-body` — and setting that while a
   selection is live **inside that container COLLAPSES the selection**.
3. `_storySelMaybeShow` then read `sel.isCollapsed` and returned. **PLAN §12 stopped working on
   touch entirely** — no popover, wherever it was pinned.

**Reproduced in a real browser before the fix**, with the sequence the earlier repro had missed:
a bare synthetic `touchend` never went through the swipe handlers, which is exactly why `v89_i`'s
diagnosis found the popover healthy. Driving the REAL gesture (touchstart → horizontal touchmove →
touchend) gave: selection came back **empty**, `#comp-body` had travelled **68px**, `user-select`
was `none`, `preventDefault` had fired — **and the chapter had changed**.

> **The lesson: reproduce the INTERACTION, not the STATE.** `v89_i` measured the popover's rect from
> a programmatically-set selection and a synthetic `touchend`, concluded it was created and correctly
> placed — and it was, in that setup. The bug lived in the two events that setup skipped.

### The fix

At the axis lock, before anything is decided:

```js
const _sel = window.getSelection && window.getSelection();
if (_sel && !_sel.isCollapsed) { from.axis = 'sel'; return; }
```

**Checked at the LOCK, the one moment before damage is done** — no drag begins, no `user-select` is
touched, `preventDefault` is never reached, so the browser's own selection handling runs untouched.
The signal is the one this file already trusts three times over (`_storySelMaybeShow`,
`_storyTapMaybeAdvance`, `_cardSwipeNav`): a non-collapsed selection means the gesture belongs to the
selection.

`_cardSwipeNav`'s guard widened from `axis === 'y'` to **`axis && axis !== 'x'`**, so the new `'sel'`
verdict cannot commit either. `null` (a finger that never passed the lock distance) still falls
through to the geometry, which is what a tap or a jitter must be judged by.

### Verified after, same real gesture

`axis: 'sel'`, **no drag**, `transform` untouched, `user-select` untouched, `preventDefault` **not
called**, **selection intact** (`selBefore === selAfter`, 67 characters), **popover shown**
(`display:flex`, `top:8px`), **chapter unchanged**.

### Guards

`unit-card-swipe-nav.test.js` §20 (new). §6 already covered the COMMIT ("a drag that selected text
stays a selection"); this covers the **DRAG**, one step earlier, which is where the damage was
actually done. It asserts the axis, no drag, **`user-select` never touched** (the specific thing that
broke the feature), `preventDefault` never reached, and no commit — plus the non-vacuity that the
IDENTICAL gesture with no selection still drags, still takes `user-select`, still preempts the scroll
and still commits. Without that last part, "the swipe never works at all" would pass §20 perfectly.

**Four mutations, all red — after two fixes to the TESTS**, both of the same kind: an older guard was
masking the new one.

- Reverting `_cardSwipeNav` to `axis === 'y'` stayed green, because §6's commit-time selection check
  caught it anyway. The case that distinguishes them is a gesture that WAS a selection whose
  selection is **already gone** by the time the finger lifts — the axis is then the only record of
  what the gesture was. That case is now in the file.
- A "check the selection after computing the axis" mutation stayed green because it was not actually
  the too-late ordering — `_cardSwipeDragBegin` still ran behind the `axis === 'x'` test. Rewritten
  to move `_cardSwipeDragBegin` ABOVE the check, which is the real defect shape, and it goes red.

## ✅ v89_j — "was my wrong answer actually also correct?", asked at answer time

User request, from the instance they sent: a nl→de `read_translate` marked **KOSTENLOS** wrong in
favour of **UMSONST** — and `kostenlos` is a perfectly good German rendering of `kosteloos`.
**Three `ui.json` keys, granted explicitly** — the first of the whole `v89` line.

### ⚠️ It REPORTS, it does not GRADE

Nothing in this cut touches `markSolved`, the ledger, hearts or BKT. The answer stays wrong; the
learner is simply told their choice was also acceptable. That is the roadmap note's own warning
made real: a model deciding the learner was right after all would write **progress state**, so a bad
verdict would corrupt their history rather than one feedback panel. `unit-answer-check` §2 asserts
the route's body mentions none of `saveStore`/`markSolved`/`store.topics`/`progress`.

### Off by default, and every reason it stays shut

User ruling: *"add a settings button to activate/de-activate this function (default NOT active) since
this works only on live and likely will be slow."* Measured on their own model: **~31s per check** —
so the default matters.

| gate | why |
|---|---|
| `APP.answerCheck` | the setting. `loadAnswerCheck` reads `=== '1'`, never `!== '0'` — absent means OFF |
| `APP.info.canGenerate` | no live backend, nothing could answer. The settings ROW is hidden too — which also makes it correctly absent from the static build |
| type ∈ `_ANSWER_CHECK_TYPES` | `mcq_target_source`, `mcq_source_target`, `read_translate`, `listen_mcq` |
| a wrong answer only | it is called from `check()`'s wrong branch, never on a correct one and never on a replay |
| `correct !== picked` | case-normalised; not a disagreement to judge |

**Scope is a ruling, not an oversight.** The grammar types (article, plural, conjugation) are OUT: a
second correct answer *there* means the lesson is broken in a different way, and that is worth
SEEING rather than smoothing over. `inflection_form` — where `Präteritum` and `Vergangenheit` really
are both right — was offered and not taken up this cut.

### ⚠️ The parser's asymmetry is the safety property

`parseAnswerCheck` (server.js) accepts **only** an explicit, **anchored** `also acceptable`.
Everything else — a shapeless reply, an empty one, an unknown verdict word — comes back as something
the client will not show.

> Failing to spot a synonym costs a learner nothing. Telling them a genuine mistake was fine teaches
> them the mistake, **and they cannot tell that the model was guessing.**

The prompt carries the same instruction (*"WHEN YOU ARE UNSURE, ANSWER wrong"*), but per this line's
own repeated finding, an instruction is not a mechanism — the parser is the mechanism.

**This was not theoretical.** The first parser used an UNANCHORED `/also\s+acceptable/`, so
`VERDICT: probably also acceptable-ish` — a hedge — read as **approval**. The guard caught it before
it ever ran. That is the one direction this feature must never fail in, and it failed there first.

### Verified live, end to end

Against a **separate server instance on port 3457 with its own copy of the corpus** (a `server.js`
edit is not live in the user's process, and their data must not be touched):

| case | verdict | note the learner sees |
|---|---|---|
| `KOSTENLOS` vs `UMSONST` (the report) | **also_acceptable** | *"„Kostenlos" ist ein direktes Synonym zu „umsonst" und in diesem Kontext ebenfalls korrekt."* |
| *"Die Katze schläft…"* vs *"Der Hund läuft…"* | **wrong** | *"Die Antwort beschreibt ein völlig anderes Subjekt und eine andere Handlung…"* |

~31s each. Contract checks answered `400` as designed (identical answers, missing prompt). The
instance was killed by the PID holding port 3457, never by `pkill -f "node server.js"`, which would
have taken the user's own server with it.

### Guards

`unit-answer-check.test.js` (new, 6 sections) — the parser's asymmetry, the route touching no
progress name, every gate one at a time so a failure names which one broke, the per-type question
DIRECTION (⚠️ `mcq_source_target` runs the other way and is the one that would be silently wrong if
the direction were assumed), the late-verdict drop, and that exactly the three granted keys exist,
`en` only, all three used.

**Ten mutations, all red — after a fix.** The stale-index mutation stayed GREEN at first: the test
called `_answerCheckShow(…, 4)` with `APP.cur.cur` already `4`, so the indices MATCHED and the
DEDUPE was doing the rejecting, not the guard under test. Rewritten to the real case — a verdict for
question 3 arriving into the fresh panel question 4 rendered — plus a non-vacuity showing the same
panel still accepts a verdict for the question actually on screen.

## ✅ v89_i — the phone select-text→tutor popover, out from under the browser's chrome

User request, after the diagnosis at `v89_h`: *"yes, do the popover fix."* **ZERO `ui.json` keys.**

### ⚠️ The durable lesson, earned twice now

`v84_d` fixed this bug once: the popover was hidden under the native **Copy / Share** toolbar, which
mobile browsers draw right at the selection. Its fix was to stop anchoring near the selection and
pin the popover to the **BOTTOM** instead. That is where Android Chrome draws **Touch to Search** —
the Google bar offering to search the selected words — so the popover went straight back under a
different piece of chrome, and the feature read as simply not working.

> **Pinning to a fixed viewport EDGE is the losing move.** Both edges belong to the browser: the
> selection toolbar follows the selection, Touch to Search owns the bottom, the URL bar the top.
> A page can neither see nor out-z-index any of them.

What a page CAN do is pick the region the chrome does not use **on this gesture**. The selection
toolbar follows the selection, and on these cards the story text sits below a header (and often a
comic image) — so the top strip is free exactly when a story selection is being made.

| what | where |
|---|---|
| the placement | `_storySelShowPopover`'s touch branch (index.html) — `top = visualViewport.offsetTop + _STORY_SEL_TOUCH_TOP`, `bottom: auto`, `left: 50%`, `translateX(-50%)` |
| ⚠️ why `visualViewport`, not `top: 8px` | `position:fixed` is relative to the **LAYOUT** viewport, and on Android Chrome the two diverge as the URL bar collapses and expands. `visualViewport.offsetTop` is the one API that reports where the visible area actually starts |
| ⚠️ `bottom: 'auto'` is explicit | leaving the old `bottom` alongside a new `top` is how an element ends up stretched between the two. Its own mutation is red |
| desktop | completely unchanged — mouse selection has no native toolbar to collide with, so the near-selection placement stays |

### The diagnosis this rests on (from `v89_h`, kept here because it is what ruled out the easy answers)

Reproduced under mobile emulation (375×812, `maxTouchPoints:5`, explorer mode ON as in the user's
screenshot) **before changing anything**: the popover was `display:flex`, `position:fixed`, rect
`top 700 / bottom 736` — created, and inside the viewport. So **neither** "explorer mode blocks it"
**nor** "`--bottom-bar-h` collapsed to 0" was the cause; both were measured and ruled out. 76px from
the bottom edge is simply inside Chrome's own band.

### Verified after

Same emulation, same selection: rect **`top 8 / bottom 44`** of an 812 viewport — **768px clear of
the bottom band**, and nowhere near the mid-screen selection where the Copy/Share toolbar draws.
Screenshotted: both buttons (🔤 Grammatik, 💬 Bedeutung) fully visible at the top while the
selection stays highlighted in the story below.

### ⚠️ NOT fixed, and not fixable from a page

**The Google "Touch to Search" bar itself.** It is browser chrome; no page-side lever removes it.
The user asked for it to be suppressed and the honest answer is that moving the popover out of its
way is the whole remedy available here — the bar is still there, it just no longer covers anything.
Recorded in the code comment so the next session does not go looking for a switch that does not
exist.

### Guards

`unit-tutor-selection.test.js` §10 **RE-SCOPED, not deleted** — it pinned `bottom-bar-h`, which is
exactly the ruling this cut replaces. It now asserts the durable claim separately from the current
edge: touch gets a **fixed, viewport-anchored, horizontally-centred** spot that **does not depend on
where the selection is** (a second call with a wildly different rect must land identically — the
property that actually matters), plus the current top edge, the explicit `bottom: auto`, and that
`visualViewport.offsetTop` is honoured (56 + 8 → `64px`).

**Six mutations, all red**: going back to the bottom edge, leaving a stale `bottom`, ignoring
`visualViewport.offsetTop`, re-anchoring horizontally to the selection, re-anchoring vertically to
it, and giving touch the desktop placement.

## ✅ v89_h — a running server silently reverts every offline edit to `lessons.json`

Not a feature: a hazard found the hard way at the `v89_g` cut, and the two user items raised in the
same window, recorded. **ZERO `ui.json` keys.**

### What happened

`v89_f` backfilled 28 inflection form labels and committed them. Minutes later the worktree copy was
back to Dutch. The cause, read out of `server.js` rather than guessed:

```
line 756:  let store = loadStore();     // ONCE, at boot. The only call site.
saveStore(s):  fs.writeFileSync(STORAGE_FILE, JSON.stringify(out, null, 2))   // the WHOLE in-memory copy
```

A server that was already running holds a snapshot from **before** any offline edit. The next time
anything saves — **a learner answering one question is enough** — it writes that snapshot back over
the edit. Nothing throws, nothing warns, and the script that made the edit has already printed its
success message.

**This is not specific to one script.** Every `backfill-*.js` in this repo edits `lessons.json`
offline, as does any hand-edit. All of them are exposed. It is now in INTERNALS' **silent failure
modes** section, which is where it belongs — the defining property is a plausible result while the
wrong thing happens.

### The guard

`backfill-inflection-labels.js` REFUSES to write while a server answers on the configured port
(`serverIsAnswering(port, timeoutMs)`, `--port`, `--force` to override). Checked **before** the model
calls, not after — ten minutes of generation followed by "refusing to write" would be the most
annoying possible ordering. A successful write now also prints *"restart any server that was already
running"*.

**Anything that answers counts as running**, including a 404 or a 500: it is the PROCESS holding the
file in memory that reverts it, not the route. A silent port times out to `false` rather than
hanging the script.

### ⚠️ How to recover a clobber — do NOT `git checkout` the file

The clobbering write also carries **the other writer's genuine work from the same window**. Here it
carried a real story/`comicPanels`/`aiStory` edit to *"Strom fließt wieder"*. Re-apply the lost edit
onto the CURRENT file, **content-keyed** (the same match `applyPlan` uses: topic id → lesson id →
sentence + surfaceForm + option count), and verify the other writer's changes survived. Both were
verified explicitly at `v89_g`: 28 items restored, their edit intact, 60 items with 0 broken
invariants and 0 duplicate choice sets.

### Guards

`unit-inflection-label-backfill.test.js` §9 — a free port reads `false` (or the refusal would fire on
a clean machine and the backfill could never write at all), 200/404/500 all read `true`, a silent
port times out to `false` promptly. **Three mutations red**, one of them by HANGING the test, which
is why the mutation runner needs its own `timeout`.

⚠️ **Stated honestly: the refusal's WIRING into `main()` is not unit-covered** — `main()` is the CLI
path, and removing the check leaves the suite green. It was verified by running the real command
against the live server and reading the refusal it printed. The DETECTOR is what the tests pin.

### Two user items recorded, not built

Both are in **"🆕 Raised by the user at the `v89_h` cut"** in the open list, with the evidence:

- **A "wrong" answer is sometimes also correct** — with the instance (`KOSTENLOS` marked wrong for
  Dutch `kosteloos` in favour of `UMSONST`), the two strategy families the user named, and the
  warning that `v89_c`/`v89_d` already proved an instruction is not a mechanism.
- **The phone select-text→tutor popover** — DIAGNOSED under mobile emulation (the popover is created
  and correctly placed; both obvious hypotheses were measured and ruled out) and **not fixed**. It is
  the second time this exact bug has been fixed, and the lesson is that pinning to a fixed viewport
  edge is the losing move.

## ✅ v89_g — the swipe reaches the entry card, and WHICH cards swipe becomes a table

User: *"the swipe should also work on the entry/summary card."* **ZERO `ui.json` keys.**

### A table, not a second copy

The two cards are the same shape — a `.comp-body` with the machinery in a sibling ☰ popup that owns
its own drags — so the hard-coded ids became `_SWIPE_CARDS`:

```
{ screen: 'complete-screen', modal: 'comp-nav-modal', body: 'comp-body', next: 'comp-next', prev: 'comp-prev' }
{ screen: 'summary-screen',  modal: 'sum-nav-modal',  body: 'sum-body',  next: 'sum-next',  prev: null }
```

`_cardSwipeInScope` became `_cardSwipeCardFor(target)` → the row or null, and `_cardSwipeBtnFor` took
a second argument. Both the drag and the commit read the same row, so they still cannot disagree.

**The entry card has NO back button at all** (only `sum-next` ever got a header duplicate; there is
no `sum-sum-prev`) — and `prev: null` needed **no special case anywhere**. It flows into
`_cardSwipeBtnFor` returning null, which the drag already rendered as the short `_SWIPE_DEAD_MAX`
wall and the commit already refused. That is the payoff of `v89_e` having put those two rules in one
place.

`#finished-screen` is deliberately NOT in the table — it was not asked for, and adding it is one row.
`id="sum-body"` is the only new markup.

### ⚠️ Two assertions had to INVERT, and why that is the interesting part

`unit-card-swipe-nav` §4 and §16 pinned *"the ENTRY card is out of scope — this is not a page-wide
gesture."* That claim was **only ever true because the harness has no page tree**: the fixture set
`#sum-sumtext`'s innerHTML but never attached it under `#summary-screen`, so `closest()` found
nothing. The assertion passed for a reason that had nothing to do with the product, and `v89_g` made
it false in the real app.

Both sections now use **`#finished-screen`**, which genuinely is absent from the table — and the
fixture BUILDS it, so "out of scope" is a claim about the page rather than about the stub. Same
correction for the entry card itself: it is nested properly now
(`#summary-screen` > `#sum-body` > `#sum-sumtext`, and `#summary-screen` > `#sum-nav-modal`).

**This is the standing "a guard can become an assertion of the wrong thing without ever going red"
rule arriving from the third direction in one line** — after `v89_d`'s `Array.isArray`, `v89_e`'s
`|| !APP._swipeEl` and `v89_f`'s too-weak fixture.

### Verified live on the entry card

Real `TouchEvent`s against the running app:

- **backward** (300px pull, no destination): `translateX(24px)` — the short dead wall — `#comp-body`
  untouched, springs home, still on `#summary-screen`. **Nothing committed.**
- **forward** (300px pull): `translateX(-91px)`, the full damped travel; release left transform and
  transition both **empty** (a snap) and landed on `#complete-screen`.

### Guards

`unit-card-swipe-nav.test.js`, 16 sections → **19**. The new ones pin that a swipe on the entry card
presses `sum-next` and **not** `comp-next`, that backward does nothing, that **each card drags its
OWN body** (§18 — the failure it catches is a table that resolves the SCREEN correctly but still
moves the hard-coded `#comp-body`, which would look right on one card and move an invisible element
on the other), and that the dead direction still springs home committing nothing.

**Nine mutations red; two stayed GREEN and both were UNFALSIFIABLE CODE, now removed** — not weak
tests:

- `id && document.getElementById(id)` — a null id yields no element in a browser, and the
  `typeof onclick` check catches it either way, so the extra condition only made the real checks
  harder to falsify.
- `APP._swipeCard = null` in `_cardSwipeDragEnd` — `_swipeEl` is the "am I dragging" flag and
  `_swipeCard` is only ever read while it is set, so nulling it was hygiene on a reference to a
  static table row that leaks nothing.

Both removals follow `v89_e`'s own precedent, and the two checks that now carry those cases
(`display === 'none'`, `typeof onclick`) were re-mutated and are red.

## ✅ v89_f — the backfill: the corpus's own form labels, repaired

User: *"yes, do the backfill"*. **ZERO `ui.json` keys.** Run for real against `lessons.json`:
**15 lessons, 28 of 60 items rewritten**, the other 32 returned unchanged because they were already
in the right language. `v89_d` only ever fixed NEW lessons; this is the half the original report was
actually about.

### The rules moved out first, so the two callers cannot drift

`inflection-labels.js` (new) owns the DECISIONS — `shouldNormaliseLabels`, `buildLabelRequest`,
`applyLabelReply`, `labelReplyTokens` — and is pure: no I/O, no model, no logging. Both callers use
it: `normaliseInflectionLabels` (server.js, at generation time, inside a job) and
`backfill-inflection-labels.js` (over the corpus, from the command line). What is left in server.js
is plumbing — the job step, the call, the parse, the logging, the cancel — and none of it decides
anything. **Duplicating the fallback policy across two files is exactly the drift this project keeps
paying for**, so the extraction came before the script.

The refactor was diffed rather than asserted: `e2e-inflection-label-lang` passed unchanged, first
try, and `unit-inflection-label-normalise` now injects the REAL module into the extracted wrapper
instead of re-stubbing the rules — a stubbed rule set would let the two drift while the test stayed
green.

### ⚠️ Concurrency here is real, not theoretical

The user's server runs continuously and writes `lessons.json` on every answered question, and a run
spends **minutes** inside model calls between its read and its write. So the write is not "save the
object I loaded":

- the file is **RE-READ** at write time;
- each repair is located by **CONTENT** — topic id → lesson id → the item's own
  `sentence` + `surfaceForm` + **original `formChoices`** — never by index (see
  `analysis-corrections.js`'s header for the standing reasoning);
- an item that changed underneath is **REPORTED and SKIPPED**, never guessed at;
- a `.bak` is written first, like every other backfill here.

`--write` **RE-QUERIES** the model; it does not replay the dry run. The backend is
non-deterministic, so what lands is equally valid but not character-identical to what was previewed
— documented in the script's own header, because reading a dry run as a diff to sign off line by
line would be wrong.

### What it actually did, verified against the backup

| check | result |
|---|---|
| everything except `formLabel`/`formChoices`, anywhere in the file | **byte-identical** |
| inflections items before / after | 60 / 60, **28 changed** |
| items with a broken `formLabel === formChoices[formCorrectIndex]` | **0**, before and after |
| items with duplicate choices | **0**, before and after |
| topics / storylines | 343 / 97, unchanged |

Every language pair now reads in its source language: `nl→de` "Präsens, 3. Person Singular"
(was "Tegenwoordige tijd, 3e persoon enkelvoud" — the original report), `it→nl` Dutch, `sr→de`
German (was Cyrillic Serbian), `en→de` German (was English), `de→it` Italian. The `en→ja` lessons
were already Japanese and came back **unchanged** — the pass is idempotent where nothing is wrong.

### ⚠️ Known limitation, not fixed

**Terminology is consistent WITHIN a lesson but not ACROSS the corpus.** One German lesson says
`Präteritum`/`Präsens`, another `Vergangenheit`/`Gegenwart`; both are correct German and both are
internally coherent as a multiple-choice set, which is all `applyLabelReply` can check. Making the
whole corpus agree needs a per-language glossary the model is handed, which is a different feature.
Recorded in the open list rather than half-built here.

### Guards

`unit-inflection-label-backfill.test.js` (new, 8 sections) covers the two PURE halves that bracket
the model call — `planBackfill` (scope) and `applyPlan` (the write-back). §6 is the one that matters:
a **REORDERED** lesson still repairs each item correctly, which is the non-vacuity for §5's staleness
checks — if the match were positional, reordering would silently write each repair onto the wrong
item.

**Twelve mutations, all red — after a fix.** The first run left `l.type !== 'inflections'` GREEN: the
fixture's other lessons were `standard` ones with no `items` at all, so the item filter dropped them
anyway and the two branches were indistinguishable. **Third release running that a mutation found an
unfalsifiable guard** (`v89_d`'s `Array.isArray`, `v89_e`'s `|| !APP._swipeEl`). Here the guard is
right and the FIXTURE was too weak, so the fixture grew a `word_forms` lesson carrying
inflection-shaped items — contrived in this corpus, and the only thing that makes "the lesson TYPE
is the scope statement, not the field names" falsifiable.

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

