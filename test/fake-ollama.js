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

// PLAN §8/B3: vocabulary prompts require model-proposed target-language skill IDs. The fake reads
// the requested language code from that contract so it remains useful for every generated pair.
//
// v85_r: when the user message carries the SKILLDEFECT marker (a topic name a test controls), two
// items come back defective — one with the "skillId" field dropped entirely, one with a malformed
// value (wrong target-language prefix) — the two real shapes a small/local model has been observed
// to produce on an imperfect item out of eight. This is what `resolveVocabularySkillTags`'s v85_r
// fix exists to tolerate without discarding the whole lesson; see e2e-skill-tagging.test.js.
function vocabLessonWithSkills(sys, usr) {
  const m = /skill ID in the form "([^:"]+):vocab:/i.exec(sys);
  const lang = m ? m[1].toLowerCase() : 'de';
  const defect = /SKILLDEFECT/.test(usr || '');
  const out = JSON.parse(JSON.stringify(VOCAB_LESSON));
  out.vocab.forEach((item, i) => {
    item.skillId = lang + ':vocab:' + item.target.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
    if (defect && i === 1) delete item.skillId;                          // field dropped entirely
    if (defect && i === 2) item.skillId = 'xx:vocab:' + item.target.toLowerCase();  // wrong lang prefix
  });
  return out;
}

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
    let msgs = [], body = {};
    try { body = JSON.parse(raw) || {}; msgs = body.messages || []; } catch (_) {}
    const sys = (msgs.find(m => m.role === 'system') || {}).content || '';
    const usr = msgs.filter(m => m.role === 'user').map(m => m.content).join('\n') || '';
    let kind, content;
    if (/You divide a text into chapters/i.test(sys)) {
      // v71_b chapter split: answer with paragraph NUMBERS only, never text — the same contract
      // the server enforces. Cuts at 1 and the midpoint so the grouping is visibly not 1:1 with
      // paragraphs, and exercises the optional drop list when the prompt allows one.
      kind = 'chapter_split';
      const nums = (usr.match(/^\s*(\d+)\./gm) || []).map(x => parseInt(x, 10)).filter(Number.isFinite);
      const n = nums.length ? Math.max(...nums) : 1;
      const out = { chapters: [{ start: 1, title: 'Erstes Kapitel' }] };
      if (n >= 3) out.chapters.push({ start: Math.ceil(n / 2), title: 'Zweites Kapitel' });
      if (/list the numbers you are discarding/i.test(sys) && n >= 4) out.drop = [n];
      content = JSON.stringify(out);
    } else if (/write a short, coherent story in Standard/i.test(sys)) {
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
      const skillLang = ((/skill ID in the form "([^:"]+):vocab:/i.exec(sys) || [])[1] || 'de').toLowerCase();
      content = [
        'Table 1 - Vocabulary',
        '| Lëtzebuergesch word | German meaning | Pronunciation | Skill ID |',
        '| --- | --- | --- | --- |',
        `| Haus | house | hows | ${skillLang}:vocab:haus |`,
        `| Katze | cat | kah-tse | ${skillLang}:vocab:katze |`,
        `| Hund | dog | hunt | ${skillLang}:vocab:hund |`,
        `| Baum | tree | bowm | ${skillLang}:vocab:baum |`,
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
    } else if (/CORRECTNESS/.test(sys)) {
      // PLAN §D4 (v82) / v82_f: live writing-feedback grading. Deliberately checked BEFORE the
      // generic QC branch below — that branch matches on "Reply EXACTLY one of", which this prompt
      // no longer shares (v82_f reworded it), but keeping the check first costs nothing and one
      // fewer coupling to worry about if either prompt's wording moves again.
      // FAKE_WRITING_REPLY lets a test drive the shapes the parser must handle: a CORRECTNESS line
      // alone, or one followed by "<wrong> => <fix> — <note>" mistake lines.
      kind = 'writing_feedback';
      content = process.env.FAKE_WRITING_REPLY ||
        'CORRECTNESS: partially correct — The story says the cat was in the house, not the garden.\n' +
        'Ich habe => Ich habe ein — verb needs an object here\ngeht gut => geht es gut — missing "es"';
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
    } else if (/reading-comprehension quiz generator/i.test(sys)) {
      // v71_u: comprehension had no branch here, so a book arc that ticked it fell through to the
      // default and the lesson was silently skipped — which is what the e2e caught. Matched on the
      // prompt's own opening phrase, and placed BEFORE word_forms: both ask for `correctIndex`, so
      // a looser matcher would let word_forms swallow this.
      kind = 'comprehension';
      content = JSON.stringify({
        title: 'Understanding the story', desc: 'Questions about what you read', icon: '🧠',
        questions: [
          { q: 'Wo war die Katze?', choices: ['Im Haus', 'Im Baum', 'Im Wasser', 'Im Garten'],
            correctIndex: 0, why: 'The story says the cat was in the house.' },
          { q: 'Was tat der Mann?', choices: ['Er las', 'Er schlief', 'Er sang', 'Er lief'],
            correctIndex: 1, why: 'He was asleep when it happened.' },
          { q: 'Wann geschah es?', choices: ['Am Morgen', 'Am Abend', 'In der Nacht', 'Am Mittag'],
            correctIndex: 2, why: 'It happened during the night.' },
        ],
      });
    } else if (/synonyms[\s\S]*antonyms[\s\S]*homophones/i.test(sys)) {
      // synonyms: base words appear in the fake story so context-sentence attach works.
      //
      // v72_d: the two words deliberately exercise BOTH sides of verbatimStorySentence.
      //   Haus  — quotes the story sentence exactly, so the model's own sentence is kept.
      //   Katze — returns a plausible sentence that is NOT in the story (the paraphrase/invention
      //           failure a model actually makes), so it must be REJECTED and the server's own
      //           findContextSentence search used instead.
      // Both end up with a sentence, so a test that only checks "has a sentence" cannot tell the
      // paths apart — e2e-synonyms asserts the source of each.
      kind = 'synonyms';
      content = JSON.stringify({
        title: 'Synonyms', desc: 'Related words from the story', icon: '🔁',
        words: [
          { base: 'Haus', gloss: 'house', sentence: 'Die Katze und das Haus blieben gleich.', synonyms: [{ w: 'Gebäude', g: 'building' }, { w: 'Heim', g: 'home' }], antonyms: [], homophones: [] },
          { base: 'Katze', gloss: 'cat', sentence: 'Die Katze war sehr klein und grau.', synonyms: [{ w: 'Mieze', g: 'kitty' }], antonyms: [{ w: 'Hund', g: 'dog' }], homophones: [] },
          // v72_e: ANTONYM-ONLY. The prompt now tells the model that [] beats a doubtful synonym,
          // so this shape is expected rather than exceptional — the server used to drop the whole
          // word. It must survive and still produce one playable (antonym) exercise.
          { base: 'gleich', gloss: 'same', sentence: 'Die Katze und das Haus blieben gleich.', synonyms: [], antonyms: [{ w: 'anders', g: 'different' }], homophones: [] },
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
    } else if (/"writing" exercise generator/i.test(sys)) {
      // PLAN §D4 (v82): the writing lesson's STEM — a comprehension question, generated once like
      // every other type. Grading (the live half) is a separate branch below, matched on its own
      // system prompt. v82_f: source-language-only `question`, replacing the bilingual `prompt`/`hint`.
      kind = 'writing_task';
      content = JSON.stringify({
        title: 'Writing practice', desc: 'Answer a question and get feedback', icon: '✍️',
        question: 'Where was the cat?',
      });
    } else if (/You clean text extracted from a PDF/i.test(sys)) {
      // v69_m: deletion-only, as the contract requires — drop any line that looks like page
      // furniture and copy the rest verbatim. The server verifies the result is a subsequence of
      // the input, so a fake that "helpfully" reworded anything would (correctly) be rejected.
      kind = 'text_cleanup';
      const src = usr.split('\n\nYOUR PREVIOUS ATTEMPT')[0];
      // FAKE_CLEAN_MODE lets a test drive the two failure modes seen on a real PDF (v69_o):
      // 'overdelete' keeps only the first line; 'rewrite' violates the deletion-only contract.
      const mode = process.env.FAKE_CLEAN_MODE || '';
      if (mode === 'overdelete')      content = src.split('\n')[0].trim();
      else if (mode === 'rewrite')    content = 'Completely rewritten summary of the passage.';
      else content = src.split('\n')
        .filter(l => !/^(ADVERT|Read also|Photo:|Subscribe)/i.test(l.trim()))
        .join('\n').trim();
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
    // PLAN §2.4 / Track A4 milestone 2 (v85_k): comic-panel text extraction. system is EMPTY for
    // this call (unlike every other role) — see server.js's callLLMVision/_comicExtractPrompt — so
    // this is a `usr`-keyed branch, matching the prompt's own opening sentence. A test can force a
    // specific canned reply by putting a recognizable marker in place of the real crop's content —
    // there's nothing to key on in a real image, but the fake never SEES the image anyway.
    // Comic panel IMAGE DESCRIPTION (user request). A SEPARATE vision call from comic_extract below,
    // with its own prompt — hence its own branch and its own `kind`, which is what lets a test COUNT
    // describe calls and so prove the laziness rule (both options ticked => describe only for a panel
    // that produced no lettering).
    //
    // ⚠️ MUST be tested BEFORE comic_extract, not after. Both prompts legitimately open by naming the
    // same context ("This image is a single panel cropped from a comic page"), because both are
    // telling the model what it is looking at — so comic_extract's own pattern matches the DESCRIBE
    // prompt too. Ordering is what disambiguates them: this branch keys on the describe-specific
    // sentence, so it must get first refusal. Found by writing the e2e and watching a describe call
    // come back with the extraction's canned transcription.
    } else if (/Describe what is happening in it in/i.test(usr)) {
      kind = 'comic_describe';
      // v87_o: echo back whether the prompt carried the "story so far" block, so a test can prove the
      // context actually REACHED the model rather than merely being computed server-side.
      content = /story so far/i.test(usr)
        ? 'MITKONTEXT Ein Hund rennt durch den Garten. Die Sonne scheint.'
        : 'Ein Hund rennt durch den Garten. Die Sonne scheint.';
    } else if (/single panel cropped from a comic page/i.test(usr)) {
      kind = 'comic_extract';
      // FORCE_EMPTY returns a genuinely empty body, which callLLMVision treats as a FAILURE
      // ("Ollama returned empty response") — so it exercises the per-panel error path, NOT "this
      // panel has no lettering". FORCE_NOTEXT is the latter: a real wordless panel comes back as
      // ordinary prose with no CAPTION:/IN-SCENE: labels at all, which _parseComicExtraction turns
      // into empty caption+inScene with `raw` preserved. The two are genuinely different outcomes
      // and the image-description feature depends on telling them apart (it describes a panel that
      // extracted to NOTHING, and deliberately does not describe one whose extraction ERRORED).
      content = /FORCE_EMPTY/.test(usr) ? ''
        : /FORCE_NOTEXT/.test(usr) ? 'This panel contains no lettering.'
        : 'CAPTION: Fake caption text.\nIN-SCENE: Fake sign text.';
    // PLAN §2.4 / Track A4 milestone 5 (v85_o): comic panel auto-detection (one-shot enumeration).
    // Same empty-system shape as comic_extract above, keyed on THIS prompt's own opening sentence
    // instead (distinct enough not to collide: "one page of a comic" vs "single panel cropped from
    // a comic page"). The prompt is a FIXED CONSTANT (server.js's _COMIC_DETECT_PROMPT takes no
    // per-request parameters, unlike _comicExtractPrompt's lang) — there is no per-request signal
    // this fake could key a variant response on, so unlike comic_extract's (also unreachable, for
    // the same reason) FORCE_EMPTY, this branch does not attempt one. Malformed/inverted-box
    // handling is tested client-side instead (unit-comic-detect.test.js), where the actual
    // filtering logic lives. Canned response MIXES two real formats within one reply — panels 1-2 use
    // the requested `<box>` tag, panels 3-4 use bare ANGLE brackets (`<20 410 480 740>`), the format
    // v85_o's OWN live re-verification found the real qwen2.5vl:7b actually producing on a real page
    // (a genuine parser gap at the time, fixed the same cut) — so this test exercises BOTH parser
    // branches from one response, not just the idealized always-`<box>` case.
    } else if (/one page of a comic/i.test(usr)) {
      kind = 'comic_detect';
      content = ['Panel 1: <box>20 60 480 390</box>', 'Panel 2: <box>520 60 980 390</box>',
                 'Panel 3: <20 410 480 740>', 'Panel 4: <520 410 980 740>'].join('\n');
    } else if (/careful linguistic analyst/i.test(sys)) {
      // PLAN §7.0 CP2: token-level lemma/form/sense analysis (canonical-analysis.js). Reads the
      // token list straight back out of the user message so it works for whatever sentence a test
      // constructs, and DELIBERATELY OMITS any token whose surface is exactly "ZZZOMIT" — the
      // fixture unit-canonical-analysis.test.js uses to prove a token the (fake) model never
      // answered for surfaces as "unresolved", not silently dropped or fabricated.
      kind = 'canonical_analysis';
      let payload = {};
      try { payload = JSON.parse(usr); } catch (_) {}
      const toks = Array.isArray(payload.tokens) ? payload.tokens : [];
      const out = { tokens: [], phrases: [] };
      toks.forEach(t => {
        if (t.surface === 'ZZZOMIT') return;
        out.tokens.push({ i: t.i, lemma: String(t.surface || '').toLowerCase(),
          form: 'noun', sense: 'fake sense for ' + t.surface, confidence: 'high' });
      });
      if (toks.length >= 2) {
        out.phrases.push({ start: toks[0].i, end: toks[1].i,
          lemma: toks[0].surface + ' ' + toks[1].surface, gloss: 'fake phrase gloss', confidence: 'low' });
      }
      content = JSON.stringify(out);
    } else {
      kind = 'vocab'; content = JSON.stringify(vocabLessonWithSkills(sys, usr));
    }
    // v76_h: was sys.slice(0, 400). Notes appended AFTER a prompt's `system` block — the script
    // rule, the dialect note, the writing-style note, the continuation note — all fall past 400
    // chars, so any test asserting on a prompt's TAIL through readChatLog() was silently checking
    // the truncation rather than the prompt. Widened; still capped so a runaway prompt cannot fill
    // the log file.
    // v79_b: record the REQUEST OPTIONS, not just the prompts. `num_ctx` is omitted by llm.js
    // unless the caller asked for it, and Ollama silently truncates an over-long prompt when it is
    // absent — so "the server sized the context window" is a claim no prompt assertion can reach,
    // and the standing rule is that a wiring change needs a run rather than a source pin. `think`
    // is here for the same reason: the per-role reasoning toggle was guarded only by source slices
    // until now, and one of them broke on a line move while its claim stayed true.
    // images: captured as LENGTH + a short prefix, not the full base64 — a real crop can be tens of
    // KB and this log is read back into a test process; a test that needs to prove "an image arrived
    // and looked like the one sent" only needs to compare a prefix, not round-trip the whole blob.
    const _userMsg = msgs.find(m => m.role === 'user') || {};
    const _images = Array.isArray(_userMsg.images)
      ? _userMsg.images.map(s => ({ len: String(s || '').length, prefix: String(s || '').slice(0, 12) }))
      : null;
    const _opts = { think: (typeof body.think === 'boolean' ? body.think : null),
                    num_ctx: (body.options && body.options.num_ctx) || null,
                    num_predict: (body.options && body.options.num_predict) || null,
                    images: _images };
    if (LOG) { try { fs.appendFileSync(LOG, JSON.stringify({ kind, sys: sys.slice(0, 8000), usr, opts: _opts }) + '\n'); } catch (_) {} }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: { role: 'assistant', content }, done: true }));
  }
  res.writeHead(404); res.end('nope');
});

const PORT = parseInt(process.argv[2] || '0', 10);
srv.listen(PORT, () => { console.log('FAKE_OLLAMA_PORT=' + srv.address().port); });
