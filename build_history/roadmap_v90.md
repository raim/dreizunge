# Dreizunge roadmap — v90

**This is the `v90` line.** Cut from `roadmap_v89.md` at its last commit (the `v89_an` release), at
the user's own explicit request ("feel free to cut to v90") — the same shape as every prior cut.

The `v89` line ran **forty point releases** (`v89`…`v89_an`). Among much else it closed: the two
items it was handed; **item `V`** (multi-image comic upload, open since the `v86` line); the
**flake audit**, which found that the two "known flaky" tests were never flaky and that the real
defect was a non-atomic `fs.writeFileSync` corrupting reads of every durable store; the
**job-coverage enumeration**, after two user reports of the same class; the **text-analysis token
popover**, whose Save button had been syntactically broken in its own markup; **storyline-level
provenance** with chapter inheritance; the **on-demand and automatic text QC**; and the dead
`kind:'sync'` popover path.

**`roadmap_v89.md` is kept and is not superseded as a record** — the whole `v89` line's release
history (`v89`…`v89_an`) lives there under `# ✅ SHIPPED IN THE v89 LINE` and was NOT copied here.
Go there for how something was built or why a guard is shaped the way it is; this file stays current
through the whole v90 line.

> **⚠️ WHAT WAS CARRIED, AND WHAT WAS NOT.** Carried: this protocol block, the open items that are
> genuinely still open (each cross-checked against the `v89` shipped list — **four were closed
> during that line and are struck through here, not silently dropped**), the findings that govern the
> open sections, the GPU and multi-user prioritisation sections, `§0`/`§0i`, and the standing RULES
> (now including the `v89` line's own block). **Not carried**: the `v89` line's
> `# ✅ SHIPPED IN THE v89 LINE` section.
>
> ⚠️ **A STALE POINTER, INHERITED AND NOW FIXED.** `roadmap_v89.md`'s own index table claimed
> **TRACK T** and **THE LARGER PLAN** were "in this file". They are not — they live in
> `roadmap_v88.md` (`# TRACK T…` and `# THE LARGER PLAN…`), and the v89 cut never copied them. The
> claim went unnoticed for forty releases while `PLAN §X` was cited throughout. This file points at
> where they actually are. **`CLAUDE.md`'s own warning applies to roadmaps too: a pointer that names
> a file goes stale, so check it before trusting it.**

### What is in this file, in order

| section | what it is |
|---|---|
| **OPEN AT THE v89 CUT** | fresh, top-of-file summary of everything still genuinely open, reconciled against the `v88` shipped list — then the findings that govern the open sections, then `§0` / `§0i` themselves, then the standing RULES |
| **SHIPPED IN THE v89 LINE** | this line's own release history, newest first |
| **TRACK T** — ⚠️ **in `roadmap_v88.md`, not here** | the text-focused progress card. Steps 1–4 and `§T7` all shipped in the v81 line; nothing open. `roadmap_v89.md` claimed to carry it and did not |
| **THE LARGER PLAN** — ⚠️ **in `roadmap_v88.md`, not here** | the folded `implementation_plan.md`, cited as `PLAN §X`. **A bare `§3` is this file's item; `PLAN §3` is Track C.** `PLAN §12`, `PLAN §7.0` Track A (CP1-5) and `PLAN §13` are fully shipped; `PLAN §7.0` CP6 is open (a CONDITIONAL, not a queued slice); `PLAN §2.4`/Track A4 is shipped as its four-milestone core plus `v85`–`v89`-line follow-ups |

Standing rules are in the "Rules earned in session 28…34" blocks, plus two more from the `v83` line,
three from the `v84` line, six from the `v85` line, EIGHT from the `v86` line, the `v88` line's own
block below, and **SEVENTEEN from the `v89` line** (eleven from its first half, six more from
its second) — read the **"⚠️ How the rules are NUMBERED"** note
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

# ⚠️ OPEN AT THE v90 CUT

## 🆕 THE SHORT LIST — everything genuinely open, reconciled at the v90 cut

*Each line below was cross-checked against `roadmap_v88.md`'s shipped section before being written
here. **Nothing is owed**: the `v88` line closed every item it was handed. The fuller diagnoses live
in the carried sections further down and, where noted, in the older roadmaps.*

**Buildable now, no decision needed:**
- **⚠️ TWO test files share `unit-observations-log`'s defective driver shape** — `unit-question-nav`
  and `unit-tap-word` branch on `if (btns.length)` before considering `ex.type`. (Was three;
  `unit-inflection-speak-lang` was re-checked at the `v89_ag` cut and no longer has it.)
  `unit-question-nav` is the most exposed but measured 14/14 clean, so `v88_h` deliberately did NOT
  change it: altering several test files on one file's evidence is how a cleanup becomes a
  regression. `roadmap_v88.md`'s `v88_h` entry carries the deterministic probe.
- **Item D** (Tier 2 image-coordinate highlighting) — buildable, wants its own design pass first.
- **Offline mode hides controls SILENTLY** on the storyline and lesson-set pages — `#offline-note`
  exists only on the generation screen, which is why a backend outage reads as broken buttons.
  Offered at `v87_p` and not taken up; small, and would have saved two user reports.
- **24 groups of DUPLICATE English in `ui.json`** — reported at `v89_an`, deliberately NOT merged.
  `"⚑ {n}"` sits under four keys, `"{n} chapters"` under four, `"Story"` under three. ⚠️ Merging is
  **not** obviously safe: the `_plural` pairs exist for languages whose rules differ where English
  collapses them, and a heading may inflect differently from a model-role label. **Needs a per-group
  user ruling, not a sweep.**
- **The `ui.json` translation backlog** — no language is complete. `fr`/`de`/`it`/`es` were 59 keys
  short at the `v89_an` cut, and it is the SAME 59 in every language (the recent `jobs.*`,
  `toast.draft_*` features); the rest sit at 75–110. ⚠️ **The user translates by hand and was doing
  exactly this at the v90 cut** — check `git log ui.json` before assuming any count.
- **Three `ui.json` keys HELD rather than deleted** at `v89_an` (`form.image_scene_ph`,
  `form.image_review_confirm`, `sl.recreate_btn`) — each is named by a TEST but by no product code.
  Removing them means re-scoping that assertion. Listed with reasons in `unit-ui-keys-live.test.js`'s
  own `HELD` map.

⚠️ **CLOSED DURING THE v89 LINE** — struck through here rather than dropped, so a later session does
not re-derive them as open: **item `V`** (`v89_al`), **the flake audit** (`v89_ad`), **the dead
`kind:'sync'` path** (`v89_am`), and **the completion card's force-regenerate control** (ruled
against by the user — see the ruling section below).

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


## 🌍 THE UNLOCALIZED-STRING BACKLOG (re-derived at `v90_k`) — 86 CERTAIN, 60 UNDECIDED

⚠️ **Read the `v90_k` shipped entry before touching this.** The numbers below are the RE-DERIVED
ones; an earlier pass reported "143 distinct hardcoded strings" and was wrong, because it guessed
from markup which English literals were first-paint FALLBACKS. **Re-measure the class you are about
to touch** — the client localizes through at least four idioms and a regex mis-classifies in both
directions. The oracle: `getElementById` AUTO-VIVIFIES, so an element the DOM harness returns starts
blank; run `applyUIStrings()` and a value present means it wrote there.

**Nothing here is owed** — no user has asked for it. It is recorded so a tier can be picked and
costed instead of re-derived. Every line is a string a user reads in English whatever their UI
language is set to.

### A — markup `title` / `placeholder` with an id, that `applyUIStrings` never writes (35)

| id | attr | English |
|---|---|---|
| `bottom-bar-toggle` | title | "Hide bottom bar" |
| `settings-pill` | title | "Settings" |
| `mute-pill` | title | "Mute" |
| `speech-mic-pill` | title | "Speak your answer" |
| `export-static-btn` | title | "Rebuild docs/index.html" |
| `teacher-dash-btn` | title | "Teacher dashboard" |
| `teacher-mode-select` | title | "Unlock all stories" |
| `static-flag-close-btn` | title | "Dismiss" |
| `tts-lang-select-landing` | title | "Speech language" |
| `tts-voice-select-landing` | title | "Voice" |
| `use-full-chain-row` | title | "Pass the full storyline as context — better continuity, slowe |
| `topic-input` | placeholder | "e.g. cooking, architecture, medicine…" |
| `user-story-input-ph` | placeholder | "Paste your story here…" |
| `user-translation-ph` | placeholder | "Paste the translation here." |
| `dialect-name-input` | placeholder | "Dialect name (e.g. Osttirol)" |
| `dialect-input` | placeholder | "a boisl = einige Zeit&#10;Gitsche = Mädchen&#10;bleckfüeßet = |
| `dialect-attr-input` | placeholder | "Attribution / source (optional, e.g. author + license)" |
| `btn-topics` | title | "Home" |
| `lesson-edit-btn` | title | "Edit title" |
| `lesson-title-input` | placeholder | "Lesson set title…" |
| `dialect-story-topic` | placeholder | "Story topic (e.g. a day in the mountains)" |
| `dialect-story-instr` | placeholder | "Instructions (optional), e.g. 'this is a Bavarian-style diale |
| `dialect-story-btn2` | title | "Write a Standard-German story, then rewrite it into the diale |
| `story-flag-comment` | placeholder | "Describe what is wrong with the story…" |
| `sial-diff-lesson-card` | title | "Difficulty" |
| `math-instr-lc-ph` | placeholder | "🤖 Describe math exercises… (Fibonacci, powers of 2, LaTeX…)" |
| `tts-lang-select-ls` | title | "Speech language" |
| `tts-voice-select-ls` | title | "Voice" |
| `comp-story-explorer-btn` | title | "Text explorer — tap any word for its grammar" |
| `comp-story-spk` | title | "Read story aloud" |
| `sl-screen-del-btn` | title | "Delete storyline" |
| `sl-tag-input` | placeholder | "Tags, semicolon-separated…" |
| `sl-screen-edit-input` | placeholder | "Storyline title…" |
| `bmodel-threads` | placeholder | "auto" |
| `tts-voice-select-main` | title | "Speech variant" |

