# Changelog

Notable changes to this website are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
