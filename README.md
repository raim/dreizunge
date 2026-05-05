# Dreizunge

Learn vocabulary for a specific topic in any language: enter **any topic**, get AI-generated lessons instantly. 

Generate custom quirky LLM story lines using a **local Qwen model via Ollama**, or fully **offline** using saved lessons.

**Share your lessons as exported files!**

Everybody can already learn from existing lessons and story lines at:
https://raim.github.io/dreizunge/


---

## Quick start


### Option A — Local Qwen via Ollama

The slim models qwen2.5:7b and translategemma both work well.

```bash
# 1. Install Ollama on Xubuntu 24.04
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model: the slim language-oriented LLMs seem to work best:
ollama pull qwen2.5:7b

# 3. Start the app — Ollama is auto-detected
node server.js

# Or set the model explicitly:
OLLAMA_MODEL=qwen2.5:7b node server.js
```
**When finished, don't forget to stop the model and free up your RAM:**

``` bash
 ollama stop qwen2.5:7b
```


### Option B — Offline only (no LLM)

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
