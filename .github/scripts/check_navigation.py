#!/usr/bin/env python3
"""Validate the navigation configuration and inspect actual generated pages."""

import argparse
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from check_reading_archive import Audit, Document, Element
from terminal_data import published_posts, read_yaml

ROOT = Path(__file__).resolve().parents[2]
GROUP_NAME = re.compile(r"[a-z][a-z0-9-]*\Z")
ROUTE = re.compile(r"/(?:[A-Za-z0-9._~-]+/)*\Z")


@dataclass(frozen=True)
class Slot:
    title: str
    urls: tuple
    group: str = ""


def route_valid(value):
    return (
        isinstance(value, str)
        and bool(ROUTE.fullmatch(value))
        and all(part not in (".", "..") for part in value.split("/"))
    )


def label_valid(value):
    return isinstance(value, str) and bool(value.strip()) and value == value.strip()


def validate_navigation(data):
    """Return canonical destination labels and ordered header slots.

    Require a single source of truth for labels and exactly one header
    occurrence of every canonical destination. A new destination must be
    assigned deliberately rather than disappearing from the compact header.
    """
    if not isinstance(data, dict):
        raise ValueError("navigation must be a mapping")
    entries = data.get("main")
    header = data.get("header")
    if not isinstance(entries, list) or not entries:
        raise ValueError("main must be a nonempty list")
    if not isinstance(header, list) or not header:
        raise ValueError("header must be a nonempty list")
    labels = {}
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"title", "url"}:
            raise ValueError("main entries require title and url")
        title, url = entry["title"], entry["url"]
        if not route_valid(url):
            raise ValueError(f"invalid main route: {url!r}")
        if not label_valid(title):
            raise ValueError(f"invalid main label: {url}")
        if url in labels:
            raise ValueError(f"duplicate main route: {url}")
        labels[url] = title
    if "/" not in labels:
        raise ValueError("main must contain home")

    slots = []
    groups = set()
    assigned = Counter()
    for item in header:
        if not isinstance(item, dict):
            raise ValueError("header entry must be a mapping")
        if set(item) == {"url"}:
            url = item["url"]
            if not route_valid(url) or url not in labels:
                raise ValueError(f"unknown header route: {url!r}")
            slots.append(Slot(labels[url], (url,)))
            assigned[url] += 1
        elif set(item) == {"group", "title", "urls"}:
            name, title, urls = item["group"], item["title"], item["urls"]
            if not isinstance(name, str) or not GROUP_NAME.fullmatch(name):
                raise ValueError(f"invalid group name: {name!r}")
            if name in groups:
                raise ValueError(f"duplicate group name: {name}")
            if not label_valid(title):
                raise ValueError(f"invalid group label: {name}")
            if not isinstance(urls, list) or len(urls) < 2:
                raise ValueError(f"group requires at least two routes: {name}")
            for url in urls:
                if not route_valid(url) or url not in labels:
                    raise ValueError(f"unknown group route: {url!r}")
                if url == "/":
                    raise ValueError("home must remain a direct link")
                assigned[url] += 1
            groups.add(name)
            slots.append(Slot(title, tuple(urls), name))
        else:
            raise ValueError("header entry requires url or group, title and urls")
    missing = sorted(set(labels) - assigned.keys())
    duplicate = sorted(url for url, count in assigned.items() if count > 1)
    if missing or duplicate:
        raise ValueError(f"header coverage: missing={missing}, duplicate={duplicate}")
    if slots[0].urls != ("/",) or slots[0].group:
        raise ValueError("home must be the first direct header link")
    return labels, slots


def children(node, tag=None):
    return [
        child for child in node.children
        if isinstance(child, Element) and (tag is None or child.tag == tag)
    ]


def current_group(slot, route):
    return any(route == url or route.startswith(url) for url in slot.urls)


def check_link(link, url, labels, route, baseurl, audit):
    audit.require(link.attrs.get("href") == baseurl + url, f"incorrect href for {url}")
    audit.require(link.text() == " ".join(labels[url].split()), f"incorrect label for {url}")
    expected_current = "page" if route == url else None
    audit.require(link.attrs.get("aria-current") == expected_current,
                  f"incorrect current-page state for {url}")
    audit.require(not link.hidden(), f"hidden navigation link: {url}")
    audit.require(link.attrs.get("tabindex") != "-1", f"untabbable navigation link: {url}")
    audit.require(link.attrs.get("aria-disabled") != "true", f"disabled navigation link: {url}")


