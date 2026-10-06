/*
 * Site search: a dialog that searches the pages, blog posts, and projects
 * listed in /search.json. Loaded by main.js the first time search is opened
 * (the header button, Ctrl+K or Cmd+K, or the "/" key).
 *
 * Everything happens in the browser: what you type is never sent anywhere.
 * The results follow the combobox pattern: the arrow keys move through
 * them, Enter opens one, and Escape closes the dialog. Each result is a
 * real link (with the option role), so it can also be opened in a new tab.
 *
 * Source: src/ts/search.ts, compiled to assets/js/search.js (npm run build).
 */
(() => {
  type EntryType = "Page" | "Post" | "Project";

  interface Entry {
    type: EntryType;
    title: string;
    url: string;
    text?: string;
    tags?: string[];
    date?: string;
    position: number;
    titleN: string;
    tagsN: string;
    textN: string;
  }

  const MAX_RESULTS = 20;
  const TYPE_ORDER: Record<EntryType, number> = { Page: 0, Post: 1, Project: 2 };
  const SUGGESTED_PAGES = ["/", "/about/", "/developer/", "/projects/", "/blog/", "/contact/"];

  let dialog: HTMLDialogElement;
  let input: HTMLInputElement;
  let list: HTMLUListElement;
  let status: HTMLElement;
  let entries: Entry[] | null = null;
  let loading: Promise<void> | null = null;
  let opener: Element | null = null;
  let results: Entry[] = [];
  let active = -1;
  let statusTimer: number | undefined;
  let indexUrl = "";

  const normalize = (text: unknown): string =>
    String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name: string, spriteUrl: string): SVGSVGElement {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    const use = document.createElementNS(svgNs, "use");
    use.setAttribute("href", `${spriteUrl}#${name}`);
    svg.appendChild(use);
    return svg;
  }

  /* The dialog --------------------------------------------------------------- */

  function build(spriteUrl: string): void {
    dialog = element("dialog", "search-dialog");
    dialog.setAttribute("aria-label", "Search this website");

    const panel = element("div", "search-dialog__panel");
    const form = element("form", "search-dialog__form");
    form.setAttribute("role", "search");
    const label = element("label", "visually-hidden", "Search pages, posts, and projects");
    label.htmlFor = "site-search-input";
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
    const close = element("button", "search-dialog__close");
    close.type = "button";
    close.appendChild(element("span", "visually-hidden", "Close search"));
    const closeKey = element("kbd", null, "Esc");
    closeKey.setAttribute("aria-hidden", "true");
    close.appendChild(closeKey);

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
    const hint = element("p", "search-dialog__hint");
    hint.setAttribute("aria-hidden", "true");
    const hints: string[][] = [["↑", "↓", "to move"], ["Enter", "to open"], ["Esc", "to close"]];
    for (const parts of hints) {
      const group = element("span");
      parts.forEach((part, index) => {
        if (index === parts.length - 1) group.appendChild(document.createTextNode(" " + part));
        else group.appendChild(element("kbd", null, part));
      });
      hint.appendChild(group);
    }

    panel.appendChild(form);
    panel.appendChild(status);
    panel.appendChild(list);
    panel.appendChild(hint);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      openResult(active >= 0 ? active : 0, false);
    });
    input.addEventListener("input", () => render());
    input.addEventListener("keydown", onKeydown);
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
      }
    });
    close.addEventListener("click", () => dialog.close());
    // A click on the dimmed area around the panel closes the dialog.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", () => {
      document.documentElement.classList.remove("search-open");
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    });
  }

  /* Searching ---------------------------------------------------------------- */

  function load(): Promise<void> {
    if (loading) return loading;
    setStatus("Loading…", true);
    loading = window.fetch(indexUrl, { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Array<Omit<Entry, "position" | "titleN" | "tagsN" | "textN">>>;
      })
      .then((data) => {
        entries = data.map((entry, position) => ({
          ...entry,
          position,
          titleN: normalize(entry.title),
          tagsN: normalize((entry.tags || []).join(" ")),
          textN: normalize(entry.text),
        }));
        render();
      }, () => {
        loading = null;
        setStatus("Search couldn't be loaded. Check your connection and try again.", true);
      });
    return loading;
  }

  function score(entry: Entry, terms: string[]): number {
    let total = 0;
    for (const term of terms) {
      let points = 0;
      const at = entry.titleN.indexOf(term);
      if (at === 0) points += 12;
      else if (at > 0) points += /[\s\-_.:/]/.test(entry.titleN.charAt(at - 1)) ? 9 : 6;
      if (entry.tagsN.includes(term)) points += 5;
      if (entry.textN.includes(term)) points += 2;
      if (!points) return 0; // every word must match somewhere
      total += points;
    }
    return total;
  }

  function search(query: string): Entry[] {
    const all = entries || [];
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) {
      const pages = SUGGESTED_PAGES
        .map((path) => all.find((entry) => entry.type === "Page" && entry.url.replace(/^.*?(\/[^/]*\/?)$/, "$1") === path))
        .filter((entry): entry is Entry => Boolean(entry));
      const posts = all.filter((entry) => entry.type === "Post").slice(0, 3);
      return pages.concat(posts);
    }
    return all
      .map((entry) => ({ entry, score: score(entry, terms) }))
      .filter((result) => result.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type] ||
        a.entry.position - b.entry.position)
      .slice(0, MAX_RESULTS)
      .map((result) => result.entry);
  }

  function highlighted(text: string, terms: string[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const words = terms.filter(Boolean).map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) {
      fragment.appendChild(document.createTextNode(text));
      return fragment;
    }
    const pattern = new RegExp(`(${words.join("|")})`, "gi");
    text.split(pattern).forEach((part, index) => {
      fragment.appendChild(index % 2 ? element("mark", null, part) : document.createTextNode(part));
    });
    return fragment;
  }

  function snippet(text: string | undefined, terms: string[]): string {
    if (!text) return "";
    const lower = text.toLowerCase();
    let first = -1;
    for (const term of terms) {
      const at = lower.indexOf(term);
      if (at !== -1 && (first === -1 || at < first)) first = at;
    }
    const start = first > 60 ? text.lastIndexOf(" ", first - 40) + 1 : 0;
    const piece = text.slice(start, start + 150);
    return (start > 0 ? "…" : "") + piece + (start + 150 < text.length ? "…" : "");
  }

  function setStatus(message: string, now?: boolean): void {
    window.clearTimeout(statusTimer);
    if (now) {
      status.textContent = message;
      return;
    }
    statusTimer = window.setTimeout(() => {
      status.textContent = message;
    }, 350);
  }

  function render(): void {
    if (!entries) return;
    const query = input.value.trim();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    results = search(query);
    list.textContent = "";
    active = -1;
    input.removeAttribute("aria-activedescendant");

    results.forEach((entry, index) => {
      const external = /^https?:\/\//.test(entry.url);
      const item = element("li", "search-result");
      item.setAttribute("role", "presentation");
      const link = element("a", "search-result__link");
      link.id = `site-search-option-${index}`;
      link.setAttribute("role", "option");
      link.setAttribute("aria-selected", "false");
      link.href = entry.url;
      link.tabIndex = -1;
      if (external) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      const heading = element("span", "search-result__heading");
      heading.appendChild(element("span", `search-result__type search-result__type--${entry.type.toLowerCase()}`, entry.type));
      const title = element("span", "search-result__title");
      title.appendChild(highlighted(entry.title, terms));
      heading.appendChild(title);
      if (external) heading.appendChild(element("span", "visually-hidden", " (GitHub, opens in a new tab)"));
      link.appendChild(heading);
      const details = entry.type === "Post" && entry.date ? `${entry.date} · ` : "";
      const text = snippet(entry.text, terms);
      if (details || text) {
        const line = element("span", "search-result__text");
        if (details) line.appendChild(document.createTextNode(details));
        line.appendChild(highlighted(text, terms));
        link.appendChild(line);
      }
      item.appendChild(link);
      link.addEventListener("mousemove", () => {
        if (active !== index) setActive(index, false);
      });
      list.appendChild(item);
    });

    input.setAttribute("aria-expanded", results.length ? "true" : "false");
    if (!query) {
      setStatus("", true);
    } else if (!results.length) {
      setStatus(`No results for “${query}”.`);
    } else {
      setStatus(`${results.length}${results.length === 1 ? " result." : " results."} Use the arrow keys to choose one.`);
    }
    if (query && results.length) setActive(0, false);
  }

  const options = (): NodeListOf<HTMLAnchorElement> => list.querySelectorAll<HTMLAnchorElement>('[role="option"]');

  function setActive(index: number, scroll: boolean): void {
    const items = options();
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

  function openResult(index: number, newTab: boolean): void {
    const link = options()[index];
    if (!link) return;
    if (newTab || link.target === "_blank") window.open(link.href, "_blank", "noopener");
    else window.location.href = link.href;
  }

  function onKeydown(event: KeyboardEvent): void {
    const count = options().length;
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

  function open(trigger: HTMLElement): void {
    if (!dialog) {
      indexUrl = trigger.getAttribute("data-search-index") || "";
      build(trigger.getAttribute("data-search-sprite") || "");
    }
    if (dialog.open) return;
    opener = document.activeElement;
    document.documentElement.classList.add("search-open");
    dialog.showModal();
    input.focus();
    input.select();
    if (entries) render();
    else void load();
  }

  window.siteSearch = { open };
})();
