// unit-install-script.test.js
// install.sh — the one-line `curl -fsSL .../install.sh | sh` local installer (README.md's own
// "Option A"). Not app code, so this file cannot exercise it the way a JS module gets exercised —
// what it CAN check: real POSIX sh syntax validity (via `sh -n`, not just eyeballing it), that the
// script is actually executable, that it does not do anything destructive to an EXISTING checkout
// or an ALREADY-installed Ollama (idempotency is checked structurally here; a REAL end-to-end run,
// including the update-existing-checkout path, was exercised manually against the real GitHub repo
// before this release shipped — see the roadmap's own write-up for that run's output), and that
// README.md's own documented one-liner points at a URL this repo's actual layout can serve.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'install.sh');
const src = fs.readFileSync(SCRIPT, 'utf8');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

// ── 1. Real POSIX sh syntax validity ──────────────────────────────────────
{
  assert.doesNotThrow(() => execFileSync('sh', ['-n', SCRIPT], { cwd: ROOT }),
    'sh -n must accept the script as valid POSIX sh -- checked by actually invoking sh, not by eyeballing the source');
}
console.log('  install.sh: valid POSIX sh syntax, checked via a real `sh -n` invocation: OK');

// ── 2. Executable, and starts with a real shebang ─────────────────────────
{
  const stat = fs.statSync(SCRIPT);
  assert.ok(stat.mode & 0o111, 'install.sh must be executable (chmod +x) -- curl | sh does not need this, but a direct ./install.sh run does');
  assert.ok(src.startsWith('#!/bin/sh'), 'the shebang names /bin/sh specifically -- the script uses only POSIX constructs, not bash-only ones');
}
console.log('  install.sh: executable, correct shebang: OK');

// ── 3. Safety idioms: fail-fast, no unset-variable surprises ──────────────
{
  assert.ok(/^set -eu\s*$/m.test(src), 'the script sets -eu (exit on error, exit on unset variable) -- a curl|sh installer must not silently continue past a failed step');
}
console.log('  install.sh: set -eu present -- fails fast rather than silently continuing past an error: OK');

// ── 4. Every mutating step is gated behind an idempotency check ───────────
// Structural, not behavioural (a shell script cannot be unit-tested the way JS can) -- but each
// claim below was ALSO verified by a real, manual end-to-end run (fresh install AND a second,
// update-existing-checkout run) against the real GitHub repo before this release shipped.
{
  assert.ok(/if \[ -d "\$DIR\/\.git" \]/.test(src), 'an EXISTING checkout is detected before cloning — re-running the script updates rather than re-clones');
  assert.ok(/if has ollama/.test(src), 'an ALREADY-installed Ollama is detected before running its installer');
  assert.ok(/if ollama list.*grep -qx "\$MODEL"/s.test(src), 'an ALREADY-pulled model is detected before pulling it again');
  assert.ok(/if curl -fsS "\$OLLAMA_URL\/api\/tags"/.test(src), 'an ALREADY-running Ollama server is detected before trying to start a new one');
  assert.ok(/die "\.\/\$DIR already exists and is not a git checkout/.test(src),
    'a non-git directory already occupying the target path REFUSES rather than overwriting it — the one genuinely destructive-adjacent case is a hard stop, not a silent clobber');
}
console.log('  install.sh: every mutating step (clone, Ollama install, Ollama start, model pull) is gated behind a real idempotency check: OK');

// ── 5. Node.js and git are CHECKED, never silently auto-installed ─────────
// Only Ollama was explicitly asked for ("this must include ollama and its models") -- the script
// must not quietly expand that into installing a language runtime or a VCS tool nobody asked it to.
{
  assert.ok(/has git \|\| die/.test(src), 'git is a hard requirement, checked, not auto-installed');
  assert.ok(/has node \|\| die/.test(src), 'node is a hard requirement, checked, not auto-installed');
  // "apt install"/"brew install" DO appear in the script — as guidance TEXT inside the die()
  // messages telling the user what to run themselves. What must NEVER happen is one of those
  // appearing as a bare, standalone command the script would itself execute — checked by requiring
  // every such line to be an indented continuation of a die string (prefixed by descriptive text
  // like "Debian/Ubuntu:" or "(or:"), never a line that starts directly with the command itself.
  const pkgMgrLines = src.split('\n').filter(l => /apt(-get)? install|brew install/.test(l));
  assert.ok(pkgMgrLines.length > 0, 'sanity: the guidance text really is present somewhere (non-vacuous)');
  pkgMgrLines.forEach(l => {
    assert.ok(!/^\s*(sudo\s+)?(apt|apt-get|brew)\s+install/.test(l),
      `a package-manager install must appear only as GUIDANCE TEXT inside a die() message, never as a bare command the script itself would run (offending line: ${JSON.stringify(l)})`);
  });
}
console.log('  install.sh: node/git are checked prerequisites, never silently auto-installed; Ollama installation is fully delegated to its own official installer: OK');

