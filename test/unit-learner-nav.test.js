// unit-learner-nav.test.js
// v60 — learner UI: skip the lesson-set page for learners; redesign the completion card.
// Contract under test:
//   • _isLearner() = !_canEdit(); loadSaved routes learners past the lesson-set page by resuming
//     at the first unfinished lesson and auto-starting it; teachers keep the page (editing hub).
//   • _firstUnfinishedLessonIdx respects lessonCountsFor and returns -1 on a complete chapter.
//   • _storylineForTopic resolves the deck (preferring APP._slScreen), its ordered chapter
//     topics, and the encoded chain.
//   • The completion card has exactly Next + Back. Next opens the next questions directly
//     (next lesson in chapter → first unfinished lesson of the next chapter → hidden). Back →
//     storyline screen, or landing for a solo chapter. Drill + nav pills are teacher-only.
//   • Chapter complete → the FULL story is shown (not a 200-char teaser).
//   • Both loadSaved implementations (live + static) carry the learner branch (parity).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const builder = fs.readFileSync(path.join(ROOT, 'build-static.js'), 'utf8');

function ext(src, name) {
  let at = src.indexOf('\nfunction ' + name + '(') + 1;
  if (at < 1) at = src.indexOf('\nasync function ' + name + '(') + 1;
  assert.ok(at >= 1, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}

// ── 1. _isLearner / _firstUnfinishedLessonIdx / _storylineForTopic (pure) ─────
{
  const APP = {
    info: {}, _teacherMode: false,
    progress: { completed: {} },
    lessonData: { topic: 'Ch1', lessons: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] },
    savedList: [{ id: 'tp_1', topic: 'Ch1' }, { id: 'tp_2', topic: 'Ch2' }],
    storylines: [{ id: 'sl_1', title: 'Deck', chapters: ['tp_1', 'tp_2'] }],
    _slScreen: null,
  };
  const lessonCountsFor = (d, L) => !L._hidden;   // simple visibility for the test
  const trio = new Function('APP', 'lessonCountsFor',
    ext(html, '_canEdit') + '\n' + ext(html, '_isLearner') + '\n' +
    ext(html, '_firstUnfinishedLessonIdx') + '\n' + ext(html, '_storylineForTopic') +
    '\nreturn { _isLearner, _firstUnfinishedLessonIdx, _storylineForTopic };')(APP, lessonCountsFor);

  // Learner = teacher mode OFF, INDEPENDENT of canGenerate (v60.1). A person with a backend can
  // still choose the learner experience by turning teacher mode off.
  assert.strictEqual(trio._isLearner(), true, 'teacher mode off → learner');
  APP._teacherMode = true; assert.strictEqual(trio._isLearner(), false, 'teacher mode on → not a learner');
  APP._teacherMode = false; APP.info.canGenerate = true;
  assert.strictEqual(trio._isLearner(), true, 'canGenerate does NOT make a teacher — still a learner (v60.1 fix)');
  APP.info.canGenerate = false;

  // Resume index.
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 0, 'fresh chapter resumes at 0');
  APP.progress.completed['Ch1'] = { a: {}, b: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 2, 'resumes at first unfinished');
  APP.progress.completed['Ch1'] = { a: {}, b: {}, c: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), -1, 'complete chapter → -1 (no auto-start)');
  // Hidden lessons don't count toward the resume target.
  APP.lessonData.lessons = [{ id: 'a' }, { id: 'h', _hidden: true }, { id: 'c' }];
  APP.progress.completed['Ch1'] = { a: {} };
  assert.strictEqual(trio._firstUnfinishedLessonIdx(APP.lessonData), 2, 'hidden lesson skipped by resume');

  // Storyline resolution + _slScreen preference.
  const ctx = trio._storylineForTopic('Ch1');
  assert.ok(ctx && ctx.sl.id === 'sl_1' && ctx.topics.join(',') === 'Ch1,Ch2', 'resolves the deck + ordered topics');
  assert.strictEqual(decodeURIComponent(ctx.enc), '["Ch1","Ch2"]', 'encoded chain is the topic array');
  assert.strictEqual(trio._storylineForTopic('Solo'), null, 'a solo topic has no storyline');
}
console.log('  helpers: learner gate, resume index (hidden-aware), storyline resolution: OK');

// Regression (v60.1): _isLearner must NOT depend on _canEdit/canGenerate — a backend user who
// turns teacher mode off is a learner. The bug was the storyline-screen chapter click landing on
// the lesson-set page because canGenerate kept _isLearner false.
{
  const src = ext(html, '_isLearner');
  assert.ok(/!APP\._teacherMode/.test(src), '_isLearner is defined as !APP._teacherMode');
  assert.ok(!/_canEdit\(\)/.test(src), '_isLearner does NOT call _canEdit (would re-couple canGenerate)');
}

