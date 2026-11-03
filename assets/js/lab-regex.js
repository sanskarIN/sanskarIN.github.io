"use strict";
// Local-only regular expression tester. The worker is terminated on timeout.
(() => {
    const root = document.querySelector("[data-regex-tool]");
    if (!root)
        return;
    const pattern = root.querySelector("[data-regex-pattern]");
    const sample = root.querySelector("[data-regex-sample]");
    const status = root.querySelector("[data-regex-status]");
    const results = root.querySelector("[data-regex-results]");
    const run = root.querySelector("[data-regex-run]");
    const example = root.querySelector("[data-regex-example]");
    const clear = root.querySelector("[data-regex-clear]");
    const flags = root.querySelectorAll("[data-regex-flag]");
    const workerHref = root.dataset.workerHref;
    if (!pattern || !sample || !status || !results || !run || !example || !clear || !workerHref)
        return;
    let worker = null;
    let timer;
    let requestId = 0;
    const say = (message, kind) => {
        status.textContent = message;
        status.dataset.state = kind;
    };
    const stop = () => {
        if (timer !== undefined)
            window.clearTimeout(timer);
        timer = undefined;
        if (worker)
            worker.terminate();
        worker = null;
        run.disabled = false;
    };
    const reset = () => {
        ++requestId;
        stop();
        results.replaceChildren();
    };
    const preview = (value) => value.length > 200 ? value.slice(0, 200) + "…" : value;
    const show = (matches, truncated) => {
        for (const [index, match] of matches.entries()) {
            const item = document.createElement("li");
            item.className = "lab-match";
            const title = document.createElement("p");
            title.className = "lab-match__heading";
            title.textContent = `Match ${index + 1} · positions ${match.start}–${match.end}`;
            const value = document.createElement("code");
            value.className = "lab-match__value";
            value.textContent = preview(match.value) || "(empty match)";
            item.append(title, value);
            if (match.groups.length) {
                const groups = document.createElement("p");
                groups.className = "form-field__hint";
                groups.textContent = "Groups: " + match.groups.map((group, i) => `${i + 1}: ${group === null ? "(unmatched)" : preview(group)}`).join(" · ");
                item.append(groups);
            }
            results.append(item);
        }
        say(matches.length ? `${matches.length} match${matches.length === 1 ? "" : "es"}${truncated ? " shown (limit reached)" : " found"}.` : "No matches found.", "success");
    };
    const execute = () => {
        reset();
        if (!pattern.value)
            return say("Enter a regular expression.", "info");
        if (pattern.value.length > 256 || sample.value.length > 32000) {
            return say("Limit: 256 pattern characters and 32,000 input characters.", "error");
        }
        const selected = Array.from(flags).filter((item) => item.checked).map((item) => item.value).join("");
        const id = requestId;
        try {
            worker = new Worker(workerHref);
            run.disabled = true;
            say("Testing in an isolated browser worker…", "info");
            worker.onmessage = (event) => {
                if (id !== requestId || event.data.id !== id)
                    return;
                stop();
                const reply = event.data;
                if (!reply.ok)
                    return say(reply.error || "Invalid pattern.", "error");
                show(reply.matches || [], Boolean(reply.truncated));
            };
            worker.onerror = () => {
                if (id !== requestId)
                    return;
                stop();
                say("The regex worker could not run in this browser.", "error");
            };
            timer = window.setTimeout(() => {
                if (id !== requestId)
                    return;
                stop();
                say("Pattern took too long and was stopped. Try a simpler expression.", "error");
            }, 800);
            worker.postMessage({ id, pattern: pattern.value, flags: selected, sample: sample.value });
        }
        catch {
            stop();
            say("This browser cannot start an isolated regex worker.", "error");
        }
    };
    run.addEventListener("click", execute);
    pattern.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            execute();
        }
    });
    for (const field of [pattern, sample, ...Array.from(flags)]) {
        field.addEventListener("input", () => { reset(); say("Input changed. Select Test pattern.", "info"); });
        field.addEventListener("change", () => { reset(); say("Input changed. Select Test pattern.", "info"); });
    }
    example.addEventListener("click", () => {
        reset();
        pattern.value = "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}";
        sample.value = "Write to hello@example.com or team@example.org.";
        flags.forEach((flag) => { flag.checked = flag.value === "g"; });
        say("Example loaded. Select Test pattern.", "info");
        pattern.focus();
    });
    clear.addEventListener("click", () => {
        reset();
        pattern.value = "";
        sample.value = "";
        say("Cleared.", "info");
        pattern.focus();
    });
})();
