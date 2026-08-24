#!/bin/sh
# Dreizunge — one-line local install.
#
#   curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh | sh
#
# Clones the repo, installs Ollama (via Ollama's OWN official installer — this script does not
# reimplement platform-specific Ollama packaging itself) if it isn't already present, makes sure
# the Ollama server is actually reachable, pulls the recommended BEST model (qwen3.6:35b-a3b — a
# large download; set DREIZUNGE_MODEL=qwen2.5:7b for a much smaller, still-solid alternative), and
# starts the app in the foreground on http://localhost:3000.
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

# ── 4. Pull the recommended model ─────────────────────────────────────────
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

# ── 5. Start the app ───────────────────────────────────────────────────────
log "Starting Dreizunge on http://localhost:$PORT (Ctrl-C to stop)"
cd "$DIR"
OLLAMA_MODEL="$MODEL" PORT="$PORT" exec node server.js
