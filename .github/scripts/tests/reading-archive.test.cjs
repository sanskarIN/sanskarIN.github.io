// Tests the actual standalone browser module, including its DOM adapter.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const archive = require('../../../assets/js/reading-archive.js');

const records = [
  archive.createRecord({
    title: 'Compiler architecture', description: 'Rust and parser design',
    author: 'Sam', language: 'en', year: '2026', topics: ['Rust', 'compiler'],
    kind: 'article', files: 0,
  }),
  archive.createRecord({
    title: 'कंप्यूटर की संरचना', description: 'तकनीकी शोध',
    author: 'Sam', language: 'hi', year: '2026', topics: ['hardware', 'research'],
    kind: 'research', files: 3,
  }),
  archive.createRecord({
    title: 'Café systems', description: 'Research notes', author: 'Reader',
    language: 'fr', year: '2025', topics: ['research', 'systems'],
    kind: 'research', files: 1,
  }),
  archive.createRecord({
    title: 'Runtime tools', description: 'A project note',
    language: 'und', year: '2025', topics: ['Rust'], kind: 'article', files: 0,
  }),
];

function results(raw) {
  const state = archive.sanitize(raw, records);
  return records.filter(record => archive.matches(record, state)).map(record => record.title);
}

test('search combines title, author, description and topic terms', () => {
  assert.deepEqual(results({ q: 'parser sam RUST' }), ['Compiler architecture']);
  assert.deepEqual(results({ q: 'systems reader' }), ['Café systems']);
  assert.deepEqual(results({ q: 'no match here' }), []);
});

test('Unicode canonical equivalents work without erasing Indic vowel signs', () => {
  assert.deepEqual(results({ q: 'Cafe\u0301' }), ['Café systems']);
  assert.deepEqual(results({ q: 'कंप्यूटर संरचना' }), ['कंप्यूटर की संरचना']);
  assert.notEqual(archive.normalize('कि'), archive.normalize('क'));
  assert.notEqual(archive.normalize('कंप्यूटर'), archive.normalize('कपयटर'));
});

test('search treats regular expression syntax as ordinary text', () => {
  assert.deepEqual(results({ q: '.*' }), []);
  assert.deepEqual(results({ q: '[' }), []);
  assert.deepEqual(results({ q: '(a+)+' }), []);
});

test('language, year, topic, type and resources combine', () => {
  assert.deepEqual(results({
    language: 'hi', year: '2026', topic: 'research', kind: 'research', files: 'yes',
  }), ['कंप्यूटर की संरचना']);
  assert.deepEqual(results({ language: 'hi', year: '2025' }), []);
  assert.deepEqual(results({ topic: 'Rust', files: 'no' }), ['Compiler architecture', 'Runtime tools']);
  assert.deepEqual(results({ kind: 'article', files: 'yes' }), []);
  assert.deepEqual(results({ language: 'und' }), ['Runtime tools']);
});

test('filters match exact topic values, not substrings', () => {
  const items = [
    archive.createRecord({ title: 'One', topics: ['C'], language: 'en' }),
    archive.createRecord({ title: 'Two', topics: ['C++'], language: 'en' }),
  ];
  const state = archive.sanitize({ topic: 'C' }, items);
  assert.deepEqual(items.filter(item => archive.matches(item, state)).map(item => item.title), ['One']);
});

test('malformed, stale and unknown address values are ignored', () => {
  const state = archive.readAddress('?archive-language=xx&archive-year=1900&archive-topic=bad&archive-kind=bogus&archive-files=2', records);
  assert.deepEqual(state, archive.defaults());
  assert.equal(archive.active(state), false);
  assert.equal(archive.sanitize({ q: 'x'.repeat(1000) }, records).q.length, archive.LIMIT);
  assert.equal(archive.sanitize({ q: '  a   b  ' }, records).q, 'a   b');
});

test('address serialization preserves unrelated parameters, hash and Unicode', () => {
  const state = archive.sanitize({ q: 'कंप्यूटर + café', topic: 'research', files: 'yes' }, records);
  const url = archive.writeAddress({
    pathname: '/research/', search: '?utm_source=example&archive-year=2025', hash: '#archive-results',
  }, state);
  const parsed = new URL(url, 'https://example.test');
  assert.equal(parsed.pathname, '/research/');
  assert.equal(parsed.hash, '#archive-results');
  assert.equal(parsed.searchParams.get('utm_source'), 'example');
  assert.equal(parsed.searchParams.get('archive-year'), null);
  assert.deepEqual(archive.readAddress(parsed.search, records), state);
  const reset = archive.writeAddress(parsed, archive.defaults());
  assert.equal(reset, '/research/?utm_source=example#archive-results');
});

test('topic JSON is defensive and deduplicates only exact strings', () => {
  assert.deepEqual(archive.parseTopics('["Rust","Rust","C++","C","  systems  ",null,42,""]'),
    ['Rust', 'C++', 'C', 'systems']);
  assert.deepEqual(archive.parseTopics('{"topic":"Rust"}'), []);
  assert.deepEqual(archive.parseTopics('null'), []);
  assert.deepEqual(archive.parseTopics('not JSON'), []);
  assert.deepEqual(archive.parseTopics(undefined), []);
});

