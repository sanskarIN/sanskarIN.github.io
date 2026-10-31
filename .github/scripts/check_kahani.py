#!/usr/bin/env python3
"""Check the Jekyll-rendered Hindi story pages without Node-specific test code."""

import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

PAGES = ("Kahani/index.html", "About-Kahani-Videos/index.html")


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def check_site(root):
    catalogue = None
    for name in PAGES:
        path = root / name
        markup = path.read_text(encoding="utf-8")
        require(bool(re.search(r'<html lang="hi"', markup)),
                f"{name}: Hindi page language")
        require("Kahani by Ram Sandesh" in markup, f"{name}: author credit")
        require('<meta name="author" content="Ram Sandesh"' in markup,
                f"{name}: author metadata")
        require(len(re.findall(r"<h1(?:\s|>)", markup)) == 1,
                f"{name}: one primary heading")
        anchors = re.findall(r'\bid="([^"]+)"', markup)
        require(len(set(anchors)) == len(anchors), f"{name}: unique anchors")
        require(not re.search(r"<iframe\b|youtube\.com/@KisseByRamSandesh", markup),
                f"{name}: no unverified channel/player")
        for url in re.findall(r'(?:src|href)="(/assets/[^"?#]+)(?:[^" ]*)"', markup):
            decoded = unquote(url).lstrip("/")
            asset = (root / decoded).resolve()
            require(asset.is_relative_to(root.resolve()) and asset.is_file(),
                    f"{name}: missing or unsafe local asset {url}")
        require("Content-Security-Policy" in markup, f"{name}: site CSP preserved")
        if name == PAGES[0]:
            catalogue = markup

    require("data-story-filters hidden" in catalogue,
            "filters progressively enabled by TypeScript")
    require(bool(re.search(r'data-story-status="(?:production|published)"', catalogue)),
            "explicit episode publication state")
    require(not re.search(r'<a\b[^>]*\bhref="\s*"', catalogue),
            "no empty links after publication updates")
    search = json.loads((root / "search.json").read_text(encoding="utf-8"))
    for url in ("/Kahani/", "/About-Kahani-Videos/"):
        require(any(item.get("url") == url for item in search),
                f"missing search entry: {url}")
    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    for url in ("https://sanskarin.github.io/Kahani/",
                "https://sanskarin.github.io/About-Kahani-Videos/"):
        require(url in sitemap, f"missing sitemap entry: {url}")
    print("Kahani: routes, metadata, local assets, publication state, search and sitemap passed.")


if __name__ == "__main__":
    check_site(Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve())
