---
title: "frametrellis-v1-2-2-faster-exports"
description: "Discover FrameTrellis v1.2.2 with faster H.264 export presets, Turbo 720p previews, no-upscale controls, live FPS information, and improved MP4 validation."
date: 2026-10-21T10:01:07+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/frametrellis-v1-2-2-faster-exports/420443b886a29242.png"
image_alt: "FrameTrellis v1.2.2 stable release announcement graphic highlighting faster H.264 exports, smarter resolution controls, and local-first open-source video editing."
image_width: 1920
image_height: 1080
tags: ["frametrellis", "open-source", "video-editing", "c++", "software-release"]
source_issue: 43
---
## FrameTrellis v1.2.2 Released — Faster Exports and Smarter Rendering

<strong>Published: October 21, 2026</strong>

FrameTrellis v1.2.2 is now available as a stable release on GitHub.

This update focuses on improving video export workflows through speed-oriented H.264 presets, resolution controls, and stronger output verification.

FrameTrellis is a free, open-source desktop video editor built with C++20, Qt 6/QML, MLT, and FFmpeg. It follows a local-first design, allowing users to edit their media without uploading it to a cloud service.

### What's new in v1.2.2?

#### Faster H.264 export profiles

The release introduces Quick and Turbo export options for different output needs.

The Quick project-resolution preset uses H.264 <code>veryfast</code> with CRF 22.

Quick up-to-1080p and Turbo up-to-720p profiles offer more convenient ways to create smaller or speed-focused exports.

#### Smarter resolution controls

An optional no-upscale setting helps avoid unnecessary enlargement when exporting video.

The same policy can also be applied through the separate rendering helper using <code>--no-upscale</code>.

#### Improved export progress

The export window now displays average rendering FPS alongside progress and estimated remaining time.

#### Stronger output validation

New regression tests cover export policies, output dimensions, AAC audio retention, and helper-process behavior.

The renderer also verifies the final MP4 dimensions before replacing an existing output.

### Availability

Windows 10 (1809 or later) and Windows 11 x64 users can download the installer or portable ZIP.

Linux users can build from source.

macOS packages are not currently available.

Windows downloads are unsigned, and SHA-256 checksums are provided for verification.

### Download and contribute

<strong>Download v1.2.2:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis/releases/tag/v1.2.2" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis/releases/tag/v1.2.2</a>

<strong>Source code:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis</a>

<strong>Project website:</strong><br>
<a href="https://sanskarin.github.io/frametrellis/" rel="noopener noreferrer">https://sanskarin.github.io/frametrellis/</a>

FrameTrellis remains free and open source under GPL-3.0-or-later.

Feedback, bug reports, and code contributions are welcome as development continues.
