// unit-chapter-icons.test.js
// v80_z — the CHAPTER ICON row on the progress cards.
//
// User request: *"on all progress cards, incl the entry cards: replace the storyboard row by the
// chapter icons (field topicEmoji), in the same size as the lesson type icons above the play
// buttons. And move this new icon row just above the chapter lesson type buttons, and below the
// story and vocab display. Make the icons clickable, such that they lead to this chapters' (if
// unlocked) progress card and questions."*
//
// ⚠️ The storyboard is NOT deleted. `v71_k` built it, `unit-storyboard-frames` guards it, and the
// STORYLINE page still renders it. Only its PLACE on the cards is taken. The element keeps the id
// `*-storyboard`, which is now historical: renaming it would touch 82 client references and 12 test
// ones for a cosmetic gain.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadClient, ROOT } = require('./lib-dom');

const store = JSON.parse(fs.readFileSync(path.join(ROOT, 'lessons.json'), 'utf8'));
const LANGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'languages.json'), 'utf8'));
const UI = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
const SAVED = store.topics.map(t => ({ id: t.id, topic: t.topic, lang: t.lang, srcLang: t.srcLang,
  story: t.story, lessons: t.lessons, topicEmoji: t.topicEmoji }));

const SL = (store.storylines || []).find(s => (s.chapters || []).length >= 3
  && (s.chapters || []).every(c => store.topics.some(t => t.id === c)));
assert.ok(SL, 'the corpus has a 3+ chapter storyline with all chapters present');
const HERE = store.topics.find(t => t.id === SL.chapters[1]);

function card(opts) {
  const o = opts || {};
  const C = loadClient({ quiet: true });
  C.run(`LANGS = ${JSON.stringify(LANGS)}; UI_STRINGS = ${JSON.stringify(UI.en)};
    APP.savedList = ${JSON.stringify(SAVED)};
    APP.storylines = ${JSON.stringify(store.storylines || [])};
    APP.info = { backend:'none', canGenerate:false };
    APP._teacherMode = ${o.teacher ? 'true' : 'false'};
    APP.progress = { completed:{}, solved:{}, chapterDone:${JSON.stringify(o.chapterDone || {})},
                     learned:{}, storyShown:{} };
    APP.lessonData = ${JSON.stringify(HERE)};
    APP.lang = ${JSON.stringify(HERE.lang)}; APP.srcLang = ${JSON.stringify(HERE.srcLang)};
    show = function(id){ APP._shown = id; }; saveProg = function(){};
    loadSaved = function(x){ APP._went = String(x); };
    APP.cur = { lessonIdx:0, exercises:[], cur:0, correct:1, total:1, mistakes:0,
                hearts:3, streak:0, bestStreak:0 };
    // A drill is marked on the LESSON, which showComplete reads as
    // \`APP.lessonData.lessons[C.lessonIdx]\` — not on APP.cur. Setting it on APP.cur looked right
    // and did nothing, which made §6 fail against correct behaviour.
    ${o.drill ? "if (APP.lessonData.lessons && APP.lessonData.lessons[0]) APP.lessonData.lessons[0]._drill = true;" : ''}
    showComplete(); true;`, 'card');
  return C;
}
const rowHtml = C => C.run(`document.getElementById('comp-storyboard').innerHTML`);

// ── 1. One icon per chapter, at the lesson-icon size ─────────────────────
{
  const C = card({});
  const h = rowHtml(C);
  const n = (h.match(/comp-chapter-ico/g) || []).length;
  assert.strictEqual(n, SL.chapters.length,
    `one icon per chapter (${n} vs ${SL.chapters.length})`);
  assert.ok(/font-size:22px/.test(h),
    'at 22px — the same size as the lesson-type icons above the play buttons');
  // The emoji really comes from topicEmoji, not a placeholder.
  const emo = store.topics.find(t => t.id === SL.chapters[0]).topicEmoji;
  assert.ok(emo && h.includes(emo), `the row shows the chapter's own topicEmoji (${emo})`);
  assert.deepStrictEqual(JSON.parse(C.run(`JSON.stringify(_cardErrors())`)), [],
    'and nothing was swallowed rendering it');
  console.log(`  one icon per chapter at lesson-icon size (${n} chapters)`);
}

