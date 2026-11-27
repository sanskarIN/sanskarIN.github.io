// Resource library tests exercise sorting, filtering and the actual DOM adapter.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const library = require("../../../assets/js/resource-library.js");

const inputs = [
  { title: "Computer architecture 2", source: "Computer architecture", name: "guide.pdf",
    author: "Lab", format: "PDF", bytes: 6000000, language: "en", date: "2026-11-20" },
  { title: "Computer architecture 10", source: "Computer architecture", name: "slides.pptx",
    author: "Lab", format: "PPTX", bytes: 4000000, language: "en", date: "2026-11-20" },
  { title: "कंप्यूटर", source: "तकनीकी शोध", name: "source.md",
    author: "Reader", format: "MD", bytes: 1000, language: "hi", date: "2026-05-10" },
  { title: "Café references", source: "Notes", name: "sources.bib",
    author: "Reader", format: "BIB", bytes: 500, language: "fr", date: "2025-12-01" },
  { title: "Computer architecture 2", source: "Computer architecture", name: "guide.html",
    author: "Lab", format: "HTML", bytes: 1000000, language: "en", date: "2025-01-01" },
  { title: "Compilers", source: "Systems", name: "guide.docx",
    author: "Writer", format: "DOCX", bytes: 5000000, language: "und", date: "2024-01-01" },
];
const records = inputs.map(library.createRecord);

function matches(raw) {
  const state = library.sanitize(raw, records);
  return records.filter(record => library.matches(record, state)).map(record => record.name);
}

test("free-text search covers source, file format, author and filename", () => {
  assert.deepEqual(matches({ q: "computer lab" }), ["guide.pdf", "slides.pptx", "guide.html"]);
  assert.deepEqual(matches({ q: "powerpoint" }), ["slides.pptx"]);
  assert.deepEqual(matches({ q: "sources.bib reader" }), ["sources.bib"]);
  assert.deepEqual(matches({ q: "word systems" }), ["guide.docx"]);
  assert.deepEqual(matches({ q: "[.*" }), []);
});

test("Unicode search retains Indic marks and canonical equivalent Latin accents", () => {
  assert.deepEqual(matches({ q: "कंप्यूटर" }), ["source.md"]);
  assert.deepEqual(matches({ q: "Cafe\u0301" }), ["sources.bib"]);
  assert.notEqual(library.normalize("कि"), library.normalize("क"));
});

test("all resource filters combine using exact values", () => {
  assert.deepEqual(matches({ format: "PDF", language: "en", year: "2026", size: "large" }), ["guide.pdf"]);
  assert.deepEqual(matches({ language: "en", year: "2026", size: "medium" }), ["slides.pptx"]);
  assert.deepEqual(matches({ format: "HTML", year: "2026" }), []);
  assert.deepEqual(matches({ language: "und" }), ["guide.docx"]);
});

test("file-size categories use exact decimal megabyte boundaries", () => {
  assert.deepEqual(matches({ size: "small" }), ["source.md", "sources.bib"]);
  assert.deepEqual(matches({ size: "medium" }), ["slides.pptx", "guide.html"]);
  assert.deepEqual(matches({ size: "large" }), ["guide.pdf", "guide.docx"]);
  const sizes = [999999, 1000000, 4999999, 5000000];
  const expected = ["small", "medium", "medium", "large"];
  for (let index = 0; index < sizes.length; index++) {
    const record = library.createRecord({ bytes: sizes[index] }, index);
    assert.equal(library.matches(record, { ...library.defaults(), size: expected[index] }), true);
  }
});

test("sorting is stable, numeric and does not modify source records", () => {
  const names = sort => library.sortRecords(records, sort).map(record => record.name);
  assert.deepEqual(names("newest"), inputs.map(input => input.name));
  assert.deepEqual(names("largest"), ["guide.pdf", "guide.docx", "slides.pptx", "guide.html", "source.md", "sources.bib"]);
  assert.deepEqual(names("smallest"), ["sources.bib", "source.md", "guide.html", "slides.pptx", "guide.docx", "guide.pdf"]);
  assert.deepEqual(names("oldest"), ["guide.docx", "guide.html", "sources.bib", "source.md", "guide.pdf", "slides.pptx"]);
  const alphabetical = names("title");
  assert.ok(alphabetical.indexOf("guide.pdf") < alphabetical.indexOf("slides.pptx"));
  assert.ok(alphabetical.indexOf("guide.pdf") < alphabetical.indexOf("guide.html"));
  assert.deepEqual(records.map(record => record.name), inputs.map(input => input.name));
});

test("records defensively normalize invalid metadata", () => {
  const bad = library.createRecord({ bytes: -1, date: "not-a-date", format: " pdf " }, 0);
  assert.equal(bad.bytes, 0);
  assert.equal(bad.date, "");
  assert.equal(bad.language, "und");
  assert.equal(bad.format, "PDF");
  assert.equal(library.createRecord({ bytes: Infinity }, 1).bytes, 0);
  assert.equal(library.createRecord({ bytes: 1.5 }, 2).bytes, 0);
});

