// @ts-nocheck
// Browser-only tools: no persistence and no network requests.
(() => {
    const root = document.querySelector("[data-url-tool]");
    if (!root)
        return;
    const get = (name) => root.querySelector("[data-url-" + name + "]");
    const input = get("input");
    const output = get("output");
    const mode = get("mode");
    const status = get("status");
    const encode = get("encode");
    const decode = get("decode");
    const example = get("example");
    const clear = get("clear");
    const copy = get("copy");
    if (!input || !output || !mode || !status || !encode || !decode || !example || !clear || !copy)
        return;
    const say = (message, state) => {
        status.textContent = message;
        status.dataset.state = state;
    };
    const reset = () => {
        output.value = "";
        copy.disabled = true;
    };
    const convert = (action) => {
        reset();
        const text = input.value;
        if (text.length > 32000)
            return say("Input exceeds the 32,000-character limit.", "error");
        if (!text)
            return say("Enter some text to convert.", "info");
        try {
            const whole = mode.value === "uri";
            output.value = action === "encode"
                ? (whole ? encodeURI(text) : encodeURIComponent(text))
                : (whole ? decodeURI(text) : decodeURIComponent(text));
            copy.disabled = false;
            say(action === "encode" ? "Encoded successfully." : "Decoded successfully.", "success");
        }
        catch (error) {
            say(error instanceof URIError ? "Invalid percent-encoding or malformed UTF-8 sequence." : "Unable to convert this text.", "error");
        }
    };
    encode.addEventListener("click", () => convert("encode"));
    decode.addEventListener("click", () => convert("decode"));
    input.addEventListener("input", () => { reset(); say("Input changed. Choose Encode or Decode.", "info"); });
    mode.addEventListener("change", () => { reset(); say("Mode changed. Choose Encode or Decode.", "info"); });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            convert("encode");
        }
    });
    example.addEventListener("click", () => {
        mode.value = "component";
        input.value = "hello world & Rust/TypeScript?";
        reset();
        say("Example loaded. Choose Encode.", "info");
        input.focus();
    });
    clear.addEventListener("click", () => {
        input.value = "";
        reset();
        say("Cleared.", "info");
        input.focus();
    });
    copy.addEventListener("click", () => {
        if (copy.disabled || !output.value)
            return;
        if (!navigator.clipboard?.writeText) {
            output.focus();
            output.select();
            return say("Clipboard unavailable. Copy the selected result manually.", "error");
        }
        void navigator.clipboard.writeText(output.value)
            .then(() => say("Result copied.", "success"))
            .catch(() => { output.focus(); output.select(); say("Clipboard denied. Copy the selected result manually.", "error"); });
    });
})();
(() => {
    const root = document.querySelector("[data-time-tool]");
    if (!root)
        return;
    const get = (name) => root.querySelector("[data-time-" + name + "]");
    const input = get("input");
    const kind = get("kind");
    const status = get("status");
    const convert = get("convert");
    const now = get("now");
    const clear = get("clear");
    const fields = {
        iso: get("iso"),
        seconds: get("seconds"),
        milliseconds: get("milliseconds"),
        local: get("local"),
    };
    const copies = root.querySelectorAll("[data-time-copy]");
    if (!input || !kind || !status || !convert || !now || !clear ||
        !fields.iso || !fields.seconds || !fields.milliseconds || !fields.local)
        return;
    const say = (message, state) => {
        status.textContent = message;
        status.dataset.state = state;
    };
    const reset = () => {
        for (const field of Object.values(fields))
            field.value = "";
        for (const button of copies)
            button.disabled = true;
    };
    const parse = (value, type) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed.length > 80)
            throw new Error("Enter a timestamp of at most 80 characters.");
        if (type === "seconds") {
            if (!/^-?\d+(?:\.\d{1,3})?$/.test(trimmed))
                throw new Error("Seconds require a number with at most 3 decimal places.");
            const ms = Math.round(Number(trimmed) * 1000);
            if (!Number.isSafeInteger(ms) || Math.abs(ms) > 8.64e15)
                throw new Error("Timestamp is outside the JavaScript Date range.");
            return ms;
        }
        if (type === "milliseconds") {
            if (!/^-?\d+$/.test(trimmed))
                throw new Error("Milliseconds require a whole number.");
            const ms = Number(trimmed);
            if (!Number.isSafeInteger(ms) || Math.abs(ms) > 8.64e15)
                throw new Error("Timestamp is outside the JavaScript Date range.");
            return ms;
        }
        const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(trimmed);
        if (!match)
            throw new Error("Use ISO 8601 with a timezone, e.g. 2026-11-03T13:30:00Z.");
        let offset = 0;
        if (match[3] !== "Z") {
            const hours = Number(match[3].slice(1, 3));
            const minutes = Number(match[3].slice(4, 6));
            if (hours > 23 || minutes > 59)
                throw new Error("Invalid timezone offset.");
            offset = (match[3][0] === "+" ? 1 : -1) * (hours * 60 + minutes) * 60000;
        }
        const ms = Date.parse(trimmed);
        if (!Number.isFinite(ms))
            throw new Error("Invalid ISO timestamp.");
        const local = new Date(ms + offset);
        if (!Number.isFinite(local.valueOf()) || local.toISOString().slice(0, 19) !== match[1])
            throw new Error("Invalid calendar date or time.");
        return ms;
    };
    const display = (milliseconds) => {
        const date = new Date(milliseconds);
        if (!Number.isFinite(date.valueOf()))
            throw new Error("Timestamp outside the JavaScript Date range.");
        fields.iso.value = date.toISOString();
        fields.seconds.value = String(milliseconds / 1000);
        fields.milliseconds.value = String(milliseconds);
        fields.local.value = date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" });
        for (const button of copies)
            button.disabled = false;
        say("Converted. Local time uses your browser's timezone.", "success");
    };
    convert.addEventListener("click", () => {
        reset();
        try {
            display(parse(input.value, kind.value));
        }
        catch (error) {
            say(error instanceof Error ? error.message : "Could not parse timestamp.", "error");
        }
    });
    now.addEventListener("click", () => {
        kind.value = "milliseconds";
        input.value = String(Date.now());
        reset();
        display(Number(input.value));
    });
    clear.addEventListener("click", () => {
        input.value = "";
        reset();
        say("Cleared.", "info");
        input.focus();
    });
    input.addEventListener("input", () => { reset(); say("Timestamp changed. Select Convert.", "info"); });
    kind.addEventListener("change", () => { reset(); say("Input type changed. Select Convert.", "info"); });
    for (const button of copies) {
        button.addEventListener("click", () => {
            const field = fields[button.dataset.timeCopy];
            if (button.disabled || !field?.value)
                return;
            if (!navigator.clipboard?.writeText)
                return say("Clipboard unavailable. Select and copy the value manually.", "error");
            void navigator.clipboard.writeText(field.value)
                .then(() => say("Value copied.", "success"))
                .catch(() => say("Clipboard permission denied. Select and copy manually.", "error"));
        });
    }
})();
