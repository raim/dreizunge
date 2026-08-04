// unit-qc-concurrent-edit.test.js
// v73_j (user-reported) — QC findings must survive a chapter being saved WHILE the pass is inside it.
//
// The report: a QC run logged 9 flags across two chapters; 5 showed up in the app. The console and
// the resulting lessons.json together identify the mechanism exactly:
//
//   • `Kälte und Paella` was edited (3 saves) WHILE QC was inside it → all 4 of its flags lost,
//     INCLUDING two raised after the edit landed.
//   • `Churros und Chaos` was edited just BEFORE QC reached it → QC captured the fresh array and
//     all 5 of its flags survived.
//   • The chapter that lost everything still carried `tokensByType.lesson_qc: 4935` — QC did run
//     and did spend the tokens. Token accounting is written to the TOPIC, which the editor mutates
//     in place; stamps and flags are written to LESSON and ITEM objects, which the editor replaces
//     (`saved.lessons = lessons.map(...)`, building fresh objects through mergeFlaggable).
//
// That asymmetry — topic-level writes surviving while everything below them vanishes — is the
// fingerprint of a held reference, not of a stale payload. The "flags raised AFTER the edit were
// also lost" detail rules out the payload explanation on its own: a stale client cannot delete a
// finding that did not exist when it loaded.
//
// _runQc now re-resolves topic and lesson from `store` by id at every write, and locates items by
// (array key, index) — the editor's merge is index-aligned, so that pairing survives it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
function ext(name) {
  const at = server.indexOf('async function ' + name + '(');
  assert.ok(at >= 0, 'missing function: ' + name);
  const bs = server.indexOf('{', at);
  let d = 0, i = bs;
  for (; i < server.length; i++) {
    const c = server[i];
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } }
  }
  return server.slice(at, i);
}

// The store the pass resolves through — the real one is a module-level singleton.
const store = { schemaVersion: 30, topics: [] };

function freshTopic() {
  return {
    id: 'tp_kalte', topic: 'Kälte und Paella', lang: 'es', srcLang: 'de',
    lessons: [{
      id: 'L0', type: 'standard',
      vocab: [{ target: 'decidir', source: 'entscheiden' },
              { target: 'una cuenta bancaria', source: 'ein Bankkonto' }],
      sentences: [{ target: 'Mi estómago gritaba.', source: 'Mein Magen schrie danach.' }],
    }],
  };
}

// Reproduces the editor save (server.js ~6340): every lesson AND every item becomes a NEW object,
// content preserved, index preserved, ids preserved. This is what orphans a held reference.
function editorSave(topicId) {
  const saved = store.topics.find(t => t.id === topicId);
  const orig = saved.lessons.slice();
  saved.lessons = orig.map(o => ({
    ...o,
    vocab:     (o.vocab     || []).map(v => ({ target: v.target, source: v.source })),
    sentences: (o.sentences || []).map(v => ({ target: v.target, source: v.source })),
  }));
  saved.updatedAt = new Date().toISOString();
}

let flagCalls = 0, editedAfter = 1;   // save fires after the FIRST checked item, mid-lesson
const stubs = {
  store,
  langName: x => x,
  OLLAMA_QC_MODEL: 'qc-stub',
  QC_DIACRITIC_BY: 'diacritics',
  jobStep: () => {}, jobDone: () => {},
  meterLLMTokens: async (fn) => ({ result: await fn(), tokens: { promptTokens: 1, completionTokens: 1 } }),
  addTokenUsage: (tp, tok, kind) => {
    tp.generationStats = tp.generationStats || { tokensByType: {} };
    tp.generationStats.tokensByType[kind] = (tp.generationStats.tokensByType[kind] || 0) + 2;
  },
  upsert: (tp) => {
    const i = store.topics.findIndex(t => t.id === tp.id);
    // Real upsert semantics: REPLACE the entry with a shallow copy.
    if (i >= 0) store.topics[i] = { ...tp }; else store.topics.unshift({ ...tp });
  },
  buildDiacriticIndex: () => null,
  checkDiacritics: () => ({ ok: true }),
  qcCheckDiacriticCandidate: async () => ({ ok: true }),
  _qcStripFuri: t => t,
  _qcLessonUserFlagged: () => true,
  _lessonHasOpenQcFlag: (ls) => [ls.vocab, ls.sentences, ls.items, ls.words, ls.grammar, ls.conjugations]
    .some(a => Array.isArray(a) && a.some(x => x && x.qc)),
  _clearLessonQcStamp: () => {},
  generateStoryQc: async () => ({ verdict: 'clean', rejected: false }),
  qcCheckDialectPair: async () => ({ ok: true }),
  qcCheckCloze: async () => ({ ok: true }),
  qcCheckSynonymSet: async () => ({ ok: true }),
  // Every item is flagged. The save is triggered from inside the checker, so it lands between
  // awaits exactly as a real HTTP handler would.
  qcCheckPair: async () => {
    flagCalls++;
    if (flagCalls === editedAfter) editorSave('tp_kalte');
    return { ok: false, field: 'source', sug: `fix-${flagCalls}` };
  },
};
const _raw = new Function(...Object.keys(stubs), ext('_runQc') + '\nreturn _runQc;')(...Object.values(stubs));

async function run() {
  store.topics = [freshTopic()];
  flagCalls = 0;
  // The pass receives the topic objects resolved at request time, as the routes do.
  await _raw('job1', store.topics.slice(), { lessonIdx: null, onlyFlagged: false, includeStory: false });
  return store.topics.find(t => t.id === 'tp_kalte');
}

