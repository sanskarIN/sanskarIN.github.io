"""Python stylesheet compiler regression and safety tests."""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_styles as styles


class StylesheetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.theme = json.loads(
            (styles.ROOT / "_data/theme.json").read_text(encoding="utf-8")
        )
        cls.tokens = json.loads(
            (styles.ROOT / "_data/design_tokens.json").read_text(encoding="utf-8")
        )

    def test_compiled_stylesheet_is_committed_and_deterministic(self):
        css = styles.build_css()
        self.assertEqual(
            css, (styles.ROOT / "assets/css/main.css").read_text(encoding="utf-8")
        )
        self.assertFalse(css.lstrip().startswith("---"))
        self.assertNotIn("{%", css)
        self.assertNotIn("{{", css)

    def test_light_dark_and_os_theme_fallback(self):
        css = styles.build_css()
        self.assertIn(":root {", css)
        self.assertIn(':root[data-theme="dark"]', css)
        self.assertIn("@media (prefers-color-scheme: dark)", css)
        self.assertIn("--color-bg: #F7F6F3;", css)
        self.assertIn("--color-bg: #111214;", css)
        self.assertIn("--font-sans:", css)

    def test_all_partials_are_in_order_once(self):
        css = styles.build_css()
        comments = [
            f"/* Source: _includes/css/{name}.css */"
            for name in styles.PARTS
        ]
        offsets = [css.index(comment) for comment in comments]
        self.assertEqual(offsets, sorted(offsets))
        for comment in comments:
            self.assertEqual(css.count(comment), 1)

    def test_bad_palette_is_rejected(self):
        for invalid in ["red; background:black", "url(https://bad.example)",
                        "rgb(0, 0, 0)", "#gggggg"]:
            with self.subTest(value=invalid):
                theme = copy.deepcopy(self.theme)
                theme["light"]["bg"] = invalid
                with self.assertRaisesRegex(ValueError, "invalid CSS color"):
                    styles.render_theme(theme, "")

    def test_missing_or_extra_theme_properties_are_rejected(self):
        theme = copy.deepcopy(self.theme)
        del theme["dark"]["bg"]
        with self.assertRaisesRegex(ValueError, "exact color keys"):
            styles.render_theme(theme, "")
        theme = copy.deepcopy(self.theme)
        theme["evil"] = theme["light"]
        with self.assertRaisesRegex(ValueError, "light and dark"):
            styles.render_theme(theme, "")

    def test_untrusted_liquid_in_partial_is_rejected(self):
        with tempfile.TemporaryDirectory() as dirname:
            root = Path(dirname)
            (root / "_data").mkdir()
            (root / "_includes/css").mkdir(parents=True)
            (root / "_data/theme.json").write_text(
                json.dumps(self.theme), encoding="utf-8"
            )
            (root / "_data/design_tokens.json").write_text(
                json.dumps(self.tokens), encoding="utf-8"
            )
            (root / "_includes/css/bad.css").write_text(
                "div { color: {{ site.secret }}; }", encoding="utf-8"
            )
            with patch.object(styles, "PARTS", ("bad",)):
                with self.assertRaisesRegex(ValueError, "uncompiled Liquid"):
                    styles.build_css(root)


if __name__ == "__main__":
    unittest.main()
