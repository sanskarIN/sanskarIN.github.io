---
title: "RepoDNA v1.4.5 Released — Evidence Intelligence and Reliability Improvements"
description: "RepoDNA v1.4.5 improves reproducible offline evidence ranking and diagnostics, following v1.4.4's native explanations, findings exports, and local-first reliability updates."
date: 2026-10-30T09:34:27+00:00
last_modified_at: 2026-10-31T14:16:22+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-4-5-release/ff0261d9bdf599f3.png"
image_alt: "Wide RepoDNA v1.4.5 release banner featuring the official logo and blue-and-teal DNA illustration, promoting local-first repository intelligence."
image_width: 1600
image_height: 900
tags: ["repodna", "open-source", "rust", "developer-tools", "ai"]
source_issue: 49
---
## RepoDNA v1.4.5 Released: Native Evidence Intelligence and Reliability Improvements

<strong>Published: October 30, 2026</strong>

RepoDNA has reached another stable milestone with the release of <strong>v1.4.5</strong>, following v1.4.4 on October 28.

These releases strengthen RepoDNA's local-first repository intelligence capabilities, introducing native extractive explanations, locally trainable evidence ranking, better evaluation tools, and additional reliability improvements.

### What's New in v1.4.4?

#### Native Offline Explanations

RepoDNA now supports an optional built-in native explanation provider.

This feature works locally without requiring a third-party model API key or external model runtime.

It produces extractive explanations grounded in repository analysis evidence.

#### Locally Trainable Evidence Ranking

A CPU-only evidence-relevance ranker allows developers to train small, versioned ranking checkpoints from labeled examples.

This makes it possible to experiment with evidence selection locally and evaluate the effect of different ranking configurations.

#### Better Findings and Exports

The Findings interface supports confidence filtering and exports to CSV, JSON, and Markdown.

These improvements make it easier to inspect findings and use repository analysis results in development workflows.

#### Security and Reliability

v1.4.4 also strengthens browser import safeguards, local API response validation, release-package checks, and HTTPS certificate-trust testing.

### What's New in v1.4.5?

#### Reproducible Training

The latest release improves deterministic training behavior, repository identity checks, and evidence dataset validation.

#### Improved Evaluation

New diagnostics include Brier scores, binary log loss, calibration bands, and answerability threshold sweeps.

These capabilities make it easier to investigate the quality of local evidence relevance scores and explore evaluation tradeoffs.

#### Stronger Tests

Expanded regression coverage checks native ranker training, checkpoint generation, deterministic exports, overwrite protection, and repository separation.

These improvements strengthen the reliability of RepoDNA's native evidence-ranking workflow.

### How to Use RepoDNA

RepoDNA supports several development workflows, including command-line analysis, desktop applications, a browser interface, and CI integration.

The latest release includes downloads for Windows, Linux, and macOS.

You can also use the web application without installing the desktop application.

### Get RepoDNA v1.4.5

<strong>Latest release:</strong>

<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.5" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.5</a>

<strong>Previous release:</strong>

<a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.4" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.4</a>

<strong>Online application:</strong>

<a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>Source code:</strong>

<a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

### Continuing Development

RepoDNA will continue evolving as a local-first repository intelligence platform.

The direction remains focused on useful analysis, transparent evidence, reliable developer workflows, and better ways to understand complex repositories.

<strong>RepoDNA — Understand your codebase. See its DNA.</strong>
