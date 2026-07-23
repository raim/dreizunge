// ui-qc.js — validation shared by translate-ui.js's writer and its --qc auditor (v69_f).
//
// Why this exists: the v69 translation run filled every language but introduced defects that a
// prompt alone could not prevent — the model localised placeholder NAMES ({word}→{woord},
// {title}→{otsikko}), swapped per-concept icons, and in a few batches bled another language's
// script into the output (Chinese inside Spanish, Cyrillic inside Polish). The lesson: don't trust
// the model, VERIFY it. Both the writer and the auditor run these same checks, so a defect can
// neither be written in the first place nor survive an audit.
'use strict';

// A placeholder is anything the client's t() might substitute. NOTE the client uses
// /\{(\w+)\}/ and JS \w is ASCII-only, so a localised name like {слово} or {cím} is not merely
// unmatched-by-name — it can never be substituted at all and always renders literally.
const PLACEHOLDER_RE = /\{[^}\s]{1,40}\}/gu;
const placeholdersOf = (s) => [...String(s == null ? '' : s).matchAll(PLACEHOLDER_RE)].map(m => m[0]);

// Leading icon: the app uses it as a per-concept identity (🔡 script, 🔢 math, 🎭 creative), so it
// must survive translation or the same concept shows a different icon per language.
const LEAD_ICON_RE = /^(\p{Extended_Pictographic}\uFE0F?)/u;
const leadIconOf = (s) => (String(s == null ? '' : s).trim().match(LEAD_ICON_RE) || [])[1] || '';
// U+FE0F is invisible: "🗣️" and "🗣" render identically and must not count as drift.
const sameIcon = (a, b) => String(a || '').replace(/\uFE0F/g, '') === String(b || '').replace(/\uFE0F/g, '');

// Script blocks used to spot one language's output bleeding into another's batch.
const SCRIPTS = {
  Han:        /[\u3400-\u4dbf\u4e00-\u9fff]/u,
  Kana:       /[\u3040-\u30ff]/u,
  Hangul:     /[\uac00-\ud7af\u1100-\u11ff]/u,
  Cyrillic:   /[\u0400-\u04ff]/u,
  Arabic:     /[\u0600-\u06ff]/u,
  Hebrew:     /[\u0590-\u05ff]/u,
  Devanagari: /[\u0900-\u097f]/u,
  Thai:       /[\u0e00-\u0e7f]/u,
  Greek:      /[\u0370-\u03ff]/u,
};
// Which script each language legitimately writes in. Anything else is suspicious — UNLESS the
// English source already contains it (e.g. "ふ Show furigana" keeps its kana in every language).
const LANG_SCRIPT = {
  zh: 'Han', ja: 'Kana', ko: 'Hangul', he: 'Hebrew', ar: 'Arabic', hi: 'Devanagari', th: 'Thai',
  el: 'Greek', ru: 'Cyrillic', uk: 'Cyrillic', bg: 'Cyrillic', sr: 'Cyrillic',
};
// Japanese legitimately mixes kana and kanji.
const EXTRA_OK = { ja: ['Han'] };

