'use strict';
// inflection-labels.js — v89_f.
//
// The RULES `v89_d` settled for normalising an inflections lesson's form labels into the source
// language, separated from WHO calls the model. Two callers need them and must never drift apart on
// them:
//   • server.js's `normaliseInflectionLabels` — at GENERATION time, inside a job.
//   • backfill-inflection-labels.js — over the EXISTING corpus, from the command line.
// The rule that matters most is the fallback policy, and duplicating that across two files is
// exactly the drift this project keeps paying for. Everything here is PURE: no I/O, no model, no
// logging — the callers own all three.
//
// See `roadmap_v89.md`'s `v89_d` entry for why this is a transformation rather than a better prompt
// (measured: the instruction alone was obeyed in 1 of 3 live runs, 0 of 3 before it was hardened).

// item AJ (roadmap_v86.md): `{S}`-designated fields comply reliably when `{S}` is English, and
// v89_c's corpus measurement agreed — every de/en and it/en chapter complied, every it/nl one
// drifted. Skipping English also means an already-correct English label is never handed to a model
// that could reword it. Same gate the meta-translation pass in server.js already uses.
const SKIP_SRC = 'en';

function shouldNormaliseLabels(srcLang) {
  return !!srcLang && srcLang !== SKIP_SRC;
}

// What to SEND. One flat map over every item's `formChoices` — the `metaTranslation` contract
// ("return an object with the same keys"), reused rather than a second JSON shape invented. Flat
// rather than nested so a missing or extra key is a one-line check instead of a tree walk, and so
// the model sees every label of the lesson at once, which is what lets it keep near-identical
// options apart. `keysByItem[i][j]` is built on the way OUT so the way BACK is a direct lookup,
// never a search that could re-derive the pairing differently.
function buildLabelRequest(items) {
  const map = {};
  let count = 0;
  const list = Array.isArray(items) ? items : [];
  const keysByItem = list.map(it => ((it && it.formChoices) || []).map(c => {
    const k = String(count++);
    map[k] = c;
    return k;
  }));
  return { map, keysByItem, count };
}

// What to KEEP. Per ITEM, and always toward the original.
//
// An item whose reply is short, empty, non-string, or **collapses two of its own options onto one
// phrase** keeps its ORIGINAL labels. That last case is the one that matters: `formChoices` IS the
// multiple-choice list, and two options that render to the same phrase make the question
// unanswerable — strictly worse than leaving it in the wrong language.
//
// Per item rather than all-or-nothing because a lesson with three repaired items and two untouched
// is strictly better than five untouched ones, and an item's options are only ever compared with
// its own siblings.
//
// `onSkip(item, reason)` is optional and exists so a caller can report; it is never how a decision
// is made.
function applyLabelReply(items, keysByItem, parsed, onSkip) {
  const list = Array.isArray(items) ? items : [];
  // The agreed shape is an OBJECT keyed by the keys we sent. An array is not that, even when its
  // numeric indices happen to line up — see the v89_d write-up: accepting one silently means the
  // "same keys" contract is not being enforced at all.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { items: list, normalised: 0 };
  }
  let normalised = 0;
  const out = list.map((it, i) => {
    const src = (it && it.formChoices) || [];
    const keys = keysByItem[i] || [];
    const next = src.map((_, j) => {
      const v = parsed[keys[j]];
      return (typeof v === 'string') ? v.trim() : '';
    });
    if (next.length !== src.length || next.some(v => !v)) {
      if (onSkip) onSkip(it, 'incomplete');
      return it;
    }
    if (new Set(next.map(v => v.toLowerCase())).size !== next.length) {
      if (onSkip) onSkip(it, 'collapsed');
      return it;
    }
    normalised++;
    // `formLabel` is DERIVED from the normalised list at the index the validator already resolved,
    // never translated separately: that is what keeps `validateInflectionsItems`'s own invariant
    // (formLabel is one of formChoices, at formCorrectIndex) true by CONSTRUCTION rather than by
    // hoping two independent renderings of the same string come back identical.
    return Object.assign({}, it, { formChoices: next, formLabel: next[it.formCorrectIndex] });
  });
  return { items: out, normalised };
}

// The token budget for one request. Shared so the two callers cannot size it differently.
function labelReplyTokens(payload) {
  return Math.min(2048, Math.max(256, Math.ceil(String(payload).length * 1.5)));
}

module.exports = { SKIP_SRC, shouldNormaliseLabels, buildLabelRequest, applyLabelReply, labelReplyTokens };
