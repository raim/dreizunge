// unit-langnames.test.js
// v76_c — `translate-ui.js --langnames` must issue a well-formed request and write what comes back.
//
// The v76_b version of this mode shipped broken and the user hit it on the first real run:
//   🌍 Russian (ru) — 2 name(s)… failed: Ollama: json: cannot unmarshal object into Go struct
//   field ChatRequest.model of type string
// It called `callLLM({ model, system, prompt, host })`. The real signature is POSITIONAL —
// `callLLM(model, system, userMsg, maxTokens, opts)` — and it returns `{ text, … }`, not a string.
// Both were invented rather than copied from `translateLang`, thirty lines above in the same file.
//
// It got through because the only exercise was `--langnames --check`, which never calls the model.
// A path that is only ever run in its no-op mode is not tested. This file runs the REAL mode with
// a stubbed backend, against a temp copy of the data, and asserts on the arguments the mode passes.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT } = require('./lib-dom');

// ── 1. callLLM rejects an options bag, with a message that names the fix ────────────────────
// The guard that turns this class of mistake from an Ollama struct error into an actionable one.
{
  const { callLLM } = require(path.join(ROOT, 'llm.js'));
  assert.throws(() => callLLM({ model: 'm', system: 's', prompt: 'p' }, 's', 'u', 10, {}),
    err => /positional/.test(err.message) && /callLLM\(MODEL, system/.test(err.message),
    'callLLM rejects an options object and says how to call it');
  assert.throws(() => callLLM('', 's', 'u', 10, {}), /non-empty string/,
    'and rejects an empty model name');
  // Non-vacuity: a well-formed call must NOT be rejected by the guard. It returns a promise that
  // will reject for lack of a backend — a different failure, and catching it is the point: what is
  // asserted is that the SYNCHRONOUS argument check let it through.
  let msg = '';
  try {
    const p = callLLM('some-model', 'sys', 'user', 128, {});
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { msg = e.message; }
  assert.ok(!/positional|non-empty string/.test(msg),
    'a correctly-shaped call passes the guard (otherwise the checks above pass trivially)');
}

// ── 2. The --langnames mode, run for real against a stub ────────────────────────────────────
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'langnames-'));
  // A tiny languages.json with exactly one hole, so the expected request is unambiguous.
  const langs = {
    en: { name: 'English', flag: '\u{1F1EC}\u{1F1E7}', tts: 'en-GB', names: { en: 'English', de: 'Englisch' } },
    de: { name: 'German',  flag: '\u{1F1E9}\u{1F1EA}', tts: 'de-DE', names: { en: 'German',  de: 'Deutsch'  } },
    sr: { name: 'Serbian', flag: '\u{1F1F7}\u{1F1F8}', tts: 'sr-RS', names: { en: 'Serbian' } },
  };
  fs.writeFileSync(path.join(tmp, 'languages.json'), JSON.stringify(langs, null, 2));
  fs.writeFileSync(path.join(tmp, 'ui.json'), JSON.stringify({ en: { 'a.b': 'x' } }, null, 2));
  for (const f of ['translate-ui.js', 'ui-qc.js']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  }
  // The stub records how it was called and answers plausibly, so the mode's own argument handling
  // is what is under test — not the network.
  fs.writeFileSync(path.join(tmp, 'llm.js'), `
    const fs = require('fs'), path = require('path');
    const LOG = path.join(__dirname, 'calls.json');
    function callLLM(model, system, userMsg, maxTokens, opts) {
      const calls = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
      calls.push({ modelType: typeof model, model, systemType: typeof system,
                   userMsgType: typeof userMsg, maxTokens, optsType: typeof opts, system, userMsg });
      fs.writeFileSync(LOG, JSON.stringify(calls));
      const asked = JSON.parse(userMsg);
      const out = {};
      for (const k of Object.keys(asked)) out[k] = 'NAME_' + k;
      return Promise.resolve({ text: JSON.stringify(out) });
    }
    module.exports = { callLLM, ping: () => Promise.resolve(true),
                       extractJSON: (s) => JSON.parse(s) };
  `);

  execFileSync(process.execPath, ['translate-ui.js', '--langnames'],
               { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });

  const calls = JSON.parse(fs.readFileSync(path.join(tmp, 'calls.json'), 'utf8'));
  assert.ok(calls.length > 0, 'the mode actually called the backend (non-vacuity for everything below)');
  for (const c of calls) {
    // The exact defect the user hit: an object where a string belongs.
    assert.strictEqual(c.modelType, 'string',
      'callLLM receives the model as a STRING — an object here is the v76_b bug');
    assert.strictEqual(c.systemType, 'string', 'system prompt is a string');
    assert.strictEqual(c.userMsgType, 'string', 'user message is a string');
    assert.strictEqual(typeof c.maxTokens, 'number', 'maxTokens is a number, in the 4th position');
    assert.doesNotThrow(() => JSON.parse(c.userMsg), 'the user message is the JSON payload');
  }

  // …and the response was actually consumed. `raw.text` vs `raw` was the second half of the bug:
  // reading the wrong property throws inside the retry loop and every name is silently dropped.
  const after = JSON.parse(fs.readFileSync(path.join(tmp, 'languages.json'), 'utf8'));
  assert.strictEqual(after.sr.names.de, 'NAME_sr',
    'the returned name was written — reading the wrong property on the result would leave this empty');
  assert.strictEqual(after.en.names.sr, 'NAME_en', 'and the reverse cell too');
  // Nothing pre-existing was disturbed.
  assert.strictEqual(after.de.names.de, 'Deutsch', 'existing names are untouched');
  assert.strictEqual(after.sr.tts, 'sr-RS', 'and so is everything outside `names`');

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── 3. v76_f — progress is written after EVERY batch, not once at the end ───────────────────
// User-reported: "the entries seem to not be stored until finished". The mode collected every
// language into memory and wrote languages.json once, after the loop — so an interrupted run
// (Ctrl-C, a backend timeout, a crash) threw away everything it had already earned. The ui.json
// path in the same file has saved per batch all along.
//
// Measured by killing the run mid-way: the stub answers the first language and then hard-exits the
// process on the second. Whatever the first batch earned must already be on disk.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'langnames-partial-'));
  // Three UI-language columns to fill, so there is a "first batch" and a "later batch".
  const langs = {
    en: { name: 'English', flag: '\u{1F1EC}\u{1F1E7}', tts: 'en-GB', names: { en: 'English' } },
    de: { name: 'German',  flag: '\u{1F1E9}\u{1F1EA}', tts: 'de-DE', names: { en: 'German'  } },
    sr: { name: 'Serbian', flag: '\u{1F1F7}\u{1F1F8}', tts: 'sr-RS', names: { en: 'Serbian' } },
  };
  fs.writeFileSync(path.join(tmp, 'languages.json'), JSON.stringify(langs, null, 2));
  fs.writeFileSync(path.join(tmp, 'ui.json'), JSON.stringify({ en: { 'a.b': 'x' } }, null, 2));
  for (const f of ['translate-ui.js', 'ui-qc.js']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  }
  // Answers the first call, then aborts the process on the second — standing in for any
  // interruption. process.exit skips every after-the-loop write by construction.
  fs.writeFileSync(path.join(tmp, 'llm.js'), `
    const fs = require('fs'), path = require('path');
    const N = path.join(__dirname, 'n.txt');
    function callLLM(model, system, userMsg, maxTokens, opts) {
      const n = (fs.existsSync(N) ? Number(fs.readFileSync(N, 'utf8')) : 0) + 1;
      fs.writeFileSync(N, String(n));
      if (n > 1) process.exit(9);            // interrupted, mid-run
      const asked = JSON.parse(userMsg);
      const out = {};
      for (const k of Object.keys(asked)) out[k] = 'NAME_' + k;
      return Promise.resolve({ text: JSON.stringify(out) });
    }
    module.exports = { callLLM, ping: () => Promise.resolve(true),
                       extractJSON: (s) => JSON.parse(s) };
  `);

  let exitCode = 0;
  try {
    execFileSync(process.execPath, ['translate-ui.js', '--langnames'],
                 { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) { exitCode = e.status; }
  assert.strictEqual(exitCode, 9,
    'the run really was interrupted mid-way (non-vacuity: if it completed normally this section '
    + 'would be testing the end-of-run write it exists to replace)');

  const calls = Number(fs.readFileSync(path.join(tmp, 'n.txt'), 'utf8'));
  assert.ok(calls >= 2, `more than one batch was attempted (got ${calls})`);

  const after = JSON.parse(fs.readFileSync(path.join(tmp, 'languages.json'), 'utf8'));
  const written = Object.keys(after).filter(c => Object.values(after[c].names || {}).some(v => /^NAME_/.test(v)));
  assert.ok(written.length > 0,
    'the names earned BEFORE the interruption are on disk — this is the whole report: with a '
    + 'single write after the loop, an interrupted run leaves languages.json untouched');
  // The file must still be valid and structurally intact after a partial write.
  assert.strictEqual(after.sr.tts, 'sr-RS', 'the partially-written file keeps everything outside `names`');
  assert.strictEqual(after.en.names.en, 'English', 'and its pre-existing names');

  fs.rmSync(tmp, { recursive: true, force: true });
}

// ── 4. v78_c — a REJECTED name must be reported, not crash the run ──────────────────────────
// User-reported, on a real run:
//     🌍 Lëtzebuergesch (lb) — 31 name(s)… Fatal: issues.some is not a function
// `isBlocking` takes the whole issues ARRAY (`issues => issues.some(i => i.severity === 'error')`).
// The call site passed it as a predicate — `issues.some(isBlocking)` — so it received one issue
// OBJECT per invocation and evaluated `issue.some(...)`.
//
// Why every earlier run and every earlier assertion missed it: on the happy path `issues` is EMPTY,
// and `[].some(fn)` never invokes `fn`. The defect is unreachable until a name is actually
// rejected — the same shape as v76_c, where this mode shipped broken because only its no-op
// `--check` path had ever been exercised. So the section below forces a rejection.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'langnames-reject-'));
  const langs = {
    en: { name: 'English', flag: '\u{1F1EC}\u{1F1E7}', tts: 'en-GB', names: { en: 'English' } },
    de: { name: 'German',  flag: '\u{1F1E9}\u{1F1EA}', tts: 'de-DE', names: { en: 'German'  } },
    sr: { name: 'Serbian', flag: '\u{1F1F7}\u{1F1F8}', tts: 'sr-RS', names: { en: 'Serbian' } },
  };
  fs.writeFileSync(path.join(tmp, 'languages.json'), JSON.stringify(langs, null, 2));
  fs.writeFileSync(path.join(tmp, 'ui.json'), JSON.stringify({ en: { 'a.b': 'x' } }, null, 2));
  for (const f of ['translate-ui.js', 'ui-qc.js']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));

  // The model answers with an EMPTY string for `de` — the exact input validateEntry flags as a
  // blocking `empty` issue, and the only thing needed to reach the crash. `sr` is answered well, so
  // the run has both a rejection and a success and cannot pass by rejecting everything.
  fs.writeFileSync(path.join(tmp, 'llm.js'), `
    function callLLM(model, system, userMsg, maxTokens, opts) {
      const asked = JSON.parse(userMsg);
      const out = {};
      for (const k of Object.keys(asked)) out[k] = (k === 'de') ? '' : ('NAME_' + k);
      return Promise.resolve({ text: JSON.stringify(out) });
    }
    module.exports = { callLLM, ping: () => Promise.resolve(true),
                       extractJSON: (s) => JSON.parse(s) };
  `);

  // The payload assertion is simply that this RETURNS. execFileSync throws on a non-zero exit, and
  // before the fix the run died on the first rejected cell.
  let out = '';
  assert.doesNotThrow(() => {
    out = execFileSync(process.execPath, ['translate-ui.js', '--langnames'],
                       { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });
  }, 'a rejected name does not crash the run (v78_c: "issues.some is not a function")');
  assert.ok(!/is not a function/.test(out), 'and the crash message does not appear in the output');

  // The rejection was REPORTED rather than silently swallowed — the mode prints "N rejected (codes)".
  assert.ok(/rejected/.test(out), 'the rejected cell is reported to the operator');

  // …and the good cells still landed. Without this the section would pass on a run that gave up
  // entirely, which is the failure it exists to distinguish from. Note the axis: the stub answers
  // badly for the language CODE `de`, so it is `de.names[*]` that must stay unwritten — every
  // other code's cells are filled normally in the same batches.
  const after = JSON.parse(fs.readFileSync(path.join(tmp, 'languages.json'), 'utf8'));
  assert.strictEqual(after.de.names.de, undefined,
    'the empty name was NOT written (a rejection must reject)');
  assert.strictEqual(after.de.names.sr, undefined,
    'and it is rejected in every batch, not just the first');
  assert.strictEqual(after.de.names.en, 'German', 'the pre-existing cell is untouched');
  assert.strictEqual(after.sr.names.de, 'NAME_sr',
    'a valid name in the SAME batch was still written — the run continued past the rejection');
  assert.strictEqual(after.en.names.sr, 'NAME_en', 'and later batches ran at all');

  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('  callLLM rejects an options bag and names the positional signature');
