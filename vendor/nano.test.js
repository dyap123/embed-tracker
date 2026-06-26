/* Node test harness for vendor/nano.js — minimal fake DOM, no browser. */

/* ---------------- minimal fake DOM ---------------- */
function mkStyle() {
  var s = {};
  s.removeProperty = function (k) { delete s[k]; };
  s.setProperty = function (k, v) { s[k] = v; };
  return s;
}
function El(tag, ns) {
  this.tagName = ns ? tag : String(tag).toUpperCase();
  this._ns = ns || null;
  this.childNodes = [];
  this.parentNode = null;
  this.style = mkStyle();
  this.attributes = {};
  this._listeners = {};
  this.className = '';
  this._props = {};
}
Object.defineProperty(El.prototype, 'nextSibling', {
  get: function () {
    var p = this.parentNode; if (!p) return null;
    var i = p.childNodes.indexOf(this);
    return (i >= 0 && i + 1 < p.childNodes.length) ? p.childNodes[i + 1] : null;
  }
});
Object.defineProperty(El.prototype, 'firstChild', {
  get: function () { return this.childNodes[0] || null; }
});
Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return this._innerHTML || ''; },
  set: function (v) { this._innerHTML = v; this.childNodes = []; }
});
El.prototype.appendChild = function (n) {
  if (n.parentNode) n.parentNode.removeChild(n);
  n.parentNode = this; this.childNodes.push(n); return n;
};
El.prototype.insertBefore = function (n, ref) {
  if (n.parentNode) n.parentNode.removeChild(n);
  n.parentNode = this;
  if (ref == null) { this.childNodes.push(n); return n; }
  var i = this.childNodes.indexOf(ref);
  if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n);
  return n;
};
El.prototype.removeChild = function (n) {
  var i = this.childNodes.indexOf(n);
  if (i >= 0) this.childNodes.splice(i, 1);
  n.parentNode = null; return n;
};
El.prototype.setAttribute = function (k, v) { this.attributes[k] = String(v); };
El.prototype.getAttribute = function (k) { return k in this.attributes ? this.attributes[k] : null; };
El.prototype.removeAttribute = function (k) { delete this.attributes[k]; };
El.prototype.setAttributeNS = function (ns, k, v) { this.attributes[k] = String(v); };
El.prototype.removeAttributeNS = function (ns, k) { delete this.attributes[k]; };
El.prototype.addEventListener = function (type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); };
El.prototype.removeEventListener = function (type, fn) {
  var a = this._listeners[type]; if (!a) return; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
};
El.prototype.fire = function (type, ev) {
  ev = ev || {}; ev.type = type; ev.target = this;
  var a = this._listeners[type] || [];
  a.slice().forEach(function (fn) { fn(ev); });
};
// value/checked/type/htmlFor behave like real props
['value', 'checked', 'type', 'htmlFor', 'disabled', 'id', 'title', 'placeholder', 'href', 'src'].forEach(function (p) {
  Object.defineProperty(El.prototype, p, {
    get: function () { return this._props[p] !== undefined ? this._props[p] : (p === 'value' || p === 'type' ? '' : (p === 'checked' || p === 'disabled' ? false : '')); },
    set: function (v) { this._props[p] = v; },
    configurable: true
  });
});

function TextNode(t) { this.nodeValue = String(t); this.parentNode = null; }
Object.defineProperty(TextNode.prototype, 'nextSibling', {
  get: function () {
    var p = this.parentNode; if (!p) return null;
    var i = p.childNodes.indexOf(this);
    return (i >= 0 && i + 1 < p.childNodes.length) ? p.childNodes[i + 1] : null;
  }
});

global.document = {
  createElement: function (t) { return new El(t, null); },
  createElementNS: function (ns, t) { return new El(t, ns); },
  createTextNode: function (t) { return new TextNode(t); }
};
global.window = global;

