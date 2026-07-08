// unit-qc-skip.test.js
// v49 bug 6: a lesson that passed a full QC pass and hasn't been edited since must be
// SKIPPED by storyline-/chapter-level (bulk) QC jobs, but NEVER by an explicit single-lesson
// request or a flagged-only run. This is driven by ls.qcAt: stamped at the end of a clean
// full pass, cleared on any content edit (qcSignature change). Checkers are stubbed — no
// backend needed.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function ext(src, n) {
  const at = src.indexOf('function ' + n + '(');
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// Pure helpers rebuilt straight from source.
const qcSignature        = new Function(ext(server, 'qcSignature') + '\nreturn qcSignature;')();
const _clearLessonQcStamp = new Function(ext(server, '_clearLessonQcStamp') + '\nreturn _clearLessonQcStamp;')();
const _lessonHasOpenQcFlag = new Function(ext(server, '_lessonHasOpenQcFlag') + '\nreturn _lessonHasOpenQcFlag;')();

// ── qcSignature: content changes flip it; flag/rating/rename/qcAt do not ──────
const base = { type: 'standard', title: 'A', vocab: [{ target: 'قطة', source: 'cat' }],
               sentences: [{ target: 'س', source: 'x' }] };
assert.strictEqual(qcSignature(base), qcSignature({ ...base }), 'identical content → same sig');
assert.strictEqual(qcSignature(base),
  qcSignature({ ...base, title: 'renamed', icon: '🐱', _hidden: true }),
  'title/icon/_hidden do not affect signature');
assert.strictEqual(qcSignature(base),
  qcSignature({ ...base, qcAt: '2026-01-01', vocab: [{ target: 'قطة', source: 'cat', userFlag: { comment: 'z' }, userRating: 1, qc: { sug: 's' } }] }),
  'flag/rating/qc/qcAt on items do not affect signature');
assert.notStrictEqual(qcSignature(base),
  qcSignature({ ...base, vocab: [{ target: 'قطة', source: 'kitten' }] }),
  'changing a source text DOES change the signature');
assert.notStrictEqual(qcSignature(base),
  qcSignature({ ...base, sentences: [{ target: 'ط', source: 'x' }] }),
  'changing a sentence target DOES change the signature');
// v49: grammar + conjugation content is part of the signature (they are now QC'd).
const gbase = { type: 'grammar', grammar: [{ target: 'Übung', source: 'exercise', article: 'die', plural: 'Übungen' }] };
assert.strictEqual(qcSignature(gbase), qcSignature({ ...gbase }), 'identical grammar → same sig');
assert.notStrictEqual(qcSignature(gbase),
  qcSignature({ type: 'grammar', grammar: [{ target: 'Übung', source: 'practice', article: 'die', plural: 'Übungen' }] }),
  'changing a grammar source DOES change the signature');
assert.notStrictEqual(qcSignature(gbase),
  qcSignature({ type: 'grammar', grammar: [{ target: 'Übung', source: 'exercise', article: 'der', plural: 'Übungen' }] }),
  'changing a grammar article DOES change the signature');
const cbase = { type: 'conjugation', conjugations: [{ infinitive: 'watch', source: '見る' }] };
assert.notStrictEqual(qcSignature(cbase),
  qcSignature({ type: 'conjugation', conjugations: [{ infinitive: 'watch', source: '観る' }] }),
  'changing a conjugation source DOES change the signature');
console.log('  qcSignature: content-sensitive, flag/rename-insensitive: OK');

// ── _clearLessonQcStamp ──
const st = { qcAt: '2026-01-01' };
assert.strictEqual(_clearLessonQcStamp(st), true, 'returns true when a stamp was removed');
assert.ok(!('qcAt' in st), 'qcAt deleted');
assert.strictEqual(_clearLessonQcStamp({}), false, 'returns false when there was no stamp');
console.log('  _clearLessonQcStamp: OK');

