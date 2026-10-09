# Changelog

Notable changes to this website are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.8.1] — 2026-10-09

### Changed

- LinkedIn is now [SanskarCodes](https://linkedin.com/in/SanskarCodes), Dev.to is [SanskarCodes](https://dev.to/SanskarCodes), and Bluesky is [@SanskarCodes.bsky.social](https://bsky.app/profile/SanskarCodes.bsky.social). The About page lists them with Discord and X under SanskarCodes.
- The Privacy Policy and Terms list the linked platforms without Pinterest.

### Removed

- The Pinterest profile, its links, and its icon.

## [1.8.0] — 2026-10-09

### Added

- Your own account on the website: the username `sanskar` (and `sanskarin` and `dev-sanskarin`) is kept for the site admin, the account whose email address is the new `ADMIN_EMAIL` secret of the "Set up accounts" workflow. The database checks it, with the address kept in a private `site_admins` table that the website and the API can't read.
- `owner_username` in `_data/accounts.yml`. Every post by the site owner — from GitHub, by hand, or from the owner's account — is credited to that username: author links open its author page, which lists all of them, even before the profile exists.
- The owner's account page lists the owner's posts written on GitHub as well, with their status, **Edit on GitHub**, and **Remove**.
- Posts the owner writes on the website are published at once and credited like the owner's posts from GitHub, without the review that visitors' posts wait for.

### Changed

- The "Set up accounts" workflow saves `ADMIN_EMAIL` in the database and gives the Edge Function the owner's username.

## [1.7.0] — 2026-10-09

### Added

- The "Set up accounts" workflow (`.github/workflows/setup-accounts.yml` and `.github/scripts/setup_accounts.py`), which makes sign-up and sign-in work from a single run. With a Supabase project and a few repository secrets, it runs `supabase/schema.sql`, sets up the sign-in emails (6-digit codes that work for 10 minutes, the email templates, and the SMTP service that sends them), saves the Edge Function's GitHub token and deploys the function, checks that sign-in, the database, and the function answer, and only then turns accounts on: it fills in `_data/accounts.yml`, updates the policy dates, and asks GitHub Pages to rebuild the site.
- Gmail (with an app password) and Brevo are recognised from the SMTP login, with their privacy policies; any other SMTP service can be named in the settings.
- The workflow checks the GitHub token without opening an issue and warns two weeks before it expires, waits for a project that is starting, and explains how to fix a paused project, a wrong token, or missing settings. It runs again whenever `supabase/` changes on `main`, so the database and the function keep up with the repository.

### Changed

- README.md → "Setting up accounts" now starts with the workflow; the steps in the Supabase dashboard are kept under "Setting up accounts by hand". The sign-in email says the code expires in 10 minutes.
- The notes in `_data/accounts.yml`, `supabase/schema.sql`, and the Edge Function mention the workflow.

## [1.6.0] — 2026-10-06

### Added

- A terminal on the Home page: with JavaScript, the profile card becomes a small terminal for exploring the website. Commands include `help`, `whoami`, `projects`, `blog`, `stack`, `focus`, `socials`, `contact`, `support`, `ls`, `cd`, `open`, `search`, `theme`, `history`, and `clear`, plus a few hidden ones; buttons under the prompt run the main commands. Its data comes from `/terminal.json`, built from `_data/` and the posts. It works with the keyboard and screen readers, and without JavaScript the card stays as it was.
- A soft spotlight that follows the mouse across cards, for mouse and trackpad users who haven't asked for reduced motion.
- TypeScript: the website's scripts are now written in TypeScript in `src/ts/`, with strict type checks, and compiled to `assets/js/` (`npm run build`). The new "TypeScript" workflow checks the types and that the compiled files are up to date.
- `window.siteActions` (theme and search) for scripts that build on the page, and a starting query for the site search.

### Changed

- Instagram and Threads are now [@SanskarCode](https://instagram.com/SanskarCode), and Discord is @SanskarCodes. The community username shown in the footer and on the Home page is now @SanskarCodes.
- The About page groups usernames shared by several services, such as Instagram and Threads.
- The Privacy Policy, Terms, Cookie Policy, Accessibility page, and Credits page describe the changes.

### Removed

- The Reddit profile, its links, and its icon.

## [1.5.0] — 2026-10-04

### Added

- Thank-you pages that open when someone finishes something on the website. Each one confirms what happened, explains what happens next, and suggests where to go from there: the latest post, Projects, the Developer page, and profiles to follow.
  - `/thank-you/message/` after sending the contact form, with or without JavaScript.
  - `/thank-you/post/` after sending a post, or a change to one, from the editor.
  - `/thank-you/account-deleted/` after deleting an account.
  - `/thank-you/support/` for supporters, for platforms that can send people to a page after they pay.
- A shared layout for them, `_layouts/thanks.html`, with a check mark or heart that draws itself, unless reduced motion is requested. While the contact form or accounts are off, their pages say so instead of confirming anything.
- A heart icon, and `follow` in `_data/social.yml` for the profiles suggested on the thank-you pages.
- `redirect_to` front matter for pages that have moved.

### Changed

- The contact form opens its thank-you page after sending, with JavaScript too. Problems are still shown next to the button, and the message stays in the form.
- The editor and the account page open their thank-you pages after sending a post and after deleting an account, instead of showing a message in place.
- `/contact/sent/` forwards to `/thank-you/message/`.
- The Accessibility page and the Credits page describe the change.

## [1.4.1] — 2026-10-02

### Changed

- Numbers on the Projects page have thousands separators (such as 22,928), and the contributions total is labeled "in the last year", like the calendar it summarizes.
- Repository cards without a description say "No description provided."
- A repository's "Website" link is left out when it points back to GitHub, and on this website's own card.
- The "Sort by" choices are shorter, so they fit on small phones.
- The Activity panel describes the calendar as the contributions shown on my GitHub profile.

## [1.4.0] — 2026-10-02

### Added

- A Projects page at `/projects/` with my public GitHub repositories: each one's description, topics, main language, stars, forks, license, and when it was last updated. The repositories pinned on my GitHub profile are shown first as featured projects, followed by totals, the languages used across the repositories, and the contribution calendar from my GitHub profile with a written summary. The full list can be searched, filtered by language, and sorted; the choices are kept in the page's address.
- The "Update GitHub data" workflow (`.github/workflows/update-github-data.yml` and `.github/scripts/update_github_data.py`). Every day, it reads this public information from the GitHub API with the workflow's own token and saves it in `_data/github.json`, so visitors' browsers never contact GitHub. It commits only when something changed, then asks GitHub Pages to rebuild. `_data/projects.yml` chooses the featured and hidden repositories and whether forks and archived repositories are listed.
- Featured projects in the Home page's "Open source" section, and the languages used in my public repositories on the Developer page.
- Site search across the pages, blog posts, and projects. It opens from the header, or with `/`, Ctrl+K, or ⌘K. Results are chosen with the arrow keys or the pointer, and the number of results is announced. The index is `/search.json`, and searching happens in the browser. The 404 page offers it too.
- Reading aids on post pages: an "On this page" list of sections that marks the one being read; a reading-progress bar in browsers that support scroll-driven animations; copy buttons on code examples; and up to three related posts that share tags.
- Smooth transitions between pages in browsers that support them, unless reduced motion is requested.
- Reddit ([u/sanskarIN](https://reddit.com/user/sanskarIN)) in the social and community links, on the About page, and in the structured data.
- Icons for Reddit, search, repositories, stars, forks, licenses, activity, and the list of sections.

### Changed

- The X profile is now [@SanskarCodes](https://x.com/SanskarCodes) everywhere, including the social preview tags.
- Headings in posts that skip a level are shown one level below the previous heading, and the sections of posts get anchors that can be linked to.
- The header has a search button. On very narrow screens, the menu button shows only its icon.
- The sitemap lists `/projects/`, dated by the last data update.
- The Privacy Policy, Terms, Accessibility page, and Credits page describe the Projects page, the search, and Reddit.

## [1.3.0] — 2026-10-02

### Added

- Accounts, off until a Supabase project is connected in `_data/accounts.yml`: sign-up and sign-in with a 6-digit code sent by email (no password), author profiles (username, display name, bio, website), an account page that lists your posts and where each one is in the review, signing out, and deleting your account.
- A post editor at `/account/write/` with image uploads (cover and images in the text, up to 10 MB each) and an automatically saved draft. Location, camera, and other metadata are removed from images in the browser before they are uploaded. Posts become GitHub issues and are checked, reviewed, and published by the same workflow as posts written on GitHub.
- Author pages at `/blog/authors/?u=<username>`, and `/blog/posts.json`, the list of posts they read.
- `supabase/schema.sql` (tables, storage bucket, and row-level security rules) and the `blog` Edge Function in `supabase/functions/blog/`, with a step-by-step setup guide in the README.
- The publishing workflow accepts posts sent by accounts: it trusts the account's note only on issues opened by the owner, shows the account's display name as the author, and accepts images only from that account's own folder.
- A "Blog" section on the Home page with the latest posts.

### Changed

- When accounts are on, "Write a post" opens the editor (the GitHub form stays available), the footer links to "Your account", the Content Security Policy allows the Supabase address, and the Privacy Policy, Terms, Cookie Policy, Accessibility page, and Credits page describe accounts.
- Posts by website accounts are treated as visitors' posts in social previews and structured data.
- Tags on the Tags page get distinct anchors even when they differ only by "#", such as "c" and "c#".
- Secondary text-style buttons have a transparent background, so they keep their contrast in the dark theme.

## [1.2.1] — 2026-09-27

### Fixed

- Headings in posts written with the blog form keep their level: a post's top headings become sections of the page (a `##` heading no longer turns into a smaller one).

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
