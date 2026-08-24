#!/bin/sh
# Dreizunge — one-line local install.
#
#   curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh | sh
#
# Clones the repo, installs Ollama (via Ollama's OWN official installer — this script does not
# reimplement platform-specific Ollama packaging itself) if it isn't already present, makes sure
# the Ollama server is actually reachable, checks the machine has room for the recommended model,
# pulls it (qwen3.6:35b-a3b — a large download; set DREIZUNGE_MODEL=qwen2.5:7b for a much smaller,
# still-solid alternative), and prints how to start the app — it does not start it for you.
#
# Safe to RE-RUN: every step checks what is already there before acting — nothing here is
# destructive. Set DREIZUNGE_DIR / DREIZUNGE_MODEL / PORT to override the defaults below.
#
# This mirrors, and does not replace, the manual "Quick start" steps already documented in
# README.md — read that file if you would rather do any of this by hand or need Windows/WSL notes.
set -eu

REPO_URL="https://github.com/raim/dreizunge.git"
DIR="${DREIZUNGE_DIR:-dreizunge}"
MODEL="${DREIZUNGE_MODEL:-qwen3.6:35b-a3b}"   # README.md's own recommended BEST model (measured, see roadmap_v83.md)
PORT="${PORT:-3000}"
OLLAMA_URL="${OLLAMA_HOST:-http://127.0.0.1:11434}"

log()  { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$1" >&2; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

log "Dreizunge -- local install"

# ── 1. Prerequisites ──────────────────────────────────────────────────────
# Node.js and git are CHECKED, never silently installed -- both are language/toolchain choices
# the machine's owner should make deliberately, unlike Ollama below (which the user explicitly
# asked this script to install, and which Ollama's own installer already handles safely).
case "$(uname -s)" in
  Linux|Darwin) : ;;
  *) warn "Untested platform ($(uname -s)) -- this script targets Linux and macOS. Continuing anyway." ;;
esac

has git || die "git is required but was not found. Install it, then re-run this script.
  Debian/Ubuntu: sudo apt install git
  macOS:         xcode-select --install"

has node || die "Node.js (>=14) is required but was not found. Install it, then re-run this script.
  https://nodejs.org/   (or: sudo apt install nodejs / brew install node)"

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 14 ]; then
  die "Node.js >= 14 is required (found $(node --version)). Please upgrade, then re-run this script."
fi

# ── 2. Clone (or update) the repo ─────────────────────────────────────────
if [ -d "$DIR/.git" ]; then
  log "Found an existing checkout at ./$DIR -- updating it"
  ( cd "$DIR" && git pull --ff-only ) \
    || warn "Could not fast-forward ./$DIR (local changes?) -- leaving it as-is and using what's there."
elif [ -e "$DIR" ]; then
  die "./$DIR already exists and is not a git checkout -- move it aside, or set DREIZUNGE_DIR to a different path, and re-run."
else
  log "Cloning Dreizunge into ./$DIR"
  git clone "$REPO_URL" "$DIR"
fi

# ── 3. Ollama ──────────────────────────────────────────────────────────────
if has ollama; then
  log "Ollama already installed"
else
  log "Installing Ollama via its own official installer (https://ollama.com/install.sh)"
  curl -fsSL https://ollama.com/install.sh | sh
  has ollama || die "Ollama's installer finished but 'ollama' is still not on PATH -- open a new shell and re-run this script."
fi

# The official Linux installer starts a systemd service automatically, but that is not guaranteed
# everywhere (no systemd, or a fresh macOS install where the app has not been launched yet) -- so
# this checks reachability directly rather than assuming the installer's own side effects held.
if curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1; then
  log "Ollama is running"
else
  log "Starting Ollama in the background"
  ( nohup ollama serve >/tmp/dreizunge-ollama.log 2>&1 & )
  i=0
  while [ "$i" -lt 15 ]; do
    curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1 && break
    i=$((i + 1))
    sleep 1
  done
  curl -fsS "$OLLAMA_URL/api/tags" >/dev/null 2>&1 \
    || die "Ollama did not come up after 15s -- check /tmp/dreizunge-ollama.log, then re-run this script."
