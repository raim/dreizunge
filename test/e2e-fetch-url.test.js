// E2E (live server + a stub publisher): v90_m — scrape a story straight from a URL, scoped to the
// schema.org NewsArticle class.
//
// ⚠️ EVERY FIXTURE BELOW IS A REDUCTION OF A PAGE THAT WAS ACTUALLY FETCHED AND MEASURED, not an
// invented shape. The two that matter most are traps this feature was measured INTO, and each one
// defeats the obvious implementation:
//
//   * ERROR_PAGE — the tagesschau.de 404. roadmap_v90.md recorded it as "a JSON-LD block with no
//     article in it" and concluded the test should be "an articleBody came back". Re-probing it
//     showed that conclusion is WRONG: the 404 page carries a real NewsArticle with a NON-EMPTY
//     964-char / 133-word articleBody (a German error message). An articleBody test PASSES on it.
//     The gate that catches it is the HTTP status, and §3 fails if that gate is removed.
//   * NO_BODY — en.wikipedia.org. HTTP 200, @type Article, articleBody "". The status gate alone
//     lets this through as a story with no text, so §4 is the other half of the pair. Neither gate
//     is sufficient alone; that is the whole point of having both.
//
// Also covered: the happy path with full provenance mapping (§2), refusal WITHOUT falling back to
// the page's <p> furniture (§4 asserts the noise is absent, which is the feature's actual thesis),
// redirects and the final-URL rule (§5), and caller-error status codes (§1).
'use strict';
const http = require('http');
const { boot, post, assert, tmpFile } = require('./lib');

// ── The stub publisher ────────────────────────────────────────────────────────────────────────
// A real HTTP server, not a monkey-patch: the route under test does its own DNS/socket work and a
// stub that replaced `https.get` would be asserting against a re-implementation — the exact shape
// this project's own rules call a vacuous guard. This is also why /api/fetch-url accepts http://.
const ARTICLE_BODY = 'A ottant anni dall Accordo di Parigi del 5 settembre 1946, l autonomia del '
  + 'Trentino-Alto Adige torna protagonista. Nella mattinata di domani, al Kursaal di Merano, sono '
  + 'attesi il presidente della Repubblica e il suo omologo austriaco. I due si erano gia incontrati '
  + 'nella citta del Passirio nel 2017, in occasione del venticinquesimo anniversario.';
// The furniture a generic <p> extractor would pull in. Measured at ~45% of the real article on the
// page this was built against; §4 asserts none of it can ever reach the client.
const FURNITURE = ['<p>Abbonati subito e sostieni il giornalismo di qualita ogni giorno.</p>',
                   '<p>Leggi anche: tutte le notizie della sezione politica di oggi.</p>',
                   '<p>Iscriviti alla newsletter per ricevere gli aggiornamenti quotidiani.</p>',
                   '<p>Segui il Corriere su Facebook, Twitter e Instagram per non perdere nulla.</p>'].join('\n');

const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

const ARTICLE_PAGE = `<html><head>
${ld({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] })}
${ld({ '@context': 'https://schema.org', '@type': 'NewsArticle',
       headline: 'Accordo De Gasperi-Gruber, tutto pronto per l arrivo di Mattarella',
       articleBody: ARTICLE_BODY,
       author: { '@type': 'Person', name: 'Andrea Dalla Serra' },
       publisher: { '@type': 'Organization', name: 'Corriere della Sera' },
       datePublished: '2026-09-04T10:22:41+0200',
       // ⚠️ The real page declares this while serving the COMPLETE body — see news-article.js's
       // header. It is in the fixture so that anyone who later keys a "truncated" warning off it
       // discovers here that it fires on a known-good article.
       isAccessibleForFree: 'False' })}
${ld({ '@context': 'https://schema.org', '@type': 'NewsMediaOrganization', name: 'Corriere' })}
</head><body>${FURNITURE}<p>${ARTICLE_BODY}</p></body></html>`;

