# Dreizunge lesson tools (v42)

Three batch scripts: **generate-lessons.js** (create), **translate-lessons.js**
(translate a template into other language pairs), **qc-lessons.js** (check translations).

---

## generate-lessons.js

Batch-generates Dreizunge lessons for multiple language pairs via the server API.

Requires `server.js` to be running. Outputs a single JSONL file (one line per
language pair) and a `.import.json` file ready to import into Dreizunge.

---

## Quick start

```bash
# Terminal 1 — start the server (use a separate store to keep personal lessons clean)
LESSONS_FILE=batch.json PORT=3001 node server.js

# Terminal 2 — generate
node generate-lessons.js --topic "greetings and introductions" \
  --server-url http://localhost:3001 \
  --src-langs en
```

This produces:
- `lessons-greetings-and-introductions-d1-standard-neutral.jsonl` — generation log
- `lessons-greetings-and-introductions-d1-standard-neutral.import.json` — importable in Dreizunge

---

## Options

| Flag | Default | Description |
|---|---|---|
| `--topic TEXT` | *(required)* | Topic in English — translated automatically per source language |
| `--langs a,b,c` | all 30 | Target languages (what to learn) |
| `--src-langs a,b,c` | all 30 | Source languages (what the learner already speaks) |
| `--difficulty 1\|2\|3` | `1` | 1=beginner, 2=intermediate, 3=advanced |
| `--story-len N` | `200` | Story length in words |
| `--format standard\|all_types\|grammar\|conjugation\|synonyms\|math` | `standard` | Lesson format (v42 adds `synonyms`, `math`) |
| `--style neutral\|creative\|funny\|philosophical\|...` | `neutral` | Story writing style |
| `--tag TAG` | `script-generated` | Storyline tag applied in Dreizunge |
| `--concurrency N` | `1` | Parallel generations (keep at 1 for single-GPU setups) |
| `--output FILE.jsonl` | auto | Output filename (default derived from topic+settings) |
| `--resume FILE.jsonl` | — | Skip pairs already successfully completed in this file |
| `--force` | — | Bypass server cache — always regenerate |
| `--server-url URL` | `http://localhost:3000` | Server URL (or set `SERVER_URL` env var) |
| `--dry-run` | — | Print pairs without generating |
| `--verbose` | — | Show job polling progress and tagging details |

---

## Keeping batch lessons separate from personal lessons

By default `server.js` stores everything in `lessons.json`. To avoid mixing batch
content with your personal lessons, start a dedicated server instance:

```bash
# Dedicated batch server on port 3001, separate store
LESSONS_FILE=batch.json PORT=3001 node server.js

# Point generate-lessons at it
node generate-lessons.js --topic "food and cooking" \
  --server-url http://localhost:3001 \
  --src-langs en --difficulty 1
```

The resulting `.import.json` can then be imported selectively into your main
Dreizunge instance via the import button in the UI.

---

## Language pairs

Without `--langs` or `--src-langs`, the script generates all 870 pairs (30 × 29).
In practice, start with a single source language:

```bash
# 29 pairs: English speakers learning all other languages
--src-langs en

# 58 pairs: English and German speakers learning all other languages
--src-langs en,de

# Specific pairs only
--langs ja,zh,ko --src-langs en
```

---

## Speed guidance

| Setup | Recommended settings | Estimated time for 29 pairs |
|---|---|---|
| HPC (multiple GPUs) | Run N instances with disjoint `--langs` slices | ~minutes |
| Radeon VII / good GPU | `--concurrency 1`, `qwen2.5:14b` | ~30–60 min |
| ThinkPad / CPU only | `--story-len 100`, `qwen2.5:3b`, `--src-langs en` | ~2–3 h |

For CPU-only machines, keep `--story-len` short and `--src-langs` narrow.
Use `--resume` to continue across sessions if interrupted.

---

## HPC / multi-instance setup

Split the pair matrix across N server instances:

