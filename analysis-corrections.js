// analysis-corrections.js — item AI, first cut (v88_ad): the curator's OVERLAY over CP2's output.
//
// PLAN §7.0 CP1/CP2 produces `canonical-analysis.json`: the model's raw token analysis, rewritten
// wholesale by every run. This module holds the human corrections that sit ON TOP of it, in their
// own store, and merges the two on read.
//
// ── Why an overlay and not an edit-in-place ──────────────────────────────────────────────────────
// The user's ruling at the v88_ac handover, answering the design question item AI has carried since
// v86_s ("does a correction survive a re-analysis?"): YES, corrections are sticky. Editing
// canonical-analysis.json in place cannot deliver that — `force:true` calls deleteAnalysisChapter,
// which drops the WHOLE chapter record, and CP2 then rewrites every token from scratch. Any edit
// made in place is silently lost on the next run, which is the exact class of loss this project has
// already paid for twice (item AN's image description, v88_y's chapter title). Keeping curation in
// a separate file means the model's output stays the model's output and a re-analysis cannot
// destroy human work.
//
// ── ⚠️ THE KEY IS NOT `tokenId` ─────────────────────────────────────────────────────────────────
// The obvious key is the token's own id, and it is WRONG. `tokenId` is `chapterId:sN:tM` — a pure
// INDEX into the current segmentation. It survives nothing: a story edit that inserts a sentence
// renumbers every sentence after it, and a re-tokenisation shifts `tM` within a sentence. A
// correction keyed that way would silently re-attach to a DIFFERENT word, which is worse than
// losing it — the curator would never know.
//
// So the key is (sentence TEXT, token SURFACE, which occurrence of that surface in that sentence).
// That is v88_x's own precedent, which matched resumed sentences on TEXT for exactly these reasons
// and was verified live. It survives renumbering, insertion and a story that grew; it correctly
// STOPS applying when the sentence itself is rewritten, which is the one case where a correction
// really may no longer belong.
'use strict';
const fs = require('fs');
const path = require('path');

// Resolved per CALL, not once at require time, so a test (or build-static) can point this at an
// isolated scratch file by setting the env var before invoking — the same convention
// CANONICAL_ANALYSIS_FILE already uses, and for the same reason: e2e-analysis's own comment records
// that a run which writes the real project-root store pollutes the working tree and leaves a later
// run reading a stale cache from an earlier one.
function correctionsFile() {
  return process.env.ANALYSIS_CORRECTIONS_FILE || path.join(__dirname, 'analysis-corrections.json');
}

// Absence is the NORMAL case (no chapter has ever been curated), so an unreadable or missing file is
// an empty store, never an error — same shape and same reasoning as readAnalysisStore's own.
function readCorrectionsStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(correctionsFile(), 'utf8'));
    if (parsed && typeof parsed === 'object') { parsed.chapters = parsed.chapters || {}; return parsed; }
  } catch (e) { /* absent or unreadable — the common case */ }
  return { schemaVersion: 1, chapters: {} };
}

function writeCorrectionsStore(store) {
  store.schemaVersion = 1;
  store.generatedAt = new Date().toISOString();
  store.chapterCount = Object.keys(store.chapters).length;
  fs.writeFileSync(correctionsFile(), JSON.stringify(store, null, 2), 'utf8');
}

function correctionsFor(chapterId) {
  if (!chapterId) return [];
  const c = readCorrectionsStore().chapters[chapterId];
  return (c && Array.isArray(c.corrections)) ? c.corrections : [];
}

// The identity of one correction. Kept as a function rather than inlined at both call sites so the
// writer and the merger cannot disagree about what "the same token" means.
function correctionKey(sentenceText, surface, occurrence) {
  return JSON.stringify([String(sentenceText || ''), String(surface || ''), Number(occurrence) || 0]);
}

// Upsert: correcting the same token twice REPLACES rather than appending, so the store cannot grow a
// pile of superseded edits that the merge would then have to disambiguate by order.
function saveCorrection(chapterId, corr) {
  if (!chapterId || !corr || !corr.sentenceText || !corr.surface) return null;
  const store = readCorrectionsStore();
  const entry = store.chapters[chapterId] || (store.chapters[chapterId] = { corrections: [] });
  const key = correctionKey(corr.sentenceText, corr.surface, corr.occurrence);
  const rec = {
    sentenceText: String(corr.sentenceText),
    surface: String(corr.surface),
    occurrence: Number(corr.occurrence) || 0,
    lemma: String(corr.lemma || '').trim(),
    form: String(corr.form || '').trim(),
    sense: String(corr.sense || '').trim(),
    correctedAt: new Date().toISOString(),
  };
  const i = entry.corrections.findIndex(c =>
    correctionKey(c.sentenceText, c.surface, c.occurrence) === key);
  if (i >= 0) entry.corrections[i] = rec; else entry.corrections.push(rec);
  writeCorrectionsStore(store);
  return rec;
}

