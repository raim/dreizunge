// Shared helpers for the Dreizunge headless test suite.
// All paths are resolved relative to this file, so the suite runs from any checkout.
const http = require('http');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server.js');
const FAKE = path.join(__dirname, 'fake-ollama.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Minimal JSON HTTP client.
function req(port, method, p, obj) {
  return new Promise((resolve, reject) => {
    const data = obj != null ? JSON.stringify(obj) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: p,
        headers: { 'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } },
      res => { let d = ''; res.on('data', c => d += c);
        res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (_) {}
          resolve({ status: res.statusCode, body: j, raw: d }); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const get = (port, p) => req(port, 'GET', p);
const post = (port, p, o) => req(port, 'POST', p, o);

function waitPort(port, ms = 10000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    (function tick() {
      const r = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/api/info' },
        res => { res.resume(); resolve(); });
      r.on('error', () => { if (Date.now() - t0 > ms) reject(new Error('server boot timeout'));
        else setTimeout(tick, 150); });
      r.end();
    })();
  });
}

function tmpFile(prefix, ext) {
  return path.join(os.tmpdir(), `${prefix}_${process.pid}_${Date.now()}${ext || ''}`);
}

// Spawn the instrumented fake Ollama and return its port + child handle.
async function startFakeOllama(logPath) {
  const env = { ...process.env };
  if (logPath) env.FAKE_LOG = logPath;
  const child = cp.spawn('node', [FAKE, '0'], { stdio: ['ignore', 'pipe', 'pipe'], env });
  const port = await new Promise((resolve, reject) => {
    let buf = '';
    child.stdout.on('data', d => { buf += d; const m = /FAKE_OLLAMA_PORT=(\d+)/.exec(buf); if (m) resolve(parseInt(m[1], 10)); });
    child.stderr.on('data', d => process.stderr.write('[fake] ' + d));
    setTimeout(() => reject(new Error('fake ollama boot timeout')), 5000);
  });
  return { port, child };
}

// Boot fake Ollama + the real server against a fresh temp store.
// Returns { sport, fport, storePath, logPath, srvlog(), stop() }.
async function boot({ log = false, seed = null } = {}) {
  const storePath = tmpFile('dz_store', '.json');
  const logPath = log ? tmpFile('dz_chatlog', '.jsonl') : null;
  fs.writeFileSync(storePath, JSON.stringify(seed || { schemaVersion: 29, topics: [], storylines: [], flags: {}, progress: {} }));

  const fake = await startFakeOllama(logPath);
  const sport = 30000 + (process.pid % 3000);
  const env = { ...process.env,
    OLLAMA_HOST: 'http://127.0.0.1:' + fake.port, OLLAMA_MODEL: 'fake',
    OLLAMA_LESSON_MODEL: 'fake', OLLAMA_TRANSLATION_MODEL: 'fake',
    LESSONS_FILE: storePath, PORT: String(sport) };
  const srv = cp.spawn('node', [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log_ = '';
  srv.stdout.on('data', d => log_ += d); srv.stderr.on('data', d => log_ += d);
  await waitPort(sport);

  return {
    sport, fport: fake.port, storePath, logPath,
    srvlog: () => log_,
    readStore: () => JSON.parse(fs.readFileSync(storePath, 'utf8')),
    readChatLog: () => (logPath && fs.existsSync(logPath))
      ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
      : [],
    stop: () => {
      try { srv.kill(); } catch (_) {}
      try { fake.child.kill(); } catch (_) {}
      try { fs.unlinkSync(storePath); } catch (_) {}
      try { if (logPath) fs.unlinkSync(logPath); } catch (_) {}
    },
  };
}

// Poll a book job to completion. Returns the final status object.
async function waitBookJob(sport, bookId, { timeoutMs = 60000, intervalMs = 400 } = {}) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutMs) {
    await sleep(intervalMs);
    const st = await get(sport, '/api/book-job/' + encodeURIComponent(bookId));
    last = st.body;
    if (last && ['done', 'error', 'cancelled'].includes(last.status)) return last;
  }
  return last;
}

module.exports = { ROOT, SERVER, FAKE, assert, sleep, req, get, post, waitPort,
  tmpFile, startFakeOllama, boot, waitBookJob };
