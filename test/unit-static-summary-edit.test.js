// Bug fix: the storyline-page summary edit pencil must be gated by _canEdit() (so it is
// hidden without teacher mode in the static build), and saveSummaryEdit must save in
// memory instead of POSTing to a non-existent server ("failed to fetch").
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Both summary pencils are _canEdit()-gated; neither is rendered unconditionally.
//
// ⚠️ v90_g rewrote the storyline-screen one: it is now a ROW inside the summary's own edit menu
// (manual edit · ✨ generate · 🔍 QC), built through _cardEditPopHtml. The old assertion pinned the
// literal source phrasing `_canEdit() ? '<button class="storyline-hdr-btn" data-sumid=` and broke on
// the move while its CLAIM — "this pencil is teacher-gated and never emitted bare" — stayed true.
// That is standing rule 18 (a guard that pins a phrasing does not survive a rewrite), so the claim
// is restated against the entry's own gate instead of against the shape of the line around it.
const pencils = html.match(/openSummaryEdit\([^)]*\)" title="Edit summary">✏️<\/button>/g) || [];
assert.ok(pencils.length >= 2, 'expected the storyline summary pencils to exist');
{
  // The storyline-screen pencil lives in the summary menu's entry list; its `on:` IS its gate.
  const at = html.indexOf("_cardEditPopHtml('sumedit-'");
  assert.ok(at > 0, 'the summary edit menu is built through _cardEditPopHtml');
  const list = html.slice(at, html.indexOf('].filter(e => e.on)', at));
  assert.ok(list.length > 100, 'and its entry list is found (non-vacuity for the slice)');
  const editEntry = list.slice(list.indexOf('openSummaryEdit'));
  assert.ok(/on:\s*_canEdit\(\)/.test(editEntry.slice(0, editEntry.indexOf('},'))),
    'storyline-screen summary pencil must be gated by _canEdit()');
  assert.ok(/\.filter\(e => e\.on\)/.test(html),
    'and the gate is actually applied — an entry list nobody filters shows every row');
  // ⚠️ The GENERATE row beside it must NOT be teacher-gated: it re-runs one LLM call over chapters
  // that already exist, like QC and re-translate, and unit-can-edit-teacher-mode §4 sweeps for a
  // call site that combines the two axes. It caught this exact line when it was first written as
  // `_canEdit() && APP.info?.canGenerate`.
  // ⚠️ The GATE EXPRESSION ONLY, not the lines around it. Written first as a scan of the whole
  // entry, it failed on the source's own COMMENT — which says "NOT also _canEdit()" and therefore
  // contains the very string the assertion was looking for. The containment trap this project has
  // recorded three times, hit again while writing the guard for it.
  const genEntry = list.slice(list.indexOf('genStorylineSummary'));
  const genGate = /on:\s*([^,}\n]+)/.exec(genEntry.slice(0, genEntry.indexOf('},')));
  assert.ok(genGate, 'the generate entry carries a gate');
  assert.strictEqual(genGate[1].trim(), '!!APP.info?.canGenerate',
    'generate is gated on the backend alone — not also on teacher mode');
}
assert.ok(/_canEdit\(\) \? `<button class="storyline-hdr-btn" style="flex-shrink:0;margin-right:6px" onclick="event\.stopPropagation\(\);openSummaryEdit/.test(html),
  'library-header summary pencil must be gated by _canEdit()');
assert.ok(!/\+ '<button class="storyline-hdr-btn" data-sumid=.*openSummaryEdit/.test(html),
  'no ungated storyline-screen summary pencil remains');
console.log('  both summary pencils gated by _canEdit(); generate is not: OK');

// saveSummaryEdit: static branch saves in memory and returns before the server fetch.
const start = html.indexOf('async function saveSummaryEdit');
const fnEnd = html.indexOf('function cancelSummaryEdit', start);
const fn = html.slice(start, fnEnd);
assert.ok(/if \(!APP\.info\?\.canGenerate\)/.test(fn), 'saveSummaryEdit must branch for the static build');
assert.ok(/APP\._dirtyExport = true/.test(fn), 'static branch marks export dirty');
assert.ok(fn.indexOf('APP._dirtyExport = true') < fn.indexOf("fetch('/api/storylines'"),
  'static branch comes before the server fetch');
assert.ok(/APP\.storylines\[idx\]\.summary = summary/.test(fn), 'summary saved in memory');
console.log('  saveSummaryEdit static branch: OK');
console.log('unit-static-summary-edit: ALL PASSED');
