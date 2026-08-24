// canonical-analysis.js -- PLAN §7.0 CP2: analysis report (lemma/form/phrase/sense/frequency/
// script proposals), still REPORT-ONLY.
//
// "Add lemma/form/phrase/sense/frequency/script proposals and retain the exact derivation or model
// evidence. This is language analysis, not client-side morphology; it must expose uncertainty/
// review rather than silently guessing." (roadmap_v83.md, PLAN §7.0, migration sequence step 2.)
//
// Unlike CP1 (canonical-text.js), CP2 IS model-in-the-loop: a lemma, its grammatical form, and its
// contextual sense cannot be derived from Unicode script classes the way sentence/token splitting
// could -- that is real language knowledge, which this project's own standing principle keeps out
// of client-side code and out of a hand-written table. So this module makes one LLM call per
// sentence and, per the plan's own wording, records what the model said it was SURE of and what it
// was not -- a token the model never answered for is recorded as "unresolved", never silently
// dropped or invented, and a token it answered with low confidence is recorded as "low", a state
// this module can tell apart from "the model never replied at all".
//
// frequency and script are the two fields in the plan's list that need NO model call: frequency is
// a deterministic count over whatever sample was actually analysed (computeFrequency, below), and
// script is a deterministic per-language lookup already recorded in scripts.json (the same file
// server.js's own scriptsForLang reads) -- both are computed here, not asked of the model, so they
// carry no uncertainty field at all.
//
// STANDALONE ON PURPOSE, same reasoning as canonical-text.js: this file does not depend on
// server.js's own HTTP machinery (server.js binds a port as a side effect of being loaded -- no
// require.main guard exists -- so pulling it in from an offline analysis module would start a live
// server as a side effect of running an analysis script). The one thing CP2 genuinely needs that
// canonical-text.js did not -- an actual model call -- is already factored out into its own
// standalone, side-effect-free module: llm.js (server.js requires it too; requiring it here starts
// nothing, binds no port, and reads no file other than scripts.json/languages.json, both plain JSON
// data). Prompt text below is plain U+002D hyphen and ASCII quotes throughout -- no non-ASCII
// literals to worry about escaping (unlike canonical-text.js's ported jaTokenize).
'use strict';
const { callLLM, extractJSON } = require('./llm.js');

let _scriptsData = {};
try { _scriptsData = require('./scripts.json'); } catch (e) { _scriptsData = {}; }

// The script(s) a language is written in, always as a non-empty array -- mirrors server.js's own
// scriptsForLang, falling back to 'latin' for any language scripts.json has no entry for (the same
// implicit default server.js's langName()/hasScriptChoice() machinery assumes).
function scriptsForLangCP2(lang) {
  const m = (_scriptsData._langScript || {})[lang];
  const arr = m ? (Array.isArray(m) ? m : [m]) : [];
  return arr.length ? arr : ['latin'];
}

// Provenance shape SPECIFIC to CP2 -- unlike CP1's cp1Provenance, this one DOES carry a `model`
// field, because a real LLM call produced the content it describes; omitting it here would hide
// which model's proposals a consumer is looking at.
const CP2_PIPELINE_VERSION = 1;
function cp2Provenance(extra) {
  return Object.assign({
    stage: 'CP2',
    pipelineVersion: CP2_PIPELINE_VERSION,
    producedBy: 'canonical-analysis.js',
    at: new Date().toISOString(),
  }, extra || {});
}

