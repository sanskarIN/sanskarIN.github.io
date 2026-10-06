"use strict";
/*
 * Progressive enhancements. The site works without this file: navigation is
 * plain HTML and the colors follow the operating system's theme.
 *
 *  - Theme switch: toggles light/dark and remembers the choice in
 *    localStorage under the key "theme" (only after the switch is used).
 *  - Mobile menu: a disclosure button; its aria-expanded state drives the CSS.
 *  - Copy buttons: copy an email address to the clipboard.
 *  - Contact form (when enabled): sends the message, then opens the
 *    thank-you page.
 *  - Site search: the header button, Ctrl+K or Cmd+K, or "/" opens it; the
 *    search itself (search.js) is loaded the first time it's used.
 *  - Blog posts: copy buttons on code blocks, and "On this page" shows the
 *    section being read.
 *
 * Source: src/ts/main.ts, compiled to assets/js/main.js (npm run build).
 */
(() => {
    const root = document.documentElement;
    const THEME_KEY = "theme";
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const copyStatus = document.querySelector("[data-copy-status]");
    // Reads a message out to screen readers through the page's status line.
    const announce = (message) => {
        if (!copyStatus)
            return;
        copyStatus.textContent = "";
        window.setTimeout(() => {
            copyStatus.textContent = message;
        }, 50);
    };
    /* Theme switch ---------------------------------------------------------- */
    const activeTheme = () => {
        const chosen = root.getAttribute("data-theme");
        if (chosen === "light" || chosen === "dark")
            return chosen;
        return systemDark.matches ? "dark" : "light";
    };
    // Match the browser UI color to an explicitly chosen theme.
    const syncThemeColor = () => {
        if (!root.hasAttribute("data-theme"))
            return;
        const color = getComputedStyle(root).getPropertyValue("--color-bg").trim();
        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
    };
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const updateThemeToggle = () => {
        if (themeToggle)
            themeToggle.setAttribute("aria-pressed", activeTheme() === "dark" ? "true" : "false");
    };
    const setTheme = (next) => {
        root.setAttribute("data-theme", next);
        try {
            window.localStorage.setItem(THEME_KEY, next);
        }
        catch {
            // Not persisted; the choice still applies until the page is left.
        }
        updateThemeToggle();
        syncThemeColor();
    };
    if (themeToggle) {
        themeToggle.addEventListener("click", () => setTheme(activeTheme() === "dark" ? "light" : "dark"));
        systemDark.addEventListener("change", updateThemeToggle);
        updateThemeToggle();
    }
    syncThemeColor();
    /* Mobile menu ----------------------------------------------------------- */
    const navToggle = document.querySelector("[data-nav-toggle]");
    const header = navToggle ? navToggle.closest(".site-header") : null;
    if (navToggle && header) {
        const isOpen = () => navToggle.getAttribute("aria-expanded") === "true";
        const setOpen = (open) => navToggle.setAttribute("aria-expanded", open ? "true" : "false");
        navToggle.addEventListener("click", () => setOpen(!isOpen()));
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && isOpen()) {
                setOpen(false);
                navToggle.focus();
            }
        });
        document.addEventListener("click", (event) => {
            if (isOpen() && !header.contains(event.target))
                setOpen(false);
        });
        window.matchMedia("(min-width: 48em)").addEventListener("change", (event) => {
            if (event.matches)
                setOpen(false);
        });
    }
    /* Copy buttons ---------------------------------------------------------- */
    const copyButtons = document.querySelectorAll("[data-copy]");
    if (copyButtons.length) {
        if (!navigator.clipboard || !window.isSecureContext) {
            copyButtons.forEach((button) => {
                button.hidden = true;
            });
        }
        else {
            copyButtons.forEach((button) => {
                const label = button.querySelector("[data-copy-label]");
                const defaultLabel = label ? label.textContent : "";
                let resetTimer;
                button.addEventListener("click", () => {
                    const text = button.getAttribute("data-copy") || "";
                    navigator.clipboard.writeText(text).then(() => {
                        if (label)
                            label.textContent = "Copied";
                        announce(`Copied ${text} to the clipboard.`);
                        window.clearTimeout(resetTimer);
                        resetTimer = window.setTimeout(() => {
                            if (label)
                                label.textContent = defaultLabel;
                        }, 2000);
                    }, () => announce("Copying failed. Select the address and copy it manually."));
                });
            });
        }
    }
    /* Site search ------------------------------------------------------------ */
    const searchButtons = document.querySelectorAll("[data-search-open]");
    let openSearch = null;
    if (searchButtons.length && "HTMLDialogElement" in window) {
        let searchScript = null;
        openSearch = (trigger) => {
            if (window.siteSearch) {
                window.siteSearch.open(trigger);
                return;
            }
            if (searchScript)
                return;
            searchScript = document.createElement("script");
            searchScript.src = trigger.getAttribute("data-search-script") || "";
            searchScript.onload = () => {
                if (window.siteSearch)
                    window.siteSearch.open(trigger);
            };
            searchScript.onerror = () => {
                if (searchScript)
                    searchScript.remove();
                searchScript = null;
            };
            document.head.appendChild(searchScript);
        };
        const launch = openSearch;
        searchButtons.forEach((button) => {
            button.hidden = false;
            button.addEventListener("click", () => launch(button));
        });
        document.addEventListener("keydown", (event) => {
            const target = event.target;
            const typing = Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));
            if (event.altKey || event.defaultPrevented)
                return;
            if ((event.key === "k" || event.key === "K") && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                launch(searchButtons[0]);
            }
            else if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                launch(searchButtons[0]);
            }
        });
    }
    /* Blog posts: copy buttons on code blocks ------------------------------------ */
    const codeBlocks = document.querySelectorAll(".post__content pre");
    if (codeBlocks.length && navigator.clipboard && window.isSecureContext) {
        codeBlocks.forEach((pre, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = "code-block";
            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(pre);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "code-block__copy";
            button.textContent = "Copy";
            button.setAttribute("aria-label", `Copy code example ${index + 1}`);
            wrapper.appendChild(button);
            let resetTimer;
            button.addEventListener("click", () => {
                navigator.clipboard.writeText(pre.innerText.replace(/\n$/, "")).then(() => {
                    button.textContent = "Copied";
                    announce(`Code example ${index + 1} copied to the clipboard.`);
                    window.clearTimeout(resetTimer);
                    resetTimer = window.setTimeout(() => {
                        button.textContent = "Copy";
                    }, 2000);
                }, () => announce("Copying failed. Select the code and copy it manually."));
            });
        });
    }
    /* Blog posts: "On this page" -------------------------------------------------- */
    const postToc = document.querySelector("[data-post-toc]");
    if (postToc) {
        // Open on wide screens, where it sits beside the post; closed on small
        // screens, where it comes before the post.
        if (window.matchMedia("(min-width: 64em)").matches)
            postToc.open = true;
        const tocLinks = Array.from(postToc.querySelectorAll('a[href^="#"]'));
        const tocTargets = tocLinks.map((link) => document.getElementById(decodeURIComponent((link.getAttribute("href") || "").slice(1))));
        if (tocTargets.every(Boolean)) {
            let tocTicking = false;
            const markCurrent = () => {
                tocTicking = false;
                const offset = parseFloat(getComputedStyle(root).scrollPaddingTop) || 80;
                let current = -1;
                for (let i = 0; i < tocTargets.length; i++) {
                    if (tocTargets[i].getBoundingClientRect().top - offset <= 1)
                        current = i;
                    else
                        break;
                }
                tocLinks.forEach((link, i) => {
                    if (i === current)
                        link.setAttribute("aria-current", "true");
                    else
                        link.removeAttribute("aria-current");
                });
            };
            window.addEventListener("scroll", () => {
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
    const contactForm = document.querySelector("[data-contact-form]");
    if (contactForm) {
        const formStatus = contactForm.querySelector("[data-form-status]");
        const sendButton = contactForm.querySelector('button[type="submit"]');
        const thanksUrl = contactForm.getAttribute("data-thanks");
        let sending = false;
        const showStatus = (message, state) => {
            formStatus.textContent = message;
            formStatus.setAttribute("data-state", state);
        };
        contactForm.addEventListener("submit", (event) => {
            event.preventDefault();
            if (sending)
                return;
            sending = true;
            sendButton.setAttribute("aria-disabled", "true");
            showStatus("Sending your message…", "pending");
            const fields = {};
            new FormData(contactForm).forEach((value, key) => {
                if (key !== "redirect")
                    fields[key] = value;
            });
            window
                .fetch(contactForm.action, {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(fields),
            })
                .then((response) => response
                .json()
                .catch(() => ({}))
                .then((result) => {
                if (!response.ok || result.success === false)
                    throw new Error("Message not sent");
            }))
                .then(() => {
                showStatus("Thank you — your message has been sent.", "success");
                contactForm.reset();
                if (thanksUrl) {
                    // The button stays disabled while the thank-you page opens.
                    window.location.assign(thanksUrl);
                    return true;
                }
                return false;
            }, () => {
                showStatus("Sorry, your message could not be sent. Please try again, or email me at one of the addresses above.", "error");
                return false;
            })
                .then((leaving) => {
                if (leaving)
                    return;
                sending = false;
                sendButton.removeAttribute("aria-disabled");
            });
        });
        // Coming back from the thank-you page with the Back button: the form is
        // ready for another message.
        window.addEventListener("pageshow", (event) => {
            if (!event.persisted || !sending)
                return;
            sending = false;
            sendButton.removeAttribute("aria-disabled");
            showStatus("", "");
        });
    }
})();
