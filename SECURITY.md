# Security Policy

This repository contains the source of https://sanskarIN.github.io, a static website hosted on GitHub Pages. The website has no server-side code, database, or user accounts of its own: its contact form is delivered by Web3Forms, and blog posts are published from GitHub issues by a GitHub Actions workflow. Reports of security problems are welcome and taken seriously.

## Reporting a vulnerability

Please report security issues **privately** by email to **supportramsandesh@gmail.com**, with a subject line such as "Security issue: sanskarIN.github.io".

Helpful details to include:

- a description of the issue and its possible impact;
- the affected page URLs or repository files;
- steps to reproduce the issue, or a minimal proof of concept;
- any suggested fix.

The same contact is published in machine-readable form at https://sanskarin.github.io/.well-known/security.txt.

## Please do not

- open a public GitHub issue, pull request, or discussion about an unfixed vulnerability;
- share details publicly (including on social media) before the issue has been fixed;
- include passwords, tokens, API keys, or other credentials — yours or anyone else's — in a report;
- include other people's personal data;
- submit a blog post that demonstrates a vulnerability — if you find a way to get unsafe content into a post, report it privately instead;
- run tests that could affect the website's availability or other people, such as denial-of-service attempts, high-volume automated scanning, spam, or social engineering.

## What happens next

Reports are reviewed as soon as reasonably possible; there is no guaranteed response time. Confirmed issues are fixed in this repository, and reporters can be credited in the fix if they wish.

## Scope

**In scope:** this repository and the website it publishes, including its HTML, CSS, JavaScript, configuration, `/.well-known/security.txt`, and the blog's issue form, publishing workflow, and script in `.github/`.

**Out of scope:** GitHub and the GitHub Pages infrastructure (report those through [GitHub's Security Bug Bounty](https://bounty.github.com/)), and third-party services linked from the website, which should be reported to their providers.