### B — literals passed to `showToast` / `confirm` / `alert`, where no fallback exists (10)

- "⏳ Resuming book generation…"
- "✓ docs/index.html rebuilt"
- "⚠ Summary element not found"
- "⚠ Open a storyline first"
- "⛔ Generation stopped"
- "Could not load: "
- "Please paste your story (at least 20 characters) before generating."
- "Could not generate title: "
- "Clear all lesson results for \"${topic}\"?\\nThis resets all progress for"
- "Delete the ${label} lesson from \"${d.topic}\"?\\nThis cannot be undone."

### C — markup text with an id that nothing in the source ever writes to (10)

- `acct-signin-btn` — "Sign in"
- `acct-register-btn` — "Create"
- `gen-status-text` — "Generating…"
- `gen-lbl` — "Building your lessons…"
- `gen-sub` — "Starting…"
- `dialect-upload-btn` — "📎 Upload"
- `vocab-mode-opt-reinforce` — "🔁 reinforce vocab"
- `vocab-mode-opt-neutral` — "○ neutral"
- `vocab-mode-opt-extend` — "➕ extend vocab"
- `sial-btn-lesson-card` — "Generate"

### D — literal `title` / `placeholder` / `aria-label` on elements with NO id (31 distinct, 41 occurrences)

`applyUIStrings` addresses elements by id, so it cannot reach any of these.

- "Delete" — title, ×4
- "Home" — title, ×3
- "Stop generation" — title, ×3
- "Edit summary" — title, ×2
- "Add choice" — title, ×2
- "Remove choice" — title, ×2
- "Close" — title, ×1
- "Import lessons.json" — title, ×1
- "Refresh" — title, ×1
- "Continue story" — title, ×1
- "Edit / rename topic" — title, ×1
- "Share storyline link" — title, ×1
- "Delete all chapters in this storyline" — title, ×1
- "Edited" — title, ×1
- "Delete lesson" — title, ×1
- "Re-translate all chapters" — title, ×1
- "reason (optional)" — placeholder, ×1
- "Edit the story in the lesson-set screen story editor" — title, ×1
- "Delete this whole word entry" — title, ×1
- "context sentence containing the word" — placeholder, ×1
- "word" — placeholder, ×1
- "gloss" — placeholder, ×1
- "Remove" — title, ×1
- "short reason the answer follows from the story" — placeholder, ×1
- "use ___ for the blank" — placeholder, ×1
- "short reason the correct form fits" — placeholder, ×1
- "the exact word as it appears above" — placeholder, ×1
- "e.g. plural of 'der Kopf', formed with -e and umlaut" — placeholder, ×1
- "Tap to hear" — title, ×1
- "tap to remove" — title, ×1

### The 60 undecided (class C's remainder)

Markup text with an id that SOME code writes to. Deciding each needs reading that writer: a
hand-check of 27 found roughly half genuinely localized (`fin-title`, `sum-title`,
`tutor-widget-title`, `flag-strip-label`, `lib-cnt`, `acct-name`, `acct-signout-btn`) and the rest
not. ⚠️ Two mis-classifications to learn from: a regex called `fin-title` hardcoded (it is written
`const ttl = getElementById('fin-title'); if (ttl) ttl.textContent = t('finished.title')`, two
statements apart) and called `topic-name-big` localized (it is assigned the topic NAME — user
content, not a translatable string).

### Roughly who reads them — judgement, unlike the counts above

- **A learner in normal play (~25):** the generation screen's own progress text ("Building your
  lessons…", "Generating…", "Starting…"), the bottom-bar / settings / mute / mic pill tooltips, the
  speech-language and voice selectors on two screens, "Home", the completion card's explorer and
  read-aloud buttons, `confirm("Clear all lesson results for …")`,
  `alert("Please paste your story (at least 20 characters)…")`, the three vocab-mode options.
- **A teacher authoring (~45):** the whole dialect studio, the lesson editor's placeholders ("use ___
  for the blank", "short reason the correct form fits", "the exact word as it appears above"), the
  title and tag inputs, "Add choice" / "Remove choice" / "Delete", `confirm("Delete the … lesson…")`.
- **A maintainer (~10):** "Rebuild docs/index.html", "Import lessons.json", "Teacher dashboard",
  "✓ docs/index.html rebuilt".

## 🌐 SCRAPE A STORY STRAIGHT FROM A URL (user question, at the `v90_k` cut) — MEASURED, NOT BUILT

User: *"How hard would it be to scrape text directly from a URL, e.g. a newspaper article like
`corrieredellaltoadige.corriere.it/…/accordo-de-gasperi-gruber-…shtml`?"* Answered by **fetching
that exact URL** rather than by estimating.

### What the measurement showed

| | |
|---|---|
| **the fetch itself is nothing** | `https.get` with a browser `User-Agent` → **HTTP 200, 196 877 bytes**, no dependency, no JS engine. Redirect-following and a size cap are ~40 lines |
| **⭐ the body is already in the HTML, as structured data** | A `schema.org` **`NewsArticle` JSON-LD block** carries `articleBody` (**3 450 chars / 499 words**), plus `headline`, `author.name` ("Andrea Dalla Serra"), `datePublished` and `publisher.name`. Clean Italian prose, no furniture. That is the whole feature for a site that ships it |
| **and it maps onto fields that ALREADY exist** | `articleBody` → the story text, then straight into `cleanExtractedText` → `_splitIntoChunks` → the upload flow; `headline` → the topic title; `author.name` → `source.author`; the URL → `source.url`; `publisher`/`datePublished` → `source.note`. The `v89_aj` provenance work built every one of those fields |
| **⚠️ BUT JSON-LD IS NOT RELIABLE ACROSS SITES** | Probed four more: `en.wikipedia.org` **0** `articleBody`, `derstandard.at` **0**, `bbc.com` **0** (an index page), and a `tagesschau.de` URL 404'd — *and its 404 PAGE still carried a JSON-LD block*, so "a block exists" is not "an article is in it" |
| **⚠️ AND THE GENERIC FALLBACK IS POOR AS IT STANDS** | Measured on the same page: pulling every `<p>` over 40 characters yields **897 words against the article's real 499** — roughly 45% navigation, section menus and promo teasers. **`cleanExtractedText` does NOT remove it**: that cleaner is tuned for PDF furniture (page numbers, bare dates, bare URLs, short unpunctuated fragments) and this noise is punctuated prose |

### So: how hard

- **The easy 70%, roughly a session:** a `/api/fetch-url` route (fetch, cap, follow redirects), JSON-LD
  `NewsArticle` extraction, provenance auto-filled, then hand off to the machinery the PDF/paste flow
  already uses. Works today on Corriere and most schema.org news sites.
- **The remaining 30% is a different project.** Beating 45% noise generically is the Readability
  problem — link density and text-to-markup ratio per node — several hundred lines, and this repo has
  no HTML parser at all.
- **⭐ The shape that fits this project:** take JSON-LD when it is there; otherwise show the extracted
  paragraphs in the **review card the comic and PDF flows already have** ("Review extracted text") and
  let the user drop the furniture. The review stop exists, the user already ruled it should stay, and
  it converts an unsolved algorithmic problem into two clicks.


### ⭐ MEASURED AGAINST THE PDF PATH, ON THE SAME ARTICLE (user, same session)

The user ran a **PDF book job on a "simplified print" of that very page** while this was being
answered, so the two routes can be compared on identical source material rather than in principle.
Chapter 1 of 3 (`tp_17887890461640000030`, 171 words — the article's 499 split three ways):

| | PDF path (what shipped) | URL scrape (what it would give) |
|---|---|---|
| **the body** | faithful — chapter 1's prose matches the article's opening word for word | identical text, from `articleBody` |
| **the headline** | ⚠️ lands INSIDE the chapter as body text, and **hard-wrapped mid-sentence**: `"…tutto pronto per l'arrivo di\n\nMattarella: «Alto Adige…"` — the print's line break read as a paragraph break | a separate `headline` field; the body starts at the first real sentence |
| **the standfirst** | ⚠️ also in the body ("Sabato la cerimonia ufficiale con…") | absent from `articleBody` |
| **the topic title** | derived by the model from text that already contained the headline | `headline`, exactly as published |
| **provenance** | `origin: user-pasted`, `model: (user-provided)`, **`source: null`, `sourceFile: null`** — nothing records where it came from | author "Andrea Dalla Serra", the URL, publisher "Corriere della Sera", `datePublished` — every one a field `v89_aj` already built |

**So the difference is not the prose — it is the METADATA and the furniture.** The PDF route loses the
article's structure (headline and standfirst become chapter 1's first sentences, one of them broken
mid-phrase) and records no provenance at all, because a printed page carries none. A URL knows who
wrote the thing, when, and where it lives. That is the argument for the feature, and a stronger one
than "less clicking".

