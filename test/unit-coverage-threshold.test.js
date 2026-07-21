// unit-coverage-threshold.test.js
// v60.8 — (1) clean completion card: no trophy/%-pill/stat panels, just progress bars incl. a
// %-solved bar; (2) global teacher-set %-solved threshold to complete a chapter: below it the
// chapter stays incomplete and the completion card offers the drill (even to learners).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  if (at < 1) at = (src.indexOf('function ' + name + '(') >= 0 ? src.indexOf('function ' + name + '(') : -1);
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. Clean card: removed elements are gone ──────────────────────────────────
{
  const screen = html.slice(html.indexOf('id="complete-screen"'), html.indexOf('id="comp-story-unlocked"'));
  for (const gone of ['class="trophy"', 'id="comp-xp"', 'id="comp-sub"', 'class="stat-row"', 'id="s-correct"', 'id="stat-flagged"']) {
    assert.ok(!screen.includes(gone), `completion card no longer has ${gone}`);
  }
  assert.ok(screen.includes('id="comp-progress"'), 'the progress-bars container remains');
  assert.ok(!html.includes('.trophy{') && !html.includes('.prog-pill{') && !html.includes('.stat-box{'),
    'dead CSS for the removed elements is gone');
  assert.ok(!/function _setStatLbl\(/.test(html), 'dead _setStatLbl helper removed');
  // showComplete no longer touches the removed stat elements.
  const sc = ext(html, 'showComplete');
  assert.ok(!/el\('s-correct'\)/.test(sc) && !/el\('comp-xp'\)/.test(sc), 'showComplete no longer populates stat boxes');
}
console.log('  clean card: trophy/%-pill/stat panels + dead CSS/JS removed: OK');

// ── 2. %-solved bar in the progress summary ───────────────────────────────────
{
  const prog = ext(html, '_compProgressHtml');
  assert.ok(/const cov = topicCoverage\(\);/.test(prog) && /rowsHtml\(t\('complete\.solved'\), cov\.solved, cov\.total\)/.test(prog),
    'a %-solved bar (correct-answer coverage) is appended below the chapter/story bars');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['complete.solved'], 'ui.json en has complete.solved');
  // Reuses the existing story/chapter labels (per the request).
  assert.ok(ui.en['complete.story_progress'] && ui.en['complete.chapter_progress'], 'story/chapter labels reused');
}
console.log('  %-solved bar present + reuses story/chapter labels: OK');

// ── 3. setComplete threshold gate (behavioral, classic set) ───────────────────
{
  const APP = { _teacherMode: false, info: { coverageThreshold: 0.8 },
    progress: { completed: { Ch: { a: {}, b: {} } } },
    lessonData: { topic: 'Ch', lessons: [{ id: 'a' }, { id: 'b' }] } };
  const countedLessons = d => (d.lessons || []);
  let cov = { solved: 5, total: 10 };
  const topicCoverage = () => cov;
  const _coverageTarget = new Function('APP', ext(html, '_coverageTarget') + '\nreturn _coverageTarget;')(APP);
  const setComplete = new Function('APP', 'countedLessons', 'topicCoverage', '_coverageTarget',
    ext(html, 'setComplete') + '\nreturn setComplete;')(APP, countedLessons, topicCoverage, _coverageTarget);

  assert.strictEqual(setComplete(APP.lessonData), false, 'all lessons done but 50% solved < 80% → NOT complete (gated)');
  cov = { solved: 8, total: 10 };
  assert.strictEqual(setComplete(APP.lessonData), true, '80% solved meets 80% threshold → complete');
  cov = { solved: 5, total: 10 };
  APP.info.coverageThreshold = 1;
  assert.strictEqual(setComplete(APP.lessonData), true, 'threshold 100% (default/off) → no coverage gate, historical behavior');
  // A teacher is never gated.
  APP.info.coverageThreshold = 0.8; APP._teacherMode = true;
  assert.strictEqual(setComplete(APP.lessonData), true, 'teacher is exempt from the gate');
}
console.log('  setComplete: classic set gated below threshold, exempt at 100%/teacher: OK');

// ── 4. _coverageTarget precedence: per-topic > global > 1 ─────────────────────
{
  const mk = (info, d) => new Function('APP', ext(html, '_coverageTarget') + '\nreturn _coverageTarget;')({ info, lessonData: d });
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { coverageTarget: 0.9 })({}), 0.9, 'per-topic target wins');
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, {})({}), 0.7, 'falls back to the global threshold');
  assert.strictEqual(mk({}, {})({}), 1, 'falls back to 1 when neither is set');
}
console.log('  _coverageTarget precedence: topic > global > 1: OK');

// ── 5. Card: below-threshold offers the drill + a hint ────────────────────────
{
  const sc = ext(html, 'showComplete');
  assert.ok(/let _belowThreshold = false, _threshPct = 100;/.test(sc), 'card computes below-threshold state');
  assert.ok(/_db\.style\.display = \(\(_teacher \|\| _belowThreshold\) && drillAvailable/.test(sc),
    'the drill is offered to a below-threshold learner (not just teachers)');
  assert.ok(/complete\.below_threshold/.test(sc) && /complete\.keep_going/.test(sc),
    'a below-threshold hint + "keep going" title are shown');
}
console.log('  card: below-threshold drill offer + hint: OK');

// ── 6. Server: settings persistence + endpoint + /api/info ────────────────────
{
  assert.ok(/settings: data\.settings \|\| \{\}/.test(server), 'loadStore reads settings back (survives restart)');
  assert.ok(/\.\.\.\(s\.settings \? \{ settings: s\.settings \} : \{\}\)/.test(server), 'saveStore persists settings');
  const gs = ext(server, 'getSettings');
  assert.ok(/typeof s\.coverageThreshold === 'number'\) \? s\.coverageThreshold : 1/.test(gs),
    'default threshold is 1 (off / historical) so existing installs do not suddenly gate');
  assert.ok(/coverageThreshold: getSettings\(\)\.coverageThreshold/.test(server), '/api/info exposes the threshold');
  const route = server.slice(server.indexOf("url.pathname === '/api/coverage-threshold'"),
                             server.indexOf("url.pathname === '/api/coverage-threshold'") + 700);
  assert.ok(/setCoverageThreshold\(body\.value\)\.coverageThreshold/.test(route), 'POST sets + returns the numeric value');
  assert.ok(/value must be a number/.test(route), 'POST validates the value');
  // Client wiring.
  assert.ok(/onchange="switchThreshold\(this\.value\)"/.test(html), 'model menu has the threshold field');
  const st = ext(html, 'switchThreshold');
  assert.ok(/\/api\/coverage-threshold/.test(st) && /value:pct\/100/.test(st), 'switchThreshold posts value as a fraction');
  assert.ok(/APP\.info\.coverageThreshold =/.test(st), 'switchThreshold updates the live info so the gate applies immediately');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['models.threshold', 'models.threshold_hint', 'models.threshold_set', 'complete.keep_going', 'complete.below_threshold'])
    assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  server: settings persistence + endpoint + info + client wiring: OK');

console.log('unit-coverage-threshold: ALL PASSED');
