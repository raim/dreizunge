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

Clones the repo, installs Ollama if it isn't already on your machine, pulls the recommended
`qwen2.5:7b` model, and starts the app — all in one command. Requires only Node.js (>=14) and git
already installed; safe to re-run (it updates the checkout instead of re-cloning).

```bash
curl -fsSL https://raw.githubusercontent.com/raim/dreizunge/main/install.sh | sh
```

Then open **http://localhost:3000**. Override the checkout location, model, or port with
`DREIZUNGE_DIR`, `DREIZUNGE_MODEL`, or `PORT` env vars, e.g.
`DREIZUNGE_MODEL=translategemma PORT=8080 curl -fsSL .../install.sh | sh`. See `install.sh` itself
for exactly what it does — it does not do anything the manual steps in Option B below don't also do.

### Option B — manual install, Local Qwen via Ollama

The slim models qwen2.5:7b and translategemma both work well.

NOTE: use translategemma for rarer languages, but use qwen for
Asian languages.


```bash
# 1. Install Ollama on Xubuntu 24.04
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model: the slim language-oriented LLMs seem to work best:
ollama pull qwen2.5:7b

# 3. Start the app — Ollama is auto-detected
node server.js

# Or set the model explicitly:
OLLAMA_MODEL=qwen2.5:7b node server.js

# For languages that qwen doesn't speak, translategemma
# works better, e.g. Letzebuergesch or Swahili: set explicitly
OLLAMA_TRANSLATION_MODEL=translategemma OLLAMA_MODEL=qwen2.5:7b node server.js


```
**When finished, don't forget to stop the model and free up your RAM:**

``` bash
 ollama stop qwen2.5:7b
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
