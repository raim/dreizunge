// learners.js — learner accounts and server-side learner state (v65).
//
// WHY A SEPARATE FILE FROM lessons.json: build-static.js bakes lessons.json wholesale into the
// public docs/ bundle (GitHub Pages). Putting credentials or a student's progress there would
// publish them. Learner data therefore lives in its own store that the static builder never reads.
//
// SECURITY POSTURE — read this before trusting it:
//   • Passwords are hashed with scrypt (node builtin, memory-hard) with a per-user random salt.
//     Plaintext passwords are never stored and never logged.
//   • Hash comparison is timing-safe.
//   • Sessions are 256-bit random tokens, delivered as HttpOnly + SameSite=Lax cookies, with an
//     expiry. Tokens are stored hashed, so a leaked store cannot be replayed as a live session.
//   • Failed logins are throttled per username.
//   • This does NOT provide transport security. On a LAN over plain HTTP, passwords travel in the
//     clear. Anyone exposing this beyond localhost should terminate TLS in front of it. Said plainly
//     because weak auth that feels strong is worse than none.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LEARNERS_FILE = process.env.LEARNERS_FILE || path.join(__dirname, 'learners.json');
const SCHEMA = 1;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;   // 30 days
const SCRYPT_KEYLEN = 64;
const MAX_FAILED = 8;                               // per username before a cooldown
const FAIL_WINDOW_MS = 1000 * 60 * 15;

let store = load();

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(LEARNERS_FILE, 'utf8'));
    if (d && typeof d === 'object' && d.users) return { schemaVersion: SCHEMA, users: d.users, sessions: d.sessions || {} };
  } catch (_) {}
  return { schemaVersion: SCHEMA, users: {}, sessions: {} };
}
function save() {
  try {
    fs.writeFileSync(LEARNERS_FILE, JSON.stringify(store, null, 2), 'utf8');
    // Best-effort: keep the credential store off other users' prying eyes on shared machines.
    try { fs.chmodSync(LEARNERS_FILE, 0o600); } catch (_) {}
  } catch (e) {
    console.error('Could not write learners.json:', e.message);
  }
}

// ── Passwords ────────────────────────────────────────────────────────────────
function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
}
function verifyPassword(password, salt, expectedHex) {
  const got = Buffer.from(hashPassword(password, salt), 'hex');
  const want = Buffer.from(String(expectedHex || ''), 'hex');
  // timingSafeEqual throws on length mismatch — compare lengths first, in constant-ish time terms
  // this is fine because the length of a stored hash is not secret.
  if (got.length !== want.length) return false;
  return crypto.timingSafeEqual(got, want);
}

// ── Validation ───────────────────────────────────────────────────────────────
// Deliberately conservative: the username becomes a store key and appears in the UI.
const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,32}$/;
function validateCredentials(username, password) {
  if (!USERNAME_RE.test(String(username || '')))
    return 'Username must be 2–32 characters: letters, digits, dot, dash or underscore.';
  if (String(password || '').length < 8)
    return 'Password must be at least 8 characters.';
  if (String(password).length > 200) return 'Password is too long.';
  return null;
}

// ── Users ────────────────────────────────────────────────────────────────────
function userExists(username) { return !!store.users[String(username)]; }
function listUsers() {
  return Object.entries(store.users).map(([name, u]) => ({
    username: name, createdAt: u.createdAt || null, lastSeen: u.lastSeen || null,
  }));
}
function createUser(username, password) {
  const bad = validateCredentials(username, password);
  if (bad) return { error: bad };
  if (userExists(username)) return { error: 'That username is taken.' };
  const salt = crypto.randomBytes(16).toString('hex');
  store.users[String(username)] = {
    salt, hash: hashPassword(password, salt),
    createdAt: new Date().toISOString(), lastSeen: null,
    failed: [],
    state: emptyState(),
  };
  save();
  return { ok: true, username: String(username) };
}
function emptyState() { return { progress: { completed: {}, learned: {} }, tutorThread: [], updatedAt: null }; }

