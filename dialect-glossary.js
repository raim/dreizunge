// dialect-glossary.js
// Deterministic dialect-glossary importer (M1). NO LLM. Parses a pasted/uploaded glossary of
// `dialect | High German | (optional) note` rows into faithful vocab items. The parser NEVER
// invents, splits, or normalizes dialect tokens beyond trimming — the uploaded rows are ground
// truth (the safety spine from spec_dialect_lessons_m1.md). It only segments the text into rows,
// trims cells, drops fully-empty lines, and REPORTS anomalies (duplicates, suspicious rows) so a
// human fixes the source rather than the importer guessing.
//
// Usage (browser or Node):
//   const { rows, report } = parseDialectGlossary(text, { col1: 'target', col2: 'source' });
// Returns:
//   rows:   [{ target, source, note? }]   verbatim, in file order
//   report: { total, dropped, delimiter, headerSkipped, duplicates: [{ target, count }],
//             suspicious: [{ line, reason, raw }] }
//
// Isomorphic: attached to module.exports (Node) AND window (browser, via build-static inline).
(function (root) {
  'use strict';

  // Delimiters tried in priority order. `=` and ` | ` are common in hand-typed/exported glossaries;
  // tab/comma for TSV/CSV. 2+-space alignment is the last resort (least reliable).
  const DELIMS = [
    { name: 'tab',    re: /\t/ },
    { name: 'pipe',   re: /\s*\|\s*/ },
    { name: 'equals', re: /\s+=\s+/ },
    { name: 'comma',  re: /\s*,\s*/ },            // only used if a row has exactly the mapped col count
    { name: 'spaces', re: /\s{2,}/ },
  ];

  // Lines that look like a title/license/header, not a data row. Kept deliberately narrow so we
  // never drop a real entry: only skip lines with NO delimiter, or obvious header/license markers.
  const HEADER_RE = /^(dialekt|dialect|mundart|hochdeutsch|deutsch|german|wort|begriff|note|notiz|anmerkung)\b/i;
  const LICENSE_RE = /\b(cc[- ]by|creative commons|©|\(c\)|copyright|all rights reserved|wörterbuch|dictionary)\b/i;

  function _detectDelimiter(lines) {
    // Pick the delimiter that splits the MOST non-empty lines into ≥2 parts.
    let best = null, bestCount = -1;
    for (const d of DELIMS) {
      let count = 0;
      for (const ln of lines) {
        if (!ln.trim()) continue;
        const parts = ln.split(d.re);
        if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) count++;
      }
      if (count > bestCount) { best = d; bestCount = count; }
    }
    return best;
  }

  function parseDialectGlossary(text, opts) {
    opts = opts || {};
    // Column mapping: which parsed column is the dialect (target) vs High German (source) vs note.
    // Default per spec decision #3/#5: 1→target(dialect), 2→source(de), 3→note.
    const map = { col1: opts.col1 || 'target', col2: opts.col2 || 'source', col3: opts.col3 || 'note' };

    const rawLines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
    const delim = _detectDelimiter(rawLines) || DELIMS[2]; // fall back to equals

    const rows = [];
    const report = {
      total: 0, dropped: 0, delimiter: delim.name, headerSkipped: 0,
      duplicates: [], suspicious: [],
    };
    const seen = new Map();   // target → count, for duplicate reporting

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line.trim()) { report.dropped++; continue; }

      const parts = line.split(delim.re).map(s => s.trim());
      // No delimiter on this line → it's a header/title/license/orphan, not a data row. Skip it,
      // but only silently if it looks like a header/license; otherwise flag it as suspicious.
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        if (HEADER_RE.test(line.trim()) || LICENSE_RE.test(line.trim())) {
          report.headerSkipped++;
        } else {
          report.dropped++;
          report.suspicious.push({ line: i + 1, reason: 'no delimiter / single column', raw: line.trim() });
        }
        continue;
      }
      // A header ROW that did split (e.g. "Dialekt | Deutsch") — skip the first such line only.
      if (rows.length === 0 && HEADER_RE.test(parts[0]) && HEADER_RE.test(parts[1])) {
        report.headerSkipped++;
        continue;
      }

      const target = parts[0];
      // Everything after the first delimiter is the source. We only peel off a 3rd column as a
      // NOTE when the caller explicitly asked for 3-column mode (opts.threeCol). Otherwise extra
      // delimiter-splits are rejoined verbatim into the source — this keeps a glued/collided row
      // whole (surfaced as suspicious) instead of silently dropping its tail into a phantom note.
      // Faithfulness over cleverness.
      let source, note;
      const _delimLiteral = delim.name === 'equals' ? ' = ' : delim.name === 'pipe' ? ' | ' : delim.name === 'tab' ? '\t' : delim.name === 'comma' ? ', ' : '  ';
      if (opts.threeCol && parts.length >= 3) {
        source = parts[1];
        note = parts.slice(2).join(_delimLiteral).trim() || undefined;
      } else {
        source = parts.slice(1).join(_delimLiteral).trim();
      }
      if (!target || !source) { report.dropped++; continue; }

      const item = { target, source };
      if (note) item.note = note;
      // Respect the column mapping (rare: user says col1=source). Swap if requested.
      if (map.col1 === 'source') { const t = item.target; item.target = item.source; item.source = t; }
      rows.push(item);
      report.total++;

      // Duplicate tracking (kept, not dropped — a word with 2 senses is 2 rows — but reported).
      seen.set(item.target, (seen.get(item.target) || 0) + 1);

      // Suspicious-row heuristic: a single row that appears to contain a SECOND "X = Y" pair glued
      // in (PDF layout artifact, e.g. "Männchen, kleiner MannFock = Schwein"). We DO NOT auto-split
      // — the spine forbids the importer inventing rows — but we flag it for the human to fix.
      if (delim.name === 'equals' && /\S=\S|[a-zäöüß][A-ZÄÖÜ]/.test(source)) {
        // camel-case seam (MannFock) or an embedded '=' inside the gloss → likely two glued rows
        if (/[a-zäöüß][A-ZÄÖÜ]/.test(source) || / = /.test(source)) {
          report.suspicious.push({ line: i + 1, reason: 'possible two glued entries', raw: line.trim() });
        }
      }
    }

    for (const [target, count] of seen) if (count > 1) report.duplicates.push({ target, count });

    return { rows, report };
  }

  // Build a faithful vocab lesson from parsed rows. NO LLM. Each row → { target, source, note?,
  // _dialect:true }. _dialect marks the item so QC runs sourceOnly, the card shows the note, and
  // TTS uses the approximate-voice toggle (see spec). Split into difficulty-ordered chunks by row
  // order (like the script-letter cap) if a size is given.
  function dialectVocabItems(rows) {
    return (rows || [])
      .filter(r => r && r.target && r.source)
      .map(r => {
        const item = { target: r.target, source: r.source, _dialect: true };
        if (r.note) item.note = r.note;
        return item;
      });
  }

  const api = { parseDialectGlossary, dialectVocabItems };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.parseDialectGlossary = parseDialectGlossary; root.dialectVocabItems = dialectVocabItems; }
})(typeof window !== 'undefined' ? window : null);
