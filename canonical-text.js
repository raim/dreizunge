// canonical-text.js -- PLAN section 7.0 CP1: canonical text + analysis records, REPORT-ONLY.
//
// "Define stable story/chapter/sentence/span/token records and provenance. Analyse a small
// representative corpus without changing any existing lesson, learner state, player, or publishing
// output." (roadmap_v83.md, PLAN section 7.0, migration sequence step 1 -- "the next implementation
// slice.")
//
// This module is the pure, testable core: given ONE topic (as already shaped in lessons.json), it
// derives a stable chapter -> sentence -> token record tree with provenance. It touches NOTHING --
// no file I/O, no lessons.json write, no player/progress state. build-canonical-text.js (the CLI
// wrapper) is what reads the corpus and writes the OUTPUT to its own separate store
// (canonical-text.json), never to lessons.json.
//
// STANDALONE ON PURPOSE — deliberately does NOT import server.js (not spelled as a literal `require`
// call anywhere in this file: a later test scans the source text for exactly that call to prove the
// dependency stays absent, and a comment spelling it would defeat its own check). server.js binds an
// HTTP port as a side effect
// of being loaded (no require.main guard), so requiring it here would start a live server as a
// side effect of running an offline analysis script. Instead this file MIRRORS the tokenisation
// primitives server.js already has (qcSplitSentences, jaTokenize, isPunct, CJK_LANGS) -- the same
// duplication convention this project already uses between server.js and index.html for jaTokenize
// itself (each carries its own copy, kept in step by comment cross-reference rather than a shared
// import, because there is no bundler here to share one). Any future change to server.js's copies
// should be checked against these for drift.
//
// All non-ASCII code points below are written as explicit \uXXXX escape sequences, never as literal
// characters in the source -- matching server.js's own jaTokenize verbatim, and avoiding a class of
// silent corruption where an invisible/combining character fails to round-trip through an edit.
//
// "No language knowledge in the code" (the project's own standing design principle -- see
// CLAUDE.md/INTERNALS.md): sentence and token splitting are Unicode-class-based (script-class
// membership via CJK_LANGS, punctuation via a fixed Unicode-punctuation regex), never a per-
// language table. CJK_LANGS/isPunct are copied VERBATIM from server.js so the definition of "no
// language knowledge" here matches the project's existing definition of it, not a new one.
'use strict';
const crypto = require('crypto');

// ---- Mirrors server.js (see file header for why this is a copy, not an import) ----------------
const CJK_LANGS = new Set(['ja', 'zh', 'ko']);
const isPunct = t => /^[.,!?;:()\[\]"'«»—–]+$/.test(t.trim());

// Unicode Private Use Area sentinels (U+E000 / U+E001) protect a kanji+furigana group
// ("BASE[reading]") from being split apart by the tokeniser below, exactly as server.js's own
// jaTokenize does.
function jaTokenize(raw) {
  const groups = [];
  const protectedStr = String(raw || '').replace(
    /[一-鿿㐀-䶿々〆〇]+\[[^\]]+\]/g,
    (g) => { const i = groups.push(g) - 1; return '\uE000' + i + '\uE001'; });
  const re = /\uE000\d+\uE001|[぀-ヿ＀-￯!-~a-zA-Z0-9]+|[一-鿿㐀-䶿々〆〇]+/g;
  const tokens = [];
  let m;
  while ((m = re.exec(protectedStr)) !== null) {
    let tok = m[0];
    const sm = /^\uE000(\d+)\uE001$/.exec(tok);
    if (sm) tok = groups[+sm[1]];
    if (tok.length > 0) tokens.push(tok);
  }
  return tokens;
}

