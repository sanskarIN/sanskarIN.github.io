// Browser-free regression tests for URL and timestamp conversion.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../../../assets/js/lab-convert.js"), "utf8");

function setup() {
  const nodes = new Map();
  class Node {
    constructor() {
      this.value = "";
      this.textContent = "";
      this.dataset = {};
      this.disabled = false;
      this.events = {};
      this.focused = false;
      this.selected = false;
    }
    addEventListener(type, callback) { this.events[type] = callback; }
    fire(type, event = {}) { assert.ok(this.events[type], "missing listener: " + type); this.events[type](event); }
    focus() { this.focused = true; }
    select() { this.selected = true; }
  }
  for (const name of ["url-input", "url-output", "url-mode", "url-status", "url-encode", "url-decode", "url-example", "url-clear", "url-copy",
    "time-input", "time-kind", "time-status", "time-convert", "time-now", "time-clear", "time-iso", "time-seconds", "time-milliseconds", "time-local"]) {
    nodes.set(name, new Node());
  }
  const copied = [];
  const copyButtons = ["iso", "seconds", "milliseconds", "local"].map((type) => {
    const node = new Node();
    node.disabled = true;
    node.dataset.timeCopy = type;
    return node;
  });
  const url = { querySelector(selector) { return nodes.get(selector.slice(6, -1)) || null; } };
  const timestamp = {
    querySelector(selector) { return nodes.get(selector.slice(6, -1)) || null; },
    querySelectorAll(selector) { assert.equal(selector, "[data-time-copy]"); return copyButtons; },
  };
  const document = { querySelector(selector) {
    if (selector === "[data-url-tool]") return url;
    if (selector === "[data-time-tool]") return timestamp;
    return null;
  }};
  const navigator = { clipboard: { writeText(text) { copied.push(text); return Promise.resolve(); } }};
  vm.runInNewContext(script, { document, navigator, Date, Intl, Number, String, Math, Error, URIError, Object }, { timeout: 1200 });
  const get = (name) => nodes.get(name);
  return { get, copied, copyButtons, click(name) { get(name).fire("click"); } };
}

test("URL component encoding, decoding and malformed escape errors", () => {
  const app = setup();
  app.get("url-mode").value = "component";
  app.get("url-input").value = "hello world & Rust/TypeScript?";
  app.click("url-encode");
  assert.equal(app.get("url-output").value, "hello%20world%20%26%20Rust%2FTypeScript%3F");
  app.get("url-input").value = app.get("url-output").value;
  app.click("url-decode");
  assert.equal(app.get("url-output").value, "hello world & Rust/TypeScript?");
  app.get("url-input").value = "%ZZ";
  app.click("url-decode");
  assert.equal(app.get("url-output").value, "");
  assert.equal(app.get("url-status").dataset.state, "error");
});

test("whole URI mode preserves delimiters, blank/large text fails and edits clear result", () => {
  const app = setup();
  app.get("url-mode").value = "uri";
  app.get("url-input").value = "https://example.org/a b?q=hello world&lang=hi";
  app.click("url-encode");
  assert.equal(app.get("url-output").value, "https://example.org/a%20b?q=hello%20world&lang=hi");
  app.get("url-input").fire("input");
  assert.equal(app.get("url-output").value, "");
  assert.equal(app.get("url-copy").disabled, true);
  app.get("url-input").value = "";
  app.click("url-encode");
  assert.equal(app.get("url-status").dataset.state, "info");
  app.get("url-input").value = "a".repeat(32001);
  app.click("url-encode");
  assert.equal(app.get("url-status").dataset.state, "error");
  app.click("url-example");
  assert.match(app.get("url-input").value, /Rust/);
  app.click("url-clear");
  assert.equal(app.get("url-input").value, "");
});

test("copy URL result and Ctrl+Enter keyboard action", async () => {
  const app = setup();
  app.get("url-input").value = "a b";
  app.get("url-mode").value = "component";
  let prevented = false;
  app.get("url-input").fire("keydown", { key: "Enter", ctrlKey: true, metaKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(app.get("url-output").value, "a%20b");
  app.click("url-copy");
  await Promise.resolve();
  assert.equal(app.copied[0], "a%20b");
});

test("Unix timestamp accepts epoch, negative fractional seconds and large-value guards", () => {
  const app = setup();
  app.get("time-kind").value = "seconds";
  app.get("time-input").value = "0";
  app.click("time-convert");
  assert.equal(app.get("time-iso").value, "1970-01-01T00:00:00.000Z");
  assert.equal(app.get("time-milliseconds").value, "0");
  app.get("time-input").value = "-0.001";
  app.click("time-convert");
  assert.equal(app.get("time-milliseconds").value, "-1");
  app.get("time-input").value = "0.0001";
  app.click("time-convert");
  assert.equal(app.get("time-status").dataset.state, "error");
  app.get("time-kind").value = "milliseconds";
  app.get("time-input").value = "999999999999999999999";
  app.click("time-convert");
  assert.equal(app.get("time-status").dataset.state, "error");
});

test("ISO 8601 timezone conversion rejects invalid and ambiguous inputs", () => {
  const app = setup();
  app.get("time-kind").value = "iso";
  app.get("time-input").value = "2026-11-03T19:00:00+05:30";
  app.click("time-convert");
  assert.equal(app.get("time-iso").value, "2026-11-03T13:30:00.000Z");
  app.get("time-input").value = "2026-02-30T10:00:00Z";
  app.click("time-convert");
  assert.equal(app.get("time-status").dataset.state, "error");
  app.get("time-input").value = "2026-11-03T13:30:00";
  app.click("time-convert");
  assert.equal(app.get("time-status").dataset.state, "error");
});

test("timestamps copy outputs, invalidate previous results, and support current time", async () => {
  const app = setup();
  app.get("time-kind").value = "milliseconds";
  app.get("time-input").value = "1000";
  app.click("time-convert");
  assert.equal(app.get("time-seconds").value, "1");
  app.copyButtons[0].fire("click");
  await Promise.resolve();
  assert.equal(app.copied[0], "1970-01-01T00:00:01.000Z");
  app.get("time-input").fire("input");
  assert.equal(app.get("time-iso").value, "");
  assert.equal(app.copyButtons[0].disabled, true);
  app.click("time-now");
  assert.equal(app.get("time-kind").value, "milliseconds");
  assert.ok(app.get("time-iso").value);
  app.click("time-clear");
  assert.equal(app.get("time-input").value, "");
});
