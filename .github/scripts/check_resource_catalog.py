#!/usr/bin/env python3
"""Audit the document catalog after Jekyll, against actual publication metadata."""

import argparse
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from check_reading_archive import Audit, Document
from terminal_data import parse_front_matter, published_posts, read_yaml

ROOT = Path(__file__).resolve().parents[2]
FORMATS = {"PDF", "PPTX", "MD", "HTML", "DOCX", "BIB"}
KEYS = ("q", "format", "language", "year", "size", "sort")


@dataclass(frozen=True)
class Resource:
    title: str
    source: str
    name: str
    author: str
    format: str
    bytes: int
    language: str
    date: str
    path: str
    publication: str
    anchor: str
    source_index: int

    @property
    def detail_url(self):
        return self.publication + "#" + self.anchor


def source_resources(root):
    config = read_yaml(root, "_config.yml")
    base = config.get("baseurl", "").rstrip("/")
    output = []
    for index, post in enumerate(published_posts(root), start=1):
        fields = parse_front_matter(root / "_posts" / post["_source"])
        for attachment in fields.get("attachments") or []:
            output.append(Resource(
                title=attachment["title"],
                source=post["title"],
                name=attachment["name"],
                author=fields.get("author") or config["author"]["name"],
                format=attachment["format"],
                bytes=attachment["bytes"],
                language=fields.get("content_language") or "und",
                date=post["_datetime"].date().isoformat(),
                path=base + attachment["path"],
                publication=base + post["url"],
                anchor=attachment["id"],
                source_index=index,
            ))
    return output


def check_filters(form, doc, audit):
    audit.require(form.tag == "form" and form.attrs.get("role") == "search",
                  "filter must be a search form")
    audit.require(bool(form.attrs.get("aria-label")), "filter search landmark must have a label")
    audit.require("hidden" in form.attrs, "filter must start hidden without JavaScript")
    for key in KEYS:
        control = audit.one(form.find(attr="data-resource-filter-" + key), key + " control")
        if not control:
            continue
        audit.require(control.tag == ("input" if key == "q" else "select"),
                      f"{key}: unexpected control type")
        control_id = control.attrs.get("id")
        audit.require(bool(control_id), f"{key}: control has no ID")
        label = audit.one(form.find(tag="label", attr="for", value=control_id), key + " label")
        if label:
            audit.require(bool(label.text()), f"{key}: label is empty")
        audit.require(control.attrs.get("aria-controls") == "resource-results",
                      f"{key}: results target missing")
        if key == "q":
            audit.require(control.attrs.get("type") == "search", "query is not a search input")
            audit.require(control.attrs.get("maxlength") == "160", "query length contract changed")
            help_id = control.attrs.get("aria-describedby")
            audit.require(bool(help_id and doc.root.find(attr="id", value=help_id)), "search help is missing")
        else:
            choices = [option.attrs.get("value") for option in control.find(tag="option")]
            default = "newest" if key == "sort" else ""
            audit.require(bool(choices and choices[0] == default), f"{key}: default option missing")
            audit.require(len(set(choices)) == len(choices), f"{key}: duplicate options")
            required = {
                "format": FORMATS | {""},
                "size": {"", "small", "medium", "large"},
                "sort": {"newest", "oldest", "title", "largest", "smallest"},
            }.get(key)
            if required is not None:
                audit.require(set(choices) == required, f"{key}: incomplete filter options")
    reset = audit.one(form.find(attr="data-resource-reset"), "reset control")
    if reset:
        audit.require(reset.tag == "button" and reset.attrs.get("type") == "button",
                      "reset must not submit the form")
        audit.require("disabled" in reset.attrs, "reset must initially be disabled")
    status = audit.one(form.find(attr="data-resource-status"), "result status")
    if status:
        audit.require(status.attrs.get("role") == "status", "result status must have live semantics")


