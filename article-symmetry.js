// article-symmetry.js — v91_a. "German with article, Italian without."
//
// ⚠️ READ THIS BEFORE CHANGING ANY PROMPT IN THIS FILE. Every shape below was measured against the
// real production model on the real corpus, and six earlier shapes were measured and REJECTED. The
// wording is not stylistic.
//
//   the rule buried in qcCheckPair (shipped for releases)   0 of 8 on a real lesson; OK in 6/6 arms
//   one focused prompt doing everything at once             4/7  — and its failures CREATE asymmetry
//   two YES/NO answers in ONE reply                         7/10 — the two answers CORRELATE
//   one side per call, no article list                     17/24 — every DEFINITE article read as "no"
//   one side per call + a hand-written list                11/12 — ⚠️ forbidden by v80_j, and Dutch
//                                                                  failed purely for being unlisted
//   one side per call + a MODEL-DECLARED list ("exactly")   7/11 — a form the list lacks becomes a MISS
//   one side per call + that list as EVIDENCE ("include")  11/11 ← this file
//
// ⚠️ THE SUB-SKILLS WERE NEVER THE PROBLEM. Asked on their own, the model detects an article 9/9 and
// produces the right one (elision included) 6/6. Everything above is about COMPOSITION: asking for
// two judgements in one reply makes them agree with each other, and asking for judgement + output
// format at once makes it guess.
//
// ⚠️ NO ARTICLE TABLE LIVES HERE, and that is a standing rule, not a preference (v80_j: "article
// lists live in a PROBE and must never migrate into the app"). The list is MODEL-DECLARED per
// language — the same shape as the user's own `2z` ruling that language × lesson-type applicability
// is model-declared — and then checked against CORPUS STATISTICS, which the principle explicitly
// permits. There is no hand-authored list of articles anywhere in this module.
'use strict';
const { callLLM } = require('./llm.js');

// ── 1. DECLARATION ────────────────────────────────────────────────────────────────────────────
// ⚠️ Deliberately the SIMPLER of two measured declaration prompts. A richer one that demanded every
// case form and every elision did get Italian's `un'`, and also invented **51 "articles" for
// Polish** — demonstratives, quantifiers, English `a`/`an`, and outright noise. Polish has none, and
// the simple prompt says so. A confidently wrong list for an article-less language is the worst
// outcome this feature can produce, so the prompt optimises against THAT, and step 2 catches the
// rest. Language-neutral by construction: it names no article of any language.
const DECLARE_SYS =
  'List the articles of the language named below — definite and indefinite, including any form ' +
  'shortened before a vowel and written with an apostrophe (write such a form with its apostrophe ' +
  'and no space after it).\n' +
  'If the language has NO articles written as separate words — because it marks definiteness with ' +
  'an attached prefix or suffix, or has no articles at all — reply with exactly: NONE\n' +
  'Otherwise reply with ONLY the forms, lowercase, separated by single spaces. No commentary.';

