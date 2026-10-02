/*
 * The Projects page: search the repositories, filter them by language, and
 * sort them. The list works without this file — it only hides items and
 * changes their order. The choices are kept in the page address
 * (?q=…&language=…&sort=…), so a filtered list can be bookmarked or shared.
 */
(function () {
  "use strict";

  var form = document.querySelector("[data-repo-filters]");
  var list = document.querySelector("[data-repo-list]");
  if (!form || !list || !window.URLSearchParams || !window.history.replaceState) return;

  var search = form.querySelector("[data-repo-search]");
  var language = form.querySelector("[data-repo-language]");
  var sort = form.querySelector("[data-repo-sort]");
  var status = document.querySelector("[data-repo-status]");
  var empty = document.querySelector("[data-repo-empty]");
  var reset = document.querySelector("[data-repo-reset]");
  // Most recently updated first, as the page lists them.
  var items = Array.prototype.slice.call(list.children);
  var statusTimer = null;

  function normalize(text) {
    text = String(text || "").toLowerCase();
    return text.normalize ? text.normalize("NFD").replace(/[̀-ͯ]/g, "") : text;
  }

  items.forEach(function (item) {
    item.searchText = normalize(item.getAttribute("data-text"));
  });

  function sorted(by) {
    var copy = items.slice();
    if (by === "stars") {
      copy.sort(function (a, b) {
        return Number(b.getAttribute("data-stars")) - Number(a.getAttribute("data-stars")) ||
          items.indexOf(a) - items.indexOf(b);
      });
    } else if (by === "name") {
      copy.sort(function (a, b) {
        return a.getAttribute("data-name").localeCompare(b.getAttribute("data-name"));
      });
    }
    return copy;
  }

  function hasOption(select, value) {
    return Array.prototype.some.call(select.options, function (option) {
      return option.value === value;
    });
  }

  function saveToAddress() {
    var params = new URLSearchParams(window.location.search);
    [["q", search.value.trim()], ["language", language.value], ["sort", sort.value === "updated" ? "" : sort.value]]
      .forEach(function (pair) {
        if (pair[1]) params.set(pair[0], pair[1]);
        else params.delete(pair[0]);
      });
    var query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  }

  function update(save) {
    var terms = normalize(search.value).split(/\s+/).filter(Boolean);
    var chosen = language.value;
    var shown = 0;
    sorted(sort.value).forEach(function (item) {
      var match = (!chosen || item.getAttribute("data-language") === chosen) &&
        terms.every(function (term) {
          return item.searchText.indexOf(term) !== -1;
        });
      item.hidden = !match;
      if (match) shown += 1;
      list.appendChild(item);
    });
    empty.hidden = shown !== 0;

    // Announced after typing pauses, not on every key.
    window.clearTimeout(statusTimer);
    var filtered = terms.length > 0 || chosen !== "";
    statusTimer = window.setTimeout(function () {
      status.textContent = filtered
        ? "Showing " + shown + " of " + items.length + (items.length === 1 ? " repository." : " repositories.")
        : "";
    }, 400);
    if (save) saveToAddress();
  }

  var params = new URLSearchParams(window.location.search);
  search.value = (params.get("q") || "").slice(0, 100);
  if (hasOption(language, params.get("language") || "")) language.value = params.get("language") || "";
  if (hasOption(sort, params.get("sort") || "")) sort.value = params.get("sort");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });
  search.addEventListener("input", function () {
    update(true);
  });
  language.addEventListener("change", function () {
    update(true);
  });
  sort.addEventListener("change", function () {
    update(true);
  });
  reset.addEventListener("click", function () {
    search.value = "";
    language.value = "";
    update(true);
    search.focus();
  });

  form.hidden = false;
  update(false);
})();
