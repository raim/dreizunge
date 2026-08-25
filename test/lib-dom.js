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

// ─────────────────────────────────────────────────────────────────────────────
// v73_c — runtime innerHTML parsing.
//
// Until now `innerHTML` was stored as a string and never parsed, so `querySelectorAll` returned []
// and `getElementById` handed back an auto-vivified stub rather than the node the markup describes.
// index.html assigns innerHTML in 122 places, so everything rendered that way — every picker, every
// tick-list, every dynamically built card — could only be tested by regexing the markup string.
// That is why ~36% of the suite's assertions match source text rather than behaviour.
//
// What is parsed here is not HTML5. It is the markup THIS app emits, which is machine-generated and
// well-formed. Measured against index.html, that means it must handle: bare boolean attributes
// (`disabled`, `checked`, `selected` — 104 sites), unquoted attribute values (28), `data-*` (203),
// and 144 `onclick` handlers whose JavaScript can contain `>` and `/`. The last one rules out a
// regex tokenizer, so this is a character scanner that tracks quoting.
// ─────────────────────────────────────────────────────────────────────────────

// Elements that never have children. An unterminated <br> must not swallow the rest of the markup.
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
                           'meta', 'param', 'source', 'track', 'wbr']);
// Content is text, not markup: a '<' inside a script body is not a tag.
const RAW_TEXT_TAGS = new Set(['script', 'style']);
// Attributes the DOM reflects as booleans. Render code and tests read `el.disabled === true`, so an
// attribute string has to become a real boolean or half the suite disagrees with the other half.
const BOOL_ATTRS = new Set(['disabled', 'checked', 'selected', 'readonly', 'required', 'hidden',
                            'multiple', 'open', 'autofocus', 'novalidate']);
// Attributes reflected onto same-named string properties, matching the fields makeElement exposes.
const PROP_ATTRS = new Set(['value', 'title', 'href', 'src', 'download', 'type', 'placeholder',
                            'name', 'alt', 'target', 'lang', 'dir', 'role']);

// The app escapes with esc()/escAttr(), so text and attribute values arrive encoded. Decoding is
// deliberately limited to what those produce plus the few literals the templates contain — a full
// entity table would be language knowledge of a different kind, and is not needed here.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'", '#x27': "'" };
function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (Object.prototype.hasOwnProperty.call(ENTITIES, body)) return ENTITIES[body];
    if (body[0] === '#') {
      const n = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return whole;
  });
}

const camel = (s) => String(s).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// `style="display:none;color:red"` has to land on el.style.display, because that is what both the
// render code and the existing assertions use.
function applyStyleString(el, text) {
  String(text).split(';').forEach(decl => {
    const i = decl.indexOf(':');
    if (i < 0) return;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (k) el.style[camel(k)] = v;
  });
}

// Reflect one parsed attribute onto both the attribute store and the property the rest of lib-dom
// already exposes. Keeping BOTH in step is the point: render code sets properties, markup carries
// attributes, and tests read whichever they happened to be written against.
function applyParsedAttribute(el, rawName, rawValue, doc) {
  const name = String(rawName);
  const value = decodeEntities(rawValue);
  el._attrs[name] = value;
  const lower = name.toLowerCase();
  if (lower === 'id') {
    el.id = value;
    if (doc && doc._ids && !doc._ids.has(value)) doc._ids.set(value, el);
  } else if (lower === 'class') {
    el.className = value;
    value.split(/\s+/).filter(Boolean).forEach(c => el.classList._s.add(c));
  } else if (lower === 'style') {
    applyStyleString(el, value);
  } else if (lower.startsWith('data-')) {
    el.dataset[camel(lower.slice(5))] = value;
  } else if (BOOL_ATTRS.has(lower)) {
    // Present-but-empty is TRUE in HTML (`<button disabled>`); only disabled="false" is false.
    el[lower] = !(value === 'false');
  } else if (PROP_ATTRS.has(lower)) {
    el[lower] = value;
  }
}

/**
 * Parse `markup` into child nodes of `parent`.
 *
 * Identity rule, and the one real deviation from a browser: when parsed markup carries an id that
 * document.getElementById has ALREADY vivified, the existing element object is reused and reset in
 * place rather than replaced. A browser would create a new node. Reuse is chosen because the whole
 * harness contract — "getElementById persists stubs, which is what makes interaction testable" —
 * depends on a test's reference staying live across a re-render. Replacing would silently orphan
 * every reference held before the render, which is a far worse failure than the one it fixes.
 */
