#!/usr/bin/env python3
"""Verify Markdown blog source and published routes on the Jekyll build."""

import json
import re
import sys
from pathlib import Path
from datetime import date, datetime, timezone
from terminal_data import parse_front_matter, canonical_post_path, published_posts, read_yaml
from citation_audit import citation_errors

ROOT = Path(__file__).resolve().parents[2]
FRONT_MATTER = re.compile(r"\A---\r?\n([\s\S]*?)\r?\n---\r?\n")
DATE_NAME = re.compile(r"^\d{4}-\d{2}-\d{2}-(.+)\.md$")
SOURCE_ISSUE = re.compile(r"^source_issue:\s*(\d+)\s*$", re.M)


def iso_day(value):
    if not value:
        return ""
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    raise ValueError("Invalid publication date")


def check_build(output):
    config = read_yaml(ROOT, "_config.yml")
    public_posts = {post["_source"]: post for post in published_posts(ROOT)}
    origin = config["url"].rstrip("/") + config.get("baseurl", "").rstrip("/")
    posts = ROOT / "_posts"
    legacy = sorted(posts.glob("*.html"))
    if legacy:
        raise AssertionError(f"HTML-authored posts remain: {[x.name for x in legacy]}")

    sources = sorted(posts.glob("*.md"))
    if not sources:
        raise AssertionError("No Markdown-authored blog posts found")

    search = json.loads((output / "search.json").read_text(encoding="utf-8"))
    listed = [item for item in search if item.get("type") == "Post"]
    urls = [item.get("url") for item in listed]
    if len(set(urls)) != len(urls):
        raise AssertionError("Duplicate blog post URLs in search.json")

    slugs = set()
    source_issues = set()
    for source in sources:
        m = DATE_NAME.fullmatch(source.name)
        if not m:
            raise AssertionError(f"Invalid dated post filename: {source.name}")
        slug = m.group(1)
        if slug in slugs:
            raise AssertionError(f"Duplicate post slug: {slug}")
        slugs.add(slug)
        content = source.read_text(encoding="utf-8")
        front = FRONT_MATTER.match(content)
        if not front:
            raise AssertionError(f"Front matter missing: {source.name}")
        if not re.search(r"^title:\s*\S", front.group(1), re.M):
            raise AssertionError(f"Title missing: {source.name}")
        if not re.search(r"^date:\s*\S", front.group(1), re.M):
            raise AssertionError(f"Date missing: {source.name}")
        issue = SOURCE_ISSUE.search(front.group(1))
        if issue:
            if issue.group(1) in source_issues:
                raise AssertionError(f"Duplicate source issue: {issue.group(1)}")
            source_issues.add(issue.group(1))
        if not content[front.end():].strip():
            raise AssertionError(f"Blog body empty: {source.name}")
        fields = parse_front_matter(source)
        url = canonical_post_path(slug, fields)
        if url not in urls:
            raise AssertionError(f"Post missing from search index: {url}")
        html = output / url.strip("/") / "index.html"
        if url.startswith("/research/"):
            legacy = output / "blog" / slug / "index.html"
            if not legacy.is_file() or url not in legacy.read_text(encoding="utf-8"):
                raise AssertionError(f"Legacy blog redirect missing: {slug}")
        if not html.is_file():
            raise AssertionError(f"Published page missing: {html}")
        markup = html.read_text(encoding="utf-8")
        if 'Content-Security-Policy' not in markup or '<main ' not in markup:
            raise AssertionError(f"Published post lost layout or CSP: {slug}")
        if not re.search(r"<h[12]\b", markup):
            raise AssertionError(f"Published post lost headings: {slug}")
        if "{{" in markup or "{% " in markup:
            raise AssertionError(f"Unresolved template in published post: {slug}")
        public = public_posts[source.name]
        details = fields.get("research_details") or {}
        expected_citation = {
            "title": public["title"],
            "subtitle": str(fields.get("subtitle") or ""),
            "author": str(fields.get("author") or config["author"]["name"]),
            "site": str(config["title"]),
            "date": iso_day(public["_datetime"]),
            "updated": iso_day(fields.get("last_modified_at")),
            "url": origin + url,
            "language": str(fields.get("content_language") or "und"),
            "version": str(details.get("version") or ""),
        }
        problems = citation_errors(markup, expected_citation)
        if problems:
            raise AssertionError(f"{slug}: citation panel: " + "; ".join(problems))

    if len(sources) != len(listed):
        raise AssertionError(f"Blog search count {len(listed)} != source count {len(sources)}")

    print(f"Verified {len(sources)} Markdown blog posts, stable routes and search entries.")


if __name__ == "__main__":
    check_build(Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve())
