#!/usr/bin/env node
// tools/branch-mutation.js — v90_d
//
// Measures the blind spot the v90_b/v90_c audits named and could not see: a guard that RUNS the
// right function on a fixture whose answer never changes when the function does. Those audits
// asked "is this function executed at all"; this asks the harder question, "does the guard notice
// when it behaves differently".
//
// Method: for each `if (cond)` inside a target function, rewrite the condition to `true`, then to
// `false`, check the mutant still parses, and run the tests that LIFT that function. A guard that
// catches none of its function's mutants has a fixture that does not discriminate.
//
// ⚠️ SCOPE OF THE ANSWER. A survivor here means "the guards that lift this function do not notice",
// NOT "nothing in the suite notices" — v90_c's own suspect list was 57% wrong for exactly that
// reason, because the guard that catches a behaviour is often named after the behaviour rather than
// the function. Escalate a survivor to the full suite before calling it a coverage gap.
//
// ⚠️ Two mutants can never be killed and are not findings: an EQUIVALENT mutant (the condition has
// no observable effect — `if (piece)` in `_splitLongUnit` is one, an empty piece is unreachable),
// and one whose condition is constant in this environment (`typeof Intl.Segmenter !== 'function'`).
// Judge the survivor list, do not just count it.
//
// Usage:
//   node tools/branch-mutation.js --targets <file.json> [--out res.json] [--max 10]
//   node tools/branch-mutation.js --discover [--min-ifs 3] [--out res.json] [--max 10]
//
// --discover finds every function that some unit test lifts with an extract()-style helper.
// A targets file is [{ "fn": "...", "file": "index.html", "tests": ["unit-x.test.js"] }, ...].
//
// ⚠️ RUN IT ON A COPY when anything else may read the tree. It rewrites real source files
// thousands of times; writes go through temp+rename so a concurrent reader never sees a prefix
// (a bare writeFileSync here made the user's own `node test/run.js` fail on a truncated
// index.html — the same defect atomic-write.js exists for), but a reader can still catch a
// MUTATED file, which is just as confusing. Set MUT_ROOT to point at the copy.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');

const ROOT = process.env.MUT_ROOT || path.join(__dirname, '..');
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : d; };
const MAXB = Number(arg('--max', 10));
const OUT = arg('--out', null);

// temp+rename, for the reason in the header.
const write = (f, data) => { const t = f + '.mut' + process.pid; fs.writeFileSync(t, data); fs.renameSync(t, f); };

