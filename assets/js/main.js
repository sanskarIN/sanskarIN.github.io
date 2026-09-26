/*
 * Progressive enhancements. The site works without this file: navigation is
 * plain HTML and the colors follow the operating system's theme.
 *
 *  - Theme switch: toggles light/dark and remembers the choice in
 *    localStorage under the key "theme" (only after the switch is used).
 *  - Mobile menu: a disclosure button; its aria-expanded state drives the CSS.
 *  - Copy buttons: copy an email address to the clipboard.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var THEME_KEY = "theme";
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  function onMediaChange(query, handler) {
    if (query.addEventListener) {
      query.addEventListener("change", handler);
    } else if (query.addListener) {
      query.addListener(handler); // Safari 13 and earlier
    }
  }

  /* Theme switch ---------------------------------------------------------- */

  function activeTheme() {
    var chosen = root.getAttribute("data-theme");
    if (chosen === "light" || chosen === "dark") return chosen;
    return systemDark.matches ? "dark" : "light";
  }

  // Match the browser UI color to an explicitly chosen theme.
  function syncThemeColor() {
    if (!root.hasAttribute("data-theme")) return;
    var color = getComputedStyle(root).getPropertyValue("--color-bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute("content", color);
    });
  }

  var themeToggle = document.querySelector("[data-theme-toggle]");
  if (themeToggle) {
    var updateThemeToggle = function () {
      themeToggle.setAttribute("aria-pressed", activeTheme() === "dark" ? "true" : "false");
    };

    themeToggle.addEventListener("click", function () {
      var next = activeTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (error) {
        // Not persisted; the choice still applies until the page is left.
      }
      updateThemeToggle();
      syncThemeColor();
    });

    onMediaChange(systemDark, updateThemeToggle);
    updateThemeToggle();
  }
  syncThemeColor();

  /* Mobile menu ----------------------------------------------------------- */

  var navToggle = document.querySelector("[data-nav-toggle]");
  var header = navToggle ? navToggle.closest(".site-header") : null;
  if (navToggle && header) {
    var isOpen = function () {
      return navToggle.getAttribute("aria-expanded") === "true";
    };
    var setOpen = function (open) {
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    };

    navToggle.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        navToggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });

    onMediaChange(window.matchMedia("(min-width: 48em)"), function (event) {
      if (event.matches) setOpen(false);
    });
  }

  /* Copy buttons ---------------------------------------------------------- */

  var copyButtons = document.querySelectorAll("[data-copy]");
  if (copyButtons.length) {
    if (!navigator.clipboard || !window.isSecureContext) {
      copyButtons.forEach(function (button) {
        button.hidden = true;
      });
    } else {
      var copyStatus = document.querySelector("[data-copy-status]");
      var announce = function (message) {
        if (!copyStatus) return;
        copyStatus.textContent = "";
        window.setTimeout(function () {
          copyStatus.textContent = message;
        }, 50);
      };

      copyButtons.forEach(function (button) {
        var label = button.querySelector("[data-copy-label]");
        var defaultLabel = label ? label.textContent : "";
        var resetTimer;

        button.addEventListener("click", function () {
          var text = button.getAttribute("data-copy");
          navigator.clipboard.writeText(text).then(
            function () {
              if (label) label.textContent = "Copied";
              announce("Copied " + text + " to the clipboard.");
              window.clearTimeout(resetTimer);
              resetTimer = window.setTimeout(function () {
                if (label) label.textContent = defaultLabel;
              }, 2000);
            },
            function () {
              announce("Copying failed. Select the address and copy it manually.");
            }
          );
        });
      });
    }
  }
})();
