---
title: "All Releases of RepoDNA from v1.0.0 to v1.2.0"
description: "The all the releases of the RepoDNA from v1.0.0 to v1.2.0"
date: 2026-10-05T15:45:53+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/all-releases-of-repodna-from-v1-0-0-to-v1-2-0/9e34061c46a2010a.png"
image_alt: "Screenshots of overview of releases from v1.0.0 to v1.2.0."
image_width: 2000
image_height: 2000
tags: ["repodna", "open-source", "rust", "developer-tools", "software-development"]
source_issue: 10
---
## POST 1 — RepoDNA v1.2.0

<strong>Title:</strong> RepoDNA v1.2.0 Is Here: More Ways to Install, Better Web Experience, and a More Mobile-Friendly Interface

<strong>Suggested slug:</strong> <code>repodna-v1-2-0-release</code>

<strong>Suggested date:</strong> October 5, 2026

<strong>Excerpt:</strong><br>
RepoDNA v1.2.0 expands distribution through GitHub Packages, adds a self-hostable web interface container, and brings a major round of responsive design improvements for phones and narrow screens.

### RepoDNA v1.2.0 Is Here

Today I’m releasing <strong>RepoDNA v1.2.0</strong>, the latest step in the evolution of RepoDNA — a local-first repository intelligence and code archaeology tool designed to help developers understand the structure, history, architecture, dependencies, quality signals, and evolution of a codebase.

This release focuses on making RepoDNA easier to obtain and easier to use, especially when working from smaller screens or when running the web interface yourself.

The v1.2.0 release adds new distribution options through <strong>GitHub Packages</strong>, introduces a dedicated <strong>web interface container image</strong>, and includes a broad set of refinements across the web interface, desktop application, and generated reports.

### What’s new in v1.2.0?

#### A web interface container

RepoDNA now provides a dedicated web interface container:

<code>ghcr.io/sanskarin/repodna-web</code>

The image lets you serve the RepoDNA web interface on your own network or in environments where you want the application available without relying on an internet connection.

The image supports <code>linux/amd64</code> and <code>linux/arm64</code>, serves the interface on port <code>8080</code>, and is configured to run nginx as an unprivileged user.

#### npm packages through GitHub Packages

v1.2.0 also expands RepoDNA's installation options with packages published through GitHub Packages.

The new package set includes:

- <code>@sanskarin/repodna</code>

- <code>@sanskarin/repodna-schema</code>

- <code>@sanskarin/repodna-visualization</code>

The main package installs the RepoDNA command line and selects the appropriate platform package, while the schema package provides TypeScript types, loaders, validation helpers, and the JSON Schemas used by the project. The visualization package contains chart geometry used by the web interface.

#### Better phone and narrow-window support

One of the biggest themes of this release is responsive design.

The interface now behaves much better on phones and narrow windows. Navigation can fold behind a <strong>Menu</strong> button, the top bar fits smaller screens, long commands remain usable inside their containers, and long URLs can wrap instead of forcing the whole page wider.

Generated HTML reports were also improved so long paths and onboarding answers wrap correctly instead of creating sideways scrolling on phones.

#### More usable commands and tables

v1.2.0 adds copy buttons for commands on the start page, the Reports &amp; export page, and each onboarding step.

Tables also received usability improvements. Sortable columns now show a subtle sorting indicator, and numeric values embedded in text are sorted numerically rather than lexicographically.

Search was refined as well, including clearer presentation of views, commands, files, packages, and findings, along with better handling of large result sets.

#### Refined visualizations and findings

The Findings interface now uses wider severity filters, while the Hotspots view gives a clearer description when only one hotspot is being displayed.

Tooltips were also improved for narrow screens, reducing the chance that information is clipped at the bottom or edge of a phone display.

The release also improves keyboard navigation and screen-reader feedback in search.

### Why this release matters

RepoDNA started as a local-first codebase archaeology tool. With v1.2.0, the project is becoming easier to integrate into different workflows.

You can now use the project through its traditional downloads, containers, and source installation while also having additional package distribution through GitHub Packages.

At the same time, the web interface is becoming much more practical for modern, responsive workflows.

The result is a RepoDNA release that is not just about adding features, but about making the existing capabilities easier to access and use.

### Install RepoDNA v1.2.0

From source:

