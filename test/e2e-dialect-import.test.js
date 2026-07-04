// E2E (live server): the /api/dialect-import endpoint parses a glossary, builds a faithful dialect
// topic, saves it to the store, and returns a parse report. No Ollama needed — the import is
// deterministic (no LLM). Verifies the faithful path end-to-end: rows verbatim, _dialect markers,
// attribution persisted, and a suspicious/glued row surfaced (not auto-split).
const { boot, get, post, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;

    // 1) A clean 2-column "dialect = standard" glossary imports into a playable topic.
    const gloss = [
      'Dialekt Wörterbuch Test',           // title (skipped)
      'CC BY-NC Example 2026',             // license (skipped)
      'Gitsche = Mädchen',
      'bleckfüeßet = barfuß',
      'a boisl = einige Zeit',
      'Lettn = Dreck / Schlamm',
    ].join('\n');
    const r = await post(sport, '/api/dialect-import', {
      text: gloss, label: 'Testtirol', attribution: 'Author X (CC BY-NC)',
    });
    assert(r.status === 200 && r.body.ok, 'import ok (got ' + r.status + ' ' + JSON.stringify(r.body).slice(0,120) + ')');
    assert(r.body.rows === 4, 'title + license skipped → 4 data rows (got ' + r.body.rows + ')');
    assert(r.body.report.headerSkipped >= 2, 'header/license lines were skipped');
    assert(r.body.id && /^tp_/.test(r.body.id), 'topic got a tp_ id');

    // 2) The topic is in the store, faithful and marked _dialect.
    const saved = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert(saved, 'dialect topic persisted to the store');
    assert(saved.lang === 'de' && saved.srcLang === 'de', 'dialect topic is a variety of de (lang=srcLang=de)');
    assert(saved._dialect && /Author X/.test(saved._dialect.attribution), 'attribution stored on the topic');
    const allVocab = (saved.lessons || []).flatMap(l => l.vocab || []);
    assert(allVocab.length === 4, 'all rows became vocab items');
    assert(allVocab.every(v => v._dialect === true), 'every vocab item marked _dialect');
    const gitsche = allVocab.find(v => v.target === 'Gitsche');
    assert(gitsche && gitsche.source === 'Mädchen', 'row kept verbatim (Gitsche = Mädchen)');
    const lettn = allVocab.find(v => v.target === 'Lettn');
    assert(lettn && lettn.source === 'Dreck / Schlamm', 'slash gloss kept verbatim');
    console.log('  clean glossary → faithful playable dialect topic, attribution persisted: OK');

    // 3) A glued/collided row is SURFACED in the report (not auto-split).
    const collided = 'Mangale = Männchen, kleiner MannFock = Schwein\nNotscha = Schwein';
    const r2 = await post(sport, '/api/dialect-import', { text: collided, label: 'Glued' });
    assert(r2.status === 200 && r2.body.ok, 'collided import still succeeds');
    assert(r2.body.report.suspicious.length >= 1, 'collided row surfaced as suspicious');
    const saved2 = (env.readStore().topics || []).find(t => t.id === r2.body.id);
    const v2 = (saved2.lessons || []).flatMap(l => l.vocab || []);
    assert(!v2.some(v => v.target === 'Fock'), 'glued "Fock" was NOT auto-extracted (faithful)');
    console.log('  collided row surfaced in report, not auto-split: OK');

    // 4) Validation: missing name / empty text are rejected.
    const rBad1 = await post(sport, '/api/dialect-import', { text: 'a = b', label: '' });
    assert(rBad1.status === 400, 'missing dialect name rejected');
    const rBad2 = await post(sport, '/api/dialect-import', { text: '   ', label: 'X' });
    assert(rBad2.status === 400, 'empty glossary rejected');
    console.log('  validation: name required, empty text rejected: OK');

    console.log('e2e-dialect-import: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-dialect-import FAILED:', e && e.message || e);
  } finally {
    await env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
