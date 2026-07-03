// unit-wordforms-syn-rtl.test.js
// Bug (v49): the word_forms cloze sentence (sentenceMcqCard) and the synonyms context
// sentence / gloss / choice tiles (tSynSelect) rendered LTR-aligned for Arabic content —
// their divs were built with inline styles and never joined the v48 content-aware
// dir="auto" model. Each must carry dir="auto" + text-align:start so RTL text
// right-aligns while an English hint in the same card stays left-aligned.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// sentenceMcqCard: the sentence div (shared by word_forms) is content-aware.
const cardFn = html.slice(html.indexOf('function sentenceMcqCard('),
                          html.indexOf('function tWordForm('));
assert.ok(/const sent = sentenceHtml \? `<div dir="auto"[^`]*text-align:start/.test(cardFn),
  'sentenceMcqCard sentence div carries dir="auto" + text-align:start');

// tSynSelect: context sentence, gloss, and every tile are content-aware.
const synFn = html.slice(html.indexOf('function tSynSelect('),
                         html.indexOf('function synToggle('));
assert.ok(/sentenceHtml = `<div dir="auto"[^`]*text-align:start/.test(synFn),
  'tSynSelect context-sentence div carries dir="auto" + text-align:start');
assert.ok(/const gloss = ex\.gloss \? `<div dir="auto"[^`]*text-align:start/.test(synFn),
  'tSynSelect gloss div carries dir="auto" + text-align:start');
assert.ok(/class="syn-tile" dir="auto"/.test(synFn),
  'synonym choice tiles (.syn-tile) carry dir="auto"');

// Guard against regressing to dir-less containers in these renderers.
assert.ok(!/<div style="font-size:18px;font-weight:700/.test(html),
  'no dir-less sentenceMcqCard sentence div remains');
assert.ok(!/class="syn-tile" id=/.test(html),
  'no dir-less syn-tile remains');

console.log('  word_forms + synonyms sentence/gloss/tiles are content-aware RTL: OK');
console.log('unit-wordforms-syn-rtl: ALL PASSED');
