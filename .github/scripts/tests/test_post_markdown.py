"""Blog Markdown authoring conversion tests."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from post_markdown import convert_article


class BlogMarkdownTests(unittest.TestCase):
    def test_headings_and_paragraphs_become_markdown(self):
        original = "<h2>A title</h2><p>First paragraph.</p><h3>Next</h3><p>Second.</p>"
        result = convert_article(original)
        self.assertIn("## A title", result)
        self.assertIn("### Next", result)
        self.assertIn("\n\nFirst paragraph.\n\n", result)
        self.assertNotIn("<h2>", result)
        self.assertNotIn("<p>", result)

    def test_lists_and_horizontal_rules_convert(self):
        original = "<ul><li>First</li><li><strong>Second</strong></li></ul><hr><ol><li>One</li></ol>"
        result = convert_article(original)
        self.assertIn("- First", result)
        self.assertIn("- <strong>Second</strong>", result)
        self.assertIn("\n---\n", result)
        self.assertIn("1. One", result)

    def test_blockquotes_code_and_links_are_preserved(self):
        blocks = (
            '<blockquote><p>Do not drop quoted paragraphs.</p></blockquote>'
            '<pre tabindex="0"><code>a &lt; b\n  keep whitespace</code></pre>'
            '<p><a href="https://example.com/?a=1&amp;b=2" rel="noopener">Link</a></p>'
        )
        result = convert_article(blocks)
        self.assertIn("<blockquote><p>Do not drop quoted paragraphs.</p></blockquote>", result)
        self.assertIn('<pre tabindex="0"><code>a &lt; b\n  keep whitespace</code></pre>', result)
        self.assertIn('rel="noopener">Link</a>', result)

    def test_markdown_special_character_paragraph_remains_wrapped(self):
        original = "<p># A string, not a heading</p><p>- A sentence</p><p>--- separator</p>"
        result = convert_article(original)
        self.assertIn("<p># A string, not a heading</p>", result)
        self.assertIn("<p>- A sentence</p>", result)
        self.assertIn("<p>--- separator</p>", result)

    def test_nested_lists_are_left_as_html(self):
        original = "<ul><li>Parent<ul><li>Child</li></ul></li></ul>"
        result = convert_article(original)
        self.assertIn("<ul>", result)
        self.assertIn("Child", result)

    def test_no_script_or_markdown_code_generation_from_escaped_data(self):
        original = "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"
        result = convert_article(original)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", result)
        self.assertNotIn("<script>", result)
        with self.assertRaisesRegex(ValueError, "NUL"):
            convert_article("bad\x00value")

    def test_rejects_non_string(self):
        with self.assertRaises(TypeError):
            convert_article(None)


if __name__ == "__main__":
    unittest.main()