// Builds the {sys, user} pair sent to the model for ONE sentence. Tokens are given back to the
// model as a numbered list (0-based `i`, matching their own `idx`) so its reply can be matched back
// up positionally -- the model is never asked to re-derive tokenisation, only to annotate it.
function buildAnalysisPrompt(sentenceText, tokens, langName, srcLangName) {
  const L = langName || 'the target language';
  const S = srcLangName || 'English';
  const sys =
    'You are a careful linguistic analyst working on a language-learning corpus. ' +
    'You will be given ONE sentence in ' + L + ' and its word-by-word tokenisation, each token ' +
    'carrying a 0-based index. For EVERY token, propose:\n' +
    '  - "lemma": its dictionary/citation form\n' +
    '  - "form": its grammatical form in this sentence (part of speech plus any relevant inflection, ' +
    'e.g. "verb, 3rd person singular past")\n' +
    '  - "sense": a short gloss IN ' + S + ' of what this token specifically means HERE, in this ' +
    'sentence -- not a generic dictionary definition\n' +
    '  - "confidence": "high" or "low" -- use "low" whenever you are guessing rather than sure\n' +
    'Also propose "phrases": contiguous runs of TWO OR MORE tokens that function as one multiword ' +
    'unit (phrasal verbs, fixed expressions, idioms) that should be taught together rather than ' +
    'token by token. For each phrase give "start"/"end" (inclusive 0-based token indices), "lemma" ' +
    '(the phrase\'s own citation form), "gloss" (in ' + S + '), and "confidence".\n' +
    'Do not invent tokens, skip any, or renumber them. If you are unsure about a token, still ' +
    'include it with your best guess and "confidence":"low" -- never omit a token you were given.\n' +
    'Return ONLY a valid JSON object of the exact shape ' +
    '{"tokens":[{"i":0,"lemma":"...","form":"...","sense":"...","confidence":"high"}],' +
    '"phrases":[{"start":0,"end":1,"lemma":"...","gloss":"...","confidence":"high"}]}, ' +
    'no markdown, no explanation.';
  const user = JSON.stringify({
    sentence: sentenceText,
    tokens: tokens.map(t => ({ i: t.idx, surface: t.text })),
  }, null, 2);
  return { sys, user };
}

// Turns the model's raw reply into per-token results ALIGNED TO THE REAL TOKEN LIST -- not to
// whatever the model happened to send back. A token the model's JSON never mentions becomes
// {lemma:null, form:null, sense:null, confidence:'unresolved'}: NOT dropped (the plan's own "expose
// uncertainty/review rather than silently guessing"), and NOT fabricated as if answered. A
// malformed/unparseable reply degrades the SAME way for every token, rather than throwing --a
// analysis run over many sentences must survive one bad reply, not abort the whole chapter.
function parseAnalysisReply(raw, tokens) {
  let parsed;
  try { parsed = extractJSON(raw); } catch (e) { parsed = {}; }
  const byIdx = new Map();
  (Array.isArray(parsed.tokens) ? parsed.tokens : []).forEach(t => {
    if (t && Number.isInteger(t.i)) byIdx.set(t.i, t);
  });
  const tokenResults = tokens.map(tok => {
    const m = byIdx.get(tok.idx);
    if (!m || typeof m !== 'object') {
      return { tokenId: tok.tokenId, idx: tok.idx, lemma: null, form: null, sense: null,
        confidence: 'unresolved', reviewed: false };
    }
    return {
      tokenId: tok.tokenId, idx: tok.idx,
      lemma: (typeof m.lemma === 'string' && m.lemma) ? m.lemma : null,
      form: (typeof m.form === 'string' && m.form) ? m.form : null,
      sense: (typeof m.sense === 'string' && m.sense) ? m.sense : null,
      confidence: (m.confidence === 'high' || m.confidence === 'low') ? m.confidence : 'unresolved',
      reviewed: false,
    };
  });

  const idxSet = new Set(tokens.map(t => t.idx));
  const byIdxToken = new Map(tokens.map(t => [t.idx, t]));
  let phrasesDropped = 0;
  const phrases = (Array.isArray(parsed.phrases) ? parsed.phrases : []).map(p => {
    const valid = p && Number.isInteger(p.start) && Number.isInteger(p.end) &&
      p.end > p.start && idxSet.has(p.start) && idxSet.has(p.end);
    if (!valid) { phrasesDropped++; return null; }
    const tokenIds = [];
    for (let i = p.start; i <= p.end; i++) {
      const t = byIdxToken.get(i);
      if (!t) { phrasesDropped++; return null; }   // a phrase spanning a gap in the token list is invalid
      tokenIds.push(t.tokenId);
    }
    return {
      start: p.start, end: p.end, tokenIds,
      lemma: (typeof p.lemma === 'string' && p.lemma) ? p.lemma : null,
      gloss: (typeof p.gloss === 'string' && p.gloss) ? p.gloss : null,
      confidence: (p.confidence === 'high' || p.confidence === 'low') ? p.confidence : 'unresolved',
      reviewed: false,
    };
  }).filter(Boolean);

  return { tokens: tokenResults, phrases, phrasesDropped };
}

