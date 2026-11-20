---
title: "frametrellis-v1-5-1-stable-release"
description: "FrameTrellis v1.5.1 improves export controls, rendering reliability, playback precision, and media safety in the free, local-first video editor."
date: 2026-11-20T15:57:48+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/frametrellis-v1-5-1-stable-release/0963479e9f209851.png"
image_alt: "FrameTrellis v1.5.1 stable maintenance release announcement featuring the official logo, decorative editing timeline, and improvements to export reliability and playback precision."
image_width: 1200
image_height: 630
tags: ["frametrellis", "open-source", "video-editing", "c++", "software-releases"]
source_issue: 123
---
## FrameTrellis v1.5.1 Released — Better Exports, Safer Playback and Improved Stability

FrameTrellis v1.5.1 is officially available as a stable maintenance update to the free and open-source desktop video editor.

Following the featured v1.5.0 release, this update focuses on refining the existing experience, improving native media safety, and strengthening export reliability.

### A More Reliable Editing Experience

FrameTrellis is designed for creators who want precise multi-track editing without depending on cloud services.

Built using C++20, Qt 6/QML, MLT, and FFmpeg, the editor offers local video processing, multi-track editing, source monitoring, subtitle workflows, and MP4 exports.

Version 1.5.1 continues that direction with targeted maintenance improvements.

### What's New in v1.5.1?

#### Improved Export Interface

The Export Video dialog has been refined to improve readability and navigation.

Export presets, output paths, encoder controls, audio settings, and other options are arranged more predictably. Smaller windows also support scrolling while retaining access to the export action.

#### Rendering and Export Reliability

The rendering pipeline now performs additional checks around progress reporting, expected frame counts, output duration, invalid dimensions, and completion states.

These safeguards make the application more defensive when unexpected input or rendering behavior occurs.

#### Playback Precision

Playback transport now handles frame calculations and large seek operations more carefully, reducing the risk of precision loss or integer overflow.

#### Safer Media Handling

Additional checks strengthen preview decoding, audio data validation, waveform processing, thumbnail generation, and timecode input handling.

#### Expanded Testing

The project includes additional automated tests covering native rendering, graphical controls, media processing, and supported platform build workflows.

### Download FrameTrellis v1.5.1

Windows users can download the official x64 installer or portable ZIP from GitHub.

<strong>GitHub release:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis/releases/tag/v1.5.1" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis/releases/tag/v1.5.1</a>

<strong>Project website:</strong><br>
<a href="https://sanskarin.github.io/frametrellis/" rel="noopener noreferrer">https://sanskarin.github.io/frametrellis/</a>

Linux and macOS users can build the application from source using the documented dependencies.

### Before You Upgrade

Back up your important FrameTrellis project files before upgrading.

The Windows distribution is unsigned, so users should check the release's SHA-256 checksums before installation.

Previously reported Windows long-export crashes and an intermittent Windows 11 ARM startup issue remain under investigation. This release does not claim a complete resolution of either problem.

### Open Source and Community

FrameTrellis is licensed under GPL-3.0-or-later and welcomes feedback, testing, issue reports, and contributions.

<strong>Source code:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis</a>

<strong>Support development:</strong><br>
<a href="https://buymeacoffee.com/sanskarIN" rel="noopener noreferrer">https://buymeacoffee.com/sanskarIN</a>

FrameTrellis development continues, with a focus on stability, editing capabilities, and practical creative workflows.

<strong>FrameTrellis — Precise, local-first video editing.</strong>
