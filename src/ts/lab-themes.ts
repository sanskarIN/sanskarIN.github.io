// Browser-local light/dark design tokens derived from the color contrast checker.
(() => {
  type RGB = [number, number, number];
  const root = document.querySelector<HTMLElement>("[data-contrast-themes]");
  const foreground = document.querySelector<HTMLInputElement>("[data-contrast-foreground]");
  const background = document.querySelector<HTMLInputElement>("[data-contrast-background]");
  const cssButton = root?.querySelector<HTMLButtonElement>("[data-theme-copy-css]");
  const jsonButton = root?.querySelector<HTMLButtonElement>("[data-theme-copy-json]");
  const status = root?.querySelector<HTMLElement>("[data-theme-status]");
  const panels = ["light", "dark"].map((name) => ({
    name,
    card: root?.querySelector<HTMLElement>("[data-theme-card-" + name + "]"),
    muted: root?.querySelector<HTMLElement>("[data-theme-muted-" + name + "]"),
    action: root?.querySelector<HTMLElement>("[data-theme-action-" + name + "]"),
    details: root?.querySelector<HTMLElement>("[data-theme-details-" + name + "]"),
  }));
  if (!root || !foreground || !background || !cssButton || !jsonButton || !status ||
      panels.some((panel) => !panel.card || !panel.muted || !panel.action || !panel.details)) return;

  const parseHex = (input: string): RGB | null => {
    const match = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(input.trim());
    if (!match) return null;
    const full = match[1].length === 3 ? Array.from(match[1], (c) => c + c).join("") : match[1];
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
  };
  const hex = (rgb: RGB): string =>
    "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
  const luminance = (rgb: RGB): number => {
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a: RGB, b: RGB): number => {
    const first = luminance(a), second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };
  const mix = (a: RGB, b: RGB, amount: number): RGB =>
    a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount)) as RGB;
  const black: RGB = [0, 0, 0];
  const white: RGB = [255, 255, 255];

  // When needed, darken or lighten the accent to meet 3:1 against its surface.
  const accessibleAccent = (seed: RGB, surface: RGB): RGB => {
    if (contrast(seed, surface) >= 3) return seed;
    const candidates: RGB[] = [];
    for (const target of [black, white]) {
      if (contrast(target, surface) < 3) continue;
      let low = 0, high = 1;
      for (let i = 0; i < 25; i++) {
        const middle = (low + high) / 2;
        if (contrast(mix(seed, target, middle), surface) >= 3) high = middle;
        else low = middle;
      }
      candidates.push(mix(seed, target, high));
    }
    candidates.sort((a, b) =>
      a.reduce((sum, value, i) => sum + (value - seed[i]) ** 2, 0) -
      b.reduce((sum, value, i) => sum + (value - seed[i]) ** 2, 0));
    // An opaque surface always has at least one black/white endpoint above 3:1.
    return candidates[0] || black;
  };
  const settings: { name: string; background: RGB; surface: RGB; text: RGB; muted: RGB; border: RGB }[] = [
    { name: "light", background: white, surface: [248, 250, 252], text: [17, 24, 39],
      muted: [71, 85, 105], border: [100, 116, 139] },
    { name: "dark", background: [17, 24, 39], surface: [31, 41, 55], text: [249, 250, 251],
      muted: [203, 213, 225], border: [203, 213, 225] },
  ];
  let themeCss = "";
  let themeJson = "";
  const say = (message: string, state: "info" | "success" | "error"): void => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const render = (): void => {
    const seed = parseHex(foreground.value), other = parseHex(background.value);
    themeCss = "";
    themeJson = "";
    cssButton.disabled = true;
    jsonButton.disabled = true;
    if (!seed || !other) {
      for (const panel of panels) {
        panel.card!.style.backgroundColor = "";
        panel.card!.style.color = "";
        panel.card!.style.borderColor = "";
        panel.muted!.style.color = "";
        panel.action!.style.backgroundColor = "";
        panel.action!.style.color = "";
        panel.details!.textContent = "Enter valid foreground and background colors.";
      }
      say("Enter valid 3- or 6-digit hex colors to generate theme tokens.", "error");
      return;
    }
    const themes: Record<string, Record<string, string>> = {};
    for (const spec of settings) {
      const accent = accessibleAccent(seed, spec.surface);
      const onAccent = contrast(accent, black) >= contrast(accent, white) ? black : white;
      const tokens = {
        background: hex(spec.background), surface: hex(spec.surface),
        text: hex(spec.text), muted: hex(spec.muted), border: hex(spec.border),
        accent: hex(accent), "on-accent": hex(onAccent),
      };
      themes[spec.name] = tokens;
      const panel = panels.find((item) => item.name === spec.name)!;
      panel.card!.style.backgroundColor = tokens.background;
      panel.card!.style.color = tokens.text;
      panel.card!.style.borderColor = tokens.border;
      panel.muted!.style.color = tokens.muted;
      panel.action!.style.backgroundColor = tokens.accent;
      panel.action!.style.color = tokens["on-accent"];
      panel.details!.textContent = "Button label " + contrast(accent, onAccent).toFixed(2) +
        ":1 · Accent on surface " + contrast(accent, spec.surface).toFixed(2) + ":1";
    }
    const lines = (name: string, indent: string): string[] =>
      Object.entries(themes[name]).map(([key, value]) => indent + "--theme-" + key + ": " + value + ";");
    themeCss = [
      "/* Light/dark accessible tokens from " + hex(seed) + "; verify in your layout. */",
      ":root {", ...lines("light", "  "), "}",
      ':root[data-theme="dark"] {', ...lines("dark", "  "), "}",
      "@media (prefers-color-scheme: dark) {",
      '  :root:not([data-theme="light"]) {', ...lines("dark", "    "), "  }", "}", "",
    ].join("\n");
    themeJson = JSON.stringify({ seed: hex(seed), themes }, null, 2) + "\n";
    cssButton.disabled = false;
    jsonButton.disabled = false;
    say("Light/dark previews ready. Verify more states in your own interface.", "success");
  };
  const copy = (content: string, label: string): void => {
    if (!navigator.clipboard?.writeText) {
      say("Clipboard unavailable. You can copy colors individually.", "error");
      return;
    }
    void navigator.clipboard.writeText(content)
      .then(() => say(label + " copied.", "success"))
      .catch(() => say("Clipboard permission denied.", "error"));
  };
  cssButton.addEventListener("click", () => {
    if (!cssButton.disabled && themeCss) copy(themeCss, "Theme CSS");
  });
  jsonButton.addEventListener("click", () => {
    if (!jsonButton.disabled && themeJson) copy(themeJson, "Theme JSON");
  });
  for (const field of [foreground, background]) {
    field.addEventListener("input", render);
    field.addEventListener("blur", render);
  }
  for (const name of ["foreground-picker", "background-picker"]) {
    document.querySelector<HTMLInputElement>("[data-contrast-" + name + "]")?.addEventListener("input", render);
  }
  for (const name of ["swap", "reset", "example", "apply-3", "apply-4-5", "apply-7"]) {
    document.querySelector<HTMLButtonElement>("[data-contrast-" + name + "]")?.addEventListener("click", render);
  }
  render();
})();
