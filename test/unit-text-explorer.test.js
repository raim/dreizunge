// unit-text-explorer.test.js
// PLAN §7.0 CP1/CP2, item W ("text explorer" mode, roadmap_v86.md) step 4 — the CLIENT half.
// Server-side steps 2-3 (background job + per-chapter cache, GET /api/analysis/:id) are covered by
// e2e-analysis.test.js against a real (fake) LLM backend; this file covers the client's own
// rendering + fetch-orchestration logic in isolation, the same split unit-cp5-shadow.test.js uses
// for its own client half.
//
// Contract under test:
//   1. toggleTextExplorer() flips APP._textExplorer, forces APP._compStoryLang back to 'target'
//      (the analysis is of the TARGET-language story; a translation view has nothing to show), and
//      kicks off _ensureTextExplorerData() only when turning ON.
//   2. _ensureTextExplorerData(): a fresh, non-stale GET hit goes straight to 'ready' — no POST is
//      ever made. An unavailable/stale GET triggers the POST job-kickoff route.
//   3. _teSentenceHtml()/_teTokenMarkHtml(): each token is wrapped in its own <mark> with the real
//      lemma/form/sense as data-* attributes, using forward-only substring alignment against the
//      sentence's own raw text — a token that cannot be found is skipped, not corrupting the rest.
//   4. _textExplorerBodyHtml(): the four cache states (loading/analyzing/error/ready) each render
//      their own distinct, correct markup.
//   5. HTML/attribute injection in a token's lemma/form/sense cannot break out of the mark's
//      attributes or inject a tag — escAttr/escHtml both do real work here, not just prose text.
//   6. _renderCompStory(): with APP._textExplorer on, the progress card's story body actually
//      renders via _textExplorerBodyHtml (real per-word marks), not _storyBodyHtml — checked
//      end-to-end against the DOM, not just by reading the source's own branch.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const settle = () => new Promise(r => setTimeout(r, 60));

const SEED_COMMON = `
  LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
  APP.savedList = []; APP.storylines = [];
  APP.lang = 'de'; APP.srcLang = 'en';
  APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
  APP.progress = { completed: {}, solved: {}, chapterDone:{}, learned:{} };
  APP._teacherMode = false;
`;

const TOPIC = { topic: 'T', id: 'tp_te1', lang: 'de', srcLang: 'en',
  story: 'Der Hund lauft.', lessons: [] };

