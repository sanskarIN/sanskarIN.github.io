---
title: "repodna-v1-3-0-better-codebase-exploration"
description: "RepoDNA v1.3.0 improves repository exploration with recent analyses, persistent navigation, CSV exports, drag-and-drop support, and a locally runnable web interface."
date: 2026-10-09T14:23:28+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-3-0-better-codebase-exploration/0745b75a66451941.png"
image_alt: "RepoDNA 1.3.0 launch graphic showing the repository-analysis web interface on desktop and mobile, with the headline “Understand your codebase. See its DNA.”"
image_width: 2000
image_height: 1125
tags: ["repodna", "open-source", "rust", "developer-tools", "code-analysis"]
source_issue: 17
---
## RepoDNA v1.3.0: A Better Experience for Understanding Codebases

A software repository contains a story. Its architecture shows how components fit together. Its dependencies reveal relationships between packages. Its Git history explains how the project evolved. Its code-quality signals help developers identify areas that deserve further investigation.

But finding that information can be time-consuming, especially when entering an unfamiliar codebase.

<strong>RepoDNA is an open-source, local-first repository intelligence and code archaeology platform that helps developers explore these details through evidence-backed analysis.</strong>

RepoDNA v1.3.0, released on October 9, 2026, focuses on making that exploration smoother and more practical.

<strong>[<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.0" rel="noopener noreferrer">Explore the v1.3.0 release on GitHub</a>](<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.0" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.0</a>)</strong>

### What's new in RepoDNA 1.3.0?

#### Return to your recent analyses

The web interface keeps a browser-side list of the last five analysis files opened in that browser. Those entries can be reopened from the start page or search, and the feature can be disabled or cleared in Settings.

It is easier to return to an earlier project without manually reopening the same file.

#### Continue from the view you were exploring

Reloading the page preserves the current analysis and view. Navigation between sections and panels has also improved, including links to previous and next views and keyboard navigation with <code>[</code> and <code>]</code>.

These details matter when working through long reports or investigating a particular part of a codebase.

#### Explore findings with less friction

Findings are presented 25 at a time, with controls to load more. Filtered views can be opened through the URL, making specific findings easier to revisit.

#### Export data from every table

Every table includes a Download CSV option that exports all rows in their displayed order. The output also handles formula-leading text to reduce the risk of unintended spreadsheet execution.

This helps developers take analysis results into spreadsheets and other data workflows.

#### Open analysis files through drag and drop

You can drop an analysis file anywhere on the page to open it, even when another analysis is already open. The Compare view also accepts a second analysis file for comparison.

#### Run the web interface locally

Version 1.3.0 introduces the <code>@sanskarin/repodna-web</code> npm package.

With Node.js and npm available, run:

<pre tabindex="0"><code>npx @sanskarin/repodna-web
</code></pre>

The package starts a local server at <code>http://127.0.0.1:8080/</code>, where you can open analysis files and explore the demo offline.

For analyzing your own repository, use the RepoDNA command-line tool or desktop app to create the analysis first. The web package provides the interface for viewing analysis files; it does not independently perform repository analysis.

#### Further usability improvements

This release also includes improvements to printing, keyboard access, table navigation, phone layouts, and the desktop app's recent-analysis list.

### What can RepoDNA help you investigate?

RepoDNA goes beyond a basic language breakdown. Its analysis capabilities cover several aspects of repository understanding, including:

- <strong>Architecture and dependencies:</strong> inferred modules, dependency relationships, layers, cycles, and architectural patterns.

- <strong>Git history:</strong> commits, releases, contributors, file changes, activity, and hotspots.

- <strong>Quality signals:</strong> complexity, large functions and files, duplication, and TODO or FIXME markers.

- <strong>Security signals:</strong> rules for committed-secret fingerprints and potentially risky patterns in code and configuration.

- <strong>Project setup:</strong> tests, build systems, CI, documentation, and onboarding information.

- <strong>Reports and sharing:</strong> HTML, Markdown, JSON, CSV, Project DNA cards, and repository comparisons.

Findings are intended to show supporting evidence and the limitations of the analysis, rather than presenting an unsupported score as the complete truth about a project.

### Local-first by design

RepoDNA is designed to run locally and has no telemetry. When the web interface opens an analysis file, it does not upload the file to display its contents. The recent-analysis list is maintained in the browser.

Some explicitly requested operations, such as cloning a remote Git URL or contacting a configured AI provider, may still use the network.

The broader goal is to give developers a useful view into their codebases while keeping control of their work and data.

### How to get started

Install the command-line tool using npm:

<pre tabindex="0"><code>npm install --global @sanskarin/repodna
</code></pre>

Run the analysis and local interface from a repository:

<pre tabindex="0"><code>repodna analyze
repodna serve
</code></pre>

You can also download prebuilt command-line binaries and desktop installers from the release page.

If you would first like to explore the interface, visit the [<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">RepoDNA web version</a>](<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>) and try the included demo.

### Explore RepoDNA v1.3.0

- <strong>Release and downloads:</strong> <a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.0" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.0</a>

- <strong>Source code:</strong> <a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

- <strong>Web version:</strong> <a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

- <strong>Changelog:</strong> <a href="https://github.com/sanskarIN/RepoDNA/blob/main/CHANGELOG.md" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/blob/main/CHANGELOG.md</a>

RepoDNA v1.3.0 is another step toward making repository intelligence easier to explore and more useful in everyday development.

If you try the release, I'd love to know which parts of repository analysis make the biggest difference to your workflow: understanding architecture, exploring history, examining dependencies, or identifying quality issues.

Feedback, bug reports, and open-source contributions are welcome.
