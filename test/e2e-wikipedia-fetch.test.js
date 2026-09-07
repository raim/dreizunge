// E2E (live server + a stub MediaWiki): v90_q — POST /api/fetch-url reads a Wikipedia URL through
// the API instead of scraping it, and returns the SAME shape the scrape path does.
//
// ⚠️ Driven against a real stub HTTP server via WIKIPEDIA_ORIGIN, not by monkey-patching the fetch —
// same reasoning as e2e-fetch-url's stub publisher: a test that replaces the transport asserts
// against a re-implementation.
'use strict';
const http = require('http');
const { boot, post, assert, tmpFile } = require('./lib');

const EXTRACT = 'South Tyrol is an autonomous province in northern Italy.\n\n\n== History ==\n\n'
  + 'The area was annexed in 1919 and has been autonomous since 1972. '.repeat(3)
  + '\n\n=== Autonomy ===\n\nThe statute grants wide powers to the province.\n';

function page(over) {
  return { batchcomplete: true, query: {
    general: { sitename: 'Wikipedia', lang: 'en' },
    rightsinfo: { text: 'Creative Commons Attribution-Share Alike 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    pages: [Object.assign({
      pageid: 1, title: 'South Tyrol', fullurl: 'https://en.wikipedia.org/wiki/South_Tyrol',
      revisions: [{ timestamp: '2026-08-20T21:53:30Z' }], extract: EXTRACT,
    }, over || {})] } };
}

function startStub() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const title = u.searchParams.get('titles') || '';
      const send = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (u.pathname !== '/w/api.php') { res.writeHead(404); return res.end('no'); }
      if (/Missing/i.test(title)) return send(page({ missing: true, extract: undefined, pageid: undefined }));
      if (/Empty/i.test(title))   return send(page({ extract: '   ' }));
      if (/Broken/i.test(title))  { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{not json'); }
      if (/Down/i.test(title))    { res.writeHead(503); return res.end('nope'); }
      return send(page({ title: title || 'South Tyrol' }));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

(async () => {
  const { srv, port } = await startStub();
  const env = await boot({ log: true, extraEnv: {
    DRAFTS_FILE: tmpFile('dz_drafts', '.json'),
    WIKIPEDIA_ORIGIN: `http://127.0.0.1:${port}`,
  } });
  let failed = false;
  try {
    const { sport } = env;
    const fetchUrl = u => post(sport, '/api/fetch-url', { url: u });
    const W = t => `https://en.wikipedia.org/wiki/${t}`;

    // ── 1. The happy path, and the field the news path can never fill ────────────────────────
    {
      const r = await fetchUrl(W('South_Tyrol'));
      assert(r.status === 200 && r.body.ok === true, `a Wikipedia article succeeds (got ${r.status} ${r.raw.slice(0,160)})`);
      assert(/^South Tyrol is an autonomous province/.test(r.body.text), 'the extract is returned as the story text');
      assert(r.body.headline === 'South Tyrol', `the page title is the topic title (got ${JSON.stringify(r.body.headline)})`);
      // ⚠️ THE POINT OF USING THE API. A newspaper never tells you this; Wikipedia does, machine-readably.
      assert(r.body.licence === 'Creative Commons Attribution-Share Alike 4.0',
        `the LICENCE comes back, which is what makes reuse honest (got ${JSON.stringify(r.body.licence)})`);
      assert(r.body.url === 'https://en.wikipedia.org/wiki/South_Tyrol', 'the canonical url is recorded');
      assert(r.body.publisher === 'Wikipedia' && r.body.datePublished === '2026-08-20T21:53:30Z',
        'publisher and last-edit date are carried');
      assert(r.body.author === '',
        'and NO author is invented — a wiki has no single one, and a false attribution is worse than none');
      console.log('  a Wikipedia article returns text, title, canonical url, date AND licence: OK');
    }

    // ── 2. `==` markup is gone, heading text survives, paragraphs survive ────────────────────
    {
      const r = await fetchUrl(W('South_Tyrol'));
      assert(!/=/.test(r.body.text), `no '=' markup reaches the client (got ${JSON.stringify(r.body.text.slice(0,90))})`);
      assert(/History/.test(r.body.text), 'the heading TEXT is kept — it titles the chapter that follows');
      // ⚠️ The structural advantage over a JSON-LD articleBody, which has ZERO newlines.
      assert((r.body.text.match(/\n/g) || []).length >= 2,
        'paragraph structure survives, which is what makes paragraph-mode chaptering possible here');
      console.log('  headings de-marked, paragraph structure intact: OK');
    }

    // ── 3. Every failure shape refuses cleanly, in the SAME shape the scrape path uses ───────
    // So the client needs no new branch and no new string for any of them.
    // ⚠️ `pg.missing` is an EQUIVALENT MUTANT and is left alone deliberately: deleting that check
    // keeps this file green, because a missing page has no extract and the MIN_BODY_CHARS gate
    // refuses it anyway. It is kept for what it documents — MediaWiki's actual contract — not
    // because it is load-bearing. Judged, not counted (`v90_d`'s own rule about survivor lists).
    for (const [title, why] of [['Missing_Page', 'MediaWiki reports missing:true for an unknown title'],
                                ['Empty_Page', 'an extract of only whitespace is not an article'],
                                ['Broken_Page', 'a non-JSON body is refused, not thrown'],
                                ['Down_Page', 'a non-2xx from the API is refused']]) {
      const r = await fetchUrl(W(title));
      assert(r.status === 200, `${title}: the route itself still answers 200 (got ${r.status})`);
      assert(r.body.ok === false, `${title}: refused — ${why}`);
      assert(!r.body.text, `${title}: no text is handed back`);
    }
    console.log('  missing / empty / malformed / 5xx all refuse in the scrape path\'s own shape: OK');

    // ── 4. ⚠️ NON-ARTICLE WIKIPEDIA URLS FALL THROUGH, they are not half-handled ─────────────
    // A Talk: page is not an article, so it must take the ordinary scrape path — which will refuse
    // it for its own reasons. The stub is never asked about it: if it were, the fall-through broke.
    {
      const r = await fetchUrl('https://en.wikipedia.org/wiki/Talk:South_Tyrol');
      assert(r.body.ok === false, 'a Talk: page does not come back as an article');
      assert(!r.body.licence, 'and it did NOT go through the Wikipedia path (no licence was filled)');
      console.log('  a Talk: page falls through to the scrape path rather than being half-handled: OK');
    }

    console.log('e2e-wikipedia-fetch: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-wikipedia-fetch FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-20).join('\n'));
  } finally {
    srv.close();
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
