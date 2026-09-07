'use strict';
// news-article.js — scrape a story straight from a URL, scoped to the schema.org NewsArticle class.
//
// WHY THIS IS SCOPED AND NOT A GENERIC EXTRACTOR (measured, roadmap_v90.md → "SCRAPE A STORY
// STRAIGHT FROM A URL"): on the article this was built against, pulling every <p> over 40 chars
// yields 900 words against the article's real 499 — roughly 45% navigation, section menus and
// promo teasers. cleanExtractedText does NOT remove it: that cleaner is tuned for PDF furniture
// (page numbers, bare dates, bare URLs, short unpunctuated fragments) and this noise is punctuated
// prose. Beating it generically is the Readability problem (link density and text-to-markup ratio
// per node) and this repo has no HTML parser at all. So: take the publisher's own structured data
// when it is there, and refuse honestly when it is not — a refusal is one click from the paste box
// that already works, whereas 900 words of plausible furniture produces a chapter that LOOKS fine
// and teaches navigation menus.
//
// ⚠️ TWO GATES, AND NEITHER IS SUFFICIENT ALONE. Both cases below were measured, not reasoned:
//   * HTTP status must be 2xx. roadmap_v90.md recorded a tagesschau.de 404 page as "a JSON-LD block
//     with no article in it" and concluded the test should be "an articleBody came back". That
//     conclusion is WRONG and was corrected here by re-probing it: the 404 page carries a real
//     NewsArticle with a NON-EMPTY 964-char / 133-word articleBody — the German error text ("Liebe
//     Nutzerinnen und Nutzer, leider ist die von Ihnen gewünschte Seite nicht verfügbar…"). An
//     articleBody test passes on it and you get a chapter generated from an error message.
//   * articleBody must be a non-empty string above a floor. en.wikipedia.org answers HTTP 200 with
//     @type Article and articleBody:"" — the status gate alone lets that through as a story with no
//     text in it.
// The floor is MIN_BODY_CHARS, deliberately the same 20 characters onUploadFileChosen already
// applies to an uploaded file, so both intake paths refuse on identical grounds.
//
// ⚠️ AND "FIRST BLOCK" IS NOT "THE ARTICLE". The measured article page carries THREE ld+json
// blocks and only one is the NewsArticle; the others are BreadcrumbList and NewsMediaOrganization.
// Every block is parsed and flattened, and the first object that passes BOTH gates wins.

// The @type gate matches schema.org's Article SUBTREE by name: anything ending in `Article`
// (Article, NewsArticle, ReportageNewsArticle, OpinionNewsArticle, ScholarlyArticle, TechArticle, …)
// plus `BlogPosting` and its own subtype `LiveBlogPosting`.
//
// ⚠️ THE `BlogPosting` HALF WAS A REAL GAP, found by the user asking "are there other such formats?"
// and answered by running the types rather than reading the spec. `BlogPosting` IS a subtype of
// Article and it DOES carry articleBody, but its name does not contain the word "article" — so the
// original /article/i test silently refused every blog post, which is squarely the kind of prose
// this feature wants. A substring test looked generous and was quietly narrow.
//
// What stays OUT is deliberate: `Comment` (a marked-up comment thread — see the @graph fixture in
// e2e-fetch-url, where one sits before the real article), `WebPage`, and `SocialMediaPosting` (a
// status update is not a story). `Report` is nominally in the subtree but is rare and ambiguous, and
// under-accepting costs an honest refusal while over-accepting costs a bad chapter.
const ARTICLE_TYPE = /(article|blogposting)$/i;
const MIN_BODY_CHARS = 20;

