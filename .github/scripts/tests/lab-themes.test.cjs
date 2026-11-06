// Node VM smoke and accessibility regression tests for standalone theme-generation script.
const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const source = readFileSync(join(__dirname, "../../../assets/js/lab-themes.js"), "utf8");

function setup(clipboard = true) {
  class Element {
    constructor(value = "") {
      this.value = value;
      this.style = {};
      this.textContent = "";
      this.dataset = {};
      this.disabled = true;
      this.listeners = {};
    }
    addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
    fire(name) { for (const fn of this.listeners[name] || []) fn(); }
  }
  const parts = new Map();
  for (const name of [
    "contrast-foreground", "contrast-background", "contrast-foreground-picker", "contrast-background-picker",
    "contrast-swap", "contrast-reset", "contrast-example", "contrast-apply-3", "contrast-apply-4-5", "contrast-apply-7",
    "theme-copy-css", "theme-copy-json", "theme-status",
    "theme-card-light", "theme-muted-light", "theme-action-light", "theme-details-light",
    "theme-card-dark", "theme-muted-dark", "theme-action-dark", "theme-details-dark",
  ]) parts.set("[data-" + name + "]", new Element());
  parts.get("[data-contrast-foreground]").value = "#B93C0B";
  parts.get("[data-contrast-background]").value = "#FFFFFF";
  const root = { querySelector: (selector) => parts.get(selector) ?? null };
  const document = {
    querySelector: (selector) => selector === "[data-contrast-themes]" ? root : parts.get(selector) ?? null,
  };
  const copied = [];
  const navigator = clipboard ? { clipboard: { writeText(value) { copied.push(value); return Promise.resolve(); } } } : {};
  vm.runInNewContext(source, { document, navigator }, { filename: "lab-themes.js", timeout: 1500 });
  return { get: (name) => parts.get("[data-" + name + "]"), copied };
}

function score(a, b) {
  const lightness = (hex) => {
    const channels = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const x = lightness(a), y = lightness(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("theme previews and exports satisfy independently calculated WCAG thresholds", async () => {
  for (const seed of ["#000000", "#FFFFFF", "#777777", "#B93C0B", "#0000FF", "#123"]) {
    const app = setup();
    app.get("contrast-foreground").value = seed;
    app.get("contrast-foreground").fire("input");
    assert.equal(app.get("theme-copy-json").disabled, false);
    app.get("theme-copy-json").fire("click");
    await Promise.resolve();
    const data = JSON.parse(app.copied[0]);
    assert.match(data.seed, /^#[0-9A-F]{6}$/);
    for (const name of ["light", "dark"]) {
      const theme = data.themes[name];
      assert.ok(score(theme.text, theme.background) >= 7, seed + name + " text");
      assert.ok(score(theme.muted, theme.background) >= 4.5, seed + name + " muted");
      assert.ok(score(theme.border, theme.surface) >= 3, seed + name + " border");
      assert.ok(score(theme.accent, theme.surface) >= 3, seed + name + " accent");
      assert.ok(score(theme["on-accent"], theme.accent) >= 4.5, seed + name + " button text");
      assert.equal(app.get("theme-card-" + name).style.backgroundColor, theme.background);
      assert.equal(app.get("theme-action-" + name).style.backgroundColor, theme.accent);
    }
  }
});

test("CSS export includes mode overrides and default dark media support", async () => {
  const app = setup();
  app.get("theme-copy-css").fire("click");
  await Promise.resolve();
  const value = app.copied[0];
  assert.match(value, /:root \{/);
  assert.match(value, /:root\[data-theme="dark"\]/);
  assert.match(value, /prefers-color-scheme: dark/);
  assert.match(value, /:root:not\(\[data-theme="light"\]\)/);
  assert.match(value, /--theme-on-accent: #[0-9A-F]{6};/);
});

test("invalid colors clear stale previews and block exports; no clipboard is handled", () => {
  const app = setup();
  app.get("contrast-background").value = "invalid";
  app.get("contrast-background").fire("input");
  assert.equal(app.get("theme-copy-css").disabled, true);
  assert.equal(app.get("theme-copy-json").disabled, true);
  assert.equal(app.get("theme-card-light").style.backgroundColor, "");
  app.get("theme-copy-css").fire("click");
  assert.equal(app.copied.length, 0);
  const noClipboard = setup(false);
  noClipboard.get("theme-copy-css").fire("click");
  assert.match(noClipboard.get("theme-status").textContent, /Clipboard unavailable/);
});