// Sentence-level (not clause-level) splitting, mirroring server.js's qcSplitSentences -- after a
// sentence-ender plus any closing quote/bracket, not on commas (server.js's OTHER splitter,
// splitSentences, breaks on commas too; that is right for its own caller, ai_error_hunt's short
// clause items, and wrong for a canonical sentence record). Paragraph breaks ARE kept here (as a
// paraBreakBefore flag on the first sentence of each paragraph) -- qcSplitSentences itself discards
// them, which CP1 cannot afford to: a chapter's paragraph structure is part of what "stable" means.
function splitCanonicalSentences(text) {
  const out = [];
  String(text || '').split(/\n\n+/).forEach((para, pi) => {
    para.trim()
      .split(/(?<=[.!?][“”»'\)\]]*)\s+/)
      .map(s => s.trim()).filter(Boolean)
      .forEach((s, si) => out.push({ text: s, paraBreakBefore: si === 0 && pi > 0 }));
  });
  return out;
}

// Token-level splitting for ONE sentence. Reuses jaTokenize for Japanese (the only CJK language
// currently in the corpus), a simple character split for Chinese/Korean (script-class based, same
// choice server.js's own deriveSentenceWords makes for its exercise-scrambling use), and whitespace
// splitting for everything else -- punctuation-only tokens dropped in both cases, matching isPunct.
// Deliberately WITHOUT deriveSentenceWords' pairwise-merge-when-long step: that step exists to keep
// a sentence-ordering EXERCISE playable (too many draggable tiles is a UX problem), which has
// nothing to do with a canonical token record -- CP1 wants the raw token granularity.
function tokenizeCanonicalSentence(text, lang) {
  if (lang && CJK_LANGS.has(lang)) {
    if (lang === 'ja') return jaTokenize(text);
    return [...text].filter(c => /\S/.test(c) && !isPunct(c));
  }
  return String(text || '').split(/\s+/).filter(t => t && !isPunct(t));
}

// A short, deterministic content hash -- NOT for security, purely so a consumer can tell whether the
// text at a given stable ID has drifted since this record was built (the plan's own requirement:
// "an older result is visibly old rather than being represented as if the current logic had produced
// it"). 12 hex chars is ample collision resistance for "did this substring change", not a security
// property.
function textHash(s) {
  return crypto.createHash('sha1').update(String(s || ''), 'utf8').digest('hex').slice(0, 12);
}

// Provenance shape SPECIFIC to this pipeline, not server.js's buildGenMeta -- buildGenMeta's shape
// (model, promptTokens, attempts, rejectReasons...) describes a MODEL generation call, and CP1 makes
// none: it is a deterministic transform of already-generated text, with no LLM in the loop. Forcing
// it into buildGenMeta's shape would either fabricate fields that do not apply or require a model
// sentinel that misdescribes what happened. pipelineVersion is the field name PLAN section 7.0
// itself names for this purpose (lesson.pipelineVersion), reused here at the chapter-analysis level.
const CP1_PIPELINE_VERSION = 1;
function cp1Provenance(extra) {
  return Object.assign({
    stage: 'CP1',
    pipelineVersion: CP1_PIPELINE_VERSION,
    producedBy: 'canonical-text.js',
    at: new Date().toISOString(),
  }, extra || {});
}

// The one function build-canonical-text.js calls per topic. Takes a topic exactly as shaped in
// lessons.json ({id, story, lang, srcLang, ...}) and returns the canonical record tree -- sentences
// and their tokens, each with a STABLE id (derived from POSITION within a deterministic split, not
// randomly generated, so re-running this on unchanged text reproduces the same ids every time) and a
// content hash (so a caller CAN detect when the underlying story text has since changed).
//
// chapterId reuses the topic's OWN existing id verbatim -- it is already stable and unique; CP1 does
// not need (and must not invent) a second id scheme for the chapter level.
function buildCanonicalText(topic) {
  if (!topic || typeof topic !== 'object') throw new Error('buildCanonicalText: a topic object is required');
  const chapterId = topic.id;
  if (!chapterId) throw new Error('buildCanonicalText: topic.id is required -- CP1 reuses it as chapterId, never invents a second scheme');
  const story = String(topic.story || '');
  const lang = topic.lang || null;

  const rawSentences = splitCanonicalSentences(story);
  const sentences = rawSentences.map((rs, si) => {
    const sentenceId = chapterId + ':s' + si;
    const rawTokens = tokenizeCanonicalSentence(rs.text, lang);
    const tokens = rawTokens.map((tokText, ti) => ({
      tokenId: sentenceId + ':t' + ti,
      idx: ti,
      text: tokText,
    }));
    return {
      sentenceId,
      idx: si,
      text: rs.text,
      paraBreakBefore: rs.paraBreakBefore,
      textHash: textHash(rs.text),
      tokens,
    };
  });

  return {
    chapterId,
    lang,
    srcLang: topic.srcLang || null,
    sourceTextHash: textHash(story),
    sentenceCount: sentences.length,
    tokenCount: sentences.reduce((n, s) => n + s.tokens.length, 0),
    sentences,
    provenance: cp1Provenance({ chapterId }),
  };
}

module.exports = {
  CP1_PIPELINE_VERSION,
  splitCanonicalSentences,
  tokenizeCanonicalSentence,
  textHash,
  cp1Provenance,
  buildCanonicalText,
};
