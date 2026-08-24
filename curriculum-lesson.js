// curriculum-lesson.js -- PLAN §7.0 CP4: one lesson family through the existing contract, starting
// with vocabulary meaning/form. STILL never writes lessons.json — this is a NEW, PARALLEL emission
// route, not a replacement for the legacy generator.
//
// "CP4 — one lesson family through the existing contract. Start with vocabulary meaning/form,
// validate it, and retain the legacy generation route in parallel. Only then add language-specific
// families such as conjugation, grammar, articles, error patterns, and comprehension." (roadmap_v83.md,
// PLAN §7.0, migration sequence step 4.)
//
// UNLIKE CP2, this stage makes NO new model call, for the same reason CP3 did not: CP2 already
// proposed a lemma and a contextual sense for every resolved token, and CP3 already decided WHICH of
// those are worth teaching, in what order, and why. Turning a CP3 vocab concept into a
// `lessons.json`-SHAPED lesson object is packaging, not a fresh judgment about meaning -- the target
// is the concept's own SURFACE form (v83_p: what the learner actually saw in the story, NOT the
// dictionary lemma -- pairing the lemma against a contextually-inflected sense produced a real,
// user-reported register mismatch), the source is the concept's own CP2-derived sense, and `lemma`
// is carried as its own separate field. No invention happens here that CP1-3 had not already done
// and recorded.
//
// SCOPE, stated up front the way every earlier stage has: vocabulary (meaning/form) ONLY, per the
// plan's own "start with" wording -- conjugation/grammar/articles/error-patterns/comprehension are
// explicitly LATER work, not this file's job. Example SENTENCES are also deliberately NOT emitted at
// this stage (`sentences: []` throughout): a real one would need translating the exact story
// sentence a concept occurs in, which is a genuine (if narrow) NEW model call this stage does not
// make -- recorded as future work, not silently faked with an empty/placeholder translation.
// `skillLinks` is left EMPTY on purpose too: Track B's own relationship note (§7.0's own text) warns
// that "future lesson.skillLinks must preserve [B2's] reviewed canonical identity rather than invent
// per-generator dialects" -- wiring real skill tagging here would mean inventing exactly that
// dialect, so it stays an open TODO rather than a shortcut.
//
// "Validate it": `validateLessonShape` checks the SAME structural floor `generateOneLesson` already
// enforces on its own model output before accepting it (at least one vocab item, non-empty
// target/source, no duplicate targets, the identical-source-target ratio server.js's own generator
// already tracks) -- proving a CP4-emitted lesson would clear the SAME acceptance bar a freshly
// model-generated one has to. It reports rather than throws, matching this whole pipeline's
// "expose, don't silently guess" ethic.
//
// "Retain the legacy generation route in parallel": by construction. This file does not touch
// server.js's generateOneLesson/generate() at all, and its own CLI writes to its OWN separate store
// (curriculum-lesson.json), never to lessons.json.
//
// STANDALONE ON PURPOSE, same reasoning as CP1-3: does not depend on server.js's own HTTP machinery.
'use strict';

const CP4_PIPELINE_VERSION = 1;
function cp4Provenance(extra) {
  return Object.assign({
    stage: 'CP4',
    pipelineVersion: CP4_PIPELINE_VERSION,
    producedBy: 'curriculum-lesson.js',
    at: new Date().toISOString(),
  }, extra || {});
}

