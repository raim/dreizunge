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

    // 5) Story-driven generation: a topic+instructions dialect story is the review sample —
    //    always allowed, always marked aiGenerated + needsReview.
    const rStory1 = await post(sport, '/api/dialect-story', { id: r.body.id, topic: 'a day in the mountains', instructions: 'Bavarian-style, keep it simple' });
    assert(rStory1.status === 202 && rStory1.body.jobId, 'story job accepted (got ' + rStory1.status + ')');
    let sdone = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(s => setTimeout(s, 300));
      const st = await get(sport, '/api/job/' + encodeURIComponent(rStory1.body.jobId));
      if (st.body && ['done', 'error'].includes(st.body.status)) { sdone = st.body; break; }
    }
    assert(sdone && sdone.status === 'done', 'story job finished (status=' + (sdone && sdone.status) + ')');
    let withStory = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert(withStory.story && withStory.story.length > 0, 'generated dialect story stored');
    assert(withStory.storyGloss && withStory.storyGloss.length > 0, 'German rendering stored');
    assert(withStory.aiGenerated === true && withStory._dialect.aiStory?.needsReview === true,
      'generated story is marked aiGenerated + needsReview (not trusted)');
    assert(withStory._dialect.aiStory.topic === 'a day in the mountains', 'story records its topic');
    assert(withStory._dialect.curated === false, 'a fresh story is NOT auto-approved');
    console.log('  story-driven generation: topic+instructions, marked aiGenerated/needsReview, unapproved: OK');

    // 6) Approval requires a story, then records human review.
    const rImp3 = await post(sport, '/api/dialect-import', { text: 'x = y\nz = w', label: 'NoStory' });
    const rCur2 = await post(sport, '/api/dialect-curate', { id: rImp3.body.id, curated: true });
    assert(rCur2.status === 400, 'approval refused when there is no story to review');
    const rCur = await post(sport, '/api/dialect-curate', { id: r.body.id, curated: true });
    assert(rCur.status === 200 && rCur.body.curated === true, 'a reviewed story can be approved');
    withStory = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert(withStory._dialect.curated === true && withStory._dialect.aiStory.needsReview === false,
      'approval clears needsReview');
    console.log('  approval: requires a story, records review, clears needsReview: OK');

    // 7) Regenerating a story resets approval (must be re-reviewed).
    const rStory2 = await post(sport, '/api/dialect-story', { id: r.body.id, topic: 'at the market' });
    assert(rStory2.status === 202, 'regenerate accepted');
    for (let i = 0; i < 60; i++) {
      await new Promise(s => setTimeout(s, 300));
      const st = await get(sport, '/api/job/' + encodeURIComponent(rStory2.body.jobId));
      if (st.body && ['done', 'error'].includes(st.body.status)) break;
    }
    withStory = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert(withStory._dialect.curated === false, 'a NEW story resets approval (re-review required)');
    // Missing topic → 404.
    const rStory3 = await post(sport, '/api/dialect-story', { id: 'tp_does_not_exist' });
    assert(rStory3.status === 404, 'story on a missing topic → 404');
    console.log('  regenerating resets approval; missing topic → 404: OK');

    // 8) The "rewrite" method (V2): standard-German → constrained dialect rewrite, with coverage.
    const rRw = await post(sport, '/api/dialect-story', { id: r.body.id, topic: 'a walk', method: 'rewrite' });
    assert(rRw.status === 202 && rRw.body.jobId, 'rewrite story job accepted');
    let rwdone = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(s => setTimeout(s, 300));
      const st = await get(sport, '/api/job/' + encodeURIComponent(rRw.body.jobId));
      if (st.body && ['done', 'error'].includes(st.body.status)) { rwdone = st.body; break; }
    }
    assert(rwdone && rwdone.status === 'done', 'rewrite job finished (status=' + (rwdone && rwdone.status) + ')');
    assert(rwdone.data.method === 'rewrite', 'job reports method=rewrite');
    assert(rwdone.data.coverage && typeof rwdone.data.coverage.used === 'number', 'job reports a coverage metric');
    const rwStory = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert(rwStory._dialect.aiStory.method === 'rewrite', 'stored story records method=rewrite');
    assert(rwStory._dialect.aiStory.standardSource && rwStory._dialect.aiStory.standardSource.length > 0,
      'stored story keeps the Standard-German source it was rewritten from');
    assert(rwStory._dialect.aiStory.coverage && rwStory._dialect.aiStory.coverage.used >= 1,
      'stored story has a coverage metric (>=1 glossary word used)');
    console.log('  rewrite method (V2): two-step, coverage attached, source kept: OK');

    // 9) Option A gate: LLM-authoring add-lesson formats are refused for dialect topics.
    for (const fmt of ['synonyms', 'word_forms', 'error_hunt', 'grammar', 'conjugation']) {
      const rf = await post(sport, '/api/lessons/add-lesson', { id: r.body.id, lessonFormat: fmt, difficulty: 2 });
      assert(rf.status === 400, `add-lesson "${fmt}" refused for dialect (got ${rf.status})`);
    }
    // Dialect-safe formats are NOT blocked by this guard (standard reaches the story/backend check).
    const rStd = await post(sport, '/api/lessons/add-lesson', { id: r.body.id, lessonFormat: 'standard', difficulty: 2 });
    assert(rStd.status !== 400 || !/not available for dialect/.test(JSON.stringify(rStd.body)),
      'standard format is not blocked by the dialect guard');
    console.log('  Option A: LLM-authoring add-lesson formats refused for dialect: OK');

    // 10) The human-correction AI error-hunt WORKS for dialect (pure diff, no LLM). Generate a
    //     dialect story (which sets aiStory), then "edit" it and ask for the hunt.
    const rGen = await post(sport, '/api/dialect-story', { id: r.body.id, topic: 'edit test' });
    for (let i = 0; i < 60; i++) {
      await new Promise(s => setTimeout(s, 300));
      const st = await get(sport, '/api/job/' + encodeURIComponent(rGen.body.jobId));
      if (st.body && ['done','error'].includes(st.body.status)) break;
    }
    const genTopic = (env.readStore().topics || []).find(t => t.id === r.body.id);
    const aiText = genTopic.story;                         // the original AI dialect text
    assert(genTopic.aiStory === aiText, 'dialect story sets aiStory (immutable original) for the hunt diff');
    const corrected = aiText.replace('Gitsche', 'GITSCHE-FIXED'); // simulate a human correcting slop
    const rEdit = await post(sport, '/api/save-story', { topic: genTopic.topic, story: corrected, generateAiHunt: true });
    assert(rEdit.status === 200, 'save-story (human edit + hunt) succeeds for dialect (got ' + rEdit.status + ')');
    assert(Array.isArray(rEdit.body.edits) && rEdit.body.edits.length >= 1, 'a diff-based hunt was produced (edits returned)');
    assert(rEdit.body.edits.some(s => /GITSCHE-FIXED/.test(s.corrected||'') && /Gitsche/.test(s.ai||'')),
      'the human correction (Gitsche → GITSCHE-FIXED) is captured as an AI→corrected pair');
    // The ai_error_hunt lesson is persisted on the dialect topic.
    const edited = (env.readStore().topics || []).find(t => t.id === r.body.id);
    assert((edited.lessons||[]).some(l => l.type === 'ai_error_hunt'), 'an ai_error_hunt lesson was saved on the dialect topic');
    console.log('  human-correction AI error-hunt works for dialect (pure diff, no LLM): OK');

    console.log('e2e-dialect-import: ALL PASSED');
  } catch (e) {
    failed = true;
    console.error('e2e-dialect-import FAILED:', e && e.message || e);
  } finally {
    await env.stop();
    process.exit(failed ? 1 : 0);
  }
})();
