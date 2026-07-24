// lib-dom.js — a minimal, zero-dependency DOM stub for RENDER SMOKE TESTS (v69_k).
//
// Why this exists: two runtime errors reached the user through a fully green suite — the v68.1
// temporal-dead-zone crash in showComplete (every completion card), and v69_i's "sl is not defined"
// in _renderStorylineScreen (every storyline open). Both were in render paths, and both were
// invisible to source-level assertions: a regex over the source cannot see scope or execution
// order. The only thing that catches that class is EXECUTING the code.
//
// This is deliberately NOT a DOM implementation. It is the smallest surface that lets the client's
// render functions run to completion so that reference errors, TDZ violations, bad property access
// and thrown exceptions surface. Layout, styling and event dispatch are out of scope — if a test
// needs those, it needs a real browser.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

function makeElement(tag = 'div', id = '') {
  const el = {
    tagName: String(tag).toUpperCase(), id, nodeType: 1,
    style: {}, dataset: {}, children: [], childNodes: [],
    _html: '', textContent: '', value: '', checked: false, disabled: false,
    className: '', title: '', href: '', src: '', download: '',
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { const has = this._s.has(c); const want = (on === undefined) ? !has : !!on; want ? this._s.add(c) : this._s.delete(c); return want; },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { this.children.push(c); this.childNodes.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    remove() {},
    // Queries return fresh stubs rather than parsing innerHTML: render code commonly does
    // `el.querySelector(...)?.something`, and a null would mask the very errors we want to see.
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
    closest() { return makeElement(); },
    getAttribute() { return null; }, setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, select() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 20 }; },
    animate() { return { finished: Promise.resolve(), cancel() {} }; },
    insertAdjacentHTML() {},
    insertAdjacentElement(pos, el) { this.children.push(el); return el; },
    insertAdjacentText() {},
    replaceChildren() { this.children = []; },
    contains() { return false; },
    matches() { return false; },
    cloneNode() { return makeElement(this.tagName, this.id); },
  };
  // innerHTML is a real property: assigning it is what most render paths DO, and the assignment
  // must be observable so a test can assert something was rendered.
  Object.defineProperty(el, 'innerHTML', { get() { return el._html; }, set(v) { el._html = String(v == null ? '' : v); }, enumerable: true });
  Object.defineProperty(el, 'outerHTML', { get() { return el._html; }, enumerable: true });
  Object.defineProperty(el, 'firstChild', { get() { return el.children[0] || null; } });
  Object.defineProperty(el, 'parentNode', { get() { return el._parent || null; }, set(v) { el._parent = v; } });
  Object.defineProperty(el, 'offsetWidth', { get() { return 100; } });
  Object.defineProperty(el, 'offsetHeight', { get() { return 20; } });
  return el;
}

function makeDocument() {
  const byId = new Map();
  const doc = {
    readyState: 'complete',
    // Auto-vivify: any id the client asks for exists. Enumerating the real id list would make the
    // harness fragile against markup changes, and a null return would hide errors behind
    // `if (el)` guards rather than exposing them.
    getElementById(id) { if (!byId.has(id)) byId.set(id, makeElement('div', id)); return byId.get(id); },
    createElement(tag) { return makeElement(tag); },
    createTextNode(t) { return { nodeType: 3, textContent: String(t) }; },
    createDocumentFragment() { return makeElement('fragment'); },
    querySelector() { return makeElement(); },
    querySelectorAll() { return []; },
    getElementsByClassName() { return []; },
    getElementsByTagName() { return []; },
    addEventListener() {}, removeEventListener() {},
    execCommand() { return true; },
    _ids: byId,
  };
  doc.body = makeElement('body');
  doc.head = makeElement('head');
  doc.documentElement = makeElement('html');
  return doc;
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

/**
 * Load the client engine from index.html into a fresh sandbox.
 * Returns { ctx, run, document, calls } where run(code) evaluates in the SAME context, so the
 * client's top-level `const`/`let` (APP, helpers) are visible to test code.
 */
function loadClient(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('could not find the inline client script');
  // Strip ONLY the bootstrap call. Everything else — every function and top-level statement — is
  // evaluated exactly as shipped. init() is async and network-bound; running it would test the
  // stubs, not the client.
  let src = m[1].replace(/\ninit\(\);\s*$/, '\n/* init() suppressed by the smoke harness */\n');
  if (/\ninit\(\);/.test(src.slice(-200))) throw new Error('bootstrap call not neutralised — harness would run init()');

  const doc = makeDocument();
  const calls = { fetch: [], toasts: [], errors: [] };
  const sandbox = {
    console: opts.quiet ? { log() {}, warn() {}, error(...a) { calls.errors.push(a.join(' ')); }, info() {}, debug() {} } : console,
    document: doc,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    Promise, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Map, Set, WeakMap, Error,
    Intl, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, parseInt, parseFloat, isNaN, isFinite,
    TextEncoder, TextDecoder, structuredClone,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: (h) => clearTimeout(h),
    fetch: (url, init) => { calls.fetch.push({ url, init }); return Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '' }); },
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    Blob: function Blob() {},
    navigator: { language: 'en', languages: ['en'], userAgent: 'smoke', clipboard: { writeText: async () => {} } },
    speechSynthesis: { getVoices: () => [], speak() {}, cancel() {}, pause() {}, resume() {}, addEventListener() {} },
    SpeechSynthesisUtterance: function SpeechSynthesisUtterance() { return { addEventListener() {} }; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    alert() {}, confirm: () => true, prompt: () => null,
    history: { pushState() {}, replaceState() {}, back() {} },
    location: { hash: '', href: 'http://localhost/', search: '', pathname: '/', reload() {} },
    AbortController: function AbortController() { return { signal: {}, abort() {} }; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    CSS: { escape: (s) => String(s) },
    _smoke: calls,
  };
  // The client registers listeners on window at top level; the sandbox IS the global object, so it
  // needs the EventTarget-ish surface too.
  sandbox.addEventListener = () => {};
  sandbox.removeEventListener = () => {};
  sandbox.dispatchEvent = () => true;
  sandbox.scrollTo = () => {}; sandbox.scroll = () => {}; sandbox.scrollBy = () => {};
  sandbox.innerWidth = 390; sandbox.innerHeight = 844; sandbox.devicePixelRatio = 2;  // phone-sized
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(src, ctx, { filename: 'index.html:client', displayErrors: true });
  return {
    ctx, calls, document: doc, sandbox,
    run: (code, name) => vm.runInContext(code, ctx, { filename: name || 'smoke', displayErrors: true }),
  };
}

module.exports = { loadClient, makeElement, makeDocument, ROOT };