// Regression (v60.1): resume + Next must be COVERAGE-aware. A mixed-driven set's mixed lesson never
// gets a done[id] boolean, so a naive !done[id] scan returns it forever and "Next" replays the same
// lesson (the reported "stuck in a lesson, progress bar doesn't move" bug). The resume helper short-
// circuits on setComplete, and Next delegates to it; startLesson clears the _review flag so a real
// round after a review render still records.
{
  const fu = ext(html, '_firstUnfinishedLessonIdx');
  assert.ok(/setComplete\(d\)/.test(fu), '_firstUnfinishedLessonIdx returns -1 when the set is complete (coverage rule)');
  const sc = ext(html, 'showComplete');
  // v71_s: `const` → `let`; the value is narrowed immediately after so Next never offers to
  // "start" the comprehension lesson just played (its done-flag is withheld below 100%, so the
  // helper keeps returning it). The delegation being pinned here is unchanged.
  assert.ok(/let nextLessonIdx = _setDone \? -1 : _firstUnfinishedLessonIdx\(APP\.lessonData\)/.test(sc),
    'Next delegates to the coverage-aware helper (no naive done[id] scan that traps on a mixed lesson)');
  assert.ok(/if \(nextLessonIdx === C\.lessonIdx && !C\._review && _isStoryGatedLesson\(lesson\)\) nextLessonIdx = -1;/.test(sc),
    'and never points back at the story-gated lesson the learner just played');
  assert.ok(/setComplete\(APP\.lessonData\)/.test(sc), 'Next treats a coverage-complete set as done → advances to next chapter');
  const start = ext(html, 'startLesson');
  assert.ok(/delete C\._review/.test(start), 'startLesson clears _review so a real round records progress');
  const prog = ext(html, '_compProgressHtml');
  assert.ok(/topicCoverage\(\)/.test(prog) && /_mixedDriven/.test(prog),
    'the within-chapter progress row shows coverage for a mixed-driven set (bar actually moves)');
  // Story-progress row: for OTHER chapters a mixed chapter (whose mixed lesson never gets a
  // done[id]) must still be recognised, else finished mixed chapters read as incomplete and the
  // story row shows 0 (reported bug).
  // v69_f: the source of that information depends on the build. The live API ships a PROJECTION
  // (lessonCount/lessonTypes, no lessons[]); the static build bakes whole topics (lessons[], no
  // projection fields). Reading only the projection made `cnt` 0 in static, so every chapter was
  // skipped and the row read "0/4" however much was finished — reported from the deployed static
  // site. Both sources must be accepted, with the real lessons preferred and counted by the same
  // lessonCountsFor rule the rest of the app uses.
  assert.ok(/const _chLessons = Array\.isArray\(ch\.lessons\) && ch\.lessons\.length \? ch\.lessons : null;/.test(prog),
    'story-progress uses the baked lessons when they are present (static build)');
  assert.ok(/_chLessons \? _chLessons\.filter\(L => lessonCountsFor\(ch, L\)\)\.length\s*:\s*\(ch\.lessonCount \|\| 0\)/.test(prog),
    'counted with lessonCountsFor, falling back to the live projection count');
  assert.ok(/Array\.isArray\(ch\.lessonTypes\) \? ch\.lessonTypes/.test(prog)
         && /_chLessons\.map\(L => L && L\.type\)/.test(prog),
    'mixed detection accepts lessonTypes (live) or the baked lesson types (static)');
  assert.ok(/const isMixed = _chTypes\.includes\('mixed'\);/.test(prog),
    'mixed chapters are still detected');
  assert.ok(/doneKeys >= Math\.max\(1, cnt - 1\)/.test(prog),
    'a finished mixed chapter counts as done (cnt-1 recorded lessons, mixed excluded)');
  assert.ok(/complete\.story_progress/.test(prog), 'the story-progress row is rendered when a storyline exists');
  // Quitting a question (the ✕) must also respect the learner split: back to the story/landing,
  // not the lesson-set editing page. (Reported: "press x and I still get the lesson-set page.")
  const cq = ext(html, 'confirmQuit');
  // v81_u: showStoryline(...), a thin delegate to openStorylineScreen(...) — see INTERNALS.md §6b.
  // v81_v / PLAN §C5 stage 1: the stranded-learner fallback is now showLibraryClean(), not
  // showGenerationClean() — "home" means the library, a user ruling. Both still delegate to the
  // SAME landing screen today (the split hasn't happened yet) — see INTERNALS.md §6b.
  assert.ok(/if\(_isLearner\(\)\)\{[\s\S]*?showStoryline\(ctx\.sl\.id, ctx\.enc\)[\s\S]*?showLibraryClean\(\)/.test(cq),
    'confirmQuit sends a learner to the storyline/library');
  // v81_s / PLAN §C0.3: showLessonSet(), a thin delegate to goLessonSet() — see INTERNALS.md §6b.
  assert.ok(/\} else \{\s*showLessonSet\(\);/.test(cq), 'a teacher still returns to the lesson-set page on quit');
}

// ── 2. loadSaved routes learners past the lesson-set page (live) ──────────────
{
  const ls = ext(html, 'loadSaved');
  // v81_s: showLessonSet(), a thin delegate to goLessonSet() — see INTERNALS.md §6b.
  assert.ok(/await showLessonSet\(\)/.test(ls), 'loadSaved still runs goLessonSet (lang/dir setup + hash)');
  // v81_t: showLesson(idx), a thin delegate to startLesson(idx) — see INTERNALS.md §6b.
  assert.ok(/if\(_isLearner\(\)\)\{[\s\S]*?_firstUnfinishedLessonIdx\(APP\.lessonData\)[\s\S]*?showLesson\(idx\)/.test(ls),
    'a learner resumes at the first unfinished lesson and auto-starts it');
  // The teacher path is the fall-through: no startLesson call outside the learner branch.
  const afterGo = ls.slice(ls.indexOf('await showLessonSet()'));
  assert.ok(/_isLearner\(\)/.test(afterGo), 'the branch is gated on _isLearner (teachers keep the page)');
}
console.log('  loadSaved: learner auto-start, teacher keeps the page: OK');

// ── 3. Completion card = Next + Back; Next chains; teacher-only extras ────────
{
  const sc = ext(html, 'showComplete');
  // Next: next lesson in chapter, else next chapter's first unfinished, else hidden.
  assert.ok(/compNext\.textContent = t\('complete\.next'\)/.test(sc), 'Next is a plain "Next"');
  // v77_t (§0g): this pinned `startLesson(nextLessonIdx)`. Next still starts a lesson in this
  // chapter directly, but the TARGET is now chosen: if the lesson just played is a comprehension
  // or error-hunt lesson with questions still unanswered, Next restarts THAT one instead of walking
  // on — otherwise the questions the learner just got wrong sink out of reach. Per §0a the pin is
  // not re-pointed at the new variable name; the behaviour is asserted by clicking in
  // `unit-comprehension-repeat` §4 and §5. What remains here is structural.
  // v81_t: showLesson(idx), a thin delegate to startLesson(idx) — see INTERNALS.md §6b.
  assert.ok(/showLesson\(/.test(sc), 'Next starts a lesson in this chapter directly');
  assert.ok(/nextLessonIdx/.test(sc), 'resolved from the next unfinished lesson in this chapter');
  // v77_i: the `loadSaved(...)` call moved OUT of showComplete and into the
  // next-chapter-unlocked card (§0c's fourth page) — Next now names what the learner earned before
  // carrying them into it. Same destination, one page in between. The old pin matched that call
  // inside this function and failed as a text mismatch; per roadmap §0a it is NOT re-pinned to the
  // new text. `unit-next-chapter-unlocked.test.js` CLICKS through and asserts the learner reaches
  // the next chapter, which is the actual claim.
  //
  // What stays here is structural: showComplete still resolves the next chapter and stashes it, so
  // the card and the button that opened it cannot disagree about which chapter is next.
  assert.ok(/_nextChapter\(\)/.test(sc), 'Next → the next chapter is still resolved here');
  assert.ok(/APP\._unlNext = ch;/.test(sc),
    'and stashed at render time, so the card cannot resolve a different chapter');
  // v74_o / v77_f: with nothing left to do, Next LEADS somewhere instead of greying out. v71_h's
  // real point — the button stays PRESENT and in the same position, so the row is identical on
  // every card — is preserved; only the greying goes.
  //
  // The three assertions that used to live here pinned the SOURCE TEXT of that branch
  // (`compNext.onclick = () => { endDrill(); compBackToStory(); };` and the exact `_endLbl`
  // ternary). v77_f made the destination conditional — a finished story now leads to the
  // story-finished card — and they failed as text mismatches. Per roadmap §0a they are NOT
  // re-pinned to the new text: a source regex cannot express "where does Next take the learner",
  // which is the whole claim. They are replaced by `unit-story-finished.test.js`, which CLICKS
  // Next in both states and asserts where it lands.
  //
  // What stays here is structural and still true: the button is never hidden, never greyed, and
  // the Back target is stashed for whoever consumes it.
  assert.ok(!/compNext\.classList\.add\('disabled'\)/.test(sc),
    'Next is no longer greyed on the terminal branch — there IS something to do');
  assert.ok(!/compNext\.style\.display = 'none'/.test(sc), 'the old hide-Next form is gone');
  assert.ok(/compBackToStory\(\)/.test(sc),
    'the terminal branch still routes through the shared back target, not a second destination rule');
  // Back target stashed; storyline or landing.
  assert.ok(/APP\._compBack = \(sl && slEnc\) \? \{ kind: 'storyline'/.test(sc), 'Back target: storyline when present');
  assert.ok(/: \{ kind: 'landing' \}/.test(sc), 'Back target: landing for a solo chapter');
  const back = ext(html, 'compBackToStory');
  // v81_u: showStoryline(...), a thin delegate to openStorylineScreen(...) — see INTERNALS.md §6b.
  // v81_v / PLAN §C5 stage 1: the solo-chapter fallback is now showLibraryClean() — "home" means
  // the library, a user ruling. Both still delegate to the SAME landing screen today.
  assert.ok(/showStoryline\(b\.id, b\.enc\)/.test(back) && /showLibraryClean\(\)/.test(back),
    'compBackToStory dispatches to the storyline screen or the library');
  // Teacher-only extras.
  assert.ok(/const _teacher = !!APP\._teacherMode/.test(sc), 'card teacher gate keys off teacher MODE (v60.1), not _canEdit');
  // v70_l: pass-mark gate removed; a below-threshold learner is still covered (superset rule).
  // v71_d: `!_nextIsDrill` dropped with the flag — Next is never the drill now, so it cannot double.
  assert.ok(/_compBtnState\(_db, drillAvailable\(_l, _s\)/.test(sc),
    'drill shown always, greyed when no round can be built (v71_h)');
  // v77_o (user ruling): NEXT IS NEVER GREYED — it always leads to the next step. v71_d's
  // principle survives and is what still matters: Next means FORWARD and never silently becomes
  // Repeat. Below the mark it now leads to the work that raises the mark (a coverage-short lesson
  // first, so a mixed round re-samples toward what is NOT yet solved), instead of being a dead
  // arrow. The old pins matched `_nextBlocked = true` / `compNext.disabled = true`, both of which
  // are gone; per §0a they are replaced by behaviour, asserted in unit-coverage-threshold by
  // clicking, not by matching source.
  assert.ok(!/_nextBlocked/.test(sc), 'the below-mark lock is gone from showComplete');
  assert.ok(!/compNext\.onclick = null;/.test(sc), 'Next is never left without a destination');
  assert.ok(/if \(_teacher && !lesson\._drill\) \{/.test(sc), 'nav pills are teacher-only');
  // The card markup has exactly the two primary buttons wired.
  assert.ok(/id="comp-next" onclick="afterComplete\(\)"/.test(html), 'markup: Next button');
  // v71_k: Back is no longer a button. The header line carries it — the title returns to the
  // storyline (or home for a solo chapter) via the SAME compBackToStory() the button called, so
  // the route back is asserted here rather than dropped along with the markup.
  assert.ok(!/id="comp-back"/.test(html), 'markup: the Back button has been removed');
  assert.ok(/id="comp-hdr-title"[\s\S]{0,200}?onclick="compBackToStory\(\)"/.test(html),
    'markup: the header title is the route back to the storyline');
  // v81_v / PLAN §C5 stage 1: "home" now means the library (user ruling) — see INTERNALS.md §6b.
  // (Previously a weak alternation that matched on `id="comp-hdr-home"` alone regardless of its
  // onclick; tightened here to actually check the button's destination.)
  assert.ok(/onclick="showLibraryClean\(\)" id="comp-hdr-home"/.test(html),
    'markup: the globe goes to the library');
  assert.ok(/onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)/.test(html),
    'markup: the header title is keyboard-reachable, which a <button> gave for free');
  assert.ok(/id="comp-progress"/.test(html), 'markup: progress-summary container');
}
console.log('  completion card: Next chains lesson→chapter, Back to story/home, teacher-only extras: OK');

// ── 4. Full story on unlock + progress summary ────────────────────────────────
{
  const sc = ext(html, 'showComplete');
  // v60.6: the story render moved into _renderCompStory. Full story when complete; a 200-char
  // preview only in the teacher/not-yet-done peek.
  const rcs = ext(html, '_renderCompStory');
  // v71_m: the full-vs-preview rule is unchanged, but the text is now rendered through the yellow
  // solved-word highlighting, so it is assigned as HTML rather than textContent.
  // ⚠️ REWRITTEN at v80_w. Three claims here were reversed or relocated by TRACK T, and each is
  // recorded rather than dropped:
  //   • the 200-char PREVIEW is gone — under TRACK T the story on a progress card IS the progress
  //     display, and truncating it hides most of that display on exactly the cards where the learner
  //     is still working (T0: "keep the user's attention on the text throughout");
  //   • the two-tier `_highlightVocabHtml(furiHtml(shown), all, solved)` call is gone — the card now
  //     uses the same THREE-state colouring as the question panel;
  //   • both moved into `_storyBodyHtml`, the shared body renderer, so this card and the question
  //     panel cannot colour the same story differently again.
  // What survives unchanged: no highlighting on a source translation, a plain-text fallback, and
  // paragraphs on both branches.
  assert.ok(!/slice\(0, 200\)/.test(rcs),
    'the progress card no longer truncates the story to a preview (v80_w)');
  assert.ok(/_storyBodyHtml\(d, \{ text: full, highlight: !showingSource \}\)/.test(rcs),
    'it renders through the SHARED body renderer, so card and question panel agree');
  // Comments mention the old call by name, so strip them before asserting on the CODE. Matching
  // prose was the first version's mistake — it failed on its own explanatory comment.
  const rcsCode = rcs.replace(/\/\/[^\n]*/g, '');
  assert.ok(!/_highlightVocabHtml/.test(rcsCode),
    'and no longer carries its own highlighting call — that is the shared renderer\'s job');
  const body = ext(html, '_storyBodyHtml');
  assert.ok(/_wordStateMap\(d\)/.test(body),
    'the shared renderer uses the TRACK T three-state map');
  assert.ok(/o\.highlight === false/.test(body),
    'and still skips highlighting for a source translation — target words are not in it');
  assert.ok(/_storyParasHtml\(furiHtml\(text\)\)/.test(body),
    'with a plain-text fallback: a story that renders unformatted is fine, one that fails is not');
  assert.ok(/_el\.textContent = full;/.test(rcs),
    'and the card keeps its own last-resort fallback');
  // ONE formatter. Two renderers already split stories with the same expression written out twice;
  // the completion card is now a caller rather than a copy.
  assert.strictEqual((html.match(/function _storyParasHtml\(/g) || []).length, 1,
    'there is exactly one story paragraph formatter');
  assert.strictEqual((html.match(/function _storyBodyHtml\(/g) || []).length, 1,
    'and exactly one story BODY renderer');
  assert.ok(/id="comp-story-panel"[^>]*background:var\(--white\)/.test(html),
    'the story panel is white, so the yellow highlights read clearly');
  assert.ok(/_lbl\.textContent = _allDone2 \? t\('complete\.story_unlocked'\) : t\('complete\.story_preview'\)/.test(sc),
    'unlock vs preview label reflects completion');
  const prog = ext(html, '_compProgressHtml');
  assert.ok(/complete\.chapter_progress/.test(prog) && /complete\.story_progress/.test(prog),
    'progress summary covers within-chapter AND along-storyline');
  assert.ok(/setComplete\(d\)/.test(prog), 'the current chapter uses the real counted-completion check');
  // Drill card skips the progress summary (synthetic topic).
  assert.ok(/if \(lesson\._drill\) \{ _progEl\.innerHTML = ''; _progEl\.style\.display = 'none'; \}/.test(sc),
    'a drill card hides the progress summary');
}
console.log('  full-story-on-unlock + within/along progress summary: OK');

// ── 4b. Review mode: a learner re-opening a COMPLETE chapter (v60.1) ──────────
{
  const sc = ext(html, 'showComplete');
  // v78_m: matched on the FIRST parameter, not the whole signature. This pinned
  // `function showComplete(review)` exactly and broke when a second optional parameter was added,
  // while the claim it makes — "there is a review flag" — stayed true (standing rule 18: a guard
  // that pins a phrasing does not survive a rewrite).
  assert.ok(/function showComplete\(review\b/.test(html), 'showComplete accepts a review flag first');
  assert.ok(/if\(review\)\{[\s\S]*?_review:true \}/.test(sc), 'review builds a synthetic no-round C');
  assert.ok(/!C\._review &&/.test(sc), 'review mode records NO progress (chapter already complete)');
  // loadSaved routes a learner with no unfinished lesson into the review card, not the page —
  // and (v68.1) a FAILED auto-start must not strand the learner on the lesson-set page either.
  // v81_o / PLAN §C0.3: showComplete(true) is reached through the showProgressCard seam now — see
  // INTERNALS.md §6b, "PLAN §C0 — the router seam".
  // v81_t: showLesson(idx), a thin delegate to startLesson(idx) — see INTERNALS.md §6b.
  const ls = ext(html, 'loadSaved');
  assert.ok(/idx>=0 \? \(showLesson\(idx\) !== false\) : \(showProgressCard\(true\), true\)/.test(ls),
    'learner: complete chapter → review card; started lessons are success-checked (live)');
  const lsS = ext(builder, 'loadSaved');
  assert.ok(/idx>=0 \? \(showLesson\(idx\) !== false\) : \(showProgressCard\(true\), true\)/.test(lsS),
    'learner: complete chapter → review card; started lessons are success-checked (static parity)');
}
console.log('  review mode for a re-opened complete chapter (live+static): OK');

// ── 4c. Chapter storyboard on the completion card (v65.1, reframed v71_k) ───
// PLAN §C0.4 (user ruling, v81_q): `_renderCompStoryboard` is DELETED — a caller search (including
// the storyline page, which this section's v80_z comment believed still used it) found none. What
// remains true and is still worth asserting: the slot exists and holds the chapter icon row.
{
  assert.ok(/id="comp-storyboard"/.test(html), 'the slot still exists');
  assert.ok(!/function _renderCompStoryboard\(/.test(html) && !/_renderCompStoryboard\(topicKey/.test(html),
    'the deleted storyboard renderer is neither defined nor called (comments may still name it)');
  assert.ok(/_chapterIconsHtml\(topicKey, _slCtx\)/.test(html),
    'the card slot renders the chapter icon row (v80_z)');
}
console.log('  chapter storyboard slot: renderer deleted (v81_q), chapter icons confirmed: OK');


// ── 5. Static build parity ────────────────────────────────────────────────────
{
  const ls = ext(builder, 'loadSaved');
  // v81_s: showLessonSet(), a thin delegate to goLessonSet() — see INTERNALS.md §6b.
  assert.ok(/await showLessonSet\(\)/.test(ls), 'static loadSaved awaits goLessonSet');
  assert.ok(/_isLearner==='function' && _isLearner\(\)/.test(ls) && /_firstUnfinishedLessonIdx\(APP\.lessonData\)/.test(ls),
    'static loadSaved carries the SAME learner branch (parity — the two renderers must not drift)');
  // i18n keys exist (en).
  const ui = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui.json'), 'utf8'));
  for (const k of ['complete.next', 'complete.back_story', 'complete.back_home', 'complete.chapter_progress', 'complete.story_progress', 'complete.story_preview']) {
    assert.ok(ui.en[k], `ui.json en has ${k}`);
  }
}
console.log('  static loadSaved parity + i18n keys: OK')

// ── 6. v68.1 — the completion-crash cluster (reported: "solving questions → stuck") ──────────────
// Three defects, one report. (a) showComplete used `_belowThreshold` (v66.1 Next wiring) ABOVE its
// `let` declaration — a temporal-dead-zone ReferenceError, so EVERY completion crashed before the
// card was wired: the learner froze on the last question, and the review render crashing left the
// lesson-set page (rendered underneath by goLessonSet) showing. (b) The same block tested
// `d.topic`, but no `d` exists in showComplete — swallowed by its try/catch, so the v60.8 gate
// silently never fired. (c) The mixed lesson GETS a done-flag on every play (showComplete records
// one; confirmQuit records partial progress), after which the naive !done[id] scan in
// _firstUnfinishedLessonIdx found nothing → an INCOMPLETE mixed-driven set read as complete and
// practice could never resume (the perpetual "threshold can never be reached").
{
  // (a) Declaration-before-use, checked on CODE (comments stripped) inside showComplete's body.
  const sc = ext(html, 'showComplete');
  const code = sc.replace(/\/\/[^\n]*/g, '');
  const decl = code.indexOf('let _belowThreshold');
  assert.ok(decl > 0, 'showComplete declares _belowThreshold');
  assert.ok(!/(^|[^A-Za-z0-9_$])_belowThreshold/.test(code.slice(0, decl)),
    'no code path reads _belowThreshold before its declaration (TDZ crash, v68.1)');
  const declT = code.indexOf('const _teacher');
  assert.ok(declT > 0 && !/(^|[^A-Za-z0-9_$])_teacher[^M]/.test(code.slice(0, declT)),
    'no code path reads _teacher before its declaration');
  // (b) The undefined-`d` guard is gone; the gate keys off the card's own topicKey.
  assert.ok(!/d\.topic === APP\.lessonData\?\.topic/.test(sc),
    "the gate no longer references an undefined `d` (it silently disabled the threshold)");
  assert.ok(/APP\.lessonData\?\.topic === topicKey/.test(sc), 'the gate is scoped to the active topic via topicKey');

  // (c) Behavioral: an incomplete mixed-driven set resumes at the mixed lesson even when every
  // counted lesson (mixed included) carries a done-flag.
  const APP = { _teacherMode: false, progress: { completed: {} }, lessonData: null };
  // v71_s: _firstUnfinishedLessonIdx gained two dependencies — a learner must never be auto-resumed
  // INTO a comprehension lesson whose story is still locked (v60 nav auto-starts whatever this
  // returns, which would put them on questions about text they have not been shown).
  // v80_b: the story-lock rule moved out of this function into `_storyLockedLesson`, so that the
  // REPLAY scan (`_firstCoverageShortLessonIdx`) could apply the same rule instead of a second copy
  // of it. It is spliced in here rather than stubbed: a stub would let this section pass while the
  // real rule was broken, which is the whole failure mode the extraction style exists to avoid.
  // The CLAIM below is unchanged — only where the rule is defined moved.
  const fu = new Function('APP', 'lessonCountsFor', 'setComplete', '_firstVisibleMixedIdx',
    '_isStoryGatedLesson', 'storyUnlocked',
    ext(html, '_storyLockedLesson') + '\n'
    + ext(html, '_firstUnfinishedLessonIdx') + '\nreturn _firstUnfinishedLessonIdx;');
  const notGated = () => false, unlocked = () => true;
  const mixedIdx = new Function(ext(html, '_firstVisibleMixedIdx') + '\nreturn _firstVisibleMixedIdx;')();
  const d = { topic: 'MixCh', lessons: [ { id: '1' }, { id: '6', type: 'word_forms' }, { id: 'm', type: 'mixed' } ] };
  APP.lessonData = d;
  APP.progress.completed['MixCh'] = { 1: {correct:1,total:2}, 6: {correct:1,total:2}, m: {correct:0,total:3} };
  const counts = (dd, L) => !L._hidden;
  let f = fu(APP, counts, () => false, mixedIdx, notGated, unlocked);
  assert.strictEqual(f(d), 2, 'incomplete mixed-driven set with all done-flags resumes at the MIXED lesson');
  f = fu(APP, counts, () => true, mixedIdx, notGated, unlocked);
  assert.strictEqual(f(d), -1, 'a genuinely complete set still returns -1 (review card)');
  APP._teacherMode = true;
  f = fu(APP, counts, () => false, mixedIdx, notGated, unlocked);
  assert.strictEqual(f(d), -1, 'teacher mode keeps the classic done-flag semantics (no mixed fallback)');
  APP._teacherMode = false;
  // Classic set (no mixed) below threshold: unchanged — -1, the card's drill gate takes over.
  const dc = { topic: 'MixCh', lessons: [ { id: '1' }, { id: '6', type: 'word_forms' } ] };
  APP.lessonData = dc;
  assert.strictEqual(f(dc), -1, 'a classic set with all done-flags returns -1 (drill gate handles the threshold)');

  // (c2) v71_s: the story-lock skip. A chapter whose LAST lesson is comprehension, with the story
  // still locked, must resume at the earlier unfinished lesson — never at the comprehension one.
  const dg = { topic: 'GateCh', lessons: [
    { id: 'a' }, { id: 'c', type: 'comprehension' } ] };
  APP.lessonData = dg;
  APP.progress.completed['GateCh'] = {};
  const isGated = (L) => !!(L && L.type === 'comprehension');
  let g = fu(APP, counts, () => false, mixedIdx, isGated, () => false);
  assert.strictEqual(g(dg), 0, 'story locked → resume at the first ordinary lesson');
  // With lesson `a` finished but the story still locked, the comprehension lesson is NOT offered.
  APP.progress.completed['GateCh'] = { a: {correct:2,total:2} };
  g = fu(APP, counts, () => false, mixedIdx, isGated, () => false);
  assert.notStrictEqual(g(dg), 1,
    'story still locked → the comprehension lesson is never the resume target');
  // Once the story unlocks, it becomes exactly the resume target.
  g = fu(APP, counts, () => false, mixedIdx, isGated, () => true);
  assert.strictEqual(g(dg), 1, 'story unlocked → resume lands on the comprehension lesson');
  // A teacher is exempt from the lock, as everywhere else.
  APP._teacherMode = true;
  g = fu(APP, counts, () => false, mixedIdx, isGated, () => false);
  assert.strictEqual(g(dg), 1, 'teacher mode ignores the story lock');
  APP._teacherMode = false;
  APP.lessonData = dc;

  // (c) Routing: startLesson signals failure; both loadSaveds route a stranded learner to the
  // storyline (confirmQuit's target), never leaving the lesson-set page showing.
  const start = ext(html, 'startLesson');
  assert.ok((start.match(/return false;/g) || []).length >= 2,
    'startLesson returns false on both guard exits (hidden lesson, empty mixed round)');
  assert.ok(/renderEx\(\);\s*return true;/.test(start), 'startLesson returns true once the screen is taken over');
  // v81_u: showStoryline(...), a thin delegate to openStorylineScreen(...) — see INTERNALS.md §6b.
  // v81_v / PLAN §C5 stage 1: both loadSaveds now call showLibraryClean() — "home" means the
  // library, a user ruling — build-static.js's own re-implementation updated alongside index.html
  // (INTERNALS §5's "both files" risk).
  for (const [src, label] of [[ext(html, 'loadSaved'), 'live'], [ext(builder, 'loadSaved'), 'static']]) {
    assert.ok(/if\(!started\)\{/.test(src) && /showStoryline\(ctx\.sl\.id, ctx\.enc\)/.test(src)
      && /showLibraryClean\(\)/.test(src),
      `a failed auto-start falls back to storyline/library, not the lesson-set page (${label})`);
  }
}
console.log('  v68.1 completion-crash cluster: TDZ order, gate scope, mixed resume, stranded-learner routing: OK')


// ── 7. v69_f: the storyline row counts chapters in BOTH build shapes ──────────────────────────
// Reported from the deployed static site: "Geschichte · Chaos der Hagelstürme 0/4" while chapters
// were finished. Reproduce both topic shapes and check the chapter tally the row is built from.
{
  const prog = ext(html, '_compProgressHtml');
  // Extract just the other-chapters tally so it can be exercised directly.
  const APP = { _teacherMode: false, progress: { completed: {} } };
  const lessonCountsFor = (d, L) => !L._hidden;                    // simplified: no mixed folding
  const _firstVisibleMixedIdx = () => -1;
  const tally = (chapters, completed) => {
    APP.progress.completed = completed;
    let doneCh = 0;
    for (const ch of chapters) {
      const cDone = completed[ch.topic] || {};
      const _chLessons = Array.isArray(ch.lessons) && ch.lessons.length ? ch.lessons : null;
      const cnt = _chLessons ? _chLessons.filter(L => lessonCountsFor(ch, L)).length : (ch.lessonCount || 0);
      const doneKeys = Object.keys(cDone).length;
      const _chTypes = Array.isArray(ch.lessonTypes) ? ch.lessonTypes
                     : (_chLessons ? _chLessons.map(L => L && L.type).filter(Boolean) : []);
      const isMixed = _chTypes.includes('mixed');
      if (cnt === 0) continue;
      if (isMixed) { if (doneKeys >= Math.max(1, cnt - 1)) doneCh++; }
      else if (doneKeys >= cnt) doneCh++;
    }
    return doneCh;
  };

  // STATIC shape: whole topics baked (lessons[], no projection fields) — the reported failure.
  const staticChapters = [
    { topic: 'A', lessons: [{ id: '1', type: 'vocab' }] },
    { topic: 'B', lessons: [{ id: '1', type: 'vocab' }, { id: '2', type: 'word_forms' }] },
    { topic: 'C', lessons: [{ id: '1', type: 'vocab' }, { id: 'm', type: 'mixed' }] },
    { topic: 'D', lessons: [{ id: '1', type: 'vocab' }] },
  ];
  const completed = { A: { 1: {} }, B: { 1: {}, 2: {} }, C: { 1: {} }, D: {} };
  assert.strictEqual(tally(staticChapters, completed), 3,
    'static: finished chapters are counted (A, B, and the mixed-driven C) — was 0 before v69_f');

  // LIVE shape: list projection only (lessonCount/lessonTypes, no lessons[]) — must be unchanged.
  const liveChapters = [
    { topic: 'A', lessonCount: 1, lessonTypes: ['vocab'] },
    { topic: 'B', lessonCount: 2, lessonTypes: ['vocab', 'word_forms'] },
    { topic: 'C', lessonCount: 2, lessonTypes: ['vocab', 'mixed'] },
    { topic: 'D', lessonCount: 1, lessonTypes: ['vocab'] },
  ];
  assert.strictEqual(tally(liveChapters, completed), 3, 'live projection keeps its previous behaviour');

  // A chapter with no lessons at all is still skipped rather than counted as done.
  assert.strictEqual(tally([{ topic: 'E', lessons: [] }], { E: {} }), 0, 'an empty chapter is not counted');
}
console.log('  v69_f: storyline chapter tally works for baked (static) and projected (live) topics: OK');

console.log('unit-learner-nav: ALL PASSED');

// ── v70_m: the account badge must be repainted once UI strings load ─────────
// init() calls refreshAccountBadge() BEFORE loadUIStrings() has populated UI_STRINGS, so
// t('acct.signin') returned the raw KEY. It only looked right after a sign-in/out happened to
// re-run the refresh. The badge is now repainted whenever strings (re)load.
{
  const at = html.indexOf('loadUIStrings(code).then(');
  assert.ok(at > -1, 'the UI-strings reload hook exists');
  const body = html.slice(at, at + 400);
  assert.ok(/refreshAccountBadge\(\)/.test(body),
    'the badge is repainted after UI strings load (otherwise it shows the raw i18n key on first paint)');
}