// Throttle: a user with too many recent failures is refused until the window passes.
function _throttled(u) {
  const now = Date.now();
  u.failed = (u.failed || []).filter(ts => now - ts < FAIL_WINDOW_MS);
  return u.failed.length >= MAX_FAILED;
}
function authenticate(username, password) {
  const u = store.users[String(username)];
  // Same generic message whether the user is unknown or the password is wrong, so the endpoint
  // can't be used to enumerate accounts.
  const GENERIC = 'Wrong username or password.';
  if (!u) return { error: GENERIC };
  if (_throttled(u)) return { error: 'Too many failed attempts — wait a few minutes.' };
  if (!verifyPassword(password, u.salt, u.hash)) {
    u.failed = (u.failed || []).concat(Date.now()); save();
    return { error: GENERIC };
  }
  u.failed = []; u.lastSeen = new Date().toISOString(); save();
  return { ok: true, username: String(username) };
}
function changePassword(username, oldPassword, newPassword) {
  const u = store.users[String(username)];
  if (!u) return { error: 'No such user.' };
  if (!verifyPassword(oldPassword, u.salt, u.hash)) return { error: 'Current password is wrong.' };
  const bad = validateCredentials(username, newPassword);
  if (bad) return { error: bad };
  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(newPassword, u.salt);
  save();
  return { ok: true };
}

// ── Sessions ─────────────────────────────────────────────────────────────────
// The raw token goes to the browser; only its SHA-256 is stored, so a stolen learners.json cannot
// be replayed as a live session.
function _tokenHash(tok) { return crypto.createHash('sha256').update(String(tok)).digest('hex'); }
function createSession(username) {
  const token = crypto.randomBytes(32).toString('hex');
  store.sessions[_tokenHash(token)] = { username: String(username), expires: Date.now() + SESSION_TTL_MS };
  _pruneSessions(); save();
  return token;
}
function resolveSession(token) {
  if (!token) return null;
  const rec = store.sessions[_tokenHash(token)];
  if (!rec) return null;
  if (rec.expires < Date.now()) { delete store.sessions[_tokenHash(token)]; save(); return null; }
  return store.users[rec.username] ? rec.username : null;
}
function destroySession(token) {
  if (!token) return;
  const k = _tokenHash(token);
  if (store.sessions[k]) { delete store.sessions[k]; save(); }
}
function _pruneSessions() {
  const now = Date.now();
  for (const [k, v] of Object.entries(store.sessions)) if (!v || v.expires < now) delete store.sessions[k];
}

// ── Learner state ────────────────────────────────────────────────────────────
// The server is the source of truth (the user's choice); the client keeps a localStorage copy as an
// offline fallback. State is stored verbatim but SIZE-CAPPED, since it arrives from the client.
const MAX_STATE_BYTES = 2 * 1024 * 1024;
function getState(username) {
  const u = store.users[String(username)];
  if (!u) return null;
  return u.state || emptyState();
}
function setState(username, state) {
  const u = store.users[String(username)];
  if (!u) return { error: 'No such user.' };
  if (!state || typeof state !== 'object') return { error: 'Invalid state.' };
  const json = JSON.stringify(state);
  if (json.length > MAX_STATE_BYTES) return { error: 'Learner state too large.' };
  u.state = {
    progress: (state.progress && typeof state.progress === 'object') ? state.progress : { completed: {}, learned: {} },
    tutorThread: Array.isArray(state.tutorThread) ? state.tutorThread.slice(-60) : [],
    updatedAt: new Date().toISOString(),
  };
  u.lastSeen = new Date().toISOString();
  save();
  return { ok: true, updatedAt: u.state.updatedAt };
}

// A teacher-facing summary: enough to see who is struggling, without dumping the whole ledger.
function summarize(username) {
  const u = store.users[String(username)];
  if (!u) return null;
  const st = u.state || emptyState();
  const completed = Object.keys(st.progress?.completed || {}).length;
  let words = 0, struggling = [];
  for (const pair of Object.values(st.progress?.learned || {})) {
    const vocab = (pair && pair.vocab) || {};
    words += Object.keys(vocab).length;
    for (const [w, rec] of Object.entries(vocab)) if (rec && rec.wrong > 0) struggling.push({ word: w, wrong: rec.wrong });
  }
  struggling.sort((a, b) => b.wrong - a.wrong);
  return {
    username: String(username), createdAt: u.createdAt || null, lastSeen: u.lastSeen || null,
    chaptersCompleted: completed, wordsLearned: words,
    hardestWords: struggling.slice(0, 15), updatedAt: st.updatedAt || null,
  };
}

module.exports = {
  LEARNERS_FILE, validateCredentials, createUser, authenticate, changePassword,
  userExists, listUsers, createSession, resolveSession, destroySession,
  getState, setState, summarize, emptyState,
  // exported for tests
  _hashPassword: hashPassword, _verifyPassword: verifyPassword, _reload: () => { store = load(); },
};