<pre tabindex="0"><code>cargo install --git https://github.com/sanskarIN/RepoDNA --tag v1.2.0 --locked repodna-cli
</code></pre>

With the container:

<pre tabindex="0"><code>docker run --rm -v "$PWD:/work" ghcr.io/sanskarin/repodna:1.2.0 analyze .
</code></pre>

With npm after configuring GitHub Packages:

<pre tabindex="0"><code>npm install --global @sanskarin/repodna@1.2.0
</code></pre>

The v1.2.0 release also includes platform downloads for Linux, macOS, and Windows, together with SHA-256 checksums.

### See RepoDNA v1.2.0

The official release contains the complete release notes, downloads, installation instructions, source tree, screenshots, and package information.

<strong>Release:</strong> GitHub Release v1.2.0<br>
<strong>Source:</strong> RepoDNA v1.2.0<br>
<strong>All releases:</strong> RepoDNA Releases

The live web version of RepoDNA is also available through the project's GitHub Pages site.

### Images for this article

<strong>Hero:</strong> <code>docs/media/promo/launch-16x9.png</code>

<strong>Secondary image:</strong> <code>docs/media/promo/whats-new-1x1.png</code>

<strong>Article screenshots:</strong><br>
<code>docs/images/v1.2.0/desktop/overview-light.png</code><br>
<code>docs/images/v1.2.0/desktop/architecture-dark.png</code><br>
<code>docs/images/v1.2.0/phone/overview-light.png</code><br>
<code>docs/images/v1.2.0/phone/history-dark.png</code>

<strong>Hero alt text:</strong><br>
“RepoDNA v1.2.0 launch image showing the RepoDNA web interface on desktop and phone with the message Understand your codebase. See its DNA.”

<strong>SEO description:</strong><br>
“RepoDNA v1.2.0 adds a self-hostable web interface container, GitHub Packages npm packages, improved responsive design, better reports, tables, search, and mobile support.”

---

## POST 2 — RepoDNA v1.1.1

<strong>Title:</strong> RepoDNA v1.1.1 Released: Maintenance Fixes Across CLI, Reports, and the Web Interface

<strong>Suggested slug:</strong> <code>repodna-v1-1-1-release</code>

<strong>Suggested date:</strong> October 5, 2026

<strong>Excerpt:</strong><br>
RepoDNA v1.1.1 is a maintenance release focused on correctness, usability, documentation, and small fixes across the command line, reports, AI execution, and web interface.

### RepoDNA v1.1.1 Is Released

RepoDNA has reached <strong>v1.1.1</strong>, a maintenance release focused on improving the reliability and polish of the project after the larger AI-focused v1.1.0 release.

Rather than introducing a major new feature, v1.1.1 concentrates on fixing edge cases, improving wording and output, tightening documentation, and making several parts of RepoDNA behave more naturally.

### What changed?

#### More links to the creator's open-source work

The About &amp; support area, web interface, desktop application, README, documentation, release notes, and <code>repodna version</code> output now provide links to more open-source projects by RepoDNA's creator, Sanskar.

#### Better configuration path output

<code>repodna config path</code> now writes only the actual configuration path to standard output.

When the configuration file does not exist yet, the explanatory message goes to standard error. This makes shell usage such as:

<pre tabindex="0"><code>$(repodna config path)
</code></pre>

behave correctly even before the configuration file has been created.

#### Improved local AI process handling

A local AI program that leaves a background process holding its output open no longer causes RepoDNA to unnecessarily delay the final answer until that process exits.

This is an important quality-of-life fix for users experimenting with local AI providers introduced in v1.1.0.

#### Better architecture and report wording

Repositories that do not have an inferred architecture no longer display confusing wording such as “unavailable confidence” in terminal summaries, reports, or the web interface.

The release also improves singular-count wording throughout the application, including phrases such as “1 module”, “1 file”, “1 commit”, and “1 analysis”.

#### Improved onboarding and command presentation

First-look answers and onboarding now correctly explain when no test files were found instead of presenting an awkward zero-count instruction.

Commands that already end with punctuation no longer receive an unnecessary second period.

Changes to files at the top level of a repository are also described as being at the repository root instead of being shown as <code>(root)/</code>.

#### Web interface refinements

The Architecture view now names the inferred style more directly.

Release notes retain the link to the web version.

