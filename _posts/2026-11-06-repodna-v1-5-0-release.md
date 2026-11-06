---
title: "repodna-v1-5-0-release"
description: "RepoDNA v1.5.0 adds confirmed analysis-history deletion, safer findings export reviews, clearer CI impact and more reliable comparisons."
date: 2026-11-06T04:48:01+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-5-0-release/7c623ecf1e3b3e6e.png"
image_alt: "RepoDNA v1.5.0 stable release banner featuring the official blue and teal DNA logo on a dark navy background. The graphic highlights improved analysis history management, safer findings exports, clearer CI impact analysis, and more reliable repositor"
image_width: 1200
image_height: 630
tags: ["repodna", "open-source", "rust", "developer-tools", "code-analysis"]
source_issue: 84
---
## RepoDNA v1.5.0 Released: More Control, Clearer Evidence, Safer Workflows

<strong>Published:</strong> November 6, 2026

RepoDNA v1.5.0 is now available as a <strong>stable GitHub release</strong>!

RepoDNA is an open-source, local-first repository intelligence tool that helps developers understand codebases through architecture, dependencies, Git history, code quality, and evidence-backed findings.

This release focuses on giving developers more control over their saved analysis data, improving the review process before exporting findings, and making codebase comparisons more reliable.

### What's New in RepoDNA v1.5.0?

#### 1. Better Analysis History Management

RepoDNA now supports deleting individual saved analyses or the locally stored analysis history for an entire repository.

Deletion requires confirmation, and the original repository source files remain unchanged.

This makes cleaning up previous analyses easier and safer.

#### 2. Review Findings Before Exporting

Before exporting selected findings as CSV, JSON, or Markdown, RepoDNA now provides a local preview and asks for explicit confirmation.

This gives developers an opportunity to inspect the information they are about to export.

The preview does not automatically detect or redact sensitive information, so exports should still be reviewed before external sharing.

#### 3. Clearer CI Impact Analysis

Repository changes are easier to understand with improved CI baseline comparisons.

RepoDNA now includes additional context such as:

- Before-and-after module ownership.

- Affected file paths.

- Immediate dependency context.

- More informative impact summaries.

These improvements help developers investigate how changes affect their codebase's architecture.

#### 4. More Reliable Comparisons

Version 1.5.0 improves deterministic comparisons, particularly when handling duplicate findings and ambiguous imported paths.

The objective is to make analysis results more consistent and reproducible.

#### 5. Improved Windows Metadata and Release Reliability

Windows executable and installer metadata now identifies the company as <strong>RepoDNA</strong> instead of GitHub.

The release also includes stronger dependency and packaging validation.

### Download RepoDNA v1.5.0

<strong>Official GitHub Release:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.5.0" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.5.0</a>

<strong>Try RepoDNA Online:</strong><br>
<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>GitHub Repository:</strong><br>
<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

You can install the CLI using npm:

<pre tabindex="0"><code>npm install --global @sanskarin/repodna
</code></pre>

RepoDNA provides options for Windows, macOS, Linux, and the web. Some local history-management capabilities require the desktop or local-server environment.

### What's Next for RepoDNA?

RepoDNA will continue improving repository intelligence, developer workflows, and evidence-backed codebase analysis.

Contributions, bug reports, suggestions, and feedback are welcome.

<strong>RepoDNA — Understand your codebase. See its DNA.</strong>

Support development:<br>
<a href="https://buymeacoffee.com/sanskarIN" rel="noopener noreferrer">https://buymeacoffee.com/sanskarIN</a>
