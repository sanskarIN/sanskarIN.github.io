"use strict";
/* Browser-local story search and sharing. All story content works without JS. */
(() => {
    const catalogue = document.querySelector("[data-story-catalogue]");
    const filters = catalogue?.querySelector("[data-story-filters]");
    const query = catalogue?.querySelector("[data-story-query]");
    const status = catalogue?.querySelector("[data-story-status]");
    const count = catalogue?.querySelector("[data-story-count]");
    const empty = catalogue?.querySelector("[data-story-empty]");
    const cards = Array.from(catalogue?.querySelectorAll("[data-story-card]") ?? []);
    const normalise = (value) => value.normalize("NFC").trim().toLocaleLowerCase("hi-IN");
    if (filters && query && status && count && empty) {
        const update = () => {
            const terms = normalise(query.value).split(/\s+/u).filter(Boolean);
            let visible = 0;
            cards.forEach((card) => {
                const haystack = normalise(card.dataset.storySearch ?? "");
                const matches = terms.every((term) => haystack.includes(term)) &&
                    (status.value === "all" || card.dataset.storyStatus === status.value);
                card.hidden = !matches;
                if (matches)
                    visible += 1;
            });
            const amount = new Intl.NumberFormat("hi-IN").format(visible);
            count.textContent = visible === 1 ? `${amount} कहानी मिली` : `${amount} कहानियाँ मिलीं`;
            empty.hidden = visible !== 0;
        };
        const reset = () => { query.value = ""; status.value = "all"; update(); };
        filters.hidden = false;
        count.hidden = false;
        filters.addEventListener("submit", (event) => event.preventDefault());
        query.addEventListener("input", update);
        status.addEventListener("change", update);
        filters.addEventListener("reset", () => window.setTimeout(reset, 0));
        catalogue?.querySelector("[data-story-clear]")?.addEventListener("click", () => {
            reset();
            query.focus();
        });
        update();
    }
    const shareStatus = document.querySelector("[data-share-status]");
    document.querySelectorAll("[data-story-share]").forEach((button) => {
        if (!navigator.share && (!navigator.clipboard || !window.isSecureContext))
            return;
        button.hidden = false;
        button.addEventListener("click", async () => {
            const url = new URL(window.location.href);
            url.search = "";
            url.hash = button.dataset.storyShare ?? "";
            try {
                if (navigator.share)
                    await navigator.share({ title: document.title, url: url.href });
                else {
                    await navigator.clipboard.writeText(url.href);
                    if (shareStatus)
                        shareStatus.textContent = "कहानी का लिंक कॉपी हो गया।";
                }
            }
            catch (error) {
                if (error instanceof DOMException && error.name === "AbortError")
                    return;
                if (shareStatus)
                    shareStatus.textContent = "लिंक साझा नहीं हो पाया। ऊपर दिए पते को कॉपी करके भेज सकते हैं।";
            }
        });
    });
})();