### ⚠️ Three things to settle before building, none of them technical

1. **Paywalls.** This article's body was fully present; many are truncated server-side, and some sites
   serve it only to subscribers. The feature will sometimes return three paragraphs and a teaser, and
   should say so rather than generating a chapter from a stub.
2. **Copyright and terms of service.** Pulling a newspaper article into a personal learning corpus is
   a real consideration, and it is the user's call. Worth noting that the machinery to record it
   HONESTLY already exists: `source.author`, `source.url`, `source.licence`, `source.note` — the
   `v89_aj` provenance line renders on the landing card, the storyline page and the completion card.
3. **Live-only.** No server in the static build, so this joins the other backend-gated features.

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
   implicitly `a`, so the sequence is `v90_a` → `v90_b` → `v90_c` → … — the same convention the v69–v89
   lines ran. **This is the `v90` line.** Roadmaps are per BASE version, so point
   releases do not each get one — this file stays current through the whole v90 line.
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

*The incident behind each lives in **`roadmap_v89.md`**'s own entry for that release — this file
carries the rules, not the history.*

⚠️ **The eleven below were earned in the FIRST half of the line and were already written down. The
LATE half (`v89_z`…`v89_an`) earned six more, listed after them as 12–17; several are simply the
earlier rules failing again, which is itself the finding.**

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


12. **⚠️ DRIVING A FUNCTION PROVES NOTHING ABOUT THE BUTTON THAT CALLS IT** (`v89_ah`, and
    `v89_x` before it). The token popover's Save was broken in the MARKUP — `JSON.stringify` emits
    double quotes, they closed the double-quoted `onclick`, and the handler truncated to
    `_teSaveCorrection(`, throwing SyntaxError on every click. A full green suite meant nothing
    because every test called the function directly. **Assert on the RENDERED attribute
    (`getAttribute`, which decodes entities as a browser does), and run it through `new Function` so
    the claim is "the browser can execute this".** ⚠️ `v88_ai` had fixed the IDENTICAL bug on the
    button next door and never swept for a second instance — and its guard asserted the markup merely
    CONTAINED the function name, a substring present in the broken version too.

13. **⚠️ A DECISION BURIED IN AN EXPRESSION CANNOT BE TESTED** (`v89_af`, `v89_ag`). Twice, a
    mutation that flattened an inline ternary to `true` — restoring the reported bug exactly — left
    the suite GREEN. Both became NAMED functions (`pingFailureIsHard`, `cancelBookJob`) purely so
    they could be driven. **If a mutation of the fix leaves the tests green, the fix is not the thing
    the tests are about.**

14. **⚠️ FIX THE CLASS, NOT THE INSTANCE — AND ENUMERATE IT** (`v89_ak`). `v88_ag` claimed "all
    EIGHT formerly-blocking model routes are now listed"; it was wrong twice and a USER found it both
    times. The fix was a guard that WALKS every route and requires each model-backed one to be a job
    or carry a **reasoned** exemption. ⚠️ A first hand sweep misread three routes: **a wrong inventory
    is worse than none, because it retires the question.**

15. **⚠️ A SECOND SERVER ON THE SAME `lessons.json` SILENTLY REVERTS THE USER'S WORK** (`v89_aj`
    cut). Both processes hold the WHOLE store in memory and `saveStore` writes all of it, so it is
    last-write-wins over the entire file. A test server started at 10:13 held a 10:12 snapshot, the
    user's server translated three more chapters, and the next write from the test server reverted
    all three. **The user diagnosed it, not me**, after I had begun investigating it as a product
    bug. **Always `LESSONS_FILE=/tmp/x.json`.** ⚠️ `v89_ad`'s atomic writes do NOT help: `rename(2)`
    prevents a TORN read, not a LOST UPDATE.

16. **⚠️ A SYNCHRONOUS WAIT IN A TEST THAT IS WAITING ON A TIMER MEASURES NOTHING** (`v89_ae`,
    `v89_af`, twice in two releases). `execFileSync('sleep')` blocks the event loop, so the very
    `setTimeout` under test never runs and the section reads zero. Related: a stub that never settles
    leaves a poll timer pending, and the file prints ALL PASSED **and then hangs the whole suite**
    (`v89_ai`). Instrument `setTimeout` to list still-pending timers rather than guessing.

17. **⚠️ WHEN DECIDING SOMETHING IS UNUSED, THE DETECTOR IS THE FINDING** (`v89_an`). Three ways to
    be wrong, two of them hit live: `'prefix' + var` (nearly deleted five live scheme names) and
    `var + '_suffix'` (nearly deleted `ex.syn.q_*_n`, **the string the synonym prompt shows most of
    the time** — the USER caught it by asking for a check before deletion). And `grep`'s `.` is a
    wildcard, so `app.tagline` "matches" `app-tagline`: **match a key as a whole QUOTED string.**

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

---

# ✅ SHIPPED IN THE v90 LINE

*Entries go at the TOP of this section, newest first, and a merge conflict between two sessions'
work lands exactly here: resolve it by keeping BOTH entries, ordered by version.*

## ✅ v90_l — the "⚠ Ollama unreachable" flapping was IPv6 loopback, not the wlan

User, pasting a real book-job log: *"the laptop had lost contact to wlan, and it again lead to loss
of connection to ollama."* Reported across three releases and blamed on the network every time.
**It was never the network.** **ZERO `ui.json` keys.**

### The line that settled it

```
⚠ Ollama unreachable (2 checks, last: ECONNREFUSED after 2ms) — offline mode until it returns.
Translation failed: Ollama network: connect ECONNREFUSED ::1:11434
```

**`::1` is IPv6 loopback, and the refusal is 1–5ms.** A refusal that fast is the kernel saying
"nothing is listening here" — it is not a network timeout, and a packet never left the machine.
Measured on the reporting laptop:

| | |
|---|---|
| `ss -ltn` | Ollama listens on **`127.0.0.1:11434` only** — IPv4, no IPv6 socket |
| `http://::1:11434` | **ECONNREFUSED in 6ms** |
| `http://127.0.0.1:11434` | **HTTP 200 in 3ms** |
| the app's default | `http://localhost:11434` — a **NAME**, resolved on every single call |

So every call whose resolution landed on `::1` was refused instantly. **Which candidate the resolver
returns first is exactly what changes when an interface goes up or down** — which is why it looked
like the wlan, and why `v89_af`'s controlled wlan toggle honestly reported that it could not
reproduce the symptom: that test never made the resolver flip.

### The fix takes name resolution out of the hot path

The default is now the IPv4 **literal** in both `llm.js` and `server.js` — nothing to resolve,
no resolver state left to flap. And because an operator may already have
`OLLAMA_HOST=http://localhost:11434` in a shell profile, a loopback NAME additionally pins
`family: 4` on the request. ⚠️ **Only a loopback name**: a real host may legitimately be IPv6-only,
and forcing IPv4 there would break a working setup to fix one that is not in use.

All **six** request sites in `llm.js` carry the pin. One unpinned site reproduces the entire
symptom, because the flapping came from `ping()` while the failures came from the generators — two
different call sites.

### What this explains, in the user's own log

- The **flap**: dozens of unreachable/reachable pairs, alternating as resolution did.
- **Chapter 2 of 3 failed permanently** — three lesson attempts, all `ECONNREFUSED ::1:11434`, all
  inside one flap. The retry was immediate, so all three landed on the same broken resolution.
- Every `✓ reachable again` triggered `Warming up qwen3.6:35b-a3b…` — a real model load, repeatedly,
  for a fault that was never in the model.

⚠️ **The retry and warm-up behaviour is NOT fixed here** and is worth its own look: an immediate
3× retry cannot survive a fault that lasts longer than the three attempts take, and re-warming on
every transition is expensive when transitions are spurious. With the root cause gone they should
stop firing, which is the argument for fixing the cause first and measuring again before touching
them.

### The guard reproduces the failure rather than describing it

`unit-ollama-loopback.test.js` binds a server to **IPv4 loopback only**, exactly like Ollama, then
connects both ways: IPv4 succeeds, IPv6 gives `ECONNREFUSED` **in single-digit milliseconds** — the
timing that ruled the wlan out — and a loopback NAME with `family: 4` succeeds. It also pins that
every request site carries the pin and that a real hostname is left alone. Four mutations red: each
default reverted to `localhost`, one request site losing its pin, and the family pinned for every
host rather than only loopback names.

**This closes the item `v89_af` recorded as genuinely unresolved.**

Suite: **365 full / 303 quick** (one new file).

## ✅ v90_k — the i18n audit, re-derived: 86 certain, not 143

User: *"re-derive the i18n audit numbers properly."* **ZERO `ui.json` keys** — this release measures
and records; it adds no strings and changes no user-visible text.

### Why the first pass was wrong, and why a regex can never settle it

The client localizes through **at least four different idioms**: `_setAttr(id, attr, t(k))`,
`_setText(id, t(k))`, `set(id, el => el.textContent = t(k))`, and a bare
`const el = getElementById(id); if (el) el.textContent = t(k)` two statements later. A source scan
mis-classifies in BOTH directions — it called `fin-title` hardcoded (it is not) and
`topic-name-big` localized (it is assigned the topic NAME, which is user content). The first pass
also could not run `applyUIStrings` at all, so it guessed which markup literals were first-paint
FALLBACKS. That guess is what put the six library-sort labels on the list; they are keyed and
translated in 32 languages.

