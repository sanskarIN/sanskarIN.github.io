# License decision

## Current status: no open-source license

This repository deliberately does **not** include an open-source license (such as MIT, Apache-2.0, or GPL). No license has been selected automatically; one can be added later, on purpose.

## What this means

- Without a license, default copyright applies. The website's content, design, logo, and code are © Sanskar, all rights reserved.
- Unlicensed code is **not** automatically free to reuse. Being able to read the source on GitHub does not grant permission to copy, modify, or redistribute it.
- GitHub's Terms of Service let other GitHub users view and fork public repositories within GitHub ([section D.5](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users)). That permission does not extend to using the code or content anywhere else.
- If you would like to reuse something from this website, ask first by emailing sanskarin@outlook.in.

## Third-party components

These keep their own licenses, whatever is decided for the rest of the repository:

| Component | License | Where |
|---|---|---|
| IBM Plex Sans and IBM Plex Mono fonts | SIL Open Font License 1.1 | `assets/fonts/` (license in `assets/fonts/OFL.txt`) |
| Brand icons from Simple Icons | CC0 1.0 | `assets/icons/sprite.svg` |
| LinkedIn icon from Bootstrap Icons | MIT | `assets/icons/sprite.svg` (license text included in the file) |
| Jekyll and the `github-pages` gem | MIT | Build time only; not part of the published site |

Brand names and logos remain trademarks of their respective owners.

## Other projects

Individual open-source projects on [github.com/sanskarIN](https://www.github.com/sanskarIN) can use different licenses. The license in each project's own repository is the one that applies to that project.

## Choosing a license later

If you decide to license this repository:

1. Decide what the license should cover. A common split for personal websites is an open-source license for the code (templates, CSS, JavaScript) while the written content, logo, and personal branding stay all rights reserved — or are covered separately, for example by a Creative Commons license.
2. Add a `LICENSE` file. GitHub offers license templates when you create a file named `LICENSE`, and [choosealicense.com](https://choosealicense.com/) compares the options.
3. Update this file, the "Licensing" section of the Credits page (`credits.md`), and the "Intellectual property" section of the Terms (`terms.md`), and update the Terms' date in `_data/legal.yml`.

Choose deliberately: once something has been released under an open-source license, people who received it under that license can generally keep using it on those terms, even if the license is changed later.
