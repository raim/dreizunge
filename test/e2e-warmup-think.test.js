// e2e-warmup-think.test.js
// llm.js's warmup() also disables thinking (v83_r).
//
// Found live: making qwen3.6:35b-a3b (a reasoning model) README.md's own recommended default
// (v83_r) surfaced the v83_o "Ollama returned empty response" failure in a THIRD place — llm.js's
// own warmup() (called once at server startup to pre-warm the model) sent maxTokens:1 with no
// think:false, so a real end-to-end run of the updated install.sh logged "Warming up
// qwen3.6:35b-a3b… not ready (Ollama returned empty response) — continuing". It degrades gracefully
// (does not crash startup) but silently fails to do its one job.
//
// Checked at the HTTP layer, like the CP2 guard in unit-canonical-analysis.test.js (v83_o) — a
// source regex cannot prove opts actually reached the wire. Kept as its OWN e2e file (rather than a
// section inside unit-reasoning-model-safety.test.js) because it spawns a fake Ollama server via
// test/lib.js's startFakeOllama, and unit-run-summary.test.js (v70_b) asserts that any test doing
// so is registered inside run.js's `if (!quick)` block — folding it into that otherwise-static file
// would have made the WHOLE file a --quick straggler.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { startFakeOllama } = require('./lib.js');

(async () => {
  const logPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'warmup-think-')), 'chat.jsonl');
  const fake = await startFakeOllama(logPath);
  try {
    const scriptPath = path.join(path.dirname(logPath), 'run.js');
    fs.writeFileSync(scriptPath, `
      process.env.OLLAMA_HOST = 'http://127.0.0.1:${fake.port}';
      const { warmup } = require(${JSON.stringify(path.join(ROOT, 'llm.js'))});
      warmup('fake', () => {}).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
    `);
    execFileSync(process.execPath, [scriptPath], { cwd: ROOT, timeout: 20000 });
    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    assert.strictEqual(lines.length, 1, 'exactly one model call was made by warmup()');
    assert.strictEqual(lines[0].opts.think, false,
      `warmup() must send think:false on the wire — a reasoning model (e.g. the new default qwen3.6:35b-a3b) otherwise burns its 1-token budget reasoning, and warmup silently fails (got opts.think=${lines[0].opts.think})`);
  } finally {
    fake.child.kill();
    fs.rmSync(path.dirname(logPath), { recursive: true, force: true });
  }
  console.log('  llm.js warmup() sends think:false on the wire (v83_r): OK');
  console.log('e2e-warmup-think: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