test('missing and malformed metadata has safe defaults', () => {
  const item = archive.createRecord({ files: NaN, kind: 'unexpected' });
  assert.equal(item.language, 'und');
  assert.equal(item.kind, 'article');
  assert.equal(item.files, false);
  assert.equal(item.text, '');
  assert.deepEqual(item.topics, []);
  assert.equal(archive.createRecord({ files: -1 }).files, false);
});

test('result announcements have correct singular and plural forms', () => {
  assert.equal(archive.countLabel(1, 1, 'publication'), 'Showing all 1 publication.');
  assert.equal(archive.countLabel(0, 1, 'research post'), 'Showing 0 of 1 research post.');
  assert.equal(archive.countLabel(1, 4, 'publication'), 'Showing 1 of 4 publications.');
  assert.equal(archive.countLabel(0, 0, 'publication'), 'Showing all 0 publications.');
});

function control(options = []) {
  const item = {
    hidden: false, disabled: false, value: '', textContent: '', listeners: {}, options: [],
    addEventListener(type, listener) { this.listeners[type] = listener; },
    emit(type) {
      assert.ok(this.listeners[type], 'missing handler for ' + type);
      this.listeners[type]({ preventDefault() {} });
    },
    appendChild(option) {
      option.remove = () => { this.options = this.options.filter(candidate => candidate !== option); };
      this.options.push(option);
    },
    focus() { this.focused = true; },
  };
  for (const [value, textContent] of options) item.appendChild({ value, textContent });
  return item;
}

function fixture(search = '', settings = {}) {
  const controls = {
    q: control(), language: control([['', 'All languages'], ['en', 'English'], ['hi', 'Hindi'],
      ['fr', 'French'], ['und', 'Other'], ['de', 'German']]),
    year: control([['', 'All years']]), topic: control([['', 'All topics']]),
    kind: settings.research ? null : control([['', 'All publications'], ['article', 'Articles'], ['research', 'Research']]),
    files: control([['', 'All publications'], ['yes', 'With resources'], ['no', 'Without resources']]),
  };
  const reset = control();
  const status = control();
  const empty = control();
  const form = {
    ...control(), hidden: true,
    querySelector(selector) {
      if (selector === '[data-archive-reset]') return reset;
      if (selector === '[data-archive-status]') return status;
      return controls[selector.match(/^\[data-archive-(.+)\]$/)[1]] || null;
    },
    getAttribute() { return settings.research ? 'research post' : 'publication'; },
  };
  const itemRecords = settings.empty ? [] : settings.research ? records.filter(r => r.kind === 'research') : records;
  const groups = [];
  for (const year of ['2026', '2025']) {
    const count = control();
    const entries = itemRecords.filter(record => record.year === year).map(record => ({
      hidden: false, title: record.title, textContent: record.text,
      querySelector() { return { textContent: record.title }; },
      getAttribute(name) {
        const attributes = {
          'data-archive-language': record.language,
          'data-archive-topics': JSON.stringify(record.topics),
          'data-archive-kind': record.kind,
          'data-archive-files': record.files ? '2' : '0',
        };
        return attributes[name] ?? null;
      },
    }));
    groups.push({
      hidden: false, year, count, entries,
      getAttribute() { return year; },
      querySelector() { return count; },
      querySelectorAll() { return entries; },
    });
  }
  const list = {
    querySelector() { return empty; },
    querySelectorAll() { return groups; },
  };
  const supplements = [{ hidden: false }, { hidden: false }];
  const document = {
    querySelector(selector) {
      if (selector === '[data-archive-filter]') return form;
      if (selector === '[data-archive-results]') return list;
      return null;
    },
    querySelectorAll() { return supplements; },
    createElement(tag) { assert.equal(tag, 'option'); return {}; },
  };
  const events = {};
  const location = { pathname: settings.research ? '/research/' : '/articles/', search, hash: '#archive-results' };
  let writes = 0;
  let last = '';
  const timers = new Map();
  let timerId = 0;
  const window = {
    location, history: {
      state: { preserved: true },
      replaceState(state, _title, address) {
        assert.deepEqual(state, { preserved: true });
        if (settings.blockHistory) throw new Error('history unavailable');
        writes++;
        last = address;
        const parsed = new URL(address, 'https://example.test');
        location.search = parsed.search;
        location.hash = parsed.hash;
      },
    },
    clearTimeout(id) { timers.delete(id); },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    addEventListener(name, fn) { events[name] = fn; },
  };
  const mounted = archive.mount(document, window);
  return {
    controls, groups, empty, status, reset, form, supplements, mounted,
    visible: () => groups.flatMap(group => group.entries).filter(item => !item.hidden).map(item => item.title),
    writes: () => writes, address: () => last,
    navigate(query) { location.search = query; events.popstate(); },
    flush() { for (const [id, fn] of timers) { timers.delete(id); fn(); } },
    pending: () => timers.size,
  };
}

