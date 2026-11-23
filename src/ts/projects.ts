/*
 * The Projects page: search repo details and all code languages, filter by language and ownership,
 * and sort by recency, stars, classified code bytes, or name. The list works without this file — it only hides items and
 * changes their order. The choices are kept in the page address
 * (?q=…&language=…&scope=…&sort=…), so a filtered list can be bookmarked or shared.
 *
 * Source: src/ts/projects.ts, compiled to assets/js/projects.js
 * (npm run build).
 */
(() => {
  const form = document.querySelector<HTMLFormElement>("[data-repo-filters]");
  const list = document.querySelector<HTMLElement>("[data-repo-list]");
  if (!form || !list) return;

  const search = form.querySelector<HTMLInputElement>("[data-repo-search]")!;
  const language = form.querySelector<HTMLSelectElement>("[data-repo-language]")!;
  const scope = form.querySelector<HTMLSelectElement>("[data-repo-scope]")!;
  const sort = form.querySelector<HTMLSelectElement>("[data-repo-sort]")!;
  const status = document.querySelector<HTMLElement>("[data-repo-status]")!;
  const empty = document.querySelector<HTMLElement>("[data-repo-empty]")!;
  const reset = document.querySelector<HTMLButtonElement>("[data-repo-reset]")!;
  // Most recently updated first, as the page lists them.
  const items = Array.from(list.children) as HTMLElement[];
  const searchText = new Map<HTMLElement, string>();
  const sortedOrders = new Map<string, HTMLElement[]>();
  // The server renders newest-first; do not move every card when simply typing.
  let appliedSort = "updated";
  let statusTimer: number | undefined;

  const normalize = (text: string | null): string =>
    String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // Include secondary languages in the free-text search as well as the exact
  // language selector. Older snapshots without data-languages still work.
  for (const item of items) {
    const languages = (item.getAttribute("data-languages") || "")
      .split("|").filter(Boolean).join(" ");
    searchText.set(item, normalize(`${item.getAttribute("data-text") || ""} ${languages}`));
  }

  const sorted = (by: string): HTMLElement[] => {
    const cached = sortedOrders.get(by);
    if (cached) return cached;
    const copy = items.slice();
    if (by === "stars") {
      copy.sort((a, b) =>
        Number(b.getAttribute("data-stars")) - Number(a.getAttribute("data-stars")) ||
        items.indexOf(a) - items.indexOf(b));
    } else if (by === "code") {
      copy.sort((a, b) =>
        Number(b.getAttribute("data-code-bytes")) - Number(a.getAttribute("data-code-bytes")) ||
        items.indexOf(a) - items.indexOf(b));
    } else if (by === "name") {
      copy.sort((a, b) => (a.getAttribute("data-name") || "").localeCompare(b.getAttribute("data-name") || ""));
    }
    sortedOrders.set(by, copy);
    return copy;
  };

  // Exact membership avoids treating C as C++, or 'Other' as a language.
  // Older published snapshots still have the primary-language attribute.
  const matchesLanguage = (item: HTMLElement, chosen: string): boolean => {
    if (!chosen) return true;
    const names = item.getAttribute("data-languages");
    return names !== null
      ? names.split("|").includes(chosen)
      : item.getAttribute("data-language") === chosen;
  };

  const hasOption = (select: HTMLSelectElement, value: string): boolean =>
    Array.from(select.options).some((option) => option.value === value);

  const saveToAddress = (): void => {
    const params = new URLSearchParams(window.location.search);
    const choices: Array<[string, string]> = [
      ["q", search.value.trim()],
      ["language", language.value],
      ["scope", scope.value],
      ["sort", sort.value === "updated" ? "" : sort.value],
    ];
    for (const [key, value] of choices) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : "") + window.location.hash);
  };

  const sortLabels: Record<string, string> = {
    stars: "most stars",
    code: "largest classified codebase",
    name: "name",
  };

  const update = (save: boolean, typing = false): void => {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    const chosen = language.value;
    const selectedScope = scope.value;
    let shown = 0;
    const order = sorted(sort.value);
    for (const item of order) {
      const text = searchText.get(item) || "";
      const match = matchesLanguage(item, chosen) &&
        (!selectedScope || item.getAttribute("data-scope") === selectedScope) &&
        terms.every((term) => text.includes(term));
      const shouldHide = !match;
      if (item.hidden !== shouldHide) item.hidden = shouldHide;
      if (match) shown += 1;
    }

    // Filtering only changes visibility. Reorder DOM nodes on actual sort
    // changes, so typing and mobile select changes avoid unnecessary layout work.
    if (appliedSort !== sort.value) {
      for (const item of order) list.appendChild(item);
      appliedSort = sort.value;
    }
    empty.hidden = shown !== 0;

    // role=status announces result counts; a sort-only change must also
    // produce feedback. Only text input announcements are briefly debounced.
    window.clearTimeout(statusTimer);
    const filtered = terms.length > 0 || chosen !== "" || selectedScope !== "";
    const noun = items.length === 1 ? "repository" : "repositories";
    const resultMessage = filtered
      ? `Showing ${shown} of ${items.length} ${noun}.`
      : `Showing all ${items.length} ${noun}.`;
    const sortMessage = sort.value === "updated" ? "" : ` Sorted by ${sortLabels[sort.value] || "last updated"}.`;
    statusTimer = window.setTimeout(() => {
      status.textContent = filtered || save || sort.value !== "updated"
        ? resultMessage + sortMessage
        : "";
    }, typing ? 300 : 0);
    if (save) saveToAddress();
  };

  const readFromAddress = (): void => {
    const params = new URLSearchParams(window.location.search);
    search.value = (params.get("q") || "").slice(0, 100);
    const requestedLanguage = params.get("language") || "";
    const requestedScope = params.get("scope") || "";
    const requestedSort = params.get("sort") || "updated";
    language.value = hasOption(language, requestedLanguage) ? requestedLanguage : "";
    scope.value = hasOption(scope, requestedScope) ? requestedScope : "";
    sort.value = hasOption(sort, requestedSort) ? requestedSort : "updated";
  };

  // Restore bookmarked filter states when the browser changes history.
  // Do not rewrite the URL while navigating back/forward.
  window.addEventListener("popstate", () => {
    readFromAddress();
    update(false);
  });

  form.addEventListener("submit", (event) => event.preventDefault());
  search.addEventListener("input", () => update(true, true));
  language.addEventListener("change", () => update(true));
  scope.addEventListener("change", () => update(true));
  sort.addEventListener("change", () => update(true));
  reset.addEventListener("click", () => {
    search.value = "";
    language.value = "";
    scope.value = "";
    update(true);
    search.focus();
  });

  readFromAddress();
  form.hidden = false;
  update(false);
})();
