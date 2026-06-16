# Dreizunge — roadmap for v44 (handoff to a fresh session)

This is the state at the end of the **v43 final** build. The app is a self-hosted,
zero-npm-dependency Node.js language-learning tool. Everything below is either a
**deferred item** (intentionally not finished in v43) or **verification still owed**.
Each item has concrete file/line pointers so you can start immediately.

## Project map (orient yourself first)
- `server.js` — the whole backend (HTTP, generation pipeline, persistence). `APP_VERSION='v43'`.
- `index.html` — the entire client (one inline `<script>`). The live app.
- `build-static.js` — bakes `docs/index.html`, a **server-less** static build for GitHub Pages.
  It splits `index.html`: `part1=[0,init())`, a dropped region `[init(),buildPath())` replaced
  by a static template, `part2=[buildPath(),end)` inherited verbatim, then `staticOverrides`
  injected after. Functions in part1/part2 are inherited unless build-static redefines them.
  Static **overrides**: `selectLang`, `selectSrcLang`, `loadSaved`, `init`, `renderPill`,
  `doGenerate` (stub), and others. (It no longer overrides `openExportMenu` — md/html now
  render client-side; see item 1.)
- `export-lessons.js` — module (`buildExport`/`listExport`/`resolveDocs`) **and** CLI. Renders
  Markdown/HTML. Used by the live server's `GET /api/export`.
- `llm.js` — LLM helpers: `callLLM, ping, release, warmup, stripRaw, extractJSON, extractArray, salvageArray`.
- `ui.json` — per-language UI strings; **English-only new keys go in the `en` block only**
  (≈ lines 1647–1913); `t()` falls back to `en`. Keys repeat across languages, so insert into
  the `en` range by line number (str_replace is non-unique).
- `prompts.json` — all LLM prompts.
- `lessons.json` — vendored user data (167 topics / 55 storylines, schemaVersion 29).

**Per-change workflow:** edit → `node --check server.js` (and syntax-check the inline script
in index.html via `/tmp/check_inline.js`, which extracts each `<script>` and runs `node --check`)
→ if the client changed, `node build-static.js lessons.json docs` → headless-test where possible
→ `git commit`. Headless LLM testing uses a fake Ollama (see "Testing" below).

---

## 1. Static md/html export + de-duplicate the download arrows (item 5)
**Status: DONE (v43 final, commit "Static export: offer md/html …").** Both parts shipped.

**(a) Static md/html download — done.** The Markdown/HTML renderer from `export-lessons.js`
(`buildExport` + `renderMarkdown`/`renderHtml`/`chapterParts`/`resolveDocs`) was ported into
the client as `_clientBuildExport` (+ `_ce*` helpers), reusing the existing client `stripFuri`
and `escHtml`. It lives in `index.html` just above `_doExport`, so the static build inherits it
automatically. `_doExport` now branches: md/html render **client-side** via `_clientExport`
when running server-less (detected with `typeof STATIC_LESSONS !== 'undefined'`); live mode
still fetches `/api/export`. `_clientExport` mirrors the server's anchor→containing-storyline
resolution (`STATIC_STORYLINES`), and JSON still goes through the existing `exportTopics`
(which the static build already overrides to read `STATIC_LESSONS`). The JSON-only
`openExportMenu` override in `build-static.js` `staticOverrides` was removed, and the static
card / storyline-header export buttons now call `openExportMenu` (md/html/json menu).
Verified: client output is **byte-for-byte identical** to `export-lessons.js` for both md and
html, tested on a multi-chapter storyline and an orphan topic.
*Not headless-verifiable (needs a browser): the format-menu popup placement and the actual
Blob file download.*

**(b) "Two download arrows on the main page" — done.** The duplicate was on the **storyline-
group header**, which rendered two identical export buttons flanking the share button
(`⬇ 🔗 ⬇`) in the static template (`build-static.js`, the `storyline-hdr` markup ≈ line 470).
The second `⬇` was removed → now `⬇ 🔗`. The flag-banner `download-flagged-btn`
("⬇ Download flagged", `index.html` ≈ 743) was **intentionally left** — it exports flagged
*exercises for review*, a different feature, and only appears when flagged items exist.

## 2. Finish the name-based → id-based chaining cleanup (items 1 & 10 follow-up)
**Status: partially done.** The storyline-**screen** fork bug is fixed: the successor map now
resolves parents by `continuedFromId` with a same-language guard (`index.html`,
`_renderStorylineScreen`, search "never attaches as a cross-language fork"). A follow-up fix
(commit "Fix: storyline screen rendered some chapters twice") made the **root** computation
`_hasPred` use that same id-based, same-language resolution (shared `_resolveParent`) — before,
a chapter chained by id with no `continuedFrom` name was treated as a root *and* re-rendered as
a child (duplicate cards, e.g. "Das kleine i"); a `_rendered` visited-set guard in `_renderChain`
was also added as a backstop. `buildPath` (≈ 2529) already uses `continuedFromId`.
Generation-time chaining was fixed earlier (`parentId` threaded through
`generate()`/`_runBookJob`, `_persistGenerated` re-fetches by name+lang+srcLang,
`_syncStorylineForTopic` resolves by id).

