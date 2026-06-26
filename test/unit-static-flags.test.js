// v47 — static-build flag handling.
//  Task 1: flagged items (userFlag or QC) are dropped from non-teacher static play. The
//          filter resolves an exercise to its source item via _resolveExItem; this tests
//          that resolution + the flagged predicate.
//  Task 2: a "download & submit" pill tallies pending per-item flags/ratings (and a
//          lesson's _miscFlags) via _topicHasPending; this tests that tally.
// The DOM/pill/download behaviour itself is browser-verify-owed.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const at = html.indexOf('function ' + name + '(');
  assert.ok(at >= 0, 'missing fn ' + name);
  const bs = html.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < html.length; i++) { const c = html[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return html.slice(at, i);
}
const { _resolveExItem, _topicHasPending } = new Function(
  extract('_resolveExItem') + '\n' + extract('_topicHasPending') +
  '\nreturn { _resolveExItem, _topicHasPending };')();

// Task 1: the play filter drops an exercise when its source item is flagged.
const exFlagged = it => !!(it && (it.userFlag || it.qc));   // the predicate buildExercises uses

const vocabLs = { vocab: [{ target: 'Hund', source: 'dog', userFlag: { comment: 'wrong' } }, { target: 'Katze', source: 'cat' }] };
assert.ok(exFlagged(_resolveExItem({ type: 'mcq_target_source', target: 'Hund' }, vocabLs)), 'flagged vocab item resolves & is flagged');
assert.ok(!exFlagged(_resolveExItem({ type: 'mcq_target_source', target: 'Katze' }, vocabLs)), 'clean vocab item is not flagged');

const sentLs = { sentences: [{ target: 'Das ist gut', source: 'That is good', qc: { sug: 'x' } }] };
assert.ok(exFlagged(_resolveExItem({ type: 'read_translate', target: 'Das ist gut' }, sentLs)), 'QC-flagged sentence is caught');

const wfLs = { items: [{ sentence: 'I ___ home', qc: {} }] };
assert.ok(exFlagged(_resolveExItem({ type: 'word_form', sentence: 'I ___ home' }, wfLs)), 'word_form item resolves & flagged');

const synLs = { words: [{ base: 'big', userFlag: {} }] };
assert.ok(exFlagged(_resolveExItem({ type: 'syn_select', base: 'big' }, synLs)), 'synonyms item resolves & flagged');

assert.strictEqual(_resolveExItem({ type: 'mcq_target_source', target: 'Nope' }, vocabLs), null, 'unmatched target resolves to null (kept)');
console.log('  Task 1: flagged items resolve & would be filtered; clean kept: OK');

// Task 2: pending tally counts userFlag, userRating, and _miscFlags across a topic.
assert.strictEqual(_topicHasPending({ lessons: [{ vocab: [{ target: 'a' }] }] }), 0, 'clean topic -> 0');
assert.strictEqual(_topicHasPending({ lessons: [{ vocab: [{ userFlag: {} }, { userRating: {} }] }] }), 2, 'flag + rating -> 2');
assert.strictEqual(_topicHasPending({ lessons: [{ sentences: [{ userFlag: {} }], _miscFlags: [{}, {}] }] }), 3, 'sentence flag + 2 misc -> 3');
assert.strictEqual(_topicHasPending({ lessons: [{ items: [{ userRating: {} }], words: [{ userFlag: {} }] }] }), 2, 'wf rating + syn flag -> 2');
assert.strictEqual(_topicHasPending({}), 0, 'no lessons -> 0');
console.log('  Task 2: pending tally counts flags/ratings/_miscFlags: OK');

// Structural guards (UI behaviour is browser-owed).
assert.ok(/typeof STATIC_LESSONS !== 'undefined' && !APP\._teacherMode && Array\.isArray\(ex\)/.test(html),
  'buildExercises must filter flagged items only in static non-teacher play');
assert.ok(/id="static-flag-submit-link"/.test(html), 'pill must include the GitHub submit link');
assert.ok(/const GITHUB_ISSUES_URL = 'https:\/\/github\.com\/raim\/dreizunge\/issues\/new'/.test(html),
  'GitHub issues URL constant present');
assert.ok(/function downloadUserFlaggedLessons\(storylineId\)/.test(html), 'download supports a storyline scope arg');
assert.ok(/try\{ updateStaticFlagBanner\(\); \}catch\(_\)\{\}/.test(html), 'persist paths refresh the pill');
console.log('  static flag/pill wiring: OK');

// Persistence round-trip: collect -> save (localStorage) -> simulate reload -> reapply.
// Functions read globals (STATIC_LESSONS, APP, localStorage) + consts _staticFlagsKey /
// _FLAG_ARRAYS; we provide all of them in the sandbox.
const consts = "const _staticFlagsKey='dz_static_flags';\nconst _FLAG_ARRAYS=[['vocab','target'],['sentences','target'],['items','sentence'],['words','base']];\n";
const fns = ['_staticLessonSource', '_collectStaticFlags', '_applyStaticFlags', '_saveStaticFlags', '_ensureStaticFlagsLoaded']
  .map(extract).join('\n');
function makeSandbox(STATIC_LESSONS) {
  const store = {};
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const APP = { savedList: STATIC_LESSONS, _staticFlagsLoaded: false };
  const api = new Function('STATIC_LESSONS', 'APP', 'localStorage',
    consts + fns + '\nreturn { _saveStaticFlags, _applyStaticFlags, _ensureStaticFlagsLoaded, APP };'
  )(STATIC_LESSONS, APP, localStorage);
  api.store = store;
  return api;
}

const bundle = [{
  id: 'tp_1', topic: 'Greetings',
  lessons: [
    { type: 'vocab', vocab: [{ target: 'Hund', userFlag: { comment: 'bad' } }, { target: 'Katze', userRating: { at: 't' } }], sentences: [{ target: 'S1', userDelete: { at: 't' } }] },
    { type: 'word_forms', items: [{ sentence: 'I ___ home', userFlag: { correct: 'go' } }], _miscFlags: [{ exType: 'mcq_article', target: 'der' }] },
  ],
}];
const sb = makeSandbox(bundle);
sb._saveStaticFlags();                       // snapshot to (fake) localStorage
assert.ok(sb.store['dz_static_flags'] && sb.store['dz_static_flags'].length > 2, 'flags written to localStorage');

// Simulate a reload: fresh bundle (no flags) + reset the one-time guard.
const fresh = JSON.parse(JSON.stringify(bundle).replace(/"userFlag":\{[^}]*\}/g, '"_":0').replace(/"userRating":\{[^}]*\}/g, '"_":0').replace(/"userDelete":\{[^}]*\}/g, '"_":0').replace(/"_miscFlags":\[[^\]]*\]/g, '"_miscFlags":[]'));
const sb2 = new Function('STATIC_LESSONS', 'APP', 'localStorage',
  consts + fns + '\nreturn { _ensureStaticFlagsLoaded, APP, STATIC_LESSONS };'
)(fresh, { savedList: fresh, _staticFlagsLoaded: false }, { getItem: () => sb.store['dz_static_flags'], setItem: () => {} });

