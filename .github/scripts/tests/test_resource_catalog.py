"""Positive and negative fixtures for the built resource catalog audit."""

import html
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from check_resource_catalog import FORMATS, Resource, audit_catalog


ITEMS = [
    Resource("A guide & notes", "Architecture", "guide.pdf", "Lab", "PDF", 6000000,
             "en", "2026-11-20", "/assets/files/guide.pdf", "/research/architecture/", "guide", 1),
    Resource("कंप्यूटर", "Architecture", "slides.pptx", "Lab", "PPTX", 1000000,
             "hi", "2026-11-20", "/assets/files/slides.pptx", "/research/architecture/", "slides", 1),
    Resource("Source", "Web notes", "source.html", "Reader", "HTML", 512,
             "en", "2025-01-01", "/assets/files/source.html.txt", "/blog/web/", "source", 2),
    Resource("References", "Web notes", "sources.bib", "Reader", "BIB", 200,
             "en", "2025-01-01", "/assets/files/sources.bib", "/blog/web/", "references", 2),
]


def esc(value):
    return html.escape(str(value), quote=True)


def control(key, options=None):
    identifier = "resource-" + key
    attrs = f'id="{identifier}" data-resource-filter-{key} aria-controls="resource-results"'
    if options is None:
        tag = f'<input {attrs} type="search" maxlength="160" aria-describedby="help">'
    else:
        tag = f'<select {attrs}>' + "".join(
            f'<option value="{esc(option)}">{esc(option or "All")}</option>' for option in options
        ) + '</select>'
    return f'<label for="{identifier}">{key}</label>' + tag


def item_markup(item, first=False):
    attrs = " ".join(
        f'data-resource-{key}="{esc(getattr(item, key))}"'
        for key in ("title", "source", "name", "author", "format", "bytes", "language", "date")
    )
    anchor = f' id="resource-post-{item.source_index}"' if first else ""
    if item.format == "PDF":
        preview = f'<a href="{item.path}">Read PDF</a>'
    elif item.format in {"MD", "HTML", "DOCX", "BIB"}:
        preview = f'<a href="{item.detail_url}-preview">Read source</a>'
    else:
        preview = ""
    return (
        f'<li data-resource-item{anchor} {attrs}>'
        f'<h3 class="resource-entry__title"><a href="{item.detail_url}">{esc(item.title)}</a></h3>'
        f'<a href="{item.publication}">{esc(item.source)}</a>'
        f'<a href="{item.path}" download="{esc(item.name)}">Download</a>'
        f'{preview}</li>'
    )


def fixture(items=ITEMS):
    script = '<script src="/assets/js/resource-library.js?v=1" defer></script>'
    if not items:
        return f'<html><head>{script}</head><body><p>Empty library</p></body></html>'
    controls = (
        control("q") + control("format", ["", *sorted(FORMATS)])
        + control("language", ["", "en", "hi"])
        + control("year", [""])
        + control("size", ["", "small", "medium", "large"])
        + control("sort", ["newest", "oldest", "title", "largest", "smallest"])
    )
    form = (
        '<form role="search" aria-label="Filter resources" data-resource-filter hidden>'
        '<p id="help">Search the catalog</p>' + controls
        + '<p data-resource-status role="status"></p>'
        + '<button data-resource-reset type="button" disabled>Clear</button></form>'
    )
    entries = []
    seen = set()
    for item in items:
        entries.append(item_markup(item, item.source_index not in seen))
        seen.add(item.source_index)
    return (
        f'<html><head>{script}</head><body>{form}'
        '<section id="resource-results"><p data-resource-empty hidden>Clear filters to see all.</p>'
        '<ul data-resource-list>' + "".join(entries) + '</ul></section></body></html>'
    )


