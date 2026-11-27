"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { panelAlignment, focusableLinks, mount, BREAKPOINT } = require("../../../assets/js/navigation-groups.js");

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, handler, options) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push({ handler, options });
    },
    removeEventListener(name, handler) {
      listeners.set(name, (listeners.get(name) || []).filter(item => item.handler !== handler));
    },
    emit(name, event = {}) {
      for (const item of [...(listeners.get(name) || [])]) item.handler(event);
      return event;
    }
  };
}

function element(document, parent = null) {
  const attributes = new Map();
  return Object.assign(eventTarget(), {
    parent,
    attributes,
    hidden: false,
    open: false,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    contains(target) {
      for (let node = target; node; node = node.parent) {
        if (node === this) return true;
      }
      return false;
    },
    focus() {
      document.activeElement = this;
      document.emit("focusin", { target: this });
    }
  });
}

function fixture(options = {}) {
  const document = Object.assign(eventTarget(), {
    documentElement: { clientWidth: 1024 },
    activeElement: null
  });
  const nav = element(document);
  const toggle = element(document);
  toggle.setAttribute("aria-expanded", options.mobileOpen ? "true" : "false");
  const outside = element(document);
  const direct = element(document, nav);
  const groups = Array.from({length: 3}, (_, i) => {
    const node = element(document, nav);
    const summary = element(document, node);
    const panel = element(document, node);
    const links = Array.from({length: i + 2}, () => element(document, panel));
    const rectangles = {
      start: {left: 100 + i * 250, right: 300 + i * 250},
      end: {left: 40 + i * 250, right: 240 + i * 250}
    };
    panel.querySelectorAll = selector => {
      assert.equal(selector, "a[href]");
      return links;
    };
    panel.getBoundingClientRect = () => rectangles[node.getAttribute("data-nav-align") || "start"];
    node.querySelector = selector => selector === "summary" ? summary : selector === "[data-nav-panel]" ? panel : null;
    return {node, summary, panel, links, rectangles};
  });
  nav.querySelectorAll = selector => {
    assert.equal(selector, "[data-nav-group]");
    return options.empty ? [] : groups.map(group => group.node);
  };
  document.querySelector = selector => selector === "[data-grouped-navigation]" ?
    (options.noNav ? null : nav) : selector === "[data-nav-toggle]" ?
    (options.noToggle ? null : toggle) : null;
  const media = Object.assign(eventTarget(), {matches: !options.mobile});
  if (options.legacyMedia) {
    media.addListener = handler => eventTargetAdd("change", handler);
    media.removeListener = handler => eventTargetRemove("change", handler);
    const eventTargetAdd = media.addEventListener.bind(media);
    const eventTargetRemove = media.removeEventListener.bind(media);
    media.addEventListener = undefined;
    media.removeEventListener = undefined;
  }
  let observer;
  let nextFrame = 1;
  const frames = new Map();
  const cancelled = [];
  const window = Object.assign(eventTarget(), {
    innerWidth: 1024,
    matchMedia(query) {
      assert.equal(query, BREAKPOINT);
      return media;
    },
    MutationObserver: class {
      constructor(handler) {
        this.handler = handler;
        this.disconnected = false;
        observer = this;
      }
      observe(target, config) {
        this.target = target;
        this.config = config;
      }
      disconnect() { this.disconnected = true; }
    },
    requestAnimationFrame(handler) {
      const id = nextFrame++;
      frames.set(id, handler);
      return id;
    },
    cancelAnimationFrame(id) {
      cancelled.push(id);
      frames.delete(id);
    }
  });
  if (options.noObserver) delete window.MutationObserver;
  if (options.noFrame) delete window.requestAnimationFrame;
  if (options.restored) {
    groups[0].node.open = true;
    groups[1].node.open = true;
  }
  const api = mount(document, window);
  function key(target, key, extra = {}) {
    return document.emit("keydown", {
      target, key, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.stopped = true; },
      ...extra
    });
  }
  function nativeOpen(index) {
    groups[index].node.open = true;
    groups[index].node.emit("toggle");
  }
  function viewport(matches) {
    media.matches = matches;
    media.emit("change", {matches});
  }
  function flushFrames() {
    for (const [id, handler] of [...frames]) {
      frames.delete(id);
      handler();
    }
  }
  return {document, window, nav, toggle, outside, direct, groups, media,
    api, observer, frames, cancelled, key, nativeOpen, viewport, flushFrames};
}

