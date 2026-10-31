# Python + TypeScript website migration

## Goal

Make **Python and TypeScript the maintained application and build code**.
The output is still standard HTML, CSS, JSON and JavaScript, because browsers,
search engines and assistive technology depend on those formats. The migration
is not about pretending that a browser can render Python directly.

Until the Python static-site builder passes parity checks, the existing Jekyll
build and GitHub Pages branch deployment stay in service. No deployment
switch-over or removal of Ruby happens in this milestone.

## Inventory and current owners

| Area | Maintained source | Runtime / output | State |
|---|---|---|---|
| Home | `_data/home_content.json`, Python renderers | Static HTML | Python-generated |
| About | `_data/about_content.json`, Python renderers | Static HTML | Python-generated |
| Developer | `_data/developer_details.json`, Python renderers | Static HTML | Python-generated |
| Contact / 404 | `_data/contact_page.json`, `_data/not_found_page.json`, Python renderers | Static HTML | Python-generated |
| Typography and layout tokens | `_data/design_tokens.json` | CSS custom properties | Python-generated |
| Theme colors | `_data/theme.json` | CSS, `theme-color` metadata and manifest | JSON source; Python CSS compiler |
| Other visual rules | `_includes/css/*.css` | `assets/css/main.css` | Python-assembled CSS; remaining CSS source |
| Interactive behavior | `src/ts/*.ts` | `assets/js/*.js` | TypeScript compiled with `tsc` |
| Blog source and publication | `_posts/*.md`, `.github/scripts/post_markdown.py`, `.github/scripts/publish_post.py` | Markdown articles and rendered HTML | All existing posts converted; new posts written as Markdown by Python |\n| GitHub sync/account setup | `.github/scripts/*.py` | PRs, config | Python automation |
| Story-page build checks | `.github/scripts/check_kahani.py` | CI assertions | Python |
| Site layouts, SEO, sitemap, feeds and search/terminal JSON | `_layouts/`, `_includes/`, front matter / Liquid | Jekyll-built static site | **Not yet migrated** |
| Supabase Edge Function | `supabase/functions/blog/index.ts` | Supabase backend | TypeScript, keep |
| GitHub workflows | `.github/workflows/*.yml` | CI and deployment | YAML config required by GitHub |
| Images, fonts, icons and site metadata | `assets/`, `_data/` | Browser assets | Assets/config, not programming languages |

## Milestones

1. **Complete:** Generate main editorial pages and design tokens with Python
   and preserve the existing accessible HTML, URLs and browser behavior.
2. **This change:** Compile the entire public stylesheet using Python from a
   JSON theme and CSS partials, remove Jekyll Liquid from the CSS build,
   port the story-page integration checker to Python and make generated-file
   parity a required PR check.
3. **Complete:** Convert legacy HTML blog articles to Markdown, preserve complex code and quotes, and have the Python publisher create Markdown for new posts. Verify post URLs and search entries with CI.\n4. **In progress:** The independent Python terminal and search-index
   models now reconstruct structured site data from JSON, YAML, and Markdown.
   The terminal data must match Jekyll exactly. Python search results must
   preserve all public page, post, and repository URLs and metadata.
   The public Jekyll endpoints remain in place until dynamic source
   regeneration and HTML/text indexing parity are verified.
5. **Next:** Move remaining `terminal.json`, `search.json`, sitemap and feeds into
   Python generators. Verify exact shapes and links against the current
   Jekyll output. Do not break existing TypeScript consumers.
6. **Next:** Replace shared layouts and page templates incrementally with
   Python-driven static HTML, including navigation, SEO, CSP, author metadata,
   accessibility and language variants. Keep Jekyll as an oracle in dual
   builds until Python output passes functional checks.
7. **Next:** Recreate blog post rendering, pagination, author pages, legal
   pages, redirects, structured data, and any account-related site output
   with a Python pipeline. Preserve existing URLs and full CSP rules.
8. **Only after parity:** Switch GitHub Pages from built-in Jekyll branch
   deployment to a tested GitHub Actions artifact deployment; remove Ruby,
   Gemfile and leftover Liquid. Require a successful rollback drill.

## Acceptance gates before removing Jekyll

- All existing public routes resolve with the same canonical URLs and
  redirects; no lost pages, posts, feeds or static assets.
- Browser search and terminal still consume validated JSON schemas.
- Complete page metadata: title, description, Open Graph, CSP, robots,
  canonical, language tags and sitemap entries.
- Home, About, Developer, Contact, Kahani and project views work without
  JavaScript where they previously did; theme/search/navigation interactions
  still work with TypeScript.
- The optional contact form works with JavaScript enabled **and disabled**,
  and account-origin/CSP policies remain correct.
- Python generator validation rejects injected HTML, Liquid directives,
  unsafe CSS data and stale generated artifacts.
- Functional/visual regression checks across mobile and desktop breakpoints,
  light/dark themes, keyboard and screen-reader navigation.
- A deploy to a staging Pages artifact passes before production settings
  change; previous GitHub Pages branch deployment can be restored quickly.

## Day-to-day workflow

For now, edit JSON and Python for page content; edit TypeScript for browser
features. CSS partials are still necessary for browser presentation, but the
published stylesheet must be generated rather than edited manually:

```bash
python .github/scripts/generate_site_content.py
python .github/scripts/generate_site_content.py --check
python -m unittest discover -s .github/scripts/tests -v
npm ci
npm run check
npm run build
bundle exec jekyll build --strict_front_matter --trace
python .github/scripts/check_generated_pages.py _site
python .github/scripts/check_kahani.py _site
```

GitHub Actions validates the generated sources and compiled TypeScript in
pull requests. **Do not rewrite or delete Jekyll merely to make the GitHub
language percentages look different.** Actual working functionality and
deployable build parity determine completion.
