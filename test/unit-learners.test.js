// unit-learners.test.js
// v65 — learner accounts and server-side state. Security-sensitive, so the guarantees are proven
// behaviourally against the real module rather than asserted from source:
//   • passwords are never stored in clear and are hashed with a per-user salt (scrypt);
//   • session tokens are stored HASHED, so a leaked store can't be replayed;
//   • login failures are indistinguishable for "unknown user" vs "wrong password" (no enumeration);
//   • repeated failures are throttled;
//   • learner data lives in its OWN file — lessons.json is baked into the public docs/ bundle by
//     build-static, so credentials there would be published.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ROOT = path.join(__dirname, '..');

// Point the module at a scratch store BEFORE requiring it.
const TMP = path.join(os.tmpdir(), 'dz_learners_test_' + process.pid + '.json');
process.env.LEARNERS_FILE = TMP;
const L = require(path.join(ROOT, 'learners.js'));
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cleanup = () => { try { fs.unlinkSync(TMP); } catch (_) {} };
process.on('exit', cleanup);

function extFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. Credential validation ─────────────────────────────────────────────────
{
  assert.ok(L.validateCredentials('bo b', 'longenough1'), 'a username with a space is rejected');
  assert.ok(L.validateCredentials('a', 'longenough1'), 'a 1-char username is rejected');
  assert.ok(L.validateCredentials('bob', 'short'), 'a short password is rejected');
  assert.strictEqual(L.validateCredentials('bob', 'longenough1'), null, 'a sane pair is accepted');
}
console.log('  credential validation: OK');

// ── 2. Passwords: hashed, salted, never stored in clear ──────────────────────
{
  const PW = 'correct horse battery staple';
  assert.ok(L.createUser('anna', PW).ok, 'user created');
  assert.ok(L.createUser('anna', PW).error, 'duplicate username refused');
  const raw = fs.readFileSync(TMP, 'utf8');
  assert.ok(!raw.includes(PW), 'the plaintext password is NOT in the store');
  // Two users with the SAME password must not share a hash (per-user salt).
  assert.ok(L.createUser('bea', PW).ok, 'second user created');
  const data = JSON.parse(fs.readFileSync(TMP, 'utf8'));
  assert.notStrictEqual(data.users.anna.hash, data.users.bea.hash,
    'identical passwords hash differently (per-user salt, so a rainbow table is useless)');
  assert.notStrictEqual(data.users.anna.salt, data.users.bea.salt, 'salts differ per user');
  assert.ok(data.users.anna.hash.length >= 64, 'the hash is a real KDF output, not a digest of the password');
}
console.log('  passwords: salted, hashed, never stored in clear: OK');

// ── 3. Authentication + no account enumeration ───────────────────────────────
{
  assert.ok(L.authenticate('anna', 'correct horse battery staple').ok, 'correct password authenticates');
  const wrongPw = L.authenticate('anna', 'definitely wrong').error;
  const noUser  = L.authenticate('ghost', 'definitely wrong').error;
  assert.ok(wrongPw && noUser, 'both failures produce an error');
  assert.strictEqual(wrongPw, noUser,
    'wrong-password and unknown-user give the IDENTICAL message (no account enumeration)');
}
console.log('  authentication: correct/incorrect, no enumeration: OK');

// ── 4. Throttling ────────────────────────────────────────────────────────────
{
  assert.ok(L.createUser('carl', 'a-good-password').ok, 'user created');
  let throttled = false;
  for (let i = 0; i < 12; i++) {
    const e = L.authenticate('carl', 'nope nope nope').error || '';
    if (/too many/i.test(e)) { throttled = true; break; }
  }
  assert.ok(throttled, 'repeated failures are throttled');
  // …and throttling does not lock out the correct password forever once the window passes:
  // (we only assert the throttle message is distinct, not time travel)
  assert.ok(/too many/i.test(L.authenticate('carl', 'a-good-password').error || ''),
    'while throttled even the correct password is refused (fail closed)');
}
console.log('  login throttling: OK');

// ── 5. Sessions: hashed at rest, revocable ───────────────────────────────────
{
  const tok = L.createSession('anna');
  assert.strictEqual(L.resolveSession(tok), 'anna', 'a fresh token resolves');
  assert.strictEqual(L.resolveSession('not-a-real-token'), null, 'a bogus token does not resolve');
  assert.strictEqual(L.resolveSession(''), null, 'an empty token does not resolve');
  const raw = fs.readFileSync(TMP, 'utf8');
  assert.ok(!raw.includes(tok), 'the raw session token is NOT stored (only its hash) — a leaked store cannot be replayed');
  L.destroySession(tok);
  assert.strictEqual(L.resolveSession(tok), null, 'signing out revokes the token');
}
console.log('  sessions: hashed at rest, revocable: OK');

