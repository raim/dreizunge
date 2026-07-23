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

// ── 4. _coverageTarget precedence: chapter > storyline > global > 80% ─────────
// v69_i (user request): the pass mark is settable per STORYLINE (applies to that storyline only)
// and per CHAPTER (overrides its storyline), with the global default now 80% rather than "solve
// everything". Absent at a level means INHERIT — deliberately not the same as 0, which means "no
// pass mark at all".
{
  const mk = (info, d, storylines, savedList) => new Function('APP',
    ext(html, '_storylineOfTopic') + '\n' + ext(html, '_coverageTarget') + '\nreturn _coverageTarget;')(
    { info, lessonData: d, storylines: storylines || [], savedList: savedList || [], _slScreen: null });
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { coverageTarget: 0.9 })({}), 0.9, 'per-chapter target wins');
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, {})({}), 0.7, 'falls back to the global threshold');
  assert.strictEqual(mk({}, {})({}), 0.8, 'falls back to 80% when nothing is set (v69_i default)');

  // The storyline level sits between them.
  const saved = [{ id: 'c1', topic: 'Ch1' }];
  const sls = [{ id: 'sl1', chapters: ['c1'], coverageTarget: 0.5 }];
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { id: 'c1', topic: 'Ch1' }, sls, saved)({}), 0.5,
    'a storyline pass mark beats the global default');
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { id: 'c1', topic: 'Ch1', coverageTarget: 0.95 }, sls, saved)({}), 0.95,
    'and a chapter pass mark beats its storyline');
  // A storyline WITHOUT a mark must not shadow the global one.
  const bare = [{ id: 'sl1', chapters: ['c1'] }];
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { id: 'c1', topic: 'Ch1' }, bare, saved)({}), 0.7,
    'a storyline with no mark of its own inherits, it does not reset to the default');
  // 0 is a real value ("no pass mark"), not "inherit".
  assert.strictEqual(mk({ coverageThreshold: 0.7 }, { coverageTarget: 0 })({}), 0, '0 is honoured, not treated as unset');
}
console.log('  _coverageTarget precedence: chapter > storyline > global > 80%: OK');

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

// ── 5b. The pass mark is ENFORCED, not merely advisory (v66.1) ───────────────
// Reported: a learner who had played every lesson but sat below the mark could still press Next
// and move to the following chapter — _firstUnfinishedLessonIdx returns -1 once every lesson has a
// done-flag, so the "next chapter" branch was reached. The chapter was marked incomplete, but
// nothing stopped them leaving it.
{
  const sc = ext(html, 'showComplete');
  // v69.2c: the drill is no longer the FIRST below-threshold branch (it looped — see §5c), but the
  // v66.1 GUARANTEE is unchanged: below the mark, Next never advances to the next chapter. It
  // offers progress (next lesson → coverage replay) and falls back to the drill.
  assert.ok(/\} else if \(_belowThreshold && !lesson\._drill && drillAvailable\(/.test(sc),
    'the drill remains a below-mark Next option (last resort)');
  assert.ok(/compNext\.onclick = \(\) => \{ startDrill\(\); \};/.test(sc), 'and it starts that drill');
  assert.ok(/\} else if \(!lesson\._drill && !_belowThreshold && _nextChapter\(\)\)/.test(sc),
    'the next-chapter branch refuses to advance while below the mark');
}
console.log('  pass mark enforced: cannot advance below the threshold (v66.1): OK');

// ── 5c. The drill flow has an exit AND coverage always has a way up (v69.2) ───────────────────
// User-reported double dead end (live mode, student): (1) the drill's own completion card had NO
// forward affordance — every Next branch excluded `_drill` and Back is hidden for drills; masked
// until v69 because the TDZ crash killed every completion card before it rendered. (2) A
// SUCCESSFUL drill walks the wrong-counts back down, so drillAvailable goes false while coverage
// is still short — and a classic chapter then showed the review card with no drill CTA and no
// Next ("stuck at 10/34"). Fixes: a `_drill` branch FIRST (Next → back into the launching
// chapter's remaining questions, else its completion/review card), and a coverage-replay fallback
// (Next → the first counted lesson whose own coverage is short — rounds re-sample, so replaying
// advances coverage).
{
  const sc = ext(html, 'showComplete');
  const drillAt   = sc.indexOf('if (lesson._drill) {');
  const nextAt    = sc.indexOf('nextLessonIdx >= 0 && !lesson._drill');
  const replayAt  = sc.indexOf('_firstCoverageShortLessonIdx() >= 0');
  const drillCta  = sc.indexOf('_belowThreshold && !lesson._drill && drillAvailable(');
  assert.ok(drillAt > 0 && drillCta > 0 && drillAt < drillCta,
    'the drill card gets its own Next branch, ordered BEFORE the drill CTA');
  // v69.2c (third stuck report): PROGRESS branches must precede the drill CTA. While the drill was
  // the first below-threshold branch, Next was always "practise your mistakes" — and the drill can
  // only re-ask wrong VOCAB words, never the sentence questions in the coverage universe, so the
  // learner looped card → drill → card forever with coverage plateaued. The drill is also offered
  // as its own #comp-drill button, so Next duplicating it bought nothing.
  assert.ok(nextAt > 0 && nextAt < drillCta, 'next-unfinished-lesson comes BEFORE the drill CTA');
  assert.ok(replayAt > 0 && replayAt < drillCta, 'the coverage replay comes BEFORE the drill CTA');
  assert.ok(/endDrill\(\);\s*const idx = _firstUnfinishedLessonIdx\(APP\.lessonData\);\s*if \(idx >= 0\) startLesson\(idx\); else showComplete\(true\);/.test(sc),
    'drill Next returns to the launching chapter: resume its questions, else its completion card');
  assert.ok(/else if \(_belowThreshold && !lesson\._drill && _firstCoverageShortLessonIdx\(\) >= 0\)/.test(sc),
    'below threshold with no drill → the coverage-replay fallback fires');
  const helper = ext(html, '_firstCoverageShortLessonIdx');
  assert.ok(/typeof lessonCoverage !== 'function'/.test(helper), 'the helper is typeof-guarded like its siblings');

  // Behavioral: first coverage-short counted lesson, mixed skipped, -1 when everything is full.
  const cov = { 0: { solved: 4, total: 4 }, 1: { solved: 1, total: 4 }, 2: { solved: 0, total: 6 } };
  const APP = { lessonData: { topic: 'T', lessons: [
    { id: 'a', type: 'standard' }, { id: 'm', type: 'mixed' }, { id: 'b', type: 'standard' },
  ] } };
  // Map fixture coverage onto lesson indices: 0→full, 1(mixed)→short-but-skipped, 2→short.
  const lessonCoverage = (i) => (i === 0 ? cov[0] : i === 1 ? cov[2] : cov[1]);
  const countedLessons = (d) => d.lessons;
  const fn = new Function('APP', 'lessonCoverage', 'countedLessons',
    ext(html, '_firstCoverageShortLessonIdx') + '\nreturn _firstCoverageShortLessonIdx;')(
    APP, lessonCoverage, countedLessons);
  assert.strictEqual(fn(), 2, 'returns the first coverage-short NON-mixed lesson (mixed skipped)');
  const fnFull = new Function('APP', 'lessonCoverage', 'countedLessons',
    ext(html, '_firstCoverageShortLessonIdx') + '\nreturn _firstCoverageShortLessonIdx;')(
    APP, () => ({ solved: 4, total: 4 }), countedLessons);
  assert.strictEqual(fnFull(), -1, 'all lessons at full coverage → -1 (no replay offered)');
}
console.log('  v69.2: drill card exits to its chapter; coverage-replay fallback below the mark: OK');

