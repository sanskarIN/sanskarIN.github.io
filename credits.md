---
layout: legal
title: Credits
heading: Credits and website information
eyebrow: Information
lead: How this website is built, what it uses, and who made the parts that are not mine.
description: "Credits and website information for sanskarIN.github.io: technology stack, fonts, icons, hosting, copyright, and licensing."
permalink: /credits/
---
{%- include accounts-config.html -%}
{%- assign current_year = site.time | date: "%Y" | plus: 0 -%}
{%- assign form_key = site.data.contact.form.access_key | strip -%}
{%- assign contact_form = site.data.contact.form -%}
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
- **HTML, CSS, and TypeScript** written for this website, with no CSS or JavaScript framework. The {% include link.html url="https://www.typescriptlang.org/" label="TypeScript" %} compiler turns the scripts into plain JavaScript before they're published.
- **Blog:** posts are written with a GitHub issue form{% if accounts_on %} or with an account on this website{% endif %} and published by a GitHub Actions workflow, which converts them to HTML and prepares their images.
- **Projects:** a GitHub Actions workflow reads my public repositories and contribution activity from the {% include link.html url="https://docs.github.com/en/rest" label="GitHub API" %} once a day and saves them with the website, so the Projects page needs no requests to GitHub while you browse.
- **Search:** a small script searches an index of the website's pages, posts, and projects, generated when the site is built, in your browser.
- **Terminal:** the terminal on the Home page reads a list of the website's pages, profiles, projects, and posts, also generated when the site is built, and runs in your browser.
{% if accounts_on %}- **Accounts:** {% include link.html url="https://supabase.com/" label="Supabase" %} provides sign-in with emailed codes, author profiles, and image uploads (its Auth, Postgres database, Storage, and Edge Functions services). The website talks to it with its own small script, without a client library.
{% endif %}
## Third-party libraries

No third-party JavaScript or CSS libraries are loaded by the website. When the site is built, the `github-pages` Ruby gem (MIT License) provides Jekyll and its plugins at the same versions GitHub Pages uses.

The workflows that publish blog posts and update the Projects page use these Python packages, which are never loaded by the website:

- {% include link.html url="https://github.com/executablebooks/markdown-it-py" label="markdown-it-py" %}, with linkify-it-py, mdurl, and uc-micro-py (MIT License), to convert Markdown to HTML;
- {% include link.html url="https://github.com/messense/nh3" label="nh3" %} (MIT License), to remove unsafe HTML;
- {% include link.html url="https://python-pillow.github.io/" label="Pillow" %} (MIT-CMU License), to check and resize images; and
- {% include link.html url="https://pyyaml.org/" label="PyYAML" %} (MIT License), to read the site's settings.

The colors that identify programming languages on the Projects page are GitHub's, from {% include link.html url="https://github.com/github-linguist/linguist" label="GitHub Linguist" %} (MIT License).

## Fonts

**IBM Plex Sans** and **IBM Plex Mono** by IBM, licensed under the SIL Open Font License 1.1. The font files are self-hosted and come from {% include link.html url="https://fontsource.org/" label="Fontsource" %}. The license is included with the fonts in [/assets/fonts/OFL.txt]({{ '/assets/fonts/OFL.txt' | relative_url }}). Upstream project: {% include link.html url="https://github.com/IBM/plex" label="IBM Plex on GitHub" %}.

## Icons

- **Brand icons** come from {% include link.html url="https://simpleicons.org/" label="Simple Icons" %}, released under CC0 1.0 (public domain dedication).
- **The LinkedIn icon** comes from {% include link.html url="https://icons.getbootstrap.com/" label="Bootstrap Icons" %}, MIT License, © The Bootstrap Authors. The license text is included in the icon file.
- **Interface icons** — menu, theme switch, search, arrows, email, the focus-area icons, and the repository, star, fork, license, activity, and heart icons — were drawn for this website.

Brand names and logos are trademarks of their respective owners. They are used only to identify links to those services and do not imply endorsement.

## Images

The site icons and the social preview image were created for this website from the logo mark and the IBM Plex fonts. Images in blog posts belong to the posts' authors.

## External resources

None are loaded while you browse. Every file — fonts, icons, styles, and scripts — is served from this website. There are no content delivery networks, analytics, advertising, or embedded third-party content.{% if form_key != "" %} The contact form sends messages to {% include link.html url=contact_form.service_url label=contact_form.service %} only when you submit it.{% endif %}{% if accounts_on %} The account and author pages connect to Supabase, which provides the accounts.{% endif %}

## Copyright

© {{ site.copyright_start_year }}{% if current_year > site.copyright_start_year %}–{{ current_year }}{% endif %} {{ site.author.name }}. All rights reserved. Unless stated otherwise, the website's text, design, logo, and code are protected by copyright. The third-party materials listed on this page remain the property of their respective owners, and blog posts written by visitors belong to their authors.

## Licensing

- The website's source code and content are not published under an open-source license. Being able to read the code on GitHub does not grant permission to reuse it. The repository's {% include link.html url=license_decision_url label="license decision" %} explains this.
- Third-party components keep their own licenses: IBM Plex (SIL Open Font License 1.1), Simple Icons (CC0 1.0), Bootstrap Icons (MIT), Jekyll (MIT), GitHub Linguist's language colors (MIT), and the workflows' Python packages (MIT, and MIT-CMU for Pillow).
- My other projects on GitHub are licensed individually. Check each repository for its license.
