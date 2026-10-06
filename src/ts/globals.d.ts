/*
 * Types shared by the site's scripts in src/ts/. This file isn't compiled
 * to JavaScript: it only describes what the scripts share at run time.
 */

type SiteTheme = "light" | "dark";

interface Window {
  /** The search dialog, once assets/js/search.js has loaded. */
  siteSearch?: {
    open(trigger: HTMLElement, query?: string): void;
  };
  /** The theme and the search, from assets/js/main.js, for other scripts. */
  siteActions?: {
    theme(): SiteTheme;
    setTheme(theme: SiteTheme): void;
    openSearch(query?: string): boolean;
  };
}
