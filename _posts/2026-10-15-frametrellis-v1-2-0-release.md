---
title: "frametrellis-v1-2-0-release"
description: "FrameTrellis v1.2.0 introduces multi-clip duplication, attribute copy/paste, batch mute, and frame-accurate editing to the open-source C++ video editor."
date: 2026-10-15T14:14:56+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/frametrellis-v1-2-0-release/f55e259561eda99e.png"
image_alt: "FrameTrellis v1.2.0 release illustration featuring multi-track duplication"
image_width: 1600
image_height: 900
tags: ["frametrellis", "c++", "video-editing", "open-source", "qt6"]
source_issue: 36
---
## FrameTrellis v1.2.0 Released — Batch Timeline Editing

<strong>Published: October 15, 2026</strong>

FrameTrellis v1.2.0 is now available on GitHub.

This release introduces significant improvements to multi-clip timeline editing, allowing users to perform more operations across video and audio clips in a single action.

### Release highlights

<strong>Multi-clip duplication:</strong> Duplicate multiple selected clips across tracks while preserving their relative timing and synchronization.

<strong>Clip attribute clipboard:</strong> Copy and paste audio and picture adjustments without changing the original media or clip timing.

<strong>Batch editing:</strong> Mute, unmute, or reset picture adjustments across multiple selected clips.

<strong>Frame-accurate movement:</strong> Move selected clips together in one-frame or ten-frame increments.

<strong>Reliability:</strong> Improved validation, atomic undoable operations, documentation, and automated regression tests.

### Built for local-first editing

FrameTrellis is developed using C++20, Qt 6/QML, MLT, and FFmpeg.

It remains free and open source under the GPL-3.0-or-later license. Users can work with their media locally without mandatory cloud processing.

### Download and compatibility

Windows x64 installer and portable ZIP packages are available through GitHub Releases.

Linux users can build from source. macOS is not yet officially supported.

Current export support is limited to MP4 using H.264/AAC.

### Explore FrameTrellis

<strong>Download v1.2.0:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis/releases/tag/v1.2.0" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis/releases/tag/v1.2.0</a>

<strong>Source code:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis</a>

<strong>Project website:</strong><br>
<a href="https://sanskarin.github.io/frametrellis/" rel="noopener noreferrer">https://sanskarin.github.io/frametrellis/</a>

Feedback, contributions, and bug reports are welcome as development continues.
