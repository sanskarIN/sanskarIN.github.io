#!/usr/bin/env python3
"""Compile the public stylesheet from Python and structured theme data.

This is an *authoring* pipeline. The browser still receives standard CSS at
/assets/css/main.css; Jekyll/GitHub Pages no longer needs to interpret Liquid
to assemble or theme that stylesheet.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PARTS = (
    "fonts", "base", "layout", "components", "blog", "account",
    "projects", "search", "thanks", "terminal", "spotlight",
    "pages", "kahani",
)
PROPERTY = re.compile(r"[a-z][a-z0-9-]*\Z")
COLOR = re.compile(r"(?:#[0-9A-Fa-f]{3,8}|rgb\([0-9 ]+\s*/\s*[0-9]+%\))\Z")
# Same 18 theme keys must exist for light and dark themes.
THEME_KEYS = {
    "bg", "surface", "surface-muted", "text", "text-muted", "border",
    "border-strong", "border-input", "accent", "accent-hover",
    "accent-soft", "on-accent", "grid",
    "activity-0", "activity-1", "activity-2", "activity-3", "activity-4",
}


def palette(data, theme_name):
    if not isinstance(data, dict) or set(data) != THEME_KEYS:
        raise ValueError(f"theme.{theme_name}: expected {len(THEME_KEYS)} exact color keys")
    entries = []
    for name, value in data.items():
        if not PROPERTY.fullmatch(name) or not isinstance(value, str) or not COLOR.fullmatch(value):
            raise ValueError(f"theme.{theme_name}.{name}: invalid CSS color")
        entries.append(f"  --color-{name}: {value};")
    return entries


def render_theme(theme, tokens):
    if not isinstance(theme, dict) or set(theme) != {"light", "dark"}:
        raise ValueError("Theme must have only light and dark palettes")
    light, dark = palette(theme["light"], "light"), palette(theme["dark"], "dark")
    # The generated design tokens are checked by generate_site_content.render_tokens.
    return "\n".join([
        "/* Python-generated palette and design tokens. Edit _data/theme.json "
        "and _data/design_tokens.json. */",
        ":root {",
        "  color-scheme: light;",
        *light,
        "",
        tokens.rstrip(),
        "}",
        "",
        ':root[data-theme="dark"] {',
        "  color-scheme: dark;",
        *dark,
        "}",
        "",
        "@media (prefers-color-scheme: dark) {",
        '  :root:not([data-theme="light"]) {',
        "    color-scheme: dark;",
        *(f"  {line}" for line in dark),
        "  }",
        "}",
        "",
    ]) + "\n"


def build_css(root=ROOT):
    # Local import avoids a circular dependency when the content generator
    # checks this compiled stylesheet along with generated HTML.
    from generate_site_content import render_tokens

    theme = json.loads((root / "_data" / "theme.json").read_text(encoding="utf-8"))
    tokens = json.loads((root / "_data" / "design_tokens.json").read_text(encoding="utf-8"))
    sections = [render_theme(theme, render_tokens(tokens))]
    for name in PARTS:
        path = root / "_includes" / "css" / (name + ".css")
        content = path.read_text(encoding="utf-8")
        if "{{" in content or "{%" in content:
            raise ValueError(f"{path}: uncompiled Liquid template in CSS source")
        if not content.strip():
            raise ValueError(f"{path}: empty CSS partial")
        sections.append(f"/* Source: _includes/css/{name}.css */\n" + content.rstrip() + "\n")
    output = "\n".join(sections)
    if "{{" in output or "{%" in output:
        raise ValueError("Compiled stylesheet contains unresolved Liquid markup")
    return output


if __name__ == "__main__":
    from generate_site_content import main
    raise SystemExit(main())
