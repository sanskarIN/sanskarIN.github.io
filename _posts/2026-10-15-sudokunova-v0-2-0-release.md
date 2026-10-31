---
title: "sudokunova-v0-2-0-release"
description: "SudokuNova v0.2.0 introduces expanded cross-platform builds, validated puzzle sharing, imported-game restoration, and release automation for the open-source Sudoku project."
date: 2026-10-15T04:11:02+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/sudokunova-v0-2-0-release/ab8b91ec68ff718a.png"
image_alt: "SudokuNova v0.2.0 release announcement on a dark navy and violet background. Text highlights offline-first Sudoku and cross-platform expansion alongside an illustrated 9-by-9 Sudoku puzzle."
image_width: 1600
image_height: 900
tags: ["sudokunova", "open-source", "kotlin-multiplatform", "sudoku-game", "cross-platform-development"]
source_issue: 26
---
<img src="/assets/images/blog/sudokunova-v0-2-0-release/495c37caa99ab65b.png" alt="SudokuNova v0.2.0 feature illustration titled Share a puzzle. Keep your progress. Three highlighted features include validated puzzle codes, restorable imported games, and local-first gameplay beside an illustrated Sudoku board." width="1600" height="900" loading="lazy" decoding="async">

## SudokuNova v0.2.0 Released — Cross-Platform Sudoku Development Continues

<strong>Published: October 15, 2026</strong>

I'm announcing the release of SudokuNova v0.2.0, the next public milestone of my open-source, offline-first Sudoku project.

SudokuNova aims to combine classic Sudoku gameplay with a modern user interface, robust puzzle validation, local data persistence, and an expanding cross-platform architecture.

### What Is SudokuNova?

SudokuNova is an open-source Sudoku application developed using Kotlin, Jetpack Compose, Kotlin Multiplatform, and Compose Multiplatform.

Its Android application provides a broader feature set, while shared gameplay components are being developed for additional platforms.

The project focuses on Sudoku correctness, maintainable architecture, accessibility, and offline-first functionality.

### What's New in v0.2.0?

#### Improved Puzzle Exchange

Version 0.2.0 includes validated puzzle-code exchange.

The shared Sudoku engine checks imported puzzle data and requires a unique solution before accepting a puzzle.

This provides a more reliable foundation for importing and sharing custom Sudoku challenges.

#### Imported-Game Restoration

The project includes an improved persistence model for imported Sudoku games.

Versioned saved-session data retains the original imported puzzle information, allowing restoration logic to validate the source puzzle rather than incorrectly rebuilding it from a generated seed.

#### Cross-Platform Distribution

The release includes build artifacts targeting:

- Windows

- macOS

- Linux

- WebAssembly/Web

- Android testing

- iOS simulator development

Not every artifact is a production-ready end-user application.

In particular, the Android default APK is a debug/testing build, and the iOS simulator framework is intended for developers. Additional validation is required for production distribution on supported platforms.

#### Release Engineering Improvements

SudokuNova now includes automation for preparing cross-platform release assets.

The process incorporates testing, release-version checks, package validation, and SHA-256 checksum generation.

These safeguards help make the release process more predictable and maintainable.

### Offline-First Gameplay

SudokuNova continues to prioritize local operation.

Core gameplay and the shared persistence foundation do not require users to create a cloud account.

This approach supports a Sudoku experience that can operate independently of a remote gameplay service.

### What's Coming Next?

Development will continue toward improved cross-platform feature parity, better testing coverage, user-interface refinements, accessibility, and reliable platform-specific distribution.

Feedback from testers and contributors will help shape future releases.

### Download and Explore

<strong>Official release:</strong><br>
<a href="https://github.com/sanskarIN/SudokuNova/releases/tag/v0.2.0" rel="noopener noreferrer">https://github.com/sanskarIN/SudokuNova/releases/tag/v0.2.0</a>

<strong>GitHub repository:</strong><br>
<a href="https://github.com/sanskarIN/SudokuNova" rel="noopener noreferrer">https://github.com/sanskarIN/SudokuNova</a>

If you find the project interesting, consider starring the repository or reporting an issue.

<strong>SudokuNova — Think. Solve. Master the Grid.</strong>