// Turns a CP3 curriculum plan for ONE chapter into ONE "standard" (vocabulary meaning/form) lesson
// object, shaped exactly like server.js's own generateOneLesson output (id/type/title/desc/icon/
// vocab/sentences), PLUS the plan's own mandatory provenance fields (sourceSpans/planReason/
// pipelineVersion) that CP1-3 have been carrying all along. Concepts are taken in CP3's OWN order
// (already frequency/prerequisite-ordered) and capped at `maxItems` (default 8, the SAME cap
// generateOneLesson applies to a model's own vocab list, for parity).
function emitVocabLesson(plan, opts) {
  opts = opts || {};
  if (!plan || !plan.chapterId) throw new Error('emitVocabLesson: a CP3 chapter plan with chapterId is required');
  const maxItems = Number.isInteger(opts.maxItems) && opts.maxItems > 0 ? opts.maxItems : 8;
  const vocabConcepts = (plan.concepts || []).filter(c => c.type === 'vocab').slice(0, maxItems);
  if (!vocabConcepts.length) throw new Error(`emitVocabLesson: plan for ${plan.chapterId} has no vocab concepts to teach`);

  return {
    id: opts.lessonNum || 1,
    type: 'standard',
    title: opts.title || `Vocabulary — ${plan.chapterId}`,
    desc: opts.desc || `${vocabConcepts.length} word(s) proposed by PLAN §7.0 CP1-3 for ${plan.chapterId}`,
    icon: '📖',
    // v83_p: target is the SURFACE form (what the learner actually sees in the story), paired with
    // the CONTEXTUAL sense -- both in the SAME grammatical register (a user report found "kommen"
    // (lemma, infinitive) paired against "venne" (sense, past tense) — a register mismatch one
    // level up, at CP3, where surface/sense are now chosen from the SAME occurrence). `lemma` is
    // kept as its own field: the concept's stable dictionary identity, not what is shown/taught.
    vocab: vocabConcepts.map(c => ({ target: c.surface || c.lemma, source: c.sense || '', lemma: c.lemma, conceptId: c.conceptId })),
    sentences: [],   // deliberately empty at this stage -- see file header
    skillLinks: [],  // deliberately unresolved -- see file header
    sourceSpans: vocabConcepts.flatMap(c => c.sourceSpans || []),
    planReason: vocabConcepts.map(c => c.planReason),
    pipelineVersion: CP4_PIPELINE_VERSION,
    provenance: cp4Provenance({ chapterId: plan.chapterId, conceptCount: vocabConcepts.length }),
  };
}

// The identical-source-target ratio server.js's own generateOneLesson already tracks (v53_g's own
// constants, copied verbatim -- see server.js for the measurement that produced them). Reported here
// as information, not a hard failure: server.js's own leniency for CLOSE language pairs depends on
// isCloseLangPair, a per-language table this pure module deliberately does not duplicate speculatively.
const IDENTICAL_MIN_ITEMS = 3;
const IDENTICAL_MIN_RATIO = 0.6;

// Checks a lesson object against the SAME structural floor generateOneLesson enforces on its own
// model output before accepting it. Returns a REPORT ({valid, errors, warnings, identicalRatio}),
// never throws -- one malformed lesson must not abort a batch, and "expose uncertainty" beats
// silently discarding or silently accepting.
function validateLessonShape(lesson) {
  const errors = [];
  const warnings = [];
  if (!lesson || !Array.isArray(lesson.vocab) || lesson.vocab.length < 1) {
    errors.push('vocab must be a non-empty array');
    return { valid: false, errors, warnings, identicalRatio: 0 };
  }
  const seen = new Set();
  lesson.vocab.forEach((v, i) => {
    if (!v || typeof v.target !== 'string' || !v.target.trim()) errors.push(`vocab[${i}]: target is empty`);
    if (!v || typeof v.source !== 'string' || !v.source.trim()) errors.push(`vocab[${i}]: source is empty`);
    const key = v && v.target ? v.target.trim().toLowerCase() : null;
    if (key) { if (seen.has(key)) errors.push(`vocab[${i}]: duplicate target "${v.target}"`); seen.add(key); }
  });
  const identicalItems = lesson.vocab.filter(v => v && v.target && v.source && v.target.trim().toLowerCase() === v.source.trim().toLowerCase());
  const identicalRatio = lesson.vocab.length ? identicalItems.length / lesson.vocab.length : 0;
  if (identicalItems.length >= IDENTICAL_MIN_ITEMS && identicalRatio >= IDENTICAL_MIN_RATIO) {
    warnings.push(`${identicalItems.length}/${lesson.vocab.length} vocab items (${Math.round(identicalRatio * 100)}%) have identical source/target — review before use (may be legitimate for a close language pair, not judged here)`);
  }
  if (Array.isArray(lesson.sentences)) {
    lesson.sentences.forEach((s, i) => {
      if (!s || typeof s.target !== 'string' || !s.target.trim()) errors.push(`sentences[${i}]: target is empty`);
      if (!s || typeof s.source !== 'string' || !s.source.trim()) warnings.push(`sentences[${i}]: no source translation`);
    });
  } else {
    errors.push('sentences must be an array (may be empty)');
  }
  return { valid: errors.length === 0, errors, warnings, identicalRatio };
}

// Convenience wrapper: one vocabulary lesson per chapter plan, plus its own validation report.
function emitChapterLessons(plan, opts) {
  const lesson = emitVocabLesson(plan, opts);
  return { lessons: [lesson], validation: validateLessonShape(lesson) };
}

module.exports = {
  CP4_PIPELINE_VERSION,
  cp4Provenance,
  emitVocabLesson,
  validateLessonShape,
  emitChapterLessons,
};
