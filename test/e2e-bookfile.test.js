// E2E: a file-derived book records the original upload filename on its storyline
// (v45 minor). Posts an upload-style book (chunks + sourceFile) and asserts the
// resulting storyline carries sourceFile.
const { boot, post, waitBookJob, assert } = require('./lib');

(async () => {
  const env = await boot();
  let failed = false;
  try {
    const { sport } = env;
    const FNAME = 'Die_Verwandlung.pdf';
    const start = await post(sport, '/api/generate-book', {
      lang: 'de', srcLang: 'en', difficulty: 2, lessonFormat: 'standard',
      sourceFile: FNAME,
      chunks: [
        { title: 'Kapitel 1', text: 'Gregor Samsa erwachte eines Morgens. ' .repeat(8), wordCount: 40 },
        { title: 'Kapitel 2', text: 'Die Familie war ratlos und besorgt. '.repeat(8), wordCount: 40 },
      ],
    });
    assert(start.status === 202, 'book accepted (got ' + start.status + ' ' + start.raw + ')');

    const final = await waitBookJob(sport, start.body.bookId, { timeoutMs: 90000 });
    assert(final && final.status === 'done', 'book done (status=' + (final && final.status) + ')');

    const sls = env.readStore().storylines || [];
    assert(sls.length >= 1, 'a storyline was created for the 2-chapter book');
    const withFile = sls.find(s => s.sourceFile === FNAME);
    assert(withFile, 'a storyline carries the original sourceFile\n  storylines: ' +
      JSON.stringify(sls.map(s => ({ id: s.id, sourceFile: s.sourceFile }))));

    console.log('  storyline sourceFile:', JSON.stringify(withFile.sourceFile));
    console.log('e2e-bookfile: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-bookfile FAILURE:', e.message);
    console.error('--- server log tail ---\n' + env.srvlog().split('\n').slice(-25).join('\n'));
  } finally {
    env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
