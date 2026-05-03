# Dreizunge — Project Status for Next Session

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page
frontend (`index.html`) + static site builder (`build-static.js`).

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

Supported languages: Italian, French, German, Spanish, Portuguese, Dutch, Polish,
Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

---

## Uploaded file state: v10 originals (UNPATCHED)

The uploaded files are the **unpatched v10 originals**. All patches below must be
applied from scratch in the next session against those files. Do NOT assume any
previous session's edits are present — read every file before touching it.

Syntax-check after every edit group:
```bash
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/chk.js && node --check /tmp/chk.js
node --check server.js
node --check build-static.js   # then also: node build-static.js lessons.json /tmp/test && node --check /tmp/test/index.html (extract script)
```

Final deliverable: `dreizunge_v11.zip` containing all five files.

---

## Known state of v10 (what is already working)

- Difficulty dropdown (1/2/3), stored in localStorage and sent on generate
- Language selector, saved in localStorage
- Story always generated (target language checkbox exists but is broken/stale — remove it)
- Story collapsible panel on home screen with 🔊 speak button
- Story language badge (flag emoji) in story header
- Share button (🔗) copies `#topic=…` URL to clipboard with toast notification
- Flag + comment on individual exercises; flags synced to server
- Rating panel after all lessons complete
- Library sorted by `updatedAt` desc (server-side)
- URL hash routing: `#topic=…` loads lesson on startup
- Model console (`🤖 Model console`) at bottom of home screen, only when canGenerate
- `/api/chat` endpoint on server for model console
- `continuedFrom` field in lessons.json shape — but the UI dropdown is MISSING from v10

---

## Patches to apply — in order

### P1 — Restore "Continue story from" dropdown  [small]
Was in v9, accidentally dropped from v10 upload.

**`server.js`:**

(a) `sysStory(lang)` currently has an `inTargetLang` param — remove it entirely,
    always write in target language (see also P3). Add `isContinuation` bool param:
```js
function sysStory(lang, isContinuation) {
  const L = langName(lang);
  const cont = isContinuation
    ? ' IMPORTANT: This is a continuation. You will be given the previous story. Continue with the SAME characters, world, and narrative thread — but shift topic/setting to the new one. Characters should feel familiar; the world connected.'
    : '';
  return `You are a creative writer and ${L} language teacher. Write a short story directly in ${L} on the given topic — aim for 3-4 paragraphs, under 300 words. Prioritise quality over length: stop early rather than pad or repeat. Never repeat a sentence or paragraph in altered form. Avoid repetitive structures. Plain prose only — no headings, no bullets, no markdown. Write entirely in ${L}.${cont}`;
}
```
(Note: this also handles P3 and P5 in one shot — always target lang, relaxed length.)

(b) `generate(topic, lang, active, difficulty, continuedFrom, jobId)` — add `continuedFrom` param:
- Look up prior story: `const prevStory = continuedFrom ? (findSaved(continuedFrom)?.story || null) : null;`
- Log continuation if found
- Story user message:
  ```js
  const storyUserMsg = prevStory
    ? `Previous story:\n${prevStory}\n\nNew topic: "${meta.topic || topic}". Write the continuation now. Plain prose, no headings.`
    : `Write a story for the topic: "${meta.topic || topic}". Plain prose, no headings.`;
  ```
- Pass `!!prevStory` as `isContinuation` to `sysStory`
- `storyLang` is always `lang` (never `'en'`)
- Add to return object: `...(continuedFrom ? { continuedFrom } : {})`

(c) `/api/generate` endpoint:
- Destructure `continuedFrom` from body (alongside `topic, lang, difficulty`)
- Remove `storyInTargetLang` from destructuring entirely
- `const contFrom = continuedFrom && findSaved(continuedFrom) ? continuedFrom : null;`
- Log: include `${contFrom ? ' cont='+contFrom : ''}` in console.log
- Call: `generate(topic.trim(), lang||'it', active, diff, contFrom, jobId)`

(d) `/api/repair-story` — update `sysStory` call:
- Remove `inTargetLang` detection; call `sysStory(lang, false)`
- Set `saved.storyLang = lang` always

**`index.html`:**