// ── _runQc skip/stamp behavior ───────────────────────────────────────────────
let pairCalls = 0;
const okChecker = async () => { pairCalls++; return { ok: true }; };       // always clean
const stubs = {
  OLLAMA_TRANSLATION_MODEL: 'stub',
  OLLAMA_QC_MODEL: 'qc-stub',
  jobStep: () => {}, jobDone: (id, d) => { stubs._last = d; }, _last: null,
  upsert: () => {},
  _qcLessonUserFlagged: (tp, ls) => (ls.vocab || []).some(x => x && x.userFlag),
  _lessonHasOpenQcFlag,
  qcCheckPair: okChecker,
  qcCheckCloze: async () => { pairCalls++; return { ok: true }; },
  qcCheckSynonymSet: async () => { pairCalls++; return { ok: true }; },
};
const runQc = new Function(...Object.keys(stubs).filter(k => k !== '_last'),
  'async ' + ext(server, '_runQc') + '\nreturn _runQc;')(
  ...Object.keys(stubs).filter(k => k !== '_last').map(k => stubs[k]));

function freshTopic() {
  return { id: 't1', topic: 'T', lang: 'ar', srcLang: 'en',
    lessons: [{ type: 'standard', title: 'L0', vocab: [{ target: 'قطة', source: 'cat' }] }] };
}

