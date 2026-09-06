// unit-storyboard-job.test.js — v89_af.
//
// TWO user reports, one release.
//
// (1) "storyboard generation doesn't show up in job popover". `/api/storyline-storyboard` AWAITED
//     the generator and answered 200 when it finished — no job, no progress line, no cancel. Its own
//     comment called it "a synchronous ~30-min call", so the LONGEST model call in the app was the
//     one with no row anywhere. Exactly the defect `v88_ag` fixed for /api/story-qc and
//     /api/summary-qc; that release's "all EIGHT formerly-blocking model routes" never counted this
//     one, because it is reached from the storyline screen rather than a lesson card.
//
// (2) "I still get these messages when the laptop loses its wlan connection. Why does that happen,
//     it shouldn't need wlan, right?" — they are right. Measured on their machine: Ollama listens
//     on 127.0.0.1 only, `localhost` resolves from /etc/hosts in 3ms, and 360 probes across three
//     minutes of live wlan flapping gave ZERO failures. What the machine does show is
//     `llama-server` at 22.4GB with `free` at 0 and 11.4M pages swapped in — and 1564
//     `ip-config-unavailable` events in one boot, which is DHCP timing out, not signal loss. Both
//     symptoms are the machine stalling. So a TIMEOUT must stop being treated as proof of absence.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function routeBody(pathname) {
  const at = server.indexOf(`url.pathname === '${pathname}'`);
  assert.ok(at > -1, `server.js has a ${pathname} route`);
  let d = 0, i = server.indexOf('{', at);
  for (; i < server.length; i++) { if (server[i] === '{') d++; else if (server[i] === '}') { d--; if (!d) { i++; break; } } }
  return server.slice(at, i);
}