// ⚠️⚠️ A PAYWALL WARNING WAS ASKED FOR, BUILT, AND THEN WITHDRAWN ON THE MEASUREMENT (v90_m).
// Both plausible signals were probed against real pages and BOTH are wrong on this project's own
// test case — the Corriere article, whose 499-word body is known-complete (roadmap_v90.md compared
// it word for word against the PDF path's chapter 1). Recorded here so it is not re-derived:
//
//   1. THE PROSE RATIO (articleBody words / the page's own <p> words). Measured across nine live,
//      fully-readable articles the band is 0.555–1.003 — and the 0.555 floor IS the Corriere
//      article, i.e. the test case is already the worst case among known-good pages. Worse, the
//      ratio does not actually detect the thing: on a paywalled page the visible <p> mass shrinks
//      TOGETHER with the teaser, so numerator and denominator fall together and the ratio need not
//      drop at all. A threshold low enough to avoid firing on Corriere is too low to catch a teaser.
//      ⚠️ An earlier probe put the band at 0.41–0.55 and would have justified a 0.25 threshold. That
//      probe was WRONG: its `<p[^>]*>` also matched `<picture>` and `<path>`, inflating every
//      denominator. The `\b` in pageProseWords is load-bearing.
//   2. schema.org's OWN FIELD, `isAccessibleForFree`. This is the standard answer and it is
//      unusable here: the Corriere article declares `isAccessibleForFree: "False"` with a matching
//      hasPart WebPageElement, while serving the COMPLETE body. Publishers mark the page for
//      Google's flexible sampling, not to describe what is in the JSON-LD. A warning keyed on it
//      fires on a complete article — a false positive on the one page with ground truth.
//      ⚠️ Note also the value is the STRING "False", not a boolean: `=== false` never fires and a
//      truthiness test reads it as TRUE. Either mistake is silent.
//
// So no truncation CLAIM is made. What is returned instead is the honest, checkable number the
// signal was a proxy for — `bodyWords` — which the client shows on the status line the moment the
// fetch lands. A 90-word "article" is self-evidently a stub, and the chunk review card (which the
// user ruled must stay) shows the whole text before anything is generated. That review stop was
// always where a paywall gets caught, and unlike either signal above it has no false positives.
// `pageWords` is returned alongside it for diagnosis only; nothing branches on either.
// Below this the page has too little prose for the comparison to mean anything (an index page, an
// app-shell rendered by JS), so pageWords is reported as 0 rather than as a misleading denominator.
const MIN_PAGE_WORDS = 200;

function wordCount(s) {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// schema.org lets author/publisher be a bare string, an object with a name, or an array of either.
function nameOf(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(nameOf).filter(Boolean).join(', ');
  if (typeof v === 'object' && typeof v.name === 'string') return v.name.trim();
  return '';
}

// Every <script type="application/ld+json"> on the page, as parsed objects, flattened. Tolerates
// the three shapes publishers actually ship: a bare object, an array of objects, and an object
// carrying an @graph array. A block that does not parse is SKIPPED, not fatal — one malformed
// block on a page must not lose a good article in another block.
function ldJsonObjects(html) {
  const out = [];
  const re = /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch (_) { continue; }
    const push = o => { if (o && typeof o === 'object' && !Array.isArray(o)) out.push(o); };
    if (Array.isArray(parsed)) parsed.forEach(push);
    else {
      push(parsed);
      if (parsed && Array.isArray(parsed['@graph'])) parsed['@graph'].forEach(push);
    }
  }
  return out;
}

// The page's own prose mass, used ONLY as the denominator of the truncation ratio. This is the
// generic <p> extraction the whole module exists to avoid — it is kept deliberately because a WORD
// COUNT is not a content extractor: the text it produces is never returned, never shown and never
// generated from. It yields one number.
function pageProseWords(html) {
  let words = 0;
  const re = /<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const txt = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (txt.length > 40) words += wordCount(txt);
  }
  return words;
}

// Returns the article, or null when this page does not publish one. `status` is the HTTP status the
// page was served with and is a REQUIRED argument, not an option: it is the gate that the measured
// tagesschau 404 defeats when it is left out.
function extractNewsArticle(html, status) {
  if (!(status >= 200 && status < 300)) return null;
  for (const o of ldJsonObjects(html)) {
    const types = [].concat(o['@type'] || []).filter(t => typeof t === 'string');
    if (!types.some(t => ARTICLE_TYPE.test(t))) continue;
    if (typeof o.articleBody !== 'string') continue;
    const body = o.articleBody.trim();
    if (body.length < MIN_BODY_CHARS) continue;

    const bodyWords = wordCount(body);
    const rawPageWords = pageProseWords(html);
    const pageWords = rawPageWords >= MIN_PAGE_WORDS ? rawPageWords : 0;

    return {
      text: body,
      headline: typeof o.headline === 'string' ? o.headline.trim() : '',
      author: nameOf(o.author),
      publisher: nameOf(o.publisher),
      datePublished: typeof o.datePublished === 'string' ? o.datePublished.trim() : '',
      bodyWords, pageWords,
    };
  }
  return null;
}