The documentation has also been expanded around network usage, GitHub Pages behavior, security finding names, and release-version documentation.

### Why v1.1.1 matters

Maintenance releases are an important part of a growing developer tool.

RepoDNA v1.1.1 takes the capabilities added in v1.1.0 and makes the surrounding experience more consistent, predictable, and understandable.

It is a small release in version number, but a meaningful improvement in polish.

### Install RepoDNA v1.1.1

From source:

<pre tabindex="0"><code>cargo install --git https://github.com/sanskarIN/RepoDNA --tag v1.1.1 --locked repodna-cli
</code></pre>

With Docker:

<pre tabindex="0"><code>docker run --rm -v "$PWD:/work" ghcr.io/sanskarin/repodna:1.1.1 analyze .
</code></pre>

Platform downloads and SHA-256 checksums are available in the GitHub release.

### Images for this article

<strong>Hero:</strong> <code>docs/images/v1.1.1/desktop/overview-light.png</code>

<strong>Supporting:</strong> <code>docs/images/v1.1.1/desktop/architecture-dark.png</code>

<strong>Optional phone image:</strong> <code>docs/images/v1.1.1/phone/overview-light.png</code>

<strong>Hero alt text:</strong><br>
“RepoDNA v1.1.1 overview showing repository analysis information in the web interface.”

<strong>SEO description:</strong><br>
“RepoDNA v1.1.1 is a maintenance release with CLI, AI process, reporting, architecture, onboarding, web interface, and documentation fixes.”

---

## POST 3 — RepoDNA v1.1.0

<strong>Title:</strong> RepoDNA v1.1.0 Brings Evidence-Grounded AI Explanations

<strong>Suggested slug:</strong> <code>repodna-v1-1-0-release</code>

<strong>Suggested date:</strong> October 4, 2026

<strong>Excerpt:</strong><br>
RepoDNA v1.1.0 introduces optional AI explanations grounded in repository analysis and checked against the evidence used to generate them.

### RepoDNA v1.1.0: Optional AI, Grounded in Evidence

The next major step for RepoDNA is here.

With <strong>v1.1.0</strong>, RepoDNA introduces optional AI explanations designed to help developers understand a repository in natural language without turning the project into an opaque AI-first analyzer.

The key idea is simple:

<strong>RepoDNA analyzes the repository first. AI explains the evidence second.</strong>

AI is optional, stays disabled until a provider is configured, and receives a selected set of evidence from the existing analysis rather than being given unrestricted access to the repository.

### What can RepoDNA explain?

The new <code>repodna explain</code> command can explain:

- the repository itself

- architecture

- history

- dependencies

- onboarding information

- a specific module

- a specific hotspot

- a user question through <code>--ask</code>

The result can be emitted as text, Markdown, or JSON.

Each explanation includes provenance information such as the provider, model, revision, cited evidence, and token usage.

### Evidence comes first

One of the most important design decisions in v1.1.0 is how the model receives information.

The model is given a numbered selection of evidence produced by RepoDNA's analysis.

It does not simply receive the entire repository.

RepoDNA then checks the generated answer against that evidence.

Citations referring to evidence that was not actually provided are removed. Statements without a valid supporting citation are marked as unsupported, while statements identified as inferences are labeled accordingly.

This makes the AI layer an explanation tool built around RepoDNA's analysis rather than a replacement for it.

### Multiple provider options

RepoDNA v1.1.0 supports three broad provider styles:

A local program that reads the prompt from standard input, a compatible chat API that can run locally or remotely, and a hosted provider's own API.

This lets users choose between different deployment and privacy models.

### Dry-run support

The new <code>--dry-run</code> option is especially useful for inspection.

It can show the exact prompt, evidence selection, destination, and highest estimated cost based on prices configured by the user — without contacting the AI provider.

That makes it easier to understand what would be sent before anything is actually transmitted.

### Privacy and safety controls

AI configuration lives in the user's own configuration.

A repository's configuration cannot silently turn on AI or enable a remote provider.

A provider endpoint outside the local machine is refused unless the user explicitly allows remote AI.

API keys are obtained through environment variables and are not stored by RepoDNA.

Source excerpts are also optional. When enabled, only limited excerpts are used, likely secrets are redacted, and contributor names and email addresses are not sent.

The model does not receive tools through RepoDNA, so it cannot execute commands, read additional files, or access the network through the application.

