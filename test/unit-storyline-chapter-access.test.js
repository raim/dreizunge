// unit-storyline-chapter-access.test.js
//
// ⚠️ RENAMED AND REWRITTEN AT v88_s, from `unit-storyline-lock-hardening.test.js`.
//
// That file pinned the storyline screen's chapter-wise PROGRESS LOCK — Bug #2's fail-closed rule
// (v46), v69.2d's transitive `chainBlocked` propagation, v74_k's shared completion test, and the
// "never re-lock started work" clause. The user removed the lock:
//
//   "we remove the chapter-wise progress locking as the default play mode for students. Students
//    can ALSO browse through chapters, and play each chapter separately via the new play button or
//    by clicking on words in the vocab-highlight view."
//
// So the old assertions did not fail — they became assertions of the wrong thing. Rewritten to the
// NEW claim, which is stronger and easier to break: no progress state may reach the lock predicate
// at all. A rule that has been deleted cannot be half-deleted into a dead branch some fixture
// happens not to reach, and a SOURCE-level absence check is the only layer where that is
// observable (the harness auto-vivifies ids, so a DOM "it is not locked" assertion proves nothing).
//
// The chain-REPAIR half of the old file is untouched and still pinned below: chaining unresolved
// chapters to their storyline-order predecessor shapes the connector lines and the render order,
// which the lock's removal does not affect.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// The predicate itself, sliced by its own declaration so this reads the real line and not a comment
// that happens to mention it.
const at = html.indexOf('const _isLocked =');
assert.ok(at > 0, 'the storyline screen still has one named access predicate');
const pred = html.slice(at, html.indexOf(';', at) + 1);

// ── 1. The lock is GONE, and gone at the source ──────────────────────────────────────────────
assert.ok(!/chainBlocked/.test(pred), 'no transitive "something earlier is unfinished" flag');
assert.ok(!/_chapterComplete/.test(pred), 'no predecessor-completion test');
assert.ok(!/_chapterStarted/.test(pred), 'no "has the learner started it" clause');
assert.ok(!/prevTopic/.test(pred), 'the predecessor is not consulted at all any more');
// …and nothing threads the flag down the recursion either, which is where v69.2d put it. Absence
// asserted over the WHOLE client, not just the predicate: a flag still computed and passed around
// is a lock waiting to be re-read.
assert.ok(!/chainBlocked/.test(html), 'the chainBlocked flag is gone from the client entirely');
assert.ok(!/_blockedOnward/.test(html), 'and so is the value that fed it');
assert.ok(!/_chapterStarted/.test(html.replace(/\/\/[^\n]*/g, '')),
  'the started-chapter helper is gone from the code (its removal is only described in comments)');

// ── 2. What REMAINS is not a progress gate ───────────────────────────────────────────────────
// A chapter whose lessons have not been generated has nothing behind it to open. That is a fact
// about the data, not about the learner, so it survives — and it is the ONLY thing that does.
assert.ok(/_sets\.length === 0/.test(pred),
  'a chapter with no lessons yet is still marked, because there is nothing to open');
assert.ok(/!isFirst/.test(pred),
  'and the first chapter is never marked — a storyline must always be enterable, even mid-generation');
assert.ok(/!APP\.info\.canGenerate/.test(pred) && /!APP\._teacherMode/.test(pred),
  'still scoped to the published static build, as before — nothing changed for a live teacher');
console.log('  storyline screen: the chapter-wise progress lock is gone; only "no lessons yet" remains: OK');

// ── 3. The other surface: storyboard panel clicks ────────────────────────────────────────────
// The same gate lived a second life in `_sbChapterTarget`, which silently REDIRECTED a click on a
// "locked" panel. `unit-storyboard-nav` owns the behavioural assertions; this is the cross-check
// that both copies went, because removing one and leaving the other is exactly how a rule survives
// its own deletion.
{
  const fnAt = html.indexOf('function _sbChapterTarget(');
  assert.ok(fnAt > 0, 'the panel → chapter resolver still exists');
  const fn = html.slice(fnAt, html.indexOf('\n}\n', fnAt));
  assert.ok(!/completed|_locked|resumed/.test(fn),
    'and it resolves the clicked panel without consulting progress — no second copy of the gate');
}
console.log('  storyboard panels: the redirect copy of the same gate went too: OK');

// ── 4. UNCHANGED: render-time chain repair ───────────────────────────────────────────────────
// Unrelated to the lock — it decides which chapter a card's connector line is drawn from, so a
// chapter with a broken continuation link is not rendered as a stray root. Pinned here since v46.
assert.ok(/for \(let i = 1; i < topics\.length; i\+\+\)/.test(html) &&
          /_hasPred\.add\(cur\)/.test(html),
  'renderer still chains gap chapters to their storyline-order predecessor');
console.log('  chain repair for unresolved chapters: still in place: OK');

console.log('unit-storyline-chapter-access: ALL PASSED');
