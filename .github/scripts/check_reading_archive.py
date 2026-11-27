#!/usr/bin/env python3
"""Verify archive discovery and filter metadata against the actual built site.

Run after Jekyll: python .github/scripts/check_reading_archive.py _site
The checker is read-only and does not make network requests.
"""

import argparse
import json
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
VOID = frozenset("area base br col embed hr img input link meta param source track wbr".split())
CONTROL_KEYS = ("q", "language", "year", "topic", "kind", "files")


@dataclass
class Element:
    tag: str
    attrs: dict = field(default_factory=dict)
    parent: "Element | None" = None
    children: list = field(default_factory=list)

    def walk(self):
        """Yield elements in document order, not text nodes."""
        pending = [self]
        while pending:
            node = pending.pop()
            yield node
            pending.extend(reversed([child for child in node.children if isinstance(child, Element)]))

    def find(self, *, tag=None, attr=None, value=None, css_class=None):
        result = []
        for node in self.walk():
            if tag is not None and node.tag != tag:
                continue
            if attr is not None and attr not in node.attrs:
                continue
            if attr is not None and value is not None and node.attrs[attr] != value:
                continue
            if css_class is not None and css_class not in (node.attrs.get("class") or "").split():
                continue
            result.append(node)
        return result

    def text(self):
        pieces = []
        pending = list(reversed(self.children))
        while pending:
            child = pending.pop()
            if isinstance(child, Element):
                pending.extend(reversed(child.children))
            else:
                pieces.append(child)
        return " ".join(" ".join(pieces).split())

    def hidden(self):
        current = self
        while current:
            if "hidden" in current.attrs:
                return True
            current = current.parent
        return False


class Document(HTMLParser):
    """Small HTML inspection tree for the site's explicit, balanced markup.

    This is not a browser or a general-purpose HTML5 repair parser. The
    archive containers emitted by the shared templates have explicit end tags.
    """

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element("document")
        self.stack = [self.root]
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        self._append(tag, attrs, tag not in VOID)

    def handle_startendtag(self, tag, attrs):
        self._append(tag, attrs, False)

    def _append(self, tag, attrs, push):
        parent = self.stack[-1]
        node = Element(tag, dict(attrs), parent)
        parent.children.append(node)
        if push:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


@dataclass(frozen=True)
class Publication:
    url: str
    title: str
    year: str
    language: str
    topics: frozenset
    kind: str
    files: int


def expected_publications(root):
    from terminal_data import parse_front_matter, published_posts

    output = []
    for post in published_posts(root):
        fields = parse_front_matter(root / "_posts" / post["_source"])
        topics = frozenset(post["tags"])
        output.append(Publication(
            url=post["url"],
            title=post["title"],
            year=str(post["_datetime"].year),
            language=fields.get("content_language") or "und",
            topics=topics,
            kind="research" if "research" in topics else "article",
            files=len(fields.get("attachments") or []),
        ))
    return output


class Audit:
    def __init__(self, route):
        self.route = route
        self.errors = []

    def require(self, condition, message):
        if not condition:
            self.errors.append(f"{self.route}: {message}")
        return bool(condition)

    def one(self, nodes, label):
        if self.require(len(nodes) == 1, f"expected one {label}, found {len(nodes)}"):
            return nodes[0]
        return None


def check_unique_ids(doc, audit):
    ids = [node.attrs["id"] for node in doc.root.find(attr="id")]
    duplicates = sorted(key for key, count in Counter(ids).items() if count > 1)
    audit.require(not duplicates, f"duplicate DOM IDs: {duplicates}")


def check_controls(form, doc, audit, research_only):
    audit.require(form.tag == "form", "archive filter is not a form")
    audit.require(form.attrs.get("role") == "search", "archive filter lacks search landmark")
    audit.require(bool(form.attrs.get("aria-label")), "archive search landmark has no label")
    audit.require("hidden" in form.attrs, "controls must start hidden without JavaScript")
    expected = [key for key in CONTROL_KEYS if not (research_only and key == "kind")]
    actual = [key for key in CONTROL_KEYS if form.find(attr="data-archive-" + key)]
    audit.require(actual == expected, f"unexpected controls: {actual}")
    for key in expected:
        control = audit.one(form.find(attr="data-archive-" + key), f"{key} filter control")
        if control is None:
            continue
        audit.require(control.tag == ("input" if key == "q" else "select"),
                      f"{key} has incorrect control element")
        control_id = control.attrs.get("id")
        audit.require(bool(control_id), f"{key} has no ID")
        label = audit.one(form.find(tag="label", attr="for", value=control_id), f"{key} label")
        if label:
            audit.require(bool(label.text()), f"{key} label is empty")
        audit.require(control.attrs.get("aria-controls") == "archive-results",
                      f"{key} does not identify the archive results")
        if key == "q":
            audit.require(control.attrs.get("type") == "search", "query is not a search input")
            audit.require(control.attrs.get("maxlength") == "160", "query length contract changed")
            help_id = control.attrs.get("aria-describedby")
            audit.require(bool(help_id and doc.root.find(attr="id", value=help_id)),
                          "search help target is missing")
        else:
            options = control.find(tag="option")
            audit.require(bool(options and options[0].attrs.get("value") == ""),
                          f"{key} has no all-results option")
    reset = audit.one(form.find(attr="data-archive-reset"), "reset control")
    if reset:
        audit.require(reset.tag == "button" and reset.attrs.get("type") == "button",
                      "reset must not submit the form")
        audit.require("disabled" in reset.attrs, "reset should initially be disabled")
    status = audit.one(form.find(attr="data-archive-status"), "result status")
    if status:
        audit.require(status.attrs.get("role") == "status", "result status lacks live semantics")