```bash
# Instance 1: European languages
LESSONS_FILE=batch1.json PORT=3001 node server.js
node generate-lessons.js --topic "greetings" \
  --server-url http://localhost:3001 \
  --langs de,fr,es,it,pt,nl,pl,sv,da,fi,hu,cs,ro,el,ca \
  --src-langs en --output batch1.jsonl &

# Instance 2: Asian + other languages
LESSONS_FILE=batch2.json PORT=3002 node server.js
node generate-lessons.js --topic "greetings" \
  --server-url http://localhost:3002 \
  --langs ja,zh,ko,ar,hi,tr,he,vi,id,th,sw,uk,ru \
  --src-langs en --output batch2.jsonl &
```

Merge the resulting `.import.json` files before importing — or import each separately.

---

## Output format

### JSONL (`.jsonl`)
One JSON record per language pair, one per line. For quality assessment pipelines.

```json
{
  "topic": "greetings and introductions",
  "lang": "de",
  "srcLang": "en",
  "translatedTopic": "Greetings and Introductions",
  "startedAt": "2026-06-10T17:33:46.937Z",
  "durationMs": 43200,
  "status": "ok",
  "error": null,
  "generationStats": { "totalMs": 42800, "model": "qwen2.5:7b", ... },
  "lessonCount": 1,
  "vocabCount": 8,
  "sentenceCount": 5,
  "lessons": [ ... ],
  "quality": null
}
```

`status` is one of `ok`, `cached`, `failed`. `quality` is `null` — reserved for
a future LLM judge assessment pipeline.

### Import file (`.import.json`)
Standard Dreizunge `lessons.json` format — import directly via the UI:

```json
{
  "schemaVersion": 29,
  "topics": [ ... ],
  "storylines": [ ... ]
}
```

Topics have correct `id` fields and storylines are fully tagged. The import file
is rebuilt from the server's authoritative state at the end of the run, so IDs
and storyline links are always consistent.

---

## Resuming interrupted runs

```bash
# Original run (interrupted after 15 pairs)
node generate-lessons.js --topic "food" --src-langs en \
  --output food-en.jsonl

# Resume — skips the 15 already-ok pairs
node generate-lessons.js --topic "food" --src-langs en \
  --resume food-en.jsonl
```

Only pairs with `status: ok` or `status: cached` are skipped. Failed pairs are
retried. The `.import.json` filename is derived from the JSONL filename
automatically.


---

## translate-lessons.js

Reproduce an exported storyline/lessonset in other language pairs. It translates each
chapter's **story** with a translation model (default `translategemma`) via Ollama, then
feeds the translated story to the running server as `userStory` so the lessons are rebuilt
*correctly for the new target language* (grammar/gender/conjugation can't be mapped word
-for-word, so they are regenerated). Chapter order and chains are preserved.

```bash
# server.js + Ollama both running
node translate-lessons.js --template export.import.json --langs fr,es,ja --src-langs en
node translate-lessons.js --template export.json --langs de --model translategemma --dry-run
```

Key flags: `--template FILE` (required), `--langs` (targets, required), `--src-langs`
(default en), `--model` (default translategemma), `--server-url`, `--ollama-url`, `--tag`,
`--output`, `--resume`, `--dry-run`. Produces a `.import.json` (rebuilt from server state)
plus a `.jsonl` log.

Chapters are chained by stable id as they generate, so each translated storyline
forms automatically and incrementally on the server (no manual grouping). The console
shows per-chapter and per-storyline progress, e.g. `[fr←en] La Storia: chapter 2/3 ✓`.

## qc-lessons.js

Check every vocab/sentence pair in a lessons file with a translation model: is the source
gloss a correct translation of the target term? Flags mismatches and, with `--fix`, replaces
the gloss with the model's correction. `--check-stories` also screens each story for errors
(advisory). Uses a plain "OK / corrected-text" reply protocol (translation models are weak
at JSON).

```bash
node qc-lessons.js --file export.import.json                       # report only
node qc-lessons.js --file lessons.json --fix --out fixed.json      # apply corrections
node qc-lessons.js --file export.json --check-stories --limit 50   # quick sample + stories
```

Key flags: `--file FILE` (required), `--model` (default translategemma), `--ollama-url`,
`--fix`, `--out`, `--report`, `--check-stories`, `--limit N`, `--verbose`. Writes a JSON
report (`.qc.json`) and, with `--fix`, a corrected file.
