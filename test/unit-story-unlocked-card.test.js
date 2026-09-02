// unit-story-unlocked-card.test.js
// v74_l — the story-unlocked card (roadmap §3, from the user's play-test).
//
// The card is the reward for finishing a chapter's preparation, and the one screen whose job is to
// get the learner to READ. Four changes: it says what to do, it stops competing with itself, and
// the story is set as prose rather than as a caption.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI    = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const html  = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ── 1. The story is set as prose, not as a caption ──────────────────────────────────────────
// Pinned in the MARKUP because it is a static style attribute — there is no cascade in the stub
// DOM to read it back from. Italic was the substantive complaint: a long run of italic at 13px
// reads as a caption, and the story is in the TARGET language, often with diacritics or a
// non-Latin script, where italic synthesis is worst.
{
  const m = html.match(/<div id="comp-story-text" style="([^"]*)"/);
  assert.ok(m, 'the completion-card story panel exists');
  assert.ok(!/italic/.test(m[1]), 'the story is NOT italic');
  const size = (m[1].match(/font-size:\s*(\d+)px/) || [])[1];
  assert.ok(size && Number(size) >= 15, `and is at least 15px (found ${size || 'none'})`);
}

// ── 2. The label tells the learner what to do ───────────────────────────────────────────────
// "Stories unlocked!" announced a state; this card's purpose is an instruction.
{
  assert.strictEqual(UI.en['complete.story_unlocked'], 'read and understand the chapter',
    'the story-unlocked label is an instruction');
  assert.strictEqual(UI.en['ex.badge.comprehension'], 'did you get this?',
    'and the comprehension badge asks the learner a question');
  // v71_q: a key dropped for the translate pass to refill must NOT be asserted absent anywhere —
  // that is what broke unit-model-settings. Asserted here as "English present, others pending",
  // which stays true both before and after the pass runs.
  const langs = Object.keys(UI);
  assert.ok(langs.length > 25, 'ui.json still carries the full language set');
  for (const k of ['complete.story_unlocked', 'ex.badge.comprehension']) {
    assert.ok(UI.en[k], `${k} has an English value`);
  }
}

