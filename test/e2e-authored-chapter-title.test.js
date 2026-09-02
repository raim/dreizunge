// e2e-authored-chapter-title.test.js
// v88_y — a chapter title the USER typed survives the whole-storyline title post-pass.
//
// User question: "if the user enters a title, such as here 't Manteling', it could be used as a
// title for that chapter and would suppress title generation; easy?"
//
// It was already built — item AN (v88_d) wired all five hops:
//   review-card `title` field -> `userTitle` wins over the derived placeholder
//   -> chunk `titleAuthored:true` -> `topicAuthored` -> saved topic gets `topicAuto:false`
//   -> `_applyChapterTitles` skips any topic with `topicAuto === false`.
//
// ⚠️ …but only the FIRST hop had a test. `unit-comic-title-field` proves `titleAuthored` reaches the
// request body and stops there; grepping the suite for `topicAuto` returned ZERO hits. So the half
// that actually SUPPRESSES title generation — everything the server does with that flag — was
// unverified, and this project has been bitten twice this line by exactly that shape (the two cache
// short-circuits at v88_x; v87_m's guard that only checked index.html).
//
// This runs the real chunk-based book route against a live server + fake Ollama, with TWO chunks:
// one authored, one not — so the flag can be shown to track what the user typed rather than being
// set on everything. Non-vacuity comes from the fake's own request log (the titling calls really
// happened); what the fake CANNOT provide is a usable title, so no chapter is renamed either way and
// the skip itself is pinned at the source. Both limits are stated inline rather than papered over.
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, post, get, sleep, assert } = require('./lib');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const AUTHORED = "'t Manteling";

(async () => {
  const env = await boot({ log: true });
  let failed = false;
  try {
    const r = await post(env.sport, '/api/generate-book', {
      chunks: [
        // Exactly what comicCreateChapter sends for a panel whose title the user typed.
        { title: AUTHORED, titleAuthored: true,
          text: 'Een landschap met heuvels en struiken onder een blauwe hemel met wolken.', wordCount: 11 },
        // …and one with no typed title: the placeholder is derived from the text, as always.
        { title: 'Tweede tekst', text: 'Bloemen en kruiden krijgen de kans om te bloeien en te groeien.', wordCount: 11 },
      ],
      lang: 'nl', srcLang: 'de', difficulty: 1, sourceFile: 'manteling.jpg',
    });
    assert(r.status === 202, `book accepted (got ${r.status} ${r.raw || ''})`);
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      const j = await get(env.sport, '/api/book-job/' + r.body.bookId);
      if (j.body && (j.body.status === 'done' || j.body.status === 'error')) {
        assert(j.body.status === 'done', `book completed (got ${j.body.status}: ${j.body.error || ''})`);
        break;
      }
    }
    const st = env.readStore();
    assert(st.topics.length === 2, `two chapters saved (got ${st.topics.length})`);

    const authored = st.topics.find(t => t.topicAuto === false);
    assert(authored, 'the authored chapter is flagged topicAuto:false — the flag the post-pass reads');
    assert(authored.topic === AUTHORED,
      `and it kept the EXACT typed title, apostrophe and all (got ${JSON.stringify(authored.topic)})`);

    const other = st.topics.find(t => t !== authored);
    assert(other, 'the second chapter exists');
    assert(other.topicAuto !== false,
      'the un-authored chapter is NOT flagged — the flag tracks what the user typed, not every chapter');
    assert(other.topic !== AUTHORED, 'and it did not inherit the authored title');

    // ⚠️ NON-VACUITY — and a limit worth stating rather than implying. The claim "the post-pass left
    // the authored title alone" is empty unless the post-pass RAN, so that is asserted directly: the
    // titling model calls appear in the fake's own request log.
    const titleCalls = env.readChatLog().filter(l => l.kind === 'chapter_titles');
    assert(titleCalls.length > 0,
      `the chapter-title post-pass really executed (got ${titleCalls.length} titling calls)`);

    // What this file CANNOT show, deliberately recorded: the fake returns no usable titles, so
    // `_applyChapterTitles` falls back to each chapter's existing name and NOTHING is renamed either
    // way. So "the authored one survived" cannot be distinguished from "nothing was renamed" by
    // reading titles alone. The flag above is the input the skip is keyed on; the skip ITSELF is
    // attributable only at the source, so it is pinned there.
    const fnAt = server.indexOf('function _applyChapterTitles');
    assert(fnAt > 0, '_applyChapterTitles exists');
    const fn = server.slice(fnAt, server.indexOf('\n}\n', fnAt));
    assert(/if \(tp\.topicAuto === false\)/.test(fn),
      'the post-pass short-circuits on the flag this job set');
    const guardAt = fn.indexOf('tp.topicAuto === false');
    const renameAt = fn.indexOf('let title =');
    assert(guardAt > 0 && renameAt > guardAt,
      'and it does so BEFORE computing any replacement title — a check after the rename would '
      + 'compute a new name and then keep the old one, which reads the same here but is not the same');
    assert(/used\.add\(String\(tp\.topic/.test(fn.slice(guardAt, renameAt)),
      'while still reserving the authored name, so a LATER auto-titled chapter cannot be given it');

  } catch (e) {
    failed = true;
    console.error('e2e-authored-chapter-title FAILED:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
  console.log('  a typed chapter title reaches the store flagged, and the post-pass provably ran: OK');
  console.log('e2e-authored-chapter-title: ALL PASSED');
})();