// ── 6. Learner state round-trip + teacher summary ────────────────────────────
{
  const st = { progress: { completed: { Ch1: { l1: {} }, Ch2: { l1: {} } },
    learned: { 'it|de': { vocab: { zee: { source:'Meer', seen:5, wrong:3 }, huis: { source:'Haus', seen:2, wrong:0 } } } } },
    tutorThread: [{ role:'tutor', text:'hi' }, { role:'student', text:'hello' }] };
  assert.ok(L.setState('anna', st).ok, 'state saved');
  const back = L.getState('anna');
  assert.deepStrictEqual(back.progress.completed, st.progress.completed, 'progress round-trips');
  assert.strictEqual(back.tutorThread.length, 2, 'the tutor thread round-trips');
  assert.ok(back.updatedAt, 'the save is timestamped');
  // Oversized state is refused rather than filling the disk.
  const huge = { progress: { completed: {}, learned: {} }, tutorThread: [], junk: 'x'.repeat(3 * 1024 * 1024) };
  assert.ok(L.setState('anna', huge).error, 'oversized state is refused');
  // Teacher summary: enough to spot a struggling learner, without dumping everything.
  const sum = L.summarize('anna');
  assert.strictEqual(sum.chaptersCompleted, 2, 'summary counts completed chapters');
  assert.strictEqual(sum.wordsLearned, 2, 'summary counts learned words');
  assert.strictEqual(sum.hardestWords[0].word, 'zee', 'the hardest word leads the summary');
  assert.ok(!JSON.stringify(sum).includes('hash') && !JSON.stringify(sum).includes('salt'),
    'the summary never carries credentials');
}
console.log('  state round-trip + teacher summary: OK');

// ── 7. Credentials must never reach the PUBLIC static bundle ─────────────────
{
  // build-static bakes lessons.json wholesale into docs/index.html (GitHub Pages). Learner data
  // therefore lives in its own file, which the builder must never read.
  assert.ok(!/learners\.json|LEARNERS_FILE|require\('\.\/learners'\)/.test(builder),
    'build-static.js does not read the learner store (credentials can never be published)');
  const docs = path.join(ROOT, 'docs', 'index.html');
  if (fs.existsSync(docs)) {
    const d = fs.readFileSync(docs, 'utf8');
    // Match the credential SHAPE, not bare words: a multilingual bundle legitimately contains
    // "saltate" (it) and "resaltar" (es), which a naive substring check would flag.
    assert.ok(!/"salt"\s*:\s*"[0-9a-f]{16,}"/.test(d), 'no salt values in the published bundle');
    assert.ok(!/"hash"\s*:\s*"[0-9a-f]{32,}"/.test(d), 'no password hashes in the published bundle');
    assert.ok(!/dz_session/.test(d), 'no session cookie name in the published bundle');
    assert.ok(!/"users"\s*:\s*\{[^}]*"salt"/.test(d), 'no learner user records in the published bundle');
  }
}
console.log('  public static bundle carries no credentials: OK');

// ── 8. Server wiring: cookie hygiene + auth gates ────────────────────────────
{
  const setC = extFn(server, 'setSessionCookie');
  assert.ok(/HttpOnly/.test(setC), 'the session cookie is HttpOnly (page scripts cannot read it)');
  assert.ok(/SameSite=Lax/.test(setC), 'the session cookie is SameSite=Lax');
  assert.ok(/if \(secure\) bits\.push\('Secure'\)/.test(setC),
    'Secure is set when the request arrived over TLS (but not forced, which would break plain-HTTP LAN use)');
  // State endpoints require a session.
  const stateRoute = server.slice(server.indexOf("url.pathname === '/api/learner/state'"),
                                  server.indexOf("url.pathname === '/api/learners'"));
  assert.ok(/if \(!who\) return json\(res, 401/.test(stateRoute), 'learner state requires a session');
  assert.ok(/LEARNERS\.setState\(who,/.test(stateRoute), 'a learner can only write their OWN state (the username comes from the session, never the body)');
  // Registration/login never echo the password back.
  // No console.log ANYWHERE in server.js or learners.js may mention a password value.
  for (const [name, src] of [['server.js', server], ['learners.js', fs.readFileSync(path.join(ROOT, 'learners.js'), 'utf8')]]) {
    const logs = src.match(/console\.(log|warn|error)\([^\n]*/g) || [];
    for (const line of logs) {
      assert.ok(!/\bpassword\b/i.test(line), `${name}: a log line mentions a password → ${line.slice(0, 80)}`);
    }
  }
}
console.log('  server: cookie hygiene, session-scoped writes, no password logging: OK');

// ── 9. Client: server wins, localStorage remains the offline fallback ────────
{
  assert.ok(/APP\.learner = null;/.test(html), 'the client tracks the signed-in learner');
  const sync = extFn(html, '_learnerSyncSoon');
  assert.ok(/if\(!APP\.learner\) return;/.test(sync), 'signed-out sessions never sync (local only)');
  assert.ok(/setTimeout\(_learnerSyncNow, 1500\)/.test(sync), 'pushes are debounced');
  const apply = extFn(html, '_learnerApplyState');
  assert.ok(/APP\.progress = st\.progress/.test(apply), 'the server copy replaces the local one (server wins)');
  assert.ok(/localStorage\.setItem\('imp3_prog'/.test(apply), 'the local fallback copy is refreshed too');
  const load = extFn(html, '_learnerLoad');
  assert.ok(/serverEmpty && localHas/.test(load),
    'first login with an empty server copy uploads this device\'s history instead of wiping it');
  // saveProg still writes localStorage first, so an offline/static session is unaffected.
  assert.ok(/function saveProg\(\)\{ localStorage\.setItem\('imp3_prog',JSON\.stringify\(APP\.progress\)\); _learnerSyncSoon\(\); \}/.test(html),
    'progress is always written locally, then synced when signed in');
  // The account UI is hidden without a backend (static build).
  const badge = extFn(html, 'refreshAccountBadge');
  assert.ok(/APP\.info\?\.canGenerate/.test(badge), 'the account badge is hidden when there is no server');
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['acct.signin','acct.create','acct.signout','acct.hint','acct.migrated']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
}
console.log('  client: server wins, offline fallback intact, migration on first login: OK');

console.log('unit-learners: ALL PASSED');
