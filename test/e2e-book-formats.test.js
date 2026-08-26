// e2e-book-formats.test.js
// v68.1 — "all types / every picker format works for book & multi-chapter jobs" (parity with
// single-story generation), the queued v68 item. Audit findings the fix rests on:
//   • the server plumbing ALREADY honored all_types for book jobs (probed before changing anything);
//   • the real gap was whitelist drift: the #format-select picker offered word_forms and synonyms,
//     but the client clamp (VALID_FORMATS) silently rewrote both to 'standard' on selection, and
//     BOTH server routes (/api/generate and /api/generate-book) clamped word_forms to 'standard'.
// Guard shape: (a) structural — every option the picker offers is accepted by the client clamp and
// by both server route whitelists ('standard' being the fallback needs no listing); (b) behavioral —
// a real book job (fake Ollama) with lessonFormat 'all_types' yields the 4-type chapter, and one
// with 'word_forms' yields word_forms chapters (the format that used to be clamped away).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { boot, post, waitBookJob, assert } = require('./lib');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ── (a) Structural: the three whitelists agree with the picker ────────────────
{
  const sel = html.match(/<select class="format-select" id="format-select"[\s\S]*?<\/select>/);
  assert(sel, 'the format picker exists');
  const options = [...sel[0].matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
  assert(options.length >= 5, 'picker offers several formats (got ' + options.join(',') + ')');

  const vf = html.match(/const VALID_FORMATS=new Set\(\[([^\]]*)\]\)/);
  assert(vf, 'client VALID_FORMATS clamp exists');
  const clientSet = new Set([...vf[1].matchAll(/'([^']+)'/g)].map(m => m[1]));

  const routeLists = [...server.matchAll(/const fmt {2}= \[([^\]]*)\]\.includes\(lessonFormat\)/g)]
    .map(m => new Set([...m[1].matchAll(/'([^']+)'/g)].map(x => x[1])));
  assert(routeLists.length === 2, 'both routes (single + book) clamp via a whitelist (got ' + routeLists.length + ')');

  for (const opt of options) {
    assert(clientSet.has(opt), `picker option '${opt}' is accepted by the client clamp (a miss = dead menu entry)`);
    if (opt === 'standard') continue;   // the clamp fallback — needs no listing
    for (const [i, rl] of routeLists.entries())
      assert(rl.has(opt), `picker option '${opt}' is accepted by server route #${i + 1} (a miss = silent clamp to standard)`);
  }
}
console.log('  structural: picker ⊆ client clamp ⊆ both server route whitelists: OK');

// ── (b) Behavioral: book jobs honor all_types AND the formerly-clamped word_forms ──
(async () => {
  const env = await boot({ log: false });
  let failed = false;
  try {
    // all_types → standard + word_forms + synonyms + error_hunt per chapter.
    const s1 = await post(env.sport, '/api/generate-book', {
      generated: true, topic: 'Formats A', nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 100, lessonFormat: 'all_types' });
    assert(s1.status === 202, 'all_types book accepted (got ' + s1.status + ')');
    const f1 = await waitBookJob(env.sport, s1.body.bookId, { timeoutMs: 90000 });
    assert(f1 && f1.status === 'done', 'all_types book done (status=' + (f1 && f1.status) + ')');
    const t1 = (env.readStore().topics || []).filter(t => /^Formats A/.test(t.userTopic || t.topic) || /Formats A/.test(t.userPrompt || ''));
    const all = (env.readStore().topics || []);
    assert(all.length === 2, '2 chapters saved (got ' + all.length + ')');
    for (const t of all) {
      const types = (t.lessons || []).map(l => l.type || 'vocab');
      for (const want of ['word_forms', 'synonyms', 'error_hunt'])
        assert(types.includes(want), `all_types chapter "${t.topic}" carries ${want} (got ${types.join(',')})`);
    }
    console.log('  behavioral: all_types book → standard+word_forms+synonyms+error_hunt per chapter: OK');

    // word_forms (the option the clamps used to kill) → a word_forms lesson per chapter.
    const s2 = await post(env.sport, '/api/generate-book', {
      generated: true, topic: 'Formats B', nChapters: 2, lang: 'de', srcLang: 'en',
      difficulty: 2, chapterLen: 100, lessonFormat: 'word_forms' });
    assert(s2.status === 202, 'word_forms book accepted (got ' + s2.status + ')');
    const f2 = await waitBookJob(env.sport, s2.body.bookId, { timeoutMs: 90000 });
    assert(f2 && f2.status === 'done', 'word_forms book done (status=' + (f2 && f2.status) + ')');
    const after = (env.readStore().topics || []).slice(2);   // the two new chapters
    assert(after.length === 2, '2 word_forms chapters saved (got ' + after.length + ')');
    for (const t of after) {
      const types = (t.lessons || []).map(l => l.type || 'vocab');
      assert(types.includes('word_forms'), `word_forms chapter "${t.topic}" carries a word_forms lesson (got ${types.join(',')})`);
    }
    console.log('  behavioral: word_forms book → word_forms lesson per chapter (was clamped to standard): OK');

    // v68.1 (queued item 5) shipped "every book job ends with a whole-storyline storyboard,
    // UNCONDITIONALLY" — the SAME shared helper the 🎨 route uses, persisted with panels + scheme.
    // v85_p CHANGED THIS DELIBERATELY, per a real user report after testing an unrelated feature
    // ("we don't want storyboards as a standard generation unless explicitly selected") — confirmed
    // via code read to be a PRE-EXISTING gap affecting every /api/generate-book caller (this test's
    // own two requests above never opted in, so under the OLD unconditional behaviour they got a
    // board anyway; that is now recognized as the bug, not the feature). The post-pass is now gated
    // on `postGenStoryboard` in the request body — see server.js's own comment on _runBookJob, and
    // e2e-postgen-storyboard-optin.test.js for the dedicated opt-in-both-directions coverage. This
    // test's own two requests (s1/s2) deliberately did NOT set the flag, so the CORRECT, CURRENT
    // behaviour is NO storyboard — this assertion was flipped, not deleted, to keep proving the
    // book-job pipeline's storyline-creation side (still real, still worth guarding) without
    // re-asserting behaviour v85_p intentionally reversed.
    const sls = env.readStore().storylines || [];
    assert(sls.length >= 1, 'the book jobs created storyline(s)');
    for (const sl of sls) {
      assert(!sl.storyboard, `storyline "${sl.title || sl.id}" carries NO storyboard — neither request opted in (postGenStoryboard), and the post-pass is opt-in since v85_p`);
    }
    console.log('  behavioral: book jobs WITHOUT postGenStoryboard end with NO storyboard (v85_p opt-in fix, not the old v68.1 unconditional behaviour): OK');
  } catch (e) {
    failed = true;
    console.error('e2e-book-formats FAILED:', e.message);
  } finally {
    env.stop();
  }
  if (failed) process.exit(1);
  console.log('e2e-book-formats: ALL PASSED');
})();
