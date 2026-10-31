---
title: "repodna-v1-2-1-release"
description: "RepoDNA v1.2.1 is now available, bringing easier npm installation, better accessibility, improved mobile behavior, clearer Git errors, a restored Project DNA card, and more reliable web deployment."
date: 2026-10-06T08:55:09+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-2-1-release/a773e5af77d3a90c.png"
image_alt: "RepoDNA 1.2.1 launch graphic showing the repository intelligence interface across desktop and mobile with npm installation highlighted."
image_width: 2000
image_height: 1125
tags: ["repodna", "opensource", "rust", "developer-tools", "code-analysis"]
source_issue: 11
---
## RepoDNA v1.2.1: Easier Installation and a More Polished Repository Intelligence Experience

<strong>Published October 6, 2026</strong>

RepoDNA <strong>v1.2.1</strong> is now available.

This release focuses on making RepoDNA easier to install, more accessible, more usable on phones, and more reliable in everyday workflows.

RepoDNA is an open-source, local-first repository intelligence and code archaeology platform that turns a repository into an evidence-backed picture of its structure, architecture, dependencies, history, quality, security, tests, documentation, and evolution.

### The biggest update: npm installation

RepoDNA packages are now available on <strong><a href="http://npmjs.com" rel="noopener noreferrer">npmjs.com</a></strong> as well as GitHub Packages.

That means you can install the command line with:

<pre tabindex="0"><code>npm install --global @sanskarin/repodna@1.2.1
</code></pre>

No GitHub token is required for the normal npm installation flow.

The release also publishes the RepoDNA schema and visualization packages through npm.

### Better <code>repodna serve</code>

The local web interface continues to be one of the main ways to explore an analysis.

In v1.2.1, the <strong>Project DNA card is working again in <code>repodna serve</code></strong>.

The start page also does a better job of explaining how repositories are analyzed and how the resulting <code>repodna.json</code> can be opened in the web interface.

### Accessibility

v1.2.1 improves accessibility across both the web interface and generated HTML reports.

The improvements include better contrast, heading structure, landmarks, keyboard scrolling, and screen-reader descriptions for charts and other interface elements.

### Mobile improvements

Long repository paths, commands and tables can be difficult to use on small screens.

v1.2.1 improves how those elements behave on phones, including better wrapping, horizontal table scrolling and visual indicators for content outside the current viewport.

### Clearer errors

Git clone failures are now easier to understand.

RepoDNA reports the actual Git reason without exposing unnecessary command details and provides clearer guidance for common problems such as private repositories, missing repositories, or unreachable hosts.

### More accurate recent-history analysis

The 90-day recent-history window used by <code>repodna ci</code> and onboarding now ends at the repository's latest commit.

That makes the result more meaningful when analyzing a repository that has been inactive for some time.

### More reliable web deployment

The GitHub Pages deployment flow has also been improved so the web interface can be republished properly after Pages completes its build.

The workflow additionally warns when the Pages source is still configured from a branch rather than GitHub Actions.

### A release built around refinement

v1.2.1 is not a large rewrite.

It is about removing friction from a project that is already capable of substantial repository analysis.

RepoDNA continues to provide:

- architecture and dependency analysis

- Git history and code archaeology

- change hotspots

- quality and complexity signals

- security signals

- tests, build and documentation analysis

- the Codebase Time Machine

- Project DNA cards and reports

- CLI, local web and desktop interfaces

- optional evidence-grounded AI explanations

The common theme is evidence.

RepoDNA is designed to show <strong>why</strong> something appears in an analysis rather than simply returning an unexplained score.

### Install RepoDNA 1.2.1

<pre tabindex="0"><code>npm install --global @sanskarin/repodna@1.2.1
</code></pre>

#### Explore the project

<strong>Repository:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

<strong>Release:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.2.1" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.2.1</a>

<strong>Release notes:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/blob/main/docs/releases/v1.2.1/README.md" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/blob/main/docs/releases/v1.2.1/README.md</a>

<strong>Web version:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>Media kit:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/blob/main/docs/media/README.md" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/blob/main/docs/media/README.md</a>

### What's next?

RepoDNA's development continues toward making repository intelligence more useful for developers, maintainers, teams, and anyone who needs to understand an unfamiliar codebase.

For now, v1.2.1 is another step in that direction.

<strong>Understand your codebase. See its DNA.</strong>

— Sanskar