**Remaining client sites still keyed on `continuedFrom` (name)** — convert each to prefer
`continuedFromId` (id) and add a same-language guard, falling back to name only for legacy
topics without an id:
- `index.html` ≈ 3145–3146 — `_slChildMap` / `_slHasParent` (landing storyline grouping).
- `index.html` ≈ 4018–4025 — legacy chain rebuild in the `#sl=` resolver (`_tryOpenStorylineByChainId`).
- `index.html` ≈ 4084 — `deleteStoryline` "keep parent if another topic continues from it".
- `index.html` ≈ 6838 — `l.continuedFrom === currentTopic` next-topic finder.
The data itself is clean (only one odd cross-`srcLang` link in the vendored `lessons.json`),
so this is purely defensive display correctness for same-named chapters across languages
(same PDF generated in it/de/fr produces same-named first chapters).

## 3. arc-mode option labels → ui.json keys
**Status: minor deviation.** The new arc-mode `<select>`s (`#pdf-arc-mode`, `#gen-arc-mode`)
have **hardcoded English** `<option>` text ("➕🔁 New + review vocabulary",
"🏷🔤 Grammar + conjugation"). Per the project rule (no UI literals), add keys to `ui.json`
`en` (e.g. `form.arc_mode_vocab`, `form.arc_mode_grammar`) and render via `t()`.
Also note: the server tags the two vocab arc lessons with English titles "New words" /
"Review words" (`server.js`, `_runBookJob` vocab arc block) — acceptable as data, but list
for translation if desired.

## 4. Live-LLM verifications (cannot be done headlessly)
These were validated structurally with a fake Ollama but need a real model (qwen2.5:7b):
- **Conjugation** (rewritten prompt): question shows the **infinitive**; pronouns are grouped
  (`he/she/it`, `er/sie/es`); conjugations are in the **target** language for a de→en batch.
  (Client also has a defensive merge of identical-form pronouns in `buildConjugationExercises`.)
- **Vocab arc**: confirm the extend/reinforce lessons are sensible per chapter.
- **Chapter-title post-pass**: the robust parse chain is validated against malformed JSON;
  confirm real qwen output either parses or falls back, and that titles come out in the
  **target language** (the earlier "English titles" was the parse failing, now fixed).

## 5. Smaller / latent items
- **Generated-mode chapter count**: requesting `nChapters:1` produced 2 chapters
  ("Numbers — 2" naming). Check the generated branch of `POST /api/generate-book` chapter
  expansion + placeholder naming.
- **`/api/storyline-title` overwrite risk**: it calls `upsertStoryline({id,title,icon})`.
  Verify `upsertStoryline` (`server.js` ≈ 326) *merges* rather than replaces, so chapters/
  summary aren't dropped. (The new `/api/storyline-retitle` passes the full `sl` object, so
  it's safe; the older title endpoint may not be.)
- **Optional, larger:** the deferred single-document drag-canvas (a richer interpretation of
  the Session-4 PDF/upload UX item) — only if the user asks.

## Testing notes (headless)
- **Fake Ollama**: a small HTTP server exposing `GET /api/tags` → `{models:[{name:"fake"}]}`
  and `POST /api/chat` → canned content chosen by inspecting the prompt. Route storyline
  titles by `/single JSON object|series title/` in the **system** prompt FIRST, chapter
  titles by `/Chapter 1:/` in the **user** prompt, stories by `/Plain prose|continuation|Write a story/`,
  else return vocab JSON. Boot with `OLLAMA_HOST=http://localhost:PORT OLLAMA_MODEL=fake
  OLLAMA_LESSON_MODEL=fake LESSONS_FILE=<temp> PORT=<port> node server.js`.
- **Unit-test pure client fns** by extracting their source from `index.html` (brace-matching)
  and `eval`/`new Function`; provide deps (e.g. `globalThis.shuffle`) to avoid redeclare errors.
- `/api/lessons` returns **summaries** (no `lessons[]`); to inspect lessons, read the store
  file or `GET /api/lessons/load?id=tp_…`.

## Done in v43 (for reference — do not redo)
Sessions 1–5 of the v43 roadmap; conjugation prompt rewrite + client pronoun merge;
same-PDF two-language cross-link fix (generation-time); story-length selector visibility;
summary-save status fix; chapter-title robust parse; `/api/storyline-retitle` + ✨ popup;
vocab arc mode (default); math prompt logging; book-gen settings logging + PDF style;
PDF manual-chunk-edit guard; numbers 0–99 icons; URL-by-id; static unlock guard;
storyline-screen fork guard; storyline-screen double-render fix (`_hasPred` id-based, see
item 2); static client-side md/html export + storyline-header download-arrow dedupe (item 1).
App is at **v43** (`/api/info` + visible label, live + static).

## 6. Pre-existing missing ui.json keys (data gap, not a v43 regression)
The vendored `ui.json` `en` block is missing 10 keys that the client references via `t()`,
so they render as raw key names. These predate v43 (absent in earlier `ui.json` versions too):
`lesson.set`, and the rating labels `rating.boring`, `rating.coherent`, `rating.fun`,
`rating.incoherent`, `rating.just_right`, `rating.too_easy`, `rating.too_hard`,
`rating.very_coherent`, `rating.very_fun`. Add English values (then translate offline).
