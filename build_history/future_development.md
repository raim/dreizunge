# Future development — what was wanted and never built

A single place for ideas that live scattered across 128 files in `build_history/`: 28 roadmaps,
58 session notes, and ~30 topical idea/spec documents, most of them consultation transcripts that
were never folded into a roadmap.

**How this file was built, and how to use it.** Every entry below was checked against the code
before being written down, and each carries the measurement that settled it. That matters because
the scan turned up the opposite of what the documents said at least twice: the identical-source
heuristic reads as open in a `server.js` comment and was in fact shipped in `v53_g`, and the
`CLOSE_LANG_PAIRS` table reads as absent from the design-principle inventory and is in fact live.
**Do not act on an entry here without re-measuring it** — this is a map of where to look, not a
verdict. It was accurate on `v73_c` and will rot like any other narrative record.

Ordered by what it would cost to be wrong about, not by size.

---

## 1. Defects that are still measurable in the shipped corpus

These are the highest-value entries, because they are not proposals: the data is on disk and the
numbers can be reproduced in a minute.

### 1.1 The corpus contains lessons the app would now refuse to generate

`build_history/dreizunge_lessons_assessment.md` reported vocabulary items whose source and target
fields are identical — "useless as vocabulary exercises since the user learns nothing" — at
**107 cases across 18 topics**. A ratio-based rejection rule shipped in `v53_g`
(`IDENTICAL_MIN_RATIO = 0.6`, `server.js` ~4237): a lesson is rejected when ≥3 items *and* ≥60% of
the lesson are identical.

Measured on `v73_c`:

| | count |
|---|---|
| vocab pairs in corpus | 4,502 |
| identical source/target | **157** across **74 topics** (was 107 / 18) |
| lessons that today's own rule would REJECT, still shipping | **5** |

The five:

| pair | ratio | topic |
|---|---|---|
| lb→en | 8/8 (100%) | History of Luxembourg |
| it→en | 8/8 (100%) | Grandmas Doughs |
| lb→en | 6/8 (75%) | Cremant vs. Champagne |
| lb→en | 6/8 (75%) | Cremant vs. Champagne |
| lb→en | 4/5 (80%) | a poem |

The first two are the exact lessons the assessment named as total model failures — the model wrote
the source language into both fields. They are baked into `docs/index.html` and served to learners
today.

**The general lesson, which is worth more than the item:** a guard added at *generation* time never
cleans the data that prompted it. Every such guard in this codebase leaves a residue nobody
measures. Candidates for the same treatment: the diacritic scan (`v72`), article symmetry
(`v71_y`), the identical-ratio rule. A one-off repair pass, or a QC check that reports pre-existing
violations rather than only blocking new ones, would close the class rather than this instance.

### 1.2 Loanword-only lessons are legitimate and still useless

The residue above the 60% line is a defect. The residue *below* it — "pasta, tagliatelle, risotto"
for an Italian lesson, "Champagne, Terroir, Méthode Champenoise" for Lëtzebuergesch — is correctly
*not* rejected and is still, in the assessment's words, useless as an exercise. The assessment
proposed a UI treatment (a `⚠` chip so the learner knows the lesson is partially degraded) rather
than rejection. Never built. This is a display decision, not a correctness one, so it sits on the
permitted side of the design principle.

---

## 2. Built, wired, and never fed

The most surprising category: machinery that is complete in code and empty in data, so it silently
does nothing. Each looks finished from the source and is inert at runtime.

### 2.1 Major A — per-target-language prompt examples

`promptExample(P, lang, srcLang)` (`server.js` ~172) resolves in the order
`<target>__<source>` → `<target>` → `default` → `''`, and is called at **4** generation sites via
the `{EXAMPLE}` token. `harvest-examples.js` exists to populate the first tier from ⭐-rated corpus
items. `build_history/prompt_examples_audit.md` is a 144-line map of exactly where the seams are.

Measured on `v73_c`:

| | |
|---|---|
| `examples.json` (harvested tier) | **absent** |
| corpus items carrying `userRating.at` (the harvest source) | **0** |
| curated per-language examples in `prompts.json` | **1** — `wordForms.de` |

So every generation, for every language pair, in every lesson type except German word-forms, falls
through to the generic `default`. The audit's key finding — that every baked example is "in a
**single fixed language pair**, with **no variation by target language, lesson type difficulty, or
topic**" — is still true, because the mechanism built to fix it has never had input.

`todos_v46.md` set out the intended path and it remains the right one: a rating system feeding
example injection, with the honest note that the question is "what the most efficient strategy would
be, with minimal human user requirement, to get good examples." The rating UI exists. Nobody has
starred anything. **This is the cheapest large win available** — it needs corpus curation, not code,
and it is upstream of every lesson the app produces.

### 2.2 The edit report was meant to reach the interface

`report-edits.js` generates a temporal edit/activity report (markdown or HTML) and works. `todos_v46`
filed it as *"This can just be an external script for now, but we later want to add it to the
index.html interface."* Referenced from `index.html`: **0**. Referenced from `server.js`: **0**.
Still CLI-only.

---

## 3. Never started — the large items

