# Attributions & third-party content licenses

This file records the source and license of third-party material bundled with or importable into
Dreizunge. Dialect glossaries are treated as **ground truth** (the app never alters the dialect
tokens); preserving correct attribution is part of that faithfulness.

## Dialect material

### Osttirol (East-Tyrolean) — "Dialekt Wörterbuch Osttirol"
- **Author:** Bernd Kranebitter
- **License:** CC BY-NC (Creative Commons Attribution–NonCommercial), 2007–2026
- **Used with:** the author's explicit permission for use in this non-commercial learning app.
- **Scope:** imported as a dialect glossary (dialect → High German), rows used verbatim.
- **Attribution shown to users:** the dialect topic credits "Bernd Kranebitter — Dialekt Wörterbuch
  Osttirol (CC BY-NC)".
- **Note:** CC BY-NC permits sharing/adapting for non-commercial purposes with attribution. This
  project is non-commercial and ad-free; if that ever changes, this material's terms must be
  re-checked.

<!-- When the mein-osttirol.rocks dictionary data is received (pending permission from
     Jürgen & Lisa Herrnegger, info@mein-osttirol.rocks), add its entry here with the agreed
     attribution + terms before importing. Do NOT import until permission is on file. -->

## How attribution is enforced in the app
- Imported dialect vocab items are marked `_dialect:true`; the dialect topic stores the source
  attribution and (when provided) per-entry author, shown in the UI.
- The importer (`dialect-glossary.js`) is deterministic and never invents or rewrites dialect
  tokens — see `build_history/spec_dialect_lessons_m1.md` ("the user/source is the source of
  truth, the model is a packager/aligner, never an author").
