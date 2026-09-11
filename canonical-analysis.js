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
const { callLLM, extractJSON, estimateCtxTokens } = require('./llm.js');

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
    '  - "form": its grammatical form in this sentence (part of speech plus any relevant inflection -- ' +
    'case, number, gender, tense, person, mood, degree, etc., whichever apply), given as a short ' +
    'phrase IN ' + S + ' -- the grammatical TERMINOLOGY itself (the part-of-speech and inflection ' +
    'names, not just the gloss) must be written in ' + S + ', not English, unless ' + S + ' happens ' +
    'to be English\n' +
    '  - "sense": a short gloss IN ' + S + ' of what this token specifically means HERE, in this ' +
    'sentence -- not a generic dictionary definition. Keep the SAME grammatical form as the token ' +
    'itself: if the token is a conjugated/inflected form, give a conjugated/inflected gloss in the ' +
    'SAME tense/person/number (e.g. a past-tense verb token gets a past-tense gloss, not an ' +
    'infinitive) -- never switch to the dictionary/citation form here, that is what "lemma" is for\n' +
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
//
// `surface` (v83_p): the token's own literal text, from OUR OWN token list, not the model's reply --
// known regardless of whether the model answered at all. A user report found "kommen" (the LEMMA,
// infinitive) paired against "venne" (the SENSE, past tense) as a target/source vocabulary pair one
// level up in CP4 -- a register mismatch. `lemma` is deliberately the dictionary/citation form (the
// concept's stable identity); `surface` is what the learner will ACTUALLY see in the story, in the
// SAME grammatical register the sense gloss now (also v83_p, see buildAnalysisPrompt) is instructed
// to match. CP4 pairs `surface`+`sense` for the target/source shown to a learner, not `lemma`+`sense`.
// ⚠️ v90_z (user report: "text-analysis is often missing sentences, and returning null-filled
// entries"). The `catch` below used to be BARE — `catch (e) { parsed = {} }` — and that single line
// is what turned a truncated model reply into 39 fully-null tokens with no log, no throw and no
// counter, across 4 of 24 chapters of the live corpus. The degrade itself is right and stays (one
// bad reply must not abort a chapter that takes many minutes); what was wrong is that it was
// SILENT. `parseError` now carries the reason out to the caller, which is what lets analyzeSentence
// retry and the job report a real number instead of a user having to notice.
function parseAnalysisReply(raw, tokens) {
  let parsed, parseError = null;
  try { parsed = extractJSON(raw); } catch (e) { parsed = {}; parseError = e.message || String(e); }
  const byIdx = new Map();
  (Array.isArray(parsed.tokens) ? parsed.tokens : []).forEach(t => {
    if (t && Number.isInteger(t.i)) byIdx.set(t.i, t);
  });
  const tokenResults = tokens.map(tok => {
    const m = byIdx.get(tok.idx);
    if (!m || typeof m !== 'object') {
      return { tokenId: tok.tokenId, idx: tok.idx, surface: tok.text, lemma: null, form: null, sense: null,
        confidence: 'unresolved', reviewed: false };
    }
    return {
      tokenId: tok.tokenId, idx: tok.idx, surface: tok.text,
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

  // v90_z: `unresolved` is counted here rather than re-derived by every caller — it is the signal
  // the user asked the console to report, and it already existed on every failed token.
  const unresolved = tokenResults.filter(t => t.confidence === 'unresolved').length;
  return { tokens: tokenResults, phrases, phrasesDropped, parseError, unresolved };
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
// ⚠️ v90_z — THE OUTPUT BUDGET, and why it is no longer a constant.
//
// The call above this line used to pass a FIXED 1536, and that number was the whole of a
// user-reported defect: "text-analysis is often missing sentences, and returning null-filled
// entries in canonical-analysis.json". Measured across the live store, the failure was not a
// quality problem at all but a hard threshold — sentences of 1-24 tokens NEVER failed (0 of 78),
// sentences of 26+ tokens ALWAYS did (8 of 8). The reply is one JSON object per token, so its
// length is a function of the token count, and past ~24 tokens it simply did not fit.
//
// Proven end to end against the real production model (qwen3.6:35b-a3b) on real corpus sentences,
// not inferred from the shape of the output:
//
//   n=24  cap=1536  done_reason=stop    eval=1520   24/24 resolved   <- cleared it by 16 tokens
//   n=25  cap=1536  done_reason=length  eval=1536    0/25 resolved
//   n=25  cap=6144  done_reason=stop    eval=1663   25/25 resolved
//   n=39  cap=1536  done_reason=length  eval=1536    0/39 resolved
//   n=39  cap=6144  done_reason=stop    eval=2563   39/39 resolved
//
// That is ~66 output tokens per input token (63.3 / 66.5 / 65.7 across the three), stable enough to
// size from and NOT stable enough to trust blindly — which is why the retry below exists as well.
// 90 is that ratio with headroom; 1536 stays as the FLOOR so nothing short gets a smaller budget
// than it has always had; the ceiling stops a pathological token list from asking for the world.
const CP2_TOKENS_PER_TOKEN = 90;
const CP2_MIN_OUTPUT_TOKENS = 1536;
const CP2_MAX_OUTPUT_TOKENS = 12288;
function analysisTokenBudget(tokenCount) {
  const want = Math.ceil(Math.max(0, Number(tokenCount) || 0) * CP2_TOKENS_PER_TOKEN) + 400;
  return Math.max(CP2_MIN_OUTPUT_TOKENS, Math.min(CP2_MAX_OUTPUT_TOKENS, want));
}

// Did THIS attempt fail in the way a bigger budget can fix? Two signals, deliberately OR-ed:
//   • `doneReason === 'length'` — Ollama's own word for "I was cut off at num_predict". Exact, and
//     the one the measurement above confirms. But a backend that does not report it yields null,
//     and null must be read as "unknown", never as "not truncated".
//   • a parse failure that left EVERY token unresolved — the observable shape of the same event,
//     and the one signal that survives a backend with no done_reason at all.
//     ⚠️ `r.unresolved === r.tokens.length` is TODAY equivalent to `!!r.parseError` alone, because a
//     throw from extractJSON leaves `byIdx` empty and therefore every token unresolved — mutation
//     testing confirmed it as an equivalent mutant, not a gap. It is kept deliberately: the moment
//     parseAnalysisReply learns any partial salvage (llm.js already has `salvageArray` next door),
//     "some tokens came back" must stop counting as a truncation, and this is the conjunct that
//     makes that true without anyone having to remember.
// A sentence with SOME resolved tokens is a good analysis with a gap in it and is never retried:
// that is `_analysisSentenceUsable`'s own distinction (server.js), reused rather than re-invented.
function _cp2NeedsBiggerBudget(r) {
  if (r.doneReason === 'length') return true;
  return !!r.parseError && r.tokens.length > 0 && r.unresolved === r.tokens.length;
}

async function analyzeSentence(model, sentenceRec, opts) {
  opts = opts || {};
  const toks = sentenceRec.tokens || [];
  const { sys, user } = buildAnalysisPrompt(sentenceRec.text, toks, opts.langName, opts.srcLangName);
  // ⚠️ ctxTokens is NOT optional once the budget can exceed ~2700. It was safe to omit while the cap
  // was 1536 (prompt ~1100 + reply 1520 fits Ollama's ~4096 default), and it stops being safe the
  // moment the budget grows: llm.js's own v71_t note spells out that an over-long prompt is
  // truncated SILENTLY, with no error and a plausible-looking answer. Raising the output cap without
  // this would trade one silent truncation for a strictly worse one — the PROMPT losing the tokens
  // the model is being asked to annotate.
  const attempt = async (budget) => {
    const r = await callLLM(model, sys, user, budget, {
      temperature: 0.1, think: false,
      ctxTokens: estimateCtxTokens(sys.length + user.length, budget),
    });
    return Object.assign(parseAnalysisReply(r.text, toks), { doneReason: r.doneReason || null, budget });
  };
  const budget = analysisTokenBudget(toks.length);
  let res = await attempt(budget), retried = false;
  // ONE retry, at double. The formula is right for every sentence measured; the retry is what makes
  // a wrong formula loud and recoverable instead of silent and permanent. Bounded at one deliberately
  // — CP2 is already one call per sentence on a slow local model, and an unbounded escalation on a
  // sentence the model simply cannot answer would stall a whole chapter.
  if (_cp2NeedsBiggerBudget(res)) {
    retried = true;
    const bigger = Math.min(CP2_MAX_OUTPUT_TOKENS, res.budget * 2);
    if (bigger > res.budget) {
      const second = await attempt(bigger);
      // Keep the retry only if it actually resolved something — a second failure must not throw away
      // a first attempt that had partially succeeded.
      if (second.unresolved < res.unresolved) res = second;
    }
  }
  return {
    sentenceId: sentenceRec.sentenceId,
    tokens: res.tokens, phrases: res.phrases, phrasesDropped: res.phrasesDropped,
    // The failure markers travel WITH the sentence, so a null-filled entry in canonical-analysis.json
    // says why it is null instead of leaving a reader to guess. Present only when something actually
    // went wrong, so a healthy record is unchanged from what this module has always written.
    ...(res.unresolved ? { unresolved: res.unresolved } : {}),
    ...(res.parseError ? { parseError: res.parseError } : {}),
    ...(res.doneReason === 'length' ? { truncated: true } : {}),
    ...(retried ? { retried: true } : {}),
    provenance: cp2Provenance({ sentenceId: sentenceRec.sentenceId, model, outputBudget: res.budget }),
  };
}

// One chapter (as produced by canonical-text.js's buildCanonicalText). Sentences are analysed
// SEQUENTIALLY, one model call each -- deliberately not batched into one whole-chapter call, which
// risks truncation on longer chapters and, per the plan's "small representative corpus" framing for
// each migration stage, is not the concern this stage is measuring. `script` is attached once per
// chapter (a language-level fact, not a per-sentence one) and needs no model call at all.
// v88_x (user request): TWO optional hooks, both absent by default so every existing caller behaves
// byte-identically.
//   • `opts.reuse(sentence, i)` -> an already-analysed sentence to KEEP, or null/undefined to
//     analyse it now. This is what "a second run should skip the existing annotation and just do the
//     rest" needs, and it is the caller's business to decide what counts as reusable (the server
//     matches on sentence TEXT — see _runAnalysisJob).
//   • `opts.onProgress(i, sentencesSoFar)` -> awaited after each NEWLY analysed sentence. CP2 is one
//     model call per sentence and a chapter can take many minutes, so a run that dies mid-way used
//     to throw away every completed sentence: the server persists after each one now.
// A reused sentence deliberately does NOT fire onProgress — nothing new was computed, and a resume
// that re-persisted an unchanged prefix would write the store once per sentence for no reason.
async function analyzeChapter(model, chapter, opts) {
  opts = opts || {};
  const sentences = [];
  const src = chapter.sentences || [];
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    const kept = (typeof opts.reuse === 'function') ? opts.reuse(s, i) : null;
    sentences.push(kept || await analyzeSentence(model, s, opts));
    if (!kept && typeof opts.onProgress === 'function') await opts.onProgress(i, sentences);
  }
  return {
    chapterId: chapter.chapterId,
    lang: chapter.lang,
    srcLang: chapter.srcLang,
    script: scriptsForLangCP2(chapter.lang),
    sentenceCount: sentences.length,
    tokenCount: sentences.reduce((n, s) => n + s.tokens.length, 0),
    sentences,
    // v90_z (user: "The console also didn't report on how many analyses were successful and how many
    // just contain nulls"). ⚠️ NO new field was needed to answer this — `confidence:'unresolved'` is
    // already written on every token the model never answered for, and has been since CP2 shipped.
    // The number simply was never counted or shown, which is why four chapters of null entries could
    // sit in the store unnoticed until a person opened the JSON.
    ...analysisCoverage(sentences),
    provenance: cp2Provenance({ chapterId: chapter.chapterId, model }),
  };
}

// "N of M sentences unresolved", computed from what is already on every token. `unresolvedSentences`
// counts sentences with token slots and NOT ONE resolved lemma — a recorded FAILURE, the same
// definition `_analysisSentenceUsable` (server.js) and `computeFrequency` (below) both already use,
// rather than a third opinion on what "analysed" means.
function analysisCoverage(sentences) {
  let unresolvedSentences = 0, unresolvedTokens = 0, truncatedSentences = 0;
  (sentences || []).forEach(s => {
    const toks = (s && s.tokens) || [];
    if (!toks.length) return;
    const bad = toks.filter(t => t && t.confidence === 'unresolved').length;
    unresolvedTokens += bad;
    if (bad === toks.length) unresolvedSentences++;
    if (s && s.truncated) truncatedSentences++;
  });
  return { unresolvedSentences, unresolvedTokens, truncatedSentences };
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
  analysisTokenBudget,
  analysisCoverage,
  analyzeSentence,
  analyzeChapter,
  computeFrequency,
};
