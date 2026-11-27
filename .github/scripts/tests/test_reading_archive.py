"""Fixture-based tests for the rendered publication archive contract."""

import html
import json
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from check_reading_archive import Document, Publication, audit_archive


POSTS = [
    Publication("/blog/compiler/", "Compiler & tools", "2026", "en",
                frozenset({"C++", "compiler"}), "article", 0),
    Publication("/research/hardware/", "कंप्यूटर की संरचना", "2026", "hi",
                frozenset({"research", "hardware"}), "research", 2),
    Publication("/research/cafe/", "Café", "2025", "fr",
                frozenset({"research", "systems"}), "research", 1),
]


def escape(value):
    return html.escape(str(value), quote=True)


def filter_control(key):
    control_id = "archive-" + key
    attrs = f'id="{control_id}" aria-controls="archive-results" data-archive-{key}'
    if key == "q":
        element = f'<input {attrs} type="search" maxlength="160" aria-describedby="filter-help">'
    else:
        element = f'<select {attrs}><option value="">All</option></select>'
    return f'<label for="{control_id}">{key}</label>' + element


def publication_item(post):
    data = {
        "data-archive-language": post.language,
        "data-archive-topics": json.dumps(sorted(post.topics), ensure_ascii=False),
        "data-archive-kind": post.kind,
        "data-archive-files": str(post.files),
    }
    attrs = " ".join(f'{key}="{escape(value)}"' for key, value in data.items())
    attachment = f'<a href="{post.url}#post-attachments-title">Resources</a>' if post.files else ""
    return (
        f'<li data-archive-item {attrs}>'
        f'<article><h4 class="post-card__title"><a href="{post.url}">{escape(post.title)}</a></h4>'
        f'{attachment}</article></li>'
    )


def fixture(posts=POSTS, research=False):
    chosen = [post for post in posts if not research or post.kind == "research"]
    script = '<script src="/assets/js/reading-archive.js?v=123" defer></script>'
    if not chosen:
        return f'<!doctype html><html><head>{script}</head><body><p>No posts</p></body></html>'
    keys = ["q", "language", "year", "topic", "files"]
    if not research:
        keys.insert(4, "kind")
    form = (
        '<form data-archive-filter role="search" aria-label="Filter" hidden>'
        '<p id="filter-help">Search titles or combine filters.</p>'
        + "".join(filter_control(key) for key in keys)
        + '<p data-archive-status role="status"></p>'
        + '<button data-archive-reset type="button" disabled>Clear</button></form>'
    )
    groups = []
    for year in sorted({post.year for post in chosen}, reverse=True):
        items = [post for post in chosen if post.year == year]
        groups.append(
            f'<section data-archive-year-group="{year}"><h3>{year}'
            f'<span data-archive-year-count>· {len(items)} publications</span></h3>'
            '<ul>' + "".join(publication_item(post) for post in items) + '</ul></section>'
        )
    return (
        f'<!doctype html><html><head>{script}</head><body>{form}'
        '<section id="archive-results" data-archive-results>'
        '<p data-archive-empty hidden>No results. Clear filters.</p>'
        + "".join(groups) + '</section></body></html>'
    )


class ParserTests(unittest.TestCase):
    def test_text_and_attribute_entities_are_decoded(self):
        doc = Document('<p id="a&amp;b">Compiler &amp; tools <strong>Rust</strong></p>')
        node = doc.root.find(attr="id", value="a&b")[0]
        self.assertEqual(node.text(), "Compiler & tools Rust")

    def test_void_tags_do_not_contain_following_controls(self):
        doc = Document('<form><input type="search"><label>Label</label></form>')
        form = doc.root.find(tag="form")[0]
        self.assertEqual([node.tag for node in form.children], ["input", "label"])

    def test_hidden_ancestors_are_detected(self):
        doc = Document('<section hidden><ul><li>Hidden</li></ul></section><li>Visible</li>')
        nodes = doc.root.find(tag="li")
        self.assertTrue(nodes[0].hidden())
        self.assertFalse(nodes[1].hidden())

    def test_find_uses_exact_class_tokens(self):
        doc = Document('<p class="post-card__title extra"></p><p class="post-card__title-large"></p>')
        self.assertEqual(len(doc.root.find(css_class="post-card__title")), 1)

    def test_nested_text_preserves_document_order(self):
        doc = Document('<h4>One <a>Two <em>three</em></a> four</h4>')
        self.assertEqual(doc.root.find(tag="h4")[0].text(), "One Two three four")


