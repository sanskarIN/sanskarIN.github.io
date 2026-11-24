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
    def test_create_update_remove_document(self):
        account = {"id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                   "username": "reader", "name": "Reader"}
        prefix = "https://example.invalid/storage/v1/object/public/blog-attachments/"
        url = prefix + account["id"] + "/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb-guide.pdf"
        issue = {"number": 42, "user": {"login": "owner"},
                 "created_at": "2026-01-01T00:00:00Z"}
        settings = {"account_images": prefix.replace("blog-attachments", "blog-images"),
                    "owner_username": "owner", "owner_name": "Owner", "images_per_post": 20}
        form = {"title": "Guide", "summary": "A guide", "tags": [],
                "cover_url": None, "cover_alt": "", "notes": [],
                "markdown": f"Read the [guide]({url})."}
        payload = b"%PDF-1.7\nsample\n%%EOF\n"
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            with patch.multiple(publish_post, POSTS_DIR=root / "_posts",
                                IMAGES_DIR=root / "images", ATTACHMENTS_DIR=root / "files"), \
                    patch.dict(os.environ, {"GITHUB_REPOSITORY": "owner/site"}), \
                    patch.object(blog_attachments, "fetch_document", return_value=payload):
                post = publish_post.build_post(issue, form, settings, None, False, account=account)
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
                form["markdown"] = "The file was removed."
                revised = publish_post.build_post(issue, form, settings, existing, False, account=account)
                self.assertEqual(publish_post.save_post(revised, existing), "updated")
                self.assertFalse(public_file.exists())
                self.assertNotIn("attachments:", saved.read_text(encoding="utf-8"))
                publish_post.remove_post(existing)
                self.assertFalse(saved.exists())

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
