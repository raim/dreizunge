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
  // v77_l: this slice used to end at `comp-story-panel`, which silently assumed the story panel was
  // the LAST row of the card. §0d moved the story above the bars and the slice stopped containing
  // half the card — the assertions below then passed or failed on where the boundary happened to
  // land rather than on what the card contains. The boundary is now the next screen, so the slice
  // is the whole completion card whatever order its rows are in.
  const _cs = html.indexOf('id="complete-screen"');
  const _next = html.indexOf('class="screen', html.indexOf('>', _cs));
  const screen = html.slice(_cs, _next > 0 ? _next : undefined);
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
  // v71_m: the row now also carries the PASS MARK (a line drawn on the bar), so the call gained
  // two arguments. Still the same bar in the same place — asserted on the pieces that matter
  // rather than on the exact argument list, which is what made this brittle.
  // v74_g — WAS A SOURCE PIN, and it guarded a defect, exactly as the v73_d block below warns.
  // It asserted the literal `const cov = topicCoverage();` under the message "a %-solved bar is
  // appended". The message was true and the pin was the bug: `topicCoverage()` is the WHOLE chapter
  // while the story gate reads `topicCoverage(true)` (prep only), so this bar carried a pass mark
  // measured against a different universe from the one the mark gates. On the shipped corpus that
  // made "below the mark, in red, with the story already unlocked" reachable — `Churros und Chaos`
  // at 64..66 of 83, `Kälte und Paella` at 23..24 of 31.
  //
  // Asserted behaviourally now: the bar's denominator must equal the STORY-UNLOCK universe.
  assert.ok(/rowsHtml\(t\('complete\.solved'\), cov\.solved, cov\.total/.test(prog),
    'a %-solved bar (correct-answer coverage) is appended below the chapter bars');
  {
    const { loadClient } = require('./lib-dom');
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
    const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
    const UIj = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
    // The two universes only differ on a chapter that HAS a story-gated lesson, so the fixture must
    // be one — otherwise the assertion passes for the wrong reason (v71_r).
    const topic = (store.topics || []).find(t => (t.lessons || []).some(l => l && l.type === 'comprehension')
                                             && (t.lessons || []).length >= 3);
    assert.ok(topic, 'the corpus has a chapter with a story-gated lesson to exercise');
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UIj.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
      APP.cur = { lessonIdx:0, exercises:[], cur:0 }; true;`, 'setup');
    const whole = C.run(`topicCoverage().total`, 'w');
    const gate  = C.run(`topicCoverage(true).total`, 'g');
    assert.ok(gate < whole,
      `the fixture's two universes really do differ (${gate} vs ${whole}), or this proves nothing`);
    C.run(`APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:3, total:4, mistakes:1,
                       hearts:3, streak:2, bestStreak:2 }; showComplete(); true;`, 'render');
    const bars = (C.document.getElementById('comp-progress').innerHTML || '')
      .match(/<span>(\d+)\/(\d+)<\/span>/g) || [];
    const denoms = bars.map(b => Number(b.replace(/[^\d/]/g, '').split('/')[1]));
    assert.ok(denoms.includes(gate),
      `the %-solved bar is measured over the story-unlock universe (${gate}), which is what its mark gates`);
    assert.ok(!denoms.includes(whole),
      `and NOT over the whole chapter (${whole}) — that mismatch is what put a red bar under an unlocked story`);
  }
  assert.ok(/const _mark = \(opts && Number\.isFinite\(opts\.markPct\)\)/.test(prog),
    'and the pass mark is applied to THAT bar — %-solved is what the threshold measures');
  const scAll = ext(html, 'showComplete');
  assert.ok(!/complete\.below_threshold/.test(scAll),
    'the below-threshold sentence is gone from the card — the bar says it now');

  // v73_d — WAS TWO SOURCE PINS, and one of them guarded the bug.
  //
  // This block used to assert the literal line
  //   `const _showMark = … && _threshPct > 0 && _threshPct < 100;`
  // under the message "the mark is shown whenever one applies". Those disagree: `< 100` is exactly
  // what hid the mark when a story-gated lesson raised the requirement to 100%, and rowsHtml then
  // painted the bar green because its fill colour was tied to whether a mark existed. A learner
  // reported a green %-solved bar above a locked Next. The guard could not have caught it — it was
  // pinning the defect's own spelling.
  //
  // Driven through the real card instead, and readable at all only because lib-dom parses
  // innerHTML as of v73_c.
  {
    const { loadClient } = require('./lib-dom');
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
    const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
    const UIj = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
    // A chapter with a story-gated lesson is the scenario under test; assert one was found, or this
    // section silently becomes a no-op on a new corpus (the v71_r "guard a guard" rule).
    const topic = (store.topics || []).find(t => (t.lessons || []).some(l => l && l.type === 'comprehension')
                                             && (t.lessons || []).length >= 3);
    assert.ok(topic, 'the corpus has a chapter with a story-gated lesson to exercise');
    const compIdx = topic.lessons.findIndex(l => l && l.type === 'comprehension');

    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UIj.en)}; true;`, 'seed-static');
    C.run(`
      APP.savedList = ${JSON.stringify((store.topics || []).map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang, lessons: t.lessons })))};
      APP.storylines = ${JSON.stringify(store.storylines || [])};
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, version:'smoke', coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} };
      APP._teacherMode = false;
      APP.cur = { lessonIdx:${compIdx}, exercises:[], cur:0, correct:3, total:4,
                  mistakes:1, hearts:3, streak:2, bestStreak:2 };
      showComplete(); true;`, 'render-card');

    // Read the bars back as structure, not as markup.
    const rows = C.document.getElementById('comp-progress').querySelectorAll('div')
      .filter(d => d.style.margin === '6px 0')
      .map(d => {
        const spans = d.querySelectorAll('span');
        const track = d.querySelectorAll('div').find(x => x.style.position === 'relative');
        const kids  = track ? track.querySelectorAll('div') : [];
        const markEl = kids.find(k => k.style.position === 'absolute');
        return {
          label: spans[0] ? spans[0].textContent.trim() : '',
          count: spans[1] ? spans[1].textContent.trim() : '',
          fill:  kids[0] ? kids[0].style.background : '',
          mark:  markEl ? (markEl.getAttribute('title') || '') : null,
          markAtRightEdge: !!(markEl && markEl.style.right === '0'),
        };
      });
    assert.ok(rows.length >= 3, `the card renders the bars (got ${rows.length})`);

    // v73_f (user-reported): the chapter row said "This chapter" / "Dieses Kapitel". It now names
    // the chapter, which is what a learner arriving from a storyline needs to know.
    const genericLabel = UIj.en['complete.chapter_progress'];
    assert.ok(!rows.some(r => r.label === genericLabel),
      `no row is labelled with the generic "${genericLabel}" — the chapter names itself`);
    assert.ok(rows.some(r => r.label === topic.topic
                          || (topic.topic.length > 34 && r.label === topic.topic.slice(0, 33) + '…')),
      'the chapter row carries the chapter name');

    const solvedRow = rows.find(r => r.label === UIj.en['complete.solved']);
    assert.ok(solvedRow, 'the %-solved row is rendered');
    // Ask the CLIENT what this chapter's mark is rather than hardcoding one: the corpus is not a
    // constant and per-topic targets exist (the first pick here carries 50%, not the global 80%).
    const chapterPct = Math.round(Number(C.run(`_coverageTarget()`, 'target')) * 100);
    assert.ok(chapterPct > 0 && chapterPct < 100,
      `the fixture chapter has a partial pass mark to distinguish from 100% (got ${chapterPct}%)`);
    // THE REGRESSION: the story gate must not stamp its 100% onto the TOPIC bar. That would tell
    // the learner they need 100% of the chapter, which is not the rule.
    assert.strictEqual(solvedRow.mark, `${chapterPct}%`,
      'the topic bar carries the CHAPTER pass mark, not the gated lesson\'s 100%');
    // …and a mark being in force must colour the bar. Green-while-locked was the reported symptom.
    assert.strictEqual(solvedRow.fill, 'var(--red)',
      'below its mark the bar is red — fill follows the mark, not merely whether one was passed');

    // The blocker gets its own row at its own mark, so the card explains why Next is locked.
    const gateRow = rows.find(r => r.mark === '100%');
    assert.ok(gateRow, 'the story-gated lesson gets its own row showing its 100% requirement');
    // v76_d: this compared against the RAW title and broke when the corpus moved to a 42-char one.
    // The card truncates a long row label (index.html ~15413, >40 → slice(0,39)+'…'), exactly as
    // the chapter row above truncates at 34 — so accept either form, the same way that assertion
    // does. The claim is "the row is labelled with the lesson's own title", not "the label is
    // never shortened".
    const _gateTitle = (topic.lessons[compIdx].title || '').trim();
    assert.ok(_gateTitle, 'the story-gated lesson has a title to be labelled with (non-vacuity)');
    assert.ok(gateRow.label === _gateTitle
           || (_gateTitle.length > 40 && gateRow.label === _gateTitle.slice(0, 39) + '…'),
      'labelled with the lesson the learner just played (its own title — no new UI string); '
      + `got "${gateRow.label}" for "${_gateTitle}"`);
    assert.ok(gateRow.markAtRightEdge,
      'a 100% mark is drawn INSIDE the track — at left:100% it rendered off the end, so the '
      + 'strictest requirement was the one that could not be seen');
    console.log(`  card bars: topic mark ${solvedRow.mark} (${solvedRow.fill}), gate row "${gateRow.label}" at ${gateRow.mark}`);
  }
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['complete.solved'], 'ui.json en has complete.solved');
  // Reuses the existing story/chapter labels (per the request).
  assert.ok(ui.en['complete.story_progress'] && ui.en['complete.chapter_progress'], 'story/chapter labels reused');
}
console.log('  %-solved bar present + reuses story/chapter labels: OK');

// ── 2b. v74_g — counter (b): the chapter bar counts LESSONS, on both chapter shapes ──────────
// The card carries two bars. Before v74_g the first one changed UNITS depending on the chapter:
// lessons on a classic chapter, questions on a mixed-driven one. So one chapter read `2/2` and the
// next `67/83` on visually identical bars — and on a mixed chapter the first bar printed exactly
// the same fraction as the second, carrying no information at all.
{
  const { loadClient } = require('./lib-dom');
  const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
  const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
  const UIj = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  const render = (topic) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UIj.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
      APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:3, total:4, mistakes:1,
                  hearts:3, streak:2, bestStreak:2 };
      showComplete(); true;`, 'render');
    const rows = [...(C.document.getElementById('comp-progress').innerHTML || '')
      .matchAll(/<span>([^<]*)<\/span><span>(\d+)\/(\d+)<\/span>/g)]
      .map(m => ({ label: m[1], done: +m[2], total: +m[3] }));
    return { C, rows };
  };
  const classic = (store.topics || []).find(t => (t.lessons || []).length >= 4
    && !(t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden));
  const mixed = (store.topics || []).find(t => (t.lessons || []).some(l => l && l.type === 'mixed' && !l._hidden)
    && (t.lessons || []).length >= 4);
  assert.ok(classic && mixed, 'the corpus has both a classic and a mixed-driven chapter to compare');

  for (const [t, shape] of [[classic, 'classic'], [mixed, 'mixed-driven']]) {
    const { C, rows } = render(t);
    assert.ok(rows.length >= 2, `${shape}: the card draws a chapter bar and a %-solved bar`);
    // v78_n: identify the %-solved bar by its LABEL, not by position. It was `rows[rows.length-1]`,
    // which held only while nothing was appended after it — and `v73_d`'s gate row already could
    // be, so this passed on the chosen chapters rather than on the rule. `v78_n` adds a row per
    // post-unlock lesson, which made the positional read pick a comprehension bar and call it the
    // %-solved one (standing rule 18: pin the claim, not the layout).
    const chapterBar = rows[0];
    const solvedLbl = UIj.en['complete.solved'];
    const solvedBar = rows.find(r => r.label === solvedLbl);
    assert.ok(solvedBar, `${shape}: the card draws a row labelled "${solvedLbl}" ` +
      `(got ${JSON.stringify(rows.map(r => r.label))})`);
    const under = C.run(`underlyingLessons(APP.lessonData).length`, 'u');
    assert.strictEqual(chapterBar.total, under,
      `${shape}: the chapter bar is denominated in LESSONS (${under}), whatever the chapter's shape`);
    assert.strictEqual(solvedBar.total, C.run(`topicCoverage(true).total`, 's'),
      `${shape}: the %-solved bar is denominated in the story-unlock universe`);
    assert.notStrictEqual(chapterBar.total, solvedBar.total,
      `${shape}: the two bars measure different things — one printing the other's number is the v73 duplicate-bar bug`);
  }

  // A mixed chapter's folded prep lessons must APPEAR — hiding them behind a single `mixed` entry
  // is what made this row read 2/2 on a six-lesson chapter.
  const { C: Cm } = render(mixed);
  const visible = (mixed.lessons || []).filter(L => L && !L._hidden && L.type !== 'mixed').length;
  assert.strictEqual(Cm.run(`underlyingLessons(APP.lessonData).length`, 'v'), visible,
    'the mixed lesson itself is not a lesson — the prep lessons it pools are what the learner studies');

  // And an unplayed error hunt is VISIBLE in that bar, so a chapter that will not complete never
  // shows every bar full with nothing left to point at.
  const ehTopic = (store.topics || []).find(t =>
    (t.lessons || []).some(l => l && (l.type === 'error_hunt' || l.type === 'ai_error_hunt') && !l._hidden));
  assert.ok(ehTopic, 'the corpus has a chapter with a visible error hunt');
  const { C: Ce, rows: ehRows } = render(ehTopic);
  const ehCounted = Ce.run(`underlyingLessons(APP.lessonData)
    .filter(function(L){ return L.type === 'error_hunt' || L.type === 'ai_error_hunt'; }).length`, 'e');
  assert.ok(ehCounted > 0, 'and the error hunt is one of the underlying lessons');
  assert.ok(ehRows[0].done < ehRows[0].total,
    'so with the hunt unplayed the chapter bar is short of full — the learner can see what is left');
  console.log('  chapter bar: lessons on both shapes, folded prep shown, unplayed hunt visible: OK');
}

