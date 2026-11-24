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


def pptx(extra=None, order=(1, 2), external=False):
    data = io.BytesIO()
    with zipfile.ZipFile(data, "w") as archive:
        archive.writestr("[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Override PartName="/ppt/presentation.xml" ContentType="' + documents.PPTX_CONTENT_TYPE + '"/></Types>')
        archive.writestr("ppt/presentation.xml",
            '<p:presentation xmlns:p="' + documents.PRESENTATION[1:-1] + '" xmlns:r="' + documents.OFFICE_REL[1:-1] + '">'
            '<p:sldIdLst>' + "".join(f'<p:sldId id="{256+n}" r:id="rId{n}"/>' for n in order) +
            '</p:sldIdLst></p:presentation>')
        archive.writestr("ppt/_rels/presentation.xml.rels",
            '<Relationships xmlns="' + documents.PACKAGE_REL[1:-1] + '">' +
            "".join(f'<Relationship Id="rId{n}" Type="{documents.OFFICE_REL[1:-1]}/slide" Target="slides/slide{n}.xml"'
                    + (' TargetMode="External"' if external else '') + '/>' for n in (1, 2)) +
            '</Relationships>')
        for n, text in ((1, "First &amp; safe"), (2, "Second")):
            archive.writestr(f"ppt/slides/slide{n}.xml",
                '<p:sld xmlns:p="' + documents.PRESENTATION[1:-1] + '" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:t>' + text + '</a:t></p:sld>')
        if extra:
            archive.writestr(*extra)
    return data.getvalue()


class AttachmentTests(unittest.TestCase):
    def test_html_inert_storage_and_original_download_name(self):
        raw = b"<script>alert(1)</script>\r\n{{ site.title }}"
        storage, item = documents.prepare_document(raw, "example", "html.txt")
        self.assertTrue(storage.endswith(".html.txt"))
        self.assertEqual(storage, item["name"] + ".txt")
        self.assertEqual(item["format"], "HTML")
        self.assertEqual(item["document_preview"], raw.decode())
        self.assertTrue(item["id"].endswith("-html"))
        url = URL.replace(".pptx", ".html.txt")
        self.assertEqual(documents.own_source(url, PREFIX, ACCOUNT).groups(), ("my-slides", "html.txt"))
        self.assertIsNone(documents.own_source(url[:-4], PREFIX, ACCOUNT))
        for invalid in (b"\xff", b"\x00", b"---\nlayout: page\n---\n"):
            with self.assertRaises(ValueError):
                documents.prepare_document(invalid, "example", "html")

    def test_word_text_and_archive_safety(self):
        def word(extra=None, macro=False):
            data = io.BytesIO()
            with zipfile.ZipFile(data, "w") as archive:
                kind = "application/vnd.ms-word.document.macroEnabled.main+xml" if macro else documents.DOCX_CONTENT_TYPE
                archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="' + kind + '"/></Types>')
                archive.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
                archive.writestr("word/document.xml", '<w:document xmlns:w="' + documents.WORD[1:-1] + '"><w:body><w:p><w:r><w:t>Hello &amp; नमस्ते</w:t><w:tab/><w:t>World</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:body></w:document>')
                if extra:
                    archive.writestr(*extra)
            return data.getvalue()
        name, item = documents.prepare_document(word(), "guide", "docx")
        self.assertTrue(name.endswith(".docx"))
        self.assertEqual(item["document_preview"], "Hello & नमस्ते\tWorld\nSecond")
        self.assertFalse(item["document_truncated"])
        for raw in (b"not a zip", word(macro=True), word(("word/embeddings/object.bin", b"x")),
                    word(("../bad", b"x")), word(("word/_rels/document.xml.rels",
                        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://example/attachedTemplate" TargetMode="External" Target="https://example.invalid/"/></Relationships>'))):
            with self.assertRaises(ValueError):
                documents.prepare_document(raw, "guide", "docx")

    def test_markdown_preserves_bytes_and_inert_source(self):
        raw = "\ufeff# नमस्ते\r\n<script>alert(1)</script>\n{{ site.title }}".encode("utf-8")
        name, item = documents.prepare_document(raw, "guide", "md")
        self.assertTrue(name.endswith(".md"))
        self.assertEqual(item["format"], "MD")
        self.assertEqual(item["bytes"], len(raw))
        self.assertEqual(item["sha256"], __import__("hashlib").sha256(raw).hexdigest())
        self.assertEqual(item["markdown_preview"], raw.decode("utf-8-sig"))
        self.assertFalse(item["markdown_truncated"])
        self.assertTrue(item["id"].endswith("-md"))

    def test_markdown_preview_limit_and_invalid_text(self):
        with patch.object(documents, "MAX_PREVIEW", 4):
            _, item = documents.prepare_document(b"# A long document", "guide", "md")
            self.assertEqual(item["markdown_preview"], "# A ")
            self.assertTrue(item["markdown_truncated"])
        for raw in (b"\xff", b"\x00abc", b" \n", b"---\nlayout: page\n---\n", b"\xef\xbb\xbf---\r\n"):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                documents.prepare_document(raw, "guide", "md")

    def test_markdown_collect_preserves_file(self):
        url = URL.replace(".pptx", ".md")
        raw = b"# Guide\r\n"
        with patch.object(documents, "fetch_document", return_value=raw):
            markup, assets, files = documents.collect(
                f'<a href="{url}">Guide</a>', PREFIX, ACCOUNT, "article",
                re.compile(r"<a[^>]*>"),
                lambda token: {"href": url})
        self.assertEqual(len(assets), 1)
        self.assertEqual(files[assets[0]["name"]], raw)
        self.assertIn("#" + assets[0]["id"], markup)
        self.assertNotIn(PREFIX, markup)

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

    def test_relationship_order_is_authoritative(self):
        _, item = documents.prepare_document(pptx(order=(2, 1)), "slides", "pptx")
        self.assertEqual(item["slides"], [{"number": 1, "text": "Second"}, {"number": 2, "text": "First & safe"}])
        for data in (pptx(order=(1, 1)), pptx(order=(3,)), pptx(external=True)):
            with self.assertRaises(ValueError):
                documents.prepare_document(data, "slides", "pptx")

    def test_xml_entity_declarations_rejected(self):
        data = io.BytesIO()
        with zipfile.ZipFile(data, "w") as archive:
            archive.writestr("bad.xml", '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY y "secret">]><x>&y;</x>')
            archive.writestr("utf16.xml", '<x>unsafe encoding</x>'.encode("utf-16"))
        with zipfile.ZipFile(data) as archive:
            for name in ("bad.xml", "utf16.xml"):
                with self.assertRaises(ValueError):
                    documents.read_xml(archive, name)

    def test_invalid_or_embedded_presentation(self):
        for data in (b"not a zip", pptx(("ppt/vbaProject.bin", b"macro")),
                     pptx(("ppt/embeddings/object.bin", b"embedded"))):
            with self.assertRaises(ValueError):
                documents.prepare_document(data, "slides", "pptx")

    def test_ambiguous_zip_names_are_rejected(self):
        for name in ("../outside.xml", "/absolute.xml", "ppt/../outside.xml",
                     "ppt//empty.xml", "ppt/slide:1.xml", "ppt/SLIDES/SLIDE1.XML"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                documents.prepare_document(pptx((name, b"x")), "slides", "pptx")

    def test_symlink_members_are_rejected(self):
        import stat
        info = zipfile.ZipInfo("ppt/link")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        with self.assertRaises(ValueError):
            documents.prepare_document(pptx((info, b"elsewhere")), "slides", "pptx")

    def test_invalid_filename_stem_is_rejected(self):
        for stem in ("../outside", "", "a/b", "a" * 61, "UPPER"):
            with self.subTest(stem=stem), self.assertRaises(ValueError):
                documents.prepare_document(PDF, stem, "pdf")

    def test_preview_budget_does_not_skip_invalid_slide(self):
        source = io.BytesIO(pptx())
        target = io.BytesIO()
        with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w") as modified:
            for name in original.namelist():
                data = original.read(name)
                if name == "ppt/slides/slide2.xml":
                    data = b"<broken"
                modified.writestr(name, data)
        with patch.object(documents, "MAX_PREVIEW", 1), self.assertRaises(ValueError):
            documents.prepare_document(target.getvalue(), "slides", "pptx")

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
