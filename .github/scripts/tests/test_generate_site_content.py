"""Regression tests for Python-authored static site sections and style tokens."""

import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import generate_site_content as sitegen


class SiteGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.details = json.loads(sitegen.DETAILS.read_text(encoding="utf-8"))
        cls.tokens = json.loads(sitegen.TOKENS.read_text(encoding="utf-8"))

    def test_generated_files_match_their_json_sources(self):
        for path, generated in sitegen.generated_files().items():
            with self.subTest(file=path.name):
                self.assertEqual(path.read_text(encoding="utf-8"), generated)

    def test_all_profile_sections_keep_stable_anchors(self):
        core = sitegen.render_core(self.details)
        philosophy = sitegen.render_philosophy(self.details)
        for anchor in ("engineering-interests", "platforms", "tools"):
            self.assertIn(f'id="{anchor}"', core)
        for anchor in ("learning-and-exploration", "development-philosophy"):
            self.assertIn(f'id="{anchor}"', philosophy)
        self.assertEqual(core.count('<section class="page-section">'), 3)
        self.assertEqual(philosophy.count('<section class="page-section">'), 2)

    def test_untrusted_profile_text_is_escaped(self):
        details = copy.deepcopy(self.details)
        details["engineering_interests"] = ['A <script>alert("x")</script> & more']
        rendered = sitegen.render_core(details)
        self.assertNotIn("<script>", rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertIn("&amp; more", rendered)

    def test_duplicate_platforms_are_rejected(self):
        details = copy.deepcopy(self.details)
        details["platforms"].append(copy.deepcopy(details["platforms"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            sitegen.render_core(details)

    def test_unsafe_css_values_are_rejected(self):
        for invalid in ("red; } body {display:none}", "url(https://example.com/a)",
                        "@import 'https://example.com';", "red\nbackground:blue", "/* comment */"):
            with self.subTest(value=invalid):
                tokens = copy.deepcopy(self.tokens)
                tokens["Spacing"]["space-1"] = invalid
                with self.assertRaisesRegex(ValueError, "Unsafe CSS"):
                    sitegen.render_tokens(tokens)

    def test_css_variables_are_present_once(self):
        rendered = sitegen.render_tokens(self.tokens)
        total = sum(len(group) for group in self.tokens.values())
        self.assertEqual(rendered.count("  --"), total)
        self.assertIn("--width-container: 72rem;", rendered)

    def test_duplicate_css_variables_are_rejected(self):
        tokens = copy.deepcopy(self.tokens)
        tokens["Spacing"]["text-xs"] = "2rem"
        with self.assertRaisesRegex(ValueError, "Duplicate CSS token"):
            sitegen.render_tokens(tokens)


if __name__ == "__main__":
    unittest.main()
