// unit-story-border-color.test.js
// v83_g (user) — "the currently green colored frame around the story field on the progress card
// could also change from red to green, based on how far away the user is from the pass mark to get
// to understanding questions."
//
// RULED (user, when asked which of the two on-screen "pass marks" this meant): the comprehension
// ("understanding") lessons' own progress — the v71_s 100%-required story-gated-lesson coverage
// `showComplete`'s own `_postRows` already measures per lesson — NOT the chapter's general
// coverage-threshold pass mark (the one drawn on the topic %-solved bar).
//
// Contract under test:
//   1. `_sumCoverageFrac(rows)` — SUMS solved/total across every row (not an average of per-row
//      fractions — the two coincide on symmetric fixtures, so this is checked on an asymmetric one).
//      Empty input → 1 (no comprehension lessons in this chapter → nothing to be far FROM → green,
//      matching the panel's own pre-existing default colour).
//   2. `_redGreenHex(frac)` — linear interpolation between --red/--green's ACTUAL hex values
//      (#ff4b4b / #58cc02), clamped to [0,1].
//   3. `showComplete()` applies the colour to `#comp-story-panel.style.borderColor`, computed from
//      `_postRows` AFTER it is populated (or left empty, for a drill or a chapter with no
//      comprehension lessons), regardless of which branch (drill vs normal) set it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. _sumCoverageFrac: SUMS across rows, does not average per-row fractions ─
{
  const C = loadClient({ quiet: true });
  const frac = (rows) => C.run(`_sumCoverageFrac(${JSON.stringify(rows)})`);
  assert.strictEqual(frac([]), 1, 'no story-gated lessons in this chapter → fraction 1 (green)');
  assert.strictEqual(frac([{ solved: 0, total: 0 }]), 1, 'a zero-total row alone still degrades to 1, not NaN/0');
  // Asymmetric fixture: sum(1,0)/sum(1,9) = 1/10 = 0.1; the WRONG (averaged) answer would be
  // (1/1 + 0/9)/2 = 0.5 — picked deliberately so the two implementations disagree.
  assert.strictEqual(frac([{ solved: 1, total: 1 }, { solved: 0, total: 9 }]), 0.1,
    'rows are SUMMED (a large near-empty lesson pulls the fraction down), not averaged per-lesson');
  assert.strictEqual(frac([{ solved: 3, total: 4 }]), 0.75, 'a single partial row');
  assert.strictEqual(frac([{ solved: 2, total: 4 }, { solved: 4, total: 4 }]), 0.75, '(2+4)/(4+4) — a fully-solved row still pulls a partial one toward it, not past 1');
}
console.log('  _sumCoverageFrac: sums across rows (not per-row average), degrades to 1 when empty/zero-total: OK');

// ── 2. _redGreenHex: interpolates --red/--green's ACTUAL hex values, clamped ─
{
  const C = loadClient({ quiet: true });
  const hex = (f) => C.run(`_redGreenHex(${JSON.stringify(f)})`);
  assert.ok(/--red:#ff4b4b/.test(html) && /--green:#58cc02/.test(html),
    'the reference colours really are #ff4b4b / #58cc02 in the stylesheet — the interpolation matches THOSE, not a guess');
  assert.strictEqual(hex(0), '#ff4b4b', 'fraction 0 = pure red, exactly --red');
  assert.strictEqual(hex(1), '#58cc02', 'fraction 1 = pure green, exactly --green');
  assert.strictEqual(hex(0.5), '#ac8c27', 'the midpoint is the actual linear blend, computed independently and checked exactly');
  assert.strictEqual(hex(-1), hex(0), 'a negative fraction clamps to red, does not extrapolate past it');
  assert.strictEqual(hex(2), hex(1), 'a fraction over 1 clamps to green, does not extrapolate past it');
  assert.strictEqual(hex(NaN), hex(0), 'NaN degrades to red rather than propagating "#NaNNaNNaN"-style garbage');
}
console.log('  _redGreenHex: exact red/green endpoints, a checked midpoint, clamped both directions: OK');