### AI remains optional

RepoDNA remains useful without AI.

The core repository analysis continues to provide the structured information, evidence, findings, history, architecture, dependencies, quality signals, security signals, and other codebase intelligence that form the project's foundation.

The AI feature simply provides another way to understand those results.

### Install RepoDNA v1.1.0

From source:

<pre tabindex="0"><code>cargo install --git https://github.com/sanskarIN/RepoDNA --tag v1.1.0 --locked repodna-cli
</code></pre>

With Docker:

<pre tabindex="0"><code>docker run --rm -v "$PWD:/work" ghcr.io/sanskarin/repodna:1.1.0 analyze .
</code></pre>

Platform downloads and checksums are available through the v1.1.0 release.

### Why this release matters

The goal of RepoDNA is not merely to produce more data.

It is to make a codebase understandable.

v1.1.0 moves the project closer to that goal by adding an optional natural-language explanation layer while preserving evidence, provenance, privacy controls, and user choice.

### Images for this article

<strong>Hero:</strong> <code>docs/images/v1.1.0/desktop/overview-light.png</code>

<strong>Supporting:</strong> <code>docs/images/v1.1.0/desktop/architecture-dark.png</code>

<strong>Optional:</strong> <code>docs/images/v1.1.0/phone/overview-light.png</code>

<strong>Hero alt text:</strong><br>
“RepoDNA v1.1.0 overview showing repository intelligence and analysis results.”

<strong>SEO description:</strong><br>
“RepoDNA v1.1.0 introduces optional AI explanations grounded in analysis evidence, with citations, provenance, dry-run support, provider choices, and privacy controls.”

---

## POST 4 — COMBINED MILESTONE ARTICLE

<strong>Title:</strong> From First Stable Release to v1.2.0: The Evolution of RepoDNA

<strong>Suggested slug:</strong> <code>repodna-from-v1-0-0-to-v1-2-0</code>

<strong>Suggested date:</strong> October 5, 2026

<strong>Excerpt:</strong><br>
RepoDNA has evolved from its first stable release into a broader repository intelligence platform with evidence-grounded AI explanations, maintenance refinements, GitHub Packages distribution, a self-hostable web interface, and stronger mobile support.

### RepoDNA: From v1.0.0 to v1.2.0

On September 27, 2026, RepoDNA reached its first stable release.

Less than two weeks later, the project has moved through <strong>v1.1.0, v1.1.1, and v1.2.0</strong>, each release building on the previous one.

This is the story of that progression.

The central idea has remained the same throughout:

<strong>Understand your codebase. See its DNA.</strong>

### v1.0.0 — The first stable release

RepoDNA v1.0.0 established the project's foundation as a local-first repository intelligence and code archaeology tool.

The release could analyze directories, Git URLs, and archives through quick, standard, and deep analysis profiles.

It introduced broad repository analysis covering structure, languages, architecture, dependencies, Git history, contributors, change hotspots, repository evolution, complexity, duplicated and similar code, documentation, testing, build systems, security signals, and more.

The first stable release included support for <strong>65 built-in languages</strong>, with lexical analysis available for a subset of those languages.

It also introduced the RepositoryDNA artifact, versioned JSON output, reproducible analysis support, Project DNA cards, badges, reports, onboarding guides, portable <code>.repodna</code> exports and imports, and privacy presets.

The release shipped a command-line interface, a Tauri desktop application for Linux, macOS, and Windows, a local web interface, and a container image.

Most importantly, RepoDNA's core philosophy was established: conclusions should be backed by evidence.

### v1.1.0 — Adding an explanation layer

The next major step arrived on October 4 with v1.1.0.

This release introduced <strong>optional AI explanations</strong>.

Instead of allowing an AI system to freely explore a repository, RepoDNA first performs its own analysis and then selects evidence for the model.

The model can explain the repository, architecture, history, dependencies, onboarding, modules, hotspots, or direct questions.

Generated explanations include provenance information and are checked against the evidence supplied to the model.

Unsupported citations are removed, unsupported statements are identified, and model-generated inferences are labeled.

The release also introduced configurable local and remote provider options, dry-run support, caching, explicit remote-AI permission, environment-based API keys, optional source excerpts, and stronger privacy boundaries.

The guiding idea was that AI should explain the analysis — not replace the analysis.