// ── 3. The card stops competing with its own instruction ────────────────────────────────────
function renderCard({ teacher }) {
  const topic = (store.topics || []).find(t =>
    (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden) && t.story);
  assert.ok(topic, 'the corpus has a mixed-driven chapter with a story');
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} };
    APP._teacherMode = ${teacher};
    APP.cur = { lessonIdx:0, exercises:[], cur:0 };
    (function(){
      countedLessons(APP.lessonData).forEach(function(L){
        var i = APP.lessonData.lessons.indexOf(L), prev = APP.cur.lessonIdx;
        APP.cur.lessonIdx = i;
        for (var r = 0; r < 40; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
        APP.cur.lessonIdx = prev;
        var d = APP.progress.completed[APP.lessonData.topic] = APP.progress.completed[APP.lessonData.topic] || {};
        d[L.id] = { done:true, correct:4, total:4 };
      });
    })();
    true;`, 'setup');
  const mi = (topic.lessons || []).findIndex(L => L && L.type === 'mixed' && !L._hidden);
  C.run(`APP.cur = { lessonIdx:${mi}, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                     hearts:3, streak:4, bestStreak:4 };
         showComplete(); true;`, 'render');
  const vis = id => C.run(`(function(){ var e=document.getElementById('${id}');
     return e ? (e.style.display === 'none' ? 'hidden' : 'shown') : 'absent'; })()`, 'v');
  return {
    unlocked: C.run(`storyUnlocked(APP.lessonData)`, 'u'),
    coverageLeft: C.run(`(typeof _firstCoverageShortLessonIdx === 'function') && _firstCoverageShortLessonIdx() >= 0`, 'c'),
    label: C.run(`(function(){ var e=document.getElementById('comp-story-panel-lbl'); return e ? e.textContent : ''; })()`, 'l'),
    topic: topic.topic,
    next: vis('comp-next'), repeat: vis('comp-repeat'),
    drill: vis('comp-drill'), crossword: vis('comp-crossword'),
  };
}
{
  const learner = renderCard({ teacher: false });
  // Non-vacuity: the story must actually be unlocked, or "the card is quiet" is trivially true
  // because there is no story-unlocked card at all.
  assert.strictEqual(learner.unlocked, true, 'the fixture really does unlock the story');
  // RE-ANCHORED (user follow-up, rule 29): the label is no longer an instruction string — it is
  // the chapter's own title (same field #topic-name-big uses), regardless of lock state.
  // `complete.story_unlocked` survives in ui.json (deliberately, per the project's convention of
  // not pruning orphaned translations) but is no longer wired to this element.
  assert.strictEqual(learner.label, learner.topic, 'and the card is captioned with the chapter title');
  assert.strictEqual(learner.next, 'shown', 'Next is offered');
  // v77_l (ruling 1): v74_l's hide-list is RETIRED. It used to hide drill/crossword — and Repeat
  // once coverage was complete — so that four routes back into practice would not argue against a
  // story captioned "read and understand the chapter". §0d removes the PREMISE instead: the
  // actions now sit BELOW the text, so the story leads and nothing competes with it.
  //
  // The old assertions here pinned the hiding. They are replaced by the ruling's own consequences,
  // which are the things that would actually hurt a learner if they broke.
  assert.notStrictEqual(learner.repeat, 'hidden',
    'Replay is ALWAYS available on an unlocked card — it is never hidden by state again (ruling 1)');
  assert.notStrictEqual(learner.drill, 'hidden',
    'and the drill is no longer stripped from the unlocked card');
  // Next is no longer the ONLY route out, which was v74_l's other effect.
  const routes = ['next', 'repeat', 'drill', 'crossword'].filter(k => learner[k] === 'shown');
  assert.ok(routes.length > 1,
    `Next is not the only route out of an unlocked card (offered: ${routes.join(', ') || 'none'})`);

  // A TEACHER sees the story without having passed the gate, so the practice actions still make
  // sense there — the card is a preview, not a reward.
  const teacher = renderCard({ teacher: true });
  assert.strictEqual(teacher.next, 'shown', 'a teacher still gets Next');
  assert.ok(teacher.repeat === 'shown' || teacher.crossword === 'shown',
    'and keeps the practice actions — the stripping applies to the learner reward card only');
}

// ── 4. Repeat survives when it is the only way up ───────────────────────────────────────────
// The story unlocks on the PREP gate, which can be passed while coverage is still short: the
// storyline mark can exceed the lesson one, and replaying re-samples the round. Stranding that
// learner is the failure mode this section exists to prevent — smoke-render's "a finished lesson
// still offers Repeat" case caught it on the first attempt at v74_l.
// v77_l: the two source pins that lived here matched v74_l's hide-list, which ruling 1 has
// retired — there is no longer a list for Repeat to be excluded from. The SAFETY claim underneath
// them is what mattered and it is asserted behaviourally instead: a learner who can still raise
// coverage must be offered the way up. Under ruling 1 that is unconditional, which is stronger
// than the old carve-out, so this cannot regress quietly.
{
  const learner = renderCard({ teacher: false });
  assert.strictEqual(learner.unlocked, true, 'non-vacuity: the story really is unlocked here');
  assert.notStrictEqual(learner.repeat, 'hidden',
    'a learner on an unlocked card is always offered Replay — the only way to raise coverage');
  assert.notStrictEqual(learner.next, 'hidden', 'and a way forward');
}

// ── 5. v74_m: the story keeps its PARAGRAPHS ────────────────────────────────────────────────
// 249 of 299 shipped chapters contain newlines and 217 contain blank lines. HTML collapses both, so
// before this the card presented every story as one undifferentiated slab — on the single screen
// whose whole job is to get the story read. Both other story panels (lesson-set/library, storyline
// chain) have split on blank lines since v39; this one was added later and never did.
{
  const topic = (store.topics || []).find(t =>
    /\n\s*\n/.test(t.story || '') && (t.lessons || []).some(L => L && (L.vocab || []).length));
  assert.ok(topic, 'the corpus has a multi-paragraph story with vocabulary');
  const want = (topic.story || '').split(/\n\s*\n/).length;
  // Non-vacuity: a single-paragraph story would satisfy any implementation, including the old one.
  assert.ok(want >= 2, `the fixture really has multiple paragraphs (${want})`);

  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
  C.run(`
    APP.savedList = []; APP.storylines = [];
    APP.lessonData = ${JSON.stringify(topic)};
    APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
    APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
    APP.progress = { completed:{}, solved:{} }; APP._teacherMode = true;
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                hearts:3, streak:4, bestStreak:4 };
    (function(){
      var i = (APP.lessonData.lessons||[]).findIndex(function(L){ return L && (L.vocab||[]).length; });
      var prev = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
      for (var r = 0; r < 20; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
      APP.cur.lessonIdx = prev;
    })();
    showComplete(); _renderCompStory(true); true;`, 'render');
  const h = C.run(`(function(){ var e=document.getElementById('comp-story-text'); return e ? e.innerHTML : ''; })()`, 'h');
  assert.strictEqual((h.match(/<p dir="auto">/g) || []).length, want,
    `the full story is emitted as ${want} paragraphs, not one slab`);
  // Paragraphs must not have cost the highlighting: the split runs AFTER the highlighter, on HTML,
  // so it must not cut through a <mark>.
  assert.ok((h.match(/<mark/g) || []).length > 0,
    'and the solved-word highlighting survives the split');
  assert.ok(!/<p[^>]*>\s*<\/p>/.test(h), 'with no empty paragraphs from runs of blank lines');
  // The <p>s need a rhythm or they stack flush and read as one block again.
  assert.ok(/#comp-story-text p\{margin/.test(html),
    'and the panel gives its paragraphs spacing, as .story-body has since v39');
  // PARITY with the shared formatter, not merely "some paragraphs": the point is that the three
  // story panels agree. Two hand-written copies of this split is how the card came to be missing it.
  const shared = C.run(`_storyParasHtml(furiHtml(APP.lessonData.story || ''))`, 'shared');
  assert.strictEqual((h.match(/<br>/g) || []).length, (String(shared).match(/<br>/g) || []).length,
    'single newlines become line breaks exactly as the other panels do');
  assert.strictEqual((h.match(/<mark/g) || []).length, (h.match(/<\/mark>/g) || []).length,
    'every mark is closed — the split did not cut through one');
  assert.strictEqual((html.match(/function _storyParasHtml\(/g) || []).length, 1,
    'there is exactly ONE paragraph formatter');
  assert.ok((html.match(/_storyParasHtml\(/g) || []).length >= 4,
    'and every story panel goes through it');
}

// ── 6. v74_n: TWO highlight tiers, and the two story panels agree ───────────────────────────
// The storyline page marked ALL of a chapter's vocabulary; the completion card marked only the
// words the learner had SOLVED. So the same story lit up differently depending on which screen it
// was read from, and a partly-played chapter looked almost unmarked on the card — the user noticed
// exactly this. Both meanings now sit on the page: every vocabulary word is marked (what the
// chapter teaches) and the solved ones are marked more strongly (what you already have).
{
  // ⚠️ The precondition is SELECTED FOR, not hoped for (v87_o). This was `.find(story && >=4 vocab)`,
  // which takes the FIRST such chapter — and the section then asserts that chapter's vocabulary
  // actually APPEARS in its story. Those are different properties: a chapter can teach four words
  // its own story never contains (an uploaded text, a comic panel, a chapter whose vocab was
  // generated from a summary). The corpus is a LIVE snapshot — the user's own server writes to it
  // between runs — so "the first acceptable chapter" silently became one with zero overlap and this
  // section went red on completely correct code. Exactly the lesson v81_d/v81_e already recorded for
  // unit-tap-word: keep a fixture VERIFIED to have the property, not the first that passes a weaker
  // proxy for it.
  // A plain substring scan is NOT a good enough proxy either — tried first, still selected a chapter
  // the renderer marked nothing in, because the real matcher normalises through _hlKey/stripFuri,
  // splits multi-token entries and folds apostrophes. So the fixture is chosen by the PROPERTY
  // ITSELF: render each candidate and keep the first that actually produces marks.
  const render = (rounds, topic) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
      APP.cur = { lessonIdx:0, exercises:[], cur:0 };
      (function(){
        if (!${rounds}) return;
        var i = (APP.lessonData.lessons||[]).findIndex(function(L){ return L && (L.vocab||[]).length; });
        var prev = APP.cur.lessonIdx; APP.cur.lessonIdx = i;
        for (var r = 0; r < ${rounds}; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
        APP.cur.lessonIdx = prev;
      })();
      APP._compStoryLang = 'target'; _renderCompStory(true); true;`, 'render');
    const h = C.run(`(function(){ var e=document.getElementById('comp-story-text'); return e ? e.innerHTML : ''; })()`, 'h');
    // v80_w: the card renders through `_storyBodyHtml` now, so the two-shade `.solved` class was
    // replaced by the TRACK T state classes. The CLAIM below is unchanged — marking does not depend
    // on progress, only the SHADE does — so "strong" is re-read as "not red": a word with any of its
    // questions answered. Matched on the class list rather than an exact attribute, because the
    // marks also carry `wp-tap` and an onclick since v80_t.
    return { total: (h.match(/<mark class="[^"]*story-vocab-hl/g) || []).length,
             strong: (h.match(/<mark class="[^"]*\bwp-(?:partial|green)\b/g) || []).length };
  };
  const candidates = (store.topics || []).filter(t => t.story
    && (t.lessons || []).some(L => L && (L.vocab || []).length >= 4));
  assert.ok(candidates.length, 'the corpus has chapters with a story and several vocabulary words');
  let topic = null, cold = null;
  for (const cand of candidates) {
    const c = render(0, cand);
    if (c.total > 0) { topic = cand; cold = c; break; }
  }
  // Non-vacuity: SOME chapter's vocabulary must appear in its own story, or every count below is
  // zero and the section proves nothing. Now a statement about the corpus as a whole rather than
  // about whichever chapter happens to sort first.
  assert.ok(topic && cold && cold.total > 0,
    `some chapter's vocabulary is actually marked in its own story (scanned ${candidates.length})`);
  const warm = render(40, topic);
  // The KEY property: marking no longer depends on progress — only the SHADE does. This is what
  // makes the card and the storyline page agree.
  assert.strictEqual(warm.total, cold.total,
    'the same words are marked before and after playing — progress changes the shade, not the set');
  assert.strictEqual(cold.strong, 0, 'with nothing solved, nothing is in the strong tier');
  assert.ok(warm.strong > 0, 'and solved words move into it');
  // NOT "entirely strong": only the first vocabulary-bearing lesson is played here, and a chapter
  // may draw story words from several. The claim is that the strong tier GROWS with progress and
  // never exceeds the marked set — asserting totality would pin an accident of the fixture.
  assert.ok(warm.strong <= warm.total, 'the strong tier is a subset of what is marked');
  assert.ok(warm.strong > cold.strong, 'and it grows as words are demonstrated');
  // Both tiers must be visually distinct, or the distinction is invisible and the change pointless.
  assert.ok(/\.story-vocab-hl\{[^}]*background:/.test(html), 'the base tier has a background');
  assert.ok(/\.story-vocab-hl\.solved\{[^}]*background:/.test(html),
    'and the solved tier has a DIFFERENT one');
  const base = (html.match(/\.story-vocab-hl\{([^}]*)\}/) || [])[1] || '';
  const strongCss = (html.match(/\.story-vocab-hl\.solved\{([^}]*)\}/) || [])[1] || '';
  assert.notStrictEqual((base.match(/background:([^;]*)/) || [])[1],
                        (strongCss.match(/background:([^;]*)/) || [])[1],
    'the two shades are not the same colour');
  // The storyline chain panel takes the same two tiers, resolved PER CHAPTER — pooling the solved
  // set across the chain would show a word solved in chapter 1 as solved inside chapter 3.
  assert.ok(/_highlightVocabHtml\(t, allVocab, solved\)/.test(html),
    'the storyline chain body passes a solved subset too');
  assert.ok(/function highlight\(text, isTarget, d\)/.test(html),
    'and resolves it per chapter, not across the chain');
  console.log(`  highlight tiers: ${cold.total} words marked throughout, strong ${cold.strong} -> ${warm.strong} as they are solved`);
}

