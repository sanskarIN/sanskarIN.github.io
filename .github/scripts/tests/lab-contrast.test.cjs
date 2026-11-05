// Browser-free checks of the committed contrast calculator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const script = readFileSync(join(__dirname, "../../../assets/js/lab-contrast.js"), "utf8");

function createTool(clipboard = true) {
  const elements = new Map();
  for (const key of ["foreground", "background", "foreground-picker", "background-picker", "preview", "ratio", "status", "swap", "reset", "example", "copy", "copy-css", "suggest-3-color", "suggest-3-detail", "suggest-3-swatch", "apply-3", "suggest-4-5-color", "suggest-4-5-detail", "suggest-4-5-swatch", "apply-4-5", "suggest-7-color", "suggest-7-detail", "suggest-7-swatch", "apply-7", "aa-normal", "aaa-normal", "aa-large", "aaa-large", "aa-ui"]) {
    elements.set(key, {
      value: "", textContent: "", disabled: key === "copy" || key === "copy-css" || key.startsWith("apply-"), dataset: {}, style: {}, attrs: {}, events: {},
      addEventListener(event, fn) { this.events[event] = fn; },
      setAttribute(key, value) { this.attrs[key] = value; },
      focus() { this.focused = true; },
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


function independentContrast(fg, bg) {
  function lightness(value) {
    const rgb = value.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
    const linear = rgb.map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  const a = lightness(fg), b = lightness(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("example generates three WCAG-compliant foreground proposals", () => {
  const app = createTool();
  app.click("example");
  assert.equal(app.get("foreground").value, "#999999");
  assert.equal(app.get("aa-normal").textContent, "Fail");
  for (const [key, threshold] of [["3", 3], ["4-5", 4.5], ["7", 7]]) {
    const proposed = app.get("suggest-" + key + "-color").textContent;
    assert.match(proposed, /^#[0-9A-F]{6}$/);
    assert.ok(independentContrast(proposed, "#FFFFFF") >= threshold, key + " must actually meet threshold");
    assert.equal(app.get("apply-" + key).disabled, false);
    assert.equal(app.get("apply-" + key).dataset.color, proposed);
  }
});

test("applying the three proposals passes the corresponding checks and returns focus", () => {
  for (const [key, check] of [["3", "aa-large"], ["4-5", "aa-normal"], ["7", "aaa-normal"]]) {
    const app = createTool();
    app.click("example");
    const proposed = app.get("suggest-" + key + "-color").textContent;
    app.click("apply-" + key);
    assert.equal(app.get("foreground").value, proposed);
    assert.equal(app.get(check).textContent, "Pass");
    assert.equal(app.get("foreground").focused, true);
    assert.equal(app.get("apply-" + key).disabled, true);
  }
});

test("7:1 unachievable background explicitly disables the AAA proposal", () => {
  const app = createTool();
  app.set("foreground", "#808080");
  app.set("background", "#777777");
  assert.equal(app.get("suggest-7-color").textContent, "Unavailable");
  assert.equal(app.get("apply-7").disabled, true);
  assert.equal(app.get("apply-7").dataset.color, "");
  assert.match(app.get("suggest-7-detail").textContent, /Neither black nor white/);
  assert.ok(independentContrast(app.get("suggest-4-5-color").textContent, "#777777") >= 4.5);
});

test("invalid colors clear suggestions; already passing colors do not need changes", () => {
  const app = createTool();
  app.set("foreground", "#000000");
  assert.equal(app.get("suggest-7-detail").textContent, "Already meets this level.");
  assert.equal(app.get("apply-7").disabled, true);
  app.set("background", "invalid");
  assert.equal(app.get("suggest-4-5-color").textContent, "—");
  assert.equal(app.get("apply-4-5").disabled, true);
  assert.equal(app.get("copy-css").disabled, true);
  app.click("apply-4-5");
  assert.equal(app.get("foreground").value, "#000000");
});

test("CSS variables export reflects current colors without extra libraries", async () => {
  const app = createTool();
  app.set("foreground", "#112233");
  app.set("background", "#AABBCC");
  app.click("copy-css");
  await Promise.resolve();
  assert.equal(app.copied[0], ":root {\n  --color-text: #112233;\n  --color-background: #AABBCC;\n}\n");
  const unavailable = createTool(false);
  unavailable.click("copy-css");
  assert.match(unavailable.get("status").textContent, /Clipboard unavailable/);
});

test("varied light and dark backgrounds never get a failing suggestion", () => {
  for (const [fg, bg] of [
    ["#777777", "#FFFFFF"], ["#0000FF", "#444444"], ["#DF4A00", "#F6F0EE"],
    ["#0B101F", "#272727"], ["#FBBA22", "#FDF7D0"], ["#EE9988", "#223344"],
  ]) {
    const app = createTool();
    app.set("foreground", fg);
    app.set("background", bg);
    for (const [key, threshold] of [["3", 3], ["4-5", 4.5], ["7", 7]]) {
      const candidate = app.get("suggest-" + key + "-color").textContent;
      if (candidate === "Unavailable") {
        assert.ok(independentContrast("#000000", bg) < threshold);
        assert.ok(independentContrast("#FFFFFF", bg) < threshold);
      } else {
        assert.ok(independentContrast(candidate, bg) >= threshold, fg + " on " + bg + " at " + threshold);
      }
    }
  }
});