⚠️ **`lib-dom` did not model `<select>.options`**, and `applyUIStrings` walks them to localize the
sort menu — so the function threw in the harness and NOTHING about it was measurable. Adding
`.options` (standard DOM, one getter) is what made the re-derivation possible at all.

### The method, per class — and what each can actually decide

| class | how it is decided | result |
|---|---|---|
| **A. markup `title`/`placeholder` with an id** | ⚠️ **MEASURED.** `getElementById` AUTO-VIVIFIES, so an element the harness hands back starts BLANK. Run `applyUIStrings()` and ask for each id: a value present means it wrote there; nothing means the markup English is what a user reads | 63 candidates → 27 localized, 1 keyed-but-identical across en/de/fr, **35 never written** |
| **B. literals passed to `showToast`/`confirm`/`alert`** | Certain by construction — no fallback path exists for a literal argument | **10** |
| **C. markup text with an id** | Only partly decidable. Certain when NOTHING in the source ever addresses that element | 70 candidates → **10 certain**, 60 needing a per-element check |
| **D. literal `title`/`placeholder`/`aria-label` with NO id** | Certain — `applyUIStrings` addresses by id, so it cannot reach these | **31 distinct** (41 occurrences) |

**86 distinct certain findings. Plus 60 undecided** (class C's remainder); a hand-check of 27 of
them found roughly half genuinely localized, so expect ~25–30 more real ones.

Against the **143** the first pass reported. The number moved less than the composition did: that
143 mixed fallbacks, already-localized elements and un-ID'd duplicates together, and would have led
someone to spend keys on strings that are already translated.

### Roughly who reads them (judgement, unlike the counts above)

- **A learner, in normal play (~25)** — the generation screen's own progress text ("Building your lessons…", "Generating…", "Starting…"), the bottom-bar/settings/mute/mic pill tooltips, the speech-language and voice selectors on two screens, "Home", the completion card's explorer and read-aloud buttons, `confirm("Clear all lesson results for …")`, `alert("Please paste your story…")`, the three vocab-mode options.
- **A teacher authoring (~45)** — the whole dialect studio, the lesson editor's placeholders ("use ___ for the blank", "short reason the correct form fits", "the exact word as it appears above"), title/tag inputs, "Add choice"/"Remove choice"/"Delete", `confirm("Delete the … lesson…")`.
- **A maintainer (~10)** — "Rebuild docs/index.html", "Import lessons.json", "Teacher dashboard", "✓ docs/index.html rebuilt".

### The rule this earns

**An audit that cannot RUN the code it audits is a list of suspects.** Every wrong entry in the first
pass came from inferring, at a distance, what a function would do to a string. The classes that are
now trustworthy are exactly the ones where something is executed or where no mechanism exists at
all; the 60 that remain undecided are the ones where neither is true.

Guard: `unit-library-sort` now measures that the sort label localizes across en/de/fr and that every
option value maps to a translated key. Two mutations red — the harness losing `.options`, and an
option mapped to a key that does not exist.

Suite: **364 full / 302 quick**, unchanged.

## ✅ v90_j — the library sort did nothing in the static build

User: *"does the sorting on the main page fully work in static, including the reverse button?"*
**No — it did not work at all**, and every existing check missed it because every existing check
drives `index.html`. **ZERO `ui.json` keys.**

### What was actually wrong — three layers, each hiding the next

| | |
|---|---|
| **the controls were dead** | `onLibSortChange` and `onLibSortDirToggle` were defined ABOVE `@static-exclude-start`, so `docs/index.html` rendered the `<select>` and the ▼ button and neither function existed in its bundle. Every click was a `ReferenceError`. Measured by loading the built artifact: both `typeof` → `'undefined'` |
| **the static list had its own ordering** | `build-static.js` re-implements `loadSavedList`, with a hardcoded "newest first" that never read `APP.libSort` — plus, whenever no language filter was set, a SECOND re-sort grouping by target language that would have overridden the chosen key even if the handlers had existed. The standing "`build-static.js` re-implements client functions" trap, third time it has cost a release |
| **⚠️ and the token key would still have compared zeros** | `tokensOfTopic` reads `t.tokens` — a scalar the LIVE `/api/lessons` projection SUMS. A stored topic carries `generationStats`, not `tokens`. **`v88_j`'s own comment beside that projection says the static build "ships whole topics and has the field for free"; it does not**, and measuring settled it: **0 of 355 baked topics carried a `.tokens`**. That comment is corrected in place |

### The fix is the one this project keeps arriving at

`_libSortInto(storylines, orphans, byIdAll, slArr)` moved BELOW `@static-exclude-end`, with the two
handlers, and **both** list builders call it — rather than teaching the copy a new trick. The token
sum falls back to `generationStats` when the projected scalar is absent, so it needs no new baked
field and cannot drift from the projection. `build-static.js` lost its two private sorts, and its
flag headers now follow the same `v88_u` rule as live: a header claims the list is grouped by that
language, so it is emitted only when the chosen key IS a language key.

⚠️ Two traps hit on the way, both already in this project's notes: a **backtick inside a comment
that lives in a template literal** (build-static.js emits its client as a string), and a comment
line beginning with `// @static-exclude-start`, which `unit-static-markers` counts — it must appear
on exactly one line.

### The guard drives the BUILT ARTIFACT

`unit-library-sort`'s new section loads `docs/index.html`, seeds `LANGS` (populated by `init()`,
which the harness neutralises — without it the card renderer throws for reasons unrelated to
sorting, on any build), and drives the real `loadSavedList` across four keys and both directions.

⚠️ **The token assertion had to be rewritten after mutation-testing.** The first version said "the
token order differs from the date order", and that **survived** removing the fallback: with every
chain scoring 0 the comparator returns 0, a stable sort keeps the incoming order, and that order
happens not to match the date order either. It now computes an ORACLE from the baked corpus — which
storyline actually spent the most — and asserts that card leads, and that reversing puts the
smallest spender first. Four mutations red: the static build dropping the shared sort, the token
fallback removed, the direction ignored, and the reverse handler leaving the bundle.

### ⚠️ AND A CORRECTION TO MY OWN AUDIT, IN THE SAME BREATH

The task was *"fix the sort and key its six labels"*. **The six labels never needed keying.**
`lib.sort_lbl`, `lib.sort_edited`, `lib.sort_created`, `lib.sort_tokens` and the two reused
`gen.story_lang_source`/`_target` already exist, are wired in `applyUIStrings`, and are translated
in **32 languages** — in both builds. The English in the markup is the first-paint FALLBACK.

I had named that exact class — "28 markup literals are only fallbacks, not findings" — in the same
message where I then listed the sort row as hardcoded. **A scanner's output is not an inventory
until every category it warns about has been applied to its own list.** The remaining i18n figures
from that audit should be re-derived the same way before anyone works from them.

Suite: **364 full / 302 quick**, unchanged.

## ✅ v90_i — the last English label in that menu, and a table that keeps it that way

User: *"go ahead and add the key for the QC button"* — the one title `v90_h` left English because no
existing key fitted. **ONE granted `ui.json` key.**

`qc.story_btn` = `"Proofread with QC model"`, the exact string the button already carried, so nothing
changes for an English reader. Named for its sibling and **inserted directly after it in `ui.json`**,
so a translator meets the pair together: `qc.summary_btn` "Proofread summary with QC model" and
`qc.story_btn` "Proofread with QC model". One-line diff.

⚠️ **The guard now walks the MENU, not a list of four.** `unit-storyline-edit-menu` §7 reads
`_EDIT_MENUS['ls-story'].rows` and fails if any row's button is not in its table of `t()`-backed
titles — so a sixth control added to this menu with a hardcoded title cannot repeat `v90_g`, where
four English tooltips became four English labels the moment they moved. The "already translated in
20+ languages" half stays scoped to the four REUSED keys: holding a freshly granted key to it would
go red on a string the user has not translated yet.

Two mutations red: the QC title losing its `t()` wiring, and a sixth row joining the menu with no key.

Suite: **364 full / 302 quick**, 741 `en` keys.

## ✅ v90_h — the menus read English in every language, and a stamp claimed what the record did not

User: *"the text 'Re-translate (after fixing the story text)' is not in ui.json? We can delete the
'(after fixing the story text)' part and just re-use an existing 'Translate' ui entry."*
**ZERO new `ui.json` keys** — four titles, four keys that already existed.

### ⚠️ The user found a regression `v90_g` introduced and I did not notice

Four of the story row's five button titles were hardcoded English in the markup. Until `v90_g` that
cost only a **tooltip**, which nobody reads on a touch screen. Then the buttons moved into an edit
menu, where `_editMenuSync` takes each row's label **from that button's own `title`** — so the
title became THE VISIBLE ROW LABEL and the whole menu read English in every language. The mechanism
that made the relocation cost zero keys is the same one that made this worse.

| button | now takes its title from | value |
|---|---|---|
| 🔬 explorer | `text_explorer.toggle_title` | an EXACT match — the same sentence, already keyed |
| 🔤 analyse | `gen.post_gen_analysis_lbl` | exact, plus a leading 🔤 the row label strips anyway |
| ✏️ edit story | `lesson.edit_story` | exact |
| 🔄 re-translate | `models.translation` | the user's own instruction. It is also the string `retranslateStory` **already** labels this call with in the jobs popover, so the menu row and the running job now say the same word |

