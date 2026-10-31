"""Convert sanitized blog HTML into readable Markdown for Jekyll posts.

The publisher sanitizes untrusted user submissions *before* calling this
converter. This module does not sanitize HTML; structural code samples,
tables and blockquotes retain their original markup for rendering parity.
"""

import re

PRESERVED = re.compile(
    r"<(pre|blockquote|table)\b[^>]*>[\s\S]*?</\1>", re.IGNORECASE
)
HEADING = re.compile(r"<h([1-6])>([\s\S]*?)</h\1>", re.IGNORECASE)
UNORDERED = re.compile(r"<ul>\s*([\s\S]*?)</ul>", re.IGNORECASE)
ORDERED = re.compile(r"<ol>\s*([\s\S]*?)</ol>", re.IGNORECASE)
ITEM = re.compile(r"<li>([\s\S]*?)</li>", re.IGNORECASE)
PARAGRAPH = re.compile(r"<p>([\s\S]*?)</p>", re.IGNORECASE)
HORIZONTAL_RULE = re.compile(r"<hr\s*/?>", re.IGNORECASE)
MARKDOWN_BLOCK_START = re.compile(r"^\s*(?:#|[-*+]\s|\d+[.)]\s|>|---|===|\x60\x60\x60|~~~)")


def convert_article(markup):
    """Convert ordinary editorial structure; preserve nontrivial HTML exactly.

    Existing code, escaped HTML, links and blockquotes are kept losslessly.
    The remaining inline HTML is valid in Jekyll Markdown and remains
    subject to the publisher's allowlist.
    """
    if not isinstance(markup, str):
        raise TypeError("Article markup must be a string")
    if "\x00" in markup:
        raise ValueError("Article markup contains NUL")
    protected = []

    def protect(match):
        number = len(protected)
        protected.append(match.group(0))
        return f"\n\nPOSTBLOCKSLOT{number}END\n\n"

    body = PRESERVED.sub(protect, markup)
    body = HEADING.sub(
        lambda match: (
            "\n\n" + "#" * int(match.group(1))
            + " " + match.group(2) + "\n\n"
        ), body,
    )

    def render_list(match, ordered=False):
        inside = match.group(1)
        # Complex nested lists are kept as HTML, avoiding a lossy conversion.
        if re.search(r"<(?:ul|ol|li)\b[^>]+>|<(?:ul|ol)\b", inside, re.I):
            return match.group(0)
        prefix = "1." if ordered else "-"
        rendered = ITEM.sub(
            lambda item: f"{prefix} {item.group(1).strip()}\n", inside,
        )
        return "\n\n" + rendered + "\n"

    body = UNORDERED.sub(lambda m: render_list(m), body)
    body = ORDERED.sub(lambda m: render_list(m, ordered=True), body)

    def paragraph(match):
        inner = match.group(1)
        if MARKDOWN_BLOCK_START.match(inner):
            return match.group(0) + "\n\n"
        return "\n\n" + inner + "\n\n"

    body = PARAGRAPH.sub(paragraph, body)
    body = HORIZONTAL_RULE.sub("\n\n---\n\n", body)
    for number, original in enumerate(protected):
        body = body.replace(f"POSTBLOCKSLOT{number}END", original)
    return re.sub(r"\n{3,}", "\n\n", body).strip() + "\n"
