// curriculum-plan.js -- PLAN §7.0 CP3: proposed curriculum plan, still REPORT-ONLY.
//
// "Emit concepts, reasons, prerequisites, ordering, and suitable existing exercise families for a
// text/chapter/learner. Compare it with current generated lessons on a small representative set;
// still emit no new lessons." (roadmap_v83.md, PLAN §7.0, migration sequence step 3.)
//
// UNLIKE CP2, this stage makes NO new LLM call. CP2 already did the language-knowledge work (what a
// token means, what form it is); CP3's job is a POLICY decision over facts CP2 already established
// -- which of those already-known facts are worth teaching, in what order, through which of the
// app's existing exercise families, and why. That is aggregation and ordering, not a second opinion
// on what a word means, so it stays a deterministic transform of CP2's own output -- the same
// category CP1 was in, easier to test, and it keeps "what does this mean" (CP2) cleanly separate
// from "should we teach it, and when" (CP3).
//
// Scope, deliberately narrow for this stage (matching CP1/CP2's own practice of stating exactly what
// was left out): plans are CHAPTER/TEXT-level only, not LEARNER-level. The plan's own migration
// sequence puts per-learner adaptation at CP5 ("consume the plan read-only" against skill data) --
// building it here would be guessing at a policy nobody has asked for yet.
//
// STANDALONE ON PURPOSE, same reasoning as CP1/CP2: does not depend on server.js's own HTTP
// machinery (server.js binds a port as a side effect of being loaded). Reads only its own input
// files (CP2's canonical-analysis.json, and lessons.json READ-ONLY for the comparison step) -- never
// server.js's in-memory state.
'use strict';

const CP3_PIPELINE_VERSION = 1;
function cp3Provenance(extra) {
  return Object.assign({
    stage: 'CP3',
    pipelineVersion: CP3_PIPELINE_VERSION,
    producedBy: 'curriculum-plan.js',
    at: new Date().toISOString(),
  }, extra || {});
}

// One concept per distinct resolved lemma in a CP2 chapter analysis record (a token with no lemma
// -- "unresolved" -- contributes nothing: there is no concept to propose from a token CP2 itself
// could not resolve). Occurrences across every sentence are aggregated so a lemma appearing five
// times becomes ONE concept with frequency 5, not five.
function extractVocabConcepts(chapterAnalysis) {
  const byLemma = new Map();
  (chapterAnalysis.sentences || []).forEach((s, sIdx) => {
    (s.tokens || []).forEach(t => {
      if (!t.lemma) return;
      let c = byLemma.get(t.lemma);
      if (!c) { c = { lemma: t.lemma, forms: new Set(), occurrences: [] }; byLemma.set(t.lemma, c); }
      if (t.form) c.forms.add(t.form);
      c.occurrences.push({ tokenId: t.tokenId, sentenceId: s.sentenceId, sentenceIdx: sIdx, sense: t.sense, confidence: t.confidence });
    });
  });
  return Array.from(byLemma.values()).map(c => buildVocabConcept(chapterAnalysis, c));
}

function buildVocabConcept(chapterAnalysis, c) {
  const forms = Array.from(c.forms);
  const hasMultipleForms = forms.length > 1;
  const anyLow = c.occurrences.some(o => o.confidence !== 'high');
  const bestSense = (c.occurrences.find(o => o.confidence === 'high' && o.sense) || c.occurrences.find(o => o.sense) || {}).sense || null;
  const families = ['standard'];
  if (hasMultipleForms) { families.push('word_forms'); families.push('inflections'); }
  if (forms.some(f => /verb/i.test(f))) families.push('conjugation');

  const reasonParts = [`appears ${c.occurrences.length} time(s) in this sample`];
  if (hasMultipleForms) {
    reasonParts.push(`in ${forms.length} distinct forms (${forms.slice(0, 3).join('; ')}${forms.length > 3 ? '; …' : ''}) — a form-recognition exercise is warranted`);
  }
  if (anyLow) reasonParts.push('at least one occurrence was a low-confidence or unresolved model proposal — review before use');

  return {
    conceptId: chapterAnalysis.chapterId + ':concept:vocab:' + c.lemma,
    type: 'vocab',
    lemma: c.lemma,
    lang: chapterAnalysis.lang,
    sense: bestSense,
    forms,
    frequency: c.occurrences.length,
    firstSentenceIdx: c.occurrences[0].sentenceIdx,
    confidence: anyLow ? 'low' : 'high',
    sourceSpans: c.occurrences.map(o => o.tokenId),
    suitableFamilies: [...new Set(families)],
    planReason: reasonParts.join('; '),
    prerequisites: [],   // a vocab concept never depends on another concept, by construction
  };
}

