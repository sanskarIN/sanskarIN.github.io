# Contributing

This repository is the personal website of Sanskar. It is not a community project, but suggestions and fixes are welcome — especially reports of accessibility barriers, broken links, typos, and bugs.

## Proposing a change

- **Report a problem or suggest an idea** by opening an issue that explains what you noticed and where (the page URL helps).
- **Small fixes** (typos, broken links, clear bugs) can go straight to a pull request.
- **Larger changes** — new pages, design changes, new dependencies — should start as an issue so the idea can be discussed first.
- **Security issues** must not be reported publicly. Follow [SECURITY.md](SECURITY.md) instead.
- **Blog posts** are not pull requests: write them with the "Write a blog post" issue form, linked from the [blog](https://sanskarin.github.io/blog/). The [Terms](https://sanskarin.github.io/terms/#blog-posts) explain what can be posted.

There is no guaranteed response time, and the site owner decides what is merged. The website's content is not licensed for reuse (see [LICENSE_DECISION.md](LICENSE_DECISION.md)); contributions are accepted only for use on this website.

## Quality bar

Every change should keep the site as correct, accessible, fast, and maintainable as it is now.

### Truthful content

- Never add invented information: statistics, follower or repository counts, stars, downloads, employers, clients, customers, revenue, testimonials, awards, certifications, partnerships, or legal and company details.
- Do not add project content. The Projects page is generated from the site owner's public GitHub repositories: `_data/github.json` is written by the "Update GitHub data" workflow and must never be edited by hand, and `_data/projects.yml` only chooses what is shown.
- Use the official links and email addresses exactly as they appear in `_data/social.yml` and `_data/contact.yml`.
- Keep the Privacy, Cookie, and Accessibility pages accurate: if a change affects what the website collects, stores, loads, or supports, update those pages in the same pull request (see README → "Legal pages").

### Accessibility requirements

- Use semantic HTML: one `<h1>` per page, headings in order, lists for lists, buttons for actions, and links for navigation.
- Everything must work with a keyboard alone, with a visible focus indicator and a logical focus order.
- Text must keep a contrast ratio of at least 4.5:1 against its background in both the light and dark themes.
- Icons are decorative (`aria-hidden="true"`); every control needs a text label, visible or visually hidden.
- Use `_includes/link.html` for external links, so they open in a new tab with `rel="noopener noreferrer"` and announce that to screen-reader users.
- Do not convey information with color alone, do not add autoplaying media, and keep animation minimal (it must respect `prefers-reduced-motion`).
- Prefer native HTML over ARIA. The one deliberate exception is `role="list"` on unstyled lists outside `<nav>`, which keeps list semantics in Safari with VoiceOver.
- Check new layouts at 320 px wide: no horizontal scrolling.

### Maintainability

- Keep content settings in `_data/` and site settings in `_config.yml` rather than hard-coding them in templates.
- Reuse the existing includes (`link.html`, `email-link.html`, `profile-list.html`, `contact-card.html`, `icon.html`) and CSS components before adding new ones.
- CSS: use the design tokens in `_includes/css/tokens.css`, write mobile-first, and put styles in the matching partial in `_includes/css/`.
- JavaScript is for progressive enhancement only: the site must remain fully usable with JavaScript turned off.
- Scripts are written in TypeScript, in `src/ts/`. Change the `.ts` file, never `assets/js/` (it's compiled output), and keep `npm run check` passing with the strict settings in `tsconfig.json`.
- Do not add inline scripts or inline styles — the Content Security Policy blocks them.
- Templates must stay compatible with GitHub Pages: Jekyll 3.10 and no custom plugins.
- Do not add frameworks, CDNs, analytics, trackers, or other third-party scripts. Any new dependency needs a clear reason, an acceptable license, and an entry on the Credits page.
- Never commit secrets: passwords, API keys, tokens, or private keys.
- The blog workflow in `.github/` handles text and images from anyone: never pass issue content to a shell command or a template, keep the HTML allowlist in `publish_post.py` strict, and keep actions pinned to commits and packages to exact versions.
- The GitHub data workflow reads public information only, with the workflow's own `GITHUB_TOKEN`. Don't give it a personal access token or more permissions, and keep repository text out of HTML: templates must escape it.
- The account pages show what people type: in `src/ts/account.ts`, put it on the page with `textContent` only, never `innerHTML`. The same goes for the terminal (`src/ts/terminal.ts`). Any change to who can read or write what belongs in `supabase/schema.sql` (row-level security), and the function in `supabase/functions/blog/` must keep checking every request itself. Never commit a Supabase secret key or a GitHub token.

## Before opening a pull request

1. Build the site: `bundle exec jekyll build`. It must finish without errors (Liquid runs in strict mode).
2. Preview it with `bundle exec jekyll serve` and check every page you changed:
   - in the light and dark themes;
   - on a narrow (320 px) and a wide screen;
   - using only the keyboard;
   - with JavaScript turned off.
3. Make sure the browser console shows no errors, including Content Security Policy errors.
4. If you changed a policy page, update its date in `_data/legal.yml`. Note notable changes in `CHANGELOG.md`.
5. If you changed the blog workflow or `publish_post.py`, publish a test post and check the result before relying on it.
6. If you changed `update_github_data.py`, run `python .github/scripts/update_github_data.py --dry-run` and check the Projects page, then restore `_data/github.json` before committing.
7. If you changed the account pages, `supabase/schema.sql`, or the Edge Function, update the Supabase project too (re-run the SQL, or paste the new function into its editor) and try signing in, writing a post, and deleting a test account.