// ── 3. setComplete threshold gate (behavioral, classic set) ───────────────────
{
  const APP = { _teacherMode: false, info: { coverageThreshold: 0.8 },
    progress: { completed: { Ch: { a: {}, b: {} } } },
    lessonData: { topic: 'Ch', lessons: [{ id: 'a' }, { id: 'b' }] } };
  const countedLessons = d => (d.lessons || []);
  let cov = { solved: 5, total: 10 };
  const topicCoverage = () => cov;
  const _coverageTarget = new Function('APP', ext(html, '_coverageTarget') + '\nreturn _coverageTarget;')(APP);
  // v69_l: setComplete is now a thin wrapper that records its verdict for the active topic (so the
  // storyline screen can read a coverage-aware answer for OTHER chapters without recomputing).
  // The rule itself lives in _setCompleteRaw, so the harness needs both; the recorder is
  // typeof-guarded away.
  const setComplete = new Function('APP', 'countedLessons', 'topicCoverage', '_coverageTarget',
    ext(html, '_setCompleteRaw') + '\n' + ext(html, 'setComplete') + '\nreturn setComplete;')(
    APP, countedLessons, topicCoverage, _coverageTarget);

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
  // v73_d: was pinned to the whole declaration line, which broke when the gate gained
  // `_topicMarkPct` / `_markApplies` / `_lessonGate` — an edit that did not touch what this claim
  // is about. Kept only as an existence check; that the card actually COMPUTES the state is proven
  // behaviourally in section 2 above (red bar at the chapter mark, gate row at 100%).
  assert.ok(/let _belowThreshold = false/.test(sc), 'card computes below-threshold state');
  // v70_l: no longer gated on the pass mark — offered whenever a drill round exists, which still
  // includes every below-threshold learner the v60.8 rule was written to protect.
  // v71_d: `!_nextIsDrill` dropped — Next can no longer be the drill, so it cannot double-offer.
  // v71_h: the drill button is always present, greyed when no round can be built.
  assert.ok(/_compBtnState\(_db, drillAvailable\(_l, _s\)/.test(sc),
    'the drill is offered to a below-threshold learner (greyed when no mistakes, v71_h)');
  // v71_m: the below-threshold HINT is no longer a sentence — it is the pass mark drawn on the
  // %-solved bar, plus the bar turning red until the mark is reached. The "Keep going!" title
  // still carries the verdict in words, so that half is unchanged.
  assert.ok(/complete\.keep_going/.test(sc), 'the "Keep going!" title still states the verdict');
  assert.ok(/opts\.markPct/.test(ext(html, '_compProgressHtml')), 'and the bar carries the mark');
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
  // v71_d: the guarantee is now enforced at the button itself rather than by giving Next another
  // meaning. Below the mark Next is DISABLED, so there is no branch left that could advance.
  assert.ok(/\} else if \(_belowThreshold && !lesson\._drill\) \{/.test(sc),
    'a single below-mark branch catches every case');
  // v77_o (user ruling): the branch no longer LOCKS Next; it points it at the work that raises the
  // mark. The guarantee this section exists for is unchanged and is asserted below by clicking:
  // Next below the mark must not leave the chapter.
  assert.ok(!/_nextBlocked/.test(sc) && !/compNext\.onclick = null;/.test(sc),
    'Next is never a dead arrow — it always has a destination');
  assert.ok(/_firstCoverageShortLessonIdx/.test(sc),
    'and below the mark it targets a COVERAGE-short lesson first, so a mixed round re-samples ' +
    'toward what is not yet solved rather than re-asking what is');
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
  const drillAt = sc.indexOf('if (lesson._drill) {');
  const nextAt  = sc.indexOf('nextLessonIdx >= 0 && !lesson._drill');
  const belowAt = sc.indexOf('_belowThreshold && !lesson._drill) {');
  assert.ok(drillAt > 0, 'the drill card keeps its own Next branch');
  assert.ok(nextAt > 0 && drillAt < nextAt, 'ordered before the in-chapter next-lesson branch');
  // v71_d: the drill CTA and coverage-replay Next branches are GONE — below the mark Next is locked
  // and both routes are offered as their own buttons. The v69.2c looping report cannot recur,
  // because Next no longer means "practise your mistakes" under any condition.
  assert.ok(belowAt > nextAt,
    'progress within the chapter still wins over the below-mark lock: a learner with lessons left is not blocked');
  assert.ok(!/_belowThreshold && !lesson\._drill && drillAvailable\(/.test(sc),
    'Next is never the drill any more');
  assert.ok(!/_belowThreshold && !lesson\._drill && _firstCoverageShortLessonIdx\(\) >= 0/.test(sc),
    'nor the coverage replay');
  assert.ok(/endDrill\(\);\s*const idx = _firstUnfinishedLessonIdx\(APP\.lessonData\);\s*if \(idx >= 0\) startLesson\(idx\); else showComplete\(true\);/.test(sc),
    'drill Next returns to the launching chapter: resume its questions, else its completion card');
  // The replay route still EXISTS — it moved from Next onto the repeat button, which is the whole
  // point of the change. If it ever stops being reachable the v69.2 dead end returns.
  const rf = ext(html, 'repeatForCoverage');
  assert.ok(/_firstCoverageShortLessonIdx\(\)/.test(rf) && /startLesson\(target\)/.test(rf),
    'the coverage replay is still reachable, now via the repeat button');
  assert.ok(/id="comp-repeat"[^>]*onclick="repeatForCoverage\(\)"/.test(html),
    'and that button is wired on the card');
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
  // v69_r: the OLD v65.1 global-threshold row (`#sl-threshold` + switchThreshold) has been REMOVED
  // from the storyline header. It was a second, older pass-mark control that duplicated the v69_i
  // per-storyline control (`#sl-passmark`, at the bottom of the same screen) — the user saw two
  // controls on one page. The per-storyline mark now solely governs a storyline; the GLOBAL default
  // is the hierarchy's fallback and no longer has UI on a specific storyline's page.
  assert.ok(!/id="sl-threshold"/.test(html), 'the old global-threshold header row is gone (no duplicate control)');
  assert.ok(!/id="sl-threshold-row"/.test(html), 'and its container is gone');
  assert.ok(!/id="bmodel-threshold"/.test(html), 'the threshold field is not in the model menu either');
  // The per-storyline control remains, once, at the bottom (asserted in full by e2e-pass-mark).
  assert.ok((html.match(/id="sl-passmark"/g) || []).length === 1, 'exactly one storyline pass-mark control remains');
  // The /api/coverage-threshold ENDPOINT stays — it is how the global default (the fallback of the
  // chapter→storyline→global hierarchy) is set — even though its old on-storyline UI is gone.
  assert.ok(/setCoverageThreshold/.test(server), 'the global-default endpoint is retained as the hierarchy fallback');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['models.threshold', 'models.threshold_hint', 'models.threshold_set', 'complete.keep_going', 'complete.below_threshold'])
    assert.ok(ui.en[k], `ui.json en has ${k}`);
}
console.log('  server: settings persistence + endpoint + info + client wiring: OK');

console.log('unit-coverage-threshold: ALL PASSED');
