// WCAG 2.2 contrast calculator and suggestions. Everything remains in this browser.
(() => {
  type RGB = [number, number, number];
  const root = document.querySelector<HTMLElement>("[data-contrast-tool]");
  if (!root) return;

  const find = <T extends HTMLElement>(name: string): T | null =>
    root.querySelector<T>(`[data-contrast-${name}]`);
  const foreground = find<HTMLInputElement>("foreground");
  const background = find<HTMLInputElement>("background");
  const foregroundPicker = find<HTMLInputElement>("foreground-picker");
  const backgroundPicker = find<HTMLInputElement>("background-picker");
  const preview = find<HTMLElement>("preview");
  const ratio = find<HTMLElement>("ratio");
  const status = find<HTMLElement>("status");
  const swap = find<HTMLButtonElement>("swap");
  const reset = find<HTMLButtonElement>("reset");
  const example = find<HTMLButtonElement>("example");
  const copy = find<HTMLButtonElement>("copy");
  const copyCss = find<HTMLButtonElement>("copy-css");
  const copyLink = find<HTMLButtonElement>("copy-link");
  const copyPaletteCss = find<HTMLButtonElement>("copy-palette-css");
  const copyPaletteJson = find<HTMLButtonElement>("copy-palette-json");
  const paletteItems = [
    { step: 50, amount: 0.9 }, { step: 100, amount: 0.75 },
    { step: 200, amount: 0.55 }, { step: 300, amount: 0.35 },
    { step: 400, amount: 0.15 }, { step: 500, amount: 0 },
    { step: 600, amount: 0.2 }, { step: 700, amount: 0.4 },
    { step: 800, amount: 0.6 }, { step: 900, amount: 0.8 },
  ].map(({ step, amount }) => ({ step, amount, element: find<HTMLElement>(`tone-${step}`) }));
  const checks = [
    { element: find<HTMLElement>("aa-normal"), minimum: 4.5, label: "Normal text AA" },
    { element: find<HTMLElement>("aaa-normal"), minimum: 7, label: "Normal text AAA" },
    { element: find<HTMLElement>("aa-large"), minimum: 3, label: "Large text AA" },
    { element: find<HTMLElement>("aaa-large"), minimum: 4.5, label: "Large text AAA" },
    { element: find<HTMLElement>("aa-ui"), minimum: 3, label: "UI components and graphics AA" },
  ];
  const suggestions = [3, 4.5, 7].map((minimum) => {
    const key = String(minimum).replace(".", "-");
    return {
      minimum,
      color: find<HTMLElement>(`suggest-${key}-color`),
      detail: find<HTMLElement>(`suggest-${key}-detail`),
      swatch: find<HTMLElement>(`suggest-${key}-swatch`),
      apply: find<HTMLButtonElement>(`apply-${key}`),
    };
  });
  if (!foreground || !background || !foregroundPicker || !backgroundPicker ||
      !preview || !ratio || !status || !swap || !reset || !example || !copy || !copyCss || !copyLink || !copyPaletteCss || !copyPaletteJson ||
      checks.some((item) => !item.element) ||
      suggestions.some((item) => !item.color || !item.detail || !item.swatch || !item.apply) ||
    paletteItems.some((item) => !item.element)) return;

  const parseHex = (value: string): RGB | null => {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
    if (!match) return null;
    const full = match[1].length === 3
      ? Array.from(match[1], (character) => character + character).join("")
      : match[1];
    return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as RGB;
  };
  const canonical = (rgb: RGB): string =>
    "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
  const luminance = ([red, green, blue]: RGB): number => {
    const linear = (channel: number): number => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
  };
  const contrast = (first: RGB, second: RGB): number => {
    const a = luminance(first);
    const b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const mix = (from: RGB, to: RGB, fraction: number): RGB =>
    from.map((channel, index) => Math.round(channel + (to[index] - channel) * fraction)) as RGB;
  const distanceSquared = (a: RGB, b: RGB): number =>
    a.reduce((sum, channel, index) => sum + (channel - b[index]) ** 2, 0);

  // Explore only two predictable paths: blend the current foreground toward
  // opaque black or white. Integer channels are checked after each mix, and
  // the WCAG threshold is evaluated against the *unrounded* contrast ratio.
  // Not every background permits 7:1, so an unavailable result is intentional.
  const suggestForeground = (fg: RGB, bg: RGB, minimum: number): RGB | null => {
    if (contrast(fg, bg) >= minimum) return fg;
    const candidates: RGB[] = [];
    for (const endpoint of [[0, 0, 0], [255, 255, 255]] as RGB[]) {
      if (contrast(endpoint, bg) < minimum) continue;
      let low = 0;
      let high = 1;
      for (let i = 0; i < 24; i++) {
        const middle = (low + high) / 2;
        if (contrast(mix(fg, endpoint, middle), bg) >= minimum) high = middle;
        else low = middle;
      }
      candidates.push(mix(fg, endpoint, high));
    }
    candidates.sort((a, b) => distanceSquared(fg, a) - distanceSquared(fg, b));
    return candidates[0] || null;
  };
  const announce = (message: string, state: "info" | "success" | "error"): void => {
    status.textContent = message;
    status.dataset.state = state;
  };
  let copyText = "";
  let cssText = "";
  let linkText = "";
  let paletteCssText = "";
  let paletteJsonText = "";

  const unavailableSuggestions = (): void => {
    for (const item of suggestions) {
      item.color!.textContent = "—";
      item.detail!.textContent = "Enter two valid colors.";
      item.swatch!.style.backgroundColor = "";
      item.apply!.disabled = true;
      item.apply!.dataset.color = "";
    }
  };
  const update = (): void => {
    const fg = parseHex(foreground.value);
    const bg = parseHex(background.value);
    foreground.setAttribute("aria-invalid", String(!fg));
    background.setAttribute("aria-invalid", String(!bg));
    copy.disabled = true;
    copyCss.disabled = true;
    copyLink.disabled = true;
    copyPaletteCss.disabled = true;
    copyPaletteJson.disabled = true;
    copyText = "";
    cssText = "";
    linkText = "";
    paletteCssText = "";
    paletteJsonText = "";
    if (!fg || !bg) {
      ratio.textContent = "—";
      preview.style.color = "";
      preview.style.backgroundColor = "";
      for (const check of checks) {
        check.element!.textContent = "Not calculated";
        check.element!.dataset.state = "unknown";
      }
      unavailableSuggestions();
      for (const item of paletteItems) {
        item.element!.textContent = `${item.step} · Enter a valid color pair.`;
        item.element!.style.backgroundColor = "";
        item.element!.style.color = "";
      }
      announce("Enter valid 3- or 6-digit hexadecimal colors for both fields.", "error");
      return;
    }
    const fgColor = canonical(fg);
    const bgColor = canonical(bg);
    foregroundPicker.value = fgColor;
    backgroundPicker.value = bgColor;
    preview.style.color = fgColor;
    preview.style.backgroundColor = bgColor;
    const value = contrast(fg, bg);
    ratio.textContent = `${value.toFixed(2)}:1`;
    const lines = [`Foreground ${fgColor}`, `Background ${bgColor}`, `Contrast ${value.toFixed(2)}:1`];
    for (const check of checks) {
      const passes = value >= check.minimum;
      check.element!.textContent = passes ? "Pass" : "Fail";
      check.element!.dataset.state = passes ? "pass" : "fail";
      lines.push(`${check.label}: ${passes ? "Pass" : "Fail"}`);
    }
    for (const item of suggestions) {
      const candidate = suggestForeground(fg, bg, item.minimum);
      if (candidate === null) {
        item.color!.textContent = "Unavailable";
        item.detail!.textContent = "Neither black nor white reaches this contrast on the selected background.";
        item.swatch!.style.backgroundColor = "";
        item.apply!.disabled = true;
        item.apply!.dataset.color = "";
        continue;
      }
      const color = canonical(candidate);
      const suggestedRatio = contrast(candidate, bg);
      item.color!.textContent = color;
      item.detail!.textContent = value >= item.minimum
        ? "Already meets this level."
        : `Reaches ${suggestedRatio.toFixed(2)}:1 on your background.`;
      item.swatch!.style.backgroundColor = color;
      item.apply!.disabled = value >= item.minimum;
      item.apply!.dataset.color = value >= item.minimum ? "" : color;
    }
    const black: RGB = [0, 0, 0];
    const white: RGB = [255, 255, 255];
    const palette: Record<string, { background: string; foreground: string; contrast: number; level: string }> = {};
    const cssLines = [":root {"];
    for (const item of paletteItems) {
      const swatch = mix(fg, item.step < 500 ? white : black, item.amount);
      const on = contrast(swatch, black) >= contrast(swatch, white) ? black : white;
      const swatchHex = canonical(swatch);
      const textHex = canonical(on);
      const score = contrast(swatch, on);
      const level = score >= 7 ? "AAA" : "AA";
      item.element!.style.backgroundColor = swatchHex;
      item.element!.style.color = textHex;
      item.element!.textContent = `${item.step} · ${swatchHex} · Text ${textHex} · ${score.toFixed(2)}:1 · ${level}`;
      palette[String(item.step)] = { background: swatchHex, foreground: textHex, contrast: Number(score.toFixed(2)), level };
      cssLines.push(`  --palette-${item.step}: ${swatchHex};`);
      cssLines.push(`  --palette-on-${item.step}: ${textHex};`);
    }
    paletteCssText = [...cssLines, "}", ""].join("\n");
    paletteJsonText = JSON.stringify({ base: fgColor, shades: palette }, null, 2) + "\n";
    copyPaletteCss.disabled = false;
    copyPaletteJson.disabled = false;
    copyText = lines.join("\n");
    cssText = `:root {\n  --color-text: ${fgColor};\n  --color-background: ${bgColor};\n}\n`;
    linkText = `${location.href.split(/[?#]/)[0]}#fg=${fgColor.slice(1)}&bg=${bgColor.slice(1)}`;
    copy.disabled = false;
    copyCss.disabled = false;
    copyLink.disabled = false;
    announce("Contrast calculated. Suggestions are available below the results.", "success");
  };
  const bindColor = (field: HTMLInputElement, picker: HTMLInputElement): void => {
    field.addEventListener("input", update);
    field.addEventListener("blur", () => {
      const parsed = parseHex(field.value);
      if (parsed) field.value = canonical(parsed);
      update();
    });
    picker.addEventListener("input", () => {
      field.value = picker.value.toUpperCase();
      update();
    });
  };
  bindColor(foreground, foregroundPicker);
  bindColor(background, backgroundPicker);
  swap.addEventListener("click", () => {
    [foreground.value, background.value] = [background.value, foreground.value];
    update();
  });
  reset.addEventListener("click", () => {
    foreground.value = "#1F2937";
    background.value = "#FFFFFF";
    update();
  });
  example.addEventListener("click", () => {
    foreground.value = "#999999";
    background.value = "#FFFFFF";
    update();
    announce("Low-contrast example loaded. Apply a suggested foreground color below.", "info");
  });
  for (const item of suggestions) {
    item.apply!.addEventListener("click", () => {
      if (item.apply!.disabled || !item.apply!.dataset.color) return;
      foreground.value = item.apply!.dataset.color;
      update();
      foreground.focus();
      announce(`Applied suggested foreground ${foreground.value}. New contrast ${ratio.textContent}.`, "success");
    });
  }
  const copyToClipboard = (value: string, success: string): void => {
    if (!navigator.clipboard?.writeText) {
      announce("Clipboard unavailable. Copy the displayed hex colors manually.", "error");
      return;
    }
    void navigator.clipboard.writeText(value)
      .then(() => announce(success, "success"))
      .catch(() => announce("Clipboard permission denied. Copy the displayed hex colors manually.", "error"));
  };
  copy.addEventListener("click", () => {
    if (!copy.disabled && copyText) copyToClipboard(copyText, "Contrast results copied.");
  });
  copyCss.addEventListener("click", () => {
    if (!copyCss.disabled && cssText) copyToClipboard(cssText, "CSS variables copied.");
  });
  copyLink.addEventListener("click", () => {
    if (!copyLink.disabled && linkText) copyToClipboard(linkText, "Shareable link copied.");
  });
  copyPaletteCss.addEventListener("click", () => {
    if (!copyPaletteCss.disabled && paletteCssText) copyToClipboard(paletteCssText, "Palette CSS copied.");
  });
  copyPaletteJson.addEventListener("click", () => {
    if (!copyPaletteJson.disabled && paletteJsonText) copyToClipboard(paletteJsonText, "Palette JSON copied.");
  });
  // URL fragments are not sent to the server during page requests.
  const shared = new URLSearchParams(location.hash.slice(1));
  const sharedFg = shared.get("fg");
  const sharedBg = shared.get("bg");
  if (sharedFg && sharedBg && /^[0-9a-f]{6}$/i.test(sharedFg) && /^[0-9a-f]{6}$/i.test(sharedBg)) {
    foreground.value = `#${sharedFg.toUpperCase()}`;
    background.value = `#${sharedBg.toUpperCase()}`;
  }
  update();
})();