function parseHtmlInto(markup, parent, doc) {
  const s = String(markup == null ? '' : markup);
  const stack = [parent];
  const top = () => stack[stack.length - 1];
  let i = 0, pendingText = '';

  const flushText = () => {
    if (!pendingText) return;
    const t = decodeEntities(pendingText);
    pendingText = '';
    // Whitespace-only runs between tags are structurally meaningless in generated markup and would
    // otherwise pad every textContent read with the template's own indentation.
    if (!t.trim()) return;
    top()._text += t;
    top().childNodes.push({ nodeType: 3, textContent: t });
  };

  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { pendingText += s.slice(i); break; }
    pendingText += s.slice(i, lt);

    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt); i = e < 0 ? s.length : e + 3; continue; }
    if (s.startsWith('<!', lt) || s.startsWith('<?', lt)) { const e = s.indexOf('>', lt); i = e < 0 ? s.length : e + 1; continue; }

    // Closing tag: pop to the matching open element, so stray closers cannot unwind the stack past
    // the element we were asked to fill.
    if (s[lt + 1] === '/') {
      const e = s.indexOf('>', lt);
      const name = s.slice(lt + 2, e < 0 ? s.length : e).trim().toLowerCase();
      flushText();
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tagName === name.toUpperCase()) { stack.length = k; break; }
      }
      i = e < 0 ? s.length : e + 1;
      continue;
    }

    // Opening tag. A bare '<' that is not a tag start is literal text.
    const nameMatch = /^<([A-Za-z][\w:.-]*)/.exec(s.slice(lt, lt + 64));
    if (!nameMatch) { pendingText += '<'; i = lt + 1; continue; }
    flushText();
    const tag = nameMatch[1];
    let p = lt + 1 + tag.length;
    const attrs = [];
    let selfClose = false;

    // Attribute loop. Quote tracking is what makes an onclick containing '>' safe.
    while (p < s.length) {
      while (p < s.length && /\s/.test(s[p])) p++;
      if (s[p] === '>') { p++; break; }
      if (s[p] === '/' && s[p + 1] === '>') { selfClose = true; p += 2; break; }
      if (p >= s.length) break;
      const nStart = p;
      while (p < s.length && !/[\s=/>]/.test(s[p])) p++;
      const aName = s.slice(nStart, p);
      if (!aName) { p++; continue; }
      let aVal = '';
      let q = p;
      while (q < s.length && /\s/.test(s[q])) q++;
      if (s[q] === '=') {
        q++;
        while (q < s.length && /\s/.test(s[q])) q++;
        const quote = s[q];
        if (quote === '"' || quote === "'") {
          const end = s.indexOf(quote, q + 1);
          aVal = s.slice(q + 1, end < 0 ? s.length : end);
          p = end < 0 ? s.length : end + 1;
        } else {
          const vStart = q;
          while (q < s.length && !/[\s>]/.test(s[q])) q++;
          aVal = s.slice(vStart, q);
          p = q;
        }
      }
      attrs.push([aName, aVal]);
    }

    const lowerTag = tag.toLowerCase();
    // An id that already exists is reused rather than duplicated — see the identity rule above.
    const idAttr = attrs.find(a => a[0].toLowerCase() === 'id');
    let el;
    if (idAttr && doc && doc._ids && doc._ids.has(idAttr[1])) {
      el = doc._ids.get(idAttr[1]);
      resetElement(el, tag);
    } else {
      el = makeElement(tag, '', doc);
    }
    attrs.forEach(([k, v]) => applyParsedAttribute(el, k, v, doc));
    top().appendChild(el);

    if (RAW_TEXT_TAGS.has(lowerTag)) {
      const close = s.toLowerCase().indexOf(`</${lowerTag}`, p);
      const body = s.slice(p, close < 0 ? s.length : close);
      el._text = body;
      i = close < 0 ? s.length : s.indexOf('>', close) + 1;
      continue;
    }
    if (!selfClose && !VOID_TAGS.has(lowerTag)) stack.push(el);
    i = p;
  }
  flushText();
  return parent;
}

// v85_b — a plain `{}` already let every existing test read/write named properties directly
// (`el.style.display = 'none'`, `el.style.bottom`, …); `--custom-property` names work exactly the
// same way as a plain JS object key, so `setProperty`/`getPropertyValue`/`removeProperty` are thin
// wrappers over that SAME storage, not a step toward real CSS resolution (calc(), cascade, computed
// values stay explicitly out of scope per the file header — `getComputedStyle` below is unaffected).
function makeStyle() {
  return {
    setProperty(name, value) { this[name] = value; },
    getPropertyValue(name) { const v = this[name]; return v === undefined ? '' : v; },
    removeProperty(name) { const v = this[name]; delete this[name]; return v === undefined ? '' : v; },
  };
}

