// Source-shape tests for static teacher-mode editing: non-LLM edit affordances are
// gated by _canEdit() (canGenerate OR teacher mode), while LLM actions (QC) stay gated
// by canGenerate; lesson-edit persistence goes through a static-aware helper.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// _canEdit exists and is the OR of canGenerate and teacher mode.
assert.ok(html.includes('function _canEdit()'), 'missing _canEdit');
const ce = html.slice(html.indexOf('function _canEdit()'), html.indexOf('function _canEdit()') + 120);
assert.ok(ce.includes('canGenerate') && ce.includes('_teacherMode'), '_canEdit must combine canGenerate + teacher mode');
console.log('  _canEdit helper: OK');

// The lesson-node edit row is gated by _canEdit (not raw canGenerate) ...
assert.ok(html.includes('${_canEdit()&&L.id?`<div'), 'edit row must be gated by _canEdit');
// ... and the flag-count badge too.
assert.ok(html.includes('const hasFlags=lessonFlagCount>0&&_canEdit();'), 'flag badge must use _canEdit');
// ... but the QC (LLM) button inside the row stays canGenerate-gated (now also for the
// word_forms `items` and synonyms `words` lesson types, whose QC the backend supports) — and is
// excluded for the error-hunt types, which have no QC (the button would be non-functional).
assert.ok(html.includes(`\${APP.info.canGenerate&&L.type!=='ai_error_hunt'&&L.type!=='error_hunt'&&(L.vocab||L.sentences||L.items||L.words)?\`<button class="fix-btn"`),
  'QC button must stay canGenerate-gated and skip error-hunt types');
console.log('  edit row gating (non-LLM vs QC): OK');

// Play flag UI is gated by _canEdit (hidden in static non-teacher).
assert.ok(html.includes('const flagUi = _canEdit() ?'), 'play flag UI must be gated by _canEdit');
console.log('  play flag UI gating: OK');

// Lesson-edit persistence goes through the static-aware helper, which no-ops locally
// when there is no backend.
assert.ok(html.includes('async function _postLessonEdit('), 'missing _postLessonEdit helper');
const pe = html.slice(html.indexOf('async function _postLessonEdit('), html.indexOf('async function _postLessonEdit(') + 360);
assert.ok(pe.includes('!APP.info?.canGenerate') && pe.includes('_local'), 'helper must succeed locally in static');
assert.ok(pe.includes('_dirtyExport'), 'helper should mark export dirty in static');
// No raw /api/lessons/edit fetch remains outside the helper / play-flag persist.
const rawFetches = (html.match(/fetch\('\/api\/lessons\/edit'/g) || []).length;
assert.ok(rawFetches <= 1, 'all lesson-edit persistence should route through _postLessonEdit (found ' + rawFetches + ' raw)');
console.log('  static-aware persistence: OK');

// Regression guard: the static build extracts the engine slice starting at
// `function buildPath(` (see build-static.js). Any client helper buildPath calls at
// render time must be defined AT OR AFTER that line, or it gets dropped from docs and
// buildPath throws (blank lessonset page). _chapterNeighbors and _canEdit are such
// helpers — keep them after buildPath.
const initAt = html.indexOf('\nasync function init()');
const buildPathAt = html.indexOf('\nfunction buildPath(');
const canEditAt = html.indexOf('\nfunction _canEdit(');
const chapNbrAt = html.indexOf('\nfunction _chapterNeighbors(');
assert.ok(buildPathAt > 0 && initAt > 0, 'anchors present');
assert.ok(canEditAt > buildPathAt, '_canEdit must be defined after buildPath (static slice)');
assert.ok(chapNbrAt > buildPathAt, '_chapterNeighbors must be defined after buildPath (static slice)');
// And NOT stranded in the excluded [init, buildPath) gap.
assert.ok(!(canEditAt > initAt && canEditAt < buildPathAt), '_canEdit stranded in excluded gap');
assert.ok(!(chapNbrAt > initAt && chapNbrAt < buildPathAt), '_chapterNeighbors stranded in excluded gap');
console.log('  static-slice helper placement: OK');

console.log('unit-static-teacher: ALL PASSED');
