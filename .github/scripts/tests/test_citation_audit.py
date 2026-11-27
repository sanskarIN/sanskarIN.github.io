"""Test the HTML citation audit without a Jekyll installation."""

import html
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from citation_audit import FIELDS, CitationMarkup, citation_errors


EXPECTED = {
    "title": "Compiler & language design",
    "subtitle": "कंप्यूटर और कोड",
    "author": "Research Group",
    "site": "Engineering Notes",
    "date": "2026-09-15",
    "updated": "2026-11-27",
    "url": "https://example.test/research/compiler/",
    "language": "en",
    "version": "1.2",
}


def fixture(metadata=EXPECTED):
    attributes = " ".join(
        f'data-citation-{key}="{html.escape(metadata.get(key, ""), quote=True)}"'
        for key in FIELDS
    )
    url = html.escape(metadata["url"], quote=True)
    return (
        '<!doctype html><html><head>'
        f'<link rel="canonical" href="{url}">'
        '<link rel="stylesheet" href="/assets/css/publication-citation.css?v=1">'
        '<script src="/assets/js/publication-citation.js?v=1" defer></script>'
        '</head><body>'
        f'<section aria-labelledby="publication-citation-title" data-citation-panel {attributes}>'
        '<h2 id="publication-citation-title">Cite this publication</h2>'
        '<p class="publication-citation__reference">'
        f'<a href="{url}">Reference</a></p>'
        '<div data-citation-controls hidden>'
        '<label for="publication-citation-format">Format</label>'
        '<select id="publication-citation-format" data-citation-format aria-controls="publication-citation-output">'
        '<option value="text">Text</option><option value="markdown">Markdown</option>'
        '<option value="bibtex">BibTeX</option><option value="ris">RIS</option>'
        '<option value="csl">CSL JSON</option></select>'
        '<label for="publication-citation-output">Output</label>'
        '<textarea id="publication-citation-output" data-citation-output readonly></textarea>'
        '<button type="button" data-citation-copy>Copy</button>'
        '<button type="button" data-citation-download>Download</button>'
        '<p data-citation-status role="status"></p>'
        '</div></section></body></html>'
    )


class CitationAuditTests(unittest.TestCase):
    def errors(self, source, expected=EXPECTED):
        return "\n".join(citation_errors(source, expected))

    def test_complete_panel_passes(self):
        self.assertEqual(self.errors(fixture()), "")

    def test_unicode_and_entities_are_decoded(self):
        doc = CitationMarkup(fixture())
        self.assertEqual(doc.panels[0]["data-citation-title"], EXPECTED["title"])
        self.assertEqual(doc.panels[0]["data-citation-subtitle"], EXPECTED["subtitle"])

    def test_optional_metadata_may_be_empty(self):
        expected = {**EXPECTED, "subtitle": "", "updated": "", "version": ""}
        self.assertEqual(self.errors(fixture(expected), expected), "")

    def test_metadata_drift_is_detected(self):
        source = fixture({**EXPECTED, "title": "Other title", "date": "2026-01-01"})
        errors = self.errors(source)
        self.assertIn("citation title differs", errors)
        self.assertIn("citation date differs", errors)

    def test_wrong_canonical_url_is_detected(self):
        source = fixture().replace(
            'rel="canonical" href="' + EXPECTED["url"],
            'rel="canonical" href="https://example.test/other/',
        )
        self.assertIn("reference URL differs", self.errors(source))

    def test_static_reference_must_be_visible_without_script(self):
        source = fixture().replace('class="publication-citation__reference"', 'class="publication-citation__reference" hidden')
        self.assertIn("static citation must remain visible", self.errors(source))

    def test_duplicate_panel_is_detected(self):
        source = fixture().replace("</body>", '<section data-citation-panel></section></body>')
        self.assertIn("exactly one citation panel", self.errors(source))

    def test_duplicate_control_id_is_detected(self):
        source = fixture().replace("</body>", '<p id="publication-citation-format">Extra</p></body>')
        self.assertIn("duplicate citation IDs", self.errors(source))

    def test_missing_and_duplicate_formats_are_detected(self):
        source = fixture().replace('value="ris"', 'value="bibtex"')
        self.assertIn("citation formats are incomplete or duplicated", self.errors(source))

    def test_controls_require_accessible_labels(self):
        source = fixture().replace('for="publication-citation-output"', 'for="wrong"')
        self.assertIn("output label", self.errors(source))

    def test_enhancement_controls_start_hidden(self):
        source = fixture().replace('data-citation-controls hidden', 'data-citation-controls')
        errors = self.errors(source)
        self.assertIn("enhancement controls must start hidden", errors)
        self.assertIn("format control must be inside", errors)

    def test_copy_download_and_status_semantics(self):
        source = fixture().replace('type="button" data-citation-copy', 'type="submit" data-citation-copy')
        source = source.replace('data-citation-status role="status"', 'data-citation-status role="note"')
        errors = self.errors(source)
        self.assertIn("copy button must not submit", errors)
        self.assertIn("citation status lacks live semantics", errors)

    def test_read_only_output_is_required(self):
        source = fixture().replace('data-citation-output readonly', 'data-citation-output')
        self.assertIn("formatted reference must be read-only", self.errors(source))

    def test_missing_assets_are_detected(self):
        source = fixture().replace("publication-citation.js", "main.js").replace("publication-citation.css", "main.css")
        errors = self.errors(source)
        self.assertIn("citation script missing", errors)
        self.assertIn("citation stylesheet missing", errors)


if __name__ == "__main__":
    unittest.main()
