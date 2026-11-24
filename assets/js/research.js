"use strict";
(() => {
    const filter = document.querySelector("[data-research-filter]");
    const select = document.querySelector("#research-language");
    const status = document.querySelector("[data-research-results]");
    const empty = document.querySelector("[data-research-empty]");
    const latest = document.querySelector("[data-research-latest]");
    const years = document.querySelector("[data-research-years]");
    const sections = Array.from(document.querySelectorAll("[data-research-year]"));
    if (!filter || !select || !status || !empty)
        return;
    function apply() {
        const chosen = select.value;
        let count = 0;
        for (const section of sections) {
            let visible = 0;
            for (const post of section.querySelectorAll("[data-research-language]")) {
                post.hidden = chosen !== "all" && post.dataset.researchLanguage !== chosen;
                if (!post.hidden)
                    visible++;
            }
            section.hidden = visible === 0;
            count += visible;
        }
        if (latest)
            latest.hidden = chosen !== "all";
        if (years)
            years.hidden = chosen !== "all";
        status.textContent = count + (count === 1 ? " matching research post" : " matching research posts");
        empty.hidden = count !== 0;
    }
    filter.hidden = false;
    select.addEventListener("change", apply);
    apply();
})();