// ── 3. showComplete() wires the colour from _postRows, unconditionally ───────
{
  const sc = extFn(html, 'showComplete');
  assert.ok(/let _postRows = \[\];/.test(sc),
    '_postRows is declared OUTSIDE the drill/non-drill branch, so BOTH feed the same variable');
  const declAt = sc.indexOf('let _postRows = [];');
  const ifProgAt = sc.indexOf('if (_progEl) {');
  assert.ok(declAt >= 0 && declAt < ifProgAt, '_postRows is declared before the drill/non-drill branch that may populate it');
  assert.ok(/_spEl\.style\.borderColor = _redGreenHex\(_sumCoverageFrac\(_postRows\)\);/.test(sc),
    'the border colour is computed from _postRows — the SAME array the post-unlock bars use, not a second measure');
  // Applied AFTER the whole if(_progEl){...} block (both branches), not inside just one of them —
  // otherwise a drill (which never touches _postRows) would leave a stale colour from a prior card.
  const blockEnd = sc.indexOf("el('comp-story-panel')", ifProgAt);
  assert.ok(blockEnd > ifProgAt, 'the border-colour block reads comp-story-panel AFTER the progress-bars block, not inside it');
}
console.log('  showComplete(): border colour is computed from _postRows, outside the drill/non-drill branch: OK');

// ── 4. Behavioural: a real chapter, 0/2, 1/2, 2/2 solved, no-comprehension, and a drill ─
// Reuses unit-card-0d.test.js's own TOPIC shape (a chapter with prep lessons AND a 2-question
// comprehension lesson) — the fixture already proven to drive _postRows correctly.
{
  const TOPIC = {
    topic: 'T', id: 'tp_x', lang: 'it', srcLang: 'de', story: 'Una storia lunga abbastanza per contare.',
    lessons: [
      { id: 'l0', type: 'standard', vocab: [{ target: 'casa', source: 'Haus' }, { target: 'cane', source: 'Hund' }] },
      { id: 'l1', type: 'standard', vocab: [{ target: 'gatto', source: 'Katze' }] },
      { id: 'l2', type: 'comprehension', title: 'Verständnis', questions: [
        { q: 'a?', choices: ['x', 'y'], correctIndex: 0 }, { q: 'b?', choices: ['x', 'y'], correctIndex: 1 } ] },
    ],
  };
  const render = (solved, opts) => {
    const o = opts || {};
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(o.topic || TOPIC)};
      APP.lang = 'it'; APP.srcLang = 'de';
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed: {}, solved: { T: ${JSON.stringify(solved || {})} } };
      APP._teacherMode = false;
      APP.cur = { lessonIdx: ${o.lessonIdx == null ? 0 : o.lessonIdx}, exercises: [], cur: 0,
                  correct: 3, total: 4, mistakes: 1, hearts: 3, streak: 2, bestStreak: 2${o.drill ? ", _drill: true" : ""} };
      ${o.drill ? "APP.lessonData.lessons[APP.cur.lessonIdx]._drill = true;" : ""}
      showComplete(); true;`, 'render');
    return C.document.getElementById('comp-story-panel').style.borderColor;
  };
  // Discover the real item keys for the comprehension lesson (index 2) — do not guess the qid
  // scheme, read it the same way lessonCoverage() itself does.
  const C0 = loadClient({ quiet: true });
  C0.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.lessonData = ${JSON.stringify(TOPIC)}; APP.lang='it'; APP.srcLang='de';
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} }; true;`, 'seed');
  const keys = C0.run(`[..._lessonItemUniverse(2)]`);
  assert.strictEqual(keys.length, 2, `the comprehension lesson has exactly 2 items (got ${keys.length})`);

  assert.strictEqual(render({}), '#ff4b4b', '0/2 solved → pure red');
  assert.strictEqual(render({ [keys[0]]: 1 }), '#ac8c27', '1/2 solved → the exact midpoint hex, not just "not red/not green"');
  assert.strictEqual(render({ [keys[0]]: 1, [keys[1]]: 1 }), '#58cc02', '2/2 solved → pure green');

  // No comprehension lesson at all → no gate → green, same default as before this feature existed.
  const noComp = { ...TOPIC, lessons: TOPIC.lessons.slice(0, 2) };
  assert.strictEqual(render({}, { topic: noComp }), '#58cc02',
    'a chapter with no story-gated lesson has nothing to be far FROM — green, not an undefined/blank colour');

  // A drill: _postRows is never populated (the drill branch returns before that code runs) — must
  // still resolve to green, not carry over a stale colour from whatever the panel showed before.
  assert.strictEqual(render({}, { drill: true }), '#58cc02', 'a drill card (no _postRows at all) also reads green, not stale/blank');
}
console.log('  showComplete(): 0/2 red, 1/2 exact midpoint, 2/2 green, no-comprehension green, drill green: OK');

console.log('unit-story-border-color: ALL PASSED');
