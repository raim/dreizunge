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

console.log('unit-storyline-lock-hardening: ALL PASSED (fail-closed lock + chain-repair present)');
