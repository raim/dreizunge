// unit-qc-unify-parity.test.js — v89_ac.
//
// User ruling: "can we merge or unify the two text QC functions, and at all places where texts can
// be edited the QC icon should open a popover that allows the user to select between the light
// version (as currently for PDF and comics) and the heavier (as currently for story-QC)?"
//
// The merge collapsed THREE functions into one engine:
//   generateStoryQc  ─┐
//   generateSummaryQc ├─→ qcProse(text, lang, {mode, kind, ...})
//   normaliseExtractedText ─┘
//
// ⚠️ This file exists because "the tests still pass" is a WEAKER CLAIM THAN A DIFF. It lifts the
// PRE-MERGE functions out of git and the post-merge ones out of the working tree, drives BOTH with
// byte-identical stubbed model replies, and deep-compares the results. A refactor that claims to
// preserve behaviour has to show it, not assert it.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const NEW = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

// ⚠️ The pre-merge side is a CAPTURED FIXTURE, not the old source pulled out of git. A first draft
// did `git show <tag>:server.js`, which works on this machine and fails on any clone that does not
// have the tag — a guard that goes red for a reason that has nothing to do with the code is worse
// than no guard. The outputs were captured once, from the real pre-merge functions, driven by the
// same stubbed replies listed in each case. That is also the more literal reading of the standing
// rule: capture the old OUTPUT and diff it.
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'qc-premerge.json'), 'utf8'));
assert.ok(FIX.cases && FIX.cases.length >= 9, 'the pre-merge capture is present and complete');

// ⚠️ The `async` prefix has to come with it. Anchoring on "function NAME(" alone lifts an async
// function's body WITHOUT its async keyword, and the awaits inside it then fail to parse — which is
// how this helper first broke.
function lift(src, name) {
  let at = src.indexOf('function ' + name + '(');
  assert.ok(at > -1, `${name} found`);
  if (src.slice(Math.max(0, at - 6), at) === 'async ') at -= 6;
  let d = 0, i = src.indexOf('{', at);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(at, i);
}
const PROMPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'prompts.json'), 'utf8'));

// Everything the lifted functions close over. The model call is the only stub: identical replies go
// to both sides, so any difference in the result is the refactor's doing.
function build(src, names, extra) {
  const deps = ['callLLMQC', 'langName', 'PROMPTS', 'fillPrompt', 'stripRaw', 'buildGenMeta',
                'scriptPinNote', 'OLLAMA_QC_MODEL', 'getRequestTimeout', 'CANCELLED', 'console'];
  const body = names.map(n => lift(src, n)).join('\n')
    + (extra || '')
    + '\nreturn {' + names.join(', ') + '};';
  return (reply) => new Function(...deps, body)(
    async () => { const r = reply(); return { text: r, promptTokens: 11, completionTokens: 22 }; },
    (c) => ({ de: 'German', nl: 'Dutch', en: 'English' })[c] || c,
    PROMPTS,
    (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '{' + k + '}')),
    (s) => String(s).replace(/<think>[\s\S]*?<\/think>/g, ''),
    (o) => ({ type: o.type, model: o.model, valid: o.valid, promptTokens: o.promptTokens,
              completionTokens: o.completionTokens }),          // timing dropped: it cannot match
    () => '',                                                    // scriptPinNote: no script pinning
    'translategemma:12b', () => 60000, 'CANCELLED',
    { log(){}, warn(){} });
}

// ⚠️ buildGenMeta is stubbed identically on both sides, so meta compares directly. `mode` is a NEW
// field the old shape never had, so it is dropped before comparing — adding a field is not a
// behaviour change, and pretending otherwise would force the diff to fail for the wrong reason.
const norm = (o) => { const c = JSON.parse(JSON.stringify(o)); delete c.mode; return c; };

