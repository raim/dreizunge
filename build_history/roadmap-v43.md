# Implementation roadmap — feature batch triage

Triage of the requested features, grouped into sessions by cohesion, dependency, and risk.
Effort: S (≤~30 min), M (focused session), L (most/all of a session).
Verifiability: how much can be checked headlessly vs. needs live browser/model testing.

## Done now (this session)
- **Synonyms/antonyms relabel + color** — “synonym”→“similar” (green), “antonym”→“opposite” (red), in the question and the badge. ui.json only (rendered as HTML). ✅
  - *Needs re-translation:* `ex.syn.q_synonyms`, `ex.syn.q_antonyms`, `ex.badge.syn_synonyms`, `ex.badge.syn_antonyms` (wording changed; keep the colored `<span>` in non-EN values).

---

## Session 1 — Quick UI wins (client-mostly, low risk) · S–M
Independent, no server flow changes. Good first fresh session.

1. **Main-page language selector persistence.** Separate the *form* language from the *open-story* language. Today `APP.lang/APP.srcLang` are global and get overwritten when a saved story is opened (and the footer selectors mutate them mid-story). Introduce `APP.formLang/formSrcLang`, restore them when returning to the main form, and stop the saved-story open from clobbering the form’s selection. Touches `selectLang`/`selectSrcLang`, the main-form selectors, the footer selectors, and the back-to-main nav. *Verifiability: needs browser clicking; medium risk of regressing the footer language switch.*
2. **QC “edited” timestamp.** Stamp `editedAt` (ISO) on a vocab/sentence item whenever it’s changed via the lesson editor (`saveLessonEdits` and `_qcMutateItem`’s fix path). Optionally show a small “edited …” marker in the editor. *S, low risk, headlessly verifiable.*

## Session 2 — QC editor & manual flags (cohesive QC area) · M–L
All touch the QC data model + editor; do together.

3. **Fix “fix/✕ doesn’t clear the flag.”** `_qcMutateItem` already deletes `item.qc`, persists, and re-renders — so the likely culprit is **refresh**, not clearing: the chapter-page/library 🔍 *count badges* (added recently) and possibly a stale editor re-fetch aren’t updated, so the flag *looks* present. Plan: after a clear, refresh the badge sources (re-pull `/api/lessons` or decrement in place) and confirm the editor re-render reads the mutated in-memory `lessonData`, not a cached server copy. *Needs live debugging to confirm the exact cause.*
4. **Manual flagging + user comment.** Let the user flag an individual question and attach a comment; store like auto-flags but tagged as user-origin (e.g. `item.qc = { source:'user', comment, at }` or a parallel `item.userFlag`). Surface in the editor (flag button + comment field).
5. **Inject user flags/comments into the QC prompt.** In `qcCheckPair`/`_runQc`, when an item carries a user comment, pass it into the model prompt (“the user reports: …”) so QC addresses it. *Server + client; data-model decision needed (reuse `qc` vs. new field). Headlessly verifiable for the prompt-injection + persistence; flag UI needs browser.*

## Session 3 — Batch story generation + title post-pass (server-heavy) · L
Builds directly on v42 **arc mode**. The two items are coupled (both about the batch flow), so do together.

6. **Batch story generation from a topic, via the arc pipeline.** Today arc mode requires provided chunks (PDF). Add a mode that *generates* N chapters from the user topic, chaining the story across chapters (no `userStory`; the model writes each chapter, continuing the previous), with arc reinforcement per chapter. Likely a new endpoint (`/api/generate-arc` or a `chapters:N` branch of the book job) reusing `_runBookJob`’s loop with generated stories instead of chunks. **UI:** keep the text-length slider as *per-chapter* length and add a **second slider for number of chapters** below it. *Server core + client sliders; loop logic headlessly verifiable with a mock.*
7. **Title generation as a whole-storyline post-pass.** Move title (and chapter-title/emoji) generation to *after* all chapters/lessons exist, feeding the whole storyline to the model so titles are coherent. Applies to **both** the new story batch and PDF batch. Today meta runs per-chapter mid-`generate()` and is translated; this becomes a final pass over the chain (new step in the book/arc job, or a `/api/retitle-storyline`). *Changes the meta flow — sequence carefully; the per-chapter meta step may become a cheap placeholder that the post-pass overwrites.*

## Session 4 — PDF / upload UX overhaul (client-heavy, cohesive) · L
Self-contained UX chunk; depends on nothing above (but nicer after Session 3 so batch titles apply).

8. **Merge “I have my own story” + PDF upload.** Checking “I have my own story” reveals the upload UI; remove the separate PDF checkbox. *Client refactor of the input panels.*
9. **Generalize upload to txt/markdown/etc.** Plain-text formats are trivial (read as text); confirm where PDF text is currently extracted (client vs. server) and route non-PDF types straight to the chunker. *S–M once #8 lands.*
10. **Split per page (checkbox) instead of by length.** Requires per-page text from the PDF extractor (page boundaries). *Depends on the extractor exposing pages.*
11. **Manual break points with formatting-preserving view.** A richer editor: show the document with newlines/paragraphs preserved and let the user insert/move chapter breaks. *Largest single UI item; could be split out on its own.*

## Session 5 — Lesson export (md/html) from the download button · M
Independent; could also be appended to any session with spare budget.

12. **Wire `export-lessons.js` into the UI.** The download button currently emits JSON. Add a server endpoint (e.g. `GET /api/export?id=…&format=html|md|json`) that reuses `export-lessons.js` logic, and a small format menu on the download button. Server-side rendering avoids porting the exporter to the browser. *Headlessly verifiable (fetch the endpoint, check output).*

---

## Dependency notes
- Session 3 depends on **arc mode** (done in v42).
- Item 7 (title post-pass) benefits items in Session 4 (PDF batch also gets coherent titles) — do Session 3 before/with Session 4 if titles matter for PDF.
- Sessions 1, 2, 5 are independent and can run in any order.
- Item 11 (manual break points) is the largest discrete UI task and can be deferred or split.

## Recommended order
**S1 (quick wins) → S2 (QC) → S3 (batch + titles) → S4 (PDF UX) → S5 (export).**
Each session ends with: syntax check, static rebuild if client changed, headless test where possible, commit, repackage zip. Live-browser items (language switch, flag UI, sliders) flagged above need manual click-through.
