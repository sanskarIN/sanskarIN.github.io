// Browser-free regression checks for the regex tester and line diff.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const script = (file) => fs.readFileSync(path.join(root, 'assets/js', file), 'utf8');

function workerEngine() {
  const replies = [];
  const self = { postMessage: (value) => replies.push(value) };
  vm.runInNewContext(script('lab-regex-worker.js'), { self, RegExp, Error, Number, Set }, { timeout: 1500 });
  return { process: (data) => { self.onmessage({ data }); return replies.pop(); } };
}

test('regex worker handles captures, flags, and zero-length matches', () => {
  const engine = workerEngine();
  const found = engine.process({ id: 1, pattern: '(hi)', flags: 'gi', sample: 'Hi hi!' });
  assert.equal(found.ok, true);
  assert.equal(found.matches.length, 2);
  assert.equal(found.matches[0].start, 0);
  assert.equal(found.matches[0].groups[0], 'Hi');
  const empty = engine.process({ id: 2, pattern: '(?=a)', flags: 'g', sample: 'aaa' });
  assert.equal(empty.matches.length, 3);
  assert.equal(empty.truncated, false);
});

test('regex worker rejects invalid patterns, duplicate flags, oversize and caps matches', () => {
  const engine = workerEngine();
  for (const [pattern, flags, sample] of [['(', 'g', 'hi'], ['x', 'gg', 'x'], ['', 'g', 'x'], ['x'.repeat(257), '', 'x']]) {
    assert.equal(engine.process({ id: 10, pattern, flags, sample }).ok, false);
  }
  const many = engine.process({ id: 15, pattern: 'x', flags: 'g', sample: 'x'.repeat(300) });
  assert.equal(many.matches.length, 200);
  assert.equal(many.truncated, true);
});

class Element {
  constructor() {
    this.value = '';
    this.textContent = '';
    this.dataset = {};
    this.disabled = false;
    this.checked = false;
    this.events = {};
    this.children = [];
    this.className = '';
  }
  addEventListener(name, cb) { this.events[name] = cb; }
  trigger(name, event = {}) { assert.ok(this.events[name], 'missing event ' + name); this.events[name](event); }
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; }
  focus() { this.focused = true; }
}
function fakeDOM(selectors) {
  const elements = Object.fromEntries(selectors.map((name) => [name, new Element()]));
  const root = {
    dataset: { workerHref: '/assets/js/lab-regex-worker.js' },
    querySelector(selector) { return elements[selector] ?? null; },
    querySelectorAll() { return [elements['[data-regex-g]'], elements['[data-regex-i]']]; }
  };
  const document = { querySelector() { return root; }, createElement() { return new Element(); } };
  return { elements, document, get: (key) => elements['[data-' + key + ']'] };
}

test('diff compares changed, unchanged and inserted lines', async () => {
  const dom = fakeDOM(['[data-diff-before]','[data-diff-after]','[data-diff-compare]','[data-diff-example]','[data-diff-clear]','[data-diff-copy]','[data-diff-status]','[data-diff-output]']);
  const copied = [];
  const navigator = { clipboard: { writeText: (value) => { copied.push(value); return Promise.resolve(); } } };
  vm.runInNewContext(script('lab-diff.js'), { document: dom.document, navigator, Uint16Array, Math }, { timeout: 1500 });
  dom.get('diff-before').value = 'same\nold';
  dom.get('diff-after').value = 'same\nnew';
  dom.get('diff-compare').trigger('click');
  assert.equal(dom.get('diff-output').children.length, 3);
  assert.deepEqual(dom.get('diff-output').children.map((node) => node.textContent), ['  same', '− old', '+ new']);
  assert.match(dom.get('diff-status').textContent, /1 added · 1 removed/);
  dom.get('diff-copy').trigger('click');
  await Promise.resolve();
  assert.equal(copied[0], '  same\n- old\n+ new');
  dom.get('diff-after').trigger('input');
  assert.equal(dom.get('diff-output').children.length, 0);
  assert.equal(dom.get('diff-copy').disabled, true);
  dom.get('diff-example').trigger('click');
  assert.match(dom.get('diff-before').value, /Release notes/);
});

test('diff bounds work and never interprets user markup', () => {
  const dom = fakeDOM(['[data-diff-before]','[data-diff-after]','[data-diff-compare]','[data-diff-example]','[data-diff-clear]','[data-diff-copy]','[data-diff-status]','[data-diff-output]']);
  vm.runInNewContext(script('lab-diff.js'), { document: dom.document, navigator: {}, Uint16Array, Math }, { timeout: 1500 });
  dom.get('diff-before').value = '<script>danger</script>';
  dom.get('diff-after').value = 'safe';
  dom.get('diff-compare').trigger('click');
  assert.match(dom.get('diff-output').children[0].textContent, /<script>/);
  dom.get('diff-before').value = 'a\n'.repeat(301);
  dom.get('diff-compare').trigger('click');
  assert.match(dom.get('diff-status').textContent, /300 lines/);
  assert.equal(dom.get('diff-output').children.length, 0);
});

test('regex UI renders worker results without HTML and handles timeout', () => {
  const dom = fakeDOM(['[data-regex-pattern]','[data-regex-sample]','[data-regex-status]','[data-regex-results]','[data-regex-run]','[data-regex-example]','[data-regex-clear]','[data-regex-g]','[data-regex-i]']);
  dom.get('regex-g').checked = true;
  dom.get('regex-g').value = 'g';
  dom.get('regex-i').value = 'i';
  const instances = [];
  class WorkerStub {
    constructor() { instances.push(this); }
    postMessage(input) { this.data = input; }
    terminate() { this.terminated = true; }
  }
  let timeout;
  const window = { setTimeout: (fn) => { timeout = fn; return 1; }, clearTimeout() {} };
  vm.runInNewContext(script('lab-regex.js'), { document: dom.document, Worker: WorkerStub, window, Array, Boolean }, { timeout: 1500 });
  dom.get('regex-pattern').value = 'x';
  dom.get('regex-sample').value = '<img onerror=alert(1)>x';
  dom.get('regex-run').trigger('click');
  const w = instances.at(-1);
  assert.equal(w.data.pattern, 'x');
  w.onmessage({ data: { id: w.data.id, ok: true, matches: [{ start: 23, end: 24, value: 'x', groups: [] }], truncated: false } });
  assert.equal(dom.get('regex-results').children.length, 1);
  assert.equal(dom.get('regex-results').children[0].children[1].textContent, 'x');
  assert.equal(dom.get('regex-run').disabled, false);
  dom.get('regex-run').trigger('click');
  timeout();
  assert.match(dom.get('regex-status').textContent, /took too long/);
  assert.equal(instances.at(-1).terminated, true);
});