test('mount restores bookmarked filters, actual language choices and year counts', () => {
  const dom = fixture('?archive-language=hi&archive-files=yes&utm_source=demo');
  assert.equal(dom.form.hidden, false);
  assert.deepEqual(dom.controls.language.options.map(x => x.value), ['', 'en', 'fr', 'hi', 'und']);
  assert.deepEqual(dom.controls.year.options.map(x => x.value), ['', '2026', '2025']);
  assert.ok(dom.controls.topic.options.some(option => option.value === 'compiler'));
  assert.deepEqual(dom.visible(), ['कंप्यूटर की संरचना']);
  assert.equal(dom.groups[1].hidden, true);
  assert.equal(dom.groups[0].count.textContent, '· 1 publication');
  assert.equal(dom.status.textContent, 'Showing 1 of 4 publications.');
  assert.ok(dom.supplements.every(item => item.hidden));
  assert.equal(dom.writes(), 0);
});

test('filter changes combine and clear restores all results and focus', () => {
  const dom = fixture('?utm_source=demo');
  dom.controls.topic.value = 'Rust';
  dom.controls.topic.emit('change');
  dom.controls.year.value = '2025';
  dom.controls.year.emit('change');
  assert.deepEqual(dom.visible(), ['Runtime tools']);
  assert.match(dom.address(), /archive-topic=Rust/);
  assert.match(dom.address(), /archive-year=2025/);
  assert.match(dom.address(), /utm_source=demo/);
  dom.controls.files.value = 'yes';
  dom.controls.files.emit('change');
  assert.deepEqual(dom.visible(), []);
  assert.equal(dom.empty.hidden, false);
  dom.reset.emit('click');
  assert.equal(dom.visible().length, 4);
  assert.equal(dom.empty.hidden, true);
  assert.equal(dom.reset.disabled, true);
  assert.equal(dom.controls.q.focused, true);
  assert.ok(dom.supplements.every(item => !item.hidden));
  assert.equal(dom.address(), '/articles/?utm_source=demo#archive-results');
});

test('typing updates results immediately while announcements are debounced', () => {
  const dom = fixture();
  dom.controls.q.value = 'Rust ';
  dom.controls.q.emit('input');
  assert.equal(dom.controls.q.value, 'Rust ');
  assert.equal(dom.visible().length, 2);
  assert.equal(dom.pending(), 1);
  dom.controls.q.value = 'Rust parser';
  dom.controls.q.emit('input');
  assert.equal(dom.pending(), 1);
  assert.deepEqual(dom.visible(), ['Compiler architecture']);
  dom.flush();
  assert.equal(dom.status.textContent, 'Showing 1 of 4 publications.');
});

test('popstate restores URL without rewriting history', () => {
  const dom = fixture();
  dom.navigate('?archive-year=2025&archive-kind=research');
  assert.deepEqual(dom.visible(), ['Café systems']);
  assert.equal(dom.controls.year.value, '2025');
  assert.equal(dom.controls.kind.value, 'research');
  assert.equal(dom.writes(), 0);
  dom.navigate('?archive-language=invalid');
  assert.equal(dom.visible().length, 4);
});

test('research page accepts missing publication-type selector', () => {
  const dom = fixture('?archive-kind=article&archive-language=fr', { research: true });
  assert.equal(dom.mounted.getState().kind, '');
  assert.deepEqual(dom.visible(), ['Café systems']);
  assert.equal(dom.status.textContent, 'Showing 1 of 2 research posts.');
});

test('blocked history does not prevent local filtering', () => {
  const dom = fixture('', { blockHistory: true });
  dom.controls.language.value = 'hi';
  dom.controls.language.emit('change');
  assert.deepEqual(dom.visible(), ['कंप्यूटर की संरचना']);
  assert.equal(dom.writes(), 0);
});

test('empty archives and missing controls fail closed', () => {
  assert.equal(fixture('', { empty: true }).mounted, null);
  assert.equal(archive.mount({ querySelector() { return null; } }, {}), null);
});

test('templates have named controls and server-rendered publication metadata', () => {
  const root = path.resolve(__dirname, '../../..');
  const shared = fs.readFileSync(path.join(root, '_includes/archive-filter.html'), 'utf8');
  for (const key of archive.KEYS) {
    const match = shared.match(new RegExp('<(?:input|select)[^>]*data-archive-' + key + '[^>]*>'));
    assert.ok(match, key + ' control is required');
    assert.match(match[0], /aria-controls="archive-results"/);
  }
  assert.match(shared, /role="status"/);
  assert.match(shared, /data-archive-filter[^>]* hidden/);
  const metadata = fs.readFileSync(path.join(root, '_includes/archive-item-attributes.html'), 'utf8');
  assert.match(metadata, /tags \| jsonify \| escape/);
  for (const page of ['articles', 'research']) {
    const markup = fs.readFileSync(path.join(root, page, 'index.html'), 'utf8');
    assert.match(markup, /scripts: \[reading-archive\]/);
    assert.match(markup, /id="archive-results"/);
    assert.match(markup, /data-archive-year-group/);
    assert.match(markup, /include archive-item-attributes.html post=post/);
    assert.match(markup, /include post-card.html post=post heading=4 documents=true/);
  }
});
