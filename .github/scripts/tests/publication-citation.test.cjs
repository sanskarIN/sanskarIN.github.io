// Reference formats and browser integration, using the shipped script.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const citation = require("../../../assets/js/publication-citation.js");

const sample = {
  title: "Compiler Architecture & Design",
  subtitle: "A practical introduction",
  author: "Research Group",
  site: "Engineering Notes",
  date: "2026-09-15",
  updated: "2026-11-27",
  url: "https://example.test/research/compiler/#methods",
  language: "en",
  version: "1.2",
};

test("validates publication and update dates without guessing", () => {
  assert.deepEqual(citation.parseDate("2024-02-29"), { iso: "2024-02-29", year: 2024, month: 2, day: 29 });
  for (const invalid of ["2026-02-29", "1900-02-29", "2026-04-31", "0000-01-01", "2026-00-01", "2026-01-00", "2026-1-1", "tomorrow"]) {
    assert.equal(citation.parseDate(invalid), null, invalid);
  }
  assert.ok(citation.parseDate("2000-02-29"));
  assert.equal(citation.normalizeMetadata({ ...sample, updated: "2025-01-01" }).updated, null);
  assert.equal(citation.normalizeMetadata({ ...sample, date: "invalid" }), null);
});

test("references reject unsafe or relative publication URLs", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,x", "/blog/post/", "https://a:b@example.test/", "not a URL", "file:///tmp/file"]) {
    assert.equal(citation.normalizeMetadata({ ...sample, url }), null, url);
  }
  assert.equal(citation.canonicalUrl(sample.url), "https://example.test/research/compiler/");
  assert.equal(citation.canonicalUrl("http://localhost:4000/article/"), "http://localhost:4000/article/");
});

test("citation keys are stable and distinguish different publications", () => {
  const meta = citation.normalizeMetadata(sample);
  assert.equal(meta.key, citation.normalizeMetadata({ ...sample, title: "Revised title" }).key);
  assert.notEqual(meta.key, citation.normalizeMetadata({ ...sample, url: "https://example.test/blog/compiler/" }).key);
  assert.match(meta.key, /^p2026-compiler-[a-f0-9]{8}$/);
  const nonLatin = citation.normalizeMetadata({ ...sample, title: "कंप्यूटर", url: "https://example.test/कंप्यूटर/" });
  assert.match(nonLatin.key, /^p2026-publication-[a-f0-9]{8}$/);
});

test("plain reference preserves verified public metadata", () => {
  const value = citation.plainReference(citation.normalizeMetadata(sample));
  assert.match(value, /^Research Group\. \(2026-09-15\)\./);
  assert.match(value, /Compiler Architecture & Design: A practical introduction/);
  assert.match(value, /Engineering Notes/);
  assert.match(value, /Version 1\.2/);
  assert.match(value, /Updated 2026-11-27/);
  assert.ok(value.endsWith("https://example.test/research/compiler/"));
});

test("absent optional metadata is omitted rather than invented", () => {
  const meta = citation.normalizeMetadata({ title: "A note", date: sample.date, url: sample.url });
  const text = citation.serialize(meta, "text");
  assert.doesNotMatch(text, /undefined|null|Anonymous|Version|Updated/);
  const entry = JSON.parse(citation.serialize(meta, "csl"))[0];
  assert.equal(entry.author, undefined);
  assert.equal(entry["container-title"], undefined);
  assert.equal(entry.DOI, undefined);
  assert.equal(entry.language, undefined);
});

test("Markdown escaping protects punctuation and preserves the canonical link", () => {
  const meta = citation.normalizeMetadata({ ...sample, title: "[Rust] _tool_", subtitle: "", url: "https://example.test/research/(test)/" });
  const value = citation.serialize(meta, "markdown");
  assert.ok(value.includes("\\[Rust\\] \\_tool\\_"));
  assert.ok(value.includes("](<https://example.test/research/(test)/>)"));
});

