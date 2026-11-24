"""Regression tests for the attachment publisher (stdlib only)."""
import io
import re
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import blog_attachments as documents

PREFIX = "https://example.invalid/storage/v1/object/public/blog-attachments/"
ACCOUNT = {"id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}
FILENAME = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-my-slides.pptx"
URL = PREFIX + ACCOUNT["id"] + "/" + FILENAME
PDF = b"%PDF-1.7\nsample\n%%EOF\n"


def pptx(extra=None):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("ppt/presentation.xml", "<presentation/>")
        archive.writestr("ppt/slides/slide2.xml", '<p:sld xmlns:p="p" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>Second</a:t></p:sld>')
        archive.writestr("ppt/slides/slide1.xml", '<p:sld xmlns:p="p" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>First &amp; safe</a:t></p:sld>')
        if extra:
            archive.writestr(*extra)
    return data.getvalue()


class AttachmentTests(unittest.TestCase):
    def test_source_prefix_and_ownership(self):
        self.assertEqual(documents.source_prefix(PREFIX.replace("blog-attachments", "blog-images")), PREFIX)
        self.assertEqual(documents.own_source(URL, PREFIX, ACCOUNT).groups(), ("my-slides", "pptx"))
        for invalid in (URL + "?x=1", URL.replace("my-slides", "../secret"), URL.replace(ACCOUNT["id"], "different")):
            self.assertIsNone(documents.own_source(invalid, PREFIX, ACCOUNT))
        self.assertIsNone(documents.own_source(URL, PREFIX, None))

    def test_size_and_file_type(self):
        for payload in (b"", b"x" * documents.MAX_BYTES, b"<html>fake PDF</html>"):
            with self.assertRaises(ValueError):
                documents.prepare_document(payload, "test", "pdf")
        name, item = documents.prepare_document(PDF, "sample", "pdf")
        self.assertTrue(name.startswith("sample-"))
        self.assertTrue(name.endswith(".pdf"))
        self.assertEqual(item["bytes"], len(PDF))
        self.assertEqual(len(item["sha256"]), 64)
        self.assertEqual(item["slides"], [])

    def test_presentation_text_and_order(self):
        name, item = documents.prepare_document(pptx(), "my-slides", "pptx")
        self.assertTrue(name.endswith(".pptx"))
        self.assertEqual(item["slides"], [{"number": 1, "text": "First & safe"}, {"number": 2, "text": "Second"}])

    def test_invalid_or_embedded_presentation(self):
        for data in (b"not a zip", pptx(("ppt/vbaProject.bin", b"macro")),
                     pptx(("ppt/embeddings/object.bin", b"embedded"))):
            with self.assertRaises(ValueError):
                documents.prepare_document(data, "slides", "pptx")

    def test_collect_rewrites_links_and_deduplicates(self):
        pattern = re.compile(r'<a\b[^>]*>|</a>')
        def attrs(token):
            match = re.search(r'href="([^"]+)"', token)
            return {"href": match.group(1)} if match else {}
        with patch.object(documents, "fetch_document", return_value=pptx()) as fetch:
            markup, assets, files = documents.collect(
                f'<a href="{URL}">Deck</a> <a href="{URL}">Again</a>',
                PREFIX, ACCOUNT, "article", pattern, attrs)
            self.assertEqual(fetch.call_count, 1)
            self.assertEqual(len(assets), 1)
            self.assertEqual(len(files), 1)
            self.assertEqual(markup.count("#" + assets[0]["id"]), 2)
            self.assertNotIn(PREFIX, markup)
            self.assertTrue(assets[0]["path"].startswith("/assets/files/blog/article/"))
        with self.assertRaises(ValueError):
            documents.collect(f'<a href="{URL}">Deck</a>', PREFIX, None, "article", pattern, attrs)


if __name__ == "__main__":
    unittest.main()
