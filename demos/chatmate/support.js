/* Minimal standalone runtime for the Chatmate *.dc.html design files.
   Supports: <helmet>, <x-dc> template, {{ expr }} in text/attributes, <sc-if value>, <sc-for list as>,
   on* event bindings, and a DCLogic base class with state / setState / renderVals. */
(function () {
  window.DCLogic = class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      const p = typeof patch === 'function' ? patch(this.state) : patch;
      this.state = Object.assign({}, this.state, p);
      if (this.__render) this.__render();
    }
    renderVals() { return {}; }
  };

  const RE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;
  const BOOL = { disabled: 1, checked: 1, selected: 1, hidden: 1, readonly: 1, required: 1 };

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return parseFloat(expr);
    if (/^(['"]).*\1$/.test(expr)) return expr.slice(1, -1);
    const neg = expr[0] === '!';
    if (neg) expr = expr.slice(1).trim();
    const parts = expr.split('.');
    let v;
    for (let i = scope.length - 1; i >= 0; i--) {
      if (scope[i] && Object.prototype.hasOwnProperty.call(scope[i], parts[0])) { v = scope[i][parts[0]]; break; }
    }
    for (let k = 1; k < parts.length && v != null; k++) v = v[parts[k]];
    return neg ? !v : v;
  }
  const str = (v) => (v == null || v === false ? '' : String(v));
  const interp = (s, scope) => s.replace(RE, (_, e) => str(lookup(e, scope)));

  function renderNodes(nodes, scope, out) {
    nodes.forEach((n) => renderNode(n, scope, out));
  }
  function renderNode(n, scope, out) {
    if (n.nodeType === 3) {
      out.appendChild(document.createTextNode(n.nodeValue.indexOf('{{') >= 0 ? interp(n.nodeValue, scope) : n.nodeValue));
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'sc-if') {
      const m = (n.getAttribute('value') || '').match(ONE);
      if (m && lookup(m[1], scope)) renderNodes(Array.from(n.childNodes), scope, out);
      return;
    }
    if (tag === 'sc-for') {
      const m = (n.getAttribute('list') || '').match(ONE);
      const as = n.getAttribute('as') || 'item';
      const list = m ? lookup(m[1], scope) : null;
      (Array.isArray(list) ? list : []).forEach((item, i) => {
        const sc = {}; sc[as] = item; sc.$index = i;
        renderNodes(Array.from(n.childNodes), scope.concat([sc]), out);
      });
      return;
    }
    const isSvg = n.namespaceURI === 'http://www.w3.org/2000/svg';
    const el = isSvg ? document.createElementNS(n.namespaceURI, n.tagName) : document.createElement(n.tagName);
    let valueToSet;
    Array.from(n.attributes).forEach((a) => {
      const name = a.name, val = a.value;
      if (name.indexOf('hint-') === 0) return;
      if (/^on[a-z]+$/i.test(name) && ONE.test(val)) {
        const fn = lookup(val.match(ONE)[1], scope);
        if (typeof fn === 'function') {
          let ev = name.slice(2).toLowerCase();
          if (ev === 'change' && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA')) ev = 'input';
          el.addEventListener(ev, fn);
        }
        return;
      }
      if (val.indexOf('{{') < 0) { el.setAttribute(name, val); return; }
      const one = val.match(ONE);
      if (one) {
        const v = lookup(one[1], scope);
        if (BOOL[name.toLowerCase()]) { if (v) el.setAttribute(name, ''); return; }
        if (name === 'value') { valueToSet = str(v); el.setAttribute(name, str(v)); return; }
        el.setAttribute(name, typeof v === 'boolean' ? String(v) : str(v));
        return;
      }
      el.setAttribute(name, interp(val, scope));
    });
    renderNodes(Array.from(n.childNodes), scope, el);
    if (valueToSet !== undefined) el.value = valueToSet;
    out.appendChild(el);
  }

  function boot() {
    const helmet = document.querySelector('helmet');
    if (helmet) { Array.from(helmet.childNodes).forEach((c) => document.head.appendChild(c)); helmet.remove(); }
    const host = document.querySelector('x-dc');
    if (!host) return;
    const tpl = Array.from(host.childNodes);
    tpl.forEach((c) => host.removeChild(c));
    const holder = document.createElement('div');
    tpl.forEach((c) => holder.appendChild(c));
    const scriptEl = document.querySelector('script[data-dc-script]');
    let Comp = window.DCLogic;
    if (scriptEl) {
      try { Comp = new Function('DCLogic', scriptEl.textContent + '\n;return Component;')(window.DCLogic); }
      catch (e) { console.error(e); }
    }
    const inst = new Comp({});
    host.style.display = 'contents';
    inst.__render = function () {
      const a = document.activeElement;
      const focusId = a && a.id && host.contains(a) ? a.id : null;
      let s0, s1;
      try { if (focusId) { s0 = a.selectionStart; s1 = a.selectionEnd; } } catch (e) {}
      const vals = inst.renderVals ? inst.renderVals() : {};
      const frag = document.createDocumentFragment();
      renderNodes(Array.from(holder.childNodes), [vals], frag);
      host.replaceChildren(frag);
      if (focusId) {
        const f = document.getElementById(focusId);
        if (f) { f.focus(); try { if (s0 != null) f.setSelectionRange(s0, s1); } catch (e) {} }
      }
    };
    inst.__render();
    if (typeof inst.componentDidMount === 'function') inst.componentDidMount();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