/* ---------------- load runtime ---------------- */
require('/Users/jjiii/embed-tracker/vendor/nano.js');
var React = global.React, ReactDOM = global.ReactDOM, NANO = global.NANO;
var h = React.createElement;

/* ---------------- tiny assert ---------------- */
var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function eq(a, b, msg) { ok(Object.is(a, b) || a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function text(node) {
  if (node instanceof TextNode) return node.nodeValue;
  return node.childNodes.map(text).join('');
}
function microtasks() { return new Promise(function (r) { setTimeout(r, 0); }); }

(async function () {
  /* 1. style px semantics */
  (function () {
    var root = new El('root');
    ReactDOM.createRoot(root).render(h('div', { style: { fontSize: 14, opacity: 0.5, width: 48, zIndex: 3, padding: '10px 16px', lineHeight: 1.4 } }));
    var d = root.firstChild;
    eq(d.style.fontSize, '14px', 'style: number length -> px');
    eq(d.style.opacity, 0.5, 'style: unitless number stays raw');
    eq(d.style.width, '48px', 'style: width -> px');
    eq(d.style.zIndex, 3, 'style: zIndex unitless');
    eq(d.style.padding, '10px 16px', 'style: string passthrough');
    eq(d.style.lineHeight, 1.4, 'style: lineHeight unitless');
  })();

  /* 2. nesting, text, attributes, className */
  (function () {
    var root = new El('root');
    ReactDOM.createRoot(root).render(
      h('div', { className: 'card', id: 'x' }, h('span', null, 'hi ', 42), h('b', null, 'bold'))
    );
    var d = root.firstChild;
    eq(d.className, 'card', 'className applied');
    eq(d.id, 'x', 'id property applied');
    eq(text(d), 'hi 42bold', 'children text + number rendered');
    eq(d.childNodes.length, 2, 'two element children');
  })();

  /* 3. useState re-render preserves the same DOM node */
  await (async function () {
    var root = new El('root');
    var setN;
    function Counter() {
      var s = React.useState(0); setN = s[1];
      return h('div', { id: 'c' }, 'count:' + s[0]);
    }
    ReactDOM.createRoot(root).render(h(Counter));
    var before = root.firstChild;
    eq(text(before), 'count:0', 'initial state render');
    setN(5);
    NANO._flushSync();
    var after = root.firstChild;
    eq(text(after), 'count:5', 'state update re-rendered');
    ok(before === after, 'DOM node preserved across state update (no replace)');
  })();

  /* 4. effects: layout runs sync on commit, passive after microtask; cleanup on unmount */
  await (async function () {
    var log = [];
    var setShow;
    function Child() {
      React.useLayoutEffect(function () { log.push('layout'); return function () { log.push('layout-cleanup'); }; }, []);
      React.useEffect(function () { log.push('passive'); return function () { log.push('passive-cleanup'); }; }, []);
      return h('div', null, 'child');
    }
    function App() {
      var s = React.useState(true); setShow = s[1];
      return s[0] ? h(Child) : h('div', null, 'gone');
    }
    var root = new El('root');
    ReactDOM.createRoot(root).render(h(App));
    eq(log.join(','), 'layout', 'layout effect ran synchronously on mount');
    await microtasks();
    eq(log.join(','), 'layout,passive', 'passive effect ran after microtask');
    setShow(false); NANO._flushSync();
    ok(log.indexOf('layout-cleanup') >= 0 && log.indexOf('passive-cleanup') >= 0, 'cleanups ran on unmount');
  })();

  /* 5. keyed list reconcile: reorder preserves nodes by key */
  (function () {
    var root = new El('root');
    var r = ReactDOM.createRoot(root);
    function List(items) { return h('ul', null, items.map(function (it) { return h('li', { key: it }, it); })); }
    r.render(List(['a', 'b', 'c']));
    var ul = root.firstChild;
    var liA = ul.childNodes[0], liB = ul.childNodes[1], liC = ul.childNodes[2];
    eq(text(liA), 'a', 'list a'); eq(text(liC), 'c', 'list c');
    r.render(List(['c', 'a', 'b']));
    eq(text(ul.childNodes[0]), 'c', 'reordered first is c');
    eq(text(ul.childNodes[1]), 'a', 'reordered second is a');
    ok(ul.childNodes[0] === liC, 'keyed node C reused after reorder');
    ok(ul.childNodes[1] === liA, 'keyed node A reused after reorder');
    r.render(List(['a']));
    eq(ul.childNodes.length, 1, 'removed nodes pruned');
    ok(ul.childNodes[0] === liA, 'remaining keyed node reused');
  })();

  /* 6. controlled input: value updates but node identity (focus/caret) preserved; no reset when unchanged */
  (function () {
    var root = new El('root');
    var r = ReactDOM.createRoot(root);
    function Form(v) { return h('input', { type: 'text', value: v }); }
    r.render(Form('hello'));
    var inp = root.firstChild;
    eq(inp.value, 'hello', 'input value set');
    var sets = 0; var realSet = Object.getOwnPropertyDescriptor(El.prototype, 'value').set;
    Object.defineProperty(inp, 'value', { get: function () { return this._props.value; }, set: function (x) { sets++; this._props.value = x; } });
    r.render(Form('hello')); // same value -> should NOT write
    eq(sets, 0, 'value not rewritten when unchanged (caret safe)');
    r.render(Form('world'));
    eq(sets, 1, 'value rewritten once when changed');
    eq(inp.value, 'world', 'input value updated');
    ok(root.firstChild === inp, 'input node preserved across value change');
  })();

  /* 7. onChange semantics: text fires on input, not change */
  (function () {
    var root = new El('root'); var hits = [];
    ReactDOM.createRoot(root).render(h('input', { type: 'text', onChange: function (e) { hits.push(e.type); } }));
    var inp = root.firstChild;
    inp.fire('input', {}); inp.fire('change', {});
    eq(hits.join(','), 'input', 'text input onChange -> input event only');

    var root2 = new El('root'); var hits2 = [];
    ReactDOM.createRoot(root2).render(h('input', { type: 'checkbox', onChange: function (e) { hits2.push(e.type); } }));
    var cb = root2.firstChild;
    cb.fire('input', {}); cb.fire('change', {});
    eq(hits2.join(','), 'change', 'checkbox onChange -> change event only');
  })();

  /* 8. onClick handler updates without duplicate listeners */
  (function () {
    var root = new El('root'); var r = ReactDOM.createRoot(root);
    var count = 0;
    function Btn(cb) { return h('button', { onClick: cb }, 'go'); }
    r.render(Btn(function () { count += 1; }));
    var b = root.firstChild;
    b.fire('click', {}); eq(count, 1, 'click handler fired');
    r.render(Btn(function () { count += 10; }));
    b.fire('click', {}); eq(count, 11, 'updated handler used (latest closure)');
    eq((b._listeners.click || []).length, 1, 'only one underlying click listener attached');
  })();

  /* 9. SVG namespace + attribute mapping */
  (function () {
    var root = new El('root');
    ReactDOM.createRoot(root).render(
      h('svg', { viewBox: '0 0 10 10' }, h('rect', { x: 1, y: 2, strokeWidth: 3, fill: 'red', strokeLinecap: 'round' }))
    );
    var svg = root.firstChild;
    eq(svg._ns, 'http://www.w3.org/2000/svg', 'svg created in SVG namespace');
    eq(svg.getAttribute('viewBox'), '0 0 10 10', 'viewBox kept camelCase');
    var rect = svg.childNodes[0];
    eq(rect._ns, 'http://www.w3.org/2000/svg', 'child rect inherits SVG namespace');
    eq(rect.getAttribute('stroke-width'), '3', 'strokeWidth -> stroke-width attr');
    eq(rect.getAttribute('stroke-linecap'), 'round', 'strokeLinecap -> stroke-linecap');
    eq(rect.getAttribute('x'), '1', 'plain x attr');
  })();

  /* 10. memo skips re-render when props shallow-equal */
  (function () {
    var renders = 0;
    var Inner = React.memo(function (p) { renders++; return h('div', null, p.label); });
    var root = new El('root'); var r = ReactDOM.createRoot(root);
    function Wrap(label) { return h('div', null, h(Inner, { label: label })); }
    r.render(Wrap('A')); eq(renders, 1, 'memo initial render');
    r.render(Wrap('A')); eq(renders, 1, 'memo skipped on equal props');
    r.render(Wrap('B')); eq(renders, 2, 'memo re-rendered on changed props');
  })();

  /* 11. ref: object + callback on host elements */
  (function () {
    var root = new El('root');
    var objRef = { current: null }; var cbVal = null;
    ReactDOM.createRoot(root).render(h('div', { ref: objRef }, h('span', { ref: function (n) { cbVal = n; } })));
    ok(objRef.current === root.firstChild, 'object ref assigned to node');
    ok(cbVal === root.firstChild.childNodes[0], 'callback ref called with node');
  })();

  /* 12. conditional children ({cond && el}) and fragments */
  (function () {
    var root = new El('root'); var r = ReactDOM.createRoot(root);
    function App(show) {
      return h('div', null, show && h('span', null, 'yes'), h(React.Fragment, null, h('i', null, '1'), h('i', null, '2')));
    }
    r.render(App(true));
    eq(text(root.firstChild), 'yes12', 'fragment + conditional rendered');
    r.render(App(false));
    eq(text(root.firstChild), '12', 'falsy child removed, fragment remains');
  })();

  /* 13. conditional sibling must NOT remount the input (focus/caret bug regression).
        A `{cond && <span/>}` that toggles each render shifts naive positional
        indices and would replace the following <input>, losing focus. Implicit
        keys (null slots still consume an index) must keep the input node stable. */
  (function () {
    var root = new El('root'); var r = ReactDOM.createRoot(root);
    function Pin(val) {
      return h('div', null,
        (val.length % 2 === 1) && h('span', null, 'odd'),  // banner toggles each keystroke
        h('input', { type: 'text', value: val })
      );
    }
    r.render(Pin(''));
    var input = root.firstChild.childNodes[0];
    eq(input.tagName, 'INPUT', 'input is first child when banner hidden');
    r.render(Pin('a'));   // banner appears -> input shifts to index 1
    var last = root.firstChild.childNodes[root.firstChild.childNodes.length - 1];
    ok(last === input, 'input node REUSED when a conditional sibling appears (focus safe)');
    r.render(Pin('ab'));  // banner hidden again
    ok(root.firstChild.childNodes[0] === input, 'input node REUSED when conditional sibling disappears');
    r.render(Pin('abc'));
    ok(root.firstChild.childNodes[1] === input, 'input node stable across repeated toggles');
  })();

  /* 14. keyed map followed by a stable input (Inventory search pattern):
        typing rebuilds the results list; the input above must persist. */
  (function () {
    var root = new El('root'); var r = ReactDOM.createRoot(root);
    function Search(q, rows) {
      return h('div', null,
        h('input', { type: 'text', value: q }),
        h('ul', null, rows.map(function (x) { return h('li', { key: x }, x); }))
      );
    }
    r.render(Search('', ['a', 'b', 'c']));
    var input = root.firstChild.childNodes[0];
    r.render(Search('b', ['b']));
    ok(root.firstChild.childNodes[0] === input, 'search input persists while results list rebuilds');
    eq(root.firstChild.childNodes[1].childNodes.length, 1, 'results list updated to 1 row');
  })();

  console.log('\n' + (fail === 0 ? '✅ ALL PASS' : '❌ FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
