---
title: "RepoDNA v1.3.1: Analyze Your Codebase Directly in the Browser"
description: "Discover RepoDNA v1.3.1, featuring browser-based codebase analysis with WebAssembly, private local analysis, report exports, and a GitHub Action."
date: 2026-10-10T15:55:05+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-3-1-analyze-your-codebase-directly-in-the-browser/8ce8b52a8cba3343.png"
image_alt: "RepoDNA 1.3.1 launch image with the headline “Understand your codebase. See its DNA.” It highlights browser-based analysis with nothing uploaded, shows the command npm install --global @sanskarin/repodna, and includes the RepoDNA interface on a deskt"
image_width: 2000
image_height: 1125
tags: ["repodna", "open-source", "webassembly", "rust-developer", "tools"]
source_issue: 18
---
## RepoDNA v1.3.1: Analyze Your Codebase Directly in the Browser

<strong>Understand your codebase. See its DNA.</strong>

I'm excited to share <strong>RepoDNA v1.3.1</strong>, the latest release of my open-source, local-first repository intelligence and code archaeology project.

Software repositories contain much more than source code. They contain architectural decisions, dependency relationships, project history, development patterns, and clues about where future maintenance may be needed.

RepoDNA helps developers explore that information through interactive analysis, evidence-backed findings, historical timelines, architecture maps, and shareable Project DNA reports.

The biggest highlight of v1.3.1 is the ability to analyze a local folder or supported archive directly in the browser using WebAssembly.

### What's new in RepoDNA v1.3.1?

#### 1. Analyze repositories in your browser

You can now choose a local folder or a supported archive and analyze it directly in the RepoDNA web version.

The analysis runs in your browser using WebAssembly. Your project files aren't uploaded to a server during this process, and you don't need to install the command-line application just to try the browser experience.

The browser-based analysis does not include Git history, which requires the command-line or desktop version.

#### 2. Generate reports and Project DNA cards

Understanding a repository is useful, but sharing the results matters too.

RepoDNA's web version can generate HTML and Markdown reports and display a Project DNA card that can be downloaded as SVG or PNG.

These outputs help developers communicate the structure and characteristics of a codebase without having to explain every directory and component manually.

#### 3. Continue working offline

After the web version has loaded, it can continue working offline using its cached interface and analysis program.

This makes it useful when you want to explore a repository without maintaining a constant internet connection.

#### 4. Automate analysis with GitHub Actions

RepoDNA also provides an official GitHub Action.

You can integrate repository analysis into your CI workflow, display findings as file annotations, inspect workflow summaries, preserve analysis artifacts, and configure the severity at which a job should fail.

This makes RepoDNA useful not only for exploring a project manually, but also for incorporating codebase checks into an automated development process.

<strong>Explore the action:</strong> <a href="https://github.com/marketplace/actions/repodna" rel="noopener noreferrer">https://github.com/marketplace/actions/repodna</a>

#### 5. More platform support and desktop improvements

Version 1.3.1 adds Windows on Arm support for the command-line application and desktop app, along with improvements to saving desktop reports and Project DNA cards.

It also provides the <code>@sanskarin/repodna-wasm</code> package for using RepoDNA's analysis capabilities through WebAssembly in Node.js and browser environments.

### What can RepoDNA help you understand?

RepoDNA is designed to help answer practical questions about a project:

- How is the codebase organized?

- Which modules and packages depend on one another?

- Which files change frequently and deserve a closer look?

- How has the project evolved through its Git history?

- What quality and security signals should developers investigate?

- How can a repository's findings be documented and shared?

Rather than treating a single score as the entire story, RepoDNA connects findings to supporting files, lines, commits, and measurements. Its analysis is descriptive, and its findings should be interpreted in the context of the project.

### Privacy and local-first development

Privacy is an important part of RepoDNA's design.

The browser version analyzes the files you select locally in the browser. It does not upload those project files for analysis. RepoDNA also avoids telemetry and does not require an account to use its core analysis features.

As always, review the project's documentation and privacy guidance before using any development tool with sensitive repositories.

### Try RepoDNA v1.3.1

You can explore the latest version through these links:

<strong>Try the web version:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>Explore the GitHub repository:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

<strong>Read the v1.3.1 release notes and downloads:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.1" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.3.1</a>

<strong>Find RepoDNA on GitHub Marketplace:</strong><br>
<a href="https://github.com/marketplace/actions/repodna" rel="noopener noreferrer">https://github.com/marketplace/actions/repodna</a>

<strong>Browse screenshots and promotional images:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/blob/images/media/README.md" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/blob/images/media/README.md</a>

### What's next?

RepoDNA is an ongoing open-source project. My goal is to make codebases easier to understand, maintain, investigate, and share through transparent analysis and useful developer tools.

If you work with large repositories, multiple programming languages, unfamiliar projects, or automated development workflows, I would love to hear about your experience.

<strong>What would help you most when exploring a codebase: architecture maps, dependency analysis, project history, code-quality hotspots, or automated CI findings?</strong>

Share your thoughts, explore the project, and follow its development on GitHub.

<em>Built by Sanskar. Open source, local-first, and evidence-first.</em>