class ArchiveAuditTests(unittest.TestCase):
    def errors(self, source, route="/articles/", posts=POSTS):
        return "\n".join(audit_archive(source, posts, route))

    def test_complete_articles_and_research_fixtures_pass(self):
        self.assertEqual(self.errors(fixture()), "")
        self.assertEqual(self.errors(fixture(research=True), "/research/"), "")

    def test_empty_archive_has_no_filter_or_list(self):
        self.assertEqual(self.errors(fixture([]), posts=[]), "")
        self.assertEqual(self.errors(fixture([POSTS[0]], research=True),
                                     "/research/", [POSTS[0]]), "")

    def test_missing_script_is_detected(self):
        source = fixture().replace("/assets/js/reading-archive.js", "/assets/js/main.js")
        self.assertIn("archive script missing", self.errors(source))

    def test_duplicate_script_is_detected(self):
        source = fixture().replace("</head>", '<script src="/assets/js/reading-archive.js"></script></head>')
        self.assertIn("archive script missing or duplicated", self.errors(source))

    def test_duplicate_dom_id_is_detected(self):
        source = fixture().replace("</body>", '<p id="archive-results"></p></body>')
        self.assertIn("duplicate DOM IDs", self.errors(source))

    def test_missing_control_label_is_detected(self):
        source = fixture().replace('for="archive-language"', 'for="unrelated"')
        self.assertIn("language label", self.errors(source))

    def test_incorrect_results_target_is_detected(self):
        source = fixture().replace('aria-controls="archive-results"', 'aria-controls="missing"', 1)
        self.assertIn("q does not identify", self.errors(source))

    def test_help_reference_must_exist(self):
        source = fixture().replace('id="filter-help"', 'id="not-filter-help"')
        self.assertIn("search help target is missing", self.errors(source))

    def test_controls_start_hidden_for_no_script_fallback(self):
        source = fixture().replace('aria-label="Filter" hidden', 'aria-label="Filter"')
        self.assertIn("controls must start hidden", self.errors(source))

    def test_live_status_and_reset_button_contract(self):
        source = fixture().replace('role="status"', 'role="note"').replace('type="button" disabled', 'type="submit"')
        errors = self.errors(source)
        self.assertIn("result status lacks live semantics", errors)
        self.assertIn("reset must not submit", errors)
        self.assertIn("reset should initially be disabled", errors)

    def test_research_does_not_need_publication_type_control(self):
        source = fixture(research=True).replace("</form>", filter_control("kind") + "</form>")
        self.assertIn("unexpected controls", self.errors(source, "/research/"))

    def test_duplicate_and_missing_publications_are_detected(self):
        source = fixture().replace(publication_item(POSTS[0]), publication_item(POSTS[1]))
        self.assertIn("each expected publication exactly once", self.errors(source))

    def test_wrong_language_type_and_attachment_count_are_detected(self):
        source = fixture().replace('data-archive-language="hi"', 'data-archive-language="en"')
        source = source.replace('data-archive-kind="research"', 'data-archive-kind="article"', 1)
        source = source.replace('data-archive-files="2"', 'data-archive-files="0"')
        errors = self.errors(source)
        self.assertIn("language mismatch", errors)
        self.assertIn("publication type mismatch", errors)
        self.assertIn("downloadable-resource count mismatch", errors)

    def test_invalid_topic_json_is_detected(self):
        source = fixture().replace(escape(json.dumps(sorted(POSTS[0].topics))), "{invalid}")
        self.assertIn("topic metadata mismatch", self.errors(source))

    def test_downloadable_resource_target_is_checked(self):
        source = fixture().replace('/research/hardware/#post-attachments-title', '/research/hardware/#missing')
        self.assertIn("attachment destination missing", self.errors(source))

    def test_hidden_publication_breaks_no_script_contract(self):
        source = fixture().replace('<li data-archive-item', '<li hidden data-archive-item', 1)
        self.assertIn("publication hidden before script", self.errors(source))

    def test_wrong_year_order_or_membership_is_detected(self):
        source = fixture().replace('data-archive-year-group="2026"', 'data-archive-year-group="2024"')
        errors = self.errors(source)
        self.assertIn("wrong year group", errors)
        self.assertIn("incorrect year order or coverage", errors)

    def test_incorrect_initial_count_is_detected(self):
        source = fixture().replace("· 2 publications", "· 1 publication")
        self.assertIn("initial year count mismatch", self.errors(source))

    def test_unexpected_publication_is_detected(self):
        extra = Publication("/blog/other/", "Other", "2026", "en", frozenset(), "article", 0)
        source = fixture().replace(publication_item(POSTS[0]), publication_item(extra))
        self.assertIn("unexpected publication", self.errors(source))

    def test_empty_state_must_be_hidden_initially(self):
        source = fixture().replace('data-archive-empty hidden', 'data-archive-empty')
        self.assertIn("empty state must be hidden", self.errors(source))


if __name__ == "__main__":
    unittest.main()
