# v57 — clickable storyboard panels → lesson sets (roadmap-v56 item 1, in full)

One feature session on v56. The plan file is `roadmap_v57.md`; the shipped item's summary lives
there too — this file records the decisions, seams, and the things a later session will need.

## The settled design (the item said "do the design first")

**The mapping problem** — panel count ≠ chapter count, almost always. User's call this session:
existing boards get an **equal split** (no forced regenerate — the 409 mirror in the original spec
is dropped); future boards may use **model assignment**, since it turned out cheap (one prompt
field + the usual clamp).

One rule, ONE implementation (`_sbPanelChapter`, client), used by BOTH the click handler and the
current-chapter framing so they can never disagree:

- A panel's `data-chapter` attribute wins. It exists only when the model supplied a valid per-panel
  `chapter` (new prompt field) AND `composeStoryboardSVG` sanitized it — integer, clamped
  1..chapterCount. The client **re-clamps at click time** against the CURRENT chapter count,
  because stored SVGs outlive chapter deletions.
- Otherwise: `chapter(i) = floor(i·C/P) + 1`. Fewer panels than chapters → each panel links to the
  chapter its span STARTS with (2 panels / 5 chapters → 1 and 3). More panels → links repeat.
  Covers both directions with one formula; first panel is always chapter 1; non-decreasing.

**Why the fallback lives in the client, not the composer:** pre-v57 SVGs are already baked into
`lessons.json`/docs and will never be recomposed unless the user re-colours; a server-side fallback
would have needed a second, drift-prone copy anyway for those. The composer emits `data-chapter`
ONLY for model-supplied values; absence = "client formula applies" — a single seam.

**Click plumbing:** one *delegated* document-level listener (`_sbNavClick`) over
`.storyline-storyboard[data-sb-chain]`. Chosen over per-render init because the static build bakes
the landing DOM at build time — delegation makes live and static identical for free, and there is
no init call to forget on the next render site. Panel identity = index among the outer svg's direct
`<g>` children (exactly what the composer emits; nested groups can't confuse it —
`g.parentNode !== outer` guard).

**Locking** (`_sbChapterTarget`): teacher mode / canGenerate → free deep links. Student mode mirrors
the storyline screen's chapter-card rule *exactly* (fail closed: locked unless first, has lessons,
predecessor exists with all lessons complete). A locked panel **resumes** at the first unlocked,
incomplete chapter (toast `storyboard.locked_resume`) instead of dead-ending — "the student runs
through the lessons in order; clicking a panel again lands where they left off." Opening goes
through the existing `loadSaved` + `APP.progress` machinery; `openStoryboardChapter` also sets
`APP._slScreen` so a landing-page panel click gives the lesson-set header the RIGHT storyline
context (it would otherwise inherit a stale one).

**Render sites (now FOUR):** live landing card, storyline screen, **new: lesson-set page**
(`#ls-storyboard`, inserted in `buildPath` ABOVE the ←/→ `cont-nav`, current chapter's panel(s)
framed blue via `_sbMarkCurrentPanels`), and the static landing card in `build-static.js`. All
carry `data-sb-chain`; `unit-static-landing-parity`'s hook list gained it (the v55_p trap).

## Panel budget: 6, or 12 for >10 chapters, rows of 6

- The **composer's** `MAX_PANELS` is now **12** — a fixed security bound, deliberately NOT the
  editorial budget. The 6-vs-12 decision is a **prompt** rule (`maxPanels = chapters > 10 ? 12 : 6`,
  templated as `{maxPanels}` into system+user). Consequence worth knowing: a re-colour of a
  12-panel board never trims panels even if chapters have since dropped ≤10.
- Layout: canvas WIDTH is always the full 6-per-row size (1104), so **panel size is identical
  across all boards** — v55_t's invariant survives; only HEIGHT grows with rows (194 / 376). Each
  row centres independently; a full row's centring lands exactly on the original 12px margin.
- Token headroom scales: 12000 for 12-panel boards (6000 was measured near the cap at 5 panels).
- `unit-storyboard`'s v55_t fixed-canvas test was **reworked, not deleted** (per roadmap), into the
  per-row form (counts 2–12, per-row centring/spacing/height).

## Tests

New `unit-storyboard-nav.test.js` (registered in run.js): mapping table incl. clamps and degenerate
inputs; composer `chapter` sanitization incl. an injection attempt and the "no chapterCount → never
emitted" back-compat shape; lock/resume behavior table (incl. the lesson-less-chapter fail-closed
case and the all-complete case); delegation + shared-mapping wiring; all four render-site hooks +
prompt field + i18n key. Its extractor anchors on line-start `\nfunction ` (+`async`) because a
prose comment in index.html literally contains "function buildPath()" and the naive `indexOf` was
extracting garbage — worth keeping in mind for the other extraction-based tests.

Updated: `unit-storyboard` (compose signature ×2, budget/cap, token headroom, layout rework),
`unit-static-landing-parity` (hook list + `data-sb-chain`).

Suite: **105 green**, check-inline 0 on both builds, static rebuilt (real corpus).

## i18n (protocol rule 3)

New **en-only** key: `storyboard.locked_resume` ("🔒 Chapter locked — resuming where you left
off"). Added to `ui.json` `en` ONLY — goes into the owed TranslateGemma pass with the rest.

## Owed / next

- **LIVE-TEST §91** — the entire feature is browser-verified: clicks on old boards (equal split),
  lock/resume in student mode + static, a NEW generation carrying `data-chapter`, the two-row
  12-panel layout, re-colour link survival, and the stale-data-chapter clamp after chapter delete.
- The pre-existing backlog §§72–78, §79c–§90 still stands (unchanged from the v56 handoff).
- i18n pass (now 1631 missing keys + full `sw`).
- Existing boards can be "upgraded" to model-assigned links simply by 🎬 → regenerate — worth doing
  for boards whose equal split reads wrong (e.g. a story whose scenes cluster in early chapters).

## Addendum 2026-07-20 — verification backlog closed, procedure retired, i18n figure corrected

- The user exercised all functionality tracked in `LIVE-TEST-CHECKLIST.md` (incl. §91) and confirms
  it broadly works and/or is superseded by planned changes. **All open boxes closed in bulk**; the
  checklist is now an ARCHIVE and the live-test procedure is RETIRED. Protocol rule 2 amended in
  `roadmap_v57.md`: browser-only behavior gets a terse "how to see it work" description in session
  notes instead of a checklist section.
- **i18n roadmap figure was stale**: `node translate-ui.js --check` measures the real debt at
  **29 keys** (`storyboard.locked_resume` × 29 languages), not the long-claimed 1630. Corrected in
  the roadmap; one translate run clears it.
- "How to see v57 work" (replacing §91, per the amended rule): on any storyline card with a
  storyboard, panels show a pointer + blue hover frame and click through to their chapter; with
  teacher mode OFF, a late panel resumes at the current chapter with the 🔒 toast; the chapter page
  shows the board above the ←/→ nav with this chapter's panel(s) framed; a fresh generation on a
  >10-chapter storyline yields up to 12 panels in two rows carrying `data-chapter`.
