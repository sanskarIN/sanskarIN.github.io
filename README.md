# sanskarIN.github.io

Source for https://sanskarIN.github.io — the personal developer website of **Sanskar** (GitHub: [sanskarIN](https://www.github.com/sanskarIN), developer community: [@dev_sanskarIN](https://www.x.com/dev_sanskarIN)).

The website is a static site built with [Jekyll](https://jekyllrb.com/) and published by [GitHub Pages](https://pages.github.com/). There is no backend, database, analytics, tracking, or third-party script: visitors receive plain HTML, one stylesheet, and two small optional scripts.

## Contents

- [Pages](#pages)
- [Technology stack](#technology-stack)
- [Directory structure](#directory-structure)
- [Local development](#local-development)
- [Deployment to GitHub Pages](#deployment-to-github-pages)
- [Configuration](#configuration)
- [Adding the Projects page](#adding-the-projects-page)
- [Adding PayPal](#adding-paypal)
- [Contact form](#contact-form)
- [Legal pages](#legal-pages)
- [Design system](#design-system)
- [Accessibility, performance, and security](#accessibility-performance-and-security)
- [Copyright and licensing](#copyright-and-licensing)

## Pages

| URL | Source file | Page |
|---|---|---|
| `/` | `index.html` | Home |
| `/about/` | `about.html` | About |
| `/developer/` | `developer.html` | Developer profile |
| `/contact/` | `contact.html` | Contact |
| `/terms/` | `terms.md` | Terms and Conditions |
| `/privacy/` | `privacy.md` | Privacy Policy |
| `/cookies/` | `cookies.md` | Cookie Policy |
| `/accessibility/` | `accessibility.md` | Accessibility |
| `/credits/` | `credits.md` | Credits and website information |
| `/contact/sent/` | `contact-sent.html` | Contact form confirmation (not indexed; shown after sending without JavaScript) |
| any missing URL | `404.html` | Page not found |
| `/projects/` | — | Reserved for the Projects page, added manually later ([details](#adding-the-projects-page)) |

Generated files: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, and `/.well-known/security.txt`.

URLs end with a slash. GitHub Pages redirects `/about` to `/about/`, so both forms work.

## Technology stack

- **Jekyll 3.10** with **Liquid** templates and **kramdown** Markdown — exactly the versions GitHub Pages runs, pinned locally by the `github-pages` gem.
- **HTML, CSS, and JavaScript** written for this site. No CSS or JavaScript framework.
  - CSS: custom properties (design tokens), mobile-first, split into partials that Jekyll combines into one file.
  - JavaScript: progressive enhancement only — `theme-init.js` (≈0.8 KB) and `main.js` (≈1.6 KB gzipped). Every page works without it.
- **Fonts:** IBM Plex Sans and IBM Plex Mono, self-hosted WOFF2 (SIL Open Font License 1.1).
- **Icons:** one SVG sprite — brand icons from Simple Icons (CC0), the LinkedIn icon from Bootstrap Icons (MIT), and interface icons drawn for this site.

**Why Jekyll?** GitHub Pages builds it natively, so there is no build pipeline or workflow to maintain. Shared layouts and data files mean the header, footer, and every link and email address are defined once. The output is plain static HTML, so navigation never depends on JavaScript.

### Dependencies

| Dependency | Used for | Runs on the live site? |
|---|---|---|
| `github-pages` gem (MIT) | Local builds with the same Jekyll and plugin versions as GitHub Pages | No — build time only |

That is the only dependency. Nothing is loaded from a CDN or a third-party domain.

## Directory structure

```text
.
├── _config.yml               Site identity, URLs, SEO defaults, security policy, build settings
├── _data/                    Content settings — most edits happen here
│   ├── social.yml            Social, professional, and support links (+ the PayPal slot)
│   ├── contact.yml           The three email addresses and what each is for
│   ├── navigation.yml        Header and footer navigation
│   ├── legal.yml             "Last updated" dates of the policy pages
│   ├── theme.yml             Light and dark color palettes
│   ├── focus.yml             Development focus areas (Home + Developer pages)
│   └── technologies.yml      Technologies (Home + Developer pages)
├── _layouts/
│   ├── default.html          Page skeleton: <head>, header, main content, footer
│   ├── page.html             Inner pages: title block + content (+ optional "On this page")
│   └── legal.html            Policy pages: page layout with table of contents
├── _includes/
│   ├── head.html             Meta tags, security policy, stylesheet, scripts, icons
│   ├── seo.html              Title, description, canonical URL, Open Graph, X cards
│   ├── structured-data.html  JSON-LD (Person, WebSite, WebPage)
│   ├── header.html           Site header with navigation, menu button, theme switch
│   ├── footer.html           Site footer
│   ├── link.html             Link helper: internal / external / Projects link rules
│   ├── resolve-projects-url.html  Decides where "Projects" links point
│   ├── profile-list.html     Lists of profile links (cards or compact list)
│   ├── contact-card.html     Email address cards
│   ├── contact-form.html     Contact form (shown once it is turned on)
│   ├── email-link.html       A single mailto: link
│   ├── icon.html             A single icon from the sprite
│   ├── brand-mark.html       The "S" logo mark
│   ├── page-header.html      Title block of inner pages
│   ├── tech-list.html        Technologies list
│   ├── toc.html              "On this page" navigation
│   └── css/                  Stylesheet partials (combined into assets/css/main.css)
├── assets/
│   ├── css/main.css          Combines the partials into one stylesheet
│   ├── js/theme-init.js      Runs first: enables JS features, applies a saved theme
│   ├── js/main.js            Theme switch, mobile menu, copy buttons
│   ├── fonts/                IBM Plex WOFF2 files and their license (OFL.txt)
│   ├── icons/sprite.svg      Every icon on the site
│   └── images/
│       ├── brand/            SVG favicon, Apple touch icon, app icons
│       └── social/           Social preview image (1200 × 630)
├── .well-known/security.txt  Security contact (RFC 9116)
├── index.html  about.html  developer.html  contact.html  contact-sent.html  404.html
├── terms.md  privacy.md  cookies.md  accessibility.md  credits.md
├── sitemap.xml  robots.txt  manifest.webmanifest  favicon.ico
├── Gemfile                   Local development dependencies
└── README.md  CONTRIBUTING.md  SECURITY.md  LICENSE_DECISION.md  CHANGELOG.md
```

## Local development

You need **Ruby** (3.3 recommended — the version GitHub Pages uses) and **Bundler**. GitHub's guide to [testing a GitHub Pages site locally](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll) covers installing them.

```bash
git clone https://github.com/sanskarIN/sanskarIN.github.io.git
cd sanskarIN.github.io
bundle install
bundle exec jekyll serve
```

Open http://localhost:4000. Changes to pages, includes, styles, and `_data/` rebuild automatically; restart the server after editing `_config.yml`.

| Task | Command |
|---|---|
| Develop with automatic rebuilds | `bundle exec jekyll serve` |
| Develop with browser live reload | `bundle exec jekyll serve --livereload` |
| Build into `_site/` | `bundle exec jekyll build` |
| Build exactly like production | `JEKYLL_ENV=production bundle exec jekyll build` |
| Preview a production build | `JEKYLL_ENV=production bundle exec jekyll serve` |

Notes:

- Templates run with Liquid's strict mode, so a typo in a template stops the build with an error message instead of silently producing a broken page.
- During `--livereload` sessions the Content Security Policy tag is left out, because live reload injects an inline script that the policy would block. Everywhere else, including production, the policy is active.
- Messages such as "GitHub Metadata: No GitHub API authentication could be found" or a Faraday retry notice come from GitHub Pages' default plugins and are harmless.
- `Gemfile.lock` is intentionally not committed: GitHub Pages ignores it, and the `github-pages` gem already pins every version.

## Deployment to GitHub Pages

The repository is a GitHub Pages *user site*, built by GitHub Pages' built-in Jekyll support. No workflow file is required.

One-time setup:

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to **`main`** and the folder to **`/ (root)`**, then **Save**.

From then on, every push to `main` rebuilds and publishes https://sanskarIN.github.io, usually within a minute or two. Progress appears in the **Actions** tab as "pages build and deployment". GitHub builds into its own `_site/` directory; the local `_site/` folder is ignored by Git.

The site is served over HTTPS automatically. GitHub Pages does not allow custom HTTP headers, which is why the security policy is delivered as a `<meta>` tag.

## Configuration

Most changes need no template edits. After editing, commit to `main` (or preview locally first).

### Site settings — `_config.yml`

| Setting | Purpose |
|---|---|
| `title`, `tagline`, `description` | Site name, short tagline, default meta description |
| `author.username`, `author.community_username` | `sanskarIN` and `dev_sanskarIN` |
| `url`, `display_url` | Canonical address (lowercase, as browsers normalize it) and the way it is written in visible text |
| `repository_url` | Used on the Developer and Credits pages and in `security.txt` |
| `projects_url` | Address of the future Projects page |
| `social_image` | Social preview image path, size, and alt text |
| `copyright_start_year` | First year in the copyright notice |
| `content_security_policy` | Allowed sources for scripts, styles, fonts, and more (one entry per directive) |

### Social and professional links — `_data/social.yml`

Every profile link on the site (header, footer, Home, About, Developer, Contact, structured data) comes from this file:

| Service | URL | Username |
|---|---|---|
| GitHub | https://www.github.com/sanskarIN | `sanskarIN` |
| LinkedIn | https://www.linkedin.com/in/sanskarIN | `sanskarIN` |
| Dev.to | https://www.dev.to/sanskarIN | `sanskarIN` |
| Discord (developer channel) | https://discord.com/channels/1547184919455989760/1547187031057113098 | `@dev_sanskarIN` |
| X | https://www.x.com/dev_sanskarIN | `@dev_sanskarIN` |
| Instagram | https://www.instagram.com/dev_sanskarIN | `@dev_sanskarIN` |
| Threads | https://threads.com/dev_sanskarIN | `@dev_sanskarIN` |
| Pinterest | https://www.pinterest.com/dev_sanskarIN | `dev_sanskarIN` |
| Bluesky | https://sanskarIN.bsky.social | `@sanskarIN.bsky.social` |
| Buy Me a Coffee | https://www.buymeacoffee.com/sanskarIN | `sanskarIN` |
| Gumroad | https://sanskarIN.gumroad.com | `sanskarIN` |
| PayPal | *not set yet* | — |

- Each entry has a `name`, `url`, `handle`, `username`, `icon`, and a short `note`. A blank `url` hides that profile everywhere.
- `groups` sets the order and grouping in the footer and on the Contact page (Developer, Social, Support & Products); `community` lists the profiles featured on the Home page.
- To add a service: add an entry, add its icon to `assets/icons/sprite.svg`, and add its key to a group.
- External links open in a new tab with `rel="noopener noreferrer"` and tell screen-reader users so; the templates handle this.
- The Discord link opens a channel inside a server, so it works for members of that server. An invite link (`discord.gg/…`) would also work for non-members, if you prefer one.

### Email addresses — `_data/contact.yml`

Each address is written exactly once, under `email:`. Every other place refers to it by key, e.g. `{% include email-link.html key="support" %}`.

| Key | Address | Used for |
|---|---|---|
| `business_primary` | sanskarin@outlook.in | Business contact; general and legal contact on the policy pages |
| `business_secondary` | sanskarin.business@gmail.com | Business contact |
| `support` | supportramsandesh@gmail.com | Support, accessibility feedback, security reports, `security.txt` |

`groups` describes the Business and Support groups shown on the Home and Contact pages and in the footer (title, summary, purposes, and which addresses belong to each). `form` holds the optional [contact form](#contact-form) settings.

### Navigation — `_data/navigation.yml`

`main` is the header navigation (also the footer's Navigation group); `legal` and `information` are footer groups.

### Theme colors — `_data/theme.yml`

The light and dark palettes. Each value becomes a CSS custom property (`bg` → `--color-bg`), and `bg` also sets the browser UI color and the web app manifest colors. All text colors currently meet WCAG AA contrast (4.5:1) in both themes — check contrast again after changing them.

### Policy dates — `_data/legal.yml`

The "Last updated" date of each policy page. Update the date whenever you change that page. The date also appears in structured data and the sitemap.

### Page settings (front matter)

| Key | Effect |
|---|---|
| `title` | Page title, used in the browser tab, search results, and `<h1>` |
| `description` | Meta description and social preview text |
| `seo_title` | Replaces the whole `<title>` (used on Home) |
| `heading`, `eyebrow`, `lead` | `<h1>` text (if different from `title`), the label above it, and the intro paragraph |
| `toc: true` | Adds an "On this page" list built from the page's `<h2>` headings |
| `prose` | Long-form text styling (on by default for Markdown pages) |
| `schema_type` | Structured data type, e.g. `ProfilePage`, `ContactPage` (default `WebPage`) |
| `noindex: true` | Keeps the page out of search results |
| `sitemap: false` | Leaves the page out of `sitemap.xml` |

### Branding assets

| File | Size | Purpose |
|---|---|---|
| `_includes/brand-mark.html` | vector | Logo in the header and footer (inline SVG; follows the theme colors) |
| `assets/images/brand/favicon.svg` | vector | Browser tab icon |
| `favicon.ico` | 16, 32, 48 px | Tab icon for older browsers |
| `assets/images/brand/apple-touch-icon.png` | 180 × 180 | iPhone and iPad home screen |
| `assets/images/brand/icon-192.png`, `icon-512.png` | 192, 512 | Web app manifest |
| `assets/images/brand/icon-maskable-512.png` | 512 × 512 | Android adaptive icon (logo inside the safe zone) |
| `assets/images/social/og-default.png` | 1200 × 630 | Social preview image (Open Graph and X cards) |

The current logo is a simple "S" mark designed for this site. To use your own artwork, replace these files with the same names and sizes. To use a different social preview image, replace `og-default.png` or change `social_image` in `_config.yml`, including its `alt` text.

### Content Security Policy

The policy in `_config.yml` lists each directive on its own line and only allows files from the site itself. When the [contact form](#contact-form) is turned on, its service is added to `connect-src` and `form-action` automatically. If you embed any other third-party content — a video player, analytics, or external images — add that service's origin to the matching directive (for example `frame-src` for embeds, `script-src` for scripts, `img-src` for images), or the browser will block it. Also update the Privacy and Cookie policies ([see below](#legal-pages)).

## Adding the Projects page

The Projects page is intentionally not included in the initial website generation. It will be created manually later under `/projects/` and should reuse the existing site's design system, navigation, footer, typography, spacing, cards, buttons, and components.

**How the "Projects" links behave until then.** The header, footer, the Home page's "View Projects" button, and the 404 page all link to Projects. While no page exists at `/projects/`, these links point to the GitHub profile (opening in a new tab), so no visitor lands on a 404. As soon as the page exists, every Projects link switches to `/projects/` on the next build — there is no setting to change. The new page is also added to `sitemap.xml` automatically.

**Creating the page on GitHub.com:** choose **Add file → Create new file**, name it `projects/index.html` (or `projects/index.md` to write in Markdown), and start it with this front matter:

```yaml
---
layout: page
title: Projects
eyebrow: Projects
lead: One sentence that introduces your projects.
description: A short summary for search results and social previews.
permalink: /projects/
---
```

Then write the content below the front matter. The `page` layout supplies the header, footer, title block, spacing, and fonts. Keep the front matter: without it, Jekyll publishes the file as-is, without the site's header, footer, or styles, and leaves it out of the sitemap. These existing components are available (styles in `_includes/css/`):

| Component | Classes |
|---|---|
| Card grid | `ul.link-grid` containing `a.link-card` with `.link-card__body`, `.link-card__name`, `.link-card__handle`, `.link-card__note` |
| Bordered feature cells | `ul.feature-grid` (add `.feature-grid--4` for four columns) containing `li.feature` with `.feature__title` and `.feature__text` |
| Technology labels | `ul.tag-list` containing `li.tag` |
| Buttons | `.button-row` containing `a.button` plus `.button--primary`, `.button--secondary`, or `.button--ghost` |
| Sections | `section.page-section` (spaced, with a divider); `.prose` for long-form text |
| Icons and links | `{% include icon.html name="github" %}` · `{% include link.html url="…" label="…" class="button button--secondary" arrow=true %}` |

A starting skeleton for a card (replace the placeholder text):

```html
<ul class="link-grid" role="list">
  <li>
    <a class="link-card" href="/projects/project-slug/">
      <span class="link-card__body">
        <span class="link-card__name">Project name</span>
        <span class="link-card__note">One-line description of the project.</span>
      </span>
    </a>
  </li>
</ul>
```

**Individual project pages** can be added later without redesigning anything:

- **A few projects:** create one file per project, e.g. `projects/project-slug/index.md`, with `layout: page` and `permalink: /projects/project-slug/`.
- **Many projects:** use a Jekyll collection. Add this to `_config.yml`:

  ```yaml
  collections:
    projects:
      output: true
      permalink: /projects/:name/
  ```

  Then add one Markdown file per project in a `_projects/` folder (for example `_projects/project-slug.md` with `layout: page`, `title`, `description`, and any fields you like, such as `repository` or `tags`), and list them on the Projects page with `{% for project in site.projects %}…{% endfor %}`. Collection pages are included in the sitemap automatically.

## Adding PayPal

PayPal has intentionally not been added yet. When the final PayPal URL is available, add it to the centralized contact/social configuration and enable the corresponding interface link:

1. Open `_data/social.yml` and find the `paypal` entry (search for `PAYPAL_URL`).
2. Paste the real link between the quotes: `url: "…"`.
3. Commit the change.

That single edit enables the PayPal link in the footer's Support & Products group, on the Contact page, and in the Home page's support section, with the PayPal icon (already in the sprite). The link is deliberately left out of structured data (`same_as: false`), because a payment link is not a profile.

Then keep the policies accurate: add PayPal to the lists of third-party services in `privacy.md` and `terms.md`, and update their dates in `_data/legal.yml`.

## Contact form

GitHub Pages only serves static files, so it cannot send email by itself. The website therefore includes a contact form that is delivered by **[Web3Forms](https://web3forms.com/)**, a form-to-email service. The form is shown only while an access key is set in `_data/contact.yml`, so the site never shows a form that cannot send.

**Status: on.** The access key is set, and messages go to the address of the Web3Forms account that owns the form. Settings such as the receiving address are managed in the [Web3Forms dashboard](https://app.web3forms.com/).

**Setting or replacing the access key:**

1. Sign in at https://app.web3forms.com with the email address that should receive the messages, and create a form — for example, name `sanskarIN.github.io contact form` and website `sanskarin.github.io/contact`.
2. Copy its **Form Access Key**, open `_data/contact.yml`, find the `form` block (search for `FORM_ACCESS_KEY`), and paste the key between the quotes of `access_key`.
3. Update the `privacy`, `terms`, and `cookies` dates in `_data/legal.yml`, then commit.

While a key is set, the following happens automatically on every build:

- a "Send a message" section appears on the Contact page, and the "no contact form" note changes;
- the Content Security Policy allows `https://api.web3forms.com` in `connect-src` and `form-action`;
- the Privacy Policy, Terms, Cookie Policy, Accessibility page, and Credits page describe the form.

**How it works:**

- **With JavaScript**, the message is sent in the background; the visitor stays on the page and the result is shown (and announced to screen readers) next to the button.
- **Without JavaScript**, it is a normal form post; Web3Forms then redirects to `/contact/sent/` on this site.
- **Spam protection:** a hidden `botcheck` field that people never see; bots that fill it in are rejected by Web3Forms. No captcha script is loaded, so the site stays free of third-party scripts and cookies.
- **Fields:** name, email (used as the reply address), topic, and message. The topics, email subject, and service details are set in the same `form` block.
- **No secrets:** the access key is public by design — it only lets people send messages to your address — so it is safe to keep in the repository. It is not a password.
- **Privacy:** per its documentation, Web3Forms does not store form submissions; it forwards them to your email.

To turn the form off, clear the `access_key` (and update the policy dates); the Contact page and policies switch back automatically on the next build.

**Other ways to receive messages**, if you prefer a different approach:

| Option | How it works | Trade-offs |
|---|---|---|
| Email links only | What the site does while the form is off | Nothing third-party is involved; visitors need an email app |
| [Formspree](https://formspree.io/) | Hosted form backend with a dashboard | Free plan is meant for testing; a custom thank-you page and higher limits need a paid plan |
| Google Forms or Tally | Link to a form hosted on their site | No code, but visitors leave the site; embedding one would add third-party scripts and cookies |
| Serverless function | e.g. a Cloudflare Worker that sends mail through an email API | Most control, but the API key must be stored as a secret outside this repository, and it needs maintenance |
| Netlify Forms | Built into Netlify hosting | Requires moving the site from GitHub Pages to Netlify |

Switching to another form service means changing the form markup in `_includes/contact-form.html` (field names differ between services), the `endpoint` in `_data/contact.yml`, and the service descriptions in the policy pages.

## Legal pages

The Terms, Privacy, Cookie, and Accessibility pages describe this website as it is actually built: static, no analytics, no cookies, no forms, no embedded third-party content, and hosted on GitHub Pages (which logs visitors' IP addresses for security, as GitHub documents). They are general-purpose documents, not individualized legal advice.

Details that were not provided are intentionally left out, and may need adding later:

- a legal name (the pages refer to "Sanskar");
- a legal entity, company name, or registration number;
- a postal address;
- the jurisdiction and governing law;
- effective dates beyond the "Last updated" dates in `_data/legal.yml`.

If you add any of these — or start selling products or services directly through the website, or collecting personal data — consider having the pages reviewed by a qualified professional.

Keep the policies in step with the website:

| If you add… | Update |
|---|---|
| Analytics | `privacy.md` (Analytics, Third-party services), `cookies.md` (Analytics cookies, Future services), the CSP; ask for consent where the law requires it |
| Embedded content (videos, posts, maps) | `privacy.md`, `cookies.md`, the CSP |
| The built-in contact form | Nothing in the text — the policies update automatically; just update the dates in `_data/legal.yml` |
| A different form service | `_includes/contact-form.html`, the `form` settings, and the form passages in `privacy.md`, `terms.md`, and `cookies.md` |
| A new linked platform (e.g. PayPal) | the platform lists in `privacy.md` and `terms.md` |
| Anything else stored in the browser | `cookies.md` |

After any change, update the page's date in `_data/legal.yml`.

## Design system

- **Tokens** — `_includes/css/tokens.css`: type scale (fluid `clamp()` sizes), spacing scale, content widths, radius, and motion; colors come from `_data/theme.yml`.
- **Typography** — IBM Plex Sans for text and headings; IBM Plex Mono for labels, handles, and technical details.
- **Layout** — a 72rem container with fluid side gutters; long-form text is limited to about 42rem per line.
- **Components** — `_includes/css/components.css`: eyebrow labels, buttons, spec card, feature grid, spec lists and tags, link cards, contact cards, contact form fields, callout, note, table of contents, and prose.
- **Themes** — light and dark palettes, following the device setting until the visitor chooses one with the theme switch.
- **Motion** — only small hover transitions, all disabled when the device asks for reduced motion.

## Accessibility, performance, and security

- **Accessibility:** semantic landmarks, a skip link, one `<h1>` per page with ordered headings, visible focus outlines, WCAG AA text contrast in both themes, labelled controls that announce their state, reduced-motion support, and navigation that works without JavaScript. See the [Accessibility page](https://sanskarin.github.io/accessibility/).
- **Performance:** one stylesheet (≈7 KB gzipped), about 2.5 KB of optional JavaScript, about 75 KB of self-hosted fonts (Latin subset; the main font is preloaded), inline SVG icons, and no third-party requests. CSS, JavaScript, and icon URLs carry a build-time `?v=` parameter because GitHub Pages lets browsers cache files for 10 minutes.
- **Security:** a Content Security Policy that allows only same-origin resources, no inline scripts or styles, no secrets in the repository, `rel="noopener noreferrer"` on external links, `/.well-known/security.txt`, and a [security policy](SECURITY.md).

## Copyright and licensing

© 2026 Sanskar. All rights reserved.

No open-source license has been chosen for this repository, so its content and code are not licensed for reuse — see [LICENSE_DECISION.md](LICENSE_DECISION.md). Third-party assets keep their own licenses: IBM Plex fonts (SIL Open Font License 1.1, [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)), Simple Icons (CC0 1.0), and Bootstrap Icons (MIT, license text in [`assets/icons/sprite.svg`](assets/icons/sprite.svg)). The [Credits page](https://sanskarin.github.io/credits/) lists them.
