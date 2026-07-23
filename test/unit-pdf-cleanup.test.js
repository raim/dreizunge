// unit-pdf-cleanup.test.js
// v68.1 — deterministic extracted-text cleanup (the first stage of the queued "PDF text cleanup"
// item; the model pass for remaining non-narrative fragments is a separate, later change).
// Contract, tuned against the user's real Corriere extraction:
//   • hard-wrapped lines are joined back into their sentence (no-sentence-end + next-starts-
//     lowercase), incl. a quote split ACROSS a blank line («Sembrava un / ⏎ / bombardamento»);
//   • junk goes: letter-less lines (page numbers, dates, ───), lone URLs, and — after joining —
//     unpunctuated lines with few letters (bylines "di Alessio Ribaudo", crumbs, short headers);
//   • blank-line paragraph structure survives; clean prose passes through byte-identical;
//   • the pass is a lossless TOGGLE: the pristine extraction is kept in _pdfOrig and
//     _applyUploadCleanup re-derives both the full text and the per-page array from it;
//   • default ON for PDFs, OFF for plain-text uploads.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function ext(name) {
  let at = html.indexOf('\nfunction ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = html.indexOf('{', at);
  let d = 0, i = b;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}
const clean = new Function(ext('cleanExtractedText') + '\nreturn cleanExtractedText;')();
const q = '\u2019';   // ’

// ── 1. The real-world shape (the user's Corriere example, abridged) ───────────
{
  const input = [
    `Maxi-grandine, paura sull${q}A13 con auto distrutte e feriti: «Sembrava un`, '', 'bombardamento»', '',
    'di Alessio Ribaudo', '', '22/07/2026', '', '42', '', 'https://www.corriere.it/x', '',
    `Ieri l${q}Italia è stata divisa in due. Al Nord il caldo record si è trasformato in grandine,`,
    'nubifragi e raffiche che hanno sfondato parabrezza.',
    'I danni',
    'Nel Ferrarese chicchi fino a tre centimetri',
    `hanno danneggiato vetri. Sull${q}A13 gli automobilisti si`, 'sono fermati.',
  ].join('\n');
  const out = clean(input);
  assert.ok(out.includes('«Sembrava un bombardamento»'), 'a quote split across a blank line is rejoined');
  assert.ok(out.includes('in grandine, nubifragi'), 'a mid-sentence hard wrap is joined');
  assert.ok(out.includes('tre centimetri hanno danneggiato'), 'a wrap after an unpunctuated line is joined');
  assert.ok(out.includes('automobilisti si sono fermati.'), 'multi-wrap sentences reassemble fully');
  assert.ok(!out.includes('di Alessio Ribaudo'), 'the byline is dropped (unpunctuated, few letters)');
  assert.ok(!out.includes('I danni'), 'a short unpunctuated section header is dropped');
  assert.ok(!out.includes('22/07/2026') && !out.includes('\n42') && !/^42$/m.test(out), 'lone dates/page numbers are dropped');
  assert.ok(!out.includes('corriere.it'), 'lone URLs are dropped');
}
console.log('  real-world shape: wraps joined, quote rejoined, byline/header/date/URL dropped: OK');

// ── 2. Non-destruction + structure ────────────────────────────────────────────
{
  const prose = 'Es war einmal ein Test. Er lebte in einem Haus.\n\nDie Katze schlief. Der Hund bellte laut in der Nacht.';
  assert.strictEqual(clean(prose), prose, 'clean prose passes through byte-identical');
  const paras = clean('Absatz eins ist hier und lang genug geschrieben.\n\nAbsatz zwei ist auch hier und ebenso lang.');
  assert.ok(paras.includes('\n\n'), 'blank-line paragraph structure survives');
  // A line that ends a sentence is NEVER joined into, even if the next starts lowercase-ish.
  const s = clean('Der Satz endet hier.\nund dieser Anfang ist kleingeschrieben aber eigenständig lang genug.');
  assert.ok(s.startsWith('Der Satz endet hier.\n'), 'a sentence-final line is not glued to the next');
  // Idempotence: cleaning cleaned text changes nothing.
  const once = clean('Zeile eins ohne Ende,\nzeile zwei schließt den Satz ab.');
  assert.strictEqual(clean(once), once, 'the pass is idempotent');
}
console.log('  non-destruction: clean prose untouched, paragraphs kept, idempotent: OK');

// ── 3. Wiring: lossless toggle, defaults, i18n ────────────────────────────────
{
  assert.ok(/let _pdfOrig = null;/.test(html), 'the pristine extraction is kept (_pdfOrig)');
  const ap = ext('_applyUploadCleanup');
  assert.ok(/on \? cleanExtractedText\(_pdfOrig\.text\) : _pdfOrig\.text/.test(ap),
    'the toggle re-derives the full text from the pristine copy (lossless both ways)');
  assert.ok(/_pdfOrig\.pages\.map\(cleanExtractedText\)/.test(ap), 'per-page texts are cleaned per page');
  assert.ok(/id="pdf-cleanup-cb" onchange="onCleanupToggle\(\)"/.test(html), 'the 🧹 checkbox is wired');
  assert.ok(/_clCb\.checked = isPdf;/.test(html), 'default: ON for PDFs, OFF for plain-text uploads');
  assert.ok(/_pdfOrig=null;/.test(html), 'the pristine copy is reset with the rest of the upload state');
  const oc = ext('onCleanupToggle');
  assert.ok(/_applyUploadCleanup\(\);\s*_resplitUpload\(\);/.test(oc), 'toggling re-applies and re-splits');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['pdf.cleanup_lbl'], 'ui.json en has pdf.cleanup_lbl');
  assert.ok((html.match(/t\('pdf\.cleanup_lbl'\)/g) || []).length >= 2,
    'the label is translated at both label-refresh sites (mirrors split-page-lbl)');
}
console.log('  wiring: lossless toggle, PDF-only default, re-split on toggle, i18n: OK');

console.log('unit-pdf-cleanup: ALL PASSED');
