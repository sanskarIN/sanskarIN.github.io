"use strict";
// Client-only JSON tools: no network requests or persistence.
(() => {
    const root = document.querySelector("[data-json-tool]");
    if (!root)
        return;
    const input = root.querySelector("[data-json-input]");
    const output = root.querySelector("[data-json-output]");
    const status = root.querySelector("[data-json-status]");
    const indent = root.querySelector("[data-json-indent]");
    const formatButton = root.querySelector("[data-json-format]");
    const validateButton = root.querySelector("[data-json-validate]");
    const minifyButton = root.querySelector("[data-json-minify]");
    const copyButton = root.querySelector("[data-json-copy]");
    const sampleButton = root.querySelector("[data-json-sample]");
    const clearButton = root.querySelector("[data-json-clear]");
    if (!input || !output || !status || !indent || !formatButton ||
        !validateButton || !minifyButton || !copyButton || !sampleButton || !clearButton)
        return;
    const maxInputLength = 1024 * 1024;
    const setStatus = (message, state) => {
        status.textContent = message;
        status.dataset.state = state;
    };
    const resetResult = () => {
        output.value = "";
        copyButton.disabled = true;
    };
    const process = (action) => {
        resetResult();
        const raw = input.value;
        if (raw.length > maxInputLength) {
            setStatus("Input is too large. The limit is 1 MiB (1,048,576 characters).", "error");
            return;
        }
        if (!raw.trim()) {
            setStatus("Paste some JSON before running this action.", "info");
            return;
        }
        try {
            const parsed = JSON.parse(raw);
            if (action === "validate") {
                setStatus("Valid JSON. No changes were made to your input.", "success");
                return;
            }
            const spacing = action === "minify"
                ? undefined
                : indent.value === "tab" ? "\t" : indent.value === "4" ? 4 : 2;
            const result = JSON.stringify(parsed, null, spacing);
            if (typeof result !== "string") {
                setStatus("This value could not be converted back to JSON.", "error");
                return;
            }
            output.value = result;
            copyButton.disabled = false;
            setStatus(action === "minify" ? "Valid JSON — minified." : "Valid JSON — formatted.", "success");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Parsing failed.";
            setStatus(`Invalid JSON: ${message}`, "error");
        }
    };
    formatButton.addEventListener("click", () => process("format"));
    validateButton.addEventListener("click", () => process("validate"));
    minifyButton.addEventListener("click", () => process("minify"));
    input.addEventListener("input", () => {
        resetResult();
        setStatus("Input changed. Choose Format, Validate, or Minify.", "info");
    });
    sampleButton.addEventListener("click", () => {
        input.value = JSON.stringify({
            project: "Developer Lab",
            active: true,
            tools: ["format", "validate", "minify"],
            metadata: { version: 1, license: null },
        }, null, 2);
        resetResult();
        setStatus("Example loaded. Choose an action to try it.", "info");
        input.focus();
    });
    clearButton.addEventListener("click", () => {
        input.value = "";
        resetResult();
        setStatus("Cleared. Paste JSON to begin.", "info");
        input.focus();
    });
    copyButton.addEventListener("click", () => {
        if (!output.value)
            return;
        if (!navigator.clipboard?.writeText) {
            setStatus("Clipboard access is unavailable. Select and copy the result manually.", "error");
            output.focus();
            output.select();
            return;
        }
        void navigator.clipboard.writeText(output.value)
            .then(() => setStatus("Result copied to your clipboard.", "success"))
            .catch(() => {
            setStatus("Clipboard permission was denied. Select and copy the result manually.", "error");
            output.focus();
            output.select();
        });
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            process("format");
        }
    });
})();
