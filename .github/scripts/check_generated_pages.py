#!/usr/bin/env python3
"""Validate the public HTML produced by Jekyll from Python-generated includes."""

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.headings = []
        self.links = []
        self._heading = None

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag == "h2":
            self._heading = []
        if tag == "a" and "href" in attr:
            self.links.append(attr["href"])

    def handle_data(self, value):
        self.text.append(value)
        if self._heading is not None:
            self._heading.append(value)

    def handle_endtag(self, tag):
        if tag == "h2" and self._heading is not None:
            self.headings.append(" ".join(" ".join(self._heading).split()))
            self._heading = None


def scan(path):
    if not path.is_file():
        raise AssertionError(f"Built page missing: {path}")
    raw = path.read_text(encoding="utf-8")
    if "{% include generated/" in raw:
        raise AssertionError(f"Unprocessed Jekyll include in {path}")
    parsed = PageText()
    parsed.feed(raw)
    return parsed


def check(output):
    about = json.loads((ROOT / "_data/about_content.json").read_text(encoding="utf-8"))
    details = json.loads((ROOT / "_data/developer_details.json").read_text(encoding="utf-8"))
    a = scan(output / "about" / "index.html")
    d = scan(output / "developer" / "index.html")
    about_body = " ".join(a.text)
    expected = [section["heading"] for section in about["sections"]]
    for heading in expected:
        if a.headings.count(heading) != 1:
            raise AssertionError(f"About page needs one heading: {heading}")
    if a.headings.count(about["cta"]["heading"]) != 1:
        raise AssertionError("About page call to action is missing")
    for paragraph in about["intro"]:
        if paragraph not in re.sub(r"\s+", " ", about_body):
            raise AssertionError(f"About introduction missing: {paragraph[:60]}")
    for name in ("engineering-interests", "platforms", "tools",
                 "learning-and-exploration", "development-philosophy"):
        if not any(name.replace("-", " ").lower() == h.lower() for h in d.headings):
            raise AssertionError(f"Generated Developer heading missing: {name}")
    for url in ("/contact/", "/developer/", "/developer/#technologies"):
        if url not in a.links:
            raise AssertionError(f"About page link missing: {url}")
    if "GitHub" not in about_body:
        raise AssertionError("About page dynamic GitHub content did not render")
    if len(details["principles"]) != 6:
        # Do not let the verification assume an exact number of principles.
        print(f"Verifying {len(details['principles'])} principles")
    print(f"Verified {len(expected)} About sections, identity links, and Developer headings.")


def main(argv):
    if len(argv) != 2:
        print("Usage: python .github/scripts/check_generated_pages.py _site", file=sys.stderr)
        return 2
    check(Path(argv[1]).resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