### v1.1.1 — Refinement and maintenance

On October 5, RepoDNA v1.1.1 followed with a maintenance release.

This version focused on correctness and polish rather than introducing another major subsystem.

It improved the behavior of <code>repodna config path</code>, handled local AI processes more reliably, corrected architecture wording, improved singular counts, refined onboarding messages, fixed command punctuation, clarified repository-root changes, refined the Architecture view, and expanded documentation.

It also added more visible links to Sanskar's other open-source projects.

These changes may look small individually, but together they make RepoDNA more consistent and easier to use.

### v1.2.0 — Broader distribution and a better web experience

On October 5, 2026, RepoDNA reached <strong>v1.2.0</strong>.

This release expands the way developers can obtain and deploy RepoDNA.

A dedicated web interface container is now available as:

<code>ghcr.io/sanskarin/repodna-web</code>

The release also publishes npm packages through GitHub Packages, including the main RepoDNA package, the schema package, and the visualization package.

But distribution is only one part of the release.

v1.2.0 also focuses heavily on the user interface.

Navigation is more suitable for narrow screens, the top bar works better on phones, commands can be copied directly from the interface, tables are easier to sort, search results are clearer, report paths wrap correctly, chart tooltips behave better on small screens, and several interface components received accessibility and interaction improvements.

The result is a release that makes RepoDNA easier to install, easier to run, and easier to use across different screen sizes.

### Four releases, one direction

Looking across the releases, the progression is clear:

<strong>v1.0.0</strong> established repository intelligence.

<strong>v1.1.0</strong> added evidence-grounded AI explanations.

<strong>v1.1.1</strong> strengthened reliability and polish.

<strong>v1.2.0</strong> expanded distribution and significantly refined the responsive web experience.

The project is therefore growing in several dimensions at once:

<strong>Analysis → Explanation → Refinement → Accessibility and Distribution</strong>

Yet the foundation remains unchanged.

RepoDNA is still built around analyzing repositories locally, producing structured information, preserving evidence, and giving developers ways to understand a codebase more deeply.

### What comes next?

With the v1.2.0 milestone, RepoDNA has a stronger base for future releases.

The project now has:

- a stable analysis foundation

- optional evidence-grounded AI explanations

- CLI and desktop applications

- a local web interface

- container distribution

- GitHub Packages distribution

- responsive web and report experiences

- portable RepositoryDNA artifacts

- Project DNA cards and repository comparisons

The next releases can build on that foundation rather than having to establish it.

### Try RepoDNA

Explore the latest release, inspect the source code, read the release history, or run RepoDNA against a repository of your own.

The project is open source, local-first, and designed to make codebases easier to understand.

<strong>RepoDNA:</strong> Understand your codebase. See its DNA.

### Suggested release timeline

<strong>September 27, 2026 — v1.0.0</strong><br>
The first stable release.

<strong>October 4, 2026 — v1.1.0</strong><br>
Optional evidence-grounded AI explanations.

<strong>October 5, 2026 — v1.1.1</strong><br>
Maintenance and reliability improvements.

<strong>October 5, 2026 — v1.2.0</strong><br>
GitHub Packages, web container distribution, and major responsive UI improvements.

### Images for the combined article

<strong>Hero image:</strong> <code>docs/media/promo/launch-16x9.png</code>

<strong>Release gallery:</strong>

1. <code>docs/images/v1.0.0/desktop/overview-light.png</code>

1. <code>docs/images/v1.1.0/desktop/overview-light.png</code>

1. <code>docs/images/v1.1.1/desktop/overview-light.png</code>

1. <code>docs/images/v1.2.0/desktop/overview-light.png</code>

<strong>Gallery captions:</strong>

- “RepoDNA v1.0.0 — the first stable release”

- “RepoDNA v1.1.0 — evidence-grounded AI explanations”

- “RepoDNA v1.1.1 — maintenance and refinement”

- “RepoDNA v1.2.0 — expanded distribution and responsive improvements”

<strong>Hero alt text:</strong><br>
“RepoDNA release journey showing the project evolving from v1.0.0 to v1.2.0 across desktop and mobile experiences.”

<strong>SEO description:</strong><br>
“Explore how RepoDNA evolved from its first stable v1.0.0 release through evidence-grounded AI, maintenance improvements, and the v1.2.0 web and package distribution milestone.”
