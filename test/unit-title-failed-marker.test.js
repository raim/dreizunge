// unit-title-failed-marker.test.js — v89_y.
//
// When the chapter-title post-pass gives up after its three attempts, the chapter keeps the
// placeholder it was created with — for an uploaded chunk, the raw first 40 characters of the source
// text ("Flexvervoer Welkom op de hub Domburg, St"). Until now that was a `console.warn` and nothing
// else, so the only way to find out was to read a terminal, which is how the user found it.
//
// ⚠️ USER RULING: make the failure VISIBLE — keep the raw placeholder, mark the chapter, let the
// learner rename it. NOT "invent a better title": an invented one reads as deliberate, which makes a
// bad title HARDER to notice than an obviously-raw one.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));

// ── 1. The mark is set only where a title genuinely failed ─────────────────────────────────────
{
  const at = server.indexOf('Chapter-title post-pass failed:');
  assert.ok(at > -1, 'the failure site still exists');
  const block = server.slice(at, at + 900);
  assert.ok(/_titleFailed = true/.test(block), 'a failed post-pass marks the chapters it could not title');
  // ⚠️ A chapter the USER named is not a failure to report — its title is exactly what was wanted.
  assert.ok(/topicAuto === false\) continue/.test(block),
    'a user-named chapter is skipped — the same flag item AN uses to protect a hand-written title');
  // ⚠️ Written to the LIVE store object, not the captured one: the post-pass is minutes long and
  // v73_j records what happens to writes through stale references.
  assert.ok(/findSavedById\(tp\.id\)\) \|\| tp/.test(block),
    'and re-resolves each topic by id before writing, per v73_j');
  // ⚠️ Asserted on the GUARDED form, not on the bare call: `/saveStore\(store\)/` still matched
  // inside `if (false) { saveStore(store); … }`, so the mutation that never persists stayed green.
  // The containment trap this repo has written down three times, met a fourth.
  assert.ok(/if \(_marked\) \{ saveStore\(store\)/.test(block),
    'and persists when it marked something, or the mark dies with the process');
}
console.log('  a failed post-pass marks exactly the chapters it could not title: OK');

// ── 2. ⚠️ It is CLEARED wherever a title is answered ───────────────────────────────────────────
// A mark that cannot be dismissed is worse than no mark: it becomes furniture and stops being read.
{
  const at = server.indexOf('function _applyChapterTitles(');
  const apply = server.slice(at, at + 1600);
  assert.ok(/if \(tp\._titleFailed\) delete tp\._titleFailed;/.test(apply),
    'applying ANY title clears the mark — placed inside _applyChapterTitles so every path that '
    + 'titles a chapter clears it, including the manual storyline retitle that shares this function');

  const sm = server.indexOf("url.pathname === '/api/lessons/save-meta'");
  const meta = server.slice(sm, sm + 2600);
  assert.ok(/if \(saved\._titleFailed\) delete saved\._titleFailed;/.test(meta),
    'and a manual rename clears it too');
  // ⚠️ Before the no-op check, so re-confirming the existing name also dismisses it — a learner who
  // looks at the flagged title and decides it is fine has dealt with it.
  assert.ok(meta.indexOf('_titleFailed') < meta.indexOf('No-op if nothing changes'),
    'cleared BEFORE the no-op short-circuit, so accepting the existing name still dismisses the mark');
}
console.log('  applying a title, or renaming by hand, clears the mark: OK');

// ── 3. ⚠️ It rides in the savedList WHITELIST, or the badge is dead in live mode ───────────────
// The projection's own comments record this trap twice already (v74_i, v79_n): a field left out
// works in the STATIC build — which ships whole topics — and silently does nothing LIVE.
{
  const at = server.indexOf('lessonCount: (l.lessons || [])');
  const proj = server.slice(at, at + 2200);
  assert.ok(/_titleFailed \? \{ _titleFailed: true \}/.test(proj),
    '_titleFailed is in the savedList projection');
  assert.ok(/\.\.\.\(l\._titleFailed \?/.test(proj),
    'and omitted when falsy, so an ordinary chapter\'s payload is unchanged');
}
console.log('  the flag rides in the savedList whitelist, omitted when absent: OK');

// ── 4. The badge renders only for a marked chapter, and says what to do ────────────────────────
{
  const C = loadClient({ quiet: true });
  C.run(`UI_STRINGS = ${JSON.stringify(UI.en)}; true;`);
  const badge = (s) => C.run(`_titleFailedBadge(${JSON.stringify(s)})`);
  assert.strictEqual(badge({ topic: 'Fine' }), '', 'an ordinary chapter shows nothing');
  assert.strictEqual(badge(null), '', 'and neither does nothing at all');
  const marked = badge({ topic: 'Flexvervoer Welkom op de hub Domburg, St', _titleFailed: true });
  assert.ok(marked && marked.includes('⚠️'), 'a marked chapter shows a badge: ' + marked);
  assert.ok(marked.includes(UI.en['lesson.title_failed']),
    'whose tooltip says what happened AND what to do about it');
  // ⚠️ It marks, it does not RENAME. The ruling was to surface the failure, not to paper over it.
  assert.ok(marked.includes('title='), 'the message is a tooltip on a mark…');
  assert.ok(!/Flexvervoer/.test(marked), '…and the badge never rewrites the title itself');
  // The card actually renders it next to the title.
  assert.ok(/\$\{s\.topic\} \$\{_titleFailedBadge\(s\)\}/.test(client),
    'savedItemHtml puts the badge beside the chapter title');
}
console.log('  the badge shows only for a marked chapter, as a tooltip beside the untouched title: OK');

// ── 5. Exactly the one granted ui.json key, en only ────────────────────────────────────────────
{
  const k = 'lesson.title_failed';
  assert.ok(typeof UI.en[k] === 'string' && UI.en[k].trim(), 'ui.json carries ' + k);
  for (const lng of Object.keys(UI)) {
    if (lng === 'en') continue;
    assert.ok(!(k in UI[lng]), `${k} is en-only — ${lng} must not carry a machine-written copy`);
  }
  assert.ok(client.includes(k), 'and the client uses it');
}
console.log('  exactly the one granted ui.json key, en only, used: OK');

console.log('unit-title-failed-marker: ALL PASSED');