def check_group(item, slot, labels, route, baseurl, audit):
    group = audit.one(children(item, "details"), f"{slot.group} native disclosure")
    if not group:
        return
    audit.require(group.attrs.get("data-nav-group") == slot.group,
                  f"group identity mismatch: {slot.group}")
    audit.require("open" not in group.attrs, f"group initially open: {slot.group}")
    audit.require("hidden" not in group.attrs, f"group hidden without scripts: {slot.group}")
    audit.require(("data-nav-current" in group.attrs) == current_group(slot, route),
                  f"incorrect group current state: {slot.group}")
    elements = children(group)
    audit.require([node.tag for node in elements] == ["summary", "ul"],
                  f"group needs native summary followed by list: {slot.group}")
    summary = audit.one(children(group, "summary"), f"{slot.group} summary")
    if summary:
        audit.require(summary.text() == slot.title, f"group label mismatch: {slot.group}")
        audit.require(summary.attrs.get("tabindex") != "-1", f"untabbable summary: {slot.group}")
        audit.require(not summary.hidden(), f"hidden summary: {slot.group}")
        audit.require("aria-expanded" not in summary.attrs, f"native summary has redundant state: {slot.group}")
        audit.require(not summary.find(tag="a"), f"nested link inside summary: {slot.group}")
        audit.require(not summary.find(tag="button"), f"nested button inside summary: {slot.group}")
    panel = audit.one(group.find(attr="data-nav-panel"), f"{slot.group} panel")
    if not panel:
        return
    audit.require(panel.tag == "ul" and panel.parent is group, f"incorrect panel structure: {slot.group}")
    audit.require(panel.attrs.get("aria-label") == slot.title, f"panel label mismatch: {slot.group}")
    audit.require("hidden" not in panel.attrs, f"panel unusable without scripts: {slot.group}")
    items = children(panel)
    audit.require(len(items) == len(slot.urls), f"incorrect group size: {slot.group}")
    for child, url in zip(items, slot.urls):
        audit.require(child.tag == "li", f"invalid list item: {url}")
        link = audit.one(children(child, "a"), f"link for {url}")
        if link:
            check_link(link, url, labels, route, baseurl, audit)


def check_assets(root, baseurl, audit):
    for tag, attr, path in (
        ("script", "src", "/assets/js/navigation-groups.js"),
        ("link", "href", "/assets/css/navigation-groups.css"),
    ):
        assets = [
            node for node in root.find(tag=tag, attr=attr)
            if urlsplit(node.attrs[attr]).path == baseurl + path
        ]
        asset = audit.one(assets, path)
        if asset:
            if tag == "script":
                audit.require("defer" in asset.attrs, "navigation script must defer")
            else:
                audit.require(asset.attrs.get("rel") == "stylesheet", "navigation CSS is not a stylesheet")


def audit_page(source, route, labels, slots, baseurl=""):
    audit = Audit(route)
    root = Document(source).root
    nav = audit.one(root.find(attr="data-grouped-navigation"), "grouped header")
    toggle = audit.one(root.find(attr="data-nav-toggle"), "mobile navigation toggle")
    if toggle:
        audit.require(toggle.tag == "button", "mobile toggle must be a button")
        audit.require(toggle.attrs.get("type") == "button", "mobile toggle has incorrect type")
        audit.require(toggle.attrs.get("aria-controls") == "site-nav", "mobile toggle target changed")
        audit.require(toggle.attrs.get("aria-expanded") == "false", "mobile toggle starts expanded")
    if nav:
        audit.require(nav.tag == "nav" and nav.attrs.get("id") == "site-nav", "header landmark changed")
        audit.require(bool(nav.attrs.get("aria-label")), "header landmark lacks label")
        audit.require(not nav.hidden(), "navigation is hidden without JavaScript")
        audit.require(len(root.find(attr="id", value="site-nav")) == 1, "duplicate navigation ID")
        for node in nav.walk():
            audit.require(node.attrs.get("role") not in ("menu", "menubar", "menuitem"),
                          "site navigation must not imitate application menus")
        listing = audit.one(children(nav, "ul"), "top-level navigation list")
        if listing:
            items = children(listing)
            audit.require(len(items) == len(slots), "top-level navigation slot count mismatch")
            for item, slot in zip(items, slots):
                audit.require(item.tag == "li", "invalid header list item")
                if slot.group:
                    check_group(item, slot, labels, route, baseurl, audit)
                else:
                    link = audit.one(children(item, "a"), f"direct link for {slot.urls[0]}")
                    if link:
                        check_link(link, slot.urls[0], labels, route, baseurl, audit)
        expected_hrefs = Counter(baseurl + url for url in labels)
        actual_hrefs = Counter(link.attrs.get("href") for link in nav.find(tag="a"))
        audit.require(actual_hrefs == expected_hrefs, "header destination coverage mismatch")
    check_assets(root, baseurl, audit)
    return audit.errors


def output_path(output, route):
    """Map canonical routes to their generated HTML files."""
    if not route.startswith("/") or ".." in route.split("/"):
        raise ValueError(f"invalid page route: {route}")
    if route.endswith("/"):
        return output / route.strip("/") / "index.html"
    return output / route.lstrip("/")


def check_build(output, root=ROOT):
    labels, slots = validate_navigation(read_yaml(root, "_data/navigation.yml"))
    config = read_yaml(root, "_config.yml")
    baseurl = (config.get("baseurl") or "").rstrip("/")
    routes = list(dict.fromkeys([*labels, "/sanskar/", *(post["url"] for post in published_posts(root))]))
    errors = []
    for route in routes:
        path = output_path(output, route)
        if not path.is_file():
            errors.append(f"{route}: generated page missing")
            continue
        errors.extend(audit_page(path.read_text(encoding="utf-8"), route, labels, slots, baseurl))
    for asset in ("assets/js/navigation-groups.js", "assets/css/navigation-groups.css"):
        if not (output / asset).is_file():
            errors.append(f"missing generated asset: {asset}")
    if errors:
        raise AssertionError("\n".join(errors))
    print(f"Navigation: {len(routes)} rendered pages, {len(labels)} canonical destinations, {len(slots)} header slots verified.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", default="_site", type=Path)
    args = parser.parse_args(argv)
    check_build(args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
