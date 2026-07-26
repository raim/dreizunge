// e2e-tls-warning.test.js
// v70_b, behavioural half: drive the REAL server and check what it actually reports and logs.
// The unit test proves the predicates; this proves they are reached — that /api/info reflects the
// host THIS client used, and that a login over a LAN host produces the console warning.
'use strict';
const assert = require('assert');
const http = require('http');
const path = require('path');
const lib = require('./lib.js');

// Keep learner accounts out of the repo's store. boot() inherits process.env, so setting this
// before boot is enough (the same mechanism e2e-text-cleanup uses for FAKE_CLEAN_MODE).
process.env.LEARNERS_FILE = lib.tmpFile('dz_learners', '.json');

// lib.req() always sends the real Host; this test needs to control it, since the Host header is
// precisely the input under test.
function getWithHost(port, p, host) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method: 'GET', path: p, headers: { Host: host } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
        let j = null; try { j = JSON.parse(d); } catch (_) {}
        resolve({ status: res.statusCode, body: j }); }); });
    r.on('error', reject); r.end();
  });
}
function postWithHost(port, p, host, obj) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(obj || {});
    const r = http.request({ host: '127.0.0.1', port, method: 'POST', path: p,
      headers: { Host: host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => {
        let j = null; try { j = JSON.parse(d); } catch (_) {}
        resolve({ status: res.statusCode, body: j }); }); });
    r.on('error', reject); r.write(data); r.end();
  });
}

(async () => {
  const S = await lib.boot();
  try {
    // ── 1. Same server, same moment, two clients — the verdict is per-request ──
    const local = await getWithHost(S.sport, '/api/info', `localhost:${S.sport}`);
    assert.strictEqual(local.status, 200, '/api/info responds');
    assert.strictEqual(local.body.insecureTransport, false,
      'a loopback client is not warned (its traffic never leaves the machine)');

    const lan = await getWithHost(S.sport, '/api/info', `192.168.1.50:${S.sport}`);
    assert.strictEqual(lan.body.insecureTransport, true,
      'a LAN client over plain HTTP IS warned');

    const proxied = await new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: S.sport, method: 'GET', path: '/api/info',
        headers: { Host: '192.168.1.50', 'X-Forwarded-Proto': 'https' } },
        res => { let d = ''; res.on('data', c => d += c);
          res.on('end', () => resolve(JSON.parse(d))); });
      r.on('error', reject); r.end();
    });
    assert.strictEqual(proxied.insecureTransport, false,
      'TLS terminated at a proxy clears the warning — the documented remedy actually works');

    console.log('  /api/info insecureTransport: loopback=false LAN=true proxied-TLS=false');

    // ── 2. Registering over the LAN warns on the console ───────────────────────
    const reg = await postWithHost(S.sport, '/api/auth/register', `192.168.1.50:${S.sport}`,
      { username: 'lantester', password: 'correct-horse-battery' });
    assert.strictEqual(reg.status, 200, 'registration still SUCCEEDS — this is guidance, not a gate');
    assert.strictEqual(reg.body.username, 'lantester');

    const log = S.srvlog();
    assert.ok(/INSECURE TRANSPORT/.test(log), 'the server warned on the console');
    assert.ok(/192\.168\.1\.50/.test(log), 'the warning names the host that triggered it');
    assert.ok(/X-Forwarded-Proto|Caddy|nginx|proxy/i.test(log),
      'the warning points at a remedy rather than only raising alarm');

    // Latched: a second account over the LAN must not repeat the block.
    await postWithHost(S.sport, '/api/auth/register', `192.168.1.50:${S.sport}`,
      { username: 'lantester2', password: 'correct-horse-battery' });
    const hits = (S.srvlog().match(/INSECURE TRANSPORT/g) || []).length;
    assert.strictEqual(hits, 1, 'warned once per process, not once per request');

    console.log('  register over LAN: succeeded, warned once, warning names host + remedy');
    console.log('e2e-tls-warning: ALL PASSED');
  } finally {
    S.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