sb2._ensureStaticFlagsLoaded();              // reapply persisted flags
const L0 = sb2.STATIC_LESSONS[0].lessons[0], L1 = sb2.STATIC_LESSONS[0].lessons[1];
assert.deepStrictEqual(L0.vocab[0].userFlag, { comment: 'bad' }, 'vocab userFlag restored');
assert.deepStrictEqual(L0.vocab[1].userRating, { at: 't' }, 'vocab userRating restored');
assert.ok(!L0.vocab[1].userFlag, 'rating-only item has no flag');
assert.deepStrictEqual(L1.items[0].userFlag, { correct: 'go' }, 'word_form userFlag restored');
assert.deepStrictEqual(L1._miscFlags, [{ exType: 'mcq_article', target: 'der' }], '_miscFlags restored');
assert.deepStrictEqual(L0.sentences[0].userDelete, { at: 't' }, 'delete-candidate (userDelete) restored');

// Idempotent: a second ensure does nothing (guard) and does not duplicate _miscFlags.
sb2._ensureStaticFlagsLoaded();
assert.strictEqual(L1._miscFlags.length, 1, 'reapply is idempotent (no _miscFlags dupes)');
console.log('  persistence round-trip (save -> reload -> reapply, idempotent): OK');

// #1: content edits persist by POSITION across reload (edits can change the identity field).
const editsConsts = "const _staticEditsKey='dz_static_edits';\nconst _FLAG_ARRAYS=[['vocab','target'],['sentences','target'],['items','sentence'],['words','base']];\n";
const editsFns = ['_staticLessonSource', '_collectStaticEdits', '_applyStaticEdits'].map(extract).join('\n');
const editStore = {};
const editedBundle = [{ id: 't1', topic: 'T', lessons: [{ vocab: [{ target: 'EditedWord', source: 'new', editedAt: 'T1' }, { target: 'B' }] }] }];
const sbE = new Function('STATIC_LESSONS', 'APP', 'localStorage',
  editsConsts + editsFns + '\nreturn { _collectStaticEdits };'
)(editedBundle, { savedList: editedBundle }, { getItem: k => editStore[k] || null, setItem: (k, v) => { editStore[k] = v; } });
editStore['dz_static_edits'] = JSON.stringify(sbE._collectStaticEdits());
// Reload: fresh bundle with ORIGINAL content, no editedAt.
const freshB = [{ id: 't1', topic: 'T', lessons: [{ vocab: [{ target: 'OrigWord', source: 'old' }, { target: 'B' }] }] }];
const APP_E = { savedList: freshB, _staticDirtyTopics: new Set() };
const sbE2 = new Function('STATIC_LESSONS', 'APP', 'localStorage',
  editsConsts + editsFns + '\nreturn { _applyStaticEdits, APP, STATIC_LESSONS };'
)(freshB, APP_E, { getItem: k => editStore[k] || null, setItem: () => {} });
sbE2._applyStaticEdits();
assert.strictEqual(sbE2.STATIC_LESSONS[0].lessons[0].vocab[0].target, 'EditedWord', 'edit restored by position');
assert.strictEqual(sbE2.STATIC_LESSONS[0].lessons[0].vocab[0].source, 'new', 'edited source restored');
assert.strictEqual(sbE2.STATIC_LESSONS[0].lessons[0].vocab[1].target, 'B', 'non-edited item unchanged');
assert.ok(sbE2.APP._staticDirtyTopics.has('t1'), 'edited topic re-marked dirty after reload');
console.log('  #1 content edits persist by position across reload: OK');