(async () => {
  const tp = await run();
  const ls = tp.lessons[0];
  const flagged = [...(ls.vocab || []), ...(ls.sentences || [])].filter(x => x && x.qc);

  // Guard the guard: if the harness stopped flagging, the assertions below prove nothing.
  assert.strictEqual(flagCalls, 3, `every item was checked (${flagCalls} checker calls)`);
  // And the edit must genuinely have replaced the objects, or there is no race to survive.
  assert.ok(tp.updatedAt, 'the mid-pass editor save actually ran');

  // THE REGRESSION. Before v73_j this was 0 of 3: the save replaced the lesson and item objects
  // after the first check, and every subsequent write went to the orphaned copies.
  assert.strictEqual(flagged.length, 3,
    `all ${flagCalls} findings survive a chapter saved mid-pass (got ${flagged.length})`);

  // Specifically the ones raised AFTER the edit — the detail that distinguishes an orphaned
  // reference from a stale client payload.
  assert.ok(flagged.some(x => x.qc.sug === 'fix-2') && flagged.some(x => x.qc.sug === 'fix-3'),
    'including the findings raised after the save landed');

  // Token accounting reached the topic too — it always did, which is why the symptom was
  // "QC clearly ran and left nothing behind" rather than "QC did not run".
  assert.ok(tp.generationStats && tp.generationStats.tokensByType.lesson_qc > 0,
    'the pass still attributes its tokens to the topic');

  // A flagged lesson is never stamped clean — read from the LIVE lesson, which is where the flags
  // now are. Stamping here would make the next bulk run skip a chapter with open findings.
  assert.ok(!ls.qcAt, 'a lesson carrying findings is not stamped clean');

  console.log(`  concurrent edit: ${flagged.length}/${flagCalls} findings survived a mid-pass save`);

  // ── Scenario 2: the TOPIC object is replaced mid-pass ──────────────────────
  // The editor save mutates the topic in place, so scenario 1 cannot distinguish `upsert(tp)` from
  // `upsert(_liveTopic())`. Other routes (save-story, generate) go through upsert, which does
  // `arr[i] = entry` — a shallow copy. If QC then upserts the topic IT captured, it writes a stale
  // object back over the store, and the loss runs the other way: the user's concurrent change is
  // reverted rather than QC's findings being dropped.
  {
    store.topics = [freshTopic()];
    flagCalls = 0;
    let replaced = false;
    const origPair = stubs.qcCheckPair;
    // Replace the topic object after the first check, the way upsert does, adding a lesson the
    // captured reference has never seen.
    stubs.qcCheckPair = async () => {
      flagCalls++;
      if (!replaced) {
        replaced = true;
        const i = store.topics.findIndex(t => t.id === 'tp_kalte');
        store.topics[i] = { ...store.topics[i],
          lessons: [...store.topics[i].lessons, { id: 'L1', type: 'comprehension', title: 'Added mid-pass' }] };
      }
      return { ok: false, field: 'source', sug: `s2-${flagCalls}` };
    };
    const _raw2 = new Function(...Object.keys(stubs), ext('_runQc') + '\nreturn _runQc;')(...Object.values(stubs));
    await _raw2('job2', store.topics.slice(), { lessonIdx: null, onlyFlagged: false, includeStory: false });
    stubs.qcCheckPair = origPair;

    const t2 = store.topics.find(t => t.id === 'tp_kalte');
    assert.ok(replaced, 'the fixture really replaced the topic object mid-pass');
    assert.ok(t2.lessons.some(L => L.id === 'L1'),
      'a lesson added while QC was running is still there afterwards — QC must not upsert the '
      + 'topic object it captured, which would write a stale copy back over the store');
    const f2 = [...(t2.lessons[0].vocab || []), ...(t2.lessons[0].sentences || [])].filter(x => x && x.qc);
    assert.strictEqual(f2.length, 3, `and its own findings still land (${f2.length}/3)`);
    console.log(`  topic replaced mid-pass: added lesson kept, ${f2.length}/3 findings landed`);
  }

// ── Scenario 3: a lesson type nothing checks is never stamped clean ─────────
// v73_k. `comprehension` carries `questions`, not vocab/sentences, so it fell to the generic scan,
// which found nothing to check — and the lesson was then stamped QC-clean. The stamp is not inert:
// `_runQc` skips any lesson whose `qcAt` was set by the same model, so the lesson was marked clean
// for good, unexamined. Seen in the wild on "Churros und Chaos".
//
// Asserted for EVERY out-of-scope type, not just comprehension, so the next type added to that list
// (or forgotten from it) is covered by the same guarantee.
{
  const unchecked = ['comprehension', 'math', 'error_hunt', 'ai_error_hunt', 'mixed', 'intro_script'];
  for (const type of unchecked) {
    store.topics = [{
      id: 'tp_scope', topic: 'Scope', lang: 'es', srcLang: 'de',
      // Deliberately carries the fields the generic scan looks for as EMPTY arrays plus a payload
      // the scan cannot read — the shape that produced the false stamp.
      lessons: [{ id: 'LS', type, questions: [{ q: 'why?', correct: 'because' }] }],
    }];
    flagCalls = 0;
    await _raw('job3-' + type, store.topics.slice(), { lessonIdx: null, onlyFlagged: false, includeStory: false });
    const ls3 = store.topics.find(t => t.id === 'tp_scope').lessons[0];
    assert.ok(!ls3.qcAt,
      `a ${type} lesson is never stamped QC-clean — nothing examined it, and the stamp would make ` +
      `every later bulk run skip it`);
    assert.strictEqual(flagCalls, 0, `and no pair checker ran for ${type}`);
  }
  console.log(`  scope: ${unchecked.length} unchecked lesson types, none stamped clean`);
}

console.log('unit-qc-concurrent-edit: ALL PASSED');
})().catch(e => { console.error(e); process.exit(1); });