(a) CSS — add after `.diff-select-arrow` rule:
```css
.continue-row{margin-bottom:14px}
.continue-lbl{display:block;font-size:12px;font-weight:800;color:var(--gray-dark);margin-bottom:5px;letter-spacing:.02em;text-transform:uppercase}
.continue-select-wrap{position:relative;display:inline-block;width:100%}
.continue-select{width:100%;padding:9px 36px 9px 12px;font-size:13px;font-weight:700;border:2px solid var(--gray-mid);border-radius:var(--radius);font-family:'Nunito',sans-serif;color:var(--text);background:var(--white);appearance:none;-webkit-appearance:none;cursor:pointer;outline:none;transition:border-color .15s}
.continue-select:focus{border-color:var(--blue)}
.continue-select-arrow{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;font-size:13px;color:var(--gray-dark)}
.continued-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;background:#f0f4ff;border:1.5px solid #c0ccff;border-radius:8px;padding:3px 9px;color:#334;margin-top:4px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
```

(b) HTML — add directly after the `.diff-wrap` div, before the `<button class="gen-btn">`:
```html
<div class="continue-row" id="continue-row">
  <span class="continue-lbl">Continue story from</span>
  <div class="continue-select-wrap">
    <select class="continue-select" id="continue-select">
      <option value="">— new story —</option>
    </select>
    <span class="continue-select-arrow">▾</span>
  </div>
</div>
```

(c) `loadSavedList()` — at the very end, after `list.innerHTML = ...`, add:
```js
// Populate continue-select
const contSel = document.getElementById('continue-select');
if (contSel) {
  const prev = contSel.value;
  contSel.innerHTML = '<option value="">— new story —</option>' +
    saved.map(s => {
      const sL = LANGS[s.lang||'it']||LANGS.it;
      return `<option value="${s.topic.replace(/"/g,'&quot;')}">${sL.flag} ${s.topic}</option>`;
    }).join('');
  if (prev && [...contSel.options].some(o => o.value === prev)) contSel.value = prev;
}
```

(d) `doGenerate()` — add to POST body:
```js
continuedFrom: document.getElementById('continue-select')?.value || null,
```

(e) `buildPath()` — after setting `topic-name-big` textContent, add:
```js
let contBadge = document.getElementById('continued-badge');
if (d.continuedFrom) {
  if (!contBadge) {
    contBadge = document.createElement('div');
    contBadge.id = 'continued-badge';
    contBadge.className = 'continued-badge';
    document.getElementById('topic-name-big').insertAdjacentElement('afterend', contBadge);
  }
  contBadge.textContent = '↩ continued from: ' + d.continuedFrom;
  contBadge.style.display = '';
} else if (contBadge) {
  contBadge.style.display = 'none';
}
```

---

### P2 — Double Ollama timeout  [trivial]
`server.js`: change `'360000'` → `'720000'` in the `OLLAMA_TIMEOUT` line.

---

### P3 — Remove "Generate story in X" checkbox  [small]
Already handled by P1's `sysStory` rewrite (always target lang). Additionally:

**`index.html`:**
- Remove CSS: `.native-check-row{...}` and `.native-check-row input[type=checkbox]{...}` (2 lines)
- Remove HTML: the entire `<label class="native-check-row">…</label>` block
- Remove from `selectLang()`: the `nativeLbl` update lines
- Remove from `doGenerate()`: the `storyInTargetLang: !!document.getElementById('story-lang-check')?.checked,` line
- `buildPath()` story lang badge: always `storyLangLbl.textContent = dL.flag` (remove `'EN'` fallback)

---

### P4 — Remove "Try:" example chips  [trivial]
**`index.html`:** Remove the entire `.examples` div (the "Try:" label + all `.chip` buttons).
Also remove `.examples{...}` and `.chip{...}` CSS rules (4 lines total).

---

### P5 — Story prompt: relax length, no repeats  [trivial]
Handled entirely by P1's new `sysStory()` body. No additional work needed.

---

### P6 — Move story below "Start lesson" button  [trivial]
**`index.html`:** In `#home .home-inner`, cut the `<div class="story-section" id="story-section">` 
block and paste it AFTER the `<div class="start-strip">` block.

---

### P7 — Story: collapsed by default; auto-open when all done; highlight vocab  [medium]

