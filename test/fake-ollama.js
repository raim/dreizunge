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
    // Report several models so tests can exercise the model picker + per-role switching. The
    // 'fake-translategemma' name flips the server's lesson format to 'table' (name-derived).
    return res.end(JSON.stringify({ models: [
      { name: 'fake' }, { name: 'fake-lessons' }, { name: 'fake-transl' }, { name: 'fake-translategemma' },
    ] }));
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    const raw = await readBody(req);
    let msgs = []; try { msgs = JSON.parse(raw).messages || []; } catch (_) {}
    const sys = (msgs.find(m => m.role === 'system') || {}).content || '';
    const usr = msgs.filter(m => m.role === 'user').map(m => m.content).join('\n') || '';
    let kind, content;
    if (/write a short, coherent story in Standard/i.test(sys)) {
      // V2 step 1: a Standard-German story (plain text, no blocks).
      kind = 'std_story';
      content = 'Heute ist ein schöner Tag. Ich habe ein Mädchen gesehen.';
    } else if (/rewrite a Standard .* story into a regional dialect/i.test(sys)) {
      // V2 step 2: the constrained dialect rewrite (STORY/GERMAN blocks). Reuse a glossary word so
      // coverage is > 0.
      kind = 'dialect_rewrite';
      content = 'STORY:\nHeint is a scheena Tog. I hon a Gitsche gsegn.\n---\nGERMAN:\nHeute ist ein schöner Tag. Ich habe ein Mädchen gesehen.';
    } else if (/write a short, coherent story in a regional dialect/i.test(sys)) {
      // Dialect STORY (M2): return valid STORY/GERMAN blocks reusing a glossary word.
      kind = 'dialect_story';
      content = 'STORY:\nHeint is a scheena Tog. I hon a Gitsche gsegn.\n---\nGERMAN:\nHeute ist ein schöner Tag. Ich habe ein Mädchen gesehen.';
    } else if (/Output TWO markdown tables/i.test(sys)) {
      // Table-format lesson (translategemma-style): two markdown tables, vocab then sentences.
      // A non-pipe heading between them lets the server's parseTableLesson stop table 1 correctly.
      kind = 'vocab_table';
      content = [
        'Table 1 - Vocabulary',
        '| Lëtzebuergesch word | German meaning | Pronunciation |',
        '| --- | --- | --- |',
        '| Haus | house | hows |',
        '| Katze | cat | kah-tse |',
        '| Hund | dog | hunt |',
        '| Baum | tree | bowm |',
        'Table 2 - Sentences',
        '| Lëtzebuergesch sentence | German translation |',
        '| --- | --- |',
        '| Das Haus ist groß. | The house is big. |',
        '| Die Katze schläft. | The cat sleeps. |',
      ].join('\n');
    } else if (/professional translator\. Translate the following/i.test(sys)) {
      // Story translation (only requested when the translation model differs from the story model).
      kind = 'translation';
      content = 'Once upon a time there was a test. The cat and the house stayed the same.';
    } else if (/single JSON object|series title/i.test(sys)) {
      kind = 'storyline_title'; content = JSON.stringify({ title: 'The Fake Saga', icon: '📘' });
    } else if (/concise summary|captures the main arc/i.test(sys)) {
      kind = 'summary'; content = 'FAKE SUMMARY: a tidy recap of the chapters and their vocabulary themes, in the source language.';
    } else if (/Reply EXACTLY one of/i.test(sys)) {
      // QC pair-check: flag the source side with a fixed correction (deterministic).
      kind = 'qc'; content = 'S: KORRIGIERT';
    } else if (/storyboard panels|illustrator for a language-learning storybook/i.test(sys)) {
      // v68.1: storyline storyboard — a minimal VALID panel array (composeStoryboardSVG validates
      // shape types, palette names, and 0-100 coordinates; anything else is discarded).
      kind = 'storyboard';
      content = JSON.stringify([
        { caption: 'A fake beginning', chapter: 1, bg: 'sky',
          shapes: [ { type: 'rect', x: 0, y: 60, w: 100, h: 40, fill: 'leaf' },
                    { type: 'circle', cx: 30, cy: 30, r: 10, fill: 'sun' },
                    { type: 'rect', x: 55, y: 40, w: 20, h: 25, fill: 'earth' },
                    { type: 'polygon', points: [[55,40],[65,28],[75,40]], fill: 'rose' },
                    { type: 'line', x1: 10, y1: 90, x2: 90, y2: 90, stroke: 'ink', sw: 2 } ] },
        { caption: 'A fake ending', chapter: 2, bg: 'night',
          shapes: [ { type: 'rect', x: 0, y: 70, w: 100, h: 30, fill: 'stone' },
                    { type: 'circle', cx: 70, cy: 20, r: 8, fill: 'white' },
                    { type: 'ellipse', cx: 40, cy: 80, rx: 12, ry: 6, fill: 'water' },
                    { type: 'polyline', points: [[20,60],[30,50],[40,60]], stroke: 'ink', sw: 2 },
                    { type: 'rect', x: 60, y: 55, w: 18, h: 20, fill: 'earth' } ] },
      ]);
    } else if (/synonyms[\s\S]*antonyms[\s\S]*homophones/i.test(sys)) {
      // synonyms: base words appear in the fake story so context-sentence attach works.
      kind = 'synonyms';
      content = JSON.stringify({
        title: 'Synonyms', desc: 'Related words from the story', icon: '🔁',
        words: [
          { base: 'Haus', gloss: 'house', synonyms: [{ w: 'Gebäude', g: 'building' }, { w: 'Heim', g: 'home' }], antonyms: [], homophones: [] },
          { base: 'Katze', gloss: 'cat', synonyms: [{ w: 'Mieze', g: 'kitty' }], antonyms: [{ w: 'Hund', g: 'dog' }], homophones: [] },
        ],
      });
    } else if (/word.?forms.*exercise generator|"correctIndex"/i.test(sys)) {
      // word_forms: items must be derived from the fake story text below.
      kind = 'word_forms';
      content = JSON.stringify({
        title: 'Word Forms', desc: 'Pick the form that fits', icon: '🧩',
        items: [
          { sentence: 'Es war einmal ein ___.', translation: 'Once upon a time there was a test.',
            choices: ['Test', 'Tests', 'Teste', 'Testen'], correctIndex: 0, explanation: 'Singular nach „ein".' },
          { sentence: 'Die Katze und das ___ blieben gleich.', translation: 'The cat and the house stayed the same.',
            choices: ['Haus', 'Häuser', 'Hauses', 'Häusern'], correctIndex: 0, explanation: 'Nominativ Singular, neutrum.' },
        ],
      });
    } else if (/corrupted version by introducing exactly/i.test(sys)) {
      // v69_g: the error-hunt generator had NO branch here — the request fell through to the vocab
      // default and returned JSON, which the old server-side checks ("not empty", "not identical")
      // happily stored as the corrupted story. The e2e was passing on an unplayable lesson. The
      // fake now does what the prompt asks: return the SAME story with a few single words altered
      // in place, so the word count is unchanged and the client's positional diff can find them.
      kind = 'error_hunt';
      const m = usr.match(/story:\n\n([\s\S]*?)\n\nReturn the corrupted story now\./);
      const story = m ? m[1] : '';
      content = story.split(/(\s+)/).map(tok => {
        if (/^\s+$/.test(tok) || tok.length < 4) return tok;   // keep separators and short words
        return tok.slice(0, 2) + tok[1] + tok.slice(2);        // double one interior letter
      }).join('');
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
