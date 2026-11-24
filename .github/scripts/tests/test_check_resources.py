"""Synthetic built-site tests for the published document checker."""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from check_resources import check_resources


class ResourceBuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.out = self.root / "_site"
        self.slug = "test-article"
        self.data = b"%PDF-1.7\nexample\n%%EOF\n"
        digest = hashlib.sha256(self.data).hexdigest()
        self.name = f"guide-{digest[:20]}.pdf"
        self.anchor = f"asset-guide-{digest[:20]}"
        self.path = f"/assets/files/blog/{self.slug}/{self.name}"
        self.article_url = f"/blog/{self.slug}/"
        self.metadata = {"name": self.name, "id": self.anchor, "format": "PDF",
                         "title": "Guide", "bytes": len(self.data), "sha256": digest,
                         "path": self.path, "slides": []}
        self.source = self.root / "_posts/2026-01-01-test-article.md"
        self.source.parent.mkdir(parents=True)
        self.write_source()
        for folder in (self.root, self.out):
            file = folder / self.path.lstrip("/")
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(self.data)
        self.write_pages()

    def write_source(self):
        self.source.write_text("---\ntitle: Test\nattachments: " +
                               json.dumps([self.metadata]) + "\n---\nTest\n", encoding="utf-8")

    def write(self, name, markup):
        file = self.out / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(markup, encoding="utf-8")

    def write_pages(self, base=""):
        download = f'<a href="{base}{self.path}" download="{self.name}">Download</a>'
        self.write("resources/index.html", download +
                   f'<a href="{base}{self.article_url}#{self.anchor}">View</a>')
        self.write("articles/index.html",
                   f'<a href="{base}{self.article_url}#post-attachments-title">Resources</a>')
        self.write(f"blog/{self.slug}/index.html",
                   f'<section id="post-attachments-title"><article id="{self.anchor}">' +
                   download + f'<a href="{base}{self.path}">Read PDF</a></article></section>')

    def test_html_download_uses_plain_text_path(self):
        for folder in (self.root, self.out):
            (folder / self.path.lstrip("/")).unlink()
        self.data = b"<script>alert(1)</script>"
        digest = hashlib.sha256(self.data).hexdigest()
        self.name = f"guide-{digest[:20]}.html"
        self.anchor = f"asset-guide-{digest[:20]}-html"
        self.path = f"/assets/files/blog/{self.slug}/{self.name}.txt"
        self.metadata.update(name=self.name, id=self.anchor, format="HTML",
                             bytes=len(self.data), sha256=digest, path=self.path,
                             document_preview=self.data.decode(), document_truncated=False)
        self.write_source()
        for folder in (self.root, self.out):
            file = folder / self.path.lstrip("/")
            file.write_bytes(self.data)
        self.write_pages()
        article = self.out / f"blog/{self.slug}/index.html"
        article.write_text(article.read_text(encoding="utf-8").replace(
            f'<a href="{self.path}">Read PDF</a>', f'<details id="{self.anchor}-preview"></details>'), encoding="utf-8")
        library = self.out / "resources/index.html"
        library.write_text(library.read_text(encoding="utf-8") +
                           f'<a href="{self.article_url}#{self.anchor}-preview">Preview</a>', encoding="utf-8")
        check_resources(self.out, self.root)
        article.write_text(article.read_text(encoding="utf-8") +
                           f'<a href="{self.path}">Open</a>', encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, "download only"):
            check_resources(self.out, self.root)

    def test_bibtex_inventory_and_preview(self):
        for folder in (self.root, self.out):
            (folder / self.path.lstrip("/")).unlink()
        self.data = b"@article{example, title={Research}}\r\n"
        digest = hashlib.sha256(self.data).hexdigest()
        self.name = f"guide-{digest[:20]}.bib"
        self.anchor = f"asset-guide-{digest[:20]}-bib"
        self.path = f"/assets/files/blog/{self.slug}/{self.name}"
        self.metadata.update(name=self.name, id=self.anchor, format="BIB",
                             bytes=len(self.data), sha256=digest, path=self.path,
                             document_preview=self.data.decode(), document_truncated=False)
        self.write_source()
        for folder in (self.root, self.out):
            (folder / self.path.lstrip("/")).write_bytes(self.data)
        self.write_pages()
        article = self.out / f"blog/{self.slug}/index.html"
        article.write_text(article.read_text(encoding="utf-8").replace(
            f'<a href="{self.path}">Read PDF</a>', f'<details id="{self.anchor}-preview"></details>'), encoding="utf-8")
        library = self.out / "resources/index.html"
        library.write_text(library.read_text(encoding="utf-8") +
                           f'<a href="{self.article_url}#{self.anchor}-preview">Preview</a>', encoding="utf-8")
        check_resources(self.out, self.root)
        self.metadata["document_preview"] = "wrong"
        self.write_source()
        with self.assertRaisesRegex(AssertionError, "Document preview metadata mismatch"):
            check_resources(self.out, self.root)

    def test_markdown_inventory_and_preview(self):
        for folder in (self.root, self.out):
            (folder / self.path.lstrip("/")).unlink()
        self.data = b"# Guide\r\n"
        digest = hashlib.sha256(self.data).hexdigest()
        self.name = f"guide-{digest[:20]}.md"
        self.anchor = f"asset-guide-{digest[:20]}-md"
        self.path = f"/assets/files/blog/{self.slug}/{self.name}"
        self.metadata.update(name=self.name, id=self.anchor, format="MD",
                             bytes=len(self.data), sha256=digest, path=self.path,
                             markdown_preview=self.data.decode(), markdown_truncated=False)
        self.write_source()
        for folder in (self.root, self.out):
            file = folder / self.path.lstrip("/")
            file.write_bytes(self.data)
        self.write_pages()
        for page, fragment in (
            ("resources/index.html", f'<a href="{self.article_url}#{self.anchor}-preview">Preview</a>'),
            (f"blog/{self.slug}/index.html", f'<details id="{self.anchor}-preview"></details>'),
        ):
            file = self.out / page
            file.write_text(file.read_text(encoding="utf-8") + fragment, encoding="utf-8")
        check_resources(self.out, self.root)
        self.metadata["markdown_preview"] = "incorrect"
        self.write_source()
        with self.assertRaisesRegex(AssertionError, "Markdown preview metadata mismatch"):
            check_resources(self.out, self.root)

    def test_complete_build_and_baseurl(self):
        check_resources(self.out, self.root)
        self.write_pages("/portfolio")
        check_resources(self.out, self.root, "/portfolio")

    def test_missing_download_file(self):
        (self.out / self.path.lstrip("/")).unlink()
        with self.assertRaisesRegex(AssertionError, "Missing document"):
            check_resources(self.out, self.root)

    def test_modified_download_same_length(self):
        (self.out / self.path.lstrip("/")).write_bytes(b"X" * len(self.data))
        with self.assertRaisesRegex(AssertionError, "checksum mismatch"):
            check_resources(self.out, self.root)

    def test_unreferenced_file(self):
        (self.root / self.path.lstrip("/")).with_name("orphan.pdf").write_bytes(self.data)
        with self.assertRaisesRegex(AssertionError, "inventory mismatch"):
            check_resources(self.out, self.root)

    def test_invalid_path_metadata(self):
        self.metadata["path"] = "/private/example.pdf"
        self.write_source()
        with self.assertRaisesRegex(AssertionError, "path or anchor"):
            check_resources(self.out, self.root)

    def test_missing_download_link(self):
        self.write("resources/index.html", "<p>Missing resource</p>")
        with self.assertRaisesRegex(AssertionError, "Library download missing"):
            check_resources(self.out, self.root)

    def test_missing_pdf_reader(self):
        file = self.out / f"blog/{self.slug}/index.html"
        file.write_text(file.read_text(encoding="utf-8").replace(
            f'<a href="{self.path}">Read PDF</a>', ""), encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, "PDF reading link missing"):
            check_resources(self.out, self.root)

    def test_duplicate_article_anchor(self):
        file = self.out / f"blog/{self.slug}/index.html"
        file.write_text(file.read_text(encoding="utf-8") + f'<p id="{self.anchor}"></p>',
                        encoding="utf-8")
        with self.assertRaisesRegex(AssertionError, "duplicated article anchor"):
            check_resources(self.out, self.root)

    def test_empty_library(self):
        self.source.unlink()
        for folder in (self.root, self.out):
            (folder / self.path.lstrip("/")).unlink()
        check_resources(self.out, self.root)


if __name__ == "__main__":
    unittest.main()
