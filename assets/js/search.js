/*
 * Site search: a dialog that searches the pages, blog posts, and projects
 * listed in /search.json. Loaded by main.js the first time search is opened
 * (the header button, Ctrl+K or Cmd+K, or the "/" key).
 *
 * Everything happens in the browser: what you type is never sent anywhere.
 * The results follow the combobox pattern: the arrow keys move through
 * them, Enter opens one, and Escape closes the dialog. Each result is a
 * real link (with the option role), so it can also be opened in a new tab.
 */
(function () {
  "use strict";

  var MAX_RESULTS = 20;
  var TYPE_ORDER = { Page: 0, Post: 1, Project: 2 };
  var SUGGESTED_PAGES = ["/", "/about/", "/developer/", "/projects/", "/blog/", "/contact/"];

  var dialog, input, list, status, entries, loading, opener;
  var results = [];
  var active = -1;
  var statusTimer = null;
  var indexUrl = "";

  function normalize(text) {
    text = String(text || "").toLowerCase();
    return text.normalize ? text.normalize("NFD").replace(/[̀-ͯ]/g, "") : text;
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name, spriteUrl) {
    var svgNs = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    var use = document.createElementNS(svgNs, "use");
    use.setAttribute("href", spriteUrl + "#" + name);
    svg.appendChild(use);
    return svg;
  }

  /* The dialog --------------------------------------------------------------- */

  function build(spriteUrl) {
    dialog = element("dialog", "search-dialog");
    dialog.setAttribute("aria-label", "Search this website");

    var panel = element("div", "search-dialog__panel");
    var form = element("form", "search-dialog__form");
    form.setAttribute("role", "search");
    var label = element("label", "visually-hidden", "Search pages, posts, and projects");
    label.setAttribute("for", "site-search-input");
    input = element("input", "search-dialog__input");
    input.id = "site-search-input";
    // A text field rather than type="search": there, Escape would only clear
    // the text instead of closing the dialog.
    input.type = "text";
    input.setAttribute("enterkeyhint", "search");
    input.placeholder = "Search pages, posts, and projects";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", "site-search-results");
    var close = element("button", "search-dialog__close");
    close.type = "button";
    close.appendChild(element("span", "visually-hidden", "Close search"));
    close.appendChild(element("kbd", null, "Esc"));
    close.firstChild.nextSibling.setAttribute("aria-hidden", "true");

    form.appendChild(icon("search", spriteUrl));
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(close);

    status = element("p", "search-dialog__status");
    status.setAttribute("role", "status");
    list = element("ul", "search-dialog__results");
    list.id = "site-search-results";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Search results");
    var hint = element("p", "search-dialog__hint");
    hint.setAttribute("aria-hidden", "true");
    [["↑", "↓", "to move"], ["Enter", "to open"], ["Esc", "to close"]].forEach(function (parts) {
      var group = element("span");
      parts.forEach(function (part, index) {
        if (index === parts.length - 1) group.appendChild(document.createTextNode(" " + part));
        else group.appendChild(element("kbd", null, part));
      });
      hint.appendChild(group);
    });

    panel.appendChild(form);
    panel.appendChild(status);
    panel.appendChild(list);
    panel.appendChild(hint);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      openResult(active >= 0 ? active : 0, false);
    });
    input.addEventListener("input", function () {
      render();
    });
    input.addEventListener("keydown", onKeydown);
    dialog.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
      }
    });
    close.addEventListener("click", function () {
      dialog.close();
    });
    // A click on the dimmed area around the panel closes the dialog.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      document.documentElement.classList.remove("search-open");
      if (opener && document.contains(opener)) opener.focus();
    });
  }

  /* Searching ---------------------------------------------------------------- */

  function load() {
    if (entries || loading) return loading;
    setStatus("Loading…", true);
    loading = window.fetch(indexUrl, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (data) {
        entries = data.map(function (entry, position) {
          entry.position = position;
          entry.titleN = normalize(entry.title);
          entry.tagsN = normalize((entry.tags || []).join(" "));
          entry.textN = normalize(entry.text);
          return entry;
        });
        render();
      }, function () {
        loading = null;
        setStatus("Search couldn't be loaded. Check your connection and try again.", true);
      });
    return loading;
  }

  function score(entry, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var points = 0;
      var at = entry.titleN.indexOf(term);
      if (at === 0) points += 12;
      else if (at > 0) points += /[\s\-_.:/]/.test(entry.titleN.charAt(at - 1)) ? 9 : 6;
      if (entry.tagsN.indexOf(term) !== -1) points += 5;
      if (entry.textN.indexOf(term) !== -1) points += 2;
      if (!points) return 0; // every word must match somewhere
      total += points;
    }
    return total;
  }

  function search(query) {
    var terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      var pages = SUGGESTED_PAGES.map(function (path) {
        return entries.filter(function (entry) {
          return entry.type === "Page" && entry.url.replace(/^.*?(\/[^/]*\/?)$/, "$1") === path;
        })[0];
      }).filter(Boolean);
      var posts = entries.filter(function (entry) {
        return entry.type === "Post";
      }).slice(0, 3);
      return pages.concat(posts);
    }
    return entries
      .map(function (entry) {
        return { entry: entry, score: score(entry, terms) };
      })
      .filter(function (result) {
        return result.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score ||
          TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type] ||
          a.entry.position - b.entry.position;
      })
      .slice(0, MAX_RESULTS)
      .map(function (result) {
        return result.entry;
      });
  }

  function highlighted(text, terms) {
    var fragment = document.createDocumentFragment();
    var words = terms.filter(Boolean).map(function (term) {
      return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
    if (!words.length) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    var pattern = new RegExp("(" + words.join("|") + ")", "gi");
    text.split(pattern).forEach(function (part, index) {
      fragment.appendChild(index % 2 ? element("mark", null, part) : document.createTextNode(part));
    });
    return fragment;
  }

  function snippet(text, terms) {
    if (!text) return "";
    var lower = text.toLowerCase();
    var first = -1;
    terms.forEach(function (term) {
      var at = lower.indexOf(term);
      if (at !== -1 && (first === -1 || at < first)) first = at;
    });
    var start = first > 60 ? text.lastIndexOf(" ", first - 40) + 1 : 0;
    var piece = text.slice(start, start + 150);
    return (start > 0 ? "…" : "") + piece + (start + 150 < text.length ? "…" : "");
  }

  function setStatus(message, now) {
    window.clearTimeout(statusTimer);
    if (now) {
      status.textContent = message;
      return;
    }
    statusTimer = window.setTimeout(function () {
      status.textContent = message;
    }, 350);
  }

  function render() {
    if (!entries) return;
    var query = input.value.trim();
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    results = search(query);
    list.textContent = "";
    active = -1;
    input.removeAttribute("aria-activedescendant");

    results.forEach(function (entry, index) {
      var external = /^https?:\/\//.test(entry.url);
      var item = element("li", "search-result");
      item.setAttribute("role", "presentation");
      var link = element("a", "search-result__link");
      link.id = "site-search-option-" + index;
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.href = entry.url;
      link.tabIndex = -1;
      if (external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      var heading = element("span", "search-result__heading");
      heading.appendChild(element("span", "search-result__type search-result__type--" + entry.type.toLowerCase(), entry.type));
      var title = element("span", "search-result__title");
      title.appendChild(highlighted(entry.title, terms));
      heading.appendChild(title);
      if (external) heading.appendChild(element("span", "visually-hidden", " (GitHub, opens in a new tab)"));
      link.appendChild(heading);
      var details = entry.type === "Post" && entry.date ? entry.date + " · " : "";
      var text = snippet(entry.text, terms);
      if (details || text) {
        var line = element("span", "search-result__text");
        if (details) line.appendChild(document.createTextNode(details));
        line.appendChild(highlighted(text, terms));
        link.appendChild(line);
      }
      item.appendChild(link);
      link.addEventListener("mousemove", function () {
        if (active !== index) setActive(index, false);
      });
      list.appendChild(item);
    });

    input.setAttribute("aria-expanded", results.length ? "true" : "false");
    if (!query) {
      setStatus("", true);
    } else if (!results.length) {
      setStatus("No results for “" + query + "”.");
    } else {
      setStatus(results.length + (results.length === 1 ? " result." : " results.") + " Use the arrow keys to choose one.");
    }
    if (query && results.length) setActive(0, false);
  }

  function options() {
    return list.querySelectorAll('[role="option"]');
  }

  function setActive(index, scroll) {
    var items = options();
    if (active >= 0 && items[active]) items[active].setAttribute("aria-selected", "false");
    active = index;
    if (index < 0 || !items[index]) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    items[index].setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", items[index].id);
    if (scroll) items[index].scrollIntoView({ block: "nearest" });
  }

  function openResult(index, newTab) {
    var link = options()[index];
    if (!link) return;
    if (newTab || link.target === "_blank") window.open(link.href, "_blank", "noopener");
    else window.location.href = link.href;
  }

  function onKeydown(event) {
    var count = options().length;
    if (event.key === "ArrowDown" && count) {
      event.preventDefault();
      setActive(active + 1 >= count ? 0 : active + 1, true);
    } else if (event.key === "ArrowUp" && count) {
      event.preventDefault();
      setActive(active - 1 < 0 ? count - 1 : active - 1, true);
    } else if (event.key === "Enter" && count) {
      event.preventDefault();
      openResult(active >= 0 ? active : 0, event.ctrlKey || event.metaKey);
    }
  }

  /* Opening -------------------------------------------------------------------- */

  function open(trigger) {
    if (!dialog) {
      indexUrl = trigger.getAttribute("data-search-index");
      build(trigger.getAttribute("data-search-sprite"));
    }
    if (dialog.open) return;
    opener = document.activeElement;
    document.documentElement.classList.add("search-open");
    dialog.showModal();
    input.focus();
    input.select();
    if (entries) render();
    else load();
  }

  window.siteSearch = { open: open };
})();