fi

# ── 4. Resource sanity check ──────────────────────────────────────────────
# Only meaningful for the BUILT-IN default model, whose real size is actually known (~20+ GB) —
# an explicit DREIZUNGE_MODEL override could be any size, so this is skipped for one, rather than
# warning/refusing based on a size that may not apply.
if [ "$MODEL" = "qwen3.6:35b-a3b" ]; then
  # RAM: WARN only, never refuse. Ollama/llama.cpp mmap the model weights, so a lower-RAM machine
  # can often still run this (just slower, via paging) -- this is a heads-up, not a hard rule.
  RAM_KB=""
  case "$(uname -s)" in
    Linux)  RAM_KB=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true) ;;
    Darwin) RAM_B=$(sysctl -n hw.memsize 2>/dev/null || true); [ -n "${RAM_B:-}" ] && RAM_KB=$((RAM_B / 1024)) ;;
  esac
  if [ -n "$RAM_KB" ]; then
    RAM_GB=$((RAM_KB / 1024 / 1024))
    if [ "$RAM_GB" -lt 16 ]; then
      warn "This machine reports ~${RAM_GB}GB RAM. $MODEL (~20+GB) wants more to run well -- it may be slow, or fail to load. Consider DREIZUNGE_MODEL=qwen2.5:7b instead (much smaller, still solid)."
    fi
  fi

  # Disk: REFUSE if there is clearly not enough room -- a failed multi-GB download helps no one.
  # Checked at the filesystem under Ollama's OWN model store (OLLAMA_MODELS if set, else its own
  # default ~/.ollama), NOT at $DIR (the git checkout itself is a few MB) -- walking up to the
  # nearest EXISTING ancestor since that directory may not exist yet on a fresh install.
  CHECK_DIR="${OLLAMA_MODELS:-$HOME/.ollama}"
  while [ ! -d "$CHECK_DIR" ] && [ "$CHECK_DIR" != "/" ]; do CHECK_DIR=$(dirname "$CHECK_DIR"); done
  FREE_KB=$(df -Pk "$CHECK_DIR" 2>/dev/null | awk 'NR==2 {print $4}' || true)
  if [ -n "${FREE_KB:-}" ]; then
    FREE_GB=$((FREE_KB / 1024 / 1024))
    if [ "$FREE_GB" -lt 25 ]; then
      die "Only ~${FREE_GB}GB free at $CHECK_DIR -- $MODEL needs ~20+GB. Free up space, set OLLAMA_MODELS to a roomier disk, or set DREIZUNGE_MODEL=qwen2.5:7b (much smaller) and re-run."
    fi
  fi
fi

# ── 5. Pull the recommended model ─────────────────────────────────────────
# qwen3.6:35b-a3b is README.md's own recommended BEST-quality model, per a real measured comparison
# (roadmap_v83.md: zero translation errors vs. two on the smaller qwen2.5:7b, on the same real
# chapter). It is a big download (~20+ GB) and wants real RAM to run well -- if that doesn't suit
# your machine, Ctrl-C now and set DREIZUNGE_MODEL=qwen2.5:7b (much smaller, still solid) instead;
# `ollama pull translategemma` afterwards if you need rarer languages qwen doesn't speak well.
if ollama list 2>/dev/null | awk '{print $1}' | grep -qx "$MODEL"; then
  log "Model $MODEL already pulled"
else
  log "Pulling $MODEL -- this is a LARGE model (~20+ GB); the first pull can take a while"
  ollama pull "$MODEL"
fi

# ── 6. Done — print how to start it, don't start it ourselves ────────────────
# Deliberately does NOT exec the server: an installer that ends by launching a long-running
# foreground process is surprising (piped through `curl | sh`, it also leaves stdin already
# consumed by curl). Every other step here is idempotent and safe to re-run; starting the app is
# the one step left for the user to do explicitly, whenever they're ready.
log "Install complete. Start Dreizunge with:"
printf '\n    cd %s && OLLAMA_MODEL=%s PORT=%s node server.js\n\n' "$DIR" "$MODEL" "$PORT"
log "Then open http://localhost:$PORT in your browser."
