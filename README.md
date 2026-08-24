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
actually handle the recommended model, and pulls it — `qwen3.6:35b-a3b`, the BEST-quality option
per a real measured comparison (see `build_history/roadmap_v83.md`: zero translation errors vs. two
on the smaller `qwen2.5:7b`, on the same real chapter). It prints the exact command to start the app
— it does not start it for you. Requires only Node.js (>=14) and git already installed; safe to
re-run (it updates the checkout instead of re-cloning).

```bash
curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh | sh
```

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
