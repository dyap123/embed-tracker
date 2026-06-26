/* ============================================================
   nano.js — a tiny React-compatible runtime (vanilla, zero deps)
   ------------------------------------------------------------
   Drop-in replacement for the React + ReactDOM CDN globals used
   by EmbedYap. Exposes window.React (createElement, Fragment,
   memo, hooks) and window.ReactDOM (createRoot) so the existing
   precompiled component code runs unchanged — no JSX build, no
   framework. ~keyed DOM reconciler preserves real nodes across
   renders, so <canvas> contexts and input focus/caret survive.

   Implements the subset EmbedYap relies on:
     - createElement / Fragment / memo
     - useState, useReducer, useRef, useMemo, useCallback,
       useEffect, useLayoutEffect
     - object refs + callback refs (host elements only)
     - React style semantics (unitless number set -> px)
     - React onChange semantics (input vs change by element)
     - SVG namespace + camelCase->attribute mapping
   ============================================================ */
(function (global) {
  'use strict';

  var doc = global.document;
  var NS_SVG = 'http://www.w3.org/2000/svg';
  var NS_XLINK = 'http://www.w3.org/1999/xlink';
  var Fragment = { $$nanoFragment: true };
  var TEXT = { $$nanoText: true };

  /* ---- style: React's unitless property set ---- */
  var UNITLESS = {};
  ('animationIterationCount aspectRatio borderImageOutset borderImageSlice ' +
   'borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns ' +
   'flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea ' +
   'gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd ' +
   'gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity ' +
   'order orphans tabSize widows zIndex zoom fillOpacity floodOpacity ' +
   'stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit ' +
   'strokeOpacity strokeWidth').split(' ').forEach(function (k) { UNITLESS[k] = 1; });

  /* ---- SVG: React camelCase prop -> real attribute name ----
     Only the hyphenated family needs translation; native
     camelCase SVG attrs (viewBox, gradientUnits, preserveAspectRatio,
     patternUnits, markerWidth, baseFrequency, numOctaves, stdDeviation,
     stitchTiles, ...) are passed through unchanged.                */
  var SVG_ATTR = {
    strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap',
    strokeLinejoin: 'stroke-linejoin', strokeDasharray: 'stroke-dasharray',
    strokeDashoffset: 'stroke-dashoffset', strokeOpacity: 'stroke-opacity',
    strokeMiterlimit: 'stroke-miterlimit',
    fillOpacity: 'fill-opacity', fillRule: 'fill-rule',
    clipPath: 'clip-path', clipRule: 'clip-rule',
    stopColor: 'stop-color', stopOpacity: 'stop-opacity',
    textAnchor: 'text-anchor', dominantBaseline: 'dominant-baseline',
    alignmentBaseline: 'alignment-baseline', baselineShift: 'baseline-shift',
    fontSize: 'font-size', fontFamily: 'font-family', fontWeight: 'font-weight',
    fontStyle: 'font-style', letterSpacing: 'letter-spacing',
    markerEnd: 'marker-end', markerStart: 'marker-start', markerMid: 'marker-mid',
    vectorEffect: 'vector-effect', pointerEvents: 'pointer-events',
    shapeRendering: 'shape-rendering', colorInterpolationFilters: 'color-interpolation-filters',
    floodColor: 'flood-color', floodOpacity: 'flood-opacity',
    stopOpacityValue: 'stop-opacity'
  };

  function isReserved(k) { return k === 'children' || k === 'key' || k === 'ref'; }
  function isEventProp(k) {
    return k.length > 2 && k[0] === 'o' && k[1] === 'n' &&
      k[2] === k[2].toUpperCase();
  }

  /* ============================================================
     createElement
     ============================================================ */
  function h(type, config) {
    var props = {};
    var key = null, ref = null;
    if (config) {
      for (var k in config) {
        if (k === 'key') key = config[k];
        else if (k === 'ref') ref = config[k];
        else props[k] = config[k];
      }
    }
    var n = arguments.length;
    if (n > 3) {
      var kids = new Array(n - 2);
      for (var i = 2; i < n; i++) kids[i - 2] = arguments[i];
      props.children = kids;
    } else if (n === 3) {
      props.children = arguments[2];
    } // else leave config.children if present
    return { type: type, props: props, key: key, ref: ref };
  }

  /* ---- normalize a children tree into a flat vnode list ---- */
  function flatten(children) {
    var out = [];
    flat(children, out);
    return out;
  }
  // Walk an authored children value. Null/false/true children are SKIPPED
  // but still consume their positional index, so a surviving sibling's
  // implicit key (_ik) stays stable when a conditional `{cond && <x/>}`
  // toggles. That stability is what lets the reconciler reuse (not remount)
  // existing DOM nodes — which is what keeps input focus/caret alive.
  function flat(children, out) { flatLevel(children, out, ''); }
  function flatLevel(children, out, prefix) {
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i++) flatOne(children[i], out, prefix, i);
    } else {
      flatOne(children, out, prefix, 0);
    }
  }
  function flatOne(c, out, prefix, idx) {
    if (c == null || c === false || c === true) return; // skip; idx already reserved
    if (Array.isArray(c)) { flatLevel(c, out, prefix + idx + '.'); return; }
    var t = typeof c;
    if (t === 'string' || t === 'number') {
      out.push({ type: TEXT, props: { nodeValue: String(c) }, key: null, ref: null, _ik: prefix + idx });
      return;
    }
    c._ik = (c.key != null) ? ('k:' + c.key) : (prefix + idx); // implicit positional key
    out.push(c);
  }
  function keyOf(x) { return x.key != null ? ('k:' + x.key) : x._ik; }

  /* ============================================================
     hooks dispatcher state
     ============================================================ */
  var currentInst = null;
  var hookIndex = 0;
  var layoutQueue = [];
  var passiveQueue = [];
  var dirtySet = new Set();
  var flushScheduled = false;

  function runRender(inst) {
    var prevInst = currentInst, prevIdx = hookIndex;
    currentInst = inst; hookIndex = 0;
    var out = null;
    try {
      out = inst.type(inst.props);
    } catch (e) {
      console.error('[nano] render error in <' + (compName(inst.type)) + '>', e);
      out = null;
    } finally {
      currentInst = prevInst; hookIndex = prevIdx;
    }
    return out;
  }
  function compName(fn) { return (fn && (fn.displayName || fn.name)) || 'Anonymous'; }

  function cell() {
    var inst = currentInst, i = hookIndex++;
    if (!inst.hooks[i]) inst.hooks[i] = {};
    return inst.hooks[i];
  }

  function useReducer(reducer, initialArg, init) {
    var inst = currentInst, c = cell();
    if (!c.set) {
      c.value = init ? init(initialArg) : initialArg;
      c.set = function (action) {
        var nv = c.reducer(c.value, action);
        if (Object.is(nv, c.value)) return;
        c.value = nv;
        enqueueRender(inst);
      };
    }
    c.reducer = reducer; // keep latest reducer closure
    return [c.value, c.set];
  }
  function useState(initial) {
    var inst = currentInst, c = cell();
    if (!c.set) {
      c.value = typeof initial === 'function' ? initial() : initial;
      c.set = function (next) {
        var nv = typeof next === 'function' ? next(c.value) : next;
        if (Object.is(nv, c.value)) return;
        c.value = nv;
        enqueueRender(inst);
      };
    }
    return [c.value, c.set];
  }
  function useRef(initial) {
    var c = cell();
    if (!c.ref) c.ref = { current: initial };
    return c.ref;
  }
  function depsChanged(prev, next) {
    if (next === undefined || next === null) return true; // no deps -> every render
    if (!prev) return true;
    if (prev.length !== next.length) return true;
    for (var i = 0; i < next.length; i++) if (!Object.is(prev[i], next[i])) return true;
    return false;
  }
  function useMemo(factory, deps) {
    var c = cell();
    if (!c.hasMemo || depsChanged(c.deps, deps)) {
      c.value = factory();
      c.deps = deps;
      c.hasMemo = true;
    }
    return c.value;
  }
  function useCallback(fn, deps) { return useMemo(function () { return fn; }, deps); }

  function effectImpl(fn, deps, queue) {
    var c = cell();
    if (depsChanged(c.deps, deps)) {
      c.deps = deps;
      queue.push(function () {
        if (c.cleanup) { try { c.cleanup(); } catch (e) { console.error(e); } c.cleanup = null; }
        var r = fn();
        c.cleanup = (typeof r === 'function') ? r : null;
      });
    }
  }
  function useEffect(fn, deps) { effectImpl(fn, deps, passiveQueue); }
  function useLayoutEffect(fn, deps) { effectImpl(fn, deps, layoutQueue); }

  /* ============================================================
     memo
     ============================================================ */
  function shallowEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b) return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) {
      var k = ka[i];
      if (k === 'children') { if (a[k] !== b[k]) return false; continue; }
      if (!Object.is(a[k], b[k])) return false;
    }
    return true;
  }
  function memo(comp, areEqual) {
    var M = function (props) { return comp(props); };
    M._memo = comp;
    M._eq = areEqual || shallowEqual;
    M.displayName = 'Memo(' + compName(comp) + ')';
    return M;
  }

  /* ============================================================
     DOM property / attribute / event / style application
     ============================================================ */
  function applyStyle(dom, style, old) {
    style = style || {}; old = old || {};
    for (var k in old) if (!(k in style)) setStyleProp(dom, k, '');
    for (var j in style) if (!Object.is(style[j], old[j])) setStyleProp(dom, j, style[j]);
  }
  function setStyleProp(dom, k, v) {
    if (k.charCodeAt(0) === 45) { // custom property "--x"
      if (v == null || v === '') dom.style.removeProperty(k); else dom.style.setProperty(k, v);
      return;
    }
    if (v == null || v === '') { dom.style[k] = ''; return; }
    if (typeof v === 'number' && !UNITLESS[k]) dom.style[k] = v + 'px';
    else dom.style[k] = v;
  }

  function domEventType(name) {
    var n = name.slice(2).toLowerCase();
    if (n === 'doubleclick') return 'dblclick';
    return n;
  }
  function eventOpts(type) {
    if (type === 'wheel' || type === 'touchstart' || type === 'touchmove') return { passive: false };
    return false;
  }
  function setEvent(dom, name, handler) {
    if (!dom.__h) dom.__h = {};
    if (!dom.__hb) dom.__hb = {};
    if (name === 'onChange') {
      dom.__h.__change = handler || null;
      if (!dom.__hb.__change) {
        dom.__hb.__change = true;
        var disp = function (e) {
          var f = dom.__h.__change; if (!f) return;
          var tag = dom.tagName, ty = dom.type;
          var toggleish = tag === 'SELECT' || ty === 'checkbox' || ty === 'radio';
          if (toggleish ? e.type === 'change' : e.type === 'input') f(e);
        };
        dom.addEventListener('input', disp, false);
        dom.addEventListener('change', disp, false);
      }
      return;
    }
    var type = domEventType(name);
    dom.__h[type] = handler || null;
    if (!dom.__hb[type]) {
      dom.__hb[type] = true;
      dom.addEventListener(type, function (e) { var f = dom.__h[type]; if (f) f(e); }, eventOpts(type));
    }
  }

  function setProp(dom, name, old, val, ns) {
    if (name === 'style') { applyStyle(dom, val, old); return; }
    if (name === 'className' || name === 'class') {
      if (ns) { if (val == null) dom.removeAttribute('class'); else dom.setAttribute('class', val); }
      else dom.className = val == null ? '' : val;
      return;
    }
    if (name === 'dangerouslySetInnerHTML') {
      var html = val && val.__html || '';
      if (dom.innerHTML !== html) dom.innerHTML = html;
      return;
    }
    if (isEventProp(name)) { setEvent(dom, name, val); return; }
    if (name === 'value' && ('value' in dom)) {
      var v = val == null ? '' : val;
      if (dom.value !== v) dom.value = v;
      return;
    }
    if (name === 'checked' && ('checked' in dom)) { dom.checked = !!val; return; }
    if (name === 'defaultValue') { if (old === undefined && val != null && dom.value === '') dom.value = val; return; }
    if (name === 'defaultChecked') { if (old === undefined) dom.checked = !!val; return; }

    if (ns) { // SVG element
      if (name === 'xlinkHref') {
        if (val == null) dom.removeAttributeNS(NS_XLINK, 'href'); else dom.setAttributeNS(NS_XLINK, 'href', val);
        return;
      }
      var attr = SVG_ATTR[name] || name;
      if (val == null || val === false) dom.removeAttribute(attr);
      else dom.setAttribute(attr, val === true ? '' : val);
      return;
    }
    // HTML element
    if (name === 'htmlFor') { dom.htmlFor = val == null ? '' : val; return; }
    if (name.lastIndexOf('data-', 0) === 0 || name.lastIndexOf('aria-', 0) === 0) {
      if (val == null || val === false) dom.removeAttribute(name);
      else dom.setAttribute(name, val === true ? '' : val);
      return;
    }
    if (name in dom) {
      try { dom[name] = val == null ? '' : val; return; } catch (e) { /* fall through */ }
    }
    if (val == null || val === false) dom.removeAttribute(name);
    else dom.setAttribute(name, val === true ? '' : val);
  }
  function removeProp(dom, name, old, ns) { setProp(dom, name, old, null, ns); }

  function setInitialProps(dom, props, ns) {
    for (var k in props) {
      if (isReserved(k)) continue;
      setProp(dom, k, undefined, props[k], ns);
    }
  }
  function updateProps(dom, oldP, newP, ns) {
    for (var k in oldP) {
      if (isReserved(k)) continue;
      if (!(k in newP)) removeProp(dom, k, oldP[k], ns);
    }
    for (var j in newP) {
      if (isReserved(j)) continue;
      if (!Object.is(oldP[j], newP[j])) setProp(dom, j, oldP[j], newP[j], ns);
    }
  }

  function applyRef(ref, value) {
    if (!ref) return;
    if (typeof ref === 'function') { try { ref(value); } catch (e) { console.error(e); } }
    else if (typeof ref === 'object') ref.current = value;
  }

  /* ============================================================
     reconciler — instances mirror the vnode tree, reuse DOM
     ============================================================ */
  function domsOf(inst) {
    if (inst.kind === 'host' || inst.kind === 'text') return [inst.dom];
    var out = [];
    var ch = inst.children;
    for (var i = 0; i < ch.length; i++) {
      var d = domsOf(ch[i]);
      for (var j = 0; j < d.length; j++) out.push(d[j]);
    }
    return out;
  }

  function mount(vnode, parentDom, ns, depth) {
    if (vnode.type === TEXT) {
      return { kind: 'text', dom: doc.createTextNode(vnode.props.nodeValue), vnode: vnode, key: vnode.key, _ik: vnode._ik, type: TEXT, depth: depth };
    }
    if (typeof vnode.type === 'function') {
      var inst = {
        kind: 'fn', type: vnode.type, props: vnode.props, vnode: vnode, key: vnode.key, _ik: vnode._ik,
        hooks: [], children: [], depth: depth, parentDom: parentDom, ns: ns,
        isMemo: !!vnode.type._memo, _mounted: true, dirty: false
      };
      var out = runRender(inst);
      inst.children = mountChildren(flatten([out]), parentDom, ns, depth + 1);
      return inst;
    }
    if (vnode.type === Fragment) {
      var finst = { kind: 'frag', type: Fragment, vnode: vnode, key: vnode.key, _ik: vnode._ik, children: [], depth: depth, parentDom: parentDom, ns: ns, _mounted: true };
      finst.children = mountChildren(flatten(vnode.props.children), parentDom, ns, depth + 1);
      return finst;
    }
    // host element
    var elementNs = (ns === NS_SVG || vnode.type === 'svg') ? NS_SVG : null;
    var childNs = (vnode.type === 'foreignObject') ? null : elementNs;
    var dom = elementNs ? doc.createElementNS(NS_SVG, vnode.type) : doc.createElement(vnode.type);
    var hinst = { kind: 'host', dom: dom, type: vnode.type, vnode: vnode, key: vnode.key, _ik: vnode._ik, children: [], depth: depth, parentDom: parentDom, ns: elementNs, childNs: childNs, _mounted: true };
    setInitialProps(dom, vnode.props, elementNs);
    hinst.children = mountChildren(flatten(vnode.props.children), dom, childNs, depth + 1);
    if (vnode.ref) applyRef(vnode.ref, dom);
    return hinst;
  }

  function mountChildren(vnodes, parentDom, ns, depth) {
    var insts = new Array(vnodes.length);
    for (var i = 0; i < vnodes.length; i++) {
      var inst = mount(vnodes[i], parentDom, ns, depth);
      var ds = domsOf(inst);
      for (var j = 0; j < ds.length; j++) parentDom.appendChild(ds[j]);
      insts[i] = inst;
    }
    return insts;
  }

  function sameType(inst, vnode) {
    if (vnode.type === TEXT) return inst.kind === 'text';
    return inst.type === vnode.type;
  }
  function firstDomOf(inst) {
    if (inst.kind === 'host' || inst.kind === 'text') return inst.dom;
    var ch = inst.children;
    for (var i = 0; i < ch.length; i++) { var d = firstDomOf(ch[i]); if (d) return d; }
    return null;
  }
  // Position inst's DOM node(s) immediately before `anchor` within parentDom,
  // moving only nodes that are genuinely out of place. A correctly-positioned,
  // focused <input> is therefore never re-inserted — so it never loses focus.
  function placeBefore(parentDom, inst, anchor) {
    var nodes = domsOf(inst);
    var ref = anchor;
    for (var i = nodes.length - 1; i >= 0; i--) {
      var node = nodes[i];
      if (node.parentNode !== parentDom || node.nextSibling !== ref) parentDom.insertBefore(node, ref);
      ref = node;
    }
  }

  // `anchor` = the DOM node this inst's range must end immediately before, inside
  // parentDom. Components/fragments share parentDom with siblings, so they must NOT
  // assume their content is last (anchor=null) — that was the focus-stealing bug.
  function patch(inst, vnode, parentDom, ns, anchor) {
    if (inst.kind === 'text') {
      var nv = vnode.props.nodeValue;
      if (inst.dom.nodeValue !== nv) inst.dom.nodeValue = nv;
      inst.vnode = vnode;
      return;
    }
    if (inst.kind === 'host') {
      updateProps(inst.dom, inst.vnode.props, vnode.props, inst.ns);
      // a host element is a dedicated container: its children fill it end-to-end (anchor=null)
      reconcileChildren(inst.dom, inst, flatten(vnode.props.children), inst.childNs, null);
      if (vnode.ref !== inst.vnode.ref) { applyRef(inst.vnode.ref, null); applyRef(vnode.ref, inst.dom); }
      inst.vnode = vnode;
      return;
    }
    if (inst.kind === 'frag') {
      inst._anchor = anchor;
      reconcileChildren(parentDom, inst, flatten(vnode.props.children), ns, anchor);
      inst.vnode = vnode;
      return;
    }
    // fn
    var prevProps = inst.props;
    inst.props = vnode.props;
    inst.vnode = vnode;
    inst.parentDom = parentDom;
    inst.ns = ns;
    if (inst.isMemo && !inst.dirty && (inst.type._eq || shallowEqual)(prevProps, vnode.props)) return;
    renderInst(inst, anchor);
  }

  function renderInst(inst, anchor) {
    inst.dirty = false;
    if (anchor === undefined) {
      // self-triggered re-render (setState): derive the anchor from the current DOM
      var cur = domsOf(inst);
      anchor = cur.length ? cur[cur.length - 1].nextSibling : (inst._anchor || null);
    }
    inst._anchor = anchor;
    var out = runRender(inst);
    reconcileChildren(inst.parentDom, inst, flatten([out]), inst.ns, anchor);
  }

  function reconcileChildren(parentDom, parentInst, newVnodes, ns, anchor) {
    var old = parentInst.children || [];
    var depth = (parentInst.depth || 0) + 1;
    var map = null;
    if (old.length) {
      map = {};
      for (var i = 0; i < old.length; i++) map[keyOf(old[i])] = old[i];
    }
    var claimed = old.length ? new Set() : null;
    var newInsts = new Array(newVnodes.length);
    // pass 1 (left->right): match reuse candidates by key, claim them
    for (var n = 0; n < newVnodes.length; n++) {
      var cv = newVnodes[n];
      var cand = map ? map[keyOf(cv)] : null;
      if (cand && !claimed.has(cand) && sameType(cand, cv)) {
        claimed.add(cand); cand._ik = cv._ik;
        newInsts[n] = cand;
      } else {
        newInsts[n] = null;
      }
    }
    // remove stale survivors first so anchor math isn't confused by soon-to-go nodes
    if (old.length) {
      for (var r = 0; r < old.length; r++) if (!claimed.has(old[r])) unmount(old[r]);
    }
    // pass 2 (right->left): patch or mount each child, then position it before the
    // running anchor (the first DOM node of the already-placed next sibling)
    var curAnchor = anchor || null;
    for (var x = newVnodes.length - 1; x >= 0; x--) {
      var v = newVnodes[x];
      var inst = newInsts[x];
      if (inst) patch(inst, v, parentDom, ns, curAnchor);
      else { inst = mount(v, parentDom, ns, depth); newInsts[x] = inst; }
      placeBefore(parentDom, inst, curAnchor);
      var fd = firstDomOf(inst);
      if (fd) curAnchor = fd;
    }
    parentInst.children = newInsts;
  }

  function unmount(inst) {
    inst._mounted = false;
    if (inst.kind === 'fn') {
      for (var i = 0; i < inst.hooks.length; i++) {
        var c = inst.hooks[i];
        if (c && c.cleanup) { try { c.cleanup(); } catch (e) { console.error(e); } c.cleanup = null; }
      }
    }
    var ch = inst.children;
    if (ch) for (var j = 0; j < ch.length; j++) unmount(ch[j]);
    if (inst.kind === 'host' && inst.vnode.ref) applyRef(inst.vnode.ref, null);
    if (inst.kind === 'host' || inst.kind === 'text') {
      if (inst.dom.parentNode) inst.dom.parentNode.removeChild(inst.dom);
    }
  }

  /* ============================================================
     scheduler
     ============================================================ */
  function enqueueRender(inst) {
    if (!inst._mounted) return;
    inst.dirty = true;
    dirtySet.add(inst);
    scheduleFlush();
  }
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(flushWork);
  }
  function flushWork() {
    flushScheduled = false;
    var insts = [];
    dirtySet.forEach(function (i) { if (i._mounted && i.dirty) insts.push(i); });
    dirtySet.clear();
    insts.sort(function (a, b) { return a.depth - b.depth; });
    for (var i = 0; i < insts.length; i++) {
      var inst = insts[i];
      if (inst._mounted && inst.dirty) renderInst(inst);
    }
    commitEffects();
    if (dirtySet.size) scheduleFlush();
  }
  function commitEffects() {
    var lq = layoutQueue; layoutQueue = [];
    for (var i = 0; i < lq.length; i++) { try { lq[i](); } catch (e) { console.error(e); } }
    if (passiveQueue.length) {
      var pq = passiveQueue; passiveQueue = [];
      queueMicrotask(function () {
        for (var j = 0; j < pq.length; j++) { try { pq[j](); } catch (e) { console.error(e); } }
      });
    }
  }

  /* ============================================================
     roots
     ============================================================ */
  function createRoot(container) {
    var root = { kind: 'root', children: [], parentDom: container, depth: 0, _mounted: true };
    return {
      render: function (element) {
        reconcileChildren(container, root, flatten([element]), null, null);
        commitEffects();
      },
      unmount: function () {
        for (var i = 0; i < root.children.length; i++) unmount(root.children[i]);
        root.children = [];
      }
    };
  }
  function legacyRender(element, container) {
    if (!container.__nanoRoot) container.__nanoRoot = createRoot(container);
    container.__nanoRoot.render(element);
  }

  /* ============================================================
     exports — mimic the React / ReactDOM global shape
     ============================================================ */
  var React = {
    createElement: h,
    Fragment: Fragment,
    memo: memo,
    useState: useState,
    useReducer: useReducer,
    useRef: useRef,
    useMemo: useMemo,
    useCallback: useCallback,
    useEffect: useEffect,
    useLayoutEffect: useLayoutEffect,
    version: 'nano-1.0'
  };
  var ReactDOM = {
    createRoot: createRoot,
    render: legacyRender,
    version: 'nano-1.0'
  };

  global.React = React;
  global.ReactDOM = ReactDOM;
  // also expose the internals for tests / debugging
  global.NANO = {
    h: h, Fragment: Fragment, flatten: flatten, createRoot: createRoot,
    _flushSync: function () { flushWork(); }, shallowEqual: shallowEqual
  };
})(typeof window !== 'undefined' ? window : globalThis);
