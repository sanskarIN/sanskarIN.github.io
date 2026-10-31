#!/usr/bin/env python3
"""Compare the Python terminal/search model with Jekyll's public JSON outputs.

Run only after `bundle exec jekyll build`; the current Jekyll renderer is the
oracle until the Python implementation has proven output compatibility.
"""

import json
import sys
from pathlib import Path

from terminal_data import ROOT, published_posts, terminal_data
from search_index import search_index


def diff_paths(actual, expected, prefix="$", limit=20):
    """Report only structural/value paths, not the values of user content."""
    problems = []
    if type(actual) is not type(expected):
        return [prefix + " (type)"]
    if isinstance(actual, dict):
        for key in sorted(set(actual) | set(expected)):
            location = prefix + "." + key
            if key not in actual or key not in expected:
                problems.append(location + " (missing/extra)")
            else:
                problems.extend(diff_paths(actual[key], expected[key], location, limit))
            if len(problems) >= limit:
                break
    elif isinstance(actual, list):
        if len(actual) != len(expected):
            problems.append(f"{prefix} (length {len(actual)} vs {len(expected)})")
        for i, (left, right) in enumerate(zip(actual, expected)):
            problems.extend(diff_paths(left, right, f"{prefix}[{i}]", limit))
            if len(problems) >= limit:
                break
    elif actual != expected:
        problems.append(prefix + " (value)")
    return problems[:limit]


def validate_search(root, output, python_terminal):
    index = json.loads((output / "search.json").read_text(encoding="utf-8"))
    if not isinstance(index, list):
        raise AssertionError("Search index must be a JSON array")
    groups = {"Page": [], "Post": [], "Project": []}
    for i, entry in enumerate(index):
        if not isinstance(entry, dict) or entry.get("type") not in groups:
            raise AssertionError(f"Invalid search entry at position {i}")
        if not isinstance(entry.get("title"), str) or not entry["title"]:
            raise AssertionError(f"Missing search title at {i}")
        if not isinstance(entry.get("url"), str) or not entry["url"]:
            raise AssertionError(f"Missing search URL at {i}")
        groups[entry["type"]].append(entry)

    urls = [entry["url"] for entry in index]
    if len(urls) != len(set(urls)):
        raise AssertionError("Duplicate URLs in search index")
    for p in published_posts(root):
        matches = [entry for entry in groups["Post"] if entry["url"] == p["url"]]
        if len(matches) != 1:
            raise AssertionError(f"Post not indexed exactly once: {p['url']}")
        expected = {key: p[key] for key in ("title", "url", "date", "tags")}
        actual = {key: matches[0].get(key) for key in expected}
        problems = diff_paths(actual, expected)
        if problems:
            raise AssertionError(f"Post search mismatch at {p['url']}: {problems}")
    if len(groups["Post"]) != len(published_posts(root)):
        raise AssertionError("Search post count does not match source post count")

    data = json.loads((root / "_data/github.json").read_text(encoding="utf-8"))
    repos = data.get("repositories") or []
    if len(groups["Project"]) != len(repos):
        raise AssertionError("Search repository count does not match GitHub data")
    for entry, repo in zip(groups["Project"], repos):
        expected = {
            "title": repo["name"], "url": repo["url"],
            "tags": repo.get("topics"), "type": "Project",
        }
        actual = {key: entry.get(key) for key in expected}
        problems = diff_paths(actual, expected)
        if problems:
            raise AssertionError(f"Project index mismatch {repo['name']}: {problems}")
    # Independently reconstruct every search result from maintained sources.
    # Post text is approximate because Markdown-it/Python and Jekyll Kramdown
    # do not have identical whitespace handling; metadata and URLs are exact.
    python_entries = search_index(root)
    for kind in ("Page", "Post", "Project"):
        expected = [entry for entry in python_entries if entry["type"] == kind]
        actual = groups[kind]
        if len(expected) != len(actual):
            raise AssertionError(
                f"Python/Jekyll {kind} count differs: {len(expected)} vs {len(actual)}"
            )
        by_url = {item["url"]: item for item in actual}
        for model in expected:
            published = by_url.get(model["url"])
            if published is None:
                raise AssertionError(f"Python search {kind} missing from Jekyll: {model['url']}")
            keys = set(model) - ({"text"} if kind == "Post" else set())
            problems = diff_paths(
                {key: published.get(key) for key in keys},
                {key: model[key] for key in keys},
            )
            if problems:
                raise AssertionError(
                    f"Python search {kind} mismatch for {model['url']}: {problems}"
                )
            if kind == "Post":
                description = model["text"].split(" ", 1)[0]
                if not isinstance(published.get("text"), str) or not published["text"].strip():
                    raise AssertionError(f"Empty public post excerpt: {model['url']}")
                if description and description not in published["text"]:
                    raise AssertionError(f"Post text lost introduction: {model['url']}")

    for item in python_terminal["pages"]:
        if not any(x["url"] == item["url"] for x in groups["Page"]):
            raise AssertionError(f"Navigation page absent from search: {item['url']}")
    print(f"Search: {len(groups['Page'])} pages, {len(groups['Post'])} posts, "
          f"{len(groups['Project'])} repositories verified.")


def check(root, output):
    # Jekyll must copy the Python-built feed without rewriting the bytes:
    # the browser depends on the exact same /terminal.json route.
    source = (root / "terminal.json").read_bytes()
    copied = (output / "terminal.json").read_bytes()
    if source != copied:
        raise AssertionError("Jekyll did not publish the Python terminal feed unchanged")
    jekyll = json.loads(copied.decode("utf-8"))
    python = terminal_data(root)
    changes = diff_paths(jekyll, python)
    if changes:
        raise AssertionError(f"Python/Jekyll terminal JSON parity failed: {changes}")
    print(f"Terminal: Python/Jekyll JSON parity passed; "
          f"{len(python['posts'])} recent posts and "
          f"{len(python['profiles'])} public profiles.")
    validate_search(root, output, python)


def main(argv):
    if len(argv) != 2:
        print("Usage: python .github/scripts/check_data_parity.py _site", file=sys.stderr)
        return 2
    check(ROOT, Path(argv[1]).resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
