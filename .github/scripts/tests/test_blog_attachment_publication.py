"""Exercise document publication end-to-end without network or repository writes."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import blog_attachments
import publish_post


class PublicationTests(unittest.TestCase):
    def test_custom_and_automatic_slug_collisions(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.multiple(publish_post, POSTS_DIR=root / "_posts",
                                IMAGES_DIR=root / "images", ATTACHMENTS_DIR=root / "files"):
                (root / "_posts").mkdir()
                (root / "_posts/2026-01-01-existing.md").touch()
                (root / "_posts/2026-01-01-existing-42.md").touch()
                (root / "files/orphan").mkdir(parents=True)
                self.assertEqual(publish_post.new_slug("Any title", 42, "my-research"), "my-research")
                self.assertEqual(publish_post.new_slug("Existing", 42), "existing-42-2")
                self.assertEqual(publish_post.new_slug("नमस्ते", 42), "post-42")
                self.assertEqual(publish_post.new_slug("Authors", 42), "authors-42")
                for invalid in ("existing", "orphan", "authors", "posts", "a--b", "../bad",
                                "UPPER", "a/b", "a" * 61, "a-", "-a", "a b"):
                    with self.subTest(slug=invalid), self.assertRaises(publish_post.PostProblem):
                        publish_post.new_slug("Title", 42, invalid)
                self.assertTrue(publish_post.valid_custom_slug("a" * 60))

    def test_create_update_remove_document(self):
        account = {"id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                   "username": "reader", "name": "Reader"}
        prefix = "https://example.invalid/storage/v1/object/public/blog-attachments/"
        url = prefix + account["id"] + "/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-guide.pdf"
        issue = {"number": 42, "user": {"login": "owner"},
                 "created_at": "2026-01-01T00:00:00Z"}
        settings = {"account_images": prefix.replace("blog-attachments", "blog-images"),
                    "owner_username": "owner", "owner_name": "Owner", "images_per_post": 20}
        form = {"title": "Guide", "subtitle": "A study of नमस्ते & computing", "requested_slug": "custom-guide", "summary": "A guide", "tags": [],
                "content_language": "hi", "cover_url": None, "cover_alt": "", "notes": [],
                "markdown": f"Read the [guide]({url})."}
        payload = b"%PDF-1.7\nsample\n%%EOF\n"
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.multiple(publish_post, POSTS_DIR=root / "_posts",
                                IMAGES_DIR=root / "images", ATTACHMENTS_DIR=root / "files"), \
                    patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/site"}), \
                    patch.object(blog_attachments, "fetch_document", return_value=payload):
                post = publish_post.build_post(issue, form, settings, None, False, account=account)
                self.assertEqual(post["slug"], "custom-guide")
                self.assertEqual(post["fields"]["content_language"], "hi")
                self.assertEqual(post["fields"]["subtitle"], "A study of नमस्ते & computing")
                self.assertEqual(len(post["fields"]["attachments"]), 1)
                asset = post["fields"]["attachments"][0]
                self.assertIn("#" + asset["id"], post["markup"])
                self.assertNotIn(prefix, post["markup"])
                self.assertEqual(publish_post.save_post(post, None), "created")
                saved = next((root / "_posts").iterdir())
                public_file = root / "files" / post["slug"] / asset["name"]
                self.assertEqual(public_file.read_bytes(), payload)
                front_matter = yaml.safe_load(saved.read_text(encoding="utf-8").split("---\n", 2)[1])
                self.assertEqual(front_matter["attachments"][0]["sha256"], asset["sha256"])
                existing = {"slug": post["slug"], "path": saved, "text": saved.read_text(encoding="utf-8")}
                self.assertEqual(publish_post.save_post(post, existing), "unchanged")
                # Same filename and size do not prove document integrity.
                public_file.write_bytes(b"X" * len(payload))
                self.assertEqual(publish_post.save_post(post, existing), "updated")
                self.assertEqual(public_file.read_bytes(), payload)
                repaired = yaml.safe_load(saved.read_text(encoding="utf-8").split("---\n", 2)[1])
                self.assertEqual(repaired["date"], front_matter["date"])
                existing["text"] = saved.read_text(encoding="utf-8")
                self.assertEqual(publish_post.save_post(post, existing), "unchanged")
                # A missing file can be restored at the same public URL.
                public_file.unlink()
                self.assertEqual(publish_post.save_post(post, existing), "updated")
                self.assertEqual(public_file.read_bytes(), payload)
                existing["text"] = saved.read_text(encoding="utf-8")
                form["markdown"] = "The file was removed."
                form["requested_slug"] = "changed-slug"
                form["title"] = "Renamed guide"
                form["subtitle"] = "Updated subtitle"
                revised = publish_post.build_post(issue, form, settings, existing, False, account=account)
                self.assertEqual(revised["slug"], "custom-guide")
                self.assertEqual(revised["fields"]["subtitle"], "Updated subtitle")
                self.assertEqual(publish_post.save_post(revised, existing), "updated")
                self.assertFalse(public_file.exists())
                self.assertNotIn("attachments:", saved.read_text(encoding="utf-8"))
                publish_post.remove_post(existing)
                self.assertFalse(saved.exists())

    def test_asset_repair_does_not_follow_file_symlink(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            other = root / "other.pdf"
            other.write_bytes(b"unchanged")
            target = root / "published.pdf"
            try:
                target.symlink_to(other)
            except (OSError, NotImplementedError):
                self.skipTest("File symlinks are unavailable")
            publish_post.write_asset(target, b"restored")
            self.assertFalse(target.is_symlink())
            self.assertEqual(target.read_bytes(), b"restored")
            self.assertEqual(other.read_bytes(), b"unchanged")

    def test_asset_repair_rejects_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "published.pdf"
            target.mkdir()
            with self.assertRaises(publish_post.PostProblem):
                publish_post.write_asset(target, b"restored")
            self.assertTrue(target.is_dir())

    def test_foreign_document_is_rejected(self):
        account = {"id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                   "username": "reader", "name": "Reader"}
        prefix = "https://example.invalid/storage/v1/object/public/blog-attachments/"
        url = prefix + "cccccccc-cccc-cccc-cccc-cccccccccccc/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-guide.pdf"
        issue = {"number": 43, "user": {"login": "owner"}, "created_at": "2026-01-01T00:00:00Z"}
        settings = {"account_images": prefix.replace("blog-attachments", "blog-images"),
                    "owner_username": "owner", "owner_name": "Owner", "images_per_post": 20}
        form = {"title": "Foreign guide", "summary": "A guide", "tags": [],
                "cover_url": None, "cover_alt": "", "notes": [], "markdown": f"[Guide]({url})"}
        with patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/site"}), \
                patch.object(blog_attachments, "fetch_document") as fetch:
            with self.assertRaises(publish_post.PostProblem):
                publish_post.build_post(issue, form, settings, None, False, account=account)
            fetch.assert_not_called()


if __name__ == "__main__":
    unittest.main()
