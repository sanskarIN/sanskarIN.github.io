"""Audit the hand-curated Scarp project links without changing the website.

Unit tests validate the manifest offline on PRs. A separate scheduled workflow
checks the *live* public GitHub repositories and GitHub Pages destinations.
This file deliberately has no network activity when imported.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

import yaml

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "_data/scarp_ecosystem.yml"
REPOSITORY = re.compile(r"scarp-lang/[A-Za-z0-9][A-Za-z0-9._-]*\Z")
USER_AGENT = "sanskarIN-portfolio-scarp-link-audit/1.0"


def validate_entries(raw):
    """Reject malformed, duplicated, or mismatched repository/link pairs."""
    if not isinstance(raw, list) or not 1 <= len(raw) <= 30:
        raise ValueError("Scarp ecosystem must contain between 1 and 30 entries")
    seen_repos, seen_titles, seen_urls = set(), set(), set()
    for index, entry in enumerate(raw, 1):
        if not isinstance(entry, dict) or set(entry) != {"title", "repository", "url", "description"}:
            raise ValueError(f"Entry {index}: expected title, repository, url, and description")
        if not all(isinstance(entry[k], str) and entry[k].strip() for k in entry):
            raise ValueError(f"Entry {index}: all values must be nonempty strings")
        repository = entry["repository"]
        if not REPOSITORY.fullmatch(repository) or ".." in repository:
            raise ValueError(f"Entry {index}: invalid scarp-lang repository name")
        title, url = entry["title"], entry["url"]
        repo_name = repository.split("/", 1)[1]
        allowed_urls = {
            f"https://github.com/{repository}",
            "https://scarp-lang.github.io/" if repo_name == "scarp-lang.github.io"
            else f"https://scarp-lang.github.io/{repo_name}/",
        }
        if url not in allowed_urls:
            raise ValueError(f"Entry {index}: URL does not match its curated repository")
        for seen, value, label in (
            (seen_repos, repository.casefold(), "repository"),
            (seen_titles, title.casefold(), "title"),
            (seen_urls, url, "URL"),
        ):
            if value in seen:
                raise ValueError(f"Entry {index}: duplicate {label}")
            seen.add(value)
    return raw


def load_entries(path=MANIFEST):
    return validate_entries(yaml.safe_load(Path(path).read_text(encoding="utf-8")))


def request(url, token="", *, json_content=False):
    """Perform a bounded GET; read only the metadata needed for verification."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/vnd.github+json" if json_content else "text/html"}
    if json_content and token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=15) as response:
        if response.status != 200:
            raise ValueError(f"HTTP status {response.status}")
        final_url = response.geturl()
        if json_content:
            return json.load(response)
        return final_url


def verify_live(entries, lookup, probe):
    """Pure orchestration makes failures and redirects easy to unit-test."""
    failures = []
    for entry in entries:
        repository = entry["repository"]
        try:
            data = lookup(repository)
            if not isinstance(data, dict) or str(data.get("full_name", "")).casefold() != repository.casefold():
                raise ValueError("GitHub API returned a different repository")
            if data.get("private") or data.get("archived"):
                raise ValueError("repository is private or archived")
            if urlsplit(entry["url"]).hostname == "scarp-lang.github.io":
                final_url = probe(entry["url"])
                final = urlsplit(final_url)
                if final.scheme != "https" or final.hostname != "scarp-lang.github.io":
                    raise ValueError("published site redirects outside scarp-lang.github.io")
            print(f"OK: {repository} ({entry['url']})")
        except (OSError, ValueError, KeyError, TypeError, urllib.error.URLError) as exc:
            failures.append(f"{repository}: {exc}")
    return failures


def main():
    try:
        entries = load_entries()
    except (OSError, ValueError, yaml.YAMLError) as exc:
        print(f"ERROR: invalid Scarp ecosystem manifest: {exc}", file=sys.stderr)
        return 1
    token = os.getenv("GITHUB_TOKEN", "")
    failures = verify_live(
        entries,
        lambda repository: request(f"https://api.github.com/repos/{repository}", token, json_content=True),
        lambda url: request(url),
    )
    if failures:
        for failure in failures:
            print(f"ERROR: {failure}", file=sys.stderr)
        return 1
    print(f"Verified {len(entries)} public Scarp repository links and published pages.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