async function declareArticles(model, langName) {
  const { text } = await callLLM(model, DECLARE_SYS, String(langName || ''), 128,
    { temperature: 0, think: false });
  const raw = String(text || '').trim();
  if (/^none\b/i.test(raw)) return [];
  return [...new Set(
    raw.toLowerCase()
      .replace(/[’]/g, "'")
      .split(/[\s,;]+/)
      .map(s => s.replace(/^["'`(\[]+|[."'`)\]]+$/g, m => (m === "'" ? "'" : '')).trim())
      .filter(s => s && s.length <= 12 && !/[.:!?]/.test(s))
  )];
}

// ── 2. CORPUS SUPPORT — the check that makes a hallucinated declaration harmless ───────────────
// ⚠️ An elided form is a PREFIX, not a whitespace-delimited word: "l'autonomia" is ONE token, so
// `l'` has to match by prefix. Everything else must match the WHOLE first word, or `il` matches
// `illuminare` and `la` matches `lavoro` — both real corpus entries, and both traps this got right.
function leadsEntry(form, text) {
  const t = String(text || '').toLowerCase().replace(/[’]/g, "'").trim();
  const f = String(form || '').toLowerCase().replace(/[’]/g, "'").trim();
  if (!t || !f) return false;
  return f.endsWith("'") ? t.startsWith(f) : t.split(/\s+/)[0] === f;
}

// Every distinct vocabulary surface the corpus holds for ONE language, from either side of a pair.
// Pure corpus statistics — no language knowledge, and nothing hand-written.
function corpusSurfaces(topics, lang) {
  const out = new Set();
  for (const t of (topics || [])) {
    for (const ls of (t.lessons || [])) {
      for (const v of (ls.vocab || [])) {
        if (t.lang === lang && v && v.target) out.add(String(v.target).trim());
        if (t.srcLang === lang && v && v.source) out.add(String(v.source).trim());
      }
    }
  }
  return [...out];
}

// ⚠️⚠️ THE FILTER IS A VETO ON THE WHOLE DECLARATION, NOT A PER-FORM WHITELIST, and that distinction
// is the difference between working and harmful. Measured: filtering per form kills the Polish
// hallucination (34 declared → 0 supported ✓) but ALSO drops real articles the corpus never happens
// to start an entry with — Italian loses `le`/`gli`/`un'`, French loses `les`/`un`/`une`. And a
// MISSING article is not a harmless miss: `gli studenti ↔ die Studenten` would then read as
// asymmetric and propose adding a SECOND article.
//
// So the corpus answers only the question it can answer honestly — **does this language use articles
// at all?** — and the supported forms travel on as EVIDENCE for step 3, which generalises past them.
function articleEvidence(declared, topics, lang) {
  const surfaces = corpusSurfaces(topics, lang);
  const supported = (declared || []).filter(f => surfaces.some(s => leadsEntry(f, s)));
  return { supported, attested: supported.length > 0, corpusSize: surfaces.length };
}

// ── 3. DETECTION — one side per call, the list as evidence ─────────────────────────────────────
// ⚠️ ONE SIDE PER CALL. Asking about both sides in one reply measured 7/10, and the failures were
// not random: whenever the LEFT side had no article the model answered "NO NO", producing a matched
// pair rather than two judgements. Two answers in one reply correlate. Do not re-merge these calls.
//
// ⚠️ "include … EVIDENCE, not a complete set" and NOT "the articles are exactly". The closed-set
// framing measured 7/11 against this wording's 11/11, because every form the declaration or the
// corpus lacks becomes a silent miss under it.
function detectSys(evidence) {
  const tail =
    'Judge ONLY the opening word. Do not translate, correct or comment.\n' +
    'Reply with exactly one word: YES or NO.';
  if (!evidence.length) {
    // The article-less case, and the one the corpus veto produces for a hallucinated declaration.
    return 'Does the following word or phrase BEGIN with an article?\n' +
      'This language has no articles written as separate words, so the answer is always NO.\n' + tail;
  }
  return 'Does the following word or phrase BEGIN with an article?\n' +
    'Articles attested in this language include: ' + evidence.join(' ') + '\n' +
    'That list is EVIDENCE, not a complete set — another form of the same kind also counts. ' +
    'A word that merely begins with similar letters does not.\n' + tail;
}

async function hasArticle(model, text, evidence) {
  // No model call is needed to say "this language has no articles" — the answer cannot vary.
  if (!evidence || !evidence.length) return false;
  const { text: reply } = await callLLM(model, detectSys(evidence), String(text || ''), 8,
    { temperature: 0, think: false });
  // ⚠️ WORD-BOUNDED. A bare /YES|NO/ substring match reads "I am not sure about this one" as NO,
  // because "NOT" contains "NO" — so a model hedging would be recorded as a confident "no article",
  // and the pair would be flagged asymmetric against a side that may well have one. Found by the
  // guard's own ZZZGARBLE fixture, not by reading.
  const m = String(reply || '').toUpperCase().match(/\b(?:YES|NO)\b/);
  // ⚠️ An unparseable reply is NOT "no article" — that would invent an asymmetry. Unknown means
  // "do not judge this pair", which the caller turns into no finding at all.
  return m ? (m[0] === 'YES') : null;
}

// ── 4. PRODUCTION — only ever asked for the side that lacks one ────────────────────────────────
// Measured 6/6 on its own, elisions included (`l'autonomia`, `l'esperienza`, `lo statuto`).
const PRODUCE_SYS =
  'You are given ONE noun phrase that is missing its article. Reply with the SAME words preceded ' +
  'by the correct definite article for this language, choosing the right gender, number and — where ' +
  'the language does that — the elided form before a vowel.\n' +
  'Change nothing else: do not translate, re-spell, pluralise or reword.\n' +
  'Reply with ONLY the article and the words.';

async function proposeArticle(model, text, langName) {
  const { text: reply } = await callLLM(model, PRODUCE_SYS,
    String(text || '') + '\n(language: ' + String(langName || '') + ')', 32,
    { temperature: 0, think: false });
  const out = String(reply || '').trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!out || out.toLowerCase() === String(text || '').toLowerCase()) return null;
  // ⚠️ The proposal must be the ORIGINAL with something added in front — nothing else. Without this
  // a reworded or translated reply would be offered to a curator as an "article fix".
  const norm = s => s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
  return norm(out).endsWith(norm(text)) ? out : null;
}

// ── 5. ONE PAIR ───────────────────────────────────────────────────────────────────────────────
// Returns null when there is nothing to say — which is the common case and must stay cheap.
// ⚠️ PROPOSE ONLY (user ruling). This returns a finding for a curator to accept or dismiss; it
// never rewrites a pair. The reason is measured, not cautious: earlier shapes scored 4/7 and their
// failures CREATED asymmetry, so a wrong verdict must cost one dismissal, not a corrupted entry.
async function checkPair(model, pair, ctx) {
  const target = String((pair && pair.target) || '').trim();
  const source = String((pair && pair.source) || '').trim();
  if (!target || !source) return null;
  const tEv = (ctx && ctx.targetEvidence) || [];
  const sEv = (ctx && ctx.sourceEvidence) || [];
  // ⚠️ There is deliberately NO early return for "neither language uses articles" here. One existed
  // and was removed: `hasArticle` already answers false without a model call when its evidence is
  // empty, so the two guards masked each other and neither could be mutation-tested. One guard, in
  // the function every caller goes through. (v90 rule 5.)
  const tHas = await hasArticle(model, target, tEv);
  const sHas = await hasArticle(model, source, sEv);
  if (tHas === null || sHas === null) return null;     // unknown: judge nothing
  if (tHas === sHas) return null;                       // symmetric, including bare/bare

  const side = tHas ? 'source' : 'target';
  const bare = tHas ? source : target;
  const bareLang = tHas ? (ctx && ctx.sourceLangName) : (ctx && ctx.targetLangName);
  // ⚠️ Only ever ADD to the bare side — never strip the lone article. The user's own framing:
  // "In Italian nouns do have sex/gender, so it would be relevant information." Removing an article
  // destroys that information; adding one supplies it on both sides.
  const sug = await proposeArticle(model, bare, bareLang);
  if (!sug) return null;
  return { field: side, was: bare, sug, why: 'article-symmetry' };
}

module.exports = {
  DECLARE_SYS, PRODUCE_SYS, detectSys,
  declareArticles, leadsEntry, corpusSurfaces, articleEvidence,
  hasArticle, proposeArticle, checkPair,
};