// Clear an element for reuse, without replacing the object (identity rule) and without touching the
// method surface, which callers may already hold references to.
function resetElement(el, tag) {
  el.tagName = String(tag).toUpperCase();
  el.children = [];
  el.childNodes = [];
  el._text = '';
  el._html = '';
  el._attrs = {};
  el.className = '';
  el.classList._s.clear();
  el.dataset = {};
  el.disabled = false;
  el.checked = false;
  el.value = '';
  el.style = makeStyle();
  return el;
}

// ── Selector engine ──────────────────────────────────────────────────────────
// Supports what the app's own render and test code uses: tag, #id, .class, [attr], [attr="v"],
// comma lists, and the descendant / child combinators. Not a CSS implementation — no pseudo-classes
// beyond :scope, no sibling combinators. Anything richer needs a real browser, per the file header.
function parseCompound(text) {
  const c = { tag: '', id: '', classes: [], attrs: [], scope: false };
  String(text).replace(/:scope|#[\w-]+|\.[\w-]+|\[[^\]]+\]|^[*A-Za-z][\w:-]*/g, (tok) => {
    if (tok === ':scope') c.scope = true;
    else if (tok[0] === '#') c.id = tok.slice(1);
    else if (tok[0] === '.') c.classes.push(tok.slice(1));
    else if (tok[0] === '[') {
      const m = /^\[\s*([\w:-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]$/.exec(tok);
      if (m) c.attrs.push({ name: m[1], op: m[2] || '', value: m[3] ?? m[4] ?? m[5] ?? null });
    } else if (tok !== '*') c.tag = tok.toUpperCase();
    return tok;
  });
  return c;
}
function matchesCompound(el, c) {
  if (!el || el.nodeType !== 1) return false;
  if (c.tag && el.tagName !== c.tag) return false;
  if (c.id && el.id !== c.id) return false;
  if (c.classes.some(k => !el.classList._s.has(k))) return false;
  for (const a of c.attrs) {
    const have = Object.prototype.hasOwnProperty.call(el._attrs, a.name) ? el._attrs[a.name] : null;
    if (have === null) return false;
    if (a.value === null) continue;
    if (a.op === '=' && have !== a.value) return false;
    if (a.op === '^=' && !have.startsWith(a.value)) return false;
    if (a.op === '$=' && !have.endsWith(a.value)) return false;
    if (a.op === '*=' && !have.includes(a.value)) return false;
    if (a.op === '~=' && !have.split(/\s+/).includes(a.value)) return false;
  }
  return true;
}
// One comma-free selector, e.g. "div.card > button#go". Matched right-to-left from `el`.
function matchesSequence(el, seq, root) {
  let idx = seq.length - 1;
  if (!matchesCompound(el, seq[idx].sel)) return false;
  let node = el;
  for (idx--; idx >= 0; idx--) {
    const step = seq[idx + 1];
    if (seq[idx].sel.scope) { return step.combinator === '>' ? node.parentNode === root : true; }
    if (step.combinator === '>') {
      node = node.parentNode;
      if (!node || !matchesCompound(node, seq[idx].sel)) return false;
    } else {
      let a = node.parentNode, ok = false;
      while (a) { if (matchesCompound(a, seq[idx].sel)) { ok = true; break; } a = a.parentNode; }
      if (!ok) return false;
      node = a;
    }
  }
  return true;
}
function parseSelector(sel) {
  return String(sel || '').split(',').map(part => {
    const seq = [];
    let combinator = ' ';
    part.trim().split(/\s*(>)\s*|\s+/).filter(Boolean).forEach(tok => {
      if (tok === '>') { combinator = '>'; return; }
      seq.push({ sel: parseCompound(tok), combinator });
      combinator = ' ';
    });
    return seq;
  }).filter(seq => seq.length);
}
function descendants(root, out = []) {
  for (const c of root.children || []) { if (c && c.nodeType === 1) { out.push(c); descendants(c, out); } }
  return out;
}
function selectAll(root, sel) {
  const groups = parseSelector(sel);
  if (!groups.length) return [];
  const pool = descendants(root);
  return pool.filter(el => groups.some(seq => matchesSequence(el, seq, root)));
}

function makeElement(tag = 'div', id = '', doc = null) {
  const el = {
    tagName: String(tag).toUpperCase(), id, nodeType: 1, _doc: doc,
    style: makeStyle(), dataset: {}, children: [], childNodes: [],
    _html: '', _text: '', value: '', checked: false, disabled: false, _attrs: {},
    className: '', title: '', href: '', src: '', download: '',
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { const has = this._s.has(c); const want = (on === undefined) ? !has : !!on; want ? this._s.add(c) : this._s.delete(c); return want; },
      contains(c) { return this._s.has(c); },
    },
    appendChild(c) { if (c && c.nodeType === 1) c._parent = this; this.children.push(c); this.childNodes.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); this.childNodes = this.childNodes.filter(x => x !== c); return c; },
    insertBefore(c) { if (c && c.nodeType === 1) c._parent = this; this.children.unshift(c); this.childNodes.unshift(c); return c; },
    remove() { const p = this._parent; if (p) p.removeChild(this); },
    // v73_c: real matching over the parsed tree.
    //
    // querySelectorAll now returns actual nodes — it used to return [] unconditionally, so it could
    // only ever have been asserted on vacuously.
    //
    // querySelector keeps the auto-vivifying stub as its MISS case, deliberately. Render code
    // routinely does `el.querySelector('.x').textContent = y`, and returning null on a miss would
    // turn every gap in this parser into a thrown TypeError inside product code — a false alarm
    // that looks exactly like a real defect. A test that needs to assert absence should use
    // `querySelectorAll(sel).length === 0`, which is now meaningful.
    querySelector(sel) { return selectAll(this, sel)[0] || makeElement('div', '', this._doc); },
    querySelectorAll(sel) { return selectAll(this, sel); },
    closest(sel) {
      const groups = parseSelector(sel);
      let n = this;
      while (n && n.nodeType === 1) {
        if (groups.some(seq => matchesCompound(n, seq[seq.length - 1].sel))) return n;
        n = n.parentNode;
      }
      return null;
    },
    // Attributes are STORED (v70_g). They used to be no-ops returning null, which meant a render
    // could set an aria-label and no test could ever see it — accessible names were structurally
    // untestable. unit-report-edits had to hand-roll its own attribute store to work around this.
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k) ? el._attrs[k] : null; },
    setAttribute(k, v) { el._attrs[k] = String(v); },
    removeAttribute(k) { delete el._attrs[k]; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k); },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    focus() {}, blur() {}, click() {}, scrollIntoView() {}, select() {},
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 20 }; },
    animate() { return { finished: Promise.resolve(), cancel() {} }; },
    insertAdjacentHTML() {},
    insertAdjacentElement(pos, el) { this.children.push(el); this.childNodes.push(el); return el; },
    insertAdjacentText() {},
    // ChildNode.after/before insert siblings. The stub has no real tree, so they behave like the
    // adjacent-insert stubs above: accept the nodes, run no layout. Enough for code that appends a
    // results panel after an element (e.g. ehCheck) without needing it queried back.
    after(...nodes) { const p = (this.parentNode || this), n = nodes.filter(n => typeof n === 'object'); p.children.push(...n); p.childNodes.push(...n); },
    before(...nodes) { const p = (this.parentNode || this), n = nodes.filter(n => typeof n === 'object'); p.children.push(...n); p.childNodes.push(...n); },
    replaceChildren() { this.children = []; this.childNodes = []; },
    contains() { return false; },
    matches() { return false; },
    cloneNode() { return makeElement(this.tagName, this.id); },
  };
  // innerHTML is a real property: assigning it is what most render paths DO, and the assignment
  // must be observable so a test can assert something was rendered.
  // v73_c: the assignment now also PARSES. The raw string is still kept and still returned by the
  // getter, so every existing markup-string assertion keeps working unchanged — the parsed tree is
  // additive. That is what makes this migration incremental rather than a flag day.
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) {
      el._html = String(v == null ? '' : v);
      el.children = [];
      el.childNodes = [];
      el._text = '';
      parseHtmlInto(el._html, el, el._doc);
    },
    enumerable: true,
  });
  // textContent follows the DOM: reading concatenates descendant text, writing replaces children.
  // Before v73_c it was a plain field, so an element filled via innerHTML reported '' — which is
  // exactly why card titles and button labels could only be checked by regexing markup.
  //
  // Text has to be walked via childNodes, in document order, NOT via `_text` + children. `_text`
  // (set by flushText in parseHtmlInto) accumulates ALL of an element's own text — both before AND
  // after its child elements — into one blob, so a naive "_text then children" walk always put
  // trailing text ahead of interleaved children's text. childNodes preserves the real interleaving:
  // parseHtmlInto pushes a text node the instant it flushes, right where it occurred, and element
  // children go in via appendChild at the point they open. Elements with no childNodes (raw
  // <script>/<style> bodies, or textContent set directly) fall back to `_text`, which is exactly
  // their whole content in those cases.
  Object.defineProperty(el, 'textContent', {
    get() {
      const walk = (n) => {
        if (n.nodeType === 3) return n.textContent || '';
        if (!n.childNodes || !n.childNodes.length) return n._text || '';
        return n.childNodes.reduce((acc, c) => acc + walk(c), '');
      };
      return walk(el);
    },
    set(v) { el._text = String(v == null ? '' : v); el.children = []; el.childNodes = []; el._html = ''; },
    enumerable: true,
  });
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
    getElementById(id) { if (!byId.has(id)) byId.set(id, makeElement('div', id, doc)); return byId.get(id); },
    createElement(tag) { return makeElement(tag, '', doc); },
    createTextNode(t) { return { nodeType: 3, textContent: String(t) }; },
    createDocumentFragment() { return makeElement('fragment', '', doc); },
    createElementNS(ns, tag) { return makeElement(tag, '', doc); },
    // v71_k: adopt a parsed node into this document. The client uses it to move a storyboard from
    // a DOMParser document into the page in one step; a deep clone is the whole observable
    // behaviour, since this stub has no per-document node ownership to transfer.
    importNode(node, deep) { return node && node.cloneNode ? node.cloneNode(deep !== false) : node; },
    // v73_c: document-level queries search every root the client actually renders into. That is
    // body PLUS every element handed out by getElementById — the client renders into those and
    // never attaches them to body, so searching body alone would find almost nothing.
    querySelector(sel) { return doc._selectAll(sel)[0] || makeElement('div', '', doc); },
    querySelectorAll(sel) { return doc._selectAll(sel); },
    getElementsByClassName(c) { return doc._selectAll('.' + c); },
    getElementsByTagName(t) { return doc._selectAll(t); },
    _selectAll(sel) {
      const seen = new Set(), out = [];
      const roots = [doc.body, doc.head, doc.documentElement, ...byId.values()];
      for (const r of roots) {
        if (!r) continue;
        // A registered element is itself a candidate, not just its subtree: the client asks for
        // '#comp-next' by id after a render that created it inside another element's innerHTML.
        for (const el of [r, ...selectAll(r, sel)]) {
          if (el === r && !selectAll({ children: [r] }, sel).includes(r)) continue;
          if (!seen.has(el)) { seen.add(el); out.push(el); }
        }
      }
      return out;
    },
    addEventListener() {}, removeEventListener() {},
    execCommand() { return true; },
    _ids: byId,
  };
  doc.body = makeElement('body');
  doc.head = makeElement('head');
  doc.documentElement = makeElement('html');
  return doc;
}

