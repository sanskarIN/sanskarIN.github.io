// Browser-free checks for Projects filtering, sorting, and shareable URLs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../../assets/js/projects.js'), 'utf8');

function project(name, owner, language, stars, bytes, search) {
  const values = {
    'data-name': name.toLowerCase(),
    'data-scope': owner,
    'data-language': language,
    'data-stars': String(stars),
    'data-code-bytes': String(bytes),
    'data-text': search || name.toLowerCase(),
  };
  return {
    name,
    hidden: false,
    getAttribute: (key) => values[key] ?? null,
  };
}

function setup(search = '') {
  const items = [
    project('Scarp', 'organization', 'Rust', 2, 1500, 'scarp-lang/scarp rust compiler'),
    project('RepoDNA', 'personal', 'Rust', 8, 4000, 'sanskarin/repodna rust cli'),
    project('LineLoom', 'personal', 'TypeScript', 2, 1500, 'sanskarin/lineloom editor'),
  ];
  const controls = {};
  function control(name, value = '', options = []) {
    const element = {
      value, options: options.map((option) => ({ value: option })),
      events: {}, hidden: false, textContent: '',
      addEventListener(type, listener) { this.events[type] = listener; },
      trigger(type) { assert.ok(this.events[type], 'missing ' + type); this.events[type]({ preventDefault() {} }); },
      focus() { this.focused = true; },
    };
    controls[name] = element;
    return element;
  }
  control('search');
  control('language', '', ['', 'Rust', 'TypeScript']);
  control('scope', '', ['', 'personal', 'organization']);
  control('sort', 'updated', ['updated', 'stars', 'code', 'name']);
  control('status');
  control('empty');
  control('reset');

  const form = {
    hidden: true, events: {},
    querySelector(selector) { return controls[selector.match(/data-repo-(\w+)/)[1]]; },
    addEventListener(type, listener) { this.events[type] = listener; },
  };
  const list = {
    children: items.slice(),
    appendChild(item) {
      const current = this.children.indexOf(item);
      if (current >= 0) this.children.splice(current, 1);
      this.children.push(item);
    }
  };
  const document = {
    querySelector(selector) {
      return selector === '[data-repo-filters]' ? form :
        selector === '[data-repo-list]' ? list :
        selector === '[data-repo-status]' ? controls.status :
        selector === '[data-repo-empty]' ? controls.empty :
        selector === '[data-repo-reset]' ? controls.reset : null;
    }
  };
  let address = '';
  const window = {
    location: { search, pathname: '/projects/', hash: '#list' },
    history: { replaceState(_state, _title, value) { address = value; } },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
  };
  vm.runInNewContext(source, { document, window, URLSearchParams }, { timeout: 1500 });
  return { items, controls, list, form, address: () => address };
}

test('ownership query and code-size sort are restored from the address', () => {
  const dom = setup('?scope=organization&sort=code&utm=source');
  assert.equal(dom.form.hidden, false);
  assert.equal(dom.controls.scope.value, 'organization');
  assert.equal(dom.controls.sort.value, 'code');
  assert.deepEqual(dom.list.children.map((entry) => entry.name), ['RepoDNA', 'Scarp', 'LineLoom']);
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['Scarp']);
  assert.match(dom.controls.status.textContent, /Showing 1 of 3/);

  dom.controls.scope.value = '';
  dom.controls.scope.trigger('change');
  assert.equal(dom.items.filter((entry) => !entry.hidden).length, 3);
  assert.match(dom.address(), /utm=source/);
  assert.match(dom.address(), /sort=code/);
  assert.doesNotMatch(dom.address(), /scope=/);
});

test('language, ownership, and text filters combine and reset', () => {
  const dom = setup();
  dom.controls.language.value = 'Rust';
  dom.controls.language.trigger('change');
  assert.equal(dom.items.filter((entry) => !entry.hidden).length, 2);
  dom.controls.scope.value = 'personal';
  dom.controls.scope.trigger('change');
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['RepoDNA']);
  dom.controls.search.value = 'scarp-lang';
  dom.controls.search.trigger('input');
  assert.equal(dom.controls.empty.hidden, false);
  assert.match(dom.controls.status.textContent, /Showing 0 of 3/);
  dom.controls.reset.trigger('click');
  assert.equal(dom.controls.search.value, '');
  assert.equal(dom.controls.language.value, '');
  assert.equal(dom.controls.scope.value, '');
  assert.equal(dom.items.filter((entry) => !entry.hidden).length, 3);
  assert.equal(dom.controls.search.focused, true);
});

test('invalid URL choices are ignored and sorting ties remain stable', () => {
  const dom = setup('?sort=unknown&scope=external');
  assert.equal(dom.controls.scope.value, '');
  assert.equal(dom.controls.sort.value, 'updated');
  dom.controls.sort.value = 'code';
  dom.controls.sort.trigger('change');
  assert.deepEqual(dom.list.children.map((entry) => entry.name), ['RepoDNA', 'Scarp', 'LineLoom']);
  dom.controls.sort.value = 'stars';
  dom.controls.sort.trigger('change');
  assert.deepEqual(dom.list.children.map((entry) => entry.name), ['RepoDNA', 'Scarp', 'LineLoom']);
});
