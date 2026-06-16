// Fake Ollama for headless tests. Exposes:
//   GET  /api/tags   -> {models:[{name:"fake"}]}
//   POST /api/chat   -> canned content chosen by inspecting the prompt
// If env FAKE_LOG is set, every /api/chat request is appended there as JSONL
// ({kind, sys, usr}) so tests can assert on the exact prompts the server sent.
//
// Routing (order matters):
//   1. system mentions "single JSON object" / "series title"  -> storyline title
//   2. user mentions "Chapter 1:"                              -> chapter titles array
//   3. user mentions story-generation phrasing                -> a story (prefixed
//      with a unique STORYTEXT[...] marker so chapters are distinguishable)
//   4. otherwise                                              -> a valid vocab lesson
const http = require('http');
const fs = require('fs');

const LOG = process.env.FAKE_LOG || null;
if (LOG) { try { fs.unlinkSync(LOG); } catch (_) {} }

function readBody(req) {
  return new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
}

const VOCAB_LESSON = {
  title: 'Fake lesson', desc: 'test vocab', icon: '📘',
  vocab: [
    { target: 'Haus', source: 'house' }, { target: 'Katze', source: 'cat' },
    { target: 'Hund', source: 'dog' }, { target: 'Baum', source: 'tree' },
    { target: 'Wasser', source: 'water' }, { target: 'Buch', source: 'book' },
    { target: 'Tag', source: 'day' }, { target: 'Nacht', source: 'night' },
  ],
  sentences: [
    { target: 'Das Haus ist groß.', source: 'The house is big.' },
    { target: 'Die Katze schläft.', source: 'The cat sleeps.' },
    { target: 'Der Hund läuft.', source: 'The dog runs.' },
    { target: 'Der Baum ist hoch.', source: 'The tree is tall.' },
    { target: 'Ich trinke Wasser.', source: 'I drink water.' },
  ],
};

const srv = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/tags') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ models: [{ name: 'fake' }] }));
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    const raw = await readBody(req);
    let msgs = []; try { msgs = JSON.parse(raw).messages || []; } catch (_) {}
    const sys = (msgs.find(m => m.role === 'system') || {}).content || '';
    const usr = msgs.filter(m => m.role === 'user').map(m => m.content).join('\n') || '';
    let kind, content;
    if (/single JSON object|series title/i.test(sys)) {
      kind = 'storyline_title'; content = JSON.stringify({ title: 'The Fake Saga', icon: '📘' });
    } else if (/Chapter 1:/i.test(usr)) {
      kind = 'chapter_titles'; content = JSON.stringify(['Chapter One', 'Chapter Two', 'Chapter Three']);
    } else if (/Write the continuation now|Write a story for the topic|Plain prose/i.test(usr)) {
      kind = 'story';
      content = 'STORYTEXT[' + Date.now() + '] Es war einmal ein Test. Die Katze und das Haus blieben gleich.';
    } else {
      kind = 'vocab'; content = JSON.stringify(VOCAB_LESSON);
    }
    if (LOG) { try { fs.appendFileSync(LOG, JSON.stringify({ kind, sys: sys.slice(0, 400), usr }) + '\n'); } catch (_) {} }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: { role: 'assistant', content }, done: true }));
  }
  res.writeHead(404); res.end('nope');
});

const PORT = parseInt(process.argv[2] || '0', 10);
srv.listen(PORT, () => { console.log('FAKE_OLLAMA_PORT=' + srv.address().port); });
