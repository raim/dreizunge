// unit-qc-correct.test.js
// v55_g — QC for generated texts. A QC model proofreads a story; the correction is a PROPOSAL that
// seeds an ai_error_hunt via the existing diff. The "too many changes" guard rejects a wholesale
// rewrite. Thresholds (changedRatio 0.6 / wordEditRatio 0.5) come from the spike on real corpus
// stories: the 'corrected' band topped out at 0.21/0.033, the one rewrite sat at 0.938/0.844 — the
// guard lives in that empty gulf. These tests pin the classifier boundaries, the proposal/accept
// route contract (never overwrite topic.story without acceptance; rebuild ai_error_hunt from the
// original↔corrected diff), and the think:false / stamp plumbing.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// Extract a function body by brace-matching (the suite's idiom).
function ext(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, `found ${name}`);
  const b = src.indexOf('{', at);
  let d = 0, i = b;
  for (; i < src.length; i++) { const c = src[i]; if (c === '{') d++; else if (c === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
// Pull the two module-scope threshold constants so the classifier runs standalone.
const consts = (server.match(/const QC_MAX_CHANGED_RATIO = [\d.]+;/) || [])[0] + '\n'
             + (server.match(/const QC_MAX_WORD_EDIT_RATIO = [\d.]+;/) || [])[0];
assert.ok(/0\.6/.test(consts) && /0\.5/.test(consts), 'thresholds are the spike-derived 0.6 / 0.5');
const classify = new Function(
  consts + '\n' + ext(server, 'splitSentences') + '\n' + ext(server, 'storyDiffSentences') + '\n'
  + ext(server, '_wordLev') + '\n' + ext(server, '_qcCorruption') + '\n' + ext(server, 'classifyStoryQc') + '\nreturn classifyStoryQc;'
)();

// ── 1. The three verdicts, on spike-shaped inputs ─────────────────────────────
{
  const same = 'Der Hund läuft schnell. Die Katze schläft ruhig. Es regnet leise.';
  const cl = classify(same, same);
  assert.strictEqual(cl.verdict, 'clean', 'identical → clean');
  assert.strictEqual(cl.rejected, false, 'clean is not rejected');
  assert.strictEqual(cl.changedSentences, 0, 'clean has zero changed sentences');

  // A handful of targeted fixes across a longer text → corrected (mirrors the spike's it/de cases).
  const orig = 'Il sole si alzò sopra le colline di Toscana. Con il suo zaino, notò le case colorate. '
             + 'Il fiume scorreva calmo. Gli uccelli cantavano. Tutto era sereno quel mattino.';
  const corr = 'Il sole si alzò sopra le colline della Toscana. Con lo zaino, notò le case colorate. '
             + 'Il fiume scorreva calmo. Gli uccelli cantavano. Tutto era sereno quel mattino.';
  const c = classify(orig, corr);
  assert.strictEqual(c.verdict, 'corrected', 'targeted edits → corrected');
  assert.strictEqual(c.rejected, false, 'corrected is not rejected');
  assert.ok(c.changedSentences >= 1 && c.changedSentences < c.totalSentences, 'some but not all sentences changed');
  assert.ok(c.wordEditRatio <= 0.5 && c.changedRatio <= 0.6, 'corrected sits under both thresholds');
}

// ── 2. The guard rejects a rewrite (mutation test on both axes) ───────────────
{
  // Every sentence replaced → both ratios ≈ 1 → rewrite.
  const orig = 'Uno due tre. Quattro cinque sei. Sette otto nove. Dieci undici dodici.';
  const rw   = 'Completamente diverso testo. Nuove parole ovunque adesso. Niente resta uguale qui. Tutto riscritto da capo.';
  const r = classify(orig, rw);
  assert.strictEqual(r.verdict, 'rewrite', 'wholesale replacement → rewrite');
  assert.strictEqual(r.rejected, true, 'a rewrite is rejected by the guard');
  assert.ok(r.wordEditRatio > 0.5, 'rewrite exceeds the word-edit threshold');

  // Mutation: a change that trips ONLY the sentence-ratio axis (many sentences, tiny word edits)
  // must still reject — the guard is OR, not AND.
  const many = Array.from({ length: 10 }, (_, i) => `Frase numero ${i} qui.`).join(' ');
  const manyEdited = Array.from({ length: 10 }, (_, i) => `Frase numera ${i} qui.`).join(' '); // every sentence tweaked
  const m = classify(many, manyEdited);
  assert.ok(m.changedRatio > 0.6, 'every sentence touched → changedRatio over 0.6');
  assert.strictEqual(m.verdict, 'rewrite', 'high changed-sentence ratio alone → rewrite (OR guard)');
}

// ── 3. Boundary: just under the threshold stays 'corrected' ───────────────────
{
  // 3 of 8 sentences changed = 0.375 changedRatio (< 0.6); small word edits (< 0.5) → corrected.
  const s = i => `Questa e la frase ${i} del testo.`;
  const orig = [0,1,2,3,4,5,6,7].map(s).join(' ');
  const corr = [0,1,2,3,4,5,6,7].map(i => i < 3 ? `Questa è la frase ${i} del testo.` : s(i)).join(' ');
  const c = classify(orig, corr);
  assert.ok(c.changedRatio < 0.6, 'under the sentence threshold');
  assert.strictEqual(c.verdict, 'corrected', 'under both thresholds → corrected, not rejected');
}

// ── 3b. The 'corrupt' verdict: model mangled text mechanically (v55_i real case) ──
{
  // qwen2.5:7b collapsed all spaces inside a quoted sentence, producing a run-together word.
  const orig = 'Nel laboratorio i sussurri fluttuavano. Si chiedevano: "Che vita avrebbero avuto queste parole senza contesto?" Eppure ogni frase si intrecciava nel tessuto.';
  const corr = 'Nel laboratorio i sussurri fluttuavano. Si chiedevano: "Chevitaavrebberoavutequesteparolesenzacontesto?" Eppure ogni frase si intrecciava nel tessuto.';
  const c = classify(orig, corr);
  assert.strictEqual(c.verdict, 'corrupt', 'a run-together word → corrupt, not corrected');
  assert.strictEqual(c.rejected, true, 'a corrupt result is rejected (never acceptable)');
  // A corrupt result must NOT be mislabelled as merely 'corrected' just because few sentences changed.
  assert.ok(c.changedSentences <= 2, 'corruption can present as a small change count — the verdict must not rely on ratio alone');
}
{
  // Wholesale space loss across the story (not just one token) also → corrupt.
  const orig = 'Il sole si alzò sopra le colline. Con lo zaino notò le case. Il fiume scorreva calmo davanti.';
  const corr = 'Ilsolesialzòsoprelecolline. Conlozainonotòlecase. Ilfiumescorrevacalmodavanti.';
  assert.strictEqual(classify(orig, corr).verdict, 'corrupt', 'wholesale space loss → corrupt');
}
{
  // A legitimate long compound near the original's own max length must NOT trip the guard.
  const orig = 'Die Geschwindigkeitsbegrenzung war hoch. Das Auto fuhr schnell vorbei.';
  const corr = 'Die Geschwindigkeitsbegrenzung war hoch. Das Auto fuhr schnell vorbei!';
  assert.notStrictEqual(classify(orig, corr).verdict, 'corrupt', 'a legit long word does not trip corruption detection');
}

// ── 4. Generator contract: QC model, think:false, story_qc stamp, no mutation ─
const gen = ext(server, 'generateStoryQc');
assert.ok(/callLLMQC\(sys, story,[\s\S]{0,80}\{ think: false \}\)/.test(gen), 'QC uses think:false (v55_c lesson)');
assert.ok(/PROMPTS\.storyQc\.system/.test(gen), 'correction prompt lives in prompts.json (storyQc)');
assert.ok(/buildGenMeta\(\{ type: 'story_qc', model: OLLAMA_QC_MODEL/.test(gen), 'stamped story_qc with the QC model');
// Regression guard (v55_g bug): generateStoryQc called stripThink, which server.js never imported
// from llm.js — a crash the string-only tests missed because they never RAN the function. Assert
// every llm.js export the server calls as a bare identifier is actually imported (or locally defined).
{
  const LLM_EXPORTS = ['callLLM','ping','listModels','release','warmup','stripThink','stripRaw',
    'extractJSON','extractArray','salvageArray','setRequestTimeout','getRequestTimeout'];
  const importBlock = server.slice(Math.max(0, server.indexOf("require('./llm") - 400), server.indexOf("require('./llm"));
  for (const e of LLM_EXPORTS) {
    const calledBare = new RegExp('(?<![.\'"\\w])' + e + '\\s*\\(').test(server);
    if (!calledBare) continue;
    const imported = new RegExp('\\b' + e + '\\b').test(importBlock);
    const localDef = new RegExp('function ' + e + '\\b').test(server);
    assert.ok(imported || localDef, `server.js calls llm.js '${e}' but never imports/defines it`);
  }
}
assert.ok(/valid: c\.rejected \? 0 : 1/.test(gen), 'a rejected (rewrite) proposal stamps valid:0');
assert.ok(!/t\.story =|topic\.story =/.test(gen), 'the generator NEVER writes topic.story (proposal only)');
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));
assert.ok(prompts.storyQc && prompts.storyQc.system, 'storyQc prompt present');
assert.ok(/proofread|CORRECT errors ONLY|not rewriting/i.test(prompts.storyQc.system), 'prompt forbids rewriting');

// ── 5. Route contract: propose stores a proposal, accept applies + builds hunt ─
// propose route: persists under storyQcProposal, echoes original, never sets t.story.
const proposeRoute = server.slice(server.indexOf("url.pathname === '/api/story-qc'"), server.indexOf("url.pathname === '/api/story-qc/accept'"));
assert.ok(/t\.storyQcProposal = \{/.test(proposeRoute), 'propose stores the proposal on the topic');
assert.ok(/against: t\.story/.test(proposeRoute), 'proposal records the exact original it was diffed against');
assert.ok(!/\bt\.story = /.test(proposeRoute), 'propose route never overwrites t.story');
assert.ok(/saveStore\(store\)/.test(proposeRoute), 'proposal is persisted');

// accept route: pins aiStory to the original, sets t.story, stamps QC, rebuilds ai_error_hunt.
const acceptRoute = server.slice(server.indexOf("url.pathname === '/api/story-qc/accept'"), server.indexOf("url.pathname === '/api/story-qc/discard'"));
assert.ok(/if \(prop\.rejected\) return json\(res, 409/.test(acceptRoute), 'a rejected proposal cannot be accepted');
assert.ok(/if \(!t\.aiStory\) t\.aiStory = prop\.against/.test(acceptRoute), 'accept pins aiStory to the original (if unset)');
assert.ok(/t\.story = prop\.corrected;/.test(acceptRoute), 'accept applies the correction to t.story');
assert.ok(/t\.storyQcBy = /.test(acceptRoute) && /t\.storyQcAt = /.test(acceptRoute), 'accept stamps the QC model + time on the topic');
assert.ok(/storyDiffSentences\(t\.aiStory, t\.story/.test(acceptRoute), 'accept rebuilds the hunt from original↔corrected');
assert.ok(/type: 'ai_error_hunt'/.test(acceptRoute), 'accept (re)builds an ai_error_hunt lesson');
assert.ok(/delete t\.storyQcProposal;/.test(acceptRoute), 'accept consumes the proposal');
// v55_i: accept returns the rebuilt lessons so the client shows the ai_error_hunt WITHOUT a reload.
assert.ok(/return json\(res, 200, \{ ok: true, story: t\.story, errorHuntBuilt: huntBuilt, lessons: t\.lessons \}\)/.test(acceptRoute),
  'accept returns the updated lessons array (no reload needed to see the error-hunt)');

// discard route: removes the proposal, no LLM, no story change.
const discardRoute = server.slice(server.indexOf("url.pathname === '/api/story-qc/discard'"));
assert.ok(/delete t\.storyQcProposal;/.test(discardRoute.slice(0, 400)), 'discard removes the proposal');
assert.ok(!/t\.story = /.test(discardRoute.slice(0, 400)), 'discard never touches the story');

// ── 6. propose requires a backend; accept/discard do NOT (pure application) ────
assert.ok(/url\.pathname === '\/api\/story-qc'\) \{\s*\n\s*if \(active === 'none'\)/.test(server),
  'propose requires an LLM backend');
assert.ok(!/url\.pathname === '\/api\/story-qc\/accept'\) \{[\s\S]{0,120}active === 'none'/.test(server),
  'accept does NOT require a backend (pure application of a stored proposal)');

const client = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// v55_i: accept must refresh the client's lesson cache so the error-hunt appears without a reload.
assert.ok(/if \(Array\.isArray\(data\.lessons\)\) d\.lessons = data\.lessons;/.test(client),
  'acceptStoryQc updates d.lessons from the response');
// v55_i display fix: one-sided sentence pairs (whole add/remove) render as whole del/ins blocks,
// NOT word-diffed against an empty string (which dropped every space).
assert.ok(/if \(!p\.a\) inner =[\s\S]{0,120}<ins/.test(client), 'a whole-insert pair renders as an <ins> block');
assert.ok(/else if \(!p\.b\) inner =[\s\S]{0,120}<del/.test(client), 'a whole-delete pair renders as a <del> block');

// ── 8. Bulk story QC (v55_k): _runQc accumulates story proposals ──────────────
const runQc = ext(server, '_runQc');
assert.ok(/includeStory = true/.test(runQc), 'bulk QC includes story QC by default');
assert.ok(/includeStory && !onlyFlagged && lessonIdx === null/.test(runQc),
  'story QC runs only in a full sweep — never flagged-only or single-lesson');
assert.ok(/tp\.storyQcCheckedBy === OLLAMA_QC_MODEL && tp\.storyQcCheckedAt && !force/.test(runQc),
  'skip-control: an unedited story already checked by this model is skipped (unless force)');
assert.ok(/generateStoryQc\(tp\.story, tp\.lang/.test(runQc), 'bulk reuses the same generateStoryQc');
assert.ok(/tp\.storyQcProposal = \{/.test(runQc), 'a non-clean verdict accumulates a proposal on the topic');
assert.ok(/if \(tp\.storyQcProposal\) \{ delete tp\.storyQcProposal; \}/.test(runQc),
  'a clean re-check clears a now-obsolete proposal');
// The route forwards includeStory (default true) and the summary payload exposes the pending flag.
assert.ok(/includeStory: includeStory !== false/.test(server), 'route defaults includeStory to true');
assert.ok(/storyQcPending: !!l\.storyQcProposal/.test(server), 'topic-summary payload exposes storyQcPending');

// v55_l regression guard: _runQc is defined at MODULE scope (before boot()), so every function it
// calls must ALSO be module-scope-visible. generateStoryQc was accidentally nested inside boot()
// (v55_k), so the real _runQc threw "generateStoryQc is not defined" only in the bulk path. Assert
// the QC family is defined textually BEFORE boot() — the concrete invariant that was violated.
{
  const bootAt = server.indexOf('async function boot()');
  assert.ok(bootAt > 0, 'boot() found');
  for (const fn of ['generateStoryQc', 'classifyStoryQc', 'storyDiffSentences', 'splitSentences', '_wordLev', '_qcCorruption']) {
    const defAt = server.indexOf('function ' + fn + '(');
    assert.ok(defAt > 0, `${fn} is defined`);
    assert.ok(defAt < bootAt, `${fn} must be at module scope (defined before boot()), so _runQc — which is also pre-boot — can call it`);
  }
  // And _runQc itself is pre-boot (the premise of the above).
  assert.ok(server.indexOf('async function _runQc(') < bootAt, '_runQc is pre-boot module scope');
}

// ── 9. Staleness: an edit clears the checked stamp + proposal; accept guards it ─
const saveStory = server.slice(server.indexOf("url.pathname === '/api/save-story'"), server.indexOf("url.pathname === '/api/story-qc'"));
assert.ok(/delete saved\.storyQcCheckedBy; delete saved\.storyQcCheckedAt;/.test(saveStory),
  'a story edit clears the story-QC checked stamp (so the next sweep re-proofreads)');
assert.ok(/if \(saved\.storyQcProposal\) \{ delete saved\.storyQcProposal;/.test(saveStory),
  'a story edit drops any stale pending proposal');
assert.ok(/prop\.against !== undefined && prop\.against !== t\.story[\s\S]{0,140}Story changed since/.test(acceptRoute),
  'accept refuses (409) a proposal whose baseline no longer matches the current story');

console.log('  qc-correct: verdicts (incl. corrupt), guard, generator + routes + bulk + staleness: OK');
console.log('unit-qc-correct: ALL PASSED');
