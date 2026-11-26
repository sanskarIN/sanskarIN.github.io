// Browser-free integration checks for the lazy-loaded site search.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../../assets/js/search.js'), 'utf8');

function setup(responses) {
  const nodes = [];
  class Element {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.attributes = {};
      this.events = {};
      this.textContent = '';
      this.value = '';
      nodes.push(this);
    }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(type, callback) { this.events[type] = callback; }
    showModal() { this.open = true; }
    close() { this.open = false; this.events.close?.(); }
    focus() {}
    select() {}
    querySelectorAll(selector) {
      assert.equal(selector, '[role="option"]');
      return this.children.flatMap((child) => child.children || [])
        .filter((child) => child.getAttribute('role') === 'option');
    }
  }
  const document = {
    createElement: (tag) => new Element(tag),
    createElementNS: (_ns, tag) => new Element(tag),
    createTextNode: (text) => ({ textContent: text }),
    createDocumentFragment: () => new Element('fragment'),
    body: new Element('body'),
    documentElement: { classList: { add() {}, remove() {} } },
    contains: () => true,
    activeElement: null,
  };
  const trigger = new Element('button');
  trigger.setAttribute('data-search-index', '/search.json');
  trigger.setAttribute('data-search-sprite', '/icons.svg');
  let requests = 0;
  const window = {
    fetch: async (url) => {
      assert.equal(url, '/search.json');
      const next = responses[requests++];
      if (next instanceof Error) throw next;
      return next;
    },
    clearTimeout() {},
    setTimeout(callback) { callback(); return 1; },
  };
  vm.runInNewContext(source, { window, document, HTMLElement: Element }, { timeout: 1500 });
  return {
    async open(query = 'compiler') {
      window.siteSearch.open(trigger, query);
      await new Promise(setImmediate);
    },
    close() { nodes.find((node) => node.tagName === 'dialog').close(); },
    status: () => nodes.find((node) => node.className === 'search-dialog__status').textContent,
    requests: () => requests,
  };
}
const response = (data) => ({ ok: true, json: async () => data });
const valid = response([{ type: 'Page', title: 'Compiler', url: '/compiler/' }]);
const failures = [
  ['network rejection', new Error('offline')],
  ['HTTP failure', { ok: false, status: 503 }],
  ['invalid JSON', { ok: true, json: async () => { throw new SyntaxError('bad JSON'); } }],
  ['non-array index', response({ entries: [] })],
  ['null entry', response([null])],
  ['invalid entry type', response([{ type: 'Other', title: 'Compiler', url: '/compiler/' }])],
  ['invalid tags', response([{ type: 'Page', title: 'Compiler', url: '/compiler/', tags: 'compiler' }])],
  ['invalid title', response([{ type: 'Page', title: 42, url: '/compiler/' }])],
];
for (const [name, failure] of failures) {
  test('search recovers after ' + name, async () => {
    const dom = setup([failure, valid]);
    await dom.open();
    assert.match(dom.status(), /Close and reopen search to try again/);
    assert.equal(dom.requests(), 1);
    dom.close();
    await dom.open();
    assert.match(dom.status(), /1 result\./);
    assert.equal(dom.requests(), 2);
    dom.close();
    await dom.open();
    assert.match(dom.status(), /1 result\./);
    assert.equal(dom.requests(), 2, 'a successfully loaded index is reused');
  });
}
test('an empty valid index does not trigger an error', async () => {
  const dom = setup([response([])]);
  await dom.open();
  assert.match(dom.status(), /No results/);
  dom.close();
  await dom.open();
  assert.equal(dom.requests(), 1);
});
