#!/usr/bin/env python3
"""Build a browser-search index in Python without parsing Liquid templates.

Jekyll's /search.json is the production endpoint until the replacement
passes CI parity checks. The generated source model combines real page
front matter, Markdown posts, and the GitHub repository snapshot.
"""

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

from terminal_data import ROOT, parse_front_matter, published_posts, read_yaml, site_url

PAGE_EXTENSIONS = {".html", ".md", ".markdown"}
EXCLUDED_DIRS = {
    ".git", ".github", ".well-known", "_data", "_includes", "_layouts",
    "_posts", "_site", "assets", "node_modules", "src", "supabase",
    "vendor", "__pycache__", ".venv",
}
WHITESPACE = re.compile(r"\s+")


class TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []

    def handle_data(self, data):
        self.text.append(data)


def strip_html(value):
    parser = TextOnly()
    parser.feed(str(value))
    return WHITESPACE.sub(" ", " ".join(parser.text)).strip()


def post_excerpt(path, length=80):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"\A---\r?\n[\s\S]*?\r?\n---\r?\n", raw)
    if m is None:
        raise ValueError(f"Missing post front matter: {path}")
    # Markdown supports many inline syntaxes; the production Jekyll renderer
    # is authoritative. Keep a useful preview here, not pretend exact text
    # parity with Jekyll's Kramdown "strip_html" filter.
    content = raw[m.end():]
    content = re.sub(r"<[^>]+>", " ", content)
    content = re.sub(r"[#*_>`~|\[\]{}]", " ", content)
    content = re.sub(r"\]\([^)]*\)", " ", content)
    words = html.unescape(content).split()
    return " ".join(words[:length])


def searchable_pages(root=ROOT):
    config = read_yaml(root, "_config.yml")
    baseurl = config.get("baseurl", "")
    pages = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in PAGE_EXTENSIONS:
            continue
        rel = path.relative_to(root)
        if any(part in EXCLUDED_DIRS or part.startswith(".") for part in rel.parts[:-1]):
            continue
        if rel.name in {"README.md", "MIGRATION.md", "CHANGELOG.md",
                        "CONTRIBUTING.md", "SECURITY.md", "LICENSE_DECISION.md"}:
            continue
        try:
            fields = parse_front_matter(path)
        except ValueError as exc:
            if "Missing front matter" in str(exc):
                continue
            raise
        title = fields.get("title")
        if not isinstance(title, str) or not title or fields.get("noindex") or fields.get("sitemap") is False:
            continue
        suffix = path.suffix.lower()
        default_url = "/" + rel.with_suffix("").as_posix() + "/"
        if path.stem == "index":
            parent = rel.parent.as_posix()
            default_url = "/" if parent == "." else "/" + parent + "/"
        url = fields.get("permalink") or default_url
        if not isinstance(url, str) or not url.startswith("/") or url.startswith("//"):
            raise ValueError(f"Invalid page permalink: {rel}")
        desc = fields.get("description") or fields.get("lead") or ""
        pages.append({
            "type": "Page", "title": title,
            "url": site_url(url, baseurl), "text": strip_html(desc),
        })
    pages.sort(key=lambda entry: entry["title"])
    return pages


def search_index(root=ROOT):
    config = read_yaml(root, "_config.yml")
    baseurl = config.get("baseurl", "")
    entries = searchable_pages(root)
    for post in published_posts(root):
        filename = root / "_posts" / post["_source"]
        body = post_excerpt(filename)
        description = strip_html(post["description"])
        entries.append({
            "type": "Post",
            "title": post["title"],
            "url": site_url(post["url"], baseurl),
            "date": post["date"],
            "tags": post["tags"],
            "text": (description + " " + body).strip(),
        })
    github = json.loads((root / "_data/github.json").read_text(encoding="utf-8"))
    for repo in github.get("repositories") or []:
        entries.append({
            "type": "Project",
            "title": repo["name"],
            "url": repo["url"],
            "tags": repo.get("topics"),
            "text": ((repo.get("description") or "") + " "
                     + (repo.get("language") or "")).strip(),
        })
    urls = [entry["url"] for entry in entries]
    if len(urls) != len(set(urls)):
        raise ValueError("Duplicate search URL in generated Python index")
    return entries


if __name__ == "__main__":
    print(json.dumps(search_index(), ensure_ascii=False, indent=2))