def check_metadata(item, publication, year, audit):
    attrs = item.attrs
    url = publication.url
    audit.require(year == publication.year, f"{url}: wrong year group")
    audit.require(attrs.get("data-archive-language") == publication.language, f"{url}: language mismatch")
    audit.require(attrs.get("data-archive-kind") == publication.kind, f"{url}: publication type mismatch")
    try:
        raw = json.loads(attrs.get("data-archive-topics") or "[]")
        topics = frozenset(raw) if isinstance(raw, list) and all(isinstance(v, str) for v in raw) else None
    except (ValueError, TypeError):
        topics = None
    audit.require(topics == publication.topics, f"{url}: topic metadata mismatch or invalid JSON")
    audit.require(attrs.get("data-archive-files") == str(publication.files),
                  f"{url}: downloadable-resource count mismatch")
    audit.require(not item.hidden(), f"{url}: publication hidden before script execution")
    if publication.files:
        resources = item.find(tag="a", attr="href", value=url + "#post-attachments-title")
        audit.require(len(resources) == 1, f"{url}: attachment destination missing or duplicated")


def check_results(results, expected, audit):
    audit.require(results.attrs.get("id") == "archive-results", "results ID changed")
    audit.require(not results.hidden(), "archive results must remain visible without JavaScript")
    empty = audit.one(results.find(attr="data-archive-empty"), "empty state")
    if empty:
        audit.require("hidden" in empty.attrs, "empty state must be hidden initially")
        audit.require(bool(empty.text()), "empty state lacks recovery guidance")

    expected_by_url = {post.url: post for post in expected}
    seen = []
    years = []
    groups = results.find(attr="data-archive-year-group")
    for group in groups:
        year = group.attrs.get("data-archive-year-group", "")
        years.append(year)
        audit.require(not group.hidden(), f"{year}: year group hidden without JavaScript")
        count = audit.one(group.find(attr="data-archive-year-count"), f"{year} result count")
        items = group.find(attr="data-archive-item")
        if count:
            audit.require(str(len(items)) in count.text().split(), f"{year}: initial year count mismatch")
        for item in items:
            heading = audit.one(item.find(css_class="post-card__title"), "publication title")
            if not heading:
                continue
            title_link = audit.one(heading.find(tag="a", attr="href"), "publication title link")
            if not title_link:
                continue
            url = title_link.attrs["href"]
            seen.append(url)
            post = expected_by_url.get(url)
            if not audit.require(post is not None, f"unexpected publication: {url}"):
                continue
            # The title includes no screen-reader-only suffix in the post card.
            audit.require(title_link.text() == " ".join(post.title.split()), f"{url}: title mismatch")
            check_metadata(item, post, year, audit)
    expected_years = sorted({post.year for post in expected}, reverse=True)
    audit.require(years == expected_years, f"incorrect year order or coverage: {years}")
    audit.require(Counter(seen) == Counter(post.url for post in expected),
                  "archive must contain each expected publication exactly once")
    audit.require(len(results.find(attr="data-archive-item")) == len(seen),
                  "publication outside its year group")


def audit_archive(source, publications, route):
    research_only = route == "/research/"
    expected = [post for post in publications if not research_only or post.kind == "research"]
    audit = Audit(route)
    doc = Document(source)
    check_unique_ids(doc, audit)
    forms = doc.root.find(attr="data-archive-filter")
    results = doc.root.find(attr="data-archive-results")
    scripts = [
        node for node in doc.root.find(tag="script", attr="src")
        if urlsplit(node.attrs["src"]).path.endswith("/assets/js/reading-archive.js")
    ]
    audit.require(len(scripts) == 1, "archive script missing or duplicated")
    if not expected:
        audit.require(not forms and not results, "empty archive must not expose unusable controls")
        audit.require(not doc.root.find(attr="data-archive-item"), "empty archive has publication items")
        return audit.errors
    form = audit.one(forms, "archive filter")
    result = audit.one(results, "archive results")
    if form:
        check_controls(form, doc, audit, research_only)
    if result:
        check_results(result, expected, audit)
    return audit.errors


def check_build(output, root=ROOT):
    publications = expected_publications(root)
    errors = []
    for route in ("/articles/", "/research/"):
        page = output / route.strip("/") / "index.html"
        if not page.is_file():
            errors.append(f"{route}: built page missing")
            continue
        errors.extend(audit_archive(page.read_text(encoding="utf-8"), publications, route))
    script = output / "assets/js/reading-archive.js"
    if not script.is_file():
        errors.append("Archive script missing from the published build")
    if errors:
        raise AssertionError("\n".join(errors))
    research_count = sum(post.kind == "research" for post in publications)
    print(f"Reading archives: {len(publications)} publications and {research_count} research posts verified.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default="_site", type=Path)
    args = parser.parse_args(argv)
    check_build(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
