// unit-atomic-write.test.js — v89_ad.
//
// The flake audit's real finding. `unit-word-progress` and `unit-ui-journeys` carried a "known
// flake — buildExercises corpus-sampling randomness" label for many releases. Measured at this cut:
// 40/40 standalone each, 60/60 under seeded shuffles, 15/15 under 8-way CPU load. Clean every way
// except one — with `lessons.json` being rewritten underneath them, `unit-word-progress` failed
// 3 of 25 with `SyntaxError: Unterminated string in JSON`. The tests were never flaky; the WRITER
// was, and the same window truncates the file outright if the process dies mid-write.
//
// ⚠️ THIS FILE ASSERTS ON BEHAVIOUR, NOT ON CALL SITES. A regex over server.js for
// `writeFileAtomic(` would stay green if the helper itself stopped being atomic, which is the thing
// that actually matters. §1 races a real reader against a real writer on a real file.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { writeFileAtomic } = require(path.join(ROOT, 'atomic-write'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-atomic-'));
const cleanup = () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', cleanup);

// ── 1. ⚠️ A READER NEVER SEES A PREFIX — the property, raced for real ───────────────────────────
// Big enough that a bare writeFileSync is provably several write() calls (the real lessons.json is
// ~10MB). The reader loop runs while the writer churns; every read must parse.
{
  const file = path.join(TMP, 'store.json');
  const mk = (n) => JSON.stringify({ n, pad: 'x'.repeat(3 * 1024 * 1024) });
  fs.writeFileSync(file, mk(0));

  // The writer runs in its own process, so the race is genuine rather than cooperative scheduling.
  const writer = path.join(TMP, 'writer.js');
  fs.writeFileSync(writer, `
    const fs = require('fs');
    const { writeFileAtomic } = require(${JSON.stringify(path.join(ROOT, 'atomic-write'))});
    const mk = (n) => JSON.stringify({ n, pad: 'x'.repeat(3 * 1024 * 1024) });
    const atomic = process.argv[3] !== 'raw';
    let n = 0;
    const t = setInterval(() => {
      if (atomic) writeFileAtomic(process.argv[2], mk(++n));
      else fs.writeFileSync(process.argv[2], mk(++n), 'utf8');
    }, 5);
    setTimeout(() => { clearInterval(t); process.exit(0); }, 4000);
  `);

  const race = (mode) => {
    const { spawn } = require('child_process');
    const p = spawn(process.execPath, [writer, file, mode], { stdio: 'ignore' });
    const started = Date.now();
    let reads = 0, torn = 0;
    while (Date.now() - started < 3000) {
      reads++;
      try { JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (_) { torn++; }
    }
    try { p.kill('SIGKILL'); } catch (_) {}
    return { reads, torn };
  };

  const atomic = race('atomic');
  assert.ok(atomic.reads > 50, `the race really ran (${atomic.reads} reads)`);
  assert.strictEqual(atomic.torn, 0,
    `⚠️ an atomic writer must never expose a partial file — saw ${atomic.torn} torn reads of ` +
    `${atomic.reads}. This is the whole point of the module.`);

  // ⚠️ NON-VACUITY, and it is essential: without it a filesystem that happened to make every read
  // succeed would pass §1 while proving nothing. The OLD writer must actually be caught here.
  const raw = race('raw');
  assert.ok(raw.torn > 0,
    `the harness can DETECT a torn read — a bare writeFileSync produced ${raw.torn} of ${raw.reads}. ` +
    'If this is 0, section 1 above is vacuous and the machine is too fast to race; raise the payload.');
  fs.rmSync(file, { force: true });
}
console.log('  a concurrent reader never observes a partial file, and the old writer is caught: OK');

// ── 2. The target is untouched when the write fails ─────────────────────────────────────────────
{
  const file = path.join(TMP, 'keep.json');
  fs.writeFileSync(file, '{"good":true}');
  // A circular structure throws inside JSON.stringify BEFORE any write; a directory in place of the
  // temp path throws inside writeFileSync, which is the case that matters.
  fs.mkdirSync(file + '.tmp' + process.pid);
  assert.throws(() => writeFileAtomic(file, 'replacement'), /EISDIR|EPERM|EACCES/,
    'a failing write really does throw rather than silently doing nothing');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"good":true}',
    '⚠️ and the ORIGINAL survives — a failed save must not destroy the previous good copy');
  fs.rmdirSync(file + '.tmp' + process.pid);
}
{
  // ⚠️ Debris cleanup, tested where it can actually FIRE. The case above fails inside
  // writeFileSync, so no temp exists to clean and the catch's unlink is unreachable — a mutation
  // deleting it stayed GREEN until this section existed. Here the temp IS written and the RENAME is
  // what fails (the target is a directory), which is the only path that leaves a stray file.
  const dir = path.join(TMP, 'target-is-a-dir');
  fs.mkdirSync(dir);
  const tmpName = path.basename(dir) + '.tmp' + process.pid;
  assert.throws(() => writeFileAtomic(dir, 'x'.repeat(1000)), /EISDIR|ENOTEMPTY|EPERM|EACCES/,
    'renaming onto a directory fails');
  assert.ok(!fs.existsSync(path.join(TMP, tmpName)),
    '⚠️ and the temp file it had already written is cleaned up — a failed save must not litter the ' +
    'data directory with half-written copies of the corpus');
  fs.rmdirSync(dir);
}
console.log('  a failed write leaves the previous good file intact: OK');