(async () => {
  // 1) First full bulk pass: clean → stamps qcAt, no skip.
  let tp = freshTopic();
  pairCalls = 0;
  await runQc('j1', [tp], { lessonIdx: null, onlyFlagged: false });
  assert.strictEqual(pairCalls, 1, 'first pass checks the (only) item');
  assert.ok(tp.lessons[0].qcAt, 'clean full pass stamps qcAt');
  assert.strictEqual(stubs._last.skipped, 0, 'nothing skipped on first pass');

  // 2) Second bulk pass on the now-stamped topic: SKIPPED, checker not called.
  pairCalls = 0;
  await runQc('j2', [tp], { lessonIdx: null, onlyFlagged: false });
  assert.strictEqual(pairCalls, 0, 'stamped+unedited lesson is not re-checked in bulk');
  assert.strictEqual(stubs._last.skipped, 1, 'skipped count reported');

  // 2b) force:true bypasses the skip on a bulk run (e.g. after QC-prompt tuning).
  pairCalls = 0;
  await runQc('j2b', [tp], { lessonIdx: null, onlyFlagged: false, force: true });
  assert.strictEqual(pairCalls, 1, 'force re-checks a stamped lesson in bulk');
  assert.strictEqual(stubs._last.skipped, 0, 'force → nothing skipped');

  // 3) Explicit single-lesson request re-checks despite the stamp.
  pairCalls = 0;
  await runQc('j3', [tp], { lessonIdx: 0, onlyFlagged: false });
  assert.strictEqual(pairCalls, 1, 'explicit single-lesson QC ignores the stamp');
  assert.strictEqual(stubs._last.skipped, 0, 'single-lesson request never counts as skipped');

  // 4) flagged-only run is not skipped by the stamp (and must not re-stamp).
  tp.lessons[0].vocab[0].userFlag = { comment: 'check me' };
  pairCalls = 0;
  await runQc('j4', [tp], { lessonIdx: null, onlyFlagged: true });
  assert.strictEqual(pairCalls, 1, 'flagged-only run re-checks a flagged stamped lesson');

  // 5) After a content edit clears the stamp, bulk QC checks it again.
  tp = freshTopic(); tp.lessons[0].qcAt = '2026-01-01T00:00:00Z';
  // simulate the edit path: content changed → stamp cleared
  const edited = { ...tp.lessons[0], vocab: [{ target: 'قطة', source: 'kitten' }] };
  if (qcSignature(tp.lessons[0]) !== qcSignature(edited)) _clearLessonQcStamp(edited);
  tp.lessons[0] = edited;
  assert.ok(!tp.lessons[0].qcAt, 'edit cleared the stamp');
  pairCalls = 0;
  await runQc('j5', [tp], { lessonIdx: null, onlyFlagged: false });
  assert.strictEqual(pairCalls, 1, 'edited lesson is re-checked in bulk');
  assert.ok(tp.lessons[0].qcAt, 're-checked clean lesson is re-stamped');

  // 6) A lesson that flags during a full pass is NOT stamped (so it keeps getting checked).
  const flagStub = { ...stubs, qcCheckPair: async () => ({ ok: false, sug: 'bad', field: 'source' }) };
  const runQcFlag = new Function(...Object.keys(flagStub).filter(k => k !== '_last'),
    'async ' + ext(server, '_runQc') + '\nreturn _runQc;')(
    ...Object.keys(flagStub).filter(k => k !== '_last').map(k => flagStub[k]));
  const tp2 = freshTopic();
  await runQcFlag('j6', [tp2], { lessonIdx: null, onlyFlagged: false });
  assert.ok(!tp2.lessons[0].qcAt, 'a lesson that produced a flag is never stamped clean');
  assert.ok(tp2.lessons[0].vocab[0].qc, 'the flag was written');

  console.log('  _runQc: stamp-on-clean, bulk-skip, single/flagged-never-skip, edit-invalidate: OK');

  // ── Wiring guards: the edit + save-story handlers must invalidate the stamp ──────────
  assert.ok(/if \(merged\.qcAt && qcSignature\(orig\) !== qcSignature\(merged\)\)\s*\{\s*_clearLessonQcStamp\(merged\)/.test(server),
    '/api/lessons/edit clears the stamp when the content signature changed');
  assert.ok(/const _storyChanged = \(saved\.story !== story\)/.test(server),
    '/api/save-story detects a story change');
  assert.ok(/_storyChanged[\s\S]{0,400}error_hunt[\s\S]{0,120}_clearLessonQcStamp\(ls\)/.test(server),
    '/api/save-story clears the stamp on story-derived (error-hunt) lessons');
  // The bulk auto-QC after a generated book stays a full pass (so it stamps fresh lessons).
  assert.ok(/_runQc\(newJob\(\), qcTopics, \{ lessonIdx: null, onlyFlagged: false \}\)/.test(server),
    'post-book auto-QC runs a full (stampable) pass');
  // The /api/qc endpoint threads a force flag (bulk re-check override) into _runQc.
  assert.ok(/const \{ storylineId, topicId, lessonIdx, onlyFlagged, force \} = body/.test(server),
    '/api/qc reads a force flag');
  assert.ok(/force: !!force \}\)/.test(server), '/api/qc passes force into _runQc');

  // ── Client: shift-click on the QC button forces a full re-check ──────────────────────
  const qcRunFn = html.slice(html.indexOf('async function qcRun('),
                            html.indexOf('// Prefill the generation form to continue'));
  assert.ok(qcRunFn.length > 0, 'qcRun body found');
  assert.ok(/const force = \(scope && scope\.force\) \|\| !!\(window\.event && window\.event\.shiftKey\)/.test(qcRunFn),
    'qcRun derives force from an explicit scope.force or a shift-click, captured before any await');
  assert.ok(/body:JSON\.stringify\(body\)/.test(qcRunFn) && /const body = \{ \.\.\.scope, force \}/.test(qcRunFn),
    'qcRun sends the force flag in the request body');
  assert.ok(/qc\.toast\.forced/.test(qcRunFn), 'qcRun surfaces a forced-run indicator in the toast');
  // Tooltips advertise the shift-click affordance on the two bulk buttons.
  assert.ok(/t\('qc\.btn\.topic'\) \} \$\{t\('qc\.btn\.force_hint'\)/.test(html) ||
            /t\('qc\.btn\.topic'\)\} \$\{t\('qc\.btn\.force_hint'\)/.test(html),
    'topic QC tooltip includes the force hint');
  assert.ok(/t\('qc\.btn\.storyline'\) \+ ' ' \+ t\('qc\.btn\.force_hint'\)/.test(html),
    'storyline-screen QC tooltip includes the force hint');
  console.log('  edit + save-story wiring clears the stamp; post-book QC stays full: OK');

  console.log('unit-qc-skip: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
