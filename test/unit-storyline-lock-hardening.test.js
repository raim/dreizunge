// Source guard for the client-side half of Bug #2 (v46). The storyline lock must
// fail CLOSED and the renderer must chain unresolved chapters to their storyline-order
// predecessor — otherwise a chapter with a broken continuation link is treated as a
// stray "first" chapter and falls open (unlocked). The algorithm itself is exercised
// in unit-chapter-link-repair; this just pins the two client edits so a future refactor
// can't silently drop them (the full visual behaviour is a live browser check).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 1) fail-closed: a non-first chapter with no known predecessor stays locked.
assert.ok(/_sets\.length === 0 \|\|\s*\n\s*\/\/[^\n]*fail closed[^\n]*\n\s*!prevTopic \|\|/.test(html),
  'lock condition must fail closed on a missing predecessor (!prevTopic ||)');

// 2) render-time chain repair: unresolved chapters chained to topics[i-1].
assert.ok(/for \(let i = 1; i < topics\.length; i\+\+\)/.test(html) &&
          /_hasPred\.add\(cur\)/.test(html),
  'renderer must chain gap chapters to their storyline-order predecessor');


// ── v69.2d: the gate is TRANSITIVE and never re-locks started work ───────────────────────────
// User-reported from the live storyline screen: a LOCKED chapter sat between two reachable ones
// ("progress skipped the third, still locked chapter"). Cause: the predicate inspected only the
// IMMEDIATE predecessor. Adding a lesson to chapter 2 made it incomplete → chapter 3 locked, while
// chapter 4 stayed open because ITS predecessor (3) still carried all its done-flags. Two fixes:
// `chainBlocked` propagates "something earlier is unfinished" down the chain, and a chapter the
// learner has already STARTED is never locked (the gate stops reading ahead; it must not confiscate
// work in progress — otherwise editing an early chapter would lock chapters mid-play).
assert.ok(/function _renderChain\(topic, prevTopic, isFirst, depth, chainBlocked\)/.test(html),
  'the chain renderer threads a chainBlocked flag');
assert.ok(/const _blockedOnward = !!chainBlocked \|\| !_chapterComplete\(topic\);/.test(html),
  'an unfinished chapter blocks everything after it');
assert.ok(/_renderChain\(kids\[0\], topic, false, depth \+ 1, _blockedOnward\)/.test(html)
       && /_renderChain\(kid, topic, false, depth \+ 1, _blockedOnward\)/.test(html),
  'both the linear and the branching recursion pass the flag on');
assert.ok(/&& !_chapterStarted\(topic\) && \(/.test(html),
  'a chapter the learner has already started is never locked');
assert.ok(/chainBlocked \|\|/.test(html), 'chainBlocked participates in the lock predicate');
assert.ok(/html \+= _renderChain\(root, null, root === topics\[0\], 0, false\);/.test(html),
  'the root starts unblocked');

// Behavioral: replicate the reported storyline (4 chapters; ch2 gained a lesson and is unfinished;
// ch3 fully done; ch4 partially played) and check every card's lock state.
{
  const byTopic = {
    c1: { lessons: [{ id: 'a' }] },
    c2: { lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] },
    c3: { lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    c4: { lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    c5: { lessons: [{ id: 'a' }] },              // never touched — must stay locked
  };
  const _slCompleted = {
    c1: { a: 1 },                                 // complete
    c2: { a: 1, b: 1, c: 1 },                     // 'd' (the lesson just added) missing → unfinished
    c3: { a: 1, b: 1, c: 1 },                     // complete
    c4: { a: 1 },                                 // started, not finished
  };
  const started  = (t) => (byTopic[t]?.lessons || []).some(l => (_slCompleted[t] || {})[l.id]);
  const complete = (t) => { const ls = byTopic[t]?.lessons || []; const p = _slCompleted[t] || {};
    return ls.length > 0 && ls.every(l => p[l.id]); };
  const locked = (topic, prev, isFirst, chainBlocked) =>
    !isFirst && !started(topic) && ((byTopic[topic]?.lessons || []).length === 0 || !prev || chainBlocked || !complete(prev));

  let blocked = false;
  const chain = ['c1', 'c2', 'c3', 'c4', 'c5'];
  const states = {};
  chain.forEach((t, i) => {
    states[t] = locked(t, i ? chain[i - 1] : null, i === 0, blocked);
    blocked = blocked || !complete(t);
  });
  assert.strictEqual(states.c1, false, 'first chapter is never locked');
  assert.strictEqual(states.c2, false, 'chapter after a completed one is open');
  assert.strictEqual(states.c3, false, 'an ALREADY-COMPLETED chapter is not re-locked by an edit upstream');
  assert.strictEqual(states.c4, false, 'a chapter the learner is midway through keeps its access');
  assert.strictEqual(states.c5, true,  'an untouched chapter behind the unfinished chain stays locked');
  // The reported anomaly — a locked card between two reachable ones — is now impossible for
  // untouched chapters: once one is locked, every untouched chapter after it is locked too.
  const after = ['c5'].every(t => states[t]);
  assert.ok(after, 'locking is transitive for untouched chapters');
}
console.log('  v69.2d: transitive gate, started work never re-locked: OK');

console.log('unit-storyline-lock-hardening: ALL PASSED (fail-closed lock + chain-repair present)');
