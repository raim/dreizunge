// unit-branch-mutation-tool.test.js — v90_d
//
// Guards `tools/branch-mutation.js`, the probe that measures whether a guard's fixture actually
// discriminates.
//
// ⚠️ WHY A TOOL NEEDS A GUARD. Its failure mode is silent and inverted: if `ifSites` stops finding
// branch points, or `fnRange` slices a fragment, the probe reports *0 mutants* — and 0 mutants
// prints as "100% caught". A broken measuring instrument would tell every future session that the
// suite is perfect. That is the same shape of defect the tool exists to find, so it is checked
// here the same way: on results, not on the presence of code.
'use strict';
const assert = require('assert');
const path = require('path');
const { fnRange, ifSites, discover } = require(path.join(__dirname, '..', 'tools', 'branch-mutation.js'));

// ── 1. fnRange keeps `async`, or every mutant of an async function is skipped as unparseable ─────
{
  const src = 'const a=1;\nasync function foo(x) { if (x) { await y(); } return 1; }\nconst b=2;';
  const [s, e] = fnRange(src, 'foo');
  const body = src.slice(s, e);
  assert.ok(body.startsWith('async function foo('), 'the async keyword is inside the slice');
  assert.ok(body.endsWith('}'), 'and the slice closes on the function');
  assert.doesNotThrow(() => new Function('return ' + body), 'so a body containing await still parses');
  // the plain case still works, and does NOT pick up a stray leading word
  const plain = 'function bar(y) { if (y) return 2; }';
  assert.strictEqual(plain.slice(...fnRange(plain, 'bar')), plain, 'a plain function is sliced exactly');
}

// ── 2. ifSites finds real branch points ──────────────────────────────────────────────────────────
{
  const body = 'function f(a,b){ if (a) { x(); } if (a && b) { y(); } else if (!b) { z(); } return 1; }';
  const sites = ifSites(body);
  assert.strictEqual(sites.length, 3, 'three conditions, including the `else if`');
  const conds = sites.map(s => body.slice(s.open, s.close + 1));
  assert.deepStrictEqual(conds, ['(a)', '(a && b)', '(!b)'], 'each site spans exactly its condition');
  // A nested call inside the condition must not end the span early. ⚠️ Asserting the SPAN, not just
  // the count: the count is 1 either way, so `k = body.indexOf(')')` — which stops at the inner
  // paren and would rewrite `if (h(a, i(a` — survived a count-only assertion here.
  const nestedSrc = 'function g(a){ if (h(a, i(a))) return 1; }';
  const nested = ifSites(nestedSrc);
  assert.strictEqual(nested.length, 1, 'one condition');
  assert.strictEqual(nestedSrc.slice(nested[0].open, nested[0].close + 1), '(h(a, i(a)))',
    'and its span reaches the MATCHING paren, not the first one');
}

// ── 3. ⚠️ …and does NOT find them in strings, templates, comments or identifiers ─────────────────
// Rewriting a condition that lives inside a prompt string would change what the MODEL is asked
// rather than what the code decides — a mutation that "survives" for a reason with no meaning.
{
  const body = [
    'function f(a){',
    '  const p = "if (this) then that";',
    "  const q = 'if (x) y';",
    '  const r = `if (${a}) tail`;',
    '  // if (commented) out',
    '  /* if (block) commented */',
    // ⚠️ an identifier ENDING in `if` and immediately followed by ` (` — the ONLY shape that needs
    // the preceding-character check. `const gif = 1;` does not (no paren follows), and neither does
    // `sniff (a)` (the char after the `if` is another `f`); both pass with the check deleted. Found
    // by mutating this file's own guard — the same same-answer trap it exists to catch.
    '  motif (a);',
    '  if (a) return 1;',
    '}'].join('\n');
  const sites = ifSites(body);
  assert.strictEqual(sites.length, 1, `only the real branch is a site (found ${sites.length})`);
  assert.strictEqual(body.slice(sites[0].open, sites[0].close + 1), '(a)', 'and it is the right one');
}

// ── 4. NON-VACUITY: the probe finds branches in the real tree ────────────────────────────────────
// The check that matters most. Everything above passes on hand-written fixtures; this asserts the
// instrument still reads the actual source, because "0 mutants" is indistinguishable from a clean
// bill of health in the tool's own output.
{
  const fs = require('fs');
  const client = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const rng = fnRange(client, '_provSrcBits');
  assert.ok(rng, 'a known client function is located in index.html');
  const sites = ifSites(client.slice(rng[0], rng[1]));
  assert.ok(sites.length >= 4, `and its branch points are found (${sites.length}) — a probe that ` +
    'finds none reports 0 mutants, which prints as 100% caught');
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const q = fnRange(server, 'qcCheckDiacriticCandidate');
  assert.ok(server.slice(q[0], q[1]).startsWith('async function'), 'and an async server function keeps its keyword');
}

// ── 5. ⚠️ discover() must know EVERY name the suite gives its extraction helper ──────────────────
// v90_e: the helper is called `ext` in most files, `extract` in many, and `lift` in a few. The
// probe's first version knew the first two, so it attributed `qcProse` to `unit-qc-correct` alone
// and scored it 0/16 — while `unit-qc-unify-parity` had been lifting and running it the whole time
// under `lift(`. **A missed helper name inflates the zeros**, which is the direction that wastes a
// session chasing a guard that is already there.
{
  const found = discover(1);
  const byName = (n) => found.find(f => f.fn === n);
  const qc = byName('qcProse');
  assert.ok(qc, 'qcProse is discovered at all');
  assert.ok(qc.tests.includes('unit-qc-unify-parity.test.js'),
    'and the file that lifts it with `lift(NEW, ...)` is among its guards — not just the `ext(` ones');
  // …and the common shapes still work, so widening the pattern did not break them
  assert.ok(byName('_provSrcBits'), 'an `ext(client, "name")` lift is still discovered');
  assert.ok(found.length > 50, `and the sweep still has a population to work on (${found.length})`);
}

console.log('  branch-mutation probe: async slices, real conditions only, and it still finds them: OK');
console.log('unit-branch-mutation-tool: ALL PASSED');
