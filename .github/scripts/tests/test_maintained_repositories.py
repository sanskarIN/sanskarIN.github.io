"""Regression tests for explicitly maintained organization repositories and code statistics."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import update_github_data as project_data


def repo(owner, name, *, private=False, fork=False):
    return {
        "name": name,
        "full_name": f"{owner}/{name}",
        "owner": {"login": owner},
        "html_url": f"https://github.com/{owner}/{name}",
        "private": private,
        "fork": fork,
        "archived": False,
        "pushed_at": "2026-11-09T00:00:00Z",
        "stargazers_count": 0,
        "forks_count": 0,
    }


SETTINGS = {
    "login": "sanskarIN",
    "additional_repositories": ["scarp-lang/scarp"],
    "hidden": set(),
    "show_forks": False,
    "show_archived": True,
    "featured": ["scarp", "RepoDNA"],
}


class GitHubStub:
    def __init__(self, external):
        self.external = external
        self.calls = []

    def get(self, path):
        self.calls.append(path)
        if path == "/repos/scarp-lang/scarp":
            return {}, self.external
        if path == "/repos/scarp-lang/scarp/languages":
            return {}, {"Rust": 4000, "Python": 1000}
        raise AssertionError(f"Unexpected GET: {path}")

    def graphql(self, query, variables):
        return {
            "user": {
                "repositories": {
                    "pageInfo": {"hasNextPage": False, "endCursor": None},
                    "nodes": [{
                        "name": "RepoDNA",
                        "languages": {"edges": [
                            {"size": 5000, "node": {"name": "Rust", "color": "#dea584"}}
                        ]},
                    }],
                },
            },
        }


class MaintainedProjectTests(unittest.TestCase):
    def test_adds_public_scarp_once_without_claiming_personal_ownership(self):
        owner_repo = repo("sanskarIN", "RepoDNA")
        github = GitHubStub(repo("scarp-lang", "scarp"))
        result = project_data.include_additional_repositories(github, [owner_repo], SETTINGS)
        self.assertEqual({r["full_name"] for r in result}, {"sanskarIN/RepoDNA", "scarp-lang/scarp"})
        record = project_data.repository_record(github.external, {}, 5000, "sanskarIN")
        self.assertEqual(record["owner"], "scarp-lang")
        self.assertTrue(record["external"])
        self.assertEqual(record["language_bytes"], 5000)

    def test_rejects_private_or_mismatched_external_repositories(self):
        for invalid in (repo("scarp-lang", "scarp", private=True), repo("wrong-org", "scarp")):
            with self.subTest(invalid=invalid):
                with self.assertRaises(RuntimeError):
                    project_data.include_additional_repositories(GitHubStub(invalid), [], SETTINGS)

    def test_scarp_language_bytes_contribute_to_profile_total(self):
        own = repo("sanskarIN", "RepoDNA")
        extra = repo("scarp-lang", "scarp")
        github = GitHubStub(extra)
        sizes, colors = project_data.language_sizes(github, "sanskarIN", [own, extra])
        self.assertEqual(sizes["scarp-lang/scarp"], {"Rust": 4000, "Python": 1000})
        summary, count, total = project_data.language_summary([own, extra], sizes, colors)
        self.assertEqual((count, total), (2, 10000))
        self.assertEqual(summary[0]["name"], "Rust")
        self.assertEqual(summary[0]["percent"], 90.0)
        self.assertEqual(summary[1]["percent"], 10.0)

    def test_featured_breakdown_uses_repository_language_bytes(self):
        scarp = repo("scarp-lang", "scarp")
        other = repo("sanskarIN", "RepoDNA")
        records = [
            project_data.repository_record(scarp, {}, 10000, "sanskarIN"),
            project_data.repository_record(other, {}, 1000, "sanskarIN"),
        ]
        sizes = {
            "scarp-lang/scarp": {
                "Rust": 8000, "Python": 1000, "Shell": 500,
                "TOML": 250, "Makefile": 250,
            },
            "sanskarin/repodna": {"Rust": 1000},
        }
        project_data.attach_featured_languages(records, sizes, {}, ["scarp"])
        breakdown = records[0]["languages"]
        self.assertEqual([(item["name"], item["percent"]) for item in breakdown],
                         [("Rust", 80.0), ("Python", 10.0), ("Shell", 5.0), ("Other", 5.0)])
        self.assertAlmostEqual(sum(item["percent"] for item in breakdown), 100.0)
        self.assertNotIn("languages", records[1])

    def test_featured_breakdown_omits_zero_byte_repositories(self):
        record = project_data.repository_record(repo("scarp-lang", "scarp"), {}, 0, "sanskarIN")
        project_data.attach_featured_languages([record], {"scarp-lang/scarp": {}}, {}, ["scarp"])
        self.assertNotIn("languages", record)

    def test_featured_has_scarp_first(self):
        records = [
            {"name": "RepoDNA", "stars": 9, "pushed": "2026-11-09", "fork": False, "archived": False},
            {"name": "scarp", "stars": 0, "pushed": "2026-11-08", "fork": False, "archived": False},
        ]
        self.assertEqual(project_data.featured_names(records, SETTINGS, []), ["scarp", "RepoDNA"])

    def test_external_fork_obeys_visibility_setting(self):
        github = GitHubStub(repo("scarp-lang", "scarp", fork=True))
        self.assertEqual(project_data.include_additional_repositories(github, [], SETTINGS), [])


if __name__ == "__main__":
    unittest.main()