// ── 1. The storyboard route is a JOB, not a blocking call ───────────────────────────────────────
{
  const body = routeBody('/api/storyline-storyboard');
  assert.ok(/runAsJob\(res,/.test(body),
    '⚠️ the storyboard route answers 202 + {jobId} — this is the whole user report. A route that ' +
    'awaits its generator has no popover row, no progress and no cancel.');
  assert.ok(/label:/.test(body), 'and carries a LABEL, without which the job is not user-facing at all');
  assert.ok(/link: \{ type: 'storyline'/.test(body),
    "and a link, so the popover row gets its 'open →' button");
  assert.ok(/jobStep\(jobId,/.test(body), 'and reports a progress step');
  // ⚠️ The old shape must be GONE, not merely accompanied. A surviving `return json(res, 200,` on
  // the success path would mean the conversion was half-applied.
  assert.ok(!/return json\(res, 200, \{ storyboard/.test(body),
    'the old inline 200 response is gone');
  // ⚠️ v88_al: validation stays OUTSIDE the job. A 400/404 answers the REQUEST; turning it into a
  // failed job makes a malformed call look like a model failure and loses the status code.
  const beforeJob = body.slice(0, body.indexOf('runAsJob('));
  for (const guard of ['503', '400', '404']) {
    assert.ok(new RegExp('json\\(res, ' + guard).test(beforeJob),
      `the ${guard} validation happens before the job is created (v88_al)`);
  }
  // A cancel is not a failure and must not be logged as one (v88_k).
  assert.ok(/!== CANCELLED/.test(body), 'a cancelled storyboard is not logged as a failure');
}
console.log('  the storyboard route is a real, cancellable, labelled job: OK');

// ── 2. BOTH client callers poll — the second one is the easy miss ───────────────────────────────
// The post-generation pass calls the same route. Left unconverted it would read the 202 {jobId} as
// a response with no `storyboard` field and silently drop the result, with nothing to indicate it.
{
  const calls = [...client.matchAll(/fetch\('\/api\/storyline-storyboard'[\s\S]{0,220}?\)/g)];
  const posts = calls.filter(m => /method:\s*'POST'|method:'POST'/.test(m[0]));
  assert.strictEqual(posts.length, 2, 'there are exactly two POST callers (generate, and post-gen)');
  for (const m of posts) {
    const around = client.slice(Math.max(0, m.index - 260), m.index + m[0].length + 60);
    assert.ok(/_jobAwait\(/.test(around),
      '⚠️ every POST caller goes through _jobAwait — one left on a plain fetch would read the 202 ' +
      `as a missing storyboard and drop it silently. Offender near: ${m[0].slice(0, 70)}`);
  }
  // The DELETE caller must NOT have been converted — it makes no model call and returns inline.
  const del = client.slice(client.indexOf('async function deleteStorylineStoryboard'));
  const delBody = del.slice(0, del.indexOf('\n}'));
  assert.ok(!/_jobAwait/.test(delBody),
    'the DELETE is left alone — no model call, so a job would be pure overhead');
}
console.log('  both POST callers poll the job; the DELETE is untouched: OK');

// ── 3. ⚠️ A TIMEOUT is not proof that Ollama is gone ────────────────────────────────────────────
// The reported false offline. A refused connection proves nothing is listening; a timeout on a
// swapping machine proves only that the machine stalled.
{
  const at = server.indexOf('const _scheduleBackendRecheck');
  assert.ok(at > -1, 'server.js has the backend re-check loop');
  const loop = server.slice(at, server.indexOf('_scheduleBackendRecheck();', at + 10));
  assert.ok(/lastPingFailure\(\)/.test(loop), 'the loop reads WHY the ping failed');
  assert.ok(/pingFailureIsHard\(/.test(loop) && /hard \?/.test(loop),
    '⚠️ and branches on it — a hard refusal and a soft timeout need different amounts of evidence');
  // ⚠️ DRIVEN. As an inline ternary this decision was invisible to a source check: a mutation
  // flattening it to `const hard = true` (which restores the reported bug exactly) left the suite
  // GREEN. It is a named function now, so the classification itself can be tested.
  const at2 = server.indexOf('function pingFailureIsHard(');
  assert.ok(at2 > -1, 'server.js names the hard/soft decision');
  let d2 = 0, j = server.indexOf('{', at2);
  for (; j < server.length; j++) { if (server[j] === '{') d2++; else if (server[j] === '}') { d2--; if (!d2) { j++; break; } } }
  const isHard = new Function(server.slice(at2, j) + '\nreturn pingFailureIsHard;')();
  for (const code of ['ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND'])
    assert.strictEqual(isHard(code), true, `${code} is proof nothing is listening`);
  for (const code of ['TIMEOUT', 'ECONNRESET', 'HTTP503', undefined, null, ''])
    assert.strictEqual(isHard(code), false,
      `${code} is NOT proof Ollama is gone — on a swapping machine it means the box stalled, and ` +
      'treating it as an absence is exactly the reported false offline');
  assert.ok(/timeoutMs: _PING_TIMEOUT_MS/.test(loop),
    'the background re-check uses its own generous timeout — nobody is waiting on it');
  assert.ok(/last: \$\{f\.code/.test(loop),
    '⚠️ and the offline line NAMES the reason. The old message said only "unreachable", which is ' +
    'why the user could ask "why does that happen?" and nobody could answer.');
}
{
  // The ping itself records the reason, and clears it on success.
  const at = server.indexOf('function _pingOllama');
  const llm = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
  const pat = llm.indexOf('function _pingOllama');
  assert.ok(pat > -1, 'llm.js defines _pingOllama');
  let d = 0, i = llm.indexOf('{', pat);
  for (; i < llm.length; i++) { if (llm[i] === '{') d++; else if (llm[i] === '}') { d--; if (!d) { i++; break; } } }
  const fn = llm.slice(pat, i);
  assert.ok(/_lastPingFail = \{ code/.test(fn), 'a failed ping records its code and duration');
  assert.ok(/_lastPingFail = null; resolve\(true\)/.test(fn),
    '⚠️ and a SUCCESS clears it — a stale reason from an old failure would mislabel the next one');
  assert.ok(/fail\('TIMEOUT'\)/.test(fn), 'a timeout is recorded as TIMEOUT, distinct from a socket error');
  assert.ok(/opts && opts\.timeoutMs/.test(fn), 'the timeout is caller-settable');
  // Behaviour, not just shape: the real ping against a port with nothing on it must report
  // ECONNREFUSED rather than a timeout, or section 3's whole distinction is unusable.
  assert.ok(/lastPingFailure/.test(llm.slice(llm.indexOf('module.exports'))), 'and it is exported');
}
console.log('  a timeout and a refusal are recorded and treated differently: OK');

// ── 4. ⚠️ DRIVEN, not read: a dead port and a stalled port report DIFFERENT codes ───────────────
// Section 3 checks that the code branches on the reason. This checks the reason is actually right —
// which is the part the fix depends on, and which no regex can see. llm.js reads OLLAMA_HOST at
// load, so each case runs in its own child process.
async function behaviour() {
  const net = require('net');
  const { execFile } = require('child_process');

  // ⚠️ ASYNC. execFileSync blocks the parent's event loop, so the stub servers below could not
  // accept a connection while the child probed them — case (c) failed for exactly that reason and
  // looked like a broken ping. (a) and (b) passed only by accident: the kernel refuses a dead port
  // and completes a handshake into the backlog without the process running.
  const probe = (host) => new Promise((resolve, reject) => {
    execFile(process.execPath, ['-e', `
      const llm = require(${JSON.stringify(path.join(ROOT, 'llm.js'))});
      llm.ping({ timeoutMs: 700 }).then(ok => {
        console.log(JSON.stringify({ ok, fail: llm.lastPingFailure() }));
      });
    `], { env: { ...process.env, OLLAMA_HOST: host, LLM_BACKEND: 'ollama' } },
    (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(String(stdout).trim().split('\n').pop())); }
      catch (e) { reject(new Error('unparseable probe output: ' + stdout)); }
    });
  });

  // (a) Nothing listening → a REFUSAL. This is proof Ollama is gone.
  const dead = await new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => {
    const p = s.address().port; s.close(() => r(p)); }); });
  const refused = await probe(`http://127.0.0.1:${dead}`);
  assert.strictEqual(refused.ok, false, 'a dead port pings false');
  assert.strictEqual(refused.fail.code, 'ECONNREFUSED',
    `a dead port reports ECONNREFUSED, got ${refused.fail.code} — the whole hard/soft split rests on this`);

  // (b) Accepts the connection and never answers → a TIMEOUT. This is what a swapping machine looks
  // like, and it must NOT be mistaken for (a).
  const stall = net.createServer(sock => { /* accept, then say nothing at all */ });
  const stallPort = await new Promise(r => stall.listen(0, '127.0.0.1', () => r(stall.address().port)));
  try {
    const timedOut = await probe(`http://127.0.0.1:${stallPort}`);
    assert.strictEqual(timedOut.ok, false, 'a stalled server pings false too');
    assert.strictEqual(timedOut.fail.code, 'TIMEOUT',
      `a stalled server reports TIMEOUT, got ${timedOut.fail.code}`);
    // ⚠️ The point of the whole section: the two outcomes are DISTINGUISHABLE. If these ever became
    // the same code, the fix silently reverts to the reported behaviour with the tests still green.
    assert.notStrictEqual(timedOut.fail.code, refused.fail.code,
      'a stall and an absence are different observations');
    assert.ok(timedOut.fail.ms >= 600,
      `and the timeout really waited (${timedOut.fail.ms}ms of a 700ms budget)`);
  } finally { stall.close(); }

  // (c) A real, answering server clears the recorded failure.
  const http = require('http');
  const good = http.createServer((rq, rs) => { rs.writeHead(200, {'Content-Type':'application/json'}); rs.end('{"models":[]}'); });
  const goodPort = await new Promise(r => good.listen(0, '127.0.0.1', () => r(good.address().port)));
  try {
    const okRes = await probe(`http://127.0.0.1:${goodPort}`);
    assert.strictEqual(okRes.ok, true, 'a live server pings true');
    assert.strictEqual(okRes.fail, null, 'and clears any recorded failure');
  } finally { good.close(); }
  console.log('  behaviour: a refused port and a stalled port are told apart, and success clears: OK');
}

behaviour().then(() => {
  console.log('unit-storyboard-job: ALL PASSED');
}).catch(e => { console.error(e); process.exit(1); });