test("alignment prefers start when both positions fit", () => {
  assert.equal(panelAlignment({left:20,right:200}, {left:50,right:230}, 400), "start");
});
test("alignment chooses end if start would overflow the right edge", () => {
  assert.equal(panelAlignment({left:320,right:500}, {left:180,right:360}, 400), "end");
});
test("alignment chooses start if end would overflow the left edge", () => {
  assert.equal(panelAlignment({left:30,right:210}, {left:-20,right:160}, 400), "start");
});
test("alignment compares overflow at both edges for oversized panels", () => {
  assert.equal(panelAlignment({left:-20,right:500}, {left:-50,right:420}, 400), "end");
});
test("alignment respects custom gutter", () => {
  assert.equal(panelAlignment({left:25,right:380}, {left:30,right:365}, 400, 30), "end");
});
test("focusable links excludes hidden, disabled and negative tab order", () => {
  const f = fixture();
  const {panel,links} = f.groups[2];
  links[0].hidden = true;
  links[1].setAttribute("aria-disabled","true");
  links[2].setAttribute("tabindex","-1");
  assert.deepEqual(focusableLinks(panel), [links[3]]);
  assert.deepEqual(focusableLinks(null), []);
});
test("mount tolerates missing navigation", () => assert.equal(fixture({noNav:true}).api, null));
test("mount tolerates empty navigation", () => assert.equal(fixture({empty:true}).api, null));
test("native open closes sibling groups", () => {
  const f=fixture();
  f.nativeOpen(0); f.nativeOpen(1);
  assert.equal(f.groups[0].node.open,false);
  assert.equal(f.groups[1].node.open,true);
});
test("restored groups retain the first open group", () => {
  const f=fixture({restored:true});
  assert.equal(f.groups[0].node.open,true);
  assert.equal(f.groups[1].node.open,false);
});
test("ArrowDown opens summary and focuses first link", () => {
  const f=fixture(); const g=f.groups[0];
  const e=f.key(g.summary,"ArrowDown");
  assert.equal(g.node.open,true);
  assert.equal(f.document.activeElement,g.links[0]);
  assert.equal(e.defaultPrevented,true);
});
test("ArrowUp opens summary and focuses last link", () => {
  const f=fixture(); const g=f.groups[2];
  f.key(g.summary,"ArrowUp");
  assert.equal(f.document.activeElement,g.links.at(-1));
});
test("ArrowDown wraps to the first link", () => {
  const f=fixture(); const g=f.groups[2];
  f.key(g.summary,"ArrowUp");
  f.key(g.links.at(-1),"ArrowDown");
  assert.equal(f.document.activeElement,g.links[0]);
});
test("ArrowUp wraps to the last link", () => {
  const f=fixture(); const g=f.groups[2];
  f.key(g.summary,"ArrowDown");
  f.key(g.links[0],"ArrowUp");
  assert.equal(f.document.activeElement,g.links.at(-1));
});
test("Home and End move to boundaries", () => {
  const f=fixture(); const g=f.groups[2];
  f.key(g.summary,"ArrowDown");
  f.key(g.links[0],"End");
  assert.equal(f.document.activeElement,g.links.at(-1));
  f.key(g.links.at(-1),"Home");
  assert.equal(f.document.activeElement,g.links[0]);
});
test("Tab and Shift+Tab retain native navigation", () => {
  const f=fixture(); const g=f.groups[0];
  f.key(g.summary,"ArrowDown");
  assert.equal(f.key(g.links[0],"Tab").defaultPrevented,false);
  assert.equal(f.key(g.links[0],"Tab",{shiftKey:true}).defaultPrevented,false);
});
test("modified and prevented arrow keys are ignored", () => {
  const f=fixture(); const g=f.groups[0];
  for(const modifier of ["altKey","ctrlKey","metaKey","shiftKey","defaultPrevented"]) {
    f.key(g.summary,"ArrowDown",{[modifier]:true});
    assert.equal(g.node.open,false);
  }
});
test("Escape closes the nested group before the outer menu", () => {
  const f=fixture({mobile:true,mobileOpen:true}); const g=f.groups[0];
  f.key(g.summary,"ArrowDown");
  const e=f.key(g.links[0],"Escape");
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,g.summary);
  assert.equal(e.stopped,true);
  assert.equal(e.defaultPrevented,true);
  assert.equal(f.key(g.summary,"Escape").stopped,false);
});
test("focus outside a group closes it without stealing focus", () => {
  const f=fixture(); const g=f.groups[0];
  f.key(g.summary,"ArrowDown");
  f.direct.focus();
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,f.direct);
});
test("click inside navigation preserves the open group", () => {
  const f=fixture(); f.nativeOpen(0);
  f.document.emit("click",{target:f.groups[0].summary});
  assert.equal(f.groups[0].node.open,true);
});
test("outside click closes navigation groups", () => {
  const f=fixture(); f.nativeOpen(0);
  f.document.emit("click",{target:f.outside});
  assert.equal(f.groups[0].node.open,false);
});
test("mobile menu closure restores focus from nested links", () => {
  const f=fixture({mobile:true,mobileOpen:true}); const g=f.groups[0];
  f.key(g.summary,"ArrowDown");
  f.toggle.setAttribute("aria-expanded","false");
  f.observer.handler();
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,f.toggle);
});
test("mobile menu closure leaves outside focus untouched", () => {
  const f=fixture({mobile:true,mobileOpen:true});
  f.nativeOpen(0); f.outside.focus();
  f.toggle.setAttribute("aria-expanded","false");
  f.observer.handler();
  assert.equal(f.document.activeElement,f.outside);
});
test("desktop to collapsed mobile layout restores toggle focus", () => {
  const f=fixture(); const g=f.groups[1];
  f.key(g.summary,"ArrowDown");
  f.viewport(false);
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,f.toggle);
});
test("mobile to desktop closes disclosures and restores summary focus", () => {
  const f=fixture({mobile:true,mobileOpen:true}); const g=f.groups[1];
  f.key(g.summary,"ArrowDown"); f.viewport(true);
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,g.summary);
});
test("desktop alignment switches when measured panel overflows", () => {
  const f=fixture(); const g=f.groups[2];
  g.rectangles.start={left:950,right:1200};
  g.rectangles.end={left:700,right:950};
  f.nativeOpen(2);
  assert.equal(g.node.getAttribute("data-nav-align"),"end");
});
test("mobile alignment does not retain a desktop position", () => {
  const f=fixture({mobile:true}); const g=f.groups[0];
  g.node.setAttribute("data-nav-align","end"); f.nativeOpen(0);
  assert.equal(g.node.getAttribute("data-nav-align"),null);
});
test("resize updates alignment once per animation frame", () => {
  const f=fixture(); const g=f.groups[2];
  f.nativeOpen(2);
  g.rectangles.start={left:950,right:1200};
  g.rectangles.end={left:700,right:950};
  f.window.emit("resize"); f.window.emit("resize");
  assert.equal(f.frames.size,1);
  f.flushFrames();
  assert.equal(g.node.getAttribute("data-nav-align"),"end");
});
test("resize falls back to immediate alignment without RAF", () => {
  const f=fixture({noFrame:true}); const g=f.groups[2];
  f.nativeOpen(2); g.rectangles.start={left:950,right:1200};
  g.rectangles.end={left:700,right:950}; f.window.emit("resize");
  assert.equal(g.node.getAttribute("data-nav-align"),"end");
});
test("legacy matchMedia listener supports viewport changes", () => {
  const f=fixture({legacyMedia:true}); const g=f.groups[0];
  f.key(g.summary,"ArrowDown"); f.viewport(false);
  assert.equal(g.node.open,false);
  assert.equal(f.document.activeElement,f.toggle);
});
test("missing observer or menu toggle does not disable keyboard navigation", () => {
  for(const options of [{noObserver:true},{noToggle:true}]) {
    const f=fixture(options); const g=f.groups[0];
    f.key(g.summary,"ArrowDown");
    assert.equal(g.node.open,true);
    assert.equal(f.document.activeElement,g.links[0]);
  }
});
test("closeAll is safe on multiple and already closed disclosures", () => {
  const f=fixture(); f.nativeOpen(0); f.api.closeAll(); f.api.closeAll();
  assert.ok(f.groups.every(g=>!g.node.open));
});
test("dispose removes listeners, disconnects observer and cancels pending work", () => {
  const f=fixture(); f.nativeOpen(0); f.window.emit("resize");
  assert.equal(f.frames.size,1);
  f.api.dispose(); f.api.dispose();
  assert.equal(f.frames.size,0);
  assert.equal(f.cancelled.length,1);
  assert.equal(f.observer.disconnected,true);
  for(const target of [f.document,f.window,f.media,...f.groups.map(g=>g.node)]) {
    assert.ok([...target.listeners.values()].every(items=>items.length===0));
  }
  f.key(f.groups[1].summary,"ArrowDown");
  assert.equal(f.groups[1].node.open,false);
});