// Teacher mode persists across reloads (localStorage 'dz_teacher_mode'); pill shows on load.
assert.ok(/const _TEACHER_KEY = 'dz_teacher_mode'/.test(html), 'teacher-mode key defined');
assert.ok(/APP\._teacherMode = \(localStorage\.getItem\(_TEACHER_KEY\) === '1'\)/.test(html), 'teacher mode restored early');
assert.ok(/localStorage\.setItem\(_TEACHER_KEY, APP\._teacherMode \? '1' : '0'\)/.test(html), 'toggleTeacherMode persists');
const bstatic = fs.readFileSync(path.join(__dirname, '..', 'build-static.js'), 'utf8');
assert.ok(/localStorage\.getItem\('dz_teacher_mode'\) === '1'/.test(bstatic), 'static init restores teacher mode (no hard false)');
assert.ok(!/APP\._teacherMode = false;(?!.*catch)/.test(bstatic.replace(/catch \(_\) \{ APP\._teacherMode = false; \}/g, '')), 'static init no longer hard-forces teacher mode off');
assert.ok(/updateStaticFlagBanner\(\); \} catch \(_\) \{\}\s*\/\/ show the download & submit pill on first load/.test(bstatic), 'static init shows the pill on first load');
console.log('  teacher-mode persistence + pill-on-load wiring: OK');

// v47 editor/pill batch ---------------------------------------------------------------
// Pill: close button + dismiss + edits trigger + t()-based counts.
assert.ok(/id="static-flag-close-btn"/.test(html), 'pill has a close button');
assert.ok(/function closeStaticPill\(\)\{ APP\._pillDismissed = true/.test(html), 'closeStaticPill dismisses');
assert.ok(/function _markStaticEdited\(\)/.test(html), 'edits mark the topic dirty');
assert.ok(/_markStaticEdited\(\); \} catch \(_\) \{\}\s*\/\/ static: edits\/deletes prompt/.test(html), 'sync hooks the edit pill');
assert.ok(/function _topicPendingOrEdited\(l\)/.test(html), 'download scope includes edited topics');
assert.ok(/APP\._pillDismissed = false;\s*\/\/ new flag\/rating un-dismisses/.test(html), 'new flag un-dismisses pill');
assert.ok(/chips\.push\('⚑ ' \+ flags\)/.test(html), 'pill flag count inlined (no ui.json key)');
assert.ok(/chips\.push\('⭐ ' \+ ratings\)/.test(html), 'pill star count inlined (no ui.json key)');
assert.ok(/link\.textContent = t\('static\.pill\.submit'\)/.test(html), 'submit link text via t()');
assert.ok(!/download and open an issue so they can be merged/.test(html), 'long pill message removed');

