# Changelog

Notable changes to this website are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
