// unit-student-flags.test.js
// v68.1 — flagging/starring in STUDENT mode (queued in the v68 notes). Contract:
//   • the play ⭐/⚑ buttons + flag form render for everyone (they were _canEdit-gated, so the
//     static build's learners had no way to report a wrong pair — the best QC signal there is);
//     the read-only flag REVIEW banner stays teacher-only (a reviewer surface);
//   • every new userFlag / userRating / _miscFlags / story-flag entry records WHICH MODE produced
//     it via _flagMode() — 'teacher'|'student', keyed off teacher mode alone (canGenerate is the
//     editing axis, not the mode axis — same reasoning as _isLearner);
//   • the editor surfaces a 👤 student chip on student-made flags;
//   • fixFlagModes (server boot) stamps every pre-v68.1 flag 'teacher' — provably correct, since
//     only teacher surfaces could write flags before this change. Verified end-to-end on a
//     corrupted store, incl. that already-stamped student flags are never overwritten.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The play flag UI is no longer teacher-gated; the review banner still is ────────────────
{
  const re = ext(html, 'renderEx');
  assert.ok(!/const flagUi = _canEdit\(\) \?/.test(re), 'the flag/star buttons are not _canEdit-gated anymore');
  assert.ok(/togglePlayRating\(\)/.test(re) && /togglePlayFlagForm\(\)/.test(re) && /savePlayFlag\(\)/.test(re),
    'star, flag toggle and save are all wired in the play UI');
  assert.ok(/const flagBanner = \(fl && _canEdit\(\)\)/.test(re),
    'the read-only flag REVIEW banner stays teacher-only');
}
console.log('  play UI: flag/star for everyone, review banner teacher-only: OK');

// ── 2. _flagMode + all four write sites stamp it ──────────────────────────────────────────────
{
  const fm = new Function('APP', ext(html, '_flagMode') + '\nreturn _flagMode;');
  assert.strictEqual(fm({ _teacherMode: false })(), 'student', 'teacher mode off → student');
  assert.strictEqual(fm({ _teacherMode: true })(), 'teacher', 'teacher mode on → teacher');
  // canGenerate must NOT influence the mode (it is the editing axis).
  const src = ext(html, '_flagMode');
  assert.ok(!/canGenerate|_canEdit/.test(src), '_flagMode keys off teacher mode alone');

  assert.ok(/const flag=\{ comment, correct, at:new Date\(\)\.toISOString\(\), mode:_flagMode\(\) \};/.test(html),
    'play flags stamp mode');
  assert.ok(/obj\.userRating=\{ at:new Date\(\)\.toISOString\(\), mode:_flagMode\(\) \};/.test(html),
    'play stars stamp mode');
  assert.ok(/item\.userFlag = \{ comment, correct, at: new Date\(\)\.toISOString\(\), mode: _flagMode\(\) \};/.test(html),
    'editor flags stamp mode');
  assert.ok(/type:'story',flaggedAt:new Date\(\)\.toISOString\(\),mode:_flagMode\(\)/.test(html),
    'story flags stamp mode');
  // The editor shows student provenance.
  assert.ok(/mode==='student'[\s\S]{0,220}flag\.mode\.student/.test(html),
    'the editor renders a student chip on student-made flags');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['flag.mode.student'], 'ui.json en has flag.mode.student');
}
console.log('  mode stamping: helper semantics + all four write sites + editor chip + i18n: OK');

// ── 3. fixFlagModes end-to-end on a corrupted store ───────────────────────────────────────────
{
  const tmp = path.join(os.tmpdir(), 'dz_flagmode_' + process.pid + '.json');
  const store = {
    schemaVersion: 30, storylines: [],
    flags: {
      'tp_1:story': { topic: 'Ch', type: 'story', flaggedAt: '2026-01-01' },          // legacy → teacher
      'tp_1:story2': { topic: 'Ch2', type: 'story', flaggedAt: '2026-07-01', mode: 'student' }, // stays
    },
    topics: [{
      id: 'tp_1', topic: 'Ch', lang: 'it', srcLang: 'de', story: 'x',
      lessons: [{
        id: '1',
        vocab: [
          { target: 'a', source: 'A', userFlag: { comment: 'old', at: '2026-01-01' } },          // legacy
          { target: 'b', source: 'B', userRating: { at: '2026-01-01' } },                         // legacy
          { target: 'c', source: 'C', userFlag: { comment: 'new', at: '2026-07-22', mode: 'student' } }, // stays
          { target: 'd', source: 'D' },                                                           // untouched
        ],
        sentences: [ { target: 's', source: 'S', userFlag: { at: '2026-01-01' } } ],              // legacy
        _miscFlags: [ { comment: 'm', at: '2026-01-01' } ],                                       // legacy
      }],
    }],
  };
  fs.writeFileSync(tmp, JSON.stringify(store));
  try {
    try {
      execFileSync(process.execPath, ['-e', `
        process.env.LESSONS_FILE = ${JSON.stringify(tmp)};
        process.env.PORT = '0';
        try { require(${JSON.stringify(path.join(ROOT, 'server.js'))}); } catch(_) {}
        setTimeout(() => process.exit(0), 300);
      `], { timeout: 20000, stdio: 'ignore' });
    } catch (_) { /* file is what matters */ }
    const after = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    const ls = after.topics[0].lessons[0];
    assert.strictEqual(ls.vocab[0].userFlag.mode, 'teacher', 'legacy item flag stamped teacher');
    assert.strictEqual(ls.vocab[1].userRating.mode, 'teacher', 'legacy star stamped teacher');
    assert.strictEqual(ls.vocab[2].userFlag.mode, 'student', 'an existing student stamp is never overwritten');
    assert.ok(!ls.vocab[3].userFlag && !ls.vocab[3].userRating, 'unflagged items gain nothing');
    assert.strictEqual(ls.sentences[0].userFlag.mode, 'teacher', 'sentence flags covered');
    assert.strictEqual(ls._miscFlags[0].mode, 'teacher', '_miscFlags covered');
    assert.strictEqual(after.flags['tp_1:story'].mode, 'teacher', 'story-flag store covered');
    assert.strictEqual(after.flags['tp_1:story2'].mode, 'student', 'stamped story flags untouched');
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}
console.log('  fixFlagModes: legacy → teacher, student stamps preserved, non-flags untouched: OK');

// ── 4. The shipped corpus honors the invariant: every flag/star carries a mode ────────────────
{
  const lessons = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const ARRAYS = ['vocab', 'sentences', 'items', 'words', 'letters', 'grammar', 'conjugations'];
  let checked = 0;
  for (const t of lessons.topics) for (const ls of (t.lessons || [])) {
    for (const k of ARRAYS) for (const it of (ls[k] || [])) {
      if (it && it.userFlag)   { assert.ok(it.userFlag.mode,   `flag has a mode (${t.topic})`);   checked++; }
      if (it && it.userRating) { assert.ok(it.userRating.mode, `star has a mode (${t.topic})`);   checked++; }
    }
    for (const f of (ls._miscFlags || [])) { assert.ok(f.mode, `misc flag has a mode (${t.topic})`); checked++; }
  }
  for (const f of Object.values(lessons.flags || {}))
    if (f && typeof f === 'object') { assert.ok(f.mode, 'store flag has a mode'); checked++; }
  assert.ok(checked > 0, `the corpus really contains flags to check (${checked})`);
  console.log(`  corpus: ${checked} flag(s)/star(s), all mode-stamped: OK`);
}

console.log('unit-student-flags: ALL PASSED');