// ── 7. v74_o: the last card is not a dead end ───────────────────────────────────────────────
// Measured before the fix on the shipped "Paella und Chaos" with both chapters complete:
// `comp-next` disabled=true and `comp-back` display=none — a greyed arrow beside no other
// affordance. v71_h greyed Next so the button row matched every other card and left the header as
// the route onward, but a header link is not an obvious answer to a button that looks like it
// should work. Asserted by CLICKING, not by reading the source: "has an onclick" is exactly the
// vacuous form v73_g's icon-row test fell into.
{
  const byId = Object.fromEntries((store.topics || []).map(t => [t.id, t]));
  // A LATER chapter must be mixed-driven, or case (c) below cannot tell the shared completion rule
  // from the raw done-flags-vs-lessonCount one it replaced.
  // ⚠️ v88_w: the selector gained a THIRD condition — no chapter of this storyline may belong to
  // ANOTHER one. Without it the section failed 3/3 (DETERMINISTIC, so not the documented flakiness —
  // protocol item 1) the moment the user's own server generated a chapter into two decks at once:
  // `tp_…093` sat in both `sl_790942494` (2 chapters) and `sl_143869450` (7). Every case below marks
  // THIS storyline's chapters complete and then lets the card resolve its own deck through
  // `_storylineForTopic()`, which returns the FIRST storyline containing the topic — so "the whole
  // story is finished" was being asked of a deck the test had never touched, and case (a) correctly
  // got "back to the storyline" instead of the finished card.
  //
  // This is the SAME defect and the SAME fix `v88_o` applied to `unit-story-finished`; that release's
  // write-up says a proxy fails in both directions, and this file kept the proxy. Selecting on the
  // property the section actually depends on — the card resolves back to THIS deck — is the fix.
  const _slOwners = id => (store.storylines || []).filter(x => (x.chapters || []).includes(id)).length;
  const sl = (store.storylines || []).find(x => {
    const ts = (x.chapters || []).map(c => byId[c]).filter(Boolean);
    if (ts.length < 2) return false;
    if (!(x.chapters || []).every(c => _slOwners(c) === 1)) return false;
    return ts.slice(1).some(t => (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden));
  });
  assert.ok(sl, 'the corpus has a multi-chapter storyline, owned by no other deck, whose later '
    + 'chapters include a mixed one');
  const topics = (sl.chapters || []).map(c => byId[c]).filter(Boolean);
  const last = topics[topics.length - 1];

  const play = (savedList, standOn, storylines) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = ${JSON.stringify(savedList)};
      APP.storylines = ${JSON.stringify(storylines)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{}, chapterDone:{} };
      APP._teacherMode = false; APP._slScreen = {}; true;`, 'setup');
    for (const t of topics) {
      C.run(`
        APP.lessonData = ${JSON.stringify(t)};
        APP.lang = ${JSON.stringify(t.lang)}; APP.srcLang = ${JSON.stringify(t.srcLang)};
        APP.cur = { lessonIdx:0, exercises:[], cur:0 };
        if (typeof _invalidateQidUniverse === 'function') _invalidateQidUniverse();
        (function(){
          var m = _solvedMap(APP.lessonData.topic);
          countedLessons(APP.lessonData).forEach(function(L){
            _lessonItemUniverse(APP.lessonData.lessons.indexOf(L)).forEach(function(k){ m[k]=1; }); });
          var d = APP.progress.completed[APP.lessonData.topic] = {};
          countedLessons(APP.lessonData).forEach(function(L){ d[L.id] = {done:true, correct:4, total:4}; });
        })();
        setComplete(APP.lessonData); true;`, 'play');
    }
    C.run(`
      APP.lessonData = ${JSON.stringify(standOn)};
      APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                  hearts:3, streak:4, bestStreak:4 };
      APP._navWent = null;
      openStorylineScreen = function(id){ APP._navWent = 'storyline:' + id; };
      // v81_v / PLAN §C5 stage 1: the stranded-learner fallback now calls goLibraryClean(), not
      // goLandingClean() — "home" means the library, a user ruling. Both still show the SAME
      // 'landing' screen today (the split hasn't happened yet), so the stub keeps the string
      // 'landing' — see INTERNALS.md §6b.
      goLibraryClean = function(){ APP._navWent = 'landing'; };
      showComplete(); true;`, 'render');
    return C;
  };

  // (a) End of a storyline → the storyline screen.
  const projected = topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
    lessonCount: (t.lessons || []).filter(L => L && !L._hidden && !L._aiExamples).length,
    lessons: (t.lessons || []).map(L => Object.assign({ id: L.id, type: L.type || 'standard' },
      L._hidden ? { _hidden: true } : {})) }));
  // ⚠️ v88_r: forward SPLIT into two buttons — ▶ plays (whatever the gate chain resolved) and →
  // browses chapters. All three cases below are the chain's TERMINAL branch, the one case ▶ does
  // not take: there is nothing left to play, so ▶ greys and → carries the destination through
  // `_compEndForward`, the same rule the terminal branch itself uses. v74_o's guarantee is what is
  // re-asserted on the new pair: the learner is never left with no live route onward.
  //
  // (a) End of a FINISHED storyline → v77_f: forward leads to the story-finished card, the last
  // page of the §0c walk, rather than handing the learner straight back to the storyline. It goes
  // one page further along the walk first, and that page has its own way out — which is what stops
  // v74_o's dead end coming back.
  const C1 = play(projected, last, store.storylines || []);
  assert.strictEqual(C1.run(`!!document.getElementById('comp-play').disabled`, 'd'), true,
    'with the story finished there is nothing left to PLAY, so ▶ is greyed rather than lying');
  assert.strictEqual(C1.run(`!!document.getElementById('comp-next').disabled`, 'd-'), false,
    'but → is NOT greyed — v74_o: the last card must never be a dead end');
  C1.run(`document.getElementById('comp-next').onclick(); true;`, 'click');
  assert.strictEqual(C1.run(`APP._navWent`, 'w'), null,
    'forward does not leave for the storyline — it opens the story-finished card');
  assert.ok(C1.run(`(document.getElementById('fin-story').innerHTML||'').length`, 'fin') > 0,
    'and that card is populated with the story');
  // The way out. Without this the new card would be exactly the dead end v74_o was written to fix.
  C1.run(`document.getElementById('fin-out').onclick(); true;`, 'out');
  assert.ok(String(C1.run(`APP._navWent`, 'w2') || '').startsWith('storyline:'),
    'and from the finished card the learner still reaches the storyline, not nowhere');

  // (b) A chapter in NO storyline → home (user ruling).
  const C2 = play(projected, last, []);
  assert.strictEqual(C2.run(`!!document.getElementById('comp-next').disabled`, 'd2'), false,
    'a solo chapter also gets a live forward arrow');
  C2.run(`document.getElementById('comp-next').onclick(); true;`, 'click2');
  assert.strictEqual(C2.run(`APP._navWent`, 'w2'), 'landing',
    'and it goes home, because there is no storyline to return to');
  // (c) Standing on an EARLIER chapter with the whole storyline finished. `_nextChapter` used to
  // decide "has work left" with `Object.keys(done).length < ch.lessonCount` — two different
  // populations, because done-flags only ever reach COUNTED lessons while lessonCount counts every
  // non-hidden one. On a mixed-driven chapter they can never meet, so a finished chapter was
  // offered as unfinished for ever and Next dragged the learner back into it.
  const laterMixed = topics.slice(1).some(t => (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden));
  // Non-vacuity: without a later MIXED chapter the raw rule and the shared rule agree here, and
  // this case would pass under the defect. The fixture is chosen above to guarantee one.
  assert.ok(laterMixed, 'a later chapter is mixed-driven, so the two rules genuinely disagree');
  {
    const C3 = play(projected, topics[0], store.storylines || []);
    C3.run(`APP._loadedSaved = null; loadSaved = function(x){ APP._loadedSaved = String(x); }; true;`, 'stub');
    // v88_r: the claim is now carried by ▶ — the button that means "continue the course". Greyed
    // is the correct answer here: every later chapter is finished, so there is no unfinished work
    // for it to offer, which is exactly what the raw done-flags-vs-lessonCount rule got wrong.
    // Asserted by clicking anyway, so a ▶ that were somehow live could still be caught reloading.
    assert.strictEqual(C3.run(`!!document.getElementById('comp-play').disabled`, 'd3'), true,
      'a FINISHED later chapter gives ▶ nothing to offer, so it greys');
    C3.run(`var p=document.getElementById('comp-play'); if(typeof p.onclick==='function') p.onclick(); true;`, 'click3');
    assert.strictEqual(C3.run(`APP._loadedSaved`, 'ls') || null, null,
      'a FINISHED later chapter is not offered as unfinished — ▶ does not reload it');
    // …while → is a live BROWSE step to the adjacent chapter. That is deliberate and is the whole
    // point of v88_r: browsing ignores completion, the pedagogy lives on ▶. The learner is
    // therefore still not dead-ended, which is v74_o's guarantee.
    assert.strictEqual(C3.run(`!!document.getElementById('comp-next').disabled`, 'd3n'), false,
      'while → stays live: browsing to the next chapter never depends on finishing this one');
  }
  console.log('  last card: a finished story opens the story-finished card; finished chapters are not re-offered');
}

// ── 8. v74_p: the vocabulary panel shows the CHAPTER, not the round ─────────────────────────
// It listed the lesson's own words, or — on a mixed round — whichever words that round happened to
// draw, so it changed on every replay and never showed what the learner had accumulated. It now
// draws from `_solvedTargetWords`: the SAME set v74_n marks in the strong tier inside the story
// directly above it, so the chips and the highlighting cannot disagree about what you can read.
{
  // v79_e: this used to take the FIRST chapter that had a mixed lesson and any vocabulary at all.
  // On the August data drop that became `tp_17865784443240000119`, whose single vocabulary lesson
  // carries EIGHT words — few enough that one round already solves all of them. The section's
  // "a shorter play solves fewer words" step then compared 8 with 8 and failed, on a chapter the
  // product handled correctly. The test was measuring the corpus, not the code (the second time a
  // selector like this has picked an unsuitable chapter on new data — see unit-replay-focus §8c).
  //
  // The claim needs a chapter a single round CANNOT exhaust, so that is now the selection
  // criterion, stated rather than hoped for. `_solvedTargetWords` counts the chapter's whole
  // vocabulary, so the threshold is on the chapter total.
  const VOCAB_MIN = 20;
  const _vocabCount = t => (t.lessons || []).reduce((n, L) => n + ((L && L.vocab || []).length), 0);
  const topic = (store.topics || []).find(t => (t.lessons || []).some(L => L && L.type === 'mixed' && !L._hidden)
    && _vocabCount(t) >= VOCAB_MIN);
  assert.ok(topic, `the corpus has a mixed-driven chapter with at least ${VOCAB_MIN} words — without `
    + 'one, a single round exhausts the chapter and the replay step below cannot be measured');
  const mixedIdx = (topic.lessons || []).findIndex(L => L && L.type === 'mixed' && !L._hidden);
  const render = (rounds, standOn) => {
    const C = loadClient({ quiet: true });
    C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)}; true;`, 'seed');
    C.run(`
      APP.savedList = []; APP.storylines = [];
      APP.lessonData = ${JSON.stringify(topic)};
      APP.lang = ${JSON.stringify(topic.lang)}; APP.srcLang = ${JSON.stringify(topic.srcLang)};
      APP.info = { backend:'none', canGenerate:false, coverageThreshold:0.8 };
      APP.progress = { completed:{}, solved:{} }; APP._teacherMode = false;
      APP.cur = { lessonIdx:0, exercises:[], cur:0 };
      (function(){
        countedLessons(APP.lessonData).forEach(function(L){
          var i = APP.lessonData.lessons.indexOf(L), prev = APP.cur.lessonIdx;
          APP.cur.lessonIdx = i;
          for (var r = 0; r < ${rounds}; r++) { try { buildExercises(i).forEach(function(ex){ markSolved(ex); }); } catch(e) {} }
          APP.cur.lessonIdx = prev;
        });
      })();
      APP.cur = { lessonIdx:${standOn == null ? mixedIdx : standOn}, exercises:[], cur:0, correct:4, total:4, mistakes:0,
                  hearts:3, streak:4, bestStreak:4 };
      showComplete(); true;`, 'render');
    return {
      chips: C.run(`(function(){ var e=document.getElementById('comp-vocab');
        return e ? (e.innerHTML.match(/vocab-chip/g) || []).length : 0; })()`, 'c'),
      label: C.run(`(function(){ var e=document.getElementById('words-from-lbl'); return e ? e.textContent : ''; })()`, 'l'),
      solved: C.run(`_solvedTargetWords(APP.lessonData).length`, 's'),
      // v80_y: the list is now the COMPLEMENT of the highlighted text — only solved words the story
      // does NOT contain, plus the probe-bearing sources. Computed here the same way the card does.
      listed: C.run(`(function(){
        var d = APP.lessonData, low = String(d.story||'').toLowerCase();
        return _solvedTargetWords(d).concat(_solvedExtraWords(d))
          .filter(function(w){ return low.indexOf(String(w).toLowerCase()) < 0; })
          .filter(function(w,i,a){ return a.indexOf(w) === i; }).length;
      })()`, 'n'),
      roundWords: C.run(`(APP.cur.exercises || []).length`, 'r'),
    };
  };
  const warm = render(40);
  // Non-vacuity: the chapter must have solved vocabulary, or "chips == solved" is 0 == 0.
  assert.ok(warm.solved > 1, `the chapter really does have solved vocabulary (${warm.solved})`);
  // ⚠️ CLAIM CHANGED at v80_y (user ruling), not merely re-pinned. The list used to mirror the
  // highlighted text — the same words said twice, once with red/green state and once without. It is
  // now the COMPLEMENT: what this chapter teaches that the story does NOT show you. So the count is
  // the solved words ABSENT from the story, not all solved words.
  assert.strictEqual(warm.chips, warm.listed,
    'the panel shows one chip per solved word the story does NOT contain');
  // ⚠️ The real fixture does NOT exercise the filter — none of its solved words appears in its
  // story, so `listed === solved` and the equality above would hold with no filter at all. Rather
  // than assert a non-vacuity that cannot fire, the rule is tested on a case built to trip it.
  {
    const C2 = loadClient({ quiet: true });
    C2.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
      APP.lessonData = { topic:'T', lang:'fr', srcLang:'de',
        story:'Le chat dort ici.',
        lessons:[{ id:'L1', vocab:[{target:'chat',source:'Katze'},{target:'oiseau',source:'Vogel'}] }] };
      APP.progress = { completed:{}, solved:{}, chapterDone:{}, learned:{}, storyShown:{} };
      _solvedTargetWords = function(){ return ['chat','oiseau']; };   // both solved
      _solvedExtraWords  = function(){ return []; };
      true;`, 'synthetic');
    const kept = JSON.parse(C2.run(`(function(){
      var d = APP.lessonData, low = String(d.story||'').toLowerCase();
      return JSON.stringify(_solvedTargetWords(d).concat(_solvedExtraWords(d))
        .filter(function(w){ return low.indexOf(String(w).toLowerCase()) < 0; }));
    })()`));
    assert.deepStrictEqual(kept, ['oiseau'],
      'a solved word that APPEARS in the story is left to the highlighting; one that does not is ' +
      'listed — the filter, on a case that actually trips it');
  }
  assert.strictEqual(warm.label, 'Words you can read in this chapter',
    'and says so, rather than "Words from this lesson"');
  // Fewer solved → fewer chips. The old per-lesson list did not move with progress at all.
  const cool = render(1);
  assert.ok(cool.solved < warm.solved, 'a shorter play solves fewer words');
  // v80_y: tracked against the LISTED count (solved minus what the story already shows), for the
  // same reason as the warm case above.
  assert.strictEqual(cool.chips, cool.listed, 'and the panel tracks that, chip for chip');
  // With nothing solved the per-lesson fallback remains — a learner should not face an empty box.
  // Checked on a STANDARD lesson: a mixed round with nothing played has no words of its own to fall
  // back to either (its branch lists what the round drew, and nothing was drawn), which was true
  // before v74_p as well and is not this change's to fix.
  const vocabIdx = (topic.lessons || []).findIndex(L => L && (L.vocab || []).length);
  assert.ok(vocabIdx >= 0, 'the chapter has a lesson carrying its own vocabulary');
  const cold = render(0, vocabIdx);
  assert.strictEqual(cold.solved, 0, 'nothing solved yet');
  assert.ok(cold.chips > 0, 'the panel falls back to the lesson\'s own words rather than showing nothing');
  assert.strictEqual(cold.label, 'Words from this lesson', 'and labels itself accordingly');
  // Wrapping: a chip may now hold a whole-chapter phrase plus its gloss.
  // Asserted as the DECLARATION that is now in force, not as the absence of the old one: the rule
  // carries a comment naming `white-space:nowrap` as what it replaced, and a negative match on the
  // string finds the comment. A guard that reads its own explanation is a guard that lies.
  assert.ok(/\.vocab-chip\{[\s\S]*?white-space:normal/.test(html),
    'chips wrap — a whole-chapter phrase plus its gloss no longer pushes past the panel edge');
  assert.ok(/\.vocab-chip\{[\s\S]*?max-width:100%/.test(html), 'and are capped at the panel width');
  console.log(`  vocabulary panel: ${warm.chips} chapter-wide chips, tracking the solved set`);
}

console.log('  story-unlocked card: instruction label, prose story, Next-only for learners, Repeat kept while coverage remains');
console.log('  story paragraphs: preserved, highlighting intact, spacing applied');
console.log('unit-story-unlocked-card: ALL PASSED');
