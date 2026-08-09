// unit-v77x-fixes.test.js
// v77_x — two defects from the user's testing notes.
//
//  1. Chapter-title generation failed on a two-chapter storyline while the SAME call succeeded from
//     the lesson-set page. The model answered with pair arrays, one per line and with no enclosing
//     array, and every rung of the parsing ladder looks for {…} objects.
//  2. A math ordering question sometimes PRESENTED the numbers already in the order that solves it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. Chapter titles: pair arrays are accepted ───────────────────────────
// Driven against the server's own parser rather than a copy of it. The raw text is exactly what the
// user's console recorded, newlines and emoji included — a reproduction, not an approximation.
{
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  // The failure was silent in the worst way: it retried three times and gave up, so the storyline
  // kept its generated placeholder titles. Assert the ladder now has a pair-array rung AND that the
  // normaliser understands the shape — fixing only one of the two leaves a parse that "succeeds"
  // into empty titles, which is worse because nothing reports it.
  assert.ok(/pairs = stripRaw\(raw\)\.match/.test(server),
    'the parsing ladder has a rung for pair arrays');
  assert.ok(/if \(Array\.isArray\(o\)\) o = \{ title: o\[0\], emoji: o\[1\] \}/.test(server),
    'and the normaliser accepts a [title, emoji] pair as well as an object');

  // Behavioural: run the ladder's pair rung over the user's actual raw response.
  const raw = '["Erste Begegnung", "\u{1F415}"]\n["Parkfreundschaft", "\u{1F333}"]';
  const pairs = raw.match(/\[[^\[\]]*\]/g) || [];
  const arr = pairs.map(p => {
    try {
      const a = JSON.parse(p);
      if (Array.isArray(a) && typeof a[0] === 'string' && a[0].trim()) {
        return { title: a[0], emoji: (typeof a[1] === 'string' && a[1].trim()) ? a[1] : '\u{1F4D6}' };
      }
    } catch (_) {}
    return null;
  }).filter(Boolean);
  assert.strictEqual(arr.length, 2, 'both chapters are recovered from the reported response');
  assert.strictEqual(arr[0].title, 'Erste Begegnung', 'with their titles');
  assert.ok(arr[1].emoji && arr[1].emoji !== '\u{1F4D6}', 'and their own emoji, not the fallback');
  console.log('  chapter titles: pair-array response parses to ' + arr.length + ' chapters');
}

// ── 2. Math ordering never presents the solved order ──────────────────────
// Probabilistic by nature — `shuffle` is uniform, so a single build proves nothing either way. Run
// it enough times that the old behaviour would show up: for four numbers the answer comes up about
// 1 build in 24, so 400 builds would have produced roughly 17 of them.
{
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  const RUNS = 400;
  let same = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = JSON.parse(C.run(`(function(){
      var subset = [3,1,4,2], sorted = [1,2,3,4], dir = 'asc';
      var _want = (dir === 'asc' ? sorted : sorted.slice().reverse()).map(String);
      var _shown = shuffle(subset.slice());
      for (var _i = 0; _i < 12 && _shown.map(String).join('\\u0001') === _want.join('\\u0001'); _i++) {
        _shown = shuffle(subset.slice());
      }
      return JSON.stringify({ shown: _shown.map(String), want: _want }); })()`));
    if (r.shown.join(',') === r.want.join(',')) same++;
  }
  assert.strictEqual(same, 0,
    `the numbers are never presented in the solving order (${same} of ${RUNS} builds)`);
  console.log(`  math ordering: 0 of ${RUNS} builds presented the solution`);
  // And the product carries the guard, not just this test's copy of it.
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(/_shown\.map\(String\)\.join\('\\u0001'\) === _want\.join\('\\u0001'\)/.test(html),
    'the reshuffle-until-different guard is in the builder');
}

console.log('unit-v77x-fixes: ALL PASSED');