**Collapse/expand in `buildPath()`:**
```js
const allDone = d.lessons.every(L => done[L.id]);
if (allDone) {
  storyBody.classList.add('open');
  if (arrow) arrow.classList.add('open');
} else {
  storyBody.classList.remove('open');
  if (arrow) arrow.classList.remove('open');
}
```

**Vocab highlighting in `renderStoryText(d)`:**
Replace the current simple paragraph renderer with:
```js
function renderStoryText(d) {
  const body = document.getElementById('story-body'); if (!body) return;
  const done = APP.progress.completed?.[d.topic] || {};
  // Collect vocab from completed lessons only
  const vocabWords = (d.lessons || [])
    .filter(L => done[L.id])
    .flatMap(L => L.vocab || [])
    .map(v => v.it)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first
  
  let text = d.story || '';
  // Escape HTML first, then highlight
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let escaped = esc(text);
  
  if (vocabWords.length) {
    // Build regex from vocab words (escape special chars)
    const pattern = vocabWords
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const re = new RegExp('(' + pattern + ')', 'gi');
    escaped = escaped.replace(re, '<mark class="story-vocab-hl">$1</mark>');
  }
  
  body.innerHTML = escaped.split(/\n\n+/)
    .map(p => '<p>' + p.replace(/\n/g, '<br>') + '</p>')
    .join('');
}
```

**CSS** (add near story styles):
```css
.story-vocab-hl{background:#fff3c0;border-radius:3px;padding:0 2px;font-weight:800;cursor:help}
```

Note: `renderStoryText` is called from `buildPath()` and `doRepairStory()`. Both calls
pass `d` which has `d.lessons` — this works correctly.

---

