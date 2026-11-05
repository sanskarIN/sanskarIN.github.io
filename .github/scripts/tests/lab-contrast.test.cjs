// Browser-free checks of the committed contrast calculator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const script = readFileSync(join(__dirname, "../../../assets/js/lab-contrast.js"), "utf8");

function createTool(clipboard = true) {
  const elements = new Map();
  for (const key of ["foreground", "background", "foreground-picker", "background-picker", "preview", "ratio", "status", "swap", "reset", "copy", "aa-normal", "aaa-normal", "aa-large", "aaa-large", "aa-ui"]) {
    elements.set(key, {
      value: "", textContent: "", disabled: key === "copy", dataset: {}, style: {}, attrs: {}, events: {},
      addEventListener(event, fn) { this.events[event] = fn; },
      setAttribute(key, value) { this.attrs[key] = value; },
      fire(event) { assert.ok(this.events[event], `${key} missing ${event}`); this.events[event](); },
    });
  }
  elements.get("foreground").value = "#1F2937";
  elements.get("background").value = "#FFFFFF";
  const root = { querySelector(selector) {
    const match = /^\[data-contrast-(.*)\]$/.exec(selector);
    return match ? elements.get(match[1]) : null;
  }};
  const copied = [];
  const document = { querySelector(selector) { return selector === "[data-contrast-tool]" ? root : null; } };
  const navigator = clipboard ? { clipboard: { writeText(value) { copied.push(value); return Promise.resolve(); } } } : {};
  vm.runInNewContext(script, { document, navigator }, { filename: "lab-contrast.js", timeout: 1200 });
  const get = (key) => elements.get(key);
  const set = (key, value, event = "input") => { get(key).value = value; get(key).fire(event); };
  return { get, set, copied, click(key) { get(key).fire("click"); } };
}

test("white on black is 21:1 and passes all WCAG checks", () => {
  const app = createTool();
  app.set("foreground", "#000");
  app.set("background", "#fff");
  assert.equal(app.get("ratio").textContent, "21.00:1");
  for (const key of ["aa-normal", "aaa-normal", "aa-large", "aaa-large", "aa-ui"]) {
    assert.equal(app.get(key).textContent, "Pass");
  }
  assert.equal(app.get("foreground-picker").value, "#000000");
  assert.equal(app.get("background-picker").value, "#FFFFFF");
  assert.equal(app.get("foreground").attrs["aria-invalid"], "false");
});

test("same colors fail and AA normal threshold distinguishes #777 from #767676", () => {
  const app = createTool();
  app.set("foreground", "#ffffff");
  assert.equal(app.get("ratio").textContent, "1.00:1");
  assert.equal(app.get("aa-normal").textContent, "Fail");
  app.set("foreground", "#777");
  assert.equal(app.get("aa-normal").textContent, "Fail");
  assert.equal(app.get("aa-large").textContent, "Pass");
  app.set("foreground", "#767676");
  assert.equal(app.get("aa-normal").textContent, "Pass");
  assert.equal(app.get("aaa-normal").textContent, "Fail");
});

test("invalid values clear stale results and prevent copy", () => {
  const app = createTool();
  app.set("foreground", "red");
  assert.equal(app.get("ratio").textContent, "—");
  assert.equal(app.get("copy").disabled, true);
  assert.equal(app.get("foreground").attrs["aria-invalid"], "true");
  assert.equal(app.get("aa-normal").textContent, "Not calculated");
  app.set("foreground", "#12345G");
  assert.equal(app.get("status").dataset.state, "error");
  app.set("foreground", "123");
  assert.equal(app.get("ratio").textContent !== "—", true);
  app.get("foreground").fire("blur");
  assert.equal(app.get("foreground").value, "#112233");
});

test("native color pickers, swapping and reset remain synchronized", () => {
  const app = createTool();
  app.set("foreground-picker", "#ab12ff");
  assert.equal(app.get("foreground").value, "#AB12FF");
  assert.equal(app.get("preview").style.color, "#AB12FF");
  app.click("swap");
  assert.equal(app.get("background").value, "#AB12FF");
  assert.equal(app.get("foreground-picker").value, "#FFFFFF");
  app.click("reset");
  assert.equal(app.get("foreground").value, "#1F2937");
  assert.equal(app.get("background").value, "#FFFFFF");
});

test("copy result includes raw colors and descriptive pass/fail labels", async () => {
  const app = createTool();
  app.set("foreground", "#000");
  app.click("copy");
  await Promise.resolve();
  assert.match(app.copied[0], /Contrast 21\.00:1/);
  assert.match(app.copied[0], /Normal text AAA: Pass/);
  assert.equal(app.get("status").dataset.state, "success");
  const noClipboard = createTool(false);
  noClipboard.click("copy");
  assert.match(noClipboard.get("status").textContent, /Clipboard unavailable/);
});
