// unit-scrape-paragraphs.test.js
// v90_r — a scraped article gets its PARAGRAPH boundaries back, recovered from the page's own <p>
// elements, so the "¶ By paragraph" chapter mode works for a URL as it does for a PDF.
//
// ⚠️ USER REQUEST: "could you activate the buttons that are available for PDF also for URL upload,
// to separate chapters by existing paragraphs or by length?" Measured first: for a WIKIPEDIA URL the
// ¶ button was already enabled (the API returns real paragraphs). For a NEWS url it was greyed out,
// and correctly so — a JSON-LD `articleBody` is one unbroken run with ZERO newlines, so there was no
// paragraph information in it at all.
//
// ⚠️⚠️ THE SAFETY PROPERTY, AND THE WHOLE REASON THIS IS ALLOWED TO TOUCH <p> AT ALL: content comes
// only from `articleBody`; the <p> elements supply BOUNDARY POSITIONS and nothing else. A <p> whose
// words are not found in the body is ignored, so navigation and promo furniture — measured at 45% of
// this page's <p> mass — cannot enter. §2 is the assertion that keeps that true.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { restoreParagraphs, wordCount } = require(path.join(ROOT, 'news-article.js'));

const P1 = 'A ottant anni dall Accordo di Parigi del cinque settembre millenovecentoquarantasei, '
  + 'l autonomia del Trentino torna protagonista in una giornata di incontri ufficiali.';
const P2 = 'Richiamando la figura di Alcide De Gasperi, aveva inoltre osservato che l autonomia '
  + 'si e inserita nel piu ampio progetto di pace e integrazione europea del continente.';
const P3 = 'A fine novembre dello stesso anno, ancora a Merano, il presidente e tornato sul tema '
  + 'del valore dell autonomia speciale e sul ruolo che essa svolge nel presente.';
const BODY = [P1, P2, P3].join(' ');   // ONE unbroken run, exactly as a JSON-LD articleBody arrives

// ⚠️ The markup deliberately differs from the body in the way real pages differ: a stripped inline
// tag leaves a space before the comma ("De Gasperi , aveva"). An exact substring match finds ZERO of
// the real page's 23 <p> blocks for precisely this reason, which is why matching is word-based.
const FURNITURE = '<p>Abbonati subito e sostieni il giornalismo di qualita ogni singolo giorno.</p>'
  + '<p>Iscriviti alla newsletter per ricevere tutti gli aggiornamenti quotidiani dal sito.</p>';
const HTML = FURNITURE
  + `<p>${P1}</p>`
  + `<p>${P2.replace('Gasperi,', 'Gasperi ,')}</p>`
  + `<p>${P3}</p>`
  + '<p>Segui il Corriere su Facebook e Twitter per non perdere davvero nulla.</p>'
  // ⚠️ A SHORT <p> whose words occur MID-PARAGRAPH, inside P2. Mutation-driven: the first fixture
  // used a short <p> matching the very START of the body, where dropping the PARA_MIN_WORDS guard
  // changed nothing (the `i > 0` test already suppresses a break at offset 0) — so the guard looked
  // tested and was not. This one would cut P2 in half if short <p> blocks were honoured.
  + '<p>si e inserita nel</p>';

// ── 1. The breaks come back, and NOTHING is lost or added ────────────────────
{
  const out = restoreParagraphs(BODY, HTML);
  const paras = out.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
  assert.strictEqual(paras.length, 3, `three paragraphs recovered (got ${paras.length})`);
  // Word-for-word conservation, compared on words because the break insertion changes whitespace.
  const w = s => s.trim().split(/\s+/).filter(Boolean);
  assert.deepStrictEqual(w(out.replace(/\n+/g, ' ')), w(BODY),
    'every word of the articleBody survives, in order, with nothing substituted');
  assert.strictEqual(wordCount(out), wordCount(BODY), 'and the word count is unchanged');
  assert.ok(paras[0].startsWith('A ottant'), 'paragraph 1 starts where the first <p> does');
  assert.ok(paras[1].startsWith('Richiamando'), 'paragraph 2 too — despite the "Gasperi , aveva" spacing');
  assert.ok(paras[2].startsWith('A fine novembre'), 'and paragraph 3');
  console.log('  3 paragraphs recovered, every word preserved in order: OK');
}