class CatalogTests(unittest.TestCase):
    def errors(self, markup, expected=ITEMS):
        return "\n".join(audit_catalog(markup, expected))

    def test_complete_catalog_passes(self):
        self.assertEqual(self.errors(fixture()), "")

    def test_empty_library_has_no_unusable_controls(self):
        self.assertEqual(self.errors(fixture([]), []), "")

    def test_duplicate_and_missing_entries_are_detected(self):
        source = fixture().replace(item_markup(ITEMS[1]), item_markup(ITEMS[0]))
        self.assertIn("each expected resource exactly once", self.errors(source))

    def test_default_order_is_checked(self):
        self.assertIn("default order differs", self.errors(fixture(list(reversed(ITEMS)))))

    def test_publication_group_anchors_are_preserved(self):
        source = fixture().replace('id="resource-post-2"', 'id="other"')
        self.assertIn("original publication group anchor missing", self.errors(source))

    def test_duplicate_ids_are_detected(self):
        source = fixture().replace("</body>", '<p id="resource-results"></p></body>')
        self.assertIn("duplicate DOM IDs", self.errors(source))

    def test_metadata_matches_actual_documents(self):
        source = fixture().replace('data-resource-bytes="6000000"', 'data-resource-bytes="1"')
        source = source.replace('data-resource-language="hi"', 'data-resource-language="en"')
        errors = self.errors(source)
        self.assertIn("bytes metadata differs", errors)
        self.assertIn("language metadata differs", errors)

    def test_file_name_and_download_path_are_checked(self):
        source = fixture().replace('download="guide.pdf"', 'download="other.pdf"')
        source = source.replace('<a href="/assets/files/guide.pdf" download', '<a href="/missing" download')
        errors = self.errors(source)
        self.assertIn("incorrect download filename", errors)
        self.assertIn("incorrect download path", errors)

    def test_html_and_bibtex_must_not_be_opened_as_active_content(self):
        for item in ITEMS[2:]:
            source = fixture().replace(f'<a href="{item.detail_url}-preview">Read source</a>',
                                       f'<a href="{item.path}">Open file</a>')
            self.assertIn("unsafe active document link", self.errors(source))
            self.assertIn("source preview link missing", self.errors(source))

    def test_pdf_reader_link_is_required(self):
        source = fixture().replace('<a href="/assets/files/guide.pdf">Read PDF</a>', '')
        self.assertIn("PDF reader link missing", self.errors(source))

    def test_source_publication_link_is_required(self):
        source = fixture().replace('<a href="/research/architecture/">Architecture</a>', '')
        self.assertIn("source publication link missing", self.errors(source))

    def test_documents_remain_visible_without_javascript(self):
        source = fixture().replace('<li data-resource-item', '<li hidden data-resource-item', 1)
        self.assertIn("hidden without JavaScript", self.errors(source))

    def test_controls_are_labelled_and_target_results(self):
        source = fixture().replace('for="resource-format"', 'for="missing"')
        source = source.replace('aria-controls="resource-results"', 'aria-controls="other"', 1)
        errors = self.errors(source)
        self.assertIn("format label", errors)
        self.assertIn("q: results target missing", errors)

    def test_filter_options_are_complete_and_unique(self):
        source = fixture().replace('value="PDF"', 'value="HTML"', 1)
        self.assertIn("format: duplicate options", self.errors(source))
        self.assertIn("format: incomplete filter options", self.errors(source))

    def test_status_and_reset_are_accessible(self):
        source = fixture().replace('role="status"', 'role="note"').replace('type="button" disabled', 'type="submit"')
        errors = self.errors(source)
        self.assertIn("result status must have live semantics", errors)
        self.assertIn("reset must not submit", errors)
        self.assertIn("reset must initially be disabled", errors)

    def test_script_and_empty_state_are_checked(self):
        source = fixture().replace("resource-library.js", "main.js").replace("data-resource-empty hidden", "data-resource-empty")
        errors = self.errors(source)
        self.assertIn("resource library script missing", errors)
        self.assertIn("empty state must be hidden", errors)


if __name__ == "__main__":
    unittest.main()
