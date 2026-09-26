/*
 * Runs in <head> before the page is drawn, and must stay tiny.
 *  1. Swaps the `no-js` class for `js`, enabling the mobile menu and the
 *     theme switch (both are hidden when JavaScript is unavailable).
 *  2. Applies a theme chosen earlier with the theme switch, so the page
 *     never flashes in the wrong theme.
 */
(function () {
  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  try {
    var theme = window.localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") {
      root.setAttribute("data-theme", theme);
    }
  } catch (error) {
    // Storage unavailable (for example, blocked by the browser): the
    // operating system's light/dark setting applies instead.
  }
})();
