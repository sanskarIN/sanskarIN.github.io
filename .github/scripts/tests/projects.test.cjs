// Browser-free checks for Projects filtering, sorting, and shareable URLs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../../assets/js/projects.js'), 'utf8');

function project(name, owner, language, stars, bytes, search, languages = [language]) {
  const values = {
    'data-name': name.toLowerCase(),
    'data-scope': owner,
    'data-language': language,
    'data-languages': "|" + languages.join("|") + "|",
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
    project('Scarp', 'organization', 'Rust', 2, 1500, 'scarp-lang/scarp rust compiler', ['Rust', 'Python', 'C++']),
    project('RepoDNA', 'personal', 'Rust', 8, 4000, 'sanskarin/repodna rust cli', ['Rust', 'C++']),
    project('LineLoom', 'personal', 'TypeScript', 2, 1500, 'sanskarin/lineloom editor', ['TypeScript', 'C']),
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
  control('language', '', ['', 'Rust', 'TypeScript', 'Python', 'C', 'C++']);
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
    moves: 0,
    appendChild(item) {
      this.moves += 1;
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
  const windowEvents = {};
  const window = {
    location: { search, pathname: '/projects/', hash: '#list' },
    history: { replaceState(_state, _title, value) { address = value; } },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    addEventListener(type, listener) { windowEvents[type] = listener; },
  };
  vm.runInNewContext(source, { document, window, URLSearchParams }, { timeout: 1500 });
  return {
    items, controls, list, form, address: () => address,
    navigateTo(nextSearch) {
      window.location.search = nextSearch;
      assert.ok(windowEvents.popstate, 'missing history navigation handler');
      windowEvents.popstate();
    },
  };
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

test('language filters include secondary code languages without substring matches', () => {
  const dom = setup('?language=Python');
  assert.equal(dom.controls.language.value, 'Python');
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['Scarp']);

  dom.controls.language.value = 'C';
  dom.controls.language.trigger('change');
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['LineLoom']);
  assert.match(dom.address(), /language=C(?:&|#|$)/);

  dom.controls.language.value = 'C++';
  dom.controls.language.trigger('change');
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['Scarp', 'RepoDNA']);

  dom.controls.language.value = 'TypeScript';
  dom.controls.language.trigger('change');
  assert.deepEqual(dom.items.filter((entry) => !entry.hidden).map((entry) => entry.name), ['LineLoom']);
});

test('free-text search finds secondary languages while exact filters stay independent', () => {
  const dom = setup();
  dom.controls.search.value = 'python';
  dom.controls.search.trigger('input');
  assert.deepEqual(dom.items.filter((item) => !item.hidden).map((item) => item.name), ['Scarp']);

  dom.controls.search.value = 'C++';
  dom.controls.search.trigger('input');
  assert.deepEqual(dom.items.filter((item) => !item.hidden).map((item) => item.name), ['Scarp', 'RepoDNA']);

  dom.controls.search.value = 'typescript';
  dom.controls.search.trigger('input');
  assert.deepEqual(dom.items.filter((item) => !item.hidden).map((item) => item.name), ['LineLoom']);

  dom.controls.search.value = '';
  dom.controls.search.trigger('input');
  assert.equal(dom.items.filter((item) => !item.hidden).length, 3);
});

test('back-forward navigation restores all filters and drops stale URL choices', () => {
  const dom = setup('?q=repodna&language=Rust&scope=personal&sort=stars');
  assert.equal(dom.controls.search.value, 'repodna');
  assert.equal(dom.controls.language.value, 'Rust');
  assert.equal(dom.controls.scope.value, 'personal');
  assert.equal(dom.controls.sort.value, 'stars');
  assert.deepEqual(dom.items.filter((item) => !item.hidden).map((item) => item.name), ['RepoDNA']);

  dom.navigateTo('?q=python&language=Python&scope=organization&sort=code');
  assert.equal(dom.controls.search.value, 'python');
  assert.equal(dom.controls.language.value, 'Python');
  assert.equal(dom.controls.scope.value, 'organization');
  assert.equal(dom.controls.sort.value, 'code');
  assert.deepEqual(dom.items.filter((item) => !item.hidden).map((item) => item.name), ['Scarp']);

  dom.navigateTo('?sort=invalid&language=NotReal&scope=unknown');
  assert.equal(dom.controls.search.value, '');
  assert.equal(dom.controls.language.value, '');
  assert.equal(dom.controls.scope.value, '');
  assert.equal(dom.controls.sort.value, 'updated');
  assert.equal(dom.items.filter((item) => !item.hidden).length, 3);
  assert.equal(dom.address(), '', 'history navigation should not create another entry');
});

test('filter changes do not reorder repository DOM; actual sorting does', () => {
  const dom = setup();
  assert.equal(dom.list.moves, 0, 'default server order should remain intact');
  dom.controls.search.value = 'rust';
  dom.controls.search.trigger('input');
  dom.controls.language.value = 'Rust';
  dom.controls.language.trigger('change');
  assert.equal(dom.list.moves, 0, 'typing and filtering should only toggle visibility');

  dom.controls.sort.value = 'name';
  dom.controls.sort.trigger('change');
  assert.equal(dom.list.moves, dom.items.length);
  assert.deepEqual(dom.list.children.map((entry) => entry.name), ['LineLoom', 'RepoDNA', 'Scarp']);

  dom.controls.search.value = '';
  dom.controls.search.trigger('input');
  assert.equal(dom.list.moves, dom.items.length, 'typing after sorting must not reorder again');
  dom.controls.sort.value = 'updated';
  dom.controls.sort.trigger('change');
  assert.equal(dom.list.moves, dom.items.length * 2);
  assert.deepEqual(dom.list.children.map((entry) => entry.name), ['Scarp', 'RepoDNA', 'LineLoom']);
});

test('result status explains sorting, zero results and clearing filters', () => {
  const dom = setup();
  assert.equal(dom.controls.status.textContent, '', 'initial unfiltered load stays quiet');
  dom.controls.sort.value = 'stars';
  dom.controls.sort.trigger('change');
  assert.match(dom.controls.status.textContent, /Showing all 3 repositories/);
  assert.match(dom.controls.status.textContent, /Sorted by most stars/);

  dom.controls.search.value = 'no-such-repository';
  dom.controls.search.trigger('input');
  assert.equal(dom.controls.empty.hidden, false);
  assert.match(dom.controls.status.textContent, /Showing 0 of 3 repositories/);
  dom.controls.reset.trigger('click');
  assert.equal(dom.controls.empty.hidden, true);
  assert.match(dom.controls.status.textContent, /Showing all 3 repositories/);
});

test('project filters have accessible target and help text in the rendered template', () => {
  const markup = fs.readFileSync(path.resolve(__dirname, '../../../projects/index.html'), 'utf8');
  assert.match(markup, /id="repo-filter-note"/);
  assert.match(markup, /aria-describedby="repo-filter-note"/);
  assert.match(markup, /id="repo-results" aria-labelledby="all-title"/);
  for (const attr of ['data-repo-search', 'data-repo-language', 'data-repo-scope', 'data-repo-sort']) {
    const input = markup.match(new RegExp('<(?:input|select)[^>]*' + attr + '[^>]*>'));
    assert.ok(input, attr + ' must exist');
    assert.match(input[0], /aria-controls="repo-results"/);
  }
});
