---
title: "repodna-v1-3-2-documentation-site"
description: "RepoDNA v1.3.2 adds a dedicated searchable documentation website, clearer WebAssembly errors, updated support links, and more reliable GitHub Actions downloads."
date: 2026-10-13T05:30:10+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-3-2-documentation-site/6661fb72509301fc.png"
image_alt: "Square RepoDNA v1.3.2 release graphic highlighting updates in the latest version."
image_width: 2000
image_height: 2000
tags: ["repodna", "open-source", "rust", "developer-tools", "code-analysis"]
source_issue: 21
---
<img src="/assets/images/blog/repodna-v1-3-2-documentation-site/cc885760046fba62.png" alt="RepoDNA v1.3.2 launch graphic announcing the latest release of the open-source repository intelligence project." width="2000" height="1125" loading="lazy" decoding="async">

<img src="/assets/images/blog/repodna-v1-3-2-documentation-site/d92f8d7b9d0d45b2.png" alt="Portrait-format RepoDNA v1.3.2 promotional graphic presenting the project in a mobile-friendly format." width="1600" height="2000" loading="lazy" decoding="async">

<img src="/assets/images/blog/repodna-v1-3-2-documentation-site/32808c109fe36bcb.png" alt="RepoDNA Project DNA card presenting repository analysis information in the dark theme." width="2000" height="1050" loading="lazy" decoding="async">

<img src="/assets/images/blog/repodna-v1-3-2-documentation-site/38eca18e8b9cbfce.png" alt="RepoDNA Project DNA card presenting repository analysis information in the light theme." width="2000" height="1050" loading="lazy" decoding="async">

## RepoDNA v1.3.2: New Documentation Website and Reliability Improvements

I'm pleased to announce the release of RepoDNA v1.3.2.

This release brings a dedicated documentation website, clearer error messages, more reliable GitHub Actions downloads, and improvements to documentation maintenance.

RepoDNA is an open-source, local-first repository intelligence and code archaeology project designed to help developers understand how software repositories are structured, how their components depend on one another, and how their codebases evolve over time.

### A dedicated documentation website

RepoDNA's documentation is now available at:

<strong><a href="https://sanskarin.github.io/RepoDNA/docs/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/docs/</a></strong>

The website brings together documentation guides, the changelog, roadmap, policies, examples, benchmarks, and fixtures.

It includes search across documentation sections, a navigation sidebar, previous and next page links, code-copy buttons, and light and dark themes. The layout is responsive for phones and designed to print cleanly.

The aim is to make information about RepoDNA easier to discover and use, whether someone is evaluating the project or working with it regularly.

### More helpful error messages

The <code>repodna-wasm</code> component now handles missing files and folders more clearly.

Invalid inputs should explain the problem instead of forcing users to interpret confusing low-level errors. This release improves those explanations and clarifies when report and card commands need an analysis file.

### More reliable GitHub Actions downloads

The GitHub Action now retries downloads for up to two minutes when temporary GitHub server errors occur. When downloading ultimately fails, the action reports the failure and its error instead of incorrectly suggesting that the release asset does not exist.

The related guide now also documents the <code>security-only</code> profile among the supported profile options.

### Improved documentation checks

CI and the web version workflow now check documentation links and anchors. These checks help catch broken navigation before updates are released.

The release also updates documentation destinations and support links across the relevant project pages and application surfaces.

### Building tools that are easier to understand

A repository is more than a collection of files. It contains architecture, dependencies, history, quality signals, and evidence of how the software has evolved.

RepoDNA aims to make that information easier to explore through structured, evidence-backed analysis while following a local-first approach.

This release is another step in making the project easier to learn, use, and maintain.

### Explore RepoDNA v1.3.2

<strong>Release notes:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.2" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.2</a>

<strong>Documentation:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/docs/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/docs/</a>

<strong>Web version:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>GitHub repository:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

I welcome feedback, testing, documentation suggestions, and contributions from the open-source community.

<strong>RepoDNA — Understand your codebase. See its DNA.</strong>