console.log('  --langnames issues a well-formed call and writes the response into languages.json');
console.log('  --langnames persists after every batch: an interrupted run keeps what it earned');
console.log('  --langnames reports a rejected name and keeps going (v78_c)');
console.log('unit-langnames: ALL PASSED');

// ── v78_j — `--batch` and `--threads` are settable on the command line ──────
// User: "allow to set number of threads also via commandline in translate-ui. if not yet available,
// also allow to set the size for individual batches (current default 10 per batch). Goal is that we
// can more efficiently integrate completely new lessons."
//
// `setNumThread` existed in llm.js since v71_q but only the model MENU ever called it — a batch
// translation run had no way to set either value. The flag wins over the env var, matching every
// other override here (`--model` over OLLAMA_MODEL).
{
  const src = fs.readFileSync(path.join(ROOT, 'translate-ui.js'), 'utf8');
  assert.ok(/_flagInt\('--batch'\)\s*\|\|\s*parseInt\(process\.env\.BATCH_SIZE/.test(src),
    '--batch overrides BATCH_SIZE, and the env var still works as a fallback');
  assert.ok(/_flagInt\('--threads'\)/.test(src), '--threads is parsed');
  assert.ok(/setNumThread\(NUM_THREADS\)/.test(src),
    'and is actually applied through llm.js rather than parsed and dropped');

  // Behavioural: the batch size really drives the loop. Two runs over the same missing keys with
  // different --batch values must issue a different NUMBER of model calls — otherwise the flag is
  // decoration. Driven through the real script with a counting stub.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'batchflag-'));
  const en = {}; for (let i = 0; i < 20; i++) en['k.' + i] = 'value ' + i;
  fs.writeFileSync(path.join(tmp, 'ui.json'), JSON.stringify({ en, de: {} }, null, 2));
  fs.writeFileSync(path.join(tmp, 'languages.json'), JSON.stringify({
    en: { name: 'English', flag: '\u{1F1EC}\u{1F1E7}', tts: 'en-GB', names: { en: 'English' } },
    de: { name: 'German',  flag: '\u{1F1E9}\u{1F1EA}', tts: 'de-DE', names: { en: 'German' } },
  }, null, 2));
  for (const f of ['translate-ui.js', 'ui-qc.js']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.writeFileSync(path.join(tmp, 'llm.js'), `
    let calls = 0;
    function callLLM(model, system, userMsg, maxTokens, opts) {
      calls++;
      const asked = JSON.parse(userMsg);
      const out = {};
      for (const k of Object.keys(asked)) out[k] = 'X ' + k;
      process.stderr.write('CALL\\n');
      return Promise.resolve({ text: JSON.stringify(out) });
    }
    module.exports = { callLLM, ping: () => Promise.resolve(true),
                       extractJSON: (s) => JSON.parse(s), setNumThread: () => {} };
  `);
  const runWith = (batch) => {
    const r = execFileSync(process.execPath, ['translate-ui.js', 'de', '--batch', String(batch)],
                           { cwd: tmp, encoding: 'utf8', stdio: 'pipe' });
    // restore the empty target so the second run has the same work to do
    const u = JSON.parse(fs.readFileSync(path.join(tmp, 'ui.json'), 'utf8'));
    u.de = {}; fs.writeFileSync(path.join(tmp, 'ui.json'), JSON.stringify(u, null, 2));
    return r;
  };
  const wide = runWith(20), narrow = runWith(5);
  const batchesIn = (s) => (s.match(/Batch \d+\/(\d+)/) || [])[1];
  assert.strictEqual(batchesIn(wide), '1', `--batch 20 sends 20 keys in one batch (got ${batchesIn(wide)})`);
  assert.strictEqual(batchesIn(narrow), '4', `--batch 5 splits 20 keys into 4 (got ${batchesIn(narrow)})`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('  --batch changes the real batch count (20 -> 1 batch, 5 -> 4); --threads reaches llm.js');
}
