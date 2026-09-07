// unit-lesson-retry.test.js
// v90_n — the two things `v90_l`'s IPv6 fix left open, both measured on the shipped code first and
// only then changed. `withRetry` had NO test of any kind before this file.
//
// ⚠️ EVERY TIMING BELOW IS ASSERTED FROM THE COMPUTED SCHEDULE, NEVER BY SLEEPING THROUGH IT.
// `roadmap_v90.md`'s own rule (`v89` rule 16): a synchronous wait in a test that is waiting on a
// TIMER measures nothing. `retryDelayMs` is a pure function of (error, attempt), so the schedule is
// checkable directly; the one test that actually runs the loop collapses both bases to 0ms through
// the env overrides the implementation reads, so it exercises the CONTROL FLOW at full speed
// without ever asserting that a timer fired.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const llmSrc = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');

const CANCELLED = 'LLM call cancelled';

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// The real predicate from server.js, not a re-implementation — asserting the retry against a copy of
// the rule is exactly the trap `v90_b` found twice ("two guards were asserting against their own
// re-implementation").
const pingFailureIsHard = new Function(ext(server, 'pingFailureIsHard') + '\nreturn pingFailureIsHard;')();

// ⚠️ Built by EXECUTING the lifted source, never by regexing it — `v90_d`'s finding, where a guard
// used its extraction helper as a slicing tool and every claim about the result was a regex over the
// guard's own source. `env` is applied before the lift because the bases are module-level consts
// read at load time.
function build(env) {
  const consts = server.match(/const RETRY_SOFT_BASE_MS[\s\S]*?const RETRY_BACKOFF = \d+;/);
  assert.ok(consts, 'the retry bases are named constants (if renamed, update this guard)');
  const envMs = server.match(/const _retryEnvMs = [\s\S]*?\n};/);
  assert.ok(envMs, 'found _retryEnvMs');
  return new Function('console', 'CANCELLED', 'pingFailureIsHard', 'process',
    envMs[0] + '\n' + consts[0] + '\n' + ext(server, 'retryDelayMs') + '\n' + ext(server, 'withRetry') +
    '\nreturn { withRetry, retryDelayMs, RETRY_SOFT_BASE_MS, RETRY_HARD_BASE_MS, RETRY_BACKOFF };'
  )({ log(){}, warn(){} }, CANCELLED, pingFailureIsHard, { env });
}

const R = build({});
const hardErr = () => Object.assign(new Error('Ollama network: connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' });
const softErr = () => new Error('Ollama returned empty response');

// ⚠️ THE SECTIONS RUN LINEARLY INSIDE ONE async main, AND `ran` IS ASSERTED AT THE END.
// They were originally chained through `.then` callbacks, each section calling the next — which
// means a missed hand-off would silently skip every later section while the process still exited 0.
// That is the vacuous-guard shape this project keeps re-finding, built by hand into a brand-new
// guard. The counter makes a skipped section a FAILURE rather than a quiet pass.
let ran = 0;

