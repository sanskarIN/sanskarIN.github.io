#!/usr/bin/env python3
"""Verify every public document against its source metadata and built routes."""
import hashlib
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

from blog_attachments import preview_markdown, preview_html, preview_word, preview_bibtex
from terminal_data import parse_front_matter, read_yaml, canonical_post_path

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 10_000_000
FILE_NAME = re.compile(r"([a-z0-9][a-z0-9-]{0,59})-([0-9a-f]{20})\.(pdf|pptx|md|html|docx|bib)")
SLUG = re.compile(r"[a-z0-9][a-z0-9-]*")
DIGEST = re.compile(r"[0-9a-f]{64}")


class DocumentLinks(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []
        self.downloads = []
        self.read_links = []
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.append(values["id"])
        if tag == "a" and "href" in values:
            self.links.append(values["href"])
            if "download" in values:
                self.downloads.append((values["href"], values["download"]))
            else:
                self.read_links.append(values["href"])


def demand(condition, message):
    if not condition:
        raise AssertionError(message)


def files_under(root):
    if not root.exists():
        return set()
    files = set()
    for path in root.rglob("*"):
        demand(not path.is_symlink(), f"Unexpected symlink in documents: {path}")
        if path.is_file():
            files.add(path.relative_to(root).as_posix())
    return files


def check_resources(output, root=ROOT, baseurl=""):
    library = DocumentLinks(output / "resources" / "index.html")
    articles = DocumentLinks(output / "articles" / "index.html")
    source_dir = root / "assets/files/blog"
    built_dir = output / "assets/files/blog"
    expected = set()
    article_count = 0
    for post in sorted((root / "_posts").glob("*.md")):
        fields = parse_front_matter(post)
        attachments = fields.get("attachments", [])
        demand(isinstance(attachments, list), f"Invalid attachments list: {post.name}")
        if not attachments:
            continue
        article_count += 1
        demand(len(attachments) <= 5, f"Too many attachments: {post.name}")
        slug = post.stem[11:]
        demand(SLUG.fullmatch(slug), f"Invalid attachment article slug: {slug}")
        route = canonical_post_path(slug, fields)
        page_url = baseurl + route
        page = DocumentLinks(output / route.strip("/") / "index.html")
        demand(page.ids.count("post-attachments-title") == 1,
               f"Attachment section missing or duplicated: {post.name}")
        demand(page_url + "#post-attachments-title" in articles.links,
               f"Article resource link missing: {post.name}")
        for attachment in attachments:
            demand(isinstance(attachment, dict), f"Invalid attachment metadata: {post.name}")
            name = attachment.get("name")
            match = FILE_NAME.fullmatch(name) if isinstance(name, str) else None
            demand(match, f"Invalid attachment filename: {name!r}")
            stem, short_hash, extension = match.groups()
            digest = attachment.get("sha256")
            demand(isinstance(digest, str) and DIGEST.fullmatch(digest) and digest.startswith(short_hash),
                   f"Invalid attachment checksum: {name}")
            demand(attachment.get("format") == extension.upper(), f"Incorrect document format: {name}")
            size = attachment.get("bytes")
            demand(type(size) is int and 0 < size < MAX_BYTES, f"Invalid document size: {name}")
            key = f"{slug}/{name}" + (".txt" if extension == "html" else "")
            path = "/assets/files/blog/" + key
            anchor = f"asset-{stem}-{short_hash}" + (f"-{extension}" if extension in ("md", "html", "docx", "bib") else "")
            demand(attachment.get("path") == path and attachment.get("id") == anchor,
                   f"Invalid document path or anchor: {name}")
            demand(key not in expected, f"Duplicate attachment: {key}")
            expected.add(key)
            for folder in (source_dir, built_dir):
                file = folder / key
                demand(file.is_file() and not file.is_symlink(), f"Missing document: {file}")
                demand(file.stat().st_size == size, f"Document size mismatch: {file}")
                demand(hashlib.sha256(file.read_bytes()).hexdigest() == digest,
                       f"Document checksum mismatch: {file}")
            url = baseurl + path
            demand(page.ids.count(anchor) == 1, f"Missing or duplicated article anchor: {anchor}")
            demand((url, name) in page.downloads, f"Article download missing: {name}")
            demand((url, name) in library.downloads, f"Library download missing: {name}")
            demand(page_url + "#" + anchor in library.links, f"Library detail link missing: {name}")
            if extension == "pdf":
                demand(url in page.read_links, f"PDF reading link missing: {name}")
            if extension == "md":
                preview, truncated = preview_markdown((source_dir / key).read_bytes())
                demand(attachment.get("markdown_preview") == preview and attachment.get("markdown_truncated") is truncated,
                       f"Markdown preview metadata mismatch: {name}")
                demand(page.ids.count(anchor + "-preview") == 1, f"Markdown preview missing: {name}")
                demand(page_url + "#" + anchor + "-preview" in library.links, f"Library Markdown preview link missing: {name}")
            if extension in ("html", "docx", "bib"):
                raw = (source_dir / key).read_bytes()
                parser = {"html": preview_html, "docx": preview_word, "bib": preview_bibtex}[extension]
                preview, truncated = parser(raw)
                demand(attachment.get("document_preview") == preview and attachment.get("document_truncated") is truncated,
                       f"Document preview metadata mismatch: {name}")
                demand(page.ids.count(anchor + "-preview") == 1, f"Document preview missing: {name}")
                demand(page_url + "#" + anchor + "-preview" in library.links, f"Library document preview link missing: {name}")
                if extension in ("html", "bib"):
                    demand(url not in page.read_links and url not in library.read_links,
                           f"{extension.upper()} must be offered as a download only: {name}")
    for folder in (source_dir, built_dir):
        actual = files_under(folder)
        demand(actual == expected, f"Document inventory mismatch in {folder}: "
               f"missing={sorted(expected - actual)}, unexpected={sorted(actual - expected)}")
    print(f"Verified {len(expected)} downloadable documents across {article_count} articles.")


if __name__ == "__main__":
    check_resources(Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve(),
                    baseurl=read_yaml(ROOT, "_config.yml").get("baseurl", "").rstrip("/"))