async function main() {

// ── 1-3. Every captured pre-merge output, reproduced by the merged engine ──────────────────────
// One loop over the fixture: heavy story QC (clean / corrected / rewrite / corrupt), heavy summary
// QC, and light extraction QC (first-try / retry-then-accept / give-up / empty-input). Each case
// replays its own recorded reply sequence, so the RETRY path is exercised as behaviour rather than
// as an internal detail.
{
  const heavyDeps = '\n' + lift(NEW, 'qcProse') + '\n' + lift(NEW, 'qcModeSpec') + '\n'
    + lift(NEW, 'classifyStoryQc') + '\n' + lift(NEW, '_qcCorruption') + '\n'
    + lift(NEW, 'storyDiffSentences') + '\n' + lift(NEW, 'splitSentences') + '\n' + lift(NEW, '_wordLev')
    + '\n' + lift(NEW, 'textNormaliseChanges') + '\n' + lift(NEW, '_surfaceKey') + '\n'
    + lift(NEW, '_lev') + '\n' + lift(NEW, '_lines') + '\n' + lift(NEW, 'shoutedRun')
    + '\nconst QC_MODES = ["light","heavy"];'
    + '\nconst QC_MAX_CHANGED_RATIO = ' + /QC_MAX_CHANGED_RATIO\s*=\s*([\d.]+)/.exec(NEW)[1] + ';'
    + '\nconst QC_MAX_WORD_EDIT_RATIO = ' + /QC_MAX_WORD_EDIT_RATIO\s*=\s*([\d.]+)/.exec(NEW)[1] + ';';

  const seen = {};
  for (const c of FIX.cases) {
    const F = build(NEW, [c.fn], heavyDeps);
    let n = 0;
    // ⚠️ The reply sequence is replayed exactly. A case whose fixture lists three replies is a case
    // whose pre-merge run took three attempts; collapsing that to one would silently stop testing
    // the retry loop.
    const next = () => {
      if (!c.reply.length) throw new Error('the model must not be called for this case');
      return c.reply[Math.min(n++, c.reply.length - 1)];
    };
    const got = await F(next)[c.fn](...c.args);
    assert.deepStrictEqual(norm(got), norm(c.result),
      `⚠️ ${c.fn} / ${c.name}: the merged engine does not reproduce the pre-merge output. ` +
      'The merge was supposed to preserve behaviour exactly.');
    seen[c.fn] = (seen[c.fn] || 0) + 1;
  }
  // Non-vacuity: the fixture really does cover all three entry points and all four heavy verdicts.
  assert.strictEqual(seen.generateStoryQc, 4, 'all four story verdicts were replayed');
  assert.strictEqual(seen.generateSummaryQc, 1, 'and the summary path');
  assert.strictEqual(seen.normaliseExtractedText, 4, 'and all four light paths');
  const verdicts = FIX.cases.filter(c => c.fn === 'generateStoryQc').map(c => c.result.verdict).sort();
  assert.deepStrictEqual(verdicts, ['clean', 'corrected', 'corrupt', 'rewrite'],
    '(sanity: the four fixtures really do produce four DIFFERENT verdicts — if they all landed on ' +
    "'corrected' the loop above would be comparing the same thing four times)");
  assert.strictEqual(FIX.cases.find(c => c.name === 'give-up').result.failed, true,
    "(sanity: the give-up fixture really did give up)");
  assert.strictEqual(FIX.cases.find(c => c.name === 'retry-then-accept').reply.length, 3,
    '(sanity: the retry fixture really does carry a multi-attempt reply sequence)');
}
console.log('  all 9 captured pre-merge outputs are reproduced exactly by the merged engine: OK');

// ⚠️ The error path is contract too, and cannot be captured as a return value: heavy THROWS on an
// empty answer rather than proposing one. Light does not — that asymmetry is deliberate (§4).
{
  const F = build(NEW, ['generateStoryQc'],
    '\n' + lift(NEW, 'qcProse') + '\n' + lift(NEW, 'qcModeSpec') + '\n' + lift(NEW, 'classifyStoryQc')
      + '\n' + lift(NEW, '_qcCorruption') + '\n' + lift(NEW, 'storyDiffSentences') + '\n'
      + lift(NEW, 'splitSentences') + '\n' + lift(NEW, '_wordLev') + '\n' + lift(NEW, 'textNormaliseChanges')
      + '\n' + lift(NEW, '_surfaceKey') + '\n' + lift(NEW, '_lev') + '\n' + lift(NEW, '_lines')
      + '\n' + lift(NEW, 'shoutedRun') + '\nconst QC_MODES = ["light","heavy"];'
      + '\nconst QC_MAX_CHANGED_RATIO = 0.5;\nconst QC_MAX_WORD_EDIT_RATIO = 0.5;');
  await assert.rejects(() => F(() => '').generateStoryQc('Ein Satz hier.', 'de', null),
    /empty correction/, 'heavy still throws on an empty model answer');
}
console.log('  heavy still throws on an empty answer, where light hands back the input: OK');

// ── 4. The modes are genuinely DIFFERENT behaviours, not a cosmetic flag ────────────────────────
// ⚠️ Non-vacuity for everything above: if both modes did the same thing, every parity check would
// pass while the feature was meaningless. Same input, same reply, different mode → different verdict.
{
  const F = build(NEW, ['qcProse', 'qcModeSpec'],
    '\n' + lift(NEW, 'classifyStoryQc') + '\n' + lift(NEW, '_qcCorruption')
      + '\n' + lift(NEW, 'storyDiffSentences') + '\n' + lift(NEW, 'splitSentences') + '\n' + lift(NEW, '_wordLev')
      + '\n' + lift(NEW, 'textNormaliseChanges') + '\n' + lift(NEW, '_surfaceKey') + '\n'
      + lift(NEW, '_lev') + '\n' + lift(NEW, '_lines') + '\nconst QC_MODES = ["light","heavy"];'
      + '\nconst QC_MAX_CHANGED_RATIO = ' + /QC_MAX_CHANGED_RATIO\s*=\s*([\d.]+)/.exec(NEW)[1] + ';'
      + '\nconst QC_MAX_WORD_EDIT_RATIO = ' + /QC_MAX_WORD_EDIT_RATIO\s*=\s*([\d.]+)/.exec(NEW)[1] + ';');
  // A reply that SWAPS A WORD: legitimate for a grammar fix, forbidden for a transcription.
  const src   = 'DER HUND LIEF SCHNELL';
  const swap  = 'Die Katze lief schnell';
  const heavy = await F(() => swap).qcProse(src, 'de', { mode: 'heavy', kind: 'story' });
  const light = await F(() => swap).qcProse(src, 'de', { mode: 'light', kind: 'text' });
  assert.strictEqual(heavy.corrected, swap, 'heavy ACCEPTS a word change — that is what it is for');
  assert.strictEqual(light.corrected, src,
    '⚠️ light REFUSES it and hands back the original — a transcription may not have its words changed');
  assert.strictEqual(light.failed, true, 'and reports that it could not do it');
  // And the mode really does pick a different PROMPT, not just a different check.
  const spec = F(() => '').qcModeSpec;
  assert.strictEqual(spec('light').prompt, 'textNormalise');
  assert.strictEqual(spec('heavy').prompt, 'storyQc');
  assert.notStrictEqual(spec('light').attempts, spec('heavy').attempts,
    'and a different retry policy — light retries with feedback, heavy takes one shot');
  // An unknown mode must fall back to the SAFE-for-prose default rather than silently doing nothing.
  assert.strictEqual(spec('nonsense').prompt, 'storyQc', 'an unknown mode falls back to heavy');
  // ⚠️ And the RESULT must say 'heavy', not echo the nonsense back. qcModeSpec already falls
  // through to heavy for any non-'light' value, so the behaviour is safe either way — but the
  // reported `mode` is what the ledger and the UI read, and a result labelled with a mode that does
  // not exist is a lie about which contract ran. (Found by a mutation that stayed green.)
  const odd = await F(() => 'Der Hund lief schnell.').qcProse('DER HUND LIEF SCHNELL', 'de',
    { mode: 'nonsense', kind: 'story' });
  assert.strictEqual(odd.mode, 'heavy', 'an unknown mode is REPORTED as the heavy it actually ran as');
}
console.log('  the two modes are genuinely different behaviours, not a cosmetic flag: OK');

// ── 5. The ERROR path, which is contract and was never asserted (v90_e) ─────────────────────────
//
// ⚠️ Found by the branch-mutation probe: nine of qcProse's sixteen branch mutants survived this
// file, and all nine live here — the cancel re-throw, the heavy-surfaces / light-retries asymmetry,
// the attempt counter, the script-pin gate and the empty-input throw. Every one of them is a
// deliberate decision with a comment in server.js explaining it, and none of them had a test. The
// parity fixtures above cannot reach them: a captured RETURN VALUE cannot record a throw.
{
  // A builder of its own, because these cases need what the parity one deliberately does not give:
  // a stub that can THROW, a call counter, and a scriptPinNote that leaves a visible mark.
  const calls = [];
  const mk = (behave, pin) => {
    const deps = ['callLLMQC', 'langName', 'PROMPTS', 'fillPrompt', 'stripRaw', 'buildGenMeta',
                  'scriptPinNote', 'OLLAMA_QC_MODEL', 'getRequestTimeout', 'CANCELLED', 'console'];
    const body = lift(NEW, 'qcProse') + '\n' + lift(NEW, 'qcModeSpec') + '\n'
      + lift(NEW, 'classifyStoryQc') + '\n' + lift(NEW, '_qcCorruption') + '\n'
      + lift(NEW, 'storyDiffSentences') + '\n' + lift(NEW, 'splitSentences') + '\n'
      + lift(NEW, '_wordLev') + '\n' + lift(NEW, 'textNormaliseChanges') + '\n'
      + lift(NEW, '_surfaceKey') + '\n' + lift(NEW, '_lev') + '\n' + lift(NEW, '_lines') + '\n'
      + lift(NEW, 'shoutedRun') + '\nconst QC_MODES = ["light","heavy"];'
      + '\nconst QC_MAX_CHANGED_RATIO = 0.5;\nconst QC_MAX_WORD_EDIT_RATIO = 0.5;'
      + '\nreturn { qcProse, qcModeSpec };';
    return new Function(...deps, body)(
      // the shape callLLMQC really returns — a bare string here makes every reply read as EMPTY,
      // which is a different branch than the one under test
      async (sys, user) => { calls.push({ sys, user });
        return { text: behave(calls.length), promptTokens: 11, completionTokens: 22 }; },
      (c) => ({ de: 'German', sr: 'Serbian' })[c] || c,
      PROMPTS,
      (t, v) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : '{' + k + '}')),
      (x) => String(x), (o) => o,
      pin || (() => ''),
      'translategemma:12b', () => 60000, 'CANCELLED', { log(){}, warn(){} });
  };
  const spec = mk(() => '').qcModeSpec;
  const qc = (behave, pin) => mk(behave, pin).qcProse;
  const reset = () => { calls.length = 0; };
  const boom = () => { throw new Error('connection reset'); };
  const cancel = () => { throw new Error('CANCELLED'); };

  // ── a CANCEL propagates and is never retried (v88_k: a cancel is not a failure) ──
  reset();
  await assert.rejects(() => qc(cancel)('Ein Satz hier.', 'de', { mode: 'light' }), /CANCELLED/,
    'light re-throws a cancel instead of swallowing it into a "left unchanged" result');
  assert.strictEqual(calls.length, 1,
    '⚠️ and does NOT retry it — a cancelled job that retries twice more is a job that ignores cancel');

  // ── a REAL failure: heavy surfaces it, light retries and then gives the input back ──
  reset();
  await assert.rejects(() => qc(boom)('Ein Satz hier.', 'de', { mode: 'heavy', kind: 'story' }),
    /connection reset/, 'heavy surfaces a model error to its caller');
  assert.strictEqual(calls.length, 1, 'heavy takes one shot');

  reset();
  const soft = await qc(boom)('Ein Satz hier.', 'de', { mode: 'light' });
  assert.strictEqual(soft.failed, true, 'light does NOT throw — it reports failure');
  assert.strictEqual(soft.corrected, 'Ein Satz hier.',
    '⚠️ and hands the input back untouched: this mode runs unattended inside the extraction job, ' +
    'where a throw would cost the panel its transcription');
  assert.ok(/connection reset/.test(String(soft.note)), 'the reason is carried, not swallowed');
  assert.strictEqual(calls.length, spec('light').attempts,
    `and it retried exactly as many times as the mode spec allows (${calls.length}) — no more, and ` +
    'not once: an unattended job that gives up on the first blip loses text it could have had');

  // ── the retry carries FEEDBACK naming what was wrong, or the second attempt is the first again ──
  reset();
  const fed = await qc((n) => (n === 1 ? 'Ein Satz hier. Und noch einer.' : 'Ein Satz hier.'))(
    'Ein Satz hier.', 'de', { mode: 'light' });
  assert.strictEqual(fed.corrected, 'Ein Satz hier.', 'a rejected first attempt is followed by an accepted one');
  assert.ok(/REJECTED/.test(calls[1].user), 'the retry tells the model its previous answer was rejected');
  assert.ok(/words/.test(calls[1].user), 'and names the actual problem (a word count that changed)');

  // ── the script pin is HEAVY + STORY only (v79_f) ──
  const PIN = '[[SCRIPT-PIN]]';
  const pinned = () => PIN;
  for (const [mode, kind, want] of [['heavy', 'story', true], ['heavy', 'summary', false],
                                    ['light', 'text', false], ['light', 'story', false]]) {
    reset();
    try { await qc(() => 'Ein Satz hier.', pinned)('Ein Satz hier.', 'sr', { mode, kind }); } catch (_) {}
    assert.strictEqual(calls[0].sys.includes(PIN), want,
      `${mode}/${kind}: the script pin is ${want ? 'present' : 'absent'} — light cannot change a ` +
      'word at all, so it has nothing to transliterate with');
  }

  // ── empty input is refused outright, in both modes ──
  for (const mode of ['light', 'heavy']) {
    reset();
    await assert.rejects(() => qc(() => 'x')('   \n  ', 'de', { mode }), /empty text/,
      `${mode}: whitespace-only input is refused before the model is called`);
    assert.strictEqual(calls.length, 0, `${mode}: and no request goes out for it`);
  }
}
console.log('  the error path: cancel propagates, heavy throws, light degrades, pin is heavy+story: OK');

console.log('unit-qc-unify-parity: ALL PASSED');
}
main().catch(e => { console.error(e); process.exit(1); });
