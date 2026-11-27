/* Native navigation disclosures with optional keyboard and layout enhancements.
 * The HTML details/summary elements remain fully usable without this script.
 * Existing main.js owns the small-screen Menu button; this module only manages
 * the nested disclosure groups and their interaction with that button.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    api.mount(root.document, root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BREAKPOINT = "(min-width: 48em)";
  const GUTTER = 12;
  const GROUP_SELECTOR = "[data-nav-group]";

  function panelAlignment(startRect, endRect, viewport, gutter = GUTTER) {
    const overflow = rect => Math.max(0, gutter - rect.left) + Math.max(0, rect.right - (viewport - gutter));
    // Keep the natural start alignment on ties; it matches text direction
    // and avoids unexpected movement for panels that fit comfortably.
    return overflow(endRect) < overflow(startRect) ? "end" : "start";
  }

  function modified(event) {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }

  function focusableLinks(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll("a[href]")).filter(link =>
      !link.hidden && link.getAttribute("aria-disabled") !== "true" &&
      link.getAttribute("tabindex") !== "-1");
  }

  function mount(document, window) {
    const nav = document.querySelector("[data-grouped-navigation]");
    if (!nav) return null;
    const toggle = document.querySelector("[data-nav-toggle]");
    const media = window.matchMedia(BREAKPOINT);
    const groups = Array.from(nav.querySelectorAll(GROUP_SELECTOR)).map(node => ({
      node,
      summary: node.querySelector("summary"),
      panel: node.querySelector("[data-nav-panel]"),
    })).filter(group => group.summary && group.panel);
    if (!groups.length) return null;
    let disposed = false;
    let frame = null;
    let observer = null;
    const removers = [];

    function listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      removers.push(() => target.removeEventListener(name, handler, options));
    }

    function activeGroup(target) {
      return groups.find(group => target && group.node.contains(target)) || null;
    }

    function close(group, restoreFocus = false) {
      if (!group.node.open) return false;
      const shouldFocus = restoreFocus && group.node.contains(document.activeElement);
      group.node.open = false;
      group.node.removeAttribute("data-nav-align");
      if (shouldFocus) group.summary.focus();
      return true;
    }

    function closeAll(except = null, restoreFocus = false) {
      for (const group of groups) {
        if (group !== except) close(group, restoreFocus);
      }
    }

    function viewportWidth() {
      const width = document.documentElement && document.documentElement.clientWidth;
      return width || window.innerWidth || 0;
    }

    function align(group) {
      if (!group.node.open) return;
      if (!media.matches) {
        group.node.removeAttribute("data-nav-align");
        return;
      }
      const width = viewportWidth();
      if (!width || typeof group.panel.getBoundingClientRect !== "function") return;
      group.node.setAttribute("data-nav-align", "start");
      const start = group.panel.getBoundingClientRect();
      group.node.setAttribute("data-nav-align", "end");
      const end = group.panel.getBoundingClientRect();
      group.node.setAttribute("data-nav-align", panelAlignment(start, end, width));
    }

    function scheduleAlignment() {
      if (frame !== null || disposed) return;
      if (typeof window.requestAnimationFrame !== "function") {
        for (const group of groups) align(group);
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (!disposed) for (const group of groups) align(group);
      });
    }

    function open(group) {
      closeAll(group);
      group.node.open = true;
      align(group);
    }

    function onToggle(group) {
      if (disposed) return;
      if (group.node.open) {
        closeAll(group);
        align(group);
      } else {
        group.node.removeAttribute("data-nav-align");
      }
    }

    function onKey(event) {
      if (event.defaultPrevented || modified(event)) return;
      const group = activeGroup(event.target);
      if (!group) return;

      if (event.key === "Escape" && group.node.open) {
        // Handle this in capture phase so the first Escape closes only the
        // nested disclosure. A second Escape reaches main.js and closes the
        // small-screen Menu when it is open.
        event.preventDefault();
        event.stopPropagation();
        close(group);
        group.summary.focus();
        return;
      }

      const links = focusableLinks(group.panel);
      if (!links.length) return;

      if (event.target === group.summary && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        open(group);
        links[event.key === "ArrowDown" ? 0 : links.length - 1].focus();
        return;
      }

      // These are ordinary navigation links, not ARIA menu items. Tab and
      // Shift+Tab retain their native behavior. Arrow keys are conveniences
      // while focus is already inside an open disclosure.
      const index = links.indexOf(event.target);
      if (!group.node.open || index === -1) return;
      let next = index;
      if (event.key === "ArrowDown") next = (index + 1) % links.length;
      else if (event.key === "ArrowUp") next = (index - 1 + links.length) % links.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = links.length - 1;
      else return;
      event.preventDefault();
      links[next].focus();
    }

    function onFocus(event) {
      // Focus moving to another destination closes the old panel without
      // moving focus back or trapping Tab navigation.
      closeAll(activeGroup(event.target));
    }

    function onClick(event) {
      if (!event.target || !nav.contains(event.target)) {
        closeAll();
      }
    }

    function onMenuState() {
      if (media.matches || !toggle) return;
      if (toggle.getAttribute("aria-expanded") !== "true") {
        const focusInNav = nav.contains(document.activeElement);
        closeAll();
        if (focusInNav) toggle.focus();
      }
    }

    function onViewportChange() {
      const group = activeGroup(document.activeElement);
      if (!media.matches && toggle && toggle.getAttribute("aria-expanded") !== "true") {
        const focusInNav = nav.contains(document.activeElement);
        closeAll();
        if (focusInNav) toggle.focus();
        return;
      }
      // Changing between stacked and dropdown layouts should not leave
      // orphaned focus inside an element that just became hidden.
      closeAll(null, Boolean(group));
    }

    for (const group of groups) {
      listen(group.node, "toggle", () => onToggle(group));
    }
    listen(document, "keydown", onKey, true);
    listen(document, "focusin", onFocus);
    listen(document, "click", onClick);
    listen(window, "resize", scheduleAlignment, { passive: true });
    if (typeof media.addEventListener === "function") {
      listen(media, "change", onViewportChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(onViewportChange);
      removers.push(() => media.removeListener(onViewportChange));
    }

    if (toggle && typeof window.MutationObserver === "function") {
      observer = new window.MutationObserver(onMenuState);
      observer.observe(toggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    }

    // A restored page may have an open native disclosure. Normalize only
    // conflicting groups, rather than discarding the user's current panel.
    const openGroup = groups.find(group => group.node.open);
    if (openGroup) {
      closeAll(openGroup);
      align(openGroup);
    }

    return {
      closeAll: () => closeAll(),
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const remove of removers) remove();
        if (observer) observer.disconnect();
        if (frame !== null && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frame);
        }
        frame = null;
      },
    };
  }

  return { BREAKPOINT, GUTTER, panelAlignment, focusableLinks, mount };
});
