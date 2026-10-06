/*
 * The terminal on the Home page. The profile card in the hero becomes a
 * small terminal: type `help`, `projects`, `blog`, `cd about`, and so on to
 * explore the website, or use the buttons under it. Without JavaScript the
 * card stays as it is.
 *
 * Everything happens in the browser: commands aren't sent or saved
 * anywhere. The data (pages, profiles, projects, posts) comes from
 * /terminal.json, which Jekyll builds from _data/ and the posts; it's
 * loaded the first time a command needs it.
 *
 * Accessibility: the output is a log that screen readers announce, the
 * prompt is a labeled text field, Tab completes a command only when there
 * is something to complete (otherwise it moves focus as usual), and every
 * link in the output is a real link.
 *
 * Source: src/ts/terminal.ts, compiled to assets/js/terminal.js
 * (npm run build).
 */
(() => {
  /* Types ----------------------------------------------------------------- */

  interface Page { title: string; url: string }
  interface Profile { key: string; name: string; handle: string; url: string }
  interface Support { key: string; name: string; url: string; note?: string }
  interface Project { name: string; url: string; description: string; language: string | null; stars: number }
  interface Post { title: string; url: string; date: string }

  interface TerminalData {
    name: string;
    username: string;
    community: string;
    tagline: string;
    pages: Page[];
    profiles: Profile[];
    support: Support[];
    emails: Array<{ label: string; address: string }>;
    focus: Array<{ title: string; summary: string }>;
    technologies: Array<{ group: string; items: string[] }>;
    projects: { total: number; stars: number; featured: Project[] } | null;
    posts: Post[];
    links: Record<"projects" | "blog" | "feed" | "about" | "contact", string>;
  }

  interface Command {
    name: string;
    usage?: string;
    summary: string;
    // Easter eggs aren't listed by `help`.
    hidden?: boolean;
    needsData?: boolean;
    run(args: string[], out: Output, data: TerminalData | null): void;
  }

  /* Setup ----------------------------------------------------------------- */

  const cardElement = document.querySelector<HTMLElement>("[data-terminal]");
  const listElement = cardElement ? cardElement.querySelector<HTMLElement>(".spec-card__list") : null;
  if (!cardElement || !listElement) return;
  const card: HTMLElement = cardElement;
  const profileList: HTMLElement = listElement;

  const PROMPT = "~$";
  const MAX_BLOCKS = 40;
  const SUGGESTIONS = ["help", "projects", "blog", "socials", "contact"];
  const dataUrl = card.getAttribute("data-terminal-data") || "";
  const history: string[] = [];
  let historyIndex = 0;
  let data: TerminalData | null = null;
  let loading: Promise<TerminalData | null> | null = null;

  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string | null, text?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const isExternal = (url: string): boolean => /^https?:\/\//.test(url) && !url.startsWith(window.location.origin);

  function link(label: string, url: string): HTMLAnchorElement {
    const anchor = element("a", "terminal__link", label);
    anchor.href = url;
    if (isExternal(url)) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.appendChild(element("span", "visually-hidden", " (opens in a new tab)"));
    }
    return anchor;
  }

  /* Output ---------------------------------------------------------------- */

  // One command and what it printed.
  class Output {
    constructor(readonly block: HTMLElement) {}

    line(...parts: Array<string | Node>): HTMLParagraphElement {
      const line = element("p", "terminal__line");
      for (const part of parts) line.append(part);
      this.block.appendChild(line);
      return line;
    }

    muted(text: string): void {
      this.line(text).classList.add("terminal__line--muted");
    }

    error(text: string): void {
      this.line(text).classList.add("terminal__line--error");
    }

    // Rows of a name and a value, like the profile card.
    rows(rows: Array<[string, string | Node]>): void {
      const list = element("dl", "terminal__rows");
      for (const [name, value] of rows) {
        const row = element("div", "terminal__row");
        row.appendChild(element("dt", null, name));
        const cell = element("dd");
        cell.append(value);
        row.appendChild(cell);
        list.appendChild(row);
      }
      this.block.appendChild(list);
    }

    items(items: Array<Array<string | Node>>): void {
      const list = element("ul", "terminal__items");
      list.setAttribute("role", "list");
      for (const parts of items) {
        const item = element("li");
        for (const part of parts) item.append(part);
        list.appendChild(item);
      }
      this.block.appendChild(list);
    }
  }

  /* The terminal ------------------------------------------------------------- */

  const header = card.querySelector(".spec-card__header span");
  if (header) header.textContent = "terminal";
  card.classList.add("terminal");

  const screen = element("div", "terminal__screen");
  screen.setAttribute("role", "log");
  screen.setAttribute("aria-label", "Terminal output");
  // Lets keyboard users scroll the output.
  screen.tabIndex = 0;

  const firstBlock = element("div", "terminal__block");
  firstBlock.appendChild(commandLine("whoami"));
  profileList.replaceWith(screen);
  firstBlock.appendChild(profileList);
  screen.appendChild(firstBlock);
  const welcome = new Output(firstBlock);
  welcome.muted("Type help and press Enter, or choose a command below.");

  const form = element("form", "terminal__form");
  const label = element("label", "visually-hidden", "Terminal command");
  label.htmlFor = "terminal-input";
  const input = element("input", "terminal__input");
  input.id = "terminal-input";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("enterkeyhint", "go");
  input.setAttribute("aria-describedby", "terminal-hint");
  const hint = element("span", "visually-hidden", "Type help and press Enter to see the commands. Up and Down go through earlier commands, and Tab completes a command.");
  hint.id = "terminal-hint";
  const prompt = element("span", "terminal__prompt", PROMPT);
  prompt.setAttribute("aria-hidden", "true");
  form.append(label, prompt, input, hint);

  const chips = element("div", "terminal__chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Try a command");
  for (const name of SUGGESTIONS) {
    const chip = element("button", "terminal__chip", name);
    chip.type = "button";
    chip.addEventListener("click", () => run(name));
    chips.appendChild(chip);
  }
  card.append(form, chips);

  function commandLine(text: string): HTMLParagraphElement {
    const line = element("p", "terminal__line terminal__line--command");
    const mark = element("span", "terminal__prompt", PROMPT);
    mark.setAttribute("aria-hidden", "true");
    line.append(mark, " ", text);
    return line;
  }

  function newBlock(text: string): Output {
    const block = element("div", "terminal__block");
    block.appendChild(commandLine(text));
    screen.appendChild(block);
    while (screen.children.length > MAX_BLOCKS) screen.firstElementChild!.remove();
    return new Output(block);
  }

  const scrollToEnd = (): void => {
    screen.scrollTop = screen.scrollHeight;
  };

  function loadData(): Promise<TerminalData | null> {
    if (data) return Promise.resolve(data);
    if (!loading) {
      loading = window.fetch(dataUrl, { credentials: "same-origin" })
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json() as Promise<TerminalData>;
        })
        .then((loaded) => {
          data = loaded;
          return loaded;
        }, () => {
          loading = null;
          return null;
        });
    }
    return loading;
  }

  /* Finding things -------------------------------------------------------- */

  const slug = (text: string): string => text.toLowerCase().replace(/^\/+|\/+$/g, "").replace(/[\s.]+/g, "");

  function findPage(name: string, pages: Page[]): Page | null {
    let wanted = slug(name);
    if (["", "~", ".."].includes(wanted)) wanted = "home";
    return pages.find((page) => slug(page.title) === wanted || slug(page.url.split("/").filter(Boolean).pop() || "") === wanted) || null;
  }

  const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

  function findProfile(name: string, current: TerminalData): Profile | Support | null {
    const wanted = slug(name);
    const all: Array<Profile | Support> = [...current.profiles, ...current.support];
    return all.find((profile) => slug(profile.key) === wanted || slug(profile.name) === wanted) ||
      (wanted === "coffee" ? current.support.find((profile) => profile.key === "buymeacoffee") || null : null);
  }

  // How many single-letter changes turn one word into another.
  function distance(a: string, b: string): number {
    const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const above = previous[j];
        previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return previous[b.length];
  }

  /* Commands -------------------------------------------------------------- */

  const commands: Command[] = [
    {
      name: "help",
      summary: "Show the commands",
      run(_args, out) {
        out.line("Commands:");
        out.rows(commands.filter((command) => !command.hidden).map((command): [string, string] => [command.usage || command.name, command.summary]));
        out.muted("Up and Down go through earlier commands, and Tab completes them. There are a few hidden ones, too.");
      },
    },
    {
      name: "whoami",
      summary: "Who I am",
      run(_args, out) {
        out.block.appendChild(profileList.cloneNode(true));
      },
    },
    {
      name: "projects",
      summary: "My featured projects on GitHub",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        const projects = current.projects;
        if (!projects || !projects.featured.length) {
          out.line("See my projects on the ", link("Projects page", current.links.projects), ".");
          return;
        }
        out.line("Featured on GitHub:");
        out.items(projects.featured.map((project) => {
          const details = [project.language, project.stars ? plural(project.stars, "star") : ""].filter(Boolean).join(" · ");
          const parts: Array<string | Node> = [link(project.name, project.url)];
          if (project.description) parts.push(` — ${project.description}`);
          if (details) parts.push(element("span", "terminal__meta", ` ${details}`));
          return parts;
        }));
        out.line(`${plural(projects.total, "public repository").replace(/ys$/, "ies")}, ${plural(projects.stars, "star")}. `, link("All projects", current.links.projects));
      },
    },
    {
      name: "blog",
      summary: "The latest posts",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        if (!current.posts.length) {
          out.line("No posts yet. ", link("Visit the blog", current.links.blog));
          return;
        }
        out.items(current.posts.map((post) => [element("span", "terminal__meta", `${post.date}  `), link(post.title, post.url)]));
        out.line(link("All posts", current.links.blog), " · ", link("Feed", current.links.feed));
      },
    },
    {
      name: "stack",
      summary: "Languages, frameworks, and tools",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        out.rows(current.technologies.map((group): [string, string] => [group.group.toLowerCase(), group.items.join(" · ")]));
      },
    },
    {
      name: "focus",
      summary: "What I build",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        out.rows(current.focus.map((area): [string, string] => [area.title.toLowerCase(), area.summary]));
      },
    },
    {
      name: "socials",
      summary: "Where to find me",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        out.rows(current.profiles.map((profile): [string, Node] => [profile.name.toLowerCase(), link(profile.handle, profile.url)]));
      },
    },
    {
      name: "contact",
      summary: "How to reach me",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        out.rows(current.emails.map((email): [string, Node] => [email.label.toLowerCase(), link(email.address, `mailto:${email.address}`)]));
        out.line("Or use the form on the ", link("Contact page", current.links.contact), ".");
      },
    },
    {
      name: "support",
      summary: "Ways to support my work",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        out.rows(current.support.map((profile): [string, Node] => [profile.name.toLowerCase(), link(profile.note || profile.name, profile.url)]));
      },
    },
    {
      name: "ls",
      summary: "List the pages",
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        const pages = current.pages.filter((page) => slug(page.title) !== "home");
        const line = out.line();
        pages.forEach((page, index) => {
          if (index) line.append("  ");
          line.append(link(`${slug(page.title)}/`, page.url));
        });
      },
    },
    {
      name: "cd",
      usage: "cd <page>",
      summary: "Go to a page",
      needsData: true,
      run(args, out, current) {
        if (!current) return;
        const page = findPage(args.join(" "), current.pages);
        if (!page) {
          out.error(`cd: no such page: ${args.join(" ")}. Type ls to list them.`);
          return;
        }
        out.line(`Opening ${page.title}…`);
        window.location.assign(page.url);
      },
    },
    {
      name: "open",
      usage: "open <name>",
      summary: "Open a page or a profile",
      needsData: true,
      run(args, out, current) {
        if (!current) return;
        const name = args.join(" ");
        if (!name) {
          out.error("open: open what? Try open github, or open projects.");
          return;
        }
        const page = findPage(name, current.pages);
        if (page) {
          out.line(`Opening ${page.title}…`);
          window.location.assign(page.url);
          return;
        }
        const profile = findProfile(name, current);
        if (!profile) {
          out.error(`open: nothing called ${name}. Try socials, or ls.`);
          return;
        }
        const opened = window.open(profile.url, "_blank", "noopener");
        out.line(opened === null ? "Your browser blocked the new tab: " : "Opened ", link(profile.name, profile.url), opened === null ? "" : " in a new tab.");
      },
    },
    {
      name: "search",
      usage: "search <words>",
      summary: "Search the website",
      run(args, out) {
        const query = args.join(" ");
        const actions = window.siteActions;
        if (!actions || !actions.openSearch(query)) {
          out.error("search: search isn't available in this browser.");
          return;
        }
        out.line(query ? `Searching for “${query}”…` : "Opening search…");
      },
    },
    {
      name: "theme",
      usage: "theme [light|dark]",
      summary: "Switch the color theme",
      run(args, out) {
        const actions = window.siteActions;
        if (!actions) {
          out.error("theme: the theme can't be changed here.");
          return;
        }
        const wanted = (args[0] || "").toLowerCase();
        if (wanted && wanted !== "light" && wanted !== "dark") {
          out.error("theme: choose light or dark.");
          return;
        }
        const next: SiteTheme = wanted === "light" || wanted === "dark" ? wanted : actions.theme() === "dark" ? "light" : "dark";
        actions.setTheme(next);
        out.line(`Switched to the ${next} theme.`);
      },
    },
    {
      name: "history",
      summary: "The commands you've typed",
      run(_args, out) {
        if (history.length <= 1) {
          out.muted("Nothing yet: this is your first command.");
          return;
        }
        out.items(history.slice(0, -1).map((entry, index) => [element("span", "terminal__meta", `${index + 1}  `), entry]));
      },
    },
    {
      name: "clear",
      summary: "Clear the screen",
      run() {
        screen.textContent = "";
      },
    },
    {
      name: "date",
      summary: "Today's date",
      run(_args, out) {
        out.line(new Date().toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }));
      },
    },
    {
      name: "echo",
      usage: "echo <text>",
      summary: "Repeat what you type",
      run(args, out) {
        out.line(args.join(" "));
      },
    },
    // A few easter eggs.
    {
      name: "sudo",
      summary: "",
      hidden: true,
      run(_args, out) {
        out.line("Nice try. This terminal can show you things, but it can't change anything.");
      },
    },
    {
      name: "hello",
      summary: "",
      hidden: true,
      run(_args, out) {
        out.line("Hello! Thanks for stopping by. Type help to see what you can explore.");
      },
    },
    {
      name: "coffee",
      summary: "",
      hidden: true,
      needsData: true,
      run(_args, out, current) {
        if (!current) return;
        const coffee = current.support.find((profile) => profile.key === "buymeacoffee");
        if (coffee) out.line("Coffee keeps the commits coming: ", link(coffee.name, coffee.url));
        else out.line("No coffee here, sadly.");
      },
    },
    {
      name: "exit",
      summary: "",
      hidden: true,
      run(_args, out) {
        out.line("There's no leaving this terminal, but you can always close the tab. Or type help.");
      },
    },
    {
      name: "rm",
      summary: "",
      hidden: true,
      run(_args, out) {
        out.line("rm: nothing here can be deleted. This website is read-only.");
      },
    },
  ];

  const aliases: Record<string, string> = {
    "?": "help",
    man: "help",
    about: "whoami",
    posts: "blog",
    skills: "stack",
    links: "socials",
    social: "socials",
    email: "contact",
    hi: "hello",
    cls: "clear",
    quit: "exit",
  };

  const lookup = (name: string): Command | undefined => {
    const wanted = aliases[name] || name;
    return commands.find((command) => command.name === wanted);
  };

  /* Running a command ------------------------------------------------------ */

  function run(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    history.push(trimmed);
    historyIndex = history.length;
    const [name, ...args] = trimmed.split(/\s+/);
    const command = lookup(name.toLowerCase());
    const out = newBlock(trimmed);
    if (!command) {
      const nearest = commands
        .filter((candidate) => !candidate.hidden)
        .map((candidate) => ({ name: candidate.name, score: distance(name.toLowerCase(), candidate.name) }))
        .sort((a, b) => a.score - b.score)[0];
      out.error(`command not found: ${name}`);
      if (nearest && nearest.score <= 2) out.muted(`Did you mean ${nearest.name}? Type help for the list.`);
      else out.muted("Type help for the list of commands.");
      scrollToEnd();
      return;
    }
    if (!command.needsData) {
      command.run(args, out, data);
      scrollToEnd();
      return;
    }
    const waiting = data ? null : out.line("Loading…");
    void loadData().then((loaded) => {
      if (waiting) waiting.remove();
      if (!loaded) out.error("That couldn't be loaded. Check your connection and try again.");
      else command.run(args, out, loaded);
      scrollToEnd();
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    run(text);
  });

  // Completes a command, or the page or profile after cd and open.
  function complete(): boolean {
    const value = input.value;
    const parts = value.split(/\s+/);
    if (parts.length === 1) {
      const word = parts[0].toLowerCase();
      if (!word) return false;
      const matches = commands.filter((command) => !command.hidden && command.name.startsWith(word)).map((command) => command.name);
      return applyCompletion(word, matches, "");
    }
    if (parts.length === 2 && ["cd", "open"].includes(parts[0].toLowerCase()) && data) {
      const word = parts[1].toLowerCase();
      const targets = data.pages.map((page) => slug(page.title));
      if (parts[0].toLowerCase() === "open") targets.push(...data.profiles.map((profile) => profile.key), ...data.support.map((profile) => profile.key));
      return applyCompletion(word, targets.filter((target) => target.startsWith(word)), `${parts[0]} `);
    }
    return false;
  }

  function applyCompletion(word: string, matches: string[], before: string): boolean {
    if (!matches.length) return false;
    if (matches.length === 1) {
      input.value = `${before}${matches[0]} `;
      return true;
    }
    // Several matches: complete what they share, and list them.
    let shared = matches[0];
    for (const match of matches) {
      while (!match.startsWith(shared)) shared = shared.slice(0, -1);
    }
    if (shared.length > word.length) {
      input.value = before + shared;
      return true;
    }
    const out = newBlock(input.value);
    out.muted(matches.join("  "));
    scrollToEnd();
    return true;
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" && history.length) {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
    } else if (event.key === "ArrowDown" && history.length) {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || "";
    } else if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (complete()) event.preventDefault();
    } else if (event.key === "Escape" && input.value) {
      event.preventDefault();
      input.value = "";
    }
  });

  // Starts loading the data when someone is about to use the terminal.
  input.addEventListener("focus", () => void loadData(), { once: true });

  // A click on the output (not on a link, and not while selecting text)
  // moves to the prompt.
  screen.addEventListener("click", (event) => {
    const selection = window.getSelection();
    if (event.target instanceof Element && event.target.closest("a")) return;
    if (selection && !selection.isCollapsed) return;
    input.focus({ preventScroll: true });
  });
})();