// One concept per distinct validated CP2 phrase (grouped by the phrase's own lemma string, e.g.
// "take care of"). A phrase that only ever shows up under one gloss is one concept, occurring N
// times; prerequisites (which VOCAB concepts, if any, cover this phrase's own component words) are
// filled in separately by linkPhrasePrerequisites, once every chapter's vocab concepts are known.
function extractPhraseConcepts(chapterAnalysis) {
  const byLemma = new Map();
  (chapterAnalysis.sentences || []).forEach((s, sIdx) => {
    (s.phrases || []).forEach(p => {
      if (!p.lemma) return;
      let c = byLemma.get(p.lemma);
      if (!c) { c = { lemma: p.lemma, gloss: p.gloss, occurrences: [] }; byLemma.set(p.lemma, c); }
      c.occurrences.push({ tokenIds: p.tokenIds, sentenceId: s.sentenceId, sentenceIdx: sIdx, confidence: p.confidence });
    });
  });
  return Array.from(byLemma.values()).map(c => {
    const anyLow = c.occurrences.some(o => o.confidence !== 'high');
    const recurring = c.occurrences.length > 1;
    return {
      conceptId: chapterAnalysis.chapterId + ':concept:phrase:' + c.lemma,
      type: 'phrase',
      lemma: c.lemma,
      lang: chapterAnalysis.lang,
      sense: c.gloss,
      frequency: c.occurrences.length,
      firstSentenceIdx: c.occurrences[0].sentenceIdx,
      confidence: anyLow ? 'low' : 'high',
      sourceSpans: c.occurrences.flatMap(o => o.tokenIds),
      suitableFamilies: ['standard'],
      planReason: (recurring ? 'a recurring' : 'a') + ' multiword phrase the model flagged as one teaching unit rather than separate words' +
        (anyLow ? '; at least one occurrence was low-confidence — review before use' : ''),
      prerequisites: [],
    };
  });
}

// A phrase's prerequisites are the VOCAB concepts (if proposed) covering the phrase's own
// constituent tokens' lemmas — "teach the parts before the whole." This is the one prerequisite
// relationship this stage actually has evidence for; it does not model grammar-level teaching order
// (e.g. "present tense before past tense") — that needs language knowledge this deterministic layer
// deliberately does not have.
function linkPhrasePrerequisites(vocabConcepts, phraseConcepts, chapterAnalysis) {
  const tokenLemma = new Map();
  (chapterAnalysis.sentences || []).forEach(s => (s.tokens || []).forEach(t => { if (t.lemma) tokenLemma.set(t.tokenId, t.lemma); }));
  const vocabIdByLemma = new Map(vocabConcepts.map(v => [v.lemma, v.conceptId]));
  phraseConcepts.forEach(p => {
    const lemmas = new Set(p.sourceSpans.map(tid => tokenLemma.get(tid)).filter(Boolean));
    p.prerequisites = Array.from(lemmas).map(l => vocabIdByLemma.get(l)).filter(Boolean);
  });
}

