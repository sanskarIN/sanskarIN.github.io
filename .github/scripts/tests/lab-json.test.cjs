// Browser-free behavior tests for the compiled JSON tool.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");

const script = readFileSync(join(__dirname, "../../../assets/js/lab-json.js"), "utf8");

function editor() {
  const elements = new Map();
  for (const key of ["input", "output", "status", "indent", "format", "validate", "minify", "copy", "sample", "clear"]) {
    const node = {
      value: "", textContent: "", disabled: key === "copy",
      dataset: {}, focused: false, selected: false, events: {},
      addEventListener(type, fn) { this.events[type] = fn; },
      focus() { this.focused = true; },
      select() { this.selected = true; },
      fire(type, event = {}) { assert.ok(this.events[type], key + " missing " + type); this.events[type](event); },
    };
    elements.set("[data-json-" + key + "]", node);
  }
  elements.get("[data-json-indent]").value = "2";
  const root = { querySelector(selector) { return elements.get(selector) || null; } };
  const copied = [];
  const document = { querySelector(selector) { return selector === "[data-json-tool]" ? root : null; } };
  const navigator = { clipboard: { writeText(value) { copied.push(value); return Promise.resolve(); } } };
  vm.runInNewContext(script, { document, navigator, JSON, Error }, { filename: "lab-json.js", timeout: 1000 });
  const get = (key) => elements.get("[data-json-" + key + "]");
  return { get, copied, click(key) { get(key).fire("click"); } };
}

test("formats JSON and enables copy", async () => {
  const app = editor();
  app.get("input").value = '{"a":1,"items":[true,null]}';
  app.click("format");
  assert.equal(app.get("output").value, '{\n  "a": 1,\n  "items": [\n    true,\n    null\n  ]\n}');
  assert.equal(app.get("copy").disabled, false);
  assert.equal(app.get("status").dataset.state, "success");
  app.click("copy");
  await Promise.resolve();
  assert.equal(app.copied[0], app.get("output").value);
});

test("supports configurable indentation and minification", () => {
  const app = editor();
  app.get("input").value = '{"nested":{"x":2}}';
  app.get("indent").value = "tab";
  app.click("format");
  assert.match(app.get("output").value, /\n\t"nested"/);
  app.get("indent").value = "4";
  app.click("format");
  assert.match(app.get("output").value, /\n    "nested"/);
  app.click("minify");
  assert.equal(app.get("output").value, '{"nested":{"x":2}}');
});

test("validates without changing input and rejects invalid JSON", () => {
  const app = editor();
  app.get("input").value = '  {"ok":true}  ';
  app.click("validate");
  assert.equal(app.get("output").value, "");
  assert.match(app.get("status").textContent, /Valid JSON/);
  assert.equal(app.get("input").value, '  {"ok":true}  ');
  app.get("input").value = '{"broken": }';
  app.click("format");
  assert.equal(app.get("output").value, "");
  assert.equal(app.get("copy").disabled, true);
  assert.equal(app.get("status").dataset.state, "error");
  assert.match(app.get("status").textContent, /Invalid JSON/);
});

test("does not process empty or oversized input", () => {
  const app = editor();
  app.click("format");
  assert.match(app.get("status").textContent, /Paste some JSON/);
  app.get("input").value = " ".repeat(1024 * 1024 + 1);
  app.click("minify");
  assert.equal(app.get("output").value, "");
  assert.match(app.get("status").textContent, /too large/);
});

test("invalidates stale output, loads an example, clears and supports Ctrl+Enter", () => {
  const app = editor();
  app.click("sample");
  assert.match(app.get("input").value, /Developer Lab/);
  assert.ok(app.get("input").focused);
  app.click("format");
  assert.ok(app.get("output").value);
  app.get("input").fire("input");
  assert.equal(app.get("output").value, "");
  assert.equal(app.get("copy").disabled, true);
  let prevented = false;
  app.get("input").fire("keydown", { key: "Enter", ctrlKey: true, metaKey: false, preventDefault() { prevented = true; } });
  assert.ok(prevented);
  assert.ok(app.get("output").value);
  app.click("clear");
  assert.equal(app.get("input").value, "");
  assert.equal(app.get("output").value, "");
});
