/* Search, filter and sort the server-rendered document library.
 * No network requests, storage or third-party dependencies are used.
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

  const FORMATS = Object.freeze({
    PDF: "PDF document",
    PPTX: "PowerPoint presentation",
    MD: "Markdown source",
    HTML: "HTML source",
    DOCX: "Word document",
    BIB: "BibTeX bibliography",
  });
  const SORTS = Object.freeze({
    newest: "Newest publications",
    oldest: "Oldest publications",
    title: "Title A–Z",
    largest: "Largest files",
    smallest: "Smallest files",
  });
  const KEYS = ["q", "format", "language", "year", "size", "sort"];
  const QUERY_LIMIT = 160;
  const PREFIX = "resource-";
  const SIZE_BUCKETS = Object.freeze({
    small: [0, 1000000],
    medium: [1000000, 5000000],
    large: [5000000, Infinity],
  });

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalize(value) {
    return clean(value).normalize("NFC").toLowerCase();
  }

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function createRecord(input, index) {
    const format = clean(input.format).toUpperCase();
    const bytes = Number(input.bytes);
    const title = clean(input.title);
    const source = clean(input.source);
    const name = clean(input.name);
    const author = clean(input.author);
    const date = clean(input.date);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
    return {
      index,
      title,
      source,
      name,
      author,
      format,
      bytes: Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : 0,
      language: clean(input.language) || "und",
      date: validDate,
      year: validDate.slice(0, 4),
      text: normalize([title, source, name, author, format, FORMATS[format] || ""].join(" ")),
    };
  }

  function defaults() {
    return { q: "", format: "", language: "", year: "", size: "", sort: "newest" };
  }

  function available(records, key) {
    return new Set(records.map(record => record[key]).filter(Boolean));
  }

  function sanitize(raw, records) {
    const state = defaults();
    state.q = clean(raw.q).slice(0, QUERY_LIMIT);
    for (const key of ["format", "language", "year"]) {
      const value = clean(raw[key]);
      if (available(records, key).has(value)) state[key] = value;
    }
    if (own(SIZE_BUCKETS, raw.size)) state.size = raw.size;
    if (own(SORTS, raw.sort)) state.sort = raw.sort;
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
    const standard = defaults();
    for (const key of KEYS) {
      const value = state[key];
      if (value && value !== standard[key]) params.set(PREFIX + key, value);
      else params.delete(PREFIX + key);
    }
    const query = params.toString();
    return location.pathname + (query ? "?" + query : "") + location.hash;
  }

  function active(state) {
    const standard = defaults();
    return KEYS.some(key => state[key] !== standard[key]);
  }

  function matches(record, state) {
    const terms = normalize(state.q).split(/\s+/u).filter(Boolean);
    const size = state.size && SIZE_BUCKETS[state.size];
    return terms.every(term => record.text.includes(term)) &&
      (!state.format || state.format === record.format) &&
      (!state.language || state.language === record.language) &&
      (!state.year || state.year === record.year) &&
      (!size || (record.bytes >= size[0] && record.bytes < size[1]));
  }

  function sortRecords(records, sort) {
    const result = records.slice();
    const tie = (a, b) => a.index - b.index;
    switch (sort) {
      case "oldest":
        result.sort((a, b) => {
          // Unknown publication dates remain at the end, not ahead of older work.
          if (!a.date || !b.date) return Number(!a.date) - Number(!b.date) || tie(a, b);
          return a.date.localeCompare(b.date) || tie(a, b);
        });
        break;
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true }) || tie(a, b));
        break;
      case "largest":
        result.sort((a, b) => b.bytes - a.bytes || tie(a, b));
        break;
      case "smallest":
        result.sort((a, b) => a.bytes - b.bytes || tie(a, b));
        break;
      default:
        // The static page is already ordered by latest publication first.
        result.sort(tie);
    }
    return result;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
    if (bytes < 1000) return Math.round(bytes) + (bytes === 1 ? " byte" : " bytes");
    const units = [[1000000000, "GB"], [1000000, "MB"], [1000, "KB"]];
    for (const [factor, unit] of units) {
      if (bytes >= factor) return Number((bytes / factor).toFixed(2)) + " " + unit;
    }
    return "0 bytes";
  }

  function resultMessage(visible, total, state) {
    const count = visible.length;
    const noun = total === 1 ? "document" : "documents";
    const bytes = visible.reduce((sum, record) => sum + record.bytes, 0);
    const summary = count === total ? "Showing all " + total + " " + noun :
      "Showing " + count + " of " + total + " " + noun;
    const size = count ? " · " + formatBytes(bytes) + " in matching files" : "";
    const sort = state.sort !== "newest" ? " · Sorted by " + SORTS[state.sort].toLowerCase() : "";
    return summary + size + sort + ".";
  }

  function readRecord(node, index) {
    const fields = {};
    for (const key of ["title", "source", "name", "author", "format", "bytes", "language", "date"]) {
      fields[key] = node.getAttribute("data-resource-" + key);
    }
    return createRecord(fields, index);
  }

  function addOptions(document, select, entries) {
    for (const [value, label] of entries) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  function retainAvailableOptions(document, select, values, fallback) {
    const labels = new Map(Array.from(select.options).map(option => [option.value, option.textContent]));
    for (const option of Array.from(select.options)) {
      if (option.value) option.remove();
    }
    addOptions(document, select, Array.from(values)
      .sort((a, b) => (labels.get(a) || fallback(a)).localeCompare(labels.get(b) || fallback(b)))
      .map(value => [value, labels.get(value) || fallback(value)]));
  }

  function mount(document, window) {
    const form = document.querySelector("[data-resource-filter]");
    const list = document.querySelector("[data-resource-list]");
    const empty = document.querySelector("[data-resource-empty]");
    if (!form || !list || !empty) return null;
    const controls = {};
    for (const key of KEYS) {
      controls[key] = form.querySelector("[data-resource-filter-" + key + "]");
      if (!controls[key]) return null;
    }
    const reset = form.querySelector("[data-resource-reset]");
    const status = form.querySelector("[data-resource-status]");
    if (!reset || !status) return null;

    const pairs = Array.from(list.querySelectorAll("[data-resource-item]"))
      .map((node, index) => ({ node, record: readRecord(node, index) }));
    const records = pairs.map(pair => pair.record);
    if (!records.length) return null;

    retainAvailableOptions(document, controls.format, available(records, "format"), value => FORMATS[value] || value);
    retainAvailableOptions(document, controls.language, available(records, "language"), value => value);
    addOptions(document, controls.year, Array.from(available(records, "year")).sort().reverse().map(year => [year, year]));

    const nodes = new Map(pairs.map(pair => [pair.record, pair.node]));
    const orderCache = new Map();
    let appliedSort = "newest";
    let state = defaults();
    let timer;

    function orderedRecords() {
      if (!orderCache.has(state.sort)) orderCache.set(state.sort, sortRecords(records, state.sort));
      return orderCache.get(state.sort);
    }

    function syncControls() {
      for (const key of KEYS) controls[key].value = state[key];
    }

    function render(typing) {
      const order = orderedRecords();
      const visible = [];
      for (const record of order) {
        const match = matches(record, state);
        const node = nodes.get(record);
        if (node.hidden === match) node.hidden = !match;
        if (match) visible.push(record);
      }
      // Do not move nodes during search/filter changes. Only actual sorting
      // changes the DOM order, preserving focus and avoiding extra reflow.
      if (appliedSort !== state.sort) {
        for (const record of order) list.appendChild(nodes.get(record));
        appliedSort = state.sort;
      }
      empty.hidden = visible.length !== 0;
      reset.disabled = !active(state);
      const message = resultMessage(visible, records.length, state);
      window.clearTimeout(timer);
      if (typing) timer = window.setTimeout(() => { status.textContent = message; }, 200);
      else status.textContent = message;
    }

    function restore() {
      state = readAddress(window.location.search, records);
      syncControls();
      render(false);
    }

    function persist() {
      try {
        const next = writeAddress(window.location, state);
        window.history.replaceState(window.history.state, "", next);
      } catch {
        // Browser history can be restricted; the visible library still works.
      }
    }

    function apply(typing) {
      const raw = {};
      for (const key of KEYS) raw[key] = controls[key].value;
      state = sanitize(raw, records);
      render(typing);
      persist();
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      apply(false);
    });
    controls.q.addEventListener("input", () => apply(true));
    for (const key of KEYS.slice(1)) {
      controls[key].addEventListener("change", () => apply(false));
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

  return { FORMATS, SORTS, KEYS, QUERY_LIMIT, SIZE_BUCKETS, normalize, createRecord,
    defaults, available, sanitize, readAddress, writeAddress, active, matches,
    sortRecords, formatBytes, resultMessage, mount };
});
