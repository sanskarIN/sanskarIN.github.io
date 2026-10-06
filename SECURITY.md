# Security Policy

This repository contains the source of https://sanskarIN.github.io, a static website hosted on GitHub Pages. The website has no server of its own: its contact form is delivered by Web3Forms, blog posts are published from GitHub issues by a GitHub Actions workflow, another workflow copies public information about the owner's repositories from the GitHub API for the Projects page, and the optional accounts (sign-in, author profiles, and the post editor) are provided by a Supabase project, with the database schema and Edge Function kept in `supabase/`. Reports of security problems are welcome and taken seriously.

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
- access, change, or delete other people's accounts, profiles, posts, or images — test with accounts you created yourself;
- run tests that could affect the website's availability or other people, such as denial-of-service attempts, high-volume automated scanning, spam, or social engineering.

## What happens next

Reports are reviewed as soon as reasonably possible; there is no guaranteed response time. Confirmed issues are fixed in this repository, and reporters can be credited in the fix if they wish.

## Scope

**In scope:** this repository and the website it publishes, including its HTML, CSS, JavaScript and its TypeScript sources in `src/ts/`, configuration, `/.well-known/security.txt`, the blog's issue form, the workflows and scripts in `.github/`, and the accounts' database rules and Edge Function in `supabase/`.

**Out of scope:** GitHub and the GitHub Pages infrastructure (report those through [GitHub's Security Bug Bounty](https://bounty.github.com/)), the Supabase platform itself (report it to Supabase), and third-party services linked from the website, which should be reported to their providers.
