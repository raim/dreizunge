// unit-storyboard-nav.test.js
// v57 — storyboard panels as clickable lesson navigation. The hard problem is the
// panel↔chapter MAPPING when the counts differ (they usually do). Contract under test:
//   • ONE mapping rule, shared by click handler and current-panel framing:
//     a sanitized model-assigned data-chapter wins; otherwise equal split
//     chapter(i) = floor(i·C/P)+1 — fewer panels → link to the chapter the span STARTS
//     with; more panels → links repeat. Pre-v57 boards (no data-chapter) are therefore
//     clickable with NO regenerate (user's call).
//   • composeStoryboardSVG sanitizes the model's per-panel `chapter` (untrusted): integer,
//     clamped 1..chapterCount, emitted as data-chapter; invalid/absent → no attribute;
//     no chapterCount given → never emitted (all existing call-less compositions unchanged).
//   • Student mode locks panel links with the SAME rule as the storyline screen's chapter
//     cards (fail closed), and a locked panel RESUMES at the first unlocked, incomplete
//     chapter instead of dead-ending. Teacher/canGenerate navigates freely.
//   • ONE delegated document-level click listener over [data-sb-chain] serves every render
//     site in live AND static (baked DOM) alike; all four render sites carry the hook.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

function ext(src, name) {
  // Anchor on line start — a prose comment mentioning "function buildPath()" must not match.
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. The mapping formula (client, pure) ─────────────────────────────────────
const _sbPanelChapter = new Function(ext(client, '_sbPanelChapter') + '\nreturn _sbPanelChapter;')();
{
  // Fewer panels than chapters (the common case): equal split, panel links to the chapter
  // its span STARTS with. 2 panels over 5 chapters → 1 and 3.
  assert.strictEqual(_sbPanelChapter(0, 2, 5, null), 1, '2 panels / 5 chapters: panel 0 → ch 1');
  assert.strictEqual(_sbPanelChapter(1, 2, 5, null), 3, '2 panels / 5 chapters: panel 1 → ch 3 (start of its span)');
  // 3 panels over 7 chapters → 1, 3, 5.
  assert.deepStrictEqual([0,1,2].map(i => _sbPanelChapter(i, 3, 7, null)), [1,3,5], '3 panels / 7 chapters split');
  // More panels than chapters: links repeat, every chapter covered, order non-decreasing.
  const rep = [0,1,2,3,4].map(i => _sbPanelChapter(i, 5, 3, null));
  assert.deepStrictEqual(rep, [1,1,2,2,3], '5 panels / 3 chapters: links repeat, all chapters covered');
  // Equal counts: identity.
  assert.deepStrictEqual([0,1,2].map(i => _sbPanelChapter(i, 3, 3, null)), [1,2,3], 'equal counts → identity');
  // The whole equal-split range is monotonic and in 1..C for a spread of sizes.
  for (const [P, C] of [[2,12],[6,4],[12,11],[4,4],[5,1]]) {
    let last = 0;
    for (let i = 0; i < P; i++) {
      const ch = _sbPanelChapter(i, P, C, null);
      assert.ok(ch >= 1 && ch <= C, `P=${P} C=${C} i=${i}: in range (got ${ch})`);
      assert.ok(ch >= last, `P=${P} C=${C}: non-decreasing`);
      last = ch;
    }
    assert.strictEqual(_sbPanelChapter(0, P, C, null), 1, `P=${P} C=${C}: first panel is always chapter 1`);
  }
  // A model-assigned data-chapter WINS over the formula…
  assert.strictEqual(_sbPanelChapter(0, 2, 5, '4'), 4, 'valid data-chapter beats the formula');
  // …but is re-clamped against the CURRENT chapter count (stored SVGs outlive deletions)…
  assert.strictEqual(_sbPanelChapter(0, 2, 3, '9'), 3, 'stale data-chapter clamped to current count');
  // …and anything non-integer / below 1 falls back to the formula (fail closed, never NaN).
  assert.strictEqual(_sbPanelChapter(1, 2, 5, 'x'), 3, 'garbage data-chapter → formula');
  assert.strictEqual(_sbPanelChapter(1, 2, 5, '0'), 3, 'chapter 0 is invalid → formula');
  assert.strictEqual(_sbPanelChapter(1, 2, 5, '2.5'), 3, 'non-integer → formula');
  // Degenerate inputs → null (the click handler bails, never throws).
  assert.strictEqual(_sbPanelChapter(0, 0, 5, null), null, 'no panels → null');
  assert.strictEqual(_sbPanelChapter(0, 2, 0, null), null, 'no chapters → null');
  assert.strictEqual(_sbPanelChapter(5, 2, 3, null), null, 'index out of panel range → null');
}
console.log('  panel↔chapter mapping: equal split both directions, data-chapter wins + re-clamps: OK');

// ── 2. Composer sanitizes the model's chapter field (server, untrusted input) ─
const schemeConsts = (server.match(/const STORYBOARD_SCHEMES = \{[\s\S]*?\n\};/) || [])[0]
  + '\n' + (server.match(/const STORYBOARD_SCHEME_DEFAULT = '[a-z]+';/) || [])[0];
const compose = new Function(schemeConsts + '\n' + ext(server, 'composeStoryboardSVG') + '\nreturn composeStoryboardSVG;')();
{
  const mk = (chapter) => ({ caption: 'c', chapter, bg: 'sky', shapes: [
    { type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' } ]});
  // Valid values are emitted, clamped into 1..chapterCount.
  const { svg } = compose([mk(1), mk(2), mk(99), mk(-3)], 'classic', 4);
  const chs = [...svg.matchAll(/<g data-chapter="(\d+)">/g)].map(m => +m[1]);
  assert.deepStrictEqual(chs, [1, 2, 4, 1], 'valid emitted; 99 clamped to 4; -3 clamped to 1');
  // Non-integer / absent → NO attribute (client formula takes over), never NaN/garbage.
  const { svg: s2 } = compose([mk('x'), mk(undefined), mk(2.5)], 'classic', 4);
  assert.ok(!/data-chapter/.test(s2), 'non-integer chapter values never emit an attribute');
  // Without a chapterCount (every pre-v57 call shape) nothing is ever emitted, even for
  // panels that DO carry a chapter field.
  const { svg: s3 } = compose([mk(1), mk(2)], 'classic');
  assert.ok(!/data-chapter/.test(s3), 'no chapterCount → no data-chapter (back-compat compose)');
  // Injection: the attribute value is a Number()-derived integer by construction — assert the
  // output can only ever contain the sanitized digit form.
  const { svg: s4 } = compose([mk('2" onclick="evil()'), mk(2)], 'classic', 4);
  assert.ok(!/onclick|evil/.test(s4), 'hostile chapter string never reaches the markup');
}
console.log('  composer data-chapter: integer-clamped, absent when invalid, injection-proof: OK');

// ── 3. Lock/resume resolution (client, pure) — same rule as the chapter cards ─
const _sbChapterTarget = new Function(ext(client, '_sbChapterTarget') + '\nreturn _sbChapterTarget;')();
{
  const L = id => ({ id });
  const chap = (topic, lessons) => ({ id: 'tp_' + topic, topic, lessons });
  const chaps = [
    chap('A', [L('a1'), L('a2')]),
    chap('B', [L('b1')]),
    chap('C', [L('c1')]),
  ];
  const done = ids => Object.fromEntries(ids.map(i => [i, { total: 1, correct: 1 }]));
  // Teacher / canGenerate: free navigation, no resume redirects.
  assert.strictEqual(_sbChapterTarget(chaps, {}, 3, true).chapter.topic, 'C', 'free mode: direct deep link');
  assert.strictEqual(_sbChapterTarget(chaps, {}, 3, true).resumed, false, 'free mode: never "resumed"');
  // Student, nothing done: chapter 1 opens directly; chapters 2/3 are locked → resume at 1.
  let r = _sbChapterTarget(chaps, {}, 1, false);
  assert.ok(r.chapter.topic === 'A' && !r.resumed, 'student: first chapter always open');
  r = _sbChapterTarget(chaps, {}, 3, false);
  assert.ok(r.chapter.topic === 'A' && r.resumed, 'student: locked panel resumes at first incomplete chapter');
  // Chapter A complete: B unlocks; a click on C resumes at B (first unlocked incomplete).
  const progA = { A: done(['a1', 'a2']) };
  r = _sbChapterTarget(chaps, progA, 2, false);
  assert.ok(r.chapter.topic === 'B' && !r.resumed, 'predecessor complete → target unlocked');
  r = _sbChapterTarget(chaps, progA, 3, false);
  assert.ok(r.chapter.topic === 'B' && r.resumed, 'still-locked C resumes at B');
  // Fail closed exactly like the cards: a chapter with NO lessons is locked even when its
  // predecessor is complete — the resume lands on the last playable position.
  const gappy = [chap('A', [L('a1')]), chap('B', []), chap('C', [L('c1')])];
  r = _sbChapterTarget(gappy, { A: done(['a1']) }, 2, false);
  assert.ok(r.resumed, 'lesson-less chapter is locked (fail closed)');
  // Out-of-range panel targets clamp instead of throwing.
  assert.strictEqual(_sbChapterTarget(chaps, {}, 99, true).chapter.topic, 'C', 'target clamped high');
  assert.strictEqual(_sbChapterTarget(chaps, {}, -5, true).chapter.topic, 'A', 'target clamped low');
  assert.strictEqual(_sbChapterTarget([], {}, 1, true), null, 'empty storyline → null');
  // Everything complete: a locked-computation never strands — falls back to chapter 1.
  const allDone = { A: done(['a1', 'a2']), B: done(['b1']), C: done(['c1']) };
  r = _sbChapterTarget(chaps, allDone, 3, false);
  assert.ok(r.chapter.topic === 'C' && !r.resumed, 'all complete: every chapter open');
}
console.log('  lock/resume: chapter-card rule mirrored, locked panels resume, fail closed: OK');

// ── 4. Wiring: one delegated listener, mapping shared by click + framing ──────
{
  assert.ok(/document\.addEventListener\('click', _sbNavClick\)/.test(client),
    'ONE document-level delegated listener (works on baked static DOM too)');
  const nav = ext(client, '_sbNavClick');
  assert.ok(/closest\('\.storyline-storyboard\[data-sb-chain\]'\)/.test(nav.replace(/\s+/g, ' ')) ||
            /\.storyline-storyboard\[data-sb-chain\]/.test(nav), 'delegates on the data-sb-chain wrapper');
  assert.ok(/_sbPanelChapter\(/.test(nav), 'click handler uses THE shared mapping');
  assert.ok(/openStoryboardChapter\(/.test(nav), 'click resolves through openStoryboardChapter');
  const mark = ext(client, '_sbMarkCurrentPanels');
  assert.ok(/_sbPanelChapter\(/.test(mark), 'current-chapter framing uses THE SAME mapping (frame and link cannot disagree)');
  const open = ext(client, 'openStoryboardChapter');
  assert.ok(/_sbChapterTarget\(/.test(open), 'open resolves locks via _sbChapterTarget');
  assert.ok(/APP\._teacherMode/.test(open) && /canGenerate/.test(open), 'free navigation = teacher mode or canGenerate');
  assert.ok(/APP\._slScreen = \{ chainId/.test(open), 'sets the storyline context so the lesson-set header names the right storyline');
  assert.ok(/storyboard\.locked_resume/.test(open), 'resume redirect explains itself with a toast');
  assert.ok(/loadSaved\(/.test(open), 'opens through the existing loadSaved/resume machinery — no second progress system');
  // The composer emits panels as direct <g> children; the handler indexes exactly those.
  assert.ok(/g\.parentNode !== outer/.test(nav), 'only top-level panel groups are click targets');
}
console.log('  delegation + shared mapping between click, framing and lock resolution: OK');

// ── 5. Render sites: all four carry the data-sb-chain hook (live + static parity) ─
{
  // Live landing card, storyline screen, lesson-set page (buildPath).
  assert.ok(/id="slsb-wrap-\$\{chainId\}" data-sb-chain=/.test(client), 'LIVE landing card wrapper carries data-sb-chain');
  assert.ok(/slsb-screen-'[\s\S]{0,120}data-sb-chain/.test(client), 'storyline screen wrapper carries data-sb-chain');
  const bp = ext(client, 'buildPath');
  assert.ok(/ls-storyboard/.test(bp), 'buildPath renders the board on the lesson-set page');
  assert.ok(/insertAdjacentElement\('beforebegin', sbBox\)/.test(bp) && /cont-nav/.test(bp),
    'the board sits ABOVE the back/forward cont-nav');
  assert.ok(/_sbMarkCurrentPanels\(sbBox/.test(bp), 'the current chapter panel(s) get the frame');
  assert.ok(/removeAttribute\('data-sb-chain'\)/.test(bp), 'a topic without a storyline board clears the hook (no stale clicks)');
  // Static parity — the landing card renders in TWO places (the v55_p trap).
  assert.ok(/slsb-wrap-'\+chainId\+'" data-sb-chain=/.test(builder), 'STATIC landing card wrapper carries data-sb-chain (parity)');
  // Panels are visibly clickable.
  assert.ok(/\.storyline-storyboard\[data-sb-chain\] svg > g\{cursor:pointer\}/.test(client), 'pointer cursor on linkable panels');
  // The prompt asks for the per-panel chapter field, templated with the real chapter count.
  const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
  assert.ok(/"chapter": N/.test(prompts.storylineStoryboard.system), 'prompt schema includes the per-panel chapter field');
  assert.ok(/\{chapters\}/.test(prompts.storylineStoryboard.system), 'prompt names the real chapter count');
  assert.ok(/fillPrompt\(PROMPTS\.storylineStoryboard\.system, \{ S, chapters: topics\.length, maxPanels \}\)/.test(server),
    'generator fills the chapter count (and v57 panel budget) into the system prompt');
  // i18n: the resume toast key exists in en (en ONLY — translate-ui.js fills the rest).
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['storyboard.locked_resume'], 'ui.json en has storyboard.locked_resume');
}
console.log('  render-site hooks live+static, prompt chapter field, i18n key: OK');

console.log('unit-storyboard-nav: ALL PASSED');
