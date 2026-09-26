---
layout: legal
title: Credits
heading: Credits and website information
eyebrow: Information
lead: How this website is built, what it uses, and who made the parts that are not mine.
description: "Credits and website information for sanskarIN.github.io: technology stack, fonts, icons, hosting, copyright, and licensing."
permalink: /credits/
---
{%- assign current_year = site.time | date: "%Y" | plus: 0 -%}
{%- capture license_decision_url -%}{{ site.repository_url }}/blob/main/LICENSE_DECISION.md{%- endcapture %}

## Website

Brand
: {{ site.author.name }}. The "S" logo mark was designed for this website.

Address
: {{ site.display_url }}

Source code
: {% include link.html url=site.repository_url label="github.com/sanskarIN/sanskarIN.github.io" %}

Hosting
: {% include link.html url="https://pages.github.com/" label="GitHub Pages" %}

## Technology stack

- **{% include link.html url="https://jekyllrb.com/" label="Jekyll" %}**, a static site generator, builds the pages when changes are published; visitors receive plain HTML files.
- **Liquid** templates and **kramdown** Markdown, as provided by GitHub Pages.
- **HTML, CSS, and JavaScript** written for this website, with no CSS or JavaScript framework.

## Third-party libraries

No third-party JavaScript or CSS libraries are loaded by the website. When the site is built, the `github-pages` Ruby gem (MIT License) provides Jekyll and its plugins at the same versions GitHub Pages uses.

## Fonts

**IBM Plex Sans** and **IBM Plex Mono** by IBM, licensed under the SIL Open Font License 1.1. The font files are self-hosted and come from {% include link.html url="https://fontsource.org/" label="Fontsource" %}. The license is included with the fonts in [/assets/fonts/OFL.txt]({{ '/assets/fonts/OFL.txt' | relative_url }}). Upstream project: {% include link.html url="https://github.com/IBM/plex" label="IBM Plex on GitHub" %}.

## Icons

- **Brand icons** come from {% include link.html url="https://simpleicons.org/" label="Simple Icons" %}, released under CC0 1.0 (public domain dedication).
- **The LinkedIn icon** comes from {% include link.html url="https://icons.getbootstrap.com/" label="Bootstrap Icons" %}, MIT License, © The Bootstrap Authors. The license text is included in the icon file.
- **Interface icons** — menu, theme switch, arrows, email, and the focus-area icons — were drawn for this website.

Brand names and logos are trademarks of their respective owners. They are used only to identify links to those services and do not imply endorsement.

## Images

The site icons and the social preview image were created for this website from the logo mark and the IBM Plex fonts.

## External resources

None are loaded while you browse. Every file — fonts, icons, styles, and scripts — is served from this website. There are no content delivery networks, analytics, advertising, or embedded third-party content.

## Copyright

© {{ site.copyright_start_year }}{% if current_year > site.copyright_start_year %}–{{ current_year }}{% endif %} {{ site.author.name }}. All rights reserved. Unless stated otherwise, the website's text, design, logo, and code are protected by copyright. The third-party materials listed on this page remain the property of their respective owners.

## Licensing

- The website's source code and content are not published under an open-source license. Being able to read the code on GitHub does not grant permission to reuse it. The repository's {% include link.html url=license_decision_url label="license decision" %} explains this.
- Third-party components keep their own licenses: IBM Plex (SIL Open Font License 1.1), Simple Icons (CC0 1.0), Bootstrap Icons (MIT), and Jekyll (MIT).
- My other projects on GitHub are licensed individually. Check each repository for its license.
