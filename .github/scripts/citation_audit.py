#!/usr/bin/env python3
"""Verify the citation panel on generated publication pages."""

from collections import Counter
from html.parser import HTMLParser
from urllib.parse import urlsplit


FIELDS = ("title", "subtitle", "author", "site", "date", "updated", "url", "language", "version")
FORMATS = {"text", "markdown", "bibtex", "ris", "csl"}


class CitationMarkup(HTMLParser):
    """Collect the small set of HTML attributes that define this contract."""

    VOID = set("area base br col embed hr img input link meta param source track wbr".split())

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.panels = []
        self.ids = []
        self.nodes = []
        self.scripts = []
        self.styles = []
        self.canonical = []
        self.stack = []
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        self.record(tag, attrs, tag not in self.VOID)

    def handle_startendtag(self, tag, attrs):
        self.record(tag, attrs, False)

    def record(self, tag, attrs, push):
        data = dict(attrs)
        if "id" in data:
            self.ids.append(data["id"])
        if tag == "script" and "src" in data:
            self.scripts.append(data["src"])
        if tag == "link" and data.get("rel") == "stylesheet":
            self.styles.append(data.get("href", ""))
        if tag == "link" and data.get("rel") == "canonical":
            self.canonical.append(data.get("href", ""))
        is_panel = "data-citation-panel" in data
        inside_panel = is_panel or any(frame[1] for frame in self.stack)
        if is_panel:
            self.panels.append(data)
        if inside_panel:
            self.nodes.append((tag, data, any(frame[2] for frame in self.stack)))
        if push:
            self.stack.append((tag, inside_panel, "hidden" in data))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                return

    def find(self, *, tag=None, attr=None, value=None):
        return [
            (node_tag, attrs, hidden)
            for node_tag, attrs, hidden in self.nodes
            if (tag is None or node_tag == tag)
            and (attr is None or attr in attrs)
            and (value is None or attrs.get(attr) == value)
        ]


def citation_errors(markup, expected):
    doc = CitationMarkup(markup)
    problems = []

    def require(condition, message):
        if not condition:
            problems.append(message)
        return bool(condition)

    def one(nodes, label):
        return nodes[0] if require(len(nodes) == 1, f"expected one {label}, found {len(nodes)}") else None

    if not require(len(doc.panels) == 1, "expected exactly one citation panel"):
        return problems
    metadata = doc.panels[0]
    for field in FIELDS:
        attribute = "data-citation-" + field
        require(attribute in metadata, f"missing {attribute}")
        require(metadata.get(attribute) == expected.get(field, ""), f"citation {field} differs from public metadata")
    require(metadata.get("aria-labelledby") == "publication-citation-title", "citation region is not labelled")
    duplicates = [key for key, count in Counter(doc.ids).items() if key.startswith("publication-citation-") and count > 1]
    require(not duplicates, f"duplicate citation IDs: {duplicates}")

    title = one(doc.find(tag="h2", attr="id", value="publication-citation-title"), "citation heading")
    if title:
        require(not title[2], "citation heading is hidden without JavaScript")
    reference = one(doc.find(tag="p", attr="class", value="publication-citation__reference"), "static reference")
    if reference:
        require(not reference[2] and "hidden" not in reference[1], "static citation must remain visible")
    link = one(doc.find(tag="a", attr="href", value=expected.get("url")), "canonical reference link")
    if link:
        require(not link[2], "canonical reference link is hidden")
    require(doc.canonical == [expected.get("url")], "reference URL differs from the page canonical link")

    controls = one(doc.find(attr="data-citation-controls"), "citation controls")
    if controls:
        require("hidden" in controls[1], "enhancement controls must start hidden")
    select = one(doc.find(tag="select", attr="data-citation-format"), "reference format select")
    output = one(doc.find(tag="textarea", attr="data-citation-output"), "formatted reference output")
    for node, name in ((select, "format"), (output, "output")):
        if node:
            control_id = node[1].get("id")
            require(bool(control_id), f"{name} control lacks an ID")
            one(doc.find(tag="label", attr="for", value=control_id), f"{name} label")
            require(node[2], f"{name} control must be inside the hidden enhancement region")
    if select:
        require(select[1].get("aria-controls") == "publication-citation-output", "format selector lacks output target")
        options = [node[1].get("value") for node in doc.find(tag="option")]
        require(set(options) == FORMATS and len(options) == len(FORMATS), "citation formats are incomplete or duplicated")
    if output:
        require("readonly" in output[1], "formatted reference must be read-only")
    for key in ("copy", "download"):
        button = one(doc.find(tag="button", attr="data-citation-" + key), key + " button")
        if button:
            require(button[1].get("type") == "button", f"{key} button must not submit a form")
            require(button[2], f"{key} button must be hidden until enhancement")
    status = one(doc.find(attr="data-citation-status"), "citation status")
    if status:
        require(status[1].get("role") == "status", "citation status lacks live semantics")

    scripts = [url for url in doc.scripts if urlsplit(url).path.endswith("/assets/js/publication-citation.js")]
    styles = [url for url in doc.styles if urlsplit(url).path.endswith("/assets/css/publication-citation.css")]
    require(len(scripts) == 1, "citation script missing or duplicated")
    require(len(styles) == 1, "citation stylesheet missing or duplicated")
    return problems