// ── 3. No debris, and the mode rides on the TEMP file ───────────────────────────────────────────
{
  const file = path.join(TMP, 'creds.json');
  writeFileAtomic(file, '{"secret":1}', { mode: 0o600 });
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"secret":1}');
  // ⚠️ learners.json holds credentials. rename PRESERVES the temp's mode, so writing 0644 and
  // chmod-ing afterwards would publish them for the width of that window. Asserted on the result.
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600,
    'the credential store lands at 0600, not at 0644-then-fixed');
  writeFileAtomic(file, '{"secret":2}', { mode: 0o600 });
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600, 'and again on overwrite');
  // ⚠️ The case the explicit chmod actually defends, and the only one that can catch its removal:
  // a STALE temp left at 0644 by a process that was killed between the write and the rename.
  // `writeFileSync`'s own `mode` applies only when it CREATES the file, so without the chmod that
  // stale file keeps 0644 and the rename publishes the credential store at 0644. (A mutation
  // deleting the chmod stayed GREEN until this existed — the earlier checks always had a fresh
  // temp, where writeFileSync's own mode is enough.)
  const stale = file + '.tmp' + process.pid;
  fs.writeFileSync(stale, 'leftover', { mode: 0o644 });
  fs.chmodSync(stale, 0o644);
  writeFileAtomic(file, '{"secret":3}', { mode: 0o600 });
  assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600,
    'a stale 0644 temp does not leak the credential store at 0644');
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"secret":3}', 'and the content is the new one');
  // ⚠️ Scoped to THIS file's temp, not to the directory. Scanning the whole directory made this
  // section itself flaky — 4 failures in 12 runs — because §1 SIGKILLs its writer process mid-write,
  // and a killed process legitimately cannot clean up after itself. That is not a defect: the
  // TARGET file is still intact, which is the property that matters, and a stale temp is handled
  // (the explicit chmod above exists for exactly that file). An over-broad assertion was the bug.
  assert.ok(!fs.existsSync(file + '.tmp' + process.pid),
    'no temp file is left behind by a successful write');
}
console.log('  credential mode is applied before the swap, and no temp debris remains: OK');