Each has a design document that is better than a stub, and none has any code. Listed with what the
document already settles, so a future session does not restart the thinking.

### 3.1 Concept graph / dependency-aware curriculum

`concept_graph.md` (959 lines). The argument is that stories cannot define the curriculum, because
stories branch, different teachers write different ones, learners take different paths, and
community stories may merge again — so the curriculum has to be a separate DAG of concepts that
lessons attach to. The current roadmap carries it under "Larger, not started" with the standing
instruction: **do not start it opportunistically.** That instruction should survive into any future
roadmap; it is a large authoring project, not a coding one.

One thing worth recording, because it looks like a substitute and is not: `server.js` ~840
describes the tutor's retrieval rule as "the cheap 90% of what a concept graph would buy us". Read
in context, that claim is scoped to **spoiler safety** — retrieval only ever touches chapters the
learner has completed, so a story cannot be given away. It says nothing about dependency-aware
*sequencing*, which is the concept graph's actual purpose. The 90% is 90% of one benefit, not of the
feature.

### 3.2 Phylogenetic language-tree UI

`tree.md` proposes replacing the source/target dropdowns with a tappable language tree — tap one
language for source, another for target, with existing lessons shown on the branches. The data work
is **already done and sitting unused**: `tree/` contains `tree_glottolog_newick.txt` (772 KB of
Glottolog classification), a reduced `langs_newick.txt`, a rendered `langs_newick.svg`, and the
`tree.R` script that produced them. References from shipped code: **0**.

