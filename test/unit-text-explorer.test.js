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

  // ── 7b2. v88_x: the story AFTER the last analysed sentence is RENDERED, not dropped ───────────
  // ⚠️ `_teStoryHtml` only ever emitted the gaps BETWEEN located sentences, so everything past the
  // final one vanished — the explorer showed a TRUNCATED chapter. Invisible while every analysis was
  // complete and reached the end of the text; the moment a PARTIAL renders (the point of v88_x's
  // resume) the un-analysed remainder would disappear, which is far worse than showing it plain.
  {
    const C = loadClient({ quiet: true });
    const story = 'Der Hund lauft. Die Katze schlaft.\n\nEin neuer Absatz folgt.';
    C.run(SEED_COMMON + `
      window._out = _teStoryHtml(${JSON.stringify(story)}, [
        { sentenceId:'s0', text:'Der Hund lauft.', tokens:[
          {surface:'Hund',lemma:'hund',form:'n',sense:'dog',confidence:'high'} ] } ]);
      true;`, 'tail');
    const html = C.run('window._out');
    assert.ok(/te-tok/.test(html), 'the analysed sentence is marked up');
    assert.ok(html.includes('Die Katze schlaft.'),
      'the sentence AFTER the analysed one is still shown — unclickable, but present');
    assert.ok(html.includes('Ein neuer Absatz folgt.'),
      'and so is text beyond a blank line, which the gap helper would have discarded entirely');
    assert.ok(!/te-tok[^>]*>\s*Katze/.test(html),
      'the un-analysed remainder carries NO token spans — nothing there is clickable');
    // Non-vacuity: the paragraph break in the tail becomes a real break, not a swallowed newline.
    assert.ok(/<\/p><p[^>]*>[^<]*Ein neuer Absatz/.test(html),
      'a blank line in the tail opens a new paragraph rather than collapsing');
    console.log('  the explorer renders the story past the last analysed sentence: OK');
  }

  // ── 7b3. v88_x: the re-analyse choice is a THREE-way dialog, and it sends what it promises ────
  // "when the button is clicked on existing annotation, we should get an option 'overwrite' or
  // 'expand existing'". Asserted on the REQUEST BODY, because that is the only thing that decides
  // what the server does — a dialog that offers "fill in the gaps" and then posts {force:true}
  // would look perfect and cost the user the whole chapter.
  {
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      window._posts = []; window._choiceArgs = null;
      APP.info = { canGenerate: true };
      showToast = function(){};
      fetch = function(u, o){
        if (o && o.method === 'POST') { window._posts.push({ url:String(u), body:o.body });
          return Promise.resolve({ ok:true, status:202, json:function(){ return Promise.resolve({jobId:'j'}); } }); }
        return Promise.resolve({ ok:true, status:200, json:function(){ return Promise.resolve(
          { chapterId:'tp_1', available:true, stale:false, partial:false,
            usableSentences:4, totalSentences:6 }); } });
      };
      true;`, 'seed-dlg');

    const run = async (choice) => {
      C.run(`window._posts = [];
        showChoiceDialog = function(o){ window._choiceArgs = JSON.stringify(o); return Promise.resolve(${JSON.stringify(choice)}); };
        analyzeChaptersRun(["tp_1"]); true;`, "run");
      await settle(80);
      return JSON.parse(C.run('JSON.stringify(window._posts)'));
    };

    let posts = await run('resume');
    assert.strictEqual(posts.length, 1, 'the resume choice issues exactly one analyse request');
    assert.deepStrictEqual(JSON.parse(posts[0].body), { resume: true },
      'and it asks the server to RESUME (got ' + posts[0].body + ')');

    posts = await run('force');
    assert.deepStrictEqual(JSON.parse(posts[0].body), { force: true },
      'the overwrite choice asks the server to FORCE (got ' + posts[0].body + ')');

    posts = await run(null);
    assert.strictEqual(posts.length, 0,
      'cancelling issues no request at all — unchanged from the confirm() this replaced');

    // The dialog itself: two real choices, and the counts come from the SERVER's own shadow rather
    // than being recomputed here, or the number shown and the work done could disagree.
    const args = JSON.parse(C.run('window._choiceArgs'));
    assert.deepStrictEqual(args.choices.map(c => c.value), ['resume', 'force'],
      'both options are offered, resume first');
    assert.ok(args.choices.every(c => c.label && c.label.length > 3), 'each option is labelled');
    assert.ok(/\b4\b/.test(args.body) && /\b6\b/.test(args.body),
      'the question states how much is already annotated, from the shadow\'s own counts (got '
      + JSON.stringify(args.body) + ')');
    console.log('  the re-analyse dialog offers resume/overwrite and posts what it offered: OK');
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
  //
  // ⚠️ v88_w: THIS ASSERTION WAS A PROXY, AND THE PROXY IS WHY THE FIRST ATTEMPT SHIPPED BROKEN.
  // It read `!/background/.test(rule)` — "the rule declares no background" — as a stand-in for "the
  // word is not filled". Those are different claims for a <mark>, which carries the BROWSER's own
  // yellow. v88_u deleted the blue declaration and satisfied the proxy exactly, and the user saw the
  // highlight turn from light blue to YELLOW. Worse, the proxy would have gone RED on the correct
  // fix, since suppressing a UA default REQUIRES declaring `background:none`.
  //
  // Stated properly now: every token rule must set a background, and every one it sets must be
  // none/transparent. That fails on a colour, fails on a missing declaration, and passes on the fix.
  {
    const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Non-vacuity for the premise: these really are <mark> elements, which is the whole reason a
    // bare "no background declared" is not enough.
    assert.ok(/<mark class="\$\{cls\}"/.test(src),
      'the analysed tokens are <mark> elements — so the browser has a fill of its own to suppress');
    const rules = [...src.matchAll(/\.te-tok(-[a-z]+)?\{([^}]*)\}/g)].map(m => ({ sel: '.te-tok' + (m[1] || ''), body: m[2] }));
    assert.ok(rules.length >= 3, 'all the token rules were found (got ' + rules.length + ')');
    for (const r of rules) {
      const bg = /background:\s*([^;]+)/.exec(r.body);
      assert.ok(bg, r.sel + ' declares a background — omitting it leaves the <mark> default showing');
      assert.ok(/^(none|transparent)$/.test(bg[1].trim()),
        r.sel + ' paints NO colour behind the word (got "' + bg[1].trim() + '")');
    }
    assert.ok(/\.te-tok:hover\{[^}]*outline:2px solid var\(--blue\)/.test(src),
      'the hover outline IS still there — the affordance moved, it was not removed');
    assert.ok(/\.te-tok\{[^}]*color:inherit/.test(src),
      'and the text colour is inherited, not the <mark> default black, which would fight the theme');
    console.log('  analysed words carry no fill at all (the <mark> default included), only the hover frame: OK');
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

  // ── item AI (v88_ad): the curator EDITOR in the token popover ─────────────────────────────────
  // Rendered through the real _textExplorerBodyHtml so the identity attributes the editor depends on
  // (data-cid / data-si / data-occ) are asserted as the real render emits them, not as a fixture
  // hand-writes them — those three ARE the correction key, and a mismatch would silently write a
  // correction onto the wrong word.
  // ⚠️ The surface "een" appears TWICE, identically cased, on purpose. A first version of this
  // fixture used "Een … een", and the capitalised one is a DIFFERENT surface — so every token was
  // occurrence 0 of its own surface and a mutation that hardcoded `occ = 0` stayed GREEN. A fixture
  // that cannot distinguish right from wrong is not a guard, however many assertions it carries.
  const ANA = { chapterId:'tp_te1', available:true, stale:false, sentenceCount:1, tokenCount:5,
    correctionCount:0, sentences:[{ text:'een landschap met een hek.', tokens:[
      { surface:'een', lemma:'een', form:'Artikel', sense:'ein', confidence:'high', reviewed:false },
      { surface:'landschap', lemma:'', form:'', sense:'', confidence:'unresolved', reviewed:false },
      { surface:'met', lemma:'met', form:'Prap', sense:'mit', confidence:'high', reviewed:false },
      { surface:'een', lemma:'een', form:'Artikel', sense:'ein', confidence:'high', reviewed:false },
      { surface:'hek', lemma:'', form:'', sense:'', confidence:'unresolved', reviewed:false } ] }] };
  const TOPIC_NL = { id:'tp_te1', topic:'Landschap', lang:'nl', srcLang:'de',
    story:'een landschap met een hek.', lessons:[] };

  function explorerClient(){
    const C = loadClient({ quiet: true });
    C.run(SEED_COMMON + `
      APP.lessonData = ${JSON.stringify(TOPIC_NL)};
      _teCacheStore()['tp_te1'] = { status:'ready', data: ${JSON.stringify(ANA)} };
      __HTML = _textExplorerBodyHtml(${JSON.stringify(TOPIC_NL)});
      true;`, 'te-seed');
    return C;
  }

  {
    const C = explorerClient();
    const html = C.run('__HTML');
    // The identity attributes, on the RIGHT tokens. "een" appears twice with different case, so
    // occurrence must restart per surface: 'Een' is occ 0 of its own surface, and the lower-case
    // 'een' is occ 0 of ITS surface — not occ 1.
    assert.ok(/data-cid="tp_te1"/.test(html), 'each token carries its chapter id');
    assert.ok(/data-surface="landschap"[^>]*data-si="0"[^>]*data-occ="0"/.test(html)
           || /data-si="0"[^>]*data-occ="0"[^>]*data-surface="landschap"/.test(html)
           || /data-surface="landschap"[^>]*data-occ="0"/.test(html),
      'and its sentence index and occurrence (got: ' + (html.match(/<mark[^>]*landschap[^>]*>/) || [''])[0] + ')');
    const eens = (html.match(/<mark[^>]*data-surface="een"[^>]*>/g) || []);
    assert.strictEqual(eens.length, 2, '"een" rendered twice — the repeat the occurrence index exists for');
    assert.ok(/data-occ="0"/.test(eens[0]), 'the first "een" is occurrence 0');
    assert.ok(/data-occ="1"/.test(eens[1]), 'and the second is occurrence 1 — counted per surface');
    console.log('  the explorer stamps chapter/sentence/occurrence identity on every token: OK');
  }

  // ⚠️ CROSS-LAYER: the key the CLIENT emits must address the token the SERVER's merge resolves.
  // These are two independent implementations of "which occurrence of this surface is this" — the
  // renderer's loop in index.html and applyCorrections' loop in analysis-corrections.js — and if
  // they ever disagree, a curator's edit is written under one key and applied to a DIFFERENT word,
  // silently. Neither side's own unit tests can catch that: each is self-consistent. So the real
  // server module is required here and fed the attributes the real renderer produced.
  {
    const AC = require(path.join(ROOT, 'analysis-corrections.js'));
    const C = explorerClient();
    const html = C.run('__HTML');
    // Pick the LOWER-CASE "een" — the sentence's genuinely ambiguous surface, and the one a
    // key without an occurrence would resolve to the wrong token.
    // Deliberately the SECOND "een": the first would be occurrence 0 and could not tell a correct
    // occurrence index from a hardcoded zero.
    const mark = (html.match(/<mark[^>]*data-surface="een"[^>]*>/g) || [])[1];
    assert.ok(mark, 'the second "een" token rendered');
    const attr = (n) => (new RegExp('data-' + n + '="([^"]*)"').exec(mark) || [])[1];
    const si = Number(attr('si')), occ = Number(attr('occ')), surface = attr('surface');

    const merged = AC.applyCorrections(ANA.sentences, [{
      sentenceText: ANA.sentences[si].text, surface, occurrence: occ, sense: 'ROUNDTRIP' }]);
    const hits = merged[0].tokens.map((t, i) => (t.sense === 'ROUNDTRIP' ? i : -1)).filter(i => i >= 0);
    assert.strictEqual(occ, 1, 'the client stamped the SECOND "een" as occurrence 1');
    assert.deepStrictEqual(hits, [3],
      'and the server merge lands on token index 3 — the same second "een" (si=' + si + ', occ=' + occ
      + '), NOT the first one at index 0');
    console.log('  the client\'s correction key and the server\'s merge resolve the SAME token: OK');
  }

  // The worklist bar: composed from the EXISTING unresolved string plus a count, so this whole
  // feature shipped with zero new ui.json keys.
  {
    const C = explorerClient();
    const html = C.run('__HTML');
    assert.ok(html.includes('te-fixbar'), 'the unresolved worklist bar renders when there is something to fix');
    assert.ok(html.includes('2 · ' + UI.en['text_explorer.unresolved']),
      'and states how many tokens are unresolved, reusing text_explorer.unresolved (got: '
        + (html.match(/te-fixbtn[^>]*>([^<]*)</) || ['', ''])[1] + ')');
    // Non-vacuity: the COUNT is what varies. ⚠️ v88_ah re-scoped this — it used to assert the bar
    // vanishes entirely on a fully-resolved chapter, which is exactly what left the curator table
    // unreachable there. What must not appear on such a chapter is the unresolved COUNT and the
    // worklist JUMP, not the bar.
    const clean = C.run(`_teUnresolvedBarHtml('tp_te1', [{ text:'x', tokens:[{surface:'x',lemma:'x'}] }], { orphanedCorrections: [] })`);
    assert.ok(!/\d+ · /.test(clean),
      'a fully-resolved chapter shows no unresolved count (got: ' + clean + ')');
    assert.ok(!clean.includes('_teJumpUnresolved'), 'and no worklist jump');
    console.log('  the unresolved worklist bar counts and hides itself when there is nothing to fix: OK');
  }

  // _teNextUnresolved is the selection half of the jump, kept pure so it can be asserted without a
  // layout engine — the scrolling is best-effort, the CHOICE of token is what can be wrong.
  {
    const C = explorerClient();
    const first = C.run(`JSON.stringify(_teNextUnresolved(${JSON.stringify(ANA.sentences)}, null, null))`);
    assert.deepStrictEqual(JSON.parse(first), { si:0, occ:0, surface:'landschap' },
      'with no previous position it starts at the first unresolved token');
    const next = C.run(`JSON.stringify(_teNextUnresolved(${JSON.stringify(ANA.sentences)}, 0, 0))`);
    assert.strictEqual(JSON.parse(next).surface, 'hek', 'and steps to the next one');
    // Cycling matters: without it a second press sticks on the last token and the worklist has no
    // way back to the start.
    const wrapped = C.run(`JSON.stringify(_teNextUnresolved(${JSON.stringify(ANA.sentences)}, 0, 3))`);
    assert.strictEqual(JSON.parse(wrapped).surface, 'landschap', 'and wraps around rather than sticking on the last');
    assert.strictEqual(C.run(`_teNextUnresolved([{text:'x',tokens:[{surface:'x',lemma:'x'}]}], null, null)`), null,
      'a chapter with nothing unresolved has no next token');
    console.log('  _teNextUnresolved walks the worklist in order and cycles: OK');
  }

  // The popover itself: editable in the live build, and the fields prefilled from the model.
  {
    const C = explorerClient();
    const pop = C.run(`
      var el = { dataset: { surface:'landschap', lemma:'', form:'', sense:'', conf:'unresolved',
                            cid:'tp_te1', si:'0', occ:'0' } };
      _teShowWordPopover({ clientX:10, clientY:10 }, el);
      // ⚠️ Read through the TRACKED reference. An id lookup cannot answer this in lib-dom: it
      // auto-vivifies a fresh div on a miss, so getElementById('te-word-pop') returns an empty
      // element that is not the popover at all, and every assertion below would fail on a correct
      // tree. Same reason index.html tracks the node rather than looking it up.
      (_teWordPopEl && _teWordPopEl.innerHTML) || 'NO-POPOVER';`, 'pop');
    assert.ok(pop.includes('te-edit-lemma') && pop.includes('te-edit-form') && pop.includes('te-edit-sense'),
      'the popover renders all three fields as inputs in the live build');
    assert.ok(pop.includes(UI.en['prov.save']), 'with a Save button (reusing prov.save — no new key)');
    assert.ok(pop.includes(UI.en['dialog.cancel']), 'and a Cancel (reusing dialog.cancel)');
    assert.ok(pop.includes('_teSaveCorrection("tp_te1",0,0,"landschap")'),
      'and Save is wired to the exact correction key this token was rendered with (got: '
        + (pop.match(/_teSaveCorrection\([^)]*\)/) || [''])[0] + ')');
    // ⚠️ The dismiss-on-next-click listener would have closed the editor the instant a curator
    // clicked into a field. This is the assertion for that, at the layer it is observable.
    const guard = C.run(`(_teWordPopEl && _teWordPopEl.getAttribute) ? _teWordPopEl.getAttribute('onclick') : 'NONE'`);
    assert.ok(String(guard).includes('stopPropagation'),
      'and the popover stops click propagation, or clicking into an input would dismiss it (got: ' + guard + ')');
    console.log('  the token popover is an editor in the live build, wired to the right token: OK');
  }

  // Prefill: a `low`-confidence token already has most of the answer, so the boxes must not be empty.
  {
    const C = explorerClient();
    const pop = C.run(`
      var el = { dataset: { surface:'Een', lemma:'een', form:'Artikel', sense:'ein', conf:'high',
                            cid:'tp_te1', si:'0', occ:'0' } };
      _teShowWordPopover({ clientX:10, clientY:10 }, el);
      (_teWordPopEl && _teWordPopEl.innerHTML) || '';`, 'pop2');
    assert.ok(/id="te-edit-lemma"[^>]*value="een"/.test(pop), 'the lemma box is prefilled with the model\'s value');
    assert.ok(/id="te-edit-form"[^>]*value="Artikel"/.test(pop), 'and the form box');
    assert.ok(/id="te-edit-sense"[^>]*value="ein"/.test(pop), 'and the sense box');
    console.log('  the editor prefills the model\'s own values rather than starting blank: OK');
  }

  // ⚠️ The STATIC build has no server to save to and a BAKED analysis: an edit there would appear to
  // work and survive nothing. Asserted by defining STATIC_LESSONS, which is the same test every
  // other write action in index.html uses to tell the two builds apart.
  {
    const C = explorerClient();
    const pop = C.run(`
      STATIC_LESSONS = [];
      var el = { dataset: { surface:'landschap', lemma:'', form:'', sense:'', conf:'unresolved',
                            cid:'tp_te1', si:'0', occ:'0' } };
      _teShowWordPopover({ clientX:10, clientY:10 }, el);
      (_teWordPopEl && _teWordPopEl.innerHTML) || '';`, 'pop-static');
    assert.ok(!pop.includes('te-edit-lemma'), 'the published build renders NO editor');
    assert.ok(pop.includes(UI.en['text_explorer.unresolved']),
      'and falls back to the read-only card, which still explains why the word has no analysis');
    const bar = C.run(`STATIC_LESSONS = []; _teUnresolvedBarHtml('tp_te1', ${JSON.stringify(ANA.sentences)})`);
    assert.strictEqual(bar, '', 'and shows no worklist bar either — there is nothing it could do there');
    console.log('  the published static build stays read-only — no editor, no worklist: OK');
  }

  // ── v88_ae: the per-chapter CURATOR TABLE ─────────────────────────────────────────────────────
  const ORPHAN = { surface:'watertoren', occurrence:0, sentenceText:'Een zin die is herschreven.',
    lemma:'watertoren', form:'Nomen', sense:'Wasserturm' };
  function tableClient(withOrphan){
    const C = explorerClient();
    C.run(`
      _teCacheStore()['tp_te1'].data.orphanedCorrections = ${withOrphan ? JSON.stringify([ORPHAN]) : '[]'};
      APP.lessonData = ${JSON.stringify(TOPIC_NL)};
      _teOpenCuratorTable('tp_te1'); true;`, 'table-open');
    return C;
  }

  // Row building is asserted as a pure function: which rows exist, in what order, and which are
  // orphans is the part that can be wrong, and it does not need a layout engine to check.
  {
    const C = explorerClient();
    const rows = JSON.parse(C.run(`JSON.stringify(_teTableBuildRows({
      sentences: ${JSON.stringify(ANA.sentences)},
      orphanedCorrections: ${JSON.stringify([ORPHAN])} }))`));
    assert.strictEqual(rows.length, 6, 'one row per token (5) plus one per orphan (1)');
    assert.deepStrictEqual(rows.slice(0, 5).map(r => r.surface),
      ['een','landschap','met','een','hek'], 'token rows follow the sentence order');
    assert.deepStrictEqual(rows.slice(0, 5).map(r => r.occ), [0,0,0,1,0],
      'and carry the SAME occurrence index the correction key uses — the second "een" is occ 1');
    assert.deepStrictEqual(rows.filter(r => r.unresolved).map(r => r.surface), ['landschap','hek'],
      'the unresolved rows are the two tokens with no lemma');
    // Orphans LAST and in their own kind: their sentence no longer exists, so they cannot be
    // interleaved with tokens without pretending they still align to one.
    assert.strictEqual(rows[5].kind, 'orphan', 'the orphan is the last row');
    assert.strictEqual(rows[5].si, -1, 'and carries no sentence index, because its sentence is gone');
    assert.strictEqual(rows[5].sentenceText, ORPHAN.sentenceText,
      'but keeps the sentence text it was keyed to, which is what makes it repairable');
    console.log('  the curator table builds one row per token plus a block of orphans: OK');
  }

  // The filter is the worklist. An ORPHAN must survive it — it is the one row kind that cannot be
  // found any other way, and hiding it under "only unresolved" would make it unreachable.
  {
    const C = tableClient(true);
    const all = Number(C.run('_teTableVisible().length'));
    assert.strictEqual(all, 6, 'unfiltered, every row is visible');
    C.run('_teTableToggleFilter(); true;', 'filter-on');
    const filtered = JSON.parse(C.run('JSON.stringify(_teTableVisible().map(r=>r.surface+":"+r.kind))'));
    assert.deepStrictEqual(filtered, ['landschap:token','hek:token','watertoren:orphan'],
      'filtered, the two unresolved tokens AND the orphan remain — the orphan is never filtered away');
    C.run('_teTableToggleFilter(); true;', 'filter-off');
    assert.strictEqual(Number(C.run('_teTableVisible().length')), 6, 'and toggling back restores every row');
    console.log('  the table filter keeps unresolved tokens and always keeps orphans: OK');
  }

  // ⚠️ Saving must send only what CHANGED. A table of 100 tokens saving every row would turn every
  // model-produced value into a "curator correction", mark the whole chapter reviewed, and pin it
  // against future prompt improvements — quietly defeating the point of an overlay.
  {
    const C = tableClient(false);
    assert.strictEqual(Number(C.run('_teTableChanged().length')), 0,
      'an untouched table has nothing to save — opening and closing writes nothing');
    C.run(`_teTableEdit(1,'lemma','landschap'); _teTableEdit(1,'sense','Landschaft'); true;`, 'edit');
    const changed = JSON.parse(C.run('JSON.stringify(_teTableChanged())'));
    assert.strictEqual(changed.length, 1, 'only the edited row is sent');
    assert.strictEqual(changed[0].surface, 'landschap', 'and it is the row that was edited');
    assert.strictEqual(changed[0].occurrence, 0, 'with its occurrence index');
    assert.strictEqual(changed[0].sentenceText, ANA.sentences[0].text,
      'and the sentence text the server keys on');
    assert.strictEqual(changed[0].lemma, 'landschap', 'carrying the edited values');
    assert.strictEqual(changed[0].sense, 'Landschaft');
    // Editing a value BACK to what it was is not a change — otherwise a curator who types and undoes
    // still pins the token.
    C.run(`_teTableEdit(1,'lemma',''); _teTableEdit(1,'sense',''); true;`, 'undo');
    assert.strictEqual(Number(C.run('_teTableChanged().length')), 0,
      'and restoring the original values makes it not a change again');
    console.log('  the table saves only the rows that actually changed: OK');
  }

  // The bar must appear for a chapter whose tokens are all resolved but which HAS orphans — that is
  // precisely the chapter where an orphan would otherwise never be found.
  {
    const C = explorerClient();
    const clean = [{ text:'x.', tokens:[{surface:'x', lemma:'x'}] }];
    // ⚠️ v88_ah CHANGED THIS CLAIM, and the old one is worth stating: it asserted the bar is EMPTY
    // when nothing is unresolved and nothing is orphaned. That was v88_ae's behaviour and it meant a
    // fully-resolved chapter had no way into the curator table at all — the user asked where the
    // table was, and on such a chapter the honest answer was "nowhere". Reviewing a finished-looking
    // chapter, and correcting a confidently WRONG lemma, are exactly what a review interface is for,
    // and neither is reachable from a worklist that only lists unresolved tokens.
    const none = C.run(`_teUnresolvedBarHtml('tp_te1', ${JSON.stringify(clean)}, { orphanedCorrections: [] })`);
    assert.ok(none.includes('_teOpenCuratorTable'),
      'a fully-resolved chapter STILL offers the curator table — it is the only way in (got: ' + none + ')');
    assert.ok(!none.includes('_teJumpUnresolved'),
      'but NOT the worklist jump, which would have nowhere to jump to');

    // Non-vacuity for the one thing that IS still conditional: a chapter with no analysis at all has
    // no bar, because there is nothing to curate.
    const empty = C.run(`_teUnresolvedBarHtml('tp_te1', [], { orphanedCorrections: [] })`);
    assert.strictEqual(empty, '', 'a chapter with no analysed sentences shows no bar at all');

    const withOrph = C.run(`_teUnresolvedBarHtml('tp_te1', ${JSON.stringify(clean)}, { orphanedCorrections: ${JSON.stringify([ORPHAN])} })`);
    assert.ok(withOrph.includes('te-fixbar'), 'an orphan is surfaced in the bar');
    assert.ok(withOrph.includes('1 · ' + UI.en['text_explorer.unresolved']),
      'counted, so a chapter whose only remaining work is an orphan says so (got: '
        + (withOrph.match(/te-fixbtn[^>]*>([^<]*)</) || ['',''])[1] + ')');
    console.log('  the curator table is reachable on any analysed chapter; the jump only when there is work: OK');
  }

  // ── v88_ae: the story-rewrite warning ─────────────────────────────────────────────────────────
  // The claim is about CONTROL FLOW — does the save go ahead — so it is asserted on the boolean the
  // save path branches on, not on pixels.
  {
    const C = explorerClient();
    const setup = (wouldOrphan, pick) => C.run(`
      window.__dialogs = [];
      showChoiceDialog = function(o){ window.__dialogs.push(o); return Promise.resolve(${pick}); };
      fetch = function(u, o){ window.__impactUrl = u; return Promise.resolve({ ok:true, status:200,
        json: function(){ return Promise.resolve({ wouldOrphan: ${wouldOrphan} }); } }); };
      true;`, 'confirm-setup');

    // No corrections at risk: no dialog at all, and the save proceeds.
    setup(0, 1);
    C.run(`window.__res = null; _teConfirmStoryRewrite({id:'tp_te1'}, 'new story').then(function(v){ window.__res = v; }); true;`, 'clean');
    await settle();
    assert.strictEqual(C.run('window.__res'), true, 'a rewrite that orphans nothing proceeds');
    assert.strictEqual(C.run('window.__dialogs.length'), 0,
      'a rewrite that orphans nothing asks nothing — the warning must not fire on every save');

    setup(3, 0);
    C.run(`window.__res = null; _teConfirmStoryRewrite({id:'tp_te1'}, 'new story').then(function(v){ window.__res = v; }); true;`, 'cancel');
    await settle();
    assert.strictEqual(C.run('window.__res'), false, 'choosing Cancel stops the save');
    const dlg = JSON.parse(C.run('JSON.stringify(window.__dialogs[0])'));
    assert.ok(dlg.body.includes('3'), 'and the warning states how many corrections are at risk (got: ' + dlg.body + ')');
    assert.strictEqual(dlg.choices.length, 2, 'two choices');
    assert.ok(!dlg.choices[0].primary && dlg.choices[1].primary,
      'and Cancel is first and NOT primary — the destructive path is not what a reflexive Enter takes');
    assert.ok(String(C.run('window.__impactUrl')).includes('/api/analysis-correction-impact/tp_te1'),
      'the count came from the SERVER dry run, not from a client-side substring guess');

    setup(3, 1);
    C.run(`window.__res = null; _teConfirmStoryRewrite({id:'tp_te1'}, 'new story').then(function(v){ window.__res = v; }); true;`, 'continue');
    await settle();
    assert.strictEqual(C.run('window.__res'), true, 'and choosing Continue lets the save proceed');

    // Fails OPEN: a check that cannot run must never stand between a curator and a story repair.
    C.run(`fetch = function(){ return Promise.reject(new Error('offline')); };
      window.__res = null; _teConfirmStoryRewrite({id:'tp_te1'}, 'x').then(function(v){ window.__res = v; }); true;`, 'fail-open');
    await settle();
    assert.strictEqual(C.run('window.__res'), true, 'a failed impact check proceeds rather than blocking the save');
    console.log('  the story-rewrite warning fires only when corrections are at risk, and fails open: OK');
  }

  console.log('unit-text-explorer: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
