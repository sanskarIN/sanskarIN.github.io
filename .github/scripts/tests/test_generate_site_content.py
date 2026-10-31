"""Regression tests for Python-authored static site sections and style tokens."""

import copy
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import generate_site_content as sitegen
from home_render import render_hero, render_sections, SECTION_IDS


class SiteGeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.details = json.loads(sitegen.DETAILS.read_text(encoding="utf-8"))
        cls.tokens = json.loads(sitegen.TOKENS.read_text(encoding="utf-8"))
        cls.about = json.loads(sitegen.ABOUT.read_text(encoding="utf-8"))
        cls.home = json.loads(sitegen.HOME.read_text(encoding="utf-8"))

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

    def test_about_sections_preserve_editorial_structure(self):
        intro = sitegen.render_about_intro(self.about)
        sections = sitegen.render_about_sections(self.about)
        self.assertEqual(intro.count("<p>"), len(self.about["intro"]))
        self.assertEqual(sections.count('<section class="page-section">'),
                         len(self.about["sections"]))
        for item in self.about["sections"]:
            self.assertIn(f"<h2>{item['heading']}</h2>", sections)
        self.assertIn('{% include profile-list.html group="products"', sections)
        self.assertIn('{% include profile-list.html items=site.data.social.community', sections)
        self.assertIn('{%- for area in site.data.focus %}', sections)
        self.assertIn('class="cta-panel"', sections)

    def test_about_prose_is_html_escaped(self):
        about = copy.deepcopy(self.about)
        about["intro"][0] = '<img src=x onerror=alert(1)> & friend'
        about["sections"][0]["heading"] = '<script>alert("x")</script>'
        about["sections"][0]["paragraphs"][0] = '<a href="javascript:alert(1)">Bad</a>'
        output = sitegen.render_about_intro(about) + sitegen.render_about_sections(about)
        self.assertNotIn("<script>", output)
        self.assertNotIn('href="javascript:', output)
        self.assertNotIn('onerror=', output.replace("&lt;img src=x onerror=", ""))
        self.assertIn("&lt;script&gt;", output)
        self.assertIn("&amp; friend", output)
        about["sections"][0]["paragraphs"][0] = "{% include secrets.html %} {{ site.secret }}"
        output = sitegen.render_about_sections(about)
        self.assertNotIn("{% include secrets.html %}", output)
        self.assertNotIn("{{ site.secret }}", output)
        self.assertIn("&#123;% include secrets.html %}", output)

    def test_about_widget_and_action_are_strictly_allowlisted(self):
        for key in ("widget", "action"):
            with self.subTest(key=key):
                about = copy.deepcopy(self.about)
                about["sections"][0][key] = 'anything{% assign injected=true %}'
                with self.assertRaisesRegex(ValueError, "unknown"):
                    sitegen.render_about_sections(about)

    def test_duplicate_about_headings_are_rejected(self):
        about = copy.deepcopy(self.about)
        about["sections"][1]["heading"] = about["sections"][0]["heading"]
        with self.assertRaisesRegex(ValueError, "duplicate heading"):
            sitegen.render_about_sections(about)

    def test_invalid_cta_and_extra_section_fields_are_rejected(self):
        about = copy.deepcopy(self.about)
        about["cta"]["unexpected"] = "ignored"
        with self.assertRaisesRegex(ValueError, "about.cta"):
            sitegen.render_about_sections(about)
        about = copy.deepcopy(self.about)
        about["sections"][0]["extra_html"] = "<script></script>"
        with self.assertRaisesRegex(ValueError, "unknown fields"):
            sitegen.render_about_sections(about)

    def test_home_sections_are_ordered_and_generated(self):
        home = self.home
        result = render_sections(home)
        self.assertEqual(result.count('<section class="section'), len(SECTION_IDS))
        for index, section in enumerate(home["sections"], start=1):
            self.assertIn(f'>{index:02d}</span>{section["title"] if "&" not in section["title"] else "Support &amp; digital products"}', result)
        self.assertIn('{%- for name in gh.featured limit: 3 %}', result)
        self.assertIn('{%- for post in site.posts limit: 3 %}', result)
        self.assertIn('include contact-card.html group="business"', result)
        self.assertIn('include profile-list.html group="products"', result)

    def test_home_intro_and_hero_preserve_dynamic_terminal(self):
        hero = render_hero(self.home)
        sections = render_sections(self.home)
        self.assertIn('data-terminal', hero)
        self.assertIn('data-terminal-data=', hero)
        self.assertIn('site.data.technologies', hero)
        self.assertIn('include link.html url=site.projects_url', hero)
        for paragraph in self.home["about_paragraphs"]:
            self.assertIn(paragraph, sections)

    def test_home_html_and_liquid_injections_are_escaped(self):
        home = copy.deepcopy(self.home)
        home["hero"]["title"] = '<script>alert(1)</script>'
        home["sections"][0]["title"] = '{{ site.secret }}'
        home["about_paragraphs"][0] = '{% include secrets.html %}'
        result = render_hero(home) + render_sections(home)
        self.assertNotIn('<script>alert(1)</script>', result)
        self.assertNotIn('{{ site.secret }}', result)
        self.assertNotIn('{% include secrets.html %}', result)
        self.assertIn('&lt;script&gt;', result)
        self.assertIn('&#123;{ site.secret }}', result)
        self.assertIn('&#123;% include secrets.html %}', result)

    def test_home_invalid_section_order_is_rejected(self):
        home = copy.deepcopy(self.home)
        home["sections"][0], home["sections"][1] = home["sections"][1], home["sections"][0]
        with self.assertRaisesRegex(ValueError, "reordered widget"):
            render_sections(home)

    def test_home_unknown_fields_and_control_characters_are_rejected(self):
        home = copy.deepcopy(self.home)
        home["sections"][0]["arbitrary_html"] = '<p>unsafe</p>'
        with self.assertRaisesRegex(ValueError, "expected id, title, lead"):
            render_sections(home)
        home = copy.deepcopy(self.home)
        home["hero"]["intro"] = "malicious\x00content"
        with self.assertRaisesRegex(ValueError, "control character"):
            render_hero(home)

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
