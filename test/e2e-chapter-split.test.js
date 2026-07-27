// E2E: /api/split-chapters — the model groups paragraphs into chapters and never returns text.
// v71_b. Runs the real server against the fake model, so the prompt build, the JSON parse, the
// validation and the reassembly are all exercised end to end.
const { boot, post, assert } = require('./lib');

const SEED = { schemaVersion: 29, topics: [], storylines: [], flags: {}, progress: {} };

// Six paragraphs, each with distinctive words so losslessness is checkable by inspection.
const PARAS = [
  'Evoluzione',
  'Se una teoria scientifica rimanesse sempre la stessa, senza aggiornamenti, ci sarebbe di che preoccuparsi.',
  'Tutti gli esseri viventi sono imparentati fra loro e sono connessi da un albero genealogico.',
  'Selezione naturale',
  'Il secondo pilastro della rivoluzione darwiniana è la selezione naturale, motore del cambiamento.',
  'RIPRODUZIONE RISERVATA',
];

(async () => {
  const env = await boot({ seed: SEED });
  let failed = false;
  try {
    const { sport } = env;

    // ── the grouping pass ────────────────────────────────────────────────────
    const r = await post(sport, '/api/split-chapters', { paragraphs: PARAS, lang: 'it' });
    assert(r.status === 200, 'split-chapters accepted (got ' + r.status + ' ' + r.raw + ')');
    const ch = r.body.chapters;
    assert(Array.isArray(ch) && ch.length >= 2, 'the model returned more than one chapter');
    assert(ch.every(c => typeof c.title === 'string' && c.title), 'every chapter carries a title');
    assert(ch.every(c => c.wordCount === c.text.split(/\s+/).filter(Boolean).length),
      'word counts are computed from the assembled text');

    // The property that matters: the words out are the words in, in order.
    const flat = s => s.split(/\s+/).filter(Boolean).join(' ');
    assert(flat(ch.map(c => c.text).join(' ')) === flat(PARAS.join(' ')),
      'no word was added, dropped or reordered by the model pass');

    // Chapters are contiguous runs of the paragraphs we sent — never fragments of them.
    ch.forEach((c, i) => {
      const parts = c.text.split('\n\n');
      parts.forEach(p => assert(PARAS.includes(p),
        `chapter ${i + 1} is built from whole original paragraphs (got ${JSON.stringify(p.slice(0, 40))})`));
    });
    console.log(`  grouped ${PARAS.length} paragraphs -> ${ch.length} chapters, text unchanged`);

    // ── cleaning folded into the same pass ───────────────────────────────────
    const r2 = await post(sport, '/api/split-chapters', { paragraphs: PARAS, lang: 'it', drop: true });
    assert(r2.status === 200, 'the drop variant is accepted');
    assert(Array.isArray(r2.body.dropped) && r2.body.dropped.length >= 1,
      'the model discarded at least one furniture paragraph when allowed to');
    const kept = r2.body.chapters.map(c => c.text).join('\n\n');
    assert(!kept.includes('RIPRODUZIONE RISERVATA'), 'the discarded paragraph is not in any chapter');
    assert(kept.includes('Selezione naturale'), 'and the real text survives');
    console.log(`  drop variant: ${r2.body.dropped.length} paragraph(s) discarded, article text intact`);

    // ── input validation happens before any tokens are spent ─────────────────
    const short = await post(sport, '/api/split-chapters', { paragraphs: ['nur einer'], lang: 'de' });
    assert(short.status === 400, 'a single paragraph is refused (got ' + short.status + ')');
    const none = await post(sport, '/api/split-chapters', { lang: 'de' });
    assert(none.status === 400, 'a missing paragraph list is refused');
    const many = await post(sport, '/api/split-chapters',
      { paragraphs: Array.from({ length: 401 }, (_, i) => 'Absatz ' + i), lang: 'de' });
    assert(many.status === 400, 'an over-long document is refused rather than sent to the model');
    console.log('  validation: too few / missing / too many all rejected with 400');

    // ── token accounting is reported so the client can charge it ─────────────
    assert(r.body.tokens && typeof r.body.tokens.promptTokens === 'number', 'tokens are reported');
    assert(r.body.meta && r.body.meta.type === 'chapter_split', 'generation meta identifies the pass');
  } catch (e) {
    failed = true;
    console.error('  FAIL:', e.message);
  } finally {
    await env.stop();
  }
  if (failed) process.exit(1);
  console.log('e2e-chapter-split: ALL PASSED');
})();
