# Dreizunge

> **Working on this codebase (new session)?** Read **`build_history/START-HERE.md`** first — it
> points to the current roadmap (whose top holds the standing "session protocol / definition of
> done"), the live-test checklist, and the latest session notes.

Learn vocabulary for a specific topic in any language: enter **any topic**, get AI-generated lessons instantly. 

Generate custom quirky story lines using **local LLM via ollama**.

**Share your lessons as exported files!**

Everybody can already learn from existing lessons and story lines at:
https://raim.github.io/dreizunge/


---

## Quick start

### Option A — one-line install (recommended)

Clones the repo, installs Ollama if it isn't already on your machine, checks your disk/RAM can
actually handle the recommended model, pulls it — `qwen3.6:35b-a3b`, the BEST-quality option
per a real measured comparison (see `build_history/roadmap_v83.md`: zero translation errors vs. two
on the smaller `qwen2.5:7b`, on the same real chapter) — and installs a `dreizunge` command onto your
PATH (at `~/.local/bin`). Requires only Node.js (>=14) and git already installed; safe to re-run (it
updates the checkout instead of re-cloning).

```bash
curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh | sh
```

From then on, just run:

```bash
dreizunge
```

— starts the server and opens it in your browser automatically (add `--no-browser` to skip that; set
`PORT` to use a different port). If `~/.local/bin` isn't already on your PATH, the installer tells you
the exact line to add to your shell profile; until then, or if you'd rather not use the launcher, the
manual command it also prints (`cd ... && node server.js`) always works too.

`qwen3.6:35b-a3b` is a big download (~20+ GB) and wants real RAM to run well — the script warns if
your RAM looks tight and refuses if your disk clearly doesn't have room for it. If that doesn't suit
your machine, use the much smaller (and still solid) `qwen2.5:7b` instead:
`DREIZUNGE_MODEL=qwen2.5:7b curl -fsSL .../install.sh | sh`. Override the checkout location or port
too, with `DREIZUNGE_DIR` / `PORT`. See `install.sh` itself for exactly what it does — it does not do
anything the manual steps in Option B below don't also do.

### Option B — manual install, Local LLM via Ollama

`qwen3.6:35b-a3b` is the best-quality model measured so far (see Option A above) — use it if your
machine has the RAM and disk for a ~20+ GB model. `qwen2.5:7b` is a much lighter, still-solid
alternative, and `translategemma` works better for rarer languages qwen doesn't speak well.

NOTE: use translategemma for rarer languages, but use qwen for
Asian languages.


```bash
# 1. Install Ollama on Xubuntu 24.04
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model — qwen3.6:35b-a3b for the best quality (large download):
ollama pull qwen3.6:35b-a3b
# ...or the much smaller, still solid qwen2.5:7b:
ollama pull qwen2.5:7b

# 3. Start the app — Ollama is auto-detected
node server.js

# Or set the model explicitly:
OLLAMA_MODEL=qwen3.6:35b-a3b node server.js

# For languages that qwen doesn't speak, translategemma
# works better, e.g. Letzebuergesch or Swahili: set explicitly
OLLAMA_TRANSLATION_MODEL=translategemma OLLAMA_MODEL=qwen3.6:35b-a3b node server.js


```
**When finished, don't forget to stop the model and free up your RAM:**

``` bash
 ollama stop qwen3.6:35b-a3b
```


### Option C — Offline only (no LLM)

```bash
LLM_BACKEND=none node server.js
```

In offline mode you can only load lessons that were already saved in lessons.json.

---

## Windows

`install.sh` (Option A above) needs a `sh`-compatible shell, which Windows doesn't have by default —
there's no one-line installer for Windows yet. The same steps done by hand still work, and both
dependencies ship real double-click Windows installers, so no coding experience is needed:

1. **Install Ollama** — download and run the official installer from
   [ollama.com/download/windows](https://ollama.com/download/windows) (double-click, no terminal).
2. **Install Node.js** — download and run the official LTS installer (`.msi`) from
   [nodejs.org](https://nodejs.org) (double-click, no terminal).
3. **Download this app** — on the GitHub page, click the green **Code** button, then
   **Download ZIP**, and extract it anywhere. No `git` needed.
4. **Open a terminal in that folder**:
   - Windows 11: right-click the folder → **Open in Terminal**.
   - Windows 10: hold Shift and right-click the folder → **Open PowerShell window here** (or open
     PowerShell/Command Prompt and `cd` to the folder yourself).
5. **Pull a model**, in that terminal:
   ```
   ollama pull qwen2.5:7b
   ```
   (a smaller model that's still solid — see Option A above for the bigger, best-quality
   `qwen3.6:35b-a3b`, if your machine has the RAM/disk for a ~20+ GB download).
6. **Start the app**, in the same terminal:
   ```
   node server.js
   ```
   then open `http://localhost:3000` in your browser.

Every step after installing Ollama and Node is the same as the manual steps in Option B above —
Windows just needs its terminal opened a different way (step 4).

⚠️ Not yet tested on a real Windows machine — reasoned from Ollama and Node.js both shipping official
Windows installers and the app having no OS-specific code, not measured against an actual run. If
something doesn't work as described here, please let us know.

---


## Open in browser

```
http://localhost:3000
```

or in your local network, using the IP of the computer that runs
the server script (see console output), e.g.,

```
http://192.168.0.180:3000/
```

You may need to allow the port so it can be accessed locally in your wifi
from other computers:

``` bash
sudo ufw allow 3000
```
---

## Saved lessons

All generated lessons are stored in lessons.json next to server.js.
- Created automatically on first use,
- Copy it between machines to share lessons,
- App works fully offline as long as lessons.json exists or is imported
  by the user.

---

## Exercise types

- Listening MCQ    — hear target language, pick English meaning
- Listening + type — hear target language, type it back
- EN → IT          — see English, pick correct translation from choices
- IT → EN          — see a word o sentence, pick English from choices
- Word order       — shuffled tokens, tap to reassemble
- Read & translate — read target language sentence, pick English

---

## Requirements

- Node.js >= 14 (no npm install needed, zero dependencies)
