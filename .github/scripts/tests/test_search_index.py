"""Tests for Python-authored page, blog and project search entries."""

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from search_index import search_index, searchable_pages, post_excerpt, strip_html, render_search_json
from terminal_data import ROOT


class SearchIndexTests(unittest.TestCase):
    def test_python_index_is_complete_and_has_unique_urls(self):
        items = search_index()
        self.assertTrue(items)
        urls = [item["url"] for item in items]
        self.assertEqual(len(urls), len(set(urls)))
        self.assertTrue(all(item["title"] and item["url"] for item in items))
        self.assertEqual({item["type"] for item in items}, {"Page", "Post", "Project"})

    def test_published_search_feed_is_fresh_and_valid_json(self):
        raw = (ROOT / "search.json").read_text(encoding="utf-8")
        self.assertEqual(raw, render_search_json(ROOT))
        self.assertFalse(raw.startswith("---"))
        self.assertNotIn("{%", raw)
        self.assertNotIn("{{", raw)
        self.assertEqual(json.loads(raw), search_index(ROOT))

    def test_search_contract_and_order_are_stable(self):
        data = json.loads(render_search_json())
        self.assertEqual([name for name in ("Page", "Post", "Project")
                          if any(row["type"] == name for row in data)],
                         ["Page", "Post", "Project"])
        order = {"Page": 0, "Post": 1, "Project": 2}
        self.assertEqual([order[e["type"]] for e in data],
                         sorted(order[e["type"]] for e in data))
        for entry in data:
            self.assertTrue(entry["text"] or entry["type"] == "Page")
            expected = {
                "Page": {"type", "title", "url", "text"},
                "Post": {"type", "title", "url", "date", "tags", "text"},
                "Project": {"type", "title", "url", "tags", "text"},
            }[entry["type"]]
            self.assertEqual(set(entry), expected)

    def test_pages_include_public_routes_not_private_pages(self):
        pages = searchable_pages()
        urls = {entry["url"] for entry in pages}
        for expected in ("/", "/about/", "/developer/", "/contact/", "/projects/", "/blog/", "/Kahani/"):
            self.assertIn(expected, urls)
        for excluded in ("/404.html", "/account/", "/account/write/", "/contact/sent/"):
            self.assertNotIn(excluded, urls)
        for entry in pages:
            self.assertEqual(set(entry), {"type", "title", "url", "text"})

    def test_post_entries_match_markdown_metadata(self):
        entries = [e for e in search_index() if e["type"] == "Post"]
        self.assertTrue(entries)
        self.assertTrue(all(e["url"].startswith("/blog/") for e in entries))
        self.assertTrue(all(isinstance(e["tags"], list) for e in entries))
        self.assertTrue(all(isinstance(e["date"], str) for e in entries))
        self.assertTrue(all(e["text"] for e in entries))

    def test_project_entries_use_actual_github_data(self):
        repos = json.loads((ROOT / "_data/github.json").read_text(encoding="utf-8"))
        actual = [e for e in search_index() if e["type"] == "Project"]
        self.assertEqual(len(actual), len(repos["repositories"]))
        for entry, repo in zip(actual, repos["repositories"]):
            self.assertEqual(entry["title"], repo["name"])
            self.assertEqual(entry["url"], repo["url"])
            self.assertEqual(entry["tags"], repo["topics"])

    def test_markup_is_not_executed_in_plain_excerpts(self):
        self.assertEqual(strip_html("<p>Example &amp; more <strong>text</strong></p>"),
                         "Example & more text")
        with TemporaryDirectory() as folder:
            path = Path(folder) / "entry.md"
            path.write_text("---\ntitle: Test\n---\n<p>Searchable <strong>text</strong></p>", encoding="utf-8")
            preview = post_excerpt(path)
            self.assertIn("Searchable", preview)
            self.assertNotIn("<strong>", preview)


if __name__ == "__main__":
    unittest.main()