test("invalid URL choices are ignored and input length is bounded", () => {
  const state = library.readAddress("?resource-format=unknown&resource-language=xx&resource-year=1900&resource-size=__proto__&resource-sort=constructor", records);
  assert.deepEqual(state, library.defaults());
  assert.equal(library.active(state), false);
  assert.equal(library.sanitize({ q: "x".repeat(1000) }, records).q.length, library.QUERY_LIMIT);
});

test("URL state preserves unrelated parameters, anchors and Unicode", () => {
  const state = library.sanitize({ q: "कंप्यूटर + café", format: "PDF", size: "large", sort: "largest" }, records);
  const address = library.writeAddress({ pathname: "/resources/", search: "?utm_campaign=demo&resource-year=2025", hash: "#resource-results" }, state);
  const parsed = new URL(address, "https://example.test");
  assert.equal(parsed.searchParams.get("utm_campaign"), "demo");
  assert.equal(parsed.searchParams.get("resource-year"), null);
  assert.deepEqual(library.readAddress(parsed.search, records), state);
  assert.equal(parsed.hash, "#resource-results");
  assert.equal(library.writeAddress(parsed, library.defaults()), "/resources/?utm_campaign=demo#resource-results");
});

test("sizes are shown accurately, including small documents", () => {
  for (const [bytes, label] of [[0, "0 bytes"], [1, "1 byte"], [512, "512 bytes"], [1000, "1 KB"],
    [1234, "1.23 KB"], [1000000, "1 MB"], [2500000, "2.5 MB"], [1000000000, "1 GB"]]) {
    assert.equal(library.formatBytes(bytes), label);
  }
  assert.equal(library.formatBytes(-1), "Unknown size");
  assert.equal(library.formatBytes(NaN), "Unknown size");
});

test("result summary reports matching total size and active sorting", () => {
  const visible = records.filter(record => record.format === "PDF");
  assert.equal(library.resultMessage(visible, records.length, { ...library.defaults(), sort: "largest" }),
    "Showing 1 of 6 documents · 6 MB in matching files · Sorted by largest files.");
  assert.equal(library.resultMessage([], 1, library.defaults()), "Showing 0 of 1 document.");
});

function control(options = []) {
  const node = {
    value: "", hidden: false, disabled: false, textContent: "", events: {}, options: [],
    addEventListener(name, listener) { this.events[name] = listener; },
    emit(name) { this.events[name]({ preventDefault() {} }); },
    appendChild(option) {
      option.remove = () => { this.options = this.options.filter(item => item !== option); };
      this.options.push(option);
    },
    focus() { this.focused = true; },
  };
  for (const [value, textContent] of options) node.appendChild({ value, textContent });
  return node;
}

function fixture(search = "", settings = {}) {
  const controls = {
    q: control(), format: control([["", "All formats"], ...Object.entries(library.FORMATS)]),
    language: control([["", "All languages"], ["en", "English"], ["hi", "Hindi"], ["fr", "French"], ["de", "German"], ["und", "Other"]]),
    year: control([["", "All years"]]), size: control(), sort: control(),
  };
  const reset = control();
  const status = control();
  const empty = control();
  const form = {
    ...control(), hidden: true,
    querySelector(selector) {
      if (selector === "[data-resource-reset]") return reset;
      if (selector === "[data-resource-status]") return status;
      return controls[selector.match(/data-resource-filter-(.+)\]/)[1]] || null;
    },
  };
  const nodes = (settings.empty ? [] : inputs).map(input => ({
    hidden: false, name: input.name,
    getAttribute(key) { return String(input[key.replace("data-resource-", "")] ?? ""); },
  }));
  const list = {
    children: nodes.slice(), moves: 0,
    querySelectorAll() { return nodes; },
    appendChild(node) {
      this.moves++;
      this.children.splice(this.children.indexOf(node), 1);
      this.children.push(node);
    },
  };
  const document = {
    querySelector(selector) {
      if (selector === "[data-resource-filter]") return form;
      if (selector === "[data-resource-list]") return list;
      if (selector === "[data-resource-empty]") return empty;
      return null;
    },
    createElement(tag) { assert.equal(tag, "option"); return {}; },
  };
  const timers = new Map();
  const events = {};
  const location = { pathname: "/resources/", search, hash: "#resource-results" };
  let address = "";
  let sequence = 0;
  const window = {
    location, history: {
      state: { preserved: true },
      replaceState(state, _title, value) {
        assert.deepEqual(state, { preserved: true });
        if (settings.blockHistory) throw new Error("History unavailable");
        address = value;
        const url = new URL(value, "https://example.test");
        location.search = url.search;
      },
    },
    clearTimeout(id) { timers.delete(id); },
    setTimeout(fn) { timers.set(++sequence, fn); return sequence; },
    addEventListener(name, listener) { events[name] = listener; },
  };
  const mounted = library.mount(document, window);
  return {
    controls, reset, status, empty, form, list, mounted,
    visible: () => list.children.filter(node => !node.hidden).map(node => node.name),
    address: () => address,
    navigate(query) { location.search = query; events.popstate(); },
    flush() { for (const [id, fn] of timers) { timers.delete(id); fn(); } },
    pending: () => timers.size,
  };
}