// v71_k: the smallest XML parser that lets SVG render paths RUN rather than be swallowed by their
// own try/catch. `_renderCompStoryboard` walks a parsed storyboard — top-level <g> panels, each
// with a direct-child <rect> border — and without a DOMParser it threw on line one and the catch
// hid it, so a smoke test would have passed while executing nothing.
//
// Scope is deliberately tiny: elements, attributes, self-closing tags, comments. No text nodes, no
// namespaces, no entity decoding. That covers machine-composed storyboards (composeStoryboardSVG
// emits exactly this shape) and nothing else. Anything richer needs a real browser, per the note
// at the top of this file.
function parseXmlElements(text) {
  const root = makeElement('#document');
  const stack = [root];
  const tagRe = /<(\/)?([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/)?>/g;
  const src = String(text || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '');
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const [, closing, name, attrText, selfClose] = m;
    if (closing) { if (stack.length > 1) stack.pop(); continue; }
    const el = makeElement(name);
    const attrRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = attrRe.exec(attrText || '')) !== null) el.setAttribute(a[1], a[2] !== undefined ? a[2] : a[3]);
    // Real matching for the two selector shapes SVG render paths use. Everything else keeps the
    // auto-vivifying stub behaviour so unrelated code is unaffected.
    el.querySelector = function (sel) {
      const s = String(sel || '').trim();
      const direct = s.replace(/^:scope\s*>\s*/, '');
      const wantDirect = /^:scope\s*>/.test(s);
      const tag = direct.toUpperCase();
      const hit = this.children.find(c => c.tagName === tag);
      if (hit || wantDirect) return hit || null;
      const walk = n => {
        for (const c of n.children) { if (c.tagName === tag) return c; const d = walk(c); if (d) return d; }
        return null;
      };
      return walk(this);
    };
    el.querySelectorAll = function (sel) {
      const tag = String(sel || '').trim().toUpperCase();
      const out = [];
      const walk = n => n.children.forEach(c => { if (c.tagName === tag) out.push(c); walk(c); });
      walk(this); return out;
    };
    el.cloneNode = function (deep) {
      const copy = makeElement(this.tagName, this.id);
      Object.assign(copy._attrs, this._attrs);
      Object.assign(copy.style, this.style);
      copy.querySelector = el.querySelector; copy.querySelectorAll = el.querySelectorAll;
      copy.cloneNode = el.cloneNode;
      if (deep !== false) this.children.forEach(c => copy.appendChild(c.cloneNode(true)));
      return copy;
    };
    stack[stack.length - 1].appendChild(el);
    if (!selfClose) stack.push(el);
  }
  root.querySelector = function (sel) {
    const tag = String(sel || '').trim().toUpperCase();
    const walk = n => {
      for (const c of n.children) { if (c.tagName === tag) return c; const d = walk(c); if (d) return d; }
      return null;
    };
    return walk(this);
  };
  return root;
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
  // v76_k: `opts.file` loads a DIFFERENT built artefact — docs/index.html — under the same harness.
  // build-static.js carries its own copy of loadSavedList that overrides the client's, so a claim
  // proved against index.html says nothing about the published build. Defaults to index.html, so
  // every existing caller is unaffected.
  const html = fs.readFileSync(opts.file || path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('could not find the inline client script');
  // Strip the LIVE BOOTSTRAP — init() itself, and anything wired to run after it (e.g. the v84_b
  // PWA service-worker registration). Everything ELSE — every function and top-level statement —
  // is evaluated exactly as shipped. init() is async and network-bound; running it would test the
  // stubs, not the client.
  //
  // TWO shapes, because this loads TWO different artefacts (opts.file, v76_k):
  //   - index.html (live): carries the `@static-engine-end` MARKER — the same one build-static.js's
  //     own slicer uses — so everything from the marker onward is suppressed, no matter how much
  //     code follows it. v84_b found the OLD trailing-regex approach's exact failure mode the hard
  //     way: `/\ninit\(\);\s*$/` assumed init() was the LAST statement in the script, so the first
  //     bit of code ever added after it (the SW registration) silently un-suppressed init() — and
  //     the self-check guard below it ALSO missed this, because it only inspected `src.slice(-200)`,
  //     and the added code had pushed `init();` outside that tail window.
  //   - docs/index.html (the static GitHub Pages build): build-static.js does NOT carry the marker
  //     comment into its own output — it slices on the marker at BUILD time and never repeats it —
  //     and appends its own trailing `init();` with nothing after it. The marker-based approach
  //     above can't apply there (there is no marker to find), so this falls back to the ORIGINAL
  //     trailing-regex for that shape specifically — still correct for it, since docs/index.html
  //     never gained the PWA registration code in the first place (excluded by this very marker in
  //     the SOURCE, before build-static.js even runs).
  const MARKER = '// @static-engine-end';
  const markerIdx = m[1].indexOf(MARKER);
  let src = markerIdx >= 0
    ? m[1].slice(0, markerIdx) + '\n/* live bootstrap (init() + anything after it) suppressed by the smoke harness */\n'
    : m[1].replace(/\ninit\(\);\s*$/, '\n/* init() suppressed by the smoke harness */\n');
  // Checks the WHOLE resulting src, not a fixed-size tail slice — the exact gap that let the v84_b
  // bug through undetected. Matches a top-level CALL statement specifically (a newline immediately
  // followed by `init();`, zero indentation) — `async function init(){` earlier in the SAME src does
  // not match this (it starts with "async", not "init"), so this cannot false-positive on the
  // function's own definition.
  if (/\ninit\(\);/.test(src)) throw new Error('bootstrap call not neutralised — harness would run init()');

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
    DOMParser: function DOMParser() { return { parseFromString: (t) => parseXmlElements(t) }; },
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

module.exports = { loadClient, makeElement, makeDocument, parseXmlElements, ROOT };
