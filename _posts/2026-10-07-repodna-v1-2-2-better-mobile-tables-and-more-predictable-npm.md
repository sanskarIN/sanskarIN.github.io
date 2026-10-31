---
title: "RepoDNA v1.2.2 — Better Mobile Tables and More Predictable npm Releases"
description: "RepoDNA v1.2.2 is a focused follow-up to v1.2.1, improving mobile table scrolling and npm release handling while continuing to make repository intelligence more usable and predictable."
date: 2026-10-07T07:49:01+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-2-2-better-mobile-tables-and-more-predictable-npm/cdff40ad6f75d9cf.png"
image_alt: "RepoDNA v1.2.2 web interface showing the repository overview with codebase statistics, language information, and Project DNA dimensions."
image_width: 2000
image_height: 1125
tags: ["repodna", "open-source", "rust", "developer-tools", "code-analysis"]
source_issue: 12
---
## RepoDNA v1.2.2

### Better mobile tables. More predictable npm releases.

RepoDNA v1.2.2 is now available.

This release is a focused follow-up to v1.2.1, improving two areas that directly affect day-to-day use and release distribution:

- clearer scrolling feedback for wide tables on phones

- safer npm publishing for releases that are older than the current <code>latest</code>

RepoDNA remains an open-source, local-first repository intelligence and code archaeology platform designed to help developers understand how a codebase is structured, how it has evolved, and where its important technical signals are.

### Mobile tables now communicate more clearly

When a RepoDNA table is wider than the available phone screen, it can scroll horizontally.

The interface uses shading along the edge to communicate that additional content exists outside the visible area.

In v1.2.1, that shading could become weaker toward the beginning and end of long tables.

RepoDNA v1.2.2 changes the implementation so the edge indication remains consistent across the full edge of the table.

The result is a small but meaningful improvement in mobile usability.

### npm publishing is more predictable

RepoDNA is distributed through <a href="http://npmjs.com" rel="noopener noreferrer">npmjs.com</a> as well as GitHub Packages.

Sometimes an older release needs to be published after a newer release is already available.

v1.2.2 updates the npm publishing workflow to recognize this situation.

A release that is older than the registry's current <code>latest</code> version can now be published under the <code>previous</code> tag instead.

This means the newest release remains the normal installation target while older versions can still be published and accessed when needed.

### A continuation of the v1.2.x improvements

RepoDNA v1.2.1 introduced a broad set of usability and distribution improvements, including <a href="http://npmjs.com" rel="noopener noreferrer">npmjs.com</a> installation without requiring a GitHub token, accessibility improvements, better phone layouts, clearer Git clone errors, improvements to <code>repodna serve</code>, and better web deployment behavior.

v1.2.2 continues that work with a deliberately narrow scope.

The goal is not simply to add more features, but to make the existing experience more dependable.

### Explore RepoDNA

<strong>Release:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.2.2" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.2.2</a>

<strong>Source code:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

<strong>Web version:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>npm installation:</strong>

<code>npm install --global @sanskarin/repodna@1.2.2</code>

### See the codebase behind the tool

RepoDNA can analyze its own repository and present that information through its overview, architecture, history, hotspots, findings, files, quality information, project information, search, reports, and Project DNA views.

The screenshots in the repository's documentation are versioned as well, so the evolution of the interface can be followed from v1.0.0 through the current v1.2.2 release.

### Final note

v1.2.2 is a reminder that software quality often comes from many small improvements working together.

A better mobile interaction.

A safer release workflow.

A more predictable developer experience.

<strong>Understand your codebase. See its DNA.</strong>

— <a href="https://sanskarin.github.io/RepoDNA" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA</a>