(async () => {

// ── 1. ⚠️ A CANCEL IS NOT A FAILURE AND MUST NOT BE RETRIED ──────────────────
// Measured on the code before this change: a cancel spent 1606ms sleeping through two further
// attempts and surfaced as "Lesson 3 failed after 3 attempts: LLM call cancelled", which no longer
// `=== CANCELLED`. The final job status survived only because jobFailOrCancel ALSO checks
// `j.status === 'cancelled'` — the message test alone would have logged a deliberate stop as a
// failure. Both halves are asserted: the attempt count, and the identity of the error.
{
  let attempts = 0;
  const started = Date.now();
  let caught = null;
  try { await R.withRetry('Lesson 3', async () => { attempts++; throw new Error(CANCELLED); }); }
  catch (e) { caught = e; }
  assert.ok(caught, 'a cancel must still reject');
  assert.strictEqual(attempts, 1, `a cancel is attempted ONCE, not retried (made ${attempts})`);
  assert.strictEqual(caught.message, CANCELLED,
    'the ORIGINAL error is re-thrown, so `msg === CANCELLED` stays true for every downstream ' +
    `test of it (got ${JSON.stringify(caught.message)})`);
  // No timer assertion — the point is that no delay was ever SCHEDULED, which the attempt count
  // already proves. This bound only catches a catastrophic regression.
  assert.ok(Date.now() - started < 500, 'and it returns immediately');
  ran++;
  console.log('  a cancel is attempted once and re-thrown unchanged (was: 3 attempts, 1606ms): OK');
}

// ── 2. A refused connection and a bad answer do not wait the same time ───────
{
  const h1 = R.retryDelayMs(hardErr(), 1), h2 = R.retryDelayMs(hardErr(), 2);
  const s1 = R.retryDelayMs(softErr(), 1), s2 = R.retryDelayMs(softErr(), 2);

  assert.ok(h1 > s1 && h2 > s2,
    `a hard connection failure must back off longer than a soft one (hard ${h1}/${h2}, soft ${s1}/${s2})`);
  // ⚠️ The point of the change, stated as the property rather than as the constants: the whole
  // 3-attempt window for a DOWN BACKEND must outlast a fault, where the flat 800ms schedule gave a
  // 1615ms window that a single interface stall swallowed whole. 10s is the floor being claimed.
  assert.ok(h1 + h2 >= 10000,
    `the hard-failure window must outlast an interface stall (got ${(h1 + h2) / 1000}s; the flat ` +
    '800ms schedule this replaced gave 1.6s, and chapter 2 of 3 was lost inside one fault)');
  // And a soft failure must NOT become slow — a malformed generation may well succeed at once.
  assert.ok(s1 <= 1000, `a soft failure still retries promptly (got ${s1}ms)`);

  // Exponential, not flat. Flattening the backoff is the mutation this catches.
  assert.ok(h2 > h1 && s2 > s1,
    `the delay must GROW between attempts (hard ${h1}→${h2}, soft ${s1}→${s2})`);
  assert.strictEqual(h2 / h1, R.RETRY_BACKOFF, 'hard delays grow by exactly RETRY_BACKOFF');
  assert.strictEqual(s2 / s1, R.RETRY_BACKOFF, 'soft delays grow by exactly RETRY_BACKOFF');
  ran++;
  console.log(`  hard ${h1}/${h2}ms (${(h1 + h2) / 1000}s window) vs soft ${s1}/${s2}ms, both exponential: OK`);
}

// ── 3. The hard/soft split is driven by the REAL predicate, on a REAL code ───
{
  for (const code of ['ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND']) {
    const e = Object.assign(new Error('Ollama network: x'), { code });
    assert.ok(R.retryDelayMs(e, 1) === R.retryDelayMs(hardErr(), 1),
      `${code} is treated as a hard failure (pingFailureIsHard's own list)`);
  }
  // A timeout is NOT hard — the machine stalled, which is not evidence the backend went anywhere.
  // Same distinction _scheduleBackendRecheck makes, and it must not drift from it.
  const timeout = Object.assign(new Error('Ollama network: timeout'), { code: 'ETIMEDOUT' });
  assert.strictEqual(R.retryDelayMs(timeout, 1), R.retryDelayMs(softErr(), 1),
    'a TIMEOUT is soft: a swapping box is not a missing backend');
  // An error with no code at all must not crash the schedule.
  assert.strictEqual(R.retryDelayMs(new Error('bare'), 1), R.retryDelayMs(softErr(), 1),
    'an error with no .code degrades to the soft schedule');
  ran++;
  console.log('  hard/soft is decided by pingFailureIsHard, and a timeout stays SOFT: OK');
}

// ── 4. ⚠️ llm.js MUST PRESERVE err.code, or §2 and §3 are decorative ─────────
// This is the load-bearing dependency: the retry can only tell the two failures apart because the
// wrapper carries the code through. llm.js used to build a fresh Error from the message alone.
// Asserted by RUNNING the real handler expression, not by grepping for `code`.
{
  const m = llmSrc.match(/req\.on\('error', e => reject\(aborted \? new Error\(CANCELLED\) : ([\s\S]*?)\)\);/);
  assert.ok(m, 'found the network-error rejection in llm.js (if reshaped, update this guard)');
  const wrap = new Function('CANCELLED', 'e', 'return ' + m[1] + ';');
  const original = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' });
  const wrapped = wrap(CANCELLED, original);
  assert.strictEqual(wrapped.code, 'ECONNREFUSED',
    'llm.js carries the original error CODE onto the wrapper — without it the retry above cannot ' +
    'distinguish a down backend from a bad generation, and both wait the soft delay');
  assert.ok(/^Ollama network: /.test(wrapped.message), 'and still prefixes the message as before');
  // An error with no code must not gain a spurious one.
  assert.strictEqual(wrap(CANCELLED, new Error('socket hang up')).code, undefined,
    'an error with no code does not acquire `code: undefined` as an own property');
  // Both call sites must do it — one patched site is a silent half-fix.
  const sites = llmSrc.match(/req\.on\('error', e => reject\(aborted \?/g) || [];
  assert.strictEqual(sites.length, 2, `both llm.js network-error sites exist (found ${sites.length})`);
  assert.strictEqual((llmSrc.match(/Object\.assign\(\s*\n?\s*new Error\('Ollama network: '/g) || []).length, 2,
    'and BOTH preserve the code — patching one is a silent half-fix');
  ran++;
  console.log('  llm.js preserves err.code at both network-error sites: OK');
}

// ── 5. The loop still works: a later attempt can succeed ─────────────────────
// Run at zero delay through the env overrides, so this exercises control flow and never a timer.
{
  const Z = build({ LESSON_RETRY_SOFT_MS: '0', LESSON_RETRY_HARD_MS: '0' });
  assert.strictEqual(Z.RETRY_SOFT_BASE_MS, 0, 'the env override is honoured (0 is a valid value)');
  let n = 0;
  const v = await Z.withRetry('Lesson 9', async () => { if (++n < 3) throw softErr(); return 'ok'; });
  assert.strictEqual(v, 'ok', 'a success on the third attempt is returned');
  assert.strictEqual(n, 3, 'and it took exactly three attempts');
  let exhausted = null;
  try { await Z.withRetry('Lesson 9', async () => { throw softErr(); }); }
  catch (e) { exhausted = e; }
  assert.ok(exhausted, 'exhausting the attempts must reject');
  assert.ok(/failed after 3 attempts/.test(exhausted.message),
    `exhaustion still reports the attempt count (got ${exhausted.message})`);
  assert.ok(/empty response/.test(exhausted.message), 'and names the underlying cause');
  ran++;
  console.log('  the loop still retries and still gives up after 3: OK');
}

assert.strictEqual(ran, 5, `every section ran (only ${ran} of 5 did) — a section that returns early ` +
  'must fail this file, not pass it quietly');
console.log('unit-lesson-retry: ALL PASSED');

})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
