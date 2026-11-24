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
        self.h1 = []
        self.links = []
        self._heading = None

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag in ("h1", "h2"):
            self._heading = []
        if tag == "a" and "href" in attr:
            self.links.append(attr["href"])

    def handle_data(self, value):
        self.text.append(value)
        if self._heading is not None:
            self._heading.append(value)

    def handle_endtag(self, tag):
        if tag in ("h1", "h2") and self._heading is not None:
            target = self.h1 if tag == "h1" else self.headings
            target.append(" ".join(" ".join(self._heading).split()))
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


def check_scarp(output, home, projects):
    """Verify actual Jekyll output, not just the page source."""
    import xml.etree.ElementTree as ET
    import yaml

    route = "/ScarpLang/"
    shortcut = route + "GitHub/"
    target = "https://github.com/scarp-lang"
    feature_path = output / "ScarpLang" / "index.html"
    redirect_path = output / "ScarpLang" / "GitHub" / "index.html"
    feature = scan(feature_path)
    redirect = scan(redirect_path)
    markup = feature_path.read_text(encoding="utf-8")
    redirect_markup = redirect_path.read_text(encoding="utf-8")
    if feature.h1 != ["Scarp Lang"]:
        raise AssertionError("Scarp showcase must have one primary heading")
    if "Content-Security-Policy" not in markup:
        raise AssertionError("Scarp showcase must preserve the site CSP")
    if '{% ' in markup or '{{ ' in markup:
        raise AssertionError("Unprocessed template on the Scarp showcase")
    if 'href="https://sanskarin.github.io/ScarpLang/"' not in markup:
        raise AssertionError("Scarp showcase canonical URL missing")
    for heading in ("Start exploring", "The Scarp ecosystem", "Engineering direction", "Build in the open"):
        if feature.headings.count(heading) != 1:
            raise AssertionError(f"Scarp heading missing or duplicated: {heading}")
    ecosystem = yaml.safe_load((ROOT / "_data/scarp_ecosystem.yml").read_text(encoding="utf-8"))
    for entry in ecosystem:
        if entry["url"] not in feature.links:
            raise AssertionError(f"Scarp showcase destination missing: {entry['url']}")
    for page, name in ((home, "Homepage"), (projects, "Projects")):
        if route not in page.links:
            raise AssertionError(f"{name} does not link to the Scarp showcase")
    if shortcut not in feature.links or shortcut not in home.links:
        raise AssertionError("Scarp GitHub shortcut is not discoverable")
    if target not in redirect.links or route not in redirect.links:
        raise AssertionError("Scarp redirect fallback links missing")
    if not re.search(r'<meta http-equiv="refresh" content="0; url=https://github\.com/scarp-lang">', redirect_markup):
        raise AssertionError("Scarp shortcut does not immediately redirect to the official organization")
    if '<meta name="robots" content="noindex, follow">' not in redirect_markup or '<script' in redirect_markup:
        raise AssertionError("Scarp shortcut must be noindex and work without JavaScript")
    search = json.loads((output / "search.json").read_text(encoding="utf-8"))
    terminal = json.loads((output / "terminal.json").read_text(encoding="utf-8"))
    if [e["url"] for e in search].count(route) != 1 or any(e["url"] == shortcut for e in search):
        raise AssertionError("Scarp search visibility is incorrect")
    if {"title": "Scarp Lang", "url": route} not in terminal["pages"]:
        raise AssertionError("Scarp showcase missing in terminal navigation")
    sitemap = ET.parse(output / "sitemap.xml")
    urls = [node.text for node in sitemap.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    if urls.count("https://sanskarin.github.io" + route) != 1 or "https://sanskarin.github.io" + shortcut in urls:
        raise AssertionError("Scarp sitemap visibility is incorrect")
    print("Scarp: built routes, official destinations, navigation, redirect, search and sitemap passed.")


def check(output):
    about = json.loads((ROOT / "_data/about_content.json").read_text(encoding="utf-8"))
    details = json.loads((ROOT / "_data/developer_details.json").read_text(encoding="utf-8"))
    a = scan(output / "about" / "index.html")
    d = scan(output / "developer" / "index.html")
    h = scan(output / "index.html")
    projects = scan(output / "projects" / "index.html")
    check_scarp(output, h, projects)
    resources = scan(output / "resources" / "index.html")
    blog = scan(output / "blog" / "index.html")
    if resources.h1 != ["Assets & Resources"] or "/resources/" not in blog.links or "/resources/" not in h.links:
        raise AssertionError("The resource library is not discoverable")
    search = json.loads((output / "search.json").read_text(encoding="utf-8"))
    terminal = json.loads((output / "terminal.json").read_text(encoding="utf-8"))
    if sum(item["url"] == "/resources/" for item in search) != 1:
        raise AssertionError("Assets search entry missing or duplicated")
    if {"title": "Assets", "url": "/resources/"} not in terminal["pages"]:
        raise AssertionError("Assets terminal navigation missing")
    home = json.loads((ROOT / "_data/home_content.json").read_text(encoding="utf-8"))
    contact_data = json.loads((ROOT / "_data/contact_page.json").read_text(encoding="utf-8"))
    not_found_data = json.loads((ROOT / "_data/not_found_page.json").read_text(encoding="utf-8"))
    contact = scan(output / "contact" / "index.html")
    not_found = scan(output / "404.html")
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
    developer_body = " ".join(d.text)
    for principle in details["principles"]:
        if principle["title"] not in developer_body:
            raise AssertionError(f"Missing Developer principle: {principle['title']}")
    normalized_home_headings = [re.sub(r"^\d{2}\s*", "", heading)
                                for heading in h.headings]
    for section in home["sections"]:
        if normalized_home_headings.count(section["title"]) != 1:
            raise AssertionError(f"Homepage section missing: {section['title']}")
    home_body = " ".join(h.text)
    for paragraph in home["about_paragraphs"]:
        if paragraph not in re.sub(r"\s+", " ", home_body):
            raise AssertionError(f"Homepage summary missing: {paragraph[:60]}")
    for url in ("/about/", "/developer/", "/contact/"):
        if url not in h.links:
            raise AssertionError(f"Homepage link missing: {url}")
    if "profile" not in home_body:
        raise AssertionError("Homepage terminal fallback missing")
    contact_body = " ".join(contact.text)
    for heading in (contact_data["email_heading"], contact_data["advice_heading"],
                    contact_data["social_heading"], contact_data["security_heading"]):
        if contact.headings.count(heading) != 1:
            raise AssertionError(f"Missing Contact heading: {heading}")
    for advice in contact_data["advice"]:
        if advice["label"] not in contact_body or advice["description"] not in contact_body:
            raise AssertionError(f"Missing Contact advice: {advice['label']}")
    if "https://scarp-lang.github.io/downloads/" not in projects.links:
        raise AssertionError("Projects page must link to the official Scarp downloads")
    if projects.headings.count("Scarp ecosystem") != 1:
        raise AssertionError("Scarp ecosystem section missing or duplicated")
    if "/contact/" not in h.links:
        raise AssertionError("Homepage no longer links to Contact")
    if not any(link.endswith("/security/policy") for link in contact.links):
        raise AssertionError("Contact security policy link missing")
    contact_raw = (output / "contact" / "index.html").read_text(encoding="utf-8")
    has_form = "data-contact-form" in contact_raw
    has_heading = 'id="send-a-message"' in contact_raw
    if has_form != has_heading:
        raise AssertionError("Contact form and heading availability disagree")
    if not has_form and contact_data["form_disabled_notice"] not in contact_body:
        raise AssertionError("Contact form disabled notice missing")
    if has_form and contact_data["form_intro"] not in contact_body:
        raise AssertionError("Contact form introduction missing")
    if not_found.h1.count(not_found_data["title"]) != 1:
        raise AssertionError("404 page title missing")
    not_found_body = " ".join(not_found.text)
    if not_found_data["description"] not in not_found_body:
        raise AssertionError("404 page description missing")
    if not_found_data["search_label"] not in not_found_body:
        raise AssertionError("404 search control missing")
    for url in ("/", "/contact/"):
        if url not in not_found.links:
            raise AssertionError(f"404 link missing: {url}")
    not_found_raw = (output / "404.html").read_text(encoding="utf-8")
    if "data-search" not in not_found_raw and "data-search-open" not in not_found_raw:
        raise AssertionError("404 search launcher missing")
    print(f"Verified Contact content and form fallback; 404 search and links.")
    print(f"Verified {len(home['sections'])} homepage sections and links.")
    print(f"Verified {len(expected)} About sections, identity links, "
          f"and {len(details['principles'])} Developer principles.")


def main(argv):
    if len(argv) != 2:
        print("Usage: python .github/scripts/check_generated_pages.py _site", file=sys.stderr)
        return 2
    check(Path(argv[1]).resolve())
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