def check_resource(item, resource, audit):
    label = resource.name
    for key in ("title", "source", "name", "author", "format", "bytes", "language", "date"):
        value = str(getattr(resource, key))
        audit.require(item.attrs.get("data-resource-" + key) == value,
                      f"{label}: {key} metadata differs")
    audit.require(not item.hidden(), f"{label}: hidden without JavaScript")
    heading = audit.one(item.find(css_class="resource-entry__title"), f"{label} title")
    if heading:
        audit.require(heading.text() == " ".join(resource.title.split()), f"{label}: title text mismatch")
        title_link = audit.one(heading.find(tag="a", attr="href"), f"{label} title link")
        if title_link:
            audit.require(title_link.attrs["href"] == resource.detail_url, f"{label}: incorrect detail URL")
    source = item.find(tag="a", attr="href", value=resource.publication)
    audit.require(bool(source), f"{label}: source publication link missing")
    downloads = item.find(tag="a", attr="download")
    download = audit.one(downloads, f"{label} download")
    if download:
        audit.require(download.attrs.get("href") == resource.path, f"{label}: incorrect download path")
        audit.require(download.attrs.get("download") == resource.name, f"{label}: incorrect download filename")

    read_links = [
        link.attrs["href"] for link in item.find(tag="a", attr="href")
        if "download" not in link.attrs
    ]
    if resource.format in {"HTML", "BIB"}:
        audit.require(resource.path not in read_links, f"{label}: unsafe active document link")
    if resource.format in {"MD", "HTML", "DOCX", "BIB"}:
        audit.require(resource.detail_url + "-preview" in read_links, f"{label}: source preview link missing")
    if resource.format == "PDF":
        audit.require(resource.path in read_links, f"{label}: PDF reader link missing")


def audit_catalog(markup, expected):
    doc = Document(markup)
    audit = Audit("/resources/")
    ids = [node.attrs["id"] for node in doc.root.find(attr="id")]
    duplicates = sorted(key for key, count in Counter(ids).items() if count > 1)
    audit.require(not duplicates, f"duplicate DOM IDs: {duplicates}")
    scripts = [
        node for node in doc.root.find(tag="script", attr="src")
        if urlsplit(node.attrs["src"]).path.endswith("/assets/js/resource-library.js")
    ]
    audit.require(len(scripts) == 1, "resource library script missing or duplicated")
    forms = doc.root.find(attr="data-resource-filter")
    lists = doc.root.find(attr="data-resource-list")
    if not expected:
        audit.require(not forms and not lists, "empty library must not expose unusable filters")
        audit.require(not doc.root.find(attr="data-resource-item"), "empty library contains document items")
        return audit.errors

    form = audit.one(forms, "resource filter")
    if form:
        check_filters(form, doc, audit)
    results = audit.one(doc.root.find(attr="id", value="resource-results"), "resource results region")
    if results:
        audit.require(not results.hidden(), "results must be visible without JavaScript")
        empty = audit.one(results.find(attr="data-resource-empty"), "resource empty state")
        if empty:
            audit.require("hidden" in empty.attrs, "empty state must be hidden initially")
            audit.require(bool(empty.text()), "empty state must explain how to recover")
    catalog = audit.one(lists, "resource catalog")
    if not catalog:
        return audit.errors
    audit.require(catalog.tag == "ul" and not catalog.hidden(), "catalog must be a visible list")
    expected_by_key = {(item.publication, item.name): item for item in expected}
    expected_by_name = {}
    for item in expected:
        expected_by_name.setdefault(item.name, []).append(item)
    seen = []
    for item in catalog.find(attr="data-resource-item"):
        audit.require(item.tag == "li", "resource item must be a list entry")
        name = item.attrs.get("data-resource-name")
        candidates = expected_by_name.get(name, [])
        title_links = item.find(css_class="resource-entry__title")
        links = title_links[0].find(tag="a", attr="href") if len(title_links) == 1 else []
        detail = links[0].attrs["href"] if len(links) == 1 else ""
        resource = next((candidate for candidate in candidates if candidate.detail_url == detail), None)
        if not audit.require(resource is not None, f"unexpected resource item: {name}"):
            continue
        seen.append((resource.publication, resource.name))
        check_resource(item, resource, audit)

    audit.require(Counter(seen) == Counter(expected_by_key.keys()),
                  "catalog must contain each expected resource exactly once")
    audit.require(seen == [(item.publication, item.name) for item in expected],
                  "catalog default order differs from published article order")
    for index in {item.source_index for item in expected}:
        audit.require(ids.count(f"resource-post-{index}") == 1,
                      f"original publication group anchor missing: resource-post-{index}")
    return audit.errors


def check_build(output, root=ROOT):
    resources = source_resources(root)
    path = output / "resources/index.html"
    if not path.is_file():
        raise AssertionError("Built resource library missing")
    errors = audit_catalog(path.read_text(encoding="utf-8"), resources)
    if not (output / "assets/js/resource-library.js").is_file():
        errors.append("Published resource library script missing")
    if errors:
        raise AssertionError("\n".join(errors))
    print(f"Resource catalog: {len(resources)} document records, metadata and links verified.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default="_site", type=Path)
    args = parser.parse_args(argv)
    check_build(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
