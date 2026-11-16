---
title: "repodna-v1-5-1-stable-release-reliability-security-improvements"
description: "RepoDNA v1.5.1 is now stable! This release improves saved-analysis recovery, artifact validation, storage reliability, and Git security for safer, more dependable local-first repository analysis."
date: 2026-11-16T13:23:50+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/repodna-v1-5-1-stable-release-reliability-security/8b467d586bd1501e.png"
image_alt: "RepoDNA v1.5.1 stable release banner featuring the official RepoDNA branding, a dark blue background, a code dependency graph, and a focus on local-first reliability."
image_width: 1200
image_height: 630
tags: ["repodna", "open-source", "developer-tools", "software-engineering", "release-updates"]
source_issue: 117
---
## RepoDNA v1.5.1 Stable Release — Recovery, Validation, and Git Security

<strong>Published: November 16, 2026</strong>

RepoDNA v1.5.1 is now available as a stable maintenance release.

This update improves local analysis recovery, storage reliability, artifact validation, and Git remote security.

#### Release highlights

- Saved JSON analyses remain preserved when resetting the SQLite cache.

- The <code>repodna cache repair</code> command can restore indexing.

- Storage cleanup is more accurate when unindexed artifacts exist.

- Malformed imported analysis files are rejected.

- Git error diagnostics redact embedded HTTP(S) credentials.

- Git remote validation blocks disguised private and special-use IP addresses by default.

RepoDNA is a free, open-source, local-first platform for understanding software repositories through architecture, dependencies, historical insights, and evidence-backed findings.

<strong>Download:</strong> <a href="https://github.com/sanskarIN/RepoDNA/releases/tag/v1.5.1" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA/releases/tag/v1.5.1</a>

<strong>Try in browser:</strong> <a href="https://sanskarin.github.io/RepoDNA/" rel="noopener noreferrer">https://sanskarin.github.io/RepoDNA/</a>

<strong>Source code:</strong> <a href="https://github.com/sanskarIN/RepoDNA" rel="noopener noreferrer">https://github.com/sanskarIN/RepoDNA</a>

This release strengthens existing functionality rather than introducing major new features.