// Model artifacts seen in real runs; cheap to spot, always wrong.
const GARBAGE_RE = /almart|scribe_|_scribe|\bundefined\b|\[object |\uFFFD/i;

/**
 * Validate one translated value against its English source.
 * Returns { issues: [{code, detail, severity}], repaired: string|null }.
 * `repaired` is non-null only for defects that can be fixed WITHOUT guessing at meaning.
 */
function validateEntry(enVal, trVal, lang) {
  const issues = [];
  if (typeof trVal !== 'string' || !trVal.trim()) {
    return { issues: [{ code: 'empty', detail: 'empty or non-string', severity: 'error' }], repaired: null };
  }
  let repaired = null;
  const work = () => (repaired == null ? trVal : repaired);

  // ── Placeholders ───────────────────────────────────────────────────────────
  const A = placeholdersOf(enVal), B = placeholdersOf(trVal);
  const sortedEq = [...A].sort().join() === [...B].sort().join();
  if (!sortedEq) {
    if (A.length === B.length && A.length > 0) {
      // Same number, different names → the model localised them. Restore positionally: the
      // surrounding translation is kept and each slot keeps the position the translator chose.
      let i = 0;
      repaired = trVal.replace(PLACEHOLDER_RE, () => A[i++]);
      issues.push({ code: 'placeholder-renamed', severity: 'error',
        detail: `${B.join(',')} → ${A.join(',')} (restored positionally)` });
    } else {
      // Dropped or invented a slot: the sentence itself is wrong, so repairing would mean writing
      // new text. Flag it — the caller rejects the value (English fallback beats broken output).
      const missing = A.filter(x => !B.includes(x)), extra = B.filter(x => !A.includes(x));
      if (missing.length) issues.push({ code: 'placeholder-dropped', severity: 'error', detail: missing.join(',') });
      if (extra.length)   issues.push({ code: 'placeholder-invented', severity: 'error', detail: extra.join(',') });
    }
  } else if (A.join() !== B.join()) {
    // Same set, different order — legitimate: t() substitutes BY NAME, and other word orders need it.
    issues.push({ code: 'placeholder-reordered', severity: 'ok', detail: `${A.join(',')} → ${B.join(',')}` });
  }

  // ── Leading icon ───────────────────────────────────────────────────────────
  const enIcon = leadIconOf(enVal);
  if (enIcon) {
    const trIcon = leadIconOf(work());
    if (!sameIcon(enIcon, trIcon)) {
      const body = trIcon ? work().trim().slice(trIcon.length).trim() : work().trim();
      repaired = enIcon + ' ' + body;
      issues.push({ code: 'icon-drift', severity: 'warn',
        detail: trIcon ? `${trIcon} → ${enIcon}` : `${enIcon} restored` });
    }
  }

  // ── Cross-script contamination ─────────────────────────────────────────────
  const own = LANG_SCRIPT[lang];
  const allowed = new Set([own, ...(EXTRA_OK[lang] || [])].filter(Boolean));
  for (const [name, re] of Object.entries(SCRIPTS)) {
    if (allowed.has(name)) continue;
    if (!re.test(work())) continue;
    if (re.test(enVal)) continue;              // already in the source → intended (e.g. "ふ")
    issues.push({ code: 'foreign-script', severity: 'error', detail: `${name} characters not in the source` });
    repaired = null;                            // cannot be repaired mechanically
    break;
  }

  // ── Model artifacts ────────────────────────────────────────────────────────
  if (GARBAGE_RE.test(work())) {
    issues.push({ code: 'garbage-token', severity: 'error', detail: 'model artifact in output' });
    repaired = null;
  }

  // ── Untranslated (reported only: many are legitimate loanwords) ────────────
  if (trVal === enVal && /\p{L}{3,}/u.test(enVal)) {
    issues.push({ code: 'untranslated', severity: 'info', detail: 'identical to English' });
  }

  return { issues, repaired };
}

const isBlocking = (issues) => issues.some(i => i.severity === 'error');

/** Audit a whole ui.json. Returns { findings, counts }. Never mutates the input. */
function auditAll(ui) {
  const en = ui.en || {};
  const findings = [];
  const counts = {};
  for (const lang of Object.keys(ui)) {
    if (lang === 'en') continue;
    for (const key of Object.keys(en)) {
      const trVal = ui[lang][key];
      if (trVal === undefined) { 
        findings.push({ lang, key, code: 'missing', severity: 'error', detail: 'no translation', repaired: null });
        counts.missing = (counts.missing || 0) + 1;
        continue;
      }
      const { issues, repaired } = validateEntry(en[key], trVal, lang);
      for (const iss of issues) {
        if (iss.code === 'placeholder-reordered') continue;   // legitimate, don't report as a finding
        findings.push({ lang, key, ...iss, repaired, en: en[key], tr: trVal });
        counts[iss.code] = (counts[iss.code] || 0) + 1;
      }
    }
  }
  return { findings, counts };
}

module.exports = { placeholdersOf, leadIconOf, sameIcon, validateEntry, isBlocking, auditAll,
                   PLACEHOLDER_RE, LANG_SCRIPT };