Verified by rendering: `de` gives *"Wörter für den Text-Explorer analysieren · Geschichte bearbeiten ·
Übersetzung"*, `fr` gives *"Analyser les mots pour l'explorateur de texte · Éditer l'histoire ·
Traduction"*. **⚠️ One title has no existing key and is left English:** the 🔍 QC button's *"Proofread
with QC model"*. `qc.summary_btn` is the summary's version of the same string; the story's never got
one. Flagged rather than silently spending a key.

### ⚠️ `lib-dom`'s setAttribute did not reflect onto properties

`_applyUIStrings` writes tooltips with `setAttribute('title', …)`; `_editMenuSync` reads `btn.title`.
In a browser those are one value. In the harness the runtime `setAttribute` stored the attribute and
left the property empty, so **every label read as blank while being correct in the app** — the check
could not have been written at all. Parsed markup already reflected (`applyParsedAttribute` does it);
only the runtime path did not. Now both do, for the attributes `PROP_ATTRS` already declares. That is
the DOM's own behaviour, so it is a harness bug fixed, not a product concession.

### ⚠️⚠️ AND A REAL DEFECT IN `v90_g`, CAUGHT BY THE CORPUS

`unit-translation-stamp` went red on the user's OWN library, within the hour, on the first chapter
they edited: **`tp_17886338472190000441`, "Government Boast"**.

`/api/save-translation` stamped `translationMeta.origin = 'user-provided'` and wrote only
`storyTranslation`. But the corpus invariant is *"origin `user-provided` ⇒ the topic carries
`userTranslation`"* — the field that holds a translation a person supplied. **The stamp claimed a
human wrote the text while the record showed nobody had.** The text itself was saved correctly and
the feature worked; the provenance was the lie.

| | |
|---|---|
| **the fix** | The route sets `userTranslation` too. It is read at GENERATION time (it feeds the lesson prompts); on an existing chapter it is inert, and if that chapter is ever rebuilt this is exactly the translation to build from |
| **the existing row** | A boot heal in `fixMetaSource`'s pass, firing on that one shape only: origin `user-provided`, no `userTranslation`, a `storyTranslation` to take it from. Idempotent, and self-limiting because the route no longer produces the shape |
| **⚠️ the user's copy is still red until they restart** | The heal runs at boot and their server was down. Their `lessons.json` is uncommitted working data and I did not touch it — after the incident earlier in this line where a second server of mine clobbered their translations, writing to their store unasked is the wrong instinct |
| **guards** | `e2e-translation-edit` §2 now asserts the record backs the claim, and §4b seeds both the broken shape and a GENERATED translation and boots a second server: the first heals, the second is left alone. Two mutations red (the route dropping the field; the heal widened to fire on generated rows) |

### The containment trap, third time in one session

The guard for "the parenthetical is gone" scanned the whole file for the phrase — and fired on the
source's own comment, which QUOTES the user's request. Restated against the delimited value
(`title="…"`), with a self-check that the pattern really matches the shape it is looking for.

Suite: **364 full / 302 quick**, unchanged.

## ✅ v90_g — five user requests: three pencils, an editable translation, and a broom

Five items in one batch. **THREE new `ui.json` keys, granted by the user** (`translation.opt_edit`,
`translation.opt_regen`, `toast.translation_saved`) — the other four cost none.

| the request | what shipped |
|---|---|
| *"hide the lesson-set page story view buttons behind an edit (pencil) icon: the text-analysis, the edit story button, the QC button and the re-translate button"* | 🔤 / ✏️ / 🔍 / 🔄 relocated into `#ls-story-edit-pop`. ⚠️ **Asked which button "the text-analysis" meant** — the row holds both 🔬 (the explorer, a reading aid) and 🔤 (the button that RUNS the analysis) — and the user chose 🔤. 🔬 and 💬 stay in the row: those are what a learner uses, and the explorer works with no backend at all |
| *"merge the two edit buttons … into an edit menu (pencil icon), same as the edit menus of other levels"* | ✏️ Edit title + ✨ Generate title behind `#ls-title-edit-pop`. 🔗 share stays out, matching the user's own exclusion of share/play from the storyline header's menu |
| *"move the 'generate summary' button … to a new edit menu of the summary with two options: manual edit and generate, using the three stars icon, and QC"* | The summary row's ✏️ and 🔍 joined by the relocated generate button — **the same control, same id** (`genStorylineSummary` finds it by id to show ⏳ while it runs), now wearing ✨. Built with `_cardEditPopHtml`, the card variant of the same popover |
| *"allow to edit translations on lesson-set pages (teacher view) … an option of the re-translate button"* | 🔄 opens a choice; with no translation yet it goes straight to the model, because a dialog whose only real option is the one you pressed is a dead control |
| *"the 'clear progress' button on the lesson-set page should be a 🧹 icon, as in other buttons with the same function"* | ↺ → 🧹, joining `#comp-wipe` and `#sl-bottom-clear`. Its tooltip came along: a hardcoded English literal beside two translated siblings, now `t('chapter.clear_progress')` — already translated, no key |

### One mechanism, not three copies

`_slEditMenuSync` became **`_editMenuSync(key)` over a registry**, because there are three of these
menus now. One table states which controls belong to which menu instead of leaving it to markup
archaeology, and a fourth menu costs a table entry rather than a third copy of the walk. All three
mirror their buttons rather than re-deciding visibility, take each row's label from that button's own
`title` (hence zero keys), hide the pencil when every row is hidden, and — new — **only one is open
page-wide**, which matters because the two lesson-set pencils sit a few hundred pixels apart.

### The translation editor

It is the STORY editor with one flag. Two nearly identical editors is the duplication this project
keeps having to undo (two QC functions, two voice rankers, two pass-mark controls), so
`APP._storyEditMode` decides where Save sends the text and everything else is shared.

| | |
|---|---|
| **its own route** | `/api/save-translation`, not a field on `/api/save-story`. That route's body sets `aiStory` on first save, **collapses an edited story into a single comic panel's caption**, invalidates curator corrections keyed on sentence text, and regenerates the AI error hunt — all four about the TARGET story. Running them for a source-language edit would rewrite a comic caption with prose from the other language. `e2e-translation-edit` §3 is the assertion that keeps them apart |
| **no backend gate, no job** | A person typing must not depend on the model being up |
| **the stamp** | A hand-edited translation is credited to `(user-provided)` with origin `user-provided` — the corpus invariant `unit-translation-stamp` asserts is "every stamp records where its value came from", and this one came from a human |
| **the details that needed deciding** | The panel switches to the SOURCE language first (editing the translation while the target text is shown would save the wrong language over it); the explorer is turned off (it marks up the target text); the AI-hunt live diff is suppressed; and the mode is cleared on save AND on cancel, or the next story edit would save into the translation |

### ⚠️ I destroyed my own work mid-task and had to rebuild it

A mutation helper written inline used **`git checkout -- index.html` to restore the file between
mutations**. That restores from the INDEX, so it discarded every unstaged change in the working
tree — all four UI tasks, in one command. Rebuilt from the transcript; `server.js`, the tests and
`ui.json` were untouched, and the rebuilt file was verified byte-identical to the pre-mutation copy
afterwards.

The project already had the right pattern: `mut.sh`, written earlier in this same line, restores
from a **byte copy** taken before the edit. **A restore step must never be a VCS command** — the VCS
does not know which changes were the mutation and which were the work.

### Guards

Nine mutations red: the icon reverting to ↺, the editor seeding the story instead of the
translation, the save routed to `/api/save-story`, the edit mode never cleared, the 🔄 dialog shown
when there is nothing to choose, the route also overwriting the story, the route dropping its trim,
a menu leaving the registry, and an emptied menu staying open. Two existing guards fired on the way
and were right both times — `unit-can-edit-teacher-mode` §4 caught the generate row being written as
`_canEdit() && canGenerate` (it re-runs one LLM call, like QC and re-translate, and carries no
teacher gate), and `unit-static-summary-edit` caught the pencil's gate moving; the latter pinned a
source PHRASING and was restated against the entry's own `on:` clause. ⚠️ While rewriting it I hit
the containment trap **inside the guard for it**: scanning the whole entry for `_canEdit()` matched
the source COMMENT that says "NOT also `_canEdit()`".

Suite: **364 full / 302 quick** (one new e2e), 740 `en` keys.

## ✅ v90_f — the last four zeros: the orchestration functions, driven

User: *"go ahead with the remaining four"* — `doDialectImport`, `renderEx`, `startLesson` and
`goLessonSet`, the four the `v90_e` entry set aside as "a different job". **ZERO `ui.json` keys.**
No app behaviour changed; every edit is in `test/`.

| function | before | after |
|---|---|---|
| `startLesson` | 0/10 | **10/10** |
| `goLessonSet` | 0/10 | **8/10** |
| `doDialectImport` | 0/20 | **20/28** |
| `renderEx` | 0/20 | **19/28** |

### Why it really was a different job

These close over most of the client and their branches are language-context switches, screen
transitions and render dispatch — the lift-and-drive pattern every earlier repair used cannot reach
them. They are driven through `lib-dom`'s `loadClient`, which loads the whole client into a vm
sandbox with a real-enough DOM. **The claims asserted are the ones their own comments record as
user-reported bugs**, which is why those branches exist at all.

