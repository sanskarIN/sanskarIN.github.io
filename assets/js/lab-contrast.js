"use strict";
// WCAG 2.2 contrast calculator. Input stays on the device; no network or storage.
(() => {
    const root = document.querySelector("[data-contrast-tool]");
    if (!root)
        return;
    const find = (name) => root.querySelector(`[data-contrast-${name}]`);
    const foreground = find("foreground");
    const background = find("background");
    const foregroundPicker = find("foreground-picker");
    const backgroundPicker = find("background-picker");
    const preview = find("preview");
    const ratio = find("ratio");
    const status = find("status");
    const swap = find("swap");
    const reset = find("reset");
    const copy = find("copy");
    const checks = [
        { element: find("aa-normal"), minimum: 4.5, label: "Normal text AA" },
        { element: find("aaa-normal"), minimum: 7, label: "Normal text AAA" },
        { element: find("aa-large"), minimum: 3, label: "Large text AA" },
        { element: find("aaa-large"), minimum: 4.5, label: "Large text AAA" },
        { element: find("aa-ui"), minimum: 3, label: "UI components and graphics AA" },
    ];
    if (!foreground || !background || !foregroundPicker || !backgroundPicker ||
        !preview || !ratio || !status || !swap || !reset || !copy ||
        checks.some((item) => !item.element))
        return;
    const parseHex = (value) => {
        const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
        if (!match)
            return null;
        const full = match[1].length === 3
            ? Array.from(match[1], (character) => character + character).join("")
            : match[1];
        return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
    };
    const canonical = (rgb) => "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
    const luminance = ([red, green, blue]) => {
        const linear = (channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    };
    const contrast = (first, second) => {
        const a = luminance(first);
        const b = luminance(second);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const announce = (message, state) => {
        status.textContent = message;
        status.dataset.state = state;
    };
    let copyText = "";
    const update = () => {
        const fg = parseHex(foreground.value);
        const bg = parseHex(background.value);
        foreground.setAttribute("aria-invalid", String(!fg));
        background.setAttribute("aria-invalid", String(!bg));
        copy.disabled = true;
        copyText = "";
        if (!fg || !bg) {
            ratio.textContent = "—";
            preview.style.color = "";
            preview.style.backgroundColor = "";
            for (const check of checks) {
                check.element.textContent = "Not calculated";
                check.element.dataset.state = "unknown";
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
            const passes = value >= check.minimum; // Use unrounded value at the threshold.
            check.element.textContent = passes ? "Pass" : "Fail";
            check.element.dataset.state = passes ? "pass" : "fail";
            lines.push(`${check.label}: ${passes ? "Pass" : "Fail"}`);
        }
        copyText = lines.join("\n");
        copy.disabled = false;
        announce("Contrast calculated. See the text results below the preview.", "success");
    };
    const bindColor = (field, picker) => {
        field.addEventListener("input", update);
        field.addEventListener("blur", () => {
            const parsed = parseHex(field.value);
            if (parsed)
                field.value = canonical(parsed);
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
    copy.addEventListener("click", () => {
        if (copy.disabled || !copyText)
            return;
        if (!navigator.clipboard?.writeText) {
            announce("Clipboard unavailable. Select the visible results to copy manually.", "error");
            return;
        }
        void navigator.clipboard.writeText(copyText)
            .then(() => announce("Contrast results copied.", "success"))
            .catch(() => announce("Clipboard permission denied. Select the visible results manually.", "error"));
    });
    update();
})();