test("BibTeX escapes special characters and uses literal display names", () => {
  const meta = citation.normalizeMetadata({ ...sample, author: "Lab & Partners", title: "C# {Rust} 50% _x $y", subtitle: "" });
  const bib = citation.serialize(meta, "bibtex");
  assert.ok(bib.startsWith("@misc{" + meta.key));
  assert.ok(bib.includes("author = {{Lab \\& Partners}}"));
  assert.ok(bib.includes("title = {{C\\# \\{Rust\\} 50\\% \\_x \\$y}}"));
  assert.ok(bib.includes("date = {2026-09-15}"));
  assert.ok(bib.includes("url = {https://example.test/research/compiler/}"));
  assert.ok(bib.endsWith("}\n"));
});

test("RIS line breaks in public metadata cannot create injected fields", () => {
  const meta = citation.normalizeMetadata({ ...sample, title: "Title\nER  - \nTY  - JOUR" });
  const lines = citation.serialize(meta, "ris").split("\r\n");
  assert.equal(lines[0], "TY  - ELEC");
  assert.equal(lines.filter(line => line.startsWith("TY  - ")).length, 1);
  assert.equal(lines.filter(line => line.startsWith("ER  - ")).length, 1);
  assert.ok(lines.includes("DA  - 2026/09/15"));
  assert.ok(lines.includes("AU  - Research Group"));
  assert.ok(lines.includes("UR  - https://example.test/research/compiler/"));
});

test("CSL JSON is structured, Unicode-safe and retains the issued date", () => {
  const meta = citation.normalizeMetadata({ ...sample, title: "कंप्यूटर की संरचना", subtitle: "", language: "hi" });
  const data = JSON.parse(citation.serialize(meta, "csl"));
  assert.equal(data.length, 1);
  assert.equal(data[0].type, "webpage");
  assert.equal(data[0].title, "कंप्यूटर की संरचना");
  assert.deepEqual(data[0].issued, { "date-parts": [[2026, 9, 15]] });
  assert.deepEqual(data[0].author, [{ literal: "Research Group" }]);
  assert.equal(data[0].language, "hi");
  assert.equal(data[0].version, "1.2");
});

test("format selectors and filenames are restricted to supported types", () => {
  const meta = citation.normalizeMetadata(sample);
  for (const [format, extension] of [["text", "txt"], ["markdown", "md"], ["bibtex", "bib"], ["ris", "ris"], ["csl", "json"]]) {
    assert.ok(citation.serialize(meta, format).length > 0);
    assert.equal(citation.filename(meta, format), meta.key + "." + extension);
  }
  assert.equal(citation.getFormat("__proto__"), "text");
  assert.equal(citation.getFormat("constructor"), "text");
  assert.equal(citation.getFormat("unsupported"), "text");
});

function control() {
  return {
    hidden: true, value: "", textContent: "", listeners: {},
    addEventListener(name, listener) { this.listeners[name] = listener; },
    emit(name) { return this.listeners[name](); },
    focus() { this.focused = true; },
    select() { this.selected = true; },
  };
}

function fixture(options = {}) {
  const controls = Object.fromEntries(["controls", "format", "output", "copy", "download", "status"].map(key => [key, control()]));
  const metadata = options.metadata || sample;
  const panel = {
    getAttribute(name) { return metadata[name.replace("data-citation-", "")] || ""; },
    querySelector(selector) { return controls[selector.match(/data-citation-(.+)\]/)[1]] || null; },
  };
  const writes = [];
  const blobs = [];
  const links = [];
  const revoked = [];
  const timers = [];
  const window = {
    isSecureContext: !options.insecure,
    navigator: {
      clipboard: {
        async writeText(value) {
          if (options.rejectClipboard) throw new Error("Denied");
          writes.push(value);
        },
      },
    },
    Blob: class {
      constructor(parts, config) { this.parts = parts; this.type = config.type; blobs.push(this); }
    },
    URL: {
      createObjectURL() { return "blob:reference"; },
      revokeObjectURL(value) { revoked.push(value); },
    },
    setTimeout(fn) { timers.push(fn); },
  };
  if (options.noBlob) delete window.Blob;
  const document = {
    querySelector() { return options.noPanel ? null : panel; },
    createElement(tag) {
      assert.equal(tag, "a");
      const node = { click() { this.clicked = true; }, remove() { this.removed = true; } };
      links.push(node);
      return node;
    },
    body: { appendChild(node) { node.appended = true; } },
  };
  const mounted = citation.mount(document, window);
  return { mounted, controls, writes, links, blobs, revoked, timers };
}