### P8 — Skip "lesson complete" screen  [small]
In `showComplete()`:
- Keep all progress update logic (`APP.progress.completed`, XP, `saveProg()`)
- Keep `flaggedCount` calculation (used for XP display elsewhere? No — remove if only used for complete screen)
- Replace `show('complete-screen')` with `goHome()`
- The `#complete-screen` HTML/CSS can remain (no need to delete; it's just never shown)
- Remove the `afterComplete()` function call path is now dead — leave function in place
  but it will never be called

---

### P9 — Flag and comment on lesson stories  [small]

**`index.html` CSS** (add near `.flag-btn` styles):
```css
.story-flag-row{padding:6px 14px 10px;display:flex;flex-direction:column;gap:6px}
```

**`index.html` HTML** — inside `#story-section`, directly after `<div class="story-body" id="story-body"></div>`:
```html
<div class="story-flag-row" id="story-flag-row" style="display:none">
  <button class="flag-btn" id="story-flag-btn" onclick="toggleStoryFlag()">⚐ Flag story</button>
  <div class="flag-comment-wrap" id="story-flag-comment-wrap">
    <textarea class="flag-comment" id="story-flag-comment" rows="2"
      placeholder="Describe what is wrong with the story…"
      onblur="saveStoryComment()"></textarea>
  </div>
</div>
```

**`index.html` JS** — add near the `toggleFlag` / `saveComment` functions:
```js
function storyFlagKey(topic){
  return (topic||'').slice(0,30).replace(/\s+/g,'_') + ':story';
}
function toggleStoryFlag(){
  const d = APP.lessonData; if (!d) return;
  const k = storyFlagKey(d.topic);
  if (APP.flagged[k]) {
    delete APP.flagged[k];
    saveFlagged(); pushFlagToServer(k, null);
  } else {
    const entry = { topic: d.topic, type: 'story', flaggedAt: new Date().toISOString() };
    APP.flagged[k] = entry; saveFlagged(); pushFlagToServer(k, entry);
  }
  _updateStoryFlagUI();
}
function saveStoryComment(){
  const d = APP.lessonData; if (!d) return;
  const k = storyFlagKey(d.topic);
  if (!APP.flagged[k]) return;
  const comment = document.getElementById('story-flag-comment')?.value?.trim() || '';
  APP.flagged[k].comment = comment; saveFlagged(); pushFlagToServer(k, APP.flagged[k]);
}
function _updateStoryFlagUI(){
  const d = APP.lessonData; if (!d) return;
  const k = storyFlagKey(d.topic);
  const flagged = !!APP.flagged[k];
  const btn = document.getElementById('story-flag-btn');
  if (btn) { btn.textContent = flagged ? '⚑ Story flagged' : '⚐ Flag story';
             btn.className = 'flag-btn' + (flagged ? ' flagged' : ''); }
  const wrap = document.getElementById('story-flag-comment-wrap');
  if (wrap) wrap.className = 'flag-comment-wrap' + (flagged ? ' visible' : '');
  const comment = APP.flagged[k]?.comment || '';
  const ta = document.getElementById('story-flag-comment');
  if (ta) ta.value = comment;
}
```

**`buildPath()`** — in the story section block, after `renderStoryText(d)`, add:
```js
const sfRow = document.getElementById('story-flag-row');
if (sfRow) sfRow.style.display = '';
_updateStoryFlagUI();
```

---

### P10 — Library: group lessons by storyline  [complex]

Replace the flat `list.innerHTML = filtered.map(...)` block in `loadSavedList()`.

**Algorithm:**
1. Build adjacency: `const children = {}` — for each saved lesson, if it has
   `continuedFrom` and that topic exists in saved, add it to `children[continuedFrom]`.
   (Use `savedFull` — the full lesson objects from `/api/lessons` which now needs to
   also return `continuedFrom`.)
2. Find roots: topics where `continuedFrom` is absent OR points to missing topic.
3. Walk chains (DFS): from each root, collect ordered arrays. Forks (multiple children)
   create parallel chains.
4. De-duplicate chains that are identical prefixes (keep longest).
5. Orphans: lessons not reachable from any root via `continuedFrom`.

**Server change needed first** — `/api/lessons` list endpoint must expose `continuedFrom`:
```js
continuedFrom: l.continuedFrom || null,
```
Add this to the map in the `/api/lessons` GET handler.

**`loadSavedList()` rendering:**

```js
// Build storyline chains
function buildChains(lessons) {
  const byTopic = Object.fromEntries(lessons.map(l => [l.topic, l]));
  const childMap = {};
  lessons.forEach(l => {
    if (l.continuedFrom && byTopic[l.continuedFrom]) {
      (childMap[l.continuedFrom] = childMap[l.continuedFrom] || []).push(l.topic);
    }
  });
  const hasParent = new Set(lessons.filter(l => l.continuedFrom && byTopic[l.continuedFrom]).map(l => l.topic));
  const roots = lessons.filter(l => !hasParent.has(l.topic));
  
  // DFS to collect all chains (each chain = array of topic strings in order)
  const chains = [];
  function walk(topic, chain) {
    const extended = [...chain, topic];
    const kids = childMap[topic] || [];
    if (kids.length === 0) { chains.push(extended); return; }
    kids.forEach(k => walk(k, extended));
  }
  roots.forEach(r => walk(r.topic, []));
  
  // Single-item chains with no parent and no children are orphans
  const inChain = new Set(chains.flat());
  const orphans = lessons.filter(l => !inChain.has(l.topic));
  const storylines = chains.filter(c => c.length > 1);
  const soloRoots = chains.filter(c => c.length === 1).map(c => byTopic[c[0]]);
  
  return { storylines, orphans: [...soloRoots, ...orphans], byTopic };
}
```

Render storylines first (sorted by newest `updatedAt` among members), then orphans.

**HTML structure:**
```html
<!-- for each storyline -->
<div class="storyline-group">
  <div class="storyline-hdr">📖 Story line · N lessons</div>
  <!-- for each topic in chain -->
  <div class="storyline-item">
    <div class="saved-item" onclick="loadSaved(t)">
      <span>↩</span>  <!-- connector, omit for first item -->
      <span class="saved-emoji">flag emoji</span>
      <div class="saved-info">...</div>
      <div class="saved-actions">...</div>
    </div>
  </div>
</div>
<!-- orphans section -->
<div class="orphans-hdr">📚 Individual lessons</div>
<!-- standard saved-items -->
```

**CSS:**
```css
.storyline-group{border:2px solid var(--gray-mid);border-radius:var(--radius-lg);margin-bottom:10px;overflow:hidden}
.storyline-hdr{background:var(--gray-light);padding:7px 13px;font-size:12px;font-weight:800;color:var(--gray-dark);border-bottom:1.5px solid var(--gray-mid)}
.storyline-item{border-top:1.5px solid var(--gray-mid)}
.storyline-item:first-of-type{border-top:none}
.storyline-item .saved-item{border:none;border-radius:0;background:var(--white)}
.storyline-connector{font-size:13px;color:var(--gray-dark);margin-right:2px;flex-shrink:0}
.orphans-hdr{font-size:12px;font-weight:800;color:var(--gray-dark);margin:14px 0 6px;padding-left:2px}
```

**Static build** (`build-static.js`): apply the same storyline grouping in the
static `loadSavedList`. `STATIC_LESSONS` already has `continuedFrom` baked in.
Sort `STATIC_LESSONS` by `updatedAt` desc before any processing.

---

### P11 — build-static.js: full overhaul  [medium]

The uploaded `build-static.js` uses the **old broken `seedBuiltins` + localStorage**
approach. Replace `staticFunctions` block entirely with the clean version:

**Replace `staticFunctions` template string:**
```js
const staticFunctions = `
const STATIC_LESSONS = ${lessonsSerialized};
// Sort newest first
STATIC_LESSONS.sort((a,b)=>(b.updatedAt||b.generatedAt||'').localeCompare(a.updatedAt||a.generatedAt||''));

async function init() {
  APP.info = { backend: 'none', canGenerate: false };
  selectLang(APP.lang);
  restoreDiffSelect();
  renderPill();
  loadSavedList();
  const hashTopic = decodeURIComponent((location.hash.match(/[#&]topic=([^&]*)/) || [])[1] || '');
  if (hashTopic) loadSaved(hashTopic);
}

function renderPill() {
  const pill=document.getElementById('bpill'), lbl=document.getElementById('blbl');
  document.getElementById('bmodel').textContent='';
  pill.className='bpill none'; lbl.textContent='Static — built-in lessons only';
  document.getElementById('gen-btn').disabled=true;
  document.getElementById('topic-input').disabled=true;
  const sel=document.getElementById('lang-select'); if(sel) sel.disabled=true;
  const note=document.getElementById('offline-note');
  note.style.display='block'; note.textContent='📦 Static version — select a topic below to start';
}

async function loadSavedList() {
  const saved = STATIC_LESSONS;
  // [same storyline grouping + rendering as P10, adapted for static]
  // Filter by APP.libFilter, build chains via buildChains(), render groups + orphans
  // Show difficulty badge + ratings
}

function setLibFilter(lang) { APP.libFilter=lang; loadSavedList(); }
async function loadSaved(topic) {
  const dec=decodeURIComponent(topic);
  const found=STATIC_LESSONS.find(l=>l.topic.toLowerCase()===dec.toLowerCase());
  if(!found){ alert('Lesson not found.'); return; }
  APP.lessonData=found; goHome();
}
function setTopic(t){ document.getElementById('topic-input').value=t; }
`;
```

**Replace `staticOverrides` array** — clean minimal set:
```js
const staticOverrides = [
  'async function syncFlagsFromServer(){}',
  'async function pushFlagToServer(){}',
  'async function deleteSaved(){}',
  'async function regenSaved(){}',
  'function regenCurrent(){}',
  'async function doGenerate(){}',
  'async function submitRating(){}',
  'function toggleChat(){}',
  'function autoResizeChat(){}',
  'function clearChat(){}',
  'async function sendChat(){ alert("Model console requires the live server."); }',
  'function toggleStory(){',
  '  const body=document.getElementById("story-body"), arrow=document.getElementById("story-arrow"); if(!body)return;',
  '  const open=body.classList.toggle("open"); if(arrow) arrow.classList.toggle("open",open);',
  '}',
  'function speakStory(){ const d=APP.lessonData; if(d&&d.story) speak(d.story); }',
  'function renderStoryText(d){',   // must match P7 version exactly
  '  const body=document.getElementById("story-body"); if(!body)return;',
  '  body.innerHTML=(d.story||"").split(/\\n\\n+/).map(p=>"<p>"+p.replace(/\\n/g,"<br>")+"</p>").join("");',
  '}',
  // toggleStoryFlag / saveStoryComment / _updateStoryFlagUI stubs (no-ops in static):
  'function toggleStoryFlag(){}',
  'function saveStoryComment(){}',
  'function _updateStoryFlagUI(){}',
].join('\n');
```

Also update `findLine` marker: currently looks for `'async function init()'` as cut
point — that still works. Verify after applying P1 that `init()` placement hasn't shifted.

---

## Sequence for next session

1. Read all three files in full before touching anything
2. Apply P1 (continue-from + sysStory rewrite — covers P3 and P5 too)
3. Apply P2 (timeout)
4. Apply P4 (remove chips)
5. Apply P6 (move story HTML)
6. Apply P7 (collapse/expand + highlighting)
7. Apply P8 (skip complete screen)
8. Apply P9 (story flagging)
9. Syntax-check everything so far
10. Apply P10 (storyline grouping — server change + index.html)
11. Apply P11 (build-static.js overhaul)
12. Final syntax check + run build-static.js against lessons.json + syntax-check output
13. Package as dreizunge_v11.zip

---

## Architecture reference

**Server endpoints (v10):**
`/api/generate`, `/api/repair`, `/api/repair-story`, `/api/rate`, `/api/flags`,
`/api/lessons` *(needs `continuedFrom` added to map — P10)*,
`/api/lessons/load`, `/api/lessons/delete`, `/api/job/:id`, `/api/info`, `/api/chat`

**Generation flow:**
1. POST `/api/generate` → `{jobId}`
2. Background: meta → story → lesson 1 → lesson 2 → lesson 3
3. Browser polls `/api/job/:id` every 2s

**`lessons.json` shape per topic:**
```json
{
  "topic": "cooking", "topicEmoji": "🍳", "lang": "it", "difficulty": 2,
  "continuedFrom": "restaurant dining",   ← optional, added by P1
  "story": "target-language prose…", "storyLang": "it",
  "generatedAt": "…", "updatedAt": "…",
  "generationStats": { "totalMs": 0, "backend": "ollama", "model": "…",
    "totalPromptTokens": 0, "totalCompletionTokens": 0, "lessons": [] },
  "ratings": { "difficulty": 2, "fun": 3, "coherence": 2 },
  "lessons": [ { "id": 1, "title": "…", "desc": "…", "icon": "…",
    "vocab": [{"it":"…","en":"…","pron":"…"}],
    "sentences": [{"it":"…","en":"…","words":["…"]}] } ]
}
```

---

## TODO (future sessions — do NOT implement in v11)

**M1. Lesson-level repair**
All LLM-based repair removed in v10. Two future modes:
- Manual: edit form per exercise (target text, translation, pronunciation, choices)
- LLM-assisted: per-exercise inline fetch using flag comment as instruction; clear flag on save

**M2. Tighten story↔lesson coherence**
After generating story, extract key named entities (characters, locations) and inject
as bullet list into each lesson prompt.

**M3. Continuation navigation links**
On home screen for loaded lesson:
- (a) "↩ based on: [topic]" — clickable, loads that ancestor
- (b) "→ continued by: [topic1]…" — scan all lessons for `continuedFrom === this.topic`
Requires `/api/continuations?topic=…` endpoint or expanding `/api/lessons` metadata.

**M4. Story lineage DAG visualisation**
Client-side using d3 or canvas. Nodes: topic + emoji + flag. Edges: `continuedFrom`.
Entry point: button on library page. Export as Graphviz `.dot`.

**M5. Rename `"it"` field to `"tl"` (target language)**
The field `"it"` in vocab/sentences causes LLMs to default to Italian.
Full rename across server.js, index.html, lessons.json (with migration).
Dedicated session — careful search-and-replace throughout.

**M6. Store story prompt + UI to view/edit**
Save exact prompt as `storyPrompt` in lessons.json.
📝 button in story header opens modal with prompt + "Regenerate with this prompt".

**M7. Extended language list**
Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro),
Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo).

**M8. TTS improvements**
- Split utterances at sentence boundaries in `speak()`
- Voice selection UI + warning if no matching voice
- Optional Piper TTS via `/api/tts` endpoint (offline neural quality)

**M9. User-supplied API keys**
Settings modal: Anthropic, OpenAI, Groq (OpenAI-compatible). Keys in localStorage,
forwarded in POST body.

**M10. Community features**
Phase 1: curated static library on GitHub Pages.
Phase 2: anonymous submissions via Cloudflare Worker + D1.
Phase 3: GitHub OAuth, upvoting, ranked feed.
