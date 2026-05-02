# Dreizunge

Learn vocabulary for a specific topic in any language: enter **any topic**, get AI-generated lessons instantly.

Works with **Anthropic Claude**, a **local Qwen model via Ollama**, or fully **offline** using saved lessons.

---

## Quick start

### Option A — Anthropic Claude (best quality)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node server.js
```

### Option B — Local Qwen via Ollama (no API key needed)

```bash
# 1. Install Ollama on Xubuntu 24.04
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model (choose one)
ollama pull qwen2.5:7b          # good quality, ~4 GB
ollama pull qwen2.5:3b          # lighter, ~2 GB
ollama pull qwen2.5:14b         # best quality, ~8 GB
ollama pull qwen3.6:35b-a3b     # NOT RECOMMENDED: slow and fails, overkill
ollama pull gemma3:12b          # NOT TESTED

# 3. Start the app — Ollama is auto-detected
node server.js

# Or set the model explicitly:
OLLAMA_MODEL=qwen2.5:7b node server.js
OLLAMA_MODEL=qwen2.5:14b node server.js
OLLAMA_MODEL=gemma3:12b node server.js
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

## Environment variables

| Variable         | Default                        | Description                              |
|------------------|-------------------------------|------------------------------------------|
| LLM_BACKEND      | auto                          | anthropic · ollama · none · auto         |
| ANTHROPIC_API_KEY| (none)                        | Required for Anthropic backend           |
| CLAUDE_MODEL     | claude-sonnet-4-20250514      | Claude model name                        |
| OLLAMA_HOST      | http://localhost:11434        | Ollama server URL                        |
| OLLAMA_MODEL     | qwen2.5:7b                   | Ollama model name                        |
| PORT             | 3000                          | HTTP server port                         |

Auto-detection (LLM_BACKEND=auto):
  1. ANTHROPIC_API_KEY set → Anthropic
  2. Ollama reachable → Ollama
  3. Neither → offline mode

---

## Saved lessons

All generated lessons are stored in lessons.json next to server.js.
- Created automatically on first use
- Copy it between machines to share lessons
- App works fully offline as long as lessons.json exists

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
