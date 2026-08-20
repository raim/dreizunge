// text-analysis.js
// Small, deterministic text analysis primitives for pedagogy work.
//
// This module intentionally does not infer lemmas, parts of speech, translations, or skill IDs.
// Those are language-knowledge/model tasks. It only exposes the text evidence that a future
// tagger can inspect, preserving the original surface form alongside a locale-aware comparison
// key. It has no I/O and does not mutate its inputs.
'use strict';

function normalizeText(value) {
  return String(value == null ? '' : value)
    .normalize('NFC')
    .trim()
    .replace(/\s+/gu, ' ');
}

function languageTag(lang) {
  const tag = String(lang == null ? '' : lang).trim();
  return tag || undefined;
}

function foldText(value, lang) {
  const text = normalizeText(value);
  const tag = languageTag(lang);
  try { return tag ? text.toLocaleLowerCase(tag) : text.toLocaleLowerCase(); }
  catch (_) { return text.toLowerCase(); }
}

function fallbackTokens(text, lang) {
  const tokens = [];
  const re = /[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu;
  let match;
  while ((match = re.exec(text))) {
    tokens.push({ surface: match[0], start: match.index, end: match.index + match[0].length,
      key: foldText(match[0], lang) });
  }
  return tokens;
}

function tokenizeText(value, opts) {
  opts = opts || {};
  const text = normalizeText(value);
  const lang = languageTag(opts.lang);
  if (!text) return [];

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
      const tokens = [];
      for (const part of segmenter.segment(text)) {
        if (!part.isWordLike) continue;
        tokens.push({ surface: part.segment, start: part.index, end: part.index + part.segment.length,
          key: foldText(part.segment, lang) });
      }
      return tokens;
    } catch (_) {
      // An unknown BCP-47 tag must not make analysis fail; use the Unicode fallback below.
    }
  }
  return fallbackTokens(text, lang);
}

function analyzeText(value, opts) {
  opts = opts || {};
  const text = normalizeText(value);
  const tokens = tokenizeText(text, opts);
  const byKey = new Map();
  for (const token of tokens) {
    let term = byKey.get(token.key);
    if (!term) {
      term = { key: token.key, surface: token.surface, count: 0, occurrences: [] };
      byKey.set(token.key, term);
    }
    term.count++;
    term.occurrences.push({ surface: token.surface, start: token.start, end: token.end });
  }
  return {
    text,
    lang: languageTag(opts.lang) || null,
    tokens,
    terms: Array.from(byKey.values()),
  };
}

module.exports = { normalizeText, foldText, tokenizeText, analyzeText };
