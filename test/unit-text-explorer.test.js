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

  // ── 2b. ⚠️ REWRITTEN AT v88_u: an unavailable analysis starts NOTHING ────────────────────────
  // This section asserted the OPPOSITE — that an unavailable GET fires POST /api/analyze-chapter and
  // moves the entry to 'analyzing'. The user removed that: *"Do NOT auto-start text-analysis from
  // the progress cards, when the magnifying glass button is clicked and no analysis exists. Just
  // show the text where words just can not be clicked if an analysis is not yet available."*
  //
  // Merely LOOKING at a chapter in explorer mode queued a multi-minute CP2 run per sentence against
  // the user's own model — from a VIEW toggle, no confirmation, on every chapter opened. The claim
  // inverts: the view READS, and only `analyzeChapters` (which pre-checks and confirms) writes.
  //
  // Asserted as "no POST was made at all", not as "the entry is 'none'": the entry could reach
  // 'none' while a POST also fired, and the POST is the thing that costs the user an hour of GPU.
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
    assert.strictEqual(C.run('postedUrl'), null,
      'NO POST is made — a view toggle must never queue a multi-minute analysis run');
    assert.strictEqual(C.run('typeof scheduledIntervalFn'), 'object',
      'and no polling interval is scheduled either (non-vacuity: the stub records one if it is)');
    const entry = JSON.parse(C.run(`JSON.stringify(APP._teCache['tp_te1'])`));
    assert.strictEqual(entry.status, 'none',
      'the entry settles on "none" — an answer, not a transient, so the view stops re-asking');
    // Terminal: a second call must not re-fetch either, or every repaint costs a round trip.
    C.run(`window._getCalls = 0; var _f = fetch;
      fetch = function(u, o){ if(!(o && o.method === 'POST')) window._getCalls++; return _f(u, o); };
      _ensureTextExplorerData(); true;`, 'again');
    await settle();
    assert.strictEqual(C.run('window._getCalls'), 0,
      'and "none" is TERMINAL — a second look does not re-ask the server');
  }
  console.log('  _ensureTextExplorerData: an unavailable analysis starts NO job and settles on "none": OK');

  // ── 2c. v88_u: the "none" state renders the plain story, with no word clickable ───────────────
  // "just show the text where words just can not be clicked". A status line would have been the
  // easy read of the request and the wrong one — the user asked for the TEXT.
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      _teCacheStore()['tp_te1'] = { status:'none' };
      window._html = _textExplorerBodyHtml(APP.lessonData);
      true;`, 'none-render');
    const html = C.run('window._html');
    assert.ok(!/te-tok/.test(html),
      'no token spans — nothing in the text is clickable without an analysis');
    assert.ok(!/te-status/.test(html),
      'and no status line either: the request was for the text, not for an explanation');
    assert.ok(html.includes('Hund'),
      'the story itself IS rendered (non-vacuity: an empty body would satisfy both checks above)');
    console.log('  the "no analysis" state renders the plain, unclickable story: OK');
  }

  // ── 2d. v88_u: queueing a real run drops the cached "none" ───────────────────────────────────
  // Otherwise a chapter analysed from the analysis button would keep showing plain text until a
  // reload, because "none" is terminal.
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const at = src.indexOf('async function analyzeChapters');
    assert.ok(at > 0, 'the explicit analysis entry point exists');
    const fn = src.slice(at, src.indexOf('\n}\n', at));
    assert.ok(/delete _teCacheStore\(\)\[id\]/.test(fn),
      'queueing a run invalidates the cached "none", so the chapter lights up without a reload');
    assert.ok(/analyze-chapter/.test(fn),
      'non-vacuity: this really is the function that starts analyses — the ONLY one that may');
    const ensure = src.slice(src.indexOf('async function _ensureTextExplorerData'),
                             src.indexOf('// Poller, same shape as'));
    assert.ok(!/analyze-chapter/.test(ensure),
      'and the VIEW path no longer names that route at all — the source-layer half of §2b, so a '
      + 'POST reintroduced on a branch no fixture reaches still fails');
    console.log('  starting a run invalidates the cached "none"; the view path cannot start one: OK');
  }

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
    // v88_u: 'none', not 'error'. A chapter missing from the bake is the DEFAULT case offline (only
    // some are ever baked — CP2 is a real model call per sentence), and it is now exactly the same
    // situation as an unanalysed chapter live: the plain story renders, no word is clickable, and
    // nothing suggests the learner has hit a fault they could act on. The claim this section
    // protects — degrades cleanly rather than hanging or crashing — is unchanged.
    assert.strictEqual(r.entry.status, 'none',
      'a chapter absent from the bake settles on "none", the same settled state an unanalysed '
      + 'chapter reaches live — not an error the learner cannot act on');
  }
  console.log('  static build: _ensureTextExplorerData() reads STATIC_ANALYSIS directly, present or absent, and never touches the network: OK');

  // ── 7b. v88_u: the QUESTION card's own 🔍, the third surface over the shared cache ────────────
  // "Question card: the collapsed text-view should also have the button to view the text analysis."
  // Open since v86_ad, which gave the LESSON-SET card one and recorded the question panel as the
  // remaining gap in INTERNALS. A THIRD independent flag, matching that precedent: three surfaces
  // can be open in different senses and toggling one must not flip another's visible state.
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      APP.cur = { lessonIdx:0, cur:0, exercises:[{ type:'mcq_target_source', correct:'x' }] };
      window._off = _exStoryPanelHtml(APP.cur.exercises[0]);
      true;`, 'panel-off');
    const off = C.run('window._off');
    assert.ok(/id="ex-story-explorer-btn"/.test(off), 'the question panel carries a 🔍 button');
    assert.ok(/toggleExTextExplorer\(\)/.test(off), 'wired to its own toggle');
    assert.ok(!/te-tok/.test(off), 'and with the flag off it renders the ordinary highlighted story');

    // Toggling must not disturb the OTHER two surfaces' flags — that is the whole reason for a
    // third flag rather than reusing APP._textExplorer.
    // ⚠️ The two other flags are seeded to DIFFERENT values on purpose. The first version of this
    // seeded both to `true` and asserted all three true afterwards — which a "copy my flag onto the
    // completion card's" mutation satisfies exactly, and it stayed green. Mixed values are what make
    // "leaves the others alone" observable at all.
    C.run(`APP._textExplorer = false; APP._lsTextExplorer = true;
      _teCacheStore()['tp_te1'] = { status:'none' };
      toggleExTextExplorer();
      window._flags = JSON.stringify({ ex: !!APP._exTextExplorer, comp: !!APP._textExplorer, ls: !!APP._lsTextExplorer });
      window._on = _exStoryPanelHtml(APP.cur.exercises[0]);
      true;`, 'panel-on');
    assert.deepStrictEqual(JSON.parse(C.run('window._flags')), { ex: true, comp: false, ls: true },
      'the question card\'s toggle flips ITS flag and leaves the other two EXACTLY as they were — '
      + 'one off, one on, neither touched');
    assert.ok(/var\(--blue\)/.test(C.run('window._on')),
      'and the button shows as active while the mode is on');

    // With a real analysis in the cache, the panel body comes from the ANALYSIS, not the vocabulary
    // highlight — non-vacuity for the branch, since the "none" state renders plain text either way.
    C.run(`_teCacheStore()['tp_te1'] = { status:'ready', data: { sentences: [
        { sentenceId:'s0', text:'Der Hund lauft.', paraBreakBefore:false, tokens:[
          {surface:'Der',lemma:'der',form:'article',sense:'the',confidence:'high'} ] } ] } };
      window._ana = _exStoryPanelHtml(APP.cur.exercises[0]); true;`, 'panel-ana');
    assert.ok(/te-tok/.test(C.run('window._ana')),
      'with an analysis in hand the question panel renders the analysed tokens');

    // Picking a language LEAVES explorer mode, the same rule the other two surfaces follow.
    C.run(`toggleExStoryLang('target'); window._after = !!APP._exTextExplorer; true;`, 'panel-lang');
    assert.strictEqual(C.run('window._after'), false,
      'choosing a flag exits explorer mode — the two controls are alternatives, not layers');
    console.log('  the question card has its own 🔍 over the shared cache, with its own flag: OK');
  }

  // ── 7c. v88_u: the shared cache repaints ALL THREE surfaces ───────────────────────────────────
  // v86_ad's own lesson, applied before shipping rather than after a bug report: "a second surface
  // added over a shared cache needs the repaint path widened too" — a fetch that resolves must not
  // land on a card the learner is not looking at.
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const at = src.indexOf('function _teRepaint()');
    const fn = src.slice(at, src.indexOf('\n}\n', at));
    assert.ok(/APP\._textExplorer/.test(fn) && /APP\._lsTextExplorer/.test(fn) && /APP\._exTextExplorer/.test(fn),
      'the repaint path names all three surfaces, each behind its own flag');
    console.log('  the shared cache repaints all three explorer surfaces: OK');
  }

  // ── 7d. v88_u: analysed words are no longer filled blue ───────────────────────────────────────
  // "don't show the blue highlight of analyzed text, just show the blue frame around the word on
  // mouse-over." The fill marked every analysed word at once — on a fully analysed chapter, the
  // whole text — and fought the red→green vocabulary colouring the same text carries.
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const rule = /\.te-tok\{([^}]*)\}/.exec(src);
    assert.ok(rule, 'the token rule exists');
    assert.ok(!/background/.test(rule[1]),
      'no background fill on an analysed word (got "' + rule[1] + '")');
    assert.ok(/\.te-tok:hover\{[^}]*outline:2px solid var\(--blue\)/.test(src),
      'the hover outline IS still there — the affordance moved, it was not removed');
    console.log('  analysed words carry no fill, only the hover frame: OK');
  }

  // ── 8. ⚠️ REGRESSION: a chapter arrived at with the mode ALREADY ON must load, not hang ────────
  // User bug report: "an existing text analysis can not be loaded anymore for tp_…070 … Perhaps this
  // is due to chapter tp_…091 being added to the storyline afterwards … In both cases it just said
  // 'lädt…'". Root cause: _ensureTextExplorerData() ran ONLY from the two toggle handlers, but
  // APP._textExplorer SURVIVES a chapter change — so painting a different chapter with the mode
  // already on found no cache entry, fetched nothing, and rendered the loading string forever. There
  // was no error and no retry: `!entry` and `status:'loading'` render the SAME string, so "never
  // fetched" is indistinguishable from "in flight". Mutation-tested: drop the render-path trigger and
  // this goes red.
  {
    const C = loadClient({ quiet: true });
    const B = { topic: 'T2', id: 'tp_te2', lang: 'de', srcLang: 'en', story: 'Ein Pfad.', lessons: [] };
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      APP.cur = { lessonIdx: 0, exercises: [], cur: 0, correct: 1, total: 1, mistakes: 0, hearts: 3, streak: 1, bestStreak: 1 };
      window.fetchCalls = [];
      fetch = function(u){ window.fetchCalls.push(u);
        return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
          chapterId: 'x', available:true, stale:false, sentenceCount:1, tokenCount:1,
          sentences:[{ text:'Ein Pfad.', tokens:[] }] }); } }); };
      toggleTextExplorer();
      true;`, 'chapter-A-on');
    await settle();
    assert.ok(C.run(`window.fetchCalls`).includes('/api/analysis/tp_te1'), 'setup: chapter A fetched on toggle-ON');
    assert.strictEqual(C.run(`(APP._teCache['tp_te1']||{}).status`), 'ready', 'setup: chapter A reached ready');

    // Navigate to a DIFFERENT chapter without touching the toggle — the reported scenario.
    C.run(`APP.lessonData = ${JSON.stringify(B)}; window.fetchCalls = []; _renderCompStory(); true;`, 'nav-to-B');
    await settle();
    assert.strictEqual(C.run('APP._textExplorer'), true, 'the explorer flag survives the chapter change (it always did)');
    assert.ok(C.run(`window.fetchCalls`).includes('/api/analysis/tp_te2'),
      'rendering a chapter with no cache entry now FETCHES it — this is the bug: the flag outlived ' +
      'the chapter but the fetch only ever ran from the toggle handler');
    assert.strictEqual(C.run(`(APP._teCache['tp_te2']||{}).status`), 'ready',
      'and the newly-arrived-at chapter reaches ready instead of sitting on "loading" forever');
    const html = C.run(`_textExplorerBodyHtml(APP.lessonData)`);
    assert.ok(!html.includes(UI.en['text_explorer.loading']),
      `the second chapter no longer renders the loading string (got: ${html.slice(0, 90)})`);
  }
  console.log('  regression: a chapter arrived at with the mode already on fetches and renders, not "loading" forever: OK');

  // ── 9. ⚠️ REGRESSION: the LESSON-SET card repaints when its own data lands ──────────────────────
  // The second half of the same report, and the one reachable with NO navigation at all. v86_ad gave
  // the lesson-set card its own explorer toggle (#story-body, its own APP._lsTextExplorer flag) over
  // the SAME shared cache — but the data path repainted with a bare `_renderCompStory()`, the
  // COMPLETION card. So toggling on the lesson-set card painted "Loading…" into #story-body, fetched,
  // reached 'ready', and then repainted a card the learner was not looking at. Measured before the
  // fix: cache 'ready', _renderCompStory ×2, renderStoryText ×1 (the initial paint), #story-body
  // still holding the loading string. Mutation-tested: revert _teRepaint to _renderCompStory and this
  // goes red.
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC)};
      window.compRenders = 0;
      var realComp = _renderCompStory;
      _renderCompStory = function(){ window.compRenders++; return realComp.apply(null, arguments); };
      fetch = function(u){ return Promise.resolve({ ok:true, status:200, json: function(){ return Promise.resolve({
          chapterId:'tp_te1', available:true, stale:false, sentenceCount:1, tokenCount:1,
          sentences:[{ text:'Der Hund lauft.', tokens:[] }] }); } }); };
      toggleLsTextExplorer();
      true;`, 'ls-toggle-on');
    await settle();
    assert.strictEqual(C.run(`(APP._teCache['tp_te1']||{}).status`), 'ready', 'setup: the fetch resolved to ready');
    const body = C.run(`(document.getElementById('story-body')||{}).innerHTML || ''`);
    assert.ok(!body.includes(UI.en['text_explorer.loading']),
      `#story-body must not still show the loading string once the data is ready (got: ${body.slice(0, 90)})`);
    assert.ok(body.length > 0, '#story-body actually rendered the analysed view');
    assert.strictEqual(C.run('window.compRenders'), 0,
      'and the COMPLETION card is not repainted for a lesson-set-card toggle — _teRepaint only ' +
      'refreshes the surface whose own flag is set');
  }
  console.log("  regression: the lesson-set card repaints its own #story-body when the analysis lands: OK");

  console.log('unit-text-explorer: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
