/* Progressive enhancement for article and research archives.
 * This standalone, dependency-free browser module is also exercised directly
 * by Node's test runner. The HTML archive remains complete without JavaScript.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    api.mount(root.document, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMIT = 160;
  const KEYS = ["q", "language", "year", "topic", "kind", "files"];
  const PREFIX = "archive-";

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  // Normalize canonical Unicode equivalents without deleting combining marks
  // from Hindi and other writing systems. Search is literal, not a regex.
  function normalize(value) {
    return clean(value).normalize("NFC").toLowerCase();
  }

  function parseTopics(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(parsed.filter(item => typeof item === "string" && item.trim())
        .map(item => item.trim())));
    } catch {
      return [];
    }
  }

  function createRecord(input) {
    const topics = Array.isArray(input.topics) ? input.topics.filter(t => typeof t === "string") : [];
    return {
      title: clean(input.title),
      text: normalize([input.title, input.description, input.author, input.text,
        topics.join(" ")].filter(Boolean).join(" ")),
      language: clean(input.language) || "und",
      year: clean(input.year),
      topics,
      kind: input.kind === "research" ? "research" : "article",
      files: Number.isFinite(input.files) && input.files > 0,
    };
  }

  function defaults() {
    return { q: "", language: "", year: "", topic: "", kind: "", files: "" };
  }

  function values(records, key) {
    if (key === "topic") return new Set(records.flatMap(record => record.topics));
    if (key === "files") return new Set(["yes", "no"]);
    if (key === "kind") return new Set(["article", "research"]);
    return new Set(records.map(record => record[key]).filter(Boolean));
  }

  function sanitize(input, records) {
    const state = defaults();
    state.q = clean(input.q).slice(0, LIMIT);
    for (const key of KEYS.slice(1)) {
      const value = clean(input[key]);
      if (values(records, key).has(value)) state[key] = value;
    }
    return state;
  }

  function readAddress(search, records) {
    const params = new URLSearchParams(search);
    const raw = {};
    for (const key of KEYS) raw[key] = params.get(PREFIX + key) || "";
    return sanitize(raw, records);
  }

  function writeAddress(location, state) {
    const params = new URLSearchParams(location.search);
    for (const key of KEYS) {
      const name = PREFIX + key;
      if (state[key]) params.set(name, state[key]);
      else params.delete(name);
    }
    const query = params.toString();
    return location.pathname + (query ? "?" + query : "") + location.hash;
  }

  function active(state) {
    return KEYS.some(key => Boolean(state[key]));
  }

  function matches(record, state) {
    const terms = normalize(state.q).split(/\s+/u).filter(Boolean);
    return terms.every(term => record.text.includes(term)) &&
      (!state.language || record.language === state.language) &&
      (!state.year || record.year === state.year) &&
      (!state.topic || record.topics.includes(state.topic)) &&
      (!state.kind || record.kind === state.kind) &&
      (!state.files || record.files === (state.files === "yes"));
  }

  function countLabel(count, total, noun) {
    const label = total === 1 ? noun : noun + "s";
    return count === total ? "Showing all " + total + " " + label + "." :
      "Showing " + count + " of " + total + " " + label + ".";
  }

  function readRecord(node, year) {
    const title = node.querySelector(".post-card__title");
    return createRecord({
      title: title ? title.textContent : "",
      text: node.textContent,
      language: node.getAttribute("data-archive-language"),
      year,
      topics: parseTopics(node.getAttribute("data-archive-topics")),
      kind: node.getAttribute("data-archive-kind"),
      files: Number(node.getAttribute("data-archive-files") || 0),
    });
  }

  function addOptions(document, select, entries) {
    for (const [value, label] of entries) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function ordered(set) {
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function mount(document, window) {
    const form = document.querySelector("[data-archive-filter]");
    const list = document.querySelector("[data-archive-results]");
    if (!form || !list) return null;

    const controls = {};
    for (const key of KEYS) {
      controls[key] = form.querySelector("[data-archive-" + key + "]");
      if (!controls[key] && key !== "kind") return null;
    }
    const reset = form.querySelector("[data-archive-reset]");
    const status = form.querySelector("[data-archive-status]");
    const empty = list.querySelector("[data-archive-empty]");
    if (!reset || !status || !empty) return null;

    const groups = Array.from(list.querySelectorAll("[data-archive-year-group]"))
      .map(group => {
        const year = group.getAttribute("data-archive-year-group") || "";
        const count = group.querySelector("[data-archive-year-count]");
        const items = Array.from(group.querySelectorAll("[data-archive-item]"))
          .map(node => ({ node, record: readRecord(node, year) }));
        return { group, year, count, items };
      });
    const records = groups.flatMap(group => group.items.map(item => item.record));
    if (!records.length) return null;

    // Use the site's translated language labels but expose only languages
    // present in the published archive. Unknown legacy codes remain usable.
    const languageLabels = new Map(Array.from(controls.language.options)
      .map(option => [option.value, option.textContent]));
    for (const option of Array.from(controls.language.options)) {
      if (option.value) option.remove();
    }
    addOptions(document, controls.language, ordered(values(records, "language"))
      .map(value => [value, languageLabels.get(value) || value]));
    addOptions(document, controls.year, ordered(values(records, "year")).reverse()
      .map(value => [value, value]));
    addOptions(document, controls.topic, ordered(values(records, "topic"))
      .map(value => [value, value]));

    const supplements = Array.from(document.querySelectorAll("[data-archive-supplement]"));
    const noun = form.getAttribute("data-archive-noun") || "publication";
    let state = defaults();
    let timer;

    function syncControls() {
      for (const key of KEYS) if (controls[key]) controls[key].value = state[key];
    }

    function render(typing) {
      let total = 0;
      for (const group of groups) {
        let visible = 0;
        for (const item of group.items) {
          const show = matches(item.record, state);
          item.node.hidden = !show;
          if (show) visible++;
        }
        group.group.hidden = visible === 0;
        if (group.count) {
          group.count.textContent = "· " + visible + " " + (visible === 1 ? noun : noun + "s");
        }
        total += visible;
      }
      for (const section of supplements) section.hidden = active(state);
      empty.hidden = total !== 0;
      reset.disabled = !active(state);
      window.clearTimeout(timer);
      const message = countLabel(total, records.length, noun);
      if (typing) timer = window.setTimeout(() => { status.textContent = message; }, 200);
      else status.textContent = message;
    }

    function restore() {
      state = readAddress(window.location.search, records);
      if (!controls.kind) state.kind = "";
      syncControls();
      render(false);
    }

    function persist() {
      try {
        const next = writeAddress(window.location, state);
        window.history.replaceState(window.history.state, "", next);
      } catch {
        // Restricted browser contexts can still use the filters.
      }
    }

    function apply(typing) {
      const raw = {};
      for (const key of KEYS) raw[key] = controls[key] ? controls[key].value : "";
      state = sanitize(raw, records);
      // Do not trim the text field while typing (e.g. after a space).
      render(typing);
      persist();
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      apply(false);
    });
    controls.q.addEventListener("input", () => apply(true));
    for (const key of KEYS.slice(1)) {
      if (controls[key]) controls[key].addEventListener("change", () => apply(false));
    }
    reset.addEventListener("click", () => {
      state = defaults();
      syncControls();
      render(false);
      persist();
      controls.q.focus();
    });
    window.addEventListener("popstate", restore);
    restore();
    form.hidden = false;

    return { getState: () => Object.assign({}, state) };
  }

  return { LIMIT, KEYS, normalize, parseTopics, createRecord, defaults, values,
    sanitize, readAddress, writeAddress, active, matches, countLabel, mount };
});