// ── 2. Position: below story and vocab, above the play buttons ───────────
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = id => html.indexOf('id="' + id + '"');
  assert.ok(at('comp-story-panel') < at('comp-vocab'), 'story precedes vocabulary');
  assert.ok(at('comp-vocab') < at('comp-storyboard'), 'the icon row is BELOW the vocabulary');
  assert.ok(at('comp-storyboard') < at('comp-lessons'),
    'and ABOVE the lesson-type buttons, as requested');
  console.log('  positioned below story+vocab and above the play buttons');
}

// ── 3. ⚠️ The current chapter is marked and is NOT a link ────────────────
// A link to the page you are already on is a dead control.
{
  const C = card({});
  const h = rowHtml(C);
  assert.strictEqual((h.match(/comp-chapter-ico here/g) || []).length, 1,
    'exactly one icon is marked as the current chapter');
  const hereSeg = h.slice(h.indexOf('comp-chapter-ico here'));
  assert.ok(!/onclick/.test(hereSeg.slice(0, hereSeg.indexOf('</span>'))),
    'and it carries no onclick — it is where the learner already is');
  console.log('  the current chapter is marked and inert');
}

// ── 4. A reachable chapter links to it BY ID ────────────────────────────
{
  const C = card({});
  const on = C.run(`(document.querySelector('#comp-storyboard span[data-chapter-id]')||{getAttribute:function(){return '';}}).getAttribute('onclick')`);
  assert.ok(/loadSaved\('tp_/.test(on), 'a reachable chapter opens by id, not by name: ' + on);
  const id = /loadSaved\('([^']+)'\)/.exec(on)[1];
  assert.ok(SL.chapters.includes(id), 'and the id is a chapter of THIS storyline');
  console.log('  reachable chapters link by id');
}

// ── 5. ⚠️ THE DISCRIMINATOR — an unreached chapter is shown but NOT clickable ──
// Without this the rule could be "everything is a link", which would offer routes into chapters the
// learner has not earned. Non-vacuity is asserted both ways: some locked, some not.
{
  const C = card({});
  const h = rowHtml(C);
  const locked = (h.match(/comp-chapter-ico locked/g) || []).length;
  const links = (h.match(/data-chapter-id/g) || []).length;
  assert.ok(locked > 0, 'non-vacuity: with no progress, a later chapter IS locked');
  assert.ok(links > 0, 'non-vacuity: and an earlier one is still reachable');
  const lockSeg = h.slice(h.indexOf('comp-chapter-ico locked'));
  assert.ok(!/onclick/.test(lockSeg.slice(0, lockSeg.indexOf('</span>'))),
    'a locked chapter carries no onclick');
  assert.ok(/opacity:\.35/.test(h), 'and is dimmed rather than hidden — the deck stays legible');
  // Teacher mode sees everything: the same exemption the lesson-icon row makes.
  const T = card({ teacher: true });
  assert.strictEqual((rowHtml(T).match(/comp-chapter-ico locked/g) || []).length, 0,
    'teacher mode unlocks the whole row, as it does the lesson icons');
  console.log(`  unreached chapters are dimmed and inert (${locked} locked, ${links} reachable)`);
}

// ── 6. A drill shows no row ─────────────────────────────────────────────
// A drill is a synthetic set with no chapter of its own, so the row would misrepresent what it
// links to — the same reason `comp-hdr` and the lesson-icon row hide there.
{
  const C = card({ drill: true });
  assert.strictEqual(rowHtml(C), '', 'a drill card renders no chapter row');
  assert.strictEqual(C.run(`document.getElementById('comp-storyboard').style.display`), 'none',
    'and the slot is hidden');
  console.log('  a drill card shows no row');
}

// ── What this does NOT establish (rule 34) ──────────────────────────────
// • The three OTHER card prefixes (sum/us/fin) get the row from `_cardHeader`; only the progress
//   card is rendered here. Their wiring is shared, not separately exercised.
// • No click is dispatched through the DOM — the onclick attribute is read. A device pass is owed,
//   particularly for hit area at 22px.
// • The "a one-chapter deck shows no row" rule (`ids.length < 2`) is NOT exercised: every fixture
//   here is a 3-chapter storyline. Mutation-testing showed it unguarded. Left as a stated gap rather
//   than a claimed one.
console.log('unit-chapter-icons: ALL PASSED');