The document's own conclusion is the useful part — separate `linguistic data → tree JSON → visual
renderer` rather than hardcoding SVG, and use Glottolog because it is open, maintained, and has
stable IDs. Note this is registry data about language *relatedness*, not linguistic rules, so it sits
with `languages.json` rather than on the design principle's forbidden side.

### 3.3 3D world map language selector

`map.md` extends the tree idea: a 2D world map coloured by language family as the ground plane, with
the phylogenetic DAG rising on the z-axis, tap two regions to pick source and target.
`build_history/map_prototype.html` is a working Three.js prototype. References from shipped code:
**0**. Strictly more ambitious than 3.2 and dependent on the same data layer, so 3.2 is the
prerequisite.

### 3.4 PWA / mobile packaging

`mobile_app.md` and `mobile_app_claude.md` both conclude the app is unusually well suited to this:
a single static HTML file with embedded JSON and no backend dependency is close to the ideal input
for Capacitor, and a native WebView also fixes the TTS quality problem that `docs/index.html`
currently has outside Chrome.

Measured: `manifest` in `index.html` — **0**. `serviceWorker` — **0**. So the three things a PWA
needs (manifest, service worker, HTTPS) are all absent; `mobile_app_claude.md` estimates the file is
otherwise "95% of a PWA". Its home-WLAN-vs-cloud switching design is directly relevant to the
deployment work now on the roadmap and should be read alongside it.

### 3.5 Platform: accounts, repository, token economy

`platform_plan.md` is the most operationally honest document in `build_history/` and should be read
before any deployment work. Its own effort estimate is ~1–3 months for a multi-user MVP and 6–12
months for the full vision, with the standing warning that **payments is the part that is
unforgiving if rushed** and should be sequenced last.

Its Phase 1 (accounts + cloud progress) is **substantially done and the plan does not know it** —
`learners.js` shipped in `v65` with scrypt hashing, timing-safe comparison, hashed session tokens,
per-username throttling, and server-side learner state. What is missing is not the subsystem but
authorization: measured on `v73_c`, **40 of 43 non-GET routes have no auth check**, and
`GET /api/learners` returns every learner's username, completion counts and hardest words with no
gate at all. That is the subject of the role-model work now queued and is tracked there, not here.

Untouched from the plan: token ledger (`tokenLedger` in `server.js`: **0**), central repository
(`repo_items`: **0**), payments, moderation.

---

## 4. Small items filed and dropped

From `todos_v45.md` and `todos_v46.md`, verified absent:

| item | filed | status |
|---|---|---|
| PDF splitter: split a chunk at the cursor | `pdf_upload.md` Phase 4 | absent — merge and delete exist, split does not. The document calls this "the main gap" |
| PDF: page range selector (generate from pages N–M) | Phase 4 | absent |
| PDF: custom word target beyond S/M/L | Phase 4 | absent |
| PDF: export chunk list as JSON for re-use | Phase 4 | absent |
| "fix UI language" checkbox — stop the UI language switching with the storyline | `todos_v46` | absent |

`pdf_upload.md` records Phases 1–3 as complete and Phase 4 as "polish, not started". That is still
accurate; the four items above are the whole of Phase 4 that was never done.

---

## 4b. Items lost at a roadmap boundary — and the gap in this scan

Added in `v73_k`, after the user asked whether an old QC TODO still existed. It did, and finding it
exposed a hole in how this document was built.

An entire `[OPEN — cosmetics deferred in v71_q]` block of three items disappeared when
`roadmap_v72.md` was cut from `roadmap_v71.md`. It appears **zero times** in `roadmap_v72`,
`roadmap_v73`, `HANDOVER.md`, or in the first version of this file. All three re-verified as still
open. They now live in `roadmap_v73.md` under "RECOVERED":

1. Global QC: a checkbox menu of what to QC, including re-checking already-QCed items.
2. Crossword: show the correct word's translation instead of the empty underline.
3. Live mode with teacher mode OFF must hide every editing control — still true, and the same
   `_canEdit()` conflation the authorization plan describes.

**Why the original scan missed them, stated plainly:** it grepped for unchecked checkboxes
(`- [ ]`), read the ~30 topical idea documents, and probed the code for each feature. It did not
walk `[OPEN — …]` and `[QUEUE — …]` blocks inside superseded roadmaps. Those blocks are prose, carry
no checkbox, and are exactly where a deferred item goes to die — because the next base-version cut
rewrites the roadmap and a prose block is easy to drop.

**So the rule for anyone extending this file:** the idea documents are safe, nobody deletes them.
The losses are in the roadmaps, at the base-version boundaries. Diff each `roadmap_vN.md` against
`roadmap_vN+1.md` for `[OPEN`/`[QUEUE` blocks rather than trusting either one alone. There are 28
roadmaps and only the v71 → v72 boundary has been checked.

---

## 5. Records that will actively mislead the next session

Not features — bookkeeping defects of the same shape as the "Drill result card" item that session 26
found had been carried as open through four releases while the same file recorded it as shipped.

1. **`server.js` ~2190–2204 describes a superseded rule as future work.** The comment explains that
   the identical-item check "blocks at >2 identical vocab items", that this COUNT threshold
   "conflates two different things", and that "A RATIO threshold (identical/total) would separate
   them; see roadmap_v54". The ratio threshold shipped in `v53_g` and is live 2,000 lines below at
   `IDENTICAL_MIN_RATIO = 0.6`. A session reading the comment would implement something that
   already exists.
2. **`CLOSE_LANG_PAIRS` is missing from the design-principle inventory.** `INTERNALS.md` → "Known
   violations" lists three entries and **all three are struck through as resolved**, so the section
   reads as "none remain". `CLOSE_LANG_PAIRS` (`server.js` ~2205) is a live, hand-authored,
   21-pair table of which language pairs are "close enough" that identical vocabulary is
   legitimate. It decides whether a generated lesson is kept or rejected — the correctness side of
   the principle's own test — and its comment admits it "is the ONLY place language 'similarity' is
   recorded". Whether it should move to `languages.json` was an open item in `roadmap_v54` and
   `roadmap_v65`, and it silently dropped out from `roadmap_v69` onward. Note the four-tier ruling
   in `INTERNALS.md` applies: moving it to a file is not progress on its own, because the cost is in
   authorship, not location.
3. **`build_history/v72b_session26_notes.md` is a superseded draft.** Its §1–§8 are byte-identical
   to `v72f_session26_notes.md` (`diff` = 0 lines), it stops five releases earlier, and it carries
   the *newer* mtime — so `ls -t` and the protocol's own "read the most recent session notes"
   instruction both point a fresh session at the stale copy. Delete.
4. **`roadmap_v73.md` protocol item 6 still says "This is the `v72` line"** and documents the
   `v72` → `v72_b` sequence, carried forward without updating.
5. **`build_history/archive/current_status_claude.md`** (moved there in `v73_c`) opens with "WARNING: this is not CURRENT" and
   describes `v18a`. It is 55 releases stale and its "Next session priorities" list is entirely
   superseded. Moved to `build_history/archive/` rather than deleted — the same treatment
   `LIVE-TEST-CHECKLIST.md` got when it became a closed archive.

---

## 6. Ideas that were implemented — recorded so they are not re-proposed

Several idea documents read as open because nothing marks them done. All verified present in code:

| document | shipped as |
|---|---|
| `chatbot.md` — persistent local AI tutor | the tutor role and `/api/tutor` (`v61`) |
| `text_error_lesson.md` — story with introduced errors | the `error_hunt` lesson type |
| `story2lesson.md` — transformation over free generation | the from-text generators |
| `multi_from_languages.md` — UI localisation drives source language | shipped; 30 languages, 596 keys |
| `story_from_pdf.md` — PDF → storyline | Phases 1–3 (see §4 for Phase 4) |
| `dialects.md`, `spec_dialect_lessons_m1.md` — dialect as a transformation layer + glossary import | `dialect-glossary.js`, `/api/dialect-import`, `/api/dialect-curate` |
| `claude_word_forms_integration_spec.md` | the `word_forms` lesson type |
| `storyline-learning-arc-guide.md` | the learning-arc generation path |

`training_texts.md` is source material (Luxembourgish excerpts and translations), not a proposal.

---

## How this relates to the roadmap

The roadmap is the queue; this file is the backlog behind it. An item should move from here into a
roadmap only with a re-measurement attached, and should be struck here when it does. The two entries
most worth promoting on current evidence are **§2.1 (the empty example pipeline — upstream of every
lesson the app generates, and it needs curation rather than code)** and **§1.1 (five defective
lessons shipping today, and the general point that generation-time guards leave uncleaned residue)**.
Everything in §5 is a ten-minute fix that prevents a wasted session.
