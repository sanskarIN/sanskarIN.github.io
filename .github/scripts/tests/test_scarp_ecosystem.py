"""Offline tests for curated Scarp links, independent of live network health."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import check_scarp_ecosystem as audit


class ScarpEcosystemTests(unittest.TestCase):
    @staticmethod
    def example():
        return [
            {
                "title": "Scarp Studio",
                "repository": "scarp-lang/scarp-studio",
                "url": "https://github.com/scarp-lang/scarp-studio",
                "description": "Experimental desktop IDE",
            },
            {
                "title": "Documentation",
                "repository": "scarp-lang/scarp-docs",
                "url": "https://scarp-lang.github.io/scarp-docs/",
                "description": "Official documentation",
            },
        ]

    def test_manifest_links_are_canonical_and_publicly_auditable(self):
        entries = audit.load_entries()
        self.assertEqual(len(entries), 7)
        self.assertIn("scarp-lang/scarp-studio", {entry["repository"] for entry in entries})

    def test_duplicate_repositories_and_titles_are_case_insensitive(self):
        for field in ("repository", "title"):
            with self.subTest(field=field):
                entries = self.example()
                if field == "repository":
                    entries[1][field] = "scarp-lang/SCARP-STUDIO"
                    entries[1]["url"] = "https://github.com/scarp-lang/SCARP-STUDIO"
                else:
                    entries[1][field] = entries[0][field].upper()
                with self.assertRaisesRegex(ValueError, "duplicate"):
                    audit.validate_entries(entries)

    def test_rejects_mismatched_destination_and_untrusted_url(self):
        for invalid_url in (
            "https://github.com/scarp-lang/other-repository",
            "https://scarp-lang.github.io/wrong-docs/",
            "https://evil.example/scarp-docs/",
            "http://scarp-lang.github.io/scarp-docs/",
            "https://scarp-lang.github.io/scarp-docs/?tracking=1",
        ):
            with self.subTest(url=invalid_url):
                entries = self.example()
                entries[1]["url"] = invalid_url
                with self.assertRaisesRegex(ValueError, "URL does not match"):
                    audit.validate_entries(entries)

    def test_rejects_extra_fields_and_invalid_repositories(self):
        for bad in ("other-org/scarp", "scarp-lang/../secret", "scarp-lang/"):
            with self.subTest(repository=bad):
                entries = self.example()
                entries[0]["repository"] = bad
                with self.assertRaises(ValueError):
                    audit.validate_entries(entries)
        entries = self.example()
        entries[0]["unexpected"] = "not-allowed"
        with self.assertRaisesRegex(ValueError, "expected"):
            audit.validate_entries(entries)

    def test_live_audit_checks_metadata_and_reports_bad_redirects(self):
        entries = audit.validate_entries(self.example())
        lookup = lambda repo: {"full_name": repo, "private": False, "archived": False}
        self.assertEqual(audit.verify_live(entries, lookup, lambda url: url), [])
        failures = audit.verify_live(entries, lookup, lambda url: "https://attacker.example/")
        self.assertEqual(len(failures), 1)
        self.assertIn("redirects outside", failures[0])
        failures = audit.verify_live(entries, lambda repo: {"full_name": "scarp-lang/other"}, lambda url: url)
        self.assertEqual(len(failures), 2)


if __name__ == "__main__":
    unittest.main()