// ── 5d. Static parity: the pass mark is BAKED into the static build (v69.2) ───────────────────
// User-reported live/static divergence: the threshold lives in the store's settings and is served
// live via /api/info; the static init hardcoded APP.info without it, so _coverageTarget() fell
// back to 1 and a below-mark classic chapter offered neither "keep going" nor the drill in static.
{
  const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
  assert.ok(/lessonsData\.settings\.coverageThreshold/.test(builder),
    'build-static derives the pass mark from the store settings');
  assert.ok(/coverageThreshold: \$\{COVERAGE_THRESHOLD\}/.test(builder),
    'the static APP.info carries the baked threshold (like the version)');
  const docs = path.join(ROOT, 'docs', 'index.html');
  if (fs.existsSync(docs)) {
    assert.ok(/coverageThreshold: [\d.]+/.test(fs.readFileSync(docs, 'utf8')),
      'the BUILT static artifact actually contains a numeric threshold');
  }
}
console.log('  static parity: pass mark baked into APP.info: OK');


// ── 6. Server: settings persistence + endpoint + /api/info ────────────────────
{
  assert.ok(/settings: data\.settings \|\| \{\}/.test(server), 'loadStore reads settings back (survives restart)');
  assert.ok(/\.\.\.\(s\.settings \? \{ settings: s\.settings \} : \{\}\)/.test(server), 'saveStore persists settings');
  const gs = ext(server, 'getSettings');
  // v69_i (user request: "default 80%"): the server default moved from 1 ("solve everything") to
  // 0.8. This is a deliberate behaviour change — an install that never set a pass mark now gates at
  // 80% — and it matches the client fallback, so the two cannot disagree about what "unset" means.
  assert.ok(/typeof s\.coverageThreshold === 'number'\) \? s\.coverageThreshold : 0\.8/.test(gs),
    'server default pass mark is 80%');
  assert.ok(/coverageThreshold === 'number' \? APP\.info\.coverageThreshold : 0\.8/.test(html),
    'and the client falls back to the same 80%');
  assert.ok(/coverageThreshold: getSettings\(\)\.coverageThreshold/.test(server), '/api/info exposes the threshold');
  const route = server.slice(server.indexOf("url.pathname === '/api/coverage-threshold'"),
                             server.indexOf("url.pathname === '/api/coverage-threshold'") + 700);
  assert.ok(/setCoverageThreshold\(body\.value\)\.coverageThreshold/.test(route), 'POST sets + returns the numeric value');
  assert.ok(/value must be a number/.test(route), 'POST validates the value');
  // Client wiring.
  // v65.1: the pass mark moved OFF the model menu — it is a pedagogical setting about learners, not
  // a model setting — onto the storyline page, shown in teacher mode.
  assert.ok(/id="sl-threshold"[^>]*onchange="switchThreshold\(this\.value\)"/.test(html),
    'the threshold field lives on the storyline screen');
  assert.ok(!/id="bmodel-threshold"/.test(html), 'the threshold field is gone from the model menu');
  const rt = ext(html, "_refreshSlThreshold");
  assert.ok(/APP\._teacherMode/.test(rt), 'the threshold row shows only in teacher mode');
  const st = ext(html, 'switchThreshold');
  assert.ok(/\/api\/coverage-threshold/.test(st) && /value:pct\/100/.test(st), 'switchThreshold posts value as a fraction');
  assert.ok(/APP\.info\.coverageThreshold =/.test(st), 'switchThreshold updates the live info so the gate applies immediately');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['models.threshold', 'models.threshold_hint', 'models.threshold_set', 'complete.keep_going', 'complete.below_threshold'])
    assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  server: settings persistence + endpoint + info + client wiring: OK');

console.log('unit-coverage-threshold: ALL PASSED');