// ── 4. ⚠️ Every durable store in the live server goes through it ────────────────────────────────
// A SOURCE check, deliberately, because "no bare writeFileSync survives" is a claim about a SET of
// call sites that no single rendered outcome can observe. Behaviour is §1's job; this is coverage.
{
  // ⚠️ v90_d — `translate-ui.js` JOINED THIS SET, and the exemption below is why it had to.
  // The rule that stood here excused "a one-shot maintenance script … a human runs it, one at a
  // time, and re-runs it on failure". `translate-ui.js` is none of those things: it rewrites
  // ui.json after EVERY batch, for hours, with `--threads 5`, while the server, build-static.js and
  // this very suite read the same file. Reported by the user as `node test/run.js --quick` failing
  // `unit-library-sort` — which does `JSON.parse(readFileSync(ui.json))` — with nothing wrong in
  // either the suite or the tree. The exemption is about a live reader, not about the word "script".
  for (const f of ['server.js', 'learners.js', 'translate-ui.js']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const bare = [...src.matchAll(/fs\.writeFileSync\(/g)];
    assert.strictEqual(bare.length, 0,
      `${f} still has ${bare.length} bare fs.writeFileSync call(s) — every durable store in the ` +
      'live server writes through writeFileAtomic. A one-shot maintenance script may use the bare ' +
      'call (a human runs it, one at a time, and re-runs it on failure); the SERVER may not, ' +
      'because a reader is always live alongside it.');
    assert.ok(/require\('\.\/atomic-write'\)/.test(src), `${f} requires the helper`);
  }
  // Non-vacuity: the stores really are written here, so the check above is not passing on an
  // absence of writes.
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  for (const store of ['STORAGE_FILE', 'SKILLS_FILE', 'DRAFTS_FILE', 'UI_FILE', 'ANALYSIS_STORE_FILE']) {
    assert.ok(new RegExp('writeFileAtomic\\(' + store).test(srv),
      `${store} is written through the atomic helper`);
  }
  // …and the same non-vacuity for the translator: it really does write both files it owns, so its
  // clean bill above is not the clean bill of a file that never writes anything.
  const tui = fs.readFileSync(path.join(ROOT, 'translate-ui.js'), 'utf8');
  for (const store of ['UI_FILE', 'LANG_FILE']) {
    assert.ok(new RegExp('writeFileAtomic\\(' + store).test(tui),
      `translate-ui.js writes ${store} through the atomic helper`);
  }
}
console.log('  every durable store in server.js, learners.js and translate-ui.js writes atomically: OK');

async function main() {
// ── 5. ⚠️ The ui.json watcher survives a file REPLACEMENT — driven, not read ────────────────────
// The one place where making a write safe breaks something else. `fs.watch(path)` follows the INODE
// on Linux and an atomic write REPLACES the file, so a watch established beforehand ends up holding
// an inode nobody will write again.
//
// ⚠️ It is not only the server's own writes. `sed -i`, VS Code and vim's default all save by writing
// a temp and renaming over it — and the user HAND-TRANSLATES this file. Measured before `v89_ae`:
// an in-place edit reloads, the FIRST rename-based edit reloads, and every edit after that is
// silently ignored. That is the symptom to protect against: you edit ui.json, it is picked up once,
// and nothing happens again until the server restarts.
//
// This section runs the REAL `_watchUI` lifted out of server.js against a real file. A source-level
// check that the function contains a re-arm could not fail for the thing that actually matters.
{
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const at = srv.indexOf('function _watchUI()');
  assert.ok(at > -1, 'server.js defines a re-armable UI watcher');
  let d = 0, i = srv.indexOf('{', at);
  for (; i < srv.length; i++) { if (srv[i] === '{') d++; else if (srv[i] === '}') { d--; if (!d) { i++; break; } } }
  const watchSrc = srv.slice(at, i);

  const file = path.join(TMP, 'ui.json');
  fs.writeFileSync(file, '{"en":{"a":"1"}}');
  let reloads = 0;
  const api = new Function('fs', 'UI_FILE', 'reloadUI',
    'let _uiWatcher = null;\n' + watchSrc + '\nreturn { _watchUI, close: () => { try { _uiWatcher.close(); } catch(_){} } };'
  )(fs, file, () => { try { JSON.parse(fs.readFileSync(file, 'utf8')); reloads++; } catch (_) {} });
  api._watchUI();

  // ⚠️ A REAL await. `execFileSync('sleep')` blocks the event loop, so the watcher's own
  // setTimeout never fires and every reload count reads 0 — the first draft of this section
  // failed for exactly that reason and looked like a broken watcher.
  const settle = () => new Promise(r => setTimeout(r, 400));
  const body = '{"en":{"a":"1"}}';
  const renameEdit = async () => { fs.writeFileSync(file + '.new', body, 'utf8'); fs.renameSync(file + '.new', file); await settle(); };

  fs.writeFileSync(file, body, 'utf8'); await settle();      // in-place
  const afterInPlace = reloads;
  assert.ok(afterInPlace > 0, 'an in-place edit reloads (sanity: the watcher is armed at all)');

  await renameEdit();
  const afterFirst = reloads;
  assert.ok(afterFirst > afterInPlace, 'the first rename-based edit reloads');

  await renameEdit();
  assert.ok(reloads > afterFirst,
    '⚠️ and so does the SECOND — this is the whole assertion. Before v89_ae the watch was holding ' +
    'the replaced inode and every edit after the first was silently ignored, which for a file the ' +
    'user hand-translates means their edits stop being picked up with nothing to indicate it.');
  api.close();

  // And saveUI re-arms too, so the server's OWN atomic write does not orphan the watch either.
  const saveUI = srv.slice(srv.indexOf('function saveUI('), srv.indexOf('let uiStrings'));
  assert.ok(/_watchUI\(\);/.test(saveUI), 'saveUI re-arms after replacing ui.json');
}
console.log('  the ui.json watcher survives repeated rename-based edits, not just the first: OK');

}
main().then(() => {
  console.log('unit-atomic-write: ALL PASSED');
}).catch(e => { console.error(e); process.exit(1); });