test("browser panel renders the selected format and copies on explicit action", async () => {
  const dom = fixture();
  assert.equal(dom.controls.controls.hidden, false);
  assert.equal(dom.controls.format.value, "text");
  assert.equal(dom.writes.length, 0);
  dom.controls.format.value = "csl";
  dom.controls.format.emit("change");
  const output = dom.controls.output.value;
  assert.equal(JSON.parse(output)[0].type, "webpage");
  await dom.controls.copy.emit("click");
  assert.deepEqual(dom.writes, [output]);
  assert.equal(dom.controls.status.textContent, "CSL JSON copied.");
});

test("clipboard denial or insecure context preserves manual selection", async () => {
  for (const options of [{ insecure: true }, { rejectClipboard: true }]) {
    const dom = fixture(options);
    await dom.controls.copy.emit("click");
    assert.equal(dom.controls.output.focused, true);
    assert.equal(dom.controls.output.selected, true);
    assert.match(dom.controls.status.textContent, /selected/i);
    assert.equal(dom.writes.length, 0);
  }
});

test("download uses the selected format and releases the temporary object URL", () => {
  const dom = fixture();
  dom.controls.format.value = "bibtex";
  dom.controls.format.emit("change");
  dom.controls.download.emit("click");
  assert.equal(dom.blobs.length, 1);
  assert.equal(dom.blobs[0].parts[0], dom.controls.output.value);
  assert.equal(dom.blobs[0].type, citation.FORMATS.bibtex.mime);
  assert.equal(dom.links[0].download, citation.filename(dom.mounted.meta, "bibtex"));
  assert.equal(dom.links[0].clicked, true);
  assert.equal(dom.links[0].removed, true);
  assert.equal(dom.revoked.length, 0);
  dom.timers[0]();
  assert.deepEqual(dom.revoked, ["blob:reference"]);
});

test("unsupported downloads and invalid panels retain a safe fallback", () => {
  const unsupported = fixture({ noBlob: true });
  unsupported.controls.download.emit("click");
  assert.equal(unsupported.controls.output.selected, true);
  assert.equal(unsupported.links.length, 0);
  assert.equal(fixture({ noPanel: true }).mounted, null);
  assert.equal(fixture({ metadata: { ...sample, date: "invalid" } }).mounted, null);
});

test("the published layout exposes labelled controls and a static reference", () => {
  const root = path.resolve(__dirname, "../../..");
  const template = fs.readFileSync(path.join(root, "_includes/publication-citation.html"), "utf8");
  const layout = fs.readFileSync(path.join(root, "_layouts/post.html"), "utf8");
  const head = fs.readFileSync(path.join(root, "_includes/head.html"), "utf8");
  assert.match(template, /data-citation-controls hidden/);
  assert.match(template, /<label for="publication-citation-format"/);
  assert.match(template, /<label for="publication-citation-output"/);
  assert.match(template, /readonly[^>]*data-citation-output/);
  assert.match(template, /role="status" data-citation-status/);
  assert.match(template, /href="{{ citation_url \| escape }}"/);
  assert.match(layout, /include publication-citation.html/);
  assert.match(head, /publication-citation\.js/);
  assert.match(head, /publication-citation\.css/);
  for (const key of Object.keys(citation.FORMATS)) {
    assert.match(template, new RegExp('option value="' + key + '"'));
  }
});