// Removes ONE correction, letting the model's own analysis show through again.
function deleteCorrection(chapterId, corr) {
  const store = readCorrectionsStore();
  const entry = store.chapters[chapterId];
  if (!entry || !Array.isArray(entry.corrections)) return false;
  const key = correctionKey(corr && corr.sentenceText, corr && corr.surface, corr && corr.occurrence);
  const before = entry.corrections.length;
  entry.corrections = entry.corrections.filter(c =>
    correctionKey(c.sentenceText, c.surface, c.occurrence) !== key);
  if (entry.corrections.length === before) return false;
  if (!entry.corrections.length) delete store.chapters[chapterId];
  writeCorrectionsStore(store);
  return true;
}

// ⚠️ Called from the CHAPTER-DELETE route, never from the force-re-analyse path. That distinction is
// the whole feature: deleting the chapter must take its curation with it (v88_ac fixed exactly this
// leak for canonical-analysis.json — 5 of 20 entries were orphans of deleted chapters — and a second
// per-chapter store added without the same cleanup would reintroduce it immediately), while
// re-analysing must LEAVE it, which is what makes a correction sticky.
function deleteChapterCorrections(chapterId) {
  const store = readCorrectionsStore();
  if (!store.chapters[chapterId]) return false;
  delete store.chapters[chapterId];
  writeCorrectionsStore(store);
  return true;
}

// The merge. PURE — takes sentences and corrections, returns new sentences, touches no disk — so it
// can be unit-tested directly and reused by anything that renders an analysis.
//
// ⚠️ Applied on READ, in analysisShadowFor, NOT baked in at write time. A correction made after the
// last analysis must show immediately, and baking would mean it only appeared after the NEXT
// re-analysis — which is the opposite of the ruling. It also keeps canonical-analysis.json honestly
// the model's own output.
//
// `reviewed: true` is what marks a curated token. That flag has existed in CP2's own schema since
// the beginning — canonical-analysis.js writes `reviewed: false` at three sites — and nothing has
// ever set it or read it (533 of 533 tokens sat at the default when this was written). This is the
// feature it was reserved for.
//
// `confidence` is forced to 'high' because "resolved" is defined downstream as `t.lemma` being
// truthy (_analysisSentenceUsable, computeFrequency) while the RENDERER styles on `confidence`.
// Leaving a curated token at 'unresolved' would have it count as resolved in the data and still
// render dashed-and-faint as un-analysed — the two disagreeing about the same token, which is the
// asymmetry item AY was.
function applyCorrections(sentences, corrections) {
  if (!Array.isArray(sentences) || !corrections || !corrections.length) return sentences;
  const byKey = new Map();
  for (const c of corrections) {
    if (c && c.sentenceText && c.surface)
      byKey.set(correctionKey(c.sentenceText, c.surface, c.occurrence), c);
  }
  if (!byKey.size) return sentences;
  return sentences.map(sent => {
    if (!sent || !Array.isArray(sent.tokens) || !sent.text) return sent;
    const seen = new Map();
    let touched = false;
    const tokens = sent.tokens.map(tok => {
      if (!tok) return tok;
      const surface = String(tok.surface || '');
      const n = seen.get(surface) || 0;
      seen.set(surface, n + 1);
      const hit = byKey.get(correctionKey(sent.text, surface, n));
      if (!hit) return tok;
      touched = true;
      // Only non-empty fields override. Clearing a field in the editor is how a curator says
      // "the model's value was fine" for that one field, not "blank it out" — a blanked lemma
      // would UNRESOLVE the token, which no curator would mean by leaving a box empty.
      return { ...tok,
        ...(hit.lemma ? { lemma: hit.lemma } : {}),
        ...(hit.form  ? { form:  hit.form  } : {}),
        ...(hit.sense ? { sense: hit.sense } : {}),
        confidence: 'high', reviewed: true };
    });
    return touched ? { ...sent, tokens } : sent;
  });
}

module.exports = {
  correctionsFile, readCorrectionsStore, correctionsFor, correctionKey,
  saveCorrection, deleteCorrection, deleteChapterCorrections, applyCorrections,
};