function fnRange(src, fn) {
  let at = src.indexOf('function ' + fn + '(');
  if (at < 0) return null;
  // Keep the `async` keyword: slicing from the word `function` drops it, and a body containing
  // `await` then fails to parse — which silently skips every mutant as "unparseable".
  if (src.slice(Math.max(0, at - 6), at) === 'async ') at -= 6;
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return [at, i];
}
// `if (` starts that are real code — not inside a string, template, comment or regex. Mutating a
// condition that lives inside a prompt string would change what the model is asked, not what the
// code decides.
function ifSites(body) {
  const out = []; let i = 0, st = 0;   // 0 code 1 line-comment 2 block 3 '' 4 "" 5 ``
  while (i < body.length) {
    const c = body[i], n = body[i + 1];
    if (st === 0) {
      if (c === '/' && n === '/') { st = 1; i += 2; continue; }
      if (c === '/' && n === '*') { st = 2; i += 2; continue; }
      if (c === "'") { st = 3; i++; continue; }
      if (c === '"') { st = 4; i++; continue; }
      if (c === '`') { st = 5; i++; continue; }
      if (c === 'i' && n === 'f' && /[\s(]/.test(body[i + 2] || '') && !/[\w$.]/.test(body[i - 1] || ' ')) {
        let j = i + 2; while (/\s/.test(body[j])) j++;
        if (body[j] === '(') {
          let d = 0, k = j;
          for (; k < body.length; k++) { if (body[k] === '(') d++; else if (body[k] === ')') { d--; if (!d) break; } }
          if (k < body.length) out.push({ open: j, close: k });
          i = j + 1; continue;
        }
      }
      i++; continue;
    }
    if (st === 1) { if (c === '\n') st = 0; i++; continue; }
    if (st === 2) { if (c === '*' && n === '/') { st = 0; i += 2; continue; } i++; continue; }
    if (c === '\\') { i += 2; continue; }
    if ((st === 3 && c === "'") || (st === 4 && c === '"') || (st === 5 && c === '`')) st = 0;
    i++;
  }
  return out;
}
function discover(minIfs) {
  const files = fs.readdirSync(path.join(ROOT, 'test')).filter(f => f.endsWith('.test.js'));
  const map = new Map();
  const pats = [/\bex(?:t|tract|tAsync)?\(\s*(?:html|server|client|llm|builder|src|bstatic)\s*,\s*['"]([\w$]+)['"]/g,
                /\bex(?:t|tract|tAsync)?\(\s*['"](?:async function |function )?([\w$]+)['"]/g];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, 'test', f), 'utf8');
    for (const re of pats) for (const m of s.matchAll(re)) {
      if (!map.has(m[1])) map.set(m[1], new Set());
      map.get(m[1]).add(f);
    }
  }
  const app = {};
  for (const f of ['index.html', 'server.js', 'llm.js', 'build-static.js']) app[f] = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const out = [];
  for (const [fn, tests] of map) {
    const t = [...tests].filter(x => !x.startsWith('e2e-'));      // e2e spawns servers; too slow to mutate
    if (!t.length) continue;
    const file = Object.keys(app).find(f => app[f].includes('function ' + fn + '('));
    if (!file) continue;
    const rng = fnRange(app[file], fn);
    const ifs = ifSites(app[file].slice(rng[0], rng[1])).length;
    if (ifs < minIfs) continue;
    out.push({ fn, file, tests: t.slice(0, 3), ifs });
  }
  return out.sort((a, b) => b.ifs - a.ifs);
}

module.exports = { fnRange, ifSites, discover };
// ⚠️ Exported ABOVE the driver and guarded here, so `require()`ing this file for a test does not
// start mutating the tree. unit-branch-mutation-tool depends on that.
if (require.main !== module) return;

const targets = process.argv.includes('--discover')
  ? discover(Number(arg('--min-ifs', 3)))
  : JSON.parse(fs.readFileSync(arg('--targets'), 'utf8'));

const results = [];
let dirty = null;                                       // restore on Ctrl-C, or the tree stays mutated
const restore = () => { if (dirty) { write(dirty.file, dirty.orig); dirty = null; } };
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('exit', restore);

for (const t of targets) {
  const file = path.join(ROOT, t.file);
  const orig = fs.readFileSync(file, 'utf8');
  const rng = fnRange(orig, t.fn);
  if (!rng) { results.push({ ...t, error: 'not found' }); continue; }
  const body = orig.slice(rng[0], rng[1]);
  const sites = ifSites(body).slice(0, MAXB);
  const row = { fn: t.fn, file: t.file, tests: t.tests, branches: sites.length, mutants: 0, caught: 0, survived: [] };
  for (let s = sites.length - 1; s >= 0; s--) {          // back to front, so earlier offsets stay valid
    for (const lit of ['true', 'false']) {
      const mutBody = body.slice(0, sites[s].open + 1) + lit + body.slice(sites[s].close);
      try { new Function('return ' + mutBody); } catch (_) { continue; }
      const mutated = orig.slice(0, rng[0]) + mutBody + orig.slice(rng[1]);
      if (mutated === orig) continue;
      dirty = { file, orig };
      write(file, mutated);
      row.mutants++;
      let caught = false;
      for (const tf of t.tests) {
        try { execFileSync(process.execPath, [path.join(ROOT, 'test', tf)], { stdio: 'ignore', timeout: 90000, cwd: ROOT }); }
        catch (_) { caught = true; break; }              // a timeout counts as caught: an infinite loop is a defect
      }
      write(file, orig); dirty = null;
      if (caught) row.caught++;
      else row.survived.push(`if#${s} → ${lit}: ` + body.slice(sites[s].open, Math.min(sites[s].close + 1, sites[s].open + 70)).replace(/\s+/g, ' '));
    }
  }
  results.push(row);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  console.log(`${row.fn.padEnd(28)} ${String(row.caught).padStart(3)}/${String(row.mutants).padEnd(3)} caught   (${row.tests.join(',')})`);
}
const tot = results.reduce((s, r) => s + (r.mutants || 0), 0);
const cau = results.reduce((s, r) => s + (r.caught || 0), 0);
console.log(`\n${results.length} functions, ${tot} mutants, ${cau} caught (${tot ? Math.round(100 * cau / tot) : 0}%)`);
const zero = results.filter(r => r.mutants && !r.caught);
if (zero.length) console.log(`⚠ ${zero.length} scored ZERO — the guards that lift them notice nothing:\n  ` +
  zero.map(r => `${r.fn} (${r.mutants}, ${r.tests.join(',')})`).join('\n  '));
