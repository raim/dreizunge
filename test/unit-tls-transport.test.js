// unit-tls-transport.test.js
// v70_b: warn when learner accounts are used over plain HTTP on a non-loopback host.
//
// Context: server.js binds 0.0.0.0, so the app is on the LAN as soon as it starts. learners.js
// protects credentials at rest (scrypt, hashed session tokens) but nothing protects the wire —
// over plain HTTP the password crosses in the login body and the 30-day session cookie crosses in
// every request header. This guards the predicates that decide when to say so, and the wiring that
// says it. It does NOT block insecure use: LAN-without-TLS is a supported deployment, which is the
// same reason the cookie's Secure flag stays conditional.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extract(name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > -1, `server.js defines ${name}()`);
  const b = src.indexOf('{', at); let d = 0, i = b;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const isLoopbackHost = new Function(extract('isLoopbackHost') + '\nreturn isLoopbackHost;')();
const isSecureRequest = new Function(extract('isSecureRequest') + '\nreturn isSecureRequest;')();
const transportInsecure = new Function(
  extract('isSecureRequest') + '\n' + extract('isLoopbackHost') + '\n' +
  extract('transportInsecure') + '\nreturn transportInsecure;')();

// ── 1. Loopback: HTTP there never touches a network interface ────────────────
for (const h of ['localhost', 'localhost:3000', 'LOCALHOST:8080', 'localhost.',
                 '127.0.0.1', '127.0.0.1:8080', '127.0.0.53', '127.1.2.3',
                 '::1', '[::1]', '[::1]:3000', '0:0:0:0:0:0:0:1'])
  assert.strictEqual(isLoopbackHost(h), true, `${h} is loopback`);

// ── 2. Everything else is a network, including the near-misses ───────────────
for (const h of ['192.168.1.50', '192.168.1.50:3000', '10.0.0.7', 'dreizunge.local',
                 'example.com', 'classroom-pi:8080', '[::2]', '128.0.0.1'])
  assert.strictEqual(isLoopbackHost(h), false, `${h} is NOT loopback`);

// A hostname that merely STARTS with a loopback literal is a different host entirely — the classic
// prefix-match hole. Anchoring is what stops `127.0.0.1.evil.com` reading as local.
assert.strictEqual(isLoopbackHost('127.0.0.1.evil.com'), false, 'suffixed host is not loopback');
assert.strictEqual(isLoopbackHost('notlocalhost'), false, 'substring is not a match');
assert.strictEqual(isLoopbackHost('localhost.evil.com'), false, 'subdomain of nothing is not local');

// No Host header at all: we cannot PROVE the request is local, so it counts as remote. A spurious
// warning costs a console line; a missed one costs a password.
assert.strictEqual(isLoopbackHost(''), false, 'missing host is treated as remote');
assert.strictEqual(isLoopbackHost(undefined), false, 'undefined host is treated as remote');

// ── 3. What counts as TLS ────────────────────────────────────────────────────
assert.strictEqual(isSecureRequest({ socket: { encrypted: true }, headers: {} }), true, 'direct TLS');
assert.strictEqual(isSecureRequest({ socket: {}, headers: {} }), false, 'plain socket');
assert.strictEqual(isSecureRequest({ headers: { 'x-forwarded-proto': 'https' } }), true, 'proxied TLS');
assert.strictEqual(isSecureRequest({ headers: { 'x-forwarded-proto': 'HTTPS' } }), true, 'case-insensitive');
assert.strictEqual(isSecureRequest({ headers: { 'x-forwarded-proto': 'https, http' } }), true,
  'first hop is the client-facing one');
// Deliberate tightening vs. the pre-v70_b inline expression, which used .includes('https') and so
// accepted a chain whose CLIENT-facing hop was plain http — reporting a clear-text request secure.
assert.strictEqual(isSecureRequest({ headers: { 'x-forwarded-proto': 'http, https' } }), false,
  'a later https hop does not make the client hop secure');
assert.strictEqual(isSecureRequest({ headers: {} }), false, 'no signal → not secure');
assert.strictEqual(isSecureRequest(undefined), false, 'no request object → not secure');

// ── 4. The combined condition ────────────────────────────────────────────────
assert.strictEqual(transportInsecure({ socket: {}, headers: { host: 'localhost:3000' } }), false,
  'plain HTTP on loopback is fine');
assert.strictEqual(transportInsecure({ socket: {}, headers: { host: '192.168.1.50:3000' } }), true,
  'plain HTTP on the LAN is the case we warn about');
