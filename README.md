# sanskarIN.github.io

Source for https://sanskarIN.github.io — the personal developer website of **Sanskar** (GitHub: [sanskarIN](https://www.github.com/sanskarIN), X: [@SanskarCodes](https://x.com/SanskarCodes), Reddit: [u/sanskarIN](https://reddit.com/user/sanskarIN)).

The website is a static site built with [Jekyll](https://jekyllrb.com/) and published by [GitHub Pages](https://pages.github.com/). There is no backend of its own, no analytics or tracking, and no third-party script: visitors receive plain HTML, one stylesheet, and two small optional scripts, plus a few that load only where they're needed. Blog posts are written with a GitHub issue form and published by a GitHub Actions workflow ([details](#blog)), and the [Projects](#projects) page lists the public GitHub repositories, refreshed daily by another workflow. A [site search](#site-search) runs in the browser. Optional [accounts](#accounts) — sign-in with an emailed code, author profiles, and an editor on the site — use Supabase and stay off until they are set up.

## Contents

- [Pages](#pages)
- [Technology stack](#technology-stack)
- [Directory structure](#directory-structure)
- [Local development](#local-development)
- [Deployment to GitHub Pages](#deployment-to-github-pages)
- [Configuration](#configuration)
- [Projects](#projects)
- [Site search](#site-search)
- [Adding PayPal](#adding-paypal)
- [Contact form](#contact-form)
- [Blog](#blog)
- [Accounts](#accounts)
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
| `/blog/` | `blog/index.html` | Blog: every post, newest first, grouped by year |
| `/blog/tags/` | `blog/tags.html` | Blog posts grouped by tag |
| `/projects/` | `projects/index.html` | Projects: the public GitHub repositories, updated daily ([details](#projects)) |
| `/blog/<post>/` | `_posts/` | One page per blog post ([details](#blog)) |
| `/blog/authors/?u=<username>` | `blog/authors.html` | Author page of a website account (not indexed; [accounts](#accounts)) |
| `/account/` | `account/index.html` | Sign in or sign up, author profile, your posts (not indexed; [accounts](#accounts)) |
| `/account/write/` | `account/write.html` | Post editor for accounts (not indexed; [accounts](#accounts)) |
| `/thank-you/message/` | `thank-you/message.html` | Thank-you page after sending the contact form (not indexed; [details](#thank-you-pages)) |
| `/thank-you/post/` | `thank-you/post.html` | Thank-you page after sending a post from the editor (not indexed) |
| `/thank-you/account-deleted/` | `thank-you/account-deleted.html` | Shown after an account is deleted (not indexed) |
| `/thank-you/support/` | `thank-you/support.html` | Thank-you page for supporters (not indexed) |
| `/contact/sent/` | `contact-sent.html` | The contact form's old confirmation address; forwards to `/thank-you/message/` |
| any missing URL | `404.html` | Page not found |

Generated files: `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, `/.well-known/security.txt`, the blog's Atom feed at `/blog/feed.xml`, `/blog/posts.json` (a list of posts for author pages), and `/search.json` (the [site search](#site-search) index).

URLs end with a slash. GitHub Pages redirects `/about` to `/about/`, so both forms work.

## Technology stack

- **Jekyll 3.10** with **Liquid** templates and **kramdown** Markdown — exactly the versions GitHub Pages runs, pinned locally by the `github-pages` gem.
- **HTML, CSS, and JavaScript** written for this site. No CSS or JavaScript framework.
  - CSS: custom properties (design tokens), mobile-first, split into partials that Jekyll combines into one file.
  - JavaScript: progressive enhancement only — `theme-init.js` (≈0.8 KB) and `main.js` (≈3 KB gzipped). Every page works without it. `search.js` loads the first time search is opened, `projects.js` only on the Projects page, and `account.js` only on the account pages once [accounts](#accounts) are turned on.
- **Fonts:** IBM Plex Sans and IBM Plex Mono, self-hosted WOFF2 (SIL Open Font License 1.1).
- **Icons:** one SVG sprite — brand icons from Simple Icons (CC0), the LinkedIn icon from Bootstrap Icons (MIT), and interface icons drawn for this site.

**Why Jekyll?** GitHub Pages builds it natively, so there is no build pipeline to maintain; the only workflow in the repository is the one that publishes blog posts. Shared layouts and data files mean the header, footer, and every link and email address are defined once. The output is plain static HTML, so navigation never depends on JavaScript.

### Dependencies

| Dependency | Used for | Runs on the live site? |
|---|---|---|
| `github-pages` gem (MIT) | Local builds with the same Jekyll and plugin versions as GitHub Pages | No — build time only |
| Python packages in `.github/scripts/requirements.txt` (MIT; Pillow: MIT-CMU) | Publishing blog posts: Markdown to HTML (markdown-it-py), removing unsafe HTML (nh3), checking and resizing images (Pillow), reading settings (PyYAML) | No — GitHub Actions only |
| GitHub REST and GraphQL APIs | The [Projects](#projects) data: public repositories, languages, pinned repositories, contribution calendar | No — GitHub Actions only; visitors' browsers never contact GitHub for it |
| `actions/checkout`, `actions/setup-python` | The blog workflow; pinned to exact commits | No — GitHub Actions only |
| [Supabase](https://supabase.com/) (optional) | [Accounts](#accounts): sign-in codes, profiles, image uploads, and the `blog` Edge Function | Only on the account and author pages, once accounts are turned on |

Nothing is loaded from a CDN or a third-party domain. The account pages talk to Supabase's API, without a client library.

## Directory structure

```text
.
├── _config.yml               Site identity, URLs, SEO defaults, security policy, build settings
├── _data/                    Content settings — most edits happen here
│   ├── social.yml            Social, professional, and support links (+ the PayPal slot)
│   ├── contact.yml           The three email addresses and what each is for
│   ├── navigation.yml        Header and footer navigation
│   ├── legal.yml             "Last updated" dates of the policy pages
│   ├── blog.yml              Blog settings: review of visitors' posts, image and text limits
│   ├── accounts.yml          Accounts: Supabase address and publishable key (off while empty)
│   ├── projects.yml          Projects page settings: GitHub account, featured and hidden repositories
│   ├── github.json           Projects data, written by the "Update GitHub data" workflow — don't edit
│   ├── theme.yml             Light and dark color palettes
│   ├── focus.yml             Development focus areas (Home + Developer pages)
│   └── technologies.yml      Technologies (Home + Developer pages)
├── _layouts/
│   ├── default.html          Page skeleton: <head>, header, main content, footer
│   ├── page.html             Inner pages: title block + content (+ optional "On this page")
│   ├── legal.html            Policy pages: page layout with table of contents
│   ├── post.html             Blog posts: title, details (dates, author, tags), cover, content
│   └── thanks.html           Thank-you pages: confirmation, next steps, suggestions
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
│   ├── post-card.html        A post in the blog's list
│   ├── post-tags.html        A post's tags, linking to the Tags page
│   ├── tag-id.html           The anchor of a tag on the Tags page
│   ├── repo-card.html        A GitHub repository card (Projects and Home pages)
│   ├── language-bar.html     Languages of the repositories, as a bar and a list
│   ├── language-dot.html     A language's color dot
│   ├── activity-calendar.html  The GitHub contribution calendar
│   ├── number.html           A number with thousands separators (22,928)
│   ├── search-attributes.html  Attributes of buttons that open the site search
│   ├── thanks-available.html  Whether a thank-you page's feature (form, accounts) is on
│   ├── accounts-config.html  Reads _data/accounts.yml for the templates
│   └── css/                  Stylesheet partials (combined into assets/css/main.css)
├── assets/
│   ├── css/main.css          Combines the partials into one stylesheet
│   ├── js/theme-init.js      Runs first: enables JS features, applies a saved theme
│   ├── js/main.js            Theme switch, menu, search keys, copy buttons, post sections
│   ├── js/account.js         Account pages: sign-in, profile, editor, author pages
│   ├── js/projects.js        Projects page: search, filter, and sort the repositories
│   ├── js/search.js          Site search dialog (loaded when first opened)
│   ├── fonts/                IBM Plex WOFF2 files and their license (OFL.txt)
│   ├── icons/sprite.svg      Every icon on the site
│   └── images/
│       ├── brand/            SVG favicon, Apple touch icon, app icons
│       ├── social/           Social preview image (1200 × 630)
│       └── blog/             Images of blog posts, one folder per post (added by the workflow)
├── _posts/                   Blog posts (added by the workflow, or written by hand)
├── blog/                     Blog pages: index.html, tags.html, feed.xml, authors.html, posts.json
├── account/                  Account pages: index.html (sign-in, profile, posts), write.html (editor)
├── projects/index.html       The Projects page
├── thank-you/                Thank-you pages: message, post, account-deleted, support
├── search.json               The site search index
├── supabase/                 Accounts backend: schema.sql and functions/blog/index.ts (not part of the site)
├── .github/
│   ├── ISSUE_TEMPLATE/blog-post.yml       The "Write a blog post" form
│   ├── workflows/publish-blog-post.yml    Publishes posts from the form
│   ├── workflows/update-github-data.yml   Refreshes the Projects data every day
│   ├── scripts/publish_post.py            What the blog workflow runs (+ requirements.txt)
│   └── scripts/update_github_data.py      What the Projects workflow runs
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

The repository is a GitHub Pages *user site*, built by GitHub Pages' built-in Jekyll support. The site itself needs no workflow file; the blog's workflow only adds posts to `main` and then asks GitHub Pages to rebuild ([details](#blog)).

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
| `timezone` | Time zone for dates on the site, such as blog post dates (`UTC`; any IANA name works, e.g. `Europe/London`) |
| `defaults` | Gives blog posts the `post` layout and `/blog/<post>/` addresses |

### Social and professional links — `_data/social.yml`

Every profile link on the site (header, footer, Home, About, Developer, Contact, structured data) comes from this file:

| Service | URL | Username |
|---|---|---|
| GitHub | https://www.github.com/sanskarIN | `sanskarIN` |
| LinkedIn | https://www.linkedin.com/in/sanskarIN | `sanskarIN` |
| Dev.to | https://www.dev.to/sanskarIN | `sanskarIN` |
| Discord (developer channel) | https://discord.com/channels/1547184919455989760/1547187031057113098 | `@dev_sanskarIN` |
| X | https://x.com/SanskarCodes | `@SanskarCodes` |
| Reddit | https://reddit.com/user/sanskarIN | `u/sanskarIN` |
| Instagram | https://www.instagram.com/dev_sanskarIN | `@dev_sanskarIN` |
| Threads | https://threads.com/dev_sanskarIN | `@dev_sanskarIN` |
| Pinterest | https://www.pinterest.com/dev_sanskarIN | `dev_sanskarIN` |
| Bluesky | https://sanskarIN.bsky.social | `@sanskarIN.bsky.social` |
| Buy Me a Coffee | https://www.buymeacoffee.com/sanskarIN | `sanskarIN` |
| Gumroad | https://sanskarIN.gumroad.com | `sanskarIN` |
| PayPal | *not set yet* | — |

- Each entry has a `name`, `url`, `handle`, `username`, `icon`, and a short `note`. A blank `url` hides that profile everywhere.
- `groups` sets the order and grouping in the footer and on the Contact page (Developer, Social, Support & Products); `community` lists the profiles featured on the Home page; `follow` lists the profiles suggested on the [thank-you pages](#thank-you-pages).
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

### Blog settings — `_data/blog.yml`

Whether visitors' posts wait for review (`review_visitor_posts`, on by default), the issue form's file name, and the limits checked when a post is published: image size (10 MB), images per post (20), the longest side an image is scaled down to (2,000 px), and the length of titles, summaries, and tags. The [Blog](#blog) section explains how posting works.

### Projects — `_data/projects.yml`

Which GitHub account's repositories the [Projects](#projects) page shows, which ones to feature or hide, and whether to include forks and archived repositories.

### Accounts — `_data/accounts.yml`

The Supabase project address and publishable key that turn [accounts](#accounts) on, and the name of the service that sends sign-in emails (for the Privacy Policy). While the address or key is empty, everything account-related stays hidden.

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
| `redirect_to` | Sends visitors to another address, for a page that has moved |

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

The policy in `_config.yml` lists each directive on its own line and only allows files from the site itself. When the [contact form](#contact-form) is turned on, its service is added to `connect-src` and `form-action` automatically, and when [accounts](#accounts) are turned on, the Supabase address is added to `connect-src` and `img-src`. If you embed any other third-party content — a video player, analytics, or external images — add that service's origin to the matching directive (for example `frame-src` for embeds, `script-src` for scripts, `img-src` for images), or the browser will block it. Also update the Privacy and Cookie policies ([see below](#legal-pages)).

## Projects

The Projects page at `/projects/` shows the public GitHub repositories of [sanskarIN](https://github.com/sanskarIN), and the Home page's "Open source" section features three of them. Everything on the page comes from GitHub — nothing about the projects is written by hand — and it's refreshed every day.

### How the data is kept up to date

1. The workflow `.github/workflows/update-github-data.yml` runs `.github/scripts/update_github_data.py` every day at 04:23 UTC, whenever `_data/projects.yml` (or the script or workflow) changes, and from **Actions → Update GitHub data → Run workflow**.
2. The script reads public information only, with the workflow's own token (no secrets to set up): the account's public repositories (name, description, website, main language, stars, forks, topics, license, and last push), the languages in each one, the repositories pinned on the profile, and the contribution calendar shown on the profile.
3. It writes `_data/github.json`. If anything changed — apart from the timestamp, and this website's own last push — it commits the file as `sanskarIN <sanskarin@outlook.in>`, pushes it, and asks GitHub Pages to rebuild the site, as the blog workflow does. On days when nothing changed, there's no commit.
4. The site builds the page from that file: totals, featured repositories, a language breakdown, the activity calendar, and the full list, which visitors can search, filter by language, and sort. The choices are kept in the address (for example `/projects/?language=Rust&sort=stars`), so a filtered list can be shared. Without JavaScript, the full list is shown.

Until the workflow has run for the first time, the page links to the GitHub profile instead. The "Projects" links in the header, footer, Home page, and 404 page point to `/projects/` because the page exists (see `_includes/resolve-projects-url.html`).

### Settings — `_data/projects.yml`

| Setting | Effect |
|---|---|
| `github_user` | The account whose public repositories are shown (`sanskarIN`) |
| `featured` | Repositories to feature, in order (up to six). When empty, the repositories pinned on the GitHub profile are featured, or else the ones with the most stars |
| `hidden` | Repositories to leave out. The profile README repository (`sanskarIN/sanskarIN`) is always left out |
| `show_forks` | Include forks of other people's repositories (off) |
| `show_archived` | Include archived repositories, marked "Archived" (on) |

Commit a change and the workflow runs straight away; the page updates a minute or two later. To show a brand-new repository or description before the next daily run, run the workflow from the Actions tab.

### Good to know

- Descriptions, topics, and website links are the ones set on each repository on GitHub — edit them there (the ⚙ next to "About" on the repository page). A website link that points back to GitHub is left out, because every card already links to the repository.
- Language percentages are GitHub's own measurements, and forks aren't counted. The colors are GitHub's language colors.
- The activity calendar shows the same contributions as your GitHub profile. If GitHub's GraphQL API isn't available to the workflow, the page leaves out the calendar and pinned repositories, and features the most-starred repositories instead.
- If a run fails (for example, GitHub is down), the page keeps the previous data, and the run shows as failed in the Actions tab.
- To write the Projects page by hand instead, edit `projects/index.html` (keep `permalink: /projects/` in its front matter). The components are in `_includes/` (`repo-card.html`, `language-bar.html`, `activity-calendar.html`) and their styles in `_includes/css/projects.css`.

## Site search

The search button in the header (or **Ctrl+K**, **⌘K**, or **/**) opens a search of the pages, blog posts, and projects. It runs entirely in the browser: `search.js` is loaded the first time search is opened, and it reads `/search.json`, which Jekyll builds from the pages (except those kept out of search engines), every post (title, summary, tags, and the start of the text), and the repositories in `_data/github.json`. Nothing that's typed is sent anywhere.

Results follow the ARIA combobox pattern — the arrow keys move through them, Enter opens one, Escape closes the dialog — and each result is a real link, so it can be opened in a new tab. The 404 page has a search button too.

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

- **With JavaScript**, the message is sent in the background. Once it's delivered, the thank-you page `/thank-you/message/` opens; if it can't be sent, the problem is shown (and announced to screen readers) next to the button, and the message stays in the form.
- **Without JavaScript**, it is a normal form post; Web3Forms then redirects to `/thank-you/message/` on this site.
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

## Blog

The blog at `/blog/` has no server of its own: posts are written in **GitHub issues**, stored in this repository, and published by a **GitHub Actions** workflow. Anyone with a GitHub account can write one — or, once [accounts](#accounts) are turned on, anyone with an email address, in an editor on the site. Posts from anyone other than you wait for your approval.

### How a post is published

1. A visitor (or you) selects **Write a post** on the blog page. It opens the "Write a blog post" issue form (`.github/ISSUE_TEMPLATE/blog-post.yml`), with fields for the title, summary, tags, a cover image and its description, the post in Markdown, and a confirmation box.
2. Submitting the form opens an issue with the `blog-post` label. The workflow `.github/workflows/publish-blog-post.yml` runs `.github/scripts/publish_post.py`, which:
   - checks the form and, if something needs fixing, says what in a comment on the issue (`needs-changes` label);
   - for your own posts (and collaborators'), publishes straight away; for anyone else's, adds the `awaiting-review` label and waits for you;
   - downloads the images attached to the issue, checks that each is a real PNG, JPEG, GIF, or WebP image of at most 10 MB, turns photos the right way up, scales images larger than 2,000 px down, and saves them without metadata (location, camera details, comments) in `assets/images/blog/<post>/`;
   - converts the Markdown to HTML the same way GitHub previews it, then removes anything unsafe (scripts, styles, forms, embeds, event handlers, `javascript:` links) with an allowlist, and turns images from other websites into links;
   - writes `_posts/<date>-<post>.html`, commits it as `sanskarIN <sanskarin@outlook.in>`, pushes to `main`, and asks GitHub Pages to rebuild the site (pushes made by a workflow don't trigger a build on their own);
   - comments on the issue with the post's address, adds the `published` label, and closes the issue.
3. The post appears at `https://sanskarin.github.io/blog/<post>/` a minute or two later, and in the list, the Tags page, the Atom feed, and the sitemap.

### Reviewing and managing posts

| To… | Do this on the post's issue |
|---|---|
| Publish a visitor's post | Add the `approved` label |
| Decline a visitor's post | Close the issue |
| Change a post | Edit the issue — the post updates. If a visitor edits their published post, the `approved` label is removed and the changes wait for you; the published version stays until you approve again |
| Remove a post | Add the `unpublish` label (remove it again to republish), or delete the issue |

Every run is listed in the **Actions** tab as "Publish blog post"; the rebuild appears as "pages build and deployment". The labels are created automatically the first time the workflow runs, or with **Actions → Publish blog post → Run workflow**.

### What each post shows

The title and summary; the date it was **published** and, after any change, the date it was **last updated**; for posts with three or more headings, an **On this page** list that stays beside the post and marks the section being read (headings get anchors automatically, and a heading never skips a level); copy buttons on code examples; a reading-progress bar along the top; up to three **related posts** that share tags; the author (your name, or the visitor's GitHub username linking to their profile); an estimated reading time; tags; the cover image; links to discuss the post on its GitHub issue and to view its history; a copy-link button; and links to the newer and older posts. Posts are marked up as articles for search engines and link previews (Open Graph, X cards, and `BlogPosting` structured data).

The workflow writes this front matter, which you can also use for posts written by hand:

| Key | Meaning |
|---|---|
| `title`, `description` | Title and summary |
| `date` | When the post was first published (it also starts the file name) |
| `last_modified_at` | When the post last changed (added on updates) |
| `author`, `author_url`, `author_login` | Author's name, link, and GitHub username (default: you and the About page) |
| `author_username` | The username of a website account, for posts written with an [account](#accounts) |
| `image`, `image_alt`, `image_width`, `image_height` | Cover image, its description, and its size |
| `tags` | List of topics |
| `source_issue` | The issue the post comes from; the workflow uses it to find the post again |

### Writing a post by hand

You can also add a Markdown file to `_posts/`, named like `2026-10-01-my-post.md`, with at least `title`, `description`, and `date` in its front matter. It uses the same layout and appears in the list, feed, and sitemap automatically. Leave out `source_issue`: the workflow only manages posts that have one, and it rewrites them whenever their issue is edited — so change those through their issue, not in the file.

### Safety

- Anyone can open an issue, so the workflow treats issues as untrusted data: the text is never placed in a shell command, only GitHub's own image addresses are downloaded, images are fully decoded only once a post is approved, and the HTML is cleaned before it is saved. Braces in posts are written as character references, so Liquid tags in a post are shown as text instead of running.
- The site's Content Security Policy still applies on top: posts can't load scripts or images from other websites.
- The workflow's token can write only to this repository's contents, issues, and Pages builds. The actions it uses are pinned to exact commits, and the Python packages to exact versions — update `.github/scripts/requirements.txt` from time to time (especially Pillow), then publish a test post.

### Limits of this approach

- Without [accounts](#accounts), writing a post needs a GitHub account. Accepting posts from anyone else needs a server holding a secret key, which GitHub Pages can't provide — the accounts feature uses Supabase for that.
- Every post's issue, including its first version, is public on GitHub.
- Removing a post takes it off the website, but earlier versions stay in the repository's Git history.
- Changing the limits in `_data/blog.yml` doesn't change the text of the issue form: update `.github/ISSUE_TEMPLATE/blog-post.yml` too.

## Accounts

Visitors can create an account on the website with only their email address — they get a **6-digit code by email**, with no password — then set up an **author profile** and write posts in an **editor on the site**, with image uploads. Posts written this way go through exactly the same checks, review, and publishing as posts written on GitHub, and the GitHub form stays available.

GitHub Pages can't run a server or keep a secret, so accounts use **[Supabase](https://supabase.com/)** (its free plan is enough): Supabase Auth sends the codes, a Postgres database holds the profiles, Storage holds the images, and an Edge Function holds the GitHub token and turns posts into issues.

**Status: off.** Everything account-related stays hidden — no links, no scripts, no extra security-policy entries — until `_data/accounts.yml` has a Supabase address and publishable key. Follow [Setting up accounts](#setting-up-accounts) to turn them on.

### How accounts work

```text
Account pages (assets/js/account.js, in the browser)
 ├── Supabase Auth ─────── emailed 6-digit code → a session
 ├── Supabase database ─── profiles (public) and submissions (own only)   supabase/schema.sql
 ├── Supabase Storage ──── blog-images/<account id>/…  (public, images only, 10 MB each)
 └── "blog" Edge Function ─ checks the post → GitHub issue (labels blog-post, from-website)
                              │                                supabase/functions/blog/index.ts
                              ▼
     The publishing workflow, as for any post: checks → your review → /blog/<post>/
```

- **Pages:** `/account/` (sign in or sign up, profile, your posts and where each one is, sign out, delete account), `/account/write/` (the editor), and `/blog/authors/?u=<username>` (author pages, shown once the author has a published post). None of them is indexed by search engines.
- **Posts become issues** opened with your GitHub token, starting with a hidden note that names the account. The workflow trusts that note only on issues opened by you, shows the account's display name as the author with a link to its author page, accepts images only from that account's own folder in Storage, and treats the post like any visitor's: it waits for your `approved` label, and every change is reviewed again.
- **Statuses** on the account page come from the issue's labels and the workflow's comments: Being checked, Waiting for review, Needs changes (with the list of problems), Published, Removed, and Declined.
- **Images** are cleaned in the browser before they are uploaded (location, camera details, and comments removed; the picture itself is kept as it is), and copied into this repository when the post is published, like images from GitHub.
- **Deleting an account** (on `/account/`) deletes the account, its profile, and its images, withdraws posts still waiting for review, and — if the person asks — removes their published posts.

### Setting up accounts

Steps 1–6 happen on Supabase and GitHub; only step 7 changes this repository. Nothing secret is ever committed.

1. **Create a project** at https://supabase.com/dashboard (the free plan is enough). Choose a region near your readers.

2. **Create the tables and storage.** Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and run it. It creates the `profiles` and `submissions` tables with row-level security, the public `blog-images` bucket (PNG, JPEG, GIF, and WebP up to 10 MB), and the rules that let each account read and change only its own data. Running it again later is safe.

3. **Set up the sign-in emails.**
   - **Authentication → URL Configuration:** set **Site URL** to `https://sanskarin.github.io`.
   - **Authentication → Sign In / Providers → Email:** keep it enabled, keep **Email OTP Length** at 6, and set **Email OTP Expiration** to something short, such as 600 seconds (10 minutes).
   - **Authentication → Emails → Templates:** in both **Confirm sign up** (sent to new accounts) and **Magic link or OTP** (sent to existing ones), replace the link with the code, for example with the subject "Your sign-in code for sanskarIN.github.io" and this message:

     ```html
     <h2>Your sign-in code</h2>
     <p>Enter this code on sanskarIN.github.io to sign in: <strong>{{ .Token }}</strong></p>
     <p>It works once and expires soon. If you didn't ask for it, you can ignore this email.</p>
     ```

   - **Authentication → Emails → SMTP Settings:** turn on custom SMTP. Without it, Supabase only sends emails to members of your Supabase team (and only 2 an hour), so visitors would never get their codes. Any SMTP service works — for example Brevo's free plan, or a Gmail address with an app password. Then fill in `email_service` and `email_service_privacy_url` in `_data/accounts.yml` (step 7), so the Privacy Policy names it.
   - **Authentication → Rate Limits:** with custom SMTP, Supabase starts at 30 emails an hour; raise it if you need to.

4. **Create a GitHub token for the function.** On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**:
   - **Repository access:** Only select repositories → `sanskarIN/sanskarIN.github.io`;
   - **Permissions:** Repository permissions → **Issues: Read and write** — nothing else;
   - **Expiration:** pick a date and set yourself a reminder. Once the token expires, accounts can't send posts until you create a new one and update the secret in step 5.

   Copy the token. It goes only into Supabase, never into this repository.

5. **Deploy the Edge Function.** In Supabase, open **Edge Functions → Deploy a new function → Via Editor**, name it `blog`, replace the example code with the whole of [`supabase/functions/blog/index.ts`](supabase/functions/blog/index.ts), and deploy it. Then:
   - open **Edge Functions → Secrets** and add `GITHUB_TOKEN` with the token from step 4. Supabase gives the function its own address and keys automatically;
   - leave JWT verification on (the default), so only signed-in people reach the function. The function also checks every request itself; if the project later moves to new JWT signing keys and the function starts answering 401, turning the setting off is safe;
   - optional secrets: `SITE_ORIGIN` (default `https://sanskarin.github.io`), `GITHUB_REPOSITORY` (default `sanskarIN/sanskarIN.github.io`), and `EXTRA_ORIGINS` (other addresses allowed to call the function, comma-separated — for example `http://localhost:4000` while testing locally).

   To update the function later, open it, paste the new code, and select **Deploy updates**.

6. **Copy the two public values** from the project's **Connect** dialog, or **Project Settings → API Keys**: the **project URL** (`https://<project>.supabase.co`) and the **publishable key** (`sb_publishable_…`). Never use the secret key (`sb_secret_…`): it bypasses every security rule. The site refuses to use one anyway.

7. **Turn accounts on.** In `_data/accounts.yml`, fill in `supabase_url`, `supabase_publishable_key`, `email_service`, and `email_service_privacy_url`. In `_data/legal.yml`, update the dates of `terms`, `privacy`, `cookies`, and `accessibility` — those pages gain their account passages automatically. Commit to `main`.

Then try it yourself: sign up on `/account/` with your own email address, create a profile, write a test post with an image, check that its issue appears with the `from-website` label, add `approved`, and watch the account page change to "Published". You can remove the test post and delete the test account on `/account/` afterwards.

### What changes when accounts are on

When `supabase_url` (starting with `https://`) and `supabase_publishable_key` are both set:

- the account, editor, and author pages work; "Write a post" on the blog opens the editor, the GitHub form is offered as an alternative, and the "How posting works" steps describe accounts;
- the footer gets a "Your account" link;
- the Content Security Policy allows the Supabase address in `connect-src` and `img-src`;
- `assets/js/account.js` loads on the account and author pages only;
- the Privacy Policy, Terms, Cookie Policy, Accessibility page, and Credits page describe accounts.

To turn accounts off again, clear `supabase_publishable_key`. Existing posts stay published.

### Managing accounts

| To… | Do this |
|---|---|
| Publish, decline, or remove a post from an account | The same as any post: on its issue, add `approved`, close the issue, or add `unpublish`. Authors can also remove their own posts on `/account/` |
| See accounts and profiles | Supabase → **Authentication → Users**, and **Table Editor → profiles** |
| Change a profile (for example, an offensive display name) | **Table Editor → profiles** |
| Remove an account | Delete the user in **Authentication → Users** — their profile and post records go with it. Their images don't: delete the folder named after their account ID in **Storage → blog-images** |
| Replace the GitHub token | Create a new one (step 4) and update the `GITHUB_TOKEN` secret |

### Limits and costs

- Each account can send 5 new posts a day (the function), upload 200 images (a database rule), and upload images of up to 10 MB each (the bucket). A sign-in code can be requested once a minute per address, and Supabase limits requests per IP address too.
- Uploaded images stay in Storage after their post is published (the website has its own copy); deleting an account deletes its images. Keep an eye on the free plan's storage and bandwidth quotas in the Supabase dashboard.
- Supabase may pause free projects that see little activity. It emails you before it does; while a project is paused, signing in fails with an error message and the GitHub form keeps working. Restore the project from the dashboard.

### Security notes

- The project URL and publishable key are public by design: what they allow is decided by the row-level security rules in `supabase/schema.sql`. The secret key and the GitHub token exist only in Supabase.
- The browser never talks to GitHub: only the function does, with a token that can do nothing but manage this repository's issues.
- The function checks every request itself — a valid session, the person's own profile and images, sizes and limits — and answers only the website's own address (CORS).
- The publishing workflow trusts an account's note only on issues you opened, so nobody can post as an account by copying the note into an issue of their own.
- Profiles and posts are only ever shown as text or as cleaned HTML; author websites must start with `https://` and are marked `nofollow ugc`.

### Files

| File | Purpose |
|---|---|
| `_data/accounts.yml` | Turns accounts on: Supabase address, publishable key, email service |
| `_includes/accounts-config.html` | Reads those settings for the templates and the security policy |
| `account/index.html`, `account/write.html`, `blog/authors.html` | The account, editor, and author pages |
| `blog/posts.json` | The list of posts that author pages read |
| `assets/js/account.js`, `_includes/css/account.css` | Everything the account pages do in the browser, and their styles |
| `supabase/schema.sql` | Tables, storage bucket, and security rules (run in the SQL Editor) |
| `supabase/functions/blog/index.ts` | The Edge Function (pasted into the dashboard editor) |

## Legal pages

The Terms, Privacy, Cookie, and Accessibility pages describe this website as it is actually built: static, no analytics, no cookies, no embedded third-party content, an optional contact form, a blog whose posts are written on GitHub, optional accounts provided by Supabase, and hosted on GitHub Pages (which logs visitors' IP addresses for security, as GitHub documents). They are general-purpose documents, not individualized legal advice.

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
| Accounts | Nothing in the text — the policies update automatically; set the email service in `_data/accounts.yml` and update the dates in `_data/legal.yml` |
| A different form service | `_includes/contact-form.html`, the `form` settings, and the form passages in `privacy.md`, `terms.md`, and `cookies.md` |
| A new linked platform (e.g. PayPal) | the platform lists in `privacy.md` and `terms.md` |
| Changes to how blog posts are accepted, reviewed, or removed | the "Blog posts" sections of `terms.md` and `privacy.md` |
| Anything else stored in the browser | `cookies.md` |

After any change, update the page's date in `_data/legal.yml`.

## Design system

- **Tokens** — `_includes/css/tokens.css`: type scale (fluid `clamp()` sizes), spacing scale, content widths, radius, and motion; colors come from `_data/theme.yml`.
- **Typography** — IBM Plex Sans for text and headings; IBM Plex Mono for labels, handles, and technical details.
- **Layout** — a 72rem container with fluid side gutters; long-form text is limited to about 42rem per line.
- **Projects and search** — `_includes/css/projects.css` (stats, repository cards, language bar, activity calendar, filters) and `_includes/css/search.css` (the search button and dialog).
- **Components** — `_includes/css/components.css`: eyebrow labels, buttons, spec card, feature grid, spec lists and tags, link cards, contact cards, contact form fields, callout, note, table of contents, and prose. Blog components (post list, post details, newer/older links, and styles for post content such as code, tables, and quotes) are in `_includes/css/blog.css`, and the account pages' forms, status messages, and author profiles in `_includes/css/account.css`.
- **Themes** — light and dark palettes, following the device setting until the visitor chooses one with the theme switch.
- **Motion** — small hover transitions, a short fade when the search dialog opens, and smooth page-to-page transitions in browsers that support them (cross-document view transitions); all of it is off when the device asks for reduced motion.

## Accessibility, performance, and security

- **Accessibility:** semantic landmarks, a skip link, one `<h1>` per page with ordered headings, visible focus outlines, WCAG AA text contrast in both themes, labelled controls that announce their state, reduced-motion support, and navigation that works without JavaScript. See the [Accessibility page](https://sanskarin.github.io/accessibility/).
- **Performance:** one stylesheet (≈7 KB gzipped), about 2.5 KB of optional JavaScript, about 75 KB of self-hosted fonts (Latin subset; the main font is preloaded), inline SVG icons, and no third-party requests (apart from Supabase on the account and author pages, once accounts are on). CSS, JavaScript, and icon URLs carry a build-time `?v=` parameter because GitHub Pages lets browsers cache files for 10 minutes.
- **Security:** a Content Security Policy that allows only same-origin resources, no inline scripts or styles, no secrets in the repository, `rel="noopener noreferrer"` on external links, `/.well-known/security.txt`, a blog workflow that treats issues as untrusted input ([details](#safety)), accounts protected by row-level security ([details](#security-notes)), and a [security policy](SECURITY.md).

## Copyright and licensing

© 2026 Sanskar. All rights reserved.

No open-source license has been chosen for this repository, so its content and code are not licensed for reuse — see [LICENSE_DECISION.md](LICENSE_DECISION.md). Blog posts written by visitors belong to their authors, who give permission to publish them here (see the Terms). Third-party assets keep their own licenses: IBM Plex fonts (SIL Open Font License 1.1, [`assets/fonts/OFL.txt`](assets/fonts/OFL.txt)), Simple Icons (CC0 1.0), and Bootstrap Icons (MIT, license text in [`assets/icons/sprite.svg`](assets/icons/sprite.svg)). The [Credits page](https://sanskarin.github.io/credits/) lists them.
