// unit-wikipedia-source.test.js
// v90_q — Wikipedia is read through MediaWiki's OWN API, not scraped, and the chapter-size ruler
// reports the count it actually produces.
//
// ⚠️ WHY A SECOND SOURCE EXISTS AT ALL. Wikipedia serves `@type: Article` with `articleBody: ""`
// (measured on en. and de.), so the JSON-LD path refuses it — correctly, and that refusal is
// guarded in e2e-fetch-url. What the API gives instead is strictly better than scraping could
// recover: plain text with no citation markers and no `[edit]`, REAL paragraph structure (379
// newlines in the English article against ZERO in a JSON-LD articleBody), and — uniquely — the
// LICENCE, machine-readably.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { wikipediaTarget, stripWikiMarkup } = require(path.join(ROOT, 'news-article.js'));
const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. Which URLs are Wikipedia ARTICLES, both directions ────────────────────
{
  const yes = {
    'https://en.wikipedia.org/wiki/South_Tyrol':               ['en', 'South Tyrol'],
    'https://de.wikipedia.org/wiki/S%C3%BCdtirol':             ['de', 'Südtirol'],
    'https://en.m.wikipedia.org/wiki/Rome':                    ['en', 'Rome'],
    // ⚠️ `simple` is the reason the language pattern is not `[a-z]{2,3}`: Simple English Wikipedia
    // is the single most useful wiki for a language learner, and a strict ISO-639 test rejects it.
    'https://simple.wikipedia.org/wiki/Rome':                  ['simple', 'Rome'],
    'https://zh-yue.wikipedia.org/wiki/Rome':                  ['zh-yue', 'Rome'],
  };
  for (const [url, [lang, title]] of Object.entries(yes)) {
    const got = wikipediaTarget(url);
    assert.ok(got, `${url} is recognised as a Wikipedia article`);
    assert.strictEqual(got.lang, lang, `${url} → lang`);
    assert.strictEqual(got.title, title, `${url} → title (percent-decoded, underscores as spaces)`);
  }
  // ⚠️ Everything below must fall THROUGH to the ordinary scrape path rather than be half-handled.
  const no = [
    'https://en.wikipedia.org/wiki/Talk:Rome',        // a namespaced page is not an article
    'https://en.wikipedia.org/wiki/Special:Random',
    'https://en.wikipedia.org/wiki/File:Rome.jpg',
    'https://en.wikipedia.org/w/index.php?title=Rome', // query form, not /wiki/
    'https://www.wikipedia.org/wiki/Rome',             // the portal serves no articles
    'https://en.wiktionary.org/wiki/Rome',             // a different project entirely
    'https://corrieredellaltoadige.corriere.it/x.shtml',
    'not a url', '',
  ];
  for (const url of no) assert.strictEqual(wikipediaTarget(url), null, `${JSON.stringify(url)} is NOT a Wikipedia article`);
  console.log(`  ${Object.keys(yes).length} article URLs recognised, ${no.length} correctly fall through: OK`);
}

// ── 2. ⚠️ THE NAMESPACE TEST IS STRUCTURAL, NOT A WORD LIST ──────────────────
// `Talk:`/`Special:`/`Datei:`/`Categoria:` differ in every language. Matching them by NAME would be
// a hand-authored language table, which this project's standing design principle forbids. The rule
// is "a colon before any space", which holds in every language — and must keep holding for titles
// that legitimately CONTAIN a colon later on.
{
  assert.strictEqual(wikipediaTarget('https://de.wikipedia.org/wiki/Diskussion:Rom'), null,
    'a German namespace is rejected without the code knowing the German word for it');
  assert.strictEqual(wikipediaTarget('https://it.wikipedia.org/wiki/Discussione:Roma'), null,
    'and an Italian one');
  const ok = wikipediaTarget('https://en.wikipedia.org/wiki/Star_Wars:_Episode_IV');
  assert.ok(ok && ok.title === 'Star Wars: Episode IV',
    `a real title containing a colon AFTER a space is still an article (got ${JSON.stringify(ok)})`);
  console.log('  namespaces rejected structurally, and a colon inside a real title survives: OK');
}