// ── The fetch ────────────────────────────────────────────────────────────────
// Deliberately hand-rolled on `http`/`https` rather than pulled in: this project is
// zero-dependency by construction, and the body is plain HTML in the response — no JS engine and no
// HTML parser is involved anywhere in this module.
//
// ⚠️ BOTH http: AND https: ARE ACCEPTED, and that is not laxity. It is what lets the guard drive
// this against a localhost stub server; an https-only route could only ever be tested against the
// live internet, which is not a test.
//
// ⚠️ NO ALLOW-LIST, DELIBERATELY, AND IT IS A REAL LIMIT. This route makes the SERVER fetch a URL
// the caller supplies, which is a server-side request forgery surface: on a machine with anything
// else listening on localhost or a private range, a caller could use this route to reach it. That
// is acceptable here for exactly one reason — the operator and the user are the same person on a
// personal localhost tool, so the caller can already reach those hosts directly and gains nothing.
// ⚠️ It stops being acceptable the moment this server is exposed. roadmap_v90.md's own
// "PUTTING THIS ON THE INTERNET" section lists what must be gated first, and this route belongs in
// its TIER 0: before any multi-user exposure, this needs a scheme/host allow-list that rejects
// loopback, link-local and private ranges (including after every redirect hop, since a public URL
// can redirect to 127.0.0.1).
const MAX_REDIRECTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;   // generous for an article page; the measured one is ~197KB
const TIMEOUT_MS = 15000;
// Some publishers serve a stripped page, or nothing at all, to an unrecognised agent.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function fetchPage(rawUrl, opts) {
  const o = opts || {};
  const maxRedirects = o.maxRedirects == null ? MAX_REDIRECTS : o.maxRedirects;
  const maxBytes = o.maxBytes || MAX_BYTES;
  const timeoutMs = o.timeoutMs || TIMEOUT_MS;

  const step = (target, depth) => new Promise((resolve, reject) => {
    let u;
    try { u = new URL(target); } catch (_) { return reject(new Error('That does not look like a web address.')); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return reject(new Error('Only http:// and https:// addresses can be fetched.'));
    }
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.get(u.href, { headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' } }, r => {
      // Redirects are followed rather than reported: a news URL shared from a phone or a search
      // result is very often a 301 to the canonical article, and failing on that would refuse the
      // ordinary case. Capped, and the FINAL url is what gets recorded as provenance.
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) {
        r.resume();
        if (depth >= maxRedirects) return reject(new Error('Too many redirects.'));
        let next;
        try { next = new URL(r.headers.location, u.href).href; }
        catch (_) { return reject(new Error('That page redirected somewhere unreadable.')); }
        return resolve(step(next, depth + 1));
      }
      // ⚠️ The status is CARRIED OUT of here, not checked here, because extractNewsArticle needs it
      // as its first gate — see the measured tagesschau 404 in this module's header. A non-2xx page
      // is still read to completion so the caller can report what it was.
      let body = '', bytes = 0, aborted = false;
      r.setEncoding('utf8');
      r.on('data', c => {
        bytes += Buffer.byteLength(c, 'utf8');
        if (bytes > maxBytes) { aborted = true; r.destroy(); return; }
        body += c;
      });
      r.on('end', () => resolve({ status: r.statusCode, body, url: u.href, truncatedAtCap: aborted }));
      // A stream destroyed by the size cap emits 'close' without 'end'; that is a successful read of
      // the first maxBytes, not a failure — an article's JSON-LD is in the head and survives it.
      r.on('close', () => { if (aborted) resolve({ status: r.statusCode, body, url: u.href, truncatedAtCap: true }); });
      r.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('That page took too long to answer.')); });
    req.on('error', reject);
  });

  return step(String(rawUrl || '').trim(), 0);
}

module.exports = { extractNewsArticle, ldJsonObjects, pageProseWords, wordCount, fetchPage,
                   MIN_BODY_CHARS, MIN_PAGE_WORDS, MAX_REDIRECTS, MAX_BYTES, TIMEOUT_MS };
