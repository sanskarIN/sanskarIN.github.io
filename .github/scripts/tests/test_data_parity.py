"""Test the Python version of the site's JSON interfaces."""

import json
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from terminal_data import ROOT, read_yaml, parse_front_matter, published_posts, site_url, terminal_data, render_terminal_json
from check_data_parity import diff_paths


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

    def test_primary_developer_profiles_match_main_username(self):
        """Keep professional links, visible handles, and the site identity aligned."""
        config = read_yaml(ROOT, "_config.yml")
        profiles = read_yaml(ROOT, "_data/social.yml")["profiles"]
        username = config["author"]["username"]
        expected = {
            "linkedin": ("www.linkedin.com", f"/in/{username}", username),
            "devto": ("dev.to", f"/{username}", username),
            "bluesky": (
                "bsky.app",
                f"/profile/{username}.bsky.social",
                f"@{username}.bsky.social",
            ),
        }
        for service, (hostname, path, handle) in expected.items():
            with self.subTest(service=service):
                profile = profiles[service]
                url = urlsplit(profile["url"])
                self.assertEqual(profile["username"].casefold(), username.casefold())
                self.assertEqual(profile["handle"].casefold(), handle.casefold())
                self.assertEqual(url.scheme, "https")
                self.assertEqual(url.hostname, hostname)
                self.assertEqual(url.path.rstrip("/").casefold(), path.casefold())
                self.assertFalse(url.query or url.fragment)


    def test_buy_me_a_coffee_identity_matches_profile(self):
        """Keep the current support link and displayed username consistent."""
        config = read_yaml(ROOT, "_config.yml")
        profile = read_yaml(ROOT, "_data/social.yml")["profiles"]["buymeacoffee"]
        username = config["author"]["username"]
        url = urlsplit(profile["url"])
        self.assertEqual(url.scheme, "https")
        self.assertEqual(url.hostname, "buymeacoffee.com")
        self.assertEqual(url.path.strip("/").casefold(), username.casefold())
        self.assertEqual(profile["handle"].casefold(), username.casefold())
        self.assertEqual(profile["username"].casefold(), username.casefold())
        self.assertFalse(url.query or url.fragment)

    def test_github_sponsors_url_and_support_discovery(self):
        """Keep funding, website cards, and the terminal support command aligned."""
        config = read_yaml(ROOT, "_config.yml")
        username = config["author"]["username"]
        social = read_yaml(ROOT, "_data/social.yml")
        profile = social["profiles"]["github_sponsors"]
        url = urlsplit(profile["url"])
        self.assertEqual(url.scheme, "https")
        self.assertEqual(url.hostname, "github.com")
        self.assertEqual(url.path.casefold(), f"/sponsors/{username}".casefold())
        self.assertFalse(url.query or url.fragment)
        self.assertEqual(profile["handle"].casefold(), username.casefold())
        self.assertIs(profile["same_as"], False)
        self.assertIn("github_sponsors", social["groups"]["products"]["items"])
        sponsorship = [item for item in terminal_data()["support"] if item["key"] == "github_sponsors"]
        self.assertEqual(len(sponsorship), 1)
        self.assertEqual(sponsorship[0]["url"], profile["url"])

    def test_slug_date_and_public_url_are_stable(self):
        posts = published_posts(ROOT)
        self.assertGreaterEqual(len(posts), 1)
        self.assertEqual(len({p["url"] for p in posts}), len(posts))
        for p in posts:
            self.assertEqual(p["url"], "/blog/" + p["_source"][11:].rsplit(".", 1)[0] + "/")
            self.assertRegex(p["date"], r"^\d{1,2} [A-Z][a-z]{2} \d{4}$")

    def test_published_terminal_feed_is_current_and_plain_json(self):
        source = (ROOT / "terminal.json").read_text(encoding="utf-8")
        self.assertEqual(source, render_terminal_json(ROOT))
        self.assertFalse(source.startswith("---"))
        self.assertNotIn("{%", source)
        self.assertNotIn("{{", source)
        value = json.loads(source)
        self.assertEqual(value, terminal_data(ROOT))
        self.assertEqual(value["links"]["contact"], "/contact/")

    def test_feed_contains_only_public_project_and_blog_fields(self):
        value = json.loads(render_terminal_json())
        self.assertEqual(len(value["posts"]), min(5, len(published_posts(ROOT))))
        for item in value["posts"]:
            self.assertEqual(set(item), {"title", "url", "date"})
        if value["projects"] is not None:
            for item in value["projects"]["featured"]:
                self.assertEqual(set(item), {"name", "url", "description", "language", "stars"})

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

    def test_bad_post_front_matter_is_rejected(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "post.md"
            path.write_text("no front matter", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Missing front matter"):
                parse_front_matter(path)
            path.write_text("---\ntitle: hi\nbody", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Unclosed front matter"):
                parse_front_matter(path)


if __name__ == "__main__":
    unittest.main()
