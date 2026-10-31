"""Test the Python version of the site's JSON interfaces."""

import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from terminal_data import ROOT, parse_front_matter, published_posts, site_url, terminal_data
from check_data_parity import diff_paths, validate_search


class DataParityTests(unittest.TestCase):
    def test_terminal_matches_browser_schema(self):
        value = terminal_data()
        self.assertEqual(set(value), {
            "name", "username", "community", "tagline", "pages",
            "profiles", "support", "emails", "focus", "technologies",
            "projects", "posts", "links",
        })
        self.assertTrue(value["name"])
        self.assertTrue(value["pages"])
        self.assertEqual(len(value["posts"]), min(len(published_posts(ROOT)), 5))
        self.assertEqual(value["links"]["blog"], "/blog/")
        self.assertTrue(all(p["url"].startswith("/blog/") for p in value["posts"]))

    def test_terminal_values_use_real_site_data(self):
        result = terminal_data()
        github = json.loads((ROOT / "_data/github.json").read_text(encoding="utf-8"))
        if github.get("repositories"):
            self.assertEqual(result["projects"]["total"], github["totals"]["repositories"])
            self.assertEqual(result["projects"]["stars"], github["totals"]["stars"])
        self.assertEqual(result["pages"][0]["url"], "/")
        self.assertTrue(any(p["key"] == "github" for p in result["profiles"]))
        self.assertEqual({e["label"] for e in result["emails"]}, {"Business", "Support"})

    def test_slug_date_and_public_url_are_stable(self):
        posts = published_posts(ROOT)
        self.assertGreaterEqual(len(posts), 1)
        self.assertEqual(len({p["url"] for p in posts}), len(posts))
        for p in posts:
            self.assertEqual(p["url"], "/blog/" + p["_source"][11:].rsplit(".", 1)[0] + "/")
            self.assertRegex(p["date"], r"^\d{1,2} [A-Z][a-z]{2} \d{4}$")

    def test_site_relative_url_does_not_accept_external_paths(self):
        self.assertEqual(site_url("/", ""), "/")
        self.assertEqual(site_url("/blog/", "/portfolio"), "/portfolio/blog/")
        self.assertEqual(site_url("/", "portfolio"), "/portfolio/")
        for bad in ("https://bad.example/", "//external.example", "blog/"):
            with self.subTest(value=bad), self.assertRaises(ValueError):
                site_url(bad, "")

    def test_diff_reports_only_paths_and_detects_changes(self):
        first = {"a": [1, {"b": "first"}], "c": True}
        second = {"a": [1, {"b": "second"}], "c": True}
        self.assertEqual(diff_paths(first, first), [])
        self.assertEqual(diff_paths(first, second), ["$.a[1].b (value)"])
        self.assertEqual(diff_paths(first, {"a": []}), ["$.a (length 2 vs 0)", "$.c (missing/extra)"])

    def test_search_index_requires_all_navigation_pages(self):
        fake = {
            "pages": [{"url": "/missing/"}],
        }
        self.assertRaisesRegex(
            AssertionError, "Navigation page absent",
            validate_search, ROOT, ROOT, fake
        )


if __name__ == "__main__":
    unittest.main()
