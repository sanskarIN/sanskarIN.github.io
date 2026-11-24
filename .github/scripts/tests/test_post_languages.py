"""Keep publication metadata and the SQL migration in sync."""
import sys
import unittest
from pathlib import Path
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import publish_post

ROOT = Path(__file__).resolve().parents[3]

class PostLanguageTests(unittest.TestCase):
    def test_language_registry_and_form(self):
        registry = yaml.safe_load((ROOT / "_data/post_languages.yml").read_text(encoding="utf-8"))
        self.assertEqual(registry, publish_post.POST_LANGUAGES)
        form = yaml.safe_load((ROOT / ".github/ISSUE_TEMPLATE/blog-post.yml").read_text(encoding="utf-8"))
        field = next(item for item in form["body"] if item.get("id") == "language")
        self.assertEqual(set(field["attributes"]["options"]), set(registry.values()))
        self.assertEqual(publish_post.form_sections("### Language\n\nhi\n\n### Post\n\nText\n\n### Confirmation\n\n- [X] Yes")["Language"], "hi")

    def test_schema_has_complete_single_migrations(self):
        schema = (ROOT / "supabase/schema.sql").read_text(encoding="utf-8")
        self.assertEqual(schema.count("create index if not exists submissions_user_created"), 1)
        self.assertEqual(schema.count("create or replace function public.my_blog_attachment_count()"), 1)
        self.assertIn("requested_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", schema)
        self.assertIn("add column if not exists content_language", schema)
        for code in publish_post.POST_LANGUAGES:
            self.assertIn("'" + code + "'", schema)

if __name__ == "__main__":
    unittest.main()
