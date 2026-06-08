Q: in the pdf upload, what does the S/M/L selector do?

It controls the target word count per chapter chunk when splitting the PDF text. The chunk splitter accumulates paragraphs until the running word count hits the target, then flushes a new chunk:

    S (300 words) — shorter chapters, more of them, good for beginner learners or dense academic text
    M (600 words) — default, roughly one A4 page per chapter
    L (1000 words) — longer chapters, fewer of them, good for narrative fiction or when you want richer vocabulary per lesson

The splitter always breaks at paragraph boundaries, so actual chunk sizes vary — a chunk might be 280 or 350 words depending on where the nearest paragraph break falls relative to the target.

Q: can you summarize the workflow for pdf update, and where we are in your plan for this?

**Current workflow (Phase 1 + 2 complete):**

1. Check the 📄 PDF checkbox in the generation form
2. Pick chunk size S/M/L and tap 📂 to choose a file
3. `pdfjs-dist` extracts text client-side (lazy-loaded from CDN), cleans it (dehyphenation, page numbers stripped), splits into chunks at paragraph boundaries targeting the chosen word count
4. A preview list appears showing each chunk with its auto-detected title, word count, and ↓ merge / ✕ delete controls — tap any title to expand and read/edit the full text
5. Tap **▶ Generate storyline** — chunks are sent sequentially to `/api/generate` with `userStory: chunk.text`, `continuedFrom` chaining each chapter to the previous, and `useFullChain: true` from chapter 3 onward
6. Progress shown inline with ✅/⏳/❌ per chunk; cancellable via 🛑

**Where we are in the plan:**

| Phase | Status |
|---|---|
| Phase 1 — Basic upload + extraction | ✅ Done |
| Phase 2 — Chunk preview + edit UI | ✅ Done (merge, delete, expand) |
| Phase 3 — Full storyline pipeline | ✅ Done (sequential generation with chaining) |
| Phase 4 — Polish | ⬜ Not started |

**Phase 4 remaining items:**
- Page range selector (generate from pages N–M only)
- Custom word target beyond S/M/L
- Export chunk list as JSON for re-use
- Split a chunk at cursor position (currently only merge/delete)
- Better handling of PDFs with complex layouts (columns, footnotes)
- Static-mode: hide upload but show PDF-sourced storylines normally (already works — static hides the panel)

The main gap right now is the **split-at-cursor** feature — you can merge chunks but can't split an oversized one. Everything else in Phase 4 is polish. The core workflow is fully functional.