// The tagesschau 404: a NewsArticle with a real, non-empty body that is an error message.
const ERROR_PAGE = `<html><head>${ld({ '@type': 'NewsArticle',
  headline: 'Ein Fehler ist aufgetreten (#404)',
  articleBody: 'Liebe Nutzerinnen und Nutzer, leider ist die von Ihnen gewuenschte Seite nicht '
    + 'verfuegbar. Dies kann mehrere Ursachen haben. Moeglicherweise liegen die gesuchten Inhalte '
    + 'nicht mehr vor, oder die Adresse wurde falsch eingegeben.',
  author: { '@type': 'Organization', name: 'tagesschau.de' } })}</head><body>${FURNITURE}</body></html>`;

// Wikipedia: 200, an Article, and no body at all.
const NO_BODY_PAGE = `<html><head>${ld({ '@type': 'Article', headline: 'autonomous province of Italy',
  articleBody: '', author: { '@type': 'Organization', name: 'Contributors to Wikimedia projects' } })}
</head><body>${FURNITURE}</body></html>`;

// A page with no structured data whatsoever — plenty of prose, none of it offered as an article.
const PLAIN_PAGE = `<html><head><title>Nothing structured here</title></head><body>${FURNITURE}</body></html>`;

// A malformed ld+json block SITTING BEFORE the good one: one bad block must not lose a good article.
const MALFORMED_FIRST = `<html><head>
<script type="application/ld+json">{ this is not json at all ,,, }</script>
${ld({ '@type': 'NewsArticle', headline: 'Survived a broken sibling', articleBody: ARTICLE_BODY,
       author: 'A Bare String Author' })}
</head><body></body></html>`;

// The article delivered inside an @graph, which is how many CMSes ship it.
//
// ⚠️ THE FIRST @graph ENTRY IS A `Comment` THAT ALSO CARRIES A LONG `articleBody`, AND IT IS THERE
// TO MAKE THE @type GATE DISTINGUISHABLE. Found by mutation: with an ordinary fixture, deleting the
// @type check entirely left this whole file GREEN, because every non-article block in it also
// happened to lack an articleBody — so the body gate was silently doing all the work and the @type
// gate was asserting nothing. A marked-up comment thread is a real shape, and it is exactly what a
// body-gate-only implementation would hand back as the story.
const GRAPH_PAGE = `<html><head>${ld({ '@context': 'https://schema.org', '@graph': [
  { '@type': 'WebSite', name: 'Some Site' },
  { '@type': 'Comment', author: { name: 'A Commenter' },
    articleBody: 'Non sono affatto d accordo con questo articolo, e vi spiego subito il motivo '
      + 'per cui trovo l analisi del tutto fuorviante e parziale rispetto ai fatti riportati.' },
  { '@type': ['NewsArticle', 'Article'], headline: 'Delivered in an @graph',
    articleBody: ARTICLE_BODY, author: { name: 'Graph Author' } } ] })}</head><body></body></html>`;

function startStub() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const send = (code, html) => { res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); };
      const p = req.url;
      if (p === '/article') return send(200, ARTICLE_PAGE);
      if (p === '/error-page') return send(404, ERROR_PAGE);       // ⚠️ 404 WITH a NewsArticle
      if (p === '/no-body') return send(200, NO_BODY_PAGE);
      if (p === '/plain') return send(200, PLAIN_PAGE);
      if (p === '/malformed-first') return send(200, MALFORMED_FIRST);
      if (p === '/graph') return send(200, GRAPH_PAGE);
      // One page per @type, each carrying the SAME real articleBody — so the only thing that can
      // decide accept/refuse is the type itself, not the body.
      if (p.startsWith('/type/')) {
        const ty = decodeURIComponent(p.slice('/type/'.length));
        return send(200, `<html><head>${ld({ '@type': ty, headline: 'Typed', articleBody: ARTICLE_BODY,
          author: { name: 'Someone' } })}</head><body></body></html>`);
      }
      if (p === '/redirect') { res.writeHead(301, { Location: '/article' }); return res.end(); }
      if (p === '/redirect-loop') { res.writeHead(302, { Location: '/redirect-loop' }); return res.end(); }
      return send(404, '<html><body>plain 404, no structured data</body></html>');
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

