/*
 * Progressive enhancements. The site works without this file: navigation is
 * plain HTML and the colors follow the operating system's theme.
 *
 *  - Theme switch: toggles light/dark and remembers the choice in
 *    localStorage under the key "theme" (only after the switch is used).
 *  - Mobile menu: a disclosure button; its aria-expanded state drives the CSS.
 *  - Copy buttons: copy an email address to the clipboard.
 *  - Contact form (when enabled): sends the message without leaving the page.
 *  - Site search: the header button, Ctrl+K or Cmd+K, or "/" opens it; the
 *    search itself (search.js) is loaded the first time it's used.
 *  - Blog posts: copy buttons on code blocks, and "On this page" shows the
 *    section being read.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var THEME_KEY = "theme";
  var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  var copyStatus = document.querySelector("[data-copy-status]");

  // Reads a message out to screen readers through the page's status line.
  function announce(message) {
    if (!copyStatus) return;
    copyStatus.textContent = "";
    window.setTimeout(function () {
      copyStatus.textContent = message;
    }, 50);
  }

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

  /* Site search ------------------------------------------------------------ */

  var searchButtons = document.querySelectorAll("[data-search-open]");
  if (searchButtons.length && window.HTMLDialogElement && window.fetch) {
    var searchScript = null;
    var openSearch = function (trigger) {
      if (window.siteSearch) {
        window.siteSearch.open(trigger);
        return;
      }
      if (searchScript) return;
      searchScript = document.createElement("script");
      searchScript.src = trigger.getAttribute("data-search-script");
      searchScript.onload = function () {
        if (window.siteSearch) window.siteSearch.open(trigger);
      };
      searchScript.onerror = function () {
        searchScript.remove();
        searchScript = null;
      };
      document.head.appendChild(searchScript);
    };

    searchButtons.forEach(function (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        openSearch(button);
      });
    });

    document.addEventListener("keydown", function (event) {
      var target = event.target;
      var typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (event.altKey || event.defaultPrevented) return;
      if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        openSearch(searchButtons[0]);
      } else if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        openSearch(searchButtons[0]);
      }
    });
  }

  /* Blog posts: copy buttons on code blocks ------------------------------------ */

  var codeBlocks = document.querySelectorAll(".post__content pre");
  if (codeBlocks.length && navigator.clipboard && window.isSecureContext) {
    codeBlocks.forEach(function (pre, index) {
      var wrapper = document.createElement("div");
      wrapper.className = "code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var button = document.createElement("button");
      button.type = "button";
      button.className = "code-block__copy";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "Copy code example " + (index + 1));
      wrapper.appendChild(button);

      var resetTimer;
      button.addEventListener("click", function () {
        navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(
          function () {
            button.textContent = "Copied";
            announce("Code example " + (index + 1) + " copied to the clipboard.");
            window.clearTimeout(resetTimer);
            resetTimer = window.setTimeout(function () {
              button.textContent = "Copy";
            }, 2000);
          },
          function () {
            announce("Copying failed. Select the code and copy it manually.");
          }
        );
      });
    });
  }

  /* Blog posts: "On this page" -------------------------------------------------- */

  var postToc = document.querySelector("[data-post-toc]");
  if (postToc) {
    // Open on wide screens, where it sits beside the post; closed on small
    // screens, where it comes before the post.
    if (window.matchMedia("(min-width: 64em)").matches) postToc.open = true;

    var tocLinks = Array.prototype.slice.call(postToc.querySelectorAll('a[href^="#"]'));
    var tocTargets = tocLinks.map(function (link) {
      return document.getElementById(decodeURIComponent(link.getAttribute("href").slice(1)));
    });
    if (tocTargets.every(Boolean)) {
      var tocTicking = false;
      var markCurrent = function () {
        tocTicking = false;
        var offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 80;
        var current = -1;
        for (var i = 0; i < tocTargets.length; i++) {
          if (tocTargets[i].getBoundingClientRect().top - offset <= 1) current = i;
          else break;
        }
        tocLinks.forEach(function (link, i) {
          if (i === current) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      };
      window.addEventListener("scroll", function () {
        if (!tocTicking) {
          tocTicking = true;
          window.requestAnimationFrame(markCurrent);
        }
      }, { passive: true });
      markCurrent();
    }
  }

  /* Contact form ---------------------------------------------------------- */

  // Without JavaScript the form posts normally and the form service redirects
  // to the thank-you page. Here it is sent in the background instead: once
  // it's delivered, the thank-you page opens; a problem is reported in the
  // status line, so nothing typed is lost.
  var contactForm = document.querySelector("[data-contact-form]");
  if (contactForm && window.fetch) {
    var formStatus = contactForm.querySelector("[data-form-status]");
    var sendButton = contactForm.querySelector('button[type="submit"]');
    var thanksUrl = contactForm.getAttribute("data-thanks");
    var sending = false;

    var showStatus = function (message, state) {
      formStatus.textContent = message;
      formStatus.setAttribute("data-state", state);
    };

    contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending) return;
      sending = true;
      sendButton.setAttribute("aria-disabled", "true");
      showStatus("Sending your message…", "pending");

      var fields = {};
      new FormData(contactForm).forEach(function (value, key) {
        if (key !== "redirect") fields[key] = value;
      });

      window
        .fetch(contactForm.action, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(fields)
        })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (result) {
              if (!response.ok || result.success === false) throw new Error("Message not sent");
            });
        })
        .then(
          function () {
            showStatus("Thank you — your message has been sent.", "success");
            contactForm.reset();
            if (thanksUrl) {
              // The button stays disabled while the thank-you page opens.
              window.location.assign(thanksUrl);
              return true;
            }
          },
          function () {
            showStatus("Sorry, your message could not be sent. Please try again, or email me at one of the addresses above.", "error");
          }
        )
        .then(function (leaving) {
          if (leaving) return;
          sending = false;
          sendButton.removeAttribute("aria-disabled");
        });
    });
  }
})();