// ── 3. Section markers lose their `=`, keep their text ───────────────────────
{
  const src = '== History ==\n\nRome was founded.\n\n\n=== Early ===\n\nMore text.\n';
  const out = stripWikiMarkup(src);
  assert.ok(!/=/.test(out), `no '=' markup survives (got ${JSON.stringify(out)})`);
  assert.ok(/History/.test(out) && /Early/.test(out),
    'but the heading TEXT is kept — _autoTitle treats a short unpunctuated line as the title of the ' +
    'chapter that follows, so throwing it away would lose real chapter titles');
  assert.ok(/Rome was founded\./.test(out), 'and the prose is untouched');
  assert.ok(!/\n{3,}/.test(out), 'runs of blank lines are collapsed');
  console.log('  == Heading == → Heading, prose untouched: OK');
}

// ── 4. ⚠️ THE TRAILING BOILERPLATE IS DELIBERATELY NOT TRIMMED ───────────────
// Guarded as an ABSENCE, because the tempting "fix" is a word list. References/External links sit in
// the last ~2% of the text (char 64553 of 65663, measured on the English article) and are dropped in
// the chunk review card — the same argument the news path already makes.
{
  // ⚠️ COMMENTS ARE STRIPPED FIRST, and that is not a detail: the first draft of this check read the
  // raw file and went red on `news-article.js`'s own comment EXPLAINING why the trim is not done.
  // A guard about what the CODE does must not be defeated by prose describing it.
  const raw = fs.readFileSync(path.join(ROOT, 'news-article.js'), 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const word of ['References', 'External links', 'Einzelnachweise', 'Weblinks',
                      'Collegamenti esterni', 'Bibliografia', 'See also']) {
    assert.ok(!src.includes(word),
      `news-article.js must not name the section '${word}' — matching boilerplate headings by name ` +
      'is a hand-authored language table, and this project forbids language knowledge in the code. ' +
      'The review card drops them instead.');
  }
  console.log('  no section-heading word list crept into the source: OK');
}

// ── 5. The ruler reports the count it ACTUALLY produces, at zero key cost ────
{
  const at = client.indexOf('\nfunction _chunkRulerLabel(');
  assert.ok(at > 0, 'the ruler label is a named function (if renamed, update this guard)');
  const b = client.indexOf('{', at); let d = 0, i = b;
  for (; i < client.length; i++) { if (client[i] === '{') d++; else if (client[i] === '}') { d--; if (!d) { i++; break; } } }
  const body = client.slice(at, i);
  // DRIVEN, not regexed: build it with a fake t() and a fake chunk list and read what it returns.
  const make = new Function('t', '_pdfChunks', body + '\nreturn _chunkRulerLabel;');
  const t = (k, v) => ({ 'pdf.words': `${v.n} words`, 'pdf.chapters': `${v.n} chapters` }[k] || k);
  assert.strictEqual(make(t, new Array(32))(300), '300 words · 32 chapters',
    'the readout names the words per chapter AND the resulting chapter count');
  assert.strictEqual(make(t, new Array(10))(1000), '1000 words · 10 chapters', 'and tracks both numbers');
  assert.strictEqual(make(t, [])(300), '300 words · 0 chapters', 'an empty document does not crash it');
  // ⚠️ ZERO new ui.json keys: both halves are existing, already-translated strings.
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  assert.ok(ui.en['pdf.words'] && ui.en['pdf.chapters'],
    'both keys the ruler composes already exist — it introduced none');
  assert.ok(/t\('pdf\.words'/.test(body) && /t\('pdf\.chapters'/.test(body),
    'and it composes them through t(), so it is translated everywhere rather than English-only');
  console.log('  the ruler reports words AND chapters, from two existing translated keys: OK');
}

console.log('unit-wikipedia-source: ALL PASSED');