| | |
|---|---|
| **`goLessonSet` — three languages, not one** | The chrome language, the UI language and the TARGET language are separate, and this is the one choke point every entry into a lesson set passes through. Now asserted: a standalone topic takes all three with it; **a STORYLINE chapter with "keep fixed" ticked does NOT move the UI language** but records `_slLangMismatch` (the reported bug — this function is also the plumbing every "next chapter" transition runs through, so its old unconditional follow silently overrode the setting on every chapter change); the footer selector agrees with `APP.srcLang`; and a chapter that records no target language leaves `APP.lang` alone rather than assigning `undefined` over it and taking the RTL flags with it |
| **`startLesson` — the return value IS routing** | `loadSaved` routes on it, and a silent `false` strands a learner on a page they must never see (`v68.1`). Now: a hidden lesson refuses for a learner and opens for a teacher, an unpoolable `mixed` lesson refuses instead of opening an empty player, and each type reaches its own renderer and only its own. Plus the per-round resets, each a real defect — a wrong-set that used to accumulate across the whole session (so drilling a word you had missed INCREMENTED its wrong count), a stale review flag, a stale answer ledger, and a mic left listening from a previous lesson (`v85_b`) |
| **`renderEx` — the crash a user hit** | `v88_r`: a speech-advance timer from the previous round landing after the learner has browsed to a review card. That synthetic `C` has `_review:true`, an empty exercises array and **no `cur`** — and `C.cur >= length` is false for `undefined`, so the stray call went straight through to `C.exercises[undefined].type`. Now a no-op, asserted. Also the **drill teardown** (`v71_h`/`v71_n`, reported as *"studiare asked over and over"*): the ledger is written while the drill lesson and its wrong-set both still exist, the real topic comes back, and the card shown is the real chapter's; the **word-tap detour** (item Z) resumes forward progress instead of parking on a card, fires once, and falls back to the normal card when nothing was captured; and a listening question speaks its target — or **queues it for the audio unlock rather than dropping it** |
| **`doDialectImport` — behaviour, where there was a regex** | The `v85_h` fix (send the pair actually selected, not a hardcoded `de`/`de`) was pinned by the strings `base:APP.lang` and `source:APP.srcLang` appearing in the source. Now the request body is read: all three refusals happen **before anything is sent**, a server error surfaces the server's own reason and does **not** reload the library, the parse report caps its list at ten and **escapes** the raw source line, and — the part no post-hoc assertion can see — ⚠️ **while the request is in flight** the button is disabled, the status says so, and the previous run's report is cleared, so it cannot be read as this one's result |

### ⚠️ What the remaining survivors are, and why they are not chased

Nearly all of them are `if (el)` null guards mutated to `true`, and **`lib-dom`'s `getElementById`
AUTO-VIVIFIES a miss** — the element is never null in this harness, so those mutants are equivalent
*here* by construction. The rest are `typeof x === 'function'` guards and `→ true` masks on
conditions the fixtures already satisfy. `renderEx` also keeps two for `_glyphOrderActive`, which
needs a no-keyboard glyph-ordering fixture; `unit-no-keyboard` covers that path separately.

**This closes the audit.** Four passes: `v90_b` (17 mutations, 9 survivors, 7 files repaired),
`v90_c` (its remainder, 4 of 7 false positives), `v90_d` (the same-answer blind spot, 86 functions /
1000 mutants / 14 zeros), `v90_e` (five zeros repaired, three never gaps, one probe bug), and this.
`tools/branch-mutation.js` and its guard remain, so the measurement is repeatable rather than a
number in a document.

Suite: **363 full / 302 quick** (one new file).

## ✅ v90_e — the remaining zeros: five repaired, three were never gaps, and the probe itself was wrong once

User: *"go ahead with the remaining zeros"* — the fourteen functions `v90_d` measured at 0 caught.
**ZERO `ui.json` keys.** No app behaviour changed; every edit is in `test/` and `tools/`.

### ⚠️⚠️ FIRST, A CORRECTION TO `v90_d`'s OWN NUMBERS

`tools/branch-mutation.js` discovers which tests lift a function by looking for the extraction
helper — and it only knew `ext`, `extract` and `extAsync`. **The suite also uses `lift`.** So
`qcProse` was attributed to `unit-qc-correct` alone and scored **0/16**, while
`unit-qc-unify-parity` had been lifting and running it the whole time. Re-measured with the right
guards it was **7/16**, never zero.

**A missed helper name inflates the zeros** — the direction that wastes a session chasing a guard
that is already there. The pattern is now `(?:ext|extract|extAsync|lift)`, pinned by
`unit-branch-mutation-tool` §5 (mutation: drop `lift` → red). `fn(` and `grab(` look like helpers
and are deliberately NOT in the list: `fn` is what the built function is usually assigned *to*, and
`grab` is a selector helper.

### Every zero escalated to the whole `--quick` suite before being called a gap

