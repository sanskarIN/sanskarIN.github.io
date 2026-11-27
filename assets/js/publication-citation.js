/* Publication references and portable citation exports.
 * No external service is used; metadata comes from the published HTML.
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
    text: Object.freeze({ label: "Plain reference", extension: "txt", mime: "text/plain;charset=utf-8" }),
    markdown: Object.freeze({ label: "Markdown", extension: "md", mime: "text/markdown;charset=utf-8" }),
    bibtex: Object.freeze({ label: "BibTeX", extension: "bib", mime: "application/x-bibtex;charset=utf-8" }),
    ris: Object.freeze({ label: "RIS", extension: "ris", mime: "application/x-research-info-systems;charset=utf-8" }),
    csl: Object.freeze({ label: "CSL JSON", extension: "json", mime: "application/json;charset=utf-8" }),
  });

  function clean(value) {
    // Flatten controls and line breaks so a title cannot create new RIS fields
    // or an additional record. Preserve Unicode, punctuation and capitalization.
    return typeof value === "string"
      ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/gu, " ").trim()
      : "";
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
    if (!match) return null;
    const [, y, m, d] = match;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (year < 1 || month < 1 || month > 12 || day < 1) return null;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > lengths[month - 1]) return null;
    return { iso: y + "-" + m + "-" + d, year, month, day };
  }

  function canonicalUrl(value) {
    try {
      const url = new URL(clean(value));
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
      // References identify the publication, not a particular section.
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  function slug(value) {
    return clean(value).normalize("NFKD").toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "");
  }

  function stableSuffix(value) {
    // Non-cryptographic, deterministic suffix for citation-key disambiguation.
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function keyFor(url, title, date) {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop() || "";
    let decoded = last;
    try { decoded = decodeURIComponent(last); } catch { /* Keep the encoded path. */ }
    const stem = slug(decoded) || slug(title) || "publication";
    return "p" + date.year + "-" + stem + "-" + stableSuffix(url);
  }

  function normalizeMetadata(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = clean(raw.title);
    const date = parseDate(raw.date);
    const url = canonicalUrl(raw.url);
    if (!title || !date || !url) return null;
    const updated = parseDate(raw.updated);
    return {
      title,
      subtitle: clean(raw.subtitle),
      author: clean(raw.author),
      site: clean(raw.site),
      date,
      updated: updated && updated.iso >= date.iso ? updated : null,
      url,
      language: clean(raw.language),
      version: clean(raw.version),
      key: keyFor(url, title, date),
    };
  }

  function fullTitle(meta) {
    return meta.subtitle && meta.subtitle !== meta.title
      ? meta.title + ": " + meta.subtitle
      : meta.title;
  }

  function plainReference(meta) {
    const parts = [];
    if (meta.author) parts.push(meta.author + ".");
    parts.push("(" + meta.date.iso + ").");
    parts.push(fullTitle(meta) + ".");
    if (meta.site && meta.site !== meta.author) parts.push(meta.site + ".");
    if (meta.version) parts.push("Version " + meta.version + ".");
    if (meta.updated && meta.updated.iso !== meta.date.iso) {
      parts.push("Updated " + meta.updated.iso + ".");
    }
    parts.push(meta.url);
    return parts.join(" ");
  }

  function markdownEscape(value) {
    return value.replace(/[\\\[\]\*_`<>]/g, "\\$&");
  }

  function markdownReference(meta) {
    const prefix = meta.author ? markdownEscape(meta.author) + ". " : "";
    const title = "[" + markdownEscape(fullTitle(meta)) + "](<" + meta.url.replace(/</g, "%3C").replace(/>/g, "%3E") + ">)";
    const site = meta.site && meta.site !== meta.author ? ". " + markdownEscape(meta.site) : "";
    const version = meta.version ? ". Version " + markdownEscape(meta.version) : "";
    const updated = meta.updated && meta.updated.iso !== meta.date.iso ? ". Updated " + meta.updated.iso : "";
    return prefix + "(" + meta.date.iso + "). " + title + site + version + updated + ".";
  }

  const TEX_CHARACTERS = Object.freeze({
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "&": "\\&",
    "%": "\\%",
    "$": "\\$",
    "#": "\\#",
    "_": "\\_",
    "~": "\\textasciitilde{}",
    "^": "\\textasciicircum{}",
  });

  function tex(value) {
    return value.replace(/[\\{}&%$#_~^]/g, char => TEX_CHARACTERS[char]);
  }

  function bibtexReference(meta) {
    const fields = [];
    // A display name is not a parsed family/given-name pair. A literal name
    // avoids guessing which part is a surname or splitting an organization.
    if (meta.author) fields.push(["author", "{" + tex(meta.author) + "}"]);
    fields.push(["title", "{" + tex(fullTitle(meta)) + "}"]);
    fields.push(["year", String(meta.date.year)]);
    fields.push(["date", meta.date.iso]);
    if (meta.site) fields.push(["howpublished", tex(meta.site)]);
    // The URL field is a verbatim URI in modern BibTeX/BibLaTeX processors.
    // Protect raw braces and backslashes even for unusual legacy URLs.
    fields.push(["url", meta.url.replace(/\\/g, "%5C").replace(/{/g, "%7B").replace(/}/g, "%7D")]);
    if (meta.language && meta.language !== "und") fields.push(["language", tex(meta.language)]);
    if (meta.version) fields.push(["note", "Version " + tex(meta.version)]);
    return "@misc{" + meta.key + ",\n" +
      fields.map(([field, value]) => "  " + field + " = {" + value + "}").join(",\n") +
      "\n}\n";
  }

  function risReference(meta) {
    const fields = [["TY", "ELEC"], ["ID", meta.key], ["TI", fullTitle(meta)]];
    if (meta.author) fields.push(["AU", meta.author]);
    fields.push(["PY", String(meta.date.year)]);
    fields.push(["DA", meta.date.iso.replace(/-/g, "/")]);
    if (meta.site) fields.push(["T2", meta.site]);
    fields.push(["UR", meta.url]);
    if (meta.language && meta.language !== "und") fields.push(["LA", meta.language]);
    if (meta.version) fields.push(["N1", "Version " + meta.version]);
    if (meta.updated && meta.updated.iso !== meta.date.iso) fields.push(["N1", "Updated " + meta.updated.iso]);
    fields.push(["ER", ""]);
    return fields.map(([field, value]) => field + "  - " + value).join("\r\n") + "\r\n";
  }

  function cslReference(meta) {
    const entry = {
      id: meta.key,
      type: "webpage",
      title: fullTitle(meta),
      issued: { "date-parts": [[meta.date.year, meta.date.month, meta.date.day]] },
      URL: meta.url,
    };
    if (meta.author) entry.author = [{ literal: meta.author }];
    if (meta.site) entry["container-title"] = meta.site;
    if (meta.language && meta.language !== "und") entry.language = meta.language;
    if (meta.version) entry.version = meta.version;
    return JSON.stringify([entry], null, 2) + "\n";
  }

  function getFormat(name) {
    return Object.prototype.hasOwnProperty.call(FORMATS, name) ? name : "text";
  }

  function serialize(meta, name) {
    switch (getFormat(name)) {
      case "markdown": return markdownReference(meta);
      case "bibtex": return bibtexReference(meta);
      case "ris": return risReference(meta);
      case "csl": return cslReference(meta);
      default: return plainReference(meta);
    }
  }

  function filename(meta, name) {
    return meta.key + "." + FORMATS[getFormat(name)].extension;
  }

  function metadataFromPanel(panel) {
    const raw = {};
    for (const key of ["title", "subtitle", "author", "site", "date", "updated", "url", "language", "version"]) {
      raw[key] = panel.getAttribute("data-citation-" + key) || "";
    }
    return normalizeMetadata(raw);
  }

  function mount(document, window) {
    const panel = document.querySelector("[data-citation-panel]");
    if (!panel) return null;
    const meta = metadataFromPanel(panel);
    if (!meta) return null;
    const controls = panel.querySelector("[data-citation-controls]");
    const select = panel.querySelector("[data-citation-format]");
    const output = panel.querySelector("[data-citation-output]");
    const copy = panel.querySelector("[data-citation-copy]");
    const download = panel.querySelector("[data-citation-download]");
    const status = panel.querySelector("[data-citation-status]");
    if (!controls || !select || !output || !copy || !download || !status) return null;

    function currentFormat() {
      return getFormat(select.value);
    }

    function update() {
      output.value = serialize(meta, currentFormat());
      status.textContent = "";
    }

    function selectText(message) {
      output.focus();
      output.select();
      status.textContent = message;
    }

    async function copyReference() {
      if (!window.isSecureContext || !window.navigator || !window.navigator.clipboard ||
          typeof window.navigator.clipboard.writeText !== "function") {
        selectText("Reference selected. Use your device’s copy command.");
        return;
      }
      const text = output.value;
      const format = currentFormat();
      try {
        await window.navigator.clipboard.writeText(text);
        status.textContent = FORMATS[format].label + " copied.";
      } catch {
        selectText("Copying was unavailable. The reference is selected for manual copying.");
      }
    }

    function downloadReference() {
      const format = currentFormat();
      const urls = window.URL;
      if (!window.Blob || !urls || typeof urls.createObjectURL !== "function" ||
          typeof urls.revokeObjectURL !== "function") {
        selectText("Download is unavailable here. Copy the reference instead.");
        return;
      }
      let objectUrl = "";
      let link = null;
      try {
        const blob = new window.Blob([output.value], { type: FORMATS[format].mime });
        objectUrl = urls.createObjectURL(blob);
        link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename(meta, format);
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        status.textContent = "Reference download requested.";
      } catch {
        selectText("Download is unavailable here. Copy the reference instead.");
      } finally {
        if (link) link.remove();
        if (objectUrl) {
          const savedUrl = objectUrl;
          // Allow the browser to consume the download before releasing it.
          window.setTimeout(() => urls.revokeObjectURL(savedUrl), 1000);
        }
      }
    }

    select.addEventListener("change", update);
    copy.addEventListener("click", copyReference);
    download.addEventListener("click", downloadReference);
    select.value = "text";
    update();
    controls.hidden = false;
    return { meta, currentFormat };
  }

  return { FORMATS, clean, parseDate, canonicalUrl, normalizeMetadata, fullTitle,
    plainReference, markdownReference, bibtexReference, risReference, cslReference,
    getFormat, serialize, filename, metadataFromPanel, mount };
});