// ── 2. ⚠️ NOT ONE WORD OF FURNITURE CAN ENTER ────────────────────────────────
// The property that makes using <p> at all defensible. If this ever fails, the module has stopped
// being a boundary-finder and become the generic extractor this project measured at 45% noise.
{
  const out = restoreParagraphs(BODY, HTML);
  for (const junk of ['Abbonati', 'newsletter', 'Facebook', 'Iscriviti', 'Segui il Corriere']) {
    assert.ok(!out.includes(junk),
      `'${junk}' is <p> furniture and must never reach the text — <p> supplies POSITIONS only`);
  }
  // And a page whose <p> blocks match nothing leaves the body completely untouched.
  const unrelated = restoreParagraphs(BODY, '<p>Voici un texte totalement different qui ne correspond a rien du tout ici.</p>');
  assert.strictEqual(unrelated, BODY, 'a page whose paragraphs match nothing returns the body unchanged');
  console.log('  no furniture enters, and a non-matching page is a clean no-op: OK');
}

// ── 3. Already-paragraphed text is left alone ────────────────────────────────
// Wikipedia arrives with real newlines; re-deriving them from <p> would be both pointless and a
// chance to corrupt something that was already correct.
{
  const already = 'First paragraph here with plenty of words to count.\n\nSecond one, also long enough.';
  assert.strictEqual(restoreParagraphs(already, HTML), already,
    'text that already has blank-line paragraphs is returned untouched');
  console.log('  already-paragraphed text (the Wikipedia case) is untouched: OK');
}

// ── 4. Degenerate inputs do not throw or mangle ──────────────────────────────
{
  assert.strictEqual(restoreParagraphs('', HTML), '', 'empty body');
  assert.strictEqual(restoreParagraphs(BODY, ''), BODY, 'no html');
  assert.strictEqual(restoreParagraphs(BODY, null), BODY, 'null html');
  const short = 'Too short to bother.';
  assert.strictEqual(restoreParagraphs(short, HTML), short, 'a body shorter than two paragraphs is left alone');
  // A <p> too short to be a paragraph (a caption or byline) must not create a break.
  const capt = restoreParagraphs(BODY, '<p>A ottant anni</p>');
  assert.strictEqual(capt, BODY, 'a <p> under the minimum word count is ignored, not used as a boundary');
  // ⚠️ And one that would land MID-paragraph — the case that actually distinguishes the guard.
  const midCut = restoreParagraphs(BODY, '<p>si e inserita nel</p>');
  assert.strictEqual(midCut, BODY,
    'a short <p> matching mid-paragraph must NOT cut a paragraph in half — captions and pull-quotes ' +
    'repeat phrases from the body, and honouring them would split sentences');
  console.log('  empty / missing / short inputs all degrade quietly: OK');
}

// ── 5. ⚠️ ANTI-VACUITY: the fixture really is the hard case ──────────────────
// If BODY already contained newlines, §1 would be testing the §3 short-circuit instead, and the
// whole file would pass while proving nothing about recovery.
{
  assert.ok(!/\n/.test(BODY),
    'the fixture body is ONE unbroken run, like a real articleBody — otherwise §1 tests the ' +
    'already-paragraphed short-circuit and never exercises the recovery at all');
  assert.ok(HTML.includes('Gasperi , aveva'),
    'and the markup really does differ from the body around punctuation, which is what makes ' +
    'word-based matching necessary rather than decorative');
  // Prove the exact-substring approach WOULD have failed here — the measurement that drove the design.
  assert.ok(!HTML.includes(P2), 'an exact substring match cannot find paragraph 2 in this markup');
  console.log('  the fixture is the hard case: unbroken body, markup that defeats exact matching: OK');
}

// ── 6. ⚠️ AND IT IS ACTUALLY WIRED INTO extractNewsArticle ───────────────────
// Mutation-driven, and it is `v89` rule 12 in miniature: every section above drives
// `restoreParagraphs` DIRECTLY, so replacing the call site with `const withParas = body` left them
// all green. Driving a function proves nothing about the caller that is supposed to use it.
{
  const { extractNewsArticle } = require(path.join(ROOT, 'news-article.js'));
  const ld = JSON.stringify({ '@type': 'NewsArticle', headline: 'H', articleBody: BODY,
                              author: { name: 'A' } });
  const page = `<html><head><script type="application/ld+json">${ld}</script></head>`
    + `<body>${HTML}</body></html>`;
  const art = extractNewsArticle(page, 200);
  assert.ok(art, 'the fixture page yields an article');
  assert.ok(/\n\s*\n/.test(art.text),
    'extractNewsArticle RETURNS the paragraphed text — without this the recovery exists but never ' +
    'reaches the client, and the ¶ button stays greyed out exactly as before');
  assert.strictEqual(art.text.split(/\n\s*\n/).filter(x => x.trim()).length, 3,
    'and it is the same three paragraphs the direct call produces');
  assert.strictEqual(art.bodyWords, wordCount(BODY),
    'while bodyWords still counts the article, unchanged by the inserted breaks');
  console.log('  extractNewsArticle actually returns the paragraphed text: OK');
}

console.log('unit-scrape-paragraphs: ALL PASSED');
