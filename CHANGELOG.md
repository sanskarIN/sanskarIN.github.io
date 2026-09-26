# Changelog

Notable changes to this website are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.2.0] — 2026-09-26

### Added

- Blog at `/blog/`: every post, newest first and grouped by year, with its cover image, summary, published and updated dates, author, reading time, and tags; a Tags page at `/blog/tags/`; and an Atom feed at `/blog/feed.xml`.
- Post pages with an "About this post" panel (published and last-updated dates, author, reading time, tags), links to discuss the post on GitHub and to view its history, a copy-link button, and links to the newer and older posts. Posts are marked up as articles (Open Graph, X cards, and `BlogPosting` structured data) and listed in the sitemap with the date they last changed.
- "Write a blog post" issue form and a GitHub Actions workflow that publishes posts: it checks the form, copies attached images (PNG, JPEG, GIF, or WebP, up to 10 MB each) without their metadata, converts the Markdown to safe HTML, commits the post, and asks GitHub Pages to rebuild. Posts from visitors wait for the owner's approval; the `unpublish` label removes a post.
- Blog settings in `_data/blog.yml`, and "Blog" in the main navigation.
- Icons for writing, tags, the feed, links, history, and discussion.

### Changed

- The Terms, Privacy Policy, Accessibility page, and Credits page describe the blog: permission to publish, content rules, review and removal, what becomes public, and the packages the workflow uses.
- Dates are shown in UTC (`timezone` in `_config.yml`).
- Structured data escapes `</`, so text from a post can never end its script element.
- SECURITY.md and CONTRIBUTING.md cover the blog workflow.

## [1.1.1] — 2026-09-26

### Changed

- Turned on the contact form: the Web3Forms access key is set, the Contact page shows "Send a message", and the Privacy Policy, Terms, Cookie Policy, Accessibility, and Credits pages now describe the form.
- Updated the contact form setup notes for the Web3Forms dashboard.

## [1.1.0] — 2026-09-26

### Added

- Optional contact form on the Contact page, delivered by Web3Forms. It stays hidden until an access key is set in `_data/contact.yml`, works with and without JavaScript, uses a hidden spam trap instead of a captcha, and has a confirmation page at `/contact/sent/`.
- Policy text for the contact form (Privacy Policy, Terms, Cookie Policy, Accessibility, Credits) that appears automatically once the form is turned on.
- Input border color token (`border-input`) that meets 3:1 contrast in both themes.

### Changed

- The Content Security Policy in `_config.yml` is now listed one directive per line; the contact form service is added to it automatically when the form is on.
- Contact page: the "never send secrets" advice now covers any message, not only email.

## [1.0.0] — 2026-09-26

Initial foundation of the website.

### Added

- Pages: Home, About, Developer, Contact, Terms and Conditions, Privacy Policy, Cookie Policy, Accessibility, Credits, and a 404 page.
- Shared header with an accessible mobile menu and a light/dark theme switch, and a shared footer with navigation, policy links, profiles, and email addresses.
- Central configuration in `_data/` for social links, email addresses, navigation, theme colors, focus areas, technologies, and policy dates — including a reserved, disabled slot for a future PayPal link.
- "Projects" links that point to the GitHub profile until a Projects page exists at `/projects/`, then switch to it automatically.
- Design system: CSS design tokens, light and dark palettes that meet WCAG AA contrast, reusable components, and self-hosted IBM Plex fonts.
- SEO: unique titles and descriptions, canonical URLs, Open Graph and X card metadata, JSON-LD structured data, `sitemap.xml`, and `robots.txt`.
- Brand assets: logo mark, favicons, app icons, a web app manifest, and a social preview image.
- Security: a Content Security Policy limited to same-origin resources and `/.well-known/security.txt`.
- Documentation: README, CONTRIBUTING, SECURITY, LICENSE_DECISION, and this changelog.