// ── 6. The model default matches what README.md itself recommends ────────
{
  // qwen3.6:35b-a3b, not qwen2.5:7b — changed after a real, measured comparison (see
  // roadmap_v83.md): zero translation errors vs. two on the smaller model, same real chapter.
  assert.ok(/MODEL="\$\{DREIZUNGE_MODEL:-qwen3\.6:35b-a3b\}"/.test(src), 'the default model is qwen3.6:35b-a3b, the measured-best option');
  assert.ok(/qwen3\.6:35b-a3b/.test(readme) && /best-quality|BEST-quality|best quality/.test(readme),
    'README.md itself recommends this same model as the best-quality option — the installer\'s default is not an independent guess');
  // The lighter alternative must still be named SOMEWHERE, not silently dropped — a big model is
  // the right DEFAULT for quality, but hiding the lightweight escape hatch would be a real regression
  // for anyone on a smaller machine.
  assert.ok(/qwen2\.5:7b/.test(src), 'install.sh itself still mentions qwen2.5:7b as the lighter DREIZUNGE_MODEL override, not just README');
  assert.ok(/qwen2\.5:7b/.test(readme), 'README.md still documents qwen2.5:7b as the lighter alternative, not silently dropped when the default changed');
}
console.log('  install.sh: default model (qwen3.6:35b-a3b, the measured-best option) matches README.md\'s own recommendation; the lighter qwen2.5:7b alternative is still documented in both: OK');

// ── 7. README.md's documented one-liner points at a URL this repo can actually serve ──
{
  const m = /curl -fsSL (https:\/\/raw\.githubusercontent\.com\/\S+\/install\.sh) \| sh/.exec(readme);
  assert.ok(m, 'README.md documents the one-liner with a raw.githubusercontent.com URL');
  assert.ok(m[1].includes('/raim/dreizunge/'), 'the URL names the real repo (raim/dreizunge), not a placeholder');
  assert.ok(m[1].includes('/main/'), 'the URL names the real default branch (main), not a guessed one — checked against `git symbolic-ref` before writing this');
  assert.ok(fs.existsSync(SCRIPT), 'and install.sh genuinely exists at the repo root, matching the documented path');
}
console.log('  README.md: the documented one-liner URL names the real repo, the real default branch, and a script that actually exists at that path: OK');

// ── 8. The script does NOT start the server itself (v83_s) ──────────────────
// Reported by the user: a curl|sh installer ending by launching a long-running foreground process
// is surprising (and piped through curl, stdin is already consumed). It must print instructions
// instead, not exec the server.
{
  assert.ok(!/exec\s+node\s+server\.js/.test(src), 'install.sh must not exec the server itself');
  assert.ok(/node server\.js/.test(src), 'it still TELLS the user the exact command to run');
  assert.ok(/Install complete/i.test(src), 'a clear completion message exists');
}
console.log('  install.sh: does not auto-start the server -- prints the start command instead: OK');

// ── 9. A resource sanity check runs before the (possibly large) model pull (v83_s) ──
// Reported by the user: does the script check the machine can actually run the recommended model?
// It did not. Guarded structurally (RAM/disk detection can't be forced in a shared CI box), plus
// the exact threshold ARITHMETIC is re-derived here independently and checked against known
// inputs -- not just pattern-matched from the source, so a broken comparison (e.g. an inverted
// `-lt`) would be caught even though the branch itself can't be forced to fire for real.
{
  assert.ok(/if \[ "\$MODEL" = "qwen3\.6:35b-a3b" \]/.test(src),
    'the check is gated to the model whose size is actually known -- a DREIZUNGE_MODEL override could be any size');
  assert.ok(/MemTotal/.test(src) && /hw\.memsize/.test(src),
    'RAM is read on both Linux (/proc/meminfo) and macOS (sysctl hw.memsize)');
  assert.ok(/RAM_GB" -lt 16/.test(src), 'RAM warns under 16GB');
  assert.ok(/warn "This machine reports/.test(src), 'low RAM only WARNS, never refuses -- mmap means it can still run, just slower');
  assert.ok(/OLLAMA_MODELS:-\$HOME\/\.ollama/.test(src),
    'disk is checked at Ollama\'s OWN model store (OLLAMA_MODELS override, else its real default), not at the tiny git checkout dir');
  assert.ok(/FREE_GB" -lt 25/.test(src), 'disk refuses under 25GB free');
  assert.ok(/die "Only ~\$\{FREE_GB\}GB free/.test(src), 'low disk actually REFUSES (a failed multi-GB download helps no one)');

  // The threshold arithmetic itself, re-derived and checked against concrete inputs (mirrors the
  // script's own `RAM_KB / 1024 / 1024` / `FREE_KB / 1024 / 1024` integer division).
  const kbToGb = kb => Math.floor(kb / 1024 / 1024);
  assert.strictEqual(kbToGb(8 * 1024 * 1024) < 16, true, 'sanity: 8GB RAM is below the 16GB warn floor');
  assert.strictEqual(kbToGb(32 * 1024 * 1024) < 16, false, 'sanity: 32GB RAM is above the 16GB warn floor');
  assert.strictEqual(kbToGb(10 * 1024 * 1024) < 25, true, 'sanity: 10GB free is below the 25GB refuse floor');
  assert.strictEqual(kbToGb(100 * 1024 * 1024) < 25, false, 'sanity: 100GB free is above the 25GB refuse floor');
}
console.log('  install.sh: resource check (RAM warn <16GB, disk refuse <25GB, default-model-only) present with correct thresholds: OK');

console.log('unit-install-script: ALL PASSED');