test("mounted library restores bookmarks and populates only available options", () => {
  const dom = fixture("?resource-language=en&resource-size=large&resource-sort=largest");
  assert.equal(dom.form.hidden, false);
  assert.deepEqual(dom.visible(), ["guide.pdf"]);
  assert.equal(dom.controls.sort.value, "largest");
  assert.ok(!dom.controls.language.options.some(option => option.value === "de"));
  assert.deepEqual(dom.controls.year.options.map(option => option.value), ["", "2026", "2025", "2024"]);
  assert.match(dom.status.textContent, /6 MB/);
  assert.equal(dom.address(), "");
});

test("filter changes do not reorder DOM nodes, but sort changes do", () => {
  const dom = fixture();
  assert.equal(dom.list.moves, 0);
  dom.controls.format.value = "PDF";
  dom.controls.format.emit("change");
  assert.equal(dom.list.moves, 0);
  dom.controls.sort.value = "largest";
  dom.controls.sort.emit("change");
  assert.equal(dom.list.moves, records.length);
  assert.deepEqual(dom.visible(), ["guide.pdf"]);
  dom.controls.format.value = "";
  dom.controls.format.emit("change");
  assert.equal(dom.list.moves, records.length);
  assert.deepEqual(dom.visible().slice(0, 2), ["guide.pdf", "guide.docx"]);
});

test("reset clears sorting and filters, restores focus and keeps unrelated URL state", () => {
  const dom = fixture("?utm_source=example&resource-sort=smallest");
  dom.controls.q.value = "not present";
  dom.controls.q.emit("input");
  assert.equal(dom.empty.hidden, false);
  dom.reset.emit("click");
  assert.equal(dom.empty.hidden, true);
  assert.equal(dom.controls.q.focused, true);
  assert.equal(dom.reset.disabled, true);
  assert.deepEqual(dom.visible(), inputs.map(item => item.name));
  assert.equal(dom.address(), "/resources/?utm_source=example#resource-results");
});

test("history navigation restores all controls without writing another URL", () => {
  const dom = fixture();
  dom.navigate("?resource-language=hi&resource-year=2026");
  assert.deepEqual(dom.visible(), ["source.md"]);
  assert.equal(dom.controls.language.value, "hi");
  assert.equal(dom.address(), "");
  dom.navigate("?resource-sort=oldest");
  assert.equal(dom.visible()[0], "guide.docx");
});

test("typing changes visibility immediately and debounces announcements", () => {
  const dom = fixture();
  dom.controls.q.value = "computer ";
  dom.controls.q.emit("input");
  assert.equal(dom.controls.q.value, "computer ");
  assert.equal(dom.visible().length, 3);
  dom.controls.q.value = "computer pdf";
  dom.controls.q.emit("input");
  assert.equal(dom.pending(), 1);
  assert.deepEqual(dom.visible(), ["guide.pdf"]);
  dom.flush();
  assert.match(dom.status.textContent, /Showing 1 of 6/);
});

test("restricted history and empty libraries have safe fallback behavior", () => {
  const dom = fixture("", { blockHistory: true });
  dom.controls.year.value = "2024";
  dom.controls.year.emit("change");
  assert.deepEqual(dom.visible(), ["guide.docx"]);
  assert.equal(dom.address(), "");
  assert.equal(fixture("", { empty: true }).mounted, null);
  assert.equal(library.mount({ querySelector() { return null; } }, {}), null);
});

test("published resource templates preserve labels, metadata and download safety", () => {
  const root = path.resolve(__dirname, "../../..");
  const page = fs.readFileSync(path.join(root, "resources/index.html"), "utf8");
  const controls = fs.readFileSync(path.join(root, "_includes/resource-filter.html"), "utf8");
  assert.match(page, /scripts: \[resource-library\]/);
  assert.match(page, /data-resource-item/);
  assert.match(page, /data-resource-list/);
  assert.match(page, /id="resource-results"/);
  assert.match(page, /download="{{ attachment.name \| escape }}"/);
  assert.match(page, /include file-size.html bytes=attachment.bytes/);
  assert.match(page, /elsif attachment.format == "PDF"/);
  for (const key of library.KEYS) {
    const match = controls.match(new RegExp('<(?:input|select)[^>]*data-resource-filter-' + key + '[^>]*>'));
    assert.ok(match, key + " filter must exist");
    assert.match(match[0], /aria-controls="resource-results"/);
  }
  assert.match(controls, /data-resource-filter hidden/);
  assert.match(controls, /role="status"/);
});