(async () => {
  // ── 1. toggleTextExplorer: flips state, forces 'target', triggers the fetch only when turning ON ──
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      APP._compStoryLang = 'source';
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
      document.getElementById = function(id){
        if (id === 'comp-story-panel-lbl' || id === 'comp-story-text' || id === 'comp-story-flags' ||
            id === 'comp-story-spk' || id === 'comp-story-explorer-btn')
          return { textContent:'', innerHTML:'', style:{}, setAttribute(){}, dataset:{} };
        return null;
      };
      var fetchCalls = [];
      fetch = function(u, opts){ fetchCalls.push(u); return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({ chapterId:'tp_te1', available:false }); } }); };
      toggleTextExplorer();
      true;`, 'toggle-on');
    assert.strictEqual(C.run('APP._textExplorer'), true, 'toggling ON sets APP._textExplorer');
    assert.strictEqual(C.run('APP._compStoryLang'), 'target', 'toggling ON forces the flag state back to target — analysis has nothing to say about a translation');
    await settle();
    assert.ok(C.run('fetchCalls').includes('/api/analysis/tp_te1'), 'toggling ON kicked off the GET analysis lookup for the CURRENT chapter');

    C.run(`fetchCalls = []; toggleTextExplorer(); true;`, 'toggle-off');
    assert.strictEqual(C.run('APP._textExplorer'), false, 'toggling again turns it back OFF');
    await settle();
    assert.strictEqual(C.run('fetchCalls.length'), 0, 'toggling OFF makes no fetch at all');
  }
  console.log('  toggleTextExplorer: flips state, forces target-language view, fetches only on toggle-ON: OK');

  // ── 2a. _ensureTextExplorerData: a fresh, non-stale cache hit goes straight to ready, no POST ──
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      document.getElementById = function(){ return { textContent:'', innerHTML:'', style:{}, setAttribute(){}, dataset:{} }; };
      var posted = false;
      fetch = function(u, opts){
        if(opts && opts.method === 'POST'){ posted = true; return Promise.resolve({ ok:true, status:202, json: function(){ return Promise.resolve({jobId:'should-not-happen'}); } }); }
        return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve(
          { chapterId:'tp_te1', available:true, stale:false, sentenceCount:1, tokenCount:3,
            sentences:[{ sentenceId:'tp_te1:s0', text:'Der Hund lauft.', paraBreakBefore:false,
              tokens:[{tokenId:'t0',idx:0,surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'}],
              phrases:[] }] }); } });
      };
      _ensureTextExplorerData();
      true;`, 'ensure-fresh-hit');
    await settle();
    assert.strictEqual(C.run('posted'), false, 'a fresh cache hit never POSTs a new analysis job');
    const entry = JSON.parse(C.run(`JSON.stringify(APP._teCache['tp_te1'])`));
    assert.strictEqual(entry.status, 'ready', 'the cache entry reaches ready status');
    assert.strictEqual(entry.data.sentences[0].tokens[0].lemma, 'der', 'the real fetched analysis data is recorded');
  }
  console.log('  _ensureTextExplorerData: a fresh cache hit reaches ready with NO analysis job started: OK');

  // ── 2b. _ensureTextExplorerData: unavailable -> triggers the POST job-kickoff route ──────────
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      document.getElementById = function(){ return { textContent:'', innerHTML:'', style:{}, setAttribute(){}, dataset:{} }; };
      var postedUrl = null;
      fetch = function(u, opts){
        if(opts && opts.method === 'POST'){ postedUrl = u; return Promise.resolve({ ok:true, status:202, json: function(){ return Promise.resolve({jobId:'j123'}); } }); }
        return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({ chapterId:'tp_te1', available:false }); } });
      };
      // _startTextExplorerJob's own setInterval is the REAL Node timer in this harness (lib-dom's
      // sandbox maps it straight through) — stubbed here so this test doesn't leave a live 2s
      // interval running forever and hanging the test process. Recording the interval's OWN
      // callback lets us assert one was actually scheduled without ever letting it fire.
      var scheduledIntervalFn = null;
      setInterval = function(fn){ scheduledIntervalFn = fn; return 999; };
      _ensureTextExplorerData();
      true;`, 'ensure-miss');
    await settle();
    assert.strictEqual(C.run('postedUrl'), '/api/analyze-chapter/tp_te1', 'an unavailable GET triggers the POST job-kickoff route for the SAME chapter');
    assert.strictEqual(C.run('_textExplorerJobId'), 'j123', 'the returned jobId is recorded for the shared poller/visibilitychange hook');
    const entry = JSON.parse(C.run(`JSON.stringify(APP._teCache['tp_te1'])`));
    assert.strictEqual(entry.status, 'analyzing', 'the cache entry moves to analyzing while the job runs');
    assert.strictEqual(C.run('typeof scheduledIntervalFn'), 'function', 'a real polling interval was scheduled for the new job (2s poll shape, matching the comic pollers)');
  }
  console.log('  _ensureTextExplorerData: an unavailable/stale cache triggers a real analysis job, tracked for polling: OK');

  // ── 3. _teSentenceHtml/_teTokenMarkHtml: real per-token marks, forward-only alignment ─────────
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON, 'seed-3');
    const html = C.run(`_teSentenceHtml({ text:'Der Hund lauft.', tokens:[
      {surface:'Der', lemma:'der', form:'article', sense:'the', confidence:'high'},
      {surface:'Hund', lemma:'hund', form:'noun', sense:'dog', confidence:'high'},
      {surface:'lauft', lemma:'laufen', form:'verb', sense:'runs', confidence:'low'},
    ]})`);
    assert.ok(html.includes('data-lemma="der"') && html.includes('data-form="article"') && html.includes('data-sense="the"'),
      `first token carries its real lemma/form/sense as data attributes (got ${html})`);
    assert.ok(html.includes('te-tok-low'), 'the low-confidence token gets the fainter te-tok-low class');
    assert.ok(html.includes('>Der<') && html.includes('>Hund<') && html.includes('>lauft<'), 'each token surface appears as its own mark\'s text');
    assert.ok(html.includes('.'), 'trailing punctuation (not a token) survives as plain text after the last mark');
    console.log('  _teSentenceHtml: real per-token marks with lemma/form/sense/confidence, trailing punctuation preserved: OK');

    // A token whose surface cannot be found (index drift) is skipped, not corrupting the sentence.
    const html2 = C.run(`_teSentenceHtml({ text:'Der Hund lauft.', tokens:[
      {surface:'Der', lemma:'der', form:'article', sense:'the', confidence:'high'},
      {surface:'ZZZNOTPRESENT', lemma:'x', form:'x', sense:'x', confidence:'high'},
      {surface:'lauft', lemma:'laufen', form:'verb', sense:'runs', confidence:'high'},
    ]})`);
    assert.ok(html2.includes('>Der<') && html2.includes('>lauft<') && !html2.includes('ZZZNOTPRESENT'),
      `a token that cannot be found in the sentence text is skipped, the rest still renders (got ${html2})`);
    console.log('  _teSentenceHtml: a token with no real match in its own sentence text is skipped, not corrupting: OK');
  }

  // ── 4. _textExplorerBodyHtml: the four cache states each render distinctly ─────────────────────
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON, 'seed-4');
    const withEntry = (entry, topic) => C.run(`
      APP._teCache = APP._teCache || {};
      APP._teCache['tp_te1'] = ${JSON.stringify(entry)};
      _textExplorerBodyHtml(${JSON.stringify(topic || TOPIC)});`);

    assert.ok(withEntry({ status: 'loading' }).includes('te-status'), 'loading renders the status paragraph');
    const analyzing = withEntry({ status: 'analyzing', step: 'CP2: analysing 3 sentence(s)…' });
    assert.ok(analyzing.includes('CP2: analysing 3 sentence'), `analyzing shows the real live job step (got ${analyzing})`);
    const errored = withEntry({ status: 'error', error: 'boom' });
    assert.ok(errored.includes('boom'), `error state shows the real error message (got ${errored})`);
    // v86_s: layout is reconstructed from the REAL story text (d.story), not from CP1's own
    // paraBreakBefore flag (see _teStoryHtml's own comment for why) — the topic's `story` here
    // must actually contain a blank line between the two sentences for this to mean anything.
    const twoParaTopic = { ...TOPIC, story: 'Der Hund lauft.\n\nDie Katze schlaft.' };
    const ready = withEntry({ status: 'ready', data: { sentences: [
      { sentenceId:'s0', text:'Der Hund lauft.',
        tokens:[{surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'}] },
      { sentenceId:'s1', text:'Die Katze schlaft.',
        tokens:[{surface:'Die',lemma:'die',form:'article',sense:'the',confidence:'high'}] },
    ] } }, twoParaTopic);
    assert.ok(ready.includes('te-tok'), 'ready state renders real per-word marks');
    // A real blank line in the story between the two sentences -> two separate <p> paragraphs.
    assert.strictEqual((ready.match(/<p /g) || []).length, 2, `a real blank line in the story starts a NEW paragraph (got ${ready})`);
  }
  console.log('  _textExplorerBodyHtml: loading/analyzing/error states render correctly; a real blank line starts a new paragraph: OK');

  // ── 4c. v86_s (user follow-up): layout fidelity — switching views must change ONLY colours/links,
  //       not the text's own line/paragraph structure. Reconstructed from the REAL story text via
  //       forward alignment, same technique as per-token alignment, one level up per sentence. ────
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON, 'seed-4c');
    // Real bug, real strings: tp_17877511606660000499 ("Cleanliness Command") — a `\n` falls MID-
    // SENTENCE (after a colon, not a recognized sentence end) and survives verbatim inside CP1's own
    // sentence.text; a SEPARATE `\n` falls BETWEEN two sentences with no blank line. Both must render
    // as <br>, matching what _storyParasHtml would do for the exact same raw text.
    const story = 'Aiutateci a mantenere pulito questo bagno:\nlasciatelo come vorreste trovarlo!!!\nGrazie!';
    const html = C.run(`_teStoryHtml(${JSON.stringify(story)}, [
      { text:'Aiutateci a mantenere pulito questo bagno:\\nlasciatelo come vorreste trovarlo!!!',
        tokens:[{surface:'Aiutateci',lemma:'aiutare',form:'verb',sense:'help us',confidence:'high'}] },
      { text:'Grazie!', tokens:[{surface:'Grazie!',lemma:'grazie',form:'interjection',sense:'thanks',confidence:'high'}] },
    ])`);
    assert.strictEqual((html.match(/<br>/g) || []).length, 2,
      `BOTH the mid-sentence and the inter-sentence single newline become <br> (got ${html})`);
    assert.strictEqual((html.match(/<p /g) || []).length, 1, 'no blank line anywhere in this story -> exactly ONE paragraph, not two');
    assert.ok(!html.includes('\n<'), 'no literal newline survives unconverted into the HTML (would collapse to a space in the browser)');
    console.log('  _teStoryHtml: both a mid-sentence AND an inter-sentence single newline become <br>, matching the normal view\'s own layout exactly: OK');

    // A genuinely blank-line paragraph break is still a real <p> break, not just another <br>.
    const html2 = C.run(`_teStoryHtml('One.\\n\\nTwo.', [
      { text:'One.', tokens:[] }, { text:'Two.', tokens:[] },
    ])`);
    assert.strictEqual((html2.match(/<p /g) || []).length, 2, `a real blank line still starts a genuine new paragraph, not a <br> (got ${html2})`);
    console.log('  _teStoryHtml: a genuine blank line still starts a real new <p>, not just another <br>: OK');

    // Plain prose (a normal space between two sentences, no newline anywhere) is completely unaffected.
    const html3 = C.run(`_teStoryHtml('One. Two.', [
      { text:'One.', tokens:[] }, { text:'Two.', tokens:[] },
    ])`);
    assert.ok(html3.includes('One.</p>') === false && /One\.\s*Two\./.test(html3.replace(/<[^>]+>/g, '')),
      `ordinary prose (a plain space between sentences) is unaffected (got ${html3})`);
    assert.strictEqual((html3.match(/<p /g) || []).length, 1, 'plain prose stays ONE paragraph');
    console.log('  _teStoryHtml: ordinary prose (a plain space between sentences) is completely unaffected: OK');
  }

  // ── 4b. v86_p/v86_t (user follow-up + a real reported layout bug): a comic-sourced chapter shows
  //       its panel images too, wrapped in the SAME padded card markup the default view uses ────
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON, 'seed-4b');
    // v86_t (user-reported, real screenshots): the SINGLE-panel case is the common one — image and
    // text must share ONE `.comic-story-panel` card, pixel-identical structure to the default view's
    // own `_comicStoryPanelsHtml`, or the SAME chapter's text visibly starts at a different
    // x-position depending which view is showing (the real bug, caught from two real screenshots).
    const SINGLE_COMIC_TOPIC = { ...TOPIC, comicPanels: [
      { x1:0,y1:0,x2:10,y2:10, caption:'Der Hund lauft.', inScene:'', image:'data:image/jpeg;base64,AAAA' },
    ] };
    const readySingle = C.run(`
      APP._teCache = { tp_te1: { status:'ready', data: { sentences: [
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false,
          tokens:[{surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'}] },
      ] } } };
      _textExplorerBodyHtml(${JSON.stringify(SINGLE_COMIC_TOPIC)});`);
    assert.ok(readySingle.includes('data:image/jpeg;base64,AAAA'), `the panel image renders (got ${readySingle})`);
    assert.strictEqual((readySingle.match(/class="comic-story-panel"/g) || []).length, 1,
      `single panel -> exactly ONE card, image+text sharing it (got ${readySingle})`);
    assert.ok(/comic-story-panel">[^]*<img class="comic-story-panel-img"[^]*<div class="comic-story-panel-text">[^]*te-tok/.test(readySingle),
      `image and the per-word marked-up text are nested INSIDE the SAME card, in that order (got ${readySingle})`);

    // Multi-panel: no per-panel boundary exists in the flat CP1/CP2 sentence stream, so each image
    // gets its OWN text-less card, and the whole flat text gets one FURTHER card — same padded
    // markup, just not a literal per-panel pairing (matches the translation view's own v86_t fix).
    const COMIC_TOPIC = { ...TOPIC, comicPanels: [
      { x1:0,y1:0,x2:10,y2:10, caption:'Der Hund lauft.', inScene:'', image:'data:image/jpeg;base64,AAAA' },
      { x1:10,y1:0,x2:20,y2:10, caption:'', inScene:'', image:'data:image/jpeg;base64,BBBB' },
    ] };
    const ready = C.run(`
      APP._teCache = { tp_te1: { status:'ready', data: { sentences: [
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false,
          tokens:[{surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'}] },
      ] } } };
      _textExplorerBodyHtml(${JSON.stringify(COMIC_TOPIC)});`);
    assert.ok(ready.includes('comic-story-panels') && ready.includes('data:image/jpeg;base64,AAAA') && ready.includes('data:image/jpeg;base64,BBBB'),
      `the text-explorer view shows BOTH real panel images (got ${ready})`);
    assert.strictEqual((ready.match(/class="comic-story-panel"/g) || []).length, 3,
      `2 image-only cards PLUS 1 further text-only card, not a per-panel pairing (got ${ready})`);
    assert.ok(ready.includes('comic-story-panel-text'),
      'v86_t: the flat text IS wrapped in .comic-story-panel-text — same padding as the default view');
    assert.ok(ready.includes('te-tok'), 'the per-word analysis marks still render too, inside that wrapped card');
    // Non-comic TOPIC (no comicPanels) must be entirely unaffected — no stray empty strip.
    const readyPlain = C.run(`
      APP._teCache = { tp_te1: { status:'ready', data: { sentences: [
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false,
          tokens:[{surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'}] },
      ] } } };
      _textExplorerBodyHtml(${JSON.stringify(TOPIC)});`);
    assert.ok(!readyPlain.includes('comic-story-panels'), 'a plain (non-comic) chapter shows no panel strip at all — the helper is a harmless no-op for it');
  }
  console.log('  _textExplorerBodyHtml: a comic-sourced chapter shows panel images wrapped in the SAME padded card markup as the default view, unaffected for plain chapters: OK');

  // ── 5. Injection safety: a hostile lemma/form/sense cannot break out of the attribute or tag ──
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON, 'seed-5');
    const html = C.run(`_teSentenceHtml({ text:'Hallo', tokens:[
      {surface:'Hallo', lemma:'"><script>alert(1)</script>', form:'x" onmouseover="alert(2)', sense:'y', confidence:'high'},
    ]})`);
    assert.ok(!html.includes('<script>'), `a lemma containing a literal <script> tag must not survive unescaped (got ${html})`);
    assert.ok(!/onmouseover="alert/.test(html), `a form value must not be able to inject a NEW attribute via an unescaped quote (got ${html})`);
    console.log('  token data-* attributes: a hostile lemma/form/sense cannot inject a tag or a new attribute: OK');
  }

  // ── 6. _renderCompStory(): explorer ON actually renders via _textExplorerBodyHtml, end-to-end ──
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      APP._teCache = { tp_te1: { status:'ready', data: { sentences:[
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false,
          tokens:[{surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'},
                  {surface:'Hund',lemma:'hund',form:'noun',sense:'dog',confidence:'high'},
                  {surface:'lauft',lemma:'laufen',form:'verb',sense:'runs',confidence:'high'}] },
      ] } } };
      APP._textExplorer = true; APP._compStoryLang = 'target';
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
      _renderCompStory();
      true;`, 'render-explorer-on');
    const bodyHtml = C.run(`document.getElementById('comp-story-text').innerHTML`);
    assert.ok(bodyHtml.includes('te-tok'), `explorer ON: the story panel body actually contains real per-word marks (got ${bodyHtml})`);
    assert.ok(bodyHtml.includes('data-lemma="hund"'), 'the real cached analysis data reaches the rendered DOM, not a placeholder');

    // Turn it off: the SAME element now renders through the ORIGINAL _storyBodyHtml path — no
    // te-tok marks at all (this fixture has no vocab, so highlighting would be empty either way,
    // but the explorer-specific status/marks must be gone).
    C.run(`APP._textExplorer = false; _renderCompStory(); true;`, 'render-explorer-off');
    const bodyHtml2 = C.run(`document.getElementById('comp-story-text').innerHTML`);
    assert.ok(!bodyHtml2.includes('te-tok'), `explorer OFF: no te-tok marks remain — back to the normal story renderer (got ${bodyHtml2})`);
  }
  console.log('  _renderCompStory(): explorer ON renders real per-word analysis marks into the DOM; OFF reverts cleanly: OK');

  // ── 7. v86_y: the explorer button and the two language flags are ALTERNATE views, not stackable ──
  // User report: the explorer button is an alternative to the two flags — when it's on, a flag must
  // NOT still look active (before this fix, toggleTextExplorer forced _compStoryLang back to
  // 'target', so the target flag kept its active (blue-border) styling even though the panel was
  // showing a THIRD view neither flag actually produces), and clicking a flag must exit explorer mode
  // (before this fix, clicking the ALREADY-'target' flag while explorer was on did nothing visible).
  {
    const TOPIC_XL = { topic: 'T', id: 'tp_te1', lang: 'de', srcLang: 'en',
      story: 'Der Hund lauft.', storyTranslation: 'The dog runs.', lessons: [] };
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC_XL)};
      APP._teCache = { tp_te1: { status:'ready', data: { sentences:[
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false, tokens:[] },
      ] } } };
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
      APP._textExplorer = true; APP._compStoryLang = 'target';
      _renderCompStory();
      true;`, 'explorer-on-flags');
    const flagsHtml = C.run(`document.getElementById('comp-story-flags').innerHTML`);
    assert.ok(!flagsHtml.includes('var(--blue)'), `explorer ON: NEITHER flag shows the active (blue-border) style (got ${flagsHtml})`);

    // Clicking the target flag while explorer is on must exit explorer mode AND actually switch the
    // rendered view — before the fix, _compStoryLang was already 'target', so this click was a
    // same-state re-render that never left the explorer view at all.
    C.run(`toggleCompStoryLang('target'); true;`, 'click-target-flag');
    assert.strictEqual(C.run('APP._textExplorer'), false, 'clicking a flag while explorer is on turns explorer OFF');
    const bodyHtml = C.run(`document.getElementById('comp-story-text').innerHTML`);
    assert.ok(!bodyHtml.includes('te-tok'), 'the panel actually left the explorer view (no te-tok marks survive the click)');
    const flagsHtml2 = C.run(`document.getElementById('comp-story-flags').innerHTML`);
    assert.ok(flagsHtml2.includes('var(--blue)'), 'once explorer is off, the now-current flag (target) shows active again');
  }
  console.log('  explorer ON: neither flag shows active; clicking a flag exits explorer mode and switches the view: OK');

  // ── 8. v86_z: static-build mode reads the baked STATIC_ANALYSIS snapshot, never fetches ────────
  // The static build has no server for GET /api/analysis or POST /api/analyze-chapter — this is the
  // ONLY branch reachable there, and it must never touch the network at all (a fetch would just fail
  // against a page with no backend, but the point is to degrade INSTANTLY and correctly, not to fail
  // slowly the same way a live 404 would).
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      window._fetchCalls = 0; fetch = function(){ window._fetchCalls++; return Promise.reject(new Error('must not be called')); };
      STATIC_ANALYSIS = { tp_te1: { chapterId:'tp_te1', available:true, stale:false, sentenceCount:1, tokenCount:1,
        sentences:[{ sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false, tokens:[
          {surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'} ] }] } };
      (async()=>{ await _ensureTextExplorerData(); })();
      true;`, 'static-hit');
    await settle();
    const r = JSON.parse(C.run(`JSON.stringify({ fetchCalls: window._fetchCalls, entry: _teCacheStore()['tp_te1'] })`));
    assert.strictEqual(r.fetchCalls, 0, 'static mode never calls fetch — the baked snapshot is read directly, no network round trip at all');
    assert.strictEqual(r.entry.status, 'ready', 'a chapter present in the bake goes straight to ready');
    assert.ok(r.entry.data && r.entry.data.sentences && r.entry.data.sentences.length === 1, 'the REAL baked sentence data reaches the cache entry, not a placeholder');
  }
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      window._fetchCalls = 0; fetch = function(){ window._fetchCalls++; return Promise.reject(new Error('must not be called')); };
      STATIC_ANALYSIS = { };   // this chapter was never analysed before the last build-static.js run
      (async()=>{ await _ensureTextExplorerData(); })();
      true;`, 'static-miss');
    await settle();
    const r = JSON.parse(C.run(`JSON.stringify({ fetchCalls: window._fetchCalls, entry: _teCacheStore()['tp_te1'] })`));
    assert.strictEqual(r.fetchCalls, 0, 'a chapter absent from the bake ALSO never calls fetch — there is no live job to kick off statically');
    assert.strictEqual(r.entry.status, 'error', 'a chapter absent from the bake degrades to a clean error state, not a hang or a crash');
  }
  console.log('  static build: _ensureTextExplorerData() reads STATIC_ANALYSIS directly, present or absent, and never touches the network: OK');

  console.log('unit-text-explorer: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
