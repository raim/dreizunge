# Dreizunge — PDF-to-Storyline Implementation Plan

## Overview

Upload a PDF → extract text → split into narrative chunks → generate a full storyline (one lesson set per chunk), each chapter continuing from the previous. The result is a complete storyline rooted in the PDF's content, with vocabulary, grammar, and error hunt lessons derived from the actual source text.

---

## Architecture Decision

**Client-side extraction with `pdfjs-dist`** (CDN, no npm install needed in the browser).

- Works in the live server and could work in static too (read-only mode)
- No file upload to server — text is extracted in the browser and sent as `userStory` per chunk
- `pdfjs-dist` is well-maintained, handles most PDFs, available at `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/`

---

## Components

### 1. UI — PDF Upload Panel (`index.html`)

A new collapsible panel in the generation form, alongside "I have my own story":

```
📄 Upload PDF
  [Choose file…]          ← file input, accept=".pdf"
  Source language: [en ▾]  ← which language the PDF is in
  Target language: [de ▾]  ← language to learn
  Chunk size: [medium ▾]   ← small (~300w) / medium (~600w) / large (~1000w)
  [Extract & Preview]
```

After extraction, a preview panel shows:
- Total word count, estimated chapter count
- The split chunks listed (collapsible), each editable
- A title field (auto-filled from PDF filename or first heading)
- [Generate Storyline →] button

### 2. Client-side Text Extraction

```js
async function extractPdfText(file) {
  // Load pdfjs from CDN (already imported or lazy-loaded)
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Join items, preserving line breaks between blocks
    pages.push(content.items.map(item => item.str).join(' '));
  }
  return pages.join('\n\n');
}
```

### 3. Text Cleaning

After raw extraction, a cleaning pass:
- Remove page numbers (lines that are just digits)
- Collapse hyphenated line-breaks (`word-\nword` → `word`)
- Normalise multiple blank lines to `\n\n`
- Strip headers/footers heuristically (repeated lines across pages)

### 4. Chunk Splitter

Split by natural boundaries, targeting a word count per chunk:

```
Priority order:
  1. Section headings (all-caps line, or line ending with \n\n after ≥20 chars)
  2. Double newline (paragraph break)
  3. Sentence boundary (. / ! / ?)
  4. Hard cut at word limit (fallback only)
```

Algorithm:
- Walk paragraphs accumulating word count
- When accumulated count ≥ target chunk size AND a natural boundary is found → flush as new chunk
- Each chunk gets: `{ index, text, wordCount, title }` where title is the first sentence or heading

Chunk sizes:
- Small: ~300 words (good for beginner learners, short lessons)
- Medium: ~600 words (default)
- Large: ~1000 words (advanced, richer vocabulary)

### 5. Preview & Edit UI

```
Extracted: 4,200 words → 7 chapters (~600w each)

  Chapter 1: "In the beginning…"        [312w] [▼ expand] [✎ edit]
  Chapter 2: "The first encounter…"     [598w] [▼ expand] [✎ edit]
  ...

  Merge ↑ | Split here | Delete
```

User can:
- Expand/collapse each chunk to read/edit the raw text
- Merge two adjacent chunks (combine under-length ones)
- Split a chunk at the cursor position
- Delete a chunk

### 6. Storyline Generation Pipeline

On [Generate Storyline →]:

```
For each chunk i:
  1. POST /api/generate with:
       topic:         auto-title(chunk) or user-edited title
       lang:          target language
       srcLang:       source language
       userStory:     chunk.text          ← the PDF passage
       continuedFrom: previous topic (if i > 0)
       useFullChain:  true (if i > 1)     ← pass all prior chapters as context
       lessonFormat:  'standard'          ← or user-selected
       storyLen:      chunk.wordCount     ← match story length to chunk
  2. Wait for job completion (existing poll loop)
  3. Mark chunk as done, advance to next
```

Progress shown as a stepper: `Chapter 1 ✅ → Chapter 2 ⏳ → Chapter 3 … → Chapter 7`

Cancellable at any point via the existing 🛑 stop button.

### 7. Server-side Changes (minimal)

The existing generation pipeline already handles `userStory` — it uses the provided text as the story directly rather than asking the LLM to write one. The main addition:

- **`/api/generate`**: accept `storyLen` override when `userStory` is provided (currently ignores it)
- **Auto-titling**: if `topic` is empty and `userStory` is provided, server extracts a title from the first sentence

No new endpoints needed.

### 8. Auto-titling Heuristic

```js
function autoTitle(text, index) {
  // Use first heading-like line (short, no period)
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length < 60 && !firstLine.endsWith('.')) return firstLine;
  // Else: first sentence, truncated
  const firstSent = text.match(/^[^.!?]{10,80}[.!?]/)?.[0] || text.slice(0, 50);
  return `Chapter ${index + 1}: ${firstSent.trim()}`;
}
```

---

## Data Flow

```
PDF file
  ↓ pdfjs-dist (browser)
Raw text (all pages joined)
  ↓ cleanPdfText()
Cleaned text
  ↓ splitIntoChunks(text, targetWords)
chunks[]  ← user can edit/merge/split
  ↓ for each chunk: POST /api/generate { userStory: chunk.text, continuedFrom: prev }
Storyline in lessons.json
  ↓ existing lesson set flow
Lessons with vocab, grammar, error hunt derived from PDF passages
```

---

## UI States

| State | UI |
|---|---|
| No file selected | File input only |
| Extracting | Spinner "Extracting text…" |
| Preview ready | Chunk list + Generate button |
| Generating | Stepper showing per-chapter progress |
| Done | "Storyline ready — tap to open" (existing gen-status pill) |
| Error | Per-chapter error, option to retry that chunk |

---

## Edge Cases

| Case | Handling |
|---|---|
| Scanned PDF (image-only) | `pdfjs-dist` returns empty text → warn "No text found. Is this a scanned PDF?" |
| Single-page / very short PDF | Treated as one chunk, goes through normal single-topic generation |
| PDF with complex layout (columns, tables) | Text order may be wrong; user edits in preview before generating |
| Very large PDF (100+ pages) | Cap at 20 chunks with a warning; user can generate additional batches |
| Encrypted/password-protected PDF | `pdfjs-dist` throws; catch and show "PDF is password-protected" |
| Non-Latin scripts | Extraction works; generation quality depends on LLM support for that language |

---

## Phased Delivery

### Phase 1 — Basic upload + single-chunk (1 session)
- PDF input, text extraction, cleaning
- Paste extracted text into existing `user-story-input` textarea
- User manually cuts to desired length
- No new server code

### Phase 2 — Chunk preview + edit UI (1 session)
- `splitIntoChunks()`, preview list, merge/split/delete
- Auto-titles
- Single chapter generation from selected chunk

### Phase 3 — Full storyline pipeline (1 session)
- Sequential multi-chapter generation with `continuedFrom` chaining
- Progress stepper
- `useFullChain` passed for chapters 3+

### Phase 4 — Polish (later)
- Page range selector (generate from pages N–M only)
- Chunk size presets + custom word target
- Export chunk list as JSON for re-use
- Static-mode read-only: show PDF-sourced storylines without upload

---

## Files Affected

| File | Changes |
|---|---|
| `index.html` | PDF upload panel, extraction, chunking, preview UI, generation pipeline UI (~200–300 lines) |
| `server.js` | `storyLen` override for `userStory` path, auto-title fallback (~20 lines) |
| `build-static.js` | Hide PDF upload panel (live-only feature) |
| `ui.json` | ~8–10 new keys for PDF UI strings |