The `v90_c` rule, applied. ⚠️ **One representative mutant each, and every `index.html` mutant also
reddens `unit-static-freshness`** (the file's hash moves and `docs/` is not rebuilt) — that one
failure is subtracted throughout, and it names `index.html` as the stale file in every case.

| | |
|---|---|
| **caught elsewhere — not gaps at all (3)** | `onUseDialectCb` (by `unit-comic-panel-ui`), `_renderCompStory` (by `unit-story-translation-toggle` **and** `unit-text-explorer`), and `qcProse` once its real guard was attributed to it |
| **⚠️ MY OWN v90_d PREDICTION WAS WRONG** | That entry guessed `renderEx`, `startLesson`, `goLessonSet` and `loadSaved` were "almost certainly" covered by `smoke-render` and the journey tests. `smoke-render` IS in `--quick`, and it caught **none** of them. The guess was reasonable and it was wrong; the measurement is what settles it |

### Five repaired, each mutation-tested afterwards

| function | before | after | what was unguarded |
|---|---|---|---|
| `qcProse` | 7/16 | **15/16** | the entire ERROR path: a cancel must propagate and never retry (`v88_k`), heavy surfaces a model error while light retries and hands the input back untouched (deliberate — light runs unattended inside the extraction job, where a throw costs the panel its transcription), the retry feedback naming what was wrong, the script pin being heavy+story only (`v79_f`), and empty input refused before any request goes out. A captured RETURN VALUE cannot record a throw, which is why the parity fixtures could not reach any of it |
| `_sbMarkCurrentPanels` | 0/8 | **8/8** | that the current chapter's panels are framed, that a stale `data-chapter` is clamped, and — the one that matters — that moving on CLEARS the previous frame. Without it every chapter ever visited stays highlighted |
| `openStoryboardChapter` | 0/6 | **4/6** | that a click opens the chapter that was clicked, clamps above and below, and refuses an unresolvable storyline without leaving a storyline context behind. The two survivors are a mutually-masking defensive pair — `!chaps.length` and `!target.chapter` each catch what the other would let through, so neither is individually killable |
| `_editorReadInputsMath` | 0/6 | **6/6** | it was compiled into the sync harness and dispatched on every math fixture — against a `document` that answers only `lesson-editor`, so the body was a no-op. Now: numbers parsed and filtered (0, negatives, junk dropped), operators keyed by char code so `×` and `÷` survive, and **an empty field LEAVES THE STORED VALUE ALONE** rather than writing `[]` over a working lesson |
| `_applyUploadCleanup` | 0/8 | **7/8** | "lossless both ways" is the 🧹 checkbox's whole promise and was guarded by a regex over the line implementing it. Now: unticking restores the pristine text byte for byte and the pages as a COPY, a plain-text upload keeps `pages` null, and the console report — added on a user request in `v69_p` because "the only evidence was the text looking different" — is asserted, ⚠️ **including that its counts are the FULL TEXT's and not the last page's**, which is exactly what `_fullStats`' capture position between the two cleans exists to guarantee |
| `_buildGlobalTtsSelectors` | 0/14 | **13/14** | the menu that picks the reading voice. Now: it waits (retry, or `voiceschanged` once) instead of rendering an empty menu, one entry per distinct TTS code with the active language leading, a saved voice preselected **unless the system no longer has it**, the voice menu hidden when there is nothing to choose while `APP._ttsVoiceName` is still adopted, a half-built DOM rendering nothing rather than throwing, and the pill state refreshed exactly once per successful build |

### Still open, and why they are a different job

`doDialectImport` (0/20), `renderEx` (0/20), `startLesson` (0/10), `goLessonSet` (0/10) — all
confirmed gaps against `--quick`. They are large orchestration functions whose branches are about
screen transitions and DOM assembly, so guarding them means journey-level fixtures rather than the
lift-and-drive pattern used above. Worth doing; not worth pretending it is the same task.

Suite: **362 full / 301 quick** (unchanged — no new files).

## ✅ v90_d — the blind spot: guards that run the right code on a fixture that cannot disagree

User: *"the blind spot next: guards passing on same-answer fixtures"* — the limitation `v90_b` and
`v90_c` both named and neither could see. **ZERO `ui.json` keys.**

`v90_b`/`v90_c` asked *is this function executed at all*. This asks the harder question: **does the
guard notice when it behaves differently?** New probe, `tools/branch-mutation.js`: rewrite each
`if (cond)` inside a function to `true`, then to `false`, and run the tests that LIFT that function.
A guard that catches none of its function's mutants has a fixture whose answer never moves.

**86 functions, 1000 mutants, 463 caught (46%). Fourteen scored ZERO.**

| function | caught | lifting guard |
|---|---|---|
| `doDialectImport` | **0/20** | `unit-dialect-panel` |
| `renderEx` | **0/20** | `unit-student-flags` |
| `_splitLongUnit` | **0/20** | `unit-pdf-chunking` |
| `onUseDialectCb` | **0/16** | `unit-dialect-panel` |
| `qcProse` | **0/16** | `unit-qc-correct` |
| `_renderCompStory` | **0/14** | `unit-learner-nav` |
| `_buildGlobalTtsSelectors` | **0/14** | `unit-tts-no-approximation` |
| `startLesson` | **0/10** | `unit-drill` |
| `goLessonSet` | **0/10** | `unit-drill` |
| `_applyUploadCleanup` | **0/8** | `unit-pdf-cleanup` |
| `_sbMarkCurrentPanels` | **0/8** | `unit-storyboard-nav` |
| `_editorReadInputsMath` | **0/6** | `unit-editor-sync` |
| `provLineForChapters` | **0/6** | `unit-provenance-fields` |
| `openStoryboardChapter` | **0/6** | `unit-storyboard-nav` |
| `_speakAndAdvance` | **2/18** | `unit-tts-no-approximation` |
| `generateErrorHunt` | **2/16** | `unit-error-hunt-validation` |
| `saveProvEdit` | **2/16** | `unit-provenance-fields` |
| `_sentenceSplit` | **1/8** | `unit-pdf-chunking` |
| `_provSrcBits` | **1/8** | `unit-provenance-fields` |
| `_ttsRankVoices` | **1/8** | `unit-tts-allcaps` |
| `confirmQuit` | **2/14** | `unit-learner-nav` |
| `_resolveExItemEntry` | **3/20** | `unit-coverage` |
| `buildStandardExercises` | **4/20** | `unit-apply-cp-lessons` |
| `chainGlyphSet` | **2/10** | `unit-intro-script` |

*(worst 24 of 86; the full ranking is regenerable — `node tools/branch-mutation.js --discover`)*

### ⚠️ What a zero here does and does not mean

It means **the guards that lift this function do not notice**. It does NOT mean nothing in the suite
notices — `v90_c`'s suspect list was 57% wrong for exactly that reason, and `renderEx`, `startLesson`,
`goLessonSet` and `loadSaved` are almost certainly in that category (heavily exercised by
`smoke-render` and the journey tests, which never mention them by name). Escalate before calling a
zero a coverage gap. Two mutants also can never be killed and are not findings: an EQUIVALENT mutant
(the condition has no observable effect) and one whose condition is constant in this environment.
**Judge the survivor list; do not just count it.**

### Two clusters repaired, both confirmed by measurement first

| | |
|---|---|
| **`_splitLongUnit` 0/12 → 20/24** | The PDF sub-splitter. Both pdf test files compile and CALL it, and `unit-pdf-paragraphs`' article really does contain sentences past the 300-character budget — confirmed by making the over-budget path throw and watching that file go red. **It ran, and nothing asserted anything that moves with it**: the word-count invariant those files rest on is invariant under WHERE the cut lands. Its `frag`/`fragFirst`/`fragLast` flags — which exist so an excerpt is not shown as a whole sentence, the defect the source records against `_synContext` — had no assertion at all. Now asserted: a clause boundary beats a later word gap (giving up 22 characters of budget to break where the sense does), cuts land only on EXISTING whitespace so `l'aria` and `30-32` survive whole, the Arabic `،` works with nothing hand-written, a whitespace-free script is left whole rather than cut mid-word, the progress guarantee holds, and no blank unit is emitted. Of the four survivors left, `if (piece)` is **unreachable** — 200k whitespace-heavy random inputs never produced an empty piece — and the rest are equivalent under Node; `if (tail)` WAS reachable and a search found the witness |
| **the provenance renderers 3/20 → 20/20** | `unit-provenance-fields` uses `ext()` as a SLICING tool and never feeds it to `new Function`: every claim about the rendered line was a regex over the function's own source. So the licence suffix, the host-name fallback, the DOI resolution, the sourceFile fallback, the note gate, the source dedup, the three-source cap and its `+N` counter could all have broken silently — **the display rules the user asked for by name**. Now rendered and compared, including the whole `from:` segment rather than a containment check (a containment check passes on a duplicated source too) |

### ⚠️ A real bug fell out of it, reported by the user mid-audit

`node test/run.js --quick` failed `unit-library-sort` and `unit-text-explorer` with the tree and the
suite both fine. Two different truncated-file races, and only one of them was mine:

- my probe rewrote `index.html` with a bare `writeFileSync` — thousands of times, 7MB each. **Fixed**: the shipped tool writes temp+rename, and long sweeps run on a copy.
- **`translate-ui.js` wrote `ui.json` with a bare `writeFileSync` at four sites**, after every batch, for hours, with `--threads 5`, while the server, `build-static.js` and the suite all read it. `unit-atomic-write` §4 already forbids bare writes in `server.js`/`learners.js` and exempts *"a one-shot maintenance script — a human runs it, one at a time, and re-runs it on failure"*. **The translator is none of those things.** The exemption is about a live reader, not about the word "script". All four sites plus the `languages.json` one now go through `writeFileAtomic`, and §4's set includes the translator with the reasoning; 3 mutations red. ⚠️ It rippled: `unit-langnames` copies `translate-ui.js` into a temp dir and ran it there, so the new `require('./atomic-write')` failed with *Cannot find module* — four copy sites updated, and the harness now carries a note about it

### The probe ships, and it is guarded

`tools/branch-mutation.js`, with `unit-branch-mutation-tool.test.js`. **A measuring instrument needs
a guard more than most code, because its failure is inverted and silent**: if `ifSites` stops finding
branch points the probe reports 0 mutants, and 0 mutants prints as *100% caught* — it would tell every
future session the suite is perfect.

⚠️ **And that guard was itself same-answer twice, on the first try.** Mutating the tool: deleting the
identifier check stayed GREEN (the fixture used `const gif = 1`, which the scanner rejects at the
missing paren anyway — only an identifier ENDING in `if` and followed by ` (` discriminates), and
replacing the paren-matching scan with `indexOf(')')` stayed GREEN (the assertion counted sites
instead of checking the span). Both fixed, five mutations now red. The trap is not exotic and
knowing about it is not protection — write the fixture, then break the code and watch.

Suite: **362 full / 301 quick** (one new file).

## ✅ v90_c — the audit's remainder: 3 of the 7 were real, and the migration script is now RUN

User: *"go ahead with the remaining seven"* — the follow-up list `v90_b` left in the session prompt.
**ZERO `ui.json` keys.** No app behaviour changed; every edit is in `test/`.

Seven mutations, one per named target, same protocol as `v90_b` (targeted guard → every test that
names the symbol → the whole suite for anything still green).

### ⚠️ FOUR OF THE SEVEN WERE FALSE POSITIVES — and the correction matters more than the list

| target | verdict |
|---|---|
| `showComplete` | **CAUGHT** by four tests that never name it |
| `callLLM` (the reasoning-safety delegation) | **CAUGHT** by `unit-story-context` |
| `sourceFingerprint` | **CAUGHT** by `unit-static-freshness` — but only once `docs/` is rebuilt, which is the only state in which the defect exists at all |
| `fixMetaSource` | **CAUGHT** by `unit-meta-source-heal`, which boots a server against a synthetic UNHEALED store. A proper end-to-end guard that my screen could not see, because it never mentions the function by name |
| `_renderCompStoryboard` | **not a finding at all** — it is an ABSENCE guard (the renderer was deleted in `v81_q` and must stay deleted). The scan read "asserts about a function it never runs" and could not tell a removal guard from an existence-only one |
| `scriptLessonAvailableForSet` | **not a finding** — that block already reasons explicitly about why a count is a bad proxy, and `v90_b`'s own mutation of it was caught |

**The lesson is about the screen, not the guards.** A static screen that says "this file names a
function and never calls it" produces a list of SUSPECTS, and the suspect list here was 57% noise.
Three of the four were cleared only by the FULL-SUITE tier — the cheap middle tier (run every test
that mentions the symbol) cleared none of them, because the guards that catch them are named after
the behaviour, not after the function. **A screen's output is not a finding until the whole suite has
been given its chance to disagree.** The `v90_b` prompt published that suspect list as a to-do; this
entry corrects it.

### The three that were real — all in `backfill-provenance.js`

| | |
|---|---|
| **what survived** | `classifyOrigin` → a constant, `flagValue` → a constant, `stampTranslationMeta` → `false`. **All 360 checks green for each.** The script could have started labelling every story's origin identically, silently swallowing a `--resolve`, and writing no translation stamps at all |
| **why the guards were text** | `unit-story-stamp` §8 and `unit-translation-stamp` §4 assert this script as source: the string `copyFileSync(FILE, FILE + '.bak')` appears, the string `dry run` appears, `function flagValue(flag, i)` is declared. There was a reason — the script does `const data = JSON.parse(fs.readFileSync(FILE))` at MODULE SCOPE and `FILE` is `path.join(__dirname, 'lessons.json')` with no env override, so it cannot be `require`d in a test without running against the real corpus |
| **and it is not dead code** | It still takes `--write`, `--verify`, `--resolve`, `--assume` and `--set-model`. Its rails are what stand between a re-run and a corrupted `lessons.json` |
| **the harness** | `unit-provenance-migration.test.js` **copies the script into a temp directory beside a synthetic store** and runs it as a subprocess, so `__dirname` does the rest. No change to the script was needed to make it testable — which is worth saying, because "add an env override so it can be tested" would have edited a migration to suit its test |
| **what is now proven by running it** | dry run is the default and touches nothing; `--write` takes the `.bak` from the PRE-run bytes; five origins come out **distinguishable** (`file-upload` carries its `sourceFile`, `user-pasted` does not, `dialect-rewrite`, `generated`, `unknown`) and an uploaded story is credited to `(user-provided)`, never to a model; four translation stamps likewise; a second run says *"nothing to do"* and does not reformat the file; an existing stamp is never re-derived; a malformed `--resolve`/`--set-model`/`--assume` exits 2 **and writes nothing**; an untagged model name or an unstampable topic refuses the write **all-or-nothing**; and `--verify` ignores rows the script itself wrote |
| **⚠️ one ordering fact worth pinning** | A single-model label backfills `generationStats.models` on the STORY path, before the translation stamp runs — so such a row's `translationMeta.model` is the recorded label, not `(unknown)`. I predicted `(unknown)` writing the test and the script said otherwise; the assertion now records the real order |
| **mutations** | 8 red: the three constants above, plus the `.bak` taken AFTER the write (a worthless backup), a dry run that writes anyway, a write that proceeds past unstamped topics, `--verify` counting its own output as evidence, and an existing stamp being re-derived |

Suite: **361 full / 300 quick** (one new file).

## ✅ v90_b — a mutation audit of the SUITE: two guards were testing themselves, nine more proved empty

User: *"go ahead with the vacuous-guard mutation audit"*. **ZERO `ui.json` keys** (the user was still
translating; the file was not touched). No app behaviour changed — every edit here is to `test/`.

The standing rule says *mutation-test every guard you write*. It had never been applied BACKWARDS, to
the guards already standing. This does that, and the suite came out worse than expected.

### Method

A static screen first, over all 355 test files: which guards assert against **app source text** with
no execution at all (166 files do somewhere), and — the sharper cut — which assert *that a function
EXISTS* and never run it (**16 files**). Then 17 semantic mutations of the real behaviour behind
those claims: each applied to `index.html` / `server.js` / `llm.js`, `docs/` rebuilt so the parity
and freshness guards could not fire on the byte change instead of the defect, then the named guard,
then **the whole 360-check suite** for anything still green.

| | |
|---|---|
| **the headline** | **9 of the 17 mutations survived the ENTIRE suite.** A gutted `applyStorylineTheme`, a `switchTimeout` that ignores the seconds it was handed, a `switchThreads` that posts a constant, a `modelSuitabilityWarning` that never warns, a `modelCapabilities` that answers `{}`, a `downloadUserFlaggedLessons` that ignores its storyline scope, a `_starNoteHtml` that renders nothing, a `_staticSoftDelete` that deletes nothing, and a diacritic adjudicator that waves every candidate through — **all 360 checks green for every one of them** |
| **⚠️⚠️ TWO GUARDS WERE ASSERTING AGAINST THEIR OWN RE-IMPLEMENTATION** | `unit-model-picker` said *"Replay the helper logic to confirm the decision table"* and then **defined its own four-line copy** of `modelSuitabilityWarning` and asserted on the copy. `unit-word-count` said *"Behavior — reimplement and check the contract"* and did exactly that: its own `splitWords`/`wordCount`, then **12 assertions about the test file agreeing with itself**. The app's functions were never called. Neither block could fail for any change to the app — proven by running the pre-fix `unit-word-count` against two real defects (`filter(Boolean)` dropped, `wordCount` returning `length \|\| 1`): **GREEN both times**, RED both times after the repair |
| **⚠️ the only hardcoded port in 355 test files** | `e2e-backend-recheck` pinned `PING_PORT = 19731`. It surfaced because it was the ONE test that went red for every unrelated mutation while suites ran in parallel — a second copy either fails to bind, or boots its server against the first copy's fake backend and then fails its own "starts offline" premise for a reason that has nothing to do with the code. Measured both ways: two concurrent copies, fixed port → one dies; ephemeral port → both pass. Now asks the kernel for a free port, the pattern `unit-inflection-label-backfill` already used |
| **what was repaired** | Seven guard files now RUN what they used to name: `unit-storyline-theme` (paints and compares three distinguishable gradients), `unit-model-picker` (the real warning function + a backend-gate branch its hand-written copy could not express, and `switchTimeout` against a stub `fetch`), `unit-model-settings` (`switchThreads` — sends what was typed, refuses a negative or a non-number before any request goes out), `unit-static-flags` (star/delete notes, the soft-delete TOGGLE, and that the storyline scope reaches the payload builder), `unit-model-picker-roles` (`modelCapabilities` against a stub `/api/show` — parses, caches, `capabilitiesReset()` clears, and unreadable stays UNKNOWN rather than "assume capable"), `unit-diacritic-qc` (the adjudicator flags on `FIX` and on nothing else, including a lowercase verdict), `unit-word-count` (the real helpers) |
| **each repair mutation-tested** | 21 further mutations against the NEW blocks, all red — including every one of the nine original survivors, plus the sharper ones the old guards could never have reached: painting a constant gradient, a wrong selector, swapped role keys, a dropped backend gate, a soft delete that stops being a toggle, a cache that stops caching, an unreachable host reported as vision-capable, and `.toUpperCase()` dropped so a model replying lowercase `fix` is silently ignored |
| **⚠️ what this does NOT claim** | 17 mutations is a sample, not a proof. The static screen found **16** files whose only claim about a function is that it exists; nine are repaired here and the rest are named in the session prompt. And the screen cannot see the larger class — guards that run the right function on a fixture where every branch gives the same answer |

### The rule this earns

**"Replay the logic" must mean LIFT the logic.** A test that retypes the function it is checking has
inverted itself: it now asserts that the test file is self-consistent, and the app is free to drift
away underneath it. Both offenders announced what they were doing in a comment directly above the
copy, and both read as thorough — four and twelve assertions, real edge cases, sensible names. The
tell is not the wording, it is whether the app's own bytes are ever executed. `extract()` +
`new Function` is a two-line lift and the suite already uses it in dozens of files.

## ✅ v90_a — the savedList projection is now a decision, not an accident (and a `v89_aj` claim corrected)

User: *"go ahead with #1"* — the `savedList` projection differential, recommended because it is the
class that has bitten most often. **ZERO `ui.json` keys** (the user was translating; the file was not
touched).

`/api/lessons` does not return topics, it returns a WHITELIST PROJECTION. The static build ships
whole topics and gets every field free. So a field the client needs but the projection omits **works
in the static build and is silently dead live** — no error, no empty state, just a feature that
quietly does nothing on the real server. The projection's own comments record it three times
(`v74_i`, `v79_n`, `v89_y`).

| | |
|---|---|
| **the measurement** | The live projection ships **22** distinct keys; the store holds **46**. **31 fields are dropped** — including `story` (355 topics), `storyMeta` (355), `translationMeta` (355), `userTopic` (336) — and 7 are COMPUTED in the projection and stored nowhere (`lessonCount`, `comicPanelCount`, `storyQcPending`, `qcFlags`, `tokens`, `lessonTypes`, `sourceFile`) |
| **the scan found no current violation** | Three shapes checked: variables bound from `savedList`, the `byTopic`/`byName` maps built from it, and inline `.find(…)?.field`. Zero reads of a dropped field. ⚠️ **This does not prove absence** — the client reads properties off short-named locals, so it is not statically decidable, and the guard does not pretend otherwise |
| **⚠️⚠️ IT DID FIND AN ERROR IN `v89_aj` — MY OWN, TWO RELEASES OLD** | That release added `...(l.source && … ? { source: l.source } : {})` to the projection and its write-up called it *"the FOURTH instance of the trap"*. **`source: l.source \|\| null` was already there.** The addition was a redundant DUPLICATE KEY with no behavioural effect, and the claim was simply false. Found because the mutation "projection drops `source`" came back **GREEN** — the guard could not fail, because the other copy still satisfied it. Duplicate removed; `roadmap_v89.md` and `INTERNALS.md` corrected in place rather than quietly fixed |
| **what the guard actually does** | It cannot decide reachability, so it makes the NEXT field a decision: every key any topic carries must be in the projection **or** in a `STATIC_ONLY` map **with a reason**. Adding a topic field now fails the suite until someone chooses. §2 keeps that list honest — an entry that is also projected is rejected (the list would no longer describe reality), and every reason must be a real sentence: `'ditto'` was refused by the guard's own check when I first wrote it |
| **⚠️ the extractor caught its own broken parse** | `lastIndexOf('{', anchor)` finds the nearest brace BEFORE the anchor, which is an inner one, so the first version parsed a fragment and extracted zero fields. A non-vacuity assertion (`shipped.has('id') && …`) fired immediately. It now walks BACKWARD balancing braces to the enclosing literal — lines 8266-8367, 39 fields |
| **guards** | `unit-savedlist-projection.test.js`, three sections. **Six mutations red**, the decisive one being **a brand-new topic field appearing unaccounted for** — the case the file exists for — plus each of the three historical regressions (`_titleFailed`, `comicPanelCount`, and `source` once its duplicate was gone) and the static-only list rotting |