// Deterministic ordering: higher sample frequency first (a proxy for "more useful to know"), then
// earlier first occurrence as a tie-break -- BUT a concept's prerequisites always come before it,
// even when the raw frequency order would put it later (a phrase can be more frequent than one of
// its own component words). Kahn's-algorithm style: repeatedly place whichever not-yet-placed
// concept has the best base priority among those whose prerequisites are ALL already placed. The
// prerequisite graph this stage produces is shallow (vocab has none; a phrase depends only on
// vocab), so a cycle should not occur — the fallback below exists so a future extension that DOES
// introduce a cycle degrades to "ignore the unmet prerequisite" rather than looping forever.
function orderConcepts(concepts) {
  const basePriority = new Map();
  concepts.slice()
    .sort((a, b) => (b.frequency - a.frequency) || (a.firstSentenceIdx - b.firstSentenceIdx))
    .forEach((c, i) => basePriority.set(c.conceptId, i));

  const byId = new Map(concepts.map(c => [c.conceptId, c]));
  const remaining = new Set(concepts.map(c => c.conceptId));
  const placed = new Set();
  const out = [];
  while (remaining.size) {
    let best = null;
    for (const id of remaining) {
      const ready = byId.get(id).prerequisites.every(p => placed.has(p) || !byId.has(p));
      if (!ready) continue;
      if (best === null || basePriority.get(id) < basePriority.get(best)) best = id;
    }
    if (best === null) {   // an unexpected cycle — break it deterministically rather than hang
      best = Array.from(remaining).sort((a, b) => basePriority.get(a) - basePriority.get(b))[0];
    }
    placed.add(best); remaining.delete(best); out.push(byId.get(best));
  }
  return out.map((c, i) => Object.assign({}, c, { order: i }));
}

// "Compare it with current generated lessons on a small representative set" — read-only against a
// lessons.json topic's ALREADY-generated lessons (never written to). Case-insensitive lemma-vs-
// vocab.target match, since the existing generator's casing conventions are not this stage's concern.
function compareWithExistingLessons(vocabConcepts, topic) {
  const existingTargets = new Set();
  ((topic && topic.lessons) || []).forEach(l => {
    (l.vocab || []).forEach(v => { if (v && v.target) existingTargets.add(String(v.target).toLowerCase()); });
  });
  const notCoveredByExisting = vocabConcepts.filter(c => !existingTargets.has(c.lemma.toLowerCase())).map(c => c.lemma);
  const coveredByExisting = vocabConcepts.length - notCoveredByExisting.length;
  const proposedLemmas = new Set(vocabConcepts.map(c => c.lemma.toLowerCase()));
  const existingNotProposed = Array.from(existingTargets).filter(t => !proposedLemmas.has(t));
  return { proposedCount: vocabConcepts.length, coveredByExisting, notCoveredByExisting, existingNotProposed };
}

// The one function build-curriculum-plan.js calls per chapter. Takes a CP2 chapter analysis record
// and (optionally) the matching lessons.json topic for the comparison step.
function buildCurriculumPlan(chapterAnalysis, opts) {
  opts = opts || {};
  if (!chapterAnalysis || !chapterAnalysis.chapterId) throw new Error('buildCurriculumPlan: a CP2 chapter analysis record with chapterId is required');
  const vocabConcepts = extractVocabConcepts(chapterAnalysis);
  const phraseConcepts = extractPhraseConcepts(chapterAnalysis);
  linkPhrasePrerequisites(vocabConcepts, phraseConcepts, chapterAnalysis);
  const concepts = orderConcepts([...vocabConcepts, ...phraseConcepts]);
  const result = {
    chapterId: chapterAnalysis.chapterId,
    lang: chapterAnalysis.lang,
    conceptCount: concepts.length,
    concepts,
    provenance: cp3Provenance({ chapterId: chapterAnalysis.chapterId }),
  };
  if (opts.existingTopic) result.comparison = compareWithExistingLessons(vocabConcepts, opts.existingTopic);
  return result;
}

module.exports = {
  CP3_PIPELINE_VERSION,
  cp3Provenance,
  extractVocabConcepts,
  extractPhraseConcepts,
  linkPhrasePrerequisites,
  orderConcepts,
  compareWithExistingLessons,
  buildCurriculumPlan,
};
