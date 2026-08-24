// unit-dreizunge-launcher.test.js
// bin/dreizunge — the PATH launcher installed by install.sh (README.md's "Option A"), user request:
// "install.sh installs a `dreizunge` command... starts the server and opens the browser." Discussed
// and deliberately deferred once ("not yet, just the message"), then built on direct request in the
// SAME conversation as v84_b's PWA work.
//
// Verified BEHAVIOURALLY, not just by source review: a scratch "checkout" with a STUB server.js (a
// real, tiny http server -- exercising the launcher's actual polling/exec logic, not a mock) is
// symlinked from a scratch "~/.local/bin", and the real script is invoked from an UNRELATED cwd, the
// same shape a real install would be used from every day.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'bin', 'dreizunge');
const src = fs.readFileSync(SCRIPT, 'utf8');

function mkScratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-launcher-'));
  const checkout = path.join(dir, 'checkout');
  fs.mkdirSync(path.join(checkout, 'bin'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(checkout, 'bin', 'dreizunge'));
  fs.chmodSync(path.join(checkout, 'bin', 'dreizunge'), 0o755);
  // A real, tiny HTTP server standing in for server.js -- answers /api/info like the real one,
  // and prints its own cwd so the test can prove the launcher actually cd'd to the checkout.
  fs.writeFileSync(path.join(checkout, 'server.js'), `
    const http = require('http');
    const port = process.env.PORT || 3000;
    http.createServer((req, res) => {
      if (req.url === '/api/info') { res.writeHead(200); return res.end('{}'); }
      res.writeHead(404); res.end();
    }).listen(port, () => { console.log('STUB cwd=' + process.cwd()); });
  `);
  const homeBin = path.join(dir, 'home', '.local', 'bin');
  fs.mkdirSync(homeBin, { recursive: true });
  const link = path.join(homeBin, 'dreizunge');
  fs.symlinkSync(path.join(checkout, 'bin', 'dreizunge'), link);
  return { dir, checkout, link };
}

// ── 1. Real POSIX sh syntax validity ──────────────────────────────────────
{
  assert.doesNotThrow(() => execFileSync('sh', ['-n', SCRIPT]),
    'sh -n must accept the script as valid POSIX sh');
}
console.log('  bin/dreizunge: valid POSIX sh syntax: OK');

// ── 2. Executable, correct shebang ────────────────────────────────────────
{
  const stat = fs.statSync(SCRIPT);
  assert.ok(stat.mode & 0o111, 'bin/dreizunge must be executable (chmod +x)');
  assert.ok(src.startsWith('#!/bin/sh'), 'shebang names /bin/sh -- POSIX only, no bash-isms');
}
console.log('  bin/dreizunge: executable, correct shebang: OK');

// ── 3. --help and unknown-option handling (real invocations) ─────────────
{
  const help = execFileSync(SCRIPT, ['--help'], { encoding: 'utf8' });
  assert.ok(/Usage: dreizunge/.test(help), '--help prints usage');
  assert.ok(/--no-browser/.test(help), 'usage documents --no-browser');

  let threw = null;
  try { execFileSync(SCRIPT, ['--bogus'], { stdio: 'pipe' }); }
  catch (e) { threw = e; }
  assert.ok(threw, 'an unknown option exits non-zero');
  assert.strictEqual(threw.status, 1, 'unknown option exits 1');
  assert.ok(/Unknown option/.test(threw.stderr.toString()), 'unknown option names itself on stderr');
}
console.log('  bin/dreizunge: --help and unknown-option rejection: OK');

// ── 4. A launcher whose server.js is missing fails with a clear message ──
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-launcher-orphan-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'bin', 'dreizunge'));
  fs.chmodSync(path.join(dir, 'bin', 'dreizunge'), 0o755);
  let threw = null;
  try { execFileSync(path.join(dir, 'bin', 'dreizunge'), ['--no-browser'], { stdio: 'pipe' }); }
  catch (e) { threw = e; }
  assert.ok(threw, 'missing server.js exits non-zero rather than doing something undefined');
  assert.ok(/could not find server\.js/.test(threw.stderr.toString()), 'the error names what is missing');
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('  bin/dreizunge: a missing server.js fails clearly, not silently: OK');

// ── 5. Real end-to-end run: symlink resolution + cwd + --no-browser ──────
(async () => {
  const s = mkScratch();
  try {
    const port = 34000 + (process.pid % 3000);
    const child = spawn(s.link, ['--no-browser'], {
      cwd: os.tmpdir(),   // invoked from an UNRELATED cwd, same as a real shell session would
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const t0 = Date.now();
    while (!out.includes('STUB cwd=') && Date.now() - t0 < 8000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(out.includes('STUB cwd=' + s.checkout),
      `the launcher, invoked from ${os.tmpdir()} via a symlink at ${s.link}, must resolve back to and cd into the real checkout (${s.checkout}) -- got: ${out}`);
    child.kill();
  } finally {
    fs.rmSync(s.dir, { recursive: true, force: true });
  }
  console.log('  bin/dreizunge: real run via a symlinked ~/.local/bin resolves back to the checkout and cds there: OK');
  console.log('unit-dreizunge-launcher: ALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
