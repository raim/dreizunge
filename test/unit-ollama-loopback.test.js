// unit-ollama-loopback.test.js — v90_l
//
// ⚠️ THE "⚠ Ollama unreachable" FLAPPING, FINALLY DIAGNOSED. Reported by the user across three
// releases and always blamed on wlan; `v89_af` made the ping tolerant of a stall and recorded
// honestly that its controlled wlan toggle did NOT reproduce the symptom, so the fix was untested
// against the real thing.
//
// The log that settled it, from a real book job:
//     ⚠ Ollama unreachable (2 checks, last: ECONNREFUSED after 2ms) — offline mode until it returns.
//     Translation failed: Ollama network: connect ECONNREFUSED ::1:11434
//
// `::1` is IPv6 loopback, and the refusal is 1-5ms — a LOCAL refusal, not a network timeout. Ollama
// binds 127.0.0.1 ONLY (measured with `ss -ltn` on the reporting machine), so any call that resolves
// `localhost` to `::1` is refused instantly. Which candidate the resolver returns first is exactly
// what changes when an interface goes up or down — hence "it happens when the wlan drops", and hence
// a clean wlan toggle not reproducing it.
//
// Measured on that machine: `::1:11434` → ECONNREFUSED in 6ms; `127.0.0.1:11434` → HTTP 200 in 3ms.
//
// The fix is to take name resolution out of the hot path. This file pins both halves of it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const llmSrc = fs.readFileSync(path.join(ROOT, 'llm.js'), 'utf8');
const srvSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── 1. The default is an IP LITERAL, in both files ──────────────────────────────────────────────
for (const [name, src] of [['llm.js', llmSrc], ['server.js', srvSrc]]) {
  const m = /const OLLAMA_HOST\s*=\s*process\.env\.OLLAMA_HOST\s*\|\|\s*'([^']+)'/.exec(src);
  assert.ok(m, `${name} defines a default OLLAMA_HOST`);
  const host = new URL(m[1]).hostname;
  assert.strictEqual(host, '127.0.0.1',
    `${name}'s default is the IPv4 literal — 'localhost' is a NAME, and resolving it is the bug`);
  assert.ok(!/localhost/.test(m[1]), `${name}: and says nothing about localhost`);
}

// ── 2. ⚠️ A loopback NAME still pins the address family ─────────────────────────────────────────
// An operator with OLLAMA_HOST=http://localhost:11434 in their shell profile must not fall back
// into the same trap through configuration. A REAL hostname is left alone: it may legitimately be
// IPv6-only, and forcing IPv4 there would break a working setup to fix one that is not in use.
{
  const decl = /const OLLAMA_FAMILY\s*=[^;]+;/.exec(llmSrc);
  assert.ok(decl, 'llm.js derives an address family from the configured host');
  const familyFor = new Function('URL', 'OLLAMA_HOST', decl[0] + '\nreturn OLLAMA_FAMILY;');
  assert.strictEqual(familyFor(URL, 'http://localhost:11434'), 4, 'localhost → pinned to IPv4');
  assert.strictEqual(familyFor(URL, 'http://LOCALHOST:11434'), 4, 'case-insensitively');
  assert.strictEqual(familyFor(URL, 'http://ip6-localhost:11434'), 4, 'and the ip6- alias too');
  assert.strictEqual(familyFor(URL, 'http://127.0.0.1:11434'), undefined,
    'an IP literal needs no pin — there is nothing to resolve');
  assert.strictEqual(familyFor(URL, 'http://ollama.lan:11434'), undefined,
    '⚠️ and a REAL host is left alone: it may be IPv6-only, and pinning would break it');
  assert.strictEqual(familyFor(URL, 'https://gpu-box.example.com:443'), undefined);
}

// ── 3. EVERY request site carries the pin ───────────────────────────────────────────────────────
// One unpinned site is enough to reproduce the whole symptom, because the ping and the generators
// are different call sites and the flapping came from the ping.
{
  const sites = llmSrc.match(/hostname:\s*u\.hostname/g) || [];
  const pinned = llmSrc.match(/hostname:\s*u\.hostname,\s*family:\s*OLLAMA_FAMILY/g) || [];
  assert.ok(sites.length >= 5, `llm.js has the request sites this claim is about (${sites.length})`);
  assert.strictEqual(pinned.length, sites.length,
    `every site that builds a request from the configured host pins the family ` +
    `(${pinned.length}/${sites.length}) — one unpinned site reproduces the whole symptom`);
}

// ── 4. ⚠️ THE FAILURE ITSELF, REPRODUCED — not merely described ─────────────────────────────────
// A server on IPv4 loopback only, exactly like Ollama. Connecting by IPv6 is refused FAST; that is
// the ECONNREFUSED-in-2ms from the user's log, and it is what the pin prevents.
(async () => {
  const http = require('http');
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end('{}'); });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  const port = srv.address().port;
  const attempt = (opts) => new Promise(res => {
    const t0 = Date.now();
    const req = http.request({ port, path: '/', method: 'GET', ...opts },
      r => { r.resume(); res({ ok: true, ms: Date.now() - t0 }); });
    req.on('error', e => res({ ok: false, code: e.code, ms: Date.now() - t0 }));
    req.setTimeout(4000, () => { req.destroy(); res({ ok: false, code: 'TIMEOUT', ms: Date.now() - t0 }); });
    req.end();
  });

  const v4 = await attempt({ hostname: '127.0.0.1' });
  assert.ok(v4.ok, 'the IPv4 literal reaches a server bound to IPv4 loopback');

  const v6 = await attempt({ hostname: '::1', family: 6 });
  assert.strictEqual(v6.ok, false, '⚠️ …and IPv6 loopback does NOT — this is the reported failure');
  assert.strictEqual(v6.code, 'ECONNREFUSED', 'refused, exactly as the log says');
  assert.ok(v6.ms < 1500,
    `and refused FAST (${v6.ms}ms) — a local refusal, which is why the log shows 1-5ms and not a ` +
    'network timeout. That timing is what ruled wlan out as the cause');

  // the pin makes a loopback NAME safe, whichever way the resolver is leaning
  const named = await attempt({ hostname: 'localhost', family: 4 });
  assert.ok(named.ok, 'with family 4 pinned, the NAME localhost reaches it too');

  await new Promise(res => srv.close(res));
  console.log(`  IPv4 ${v4.ms}ms OK · IPv6 ${v6.code} in ${v6.ms}ms · localhost+family4 OK`);
  console.log('  the ::1 refusal is reproduced, and the pin defeats it: OK');
  console.log('unit-ollama-loopback: ALL PASSED');
})();