// Editor: star indication (userRating carried into the synthetic standard item) + starred class.
assert.ok(/userFlag:v\.userFlag, userRating:v\.userRating/.test(html), 'standard editor carries userRating (star shows)');
assert.ok(/\.editor-entry\.starred\{/.test(html), 'starred entry CSS present');
assert.ok(/function _starNoteHtml\(item\)/.test(html), 'good-example note helper present');
assert.ok((html.match(/\$\{[a-z]+\.userRating\? ?' starred'/g) || html.match(/userRating\?' starred'/g) || []).length >= 3
  || /\$\{it\.userRating\?' starred'/.test(html), 'editor entries get the starred class');

// Node badge: per-lesson star count alongside flags.
assert.ok(/const lessonStarCount=\[/.test(html), 'node star count computed');
assert.ok(/⭐ \$\{lessonStarCount\}/.test(html), 'node renders the star badge');

// ui.json: English pill strings present.
const ui = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ui.json'), 'utf8'));
['static.pill.download', 'static.pill.submit',
 'static.pill.tosubmit', 'static.pill.issue_body', 'editor.good_example'].forEach(k =>
  assert.ok(ui.en[k], 'ui.json en missing ' + k));
assert.ok(!ui.en['static.pill.flags'] && !ui.en['static.pill.stars'], 'emoji+count chips are not in ui.json');
console.log('  v47 editor/pill batch wiring + ui.json strings: OK');

// v47 soft-delete + complete-storyline export ----------------------------------------------
assert.strictEqual(_topicHasPending({ lessons: [{ vocab: [{ userDelete: {} }] }] }), 1, 'delete candidate is pending');

// _flaggedExportPayload exports COMPLETE storylines (every chapter) for any storyline with a
// flagged/edited chapter, plus flagged orphan topics; untouched storylines are excluded.
const exFns = ['_staticLessonSource', '_topicHasPending', '_topicPendingOrEdited', '_flaggedExportPayload'].map(extract).join('\n');
function exportSandbox(STATIC_LESSONS, storylines) {
  const APP = { savedList: STATIC_LESSONS, storylines, _staticDirtyTopics: new Set() };
  return new Function('STATIC_LESSONS', 'APP', exFns + '\nreturn { _flaggedExportPayload };')(STATIC_LESSONS, APP);
}
const bundle2 = [
  { id: 'c1', topic: 'Ch1', lessons: [{ vocab: [{ target: 'a', userFlag: {} }] }] }, // flagged
  { id: 'c2', topic: 'Ch2', lessons: [{ vocab: [{ target: 'b' }] }] },               // clean, same storyline
  { id: 'c3', topic: 'Ch3', lessons: [{ vocab: [{ target: 'c' }] }] },               // clean, other storyline
  { id: 'orph', topic: 'Orphan', lessons: [{ vocab: [{ target: 'd', userRating: {} }] }] }, // flagged orphan
];
const storylines2 = [{ id: 's1', title: 'Story 1', chapters: ['c1', 'c2'] }, { id: 's2', title: 'Story 2', chapters: ['c3'] }];
const ids = exportSandbox(bundle2, storylines2)._flaggedExportPayload().payload.lessons.map(l => l.id).sort();
assert.deepStrictEqual(ids, ['c1', 'c2', 'orph'], 'complete storyline c1+c2 + orphan; untouched s2 excluded');
console.log('  v47 complete-storyline export (all chapters of affected storylines): OK');

// structural guards
assert.ok(/function _staticSoftDelete\(item\)/.test(html), 'soft-delete helper present');
assert.ok(/_staticSoftDelete\(_ARR && ls\[_ARR\]/.test(html), 'deleteEditorItem soft-deletes in static');
assert.ok(/_staticSoftDelete\(ls\.words\[wi\]\)/.test(html), 'syn entry soft-deletes in static');
assert.ok(/_staticSoftDelete\(ls\.exercises\[ei\]\)/.test(html), 'math soft-deletes in static');
assert.ok(/chips\.push\('🗑 ' \+ deletes\)/.test(html), 'pill shows delete count');
assert.ok(/\.editor-entry\.del-candidate\{/.test(html), 'del-candidate CSS present');
assert.ok(/it\.userFlag \|\| it\.qc \|\| it\.userDelete/.test(html), 'delete candidates hidden from static play');
assert.ok(/if \(link\) link\.style\.display = 'none'/.test(html), 'stale submit link hidden on new activity');
assert.ok(/const _staticEditsKey = 'dz_static_edits'/.test(html), 'edits persistence key present');
assert.ok(/_saveStaticEdits\(\); _saveStaticFlags\(\)/.test(html), 'content edits persisted on change');
assert.ok(/try \{ _applyStaticEdits\(\); \} catch/.test(html), 'content edits restored on load');
console.log('  v47 soft-delete wiring: OK');

console.log('unit-static-flags: ALL PASSED');
