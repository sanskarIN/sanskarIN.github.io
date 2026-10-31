"""Post dates belong to original submission, not approval or deployment."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from post_dates import issue_creation_timestamp

ROOT = Path(__file__).resolve().parents[3]


class BlogCreationDateTests(unittest.TestCase):
    def test_github_created_at_is_the_publication_date(self):
        self.assertEqual(
            issue_creation_timestamp({"created_at": "2026-10-25T11:34:19Z"}),
            "2026-10-25T11:34:19+00:00",
        )
        self.assertEqual(
            issue_creation_timestamp({"created_at": "2026-10-30T15:04:27+05:30"}),
            "2026-10-30T09:34:27+00:00",
        )

    def test_missing_or_ambiguous_creation_date_fails_closed(self):
        for issue in (None, {}, {"created_at": None}, {"created_at": "yesterday"},
                      {"created_at": "2026-10-25T11:34:19"}):
            with self.subTest(issue=issue), self.assertRaises(ValueError):
                issue_creation_timestamp(issue)

    def test_original_submissions_and_indexes_keep_their_dates(self):
        search = json.loads((ROOT / "search.json").read_text(encoding="utf-8"))
        terminal = json.loads((ROOT / "terminal.json").read_text(encoding="utf-8"))
        samples = [
            (47, "2026-10-25", "11:34:19", "frametrellis-v1-3-0-release", "25 Oct 2026"),
            (49, "2026-10-30", "09:34:27", "repodna-v1-4-5-release", "30 Oct 2026"),
        ]
        for issue, day, clock, slug, label in samples:
            with self.subTest(issue=issue):
                path = ROOT / "_posts" / f"{day}-{slug}.md"
                content = path.read_text(encoding="utf-8")
                self.assertIn(f"source_issue: {issue}\n", content)
                self.assertIn(f"date: {day}T{clock}+00:00\n", content)
                self.assertNotIn(f"_posts/2026-10-31-{slug}.md", content)
                url = f"/blog/{slug}/"
                indexed = [x for x in search if x.get("type") == "Post" and x.get("url") == url]
                shown = [x for x in terminal["posts"] if x.get("url") == url]
                self.assertEqual(len(indexed), 1)
                self.assertEqual(len(shown), 1)
                self.assertEqual(indexed[0]["date"], label)
                self.assertEqual(shown[0]["date"], label)


if __name__ == "__main__":
    unittest.main()