assert.strictEqual(transportInsecure({ socket: { encrypted: true }, headers: { host: '192.168.1.50' } }), false,
  'TLS on the LAN is fine');
assert.strictEqual(transportInsecure({ socket: {}, headers: { host: '192.168.1.50', 'x-forwarded-proto': 'https' } }), false,
  'TLS terminated at a proxy is fine');

// ── 5. One definition of "secure", shared by the cookie and the warning ──────
// Two copies of this rule could disagree about whether a request is encrypted — the cookie would
// then be flagged Secure while the banner said otherwise, or worse, the reverse.
assert.ok(/const secure = isSecureRequest\(req\)/.test(src),
  'setSessionCookie uses the shared isSecureRequest()');
assert.ok(!/socket\.encrypted[\s\S]{0,80}x-forwarded-proto[\s\S]{0,40}includes\('https'\)/.test(src),
  'the old inline TLS expression is gone (no second definition to drift)');

// ── 6. Wiring: the flag reaches the client, the warning reaches the console ──
assert.ok(/insecureTransport: transportInsecure\(req\)/.test(src),
  '/api/info reports the per-request transport state');
const reg = src.indexOf("url.pathname === '/api/auth/register'");
const login = src.indexOf("url.pathname === '/api/auth/login'");
assert.ok(reg > -1 && login > -1, 'auth endpoints present');
assert.ok(/warnInsecureTransport\(req,/.test(src.slice(reg, reg + 400)), 'register warns');
assert.ok(/warnInsecureTransport\(req,/.test(src.slice(login, login + 400)), 'login warns');
// Before the credential check, not after: a FAILED login put the password on the wire too.
assert.ok(src.slice(login, login + 400).indexOf('warnInsecureTransport')
        < src.slice(login, login + 400).indexOf('LEARNERS.authenticate'),
  'the warning fires before authentication, since a failed attempt leaks the password too');
// Warned once per process — a warning repeated on every request is a warning nobody reads.
assert.strictEqual((src.match(/_tlsWarned = true/g) || []).length, 1, 'latched once per process');
assert.ok(/if \(_tlsWarned \|\| !transportInsecure\(req\)\) return;/.test(src),
  'the warning is latched AND conditional on the transport');

// ── 7. Client: the banner exists, is driven by the flag, and is localised ────
assert.ok(/id="acct-tls-warn"/.test(client), 'the banner element exists in the account modal');
assert.ok(/APP\.info\?\.insecureTransport/.test(client), 'the client reads the server flag');
assert.ok(/t\('acct\.insecure'\)/.test(client), 'the banner text is localised, not hardcoded English');
// Rendered where the password is typed. The modal is the only place a password is ever entered.
const modalAt = client.indexOf('id="acct-modal"');
const bannerAt = client.indexOf('id="acct-tls-warn"');
const signedOutAt = client.indexOf('id="acct-signedout"');
assert.ok(modalAt > -1 && bannerAt > modalAt && bannerAt < signedOutAt,
  'the banner sits inside the account modal, above the sign-in form');
// Guidance, never a gate: the sign-in handlers must not consult the flag.
const signIn = client.slice(client.indexOf('async function doSignIn'), client.indexOf('async function doSignIn') + 700);
assert.ok(!/insecureTransport/.test(signIn), 'sign-in is never blocked by the transport state');

// ── 8. i18n: English only, per the standing rule ─────────────────────────────
const ui = JSON.parse(fs.readFileSync(path.join(root, 'ui.json'), 'utf8'));
assert.ok('acct.insecure' in ui.en, 'acct.insecure exists in en');
// v71: the original form of this asserted the key was en-ONLY. That was the right rule while the
// key was new and untranslated — translate-ui.js fills MISSING keys and cannot detect English left
// sitting in another language, so a seeded copy would never be corrected. It is the WRONG rule once
// a real translation pass has run. The durable invariant is what it was always protecting: no other
// language may hold the English string verbatim.
const en = ui.en['acct.insecure'];
const untranslated = Object.keys(ui).filter(l => l !== 'en' && ui[l]['acct.insecure'] === en);
assert.deepStrictEqual(untranslated, [],
  'no language holds the English text of acct.insecure verbatim (translate-ui.js would never revisit it)');

console.log('  loopback/TLS predicates: 30 cases OK (incl. prefix-hole and proxy-chain)');
console.log('  one shared isSecureRequest(); warning latched once, before auth');
console.log('  banner in the account modal, localised, non-blocking');
console.log('unit-tls-transport: ALL PASSED');
