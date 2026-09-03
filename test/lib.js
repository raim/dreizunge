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

// ── v88_al: POST a route that now answers 202 + {jobId}, and wait for its result ─────────────────
// The five formerly-blocking LLM routes (`/api/retranslate-story`, `/api/storyline-title`,
// `/api/storyline-summary`, `/api/storyline-retitle`, `/api/writing-feedback`) became cancellable
// jobs, so the payload arrives as the job's `data` rather than in the response body. This is the
// test-side mirror of the client's own `_jobAwait`.
//
// Deliberately shaped to return `{ status, body }` like `post` does, with the job's data AS the
// body — so an existing assertion about the payload keeps working unchanged, and only the
// *mechanism* moved. A response that is NOT a job (a 400/404/503 from validation, which stays
// outside the job on purpose) is handed straight back, so status-code assertions are untouched too.
async function postJob(port, p, o, timeoutMs = 30000) {
  const started = await req(port, 'POST', p, o);
  const jobId = started.body && started.body.jobId;
  if (!jobId) return started;                 // validation answer, or an unconverted route
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > timeoutMs) throw new Error('job ' + jobId + ' timed out on ' + p);
    await sleep(100);
    const st = await req(port, 'GET', '/api/job/' + jobId);
    const j = st.body || {};
    if (j.status === 'done') return { status: 200, body: j.data || {}, jobId };
    if (j.status === 'error') return { status: 500, body: { error: j.error }, jobId };
    if (j.status === 'cancelled') return { status: 499, body: { cancelled: true }, jobId };
  }
}

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
// `extraEnv` (PLAN §7.0 CP5, v83_l): a plain object merged into the spawned server's env, AFTER the
// isolated file paths above so a caller could in principle override those too, but its actual
// purpose is for env-configurable inputs that do NOT get their own per-boot isolation by default
// (e.g. CURRICULUM_PLAN_FILE — a read-only, low-traffic lookup where the common case is "the file
// doesn't exist", so it is not worth every e2e test's boot() paying for a dedicated temp file the
// way UI_FILE/SKILLS_FILE/LESSONS_FILE do). Defaults to nothing extra, so every EXISTING caller is
// unaffected.
async function boot({ log = false, seed = null, extraEnv = null } = {}) {
  const storePath = tmpFile('dz_store', '.json');
  const logPath = log ? tmpFile('dz_chatlog', '.jsonl') : null;
  fs.writeFileSync(storePath, JSON.stringify(seed || { schemaVersion: 29, topics: [], storylines: [], flags: {}, progress: {} }));
  // Give the server its own ui.json copy so tests can edit it (hot-reload) without
  // touching the tracked repo file.
  const uiPath = tmpFile('dz_ui', '.json');
  fs.copyFileSync(path.join(ROOT, 'ui.json'), uiPath);
  // PLAN §8/B2 registry state is server-only, like learner state: every boot gets an isolated
  // file so a test cannot create canonical skills in the working tree or leak into another test.
  const skillsPath = tmpFile('dz_skills', '.json');
  fs.writeFileSync(skillsPath, JSON.stringify({ schemaVersion: 1, skills: [] }));

  const fake = await startFakeOllama(logPath);
  const sport = 30000 + (process.pid % 3000);
  const env = { ...process.env,
    OLLAMA_HOST: 'http://127.0.0.1:' + fake.port, OLLAMA_MODEL: 'fake',
    OLLAMA_LESSON_MODEL: 'fake', OLLAMA_TRANSLATION_MODEL: 'fake',
    LESSONS_FILE: storePath, UI_FILE: uiPath, SKILLS_FILE: skillsPath, PORT: String(sport),
    ...(extraEnv || {}) };
  const srv = cp.spawn('node', [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log_ = '';
  srv.stdout.on('data', d => log_ += d); srv.stderr.on('data', d => log_ += d);
  await waitPort(sport);

  return {
    sport, fport: fake.port, storePath, logPath, uiPath, skillsPath,
    srvlog: () => log_,
    readStore: () => JSON.parse(fs.readFileSync(storePath, 'utf8')),
    readChatLog: () => (logPath && fs.existsSync(logPath))
      ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
      : [],
    // v88_g (item AU): signal ONLY the server, leaving the fake Ollama alive and the chat log on
    // disk — `stop()` below tears both down, which makes it useless for observing what the server
    // does ON ITS WAY OUT. Additive; no existing caller is affected.
    stopServer: (sig) => { try { srv.kill(sig || 'SIGTERM'); } catch (_) {} },
    srvPid: srv.pid,
    stop: () => {
      try { srv.kill(); } catch (_) {}
      try { fake.child.kill(); } catch (_) {}
      try { fs.unlinkSync(storePath); } catch (_) {}
      try { fs.unlinkSync(uiPath); } catch (_) {}
      try { fs.unlinkSync(skillsPath); } catch (_) {}
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

module.exports = { ROOT, SERVER, FAKE, assert, sleep, req, get, post, postJob, waitPort,
  tmpFile, startFakeOllama, boot, waitBookJob };