(async () => {
  const { srv, port: stubPort } = await startStub();
  const env = await boot({ log: true, extraEnv: { DRAFTS_FILE: tmpFile('dz_drafts', '.json') } });
  const base = `http://127.0.0.1:${stubPort}`;
  let failed = false;
  try {
    const { sport } = env;
    const fetchUrl = u => post(sport, '/api/fetch-url', { url: u });

    // ── 1. Caller errors are 400, upstream failures are 502 ───────────────────────────────────
    {
      const empty = await fetchUrl('');
      assert(empty.status === 400, 'an empty url is rejected (got ' + empty.status + ')');
      const garbage = await fetchUrl('not a url');
      assert(garbage.status === 400, 'a malformed url is the CALLER\'s error, not a 502 (got ' + garbage.status + ')');
      const scheme = await fetchUrl('ftp://example.com/x');
      assert(scheme.status === 400, 'a non-http(s) scheme is refused (got ' + scheme.status + ')');
      const tooLong = await fetchUrl('https://example.com/' + 'x'.repeat(2100));
      assert(tooLong.status === 400, 'an over-long url is refused (got ' + tooLong.status + ')');
      const dead = await post(sport, '/api/fetch-url', {});
      assert(dead.status === 400, 'a body with no url at all is refused (got ' + dead.status + ')');
      console.log('  caller errors are 400, not 502, and none of them reaches the network: OK');
    }

    // ── 2. The happy path: the article, and every provenance field ────────────────────────────
    {
      const r = await fetchUrl(base + '/article');
      assert(r.status === 200 && r.body.ok === true, 'a NewsArticle page succeeds (got ' + r.status + ' ' + r.raw.slice(0, 200) + ')');
      // Equality on the whole body, not containment — this project's standing rule: a `includes`
      // check would pass just as happily if the furniture had been concatenated onto the article.
      assert(r.body.text === ARTICLE_BODY, 'the articleBody is returned EXACTLY, with nothing appended');
      assert(r.body.headline === 'Accordo De Gasperi-Gruber, tutto pronto per l arrivo di Mattarella',
        'the headline is the topic title, not part of the body (got ' + JSON.stringify(r.body.headline) + ')');
      assert(r.body.author === 'Andrea Dalla Serra', 'author.name → source.author (got ' + JSON.stringify(r.body.author) + ')');
      assert(r.body.publisher === 'Corriere della Sera', 'publisher.name is carried (got ' + JSON.stringify(r.body.publisher) + ')');
      assert(r.body.datePublished === '2026-09-04T10:22:41+0200', 'datePublished is carried verbatim');
      assert(r.body.url === base + '/article', 'the fetched url is returned for source.url');
      assert(r.body.bodyWords === ARTICLE_BODY.trim().split(/\s+/).length,
        'bodyWords counts the ARTICLE (got ' + r.body.bodyWords + ')');
      // ⚠️ The article page carries THREE ld+json blocks and the NewsArticle is the SECOND. If this
      // ever regresses to "first block wins" it returns the BreadcrumbList and finds no body.
      console.log('  a NewsArticle page: exact body + all five provenance fields, from block 2 of 3: OK');
    }

    // ── 3. ⚠️ THE 404 THAT CARRIES A REAL ARTICLE BODY ────────────────────────────────────────
    // The trap. Delete the status gate in extractNewsArticle and this section goes red — nothing
    // else in the suite does, because the page is well-formed and its articleBody is genuine text.
    {
      const r = await fetchUrl(base + '/error-page');
      assert(r.status === 200, 'the route itself answers 200 (the PAGE failed, not the request)');
      assert(r.body.ok === false, 'a 404 page is refused even though its JSON-LD carries a real, '
        + 'non-empty NewsArticle articleBody — an articleBody test alone PASSES here');
      assert(r.body.status === 404, 'the upstream status is reported so the cause is visible (got ' + r.body.status + ')');
      assert(!r.body.text, 'no text is handed back from a failed page');
      console.log('  ⚠ a 404 page whose JSON-LD holds a 133-word error message is refused: OK');
    }

    // ── 4. HTTP 200 with an empty body, and no <p> fallback ───────────────────────────────────
    {
      const noBody = await fetchUrl(base + '/no-body');
      assert(noBody.body.ok === false, 'a 200 page with @type Article and articleBody "" is refused '
        + '— the status gate alone would let this through');
      const plain = await fetchUrl(base + '/plain');
      assert(plain.body.ok === false, 'a page with no structured data at all is refused');
      // The thesis of the whole feature, asserted directly: refusal must NOT degrade into scraping.
      for (const r of [noBody, plain]) {
        assert(!r.body.text, 'a refusal returns no text at all');
        assert(!/Abbonati|newsletter|Leggi anche|Facebook/.test(r.raw),
          'a refusal must not fall back to the page\'s <p> furniture — that noise is exactly what '
          + 'this feature is scoped to avoid, and cleanExtractedText does not remove it');
      }
      console.log('  an empty body and a page with no JSON-LD both refuse, and neither leaks <p> furniture: OK');
    }

    // ── 5. Redirects, the final-URL rule, and the redirect cap ────────────────────────────────
    {
      const r = await fetchUrl(base + '/redirect');
      assert(r.body.ok === true, 'a 301 is followed to the article (got ' + r.raw.slice(0, 160) + ')');
      // Provenance must record where the text actually came FROM, not the link that was pasted.
      assert(r.body.url === base + '/article',
        'the FINAL url is what source.url gets, not the one that was pasted (got ' + r.body.url + ')');
      const loop = await fetchUrl(base + '/redirect-loop');
      assert(loop.status === 502, 'an endless redirect is capped and reported (got ' + loop.status + ')');
      assert(/redirect/i.test(loop.body.error || ''), 'and it says redirects were the problem (got ' + JSON.stringify(loop.body.error) + ')');
      console.log('  a redirect is followed, the final url is recorded, and a loop is capped: OK');
    }

    // ── 6. The JSON-LD shapes publishers actually ship ────────────────────────────────────────
    {
      const g = await fetchUrl(base + '/graph');
      assert(g.body.ok === true, 'an article inside @graph is found (got ' + g.raw.slice(0, 160) + ')');
      assert(g.body.author === 'Graph Author', 'and its author too (got ' + JSON.stringify(g.body.author) + ')');
      // ⚠️ The @type gate, made distinguishable — a Comment carrying its own long articleBody sits
      // BEFORE the article in that @graph. Without the gate this returns the comment.
      assert(g.body.text === ARTICLE_BODY, 'a Comment with its own articleBody earlier in the @graph '
        + 'is skipped — the @type gate, not the body gate, is what does that (got '
        + JSON.stringify((g.body.text || '').slice(0, 60)) + ')');
      const m = await fetchUrl(base + '/malformed-first');
      assert(m.body.ok === true, 'a malformed ld+json block does not lose a good article in a later block');
      assert(m.body.author === 'A Bare String Author', 'a bare-string author is accepted (got ' + JSON.stringify(m.body.author) + ')');
      console.log('  @graph, an array @type, a bare-string author and a malformed sibling block: OK');
    }

    // ── 7. The @type boundary, pinned in both directions ─────────────────────────────────────
    // ⚠️ Added after the user asked "are there other such formats?" — which surfaced a real gap:
    // `BlogPosting` is a subtype of Article and carries articleBody, but its NAME does not contain
    // "article", so the original /article/i substring test silently refused every blog post. Both
    // directions are asserted here because a widening is exactly as dangerous as a narrowing: too
    // wide and a marked-up comment thread becomes the story.
    {
      const accepted = ['NewsArticle', 'Article', 'ReportageNewsArticle', 'OpinionNewsArticle',
                        'ScholarlyArticle', 'TechArticle', 'BlogPosting', 'LiveBlogPosting'];
      const refused  = ['Comment', 'WebPage', 'SocialMediaPosting', 'Report', 'ImageObject'];
      for (const ty of accepted) {
        const r = await fetchUrl(`${base}/type/${ty}`);
        assert(r.body.ok === true, `@type ${ty} is part of the Article subtree and must be accepted`);
        assert(r.body.text === ARTICLE_BODY, `@type ${ty} returns the body exactly`);
      }
      for (const ty of refused) {
        const r = await fetchUrl(`${base}/type/${ty}`);
        assert(r.body.ok === false, `@type ${ty} is NOT a story and must be refused, even carrying a `
          + 'long articleBody');
        assert(!r.body.text, `@type ${ty} hands back no text`);
      }
      console.log(`  the @type boundary holds both ways: ${accepted.length} accepted, ${refused.length} refused: OK`);
    }

    console.log('e2e-fetch-url: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('FAILED:', e.message);
  } finally {
    srv.close();
    if (env && env.stop) await env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
