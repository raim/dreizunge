// atomic-write.js — v89_ad.
//
// Every durable store in this app was written with a bare `fs.writeFileSync(FILE, json)`. For a
// 10MB `lessons.json` that is NOT one syscall: the file is truncated, then written in chunks. Two
// things follow, and the first one is how this was found.
//
// 1. A CONCURRENT READER CAN SEE A TORN FILE. This is what the `v88`-line "flake audit" was
//    actually chasing. `unit-word-progress` and `unit-ui-journeys` carried a "known flake —
//    buildExercises corpus-sampling randomness" label for many releases. Measured at the `v89_ad`
//    cut: 40/40 standalone each, 60/60 under seeded shuffles, 15/15 under 8-way CPU load — clean
//    every way except one. With `lessons.json` being rewritten underneath them at the rate the
//    user's own live server writes it, `unit-word-progress` failed **3 of 25** runs with
//    `SyntaxError: Unterminated string in JSON`. Same churn rate with an ATOMIC writer: **0 of 25**.
//    The tests were never flaky. The writer was.
//
// 2. A CRASH MID-WRITE TRUNCATES THE FILE. Same window, worse consequence: SIGKILL, an OOM, or a
//    power cut between the truncate and the last chunk leaves a corpus of 352 topics as a partial
//    JSON file, and **there is no backup anywhere in this project**. That risk existed for
//    `lessons.json`, `learners.json` (credentials, rewritten on every answered question),
//    `ui.json` (hand-translated into five languages), `drafts.json` (item R's whole durability
//    story) and `canonical-analysis.json` (minutes of CP2 time per sentence).
//
// ⚠️ The problem was already KNOWN at one site and worked around instead of fixed: `reloadUI`'s own
// comment says a parse error is "skipped rather than blanking the strings (e.g. mid-write)". A
// reader defending itself against a torn file is the symptom; this module is the cause.
//
// write-to-temp + rename. `rename(2)` is atomic within a filesystem, so a reader sees either the
// whole old file or the whole new one, never a prefix. The temp sits in the SAME directory (it is
// the target path plus a suffix) so it cannot land on a different filesystem, which is the one way
// rename stops being atomic.
'use strict';
const fs = require('fs');

// `mode` matters for learners.json, which holds credentials at 0600. rename preserves the TEMP
// file's mode, so the permission has to be on the temp before the swap — writing it 0644 and
// chmod-ing after would publish credentials for the width of that window. The explicit chmod is
// belt-and-braces: writeFileSync's own `mode` applies only when it CREATES the file, so a stale
// temp left by a killed process would otherwise keep its old permissions.
function writeFileAtomic(file, data, opts) {
  const mode = opts && opts.mode;
  // The pid keeps two processes (the user's server and a test instance) off each other's temp file.
  const tmp = `${file}.tmp${process.pid}`;
  try {
    fs.writeFileSync(tmp, data, mode ? { encoding: 'utf8', mode } : 'utf8');
    if (mode) { try { fs.chmodSync(tmp, mode); } catch (_) {} }
    fs.renameSync(tmp, file);
  } catch (e) {
    // Leave no debris behind on a failed write — the point is that the target is untouched.
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

module.exports = { writeFileAtomic };