// One model call for ONE sentence record (as produced by canonical-text.js's buildCanonicalText).
//
// think:false -- v83_o, found via a REAL user run against qwen3.6:35b-a3b, not the fake-Ollama test
// harness (which cannot simulate a reasoning model at all). server.js's own OLLAMA_THINK table
// (v60.7, "the v71_o empty-response bug") already solved exactly this failure mode for its own
// structured-JSON roles ("story"/"lessons" stay non-thinking always; only "tutor" reasons) -- CP2's
// task (propose lemma/form/sense per token, structured JSON on a budget) is in that SAME category,
// and simply never inherited the fix. Without it, a reasoning-capable model burns its whole token
// budget "thinking" before ever emitting an answer, and the call fails with "Ollama returned empty
// response" -- the exact error a live qwen3.6:35b-a3b run produced before this fix.
async function analyzeSentence(model, sentenceRec, opts) {
  opts = opts || {};
  const { sys, user } = buildAnalysisPrompt(sentenceRec.text, sentenceRec.tokens, opts.langName, opts.srcLangName);
  const { text } = await callLLM(model, sys, user, 1536, { temperature: 0.1, think: false });
  const { tokens, phrases, phrasesDropped } = parseAnalysisReply(text, sentenceRec.tokens);
  return {
    sentenceId: sentenceRec.sentenceId,
    tokens, phrases, phrasesDropped,
    provenance: cp2Provenance({ sentenceId: sentenceRec.sentenceId, model }),
  };
}

// One chapter (as produced by canonical-text.js's buildCanonicalText). Sentences are analysed
// SEQUENTIALLY, one model call each -- deliberately not batched into one whole-chapter call, which
// risks truncation on longer chapters and, per the plan's "small representative corpus" framing for
// each migration stage, is not the concern this stage is measuring. `script` is attached once per
// chapter (a language-level fact, not a per-sentence one) and needs no model call at all.
async function analyzeChapter(model, chapter, opts) {
  opts = opts || {};
  const sentences = [];
  for (const s of (chapter.sentences || [])) {
    sentences.push(await analyzeSentence(model, s, opts));
  }
  return {
    chapterId: chapter.chapterId,
    lang: chapter.lang,
    srcLang: chapter.srcLang,
    script: scriptsForLangCP2(chapter.lang),
    sentenceCount: sentences.length,
    tokenCount: sentences.reduce((n, s) => n + s.tokens.length, 0),
    sentences,
    provenance: cp2Provenance({ chapterId: chapter.chapterId, model }),
  };
}

// Deterministic frequency over whatever chapters were actually analysed in ONE run -- explicitly a
// SAMPLE frequency, not a corpus-wide claim (this stage never analyses the whole corpus at once).
// Keyed by "lang::lemma" so the same surface lemma string in two different languages is counted
// separately. Only resolved tokens (a real, non-null lemma) contribute -- an "unresolved" token
// contributes nothing, since there is nothing to count it as.
function computeFrequency(analyzedChapters) {
  const freq = {};
  (analyzedChapters || []).forEach(ch => {
    (ch.sentences || []).forEach(s => {
      (s.tokens || []).forEach(t => {
        if (!t.lemma) return;
        const key = ch.lang + '::' + t.lemma;
        freq[key] = (freq[key] || 0) + 1;
      });
    });
  });
  return freq;
}

module.exports = {
  CP2_PIPELINE_VERSION,
  scriptsForLangCP2,
  cp2Provenance,
  buildAnalysisPrompt,
  parseAnalysisReply,
  analyzeSentence,
  analyzeChapter,
  computeFrequency,
};
