---
title: "frametrellis-v1-1-1-released"
description: "FrameTrellis v1.1.1 improves title creation, adds safer locked-track handling, enhances user feedback, and strengthens MP4 export testing. Windows downloads are available."
date: 2026-10-15T10:44:15+00:00
author: "Sanskar"
author_url: "/about/"
author_login: "sanskarIN"
image: "/assets/images/blog/frametrellis-v1-1-1-released/ee09987f3cc1db22.png"
image_alt: "FrameTrellis v1.1.1 release banner featuring the project logo, editing timeline illustration, and maintenance update highlights."
image_width: 1600
image_height: 900
tags: ["frametrellis", "open-source", "video-editing", "c++", "software-releases"]
source_issue: 32
---
## FrameTrellis v1.1.1 Released: Safer Titles and Improved Export Testing

<strong>October 15, 2026</strong>

FrameTrellis v1.1.1 is officially available on GitHub!

This maintenance release focuses on improving title creation, providing clearer editing feedback, and strengthening automated testing.

FrameTrellis is an open-source, local-first desktop video editor built with C++20, Qt/QML, MLT, and FFmpeg.

### What's improved in v1.1.1?

#### Safer title creation

The editor now checks whether an unlocked video track is available before allowing a title to be created through the Create Title dialog.

This helps prevent titles from being generated without being placed on the timeline.

#### Improved editing feedback

The title creation dialog now remains open if timeline insertion fails. It closes only after the title has been successfully placed.

#### Stronger MP4 export tests

New end-to-end regression testing verifies that transparent PNG title overlays and the underlying video are visible in the decoded MP4 output.

#### Expanded GUI testing

Additional automated tests cover locking and unlocking video tracks during title creation.

### Download FrameTrellis

FrameTrellis v1.1.1 is available for Windows 10/11 x64 as an installer or portable ZIP.

Linux users can build the application from source. macOS support is still planned.

Existing <code>.ftproj</code> projects remain compatible.

<strong>Download:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis/releases/tag/v1.1.1" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis/releases/tag/v1.1.1</a>

<strong>Project website:</strong><br>
<a href="https://sanskarin.github.io/frametrellis/" rel="noopener noreferrer">https://sanskarin.github.io/frametrellis/</a>

<strong>Source code:</strong><br>
<a href="https://github.com/sanskarIN/frametrellis" rel="noopener noreferrer">https://github.com/sanskarIN/frametrellis</a>

FrameTrellis remains free and open source under GPL-3.0-or-later.

If you're interested in the project, consider exploring the repository, reporting issues, or contributing to its development.

<strong>FrameTrellis — Building a more reliable, local-first video editing experience.</strong>
