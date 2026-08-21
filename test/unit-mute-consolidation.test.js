// unit-mute-consolidation.test.js — PLAN §C4 "keep going" (global mute-pill consolidation).
//
// Replaces every scattered `.mute-btn` (dead #tts-footer-landing, the library header, the
// lesson-set/storyline-screen footers, the question-nav row, the sound-test row) with ONE
// always-reachable pill in `#corner-pills`, next to Settings/Sign-in. `updateMuteButtons()` was
// already generic (`document.querySelectorAll('.mute-btn')`) — only the BUTTON was scattered, so
// no change was needed there.
//
// Measuring the scatter surfaced a real, previously-unknown bug, fixed here as a drive-by: the
// question-nav row's `#qback` ("← previous question") button ALSO carried `class="mute-btn"` —
// copied along with its inline styles when it was created, purely coincidental (`.mute-btn` has
// no CSS rule; it exists only as this updater's query-selector target). Because
// `updateMuteButtons()` rewrites `textContent`/`title` on EVERY match, clicking mute anywhere
// while a question with `cur>0` was open silently turned qback's "←" into a second 🔇/🔊 icon
// with the wrong tooltip — `onclick` stayed `qPrev()`, so the click itself still worked, only the
// label lied. Reproduced with a standalone harness script before fixing; check #4 below is that
// repro turned into a permanent guard.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { loadClient } = require('./lib-dom');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function divBlock(src, openTagRe) {
  const m = openTagRe.exec(src);
  assert.ok(m, 'opening tag found: ' + openTagRe);
  let depth = 1;
  const tagRe = /<div\b|<\/div>/g;
  tagRe.lastIndex = m.index + m[0].length;
  let t;
  while ((t = tagRe.exec(src))) {
    if (t[0] === '<div') depth++;
    else depth--;
    if (depth === 0) return src.slice(m.index, t.index + t[0].length);
  }
  throw new Error('unbalanced <div> from ' + openTagRe);
}

// ── 1. Exactly ONE real .mute-btn element in the whole file ───────────────────────────────────
// (the inverse of §C5's deliberate duplication: this feature's whole point is to go from ~6
// scattered instances down to one.)
const muteBtnCount = (html.match(/<button[^>]*class="(?:story-icon-btn )?mute-btn"/g) || []).length;
assert.strictEqual(muteBtnCount, 1,
  `exactly one .mute-btn should remain (the global pill), found ${muteBtnCount}`);
console.log('  exactly one .mute-btn remains in index.html: OK');

// ── 2. It lives inside #corner-pills, alongside Settings and Sign-in ──────────────────────────
const cornerPills = divBlock(html, /<div id="corner-pills"/);
assert.ok(/<button[^>]*class="mute-btn"/.test(cornerPills), '#corner-pills contains the global mute pill');
assert.ok(cornerPills.includes('id="settings-pill"') && cornerPills.includes('id="acct-badge"'),
  '#corner-pills still holds Settings and the login pill too');
console.log('  the global mute pill lives in #corner-pills next to Settings/Sign-in: OK');

// Mutation check: the containment assertion must be able to fail.
{
  const withoutMute = cornerPills.replace(/<button id="mute-pill"[\s\S]*?<\/button>/, '');
  assert.notStrictEqual(withoutMute, cornerPills,
    'the mutation must actually remove the mute pill — if this fires, the regex no longer ' +
    'matches the real markup and check #2 is vacuous');
  assert.ok(!/<button[^>]*class="mute-btn"/.test(withoutMute), 'sanity: mutated slice lacks the pill');
}
console.log('  mutation check: removing the pill from the slice makes containment fail: OK');

// ── 3. updateMuteButtons() is still the generic, class-based updater ──────────────────────────
// No special-casing needed — confirms the consolidation is purely a markup change.
assert.ok(/document\.querySelectorAll\('\.mute-btn'\)\.forEach/.test(html),
  'updateMuteButtons() still drives every .mute-btn generically');
console.log('  updateMuteButtons() unchanged (still generic): OK');

// ── 4. THE BUG, fixed: #qback must NOT carry class="mute-btn" ─────────────────────────────────
{
  const at = html.indexOf('id="qback"');
  assert.ok(at > -1, 'qback button found');
  const tagStart = html.lastIndexOf('<button', at);
  const tagEnd = html.indexOf('>', at);
  const qbackTag = html.slice(tagStart, tagEnd + 1);
  assert.ok(!/class="[^"]*mute-btn/.test(qbackTag),
    `THE REGRESSION: qback must not carry class="mute-btn" — updateMuteButtons() rewrites the ` +
    `text/title of every element matching that class, which would silently turn qback's "←" into ` +
    `a 🔇/🔊 icon on the next mute toggle. Tag: ${qbackTag}`);
}
console.log('  qback no longer carries class="mute-btn": OK');

// ── 5. Functional repro of the fixed bug, in a live DOM ───────────────────────────────────────
// Recreates the exact harness repro used to find the bug, now asserting the FIX: toggling mute
// must not touch a "←"-style button that happens to sit near a real mute-btn.
{
  const C = loadClient({ quiet: true });
  // The harness (per INTERNALS' documented limits) never parses STATIC markup outside <script>
  // into its fake DOM — only JS-driven innerHTML writes become real nodes. So the real
  // #corner-pills mute pill is built here explicitly, matching index.html's actual id/class,
  // alongside a qback stand-in — reproducing exactly the scenario the bug depended on: two
  // buttons in the live document, only one of which should react to a mute toggle.
  C.run(`
    document.getElementById('ex-area').innerHTML = '<div class="btn-row">' +
      '<button id="qback" title="Previous">←</button>' +
      '<button class="check-btn" id="cbtn">Check</button>' +
    '</div>';
    document.getElementById('corner-pills').innerHTML =
      '<button id="mute-pill" class="mute-btn" title="Mute">🔊</button>';
    true;
  `, 'setup');
  C.run('APP.muted = true; updateMuteButtons(); true;', 'toggle');
  const qbackText = C.run("document.getElementById('qback').textContent");
  const qbackTitle = C.run("document.getElementById('qback').title");
  assert.strictEqual(qbackText, '←', 'qback text must survive a mute toggle unchanged');
  assert.strictEqual(qbackTitle, 'Previous', 'qback title must survive a mute toggle unchanged');
  // And the REAL mute pill IS the one that actually gets updated.
  const pillText = C.run("document.getElementById('mute-pill').textContent");
  assert.strictEqual(pillText, '🔇', 'the global mute pill DOES reflect the muted state');
  console.log('  live repro of the fixed bug: qback untouched, the real pill updates: OK');
}

console.log('unit-mute-consolidation: ALL PASSED');
