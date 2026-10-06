"use strict";
/*
 * The Projects page: search the repositories, filter them by language, and
 * sort them. The list works without this file — it only hides items and
 * changes their order. The choices are kept in the page address
 * (?q=…&language=…&sort=…), so a filtered list can be bookmarked or shared.
 *
 * Source: src/ts/projects.ts, compiled to assets/js/projects.js
 * (npm run build).
 */
(() => {
    const form = document.querySelector("[data-repo-filters]");
    const list = document.querySelector("[data-repo-list]");
    if (!form || !list)
        return;
    const search = form.querySelector("[data-repo-search]");
    const language = form.querySelector("[data-repo-language]");
    const sort = form.querySelector("[data-repo-sort]");
    const status = document.querySelector("[data-repo-status]");
    const empty = document.querySelector("[data-repo-empty]");
    const reset = document.querySelector("[data-repo-reset]");
    // Most recently updated first, as the page lists them.
    const items = Array.from(list.children);
    const searchText = new Map();
    let statusTimer;
    const normalize = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const item of items)
        searchText.set(item, normalize(item.getAttribute("data-text")));
    const sorted = (by) => {
        const copy = items.slice();
        if (by === "stars") {
            copy.sort((a, b) => Number(b.getAttribute("data-stars")) - Number(a.getAttribute("data-stars")) ||
                items.indexOf(a) - items.indexOf(b));
        }
        else if (by === "name") {
            copy.sort((a, b) => (a.getAttribute("data-name") || "").localeCompare(b.getAttribute("data-name") || ""));
        }
        return copy;
    };
    const hasOption = (select, value) => Array.from(select.options).some((option) => option.value === value);
    const saveToAddress = () => {
        const params = new URLSearchParams(window.location.search);
        const choices = [
            ["q", search.value.trim()],
            ["language", language.value],
            ["sort", sort.value === "updated" ? "" : sort.value],
        ];
        for (const [key, value] of choices) {
            if (value)
                params.set(key, value);
            else
                params.delete(key);
        }
        const query = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
    };
    const update = (save) => {
        const terms = normalize(search.value).split(/\s+/).filter(Boolean);
        const chosen = language.value;
        let shown = 0;
        for (const item of sorted(sort.value)) {
            const text = searchText.get(item) || "";
            const match = (!chosen || item.getAttribute("data-language") === chosen) &&
                terms.every((term) => text.includes(term));
            item.hidden = !match;
            if (match)
                shown += 1;
            list.appendChild(item);
        }
        empty.hidden = shown !== 0;
        // Announced after typing pauses, not on every key.
        window.clearTimeout(statusTimer);
        const filtered = terms.length > 0 || chosen !== "";
        statusTimer = window.setTimeout(() => {
            status.textContent = filtered
                ? `Showing ${shown} of ${items.length}${items.length === 1 ? " repository." : " repositories."}`
                : "";
        }, 400);
        if (save)
            saveToAddress();
    };
    const params = new URLSearchParams(window.location.search);
    search.value = (params.get("q") || "").slice(0, 100);
    if (hasOption(language, params.get("language") || ""))
        language.value = params.get("language") || "";
    if (hasOption(sort, params.get("sort") || ""))
        sort.value = params.get("sort") || "";
    form.addEventListener("submit", (event) => event.preventDefault());
    search.addEventListener("input", () => update(true));
    language.addEventListener("change", () => update(true));
    sort.addEventListener("change", () => update(true));
    reset.addEventListener("click", () => {
        search.value = "";
        language.value = "";
        update(true);
        search.focus();
    });
    form.hidden = false;
    update(false);
})();
