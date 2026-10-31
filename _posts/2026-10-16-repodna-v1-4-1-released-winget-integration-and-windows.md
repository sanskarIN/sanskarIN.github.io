---
title: "RepoDNA v1.4.1 Released — WinGet Integration and Windows Packaging Improvements"
description: "RepoDNA v1.4.1 adds WinGet-ready manifests for Windows desktop and CLI packages, automated checksums, submission tooling, and regression tests. Catalog approval is still required."
date: 2026-10-16T03:29:33+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-4-1-released-winget-integration-and-windows/9dc71ff5244bf493.png"
image_alt: "RepoDNA official wordmark with its blue and teal DNA logo and the tagline “Understand your codebase. See its DNA.”"
image_width: 1280
image_height: 320
tags: ["repodna", "open-source", "winget", "rust", "developer-tools"]
source_issue: 37
---
## RepoDNA v1.4.1 Released

<strong>Released: October 16, 2026</strong>

RepoDNA v1.4.1 is now available, introducing a new foundation for installing and updating the application through Windows Package Manager (WinGet).

This release focuses on improving Windows distribution, package validation, and release automation.

### Release highlights

<strong>WinGet-ready packaging</strong>

RepoDNA now generates WinGet manifests for the Windows desktop application and command-line tool.

Both x64 and ARM64 architectures are supported.

<strong>Automated integrity checks</strong>

Release packaging now calculates SHA-256 checksums from the actual built installers and archives.

<strong>Submission automation</strong>

A new optional workflow helps maintainers submit WinGet manifests to Microsoft's community repository for review.

<strong>Expanded testing</strong>

Additional regression tests verify package metadata, executable paths, checksums, architectures, and version handling.

### Availability

RepoDNA v1.4.1 can be obtained from GitHub Releases.

WinGet installation and upgrade support will become available after the relevant package manifests are accepted and indexed in Microsoft's public catalog.

### About RepoDNA

RepoDNA is an open-source, local-first codebase intelligence platform for exploring repository architecture, dependencies, history, complexity, and other development insights.

It is designed to help developers understand software projects without requiring them to upload their repositories.

### Get started

<strong>Download:</strong> <a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.1" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.4.1</a>

<strong>Web application:</strong> <a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>Documentation:</strong> <a href="https://sanskarin.github.io/RepoDNA/docs/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/docs/</a>

<strong>Source code:</strong> <a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

Contributions, feedback, and issue reports are welcome.
